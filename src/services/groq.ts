import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// ── Intent types ──────────────────────────────────────────────
export interface ParsedIntent {
  intent: 'log_meal' | 'log_exercise' | 'log_water' | 'get_suggestion' | 'check_budget' | 'show_dashboard' | 'weekly_summary' | 'help' | 'general_chat' | 'complete_onboarding';
  
  // For log_meal
  mealType?: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
  foodItems?: string[];
  source?: 'mess' | 'canteen' | 'vendor' | 'unknown';
  cost?: number;
  estimatedMacros?: Record<string, { calories: number; protein: number; carbs: number; fats: number }>; // For unknown items
  
  // For log_exercise
  exerciseType?: string;
  duration?: number;
  sets?: number;
  reps?: number;
  
  // For log_water
  waterMl?: number;
  
  // For get_suggestion (including rejection handling)
  maxPrice?: number;
  temperature?: 'cold' | 'hot' | 'any';
  excludeCategories?: string[];
  rejectedItemName?: string;   // item the user is rejecting e.g. "Soya Chaap"
  rejectionReason?: string;    // "had_yesterday" | "dont_like" | "too_expensive"

  // For complete_onboarding
  onboardingProfile?: {
    age: number;
    height: number;
    weight: number;
    sex: 'male' | 'female';
    activityLevel: number; // 1.2 to 1.9
    dietType: 'vegetarian' | 'eggetarian' | 'non-vegetarian';
    fitnessGoal: 'weight-loss' | 'muscle-gain' | 'maintenance';
  };
  
  // Confidence score
  confidence: number;
}

// ── Health check ──────────────────────────────────────────────
export async function checkGroqHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// ── Intelligent intent router ─────────────────────────────────
export async function classifyIntent(
  userMessage: string,
  context: {
    gapSummary: string;
    budgetRemaining: number;
    todayMealsLogged: string[];
    currentTime: string;
    recentHistory?: { role: string; content: string }[];
  }
): Promise<ParsedIntent> {
    const systemPrompt = `You are an intent classifier for an IIT Roorkee hostel fitness-tracking Telegram bot.
The user is a student at Rajiv Bhawan hostel. The bot tracks meals (from mess, canteen, or vendors), exercise, water intake, budget, and handles user onboarding.

Current context:
- Nutritional gap: ${context.gapSummary}
- Budget remaining today: ₹${context.budgetRemaining}
- Meals logged today: ${context.todayMealsLogged.length > 0 ? context.todayMealsLogged.join(', ') : 'none'}
- Current time: ${context.currentTime}

Classify the user's message into EXACTLY ONE intent and extract relevant entities.

Intents:
- "complete_onboarding": User is providing their personal details to set up their profile. Extract: onboardingProfile object containing age, weight (kg), height (cm), sex (male/female), activityLevel (1.2 for sedentary, 1.375 light, 1.55 moderate, 1.725 very active), dietType (vegetarian/eggetarian/non-vegetarian), fitnessGoal (weight-loss/muscle-gain/maintenance).
- "log_meal": User is explicitly stating they ate or are currently eating specific food items (e.g., "I had 2 rotis", "log a burger"). CRITICAL: Do NOT use this if the user says they "want to eat" something or are asking what to eat. Only use it for factual past/present consumption. Extract: mealType (breakfast/lunch/snacks/dinner), foodItems (array of item names), source (mess/canteen/vendor/unknown), cost. If the user mentions food items that are not standard Indian/campus foods, provide an "estimatedMacros" object mapping the food item name to its estimated macros per serving { calories, protein, carbs, fats } based on ICMR-NIN/NICE standards.
- "log_exercise": User did or wants to log exercise. Extract: exerciseType, duration (minutes).
- "log_water": User drank water. Extract: waterMl.
- "get_suggestion": User is explicitly asking for food recommendations from the campus options (e.g., "what should I eat?", "suggest a snack under 50 rs"). Also use this when user REJECTS a previous suggestion (e.g., "no give me something else", "I had this yesterday", "don't want that"). Extract: maxPrice, temperature, excludeCategories. If rejecting, ALSO extract: rejectedItemName (exact item name from last suggestion if mentioned), rejectionReason (one of: "had_yesterday", "dont_like", "too_expensive", "not_available", "other").
- "check_budget": User asks about remaining budget.
- "show_dashboard": User wants to see today's progress.
- "weekly_summary": User asks for weekly report.
- "help": User asks what the bot can do.
- "general_chat": User is asking general health/fitness questions, making small talk, or asking general nutritional advice (e.g., "what packaged foods are healthy?", "why do I crave sweets?"). Use this for any conversational question that doesn't fit exactly into logging or campus suggestions.

Reply ONLY with valid JSON: { "intent": "...", ...entities, "confidence": 0.0-1.0 }`;

  try {
    const messages: any[] = [{ role: 'system', content: systemPrompt }];
    if (context.recentHistory) {
      messages.push(...context.recentHistory);
    }
    messages.push({ role: 'user', content: userMessage });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.05,
      max_tokens: 300,
    });

    const raw = completion.choices[0]?.message?.content || '';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return localFallbackClassify(userMessage);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        intent: parsed.intent || 'general_chat',
        mealType: parsed.mealType,
        foodItems: parsed.foodItems,
        source: parsed.source,
        estimatedMacros: parsed.estimatedMacros,
        exerciseType: parsed.exerciseType,
        duration: parsed.duration,
        sets: parsed.sets,
        reps: parsed.reps,
        waterMl: parsed.waterMl,
        maxPrice: parsed.maxPrice,
        temperature: parsed.temperature,
        excludeCategories: parsed.excludeCategories,
        cost: parsed.cost,
        onboardingProfile: parsed.onboardingProfile,
        rejectedItemName: parsed.rejectedItemName,
        rejectionReason: parsed.rejectionReason,
        confidence: parsed.confidence ?? 0.5,
      };
    } catch {
      return localFallbackClassify(userMessage);
    }
  } catch (error) {
    console.error('Groq classify error:', error);
    return localFallbackClassify(userMessage);
  }
}

import { CANTEEN_RAW } from '../data/canteen-items.js';
import { MESS_MEAL_MACROS } from '../data/mess-menu.js';
import { searchFoodRecipe } from './webSearch.js';

// ── Search + Groq synthesis for unknown dishes ─────────────────────────

/**
 * When a dish is not found in any local DB:
 * 1. Search Tavily for recipe/nutrition snippets
 * 2. Ask Groq to synthesise macros from snippets
 * 3. Return macros or null if unresolved
 */
export async function searchAndResolveFoodMacros(
  foodName: string
): Promise<{ calories: number; protein: number; carbs: number; fats: number } | null> {
  const snippets = await searchFoodRecipe(foodName);
  if (snippets.length === 0) return null;

  const prompt = `Estimate the macros per standard single serving for "${foodName}" based on these recipe/nutrition snippets:

${snippets.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}

Use ICMR-NIN Indian food standards. Reply ONLY with valid JSON:
{ "calories": number, "protein": number, "carbs": number, "fats": number, "confidence": 0.0-1.0 }
If you cannot confidently determine macros, return { "confidence": 0 }.`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 150,
    });

    const raw = completion.choices[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.calories || (parsed.confidence ?? 0) < 0.3) return null;

    console.log(`[groq] Resolved "${foodName}" via web search: ${parsed.calories} kcal, ${parsed.protein}g protein`);
    return {
      calories: Math.round(parsed.calories),
      protein: Math.round((parsed.protein || 0) * 10) / 10,
      carbs: Math.round((parsed.carbs || 0) * 10) / 10,
      fats: Math.round((parsed.fats || 0) * 10) / 10,
    };
  } catch {
    return null;
  }
}

// ── Indian food macro database (per standard serving) ─────────
export const INDIAN_FOOD_DB: Record<string, { calories: number; protein: number; carbs: number; fats: number }> = {
  // Breads
  'roti': { calories: 120, protein: 3, carbs: 20, fats: 3 },
  'chapati': { calories: 120, protein: 3, carbs: 20, fats: 3 },
  'naan': { calories: 260, protein: 8, carbs: 40, fats: 7 },
  'paratha': { calories: 260, protein: 5, carbs: 30, fats: 13 },
  'aloo paratha': { calories: 300, protein: 6, carbs: 38, fats: 14 },
  'gobhi paratha': { calories: 280, protein: 6, carbs: 35, fats: 13 },
  'paneer paratha': { calories: 340, protein: 12, carbs: 35, fats: 16 },
  'puri': { calories: 150, protein: 3, carbs: 18, fats: 8 },
  // Rice
  'rice': { calories: 200, protein: 4, carbs: 45, fats: 1 },
  'plain rice': { calories: 200, protein: 4, carbs: 45, fats: 1 },
  'jeera rice': { calories: 230, protein: 5, carbs: 42, fats: 6 },
  'fried rice': { calories: 350, protein: 7, carbs: 55, fats: 12 },
  'veg fried rice': { calories: 380, protein: 8, carbs: 58, fats: 13 },
  'biryani': { calories: 450, protein: 12, carbs: 60, fats: 18 },
  'pulao': { calories: 300, protein: 7, carbs: 48, fats: 10 },
  'khichdi': { calories: 250, protein: 10, carbs: 40, fats: 5 },
  // Dals & curries
  'dal': { calories: 180, protein: 10, carbs: 28, fats: 4 },
  'arher dal': { calories: 180, protein: 10, carbs: 28, fats: 4 },
  'moong dal': { calories: 170, protein: 12, carbs: 26, fats: 3 },
  'masoor dal': { calories: 175, protein: 11, carbs: 27, fats: 3 },
  'mix dal': { calories: 200, protein: 12, carbs: 30, fats: 5 },
  'dal makhani': { calories: 280, protein: 12, carbs: 28, fats: 14 },
  'rajma': { calories: 250, protein: 14, carbs: 38, fats: 5 },
  'chole': { calories: 260, protein: 13, carbs: 40, fats: 6 },
  'kadhi': { calories: 150, protein: 6, carbs: 12, fats: 10 },
  'sambhar': { calories: 120, protein: 6, carbs: 18, fats: 3 },
  // Sabzis
  'veg korma': { calories: 220, protein: 6, carbs: 18, fats: 14 },
  'korma': { calories: 220, protein: 6, carbs: 18, fats: 14 },
  'aloo gobhi': { calories: 180, protein: 5, carbs: 22, fats: 9 },
  'mix veg': { calories: 160, protein: 5, carbs: 20, fats: 8 },
  'palak paneer': { calories: 280, protein: 14, carbs: 12, fats: 20 },
  'paneer butter masala': { calories: 320, protein: 14, carbs: 14, fats: 24 },
  'shahi paneer': { calories: 340, protein: 14, carbs: 16, fats: 26 },
  'paneer tikka': { calories: 300, protein: 18, carbs: 10, fats: 22 },
  'bhindi': { calories: 120, protein: 3, carbs: 14, fats: 6 },
  'baingan': { calories: 130, protein: 3, carbs: 15, fats: 7 },
  'karela': { calories: 80, protein: 3, carbs: 10, fats: 4 },
  'aloo matar': { calories: 200, protein: 6, carbs: 28, fats: 8 },
  'sabzi': { calories: 150, protein: 4, carbs: 18, fats: 8 },
  // Snacks
  'samosa': { calories: 280, protein: 5, carbs: 32, fats: 15 },
  'pakora': { calories: 300, protein: 6, carbs: 30, fats: 18 },
  'poha': { calories: 250, protein: 6, carbs: 40, fats: 8 },
  'upma': { calories: 280, protein: 7, carbs: 42, fats: 9 },
  'idli': { calories: 80, protein: 3, carbs: 16, fats: 1 },
  'dosa': { calories: 180, protein: 5, carbs: 28, fats: 6 },
  'masala dosa': { calories: 350, protein: 9, carbs: 45, fats: 15 },
  'chole bhature': { calories: 450, protein: 14, carbs: 60, fats: 18 },
  'pav bhaji': { calories: 380, protein: 10, carbs: 48, fats: 16 },
  'bread pakora': { calories: 250, protein: 6, carbs: 32, fats: 12 },
  'chips': { calories: 250, protein: 3, carbs: 28, fats: 15 },
  'crunchy munchy': { calories: 250, protein: 3, carbs: 28, fats: 15 },
  'momos': { calories: 200, protein: 8, carbs: 25, fats: 8 },
  // Noodles
  'maggi': { calories: 300, protein: 8, carbs: 45, fats: 10 },
  'chowmein': { calories: 380, protein: 10, carbs: 52, fats: 15 },
  // Eggs & chicken
  'boiled egg': { calories: 70, protein: 6, carbs: 0, fats: 5 },
  'omelette': { calories: 180, protein: 12, carbs: 2, fats: 14 },
  'egg curry': { calories: 250, protein: 14, carbs: 10, fats: 18 },
  'egg bhurji': { calories: 230, protein: 14, carbs: 6, fats: 16 },
  'chicken curry': { calories: 300, protein: 25, carbs: 8, fats: 20 },
  'chicken tikka': { calories: 280, protein: 30, carbs: 6, fats: 16 },
  // Beverages
  'tea': { calories: 80, protein: 2, carbs: 12, fats: 3 },
  'coffee': { calories: 100, protein: 3, carbs: 14, fats: 4 },
  'cold coffee': { calories: 200, protein: 6, carbs: 30, fats: 7 },
  'milk': { calories: 150, protein: 8, carbs: 12, fats: 8 },
  'badam milk': { calories: 220, protein: 10, carbs: 18, fats: 12 },
  'lassi': { calories: 180, protein: 8, carbs: 24, fats: 6 },
  'buttermilk': { calories: 50, protein: 3, carbs: 6, fats: 2 },
  'mango shake': { calories: 250, protein: 6, carbs: 40, fats: 8 },
  'banana shake': { calories: 230, protein: 7, carbs: 38, fats: 7 },
  // Fruits
  'watermelon': { calories: 50, protein: 1, carbs: 12, fats: 0 },
  'banana': { calories: 100, protein: 1, carbs: 25, fats: 0 },
  'apple': { calories: 90, protein: 0, carbs: 22, fats: 0 },
  'fruit': { calories: 70, protein: 1, carbs: 16, fats: 0 },
  // Sides
  'curd': { calories: 80, protein: 5, carbs: 6, fats: 4 },
  'raita': { calories: 90, protein: 5, carbs: 7, fats: 5 },
  'salad': { calories: 40, protein: 2, carbs: 8, fats: 1 },
  'pickle': { calories: 30, protein: 0, carbs: 4, fats: 2 },
  'papad': { calories: 60, protein: 3, carbs: 8, fats: 2 },
  'soup': { calories: 80, protein: 4, carbs: 10, fats: 3 },
  // Sweets
  'gulab jamun': { calories: 200, protein: 4, carbs: 30, fats: 8 },
  'rasgulla': { calories: 180, protein: 4, carbs: 40, fats: 2 },
  // Sandwich/burger
  'sandwich': { calories: 300, protein: 10, carbs: 35, fats: 14 },
  'burger': { calories: 400, protein: 15, carbs: 40, fats: 20 },
  'pizza': { calories: 350, protein: 12, carbs: 40, fats: 16 },
};

export function lookupFoodMacros(foodName: string): { calories: number; protein: number; carbs: number; fats: number } | null {
  const lower = foodName.toLowerCase().trim();
  
  // 1. Check Canteen DB
  for (const item of CANTEEN_RAW) {
    if (item[0].toLowerCase() === lower || item[0].toLowerCase().includes(lower)) {
      return { calories: item[2], protein: item[3], carbs: item[4], fats: item[5] };
    }
  }

  // 2. Check Mess DB
  for (const key of Object.keys(MESS_MEAL_MACROS)) {
    if (lower === key || key.includes(lower)) {
      return MESS_MEAL_MACROS[key];
    }
  }

  // 3. Check Generic DB
  if (INDIAN_FOOD_DB[lower]) return INDIAN_FOOD_DB[lower];
  for (const key of Object.keys(INDIAN_FOOD_DB)) {
    if (lower.includes(key) || key.includes(lower)) return INDIAN_FOOD_DB[key];
  }
  
  return null;
}

// ── Extract food items from natural language ──────────────────
export function extractFoodItems(lower: string): string[] {
  const found: string[] = [];
  const allNames = [
    ...CANTEEN_RAW.map(c => c[0].toLowerCase()),
    ...Object.keys(MESS_MEAL_MACROS),
    ...Object.keys(INDIAN_FOOD_DB)
  ];
  
  const sorted = [...new Set(allNames)].sort((a, b) => b.length - a.length);
  let remaining = lower;
  for (const food of sorted) {
    if (remaining.includes(food)) {
      found.push(food);
      remaining = remaining.replace(food, '');
    }
  }
  return found;
}

// ── Detect actual meal type (handles negation) ────────────────
function detectMealType(lower: string): 'breakfast' | 'lunch' | 'snacks' | 'dinner' {
  // Remove negated meal references: "did not have breakfast" / "no breakfast" / "skipped breakfast"
  const cleaned = lower
    .replace(/(?:did\s*n[o']?t|didn'?t|not|no|skip(?:ped)?|miss(?:ed)?)\s+(?:have\s+)?(?:my\s+)?(breakfast|lunch|dinner|snacks?)/gi, '')
    .trim();

  if (/\blunch\b/.test(cleaned)) return 'lunch';
  if (/\bbreakfast\b/.test(cleaned) || /\bnashta\b/.test(cleaned)) return 'breakfast';
  if (/\bdinner\b/.test(cleaned) || /\braat\b/.test(cleaned)) return 'dinner';
  if (/\bsnack/.test(cleaned) || /\bevening\b/.test(cleaned)) return 'snacks';

  // Infer from time
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 18) return 'snacks';
  return 'dinner';
}

// ── Local fallback classifier (when Groq is down) ────────────
function localFallbackClassify(msg: string): ParsedIntent {
  const lower = msg.toLowerCase().trim();

  // 1. Suggestion — check FIRST so "suggest what to eat for dinner" isn't logged as meal
  const suggestWords = ['suggest', 'recommend', 'what should', 'what can i', 'what to eat', 'hungry', 'bhookh', 'kya khaye', 'kya khau'];
  if (suggestWords.some(w => lower.includes(w))) {
    return { intent: 'get_suggestion', confidence: 0.8 };
  }

  // 2. Meal logging — food words present and not asking for suggestion
  const mealWords = ['ate', 'had ', 'eaten', 'log meal', 'log food', 'only lunch', 'only dinner', 'only breakfast', 'mess', 'canteen', 'khaya', 'khana'];
  const foodWords = ['roti', 'rice', 'dal', 'paratha', 'dosa', 'idli', 'maggi', 'paneer', 'chicken', 'egg', 'chips', 'korma', 'sabzi', 'rajma', 'chole', 'bhature', 'samosa', 'pakora', 'biryani', 'chapati', 'naan', 'poha', 'upma', 'lassi', 'curd', 'khichdi', 'momos', 'chowmein', 'karela', 'bhindi', 'watermelon', 'banana', 'tea', 'coffee'];
  if (mealWords.some(w => lower.includes(w)) || foodWords.filter(w => lower.includes(w)).length >= 2) {
    const mealType = detectMealType(lower);
    const source = lower.includes('mess') ? 'mess' as const : lower.includes('canteen') ? 'canteen' as const : 'unknown' as const;
    const foodItems = extractFoodItems(lower);
    return { intent: 'log_meal', mealType, source, foodItems: foodItems.length > 0 ? foodItems : undefined, confidence: 0.7 };
  }

  // 3. Water
  const hasStandaloneWater = /\bwater\b/.test(lower) && !/watermelon|waterfall/.test(lower);
  if (hasStandaloneWater || lower.includes('drank') || lower.includes('paani') || /\b\d+\s*ml\b/.test(lower)) {
    const waterMatch = lower.match(/(\d+)\s*(?:ml|glasses?|bottles?|litre|liter|litr)/);
    let waterMl = 250;
    if (waterMatch) {
      const num = parseInt(waterMatch[1]);
      if (/litr/.test(lower)) waterMl = num * 1000;
      else if (lower.includes('ml')) waterMl = num;
      else if (lower.includes('glass')) waterMl = num * 250;
      else if (lower.includes('bottle')) waterMl = num * 500;
    }
    return { intent: 'log_water', waterMl, confidence: 0.7 };
  }

  // 4. Exercise
  if (lower.includes('gym') || lower.includes('exercise') || lower.includes('workout') || /\brun\b/.test(lower) || lower.includes('jog') || /\bwalk\b/.test(lower) || lower.includes('cardio') || lower.includes('yoga') || lower.includes('cycling')) {
    const durMatch = lower.match(/(\d+)\s*(?:min|minutes?|hrs?|hours?)/);
    let duration = 30;
    let exerciseType = 'gym';
    if (durMatch) {
      duration = parseInt(durMatch[1]);
      if (lower.includes('hour') || lower.includes('hr')) duration *= 60;
    }
    if (/\brun\b/.test(lower) || lower.includes('jog')) exerciseType = 'cardio';
    else if (/\bwalk\b/.test(lower)) exerciseType = 'walk';
    else if (lower.includes('cardio')) exerciseType = 'cardio';
    else if (lower.includes('yoga')) exerciseType = 'yoga';
    else if (lower.includes('cycling') || lower.includes('cycle')) exerciseType = 'cycling';
    else if (lower.includes('swim')) exerciseType = 'swimming';
    return { intent: 'log_exercise', exerciseType, duration, confidence: 0.7 };
  }

  // Suggestion
  if (lower.includes('suggest') || lower.includes('recommend') || lower.includes('what should') || lower.includes('hungry') || lower.includes('kya khaye') || lower.includes('what to eat') || lower.includes('bhookh')) {
    return { intent: 'get_suggestion', confidence: 0.7 };
  }

  // Budget
  if (lower.includes('budget') || lower.includes('expense') || lower.includes('spent') || lower.includes('spend') || lower.includes('money') || lower.includes('paisa') || lower.includes('kitna kharch')) {
    return { intent: 'check_budget', confidence: 0.7 };
  }

  // Dashboard
  if (lower.includes('dashboard') || lower.includes('status') || lower.includes('progress') || lower.includes('how am i') || lower.includes('aaj ka') || lower.includes('today')) {
    return { intent: 'show_dashboard', confidence: 0.7 };
  }

  // Weekly
  if (lower.includes('weekly') || lower.includes('week') || lower.includes('hafta') || lower.includes('report') || lower.includes('reflection')) {
    return { intent: 'weekly_summary', confidence: 0.7 };
  }

  // Help
  if (lower.includes('help') || lower.includes('commands') || lower.includes('kya kar sakta') || lower === '/help') {
    return { intent: 'help', confidence: 0.8 };
  }

  return { intent: 'general_chat', confidence: 0.3 };
}

// ── Conversational reply generator ────────────────────────────
export async function generateConversationalReply(
  userMessage: string,
  context: {
    userName?: string;
    gapSummary: string;
    budgetRemaining: number;
    fitnessGoal: string;
    todayMealsLogged: string[];
    recentHistory?: { role: string; content: string }[];
  }
): Promise<string> {
  const name = context.userName ? context.userName.split(' ')[0] : 'bhai';
  const mealsLogged = context.todayMealsLogged.length > 0 ? context.todayMealsLogged.join(', ') : 'nothing yet';
  const goalEmoji = context.fitnessGoal === 'muscle-gain' ? '💪' : context.fitnessGoal === 'weight-loss' ? '🔥' : '⚖️';

  const systemPrompt = `You are BhawanBuddy — a senior IIT Roorkee student in Rajiv Bhawan who is deeply into fitness and genuinely wants to help juniors eat better in the hostel. You're the friend every hostelite needs: knowledgeable, warm, slightly sarcastic in a fun way, and always practical about hostel constraints.

Your personality:
- Natural mix of casual English with occasional Hindi words (yaar, bhai, sahi, bilkul, kal, aaj)
- You know IITR campus well: the mess timings, CCD on CC Road, Gate 3 vendors, Green Gala Cafe near library, the LHC, Rajiv gym
- Specific and actionable — never generic platitudes
- Use Telegram Markdown: **bold** for numbers and food names, _italics_ for emphasis
- Responses are 2-4 sentences max. Use bullet points only for listing 3+ items

Student context right now:
- Name: ${name} | Goal: ${context.fitnessGoal} ${goalEmoji}
- Nutrition status: ${context.gapSummary}
- Budget remaining: ₹${context.budgetRemaining}
- Logged today: ${mealsLogged}

Rules:
1. If they skipped meals, call it out gently and suggest something specific from the campus
2. Give real answers grounded in their goal (${context.fitnessGoal})
3. If they hit their protein goal, briefly celebrate then move on
4. You are BhawanBuddy — never break character
5. End with a light action nudge — never preachy`;

  try {
    const messages: any[] = [{ role: 'system', content: systemPrompt }];
    if (context.recentHistory) {
      messages.push(...context.recentHistory);
    }
    messages.push({ role: 'user', content: userMessage });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
      max_tokens: 250,
    });

    return completion.choices[0]?.message?.content || "Yaar, kuch technical issue ho gaya. Try again in a sec! 🔧";
  } catch {
    return "Arre, server side kuch gadbad hai. Try again in a moment — and log that meal before you forget! 📝";
  }
}

// ── Legacy exports (still used by weekly reflection) ──────────
export interface ParsedConstraints {
  type: 'add_constraint' | 'accept' | 'reject' | 'log_exercise' | 'log_water';
  maxPrice?: number;
  excludeCategories?: string[];
  temperature?: 'cold' | 'hot' | 'any';
  exerciseDetails?: {
    type: string;
    duration?: number;
    sets?: number;
    reps?: number;
  };
  waterAmount?: number;
}

export async function parseUserIntent(
  userMessage: string,
  gapSummary: string,
  lastSuggestion: string | null,
  constraintStack: Array<{ type: string; value: string | number }>
): Promise<ParsedConstraints> {
  const systemPrompt = `You are a nutrition coach parsing user messages into structured actions.
Given a user message about food, parse it into:
- type: "add_constraint" | "accept" | "reject" | "log_exercise" | "log_water"
- For add_constraint: extract price ceiling (numeric), category exclusions (veg/nonveg/egg/chicken), temperature preference (cold/hot/any)
- For log_exercise: exercise type (gym/cardio/walk/run), duration (minutes), sets, reps
- For log_water: amount in ml

Current nutritional gap: ${gapSummary}
Last suggestion: ${lastSuggestion || 'none'}
Current constraints: ${JSON.stringify(constraintStack)}

Reply in JSON format only with keys: type, maxPrice (optional), excludeCategories (optional), temperature (optional), exerciseDetails (optional), waterAmount (optional).`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 256,
    });

    const response = completion.choices[0]?.message?.content || '';

    try {
      const parsed = JSON.parse(response);
      return {
        type: parsed.type || 'add_constraint',
        maxPrice: parsed.maxPrice,
        excludeCategories: parsed.excludeCategories,
        temperature: parsed.temperature,
        exerciseDetails: parsed.exerciseDetails,
        waterAmount: parsed.waterAmount,
      };
    } catch {
      return { type: 'add_constraint' };
    }
  } catch (error) {
    console.error('Groq API error:', error);
    throw error;
  }
}

export async function generateWeeklyReflection(
  averageProtein: number,
  targetProtein: number,
  averageCalories: number,
  targetCalories: number,
  totalSpend: number,
  weeklyBudget: number,
  missedMeals: number
): Promise<string> {
  const systemPrompt = `Generate a weekly nutrition reflection based on this anonymized aggregate data:
- Average protein: ${averageProtein}g vs target ${targetProtein}g
- Average calories: ${averageCalories}kcal vs target ${targetCalories}kcal
- Total spend: ₹${totalSpend} of ₹${weeklyBudget} budget
- Missed meals: ${missedMeals}

Provide a concise 2-3 sentence summary and ONE actionable suggestion for the coming week.`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate weekly reflection' },
      ],
      temperature: 0.3,
      max_tokens: 150,
    });

    return completion.choices[0]?.message?.content || 'Great week! Keep up the good progress.';
  } catch (error) {
    console.error('Groq reflection error:', error);
    return 'Keep consistent with your meal logging for better insights.';
  }
}