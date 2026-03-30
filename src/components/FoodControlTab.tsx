import { useMemo, useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  type Person,
  type Job,
  type MealRequest,
  type TimeEntry,
  type FoodControlEntry,
  getDatesInRange,
  determineMealsUsed,
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
    if (!id || id === "no-job") return "—";

    const job = jobs.find((j) => j.id === id);
    if (job) return job.name;
    const matchByName = jobs.find(j => j.name.startsWith(id + " - ") || j.name === id);
    if (matchByName) return matchByName.name;

    return id;
  };

  const updateJobId = (entryId: string, newJobId: string) => {
    const entry = timeEntries.find(e => e.id === entryId);
    if (!entry) return;
    const updated = { ...entry, jobId: newJobId };
    onUpdateEntry(updated as any);
  };

  const isPersonRegistered = (id: string) => {
    const p = people.find((p) => p.id === id);
    if (!p) return false;
    return !!(p.isRegistered || (p as any).is_registered);
  };

  const rows = useMemo(() => {
    // 1. Mapas de Busca Rápidos
    const foodControlByPersonDate = new Map<string, FoodControlEntry>();
    foodControl.forEach(fc => {
      const key = `${fc.personId}|${fc.date}`;
      const existing = foodControlByPersonDate.get(key);
      if (existing) {
        existing.usedCafe = existing.usedCafe || fc.usedCafe;
        existing.usedAlmoco = existing.usedAlmoco || fc.usedAlmoco;
        existing.usedJanta = existing.usedJanta || fc.usedJanta;
      } else {
        foodControlByPersonDate.set(key, { ...fc });
      }
    });

    const timeEntriesByPersonDate = new Map<string, TimeEntry>();
    timeEntries.forEach(e => {
      const key = `${e.personId}|${e.date}`;
      const existing = timeEntriesByPersonDate.get(key);
      if (!existing || e.isTravelOut || e.isTravelReturn) {
        timeEntriesByPersonDate.set(key, e);
      }
    });

    const peopleMap = new Map<string, Person>();
    people.forEach(p => peopleMap.set(p.id, p));

    // 2. Pré-indexar Requests por Pessoa|Data para lookup O(1)
    const requestsByPersonDate = new Map<string, MealRequest>();
    requests.forEach(req => {
        getDatesInRange(req.startDate, req.endDate).forEach(d => {
            const key = `${req.personId}|${d}`;
            if (!requestsByPersonDate.has(key)) {
                requestsByPersonDate.set(key, req);
            }
        });
    });

    // 3. Unificação por Pessoa e Data
    const masterKeys = new Set<string>();
    timeEntriesByPersonDate.forEach((_, key) => masterKeys.add(key));
    foodControlByPersonDate.forEach((_, key) => masterKeys.add(key));
    requestsByPersonDate.forEach((_, key) => masterKeys.add(key));

    const result: (FoodControlEntry & { key: string })[] = [];

    masterKeys.forEach(combinedKey => {
        const [personId, date] = combinedKey.split("|");
        if (!personId || !date) return;
        
        const existingFC = foodControlByPersonDate.get(combinedKey);
        const timeEntry = timeEntriesByPersonDate.get(combinedKey);
        const req = requestsByPersonDate.get(combinedKey);
        
        const displayJobId = existingFC?.jobId || timeEntry?.jobId || req?.jobId || "no-job";

        const person = peopleMap.get(personId);
        const dayMeals = req ? getActiveMeals(req, date, person) : [];
        const requestedCafe = dayMeals.includes("cafe");
        const requestedAlmoco = dayMeals.includes("almoco");
        const requestedJanta = dayMeals.includes("janta");

        const rowKey = `fc-${personId}-${date}`;

        if (existingFC) {
          result.push({
            ...existingFC,
            jobId: displayJobId,
            key: rowKey,
            requestedCafe,
            requestedAlmoco,
            requestedJanta
          });
        } else {
          const used = determineMealsUsed(timeEntry, req || { id: "dummy", personId, jobId: displayJobId, startDate: date, endDate: date, meals: [] as any[] }, date);
          result.push({
            personId,
            jobId: displayJobId,
            date,
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

    return result.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (a.personId || "").localeCompare(b.personId || ""));
  }, [timeEntries, requests, foodControl, people, jobs]);

  const updateUsed = (personId: string, jobId: string, date: string, field: "usedCafe" | "usedAlmoco" | "usedJanta", value: boolean) => {
    let stableJobId = jobId;
    const realJob = jobs.find(j => j.id === jobId || j.name.startsWith(jobId + " - ") || j.name === jobId);
    if (realJob) stableJobId = realJob.id;

    const currentRow = rows.find(r => r.personId === personId && r.date === date);
    
    const mapField = field === "usedCafe" ? "cafe" : field === "usedAlmoco" ? "almoco" : "janta";

    const updated: FoodControlEntry = {
      id: currentRow?.id,
      personId, 
      jobId: stableJobId, 
      date,
      usedCafe: field === "usedCafe" ? value : (currentRow?.usedCafe || false),
      usedAlmoco: field === "usedAlmoco" ? value : (currentRow?.usedAlmoco || false),
      usedJanta: field === "usedJanta" ? value : (currentRow?.usedJanta || false),
      updatedFields: [mapField as any],
    };

    onUpdateEntry(updated);
  };

  const filteredRows = rows.filter((row) => {
    if (filterJob !== "all" && row.jobId !== filterJob) {
      const job = jobs.find(j => j.id === filterJob);
      if (job && !row.jobId.includes(job.id)) return false;
    }
    if (filterDate && row.date !== filterDate) return false;
    if (filterPerson && row.personId !== filterPerson) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end bg-muted/20 p-4 rounded-lg border border-border/50">
        <div className="space-y-1.5 min-w-[200px]">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtrar por Job</label>
          <Select value={filterJob} onValueChange={setFilterJob}>
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue placeholder="Todos os Jobs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Jobs</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</label>
          <input
            type="date"
            className="flex h-10 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus:ring-2 focus:ring-primary/20"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5 min-w-[240px]">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pessoa</label>
          <Select value={filterPerson} onValueChange={setFilterPerson}>
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue placeholder="Todas as Pessoas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Pessoas</SelectItem>
              {people.sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border/50">
              <th className="px-3 py-3 text-2xs font-black uppercase text-muted-foreground tracking-widest min-w-[180px]">Profissional</th>
              <th className="px-3 py-3 text-2xs font-black uppercase text-muted-foreground tracking-widest w-[160px]">Job Atual</th>
              <th className="px-3 py-3 text-2xs font-black uppercase text-muted-foreground tracking-widest w-[100px]">Data</th>
              <th className="text-center px-1 py-1 text-2xs font-black uppercase text-muted-foreground tracking-widest bg-primary/5" colSpan={3}>Solicitado</th>
              <th className="text-center px-1 py-1 text-2xs font-black uppercase text-muted-foreground tracking-widest bg-green-500/5" colSpan={3}>Utilizado</th>
            </tr>
            <tr className="bg-muted/20 border-b border-border/10">
              <th colSpan={3}></th>
              <th className="text-center px-1 py-1 text-2xs text-primary">Café</th>
              <th className="text-center px-1 py-1 text-2xs text-primary">Almoço</th>
              <th className="text-center px-1 py-1 text-2xs text-primary">Janta</th>
              <th className="text-center px-1 py-1 text-2xs text-green-600">Café</th>
              <th className="text-center px-1 py-1 text-2xs text-green-600">Almoço</th>
              <th className="text-center px-1 py-1 text-2xs text-green-600">Janta</th>
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
                    ) : (row.requestedAlmoco || (isPersonRegistered(row.personId) && isWeekendOrHoliday(row.date))) ? (
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
