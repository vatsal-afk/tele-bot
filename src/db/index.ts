import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

export type BotState =
  | 'IDLE' | 'ONBOARDING' | 'DASHBOARD' | 'AWAITING_MEAL_CONFIRM'
  | 'COACH_MODE' | 'WAITING_SUGGESTION_REJECTION' | 'EXERCISE_LOG'
  | 'WATER_LOG' | 'EXPENSE_SUMMARY' | 'WEEKLY_REFLECTION' | 'SETTINGS' | 'OFFLINE_FALLBACK';

export interface UserProfile {
  odid: string; createdAt: number; age: number; height: number; weight: number;
  sex: 'male' | 'female'; activityLevel: number;
  dietType: 'vegetarian' | 'eggetarian' | 'non-vegetarian';
  hostel: string; messZone: string;
  fitnessGoal: 'weight-loss' | 'muscle-gain' | 'maintenance';
  dailyBudget: number; weeklyBudget: number; campusZone: string;
  notifications: { breakfast: string; lunch: string; dinner: string; customReminders: any[]; lastNotified?: { breakfast?: string; lunch?: string; dinner?: string; weeklyMenuRequest?: string } };
  targets: { calories: number; protein: number; carbs: number; fats: number; waterMl: number };
  isOnboarded: boolean;
}

export interface DailyLogEntry {
  id: string; odid: string; date: string;
  eventType: 'meal' | 'exercise' | 'water';
  mealType?: string; source?: string;
  items?: Array<{ name: string; quantity: number; macros: { calories: number; protein: number; carbs: number; fats: number } }>;
  exerciseType?: string; duration?: number; sets?: number; reps?: number;
  caloriesBurned?: number; waterMl?: number; timestamp: number;
  isConfirmed: boolean; isMissed: boolean; cost?: number;
}

export interface SessionState {
  sessionId: string; odid: string; startedAt: number; currentState: BotState;
  currentGap: { calories: number; protein: number; carbs: number; fats: number };
  constraintStack: Array<{ type: string; value: any }>;
  suggestions: Array<any>; budgetRemaining: number;
}

export interface CanteenItem {
  id: string; name: string; category: string;
  baseMacros: { calories: number; protein: number; carbs: number; fats: number };
  adjustedMacros: { calories: number; protein: number; carbs: number; fats: number };
  price: number; isVeg: boolean; temperature?: string;
}

export interface MessMenuItem {
  id: string; dayOfWeek: number; mealType: string; items: string[];
  estimatedMacros: { calories: number; protein: number; carbs: number; fats: number };
}

export interface VendorItem {
  id: string; name: string; location: string; category: string;
  macros: { calories: number; protein: number; carbs: number; fats: number };
  priceRange: { min: number; max: number }; isVeg: boolean; temperature?: string;
}

let dbInitialized = false;

export async function initDB(): Promise<void> {
  if (dbInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS user_profile (
      odid TEXT PRIMARY KEY, createdat BIGINT, age INTEGER, height INTEGER, weight INTEGER,
      sex TEXT, activitylevel REAL, diettype TEXT, hostel TEXT, messzone TEXT,
      fitnessgoal TEXT, dailybudget INTEGER, weeklybudget INTEGER, campuszone TEXT,
      notifications TEXT, targets TEXT, isonboarded INTEGER DEFAULT 0
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS daily_log (
      id TEXT PRIMARY KEY, odid TEXT, date TEXT, eventtype TEXT, mealtype TEXT,
      source TEXT, items TEXT, exercisetype TEXT, duration INTEGER, sets INTEGER,
      reps INTEGER, caloriesburned INTEGER, waterml INTEGER, timestamp BIGINT,
      isconfirmed INTEGER, ismissed INTEGER, cost INTEGER
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS canteen_items (
      id TEXT PRIMARY KEY, name TEXT, category TEXT, basemacros TEXT,
      adjustedmacros TEXT, price INTEGER, isveg INTEGER, temperature TEXT
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS mess_menu (
      id TEXT PRIMARY KEY, dayofweek INTEGER, mealtype TEXT, items TEXT, estimatedmacros TEXT
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS vendor_items (
      id TEXT PRIMARY KEY, name TEXT, location TEXT, category TEXT, macros TEXT,
      pricerange TEXT, isveg INTEGER, temperature TEXT
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS session_history (
      odid TEXT PRIMARY KEY, messages TEXT NOT NULL DEFAULT '[]', updatedat BIGINT
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS onboarding_state (
      odid TEXT PRIMARY KEY, step INTEGER, data TEXT
    )`;
  dbInitialized = true;
}

// ── User Profile ──────────────────────────────────────────────────────────────

export async function getUserProfile(odid: string): Promise<UserProfile | undefined> {
  const rows = await sql`SELECT * FROM user_profile WHERE odid = ${odid}`;
  if (!rows[0]) return undefined;
  const r = rows[0];
  return {
    odid: r.odid, createdAt: Number(r.createdat), age: r.age, height: r.height,
    weight: r.weight, sex: r.sex, activityLevel: r.activitylevel, dietType: r.diettype,
    hostel: r.hostel, messZone: r.messzone, fitnessGoal: r.fitnessgoal,
    dailyBudget: r.dailybudget, weeklyBudget: r.weeklybudget, campusZone: r.campuszone,
    notifications: JSON.parse(r.notifications || '{}'),
    targets: JSON.parse(r.targets || '{}'),
    isOnboarded: Boolean(r.isonboarded),
  };
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const rows = await sql`SELECT * FROM user_profile`;
  return rows.map(r => ({
    odid: r.odid, createdAt: Number(r.createdat), age: r.age, height: r.height,
    weight: r.weight, sex: r.sex, activityLevel: r.activitylevel, dietType: r.diettype,
    hostel: r.hostel, messZone: r.messzone, fitnessGoal: r.fitnessgoal,
    dailyBudget: r.dailybudget, weeklyBudget: r.weeklybudget, campusZone: r.campuszone,
    notifications: JSON.parse(r.notifications || '{}'),
    targets: JSON.parse(r.targets || '{}'),
    isOnboarded: Boolean(r.isonboarded),
  }));
}

export async function saveUserProfile(p: UserProfile): Promise<void> {
  const n = JSON.stringify(p.notifications);
  const t = JSON.stringify(p.targets);
  await sql`
    INSERT INTO user_profile (odid, createdat, age, height, weight, sex, activitylevel,
      diettype, hostel, messzone, fitnessgoal, dailybudget, weeklybudget, campuszone,
      notifications, targets, isonboarded)
    VALUES (${p.odid}, ${p.createdAt}, ${p.age}, ${p.height}, ${p.weight}, ${p.sex},
      ${p.activityLevel}, ${p.dietType}, ${p.hostel}, ${p.messZone}, ${p.fitnessGoal},
      ${p.dailyBudget}, ${p.weeklyBudget}, ${p.campusZone}, ${n}, ${t},
      ${p.isOnboarded ? 1 : 0})
    ON CONFLICT (odid) DO UPDATE SET
      createdat = EXCLUDED.createdat, age = EXCLUDED.age, height = EXCLUDED.height,
      weight = EXCLUDED.weight, sex = EXCLUDED.sex, activitylevel = EXCLUDED.activitylevel,
      diettype = EXCLUDED.diettype, hostel = EXCLUDED.hostel, messzone = EXCLUDED.messzone,
      fitnessgoal = EXCLUDED.fitnessgoal, dailybudget = EXCLUDED.dailybudget,
      weeklybudget = EXCLUDED.weeklybudget, campuszone = EXCLUDED.campuszone,
      notifications = EXCLUDED.notifications, targets = EXCLUDED.targets,
      isonboarded = EXCLUDED.isonboarded`;
}

// ── Daily Log ─────────────────────────────────────────────────────────────────

export async function getDailyLog(odid: string, date: string): Promise<DailyLogEntry[]> {
  const rows = await sql`SELECT * FROM daily_log WHERE odid = ${odid} AND date = ${date}`;
  return rows.map(r => ({
    id: r.id, odid: r.odid, date: r.date, eventType: r.eventtype,
    mealType: r.mealtype, source: r.source,
    items: r.items ? JSON.parse(r.items) : undefined,
    exerciseType: r.exercisetype, duration: r.duration, sets: r.sets, reps: r.reps,
    caloriesBurned: r.caloriesburned, waterMl: r.waterml,
    timestamp: Number(r.timestamp), isConfirmed: Boolean(r.isconfirmed),
    isMissed: Boolean(r.ismissed), cost: r.cost,
  }));
}

export async function addDailyLogEntry(e: DailyLogEntry): Promise<void> {
  const items = e.items ? JSON.stringify(e.items) : null;
  await sql`
    INSERT INTO daily_log (id, odid, date, eventtype, mealtype, source, items,
      exercisetype, duration, sets, reps, caloriesburned, waterml, timestamp,
      isconfirmed, ismissed, cost)
    VALUES (${e.id}, ${e.odid}, ${e.date}, ${e.eventType}, ${e.mealType ?? null},
      ${e.source ?? null}, ${items}, ${e.exerciseType ?? null}, ${e.duration ?? null},
      ${e.sets ?? null}, ${e.reps ?? null}, ${e.caloriesBurned ?? null},
      ${e.waterMl ?? null}, ${e.timestamp}, ${e.isConfirmed ? 1 : 0},
      ${e.isMissed ? 1 : 0}, ${e.cost ?? null})
    ON CONFLICT (id) DO UPDATE SET
      items = EXCLUDED.items, mealtype = EXCLUDED.mealtype, source = EXCLUDED.source,
      exercisetype = EXCLUDED.exercisetype, duration = EXCLUDED.duration,
      sets = EXCLUDED.sets, reps = EXCLUDED.reps, caloriesburned = EXCLUDED.caloriesburned,
      waterml = EXCLUDED.waterml, timestamp = EXCLUDED.timestamp,
      isconfirmed = EXCLUDED.isconfirmed, ismissed = EXCLUDED.ismissed,
      cost = EXCLUDED.cost`;
}

// ── Session State ─────────────────────────────────────────────────────────────

export async function getSessionState(odid: string): Promise<SessionState | undefined> {
  const rows = await sql`SELECT * FROM session_history WHERE odid = ${odid}`;
  return undefined; // kept for interface compatibility
}

export async function saveSessionState(state: SessionState): Promise<void> {
  // kept for interface compatibility
}

// ── Session History (for LLM context) ────────────────────────────────────────

export async function getSessionHistory(odid: string): Promise<{ role: string; content: string }[]> {
  const rows = await sql`SELECT messages FROM session_history WHERE odid = ${odid}`;
  if (!rows[0]) return [];
  return JSON.parse(rows[0].messages || '[]');
}

export async function saveSessionHistory(odid: string, messages: { role: string; content: string }[]): Promise<void> {
  const m = JSON.stringify(messages);
  await sql`
    INSERT INTO session_history (odid, messages, updatedat)
    VALUES (${odid}, ${m}, ${Date.now()})
    ON CONFLICT (odid) DO UPDATE SET messages = EXCLUDED.messages, updatedat = EXCLUDED.updatedat`;
}

// ── Onboarding State ──────────────────────────────────────────────────────────

export async function getOnboardingState(odid: string): Promise<{ step: number; data: any } | null> {
  const rows = await sql`SELECT * FROM onboarding_state WHERE odid = ${odid}`;
  if (!rows[0]) return null;
  return { step: rows[0].step, data: JSON.parse(rows[0].data || '{}') };
}

export async function saveOnboardingState(odid: string, state: { step: number; data: any }): Promise<void> {
  const d = JSON.stringify(state.data);
  await sql`
    INSERT INTO onboarding_state (odid, step, data) VALUES (${odid}, ${state.step}, ${d})
    ON CONFLICT (odid) DO UPDATE SET step = EXCLUDED.step, data = EXCLUDED.data`;
}

export async function deleteOnboardingState(odid: string): Promise<void> {
  await sql`DELETE FROM onboarding_state WHERE odid = ${odid}`;
}

// ── Canteen Items ─────────────────────────────────────────────────────────────

export async function getCanteenItems(): Promise<CanteenItem[]> {
  const rows = await sql`SELECT * FROM canteen_items`;
  return rows.map(r => ({
    id: r.id, name: r.name, category: r.category,
    baseMacros: JSON.parse(r.basemacros),
    adjustedMacros: JSON.parse(r.adjustedmacros),
    price: r.price, isVeg: Boolean(r.isveg), temperature: r.temperature,
  }));
}

export async function saveCanteenItems(items: CanteenItem[]): Promise<void> {
  for (const item of items) {
    const bm = JSON.stringify(item.baseMacros);
    const am = JSON.stringify(item.adjustedMacros);
    await sql`
      INSERT INTO canteen_items (id, name, category, basemacros, adjustedmacros, price, isveg, temperature)
      VALUES (${item.id}, ${item.name}, ${item.category}, ${bm}, ${am},
        ${item.price}, ${item.isVeg ? 1 : 0}, ${item.temperature ?? null})
      ON CONFLICT (id) DO NOTHING`;
  }
}

// ── Mess Menu ─────────────────────────────────────────────────────────────────

export async function getMessMenu(dayOfWeek: number): Promise<MessMenuItem[]> {
  const rows = await sql`SELECT * FROM mess_menu WHERE dayofweek = ${dayOfWeek}`;
  return rows.map(r => ({
    id: r.id, dayOfWeek: r.dayofweek, mealType: r.mealtype,
    items: JSON.parse(r.items), estimatedMacros: JSON.parse(r.estimatedmacros),
  }));
}

export async function saveMessMenu(items: MessMenuItem[]): Promise<void> {
  for (const item of items) {
    const it = JSON.stringify(item.items);
    const em = JSON.stringify(item.estimatedMacros);
    await sql`
      INSERT INTO mess_menu (id, dayofweek, mealtype, items, estimatedmacros)
      VALUES (${item.id}, ${item.dayOfWeek}, ${item.mealType}, ${it}, ${em})
      ON CONFLICT (id) DO NOTHING`;
  }
}

// ── Vendor Items ──────────────────────────────────────────────────────────────

export async function saveVendorItems(items: VendorItem[]): Promise<void> {
  for (const item of items) {
    const m = JSON.stringify(item.macros);
    const pr = JSON.stringify(item.priceRange);
    await sql`
      INSERT INTO vendor_items (id, name, location, category, macros, pricerange, isveg, temperature)
      VALUES (${item.id}, ${item.name}, ${item.location}, ${item.category}, ${m}, ${pr},
        ${item.isVeg ? 1 : 0}, ${item.temperature ?? null})
      ON CONFLICT (id) DO NOTHING`;
  }
}