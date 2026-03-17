import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Download, Plus, X } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  SAMPLE_JOBS,
  MEAL_LABELS,
  MEAL_VALUES,
  getDatesInRange,
  formatMinutes,
  calcTotalMinutes,
} from "@/lib/types";

interface MealRequestTabProps {
  people: Person[];
  jobs: Job[];
  timeEntries: TimeEntry[];
}

const MealRequestTab = ({ people, jobs, timeEntries }: MealRequestTabProps) => {
  const [selectedJob, setSelectedJob] = useState("");
  const [requests, setRequests] = useState<MealRequest[]>([]);
  const [currentPerson, setCurrentPerson] = useState("");
  const [currentMeals, setCurrentMeals] = useState<MealType[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const toggleMeal = (meal: MealType) => {
    setCurrentMeals((prev) =>
      prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]
    );
  };

  const addRequest = () => {
    if (!currentPerson || currentMeals.length === 0 || !startDate || !endDate) return;
    setRequests((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        personId: currentPerson,
        meals: [...currentMeals],
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      },
    ]);
    setCurrentPerson("");
    setCurrentMeals([]);
  };

  const removeRequest = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const getPersonName = (id: string) => people.find((p) => p.id === id)?.name || "—";
  const getJobName = () => jobs.find((j) => j.id === selectedJob)?.name || "Relatório";

  const exportXlsx = () => {
    if (!selectedJob || requests.length === 0) return;

    const wb = XLSX.utils.book_new();
    const jobName = getJobName();

    // Sheet 1: Meal request summary
    const mealRows: (string | number)[][] = [
      ["SOLICITAÇÃO DE REFEIÇÕES"],
      ["JOB:", jobName],
      [],
      ["Pessoa", "Refeições", "Data Início", "Data Fim", "Dias", "Valor Unitário (R$)", "Valor Total (R$)"],
    ];

    let grandTotal = 0;

    requests.forEach((req) => {
      const person = getPersonName(req.personId);
      const meals = req.meals.map((m) => MEAL_LABELS[m]).join(", ");
      const days = getDatesInRange(req.startDate, req.endDate).length;
      const dailyValue = req.meals.reduce((s, m) => s + MEAL_VALUES[m], 0);
      const total = dailyValue * days;
      grandTotal += total;

      mealRows.push([
        person,
        meals,
        req.startDate.split("-").reverse().join("/"),
        req.endDate.split("-").reverse().join("/"),
        days,
        dailyValue,
        total,
      ]);
    });

    mealRows.push([]);
    mealRows.push(["", "", "", "", "", "TOTAL GERAL", grandTotal]);

    const ws1 = XLSX.utils.aoa_to_sheet(mealRows);

    // Column widths
    ws1["!cols"] = [
      { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
      { wch: 8 }, { wch: 18 }, { wch: 16 },
    ];

    XLSX.utils.book_append_sheet(wb, ws1, "Solicitação Refeições");

    // Sheet 2: Time registration template
    const timeRows: (string | number)[][] = [
      ["REGISTRO DE HORAS"],
      ["JOB:", jobName],
      [],
      [
        "Pessoa", "Data",
        "Entrada 1", "Saída 1",
        "Entrada 2", "Saída 2",
        "Entrada 3", "Saída 3",
        "Total Horas",
      ],
    ];

    // Add existing time entries for these people
    const requestPersonIds = new Set(requests.map((r) => r.personId));
    const relevantEntries = timeEntries.filter((e) => requestPersonIds.has(e.personId));

    relevantEntries.forEach((entry) => {
      const total = calcTotalMinutes(entry);
      timeRows.push([
        getPersonName(entry.personId),
        entry.date.split("-").reverse().join("/"),
        entry.entry1, entry.exit1,
        entry.entry2, entry.exit2,
        entry.entry3, entry.exit3,
        formatMinutes(total),
      ]);
    });

    // Add blank rows for each person x date from requests
    requests.forEach((req) => {
      const dates = getDatesInRange(req.startDate, req.endDate);
      dates.forEach((date) => {
        const alreadyExists = relevantEntries.some(
          (e) => e.personId === req.personId && e.date === date
        );
        if (!alreadyExists) {
          timeRows.push([
            getPersonName(req.personId),
            date.split("-").reverse().join("/"),
            "", "", "", "", "", "", "",
          ]);
        }
      });
    });

    const ws2 = XLSX.utils.aoa_to_sheet(timeRows);
    ws2["!cols"] = [
      { wch: 22 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws2, "Registro de Horas");

    // Download
    const safeName = jobName.replace(/[^a-zA-Z0-9\-_ ]/g, "").trim();
    XLSX.writeFile(wb, `${safeName}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Job selection */}
      <div>
        <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
          Job / Projeto
        </label>
        <Select value={selectedJob} onValueChange={setSelectedJob}>
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Selecione o JOB..." />
          </SelectTrigger>
          <SelectContent>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-2">
              Refeições
            </label>
            <div className="flex gap-4">
              {(["almoco", "janta"] as MealType[]).map((meal) => (
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
          disabled={!currentPerson || currentMeals.length === 0 || !startDate || !endDate}
          className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar à Lista
        </Button>
      </div>

      {/* Requests list */}
      {requests.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Pessoa</th>
                <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Refeições</th>
                <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Período</th>
                <th className="text-right px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Dias</th>
                <th className="text-right px-3 py-2.5 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Valor (R$)</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((req) => {
                const days = getDatesInRange(req.startDate, req.endDate).length;
                const dailyValue = req.meals.reduce((s, m) => s + MEAL_VALUES[m], 0);
                const total = dailyValue * days;
                return (
                  <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-foreground">{getPersonName(req.personId)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
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

      {/* Export */}
      <Button
        onClick={exportXlsx}
        disabled={!selectedJob || requests.length === 0}
        className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Download className="h-4 w-4" />
        Exportar Relatório .xlsx
      </Button>
    </div>
  );
};

export default MealRequestTab;
