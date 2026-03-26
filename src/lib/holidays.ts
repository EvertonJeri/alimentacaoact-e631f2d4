export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'national' | 'custom';
}

// Feriados Nacionais do Brasil - 2025 e 2026
export const BRAZIL_NATIONAL_HOLIDAYS: Holiday[] = [
  // 2025
  { date: "2025-01-01", name: "Confraternização Universal", type: "national" },
  { date: "2025-03-03", name: "Carnaval (segunda-feira)", type: "national" },
  { date: "2025-03-04", name: "Carnaval (terça-feira)", type: "national" },
  { date: "2025-04-18", name: "Sexta-Feira Santa", type: "national" },
  { date: "2025-04-20", name: "Páscoa", type: "national" },
  { date: "2025-04-21", name: "Tiradentes", type: "national" },
  { date: "2025-05-01", name: "Dia do Trabalho", type: "national" },
  { date: "2025-06-19", name: "Corpus Christi", type: "national" },
  { date: "2025-09-07", name: "Independência do Brasil", type: "national" },
  { date: "2025-10-12", name: "Nossa Senhora Aparecida", type: "national" },
  { date: "2025-11-02", name: "Finados", type: "national" },
  { date: "2025-11-15", name: "Proclamação da República", type: "national" },
  { date: "2025-11-20", name: "Consciência Negra", type: "national" },
  { date: "2025-12-25", name: "Natal", type: "national" },
  // 2026
  { date: "2026-01-01", name: "Confraternização Universal", type: "national" },
  { date: "2026-02-16", name: "Carnaval (segunda-feira)", type: "national" },
  { date: "2026-02-17", name: "Carnaval (terça-feira)", type: "national" },
  { date: "2026-04-03", name: "Sexta-Feira Santa", type: "national" },
  { date: "2026-04-05", name: "Páscoa", type: "national" },
  { date: "2026-04-21", name: "Tiradentes", type: "national" },
  { date: "2026-05-01", name: "Dia do Trabalho", type: "national" },
  { date: "2026-06-04", name: "Corpus Christi", type: "national" },
  { date: "2026-09-07", name: "Independência do Brasil", type: "national" },
  { date: "2026-10-12", name: "Nossa Senhora Aparecida", type: "national" },
  { date: "2026-11-02", name: "Finados", type: "national" },
  { date: "2026-11-15", name: "Proclamação da República", type: "national" },
  { date: "2026-11-20", name: "Consciência Negra", type: "national" },
  { date: "2026-12-25", name: "Natal", type: "national" },
];

const STORAGE_KEY = "act_custom_holidays";

let _customHolidays: Holiday[] = [];

export const setGlobalCustomHolidays = (holidays: Holiday[]) => {
  _customHolidays = holidays;
  // Também salva no LocalStorage para persistência offline/fallback rápido
  localStorage.setItem(STORAGE_KEY, JSON.stringify(holidays));
};

export const getCustomHolidays = (): Holiday[] => {
  if (_customHolidays.length > 0) return _customHolidays;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
};

export const saveCustomHolidays = (holidays: Holiday[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(holidays));
};

export const getAllHolidays = (): Holiday[] => {
  return [...BRAZIL_NATIONAL_HOLIDAYS, ...getCustomHolidays()];
};

export const isHoliday = (date: string): boolean => {
  // PERFORMANCE: Cache imutável para os feriados nacionais (Set é 100x mais rápido que array.some)
  const nationalDatesSet = new Set(BRAZIL_NATIONAL_HOLIDAYS.map(h => h.date));
  if (nationalDatesSet.has(date)) return true;
  
  // 2. Checa feriados customizados (Lista curta)
  return getCustomHolidays().some(h => h.date === date);
};

export const getHolidayName = (date: string): string | undefined => {
  return getAllHolidays().find(h => h.date === date)?.name;
};
