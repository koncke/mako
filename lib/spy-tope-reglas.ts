// =============================================================================
// spy-tope-reglas — el tope del plan al sumar un competidor a Competitor Spy (14/11/2026), puro
// =============================================================================
// Martín, 14/11/2026: «Tu competencia solamente debería poder scrapear a una persona de la competencia, el de 97 ilimitado».
// MaKo Esencial (capa `completo`) suma UN competidor; Pro (`agencia`), los que quiera (lib/topes-plan.ts, 'spy.competidores').
// Lo hace cumplir `agregarCompetidor` (lib/spy.ts), la única entrada, con la lectura de lib/spy-tope.ts. Las reglas de la casa
// (AGENTS.md, «Hacer cumplir un tope del plan»):
//   · SÓLO si `aplicanTopes(ws)` dice que sí: nunca al ws1 ni a un alta a mano, que también tienen capa `completo`;
//   · frena lo NUEVO: volver a pegar a alguien que ya mira (o sumarle un canal) no suma uno más. Y nunca saca lo que ya hay:
//     quien tenía 3 los conserva, y la lectura diaria de los seguidos (app/api/cron/spy-todo) no mira este tope;
//   · sin poder leer el plan, deja pasar (lo decide lib/spy-tope.ts).
// Cuentan SÓLO las filas del negocio en `spy_competidores`. Los «Sugeridos» son filas del ws de la plataforma y no cuentan
// hasta que el negocio suma uno (ahí sí es suyo).
// =============================================================================

import { RUTA_CAMBIAR_PLAN, cabeOtra, textoTope, topeDe } from './topes-plan';

export type TopeAlSumarCompetidor = { ok: true } | { ok: false; tope: number; error: string; pasarAPro: string };

/** ¿Puede sumar este competidor? El error es el cartel (`textoTope`), y `pasarAPro`, a dónde lleva el botón. */
export function topeAlSumarCompetidor(p: {
  /** `aplicanTopes(ws)`: MaKo le cobra el plan, o es la cuenta de un cliente de agencia. */
  aplica: boolean;
  /** La capa del negocio hoy (Esencial = `completo`, Pro = `agencia`). Una que no es un plan no tiene tope. */
  capa: string | null | undefined;
  /** Los competidores que el negocio YA tiene. */
  usadas: number;
  /** false = lo que se guarda cae sobre una fila que ya existe (su mismo nombre): no suma uno más. */
  nuevo: boolean;
}): TopeAlSumarCompetidor {
  if (!p.aplica || !p.capa || !p.nuevo) return { ok: true };
  if (cabeOtra(p.capa, 'spy.competidores', p.usadas)) return { ok: true };
  const tope = topeDe(p.capa, 'spy.competidores');
  if (tope == null) return { ok: true };
  return { ok: false, tope, error: textoTope(tope), pasarAPro: RUTA_CAMBIAR_PLAN };
}
