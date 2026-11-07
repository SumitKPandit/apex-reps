import type { CalculatedMacros } from "@/utils/foodMacros";

export interface DietPlanFoodItem {
  id: string;
  food_item_id: string;
  quantity_g: number;
  macros: CalculatedMacros;
  foodItem?: {
    id: string;
    name: string;
    calories_per_100g: number;
    protein_g_per_100g: number;
    carbs_g_per_100g: number;
    fat_g_per_100g: number;
    fiber_g_per_100g: number;
  };
}

export interface DietPlanMeal {
  id: string;
  name: string;
  display_order: number;
  items: DietPlanFoodItem[];
}

export interface DietPlanWithMeals {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  meals: DietPlanMeal[];
}

export interface DietPlanLog {
  id: string;
  food_item_id: string;
  consumed: boolean;
  consumed_at: string | null;
  macros?: CalculatedMacros;
}
