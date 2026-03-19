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


export interface Job {
  id: string;
  name: string;
}

export const LOCATIONS: { value: LocationType; label: string }[] = [
  { value: "Dentro SP", label: "Dentro de SP (e cidades próximas)" },
  { value: "Fora SP", label: "Fora de SP" },
];

export const SAMPLE_PEOPLE: Person[] = [
  { id: "1", name: "Carlos Silva", isRegistered: false },
  { id: "2", name: "Ana Santos", isRegistered: true },
  { id: "3", name: "Roberto Lima", isRegistered: false },
  { id: "4", name: "Maria Oliveira", isRegistered: true },
  { id: "5", name: "João Ferreira", isRegistered: false },
];

export const SAMPLE_JOBS: Job[] = [
  { id: "j1", name: "JOB-001 - Montagem Estrutural" },
  { id: "j2", name: "JOB-002 - Montagem Elétrica" },
  { id: "j3", name: "JOB-003 - Montagem Mecânica" },
];

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
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
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
  const dates: string[] = [];
  const current = new Date(start + "T12:00:00");
  const last = new Date(end + "T12:00:00");
  while (current <= last) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
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

export function determineMealsUsed(entry: TimeEntry, timeRanges = { breakfast: 8, lunch: 12, dinner: 19 }): { cafe: boolean; almoco: boolean; janta: boolean } {
  const firstEntry = getFirstEntryTime(entry);
  const lastExit = getLastExitTime(entry);
  if (!firstEntry || !lastExit) return { cafe: false, almoco: false, janta: false };

  const [eh] = firstEntry.split(":").map(Number);
  const [lh, lm] = lastExit.split(":").map(Number);
  const lastExitMinutes = lh * 60 + lm;

  return {
    cafe: eh <= timeRanges.breakfast,
    almoco: lastExitMinutes >= timeRanges.lunch * 60,
    janta: lastExitMinutes >= timeRanges.dinner * 60,
  };
}
