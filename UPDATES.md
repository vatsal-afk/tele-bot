# Future Updates & Advanced Feature Roadmap

This file tracks features that are architecturally sound and desirable but deferred from the current implementation sprint. They should be picked up once the Phase 1–4 core features are stable.

---

## 🧠 Epicure Food Embedding Integration (High Priority)

**Source:** `references/2605.22391v1.pdf` — *Epicure: Navigating the Emergent Geometry of Food Ingredient Embeddings* (Radzikowski & Chen, 2026)

**Current blocker:** Model weights are not yet publicly released ("Code and trained artefacts are not released at this time"). The arXiv ID is `2605.22391`.

### What we can use *right now* (without weights)

The paper's canonical vocabulary and methodology is still immediately exploitable:

1. **Canonical 1,790-ingredient vocabulary CSV** — The paper describes an LLM-augmented canonicalisation pipeline that normalised ~200,000 raw ingredient strings into 1,790 canonical entries. The final vocabulary CSV (ingredient → FlavorDB anchor → USDA anchor) is referenced in the paper. When released, we can use this to:
   - Normalise raw food strings from Tavily search snippets into canonical names before macro lookup
   - Dramatically reduce fuzzy-match failures in `lookupFoodMacros()`

2. **FlavorDB ingredient–compound graph** — The 80,019-edge typed graph used to train Epicure is derived from [FlavorDB](https://cosylab.iiitd.edu.in/flavordb/) which *is* publicly accessible. We can query it directly to determine:
   - What flavor compounds a dish shares with other dishes (for semantic rejection handling)
   - Whether two dishes are "chemically similar" — useful for the "give me something else like X" use case

3. **Cuisine taxonomy tags** — The paper defines 8 cuisine macro-regions with distinctive-marker ingredient lists (South-Asian, East-Asian, Latin-American, Mediterranean, etc.). We can implement a simplified version of this using a hand-curated lookup table for Indian hostel foods before the model ships.

### What we will do once weights ship

When the Epicure-Core 300-D embeddings are released:

#### A. Semantic Rejection Navigation (replaces current exclusion list approach)

Instead of simply filtering out rejected items from `rankItems()`, use SLERP direction arithmetic:

```
User: "No, give me something else, I had Soya Chaap yesterday"
  → Load Epicure-Core embedding for "soya_chaap" → vec_rejected
  → Apply SLERP rotation: query_vec = SLERP(current_gap_vec, -vec_rejected, θ=30°)
  → Retrieve top-K neighbours of rotated query from canteen embedding space
  → Returns items that are nutritionally similar but culinarily distinct
```

This is fundamentally better than simple exclusion because it finds food that *fills the same gap* but tastes different.

#### B. Unknown Dish Decomposition (replaces Groq LLM estimation)

When Tavily returns a recipe description for an unknown dish:
1. Extract ingredient names from the text (e.g., "maida, paneer, cream, spices")
2. Map each to the nearest Epicure canonical ingredient using cosine similarity
3. Sum USDA macro values for matched canonical ingredients weighted by typical recipe proportions
4. This is more reliable than asking Groq to estimate macros from free text

#### C. "What pairs well with X?" Mess Companion Feature

Use Epicure-Core nearest-neighbour pairings to suggest canteen items that pair well with what the user just ate at mess:

```
User: "Had Rajma at mess lunch"
Bot: "Nice! Rajma pairs well with jeera rice (already in your lunch) and 
     a cold lassi from canteen would complement it perfectly — adds 8g 
     protein and fits your ₹120 remaining budget."
```

**Action item:** Star the Epicure GitHub repo (once released) and set a reminder to integrate when weights ship.

---

## 📊 Advanced Feature Roadmap

Features below are fully designed and should be implemented in future sprints after the Phase 1–4 core is stable.

---

### 1. Mess Menu Auto-Parser from Photo (Vision)

**Current state:** On Sundays the bot asks the user to upload a photo of next week's mess menu. It stores the photo but does NOT parse it — the weekly menu in `src/data/mess-menu.ts` is currently hardcoded.

**Proposed upgrade:** When a photo is uploaded on Sunday night, pass it to a vision-capable model:
- **API:** Groq `llava-v1.5-7b-4096-preview` (vision model, already on Groq) or Google Gemini Flash vision
- **Prompt:** "Extract this mess menu into JSON with keys: day, breakfast[], lunch[], dinner[]"
- **Output:** Overwrite `mess_menu` table in Neon with freshly parsed menu for the new week

**Files to change:** `src/bot/index.ts` (`message:photo` handler), `src/db/index.ts` (add `updateMessMenu(day, mealType, items)`)

**Data quality note:** The canteen data in `canteen-items.ts` is sourced from the official IITR Bhawan Canteen Rate List (Dean of Students' Welfare, Jan 2021). The macro estimates use ICMR-NIN IFCT 2017 as the reference. **Both datasets need a refresh** — prices change semester to semester and a new rate list should be uploaded as a PDF to `references/` for re-parsing.

---

### 2. Multi-Hostel Support

**Current state:** The bot is hardcoded to Rajiv Bhawan mess with a single weekly menu. The `UserProfile.hostel` field stores the hostel name but the data layer only has one mess schedule.

**Proposed upgrade:** Support multiple IITR hostels (Cautley, Ganga, Sarojini Naidu, Kasturba, etc.) each with their own weekly mess menus. The `loadMessSchedule(hostel)` function in `knowledge.ts` already accepts a `hostel` parameter but ignores it.

**Implementation:**
- Add a `hostel` column to `mess_menu` table
- Allow multiple weekly menus to coexist per hostel
- Sunday photo upload flow routes to the correct hostel's menu slot

---

### 3. Campus Canteen Price Refresh Webhook

**Current state:** Canteen prices in `canteen-items.ts` are from Jan 2021 and almost certainly outdated.

**Proposed upgrade:** Add an admin `/update_canteen` command (restricted to a hardcoded admin Telegram ID) that accepts a PDF/image of the new rate list and re-parses it into the `canteen_items` table — similar to the mess menu photo flow. This avoids having to redeploy code every time prices change.

---

### 4. Micronutrient & FSSAI Label Tracking

**Current state:** The bot only tracks macros (calories, protein, carbs, fats) and water. ICMR-NIN guidelines also cover micronutrients (iron, calcium, vitamin B12, zinc) which are critically deficient in vegetarian hostel diets.

**Proposed upgrade:** Extend `DailyLogEntry.items[].macros` to include:
```typescript
micros?: {
  iron?: number;     // mg
  calcium?: number;  // mg
  vitB12?: number;   // μg
  zinc?: number;     // mg
  vitD?: number;     // IU
}
```

Trigger an alert if the user's vegetarian diet is consistently low in B12 or iron over 3+ days. Data source: ICMR-NIN IFCT 2017 tables (publicly available as a PDF — can be parsed into a lookup table).

---

### 5. Smart Mess Skip Detection

**Current state:** The bot sends meal notifications and marks meals as logged only when the user explicitly confirms. It does not detect when a user consistently skips specific mess meals.

**Proposed upgrade:** After 3 days of a user never confirming a specific meal (e.g., always skipping mess breakfast), proactively ask: "I've noticed you haven't been eating mess breakfast all week — are you skipping it? I can adjust your daily targets to reflect this." Then recalculate the canteen suggestion budget for that meal slot.

---

### 6. Expense Analytics Dashboard (Telegram Web App)

**Current state:** Budget tracking is text-only via the `/budget` command.

**Proposed upgrade:** Build a mini Telegram Web App (TMA) that shows:
- Weekly spend bar chart (canteen vs mess vs vendor)
- Calorie heatmap by day of week
- Protein trend line vs target
- Top 5 most purchased canteen items

**Tech:** The project already has a `public/` directory and `src/tma/` folder suggesting TMA was previously planned. Use Chart.js + the existing Neon DB as the backend.

---

### 7. Group Hostel Mode (Social Nudges)

**Proposed feature:** Allow a group of friends from the same hostel to opt into a shared accountability group. The bot privately notifies individuals when the group's average protein target is being met — creating gentle social pressure without exposing individual data.

**Privacy note:** Only aggregated group stats are ever shared. Individual logs remain private. This aligns with the "Private by Default" guardrail in the spec.

---

### 8. Lab / Gym Session Integration

**Current state:** Exercise logging is purely manual (user tells the bot what they did).

**Proposed upgrade:** IIT Roorkee's gym has fixed session slots. Add a timetable integration where the user can pre-declare "I go to gym on Mon/Wed/Fri 6–7pm" and the bot automatically:
- Pre-logs an expected exercise event at that time
- Sends a post-workout protein reminder ("Your gym session just ended — have you eaten? You need ~40g protein in the next 30 min for recovery")
- Increases the daily protein target by 15% on gym days

---

### 9. Epicure-Powered Cross-Cuisine Substitution Engine

*(Dependent on Epicure weights — see section above)*

When a user is vegetarian but the mess is serving a non-veg special (e.g., Chicken Biryani on Sunday), use Epicure SLERP to find the most nutritionally and culinarily equivalent vegetarian option from the canteen:

```
Mess: "Paneer Lababdar / Chicken Biryani"
User: vegetarian
  → SLERP("chicken_biryani", South-Asian-veg direction, θ=45°)
  → Returns: paneer_biryani, veg_pulao, rajma_rice
  → Cross-references canteen list → suggests "Paratha with Chole/Rajma (₹35)"
```

---

*Last updated: 2026-06-09*
*Sprint reference: Phase 1–4 (core feature build)*
