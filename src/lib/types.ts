export interface Person {
  id: string;
  name: string;
  isRegistered?: boolean; // CLT registrado - já recebe almoço seg-sex
}

export interface TimeEntry {
  id: string;
  personId: string;
  jobId: string;
  date: string; // YYYY-MM-DD
  entry1: string; // HH:mm
  exit1: string;
  entry2: string;
  exit2: string;
  entry3: string; // dinner period (optional)
  exit3: string;
}

export type MealType = "cafe" | "almoco" | "janta";

export type LocationType = "Dentro SP" | "Fora SP";

export interface MealRequest {
  id: string;
  personId: string;
  jobId: string;
  meals: MealType[];
  startDate: string;
  endDate: string;
  location?: LocationType;
  transportType?: "onibus" | "aviao";
  travelTime?: string; // HH:mm
  dailyOverrides?: Record<string, MealType[]>;
}

export interface FoodControlEntry {
  personId: string;
  jobId: string;
  date: string;
  requestedCafe: boolean;
  requestedAlmoco: boolean;
  requestedJanta: boolean;
  usedCafe: boolean;
  usedAlmoco: boolean;
  usedJanta: boolean;
}

export interface DiscountConfirmation {
  personId: string;
  confirmed: boolean;
  paymentDate?: string;
}

export interface PaymentConfirmation {
  id: string; // requestId or jobId
  type: "request" | "job";
  paymentDate: string;
  confirmed: boolean;
}



export interface Job {
  id: string;
  name: string;
}

export const LOCATIONS: { value: LocationType; label: string }[] = [
  { value: "Dentro SP", label: "Dentro de SP (e cidades próximas)" },
  { value: "Fora SP", label: "Fora de SP" },
];

export const SAMPLE_PEOPLE: Person[] = [];
export const SAMPLE_JOBS: Job[] = [];

export const MEAL_LABELS: Record<MealType, string> = {
  cafe: "Café da Manhã",
  almoco: "Almoço",
  janta: "Janta",
};

export const MEAL_VALUES: Record<MealType, number> = {
  cafe: 15.0,
  almoco: 32.0,
  janta: 32.0,
};

export function calcTimeDiffMinutes(start: string, end: string): number {
  if (!String(start || "").includes(":") || !String(end || "").includes(":")) return 0;
  const [sh, sm] = String(start).split(":").map(Number);
  const [eh, em] = String(end).split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export function calcTotalMinutes(entry: TimeEntry): number {
  const p1 = calcTimeDiffMinutes(entry.entry1, entry.exit1);
  const p2 = calcTimeDiffMinutes(entry.entry2, entry.exit2);
  const p3 = calcTimeDiffMinutes(entry.entry3, entry.exit3);
  return Math.max(0, p1) + Math.max(0, p2) + Math.max(0, p3);
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getDatesInRange(start: string, end: string): string[] {
  if (!start || !end) return [];
  const dates: string[] = [];
  try {
    const current = new Date(start + "T12:00:00");
    const last = new Date(end + "T12:00:00");
    if (isNaN(current.getTime()) || isNaN(last.getTime())) return [];
    
    while (current <= last) {
      dates.push(String(current.toISOString() || "").split("T")[0]);
      current.setDate(current.getDate() + 1);
    }
  } catch (e) {
    return [];
  }
  return dates;
}

export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6; // 0 is Sunday, 6 is Saturday
}

export function getMealValue(meal: MealType, dateStr: string, person?: Person): number {
  if (meal === "almoco" && person?.isRegistered && !isWeekend(dateStr)) {
    return 0; // Almoço grátis para registrados de Seg a Sex
  }
  return MEAL_VALUES[meal];
}

export function getFirstEntryTime(entry: TimeEntry): string | null {
  if (entry.entry1) return entry.entry1;
  if (entry.entry2) return entry.entry2;
  if (entry.entry3) return entry.entry3;
  return null;
}

export function getLastExitTime(entry: TimeEntry): string | null {
  if (entry.exit3) return entry.exit3;
  if (entry.exit2) return entry.exit2;
  if (entry.exit1) return entry.exit1;
  return null;
}

export function calculatePersonBalance(
  personId: string,
  requests: MealRequest[],
  foodControl: FoodControlEntry[],
  confirmations: (DiscountConfirmation | PaymentConfirmation)[],
  people: Person[]
): number {
  const person = people.find(p => p.id === personId);
  const personRequests = requests.filter(r => r.personId === personId);
  let balance = 0;

  personRequests.forEach(req => {
    const dates = getDatesInRange(req.startDate, req.endDate);
    dates.forEach(date => {
      const reqMeals = (req.dailyOverrides?.[date] ?? req.meals) as MealType[];
      const fc = foodControl.find(f => f.personId === personId && f.jobId === req.jobId && f.date === date);
      
      if (Array.isArray(reqMeals)) {
        reqMeals.forEach(m => {
          const val = getMealValue(m, date, person);
          const used = fc ? (m === 'cafe' ? fc.usedCafe : m === 'almoco' ? fc.usedAlmoco : fc.usedJanta) : false;
          
          if (!used) {
            balance += val; // Requested but not used -> Credit for person (Positive)
          }
        });
      }

      if (fc) {
        const usedMeals: { type: MealType; used: boolean }[] = [
          { type: 'cafe', used: fc.usedCafe },
          { type: 'almoco', used: fc.usedAlmoco },
          { type: 'janta', used: fc.usedJanta }
        ];

        usedMeals.forEach(um => {
          if (um.used && (!Array.isArray(reqMeals) || !reqMeals.includes(um.type))) {
            balance -= getMealValue(um.type, date, person); // Used but not requested -> Charge person (Negative)
          }
        });
      }
    });
  });

  // Deduct confirmed payments or discounts already applied to payroll
  confirmations.forEach(c => {
    // If it's a person-specific confirmation (DiscountConfirmation)
    if ('personId' in c && c.personId === personId && c.confirmed) {
      // Logic for discount: it means the current balance was already settled via payroll
      // For simplicity, we assume confirmed means balance is cleared
      // This part might need refinement based on exact payment logic
    }
    // If it's a payment type confirmation (PaymentConfirmation)
    // We would need to know which person these payments applied to
    // In the current schema, PaymentConfirmation doesn't link to personId?
  });

  return balance;
}

export function determineMealsUsed(entry: TimeEntry): { cafe: boolean; almoco: boolean; janta: boolean } {
  const firstEntry = getFirstEntryTime(entry);
  const lastExit = getLastExitTime(entry);
  
  let cafe = false;
  if (String(firstEntry || "").includes(":")) {
    const [h, m] = String(firstEntry).split(":").map(Number);
    if (h < 8 || (h === 8 && m <= 0)) cafe = true; // Até 08:00
  }
  
  let almoco = false;
  // Regra básica: se tem o primeiro período e o segundo período, presume-se almoço no intervalo. 
  // Ou se trabalhou mais de 6 horas.
  if (entry.entry1 && entry.exit1 && entry.entry2 && entry.exit2) {
    almoco = true;
  } else if (calcTotalMinutes(entry) > 360) {
    almoco = true;
  }
  
  let janta = false;
  if (String(lastExit || "").includes(":")) {
    const [h] = String(lastExit).split(":").map(Number);
    if (h >= 19) janta = true; // Após 19h
  }
  if (entry.entry3 || entry.exit3) janta = true;

  return { cafe, almoco, janta };
}

