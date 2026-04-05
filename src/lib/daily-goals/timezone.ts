/**
 * Retorna a data de "hoje" no fuso horário informado no formato 'YYYY-MM-DD'.
 * Se o timezone for inválido ou não suportado, cai silenciosamente para UTC.
 */
export function getLocalDateStr(timezone?: string | null): string {
  const tz = timezone ?? 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    // Fallback para UTC se o timezone for inválido
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Converte um instante ISO (ex.: created_at) para 'YYYY-MM-DD' no fuso informado.
 */
export function formatDateInTimezone(isoTimestamp: string, timezone?: string | null): string {
  const tz = timezone ?? 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(isoTimestamp));
  } catch {
    return new Date(isoTimestamp).toISOString().split('T')[0];
  }
}

/**
 * Lista curada de fusos horários IANA para uso no seletor.
 * Organizada por região, com o offset UTC atual para referência.
 */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  // América do Sul
  { value: 'America/Sao_Paulo',    label: 'Brasil — Brasília / São Paulo (UTC-3)' },
  { value: 'America/Manaus',       label: 'Brasil — Manaus / Amazonas (UTC-4)' },
  { value: 'America/Belem',        label: 'Brasil — Belém / Pará (UTC-3)' },
  { value: 'America/Fortaleza',    label: 'Brasil — Fortaleza (UTC-3)' },
  { value: 'America/Noronha',      label: 'Brasil — Fernando de Noronha (UTC-2)' },
  { value: 'America/Rio_Branco',   label: 'Brasil — Rio Branco / Acre (UTC-5)' },
  { value: 'America/Buenos_Aires', label: 'Argentina — Buenos Aires (UTC-3)' },
  { value: 'America/Santiago',     label: 'Chile — Santiago (UTC-3/-4)' },
  { value: 'America/Lima',         label: 'Peru — Lima (UTC-5)' },
  { value: 'America/Bogota',       label: 'Colômbia — Bogotá (UTC-5)' },
  { value: 'America/Caracas',      label: 'Venezuela — Caracas (UTC-4)' },
  // América do Norte
  { value: 'America/New_York',     label: 'EUA — Nova York / Leste (UTC-5/-4)' },
  { value: 'America/Chicago',      label: 'EUA — Chicago / Centro (UTC-6/-5)' },
  { value: 'America/Denver',       label: 'EUA — Denver / Montanha (UTC-7/-6)' },
  { value: 'America/Los_Angeles',  label: 'EUA — Los Angeles / Pacífico (UTC-8/-7)' },
  { value: 'America/Toronto',      label: 'Canadá — Toronto (UTC-5/-4)' },
  { value: 'America/Vancouver',    label: 'Canadá — Vancouver (UTC-8/-7)' },
  { value: 'America/Mexico_City',  label: 'México — Cidade do México (UTC-6/-5)' },
  // Europa
  { value: 'Europe/Lisbon',        label: 'Portugal — Lisboa (UTC+0/+1)' },
  { value: 'Europe/London',        label: 'Reino Unido — Londres (UTC+0/+1)' },
  { value: 'Europe/Paris',         label: 'França — Paris (UTC+1/+2)' },
  { value: 'Europe/Berlin',        label: 'Alemanha — Berlim (UTC+1/+2)' },
  { value: 'Europe/Madrid',        label: 'Espanha — Madri (UTC+1/+2)' },
  { value: 'Europe/Rome',          label: 'Itália — Roma (UTC+1/+2)' },
  { value: 'Europe/Moscow',        label: 'Rússia — Moscou (UTC+3)' },
  // Ásia / Pacífico
  { value: 'Asia/Dubai',           label: 'Emirados — Dubai (UTC+4)' },
  { value: 'Asia/Kolkata',         label: 'Índia — Calcutá (UTC+5:30)' },
  { value: 'Asia/Bangkok',         label: 'Tailândia — Bangkok (UTC+7)' },
  { value: 'Asia/Shanghai',        label: 'China — Xangai (UTC+8)' },
  { value: 'Asia/Tokyo',           label: 'Japão — Tóquio (UTC+9)' },
  { value: 'Australia/Sydney',     label: 'Austrália — Sydney (UTC+10/+11)' },
  // UTC
  { value: 'UTC',                  label: 'UTC (coordenado universal)' },
];
