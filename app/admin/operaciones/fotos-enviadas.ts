// =============================================================================
// Las fotos de los mensajes enviados (17/10/2026; en cualquier dispositivo desde el 23/10): por qué y cómo, en FotosEnviadas.tsx
// =============================================================================
// ⚠️ SIN 'use client' a propósito: lo llama el motor (useCentro.ts), que no lleva la directiva, y un valor de un módulo
//    'use client' no se importa desde uno que no la tiene (tests/frontera-use-client.test.ts). Corre sólo en el navegador.
//
// De dónde sale la foto de una burbuja, en este orden:
//   1. la memoria de este navegador: lo que mandó en esta sesión (el original, se ve en el acto);
//   2. el SERVIDOR: la miniatura que subió el navegador que la mandó (desde el 23/10/2026), con una URL firmada de 10
//      minutos, si trae TODAS las fotos del trabajo;
//   3. IndexedDB (`enviado:<id>`): la copia de la miniatura que guarda el navegador que la mandó, ANTES de subirla. Si se
//      cerró la pestaña a mitad de la subida, ese navegador la sigue teniendo después de un F5. Se barre la de un trabajo
//      que ya no está en la conversación (`barrerEnviadasViejas`).

import { direccionesGuardadas, guardarAdjuntos, leerAdjuntosGuardados } from './adjuntos-guardados';
import { crearPedidorDeFotos, type FotoRemota } from './fotos-remotas';
import { MAX_BYTES_MINIATURA, type AdjuntoPedido } from '@/lib/operaciones-reglas';

export type Foto = FotoRemota;
/** Lo que este navegador tiene de cada trabajo (por su id): lo que mandó, o su copia en IndexedDB. */
const leidas = new Map<string, Foto[]>();
const PREFIJO = 'enviado:';
const direccionDe = (id: string) => `${PREFIJO}${id}`;
const LADO_MINIATURA = 640;

/**
 * La miniatura de una foto: dibujada de nuevo en un lienzo, a 640 px y en JPEG. null si no se pudo: NUNCA el original,
 * que trae su EXIF (la ubicación incluida) y quedaría 14 días en el servidor (revisión del 23/10/2026).
 */
async function miniatura(f: File, nombre: string): Promise<File | null> {
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, LADO_MINIATURA / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(bmp.width * k));
    lienzo.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = lienzo.getContext('2d');
    if (!ctx) { bmp.close(); return null; }
    ctx.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.78));
    return blob ? new File([blob], nombre, { type: 'image/jpeg' }) : null;
  } catch { return null; }
}

const servidor = crearPedidorDeFotos(async (ids) => {
  try {
    const r = await fetch(`/api/operaciones/adjuntos?enviadas=${ids.map(encodeURIComponent).join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    const o = (await r.json()) as { ok?: boolean; fotos?: Record<string, Foto[]> };
    return r.ok && o.ok && o.fotos && typeof o.fotos === 'object' ? o.fotos : null;
  } catch { return null; }
});

/**
 * Lo llama el motor (useCentro.ts → mandar) apenas el trabajo salió: la foto se ve en el acto, su miniatura queda en
 * IndexedDB y después sube al servidor, para verla en otro dispositivo. `subidos` son los adjuntos del trabajo, en el
 * MISMO orden que `archivos` (mandar.ts → subirAdjuntos): cada foto va con el `ref` de su original. Es foto lo que el
 * trabajo FIRMÓ como foto (`a.mime`, sacado de los bytes), no el tipo que dice el navegador (algunos selectores de Android
 * lo dejan vacío). Si no coinciden (otro tamaño), esa no sube. Si la subida falla, no se avisa: en otro dispositivo se ve
 * su nombre, como antes.
 * ⚠️ El NOMBRE es el firmado (`a.nombre`, saneado y recortado), no el del archivo: la burbuja separa fotos de documentos
 *    comparando con los nombres del trabajo, y con otro nombre se vería la foto Y su renglón (segunda revisión, 23/10).
 * ⚠️ DE A UNA: cada foto se decodifica, se guarda en IndexedDB y sube antes de pasar a la siguiente. Decodificar 20 fotos
 *    de 12 MP juntas es un pico de memoria que el teléfono no aguanta, y subir cada una apenas está achica la ventana en
 *    que otro dispositivo ve el mensaje sin todas sus fotos.
 */
export function recordarEnviadas(id: string, archivos: readonly File[], subidos: readonly AdjuntoPedido[]) {
  const pares = archivos.map((f, i) => ({ f, a: subidos[i] })).filter(({ f, a }) => !!a && a.mime.startsWith('image/') && a.bytes === f.size);
  if (!pares.length) return;
  leidas.set(id, pares.map(({ f, a }) => ({ url: URL.createObjectURL(f), nombre: a.nombre })));
  void (async () => {
    const hechas: File[] = [];
    for (const { f, a } of pares) {
      const m = await miniatura(f, a.nombre);
      if (!m || m.size > MAX_BYTES_MINIATURA) continue;
      hechas.push(m);
      await guardarAdjuntos(direccionDe(id), hechas);
      const q = `miniatura=${encodeURIComponent(id)}&ref=${encodeURIComponent(a.ref)}`;
      await fetch(`/api/operaciones/adjuntos?${q}`, { method: 'POST', headers: { 'content-type': m.type }, body: m, signal: AbortSignal.timeout(30_000) }).catch(() => null);
    }
  })();
}

/**
 * Las fotos de un mensaje que todavía está SALIENDO (envios-en-curso.ts, 27/10/2026): se ven en el acto con el id local, sin
 * subir nada. Cuando sale, `recordarEnviadas` las vuelve a anotar con el id de verdad y sube sus miniaturas.
 */
export function verFotosLocales(id: string, archivos: readonly File[]) {
  const fotos = archivos.filter((f) => f.type.startsWith('image/'));
  if (fotos.length) leidas.set(id, fotos.map((f) => ({ url: URL.createObjectURL(f), nombre: f.name })));
}

/** La primera vuelta a preguntar por las fotos que faltan, y hasta cuánto después de mandar se sigue preguntando. */
export const PRIMER_REINTENTO_MS = 12_000;
export const TOPE_REINTENTOS_MS = 3 * 60 * 1000;
/**
 * Cuánto esperar para volver a preguntar por las fotos que faltan (null = no se pregunta más). La primera vez siempre; las
 * siguientes, el doble cada vez (12, 24, 48 s…) mientras el mensaje tenga menos de `TOPE_REINTENTOS_MS`: con 15 fotos, la
 * subida tarda más que un solo reintento. Un mensaje viejo no se queda preguntando.
 */
export function proximoIntento(intento: number, creado: number, ahora: number): number | null {
  if (intento === 0) return PRIMER_REINTENTO_MS;
  if (!Number.isFinite(creado) || ahora - creado > TOPE_REINTENTOS_MS) return null;
  return PRIMER_REINTENTO_MS * 2 ** intento;
}

/** Las fotos de un trabajo que ya se saben sin preguntar nada (null = todavía no). */
export const fotosYaLeidas = (id: string): Foto[] | null => leidas.get(id) ?? servidor.yaSabidas(id);

/**
 * Las fotos de un trabajo: de este navegador, del servidor (sólo si el trabajo dice tener `esperadas` fotos) o de su copia
 * en IndexedDB. Gana la que trae más: el servidor puede estar a mitad de recibirlas.
 */
export async function leerFotosEnviadas(id: string, esperadas: number): Promise<Foto[]> {
  const ya = leidas.get(id);
  if (ya) return ya;
  const remotas = esperadas > 0 ? await servidor.pedir(id, esperadas) : [];
  if (esperadas > 0 && remotas.length >= esperadas) return remotas;
  const locales = (await leerAdjuntosGuardados(direccionDe(id))).map((f) => ({ url: URL.createObjectURL(f), nombre: f.name }));
  if (locales.length > remotas.length) { leidas.set(id, locales); return locales; }
  return remotas;
}

/**
 * Los adjuntos de una burbuja que NO tienen foto (van como renglón con su nombre). Se resta contando repeticiones: dos
 * capturas pegadas se llaman las dos «image.png», y con una sola foto a la vista la otra tiene que seguir en la lista.
 */
export function nombresSinFoto(nombres: readonly string[], fotos: readonly { nombre: string }[]): string[] {
  const quedan = new Map<string, number>();
  for (const f of fotos) quedan.set(f.nombre, (quedan.get(f.nombre) ?? 0) + 1);
  return nombres.filter((n) => {
    const k = quedan.get(n) ?? 0;
    if (!k) return true;
    quedan.set(n, k - 1);
    return false;
  });
}

/** De las direcciones guardadas en IndexedDB, las miniaturas de trabajos que ya no están en la conversación. */
export function enviadasParaBorrar(direcciones: readonly string[], vigentes: ReadonlySet<string>): string[] {
  return direcciones.filter((d) => d.startsWith(PREFIJO) && !vigentes.has(d.slice(PREFIJO.length)));
}

/** Desde cuándo una copia de IndexedDB se puede barrer: una más nueva pudo escribirla OTRA pestaña recién. */
export const COPIA_NUEVA_MS = 60 * 60 * 1000;
/** ¿Esta copia es vieja? Todos sus archivos (las miniaturas llevan la fecha en que se hicieron) de antes de `COPIA_NUEVA_MS`. */
export const copiaVieja = (archivos: ReadonlyArray<{ lastModified: number }>, ahora: number): boolean =>
  archivos.every((f) => ahora - f.lastModified > COPIA_NUEVA_MS);

let barrida = false;
/**
 * Barre, una vez por carga, las miniaturas de IndexedDB que ya no tienen burbuja: las de los trabajos que no vinieron en
 * la conversación (`vigentes`, la cola entera que dibuja el Ops Center). Con la cola vacía no hace nada: una lectura que
 * falló no es «no hay trabajos». Y nunca una copia de la última hora: la cola de esta pestaña es de cuando se cargó, y
 * otra pestaña del mismo navegador pudo mandar algo después (segunda revisión, 23/10).
 */
export async function barrerEnviadasViejas(vigentes: readonly string[], ahora = Date.now()): Promise<void> {
  if (barrida || !vigentes.length) return;
  barrida = true;
  // Lo que este navegador mandó en esta carga tampoco se barre, aunque la cola todavía no lo traiga.
  const borrar = enviadasParaBorrar(await direccionesGuardadas(), new Set([...vigentes, ...leidas.keys()]));
  for (const d of borrar) if (copiaVieja(await leerAdjuntosGuardados(d), ahora)) await guardarAdjuntos(d, []);
}
