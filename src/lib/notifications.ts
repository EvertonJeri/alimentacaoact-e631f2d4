import { type SystemSettings, DEFAULT_SETTINGS } from "./types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "act_system_settings";
let _systemSettings: SystemSettings | null = null;

export const setGlobalSettings = (settings: SystemSettings) => {
  _systemSettings = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const getStoredSettings = (): SystemSettings => {
  if (_systemSettings) return _systemSettings;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
};

export const fetchSettingsFromDB = async (): Promise<SystemSettings> => {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .eq("id", "default")
      .single();
    
    if (error || !data) return getStoredSettings();

    return {
      enableTeams: data.enable_teams,
      teamsWebhookUrl: data.teams_webhook_url,
      enableWhatsApp: data.enable_whatsapp,
      managerWhatsApp: data.manager_whatsapp,
      enableEmail: data.enable_email,
      adminEmails: data.admin_emails,
      financeWhatsApp: data.finance_whatsapp,
      financeEmails: data.finance_emails,
      hrWhatsApp: data.hr_whatsapp,
      hrEmails: data.hr_emails,
      discountAlertDate: data.discount_alert_date,
      discountAutoSend: data.discount_auto_send,
    };
  } catch {
    return getStoredSettings();
  }
};

export const sendTeamsNotification = async (title: string, message: string, color: string = "0078D4") => {
  const settings = getStoredSettings();
  if (!settings.enableTeams || !settings.teamsWebhookUrl) {
    console.warn("[ACT] Teams desativado ou sem webhook configurado.");
    return;
  }

  try {
    const payload = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": color,
      "summary": title,
      "sections": [{
        "activityTitle": title,
        "activitySubtitle": new Date().toLocaleString('pt-BR'),
        "text": message,
        "markdown": true
      }]
    };

    await fetch(settings.teamsWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    toast.success("📨 Teams: Notificação enviada!", { duration: 4000 });
  } catch (error) {
    console.error("[ACT] Erro ao enviar para o Teams:", error);
    toast.error("❌ Teams: Falha ao enviar. Verifique o Webhook.");
  }
};

export const sendWhatsAppMessage = (message: string, phoneNumber?: string, settingsOverride?: SystemSettings) => {
  const settings = settingsOverride || getStoredSettings();
  if (!settings.enableWhatsApp) return;

  const target = phoneNumber || settings.managerWhatsApp;
  if (!target) {
    toast.error("WhatsApp: Número não configurado nas Configurações de Alerta.");
    return;
  }

  const cleanPhone = target.replace(/\D/g, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  toast.success("📲 WhatsApp: Conversa aberta!", { duration: 3000 });
};

export const sendEmailNotification = (subject: string, body: string, emailsOverride?: string, settingsOverride?: SystemSettings) => {
  const settings = settingsOverride || getStoredSettings();
  const emailTarget = emailsOverride || settings.adminEmails;
  
  if (!settings.enableEmail || !emailTarget) {
    toast.error("E-mail: Nenhum e-mail configurado nas Configurações de Alerta.");
    return;
  }

  const emails = emailTarget.split(",").map(e => e.trim()).filter(Boolean);
  if (emails.length === 0) return;

  const mailtoUrl = `mailto:${emails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoUrl, '_self');
  toast.success("📧 E-mail: Cliente de e-mail aberto!", { duration: 3000 });
};

// ===== Notificações específicas para Financeiro =====
export const notifyFinancePayment = async (details: string) => {
  const settings = await fetchSettingsFromDB();
  
  const message = `💰 *NOVO PAGAMENTO REGISTRADO*\n\n${details}\n\n📅 ${new Date().toLocaleString('pt-BR')}`;
  
  // WhatsApp para financeiro
  if (settings.enableWhatsApp && settings.financeWhatsApp) {
    sendWhatsAppMessage(message, settings.financeWhatsApp, settings);
  }
  
  // Email para financeiro
  if (settings.enableEmail && settings.financeEmails) {
    sendEmailNotification(
      "ACT - Novo Pagamento Registrado",
      details.replace(/\*/g, '').replace(/\n/g, '\r\n'),
      settings.financeEmails,
      settings
    );
  }

  // Teams
  if (settings.enableTeams && settings.teamsWebhookUrl) {
    await sendTeamsNotification("💰 Novo Pagamento Registrado", details.replace(/\*/g, '**'), "28A745");
  }
};

// ===== Alertas de Desconto para RH =====
export const notifyHRDiscounts = async (details: string) => {
  const settings = await fetchSettingsFromDB();
  
  const message = `📋 *ALERTA DE DESCONTOS - RH*\n\n${details}\n\n📅 ${new Date().toLocaleString('pt-BR')}`;
  
  if (settings.enableWhatsApp && settings.hrWhatsApp) {
    sendWhatsAppMessage(message, settings.hrWhatsApp, settings);
  }
  
  if (settings.enableEmail && settings.hrEmails) {
    sendEmailNotification(
      "ACT - Relatório de Descontos para RH",
      details.replace(/\*/g, '').replace(/\n/g, '\r\n'),
      settings.hrEmails,
      settings
    );
  }

  if (settings.enableTeams && settings.teamsWebhookUrl) {
    await sendTeamsNotification("📋 Alerta de Descontos - RH", details.replace(/\*/g, '**'), "7B2BFC");
  }
};

// ===== Verificar se hoje é dia de alerta de desconto =====
export const checkDiscountAlertDate = async (): Promise<boolean> => {
  const settings = await fetchSettingsFromDB();
  const today = new Date().getDate();
  return today === (settings.discountAlertDate || 25);
};

export const shouldAutoSendDiscounts = async (): Promise<boolean> => {
  const settings = await fetchSettingsFromDB();
  const today = new Date().getDate();
  return today === (settings.discountAlertDate || 25) && (settings.discountAutoSend || false);
};
