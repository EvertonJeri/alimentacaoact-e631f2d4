import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Clock, Utensils, AlertTriangle, UtensilsCrossed, CreditCard, FileText, Loader2 } from "lucide-react";
import TimeRegistrationTab from "@/components/TimeRegistrationTab";
import MealRequestTab from "@/components/MealRequestTab";
import FoodControlTab from "@/components/FoodControlTab";
import DiscountsTab from "@/components/DiscountsTab";
import PaymentTab from "@/components/PaymentTab";
import StatementTab from "@/components/StatementTab";
import { useDatabase } from "@/hooks/use-database";

const Index = () => {
  const {
    people,
    jobs,
    timeEntries,
    mealRequests,
    foodControl,
    discountConfirmations,
    paymentConfirmations,
    updateFoodControl,
    updateDiscountConfirmation,
    updatePaymentConfirmation,
    updateTimeEntry,
    updateMealRequest,
    removeMealRequest
  } = useDatabase();

  const [activePage, setActivePage] = useState("horas");

  if (people.isLoading || jobs.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const peopleData = people.data || [];
  const jobsData = jobs.data || [];
  const timeEntriesData = timeEntries.data || [];
  const mealRequestsData = mealRequests.data || [];
  const foodControlData = foodControl.data || [];
  const discountConfirmationsData = discountConfirmations.data || [];
  const paymentConfirmationsData = paymentConfirmations.data || [];

  const renderContent = () => {
    switch (activePage) {
      case "horas":
        return (
          <TimeRegistrationTab
            entries={timeEntriesData}
            setEntries={() => {}}
            onUpdateEntry={(entry) => updateTimeEntry.mutate(entry)}
            onRemoveEntry={() => {}}
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
            foodControl={foodControlData}
            confirmations={[...discountConfirmationsData, ...paymentConfirmationsData] as any}
            setRequests={() => {}}
            onUpdateRequest={(req) => updateMealRequest.mutate(req)}
            onRemoveRequest={(id) => removeMealRequest.mutate(id)}
            onGenerateEntries={(newEntries) => {
              newEntries.forEach(e => updateTimeEntry.mutate(e));
            }}
          />
        );
      case "pagamento":
        return (
          <PaymentTab
            people={peopleData}
            jobs={jobsData}
            requests={mealRequestsData}
            timeEntries={timeEntriesData}
            foodControl={foodControlData}
            confirmations={paymentConfirmationsData}
            onUpdateConfirmation={(conf) => updatePaymentConfirmation.mutate(conf)}
          />
        );
      case "extrato":
        return (
          <StatementTab
            people={peopleData}
            jobs={jobsData}
            requests={mealRequestsData}
            timeEntries={timeEntriesData}
            foodControl={foodControlData}
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
            setFoodControl={() => {}}
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
            confirmations={discountConfirmationsData}
            setConfirmations={() => {}}
            onUpdateConfirmation={(conf) => updateDiscountConfirmation.mutate(conf)}
          />
        );
      default:
        return (
          <TimeRegistrationTab
            entries={timeEntriesData}
            setEntries={() => {}}
            onUpdateEntry={(entry) => updateTimeEntry.mutate(entry)}
            onRemoveEntry={() => {}}
            people={peopleData}
            jobs={jobsData}
          />
        );
    }
  };

  return (
    <SidebarProvider>
      <Sidebar variant="inset" className="border-r border-border bg-muted/30">
        <SidebarHeader className="h-16 flex items-center px-6 border-b border-border bg-background">
          <h2 className="text-sm font-black uppercase tracking-widest text-primary">Menu Principal</h2>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="px-2 space-y-1">
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
              <SidebarMenuButton isActive={activePage === "pagamento"} onClick={() => setActivePage("pagamento")}>
                <CreditCard className="h-4 w-4" />
                <span>Pagamento</span>
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
            <SidebarMenuItem>
              <SidebarMenuButton isActive={activePage === "extrato"} onClick={() => setActivePage("extrato")}>
                <FileText className="h-4 w-4" />
                <span>Extrato Geral</span>
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
                Registro de horas, solicitação de refeições, controle de alimentação, descontos e extrato
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
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
