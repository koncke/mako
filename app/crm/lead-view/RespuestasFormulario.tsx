// =============================================================================
// Lo que la persona contestó en el formulario del anuncio de Meta
// =============================================================================
// Pedido de Martín (05/10): «hay un cliente de Código Inmobiliario que está corriendo
// campañas de formulario y hace esas preguntas… no lo estamos guardando en el detalle
// del CRM». Y el 07/10: que se vea también en el pop-up del tablero, que es por donde
// se abre una ficha casi siempre — hasta ese día sólo la dibujaba la ruta /crm/[id].
//
// ⚠️ UNA SOLA PIEZA PARA LAS DOS PUERTAS. Antes vivía escrita adentro de la ruta, y la
// segunda copia es la que se queda vieja. Las respuestas llegan YA resueltas
// (`respuestasPropias`, lib/meta-leads-campos.ts): sólo las preguntas PROPIAS —nombre,
// email, teléfono y empresa ya están arriba con su rótulo— y legibles, porque Meta
// manda la clave («¿qué_tipo_de_propiedad_buscas_vender?») y no el texto.
//
// Sin respuestas no dibuja nada: un bloque diciendo «sin respuestas» sobre un lead que
// no vino de un formulario es ruido fijo.

import type { CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

export type RespuestaFormulario = { pregunta: string; respuesta: string };

export function RespuestasFormulario({ respuestas }: { respuestas: readonly RespuestaFormulario[] }) {
  if (!respuestas.length) return null;
  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 10 }}>Respondió en el formulario</div>
      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {respuestas.map((r) => (
          <div key={r.pregunta}>
            <dt style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.35 }}>{r.pregunta}</dt>
            <dd style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{r.respuesta}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
