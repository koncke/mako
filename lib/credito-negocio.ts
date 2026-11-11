// =============================================================================
// credito-negocio — el crédito de una cuenta Max como el Claude de un negocio, con su interruptor (22/10/2026)
// =============================================================================
// Martín, textual: «habilita los tokens de la API de la cuenta de Mauricio, esos 200, para su Ops Center, que lo pueda usar,
// así puedo seguir probando en Automations» y «dame luego una opción para deshabilitarle esa API a Mauricio en SuperAdmin,
// tal vez en USO, que pueda desactivar». Qué negocio usa qué crédito: `CREDITO_DE_UN_NEGOCIO` (lib/veto-claude.ts). Acá:
//   · el interruptor, guardado en el workspace de la PLATAFORMA (el negocio no lo ve ni lo toca). Sin fila, PRENDIDO: lo
//     pidió Martín, y prenderlo no necesita escribir en producción;
//   · la clave del crédito, del entorno o de la fila de la plataforma, y sólo con el interruptor prendido.
// ⚠️ «NO PUDE LEER» APAGA: si el interruptor no se puede leer, no hay crédito para ese pedido (nunca se gasta por un bache).
// =============================================================================

import 'server-only';
import {
  CLAVE_INTERRUPTOR_CREDITO_GRUPOS, CLAVE_INTERRUPTOR_CREDITO_PLATAFORMA, CREDITO_DE_UN_NEGOCIO, claveDelInterruptorDeCredito, esInterruptorPrendido,
  type CreditoDeUnNegocio, type UsoDelCredito,
} from './veto-claude';
import { CLAVES_CREDITO_DE_LOS_GRUPOS, CLAVE_USO_DEL_CREDITO, leerUsoDelCredito, ordenDeLasCuentas } from './credito-api';
import { credWsEstricta } from './credenciales';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { getWorkspaceActual, runWithWorkspace, wsSuperAdmin } from './workspace';

/** El crédito asignado a ese negocio y si está prendido. null = no tiene. Tira si no pudo leer el interruptor. */
export async function creditoAsignadoA(ws: number | null | undefined): Promise<(CreditoDeUnNegocio & { prendido: boolean }) | null> {
  const def = CREDITO_DE_UN_NEGOCIO.find((c) => c.ws === ws);
  if (!def) return null;
  const valor = await runWithWorkspace(await wsSuperAdmin(), () => getSettingEstricto(claveDelInterruptorDeCredito(def.ws)));
  return { ...def, prendido: esInterruptorPrendido(valor) };
}

/**
 * La clave del crédito asignado al negocio en curso (o a `ws`), si lo tiene y está prendido. null si no, o si algo no se pudo
 * leer (falla cerrada). La usa la puerta 2 (lib/anthropic.ts → `permisoDeLaClaveDelNegocio`) y lo que pregunta «¿tiene IA?».
 */
export async function claveDelCreditoAsignado(ws?: number | null): Promise<string | null> {
  try {
    const w = ws ?? (await getWorkspaceActual());
    const c = await creditoAsignadoA(w);
    if (!c?.prendido) return null;
    // Las dos fuentes, como `conCreditoDeLaPlataforma`: el entorno o la fila de la plataforma con el mismo nombre.
    return process.env[c.clave]?.trim() || (await credWsEstricta(c.clave, await wsSuperAdmin(), { ilegibleTira: true }))?.trim() || null;
  } catch (e) {
    console.error(`[credito-negocio] no pude leer el crédito asignado: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

// ── EL CRÉDITO DE LOS GRUPOS (lib/veto-claude.ts, `CLAVES_CREDITO_DE_LOS_GRUPOS`, Martín, 28/10/2026) ─────────────────────────
const SIN_CREDITO_MS = 6 * 60 * 60 * 1000;
const g = globalThis as unknown as { __creditoGruposAgotado?: Map<string, number>; __creditoGruposTurno?: { n: number } };
/** Las cuentas que contestaron «credit balance is too low», hasta cuándo (como `creditoAgotado` de lib/anthropic.ts). */
const agotadas = (g.__creditoGruposAgotado ??= new Map<string, number>());
const reparto = (g.__creditoGruposTurno ??= { n: 0 });

/** El interruptor de cada uso del crédito: los grupos de WhatsApp (28/10) y lo del espacio de MaKo (11/11). */
const interruptorDe = (para: UsoDelCredito): string => (para === 'plataforma' ? CLAVE_INTERRUPTOR_CREDITO_PLATAFORMA : CLAVE_INTERRUPTOR_CREDITO_GRUPOS);

/**
 * Las cuentas del crédito que se pueden probar ahora para ese uso, en orden: con clave (del entorno o de la fila de la
 * plataforma), sin agotar, y repartidas (`ordenDeLasCuentas`: primero la que menos % gastó según el vigía; sin ese dato, una
 * distinta primero en cada turno). La PLATAFORMA saltea la cuenta que llegó al 90%: ese resto queda para WhatsApp. Vacío con el
 * interruptor de ese uso apagado, o si algo no se pudo leer (falla cerrada: nunca se gasta por un bache). Devuelve NOMBRES,
 * nunca claves. Quién PUEDE usarlas lo decide `puedeUsarUnaCuentaDelCredito` (lib/veto-claude.ts), no esto.
 */
export async function cuentasDelCredito(para: UsoDelCredito): Promise<string[]> {
  try {
    const wsSA = await wsSuperAdmin();
    const valor = await runWithWorkspace(wsSA, () => getSettingEstricto(interruptorDe(para)));
    if (!esInterruptorPrendido(valor)) return [];
    const con: string[] = [];
    for (const nombre of CLAVES_CREDITO_DE_LOS_GRUPOS) {
      if ((agotadas.get(nombre) ?? 0) > Date.now()) continue;
      const k = process.env[nombre]?.trim() || (await credWsEstricta(nombre, wsSA, { ilegibleTira: true }))?.trim();
      if (k) con.push(nombre);
    }
    if (!con.length) return [];
    // El % del vigía ordena; si no se puede leer, el reparto de siempre (no es una falla: nada se gasta por esto).
    const uso = leerUsoDelCredito(await runWithWorkspace(wsSA, () => getSetting(CLAVE_USO_DEL_CREDITO)).catch(() => null), Date.now());
    return ordenDeLasCuentas(con, uso, para, reparto.n++);
  } catch (e) {
    console.error(`[credito-negocio] no pude leer el crédito (${para}): ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

/** Las cuentas del crédito de los GRUPOS de WhatsApp (el nombre de siempre: lo fija tests/doer-su-ia.test.ts). */
export const cuentasDelCreditoDeLosGrupos = (): Promise<string[]> => cuentasDelCredito('grupos');

/**
 * La clave de UNA cuenta del crédito (la elige `cuentasDelCredito`). null si no es de la lista, no está, o el interruptor de ESE
 * uso está apagado o no se pudo leer: la puerta 2 lo mira también, no sólo quien elige la cuenta.
 */
export async function claveDeLaCuentaDeLosGrupos(nombre: string, para: UsoDelCredito = 'grupos'): Promise<string | null> {
  if (!CLAVES_CREDITO_DE_LOS_GRUPOS.includes(nombre)) return null;
  try {
    const wsSA = await wsSuperAdmin();
    if (!esInterruptorPrendido(await runWithWorkspace(wsSA, () => getSettingEstricto(interruptorDe(para))))) return null;
    return process.env[nombre]?.trim() || (await credWsEstricta(nombre, wsSA, { ilegibleTira: true }))?.trim() || null;
  } catch { return null; }
}

/** La cuenta contestó «credit balance is too low»: se saltea hasta el próximo ciclo (6 h, por proceso). */
export function marcarCuentaDeLosGruposSinCredito(nombre: string): void {
  agotadas.set(nombre, Date.now() + SIN_CREDITO_MS);
}

/** Prende o apaga el crédito de ese negocio (SuperAdmin › Uso). Sólo un negocio de la lista. */
export async function guardarInterruptorDeCredito(ws: number, prendido: boolean): Promise<void> {
  if (!CREDITO_DE_UN_NEGOCIO.some((c) => c.ws === ws)) throw new Error('Ese negocio no tiene un crédito asignado.');
  await runWithWorkspace(await wsSuperAdmin(), () => setSetting(claveDelInterruptorDeCredito(ws), prendido ? 'prendido' : 'apagado'));
}
