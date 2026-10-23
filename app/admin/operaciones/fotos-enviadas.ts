// =============================================================================
// Las fotos de los mensajes enviados (17/10/2026; en cualquier dispositivo desde el 23/10): por qué y cómo, en FotosEnviadas.tsx
// =============================================================================
// ⚠️ SIN 'use client' a propósito: lo llama el motor (useCentro.ts), que no lleva la directiva, y un valor de un módulo
//    'use client' no se importa desde uno que no la tiene (tests/frontera-use-client.test.ts). Corre sólo en el navegador.
//
// De dónde sale la foto de una burbuja, en este orden:
//   1. la memoria de este navegador: lo que mandó en esta sesión (el original, se ve en el acto);
//   2. el SERVIDOR: la miniatura que subió el navegador que la mandó (desde el 23/10/2026), con una URL firmada de 10 minutos;
//   3. IndexedDB (`enviado:<id>`): la miniatura que este navegador guardaba ANTES del 23/10. Ya no se escribe: se lee para
//      no perder las fotos de esos días, y se barre la de un trabajo que ya no está en la conversación (`barrerEnviadasViejas`).

import { direccionesGuardadas, guardarAdjuntos, leerAdjuntosGuardados } from './adjuntos-guardados';
import { crearPedidorDeFotos, type FotoRemota } from './fotos-remotas';
import { MAX_BYTES_MINIATURA, type AdjuntoPedido } from '@/lib/operaciones-reglas';

export type Foto = FotoRemota;
/** Lo que este navegador tiene de cada trabajo (por su id): lo que mandó, o lo que guardaba antes del 23/10. */
const leidas = new Map<string, Foto[]>();
const PREFIJO = 'enviado:';
const direccionDe = (id: string) => `${PREFIJO}${id}`;
const LADO_MINIATURA = 640;

async function miniatura(f: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, LADO_MINIATURA / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(bmp.width * k));
    lienzo.height = Math.max(1, Math.round(bmp.height * k));
    lienzo.getContext('2d')?.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.78));
    return blob ? new File([blob], f.name, { type: 'image/jpeg' }) : f;
  } catch { return f; }
}

const servidor = crearPedidorDeFotos(async (ids) => {
  try {
    const r = await fetch(`/api/operaciones/adjuntos?enviadas=${ids.map(encodeURIComponent).join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    const o = (await r.json()) as { ok?: boolean; fotos?: Record<string, Foto[]> };
    return r.ok && o.ok && o.fotos && typeof o.fotos === 'object' ? o.fotos : null;
  } catch { return null; }
});

/**
 * Lo llama el motor (useCentro.ts → mandar) apenas el trabajo salió: la foto se ve en el acto y su miniatura sube al
 * servidor, para verla en otro dispositivo. `subidos` son los adjuntos del trabajo, en el MISMO orden que `archivos`
 * (mandar.ts → subirAdjuntos): cada foto va con el `ref` de su original. Si no coinciden (otro tamaño), esa no sube.
 * Si la subida falla, no se avisa: en otro dispositivo se ve su nombre, como antes.
 */
export function recordarEnviadas(id: string, archivos: readonly File[], subidos: readonly AdjuntoPedido[]) {
  const pares = archivos.map((f, i) => ({ f, a: subidos[i] })).filter(({ f, a }) => f.type.startsWith('image/') && a && a.bytes === f.size);
  if (!pares.length) return;
  leidas.set(id, pares.map(({ f }) => ({ url: URL.createObjectURL(f), nombre: f.name })));
  void (async () => {
    for (const { f, a } of pares) {
      const m = await miniatura(f);
      if (!m.type.startsWith('image/') || m.size > MAX_BYTES_MINIATURA) continue;
      const q = `miniatura=${encodeURIComponent(id)}&ref=${encodeURIComponent(a.ref)}`;
      await fetch(`/api/operaciones/adjuntos?${q}`, { method: 'POST', headers: { 'content-type': m.type }, body: m, signal: AbortSignal.timeout(30_000) }).catch(() => null);
    }
  })();
}

/** Las fotos de un trabajo que ya se saben sin preguntar nada (null = todavía no). */
export const fotosYaLeidas = (id: string): Foto[] | null => leidas.get(id) ?? servidor.yaSabidas(id);

/** Las fotos de un trabajo: de este navegador, del servidor (sólo si el trabajo tiene fotos) o de lo guardado antes del 23/10. */
export async function leerFotosEnviadas(id: string, conFotos: boolean): Promise<Foto[]> {
  const ya = leidas.get(id);
  if (ya) return ya;
  if (conFotos) {
    const remotas = await servidor.pedir(id);
    if (remotas.length) return remotas;
  }
  const antes = (await leerAdjuntosGuardados(direccionDe(id))).map((f) => ({ url: URL.createObjectURL(f), nombre: f.name }));
  if (antes.length) leidas.set(id, antes);
  return antes;
}

/** De las direcciones guardadas en IndexedDB, las miniaturas de antes del 23/10 cuyo trabajo ya no está en la conversación. */
export function enviadasParaBorrar(direcciones: readonly string[], vigentes: ReadonlySet<string>): string[] {
  return direcciones.filter((d) => d.startsWith(PREFIJO) && !vigentes.has(d.slice(PREFIJO.length)));
}

let barrida = false;
/**
 * Barre, una vez por carga, las miniaturas que este navegador guardaba antes del 23/10 y que ya no tienen burbuja: las de
 * los trabajos que no vinieron en la conversación (`vigentes`, la cola entera que dibuja el Ops Center). Con la cola
 * vacía no hace nada: una lectura que falló no es «no hay trabajos».
 */
export async function barrerEnviadasViejas(vigentes: readonly string[]): Promise<void> {
  if (barrida || !vigentes.length) return;
  barrida = true;
  const borrar = enviadasParaBorrar(await direccionesGuardadas(), new Set(vigentes));
  for (const d of borrar) await guardarAdjuntos(d, []);
}
