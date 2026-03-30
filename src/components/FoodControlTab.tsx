import { useMemo, useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
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
  getActiveMeals,
} from "@/lib/types";

interface FoodControlTabProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries: TimeEntry[];
  foodControl: FoodControlEntry[];
  onUpdateEntry: (entry: FoodControlEntry) => void;
  initialJobFilter?: string;
}

const FoodControlTab = ({
  people,
  jobs,
  requests,
  timeEntries,
  foodControl,
  onUpdateEntry,
  initialJobFilter = "all"
}: FoodControlTabProps) => {

  const [filterJob, setFilterJob] = useState(initialJobFilter);
  const [filterDate, setFilterDate] = useState("");
  const [filterPerson, setFilterPerson] = useState("");

  useEffect(() => {
    if (initialJobFilter) setFilterJob(initialJobFilter);
  }, [initialJobFilter]);

  const getPersonName = (id: string) => people.find((p) => p.id === id)?.name || "—";
  const getJobName = (entryOrId: string | { jobId: string, personId: string, date: string }) => {
    const id = typeof entryOrId === 'string' ? entryOrId : entryOrId.jobId;
    if (!id) return "—";

    const job = jobs.find((j) => j.id === id);
    if (job) return job.name;
    const matchByName = jobs.find(j => j.name.startsWith(id + " - ") || j.name === id);
    if (matchByName) return matchByName.name;

    if (typeof entryOrId !== 'string') {
      const req = requests.find(r => r.personId === (entryOrId as any).personId && (entryOrId as any).date >= r.startDate && (entryOrId as any).date <= r.endDate);
      if (req) {
        const reqJob = jobs.find(j => j.id === req.jobId);
        if (reqJob) return reqJob.name;
      }
    }

    if (!id.includes("-") || id.length < 30) return id;
    return `Removido (${id.substring(0, 5)})`;
  };

  const updateJobId = (entryId: string, newJobId: string) => {
    const entry = timeEntries.find(e => e.id === entryId);
    if (!entry) return;
    const updated = { ...entry, jobId: newJobId };
    onUpdateEntry(updated as any);
  };

  const registeredRequests = useMemo(() => {
    return requests;
  }, [requests]);

  const isPersonRegistered = (id: string) => {
    const p = people.find((p) => p.id === id);
    if (!p) return false;
    return !!(p.isRegistered || (p as any).is_registered);
  };

  const rows = useMemo(() => {
    // 1. Mapas de Busca Rápidos (O(1))
    const foodControlByKey = new Map<string, FoodControlEntry>();
    foodControl.forEach(fc => {
      foodControlByKey.set(`${fc.personId}-${fc.jobId}-${fc.date}`, fc);
    });

    const requestsByPersonJob = new Map<string, MealRequest[]>();
    requests.forEach(r => {
      const key = `${r.personId}-${r.jobId}`;
      if (!requestsByPersonJob.has(key)) requestsByPersonJob.set(key, []);
      requestsByPersonJob.get(key)!.push(r);
    });

    const peopleMap = new Map<string, Person>();
    people.forEach(p => peopleMap.set(p.id, p));

    const jobsMap = new Map<string, Job>();
    jobs.forEach(j => jobsMap.set(j.id, j));

    // 2. Deduplicação em Massa O(N)
    // Para o controle alimentar, nos interessa (Pessoa + Job + Data)
    const entryBestVersion = new Map<string, TimeEntry>();
    timeEntries.forEach(e => {
      const key = `${e.personId}-${e.jobId}-${e.date}`;
      const existing = entryBestVersion.get(key);
      // Regra de prioridade: Viagens (Ida/Volta) têm preferência visual na tabela
      if (!existing || e.isTravelOut || e.isTravelReturn) {
        entryBestVersion.set(key, e);
      }
    });

    const result: (FoodControlEntry & { key: string })[] = [];

    try {
      Array.from(entryBestVersion.values()).forEach((entry) => {
        if (!entry || !entry.personId) return;

        const personJobKey = `${entry.personId}-${entry.jobId}`;
        const possibleReqs = requestsByPersonJob.get(personJobKey) || [];
        const req = possibleReqs.find(r => entry.date >= r.startDate && entry.date <= r.endDate);

        const compositeKey = `${entry.personId}-${entry.jobId}-${entry.date}`;
        const existing = foodControlByKey.get(compositeKey);

        const personAtTime = peopleMap.get(entry.personId);
        const dayMeals = req ? getActiveMeals(req, entry.date, personAtTime) : [];
        const requestedCafe = Array.isArray(dayMeals) && dayMeals.includes("cafe");
        const requestedAlmoco = Array.isArray(dayMeals) && dayMeals.includes("almoco");
        const requestedJanta = Array.isArray(dayMeals) && dayMeals.includes("janta");

        const rowKey = `fc-${entry.id || Math.random()}`;

        if (existing) {
          result.push({
            ...existing,
            key: rowKey,
            requestedCafe,
            requestedAlmoco,
            requestedJanta
          });
        } else {
          let used = { cafe: false, almoco: false, janta: false };
          try {
            if (req) {
              used = determineMealsUsed(entry, req, entry.date);
            }
          } catch (e) {
            console.error("Erro ao determinar uso de refeição:", e);
          }

          result.push({
            id: entry.id,
            personId: entry.personId,
            jobId: entry.jobId,
            date: entry.date,
            key: rowKey,
            requestedCafe,
            requestedAlmoco,
            requestedJanta,
            usedCafe: used.cafe,
            usedAlmoco: used.almoco,
            usedJanta: used.janta,
          });
        }
      });
    } catch (err) {
      console.error("Critical error calculating FoodControl rows:", err);
    }

    return result.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (a.personId || "").localeCompare(b.personId || ""));
  }, [timeEntries, requests, foodControl, people, jobs]);

  const updateUsed = (personId: string, jobId: string, date: string, field: "usedCafe" | "usedAlmoco" | "usedJanta", value: boolean) => {
    // Importante: Garantir que o jobId seja o original (UUID), não o texto formatado da tabela
    const row = rows.find((r) => r.personId === personId && r.jobId === jobId && r.date === date);
    if (!row) return;

    // Se o jobId for o texto formatado "Removido...", precisamos do real do entryId
    let realJobId = jobId;
    if (jobId.startsWith("Removido (")) {
       const entry = timeEntries.find(e => e.personId === personId && e.date === date);
       if (entry) realJobId = entry.jobId;
    }

    const updated: FoodControlEntry = {
      id: row.id,
      personId, 
      jobId: realJobId, 
      date,
      requestedCafe: row.requestedCafe,
      requestedAlmoco: row.requestedAlmoco,
      requestedJanta: row.requestedJanta,
      usedCafe: field === "usedCafe" ? value : row.usedCafe,
      usedAlmoco: field === "usedAlmoco" ? value : row.usedAlmoco,
      usedJanta: field === "usedJanta" ? value : row.usedJanta,
    };

    onUpdateEntry(updated);
  };

  const filteredRows = rows.filter((r) => {
    if (filterJob !== "all" && r.jobId !== filterJob) return false;
    if (filterDate && r.date !== filterDate) return false;
    if (filterPerson && filterPerson !== "all" && r.personId !== filterPerson) return false;
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
            options={[
              { value: "all", label: "Todos os Jobs" },
              ...Array.from(new Map(jobs.map(j => [j.name.toLowerCase().trim(), j])).values()).map(j => {
                const parts = j.name.split(" - ");
                return {
                  value: j.id,
                  label: j.name,
                  description: parts[1] ? `Projeto: ${parts[1]}` : undefined
                };
              })
            ]}
            value={filterJob}
            onValueChange={setFilterJob}
            placeholder="Filtrar Job"
            className="h-8 text-xs"
          />
        </div>

        <div className="min-w-[200px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Filtrar Pessoa
          </label>
          <SearchableSelect
            options={[{ value: "all", label: "Todas as Pessoas" }, ...people.map(p => ({ value: p.id, label: p.name }))]}
            value={filterPerson}
            onValueChange={setFilterPerson}
            placeholder="Filtrar Pessoa"
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
                  <td className="px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap max-w-[160px] truncate">
                    {(() => {
                      const jStr = getJobName(row);
                      const parts = jStr.split(" - ");
                      if (jStr.includes("Removido (")) {
                        return (
                          <Select onValueChange={(val) => updateJobId(row.id, val)}>
                            <SelectTrigger className="h-6 text-[10px] bg-red-50 border-red-200 text-red-600 px-2 py-0">
                              <SelectValue placeholder="Corrigir Vínculo..." />
                            </SelectTrigger>
                            <SelectContent>
                              {jobs.map(j => <SelectItem key={j.id} value={j.id} className="text-[10px]">{j.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        );
                      }
                      return (
                        <div className="flex flex-col min-w-0 max-w-[140px] leading-tight">
                          <span className="font-black text-[10px] text-primary tabular-nums tracking-tighter">{parts[0]}</span>
                          {parts[1] && <span className="text-[9px] uppercase font-bold text-muted-foreground truncate opacity-70" title={parts[1]}>{parts[1]}</span>}
                        </div>
                      );
                    })()}
                  </td>
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
