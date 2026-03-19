import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Check, Mail, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";


import {
  type Person,
  type Job,
  type MealRequest,
  type TimeEntry,
  type FoodControlEntry,
  type DiscountConfirmation,
  MEAL_LABELS,
  MEAL_VALUES,
  getDatesInRange,
  calcTotalMinutes,
  getFirstEntryTime,
  getMealValue,
} from "@/lib/types";

interface DiscountsTabProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries: TimeEntry[];
  foodControl: FoodControlEntry[];
  confirmations: DiscountConfirmation[];
  setConfirmations: (confs: DiscountConfirmation[]) => void;
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

  const discounts = useMemo(() => {
    const rows: DiscountRow[] = [];

    requests.forEach((req) => {
      const dates = getDatesInRange(req.startDate, req.endDate);
      dates.forEach((date) => {
        const entry = timeEntries.find(
          (e) => e.personId === req.personId && e.jobId === req.jobId && e.date === date
        );
        // Only show discounts for days with time entries registered
        if (!entry) return;
        const hasHours = calcTotalMinutes(entry) > 0;

        // Use daily overrides if they exist for this date, otherwise use original meals
        const dayMeals = req.dailyOverrides?.[date] ?? req.meals;

        // Check food control overrides
        const fc = foodControl.find(
          (f) => f.personId === req.personId && f.jobId === req.jobId && f.date === date
        );

        let discountCafe = 0;
        let discountAlmoco = 0;
        let discountJanta = 0;
        let reason = "";

        const person = people.find((p) => p.id === req.personId);
        const refCafe = getMealValue("cafe", date, person);
        const refAlmoco = getMealValue("almoco", date, person);
        const refJanta = getMealValue("janta", date, person);

        if (!hasHours) {
          // Falta total - desconta tudo que foi solicitado NESSE DIA
          if (dayMeals.includes("cafe")) discountCafe = refCafe;
          if (dayMeals.includes("almoco")) discountAlmoco = refAlmoco;
          if (dayMeals.includes("janta")) discountJanta = refJanta;
          reason = "Falta - sem registro de horas";
        } else if (entry) {
          // Partial - check time-based rules
          const firstEntry = getFirstEntryTime(entry);
          if (firstEntry) {
            const [eh] = firstEntry.split(":").map(Number);
            // If entered after 8:00 and cafe was requested for this day, discount cafe
            if (dayMeals.includes("cafe") && eh > 8) {
              discountCafe = refCafe;
              reason = `Entrada às ${firstEntry} - café não utilizado`;
            }
          }
        }

        // Apply food control overrides: if fc says "not used", it's a discount
        // Only apply discount if the meal was actually in the day's meal list
        if (fc) {
          if (dayMeals.includes("cafe") && !fc.usedCafe) discountCafe = refCafe;
          else if (dayMeals.includes("cafe") && fc.usedCafe) discountCafe = 0;

          if (dayMeals.includes("almoco") && !fc.usedAlmoco) discountAlmoco = refAlmoco;
          else if (dayMeals.includes("almoco") && fc.usedAlmoco) discountAlmoco = 0;

          if (dayMeals.includes("janta") && !fc.usedJanta) discountJanta = refJanta;
          else if (dayMeals.includes("janta") && fc.usedJanta) discountJanta = 0;

          if (!reason) reason = "Ajuste via controle de alimentação";
        }

        const total = discountCafe + discountAlmoco + discountJanta;
        if (total > 0) {
          rows.push({ personId: req.personId, jobId: req.jobId, date, discountCafe, discountAlmoco, discountJanta, total, reason });
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

  const isConfirmed = (personId: string) => confirmations.find((c) => c.personId === personId)?.confirmed || false;

  const updatePaymentDate = (personId: string, date: string) => {
    const updated: DiscountConfirmation = { personId, paymentDate: date, confirmed: !!date };
    onUpdateConfirmation?.(updated);

    const idx = confirmations.findIndex((c) => c.personId === personId);
    if (idx >= 0) {
      const copy = [...confirmations];
      copy[idx] = updated;
      setConfirmations(copy);
    } else {
      setConfirmations([...confirmations, updated]);
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
        d.date.split("-").reverse().join("/"),
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
              const personConfirmation = confirmations.find((c) => c.personId === personId);
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
                        <Badge variant="secondary" className="text-2xs bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                          {paymentDate ? `Pago em ${paymentDate.split("-").reverse().join("/")}` : "Pago"}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-2xs">
                          Pendente
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums font-bold text-destructive mr-2">-{personTotal.toFixed(2)}</span>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <label className="text-2xs text-muted-foreground whitespace-nowrap">Data Pgto:</label>
                        <Input
                          type="date"
                          className="h-7 text-xs w-32 px-2"
                          value={paymentDate}
                          onChange={(e) => updatePaymentDate(personId, e.target.value)}
                        />
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
                              <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{d.date.split("-").reverse().join("/")}</td>
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
