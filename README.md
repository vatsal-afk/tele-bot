# Bhawan Buddy

Built on **Telegram**, powered by **Groq LLaMA**, backed by **Neon PostgreSQL**, and deployed serverlessly on **Vercel**.

---

## Features

### Core Tracking
- **Natural language meal logging** — just say _"I had rajma chawal and 2 rotis at mess"_
- **Exercise & water logging** — gym, cardio, yoga, any activity
- **ICMR-NIN personalised targets** — calories, protein, carbs, fats calculated per your age, weight, activity level, and fitness goal
- **Daily dashboard** — real-time progress bars for macros, water, and budget
- **Weekly reflection** — Groq-generated summary of your week's patterns

### 🔍 AI-Powered Food Intelligence
| Situation | What happens |
|-----------|-------------|
| Common Indian/mess food | Instant lookup from local DB (ICMR-NIN values) |
| Packaged brand product (e.g. Epigamia, Amul, Yoga Bar) | Open Food Facts API → Tavily+Groq fallback |
| Unknown dish (e.g. Kulhad Pizza, Ramen) | Tavily web search → Groq macro synthesis |
| All resolved results | Cached in Neon DB — never looked up twice |

### 🚫 Rejection Memory
- Tap **❌ Something Else** on any suggestion
- Bot logs your rejection and never suggests that item again today
- Natural language works too: _"give me something else, I had this yesterday"_

### 📅 Smart Timetable + 🌡️ Weather Nudges
- Set your class schedule with `/timetable Mon 9am-11am LHC Physics; Tue 14:00-16:00 ECE Lab`
- When it's **>35°C** and you're about to head to class, bot sends a hydration alert
- Falls back to IITR default class schedule if no timetable set

### 🍽️ Proactive Mess Notifications
- Fires at your scheduled breakfast/lunch/dinner times (via GitHub Actions cron)
- Shows today's mess menu from the stored schedule
- Works if you're at mess **or at home** — just tell it what you had

---

## Commands

| Command | What it does |
|---------|-------------|
| `/start` | Onboarding (profile setup) |
| `/dashboard` | Today's nutrition + budget progress |
| `/log` | Quick-log meal / exercise / water |
| `/budget` | Spending summary |
| `/weekly` | 7-day reflection |
| `/timetable` | View or set your class schedule |
| `/messmenu` | Update mess menu any time (not just Sundays) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Bot framework | [GrammY](https://grammy.dev) |
| LLM | [Groq](https://groq.com) — LLaMA 3.3 70B (chat) + LLaMA 3.1 8B (classification) |
| Database | [Neon](https://neon.tech) serverless PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| Web search | [Tavily API](https://tavily.com) |
| Brand lookup | [Open Food Facts](https://world.openfoodfacts.org) |
| Weather | [Open-Meteo](https://open-meteo.com) (no key needed) |
| Deployment | [Vercel](https://vercel.com) (webhook) |
| Notifications | GitHub Actions cron (every 5 min) |

---

## Setup

### 1. Clone & Install
```bash
git clone https://github.com/your-username/tele-bot
cd tele-bot
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in:
```env
TELEGRAM_BOT_TOKEN=   # From @BotFather
GROQ_API_KEY=         # From console.groq.com
DATABASE_URL=         # Neon PostgreSQL connection string
TAVILY_API_KEY=       # From app.tavily.com (free tier: 1000 req/month)
```

### 3. Initialize Database
```bash
npx drizzle-kit push
```

### 4. Run Locally
```bash
npm run dev
```

### 5. Deploy to Vercel
```bash
vercel deploy
```
Then register your webhook:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-vercel-url.vercel.app/api/webhook
```

### 6. GitHub Actions (Notifications)
Add these secrets in your repo → **Settings → Secrets → Actions**:
- `TELEGRAM_BOT_TOKEN`
- `DATABASE_URL`
- `GROQ_API_KEY`
- `TAVILY_API_KEY`

The cron runs every 5 min and fires meal reminders within ±10 min of each user's scheduled meal time.