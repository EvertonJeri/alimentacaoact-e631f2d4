import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Check, ChevronDown, ChevronRight, Filter, Undo2 } from "lucide-react";
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
}: PaymentTabProps) => {

  const [filterJob, setFilterJob] = useState("all");
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());

  const getPersonName = (id: string) => people.find((p) => p.id === id)?.name || "—";
  const getJobName = (id: string) => jobs.find((j) => j.id === id)?.name || "—";

  const registeredRequests = requests.filter((req) => {
    const dates = getDatesInRange(req.startDate, req.endDate);
    return dates.some((date) => timeEntries.some((e) => e.personId === req.personId && e.date === date));
  });

  const filteredRequests = filterJob === "all"
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
    return (confirmations as any[]).find((c) => c.id === id) as PaymentConfirmation | undefined;
  };

  const confirmPayment = (id: string, type: "request" | "job", paymentDate: string) => {
    onUpdateConfirmation({ id, type, paymentDate, confirmed: true });

    if (type === "request") {
      const req = requests.find(r => r.id === id);
      if (req) {
        // Evaluate deduction auto-abatimento
        const personBalance = calculatePersonBalance(req.personId, requests, foodControl, confirmations, people, timeEntries);
        if (personBalance < 0 && onUpdateDiscountConfirmation) {
          onUpdateDiscountConfirmation({
            personId: req.personId,
            confirmed: true,
            paymentDate
          });
        }

        const jobReqs = registeredRequests.filter(r => r.jobId === req.jobId);
        const otherReqsConfirmed = jobReqs.every(r => r.id === id || getConfirmation(r.id)?.confirmed);
        if (otherReqsConfirmed) {
          onUpdateConfirmation({ id: `job-${req.jobId}`, type: "job", paymentDate, confirmed: true });
        }
      }
    }
  };

  const updatePaymentDate = (id: string, type: "request" | "job", date: string) => {
     onUpdateConfirmation({ id, type, paymentDate: date, confirmed: getConfirmation(id)?.confirmed || false });
  };

  const removeConfirmation = (id: string) => {
    const existing = getConfirmation(id);
    if (existing) {
      onUpdateConfirmation({ id: existing.id, type: existing.type, paymentDate: existing.paymentDate, confirmed: false });
    }
  };

  const calcRequestTotal = (req: MealRequest) => {
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

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Registro de pagamentos das solicitações de refeições. Confirme o pagamento por solicitação individual ou por job completo.
      </p>

      <div className="flex flex-wrap gap-3 items-end p-3 rounded-lg border border-border bg-muted/30">
        <Filter className="h-4 w-4 text-muted-foreground mt-1" />
        <div className="min-w-[200px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Filtrar Job
          </label>
          <SearchableSelect
            options={[{ value: "all", label: "Todos os Jobs" }, ...jobs.map(j => ({ value: j.id, label: j.name }))]}
            value={filterJob}
            onValueChange={setFilterJob}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="space-y-4">
        {Array.from(groupedByJob.keys()).map((jobId: string) => {
          const jobReqs = groupedByJob.get(jobId)!;
          const jobConf = getConfirmation(`job-${jobId}`);
          const isJobPaid = jobConf?.confirmed;
          const jobPaymentDate = jobConf?.paymentDate || new Date().toISOString().split("T")[0];

          return (
            <div key={jobId} className="rounded-xl border border-border overflow-hidden shadow-card">
              <div className="bg-muted/50 px-4 py-3 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-foreground">{getJobName(jobId)}</h3>
                  {isJobPaid && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-200 gap-1.5 py-0.5">
                      <Check className="h-3 w-3" /> ✓ Pago ({jobConf.paymentDate})
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {!isJobPaid ? (
                    <>
                      <Input
                        type="date"
                        className="h-8 text-xs w-32 tabular-nums"
                        value={jobPaymentDate}
                        onChange={(e) => updatePaymentDate(`job-${jobId}`, "job", e.target.value)}
                      />
                      <Button
                        size="sm"
                        className="h-8 gap-2 bg-primary hover:bg-primary/90"
                        onClick={() => confirmPayment(`job-${jobId}`, "job", jobPaymentDate)}
                      >
                        <Check className="h-4 w-4" /> Marcar Job como Pago
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground hover:text-destructive gap-2"
                      onClick={() => removeConfirmation(`job-${jobId}`)}
                    >
                      <Undo2 className="h-3 w-3" /> Estornar Pagamento Job
                    </Button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-border">
                {jobReqs.map((req) => {
                  const conf = getConfirmation(req.id);
                  const isPaid = conf?.confirmed;
                  const paymentDate = conf?.paymentDate || new Date().toISOString().split("T")[0];
                  const total = calcRequestTotal(req);
                  const personBalance = calculatePersonBalance(req.personId, requests, foodControl, confirmations, people, timeEntries);
                  const deduction = personBalance < 0 ? personBalance : 0;
                  const finalTotal = Math.max(0, total + deduction);

                  return (
                    <div key={req.id} className="bg-background hover:bg-muted/5 transition-colors">
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleRequest(req.id)}
                          >
                            {expandedRequests.has(req.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <div>
                            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                              {getPersonName(req.personId)}
                              {isPaid && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">✓ Pago</Badge>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {req.startDate?.includes("-") ? req.startDate.split("-").reverse().join("/") : "—"} — {req.endDate?.includes("-") ? req.endDate.split("-").reverse().join("/") : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Total</p>
                            <div className="flex flex-col items-end">
                              {deduction < 0 && (
                                <span className="text-[10px] text-destructive line-through decoration-destructive/50">R$ {total.toFixed(2)}</span>
                              )}
                              <p className="text-sm font-bold tabular-nums">R$ {finalTotal.toFixed(2)}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {!isPaid ? (
                              <>
                                <Input
                                  type="date"
                                  className="h-8 text-xs w-32 tabular-nums"
                                  value={paymentDate}
                                  onChange={(e) => updatePaymentDate(req.id, "request", e.target.value)}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-2 border-primary/20 hover:bg-primary/5"
                                  onClick={() => confirmPayment(req.id, "request", paymentDate)}
                                >
                                  Confirmar Pago
                                </Button>
                              </>
                            ) : (
                              <div className="flex items-center gap-3">
                                <Input
                                  type="date"
                                  disabled
                                  className="h-8 text-xs w-32 tabular-nums opacity-50 cursor-not-allowed"
                                  value={paymentDate}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeConfirmation(req.id)}
                                  title="Estornar pagamento"
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {expandedRequests.has(req.id) && (
                        <div className="px-14 pb-4 animate-in slide-in-from-top-2 duration-200">
                          <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                             {personBalance !== 0 && (
                               <div className={`text-xs p-2 rounded border ${personBalance < 0 ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-green-500/10 border-green-200 text-green-600'}`}>
                                 <strong>Saldo Global:</strong> R$ {personBalance.toFixed(2)} ({personBalance < 0 ? 'Débito' : 'Crédito'} acumulado de outras montagens)
                               </div>
                             )}
                             <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Detalhamento da Solicitação</p>
                             <div className="flex flex-wrap gap-2">
                               {(req.meals || []).map(m => (
                                 <Badge key={m} variant="outline" className="capitalize text-[10px]">{MEAL_LABELS[m]}</Badge>
                               ))}
                             </div>
                             <p className="text-xs text-muted-foreground italic">
                               Localização: {req.location || 'Não definida'}
                             </p>
                          </div>
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
