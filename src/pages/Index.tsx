import { useState, useMemo } from "react";
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
  AlertCircle
} from "lucide-react";
import TimeRegistrationTab from "@/components/TimeRegistrationTab";
import MealRequestTab from "@/components/MealRequestSystem";
import FoodControlTab from "@/components/FoodControlTab";
import DiscountsTab from "@/components/DiscountsTab";
import PaymentTab from "@/components/PaymentTab";
import StatementTab from "@/components/StatementTab";
import { useDatabase } from "@/hooks/use-database";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
    removeMealRequest,
    removeTimeEntry,
    removePaymentConfirmation,
  } = useDatabase();

  const [activePage, setActivePage] = useState("horas");

  const isLoading = people.isLoading || jobs.isLoading || timeEntries.isLoading || mealRequests.isLoading;
  const isError = people.error || jobs.error || timeEntries.error || mealRequests.error;

  const peopleData = useMemo(() => people.data || [], [people.data]);
  const jobsData = useMemo(() => jobs.data || [], [jobs.data]);
  const timeEntriesData = useMemo(() => timeEntries.data || [], [timeEntries.data]);
  const mealRequestsData = useMemo(() => mealRequests.data || [], [mealRequests.data]);
  const foodControlData = useMemo(() => foodControl.data || [], [foodControl.data]);
  const discountConfirmationsData = useMemo(() => discountConfirmations.data || [], [discountConfirmations.data]);
  const paymentConfirmationsData = useMemo(() => paymentConfirmations.data || [], [paymentConfirmations.data]);

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
    const commonProps = {
      people: peopleData,
      jobs: jobsData,
      requests: mealRequestsData,
      timeEntries: timeEntriesData,
      foodControl: foodControlData,
    };

    switch (activePage) {
      case "horas":
        return (
          <TimeRegistrationTab
            entries={timeEntriesData}
            setEntries={() => {}}
            onUpdateEntry={(entry) => updateTimeEntry.mutate(entry)}
            onRemoveEntry={(id) => removeTimeEntry.mutate(id)}
            people={peopleData}
            jobs={jobsData}
          />
        );
      case "refeicoes":
        return (
          <MealRequestTab
            {...commonProps}
            confirmations={discountConfirmationsData}
            onUpdateRequest={(req) => updateMealRequest.mutate(req)}
            onRemoveRequest={(id) => removeMealRequest.mutate(id)}
            onUpdateTimeEntry={(entry) => updateTimeEntry.mutate(entry)}
          />
        );
      case "pagamento":
        return (
          <PaymentTab
            {...commonProps}
            confirmations={[...paymentConfirmationsData, ...discountConfirmationsData]}
            onUpdateConfirmation={(conf) => updatePaymentConfirmation.mutate(conf)}
            onRemoveConfirmation={(id) => removePaymentConfirmation.mutate(id)}
            onRemoveRequest={(id) => removeMealRequest.mutate(id)}
            onUpdateDiscountConfirmation={(conf) => updateDiscountConfirmation.mutate(conf)}
          />
        );
      case "extrato":
        return <StatementTab {...commonProps} />;
      case "controle":
        return (
          <FoodControlTab
            {...commonProps}
            setFoodControl={() => {}}
            onUpdateEntry={(entry) => updateFoodControl.mutate(entry)}
          />
        );
      case "descontos":
        return (
          <DiscountsTab
            {...commonProps}
            confirmations={discountConfirmationsData}
            setConfirmations={() => {}}
            onUpdateConfirmation={(conf) => updateDiscountConfirmation.mutate(conf)}
          />
        );
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
    { id: "extrato", label: "Extrato Geral", icon: FileText },
  ];

  return (
    <SidebarProvider>
      <Sidebar variant="inset" className="border-r border-border bg-muted/20">
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
          <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur-sm">
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
            <div className="text-2xs text-muted-foreground font-mono tabular-nums bg-muted px-2 py-1 rounded">
              v1.5.2-stable
            </div>
          </header>

          <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 animate-in fade-in duration-500">
            {renderContent()}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Index;
