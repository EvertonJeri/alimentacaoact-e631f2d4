import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type Person, type Job, type TimeEntry, type MealRequest, type FoodControlEntry, type DiscountConfirmation, type PaymentConfirmation, type MealType, type SystemSettings } from "@/lib/types";
import { type Holiday } from "@/lib/holidays";

export function useDatabase() {
  const queryClient = useQueryClient();

  const people = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*").order("name");
      if (error) throw error;
      return (data || []).map(p => ({
        id: p.id,
        name: p.name,
        isRegistered: p.is_registered,
        department: p.department,
        pix: p.pix
      })) as Person[];
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

  const timeEntries = useQuery({
    queryKey: ["time_entries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("time_entries").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(e => ({
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
      })) as TimeEntry[];
    },
  });

  const mealRequests = useQuery({
    queryKey: ["meal_requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meal_requests").select("*");
      if (error) throw error;
      return (data || []).map(req => ({
        id: req.id,
        personId: req.person_id,
        jobId: req.job_id,
        startDate: req.start_date,
        endDate: req.end_date,
        meals: (req.meals as MealType[]) || [],
        dailyOverrides: req.daily_overrides as Record<string, MealType[]> | undefined,
        location: req.location
      })) as MealRequest[];
    },
  });

  const foodControl = useQuery({
    queryKey: ["food_control"],
    queryFn: async () => {
      const { data, error } = await supabase.from("food_control").select("*");
      if (error) throw error;
      
      const grouped: Record<string, FoodControlEntry> = {};
      data.forEach(row => {
        const key = `${row.person_id}-${row.job_id}-${row.date}`;
        if (!grouped[key]) {
          grouped[key] = {
            personId: row.person_id,
            jobId: row.job_id,
            date: row.date,
            requestedCafe: false,
            requestedAlmoco: false,
            requestedJanta: false,
            usedCafe: false,
            usedAlmoco: false,
            usedJanta: false,
          };
        }
        if (row.meal_type === 'cafe') grouped[key].usedCafe = row.status === 'consumed';
        if (row.meal_type === 'almoco') grouped[key].usedAlmoco = row.status === 'consumed';
        if (row.meal_type === 'janta') grouped[key].usedJanta = row.status === 'consumed';
      });
      return Object.values(grouped);
    },
  });

  const discountConfirmations = useQuery({
    queryKey: ["discount_confirmations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("discount_confirmations").select("*");
      if (error) throw error;
      return (data || []).map(c => ({
        personId: c.person_id,
        confirmed: c.confirmed,
        paymentDate: c.payment_date
      })) as DiscountConfirmation[];
    },
  });

  const paymentConfirmations = useQuery({
    queryKey: ["payment_confirmations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_confirmations").select("*");
      if (error) throw error;
      return (data || []).map(c => ({
        id: c.id,
        type: c.type,
        paymentDate: c.payment_date,
        confirmed: c.confirmed
      })) as PaymentConfirmation[];
    },
  });

  const systemSettings = useQuery({
    queryKey: ["system_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_settings").select("*").eq("id", "default").single();
      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) return null;

      return {
        enableTeams: data.enable_teams,
        teamsWebhookUrl: data.teams_webhook_url,
        enableWhatsApp: data.enable_whatsapp,
        managerWhatsApp: data.manager_whatsapp,
        enableEmail: data.enable_email,
        adminEmails: data.admin_emails,
      } as SystemSettings;
    },
  });

  const customHolidays = useQuery({
    queryKey: ["custom_holidays"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_holidays").select("*").order("date");
      if (error) throw error;
      return (data || []).map(h => ({
        date: h.date,
        name: h.name,
        type: 'custom'
      })) as Holiday[];
    },
  });

  // Mutations
  const updateFoodControl = useMutation({
    mutationFn: async (entry: FoodControlEntry) => {
      const meals: { type: "cafe" | "almoco" | "janta"; used: boolean }[] = [
        { type: "cafe", used: entry.usedCafe },
        { type: "almoco", used: entry.usedAlmoco },
        { type: "janta", used: entry.usedJanta },
      ];

      const upserts = meals.map(meal => ({
        person_id: entry.personId,
        job_id: entry.jobId,
        date: entry.date,
        meal_type: meal.type,
        status: meal.used ? "consumed" : "not_consumed"
      }));

      const { error } = await supabase
        .from("food_control")
        .upsert(upserts); // Usar upsert padrão sem onConflict explícito se estiver falhando no build
      
      if (error) throw error;
    },
    onMutate: async (newEntry) => {
      await queryClient.cancelQueries({ queryKey: ["food_control"] });
      const previous = queryClient.getQueryData<FoodControlEntry[]>(["food_control"]);
      queryClient.setQueryData(["food_control"], (old: FoodControlEntry[] | undefined) => {
        const other = (old || []).filter(fc => !(fc.personId === newEntry.personId && fc.jobId === newEntry.jobId && fc.date === newEntry.date));
        return [...other, newEntry];
      });
      return { previous };
    },
    onError: (err, newEntry, context: { previous?: FoodControlEntry[] } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(["food_control"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["food_control"] });
    },
  });

  const updateDiscountConfirmation = useMutation({
    mutationFn: async (conf: DiscountConfirmation) => {
      if (!conf.confirmed) {
        // Desfazer: remove o registro completamente do banco
        const { error } = await supabase
          .from("discount_confirmations")
          .delete()
          .eq("person_id", conf.personId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("discount_confirmations")
          .upsert({
            person_id: conf.personId,
            confirmed: conf.confirmed,
            payment_date: conf.paymentDate || null
          }, { onConflict: "person_id" });
        if (error) throw error;
      }
    },
    onMutate: async (conf: DiscountConfirmation) => {
      await queryClient.cancelQueries({ queryKey: ["discount_confirmations"] });
      const previous = queryClient.getQueryData<DiscountConfirmation[]>(["discount_confirmations"]);
      queryClient.setQueryData(["discount_confirmations"], (old: DiscountConfirmation[] | undefined) => {
        const others = (old || []).filter(c => c.personId !== conf.personId);
        if (!conf.confirmed) return others; // Desfazer: remove do cache local imediatamente
        return [...others, conf];
      });
      return { previous };
    },
    onError: (_err: unknown, _conf: DiscountConfirmation, context: { previous?: DiscountConfirmation[] } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(["discount_confirmations"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["discount_confirmations"] });
    },
  });

  const updatePaymentConfirmation = useMutation({
    mutationFn: async (conf: PaymentConfirmation) => {
      const { error } = await supabase
        .from("payment_confirmations")
        .upsert({
          id: conf.id,
          type: conf.type,
          payment_date: conf.paymentDate,
          confirmed: conf.confirmed
        }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_confirmations"] });
    },
  });

  const updateTimeEntry = useMutation({
    mutationFn: async (entry: TimeEntry) => {
      const { error } = await supabase
        .from("time_entries")
        .upsert({
          id: entry.id?.length > 10 ? entry.id : undefined,
          person_id: entry.personId,
          job_id: entry.jobId,
          date: entry.date,
          entry1: entry.entry1 || null,
          exit1: entry.exit1 || null,
          entry2: entry.entry2 || null,
          exit2: entry.exit2 || null,
          entry3: entry.entry3 || null,
          exit3: entry.exit3 || null,
        });
      if (error) {
        console.error("Erro no Supabase:", error);
        throw error;
      }
    },
    onMutate: async (newEntry) => {
      await queryClient.cancelQueries({ queryKey: ["time_entries"] });
      const previous = queryClient.getQueryData<TimeEntry[]>(["time_entries"]);
      queryClient.setQueryData(["time_entries"], (old: TimeEntry[] | undefined) => {
        const others = (old || []).filter(e => e.id !== newEntry.id);
        return [...others, newEntry].sort((a, b) => a.date.localeCompare(b.date));
      });
      return { previous };
    },
    onError: (err: any, newEntry, context: { previous?: TimeEntry[] } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(["time_entries"], context.previous);
      }
      toast.error(`Falha ao salvar no banco. Verifique se rodou o script SQL: ${err.message || "Erro desconhecido"}`);
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
          id: req.id?.length > 10 ? req.id : undefined,
          person_id: req.personId,
          job_id: req.jobId,
          start_date: req.startDate,
          end_date: req.endDate,
          meals: req.meals,
          daily_overrides: req.dailyOverrides,
          location: req.location,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal_requests"] });
    },
  });
  
  const removeMealRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("meal_requests")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal_requests"] });
    },
  });

  const removeTimeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("time_entries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["time_entries"] });
      const previous = queryClient.getQueryData<TimeEntry[]>(["time_entries"]);
      queryClient.setQueryData(["time_entries"], (old: TimeEntry[] | undefined) => 
        (old || []).filter((e) => e.id !== id)
      );
      return { previous };
    },
    onError: (err, id, context: { previous?: TimeEntry[] } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(["time_entries"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
    },
  });

  const removePaymentConfirmation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("payment_confirmations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_confirmations"] });
    },
  });
  
  const bulkInsertJobs = useMutation({
    mutationFn: async (jobsToInsert: Job[]) => {
      const { data, error } = await supabase
        .from("jobs")
        .upsert(jobsToInsert.map(j => ({ id: j.id, name: j.name })), { onConflict: "id" });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const clearAllJobs = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("jobs")
        .delete()
        .neq("id", "0"); // Delete all (id != '0' matches all string ids)
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Todos os Jobs foram removidos!");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao remover jobs.");
    }
  });

  const updateSystemSettings = useMutation({
    mutationFn: async (settings: SystemSettings) => {
      const { error } = await supabase
        .from("system_settings")
        .upsert({
          id: "default",
          enable_teams: settings.enableTeams,
          teams_webhook_url: settings.teamsWebhookUrl,
          enable_whatsapp: settings.enableWhatsApp,
          manager_whatsapp: settings.managerWhatsApp,
          enable_email: settings.enableEmail,
          admin_emails: settings.adminEmails,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_settings"] });
    },
  });

  const updateCustomHolidays = useMutation({
    mutationFn: async (holidays: Holiday[]) => {
      // Primeiro remove todos os feriados customizados existentes para simplificar o sync
      // Ou poderíamos fazer um merge, mas para feriados um delete/insert é mais limpo
      await supabase.from("custom_holidays").delete().neq("date", "1900-01-01"); // Delete all

      if (holidays.length > 0) {
        const toInsert = holidays.map(h => ({
          date: h.date,
          name: h.name,
        }));
        const { error } = await supabase.from("custom_holidays").insert(toInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_holidays"] });
    },
  });

  return {
    people,
    jobs,
    timeEntries,
    mealRequests,
    foodControl,
    discountConfirmations,
    paymentConfirmations,
    systemSettings,
    customHolidays,
    updateFoodControl,
    updateDiscountConfirmation,
    updatePaymentConfirmation,
    updateTimeEntry,
    updateMealRequest,
    updateSystemSettings,
    updateCustomHolidays,
    bulkInsertJobs,
    clearAllJobs,
    removeMealRequest,
    removeTimeEntry,
    removePaymentConfirmation,
  };
}
