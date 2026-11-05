// =============================================================================
// spy-claves — VARIAS claves de Spy en un negocio: en qué orden se prueban y cuándo se pasa a la siguiente (5/11/2026)
// =============================================================================
// Martín, 5/11/2026: «Dame la opción de tener varias claves de apify» y «dame la opción también en integraciones de cargar más
// api». La clave de Spy (la de Apify que el negocio conecta en Integraciones) se queda sin crédito: el 5/11 la de la plataforma
// iba en US$8,01 de 10. Con varias, MaKo usa la primera con crédito y pasa a la siguiente cuando una se agota.
//
// El patrón es el de Zernio (29/10/2026, lib/zernio.ts → `clavesZernio`): la 1 es la de siempre y las extra son
// `APIFY_INSTAGRAM_TOKEN_2…_5` (lib/instagram-perfil.ts → `CLAVES_APIFY_DE_SPY`), cada una de OTRA cuenta de Apify del negocio,
// con un nombre opcional para reconocerla. Quién las LEE es uno solo: `clavesApifyDeSpy` (lib/instagram-perfil-server.ts).
//
// Lo de acá es puro, sin la red ni la base: lo usan Spy (lectura, búsqueda, traída larga, guion), la biblioteca de carruseles
// (scripts/carruseles-biblioteca.mts) y el test.
//
// ⚠️ SÓLO LA FALTA DE CRÉDITO PASA A LA SIGUIENTE (`esFaltaDeCredito`). Un 401 (la clave no entra), un 500 o un corte de red se
// contestan como siempre: otra cuenta no arregla una clave rota, y saltar por eso gastaría la plata de otra cuenta sin que nadie
// se entere de que la primera está rota.
// ⚠️ LA CLAVE NUNCA SALE DE ACÁ: lo que se muestra, se loguea o se guarda es su número, su nombre o su HUELLA (sha256 corto).
// =============================================================================

import { esFaltaDeCredito, RESERVA_CREDITO_USD, type CreditoApify } from './spy-todo-reglas';

/** Una clave de Spy del negocio. `token` se usa para pedir y nada más: nunca se imprime ni se devuelve en una respuesta. */
export type ClaveApify = { token: string; slot: number; nombre: string | null; huella: string };

/** Lo que contesta un pedido a Apify, en la forma que mira la rotación. */
export type RespuestaApify = { status: number; cuerpo: unknown };

/** Cuánto se recuerda que una clave se quedó sin crédito: mientras, se prueba después de las demás (no se saltea). */
export const AGOTADA_MS = 30 * 60_000;

const g = globalThis as unknown as { __apifyAgotadas?: Map<string, number> };
/** huella → hasta cuándo se la da por agotada. En memoria de la instancia: es un orden, no una verdad. */
const agotadas = (g.__apifyAgotadas ??= new Map<string, number>());

export function marcarAgotada(huella: string, ahora = Date.now()): void {
  agotadas.set(huella, ahora + AGOTADA_MS);
}
export function olvidarAgotada(huella: string): void {
  agotadas.delete(huella);
}
export function estaAgotada(huella: string, ahora = Date.now()): boolean {
  const hasta = agotadas.get(huella);
  if (hasta == null) return false;
  if (hasta <= ahora) { agotadas.delete(huella); return false; }
  return true;
}
/** Para los tests: arranca sin nada recordado. */
export function olvidarTodasLasAgotadas(): void {
  agotadas.clear();
}

/** El orden en que se prueban: por su número, y las que se agotaron hace poco al final (no se descartan: pudo cargar crédito). */
export function ordenDeClaves<T extends Pick<ClaveApify, 'slot' | 'huella'>>(claves: readonly T[], ahora = Date.now()): T[] {
  const porNumero = [...claves].sort((a, b) => a.slot - b.slot);
  return [...porNumero.filter((k) => !estaAgotada(k.huella, ahora)), ...porNumero.filter((k) => estaAgotada(k.huella, ahora))];
}

/**
 * Hace UN pedido a Apify con la primera clave que tenga crédito: si contesta «sin crédito», prueba la siguiente; cualquier otra
 * respuesta (bien, un 401, un 500) es la que vale y se devuelve, con la clave que la dio. Si todas contestan «sin crédito», vuelve
 * la última respuesta. null = no hay ninguna clave. Un pedido que TIRA (la red, un tiempo de espera) no es falta de crédito: el
 * error sube tal cual y no se prueba la siguiente.
 */
export async function conLaPrimeraConCredito<R extends RespuestaApify>(
  claves: readonly ClaveApify[], pedir: (clave: ClaveApify) => Promise<R>, ahora = Date.now(),
): Promise<(R & { clave: ClaveApify; saltadas: number }) | null> {
  let ultima: (R & { clave: ClaveApify; saltadas: number }) | null = null;
  let saltadas = 0;
  for (const clave of ordenDeClaves(claves, ahora)) {
    const r = await pedir(clave);
    if (!esFaltaDeCredito(r.status, r.cuerpo)) {
      if (r.status >= 200 && r.status < 300) olvidarAgotada(clave.huella);
      return { ...r, clave, saltadas };
    }
    marcarAgotada(clave.huella, ahora);
    ultima = { ...r, clave, saltadas };
    saltadas += 1;
  }
  return ultima;
}

/** La clave con esa huella; sin huella (lo pedido antes de las varias claves), la primera por número. null si ya no está. */
export function claveDeHuella(claves: readonly ClaveApify[], huella: string | null | undefined): ClaveApify | null {
  if (!huella) return [...claves].sort((a, b) => a.slot - b.slot)[0] ?? null;
  return claves.find((k) => k.huella === huella) ?? null;
}

/** Cómo se nombra una clave para una persona: «clave 2 (Mi cuenta)». Nunca la clave. */
export function rotuloDeClave(k: Pick<ClaveApify, 'slot' | 'nombre'>): string {
  return `clave ${k.slot}${k.nombre ? ` (${k.nombre})` : ''}`;
}

/** Con punto, como el script de la biblioteca y la audiencia (México). */
const usd = (n: number) => `US$${n.toFixed(2)}`;

/**
 * El crédito de cada clave y el total, en renglones para una persona (la tarjeta de Integraciones, la API de MaKo, el script de
 * la biblioteca). `creditos[i]` es el de `claves[i]`; null = no se pudo leer (se dice, no se inventa un cero). Sin claves.
 */
export function resumenDeCredito(
  claves: ReadonlyArray<Pick<ClaveApify, 'slot' | 'nombre'>>, creditos: ReadonlyArray<CreditoApify | null>,
): { porClave: Array<{ rotulo: string; texto: string; sinCredito: boolean | null }>; total: string | null } {
  const porClave = claves.map((k, i) => {
    const c = creditos[i] ?? null;
    const rotulo = rotuloDeClave(k);
    if (!c) return { rotulo, texto: 'no pude leer su crédito', sinCredito: null };
    const libre = Math.max(0, c.tope - c.usado);
    return { rotulo, texto: `usó ${usd(c.usado)} de ${usd(c.tope)} este mes · le quedan ${usd(libre)}`, sinCredito: libre <= 0 };
  });
  const sabidos = creditos.filter((c): c is CreditoApify => !!c);
  const libreTotal = sabidos.reduce((n, c) => n + Math.max(0, c.tope - c.usado), 0);
  // Lo que va después de «Libre en total:».
  const total = sabidos.length
    ? `${usd(libreTotal)} este mes${sabidos.length < claves.length ? ' (sin las que no pude leer)' : ''}. Se guardan ${usd(RESERVA_CREDITO_USD)} para leer en Spy.`
    : null;
  return { porClave, total };
}
