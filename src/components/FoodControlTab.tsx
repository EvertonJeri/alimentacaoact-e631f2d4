import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Filter } from "lucide-react";
import {
  type Person,
  type Job,
  type MealRequest,
  type TimeEntry,
  type FoodControlEntry,
  MEAL_LABELS,
  MEAL_VALUES,
  getDatesInRange,
  determineMealsUsed,
  getMealValue,
} from "@/lib/types";

interface FoodControlTabProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries: TimeEntry[];
  foodControl: FoodControlEntry[];
  setFoodControl: React.Dispatch<React.SetStateAction<FoodControlEntry[]>>;
}

const FoodControlTab = ({ people, jobs, requests, timeEntries, foodControl, setFoodControl }: FoodControlTabProps) => {
  const [filterJob, setFilterJob] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  const getPersonName = (id: string) => people.find((p) => p.id === id)?.name || "—";
  const getJobName = (id: string) => jobs.find((j) => j.id === id)?.name || "—";

  // Build rows from requests, merging with foodControl overrides
  const rows = useMemo(() => {
    const result: (FoodControlEntry & { key: string })[] = [];

    requests.forEach((req) => {
      const dates = getDatesInRange(req.startDate, req.endDate);
      dates.forEach((date) => {
        const key = `${req.personId}-${req.jobId}-${date}`;
        const existing = foodControl.find(
          (fc) => fc.personId === req.personId && fc.jobId === req.jobId && fc.date === date
        );

        if (existing) {
          result.push({ ...existing, key });
        } else {
          // Auto-determine used meals from time entries
          const entry = timeEntries.find(
            (e) => e.personId === req.personId && e.jobId === req.jobId && e.date === date
          );
          const used = entry ? determineMealsUsed(entry) : { cafe: false, almoco: false, janta: false };

          result.push({
            key,
            personId: req.personId,
            jobId: req.jobId,
            date,
            requestedCafe: req.meals.includes("cafe"),
            requestedAlmoco: req.meals.includes("almoco"),
            requestedJanta: req.meals.includes("janta"),
            usedCafe: used.cafe,
            usedAlmoco: used.almoco,
            usedJanta: used.janta,
          });
        }
      });
    });

    return result.sort((a, b) => a.date.localeCompare(b.date) || a.personId.localeCompare(b.personId));
  }, [requests, timeEntries, foodControl]);

  const updateUsed = (personId: string, jobId: string, date: string, field: "usedCafe" | "usedAlmoco" | "usedJanta", value: boolean) => {
    setFoodControl((prev) => {
      const idx = prev.findIndex((fc) => fc.personId === personId && fc.jobId === jobId && fc.date === date);
      const row = rows.find((r) => r.personId === personId && r.jobId === jobId && r.date === date);
      if (!row) return prev;

      const updated: FoodControlEntry = {
        personId, jobId, date,
        requestedCafe: row.requestedCafe,
        requestedAlmoco: row.requestedAlmoco,
        requestedJanta: row.requestedJanta,
        usedCafe: field === "usedCafe" ? value : row.usedCafe,
        usedAlmoco: field === "usedAlmoco" ? value : row.usedAlmoco,
        usedJanta: field === "usedJanta" ? value : row.usedJanta,
      };

      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [...prev, updated];
    });
  };

  // Calculate balance per row
  const getBalance = (row: FoodControlEntry & { key: string }) => {
    let balance = 0;
    const person = people.find((p) => p.id === row.personId);
    if (row.usedCafe && !row.requestedCafe) balance += getMealValue("cafe", row.date, person);
    if (row.usedAlmoco && !row.requestedAlmoco) balance += getMealValue("almoco", row.date, person);
    if (row.usedJanta && !row.requestedJanta) balance += getMealValue("janta", row.date, person);
    return balance;
  };

  const filteredRows = rows.filter((r) => {
    if (filterJob !== "all" && r.jobId !== filterJob) return false;
    if (filterDate && r.date !== filterDate) return false;
    return true;
  });

  const totalBalance = filteredRows.reduce((sum, r) => sum + getBalance(r), 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Controle de alimentação: compare o que foi solicitado com o que foi efetivamente utilizado. Edite a coluna "Utilizado" conforme necessário. O saldo mostra valores adicionais a depositar.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end p-3 rounded-lg border border-border bg-muted/30">
        <Filter className="h-4 w-4 text-muted-foreground mt-1" />
        <div className="min-w-[200px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Filtrar Job
          </label>
          <Select value={filterJob} onValueChange={setFilterJob}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Filtrar Data
          </label>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-8 text-xs tabular-nums"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Pessoa</th>
              <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Job</th>
              <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Data</th>
              <th className="text-center px-2 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground" colSpan={3}>Solicitado</th>
              <th className="text-center px-2 py-2.5 text-2xs uppercase tracking-wider font-medium text-primary" colSpan={3}>Utilizado</th>
              <th className="text-right px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-primary">Saldo (R$)</th>
            </tr>
            <tr className="bg-muted/30">
              <th colSpan={3}></th>
              <th className="text-center px-1 py-1 text-2xs text-muted-foreground">Café</th>
              <th className="text-center px-1 py-1 text-2xs text-muted-foreground">Almoço</th>
              <th className="text-center px-1 py-1 text-2xs text-muted-foreground">Janta</th>
              <th className="text-center px-1 py-1 text-2xs text-primary">Café</th>
              <th className="text-center px-1 py-1 text-2xs text-primary">Almoço</th>
              <th className="text-center px-1 py-1 text-2xs text-primary">Janta</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-10 text-sm text-muted-foreground">
                  Nenhuma solicitação de refeição encontrada.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const balance = getBalance(row);
                return (
                  <tr key={row.key} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{getPersonName(row.personId)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap max-w-[160px] truncate">{getJobName(row.jobId)}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.date.split("-").reverse().join("/")}</td>
                    {/* Requested columns - read only */}
                    <td className="text-center px-1 py-2">
                      {row.requestedCafe ? <Badge variant="secondary" className="text-2xs">✓</Badge> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="text-center px-1 py-2">
                      {row.requestedAlmoco ? <Badge variant="secondary" className="text-2xs">✓</Badge> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="text-center px-1 py-2">
                      {row.requestedJanta ? <Badge variant="secondary" className="text-2xs">✓</Badge> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    {/* Used columns - editable */}
                    <td className="text-center px-1 py-2">
                      <Checkbox checked={row.usedCafe} onCheckedChange={(v) => updateUsed(row.personId, row.jobId, row.date, "usedCafe", !!v)} />
                    </td>
                    <td className="text-center px-1 py-2">
                      <Checkbox checked={row.usedAlmoco} onCheckedChange={(v) => updateUsed(row.personId, row.jobId, row.date, "usedAlmoco", !!v)} />
                    </td>
                    <td className="text-center px-1 py-2">
                      <Checkbox checked={row.usedJanta} onCheckedChange={(v) => updateUsed(row.personId, row.jobId, row.date, "usedJanta", !!v)} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {balance > 0 ? (
                        <span className="text-primary">+{balance.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">0,00</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filteredRows.length > 0 && totalBalance > 0 && (
            <tfoot>
              <tr className="bg-muted/30 border-t border-border">
                <td colSpan={9} className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-muted-foreground">
                  Total Saldo a Depositar
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold text-primary">
                  +{totalBalance.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default FoodControlTab;
