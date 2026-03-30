import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Check, Mail, Download, Bell, Users, Send, TrendingUp } from "lucide-react";
import { sendTeamsNotification, sendWhatsAppMessage, sendEmailNotification, notifyHRDiscounts, notifyAdminDiscount, checkDiscountAlertDate } from "@/lib/notifications";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_LINK } from "@/lib/types";


import {
  type Person,
  type Job,
  type MealRequest,
  type TimeEntry,
  type FoodControlEntry,
  type DiscountConfirmation,
  type PaymentConfirmation,
  MEAL_LABELS,
  MEAL_VALUES,
  getDatesInRange,
  calcTotalMinutes,
  getFirstEntryTime,
  getMealValue,
  calculateDayDiscount,
} from "@/lib/types";

interface DiscountsTabProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries: TimeEntry[];
  foodControl: FoodControlEntry[];
  confirmations: (DiscountConfirmation | PaymentConfirmation)[];
  setConfirmations: (confs: (DiscountConfirmation | PaymentConfirmation)[]) => void;
  onUpdateConfirmation?: (conf: DiscountConfirmation) => void;
  onUpdatePaymentConfirmation?: (conf: PaymentConfirmation) => void;
  initialJobFilter?: string;
}

interface DiscountRow {
  personId: string;
  jobId: string;
  date: string;
  discountCafe: number;
  discountAlmoco: number;
  discountJanta: number;
  total: number;
  reason: string;
  _reqId?: string;
  _done?: boolean;
}

const DiscountsTab = ({
  people,
  jobs,
  requests,
  timeEntries,
  foodControl,
  confirmations,
  setConfirmations,
  onUpdateConfirmation,
  onUpdatePaymentConfirmation,
  initialJobFilter = "all"
}: DiscountsTabProps) => {
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set());
  const [showAlertBanner, setShowAlertBanner] = useState(false);
  const [filterJob, setFilterJob] = useState(initialJobFilter);
  const [activeView, setActiveView] = useState<"descontos" | "saldo">("descontos");

  useEffect(() => {
    if (initialJobFilter) setFilterJob(initialJobFilter);
  }, [initialJobFilter]);

  useEffect(() => {
    checkDiscountAlertDate().then(isAlertDay => {
      setShowAlertBanner(isAlertDay);
    });
  }, []);

  const handleSendToHR = async () => {
    if (discounts.length === 0) {
      toast.info("Nenhum desconto para enviar.");
      return;
    }

    const lines = Array.from(groupedByPerson.entries()).map(([personId, rows]) => {
      const name = getPersonName(personId);
      const total = rows.reduce((s, d) => s + d.total, 0);
      return `👤 ${name}: -R$ ${total.toFixed(2)}`;
    }).join("\n");

    const details = `📋 Relatório de Descontos\n\n${lines}\n\n💰 Total Geral: -R$ ${totalDiscount.toFixed(2)}`;
    await notifyHRDiscounts(details);
    toast.success("Relatório de descontos enviado ao RH!", { duration: 5000 });
  };

  const getPersonName = (id: string) => people.find((p) => p.id === id)?.name || "—";
  const getJobName = (id: string) => jobs.find((j) => j.id === id)?.name || "—";

  const registeredRequests = useMemo(() => {
    return requests;
  }, [requests]);

  // Helper: check if a specific day's discount was already applied (toggled off in Statement)
  const isDiscountDone = (reqId: string, date: string) => {
    const discountId = `discount-${reqId}-${date}`;
    return (confirmations || []).find(c => 'id' in c && c.id === discountId)?.confirmed || false;
  };

  const getReqIdForDay = (personId: string, jobId: string, date: string) => {
    return requests.find(r => r.personId === personId && r.jobId === jobId &&
      date >= r.startDate && date <= r.endDate)?.id || '';
  };

  // Calcula TODOS os ajustes (positivos e negativos) por dia
  const allAdjustments = useMemo(() => {
    const rows: DiscountRow[] = [];
    const processedDays = new Set<string>();

    registeredRequests.forEach((req) => {
      const dates = getDatesInRange(req.startDate, req.endDate);
      dates.forEach((date) => {
        const dayKey = `${req.personId}-${req.jobId}-${date}`;
        if (processedDays.has(dayKey)) return;
        processedDays.add(dayKey);

        const entries = timeEntries.filter(
          (e) => e.personId === req.personId && e.jobId === req.jobId && e.date === date
        );
        const entry = entries.find(e => e.isTravelOut || e.isTravelReturn) || entries[0];

        const fc = foodControl.find(
          (f) => f.personId === req.personId && f.jobId === req.jobId && f.date === date
        );

        const dayCalc = calculateDayDiscount(req, date, entry || undefined, fc, people);
        
        if (dayCalc.total !== 0) {
          if (filterJob === "all" || req.jobId === filterJob) {
            const done = isDiscountDone(req.id, date);
            rows.push({ personId: req.personId, jobId: req.jobId, date, ...dayCalc, _reqId: req.id, _done: done });
          }
        }
      });
    });

    return rows;
  }, [registeredRequests, timeEntries, foodControl, people, filterJob, confirmations]);

  // Descontos: Quando o funcionário deve pagar (Total < 0, ex: refeição extra)
  const discounts = useMemo(() => allAdjustments.filter(d => d.total < 0), [allAdjustments]);
  const activeDiscounts = useMemo(() => discounts.filter(d => !d._done), [discounts]);
  
  // Saldo positivo: Quando o funcionário tem crédito (Total > 0, ex: não consumiu o solicitado)
  const positiveBalances = useMemo(() => allAdjustments.filter(d => d.total > 0), [allAdjustments]);

  // Group discounts by person
  const groupedByPerson = useMemo(() => {
    const map = new Map<string, DiscountRow[]>();
    discounts.forEach((d) => {
      const arr = map.get(d.personId) || [];
      arr.push(d);
      map.set(d.personId, arr);
    });
    return map;
  }, [discounts]);

  // Group positive balances by person
  const groupedBalanceByPerson = useMemo(() => {
    const map = new Map<string, DiscountRow[]>();
    positiveBalances.forEach((d) => {
      const arr = map.get(d.personId) || [];
      arr.push(d);
      map.set(d.personId, arr);
    });
    return map;
  }, [positiveBalances]);

  // Cálculo do saldo líquido (saldo positivo - descontos) por pessoa
  const personNetBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    const allPids = new Set([...Array.from(groupedByPerson.keys()), ...Array.from(groupedBalanceByPerson.keys())]);
    allPids.forEach(pid => {
      const descTotal = (groupedByPerson.get(pid) || []).reduce((s, d) => s + Math.abs(d.total), 0);
      const saldTotal = (groupedBalanceByPerson.get(pid) || []).reduce((s, d) => s + Math.abs(d.total), 0);
      map.set(pid, saldTotal - descTotal); // (+) é crédito, (-) é débito
    });
    return map;
  }, [groupedByPerson, groupedBalanceByPerson]);

  const totalDiscount = activeDiscounts.reduce((s, d) => s + Math.abs(d.total), 0);
  const totalPositiveBalance = positiveBalances.reduce((s, d) => s + Math.abs(d.total), 0);

  const togglePerson = (personId: string) => {
    setExpandedPersons((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  const isConfirmed = (personId: string) => confirmations.find((c) => 'personId' in c && c.personId === personId)?.confirmed || false;

  const undoDiscount = (personId: string) => {
    const unconfirmed: DiscountConfirmation = { personId, paymentDate: "", confirmed: false };
    onUpdateConfirmation?.(unconfirmed);

    const idx = confirmations.findIndex((c) => 'personId' in c && c.personId === personId);
    if (idx >= 0) {
      const copy = [...confirmations];
      copy[idx] = unconfirmed;
      setConfirmations(copy);
    }
    toast.info("Desconto desmarcado como pendente.", { duration: 3000 });
  };

  const updatePaymentDate = async (personId: string, date: string) => {
    if (!date) {
      undoDiscount(personId);
      return;
    }

    const personName = getPersonName(personId);
    const personRows = discounts.filter(d => d.personId === personId);
    const totalDesc = personRows.reduce((s, d) => s + Math.abs(d.total), 0);
    const reasons = personRows.map(d => `${d.date?.includes("-") ? d.date.split("-").reverse().join("/") : d.date}: ${d.reason} (R$ ${Math.abs(d.total).toFixed(2)})`).join("\n");

    const updated: DiscountConfirmation = { personId, paymentDate: date, confirmed: true };
    onUpdateConfirmation?.(updated);

    const idx = confirmations.findIndex((c) => 'personId' in c && c.personId === personId);
    if (idx >= 0) {
      const copy = [...confirmations];
      copy[idx] = updated;
      setConfirmations(copy);
    } else {
      setConfirmations([...confirmations, updated]);
    }

    if (date) {
      // Notificar Administrador sobre desconto
      const details = `👤 Funcionário: ${personName}\n💸 Total Descontado: R$ ${totalDesc.toFixed(2)}\n📅 Data: ${date}\n\n📝 Motivos:\n${reasons}`;
      await notifyAdminDiscount(details);
      toast.success(`Desconto de ${personName} registrado! Notificações disparadas.`, { duration: 5000 });
    }
  };

  const exportDiscountsXlsx = () => {
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      ["RELATÓRIO DE DESCONTOS"],
      [],
      ["Pessoa", "Job", "Data", "Café (R$)", "Almoço (R$)", "Janta (R$)", "Total (R$)", "Motivo", "Confirmado"],
    ];

    discounts.forEach((d) => {
      rows.push([
        getPersonName(d.personId), getJobName(d.jobId),
        d.date?.includes("-") ? d.date.split("-").reverse().join("/") : "—",
        d.discountCafe > 0 ? -d.discountCafe : 0,
        d.discountAlmoco > 0 ? -d.discountAlmoco : 0,
        d.discountJanta > 0 ? -d.discountJanta : 0,
        -d.total, d.reason,
        isConfirmed(d.personId) ? "Sim" : "Pendente",
      ]);
    });

    rows.push([]);
    rows.push(["", "", "", "", "", "TOTAL", -totalDiscount, "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 22 }, { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Descontos");
    XLSX.writeFile(wb, "Relatorio_Descontos.xlsx");
  };

  const sendDiscountsEmail = () => {
    const subject = encodeURIComponent("Relatório de Descontos");
    const body = encodeURIComponent(
      `Segue o relatório de descontos.\n\nTotal: R$ ${totalDiscount.toFixed(2)}\n\nPor favor, exportar o relatório .xlsx e anexar ao e-mail manualmente.\n\nAcesse o sistema: ${APP_LINK}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
  };

  const renderPersonList = (grouped: Map<string, DiscountRow[]>, isPositiveBalance: boolean) => {
    if (grouped.size === 0) {
      return (
        <div className="text-center py-10 text-sm text-muted-foreground">
          {isPositiveBalance 
            ? "Nenhum saldo positivo encontrado. Todas as refeições solicitadas foram consumidas." 
            : "Nenhum desconto pendente. Todas as refeições solicitadas foram utilizadas."}
        </div>
      );
    }

    return (
      <div className="divide-y divide-border">
        {Array.from(grouped.entries()).map(([personId, personRows]) => {
          const personTotal = personRows.reduce((s, d) => s + Math.abs(d.total), 0);
          const expanded = expandedPersons.has(`${isPositiveBalance ? 'bal-' : ''}${personId}`);
          const personConfirmation = confirmations.find((c) => 'personId' in c && c.personId === personId) as DiscountConfirmation | undefined;
          const confirmed = !isPositiveBalance && (personConfirmation?.confirmed || false);
          const paymentDate = personConfirmation?.paymentDate || "";

          return (
            <div key={personId}>
              <div
                className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors ${confirmed ? "bg-muted/20" : ""}`}
                onClick={() => togglePerson(`${isPositiveBalance ? 'bal-' : ''}${personId}`)}
              >
                <div className="flex items-center gap-3">
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-medium text-foreground">{getPersonName(personId)}</span>
                  {isPositiveBalance ? (
                    <Badge className="text-2xs bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                      💰 Saldo a Pagar
                    </Badge>
                  ) : confirmed ? (
                    <Badge className="text-2xs bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">
                      ✂️ {paymentDate?.includes("-") ? `Descontado em ${paymentDate.split("-").reverse().join("/")}` : "Descontado"}
                    </Badge>
                  ) : (
                    <Badge className="text-2xs bg-destructive text-destructive-foreground">
                      Pendente
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`tabular-nums font-bold mr-2 ${isPositiveBalance ? 'text-green-600' : 'text-destructive'}`}>
                    {isPositiveBalance ? '+' : '-'}{personTotal.toFixed(2)}
                  </span>
                  {(() => {
                    const net = personNetBalanceMap.get(personId) || 0;
                    if (Math.abs(net) < 0.01 || (isPositiveBalance && net > 0) || (!isPositiveBalance && net < 0)) return null;
                    return (
                      <span className={`text-[10px] mr-2 italic font-bold ${net >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        (Saldo Líquido: {net >= 0 ? '+' : ''}{net.toFixed(2)})
                      </span>
                    );
                  })()}
                  {!isPositiveBalance && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <label className="text-2xs text-muted-foreground whitespace-nowrap">Data Desconto:</label>
                      <Input
                        type="date"
                        className="h-10 text-xs w-40 px-3 border-border shadow-sm flex-row-reverse"
                        value={paymentDate}
                        onChange={(e) => updatePaymentDate(personId, e.target.value)}
                      />
                      {confirmed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => undoDiscount(personId)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Desmarcar desconto"
                        >
                          Desfazer
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {expanded && (
                <div className="bg-muted/10 px-4 pb-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left px-2 py-1.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Data</th>
                        <th className="text-left px-2 py-1.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Job</th>
                        <th className={`text-right px-2 py-1.5 text-2xs uppercase tracking-wider font-medium ${isPositiveBalance ? 'text-green-600' : 'text-destructive'}`}>Café (R$)</th>
                        <th className={`text-right px-2 py-1.5 text-2xs uppercase tracking-wider font-medium ${isPositiveBalance ? 'text-green-600' : 'text-destructive'}`}>Almoço (R$)</th>
                        <th className={`text-right px-2 py-1.5 text-2xs uppercase tracking-wider font-medium ${isPositiveBalance ? 'text-green-600' : 'text-destructive'}`}>Janta (R$)</th>
                        <th className={`text-right px-2 py-1.5 text-2xs uppercase tracking-wider font-medium ${isPositiveBalance ? 'text-green-600' : 'text-destructive'}`}>Total (R$)</th>
                        <th className="text-left px-2 py-1.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Motivo</th>
                        {!isPositiveBalance && onUpdatePaymentConfirmation && <th className="text-right px-2 py-1.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Ação</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {personRows.map((d, i) => {
                        const done = d._done || false;
                        const discountId = d._reqId ? `discount-${d._reqId}-${d.date}` : undefined;
                        return (
                        <tr key={`${d.date}-${i}`} className={`hover:bg-muted/20 transition-colors ${done ? 'opacity-50' : ''}`}>
                          <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{d.date?.includes("-") ? d.date.split("-").reverse().join("/") : "—"}</td>
                          <td className="px-2 py-1.5 text-xs text-muted-foreground">{getJobName(d.jobId)}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${isPositiveBalance ? 'text-green-600' : done ? 'text-muted-foreground line-through' : 'text-destructive'}`}>
                            {Math.abs(d.discountCafe) > 0 ? `${isPositiveBalance ? '+' : '-'}${Math.abs(d.discountCafe).toFixed(2)}` : "—"}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${isPositiveBalance ? 'text-green-600' : done ? 'text-muted-foreground line-through' : 'text-destructive'}`}>
                            {Math.abs(d.discountAlmoco) > 0 ? `${isPositiveBalance ? '+' : '-'}${Math.abs(d.discountAlmoco).toFixed(2)}` : "—"}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${isPositiveBalance ? 'text-green-600' : done ? 'text-muted-foreground line-through' : 'text-destructive'}`}>
                            {Math.abs(d.discountJanta) > 0 ? `${isPositiveBalance ? '+' : '-'}${Math.abs(d.discountJanta).toFixed(2)}` : "—"}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${isPositiveBalance ? 'text-green-600' : done ? 'text-muted-foreground line-through' : 'text-destructive'}`}>
                            {isPositiveBalance ? '+' : '-'}{Math.abs(d.total).toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <span className={done ? 'line-through' : ''}>{d.reason}</span>
                              {done && <Badge variant="outline" className="text-[8px] h-3 px-1 bg-muted/50 border-muted-foreground/30">JÁ RETIRADO</Badge>}
                            </div>
                          </td>
                          {!isPositiveBalance && discountId && onUpdatePaymentConfirmation && (
                            <td className="px-2 py-1.5 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-5 w-auto px-2 text-[8px] font-black uppercase ${
                                  done
                                    ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                                    : 'bg-background hover:bg-muted text-muted-foreground border-border/60'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdatePaymentConfirmation({
                                    id: discountId,
                                    type: 'discount',
                                    confirmed: !done,
                                    paymentDate: new Date().toISOString().split('T')[0]
                                  });
                                  if (done) toast.success('Desconto reativado.');
                                  else toast.success('Desconto marcado como retirado (não afeta o total).');
                                }}
                              >
                                {done ? 'Reverter' : '- Retirar'}
                              </Button>
                            </td>
                          )}
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {showAlertBanner && discounts.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 animate-in fade-in">
          <Bell className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">⚠️ Hoje é dia de envio dos descontos ao RH!</p>
            <p className="text-xs text-amber-600">Verifique os descontos e envie o relatório.</p>
          </div>
          <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSendToHR}>
            <Send className="h-3.5 w-3.5" /> Enviar para RH
          </Button>
        </div>
      )}

      {/* Tabs Descontos / Saldo */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "descontos" | "saldo")} className="w-full">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList className="grid grid-cols-2 w-auto">
            <TabsTrigger value="descontos" className="gap-1.5 text-xs">
              ✂️ Descontos
              {discounts.length > 0 && <Badge variant="destructive" className="text-2xs ml-1 h-4 px-1">{discounts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="saldo" className="gap-1.5 text-xs">
              💰 Saldo Positivo
              {positiveBalances.length > 0 && <Badge className="text-2xs ml-1 h-4 px-1 bg-green-100 text-green-700">{positiveBalances.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          {discounts.length > 0 && activeView === "descontos" && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs border-violet-300 text-violet-700 hover:bg-violet-50" onClick={handleSendToHR}>
              <Users className="h-3.5 w-3.5" /> Enviar para RH
            </Button>
          )}
        </div>

        <TabsContent value="descontos" className="mt-4">
          <div className="rounded-xl border border-border overflow-hidden shadow-card">
            {renderPersonList(groupedByPerson, false)}
          </div>

          {groupedByPerson.size > 0 && (
            <>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 mt-4">
                <span className="text-sm font-semibold uppercase text-muted-foreground">Total Descontos</span>
                <span className="tabular-nums text-lg font-bold text-destructive">-{totalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                <Button onClick={exportDiscountsXlsx} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar Descontos .xlsx
                </Button>
                <Button onClick={sendDiscountsEmail} variant="outline" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Enviar Descontos por E-mail
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="saldo" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Saldo positivo: quando o funcionário consumiu <strong>menos</strong> do que foi solicitado. A empresa deve pagar a diferença (crédito).
          </p>
          <div className="rounded-xl border border-green-200 overflow-hidden shadow-card">
            {renderPersonList(groupedBalanceByPerson, true)}
          </div>

          {groupedBalanceByPerson.size > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50/30 px-4 py-3 mt-4">
              <span className="text-sm font-semibold uppercase text-muted-foreground">Total Saldo a Pagar</span>
              <span className="tabular-nums text-lg font-bold text-green-600">+{totalPositiveBalance.toFixed(2)}</span>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DiscountsTab;
