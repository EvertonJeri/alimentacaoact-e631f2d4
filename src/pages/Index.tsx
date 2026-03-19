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

import { useDatabase } from "@/hooks/use-database";
import { Loader2 } from "lucide-react";

const Index = () => {
  const {
    people,
    jobs,
    timeEntries,
    mealRequests,
    foodControl,
    discountConfirmations,
    updateFoodControl,
    updateDiscountConfirmation,
    updateTimeEntry,
    updateMealRequest
  } = useDatabase();

  const [activePage, setActivePage] = useState("painel");

  if (people.isLoading || jobs.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderContent = () => {
    const peopleData = people.data || [];
    const jobsData = jobs.data || [];
    const timeEntriesData = timeEntries.data || [];
    const mealRequestsData = mealRequests.data || [];
    const foodControlData = foodControl.data || [];
    const confirmationsData = discountConfirmations.data || [];

    switch (activePage) {
      case "painel":
        return <PanelTab />;
      case "testehoje":
        return <TesteHojeTab />;
      case "horas":
        return (
          <TimeRegistrationTab
            entries={timeEntriesData}
            setEntries={async (newEntries) => {
               // Keep this for local UI state if still needed by component
            }}
            onUpdateEntry={(entry) => updateTimeEntry.mutate(entry)}
            onRemoveEntry={(id) => {
               // Need to implement remove mutation or treat it as update with deleted flag?
               // The useDatabase hook doesn't have delete yet, I'll add it if needed.
               // For now just pass it.
            }}
            people={peopleData}
            jobs={jobsData}
          />
        );
      case "refeicoes":
        return (
          <MealRequestTab
            people={peopleData}
            jobs={jobsData}
            timeEntries={timeEntriesData}
            requests={mealRequestsData}
            setRequests={async (newRequests) => {
               // Same as above
            }}
            onUpdateRequest={(req) => updateMealRequest.mutate(req)}
            onRemoveRequest={(id) => {
               // Same as above
            }}
            onGenerateEntries={(newEntries) => {
              newEntries.forEach(e => updateTimeEntry.mutate(e));
            }}
          />
        );

      case "controle":
        return (
          <FoodControlTab
            people={peopleData}
            jobs={jobsData}
            requests={mealRequestsData}
            timeEntries={timeEntriesData}
            foodControl={foodControlData}
            setFoodControl={async (newControl) => {
              if (typeof newControl === 'function') {
                const updated = (newControl as any)(foodControlData);
                // Find what changed and update DB
                // For simplicity, we might need to update the component to use individual updates
              }
            }}
            onUpdateEntry={(entry) => updateFoodControl.mutate(entry)}
          />
        );
      case "descontos":
        return (
          <DiscountsTab
            people={peopleData}
            jobs={jobsData}
            requests={mealRequestsData}
            timeEntries={timeEntriesData}
            foodControl={foodControlData}
            confirmations={confirmationsData}
            setConfirmations={async (newConf) => {
               // Similar to above
            }}
            onUpdateConfirmation={(conf) => updateDiscountConfirmation.mutate(conf)}
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
