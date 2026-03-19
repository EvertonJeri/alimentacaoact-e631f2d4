import React, { useState, useMemo } from "react";
import { Plus, Trash2, AlertCircle, Utensils, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  type Person,
  type Job,
  type MealRequest,
  type MealType,
  type LocationType,
  MEAL_LABELS,
  LOCATIONS,
  getDatesInRange,
  getMealValue,
  calculatePersonBalance,
  type FoodControlEntry,
  type DiscountConfirmation,
  type PaymentConfirmation,
} from "@/lib/types";

interface MealRequestSystemProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  foodControl: FoodControlEntry[];
  confirmations: (DiscountConfirmation | PaymentConfirmation)[];
  onUpdateRequest: (req: MealRequest) => void;
  onRemoveRequest: (id: string) => void;
}

const MealRequestSystem = ({
  people = [],
  jobs = [],
  requests = [],
  foodControl = [],
  confirmations = [],
  onUpdateRequest,
  onRemoveRequest,
}: MealRequestSystemProps) => {
  // 1. Estados de Seleção do Job e Local
  const [selectedJob, setSelectedJob] = useState("");
  const [location, setLocation] = useState<LocationType>("Dentro SP");

  // 2. Estados de Adição de Pessoa
  const [personId, setPersonId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [meals, setMeals] = useState<MealType[]>(["cafe", "almoco", "janta"]);

  // 3. Cálculo de Saldo Instantâneo (Feedback ao usuário)
  const balance = useMemo(() => {
    if (!personId || !people || !requests) return 0;
    return calculatePersonBalance(personId, requests, foodControl, confirmations, people);
  }, [personId, requests, foodControl, confirmations, people]);

  // 4. Lógica de Adição
  const handleAdd = () => {
    if (!selectedJob || !personId || !startDate || !endDate) return;

    const newRequest: MealRequest = {
      id: crypto.randomUUID(),
      personId,
      jobId: selectedJob,
      startDate,
      endDate,
      meals,
      dailyOverrides: {},
      location,
    };

    onUpdateRequest(newRequest);
    setPersonId(""); // Limpa seleção para próxima entrada
  };

  // 5. Filtro e Detalhes
  const filtered = useMemo(() => {
    return (requests || []).filter(r => r.jobId === selectedJob);
  }, [requests, selectedJob]);

  const pName = (id: string) => (people || []).find(p => p.id === id)?.name || "—";
  const jName = (id: string) => (jobs || []).find(j => j.id === id)?.name || "—";
  const fDate = (d: string) => (d && d.includes("-") ? d.split("-").reverse().join("/") : d || "—");

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
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCATIONS.map(loc => (
                <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* FORMULÁRIO DE ADIÇÃO (Só visível se um Job estiver selecionado) */}
      {selectedJob && (
        <div className="rounded-2xl border border-border p-6 bg-muted/10 shadow-lg space-y-6 ring-1 ring-primary/5">
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
                    <span className="font-bold">Saldo do Funcionário: R$ {balance.toFixed(2)}</span>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Data de Início das Refeições</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-11 bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Data do Término</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-11 bg-background" />
            </div>
            <Button 
              onClick={handleAdd} 
              disabled={!personId || !startDate || !endDate}
              className="h-11 w-full bg-foreground text-background font-black uppercase tracking-widest hover:bg-foreground/90 transition-all shadow-md active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 mr-2" /> Adicionar na Programação
            </Button>
          </div>
        </div>
      )}

      {/* LISTA DE SOLICITAÇÕES JÁ REGISTRADAS NESTE JOB */}
      {selectedJob && (
        <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-card">
          <div className="px-6 py-4 bg-muted/40 border-b border-border flex justify-between items-center">
            <h3 className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">Listagem de Refeições Programadas</h3>
            <div className="flex gap-2">
              <span className="text-[9px] bg-primary/10 text-primary px-3 py-1 rounded-full font-black uppercase">{filtered.length} Ativos</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/10 text-muted-foreground border-b border-border">
                  <th className="px-6 py-4 text-left font-black text-[9px] uppercase tracking-widest">Funcionário</th>
                  <th className="px-6 py-4 text-left font-black text-[9px] uppercase tracking-widest">Período Selecionado</th>
                  <th className="px-6 py-4 text-left font-black text-[9px] uppercase tracking-widest">Kit Refeição</th>
                  <th className="px-6 py-4 text-right font-black text-[9px] uppercase tracking-widest">Custo Est. (R$)</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground italic tracking-widest text-xs opacity-60">
                      Nenhuma solicitação ativa para este job. Adicione acima.
                    </td>
                  </tr>
                ) : (
                  filtered.map(req => {
                    const days = getDatesInRange(req.startDate, req.endDate);
                    const totalCost = (days || []).reduce((acc, d) => {
                      const person = people.find(p => p.id === req.personId);
                      const activeMeals = (req.dailyOverrides?.[d] ?? req.meals) as MealType[];
                      return acc + (Array.isArray(activeMeals) ? activeMeals.reduce((sum, m) => sum + getMealValue(m, d, person), 0) : 0);
                    }, 0);

                    return (
                      <tr key={req.id} className="hover:bg-muted/30 transition-all group">
                        <td className="px-6 py-5">
                          <p className="font-black text-foreground text-sm uppercase tracking-tight">{pName(req.personId)}</p>
                          <p className="text-[9px] text-muted-foreground uppercase font-medium">{req.location || 'Local Não Definido'}</p>
                        </td>
                        <td className="px-6 py-5 text-xs tabular-nums font-bold text-muted-foreground">
                          {fDate(req.startDate)} <span className="mx-2 text-muted-foreground/30 font-light">até</span> {fDate(req.endDate)}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex gap-2 flex-wrap">
                            {(req.meals || []).map(m => (
                              <span key={m} className="px-2.5 py-1 rounded-lg border border-border text-[9px] uppercase font-black bg-muted text-foreground tracking-tighter shadow-sm">
                                {MEAL_LABELS[m] || m}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right font-black tabular-nums text-foreground tracking-tight text-base">
                          R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => onRemoveRequest(req.id)}
                            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all rounded-xl border border-transparent hover:border-destructive/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealRequestSystem;
