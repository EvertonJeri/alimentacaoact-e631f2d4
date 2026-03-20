import { useState, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FileDown, Filter, Info, User } from "lucide-react";
import {
  type Person,
  type Job,
  type MealRequest,
  type TimeEntry,
  type FoodControlEntry,
  getDatesInRange,
  getMealValue,
  MEAL_LABELS,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatementTabProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries: TimeEntry[];
  foodControl: FoodControlEntry[];
}

const StatementTab = ({ people, jobs, requests, timeEntries, foodControl }: StatementTabProps) => {
  const [selectedJob, setSelectedJob] = useState("all");
  const statementRef = useRef<HTMLDivElement>(null);

  // Mostra todas as solicitações, independente de timeEntry já registrada
  const registeredRequests = requests.filter((req) => {
    const dates = getDatesInRange(req.startDate, req.endDate);
    return dates.some((date) => timeEntries.some((e) => e.personId === req.personId && e.date === date));
  });

  const filteredRequests = useMemo(() => {
    return selectedJob === "all" ? registeredRequests : registeredRequests.filter(r => r.jobId === selectedJob);
  }, [registeredRequests, selectedJob]);

  const personStatements = useMemo(() => {
    const data: Record<string, any> = {};

    filteredRequests.forEach(req => {
      if (!data[req.personId]) {
        data[req.personId] = {
          personId: req.personId,
          totalRequested: 0,
          totalUsed: 0,
          balance: 0,
          details: [],
          jobIds: new Set()
        };
      }
      
      data[req.personId].jobIds.add(req.jobId);
      const person = people.find(p => p.id === req.personId);
      const dates = getDatesInRange(req.startDate, req.endDate);

      dates.forEach(date => {
        // Removed haveEntry check so we track requested meals regardless of entry logic
        // This makes sure statements always show what was actually ordered
        // Future modifications can be done directly by the admin in Food Control if meals weren't used

        const reqMeals = req.dailyOverrides?.[date] ?? req.meals;
        if (!Array.isArray(reqMeals)) return;
        const fc = foodControl.find(f => f.personId === req.personId && f.jobId === req.jobId && f.date === date);
        
        reqMeals.forEach(m => {
          const val = getMealValue(m, date, person);
          data[req.personId].totalRequested += val;
          
          const used = fc ? (m === 'cafe' ? fc.usedCafe : m === 'almoco' ? fc.usedAlmoco : fc.usedJanta) : true;
          
          if (used) {
            data[req.personId].totalUsed += val;
          } else {
            data[req.personId].balance -= val;
            data[req.personId].details.push({
              date,
              type: 'desconto',
              reason: `${MEAL_LABELS[m]} solicitado mas não utilizado`,
              value: -val,
              jobId: req.jobId
            });
          }
        });

        // Used but not requested (extras)
        if (fc) {
          const usedMeals: { type: 'cafe' | 'almoco' | 'janta'; used: boolean }[] = [
            { type: 'cafe', used: fc.usedCafe },
            { type: 'almoco', used: fc.usedAlmoco },
            { type: 'janta', used: fc.usedJanta }
          ];

          usedMeals.forEach(um => {
            if (um.used && !reqMeals.includes(um.type)) {
              const val = getMealValue(um.type, date, person);
              data[req.personId].totalUsed += val;
              data[req.personId].balance += val;
              data[req.personId].details.push({
                date,
                type: 'extra',
                reason: `${MEAL_LABELS[um.type]} utilizado mas não solicitado`,
                value: val,
                jobId: req.jobId
              });
            }
          });
        }
      });
    });

    return Object.values(data);
  }, [filteredRequests, foodControl, people, timeEntries]);

  const exportAsImage = () => {
    window.print();
  };

  const getPersonName = (id: string) => people.find(p => p.id === id)?.name || "—";
  const getJobName = (id: string) => jobs.find(j => j.id === id)?.name || "—";

  return (
    <div className="space-y-6 print:p-0">
      <div className="flex flex-wrap gap-4 items-end p-4 rounded-xl border border-border bg-muted/30 print:hidden">
        <div className="flex-1 min-w-[240px]">
          <label className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-2 px-1 flex items-center gap-2">
            <Filter className="h-3 w-3" /> Filtrar por Montagem (Job)
          </label>
          <SearchableSelect
            options={[{ value: "all", label: "Todas as Montagens" }, ...jobs.map(j => ({ value: j.id, label: j.name }))]}
            value={selectedJob}
            onValueChange={setSelectedJob}
            className="h-10 bg-background border-border shadow-sm text-sm"
          />
        </div>
        <Button onClick={exportAsImage} className="gap-2 h-10 shadow-sm" variant="default">
          <FileDown className="h-4 w-4" /> Exportar Extrato (PDF/Print)
        </Button>
      </div>

      <div ref={statementRef} className="space-y-8 print:space-y-12">
        {personStatements.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/10">
            <Info className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground text-sm font-medium">Nenhum dado encontrado para gerar extrato.</p>
          </div>
        ) : (
          personStatements.map((ps: any) => (
            <Card key={ps.personId} className="overflow-hidden border-border shadow-md print:shadow-none print:border-none">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-foreground">{getPersonName(ps.personId)}</CardTitle>
                      <div className="flex gap-2 mt-1">
                        {Array.from(ps.jobIds as Set<string>).map(jid => (
                          <Badge key={jid} variant="outline" className="text-[10px] font-medium opacity-70">
                            {getJobName(jid)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-0.5">Saldo Final</span>
                    <span className={`text-xl font-black tabular-nums ${ps.balance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {ps.balance >= 0 ? '+' : ''}{ps.balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-background/50">
                  <div className="p-4 text-center">
                    <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-1">Total Solicitado</span>
                    <span className="font-bold tabular-nums text-foreground">R$ {ps.totalRequested.toFixed(2)}</span>
                  </div>
                  <div className="p-4 text-center">
                    <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-1">Total Consumido</span>
                    <span className="font-bold tabular-nums text-foreground">R$ {ps.totalUsed.toFixed(2)}</span>
                  </div>
                  <div className="p-4 text-center">
                    <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-1">Diferença</span>
                    <span className={`font-bold tabular-nums ${ps.balance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      R$ {ps.balance.toFixed(2)}
                    </span>
                  </div>
                </div>

                {ps.details.length > 0 ? (
                  <div className="p-4">
                    <h4 className="text-xs uppercase tracking-widest font-black text-muted-foreground mb-4 flex items-center gap-2">
                       Justificativa dos Lançamentos
                    </h4>
                    <div className="space-y-2">
                      {ps.details.map((d: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-2xs tabular-nums text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                              {d.date?.includes("-") ? d.date.split("-").reverse().join("/") : d.date || "—"}
                            </span>
                            <span className="font-medium text-foreground">{d.reason}</span>
                            <span className="text-[10px] text-muted-foreground">({getJobName(d.jobId)})</span>
                          </div>
                          <span className={`font-bold tabular-nums ${d.type === 'desconto' ? 'text-destructive' : 'text-green-600'}`}>
                            {d.value >= 0 ? '+' : ''}{d.value.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground italic opacity-60">
                    Nenhuma divergência encontrada. Consumo 100% conforme solicitado.
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default StatementTab;
