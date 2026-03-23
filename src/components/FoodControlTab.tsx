import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
  isWeekendOrHoliday,
} from "@/lib/types";

interface FoodControlTabProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries: TimeEntry[];
  foodControl: FoodControlEntry[];
  setFoodControl?: React.Dispatch<React.SetStateAction<FoodControlEntry[]>>;
  onUpdateEntry?: (entry: FoodControlEntry) => void;
}

const FoodControlTab = ({
  people,
  jobs,
  requests,
  timeEntries,
  foodControl,
  setFoodControl,
  onUpdateEntry,
}: FoodControlTabProps) => {

  const [filterJob, setFilterJob] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  const getPersonName = (id: string) => people.find((p) => p.id === id)?.name || "—";
  const getJobName = (id: string) => jobs.find((j) => j.id === id)?.name || "—";

  const registeredRequests = useMemo(() => {
    return requests;
  }, [requests]);

  const isPersonRegistered = (id: string) => people.find((p) => p.id === id)?.isRegistered || false;

  const rows = useMemo(() => {
    const result: (FoodControlEntry & { key: string })[] = [];

    timeEntries.forEach((entry) => {
        // A aba de Controle Alimentar é agora um ESPELHO TOTAL do Registro de Horas (Ponto)
        // Não aplicamos mais a 'Linha Fantasma' aqui, conforme solicitado (mostrar todas as linhas).
        if (!entry) return;

        // Procurar solicitação de refeição associada
        const req = requests.find(r => r.personId === entry.personId && r.jobId === entry.jobId && entry.date >= r.startDate && entry.date <= r.endDate);

        const key = `${entry.id}`; // 1:1 com o ID do Ponto
        const existing = foodControl.find(fc => fc.id === entry.id || (fc.personId === entry.personId && fc.jobId === entry.jobId && fc.date === entry.date));

        const dayMeals = req ? (req.dailyOverrides?.[entry.date] ?? req.meals) : [];
        const requestedCafe = Array.isArray(dayMeals) && dayMeals.includes("cafe");
        const requestedAlmoco = Array.isArray(dayMeals) && dayMeals.includes("almoco");
        const requestedJanta = Array.isArray(dayMeals) && dayMeals.includes("janta");

        if (existing) {
          result.push({ 
            ...existing, 
            key,
            requestedCafe,
            requestedAlmoco,
            requestedJanta
          });
        } else {
          // Se não houver override manual no FoodControl, calculamos o 'sugerido' pelo ponto
          let used = { cafe: false, almoco: false, janta: false };
          if (req) {
            used = determineMealsUsed(entry, req, entry.date);
          }

          result.push({
            id: entry.id, // Sincroniza o ID
            personId: entry.personId,
            jobId: entry.jobId,
            date: entry.date,
            key,
            requestedCafe,
            requestedAlmoco,
            requestedJanta,
            usedCafe: used.cafe,
            usedAlmoco: used.almoco,
            usedJanta: used.janta,
          });
        }
    });

    return result.sort((a, b) => b.date.localeCompare(a.date) || a.personId.localeCompare(b.personId));
  }, [timeEntries, requests, foodControl]);

  const updateUsed = (personId: string, jobId: string, date: string, field: "usedCafe" | "usedAlmoco" | "usedJanta", value: boolean) => {
    const row = rows.find((r) => r.personId === personId && r.jobId === jobId && r.date === date);
    if (!row) return;

    const updated: FoodControlEntry = {
      id: row.id, // Ensure ID is passed
      personId, jobId, date,
      requestedCafe: row.requestedCafe,
      requestedAlmoco: row.requestedAlmoco,
      requestedJanta: row.requestedJanta,
      usedCafe: field === "usedCafe" ? value : row.usedCafe,
      usedAlmoco: field === "usedAlmoco" ? value : row.usedAlmoco,
      usedJanta: field === "usedJanta" ? value : row.usedJanta,
    };

    onUpdateEntry?.(updated);
    setFoodControl?.((prev) => {
      const idx = prev.findIndex((fc) => fc.personId === personId && fc.jobId === jobId && fc.date === date);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [...prev, updated];
    });
  };

  const filteredRows = rows.filter((r) => {
    if (filterJob !== "all" && r.jobId !== filterJob) return false;
    if (filterDate && r.date !== filterDate) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Controle de alimentação: compare o que foi solicitado com o que foi efetivamente utilizado. Marque os círculos verdes para uso real.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end p-3 rounded-lg border border-border bg-muted/30">
        <Filter className="h-4 w-4 text-muted-foreground mt-1" />
        <div className="min-w-[200px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Filtrar Job
          </label>
          <SearchableSelect
            options={[{ value: "all", label: "Todos" }, ...jobs.map(j => ({ value: j.id, label: j.name }))]}
            value={filterJob}
            onValueChange={setFilterJob}
            className="h-8 text-xs"
          />
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
            </tr>
            <tr className="bg-muted/30">
              <th colSpan={3}></th>
              <th className="text-center px-1 py-1 text-2xs text-muted-foreground">Café</th>
              <th className="text-center px-1 py-1 text-2xs text-muted-foreground">Almoço</th>
              <th className="text-center px-1 py-1 text-2xs text-muted-foreground">Janta</th>
              <th className="text-center px-1 py-1 text-2xs text-primary">Café</th>
              <th className="text-center px-1 py-1 text-2xs text-primary">Almoço</th>
              <th className="text-center px-1 py-1 text-2xs text-primary">Janta</th>
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
              filteredRows.map((row) => (
                <tr key={row.key} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{getPersonName(row.personId)}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap max-w-[160px] truncate">{getJobName(row.jobId)}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.date?.includes("-") ? row.date.split("-").reverse().join("/") : row.date || "—"}</td>
                  
                  <td className="text-center px-1 py-2">
                    {row.requestedCafe ? <Badge className="text-2xs opacity-60">✓</Badge> : <span className="text-muted-foreground/30">—</span>}
                  </td>
                  <td className="text-center px-1 py-2">
                    {isPersonRegistered(row.personId) && !isWeekendOrHoliday(row.date) ? (
                      <Badge className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 border-primary/20" title="Garantido por Regra CLT">✓*</Badge>
                    ) : row.requestedAlmoco ? (
                      <Badge className="text-2xs opacity-60">✓</Badge>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>
                  <td className="text-center px-1 py-2">
                    {row.requestedJanta ? <Badge className="text-2xs opacity-60">✓</Badge> : <span className="text-muted-foreground/30">—</span>}
                  </td>

                  <td className="text-center px-1 py-4">
                    <Checkbox 
                      checked={row.usedCafe} 
                      onCheckedChange={(v) => updateUsed(row.personId, row.jobId, row.date, "usedCafe", !!v)} 
                      className="h-6 w-6 rounded-full border-2 border-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                    />
                  </td>
                  <td className="text-center px-1 py-4">
                    <Checkbox 
                      checked={row.usedAlmoco} 
                      onCheckedChange={(v) => updateUsed(row.personId, row.jobId, row.date, "usedAlmoco", !!v)} 
                      className="h-6 w-6 rounded-full border-2 border-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                    />
                  </td>
                  <td className="text-center px-1 py-4">
                    <Checkbox 
                      checked={row.usedJanta} 
                      onCheckedChange={(v) => updateUsed(row.personId, row.jobId, row.date, "usedJanta", !!v)} 
                      className="h-6 w-6 rounded-full border-2 border-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FoodControlTab;
