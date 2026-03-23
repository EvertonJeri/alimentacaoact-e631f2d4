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
import { type Job } from "@/lib/types";

export const JobImportDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const { bulkInsertJobs } = useDatabase();

  const parseExcel = (file: File): Promise<Job[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return reject(new Error("Arquivo sem abas encontradas."));
          }

          // Sempre usa a PRIMEIRA aba (ex: "Cronograma")
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          if (!worksheet || !worksheet["!ref"]) {
            return reject(new Error(`Aba "${firstSheetName}" está vazia ou não pôde ser lida.`));
          }

          // Lê o range total da planilha (ex: "A1:T100")
          const range = XLSX.utils.decode_range(worksheet["!ref"]);
          const totalRows = range.e.r; // última linha com dados

          const jobsToInsert: Job[] = [];
          const seenIds = new Set<string>();

          // Função auxiliar: lê valor de uma célula como string
          const getCellValue = (row: number, col: number): string => {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            if (!cell) return "";
            // .v = valor raw (número, string, bool)
            // .w = valor formatado (como aparece no Excel)
            // Preferimos .v para job numbers numéricos (2526 → "2526"), .w como fallback
            const raw = cell.v !== undefined ? String(cell.v) : (cell.w || "");
            return raw.trim().replace(/\.0+$/, ""); // Remove .0 de números inteiros
          };

          // Detecta onde está o cabeçalho (linha com "JOB" na coluna A)
          // Varre as primeiras 15 linhas
          let dataStartRow = 1; // fallback: começa da 2ª linha (index 1)
          let headerFound = false;

          for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 14); r++) {
            const colA = getCellValue(r, 0).toUpperCase();
            if (colA === "JOB" || colA === "DESCRIÇÃO" || colA === "DESCRICAO") {
              dataStartRow = r + 1; // dados começam na linha seguinte ao cabeçalho
              headerFound = true;
              break;
            }
          }

          if (!headerFound) {
            // Se não achou cabeçalho, começa do início
            dataStartRow = range.s.r;
          }

          // Lê os dados linha a linha
          for (let r = dataStartRow; r <= totalRows; r++) {
            const description = getCellValue(r, 0); // Coluna A
            const jobNumber = getCellValue(r, 1);   // Coluna B

            if (!description || !jobNumber) continue;

            const fullName = `${jobNumber} - ${description}`;

            if (!seenIds.has(jobNumber)) {
              jobsToInsert.push({ id: jobNumber, name: fullName });
              seenIds.add(jobNumber);
            }
          }

          resolve(jobsToInsert);
        } catch (err) {
          reject(err);
        }
      };

      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected if needed
    event.target.value = "";

    setLoading(true);
    setPreview(null);
    setPendingJobs([]);

    try {
      const jobs = await parseExcel(file);

      if (jobs.length === 0) {
        toast.error("Nenhum Job encontrado. Verifique se as colunas A (Descrição) e B (Nº Job) estão preenchidas.");
        return;
      }

      // Mostra preview antes de confirmar
      setPreview({
        count: jobs.length,
        sample: jobs.slice(0, 3).map((j) => j.name),
      });
      setPendingJobs(jobs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro ao ler arquivo: ${message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (pendingJobs.length === 0) return;
    setLoading(true);
    try {
      await bulkInsertJobs.mutateAsync(pendingJobs);
      toast.success(`${pendingJobs.length} Jobs importados com sucesso!`);
      setPreview(null);
      setPendingJobs([]);
      setOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro ao salvar Jobs: ${message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setPreview(null);
      setPendingJobs([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            Selecione a planilha (aba <strong>Cronograma</strong>). O sistema lê a Coluna A como Descrição e a Coluna B como Nº do Job, e salva no formato <strong>Número - Descrição</strong>.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted rounded-xl bg-muted/20 space-y-4">
            <div className="p-4 bg-background rounded-full shadow-sm border border-border">
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">
                {loading ? "Processando planilha..." : "Clique para selecionar o arquivo"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Aceita <strong>.xlsx</strong>, <strong>.xls</strong> e <strong>.xlsm</strong>
              </p>
            </div>
            <InputFile
              accept=".xlsx,.xls,.xlsm"
              onChange={handleFileChange}
              disabled={loading}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                <CheckCircle2 className="h-4 w-4" />
                {preview.count} Jobs encontrados na planilha
              </div>
              <div className="space-y-1">
                {preview.sample.map((name, i) => (
                  <p key={i} className="text-xs text-green-800 font-mono truncate">• {name}</p>
                ))}
                {preview.count > 3 && (
                  <p className="text-xs text-green-600 italic">...e mais {preview.count - 3} Jobs</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
              <span>Jobs com o mesmo número já existentes serão <strong>atualizados</strong>. Confirme para salvar.</span>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-between">
          {preview ? (
            <>
              <Button variant="outline" onClick={() => { setPreview(null); setPendingJobs([]); }} disabled={loading}>
                Voltar
              </Button>
              <Button onClick={handleConfirm} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar Importação
              </Button>
            </>
          ) : (
            <div className="flex items-start gap-2 text-[10px] text-muted-foreground italic">
              <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0 mt-0.5" />
              <span>Sempre usa a primeira aba da planilha (ex: Cronograma).</span>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Componente auxiliar para Input de Arquivo estilizado
const InputFile = ({
  accept,
  onChange,
  disabled,
}: {
  accept: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) => (
  <label
    className={`
    relative cursor-pointer px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all
    ${disabled ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"}
  `}
  >
    Selecionar Arquivo
    <input type="file" className="hidden" accept={accept} onChange={onChange} disabled={disabled} />
  </label>
);
