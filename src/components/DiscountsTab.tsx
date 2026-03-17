import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  type Person,
  type Job,
  type MealRequest,
  type TimeEntry,
  MEAL_LABELS,
  MEAL_VALUES,
  getDatesInRange,
  calcTotalMinutes,
} from "@/lib/types";

interface DiscountsTabProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries: TimeEntry[];
}

interface DiscountRow {
  personId: string;
  jobId: string;
  date: string;
  meals: string[];
  dailyValue: number;
}

const DiscountsTab = ({ people, jobs, requests, timeEntries }: DiscountsTabProps) => {
  const getPersonName = (id: string) => people.find((p) => p.id === id)?.name || "—";
  const getJobName = (id: string) => jobs.find((j) => j.id === id)?.name || "—";

  const discounts = useMemo(() => {
    const rows: DiscountRow[] = [];

    requests.forEach((req) => {
      const dates = getDatesInRange(req.startDate, req.endDate);
      dates.forEach((date) => {
        // Check if there's a time entry for this person+job+date with actual hours
        const entry = timeEntries.find(
          (e) => e.personId === req.personId && e.jobId === req.jobId && e.date === date
        );
        const hasHours = entry && calcTotalMinutes(entry) > 0;

        if (!hasHours) {
          const dailyValue = req.meals.reduce((s, m) => s + MEAL_VALUES[m], 0);
          rows.push({
            personId: req.personId,
            jobId: req.jobId,
            date,
            meals: req.meals.map((m) => MEAL_LABELS[m]),
            dailyValue,
          });
        }
      });
    });

    return rows;
  }, [requests, timeEntries]);

  const totalDiscount = discounts.reduce((s, d) => s + d.dailyValue, 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Dias em que a pessoa tinha refeição solicitada mas não registrou horas (falta). O valor não utilizado será descontado.
      </p>

      <div className="rounded-xl border border-border overflow-x-auto shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Pessoa</th>
              <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Job</th>
              <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Data</th>
              <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Refeições</th>
              <th className="text-right px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-destructive">Desconto (R$)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {discounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-sm text-muted-foreground">
                  Nenhum desconto pendente. Todas as pessoas com refeição solicitada registraram horas.
                </td>
              </tr>
            ) : (
              discounts.map((d, i) => (
                <tr key={`${d.personId}-${d.date}-${i}`} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium text-foreground">{getPersonName(d.personId)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{getJobName(d.jobId)}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {d.date.split("-").reverse().join("/")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {d.meals.map((m) => (
                        <Badge key={m} variant="secondary" className="text-2xs">{m}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-destructive">
                    -{d.dailyValue.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {discounts.length > 0 && (
            <tfoot>
              <tr className="bg-muted/30 border-t border-border">
                <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-muted-foreground">
                  Total Descontos
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold text-destructive">
                  -{totalDiscount.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default DiscountsTab;
