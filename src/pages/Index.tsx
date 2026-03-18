import { useState } from "react";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Clock, Utensils, AlertTriangle, UtensilsCrossed, LayoutDashboard, Beaker } from "lucide-react";
import TimeRegistrationTab from "@/components/TimeRegistrationTab";
import MealRequestTab from "@/components/MealRequestTab";
import FoodControlTab from "@/components/FoodControlTab";
import DiscountsTab from "@/components/DiscountsTab";
import PanelTab from "@/components/PanelTab";
import TesteHojeTab from "@/components/TesteHojeTab";
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

  const [activePage, setActivePage] = useState("painel");

  const renderContent = () => {
    switch (activePage) {
      case "painel":
        return <PanelTab />;
      case "testehoje":
        return <TesteHojeTab />;
      case "horas":
        return (
          <TimeRegistrationTab
            entries={timeEntries}
            setEntries={setTimeEntries}
            people={SAMPLE_PEOPLE}
            jobs={SAMPLE_JOBS}
          />
        );
      case "refeicoes":
        return (
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
        );
      case "controle":
        return (
          <FoodControlTab
            people={SAMPLE_PEOPLE}
            jobs={SAMPLE_JOBS}
            requests={mealRequests}
            timeEntries={timeEntries}
            foodControl={foodControl}
            setFoodControl={setFoodControl}
          />
        );
      case "descontos":
        return (
          <DiscountsTab
            people={SAMPLE_PEOPLE}
            jobs={SAMPLE_JOBS}
            requests={mealRequests}
            timeEntries={timeEntries}
            foodControl={foodControl}
            confirmations={discountConfirmations}
            setConfirmations={setDiscountConfirmations}
          />
        );
      default:
        return <PanelTab />;
    }
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Menu Principal</h2>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="px-2 space-y-1">
            <SidebarMenuItem>
              <SidebarMenuButton isActive={activePage === "painel"} onClick={() => setActivePage("painel")}>
                <LayoutDashboard className="h-4 w-4" />
                <span>Painel</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={activePage === "testehoje"} onClick={() => setActivePage("testehoje")}>
                <Beaker className="h-4 w-4" />
                <span>Teste hoje</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={activePage === "horas"} onClick={() => setActivePage("horas")}>
                <Clock className="h-4 w-4" />
                <span>Registro de Horas</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={activePage === "refeicoes"} onClick={() => setActivePage("refeicoes")}>
                <Utensils className="h-4 w-4" />
                <span>Solicitação de Refeições</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={activePage === "controle"} onClick={() => setActivePage("controle")}>
                <UtensilsCrossed className="h-4 w-4" />
                <span>Controle de Alimentação</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={activePage === "descontos"} onClick={() => setActivePage("descontos")}>
                <AlertTriangle className="h-4 w-4" />
                <span>Descontos</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex min-h-screen flex-col bg-background relative max-w-full overflow-hidden">
          <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 py-4 backdrop-blur-sm">
            <SidebarTrigger className="-ml-1" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Controle de Montagem
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                Registro de horas, solicitação de refeições, controle de alimentação e descontos
              </p>
            </div>
          </header>
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 overflow-x-hidden">
            <div className="animate-in fade-in zoom-in-95 duration-200 w-full min-w-0">
              {renderContent()}
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Index;
