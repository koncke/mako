'use client';

// =============================================================================
// La pregunta de un chat, ADENTRO de su conversación: un formulario de opciones (17/10/2026)
// =============================================================================
// Martín: «Ops Center me está preguntando algo y me pide que responda, en lugar de darme las opciones tipo multiple
// select». Un chat pregunta con `cartero.mjs preguntar` (lib/centro-preguntas-chat.ts) y la pregunta se dibuja acá, como
// un mensaje suyo: el diseño es el de AskUserQuestion de Claude Code que ya usa Pregunta.tsx (las mismas clases
// `co-preg`), con la recomendada primero y marcada, el detalle de cada opción debajo y el renglón libre al final.
//   · una sola: tocar una opción la manda (como Claude Code);
//   · varias: se marcan y se manda con «Responder».
// Contestada, queda la pregunta con lo elegido marcado, y lo demás tenue: se lee como lo que fue.
//
// ⚠️ RESPONDER NO ESCRIBE EN LA BASE DESDE ACÁ: lo hace el motor (useCentro.ts → contestarPregunta), que primero FIRMA la
//    respuesta por mandar.ts y después la marca. Este componente sólo dice qué se eligió.

import { useState, type KeyboardEvent } from 'react';
import { Icon } from '@/app/_components/icons';
import { renderInline } from '@/app/_components/Markdown';
import { eleccionValida, opcionesEnOrden, type PreguntaChat as Pregunta } from '@/lib/centro-preguntas-chat';

const horaAR = (t: number) => new Date(t).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export type Responder = (p: Pregunta, elegidas: number[], otra: string) => Promise<string | null>;

export function PreguntaChat({ p, onResponder, enviada = false }: {
  p: Pregunta; onResponder?: Responder;
  /** Su respuesta ya salió firmada pero la base todavía no la marcó: no se vuelve a contestar. */
  enviada?: boolean;
}) {
  const ops = opcionesEnOrden(p);
  const r = p.respuesta;
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [otra, setOtra] = useState('');
  const [mandando, setMandando] = useState<number | 'todo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abierta = !r && !enviada && !!onResponder;

  async function mandar(elegidas: number[], cual: number | 'todo') {
    if (!onResponder || mandando != null) return;
    const v = eleccionValida(p, elegidas, otra);
    if (!v.ok) { setError(v.error); return; }
    setMandando(cual);
    setError(null);
    const mal = await onResponder(p, v.elegidas, v.otra ?? '');
    setMandando(null);
    if (mal) setError(mal);
  }
  const tocar = (i: number) => {
    if (!abierta) return;
    if (!p.varias) { void mandar([i], i); return; }
    setMarcadas((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]));
    setError(null);
  };
  function tecla(e: KeyboardEvent<HTMLDivElement>) {
    if (!abierta || e.target instanceof HTMLInputElement) return;
    if (/^[1-9]$/.test(e.key)) {
      const o = ops[Number(e.key) - 1];
      if (o) { e.preventDefault(); tocar(o.i); }
    }
  }

  const elegida = (i: number) => (r ? r.elegidas.includes(i) : marcadas.includes(i));
  return (
    <div className={`co-preg co-preg--chat${r ? ' co-preg--contestada' : ''}`} role="group" aria-label={`Pregunta: ${p.pregunta}`} onKeyDown={tecla}>
      <p className="co-preg__texto">{renderInline(p.pregunta, 'pq', true)}</p>
      {p.contexto && <p className="co-preg__contexto">{renderInline(p.contexto, 'pc', true)}</p>}
      <ol className="co-preg__ops">
        {ops.map((o, n) => (
          <li key={o.i}>
            <button
              type="button" className="co-preg__op" disabled={!abierta || mandando != null}
              aria-pressed={p.varias || r ? elegida(o.i) : undefined} data-elegida={elegida(o.i) ? 'true' : undefined}
              onClick={() => tocar(o.i)}
            >
              <span className={`co-preg__num${p.varias ? ' co-preg__num--caja' : ''}`} aria-hidden>
                {mandando === o.i ? '…' : elegida(o.i) ? <Icon name="check" size={13} /> : n + 1}
              </span>
              <span className="co-preg__op-txt">
                <span className="co-preg__titulo">{o.titulo}{o.recomendada && <span className="co-preg__rec"> (Recomendada)</span>}</span>
                {o.detalle && <span className="co-preg__detalle">{renderInline(o.detalle, `pd${n}`, true)}</span>}
              </span>
            </button>
          </li>
        ))}
        {abierta ? (
          <li>
            <label className="co-preg__op co-preg__op--otra">
              <span className="co-preg__num" aria-hidden>{ops.length + 1}</span>
              <input
                className="co-preg__campo" value={otra} maxLength={1000} disabled={mandando != null}
                onChange={(e) => { setOtra(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && otra.trim()) { e.preventDefault(); void mandar(p.varias ? marcadas : [], 'todo'); } }}
                placeholder="Escribe otra cosa" aria-label="Escribe otra respuesta"
              />
            </label>
          </li>
        ) : r?.otra ? (
          <li><p className="co-preg__op co-preg__otra-dicha" data-elegida="true"><span className="co-preg__num" aria-hidden><Icon name="check" size={13} /></span>{r.otra}</p></li>
        ) : null}
      </ol>
      <div className="co-preg__pie co-preg__pie--chat">
        {error ? <span className="co-preg__error" role="alert">{error}</span>
          : r ? <span>{`Respondiste · ${horaAR(Date.parse(r.at))}`}</span>
          : enviada ? <span>Tu respuesta salió</span>
          : <span className="co-preg__ayuda">{p.varias ? 'Elige una o varias' : 'Elige una'}</span>}
        {abierta && (p.varias || otra.trim()) && (
          <button type="button" className="co-chip co-chip--primario" disabled={mandando != null || (!marcadas.length && !otra.trim())}
            onClick={() => void mandar(p.varias ? marcadas : [], 'todo')}>
            {mandando === 'todo' ? 'Mandando…' : 'Responder'}
          </button>
        )}
      </div>
    </div>
  );
}
