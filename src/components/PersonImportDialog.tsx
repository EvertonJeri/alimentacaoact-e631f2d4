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
import { Upload, FileUp, Loader2, CheckCircle2, AlertCircle, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import { type Person } from "@/lib/types";

type Step = "idle" | "select-sheet" | "preview" | "done";

export const PersonImportDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [workbookCache, setWorkbookCache] = useState<XLSX.WorkBook | null>(null);
  const [pendingPeople, setPendingPeople] = useState<Omit<Person, "id">[]>([]);
  const { bulkUpsertPeople } = useDatabase();

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

        const defaultSheet =
          wb.SheetNames.find((n) => n.toLowerCase().includes("func")) ||
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
      const totalCols = range.e.c;

      const getCellValue = (row: number, col: number): string => {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
        if (!cell) return "";
        const raw = cell.v !== undefined ? String(cell.v) : (cell.w || "");
        return raw.trim().replace(/\.0+$/, "");
      };

      let dataStartRow = -1;
      const headerMap = new Map<string, number>();

      // Procura a linha de cabeçalho
      for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 20); r++) {
        let foundHeader = false;
        for (let c = 0; c <= totalCols; c++) {
          const val = getCellValue(r, c).toUpperCase();
          if (val === "NOME (PONTO)" || val === "NOME COMPLETO" || val === "MODALIDADE" || val === "DEPARTAMENTO") {
            foundHeader = true;
          }
        }
        if (foundHeader) {
          dataStartRow = r + 1;
          for (let c = 0; c <= totalCols; c++) {
            const val = getCellValue(r, c).toUpperCase().trim();
            if (val) headerMap.set(val, c);
          }
          break;
        }
      }

      if (dataStartRow === -1 || (!headerMap.has("NOME COMPLETO") && !headerMap.has("NOME (PONTO)"))) {
        toast.error(`Não foi possível encontrar as colunas de Nome (NOME COMPLETO ou NOME (PONTO)) nesta aba.`);
        setLoading(false);
        return;
      }

      const colNome = headerMap.get("NOME COMPLETO");
      const colNomePonto = headerMap.get("NOME (PONTO)");
      const colDepto = headerMap.get("DEPARTAMENTO") ?? headerMap.get("SETOR");
      const colModalidade = headerMap.get("MODALIDADE");
      const colPix = headerMap.get("PIX");
      const colSit = headerMap.get("SITUAÇÃO") ?? headerMap.get("SITUACAO");
      const colEmpresa = headerMap.get("EMPRESA");

      const peopleToInsertMap = new Map<string, { p: Omit<Person, "id">, sit: string }>();

      for (let r = dataStartRow; r <= totalRows; r++) {
        let name = "";
        if (colNome !== undefined) name = getCellValue(r, colNome);
        if (!name && colNomePonto !== undefined) name = getCellValue(r, colNomePonto);
        
        // Se as colunas oficiais estão vazias, mas a premissa é não perder o PIX de um nome abreviado:
        // A regra do RH manda tentar puxar da Coluna A (índice 0) brutalmente como último recurso
        if (!name) {
          const fallbackA = getCellValue(r, 0);
          if (fallbackA && fallbackA.trim().length > 2) {
             name = fallbackA;
          }
        }
        
        if (!name) continue;

        const sit = colSit !== undefined ? getCellValue(r, colSit).toLowerCase() : "";

        const dept = colDepto !== undefined ? getCellValue(r, colDepto) : "Geral";
        const mod = colModalidade !== undefined ? getCellValue(r, colModalidade) : "";
        const cPix = colPix !== undefined ? getCellValue(r, colPix) : "";
        const cEmpresa = colEmpresa !== undefined ? getCellValue(r, colEmpresa) : "";
        
        // HACK DE BANCO DE DADOS: Guardamos a empresa e o departamento na mesma coluna nativa separados por "::"
        const finalDept = cEmpresa ? `${cEmpresa}::${dept}` : dept;

        const isReg = mod.toLowerCase().includes("registrado") || mod.toLowerCase().includes("contratado") || mod.toLowerCase().includes("clt");

        const lowerName = name.toLowerCase();

        const newEntry = {
            p: { name: name.trim(), department: finalDept, isRegistered: isReg, pix: cPix, company: cEmpresa },
            sit
        };

        const existing = peopleToInsertMap.get(lowerName);
        if (!existing) {
          peopleToInsertMap.set(lowerName, newEntry);
        } else {
          // Se vamos sobrepor com uma versão ativa
          if (existing.sit !== "ativo" && sit === "ativo") {
            // Se o ativo estiver sem PIX, tenta pegar do inativo!
            if (!newEntry.p.pix && existing.p.pix) {
                newEntry.p.pix = existing.p.pix;
            }
            if (!newEntry.p.company && existing.p.company) {
                newEntry.p.company = existing.p.company;
            }
            peopleToInsertMap.set(lowerName, newEntry);
          } else {
            // Se já tem um ativo registrado (ou ambos são inativos), apenas absorve o PIX caso esteja faltando
            if (!existing.p.pix && newEntry.p.pix) {
                existing.p.pix = newEntry.p.pix;
            }
            if (!existing.p.company && newEntry.p.company) {
                existing.p.company = newEntry.p.company;
            }
          }
        }
      }

      const peopleToInsert: Omit<Person, "id">[] = Array.from(peopleToInsertMap.values()).map(item => item.p);

      if (peopleToInsert.length === 0) {
        toast.error(`Nenhum funcionário encontrado na aba "${selectedSheet}".`);
        setLoading(false);
        return;
      }

      setPendingPeople(peopleToInsert);
      setStep("preview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao processar aba: ${msg}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (pendingPeople.length === 0) return;
    setLoading(true);
    try {
      await bulkUpsertPeople.mutateAsync(pendingPeople);
      toast.success(`${pendingPeople.length} Funcionários sincronizados com sucesso!`);
      handleClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao salvar Funcionários: ${msg}`);
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
    setPendingPeople([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 font-bold uppercase tracking-widest text-[10px] h-9">
          <Upload className="h-3.5 w-3.5" /> Sincronizar Colaboradores
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Sincronizar Lista de Funcionários
          </DialogTitle>
          <DialogDescription>
            Envie a planilha de <strong>Funcionários</strong> com colunas como NOME COMPLETO, MODALIDADE, DEPARTAMENTO, PIX, EMPRESA.
          </DialogDescription>
        </DialogHeader>

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

        {step === "preview" && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                <CheckCircle2 className="h-4 w-4" />
                {pendingPeople.length} colaboradores encontrados
              </div>
              <div className="space-y-1">
                {pendingPeople.slice(0, 4).map((p, i) => (
                  <p key={i} className="text-xs text-blue-800 font-mono truncate">
                    • {p.name} {p.isRegistered ? "(CLT)" : ""} - {p.department}
                  </p>
                ))}
                {pendingPeople.length > 4 && (
                  <p className="text-xs text-blue-600 italic">...e mais {pendingPeople.length - 4} registros</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-blue-500" />
              <span>
                Colaboradores com o <strong>mesmo nome exato</strong> serão atualizados (Setor, PIX, EMPRESA, CLT). Novos nomes serão criados e adicionados.
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-between">
          {step === "idle" && (
            <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-blue-600" />
              O sistema mesclará automaticamente pelo nome.
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
                Sincronizar Agora
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
