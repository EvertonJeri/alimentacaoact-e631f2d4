import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Utensils } from "lucide-react";
import TimeRegistrationTab from "@/components/TimeRegistrationTab";
import MealRequestTab from "@/components/MealRequestTab";
import { type TimeEntry, SAMPLE_PEOPLE, SAMPLE_JOBS } from "@/lib/types";

const Index = () => {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Controle de Montagem
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registro de horas e solicitação de refeições
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="horas" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="horas" className="gap-1.5 text-sm">
              <Clock className="h-3.5 w-3.5" />
              Registro de Horas
            </TabsTrigger>
            <TabsTrigger value="refeicoes" className="gap-1.5 text-sm">
              <Utensils className="h-3.5 w-3.5" />
              Solicitação de Refeições
            </TabsTrigger>
          </TabsList>

          <TabsContent value="horas">
            <TimeRegistrationTab
              entries={timeEntries}
              setEntries={setTimeEntries}
              people={SAMPLE_PEOPLE}
            />
          </TabsContent>

          <TabsContent value="refeicoes">
            <MealRequestTab
              people={SAMPLE_PEOPLE}
              jobs={SAMPLE_JOBS}
              timeEntries={timeEntries}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
