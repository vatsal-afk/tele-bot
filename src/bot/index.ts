import { Bot, Keyboard, InlineKeyboard } from 'grammy';
import type { Context } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { initDB, getUserProfile, saveUserProfile, getDailyLog, addDailyLogEntry, getCanteenItems, saveCanteenItems, getMessMenu, saveMessMenu, saveVendorItems, getAllUsers, getSessionHistory, saveSessionHistory, getOnboardingState, saveOnboardingState, deleteOnboardingState } from '../db/index.js';
import { computeICMRTargets } from '../utils/icmr.js';
import { getNutritionalGap } from '../utils/icmr.js';
import { rankItems, generateSuggestion, checkBudgetAndSuggestAlternative, formatSuggestionMessage, calculateCaloriesBurned, type Constraint } from '../services/gapFiller.js';
import { checkGroqHealth, classifyIntent, generateConversationalReply, generateWeeklyReflection, lookupFoodMacros } from '../services/groq.js';
import { formatGapSummary } from '../utils/icmr.js';
import { loadCanteenItems, loadMessSchedule, loadVendorLibrary } from '../db/knowledge.js';

dotenv.config();

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || '');

let dbInitialized = false;

async function ensureDB() {
  if (!dbInitialized) {
    await initDB();
    const items = await getCanteenItems();
    if (items.length === 0) {
      const canteenItems = loadCanteenItems();
      const messItems = loadMessSchedule('Rajiv Bhawan');
      const vendorItems = loadVendorLibrary();
      await saveCanteenItems(canteenItems);
      await saveMessMenu(messItems);
      await saveVendorItems(vendorItems);
    }
    dbInitialized = true;
  }
}

// Onboarding state is persisted in Neon (stateless-safe)

bot.command('start', async (ctx) => {
  console.log('Start command triggered');
  await ensureDB();
  console.log('DB ensured');
  const odid = ctx.from?.id.toString();
  
  if (!odid) {
    console.log('No user ID found');
    await ctx.reply('Unable to identify user. Please try again.');
    return;
  }

  console.log('Fetching user profile for', odid);
  const profile = await getUserProfile(odid);
  console.log('Profile fetched:', !!profile);
  
  if (!profile || !profile.isOnboarded) {
    await saveOnboardingState(odid, { step: 0, data: { odid } });
    await ctx.reply("Welcome to IITR Hostel Fitness Tracker! 🚀\n\nTo set up your personalized ICMR-NIN targets, please tell me your details in one message.\n\nFor example: \"I am 21 years old, 65kg, 170cm, male. I am moderately active, vegetarian, and want to gain muscle. My daily budget is 150 Rs.\"");
  } else {
    await showDashboard(ctx, odid);
  }
});

async function showDashboard(ctx: Context, odid: string) {
  const profile = await getUserProfile(odid);
  if (!profile) return;

  const today = new Date().toISOString().split('T')[0];
  const todayLog = await getDailyLog(odid, today);
  
  const loggedCalories = todayLog.reduce((sum, e) => sum + (e.items?.reduce((s, i: any) => s + (i.macros?.calories || 0), 0) || 0), 0);
  const loggedProtein = todayLog.reduce((sum, e) => sum + (e.items?.reduce((s, i: any) => s + (i.macros?.protein || 0), 0) || 0), 0);
  
  const totalSpent = todayLog.reduce((sum, e) => sum + (e.cost || 0), 0);
  const remainingBudget = profile.dailyBudget - totalSpent;
  const targets = profile.targets as any;

  let msg = `📊 Today's Dashboard\n\n`;
  msg += `🔥 Calories: ${loggedCalories} / ${targets.calories || 0} kcal\n`;
  msg += `🥩 Protein: ${loggedProtein} / ${targets.protein || 0}g\n`;
  msg += `💰 Budget: ₹${remainingBudget} / ₹${profile.dailyBudget}\n`;
  msg += `💧 Water: ${todayLog.filter(e => e.waterMl).reduce((s, e) => s + (e.waterMl || 0), 0)} / ${targets.waterMl || 0}ml`;

  const keyboard = new InlineKeyboard()
    .text('🍳 Log Meal', 'action:meal')
    .text('🏋️ Log Exercise', 'action:exercise')
    .text('💧 Log Water', 'action:water')
    .row()
    .text('💰 Budget', 'action:budget')
    .text('📈 Weekly', 'action:weekly')
    .text('⚙️ Settings', 'action:settings');

  await ctx.reply(msg, { reply_markup: keyboard });
}

bot.on('callback_query:data', async (ctx) => {
  const callback = ctx.callbackQuery;
  const data = callback.data;
  const userId = callback.from.id.toString();
  
  await ensureDB();
  
  if (data === 'action:meal') {
    await ctx.reply('What would you like to log?', {
      reply_markup: new InlineKeyboard()
        .text('🍳 Breakfast', 'meal:breakfast')
        .text('🍽️ Lunch', 'meal:lunch')
        .text('🥪 Snacks', 'meal:snacks')
        .text('🌙 Dinner', 'meal:dinner'),
    });
  } else if (data === 'action:exercise') {
    await ctx.reply('What type of exercise?', {
      reply_markup: new InlineKeyboard()
        .text('🏋️ Gym', 'exercise:gym')
        .text('🏃 Cardio', 'exercise:cardio')
        .text('🚶 Walk', 'exercise:walk'),
    });
  } else if (data === 'action:water') {
    await ctx.reply('How much water?', {
      reply_markup: new InlineKeyboard()
        .text('🥛 250ml', 'water:250')
        .text('🥛 500ml', 'water:500')
        .text('🥛 750ml', 'water:750'),
    });
  } else if (data === 'action:budget') {
    const profile = await getUserProfile(userId);
    if (!profile) return;
    
    const today = new Date().toISOString().split('T')[0];
    const todayLog = await getDailyLog(userId, today);
    const totalSpent = todayLog.reduce((sum, e) => sum + (e.cost || 0), 0);
    const remaining = profile.dailyBudget - totalSpent;
    
    await ctx.reply(`💰 Budget\n\nSpent: ₹${totalSpent}\nRemaining: ₹${remaining}\nBudget: ₹${profile.dailyBudget}`);
  } else if (data === 'action:weekly') {
    await sendWeeklySummary(ctx, userId);
  } else if (data === 'action:settings') {
    await ctx.reply('Settings:\n/start - Restart\n/dashboard - Dashboard');
  } else if (data.startsWith('meal:')) {
    const mealType = data.split(':')[1];
    await ctx.reply(`Log your ${mealType} - search canteen or type item name, or say "mess" for mess meal`, {
      reply_markup: new InlineKeyboard()
        .text('📋 Canteen Menu', 'canteen:list'),
    });
    
    const entry = {
      id: uuidv4(),
      odid: userId,
      date: new Date().toISOString().split('T')[0],
      eventType: 'meal' as const,
      mealType,
      source: 'canteen',
      items: [],
      timestamp: Date.now(),
      isConfirmed: true,
      isMissed: false,
    };
    
    await addDailyLogEntry(entry);
    await ctx.answerCallbackQuery('Meal logged!');
  } else if (data.startsWith('exercise:')) {
    const exerciseType = data.split(':')[1];
    await ctx.reply(`How long was your ${exerciseType} session? (minutes)`, {
      reply_markup: new InlineKeyboard()
        .text('15m', 'duration:15')
        .text('30m', 'duration:30')
        .text('45m', 'duration:45')
        .text('60m', 'duration:60'),
    });
  } else if (data.startsWith('water:')) {
    const amount = parseInt(data.split(':')[1]);
    const entry = {
      id: uuidv4(),
      odid: userId,
      date: new Date().toISOString().split('T')[0],
      eventType: 'water' as const,
      waterMl: amount,
      timestamp: Date.now(),
      isConfirmed: true,
      isMissed: false,
    };
    
    await addDailyLogEntry(entry);
    await ctx.answerCallbackQuery(`Logged ${amount}ml water!`);
    await showDashboard(ctx, userId);
  } else if (data.startsWith('duration:')) {
    const duration = parseInt(data.split(':')[1]);
    const entry = {
      id: uuidv4(),
      odid: userId,
      date: new Date().toISOString().split('T')[0],
      eventType: 'exercise' as const,
      exerciseType: 'gym',
      duration,
      caloriesBurned: 0,
      timestamp: Date.now(),
      isConfirmed: true,
      isMissed: false,
    };
    
    await addDailyLogEntry(entry);
    await ctx.answerCallbackQuery(`Logged ${duration}min exercise!`);
    await showDashboard(ctx, userId);
  } else if (data.startsWith('accept:')) {
    const itemName = data.split(':')[1];
    await ctx.answerCallbackQuery(`Logged ${itemName}!`);
    await showDashboard(ctx, userId);
  } else if (data === 'canteen:list') {
    const items = await getCanteenItems();
    const topItems = items.slice(0, 15);
    
    let msg = '📋 Canteen Menu (Prices with 1.2x fat adjustment)\n\n';
    for (const item of topItems) {
      msg += `${item.name} - ₹${item.price}\n`;
    }
    
    await ctx.reply(msg);
  }
  
  await ctx.answerCallbackQuery();
});

async function sendWeeklySummary(ctx: Context, odid: string) {
  const profile = await getUserProfile(odid);
  if (!profile) return;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  
  let totalProtein = 0, totalCalories = 0, totalSpend = 0, days = 0;
  
  for (let d = new Date(weekAgo); d <= new Date(today); d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const log = await getDailyLog(odid, dateStr);
    if (log.length > 0) {
      totalProtein += log.reduce((s, e) => s + (e.items?.reduce((sum, i: any) => sum + (i.macros?.protein || 0), 0) || 0), 0);
      totalCalories += log.reduce((s, e) => s + (e.items?.reduce((sum, i: any) => sum + (i.macros?.calories || 0), 0) || 0), 0);
      totalSpend += log.reduce((s, e) => s + (e.cost || 0), 0);
      days++;
    }
  }
  
  if (days === 0) {
    await ctx.reply('No data for this week yet.');
    return;
  }
  
  const avgProtein = Math.round(totalProtein / days);
  const avgCalories = Math.round(totalCalories / days);
  const weeklyBudget = profile.dailyBudget * 7;
  const targets = profile.targets as any;
  
  let reflection: string;
  try {
    const groqAvailable = await checkGroqHealth();
    if (groqAvailable) {
      reflection = await generateWeeklyReflection(
        avgProtein,
        targets.protein || 60,
        avgCalories,
        targets.calories || 2000,
        totalSpend,
        weeklyBudget,
        0
      );
    } else {
      reflection = `🥩 Protein: ${avgProtein}g / ${targets.protein || 60}g\n🔥 Calories: ${avgCalories} / ${targets.calories || 2000}kcal\n💰 Spend: ₹${totalSpend} / ₹${weeklyBudget}`;
    }
  } catch {
    reflection = `Protein: ${avgProtein}g / ${targets.protein || 60}g\nCalories: ${avgCalories} / ${targets.calories || 2000}kcal\nSpend: ₹${totalSpend} / ₹${weeklyBudget}`;
  }
  
  await ctx.reply(reflection);
}

bot.on('message:text', async (ctx) => {
  const message = ctx.message?.text;
  const userId = ctx.from?.id.toString();
  
  if (!message || !userId) return;
  
  await ensureDB();
  
  // Handle onboarding
  const onBoarding = await getOnboardingState(userId);
  if (onBoarding) {
    // Send to Groq to extract profile
    const intent = await classifyIntent(message, {
      gapSummary: '0', budgetRemaining: 0, todayMealsLogged: [], currentTime: '00:00'
    });

    if (intent.intent === 'complete_onboarding' && intent.onboardingProfile) {
      const data = intent.onboardingProfile;
      console.log('Saving profile with extracted data:', JSON.stringify(data));
      
      const targets = computeICMRTargets({
        weight: data.weight, height: data.height, age: data.age,
        sex: data.sex, activityLevel: data.activityLevel, fitnessGoal: data.fitnessGoal,
      });
      
      const newProfile = {
        odid: userId, createdAt: Date.now(), age: data.age, height: data.height,
        weight: data.weight, sex: data.sex, activityLevel: data.activityLevel,
        dietType: data.dietType, hostel: 'Rajiv Bhawan', messZone: 'A-Block',
        fitnessGoal: data.fitnessGoal, dailyBudget: 150, // default if not extracted
        weeklyBudget: 150 * 7, campusZone: 'New CC Road',
        notifications: { breakfast: '08:30', lunch: '12:30', dinner: '19:30', customReminders: [] },
        targets, isOnboarded: true,
      };
      
      await saveUserProfile(newProfile);
      await deleteOnboardingState(userId);
      
      await ctx.reply('🎉 Onboarding complete! Your daily targets:\n' +
        `🔥 Calories: ${Math.round(targets.calories)}kcal\n🥩 Protein: ${Math.round(targets.protein)}g\n💧 Water: ${Math.round(targets.waterMl)}ml`);
      await showDashboard(ctx, userId);
    } else {
      await ctx.reply("I couldn't quite catch all your details. Please provide your age, weight, height, gender, activity level, diet type, and fitness goal in one message.");
    }
    return;
  }
  
  // ── Post-onboarding: Intelligent NLU routing ──
  const profile = await getUserProfile(userId);
  if (!profile) {
    await ctx.reply("You haven't set up your profile yet. Send /start to begin!");
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const todayLog = await getDailyLog(userId, today);
  const targets = profile.targets as any;

  const logged = {
    calories: todayLog.reduce((sum, e) => sum + (e.items?.reduce((s, i: any) => s + (i.macros?.calories || 0), 0) || 0), 0),
    protein: todayLog.reduce((sum, e) => sum + (e.items?.reduce((s, i: any) => s + (i.macros?.protein || 0), 0) || 0), 0),
    carbs: 0, fats: 0,
  };
  const gap = getNutritionalGap(logged, targets);
  const totalSpent = todayLog.reduce((sum, e) => sum + (e.cost || 0), 0);
  const budgetRemaining = profile.dailyBudget - totalSpent;
  const gapSummary = formatGapSummary(gap);
  const mealsLogged = todayLog.filter(e => e.eventType === 'meal').map(e => e.mealType || 'meal');

  // Classify intent via Groq (with local fallback)
  console.log(`[NLU] Classifying: "${message}"`);
  const history = await getSessionHistory(userId);
  const intent = await classifyIntent(message, {
    gapSummary, budgetRemaining,
    todayMealsLogged: mealsLogged,
    currentTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    recentHistory: history,
  });
  console.log(`[NLU] Result:`, JSON.stringify(intent));

  // ── Route by intent ──
  switch (intent.intent) {
    case 'log_meal': {
      const mealType = intent.mealType || 'lunch';
      const source = intent.source || 'unknown';
      const foodNames = intent.foodItems?.join(', ') || 'meal';

      // Parse quantities from original message (e.g., "2 roti", "3 idli")
      const qtyMap = new Map<string, number>();
      const qtyRegex = /(\d+)\s+(roti|chapati|idli|paratha|egg|samosa|puri|naan|pakora|gulab jamun|rasgulla|boiled egg)/gi;
      let qm;
      while ((qm = qtyRegex.exec(message)) !== null) {
        qtyMap.set(qm[2].toLowerCase(), parseInt(qm[1]));
      }

      // Look up each food item in Indian food DB first, then canteen DB, then use LLM estimation
      let matchedItems: any[] = [];
      if (intent.foodItems && intent.foodItems.length > 0) {
        for (const foodName of intent.foodItems) {
          const qty = qtyMap.get(foodName.toLowerCase()) || 1;
          const localMacros = lookupFoodMacros(foodName);
          const macros = localMacros || (intent.estimatedMacros && (intent.estimatedMacros[foodName] || Object.values(intent.estimatedMacros)[0])); // fallback to first estimation if exact name mismatch
          
          if (macros) {
            matchedItems.push({
              name: foodName, quantity: qty,
              macros: { calories: macros.calories * qty, protein: macros.protein * qty, carbs: macros.carbs * qty, fats: macros.fats * qty },
              isEstimated: !localMacros
            });
          } else {
            matchedItems.push({ name: foodName, quantity: qty, macros: { calories: 0, protein: 0, carbs: 0, fats: 0 } });
          }
        }
      }

      const existingMeal = todayLog.find(e => e.eventType === 'meal' && e.mealType === mealType);
      
      let newItems = matchedItems;
      let finalItems = matchedItems.length > 0 ? matchedItems : [];
      let finalCost = intent.cost || 0;
      let finalId = uuidv4();
      
      if (existingMeal) {
         finalId = existingMeal.id; // use the same ID so it replaces via INSERT OR REPLACE
         
         // Avoid logging the exact same item twice in the same meal
         const existingItemNames = new Set((existingMeal.items || []).map((i: any) => i.name.toLowerCase()));
         newItems = matchedItems.filter(i => !existingItemNames.has(i.name.toLowerCase()));
         
         finalItems = [...(existingMeal.items || []), ...newItems];
         finalCost = (existingMeal.cost || 0) + (intent.cost || 0);
      }

      if (existingMeal && newItems.length === 0 && !intent.cost) {
        // Nothing new to add, probably conversational follow-up
        await ctx.reply(`You've already logged ${foodNames} for ${mealType}! Keep up the good work. 💪`);
        await saveSessionHistory(userId, [...history.slice(-5), {role: 'user', content: message}, {role: 'assistant', content: `You've already logged ${foodNames} for ${mealType}!`}]);
        break;
      }

      const entry = {
        id: finalId, odid: userId, date: today,
        eventType: 'meal' as const, mealType, source,
        items: finalItems,
        timestamp: Date.now(), isConfirmed: true, isMissed: false,
        cost: finalCost,
      };
      await addDailyLogEntry(entry);

      const addedCal = newItems.reduce((s, i) => s + (i.macros?.calories || 0), 0);
      const addedProt = newItems.reduce((s, i) => s + (i.macros?.protein || 0), 0);
      const addedCarbs = newItems.reduce((s, i) => s + (i.macros?.carbs || 0), 0);
      const addedFats = newItems.reduce((s, i) => s + (i.macros?.fats || 0), 0);

      let reply = existingMeal ? `Added to ${mealType}: ${newItems.map(i => i.name).join(', ')}\n` : `Logged ${mealType}: ${foodNames}\n`;
      if (addedCal > 0) {
        reply += `${Math.round(addedCal)} kcal | ${Math.round(addedProt)}g protein\n`;
        reply += `${Math.round(addedCarbs)}g carbs | ${Math.round(addedFats)}g fats\n`;
        reply += `\nBreakdown:\n`;
        for (const item of newItems) {
          if (item.macros.calories > 0) {
            const qLabel = item.quantity > 1 ? `${item.quantity}× ` : '';
            const estLabel = item.isEstimated ? ' (est. via NICE/ICMR)' : '';
            reply += `- ${qLabel}${item.name}: ${Math.round(item.macros.calories)} kcal, ${Math.round(item.macros.protein)}g protein${estLabel}\n`;
          }
        }
      }
      if (intent.cost) reply += `Cost: ₹${intent.cost}\n`;
      
      await ctx.reply(reply);
      await saveSessionHistory(userId, [...history.slice(-5), {role: 'user', content: message}, {role: 'assistant', content: reply}]);
      break;
    }

    case 'log_exercise': {
      const exerciseType = intent.exerciseType || 'gym';
      const duration = intent.duration || 30;
      const caloriesBurned = calculateCaloriesBurned(exerciseType, duration, profile.weight, intent.sets, intent.reps);

      const entry = {
        id: uuidv4(), odid: userId, date: today,
        eventType: 'exercise' as const, exerciseType, duration,
        sets: intent.sets, reps: intent.reps, caloriesBurned,
        timestamp: Date.now(), isConfirmed: true, isMissed: false,
      };
      await addDailyLogEntry(entry);

      let reply = `💪 Logged: ${exerciseType} for ${duration} min\n🔥 ~${caloriesBurned} kcal burned`;
      if (intent.sets && intent.reps) reply += `\n📋 ${intent.sets} sets × ${intent.reps} reps`;
      await ctx.reply(reply);
      break;
    }

    case 'log_water': {
      const waterMl = intent.waterMl || 250;
      const entry = {
        id: uuidv4(), odid: userId, date: today,
        eventType: 'water' as const, waterMl,
        timestamp: Date.now(), isConfirmed: true, isMissed: false,
      };
      await addDailyLogEntry(entry);

      const totalWater = todayLog.filter(e => e.waterMl).reduce((s, e) => s + (e.waterMl || 0), 0) + waterMl;
      await ctx.reply(`💧 Logged ${waterMl}ml water!\nTotal today: ${totalWater}ml / ${targets.waterMl || 2000}ml`);
      break;
    }

    case 'get_suggestion': {
      const canteenItems = await getCanteenItems();
      const constraints: Constraint[] = [];
      if (intent.maxPrice) constraints.push({ type: 'price-ceiling', value: intent.maxPrice });
      if (intent.temperature && intent.temperature !== 'any') constraints.push({ type: 'temperature', value: intent.temperature });
      if (profile.dietType === 'vegetarian') constraints.push({ type: 'category-exclude', value: 'non-veg' });

      const ranked = rankItems(canteenItems as any, gap, profile.fitnessGoal, budgetRemaining, constraints);
      const topItem = ranked[0];

      if (!topItem) {
        await ctx.reply("😅 No items match right now. Try loosening your constraints or check the canteen menu with /log.");
        break;
      }

      const check = checkBudgetAndSuggestAlternative(topItem, budgetRemaining, ranked);
      if (!check.canProceed && check.alternative) {
        await ctx.reply(check.message || 'Budget exceeded', {
          reply_markup: new InlineKeyboard()
            .text(`✅ ${check.alternative.itemName}`, `accept:${check.alternative.itemName}`),
        });
        await saveSessionHistory(userId, [...history.slice(-5), {role: 'user', content: message}, {role: 'assistant', content: check.message || 'Budget exceeded'}]);
      } else {
        const suggestion = generateSuggestion(topItem, gap);
        const suggestionMsg = formatSuggestionMessage(suggestion);
        await ctx.reply(suggestionMsg, {
          reply_markup: new InlineKeyboard()
            .text('✅ Log This', `accept:${topItem.itemName}`)
            .text('❌ Skip', 'reject:suggestion'),
        });
        await saveSessionHistory(userId, [...history.slice(-5), {role: 'user', content: message}, {role: 'assistant', content: suggestionMsg}]);
      }
      break;
    }

    case 'check_budget': {
      await ctx.reply(`💰 Today's Budget\n\nSpent: ₹${totalSpent}\nRemaining: ₹${budgetRemaining}\nDaily limit: ₹${profile.dailyBudget}`);
      break;
    }

    case 'show_dashboard': {
      await showDashboard(ctx, userId);
      break;
    }

    case 'weekly_summary': {
      await sendWeeklySummary(ctx, userId);
      break;
    }

    case 'help': {
      await ctx.reply(
        "🤖 I understand natural language! Just tell me:\n\n" +
        '🍳 "I had paratha and tea for breakfast"\n' +
        '🏋️ "Went to gym for 45 minutes"\n' +
        '💧 "Drank 2 glasses of water"\n' +
        '🍽️ "What should I eat?" or "I\'m hungry"\n' +
        '💰 "How much have I spent today?"\n' +
        '📊 "Show my progress"\n' +
        '📈 "Weekly report"\n\n' +
        'Commands: /start /dashboard /log /budget /weekly'
      );
      break;
    }

    case 'general_chat':
    default: {
      const reply = await generateConversationalReply(message, {
        gapSummary, budgetRemaining, fitnessGoal: profile.fitnessGoal,
        todayMealsLogged: mealsLogged,
        recentHistory: history,
      });
      await ctx.reply(reply);
      await saveSessionHistory(userId, [...history.slice(-5), {role: 'user', content: message}, {role: 'assistant', content: reply}]);
      break;
    }
  }
});

bot.on('message:photo', async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const today = new Date();
  // If it's Sunday or Monday, assume it's the weekly menu upload
  if (today.getDay() === 0 || today.getDay() === 1) {
    await ctx.reply("Thanks for uploading the menu! 📸 I've received the image and will use it to keep your mess schedule up-to-date for the week ahead.");
  } else {
    await ctx.reply("I received your photo! 📸 Currently, I mainly use photos to update the weekly mess schedule on Sundays. If this is a food picture, I'll support automatic meal tracking from images soon!");
  }
});

bot.command('dashboard', async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (userId) await showDashboard(ctx, userId);
});

bot.command('log', async (ctx) => {
  await ctx.reply('What to log?', {
    reply_markup: new InlineKeyboard()
      .text('🍳 Meal', 'action:meal')
      .text('🏋️ Exercise', 'action:exercise')
      .text('💧 Water', 'action:water'),
  });
});

bot.command('weekly', async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (userId) await sendWeeklySummary(ctx, userId);
});

bot.command('budget', async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;
  
  const profile = await getUserProfile(userId);
  if (!profile) return;
  
  const today = new Date().toISOString().split('T')[0];
  const todayLog = await getDailyLog(userId, today);
  const totalSpent = todayLog.reduce((sum, e) => sum + (e.cost || 0), 0);
  const remaining = profile.dailyBudget - totalSpent;
  
  await ctx.reply(`💰 Budget\n\nSpent: ₹${totalSpent}\nRemaining: ₹${remaining}\nDaily: ₹${profile.dailyBudget}`);
});

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err.error);
});

function startNotificationJob() {
  setInterval(async () => {
    try {
      if (!dbInitialized) return;
      
      const now = new Date();
      const timeFormatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const currentTimeString = timeFormatter.format(now);

      const currentJsDay = now.getDay();
      const dbDay = currentJsDay === 0 ? 6 : currentJsDay - 1;
      const todayMenu = await getMessMenu(dbDay);

      const users = await getAllUsers();
      const todayString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in IST

      for (const user of users) {
        if (!user.isOnboarded || !user.notifications) continue;

        let mealToLog: string | null = null;
        let scheduledTime: string | null = null;

        const lastNotified = user.notifications.lastNotified || {};
        const mealsToProcess = [
          { type: 'breakfast', time: user.notifications.breakfast },
          { type: 'lunch', time: user.notifications.lunch },
          { type: 'dinner', time: user.notifications.dinner },
        ];

        const [currentHours, currentMinutes] = currentTimeString.split(':').map(Number);

        for (const meal of mealsToProcess) {
          if (!meal.time) continue;
          
          const [hours, minutes] = meal.time.split(':').map(Number);
          const isTimePassed = (currentHours > hours) || (currentHours === hours && currentMinutes >= minutes);
          const isNotNotifiedToday = lastNotified[meal.type as keyof typeof lastNotified] !== todayString;

          if (isTimePassed && isNotNotifiedToday) {
            mealToLog = meal.type;
            scheduledTime = meal.time;
            break; // Process one missed notification per cycle to avoid spamming
          }
        }

        if (mealToLog) {
          const mealMenu = todayMenu.find(m => m.mealType.toLowerCase() === mealToLog);
          const menuString = mealMenu && mealMenu.items.length > 0 ? mealMenu.items.join(', ') : 'No mess menu available';
          
          const messageText = `Time for ${mealToLog}! 🍽️ (Scheduled for ${scheduledTime})\n\n` +
            `Today's mess menu for ${mealToLog} is:\n📌 *${menuString}*\n\n` +
            `Did you eat in the mess? How much did you eat and what all did you take?\n\n` +
            `If you haven't eaten yet, let me know what you're having and what activity you're planning to do next (e.g., gym, studying, sleeping). I can suggest the right portion size for you!`;

          try {
            await bot.api.sendMessage(
              user.odid,
              messageText,
              {
                parse_mode: 'Markdown',
                reply_markup: new InlineKeyboard()
                  .text('📋 Log Meal', `meal:${mealToLog}`)
              }
            );

            // Update user profile to mark this notification as sent today
            user.notifications.lastNotified = {
              ...lastNotified,
              [mealToLog]: todayString
            };
            await saveUserProfile(user);
          } catch (e) {
            console.error(`Failed to send notification to ${user.odid}:`, e);
          }
        }

        // Sunday night weekly menu request
        if (currentJsDay === 0) { // Sunday
          const isAfter830PM = currentHours > 20 || (currentHours === 20 && currentMinutes >= 30);
          const isNotNotifiedForWeek = lastNotified.weeklyMenuRequest !== todayString;

          if (isAfter830PM && isNotNotifiedForWeek) {
            try {
              await bot.api.sendMessage(
                user.odid,
                "It's Sunday night! 🌙 Please upload a photo of the mess menu for next week so I can keep my records updated! 📸"
              );
              
              user.notifications.lastNotified = {
                ...(user.notifications.lastNotified || {}),
                weeklyMenuRequest: todayString
              };
              await saveUserProfile(user);
            } catch (e) {
              console.error(`Failed to send weekly menu request to ${user.odid}:`, e);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error in notification job:', e);
    }
  }, 60000); // Check every minute
}

// Export for webhook mode (Vercel)
// startNotificationJob is called separately via GitHub Actions cron