import { type Holiday, isHoliday } from "@/lib/holidays";
export interface Person {
  id: string;
  name: string;
  isRegistered?: boolean; // CLT registrado - já recebe almoço seg-sex
  department?: string;
  pix?: string;
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
  isTravelOut?: boolean;
  isTravelReturn?: boolean;
  isAutoFilled?: boolean;
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
  isLocal?: boolean; // Se verdadeiro, regra simplificada (almoço 08-18h)
}

export interface SystemSettings {
  teamsWebhookUrl?: string;
  managerWhatsApp: string;
  adminEmails?: string;
  adminWhatsApp?: string;
  enableTeams: boolean;
  enableWhatsApp: boolean;
  enableEmail: boolean;
  financeWhatsApp?: string;
  financeEmails?: string;
  hrWhatsApp?: string;
  hrEmails?: string;
  discountAlertDate?: number;
  discountAutoSend?: boolean;
  cltAlertDay?: number;  // Dia de alerta para CLT
  cltAlertDay2?: number; // Segundo dia de alerta para CLT
  pjAlertDay?: number;   // Dia de alerta para PJ
  pjAlertDay2?: number;  // Segundo dia de alerta para PJ
  flashCardUsers?: string[]; // IDs of PJ people who use Cartão Flash
  // Datas CLT (mantidas para compatibilidade)
  cltPaymentDay?: number;
  cltAdvanceDay?: number;
  cltSheetCloseDay?: number;
  // Datas PJ (mantidas para compatibilidade)
  pjPeriod1EndDay?: number;
  pjPeriod1PaymentDay?: number;
  pjPeriod2PaymentDay?: number;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  managerWhatsApp: "+5511991054800",
  enableTeams: true,
  enableWhatsApp: true,
  enableEmail: true,
  financeWhatsApp: "",
  financeEmails: "",
  hrWhatsApp: "",
  hrEmails: "",
  adminWhatsApp: "",
  discountAlertDate: 25,
  discountAutoSend: false,
  cltAlertDay: 5,
  cltAlertDay2: 20,
  pjAlertDay: 19,
  pjAlertDay2: 4,
  cltPaymentDay: 5,
  cltAdvanceDay: 20,
  cltSheetCloseDay: 20,
  pjPeriod1EndDay: 15,
  pjPeriod1PaymentDay: 19,
  pjPeriod2PaymentDay: 4,
  flashCardUsers: [],
}

export interface FoodControlEntry {
  id?: string;
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
  appliedBalance?: number;
}

export interface PaymentConfirmation {
  id: string; // requestId or jobId
  type: "request" | "job" | "discount";
  paymentDate: string;
  confirmed: boolean;
  appliedBalance?: number;
  applyBalance?: boolean;
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

export const APP_LINK = "https://alimentacaoact.lovable.app";

export function calcTimeDiffMinutes(start: string, end: string): number {
  if (!String(start || "").includes(":") || !String(end || "").includes(":")) return 0;
  const [sh, sm] = String(start).split(":").map(Number);
  const [eh, em] = String(end).split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 1440; // Adiciona 24h se a saída for no dia seguinte
  return diff;
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
      if (dates.length > 500) break; // SEGURANÇA CONTRA DATAS INVÁLIDAS / INFINITO (Max 500 dias)
      dates.push(String(current.toISOString() || "").split("T")[0]);
      current.setDate(current.getDate() + 1);
    }
  } catch (e) {
    return [];
  }
  return dates;
}

const weekendCache: Record<string, boolean> = {};
export function isWeekend(dateStr: string): boolean {
  if (!dateStr) return false;
  if (weekendCache[dateStr] !== undefined) return weekendCache[dateStr];
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  weekendCache[dateStr] = day === 0 || day === 6;
  return weekendCache[dateStr];
}

const holidayCache: Record<string, boolean> = {};
export function isWeekendOrHoliday(dateStr: string): boolean {
  if (holidayCache[dateStr] !== undefined) return holidayCache[dateStr];
  const res = isWeekend(dateStr) || isHoliday(dateStr);
  holidayCache[dateStr] = res;
  return res;
}

export function getMealValue(meal: MealType, dateStr: string, person?: Person, location?: LocationType): number {
  if (meal === "almoco" && (person?.isRegistered || (person as any)?.is_registered)) {
    if (isWeekendOrHoliday(dateStr)) return MEAL_VALUES[meal];
    return 0;
  }
  return MEAL_VALUES[meal];
}

export function getActiveMeals(req: MealRequest, dateStr: string, person?: Person): MealType[] {
  // PRIORIDADE 1: Se o usuário já fez um override manual, respeitamos a decisão dele!
  if (req.dailyOverrides && req.dailyOverrides[dateStr]) {
    return [...req.dailyOverrides[dateStr]] as MealType[];
  }

  // PRIORIDADE 2: Regra base
  let meals = [...(req.meals || [])] as MealType[];

  // Regra SP: Dentro de SP não tem Café da Manhã
  if (req.location === "Dentro SP") {
    meals = meals.filter(m => m !== "cafe");
  }
  
  if (person?.isRegistered || (person as any)?.is_registered) {
    const isWkndOrHol = isWeekendOrHoliday(dateStr);
    
    // Regra financeira CLT: Ganha almoço se for FDS/Feriado e não houver override
    if (isWkndOrHol && !meals.includes("almoco")) {
      meals.push("almoco");
    } else if (!isWkndOrHol && meals.includes("almoco")) {
      // Perde almoço pago se for dia útil e não houver override
      meals = meals.filter(m => m !== "almoco");
    }
  }
  
  return meals;
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

export function calculateDayDiscount(
  req: MealRequest,
  date: string,
  entry: TimeEntry | undefined,
  fc: FoodControlEntry | undefined,
  people: Person[]
): { discountCafe: number; discountAlmoco: number; discountJanta: number; total: number; reason: string } {
  const person = people.find((p) => p.id === req.personId);
  const refCafe = getMealValue("cafe", date, person, req.location);
  const refAlmoco = getMealValue("almoco", date, person, req.location);
  const refJanta = getMealValue("janta", date, person, req.location);

  let discountCafe = 0;
  let discountAlmoco = 0;
  let discountJanta = 0;
  let reason = "";

  const dayMeals = getActiveMeals(req, date, person);

  const localToday = new Date().toISOString().split("T")[0];
  const isPast = date < localToday;
  
  if (!entry) {
    if (isPast) {
      const dCafe = dayMeals.includes("cafe") ? refCafe : 0;
      const dAlmoco = dayMeals.includes("almoco") ? refAlmoco : 0;
      const dJanta = dayMeals.includes("janta") ? refJanta : 0;
      return { 
        discountCafe: dCafe, 
        discountAlmoco: dAlmoco, 
        discountJanta: dJanta, 
        total: dCafe + dAlmoco + dJanta, 
        reason: "Falta - sem registro de horas" 
      };
    }
    return { discountCafe: 0, discountAlmoco: 0, discountJanta: 0, total: 0, reason: "" };
  }

  const isTravelDay = date === req.startDate && !!req.travelTime;
  const hasHours = calcTotalMinutes(entry) > 0;
  const hasTouch = !!(entry.entry1 || entry.exit1 || entry.isTravelOut || entry.isTravelReturn || entry.isAutoFilled);
  
  if (!isPast && !hasTouch) {
     return { discountCafe: 0, discountAlmoco: 0, discountJanta: 0, total: 0, reason: "" };
  }

  let usedCafe = false;
  let usedAlmoco = false;
  let usedJanta = false;

  if (hasHours && entry) {
       const u = determineMealsUsed(entry, req, date);
       usedCafe = u.cafe;
       usedAlmoco = u.almoco;
       usedJanta = u.janta;
    } else if (isTravelDay) {
       const u = determineMealsUsed(undefined, req, date);
       usedCafe = u.cafe;
       usedAlmoco = u.almoco;
       usedJanta = u.janta;
    }

    if (dayMeals.includes("cafe") && !usedCafe) discountCafe = refCafe;
    if (dayMeals.includes("almoco") && !usedAlmoco) discountAlmoco = refAlmoco;
    if (dayMeals.includes("janta") && !usedJanta) discountJanta = refJanta;

    if (!hasHours && !isTravelDay && isPast) {
      reason = "Falta - sem registro de horas";
      if (dayMeals.includes("cafe")) discountCafe = refCafe;
      if (dayMeals.includes("almoco")) discountAlmoco = refAlmoco;
      if (dayMeals.includes("janta")) discountJanta = refJanta;
    } else if (isTravelDay && !hasHours) {
      reason = `Dia de viagem (${req.transportType === "aviao" ? "Avião" : "Ônibus"}) às ${req.travelTime}`;
    } else {
      const misses = [];
      if (discountCafe < 0) misses.push("café");
      if (discountAlmoco < 0) misses.push("almoço");
      if (discountJanta < 0) misses.push("janta");

      if (misses.length > 0) {
        reason = `Horários divergentes para: ${misses.join(", ")}`;
      }
    }

  // Se tem controle manual (Food Control), ele se sobrepõe
  if (fc) {
    if (dayMeals.includes("cafe") && !fc.usedCafe) discountCafe = refCafe;
    else if (!dayMeals.includes("cafe") && fc.usedCafe) discountCafe = -refCafe;
    else discountCafe = 0;
    
    if (dayMeals.includes("almoco") && !fc.usedAlmoco) discountAlmoco = refAlmoco;
    else if (!dayMeals.includes("almoco") && fc.usedAlmoco) discountAlmoco = -refAlmoco;
    else discountAlmoco = 0;
    
    if (dayMeals.includes("janta") && !fc.usedJanta) discountJanta = refJanta;
    else if (!dayMeals.includes("janta") && fc.usedJanta) discountJanta = -refJanta;
    else discountJanta = 0;

    const usedAny = fc.usedCafe || fc.usedAlmoco || fc.usedJanta;
    const isExtra = (!dayMeals.includes("cafe") && fc.usedCafe) || (!dayMeals.includes("almoco") && fc.usedAlmoco) || (!dayMeals.includes("janta") && fc.usedJanta);
    reason = "Ajuste via controle de alimentação (" + (isExtra ? "refeição extra" : (usedAny ? "consumiu parcial" : "não consumiu")) + ")";
  }

  const total = discountCafe + discountAlmoco + discountJanta;
  return { discountCafe, discountAlmoco, discountJanta, total, reason };
}

export function calculatePersonBalance(
  personId: string,
  requests: MealRequest[],
  foodControl: FoodControlEntry[],
  confirmations: (DiscountConfirmation | PaymentConfirmation)[],
  people: Person[],
  timeEntries: TimeEntry[]
): number {
  const person = people.find(p => p.id === personId);
  if (!person) return 0;

  const personRequests = requests.filter(r => r.personId === personId);
  const reqIds = new Set(personRequests.map(r => r.id));
  
  // OTIMIZAÇÃO: Filtramos as confirmações de uma vez só, sem loops aninhados pesados!
  const personConfs = confirmations.filter(c => {
    if ('personId' in c) return c.personId === personId;
    if ('id' in c) return reqIds.has(c.id) || c.id === `job-${personId}`; // Fallback para job IDs legacy
    return false;
  });

  let walletBalance = 0;
  
  // 1. Créditos (O que a pessoa ganha por solicitação)
  const processedDaysReq = new Set<string>();
  personRequests.forEach(req => {
    const dates = getDatesInRange(req.startDate, req.endDate);
    dates.forEach(date => {
        const dayKey = `${req.jobId}-${date}`;
        if (processedDaysReq.has(dayKey)) return;
        processedDaysReq.add(dayKey);

        const dayMeals = getActiveMeals(req, date, person);
        dayMeals.forEach(m => {
            walletBalance += getMealValue(m, date, person, req.location);
        });
    });
  });

  // 2. Débitos (Faltas e refeições não consumidas)
  const processedDaysDisc = new Set<string>();
  personRequests.forEach(req => {
    const dates = getDatesInRange(req.startDate, req.endDate);
    dates.forEach(date => {
      const dayKey = `${req.jobId}-${date}`;
      if (processedDaysDisc.has(dayKey)) return;
      processedDaysDisc.add(dayKey);

      const entries = timeEntries.filter(e => e.personId === personId && e.jobId === req.jobId && e.date === date);
      const entry = entries.find(e => e.isTravelOut || e.isTravelReturn) || entries[0];
      const fc = foodControl.find(f => f.personId === personId && f.jobId === req.jobId && f.date === date);
      
      if (entry || fc) {
        const dayCalc = calculateDayDiscount(req, date, entry, fc, people);
        walletBalance += dayCalc.total;
      }
    });
  });

  // 3. Pagamentos Já Realizados (O que diminui o saldo acumulado)
  personConfs.forEach(conf => {
    if (!conf.confirmed) return;
    
    // Se for confirmação de solicitação específica
    const req = personRequests.find(r => r.id === ('id' in conf ? conf.id : ''));
    if (req) {
        let paidAmount = 0;
        getDatesInRange(req.startDate, req.endDate).forEach(d => {
            getActiveMeals(req, d, person).forEach(m => {
                paidAmount += getMealValue(m, d, person, req.location);
            });
        });
        const applied = 'appliedBalance' in conf ? (conf.appliedBalance || 0) : 0;
        walletBalance -= (paidAmount + applied);
    }
  });

  return walletBalance;
}

export function determineMealsUsed(
  entry: TimeEntry | undefined,
  req: MealRequest,
  date: string
): { cafe: boolean; almoco: boolean; janta: boolean } {
  if (entry?.isAutoFilled) {
      return { cafe: false, almoco: false, janta: false };
  }

  let cafe = false;
  let almoco = false;
  let janta = false;

  if (req && date && date === req.startDate && req.travelTime) {
    const offset = req.transportType === "aviao" ? 4 : 2;
    const [h, m] = req.travelTime.split(":").map(Number);
    const adjustedMinutes = (h * 60 + m) - (offset * 60);

    if (adjustedMinutes <= 8 * 60) cafe = true;
    if (adjustedMinutes <= 12 * 60) almoco = true;
    if (adjustedMinutes <= 20 * 60) janta = true;
    
    if (!entry) return { cafe, almoco, janta };
  }

  if (entry) {
    const firstEntry = getFirstEntryTime(entry);
    const lastExit = getLastExitTime(entry);
    
    if (entry?.isAutoFilled) {
        return { cafe: false, almoco: false, janta: false };
    }

    if (req?.location === "Fora SP" && calcTotalMinutes(entry) > 0) {
        return { cafe: true, almoco: true, janta: true };
    }

    if (String(firstEntry || "").includes(":")) {
      const [h, m] = String(firstEntry).split(":").map(Number);
      if (h < 8 || (h === 8 && m <= 0)) cafe = true;
    }
    
    if (entry.entry1 && entry.exit1 && entry.entry2 && entry.exit2) {
      almoco = true;
    } else if (calcTotalMinutes(entry) >= 360) {
      almoco = true;
    }
    
    if (String(lastExit || "").includes(":")) {
      const [h] = String(lastExit).split(":").map(Number);
      if (h >= 19) janta = true;
    }
    if (entry.entry3 || entry.exit3) janta = true;
  }

  return { cafe, almoco, janta };
}
