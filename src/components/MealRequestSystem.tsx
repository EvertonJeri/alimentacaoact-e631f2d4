import React, { useState, useMemo } from "react";
import { Plus, Trash2, AlertCircle, Utensils, Calendar, ChevronDown, ChevronRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { isHoliday, getHolidayName } from "@/lib/holidays";
import {
  type Person,
  type Job,
  type MealRequest,
  type MealType,
  type LocationType,
  MEAL_LABELS,
  MEAL_VALUES,
  LOCATIONS,
  getDatesInRange,
  getMealValue,
  calculatePersonBalance,
  isWeekend,
  isWeekendOrHoliday,
  getActiveMeals,
  type FoodControlEntry,
  type TimeEntry,
  type DiscountConfirmation,
  type PaymentConfirmation,
  type SystemSettings,
} from "@/lib/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { notifyFinancePayment, notifyAdminPayment, notifyFinanceAndHRPayment } from "@/lib/notifications";

interface MealRequestSystemProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries?: TimeEntry[];
  foodControl: FoodControlEntry[];
  confirmations: (DiscountConfirmation | PaymentConfirmation)[];
  onUpdateRequest: (req: MealRequest) => void;
  onRemoveRequest: (id: string) => void;
  onUpdateTimeEntry?: (entry: TimeEntry) => void;
  onNavigateToPayment?: () => void;
  autoFillTravel?: boolean;
  setAutoFillTravel?: (v: boolean) => void;
  systemSettings?: SystemSettings;
}

const MealRequestSystem = ({
  people = [],
  jobs = [],
  requests = [],
  timeEntries = [],
  foodControl = [],
  confirmations = [],
  onUpdateRequest,
  onRemoveRequest,
  onUpdateTimeEntry,
  onNavigateToPayment,
  autoFillTravel = true,
  setAutoFillTravel,
  systemSettings,
}: MealRequestSystemProps) => {
  const [selectedJob, setSelectedJob] = useState("");
  const [location, setLocation] = useState("");
  const [transportType, setTransportType] = useState<"onibus" | "aviao">("onibus");
  const [travelTime, setTravelTime] = useState("");
  const [personId, setPersonId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [meals, setMeals] = useState<MealType[]>(["cafe", "almoco", "janta"]);
  const [isLocal, setIsLocal] = useState<boolean | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"normal" | "complement">("normal");
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [showFinanceDialog, setShowFinanceDialog] = useState(false);

  React.useEffect(() => {
    if (personId && location === "Dentro SP" && isLocal === true) {
      const isCLT = people.find(p => p.id === personId)?.isRegistered;
      if (isCLT) {
        setMeals(prev => prev.filter(m => m !== "cafe"));
      }
    }
  }, [location, personId, isLocal, people]);

  const balance = useMemo(() => {
    if (!personId || !people || !requests) return 0;
    return calculatePersonBalance(personId, requests, foodControl, confirmations, people, timeEntries);
  }, [personId, requests, foodControl, confirmations, people, timeEntries]);

  const filtered = useMemo(() => {
    if (!selectedJob) return [];
    return (requests || []).filter(r => r.jobId === selectedJob);
  }, [requests, selectedJob]);

  const financeSummary = useMemo(() => {
    if (filtered.length === 0) return { total: 0, count: 0 };
    let total = 0;
    filtered.forEach(req => {
      const days = getDatesInRange(req.startDate, req.endDate);
      const person = people.find(p => p.id === req.personId);
      total += (days || []).reduce((acc, d) => {
        const activeMeals = (req.dailyOverrides?.[d] ?? req.meals) as MealType[];
        return acc + (Array.isArray(activeMeals) ? activeMeals.reduce((sum, m) => sum + getMealValue(m, d, person), 0) : 0);
      }, 0);
    });
    return { total, count: filtered.length };
  }, [filtered, people]);

  const handleConfirmFinance = async () => {
    const jobName = jobs.find(j => j.id === selectedJob)?.name || "—";

    // Identificar se há usuários Flash no lote que está sendo enviado
    const hasFlashUsers = filtered.some(req => systemSettings?.flashCardUsers?.includes(req.personId));

    const details = `⚠️ *NOVOS LANÇAMENTOS PARA PAGAMENTO*\n\n🏗️ Projeto: ${jobName}\n👥 Profissionais Envolvidos: ${financeSummary.count}\n💰 Valor Estimado das Novas Refeições: R$ ${financeSummary.total.toFixed(2)}\n\n*Os valores acima acabaram de ser lançados no sistema e já estão disponíveis para conferência e pagamento na aba 'Pagamentos'.*`;

    if (hasFlashUsers) {
      // Se houver gente do Flash, avisa os dois e-mails
      await notifyFinanceAndHRPayment(details);
    }

    notifyAdminPayment(details);

    setShowFinanceDialog(false);
    toast.success("Financeiro e Setores notificados sobre os novos lançamentos!");
    if (onNavigateToPayment) onNavigateToPayment();
  };

  const handleAdd = () => {
    if (!selectedJob || !personId || !startDate || !endDate || !location) return;
    if (isLocal === undefined || isLocal === null) {
      toast.error("Informe se a pessoa é do local (Sim ou Não).", { duration: 4000 });
      return;
    }
    const dates = getDatesInRange(startDate, endDate);

    if (activeSubTab === "complement") {
      // MODO COMPLEMENTO: Busca a solicitação existente para este profissional neste job
      const existing = requests.find(r => r.personId === personId && r.jobId === selectedJob && startDate >= r.startDate && startDate <= r.endDate);
      if (existing) {
        const currentOverrides = { ...(existing.dailyOverrides || {}) };
        const baseDayMeals = Array.isArray(currentOverrides[startDate])
          ? (currentOverrides[startDate] as MealType[])
          : [...existing.meals];

        const selectedPerson = people.find(p => p.id === personId);
        // Ensure "almoco" cannot be added if CLT, or if they already have it
        const finalComplementMeals = meals.filter(m => {
          if (m === "almoco" && selectedPerson?.isRegistered) return false;
          return !baseDayMeals.includes(m);
        });

        // Add only the new meals for that specific day
        // Add only the new meals for that specific day
        if (finalComplementMeals.length === 0) {
          toast.error("O profissional já possui todas as refeições selecionadas neste dia.", { duration: 5000 });
          return;
        }

        const newComplementRequest: MealRequest = {
          id: crypto.randomUUID(),
          personId: personId,
          jobId: selectedJob,
          startDate: startDate,
          endDate: endDate,
          meals: finalComplementMeals,
          location: existing.location,
          transportType: existing.transportType,
          isLocal: existing.isLocal
        };

        onUpdateRequest(newComplementRequest);
        setPersonId("");
        toast.success(`Complemento adicionado para ${selectedPerson?.name} no dia ${startDate.split("-").reverse().join("/")}!`);
        return;
      } else {
        toast.error("Nenhuma solicitação base encontrada para este profissional neste período.", { duration: 5000 });
        return;
      }
    }

    // VERIFICAÇÃO DE DUPLICIDADE (Modo Normal)
    const conflict = requests.find(r =>
      r.personId === personId &&
      dates.some(d => getDatesInRange(r.startDate, r.endDate).includes(d))
    );

    if (conflict) {
      if (conflict.jobId === selectedJob) {
        toast.error("Esta pessoa já possui uma solicitação neste projeto! Use a aba 'Complemento' se quiser adicionar mais refeições.", { duration: 6000 });
      } else {
        const conflictJob = jobs.find(j => j.id === conflict.jobId)?.name || 'Outro Projeto';
        toast.error(`Ação bloqueada: esta pessoa já possui refeição no projeto [${conflictJob}] neste período!`, { duration: 6000 });
      }
      return;
    }

    const isPersonCLT = people.find(p => p.id === personId)?.isRegistered || false;

    const overrides: Record<string, MealType[]> = {};
    let hasOverride = false;

    if (travelTime) {
      const offset = transportType === "aviao" ? 4 : 2;
      const [h, m] = travelTime.split(":").map(Number);
      const adjustedMinutes = (h * 60 + m) - (offset * 60);

      const travelMeals: MealType[] = [];
      if (adjustedMinutes <= 8 * 60 && meals.includes("cafe")) travelMeals.push("cafe");
      if (adjustedMinutes <= 12 * 60 && meals.includes("almoco")) travelMeals.push("almoco");
      if (adjustedMinutes <= 20 * 60 && meals.includes("janta")) travelMeals.push("janta");

      overrides[startDate] = travelMeals;
      hasOverride = true;
    }

    const newRequest: MealRequest = {
      id: crypto.randomUUID(),
      personId,
      jobId: selectedJob,
      startDate,
      endDate,
      meals,
      dailyOverrides: hasOverride ? overrides : {},
      location: location as LocationType,
      transportType,
      travelTime: travelTime || undefined,
      isLocal
    };

    // Regra SP: CLT, Local e Dentro de SP não tem Café da Manhã
    if (newRequest.location === "Dentro SP" && isPersonCLT && newRequest.isLocal) {
      newRequest.meals = newRequest.meals.filter(m => m !== "cafe");
      if (newRequest.dailyOverrides) {
        Object.keys(newRequest.dailyOverrides).forEach(d => {
          newRequest.dailyOverrides![d] = newRequest.dailyOverrides![d].filter(m => m !== "cafe");
        });
      }
    }

    // Pós-processo: para CLT, garantir que nenhum dia útil tenha almoço
    if (isPersonCLT) {
      const allDates = getDatesInRange(startDate, endDate);
      const finalOverrides = { ...(newRequest.dailyOverrides || {}) };
      allDates.forEach(d => {
        const dayMeals: MealType[] = Array.isArray(finalOverrides[d])
          ? [...(finalOverrides[d] as MealType[])]
          : [...meals];
        const isWkndOrHol = isWeekend(d) || isHoliday(d);
        if (!isWkndOrHol) {
          // Dia útil: CLT não tem almoço coberto pela empresa
          finalOverrides[d] = dayMeals.filter(m => m !== 'almoco');
        } else {
          // Fds/feriado: CLT tem direito a almoço, então forçamos a inclusão oficial se não tiver
          if (!dayMeals.includes('almoco')) {
            finalOverrides[d] = [...dayMeals, 'almoco'];
          } else {
            finalOverrides[d] = dayMeals;
          }
        }
      });
      newRequest.dailyOverrides = finalOverrides;
    }
    onUpdateRequest(newRequest);
    setPersonId("");
    toast.success("Solicitação adicionada!", { duration: 5000 });
  };

  const handleSendAll = () => {
    if (filtered.length === 0) {
      toast.info("Não há solicitações para o job selecionado.");
      return;
    }

    let createdCount = 0;
    let requestsProcessed = 0;

    filtered.forEach(req => {
      const dates = getDatesInRange(req.startDate, req.endDate);
      let personDaysCreated = 0;

      dates.forEach((date, idx) => {
        // Verifica se já existe registro de horas para esta pessoa nesta data e job
        const existing = timeEntries.find(e =>
          e.personId === req.personId &&
          e.jobId === req.jobId &&
          e.date === date
        );

        if (!existing && onUpdateTimeEntry) {
          let entry1 = "";
          let exit1 = "";
          let entry2 = "";
          let exit2 = "";
          let isTravelOut = false;
          let isTravelReturn = false;
          let isAutoFilled = false;

          const isFirstDay = idx === 0;

          if (isFirstDay) {
            if (req.location === "Fora SP") {
              isTravelOut = true;
              isAutoFilled = true;
              entry1 = "08:00"; exit1 = "12:00";
              entry2 = "13:00"; exit2 = "18:00";
            } else if (req.location === "Dentro SP" && req.travelTime) {
              isTravelOut = true;
              isAutoFilled = true;
              entry1 = "08:00"; exit1 = "10:00";
            }
          }

          const id = crypto.randomUUID();
          onUpdateTimeEntry({
            id,
            personId: req.personId,
            jobId: req.jobId,
            date,
            entry1, exit1, entry2, exit2, entry3: "", exit3: "",
            isTravelOut,
            isTravelReturn,
            isAutoFilled
          });

          // Salva override local para consistência visual imediata
          try {
            const saved = localStorage.getItem('time-reg-overrides');
            const overrides = saved ? JSON.parse(saved) : {};
            overrides[id] = { isTravelOut, isTravelReturn, isAutoFilled };
            localStorage.setItem('time-reg-overrides', JSON.stringify(overrides));
          } catch (e) { console.error(e); }

          personDaysCreated++;
          createdCount++;
        }
      });
      requestsProcessed++;
    });

    if (createdCount > 0) {
      toast.success(`${requestsProcessed} solicitações processadas. ${createdCount} novos dias criados no Registro de Horas!`, { duration: 5000 });
    } else {
      toast.info(`Processado: ${requestsProcessed} solicitações. Todos os dias já estavam registrados.`, { duration: 5000 });
    }

    setShowFinanceDialog(true);
  };

  const toggleExpanded = (id: string) => {
    setExpandedRequests(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDayMeal = (req: MealRequest, date: string, meal: MealType) => {
    const currentOverrides = { ...(req.dailyOverrides || {}) };
    const dayMeals: MealType[] = Array.isArray(currentOverrides[date])
      ? [...(currentOverrides[date] as MealType[])]
      : [...(req.meals || [])];

    if (dayMeals.includes(meal)) {
      currentOverrides[date] = dayMeals.filter(m => m !== meal);
    } else {
      currentOverrides[date] = [...dayMeals, meal];
    }

    onUpdateRequest({ ...req, dailyOverrides: currentOverrides });
  };

  const pName = (id: string) => (people || []).find(p => p.id === id)?.name || "—";
  const jName = (idOrReq: string | MealRequest) => {
    const id = typeof idOrReq === 'string' ? idOrReq : idOrReq.jobId;
    if (!id) return "—";

    const job = (jobs || []).find(j => j.id === id);
    if (job) return job.name;

    const matchByName = (jobs || []).find(j => j.name.startsWith(id + " - ") || j.name === id);
    if (matchByName) return matchByName.name;

    if (!id.includes("-") || id.length < 30) return id;
    return `Removido (${id.substring(0, 5)})`;
  };
  const fDate = (d: string) => (d && d.includes("-") ? d.split("-").reverse().join("/") : d || "—");

  const dayOfWeek = (d: string) => {
    try {
      const date = new Date(d + "T12:00:00");
      return date.toLocaleDateString("pt-BR", { weekday: "short" });
    } catch { return ""; }
  };

  return (
    <>
      <div className="space-y-6 max-w-6xl mx-auto py-2 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="space-y-2">
            <Label className="text-2xs uppercase tracking-widest font-black text-primary flex items-center gap-2">
              <Utensils className="h-3 w-3" /> Selecionar Job de Montagem
            </Label>
            <SearchableSelect
              options={Array.from(new Map((jobs || []).map(j => [j.name.toLowerCase().trim(), j])).values()).map(j => {
                const parts = j.name.split(" - ");
                return {
                  value: j.id,
                  label: j.name,
                  description: parts[1] ? `Projeto: ${parts[1]}` : undefined
                };
              })}
              value={selectedJob}
              onValueChange={setSelectedJob}
              placeholder="Escolha o projeto..."
            />
          </div>
          <div className="space-y-2">
            <Label className="text-2xs uppercase tracking-widest font-black text-muted-foreground mr-1">
              Local das Refeições <span className="text-destructive">*</span>
            </Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger><SelectValue placeholder="Selecione o Local..." /></SelectTrigger>
              <SelectContent>
                {LOCATIONS.map(loc => (
                  <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className={`rounded-2xl border border-border p-6 shadow-lg space-y-6 ring-1 ring-primary/5 transition-opacity bg-muted/10`}>
          <div className="flex flex-col gap-4 border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveSubTab("normal")}
                  className={`text-[10px] font-black uppercase tracking-widest pb-1 transition-all border-b-2 ${activeSubTab === "normal" ? "text-primary border-primary" : "text-muted-foreground border-transparent opacity-60 hover:opacity-100"}`}
                >
                  Solicitação Normal
                </button>
                <button
                  onClick={() => setActiveSubTab("complement")}
                  className={`text-[10px] font-black uppercase tracking-widest pb-1 transition-all border-b-2 ${activeSubTab === "complement" ? "text-primary border-primary" : "text-muted-foreground border-transparent opacity-60 hover:opacity-100"}`}
                >
                  Complemento
                </button>
              </div>
              <div className="flex items-center gap-2 text-2xs text-muted-foreground italic">
                <Calendar className="h-3 w-3" /> Job: {(() => {
                  const name = jName(selectedJob);
                  const parts = name.split(" - ");
                  if (name.includes("Removido (")) return name;
                  return (
                    <span className="flex items-center gap-1.5 ml-1">
                      <span className="font-black text-primary tabular-nums">{parts[0]}</span>
                      {parts[1] && <span className="opacity-60 max-w-[120px] truncate">{parts[1]}</span>}
                    </span>
                  );
                })()}
              </div>
            </div>
            <h2 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
              <Utensils className="h-4 w-4 text-primary" />
              {activeSubTab === "normal" ? "Registrar Novas Refeições" : "Adicionar Complemento de Refeição"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pessoa no Projeto</Label>
              <SearchableSelect
                options={(people || []).map(p => ({
                  value: p.id,
                  label: p.isRegistered ? `⚠️ CLT • ${p.name}` : p.name,
                  description: `${p.department || "Geral"} • ${p.isRegistered ? "CLT (sem almoço seg-sex)" : "Avulso PJ"}`
                }))}
                value={personId}
                onValueChange={(val) => {
                  setPersonId(val);
                  const selectedPerson = people.find(p => p.id === val);
                  if (selectedPerson?.isRegistered) {
                    // CLT: nunca tem almoço no padrão (só em fds/feriado via override)
                    setMeals(["cafe", "janta"]);
                  } else if (activeSubTab === "normal") {
                    setMeals(isLocal === true ? ["almoco"] : ["cafe", "almoco", "janta"]);
                  }
                }}
                placeholder="Selecione o profissional..."
              />
              <div className="p-3 rounded-lg border-2 border-primary/20 bg-primary/5">
                <Label className="text-xs font-black uppercase tracking-widest text-primary mb-2 block">
                  Pessoa do Local? <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={isLocal === true ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const isCLT = people.find(p => p.id === personId)?.isRegistered;
                      setIsLocal(true);
                      // Regra SP: CLT, Local, Dentro SP não pode ter Café da manhã marcado
                      if (isCLT) {
                         setMeals(location === "Dentro SP" ? [] : ["cafe"]);
                      } else {
                         setMeals(["almoco"]);
                      }
                    }}
                  >
                    ✅ Sim (só almoço)
                  </Button>
                  <Button
                    type="button"
                    variant={isLocal === false ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const isCLT = people.find(p => p.id === personId)?.isRegistered;
                      setIsLocal(false);
                      // CLT não-local: sem almoço (só em fds/feriado depois)
                      setMeals(isCLT ? ["cafe", "janta"] : ["cafe", "almoco", "janta"]);
                    }}
                  >
                    ❌ Não
                  </Button>
                </div>
              </div>
              {personId && balance !== 0 && (
                <div className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 shadow-inner transition-all ${balance < 0 ? 'bg-destructive/5 border-destructive/20 text-destructive' : 'bg-primary/5 border-primary/20 text-primary'}`}>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-bold">Saldo: R$ {balance.toFixed(2)}</span>
                  </div>
                  <span className="font-black uppercase tracking-tighter text-[9px] px-2 py-0.5 rounded-full bg-background/50 border border-current">
                    {balance < 0 ? 'Débito' : 'Crédito'}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Regimes de Refeição</Label>
              <div className="flex gap-6 p-3 border rounded-xl bg-background/60 backdrop-blur-sm">
                {(["cafe", "almoco", "janta"] as MealType[]).map(m => {
                  const isCLT = people.find(p => p.id === personId)?.isRegistered;
                  const isBlockedCafe = isCLT && isLocal === true && location === "Dentro SP" && m === "cafe";
                  
                  return (
                    <div key={m} className={`flex items-center gap-3 ${isBlockedCafe ? 'opacity-50' : ''}`}>
                      <Checkbox
                        id={`meal-${m}`}
                        checked={meals.includes(m)}
                        disabled={isBlockedCafe}
                        onCheckedChange={(checked) => {
                          if (checked) setMeals([...meals, m]);
                          else setMeals(meals.filter(x => x !== m));
                        }}
                      />
                      <Label htmlFor={`meal-${m}`} className={`text-xs font-bold select-none ${isBlockedCafe ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        {MEAL_LABELS[m]}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-1 gap-4 items-end pt-2 ${activeSubTab === "complement" ? "md:grid-cols-2" : "md:grid-cols-5"}`}>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{activeSubTab === "complement" ? "Data do Complemento" : "Data Início"}</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-11 bg-background" />
            </div>
            {activeSubTab !== "complement" && (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Data Término</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-11 bg-background" />
              </div>
            )}
            {activeSubTab !== "complement" && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Transporte</Label>
                  <Select value={transportType} onValueChange={(v) => setTransportType(v as "onibus" | "aviao")}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onibus">🚌 Ônibus</SelectItem>
                      <SelectItem value="aviao">✈️ Avião</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Hora Viagem</Label>
                  <Input type="time" value={travelTime} onChange={e => setTravelTime(e.target.value)} className="h-11 bg-background" />
                </div>
              </>
            )}
            <Button
              onClick={handleAdd}
              disabled={!selectedJob || !personId || !startDate || !endDate || !location}
              className={`h-11 w-full font-black uppercase tracking-widest transition-all shadow-md active:scale-[0.98] ${(!selectedJob || !personId || !startDate || !endDate || !location)
                  ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                  : "bg-foreground text-background hover:bg-foreground/90"
                }`}
            >
              <Plus className="h-4 w-4 mr-2" /> Adicionar
            </Button>
          </div>

          {(() => {
             const isCLT = people.find(p => p.id === personId)?.isRegistered;
             return (location === "Dentro SP" && isCLT && isLocal && meals.includes("cafe"));
          })() && (
            <div className="mx-6 mb-4 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              Aviso: Para profissionais CLT locais Dentro de SP o Café da Manhã não é permitido por regra e será removido automaticamente ao salvar.
            </div>
          )}
        </div>

        <div className={`rounded-2xl border border-border overflow-hidden bg-card shadow-card transition-opacity`}>
          <div className="px-6 py-4 bg-muted/40 border-b border-border flex justify-between items-center">
            <h3 className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">Refeições Programadas</h3>
            <div className="flex gap-4 items-center">
              <span className="text-[9px] bg-primary/10 text-primary px-3 py-1 rounded-full font-black uppercase">{filtered.length} Ativos</span>
              <Button
                onClick={handleSendAll}
                disabled={filtered.length === 0}
                size="sm"
                className="bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-8 px-4"
              >
                <Send className="h-3 w-3 mr-1.5" /> Enviar para Registro
              </Button>
              <Button
                onClick={() => {
                  const job = jobs.find(j => j.id === selectedJob);
                  const jobName = job?.name || "";
                  const msg = `🏗️ *RESUMO DO JOB*\n\n📌 *"Job" - "${jobName}"*\n\n👥 Profissionais Ativos: ${financeSummary.count}\n💰 Valor Estimado: R$ ${financeSummary.total.toFixed(2)}\n\n_Enviado via Sistema ACT_`;

                  if (navigator.share) {
                    // Tenta usar a API de compartilhamento do sistema (Funciona em mobile e navegadores modernos)
                    navigator.share({
                      title: `Resumo - ${jobName}`,
                      text: msg
                    }).catch(() => {
                      // Se cancelar ou der erro, cai no clipboard
                      navigator.clipboard.writeText(msg);
                      toast.success("Texto copiado! Selecione o grupo no Zap.");
                      window.open(`https://web.whatsapp.com/`, '_blank');
                    });
                  } else {
                    // Backup para desktops/navegadores antigos (Clipboard)
                    navigator.clipboard.writeText(msg).then(() => {
                      toast.success("Relatório copiado! Agora é só colar no grupo.");
                      window.open(`https://web.whatsapp.com/`, '_blank');
                    });
                  }
                }}
                disabled={filtered.length === 0}
                size="sm"
                variant="outline"
                className="border-green-600 text-green-700 font-black uppercase text-[10px] tracking-widest h-8 px-4 hover:bg-green-50"
              >
                <Send className="h-3 w-3 mr-1.5 text-green-600" /> Mandar p/ Zap
              </Button>
            </div>
          </div>

          <div className="divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="px-6 py-16 text-center text-muted-foreground italic tracking-widest text-xs opacity-60">
                Nenhuma solicitação ativa para este job.
              </div>
            ) : (
              filtered.map(req => {
                const days = getDatesInRange(req.startDate, req.endDate);
                const person = people.find(p => p.id === req.personId);
                const totalCost = (days || []).reduce((acc, d) => {
                  const activeMeals = getActiveMeals(req, d, person);
                  return acc + (Array.isArray(activeMeals) ? activeMeals.reduce((sum, m) => sum + getMealValue(m, d, person, req.location), 0) : 0);
                }, 0);
                const isExpanded = expandedRequests.has(req.id);

                return (
                  <div key={req.id}>
                    <div
                      className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-all cursor-pointer group"
                      onClick={() => toggleExpanded(req.id)}
                    >
                      <div className="text-muted-foreground">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-foreground text-sm uppercase tracking-tight">
                          {person?.isRegistered && <span className="text-muted-foreground mr-1 opacity-70">(CLT)</span>}
                          {pName(req.personId)}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-[9px] text-muted-foreground uppercase font-medium">
                            {person?.department || "Geral"} • {req.location || 'Local Não Definido'}
                          </p>
                          {jName(req).includes("Removido (") && (
                            <Select onValueChange={(newId) => onUpdateRequest({ ...req, jobId: newId })}>
                              <SelectTrigger className="h-5 text-[9px] w-[120px] bg-red-50 border-red-200 py-0">
                                <SelectValue placeholder="Vincular Job..." />
                              </SelectTrigger>
                              <SelectContent>
                                {jobs.map(j => <SelectItem key={j.id} value={j.id} className="text-[10px]">{j.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                      <div className="text-xs tabular-nums font-bold text-muted-foreground hidden sm:block">
                        {fDate(req.startDate)} <span className="mx-1 text-muted-foreground/30">→</span> {fDate(req.endDate)}
                      </div>
                      <div className="flex gap-1.5 flex-wrap hidden md:flex">
                        {(req.meals || []).map(m => (
                          <span key={m} className="px-2 py-0.5 rounded-md border border-border text-[9px] uppercase font-black bg-muted text-foreground tracking-tighter">
                            {MEAL_LABELS[m] || m}
                          </span>
                        ))}
                      </div>
                      <div className="font-black tabular-nums text-foreground tracking-tight text-base min-w-[100px] text-right">
                        R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onRemoveRequest(req.id); }}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="bg-muted/20 border-t border-border">
                        <div className="px-6 py-3">
                          <div className="grid grid-cols-[1fr_repeat(3,80px)_80px] gap-2 text-[9px] uppercase tracking-widest font-black text-muted-foreground pb-2 border-b border-border">
                            <span>Dia</span>
                            <span className="text-center">Café</span>
                            <span className="text-center">Almoço</span>
                            <span className="text-center">Janta</span>
                            <span className="text-right">Total</span>
                          </div>
                          <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
                            {(days || []).map(date => {
                              const activeMeals = getActiveMeals(req, date, person);
                              const weekend = isWeekend(date);
                              const holiday = isHoliday(date);
                              const holidayName = holiday ? getHolidayName(date) : "";
                              const isWeekendOrHol = weekend || holiday;
                              const dayTotal = activeMeals.reduce((s, m) => s + getMealValue(m, date, person, req.location), 0);

                              return (
                                <div
                                  key={date}
                                  className={`grid grid-cols-[1fr_repeat(3,80px)_80px] gap-2 items-center py-2 text-xs ${isWeekendOrHol ? 'bg-accent/30' : ''}`}
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold tabular-nums text-foreground">{fDate(date)}</span>
                                    <span className={`text-[9px] uppercase font-medium flex gap-1 items-center ${isWeekendOrHol ? 'text-accent-foreground font-black' : 'text-muted-foreground'}`}>
                                      {dayOfWeek(date)}
                                      {holiday && <span className="text-primary text-[8px] italic tracking-tight">({holidayName})</span>}
                                    </span>
                                  </div>
                                  {(["cafe", "almoco", "janta"] as MealType[]).map(meal => {
                                    const val = getMealValue(meal, date, person, req.location);
                                    const isCLTFree = meal === "almoco" && person?.isRegistered && !isWeekendOrHoliday(date);
                                    const isActive = activeMeals.includes(meal);
                                    const isBlockedCafeToggle = meal === "cafe" && person?.isRegistered && req.isLocal && req.location === "Dentro SP";

                                    return (
                                      <div key={meal} className={`flex flex-col items-center gap-0.5 ${isBlockedCafeToggle ? 'opacity-50' : ''}`}>
                                        <Checkbox
                                          checked={isActive}
                                          disabled={isBlockedCafeToggle}
                                          onCheckedChange={() => toggleDayMeal(req, date, meal)}
                                          className={`h-5 w-5 ${isBlockedCafeToggle ? 'cursor-not-allowed' : ''}`}
                                        />
                                        <span className={`text-[9px] tabular-nums ${isCLTFree ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                                          {isCLTFree && isActive ? 'ISENTO' : (isActive ? `R$${val.toFixed(0)}` : '—')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  <div className="text-right font-bold tabular-nums text-foreground">
                                    R$ {dayTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Dialog open={showFinanceDialog} onOpenChange={setShowFinanceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> Confirmar Envio ao Financeiro
            </DialogTitle>
            <DialogDescription>
              O registro de horas foi gerado com sucesso para o projeto <strong>{jName(selectedJob)}</strong>.
              Deseja notificar o financeiro e prosseguir para a tela de pagamentos?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Profissionais no Projeto:</span>
              <span className="font-bold">{financeSummary.count}</span>
            </div>
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground font-medium">Valor Total Estimado:</span>
              <span className="font-black text-primary">R$ {financeSummary.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowFinanceDialog(false)} className="flex-1">
              Depois
            </Button>
            <Button onClick={handleConfirmFinance} className="flex-1 bg-primary">
              Enviar Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MealRequestSystem;
