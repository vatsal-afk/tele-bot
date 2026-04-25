// Rajiv Bhawan Mess Weekly Menu — 20/04/2026 to 26/04/2026
// Source: Hotel Rajasthan, Rajiv Bhawan Mess, IIT Roorkee

export interface MessMeal {
  day: string;
  date: string;
  breakfast: string[];
  lunch: string[];
  dinner: string[];
}

// Items available daily at every meal
export const DAILY_BREAKFAST = [
  'Milk 250ml', 'Tea', 'Coffee', 'Bread White & Brown', 'Dalia',
  'Sprouts', 'Bournvita', 'Banana', 'Butter/Egg', 'Peanut Butter/Jam',
];
export const DAILY_LUNCH_SIDES = [
  'Salad/Onion', 'Hari Mirch', 'Lemon', 'Butter Roti', 'Rice',
  'Saunf', 'Achar', 'Sambhar/Rasam',
];
export const DAILY_DINNER_SIDES = [
  'Salad/Onion', 'Butter Roti', 'Hari Mirch', 'Lemon', 'Rice',
  'Saunf', 'Achar', 'Sambhar/Rasam',
];

export const WEEKLY_MENU: MessMeal[] = [
  {
    day: 'Monday', date: '2026-04-20',
    breakfast: ['Suji Halwa', 'Kala Chana', 'Cornflakes', 'Chocos'],
    lunch: ['Dal Navratan', 'Alu Kundru', 'Lauki Chana', 'Tomato Rice', 'Musk Melon', 'Dahi', 'Nimbu Pani'],
    dinner: ['Dal Chana Tadka', 'Mix Veg', 'Dum Alu', 'Veg Pulaw', 'Ice Cream Strawberry'],
  },
  {
    day: 'Tuesday', date: '2026-04-21',
    breakfast: ['Plain/Fried Idli', 'Sambhar', 'Nariyal Chutney', 'Cornflakes'],
    lunch: ['Dal Moong Masoor', 'Soyabeen Curry', 'Gobhi Matar Sabji', 'Coriander Rice', 'Watermelon', 'Masala Chaas'],
    dinner: ['Chole Stuffed Poori', 'Alu Tomato Curry', 'Jeera Rice', 'Rice Kheer'],
  },
  {
    day: 'Wednesday', date: '2026-04-22',
    breakfast: ['Maggi Fried & Soup', 'Tomato Sauce', 'Cornflakes'],
    lunch: ['Kadhi Palak Pakodi', 'Dal Masoor Kali', 'Alu Brown Pyaz', 'Matar Rice', 'Roohafza', 'Fryms', 'Papaya'],
    dinner: ['Kadhai Paneer / Kadhai Chicken', 'Dal Makhani', 'Jeera Rice', 'Gulab Jamun'],
  },
  {
    day: 'Thursday', date: '2026-04-23',
    breakfast: ['Moong Chilla', 'Green Chutney', 'Imli Chutney', 'Cornflakes/Chocos'],
    lunch: ['Dal Chana Tadaka', 'Cabbage Matar', 'Kala Chana Curry', 'Fried Rice', 'Lassi', 'Musk Melon', 'Jal Jeera'],
    dinner: ['Dal Arhar Fry', 'Bhindi Fry', 'Dahi Alu', 'Matar Pulaw', 'Till Laddu'],
  },
  {
    day: 'Friday', date: '2026-04-24',
    breakfast: ['Vada Pav', 'Green Chutney', 'Imli Chutney', 'Cornflakes'],
    lunch: ['Dal Panchratan', 'Veg Korma', 'Karela Fry', 'Carrot Rice', 'Watermelon', 'Milk Roohafza'],
    dinner: ['Dal Chana Malka', 'Soya Chap / Egg Rice', 'Coriander Rice', 'Boondi Raita', 'Mix Ice Cream'],
  },
  {
    day: 'Saturday', date: '2026-04-25',
    breakfast: ['Dosa', 'Sambhar', 'Nariyal Chutney', 'Cornflakes'],
    lunch: ['Chole Bhatura', 'Alu Matar Curry', 'Fried Rice', 'Boondi Raita', 'Nimbu Pani', 'Pineapple'],
    dinner: ['Dal Moong Palak', 'Soya Keema', 'Veg Kofta', 'Veg Khichdi', 'Besan Laddu'],
  },
  {
    day: 'Sunday', date: '2026-04-26',
    breakfast: ['Alu Piyaz Paratha', 'Alu Tomato Curry', 'Green Chutney', 'Cornflakes', 'Chocos'],
    lunch: ['Rajma Masala', 'Alu Baigan', 'Jeera Rice', 'Fruit Custard', 'Jal Jeera'],
    dinner: ['Paneer Lababdar / Chicken Biryani', 'Dal Makhani', 'Matar Rice', 'Boondi Raita', 'Ice Cream Chocolate'],
  },
];

// Standard mess meal macro estimates (ICMR-NIN based, per full meal)
// Includes roti/rice + sabzi + dal + sides
export const MESS_MEAL_MACROS: Record<string, { calories: number; protein: number; carbs: number; fats: number }> = {
  // Breakfast specials
  'suji halwa': { calories: 200, protein: 3, carbs: 34, fats: 7 },
  'kala chana': { calories: 160, protein: 10, carbs: 24, fats: 3 },
  'plain idli': { calories: 80, protein: 3, carbs: 16, fats: 1 },
  'fried idli': { calories: 150, protein: 4, carbs: 20, fats: 6 },
  'sambhar': { calories: 120, protein: 6, carbs: 18, fats: 3 },
  'maggi fried': { calories: 300, protein: 8, carbs: 42, fats: 12 },
  'moong chilla': { calories: 180, protein: 10, carbs: 22, fats: 6 },
  'vada pav': { calories: 290, protein: 6, carbs: 36, fats: 13 },
  'dosa': { calories: 180, protein: 5, carbs: 28, fats: 6 },
  'alu piyaz paratha': { calories: 300, protein: 6, carbs: 38, fats: 14 },
  'cornflakes': { calories: 160, protein: 3, carbs: 34, fats: 1 },
  'dalia': { calories: 180, protein: 6, carbs: 30, fats: 4 },
  'sprouts': { calories: 120, protein: 8, carbs: 16, fats: 2 },
  // Dals
  'dal navratan': { calories: 200, protein: 10, carbs: 28, fats: 6 },
  'dal moong masoor': { calories: 180, protein: 11, carbs: 26, fats: 4 },
  'dal masoor kali': { calories: 175, protein: 10, carbs: 26, fats: 4 },
  'dal chana tadka': { calories: 190, protein: 10, carbs: 28, fats: 5 },
  'dal chana tadaka': { calories: 190, protein: 10, carbs: 28, fats: 5 },
  'dal panchratan': { calories: 200, protein: 11, carbs: 28, fats: 6 },
  'dal arhar fry': { calories: 185, protein: 10, carbs: 26, fats: 5 },
  'dal chana malka': { calories: 190, protein: 10, carbs: 28, fats: 5 },
  'dal moong palak': { calories: 170, protein: 10, carbs: 24, fats: 4 },
  'dal makhani': { calories: 280, protein: 12, carbs: 28, fats: 14 },
  'kadhi palak pakodi': { calories: 200, protein: 7, carbs: 16, fats: 12 },
  'rajma masala': { calories: 260, protein: 14, carbs: 38, fats: 6 },
  // Sabzis
  'alu kundru': { calories: 160, protein: 3, carbs: 22, fats: 8 },
  'lauki chana': { calories: 140, protein: 6, carbs: 18, fats: 5 },
  'mix veg': { calories: 160, protein: 5, carbs: 20, fats: 8 },
  'dum alu': { calories: 220, protein: 4, carbs: 28, fats: 12 },
  'soyabeen curry': { calories: 200, protein: 16, carbs: 14, fats: 10 },
  'gobhi matar sabji': { calories: 150, protein: 5, carbs: 18, fats: 7 },
  'alu brown pyaz': { calories: 180, protein: 3, carbs: 24, fats: 9 },
  'cabbage matar': { calories: 130, protein: 5, carbs: 16, fats: 6 },
  'kala chana curry': { calories: 180, protein: 10, carbs: 26, fats: 4 },
  'veg korma': { calories: 220, protein: 6, carbs: 18, fats: 14 },
  'karela fry': { calories: 80, protein: 3, carbs: 10, fats: 4 },
  'alu matar curry': { calories: 200, protein: 6, carbs: 28, fats: 8 },
  'alu baigan': { calories: 170, protein: 4, carbs: 22, fats: 8 },
  'alu tomato curry': { calories: 170, protein: 3, carbs: 24, fats: 8 },
  'bhindi fry': { calories: 120, protein: 3, carbs: 14, fats: 6 },
  'dahi alu': { calories: 180, protein: 5, carbs: 22, fats: 9 },
  'soya chap': { calories: 220, protein: 18, carbs: 12, fats: 12 },
  'soya keema': { calories: 200, protein: 16, carbs: 14, fats: 10 },
  'veg kofta': { calories: 240, protein: 6, carbs: 20, fats: 16 },
  'kadhai paneer': { calories: 300, protein: 14, carbs: 12, fats: 22 },
  'kadhai chicken': { calories: 280, protein: 24, carbs: 8, fats: 18 },
  'paneer lababdar': { calories: 320, protein: 14, carbs: 14, fats: 24 },
  'chicken biryani': { calories: 500, protein: 22, carbs: 60, fats: 20 },
  'chole stuffed poori': { calories: 400, protein: 12, carbs: 52, fats: 16 },
  'chole bhatura': { calories: 450, protein: 14, carbs: 56, fats: 18 },
  // Rice varieties
  'tomato rice': { calories: 220, protein: 4, carbs: 42, fats: 4 },
  'coriander rice': { calories: 210, protein: 4, carbs: 40, fats: 4 },
  'jeera rice': { calories: 220, protein: 4, carbs: 42, fats: 5 },
  'matar rice': { calories: 230, protein: 6, carbs: 42, fats: 4 },
  'fried rice': { calories: 300, protein: 6, carbs: 48, fats: 10 },
  'carrot rice': { calories: 220, protein: 4, carbs: 42, fats: 4 },
  'veg pulaw': { calories: 280, protein: 6, carbs: 46, fats: 8 },
  'matar pulaw': { calories: 280, protein: 6, carbs: 44, fats: 8 },
  'veg khichdi': { calories: 250, protein: 10, carbs: 40, fats: 5 },
  'egg rice': { calories: 320, protein: 12, carbs: 44, fats: 10 },
  // Sides/Extras
  'butter roti': { calories: 150, protein: 3, carbs: 22, fats: 6 },
  'rice': { calories: 200, protein: 4, carbs: 44, fats: 1 },
  'dahi': { calories: 80, protein: 5, carbs: 6, fats: 4 },
  'boondi raita': { calories: 100, protein: 5, carbs: 10, fats: 5 },
  'salad': { calories: 30, protein: 1, carbs: 6, fats: 1 },
  // Fruits
  'musk melon': { calories: 35, protein: 1, carbs: 8, fats: 0 },
  'watermelon': { calories: 40, protein: 1, carbs: 10, fats: 0 },
  'papaya': { calories: 40, protein: 1, carbs: 10, fats: 0 },
  'pineapple': { calories: 50, protein: 1, carbs: 12, fats: 0 },
  'fruit custard': { calories: 200, protein: 4, carbs: 30, fats: 8 },
  'banana': { calories: 100, protein: 1, carbs: 25, fats: 0 },
  // Drinks
  'nimbu pani': { calories: 40, protein: 0, carbs: 10, fats: 0 },
  'lassi': { calories: 180, protein: 8, carbs: 24, fats: 6 },
  'masala chaas': { calories: 50, protein: 3, carbs: 6, fats: 2 },
  'roohafza': { calories: 80, protein: 0, carbs: 20, fats: 0 },
  'milk roohafza': { calories: 160, protein: 6, carbs: 26, fats: 5 },
  'jal jeera': { calories: 30, protein: 0, carbs: 8, fats: 0 },
  'milk': { calories: 150, protein: 8, carbs: 12, fats: 8 },
  'tea': { calories: 80, protein: 2, carbs: 12, fats: 3 },
  'coffee': { calories: 100, protein: 3, carbs: 14, fats: 4 },
  'bournvita': { calories: 200, protein: 8, carbs: 24, fats: 8 },
  // Sweets
  'ice cream strawberry': { calories: 180, protein: 3, carbs: 24, fats: 8 },
  'mix ice cream': { calories: 200, protein: 3, carbs: 26, fats: 9 },
  'ice cream chocolate': { calories: 200, protein: 4, carbs: 26, fats: 9 },
  'rice kheer': { calories: 200, protein: 5, carbs: 32, fats: 7 },
  'gulab jamun': { calories: 200, protein: 4, carbs: 30, fats: 8 },
  'till laddu': { calories: 180, protein: 4, carbs: 20, fats: 10 },
  'besan laddu': { calories: 200, protein: 5, carbs: 22, fats: 11 },
};

// Get today's mess menu
export function getTodayMessMenu(): MessMeal | null {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return WEEKLY_MENU.find(m => m.day === dayName) || null;
}
