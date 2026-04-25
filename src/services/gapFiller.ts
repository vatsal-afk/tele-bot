import type { CanteenItem, VendorItem } from '../db/index.js';

export interface GapValues {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface GapScore {
  itemId: string;
  itemName: string;
  cost: number;
  category: string;
  gapClosure: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  efficiency: {
    caloriesPerRupee: number;
    proteinPerRupee: number;
  };
  finalScore: number;
}

export interface Constraint {
  type: 'price-ceiling' | 'category-exclude' | 'temperature' | 'quantity';
  value: string | number;
}

const PRIORITY_WEIGHTS = {
  'weight-loss': { protein: 0.5, calories: 0.5 },
  'muscle-gain': { protein: 0.7, calories: 0.3 },
  'maintenance': { protein: 0.4, calories: 0.4, budget: 0.2 },
};

export function scoreItem(
  item: CanteenItem,
  gap: GapValues,
  goal: 'weight-loss' | 'muscle-gain' | 'maintenance',
  budgetRemaining: number
): GapScore {
  const weights = PRIORITY_WEIGHTS[goal] || PRIORITY_WEIGHTS['maintenance'];

  const caloriesGapClosed = Math.max(0, Math.min(gap.calories > 0 ? gap.calories : 0, item.adjustedMacros.calories));
  const proteinGapClosed = Math.max(0, Math.min(gap.protein > 0 ? gap.protein : 0, item.adjustedMacros.protein));

  const caloriesPerRupee = item.price > 0 ? item.adjustedMacros.calories / item.price : 0;
  const proteinPerRupee = item.price > 0 ? item.adjustedMacros.protein / item.price : 0;

  const proteinGoalWeight = goal === 'muscle-gain' ? 0.7 : goal === 'weight-loss' ? 0.5 : 0.4;
  const calorieGoalWeight = goal === 'weight-loss' ? 0.5 : 0.3;

  const normalizedProteinScore = gap.protein > 0 
    ? (proteinGapClosed / gap.protein) * proteinGoalWeight 
    : 0;
  const normalizedCalorieScore = gap.calories > 0 
    ? (caloriesGapClosed / gap.calories) * calorieGoalWeight 
    : 0;

  const budgetScore = budgetRemaining >= item.price ? 0.2 : -0.5;

  const finalScore = normalizedProteinScore + normalizedCalorieScore + budgetScore;

  return {
    itemId: item.id,
    itemName: item.name,
    cost: item.price,
    category: item.category,
    gapClosure: {
      calories: caloriesGapClosed,
      protein: proteinGapClosed,
      carbs: 0,
      fats: 0,
    },
    efficiency: {
      caloriesPerRupee,
      proteinPerRupee,
    },
    finalScore,
  };
}

export function filterByConstraints(
  items: CanteenItem[],
  constraints: Constraint[]
): CanteenItem[] {
  let filtered = [...items];

  for (const constraint of constraints) {
    switch (constraint.type) {
      case 'price-ceiling':
        filtered = filtered.filter(i => i.price <= (constraint.value as number));
        break;
      case 'category-exclude':
        const excludeCat = constraint.value as string;
        if (excludeCat === 'non-veg') {
          filtered = filtered.filter(i => i.isVeg);
        } else if (excludeCat === 'egg') {
          filtered = filtered.filter(i => i.category !== 'egg');
        } else if (excludeCat === 'chicken') {
          filtered = filtered.filter(i => i.category !== 'chicken');
        }
        break;
      case 'temperature':
        if (constraint.value !== 'any') {
          filtered = filtered.filter(i => 
            i.temperature === 'both' || i.temperature === constraint.value
          );
        }
        break;
    }
  }

  return filtered;
}

export function rankItems(
  canteenItems: CanteenItem[],
  gap: GapValues,
  goal: string,
  budgetRemaining: number,
  constraints: Constraint[]
): GapScore[] {
  const filteredItems = filterByConstraints(canteenItems, constraints);

  const scoredItems = filteredItems.map(item => 
    scoreItem(item, gap, goal as any, budgetRemaining)
  );

  return scoredItems
    .filter(s => s.finalScore > 0)
    .sort((a, b) => b.finalScore - a.finalScore);
}

export function generateSuggestion(
  topItem: GapScore,
  gap: GapValues,
  cheapAlternative?: GapScore
): {
  message: string;
  primary: GapScore;
  alternative?: GapScore;
  remainingGap: GapValues;
} {
  return {
    message: `You're ${gap.protein}g protein short. ${topItem.itemName} (₹${topItem.cost}) closes ${topItem.gapClosure.protein}g of your protein gap.`,
    primary: topItem,
    alternative: cheapAlternative,
    remainingGap: {
      calories: gap.calories - topItem.gapClosure.calories,
      protein: gap.protein - topItem.gapClosure.protein,
      carbs: gap.carbs - topItem.gapClosure.carbs,
      fats: gap.fats - topItem.gapClosure.fats,
    },
  };
}

export function checkBudgetAndSuggestAlternative(
  item: GapScore,
  budgetRemaining: number,
  allRankedItems: GapScore[]
): {
  canProceed: boolean;
  message?: string;
  alternative?: GapScore;
} {
  if (item.cost <= budgetRemaining) {
    return { canProceed: true };
  }

  const alternative = allRankedItems.find(i => i.cost <= budgetRemaining);

  if (alternative) {
    return {
      canProceed: false,
      message: `⚠️ ${item.itemName} (₹${item.cost}) exceeds your ₹${budgetRemaining} budget. Try ${alternative.itemName} (₹${alternative.cost}) instead?`,
      alternative,
    };
  }

  return {
    canProceed: false,
    message: `This exceeds your budget. Remaining: ₹${budgetRemaining}`,
  };
}

export function calculateCaloriesBurned(
  exerciseType: string,
  durationMinutes: number,
  weightKg: number,
  sets?: number,
  reps?: number
): number {
  const metValues: Record<string, number> = {
    'gym': 5.0,
    'weightlifting': 4.5,
    'cardio': 7.0,
    'running': 8.0,
    'cycling': 6.0,
    'walk': 3.5,
    'swimming': 8.0,
    'yoga': 2.5,
  };

  const met = metValues[exerciseType.toLowerCase()] || 4.0;
  let calories = met * weightKg * (durationMinutes / 60);

  if (sets && reps) {
    const compoundExercises = ['bench', 'squat', 'deadlift', 'overhead press'];
    const isCompound = compoundExercises.some(e => exerciseType.toLowerCase().includes(e));
    const baseMultiplier = isCompound ? 0.5 : 0.3;
    calories += sets * reps * weightKg * baseMultiplier * 0.01;
  }

  return Math.round(calories);
}

export function formatSuggestionMessage(suggestion: ReturnType<typeof generateSuggestion>): string {
  let msg = `${suggestion.message}\n\n`;
  msg += `Item: ${suggestion.primary.itemName}\n`;
  msg += `Cost: ₹${suggestion.primary.cost}\n`;
  msg += `Protein: ${suggestion.primary.gapClosure.protein}g | Calories: ${suggestion.primary.gapClosure.calories}kcal\n`;

  if (suggestion.alternative) {
    msg += `\nCheaper option: ${suggestion.alternative.itemName} (₹${suggestion.alternative.cost})`;
  }

  return msg;
}