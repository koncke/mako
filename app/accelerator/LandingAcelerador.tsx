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
// Mauricio; «No es un caso aislado» (las cifras y los cuatro casos); el programa (las tres fases y los 12 entregables), y
// después de «Y en las tres fases, siempre», lo nuevo: «La inversión» (16/11/2026, a la tarde: el precio arriba y debajo todo lo
// que incluye, con su detalle, en UN bloque dorado); «¿Esto es realmente para ti?»; y otra vez cómo se aplica, con el botón grande. Abajo, el pie del sitio
// (`PieGlobal`, ./page.tsx). Los testimonios de Lovable no están: ver ./contenido.ts.
//
// LOS BOTONES (16/11/2026): TODO «Aplica ahora» lleva al formulario de aplicación (`RUTA_APLICAR`, /accelerator/aplicar): el de
// la barra, el del héroe, el de la barra de abajo del teléfono, el de «La inversión» y el grande del final. Martín: «yo
// no pondría el botón de agendar llamada, sino justamente el botón de aplicar ahora. Y ahí pondría justamente un formulario»
// (el molde, el de Mastery Haus: lib/aplicacion-accelerator.ts). Hasta el 15/11 los «Aplica ahora» bajaban a la sección del
// final y ahí «Agenda tu llamada» abría el Calendly de Martín; ahora la agenda se abre DESPUÉS de aplicar, ya contestada, a
// quien califica (`linkDeLaAgenda`), y en esta página no hay ningún link a Calendly. Con la campaña que trajo la URL
// (`hrefDelFormulario`, ./aplicar/origen.ts; revisión del 16/11/2026): sin eso se perdía si el navegador no mandaba el referrer.
//
// LA BARRA DE ARRIBA (16/11/2026): `BarraAccelerator` (./Barra.tsx, la misma del formulario). Martín: «la top bar… me gusta… la
// que está ahora, pero no hay un botón… para volver a la landing principal… o ver los otros planes»: la estrella de MaKo con el
// nombre del programa vuelve a «/», «Ver planes» lleva a /planes y el botón de la derecha es «Aplica ahora».
//
// LA BARRA DE ABAJO DEL TELÉFONO (como la de Lovable, que aparecía al bajar y no estaba en la primera pantalla): es `sticky`
// dentro de un tramo que va del caso de Mauricio al «¿Es para ti?», y la sección de aplicar, que va JUSTO después del tramo,
// le pasa por encima (./estilo.ts). Sin JavaScript. Si el tramo arranca antes (en los pasos de arriba), la barra aparece en la
// primera pantalla, encima del «Aplica ahora» del héroe. «La inversión» también le pasa por encima (`CSS_INVERSION`): tiene su
// botón, y con la barra de arriba eran tres «Aplica ahora» en la misma pantalla.
//
// ⚠️ PÚBLICA (lib/rutas-publicas.ts): sólo GET, no lee cookies, sin <Suspense> (AGENTS.md: se lee entera sin JavaScript), y
//    sin JavaScript propio: es un componente del servidor; el VSL es un iframe de Panda y los dos videos van con `autoPlay`.
// =============================================================================

import type { ReactNode } from 'react';
import { Axis3d, CalendarCheck, Castle, ChartColumn, Handshake, Magnet, Map as Mapa, Network, Puzzle, ScanEye, Share2, UserPlus, type LucideIcon } from 'lucide-react';
import { LISTA_DEL_ACELERADOR, PROGRAMA_ACELERADOR } from '@/lib/planes-mako';
import type { OrigenCompra } from '@/lib/compra-plan-reglas';
import { hrefDelFormulario } from './aplicar/origen';
import { BarraAccelerator, CSS_BARRA_ACCELERATOR, VerPlanesDelHeroe } from './Barra';
import { ANCLA_APLICAR, APLICAR, FILTRO, HERO, MAURICIO, PRECIO, PROGRAMA, RESULTADOS, TEXTO_APLICAR, VSL_ACELERADOR, type IconoEntregable, type Rico } from './contenido';
import { CSS_ACELERADOR, CSS_INVERSION, FUENTES_ACELERADOR } from './estilo';

const ICONOS: Record<IconoEntregable, LucideIcon> = {
  mapa: Mapa, castillo: Castle, ojo: ScanEye, ejes: Axis3d, red: Network, iman: Magnet, calendario: CalendarCheck, manos: Handshake,
  rompecabezas: Puzzle, barras: ChartColumn, persona: UserPlus, compartir: Share2,
};

/**
 * EL CSS DE LA PÁGINA, EN ESTE ORDEN: el de la landing; el de la barra, que la completa (./Barra.tsx: va DESPUÉS); y el de «La
 * inversión» (./estilo.ts). Desde el 16/11/2026 a la tarde la página ya no dibuja la columna de /planes: no lleva su CSS.
 */
export const CSS_DE_LA_LANDING = CSS_ACELERADOR + CSS_BARRA_ACCELERATOR + CSS_INVERSION;

/** `**así**` → <b>así</b>. Lo demás, tal cual. */
export function negritas(texto: Rico): ReactNode[] {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 === 1 ? <b key={i}>{parte}</b> : parte));
}

const Aplica = ({ href, clase = 'acl-btn' }: { href: string; clase?: string }) => <a href={href} className={clase}>{TEXTO_APLICAR}</a>;

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

/** El número del primer entregable de cada fase: corren del 1 al 12 a lo largo de las tres. */
const PRIMERO_DE_CADA_FASE = PROGRAMA.fases.map((_, i) => PROGRAMA.fases.slice(0, i).reduce((suma, f) => suma + f.entregables.length, 1));

export function LandingAcelerador({ origen = null }: {
  /** La campaña que trajo la URL (./page.tsx): viaja en cada «Aplica ahora» al formulario (`hrefDelFormulario`). */
  origen?: OrigenCompra | null;
} = {}) {
  const pr = PROGRAMA_ACELERADOR;
  const aplicar = hrefDelFormulario(origen);
  return (
    <div className="acl-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_DE_LA_LANDING }} />
      <link rel="stylesheet" href={FUENTES_ACELERADOR} precedence="default" />

      <BarraAccelerator boton={{ href: aplicar, texto: TEXTO_APLICAR }} />

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
              {/* En el teléfono, «Ver planes» debajo del botón: en la barra no entra (./Barra.tsx, `VerPlanesDelHeroe`). */}
              <div className="acl-hero-cta"><Aplica href={aplicar} /><VerPlanesDelHeroe /></div>
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
            </div>
          </section>

          {/* LA INVERSIÓN (16/11/2026, a la tarde). Martín: «me gustaría que la inversión como tal no exista, sino que esté todo dentro
              de lo que incluye MaKo Accelerator. Y me gustaría que esa parte de lo que incluye se llame la inversión… no me gusta de
              que esté una columna vertical sola y suelta. Sería bueno de que esté arriba como la inversión. Y me gusta de que tenga
              como ese colorcito dorado, excepto los checks que sigan siendo verdes». Así que ya no son dos bloques (lo que incluye y,
              debajo, la columna de /planes sola en el medio): es UNO, a todo el ancho, con el precio, cuánto dura y el «Aplica ahora»
              arriba, como la columna, y debajo TODO lo que incluye, con su detalle. El dorado es el de la columna del Accelerator de
              /planes (su brillo en la esquina y su botón); los ✓, los verdes de la página.
              LA LISTA ES `LISTA_DEL_ACELERADOR`: los MISMOS nombres y en el mismo orden que la columna de /planes y su tabla (quien toca
              «Más información» reconoce lo que acaba de leer), cada uno con el detalle de su «i» (Martín, 15/11 ~23:00). Sin garantía
              (Martín la sacó «de todos lados», ./contenido.ts) y sin «Nuestra promesa» (16/11: el sistema ya es el renglón 2).
              El precio es el de la columna (`PROGRAMA_ACELERADOR`), SIN CUOTAS (Martín, 16/11: «en todos lados eliminemos lo de las 3
              cuotas de 500»): debajo, cuánto dura (`periodo`). */}
          <section className="acl-sec acl-inversion-s" aria-labelledby="acl-inversion-titulo">
            <div className="acl-wrap">
              <div className="acl-inversion">
                <div className="acl-inversion-cabeza">
                  <div className="acl-inversion-nombre">
                    <div className="acl-lbl">{PRECIO.ceja}</div>
                    <h3 id="acl-inversion-titulo">{pr.nombre}</h3>
                  </div>
                  <div className="acl-inversion-precio">
                    <div className="acl-inversion-monto">US$ {pr.precioUsd.toLocaleString('es-AR')}</div>
                    <div className="acl-inversion-periodo">{pr.periodo}</div>
                  </div>
                  <Aplica href={aplicar} clase="acl-btn acl-btn-oro" />
                </div>
                <p className="acl-inversion-incluye">{PROGRAMA.incluyeCeja}</p>
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

          <div className="acl-pegado"><Aplica href={aplicar} /></div>
        </div>

        {/* CÓMO SE APLICA, OTRA VEZ, con el botón grande: al formulario, como todos (16/11/2026; hasta el 15/11 era «Agenda tu
            llamada», al Calendly de Martín). El paso 1 («Aplicas en el formulario») es ese formulario. */}
        <section className="acl-sec acl-final" id={ANCLA_APLICAR}>
          <div className="acl-wrap">
            <h2>{APLICAR.titulo}</h2>
            <p className="acl-scar">{APLICAR.bajada}</p>
            <Pasos />
            <a className="acl-btn acl-btn-grande" href={aplicar}>{TEXTO_APLICAR}</a>
          </div>
        </section>
      </main>
      {/* SIN PIE PROPIO (16/11/2026): el de la página es el del sitio (`PieGlobal`, ./page.tsx), que escondía éste. */}
    </div>
  );
}
