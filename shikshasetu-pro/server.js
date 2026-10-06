import express from "express";
import { randomUUID } from "crypto";
import { MongoClient } from "mongodb";
const app = express();
app.use(express.json({ limit: "9mb" }));
app.use(express.static("public"));

const KEY = process.env.GEMINI_API_KEY,
  PIN = process.env.MENTOR_PIN;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const SUBJECTS = new Set(["math", "science", "english", "computer", "career", "other"]);

function asyncRoute(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

async function ai(question, lang, source) {
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
                text: `You are ShikshaSetu, a patient tutor for rural and tribal higher-education students, while also supporting classes 11–12. Answer in ${lang === "hi" ? "simple Hindi or Hinglish as the student asks" : "simple English"}, using a clear explanation, a small relevant example and steps when useful. Keep the answer concise but complete (up to 8 short sentences). You may give short notes, one follow-up question, or a short practice question if helpful. If verified source material is included, prioritize it and do not add unsupported claims; the UI will show its exact title. If no source is included, do not claim a source was used. If unsure, say so and suggest asking a mentor.${source ? ` Verified study material (prioritize this content): ${source.title}\n${source.content}` : ""}`,
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
              text: `You are ShikshaSetu, a careful study and scholarship guide for students in Madhya Pradesh, India. Reply in ${lang === "hi" ? "simple Hindi" : "simple English"}. Give 3-5 numbered, concise and practical next steps. Tailor the study advice to the supplied stage, goal, and progress. For scholarship requests, provide a checklist and suggest checking the National Scholarship Portal and the official MP scholarship portal; never claim eligibility, current deadlines, or guaranteed awards. For career requests, cover required skills, a learning roadmap, project ideas, certification verification, internship and interview preparation; do not guarantee jobs or invent specific credentials. Do not ask for personal contact details. Use plain text, no markdown headings.`,
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
  const kind = ["study", "scholarship", "career"].includes(body.kind) ? body.kind : null;
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
    career: {
      course: typeof body.course === "string" ? body.course.slice(0, 80) : "",
      branch: typeof body.branch === "string" ? body.branch.slice(0, 100) : "",
      semester: Number.isInteger(body.semester) && body.semester >= 1 && body.semester <= 20 ? body.semester : null,
      careerGoal: typeof body.careerGoal === "string" ? body.careerGoal.slice(0, 40) : "",
      skills: safeList(body.skills, 20),
      interests: safeList(body.interests, 20),
    },
  };
  if (!KEY) return res.status(503).json({ error: "ai_not_configured" });
  const plan = await learningRoadmap(details, body.lang === "hi" ? "hi" : "en");
  if (!plan) return res.status(502).json({ error: "ai_unavailable" });
  res.json({ plan });
}));

const contentRole = (req, res, next) => {
  const pin = req.get("x-content-pin");
  if (process.env.ADMIN_PIN && pin === process.env.ADMIN_PIN) {
    req.contentRole = "admin";
    return next();
  }
  if (process.env.FACULTY_PIN && pin === process.env.FACULTY_PIN) {
    req.contentRole = "faculty";
    return next();
  }
  if (!process.env.ADMIN_PIN && !process.env.FACULTY_PIN) {
    return res.status(503).json({ error: "content_access_not_configured" });
  }
  res.status(401).json({ error: "invalid_content_pin" });
};
const adminOnly = (req, res, next) =>
  req.contentRole === "admin"
    ? next()
    : res.status(403).json({ error: "admin_required" });
const safeList = (value, limit = 30) => Array.isArray(value)
  ? value.filter((item) => typeof item === "string").slice(0, limit).map((item) => item.slice(0, 200))
  : typeof value === "string"
    ? value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, limit).map((item) => item.slice(0, 200))
    : [];
const contentCollections = (db) => ({
  catalog: db.collection("college_catalog"),
  materials: db.collection("college_materials"),
  scholarships: db.collection("college_scholarships"),
  mentors: db.collection("college_mentors"),
  announcements: db.collection("college_announcements"),
  mentorshipRequests: db.collection("college_mentorship_requests"),
});

app.post("/api/content/session", contentRole, (req, res) => {
  res.json({ role: req.contentRole });
});
app.get("/api/college/catalog", asyncRoute(async (req, res) => {
  const items = await req.app.locals.college.catalog
    .find({ active: { $ne: false } }, { projection: { _id: 0 } })
    .sort({ course: 1 })
    .toArray();
  res.json(items);
}));
app.get("/api/college/materials", asyncRoute(async (req, res) => {
  const query = { approved: true, status: "published" };
  for (const field of ["university", "course", "branch", "subject", "unit", "topic", "language", "type"]) {
    const value = String(req.query[field] || "").slice(0, 100);
    if (value) query[field] = value;
  }
  const semester = Number(req.query.semester);
  if (Number.isInteger(semester) && semester >= 1 && semester <= 20) query.semester = semester;
  const year = Number(req.query.year);
  if (Number.isInteger(year) && year >= 1900 && year <= 2100) query.year = year;
  const items = await req.app.locals.college.materials
    .find(query, { projection: { _id: 0, fileData: 0 } })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();
  res.json(items);
}));
app.get("/api/college/materials/:id/file", asyncRoute(async (req, res) => {
  const item = await req.app.locals.college.materials.findOne({
    id: req.params.id,
    approved: true,
    status: "published",
    fileMime: "application/pdf",
    fileData: { $exists: true },
  });
  if (!item) return res.status(404).json({ error: "published_pdf_not_found" });
  const data = Buffer.from(item.fileData, "base64");
  res.set({
    "content-type": "application/pdf",
    "content-length": data.length,
    "content-disposition": `inline; filename="${String(item.fileName || "study-material.pdf").replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
    "cache-control": "public, max-age=3600",
    "x-content-type-options": "nosniff",
  });
  res.send(data);
}));
app.get("/api/college/scholarships", asyncRoute(async (req, res) => {
  const items = await req.app.locals.college.scholarships
    .find({ verified: true, published: true }, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();
  res.json(items);
}));
app.get("/api/college/mentors", asyncRoute(async (req, res) => {
  const items = await req.app.locals.college.mentors
    .find({ published: true, available: { $ne: false } }, { projection: { _id: 0 } })
    .sort({ name: 1 })
    .limit(100)
    .toArray();
  res.json(items);
}));
app.get("/api/college/announcements", asyncRoute(async (req, res) => {
  const items = await req.app.locals.college.announcements
    .find({ published: true }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
  res.json(items);
}));
app.post("/api/college/mentorship-requests", asyncRoute(async (req, res) => {
  const mentorId = String(req.body?.mentorId || "").slice(0, 80);
  const question = String(req.body?.question || "").trim().slice(0, 1000);
  const studentName = String(req.body?.studentName || "").trim().slice(0, 60);
  if (!mentorId || question.length < 5) {
    return res.status(400).json({ error: "mentor_and_question_required" });
  }
  const mentor = await req.app.locals.college.mentors.findOne({
    id: mentorId,
    published: true,
    available: { $ne: false },
  });
  if (!mentor) return res.status(404).json({ error: "mentor_not_available" });
  const request = {
    id: randomUUID(),
    mentorId,
    mentorName: String(mentor.name).slice(0, 100),
    studentName,
    question,
    status: "pending",
    createdAt: Date.now(),
  };
  await req.app.locals.college.mentorshipRequests.insertOne(request);
  res.status(201).json({ id: request.id, status: request.status });
}));
app.get("/api/content/:resource", contentRole, asyncRoute(async (req, res) => {
  const collection = req.app.locals.college[req.params.resource];
  if (!["catalog", "materials", "scholarships", "mentors", "announcements", "mentorshipRequests"].includes(req.params.resource) || !collection) {
    return res.status(404).json({ error: "content_resource_not_found" });
  }
  if (req.params.resource === "mentorshipRequests" && req.contentRole !== "admin") return res.status(403).json({ error: "admin_required" });
  const filter = req.contentRole === "faculty" && req.params.resource === "materials"
    ? { createdByRole: "faculty" }
    : {};
  const items = await collection.find(filter, { projection: { _id: 0, fileData: 0 } })
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray();
  res.json(items);
}));
app.post("/api/content/catalog", contentRole, adminOnly, asyncRoute(async (req, res) => {
  const body = req.body || {};
  const course = String(body.course || "").trim().slice(0, 100);
  const branch = String(body.branch || "").trim().slice(0, 100);
  const university = String(body.university || "").trim().slice(0, 120);
  const semester = Number(body.semester);
  const subjects = safeList(body.subjects, 50);
  if (!course || !branch || !university || !Number.isInteger(semester) || semester < 1 || semester > 20) {
    return res.status(400).json({ error: "valid_course_branch_university_semester_required" });
  }
  const item = {
    id: randomUUID(), course, branch, university, semester, subjects,
    units: safeList(body.units, 100),
    topics: safeList(body.topics, 200),
    active: true, createdAt: Date.now(), updatedAt: Date.now(),
  };
  await req.app.locals.college.catalog.insertOne(item);
  res.status(201).json({ ...item, _id: undefined });
}));
app.post("/api/content/materials", contentRole, asyncRoute(async (req, res) => {
  const b = req.body || {};
  const required = ["university", "course", "branch", "subject", "title"];
  if (required.some((key) => typeof b[key] !== "string" || !b[key].trim())) {
    return res.status(400).json({ error: "university_course_branch_subject_title_required" });
  }
  const type = ["notes", "pdf", "important-questions", "pyq", "assignment", "video", "practice", "quiz"].includes(b.type) ? b.type : null;
  if (!type) return res.status(400).json({ error: "valid_material_type_required" });
  const year = Number(b.year);
  if (type === "pyq" && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
    return res.status(400).json({ error: "pyq_year_required" });
  }
  const quiz = Array.isArray(b.quiz)
    ? b.quiz.slice(0, 20).map((question) => ({
        question: typeof question?.question === "string" ? question.question.trim().slice(0, 300) : "",
        options: safeList(question?.options, 6),
        answer: Number.isInteger(question?.answer) ? question.answer : -1,
      }))
    : [];
  if (type === "quiz" && (!quiz.length || quiz.some((question) =>
    !question.question ||
    question.options.length < 2 ||
    question.options.some((option) => !option) ||
    question.answer < 0 ||
    question.answer >= question.options.length
  ))) {
    return res.status(400).json({ error: "quiz_questions_require_two_options_and_valid_answers" });
  }
  const fileData = typeof b.fileData === "string" ? b.fileData : "";
  if (fileData) {
    const encoded = fileData.match(/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/);
    const bytes = encoded ? Buffer.from(encoded[1], "base64") : Buffer.alloc(0);
    if (b.fileMime !== "application/pdf" || !encoded || bytes.length > 6 * 1024 * 1024 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return res.status(400).json({ error: "pdf_must_be_valid_and_under_6mb" });
    }
  }
  const item = {
    id: randomUUID(),
    university: b.university.trim().slice(0, 120),
    course: b.course.trim().slice(0, 100),
    branch: b.branch.trim().slice(0, 100),
    semester: Number.isInteger(Number(b.semester)) ? Math.max(1, Math.min(20, Number(b.semester))) : null,
    year: Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null,
    subject: b.subject.trim().slice(0, 120),
    unit: String(b.unit || "").trim().slice(0, 120),
    topic: String(b.topic || "").trim().slice(0, 160),
    title: b.title.trim().slice(0, 180),
    description: String(b.description || "").slice(0, 2000),
    language: String(b.language || "hi").slice(0, 30),
    type,
    url: String(b.url || "").slice(0, 1000),
    questions: safeList(b.questions, 50),
    quiz,
    fileData,
    fileMime: fileData ? "application/pdf" : "",
    fileName: fileData ? String(b.fileName || "study-material.pdf").slice(0, 120) : "",
    approved: false,
    status: "draft",
    createdByRole: req.contentRole,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  if (fileData) item.fileData = fileData.slice(fileData.indexOf(",") + 1);
  if (item.url && !/^https:\/\/[^\s]+$/i.test(item.url)) return res.status(400).json({ error: "material_url_must_use_https" });
  if (item.type === "pdf" && !item.fileData && !item.url) return res.status(400).json({ error: "pdf_file_or_https_url_required" });
  if (item.type === "video" && !item.url) return res.status(400).json({ error: "video_url_required" });
  await req.app.locals.college.materials.insertOne(item);
  res.status(201).json({ id: item.id, status: item.status });
}));
app.post("/api/content/materials/:id/submit", contentRole, asyncRoute(async (req, res) => {
  const result = await req.app.locals.college.materials.updateOne(
    { id: req.params.id, status: "draft", ...(req.contentRole === "faculty" ? { createdByRole: "faculty" } : {}) },
    { $set: { status: "pending_approval", updatedAt: Date.now() } },
  );
  if (!result.matchedCount) return res.status(404).json({ error: "editable_draft_not_found" });
  res.json({ ok: true, status: "pending_approval" });
}));
app.patch("/api/content/materials/:id/status", contentRole, adminOnly, asyncRoute(async (req, res) => {
  const status = req.body?.status;
  if (!["approved", "published", "rejected"].includes(status)) {
    return res.status(400).json({ error: "valid_review_status_required" });
  }
  const allowedFrom = status === "approved"
    ? ["pending_approval"]
    : status === "published"
      ? ["approved"]
      : ["pending_approval", "approved"];
  const update = {
    status,
    approved: status === "approved" || status === "published",
    published: status === "published",
    updatedAt: Date.now(),
  };
  if (status === "published") update.publishedAt = Date.now();
  const result = await req.app.locals.college.materials.updateOne(
    { id: req.params.id, status: { $in: allowedFrom } },
    { $set: update },
  );
  if (!result.matchedCount) return res.status(404).json({ error: "material_not_found" });
  res.json({ ok: true, ...update });
}));
app.post("/api/content/:resource", contentRole, adminOnly, asyncRoute(async (req, res) => {
  const resource = req.params.resource;
  if (!["scholarships", "mentors", "announcements"].includes(resource)) {
    return res.status(404).json({ error: "content_resource_not_found" });
  }
  const b = req.body || {};
  const item = { id: randomUUID(), createdAt: Date.now(), updatedAt: Date.now() };
  if (resource === "scholarships") {
    item.name = String(b.name || "").trim().slice(0, 160);
    item.provider = String(b.provider || "").trim().slice(0, 160);
    item.eligibility = String(b.eligibility || "").trim().slice(0, 2000);
    item.course = String(b.course || "").trim().slice(0, 120);
    item.state = String(b.state || "").trim().slice(0, 100);
    item.incomeCriteria = String(b.incomeCriteria || "").trim().slice(0, 180);
    item.benefits = String(b.benefits || "").trim().slice(0, 1000);
    item.lastDate = String(b.lastDate || "").slice(0, 40);
    item.documents = safeList(b.documents, 30);
    item.url = String(b.url || "").slice(0, 1000);
    item.verified = false;
    item.published = false;
    if (!item.name || !item.provider || !item.eligibility || !/^https:\/\/[^\s]+$/i.test(item.url)) return res.status(400).json({ error: "scholarship_details_and_https_url_required" });
  } else if (resource === "mentors") {
    item.name = String(b.name || "").trim().slice(0, 100);
    item.expertise = safeList(b.expertise, 20);
    item.subjects = safeList(b.subjects, 20);
    item.experience = String(b.experience || "").slice(0, 100);
    item.languages = safeList(b.languages, 10);
    item.availability = String(b.availability || "").slice(0, 200);
    item.published = false;
    item.available = true;
    if (!item.name || !item.subjects.length) return res.status(400).json({ error: "mentor_name_and_subjects_required" });
  } else {
    item.title = String(b.title || "").trim().slice(0, 180);
    item.message = String(b.message || "").trim().slice(0, 2000);
    item.type = String(b.type || "notice").slice(0, 40);
    item.published = false;
    if (!item.title || !item.message) return res.status(400).json({ error: "announcement_title_and_message_required" });
  }
  await req.app.locals.college[resource].insertOne(item);
  res.status(201).json({ id: item.id, published: item.published, verified: item.verified });
}));
app.patch("/api/content/:resource/:id/publish", contentRole, adminOnly, asyncRoute(async (req, res) => {
  const resource = req.params.resource;
  if (!["catalog", "scholarships", "mentors", "announcements"].includes(resource)) {
    return res.status(404).json({ error: "content_resource_not_found" });
  }
  const published = req.body?.published === true;
  const updates = { published, updatedAt: Date.now() };
  if (resource === "scholarships") updates.verified = published && req.body?.verified === true;
  if (resource === "catalog") updates.active = published;
  const result = await req.app.locals.college[resource].updateOne({ id: req.params.id }, { $set: updates });
  if (!result.matchedCount) return res.status(404).json({ error: "content_item_not_found" });
  res.json({ ok: true, ...updates });
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
  const id = randomUUID();
  let source = null;
  const materialId = String(req.body?.materialId || "").slice(0, 80);
  if (materialId && !req.body?.mentor) {
    const item = await req.app.locals.college.materials.findOne(
      { id: materialId, approved: true, status: "published" },
      { projection: { _id: 0, title: 1, description: 1, topic: 1, questions: 1, fileData: 0 } },
    );
    if (item) source = { title: item.title, content: [item.description, item.topic, ...(item.questions || [])].filter(Boolean).join("\n").slice(0, 7000) };
  }
  const answer = req.body?.mentor ? null : await ai(question, lang, source); // mentor:true skips AI
  await req.app.locals.doubts.insertOne({
    id,
    question,
    subject,
    lang,
    answer,
    mentor: false,
    at: Date.now(),
  });
  res.json({ id, answer, sourceTitle: answer && source ? source.title : null });
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
  const college = contentCollections(database);
  await Promise.all([
    doubts.createIndex({ id: 1 }, { unique: true }),
    doubts.createIndex({ subject: 1, answer: 1, at: -1 }),
    college.catalog.createIndex({ id: 1 }, { unique: true }),
    college.materials.createIndex({ id: 1 }, { unique: true }),
    college.materials.createIndex({ status: 1, approved: 1, university: 1, course: 1, branch: 1, semester: 1, subject: 1, type: 1 }),
    college.scholarships.createIndex({ id: 1 }, { unique: true }),
    college.mentors.createIndex({ id: 1 }, { unique: true }),
    college.announcements.createIndex({ id: 1 }, { unique: true }),
    college.mentorshipRequests.createIndex({ id: 1 }, { unique: true }),
  ]);
  app.locals.doubts = doubts;
  app.locals.college = college;

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
