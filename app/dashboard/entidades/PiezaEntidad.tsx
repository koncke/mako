'use client';

// =============================================================================
// PiezaEntidad — el elemento «Ficha» (tipo 'entidad'): una pieza de la ficha de lo que se abrió (tanda v5, I3)
// =============================================================================
// Sólo vive adentro de un pop-up (el saneo lo descarta en una hoja: lib/graficos-catalogo.ts). El pop-up
// (app/dashboard/Popup.tsx, P5) le pasa el CONTEXTO de lo clickeado ya resuelto (`contextoDeClic`,
// lib/graficos-acciones.ts: una llamada, un anuncio o un lead, con su id) y el período del gráfico dueño.
// Esto elige la pieza y la dibuja con los lectores que ya existen:
//   · llamada → ./llamada.tsx (GET /api/closing/llamada y el transcript de Fathom en vivo)
//   · anuncio → ./anuncio.tsx (GET /api/ad-insights y /api/ads-analyst/view), cargado aparte: arrastra recharts
//   · lead    → ./lead.tsx (la ficha del CRM)
//
// Lo que no se ve en la firma:
//   · EDITANDO sin una fila de muestra no hay qué abrir: se dibuja el nombre de la pieza, para que quien arma el
//     pop-up vea qué puso y dónde. Una pieza de OTRA entidad que la que abre el gráfico (una de llamada en el
//     pop-up de un anuncio) lo dice, no dibuja otra cosa.
//   · `soloLectura` (un link compartido): un pop-up no se sirve en un link (lleva nombres, citas y el creativo).
//     Si igual se dibuja, la pieza lo dice y no pide nada.
//   · El aviso de una tarea (re-analizar) va por portal: adentro de la grilla, un `fixed` queda pegado a la tarjeta.

import { type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Toast, useToast } from '@/app/_ui';
import type { Elemento } from '@/lib/graficos-catalogo';
import { PIEZAS_ENTIDAD, piezaDe, type ContextoEntidad, type TipoEntidad } from '@/lib/graficos-acciones';
import { Capa } from '../piezas';
import { PiezaLlamada } from './llamada';

const PiezaAnuncio = dynamic(() => import('./anuncio'), { ssr: false });
const PiezaLead = dynamic(() => import('./lead'), { ssr: false });

const NOMBRE_ENTIDAD = { llamada: 'llamada', anuncio: 'anuncio', lead: 'lead' } as const;

function Aviso({ children }: { children: ReactNode }) {
  return <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 12, textAlign: 'center', fontSize: 13, color: 'var(--faint)' }}>{children}</div>;
}

/**
 * El panel del elemento «Ficha» (P5 lo monta en Propiedades.tsx para `tipo: 'entidad'`): qué pieza de la ficha
 * va acá. `entidad` es lo que abre el pop-up que se está armando (`entidadDeGrafico` del gráfico dueño): las
 * piezas que se ofrecen son las de ESA ficha. Una pieza de otra que quedó guardada se cambia con elegir una.
 */
export function PropsEntidad({ e, entidad, onCambiar }: { e: Elemento; entidad: TipoEntidad | null; onCambiar: (p: Partial<Elemento>) => void }) {
  const tipo = entidad ?? e.entidad?.tipo ?? null;
  if (!tipo) return <div className="lk-seccion"><div className="lk-seccion-tit">Pieza</div><p className="lk-ayuda">Este gráfico no abre una ficha.</p></div>;
  const actual = e.entidad?.tipo === tipo ? e.entidad.pieza : null;
  return (
    <div className="lk-seccion">
      <div className="lk-seccion-tit">Pieza</div>
      <div className="lk-radios" role="radiogroup" aria-label="Pieza">
        {PIEZAS_ENTIDAD[tipo].map((p) => (
          <label key={p.id}><input type="radio" name={`pieza-${e.id}`} checked={actual === p.id} onChange={() => onCambiar({ entidad: { tipo, pieza: p.id } })} /> {p.nombre}</label>
        ))}
      </div>
    </div>
  );
}

export function PiezaEntidad({ e, contexto, periodo, soloLectura = false, onCambio }: {
  e: Elemento;
  /** Lo que se abrió (`contextoDeClic`), o null: editando sin fila de muestra. */
  contexto: ContextoEntidad | null;
  /** El período del gráfico dueño del pop-up (lo usa el anuncio: Meta pide un rango). */
  periodo?: { desde?: string; hasta?: string } | null;
  soloLectura?: boolean;
  /** Una tarea cambió algo (re-analizar una llamada): la hoja vuelve a pedir sus números. */
  onCambio?: () => void;
}) {
  const { toast, show, clear } = useToast();
  const ent = e.entidad;
  if (!ent) return null;
  const nombre = piezaDe(ent.tipo, ent.pieza)?.nombre ?? 'Una pieza que ya no existe';
  if (soloLectura) return <Aviso>No se comparte en un link</Aviso>;
  if (!contexto) return <Aviso>{nombre} · {NOMBRE_ENTIDAD[ent.tipo]}</Aviso>;
  if (contexto.tipo !== ent.tipo) return <Aviso>Esta pieza es de un {NOMBRE_ENTIDAD[ent.tipo]}</Aviso>;
  const id = Number(contexto.ref);
  const cuerpo = ent.tipo === 'llamada'
    ? <PiezaLlamada recordingId={id} pieza={ent.pieza} onCambio={onCambio} aviso={(t, tono) => show(t, undefined, tono)} />
    : ent.tipo === 'anuncio'
      ? <PiezaAnuncio adId={contexto.ref} pieza={ent.pieza} periodo={periodo} />
      : <PiezaLead leadId={id} pieza={ent.pieza} />;
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {cuerpo}
      {toast && <Capa><Toast state={toast} onClose={clear} /></Capa>}
    </div>
  );
}
