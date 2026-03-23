import { useState, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CheckCircle2, FileDown, Filter, Info, Trash2, User, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
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
  onUpdatePaymentConfirmation?: (conf: PaymentConfirmation) => void; // Adicionado
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
  totalRequested: number;
  totalUsed: number;
  balance: number;
  details: StatementDetail[];
  jobIds: Set<string>;
}

const StatementTab = ({ people, jobs, requests, timeEntries, foodControl, confirmations, onUpdatePaymentConfirmation }: StatementTabProps) => {
  const [selectedJob, setSelectedJob] = useState("all");
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set());
  const statementRef = useRef<HTMLDivElement>(null);

  const togglePerson = (id: string) => {
    setExpandedPeople(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedPeople(new Set(personStatements.map(p => p.personId)));
  const collapseAll = () => setExpandedPeople(new Set());

  const isRequestPaid = (requestId: string) => {
    return confirmations.some(c => 'id' in c && c.id === requestId && c.confirmed);
  };

  const handleSettlePerson = (personId: string) => {
    // 1. Encontra todas as solicitações pendentes dessa pessoa
    const pending = requests.filter(r => r.personId === personId && !isRequestPaid(r.id));
    
    if (pending.length === 0) {
      toast.info("Não existem pendências ativas para remover.");
      return;
    }

    if (onUpdatePaymentConfirmation) {
      pending.forEach(req => {
        onUpdatePaymentConfirmation({
          id: req.id,
          type: 'request',
          confirmed: true,
          paymentDate: new Date().toISOString().split("T")[0]
        });
      });
      toast.success("Conta liquidada! O funcionário sumirá do extrato em instantes.", { duration: 5000 });
    }
  };

  const personStatements = useMemo(() => {
    const data: Record<string, PersonStatement> = {};

    requests.forEach(req => {
      const isCurrentJob = selectedJob === "all" || req.jobId === selectedJob;
      const isPaid = isRequestPaid(req.id);
      
      const person = people.find(p => p.id === req.personId);
      if (!person) return;

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

      const dates = getDatesInRange(req.startDate, req.endDate);
      const projectName = jobs.find(j => j.id === req.jobId)?.name || 'Outro Projeto';

      dates.forEach(date => {
        const entry = timeEntries.find(e => e.personId === req.personId && e.jobId === req.jobId && e.date === date);
        const fc = foodControl.find(f => f.personId === req.personId && f.jobId === req.jobId && f.date === date);
        
        const reqMeals = (req.dailyOverrides?.[date] ?? req.meals) || [];
        if (!Array.isArray(reqMeals)) return;

        // A. LANÇAR VALOR SOLICITADO (Apenas se PENDENTE e do Job selecionado)
        if (isCurrentJob && !isPaid) {
          data[req.personId].jobIds.add(req.jobId);
          reqMeals.forEach(m => {
            data[req.personId].totalRequested += getMealValue(m, date, person);
          });
        }

        // B. LANÇAR DESCONTOS (Apenas se PENDENTE, independente do Job)
        if (!isPaid) {
          if (entry || date < new Date().toISOString().split("T")[0]) {
             const dayCalc = calculateDayDiscount(req, date, entry || undefined, fc, people);
             if (dayCalc.total > 0) {
                data[req.personId].balance -= dayCalc.total;
                data[req.personId].details.push({
                  date,
                  type: 'desconto',
                  reason: dayCalc.reason,
                  value: -dayCalc.total,
                  jobId: req.jobId,
                  projectName: projectName
                });
             }
          }

          if (fc) {
            const usedMeals: { type: 'cafe' | 'almoco' | 'janta'; used: boolean }[] = [
              { type: 'cafe', used: fc.usedCafe },
              { type: 'almoco', used: fc.usedAlmoco },
              { type: 'janta', used: fc.usedJanta }
            ];

            usedMeals.forEach(um => {
              if (um.used && !reqMeals.includes(um.type as any)) {
                const val = getMealValue(um.type as any, date, person);
                if (val > 0) {
                  data[req.personId].balance += val;
                  data[req.personId].details.push({
                    date,
                    type: 'extra',
                    reason: `${MEAL_LABELS[um.type as any]} extra (não solicitado)`,
                    value: val,
                    jobId: req.jobId,
                    projectName: projectName
                  });
                }
              }
            });
          }
        }
      });
    });

    return Object.values(data)
      .map(ps => {
         ps.totalUsed = ps.totalRequested + ps.balance;
         return ps;
      })
      .filter(ps => (ps.totalRequested !== 0 || ps.balance !== 0) && (selectedJob === "all" || ps.jobIds.has(selectedJob)));
  }, [requests, foodControl, people, timeEntries, confirmations, selectedJob, jobs]);

  const exportAsImage = () => {
    window.print();
  };

  const getPersonName = (id: string) => people.find(p => p.id === id)?.name || "—";
  const getJobName = (id: string) => jobs.find(j => j.id === id)?.name || "—";

  return (
    <div className="space-y-6 print:space-y-4">
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
        <div className="flex gap-2">
            <Button onClick={expandAll} variant="outline" size="sm" className="h-10 gap-2 border-dashed">
                <Eye className="h-4 w-4" /> Abrir Todos
            </Button>
            <Button onClick={collapseAll} variant="outline" size="sm" className="h-10 gap-2 border-dashed">
                <EyeOff className="h-4 w-4" /> Recolher Todos
            </Button>
            <Button onClick={exportAsImage} className="gap-2 h-10 shadow-sm" variant="default">
                <FileDown className="h-4 w-4" /> Exportar Extrato (PDF/Print)
            </Button>
        </div>
      </div>

      <div ref={statementRef} className="space-y-8 print:space-y-6">
        {personStatements.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/10 print:hidden">
            <Info className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground text-sm font-medium">Nenhum dado pendente encontrado.</p>
          </div>
        ) : (
          personStatements.map((ps) => (
            <Card key={ps.personId} className="overflow-hidden border-border shadow-md print:shadow-none print:border print:border-border break-inside-avoid">
              <CardHeader 
                className="bg-muted/30 border-b border-border py-4 print:bg-transparent cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => togglePerson(ps.personId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner print:border-none">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-bold text-foreground">{getPersonName(ps.personId)}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSettlePerson(ps.personId);
                          }}
                          className="h-7 px-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground hover:text-green-600 hover:bg-green-600/10 gap-1.5 print:hidden group"
                          title="Marcar como Liquidado (Remove do Extrato)"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                          Liquidado (Remover)
                        </Button>
                      </div>
                      <div className="flex gap-2 mt-1">
                        {Array.from(ps.jobIds).map(jid => (
                          <Badge key={jid} variant="outline" className="text-[10px] font-medium opacity-70">
                            {getJobName(jid)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-0.5">Saldo Pendente</span>
                      <span className={`text-xl font-black tabular-nums ${ps.balance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {ps.balance >= 0 ? '+' : ''}{ps.balance.toFixed(2)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePerson(ps.personId);
                      }}
                      className="h-10 w-10 rounded-full hover:bg-muted print:hidden"
                    >
                      {expandedPeople.has(ps.personId) ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={`p-0 transition-all duration-300 ${expandedPeople.has(ps.personId) || typeof window === 'undefined' ? 'block' : 'hidden print:block'}`}>
                {/* Resumo principal: 3 colunas claras e diretas */}
                <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                  <div className="p-5 text-center">
                    <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-2">Total Solicitado</span>
                    <span className="text-xl font-black tabular-nums text-foreground">R$ {ps.totalRequested.toFixed(2)}</span>
                    <p className="text-[9px] text-muted-foreground mt-1 italic">Refeições pedidas</p>
                  </div>
                  <div className="p-5 text-center">
                    <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground block mb-2">Descontos Pendentes</span>
                    <span className={`text-xl font-black tabular-nums ${ps.balance < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {ps.balance < 0 ? `-R$ ${Math.abs(ps.balance).toFixed(2)}` : 'Nenhum'}
                    </span>
                    <p className="text-[9px] text-muted-foreground mt-1 italic">{ps.details.filter(d => d.type === 'desconto').length} ocorrência(s)</p>
                  </div>
                  <div className="p-5 text-center bg-primary/5 print:bg-transparent">
                    <span className="text-2xs uppercase tracking-wider font-semibold text-primary block mb-2">✅ Valor Final a Pagar</span>
                    <span className="text-xl font-black tabular-nums text-primary">
                      R$ {(ps.totalRequested + ps.balance).toFixed(2)}
                    </span>
                    <p className="text-[9px] text-primary/60 mt-1 italic font-bold">Enviar este valor</p>
                  </div>
                </div>

                {ps.details.length > 0 ? (
                  <div className="p-4">
                    <h4 className="text-xs uppercase tracking-widest font-black text-muted-foreground mb-4 flex items-center gap-2 border-b border-border pb-2">
                       Memória de Cálculo (Lançamentos em Aberto)
                    </h4>
                    <div className="space-y-2">
                      {ps.details.map((d, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/30 transition-colors print:bg-transparent">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                              <span className="text-2xs tabular-nums text-muted-foreground bg-background px-2 py-0.5 rounded border border-border print:border-border">
                                {d.date?.includes("-") ? d.date.split("-").reverse().join("/") : d.date || "—"}
                              </span>
                              <span className="font-medium text-foreground">{d.reason}</span>
                            </div>
                            <span className="text-[9px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter italic">Projeto Original: {d.projectName}</span>
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
                    Nenhuma divergência ou desconto pendente encontrado.
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default StatementTab;
