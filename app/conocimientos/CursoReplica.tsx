'use client';

/**
 * El curso de Avatar Hype tal como se ve EN SU PLATAFORMA, no adaptado al portal.
 *
 * ���� Por qué existe una vista aparte ������������������������������������������������������������������������������������
 * El portal (`CursoPortal`) tiene su propio lenguaje: grilla de tarjetas, módulos
 * plegables, la transcripción detrás de un `<details>`. Sirve para los 17 cursos que
 * son «video + transcripción». �0ste no lo es: su valor está en el DOCUMENTO de cada
 * lección �los prompts con sus partes etiquetadas, las imágenes de referencia, los
 * clips� y en cómo está organizado, con el video a la izquierda y el papel a la
 * derecha. Metido en la grilla, ese material queda detrás de dos clicks y se pierde.
 *
 * El molde es el del origen, capturado del DOM (`scripts/ah-html`), no reinventado:
 *
 *   .ugc-shell
 *     aside.ugc-side   marca · volver · Inicio · Recursos · M�DULOS · avance
 *     .ugc-main
 *       .ugc-topbar    buscador · «Ir a⬦» · saludo
 *       .ugc-content   hero «Continúa aquí» · carrusel de módulos
 *                      �o, dentro de una lección� .ugc-split: video | papel
 *
 * �a�️ Los estilos son los del origen (`/cono-doc/ugc.css`, 550 reglas) y se cargan
 *    junto con la vista. Todo va scopeado a `.ahdoc`: son clases suyas y en el CSS
 *    global chocarían con las nuestras en otras pantallas.
 *
 * �a�️ QU�0 NO SE REPLICA, Y POR QU�0. La barra del origen tiene dos capas: la del CURSO
 *    (módulos, progreso, volver) y la de SU PLATAFORMA (Comunicados, Propuestas,
 *    Recomienda y gana, el chat de Ayuda, el Tour). La primera se replica entera. La
 *    segunda no: son features de su producto, y acá serían botones que no llevan a
 *    ningún lado � peor que no estar, porque prometen algo que no existe.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Clase, Curso } from './curso';

/** El CSS del origen, una sola vez para toda la app. */
function useCssDelOrigen() {
  useEffect(() => {
    if (document.getElementById('ahdoc-css')) return;
    const l = document.createElement('link');
    l.id = 'ahdoc-css';
    l.rel = 'stylesheet';
    l.href = '/cono-doc/ugc.css';
    document.head.appendChild(l);
  }, []);
}

const mmss = (s: string | undefined) => (s ?? '').trim();

/** Los minutos de un módulo, sumando lo que cada clase declara («12:28»). */
const minutosDe = (cs: Clase[]) => {
  const seg = cs.reduce((t, c) => {
    const m = /(\d{1,2}):(\d{2})/.exec(c.cardDesc || '');
    return t + (m ? Number(m[1]) * 60 + Number(m[2]) : 0);
  }, 0);
  return seg ? `${Math.round(seg / 60)} min` : '';
};

type Modulo = { n: number; nombre: string; clases: Clase[]; portada: string };

export default function CursoReplica({ curso, onSalir }: { curso: Curso; onSalir?: () => void }) {
  useCssDelOrigen();
  const [abierta, setAbierta] = useState<Clase | null>(null);
  const [q, setQ] = useState('');

  // Los módulos salen del `grupo` de cada clase, en el orden en que aparecen: es el
  // mismo orden del curso y no hay que mantener una lista aparte que se desincronice.
  // �a�️ EL N�aMERO DEL M�DULO SALE DEL C�DIGO DE LA LECCI�N, NO DE SU POSICI�N.
  //    La portada es `/cono-ugc/m<N>.webp` con el N del ORIGEN. Numerar por posición
  //    (i+1) las corre: el origen tiene 5 módulos y acá hay 4 �el 2 es una tabla y no
  //    tiene lecciones�, así que «Fundamentos del método» (que allá es el 3) salía con
  //    la portada del 2, «CATÁLOGO DE MODELOS IA». Se ve como un error de diseño y es
  //    un índice mal calculado.
  const modulos: Modulo[] = useMemo(() => {
    const m = new Map<string, Clase[]>();
    for (const c of curso.clases) {
      const g = c.grupo || 'Sin módulo';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    }
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

  const total = curso.clases.length;

  // �a�️ LOS DOS CONTENEDORES SON OBLIGATORIOS. `.ahdoc` es nuestro scope; `.ugc` es el
  //    del origen, y **593 de las reglas están escritas bajo él** (contra 5 que aplican
  //    sin él). Sin ese div en el medio el CSS no matchea nada y la pantalla queda con
  //    las portadas apiladas a pantalla completa y el texto crudo � que es exactamente
  //    como se veía antes de agregarlo.
  return (
    <div className="ahdoc">
      {/* El fondo del origen: el papel y el grano. Son dos divs vacíos que en su app
          cuelgan del contenedor raíz; sin ellos el curso queda sobre el fondo liso de
          MaKo y deja de parecerse, que fue lo primero que se notó. */}
      <div className="paper-bg" aria-hidden />
      <div className="grain" aria-hidden />
      <div className="ugc">
      <div className="ugc-shell">
        <aside className="ugc-side" aria-label="Navegación del curso">
          <button type="button" className="ugc-side-brand" onClick={() => setAbierta(null)} title="Inicio del curso">
            <span>
              <span className="ugc-side-name">{curso.titulo}</span>
              <span className="ugc-side-sub">{total} clases</span>
            </span>
          </button>
          {onSalir && (
            <button type="button" className="ugc-side-exit" onClick={onSalir} title="Volver a los cursos">
              <span className="ugc-side-exit-label">� � Volver a los cursos</span>
            </button>
          )}
          <nav className="ugc-nav">
            <button type="button" className={`ugc-nav-item${abierta ? '' : ' on'}`} onClick={() => setAbierta(null)}>
              <span className="ugc-nav-label">Inicio del curso</span>
            </button>
            {curso.recursos.length > 0 && (
              <button type="button" className="ugc-nav-item" onClick={() => { setAbierta(null); setQ(''); }}>
                <span className="ugc-nav-label">Recursos del curso</span>
                <span className="ugc-nav-count">{curso.recursos.length}</span>
              </button>
            )}
            <div className="ugc-nav-h">Módulos</div>
            {modulos.map((m) => (
              <button key={m.nombre} type="button" className="ugc-nav-item"
                onClick={() => { setAbierta(null); setQ(m.nombre); }} title={m.nombre}>
                <span className="ugc-nav-num">{m.n}</span>
                <span className="ugc-nav-label">{m.nombre}</span>
                <span className="ugc-nav-count">{m.clases.length} · {minutosDe(m.clases)}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="ugc-main">
          <div className="ugc-topbar">
            <div className="ugc-search">
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar lección, modelo, formato⬦" aria-label="Buscar en el curso" />
            </div>
            <span className="ugc-topbar-hi">{curso.titulo}</span>
          </div>

          <div className="ugc-content">
            {abierta ? (
              <Leccion clase={abierta} curso={curso} onVolver={() => setAbierta(null)}
                onIr={(c) => setAbierta(c)} />
            ) : filtradas ? (
              <>
                <div className="ugc-rail-head"><h2>{filtradas.length} de {total}</h2></div>
                <div className="ugc-rail">
                  {filtradas.map((c) => <TarjetaClase key={c.n} clase={c} onAbrir={() => setAbierta(c)} />)}
                </div>
              </>
            ) : (
              <Indice curso={curso} modulos={modulos} onAbrir={setAbierta} />
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

/** El índice: el hero de «continuá acá» y el carrusel de módulos. */
function Indice({ curso, modulos, onAbrir }: { curso: Curso; modulos: Modulo[]; onAbrir: (c: Clase) => void }) {
  const primera = curso.clases[0];
  return (
    <>
      {primera && (
        <button type="button" className="ugc-hero" onClick={() => onAbrir(primera)}>
          {primera.portadaClase && <img className="ugc-hero-img" src={primera.portadaClase} alt="" aria-hidden />}
          <span className="ugc-hero-shade" aria-hidden />
          <span className="ugc-hero-body">
            <span className="ugc-hero-eyebrow">Empezá acá{primera.codigo ? ` · ${primera.codigo}` : ''}</span>
            <span className="ugc-hero-title">{primera.titulo}</span>
            <span className="ugc-hero-prog">
              <span className="ugc-prog-label">{curso.clases.length} clases</span>
            </span>
            <span className="ugc-hero-cta">Abrir</span>
          </span>
        </button>
      )}

      <div className="ugc-rail-head"><h2>Los módulos</h2></div>
      <div className="ugc-rail">
        {modulos.map((m) => (
          <button key={m.nombre} type="button" className="ugc-modcard" onClick={() => onAbrir(m.clases[0])}>
            <span className="ugc-modcard-cover">
              <img src={m.portada} alt="" aria-hidden />
              <span className="shade" aria-hidden />
              <span className="ugc-modcard-n" aria-hidden>{m.n}</span>
            </span>
            <span className="ugc-modcard-body">
              <span className="ugc-modcard-t">{m.nombre}</span>
              <span className="ugc-modcard-meta">{m.clases.length} lecciones{minutosDe(m.clases) ? ` · ${minutosDe(m.clases)}` : ''}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="ugc-rail-head"><h2>Todas las clases</h2></div>
      <div className="ugc-rail">
        {curso.clases.map((c) => <TarjetaClase key={c.n} clase={c} onAbrir={() => onAbrir(c)} />)}
      </div>
    </>
  );
}

function TarjetaClase({ clase, onAbrir }: { clase: Clase; onAbrir: () => void }) {
  return (
    <button type="button" className="ugc-modcard" onClick={onAbrir}>
      <span className="ugc-modcard-cover">
        {clase.portadaClase && <img src={clase.portadaClase} alt="" aria-hidden />}
        <span className="shade" aria-hidden />
        <span className="ugc-modcard-n" aria-hidden>{clase.codigo ?? clase.n}</span>
      </span>
      <span className="ugc-modcard-body">
        <span className="ugc-modcard-t">{clase.titulo}</span>
        <span className="ugc-modcard-meta">{mmss(clase.cardDesc)}</span>
      </span>
    </button>
  );
}

/**
 * La lección: el split del origen �video a la izquierda, papel a la derecha� con la
 * navegación anterior/siguiente que la plataforma pone abajo.
 */
function Leccion({ clase, curso, onVolver, onIr }: {
  clase: Clase; curso: Curso; onVolver: () => void; onIr: (c: Clase) => void;
}) {
  const [doc, setDoc] = useState<{ paneles: Record<string, string> } | null>(null);
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'error'>('idle');
  const [tab, setTab] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const i = curso.clases.findIndex((c) => c.n === clase.n);
  const prev = i > 0 ? curso.clases[i - 1] : null;
  const next = i >= 0 && i < curso.clases.length - 1 ? curso.clases[i + 1] : null;

  useEffect(() => {
    setDoc(null); setTab(null);
    if (!clase.hasDoc || !clase.docSlug) return;
    setEstado('cargando');
    fetch(`/cono-doc/${clase.docSlug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setDoc(d); setTab(Object.keys(d.paneles ?? {})[0] ?? null); setEstado('idle'); })
      .catch(() => setEstado('error'));
  }, [clase.docSlug, clase.hasDoc]);

  // El botón «copiar» de cada bloque: su JS es del origen y no viaja. El texto sale
  // del `.ugc-pre` del MISMO bloque, no del más cercano: una lección tiene hasta 14
  // botones y equivocarse copia un prompt que no es, sin que se note.
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

  return (
    <div className="ugc-split">
      <div className="ugc-vcol">
        <nav className="ugc-lecnav" style={{ marginBottom: 12 }}>
          <button type="button" className="ugc-btn" onClick={onVolver}>� � Todas las clases</button>
          {prev && <button type="button" className="ugc-btn" onClick={() => onIr(prev)}>� � Anterior</button>}
          {next && <button type="button" className="ugc-btn" onClick={() => onIr(next)}>Siguiente � </button>}
        </nav>
        <div className="ugc-ltitle">
          <span className="ugc-pill">{curso.titulo}{clase.codigo ? ` · ${clase.codigo}` : ''}</span>
          <h1>{clase.titulo}</h1>
        </div>
        {/* �a�️ El reproductor de Drive necesita que le den ALTO. `.ugc-vframe` en el
            origen envuelve un <video>, que trae su propia relación de aspecto; un
            <iframe> no, así que sin esto sale de 150 px �«el video chiquito y
            cortado»�. Se fija 16:9, que es lo que son las clases. */}
        <div className="ugc-vcard">
          <div className="ugc-vframe" style={{ aspectRatio: '16 / 9', width: '100%' }}>
            {clase.videoId ? (
              <iframe src={`https://drive.google.com/file/d/${clase.videoId}/preview`}
                allow="autoplay" title={clase.titulo}
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
            ) : clase.portadaClase ? (
              <img src={clase.portadaClase} alt="" aria-hidden />
            ) : null}
          </div>
          <div className="ugc-vbar"><span className="ugc-vbar-dur">{mmss(clase.cardDesc)}</span></div>
        </div>

        {/* La navegación va ARRIBA del video además de abajo: en una lección larga, un
            «volver» que vive al final del scroll es un «volver» que no existe. */}
        <nav className="ugc-lecnav">
          <button type="button" className="ugc-btn" onClick={onVolver}>� � Todas las clases</button>
          {prev && <button type="button" className="ugc-btn" onClick={() => onIr(prev)}>� � {prev.titulo}</button>}
          {next && <button type="button" className="ugc-btn" onClick={() => onIr(next)}>{next.titulo} � </button>}
        </nav>
      </div>

      <div className="ugc-pcol">
        {estado === 'cargando' && <div className="ugc-paper">Cargando el material⬦</div>}
        {estado === 'error' && <div className="ugc-paper">No pude cargar el material de esta clase.</div>}
        {doc && (
          <>
            <div className="ugc-tabs">
              <div className="ugc-tablist" role="tablist" aria-label="Contenido de la lección">
                {Object.keys(doc.paneles).map((n) => (
                  <button key={n} type="button" role="tab" aria-selected={tab === n}
                    className="ugc-tab" onClick={() => setTab(n)}>{n}</button>
                ))}
              </div>
              {copiado && <span className="ugc-badge">Copiado</span>}
            </div>
            <div className="ugc-paper" onClick={alClick}
              dangerouslySetInnerHTML={{ __html: (tab && doc.paneles[tab]) || '' }} />
          </>
        )}
        {!clase.hasDoc && estado === 'idle' && !doc && (
          <div className="ugc-paper">Esta clase no trae documento.</div>
        )}
      </div>
    </div>
  );
}
