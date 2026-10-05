import express from "express";
import { randomUUID } from "crypto";
const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

const doubts = new Map(); // TODO: swap for MongoDB
const KEY = process.env.GEMINI_API_KEY,
  PIN = process.env.MENTOR_PIN;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

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
app.post("/api/doubts", async (req, res) => {
  const question = String(req.body?.question || "")
    .slice(0, 500)
    .trim();
  const lang = req.body?.lang === "en" ? "en" : "hi";
  if (!question) return res.status(400).json({ error: "question required" });
  const id = randomUUID(),
    answer = req.body?.mentor ? null : await ai(question, lang); // mentor:true skips AI
  doubts.set(id, { id, question, lang, answer, mentor: false, at: Date.now() });
  res.json({ id, answer });
});

// Student app polls this for the mentor's reply.
app.get("/api/doubts/:id", (req, res) => {
  const d = doubts.get(req.params.id);
  if (!d) return res.status(404).json({});
  res.json({ answer: d.answer, mentor: d.mentor });
});

const auth = (req, res, next) =>
  PIN && req.get("x-pin") === PIN
    ? next()
    : res.status(401).json({ error: "bad pin" });
app.get("/api/mentor/doubts", auth, (_q, r) =>
  r.json([...doubts.values()].filter((d) => !d.answer).reverse()),
);
app.post("/api/mentor/reply", auth, (req, res) => {
  const d = doubts.get(req.body?.id),
    text = String(req.body?.text || "")
      .slice(0, 1000)
      .trim();
  if (!d || !text) return res.status(400).json({});
  d.answer = text;
  d.mentor = true;
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () =>
  console.log("ShikshaSetu on http://localhost:" + (process.env.PORT || 3000)),
);
