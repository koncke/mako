'use client';

// =============================================================================
// La pregunta de un chat, arriba de su caja: copiada de AskUserQuestion de Claude Code (16/10/2026)
// =============================================================================
// Martín (16/10/2026): «En lugar de la ticketera que te pedí, que es tipo unas cards que swichean, prefiero ahí
// donde está "Una tarjeta espera tu respuesta en la Ticketera" que salga lo mismo que hoy sale en claude, las
// opciones...». Y mirándolo en producción: «Me dice "Espera tu respuesta" y aún no me salta lo que te pedí tipo
// claude».
//
// Copiado de la herramienta AskUserQuestion de Claude Code (el CLI 2.1.299 de esta PC, leído en sus textos ese día):
//   · arriba, una pestaña por pregunta con su TEMA corto (el `header` de Claude, de hasta 12 letras), y «1 de 3»
//     cuando hay varias (la que se contesta se va, así que no hay pestañas con tilde);
//   · la pregunta, y las opciones NUMERADAS en renglones: el título y, abajo y más tenue, la descripción. La
//     recomendada lleva «(Recomendada)» al final del título (el «(Recommended)» de Claude) y viene marcada;
//   · el último renglón es el libre: «Escribe otra cosa» (el «Type something.» de Claude), un campo en el renglón;
//   · abajo, la ayuda del teclado, con los números como atajo (Enter para elegir · ↑↓ para moverte).
// Lo de Claude que no aplica: «Chat about this» (para eso está la caja de abajo) y el «Review your answers» final:
// acá cada respuesta se guarda al elegirla, como en la Ticketera, así no hay un envío del final que se pierda.
//
// ⚠️ CONTESTAR GUARDA EN admin_decisiones COMO HOY: por la misma acción de la Ticketera (la pasa la página como
// prop, igual que al mazo), así lo que se contesta acá sale contestado allá y el chat se entera por el aviso del
// Runner. La pregunta contestada se va de acá y la conversación la muestra como respuesta de Martín.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { OTRA, type AccionResponder, type Decision, type EstadoRespuesta } from '@/app/admin/runway/decisiones';
import { opcionesDePregunta, preguntaAbierta, temaDePregunta } from '@/lib/centro-preguntas';

type Props = {
  /** Las que este chat espera, en el orden en que se contestan. */
  preguntas: readonly Decision[];
  responder: AccionResponder;
  /** La pregunta ya está guardada (el padre, que la anota con su `responder`, la saca y la pone en la conversación). */
  onRespondida?: (d: Decision, clave: string, texto: string) => void;
};

export function Pregunta({ preguntas, responder, onRespondida }: Props) {
  // ⚠️ LA PREGUNTA ABIERTA SE SIGUE POR SU ID, NUNCA POR SU POSICIÓN (revisión adversarial, 16/10/2026): el refresco de
  // cada 8 s puede meter una tarjeta que frena ADELANTE de la que se está contestando, y con la posición lo que Martín
  // escribía para una se guardaba en la otra.
  const [elegida, setElegida] = useState<number | null>(null);
  const { d, pos } = preguntaAbierta(preguntas, elegida);
  const ops = d ? opcionesDePregunta(d) : [];
  const recomendada = ops.findIndex((o) => o.recomendada);
  const [foco, setFoco] = useState(Math.max(0, recomendada));
  const [otra, setOtra] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  // Cada pregunta nueva arranca en su recomendada, sin lo escrito en la anterior. Si la que estaba abierta se contestó en
  // otro lado (la Ticketera, el teléfono) mientras escribía, se dice: lo escrito no pasa en silencio a la siguiente.
  const anterior = useRef<number | null>(null);
  useEffect(() => {
    const seFue = anterior.current != null && !preguntas.some((p) => p.id === anterior.current) && otra.trim() !== '';
    anterior.current = d?.id ?? null;
    setFoco(Math.max(0, recomendada));
    setOtra('');
    setError(seFue ? 'Esa pregunta ya se contestó en otro lado' : null);
  }, [d?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const ir = (i: number) => setElegida(preguntas[Math.min(preguntas.length - 1, Math.max(0, i))]?.id ?? null);
  useEffect(() => {
    const el = caja.current?.querySelector<HTMLElement>(`[data-op="${foco}"]`);
    if (el && caja.current?.contains(document.activeElement)) el.focus();
  }, [foco]);

  if (!d) return null;
  const n = ops.length;

  async function elegir(clave: string, texto = '') {
    if (guardando || !d) return;
    if (clave === OTRA && !texto.trim()) { setError('Escribe tu respuesta'); campo.current?.focus(); return; }
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
    onRespondida?.(d, clave, texto);
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
      return;
    }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && preguntas.length > 1) {
      e.preventDefault();
      ir(e.key === 'ArrowRight' ? pos + 1 : pos - 1);
    }
  }

  return (
    <div className="co-preg" ref={caja} role="group" aria-label={`Pregunta: ${d.pregunta}`} onKeyDown={tecla}>
      <div className="co-preg__cab">
        <div className="co-preg__temas" role="tablist" aria-label="Preguntas">
          {preguntas.map((p, i) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === d.id} className="co-preg__tema" onClick={() => ir(i)}>
              {temaDePregunta(p)}
            </button>
          ))}
        </div>
        {preguntas.length > 1 && <span className="co-preg__paso">{`${pos + 1} de ${preguntas.length}`}</span>}
      </div>
      <p className="co-preg__texto">{d.pregunta}</p>
      {d.contexto && <p className="co-preg__contexto">{d.contexto}</p>}
      <ol className="co-preg__ops">
        {ops.map((o, i) => (
          <li key={o.clave}>
            <button
              type="button" data-op={i} className="co-preg__op" aria-current={i === foco ? 'true' : undefined}
              disabled={!!guardando} onFocus={() => setFoco(i)} onMouseEnter={() => setFoco(i)} onClick={() => void elegir(o.clave)}
            >
              <span className="co-preg__num" aria-hidden>{guardando === o.clave ? '…' : i + 1}</span>
              <span className="co-preg__op-txt">
                <span className="co-preg__titulo">{o.titulo}{o.recomendada && <span className="co-preg__rec"> (Recomendada)</span>}</span>
                {o.detalle && <span className="co-preg__detalle">{o.detalle}</span>}
              </span>
            </button>
          </li>
        ))}
        <li>
          <label className="co-preg__op co-preg__op--otra" data-op={n} aria-current={foco === n ? 'true' : undefined} onMouseEnter={() => setFoco(n)}>
            <span className="co-preg__num" aria-hidden>{guardando === OTRA ? '…' : n + 1}</span>
            <input
              ref={campo} className="co-preg__campo" value={otra} maxLength={1000} disabled={!!guardando}
              onFocus={() => setFoco(n)} onChange={(e) => { setOtra(e.target.value); setError(null); }}
              placeholder={n ? 'Escribe otra cosa' : 'Escribe tu respuesta'} aria-label="Escribe otra respuesta"
            />
            {otra.trim() && <button type="button" className="co-chip" disabled={!!guardando} onClick={() => void elegir(OTRA, otra)}>Mandar</button>}
          </label>
        </li>
      </ol>
      <p className="co-preg__pie">
        {error ? <span className="co-preg__error" role="alert">{error}</span> : <span className="co-preg__ayuda">{`Elige con 1 a ${n + 1} · ↑↓ para moverte${preguntas.length > 1 ? ' · ←→ otra pregunta' : ''}`}</span>}
      </p>
    </div>
  );
}
