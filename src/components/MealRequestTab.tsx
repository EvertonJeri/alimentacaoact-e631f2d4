import { useState, useMemo } from "react";
import { Plus, Trash2, AlertCircle } from "lucide-react";
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
  onUpdateRequest,
  onRemoveRequest,
}: MealRequestTabProps) => {
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationType>("Dentro SP");
  const [currentPerson, setCurrentPerson] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMeals, setSelectedMeals] = useState<MealType[]>(["cafe", "almoco", "janta"]);

  const personBalance = useMemo(() => {
    if (!currentPerson || !Array.isArray(people) || !Array.isArray(requests)) return 0;
    return calculatePersonBalance(currentPerson, requests, foodControl || [], confirmations || [], people);
  }, [currentPerson, requests, foodControl, confirmations, people]);

  const addPersonToJob = () => {
    if (!selectedJob || !currentPerson || !startDate || !endDate) return;

    const newRequest: MealRequest = {
      id: Math.random().toString(36).substring(2, 9),
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

  const getPersonName = (id: string) => (people || []).find((p) => p.id === id)?.name || "—";
  const getJobName = (id: string) => (jobs || []).find((j) => j.id === id)?.name || "—";

  const jobRequests = useMemo(() => {
    if (!Array.isArray(requests)) return [];
    return selectedJob ? requests.filter((r) => r.jobId === selectedJob) : requests;
  }, [requests, selectedJob]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground mb-1.5 block">Job / Projeto</Label>
          <SearchableSelect
            options={(jobs || []).map(j => ({ value: j.id, label: j.name }))}
            value={selectedJob}
            onValueChange={setSelectedJob}
            placeholder="Selecione o Job..."
          />
        </div>
        <div>
          <Label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground mb-1.5 block">Localização</Label>
          <Select value={selectedLocation} onValueChange={(v) => setSelectedLocation(v as LocationType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(LOCATIONS || []).map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 bg-card shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground mb-1.5 block">Pessoa</Label>
            <SearchableSelect
              options={(people || []).map(p => ({ 
                value: p.id, 
                label: p.isRegistered ? `${p.name} (CLT)` : p.name 
              }))}
              value={currentPerson}
              onValueChange={setCurrentPerson}
              placeholder="Selecione a pessoa..."
            />
            {currentPerson && personBalance !== 0 && (
              <div className={`mt-2 p-2 rounded border text-xs flex items-center gap-2 ${personBalance < 0 ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-green-500/10 border-green-200 text-green-600'}`}>
                <AlertCircle className="h-4 w-4" />
                <span>Saldo Global: R$ {personBalance.toFixed(2)} ({personBalance < 0 ? 'Débito' : 'Crédito'})</span>
              </div>
            )}
          </div>
          <div>
            <Label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground mb-1.5 block">Refeições</Label>
            <div className="flex gap-4 p-2 border rounded-md bg-muted/20">
              {([ 'cafe', 'almoco', 'janta' ] as MealType[]).map(m => (
                <div key={m} className="flex items-center gap-2">
                  <Checkbox 
                    id={`m-${m}`} 
                    checked={selectedMeals.includes(m)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedMeals([...selectedMeals, m]);
                      else setSelectedMeals(selectedMeals.filter(x => x !== m));
                    }}
                  />
                  <Label htmlFor={`m-${m}`} className="text-xs cursor-pointer">{MEAL_LABELS[m]}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground">Início</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-2xs uppercase tracking-wider font-medium text-muted-foreground">Término</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <Button onClick={addPersonToJob} className="w-full">
            <Plus className="h-4 w-4 mr-2" /> Adicionar
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-2xs uppercase text-muted-foreground font-medium">Pessoa</th>
              <th className="text-left px-4 py-3 text-2xs uppercase text-muted-foreground font-medium">Período</th>
              <th className="text-left px-4 py-3 text-2xs uppercase text-muted-foreground font-medium">Refeições</th>
              <th className="text-right px-4 py-3 text-2xs uppercase text-muted-foreground font-medium">Valor Total</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobRequests.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground italic">Nenhuma solicitação encontrada.</td>
              </tr>
            ) : (
              jobRequests.map((req) => {
                const dates = getDatesInRange(req.startDate, req.endDate);
                const total = (dates || []).reduce((sum, date) => {
                  const person = (people || []).find(p => p.id === req.personId);
                  const meals = (req.dailyOverrides?.[date] ?? req.meals) as MealType[];
                  return sum + (Array.isArray(meals) ? meals.reduce((acc, m) => acc + getMealValue(m, date, person), 0) : 0);
                }, 0);

                const formatDate = (d: string) => String(d || "").split("-").reverse().join("/");

                return (
                  <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{getPersonName(req.personId)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                      {formatDate(req.startDate)} até {formatDate(req.endDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(req.meals || []).map(m => (
                          <Badge key={m} variant="outline" className="text-[10px] capitalize font-normal">{MEAL_LABELS[m]}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      R$ {total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => onRemoveRequest(req.id)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
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

export default MealRequestTab;
