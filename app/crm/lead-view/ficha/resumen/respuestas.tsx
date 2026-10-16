'use client';

// =============================================================================
// ficha/resumen/respuestas — lo que contestó: todas sus respuestas, y UNA destacada en grande
// =============================================================================
// Reemplaza a RespuestasFormulario en la ficha (16/10/2026). Junta lo que la ficha tenía en tres lugares (§3 del
// diseño): el formulario de Meta, el de la landing y lo que contestó al AGENDAR (que vivía plegado en la reunión, y el
// teléfono ya lo mostraba como «Lo que contestó»). Cada fuente se calla si está vacía; cuáles van y en qué orden lo
// elige el admin (las opciones del bloque, `fuentes`).
//
// LA REFERENCIA: las propiedades de un formulario en el registro de HubSpot (pregunta → respuesta, agrupadas por el
// formulario que las trajo) y, en «Tarjetas», los highlights de Attio. «Respuesta destacada» es UNA respuesta como un
// highlight («Presupuesto: USD 120.000»): la pregunta la elige el admin en «Personalizar» (Opciones).
// Las respuestas no se editan: las escribió el lead.
// =============================================================================

import type { PropsBloque } from '../tipos';
import { respuestasDelBloque } from '../reglas-resumen';
import { NOMBRE_FUENTE, respuestaA, type Respuesta } from './logica';
import { Bloque } from './piezas';

function Lista({ rs }: { rs: readonly Respuesta[] }) {
  return (
    <dl className="fr-qa">
      {rs.map((r) => <div key={r.pregunta}><dt>{r.pregunta}</dt><dd>{r.respuesta}</dd></div>)}
    </dl>
  );
}

function Tabla({ rs }: { rs: readonly Respuesta[] }) {
  return <dl className="fr-tabla">{rs.map((r) => [<dt key={`p:${r.pregunta}`}>{r.pregunta}</dt>, <dd key={`r:${r.pregunta}`}>{r.respuesta}</dd>])}</dl>;
}

function Tarjetas({ rs }: { rs: readonly Respuesta[] }) {
  return <div className="fr-tarjetas">{rs.map((r) => <dl key={r.pregunta} className="fr-tarjeta" style={{ margin: 0 }}><dt>{r.pregunta}</dt><dd>{r.respuesta}</dd></dl>)}</div>;
}

export function LoQueContesto({ ctx, puesto, titulo, diseno, epico }: PropsBloque) {
  const fuentes = respuestasDelBloque(ctx, puesto);
  if (!fuentes.length) return null;
  const varias = fuentes.length > 1;
  if (diseno === 'linea' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false}>
        <p className="fr-linea" style={{ margin: 0 }}>
          {fuentes.flatMap((f) => f.respuestas).map((r, i) => <span key={`${r.pregunta}:${i}`}>{i > 0 && ' · '}<b>{r.pregunta}:</b> {r.respuesta}</span>)}
        </p>
      </Bloque>
    );
  }
  if (diseno === 'plegado' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false}>
        {fuentes.map((f, i) => (
          <details key={f.fuente} className="fr-plegado" open={i === 0}>
            <summary>{NOMBRE_FUENTE[f.fuente]} · {f.respuestas.length}</summary>
            <Lista rs={f.respuestas} />
          </details>
        ))}
      </Bloque>
    );
  }
  const Cuerpo = epico || diseno === 'tarjetas' ? Tarjetas : diseno === 'tabla' ? Tabla : Lista;
  return (
    <Bloque titulo={titulo} epico={epico}>
      {fuentes.map((f) => (
        <div key={f.fuente} className="fr-grupo">
          {varias && <span className="fr-fuente">{NOMBRE_FUENTE[f.fuente]}</span>}
          <Cuerpo rs={f.respuestas} />
        </div>
      ))}
    </Bloque>
  );
}

export function RespuestaDestacada({ ctx, puesto, diseno, epico }: PropsBloque) {
  const r = respuestaA(ctx.data, puesto.opciones?.pregunta);
  if (!r) return null;
  if (diseno === 'chip' && !epico) {
    return (
      <Bloque titulo={r.pregunta} epico={false}>
        <span className="fr-chip" style={{ alignSelf: 'flex-start' }}>{r.respuesta}</span>
      </Bloque>
    );
  }
  if (diseno === 'fila' && !epico) {
    return (
      <Bloque titulo={NOMBRE_FUENTE[r.fuente]} epico={false}>
        <div className="fr-props"><div className="fr-prop"><span className="fr-k">{r.pregunta}</span><span className="fr-v">{r.respuesta}</span><span /></div></div>
      </Bloque>
    );
  }
  // «Grande»: la pregunta es el título y la respuesta el protagonista.
  return (
    <Bloque titulo={r.pregunta} epico={epico}>
      <span className={epico ? 'fr-p' : 'fr-num'}>{r.respuesta}</span>
    </Bloque>
  );
}
