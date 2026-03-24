import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Check, ChevronDown, ChevronRight, Filter, Undo2, Trash2, Calendar } from "lucide-react";
import { sendTeamsNotification, sendWhatsAppMessage, sendEmailNotification, notifyFinancePayment } from "@/lib/notifications";
import { toast } from "sonner";
import {
  type Person,
  type Job,
  type MealRequest,
  type TimeEntry,
  type PaymentConfirmation,
  MEAL_LABELS,
  getDatesInRange,
  getMealValue,
  calculatePersonBalance,
  calculateDayDiscount,
  type FoodControlEntry,
  type DiscountConfirmation,
} from "@/lib/types";

interface PaymentTabProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries: TimeEntry[];
  foodControl: FoodControlEntry[];
  confirmations: (DiscountConfirmation | PaymentConfirmation)[];
  onUpdateConfirmation: (conf: PaymentConfirmation) => void;
  onUpdateDiscountConfirmation?: (conf: DiscountConfirmation) => void;
  onRemoveConfirmation?: (id: string) => void;
  onRemoveRequest?: (id: string) => void;
}

const PaymentTab = ({
  people,
  jobs,
  requests,
  timeEntries,
  foodControl,
  confirmations,
  onUpdateConfirmation,
  onUpdateDiscountConfirmation,
  onRemoveConfirmation,
  onRemoveRequest,
}: PaymentTabProps) => {

  const [filterJob, setFilterJob] = useState("all");
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  
  // Persistência local para evitar que recarregue e volte para 'Aplicado'
  const [applyBalanceMap, setApplyBalanceMap] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("applyBalanceMap");
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem("applyBalanceMap", JSON.stringify(applyBalanceMap));
  }, [applyBalanceMap]);

  const getPersonName = (id: string) => people.find((p) => p.id === id)?.name || "—";
  const getJobName = (id: string) => jobs.find((j) => j.id === id)?.name || "—";

  const registeredRequests = requests.filter((req) => {
    const dates = getDatesInRange(req.startDate, req.endDate);
    return dates.some((date) => timeEntries.some((e) => e.personId === req.personId && e.date === date));
  });

  const filteredRequests = (filterJob === "all")
    ? registeredRequests
    : registeredRequests.filter((r) => r.jobId === filterJob);

  const groupedByJob = useMemo(() => {
    const map = new Map<string, typeof filteredRequests>();
    filteredRequests.forEach((req) => {
      const arr = map.get(req.jobId) || [];
      arr.push(req);
      map.set(req.jobId, arr);
    });
    return map;
  }, [filteredRequests]);

  const toggleRequest = (id: string) => {
    setExpandedRequests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getConfirmation = (id: string) => {
    return (confirmations || []).find((c) => 'id' in c && c.id === id) as PaymentConfirmation | undefined;
  };

  const calcRequestBruto = (req: MealRequest) => {
    const person = people.find((p) => p.id === req.personId);
    const dates = getDatesInRange(req.startDate, req.endDate);
    let total = 0;
    dates.forEach((date) => {
      const dayMeals = req.dailyOverrides?.[date] ?? req.meals;
      if (Array.isArray(dayMeals)) {
        dayMeals.forEach((m) => { total += getMealValue(m, date, person); });
      }
    });
    return total;
  };

  const getRequestDiscounts = (req: MealRequest) => {
    let total = 0;
    const dates = getDatesInRange(req.startDate, req.endDate);
    dates.forEach(d => {
        const entry = timeEntries.find(e => e.personId === req.personId && e.jobId === req.jobId && e.date === d);
        const fc = foodControl.find(f => f.personId === req.personId && f.jobId === req.jobId && f.date === d);
        if (entry) {
          total += calculateDayDiscount(req, d, entry, fc, people).total;
        } else if (d < new Date().toISOString().split("T")[0]) {
          total += calculateDayDiscount(req, d, undefined, fc, people).total;
        }
    });
    return total;
  };

  const confirmPayment = (id: string, type: "request" | "job", paymentDate: string) => {
    if (type === "request") {
      const req = requests.find(r => r.id === id);
      if (req) {
        const shouldApply = (applyBalanceMap[id] !== false);
        const currentReqBruto = calcRequestBruto(req);
        const currentReqDiscounts = getRequestDiscounts(req);
        const currentReqNet = currentReqBruto - currentReqDiscounts;
        const totalWallet = calculatePersonBalance(req.personId, requests, foodControl, confirmations, people, timeEntries);
        const retroBalance = totalWallet - currentReqNet;
        const finalValue = shouldApply ? Math.max(0, currentReqNet + retroBalance) : currentReqBruto;

        onUpdateConfirmation({ id, type, paymentDate, confirmed: true });

        const personName = getPersonName(req.personId);
        const jobName = getJobName(req.jobId);
        const waMsg = `✅ *Pagamento Confirmado - Sistema ACT*\n\n👤 Funcionário: ${personName}\n🏗️ Projeto: ${jobName}\n📅 Data: ${paymentDate}\n💰 Valor: R$ ${finalValue.toFixed(2)}`;
        sendWhatsAppMessage(waMsg);
        toast.success(`Pagamento de ${personName} confirmado!`);
      }
    }

    if (type === "job") {
      const jobId = id.replace("job-", "");
      const jobReqs = registeredRequests.filter(r => r.jobId === jobId);
      onUpdateConfirmation({ id: `job-${jobId}`, type: 'job', paymentDate, confirmed: true });

      jobReqs.forEach(req => {
        onUpdateConfirmation({ id: req.id, type: 'request', paymentDate, confirmed: true });
      });

      toast.success(`Pagamento integral do projeto confirmado!`);
    }
  };

  const removeConfirmation = (id: string) => {
    const existing = getConfirmation(id);
    if (existing) {
      onUpdateConfirmation({ ...existing, confirmed: false });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end p-3 rounded-lg border border-border bg-muted/30">
        <Filter className="h-4 w-4 text-muted-foreground mt-1" />
        <div className="min-w-[200px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">Filtrar Job</label>
          <SearchableSelect
            options={[{ value: "all", label: "Todos os Jobs" }, ...jobs.map(j => ({ value: j.id, label: j.name }))]}
            value={filterJob}
            onValueChange={setFilterJob}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="space-y-4">
        {Array.from(groupedByJob.keys()).map((jobId) => {
          const jobReqs = groupedByJob.get(jobId)!;
          const jobConf = getConfirmation(`job-${jobId}`);
          const isJobPaid = jobConf?.confirmed;
          const jobPaymentDate = jobConf?.paymentDate || new Date().toISOString().split("T")[0];

          return (
            <div key={jobId} className="rounded-xl border border-border overflow-hidden shadow-card">
              <div className="bg-muted/50 px-4 py-3 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-foreground">{getJobName(jobId)}</h3>
                  {isJobPaid && <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-200 py-0.5">✓ Pago ({jobConf.paymentDate})</Badge>}
                </div>
                {!isJobPaid ? (
                  <div className="flex items-center gap-2">
                    <Input type="date" className="h-9 text-xs w-40 px-3 flex-row-reverse" value={jobPaymentDate} onChange={(e) => onUpdateConfirmation({ id: `job-${jobId}`, type: 'job', paymentDate: e.target.value, confirmed: false })} />
                    <Button size="sm" className="h-9 bg-primary" onClick={() => confirmPayment(`job-${jobId}`, "job", jobPaymentDate)}>Confirmar Job</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => removeConfirmation(`job-${jobId}`)}>Estornar Job</Button>
                )}
              </div>

              <div className="divide-y divide-border">
                {jobReqs.map((req) => {
                  const person = people.find(p => p.id === req.personId);
                  const conf = getConfirmation(req.id);
                  const isPaid = isJobPaid || conf?.confirmed;
                  const paymentDate = conf?.paymentDate || jobPaymentDate;

                  const currentReqBruto = calcRequestBruto(req);
                  const discounts = getRequestDiscounts(req);
                  const currentReqNet = currentReqBruto - discounts;
                  const totalWallet = calculatePersonBalance(req.personId, requests, foodControl, confirmations, people, timeEntries);
                  const retroBalance = totalWallet - currentReqNet;

                  // LÓGICA DE PERSISTÊNCIA: Usa estado local com fallback de localStorage
                  const shouldApply = (applyBalanceMap[req.id] !== undefined) ? applyBalanceMap[req.id] : true;
                  
                  const finalValue = shouldApply ? (currentReqNet + retroBalance) : currentReqBruto;

                  return (
                    <div key={req.id} className="p-4 bg-background">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleRequest(req.id)}>
                            {expandedRequests.has(req.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                          <div>
                            <p className="text-sm font-bold flex items-center gap-2">
                              {getPersonName(req.personId)} 
                              {isPaid && <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-200">✓ Pago</Badge>}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{req.startDate.split("-").reverse().join("/")} — {req.endDate.split("-").reverse().join("/")}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                           <div className="text-right">
                              <p className="text-[10px] uppercase font-black text-muted-foreground/60 leading-none">Total Pix</p>
                              <p className="text-lg font-black tabular-nums">R$ {finalValue.toFixed(2)}</p>
                              <div className="flex flex-col items-end pt-1">
                                {shouldApply && discounts > 0 && <span className="text-[10px] text-destructive line-through opacity-60">- R$ {discounts.toFixed(2)} [DESC. FALTA]</span>}
                                {shouldApply && Math.abs(retroBalance) > 0.1 && (
                                  <span className={`text-[10px] font-bold ${retroBalance < 0 ? 'text-destructive' : 'text-blue-600'}`}>
                                    {retroBalance < 0 ? '' : '+'} R$ {retroBalance.toFixed(2)} [SALDO ANTERIOR]
                                  </span>
                                )}
                                {!shouldApply && <span className="text-[10px] text-destructive font-black italic">SALDO/DESC. NÃO APLICADO</span>}
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                             {!isPaid ? (
                               <>
                                 <Button 
                                    size="sm" 
                                    variant={shouldApply ? "default" : "outline"} 
                                    className={`h-8 text-[9px] font-black uppercase ${shouldApply ? "bg-blue-600 hover:bg-blue-700" : "bg-muted/20 text-muted-foreground"}`}
                                    onClick={() => setApplyBalanceMap(prev => ({ ...prev, [req.id]: !shouldApply }))}
                                  >
                                    {shouldApply ? "APLICADO" : "NÃO APLICADO"}
                                  </Button>
                                  <Input type="date" className="h-10 text-xs w-36 px-2 flex-row-reverse" value={paymentDate} onChange={(e) => onUpdateConfirmation({ id: req.id, type: 'request', paymentDate: e.target.value, confirmed: false })} />
                                  <Button size="sm" variant="outline" className="h-8" onClick={() => confirmPayment(req.id, "request", paymentDate)}>Confirmar</Button>
                               </>
                             ) : (
                               <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1" onClick={() => removeConfirmation(req.id)}><Undo2 className="h-3 w-3" /> Estornar</Button>
                             )}
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { if (confirm("Apagar?")) onRemoveRequest?.(req.id); }}><Trash2 className="h-4 w-4" /></Button>
                           </div>
                        </div>
                      </div>
                      {expandedRequests.has(req.id) && (
                        <div className="mt-4 ml-10 p-3 rounded-lg border border-border bg-muted/20">
                           <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Detalhamento</p>
                           <div className="flex flex-wrap gap-2">
                             {req.meals.map(m => <Badge key={m} variant="outline" className="text-[10px]">{MEAL_LABELS[m]}</Badge>)}
                           </div>
                           <p className="text-xs text-muted-foreground mt-2 italic">Saldo Retroativo: R$ {retroBalance.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentTab;
