import { useState, useEffect } from "react";
import { useDatabase } from "@/hooks/use-database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CalendarDays, Mail, Plus, Save, Settings, Share2, ShieldCheck, Smartphone, Trash2, MessageSquare, FileUp, DollarSign, Users, Clock, Briefcase } from "lucide-react";
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
    clearAllJobs
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
    } catch (error) {
      toast.error("Erro ao salvar no banco. Verifique se as novas colunas existem.");
      console.error(error);
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
        
        {/* REGRAS DE PAGAMENTO PJ */}
        <Card className="border-border shadow-md col-span-1 md:col-span-2 lg:col-span-2 border-l-4 border-l-blue-500">
           <CardHeader className="bg-blue-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><DollarSign className="h-5 w-5" /></div>
                <div>
                   <CardTitle className="text-sm font-bold uppercase">Regras de Pagamento PJ (Prestadores)</CardTitle>
                   <CardDescription className="text-xs">Fechamentos quinzenais conforme nova norma da diretoria.</CardDescription>
                </div>
              </div>
           </CardHeader>
           <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-4">
                 <p className="text-[10px] font-black uppercase text-blue-600 tracking-wider">1ª Quinzena (01 a 15)</p>
                 <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold">Dia do Pagamento</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">DIA</span>
                      <Input type="number" className="w-16 h-8 text-center" value={settings.pjPeriod1PaymentDay} onChange={(e) => setSettings({...settings, pjPeriod1PaymentDay: parseInt(e.target.value) || 19})} />
                    </div>
                 </div>
                 <p className="text-[10px] text-muted-foreground italic">Pagamento do período de 01 a 15 de cada mês.</p>
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-4">
                 <p className="text-[10px] font-black uppercase text-blue-600 tracking-wider">2ª Quinzena (16 a 31)</p>
                 <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold">Dia do Pagamento</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">DIA</span>
                      <Input type="number" className="w-16 h-8 text-center" value={settings.pjPeriod2PaymentDay} onChange={(e) => setSettings({...settings, pjPeriod2PaymentDay: parseInt(e.target.value) || 4})} />
                    </div>
                 </div>
                 <p className="text-[10px] text-muted-foreground italic">Pagamento até o 4º dia do mês subsequente.</p>
              </div>
           </CardContent>
        </Card>

        {/* REGRAS CLT */}
        <Card className="border-border shadow-md border-l-4 border-l-violet-500">
           <CardHeader className="bg-violet-50/50">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-violet-100 rounded-lg text-violet-600"><Clock className="h-5 w-5" /></div>
                 <CardTitle className="text-sm font-bold uppercase">Regras CLT</CardTitle>
              </div>
           </CardHeader>
           <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                 <Label className="text-xs font-bold">5º Dia Útil (Pago)</Label>
                 <Input type="number" className="w-16 h-8 text-center" value={settings.cltPaymentDay} onChange={(e) => setSettings({...settings, cltPaymentDay: parseInt(e.target.value) || 5})} />
              </div>
              <div className="flex items-center justify-between">
                 <Label className="text-xs font-bold">Dia 20 (Adiantamento)</Label>
                 <Input type="number" className="w-16 h-8 text-center" value={settings.cltAdvanceDay} onChange={(e) => setSettings({...settings, cltAdvanceDay: parseInt(e.target.value) || 20})} />
              </div>
              <div className="flex items-center justify-between">
                 <Label className="text-xs font-bold">Dia 20 (Fecha Folha)</Label>
                 <Input type="number" className="w-16 h-8 text-center" value={settings.cltSheetCloseDay} onChange={(e) => setSettings({...settings, cltSheetCloseDay: parseInt(e.target.value) || 20})} />
              </div>
           </CardContent>
        </Card>

        {/* WHATSAPP & EMAIL */}
        <Card className="border-border shadow-md lg:col-span-3">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
             <CardTitle className="text-sm font-bold flex items-center gap-2 font-black uppercase tracking-widest"><ShieldCheck className="h-4 w-4 text-primary" /> Canais de Notificação</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             <div className="space-y-3">
               <div className="flex items-center justify-between">
                  <Label className="text-2xs uppercase font-black text-blue-600">WhatsApp Financeiro</Label>
                  <Switch checked={settings.enableWhatsApp} onCheckedChange={(v) => setSettings({ ...settings, enableWhatsApp: v })} />
               </div>
               <Input placeholder="+55..." value={settings.financeWhatsApp || ""} onChange={(e) => setSettings({ ...settings, financeWhatsApp: e.target.value })} className="h-9" />
             </div>
             <div className="space-y-3">
                <Label className="text-2xs uppercase font-black text-orange-600">E-mails Financeiro</Label>
                <Input placeholder="financeiro@..." value={settings.financeEmails || ""} onChange={(e) => setSettings({ ...settings, financeEmails: e.target.value })} className="h-9" />
             </div>
             <div className="space-y-3">
                <Label className="text-2xs uppercase font-black text-violet-600">WhatsApp RH</Label>
                <Input placeholder="+55..." value={settings.hrWhatsApp || ""} onChange={(e) => setSettings({ ...settings, hrWhatsApp: e.target.value })} className="h-9" />
             </div>
             <div className="space-y-3">
                <Label className="text-2xs uppercase font-black text-pink-600">E-mails RH</Label>
                <Input placeholder="rh@..." value={settings.hrEmails || ""} onChange={(e) => setSettings({ ...settings, hrEmails: e.target.value })} className="h-9" />
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
