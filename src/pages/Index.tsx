import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Utensils, AlertTriangle, UtensilsCrossed } from "lucide-react";
import TimeRegistrationTab from "@/components/TimeRegistrationTab";
import MealRequestTab from "@/components/MealRequestTab";
import FoodControlTab from "@/components/FoodControlTab";
import DiscountsTab from "@/components/DiscountsTab";
import {
  type TimeEntry,
  type MealRequest,
  type FoodControlEntry,
  type DiscountConfirmation,
  SAMPLE_PEOPLE,
  SAMPLE_JOBS,
} from "@/lib/types";

const Index = () => {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [mealRequests, setMealRequests] = useState<MealRequest[]>([]);
  const [foodControl, setFoodControl] = useState<FoodControlEntry[]>([]);
  const [discountConfirmations, setDiscountConfirmations] = useState<DiscountConfirmation[]>([]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Controle de Montagem
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registro de horas, solicitação de refeições, controle de alimentação e descontos
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="horas" className="space-y-6">
          <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="horas" className="gap-1.5 text-sm">
              <Clock className="h-3.5 w-3.5" />
              Registro de Horas
            </TabsTrigger>
            <TabsTrigger value="refeicoes" className="gap-1.5 text-sm">
              <Utensils className="h-3.5 w-3.5" />
              Solicitação de Refeições
            </TabsTrigger>
            <TabsTrigger value="controle" className="gap-1.5 text-sm">
              <UtensilsCrossed className="h-3.5 w-3.5" />
              Controle de Alimentação
            </TabsTrigger>
            <TabsTrigger value="descontos" className="gap-1.5 text-sm">
              <AlertTriangle className="h-3.5 w-3.5" />
              Descontos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="horas">
            <TimeRegistrationTab
              entries={timeEntries}
              setEntries={setTimeEntries}
              people={SAMPLE_PEOPLE}
              jobs={SAMPLE_JOBS}
            />
          </TabsContent>

          <TabsContent value="refeicoes">
            <MealRequestTab
              people={SAMPLE_PEOPLE}
              jobs={SAMPLE_JOBS}
              timeEntries={timeEntries}
              requests={mealRequests}
              setRequests={setMealRequests}
              onGenerateEntries={(newEntries) =>
                setTimeEntries((prev) => [...prev, ...newEntries])
              }
            />
          </TabsContent>

          <TabsContent value="controle">
            <FoodControlTab
              people={SAMPLE_PEOPLE}
              jobs={SAMPLE_JOBS}
              requests={mealRequests}
              timeEntries={timeEntries}
              foodControl={foodControl}
              setFoodControl={setFoodControl}
            />
          </TabsContent>

          <TabsContent value="descontos">
            <DiscountsTab
              people={SAMPLE_PEOPLE}
              jobs={SAMPLE_JOBS}
              requests={mealRequests}
              timeEntries={timeEntries}
              foodControl={foodControl}
              confirmations={discountConfirmations}
              setConfirmations={setDiscountConfirmations}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
