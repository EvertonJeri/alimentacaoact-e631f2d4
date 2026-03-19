import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Trash2, Filter } from "lucide-react";
import {
  type Person,
  type Job,
  type TimeEntry,
  calcTotalMinutes,
  formatMinutes,
} from "@/lib/types";

const emptyEntry = (personId: string, jobId: string, date: string): TimeEntry => ({
  id: crypto.randomUUID(),
  personId,
  jobId,
  date,
  entry1: "",
  exit1: "",
  entry2: "",
  exit2: "",
  entry3: "",
  exit3: "",
});

interface TimeRegistrationTabProps {
  entries: TimeEntry[];
  setEntries: React.Dispatch<React.SetStateAction<TimeEntry[]>>;
  people: Person[];
  jobs: Job[];
  onUpdateEntry?: (entry: TimeEntry) => void;
  onRemoveEntry?: (id: string) => void;
}

const TimeRegistrationTab = ({ entries, setEntries, people, jobs, onUpdateEntry, onRemoveEntry }: TimeRegistrationTabProps) => {

  const [selectedPerson, setSelectedPerson] = useState("");
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Filters
  const [filterPerson, setFilterPerson] = useState("all");
  const [filterJob, setFilterJob] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  const addEntry = () => {
    if (!selectedPerson || !selectedJob) return;
    const entry = emptyEntry(selectedPerson, selectedJob, selectedDate);
    onUpdateEntry?.(entry);
    setEntries((prev) => [...prev, entry]);
  };

  const updateField = (id: string, field: keyof TimeEntry, value: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const updated = { ...entry, [field]: value };
    onUpdateEntry?.(updated);
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? updated : e))
    );
  };

  const removeEntry = (id: string) => {
    onRemoveEntry?.(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };


  const getPersonName = (id: string) =>
    people.find((p) => p.id === id)?.name || "—";

  const getJobName = (id: string) =>
    jobs.find((j) => j.id === id)?.name || "—";

  const filteredEntries = entries.filter((e) => {
    if (filterPerson !== "all" && e.personId !== filterPerson) return false;
    if (filterJob !== "all" && e.jobId !== filterJob) return false;
    if (filterDate && e.date !== filterDate) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Add row controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Pessoa
          </label>
          <SearchableSelect
            options={people.map(p => ({ 
              value: p.id, 
              label: `${p.name} ${p.isRegistered ? "(Registrado)" : ""}` 
            }))}
            value={selectedPerson}
            onValueChange={setSelectedPerson}
            placeholder="Selecione..."
            searchPlaceholder="Buscar pessoa..."
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Job
          </label>
          <SearchableSelect
            options={jobs.map(j => ({ value: j.id, label: j.name }))}
            value={selectedJob}
            onValueChange={setSelectedJob}
            placeholder="Selecione o JOB..."
            searchPlaceholder="Buscar JOB..."
          />
        </div>
        <div className="min-w-[160px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Data
          </label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="tabular-nums"
          />
        </div>
        <Button onClick={addEntry} disabled={!selectedPerson || !selectedJob} className="gap-1.5 bg-foreground text-background hover:bg-foreground/90">
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end p-3 rounded-lg border border-border bg-muted/30">
        <Filter className="h-4 w-4 text-muted-foreground mt-1" />
        <div className="min-w-[160px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Filtrar Pessoa
          </label>
          <SearchableSelect
            options={[{ value: "all", label: "Todas" }, ...people.map(p => ({ value: p.id, label: p.name }))]}
            value={filterPerson}
            onValueChange={setFilterPerson}
            className="h-8 text-xs"
          />
        </div>
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

      {/* Table */}
      <div className="rounded-xl border border-border overflow-x-auto shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Pessoa</th>
              <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Job</th>
              <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Data</th>
              <th className="text-center px-2 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Entrada 1</th>
              <th className="text-center px-2 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Saída 1</th>
              <th className="text-center px-2 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Entrada 2</th>
              <th className="text-center px-2 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Saída 2</th>
              <th className="text-center px-2 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Entrada 3</th>
              <th className="text-center px-2 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Saída 3</th>
              <th className="text-center px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-primary">Total</th>
              <th className="px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-10 text-sm text-muted-foreground">
                  Nenhum registro. Adicione uma pessoa, job e data acima.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => {
                const total = calcTotalMinutes(entry);
                const has6 = !!(entry.entry3 || entry.exit3);
                return (
                  <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                      {getPersonName(entry.personId)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap max-w-[180px] truncate">
                      {getJobName(entry.jobId)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap">
                      {entry.date.split("-").reverse().join("/")}
                    </td>
                    {(["entry1", "exit1", "entry2", "exit2", "entry3", "exit3"] as const).map(
                      (field) => (
                        <td key={field} className="px-1 py-1.5">
                          <Input
                            type="time"
                            value={entry[field]}
                            onChange={(e) => updateField(entry.id, field, e.target.value)}
                            className="h-8 text-xs tabular-nums text-center w-[90px] mx-auto"
                          />
                        </td>
                      )
                    )}
                    <td className="px-3 py-2 text-center">
                      <span className={`tabular-nums font-semibold text-xs ${total > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {formatMinutes(total)}
                      </span>
                      <span className="text-2xs text-muted-foreground ml-1">
                        ({has6 ? "6 bat." : "4 bat."})
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="p-1 rounded-md hover:bg-muted transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TimeRegistrationTab;
