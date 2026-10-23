'use client';

// =============================================================================
// Una decisión de la Ticketera, adentro del bloque de preguntas: copiada de AskUserQuestion de Claude Code (16/10/2026)
// =============================================================================
// Martín (16/10/2026): «En lugar de la ticketera que te pedí, que es tipo unas cards que swichean, prefiero ahí
// donde está "Una tarjeta espera tu respuesta en la Ticketera" que salga lo mismo que hoy sale en claude, las
// opciones...». Y mirándolo en producción: «Me dice "Espera tu respuesta" y aún no me salta lo que te pedí tipo
// claude».
//
// Copiado de la herramienta AskUserQuestion de Claude Code (el CLI 2.1.299 de esta PC, leído en sus textos ese día):
//   · arriba, el TEMA corto de la tarjeta (el `header` de Claude, de hasta 12 letras);
//   · la pregunta, y las opciones NUMERADAS en renglones: el título y, abajo y más tenue, la descripción. La
//     recomendada lleva «(Recomendada)» al final del título (el «(Recommended)» de Claude) y viene marcada;
//   · el último renglón es el libre: «Escribe otra cosa» (el «Type something.» de Claude), un campo en el renglón;
//   · abajo, la ayuda del teclado, con los números como atajo (Enter para elegir · ↑↓ para moverte).
// Lo de Claude que no aplica: «Chat about this» (para eso está la caja de abajo) y el «Review your answers» final:
// acá cada respuesta se guarda al elegirla, como en la Ticketera, así no hay un envío del final que se pierda.
//
// UN SOLO BLOQUE (22/10/2026): esto es sólo el CUERPO de una decisión. La tarjeta, la flecha para plegar y la navegación entre
// todo lo que espera a Martín (estas, las que pregunta el chat y las de la app) son de PreguntasDelChat.tsx → BloqueDePreguntas.
// Hasta ese día era una tarjeta aparte, sin los ajustes de Martín al bloque (no flotaba, no se plegaba, sus links no se tocaban).
//
// ⚠️ CONTESTAR GUARDA EN admin_decisiones COMO HOY: por la misma acción de la Ticketera (la pasa la página como
// prop, igual que al mazo), así lo que se contesta acá sale contestado allá y el chat se entera por el aviso del
// Runner. La pregunta contestada se va de acá y la conversación la muestra como respuesta de Martín.
// ⚠️ UNA CLAVE EN «Otra» NO SE GUARDA: iría a admin_decisiones sin tapar (como en las del chat, 22/10/2026, la de Apify).

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { OTRA, type AccionResponder, type Decision, type EstadoRespuesta } from '@/app/admin/runway/decisiones';
import { opcionesDePregunta, temaDePregunta } from '@/lib/centro-preguntas';
import { AvisoClave } from '@/app/_chat/AvisoClave';
import { AVISO_CLAVE_EN_EL_CENTRO, hayClave } from '@/lib/claves-en-el-chat';
import { conLinks } from './bloque-texto';

export function CuerpoTicketera({ d, responder, onGuardada, onEscribe }: {
  d: Decision;
  responder: AccionResponder;
  /** Ya quedó guardada: el bloque la marca y pasa a la siguiente (el refresco la saca y la pone en la conversación). */
  onGuardada: () => void;
  /** Hay algo escrito en «Otra» sin mandar: si la tarjeta se contesta en otro lado, el bloque lo dice. */
  onEscribe?: (hay: boolean) => void;
}) {
  const ops = opcionesDePregunta(d);
  const recomendada = ops.findIndex((o) => o.recomendada);
  // Cada decisión arranca en su recomendada (el bloque la monta con su `key`: lo escrito en otra no pasa a ésta).
  const [foco, setFoco] = useState(Math.max(0, recomendada));
  const [otra, setOtra] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = caja.current?.querySelector<HTMLElement>(`[data-op="${foco}"]`);
    if (el && caja.current?.contains(document.activeElement)) el.focus();
  }, [foco]);
  const n = ops.length;

  async function elegir(clave: string, texto = '') {
    if (guardando) return;
    if (clave === OTRA && !texto.trim()) { setError('Escribe tu respuesta'); campo.current?.focus(); return; }
    if (clave === OTRA && hayClave(texto)) { setError(AVISO_CLAVE_EN_EL_CENTRO); return; }
    setGuardando(clave);
    setError(null);
    const fd = new FormData();
    fd.set('id', String(d.id));
    fd.set('clave', clave);
    fd.set('texto', texto);
    // Sin red, o con la acción de un deploy viejo, la promesa se rechaza: la pregunta no se queda en «…».
    let r: EstadoRespuesta;
    try { r = await responder({ error: null, ok: false }, fd); } catch { r = { error: 'No se pudo guardar. Prueba de nuevo.', ok: false }; }
    setGuardando(null);
    if (!r.ok) { setError(r.error ?? 'No se pudo guardar. Prueba de nuevo.'); return; }
    onEscribe?.(false);
    onGuardada();
  }

  function tecla(e: KeyboardEvent<HTMLDivElement>) {
    const enCampo = e.target === campo.current;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFoco((f) => Math.min(n, f + 1)); if (foco + 1 >= n) campo.current?.focus(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFoco((f) => Math.max(0, f - 1)); return; }
    if (enCampo) {
      if (e.key === 'Enter') { e.preventDefault(); void elegir(OTRA, otra); }
      return;
    }
    if (/^[1-9]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i < n) { e.preventDefault(); void elegir(ops[i].clave); } else if (i === n) { e.preventDefault(); campo.current?.focus(); }
    }
  }

  return (
    <div className="co-preg__cuerpo" ref={caja} onKeyDown={tecla}>
      <p className="co-preg__temas"><span className="co-preg__tema">{temaDePregunta(d)}</span></p>
      <p className="co-preg__texto">{conLinks(d.pregunta, 'pq')}</p>
      {d.contexto && <p className="co-preg__contexto">{conLinks(d.contexto, 'pc')}</p>}
      <ol className="co-preg__ops">
        {ops.map((o, i) => (
          <li key={o.clave}>
            {/* Un `div` con rol de botón y no un <button>: un link adentro de un botón no se abre. Tocar el link lo abre SIN
                elegir la opción; Enter o espacio la eligen. */}
            <div
              role="button" tabIndex={guardando ? -1 : 0} aria-disabled={!!guardando || undefined}
              data-op={i} className="co-preg__op" aria-current={i === foco ? 'true' : undefined}
              onFocus={() => setFoco(i)} onMouseEnter={() => setFoco(i)}
              onClick={(e) => { if (!guardando && !(e.target as HTMLElement).closest('a')) void elegir(o.clave); }}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !guardando) { e.preventDefault(); void elegir(o.clave); } }}
            >
              <span className="co-preg__num" aria-hidden>{guardando === o.clave ? '…' : i + 1}</span>
              <span className="co-preg__op-txt">
                <span className="co-preg__titulo">{o.titulo}{o.recomendada && <span className="co-preg__rec"> (Recomendada)</span>}</span>
                {o.detalle && <span className="co-preg__detalle">{conLinks(o.detalle, `pd${i}`)}</span>}
              </span>
            </div>
          </li>
        ))}
        <li>
          <label className="co-preg__op co-preg__op--otra" data-op={n} aria-current={foco === n ? 'true' : undefined} onMouseEnter={() => setFoco(n)}>
            <span className="co-preg__num" aria-hidden>{guardando === OTRA ? '…' : n + 1}</span>
            <input
              ref={campo} className="co-preg__campo" value={otra} maxLength={1000} disabled={!!guardando}
              onFocus={() => setFoco(n)} onChange={(e) => { setOtra(e.target.value); setError(null); onEscribe?.(e.target.value.trim() !== ''); }}
              placeholder={n ? 'Escribe otra cosa' : 'Escribe tu respuesta'} aria-label="Escribe otra respuesta"
            />
            {otra.trim() && <button type="button" className="co-chip" disabled={!!guardando} onClick={() => void elegir(OTRA, otra)}>Mandar</button>}
          </label>
          {hayClave(otra) && <AvisoClave />}
        </li>
      </ol>
      <p className="co-preg__pie">
        {error ? <span className="co-preg__error" role="alert">{error}</span> : <span className="co-preg__ayuda">{`Elige con 1 a ${n + 1} · ↑↓ para moverte`}</span>}
      </p>
    </div>
  );
}
