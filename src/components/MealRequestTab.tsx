import { useState, useMemo } from "react";
import { Plus, Trash2, AlertCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  type Person,
  type Job,
  type TimeEntry,
  type MealRequest,
  type MealType,
  type LocationType,
  MEAL_LABELS,
  LOCATIONS,
  getDatesInRange,
  getMealValue,
  calculatePersonBalance,
  type FoodControlEntry,
  type DiscountConfirmation,
  type PaymentConfirmation,
} from "@/lib/types";
import { toast } from "@/hooks/use-toast";

interface MealRequestTabProps {
  people: Person[];
  jobs: Job[];
  timeEntries: TimeEntry[];
  requests: MealRequest[];
  foodControl: FoodControlEntry[];
  confirmations: (DiscountConfirmation | PaymentConfirmation)[];
  setRequests: (requests: MealRequest[]) => void;
  onUpdateRequest: (req: MealRequest) => void;
  onRemoveRequest: (id: string) => void;
  onGenerateEntries: (entries: TimeEntry[]) => void;
}

const MealRequestTab = ({
  people,
  jobs,
  timeEntries,
  requests,
  foodControl,
  confirmations,
  setRequests,
  onUpdateRequest,
  onRemoveRequest,
  onGenerateEntries,
}: MealRequestTabProps) => {
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationType>("Dentro SP");
  const [currentPerson, setCurrentPerson] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMeals, setSelectedMeals] = useState<MealType[]>(["cafe", "almoco", "janta"]);

  const personBalance = useMemo(() => {
    if (!currentPerson) return 0;
    return calculatePersonBalance(currentPerson, requests, foodControl, confirmations, people);
  }, [currentPerson, requests, foodControl, confirmations, people]);

  const addPersonToJob = () => {
    if (!selectedJob || !currentPerson || !startDate || !endDate) return;

    const newRequest: MealRequest = {
      id: Math.random().toString(36).substr(2, 9),
      personId: currentPerson,
      jobId: selectedJob,
      startDate,
      endDate,
      meals: selectedMeals,
      dailyOverrides: {},
      location: selectedLocation,
    };

    onUpdateRequest(newRequest);
    setCurrentPerson("");
  };

  const getPersonName = (id: string) => people.find((p) => p.id === id)?.name || "—";
  const getJobName = (id: string) => jobs.find((j) => j.id === id)?.name || "—";

  const jobRequests = selectedJob ? requests.filter((r) => r.jobId === selectedJob) : requests;

  const handleGenerateEntries = () => {
    if (jobRequests.length === 0) return;
    
    const entriesToGenerate: TimeEntry[] = [];
    let count = 0;

    jobRequests.forEach((req) => {
      if (!req.startDate || !req.endDate) return;
      const dates = getDatesInRange(req.startDate, req.endDate);
      
      dates.forEach((date) => {
        // Verifica se já existe uma entrada para esta pessoa, neste job e nesta data
        const alreadyExists = timeEntries.some(
          (entry) => entry.personId === req.personId && entry.jobId === req.jobId && entry.date === date
        );

        if (!alreadyExists) {
          entriesToGenerate.push({
            id: Math.random().toString(36).substr(2, 9),
            personId: req.personId,
            jobId: req.jobId,
            date,
            entry1: "",
            exit1: "",
            entry2: "",
            exit2: "",
            entry3: "",
            exit3: "",
          });
          count++;
        }
      });
    });

    if (entriesToGenerate.length > 0) {
      onGenerateEntries(entriesToGenerate);
      toast({
        title: "Sucesso",
        description: `${count} registros de horas gerados e enviados para acompanhamento.`,
      });
    } else {
      toast({
        title: "Atenção",
        description: "Todos os registros solicitados já existem na aba de horas.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
            Job / Projeto
          </label>
          <SearchableSelect
            options={jobs.map(j => ({ value: j.id, label: j.name }))}
            value={selectedJob}
            onValueChange={setSelectedJob}
            placeholder="Selecione o JOB..."
            searchPlaceholder="Buscar JOB..."
          />
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

      <div className="rounded-xl border border-border p-4 shadow-card space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Adicionar Pessoa à Solicitação</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
              Pessoa
            </label>
            <SearchableSelect
              options={people.map(p => ({ 
                value: p.id, 
                label: `${p.name} ${p.isRegistered ? "(Registrado)" : ""}` 
              }))}
              value={currentPerson}
              onValueChange={setCurrentPerson}
              placeholder="Selecione..."
              searchPlaceholder="Buscar pessoa..."
            />

            {currentPerson && personBalance !== 0 && (
              <div className={`mt-3 flex items-center gap-3 p-3 rounded-xl border ${personBalance < 0 ? 'bg-destructive/10 border-destructive/20 text-destructive font-bold' : 'bg-green-500/10 border-green-200 text-green-600 font-bold'} animate-in fade-in slide-in-from-top-2 duration-300`}>
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wide">Atenção ao Saldo Global</p>
                  <p className="text-xs opacity-90 mt-0.5">
                    Este funcionário possui um saldo de <strong>R$ {personBalance.toFixed(2)}</strong> acumulado.
                  </p>
                </div>
                <Badge variant={personBalance < 0 ? "destructive" : "secondary"}>
                  {personBalance < 0 ? "Débito" : "Crédito"}
                </Badge>
              </div>
            )}
          </div>

          <div>
            <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-2">
              Refeições Incluídas
            </label>
            <div className="flex flex-wrap gap-4 p-2.5 rounded-lg border border-border bg-muted/20">
              {(["cafe", "almoco", "janta"] as MealType[]).map((m) => (
                <div key={m} className="flex items-center space-x-2">
                  <Checkbox
                    id={`meal-${m}`}
                    checked={selectedMeals.includes(m)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedMeals([...selectedMeals, m]);
                      else setSelectedMeals(selectedMeals.filter((x) => x !== m));
                    }}
                  />
                  <Label htmlFor={`meal-${m}`} className="text-xs">{MEAL_LABELS[m]}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
              Data de Início
            </label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground block mb-1.5">
              Data de Término
            </label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button onClick={addPersonToJob} className="w-full gap-2">
            <Plus className="h-4 w-4" /> Adicionar à Lista
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border shadow-card overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-border bg-muted/10 gap-4">
          <h3 className="text-sm font-semibold text-foreground">
            {selectedJob ? "Solicitações do Job" : "Todas as Solicitações"}
          </h3>
          <Button 
            onClick={handleGenerateEntries} 
            disabled={jobRequests.length === 0} 
            className="gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto"
          >
            <Send className="h-4 w-4" /> Enviar para registro
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Pessoa</th>
              <th className="text-left px-4 py-3 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Período</th>
              <th className="text-left px-4 py-3 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Refeições</th>
              <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Valor Total</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobRequests.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                  Nenhuma pessoa adicionada a este Job.
                </td>
              </tr>
            ) : (
              jobRequests.map((req) => {
                // Segurança extra: se não houver datas, ignoramos o cálculo para evitar crash
                if (!req.startDate || !req.endDate) return null;

                const datesInRange = getDatesInRange(req.startDate, req.endDate);
                const total = datesInRange.reduce((sum, date) => {
                  const person = people.find(p => p.id === req.personId);
                  const dayMeals = req.dailyOverrides?.[date] ?? req.meals;
                  return sum + (dayMeals?.reduce((dSum, m) => dSum + getMealValue(m, date, person), 0) || 0);
                }, 0);

                return (
                  <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{getPersonName(req.personId)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                      {(req.startDate || "").split("-").reverse().join("/")} até {(req.endDate || "").split("-").reverse().join("/")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {req.meals?.map((m) => (
                          <Badge key={m} variant="outline" className="text-[10px] capitalize font-medium">{MEAL_LABELS[m]}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">
                      R$ {total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => onRemoveRequest(req.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
    </div>
  );
};

export default MealRequestTab;
