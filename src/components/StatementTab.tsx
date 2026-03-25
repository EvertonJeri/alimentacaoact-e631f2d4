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
  calculatePersonBalance,
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
  type: 'desconto' | 'extra' | 'anterior' | 'pago';
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
  isPaid: boolean;
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

  const getRequestConfirmation = (id: string) => {
    return (confirmations || []).find(c => 'id' in c && c.id === id) as PaymentConfirmation | undefined;
  };

  const personStatements = useMemo(() => {
    const data: Record<string, PersonStatement> = {};
    const processedDays = new Set<string>();

    (requests || []).forEach(req => {
      const isPaid = getRequestConfirmation(req.id)?.confirmed || (confirmations || []).some(c => ('id' in c) && c.id === `job-${req.jobId}` && c.confirmed);
      const person = people.find(p => p.id === req.personId);
      if (!person) return;

      const key = `${req.personId}-${req.jobId}`;
      if (!data[key]) {
        data[key] = {
          personId: req.personId,
          jobId: req.jobId,
          startDate: req.startDate || "2000-01-01",
          endDate: req.endDate || "2000-01-01",
          isPaid: isPaid,
          totalRequested: 0,
          totalUsed: 0,
          balance: 0,
          details: []
        };
      }

      const dates = getDatesInRange(req.startDate, req.endDate);
      const projectName = jobs.find(j => j.id === req.jobId)?.name || 'Outro Projeto';

      dates.forEach(date => {
        const dayKey = `${req.personId}-${req.jobId}-${date}`;
        if (processedDays.has(dayKey)) return;
        processedDays.add(dayKey);

        const entry = timeEntries.find(e => e.personId === req.personId && e.jobId === req.jobId && e.date === date);
        const fc = foodControl.find(f => f.personId === req.personId && f.jobId === req.jobId && f.date === date);
        const reqMeals = (req.dailyOverrides?.[date] ?? req.meals) || [];

        // Valor Bruto sempre soma
        const dayValue = reqMeals.reduce((acc, m) => acc + getMealValue(m, date, person), 0);
        data[key].totalRequested += dayValue;

        // Calculamos descontos e extras para o Job (Sempre, para manter o histórico no extrato)
        const dayCalc = calculateDayDiscount(req, date, entry || undefined, fc, people);
        if (dayCalc.total > 0) {
            data[key].balance -= dayCalc.total;
            data[key].details.push({ date, type: 'desconto', reason: dayCalc.reason, value: -dayCalc.total, jobId: req.jobId, projectName });
        }

        if (fc) {
           (['cafe', 'almoco', 'janta'] as const).forEach(m => {
             const used = m === 'cafe' ? fc.usedCafe : m === 'almoco' ? fc.usedAlmoco : fc.usedJanta;
             if (used && !reqMeals.includes(m as any)) {
               const v = getMealValue(m as any, date, person);
               if (v > 0) {
                 data[key].balance += v;
                 data[key].details.push({ date, type: 'extra', reason: `${MEAL_LABELS[m]} extra`, value: v, jobId: req.jobId, projectName });
               }
             }
           });
        }
      });
    });

    // Pós-processamento para Saldo Retroativo e Congelamento de Pagos
    return Object.values(data).map(ps => {
      if (ps.isPaid) {
        // Se pago, mantemos os detalhes calculados acima, mas sinalizamos o fechamento
        ps.totalUsed = ps.totalRequested + ps.balance;
        ps.details.push({ date: ps.endDate, type: 'pago', reason: '✅ Job Quitado / Pago', value: 0, jobId: ps.jobId });
      } else {
        // Se NÃO PAGO, injetamos o Saldo Acumulado
        const totalWallet = calculatePersonBalance(ps.personId, requests, foodControl, confirmations, people, timeEntries);
        const thisJobNet = ps.totalRequested + ps.balance;
        const retro = totalWallet - thisJobNet;

        if (Math.abs(retro) > 0.1) {
          ps.balance += retro;
          ps.details.push({ date: ps.startDate, type: 'anterior', reason: 'Saldo Acumulado (Outros Jobs)', value: retro, jobId: ps.jobId });
        }
        ps.totalUsed = ps.totalRequested + ps.balance;
      }
      return ps;
    })
    .filter(ps => selectedJob === "all" || ps.jobId === selectedJob)
    .sort((a, b) => b.isPaid ? -1 : 1); // Pendentes primeiro
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
    const pending = requests.filter(r => r.personId === personId && r.jobId === jobId && !getRequestConfirmation(r.id)?.confirmed);
    if (onUpdatePaymentConfirmation && pending.length > 0) {
      pending.forEach(req => onUpdatePaymentConfirmation({ id: req.id, type: 'request', confirmed: true, paymentDate: new Date().toISOString().split("T")[0] }));
      toast.success("Liquidado!");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end p-4 rounded-xl border border-border bg-muted/30">
        <div className="flex-1 min-w-[240px]">
          <SearchableSelect
            options={[{ value: "all", label: "Todos os Jobs" }, ...jobs.map(j => ({ value: j.id, label: j.name }))]}
            value={selectedJob} onValueChange={setSelectedJob}
          />
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setExpandedPeople(new Set(personStatements.map(ps => `${ps.personId}-${ps.jobId}`)))} variant="outline">Abrir Todos</Button>
            <Button onClick={() => setExpandedPeople(new Set())} variant="outline">Recolher</Button>
            <Button onClick={() => window.print()}>PDF</Button>
        </div>
      </div>

      <div className="space-y-4">
        {personStatements.map((ps) => {
          const key = `${ps.personId}-${ps.jobId}`;
          const isExpanded = expandedPeople.has(key);
          return (
            <Card key={key} className={`overflow-hidden ${ps.isPaid ? 'opacity-80 border-green-500/20' : 'border-border shadow-md'}`}>
               <CardHeader className="py-3 px-4 flex-row items-center justify-between cursor-pointer space-y-0" onClick={() => togglePerson(key)}>
                  <div className="flex items-center gap-3">
                    <User className={`h-5 w-5 ${ps.isPaid ? 'text-green-600' : 'text-primary'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-tight">{getPersonName(ps.personId)}</span>
                        {ps.isPaid ? (
                           <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 py-0 text-[10px]">PAGO</Badge>
                        ) : (
                           <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSettlePerson(ps.personId, ps.jobId); }} className="h-6 text-[9px] font-black uppercase hover:text-green-600">Liquidar</Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[9px] h-4">{getJobName(ps.jobId)}</Badge>
                        <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
                          {ps.startDate.split("-").reverse().join("/")} — {ps.endDate.split("-").reverse().join("/")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                       <p className="text-[10px] uppercase font-black text-muted-foreground/60 leading-none">Total</p>
                       <p className={`text-lg font-black tabular-nums leading-none mt-1 ${ps.isPaid ? 'text-green-600' : 'text-foreground'}`}>
                         R$ {ps.totalUsed.toFixed(2)}
                       </p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
               </CardHeader>
               {isExpanded && (
                  <CardContent className="p-0 border-t border-border bg-muted/5">
                    <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-background">
                       <div className="p-3 text-center">
                          <p className="text-[10px] uppercase text-muted-foreground font-bold">Solicitado</p>
                          <p className="text-sm font-black">R$ {ps.totalRequested.toFixed(2)}</p>
                       </div>
                       <div className="p-3 text-center">
                          <p className="text-[10px] uppercase text-muted-foreground font-bold">Ajustes</p>
                          <p className={`text-sm font-black ${ps.balance < 0 ? 'text-destructive' : 'text-green-600'}`}>
                            {ps.isPaid ? '—' : `R$ ${ps.balance.toFixed(2)}`}
                          </p>
                       </div>
                       <div className="p-3 text-center bg-primary/5">
                          <p className="text-[10px] uppercase text-primary font-bold">Valor {ps.isPaid ? 'Pago' : 'Final'}</p>
                          <p className="text-base font-black text-primary">R$ {ps.totalUsed.toFixed(2)}</p>
                       </div>
                    </div>
                    <div className="p-3 space-y-1">
                       {ps.details.map((d, i) => (
                         <div key={i} className="flex items-center justify-between text-[11px] py-1.5 border-b border-border/50 last:border-0 px-1">
                            <span className="text-muted-foreground tabular-nums w-16">{d.date.split("-").reverse().join("/").slice(0,5)}</span>
                            <span className="flex-1 font-medium">{d.reason}</span>
                            <span className={`font-black ${d.value < 0 ? 'text-destructive' : 'text-green-600'}`}>
                              {d.value > 0 ? '+' : ''}R$ {d.value.toFixed(2)}
                            </span>
                         </div>
                       ))}
                    </div>
                  </CardContent>
               )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StatementTab;
