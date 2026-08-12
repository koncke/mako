'use client';

// =============================================================================
// Program — el temario, con la estructura de Skool y contenido de autor
// =============================================================================
// LA DECISIÓN DE FONDO: se copia la ESTRUCTURA de Skool —grilla de módulos →
// rail de clases + documento— pero NO su contenido. Y no es capricho: se midió
// el classroom de Skool en vivo y su parte de AUTOR no existe. Para ver el
// avance de alguien hay que entrar miembro por miembro, y no hay una vista del
// temario completo (hay una extensión paga que sólo hace eso). Esa es
// exactamente la parte que Mauricio necesita.
//
// Entonces: donde Skool pone una PORTADA, acá van los datos que dejan auditar el
// temario —cuántas preguntas, cuántas tablas, si está en Whop, quién la
// contesta—. Mauricio no viene a reconocer un módulo por su arte: viene a ver si
// está balanceado y dónde faltan videos.
//
// Del Skool medido se conserva lo que sí sirve:
//   · grilla de cards de módulo con el progreso adentro
//   · rail izquierdo de 300px con el árbol, el módulo activo desplegado
//   · la clase como CAMBIO DE FOCO, no como página nueva: no hay «entrar» y
//     «volver», se clickea otra fila del árbol y listo.

import { useState, type ReactNode } from 'react';
import { Pagina, PageHeader, Status, Banner, Button, Tabs, useToast, Toast, MONO } from '@/app/_ui';
import Link, { useRouter } from '@/app/_ui/Link';
import { sincronizarWhopAction } from '../actions';
import type { Campo } from '@/lib/programa-campos';

type Clase = {
  id: string; rotulo: string; titulo: string; pregunta: string; graba: string;
  atoro: string | null; campos: Campo[]; enWhop: boolean; destraba: boolean;
};
type Modulo = {
  id: string; numero: number; titulo: string; fase: string;
  quien: string; porArea: boolean; clases: Clase[];
  /** Los videos del módulo: cada uno, los ids de clase que cubre. */
  videos: string[][];
};

const TABS = [
  { id: 'clases', label: 'Clases' },
  { id: 'tareas', label: 'Tareas' },
] as const;

const FASE: Record<string, string> = {
  arranque: 'Arranque', norte: 'Norte Estratégico', pas: 'PAS',
  palancas: 'Palancas y umbrales', build: 'Build y arranque',
};

const TIPO: Record<Campo['tipo'], string> = {
  texto: 'Párrafo', linea: 'Una línea', numero: 'Número',
  eleccion: 'Elegir una', checks: 'Marcar varias', tabla: 'Tabla',
};

export function ProgramaApp({ modulos, totales, whopConectado, tabInicial, moduloEnUrl, claseEnUrl }: {
  modulos: Modulo[];
  totales: { clases: number; campos: number; enWhop: number; videos: number };
  whopConectado: boolean;
  tabInicial?: string;
  /** `?m=` y `?c=` — qué módulo y qué clase están abiertos. Ver `Grabar`. */
  moduloEnUrl?: string;
  claseEnUrl?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<string>(() =>
    TABS.some(t => t.id === tabInicial) ? tabInicial! : 'clases');
  // null = la grilla de módulos. Con un módulo elegido, el rail + el documento.
  const [moduloAbierto, setModuloAbierto] = useState<string | null>(null);
  const [claseAbierta, setClaseAbierta] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const { toast, show, clear } = useToast();

  // La tab viaja en la URL para que el link que copiás sea la tab que estás
  // viendo. `scroll: false` porque cambiar de tab no es navegar a otra página.
  const irA = (id: string) => {
    setTab(id);
    router.replace(id === 'clases' ? '/customer-success/programa' : `/customer-success/programa?tab=${id}`, { scroll: false });
  };

  async function sincronizar() {
    setSincronizando(true);
    const r = await sincronizarWhopAction();
    setSincronizando(false);
    show(r.ok
      ? `Listo: ${r.creadas} clases nuevas, ${r.reescritas} reescritas, ${r.sinCambios} sin cambios.`
      : r.error, undefined, r.ok ? 'good' : 'bad');
  }

  const modulo = modulos.find(m => m.id === moduloAbierto) ?? null;
  const clase = modulo?.clases.find(c => c.id === claseAbierta) ?? modulo?.clases[0] ?? null;
  const faltanEnWhop = totales.clases - totales.enWhop;

  const abrirModulo = (id: string) => {
    setModuloAbierto(id);
    setClaseAbierta(modulos.find(m => m.id === id)?.clases[0]?.id ?? null);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const enClases = tab === 'clases';

  return (
    <Pagina ancho={enClases ? 'medida' : modulo ? 'completo' : 'medida'}>
      <PageHeader
        titulo="Program"
        proposito={enClases
          ? `${totales.videos} videos por grabar · ${modulos.length} módulos · ${totales.clases} clases`
          : `${modulos.length} módulos · ${totales.clases} clases · ${totales.campos} preguntas`}
        acciones={whopConectado ? (
          <Button variant="secondary" disabled={sincronizando} onClick={() => void sincronizar()}>
            {sincronizando ? 'Sincronizando…' : 'Sincronizar a Whop'}
          </Button>
        ) : undefined}
      />

      <Tabs tabs={TABS as unknown as { id: string; label: string }[]} activa={tab} onCambio={irA} />

      {!whopConectado ? (
        <Banner tono="warn">Whop no está conectado, así que no se puede saber qué clases están cargadas.</Banner>
      ) : faltanEnWhop > 0 ? (
        <Banner tono="warn">{faltanEnWhop} de {totales.clases} clases todavía no están en Whop.</Banner>
      ) : null}

      {enClases ? (
        <Grabar modulos={modulos} totales={totales} moduloAbierto={moduloEnUrl} claseAbiertaEnUrl={claseEnUrl} />
      ) : !modulo ? (
        <ul className="pg-grid">
          {modulos.map((m) => <li key={m.id}><CardModulo m={m} onAbrir={() => abrirModulo(m.id)} /></li>)}
        </ul>
      ) : (
        <div className="pg-aula">
          {/* El rail: el árbol entero, con el módulo abierto desplegado. Nunca se
              sale del temario para mirar una clase. */}
          <nav className="pg-rail" aria-label="Clases del programa">
            <button className="pg-volver" onClick={() => setModuloAbierto(null)}>← Todos los módulos</button>
            {modulos.map((m) => {
              const es = m.id === modulo.id;
              return (
                <section key={m.id} className={`pg-rmod${es ? ' es' : ''}`}>
                  <button className="cab" onClick={() => abrirModulo(m.id)}>
                    <span className="n">{m.numero}</span>
                    <span className="t">{m.titulo}</span>
                    <span className="q">{m.clases.length}</span>
                  </button>
                  {es && (
                    <ul>
                      {m.clases.map((c) => (
                        <li key={c.id}>
                          <button
                            className={`cl${c.id === clase?.id ? ' es' : ''}`}
                            onClick={() => setClaseAbierta(c.id)}
                            aria-current={c.id === clase?.id ? 'true' : undefined}
                          >
                            <span className="r">{c.rotulo}</span>
                            <span className="ti">{c.titulo}</span>
                            {!c.enWhop && <span className="falta" title="Todavía no está en Whop">·</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </nav>

          {clase && <Documento modulo={modulo} clase={clase} />}
        </div>
      )}

      <Toast state={toast} onClose={clear} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Pagina>
  );
}

/**
 * La tab CLASES: la lista de grabación.
 *
 * Es lo único que Mauricio necesita para sentarse a grabar, así que no lleva
 * nada más: ni cuántas preguntas tiene la tarea, ni de qué bloque del
 * cuestionario sale. Eso vive en la tab Tareas, que contesta la otra pregunta.
 *
 * ⚠️ LA UNIDAD DE ESTA VISTA ES EL VIDEO, NO LA CLASE. Un video puede cubrir
 * varias clases, y ver eso es el punto: son 44 clases y 25 grabaciones, y sin
 * esta vista la única lectura posible era «44 videos».
 *
 * Lista con filete, no pila de cajas: son 25 cosas del mismo tipo.
 */
function Grabar({ modulos, totales, moduloAbierto, claseAbiertaEnUrl }: {
  modulos: Modulo[];
  totales: { clases: number; videos: number };
  moduloAbierto?: string;
  claseAbiertaEnUrl?: string;
}) {
  // ⚠️ QUÉ MÓDULO ESTÁ ABIERTO VIAJA EN LA URL (`?m=m9`), NO EN UN useState.
  // Tres razones, y la tercera es la que decidió:
  //   · el link que Mauricio copia es el módulo que está mirando;
  //   · vuelve con el botón de atrás del navegador, que es lo que uno espera;
  //   · y se puede VERIFICAR sin depender de que el bundle hidrate. La versión
  //     con estado no se pudo probar en el navegador de esta sesión y no había
  //     forma de saber si andaba.
  // Es la misma regla que ya gobierna `?tab=` (ver AGENTS.md → tabs).
  const modulo = modulos.find(m => m.id === moduloAbierto) ?? null;
  const ahorro = totales.clases - totales.videos;

  // NIVEL 3 · UNA clase. Acá vive la indicación de qué grabar.
  const iClase = modulo ? modulo.clases.findIndex(c => c.id === claseAbiertaEnUrl) : -1;
  if (modulo && iClase >= 0) {
    const c = modulo.clases[iClase];
    const sig = modulo.clases[iClase + 1] ?? null;
    // Con quién comparte grabación, si la comparte. Es lo único que queda del
    // agrupado en esta vista: la unidad de la pantalla es la CLASE.
    const grupo = modulo.videos.find(ids => ids.includes(c.id)) ?? [c.id];
    const compañeras = grupo
      .filter(id => id !== c.id)
      .map(id => modulo.clases.findIndex(x => x.id === id) + 1)
      .filter(n => n > 0);

    return (
      <div className="gr-det">
        <Link className="gr-volver" href={`/customer-success/programa?m=${modulo.id}`}>
          ← Módulo {modulo.numero} · {modulo.titulo}
        </Link>
        <p className="migas">Clase {iClase + 1} de {modulo.clases.length}</p>
        <h2 className="tit">{c.titulo}</h2>
        <p className="sub">{c.rotulo} · Módulo {modulo.numero}</p>
        <div className="tags">
          {c.destraba && <Status tono="mako">De las que destraban</Status>}
          {!c.enWhop && <Status tono="warn">Falta en Whop</Status>}
          {modulo.porArea && <Status tono="neutral">Se contesta una vez por área</Status>}
          {modulo.quien !== 'dueño' && <Status tono="info">La contesta el líder del área</Status>}
        </div>

        <QueGrabar clase={c} compañeras={compañeras} />

        {sig && (
          <Link className="gr-sig" href={`/customer-success/programa?m=${modulo.id}&c=${sig.id}`}>
            Clase {iClase + 2} · {sig.titulo} →
          </Link>
        )}
      </div>
    );
  }

  // NIVEL 2 · un módulo: sus CLASES, en la misma card que los módulos.
  if (modulo) {
    const i = modulos.indexOf(modulo);
    const sig = modulos[i + 1] ?? null;
    return (
      <div className="gr-det">
        <Link className="gr-volver" href="/customer-success/programa">← Todos los módulos</Link>
        <p className="migas">Módulo {modulo.numero} · {FASE[modulo.fase] ?? modulo.fase}</p>
        <h2 className="tit">{modulo.titulo}</h2>
        <p className="sub">
          {modulo.clases.length} {modulo.clases.length === 1 ? 'clase' : 'clases'} · {modulo.videos.length} {modulo.videos.length === 1 ? 'grabación' : 'grabaciones'}
        </p>
        <div className="tags">
          {modulo.porArea && <Status tono="neutral">Se graba una vez, se contesta por área</Status>}
          {modulo.quien !== 'dueño' && <Status tono="info">La tarea la contesta el líder del área</Status>}
        </div>

        <Clases modulo={modulo} />

        {sig && (
          <Link className="gr-sig" href={`/customer-success/programa?m=${sig.id}`}>
            Módulo {sig.numero} · {sig.titulo} →
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <p className="gr-intro">
        Las {totales.clases} clases se graban en <b>{totales.videos} videos</b>: en {ahorro} de ellas,
        varias clases comparten una sola grabación porque son partes de una misma explicación y
        cortarlas obliga a repetir la introducción. Cada clase sigue teniendo su propia tarea.
      </p>
      <ul className="gr-grid">
        {modulos.map((m) => <li key={m.id}><CardGrabar m={m} /></li>)}
      </ul>
    </>
  );
}

/**
 * LA card de la tab Clases. Una sola, con dos configuraciones: el módulo en la
 * grilla y el video adentro del módulo.
 *
 * ⚠️ Eran DOS piezas distintas —`.grc` y el `li` de `.gr-vids`— con la misma
 * anatomía y tres números diferentes, que es exactamente lo que AGENTS.md
 * prohíbe: «si comparten esqueleto, es una pieza con dos configuraciones, y
 * mantenerlas separadas garantiza que diverjan». Ya habían divergido en el
 * padding, en el peso del título y en cómo marcaban lo que destraba.
 *
 * El esqueleto, de arriba abajo:
 *   filo     · cuánto de esto ya está cargado en Whop
 *   cab      · el rótulo mono + los estados (módulo: «04 · NORTE»; video: «4.1 + 4.2»)
 *   tit      · el título
 *   children · lo propio de cada una: el conteo en el módulo, la indicación de
 *              qué grabar en el video
 *   tags     · los estados que no entran arriba
 *
 * Es `Link` cuando lleva a algún lado y `div` cuando no: un card que no navega
 * no puede quedar enfocable con el teclado ni pintar el hover de un link.
 */
function CardPrograma({ href, filo, rotulo, chips, titulo, tags, destaca, grande, children }: {
  href?: string;
  /** 0 a 1. Es el filo de arriba: la proporción cargada en Whop. */
  filo: number;
  rotulo: ReactNode;
  chips?: ReactNode;
  titulo: string;
  tags?: ReactNode;
  /** Le pone el borde dorado: acá vive un atoro medido. */
  destaca?: boolean;
  /** El título manda. Lo usa la card de MÓDULO, que es el nivel de arriba. */
  grande?: boolean;
  children?: ReactNode;
}) {
  const dentro = (
    <>
      <span className="filo" aria-hidden><span style={{ width: `${Math.min(100, Math.max(0, filo * 100))}%` }} /></span>
      <span className="cab">
        <span className="rot">{rotulo}</span>
        {chips}
      </span>
      <span className="tit">{titulo}</span>
      {children}
      {tags && <span className="tags">{tags}</span>}
    </>
  );
  const clase = `grc${destaca ? ' destaca' : ''}${grande ? ' grande' : ''}`;
  return href
    ? <Link className={clase} href={href}>{dentro}</Link>
    : <div className={clase}>{dentro}</div>;
}

/** La card de un MÓDULO. El héroe es el número de VIDEOS: la pregunta que trae
 *  a Mauricio a esta pantalla es cuánto le falta grabar. Debajo, chiquito, las
 *  clases que cubren — que es lo que explica por qué el número es más bajo de
 *  lo que esperaba. */
function CardGrabar({ m }: { m: Modulo }) {
  const enWhop = m.clases.filter(c => c.enWhop).length;
  const destraban = m.videos.filter(ids => ids.some(id => m.clases.find(c => c.id === id)?.destraba)).length;
  const juntadas = m.clases.length - m.videos.length;

  return (
    <CardPrograma
      href={`/customer-success/programa?m=${m.id}`}
      filo={enWhop / Math.max(1, m.clases.length)}
      rotulo={`MÓDULO ${m.numero}`}
      chips={<span className="fase">{FASE[m.fase] ?? m.fase}</span>}
      titulo={m.titulo}
      grande
      tags={<>
        {destraban > 0 && <Status tono="mako">{destraban} {destraban === 1 ? 'destraba' : 'destraban'}</Status>}
        {m.porArea && <Status tono="neutral">Por área</Status>}
        {m.quien !== 'dueño' && <Status tono="info">La contesta el líder</Status>}
      </>}
    >
      <span className="pie alto">
        {m.clases.length} {m.clases.length === 1 ? 'clase' : 'clases'} · {m.videos.length} {m.videos.length === 1 ? 'grabación' : 'grabaciones'}
        {juntadas > 0 && <em> · {juntadas === 1 ? 'una comparte' : `${juntadas} comparten`} video</em>}
      </span>
    </CardPrograma>
  );
}

/**
 * Las CLASES de un módulo: una card por clase, en la misma card que los módulos
 * y con el mismo click. Tres niveles con la misma mecánica:
 * módulos → clases → qué grabar.
 *
 * ⚠️ UNA CARD ES UNA CLASE. Que dos clases compartan grabación se dice en una
 * línea adentro de la card, no juntándolas en una: agrupar las cards obligaba a
 * leer «7.1 + 7.2» como si fuera una sola cosa, y son dos tareas distintas que
 * el cliente contesta por separado.
 */
function Clases({ modulo }: { modulo: Modulo }) {
  const numDe = (id: string) => modulo.clases.findIndex(c => c.id === id) + 1;

  return (
    <ul className="gr-grid">
      {modulo.clases.map((c, i) => {
        const grupo = modulo.videos.find(ids => ids.includes(c.id)) ?? [c.id];
        const otras = grupo.filter(id => id !== c.id).map(numDe).filter(n => n > 0);
        return (
          <li key={c.id}>
            <CardPrograma
              href={`/customer-success/programa?m=${modulo.id}&c=${c.id}`}
              filo={c.enWhop ? 1 : 0}
              rotulo={`Clase ${i + 1}`}
              titulo={c.titulo}
              destaca={c.destraba}
              tags={<>
                {c.destraba && <Status tono="mako">Destraba</Status>}
                {!c.enWhop && <Status tono="warn">Falta en Whop</Status>}
              </>}
            >
              <span className="pie">
                {otras.length === 0
                  ? 'Grabación propia'
                  : `Se graba junto con ${otras.length === 1 ? 'la clase' : 'las clases'} ${otras.join(' y ')}`}
              </span>
            </CardPrograma>
          </li>
        );
      })}
    </ul>
  );
}

/** La indicación de qué grabar, con el atoro donde lo hay. Es CONTEXTO, no un
 *  guion: Mauricio sabe su material. */
function QueGrabar({ clase, compañeras }: { clase: Clase; compañeras: number[] }) {
  return (
    <section className="qg">
      <h3>Qué grabar</h3>
      <p className="g">{clase.graba}</p>
      {clase.atoro && <p className="ojo"><b>Ojo con esto.</b> {clase.atoro}</p>}
      {compañeras.length > 0 && (
        <p className="junto">
          Se graba en el mismo video que {compañeras.length === 1 ? 'la clase' : 'las clases'}{' '}
          {compañeras.join(' y ')}: son partes de una misma explicación. La tarea, en cambio, es
          propia de cada clase.
        </p>
      )}
      <h3 className="dos">La tarea que deja el cliente</h3>
      <p className="tarea">{clase.pregunta}</p>
    </section>
  );
}

/** Donde Skool pone la portada, acá va la FORMA del módulo: cuánto pesa, qué le
 *  falta y quién lo contesta. Es lo que se audita, no lo que se reconoce. */
function CardModulo({ m, onAbrir }: { m: Modulo; onAbrir: () => void }) {
  const preguntas = m.clases.reduce((n, c) => n + c.campos.length, 0);
  const tablas = m.clases.reduce((n, c) => n + c.campos.filter(f => f.tipo === 'tabla').length, 0);
  const enWhop = m.clases.filter(c => c.enWhop).length;
  const destraban = m.clases.filter(c => c.destraba).length;
  const pct = (enWhop / Math.max(1, m.clases.length)) * 100;

  return (
    <button className="pg-card" onClick={onAbrir}>
      <span className="filo" aria-hidden><span style={{ width: `${pct}%` }} /></span>
      <span className="cab">
        <span className="num">{String(m.numero).padStart(2, '0')}</span>
        <span className="fase">{FASE[m.fase] ?? m.fase}</span>
      </span>
      <span className="tit">{m.titulo}</span>
      <span className="cifras">
        {m.clases.length} clases · {preguntas} preguntas{tablas > 0 && ` · ${tablas} ${tablas === 1 ? 'tabla' : 'tablas'}`}
      </span>
      <span className="tags">
        {enWhop === m.clases.length
          ? <Status tono="good">En Whop</Status>
          : <Status tono="warn">Faltan {m.clases.length - enWhop} en Whop</Status>}
        {m.quien !== 'dueño' && <Status tono="info">Lo contesta el líder</Status>}
        {m.porArea && <Status tono="neutral">Por área</Status>}
        {destraban > 0 && <Status tono="mako">{destraban} que destraban</Status>}
      </span>
    </button>
  );
}

/** La clase como documento: el enunciado, el atoro y el formulario entero. Es lo
 *  que Mauricio lee antes de una sesión y lo que mira cuando arregla una clase. */
function Documento({ modulo, clase }: { modulo: Modulo; clase: Clase }) {
  return (
    <article className="pg-doc">
      <p className="migas">Módulo {modulo.numero} · {modulo.titulo}</p>
      <h1>
        <span className="r">{clase.rotulo}</span>
        {clase.titulo}
      </h1>
      <p className="res">{clase.pregunta}</p>

      {clase.destraba && (
        <aside className="ojo destraba">
          <b>De los cinco que destraban.</b> Son los atoros medidos en sus cuatro clientes: si hay
          que grabar de a poco, este va primero.
        </aside>
      )}
      {clase.atoro && <aside className="ojo"><b>Ojo con esto.</b> {clase.atoro}</aside>}
      {modulo.quien !== 'dueño' && (
        <aside className="ojo">Este bloque lo contesta <b>el líder del área</b>, no el dueño.</aside>
      )}
      {!clase.enWhop && (
        <aside className="ojo falta">Todavía no está en Whop. Se carga con «Sincronizar a Whop».</aside>
      )}

      <h2 className="h2">Lo que el cliente contesta</h2>
      {clase.campos.length === 0 ? (
        <p className="vacio">Este bloque todavía no tiene formulario.</p>
      ) : (
        <ol className="campos">
          {clase.campos.map((f, i) => (
            <li key={f.id}>
              <span className="num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
              <div className="in">
                <div className="meta">
                  <span className="tipo">{TIPO[f.tipo]}</span>
                  <span className="origen" title="La pregunta del Cuestionario Maestro de la que sale">{f.origen}</span>
                  {f.obligatorio && <span className="obl">Obligatoria</span>}
                </div>
                <p className="label">{f.label}</p>
                {f.ayuda && <p className="ayuda">{f.ayuda}</p>}
                {f.opciones && <ul className="ops">{f.opciones.map((o, j) => <li key={j}>{o}</li>)}</ul>}
                {f.columnas && (
                  <div className="mk-scroll-x">
                    <table>
                      <thead><tr>{f.columnas.map((c, j) => <th key={j}>{c}</th>)}</tr></thead>
                      <tbody>
                        {(f.filasFijas ?? ['', '']).map((fila, j) => (
                          <tr key={j}>{f.columnas!.map((_, k) => <td key={k}>{k === 0 ? fila : ''}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                    {f.filasMin && <p className="ayuda">Mínimo {f.filasMin} renglones.</p>}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

const CSS = `
/* ── La tab Clases: la grilla de módulos ──────────────────────────────────── */
.gr-intro{ font-size:14.5px; line-height:1.6; color:var(--dim); margin:0 0 22px; }
.gr-intro b{ color:var(--ink); }

/* UNA sola grilla, en dos anchos. Los módulos son fichas cortas y entran de a
   cuatro; los videos llevan prosa adentro, así que como mucho van de a dos y
   recién desde 1200px de VIEWPORT: el <main> comparte el ancho con la barra
   lateral, y a 1000px las dos columnas caerían en ~330px cada una, donde el
   bullet se lee en tiras de cuatro palabras. */
.gr-grid{ list-style:none; margin:0; padding:0; display:grid; gap:14px;
  grid-template-columns:repeat(auto-fill, minmax(268px, 1fr)); align-items:start; }
.gr-grid > li{ display:flex; }



/* LA card de esta tab: la misma para un módulo y para un video. */
.grc{ position:relative; display:flex; flex-direction:column; width:100%;
  background:var(--surface); border:1px solid var(--border); border-radius:14px;
  padding:20px 18px 16px; text-align:left; font:inherit; color:inherit;
  overflow:hidden; transition:border-color .15s; }
a.grc{ cursor:pointer; text-decoration:none; }
a.grc:hover{ border-color:var(--border-strong); }
/* Acá vive un atoro medido. Borde dorado y NO fondo dorado: sobre --mako-bg el
   chip «Destraba» queda con el mismo fondo que la card y deja de leerse como
   chip. El borde solo tampoco alcanza —el color nunca es el único portador—,
   por eso el chip sigue estando. */
.grc.destaca{ border-color:var(--mako); }
.grc .filo{ position:absolute; inset:0 0 auto 0; height:3px; background:var(--border); }
.grc .filo span{ display:block; height:100%; background:var(--good); }
.grc .cab{ display:flex; align-items:baseline; gap:9px; flex-wrap:wrap; }
/* «MÓDULO 1» en versalitas: es el nombre del capítulo, no un número de índice. */
.grc .rot{ font-family:${MONO}; font-size:10.5px; letter-spacing:.11em; text-transform:uppercase;
  color:var(--faint); font-variant-numeric:tabular-nums; }
.grc.destaca .rot{ color:var(--mako-ink); }
.grc .fase{ font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); }
.grc .tit{ display:block; margin:9px 0 0; font-size:16.5px; font-weight:650; letter-spacing:-.018em;
  line-height:1.25; }
/* En la card de MÓDULO el título es el protagonista: es lo que se reconoce de un
   vistazo, no el conteo. Por eso ahí no hay número grande. */
.grc.grande .tit{ margin-top:7px; font-size:23px; font-weight:700; letter-spacing:-.028em;
  line-height:1.18; }
.grc .pie.alto{ margin-top:14px; }
/* El número de videos es el héroe de la card de MÓDULO: es la pregunta que
   trae a esta pantalla. */
.grc .cifra{ display:flex; align-items:baseline; gap:7px; margin:16px 0 0; }
.grc .cifra b{ font-size:30px; font-weight:700; letter-spacing:-.03em; line-height:1;
  font-variant-numeric:tabular-nums; }
.grc .cifra span{ font-size:13px; color:var(--dim); }
.grc .pie{ display:block; margin:5px 0 0; font-size:12.5px; color:var(--faint);
  font-variant-numeric:tabular-nums; }
.grc .pie em{ font-style:normal; color:var(--mako-ink); }
.grc .tags{ display:flex; gap:5px; flex-wrap:wrap; margin-top:auto; padding-top:14px; }

/* NIVEL 3 · qué grabar. Acá el ancho es de LECTURA: es prosa, no una ficha. */
.qg{ margin:26px 0 0; }
.qg h3{ font-size:10.5px; letter-spacing:.11em; text-transform:uppercase; color:var(--faint);
  font-weight:600; margin:0 0 10px; padding-top:20px; border-top:1px solid var(--border); }
.qg h3.dos{ margin-top:30px; }
.qg .g{ font-size:16px; line-height:1.65; color:var(--ink); margin:0; max-width:68ch; }
.qg .ojo{ font-size:14px; line-height:1.6; color:var(--dim); margin:16px 0 0;
  border-left:2px solid var(--mako); padding-left:14px; max-width:68ch; }
.qg .ojo b{ color:var(--ink); }
.qg .junto{ font-size:13.5px; line-height:1.6; color:var(--faint); margin:16px 0 0; max-width:68ch; }
.qg .tarea{ font-size:15px; line-height:1.6; color:var(--dim); margin:0; max-width:68ch; }

/* ── La tab Clases: los videos de un módulo ───────────────────────────────── */
.gr-det{ padding:0 0 40px; }
.gr-volver{ background:none; border:0; padding:0 0 18px; font:inherit; font-size:12.5px;
  color:var(--dim); cursor:pointer; }
.gr-volver:hover{ color:var(--ink); }
.gr-det .migas{ font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint);
  margin:0 0 10px; }
.gr-det .tit{ font-size:clamp(22px,3.4vw,28px); font-weight:700; letter-spacing:-.03em;
  line-height:1.15; margin:0 0 8px; }
.gr-det .sub{ font-size:14.5px; color:var(--dim); margin:0; font-variant-numeric:tabular-nums; }
.gr-det .tags{ display:flex; gap:5px; flex-wrap:wrap; margin:12px 0 0; }
.gr-det .gr-grid{ margin-top:26px; }
.gr-sig{ display:block; width:100%; margin:24px 0 0; padding:15px 18px; text-align:left;
  background:var(--surface); border:1px solid var(--border); border-radius:11px;
  font:inherit; font-size:14px; color:var(--dim); text-decoration:none;
  cursor:pointer; transition:border-color .15s; }
.gr-sig:hover{ border-color:var(--border-strong); color:var(--ink); }

/* ── La grilla de módulos ─────────────────────────────────────────────────── */
.pg-grid{ list-style:none; margin:18px 0 0; padding:0; display:grid; gap:14px;
  grid-template-columns:repeat(auto-fill, minmax(268px, 1fr)); }
.pg-grid > li{ display:flex; }
.pg-card{ position:relative; display:flex; flex-direction:column; width:100%;
  background:var(--surface); border:1px solid var(--border); border-radius:14px;
  padding:20px 18px 16px; text-align:left; font:inherit; color:inherit; cursor:pointer;
  overflow:hidden; transition:border-color .15s; }
.pg-card:hover{ border-color:var(--border-strong); }
.pg-card .filo{ position:absolute; inset:0 0 auto 0; height:3px; background:var(--border); }
.pg-card .filo span{ display:block; height:100%; background:var(--good); }
.pg-card .cab{ display:flex; align-items:baseline; gap:9px; }
.pg-card .num{ font-family:${MONO}; font-size:12px; color:var(--faint); font-variant-numeric:tabular-nums; }
.pg-card .fase{ font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); }
.pg-card .tit{ display:block; margin:9px 0 0; font-size:16.5px; font-weight:650; letter-spacing:-.018em;
  line-height:1.25; }
.pg-card .cifras{ display:block; margin:7px 0 0; font-size:12.5px; color:var(--dim);
  font-variant-numeric:tabular-nums; }
.pg-card .tags{ display:flex; gap:5px; flex-wrap:wrap; margin-top:auto; padding-top:14px; }

/* ── El aula: rail + documento ────────────────────────────────────────────── */
.pg-aula{ display:grid; grid-template-columns:1fr; gap:0; margin-top:16px; }
@media(min-width:1000px){ .pg-aula{ grid-template-columns:300px 1fr; } }

.pg-rail{ border-bottom:1px solid var(--border); padding:0 0 20px; margin-bottom:20px; }
@media(min-width:1000px){
  .pg-rail{ border-bottom:0; border-right:1px solid var(--border); padding:0 16px 30px 0;
    margin-bottom:0; position:sticky; top:16px; max-height:calc(100vh - 40px); overflow-y:auto; }
}
.pg-volver{ background:none; border:0; padding:6px 0 14px; font:inherit; font-size:12.5px;
  color:var(--dim); cursor:pointer; }
.pg-volver:hover{ color:var(--ink); }

.pg-rmod{ margin:0 0 3px; }
.pg-rmod .cab{ display:flex; align-items:center; gap:9px; width:100%; background:none; border:0;
  padding:8px 9px; border-radius:8px; text-align:left; font:inherit; cursor:pointer; }
.pg-rmod .cab:hover{ background:var(--surface-2); }
.pg-rmod.es .cab{ background:var(--surface-2); }
.pg-rmod .cab .n{ font-family:${MONO}; font-size:10.5px; color:var(--faint); min-width:14px;
  font-variant-numeric:tabular-nums; }
.pg-rmod .cab .t{ font-size:13px; flex:1; }
.pg-rmod.es .cab .t{ font-weight:650; }
.pg-rmod .cab .q{ font-family:${MONO}; font-size:10px; color:var(--faint); }
.pg-rmod ul{ list-style:none; margin:2px 0 8px; padding:0 0 0 23px; }
.pg-rmod .cl{ display:flex; align-items:center; gap:8px; width:100%; background:none; border:0;
  padding:6px 9px; border-radius:7px; text-align:left; font:inherit; cursor:pointer; }
.pg-rmod .cl:hover{ background:var(--surface-2); }
.pg-rmod .cl.es{ background:var(--mako-bg); }
.pg-rmod .cl .r{ font-family:${MONO}; font-size:10px; color:var(--faint); min-width:22px;
  font-variant-numeric:tabular-nums; }
.pg-rmod .cl .ti{ font-size:12.5px; line-height:1.35; color:var(--dim); }
.pg-rmod .cl.es .ti{ color:var(--ink); font-weight:600; }
.pg-rmod .cl .falta{ margin-left:auto; color:var(--warn); font-size:17px; line-height:0; }

/* ── El documento ─────────────────────────────────────────────────────────── */
.pg-doc{ padding:0 0 60px; }
@media(min-width:1000px){ .pg-doc{ padding:4px 0 60px 44px; max-width:680px; } }
.pg-doc .migas{ font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint);
  margin:0 0 12px; }
.pg-doc h1{ display:flex; align-items:baseline; gap:11px; flex-wrap:wrap; margin:0 0 12px;
  font-size:clamp(22px,3.4vw,28px); font-weight:700; letter-spacing:-.03em; line-height:1.15; }
.pg-doc h1 .r{ font-family:${MONO}; font-size:13px; font-weight:500; color:var(--faint);
  font-variant-numeric:tabular-nums; }
.pg-doc .res{ font-size:15.5px; line-height:1.6; color:var(--dim); margin:0 0 20px; }
.pg-doc .ojo{ border-left:2px solid var(--mako); padding:9px 0 9px 15px; margin:0 0 16px;
  font-size:14px; line-height:1.55; color:var(--dim); }
.pg-doc .ojo.falta{ border-left-color:var(--warn); }
.pg-doc .ojo.destraba{ border-left-color:var(--good); }
.pg-doc .ojo b{ color:var(--ink); }
.pg-doc .h2{ font-size:10.5px; letter-spacing:.11em; text-transform:uppercase; color:var(--faint);
  margin:28px 0 6px; font-weight:600; }
.pg-doc .vacio{ color:var(--faint); font-size:14px; }

.pg-doc .campos{ list-style:none; margin:0; padding:0; }
.pg-doc .campos > li{ display:flex; gap:14px; padding:20px 0; border-top:1px solid var(--border); }
.pg-doc .campos .num{ flex:none; width:22px; padding-top:3px; font-family:${MONO}; font-size:10.5px;
  color:var(--faint); font-variant-numeric:tabular-nums; }
.pg-doc .campos .in{ flex:1; min-width:0; }
.pg-doc .meta{ display:flex; gap:7px; align-items:center; flex-wrap:wrap; margin-bottom:6px; }
.pg-doc .tipo{ font-family:${MONO}; font-size:9.5px; letter-spacing:.08em; text-transform:uppercase;
  background:var(--surface-2); border:1px solid var(--border-strong); border-radius:4px; padding:2px 6px; }
.pg-doc .origen{ font-family:${MONO}; font-size:9.5px; color:var(--faint); }
.pg-doc .obl{ font-family:${MONO}; font-size:9.5px; letter-spacing:.07em; color:var(--warn); }
.pg-doc .label{ font-size:15px; line-height:1.5; margin:0; }
.pg-doc .ayuda{ font-size:13px; line-height:1.5; color:var(--faint); margin:6px 0 0; }
.pg-doc .ops{ margin:8px 0 0; padding-left:17px; font-size:13.5px; line-height:1.6; color:var(--dim); }
.pg-doc table{ width:100%; border-collapse:collapse; margin:10px 0 0; font-size:12.5px; }
.pg-doc th{ text-align:left; font-weight:600; padding:6px 9px; border:1px solid var(--border-strong);
  background:var(--surface-2); white-space:nowrap; }
.pg-doc td{ padding:9px; border:1px solid var(--border); color:var(--dim); }

@media(prefers-reduced-motion:reduce){ .pg-card{ transition:none; } }
`;
