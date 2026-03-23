import { type SystemSettings, DEFAULT_SETTINGS } from "./types";
import { toast } from "sonner";

const STORAGE_KEY = "act_system_settings";
let _systemSettings: SystemSettings | null = null;

export const setGlobalSettings = (settings: SystemSettings) => {
  _systemSettings = settings;
  // Fallback no localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const getStoredSettings = (): SystemSettings => {
  if (_systemSettings) return _systemSettings;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
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

export const sendWhatsAppMessage = (message: string, phoneNumber?: string) => {
  const settings = getStoredSettings();
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

export const sendEmailNotification = (subject: string, body: string) => {
  const settings = getStoredSettings();
  if (!settings.enableEmail || !settings.adminEmails) {
    toast.error("E-mail: Nenhum e-mail configurado nas Configurações de Alerta.");
    return;
  }

  const emails = settings.adminEmails.split(",").map(e => e.trim()).filter(Boolean);
  if (emails.length === 0) return;

  const mailtoUrl = `mailto:${emails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoUrl, '_self');
  toast.success("📧 E-mail: Cliente de e-mail aberto!", { duration: 3000 });
};
