import express from "express";
import { randomUUID } from "crypto";
import { MongoClient } from "mongodb";
const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

const KEY = process.env.GEMINI_API_KEY,
  PIN = process.env.MENTOR_PIN;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const SUBJECTS = new Set(["math", "science", "english", "computer", "career", "other"]);

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

async function learningRoadmap(details, lang) {
  if (!KEY) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": KEY },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `You are ShikshaSetu, a careful study and scholarship guide for students in Madhya Pradesh, India. Reply in ${lang === "hi" ? "simple Hindi" : "simple English"}. Give 3-5 numbered, concise and practical next steps. Tailor the study advice to the supplied stage, goal, and progress. For scholarship requests, provide a checklist and suggest checking the National Scholarship Portal and the official MP scholarship portal; never claim eligibility, current deadlines, or guaranteed awards. Do not ask for personal contact details. Use plain text, no markdown headings.`,
            }],
          },
          contents: [{
            role: "user",
            parts: [{ text: JSON.stringify(details) }],
          }],
          generationConfig: { maxOutputTokens: 900 },
        }),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      console.error("Gemini roadmap error:", result.error?.message);
      return null;
    }
    const text = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();
    if (!text) console.error("Gemini returned an empty learning roadmap");
    return text || null;
  } catch (error) {
    console.error("Gemini roadmap unreachable:", error.message);
    return null;
  }
}

app.post("/api/learning-roadmap", asyncRoute(async (req, res) => {
  const body = req.body || {};
  const kind = body.kind === "scholarship" ? "scholarship" : body.kind === "study" ? "study" : null;
  if (!kind) return res.status(400).json({ error: "valid roadmap kind required" });
  const list = (value) => Array.isArray(value)
    ? value.filter((item) => typeof item === "string").slice(0, 20).map((item) => item.slice(0, 80))
    : [];
  const details = {
    request: kind,
    student: {
      stage: typeof body.stage === "string" ? body.stage.slice(0, 30) : "",
      className: typeof body.className === "string" ? body.className.slice(0, 40) : "",
      goal: typeof body.goal === "string" ? body.goal.slice(0, 20) : "",
      district: typeof body.district === "string" ? body.district.slice(0, 40) : "",
    },
    progress: {
      completed: list(body.completed),
      started: list(body.started),
      remaining: list(body.remaining),
      quizAccuracy: Number.isInteger(body.quizAccuracy) && body.quizAccuracy >= 0 && body.quizAccuracy <= 100
        ? body.quizAccuracy
        : null,
    },
  };
  if (!KEY) return res.status(503).json({ error: "ai_not_configured" });
  const plan = await learningRoadmap(details, body.lang === "hi" ? "hi" : "en");
  if (!plan) return res.status(502).json({ error: "ai_unavailable" });
  res.json({ plan });
}));

// Student asks. If AI can't answer, the doubt waits for a mentor (answer: null).
app.post("/api/doubts", asyncRoute(async (req, res) => {
  const question = String(req.body?.question || "")
    .slice(0, 500)
    .trim();
  const lang = req.body?.lang === "en" ? "en" : "hi";
  const requestedSubject = req.body?.subject;
  if (requestedSubject !== undefined && !SUBJECTS.has(requestedSubject)) {
    return res.status(400).json({ error: "valid subject required" });
  }
  const subject = requestedSubject || "other";
  if (!question) return res.status(400).json({ error: "question required" });
  const id = randomUUID(),
    answer = req.body?.mentor ? null : await ai(question, lang); // mentor:true skips AI
  await req.app.locals.doubts.insertOne({
    id,
    question,
    subject,
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
  !PIN
    ? res.status(503).json({ error: "mentor_pin_not_configured" })
    : req.get("x-pin") === PIN
      ? next()
      : res.status(401).json({ error: "invalid_pin" });
app.get("/api/mentor/doubts", auth, asyncRoute(async (req, res) => {
  const subject = req.query.subject;
  if (!SUBJECTS.has(subject)) {
    return res.status(400).json({ error: "valid subject required" });
  }
  const subjectFilter = subject === "other"
    ? { $in: ["other", null] }
    : subject;
  const doubts = await req.app.locals.doubts
    .find({ answer: null, subject: subjectFilter }, { projection: { _id: 0 } })
    .sort({ at: -1 })
    .toArray();
  res.json(doubts);
}));
app.post("/api/mentor/reply", auth, asyncRoute(async (req, res) => {
  const id = req.body?.id,
    subject = req.body?.subject,
    text = String(req.body?.text || "")
      .slice(0, 1000)
      .trim();
  if (!id || !text || !SUBJECTS.has(subject)) {
    return res.status(400).json({});
  }
  const subjectFilter = subject === "other"
    ? { $in: ["other", null] }
    : subject;
  const result = await req.app.locals.doubts.updateOne(
    { id, answer: null, subject: subjectFilter },
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
    doubts.createIndex({ subject: 1, answer: 1, at: -1 }),
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
