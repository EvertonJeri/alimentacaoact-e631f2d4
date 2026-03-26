import { useState, useMemo, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CheckCircle2, FileDown, Filter, Info, User, Users, ChevronDown, ChevronUp, Eye, EyeOff, Calendar, Send } from "lucide-react";
import {
  type Person,
  type Job,
  type MealRequest,
  type TimeEntry,
  type FoodControlEntry,
  getDatesInRange,
  getMealValue,
  MEAL_LABELS,
  calculateDayDiscount,
  calculatePersonBalance,
  type DiscountConfirmation,
  type PaymentConfirmation,
  type SystemSettings,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface StatementTabProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries: TimeEntry[];
  foodControl: FoodControlEntry[];
  confirmations: (DiscountConfirmation | PaymentConfirmation)[];
  onUpdatePaymentConfirmation?: (conf: PaymentConfirmation) => void;
  systemSettings?: SystemSettings;
}

interface StatementDetail {
  date: string;
  type: 'desconto' | 'extra' | 'anterior' | 'pago';
  reason: string;
  value: number;
  jobId: string;
  projectName?: string;
  mealsBreakdown?: {
    cafe?: number;
    almoco?: number;
    janta?: number;
  };
  discountId?: string;
  isDiscountDone?: boolean;
}

interface PersonStatement {
  personId: string;
  jobId: string;
  startDate: string;
  endDate: string;
  isLiquidated: boolean;
  totalRequested: number;
  totalUsed: number;
  balance: number;
  details: StatementDetail[];
}

const StatementTab = ({ people = [], jobs = [], requests = [], timeEntries = [], foodControl = [], confirmations = [], onUpdatePaymentConfirmation }: StatementTabProps) => {
  const [selectedJob, setSelectedJob] = useState("all");
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set());
  const statementRef = useRef<HTMLDivElement>(null);

  const getPersonName = (id: string) => people.find(p => p.id === id)?.name || "—";
  const getJobName = (id: string) => jobs.find(j => j.id === id)?.name || "—";

  const getRequestConfirmation = (id: string) => {
    return (confirmations || []).find(c => 'id' in c && c.id === id) as PaymentConfirmation | undefined;
  };

  const personStatements = useMemo(() => {
    const data: Record<string, PersonStatement> = {};
    const processedDays = new Set<string>();

    (requests || []).forEach(req => {
      const isLiquidated = getRequestConfirmation(`stmt-${req.id}`)?.confirmed || getRequestConfirmation(`stmt-job-${req.jobId}`)?.confirmed;
      const person = people.find(p => p.id === req.personId);
      if (!person) return;

      const key = `${req.personId}-${req.jobId}`;
      if (!data[key]) {
        data[key] = {
          personId: req.personId,
          jobId: req.jobId,
          startDate: req.startDate || "2000-01-01",
          endDate: req.endDate || "2000-01-01",
          isLiquidated: isLiquidated,
          totalRequested: 0,
          totalUsed: 0,
          balance: 0,
          details: []
        };
      }

      const dates = getDatesInRange(req.startDate, req.endDate);
      const projectName = jobs.find(j => j.id === req.jobId)?.name || 'Outro Projeto';

      dates.forEach(date => {
        const dayKey = `${req.personId}-${req.jobId}-${date}`;
        if (processedDays.has(dayKey)) return;
        processedDays.add(dayKey);

        const entry = timeEntries.find(e => e.personId === req.personId && e.jobId === req.jobId && e.date === date);
        const fc = foodControl.find(f => f.personId === req.personId && f.jobId === req.jobId && f.date === date);
        const reqMeals = (req.dailyOverrides?.[date] ?? req.meals) || [];

        // Valor Bruto sempre soma
        const dayValue = reqMeals.reduce((acc, m) => acc + getMealValue(m, date, person), 0);
        data[key].totalRequested += dayValue;

        // Calculamos descontos e extras para o Job (Sempre, para manter o histórico no extrato)
        const dayCalc = calculateDayDiscount(req, date, entry || undefined, fc, people);
          if (dayCalc.total > 0) {
              const discountId = `discount-${req.id}-${date}`;
              const isDiscountDone = getRequestConfirmation(discountId)?.confirmed || false;
              
              if (!isDiscountDone) {
                data[key].balance -= dayCalc.total;
              }
              data[key].details.push({ 
                date, 
                type: 'desconto', 
                reason: dayCalc.reason, 
                value: -dayCalc.total, 
                jobId: req.jobId, 
                projectName,
                mealsBreakdown: {
                    cafe: dayCalc.discountCafe > 0 ? -dayCalc.discountCafe : undefined,
                    almoco: dayCalc.discountAlmoco > 0 ? -dayCalc.discountAlmoco : undefined,
                    janta: dayCalc.discountJanta > 0 ? -dayCalc.discountJanta : undefined,
                },
                discountId,
                isDiscountDone
              });
          }

          if (fc) {
             (['cafe', 'almoco', 'janta'] as const).forEach(m => {
               const used = m === 'cafe' ? fc.usedCafe : m === 'almoco' ? fc.usedAlmoco : fc.usedJanta;
               if (used && !reqMeals.includes(m as any)) {
                 const v = getMealValue(m as any, date, person);
                 if (v > 0) {
                   data[key].balance += v;
                   data[key].details.push({ 
                     date, 
                     type: 'extra', 
                     reason: `${MEAL_LABELS[m]} extra`, 
                     value: v, 
                     jobId: req.jobId, 
                     projectName,
                     mealsBreakdown: { [m]: v }
                   });
                 }
               }
             });
          }
      });
    });

    requests.forEach(req => {
      const psKey = `${req.personId}-${req.jobId}`;
      if (!data[psKey]) return; // Já foi processado acima ou filtrado

      // Se este job que estamos olhando (psKey) NÃO está pago,
      // ele deve mostrar o histórico de débitos/créditos DE OUTROS JOBS também,
      // mas de forma detalhada.
    });

    return Object.values(data).map(ps => {
      if (ps.isLiquidated) {
        ps.totalUsed = ps.totalRequested + ps.balance;
        ps.details.push({ date: ps.endDate, type: 'pago', reason: '✅ Job Quitado / Liquidado', value: 0, jobId: ps.jobId });
      } else {
        // BUSCA DETALHES DE OUTROS JOBS QUE AINDA NÃO FORAM PAGOS/LIQUIDADOS
        const otherJobsRequests = requests.filter(r => r.personId === ps.personId && r.jobId !== ps.jobId && !getRequestConfirmation(`stmt-${r.id}`)?.confirmed);
        
        otherJobsRequests.forEach(otherReq => {
          const otherDates = getDatesInRange(otherReq.startDate, otherReq.endDate);
          const otherProjectName = jobs.find(j => j.id === otherReq.jobId)?.name || 'Outro Job';
          const otherPerson = people.find(p => p.id === ps.personId);

          otherDates.forEach(d => {
            const entry = timeEntries.find(e => e.personId === otherReq.personId && e.jobId === otherReq.jobId && e.date === d);
            const fc = foodControl.find(f => f.personId === otherReq.personId && f.jobId === otherReq.jobId && f.date === d);
            const reqMeals = (otherReq.dailyOverrides?.[d] ?? otherReq.meals) || [];

            const dayCalc = calculateDayDiscount(otherReq, d, entry || undefined, fc, people);
            if (dayCalc.total > 0) {
              const discountId = `discount-${otherReq.id}-${d}`;
              const isDiscountDone = getRequestConfirmation(discountId)?.confirmed || false;
              
              if (!isDiscountDone) {
                ps.balance -= dayCalc.total;
              }
              ps.details.push({ 
                date: d, 
                type: 'desconto', 
                reason: `[Outro Job: ${otherProjectName}] ${dayCalc.reason}`, 
                value: -dayCalc.total, 
                jobId: otherReq.jobId,
                discountId,
                isDiscountDone
              });
            }
            
              // Refeições extras em outros jobs pendentes
              if (fc) {
                (['cafe', 'almoco', 'janta'] as const).forEach(m => {
                  const used = m === 'cafe' ? fc.usedCafe : m === 'almoco' ? fc.usedAlmoco : fc.usedJanta;
                  if (used && !reqMeals.includes(m as any)) {
                    const v = getMealValue(m as any, d, otherPerson);
                    if (v > 0) {
                      ps.balance += v;
                      ps.details.push({ date: d, type: 'extra', reason: `[Outro Job: ${otherProjectName}] ${MEAL_LABELS[m]} extra`, value: v, jobId: otherReq.jobId });
                    }
                  }
                });
              }
            });
          });
        }
        ps.totalUsed = ps.totalRequested + ps.balance;
        return ps;
      })
      .filter(ps => selectedJob === "all" || ps.jobId === selectedJob);
  }, [requests, foodControl, people, timeEntries, confirmations, selectedJob, jobs]);

  // AGRUPAMENTO PARA EXIBIÇÃO
  const { pendingStatements, paidGroups } = useMemo(() => {
    const pending = personStatements.filter(s => !s.isLiquidated);
    const paid = personStatements.filter(s => s.isLiquidated);

    const groups: Record<string, PersonStatement[]> = {};
    paid.forEach(s => {
      groups[s.personId] = groups[s.personId] || [];
      groups[s.personId].push(s);
    });

    return { 
      pendingStatements: pending.sort((a, b) => a.endDate > b.endDate ? -1 : 1), 
      paidGroups: groups 
    };
  }, [personStatements]);

  const togglePerson = (id: string) => {
    setExpandedPeople(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSettlePerson = (personId: string, jobId: string) => {
    // Liquidar TODAS as solicitações deste job para a pessoa (já que o agrupamento é por Job e Pessoa)
    const pending = requests.filter(r => r.personId === personId && r.jobId === jobId && !getRequestConfirmation(`stmt-${r.id}`)?.confirmed);
    if (onUpdatePaymentConfirmation && pending.length > 0) {
      pending.forEach(req => onUpdatePaymentConfirmation({ 
        id: `stmt-${req.id}`, 
        type: 'request', 
        confirmed: true, 
        paymentDate: new Date().toISOString().split("T")[0] 
      }));
      toast.success(`Ajustes Liquidados para ${getPersonName(personId)} no Job ${getJobName(jobId)}!`);
    }
  };

  const handleUndoLiquidatedJob = (personId: string, jobId: string) => {
    // Tirar o liquidado daquela pessoa em determinado job
    const settled = requests.filter(r => r.personId === personId && r.jobId === jobId && getRequestConfirmation(`stmt-${r.id}`)?.confirmed);
    if (onUpdatePaymentConfirmation && settled.length > 0) {
      settled.forEach(req => onUpdatePaymentConfirmation({ 
        id: `stmt-${req.id}`, 
        type: 'request', 
        confirmed: false, 
        paymentDate: new Date().toISOString().split("T")[0] 
      }));
      toast.success(`Liquidação Desfeita para ${getPersonName(personId)} no Job ${getJobName(jobId)}!`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end p-4 rounded-xl border border-border bg-muted/30">
        <div className="flex-1 min-w-[240px]">
          <SearchableSelect
            options={[{ value: "all", label: "Todos os Jobs" }, ...jobs.map(j => ({ value: j.id, label: j.name }))]}
            value={selectedJob} onValueChange={setSelectedJob}
          />
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setExpandedPeople(new Set(personStatements.map(ps => `${ps.personId}-${ps.jobId}`)))} variant="outline">Abrir Todos</Button>
            <Button onClick={() => setExpandedPeople(new Set())} variant="outline">Recolher</Button>
            {selectedJob !== "all" && personStatements.length > 0 && (
              <Button 
                onClick={() => {
                   const jName = jobs.find(j => j.id === selectedJob)?.name || "";
                   const totalJob = personStatements.reduce((acc, ps) => acc + ps.totalUsed, 0);
                   const list = personStatements.map(ps => `👤 *${getPersonName(ps.personId)}*: R$ ${ps.totalUsed.toFixed(2)}`).join('\n');
                   const msg = `🏗️ *EXTRATO GERAL - JOB: ${jName}*\n\n${list}\n\n💰 *TOTAL DA MONTAGEM:* R$ ${totalJob.toFixed(2)}\n\n_Enviado via Sistema ACT_`;
                   
                   if (navigator.share) {
                      navigator.share({ title: `Extrato ${jName}`, text: msg }).catch(() => {
                        navigator.clipboard.writeText(msg);
                        toast.success("Resumo copiado! Cole no grupo.");
                        window.open('https://web.whatsapp.com/', '_blank');
                      });
                   } else {
                      navigator.clipboard.writeText(msg);
                      toast.success("Resumo copiado! Cole no grupo.");
                      window.open('https://web.whatsapp.com/', '_blank');
                   }
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-black uppercase text-[10px] tracking-widest px-4"
              >
                <Send className="h-3 w-3 mr-2" /> Mandar Todos p/ Zap
              </Button>
            )}
            <Button onClick={() => window.print()}>PDF</Button>
        </div>
      </div>

      <div className="space-y-8 pb-10">
        {pendingStatements.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-[0.2em] pl-1 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Extratos em Aberto
            </h3>
            <div className="space-y-3">
              {pendingStatements.map((ps) => {
                const key = `${ps.personId}-${ps.jobId}`;
                const isExpanded = expandedPeople.has(key);
                
                return (
                  <Card key={key} className="overflow-hidden border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="py-3 px-4 flex-row items-center justify-between cursor-pointer space-y-0" onClick={() => togglePerson(key)}>
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-primary" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm tracking-tight">{getPersonName(ps.personId)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[9px] h-4 bg-muted/30">{getJobName(ps.jobId)}</Badge>
                            <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
                              {ps.startDate.split("-").reverse().join("/")} — {ps.endDate.split("-").reverse().join("/")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="flex flex-col items-end mr-2">
                           <div className="flex items-center gap-2 mb-1">
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSettlePerson(ps.personId, ps.jobId); }} className="h-6 text-[9px] font-black uppercase text-green-700 hover:bg-green-50">Liquidar Ajustes</Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  const pName = getPersonName(ps.personId);
                                  const jNameStr = getJobName(ps.jobId);
                                  const discountLines = ps.details
                                     .filter(d => d.type === 'desconto')
                                     .map(d => {
                                       const date = d.date.split("-").reverse().join("/").slice(0,5);
                                       const parts = [];
                                       if (d.mealsBreakdown && d.mealsBreakdown.cafe) parts.push("Café: R$ " + Math.abs(d.mealsBreakdown.cafe).toFixed(2));
                                       if (d.mealsBreakdown && d.mealsBreakdown.almoco) parts.push("Almoço: R$ " + Math.abs(d.mealsBreakdown.almoco).toFixed(2));
                                       if (d.mealsBreakdown && d.mealsBreakdown.janta) parts.push("Janta: R$ " + Math.abs(d.mealsBreakdown.janta).toFixed(2));
                                       const breakdown = parts.length > 0 ? "\n       " + parts.join(" | ") : "";
                                       const retirado = d.isDiscountDone ? " ✅[já retirado]" : "";
                                       return "  • " + date + ": " + d.reason + retirado + " [-R$ " + Math.abs(d.value).toFixed(2) + "]" + breakdown;
                                     }).join("\n");
                                   const extraLines = ps.details
                                     .filter(d => d.type === "extra")
                                     .map(d => {
                                       const date = d.date.split("-").reverse().join("/").slice(0,5);
                                       return "  • " + date + ": " + d.reason + " [+R$ " + d.value.toFixed(2) + "]";
                                     }).join("\n");
                                   const discountSection = discountLines ? "❌ *DESCONTOS:*\n" + discountLines : "";
                                   const extraSection = extraLines ? "➕ *EXTRAS:*\n" + extraLines : "";
                                   const sections = [discountSection, extraSection].filter(Boolean).join("\n\n");
                                   const detailsStr = sections || "Nenhum ajuste registrado.";
                                   
                                   const msg = "📊 *EXTRATO DE ALIMENTAÇÃO*\n\n👤 *Profissional:* " + pName + "\n🏗️ *Job:* " + jNameStr + "\n\n💰 *Solicitado:* R$ " + ps.totalRequested.toFixed(2) + "\n⚙️ *Ajustes:* R$ " + ps.balance.toFixed(2) + "\n💵 *VALOR FINAL:* R$ " + ps.totalUsed.toFixed(2) + (detailsStr ? "\n\n" + detailsStr : "") + "\n\n_Enviado via Sistema ACT_";
                                  
                                  if (navigator.share) {
                                     navigator.share({ title: `Extrato ${pName}`, text: msg }).catch(() => {
                                       navigator.clipboard.writeText(msg);
                                       toast.success("Extrato copiado!");
                                       window.open('https://web.whatsapp.com/', '_blank');
                                     });
                                  } else {
                                     navigator.clipboard.writeText(msg);
                                     toast.success("Extrato copiado!");
                                     window.open('https://web.whatsapp.com/', '_blank');
                                  }
                                }} 
                                className="h-6 text-[9px] font-black uppercase text-green-700 hover:bg-green-50 border border-green-100"
                              >
                                <Send className="h-3 w-3 mr-1" /> Zap
                              </Button>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] uppercase font-black text-muted-foreground/60 leading-none">Total</p>
                              <p className="text-lg font-black tabular-nums leading-none mt-1">
                                R$ {ps.totalUsed.toFixed(2)}
                              </p>
                           </div>
                         </div>
                         {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="p-0 border-t border-border bg-muted/5">
                        <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-background">
                           <div className="p-3 text-center">
                              <p className="text-[10px] uppercase text-muted-foreground font-bold">Solicitado</p>
                              <p className="text-sm font-black text-foreground/80">R$ {ps.totalRequested.toFixed(2)}</p>
                           </div>
                           <div className="p-3 text-center">
                              <p className="text-[10px] uppercase text-muted-foreground font-bold">Ajustes</p>
                              <p className={`text-sm font-black ${ps.balance < 0 ? 'text-destructive' : 'text-green-600'}`}>
                                R$ {ps.balance.toFixed(2)}
                              </p>
                           </div>
                           <div className="p-3 text-center bg-primary/5">
                              <p className="text-[10px] uppercase text-primary font-bold">Valor Final</p>
                              <p className="text-base font-black text-primary">R$ {ps.totalUsed.toFixed(2)}</p>
                           </div>
                        </div>
                        <div className="p-3 space-y-1">
                           {ps.details.map((d, i) => (
                             <div key={i} className="flex flex-col py-2 border-b border-border/40 last:border-0 px-2 hover:bg-muted/10 transition-colors">
                               <div className="flex items-center justify-between text-[11px]">
                                  <div className="flex items-center gap-2">
                                     <span className="text-muted-foreground tabular-nums font-bold">{d.date.split("-").reverse().join("/").slice(0,5)}</span>
                                     <span className={`font-semibold uppercase tracking-tight ${d.isDiscountDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{d.reason}</span>
                                     {d.isDiscountDone && <Badge variant="outline" className="text-[8px] h-3 px-1 ml-1 bg-muted/50 border-muted-foreground/30">JÁ DESCONTADO</Badge>}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`font-black tabular-nums transition-colors ${d.isDiscountDone ? 'text-muted-foreground line-through' : d.value < 0 ? 'text-destructive' : 'text-green-600'}`}>
                                      {d.value > 0 && !d.isDiscountDone ? '+' : ''}R$ {Math.abs(d.value).toFixed(2)}
                                    </span>
                                    {d.type === 'desconto' && d.discountId && !ps.isLiquidated && (
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className={`h-5 w-auto px-2 text-[8px] font-black uppercase ${d.isDiscountDone ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' : 'bg-background hover:bg-muted text-muted-foreground border-border/60'}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onUpdatePaymentConfirmation) {
                                            onUpdatePaymentConfirmation({
                                              id: d.discountId!,
                                              type: 'discount',
                                              confirmed: !d.isDiscountDone,
                                              paymentDate: new Date().toISOString().split("T")[0]
                                            });
                                            if (d.isDiscountDone) toast.success("Desconto reativado no extrato.");
                                            else toast.success("Desconto marcado como já aplicado (não afeta o saldo).");
                                          }
                                        }}
                                      >
                                        {d.isDiscountDone ? 'Reverter' : '- Retirado'}
                                      </Button>
                                    )}
                                  </div>
                               </div>
                               {d.mealsBreakdown && (
                                 <div className="flex gap-3 mt-1 pl-10">
                                   {d.mealsBreakdown.cafe && <span className="text-[9px] uppercase font-bold text-muted-foreground/70">Café: <span className="text-destructive tabular-nums">{d.mealsBreakdown.cafe.toFixed(2)}</span></span>}
                                   {d.mealsBreakdown.almoco && <span className="text-[9px] uppercase font-bold text-muted-foreground/70">Almoço: <span className="text-destructive tabular-nums">{d.mealsBreakdown.almoco.toFixed(2)}</span></span>}
                                   {d.mealsBreakdown.janta && <span className="text-[9px] uppercase font-bold text-muted-foreground/70">Janta: <span className="text-destructive tabular-nums">{d.mealsBreakdown.janta.toFixed(2)}</span></span>}
                                 </div>
                               )}
                             </div>
                           ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {Object.entries(paidGroups).length > 0 && (
          <div className="space-y-3 pt-6 border-t border-dashed border-border/60">
            <h3 className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] pl-1 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Histórico de Pagamentos (Agrupado)
            </h3>
            <div className="space-y-2">
              {Object.entries(paidGroups).map(([personId, statements]) => {
                const totalPaid = statements.reduce((acc, s) => acc + s.totalUsed, 0);
                const isExpanded = expandedPeople.has(`paid-${personId}`);
                
                return (
                  <Card key={`paid-${personId}`} className="border-border/50 bg-muted/20 opacity-90 overflow-hidden">
                    <CardHeader className="py-2 px-4 flex-row items-center justify-between cursor-pointer space-y-0" onClick={() => togglePerson(`paid-${personId}`)}>
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="font-bold text-xs text-foreground/80">{getPersonName(personId)}</p>
                          <p className="text-[9px] text-muted-foreground uppercase font-medium">{statements.length} Jobs Quitados</p>
                        </div>
                      </div>
                       <div className="flex items-center gap-4">
                         <Button 
                           variant="ghost" 
                           size="sm" 
                           onClick={(e) => {
                             e.stopPropagation();
                             const pName = getPersonName(personId);
                             const statementsDetail = statements.map(s => {
                               const jn = getJobName(s.jobId);
                               const discountDetails = s.details
                                 .filter(d => d.type === 'desconto')
                                 .map(d => `  • ${d.date.split("-").reverse().join("/").slice(0,5)}: ${d.reason} [R$ ${d.value.toFixed(2)}]`)
                                 .join('\n');
                               return `🏗️ *${jn}*\n💵 Valor: R$ ${s.totalUsed.toFixed(2)}${discountDetails ? `\n📋 Descontos:\n${discountDetails}` : ''}`;
                             }).join('\n\n');
                             const msg = `📊 *EXTRATO LIQUIDADO*\n\n👤 *${pName}*\n\n${statementsDetail}\n\n💰 *Total Pago:* R$ ${totalPaid.toFixed(2)}\n\n_Enviado via Sistema ACT_`;
                             
                             if (navigator.share) {
                               navigator.share({ title: `Extrato ${pName}`, text: msg }).catch(() => {
                                 navigator.clipboard.writeText(msg);
                                 toast.success("Extrato copiado!");
                                 window.open('https://web.whatsapp.com/', '_blank');
                               });
                             } else {
                               navigator.clipboard.writeText(msg);
                               toast.success("Extrato copiado!");
                               window.open('https://web.whatsapp.com/', '_blank');
                             }
                           }}
                           className="h-6 text-[9px] font-black uppercase text-green-700 hover:bg-green-50 border border-green-100"
                         >
                           <Send className="h-3 w-3 mr-1" /> Zap
                         </Button>
                         <div className="text-right">
                           <p className="text-[9px] uppercase font-bold text-muted-foreground/60 leading-none">Total Pago</p>
                           <p className="text-sm font-black text-green-700 mt-0.5">R$ {totalPaid.toFixed(2)}</p>
                         </div>
                         {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground/60" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/60" />}
                       </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="p-0 border-t border-border/30 bg-background/50 text-[11px]">
                         <div className="divide-y divide-border/20">
                            {statements.map((s, idx) => (
                              <div key={idx} className="px-4 py-2 flex items-center justify-between hover:bg-muted/10 cursor-pointer" onClick={() => togglePerson(`${s.personId}-${s.jobId}`)}>
                                <div>
                                   <p className="font-bold text-muted-foreground">{getJobName(s.jobId)}</p>
                                   <p className="text-[9px] text-muted-foreground/60">{s.startDate.split("-").reverse().join("/")} — {s.endDate.split("-").reverse().join("/")}</p>
                                </div>
                                <p className="font-black text-green-600">R$ {s.totalUsed.toFixed(2)}</p>
                              </div>
                            ))}
                         </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatementTab;
