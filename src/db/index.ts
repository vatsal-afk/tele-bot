import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export type BotState = 
  | 'IDLE'
  | 'ONBOARDING'
  | 'DASHBOARD'
  | 'AWAITING_MEAL_CONFIRM'
  | 'COACH_MODE'
  | 'WAITING_SUGGESTION_REJECTION'
  | 'EXERCISE_LOG'
  | 'WATER_LOG'
  | 'EXPENSE_SUMMARY'
  | 'WEEKLY_REFLECTION'
  | 'SETTINGS'
  | 'OFFLINE_FALLBACK';

export interface UserProfile {
  odid: string;
  createdAt: number;
  age: number;
  height: number;
  weight: number;
  sex: 'male' | 'female';
  activityLevel: number;
  dietType: 'vegetarian' | 'eggetarian' | 'non-vegetarian';
  hostel: string;
  messZone: string;
  fitnessGoal: 'weight-loss' | 'muscle-gain' | 'maintenance';
  dailyBudget: number;
  weeklyBudget: number;
  campusZone: string;
  notifications: { breakfast: string; lunch: string; dinner: string; customReminders: any[]; lastNotified?: { breakfast?: string; lunch?: string; dinner?: string; weeklyMenuRequest?: string } };
  targets: { calories: number; protein: number; carbs: number; fats: number; waterMl: number };
  isOnboarded: boolean;
}

export interface DailyLogEntry {
  id: string;
  odid: string;
  date: string;
  eventType: 'meal' | 'exercise' | 'water';
  mealType?: string;
  source?: string;
  items?: Array<{ name: string; quantity: number; macros: { calories: number; protein: number; carbs: number; fats: number } }>;
  exerciseType?: string;
  duration?: number;
  sets?: number;
  reps?: number;
  caloriesBurned?: number;
  waterMl?: number;
  timestamp: number;
  isConfirmed: boolean;
  isMissed: boolean;
  cost?: number;
}

export interface SessionState {
  sessionId: string;
  odid: string;
  startedAt: number;
  currentState: BotState;
  currentGap: { calories: number; protein: number; carbs: number; fats: number };
  constraintStack: Array<{ type: string; value: any }>;
  suggestions: Array<any>;
  budgetRemaining: number;
}

export interface CanteenItem {
  id: string;
  name: string;
  category: string;
  baseMacros: { calories: number; protein: number; carbs: number; fats: number };
  adjustedMacros: { calories: number; protein: number; carbs: number; fats: number };
  price: number;
  isVeg: boolean;
  temperature?: string;
}

export interface MessMenuItem {
  id: string;
  dayOfWeek: number;
  mealType: string;
  items: string[];
  estimatedMacros: { calories: number; protein: number; carbs: number; fats: number };
}

export interface VendorItem {
  id: string;
  name: string;
  location: string;
  category: string;
  macros: { calories: number; protein: number; carbs: number; fats: number };
  priceRange: { min: number; max: number };
  isVeg: boolean;
  temperature?: string;
}

export async function initDB(): Promise<Database.Database> {
  if (db) return db;
  
  const dbPath = path.resolve('./data.db');
  db = new Database(dbPath);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      odid TEXT PRIMARY KEY,
      createdAt INTEGER,
      age INTEGER,
      height INTEGER,
      weight INTEGER,
      sex TEXT,
      activityLevel REAL,
      dietType TEXT,
      hostel TEXT,
      messZone TEXT,
      fitnessGoal TEXT,
      dailyBudget INTEGER,
      weeklyBudget INTEGER,
      campusZone TEXT,
      notifications TEXT,
      targets TEXT,
      isOnboarded INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_log (
      id TEXT PRIMARY KEY,
      odid TEXT,
      date TEXT,
      eventType TEXT,
      mealType TEXT,
      source TEXT,
      items TEXT,
      exerciseType TEXT,
      duration INTEGER,
      sets INTEGER,
      reps INTEGER,
      caloriesBurned INTEGER,
      waterMl INTEGER,
      timestamp INTEGER,
      isConfirmed INTEGER,
      isMissed INTEGER,
      cost INTEGER
    );

    CREATE TABLE IF NOT EXISTS session_state (
      sessionId TEXT PRIMARY KEY,
      odid TEXT,
      startedAt INTEGER,
      currentState TEXT,
      currentGap TEXT,
      constraintStack TEXT,
      suggestions TEXT,
      budgetRemaining INTEGER
    );

    CREATE TABLE IF NOT EXISTS canteen_items (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      baseMacros TEXT,
      adjustedMacros TEXT,
      price INTEGER,
      isVeg INTEGER,
      temperature TEXT
    );

    CREATE TABLE IF NOT EXISTS mess_menu (
      id TEXT PRIMARY KEY,
      dayOfWeek INTEGER,
      mealType TEXT,
      items TEXT,
      estimatedMacros TEXT
    );

    CREATE TABLE IF NOT EXISTS vendor_items (
      id TEXT PRIMARY KEY,
      name TEXT,
      location TEXT,
      category TEXT,
      macros TEXT,
      priceRange TEXT,
      isVeg INTEGER,
      temperature TEXT
    );
  `);
  
  return db;
}

export async function getUserProfile(odid: string): Promise<UserProfile | undefined> {
  const database = getDb();
  const row = database.prepare('SELECT * FROM user_profile WHERE odid = ?').get(odid) as any;
  if (!row) return undefined;
  
  return {
    ...row,
    notifications: JSON.parse(row.notifications || '{}'),
    targets: JSON.parse(row.targets || '{}'),
    isOnboarded: Boolean(row.isOnboarded),
  };
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM user_profile').all() as any[];
  return rows.map(row => ({
    ...row,
    notifications: JSON.parse(row.notifications || '{}'),
    targets: JSON.parse(row.targets || '{}'),
    isOnboarded: Boolean(row.isOnboarded),
  }));
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const database = getDb();
  const s = JSON.stringify(profile.notifications);
  const t = JSON.stringify(profile.targets);
  console.log('Saving profile.notifications length:', s.length, 'targets length:', t.length);
const stmt = database.prepare(`
    INSERT OR REPLACE INTO user_profile 
    (odid, createdAt, age, height, weight, sex, activityLevel, dietType, hostel, messZone, fitnessGoal, dailyBudget, weeklyBudget, campusZone, notifications, targets, isOnboarded)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const values = [
    profile.odid,
    profile.createdAt,
    profile.age,
    profile.height,
    profile.weight,
    profile.sex,
    profile.activityLevel,
    profile.dietType,
    profile.hostel,
    profile.messZone,
    profile.fitnessGoal,
    profile.dailyBudget,
    profile.weeklyBudget,
    profile.campusZone,
    s,
    t,
    profile.isOnboarded ? 1 : 0
  ];
  console.log('Values count:', values.length);
  const result = stmt.run(...values);
}

export async function getDailyLog(odid: string, date: string): Promise<DailyLogEntry[]> {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM daily_log WHERE odid = ? AND date = ?').all(odid, date) as any[];
  return rows.map(row => ({
    id: row.id,
    odid: row.odid,
    date: row.date,
    eventType: row.eventType,
    mealType: row.mealType,
    source: row.source,
    items: row.items ? JSON.parse(row.items) : undefined,
    exerciseType: row.exerciseType,
    duration: row.duration,
    sets: row.sets,
    reps: row.reps,
    caloriesBurned: row.caloriesBurned,
    waterMl: row.waterMl,
    timestamp: row.timestamp,
    isConfirmed: Boolean(row.isConfirmed),
    isMissed: Boolean(row.isMissed),
    cost: row.cost,
  }));
}

export async function addDailyLogEntry(entry: DailyLogEntry): Promise<void> {
  const database = getDb();
  database.prepare(`
    INSERT OR REPLACE INTO daily_log 
    (id, odid, date, eventType, mealType, source, items, exerciseType, duration, sets, reps, caloriesBurned, waterMl, timestamp, isConfirmed, isMissed, cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id,
    entry.odid,
    entry.date,
    entry.eventType,
    entry.mealType || null,
    entry.source || null,
    entry.items ? JSON.stringify(entry.items) : null,
    entry.exerciseType || null,
    entry.duration || null,
    entry.sets || null,
    entry.reps || null,
    entry.caloriesBurned || null,
    entry.waterMl || null,
    entry.timestamp,
    entry.isConfirmed ? 1 : 0,
    entry.isMissed ? 1 : 0,
    entry.cost || null
  );
}

export async function getSessionState(odid: string): Promise<SessionState | undefined> {
  const database = getDb();
  const row = database.prepare('SELECT * FROM session_state WHERE odid = ? ORDER BY startedAt DESC LIMIT 1').get(odid) as any;
  if (!row) return undefined;
  
  return {
    sessionId: row.sessionId,
    odid: row.odid,
    startedAt: row.startedAt,
    currentState: row.currentState as BotState,
    currentGap: JSON.parse(row.currentGap || '{}'),
    constraintStack: JSON.parse(row.constraintStack || '[]'),
    suggestions: JSON.parse(row.suggestions || '[]'),
    budgetRemaining: row.budgetRemaining,
  };
}

export async function saveSessionState(state: SessionState): Promise<void> {
  const database = getDb();
  database.prepare(`
    INSERT OR REPLACE INTO session_state 
    (sessionId, odid, startedAt, currentState, currentGap, constraintStack, suggestions, budgetRemaining)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    state.sessionId,
    state.odid,
    state.startedAt,
    state.currentState,
    JSON.stringify(state.currentGap),
    JSON.stringify(state.constraintStack),
    JSON.stringify(state.suggestions),
    state.budgetRemaining
  );
}

export async function getCanteenItems(): Promise<CanteenItem[]> {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM canteen_items').all() as any[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    baseMacros: JSON.parse(row.baseMacros),
    adjustedMacros: JSON.parse(row.adjustedMacros),
    price: row.price,
    isVeg: Boolean(row.isVeg),
    temperature: row.temperature,
  }));
}

export async function saveCanteenItems(items: CanteenItem[]): Promise<void> {
  const database = getDb();
  const insert = database.prepare(`
    INSERT OR REPLACE INTO canteen_items (id, name, category, baseMacros, adjustedMacros, price, isVeg, temperature)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const item of items) {
    insert.run(
      item.id,
      item.name,
      item.category,
      JSON.stringify(item.baseMacros),
      JSON.stringify(item.adjustedMacros),
      item.price,
      item.isVeg ? 1 : 0,
      item.temperature || null
    );
  }
}

export async function getMessMenu(dayOfWeek: number): Promise<MessMenuItem[]> {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM mess_menu WHERE dayOfWeek = ?').all(dayOfWeek) as any[];
  return rows.map(row => ({
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    mealType: row.mealType,
    items: JSON.parse(row.items),
    estimatedMacros: JSON.parse(row.estimatedMacros),
  }));
}

export async function saveMessMenu(items: MessMenuItem[]): Promise<void> {
  const database = getDb();
  const insert = database.prepare(`
    INSERT OR REPLACE INTO mess_menu (id, dayOfWeek, mealType, items, estimatedMacros)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  for (const item of items) {
    insert.run(
      item.id,
      item.dayOfWeek,
      item.mealType,
      JSON.stringify(item.items),
      JSON.stringify(item.estimatedMacros)
    );
  }
}

export async function getVendorItems(): Promise<VendorItem[]> {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM vendor_items').all() as any[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    location: row.location,
    category: row.category,
    macros: JSON.parse(row.macros),
    priceRange: JSON.parse(row.priceRange),
    isVeg: Boolean(row.isVeg),
    temperature: row.temperature,
  }));
}

export async function saveVendorItems(items: VendorItem[]): Promise<void> {
  const database = getDb();
  const insert = database.prepare(`
    INSERT OR REPLACE INTO vendor_items (id, name, location, category, macros, priceRange, isVeg, temperature)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const item of items) {
    insert.run(
      item.id,
      item.name,
      item.location,
      item.category,
      JSON.stringify(item.macros),
      JSON.stringify(item.priceRange),
      item.isVeg ? 1 : 0,
      item.temperature || null
    );
  }
}