# Skibidi Sigma IQ+ — Test Anything

The full pivot of the original Skibidi Sigma IQ: the same quiz engine (timed MCQs,
category radar, score analysis) turned into a **test-anything platform** with
pause-and-resume sessions, exam formats, and on-device user profiles.

## Modes

| Mode | What it does |
|---|---|
| **Paste Anything** | Paste any notes/text (400+ characters). A local generator builds MCQs — definitions, fill-in-the-blank key details, number facts, and "which statement matches the text" — each with the source sentence as its explanation. No API key needed. Optional: paste your own Gemini key (session only, never saved) for AI-written questions, with automatic fallback to the local generator. |
| **Sigma IQ** | The original test, rebuilt offline with a hand-checked 24-question bank across Logical, Numerical, Verbal and Spatial reasoning. |
| **Friend Duel** | Finish any quiz → "Create duel link". A friend opens the link (or pastes the code) and takes the **exact same questions**, then both scores and radars are compared head-to-head. |
| **Weak-spot Drill** | After any result, one tap builds a targeted round from your weakest categories. Your history panel also tracks your weakest areas across all attempts. |


## Quiz formats (new in v2.1)

- **Practice** — no clock. Take as long as you like.
- **Countdown** — one total clock for the whole quiz: 5, 10, 20, 30, 60, 120, or
  **180 minutes (a full 3-hour exam)**. At zero, the quiz scores what you answered.
- **Sprint** — a per-question clock (30/60/90s). Time out and the question locks
  in (your selection, or blank) and you move on.

## Pause, sessions, and profiles (new in v2.1)

- **Pause any quiz** — the clock freezes and the question hides. Or just close
  the tab: your in-progress quiz is auto-saved and the home screen offers
  **Resume where I left off** next visit.
- **Profiles ("login")** — GitHub Pages is static hosting with no server, so
  accounts here are on-device profiles: pick Guest or create a named profile
  (optional PIN as a convenience lock on shared devices). Each profile keeps
  its own history, stats, and saved quizzes *in that browser*. Cross-device
  accounts would need a backend (e.g. Supabase/Firebase) — see PLAN.md roadmap.

Every result includes: score + verdict, mastery radar (with duel overlay), a coach
note naming your weakest area and time-per-question, a full review with an
explanation for **every** question, and a downloadable **share-card PNG**.

Two themes, same engine: **Sigma** (the original meme dark-neon look) and
**Pro** (clean light theme for classrooms / clients). Toggle in the header.

## Run locally

Prerequisites: Node.js 18+

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build into dist/
npm run typecheck
```

No `.env` or API key is required. (Security fix vs v1: v1 baked `GEMINI_API_KEY`
into the build, shipping it to every visitor. v2 never does — Gemini is an
optional, session-only, bring-your-own-key enhancement.)

## Deploy (GitHub Pages)

Pushing to `main` runs `.github/workflows/deploy.yml` (build → Pages). One-time:
in the GitHub repo, **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The Vite `base` switches to `/Skibidi-Sigma-IQ/` automatically in Actions.
Then submit `https://ankitgarg43.github.io/Skibidi-Sigma-IQ/sitemap.xml` in
Google Search Console. SEO/meta, favicon, web manifest, `robots.txt` and
`sitemap.xml` are already in `public/`.


## Layout

- `App.tsx` — app state machine (setup → quiz → results), formats/timers, pause/resume, profiles UI, duel comparison, review
- `lib/generateFromText.ts` — the local paste-to-quiz generator
- `lib/scoring.ts` — scoring, mastery breakdown, coach note, per-profile history
- `lib/profiles.ts` — on-device profiles + saved (paused) sessions
- `lib/challenge.ts` — duel link/code encoding (frozen question sets)
- `components/ShareCard.ts` — canvas-drawn PNG result card
- `services/geminiService.ts` — optional Gemini enhancement (bring-your-own-key)
- `services/quizService.ts` — weak-spot drills from any question pool
- `data/iqBank.ts` — the offline IQ bank

See `PLAN.md` for the product plan, what was reused from v1 file-by-file, and the
roadmap (hosted backend for cross-device accounts and duels, PDF upload).

> Practice tool: questions are original practice questions, not any official
> exam. IQ mode is for entertainment and is not a clinical IQ measure.
> Duel links are for bragging rights — answers travel inside the code by design,
> so duels are friendly, not secure exams.
