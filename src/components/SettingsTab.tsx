import { useState, useEffect } from "react";
import { useDatabase } from "@/hooks/use-database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, CalendarDays, Plus, Save, Settings, ShieldCheck, Trash2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    people
  } = useDatabase();

  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [customHolidays, setCustomHolidays] = useState<Holiday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  useEffect(() => {
    if (systemSettings.data) {
      setSettings(systemSettings.data);
    }
  }, [systemSettings.data]);

  useEffect(() => {
    if (dbHolidays.data) {
      setCustomHolidays(dbHolidays.data);
    }
  }, [dbHolidays.data]);

  const handleSave = async () => {
    try {
      await updateSystemSettings.mutateAsync(settings);
      await updateCustomHolidays.mutateAsync(customHolidays);
      toast.success("Configurações salvas!", { duration: 5000 });
    } catch (error: any) {
      // Se o erro mencionar coluna inexistente (flash_card_users pode não existir no banco)
      const msg = error?.message || error?.details || JSON.stringify(error) || "";
      const isColumnError = msg.toLowerCase().includes("column") || msg.toLowerCase().includes("coluna") || msg.toLowerCase().includes("schema");

      if (isColumnError) {
        // Tenta salvar sem flash_card_users
        try {
          const { flashCardUsers: _, ...settingsWithout } = settings as any;
          await updateSystemSettings.mutateAsync(settingsWithout);
          await updateCustomHolidays.mutateAsync(customHolidays);
          toast.success("Configurações salvas! (coluna flash_card_users não encontrada no banco — execute a migration)", { duration: 7000 });
        } catch (err2: any) {
          const msg2 = err2?.message || err2?.details || JSON.stringify(err2) || "Erro desconhecido";
          toast.error(`Erro ao salvar: ${msg2}`);
          console.error(err2);
        }
      } else {
        toast.error(`Erro ao salvar: ${msg || "Verifique o console para detalhes."}`);
        console.error(error);
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

        {/* REGRAS ESPECIAIS / CARTÃO FLASH */}
        <Card className="border-border shadow-md lg:col-span-3">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
             <CardTitle className="text-sm font-bold flex items-center gap-2 font-black uppercase tracking-widest">💳 Regras de Pagamento</CardTitle>
             <CardDescription className="text-xs">Profissionais PJ (avulsos) que recebem via Cartão Flash ⚡ em vez de Pix.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
             <div className="space-y-3">
               <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Profissionais PJ com Cartão Flash ⚡</Label>
               {/* Linha de adição — só mostra PJ que ainda não estão na lista */}
               <div className="flex gap-2">
                 <Select
                   value=""
                   onValueChange={(id) => {
                     if (!id) return;
                     const arr = settings.flashCardUsers || [];
                     if (!arr.includes(id)) {
                       setSettings({ ...settings, flashCardUsers: [...arr, id] });
                     }
                   }}
                 >
                   <SelectTrigger className="flex-1 h-9 text-xs">
                     <SelectValue placeholder="Selecione um profissional PJ para adicionar..." />
                   </SelectTrigger>
                   <SelectContent>
                     {people.data
                       ?.filter(p => !p.isRegistered && !(settings.flashCardUsers || []).includes(p.id))
                       .map(p => (
                         <SelectItem key={p.id} value={p.id} className="text-xs">
                           {p.name} {p.department ? `· ${p.department}` : ''}
                         </SelectItem>
                       ))}
                     {(people.data || []).filter(p => !p.isRegistered && !(settings.flashCardUsers || []).includes(p.id)).length === 0 && (
                       <div className="text-xs text-muted-foreground px-3 py-2 italic">Nenhum profissional PJ disponível para adicionar.</div>
                     )}
                   </SelectContent>
                 </Select>
               </div>
               {/* Lista de tags */}
               <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border rounded-xl bg-muted/10">
                 {(!settings.flashCardUsers || settings.flashCardUsers.length === 0) && (
                   <span className="text-xs text-muted-foreground italic self-center">Nenhum profissional PJ com Cartão Flash cadastrado.</span>
                 )}
                 {(settings.flashCardUsers || []).map(id => {
                   const person = people.data?.find(p => p.id === id);
                   if (!person) return null;
                   return (
                     <span
                       key={id}
                       className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700 border border-orange-200"
                     >
                       ⚡ {person.name}
                       <button
                         type="button"
                         onClick={() => setSettings({ ...settings, flashCardUsers: (settings.flashCardUsers || []).filter(uid => uid !== id) })}
                         className="ml-1 rounded-full hover:bg-orange-200 p-0.5 transition-colors"
                         title="Remover"
                       >
                         <X className="h-3 w-3" />
                       </button>
                     </span>
                   );
                 })}
               </div>
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
          <CardFooter className="bg-muted/10 border-t border-border flex justify-between items-center py-4">
             <div className="flex gap-4">
               <JobImportDialog />
               <PersonImportDialog />
             </div>
             <Button onClick={handleSave} className="font-black uppercase tracking-widest text-[10px] px-8 h-10 shadow-lg gap-2">
               <Save className="h-4 w-4" /> Salvar Configurações
             </Button>
          </CardFooter>
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

      </div>
    </div>
  );
};

export default SettingsTab;
