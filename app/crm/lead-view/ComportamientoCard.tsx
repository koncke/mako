'use client';

// =============================================================================
// ComportamientoCard — qué hizo el lead, con LO NUESTRO primero
// =============================================================================
// Visitas a la landing, reproducciones, retención con semáforo, y el RECORRIDO
// completo evento por evento. Compartido por el modal (LeadSheet) y la ruta
// /crm/[id].
//
// ⚠️ LO EXTERNO VA AL FINAL, y se reportó como que el producto no mide nada:
// «aún no se está mostrando la grabación, los clicks, aún sigue redirigiendo a
// clarity». El recorrido YA se dibujaba —`TrackingTimelineCard`, con sus clics y
// su scroll— pero se montaba SUELTO debajo de esta tarjeta, o sea debajo de dos
// botones grandes que mandan a Clarity y de un renglón con un uuid crudo. Lo que
// dominaba la pantalla era lo externo, así que lo propio no se veía.
//
// Ahora el recorrido se monta ACÁ ADENTRO, pegado a los números que lo resumen, y
// lo de Clarity queda al final y más chico. `TrackingTimelineCard` dejó de
// montarse suelta en los dos lugares: si volviera, la misma ficha mostraría el
// recorrido dos veces.
//
// ⚠️ PERO EL ORDEN DE LAS TRES SECCIONES LO DECIDE MARTÍN, y lo dijo textual el
// 05/10/2026: «la primera sección debe ser "Origen del lead" y luego
// "Comportamiento" y por ultimo "Actividad registrada"». La noche anterior se había
// puesto al revés —el recorrido arriba de todo y Origen al fondo— con una medición
// de píxeles como argumento: el primer renglón a 798,5 px del tope en un área
// visible de 583. La medición era cierta y contestaba otra pregunta. Es su pantalla
// y la lee como una frase: de dónde vino → qué hizo → evento por evento. Si vuelve
// a quedar apretada, lo que se acorta es lo de arriba, nunca el orden.
//
// Queda entonces: Origen (en los montajes) → Comportamiento → Actividad registrada
// → Fuera de MaKo. Lo externo sigue último, que es lo que el reporte vino a cerrar.
//
// 'use client' porque esta tarjeta tiene controles propios (el pop-up para
// nombrar un video, el botón que copia el id). Era un módulo sin directiva, así
// que en /crm/[id] —una página de server— el `onClick` del id viajaba como
// función en la carga RSC.
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

import { useEffect, useState, type CSSProperties } from 'react';
import { filaDeRetencionInforma, rotuloDe, videoNombrable, type VideoLanding } from '@/lib/landing-videos';
import type { TrackingEvent, VideoEngagement } from '@/lib/leads';
import { TrackingTimelineCard } from './TrackingTimelineCard';
import { NombrarVideosModal } from './NombrarVideosModal';
import { GrabacionCard } from './GrabacionCard';
import type { ReplayEnLaFicha } from '@/lib/replay-ficha';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const miniCard: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' };

/**
 * La tarjeta de lo EXTERNO: más chica que las nuestras a propósito.
 *
 * Menos padding y sin el fondo de superficie: es la última de la columna y lo que
 * tiene adentro se abre fuera de MaKo, así que no puede competir con el recorrido.
 */
const cardExterna: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' };

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
  // ⚠️ EL BALDE NO SE PUEDE NOMBRAR, así que no se puede OFRECER nombrar. Es la fila
  // con `videoId` null: los eventos que `getVslEngagement` no pudo atribuir a ningún
  // video (`lib/leads.ts`, la clave `''` del mapa). No es un video al que todavía le
  // falta el nombre — es la bolsa de lo que llegó sin id, y por construcción nunca va
  // a tener uno: el id del balde se inicializa en `null` y no se escribe nunca más.
  // Por eso el pop-up la descarta (`porVideo.filter((v) => !!v.videoId)`).
  //
  // Hasta el 05/10/2026 se rotulaba «Video sin identificar», que es exactamente una
  // invitación a identificarlo: Martín lo reportó dos veces («sigue sin dejarme poner
  // de qué video es»). Lo honesto es decir en una frase qué son, y que no hay nada
  // que apretar.
  const balde = !videoNombrable(v);
  return (
    <div style={{ position: 'relative', padding: '11px 2px 12px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ minWidth: 0, fontSize: 13.5, fontWeight: 600, color: balde ? 'var(--dim)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {balde ? 'Reproducciones sin identificar' : r.texto}
          {!balde && r.esVsl && <span style={{ marginLeft: 7, fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', color: 'var(--mako-ink)' }}>VSL</span>}
        </span>
        <span style={{ flex: 'none', fontSize: 16, fontWeight: 650, color, fontVariantNumeric: 'tabular-nums' }}>
          {v.maxPct != null ? `${v.maxPct}%` : '—'}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
        {v.plays > 0 ? `${v.plays} ${v.plays === 1 ? 'reproducción' : 'reproducciones'}` : 'sin reproducir'}
        {/* «Reprodujo pero no llegó ningún hito» NO es 0%: es sin dato. */}
        {v.maxPct == null && v.plays > 0 ? ' · sin datos de avance' : ''}
        {balde ? ' · llegaron sin decir de qué video son, no se pueden nombrar' : ''}
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
  visitas, dias, plays, maxPct, tieneVisitor = false, porVideo = [], videos = [], eventos = [], pixelPuesto = true,
  urlClarity = null, urlMapaCalor = null, visitorId = null, grabacionVencida = false, replay = null,
}: {
  visitas: number; dias: number; plays: number; maxPct: number | null; tieneVisitor?: boolean;
  /** Uno por video medido. Con 0 o 1 la tarjeta se pinta como siempre. */
  porVideo?: VideoEngagement[];
  /** El catálogo `landing.videos`: cómo llama el negocio a cada uno. */
  videos?: VideoLanding[];
  /** El RECORRIDO: ingreso, clics, scroll, reproducciones, abandono. Se dibuja acá
   *  adentro —y no suelto debajo— para que lo nuestro vaya antes que lo externo. */
  eventos?: TrackingEvent[];
  /** ¿El Pixel de MaKo está midiendo? Sólo lo usa el vacío del recorrido. */
  pixelPuesto?: boolean;
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
  /** Las grabaciones PROPIAS de esta persona, o por qué no hay ninguna. Lo resuelve
   *  el server (`replayDeLead`, lib/replay-leer.ts): necesita el apagador del
   *  workspace y el índice scopeado, que el navegador no puede leer.
   *
   *  ⚠️ `null` NO ES «no hay grabación»: es «esta pantalla no preguntó», y entonces
   *  la sección no se dibuja. Es opcional porque la tarjeta la montan DOS parents
   *  (el modal y la ruta) y un prop obligatorio los rompería a los dos a la vez;
   *  pero los dos la pasan, y `tests/replay-ficha.test.ts` cuenta los call sites —
   *  una prop opcional que nadie pasa es una pantalla donde no hay nada que
   *  apretar, con el typecheck en verde. */
  replay?: ReplayEnLaFicha | null;
}) {
  // ⚠️ EL CATÁLOGO RECIÉN GUARDADO GANA, pero sólo hasta que llegue el del server.
  // `null` significa «usá la prop»: el nombre lo acaba de escribir el pop-up y
  // tiene que aparecer sin recargar, y cuando el server revalida se vuelve a él —
  // si no, una pestaña vieja seguiría mostrando su versión para siempre.
  const [videosLocal, setVideosLocal] = useState<VideoLanding[] | null>(null);
  const firmaDelServer = JSON.stringify(videos);
  // La firma y NO la identidad del array: en el modal `videos` es una prop estable
  // y en la ruta llega nueva en cada render del server, así que comparar objetos
  // borraría el guardado optimista en el primer re-render.
  useEffect(() => { setVideosLocal(null); }, [firmaDelServer]);
  const vids = videosLocal ?? videos;

  const [nombrando, setNombrando] = useState(false);

  const pctColor = colorDe(maxPct);

  // ⚠️ EL BALDE VACÍO NO SE DIBUJA, y era el que hacía creer que había dos videos.
  // El porqué, con la medición, en `filaDeRetencionInforma` (lib/landing-videos.ts):
  // los eventos de la PÁGINA llegan sin `video_id`, así que cualquier lead que haya
  // visitado la landing tenía una fila «sin identificar · sin reproducir» al lado de
  // su video real — y con dos entradas `varios` daba true.
  //
  // ⚠️ `filas` ES EL UNIVERSO DE TODA ESTA TARJETA de acá para abajo: la cuenta, la
  // lista, la oferta de nombrar y lo que recibe el pop-up. Un segundo filtro sobre
  // `porVideo` es cómo una punta vuelve a prometer lo que la otra no tiene.
  const filas = porVideo.filter(filaDeRetencionInforma);

  const varios = filas.length > 1;
  // Ofrecer ponerles nombre solo cuando hay más de uno Y alguno no lo tiene: con
  // un solo video el nombre no distingue nada, así que pedirlo es tarea de más.
  // ⚠️ SOLO LOS QUE EL POP-UP PUEDE NOMBRAR. Un video sin `videoId` es un evento viejo
  // que no se pudo atribuir: no hay contra qué guardar un nombre, y el modal lo descarta.
  // Contarlo acá ofrecía «ponles un nombre» y abría un pop-up sin una sola fila que
  // contestar — medido el 05/10/2026: en 59 de los 64 leads que mostraban el botón. Las
  // dos puntas de una oferta miran el MISMO universo, o la pantalla promete lo que no hay.
  const nombrables = filas.filter(videoNombrable);
  const faltanNombres = varios && nombrables.some((v) => !rotuloDe(vids, v.videoId, v.titulo).propio);
  const sinDatos = !visitas && !plays && maxPct == null;

  // ⚠️ SE LINKEA, NO SE EMBEBE. Clarity responde `X-Frame-Options: SAMEORIGIN`, así
  // que el navegador rechaza el iframe: no hay forma de meter su reproductor acá
  // adentro, y un proxy para esquivarlo sería reenviar la sesión del cliente a un
  // tercero. Lo honesto es abrir SU panel — ya filtrado por esta persona, que es la
  // mitad del valor: sin el filtro lleva a una lista de miles de sesiones anónimas.
  //
  // ⚠️ Y VA AL FINAL Y MÁS CHICO. Eran dos botones grandes arriba de todo, y por eso
  // la ficha se leía como si la app tuviera que mostrar el video adentro. La frase de
  // abajo dice dónde se abre, que es lo único que faltaba para que no prometa nada.
  const externo = !!(urlClarity || urlMapaCalor || grabacionVencida);

  return (
    <>
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: sinDatos ? 10 : 14 }}>Comportamiento</div>
        {/* Sin ningún dato: mensaje claro en vez de tres cuadros con rayas. */}
        {sinDatos ? (
          tieneVisitor ? (
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
          )
        ) : (
          <>
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
                {varios && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>entre {filas.length} videos</div>}
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
                {filas.map((v) => <FilaVideo key={v.videoId ?? '_'} v={v} videos={vids} />)}
                {/* ⚠️ UN POP-UP ACÁ MISMO, NO UNA REDIRECCIÓN. Esto era un
                    `<Link href="/integraciones?abrir=landing">`: para ponerle nombre a un
                    video había que irse de la ficha del lead y volver. */}
                {faltanNombres && (
                  <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 10, lineHeight: 1.5 }}>
                    Hay videos sin identificar.{' '}
                    <button type="button" onClick={() => setNombrando(true)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'var(--primary)' }}>
                      Ponles un nombre
                    </button>{' '}
                    para reconocerlos de un vistazo.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* «Actividad registrada»: el recorrido evento por evento, TERCERO y último de
          lo nuestro, que es el orden que pidió Martín. Se monta acá adentro y no
          suelto en los dos montajes — si volviera, la misma ficha lo dibujaría dos
          veces (lo fija `tests/crm-tracking-ficha.test.ts`). */}
      <TrackingTimelineCard eventos={eventos} pixelPuesto={pixelPuesto} />

      {/* La grabación PROPIA, después de lo nuestro y ANTES de «Fuera de MaKo»: es
          lo único que el replay propio compra sobre Clarity, y lo externo sigue
          último. Con `null` no se dibuja: ver el prop. */}
      {replay && <GrabacionCard replay={replay} />}

      {externo && (
        <section style={cardExterna}>
          <div style={{ ...sectLabel, marginBottom: 6 }}>Fuera de MaKo</div>
          <p style={{ fontSize: 12, color: 'var(--faint)', margin: 0, lineHeight: 1.5 }}>
            Se abre en Clarity, en otra pestaña.
          </p>
          {/* ⚠️ LA AUSENCIA SE EXPLICA. Antes el botón aparecía con solo tener
              identificador, sin importar de cuándo era la visita — y Clarity borra
              las grabaciones a los 30 días. Quien lo apretaba sobre un lead de hace
              tres meses caía en su panel sin nada y concluía, razonablemente, que la
              medición no anda. Esconderlo a secas repetiría el problema por el otro
              lado: acá SÍ hubo algo que ver, y hay que decir por qué ya no está. */}
          {grabacionVencida && (
            <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8, lineHeight: 1.55 }}>
              Su grabación ya no existe: Clarity las guarda 30 días y esta visita es anterior.
              Lo que sí queda es todo lo de arriba, que es nuestro y no vence.
            </p>
          )}
          {(urlClarity || urlMapaCalor) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10, alignItems: 'center' }}>
              {/* Se nombra la diferencia en el propio rótulo: el mapa de calor NO es
                  de esta persona —Clarity agrega los clics de todos y no se puede
                  filtrar por alguien—, y un botón sin rótulo al lado de su grabación
                  se leería como que sí. */}
              {urlClarity && (
                <a href={urlClarity} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 9,
                    border: '1px solid var(--border-strong)', background: 'var(--surface)',
                    fontSize: 12, fontWeight: 600, color: 'var(--dim)', textDecoration: 'none' }}>
                  Ver su grabación →
                </a>
              )}
              {urlMapaCalor && (
                <a href={urlMapaCalor} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 9,
                    border: '1px solid var(--border-strong)', background: 'var(--surface)',
                    fontSize: 12, fontWeight: 600, color: 'var(--dim)', textDecoration: 'none' }}>
                  Mapa de calor de la página →
                </a>
              )}
              {/* ⚠️ EL ID QUEDA COPIABLE Y DEJA DE DIBUJARSE. El link abre el panel de
                  Clarity pero NO llega filtrado por esta persona: Clarity descarta los
                  parámetros de filtro que no reconoce y muestra la lista entera, así que
                  sin el id el botón prometía «lo que hizo ÉL» y entregaba «lo que hizo
                  todo el mundo». Pegar el uuid crudo en la ficha de una PERSONA es ruido
                  técnico que competía con el recorrido, así que ahora viaja en un botón:
                  Clarity hashea lo que se pega y lo cruza contra sus datos, o sea que el
                  id crudo sigue siendo exactamente lo que hay que darle. */}
              {urlClarity && visitorId && <CopiarId visitorId={visitorId} />}
            </div>
          )}
        </section>
      )}

      {nombrando && (
        <NombrarVideosModal
          // `filas`, no `porVideo`: las dos puntas de la oferta miran el MISMO
          // universo. Da igual hoy —el modal descarta el balde por su cuenta— y
          // deja de dar igual el día que uno de los dos filtros cambie.
          porVideo={filas}
          videos={vids}
          onCerrar={() => setNombrando(false)}
          onGuardado={(nuevos) => setVideosLocal(nuevos)}
        />
      )}
    </>
  );
}

/**
 * El id del visitante, para pegarlo en el filtro de Clarity.
 *
 * El `title` dice dónde se pega: Filtros → Filtros personalizados → ID de usuario
 * personalizado. Va ahí y no en la pantalla porque es una instrucción de otra
 * herramienta, y un `title` no ocupa un píxel.
 *
 * ⚠️ Y CONFIRMA. Un botón de copiar que no dice nada es indistinguible de uno que
 * no hizo nada: el portapapeles no se ve.
 */
function CopiarId({ visitorId }: { visitorId: string }) {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1600);
    return () => clearTimeout(t);
  }, [copiado]);
  return (
    <button type="button"
      title="Copia su ID. En Clarity: Filtros → Filtros personalizados → ID de usuario personalizado"
      onClick={() => { void navigator.clipboard?.writeText(visitorId).then(() => setCopiado(true)).catch(() => {}); }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 9, cursor: 'pointer',
        border: '1px solid var(--border)', background: 'var(--surface)', fontFamily: 'inherit',
        fontSize: 12, fontWeight: 600, color: copiado ? 'var(--good)' : 'var(--faint)' }}>
      {copiado ? 'Copiado' : 'Copiar su ID'}
    </button>
  );
}
