'use client';

// =============================================================================
// Elegir el muñeco de un empleado (15/10/2026)
// =============================================================================
// Martín: «Crea más diseños variados de las figuras tipo trabajadores... Con diferentes caras, etc... Y que si le doy
// click pueda elegir cambiar a otro». Copiado del armador de Notion Faces (faces.notion.com, mirado ese día): a la
// izquierda las piezas (ahí: tono, ojos, cejas, lentes, nariz, boca, pelo, accesorios), al medio la grilla de opciones
// de la pieza elegida en mosaicos de tres —el elegido con borde y fondo azul— con el dado para sortear arriba, y a la
// derecha el retrato grande. Acá las piezas son cuatro (cuerpo, color, cara y accesorio): los ojos no se eligen porque
// dicen el estado del chat (lib/centro-munecos.ts). En el teléfono, el retrato arriba y las piezas como chips.
//
// Es la pieza de ADENTRO: el modal de la computadora (CentroApp.tsx) y la hoja del teléfono (ChatsMovil.tsx) le ponen
// su caja y su botón de guardar.

import { useState } from 'react';
import { Icon } from '@/app/_components/icons';
import {
  ACCESORIOS, CARAS, COLORES, FORMAS, ROTULO_ACCESORIO, ROTULO_CARA, ROTULO_FORMA, aspectoAlAzar, type Aspecto,
} from '@/lib/centro-munecos';
import { Muneco, type Animo } from './Muneco';

type Pieza = 'forma' | 'color' | 'cara' | 'accesorio';
const PIEZAS: Array<{ id: Pieza; label: string }> = [
  { id: 'forma', label: 'Cuerpo' }, { id: 'color', label: 'Color' }, { id: 'cara', label: 'Cara' }, { id: 'accesorio', label: 'Accesorio' },
];
const OPCIONES: Record<Pieza, readonly string[]> = { forma: FORMAS, color: COLORES, cara: CARAS, accesorio: ACCESORIOS };
const rotulo = (p: Pieza, v: string, i: number) =>
  p === 'forma' ? ROTULO_FORMA[v as keyof typeof ROTULO_FORMA]
    : p === 'cara' ? ROTULO_CARA[v as keyof typeof ROTULO_CARA]
      : p === 'accesorio' ? ROTULO_ACCESORIO[v as keyof typeof ROTULO_ACCESORIO]
        : `Color ${i + 1}`;

export function ElegirMuneco({ titulo, animo, aspecto, onCambio }: {
  titulo: string; animo: Animo; aspecto: Aspecto; onCambio: (a: Aspecto) => void;
}) {
  const [pieza, setPieza] = useState<Pieza>('forma');
  const ops = OPCIONES[pieza];
  return (
    <div className="co-elegir">
      <nav className="co-elegir__piezas" aria-label="Piezas del muñeco">
        {PIEZAS.map((p) => (
          <button key={p.id} type="button" className="co-elegir__pieza" aria-pressed={pieza === p.id} onClick={() => setPieza(p.id)}>{p.label}</button>
        ))}
      </nav>
      <div className="co-elegir__grilla">
        <div className="co-elegir__grilla-cab">
          <span>{PIEZAS.find((p) => p.id === pieza)?.label}</span>
          {/* El dado de Notion Faces: sortea el muñeco entero. */}
          <button type="button" className="co-elegir__dado" onClick={() => onCambio(aspectoAlAzar(Math.random))} title="Uno al azar" aria-label="Uno al azar">
            <Icon name="regenerar" size={16} />
          </button>
        </div>
        <div className="co-elegir__mosaicos" role="radiogroup" aria-label={PIEZAS.find((p) => p.id === pieza)?.label}>
          {ops.map((v, i) => {
            const elegido = aspecto[pieza] === v;
            return (
              <button key={v} type="button" role="radio" aria-checked={elegido} className="co-elegir__mosaico" title={rotulo(pieza, v, i)}
                aria-label={rotulo(pieza, v, i)} onClick={() => onCambio({ ...aspecto, [pieza]: v } as Aspecto)}>
                <Muneco titulo={titulo} animo="despierto" size={52} aspecto={{ ...aspecto, [pieza]: v } as Aspecto} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="co-elegir__retrato">
        <Muneco titulo={titulo} animo={animo === 'dormido' ? 'despierto' : animo} size={128} aspecto={aspecto} />
        <span className="co-elegir__nombre">{titulo}</span>
      </div>
    </div>
  );
}
