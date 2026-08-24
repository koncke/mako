'use client';

/**
 * El curso de Avatar Hype con la pantalla de SU plataforma, replicada.
 *
 * Por que existe una vista aparte: el portal es una grilla de tarjetas con la
 * transcripcion detras de un <details>, y sirve para los 17 cursos que son "video +
 * transcripcion". Este no lo es: su valor esta en el DOCUMENTO de cada leccion -los
 * prompts con sus partes etiquetadas, las imagenes, los clips- y en como esta
 * organizado, con el video y el papel lado a lado.
 *
 * El molde salio del DOM del origen (scripts/ah-html), no de la imaginacion:
 *
 *   .ugc-shell
 *     aside.ugc-side   marca, volver, Inicio, Recursos, MODULOS
 *     .ugc-main
 *       .ugc-topbar    buscador
 *       .ugc-content   indice (hero + modulos + clases) o leccion (video | papel)
 *
 * ATENCION - NADA DE FLECHAS UNICODE EN ESTE ARCHIVO. Un reemplazo hecho con
 * PowerShell rompio la codificacion y los caracteres de 3 bytes se perdieron: en
 * pantalla quedaron rombos negros. El texto se leia bien en el editor y COMPILABA,
 * asi que ni el typecheck ni los tests lo vieron. Las flechas van como entidades
 * (&larr; / &rarr;), que sobreviven a cualquier reescritura.
 *
 * QUE NO SE REPLICA: la barra de SU plataforma (Comunicados, Propuestas, Recomienda y
 * gana, el chat de Ayuda, el Tour). Son features de su producto; aca serian botones
 * que no llevan a ningun lado.
 */

import { useEffect, useMemo, useState } from 'react';
import { Miniatura } from './Miniatura';
import type { Clase, Curso, Recurso } from './curso';

const FLECHA_IZQ = '←';
const FLECHA_DER = '→';

/**
 * Carga la hoja del origen y avisa CUANDO ESTA. Las dos mitades importan.
 *
 * ⚠️ Sin esperar el `load`, hay varios segundos de contenido crudo apilado. Medido a
 * 1440x900 con la cache apagada: durante mas de 4 s el shell renderiza con
 * `display: block`, la barra queda en y=984 midiendo 120x984, y la pantalla se ve
 * exactamente igual que cuando el CSS no matchea. Son 333 KB que se piden reciEn al
 * montar el componente, asi que la ventana es larga y en una conexion lenta, mas.
 *
 * Y no es solo feo: es el mismo cuadro que el dueno reporto tres veces como «no se ve
 * nada» y como «se ve igual que antes». Una pantalla a medio vestir y una pantalla rota
 * son indistinguibles desde afuera, asi que se prefiere no mostrar nada.
 *
 * El `load` se engancha aunque el <link> ya exista de una visita anterior: en ese caso
 * `sheet` ya esta y se contesta al toque, sin esperar un evento que no va a volver.
 */
function useCssDelOrigen() {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const ya = document.getElementById('ahdoc-css') as HTMLLinkElement | null;
    if (ya) { if (ya.sheet) { setListo(true); return; } ya.addEventListener('load', () => setListo(true), { once: true }); return; }
    const l = document.createElement('link');
    l.id = 'ahdoc-css';
    l.rel = 'stylesheet';
    l.href = '/cono-doc/ugc.css';
    l.addEventListener('load', () => setListo(true), { once: true });
    // Si la hoja no carga, mostrar el curso sin estilo es mejor que no mostrar nada:
    // el material sigue siendo legible. Lo que no puede pasar es quedarse en blanco.
    l.addEventListener('error', () => setListo(true), { once: true });
    document.head.appendChild(l);
  }, []);
  return listo;
}

const minutosDe = (cs: Clase[]) => {
  const seg = cs.reduce((t, c) => {
    const m = /(\d{1,2}):(\d{2})/.exec(c.cardDesc || '');
    return t + (m ? Number(m[1]) * 60 + Number(m[2]) : 0);
  }, 0);
  return seg ? `${Math.round(seg / 60)} min` : '';
};

type Modulo = { n: number; nombre: string; clases: Clase[]; portada: string };
type Vista = { clase?: number; recursos?: boolean };

export default function CursoReplica({ curso, onSalir }: { curso: Curso; onSalir?: () => void }) {
  const cssListo = useCssDelOrigen();

  /**
   * ATENCION - LA VISTA VIVE EN LA URL, NO EN EL ESTADO.
   * Con `useState` a secas, refrescar la pagina devolvia a la grilla de cursos: se
   * perdia la clase abierta y, en un link compartido, tambien el curso. Un curso que
   * no sobrevive a F5 no se puede compartir ni dejar abierto en una pestana.
   * Se usa el hash porque esta vista se monta dentro de rutas distintas (/conocimientos
   * y /compartido/<token>) y el hash no depende de ninguna de las dos.
   */
  const [vista, setVista] = useState<Vista>({});
  useEffect(() => {
    const leer = () => {
      const h = new URLSearchParams(location.hash.replace(/^#/, ''));
      const n = Number(h.get('clase'));
      setVista({ clase: Number.isFinite(n) && n > 0 ? n : undefined, recursos: h.get('v') === 'recursos' });
    };
    leer();
    window.addEventListener('hashchange', leer);
    return () => window.removeEventListener('hashchange', leer);
  }, []);
  /**
   * ⚠️ ESCRIBE SOLO SUS CLAVES; el resto del hash NO se toca.
   *
   * Arrancaba de un `URLSearchParams` vacio, o sea REEMPLAZABA el hash entero. En
   * /conocimientos daba igual, pero en un link compartido el hash lo comparte con el
   * portal, que guarda ahi el `curso=`: abrir una clase lo borraba, y al refrescar no
   * quedaba de que curso era esa clase — volvias a la grilla de cursos.
   *
   * Medido en produccion: `#curso=creativos-ugc-realistas` pasaba a `#clase=1`.
   *
   * La regla, que vale para cualquier estado compartido en una misma URL: el que
   * escribe parte de una clave PARTE DE LO QUE HAY, nunca de vacio.
   */
  const ir = (v: Vista) => {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (v.clase) h.set('clase', String(v.clase)); else h.delete('clase');
    if (v.recursos) h.set('v', 'recursos'); else h.delete('v');
    const s = h.toString();
    history.replaceState(null, '', s ? `#${s}` : location.pathname + location.search);
    setVista(v);
    window.scrollTo({ top: 0 });
  };

  const [q, setQ] = useState('');

  const modulos: Modulo[] = useMemo(() => {
    const m = new Map<string, Clase[]>();
    for (const c of curso.clases) {
      const g = c.grupo || 'Sin modulo';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    }
    // El numero del modulo sale del CODIGO de la leccion, no de su posicion: el origen
    // tiene 5 modulos y aca hay 4 -el 2 es una tabla sin lecciones- asi que numerar por
    // indice corria todas las portadas un lugar.
    return [...m.entries()].map(([nombre, clases], i) => {
      const n = Number((clases[0]?.codigo ?? '').split('.')[0]) || i + 1;
      return { n, nombre, clases, portada: `/cono-ugc/m${n}.webp` };
    });
  }, [curso.clases]);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return null;
    return curso.clases.filter((c) => `${c.titulo} ${c.grupo ?? ''} ${c.codigo ?? ''}`.toLowerCase().includes(t));
  }, [q, curso.clases]);

  const clase = vista.clase ? curso.clases.find((c) => c.n === vista.clase) : undefined;

  // Hasta que la hoja del origen este, el curso NO se dibuja: ver `useCssDelOrigen`.
  if (!cssListo) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{curso.titulo}</span>
        <span style={{ opacity: 0.6, fontSize: 13 }}>Abriendo el curso…</span>
      </div>
    );
  }

  return (
    <div className="ahdoc">
      <div className="paper-bg" aria-hidden />
      <div className="grain" aria-hidden />
      <div className="ugc">
        <div className="ugc-shell">
          <aside className="ugc-side" aria-label="Navegacion del curso">
            <div className="ugc-side-brand">
              <span className="ugc-side-name">{curso.titulo}</span>
              <span className="ugc-side-sub">{curso.clases.length} clases</span>
            </div>
            {onSalir && (
              <button type="button" className="ugc-side-exit" onClick={onSalir}>
                <span className="ugc-side-exit-label">{FLECHA_IZQ} Volver a los cursos</span>
              </button>
            )}
            <nav className="ugc-nav">
              {/* El `!q` no sobra: sin el, «Inicio del curso» seguia marcado mientras un
                  modulo estaba filtrando, y quedaban DOS renglones en verde. Una barra que
                  marca dos lugares a la vez no dice donde estas: dice menos que ninguno. */}
              <button type="button" className={`ugc-nav-item${!clase && !vista.recursos && !q ? ' on' : ''}`}
                onClick={() => { setQ(''); ir({}); }}>
                <span className="ugc-nav-label">Inicio del curso</span>
              </button>
              {curso.recursos.length > 0 && (
                <button type="button" className={`ugc-nav-item${vista.recursos ? ' on' : ''}`}
                  onClick={() => { setQ(''); ir({ recursos: true }); }}>
                  <span className="ugc-nav-label">Recursos del curso</span>
                  <span className="ugc-nav-count">{curso.recursos.length}</span>
                </button>
              )}
              <div className="ugc-nav-h">Modulos</div>
              {/* «Estar parado en un modulo» son DOS cosas y la barra tiene que marcar las
                  dos: verlo filtrado, y estar adentro de una de sus clases. La segunda es
                  la que faltaba — con una leccion abierta la barra no marcaba nada, que es
                  justo cuando mas se necesita saber de que modulo es lo que estas viendo. */}
              {modulos.map((m) => (
                <button key={m.nombre} type="button"
                  className={`ugc-nav-item${(clase ? clase.grupo === m.nombre : q === m.nombre) ? ' on' : ''}`}
                  onClick={() => { ir({}); setQ(m.nombre); }} title={m.nombre}>
                  <span className="ugc-nav-num">{m.n}</span>
                  <span className="ugc-nav-label">{m.nombre}</span>
                  <span className="ugc-nav-count">{m.clases.length} {'·'} {minutosDe(m.clases)}</span>
                </button>
              ))}
            </nav>
          </aside>

          <div className="ugc-main">
            <div className="ugc-topbar">
              <div className="ugc-search">
                <input value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value) ir({}); }}
                  placeholder="Buscar leccion, modelo, formato" aria-label="Buscar en el curso" />
              </div>
            </div>

            <div className="ugc-content">
              {clase ? (
                <Leccion clase={clase} curso={curso} ir={ir} />
              ) : vista.recursos ? (
                <Recursos curso={curso} />
              ) : filtradas ? (
                <>
                  <div className="ugc-rail-head"><h2>{filtradas.length} de {curso.clases.length}</h2></div>
                  <div className="ugc-rail">
                    {filtradas.map((c) => <TarjetaClase key={c.n} clase={c} onAbrir={() => ir({ clase: c.n })} />)}
                  </div>
                </>
              ) : (
                <Indice curso={curso} modulos={modulos} onAbrir={(c) => ir({ clase: c.n })}
                  onModulo={(m) => { ir({}); setQ(m.nombre); }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * El indice: el hero de por donde empezar y los modulos.
 *
 * ATENCION - NO va abajo una lista con TODAS las clases. Estaba, y contradecia a la
 * barra: alli se ven 3 modulos y abajo aparecian las 30 clases sueltas, asi que el
 * curso parecia tener dos organizaciones distintas al mismo tiempo. Un modulo se abre
 * y muestra LAS SUYAS.
 */
function Indice({ curso, modulos, onAbrir, onModulo }: {
  curso: Curso; modulos: Modulo[]; onAbrir: (c: Clase) => void; onModulo: (m: Modulo) => void;
}) {
  const primera = curso.clases[0];
  return (
    <>
      {primera && (
        <button type="button" className="ugc-hero" onClick={() => onAbrir(primera)}>
          {primera.portadaClase && <Miniatura className="ugc-hero-img" src={primera.portadaClase} />}
          <span className="ugc-hero-shade" aria-hidden />
          <span className="ugc-hero-body">
            <span className="ugc-hero-eyebrow">Empeza aca{primera.codigo ? ` ${'·'} ${primera.codigo}` : ''}</span>
            <span className="ugc-hero-title">{primera.titulo}</span>
            <span className="ugc-hero-cta">Abrir</span>
          </span>
        </button>
      )}
      <div className="ugc-rail-head"><h2>Los modulos</h2></div>
      <div className="ugc-rail">
        {modulos.map((m) => (
          <button key={m.nombre} type="button" className="ugc-modcard" onClick={() => onModulo(m)}>
            <span className="ugc-modcard-cover">
              {/* ⚠️ La portada del módulo se CONSTRUYE (`/cono-ugc/m${n}.webp`), no se
                  comprueba. «Creativos Animados» sale con n=6 —sus clases no tienen
                  código, así que el número cae al índice— y m6.webp nunca existió: era un
                  404 en CADA carga del índice, dibujando el ícono de imagen rota. Con
                  `Miniatura` la tarjeta se queda con el degradé y su número, que es lo
                  que se ve cuando la tapa sí está. */}
              <Miniatura src={m.portada} />
              <span className="shade" aria-hidden />
              <span className="ugc-modcard-n" aria-hidden>{m.n}</span>
            </span>
            <span className="ugc-modcard-body">
              <span className="ugc-modcard-t">{m.nombre}</span>
              <span className="ugc-modcard-meta">{m.clases.length} lecciones{minutosDe(m.clases) ? ` ${'·'} ${minutosDe(m.clases)}` : ''}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function TarjetaClase({ clase, onAbrir }: { clase: Clase; onAbrir: () => void }) {
  return (
    <button type="button" className="ugc-modcard" onClick={onAbrir}>
      <span className="ugc-modcard-cover">
        {clase.portadaClase && <Miniatura src={clase.portadaClase} />}
        <span className="shade" aria-hidden />
        <span className="ugc-modcard-n" aria-hidden>{clase.codigo ?? clase.n}</span>
      </span>
      <span className="ugc-modcard-body">
        <span className="ugc-modcard-t">{clase.titulo}</span>
        <span className="ugc-modcard-meta">{clase.cardDesc}</span>
      </span>
    </button>
  );
}

/** Los recursos del curso: los 13 que venian del curso viejo (agentes, Notion, PDFs). */
function Recursos({ curso }: { curso: Curso }) {
  const [abierto, setAbierto] = useState<Recurso | null>(null);
  if (abierto) {
    return (
      <div className="ugc-paper">
        <button type="button" className="ugc-btn" onClick={() => setAbierto(null)}>{FLECHA_IZQ} Todos los recursos</button>
        <h2 className="ugc-paper-title">{abierto.label}</h2>
        <p className="ugc-doc-p">{abierto.cardDesc}</p>
        {abierto.intro && <p className="ugc-doc-p">{abierto.intro}</p>}
        {abierto.texto && <pre className="ugc-pre">{abierto.texto}</pre>}
        {abierto.notionUrl && (
          <p className="ugc-doc-p">
            <a href={abierto.notionUrl} target="_blank" rel="noopener noreferrer">Abrir en Notion {FLECHA_DER}</a>
          </p>
        )}
        {abierto.items?.map((i) => (
          <p className="ugc-doc-p" key={i.url}>
            <a href={i.url} target="_blank" rel="noopener noreferrer">{i.label} {FLECHA_DER}</a>
          </p>
        ))}
      </div>
    );
  }
  return (
    <>
      <div className="ugc-rail-head"><h2>Recursos del curso</h2></div>
      <div className="ugc-rail">
        {curso.recursos.map((r) => (
          <button key={r.slug} type="button" className="ugc-modcard" onClick={() => setAbierto(r)}>
            <span className="ugc-modcard-body">
              <span className="ugc-modcard-t">{r.label}</span>
              <span className="ugc-modcard-meta">{r.cardDesc}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function Leccion({ clase, curso, ir }: { clase: Clase; curso: Curso; ir: (v: Vista) => void }) {
  const [doc, setDoc] = useState<{ paneles: Record<string, string> } | null>(null);
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'error'>('idle');
  const [tab, setTab] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [tx, setTx] = useState<string[] | null>(null);

  const i = curso.clases.findIndex((c) => c.n === clase.n);
  const prev = i > 0 ? curso.clases[i - 1] : null;
  const next = i >= 0 && i < curso.clases.length - 1 ? curso.clases[i + 1] : null;

  useEffect(() => {
    setDoc(null); setTab(null); setTx(null);
    if (clase.hasDoc && clase.docSlug) {
      setEstado('cargando');
      fetch(`/cono-doc/${clase.docSlug}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => { setDoc(d); setTab(Object.keys(d.paneles ?? {})[0] ?? null); setEstado('idle'); })
        .catch(() => setEstado('error'));
    }
    // La TRANSCRIPCION, que faltaba. Vive en /cono-tx/<videoId>.json igual que en el
    // portal, y se suma como una tab mas del papel: es contenido de la leccion.
    if (clase.hasTx && clase.videoId) {
      fetch(`/cono-tx/${clase.videoId}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((p: string[]) => setTx(p))
        .catch(() => setTx(null));
    }
  }, [clase.docSlug, clase.hasDoc, clase.videoId, clase.hasTx]);

  const alClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest('.ugc-copy');
    if (!btn) return;
    const pre = (btn.closest('.ugc-card') ?? btn.parentElement)?.querySelector('.ugc-pre');
    const texto = (pre?.textContent ?? '').trim();
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    });
  };

  const tabs = [...Object.keys(doc?.paneles ?? {}), ...(tx?.length ? ['Transcripcion'] : [])];
  const activa = tab && tabs.includes(tab) ? tab : tabs[0] ?? null;

  return (
    <div className="ugc-split">
      <div className="ugc-vcol">
        {/* UNA sola barra de navegacion. Estaba puesta arriba y abajo, asi que los
            botones aparecian dos veces en la misma pantalla. */}
        <nav className="ugc-lecnav">
          <button type="button" className="ugc-btn" onClick={() => ir({})}>{FLECHA_IZQ} Todas las clases</button>
          {prev && <button type="button" className="ugc-btn" onClick={() => ir({ clase: prev.n })}>{FLECHA_IZQ} {prev.titulo}</button>}
          {next && <button type="button" className="ugc-btn" onClick={() => ir({ clase: next.n })}>{next.titulo} {FLECHA_DER}</button>}
        </nav>
        <div className="ugc-ltitle">
          <span className="ugc-pill">{clase.grupo}{clase.codigo ? ` ${'·'} ${clase.codigo}` : ''}</span>
          <h1>{clase.titulo}</h1>
        </div>
        {/* Sin video Y sin portada NO se dibuja el marco. Antes salia igual: un rectangulo
            16:9 negro con la barra debajo, o sea el hueco donde deberia haber un video —
            para una clase que es solo documento (3 de 37: «Musica y efectos», «Agentes»,
            «bienvenida») eso se lee como un reproductor roto, no como una clase de leer. */}
        {(clase.videoId || clase.portadaClase) && (
          <div className="ugc-vcard">
            <div className="ugc-vframe" style={{ aspectRatio: '16 / 9', width: '100%' }}>
              {clase.videoId ? (
                <iframe src={`https://drive.google.com/file/d/${clase.videoId}/preview`}
                  allow="autoplay" title={clase.titulo}
                  style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
              ) : (
                <Miniatura src={clase.portadaClase!} />
              )}
            </div>
            <div className="ugc-vbar"><span className="ugc-vbar-dur">{clase.cardDesc}</span></div>
          </div>
        )}
      </div>

      <div className="ugc-pcol">
        {tabs.length > 0 && (
          <div className="ugc-tabs">
            <div className="ugc-tablist" role="tablist" aria-label="Contenido de la leccion">
              {tabs.map((n) => (
                <button key={n} type="button" role="tab" aria-selected={activa === n}
                  className={`ugc-tab${activa === n ? ' on' : ''}`} onClick={() => setTab(n)}>{n}</button>
              ))}
            </div>
            {copiado && <span className="ugc-badge">Copiado</span>}
          </div>
        )}
        {estado === 'cargando' && <div className="ugc-paper">Cargando el material...</div>}
        {estado === 'error' && <div className="ugc-paper">No pude cargar el material de esta clase.</div>}
        {activa === 'Transcripcion' ? (
          <div className="ugc-paper">
            {/* Copiar y descargar, como en el resto del portal. Sin esto la
                transcripcion es un muro de texto que no se puede llevar a ningun lado,
                y es justamente lo que la gente usa para buscar y citar. */}
            <div className="ugc-lecnav">
              <button type="button" className="ugc-btn"
                onClick={() => navigator.clipboard.writeText((tx ?? []).join('\n\n'))}>
                Copiar transcripcion
              </button>
              <button type="button" className="ugc-btn" onClick={() => {
                // Los caracteres de control van como ESCAPE y nunca como byte crudo: un NUL
                // hace que la busqueda declare binario el archivo y no devuelva ni una linea.
                // Contesta vacio, y el vacio parece una respuesta. Esta escrito en AGENTS.md.
                const sucio = /[<>:"/\\|?*\u0000-\u001f]+/g;
                const nombre = String(clase.titulo).replace(sucio, ' ').trim().slice(0, 90);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([(tx ?? []).join('\n\n')], { type: 'text/plain;charset=utf-8' }));
                a.download = `${nombre}.txt`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}>
                Descargar .txt
              </button>
            </div>
            {tx?.map((p, k) => <p className="ugc-doc-p" key={k}>{p}</p>)}
          </div>
        ) : activa && doc?.paneles[activa] ? (
          <div className="ugc-paper" onClick={alClick}
            dangerouslySetInnerHTML={{ __html: doc.paneles[activa] }} />
        ) : !tabs.length && estado === 'idle' ? (
          <div className="ugc-paper">Esta clase no trae documento.</div>
        ) : null}
      </div>
    </div>
  );
}
