import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  type Person, 
  type Job, 
  type MealRequest, 
  type TimeEntry, 
  type FoodControlEntry, 
  type PaymentConfirmation, 
  type SystemSettings,
  DEFAULT_SETTINGS
} from "@/lib/types";
import { type Holiday } from "@/lib/holidays";

export const useDatabase = () => {
  const queryClient = useQueryClient();

  const people = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*").order("name");
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        department: p.department || "",
        isRegistered: p.is_registered || false,
        pix: p.pix || "",
      })) as Person[];
    },
  });

  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").order("name").limit(10000);
      if (error) throw error;
      return data as Job[];
    },
  });

  const requests = useQuery({
    queryKey: ["meal_requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meal_requests").select("*").order("start_date", { ascending: false }).limit(5000);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        personId: r.person_id,
        jobId: r.job_id,
        startDate: r.start_date,
        endDate: r.end_date,
        meals: r.meals,
        location: r.location,
        dailyOverrides: r.daily_overrides,
      })) as MealRequest[];
    },
  });

  const timeEntries = useQuery({
    queryKey: ["time_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .order("date", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []).map((e: any) => ({
        id: e.id,
        personId: e.person_id,
        jobId: e.job_id,
        date: e.date,
        entry1: e.entry1 || "",
        exit1: e.exit1 || "",
        entry2: e.entry2 || "",
        exit2: e.exit2 || "",
        entry3: e.entry3 || "",
        exit3: e.exit3 || "",
        isTravelOut: e.is_travel_out,
        isTravelReturn: e.is_travel_return,
        isAutoFilled: e.is_auto_filled,
      })) as TimeEntry[];
    },
  });

  const foodControl = useQuery({
    queryKey: ["food_control"],
    queryFn: async () => {
      const { data, error } = await supabase.from("food_control").select("*").order("date", { ascending: false }).limit(5000);
      if (error) throw error;
      
      const grouped = (data || []).reduce((acc: any, f: any) => {
        const key = `${f.person_id}-${f.job_id}-${f.date}`;
        if (!acc[key]) {
          acc[key] = {
            id: f.id, personId: f.person_id, jobId: f.job_id, date: f.date,
            usedCafe: false, usedAlmoco: false, usedJanta: false,
            requestedCafe: false, requestedAlmoco: false, requestedJanta: false
          };
        }
        
        const isUsed = f.status === 'consumed';
        if (f.meal_type === 'cafe') acc[key].usedCafe = isUsed;
        if (f.meal_type === 'almoco') acc[key].usedAlmoco = isUsed;
        if (f.meal_type === 'janta') acc[key].usedJanta = isUsed;
        
        return acc;
      }, {});
      
      return Object.values(grouped) as FoodControlEntry[];
    },
  });

  const paymentConfirmations = useQuery({
    queryKey: ["payment_confirmations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_confirmations").select("*");
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        type: c.type,
        paymentDate: c.payment_date,
        confirmed: c.confirmed,
        applyBalance: c.apply_balance,
        appliedBalance: c.applied_balance
      })) as PaymentConfirmation[];
    },
  });

  const discountConfirmations = useQuery({
    queryKey: ["discount_confirmations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("discount_confirmations").select("*");
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        personId: c.person_id,
        confirmed: c.confirmed,
        paymentDate: c.payment_date
      }));
    },
  });

  const systemSettings = useQuery({
    queryKey: ["system_settings"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("system_settings").select("*").eq("id", "default").single();
        if (error && error.code !== 'PGRST116') throw error;
        
        if (!data) return DEFAULT_SETTINGS;

        const d = data as any;
        return {
          teamsWebhookUrl: d.teams_webhook_url,
          managerWhatsApp: d.manager_whatsapp,
          adminEmails: d.admin_emails,
          adminWhatsApp: d.admin_whatsapp,
          enableTeams: d.enable_teams,
          enableWhatsApp: d.enable_whatsapp,
          enableEmail: d.enable_email,
          financeWhatsApp: d.finance_whatsapp,
          financeEmails: d.finance_emails,
          hrWhatsApp: d.hr_whatsapp,
          hrEmails: d.hr_emails,
          discountAlertDate: d.discount_alert_date,
          discountAutoSend: d.discount_auto_send,
          cltAlertDay: d.clt_alert_day || 5,
          cltAlertDay2: d.clt_alert_day2 || 20,
          pjAlertDay: d.pj_alert_day || 19,
          pjAlertDay2: d.pj_alert_day2 || 4,
          cltPaymentDay: d.clt_payment_day || 5,
          cltAdvanceDay: d.clt_advance_day || 20,
          cltSheetCloseDay: d.clt_sheet_close_day || 20,
          pjPeriod1EndDay: d.pj_period1_end_day || 15,
          pjPeriod1PaymentDay: d.pj_period1_payment_day || 19,
          pjPeriod2PaymentDay: d.pj_period2_payment_day || 4,
          flashCardUsers: d.flash_card_users ? d.flash_card_users : (() => {
            try { return JSON.parse(localStorage.getItem("act_flash_card_users") || "[]"); } 
            catch { return []; }
          })(),
        } as SystemSettings;
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    },
  });

  const customHolidays = useQuery({
    queryKey: ["custom_holidays"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_holidays").select("*").order("date");
      if (error) throw error;
      return (data || []).map((h: any) => ({
        date: h.date,
        name: h.name,
        type: 'custom'
      })) as Holiday[];
    },
  });

  const updateSystemSettings = useMutation({
    mutationFn: async (settings: SystemSettings) => {
      const payload: any = {
        id: "default",
        teams_webhook_url: settings.teamsWebhookUrl,
        manager_whatsapp: settings.managerWhatsApp,
        admin_emails: settings.adminEmails,
        admin_whatsapp: settings.adminWhatsApp,
        enable_teams: settings.enableTeams,
        enable_whatsapp: settings.enableWhatsApp,
        enable_email: settings.enableEmail,
        finance_whatsapp: settings.financeWhatsApp,
        finance_emails: settings.financeEmails,
        hr_whatsapp: settings.hrWhatsApp,
        hr_emails: settings.hrEmails,
        discount_alert_date: settings.discountAlertDate,
        discount_auto_send: settings.discountAutoSend,
        clt_alert_day: settings.cltAlertDay,
        clt_alert_day2: settings.cltAlertDay2,
        pj_alert_day: settings.pjAlertDay,
        pj_alert_day2: settings.pjAlertDay2,
        clt_payment_day: settings.cltPaymentDay,
        clt_advance_day: settings.cltAdvanceDay,
        clt_sheet_close_day: settings.cltSheetCloseDay,
        pj_period1_end_day: settings.pjPeriod1EndDay,
        pj_period1_payment_day: settings.pjPeriod1PaymentDay,
        pj_period2_payment_day: settings.pjPeriod2PaymentDay,
        flash_card_users: settings.flashCardUsers || [],
      };

      try {
        const { error } = await supabase.from("system_settings").upsert(payload, { onConflict: 'id' });
        if (error) throw error;
      } catch (error: any) {
        console.error("Error saving system settings, trying fallback...", error);
        
        // Se der erro de coluna não encontrada, tentamos enviar um payload mínimo com as colunas essenciais que sabemos que existem
        const minPayload = {
          id: "default",
          teams_webhook_url: settings.teamsWebhookUrl,
          manager_whatsapp: settings.managerWhatsApp,
          admin_emails: settings.adminEmails,
          admin_whatsapp: settings.adminWhatsApp,
          enable_teams: settings.enableTeams,
          enable_whatsapp: settings.enableWhatsApp,
          enable_email: settings.enableEmail,
          finance_whatsapp: settings.financeWhatsApp,
          finance_emails: settings.financeEmails,
          hr_whatsapp: settings.hrWhatsApp,
          hr_emails: settings.hrEmails,
          discount_alert_date: settings.discountAlertDate,
          discount_auto_send: settings.discountAutoSend,
        };
        const { error: err2 } = await supabase.from("system_settings").upsert(minPayload, { onConflict: 'id' });
        if (err2) {
            throw new Error(err2.message || err2.details || JSON.stringify(err2));
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_settings"] });
    },
  });

  const updatePaymentConfirmation = useMutation({
    mutationFn: async (conf: PaymentConfirmation) => {
      const payload: any = {
        id: conf.id,
        type: conf.type,
        payment_date: conf.paymentDate,
        confirmed: conf.confirmed,
        apply_balance: conf.applyBalance,
        applied_balance: conf.appliedBalance
      };

      const { error } = await supabase.from("payment_confirmations").upsert(payload, { onConflict: "id" });
      
      if (error) {
        // Se o erro for de coluna inexistente (missing columns), tentamos salvar apenas o básico
        console.warn("Retrying basic payment confirmation upsert...", error);
        const { error: error2 } = await supabase.from("payment_confirmations").upsert({
          id: conf.id,
          type: conf.type,
          payment_date: conf.paymentDate,
          confirmed: conf.confirmed
        }, { onConflict: "id" });
        
        if (error2) throw error2;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_confirmations"] });
    },
  });

  const deletePaymentConfirmation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_confirmations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_confirmations"] });
    },
  });

  const updateDiscountConfirmation = useMutation({
    mutationFn: async (conf: any) => {
      const { error } = await supabase.from("discount_confirmations").upsert({
        id: conf.id || crypto.randomUUID(),
        person_id: conf.personId,
        confirmed: conf.confirmed,
        payment_date: conf.paymentDate
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount_confirmations"] });
    },
  });

  const updateTimeEntry = useMutation({
    mutationFn: async (entry: TimeEntry) => {
      const { error } = await supabase
        .from("time_entries")
        .upsert({
          person_id: entry.personId,
          job_id: entry.jobId,
          date: entry.date,
          entry1: entry.entry1 || null,
          exit1: entry.exit1 || null,
          entry2: entry.entry2 || null,
          exit2: entry.exit2 || null,
          entry3: entry.entry3 || null,
          exit3: entry.exit3 || null,
        } as any, { onConflict: "person_id,job_id,date" });
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
    },
  });

  const updateTimeEntries = useMutation({
    mutationFn: async (entries: TimeEntry[]) => {
      for (const entry of entries) {
        const { error } = await supabase
          .from("time_entries")
          .upsert({
            person_id: entry.personId,
            job_id: entry.jobId,
            date: entry.date,
            entry1: entry.entry1 || null,
            exit1: entry.exit1 || null,
            entry2: entry.entry2 || null,
            exit2: entry.exit2 || null,
            entry3: entry.entry3 || null,
            exit3: entry.exit3 || null,
          } as any, { onConflict: "person_id,job_id,date" });
        if (error) throw error;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
    },
  });

  const deleteTimeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
    },
  });

  const updateMealRequest = useMutation({
    mutationFn: async (req: MealRequest) => {
      const { error } = await supabase
        .from("meal_requests")
        .upsert({
          id: req.id,
          person_id: req.personId,
          job_id: req.jobId,
          start_date: req.startDate,
          end_date: req.endDate,
          meals: req.meals,
          location: req.location,
          daily_overrides: req.dailyOverrides,
        } as any, { onConflict: "id" });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meal_requests"] }),
  });

  const updateMealRequests = useMutation({
    mutationFn: async (reqs: MealRequest[]) => {
      for (const req of reqs) {
        const { error } = await supabase
          .from("meal_requests")
          .upsert({
            id: req.id,
            person_id: req.personId,
            job_id: req.jobId,
            start_date: req.startDate,
            end_date: req.endDate,
            meals: req.meals,
            location: req.location,
            daily_overrides: req.dailyOverrides,
          } as any, { onConflict: "id" });
        if (error) throw error;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meal_requests"] }),
  });

  const deleteMealRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meal_requests"] }),
  });

  const updateFoodControl = useMutation({
    mutationFn: async (entry: FoodControlEntry) => {
      const mealTypes: ('cafe' | 'almoco' | 'janta')[] = ['cafe', 'almoco', 'janta'];
      
      for (const mealType of mealTypes) {
        let isUsed = false;
        let isRequested = false;

        if (mealType === 'cafe') { isUsed = entry.usedCafe; isRequested = entry.requestedCafe; }
        if (mealType === 'almoco') { isUsed = entry.usedAlmoco; isRequested = entry.requestedAlmoco; }
        if (mealType === 'janta') { isUsed = entry.usedJanta; isRequested = entry.requestedJanta; }

        const { data: existing, error: matchError } = await supabase
          .from("food_control")
          .select("id")
          .match({
            person_id: entry.personId,
            job_id: entry.jobId,
            date: entry.date,
            meal_type: mealType
          })
          .maybeSingle();

        if (existing?.id) {
          const { error: updErr } = await supabase.from("food_control").update({ status: isUsed ? 'consumed' : 'not_consumed' }).eq("id", existing.id);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase.from("food_control").insert({
            person_id: entry.personId,
            job_id: entry.jobId,
            date: entry.date,
            meal_type: mealType,
            status: isUsed ? 'consumed' : 'not_consumed'
          });
          if (insErr) throw insErr;
        }
      }
    },
    onMutate: async (newEntry) => {
      // Cancela as buscas para não sobrescrever o estado otimista
      await queryClient.cancelQueries({ queryKey: ["food_control"] });

      // Salva o estado anterior para recuperar em caso de erro
      const previousFoodControl = queryClient.getQueryData(["food_control"]);

      // Atualiza o cache de forma otimista (instantânea na tela)
      queryClient.setQueryData(["food_control"], (old: FoodControlEntry[] | undefined) => {
        if (!old) return [newEntry];
        const exists = old.findIndex(fc => fc.personId === newEntry.personId && fc.jobId === newEntry.jobId && fc.date === newEntry.date);
        if (exists >= 0) {
          const copy = [...old];
          copy[exists] = { ...copy[exists], ...newEntry };
          return copy;
        }
        return [...old, newEntry];
      });

      return { previousFoodControl };
    },
    onError: (err, newEntry, context: any) => {
      // Se der erro no banco, volta para o estado anterior
      if (context?.previousFoodControl) {
        queryClient.setQueryData(["food_control"], context.previousFoodControl);
      }
      toast.error("Erro ao sincronizar com o banco. Tente novamente.");
    },
    onSettled: () => {
      // No final, sincroniza com o banco para garantir consistência
      queryClient.invalidateQueries({ queryKey: ["food_control"] });
    },
  });

  const updateCustomHolidays = useMutation({
    mutationFn: async (holidays: Holiday[]) => {
      const { error: delError } = await supabase.from("custom_holidays").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delError) throw delError;

      if (holidays.length > 0) {
        const { error } = await supabase.from("custom_holidays").insert(holidays.map(h => ({ date: h.date, name: h.name })));
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom_holidays"] }),
  });

  const bulkUpsertPeople = useMutation({
    mutationFn: async (list: Omit<Person, 'id'>[]) => {
      // 1. Remove duplicatas do próprio Excel (mantém a última ocorrência)
      const uniqueList = Array.from(
        new Map(list.map(p => [p.name.toLowerCase().trim(), p])).values()
      );

      const toUpsert = uniqueList.map(person => ({
        name: person.name,
        department: person.department || 'Geral',
        is_registered: person.isRegistered ?? false,
        pix: person.pix || null,
      }));

      // 2. Faz o upsert direto pelo nome. Como o banco tem a constraint unique 'people_name_key', 
      // isso atualizará corretamente os existentes e inserirá os novos, sem sofrer com o limite 
      // de 1000 linhas de um SELECT prévio.
      if (toUpsert.length > 0) {
        const { error } = await supabase.from('people').upsert(toUpsert, { onConflict: 'name' });
        if (error) throw new Error(`Erro ao salvar: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
    },
  });

  const clearAllJobs = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["meal_requests"] });
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      toast.success("Banco de Jobs limpo!");
    },
  });

  const bulkInsertJobs = useMutation({
    mutationFn: async (newJobs: { id: string; name: string }[]) => {
      // 1. Higienização e Deduplicação inicial
      const sanitizeName = (name: string) => name.trim().replace(/\s+/g, ' ');
      const newJobsSanitized = newJobs.map(j => ({ ...j, name: sanitizeName(j.name) }));
      
      const { data: existing, error: fetchError } = await supabase.from("jobs").select("id, name");
      if (fetchError) throw fetchError;

      const existingJobs = existing || [];
      const toUpdate: any[] = [];
      const toInsert: any[] = [];
      const usedExistingIds = new Set<string>();
      
      const uniqueNewNames = Array.from(new Set(newJobsSanitized.map(j => j.name)));

      for (const newName of uniqueNewNames) {
        const newKey = newName.toLowerCase();
        const newNumber = newName.split(" - ")[0].trim();

        const match = existingJobs.find(ej => {
          const eKey = sanitizeName(ej.name).toLowerCase();
          const eNumber = ej.name.split(" - ")[0].trim();
          return eKey === newKey || eNumber === newNumber || ej.name === newNumber;
        });

        if (match && !usedExistingIds.has(match.id)) {
          toUpdate.push({ id: match.id, name: newName });
          usedExistingIds.add(match.id);
        } else {
          toInsert.push({ id: crypto.randomUUID(), name: newName });
        }
      }

      // 2. Execução Atômica em Lotes (Batching de 500)
      const BATCH_SIZE = 500;

      // Upsert (Update) em lotes
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const chunk = toUpdate.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("jobs").upsert(chunk, { onConflict: "id" });
        if (error) throw new Error(`Erro ao atualizar lote de jobs: ${error.message}`);
      }

      // Insert em lotes
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const chunk = toInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("jobs").insert(chunk);
        if (error) throw new Error(`Erro ao importar lote de jobs: ${error.message}`);
      }

      // 3. Limpeza de obsoletos
      const idsToDelete: string[] = [];
      existingJobs.forEach(ej => {
          if (usedExistingIds.has(ej.id)) return;
          const eNumber = ej.name.split(" - ")[0].trim();
          const hasBetterVersion = uniqueNewNames.some(nn => nn.startsWith(eNumber + " - ") || nn === eNumber);
          if (hasBetterVersion) idsToDelete.push(ej.id);
      });

      if (idsToDelete.length > 0) {
          for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
              const chunk = idsToDelete.slice(i, i + BATCH_SIZE);
              await supabase.from("jobs").delete().in("id", chunk);
          }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Jobs importados com sucesso!");
    },
  });

  const repairHistoricalData = useMutation({
    mutationFn: async () => {
      // 1. Busca todos os Jobs para identificar duplicatas e ganhadores
      const { data: allJobs } = await supabase.from("jobs").select("id, name");
      if (!allJobs || allJobs.length === 0) return;

      const sanitizeName = (name: string) => name.trim().replace(/\s+/g, ' ');
      
      // Identifica "Winner IDs" por Número de Job
      const jobByNumber = new Map<string, string>(); // Number -> WinnerID
      const jobByName = new Map<string, string>();   // Name -> WinnerID
      const allJobIds = new Set<string>();

      allJobs.forEach(j => {
          const sName = sanitizeName(j.name);
          const iName = sName.toLowerCase();
          const iNum = sName.split(" - ")[0].trim();
          
          if (!jobByNumber.has(iNum)) jobByNumber.set(iNum, j.id);
          if (!jobByNumber.has(iName)) jobByNumber.set(iName, j.id);
          allJobIds.add(j.id);
      });

      // 2. Busca dados históricos
      const { data: entries } = await supabase.from("time_entries").select("*");
      const { data: requests } = await supabase.from("meal_requests").select("*");

      const BATCH_SIZE = 500;

      // 3. Reparo de Time Entries (O(N))
      const entriesToFix: any[] = [];
      (entries || []).forEach(e => {
          const currentId = String(e.job_id || "").trim();
          if (!currentId) return;

          // Se o ID atual existe e está OK, não fazemos nada
          if (allJobIds.has(currentId)) return;

          // Se não existe, tentamos encontrar o "Winner" por sorte (talvez o ID era o Número do Job como String?)
          const winnerId = jobByNumber.get(currentId) || jobByNumber.get(currentId.toLowerCase());
          
          if (winnerId) {
              entriesToFix.push({ ...e, job_id: winnerId });
          }
      });

      if (entriesToFix.length > 0) {
          for (let i = 0; i < entriesToFix.length; i += BATCH_SIZE) {
              const chunk = entriesToFix.slice(i, i + BATCH_SIZE);
              await supabase.from("time_entries").upsert(chunk);
          }
      }

      // 4. Reparo de Meal Requests (O(N))
      const reqsToFix: any[] = [];
      (requests || []).forEach(r => {
          const currentId = String(r.job_id || "").trim();
          if (!currentId || allJobIds.has(currentId)) return;

          const winnerId = jobByNumber.get(currentId) || jobByNumber.get(currentId.toLowerCase());
          if (winnerId) {
              reqsToFix.push({ ...r, job_id: winnerId });
          }
      });

      if (reqsToFix.length > 0) {
          for (let i = 0; i < reqsToFix.length; i += BATCH_SIZE) {
              const chunk = reqsToFix.slice(i, i + BATCH_SIZE);
              await supabase.from("meal_requests").upsert(chunk);
          }
      }
      
      // 5. Unificação de Jobs Duplicados (Se houver IDs diferentes com o mesmo nome exato)
      const jobsToMergeMap = new Map<string, string[]>(); // WinnerName -> [LoserIDs]
      allJobs.forEach(j => {
          const sName = sanitizeName(j.name).toLowerCase();
          const winner = jobByNumber.get(sName);
          if (winner && winner !== j.id) {
              const losers = jobsToMergeMap.get(sName) || [];
              jobsToMergeMap.set(sName, [...losers, j.id]);
          }
      });

      if (jobsToMergeMap.size > 0) {
          const moreEntriesToFix: any[] = [];
          const moreReqsToFix: any[] = [];
          const jobsToDelete: string[] = [];

          for (const [name, losers] of Array.from(jobsToMergeMap.entries())) {
              const winnerId = jobByNumber.get(name)!;
              
              // Move registros dos perdedores para o vencedor
              (entries || []).forEach(e => {
                  if (losers.includes(e.job_id)) moreEntriesToFix.push({ ...e, job_id: winnerId });
              });
              (requests || []).forEach(r => {
                  if (losers.includes(r.job_id)) moreReqsToFix.push({ ...r, job_id: winnerId });
              });
              jobsToDelete.push(...losers);
          }

          if (moreEntriesToFix.length > 0) await supabase.from("time_entries").upsert(moreEntriesToFix);
          if (moreReqsToFix.length > 0) await supabase.from("meal_requests").upsert(moreReqsToFix);
          if (jobsToDelete.length > 0) await supabase.from("jobs").delete().in("id", jobsToDelete);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      queryClient.invalidateQueries({ queryKey: ["meal_requests"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Fusão de Jobs e Reparo de vínculos concluídos!");
    },
  });

  return {
    people,
    jobs,
    requests,
    timeEntries,
    foodControl,
    paymentConfirmations,
    discountConfirmations,
    systemSettings,
    customHolidays,
    updateSystemSettings,
    updateDiscountConfirmation,
    updatePaymentConfirmation,
    deletePaymentConfirmation,
    updateTimeEntry,
    updateTimeEntries,
    deleteTimeEntry,
    updateMealRequest,
    updateMealRequests,
    deleteMealRequest,
    updateFoodControl,
    updateCustomHolidays,
    bulkUpsertPeople,
    clearAllJobs,
    bulkInsertJobs,
    repairHistoricalData,
  };
};
