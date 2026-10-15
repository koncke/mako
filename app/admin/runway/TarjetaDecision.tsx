'use client';

// =============================================================================
// Una decisión = una tarjeta: de qué chat viene, la pregunta, qué destraba y las opciones
// =============================================================================
// Se contesta con UN toque: cada opción es un botón que manda el formulario. Sin opciones,
// la tarjeta pide la respuesta escrita. Y toda tarjeta deja escribir «otra respuesta».
//
// ⚠️ Es cliente sólo por dos cosas que una tarjeta de servidor no puede: decir el error al
// lado del botón y apagar los botones mientras se guarda (en el teléfono, un toque sin
// respuesta visible se repite). Lo que decide y valida es el server (lib/admin-decisiones.ts).

import { useActionState } from 'react';
import Link from '@/app/_ui/Link';
import { OTRA, RESUELTA, esHrefExterno, esHrefInterno, type AccionResponder, type Decision, type EstadoRespuesta } from './decisiones';

const INICIAL: EstadoRespuesta = { error: null, ok: false };

export function TarjetaDecision({ d, responder }: { d: Decision; responder: AccionResponder }) {
  const [estado, accion, pendiente] = useActionState(responder, INICIAL);
  const contestoLibre = d.respuesta === OTRA;
  return (
    <article className={`decisiones-tarjeta decisiones-tarjeta--${d.urgencia}`} aria-busy={pendiente}>
      <p className="decisiones-chat">{d.chat}</p>
      {/* La pregunta va primero y grande; el porqué, debajo y chico: se lee si hace falta. */}
      <h3 className="decisiones-pregunta">{d.pregunta}</h3>
      {d.contexto && <p className="decisiones-contexto">{d.contexto}</p>}
      {d.destraba && (
        <p className="decisiones-destraba"><span>Destraba</span>{d.destraba}</p>
      )}
      {d.href && esHrefInterno(d.href) && <Link href={d.href} className="decisiones-link">Mirarlo antes →</Link>}
      {d.href && esHrefExterno(d.href) && (
        // Un prototipo de un chat (claude.ai): pestaña nueva, sin pasarle de dónde viene.
        <a href={d.href} target="_blank" rel="noopener noreferrer" className="decisiones-link">Ver el prototipo ↗</a>
      )}

      <form action={accion} className="decisiones-form">
        <input type="hidden" name="id" value={d.id} />
        {d.opciones.length > 0 && (
          <div className="decisiones-opciones">
            {d.opciones.map((o) => {
              const elegida = d.respuesta === o.clave;
              return (
                <button key={o.clave} type="submit" name="clave" value={o.clave} disabled={pendiente}
                  aria-pressed={elegida}
                  className={`decisiones-opcion${elegida ? ' decisiones-opcion--elegida' : ''}`}>
                  {/* La marca va ARRIBA del texto, no al costado: al costado le comía el ancho y
                      una opción de cinco palabras salía en cuatro renglones. */}
                  <b>{o.clave}</b>
                  <span>
                    {d.recomendada === o.clave && <em className="decisiones-reco">Recomendada</em>}
                    {o.texto}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {d.opciones.length === 0 ? (
          <div className="decisiones-libre">
            <textarea name="texto" rows={3} maxLength={1000} placeholder="Tu respuesta"
              defaultValue={contestoLibre ? d.respuestaTexto ?? '' : ''} />
            <button type="submit" name="clave" value={OTRA} disabled={pendiente} className="decisiones-mandar">
              {pendiente ? 'Guardando…' : 'Mandar'}
            </button>
          </div>
        ) : (
          <details className="decisiones-otra" open={contestoLibre}>
            <summary>Otra respuesta</summary>
            <div className="decisiones-libre">
              <textarea name="texto" rows={3} maxLength={1000} placeholder="Escribe lo que quieras"
                defaultValue={d.respuestaTexto ?? ''} />
              <button type="submit" name="clave" value={OTRA} disabled={pendiente} className="decisiones-mandar">
                {pendiente ? 'Guardando…' : 'Mandar'}
              </button>
            </div>
          </details>
        )}
        {/* «Resuelta»: sale sin elegir una opción (se resolvió sola, o ya no aplica). */}
        {d.respuesta !== RESUELTA && (
          <button type="submit" name="clave" value={RESUELTA} disabled={pendiente} className="decisiones-resuelta">
            Resuelta
          </button>
        )}
        {estado.error && <p className="decisiones-error" role="alert">{estado.error}</p>}
      </form>
    </article>
  );
}
