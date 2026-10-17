'use client';

// =============================================================================
// Los adjuntos de la caja del Ops Center: el botón, la tira con la vista previa y el Ctrl+V (17/10/2026)
// =============================================================================
// Martín: adjuntar imágenes y archivos en la caja, y pegar una captura con Ctrl+V, en la computadora y en el teléfono.
// Copiado de la caja del Second Brain (ChatSecondBrain.tsx): las mismas clases (app/_chat/chat.css), el mismo `accept` y la
// misma regla para pegar. El estado y la subida viven en useCentro.ts (`sumarAdjuntos`, `mandar`): esto sólo dibuja.

import '@/app/_chat/chat.css';
import { useRef, type ClipboardEvent } from 'react';
import { Icon } from '@/app/_components/icons';
import { IconoChat } from '@/app/m/mako/iconos';
import { ACCEPT_ADJUNTOS_CHAT } from '@/lib/mako-adjuntos';
import type { AdjuntoCaja } from './useCentro';

/** Lo que la caja necesita para adjuntar. `puede` = false: el Runner todavía no baja adjuntos (no se ofrece). */
export type AdjuntosDeCaja = {
  items: readonly AdjuntoCaja[];
  puede: boolean;
  onSumar: (archivos: File[]) => void;
  onQuitar: (id: string) => void;
};

/** Pegar: una captura entra como adjunto. Una celda de Excel o un párrafo de Word viajan como texto Y como imagen: si hay
 *  texto, se pega el texto (la misma regla que el Second Brain). */
export function alPegar(e: ClipboardEvent<HTMLTextAreaElement>, a: AdjuntosDeCaja | undefined) {
  if (!a?.puede) return;
  const fs = Array.from(e.clipboardData.files);
  if (fs.length && !Array.from(e.clipboardData.types).includes('text/plain')) { e.preventDefault(); a.onSumar(fs); }
}

/** La tira de lo elegido, arriba del texto. */
export function ListaAdjuntos({ a }: { a: AdjuntosDeCaja | undefined }) {
  if (!a?.items.length) return null;
  return (
    <ul className="ch-elegidos" aria-label="Archivos para mandar">
      {a.items.map((x) => (
        <li key={x.id} className="ch-elegido">
          {/* eslint-disable-next-line @next/next/no-img-element -- la vista previa local (blob:) */}
          {x.tipo === 'image' ? <img src={x.url} alt="" /> : <IconoChat nombre="archivo" size={20} />}
          <span className="ch-elegido__nombre" title={x.file.name}>{x.file.name}</span>
          <button type="button" className="ch-elegido__quitar" onClick={() => a.onQuitar(x.id)} aria-label={`Quitar ${x.file.name}`}>
            <Icon name="x" size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** El «+» de la barrita de la caja. */
export function BotonAdjuntar({ a, apagado }: { a: AdjuntosDeCaja | undefined; apagado: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  if (!a?.puede) return null;
  return (
    <>
      <button type="button" className="ch-adjuntar" onClick={() => entrada.current?.click()} disabled={apagado}
        aria-label="Adjuntar fotos o PDF" title="Adjuntar fotos o PDF (o pega una captura)">
        <Icon name="plus" size={18} />
      </button>
      <input ref={entrada} type="file" accept={ACCEPT_ADJUNTOS_CHAT} multiple hidden
        onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) a.onSumar(fs); }} />
    </>
  );
}
