# ShikshaSetu (Team K Square)
Offline-first PWA + small Node backend.

## Run
    npm install
    cp .env.example .env      # put your GEMINI_API_KEY (and MENTOR_PIN) (Node 20.6+)
    npm start                 # http://localhost:3000

## Test the offline promise
1. Open the app online -> Home -> Download a pack (saved in IndexedDB).
2. DevTools > Network > Offline (or airplane mode) -> reload -> lesson, Listen, offline FAQ still work.
3. Bolo: ask something not in the FAQ while offline -> "Queued". Go online -> answer syncs from AI.
4. Home > Share packs (Web Share on Android) -> other phone: Import.

## Lesson packs
The app includes CUET and college guidance, digital safety, spoken English, scholarship documents, Word and Excel basics, and MP government exam preparation. Download packs while online to use their lessons, quizzes, and FAQs offline.
The interface can be switched between Hindi, English, and Bagheli. Bagheli lesson text is currently available in the digital safety pack.

## Deploy
Render/Railway web service: build `npm install`, start `npm start`, env `GEMINI_API_KEY (and MENTOR_PIN)`. HTTPS is required for mic + service worker on phones.

## Layout
public/ (app.js, sw.js, packs/*.json, faq.json, schemes inside app.js) · server.js (AI + doubts API)
Mentor page: /mentor.html (enter MENTOR_PIN)
