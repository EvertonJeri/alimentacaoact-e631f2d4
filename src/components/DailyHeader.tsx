import { Progress } from "@/components/ui/progress";

interface MacroProps {
  label: string;
  value: number;
  goal: number;
  unit: string;
}

const MacroStat = ({ label, value, goal, unit }: MacroProps) => (
  <div className="flex flex-col gap-1">
    <span className="text-2xs uppercase tracking-wider font-medium text-muted-foreground">
      {label}
    </span>
    <div className="flex items-baseline gap-1">
      <span className="text-lg font-semibold tracking-tighter tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-2xs text-muted-foreground tabular-nums">
        / {goal}{unit}
      </span>
    </div>
  </div>
);

interface DailyHeaderProps {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
}

const DailyHeader = ({
  calories, calorieGoal,
  protein, proteinGoal,
  carbs, carbsGoal,
  fat, fatGoal,
}: DailyHeaderProps) => {
  const pct = Math.min((calories / calorieGoal) * 100, 100);

  return (
    <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-2xs uppercase tracking-wider font-medium text-muted-foreground">
              Calorias
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tracking-tighter tabular-nums text-foreground">
                {calories}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                / {calorieGoal} kcal
              </span>
            </div>
          </div>
        </div>
        <Progress value={pct} className="h-1 mb-4" />
        <div className="grid grid-cols-3 gap-6">
          <MacroStat label="Proteína" value={protein} goal={proteinGoal} unit="g" />
          <MacroStat label="Carboidratos" value={carbs} goal={carbsGoal} unit="g" />
          <MacroStat label="Gordura" value={fat} goal={fatGoal} unit="g" />
        </div>
      </div>
    </div>
  );
};

export default DailyHeader;
