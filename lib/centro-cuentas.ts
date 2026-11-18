// =============================================================================
// A qué cuenta va un trabajo, y con qué modelo: «Automático» o la que elija Martín (17/10/2026)
// =============================================================================
// Martín, mirando Ops Center en producción: «Al enviar un prompt por el Second Brain no me deja seleccionar qué cuenta...
// Si no selecciono nada que lo decida solo, pero debería poder seleccionar». Y: «Quiero que los jefes y el cerebro tengan
// la capacidad de ahorrar tokens, dando instrucciones precisas y eligiendo qué modelo de IA debe correr».
//
// Un chat es un NOMBRE con una sesión por cuenta (lib/centro-chats.ts → unirPorNombre). Elegir la cuenta es elegir a
// cuál de SUS sesiones va el trabajo: una cuenta en la que el chat no está abierto no se puede elegir (abrirlo ahí es el
// «un clic», docs/diseno-nuevo-chat-un-clic.md). «Automático» elige, entre sus sesiones, la que puede recibir ya y tiene
// más cuota libre (la ventana que se va a terminar primero manda).
//
// El modelo y el esfuerzo los aplica el Runner con `set_session_model` / `set_session_effort` antes de entregar (lib/
// runner.ts). Esas herramientas son de la APP: a un chat de terminal no se le puede cambiar el modelo desde afuera, así
// que ahí el selector no se ofrece.
//
// «AUTOMÁTICO» ES POR FASE desde el 18/11/2026 (pedido de Aaron por Martín, ticket 876825880-11: «Sonnet para explorar,
// Opus para ejecutar, midiendo el consumo antes y después»). Hasta ese día «Automático» no tocaba nada. La regla, la más
// simple que se puede escribir, porque un pedido no dice en qué fase está:
//   · todo trabajo «Automático» a un chat de la app ARRANCA EXPLORANDO con Sonnet: leer, buscar, medir y armar el plan, sin
//     cambiar archivos. Si se contesta sólo leyendo (una pregunta), termina ahí, en Sonnet;
//   · EJECUTAR arranca cuando el CHAT lo dice: antes de su primer cambio corre `cartero.mjs fase <id> ejecutar` y termina
//     el turno; el Runner le pone Opus y le escribe que siga (scripts/operaciones/cartero.mjs → `fase`, `mensajeFase`).
//     El chat no se lo puede cambiar solo: la app no deja que una sesión se cambie el modelo de su propio turno;
//   · un modelo elegido a mano manda (no hay fases); el esfuerzo elegido vale para las dos fases;
//   · NO al Cerebro: reparte y juzga, y elige él el modelo de cada jefe (AGENTS.md → «El modelo justo y la instrucción
//     precisa»). Ni a un chat de terminal (no se le puede cambiar), ni con un Runner de antes de la 1.28.0 (lo ignoraría
//     y la caja diría algo que no pasa).
// El consumo de cada fase se mide con la cuota de la cuenta (lib/centro-uso.ts → gastoPorFase).

import type { CarteroP, ChatCentro, SesionDeChat } from './centro-chats';
import { usoDeCuenta, type Cuota } from './centro-uso';
import { ESFUERZOS, MODELOS, MODELO_EJECUTAR, MODELO_EXPLORAR, aceptaPorFase, carteroVivo, type Esfuerzo, type Modelo } from './operaciones-reglas';
// ⚠️ Puro (sin server-only): lo usan la caja de la computadora y la del teléfono (app/admin/operaciones/useCentro.ts).
import { esElCerebro } from './tickets-aviso';

export { ESFUERZOS, MODELOS, MODELO_EJECUTAR, MODELO_EXPLORAR, type Esfuerzo, type Modelo };

export const AUTOMATICO = 'auto';

/** Cuánto queda libre de una cuenta, 0-100: la ventana más usada manda (la de 5 horas o la semanal). null = no se sabe. */
export function libreDe(cuota: Cuota | null | undefined, ahora: number): number | null {
  const u = usoDeCuenta(cuota, ahora);
  const usados = [u.cinco, u.semana].filter((v): v is NonNullable<typeof v> => v != null)
    // Pasado su reinicio, la ventana está vacía.
    .map((v) => (v.reinicio ? 0 : v.pct))
    .filter((p): p is number => p != null && Number.isFinite(p));
  return usados.length ? Math.max(0, 100 - Math.max(...usados)) : null;
}

/** ¿Esta sesión puede recibir ya? Abierta, con su foto al día, con un Runner en su carpeta y el de su cuenta vivo. */
function recibeYa(s: SesionDeChat, carteros: readonly CarteroP[], ahora: number): boolean {
  const abierta = s.estado === 'abierto' || s.estado === 'trabajando';
  return abierta && !s.viejo && !s.sinRunner && carteroVivo(carteros.find((k) => k.cuenta === s.cuenta), ahora);
}

/**
 * La sesión que elige «Automático»: primero la que recibe ya; si ninguna, una ABIERTA antes que una cerrada; entre ésas, la
 * de más cuota libre (lo que no se sabe va después de lo que se sabe); y a igualdad, la que se movió último. null = el chat
 * no tiene ninguna sesión.
 * ⚠️ «ABIERTA ANTES QUE CERRADA» (25/10/2026). Sin ese escalón, con ninguna sesión lista (la del Cerebro nuevo de la cuenta 5
 *    todavía sin Runner en su carpeta) desempataba la cuota libre, y la sesión CERRADA de la cuenta 2, con más cuota, le ganaba:
 *    los seis pedidos de Martín de ese día fueron a parar a un Cerebro cerrado. Mismo orden que `pesoSesion` (centro-chats.ts).
 */
export function sesionAutomatica(c: Pick<ChatCentro, 'sesiones'>, carteros: readonly CarteroP[], ahora: number): SesionDeChat | null {
  const cuota = (cuenta: string | null) => carteros.find((k) => k.cuenta === cuenta)?.cuota ?? null;
  const abierta = (s: SesionDeChat) => s.estado === 'abierto' || s.estado === 'trabajando';
  const puntaje = (s: SesionDeChat) => [recibeYa(s, carteros, ahora) ? 1 : 0, abierta(s) ? 1 : 0, libreDe(cuota(s.cuenta), ahora) ?? -1, s.actividad ?? 0];
  let mejor: SesionDeChat | null = null;
  let pMejor: number[] = [];
  for (const s of c.sesiones) {
    const p = puntaje(s);
    // Gana el primer escalón en que difieren (recibe ya, abierta, cuota, lo último que se movió).
    const i = p.findIndex((v, n) => v !== pMejor[n]);
    if (!mejor || (i >= 0 && p[i] > pMejor[i])) { mejor = s; pMejor = p; }
  }
  return mejor;
}

/** A dónde va un trabajo con la elección de la caja: la sesión de esa cuenta (la mejor, si hay dos), o la automática.
 *  Sin sesiones conocidas, el chat tal cual (la caja ya dice qué hacer con eso). */
export function destinoDe(
  c: Pick<ChatCentro, 'sesion' | 'cuenta' | 'estado' | 'sesiones'>, eleccion: string, carteros: readonly CarteroP[], ahora: number,
): Pick<ChatCentro, 'sesion' | 'cuenta' | 'estado'> {
  const de = eleccion === AUTOMATICO ? c.sesiones : c.sesiones.filter((s) => s.cuenta === eleccion);
  const s = sesionAutomatica({ sesiones: de }, carteros, ahora);
  return s ? { sesion: s.sesion, cuenta: s.cuenta, estado: s.estado } : { sesion: c.sesion, cuenta: c.cuenta, estado: c.estado };
}

/** Las cuentas para elegir: las de las sesiones del chat, en orden, con lo libre de cada una. */
export function cuentasDelChat(c: Pick<ChatCentro, 'sesiones'>, carteros: readonly CarteroP[], ahora: number): { cuenta: string; libre: number | null }[] {
  const cuentas = [...new Set(c.sesiones.map((s) => s.cuenta).filter((x): x is string => !!x))]
    .sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  return cuentas.map((cuenta) => ({ cuenta, libre: libreDe(carteros.find((k) => k.cuenta === cuenta)?.cuota ?? null, ahora) }));
}

// ── El modelo y el esfuerzo ─────────────────────────────────────────────────────────────────────────────────────────
export const NOMBRE_MODELO: Record<Modelo, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' };
export const NOMBRE_ESFUERZO: Record<Esfuerzo, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto', xhigh: 'Muy alto', max: 'Máximo' };

/** El modelo se le puede cambiar sólo a un chat de la APP (`local_…`): las herramientas que lo hacen son de la app. */
export const aceptaModelo = (sesion: string | null | undefined): boolean => !!sesion && sesion.startsWith('local_');

/** Lo que se firma de «cómo corre» un trabajo de la caja. `porFase`: «Automático» por fase (ver arriba). */
export type ComoCorreEnvio = { modelo?: Modelo | null; esfuerzo?: Esfuerzo | null; porFase?: true };

/** ¿Alguno de los Runners de esa cuenta entiende «por fase»? (`aceptaPorFase`; sin cuenta, cualquiera). Como `topeDe`. */
export const runnerEntiendePorFase = (carteros: readonly { cuenta: string; version?: string | null }[], cuenta: string | null | undefined): boolean =>
  carteros.some((k) => (!cuenta || k.cuenta === cuenta) && aceptaPorFase(k.version));

/**
 * ¿Este trabajo va por fase? Con «Automático» (sin modelo), a un chat de la app que no es el Cerebro, y con un Runner en
 * esa cuenta que lo entiende (`runnerEntiende`, de `runnerEntiendePorFase`).
 */
export function vaPorFase(sesion: string | null | undefined, titulo: string, modelo: Modelo | null | undefined, runnerEntiende: boolean): boolean {
  return !modelo && aceptaModelo(sesion) && !esElCerebro(titulo) && runnerEntiende;
}

/** Lo que se firma: el modelo y el esfuerzo sólo para un chat de la app; y «Automático», por fase cuando va (`vaPorFase`). */
export function comoCorreDelEnvio(
  sesion: string | null | undefined, titulo: string, modelo: Modelo | null | undefined, esfuerzo: Esfuerzo | null | undefined, runnerEntiende: boolean,
): ComoCorreEnvio {
  if (!aceptaModelo(sesion)) return {};
  return { modelo: modelo ?? null, esfuerzo: esfuerzo ?? null, ...(vaPorFase(sesion, titulo, modelo, runnerEntiende) ? { porFase: true as const } : {}) };
}

/** Cómo se lee «Automático» en el selector de modelo: con las dos fases cuando va por fase («Sonnet → Opus»). */
export const rotuloAutomaticoModelo = (porFase: boolean): string =>
  (porFase ? `Automático · ${NOMBRE_MODELO[MODELO_EXPLORAR]} → ${NOMBRE_MODELO[MODELO_EJECUTAR]}` : 'Automático');
