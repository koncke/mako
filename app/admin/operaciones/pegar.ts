// =============================================================================
// Pegar en la caja del Ops Center (17/10/2026)
// =============================================================================
// ⚠️ SIN CSS y sin 'use client': lo importa su test (en node un `.css` no carga) y lo re-exporta AdjuntosCaja.tsx.

import type { ClipboardEvent } from 'react';
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
