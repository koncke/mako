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
  visitas, dias, plays, maxPct, tieneVisitor = false, porVideo = [], videos = [], urlClarity = null, urlMapaCalor = null, visitorId = null, grabacionVencida = false,
}: {
  visitas: number; dias: number; plays: number; maxPct: number | null; tieneVisitor?: boolean;
  /** Uno por video medido. Con 0 o 1 la tarjeta se pinta como siempre. */
  porVideo?: VideoEngagement[];
  /** El catálogo `landing.videos`: cómo llama el negocio a cada uno. */
  videos?: VideoLanding[];
  /** Link a las grabaciones de ESTA persona en Clarity, ya filtrado por su
   *  visitor_id. null si el workspace no conectó Clarity o el lead no tiene
   *  identificador — un botón que no puede abrir nada es peor que ninguno. */
  urlClarity?: string | null;
  /** El mapa de calor de la PÁGINA. Es de todos los visitantes, no de este lead:
   *  Clarity agrega los clics de todo el mundo y no se puede filtrar por persona.
   *  Va igual acá porque es la pregunta que sigue —«¿y el resto qué hace?»— y
   *  buscarla obligaba a salir de la ficha y navegar el panel de Clarity a mano. */
  urlMapaCalor?: string | null;
  /** El `visitor_id`, que es lo que la landing le manda a Clarity con
   *  `clarity("identify", …)`. Es la llave para encontrar a ESTA persona entre
   *  miles de sesiones anónimas. */
  visitorId?: string | null;
  /** La grabación existió pero Clarity ya la borró (más de 30 días). Es distinto
   *  de «no hay link»: acá SÍ hubo algo que ver, y decirlo evita que la persona
   *  crea que la medición nunca funcionó. */
  grabacionVencida?: boolean;
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

      {/* ⚠️ SE LINKEA, NO SE EMBEBE. Clarity no permite meter su reproductor en un
          iframe, así que el botón honesto abre SU panel — ya filtrado por esta
          persona, que es la mitad del valor: sin el filtro lleva a una lista de
          miles de sesiones anónimas y no sirve para nada.
          Solo aparece si hay link: el workspace conectó Clarity Y este lead tiene
          identificador de visita. */}
      {/* ⚠️ DOS ACCESOS Y DICEN QUÉ SON. Eran un solo link de texto chico al final
          de la tarjeta, y contestaban una sola de las dos preguntas que alguien se
          hace antes de llamar a este lead: «¿qué hizo ÉL?» (su grabación) y «¿qué
          hace el resto en esta página?» (el mapa de calor). La segunda existía en
          Clarity desde siempre y había que salir de la ficha e ir a buscarla a
          mano, así que en la práctica no la miraba nadie.
          Y se nombra la diferencia en el propio rótulo: el mapa de calor NO es de
          esta persona —Clarity agrega los clics de todos y no se puede filtrar por
          alguien—, y un botón al lado de su grabación se leería como que sí. */}
      {/* ⚠️ LA AUSENCIA SE EXPLICA. Antes el botón aparecía con solo tener
          identificador, sin importar de cuándo era la visita — y Clarity borra
          las grabaciones a los 30 días. Quien lo apretaba sobre un lead de hace
          tres meses caía en su panel sin nada y concluía, razonablemente, que la
          medición no anda. Esconderlo a secas repetiría el problema por el otro
          lado: acá SÍ hubo algo que ver, y hay que decir por qué ya no está. */}
      {grabacionVencida && (
        <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 14, lineHeight: 1.55 }}>
          Su grabación ya no existe: Clarity las guarda 30 días y esta visita es anterior.
          Lo que sí queda es todo lo de arriba, que es nuestro y no vence.
        </p>
      )}
      {(urlClarity || urlMapaCalor) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {urlClarity && (
            <a href={urlClarity} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 10,
                border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)',
                fontSize: 12.5, fontWeight: 650, color: 'var(--primary)', textDecoration: 'none' }}>
              Ver el video de lo que hizo →
            </a>
          )}
          {urlMapaCalor && (
            <a href={urlMapaCalor} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 10,
                border: '1px solid var(--border-strong)', background: 'var(--surface)',
                fontSize: 12.5, fontWeight: 650, color: 'var(--dim)', textDecoration: 'none' }}>
              Mapa de calor de la página →
            </a>
          )}
        </div>
      )}
      {/* ⚠️ EL ID, A MANO Y COPIABLE. El link abre el panel de Clarity pero NO
          llega filtrado por esta persona: Clarity descarta los parámetros de
          filtro que no reconoce y muestra la lista entera —35 sesiones, ninguna
          identificable—, así que el botón prometía «lo que hizo ÉL» y entregaba
          «lo que hizo todo el mundo».
          Hasta que el link filtre solo, esto es lo que lo vuelve utilizable: en
          Clarity, Filtros → Filtros personalizados → ID de usuario personalizado,
          y se pega esto. Clarity hashea lo que se pega y lo cruza contra sus
          datos, así que el id crudo es exactamente lo que hay que darle. */}
      {urlClarity && visitorId && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Su ID para el filtro de Clarity:</span>
          <code
            title="Clic para copiar. En Clarity: Filtros → Filtros personalizados → ID de usuario personalizado"
            onClick={() => { void navigator.clipboard?.writeText(visitorId).catch(() => {}); }}
            style={{ fontFamily: MONO, fontSize: 11.5, padding: '3px 8px', borderRadius: 7, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)' }}>
            {visitorId}
          </code>
        </div>
      )}
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
