import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Job, 
  Person, 
  MealRequest, 
  TimeEntry, 
  FoodControlEntry, 
  PaymentConfirmation, 
  DiscountConfirmation,
  getDatesInRange,
  getMealValue,
  calculateDayDiscount
} from "@/lib/types";
import { Check, Wallet, Scissors, Calculator, CheckCircle2 } from "lucide-react";

interface JobCostTabProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries: TimeEntry[];
  foodControl: FoodControlEntry[];
  confirmations: (DiscountConfirmation | PaymentConfirmation)[];
  onUpdatePaymentConfirmation?: (conf: PaymentConfirmation) => void;
  onJobClick?: (jobId: string) => void;
}

const JobCostTab = ({
  people,
  jobs,
  requests,
  timeEntries,
  foodControl,
  confirmations,
  onUpdatePaymentConfirmation,
  onJobClick
}: JobCostTabProps) => {

  const getJobStatus = (jobId: string) => {
    return confirmations.find(c => 'id' in c && c.id === `finish-${jobId}`) as PaymentConfirmation | undefined;
  };

  const calculateJobCost = (jobId: string) => {
    const jobRequests = requests.filter(r => r.jobId === jobId);
    let totalPaid = 0;
    let totalDiscount = 0;

    jobRequests.forEach(req => {
      const person = people.find(p => p.id === req.personId);
      const conf = confirmations.find(c => 'id' in c && c.confirmed && (c.id === req.id || c.id === `job-${jobId}`)) as PaymentConfirmation | undefined;
      
      if (conf) {
        // Calculation of paid value (crédito)
        const dates = getDatesInRange(req.startDate, req.endDate);
        let reqBruto = 0;
        dates.forEach(d => {
          const meals = req.dailyOverrides?.[d] ?? req.meals;
          meals.forEach(m => {
            reqBruto += getMealValue(m, d, person, req.location);
          });
        });
        
        // Final total considers applied balance? The user wants "total que foi pago".
        // In PaymentTab, finalTotal = frozenApply ? (currentReqNet + (conf?.appliedBalance || 0)) : reqBruto
        // currentReqNet = reqBruto - discounts
        // So finalTotal = (reqBruto - discounts + appliedBalance) OR reqBruto
        // Let's use the actual gross value if we want to know how much the job "cost" in terms of food benefit,
        // but the user says "pagamento - desconto = custo".
        totalPaid += reqBruto;
      }
    });

    // Use a Set to calculate discounts only once per person in this job
    const processedPersons = new Set<string>();
    jobRequests.forEach(req => {
      const personId = req.personId;
      if (processedPersons.has(personId)) return;
      processedPersons.add(personId);

      const person = people.find(p => p.id === personId);
      const personConf = confirmations.find(c => 'personId' in c && c.personId === personId && c.confirmed);
      
      if (personConf) {
        // Encontrar todas as solicitações desta pessoa neste job para somar os descontos de todo o período
        const allPersonJobReqs = requests.filter(r => r.personId === personId && r.jobId === jobId);
        
        allPersonJobReqs.forEach(pReq => {
          const dates = getDatesInRange(pReq.startDate, pReq.endDate);
          dates.forEach(date => {
              const entry = timeEntries.find(e => e.personId === personId && e.jobId === jobId && e.date === date);
              const fc = foodControl.find(f => f.personId === personId && f.jobId === jobId && f.date === date);
              
              if (entry) {
                  const dayCalc = calculateDayDiscount(pReq, date, entry, fc, people);
                  totalDiscount += dayCalc.total;
              }
          });
        });
      }
    });

    return { totalPaid, totalDiscount, netCost: totalPaid - totalDiscount };
  };

  const handleFinishJob = (jobId: string) => {
    onUpdatePaymentConfirmation?.({
      id: `finish-${jobId}`,
      type: 'job',
      paymentDate: new Date().toISOString().split('T')[0],
      confirmed: true
    });
  };

  const handleUndoFinishJob = (jobId: string) => {
    onUpdatePaymentConfirmation?.({
      id: `finish-${jobId}`,
      type: 'job',
      paymentDate: "",
      confirmed: false
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border overflow-hidden shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-3 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Job</th>
              <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Pagamento (Crédito)</th>
              <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Descontos (Débito)</th>
              <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider font-medium text-primary">Custo do Job</th>
              <th className="text-center px-4 py-3 text-2xs uppercase tracking-wider font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map(job => {
              const { totalPaid, totalDiscount, netCost } = calculateJobCost(job.id);
              const statusConf = getJobStatus(job.id);
              const isFinished = statusConf?.confirmed;

              if (totalPaid === 0 && totalDiscount === 0) return null;

              return (
                <tr key={job.id} className={`hover:bg-muted/30 transition-colors ${isFinished ? "bg-green-50/30" : ""}`}>
                  <td 
                    className="px-4 py-4 font-bold text-foreground cursor-pointer hover:text-primary hover:underline transition-colors"
                    onClick={() => onJobClick?.(job.id)}
                  >
                    {job.name}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums text-green-600 font-medium">
                    R$ {totalPaid.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums text-destructive font-medium">
                    - R$ {totalDiscount.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums font-black text-lg tracking-tight">
                    R$ {netCost.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {isFinished ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        <Check className="h-3 w-3 mr-1" /> Finalizado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-dashed">
                        Em Aberto
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {!isFinished ? (
                      <Button 
                        size="sm" 
                        onClick={() => handleFinishJob(job.id)}
                        className="bg-primary hover:bg-primary/90 gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar Job
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleUndoFinishJob(job.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Reabrir
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="p-4 rounded-xl border border-border bg-background shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-green-100 text-green-600">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total de Pagamentos</span>
          </div>
          <p className="text-2xl font-black tabular-nums text-green-600">
            R$ {jobs.reduce((sum, job) => sum + calculateJobCost(job.id).totalPaid, 0).toFixed(2)}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-background shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
              <Scissors className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total de Descontos</span>
          </div>
          <p className="text-2xl font-black tabular-nums text-destructive">
            - R$ {jobs.reduce((sum, job) => sum + calculateJobCost(job.id).totalDiscount, 0).toFixed(2)}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <Calculator className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Custo Netto Total</span>
          </div>
          <p className="text-2xl font-black tabular-nums text-primary">
            R$ {jobs.reduce((sum, job) => sum + calculateJobCost(job.id).netCost, 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default JobCostTab;
