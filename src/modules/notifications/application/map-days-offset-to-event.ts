/** Mapeia days_offset da regua para event_type de template. */
export function mapDaysOffsetToEventType(daysOffset: number): string {
  if (daysOffset === -3) return "lembrete_pre_3d";
  if (daysOffset === -1) return "lembrete_pre_1d";
  if (daysOffset === 0) return "vencimento_hoje";
  if (daysOffset === 3) return "pos_vencimento_3d";
  if (daysOffset === 7) return "pos_vencimento_7d";
  return `regua_d${daysOffset >= 0 ? "+" : ""}${daysOffset}`;
}
