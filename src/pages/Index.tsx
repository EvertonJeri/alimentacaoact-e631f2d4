import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DailyHeader from "@/components/DailyHeader";
import MealCard from "@/components/MealCard";
import type { Meal } from "@/components/MealCard";
import AddFoodDrawer from "@/components/AddFoodDrawer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SAMPLE_MEALS: Meal[] = [
  {
    id: "1",
    title: "Café da Manhã",
    time: "07:30",
    items: [
      { id: "a", name: "Aveia", grams: 50, calories: 195 },
      { id: "b", name: "Banana", grams: 120, calories: 107 },
      { id: "c", name: "Whey Protein", grams: 30, calories: 120 },
    ],
  },
  {
    id: "2",
    title: "Almoço",
    time: "12:45",
    items: [
      { id: "d", name: "Frango Grelhado", grams: 150, calories: 248 },
      { id: "e", name: "Arroz Integral", grams: 120, calories: 148 },
      { id: "f", name: "Brócolis", grams: 100, calories: 34 },
    ],
  },
  {
    id: "3",
    title: "Lanche da Tarde",
    time: "16:00",
    planned: true,
    items: [
      { id: "g", name: "Iogurte Natural", grams: 170, calories: 100 },
      { id: "h", name: "Aveia", grams: 30, calories: 117 },
    ],
  },
];

const GOALS = { calories: 2200, protein: 160, carbs: 250, fat: 70 };

const Index = () => {
  const [meals, setMeals] = useState<Meal[]>(SAMPLE_MEALS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const totals = useMemo(() => {
    const cal = meals.reduce(
      (s, m) => s + m.items.reduce((ss, i) => ss + i.calories, 0),
      0
    );
    return { calories: cal, protein: 98, carbs: 142, fat: 38 };
  }, [meals]);

  const handleSave = useCallback(
    (data: Omit<Meal, "id">) => {
      if (editMeal) {
        setMeals((prev) =>
          prev.map((m) => (m.id === editMeal.id ? { ...m, ...data } : m))
        );
      } else {
        setMeals((prev) => [
          ...prev,
          { ...data, id: crypto.randomUUID() },
        ].sort((a, b) => a.time.localeCompare(b.time)));
      }
      setEditMeal(null);
    },
    [editMeal]
  );

  const handleDelete = useCallback((id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleEdit = useCallback((meal: Meal) => {
    setEditMeal(meal);
    setDrawerOpen(true);
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setEditMeal(null);
        setDrawerOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const changeDay = (offset: number) => {
    setSelectedDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + offset);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <DailyHeader
        calories={totals.calories}
        calorieGoal={GOALS.calories}
        protein={totals.protein}
        proteinGoal={GOALS.protein}
        carbs={totals.carbs}
        carbsGoal={GOALS.carbs}
        fat={totals.fat}
        fatGoal={GOALS.fat}
      />

      {/* Date navigation */}
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => changeDay(-1)}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="text-sm font-medium gap-2">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => changeDay(1)}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Timeline */}
      <div className="max-w-2xl mx-auto px-4 pb-24">
        <AnimatePresence mode="wait">
          {meals.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-sm text-muted-foreground">
                Nenhuma refeição registrada hoje.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Pressione <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-2xs font-mono">N</kbd> para adicionar.
              </p>
            </motion.div>
          ) : (
            meals.map((meal, i) => (
              <MealCard
                key={meal.id}
                meal={meal}
                index={i}
                isLast={i === meals.length - 1}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-30">
        <Button
          onClick={() => {
            setEditMeal(null);
            setDrawerOpen(true);
          }}
          className="h-12 px-5 rounded-full bg-foreground text-background hover:bg-foreground/90 shadow-lg gap-2"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Adicionar</span>
        </Button>
      </div>

      <AddFoodDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSave={handleSave}
        editMeal={editMeal}
      />
    </div>
  );
};

export default Index;
