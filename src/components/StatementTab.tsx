import { useState, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CheckCircle2, FileDown, Filter, Info, User, ChevronDown, ChevronUp, Eye, EyeOff, Calendar } from "lucide-react";
import {
  type Person,
  type Job,
  type MealRequest,
  type TimeEntry,
  type FoodControlEntry,
  getDatesInRange,
  getMealValue,
  MEAL_LABELS,
  calculateDayDiscount,
  type DiscountConfirmation,
  type PaymentConfirmation,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface StatementTabProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries: TimeEntry[];
  foodControl: FoodControlEntry[];
  confirmations: (DiscountConfirmation | PaymentConfirmation)[];
  onUpdatePaymentConfirmation?: (conf: PaymentConfirmation) => void;
}

interface StatementDetail {
  date: string;
  type: 'desconto' | 'extra';
  reason: string;
  value: number;
  jobId: string;
  projectName?: string;
}

interface PersonStatement {
  personId: string;
  jobId: string;
  startDate: string;
  endDate: string;
  totalRequested: number;
  totalUsed: number;
  balance: number;
  details: StatementDetail[];
}

const StatementTab = ({ people = [], jobs = [], requests = [], timeEntries = [], foodControl = [], confirmations = [], onUpdatePaymentConfirmation }: StatementTabProps) => {
  const [selectedJob, setSelectedJob] = useState("all");
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set());
  const statementRef = useRef<HTMLDivElement>(null);

  const getPersonName = (id: string) => people.find(p => p.id === id)?.name || "—";
  const getJobName = (id: string) => jobs.find(j => j.id === id)?.name || "—";

  const isRequestPaid = (requestId: string) => {
    return (confirmations || []).some(c => 'id' in c && c.id === requestId && c.confirmed);
  };

  // Cálculo de extratos agrupado por Pessoa e Job
  const personStatements = useMemo(() => {
    const data: Record<string, PersonStatement> = {};
    const processedDays = new Set<string>();

    (requests || []).forEach(req => {
      const isCurrentJob = selectedJob === "all" || req.jobId === selectedJob;
      const isPaid = isRequestPaid(req.id);
      
      const person = people.find(p => p.id === req.personId);
      if (!person) return;

      const key = `${req.personId}-${req.jobId}`;
      if (!data[key]) {
        data[key] = {
          personId: req.personId,
          jobId: req.jobId,
          startDate: req.startDate || "2000-01-01",
          endDate: req.endDate || "2000-01-01",
          totalRequested: 0,
          totalUsed: 0,
          balance: 0,
          details: []
        };
      } else {
          if (req.startDate && req.startDate < data[key].startDate) data[key].startDate = req.startDate;
          if (req.endDate && req.endDate > data[key].endDate) data[key].endDate = req.endDate;
      }

      const dates = getDatesInRange(req.startDate, req.endDate);
      const projectName = jobs.find(j => j.id === req.jobId)?.name || 'Outro Projeto';

      dates.forEach(date => {
        const dayKey = `${req.personId}-${req.jobId}-${date}`;
        if (processedDays.has(dayKey)) return;
        processedDays.add(dayKey);

        const entries = timeEntries.filter(e => e.personId === req.personId && e.jobId === req.jobId && e.date === date);
        const entry = entries.find(e => e.isTravelOut || e.isTravelReturn) || entries[0];
        const fc = foodControl.find(f => f.personId === req.personId && f.jobId === req.jobId && f.date === date);
        const reqMeals = (req.dailyOverrides?.[date] ?? req.meals) || [];

        if (!isPaid) {
          if (isCurrentJob) {
            reqMeals.forEach(m => {
              data[key].totalRequested += getMealValue(m, date, person);
            });
          }

          if (isCurrentJob || selectedJob === "all") {
             const dayCalc = calculateDayDiscount(req, date, entry || undefined, fc, people);
             if (dayCalc.total > 0) {
                data[key].balance -= dayCalc.total;
                data[key].details.push({
                   date, type: 'desconto', reason: dayCalc.reason, value: -dayCalc.total, jobId: req.jobId, projectName
                });
             }

             if (fc) {
               const usedMeals: { type: 'cafe'|'almoco'|'janta', used: boolean }[] = [
                 { type: 'cafe', used: fc.usedCafe }, { type: 'almoco', used: fc.usedAlmoco }, { type: 'janta', used: fc.usedJanta }
               ];
               usedMeals.forEach(um => {
                 if (um.used && !reqMeals.includes(um.type as any)) {
                   const val = getMealValue(um.type as any, date, person);
                   if (val > 0) {
                     data[key].balance += val;
                     data[key].details.push({ date, type: 'extra', reason: `${MEAL_LABELS[um.type]} extra`, value: val, jobId: req.jobId, projectName });
                   }
                 }
               });
             }
          }
        }
      });
    });

    return Object.values(data)
      .map(ps => { ps.totalUsed = ps.totalRequested + ps.balance; return ps; })
      .filter(ps => {
          const matchesJob = selectedJob === "all" || ps.jobId === selectedJob;
          // Mostra apenas se houver solicitação ativa (evita poluição com saldos negativos de jobs antigos)
          const hasActiveRequest = ps.totalRequested > 0;
          return matchesJob && hasActiveRequest;
      })
      .sort((a, b) => getPersonName(a.personId).localeCompare(getPersonName(b.personId)));
  }, [requests, foodControl, people, timeEntries, confirmations, selectedJob, jobs]);

  const togglePerson = (id: string) => {
    setExpandedPeople(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSettlePerson = (personId: string, jobId: string) => {
    const pending = requests.filter(r => r.personId === personId && r.jobId === jobId && !isRequestPaid(r.id));
    if (onUpdatePaymentConfirmation && pending.length > 0) {
      pending.forEach(req => onUpdatePaymentConfirmation({ id: req.id, type: 'request', confirmed: true, paymentDate: new Date().toISOString().split("T")[0] }));
      toast.success("Conta liquidada para este job!");
    }
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap gap-4 items-end p-4 rounded-xl border border-border bg-muted/30 print:hidden">
        <div className="flex-1 min-w-[240px]">
          <label className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-2 px-1 flex items-center gap-2">
            <Filter className="h-3 w-3" /> Filtrar por Job
          </label>
          <SearchableSelect
            options={[{ value: "all", label: "Todos os Jobs" }, ...jobs.map(j => ({ value: j.id, label: j.name }))]}
            value={selectedJob} onValueChange={setSelectedJob} className="h-10 text-sm"
          />
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setExpandedPeople(new Set(personStatements.map(ps => `${ps.personId}-${ps.jobId}`)))} variant="outline" size="sm" className="h-10">Abrir Todos</Button>
            <Button onClick={() => setExpandedPeople(new Set())} variant="outline" size="sm" className="h-10">Recolher Todos</Button>
            <Button onClick={() => window.print()} className="h-10">Exportar PDF</Button>
        </div>
      </div>

      <div ref={statementRef} className="space-y-6">
        {personStatements.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/10">
            <p className="text-muted-foreground text-sm font-medium">Nenhum dado pendente encontrado.</p>
          </div>
        ) : (
          personStatements.map((ps) => {
            const key = `${ps.personId}-${ps.jobId}`;
            const isExpanded = expandedPeople.has(key);
            return (
              <Card key={key} className="overflow-hidden border-border shadow-md print:shadow-none break-inside-avoid">
                <CardHeader className="bg-muted/30 border-b border-border py-4 cursor-pointer" onClick={() => togglePerson(key)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20"><User className="h-5 w-5" /></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg font-bold">{getPersonName(ps.personId)}</CardTitle>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSettlePerson(ps.personId, ps.jobId); }} className="h-7 text-[10px] font-black uppercase text-muted-foreground hover:text-green-600 gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Liquidar Job</Button>
                        </div>
                        <div className="flex flex-col gap-1 mt-1 text-[10px] text-muted-foreground font-bold uppercase">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">{getJobName(ps.jobId)}</Badge>
                            <span className="ml-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> {ps.startDate.split("-").reverse().join("/")} — {ps.endDate.split("-").reverse().join("/") || "—"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block">Ajuste Pendente</span>
                          <span className={`text-lg font-black tabular-nums ${ps.balance >= 0 ? 'text-green-600' : 'text-destructive'}`}>R$ {ps.balance.toFixed(2)}</span>
                        </div>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="p-0">
                    <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center">
                      <div className="p-4">
                        <span className="text-2xs uppercase text-muted-foreground block mb-1">Solicitado</span>
                        <span className="text-base font-black">R$ {ps.totalRequested.toFixed(2)}</span>
                      </div>
                      <div className="p-4">
                        <span className="text-2xs uppercase text-muted-foreground block mb-1">Total Ajustes</span>
                        <span className={`text-base font-black ${ps.balance < 0 ? 'text-destructive' : 'text-green-600'}`}>R$ {ps.balance.toFixed(2)}</span>
                      </div>
                      <div className="p-4 bg-primary/5">
                        <span className="text-2xs uppercase text-primary font-bold block mb-1">Valor Final</span>
                        <span className="text-xl font-black text-primary font-mono">R$ {ps.totalUsed.toFixed(2)}</span>
                      </div>
                    </div>
                    {ps.details.length > 0 && (
                      <div className="p-4 space-y-2">
                        {ps.details.map((d, index) => (
                          <div key={index} className="flex justify-between items-center text-xs py-2 px-3 bg-muted/10 rounded-lg border border-border">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] tabular-nums bg-background px-1.5 py-0.5 rounded border border-border">{d.date.split("-").reverse().join("/")}</span>
                              <span className="font-semibold">{d.reason}</span>
                            </div>
                            <span className={`font-bold ${d.value < 0 ? 'text-destructive' : 'text-green-600'}`}>R$ {d.value.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default StatementTab;
