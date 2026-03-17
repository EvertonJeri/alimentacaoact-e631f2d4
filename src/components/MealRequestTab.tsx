import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Download, Plus, X, ClipboardList, Mail } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type Person,
  type Job,
  type MealType,
  type MealRequest,
  type TimeEntry,
  type BrazilState,
  type SPRegion,
  MEAL_LABELS,
  MEAL_VALUES,
  BRAZIL_STATES,
  getDatesInRange,
  formatMinutes,
  calcTotalMinutes,
} from "@/lib/types";

interface MealRequestTabProps {
  people: Person[];
  jobs: Job[];
  timeEntries: TimeEntry[];
  requests: MealRequest[];
  setRequests: React.Dispatch<React.SetStateAction<MealRequest[]>>;
  onGenerateEntries: (entries: TimeEntry[]) => void;
}

const MealRequestTab = ({ people, jobs, timeEntries, requests, setRequests, onGenerateEntries }: MealRequestTabProps) => {
  const [selectedJob, setSelectedJob] = useState("");
  const [currentPerson, setCurrentPerson] = useState("");
  const [currentMeals, setCurrentMeals] = useState<MealType[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedState, setSelectedState] = useState<BrazilState | "">("");
  const [spRegion, setSpRegion] = useState<SPRegion | "">("");

  const toggleMeal = (meal: MealType) => {
    setCurrentMeals((prev) =>
      prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]
    );
  };

  const addRequest = () => {
    if (!currentPerson || !selectedJob || currentMeals.length === 0 || !startDate || !endDate || !selectedState) return;
    if (selectedState === "SP" && !spRegion) return;
    setRequests((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        personId: currentPerson,
        jobId: selectedJob,
        meals: [...currentMeals],
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        state: selectedState as BrazilState,
        spRegion: selectedState === "SP" ? (spRegion as SPRegion) : undefined,
      },
    ]);
    setCurrentPerson("");
    setCurrentMeals([]);
  };

  const removeRequest = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const getPersonName = (id: string) => people.find((p) => p.id === id)?.name || "—";
  const getJobName = (id?: string) => jobs.find((j) => j.id === (id || selectedJob))?.name || "Relatório";

  const generateTimeEntries = () => {
    if (!selectedJob || jobRequests.length === 0) return;
    const newEntries: TimeEntry[] = [];
    jobRequests.forEach((req) => {
      const dates = getDatesInRange(req.startDate, req.endDate);
      dates.forEach((date) => {
        const exists = timeEntries.some((e) => e.personId === req.personId && e.date === date && e.jobId === selectedJob);
        if (!exists) {
          newEntries.push({
            id: crypto.randomUUID(),
            personId: req.personId,
            jobId: selectedJob,
            date,
            entry1: "", exit1: "",
            entry2: "", exit2: "",
            entry3: "", exit3: "",
          });
        }
      });
    });
    if (newEntries.length > 0) onGenerateEntries(newEntries);
  };

  const buildXlsxWorkbook = () => {
    const jobRequests2 = requests.filter((r) => r.jobId === selectedJob);
    const wb = XLSX.utils.book_new();
    const jobName = getJobName();

    const mealRows: (string | number)[][] = [
      ["SOLICITAÇÃO DE REFEIÇÕES"],
      ["JOB:", jobName],
      [],
      ["Pessoa", "Estado", "Refeições", "Data Início", "Data Fim", "Dias", "Valor Unitário (R$)", "Valor Total (R$)"],
    ];

    let grandTotal = 0;
    jobRequests2.forEach((req) => {
      const person = getPersonName(req.personId);
      const meals = req.meals.map((m) => MEAL_LABELS[m]).join(", ");
      const days = getDatesInRange(req.startDate, req.endDate).length;
      const dailyValue = req.meals.reduce((s, m) => s + MEAL_VALUES[m], 0);
      const total = dailyValue * days;
      grandTotal += total;
      const stateLabel = req.state === "SP" && req.spRegion ? `SP - ${req.spRegion === "capital" ? "Capital" : "Interior"}` : (req.state || "");
      mealRows.push([person, stateLabel, meals, req.startDate.split("-").reverse().join("/"), req.endDate.split("-").reverse().join("/"), days, dailyValue, total]);
    });

    mealRows.push([]);
    mealRows.push(["", "", "", "", "", "", "TOTAL GERAL", grandTotal]);

    const ws1 = XLSX.utils.aoa_to_sheet(mealRows);
    ws1["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Solicitação Refeições");
    return { wb, jobName, grandTotal };
  };

  const exportXlsx = () => {
    if (!selectedJob || jobRequests.length === 0) return;
    const { wb, jobName } = buildXlsxWorkbook();
    const safeName = jobName.replace(/[^a-zA-Z0-9\-_ ]/g, "").trim();
    XLSX.writeFile(wb, `Solicitacao_${safeName}.xlsx`);
  };

  const sendEmail = () => {
    if (!selectedJob || jobRequests.length === 0) return;
    const jobName = getJobName();
    const subject = encodeURIComponent(`Solicitação de Refeições - ${jobName}`);
    const body = encodeURIComponent(
      `Segue em anexo a solicitação de refeições referente ao ${jobName}.\n\nPor favor, exportar o relatório .xlsx e anexar ao e-mail manualmente.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
  };

  const jobRequests = selectedJob ? requests.filter((r) => r.jobId === selectedJob) : requests;

  return (
    <div className="space-y-6">
      {/* Job + State selection */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Job / Projeto
          </label>
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o JOB..." />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Estado da Montagem
          </label>
          <Select value={selectedState} onValueChange={(v) => { setSelectedState(v as BrazilState); if (v !== "SP") setSpRegion(""); }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o estado..." />
            </SelectTrigger>
            <SelectContent>
              {BRAZIL_STATES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.value} - {s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedState === "SP" && (
          <div>
            <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
              Região SP
            </label>
            <Select value={spRegion} onValueChange={(v) => setSpRegion(v as SPRegion)}>
              <SelectTrigger>
                <SelectValue placeholder="Capital ou Interior?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="capital">Capital</SelectItem>
                <SelectItem value="interior">Interior</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Add person form */}
      <div className="rounded-xl border border-border p-4 shadow-card space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Adicionar Pessoa à Solicitação</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
              Pessoa
            </label>
            <Select value={currentPerson} onValueChange={setCurrentPerson}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.isRegistered ? "(Registrado)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-2">
              Refeições
            </label>
            <div className="flex gap-4">
              {(["cafe", "almoco", "janta"] as MealType[]).map((meal) => (
                <div key={meal} className="flex items-center gap-2">
                  <Checkbox
                    id={meal}
                    checked={currentMeals.includes(meal)}
                    onCheckedChange={() => toggleMeal(meal)}
                  />
                  <Label htmlFor={meal} className="text-sm cursor-pointer">
                    {MEAL_LABELS[meal]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
              Data Início
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {startDate ? format(startDate, "dd/MM/yyyy") : "Selecionar..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
              Data Fim
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {endDate ? format(endDate, "dd/MM/yyyy") : "Selecionar..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Button
          onClick={addRequest}
          disabled={!currentPerson || !selectedJob || currentMeals.length === 0 || !startDate || !endDate || !selectedState || (selectedState === "SP" && !spRegion)}
          className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar à Lista
        </Button>
      </div>

      {/* Requests list */}
      {jobRequests.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Pessoa</th>
                <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Job</th>
                <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Refeições</th>
                <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Período</th>
                <th className="text-right px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Dias</th>
                <th className="text-right px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Valor (R$)</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobRequests.map((req) => {
                const days = getDatesInRange(req.startDate, req.endDate).length;
                const dailyValue = req.meals.reduce((s, m) => s + MEAL_VALUES[m], 0);
                const total = dailyValue * days;
                const stateLabel = req.state === "SP" && req.spRegion
                  ? `SP ${req.spRegion === "capital" ? "Capital" : "Interior"}`
                  : (req.state || "—");
                return (
                  <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-foreground">{getPersonName(req.personId)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{getJobName(req.jobId)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{stateLabel}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {req.meals.map((m) => (
                          <Badge key={m} variant="secondary" className="text-2xs">{MEAL_LABELS[m]}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground text-xs">
                      {req.startDate.split("-").reverse().join("/")} — {req.endDate.split("-").reverse().join("/")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{days}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">
                      {total.toFixed(2)}
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => removeRequest(req.id)} className="p-1 rounded-md hover:bg-muted transition-colors">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Action buttons - separated */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={generateTimeEntries}
          disabled={!selectedJob || jobRequests.length === 0}
          className="gap-2 bg-foreground text-background hover:bg-foreground/90"
        >
          <ClipboardList className="h-4 w-4" />
          Registrar no Registro de Horas
        </Button>
        <Button
          onClick={exportXlsx}
          disabled={!selectedJob || jobRequests.length === 0}
          variant="outline"
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Exportar Relatório .xlsx
        </Button>
        <Button
          onClick={sendEmail}
          disabled={!selectedJob || jobRequests.length === 0}
          variant="outline"
          className="gap-2"
        >
          <Mail className="h-4 w-4" />
          Enviar por E-mail
        </Button>
      </div>
    </div>
  );
};

export default MealRequestTab;
