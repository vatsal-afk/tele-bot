import { v4 as uuidv4 } from 'uuid';
import type { CanteenItem, MessMenuItem, VendorItem } from '../db/index.js';
import { CANTEEN_RAW } from '../data/canteen-items.js';
import { WEEKLY_MENU, MESS_MEAL_MACROS } from '../data/mess-menu.js';

function applyAdjustments(raw: typeof CANTEEN_RAW[0]): CanteenItem {
  const [name, price, baseCal, baseProt, baseCarb, baseFat, category, isVeg] = raw;
  const isDal = name.toLowerCase().includes('dal') || name.toLowerCase().includes('rajma') || name.toLowerCase().includes('chole');
  
  const adjustedFats = baseFat * 1.2;
  const adjustedCalories = baseCal + Math.round(baseFat * 0.2);
  const adjustedProtein = isDal ? Math.round(baseProt * 0.7) : baseProt;

  return {
    id: uuidv4(),
    name,
    category: category as any,
    baseMacros: {
      calories: baseCal,
      protein: baseProt,
      carbs: baseCarb,
      fats: baseFat,
    },
    adjustedMacros: {
      calories: Math.round(adjustedCalories),
      protein: adjustedProtein,
      carbs: baseCarb,
      fats: Math.round(adjustedFats),
    },
    price,
    isVeg,
    temperature: category === 'beverage' ? 'both' : 'hot',
  };
}

export function loadCanteenItems(): CanteenItem[] {
  return CANTEEN_RAW.map(applyAdjustments);
}

export function loadMessSchedule(hostel: string): MessMenuItem[] {
  // Use the actual Rajiv Bhawan menu
  const items: MessMenuItem[] = [];
  
  for (let day = 0; day < WEEKLY_MENU.length; day++) {
    const mealPlan = WEEKLY_MENU[day];
    
    // Helper to calculate total macros for a meal array
    const calcMacros = (mealItems: string[]) => {
      let cal = 0, pro = 0, car = 0, fat = 0;
      for (const item of mealItems) {
        const lower = item.toLowerCase();
        let match = Object.keys(MESS_MEAL_MACROS).find(k => lower.includes(k));
        if (match) {
          const m = MESS_MEAL_MACROS[match];
          cal += m.calories; pro += m.protein; car += m.carbs; fat += m.fats;
        }
      }
      return { calories: cal || 400, protein: pro || 10, carbs: car || 60, fats: fat || 10 }; // Fallbacks
    };

    items.push({
      id: uuidv4(),
      dayOfWeek: day,
      mealType: 'breakfast',
      items: mealPlan.breakfast,
      estimatedMacros: calcMacros(mealPlan.breakfast),
    });

    items.push({
      id: uuidv4(),
      dayOfWeek: day,
      mealType: 'lunch',
      items: mealPlan.lunch,
      estimatedMacros: calcMacros(mealPlan.lunch),
    });

    items.push({
      id: uuidv4(),
      dayOfWeek: day,
      mealType: 'dinner',
      items: mealPlan.dinner,
      estimatedMacros: calcMacros(mealPlan.dinner),
    });
  }
  
  return items;
}

const VENDOR_LIBRARY: Array<{ name: string; location: string; category: string; calories: number; protein: number; carbs: number; fats: number; priceMin: number; priceMax: number; isVeg: boolean; temperature?: string }> = [
  { name: 'Dates Shake', location: 'CCD, New CC Road', category: 'beverage', calories: 280, protein: 6, carbs: 45, fats: 10, priceMin: 50, priceMax: 70, isVeg: true, temperature: 'cold' },
  { name: 'Iced Coffee', location: 'CCD, New CC Road', category: 'beverage', calories: 180, protein: 4, carbs: 28, fats: 7, priceMin: 80, priceMax: 100, isVeg: true, temperature: 'cold' },
  { name: 'Chocolate Smoothie', location: 'CCD, New CC Road', category: 'beverage', calories: 350, protein: 10, carbs: 50, fats: 14, priceMin: 90, priceMax: 110, isVeg: true, temperature: 'cold' },
  { name: 'Cold Cuppacino', location: 'CCD, New CC Road', category: 'beverage', calories: 220, protein: 8, carbs: 30, fats: 8, priceMin: 70, priceMax: 90, isVeg: true, temperature: 'cold' },
  { name: 'Nescafé Ice', location: 'Nesci Stall', category: 'beverage', calories: 150, protein: 3, carbs: 32, fats: 3, priceMin: 30, priceMax: 40, isVeg: true, temperature: 'cold' },
  { name: 'Mango Lassi', location: 'Near Library', category: 'beverage', calories: 250, protein: 10, carbs: 38, fats: 8, priceMin: 40, priceMax: 50, isVeg: true, temperature: 'cold' },
  { name: 'Butter Croissant', location: 'CCD', category: 'snack', calories: 320, protein: 6, carbs: 35, fats: 18, priceMin: 60, priceMax: 80, isVeg: true },
  { name: 'Chocolate Muffin', location: 'CCD', category: 'snack', calories: 380, protein: 5, carbs: 45, fats: 20, priceMin: 50, priceMax: 70, isVeg: true },
  { name: 'Veg Sandwich', location: 'Nesci Stall', category: 'snack', calories: 280, protein: 8, carbs: 35, fats: 12, priceMin: 40, priceMax: 50, isVeg: true },
  { name: 'Grilled Cheese Sandwich', location: 'Nesci Stall', category: 'snack', calories: 350, protein: 12, carbs: 30, fats: 20, priceMin: 50, priceMax: 60, isVeg: true },
  { name: 'Chicken Sandwich', location: 'Nesci Stall', category: 'snack', calories: 380, protein: 20, carbs: 28, fats: 22, priceMin: 60, priceMax: 80, isVeg: false },
  { name: 'Chicken Roll', location: 'Near Gate 3', category: 'snack', calories: 420, protein: 22, carbs: 35, fats: 24, priceMin: 70, priceMax: 90, isVeg: false },
  { name: 'Egg Roll', location: 'Near Gate 3', category: 'snack', calories: 380, protein: 18, carbs: 32, fats: 22, priceMin: 50, priceMax: 70, isVeg: false },
  { name: 'Veg Frankie', location: 'Near Gate 3', category: 'snack', calories: 320, protein: 10, carbs: 40, fats: 14, priceMin: 40, priceMax: 60, isVeg: true },
  { name: 'Chicken Frankie', location: 'Near Gate 3', category: 'snack', calories: 450, protein: 24, carbs: 35, fats: 26, priceMin: 70, priceMax: 90, isVeg: false },
  { name: 'Grilled Chicken', location: 'Near Gate 3', category: 'snack', calories: 320, protein: 28, carbs: 12, fats: 20, priceMin: 80, priceMax: 120, isVeg: false },
  { name: 'French Fries', location: 'Near Gate 3', category: 'snack', calories: 280, protein: 3, carbs: 40, fats: 12, priceMin: 40, priceMax: 60, isVeg: true },
  { name: 'Peri Peri Fries', location: 'Near Gate 3', category: 'snack', calories: 300, protein: 3, carbs: 42, fats: 14, priceMin: 50, priceMax: 70, isVeg: true },
];

export function loadVendorLibrary(): VendorItem[] {
  return VENDOR_LIBRARY.map(v => ({
    id: uuidv4(),
    name: v.name,
    location: v.location,
    category: v.category as any,
    macros: {
      calories: v.calories,
      protein: v.protein,
      carbs: v.carbs,
      fats: v.fats,
    },
    priceRange: { min: v.priceMin, max: v.priceMax },
    isVeg: v.isVeg,
    temperature: v.temperature as any,
  }));
}