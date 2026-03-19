import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type Person, type Job, type TimeEntry, type MealRequest, type FoodControlEntry, type DiscountConfirmation } from "@/lib/types";

export function useDatabase() {
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

  const timeEntries = useQuery({
    queryKey: ["time_entries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("time_entries").select("*");
      if (error) throw error;
      // Map database format to TS format if needed
      return data as TimeEntry[];
    },
  });

  const mealRequests = useQuery({
    queryKey: ["meal_requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meal_requests").select("*");
      if (error) throw error;
      return (data as any[]).map(req => ({
        ...req,
        meals: req.meals as any[],
        dailyOverrides: req.daily_overrides as any
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
      return (data as any[]).map(c => ({
        personId: c.person_id,
        confirmed: c.confirmed,
        paymentDate: c.payment_date
      })) as DiscountConfirmation[];
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
        .upsert(upserts, { onConflict: "person_id,job_id,date,meal_type" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food_control"] });
    },
  });

  const updateDiscountConfirmation = useMutation({
    mutationFn: async (conf: DiscountConfirmation) => {
      const { error } = await supabase
        .from("discount_confirmations")
        .upsert({
          person_id: conf.personId,
          confirmed: conf.confirmed,
          payment_date: conf.paymentDate
        }, { onConflict: "person_id" });
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
          id: entry.id?.length > 10 ? entry.id : undefined, // only if valid UUID
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
      if (error) throw error;
    },
    onSuccess: () => {
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

  return {
    people,
    jobs,
    timeEntries,
    mealRequests,
    foodControl,
    discountConfirmations,
    updateFoodControl,
    updateDiscountConfirmation,
    updateTimeEntry,
    updateMealRequest,
  };
}

