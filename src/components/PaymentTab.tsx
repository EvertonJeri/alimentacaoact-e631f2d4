import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Check, ChevronDown, ChevronRight, Filter, Undo2, Trash2, Calendar } from "lucide-react";
import { sendWhatsAppMessage, notifyFinancePayment, notifyAdminPayment, notifyFinanceAndHRPayment } from "@/lib/notifications";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  getActiveMeals,
  type FoodControlEntry,
  type DiscountConfirmation,
  type SystemSettings,
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
  onUpdateManualMealRequest?: (req: MealRequest) => void;
  initialJobFilter?: string;
  systemSettings?: SystemSettings;
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
  onUpdateManualMealRequest,
  initialJobFilter = "all",
  systemSettings,
}: PaymentTabProps) => {

  const [filterJob, setFilterJob] = useState(initialJobFilter);
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set<string>()); // Padrão: tudo fechado para performance!

  useEffect(() => {
    if (initialJobFilter) setFilterJob(initialJobFilter);
  }, [initialJobFilter]);
  
  const fDate = (d: string) => (d && d.includes("-") ? d.split("-").reverse().join("/") : d || "—");
  const getPersonName = (id: string) => people.find((p) => p.id === id)?.name || "—";
  const getJobName = (id: string, personId?: string) => {
    if (!id) return "—";
    const cleanId = id.trim();
    const job = jobs.find((j) => j.id === id || j.id === cleanId);
    if (job) return job.name;

    // Busca agressiva pelo número do job no meio do nome (ex: "2401 - MONTAGEM")
    const matchByNum = jobs.find(j => j.name.startsWith(cleanId + " ") || j.name.startsWith(cleanId + "-") || j.name.includes(` ${cleanId} `));
    if (matchByNum) return matchByNum.name;

    // RECUPERAÇÃO MÁGICA: Se não achou na lista de jobs, tenta achar por uma solicitação da mesma pessoa no mesmo período
    if (personId) {
        const matchingReq = requests.find(r => r.personId === personId && (r.jobId === id || r.jobId === cleanId));
        if (matchingReq) {
            const reqJob = jobs.find(j => j.id === matchingReq.jobId);
            if (reqJob) return reqJob.name;
        }
    }

    if (!id.includes("-") || id.length < 25) return id;
    return `ID #${id.substring(0, 8)}`;
  };



  const registeredRequests = useMemo(() => {
    if (!requests || !timeEntries) return [];
    
    // OTIMIZAÇÃO: Criamos um conjunto de chaves únicas para busca O(1)
    const entryKeys = new Set(timeEntries.map(e => `${e.personId}-${e.date}`));
    
    return requests.filter((req) => {
      const dates = getDatesInRange(req.startDate, req.endDate);
      return dates.some((date) => entryKeys.has(`${req.personId}-${date}`));
    });
  }, [requests, timeEntries]);

  // PERFORMANCE & CONSISTENCY: Calculamos os saldos para todas as pessoas envolvidas em requisições
  const personBalancesMap = useMemo(() => {
    const map = new Map<string, number>();
    const allPersonsIds = new Set(requests.map(r => r.personId));
    
    allPersonsIds.forEach(pid => {
       try {
         const balanceObj = calculatePersonBalance(pid, requests, foodControl, confirmations, people, timeEntries);
         map.set(pid, balanceObj.totalWallet);
       } catch (e) {
         map.set(pid, 0);
       }
    });
    return map;
  }, [requests, foodControl, confirmations, people, timeEntries]);

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

  const toggleJob = (id: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getConfirmation = (id: string) => {
    const rawConfs = (confirmations || []);
    // Busca tanto o ID puro quanto com o prefixo 'stmt-' (vindo do extrato geral)
    return rawConfs.find(c => 'id' in c && (c.id === id || c.id === `stmt-${id}`)) as PaymentConfirmation | undefined;
  };

  const calcRequestBruto = (req: MealRequest) => {
    const dates = getDatesInRange(req.startDate, req.endDate);
    const person = people.find(p => p.id === req.personId);
    let total = 0;
    dates.forEach((date) => {
      const activeMeals = getActiveMeals(req, date, person);
      activeMeals.forEach((m) => {
        total += getMealValue(m, date, person, req.location);
      });
    });
    return total;
  };

  const getRequestDiscounts = (req: MealRequest) => {
    let total = 0;
    
    // NOVO: Em vez de iterar apenas pelas datas da solicitação, 
    // buscamos AGRESSIVAMENTE todos os registros de tempo e comida deste JOB para esta PESSOA.
    // Isso garante que gastos fora da data (caso do Allan - 79 reais) apareçam.
    
    const personTime = timeEntries.filter(e => String(e.personId) === String(req.personId) && String(e.jobId) === String(req.jobId));
    const personFood = foodControl.filter(f => String(f.personId) === String(req.personId) && String(f.jobId) === String(req.jobId));
    
    const allRelevantDates = new Set<string>([
       ...getDatesInRange(req.startDate, req.endDate),
       ...personTime.map(e => e.date),
       ...personFood.map(f => f.date)
    ]);

    allRelevantDates.forEach(d => {
        const discountId = `discount-${req.id}-${d}`;
        // Se já foi confirmado individualmente, ignoramos
        if (confirmations.some(c => 'id' in c && (c.id === discountId || c.id === `orphan-${req.personId}-${d}`) && c.confirmed)) return;

        const entry = personTime.find(e => e.date === d);
        const fc = personFood.find(f => f.date === d);
        
        if (entry || fc || (d < new Date().toISOString().split("T")[0])) {
           total += calculateDayDiscount(req, d, entry, fc, people).total;
        }
    });
    
    return total;
  };

  const confirmPayment = async (id: string, type: "request" | "job", paymentDate: string) => {
    try {
      if (type === "request") {
        const req = requests.find(r => r.id === id);
        if (!req) return;

        const conf = getConfirmation(id);
        const shouldApply = (conf?.applyBalance !== false);
        const currentReqBruto = calcRequestBruto(req) || 0;
        const currentReqDiscounts = getRequestDiscounts(req) || 0;
        const currentReqNet = currentReqBruto + currentReqDiscounts;
        
        // Pega o saldo da carteira ANTES deste pagamento
        const balanceObj = calculatePersonBalance(req.personId, requests, foodControl, confirmations, people, timeEntries, req.id);
        const totalWallet = balanceObj.totalWallet || 0;
        const retroBalance = totalWallet - currentReqNet;
        
        // O valor do PIX é exatamente o que está na tela
        const finalValue = shouldApply ? Math.max(0, currentReqNet + retroBalance) : currentReqBruto;
        
        console.log(`[PAGAMENTO] Início da confirmação para ${req.id}:`, {
            bruto: currentReqBruto,
            net: currentReqNet,
            retroBalance,
            finalValue,
            shouldApply
        });

        const personName = getPersonName(req.personId);
        const jobName = getJobName(req.jobId);
        
        const existingId = conf?.id || id;

        // SALVA o finalValue congelado - esse valor NUNCA mais será recalculado
        await onUpdateConfirmation({ 
            id: existingId, 
            type, 
            personId: req.personId, // ADICIONADO: Essencial para o vínculo no banco
            paymentDate: paymentDate || new Date().toISOString().split('T')[0], 
            confirmed: true,
            applyBalance: shouldApply,
            appliedBalance: shouldApply ? retroBalance : 0,
            finalValue: finalValue
        });

        const isFlashUser = systemSettings?.flashCardUsers?.includes(req.personId);

        const waMsg = `✅ *Pagamento Confirmado - Sistema ACT*\n\n👤 Funcionário: ${personName}\n🏗️ Projeto: ${jobName}\n📅 Data: ${paymentDate}\n💰 Valor: R$ ${finalValue.toFixed(2)}${isFlashUser ? '\n💳 Modalidade: Cartão Flash' : ''}`;
        
        if (isFlashUser) {
           // Notifica Admin e Financeiro/RH (Cartão Flash)
           notifyAdminPayment(waMsg); 
           notifyFinanceAndHRPayment(waMsg);
           
           setTimeout(() => {
             if (confirm(`Aviso RH! Este usuário recebe via Cartão Flash. Deseja abrir o WhatsApp do RH para enviar o comprovante?`)) {
               sendWhatsAppMessage(waMsg, systemSettings?.hrWhatsApp || systemSettings?.managerWhatsApp);
             }
           }, 150);
        } else {
           // Fluxo normal: Notificar Administrador e Financeiro
           notifyAdminPayment(waMsg);
           notifyFinancePayment(waMsg);

           // Alerta opcional direcionado para o Administrador (via WhatsApp)
           setTimeout(() => {
             if (confirm(`Aviso registrado! Deseja abrir o WhatsApp do Administrador para enviar o comprovante?`)) {
               sendWhatsAppMessage(waMsg, systemSettings?.adminWhatsApp || systemSettings?.managerWhatsApp);
             }
           }, 150);
        }
      }

      if (type === "job") {
        const jobId = id.replace("job-", "");
        // Pega apenas quem AINDA não estava pago
        const allJobReqs = registeredRequests.filter(r => r.jobId === jobId);
        const pendingJobReqs = allJobReqs.filter(req => !getConfirmation(req.id)?.confirmed);
        
        if (pendingJobReqs.length === 0) {
           toast.info("Todos os profissionais deste projeto já foram liquidados.");
           return;
        }

        await onUpdateConfirmation({ id: `job-${jobId}`, type: 'job', paymentDate, confirmed: true });

        let personLines = "";
        let totalLiquidated = 0;

        // Atualiza todos os profissionais do job que estavam pendentes
        for (const req of pendingJobReqs) {
          const conf = getConfirmation(req.id);
          const shouldApply = (conf?.applyBalance !== false);
          const bruto = calcRequestBruto(req) || 0;
          const disc = getRequestDiscounts(req) || 0;
          const neto = bruto + disc;
          const balanceObj = calculatePersonBalance(req.personId, requests, foodControl, confirmations, people, timeEntries, req.id);
          const totalW = balanceObj.totalWallet || 0;
          const retro = totalW - neto;
          const reqFinalValue = shouldApply ? Math.max(0, neto + retro) : bruto;

          await onUpdateConfirmation({ 
              id: conf?.id || req.id, 
              type: 'request', 
              personId: req.personId,
              paymentDate, 
              confirmed: true,
              applyBalance: shouldApply,
              appliedBalance: shouldApply ? retro : 0,
              finalValue: reqFinalValue
          });

          const pName = getPersonName(req.personId);
          personLines += `\n- ${pName}: R$ ${reqFinalValue.toFixed(2)}`;
          totalLiquidated += reqFinalValue;
        }

        // Notificação automática via E-mail e WhatsApp (conforme configurado em Settings)
        const jobName = getJobName(jobId, pendingJobReqs[0].personId);
        const jobWaMsg = `🏦 *FECHAMENTO DE PROJETO (PENDENTES)*\n\n🏗️ Projeto: ${jobName}\n📅 Data: ${paymentDate}\n\n👥 *Profissionais Liquidados:*${personLines}\n\n💰 *Total Lote:* R$ ${totalLiquidated.toFixed(2)}`;
        
        // Dispara para o Administrador
        notifyAdminPayment(jobWaMsg);
        // Dispara para o Financeiro
        notifyFinancePayment(jobWaMsg);

        toast.success(`Pagamento de ${pendingJobReqs.length} profissional(is) confirmado! Relatórios enviados.`);
      }
    } catch (error) {
      console.error("Erro ao confirmar pagamento:", error);
      toast.error("Houve um erro ao processar o pagamento. Tente novamente.");
    }
  };

  const removeConfirmation = (id: string) => {
    const existing = getConfirmation(id);
    if (existing) {
      onUpdateConfirmation({ ...existing, confirmed: false });
    }
  };

  const updatePaymentDate = (id: string, type: "request" | "job", paymentDate: string) => {
    const existing = getConfirmation(id);
    const req = type === 'request' ? requests.find(r => r.id === id) : null;
    
    onUpdateConfirmation({ 
      ...existing,
      id: existing?.id || id, 
      type, 
      personId: existing?.personId || req?.personId,
      paymentDate, 
      confirmed: existing?.confirmed || false,
      applyBalance: existing?.applyBalance !== undefined ? existing.applyBalance : true,
      appliedBalance: existing?.appliedBalance || 0
    });
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
          // Agora o Job só é considerado "Totalmente Pago" se TODO MUNDO dentro dele estiver com confirmação ativa.
          // Isso garante que se um complemento for adicionado (sem confirmação ainda), o botão "Confirmar Job" ressurge para ele e o painel volta a ficar "pendente".
          const isJobPaid = jobReqs.every(req => getConfirmation(req.id)?.confirmed);
          // O último pagamento do Job caso queiramos puxar a data geral
          const jobConf = getConfirmation(`job-${jobId}`);
          const jobPaymentDate = jobConf?.paymentDate || new Date().toISOString().split("T")[0];

          return (
            <div key={jobId} className="rounded-xl border border-border overflow-hidden shadow-card">
              <div className="bg-muted/50 px-4 py-3 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleJob(jobId)}>
                      {expandedJobs.has(jobId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground">{getJobName(jobId, jobReqs[0]?.personId)}</h3>
                        {isJobPaid && <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-200 py-0.5">✓ Job 100% Pago</Badge>}
                      </div>
                    </div>
                  </div>
                {!isJobPaid ? (
                  <div className="flex items-center gap-2">
                    <Input type="date" className="h-9 text-xs w-40 px-3 flex-row-reverse" value={jobPaymentDate} onChange={(e) => updatePaymentDate(`job-${jobId}`, 'job', e.target.value)} />
                    <Button size="sm" className="h-9 bg-primary" onClick={() => confirmPayment(`job-${jobId}`, "job", jobPaymentDate)}>Confirmar Restantes</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => removeConfirmation(`job-${jobId}`)}>Estornar Header</Button>
                )}
              </div>

              {expandedJobs.has(jobId) && (
                <div className="divide-y divide-border">
                    {jobReqs.map((req) => {
                      const conf = getConfirmation(req.id);
                      const isPaid = conf?.confirmed;
                      const paymentDate = conf?.paymentDate || jobPaymentDate;

                      const dbApply = conf?.applyBalance;
                      const dbApplyValue = dbApply !== undefined && dbApply !== null ? dbApply !== false : true;
                      
                      const frozenApply = dbApplyValue;
                      
                      const currentReqBruto = calcRequestBruto(req) || 0;
                      const currentReqDiscounts = getRequestDiscounts(req) || 0; 
                      const currentReqNet = currentReqBruto + currentReqDiscounts;
                      
                      const balanceObj = calculatePersonBalance(req.personId, requests, foodControl, confirmations, people, timeEntries, req.id);
                      const totalWallet = balanceObj.totalWallet || 0;
                      const retroBalance = totalWallet - currentReqNet;
                      const adjustmentsFromBalance = balanceObj.adjustments || [];

                      let finalTotal: number;
                      let displayAdjustment: number;
                      
                      if (isPaid && conf?.finalValue !== undefined && conf?.finalValue !== null) {
                        finalTotal = conf.finalValue;
                        displayAdjustment = conf.appliedBalance || 0;
                      } else if (isPaid) {
                        const dbAppliedBalance = conf?.appliedBalance ?? retroBalance;
                        finalTotal = frozenApply ? Math.max(0, currentReqNet + dbAppliedBalance) : currentReqBruto;
                        displayAdjustment = dbAppliedBalance;
                      } else {
                        finalTotal = frozenApply ? Math.max(0, currentReqNet + retroBalance) : currentReqBruto;
                        displayAdjustment = frozenApply ? (currentReqDiscounts + retroBalance) : 0;
                      }
                      
                      const currentDiscounts = Math.abs(currentReqDiscounts);
                      const isFlashUser = systemSettings?.flashCardUsers?.includes(req.personId);

                      return (
                        <div key={req.id} className={`p-4 transition-colors relative z-0 ${isFlashUser ? 'bg-amber-50/50' : 'bg-background'}`}>
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleRequest(req.id)}>
                                {expandedRequests.has(req.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                              <div className="flex-1">
                                <p className="font-bold text-sm text-foreground flex flex-wrap items-center gap-2">
                                  {people.find(p => p.id === req.personId)?.isRegistered && <span className="text-muted-foreground opacity-70">(CLT)</span>}
                                  <span>{getPersonName(req.personId)}</span>
                                  {isFlashUser && (
                                    <Badge variant="destructive" className="text-[11px] font-black tracking-widest bg-amber-500 hover:bg-amber-600 border-none px-2 py-0.5 h-5 items-center uppercase text-white shadow-sm">
                                      💳 Cartão Flash (RH)
                                    </Badge>
                                  )}
                                  {people.find(p => p.id === req.personId)?.pix && !isFlashUser && (
                                    <Badge variant="secondary" className="text-[11px] font-bold tracking-tight text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 h-5 items-center">
                                      PIX: {people.find(p => p.id === req.personId)?.pix}
                                    </Badge>
                                  )}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-[10px] text-muted-foreground uppercase font-medium">
                                    {req.location || 'Local Não Definido'} • {fDate(req.startDate)} a {fDate(req.endDate)}
                                  </p>
                                  <Badge 
                                    variant="outline" 
                                    className="text-[9px] h-4 cursor-pointer hover:bg-muted/50 border-muted-foreground/20 text-muted-foreground font-bold"
                                    onClick={(e) => { e.stopPropagation(); toggleRequest(req.id); }}
                                  >
                                    {expandedRequests.has(req.id) ? "VER RESUMO" : "VER AJUSTES DETALHADOS"}
                                  </Badge>
                                  {getJobName(req.jobId).includes("Removido (") && (
                                    <div className="flex items-center gap-1.5 ring-1 ring-red-200 rounded px-1.5 bg-red-50">
                                      <span className="text-[8px] text-red-500 font-bold uppercase">Corrigir Job:</span>
                                      <Select onValueChange={(newId) => {
                                          if (onUpdateManualMealRequest) {
                                              onUpdateManualMealRequest({ ...req, jobId: newId });
                                              toast.success("Vínculo do Job corrigido!");
                                          }
                                      }}>
                                        <SelectTrigger className="h-4 text-[9px] w-[90px] bg-transparent border-none py-0 px-0 focus:ring-0">
                                          <SelectValue placeholder="Fix" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {jobs.map(j => <SelectItem key={j.id} value={j.id} className="text-[10px]">{j.name}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="text-right flex flex-col items-end gap-0.5">
                                <p className={`text-[10px] uppercase tracking-widest font-black leading-none ${isFlashUser ? 'text-amber-600' : 'text-muted-foreground/60'}`}>
                                  {isFlashUser ? 'TOTAL FLASH' : 'TOTAL PIX'}
                                </p>
                                <p className={`text-base font-black tabular-nums tracking-tighter leading-none ${isFlashUser ? 'text-amber-600' : 'text-foreground'}`}>
                                  R$ {finalTotal.toFixed(2)}
                                </p>
                                
                                <div className="flex flex-col items-end pt-1 gap-0.5">
                                  <span className="text-[9px] text-muted-foreground/50 font-medium">
                                    Bruto: R$ {currentReqBruto.toFixed(2)}
                                  </span>

                                  {currentDiscounts > 0 && (
                                    <span className={`text-[10px] font-bold ${frozenApply ? 'text-destructive' : 'text-muted-foreground/40 line-through'}`}>
                                      {currentReqDiscounts > 0 ? '+' : ''}{currentReqDiscounts.toFixed(2)} [DESCONTOS PROJETO]
                                    </span>
                                  )}
                                  
                                  {Math.abs(retroBalance) > 0.01 && (
                                    <span className={`text-[10px] font-bold ${frozenApply ? (retroBalance < 0 ? 'text-destructive' : 'text-blue-600') : 'text-muted-foreground/40 line-through'}`}>
                                      {retroBalance > 0 ? '+' : ''}R$ {retroBalance.toFixed(2)} [SALDO OUTROS PROJETOS]
                                    </span>
                                  )}

                                  {!frozenApply && (currentDiscounts > 0 || Math.abs(retroBalance) > 0.01) && (
                                    <span className="text-[10px] text-destructive font-black italic">
                                      SALDO/DESC. NÃO APLICADO
                                    </span>
                                  )}

                                  {currentDiscounts === 0 && Math.abs(retroBalance) < 0.01 && (
                                    <span className="text-[9px] text-muted-foreground/40 italic">
                                      Sem ajustes pendentes
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

                                {isPaid ? (
                                    <Button
                                        size="sm"
                                        disabled
                                        className={`h-8 text-[9px] px-2 font-black uppercase tracking-tight cursor-not-allowed opacity-70 ${
                                            frozenApply
                                            ? "bg-blue-600 text-white"
                                            : "border border-muted-foreground/30 text-muted-foreground bg-muted/20"
                                        }`}
                                        title="Pagamento confirmado no banco. Estorne para alterar."
                                    >
                                        🔒 {frozenApply ? "APLICADO" : "NÃO APLICADO"}
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant={conf?.applyBalance === false ? "outline" : "default"}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const updatedValue = !(conf?.applyBalance !== false);
                                            onUpdateConfirmation({
                                                ...conf,
                                                id: conf?.id || req.id,
                                                personId: req.personId,
                                                type: 'request',
                                                confirmed: false,
                                                applyBalance: updatedValue,
                                                appliedBalance: 0,
                                                paymentDate: conf?.paymentDate || ""
                                            });
                                            toast.info(updatedValue ? "Saldo será aplicado no pagamento." : "Saldo NÃO será aplicado.");
                                        }}
                                        className={`h-8 text-[9px] px-2 font-black uppercase tracking-tight transition-all duration-300 pointer-events-auto ${
                                            conf?.applyBalance === false 
                                            ? "border-muted-foreground/30 text-muted-foreground bg-muted/20" 
                                            : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm ring-1 ring-blue-400/50"
                                        }`}
                                    >
                                        {conf?.applyBalance === false ? "NÃO APLICADO" : "APLICADO"}
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

                        {/* Detalhamento de Ajustes Expandido - EXATAMENTE IGUAL AO EXTRATO */}
                        {expandedRequests.has(req.id) && (
                          <div className="w-full mt-4 pt-4 border-t border-dashed border-border bg-muted/20 rounded-lg p-3">
                            <h4 className="text-[10px] font-black uppercase text-muted-foreground mb-2 flex items-center gap-2">
                              <Calendar className="h-3 w-3" /> Detalhamento de Ajustes e Saldo Carteira
                            </h4>
                            <div className="space-y-1">
                               {adjustmentsFromBalance.length > 0 ? (
                                 adjustmentsFromBalance.map((adj: any) => (
                                   <div key={`${adj.date}-${adj.label}`} className="flex justify-between text-[11px] py-1 border-b border-border/30 last:border-0 border-dashed">
                                     <span className="flex items-center gap-2">
                                       <span className="text-muted-foreground w-16">{fDate(adj.date)}</span>
                                       <span>{adj.label}</span>
                                     </span>
                                     <span className={`font-bold ${adj.amount < 0 ? 'text-destructive' : 'text-green-600'}`}>
                                       {adj.amount > 0 ? '+' : ''}R$ {Math.abs(adj.amount).toFixed(2)}
                                     </span>
                                   </div>
                                 ))
                               ) : (
                                 <p className="text-[10px] text-muted-foreground italic py-1">Nenhum ajuste específico calculado para este período.</p>
                               )}
                            </div>

                            {Math.abs(retroBalance) > 0.01 && (
                                <div className="mt-2 pt-2 border-t border-blue-100">
                                  <div className="flex justify-between text-[11px] font-bold text-blue-700 bg-blue-50/50 p-1 rounded">
                                    <span>Saldo Acumulado de Outros Projetos</span>
                                    <span>{retroBalance > 0 ? '+' : ''}R$ {retroBalance.toFixed(2)}</span>
                                  </div>
                                </div>
                            )}
                              
                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/60">
                                <span className="text-[10px] font-black uppercase">Total a Pagar Final (Com Ajustes)</span>
                                <span className={`text-xs font-black ${frozenApply ? (displayAdjustment < 0 ? 'text-destructive' : 'text-blue-600') : 'text-muted-foreground opacity-30 text-lg line-through'}`}>
                                  {displayAdjustment > 0 ? '+' : ''}R$ {displayAdjustment.toFixed(2)}
                                </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
};

export default PaymentTab;
