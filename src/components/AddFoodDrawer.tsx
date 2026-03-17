import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Meal, FoodItem } from "./MealCard";

interface AddFoodDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (meal: Omit<Meal, "id">) => void;
  editMeal?: Meal | null;
}

const FOOD_DB = [
  { name: "Frango Grelhado", calPer100g: 165, protPer100g: 31, carbPer100g: 0, fatPer100g: 3.6 },
  { name: "Arroz Integral", calPer100g: 123, protPer100g: 2.7, carbPer100g: 25.6, fatPer100g: 1 },
  { name: "Brócolis", calPer100g: 34, protPer100g: 2.8, carbPer100g: 7, fatPer100g: 0.4 },
  { name: "Ovo Cozido", calPer100g: 155, protPer100g: 13, carbPer100g: 1.1, fatPer100g: 11 },
  { name: "Banana", calPer100g: 89, protPer100g: 1.1, carbPer100g: 23, fatPer100g: 0.3 },
  { name: "Aveia", calPer100g: 389, protPer100g: 16.9, carbPer100g: 66, fatPer100g: 6.9 },
  { name: "Batata Doce", calPer100g: 86, protPer100g: 1.6, carbPer100g: 20, fatPer100g: 0.1 },
  { name: "Salmão", calPer100g: 208, protPer100g: 20, carbPer100g: 0, fatPer100g: 13 },
  { name: "Iogurte Natural", calPer100g: 59, protPer100g: 10, carbPer100g: 3.6, fatPer100g: 0.7 },
  { name: "Whey Protein", calPer100g: 400, protPer100g: 80, carbPer100g: 8, fatPer100g: 4 },
];

const now = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const AddFoodDrawer = ({ open, onOpenChange, onSave, editMeal }: AddFoodDrawerProps) => {
  const [category, setCategory] = useState(editMeal?.title || "Refeição");
  const [time, setTime] = useState(editMeal?.time || now());
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<(FoodItem & { grams: number })[]>(
    editMeal?.items || []
  );
  const [selectedFood, setSelectedFood] = useState("");
  const [grams, setGrams] = useState("100");

  const filtered = FOOD_DB.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const addItem = () => {
    const food = FOOD_DB.find((f) => f.name === selectedFood);
    if (!food) return;
    const g = parseInt(grams) || 100;
    const cal = Math.round((food.calPer100g * g) / 100);
    setItems([
      ...items,
      { id: crypto.randomUUID(), name: food.name, grams: g, calories: cal },
    ]);
    setSelectedFood("");
    setGrams("100");
    setSearch("");
  };

  const removeItem = (id: string) => setItems(items.filter((i) => i.id !== id));

  const handleSave = () => {
    if (items.length === 0) return;
    onSave({ title: category, time, items });
    setItems([]);
    setCategory("Refeição");
    setTime(now());
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">
            {editMeal ? "Editar Refeição" : "Novo Lançamento"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground">
                Categoria
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Café da Manhã">Café da Manhã</SelectItem>
                  <SelectItem value="Lanche da Manhã">Lanche da Manhã</SelectItem>
                  <SelectItem value="Almoço">Almoço</SelectItem>
                  <SelectItem value="Lanche da Tarde">Lanche da Tarde</SelectItem>
                  <SelectItem value="Jantar">Jantar</SelectItem>
                  <SelectItem value="Ceia">Ceia</SelectItem>
                  <SelectItem value="Refeição">Refeição</SelectItem>
                  <SelectItem value="Lanche">Lanche</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground">
                Horário
              </Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5 tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground">
              Buscar Alimento
            </Label>
            <Input
              placeholder="Digite para buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm"
            />
            {search && (
              <div className="border border-border rounded-lg max-h-40 overflow-y-auto">
                {filtered.map((food) => (
                  <button
                    key={food.name}
                    onClick={() => {
                      setSelectedFood(food.name);
                      setSearch(food.name);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex justify-between ${
                      selectedFood === food.name ? "bg-muted" : ""
                    }`}
                  >
                    <span>{food.name}</span>
                    <span className="text-muted-foreground tabular-nums text-xs">
                      {food.calPer100g} kcal/100g
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground">
                Gramas
              </Label>
              <Input
                type="number"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                className="mt-1.5 tabular-nums"
                min="1"
              />
            </div>
            <Button
              onClick={addItem}
              disabled={!selectedFood}
              className="self-end bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Adicionar
            </Button>
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              <Label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground">
                Itens Adicionados
              </Label>
              <div className="rounded-lg border border-border divide-y divide-border">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="text-foreground">
                      {item.name} ({item.grams}g)
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-xs text-muted-foreground font-medium">
                        {item.calories} kcal
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={items.length === 0}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Salvar Refeição
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddFoodDrawer;
