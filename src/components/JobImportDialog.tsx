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
import { Upload, FileUp, Loader2, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { type Job } from "@/lib/types";

type Step = "idle" | "select-sheet" | "preview" | "done";

export const JobImportDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [workbookCache, setWorkbookCache] = useState<XLSX.WorkBook | null>(null);
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const { bulkInsertJobs } = useDatabase();

  // Passo 1: lê o arquivo e lista as abas disponíveis
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

        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          toast.error("Nenhuma aba encontrada no arquivo.");
          setLoading(false);
          return;
        }

        setWorkbookCache(wb);
        setSheetNames(wb.SheetNames);

        // Tenta pré-selecionar "Cronograma" se existir
        const defaultSheet =
          wb.SheetNames.find((n) => n.toLowerCase().includes("cronograma")) ||
          wb.SheetNames[0];
        setSelectedSheet(defaultSheet);
        setStep("select-sheet");
      } catch (err) {
        toast.error("Erro ao processar o arquivo. Verifique o formato.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Passo 2: parseia a aba selecionada
  const handleParseSheet = () => {
    if (!workbookCache || !selectedSheet) return;
    setLoading(true);

    try {
      const worksheet = workbookCache.Sheets[selectedSheet];

      if (!worksheet || !worksheet["!ref"]) {
        toast.error(`Aba "${selectedSheet}" está vazia.`);
        setLoading(false);
        return;
      }

      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      const totalRows = range.e.r;

      // Lê valor de uma célula como string (raw value ou formatted)
      const getCellValue = (row: number, col: number): string => {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
        if (!cell) return "";
        const raw = cell.v !== undefined ? String(cell.v) : (cell.w || "");
        return raw.trim().replace(/\.0+$/, "");
      };

      // Detecta a linha de cabeçalho: linha onde col A = "JOB"
      let dataStartRow = range.s.r; // fallback: começa do início
      for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 20); r++) {
        const colA = getCellValue(r, 0).toUpperCase();
        if (colA === "JOB" || colA === "DESCRIÇÃO" || colA === "DESCRICAO") {
          dataStartRow = r + 1; // dados começam na próxima linha
          break;
        }
      }

      const jobsToInsert: Job[] = [];
      const seenIds = new Set<string>();

      for (let r = dataStartRow; r <= totalRows; r++) {
        const description = getCellValue(r, 0); // Coluna A = Descrição
        const jobNumber = getCellValue(r, 1);   // Coluna B = Nº Job

        if (!description || !jobNumber) continue;
        // Pula linhas que claramente são totalizadores ou vazias
        if (jobNumber.toLowerCase() === "total" || description.toLowerCase() === "total") continue;

        const fullName = `${jobNumber} - ${description}`;
        if (!seenIds.has(jobNumber)) {
          jobsToInsert.push({ id: jobNumber, name: fullName });
          seenIds.add(jobNumber);
        }
      }

      if (jobsToInsert.length === 0) {
        toast.error(`Nenhum Job encontrado na aba "${selectedSheet}". Verifique se a Coluna A tem a descrição e a Coluna B tem o número.`);
        setLoading(false);
        return;
      }

      setPendingJobs(jobsToInsert);
      setStep("preview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao processar aba: ${msg}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Passo 3: salva no banco
  const handleConfirm = async () => {
    if (pendingJobs.length === 0) return;
    setLoading(true);
    try {
      await bulkInsertJobs.mutateAsync(pendingJobs);
      toast.success(`${pendingJobs.length} Jobs importados com sucesso!`);
      handleClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao salvar Jobs: ${msg}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep("idle");
    setSheetNames([]);
    setSelectedSheet("");
    setWorkbookCache(null);
    setPendingJobs([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 font-bold uppercase tracking-widest text-[10px] h-9">
          <Upload className="h-3.5 w-3.5" /> Importar Jobs (Excel)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Importar Tabela de Jobs
          </DialogTitle>
          <DialogDescription>
            Selecione o arquivo Excel. Você escolherá qual aba usar (ex: <strong>Cronograma</strong>).
          </DialogDescription>
        </DialogHeader>

        {/* Passo 1: Selecionar arquivo */}
        {step === "idle" && (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted rounded-xl bg-muted/20 space-y-4">
            <div className="p-4 bg-background rounded-full shadow-sm border border-border">
              {loading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{loading ? "Lendo arquivo..." : "Clique para selecionar o arquivo"}</p>
              <p className="text-xs text-muted-foreground mt-1">Aceita <strong>.xlsx</strong>, <strong>.xls</strong> e <strong>.xlsm</strong></p>
            </div>
            <InputFile accept=".xlsx,.xls,.xlsm" onChange={handleFileChange} disabled={loading} />
          </div>
        )}

        {/* Passo 2: Escolher a aba */}
        {step === "select-sheet" && (
          <div className="space-y-4">
            <p className="text-sm font-bold text-foreground">Selecione a aba da planilha:</p>
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
              {sheetNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedSheet(name)}
                  className={`
                    text-left px-4 py-2.5 rounded-lg border text-sm font-medium transition-all
                    ${selectedSheet === name
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
                      : "bg-background border-border hover:bg-muted/50 text-foreground"}
                  `}
                >
                  {name}
                  {selectedSheet === name && <CheckCircle2 className="inline h-4 w-4 ml-2" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Passo 3: Preview antes de confirmar */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                <CheckCircle2 className="h-4 w-4" />
                {pendingJobs.length} Jobs encontrados na aba "{selectedSheet}"
              </div>
              <div className="space-y-1">
                {pendingJobs.slice(0, 4).map((job, i) => (
                  <p key={i} className="text-xs text-green-800 font-mono truncate">• {job.name}</p>
                ))}
                {pendingJobs.length > 4 && (
                  <p className="text-xs text-green-600 italic">...e mais {pendingJobs.length - 4} Jobs</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
              <span>Jobs com o mesmo número já existentes serão <strong>atualizados</strong>.</span>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-between">
          {step === "idle" && (
            <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              Você escolherá qual aba usar após selecionar o arquivo.
            </p>
          )}
          {step === "select-sheet" && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleParseSheet} disabled={loading || !selectedSheet} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                Continuar com "{selectedSheet}"
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("select-sheet")} disabled={loading}>Voltar</Button>
              <Button onClick={handleConfirm} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar Importação
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const InputFile = ({
  accept, onChange, disabled,
}: {
  accept: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) => (
  <label className={`
    relative cursor-pointer px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all
    ${disabled ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"}
  `}>
    Selecionar Arquivo
    <input type="file" className="hidden" accept={accept} onChange={onChange} disabled={disabled} />
  </label>
);
