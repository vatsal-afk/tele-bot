import { pgTable, text, integer, real, bigint, primaryKey } from 'drizzle-orm/pg-core';

export const userProfileTable = pgTable('user_profile', {
  odid: text('odid').primaryKey(),
  createdAt: bigint('createdat', { mode: 'number' }),
  age: integer('age'),
  height: integer('height'),
  weight: integer('weight'),
  sex: text('sex'),
  activityLevel: real('activitylevel'),
  dietType: text('diettype'),
  hostel: text('hostel'),
  messZone: text('messzone'),
  fitnessGoal: text('fitnessgoal'),
  dailyBudget: integer('dailybudget'),
  weeklyBudget: integer('weeklybudget'),
  campusZone: text('campuszone'),
  notifications: text('notifications'),
  targets: text('targets'),
  isOnboarded: integer('isonboarded').default(0),
});

export const dailyLogTable = pgTable('daily_log', {
  id: text('id').primaryKey(),
  odid: text('odid'),
  date: text('date'),
  eventType: text('eventtype'),
  mealType: text('mealtype'),
  source: text('source'),
  items: text('items'),
  exerciseType: text('exercisetype'),
  duration: integer('duration'),
  sets: integer('sets'),
  reps: integer('reps'),
  caloriesBurned: integer('caloriesburned'),
  waterMl: integer('waterml'),
  timestamp: bigint('timestamp', { mode: 'number' }),
  isConfirmed: integer('isconfirmed'),
  isMissed: integer('ismissed'),
  cost: integer('cost'),
});

export const canteenItemsTable = pgTable('canteen_items', {
  id: text('id').primaryKey(),
  name: text('name'),
  category: text('category'),
  baseMacros: text('basemacros'),
  adjustedMacros: text('adjustedmacros'),
  price: integer('price'),
  isVeg: integer('isveg'),
  temperature: text('temperature'),
});

export const messMenuTable = pgTable('mess_menu', {
  id: text('id').primaryKey(),
  dayOfWeek: integer('dayofweek'),
  mealType: text('mealtype'),
  items: text('items'),
  estimatedMacros: text('estimatedmacros'),
});

export const vendorItemsTable = pgTable('vendor_items', {
  id: text('id').primaryKey(),
  name: text('name'),
  location: text('location'),
  category: text('category'),
  macros: text('macros'),
  priceRange: text('pricerange'),
  isVeg: integer('isveg'),
  temperature: text('temperature'),
});

export const sessionHistoryTable = pgTable('session_history', {
  odid: text('odid').primaryKey(),
  messages: text('messages').notNull().default('[]'),
  updatedAt: bigint('updatedat', { mode: 'number' }),
});

export const onboardingStateTable = pgTable('onboarding_state', {
  odid: text('odid').primaryKey(),
  step: integer('step'),
  data: text('data'),
});

export const customFoodCacheTable = pgTable('custom_food_cache', {
  name: text('name').primaryKey(),
  calories: real('calories').notNull(),
  protein: real('protein').notNull(),
  carbs: real('carbs').notNull(),
  fats: real('fats').notNull(),
  source: text('source').notNull(),
  createdAt: bigint('createdat', { mode: 'number' }).notNull(),
});

export const dailyRejectionsTable = pgTable('daily_rejections', {
  odid: text('odid').notNull(),
  date: text('date').notNull(),
  itemName: text('item_name').notNull(),
  reason: text('reason'),
  rejectedAt: bigint('rejected_at', { mode: 'number' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.odid, table.date, table.itemName] })
}));

export const timetableTable = pgTable('timetable', {
  odid: text('odid').notNull(),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  location: text('location').notNull().default('Campus'),
  description: text('description').notNull().default('Class'),
}, (table) => ({
  pk: primaryKey({ columns: [table.odid, table.dayOfWeek, table.startTime] })
}));
