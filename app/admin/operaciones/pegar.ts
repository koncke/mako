// =============================================================================
// Pegar en la caja del Ops Center (17/10/2026)
// =============================================================================
// ⚠️ SIN CSS y sin 'use client': lo importa su test (en node un `.css` no carga) y lo re-exporta AdjuntosCaja.tsx.

import type { ClipboardEvent, DragEvent } from 'react';
import type { AdjuntosDeCaja } from './AdjuntosCaja';

/**
 * Pegar: una imagen del portapapeles entra como adjunto (17/10/2026, Martín: «pegar una imagen del portapapeles la adjunta»).
 * Lo que trae el portapapeles se lee de `items` Y de `files`: hay navegadores que dejan la imagen sólo en uno de los dos.
 * Una celda de Excel o un párrafo de Word viajan como texto Y como imagen: si hay TEXTO de verdad, se pega el texto (la misma
 * regla que el Second Brain). «Copiar imagen» de un navegador trae, además de la imagen, su dirección o su HTML: eso no es
 * texto escrito, y gana la imagen.
 */
export function alPegar(e: ClipboardEvent<HTMLTextAreaElement>, a: AdjuntosDeCaja | undefined) {
  if (!a) return;
  const fs = archivosDelPortapapeles(e.clipboardData);
  if (!fs.length) return;
  const texto = e.clipboardData.getData('text/plain').trim();
  if (texto && !/^(https?:\/\/|data:image\/)\S+$/i.test(texto)) return;
  e.preventDefault();
  if (!a.puede) { a.onNoPuede?.(); return; }
  a.onSumar(fs);
}

/** Los archivos del portapapeles, sin repetir: de `files` y de los `items` que son archivos. */
export function archivosDelPortapapeles(d: Pick<DataTransfer, 'files' | 'items'>): File[] {
  const out: File[] = Array.from(d.files ?? []);
  for (const it of Array.from(d.items ?? [])) {
    if (it.kind !== 'file') continue;
    const f = it.getAsFile();
    if (f && !out.some((x) => x.name === f.name && x.size === f.size && x.type === f.type)) out.push(f);
  }
  return out;
}

/**
 * Arrastrar y soltar (18/10/2026, Martín: «debería funcionar si ARRASTRO una img o un doc al chat, debería tomarlo, hoy ni
 * siquiera aquí en el Center funciona eso»). Sólo cuando lo arrastrado trae ARCHIVOS: un texto arrastrado sigue su camino.
 * Sin esto, soltar una imagen en la página la ABRÍA en la pestaña y se perdía lo escrito.
 */
export const traeArchivos = (d: Pick<DataTransfer, 'types'> | null | undefined): boolean => !!d && Array.from(d.types ?? []).includes('Files');

/** Soltó algo en la conversación: si son archivos, entran como adjuntos (los mismos topes y avisos que el «+»). */
export function alSoltar(e: DragEvent<HTMLElement>, a: AdjuntosDeCaja | undefined): void {
  if (!traeArchivos(e.dataTransfer)) return;
  e.preventDefault();
  if (!a) return;
  const fs = archivosDelPortapapeles(e.dataTransfer);
  if (!fs.length) return;
  if (!a.puede) { a.onNoPuede?.(); return; }
  a.onSumar(fs);
}

/**
 * El «Pegar» del «+» (20/10/2026, pedido 5e8b6bff; Martín: «si saqué una screen o tengo algo copiado, debería aparecer así
 * arriba para pegarlo en el chat»). El teclado de Android ofrece pegar una IMAGEN sólo en un campo que la acepta (un
 * contenteditable con `commitContent`); en el `<textarea>` de la caja no aparece. Por eso el «+» tiene «Pegar»: lee las
 * imágenes del portapapeles con `navigator.clipboard.read()` (el navegador pide permiso la primera vez). null = este
 * navegador no deja leerlo; [] = no hay una imagen copiada.
 */
/** Una captura ya ofrecida (pegada o descartada) no se vuelve a ofrecer. El portapapeles no da fecha: la firma es el tipo y
 *  el tamaño, que cambian con cada captura nueva. */
export const firmaDeCaptura = (f: Pick<File, 'type' | 'size'>): string => `${f.type}:${f.size}`;

/**
 * «PEGAR LA CAPTURA» ARRIBA DE LA CAJA (24/10/2026; Martín, el 17/10: «Debo poder pegar la imagen que tengo copiada; en el
 * celular, en algunas apps me aparece la opción de pegarla directamente luego de una captura»). Es lo que ofrece el teclado
 * de Android en los campos que aceptan imágenes, y el `<textarea>` de la caja no es uno (ver «Pegar» abajo). Al ENFOCAR el
 * campo, si hay una imagen copiada que todavía no se ofreció, la caja la ofrece con un toque.
 * ⚠️ SÓLO SI EL PERMISO YA ESTÁ: enfocar no puede pedir permiso (el navegador mostraría el cartel cada vez que se toca el
 *    campo). El permiso lo pide «Pegar» del «+», con un toque de quien quiere pegar; desde ahí, la captura aparece sola.
 * null = nada que ofrecer (sin permiso, sin imagen, ya ofrecida, o un navegador que no deja leer).
 */
export async function capturaParaOfrecer(
  vistas: ReadonlySet<string>,
  nav: { permissions?: Pick<Permissions, 'query'>; clipboard?: Pick<Clipboard, 'read'> } | undefined = globalThis.navigator,
): Promise<File | null> {
  try {
    const permiso = await nav?.permissions?.query({ name: 'clipboard-read' as PermissionName });
    if (permiso?.state !== 'granted') return null;
    const f = (await imagenesDelPortapapeles(nav?.clipboard))?.[0];
    if (!f || vistas.has(firmaDeCaptura(f))) return null;
    return f;
  } catch {
    return null;
  }
}

export async function imagenesDelPortapapeles(cb: Pick<Clipboard, 'read'> | undefined = globalThis.navigator?.clipboard): Promise<File[] | null> {
  if (!cb || typeof cb.read !== 'function') return null;
  const out: File[] = [];
  for (const it of await cb.read()) {
    const tipo = it.types.find((t) => /^image\/(png|jpeg|webp|gif)$/.test(t));
    if (!tipo) continue;
    const b = await it.getType(tipo);
    out.push(new File([b], `captura-${out.length + 1}.${tipo.slice('image/'.length).replace('jpeg', 'jpg')}`, { type: tipo }));
  }
  return out;
}
