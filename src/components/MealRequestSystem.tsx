import React, { useState, useMemo } from "react";
import { Plus, Trash2, AlertCircle, Utensils, Calendar, ChevronDown, ChevronRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
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
  type FoodControlEntry,
  type TimeEntry,
  type DiscountConfirmation,
  type PaymentConfirmation,
} from "@/lib/types";

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
}: MealRequestSystemProps) => {
  const [selectedJob, setSelectedJob] = useState("");
  const [location, setLocation] = useState<LocationType>("Dentro SP");
  const [transportType, setTransportType] = useState<"onibus" | "aviao">("onibus");
  const [travelTime, setTravelTime] = useState("");
  const [personId, setPersonId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [meals, setMeals] = useState<MealType[]>(["cafe", "almoco", "janta"]);
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());

  const balance = useMemo(() => {
    if (!personId || !people || !requests) return 0;
    return calculatePersonBalance(personId, requests, foodControl, confirmations, people, timeEntries);
  }, [personId, requests, foodControl, confirmations, people, timeEntries]);

  const handleAdd = () => {
    if (!selectedJob || !personId || !startDate || !endDate) return;

    const person = people.find(p => p.id === personId);
    const overrides: Record<string, MealType[]> = {};
    const dates = getDatesInRange(startDate, endDate);
    let hasOverride = false;

    // Se é registrado e selecionou almoço, remove do solicitado de Seg a Sex
    if (person?.isRegistered && meals.includes("almoco")) {
      dates.forEach(date => {
        if (!isWeekend(date)) {
          overrides[date] = meals.filter(m => m !== "almoco");
          hasOverride = true;
        }
      });
    }

    const newRequest: MealRequest = {
      id: crypto.randomUUID(),
      personId,
      jobId: selectedJob,
      startDate,
      endDate,
      meals,
      dailyOverrides: hasOverride ? overrides : {},
      location,
      transportType,
      travelTime: travelTime || undefined,
    };
    onUpdateRequest(newRequest);
    setPersonId("");
    toast.success("Solicitação adicionada!", { duration: 5000 });
  };

  const handleSendAll = () => {
    if (filtered.length === 0) return;
    
    let createdCount = 0;
    filtered.forEach(req => {
      const dates = getDatesInRange(req.startDate, req.endDate);
      dates.forEach(date => {
        const existing = timeEntries.find(e => e.personId === req.personId && e.jobId === req.jobId && e.date === date);
        if (!existing && onUpdateTimeEntry) {
          onUpdateTimeEntry({
            id: crypto.randomUUID(),
            personId: req.personId,
            jobId: req.jobId,
            date,
            entry1: "", exit1: "", entry2: "", exit2: "", entry3: "", exit3: ""
          });
          createdCount++;
        }
      });
    });

    toast.success(`${filtered.length} solicitação(ões) processadas. ${createdCount > 0 ? `${createdCount} dia(s) criados no Registro de Horas!` : 'Todas as datas já constavam no Registro de Horas!'}`, { duration: 5000 });
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

  const filtered = useMemo(() => {
    if (!selectedJob) return requests || [];
    return (requests || []).filter(r => r.jobId === selectedJob);
  }, [requests, selectedJob]);

  const pName = (id: string) => (people || []).find(p => p.id === id)?.name || "—";
  const jName = (id: string) => (jobs || []).find(j => j.id === id)?.name || "—";
  const fDate = (d: string) => (d && d.includes("-") ? d.split("-").reverse().join("/") : d || "—");

  const dayOfWeek = (d: string) => {
    try {
      const date = new Date(d + "T12:00:00");
      return date.toLocaleDateString("pt-BR", { weekday: "short" });
    } catch { return ""; }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2 animate-in fade-in duration-500">
      {/* HEADER E CONFIGURAÇÃO DE JOB */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-2">
          <Label className="text-2xs uppercase tracking-widest font-black text-primary flex items-center gap-2">
            <Utensils className="h-3 w-3" /> Selecionar Job de Montagem
          </Label>
          <SearchableSelect
            options={(jobs || []).map(j => ({ value: j.id, label: j.name }))}
            value={selectedJob}
            onValueChange={setSelectedJob}
            placeholder="Escolha o projeto..."
          />
        </div>
        <div className="space-y-2">
          <Label className="text-2xs uppercase tracking-widest font-black text-muted-foreground">Local das Refeições</Label>
          <Select value={location} onValueChange={(v) => setLocation(v as LocationType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOCATIONS.map(loc => (
                <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* FORMULÁRIO DE ADIÇÃO */}
      <div className={`rounded-2xl border border-border p-6 shadow-lg space-y-6 ring-1 ring-primary/5 transition-opacity bg-muted/10`}>
        <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Registrar Novas Refeições</h2>
            <div className="flex items-center gap-2 text-2xs text-muted-foreground italic">
              <Calendar className="h-3 w-3" /> Configurando Job: {jName(selectedJob)}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pessoa no Projeto</Label>
              <SearchableSelect
                options={(people || []).map(p => ({
                  value: p.id,
                  label: p.isRegistered ? `${p.name} (CLT)` : p.name
                }))}
                value={personId}
                onValueChange={setPersonId}
                placeholder="Selecione o profissional..."
              />
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
                {(["cafe", "almoco", "janta"] as MealType[]).map(m => (
                  <div key={m} className="flex items-center gap-3">
                    <Checkbox
                      id={`meal-${m}`}
                      checked={meals.includes(m)}
                      onCheckedChange={(checked) => {
                        if (checked) setMeals([...meals, m]);
                        else setMeals(meals.filter(x => x !== m));
                      }}
                    />
                    <Label htmlFor={`meal-${m}`} className="text-xs font-bold cursor-pointer select-none">{MEAL_LABELS[m]}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Data Início</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-11 bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Data Término</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-11 bg-background" />
            </div>
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
            <Button
              onClick={handleAdd}
              disabled={!personId || !startDate || !endDate}
              className="h-11 w-full bg-foreground text-background font-black uppercase tracking-widest hover:bg-foreground/90 transition-all shadow-md active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 mr-2" /> Adicionar
            </Button>
          </div>
        </div>

      {/* LISTA COM EXPANSÃO */}
      <div className={`rounded-2xl border border-border overflow-hidden bg-card shadow-card transition-opacity`}>
        <div className="px-6 py-4 bg-muted/40 border-b border-border flex justify-between items-center">
            <h3 className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">Refeições Programadas</h3>
            <div className="flex gap-3 items-center">
              <span className="text-[9px] bg-primary/10 text-primary px-3 py-1 rounded-full font-black uppercase">{filtered.length} Ativos</span>
              <Button
                onClick={handleSendAll}
                disabled={filtered.length === 0}
                size="sm"
                className="bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-8 px-4"
              >
                <Send className="h-3 w-3 mr-1.5" /> Enviar para Registro
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
                  const activeMeals = (req.dailyOverrides?.[d] ?? req.meals) as MealType[];
                  return acc + (Array.isArray(activeMeals) ? activeMeals.reduce((sum, m) => sum + getMealValue(m, d, person), 0) : 0);
                }, 0);
                const isExpanded = expandedRequests.has(req.id);

                return (
                  <div key={req.id}>
                    {/* Row principal - clicável */}
                    <div
                      className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-all cursor-pointer group"
                      onClick={() => toggleExpanded(req.id)}
                    >
                      <div className="text-muted-foreground">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-foreground text-sm uppercase tracking-tight">{pName(req.personId)}</p>
                        <p className="text-[9px] text-muted-foreground uppercase font-medium">{req.location || 'Local Não Definido'}</p>
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

                    {/* Detalhe expandido por dia */}
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
                              const activeMeals: MealType[] = Array.isArray(req.dailyOverrides?.[date])
                                ? (req.dailyOverrides![date] as MealType[])
                                : [...(req.meals || [])];
                              const weekend = isWeekend(date);
                              const dayTotal = activeMeals.reduce((s, m) => s + getMealValue(m, date, person), 0);

                              return (
                                <div
                                  key={date}
                                  className={`grid grid-cols-[1fr_repeat(3,80px)_80px] gap-2 items-center py-2 text-xs ${weekend ? 'bg-accent/30' : ''}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold tabular-nums text-foreground">{fDate(date)}</span>
                                    <span className={`text-[9px] uppercase font-medium ${weekend ? 'text-accent-foreground font-black' : 'text-muted-foreground'}`}>
                                      {dayOfWeek(date)}
                                    </span>
                                  </div>
                                  {(["cafe", "almoco", "janta"] as MealType[]).map(meal => {
                                    const val = getMealValue(meal, date, person);
                                    const isFree = meal === "almoco" && person?.isRegistered && !weekend;
                                    const isActive = isFree ? false : activeMeals.includes(meal);
                                    
                                    return (
                                      <div key={meal} className="flex flex-col items-center gap-0.5">
                                        <Checkbox
                                          checked={isActive}
                                          onCheckedChange={() => toggleDayMeal(req, date, meal)}
                                          disabled={isFree}
                                          className="h-5 w-5"
                                        />
                                        <span className={`text-[9px] tabular-nums ${isFree ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                                          {isFree ? 'N/A' : (isActive ? `R$${val.toFixed(0)}` : '—')}
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
  );
};

export default MealRequestSystem;
