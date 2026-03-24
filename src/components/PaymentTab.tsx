import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Check, ChevronDown, ChevronRight, Filter, Undo2, Trash2, MessageSquare, Mail } from "lucide-react";
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
  const [applyBalanceMap, setApplyBalanceMap] = useState<Record<string, boolean>>({});

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
    return confirmations.find((c) => 'id' in c && c.id === id) as PaymentConfirmation | undefined;
  };

  const confirmPayment = (id: string, type: "request" | "job", paymentDate: string) => {
    const shouldApply = applyBalanceMap[id] !== false; // Default true

    if (type === "request") {
      const req = requests.find(r => r.id === id);
      if (req) {
        const personName = getPersonName(req.personId);
        const jobName = getJobName(req.jobId);
        
        // Calculamos o saldo retroativo (tudo MENOS esta solicitação atual)
        const totalWallet = calculatePersonBalance(req.personId, requests, foodControl, confirmations, people, timeEntries);
        const currentReqBruto = calcRequestTotal(req);
        
        // Calculamos descontos desta solicitação p/ isolar o saldo antigo
        let currentReqDiscounts = 0;
        const dates = getDatesInRange(req.startDate, req.endDate);
        dates.forEach(d => {
            const entry = timeEntries.find(e => e.personId === req.personId && e.jobId === req.jobId && e.date === d);
            const fc = foodControl.find(f => f.personId === req.personId && f.jobId === req.jobId && f.date === d);
            if (entry) currentReqDiscounts += calculateDayDiscount(req, d, entry, fc, people).total;
        });
        
        const currentReqNet = currentReqBruto - currentReqDiscounts;
        const retroBalance = totalWallet - currentReqNet;
        
        const appliedBalance = shouldApply ? retroBalance : 0;
        const finalTotal = shouldApply ? Math.max(0, currentReqNet + retroBalance) : currentReqBruto;

        onUpdateConfirmation({ 
            id, 
            type, 
            paymentDate, 
            confirmed: true, 
            applyBalance: shouldApply,
            appliedBalance: appliedBalance
        });

        const jobReqs = registeredRequests.filter(r => r.jobId === req.jobId);
        const otherReqsConfirmed = jobReqs.every(r => r.id === id || getConfirmation(r.id)?.confirmed);
        if (otherReqsConfirmed) {
          onUpdateConfirmation({ id: `job-${req.jobId}`, type: "job", paymentDate, confirmed: true });
        }

        // ==== NOTIFICAÇÕES (Pagamento Individual) ====
        const teamsMsg = `**✅ Pagamento Confirmado**\n\n**Funcionário:** ${personName}\n**Projeto:** ${jobName}\n**Data de Pagamento:** ${paymentDate}\n**Valor:** R$ ${finalTotal.toFixed(2)}`;
        sendTeamsNotification("✅ Pagamento Confirmado – Sistema ACT", teamsMsg, "00B050");

        const waMsg = `✅ *Pagamento Confirmado - Sistema ACT*\n\n👤 Funcionário: ${personName}\n🏗️ Projeto: ${jobName}\n📅 Data: ${paymentDate}\n💰 Valor: R$ ${finalTotal.toFixed(2)}`;
        sendWhatsAppMessage(waMsg);

        const emailSubject = `Pagamento Confirmado – ${personName} – ${jobName}`;
        const emailBody = `Olá,\n\nInformamos que o pagamento abaixo foi confirmado no Sistema ACT:\n\nFuncionário: ${personName}\nProjeto: ${jobName}\nData de Pagamento: ${paymentDate}\nValor Total: R$ ${finalTotal.toFixed(2)}\n\nAtenciosamente,\nSistema ACT`;
        sendEmailNotification(emailSubject, emailBody);

        // ==== NOTIFICAÇÃO ESPECÍFICA PARA O FINANCEIRO ====
        const financeDetails = `👤 Funcionário: ${personName}\n🏗️ Projeto: ${jobName}\n📅 Data: ${paymentDate}\n💰 Valor: R$ ${finalTotal.toFixed(2)}`;
        notifyFinancePayment(financeDetails);

        toast.success(`Pagamento de ${personName} confirmado! Notificações disparadas.`, { duration: 5000 });
      }
    }

    if (type === "job") {
      // Extrai o jobId do id composto "job-XXXX"
      const jobId = id.replace("job-", "");
      const jobName = getJobName(jobId);
      const jobReqs = registeredRequests.filter(r => r.jobId === jobId);

      // Monta resumo de todos os funcionários do job
      const lines = jobReqs.map(r => {
        const name = getPersonName(r.personId);
        const val = calcRequestTotal(r);
        return { name, val };
      });
      const totalJob = lines.reduce((s, l) => s + l.val, 0);
      const listText = lines.map(l => `• ${l.name}: R$ ${l.val.toFixed(2)}`).join("\n");

      // ==== NOTIFICAÇÕES (Pagamento por Job) ====
      const teamsMsg = `**✅ Pagamento Integral do Projeto**\n\n**Projeto:** ${jobName}\n**Data:** ${paymentDate}\n**Total Pago:** R$ ${totalJob.toFixed(2)}\n\n**Funcionários:**\n${listText}`;
      sendTeamsNotification("✅ Pagamento Integral do Projeto – Sistema ACT", teamsMsg, "00B050");

      const waMsg = `✅ *Pagamento Integral do Projeto - Sistema ACT*\n\n🏗️ Projeto: ${jobName}\n📅 Data: ${paymentDate}\n💰 Total: R$ ${totalJob.toFixed(2)}\n\n👥 Equipe:\n${listText}`;
      sendWhatsAppMessage(waMsg);

      const emailSubject = `Pagamento Integral do Projeto – ${jobName}`;
      const emailBody = `Olá,\n\nInformamos que o pagamento integral do projeto abaixo foi confirmado no Sistema ACT:\n\nProjeto: ${jobName}\nData de Pagamento: ${paymentDate}\nTotal Pago: R$ ${totalJob.toFixed(2)}\n\nFuncionários:\n${listText}\n\nAtenciosamente,\nSistema ACT`;
      sendEmailNotification(emailSubject, emailBody);

      toast.success(`Pagamento integral do projeto ${jobName} confirmado! Notificações disparadas.`, { duration: 5000 });
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
                        className="h-10 text-xs w-40 tabular-nums px-3 flex-row-reverse"
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
                  const person = people.find((p) => p.id === req.personId);
                  const conf = getConfirmation(req.id);
                  const isPaid = conf?.confirmed;
                  const paymentDate = conf?.paymentDate || new Date().toISOString().split("T")[0];
                  const totalWallet = calculatePersonBalance(req.personId, requests, foodControl, confirmations, people, timeEntries);
                  const currentReqBruto = calcRequestTotal(req);
                  let currentReqDiscounts = 0;
                  const dates = getDatesInRange(req.startDate, req.endDate);
                  dates.forEach(d => {
                      const entry = timeEntries.find(e => e.personId === req.personId && e.jobId === req.jobId && e.date === d);
                      const fc = foodControl.find(f => f.personId === req.personId && f.jobId === req.jobId && f.date === d);
                      if (entry) currentReqDiscounts += calculateDayDiscount(req, d, entry, fc, people).total;
                  });
                  const currentReqNet = currentReqBruto - currentReqDiscounts;
                  const retroBalance = totalWallet - currentReqNet;
                  
                  // Se já está pago: usa o estado CONGELADO do banco
                  // Se ainda não pago: usa o estado local (applyBalanceMap)
                  const frozenApply = isPaid ? (conf?.applyBalance !== false) : (applyBalanceMap[req.id] !== false);
                  
                  const finalTotal = isPaid 
                    ? (frozenApply ? (currentReqNet + (conf?.appliedBalance || 0)) : currentReqBruto) 
                    : (frozenApply ? Math.max(0, currentReqNet + retroBalance) : currentReqBruto);

                  const displayAdjustment = isPaid 
                    ? (frozenApply ? (conf?.appliedBalance || 0) : 0)
                    : (frozenApply ? retroBalance : 0);

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
                              {person?.isRegistered && <span className="text-muted-foreground font-black text-[10px]">(CLT)</span>}
                              {getPersonName(req.personId)}
                              {isPaid && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">✓ Pago</Badge>}
                            </p>
                            {person?.pix && (
                              <p className="text-[10px] text-primary font-bold uppercase tracking-widest leading-none mt-1">
                                <span className="opacity-60 font-medium">PIX:</span> {person.pix}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {req.startDate?.includes("-") ? req.startDate.split("-").reverse().join("/") : "—"} — {req.endDate?.includes("-") ? req.endDate.split("-").reverse().join("/") : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right flex flex-col items-end gap-0.5">
                            <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/60 leading-none">Total Pix</p>
                            <p className="text-base font-black tabular-nums tracking-tighter text-foreground leading-none">R$ {finalTotal.toFixed(2)}</p>
                            
                            <div className="flex flex-col items-end pt-1">
                              {/* Se Saldo ON: Mostra o desconto da montagem atual riscado */}
                              {(frozenApply && currentReqDiscounts > 0) && (
                                <span className="text-[10px] text-destructive font-medium opacity-60 line-through">
                                  - R$ {currentReqDiscounts.toFixed(2)} [DESC. FALTA]
                                </span>
                              )}
                              
                              {/* Se Saldo ON: Mostra o ajuste retroativo (se houver) */}
                              {(frozenApply && Math.abs(displayAdjustment) > 0.1) && (
                                <span className={`text-[10px] font-bold ${displayAdjustment < 0 ? 'text-destructive' : 'text-blue-600'}`}>
                                  {displayAdjustment < 0 ? '' : '+'} R$ {displayAdjustment.toFixed(2)} [SALDO ANTERIOR]
                                </span>
                              )}

                              {/* Se Saldo OFF: Mostra o valor bruto da montagem sem descontos */}
                              {!frozenApply && (
                                <span className="text-[10px] text-destructive font-black italic">
                                  SALDO/DESC. NÃO APLICADO
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                if (confirm("Deseja realmente apagar esta solicitação?")) {
                                  onRemoveRequest?.(req.id);
                                }
                              }}
                              title="Apagar solicitação"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>

                            {/* Botão de Abater Saldo (Toggle) */}
                            {/* Quando pago: exibe o estado congelado mas desabilitado */}
                            {isPaid ? (
                                <Button
                                    size="sm"
                                    disabled
                                    className={`h-8 text-[9px] px-2 font-black uppercase tracking-tight cursor-not-allowed opacity-70 ${
                                        frozenApply
                                        ? "bg-blue-600 text-white"
                                        : "border border-muted-foreground/30 text-muted-foreground bg-muted/20"
                                    }`}
                                    title="Pagamento confirmado. Estorne para alterar."
                                >
                                    🔒 {frozenApply ? "APLICADO" : "NÃO APLICADO"}
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    variant={applyBalanceMap[req.id] === false ? "outline" : "default"}
                                    onClick={() => setApplyBalanceMap(prev => ({ ...prev, [req.id]: !(prev[req.id] !== false) }))}
                                    className={`h-8 text-[9px] px-2 font-black uppercase tracking-tight transition-all duration-300 ${
                                        applyBalanceMap[req.id] === false 
                                        ? "border-muted-foreground/30 text-muted-foreground bg-muted/20" 
                                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm ring-1 ring-blue-400/50"
                                    }`}
                                >
                                    {applyBalanceMap[req.id] === false ? "NÃO APLICADO" : "APLICADO"}
                                </Button>
                            )}
                            
                            {!isPaid ? (
                              <>
                                <Input
                                  type="date"
                                  className="h-10 text-xs w-40 tabular-nums px-3 flex-row-reverse"
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
                                  className="h-10 text-xs w-40 tabular-nums opacity-50 cursor-not-allowed px-3 flex-row-reverse"
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
                             {Math.abs(retroBalance) > 0.1 && (
                               <div className={`text-xs p-2 rounded border ${retroBalance < 0 ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-blue-500/10 border-green-200 text-blue-600'}`}>
                                 <strong>Saldo Retroativo:</strong> R$ {retroBalance.toFixed(2)} ({retroBalance < 0 ? 'Débito' : 'Crédito'} acumulado de outras montagens)
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
