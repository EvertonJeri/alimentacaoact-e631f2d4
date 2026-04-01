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
      const { data, error } = await supabase.from("meal_requests").select("*").order("start_date", { ascending: false }).limit(50000);
      if (error) throw error;
      const allJobs = jobs.data || [];
      
      return (data || []).map((r: any) => {
        let resolvedJobId = r.job_id;
        const jobMatch = allJobs.find(j => j.id === r.job_id || j.name.startsWith(r.job_id + " - ") || j.name === r.job_id);
        if (jobMatch) resolvedJobId = jobMatch.id;

        return {
          id: r.id,
          personId: r.person_id,
          jobId: resolvedJobId,
          startDate: r.start_date,
          endDate: r.end_date,
          meals: r.meals,
          location: r.location,
          dailyOverrides: r.daily_overrides,
        };
      }) as MealRequest[];
    },
  });

  const timeEntries = useQuery({
    queryKey: ["time_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .order("date", { ascending: false })
        .limit(50000);
      if (error) throw error;
      const allJobs = jobs.data || [];

      return (data || []).map((e: any) => {
        // Resolve jobId para UUID
        let resolvedJobId = e.job_id;
        const jobMatch = allJobs.find(j => j.id === e.job_id || j.name.startsWith(e.job_id + " - ") || j.name === e.job_id);
        if (jobMatch) resolvedJobId = jobMatch.id;

        return {
          id: e.id,
          personId: e.person_id,
          jobId: resolvedJobId,
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
        };
      }) as TimeEntry[];
    },
  });

  const foodControl = useQuery({
    queryKey: ["food_control", jobs.data],
    enabled: !!jobs.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("food_control").select("*").order("date", { ascending: false }).limit(50000);
      if (error) throw error;
      
      const allJobs = jobs.data || [];
      const grouped = (data || []).reduce((acc: any, f: any) => {
        // Resolve o Job ID para UUID real para garantir consistência cache <-> UI
        let resolvedJobId = f.job_id;
        const jobMatch = allJobs.find(j => j.id === f.job_id || j.name.startsWith(f.job_id + " - ") || j.name === f.job_id);
        if (jobMatch) resolvedJobId = jobMatch.id;

        const fDate = String(f.date).split('T')[0];
        const key = `${f.person_id}|${resolvedJobId}|${fDate}`;
        
        if (!acc[key]) {
          acc[key] = {
            id: f.id, 
            personId: f.person_id, 
            jobId: resolvedJobId, 
            date: fDate,
            usedCafe: false, usedAlmoco: false, usedJanta: false,
            requestedCafe: false, requestedAlmoco: false, requestedJanta: false
          };
        }
        
        const isUsed = f.status === 'consumed';
        if (f.meal_type === 'cafe') acc[key].usedCafe = acc[key].usedCafe || isUsed;
        if (f.meal_type === 'almoco') acc[key].usedAlmoco = acc[key].usedAlmoco || isUsed;
        if (f.meal_type === 'janta') acc[key].usedJanta = acc[key].usedJanta || isUsed;
        
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
      
      const raw = (data || []).map((c: any) => ({
        id: c.id,
        type: c.type,
        personId: c.person_id,
        paymentDate: c.payment_date,
        confirmed: c.confirmed,
        applyBalance: c.apply_balance,
        appliedBalance: c.applied_balance,
        finalValue: c.final_value
      })) as PaymentConfirmation[];

      // DEDUPLICAÇÃO LÓGICA: Se houver 'stmt-abc' e 'abc', unifica em um único registro.
      const map = new Map<string, PaymentConfirmation>();
      
      raw.forEach(c => {
        // Normaliza o ID para a chave do mapa (sem o prefixo stmt-)
        const logicalId = c.id.startsWith("stmt-") ? c.id.replace("stmt-", "") : c.id;
        const existing = map.get(logicalId);
        
        if (!existing) {
          map.set(logicalId, c);
        } else {
          // Prioridade 1: O que estiver confirmado
          // Prioridade 2: O que tiver applyBalance definido (não nulo)
          const shouldReplace = (!existing.confirmed && c.confirmed) || 
                                (existing.applyBalance === null && c.applyBalance !== null);
          if (shouldReplace) {
             map.set(logicalId, c);
          }
        }
      });

      return Array.from(map.values());
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
        
        const d = data as any;
        const localFlash = (() => {
          try { 
            const saved = localStorage.getItem("act_flash_card_users");
            return saved ? JSON.parse(saved) : []; 
          } catch { return []; }
        })();

        if (!data) return { ...DEFAULT_SETTINGS, flashCardUsers: localFlash };

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
          flashCardUsers: (d.flash_card_users && d.flash_card_users.length > 0) ? d.flash_card_users : localFlash,
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
      // 1. TENTATIVA COMPLETA (Tudo o que o sistema suporta)
      const fullPayload: any = {
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
        const { error } = await supabase.from("system_settings").upsert(fullPayload, { onConflict: 'id' });
        if (error) throw error;
        return;
      } catch (error: any) {
        console.warn("Save failed at full payload, trying intermediate...", error);
        
        // 2. TENTATIVA INTERMEDIÁRIA (Apenas colunas que existiam antes desta última atualização)
        const intermediatePayload: any = {
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

        try {
          const { error: err2 } = await supabase.from("system_settings").upsert(intermediatePayload, { onConflict: 'id' });
          if (!err2) return;
          console.warn("Save failed at intermediate payload, trying minimal...", err2);
        } catch (e2) {
           // Continua para o minimal
        }

        // 3. TENTATIVA MÍNIMA (Apenas o core original)
        const minimalPayload = {
          id: "default",
          teams_webhook_url: settings.teamsWebhookUrl,
          manager_whatsapp: settings.managerWhatsApp,
          admin_emails: settings.adminEmails,
          admin_whatsapp: settings.adminWhatsApp,
          enable_teams: settings.enableTeams,
          enable_whatsapp: settings.enableWhatsApp,
          enable_email: settings.enableEmail,
        };

        const { error: err3 } = await supabase.from("system_settings").upsert(minimalPayload, { onConflict: 'id' });
        if (err3) throw err3;
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
        person_id: conf.personId,
        payment_date: conf.paymentDate,
        confirmed: conf.confirmed,
        apply_balance: conf.applyBalance,
        applied_balance: conf.appliedBalance,
        final_value: conf.finalValue
      };

      console.log("[DATABASE] Updating payment confirmation:", payload);

      const { error } = await supabase.from("payment_confirmations").upsert(payload, { onConflict: "id" });
      
      if (error) {
        console.error("Error updating payment confirmation:", error);
        // Se o erro for de coluna inexistente (missing columns), tentamos salvar apenas o básico
        console.warn("Retrying basic payment confirmation upsert...", error);
        const { error: error2 } = await supabase.from("payment_confirmations").upsert({
          id: conf.id,
          type: conf.type,
          payment_date: conf.paymentDate,
          confirmed: conf.confirmed,
          person_id: conf.personId,
          apply_balance: conf.applyBalance
        }, { onConflict: "id" });
        
        if (error2) throw error2;
      }
    },
    onMutate: async (newConf) => {
      // Cancela qualquer refetch em andamento para não sobrescrever o otimismo
      await queryClient.cancelQueries({ queryKey: ["payment_confirmations"] });

      // Snapshot do estado anterior
      const previousConfs = queryClient.getQueryData(["payment_confirmations"]);

      // Atualiza otimisticamente o cache
      queryClient.setQueryData(["payment_confirmations"], (old: any) => {
        const existing = old || [];
        
        // Lógica de busca robusta: combina IDs brutos com IDs prefixados (stmt-)
        const isMatch = (cId: string, nId: string) => {
          if (cId === nId) return true;
          if (cId === `stmt-${nId}`) return true;
          if (nId === `stmt-${cId}`) return true;
          return false;
        };

        const index = existing.findIndex((c: any) => isMatch(c.id, newConf.id));

        if (index >= 0) {
          const next = [...existing];
          // Preserva campos que o newConf possa não ter enviado (merge)
          next[index] = { ...next[index], ...newConf };
          return next;
        }
        return [...existing, newConf];
      });

      return { previousConfs };
    },
    onError: (err, newConf, context) => {
      // Reverte para o estado anterior em caso de erro
      if (context?.previousConfs) {
        queryClient.setQueryData(["payment_confirmations"], context.previousConfs);
      }
    },
    onSettled: () => {
      // Sempre recarrega do servidor após terminar
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
      const payload: any = {
        person_id: conf.personId,
        confirmed: conf.confirmed,
        payment_date: conf.paymentDate || null
      };
      
      // Se já temos um ID, passamos ele para garantir o update
      if (conf.id) payload.id = conf.id;

      const { error } = await supabase.from("discount_confirmations").upsert(payload, { onConflict: 'person_id' });
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
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["time_entries"] });
      const previous = queryClient.getQueryData(["time_entries"]);
      queryClient.setQueryData(["time_entries"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((e: any) => e.id !== id);
      });
      return { previous };
    },
    onError: (err, id, context) => {
      toast.error("Erro ao apagar o registro.");
      if (context?.previous) {
        queryClient.setQueryData(["time_entries"], context.previous);
      }
    },
    onSuccess: () => {
      toast.success("Registro apagado com sucesso!");
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
      const mealTypes: ('cafe' | 'almoco' | 'janta')[] = entry.updatedFields || ['cafe', 'almoco', 'janta'];
      let dbDate = entry.date;
      if (dbDate && dbDate.includes("/")) {
        const parts = dbDate.split("/");
        dbDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }

      for (const mealType of mealTypes) {
        let isUsed = false;
        if (mealType === 'cafe') isUsed = entry.usedCafe;
        if (mealType === 'almoco') isUsed = entry.usedAlmoco;
        if (mealType === 'janta') isUsed = entry.usedJanta;
        const newStatus = isUsed ? 'consumed' : 'not_consumed';
        if (!entry.personId || !dbDate) continue;

        // CAMINHO SIMPLES: Busca o registro exato desta pessoa+data+refeição
        console.log(`Buscando ${mealType} na data ${dbDate} para person ${entry.personId}...`);
        const { data: existing, error: errC } = await supabase
          .from("food_control")
          .select("id")
          .eq("person_id", entry.personId)
          .eq("meal_type", mealType)
          .eq("date", dbDate);
          
        if (errC) {
           console.error("Erro no select:", errC);
        }

        if (existing && existing.length > 0) {
          // TEM REGISTRO -> ATUALIZA P/ TODOS OS IDs (evita bug com dois jobs no mesmo dia)
          const ids = existing.map(e => e.id);
          console.log(`Registro(s) existente(s) encontrado(s): ${ids.join(',')}. Atualizando para ${newStatus}...`);
          const { data: updatedData, error } = await supabase
            .from("food_control")
            .update({ status: newStatus })
            .in("id", ids)
            .select();
          console.log("Resultado do update:", updatedData);
          if (error) throw new Error(`Erro update: ${error.message}`);
          if (!updatedData || updatedData.length === 0) {
            console.error("ALERTA: O Supabase retornou 0 linhas atualizadas! RLS ou permissão bloqueando Update invisivelmente.");
          }
        } else {
          console.log(`Nenhum registro encontrado. Inserindo novo...`);
          // NÃO TEM REGISTRO -> CRIA NOVO (precisa de job_id UUID válido)

          let validJobId = entry.jobId;
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!validJobId || !isUUID.test(validJobId)) {
            const { data: te } = await supabase.from("time_entries").select("job_id").eq("person_id", entry.personId).eq("date", dbDate).limit(1);
            if (te && te.length > 0) { validJobId = te[0].job_id; }
            else {
              const { data: j } = await supabase.from("jobs").select("id").limit(1);
              if (j && j.length > 0) validJobId = j[0].id;
              else throw new Error("Sem jobs cadastrados");
            }
          }
          const { error } = await supabase.from("food_control").insert({
            person_id: entry.personId, job_id: validJobId, date: dbDate, meal_type: mealType, status: newStatus
          });
          if (error) throw new Error(`Erro insert: ${error.message}`);
        }
      }
    },
    onMutate: async (newEntry) => {
      await queryClient.cancelQueries({ queryKey: ["food_control"] });
      // Capturamos os dados do cache de forma mais global, ignorando a chave exata
      const previous = queryClient.getQueriesData({ queryKey: ["food_control"] });
      
      // Aplicar optimistic update genérico (onde as chaves baterem)
      queryClient.setQueriesData({ queryKey: ["food_control"] }, (old: any) => {
        if (!old || !Array.isArray(old)) return [newEntry];
        const exists = old.findIndex(fc => fc.personId === newEntry.personId && fc.date === newEntry.date);
        if (exists >= 0) {
          const uState = [...old];
          uState[exists] = { ...uState[exists], ...newEntry };
          return uState;
        }
        return [newEntry, ...old];
      });
      return { previous };
    },
    onError: (err: any, __, context) => {
      toast.error(err.message || "Erro ao salvar no banco de dados.");
      if (context?.previous) {
        context.previous.forEach(([queryKey, oldData]) => {
            queryClient.setQueryData(queryKey, oldData);
        });
      }
    },
    onSettled: () => {
      // INVEZ de só invalidar no erro, DÁ REFRESH para refletir correto
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
