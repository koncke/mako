// =============================================================================
// La Ticketera — CUÁNTO TARDA cada ticket, y la alerta a Martín a las 24 h (18/11/2026)
// =============================================================================
// Martín le prometió a Teo «medir el tiempo de cada ticket, con alerta a las 24 h» (docs/relevo/pedidos-perdidos-2810.md).
// Hasta acá lo único parecido era el aviso del pedido delegado que nadie tomó (`avisarDelegadosSinTomar`, lib/tickets-cierre.ts):
// a los 30 minutos y sólo para lo que llega delegado por WhatsApp. Este módulo es la lógica PURA (sin base ni red, lo importan la
// bandeja, el cron y los tests):
//   · `tiempoDelTicket`: el rótulo corto que dibuja la Ticketera de Martín al lado de «hace X» (la tabla y la tarjeta);
//   · `paraLaAlerta24h` y `textoAlerta24h`: qué tickets cruzaron las 24 h y lo que le llega a Martín (lo manda
//     `avisarTicketsDeMasDe24h`, lib/tickets-cierre.ts, desde el cron de tickets).
//
// ⚠️ QUÉ CUENTA COMO NUESTRA DEMORA (`ESTADOS_QUE_NOS_ESPERAN`): «nuevo» y «esperando la decisión» (espera a Martín), «en curso»
// (lo está trabajando el equipo) y «arreglado» (arreglado y todavía sin publicar: para el cliente sigue roto). «Esperando al
// cliente» NO: el equipo le preguntó algo y la pelota está de su lado, así que ni alerta ni se pinta como vencido. Los cerrados
// («resuelto», «rechazado», «duplicado») tampoco alertan: de ésos se dice cuánto TARDARON.
//
// ⚠️ EL TIEMPO SE CUENTA DESDE QUE SE LEVANTÓ (`created_at`), entero: lo que pasó esperando al cliente no se descuenta. Es lo que
// pidió el pendiente (de `created_at` a `resuelto_at`) y lo que vive el cliente. Si el cierre no tiene fecha, no se dice nada:
// lo que no se midió no se afirma.
//
// ⚠️ LA ALERTA NO MANDA LA TANDA DE ANTES: sólo los tickets levantados desde `ALERTA_24H_DESDE` (el día que esto se construyó).
// Igual que el molde del delegado («en el primer deploy no sale una tanda de viejos»), pero con una fecha fija y no una ventana
// de edad: con una ventana, un ticket que pasó tres días esperando al cliente y vuelve a la cancha nunca avisaría, y un cron caído
// un par de días se los comería. Los de antes se ven igual en la bandeja, en rojo («lleva N días»).
//
// ⚠️ A MARTÍN SE LE NOMBRA UN TICKET POR QUIÉN Y DE QUÉ TRATA, nunca por su número (AGENTS.md), y QUÉ PASÓ sale de `quePaso`
// (app/tickets/bandeja/mazo-reglas.ts), nunca del título de un automático, que le habla al cliente.
// =============================================================================

import type { FilaTicket } from './tickets-db';
import type { EstadoTicket } from './tickets-reglas';
import { nombreDe, primerNombre, quePaso } from '@/app/tickets/bandeja/mazo-reglas';

/** Cuántas horas puede estar un ticket en nuestra cancha antes de que se le avise a Martín. */
export const HORAS_ALERTA = 24;
const LIMITE_MS = HORAS_ALERTA * 3600_000;

/** El renglón del historial de un ticket que pasó las 24 h y del que ya se le avisó a Martín: un aviso por ticket, nunca uno cada
 *  15 minutos. `ticket_eventos.tipo` tiene un CHECK de 1 a 40 (mig 0311). */
export const TIPO_ALERTA_24H = 'alerta_24h';

/** Desde cuándo alerta (ver la cabecera: el primer deploy no manda los tickets viejos). */
export const ALERTA_24H_DESDE = '2026-11-18T00:00:00.000Z';

/** Los estados en los que el ticket espera algo NUESTRO. «esperando_cliente» no está a propósito (ver la cabecera). */
export const ESTADOS_QUE_NOS_ESPERAN: readonly EstadoTicket[] = ['nuevo', 'esperando_decision', 'en_curso', 'arreglado'];
const CERRADOS: readonly EstadoTicket[] = ['resuelto', 'rechazado', 'duplicado'];

/** Lo que le dice a Martín el estado del ticket, en sus palabras. */
const ESTADO_PARA_MARTIN: Partial<Record<EstadoTicket, string>> = {
  nuevo: 'espera tu decisión', esperando_decision: 'espera tu decisión', en_curso: 'en curso', arreglado: 'arreglado, sin publicar todavía',
};

/** «12 min», «26 h», «3 días». Hasta las 48 h en horas: «ayer» o «hace 1 día» no dicen si pasó las 24. */
export function duracionCorta(ms: number): string {
  const m = Math.max(0, ms);
  if (m < 3600_000) return `${Math.max(1, Math.floor(m / 60_000))} min`;
  if (m < 48 * 3600_000) return `${Math.floor(m / 3600_000)} h`;
  return `${Math.floor(m / 86_400_000)} días`;
}

/** `ok`: cerró dentro de las 24 h · `tarde`: cerró, pero tardó más · `vencido`: sigue en nuestra cancha y ya pasó las 24 h. */
export type TiempoDelTicket = { texto: string; tono: 'ok' | 'tarde' | 'vencido' };

/**
 * El rótulo corto de cuánto tardó (o cuánto lleva) un ticket, para la Ticketera de Martín. null = no se dibuja nada:
 *   · cerrado con su fecha de cierre (`resuelto_at`, o `decidido_at` si se cerró al decidir) → «tardó 5 h»;
 *   · abierto en nuestra cancha y con más de 24 h → «lleva 26 h» (debajo de las 24 h ya lo dice «hace X», y repetirlo es ruido);
 *   · esperando al cliente, o cerrado sin fecha → nada.
 */
export function tiempoDelTicket(t: Pick<FilaTicket, 'estado' | 'created_at' | 'resuelto_at' | 'decidido_at'>, ahora: number): TiempoDelTicket | null {
  const ini = Date.parse(t.created_at);
  if (!Number.isFinite(ini)) return null;
  if (CERRADOS.includes(t.estado)) {
    const fin = Date.parse(t.resuelto_at ?? t.decidido_at ?? '');
    if (!Number.isFinite(fin) || fin < ini) return null;
    const ms = fin - ini;
    return { texto: `tardó ${duracionCorta(ms)}`, tono: ms > LIMITE_MS ? 'tarde' : 'ok' };
  }
  if (!ESTADOS_QUE_NOS_ESPERAN.includes(t.estado)) return null;
  const ms = ahora - ini;
  if (ms < LIMITE_MS) return null;
  return { texto: `lleva ${duracionCorta(ms)}`, tono: 'vencido' };
}

/** Lo que el cron lee de cada ticket para decidir y para escribirle a Martín. */
export type TicketParaAlerta = Pick<FilaTicket, 'id' | 'workspace_id' | 'estado' | 'created_at' | 'tipo' | 'canal' | 'contexto' | 'titulo' | 'usuario_nombre' | 'usuario_email'>
  & { negocio?: string | null };

/** Los que cruzaron las 24 h en nuestra cancha, levantados desde `ALERTA_24H_DESDE`, y de los que todavía no se avisó. Del más viejo
 *  al más nuevo. */
export function paraLaAlerta24h<T extends TicketParaAlerta>(filas: readonly T[], yaAvisados: ReadonlySet<number>, ahoraMs: number): T[] {
  const desde = Date.parse(ALERTA_24H_DESDE);
  return filas
    .filter((f) => {
      const ini = Date.parse(f.created_at);
      return Number.isFinite(ini) && ini >= desde && ahoraMs - ini >= LIMITE_MS
        && ESTADOS_QUE_NOS_ESPERAN.includes(f.estado) && !yaAvisados.has(Number(f.id));
    })
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

/** Cuántos renglones entran en el aviso; el resto, «y N más». */
export const RENGLONES_ALERTA = 8;

const cortar = (s: string, tope: number): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= tope) return t;
  const c = t.slice(0, tope);
  const sp = c.lastIndexOf(' ');
  return `${(sp > tope * 0.6 ? c.slice(0, sp) : c).replace(/[\s.,;:—-]+$/, '')}…`;
};

/**
 * Lo que le llega a Martín (al grupo de SuperAdmin y a la campanita), UN mensaje por vuelta del cron con todos los que cruzaron:
 *   «2 tickets pasaron las 24 h sin resolverse:
 *    • Laura (Estudio Gómez): No se guardan los cambios del funnel · espera tu decisión · lleva 26 h
 *    • …
 *    Están en la Ticketera.»
 * Un automático no lleva el «quién:» delante: su frase ya nombra a la persona («MaKo no le pudo contestar a Mauricio»).
 */
export function textoAlerta24h(filas: readonly TicketParaAlerta[], ahoraMs: number): string {
  const n = filas.length;
  const cabeza = n === 1 ? 'Un ticket pasó las 24 h sin resolverse:' : `${n} tickets pasaron las 24 h sin resolverse:`;
  const renglones = filas.slice(0, RENGLONES_ALERTA).map((f) => {
    const negocio = (f.negocio ?? '').trim();
    const quien = f.canal === 'sistema' ? null : primerNombre(nombreDe(f));
    const deQuien = quien ? `${quien}${negocio ? ` (${negocio})` : ''}: ` : negocio ? `${negocio}: ` : '';
    const estado = ESTADO_PARA_MARTIN[f.estado] ?? '';
    const lleva = `lleva ${duracionCorta(ahoraMs - Date.parse(f.created_at))}`;
    return `• ${deQuien}${cortar(quePaso(f), 90)}${estado ? ` · ${estado}` : ''} · ${lleva}`;
  });
  if (n > RENGLONES_ALERTA) renglones.push(`• y ${n - RENGLONES_ALERTA} más`);
  return [cabeza, ...renglones, 'Están en la Ticketera.'].join('\n');
}
