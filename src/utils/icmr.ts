import type { UserProfile } from '../db/index.js';

export interface ICMRTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  waterMl: number;
}

export function computeICMRTargets(profile: Partial<UserProfile>): ICMRTargets {
  const { weight = 60, height = 170, age = 20, sex = 'male', activityLevel = 1.55, fitnessGoal = 'maintenance' } = profile;

  const bmr = sex === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const tdee = bmr * activityLevel;

  let calories: number;
  switch (fitnessGoal) {
    case 'weight-loss':
      calories = Math.round(tdee - 500);
      break;
    case 'muscle-gain':
      calories = Math.round(tdee + 300);
      break;
    default:
      calories = Math.round(tdee);
  }

  const protein = fitnessGoal === 'muscle-gain'
    ? Math.round(weight * 1.2)
    : Math.round(weight * 1.0);

  const carbs = Math.round((calories * 0.55) / 4);
  const fats = Math.round((calories * 0.275) / 9);
  const waterMl = Math.round(weight * 33);

  return { calories, protein, carbs, fats, waterMl };
}

export function getNutritionalGap(
  logged: { calories: number; protein: number; carbs: number; fats: number },
  targets: ICMRTargets
): { calories: number; protein: number; carbs: number; fats: number } {
  return {
    calories: targets.calories - logged.calories,
    protein: targets.protein - logged.protein,
    carbs: targets.carbs - logged.carbs,
    fats: targets.fats - logged.fats,
  };
}

export function formatGapSummary(gap: { calories: number; protein: number; carbs: number; fats: number }): string {
  const parts: string[] = [];
  
  if (gap.protein > 0) parts.push(`${gap.protein}g protein short`);
  else if (gap.protein < 0) parts.push(`${Math.abs(gap.protein)}g protein over`);
  
  if (gap.calories > 0) parts.push(`${gap.calories}kcal short`);
  else if (gap.calories < 0) parts.push(`${Math.abs(gap.calories)}kcal over`);
  
  parts.push(`${gap.carbs}g carbs`);
  parts.push(`${gap.fats}g fats`);
  
  return parts.join(', ');
}