import { type Holiday, isHoliday } from "@/lib/holidays";
export interface Person {
  id: string;
  name: string;
  isRegistered?: boolean; // CLT registrado - já recebe almoço seg-sex
  department?: string;
  pix?: string;
  company?: string;
  pointName?: string;
  isActive?: boolean;
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
  nightAssembly?: boolean; // Montagem noturna
  isDisplacement?: boolean; // Deslocamento
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
  usedCafe: boolean;
  usedAlmoco: boolean;
  usedJanta: boolean;
  requestedCafe?: boolean;
  requestedAlmoco?: boolean;
  requestedJanta?: boolean;
  updatedFields?: ('cafe' | 'almoco' | 'janta')[];
}

export interface DiscountConfirmation {
  id?: string;
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
  finalValue?: number; // Valor congelado no momento da confirmação
  personId?: string; // ADICIONADO: Essencial para o saldo global
}

export interface ManualAdjustment {
  id: string;
  personId: string;
  jobId?: string; // Vinculo opcional com um job específico
  amount: number;
  description: string;
  date: string;
  type: "desconto" | "credito";
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
  // 1. Determinar as refeições base (ou override manual)
  let meals = (req.dailyOverrides && req.dailyOverrides[dateStr]) 
    ? [...req.dailyOverrides[dateStr]] as MealType[]
    : [...(req.meals || [])] as MealType[];

  const isLocal = req.location === "Dentro SP";
  const isCLT = person?.isRegistered || (person as any)?.is_registered;

  // 2. Se for Local (Dentro SP)
  if (isLocal) {
    // Se for montagem noturna explicitamente ou se a janta for o único item solicitado em SP
    const isNightIntent = req.nightAssembly || (meals.includes("janta") && meals.length === 1);
    
    if (isNightIntent) {
      // Regra: Montagem Noturna em SP só tem Janta
      meals = ["janta"];
    } else {
      // Regra Normal em SP: Só tem Almoço
      meals = ["almoco"];
    }
  } else if (isCLT) {
    // 3. Regra CLT para Fora SP (mantém o almoço automático)
    const isWkndOrHol = isWeekendOrHoliday(dateStr);
    
    // Se for fds/feriado e NÃO for montagem noturna, garante almoço
    if (isWkndOrHol && !req.nightAssembly && !meals.includes("almoco")) {
      meals.push("almoco");
    } else if (isWkndOrHol && req.nightAssembly) {
      // Se for montagem noturna no fds, respeita o que o usuário escolheu (permite desmarcar)
    } else if (!isWkndOrHol && meals.includes("almoco")) {
      // Em dias úteis, CLT nunca tem almoço pago pela empresa (exceto se houver override manual muito específico, mas aqui removemos)
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

  const localToday = new Date().toISOString().split("T")[0];
  const isPast = date < localToday;
  const isToday = date === localToday;
  const dayMeals = getActiveMeals(req, date, person);
  const isTravelDay = date === req.startDate && !!req.travelTime;
  const hasHours = !!(entry && (entry.entry1 || entry.exit1 || entry.isTravelOut || entry.isTravelReturn || entry.isAutoFilled));

  // 1. Caso base: Se não há registro de horas e é PASSADO e NÃO tem controle manual
  if (!hasHours && isPast && !fc && !isTravelDay) {
    const dCafe = dayMeals.includes("cafe") ? -refCafe : 0;
    const dAlmoco = dayMeals.includes("almoco") ? -refAlmoco : 0;
    const dJanta = dayMeals.includes("janta") ? -refJanta : 0;
    const hasAnyRequested = dayMeals.length > 0;

    return { 
      discountCafe: dCafe, 
      discountAlmoco: dAlmoco, 
      discountJanta: dJanta, 
      total: dCafe + dAlmoco + dJanta, 
      reason: hasAnyRequested ? "Falta - sem registro de horas" : "" 
    };
  }

  // 2. Se for HOJE ou FUTURO e não tem nada batido nem marcação manual, ignora (limpo)
  if ((isToday || date > localToday) && !hasHours && !fc) {
     return { discountCafe: 0, discountAlmoco: 0, discountJanta: 0, total: 0, reason: "" };
  }

  // 3. Determina o uso baseado em horas ou controle manual
  let usedCafe = false;
  let usedAlmoco = false;
  let usedJanta = false;

  if (fc) {
    usedCafe = fc.usedCafe;
    usedAlmoco = fc.usedAlmoco;
    usedJanta = fc.usedJanta;
  } else if (hasHours && entry) {
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

  // 4. Aplica os descontos (Faltas) ou Créditos (Extras)
  // ABSENCE (Tinha direito mas não usou) = NEGATIVO -> Apenas se for passado!
  // EXTRA (Não tinha direito mas usou) = POSITIVO -> Sempre (crédito)
  
  const canCalculateAbsence = isPast; // Somente datas passadas podem gerar desconto por falta

  if (dayMeals.includes("cafe") && !usedCafe) discountCafe = canCalculateAbsence ? -refCafe : 0;
  else if (!dayMeals.includes("cafe") && usedCafe) discountCafe = refCafe;

  if (dayMeals.includes("almoco") && !usedAlmoco) discountAlmoco = canCalculateAbsence ? -refAlmoco : 0;
  else if (!dayMeals.includes("almoco") && usedAlmoco) discountAlmoco = refAlmoco;

  if (dayMeals.includes("janta") && !usedJanta) discountJanta = canCalculateAbsence ? -refJanta : 0;
  else if (!dayMeals.includes("janta") && usedJanta) discountJanta = refJanta;

  // 5. Define a justificativa
  const isExtra = (!dayMeals.includes("cafe") && usedCafe) || (!dayMeals.includes("almoco") && usedAlmoco) || (!dayMeals.includes("janta") && usedJanta);
  const isAbsence = (dayMeals.includes("cafe") && !usedCafe) || (dayMeals.includes("almoco") && !usedAlmoco) || (dayMeals.includes("janta") && !usedJanta);

  if (fc) {
    reason = "Ajuste via controle alimentar (" + (isExtra ? "refeição extra" : (isAbsence ? "não consumiu" : "consumiu planejado")) + ")";
  } else if (isTravelDay && !hasHours) {
    reason = `Dia de viagem (${req.transportType === "aviao" ? "Avião" : "Ônibus"}) às ${req.travelTime}`;
  } else if (isAbsence) {
    reason = "Horários divergentes ou falta parcial";
  } else if (isExtra) {
    reason = "Refeição extra detectada";
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
  timeEntries: TimeEntry[],
  jobs: Job[],
  excludeRequestId?: string,
  manualAdjustments?: ManualAdjustment[],
  jobIdFilter?: string
): { 
  totalWallet: number; 
  currentReqNet: number; 
  retroBalance: number; 
  jobManualTotal: number;
  otherManualTotal: number;
  adjustments: any[] 
} {
  const person = people.find(p => p.id === personId);
  if (!person) return { totalWallet: 0, currentReqNet: 0, retroBalance: 0, jobManualTotal: 0, otherManualTotal: 0, adjustments: [] };

  const pId = String(personId || "").toLowerCase();
  const excludeId = String(excludeRequestId || "").toLowerCase();
  
  const personRequests = requests.filter(r => String(r.personId || "").toLowerCase() === pId);
  const personConfs = confirmations.filter(c => {
    if ('personId' in c && String(c.personId || "").toLowerCase() === pId) return true;
    const cid = ('id' in c) ? String(c.id || "").toLowerCase() : '';
    if (cid.includes(pId)) return true;
    return personRequests.some(r => cid.includes(String(r.id || "").toLowerCase()));
  });

  let walletBalance = 0;
  let jobManualTotal = 0;
  let otherManualTotal = 0;
  const adjustments: any[] = [];

  // Parte 1: Créditos (O que a pessoa ganha por solicitação)
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

  // Parte 2: Débitos e Ajustes Diários (Faltas e Extras)
  const processedDaysDisc = new Set<string>();
  const allPersonDates = new Set<string>();
  personRequests.forEach(r => getDatesInRange(r.startDate, r.endDate).forEach(d => allPersonDates.add(d)));
  foodControl.forEach(f => { if (String(f.personId || "").toLowerCase() === pId) allPersonDates.add(f.date); });
  timeEntries.forEach(e => { if (String(e.personId || "").toLowerCase() === pId) allPersonDates.add(e.date); });

  allPersonDates.forEach(date => {
    const dayKey = `${date}`;
    if (processedDaysDisc.has(dayKey)) return;
    processedDaysDisc.add(dayKey);

    const req = personRequests.find(r => date >= r.startDate && date <= r.endDate);
    const entries = timeEntries.filter(e => String(e.personId || "").toLowerCase() === pId && e.date === date);
    const entry = entries.find(e => e.isTravelOut || e.isTravelReturn) || entries[0];
    const fc = foodControl.find(f => String(f.personId || "").toLowerCase() === pId && f.date === date);
    
    const orphanReq: MealRequest = { 
        id: `orphan-${personId}-${date}`, 
        personId: String(personId), 
        jobId: String(fc?.jobId || entry?.jobId || 'unknown'), 
        startDate: date, 
        endDate: date, 
        meals: [] as MealType[],
        location: 'Fora SP' as LocationType
    };

    const dayCalc = calculateDayDiscount(req || orphanReq, date, entry, fc, people);
    const val = dayCalc.total;
    if (Math.abs(val) > 0.01) {
       const discountId = req ? `discount-${req.id}-${date}` : `orphan-${personId}-${date}`;
       const isItemHandled = personConfs.some(c => String(c.id || "").toLowerCase() === discountId.toLowerCase() && c.confirmed);
       
       if (!isItemHandled) {
          walletBalance += val;
          adjustments.push({ date, amount: val, label: dayCalc.reason });
       }
    }
  });

  // Parte 3: Pagamentos Já Realizados
  let currentReqNet = 0;
  personConfs.forEach(conf => {
    // Se este for o ID que queremos ignorar (o pagamento que está acontecendo agora), pulamos
    if (String(conf.id || "").toLowerCase() === excludeId) return;

    if (conf.confirmed) {
        let valToSubtract = 0;
        
        // Se já tiver valor final congelado, usamos ele
        if ('finalValue' in conf && conf.finalValue !== undefined && conf.finalValue !== null) {
            valToSubtract = conf.finalValue;
        } else if ('type' in conf && conf.type === 'request') {
            const r = requests.find(req => req.id === conf.id);
            if (r) {
                const dates = getDatesInRange(r.startDate, r.endDate);
                dates.forEach(d => {
                    const meals = getActiveMeals(r, d, person);
                    meals.forEach(m => valToSubtract += getMealValue(m, d, person, r.location));
                });
            }
        }
        walletBalance -= valToSubtract;
    } else {
        if ('type' in conf && conf.type === 'request') {
           const r = requests.find(req => req.id === conf.id);
           if (r) {
               const dates = getDatesInRange(r.startDate, r.endDate);
               dates.forEach(d => {
                   const meals = getActiveMeals(r, d, person);
                   meals.forEach(m => currentReqNet += getMealValue(m, d, person, r.location));
               });
           }
        }
    }
  });

  // Parte 4: Ajustes Manuais
  if (manualAdjustments) {
    const personAdj = manualAdjustments.filter(a => String(a.personId || "").toLowerCase() === pId);
    personAdj.forEach(a => {
      const val = a.type === "credito" ? Math.abs(a.amount) : -Math.abs(a.amount);
      walletBalance += val;
      
      const aJobId = String(a.jobId || "").toLowerCase().trim();
      const filterId = String(jobIdFilter || "").toLowerCase().trim();
      
      const isJobMatch = jobIdFilter && (
        aJobId === filterId || 
        aJobId.startsWith(filterId + " -") || 
        filterId.startsWith(aJobId + " -")
      );

      if (isJobMatch) {
        jobManualTotal += val;
      } else {
        otherManualTotal += val;
      }
      
      let label = `[Manual] ${a.description}`;
      if (a.jobId) {
        const job = jobs.find(j => j.id === a.jobId);
        if (job) label = `[Manual ${job.name}] ${a.description}`;
      }
      
      adjustments.push({ date: a.date, amount: val, label });
    });
  }

  const totalWallet = walletBalance;
  const retroBalance = totalWallet - currentReqNet;

  return { 
    totalWallet, 
    currentReqNet, 
    retroBalance, 
    jobManualTotal,
    otherManualTotal,
    adjustments 
  };
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

  const getFirstEntryTime = (e: TimeEntry) => e.entry1 || e.entry2 || e.entry3 || "";
  const getLastExitTime = (e: TimeEntry) => e.exit3 || e.exit2 || e.exit1 || "";

  if (req && date && date === req.startDate && req.travelTime) {
    const offset = req.transportType === "aviao" ? 4 : 2;
    const [h, m] = req.travelTime.split(":").map(Number);
    const adjustedMinutes = (h * 60 + m) - (offset * 60);

    if (adjustedMinutes <= 8 * 60) cafe = true;
    if (adjustedMinutes <= 12 * 60) almoco = true;
    if (adjustedMinutes <= 20 * 60) janta = true;
    
    // Se for Dentro SP, Café e Janta são ignorados na regra automática (como pedido)
    if (req.location === "Dentro SP") {
        cafe = false;
        janta = false;
    }
    
    if (!entry) return { cafe, almoco, janta };
  }

  if (entry) {
    const firstEntry = getFirstEntryTime(entry);
    const lastExit = getLastExitTime(entry);
    
    if (req?.location === "Fora SP" && (calcTotalMinutes(entry) > 0 || entry.isTravelOut || entry.isTravelReturn)) {
        return { cafe: true, almoco: true, janta: true };
    }

    // Regra Para Fora SP: Café se entrar cedo, Janta se sair tarde
    if (req?.location !== "Dentro SP") {
        if (String(firstEntry || "").includes(":")) {
          const [h] = String(firstEntry).split(":").map(Number);
          if (h < 8) cafe = true;
        }
        
        if (String(lastExit || "").includes(":")) {
          const [h] = String(lastExit).split(":").map(Number);
          if (h >= 19) janta = true;
        }
        if (entry.entry3 || entry.exit3) janta = true;
    }
    
    if (entry.entry1 && entry.exit1 && entry.entry2 && entry.exit2) {
      almoco = true;
    } else if (calcTotalMinutes(entry) >= 360) {
      almoco = true;
    }
  }

  return { cafe, almoco, janta };
}
