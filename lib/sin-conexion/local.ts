// =============================================================================
// MaKo sin conexión — activar, guardar la copia y abrirla (28/10/2026)
// =============================================================================
// La lógica, contra la interfaz `Almacen` (./almacen.ts) y con el servidor por parámetro: corre en la app (con conexión), en el
// cascarón (sin conexión) y en los tests (con un almacén en memoria).
//
//   activar      → la persona elige la clave de esta computadora: se pide la DEK al servidor y se guarda ENVUELTA con la clave.
//   guardarCopia → con conexión, cada `CADA_MS`: la DEK la vuelve a dar el servidor (sin pedir la clave) y la copia del negocio se
//                  guarda cifrada. Si el servidor dice que esta computadora fue desconectada, se borra todo.
//   abrir        → sin conexión: la clave desenvuelve la DEK y la DEK abre cada copia. Clave equivocada = nada.
// =============================================================================

import type { Almacen } from './almacen';
import { aBase64url, alAzar, cifrarBytes, cifrarJson, deBase64url, descifrarBytes, descifrarJson, huellaDe, importarLlave, llaveDeLaClave } from './cifra';
import { aadDeCola, aadDeCopia, aadDeLlave, conLoDeAntes, normalizarEmail, problemaDeClave, vencida, VERSION_COPIA, VUELTAS, type CopiaV1, type LlaveGuardada } from './reglas';
import { TOPE_COLA, validarOperacion, type Operacion } from './cola';

/** Lo que contesta el servidor por la llave: la DEK, o que esta computadora ya no tiene permiso. */
export type RespuestaLlave = { ok: true; llave: Uint8Array } | { ok: false; desconectada: boolean; error: string };
export type PedirLlave = (dispositivo: string) => Promise<RespuestaLlave>;

export async function activar(p: { email: string; clave: string; repetida?: string; almacen: Almacen; pedirLlave: PedirLlave; vueltas?: number }): Promise<{ ok: true } | { ok: false; error: string }> {
  const problema = problemaDeClave(p.clave, p.repetida);
  if (problema) return { ok: false, error: problema };
  // Una computadora ya activada conserva su id: elegir otra clave (la olvidó) no cambia de llave.
  const previa = await p.almacen.leerLlave().catch(() => null);
  const dispositivo = previa?.dispositivo ?? aBase64url(alAzar(16));
  const r = await p.pedirLlave(dispositivo);
  if (!r.ok) return { ok: false, error: r.error };
  const vueltas = p.vueltas ?? VUELTAS;
  const sal = alAzar(16);
  const kek = await llaveDeLaClave(p.clave, sal, vueltas);
  const env = await cifrarBytes(r.llave, kek, aadDeLlave(p.email, dispositivo));
  await p.almacen.guardarLlave({
    dispositivo, sal: aBase64url(sal), vueltas, iv: env.iv, envuelta: env.datos, huella: await huellaDe(r.llave), vistoServidor: new Date().toISOString(),
  });
  return { ok: true };
}

/**
 * `otra-llave`: el servidor da hoy OTRA llave que la envuelta (se rotó su secreto). Una copia cifrada con ésa no abriría con
 * la clave de esta computadora: no se guarda, y la persona elige la clave de nuevo (Settings › Instalar la app).
 */
export type ResultadoGuardar = 'guardada' | 'sin-activar' | 'desconectada' | 'otra-llave' | 'sin-copia' | 'error';

export async function guardarCopia(p: { email: string; almacen: Almacen; pedirLlave: PedirLlave; pedirCopia: () => Promise<CopiaV1 | null> }): Promise<ResultadoGuardar> {
  const guardada = await p.almacen.leerLlave().catch(() => null);
  if (!guardada) return 'sin-activar';
  const r = await p.pedirLlave(guardada.dispositivo);
  if (!r.ok) {
    if (r.desconectada) { await p.almacen.borrar(); return 'desconectada'; }
    return 'error';
  }
  if (guardada.huella !== (await huellaDe(r.llave))) return 'otra-llave';
  const copia = await p.pedirCopia();
  if (!copia || copia.version !== VERSION_COPIA) return 'sin-copia';
  // La copia es de OTRA sesión (la cookie cambió de cuenta entre la llave y la copia): no se cifra en la base de ésta.
  if (copia.persona.email && normalizarEmail(copia.persona.email) !== normalizarEmail(p.email)) return 'sin-copia';
  const dek = await importarLlave(r.llave);
  // Una renovación a medias no pisa lo bueno: lo que no se pudo leer sale de la copia anterior (`conLoDeAntes`).
  const incompleta = !copia.crm || !copia.plan || !!copia.huecos;
  const final = incompleta ? conLoDeAntes(copia, await copiaAnterior(p.almacen, dek, p.email, copia.negocio.id)) : copia;
  const c = await cifrarJson(final, dek, aadDeCopia(p.email, copia.negocio.id));
  await p.almacen.guardarCopia({ ws: copia.negocio.id, iv: c.iv, datos: c.datos, version: VERSION_COPIA });
  await p.almacen.guardarLlave({ ...guardada, vistoServidor: new Date().toISOString() } satisfies LlaveGuardada);
  return 'guardada';
}

/** La copia guardada de ese negocio, abierta con la DEK; null si no hay o no abre. */
async function copiaAnterior(almacen: Almacen, dek: CryptoKey, email: string, ws: number): Promise<CopiaV1 | null> {
  const guardada = (await almacen.leerCopias().catch(() => [])).find((c) => c.ws === ws && c.version === VERSION_COPIA);
  if (!guardada) return null;
  try { return await descifrarJson<CopiaV1>({ iv: guardada.iv, datos: guardada.datos }, dek, aadDeCopia(email, ws)); } catch { return null; }
}

/**
 * `llave`: la DEK abierta, para escribir en la cola mientras la pantalla está abierta. Quien la recibe la guarda en la
 * PANTALLA (un cierre de la vista), nunca en el módulo: al bloquear se va con lo dibujado (lib/sin-conexion/cascaron.ts).
 * `cola`: los cambios hechos sin conexión que todavía no subieron, en orden.
 */
export type ResultadoAbrir =
  | { ok: true; copias: CopiaV1[]; viejas: number; llave: CryptoKey; cola: Operacion[] }
  | { ok: false; motivo: 'nada' | 'clave' | 'vencida' };

export async function abrir(p: { email: string; clave: string; almacen: Almacen; ahora?: number }): Promise<ResultadoAbrir> {
  const guardada = await p.almacen.leerLlave().catch(() => null);
  if (!guardada) return { ok: false, motivo: 'nada' };
  let dek: CryptoKey;
  try {
    const kek = await llaveDeLaClave(p.clave, deBase64url(guardada.sal), guardada.vueltas);
    dek = await importarLlave(await descifrarBytes({ iv: guardada.iv, datos: guardada.envuelta }, kek, aadDeLlave(p.email, guardada.dispositivo)));
  } catch {
    return { ok: false, motivo: 'clave' };
  }
  // Recién con la clave correcta: alguien que prueba un email ajeno no se entera de que hubo algo (ni lo borra).
  // ⚠️ Con cambios sin subir NO se borra (T2): perder lo que la persona escribió es peor que mostrarle una copia vieja.
  const cola = await leerColaCon({ email: p.email, llave: dek, almacen: p.almacen });
  if (vencida(guardada.vistoServidor, p.ahora) && !cola.length) { await p.almacen.borrar(); return { ok: false, motivo: 'vencida' }; }
  const { copias, viejas } = await copiasYViejas({ email: p.email, llave: dek, almacen: p.almacen, ahora: p.ahora, conCola: new Set(cola.map((o) => o.ws)) });
  return { ok: true, copias, viejas, llave: dek, cola };
}

/**
 * Cada copia vence por SU fecha, no sólo por la última vez que el servidor dio la llave (verificación de 90d6410eb): quien
 * dejó de tener un negocio y entra a diario por otro no puede seguir viendo el primero para siempre. La de un negocio con
 * cambios sin subir (`conCola`) no vence: sin ella no se puede nombrar ni revisar lo que la persona escribió.
 */
async function copiasYViejas(p: { email: string; llave: CryptoKey; almacen: Almacen; ahora?: number; conCola?: ReadonlySet<number> }): Promise<{ copias: CopiaV1[]; viejas: number }> {
  const copias: CopiaV1[] = [];
  let viejas = 0;
  for (const c of await p.almacen.leerCopias()) {
    // Una copia de un formato que este cascarón no conoce no se abre: se cuenta, y la pantalla pide abrir MaKo con conexión.
    if (c.version !== VERSION_COPIA) { viejas++; continue; }
    let copia: CopiaV1;
    try { copia = await descifrarJson<CopiaV1>({ iv: c.iv, datos: c.datos }, p.llave, aadDeCopia(p.email, c.ws)); } catch { viejas++; continue; }
    if (vencida(copia.hecha, p.ahora) && !p.conCola?.has(c.ws)) continue;
    copias.push(copia);
  }
  copias.sort((a, b) => a.negocio.nombre.localeCompare(b.negocio.nombre));
  return { copias, viejas };
}

/** Las copias que abren con esta llave (la del servidor, con conexión): el panel las usa para nombrar cada cambio. */
export async function copiasCon(p: { email: string; llave: CryptoKey; almacen: Almacen }): Promise<CopiaV1[]> {
  return (await copiasYViejas(p)).copias;
}

// ── La cola (T2) ─────────────────────────────────────────────────────────────

/** Un id nuevo para un cambio: 16 bytes al azar (es su llave de idempotencia en el servidor). */
export const idDeCambio = (): string => aBase64url(alAzar(16));

/** Suma un cambio al final de la cola, cifrado. `false` = la cola está llena (`TOPE_COLA`). */
export async function encolar(p: { email: string; llave: CryptoKey; almacen: Almacen; op: Operacion }): Promise<boolean> {
  const hay = await p.almacen.leerCola();
  if (hay.length >= TOPE_COLA) return false;
  const seq = hay.reduce((m, c) => Math.max(m, c.seq), 0) + 1;
  const c = await cifrarJson(p.op, p.llave, aadDeCola(p.email, p.op.id));
  await p.almacen.guardarEnCola({ id: p.op.id, ws: p.op.ws, seq, iv: c.iv, datos: c.datos });
  return true;
}

/** La cola descifrada, en el orden en que se escribió. Lo que no abre con esta llave (de otra persona) no aparece. */
export async function leerColaCon(p: { email: string; llave: CryptoKey; almacen: Almacen }): Promise<Operacion[]> {
  const filas = [...(await p.almacen.leerCola().catch(() => []))].sort((a, b) => a.seq - b.seq);
  const out: Operacion[] = [];
  for (const f of filas) {
    try {
      const op = validarOperacion(await descifrarJson<unknown>({ iv: f.iv, datos: f.datos }, p.llave, aadDeCola(p.email, f.id)));
      if (op && op.id === f.id) out.push(op);
    } catch { /* de otra llave: no es de esta persona */ }
  }
  return out;
}

/**
 * Con conexión, la cola se lee con la llave que da el servidor (sin pedir la clave). Si el servidor da OTRA llave que la
 * envuelta (se rotó su secreto), esa llave no abre lo escrito: `otra-llave`, y la persona entra con su clave sin conexión
 * desde «Probar» para subirlo.
 */
export async function colaConLaLlaveDelServidor(p: { email: string; almacen: Almacen; pedirLlave: PedirLlave }): Promise<{ ok: true; cola: Operacion[]; llave: CryptoKey } | { ok: false; motivo: 'sin-activar' | 'otra-llave' | 'sin-llave' }> {
  const guardada = await p.almacen.leerLlave().catch(() => null);
  if (!guardada) return { ok: false, motivo: 'sin-activar' };
  const r = await p.pedirLlave(guardada.dispositivo);
  if (!r.ok) return { ok: false, motivo: 'sin-llave' };
  if (guardada.huella !== (await huellaDe(r.llave))) return { ok: false, motivo: 'otra-llave' };
  const llave = await importarLlave(r.llave);
  return { ok: true, llave, cola: await leerColaCon({ email: p.email, llave, almacen: p.almacen }) };
}

/** El email tal como lo comparan la base y los AAD. */
export { normalizarEmail };
