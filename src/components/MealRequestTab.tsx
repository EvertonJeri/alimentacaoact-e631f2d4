import { useState, Fragment } from "react";
import { format } from "date-fns";
import { CalendarIcon, Download, Plus, X, ClipboardList, Mail, ChevronDown, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  type Person,
  type Job,
  type MealType,
  type MealRequest,
  type TimeEntry,
  type LocationType,
  MEAL_LABELS,
  MEAL_VALUES,
  LOCATIONS,
  getDatesInRange,
  formatMinutes,
  calcTotalMinutes,
  getMealValue,
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
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState("");
  const [currentPerson, setCurrentPerson] = useState("");
  const [currentMeals, setCurrentMeals] = useState<MealType[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedLocation, setSelectedLocation] = useState<LocationType | "">("");
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());

  const toggleRequest = (id: string) => {
    setExpandedRequests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setDailyOverride = (reqId: string, date: string, meal: MealType, checked: boolean) => {
    setRequests(prev => prev.map(req => {
      if (req.id !== reqId) return req;
      
      const currentOverrides = req.dailyOverrides || {};
      const dayMeals = currentOverrides[date] !== undefined ? currentOverrides[date] : req.meals;
      
      const newDayMeals = checked 
        ? [...dayMeals, meal]
        : dayMeals.filter(m => m !== meal);
        
      return {
        ...req,
        dailyOverrides: {
          ...currentOverrides,
          [date]: newDayMeals
        }
      };
    }));
  };

  const toggleMeal = (meal: MealType) => {
    setCurrentMeals((prev) =>
      prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]
    );
  };

  const addRequest = () => {
    if (!currentPerson || !selectedJob || currentMeals.length === 0 || !startDate || !endDate || !selectedLocation) return;
    setRequests((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        personId: currentPerson,
        jobId: selectedJob,
        meals: [...currentMeals],
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        location: selectedLocation as LocationType,
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
    if (newEntries.length > 0) {
      onGenerateEntries(newEntries);
      toast({
        title: "Operação Concluída",
        description: "Os registros de horas foram gerados com sucesso.",
        duration: 5000,
      });
    } else {
      toast({
        title: "Tudo atualizado",
        description: "Todos os dias solicitados já estão no registro de horas.",
        duration: 5000,
      });
    }
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
      let total = 0;
      const person = people.find((p) => p.id === req.personId);
      const personName = person?.name || "—";
      const dates = getDatesInRange(req.startDate, req.endDate);
      const days = dates.length;
      
      dates.forEach(date => {
        const dayMeals = req.dailyOverrides && req.dailyOverrides[date] !== undefined ? req.dailyOverrides[date] : req.meals;
        dayMeals.forEach(m => {
          total += getMealValue(m, date, person);
        });
      });

      grandTotal += total;
      const baseMeals = req.meals.map((m) => MEAL_LABELS[m]).join(", ");
      const statesLabel = req.location || "";
      mealRows.push([personName, statesLabel, baseMeals, req.startDate.split("-").reverse().join("/"), req.endDate.split("-").reverse().join("/"), days, (total/days).toFixed(2), total.toFixed(2)]);
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
            Localização da Montagem
          </label>
          <Select value={selectedLocation} onValueChange={(v) => setSelectedLocation(v as LocationType)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a localização..." />
            </SelectTrigger>
            <SelectContent>
              {LOCATIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
          disabled={!currentPerson || !selectedJob || currentMeals.length === 0 || !startDate || !endDate || !selectedLocation}
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
                const person = people.find((p) => p.id === req.personId);
                const dates = getDatesInRange(req.startDate, req.endDate);
                const days = dates.length;
                let total = 0;
                dates.forEach(date => {
                  const dayMeals = req.dailyOverrides && req.dailyOverrides[date] !== undefined ? req.dailyOverrides[date] : req.meals;
                  dayMeals.forEach(m => {
                    total += getMealValue(m, date, person);
                  });
                });
                
                const stateLabel = req.location || "—";
                const isExpanded = expandedRequests.has(req.id);

                return (
                  <Fragment key={req.id}>
                    <tr 
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => toggleRequest(req.id)}
                    >
                      <td className="px-3 py-2 font-medium text-foreground flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {getPersonName(req.personId)}
                      </td>
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
                      <td className="px-2 py-2 text-right">
                        <button onClick={(e) => { e.stopPropagation(); removeRequest(req.id); }} className="p-1 rounded-md hover:bg-muted transition-colors">
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/10">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="text-sm text-foreground mb-3 font-semibold">Editar dias individualmente:</div>
                          <div className="rounded-md border border-border overflow-hidden bg-background">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-2xs">Data</th>
                                  {(["cafe", "almoco", "janta"] as MealType[]).map((meal) => (
                                    <th key={meal} className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-2xs">{MEAL_LABELS[meal]}</th>
                                  ))}
                                  <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-2xs">Total do Dia</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {dates.map((date) => {
                                  const dayMeals = req.dailyOverrides && req.dailyOverrides[date] !== undefined ? req.dailyOverrides[date] : req.meals;
                                  const isWeekend = new Date(date + "T00:00:00").getDay() === 0 || new Date(date + "T00:00:00").getDay() === 6;
                                  const dayTotal = dayMeals.reduce((acc, m) => acc + getMealValue(m, date, person), 0);
                                  return (
                                    <tr key={date} className="hover:bg-muted/30 transition-colors">
                                      <td className="px-3 py-2.5 font-medium tabular-nums text-muted-foreground">{date.split("-").reverse().join("/")}</td>
                                      {(["cafe", "almoco", "janta"] as MealType[]).map((meal) => {
                                        const isBlockedAlmoco = meal === "almoco" && person?.isRegistered && !isWeekend;
                                        const mealValue = getMealValue(meal, date, person);
                                        return (
                                          <td key={meal} className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                              <Checkbox
                                                id={`req-${req.id}-${date}-${meal}`}
                                                checked={isBlockedAlmoco ? false : dayMeals.includes(meal)}
                                                disabled={isBlockedAlmoco}
                                                onCheckedChange={(checked) => setDailyOverride(req.id, date, meal, checked as boolean)}
                                                className="h-3.5 w-3.5 rounded-[3px]"
                                              />
                                              <Label 
                                                htmlFor={`req-${req.id}-${date}-${meal}`} 
                                                className={`text-xs cursor-pointer ${isBlockedAlmoco ? "text-muted-foreground/50" : "text-foreground"}`}
                                              >
                                                {isBlockedAlmoco ? "Não Custa" : `R$ ${mealValue.toFixed(2)}`}
                                              </Label>
                                            </div>
                                          </td>
                                        );
                                      })}
                                      <td className="px-3 py-2.5 text-right font-semibold text-primary tabular-nums">R$ {dayTotal.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
