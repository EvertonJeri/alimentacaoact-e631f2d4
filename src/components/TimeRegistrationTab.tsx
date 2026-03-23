import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Trash2, Filter, Download, Plane, Zap, ArrowRight, ArrowLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";
import {
  type Person,
  type Job,
  type TimeEntry,
  calcTotalMinutes,
  formatMinutes,
  type MealRequest,
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
  isTravelOut: false,
  isTravelReturn: false,
  isAutoFilled: false,
});

interface TimeRegistrationTabProps {
  entries: TimeEntry[];
  setEntries?: React.Dispatch<React.SetStateAction<TimeEntry[]>>;
  people: Person[];
  jobs: Job[];
  onUpdateEntry?: (entry: TimeEntry) => void;
  onRemoveEntry?: (id: string) => void;
  requests?: MealRequest[];
  autoFillTravel?: boolean;
  setAutoFillTravel?: (v: boolean) => void;
}

const TimeRegistrationTab = ({ 
  entries, 
  setEntries, 
  people, 
  jobs, 
  onUpdateEntry, 
  onRemoveEntry, 
  requests,
  autoFillTravel,
  setAutoFillTravel
}: TimeRegistrationTabProps) => {

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

    // VERIFICAÇÃO DE DUPLICIDADE (CONFLITO COM OUTRO JOB)
    const conflict = entries.find(e => 
      e.personId === selectedPerson && 
      e.date === selectedDate && 
      e.jobId !== selectedJob
    );

    if (conflict) {
      const conflictJob = jobs.find(j => j.id === conflict.jobId)?.name || 'Outro Projeto';
      alert(`Alerta: Esta pessoa já possui registro de horas no Projeto [${conflictJob}] nesta data! Ação cancelada.`);
      return;
    }

    const entry = emptyEntry(selectedPerson, selectedJob, selectedDate);
    onUpdateEntry?.(entry);
    setEntries((prev) => [...prev, entry]);
  };

  const updateField = (id: string, field: keyof TimeEntry, value: any) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    
    // Se o usuário mexer em qualquer horário, removemos o sinalizador de auto-preenchimento (cor vermelha)
    const timeFields = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3"];
    const isAutoFilled = timeFields.includes(field as string) ? false : entry.isAutoFilled;

    const updated = { ...entry, [field]: value, isAutoFilled };
    onUpdateEntry?.(updated);
    if (setEntries) {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? updated : e))
      );
    }
  };

  const removeEntry = (id: string) => {
    if (confirm("Deseja realmente apagar este registro de horas?")) {
      onRemoveEntry?.(id);
      setEntries?.((prev) => prev.filter((e) => e.id !== id));
    }
  };


  const getPersonName = (id: string) =>
    people.find((p) => p.id === id)?.name || "—";

  const getJobName = (id: string) =>
    jobs.find((j) => j.id === id)?.name || "—";

  const autofillRow = (entry: TimeEntry, forceType?: 'outbound' | 'return') => {
    let entry1 = "08:00";
    let exit1 = "12:00";
    let entry2 = "13:00";
    let exit2 = "18:00";
    let isTravelOut = entry.isTravelOut;
    let isTravelReturn = entry.isTravelReturn;

    if (forceType === 'outbound') {
      isTravelOut = true;
      isTravelReturn = false;
    } else if (forceType === 'return') {
      isTravelOut = false;
      isTravelReturn = true;
    }

    const updated: TimeEntry = {
      ...entry,
      entry1,
      exit1,
      entry2,
      exit2,
      isTravelOut,
      isTravelReturn,
      isAutoFilled: true
    };
    onUpdateEntry?.(updated);
    if (setEntries) {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    }
  };

  const getTravelInfo = (entry: TimeEntry) => {
    if (!requests) return null;
    const req = requests.find(r => r.personId === entry.personId && r.jobId === entry.jobId && (r.startDate === entry.date || r.endDate === entry.date));
    if (!req || req.location !== "Fora SP") return null;

    if (entry.date === req.startDate && req.travelTime) {
      return { type: 'outbound', label: `Ida` };
    } else if (entry.date === req.endDate && req.startDate !== req.endDate) {
      return { type: 'return', label: `Volta` };
    }
    return null;
  };

  const filteredEntries = entries.filter((e) => {
    if (filterPerson !== "all" && e.personId !== filterPerson) return false;
    if (filterJob !== "all" && e.jobId !== filterJob) return false;
    if (filterDate && e.date !== filterDate) return false;
    return true;
  });

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      ["REGISTRO DE HORAS"],
      [],
      ["Pessoa", "Job", "Data", "Entrada 1", "Saída 1", "Entrada 2", "Saída 2", "Entrada 3", "Saída 3", "Total Horas"],
    ];

    const sortedForExport = [...filteredEntries].sort((a, b) => a.date.localeCompare(b.date));

    sortedForExport.forEach((entry) => {
      rows.push([
        getPersonName(entry.personId),
        getJobName(entry.jobId),
        entry.date?.includes("-") ? entry.date.split("-").reverse().join("/") : entry.date || "—",
        entry.entry1 || "—",
        entry.exit1 || "—",
        entry.entry2 || "—",
        entry.exit2 || "—",
        entry.entry3 || "—",
        entry.exit3 || "—",
        formatMinutes(calcTotalMinutes(entry)),
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Horas");
    XLSX.writeFile(wb, "Registro_de_Horas.xlsx");
  };


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
        <div className="flex-1"></div>
        <Button onClick={exportToExcel} variant="outline" className="h-8 text-xs gap-1.5 shadow-sm">
          <Download className="h-3.5 w-3.5" />
          Exportar .xlsx
        </Button>
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
              <th className="text-center px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Preenchimento</th>
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
                const trClass = entry.isTravelOut 
                  ? "bg-orange-100/40 hover:bg-orange-100/60 border-l-8 border-l-orange-500" 
                  : entry.isTravelReturn 
                  ? "bg-blue-100/40 hover:bg-blue-100/60 border-l-8 border-l-blue-500" 
                  : "hover:bg-muted/30";

                return (
                  <tr key={entry.id} className={`transition-colors ${trClass}`}>
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                      {getPersonName(entry.personId)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap max-w-[180px] truncate">
                      {getJobName(entry.jobId)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{entry.date?.includes("-") ? entry.date.split("-").reverse().join("/") : entry.date || "—"}</span>
                          {entry.isTravelOut && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest bg-orange-200 text-orange-800 border border-orange-400 shadow-sm animate-pulse-subtle">
                              ✈️ IDA
                            </span>
                          )}
                          {entry.isTravelReturn && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest bg-blue-200 text-blue-800 border border-blue-400 shadow-sm animate-pulse-subtle">
                              ✈️ VOLTA
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => autofillRow(entry, 'outbound')}
                            className={`h-5 px-1.5 text-[8px] font-black border gap-1 shadow-sm ${entry.isTravelOut ? 'bg-orange-600 text-white border-orange-700 hover:bg-orange-700' : 'bg-muted/30 text-muted-foreground border-border hover:bg-orange-50'}`}
                          >
                            <ArrowRight className="h-2 w-2" /> IDA
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => autofillRow(entry, 'return')}
                            className={`h-5 px-1.5 text-[8px] font-black border gap-1 shadow-sm ${entry.isTravelReturn ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700' : 'bg-muted/30 text-muted-foreground border-border hover:bg-blue-50'}`}
                          >
                            <ArrowLeft className="h-2 w-2" /> VOLTA
                          </Button>
                        </div>
                      </div>
                    </td>
                    {(["entry1", "exit1", "entry2", "exit2", "entry3", "exit3"] as const).map(
                      (field) => (
                        <td key={field} className="px-1 py-1.5">
                          <Input
                            type="time"
                            value={entry[field]}
                            onChange={(e) => updateField(entry.id, field, e.target.value)}
                            className={`h-8 text-xs tabular-nums text-center w-[90px] mx-auto transition-colors ${entry.isAutoFilled ? "text-red-600 font-extrabold border-red-200 bg-red-50/40" : ""}`}
                          />
                        </td>
                      )
                    )}
                    <td className="px-3 py-2 text-center text-xs">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`tabular-nums font-semibold ${total > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {formatMinutes(total)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({has6 ? "6" : "4"} batidas)
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Button 
                        onClick={() => autofillRow(entry)}
                        size="sm"
                        variant="ghost"
                        className={`h-7 px-3 text-[10px] font-black border gap-1.5 transition-all active:scale-95 ${entry.isTravelOut ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 shadow-sm' : entry.isTravelReturn ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-sm' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted opacity-60 hover:opacity-100'}`}
                        title={entry.isTravelOut ? "Preencher horário de IDA" : entry.isTravelReturn ? "Preencher horário de VOLTA" : "Preencher horário padrão 08-18h"}
                      >
                        {entry.isTravelOut ? <ArrowRight className="h-3 w-3" /> : entry.isTravelReturn ? <ArrowLeft className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                        {entry.isTravelOut ? 'IDA' : entry.isTravelReturn ? 'VOLTA' : '08-18h'}
                      </Button>
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEntry(entry.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                        title="Apagar este registro"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
