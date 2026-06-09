import dotenv from 'dotenv';
dotenv.config();

import { Bot, InlineKeyboard } from 'grammy';
import { neon } from '@neondatabase/serverless';
import { getMessMenu, getAllUsers, saveUserProfile, initDB } from '../src/db/index.js';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);
const sql = neon(process.env.DATABASE_URL!);

async function runNotifications() {
  await initDB();

  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const currentTimeString = timeFormatter.format(now);
  const [currentHours, currentMinutes] = currentTimeString.split(':').map(Number);

  const currentJsDay = now.getDay();
  const dbDay = currentJsDay === 0 ? 6 : currentJsDay - 1;
  const todayMenu = await getMessMenu(dbDay);

  const users = await getAllUsers();
  const todayString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  for (const user of users) {
    if (!user.isOnboarded || !user.notifications) continue;

    const lastNotified = user.notifications.lastNotified || {};
    const mealsToProcess = [
      { type: 'breakfast', time: user.notifications.breakfast },
      { type: 'lunch',     time: user.notifications.lunch },
      { type: 'dinner',    time: user.notifications.dinner },
    ];

    for (const meal of mealsToProcess) {
      if (!meal.time) continue;
      const [hours, minutes] = meal.time.split(':').map(Number);
      const scheduledTotalMins = hours * 60 + minutes;
      const currentTotalMins = currentHours * 60 + currentMinutes;
      const diffMins = currentTotalMins - scheduledTotalMins;

      // Only fire within +0 to +10 minutes of the scheduled time
      const isInWindow = diffMins >= 0 && diffMins <= 10;
      const isNotNotifiedToday = lastNotified[meal.type as keyof typeof lastNotified] !== todayString;

      if (isInWindow && isNotNotifiedToday) {
        const mealMenu = todayMenu.find(m => m.mealType.toLowerCase() === meal.type);
        const menuString = mealMenu?.items?.length ? mealMenu.items.join(', ') : 'No mess menu available';

        const text = `Time for ${meal.type}! 🍽️ (Scheduled for ${meal.time})\n\n` +
          `Today's mess menu for ${meal.type}:\n📌 *${menuString}*\n\n` +
          `Did you eat in the mess? How much did you eat?\n\n` +
          `If you haven't eaten yet, tell me what you're having and what activity you're planning (gym, studying, sleeping). I'll suggest the right portion size!`;

        try {
          await bot.api.sendMessage(user.odid, text, {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('📋 Log Meal', `meal:${meal.type}`),
          });
          user.notifications.lastNotified = { ...lastNotified, [meal.type]: todayString };
          await saveUserProfile(user);
          console.log(`Notified ${user.odid} for ${meal.type}`);
        } catch (e) {
          console.error(`Failed to notify ${user.odid}:`, e);
        }
        break; // One notification per user per cycle
      }
    }

    // Sunday night weekly menu request
    if (currentJsDay === 0) {
      const isAfter830PM = currentHours > 20 || (currentHours === 20 && currentMinutes >= 30);
      if (isAfter830PM && lastNotified.weeklyMenuRequest !== todayString) {
        try {
          await bot.api.sendMessage(user.odid,
            "It's Sunday night! 🌙 Please upload a photo of the mess menu for next week! 📸");
          user.notifications.lastNotified = { ...lastNotified, weeklyMenuRequest: todayString };
          await saveUserProfile(user);
        } catch (e) {
          console.error(`Failed to send weekly request to ${user.odid}:`, e);
        }
      }
    }
  }

  console.log('Notification run complete.');
}

runNotifications().catch(console.error);
