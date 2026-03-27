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
import { Check, Wallet, Scissors, Calculator, CheckCircle2, FileDown } from "lucide-react";
import * as XLSX from 'xlsx';
import { toast } from "sonner";

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
    let totalPlanned = 0;
    let totalDiscount = 0;
    let totalPlannedDiscount = 0;

    jobRequests.forEach(req => {
      const person = people.find(p => p.id === req.personId);
      const conf = confirmations.find(c => 'id' in c && c.confirmed && (c.id === req.id || c.id === `job-${jobId}`)) as PaymentConfirmation | undefined;
      
      const dates = getDatesInRange(req.startDate, req.endDate);
      let reqBruto = 0;
      dates.forEach(d => {
        const meals = req.dailyOverrides?.[d] ?? req.meals;
        meals.forEach(m => {
          reqBruto += getMealValue(m, d, person, req.location);
        });
      });
      
      totalPlanned += reqBruto;
      if (conf) {
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
      
      const allPersonJobReqs = requests.filter(r => r.personId === personId && r.jobId === jobId);
      allPersonJobReqs.forEach(pReq => {
        const dates = getDatesInRange(pReq.startDate, pReq.endDate);
        dates.forEach(date => {
            const entry = timeEntries.find(e => e.personId === personId && e.jobId === jobId && e.date === date);
            const fc = foodControl.find(f => f.personId === personId && f.jobId === jobId && f.date === date);
            
            if (entry) {
                const dayCalc = calculateDayDiscount(pReq, date, entry, fc, people);
                totalPlannedDiscount += dayCalc.total;
                if (personConf) {
                  totalDiscount += dayCalc.total;
                }
            }
        });
      });
    });

    return { 
      totalPaid, 
      totalPlanned, 
      totalDiscount, 
      totalPlannedDiscount,
      netCost: totalPaid - totalDiscount,
      plannedNetCost: totalPlanned - totalPlannedDiscount
    };
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

  const handleExportExcel = () => {
    const data = jobs.map(job => {
      const costs = calculateJobCost(job.id);
      if (costs.totalPlanned === 0 && costs.totalPlannedDiscount === 0) return null;
      
      const status = getJobStatus(job.id)?.confirmed ? "Finalizado" : "Pendente";

      return {
        "Projeto": job.name,
        "Pagamento Confirmado (R$)": costs.totalPaid,
        "Pagamento Previsto (R$)": costs.totalPlanned,
        "Desconto Confirmado (R$)": costs.totalDiscount,
        "Desconto Previsto (R$)": costs.totalPlannedDiscount,
        "Custo Líquido Real (R$)": costs.netCost,
        "Custo Líquido Estimado (R$)": costs.plannedNetCost,
        "Status": status
      };
    }).filter(Boolean);

    const worksheet = XLSX.utils.json_to_sheet(data as any);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fechamento de Jobs");
    
    // Gerar arquivo e disparar download
    XLSX.writeFile(workbook, `Fechamento_Jobs_ACT_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel gerado com sucesso!");
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
              <th className="px-4 py-3 text-center">
                <Button variant="ghost" size="icon" onClick={handleExportExcel} title="Exportar para Excel" className="h-8 w-8">
                  <FileDown className="h-4 w-4" />
                </Button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map(job => {
              const { totalPaid, totalPlanned, totalDiscount, totalPlannedDiscount, netCost, plannedNetCost } = calculateJobCost(job.id);
              const statusConf = getJobStatus(job.id);
              const isFinished = statusConf?.confirmed;

              if (totalPlanned === 0 && totalPlannedDiscount === 0) return null;

              return (
                <tr key={job.id} className={`hover:bg-muted/30 transition-colors ${isFinished ? "bg-green-50/30" : ""}`}>
                  <td 
                    className="px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors group"
                    onClick={() => onJobClick?.(job.id)}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-black text-xs text-primary tabular-nums tracking-tighter group-hover:underline">{job.name.split(" - ")[0]}</span>
                      {job.name.includes(" - ") && (
                        <span className="text-[10px] uppercase font-bold text-muted-foreground truncate opacity-70 mt-1">
                          {job.name.split(" - ").slice(1).join(" - ")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    <div className="font-medium text-green-600">R$ {totalPaid.toFixed(2)}</div>
                    {totalPaid < totalPlanned && (
                      <div className="text-[10px] text-muted-foreground italic">Previsto: R$ {totalPlanned.toFixed(2)}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    <div className="font-medium text-destructive">- R$ {totalDiscount.toFixed(2)}</div>
                    {totalDiscount < totalPlannedDiscount && (
                      <div className="text-[10px] text-muted-foreground italic">Previsto: - R$ {totalPlannedDiscount.toFixed(2)}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    <div className="font-black text-lg tracking-tight text-primary">R$ {netCost.toFixed(2)}</div>
                    {netCost !== plannedNetCost && (
                      <div className="text-[10px] text-muted-foreground italic">Estimado final: R$ {plannedNetCost.toFixed(2)}</div>
                    )}
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
