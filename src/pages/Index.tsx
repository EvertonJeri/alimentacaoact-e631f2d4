import { useState, useMemo, useEffect } from "react";
import { setGlobalCustomHolidays } from "@/lib/holidays";
import { setGlobalSettings } from "@/lib/notifications";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarInset, 
  SidebarTrigger 
} from "@/components/ui/sidebar";
import { 
  Clock, 
  Utensils, 
  AlertTriangle, 
  UtensilsCrossed, 
  CreditCard, 
  FileText, 
  Loader2,
  AlertCircle,
  Settings,
  Calculator
} from "lucide-react";
import TimeRegistrationTab from "@/components/TimeRegistrationTab";
import MealRequestTab from "@/components/MealRequestSystem";
import FoodControlTab from "@/components/FoodControlTab";
import DiscountsTab from "@/components/DiscountsTab";
import PaymentTab from "@/components/PaymentTab";
import StatementTab from "@/components/StatementTab";
import JobCostTab from "@/components/JobCostTab";
import { SettingsTab } from "@/components/SettingsTab";
import { useDatabase } from "@/hooks/use-database";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const {
    people,
    jobs,
    timeEntries,
    requests: mealRequests,
    foodControl,
    discountConfirmations,
    paymentConfirmations,
    updateFoodControl,
    updateDiscountConfirmation,
    updatePaymentConfirmation,
    updateTimeEntry,
    updateMealRequest,
    deleteMealRequest: removeMealRequest,
    deleteTimeEntry: removeTimeEntry,
    deletePaymentConfirmation: removePaymentConfirmation,
    systemSettings,
    customHolidays,
  } = useDatabase();

  // Sync Global states (Holidays and Notifications settings) when data arrives from database
  useEffect(() => {
    if (systemSettings.data) {
      setGlobalSettings(systemSettings.data);
    }
  }, [systemSettings.data]);

  useEffect(() => {
    if (customHolidays.data) {
      setGlobalCustomHolidays(customHolidays.data);
    }
  }, [customHolidays.data]);

  const [activePage, setActivePage] = useState("horas");
  const [autoFillTravel, setAutoFillTravel] = useState(true);
  const [jobFilter, setJobFilter] = useState("all");

  // Reset filter when navigating unless it's a deep link from JobCost
  useEffect(() => {
    if (activePage !== "pagamento" && activePage !== "horas" && activePage !== "refeicoes" && activePage !== "descontos" && activePage !== "controle" && activePage !== "fechamento") {
      // Keep filter
    }
  }, [activePage]);

  const isLoading = people.isLoading || jobs.isLoading || timeEntries.isLoading || mealRequests.isLoading;
  const isError = people.error || jobs.error || timeEntries.error || mealRequests.error;

  const peopleData = useMemo(() => people.data || [], [people.data]);
  const jobsData = useMemo(() => jobs.data || [], [jobs.data]);
  const timeEntriesData = useMemo(() => timeEntries.data || [], [timeEntries.data]);
  const mealRequestsData = useMemo(() => mealRequests.data || [], [mealRequests.data]);
  const foodControlData = useMemo(() => foodControl.data || [], [foodControl.data]);
  const discountConfirmationsData = useMemo(() => discountConfirmations.data || [], [discountConfirmations.data]);
  const paymentConfirmationsData = useMemo(() => paymentConfirmations.data || [], [paymentConfirmations.data]);

  const allConfirmations = useMemo(() => [
    ...(discountConfirmations.data || []),
    ...(paymentConfirmations.data || [])
  ], [discountConfirmations.data, paymentConfirmations.data]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Carregando painel de controle...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center p-6 bg-background">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro de Conexão</AlertTitle>
          <AlertDescription>
            Não foi possível carregar os dados do banco. Por favor, verifique sua conexão ou tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const renderContent = () => {
    switch (activePage) {
      case "horas":
        return (
          <TimeRegistrationTab
            entries={timeEntriesData}
            onUpdateEntry={(entry) => updateTimeEntry.mutate(entry)}
            onRemoveEntry={(id) => removeTimeEntry.mutate(id)}
            people={peopleData}
            jobs={jobsData}
            requests={mealRequestsData}
            autoFillTravel={autoFillTravel}
            setAutoFillTravel={setAutoFillTravel}
            initialJobFilter={jobFilter}
          />
        );
      case "refeicoes":
        return (
          <MealRequestTab
            people={peopleData}
            jobs={jobsData}
            requests={mealRequestsData}
            timeEntries={timeEntriesData}
            foodControl={foodControlData}
            confirmations={allConfirmations}
            onUpdateRequest={(req) => updateMealRequest.mutate(req)}
            onRemoveRequest={(id) => removeMealRequest.mutate(id)}
            onUpdateTimeEntry={(entry) => updateTimeEntry.mutate(entry)}
            onNavigateToPayment={() => setActivePage("pagamento")}
            autoFillTravel={autoFillTravel}
            setAutoFillTravel={setAutoFillTravel}
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
            confirmations={allConfirmations}
            onUpdateConfirmation={(conf) => updatePaymentConfirmation.mutate(conf)}
            onRemoveConfirmation={(id) => removePaymentConfirmation.mutate(id)}
            onRemoveRequest={(id) => removeMealRequest.mutate(id)}
            onUpdateDiscountConfirmation={(conf) => updateDiscountConfirmation.mutate(conf)}
            initialJobFilter={jobFilter}
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
            confirmations={allConfirmations}
            onUpdatePaymentConfirmation={(conf) => updatePaymentConfirmation.mutate(conf)}
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
            onUpdateEntry={(entry) => updateFoodControl.mutate(entry)}
            initialJobFilter={jobFilter}
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
            confirmations={allConfirmations}
            setConfirmations={() => {}}
            onUpdateConfirmation={(conf) => updateDiscountConfirmation.mutate(conf)}
            initialJobFilter={jobFilter}
          />
        );
      case "fechamento":
        return (
          <JobCostTab 
            people={peopleData}
            jobs={jobsData}
            requests={mealRequestsData}
            timeEntries={timeEntriesData}
            foodControl={foodControlData}
            confirmations={allConfirmations}
            onUpdatePaymentConfirmation={(conf) => updatePaymentConfirmation.mutate(conf)}
            onJobClick={(jobId) => {
              setJobFilter(jobId);
              setActivePage("pagamento");
            }}
          />
        );
      case "configuracoes":
        return <SettingsTab />;
      default:
        return <div>Selecione uma página no menu lateral.</div>;
    }
  };

  const menuItems = [
    { id: "horas", label: "Registro de Horas", icon: Clock },
    { id: "refeicoes", label: "Solicitação de Refeições", icon: Utensils },
    { id: "pagamento", label: "Pagamento", icon: CreditCard },
    { id: "controle", label: "Controle Alimentar", icon: UtensilsCrossed },
    { id: "descontos", label: "Descontos", icon: AlertTriangle },
    { id: "fechamento", label: "Fechamento de Jobs", icon: Calculator },
    { id: "extrato", label: "Extrato Geral", icon: FileText },
    { id: "configuracoes", label: "Configurações do Sistema", icon: Settings },
  ];

  return (
    <SidebarProvider>
      <Sidebar variant="inset" className="border-r border-border bg-muted/20 print:hidden">
        <SidebarHeader className="h-16 flex items-center px-6 border-b border-border bg-background">
          <h2 className="text-sm font-black uppercase tracking-widest text-primary">Sistema ACT</h2>
        </SidebarHeader>
        <SidebarContent className="py-2">
          <SidebarMenu className="px-2 space-y-1">
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton 
                  isActive={activePage === item.id} 
                  onClick={() => setActivePage(item.id)}
                  className="transition-all duration-200"
                >
                  <item.icon className={`h-4 w-4 ${activePage === item.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={activePage === item.id ? 'font-semibold' : ''}>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex min-h-screen flex-col bg-background">
          <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur-sm print:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="-ml-1" />
              <div className="h-4 w-px bg-border hidden sm:block" />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">
                  {menuItems.find(i => i.id === activePage)?.label}
                </h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium hidden sm:block">
                  Painel de Controle de Montagem
                </p>
              </div>
            </div>
            <div className="text-2xs text-white font-mono tabular-nums bg-green-600 px-2 py-1 rounded shadow-sm">
              v1.5.7-stable
            </div>
          </header>

          <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 animate-in fade-in duration-500 print:p-0 print:max-w-none">
            {renderContent()}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Index;
