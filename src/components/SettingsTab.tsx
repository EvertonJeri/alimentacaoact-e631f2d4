import { useState, useEffect } from "react";
import { useDatabase } from "@/hooks/use-database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, CalendarDays, Plus, Save, Settings, ShieldCheck, Trash2, X, AlertTriangle, CreditCard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { JobImportDialog } from "./JobImportDialog";
import { PersonImportDialog } from "./PersonImportDialog";
import { type SystemSettings, DEFAULT_SETTINGS } from "@/lib/types";
import {
  BRAZIL_NATIONAL_HOLIDAYS,
  type Holiday,
} from "@/lib/holidays";

export const SettingsTab = () => {
  const { 
    systemSettings, 
    customHolidays: dbHolidays, 
    updateSystemSettings, 
    updateCustomHolidays,
    clearAllJobs,
    people,
    jobs,
    timeEntries,
    requests: mealRequests,
    updateTimeEntries,
    updateMealRequests,
    repairHistoricalData
  } = useDatabase();

  const [settings, setSettings] = useState<SystemSettings>(() => {
    const localFlash = (() => {
      try { return JSON.parse(localStorage.getItem("act_flash_card_users") || "[]"); } 
      catch { return []; }
    })();
    return { ...DEFAULT_SETTINGS, flashCardUsers: localFlash };
  });
  const [customHolidays, setCustomHolidays] = useState<Holiday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  useEffect(() => {
    if (systemSettings.data) {
      const dbData = systemSettings.data;
      const localFlash = (() => {
        try { return JSON.parse(localStorage.getItem("act_flash_card_users") || "[]"); } 
        catch { return []; }
      })();

      // Se o banco trouxer vazio, tentamos o local
      setSettings({
        ...dbData,
        flashCardUsers: (dbData.flashCardUsers && dbData.flashCardUsers.length > 0) ? dbData.flashCardUsers : localFlash
      });
    }
  }, [systemSettings.data]);

  useEffect(() => {
    if (dbHolidays.data) {
      setCustomHolidays(dbHolidays.data);
    }
  }, [dbHolidays.data]);

  // SINCRONIZAÇÃO EM TEMPO REAL COM O NAVEGADOR (Resiliência Máxima)
  useEffect(() => {
    if (settings.flashCardUsers && settings.flashCardUsers.length > 0) {
      localStorage.setItem("act_flash_card_users", JSON.stringify(settings.flashCardUsers));
    }
  }, [settings.flashCardUsers]);

  const handleSave = async () => {
    try {
      // 1. Persistência de Emergência Local para o Cartão Flash
      if (settings.flashCardUsers) {
        localStorage.setItem("act_flash_card_users", JSON.stringify(settings.flashCardUsers));
        console.log("Flash Card Users salvos localmente!", settings.flashCardUsers);
      }

      // 2. Persistência Principal (Banco)
      await updateSystemSettings.mutateAsync(settings);
      await updateCustomHolidays.mutateAsync(customHolidays);
      
      toast.success("Configurações salvas com sucesso!");
    } catch (error: any) {
      const msg = (error?.message || "").toLowerCase();
      // O hook já faz o fallback de colunas, aqui apenas avisamos se salvou parcialmente
      if (msg.includes("column") || msg.includes("coluna") || msg.includes("schema")) {
        toast.warning("Configurações salvas (com fallback de colunas desatualizadas).");
      } else {
        toast.error(`Erro ao salvar: ${error.message || "Verifique sua conexão."}`);
      }
    }
  };

  const addCustomHoliday = () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      toast.error("Preencha a data e o nome do feriado.");
      return;
    }
    const updated = [...customHolidays, { date: newHolidayDate, name: newHolidayName.trim(), type: 'custom' as const }];
    setCustomHolidays(updated);
    setNewHolidayDate("");
    setNewHolidayName("");
  };

  const removeCustomHoliday = (date: string) => {
    setCustomHolidays(prev => prev.filter(h => h.date !== date));
  };

  // ----- RESGATE DE ÓRFÃOS LÓGICA ----- //
  const [orphanMappings, setOrphanMappings] = useState<Record<string, string>>({});
  
  const orphanIds = Object.keys([...(timeEntries.data || []), ...(mealRequests.data || [])].reduce((acc: any, curr: any) => {
    if (curr.jobId && jobs.data && !jobs.data.find(j => j.id === curr.jobId)) acc[curr.jobId] = true;
    return acc;
  }, {}));

  const handleFixOrphans = async () => {
    const mappedEntries = (timeEntries.data || [])
      .filter(e => e.jobId && orphanMappings[e.jobId])
      .map(e => ({...e, jobId: orphanMappings[e.jobId!]}));
      
    const mappedReqs = (mealRequests.data || [])
      .filter(r => r.jobId && orphanMappings[r.jobId])
      .map(r => ({...r, jobId: orphanMappings[r.jobId!]}));
      
    if (mappedEntries.length) await updateTimeEntries.mutateAsync(mappedEntries as any);
    if (mappedReqs.length) await updateMealRequests.mutateAsync(mappedReqs as any);
    
    toast.success(`${mappedEntries.length + mappedReqs.length} registros recuperados com sucesso!`);
    setOrphanMappings({});
  };
  // ------------------------------------ //

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-3 mb-2">
        <Settings className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-black uppercase tracking-widest text-foreground">Configurações do Sistema</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* DIAS DE ALERTA CLT/PJ */}
        <Card className="border-border shadow-md col-span-1 md:col-span-2 border-l-4 border-l-blue-500">
           <CardHeader className="bg-blue-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Bell className="h-5 w-5" /></div>
                <div>
                   <CardTitle className="text-sm font-bold uppercase">Dias de Alerta de Pagamento</CardTitle>
                   <CardDescription className="text-xs">Configure os dias do mês para receber alertas de fechamento/pagamento.</CardDescription>
                </div>
              </div>
           </CardHeader>
           <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-4">
                 <p className="text-[10px] font-black uppercase text-violet-600 tracking-wider">CLT</p>
                 <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold">Dia do Alerta 1</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">DIA</span>
                      <Input type="number" min={1} max={31} className="w-16 h-8 text-center" value={settings.cltAlertDay ?? 5} onChange={(e) => setSettings({...settings, cltAlertDay: parseInt(e.target.value) || 5})} />
                    </div>
                 </div>
                 <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold">Dia do Alerta 2</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">DIA</span>
                      <Input type="number" min={1} max={31} className="w-16 h-8 text-center" value={settings.cltAlertDay2 ?? 20} onChange={(e) => setSettings({...settings, cltAlertDay2: parseInt(e.target.value) || 20})} />
                    </div>
                 </div>
                 <p className="text-[10px] text-muted-foreground italic">Alertas nos dias de fechamento/pagamento CLT.</p>
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-4">
                 <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">PJ (Prestadores)</p>
                 <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold">Dia do Alerta 1</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">DIA</span>
                      <Input type="number" min={1} max={31} className="w-16 h-8 text-center" value={settings.pjAlertDay ?? 19} onChange={(e) => setSettings({...settings, pjAlertDay: parseInt(e.target.value) || 19})} />
                    </div>
                 </div>
                 <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold">Dia do Alerta 2</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">DIA</span>
                      <Input type="number" min={1} max={31} className="w-16 h-8 text-center" value={settings.pjAlertDay2 ?? 4} onChange={(e) => setSettings({...settings, pjAlertDay2: parseInt(e.target.value) || 4})} />
                    </div>
                 </div>
                 <p className="text-[10px] text-muted-foreground italic">Alertas nos dias de fechamento/pagamento PJ.</p>
              </div>
           </CardContent>
        </Card>


        {/* CANAIS DE NOTIFICAÇÃO - 3 tipos */}
        <Card className="border-border shadow-md lg:col-span-3">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
             <CardTitle className="text-sm font-bold flex items-center gap-2 font-black uppercase tracking-widest"><ShieldCheck className="h-4 w-4 text-primary" /> Canais de Notificação</CardTitle>
             <CardDescription className="text-xs">Configure WhatsApp e E-mail para cada setor. Confirmações de pagamento e desconto são direcionadas ao Administrador.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
             <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold">Habilitar WhatsApp</Label>
                <Switch checked={settings.enableWhatsApp} onCheckedChange={(v) => setSettings({ ...settings, enableWhatsApp: v })} />
             </div>
             <div className="flex items-center justify-between mb-4">
                <Label className="text-xs font-bold">Habilitar E-mail</Label>
                <Switch checked={settings.enableEmail} onCheckedChange={(v) => setSettings({ ...settings, enableEmail: v })} />
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ADMINISTRADOR */}
                <div className="p-4 rounded-xl bg-primary/5 border-2 border-primary/20 space-y-3">
                   <p className="text-[10px] font-black uppercase text-primary tracking-wider">🔑 Administrador (Alimentação)</p>
                   <p className="text-[9px] text-muted-foreground italic">Recebe confirmações de pagamento e desconto.</p>
                   <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">WhatsApp</Label>
                      <Input placeholder="+55..." value={settings.adminWhatsApp || ""} onChange={(e) => setSettings({ ...settings, adminWhatsApp: e.target.value })} className="h-9" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">E-mail(s)</Label>
                      <Input placeholder="admin@..." value={settings.adminEmails || ""} onChange={(e) => setSettings({ ...settings, adminEmails: e.target.value })} className="h-9" />
                   </div>
                </div>

                {/* FINANCEIRO */}
                <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
                   <p className="text-[10px] font-black uppercase text-orange-600 tracking-wider">💼 Financeiro</p>
                   <p className="text-[9px] text-muted-foreground italic">Recebe alertas de novos lançamentos.</p>
                   <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">WhatsApp</Label>
                      <Input placeholder="+55..." value={settings.financeWhatsApp || ""} onChange={(e) => setSettings({ ...settings, financeWhatsApp: e.target.value })} className="h-9" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">E-mail(s)</Label>
                      <Input placeholder="financeiro@..." value={settings.financeEmails || ""} onChange={(e) => setSettings({ ...settings, financeEmails: e.target.value })} className="h-9" />
                   </div>
                </div>

                {/* RH */}
                <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
                   <p className="text-[10px] font-black uppercase text-violet-600 tracking-wider">👥 RH</p>
                   <p className="text-[9px] text-muted-foreground italic">Recebe relatórios de descontos.</p>
                   <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">WhatsApp</Label>
                      <Input placeholder="+55..." value={settings.hrWhatsApp || ""} onChange={(e) => setSettings({ ...settings, hrWhatsApp: e.target.value })} className="h-9" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">E-mail(s)</Label>
                      <Input placeholder="rh@..." value={settings.hrEmails || ""} onChange={(e) => setSettings({ ...settings, hrEmails: e.target.value })} className="h-9" />
                   </div>
                </div>
             </div>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t border-border flex flex-wrap justify-between items-center py-4 gap-4">
             <div className="flex flex-wrap gap-3">
               <JobImportDialog />
               <PersonImportDialog />
              </div>
             <Button onClick={handleSave} className="font-black uppercase tracking-widest text-[10px] px-8 h-10 shadow-lg gap-2">
               <Save className="h-4 w-4" /> Salvar Configurações
             </Button>
          </CardFooter>
        </Card>

        {/* CARTÃO FLASH */}
        <Card className="border-border shadow-md lg:col-span-3 border-l-4 border-l-amber-500">
          <CardHeader className="bg-amber-50/50 border-b border-border py-4">
             <CardTitle className="text-sm font-bold flex items-center gap-2 font-black uppercase tracking-widest"><CreditCard className="h-4 w-4 text-amber-600" /> Profissionais Cartão Flash</CardTitle>
             <CardDescription className="text-xs">Pessoas nesta lista serão identificadas na aba de pagamentos para recebimento via Cartão Flash (RH).</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
             <div className="flex gap-3">
                <div className="flex-1">
                   <SearchableSelect
                      options={people.data?.filter(p => !(settings.flashCardUsers || []).includes(p.id)).map(p => ({ value: p.id, label: p.name })) || []}
                      onValueChange={(val) => {
                        if (val && !(settings.flashCardUsers || []).includes(val)) {
                           setSettings({ ...settings, flashCardUsers: [...(settings.flashCardUsers || []), val] });
                        }
                      }}
                      placeholder="Adicionar profissional..."
                   />
                </div>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {(settings.flashCardUsers || []).map(pid => {
                   const p = people.data?.find(pers => pers.id === pid);
                   return (
                      <div key={pid} className="flex items-center justify-between p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs">
                         <span className="font-bold text-amber-900 truncate pr-2">{p?.name || pid}</span>
                         <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 text-amber-700 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setSettings({ ...settings, flashCardUsers: settings.flashCardUsers?.filter(id => id !== pid) })}
                         >
                            <X className="h-3 w-3" />
                         </Button>
                      </div>
                   );
                })}
                {(settings.flashCardUsers || []).length === 0 && (
                   <p className="text-[10px] text-muted-foreground italic col-span-full py-4 text-center">Nenhum profissional na lista do Cartão Flash.</p>
                )}
             </div>
          </CardContent>
        </Card>

        {/* FERIADOS */}
        <Card className="border-border shadow-md lg:col-span-3">
          <CardHeader className="bg-muted/30 border-b border-border">
              <div className="flex items-center gap-3">
                 <CalendarDays className="h-5 w-5 text-purple-600" />
                 <CardTitle className="text-sm font-bold uppercase">Feriados e Datas Especiais</CardTitle>
              </div>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="space-y-4">
                <div className="flex gap-2">
                   <Input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} />
                   <Input placeholder="Nome do Feriado" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} />
                   <Button onClick={addCustomHoliday} size="icon"><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                   {customHolidays.map(h => (
                     <div key={h.date} className="flex items-center justify-between text-xs p-2 bg-purple-50 rounded border border-purple-100">
                        <span>{h.date.split("-").reverse().join("/")} - {h.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeCustomHoliday(h.date)}><Trash2 className="h-3 w-3" /></Button>
                     </div>
                   ))}
                </div>
             </div>
             <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto text-[10px] text-muted-foreground p-2 bg-muted/10 rounded-lg">
                {BRAZIL_NATIONAL_HOLIDAYS.map(h => <div key={h.date} className="flex gap-2"><strong>{h.date.split("-").reverse().join("/")}:</strong> {h.name}</div>)}
             </div>
          </CardContent>
        </Card>

        {/* RESGATE DE PROJETOS ÓRFÃOS */}
        {orphanIds.length > 0 && (
          <Card className="border-red-200 shadow-md lg:col-span-3 bg-red-50/50">
            <CardHeader className="bg-red-100/50 border-b border-red-200">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-sm font-bold uppercase text-red-800">Projetos Órfãos Detectados ({orphanIds.length})</CardTitle>
                </div>
                <CardDescription className="text-xs text-red-700">
                  Alguns registros de horas estão apontando para IDs de Jobs que foram apagados. Selecione qual Job atual corresponde a cada ID para resgatar essas horas.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 max-h-[400px] overflow-y-auto">
                {orphanIds.map(oId => (
                  <div key={oId} className="flex flex-col sm:flex-row gap-3 items-center p-3 bg-white border border-red-100 rounded-lg">
                    <div className="text-xs font-mono bg-red-100 text-red-800 px-2 py-1 rounded">
                       ID: {oId.substring(0,8)}...
                    </div>
                    <div className="flex-1 w-full">
                       <SearchableSelect
                         options={jobs.data?.map(j => ({ value: j.id, label: j.name })) || []}
                         value={orphanMappings[oId]}
                         onValueChange={(val) => setOrphanMappings(m => ({...m, [oId]: val}))}
                         placeholder="Selecione o Job correspondente..."
                         searchPlaceholder="Buscar Job..."
                       />
                    </div>
                  </div>
                ))}
            </CardContent>
            {Object.keys(orphanMappings).length > 0 && (
              <CardFooter className="bg-red-100/30 border-t border-red-200 py-3">
                 <Button onClick={handleFixOrphans} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest text-xs">
                    Salvar Resgate de {Object.keys(orphanMappings).length} Projetos
                 </Button>
              </CardFooter>
            )}
          </Card>
        )}

      </div>
    </div>
  );
};

export default SettingsTab;
