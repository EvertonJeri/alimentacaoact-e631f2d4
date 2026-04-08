import { useState } from "react";
import * as XLSX from "xlsx";
import { useDatabase } from "@/hooks/use-database";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const TimeRegistrationImportDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"idle" | "preview" | "done">("idle");
  const [stats, setStats] = useState({ total: 0, newJobs: 0, newPeople: 0 });
  const [parsedData, setParsedData] = useState<any[]>([]);
  
  const { people, jobs, updateTimeEntries } = useDatabase();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setLoading(true);

    const reader = new FileReader();
    reader.onerror = () => {
      toast.error("Falha ao ler o arquivo.");
      setLoading(false);
    };
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        // Acha a linha de cabeçalho (que contém "Nº JOB")
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(20, rows.length); i++) {
            if (rows[i] && rows[i][0] === "Nº JOB" || rows[i][0] === "Nº JOB ") {
                headerRowIdx = i;
                break;
            }
        }

        if (headerRowIdx === -1) {
            toast.error("Formato inválido. Não encontrei a coluna 'Nº JOB' no cabeçalho.");
            setLoading(false);
            return;
        }

        const entriesToImport = [];
        let newJobsFound = new Set<string>();
        let newPeopleFound = new Set<string>();

        // Processa das linhas abaixo do cabeçalho em diante
        for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            const numJob = String(row[0]).trim();
            const descJob = String(row[1]).trim();
            const name = String(row[2]).trim();
            let dateVal = String(row[4]).trim(); // Coluna E (índice 4)
            
            // Format time correctly
            const formatTime = (v: any) => {
                if (!v && v !== 0) return "";
                let s = String(v).trim();
                
                // If it's already formatted like "08:30" or "08:30:00"
                if (s.includes(':')) {
                   const parts = s.split(':');
                   if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
                } 
                // If it's an Excel time fraction like 0.3520833333333336
                else if (!isNaN(Number(v)) && Number(v) > 0 && Number(v) < 1) {
                   const totalMinutes = Math.round(Number(v) * 24 * 60);
                   const h = Math.floor(totalMinutes / 60);
                   const m = totalMinutes % 60;
                   return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                }
                
                return ""; // ignora se não for hora válida
            };

            const entry1 = formatTime(row[6]);
            const exit1 = formatTime(row[7]);
            const entry2 = formatTime(row[8]);
            const exit2 = formatTime(row[9]);
            const entry3 = formatTime(row[10]);
            const exit3 = formatTime(row[11]);

            if (!numJob && !name) continue; // Linha vazia

            // Converte data DD/MM/YYYY ou formato serial do Excel
            if (!dateVal.includes("/")) {
               const parsedDate = new Date((Number(dateVal) - (25567 + 2)) * 86400 * 1000);
               if (!isNaN(parsedDate.getTime())) {
                  dateVal = parsedDate.toISOString().split('T')[0];
               } else {
                  dateVal = "2026-01-01"; // Fallback apenas para não quebrar
               }
            } else {
               const parts = dateVal.split("/");
               if(parts.length === 3) dateVal = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            entriesToImport.push({
                numJob,
                descJob,
                name,
                date: dateVal,
                entry1, exit1, entry2, exit2, entry3, exit3
            });

            // Count new jobs and people
            const jobFulName = `${numJob} - ${descJob}`;
            const jobExists = jobs.data?.find(j => j.name.toLowerCase().includes(numJob.toLowerCase()));
            if (!jobExists) newJobsFound.add(jobFulName);

            const personExists = people.data?.find(p => p.name.toLowerCase() === name.toLowerCase());
            if (!personExists) newPeopleFound.add(name);
        }

        setParsedData(entriesToImport);
        setStats({
            total: entriesToImport.length,
            newJobs: newJobsFound.size,
            newPeople: newPeopleFound.size
        });
        setStep("preview");
        setLoading(false);
      } catch (err) {
        console.error(err);
        toast.error("Erro processando o arquivo.");
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const executeImport = async () => {
    setLoading(true);
    try {
      // 1. Criar pessoas que faltam
      const peopleNames = Array.from(new Set(parsedData.map(d => d.name)));
      for (const name of peopleNames) {
          if (!people.data?.find(p => p.name.toLowerCase() === name.toLowerCase())) {
             await supabase.from("people").insert([{ id: crypto.randomUUID(), name, is_registered: false, department: "Geral" }]);
          }
      }
      // Refresh people local cache from DB or assume we can query them again
      const { data: latestPeople } = await supabase.from("people").select("id, name");

      // 2. Criar Jobs que faltam
      const jobKeys = Array.from(new Set(parsedData.map(d => `${d.numJob} - ${d.descJob}`)));
      for (const jobKey of jobKeys) {
         const parts = jobKey.split(" - ");
         const numJob = parts[0];
         if (!jobs.data?.find(j => j.name.includes(numJob))) {
            await supabase.from("jobs").insert([{ id: crypto.randomUUID(), name: jobKey }]);
         }
      }
      const { data: latestJobs } = await supabase.from("jobs").select("id, name");

      // 3. Montar Time Entries
      const finalEntries = parsedData.map(d => {
         const person = latestPeople?.find(p => p.name.toLowerCase() === d.name.toLowerCase());
         const job = latestJobs?.find(j => j.name.includes(d.numJob));
         return {
            id: crypto.randomUUID(),
            person_id: person?.id,
            job_id: job?.id,
            date: d.date,
            entry1: d.entry1 || null, exit1: d.exit1 || null,
            entry2: d.entry2 || null, exit2: d.exit2 || null,
            entry3: d.entry3 || null, exit3: d.exit3 || null
         };
      }).filter(e => e.person_id && e.job_id); // Drop invalids

      // Deduplicate finalEntries just in case the excel has multiple rows for the exact same person, job and date
      const uniqueEntriesMap = new Map();
      finalEntries.forEach(e => {
          uniqueEntriesMap.set(`${e.person_id}-${e.job_id}-${e.date}`, e);
      });
      const deduplicatedEntries = Array.from(uniqueEntriesMap.values());

      // Iniciar banco em lotes de 500
      const BATCH_SIZE = 500;
      for (let i = 0; i < deduplicatedEntries.length; i += BATCH_SIZE) {
         const chunk = deduplicatedEntries.slice(i, i + BATCH_SIZE);
         const { error } = await supabase.from("time_entries").upsert(chunk, { onConflict: "person_id,job_id,date" });
         if (error) throw error;
      }

      setStep("done");
      // Atualizar interface
      updateTimeEntries.mutate([]); // Apenas para forçar invalidação via react-query, melhor seria só invalidar o cache na ui principal
      toast.success("Horas importadas com sucesso! Atualize a página se necessário.");
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro fatal: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) setOpen(v); }}>
      <DialogTrigger asChild>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Restaurar Registro de Horas</DialogTitle>
          <DialogDescription>
            Envie sua planilha de Registro_Horas exportada (ex: Registro_Horas_26-03-2026.xlsx) para trazer seus dados de volta.
          </DialogDescription>
        </DialogHeader>

        {step === "idle" && (
          <div className="py-6 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-xl bg-muted/10 relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              disabled={loading}
            />
            {loading ? (
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
            ) : (
              <FileUp className="h-8 w-8 text-muted-foreground mb-3" />
            )}
            <p className="text-sm font-medium">Clique ou arraste a planilha aqui</p>
            <p className="text-xs text-muted-foreground mt-1">Formato suportado: Excel (.xlsx)</p>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-2">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-bold mb-1">Análise do Arquivo Concluída:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>{stats.total}</strong> linhas de horas encontradas.</li>
                  {stats.newJobs > 0 && <li><strong>{stats.newJobs}</strong> Jobs do arquivo serão criados.</li>}
                  {stats.newPeople > 0 && <li><strong>{stats.newPeople}</strong> Pessoas novas serão criadas.</li>}
                </ul>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Sua planilha será injetada diretamente no banco de dados. Os pagamentos e saldos serão reatados automaticamente.
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-bold text-foreground">Restauração Concluída!</p>
            <p className="text-sm text-muted-foreground mt-2">Suas horas estão a salvo novamente.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            {step === "done" ? "Fechar" : "Cancelar"}
          </Button>
          {step === "preview" && (
            <Button onClick={executeImport} disabled={loading} className="gap-2 focus:ring-0">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Restaurando..." : "Confirmar e Restaurar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
