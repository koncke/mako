// =============================================================================
// ComportamientoCard — actividad del lead en la landing y los videos
// =============================================================================
// Visitas a la landing, reproducciones y retención con semáforo.
// Compartido por el modal (LeadSheet) y la ruta /crm/[id].
//
// ⚠️ UNA LANDING PUEDE TENER VARIOS VIDEOS, y hasta el 14/08/2026 acá se pintaba
// UN número: el máximo sobre todos ellos, rotulado «Retención del VSL». Con un
// testimonio y un VSL en la misma página, «vio el 80%» podía ser el 80% del
// testimonio de 40 segundos — y se leía como que casi terminó la oferta. El dato
// no estaba mal calculado: estaba mal ATRIBUIDO, que es peor, porque el número
// se ve igual de creíble.
//
// Cuando hay uno solo, la pantalla es exactamente la de antes: partir en una
// lista de un renglón le agrega ruido al 95% de los casos para resolver el 5%.

import Link from '@/app/_ui/Link';
import { rotuloDe, type VideoLanding } from '@/lib/landing-videos';
import type { VideoEngagement } from '@/lib/leads';
import type { CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const miniCard: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' };

const colorDe = (pct: number | null) =>
  pct == null ? 'var(--faint)' : pct >= 60 ? 'var(--good)' : pct >= 30 ? 'var(--accent)' : 'var(--bad)';

/**
 * Un renglón por video, con la barra de avance como BORDE de la fila.
 *
 * Es la regla de la casa: adentro de una lista, una barra de progreso es el borde
 * (2 px, ancho completo) o no existe — una barra con ancho propio deja el mismo
 * hueco muerto que un `max-width`. Y el número va al lado del color, porque el
 * color nunca es el único portador.
 */
function FilaVideo({ v, videos }: { v: VideoEngagement; videos: VideoLanding[] }) {
  const r = rotuloDe(videos, v.videoId, v.titulo);
  const color = colorDe(v.maxPct);
  return (
    <div style={{ position: 'relative', padding: '11px 2px 12px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.texto}
          {r.esVsl && <span style={{ marginLeft: 7, fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', color: 'var(--mako-ink)' }}>VSL</span>}
        </span>
        <span style={{ flex: 'none', fontSize: 16, fontWeight: 650, color, fontVariantNumeric: 'tabular-nums' }}>
          {v.maxPct != null ? `${v.maxPct}%` : '—'}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
        {v.plays > 0 ? `${v.plays} ${v.plays === 1 ? 'reproducción' : 'reproducciones'}` : 'sin reproducir'}
        {/* «Reprodujo pero no llegó ningún hito» NO es 0%: es sin dato. */}
        {v.maxPct == null && v.plays > 0 ? ' · sin datos de avance' : ''}
      </div>
      {v.maxPct != null && (
        // ⚠️ Recortada al 100% SIEMPRE: un ancho en % adentro de un carril no
        // desborda la barra, desborda la PÁGINA.
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, v.maxPct)}%`, height: '100%', background: color }} />
        </div>
      )}
    </div>
  );
}

export function ComportamientoCard({
  visitas, dias, plays, maxPct, tieneVisitor = false, porVideo = [], videos = [],
}: {
  visitas: number; dias: number; plays: number; maxPct: number | null; tieneVisitor?: boolean;
  /** Uno por video medido. Con 0 o 1 la tarjeta se pinta como siempre. */
  porVideo?: VideoEngagement[];
  /** El catálogo `landing.videos`: cómo llama el negocio a cada uno. */
  videos?: VideoLanding[];
}) {
  const pctColor = colorDe(maxPct);
  const varios = porVideo.length > 1;
  // Ofrecer ponerles nombre solo cuando hay más de uno Y alguno no lo tiene: con
  // un solo video el nombre no distingue nada, así que pedirlo es tarea de más.
  const faltanNombres = varios && porVideo.some((v) => !rotuloDe(videos, v.videoId, v.titulo).propio);
  // Sin ningún dato: mensaje claro en vez de tres cuadros con rayas.
  if (!visitas && !plays && maxPct == null) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Comportamiento</div>
        {tieneVisitor ? (
          // Tiene identificador pero NO cruzó con ningún evento. NO afirmamos que
          // "no vio": lo más común es que la landing no haya pasado bien su
          // visitor_id (o que haya visto el VSL desde otro dispositivo/sesión).
          <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5 }}>
            Este lead tiene identificador, pero no coincide con ningún evento de tu página ni del video. <b>No significa que no lo haya visto</b>: lo más común es que tu página no haya pasado bien el identificador al agendar, o que lo viera desde otro dispositivo. No se puede confirmar la retención.
          </p>
        ) : (
          // Sin visitor_id: entró a mano o por instant form sin pasar por la landing.
          <p style={{ fontSize: 14, color: 'var(--faint)', lineHeight: 1.5 }}>
            Sin seguimiento para este lead: ingresó antes de que existiera la medición del video, o llegó por un formulario de Meta sin pasar por tu página. No hay forma de reconstruirlo.
          </p>
        )}
      </section>
    );
  }
  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Comportamiento</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
        <div style={miniCard}>
          <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>Visitó tu página</div>
          <div style={{ fontSize: 22, color: visitas ? 'var(--ink)' : 'var(--faint)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
            {visitas || '—'}{visitas ? <span style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 500 }}> {visitas === 1 ? 'vez' : 'veces'}</span> : null}
          </div>
          {visitas > 0 && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{dias} {dias === 1 ? 'día distinto' : 'días distintos'}</div>}
        </div>
        <div style={miniCard}>
          <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{varios ? 'Reprodujo' : 'Reprodujo el VSL'}</div>
          <div style={{ fontSize: 22, color: plays ? 'var(--ink)' : 'var(--faint)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
            {plays || '—'}{plays ? <span style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 500 }}> {plays === 1 ? 'vez' : 'veces'}</span> : null}
          </div>
          {varios && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>entre {porVideo.length} videos</div>}
        </div>
        {/* ⚠️ CON VARIOS VIDEOS NO HAY «la retención» en singular. El máximo sobre
            todos es el número que hacía pasar el 80% de un testimonio de 40 s por
            el 80% del VSL — así que acá el minicard NO se pinta y el desglose va
            abajo, donde cada número dice de qué es. */}
        {!varios && (
          <div style={miniCard}>
            <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>Retención del VSL</div>
            <div style={{ fontSize: 22, color: pctColor, fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{maxPct != null ? maxPct + '%' : '—'}</div>
            {maxPct != null ? (
              <div style={{ height: 5, borderRadius: 999, background: 'var(--border)', marginTop: 7, overflow: 'hidden' }}>
                <div style={{ width: Math.min(100, maxPct) + '%', height: '100%', background: pctColor }} />
              </div>
            ) : plays > 0 ? (
              // Reprodujo pero no llegó ningún hito de avance: NO es "0%", es "sin dato".
              <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4, lineHeight: 1.35 }}>Reprodujo, sin datos de avance</div>
            ) : null}
          </div>
        )}
      </div>

      {/* Un grupo de cosas del mismo tipo es una LISTA con filete, no una pila de
          cajas: tres tarjetas iguales apiladas son el contenedor perezoso. */}
      {varios && (
        <div style={{ marginTop: 18 }}>
          <div style={{ ...sectLabel, marginBottom: 2 }}>Retención por video</div>
          {porVideo.map((v) => <FilaVideo key={v.videoId ?? '_'} v={v} videos={videos} />)}
          {/* Los nombres se EDITAN en otra pantalla, así que acá se nombra y se
              linkea en vez de dibujar un formulario que no es de esta tarjeta. */}
          {faltanNombres && (
            <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 10, lineHeight: 1.5 }}>
              Hay videos sin identificar. <Link href="/integraciones?abrir=landing" style={{ color: 'var(--primary)', fontWeight: 600 }}>Ponles un nombre</Link> para reconocerlos de un vistazo.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
