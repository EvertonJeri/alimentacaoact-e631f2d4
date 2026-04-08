import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { User, ChevronDown, ChevronUp, Send, CheckCircle2 } from "lucide-react";
import {
  type Person,
  type Job,
  type MealRequest,
  type TimeEntry,
  type FoodControlEntry,
  getDatesInRange,
  getMealValue,
  calculateDayDiscount,
  type DiscountConfirmation,
  type PaymentConfirmation,
  type SystemSettings,
} from "@/lib/types";
import { sendWhatsAppMessage, notifyFinancePayment, notifyAdminPayment, shareMessage } from "@/lib/notifications";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  type: 'desconto' | 'extra';
  reason: string;
  value: number;
  jobId: string;
  projectName?: string;
  discountId?: string;
  isDiscountDone?: boolean;
  isOtherJob?: boolean;
}

interface PersonStatement {
  personId: string;
  jobId: string;
  startDate: string;
  endDate: string;
  isLiquidated: boolean;
  totalRequested: number;
  totalAdjustments: number;
  totalFinal: number;
  details: StatementDetail[];
}

const StatementTab = ({ people = [], jobs = [], requests = [], timeEntries = [], foodControl = [], confirmations = [], onUpdatePaymentConfirmation, systemSettings }: StatementTabProps) => {
  const [selectedJob, setSelectedJob] = useState("all");
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set());

  const getPersonName = (id: string) => {
    const p = people.find((p) => p.id === id);
    if (p) return p.name;
    const pByName = people.find(p => p.name.toLowerCase().trim() === id.toLowerCase().trim());
    if (pByName) return pByName.name;
    return id;
  };
  const getJobName = (id: string) => jobs.find(j => j.id === id)?.name || "\u2014";

  const getConfirmation = (id: string) => {
    const rawConfs = (confirmations || []);
    // Verifica tanto com o prefixo stmt- quanto o ID bruto (usado na aba de pagamento)
    return rawConfs.find(c => 'id' in c && (c.id === id || c.id === id.replace('stmt-', ''))) as PaymentConfirmation | undefined;
  };

  const personStatements = useMemo(() => {
    const data: Record<string, PersonStatement> = {};
    const processedDays = new Set<string>();

    const safeRequests = requests || [];
    const safeTime = timeEntries || [];
    const safeFood = foodControl || [];
    const safeConfs = confirmations || [];

    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD Local
    
    // Passo 0: Coletar todos os dias com atividade para garantir que órfãos não sumam
    const allActivityDates = new Set<string>();
    safeRequests.forEach(r => {
      getDatesInRange(r.startDate, r.endDate).forEach(d => {
        if (d < todayStr) allActivityDates.add(`${r.personId}|${d}|${r.jobId}`);
      });
    });
    safeTime.forEach(e => {
        if (e.date < todayStr) allActivityDates.add(`${e.personId}|${e.date}|${e.jobId}`);
    });
    safeFood.forEach(f => {
        if (f.date < todayStr) allActivityDates.add(`${f.personId}|${f.date}|${f.jobId}`);
    });

    // Passo 1: Para cada atividade detectada, calcula o solicitado e os descontos
    Array.from(allActivityDates).forEach(activity => {
      const [pid, date, activityJobId] = activity.split('|');
      const person = people.find(p => p.id === pid);
      if (!person) return;

      // Tenta achar uma solicitação para este dia
      const req = safeRequests.find(r => r.personId === pid && date >= r.startDate && date <= r.endDate && r.jobId === activityJobId);
      const jobId = activityJobId || 'unknown';
      const key = `${pid}-${jobId}`;

      const isLiquidated = req 
        ? !!getConfirmation(`stmt-${req.id}`)?.confirmed 
        : safeConfs.some(c => 'id' in c && c.id === `orphan-${pid}-${date}` && c.confirmed);

      if (!data[key]) {
        data[key] = {
          personId: pid,
          jobId: jobId,
          startDate: req?.startDate || date,
          endDate: req?.endDate || date,
          isLiquidated,
          totalRequested: 0,
          totalAdjustments: 0,
          totalFinal: 0,
          details: []
        };
      } else {
        // Atualiza datas
        if (date < data[key].startDate) data[key].startDate = date;
        if (date > data[key].endDate) data[key].endDate = date;
      }

      const dayKey = `${pid}-${jobId}-${date}`;
      if (processedDays.has(dayKey)) return;
      processedDays.add(dayKey);

      // Valor solicitado do dia (Zero se for órfão)
      let dayValue = 0;
      if (req) {
         const reqMeals = (req.dailyOverrides?.[date] ?? req.meals) || [];
         dayValue = reqMeals.reduce((acc, m) => acc + getMealValue(m, date, person), 0);
      }
      data[key].totalRequested += dayValue;

      // Descontos/extras do dia - Busca MAIS FLEXÍVEL para jobId
      const jobMatchFinder = (itemJobId: string, targetJobId: string) => {
          if (!itemJobId || !targetJobId) return false;
          if (itemJobId === targetJobId) return true;
          // Se um for o número e o outro o UUID ou Nome, tenta bater
          const job = jobs.find(j => j.id === targetJobId);
          if (!job) return false;
          const jobNumber = job.name.split(" - ")[0].trim();
          return itemJobId === jobNumber || itemJobId === job.name;
      };

      const entry = safeTime.find(e => String(e.personId) === String(pid) && jobMatchFinder(e.jobId, jobId) && e.date === date);
      const fc = safeFood.find(f => String(f.personId) === String(pid) && jobMatchFinder(f.jobId, jobId) && f.date === date);
      
      // Cálculo de desconto
      const dayCalc = calculateDayDiscount(
        req || { id: `orphan-${pid}-${date}`, personId: pid, jobId, startDate: date, endDate: date, meals: [] }, 
        date, entry || undefined, fc, people
      );

      if (Math.abs(dayCalc.total) > 0.01) {
        const discountId = req ? `discount-${req.id}-${date}` : `orphan-${pid}-${date}`;
        const isItemDone = safeConfs.some(c => 'id' in c && (c.id === discountId || c.id === `orphan-${pid}-${date}`) && c.confirmed);
        
        // Ajuste só entra no total a pagar se NÃO está resolvido
        if (!isItemDone) {
          data[key].totalAdjustments += dayCalc.total;
        }

        data[key].details.push({
          date,
          type: dayCalc.total < 0 ? 'desconto' : 'extra',
          reason: dayCalc.reason + (req ? '' : ' (Sem Solicitação)'),
          value: dayCalc.total,
          jobId: jobId,
          projectName: getJobName(jobId),
          discountId,
          isDiscountDone: isItemDone,
          isOtherJob: false
        });
      }
    });

    // Passo 2: Para cada pessoa/job, buscar descontos de QUALQUER outro job (não liquidados)
    // Isso inclui órfãos de outros jobs.
    Object.values(data).forEach(ps => {
      if (ps.isLiquidated) return;

      // Busca por todos os ajustes pendentes que não pertencem a este ps.jobId
      const allOtherAdjustments = Array.from(allActivityDates)
        .map(activity => {
          const [pid, date, jobId] = activity.split('|');
          if (pid !== ps.personId || jobId === ps.jobId) return null;
          
          const req = safeRequests.find(r => r.personId === pid && date >= r.startDate && date <= r.endDate && r.jobId === jobId);
          const entry = safeTime.find(e => e.personId === pid && e.jobId === jobId && e.date === date);
          const fc = safeFood.find(f => f.personId === pid && f.jobId === jobId && f.date === date);
          
          const discountId = req ? `discount-${req.id}-${date}` : `orphan-${pid}-${date}`;
          const isItemDone = safeConfs.some(c => 'id' in c && c.id === discountId && c.confirmed);
          if (isItemDone) return null;

          // Só nos importa se for de um job ainda NÃO liquidado
          const isOtherJobLiquidated = req ? !!getConfirmation(`stmt-${req.id}`)?.confirmed : false;
          if (isOtherJobLiquidated) return null;

          const dayCalc = calculateDayDiscount(
            req || { id: `orphan-${pid}-${date}`, personId: pid, jobId, startDate: date, endDate: date, meals: [] }, 
            date, entry || undefined, fc, people
          );

          if (Math.abs(dayCalc.total) < 0.01) return null;

          return { date, dayCalc, jobId, discountId };
        })
        .filter(Boolean) as { date: string, dayCalc: any, jobId: string, discountId: string }[];

      // Evitar duplicatas em processedDays (já processado no ps.details principal)
      allOtherAdjustments.forEach(adj => {
        const otherDayKey = `other-${ps.personId}-${ps.jobId}-${adj.jobId}-${adj.date}`;
        if (processedDays.has(otherDayKey)) return;
        processedDays.add(otherDayKey);

        ps.totalAdjustments += adj.dayCalc.total;
        ps.details.push({
          date: adj.date,
          type: adj.dayCalc.total < 0 ? 'desconto' : 'extra',
          reason: `[OUTRO JOB: ${getJobName(adj.jobId)}] ${adj.dayCalc.reason}`,
          value: adj.dayCalc.total,
          jobId: adj.jobId,
          discountId: adj.discountId,
          isDiscountDone: false,
          isOtherJob: true
        });
      });
    });

    // Passo 3: Converter objeto em array e calcular totais finais
    return Object.values(data)
      .map(ps => ({
        ...ps,
        totalFinal: Math.max(0, ps.totalRequested + ps.totalAdjustments)
      }))
      .filter(ps => (selectedJob === "all" || ps.jobId === selectedJob) && (ps.totalRequested > 0 || Math.abs(ps.totalAdjustments) > 0.01))
      .sort((a, b) => getPersonName(a.personId).localeCompare(getPersonName(b.personId)));
  }, [requests, foodControl, people, timeEntries, confirmations, selectedJob, jobs]);


  const pendingStatements = useMemo(() => {
    return personStatements
      .filter(s => !s.isLiquidated)
      .sort((a, b) => (b.endDate || "").localeCompare(a.endDate || ""));
  }, [personStatements]);

  const paidStatements = useMemo(() => {
    return personStatements.filter(s => s.isLiquidated);
  }, [personStatements]);

  const togglePerson = (id: string) => {
    setExpandedPeople(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSettlePerson = (personId: string, jobId: string) => {
    if (!onUpdatePaymentConfirmation) return;
    const today = new Date().toISOString().split("T")[0];
    
    // 1. Liquidar Requests
    const pendingReqs = requests.filter(r => String(r.personId) === String(personId) && String(r.jobId) === String(jobId) && !getConfirmation(`stmt-${r.id}`)?.confirmed);
    pendingReqs.forEach(req => {
      const existing = getConfirmation(`stmt-${req.id}`);
      onUpdatePaymentConfirmation({ 
          ...existing, 
          id: existing?.id || `stmt-${req.id}`, 
          personId: req.personId,
          type: 'request', 
          confirmed: true, 
          paymentDate: today 
      });
    });

    // 2. Liquidar Orphans (Descontos avulsos sem request)
    // Buscamos todas as atividades deste person/job que resultaram em descontos
    const orphanPrefix = `orphan-${personId}-`;
    const pendingOrphans = personStatements.find(ps => ps.personId === personId && ps.jobId === jobId)?.details
      .filter(d => d.discountId?.startsWith('orphan-') && !d.isDiscountDone) || [];
    
    pendingOrphans.forEach(d => {
      if (d.discountId) {
        onUpdatePaymentConfirmation({ id: d.discountId, type: 'discount', confirmed: true, paymentDate: today });
      }
    });

    if (pendingReqs.length > 0 || pendingOrphans.length > 0) {
      toast.success("Ajustes e solicitações liquidadas!");
    }
  };

  const handleRevertSettle = (personId: string, jobId: string) => {
    if (!onUpdatePaymentConfirmation) return;
    
    // 1. Reverter Requests
    const liquidatedReqs = requests.filter(r => String(r.personId) === String(personId) && String(r.jobId) === String(jobId) && getConfirmation(`stmt-${r.id}`)?.confirmed);
    liquidatedReqs.forEach(req => {
      const existing = getConfirmation(`stmt-${req.id}`);
      if (existing) onUpdatePaymentConfirmation({ ...existing, confirmed: false });
    });

    // 2. Reverter Orphans
    const liquidatedOrphans = personStatements.find(ps => ps.personId === personId && ps.jobId === jobId)?.details
      .filter(d => d.discountId?.startsWith('orphan-') && d.isDiscountDone) || [];
    
    liquidatedOrphans.forEach(d => {
      if (d.discountId) {
        onUpdatePaymentConfirmation({ id: d.discountId, type: 'discount', confirmed: false, paymentDate: '' });
      }
    });

    if (liquidatedReqs.length > 0 || liquidatedOrphans.length > 0) {
      toast.success("Liquidação revertida! Itens voltaram para Pendentes.");
    }
  };

  const handleRevertDiscount = (discountId: string) => {
    if (!onUpdatePaymentConfirmation) return;
    onUpdatePaymentConfirmation({ id: discountId, type: 'discount', confirmed: false, paymentDate: '' });
    toast.success("Desconto revertido!");
  };

  const handleMarkDiscountDone = (discountId: string) => {
    if (!onUpdatePaymentConfirmation) return;
    const today = new Date().toISOString().split("T")[0];
    onUpdatePaymentConfirmation({ id: discountId, type: 'discount', confirmed: true, paymentDate: today });
    toast.success("Marcado como descontado!");
  };

  const buildWhatsAppMessage = (ps: PersonStatement) => {
    const pName = getPersonName(ps.personId);
    const jName = getJobName(ps.jobId);
    let msg = `\ud83d\udcca *EXTRATO DE ALIMENTA\u00c7\u00c3O*\n\n`;
    msg += `\ud83d\udc64 *Profissional:* ${pName}\n`;
    msg += `\ud83c\udfd7\ufe0f *Job:* ${jName}\n`;
    msg += `\ud83d\udcc5 Per\u00edodo: ${ps.startDate.split("-").reverse().join("/")} a ${ps.endDate.split("-").reverse().join("/")}\n\n`;
    msg += `\ud83d\udcb0 *Solicitado:* R$ ${ps.totalRequested.toFixed(2)}\n`;
    msg += `\u2699\ufe0f *Ajustes:* R$ ${ps.totalAdjustments.toFixed(2)}\n`;
    msg += `\ud83d\udcb5 *VALOR FINAL:* R$ ${ps.totalFinal.toFixed(2)}\n\n`;
    if (ps.details.length > 0) {
      msg += `\ud83d\udcdd *Detalhamento:*\n`;
      ps.details.forEach(d => {
        const dateStr = d.date.split("-").reverse().join("/");
        const sign = d.value > 0 ? '+' : '';
        msg += `${dateStr} - ${d.reason}: ${sign}R$ ${Math.abs(d.value).toFixed(2)}${d.isDiscountDone ? ' (J\u00e1 descontado)' : ''}\n`;
      });
    }
    msg += `\n_Enviado via Sistema ACT_`;
    return msg;
  };

  const handleSettleBatch = () => {
    if (!onUpdatePaymentConfirmation) return;
    if (pendingStatements.length === 0) {
      toast.info("Não há extratos pendentes para liquidar.");
      return;
    }

    if (confirm(`Deseja liquidar ${pendingStatements.length} extratos em aberto? Isso moverá todos para 'Liquidados'.`)) {
      pendingStatements.forEach(ps => {
         handleSettlePerson(ps.personId, ps.jobId);
      });
      toast.success("Liquidação em lote processada!");
    }
  };

  const sendAllWhatsApp = () => {
    const allMsgs = pendingStatements.map(ps => buildWhatsAppMessage(ps)).join("\n\n---\n\n");
    shareMessage(allMsgs);
  };

  const fDate = (d: string) => d ? d.split("-").reverse().join("/") : "";

  return (
    <div className="space-y-6">
      {/* FILTROS */}
      <div className="flex flex-wrap gap-4 items-end p-4 rounded-xl border border-border bg-muted/30">
        <div className="flex-1 min-w-[240px]">
          <SearchableSelect
            options={[{ value: "all", label: "Todos os Jobs" }, ...jobs.map(j => ({ value: j.id, label: j.name }))]}
            value={selectedJob} onValueChange={setSelectedJob}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExpandedPeople(new Set(personStatements.map(ps => `${ps.personId}-${ps.jobId}`)))}>Abrir Todos</Button>
          <Button variant="outline" onClick={() => setExpandedPeople(new Set())}>Recolher</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white font-bold gap-2" onClick={sendAllWhatsApp}>
            <Send className="h-4 w-4" /> MANDAR TODOS P/ ZAP
          </Button>
          <Button onClick={() => window.print()}>PDF</Button>
        </div>
      </div>

      {/* EXTRATOS EM ABERTO */}
      <div className="flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Extratos em Aberto</span>
      </div>

      <div className="space-y-4 pb-10">
        {pendingStatements.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum extrato pendente encontrado.</div>
        )}

        {pendingStatements.map((ps) => {
          const key = `${ps.personId}-${ps.jobId}`;
          const isExpanded = expandedPeople.has(key);

          return (
            <Card key={key} className="overflow-hidden border-border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between cursor-pointer space-y-0" onClick={() => togglePerson(key)}>
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm tracking-tight">{getPersonName(ps.personId)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[9px] h-4 bg-muted/30 whitespace-pre">
                        {getJobName(ps.jobId).split(" - ")[0]}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
                        {fDate(ps.startDate)} {"\u2014"} {fDate(ps.endDate)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end mr-2">
                    <div className="flex items-center gap-2 mb-1">
                      {onUpdatePaymentConfirmation && (
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSettlePerson(ps.personId, ps.jobId); }} className="h-6 text-[9px] font-black uppercase text-green-700 hover:bg-green-50">
                          Liquidar Ajustes
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const msg = buildWhatsAppMessage(ps);
                          shareMessage(msg);
                        }}
                        className="h-6 text-[9px] font-black uppercase text-green-700 hover:bg-green-50 border border-green-100"
                      >
                        <Send className="h-3 w-3 mr-1" /> Zap
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-black text-muted-foreground/60 leading-none">Total</p>
                      <p className="text-lg font-black tabular-nums leading-none mt-1">R$ {ps.totalFinal.toFixed(2)}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="p-0 border-t border-border bg-muted/5">
                  {/* Resumo em 3 colunas */}
                  <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-background">
                    <div className="p-3 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground font-bold">Solicitado</p>
                      <p className="text-sm font-black">R$ {ps.totalRequested.toFixed(2)}</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground font-bold">Ajustes</p>
                      <p className={`text-sm font-black ${ps.totalAdjustments < 0 ? 'text-destructive' : 'text-green-600'}`}>
                        R$ {ps.totalAdjustments.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 text-center bg-primary/5">
                      <p className="text-[10px] uppercase text-primary font-bold">Valor Final</p>
                      <p className="text-base font-black text-primary">R$ {ps.totalFinal.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Detalhamento */}
                  <div className="p-3 space-y-0.5">
                    {ps.details.map((d, i) => (
                      <div key={i} className={`flex items-center justify-between py-2 border-b border-border/40 last:border-0 px-2 text-xs ${d.isOtherJob ? 'bg-amber-50/30' : ''}`}>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{fDate(d.date)}</span>
                          <span className={`truncate ${d.isDiscountDone ? 'line-through opacity-50' : 'font-semibold'}`}>
                            {d.reason}
                          </span>
                          {d.isDiscountDone && (
                            <Badge variant="secondary" className="text-[8px] h-4 shrink-0 bg-gray-100 text-gray-600 font-bold">
                              J{"\u00c1"} DESCONTADO
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className={`font-black tabular-nums ${d.isDiscountDone ? 'line-through opacity-50 text-gray-400' : (d.value < 0 ? 'text-destructive' : 'text-green-600')}`}>
                            {d.value > 0 ? '+' : ''}R$ {Math.abs(d.value).toFixed(2)}
                          </span>
                          {d.discountId && onUpdatePaymentConfirmation && (
                            d.isDiscountDone ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-5 text-[8px] font-black uppercase text-red-600 border-red-200 hover:bg-red-50 px-2"
                                onClick={() => handleRevertDiscount(d.discountId!)}
                              >
                                Reverter
                              </Button>
                            ) : null
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* EXTRATOS LIQUIDADOS (Arquivados) */}
      {paidStatements.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-1 mt-8">
            <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Extratos Liquidados</span>
          </div>
          <div className="space-y-2 opacity-60">
            {paidStatements.map((ps) => {
              const key = `${ps.personId}-${ps.jobId}`;
              return (
                <Card key={key} className="overflow-hidden border-border/50 bg-muted/20">
                  <CardHeader className="py-2 px-4 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="font-medium text-xs text-muted-foreground">{getPersonName(ps.personId)}</span>
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="text-[8px] h-3.5 opacity-60">{getJobName(ps.jobId).split(" - ")[0]}</Badge>
                           <span className="text-[9px] text-muted-foreground opacity-60">{fDate(ps.startDate)} a {fDate(ps.endDate)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-muted-foreground">R$ {ps.totalFinal.toFixed(2)}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-[8px] font-black uppercase text-red-600 hover:bg-red-50 hover:text-red-700 bg-white"
                        onClick={() => handleRevertSettle(ps.personId, ps.jobId)}
                      >
                         Reverter
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default StatementTab;
