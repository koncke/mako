'use client';

// =============================================================================
// Media Buyer — las piezas de HOY alrededor del árbol (25/10/2026 noche)
// =============================================================================
// · `CajaDeOrden`: arriba de todo, la caja del chat de MaKo (la única de la app, CajaChat) donde se le da una orden en una
//   línea, como en la 04 («Move 20% of budget to the best ad set in every account»), con la foto de quien pide a la
//   izquierda (Martín, 26/10: «pon la foto de perfil, tal como lo pone AdAmigo»): la de su perfil, la MISMA de sus globos en
//   todos los chats (MiFoto.tsx); sin foto, su inicial. Lo que se escribe va al chat de MaKo de la tab (MakoEnLaTab), que es
//   quien lo hace; sin la app de escritorio, se bloquea como en todo chat.
// · `NuevoChat`: la captura 2 de AdAmigo («New Chat · What can I help you with today?», adamigo-2.webp): la estrella, una
//   pregunta, cuatro sugerencias en 2×2 y la caja. Es lo que ve una cuenta NUEVA, y un día sin cambios.
// (`NumerosDelMes`, las tres tarjetas del mes arriba de Campañas, se fue el 27/10: es una línea del pie, mb-modelo.ts → lineaDelMes.)
// · `ListaActividad`: lo hecho con su «Deshacer» (el «Each change is logged in Activity» de la 04), en una hoja.
// =============================================================================

import { useState, type ReactNode } from 'react';
import { Button, ButtonLink } from '@/app/_ui';
import { CajaChat } from '@/app/_chat/CajaChat';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';
import { Criatura } from '@/app/_components/Criatura';
import { MiFoto } from '@/app/admin/operaciones/MiFoto';
import type { Decision } from '@/lib/media-buyer/tipos';
import { hace, queHace, queSeHizo } from './mb-modelo';
import '@/app/admin/operaciones/centro.css';

export function CajaDeOrden({ placeholder, onPedir }: { placeholder: string; onPedir: (texto: string) => void }) {
  const [texto, setTexto] = useState('');
  const appEscritorio = useAppDeEscritorio();
  return (
    <div className="aa-orden">
      <MiFoto size={36} />
      <div className="co-caja">
        <CajaChat texto={texto} onTexto={setTexto} placeholder={placeholder} enterManda bloqueo={appEscritorio.bloqueo}
          onMandar={() => { const t = texto.trim(); if (!t) return; onPedir(t); setTexto(''); }} />
      </div>
    </div>
  );
}

/** El aire del botón del próximo paso, sin tocar aa.css (nada más lo usa). */
const PASO = { marginTop: 18 } as const;

export type Sugerencia = 'lanzar' | 'disenar' | 'como' | 'buscar';
const SUGERENCIAS: Array<[Sugerencia, string]> = [
  ['lanzar', 'Lanzar una campaña'], ['disenar', 'Diseñar un anuncio'], ['como', '¿Cómo vamos?'], ['buscar', 'Buscar oportunidades'],
];

export function NuevoChat({ titulo, bajada, accion, onSugerencia, onPedir }: {
  titulo: string;
  bajada: string;
  /**
   * El próximo paso de ESTE caso (conectar la cuenta, lanzar la primera campaña, prenderla, prenderme): acción + objeto.
   * Las cuatro sugerencias son siempre las mismas; esto es lo que al negocio le falta hoy (lib/media-buyer/cartel-hoy.ts).
   */
  accion?: { rotulo: string; href?: string; onClick?: () => void } | null;
  onSugerencia: (s: Sugerencia) => void;
  onPedir: (texto: string) => void;
}) {
  return (
    <section className="aa-nuevo" aria-label="Marketing CoPilot">
      <Criatura nombre="MaKo" size={44} estrella />
      <h1>{titulo}</h1>
      <p>{bajada}</p>
      {accion && (accion.href || accion.onClick) && (
        <div style={PASO}>
          {accion.href
            ? <ButtonLink href={accion.href}>{accion.rotulo}</ButtonLink>
            : <Button onClick={accion.onClick}>{accion.rotulo}</Button>}
        </div>
      )}
      <div className="aa-sugs">
        {SUGERENCIAS.map(([s, t]) => <button key={s} type="button" className="aa-sug" onClick={() => onSugerencia(s)}>{t}</button>)}
      </div>
      <CajaDeOrden placeholder="Escríbele a MaKo" onPedir={onPedir} />
    </section>
  );
}

/** Lo hecho en 30 días, con su «Deshacer» (y lo descartado, con «Volver a abrir»). */
export function ListaActividad({ decisiones, ocupada, onDeshacer, onReabrir, onAbrir }: {
  decisiones: Decision[];
  ocupada: string | null;
  onDeshacer: (d: Decision) => void;
  onReabrir: (d: Decision) => void;
  onAbrir: (d: Decision) => void;
}) {
  const hechas = decisiones.filter((d) => d.estado === 'aplicada' || d.estado === 'deshecha')
    .sort((a, b) => ((b.aplicadaAt ?? '') < (a.aplicadaAt ?? '') ? -1 : 1));
  const descartadas = decisiones.filter((d) => d.estado === 'descartada' || d.estado === 'vencida');
  if (!hechas.length && !descartadas.length) return <p className="aa-act-vacia">Todavía no hice ningún cambio.</p>;
  const fila = (d: Decision, que: string, boton: ReactNode, sub: string) => (
    <li key={d.id}>
      <button type="button" className="aa-act-txt" onClick={() => onAbrir(d)}>
        <b>{que}</b>
        <small>{sub}</small>
      </button>
      {boton}
    </li>
  );
  return (
    <div className="aa-act">
      {hechas.length > 0 && (
        <ul>
          {hechas.map((d) => fila(d, queSeHizo(d),
            d.estado === 'aplicada'
              ? <button type="button" className="aa-sec" disabled={ocupada === d.id} onClick={() => onDeshacer(d)}>{ocupada === d.id ? 'Deshaciendo…' : 'Deshacer'}</button>
              : <span className="aa-act-marca">Deshecho</span>,
            `${d.origen === 'piloto' ? 'Automático' : d.aplicadaPor ?? 'Tú'} · ${hace(d.aplicadaAt)}`))}
        </ul>
      )}
      {descartadas.length > 0 && (
        <>
          <h3 className="aa-act-sec">Descartados</h3>
          <ul>
            {descartadas.map((d) => fila(d, queHace(d),
              <button type="button" className="aa-sec" disabled={ocupada === d.id} onClick={() => onReabrir(d)}>Volver a abrir</button>,
              d.motivoDescarte ?? (d.estado === 'vencida' ? 'Venció sin aplicarse' : 'Sin motivo')))}
          </ul>
        </>
      )}
    </div>
  );
}
