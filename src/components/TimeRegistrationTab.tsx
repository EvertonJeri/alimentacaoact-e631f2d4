import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Filter, Download, Plane, Zap, ArrowRight, ArrowLeft, ArrowUpAZ, ArrowDownAZ } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";
import { TimeRegistrationImportDialog } from "./TimeRegistrationImportDialog";
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

// Cache local para persistir flags sem banco de dados
const GET_OVERRIDES = () => {
    const saved = localStorage.getItem('time-reg-overrides');
    return saved ? JSON.parse(saved) : {};
};

const SAVE_OVERRIDES = (overrides: Record<string, any>) => {
    localStorage.setItem('time-reg-overrides', JSON.stringify(overrides));
};

const TimeInputCell = ({
  initialValue,
  onCommit,
  className
}: {
  initialValue: string;
  onCommit: (val: string) => void;
  className?: string;
}) => {
  const [val, setVal] = useState(initialValue || "");
  const lastExternalRef = useRef(initialValue || "");

  // Sync only when initialValue genuinely changes from outside (e.g., autofill)
  useEffect(() => {
    if (initialValue !== lastExternalRef.current) {
      lastExternalRef.current = initialValue || "";
      setVal(initialValue || "");
    }
  }, [initialValue]);

  return (
    <Input
      type="time"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val !== (initialValue || "")) {
          lastExternalRef.current = val;
          onCommit(val);
        }
      }}
      className={className}
    />
  );
};

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
  initialJobFilter?: string;
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
  setAutoFillTravel,
  initialJobFilter = "all"
}: TimeRegistrationTabProps) => {

  const [selectedPerson, setSelectedPerson] = useState("");
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  
  // Lista local de IDs deletados para visualização instantânea antes da resposta do DB
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Local state for persistence without DB
  const [localOverrides, setLocalOverrides] = useState<Record<string, any>>(GET_OVERRIDES());

  // Estado para lidar com a tela de confirmação inline (Bypass no Chrome popup blocker)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    SAVE_OVERRIDES(localOverrides);
  }, [localOverrides]);

  // Filters
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterPerson, setFilterPerson] = useState("all");
  const [filterJob, setFilterJob] = useState(initialJobFilter);
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    if (initialJobFilter) setFilterJob(initialJobFilter);
  }, [initialJobFilter]);

  const addEntry = () => {
    if (!selectedPerson || !selectedJob) return;

    // VERIFICAÇÃO DE DUPLICIDADE (CONFLITO COM OUTRO JOB OU JÁ EXISTENTE NO MESMO JOB)
    const conflict = entries.find(e => 
      e.personId === selectedPerson && 
      e.date === selectedDate
    );
    
    if (conflict) {
      if (conflict.jobId === selectedJob) {
        alert("Atenção: Esta pessoa já possui um registro de horas neste Projeto para a data selecionada.");
      } else {
        const conflictJob = jobs.find(j => j.id === conflict.jobId)?.name || 'Outro Projeto';
        alert(`Alerta: Esta pessoa já possui registro de horas no Projeto [${conflictJob}] nesta data! Ação cancelada.`);
      }
      return;
    }

    const entry = emptyEntry(selectedPerson, selectedJob, selectedDate);
    
    // Auto-preenchimento de IDA se for o dia de início
    const travel = getTravelInfo(entry);
    if (travel?.type === 'outbound') {
        const loc = travel.location || 'Dentro SP';
        entry.isTravelOut = true;
        entry.isAutoFilled = true;
        entry.entry1 = "08:00";
        entry.exit1 = loc === "Fora SP" ? "12:00" : "10:00";
        entry.entry2 = loc === "Fora SP" ? "13:00" : "";
        entry.exit2 = loc === "Fora SP" ? "18:00" : "";

        // Também salva no cache local para visibilidade persistente
        setLocalOverrides(prev => ({
            ...prev,
            [entry.id]: {
                isTravelOut: true,
                isTravelReturn: false,
                isAutoFilled: true
            }
        }));
    }

    onUpdateEntry?.(entry);
    setEntries((prev) => [...prev, entry]);
  };

  const updateField = (id: string, field: keyof TimeEntry, value: any) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    
    // Se o usuário mexer em qualquer horário, removemos o sinalizador de auto-preenchimento (cor vermelha)
    const timeFields = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3"];
    let isAutoFilled = timeFields.includes(field as string) ? false : (entry.isAutoFilled || localOverrides[id]?.isAutoFilled);

    const updated = { ...entry, [field]: value, isAutoFilled };
    onUpdateEntry?.(updated);
    if (setEntries) {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? updated : e))
      );
    }

    if (timeFields.includes(field as string)) {
        setLocalOverrides(prev => ({
            ...prev,
            [id]: { ...prev[id], isAutoFilled: false }
        }));
    }
  };

  const removeEntry = (id: string) => {
    // Oculta instantaneamente na interface sem depender de banco ou setEntries global
    setDeletedIds(prev => new Set(prev).add(id));
    
    onRemoveEntry?.(id);
    if (setEntries) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
    setLocalOverrides(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
    });
    setConfirmingDeleteId(null); // Reseta a confirmação
  };


  const getTravelInfo = (entry: TimeEntry) => {
    // Busca a solicitação correspondente
    const req = requests.find(r => 
        r.personId === entry.personId && 
        r.jobId === entry.jobId && 
        (r.startDate === entry.date || r.endDate === entry.date)
    );
    if (!req) return null;
    
    // REGRA FORA SP: Primeiro dia é SEMPRE IDA
    if (req.location === "Fora SP" && entry.date === req.startDate) {
        return { type: 'outbound', label: `Ida`, location: "Fora SP", travelTime: req.travelTime };
    }

    // REGRA DENTRO SP: Só considera IDA se houver travelTime preenchido (viagem de transporte)
    if (req.location === "Dentro SP" && entry.date === req.startDate && req.travelTime) {
        return { type: 'outbound', label: `Ida`, location: "Dentro SP", travelTime: req.travelTime };
    }

    return null;
  };

  const getPersonName = (id: string) =>
    people.find((p) => p.id === id)?.name || "—";

  const autofillRow = (entry: TimeEntry, forceType?: 'outbound' | 'return') => {
    const travel = getTravelInfo(entry);
    const loc = travel?.location || 'Dentro SP';

    let entry1 = entry.entry1;
    let exit1 = entry.exit1;
    let entry2 = entry.entry2;
    let exit2 = entry.exit2;
    
    // Tabela de overrides locais (é a nossa fonte de verdade atual/contorno)
    const current = localOverrides[entry.id] || {};
    
    let isTravelOut = current.isTravelOut;
    let isTravelReturn = current.isTravelReturn;
    let isAutoFilled = true;

    if (forceType === 'outbound') {
        if (isTravelOut) { // Toggle off
            isTravelOut = false;
            isAutoFilled = false;
        } else {
            isTravelOut = true;
            isTravelReturn = false;
            if (!entry1) entry1 = "08:00";
            if (!exit1) exit1 = loc === "Fora SP" ? "12:00" : "10:00";
            if (!entry2) entry2 = loc === "Fora SP" ? "13:00" : "";
            if (!exit2) exit2 = loc === "Fora SP" ? "18:00" : "";
        }
    } else if (forceType === 'return') {
        if (isTravelReturn) { // Toggle off
            isTravelReturn = false;
            isAutoFilled = false;
        } else {
            isTravelOut = false;
            isTravelReturn = true;
            if (!entry1) entry1 = "08:00";
            if (!exit1) exit1 = loc === "Fora SP" ? "12:00" : "10:00";
            if (!entry2) entry2 = loc === "Fora SP" ? "13:00" : "";
            if (!exit2) exit2 = loc === "Fora SP" ? "18:00" : "";
            
            toast.info("Atenção à Alimentação!", {
                description: "Viagens de volta podem dar direito a almoço dependendo do horário de saída. Verifique o Controle Alimentar.",
                duration: 6000
            });
        }
    } else {
        // Zap (automático padrão 08-18h)
        if (!entry1) entry1 = "08:00";
        if (!exit1) exit1 = "12:00";
        if (!entry2) entry2 = "13:00";
        if (!exit2) exit2 = "18:00";
    }

    const updated: TimeEntry = {
      ...entry,
      entry1,
      exit1,
      entry2,
      exit2,
      isTravelOut,
      isTravelReturn,
      isAutoFilled
    };
    
    onUpdateEntry?.(updated);
    if (setEntries) {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    }

    // Salva no cache local para persistir sem banco
    setLocalOverrides(prev => ({
        ...prev,
        [entry.id]: {
            isTravelOut,
            isTravelReturn,
            isAutoFilled
        }
    }));
  };

  const getJobName = (entryOrId: string | TimeEntry) => {
    const id = typeof entryOrId === 'string' ? entryOrId : entryOrId.jobId;
    if (!id) return "—";
    const cleanId = id.trim();

    const job = jobs.find((j) => j.id === id || j.id === cleanId);
    if (job) return job.name;

    // Busca agressiva pelo número do job no meio do nome (ex: "2401 - MONTAGEM")
    const matchByNum = jobs.find(j => j.name.startsWith(cleanId + " ") || j.name.startsWith(cleanId + "-") || j.name.includes(` ${cleanId} `));
    if (matchByNum) return matchByNum.name;

    // Recuperação Mágica (Sugerida pelo usuário): Se o job_id do ponto sumiu, mas ele fez uma Solicitação de Refeição no período
    if (typeof entryOrId !== 'string') {
        const req = requests.find(r => r.personId === entryOrId.personId && (entryOrId.date >= r.startDate && entryOrId.date <= r.endDate));
        if (req) {
            const reqJob = jobs.find(j => j.id === req.jobId);
            if (reqJob) return reqJob.name;
        }
    }

    if (!id.includes("-") || id.length < 25) return id; 
    return `ID #${id.substring(0, 8)}`;
  };

  const toggleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => {
        if (deletedIds.has(e.id)) return false;
        if (filterPerson !== "all" && e.personId !== filterPerson) return false;
        if (filterJob !== "all" && e.jobId !== filterJob) return false;
        if (filterDate && e.date !== filterDate) return false;
        return true;
      })
      .sort((a, b) => {
        // Primeiro por data respeitando o sentido (asc/desc)
        const dateComp = sortOrder === 'asc' 
            ? a.date.localeCompare(b.date) 
            : b.date.localeCompare(a.date);
        
        if (dateComp !== 0) return dateComp;

        // Segundo por nome (sempre asc para estabilidade)
        const nameA = getPersonName(a.personId);
        const nameB = getPersonName(b.personId);
        return nameA.localeCompare(nameB);
      });
  }, [entries, filterPerson, filterJob, filterDate, sortOrder, deletedIds]);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    
    // Cabeçalho exatamente como na imagem
    const headers = [
        "Nº JOB", 
        "DESCRIÇÃO JOB \"MONTAGEM\"", 
        "Nome", 
        "", // Coluna D vazia
        "Dia", 
        "Dia da semana", 
        "Entrada 1", 
        "Saida 1", 
        "Entrada 2", 
        "Saida 2", 
        "Entrada", 
        "Saída 3", 
        "TOTAL"
    ];

    const rows: (string | number)[][] = [headers];

    const sortedForExport = [...filteredEntries].sort((a, b) => a.date.localeCompare(b.date));

    sortedForExport.forEach((entry) => {
      const dateObj = new Date(entry.date + "T12:00:00"); 
      const weekday = weekdays[dateObj.getDay()];
      const formattedDate = entry.date?.includes("-") ? entry.date.split("-").reverse().join("/") : entry.date || "—";
      
      const jobFullName = getJobName(entry);
      
      // Lógica de separação: "2391A - MONTAGEM SMURF"
      // Nº JOB: "2391A" (até o primeiro espaço)
      // DESCRIÇÃO: "MONTAGEM SMURF" (após o primeiro " - ")
      let numJob = entry.jobId; // Fallback
      let descJob = jobFullName; // Fallback
      
      if (jobFullName.includes(" - ")) {
          const parts = jobFullName.split(" - ");
          numJob = parts[0].trim();
          descJob = parts.slice(1).join(" - ").trim();
      } else if (jobFullName.includes(" ")) {
          const firstSpace = jobFullName.indexOf(" ");
          numJob = jobFullName.substring(0, firstSpace).trim();
          descJob = jobFullName.substring(firstSpace).trim();
      }

      // Formata o total como HH:MM:00
      const totalFormatted = formatMinutes(calcTotalMinutes(entry)) + ":00";

      rows.push([
        numJob, 
        descJob, 
        getPersonName(entry.personId), 
        "", 
        formattedDate, 
        weekday, 
        entry.entry1 || "",
        entry.exit1 || "",
        entry.entry2 || "",
        entry.exit2 || "",
        entry.entry3 || "",
        entry.exit3 || "",
        totalFormatted, 
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Ajuste de largura das colunas
    ws["!cols"] = [
        { wch: 10 }, // A: Nº Job
        { wch: 35 }, // B: Descrição
        { wch: 30 }, // C: Nome
        { wch: 2 },  // D: Vazia
        { wch: 12 }, // E: Dia
        { wch: 12 }, // F: Dia da semana
        { wch: 10 }, // G: E1
        { wch: 10 }, // H: S1
        { wch: 10 }, // I: E2
        { wch: 10 }, // J: S2
        { wch: 10 }, // K: E3
        { wch: 10 }, // L: S3
        { wch: 10 }  // M: Total
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Registro de Horas");
    XLSX.writeFile(wb, `Registro_Horas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
  };


  return (
    <div className="space-y-4">
      {/* Add row controls */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-end">
        <div className="flex-1 min-w-0 sm:min-w-[180px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Pessoa
          </label>
          <SearchableSelect
            options={people.map(p => ({ 
              value: p.id, 
              label: p.isRegistered ? `(CLT) ${p.name}` : p.name,
              description: (
                <div className="flex flex-col">
                    <span className="text-[10px] opacity-70">{p.department || "Geral"} • {p.isRegistered ? "CLT" : "Avulso"}</span>
                </div>
              ) as any
            }))}
            value={selectedPerson}
            onValueChange={setSelectedPerson}
            placeholder="Selecione..."
            searchPlaceholder="Buscar pessoa..."
          />
        </div>
        <div className="flex-1 min-w-0 sm:min-w-[200px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Job
          </label>
          <SearchableSelect
            options={Array.from(new Map(jobs.map(j => [j.name.trim().toLowerCase(), j])).values()).map((j) => {
              const parts = (j.name || "").split(" - ");
              const desc = parts.slice(1).join(" - ");
              return { 
                value: j.id, 
                label: j.name || "—",
                description: desc ? `Projeto: ${desc}` : undefined
              };
            })}
            value={selectedJob}
            onValueChange={setSelectedJob}
            placeholder="Selecione o JOB..."
            searchPlaceholder="Buscar JOB..."
          />
        </div>
        <div className="min-w-0 sm:min-w-[160px]">
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
        <Button onClick={addEntry} disabled={!selectedPerson || !selectedJob} className="gap-1.5 bg-foreground text-background hover:bg-foreground/90 w-full sm:w-auto">
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-end p-3 rounded-lg border border-border bg-muted/30">
        <Filter className="h-4 w-4 text-muted-foreground hidden sm:block mt-1" />
        <div className="min-w-0 sm:min-w-[160px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Filtrar Pessoa
          </label>
          <SearchableSelect
            options={[
              { value: "all", label: "Todas" }, 
              ...people.map(p => ({ 
                value: p.id, 
                label: p.isRegistered ? `(CLT) ${p.name}` : p.name,
                description: `${p.department || "Geral"} • ${p.isRegistered ? "CLT" : "Avulso"}`
              }))
            ]}
            value={filterPerson}
            onValueChange={setFilterPerson}
            className="h-8 text-xs"
          />
        </div>
        <div className="min-w-0 sm:min-w-[200px]">
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Filtrar Job
          </label>
          <SearchableSelect
            options={[
              { value: "all", label: "Todos" }, 
              ...Array.from(new Map(jobs.map(j => [j.name.trim().toLowerCase(), j])).values()).map((j) => {
                const parts = (j.name || "").split(" - ");
                return { 
                  value: j.id, 
                  label: j.name || "—",
                  description: parts[1] ? `Projeto: ${parts[1]}` : undefined
                };
              })
            ]}
            value={filterJob}
            onValueChange={setFilterJob}
            className="h-8 text-xs"
          />
        </div>
        <div className="min-w-0 sm:min-w-[160px]">
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
        <div className="flex gap-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleSort}
                className="h-8 text-xs border-dashed"
                title={sortOrder === 'asc' ? "Menor para maior" : "Maior para menor"}
            >
                {sortOrder === 'asc' ? <ArrowUpAZ className="h-4 w-4 mr-1" /> : <ArrowDownAZ className="h-4 w-4 mr-1" />}
                Data {sortOrder === 'asc' ? "↑" : "↓"}
            </Button>
        </div>
        <div className="flex-1"></div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <TimeRegistrationImportDialog />
          <Button onClick={exportToExcel} variant="outline" className="h-8 text-xs gap-1.5 shadow-sm w-full sm:w-auto">
            <Download className="h-3.5 w-3.5" />
            Exportar .xlsx
          </Button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="rounded-xl border border-border overflow-x-auto shadow-card hidden md:block">
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
                <td colSpan={12} className="text-center py-10 text-sm text-muted-foreground">
                  Nenhum registro. Adicione uma pessoa, job e data acima.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => {
                const total = calcTotalMinutes(entry);
                const has6 = !!(entry.entry3 || entry.exit3);
                const local = localOverrides[entry.id];
                const sysTravel = getTravelInfo(entry);
                const isOut = local?.isTravelOut !== undefined ? local.isTravelOut : (entry.isTravelOut || sysTravel?.type === 'outbound');
                const isRet = local?.isTravelReturn !== undefined ? local.isTravelReturn : (entry.isTravelReturn || sysTravel?.type === 'return');
                const isAutoFilled = local?.isAutoFilled !== undefined ? local.isAutoFilled : entry.isAutoFilled;
                const trClass = isOut 
                  ? "bg-orange-100/40 hover:bg-orange-100/60 border-l-8 border-l-orange-500" 
                  : isRet 
                  ? "bg-blue-100/40 hover:bg-blue-100/60 border-l-8 border-l-blue-500" 
                  : "hover:bg-muted/30";

                return (
                  <tr key={entry.id} className={`transition-colors ${trClass}`}>
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1">
                          {people.find(p => p.id === entry.personId)?.isRegistered && <span className="text-muted-foreground mr-1 opacity-70">(CLT)</span>}
                          <span className="truncate max-w-[180px]">{getPersonName(entry.personId)}</span>
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase leading-none mt-1 opacity-70">
                          {people.find(p => p.id === entry.personId)?.department || "Geral"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap overflow-hidden">
                      {(() => {
                        const jNameStr = getJobName(entry);
                        const parts = jNameStr.split(" - ");
                        const num = parts[0];
                        const desc = parts.slice(1).join(" - ");
                        return (
                          <div className="flex flex-col min-w-0 max-w-[150px]">
                            <span className="font-black text-[10px] text-primary tabular-nums tracking-tighter leading-none">{num}</span>
                            {desc && <span className="text-[9px] uppercase font-bold text-muted-foreground truncate leading-tight mt-0.5" title={desc}>{desc}</span>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{entry.date?.includes("-") ? entry.date.split("-").reverse().join("/") : entry.date || "—"}</span>
                          {isOut && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest bg-orange-200 text-orange-800 border border-orange-400 shadow-sm animate-pulse-subtle">
                              ✈️ IDA
                            </span>
                          )}
                          {isRet && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest bg-blue-200 text-blue-800 border border-blue-400 shadow-sm animate-pulse-subtle">
                              ✈️ VOLTA
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1">
                          <Button variant="ghost" size="sm" onClick={() => autofillRow(entry, 'outbound')}
                            className={`h-5 px-1.5 text-[8px] font-black border gap-1 shadow-sm transition-all ${isOut ? 'bg-orange-600 text-white border-orange-700 hover:bg-orange-700' : 'bg-muted/30 text-muted-foreground border-border hover:bg-orange-50'}`}>
                            <ArrowRight className="h-2 w-2" /> IDA
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => autofillRow(entry, 'return')}
                            className={`h-5 px-1.5 text-[8px] font-black border gap-1 shadow-sm transition-all ${isRet ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700' : 'bg-muted/30 text-muted-foreground border-border hover:bg-blue-50'}`}>
                            <ArrowLeft className="h-2 w-2" /> VOLTA
                          </Button>
                        </div>
                      </div>
                    </td>
                    {(["entry1", "exit1", "entry2", "exit2", "entry3", "exit3"] as const).map((field) => (
                      <td key={field} className="px-1 py-1.5">
                        <TimeInputCell
                          initialValue={entry[field]}
                          onCommit={(val) => updateField(entry.id, field, val)}
                          className={`h-8 text-xs tabular-nums text-center w-[90px] mx-auto transition-colors ${isAutoFilled ? "text-red-600 font-extrabold border-red-200 bg-red-400/10" : ""}`}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center text-xs">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`tabular-nums font-semibold ${total > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {formatMinutes(total)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">({has6 ? "6" : "4"} batidas)</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Button onClick={() => autofillRow(entry)} size="sm" variant="ghost"
                        className={`h-7 px-3 text-[10px] font-black border gap-1.5 transition-all active:scale-95 ${isOut ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 shadow-sm' : isRet ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-sm' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted opacity-60 hover:opacity-100'}`}>
                        {isOut ? <ArrowRight className="h-3 w-3" /> : isRet ? <ArrowLeft className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                        {isOut ? 'IDA' : isRet ? 'VOLTA' : '08-18h'}
                      </Button>
                    </td>
                    <td className="px-2 py-2">
                      {confirmingDeleteId === entry.id ? (
                        <div className="flex flex-col gap-1 items-center animate-in fade-in zoom-in duration-200">
                          <span className="text-[9px] font-bold text-destructive leading-none">Apagar?</span>
                          <div className="flex gap-1">
                            <Button variant="destructive" size="sm" onClick={() => removeEntry(entry.id)} className="h-5 px-2 text-[9px] font-bold">Sim</Button>
                            <Button variant="outline" size="sm" onClick={() => setConfirmingDeleteId(null)} className="h-5 px-2 text-[9px] font-bold">Não</Button>
                          </div>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => setConfirmingDeleteId(entry.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors" title="Apagar este registro">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground border border-border rounded-xl bg-muted/10">
            Nenhum registro. Adicione uma pessoa, job e data acima.
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const total = calcTotalMinutes(entry);
            const has6 = !!(entry.entry3 || entry.exit3);
            const local = localOverrides[entry.id];
            const sysTravel = getTravelInfo(entry);
            const isOut = local?.isTravelOut !== undefined ? local.isTravelOut : (entry.isTravelOut || sysTravel?.type === 'outbound');
            const isRet = local?.isTravelReturn !== undefined ? local.isTravelReturn : (entry.isTravelReturn || sysTravel?.type === 'return');
            const isAutoFilled = local?.isAutoFilled !== undefined ? local.isAutoFilled : entry.isAutoFilled;

            const cardBorder = isOut 
              ? "border-l-4 border-l-orange-500 bg-orange-50/50" 
              : isRet 
              ? "border-l-4 border-l-blue-500 bg-blue-50/50" 
              : "border-border";

            const jNameStr = getJobName(entry);
            const jobParts = jNameStr.split(" - ");
            const jobNum = jobParts[0];
            const jobDesc = jobParts.slice(1).join(" - ");

            return (
              <div key={entry.id} className={`rounded-xl border shadow-card p-4 space-y-3 ${cardBorder}`}>
                {/* Header: Pessoa + Job + Data */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {people.find(p => p.id === entry.personId)?.isRegistered && <span className="text-muted-foreground text-xs opacity-70">(CLT)</span>}
                      <span className="font-semibold text-sm text-foreground">{getPersonName(entry.personId)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-black text-xs text-primary tabular-nums">{jobNum}</span>
                      {jobDesc && <span className="text-[10px] uppercase font-bold text-muted-foreground truncate">{jobDesc}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-bold text-sm tabular-nums text-muted-foreground">
                      {entry.date?.includes("-") ? entry.date.split("-").reverse().join("/") : entry.date || "—"}
                    </span>
                    {isOut && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase bg-orange-200 text-orange-800 border border-orange-400">✈️ IDA</span>}
                    {isRet && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase bg-blue-200 text-blue-800 border border-blue-400">✈️ VOLTA</span>}
                  </div>
                </div>

                {/* Time inputs grid */}
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["entry1", "Ent. 1"], ["exit1", "Saída 1"],
                    ["entry2", "Ent. 2"], ["exit2", "Saída 2"],
                    ["entry3", "Ent. 3"], ["exit3", "Saída 3"]
                  ] as [keyof TimeEntry, string][]).map(([field, label]) => (
                    <div key={field} className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-0.5">{label}</span>
                      <TimeInputCell
                        initialValue={entry[field] as string}
                        onCommit={(val) => updateField(entry.id, field, val)}
                        className={`h-9 text-sm tabular-nums text-center transition-colors ${isAutoFilled ? "text-red-600 font-extrabold border-red-200 bg-red-400/10" : ""}`}
                      />
                    </div>
                  ))}
                </div>

                {/* Footer: Total + Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-muted-foreground">Total</span>
                      <span className={`tabular-nums font-bold text-base ${total > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {formatMinutes(total)}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">({has6 ? "6" : "4"} batidas)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => autofillRow(entry, 'outbound')}
                      className={`h-7 px-2 text-[9px] font-black border gap-1 ${isOut ? 'bg-orange-600 text-white border-orange-700' : 'bg-muted/30 text-muted-foreground border-border'}`}>
                      <ArrowRight className="h-2.5 w-2.5" /> IDA
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => autofillRow(entry, 'return')}
                      className={`h-7 px-2 text-[9px] font-black border gap-1 ${isRet ? 'bg-blue-600 text-white border-blue-700' : 'bg-muted/30 text-muted-foreground border-border'}`}>
                      <ArrowLeft className="h-2.5 w-2.5" /> VOLTA
                    </Button>
                    <Button onClick={() => autofillRow(entry)} size="sm" variant="ghost"
                      className="h-7 px-2 text-[9px] font-black border bg-muted/50 text-muted-foreground border-border">
                      <Zap className="h-2.5 w-2.5" /> 08-18
                    </Button>
                    {confirmingDeleteId === entry.id ? (
                      <div className="flex gap-1 ml-1">
                        <Button variant="destructive" size="sm" onClick={() => removeEntry(entry.id)} className="h-7 px-2 text-[9px] font-bold">Sim</Button>
                        <Button variant="outline" size="sm" onClick={() => setConfirmingDeleteId(null)} className="h-7 px-2 text-[9px] font-bold">Não</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => setConfirmingDeleteId(entry.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TimeRegistrationTab;
