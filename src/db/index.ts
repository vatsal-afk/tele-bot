import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import dotenv from 'dotenv';
import * as schema from './schema.js';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

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
  notifications: { breakfast: string; lunch: string; dinner: string; customReminders: any[]; lastNotified?: { breakfast?: string; lunch?: string; dinner?: string; weeklyMenuRequest?: string }; lastHydrationNudge?: string };
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
  // With Drizzle ORM, schema is managed via `drizzle-kit push`
  // We simply mark it as initialized for backwards compatibility in index.ts
  dbInitialized = true;
}

// ── User Profile ──────────────────────────────────────────────────────────────

export async function getUserProfile(odid: string): Promise<UserProfile | undefined> {
  const rows = await db.select().from(schema.userProfileTable).where(eq(schema.userProfileTable.odid, odid));
  if (rows.length === 0) return undefined;
  const r = rows[0];
  return {
    odid: r.odid, createdAt: Number(r.createdAt), age: r.age!, height: r.height!,
    weight: r.weight!, sex: r.sex as any, activityLevel: r.activityLevel!, dietType: r.dietType as any,
    hostel: r.hostel!, messZone: r.messZone!, fitnessGoal: r.fitnessGoal as any,
    dailyBudget: r.dailyBudget!, weeklyBudget: r.weeklyBudget!, campusZone: r.campusZone!,
    notifications: JSON.parse(r.notifications || '{}'),
    targets: JSON.parse(r.targets || '{}'),
    isOnboarded: Boolean(r.isOnboarded),
  };
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const rows = await db.select().from(schema.userProfileTable);
  return rows.map(r => ({
    odid: r.odid, createdAt: Number(r.createdAt), age: r.age!, height: r.height!,
    weight: r.weight!, sex: r.sex as any, activityLevel: r.activityLevel!, dietType: r.dietType as any,
    hostel: r.hostel!, messZone: r.messZone!, fitnessGoal: r.fitnessGoal as any,
    dailyBudget: r.dailyBudget!, weeklyBudget: r.weeklyBudget!, campusZone: r.campusZone!,
    notifications: JSON.parse(r.notifications || '{}'),
    targets: JSON.parse(r.targets || '{}'),
    isOnboarded: Boolean(r.isOnboarded),
  }));
}

export async function saveUserProfile(p: UserProfile): Promise<void> {
  const n = JSON.stringify(p.notifications);
  const t = JSON.stringify(p.targets);
  await db.insert(schema.userProfileTable).values({
    odid: p.odid, createdAt: p.createdAt, age: p.age, height: p.height, weight: p.weight,
    sex: p.sex, activityLevel: p.activityLevel, dietType: p.dietType, hostel: p.hostel,
    messZone: p.messZone, fitnessGoal: p.fitnessGoal, dailyBudget: p.dailyBudget,
    weeklyBudget: p.weeklyBudget, campusZone: p.campusZone, notifications: n, targets: t,
    isOnboarded: p.isOnboarded ? 1 : 0
  }).onConflictDoUpdate({
    target: schema.userProfileTable.odid,
    set: {
      createdAt: p.createdAt, age: p.age, height: p.height, weight: p.weight,
      sex: p.sex, activityLevel: p.activityLevel, dietType: p.dietType, hostel: p.hostel,
      messZone: p.messZone, fitnessGoal: p.fitnessGoal, dailyBudget: p.dailyBudget,
      weeklyBudget: p.weeklyBudget, campusZone: p.campusZone, notifications: n, targets: t,
      isOnboarded: p.isOnboarded ? 1 : 0
    }
  });
}

// ── Daily Log ─────────────────────────────────────────────────────────────────

export async function getDailyLog(odid: string, date: string): Promise<DailyLogEntry[]> {
  const rows = await db.select().from(schema.dailyLogTable).where(
    and(eq(schema.dailyLogTable.odid, odid), eq(schema.dailyLogTable.date, date))
  );
  return rows.map(r => ({
    id: r.id, odid: r.odid!, date: r.date!, eventType: r.eventType as any,
    mealType: r.mealType || undefined, source: r.source || undefined,
    items: r.items ? JSON.parse(r.items) : undefined,
    exerciseType: r.exerciseType || undefined, duration: r.duration || undefined, sets: r.sets || undefined, reps: r.reps || undefined,
    caloriesBurned: r.caloriesBurned || undefined, waterMl: r.waterMl || undefined,
    timestamp: Number(r.timestamp), isConfirmed: Boolean(r.isConfirmed),
    isMissed: Boolean(r.isMissed), cost: r.cost || undefined,
  }));
}

export async function addDailyLogEntry(e: DailyLogEntry): Promise<void> {
  const items = e.items ? JSON.stringify(e.items) : null;
  await db.insert(schema.dailyLogTable).values({
    id: e.id, odid: e.odid, date: e.date, eventType: e.eventType,
    mealType: e.mealType || null, source: e.source || null, items,
    exerciseType: e.exerciseType || null, duration: e.duration || null,
    sets: e.sets || null, reps: e.reps || null, caloriesBurned: e.caloriesBurned || null,
    waterMl: e.waterMl || null, timestamp: e.timestamp,
    isConfirmed: e.isConfirmed ? 1 : 0, isMissed: e.isMissed ? 1 : 0, cost: e.cost || null
  }).onConflictDoUpdate({
    target: schema.dailyLogTable.id,
    set: {
      items, mealType: e.mealType || null, source: e.source || null,
      exerciseType: e.exerciseType || null, duration: e.duration || null,
      sets: e.sets || null, reps: e.reps || null, caloriesBurned: e.caloriesBurned || null,
      waterMl: e.waterMl || null, timestamp: e.timestamp,
      isConfirmed: e.isConfirmed ? 1 : 0, isMissed: e.isMissed ? 1 : 0, cost: e.cost || null
    }
  });
}

// ── Session State ─────────────────────────────────────────────────────────────

export async function getSessionState(odid: string): Promise<SessionState | undefined> {
  return undefined; // kept for interface compatibility
}

export async function saveSessionState(state: SessionState): Promise<void> {
  // kept for interface compatibility
}

// ── Session History (for LLM context) ────────────────────────────────────────

export async function getSessionHistory(odid: string): Promise<{ role: string; content: string }[]> {
  const rows = await db.select().from(schema.sessionHistoryTable).where(eq(schema.sessionHistoryTable.odid, odid));
  if (rows.length === 0) return [];
  return JSON.parse(rows[0].messages || '[]');
}

export async function saveSessionHistory(odid: string, messages: { role: string; content: string }[]): Promise<void> {
  const m = JSON.stringify(messages);
  await db.insert(schema.sessionHistoryTable).values({
    odid, messages: m, updatedAt: Date.now()
  }).onConflictDoUpdate({
    target: schema.sessionHistoryTable.odid,
    set: { messages: m, updatedAt: Date.now() }
  });
}

// ── Onboarding State ──────────────────────────────────────────────────────────

export async function getOnboardingState(odid: string): Promise<{ step: number; data: any } | null> {
  const rows = await db.select().from(schema.onboardingStateTable).where(eq(schema.onboardingStateTable.odid, odid));
  if (rows.length === 0) return null;
  return { step: rows[0].step!, data: JSON.parse(rows[0].data || '{}') };
}

export async function saveOnboardingState(odid: string, state: { step: number; data: any }): Promise<void> {
  const d = JSON.stringify(state.data);
  await db.insert(schema.onboardingStateTable).values({
    odid, step: state.step, data: d
  }).onConflictDoUpdate({
    target: schema.onboardingStateTable.odid,
    set: { step: state.step, data: d }
  });
}

export async function deleteOnboardingState(odid: string): Promise<void> {
  await db.delete(schema.onboardingStateTable).where(eq(schema.onboardingStateTable.odid, odid));
}

// ── Canteen Items ─────────────────────────────────────────────────────────────

export async function getCanteenItems(): Promise<CanteenItem[]> {
  const rows = await db.select().from(schema.canteenItemsTable);
  return rows.map(r => ({
    id: r.id, name: r.name!, category: r.category!,
    baseMacros: JSON.parse(r.baseMacros || '{}'),
    adjustedMacros: JSON.parse(r.adjustedMacros || '{}'),
    price: r.price!, isVeg: Boolean(r.isVeg), temperature: r.temperature || undefined,
  }));
}

export async function saveCanteenItems(items: CanteenItem[]): Promise<void> {
  for (const item of items) {
    const bm = JSON.stringify(item.baseMacros);
    const am = JSON.stringify(item.adjustedMacros);
    await db.insert(schema.canteenItemsTable).values({
      id: item.id, name: item.name, category: item.category,
      baseMacros: bm, adjustedMacros: am, price: item.price,
      isVeg: item.isVeg ? 1 : 0, temperature: item.temperature || null
    }).onConflictDoNothing({ target: schema.canteenItemsTable.id });
  }
}

// ── Mess Menu ─────────────────────────────────────────────────────────────────

export async function getMessMenu(dayOfWeek: number): Promise<MessMenuItem[]> {
  const rows = await db.select().from(schema.messMenuTable).where(eq(schema.messMenuTable.dayOfWeek, dayOfWeek));
  return rows.map(r => ({
    id: r.id, dayOfWeek: r.dayOfWeek!, mealType: r.mealType!,
    items: JSON.parse(r.items || '[]'), estimatedMacros: JSON.parse(r.estimatedMacros || '{}'),
  }));
}

export async function saveMessMenu(items: MessMenuItem[]): Promise<void> {
  for (const item of items) {
    const it = JSON.stringify(item.items);
    const em = JSON.stringify(item.estimatedMacros);
    await db.insert(schema.messMenuTable).values({
      id: item.id, dayOfWeek: item.dayOfWeek, mealType: item.mealType,
      items: it, estimatedMacros: em
    }).onConflictDoUpdate({
      target: schema.messMenuTable.id,
      set: { dayOfWeek: item.dayOfWeek, mealType: item.mealType, items: it, estimatedMacros: em }
    });
  }
}

// ── Vendor Items ──────────────────────────────────────────────────────────────

export async function saveVendorItems(items: VendorItem[]): Promise<void> {
  for (const item of items) {
    const m = JSON.stringify(item.macros);
    const pr = JSON.stringify(item.priceRange);
    await db.insert(schema.vendorItemsTable).values({
      id: item.id, name: item.name, location: item.location, category: item.category,
      macros: m, priceRange: pr, isVeg: item.isVeg ? 1 : 0, temperature: item.temperature || null
    }).onConflictDoNothing({ target: schema.vendorItemsTable.id });
  }
}

// ── Custom Food Cache ─────────────────────────────────────────────────────────

export interface CachedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  source: 'web_search' | 'brand_openfoodfacts' | 'brand_llm_estimate' | 'user_input';
  createdAt: number;
}

export async function getCachedFood(name: string): Promise<CachedFood | null> {
  const lower = name.toLowerCase().trim();
  const rows = await db.select().from(schema.customFoodCacheTable).where(eq(schema.customFoodCacheTable.name, lower));
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    name: r.name, calories: r.calories, protein: r.protein, carbs: r.carbs,
    fats: r.fats, source: r.source as any, createdAt: Number(r.createdAt),
  };
}

export async function saveCachedFood(entry: CachedFood): Promise<void> {
  const lower = entry.name.toLowerCase().trim();
  await db.insert(schema.customFoodCacheTable).values({
    name: lower, calories: entry.calories, protein: entry.protein, carbs: entry.carbs,
    fats: entry.fats, source: entry.source, createdAt: entry.createdAt
  }).onConflictDoUpdate({
    target: schema.customFoodCacheTable.name,
    set: {
      calories: entry.calories, protein: entry.protein, carbs: entry.carbs,
      fats: entry.fats, source: entry.source, createdAt: entry.createdAt
    }
  });
}

// ── Daily Rejections ──────────────────────────────────────────────────────────

export async function getRejectedItems(odid: string, date: string): Promise<string[]> {
  const rows = await db.select({ itemName: schema.dailyRejectionsTable.itemName })
    .from(schema.dailyRejectionsTable)
    .where(and(eq(schema.dailyRejectionsTable.odid, odid), eq(schema.dailyRejectionsTable.date, date)));
  return rows.map(r => r.itemName);
}

export async function addRejection(
  odid: string,
  date: string,
  itemName: string,
  reason?: string
): Promise<void> {
  await db.insert(schema.dailyRejectionsTable).values({
    odid, date, itemName: itemName.toLowerCase(), reason: reason || null, rejectedAt: Date.now()
  }).onConflictDoNothing({
    target: [schema.dailyRejectionsTable.odid, schema.dailyRejectionsTable.date, schema.dailyRejectionsTable.itemName]
  });
}

// ── Timetable ─────────────────────────────────────────────────────────────────

export interface TimetableSlot {
  dayOfWeek: number; // 0=Mon, 1=Tue, ..., 6=Sun
  startTime: string; // "HH:MM" 24h
  endTime: string;
  location: string;
  description: string;
}

export async function getTimetable(odid: string): Promise<TimetableSlot[]> {
  const rows = await db.select().from(schema.timetableTable).where(eq(schema.timetableTable.odid, odid));
  return rows.map(r => ({
    dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime,
    location: r.location, description: r.description,
  })).sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startTime.localeCompare(b.startTime);
  });
}

export async function saveTimetableSlot(odid: string, slot: TimetableSlot): Promise<void> {
  await db.insert(schema.timetableTable).values({
    odid, dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime,
    location: slot.location, description: slot.description
  }).onConflictDoUpdate({
    target: [schema.timetableTable.odid, schema.timetableTable.dayOfWeek, schema.timetableTable.startTime],
    set: { endTime: slot.endTime, location: slot.location, description: slot.description }
  });
}

export async function clearTimetable(odid: string): Promise<void> {
  await db.delete(schema.timetableTable).where(eq(schema.timetableTable.odid, odid));
}