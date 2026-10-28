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
import { aadDeCopia, aadDeLlave, normalizarEmail, problemaDeClave, vencida, VERSION_COPIA, VUELTAS, type CopiaV1, type LlaveGuardada } from './reglas';

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
  const dek = await importarLlave(r.llave);
  const c = await cifrarJson(copia, dek, aadDeCopia(p.email, copia.negocio.id));
  await p.almacen.guardarCopia({ ws: copia.negocio.id, iv: c.iv, datos: c.datos, version: VERSION_COPIA });
  await p.almacen.guardarLlave({ ...guardada, vistoServidor: new Date().toISOString() } satisfies LlaveGuardada);
  return 'guardada';
}

export type ResultadoAbrir =
  | { ok: true; copias: CopiaV1[]; viejas: number }
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
  if (vencida(guardada.vistoServidor, p.ahora)) { await p.almacen.borrar(); return { ok: false, motivo: 'vencida' }; }
  const copias: CopiaV1[] = [];
  let viejas = 0;
  for (const c of await p.almacen.leerCopias()) {
    // Una copia de un formato que este cascarón no conoce no se abre: se cuenta, y la pantalla pide abrir MaKo con conexión.
    if (c.version !== VERSION_COPIA) { viejas++; continue; }
    try { copias.push(await descifrarJson<CopiaV1>({ iv: c.iv, datos: c.datos }, dek, aadDeCopia(p.email, c.ws))); } catch { viejas++; }
  }
  copias.sort((a, b) => a.negocio.nombre.localeCompare(b.negocio.nombre));
  return { ok: true, copias, viejas };
}

/** El email tal como lo comparan la base y los AAD. */
export { normalizarEmail };
