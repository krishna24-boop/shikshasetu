# ShikshaSetu (Team K Square)
Offline-first PWA + small Node backend.

## Run
    npm install
    cp .env.example .env      # set GEMINI_API_KEY, MENTOR_PIN, and MONGODB_URI
    npm start                 # http://localhost:3000

MongoDB Atlas is required for the doubts/mentor API. Set `MONGODB_URI` to
your Atlas connection string and optionally set `MONGODB_DB` (defaults to
`shikshasetu`). Keep the real URI in your local `.env` or the hosting
provider's environment settings; never commit it to Git.

## Test the offline promise
1. Open the app online -> Home -> Download a pack (saved in IndexedDB).
2. DevTools > Network > Offline (or airplane mode) -> reload -> lesson, Listen, offline FAQ still work.
3. Bolo: ask something not in the FAQ while offline -> "Queued". Go online -> answer syncs from AI.
4. Home > Share packs (Web Share on Android) -> other phone: Import.

## Lesson packs
The app includes CUET and college guidance, digital safety, spoken English, scholarship documents, Word and Excel basics, and MP government exam preparation. Download packs while online to use their lessons, quizzes, and FAQs offline.
The interface can be switched between Hindi, English, Bagheli, and Bundeli. Bagheli and Bundeli lesson text is currently available in the digital safety pack.
The supplied ShikshaSetu splash screen appears briefly before sign-in; students
and mentors choose their role on the same login screen.
Student name, study stage, district, class, institution, and career goal are
optional. Student profile and lesson/quiz progress are saved in the current
browser only; this is a local profile, not a server-backed student account.
The Progress dashboard tracks opened lesson packs and quiz completions. Study
and scholarship roadmaps always have a built-in offline-ready plan; when online,
the app can optionally personalize that plan using `GEMINI_API_KEY`. Scholarship
eligibility and deadlines must be confirmed on official portals.

## Deploy
Render/Railway web service: build `npm install`, start `npm start`, env `MONGODB_URI`, `MONGODB_DB` (optional), `GEMINI_API_KEY` (and `MENTOR_PIN`). HTTPS is required for mic + service worker on phones.

## Layout
public/ (app.js, sw.js, packs/*.json, faq.json, schemes inside app.js) · server.js (AI + MongoDB-backed doubts API)
Mentors choose **Mentor** from the student login screen, select a subject, and
enter the `MENTOR_PIN` configured in the hosting environment. Student questions
are routed to mentors by subject (Mathematics, Science, English, Computer,
Career & Exams, or Other). Add `MENTOR_PIN` in Render/Railway environment
settings and redeploy after changing it. The same configured mentor PIN is used
for the available subject inboxes.
