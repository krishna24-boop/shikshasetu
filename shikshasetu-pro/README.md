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

## Deploy
Render/Railway web service: build `npm install`, start `npm start`, env `MONGODB_URI`, `MONGODB_DB` (optional), `GEMINI_API_KEY` (and `MENTOR_PIN`). HTTPS is required for mic + service worker on phones.

## Layout
public/ (app.js, sw.js, packs/*.json, faq.json, schemes inside app.js) · server.js (AI + MongoDB-backed doubts API)
Mentor page: /mentor.html (enter MENTOR_PIN)
