import express from "express";
import { randomUUID } from "crypto";
import { MongoClient } from "mongodb";
const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

const KEY = process.env.GEMINI_API_KEY,
  PIN = process.env.MENTOR_PIN;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

function asyncRoute(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

async function ai(question, lang) {
  if (!KEY) {
    console.error("GEMINI_API_KEY is missing");
    return null;
  }
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": KEY },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `You are ShikshaSetu, a patient tutor for rural Indian students (class 11 to college). Answer in ${lang === "hi" ? "simple Hindi" : "simple English"}, at most 4 short sentences, no markdown. If unsure, say so and suggest asking a mentor.`,
              },
            ],
          },
          contents: [{ role: "user", parts: [{ text: question }] }],
          generationConfig: { maxOutputTokens: 1500 },
        }),
      },
    );
    const j = await r.json();
    if (!r.ok) console.error("Gemini error:", j.error?.message);
    const text = j.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim();
    if (!text)
      console.error(
        "Gemini empty reply, model:",
        MODEL,
        JSON.stringify(j).slice(0, 300),
      );
    return text || null;
  } catch (e) {
    console.error("Gemini unreachable:", e.message);
    return null;
  }
}

// Student asks. If AI can't answer, the doubt waits for a mentor (answer: null).
app.post("/api/doubts", asyncRoute(async (req, res) => {
  const question = String(req.body?.question || "")
    .slice(0, 500)
    .trim();
  const lang = req.body?.lang === "en" ? "en" : "hi";
  if (!question) return res.status(400).json({ error: "question required" });
  const id = randomUUID(),
    answer = req.body?.mentor ? null : await ai(question, lang); // mentor:true skips AI
  await req.app.locals.doubts.insertOne({
    id,
    question,
    lang,
    answer,
    mentor: false,
    at: Date.now(),
  });
  res.json({ id, answer });
}));

// Student app polls this for the mentor's reply.
app.get("/api/doubts/:id", asyncRoute(async (req, res) => {
  const d = await req.app.locals.doubts.findOne(
    { id: req.params.id },
    { projection: { _id: 0, answer: 1, mentor: 1 } },
  );
  if (!d) return res.status(404).json({});
  res.json({ answer: d.answer, mentor: d.mentor });
}));

const auth = (req, res, next) =>
  PIN && req.get("x-pin") === PIN
    ? next()
    : res.status(401).json({ error: "bad pin" });
app.get("/api/mentor/doubts", auth, asyncRoute(async (_req, res) => {
  const doubts = await req.app.locals.doubts
    .find({ answer: null }, { projection: { _id: 0 } })
    .sort({ at: -1 })
    .toArray();
  res.json(doubts);
}));
app.post("/api/mentor/reply", auth, asyncRoute(async (req, res) => {
  const id = req.body?.id,
    text = String(req.body?.text || "")
      .slice(0, 1000)
      .trim();
  if (!id || !text) return res.status(400).json({});
  const result = await req.app.locals.doubts.updateOne(
    { id, answer: null },
    { $set: { answer: text, mentor: true } },
  );
  if (!result.matchedCount) return res.status(400).json({});
  res.json({ ok: true });
}));

app.use((err, _req, res, next) => {
  console.error("Request failed:", err.name || "Error", err.code || "");
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "internal server error" });
});

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const database = client.db(process.env.MONGODB_DB || "shikshasetu");
  const doubts = database.collection("doubts");
  await Promise.all([
    doubts.createIndex({ id: 1 }, { unique: true }),
    doubts.createIndex({ answer: 1, at: -1 }),
  ]);
  app.locals.doubts = doubts;

  const server = app.listen(process.env.PORT || 3000, () =>
    console.log("ShikshaSetu on http://localhost:" + (process.env.PORT || 3000)),
  );

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      server.close(() => client.close().catch(() => {
        console.error("Failed to close MongoDB connection");
      }));
    });
  }
}

start().catch((err) => {
  console.error("Server startup failed:", err.name || "Error", err.code || "");
  process.exitCode = 1;
});
