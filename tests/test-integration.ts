import dotenv from 'dotenv';
dotenv.config();
import { parseMessMenuFromText } from '../src/services/groq.js';
import { saveMessMenu, getMessMenu } from '../src/db/index.js';
import { DAILY_BREAKFAST, DAILY_LUNCH_SIDES, DAILY_DINNER_SIDES } from '../src/data/mess-menu.js';

async function run() {
  console.log('1. Simulating parsing of an OCR text block...');
  const ocrText = `
Monday   Poha, Jalebi   Rajma Rice, Salad   Dal Tadka, Roti
  `;
  const parsed = await parseMessMenuFromText(ocrText);
  console.log('Parsed OCR:', JSON.stringify(parsed, null, 2));

  console.log('\n2. Simulating the Bot Save Logic...');
  const dbItems = [];
  for (const day of parsed) {
    if (day.dayOfWeek === undefined) continue;
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      let items = day[mealType] || [];
      if (items.length > 0) {
        if (mealType === 'breakfast') items = [...new Set([...items, ...DAILY_BREAKFAST])];
        if (mealType === 'lunch') items = [...new Set([...items, ...DAILY_LUNCH_SIDES])];
        if (mealType === 'dinner') items = [...new Set([...items, ...DAILY_DINNER_SIDES])];
        dbItems.push({
          id: `${day.dayOfWeek}-${mealType}`,
          dayOfWeek: day.dayOfWeek,
          mealType,
          items,
          estimatedMacros: { calories: 0, protein: 0, carbs: 0, fats: 0 }
        });
      }
    }
  }
  
  console.log('\n3. Saving to Neon Database...');
  await saveMessMenu(dbItems);
  console.log('Saved successfully!');

  console.log('\n4. Simulating user saying "i ate lunch in mess"...');
  const todayMenu = await getMessMenu(0); // Monday
  const mealMenu = todayMenu.find(m => m.mealType.toLowerCase() === 'lunch');
  console.log('Bot resolved items:', mealMenu ? mealMenu.items : 'Not found');
  
  process.exit(0);
}
run();
