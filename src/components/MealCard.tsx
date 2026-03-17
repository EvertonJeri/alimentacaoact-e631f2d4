import { motion } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";

export interface FoodItem {
  id: string;
  name: string;
  grams: number;
  calories: number;
}

export interface Meal {
  id: string;
  title: string;
  time: string;
  items: FoodItem[];
  planned?: boolean;
}

interface MealCardProps {
  meal: Meal;
  index: number;
  isLast: boolean;
  onEdit: (meal: Meal) => void;
  onDelete: (mealId: string) => void;
}

const MealCard = ({ meal, index, isLast, onEdit, onDelete }: MealCardProps) => {
  const totalCal = meal.items.reduce((s, i) => s + i.calories, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.2, 0, 0, 1] }}
      className="group relative flex gap-4 pb-8"
    >
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 h-[calc(100%-8px)] w-[1px] bg-border" />
      )}

      {/* Timeline dot */}
      <div
        className={`relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-background ${
          meal.planned
            ? "bg-muted ring-1 ring-border"
            : "bg-foreground"
        }`}
      >
        {!meal.planned && (
          <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
        )}
      </div>

      {/* Card */}
      <div className="flex-1 rounded-xl bg-card p-4 shadow-card transition-all duration-150 hover:shadow-card-hover hover:scale-[1.01] cursor-default">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-sm font-semibold text-foreground">{meal.title}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">{meal.time}</span>
            <button
              onClick={() => onEdit(meal)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              onClick={() => onDelete(meal.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        </div>

        <ul className="space-y-1.5">
          {meal.items.map((item) => (
            <li key={item.id} className="flex justify-between text-xs text-muted-foreground">
              <span>
                {item.name} ({item.grams}g)
              </span>
              <span className="tabular-nums font-medium">{item.calories} kcal</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 pt-2 border-t border-border flex justify-end">
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {totalCal} kcal
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default MealCard;
