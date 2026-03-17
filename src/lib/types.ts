export interface Person {
  id: string;
  name: string;
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

export interface MealRequest {
  id: string;
  personId: string;
  jobId: string;
  meals: MealType[];
  startDate: string;
  endDate: string;
}

export interface Job {
  id: string;
  name: string;
}

export const SAMPLE_PEOPLE: Person[] = [
  { id: "1", name: "Carlos Silva" },
  { id: "2", name: "Ana Santos" },
  { id: "3", name: "Roberto Lima" },
  { id: "4", name: "Maria Oliveira" },
  { id: "5", name: "João Ferreira" },
];

export const SAMPLE_JOBS: Job[] = [
  { id: "j1", name: "JOB-001 - Montagem Estrutural" },
  { id: "j2", name: "JOB-002 - Montagem Elétrica" },
  { id: "j3", name: "JOB-003 - Montagem Mecânica" },
];

export const MEAL_LABELS: Record<MealType, string> = {
  almoco: "Almoço",
  janta: "Janta",
};

export const MEAL_VALUES: Record<MealType, number> = {
  almoco: 35.0,
  janta: 35.0,
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
