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
      return data as Person[];
    },
  });

  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").order("name");
      if (error) throw error;
      return data as Job[];
    },
  });

  const requests = useQuery({
    queryKey: ["meal_requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meal_requests").select("*");
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
        .order("created_at", { ascending: false });
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
      const { data, error } = await supabase.from("food_control").select("*");
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
          enableTeams: d.enable_teams,
          enableWhatsApp: d.enable_whatsapp,
          enableEmail: d.enable_email,
          financeWhatsApp: d.finance_whatsapp,
          financeEmails: d.finance_emails,
          hrWhatsApp: d.hr_whatsapp,
          hrEmails: d.hr_emails,
          discountAlertDate: d.discount_alert_date,
          discountAutoSend: d.discount_auto_send,
          cltPaymentDay: d.clt_payment_day || 5,
          cltAdvanceDay: d.clt_advance_day || 20,
          cltSheetCloseDay: d.clt_sheet_close_day || 20,
          pjPeriod1EndDay: d.pj_period1_end_day || 15,
          pjPeriod1PaymentDay: d.pj_period1_payment_day || 19,
          pjPeriod2PaymentDay: d.pj_period2_payment_day || 4,
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
        enable_teams: settings.enableTeams,
        enable_whatsapp: settings.enableWhatsApp,
        enable_email: settings.enableEmail,
        finance_whatsapp: settings.financeWhatsApp,
        finance_emails: settings.financeEmails,
        hr_whatsapp: settings.hrWhatsApp,
        hr_emails: settings.hrEmails,
        discount_alert_date: settings.discountAlertDate,
        discount_auto_send: settings.discountAutoSend,
        clt_payment_day: settings.cltPaymentDay,
        clt_advance_day: settings.cltAdvanceDay,
        clt_sheet_close_day: settings.cltSheetCloseDay,
        pj_period1_end_day: settings.pjPeriod1EndDay,
        pj_period1_payment_day: settings.pjPeriod1PaymentDay,
        pj_period2_payment_day: settings.pjPeriod2PaymentDay,
      };

      const { error } = await supabase.from("system_settings").upsert(payload);
      if (error) {
        console.warn("Retrying basic upsert...", error);
        const { error: error2 } = await supabase.from("system_settings").upsert({
          id: "default",
          manager_whatsapp: settings.managerWhatsApp,
          enable_teams: settings.enableTeams,
          enable_whatsapp: settings.enableWhatsApp,
          enable_email: settings.enableEmail,
        });
        if (error2) throw error2;
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

        const { error } = await supabase
          .from("food_control")
          .upsert({
            person_id: entry.personId,
            job_id: entry.jobId,
            date: entry.date,
            meal_type: mealType,
            status: isUsed ? 'consumed' : 'not_consumed'
          } as any, { onConflict: "person_id,job_id,date,meal_type" });
          
        if (error && error.code === '42P10') {
          // Fallback se a constraint UNIQUE ainda não existir no banco do usuário
          console.warn("Constraint de unicidade ausente. Tentando localizar ID manualmente...");
          const { data: existing } = await supabase
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
            await supabase.from("food_control").update({ status: isUsed ? 'consumed' : 'not_consumed' }).eq("id", existing.id);
          } else {
            await supabase.from("food_control").insert({
              person_id: entry.personId,
              job_id: entry.jobId,
              date: entry.date,
              meal_type: mealType,
              status: isUsed ? 'consumed' : 'not_consumed'
            });
          }
        } else if (error) {
          throw error;
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
    mutationFn: async (list: any[]) => {
      const { error } = await supabase.from("people").upsert(list);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
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
      const { error } = await supabase.from("jobs").upsert(
        newJobs.map((j) => ({ id: j.id, name: j.name })),
        { onConflict: "id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Jobs importados com sucesso!");
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
    updatePaymentConfirmation,
    deletePaymentConfirmation,
    updateDiscountConfirmation,
    updateTimeEntry,
    updateTimeEntries,
    deleteTimeEntry,
    updateMealRequest,
    deleteMealRequest,
    updateFoodControl,
    updateCustomHolidays,
    bulkUpsertPeople,
    clearAllJobs,
    bulkInsertJobs,
  };
};
