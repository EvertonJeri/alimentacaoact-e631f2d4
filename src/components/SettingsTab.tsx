import { useState, useEffect } from "react";
import { useDatabase } from "@/hooks/use-database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CalendarDays, Mail, Plus, Save, Settings, Share2, ShieldCheck, Smartphone, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
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
    updateCustomHolidays 
  } = useDatabase();

  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [customHolidays, setCustomHolidays] = useState<Holiday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  // Sync state with database data when it loads
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
      toast.success("Configurações salvas no banco de dados!", { duration: 5000 });
    } catch (error) {
      toast.error("Erro ao salvar no banco de dados.");
      console.error(error);
    }
  };

  const addCustomHoliday = () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      toast.error("Preencha a data e o nome do feriado.");
      return;
    }
    const exists = [...BRAZIL_NATIONAL_HOLIDAYS, ...customHolidays].some(h => h.date === newHolidayDate);
    if (exists) {
      toast.error("Já existe um feriado nessa data.");
      return;
    }
    const updated = [...customHolidays, { date: newHolidayDate, name: newHolidayName.trim(), type: 'custom' as const }];
    setCustomHolidays(updated);
    setNewHolidayDate("");
    setNewHolidayName("");
    toast.success("Feriado adicionado! Clique em Salvar para confirmar.");
  };

  const removeCustomHoliday = (date: string) => {
    setCustomHolidays(prev => prev.filter(h => h.date !== date));
    toast.info("Feriado removido. Clique em Salvar para confirmar.");
  };

  const fDate = (d: string) => d.includes("-") ? d.split("-").reverse().join("/") : d;

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-2">
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-black uppercase tracking-widest text-foreground">Configurações do Sistema</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TEAMS */}
        <Card className="border-border shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <Smartphone className="h-5 w-5" />
                </div>
                <CardTitle className="text-sm font-bold uppercase tracking-tight">Microsoft Teams</CardTitle>
              </div>
              <Switch checked={settings.enableTeams} onCheckedChange={(v) => setSettings({ ...settings, enableTeams: v })} />
            </div>
            <CardDescription className="text-xs">Alertas operacionais enviados em tempo real para o seu canal.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-2xs uppercase font-black text-muted-foreground">Webhook URL do Canal</Label>
              <Input placeholder="https://outlook.office.com/webhook/..." value={settings.teamsWebhookUrl || ""} onChange={(e) => setSettings({ ...settings, teamsWebhookUrl: e.target.value })} className="bg-muted/20" />
              <p className="text-[10px] text-muted-foreground italic">Use o conector "Incoming Webhook" do Teams.</p>
            </div>
          </CardContent>
        </Card>

        {/* WHATSAPP */}
        <Card className="border-border shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg text-green-600">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <CardTitle className="text-sm font-bold uppercase tracking-tight">WhatsApp Gestão</CardTitle>
              </div>
              <Switch checked={settings.enableWhatsApp} onCheckedChange={(v) => setSettings({ ...settings, enableWhatsApp: v })} />
            </div>
            <CardDescription className="text-xs">Número mestre para recebimento de comprovantes e acertos.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-2xs uppercase font-black text-muted-foreground">Número de WhatsApp</Label>
              <Input placeholder="+55 11 99999-9999" value={settings.managerWhatsApp} onChange={(e) => setSettings({ ...settings, managerWhatsApp: e.target.value })} className="bg-muted/20" />
            </div>
          </CardContent>
        </Card>

        {/* EMAIL */}
        <Card className="border-border shadow-md md:col-span-2">
          <CardHeader className="bg-muted/30 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                  <Mail className="h-5 w-5" />
                </div>
                <CardTitle className="text-sm font-bold uppercase tracking-tight">E-mail Administrativo</CardTitle>
              </div>
              <Switch checked={settings.enableEmail} onCheckedChange={(v) => setSettings({ ...settings, enableEmail: v })} />
            </div>
            <CardDescription className="text-xs">Notificações formais de pagamentos realizados e descontos aplicados.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-2xs uppercase font-black text-muted-foreground">E-mails para Alertas</Label>
              <Input placeholder="financeiro@empresa.com.br, rh@empresa.com.br" value={settings.adminEmails || ""} onChange={(e) => setSettings({ ...settings, adminEmails: e.target.value })} className="bg-muted/20" />
              <p className="text-[10px] text-muted-foreground italic">Adicione quantos e-mails quiser, separados por vírgula.</p>
            </div>
            <div className="flex items-end pt-2">
              <div className="text-[10px] bg-muted/40 p-3 rounded-lg border border-border flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Abrange todos os destinatários em um único envio ao confirmar pagamento ou desconto.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FERIADOS */}
        <Card className="border-border shadow-md md:col-span-2">
          <CardHeader className="bg-muted/30 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-tight">Gestão de Feriados</CardTitle>
                <CardDescription className="text-xs mt-1">CLT que trabalha em feriado tem direito ao almoço (igual ao final de semana). Adicione feriados municipais ou estaduais abaixo.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Adicionar Feriado Customizado */}
            <div className="flex gap-3 items-end">
              <div className="space-y-2 flex-1">
                <Label className="text-2xs uppercase font-black text-muted-foreground">Data do Feriado</Label>
                <Input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} className="bg-muted/20 h-10" />
              </div>
              <div className="space-y-2 flex-[2]">
                <Label className="text-2xs uppercase font-black text-muted-foreground">Nome do Feriado</Label>
                <Input placeholder="Ex: Aniversário da Cidade" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} className="bg-muted/20 h-10" />
              </div>
              <Button onClick={addCustomHoliday} className="h-10 gap-2 shrink-0">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>

            {/* Feriados Customizados */}
            {customHolidays.length > 0 && (
              <div>
                <h4 className="text-xs uppercase font-black text-muted-foreground mb-3">Feriados Adicionados por Você</h4>
                <div className="space-y-2">
                  {customHolidays.sort((a, b) => a.date.localeCompare(b.date)).map(h => (
                    <div key={h.date} className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-50 border border-purple-200">
                      <div className="flex items-center gap-3">
                        <span className="text-xs tabular-nums font-bold text-purple-700">{fDate(h.date)}</span>
                        <span className="text-xs text-foreground">{h.name}</span>
                        <Badge className="text-[9px] bg-purple-100 text-purple-600 border-purple-200">Personalizado</Badge>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeCustomHoliday(h.date)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feriados Nacionais */}
            <div>
              <h4 className="text-xs uppercase font-black text-muted-foreground mb-3">Feriados Nacionais (Automáticos)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {BRAZIL_NATIONAL_HOLIDAYS.sort((a, b) => a.date.localeCompare(b.date)).map(h => (
                  <div key={h.date} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/20 border border-border">
                    <span className="text-xs tabular-nums font-bold text-muted-foreground w-20 shrink-0">{fDate(h.date)}</span>
                    <span className="text-xs text-foreground truncate">{h.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t border-border py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Configurações Gerais do Sistema</span>
            </div>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] h-9 px-6 gap-2 shadow-md">
              <Save className="h-3.5 w-3.5" /> Salvar Configurações
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default SettingsTab;
