// =============================================================================
// agenda-anticipacion — con cuánta anticipación se puede agendar hoy una llamada (server)
// =============================================================================
// Martín (16/10/2026, por Cerebro, punto 4): «si MaKo sabe por la API que el evento permite agendar con poca
// anticipación (por ejemplo 3 h), el delay "1 día antes" lo advierte». Lo leen la API de MaKo
// (`anticipacion_agenda`, área calendario) y el lienzo de Automations (GET /api/flujos/anticipacion), que lo pone
// en la tarjeta de cada espera «antes de la reunión» que no llega a salir (`avisoAgendaCerca`, lib/flujo-conversacion.ts).
//
// Hoy mide Calendly (`primerHuecoLibre`, lib/calendly-agenda.ts: Calendly no publica su anticipación mínima, y lo que
// se mide es el hueco libre más cercano). ⚠️ «NO PUDE LEER» NO ES «NO ESTÁ» (AGENTS.md): el token se lee con
// `credWsEstricta` y una lectura caída es `ok: false`, no «Calendly no está conectado».
// =============================================================================

import 'server-only';
import { credWsEstricta } from './credenciales';
import { primerHuecoLibre } from './calendly-agenda';

export type AnticipacionAgenda =
  /** Lo medido: el hueco libre más cercano está a `minutos` (en el tipo de reunión `evento`). */
  | { ok: true; minutos: number; evento: string; fuente: 'calendly' }
  /** No hay nada que medir (sin Calendly, o sin huecos esta semana), con el porqué. */
  | { ok: true; minutos: null; motivo: string }
  | { ok: false; error: string };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function anticipacionDeLaAgenda(ws: number): Promise<AnticipacionAgenda> {
  let token: string | null;
  try { token = await credWsEstricta('CALENDLY_API_TOKEN', ws); } catch (e) { return { ok: false, error: `No pude leer las credenciales: ${msg(e)}` }; }
  if (!token) return { ok: true, minutos: null, motivo: 'Calendly no está conectado.' };
  try {
    const r = await primerHuecoLibre();
    return r ? { ok: true, minutos: r.minutos, evento: r.evento, fuente: 'calendly' } : { ok: true, minutos: null, motivo: 'Calendly no tiene huecos libres esta semana.' };
  } catch (e) {
    return { ok: false, error: `Calendly: ${msg(e)}` };
  }
}
