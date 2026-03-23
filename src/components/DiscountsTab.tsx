import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Check, Mail, Download, Bell } from "lucide-react";
import { sendTeamsNotification, sendWhatsAppMessage, sendEmailNotification } from "@/lib/notifications";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";


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
}: DiscountsTabProps) => {
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set());

  const getPersonName = (id: string) => people.find((p) => p.id === id)?.name || "—";
  const getJobName = (id: string) => jobs.find((j) => j.id === id)?.name || "—";

  // Mostra todas as solicitações, independente de timeEntry já registrada
  const registeredRequests = useMemo(() => {
    return requests;
  }, [requests]);

  const discounts = useMemo(() => {
    const rows: DiscountRow[] = [];

    registeredRequests.forEach((req) => {
      const dates = getDatesInRange(req.startDate, req.endDate);
      dates.forEach((date) => {
        const entry = timeEntries.find(
          (e) => e.personId === req.personId && e.jobId === req.jobId && e.date === date
        );
        // Avalia o dia mesmo sem registro de horas (ex: falta completa)

        const fc = foodControl.find(
          (f) => f.personId === req.personId && f.jobId === req.jobId && f.date === date
        );

        const dayCalc = calculateDayDiscount(req, date, entry, fc, people);
        
        if (dayCalc.total > 0) {
          rows.push({ personId: req.personId, jobId: req.jobId, date, ...dayCalc });
        }
      });
    });

    return rows;
  }, [registeredRequests, timeEntries, foodControl, people]);

  // Group by person
  const groupedByPerson = useMemo(() => {
    const map = new Map<string, DiscountRow[]>();
    discounts.forEach((d) => {
      const arr = map.get(d.personId) || [];
      arr.push(d);
      map.set(d.personId, arr);
    });
    return map;
  }, [discounts]);

  const totalDiscount = discounts.reduce((s, d) => s + d.total, 0);


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

    // Atualiza estado local imediatamente (sem esperar o banco)
    const idx = confirmations.findIndex((c) => 'personId' in c && c.personId === personId);
    if (idx >= 0) {
      const copy = [...confirmations];
      copy[idx] = unconfirmed;
      setConfirmations(copy);
    }
    toast.info("Desconto desmarcado como pendente.", { duration: 3000 });
  };

  const updatePaymentDate = (personId: string, date: string) => {
    if (!date) {
      undoDiscount(personId);
      return;
    }

    const personName = getPersonName(personId);
    const personRows = discounts.filter(d => d.personId === personId);
    const totalDesc = personRows.reduce((s, d) => s + d.total, 0);
    const reasons = personRows.map(d => `${d.date?.includes("-") ? d.date.split("-").reverse().join("/") : d.date}: ${d.reason} (R$ ${d.total.toFixed(2)})`).join("\n");

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
      // ==== NOTIFICAÇÕES DE DESCONTO ====
      const teamsMsg = `**⚠️ Desconto Aplicado**\n\n**Funcionário:** ${personName}\n**Total Descontado:** R$ ${totalDesc.toFixed(2)}\n**Data Registro:** ${date}\n\n**Detalhes:**\n${reasons}`;
      sendTeamsNotification("⚠️ Desconto Aplicado – Sistema ACT", teamsMsg, "FF5733");

      const waMsg = `⚠️ *Desconto Registrado - Sistema ACT*\n\n👤 Funcionário: ${personName}\n💸 Total: -R$ ${totalDesc.toFixed(2)}\n📅 Data: ${date}\n\n📝 Motivos:\n${reasons}`;
      sendWhatsAppMessage(waMsg);

      const emailSubject = `Desconto Aplicado – ${personName}`;
      const emailBody = `Olá,\n\nInformamos o lançamento de desconto no Sistema ACT:\n\nFuncionário: ${personName}\nTotal Descontado: -R$ ${totalDesc.toFixed(2)}\nData: ${date}\n\nMotivos:\n${reasons}\n\nAtenciosamente,\nSistema ACT`;
      sendEmailNotification(emailSubject, emailBody);

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
      `Segue o relatório de descontos.\n\nTotal: R$ ${totalDiscount.toFixed(2)}\n\nPor favor, exportar o relatório .xlsx e anexar ao e-mail manualmente.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Descontos por refeição não utilizada. Baseado no horário de entrada e no controle de alimentação. Clique no nome para expandir os detalhes.
      </p>


      <div className="rounded-xl border border-border overflow-hidden shadow-card">
        {groupedByPerson.size === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Nenhum desconto pendente. Todas as refeições solicitadas foram utilizadas.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {Array.from(groupedByPerson.entries()).map(([personId, personDiscounts]) => {
              const personTotal = personDiscounts.reduce((s, d) => s + d.total, 0);
              const expanded = expandedPersons.has(personId);
              const personConfirmation = confirmations.find((c) => 'personId' in c && c.personId === personId) as DiscountConfirmation | undefined;
              const confirmed = personConfirmation?.confirmed || false;
              const paymentDate = personConfirmation?.paymentDate || "";

              return (
                <div key={personId}>
                  {/* Person header - collapsible */}
                  <div
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors ${confirmed ? "bg-muted/20" : ""}`}
                    onClick={() => togglePerson(personId)}
                  >
                    <div className="flex items-center gap-3">
                      {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-medium text-foreground">{getPersonName(personId)}</span>
                      {confirmed ? (
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
                      <span className="tabular-nums font-bold text-destructive mr-2">-{personTotal.toFixed(2)}</span>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <label className="text-2xs text-muted-foreground whitespace-nowrap">Data Desconto:</label>
                        <Input
                          type="date"
                          className="h-7 text-xs w-32 px-2"
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
                    </div>
                  </div>


                  {/* Expanded details */}
                  {expanded && (
                    <div className="bg-muted/10 px-4 pb-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left px-2 py-1.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Data</th>
                            <th className="text-left px-2 py-1.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Job</th>
                            <th className="text-right px-2 py-1.5 text-2xs uppercase tracking-wider font-medium text-destructive">Café (R$)</th>
                            <th className="text-right px-2 py-1.5 text-2xs uppercase tracking-wider font-medium text-destructive">Almoço (R$)</th>
                            <th className="text-right px-2 py-1.5 text-2xs uppercase tracking-wider font-medium text-destructive">Janta (R$)</th>
                            <th className="text-right px-2 py-1.5 text-2xs uppercase tracking-wider font-medium text-destructive">Total (R$)</th>
                            <th className="text-left px-2 py-1.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Motivo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {personDiscounts.map((d, i) => (
                            <tr key={`${d.date}-${i}`} className="hover:bg-muted/20">
                              <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{d.date?.includes("-") ? d.date.split("-").reverse().join("/") : "—"}</td>
                              <td className="px-2 py-1.5 text-xs text-muted-foreground">{getJobName(d.jobId)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-destructive">
                                {d.discountCafe > 0 ? `-${d.discountCafe.toFixed(2)}` : "—"}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-destructive">
                                {d.discountAlmoco > 0 ? `-${d.discountAlmoco.toFixed(2)}` : "—"}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-destructive">
                                {d.discountJanta > 0 ? `-${d.discountJanta.toFixed(2)}` : "—"}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-destructive">
                                -{d.total.toFixed(2)}
                              </td>
                              <td className="px-2 py-1.5 text-xs text-muted-foreground">{d.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Totals & actions */}
      {groupedByPerson.size > 0 && (
        <>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <span className="text-sm font-semibold uppercase text-muted-foreground">Total Descontos</span>
            <span className="tabular-nums text-lg font-bold text-destructive">-{totalDiscount.toFixed(2)}</span>
          </div>
          <div className="flex flex-wrap gap-3">
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
    </div>
  );
};

export default DiscountsTab;
