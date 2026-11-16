// =============================================================================
// LandingAcelerador — /accelerator, la página del MaKo Accelerator (15/11/2026)
// =============================================================================
// Martín, 15/11/2026: «te dejo… una landing que yo ya tenía tanto con mi VSL para mi servicio personalizado como la
// construcción en sí de la landing de mi servicio personalizado. Te pido de que la agreguemos aquí». Es la de Lovable
// (https://panda-stream-spark.lovable.app/), con su diseño copiado (./estilo.ts) y su texto revisado (./contenido.ts):
// a «tú», con el nombre del programa (`PROGRAMA_ACELERADOR.nombre`, hoy «MaKo Accelerator») donde decía «Marketing Koncept»,
// y con lo que el programa es hoy.
//
// EL ORDEN (el de Lovable): la barra con «Aplica ahora»; el héroe con el VSL; cómo se aplica (los cuatro pasos); el caso de
// Mauricio; «No es un caso aislado» (las cifras y los cuatro casos); el programa (las tres fases y los 11 entregables), y
// después de «Y en las tres fases, siempre», lo nuevo: lo que incluye, con su detalle, y la promesa; «¿Esto es realmente para
// ti?»; y otra vez cómo se aplica, ahora con el botón de la llamada. Los testimonios de Lovable no están: ver ./contenido.ts.
//
// LOS BOTONES: todo «Aplica ahora» baja a la sección de aplicar (#aplicar, la del final), y ahí «Agenda tu llamada» abre la
// agenda de Martín en otra pestaña (`AGENDA_ACELERADOR`). Martín, 14/11: «lo de agendar llamadas sí debería estar todavía para
// el tema de Accelerator. Ahí debería haber la agenda de llamada. Pero en ningún otro lado debería estar»; desde el 15/11 la
// columna de /planes trae acá con «Más información» y ya no agenda (tests/planes-tres-bloques.test.ts). El paso 1 («Aplicas
// en el formulario») es el de esa agenda, que pide siete respuestas obligatorias antes de confirmar (./contenido.ts, `APLICAR`).
// ⚠️ El comentario de `RUTA_ACCELERATOR` (app/planes/Tarjetas.tsx) dice que la llamada se pide «por el pedido de
//    /planes/accelerator» (el diagnóstico de 2 minutos): esta página no lo usa. Si se prefiere el pedido, es cambiar el `href`
//    del botón final y una línea del test.
//
// LA BARRA DE ABAJO DEL TELÉFONO (como la de Lovable, que aparecía al bajar y no estaba en la primera pantalla): es `sticky`
// dentro de un tramo que va del caso de Mauricio al «¿Es para ti?», y la sección de aplicar, que va JUSTO después del tramo,
// le pasa por encima (./estilo.ts). Sin JavaScript. Si el tramo arranca antes (en los pasos de arriba), la barra aparece en la
// primera pantalla, encima del «Aplica ahora» del héroe.
//
// ⚠️ PÚBLICA (lib/rutas-publicas.ts): sólo GET, no lee cookies, sin <Suspense> (AGENTS.md: se lee entera sin JavaScript), y
//    sin JavaScript propio: es un componente del servidor; el VSL es un iframe de Panda y los dos videos van con `autoPlay`.
// =============================================================================

import type { ReactNode } from 'react';
import { Axis3d, Castle, ChartColumn, Handshake, Magnet, Map as Mapa, Network, Puzzle, ScanEye, Share2, UserPlus, type LucideIcon } from 'lucide-react';
import { LISTA_DEL_ACELERADOR, PROGRAMA_ACELERADOR } from '@/lib/planes-mako';
import { AGENDA_ACELERADOR, TEXTO_AGENDA_ACELERADOR } from '../planes/Tarjetas';
import { ANCLA_APLICAR, APLICAR, FILTRO, HERO, LEGALES, MAURICIO, PIE, PROGRAMA, RESULTADOS, TEXTO_APLICAR, VSL_ACELERADOR, type IconoEntregable, type Rico } from './contenido';
import { CSS_ACELERADOR, FUENTES_ACELERADOR } from './estilo';

const ICONOS: Record<IconoEntregable, LucideIcon> = {
  mapa: Mapa, castillo: Castle, ojo: ScanEye, ejes: Axis3d, red: Network, iman: Magnet, manos: Handshake,
  rompecabezas: Puzzle, barras: ChartColumn, persona: UserPlus, compartir: Share2,
};

/** `**así**` → <b>así</b>. Lo demás, tal cual. */
export function negritas(texto: Rico): ReactNode[] {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 === 1 ? <b key={i}>{parte}</b> : parte));
}

/** El nombre del programa: la primera palabra en blanco y el resto en naranja, como «MARKETING KONCEPT» en la de Lovable. */
function Marca() {
  const [primera, ...resto] = PROGRAMA_ACELERADOR.nombre.split(' ');
  return <div className="acl-marca">{primera} <span>{resto.join(' ')}</span></div>;
}

const Aplica = ({ clase = 'acl-btn' }: { clase?: string }) => <a href={`#${ANCLA_APLICAR}`} className={clase}>{TEXTO_APLICAR}</a>;

function Pasos() {
  return (
    <ol className="acl-proceso">
      {APLICAR.pasos.map((p, i) => (
        <li className="acl-paso" key={p}>
          <div className="acl-paso-n">Paso {i + 1}</div>
          <h3>{p}</h3>
        </li>
      ))}
    </ol>
  );
}

/** El número del primer entregable de cada fase: corren del 1 al 11 a lo largo de las tres. */
const PRIMERO_DE_CADA_FASE = PROGRAMA.fases.map((_, i) => PROGRAMA.fases.slice(0, i).reduce((suma, f) => suma + f.entregables.length, 1));

export function LandingAcelerador() {
  const pr = PROGRAMA_ACELERADOR;
  return (
    <div className="acl-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_ACELERADOR }} />
      <link rel="stylesheet" href={FUENTES_ACELERADOR} precedence="default" />

      <header className="acl-hdr">
        <Marca />
        <Aplica clase="acl-btn acl-btn-sm" />
      </header>

      <main>
        <section className="acl-hero">
          <div className="acl-wrap">
            <div className="acl-hero-in">
              <span className="acl-pill">{HERO.ceja}</span>
              <h1>{HERO.titulo[0]}<em>{HERO.titulo[1]}</em>{HERO.titulo[2]}</h1>
              <p className="acl-sub">{HERO.bajada}</p>
              <p className="acl-qual">{HERO.calificacion[0]}<b>{HERO.calificacion[1]}</b>{HERO.calificacion[2]}</p>
              <div className="acl-video">
                <span className="acl-esq acl-esq-1" /><span className="acl-esq acl-esq-2" />
                <span className="acl-esq acl-esq-3" /><span className="acl-esq acl-esq-4" />
                <iframe src={VSL_ACELERADOR} title={`Video de presentación de ${pr.nombre}`} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
              </div>
              <div className="acl-hero-cta"><Aplica /></div>
            </div>
          </div>
        </section>

        <section className="acl-sec acl-final acl-tras-heroe">
          <div className="acl-wrap">
            <h2>{APLICAR.titulo}</h2>
            <p className="acl-scar">{APLICAR.bajada}</p>
            <Pasos />
            <div className="acl-sec-div" />
          </div>
        </section>

        {/* El tramo de la barra de abajo del teléfono: del caso de Mauricio al «¿Es para ti?». La sección de aplicar va JUSTO
            después y le pasa por encima (./estilo.ts, `.acl-tramo + .acl-final`). */}
        <div className="acl-tramo">
          <section className="acl-sec acl-mau-s">
            <div className="acl-wrap">
              <div className="acl-mau">
                <div className="acl-mau-titulo">
                  <h2>
                    {MAURICIO.titulo[0]}<span className="acl-plata">{MAURICIO.titulo[1]}</span>{MAURICIO.titulo[2]}
                    <span className="acl-plata">{MAURICIO.titulo[3]}</span>{MAURICIO.titulo[4]}
                  </h2>
                </div>
                <div className="acl-mau-top">
                  <div className="acl-mau-video">
                    <video src={MAURICIO.video} autoPlay muted loop playsInline preload="auto" aria-label="Mauricio en el escenario" />
                  </div>
                  <div className="acl-mau-txt">{MAURICIO.intro.map((p) => <p key={p}>{negritas(p)}</p>)}</div>
                </div>
                <div className="acl-mau-split">
                  <div className="acl-mau-txt">
                    <p className="acl-mau-em">{MAURICIO.importa}</p>
                    {MAURICIO.escenario.map((p) => <p key={p}>{negritas(p)}</p>)}
                  </div>
                  <div className="acl-carr">
                    {MAURICIO.fotos.map((f) => (
                      // eslint-disable-next-line @next/next/no-img-element -- fotos de /public en un carrusel hecho con CSS
                      <img key={f.src} src={f.src} alt={f.alt} width={f.ancho} height={f.alto} loading="lazy" decoding="async" />
                    ))}
                    <div className="acl-puntos" aria-hidden="true">{MAURICIO.fotos.map((f) => <span key={f.src} />)}</div>
                  </div>
                </div>
                <div className="acl-mau-bottom">
                  <p className="acl-mau-pull">{MAURICIO.remate}</p>
                  <div className="acl-otros">
                    {MAURICIO.otros.map((o) => (
                      <div className="acl-otro" key={o}><span className="acl-mk acl-mk-x" aria-hidden="true" /><span>{o}</span></div>
                    ))}
                    <div className="acl-otro acl-otro-ok"><span className="acl-mk acl-mk-c" aria-hidden="true" /><span>{negritas(MAURICIO.loQueNecesitaba)}</span></div>
                  </div>
                  <p className="acl-cierre">{negritas(MAURICIO.cierre)}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="acl-sec">
            <div className="acl-wrap">
              <div className="acl-shead"><h2>{RESULTADOS.titulo}</h2></div>
              <div className="acl-tiles">
                {RESULTADOS.numeros.map((x) => (
                  <div className="acl-tile" key={x.k}>
                    <div className="acl-tile-v">{x.v.map((r, i) => <span key={r}>{i > 0 && <br />}{r}</span>)}</div>
                    <div className="acl-tile-k">{x.k}</div>
                  </div>
                ))}
              </div>
              <div className="acl-casos">
                {RESULTADOS.casos.map((c, i) => (
                  <div className={`acl-cv${i % 2 === 1 ? ' acl-flip' : ''}`} key={c.nombre}>
                    <div className="acl-cv-media">
                      {c.video
                        ? <video src={c.video} autoPlay muted loop playsInline preload="metadata" aria-label={c.nombre} />
                        // eslint-disable-next-line @next/next/no-img-element -- foto de /public, recortada por CSS
                        : <img src={c.foto} alt={c.alt ?? c.nombre} loading="lazy" decoding="async" />}
                    </div>
                    <div className="acl-cv-body">
                      <div className="acl-cv-num">{c.num}</div>
                      <div className="acl-cv-nm">{c.nombre}</div>
                      <p className="acl-cv-ds">{c.texto}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="acl-meto">{RESULTADOS.metodologia}</p>
            </div>
          </section>

          <section className="acl-sec">
            <div className="acl-wrap">
              <div className="acl-shead">
                <h2>{PROGRAMA.titulo}</h2>
                <p className="acl-prog-intro">{PROGRAMA.intro}</p>
              </div>
              {PROGRAMA.fases.map((f, fi) => (
                <div className="acl-fase" key={f.num}>
                  <div className="acl-fase-head">
                    <span className="acl-fase-num">{f.num}</span>
                    <h3 className="acl-fase-titulo">{f.titulo}</h3>
                  </div>
                  <div className="acl-entregables">
                    {f.entregables.map((e, ei) => {
                      const Icono = ICONOS[e.icono];
                      return (
                        <div className="acl-deliv" key={e.nombre}>
                          <div className="acl-deliv-ico"><Icono aria-hidden="true" /></div>
                          <h4>{e.nombre}</h4>
                          <p><span className="acl-ent">Entregable #{PRIMERO_DE_CADA_FASE[fi] + ei}:</span>{e.texto}</p>
                        </div>
                      );
                    })}
                  </div>
                  {f.creativos && (
                    <div className="acl-creativos">
                      <p>{f.creativos.texto} <span className="acl-cr-list">{f.creativos.lista}</span></p>
                    </div>
                  )}
                </div>
              ))}

              <p className="acl-siempre-lbl">{PROGRAMA.siempreTitulo}</p>
              <div className="acl-siempre">
                {PROGRAMA.siempre.map((s) => (
                  <div className="acl-ac" key={s.ceja}>
                    <div className="acl-lbl">{s.ceja}</div>
                    <h3>{s.titulo}</h3>
                    <p>{s.texto}</p>
                  </div>
                ))}
              </div>

              {/* LO QUE INCLUYE Y LA PROMESA (15/11/2026): las dos, del programa (lib/planes-mako.ts), en un bloque aparte de
                  las dos tarjetas de arriba. Sin garantía: Martín la sacó «de todos lados» (./contenido.ts).
                  La lista es `LISTA_DEL_ACELERADOR`: los MISMOS nombres y en el mismo orden que la columna de /planes y su
                  tabla (quien toca «Más información» reconoce lo que acaba de leer), cada uno con el detalle que esa tabla
                  muestra en su «i» (Martín, 15/11 ~23:00). Es «más información» de verdad: la columna dice el nombre, acá
                  se cuenta qué es. Martín, 15/11, sobre lo que no entra en la columna: «dejarlo como medio para generar
                  intriga… que vayan justamente a la nueva landing». Se importa la de lib/planes-mako.ts y no `LISTA_PROGRAMA`
                  (app/planes/Tarjetas.tsx), que es la misma lista con un tipo que no tiene el detalle. */}
              <div className={`acl-oferta${pr.promesa ? '' : ' acl-oferta-sola'}`}>
                <div className="acl-oferta-lista">
                  <div className="acl-lbl">{PROGRAMA.incluyeCeja}</div>
                  <h3>{pr.nombre}</h3>
                  <ul className="acl-checks">
                    {LISTA_DEL_ACELERADOR.map((x) => (
                      <li key={x.corto}>
                        <span className="acl-mk acl-mk-c" aria-hidden="true" />
                        {/* El nombre corto (el de su fila en la tabla de /planes) y su detalle: acá van TODAS las cosas del programa;
                            la columna de /planes muestra menos y con el texto largo (Martín, 15/11, ~23:20). */}
                        <span><b>{x.corto}</b><small>{x.detalle}</small></span>
                      </li>
                    ))}
                  </ul>
                </div>
                {pr.promesa && (
                  <div className="acl-oferta-promesa">
                    <div className="acl-lbl acl-lbl-verde">{PROGRAMA.promesaCeja}</div>
                    <p className="acl-promesa">{pr.promesa}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="acl-sec">
            <div className="acl-wrap">
              <div className="acl-shead"><h2>{FILTRO.titulo}</h2></div>
              <div className="acl-filtro">
                <div className="acl-fcol">
                  <h3>{FILTRO.siTitulo}</h3>
                  <ul>
                    {FILTRO.si.map((x) => (
                      <li key={x.t}><span className="acl-mk acl-mk-c" aria-hidden="true" /><div><b>{x.t}</b><small>{x.d}</small></div></li>
                    ))}
                  </ul>
                </div>
                <div className="acl-fcol acl-fcol-no">
                  <h3>{FILTRO.noTitulo}</h3>
                  <ul>
                    {FILTRO.no.map((x) => (
                      <li key={x.t}><span className="acl-mk acl-mk-x" aria-hidden="true" /><div><b>{x.t}</b><small>{x.d}</small></div></li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <div className="acl-pegado"><Aplica /></div>
        </div>

        <section className="acl-sec acl-final" id={ANCLA_APLICAR}>
          <div className="acl-wrap">
            <h2>{APLICAR.titulo}</h2>
            <p className="acl-scar">{APLICAR.bajada}</p>
            <Pasos />
            <a className="acl-btn acl-btn-grande" href={AGENDA_ACELERADOR} target="_blank" rel="noopener noreferrer">{TEXTO_AGENDA_ACELERADOR}</a>
          </div>
        </section>
      </main>

      <footer className="acl-pie">
        <div className="acl-wrap">
          <div className="acl-pie-fila">
            <Marca />
            <div>
              <small>{PIE} · <span className="acl-nw">© {new Date().getFullYear()} Martín Koncke</span></small>
              <nav className="acl-legales" aria-label="Legales">
                {LEGALES.map((l) => <a key={l.href} href={l.href}>{l.texto}</a>)}
              </nav>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
