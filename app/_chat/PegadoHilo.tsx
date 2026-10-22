'use client';

// =============================================================================
// PegadoHilo — el texto pegado como DOCUMENTO, y la burbuja larga plegada (17/10/2026, #848 y #864)
// =============================================================================
// Lo usan el hilo de escritorio (HiloMako.tsx) y el del teléfono (app/m/mako/ChatMako.tsx), como ArchivosHilo. Las
// reglas (qué es largo, cómo se parte un mensaje) viven en lib/chat-pegado.ts.
//   · Un pegado es una tarjeta: «Texto pegado», sus caracteres y el arranque; «Ver» lo abre en una caja con su propio
//     scroll (nunca de 24.000 px de alto en el hilo).
//   · Lo escrito, si es muy largo, se pliega a unos renglones con «Ver todo» / «Ver menos».
// =============================================================================

import { useState, type ReactNode } from 'react';
import { caracteres, esBurbujaLarga, nombrePegado } from '@/lib/chat-pegado';
import { IconoChat } from '@/app/m/mako/iconos';
// La hoja va con la pieza: el teléfono (app/m/mako) no carga app/_chat/chat.css por su cuenta.
import './chat.css';

export function PegadosHilo({ pegados }: { pegados: readonly string[] }) {
  const [abierto, setAbierto] = useState<number | null>(null);
  if (!pegados.length) return null;
  return (
    <ul className="ch-pegados" aria-label="Textos pegados">
      {pegados.map((p, i) => (
        <li key={i} className="ch-pegado">
          <button type="button" className="ch-pegado__cab" aria-expanded={abierto === i} onClick={() => setAbierto(abierto === i ? null : i)}>
            <IconoChat nombre="archivo" size={20} />
            <span className="ch-pegado__txt">
              <span className="ch-pegado__nombre">{nombrePegado(p)}</span>
              <span className="ch-pegado__meta">{caracteres(p)}</span>
            </span>
            <span className="ch-pegado__ver">{abierto === i ? 'Cerrar' : 'Ver'}</span>
          </button>
          {abierto === i && <p className="ch-pegado__cuerpo">{p}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Lo escrito: entero si es corto; si no, plegado con «Ver todo». `className` es la clase de cada hilo. */
export function TextoPlegable({ texto, className, pie, arriba }: { texto: string; className: string; pie?: ReactNode; arriba?: ReactNode }) {
  const [entero, setEntero] = useState(false);
  const largo = esBurbujaLarga(texto);
  return (
    <div className="ch-plegable" data-plegado={largo && !entero ? '1' : undefined}>
      <p className={className}>{arriba}{texto}{pie}</p>
      {largo && (
        <button type="button" className="ch-plegable__ver" onClick={() => setEntero((v) => !v)}>{entero ? 'Ver menos' : 'Ver todo'}</button>
      )}
    </div>
  );
}
