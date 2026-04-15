import React, { useMemo, useState } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp, 
  Users, 
  Utensils, 
  Calculator,
  Search,
  FilterX
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  type Person, 
  type Job, 
  type MealRequest, 
  type TimeEntry, 
  type FoodControlEntry,
  getDatesInRange,
  getMealValue,
  calculateDayDiscount,
  MEAL_VALUES
} from "@/lib/types";

interface ReportsTabProps {
  people: Person[];
  jobs: Job[];
  requests: MealRequest[];
  timeEntries: TimeEntry[];
  foodControl: FoodControlEntry[];
}

const ReportsTab: React.FC<ReportsTabProps> = ({
  people,
  jobs,
  requests,
  timeEntries,
  foodControl
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const reportData = useMemo(() => {
    let totalPlannedCost = 0;
    let totalRealizedCost = 0;
    let totalWaste = 0; // Requested but not used
    let totalExtra = 0; // Used but not requested
    const jobStats: Record<string, any> = {};
    const personStats: Record<string, any> = {};
    const allDeviations: any[] = [];

    // Initialize jobStats
    jobs.forEach(j => {
      jobStats[j.id] = { 
        name: j.name, 
        planned: 0, 
        realized: 0, 
        waste: 0, 
        extra: 0, 
        deviationsCount: 0 
      };
    });

    // Initialize personStats
    people.forEach(p => {
      personStats[p.id] = { 
        name: p.name, 
        planned: 0, 
        realized: 0, 
        waste: 0, 
        extra: 0, 
        deviationsCount: 0 
      };
    });

    const processedDays = new Set<string>();

    // We only care about past and today for deviations
    const today = new Date().toISOString().split("T")[0];

    requests.forEach(req => {
      const person = people.find(p => p.id === req.personId);
      const dates = getDatesInRange(req.startDate, req.endDate);
      
      dates.forEach(date => {
        if (date > today) return; // Ignore future for realization stats

        const dayKey = `${req.personId}-${date}`;
        processedDays.add(dayKey);

        const entry = timeEntries.find(e => e.personId === req.personId && e.date === date);
        const fc = foodControl.find(f => f.personId === req.personId && f.date === date);

        const dummyReq: MealRequest = { ...req }; // Ensure type safety
        const calc = calculateDayDiscount(dummyReq, date, entry, fc, people);
        
        // Planned: value of requested meals
        let plannedValue = 0;
        req.meals.forEach(m => {
          plannedValue += getMealValue(m, date, person, req.location);
        });

        const realizedValue = plannedValue + calc.total;
        const waste = calc.total < 0 ? Math.abs(calc.total) : 0;
        const extra = calc.total > 0 ? calc.total : 0;

        totalPlannedCost += plannedValue;
        totalRealizedCost += realizedValue;
        totalWaste += waste;
        totalExtra += extra;

        const updateStats = (stats: any, id: string) => {
          if (stats[id]) {
            stats[id].planned += plannedValue;
            stats[id].realized += realizedValue;
            stats[id].waste += waste;
            stats[id].extra += extra;
            if (Math.abs(calc.total) > 0.1) {
              stats[id].deviationsCount += 1;
            }
          }
        };

        updateStats(jobStats, req.jobId);
        updateStats(personStats, req.personId);

        if (Math.abs(calc.total) > 0.1) {
          allDeviations.push({
            date,
            personName: person?.name || "Desconhecido",
            jobName: jobs.find(j => j.id === req.jobId)?.name || "N/A",
            value: calc.total,
            reason: calc.reason,
            type: calc.total > 0 ? "Extra" : "Falta"
          });
        }
      });
    });

    // Handle entries without requests (Orphans)
    foodControl.forEach(fc => {
      const dayKey = `${fc.personId}-${fc.date}`;
      if (processedDays.has(dayKey) || fc.date > today) return;

      const person = people.find(p => p.id === fc.personId);
      const entry = timeEntries.find(e => e.personId === fc.personId && e.date === fc.date);
      
      // Calculate as if no meals were requested
      const dummyReq: MealRequest = {
        id: "dummy",
        personId: fc.personId,
        jobId: fc.jobId,
        startDate: fc.date,
        endDate: fc.date,
        meals: []
      };

      const calc = calculateDayDiscount(dummyReq, fc.date, entry, fc, people);
      const extra = calc.total;

      totalRealizedCost += extra;
      totalExtra += extra;

      if (jobStats[fc.jobId]) {
        jobStats[fc.jobId].realized += extra;
        jobStats[fc.jobId].extra += extra;
        jobStats[fc.jobId].deviationsCount += 1;
      }

      if (personStats[fc.personId]) {
        personStats[fc.personId].realized += extra;
        personStats[fc.personId].extra += extra;
        personStats[fc.personId].deviationsCount += 1;
      }

      allDeviations.push({
        date: fc.date,
        personName: person?.name || "Desconhecido",
        jobName: jobs.find(j => j.id === fc.jobId)?.name || "N/A",
        value: extra,
        reason: "Uso sem solicitação prévia",
        type: "Extra"
      });
    });

    return {
      totalPlannedCost,
      totalRealizedCost,
      totalWaste,
      totalExtra,
      efficiency: totalPlannedCost > 0 ? (1 - (totalWaste / totalPlannedCost)) * 100 : 100,
      jobStats: Object.values(jobStats).sort((a, b) => b.realized - a.realized),
      personStats: Object.values(personStats).sort((a, b) => b.waste + b.extra - (a.waste + a.extra)),
      allDeviations: allDeviations.sort((a, b) => b.date.localeCompare(a.date))
    };
  }, [people, jobs, requests, timeEntries, foodControl]);

  const filteredDeviations = reportData.allDeviations.filter(d => 
    d.personName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.jobName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background border-blue-100 dark:border-blue-900 border-b-4 border-b-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Calculator className="h-3 w-3" /> Custo Previsto
            </CardDescription>
            <CardTitle className="text-2xl font-black text-blue-900 dark:text-blue-100 uppercase tracking-tight">
              {formatCurrency(reportData.totalPlannedCost)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-950/20 dark:to-background border-slate-100 dark:border-slate-900 border-b-4 border-b-slate-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <BarChart3 className="h-3 w-3" /> Custo Realizado
            </CardDescription>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
              {formatCurrency(reportData.totalRealizedCost)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background border-red-100 dark:border-red-900 border-b-4 border-b-red-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <TrendingDown className="h-3 w-3" /> Desvios (Faltas)
            </CardDescription>
            <CardTitle className="text-2xl font-black text-red-900 dark:text-red-100 uppercase tracking-tight">
              {formatCurrency(reportData.totalWaste)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background border-emerald-100 dark:border-emerald-900 border-b-4 border-b-emerald-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3 w-3" /> Desvios (Extras)
            </CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-tight">
              {formatCurrency(reportData.totalExtra)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job Comparison Table */}
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  Fechamento Consolidado por Job
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase opacity-70">Visão geral financeira de cada obra no período</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-[10px] font-black uppercase py-3">Obra / Job</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Previsto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Realizado</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">Eficiência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.jobStats.filter(j => j.realized > 0).slice(0, 10).map((job, idx) => {
                  const efficiency = job.planned > 0 ? (1 - (job.waste / job.planned)) * 100 : 100;
                  return (
                    <TableRow key={idx} className="group transition-colors duration-150">
                      <TableCell className="font-bold text-xs py-3">{job.name}</TableCell>
                      <TableCell className="text-right text-xs font-medium text-muted-foreground">{formatCurrency(job.planned)}</TableCell>
                      <TableCell className="text-right text-xs font-black">{formatCurrency(job.realized)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-[10px] font-black ${efficiency >= 90 ? 'text-emerald-600' : efficiency >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                            {efficiency.toFixed(0)}%
                          </span>
                          <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${efficiency >= 90 ? 'bg-emerald-500' : efficiency >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, efficiency)}%` }} />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Deviators */}
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Ranking de Desvios
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase opacity-70">Profissionais com maior impacto em desvios</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {reportData.personStats.filter(p => p.deviationsCount > 0).slice(0, 5).map((person, idx) => (
                <div key={idx} className="p-4 hover:bg-muted/30 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-black text-xs uppercase tracking-tight truncate max-w-[150px]">{person.name}</span>
                    <Badge variant="outline" className="text-[9px] font-black uppercase border-red-200 text-red-700 bg-red-50">
                      {person.deviationsCount} desvios
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="bg-red-50/50 p-2 rounded border border-red-100">
                      <p className="text-[10px] font-bold uppercase text-red-600 mb-0.5">Faltas</p>
                      <p className="text-xs font-black text-red-900">{formatCurrency(person.waste)}</p>
                    </div>
                    <div className="bg-emerald-50/50 p-2 rounded border border-emerald-100">
                      <p className="text-[10px] font-bold uppercase text-emerald-600 mb-0.5">Extras</p>
                      <p className="text-xs font-black text-emerald-900">{formatCurrency(person.extra)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Table */}
      <Card className="shadow-lg border-t-4 border-t-primary">
        <CardHeader className="border-b bg-muted/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse" />
                Detalhamento Analítico de Desvios
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase opacity-70">Histórico de todas as divergências identificadas pelo sistema</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="BUSCAR POR PROFISSIONAL, OBRA OU MOTIVO..." 
                className="pl-10 text-[10px] font-bold uppercase"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-[10px] font-black uppercase py-4">Data</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Profissional</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Obra / Job</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Tipo</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Motivo / Justificativa</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeviations.length > 0 ? (
                  filteredDeviations.map((dev, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/10 border-l-4 border-l-transparent hover:border-l-primary transition-all">
                      <TableCell className="py-4">
                        <span className="text-xs font-black tabular-nums">{dev.date.split('-').reverse().join('/')}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-bold uppercase tracking-tight">{dev.personName}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-muted-foreground truncate max-w-[150px] inline-block">{dev.jobName}</span>
                      </TableCell>
                      <TableCell>
                        {dev.type === "Extra" ? (
                          <Badge className="bg-emerald-500 text-white font-black text-[9px] uppercase hover:bg-emerald-600 border-none">Extra</Badge>
                        ) : (
                          <Badge className="bg-red-500 text-white font-black text-[9px] uppercase hover:bg-red-600 border-none">Falta</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-medium opacity-80">{dev.reason}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-xs font-black ${dev.value > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {dev.value > 0 ? '+' : ''}{formatCurrency(dev.value)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 opacity-50">
                        <FilterX className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Nenhum desvio encontrado</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsTab;
