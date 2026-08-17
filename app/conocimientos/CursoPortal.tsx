'use client';

// =============================================================================
// CursoPortal — el portal de UN curso (hub + clase + recurso) y su diseño
// =============================================================================
// Vive acá y no dentro de Conocimientos.tsx porque lo usan DOS lugares:
//   • /conocimientos            → el admin, con navegación por URL y Compartir.
//   • /compartido/<token>       → el invitado sin login, con estado local.
//
// La vista compartida NO es un resumen: es exactamente esto. Cualquier arreglo
// al diseño o al contenido de una clase aparece en los dos lados solo — que era
// el punto de extraerlo. Lo único que cambia entre uno y otro es el chrome de
// arriba y el botón de Compartir (que se pasa por prop, así el bundle público
// ni siquiera lo incluye).
//
// Estética "área de alumnos" de AvatarHype (scope .ahc, papel + lima).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Curso, Clase, Recurso } from './curso';
import CursoReplica from './CursoReplica';
// El desplegable de la casa, y no uno propio: ya resuelve portal (para que no lo
// recorte ningún overflow), click afuera, Escape, cierre al scrollear y foco. Sus
// tokens viven en `:root` de globals.css, que carga el layout raíz — o sea que
// también funciona en /compartido/<token>, que va sin login.
import { Dropdown } from '../components/Dropdown';

export const DRIVE_PREVIEW = (id: string) => `https://drive.google.com/file/d/${id}/preview`;
export const DRIVE_VIEW = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const DRIVE_THUMB = (id: string) => `https://drive.google.com/thumbnail?id=${id}&sz=w480`;
export const nn = (n: number) => String(n).padStart(2, '0');
export const TIPO_BADGE: Record<Recurso['tipo'], string> = { gpt: 'Agente', notion: 'Prompts', pdf: 'Catálogo', bank: 'Recursos', file: 'Descarga' };
// ⚠️ Con pocos números se listan; pasando de 3 se CUENTAN. Listarlos siempre rompía
// la tarjeta: un recurso de un módulo de 12 clases producía
// «CLASES 10·11·12·13·14·15·16·17·18·19·20·21» y desbordaba el ancho. El dato útil
// ahí es «a cuántas pertenece», y el detalle ya está adentro del recurso.
export const claseTag = (clases?: number[]) => {
  if (!clases || !clases.length) return undefined;
  if (clases.length === 1) return `Clase ${clases[0]}`;
  if (clases.length <= 3) return `Clases ${clases.join('·')}`;
  return `${clases.length} clases`;
};

// ⚠️ El badge NO lleva número cuando el título ya trae el suyo. Muchos creadores
// numeran sus lecciones («5.3 ROBA COMO ARTISTA», «11. Temazos») y esa numeración no
// tiene por qué coincidir con la posición real: en «Jaque Blue» la plataforma no
// tiene las lecciones 9, 12, 13 y 14, así que la 5.3 del autor es la 9ª del curso y
// la tarjeta decía «CLASE 09 · 5.3 ROBA COMO ARTISTA». Dos números distintos para la
// misma clase se leen como un error, y el que manda es el del autor: es el que él
// menciona hablando y el que está en sus materiales.
//
// Se mira el TÍTULO, no el curso entero: en un mismo curso conviven clases numeradas
// y sin numerar, y a las segundas el número sí les sirve.
export const seNumeraSola = (titulo: string) => /^\s*\d{1,3}(?:[.\-)]|\s|$)/.test(String(titulo ?? ''));
export const badgeClase = (c: Clase) => (seNumeraSola(c.titulo) ? 'Clase' : `Clase ${nn(c.vn ?? c.n)}`);

const EXT_MSG = 'Alojado por un TERCERO (Notion del creador / Drive de otra cuenta), no en tu dominio. Si su dueño lo elimina, se pierde. Conviene respaldarlo.';
// Marca de advertencia: dato de un tercero (fuera de tu control).
function Ext({ badge }: { badge?: boolean }) {
  return <span className={badge ? 'al-ext al-ext-badge' : 'al-ext'} title={EXT_MSG}>⚠{badge ? '' : ' De un tercero'}</span>;
}

// Póster vertical del video de ejemplo. Drive dibuja su player en horizontal
// (estilo YouTube) y recorta el 9:16 → usamos la miniatura vertical + play, y el
// click abre el clip completo en Drive.
function VidPoster({ id, label }: { id: string; label: string }) {
  return (
    <a href={DRIVE_VIEW(id)} target="_blank" rel="noopener noreferrer" className="al-vid" title="Ver el video de ejemplo (Drive)">
      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de Drive (archivo público), URL externa */}
      <img src={DRIVE_THUMB(id)} alt={`${label} — video de ejemplo`} loading="lazy" className="al-vid-img" />
      <span className="al-vid-play" aria-hidden>▶</span>
      <span className="al-vid-tag">Ver ejemplo</span>
      <Ext badge />
    </a>
  );
}

export function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="al-copy" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1600); } catch { /* seleccionar a mano */ }
    }}>{ok ? '✓ Copiado' : 'Copiar'}</button>
  );
}

// Parseo inline de **negrita** y __subrayado__.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+?\*\*|__[^_]+?__)/g).map((p, i) => {
    if (p.length > 4 && p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.length > 4 && p.startsWith('__') && p.endsWith('__')) return <u key={i}>{p.slice(2, -2)}</u>;
    return p;
  });
}

// Formatea texto de forma NATIVA (títulos MAYÚS / ━━━, ⭐ subtítulos,
// listas 1./-/•, **negrita**, párrafos). No es un volcado monoespaciado.
export function DocContent({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let k = 0;
  const flushPara = () => { if (para.length) { out.push(<p key={k++} className="al-doc-p">{inline(para.join('\n'))}</p>); para = []; } };
  const flushList = () => { if (list.length) { const items = list.slice(); out.push(<ul key={k++} className="al-doc-ul">{items.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>); list = []; } };
  const flush = () => { flushList(); flushPara(); };
  const isSep = (l: string) => /[━─—=_]/.test(l) && /^[\s━─—=_.·*-]{4,}$/.test(l);
  const isHeading = (l: string) => l.length <= 62 && /[A-ZÁÉÍÓÚÑ]/.test(l) && l === l.toUpperCase() && !/[a-záéíóúñ]/.test(l);
  for (const raw of lines) {
    const l = raw.trim();
    if (l === '' || isSep(l)) { flush(); continue; }
    if (l.startsWith('⭐')) { flush(); out.push(<h5 key={k++} className="al-doc-h5">{l.replace(/^⭐\s*/, '')}</h5>); continue; }
    if (isHeading(l)) { flush(); out.push(<h4 key={k++} className="al-doc-h4">{l}</h4>); continue; }
    const m = l.match(/^(?:\d+[.)]|[-•▪·*])\s+(.*)$/);
    if (m) { flushPara(); list.push(m[1]); continue; }
    flushList(); para.push(l);
  }
  flush();
  return <div className="al-doc">{out}</div>;
}

// `img` es opcional a propósito: la tarjeta de un curso con portada la muestra, y la
// de una clase o un recurso sigue siendo la misma tarjeta sin imagen. Un componente
// por caso los haría divergir en tres números, que es lo que ya pasó con `.mk-fila`.
export function Card({ badge, nota, titulo, desc, onClick, ariaLabel, img }: { badge: string; nota?: string; titulo: string; desc: string; onClick: () => void; ariaLabel: string; img?: string }) {
  return (
    <button type="button" className={img ? 'al-rescard al-rescard-img' : 'al-rescard'} onClick={onClick} aria-label={ariaLabel}>
      {img && (
        <span className="al-rescard-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element -- estática en public/, sin optimizar */}
          <img src={img} alt="" loading="lazy" />
        </span>
      )}
      <span className="al-rescard-top">
        <span className="al-rescard-badge">{badge}</span>
        {nota && <span className="al-rescard-nota">{nota}</span>}
      </span>
      <span className="al-rescard-title">{titulo}</span>
      {desc && <span className="al-rescard-desc">{desc}</span>}
      <span className="al-rescard-go">Abrir <span className="al-arr">→</span></span>
    </button>
  );
}

// ── Selector de cursos (la portada de la tab) ────────────────────────────────
// Vive acá por la MISMA razón que el hub: lo usan el admin (`/conocimientos`) y
// el link compartido de la tab entera (`/compartido/<token>`). La lista llega
// por prop porque no es la misma en los dos lados — Branding no se puede servir
// sin login (ver `CURSOS_COMPARTIBLES` en catalogo.ts).
export function Selector({ cursos, enter, compartir, sinMarca, foco }: {
  cursos: Curso[];
  enter: (slug: string) => void;
  compartir?: ReactNode;
  /** Un link repartido afuera no lleva el nombre de la casa. Es un booleano y no
   *  el texto del rótulo a propósito: así los dos rótulos viven en ESTE archivo y
   *  no se puede escribir un tercero desde otra pantalla. */
  sinMarca?: boolean;
  /** El curso del que se acaba de VOLVER. Su tarjeta se trae a la vista.
   *
   *  Sin esto, salir de un curso devolvía al tope de la lista y la tarjeta de la que
   *  venías quedaba fuera de pantalla: medido, `y = 1879` en una ventana de 720. En una
   *  lista de 20 cursos eso no se lee como «volví»: se lee como «me sacó a otro lado», y
   *  para retomar hay que buscar de nuevo el curso que acabás de cerrar.
   *
   *  Es la contracara de la regla de que el destino de «Volver» es una propiedad de la
   *  pantalla: el destino es el índice, sí, pero el índice tiene un LUGAR. */
  foco?: string;
}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);

  // La tarjeta del curso del que volvés, a la vista. Se busca por su `aria-label`, que es
  // el que ya escribe `Card` — un `id` nuevo sería un segundo nombre para lo mismo.
  const tituloFoco = foco ? cursos.find((c) => c.slug === foco)?.titulo : undefined;
  useEffect(() => {
    if (!tituloFoco) return;
    // Se compara el atributo en JS y no se arma un selector: un título con comillas
    // rompería el selector, y ese es justo el caso que nadie prueba.
    const el = [...document.querySelectorAll('[aria-label^="Entrar a "]')]
      .find((e) => e.getAttribute('aria-label') === `Entrar a ${tituloFoco}`);
    el?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
  }, [tituloFoco]);

  // Sin acentos y sin mayúsculas: buscar «organico» tiene que encontrar «Orgánico»,
  // y «generacion» a «IA & Generación de Imágenes y Vídeo». Un buscador que exige
  // tildes es un buscador que no se usa.
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Cada término por separado, todos tienen que estar: «claude rodrigo» encuentra el
  // curso aunque las dos palabras vivan en campos distintos.
  const coincide = (c: Curso, terminos: string[]) => {
    const heno = norm(`${c.titulo} ${c.cardDesc} ${c.categoria} ${c.subtitulo}`);
    return terminos.every((t) => heno.includes(t));
  };

  const terminos = useMemo(() => norm(q).split(/\s+/).filter(Boolean), [q]);

  // Los contadores de los chips salen del TEXTO buscado pero ignoran la categoría
  // elegida: si no, al filtrar por una, las demás muestran 0 y no se puede saltar.
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cursos) {
      if (!coincide(c, terminos)) continue;
      m.set(c.categoria, (m.get(c.categoria) ?? 0) + 1);
    }
    return m;
  }, [cursos, terminos]);

  // Cuántos quedan ignorando la categoría: es lo que promete «Todas», así que sale
  // de la misma cuenta que los contadores de cada una y no de `filtrados`.
  const totalFiltrado = useMemo(() => [...porCategoria.values()].reduce((a, b) => a + b, 0), [porCategoria]);

  const filtrados = useMemo(
    () => cursos.filter((c) => (!cat || c.categoria === cat) && coincide(c, terminos)),
    [cursos, cat, terminos],
  );

  const cats = useMemo(() => {
    const m: Record<string, Curso[]> = {};
    for (const c of filtrados) (m[c.categoria] = m[c.categoria] || []).push(c);
    return m;
  }, [filtrados]);

  const filtrando = Boolean(q.trim() || cat);
  const limpiar = () => { setQ(''); setCat(null); };

  return (
    <>
      <section className="al-hero">
        <div className="al-hero-top">
          <span className="al-eyebrow"><span className="d" /> {sinMarca ? 'Conocimientos' : 'Conocimientos · MaKo'}</span>
          {compartir}
        </div>
        <h1 className="al-h1">Cursos</h1>
        <p className="al-sub">Formación interna. Elegí un curso para entrar. Cada categoría junta los cursos del mismo tema.</p>
      </section>

      <section className="al-filtros">
        <div className="al-buscar">
          <span className="al-buscar-ico" aria-hidden>⌕</span>
          <input
            type="search"
            className="al-buscar-in"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por curso, autor o tema…"
            aria-label="Buscar cursos"
          />
          {q && <button type="button" className="al-buscar-x" onClick={() => setQ('')} aria-label="Borrar la búsqueda">×</button>}
        </div>
        {/* El filtro va PEGADO al buscador y no como una fila de chips sueltos: son el
            mismo gesto —acotar la lista— y separarlos hacía leer dos controles. */}
        <Dropdown
          value={cat ?? ''}
          onChange={(v) => setCat(v || null)}
          ariaLabel="Filtrar por categoría"
          align="right"
          // Sin `icono`: el Dropdown ya dibuja su propio caret a la derecha y sumar
          // otro deja el botón con DOS flechitas («⏷ Todas las categorías ▾»).
          // El rótulo ya dice qué es esto.
          // El contador va en el SUBTÍTULO y no pegado al nombre: con el número al
          // lado, «Anuncios 1» se lee como si la categoría se llamara así.
          options={[
            { value: '', label: 'Todas las categorías', sub: `${totalFiltrado} curso${totalFiltrado === 1 ? '' : 's'}` },
            ...[...new Set(cursos.map((c) => c.categoria))].map((k) => {
              const n = porCategoria.get(k) ?? 0;
              return {
                value: k,
                label: k,
                sub: n === 0 ? 'Sin resultados' : `${n} curso${n === 1 ? '' : 's'}`,
                // Una categoría vacía se DESHABILITA pero no se esconde: si desaparece,
                // el menú se reordena debajo del cursor mientras se escribe.
                disabled: n === 0,
              };
            }),
          ]}
          buttonStyle={{
            fontFamily: 'var(--disp)', fontSize: 15.5, fontWeight: 500,
            border: '1.5px solid var(--ink)', borderRadius: 11, padding: '12px 14px',
            background: cat ? 'var(--lime)' : 'var(--card)', color: 'var(--ink)',
            boxShadow: 'var(--shadow-paste)', whiteSpace: 'nowrap',
          }}
        />
      </section>

      {filtrando && filtrados.length === 0 && (
        <section className="al-sec">
          <p className="al-sub">
            Ningún curso coincide{q.trim() ? ` con «${q.trim()}»` : ''}{cat ? ` en ${cat}` : ''}.{' '}
            <button type="button" className="al-linkbtn" onClick={limpiar}>Ver todos</button>
          </p>
        </section>
      )}

      {/* `nombreCat`, no `cat`: el estado del filtro se llama `cat` y una variable del
          map con el mismo nombre lo tapa adentro de la sección. */}
      {Object.entries(cats).map(([nombreCat, list]) => (
        <section className="al-sec" key={nombreCat}>
          <div className="al-seclabel"><span>{nombreCat}</span><span className="al-vol">{list.length} curso{list.length > 1 ? 's' : ''}</span></div>
          <div className="al-grid">
            {list.map((c) => (
              <Card key={c.slug} badge="Curso" titulo={c.titulo} desc={c.cardDesc} img={c.portada}
                ariaLabel={`Entrar a ${c.titulo}`} onClick={() => enter(c.slug)} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

// ── Hub del curso ────────────────────────────────────────────────────────────
// `compartir` es el botón de Compartir del admin, inyectado desde afuera: la
// vista pública no lo pasa y así ese código no llega al invitado.
// `back` es el MISMO de ClaseDetail y RecursoDetail, no uno nuevo: ya venía cableado
// desde los dos lados (el portal del admin y el link compartido) y el hub era la única
// vista de las tres que no lo dibujaba — se entraba a un curso y no había salida.
// `backLabel`: a dónde vuelve, cuando no es obvio. En el admin el destino es la
// pantalla anterior y «← Volver» alcanza; en un link que comparte la TAB entera
// el destino es el listado de cursos, y un «Volver» pelado no lo dice — el dueño
// leyó la pantalla como que no había salida, con el botón puesto.
export function Hub({ curso, goClase, goRecurso, compartir, back, backLabel }: { curso: Curso; goClase: (n: number) => void; goRecurso: (slug: string) => void; compartir?: ReactNode; back?: () => void; backLabel?: string }) {
  // DOS niveles: módulo (`grupo`) → sección (`subgrupo`). Antes se agrupaba solo por
  // módulo y las 24 clases de uno caían en una lista plana, aunque la plataforma sí
  // las divide en secciones. El orden se toma del ORDEN DE LAS CLASES, no de un sort
  // alfabético: el módulo 10 tiene que ir después del 9, y «10» < «9» en texto.
  const modulos = useMemo(() => {
    const m = new Map<string, Map<string, Clase[]>>();
    for (const c of curso.clases) {
      const g = c.grupo || '';
      const s = c.subgrupo || '';
      if (!m.has(g)) m.set(g, new Map());
      const sub = m.get(g)!;
      if (!sub.has(s)) sub.set(s, []);
      sub.get(s)!.push(c);
    }
    return [...m.entries()].map(([g, sub]) => ({
      grupo: g,
      total: [...sub.values()].reduce((a, x) => a + x.length, 0),
      secciones: [...sub.entries()].map(([s, cs]) => ({ nombre: s, clases: cs })),
    }));
  }, [curso]);
  const conModulos = curso.clases.some((c) => c.grupo);
  const claseCard = (c: Clase) => (
    <Card key={c.n} badge={badgeClase(c)} titulo={c.titulo} desc={c.cardDesc}
      ariaLabel={`Abrir ${c.titulo}`} onClick={() => goClase(c.n)} />
  );
  return (
    <>
      {back && <button type="button" className="al-back" onClick={back}>← {backLabel ?? 'Volver'}</button>}
      <section className="al-hero">
        <div className="al-hero-top">
          <span className="al-eyebrow"><span className="d" /> {curso.eyebrow}</span>
          {compartir}
        </div>
        {/* La portada arriba de todo, antes del título: es la identidad del curso. */}
        {curso.portada && (
          <div className="al-portada">
            {/* eslint-disable-next-line @next/next/no-img-element -- estática en public/ */}
            <img src={curso.portada} alt={`Portada de ${curso.titulo}`} />
          </div>
        )}
        {/* El título del CURSO, no un rótulo genérico: «Tus recursos» estaba hardcodeado
            acá y salía igual en los ocho cursos. */}
        <h1 className="al-h1">{curso.titulo}</h1>
        <p className="al-sub">{curso.subtitulo}</p>
      </section>
      <section className="al-sec">
        {/* ⚠️ El «·» va solo si hay DOS cosas que separar. `volumen` es un rótulo libre
            («Vol. 1–3») que no todos los cursos tienen, y los del pipeline lo emitían
            como «30 clases» — que con el conteo de al lado daba «30 CLASES · 30 CLASES».
            Se arregló en las dos puntas: acá el separador es condicional, y el pipeline
            dejó de emitir un volumen que repite lo que ya dice el conteo. */}
        <div className="al-seclabel"><span>El curso</span><span className="al-vol">
          {curso.clases.length} clases{curso.volumen ? ` · ${curso.volumen}` : ''}
        </span></div>
        {conModulos ? (
          <div className="al-modstack">
            {modulos.map((mod, i) => (
              // <details> nativo: plegable sin estado propio, y el navegador se
              // encarga del teclado y del foco. `open` en el primero para que el hub
              // no arranque como una lista de títulos cerrados.
              <details key={mod.grupo} className="al-modgroup" open={i === 0}>
                <summary className="al-modtitle">
                  <span className="al-modtitle-t">{mod.grupo}</span>
                  <span className="al-modtitle-n">{mod.total} clase{mod.total === 1 ? '' : 's'}</span>
                </summary>
                {/* Si el módulo NO tiene secciones (una sola, sin nombre), no se
                    inventa un segundo nivel: va la grilla directa. */}
                {mod.secciones.length === 1 && !mod.secciones[0].nombre ? (
                  <div className="al-grid">{mod.secciones[0].clases.map(claseCard)}</div>
                ) : (
                  mod.secciones.map((sec, j) => (
                    <details key={sec.nombre || j} className="al-subgroup" open={j === 0}>
                      <summary className="al-subtitle">
                        <span className="al-subtitle-t">{sec.nombre || 'Sin sección'}</span>
                        <span className="al-modtitle-n">{sec.clases.length}</span>
                      </summary>
                      <div className="al-grid">{sec.clases.map(claseCard)}</div>
                    </details>
                  ))
                )}
              </details>
            ))}
          </div>
        ) : (
          <div className="al-grid">{curso.clases.map(claseCard)}</div>
        )}
      </section>
      {curso.recursos.length > 0 && (
        // Plegable igual que los módulos. Arranca CERRADO cuando son muchos: 71
        // tarjetas de recursos empujan las clases fuera de la pantalla y el hub deja
        // de servir para lo que es. Con pocos, abierto — esconderlos sería peor.
        <details className="al-sec al-secfold" open={curso.recursos.length <= 12}>
          <summary className="al-seclabel al-seclabel-fold">
            <span>Recursos</span>
            <span className="al-vol">{curso.recursos.length} archivo{curso.recursos.length === 1 ? '' : 's'} y enlace{curso.recursos.length === 1 ? '' : 's'}</span>
          </summary>
          <div className="al-grid">
            {curso.recursos.map((r) => (
              <Card key={r.slug} badge={TIPO_BADGE[r.tipo]} nota={claseTag(r.clases)} titulo={r.label} desc={r.cardDesc}
                ariaLabel={`Abrir ${r.label}`} onClick={() => goRecurso(r.slug)} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}

// Transcripción diferida: puede ser enorme (+130k chars), así que NO viaja en el
// bundle. Se sirve estática en /cono-tx/<videoId>.json y se baja al abrir el
// <details>, una sola vez. Es un archivo público: funciona igual sin sesión.
// Íconos de línea, inline y sin dependencias: son dos, y una librería de íconos por
// dos glifos es peso que viaja en el bundle público de /compartido.
const IcoCopiar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IcoOk = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IcoBajar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// Nombre de archivo seguro en Windows y macOS, que es donde se van a guardar.
const archivoSeguro = (s: string) => String(s)
  .replace(/[<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'transcripcion';

/**
 * El MATERIAL de la clase tal como está en la plataforma de origen: el documento con
 * sus secciones, los bloques de prompt con su etiqueta y su botón de copiar, las
 * imágenes de referencia y los links a las herramientas.
 *
 * ── Por qué se carga aparte, y por qué es HTML ──────────────────────────────
 * Son ~350 KB entre las 27 lecciones: adentro de la ficha viajarían en el bundle de
 * TODA la grilla para leer una sola clase. Mismo motivo y mismo mecanismo que
 * `TranscriptLazy` — un json público en `/cono-doc/<slug>.json`.
 *
 * Y va como HTML porque la ESTRUCTURA es contenido: qué parte de un prompt es la
 * cámara y cuál el guion está en las clases del marcado (`.ugc-clip-part.camara`,
 * `.guion`, `.voz`…), y eso es la mitad de lo que el curso enseña. Aplanarlo a texto
 * lo perdería.
 *
 * ⚠️ El HTML se sanea al CAPTURARLO (`scripts/avatarhype-doc-portal.mjs`: fuera
 * `<script>`, `on*=` y `javascript:`), no acá: el saneo va donde el dato entra, una
 * sola vez, y no en cada render.
 */
function DocumentoLazy({ slug }: { slug: string }) {
  const [doc, setDoc] = useState<{ tituloDocumento?: string | null; paneles: Record<string, string> } | null>(null);
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'error'>('idle');
  const [tab, setTab] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const abrir = () => {
    if (doc || estado === 'cargando') return;
    // La hoja del origen (~75 KB) se carga acá y una sola vez para toda la app: sin
    // ella el documento se ve como texto plano —las etiquetas de color de cada parte
    // del prompt SON el contenido—, y en el bundle serían 75 KB para todo el que
    // entra a la grilla y no abre ningún material.
    if (!document.getElementById('ahdoc-css')) {
      const l = document.createElement('link');
      l.id = 'ahdoc-css';
      l.rel = 'stylesheet';
      l.href = '/cono-doc/ugc.css';
      document.head.appendChild(l);
    }
    setEstado('cargando');
    fetch(`/cono-doc/${slug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setDoc(d); setTab(Object.keys(d.paneles ?? {})[0] ?? null); setEstado('idle'); })
      .catch(() => setEstado('error'));
  };

  // El botón «copiar» de cada bloque es del origen y su JS no viaja: se reimplementa
  // por delegación. El texto sale del `.ugc-pre` del MISMO bloque —no del más cercano
  // en el documento—, porque una lección tiene hasta 14 botones y equivocarse de
  // bloque copia un prompt que no es el que se pidió, sin que se note.
  const alClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest('.ugc-copy');
    if (!btn) return;
    const bloque = btn.closest('.ugc-card') ?? btn.parentElement;
    const pre = bloque?.querySelector('.ugc-pre');
    const texto = (pre?.textContent ?? '').trim();
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(texto.slice(0, 24));
      setTimeout(() => setCopiado(null), 1600);
    });
  };

  return (
    <details className="al-secfold" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && abrir()}>
      <summary className="al-seclabel al-seclabel-fold">
        <span>Material de la clase</span>
        <span className="al-vol">{doc ? Object.keys(doc.paneles).join(' · ') : 'documento, prompts e imágenes'}</span>
      </summary>
      {estado === 'cargando' && <div className="al-nota">Cargando el material…</div>}
      {estado === 'error' && <div className="al-nota">No pude cargar el material de esta clase.</div>}
      {doc && (
        <div className="ahdoc">
          {Object.keys(doc.paneles).length > 1 && (
            <div className="ahdoc-tabs" role="tablist" aria-label="Material de la clase">
              {Object.keys(doc.paneles).map((n) => (
                <button key={n} type="button" role="tab" aria-selected={tab === n}
                  className={`ahdoc-tab${tab === n ? ' on' : ''}`} onClick={() => setTab(n)}>{n}</button>
              ))}
            </div>
          )}
          {copiado && <div className="ahdoc-copiado" role="status">Copiado: «{copiado}…»</div>}
          <div className="ahdoc-cuerpo" onClick={alClick}
            dangerouslySetInnerHTML={{ __html: (tab && doc.paneles[tab]) || '' }} />
        </div>
      )}
    </details>
  );
}

function TranscriptLazy({ videoId, titulo }: { videoId: string; titulo: string }) {
  const [paras, setParas] = useState<string[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [copiado, setCopiado] = useState(false);
  const load = () => {
    if (paras || state === 'loading') return;
    setState('loading');
    fetch(`/cono-tx/${videoId}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: string[]) => { setParas(d); setState('idle'); })
      .catch(() => setState('error'));
  };

  // El texto se arma UNA vez y lo usan copiar y descargar. Con el título arriba,
  // porque una transcripción suelta en la carpeta de descargas no dice de qué clase es.
  const texto = () => `${titulo}\n\n${(paras ?? []).join('\n\n')}\n`;

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto()); setCopiado(true); setTimeout(() => setCopiado(false), 1600); }
    catch { /* sin permiso de portapapeles: queda el texto a la vista para seleccionar */ }
  };
  const bajar = () => {
    const url = URL.createObjectURL(new Blob([texto()], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${archivoSeguro(titulo)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Sin esto el Blob queda en memoria toda la sesión; una transcripción larga son
    // cientos de KB y el portal se navega clase por clase.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <details className="al-det" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) load(); }}>
      <summary>
        <span className="al-det-t">Ver transcripción</span>
        {/* Las acciones viven EN la línea del rótulo, a la derecha. Aparecen solo con el
            texto ya cargado: un botón de copiar que copia una cadena vacía es peor que
            no tener botón.
            ⚠️ Van adentro del <summary>, así que cada click tiene que frenarse o abre y
            cierra el desplegable — `preventDefault` corta el toggle nativo y
            `stopPropagation` evita que el evento llegue al details. */}
        {paras && paras.length > 0 && (
          <span className="al-tx-acc">
            <button type="button" className="al-tx-btn" title={copiado ? 'Copiado' : 'Copiar la transcripción'}
              aria-label={copiado ? 'Copiado' : 'Copiar la transcripción'}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); copiar(); }}>
              {copiado ? <IcoOk /> : <IcoCopiar />}
            </button>
            <button type="button" className="al-tx-btn" title="Descargar la transcripción (.txt)"
              aria-label="Descargar la transcripción en .txt"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); bajar(); }}>
              <IcoBajar />
            </button>
          </span>
        )}
      </summary>
      <div className="al-transcript">
        {state === 'loading' && <p>Cargando transcripción…</p>}
        {state === 'error' && <p>No se pudo cargar la transcripción.</p>}
        {paras && paras.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </details>
  );
}

// ── Detalle de clase ─────────────────────────────────────────────────────────
export function ClaseDetail({ curso, c, goRecurso, goClase, back }: {
  curso: Curso; c: Clase; goRecurso: (slug: string) => void;
  /** Ir a otra clase. Opcional: el link compartido puede no querer navegación. */
  goClase?: (n: number) => void;
  back: () => void;
}) {
  const bySlug = useMemo(() => Object.fromEntries(curso.recursos.map((r) => [r.slug, r])), [curso]);
  // ⚠️ Anterior/siguiente salen de la POSICIÓN en el array, no de `n ± 1`. El `n` es
  // el número de la clase y puede no ser contiguo; el orden real del curso es el del
  // array, que ya viene ordenado por módulo y por orden dentro del módulo.
  const idx = curso.clases.findIndex((x) => x.n === c.n);
  const prev = idx > 0 ? curso.clases[idx - 1] : null;
  const next = idx >= 0 && idx < curso.clases.length - 1 ? curso.clases[idx + 1] : null;
  return (
    <div className="al-detail">
      <button type="button" className="al-back" onClick={back}>← Volver</button>
      <div className="al-detail-hd">
        <span className="al-rescard-badge">{badgeClase(c)}</span>
        <h1 className="al-h1 al-h1-sm">{c.titulo}</h1>
      </div>

      {/* El recuadro "Video no disponible" solo tiene sentido en una clase que SÍ
          es de video (tiene transcripción) y quedó sin el archivo. En un módulo
          escrito, ese hueco enorme es ruido. */}
      {c.videoId ? (
        <div className="al-video"><iframe src={DRIVE_PREVIEW(c.videoId)} title={`Clase ${c.n}`} allow="autoplay; encrypted-media" allowFullScreen loading="lazy" /></div>
      ) : c.hasTx || c.transcripcionNota ? (
        <div className="al-video al-video-x"><span>Video no disponible</span></div>
      ) : null}

      {/* Anterior / Siguiente, PEGADOS al video: es donde uno termina de mirar y decide
          seguir. Abajo de todo quedaban después del resumen, la transcripción y los
          recursos — o sea, invisibles en una clase larga.
          Si no hay anterior (o no hay siguiente) el botón NO se dibuja, ni siquiera
          deshabilitado: uno apagado ocupa lugar y hace dudar de si está roto. */}
      {goClase && (prev || next) && (
        <nav className="al-nav" aria-label="Navegación entre clases">
          {prev ? (
            <button type="button" className="al-nav-b al-nav-prev" onClick={() => goClase(prev.n)}>
              <span className="al-nav-l">← Anterior</span>
              <span className="al-nav-t">{prev.titulo}</span>
            </button>
          ) : <span />}
          {next && (
            <button type="button" className="al-nav-b al-nav-next" onClick={() => goClase(next.n)}>
              <span className="al-nav-l">Siguiente →</span>
              <span className="al-nav-t">{next.titulo}</span>
            </button>
          )}
        </nav>
      )}

      {c.resumen && (
        <div className="al-block">
          <span className="al-block-l">Resumen</span>
          <div className="al-docbox al-docbox-tall"><DocContent text={c.resumen} /></div>
        </div>
      )}

      {c.hasDoc && c.docSlug && <DocumentoLazy slug={c.docSlug} />}

      {c.hasTx && c.videoId ? (
        <TranscriptLazy videoId={c.videoId} titulo={c.titulo} />
      ) : c.transcripcionNota ? <div className="al-nota">{c.transcripcionNota}</div> : null}

      {c.recursoSlugs.length > 0 && (
        <div className="al-block">
          <span className="al-block-l">Recursos de esta clase</span>
          <div className="al-grid">
            {c.recursoSlugs.map((s) => bySlug[s] ? (
              <Card key={s} badge={TIPO_BADGE[bySlug[s].tipo]} titulo={bySlug[s].label} desc={bySlug[s].cardDesc}
                ariaLabel={`Abrir ${bySlug[s].label}`} onClick={() => goRecurso(s)} />
            ) : null)}
          </div>
        </div>
      )}
      {c.herramientas.length > 0 && (
        <div className="al-block">
          <span className="al-block-l">Herramientas</span>
          <div className="al-chips">
            {c.herramientas.map((h, i) => (
              <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" className="al-chip al-chip-tool">
                {h.nombre}{h.nota ? <span className="al-chip-note"> · {h.nota}</span> : null}
              </a>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// Agrupa los bloques en SECCIONES (una por head). Cada sección es una tarjeta:
// título + explicación ADENTRO, y debajo las filas (media | prompt). `x` = la
// explicación "qué hace", pegada a su head/label.
type Bloque = { t: string; v: string; x?: string };
type Row = { img?: string; vids?: string[]; items?: Bloque[] };
type Section = { head?: string; headX?: string; rows: Row[] };
function groupSections(bloques: Bloque[]): Section[] {
  const sections: Section[] = [];
  let sec: Section = { rows: [] };
  let cur: Row | null = null;
  const hasMedia = (r: Row | null) => !!(r && (r.img || (r.vids && r.vids.length)));
  const flushRow = () => { if (cur && (hasMedia(cur) || (cur.items && cur.items.length))) sec.rows.push(cur); cur = null; };
  const pushSec = () => { if (sec.head || sec.rows.length) sections.push(sec); };
  for (const b of bloques) {
    if (b.t === 'head') { flushRow(); pushSec(); sec = { head: b.v, headX: b.x, rows: [] }; continue; }
    if (b.t === 'img') {
      if (cur && cur.img) flushRow();
      if (!cur) cur = { items: [] };
      cur.img = b.v;
    } else if (b.t === 'vid') {
      if (!cur) cur = { items: [] };
      (cur.vids = cur.vids || []).push(b.v);
    } else {
      if (hasMedia(cur)) flushRow();
      if (!cur) cur = { items: [] };
      cur.items!.push(b);
    }
  }
  flushRow();
  pushSec();
  return sections;
}

// ── Detalle de recurso ───────────────────────────────────────────────────────
export function RecursoDetail({ r, back }: { r: Recurso; back: () => void }) {
  const sections = r.bloques ? groupSections(r.bloques) : null;
  const copyable = r.texto && (r.tipo === 'gpt' || (r.tipo === 'notion' && !sections));
  return (
    <div className="al-detail">
      <button type="button" className="al-back" onClick={back}>← Volver</button>
      <div className="al-detail-hd">
        <div className="al-detail-badges">
          <span className="al-rescard-badge">{TIPO_BADGE[r.tipo]}</span>
          {claseTag(r.clases) && <span className="al-rescard-nota">{claseTag(r.clases)}</span>}
        </div>
        <div className="al-detail-titlerow">
          <h1 className="al-h1 al-h1-sm">{r.label}</h1>
          {r.notionUrl && (
            <a href={r.notionUrl} target="_blank" rel="noopener noreferrer" className="al-notion al-notion-title">
              Ver en Notion <span className="al-arr">↗</span> <Ext />
            </a>
          )}
        </div>
      </div>

      {r.intro
        ? <div className="al-intro"><DocContent text={r.intro} /></div>
        : <p className="al-sub al-sub-sm">{r.cardDesc}</p>}

      {copyable && <div className="al-content-act al-content-act-top"><CopyBtn text={r.texto!} /></div>}

      {/* Notion con ejemplos → una TARJETA por sección (título + explicación + filas) */}
      {sections ? (
        <div className="al-cards">
          {sections.map((sec, i) => (
            <div key={i} className="al-card">
              {sec.head && (
                <div className="al-card-hd">
                  <h3 className="al-card-title">{sec.head}</h3>
                  {sec.headX && <div className="al-card-x"><DocContent text={sec.headX} /></div>}
                </div>
              )}
              <div className="al-card-body">
                {sec.rows.map((row, j) => {
                  const conMedia = row.img || (row.vids && row.vids.length);
                  return (
                    <div key={j} className={`al-row ${conMedia ? '' : 'al-row-textonly'}`}>
                      {conMedia && (
                        <div className="al-row-media">
                          {row.img && (
                            <a href={row.img} target="_blank" rel="noopener noreferrer" className="al-step-media">
                              {/* eslint-disable-next-line @next/next/no-img-element -- imagen del Notion público, URL externa */}
                              <img src={row.img} alt={`${r.label} — ejemplo`} loading="lazy" />
                              <Ext badge />
                            </a>
                          )}
                          {row.vids && row.vids.map((id, vi) => <VidPoster key={vi} id={id} label={r.label} />)}
                        </div>
                      )}
                      {row.items && row.items.length > 0 && (
                        <div className="al-row-text">
                          {row.items.map((b, k) => b.t === 'label'
                            ? <div key={k} className="al-blabel-wrap"><span className="al-blabel">{b.v}</span>{b.x && <div className="al-blabel-x"><DocContent text={b.x} /></div>}</div>
                            : <div key={k} className="al-bprompt"><CopyBtn text={b.v} /><pre className="al-bprompt-pre">{b.v}</pre></div>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Agente (gpt) o Notion sin ejemplos → contenido formateado */}
      {!sections && r.texto && (r.tipo === 'gpt' || r.tipo === 'notion') && (
        <div className="al-docbox"><DocContent text={r.texto} /></div>
      )}

      {/* Notion sin bloques pero con capturas → visor (capturas = PDF en TU Drive) */}
      {r.tipo === 'notion' && !sections && r.capturasDriveId && (
        <div className="al-block">
          <span className="al-block-l">Ejemplos visuales</span>
          <div className="al-pdf"><iframe src={DRIVE_PREVIEW(r.capturasDriveId)} title={`${r.label} — ejemplos`} loading="lazy" allowFullScreen /></div>
        </div>
      )}

      {r.tipo === 'pdf' && r.driveId && (
        <div className="al-block">
          <span className="al-block-l">Catálogo en PDF</span>
          <div className="al-pdf al-pdf-tall"><iframe src={DRIVE_PREVIEW(r.driveId)} title={r.label} loading="lazy" allowFullScreen /></div>
        </div>
      )}

      {/* Descargable que Drive no previsualiza (zip, rar…). Se dibuja como lo que
          es —un archivo para bajar— en vez de un iframe con «sin vista previa». */}
      {r.tipo === 'file' && r.driveId && (
        <div className="al-block">
          <span className="al-block-l">Archivo del curso</span>
          <a href={DRIVE_VIEW(r.driveId)} target="_blank" rel="noopener noreferrer" className="al-file">
            <span className="al-file-ext">{(r.ext ?? 'zip').toUpperCase()}</span>
            <span className="al-file-t">
              <span className="al-file-n">{r.label}</span>
              <span className="al-file-d">Se abre en Drive para descargar</span>
            </span>
            <span className="al-arr">↗</span>
          </a>
        </div>
      )}

      {r.tipo === 'bank' && r.items && (
        <div className="al-list">
          {r.items.map((it, i) => (
            <a key={i} href={it.url} target="_blank" rel="noopener noreferrer" className="al-list-item">
              <span>{it.label}</span><span className="al-list-r"><span className="al-arr">↗</span></span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shell: el papel, las fuentes y la barra de arriba ────────────────────────
/** Envoltorio visual del portal. `marca` es el bloque de la izquierda (en el
 *  admin es un botón que vuelve a los cursos; en un link compartido no navega a
 *  ningún lado porque no hay "ningún lado" al que ir). */
export function PortalShell({ marca, tag, children }: { marca: ReactNode; tag?: ReactNode; children: ReactNode }) {
  return (
    <div className="cono ahc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- fuentes propias del diseño, scopeadas a esta ruta */}
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div className="paper-bg">
        <div className="cono-wrap">
          <div className="al-top">
            {marca}
            {tag}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── El portal de un curso: elige qué vista mostrar ───────────────────────────
/** `de`: la clase desde la que se abrió un recurso. Es lo que hace que «Volver»
 *  devuelva a ESA clase y no al índice — ver el porqué abajo, en CursoPortal. */
export type Vista = { clase?: number | null; r?: string | null; de?: number | null };
/** `reemplazar`: pisa la vista actual en vez de apilarla. Lo usa Anterior/Siguiente,
 *  para que el historial no se llene de una entrada por clase leída. */
export type NavOpts = { reemplazar?: boolean };

export default function CursoPortal({ curso, vista, nav, salir, backLabel, compartir }: {
  curso: Curso;
  vista: Vista;
  nav: (v: Vista, o?: NavOpts) => void;
  /** Salir del curso: el nivel de arriba del hub. Opcional porque no siempre existe
   *  —en un share de UN curso no hay «todos los cursos»— y ahí el hub va sin Volver:
   *  un botón que no lleva a ningún lado es peor que no tenerlo. */
  salir?: () => void;
  /** Solo para el HUB: a dónde vuelve, cuando el destino no es obvio. */
  backLabel?: string;
  compartir?: ReactNode;
}) {
  const clase = vista.clase != null ? curso.clases.find((c) => c.n === vista.clase) : undefined;
  const recurso = vista.r ? curso.recursos.find((r) => r.slug === vista.r) : undefined;

  // ⚠️ UN CURSO PUEDE PEDIR SU PROPIA PANTALLA. Los 17 cursos del portal son «video +
  // transcripción» y la grilla les queda bien. El de Avatar Hype no lo es: su valor
  // está en el DOCUMENTO de cada lección —los prompts con sus partes etiquetadas, las
  // imágenes, los clips— y en cómo está organizado, con el video y el papel lado a
  // lado. Metido en la grilla, ese material queda detrás de dos clicks.
  // Por eso `replica`: la vista reproduce la pantalla del origen. Es un atributo del
  // CURSO y no un caso especial escrito acá — el día que haya un segundo curso así,
  // se marca y ya está.
  if (curso.replica) {
    return <CursoReplica curso={curso} onSalir={salir} />;
  }

  // ⚠️ NINGÚN «Volver» de este portal usa el Atrás del navegador. Los tres navegan
  // EXPLÍCITAMENTE al nivel de arriba, y no es purismo: cada intento de apoyarse en el
  // historial se rompió por un camino distinto. Primero Anterior/Siguiente apilaba una
  // entrada por clase (se arregló con `replace`, y el Volver de la clase SEGUÍA
  // devolviendo a la anterior); después, ya con la clase explícita, el rótulo del curso
  // de arriba —que apila un hub encima de la clase— hacía que el Volver del HUB
  // devolviera a la clase, que es exactamente lo que el usuario reportó.
  //
  // La regla que queda: **el destino de «Volver» es una propiedad de la PANTALLA, no
  // del camino que hiciste para llegar.** Desde una clase es el índice; desde el hub,
  // los cursos. El único que sí depende de dónde veniste es el RECURSO —se abre desde
  // el índice o desde una clase—, y por eso el origen viaja en la vista (`de`) en vez
  // de deducirse del historial: así sobrevive a un reload y a un link copiado.
  if (clase) {
    return (
      <ClaseDetail
        curso={curso} c={clase}
        goRecurso={(s) => nav({ r: s, de: clase.n })}
        goClase={(n) => nav({ clase: n }, { reemplazar: true })}
        back={() => nav({}, { reemplazar: true })}
      />
    );
  }
  if (recurso) {
    return <RecursoDetail r={recurso} back={() => nav(vista.de != null ? { clase: vista.de } : {}, { reemplazar: true })} />;
  }
  return <Hub curso={curso} goClase={(n) => nav({ clase: n })} goRecurso={(s) => nav({ r: s })} compartir={compartir} back={salir} backLabel={backLabel} />;
}

export const CSS = `
.cono.ahc {
  --paper:#F4F1E8; --paper-2:#EFEBDD; --card:#FCFBF6; --card-2:#F7F4EA;
  --ink:#16150F; --ink-80:rgba(22,21,15,.80); --ink-60:rgba(22,21,15,.56); --ink-40:rgba(22,21,15,.38); --ink-15:rgba(22,21,15,.13);
  --lime:#CDF13B; --lime-d:#b4d827; --lime-ink:#99b81f; --red:#c0392b; --grid:rgba(40,70,120,.07);
  --shadow-paste:0 1px 1px rgba(22,21,15,.08),0 10px 22px -8px rgba(22,21,15,.32);
  --shadow-stamp:2px 3px 0 rgba(22,21,15,.85);
  --mono:'Spline Sans Mono',ui-monospace,monospace; --disp:'Bricolage Grotesque',sans-serif;
  width:100%; color:var(--ink); font-family:'DM Sans',system-ui,sans-serif; -webkit-font-smoothing:antialiased;
}
.cono.ahc *{ box-sizing:border-box; }
.cono.ahc ::selection{ background:var(--lime); color:var(--ink); }
.cono.ahc a{ text-decoration:none; color:inherit; }
.cono.ahc button{ font:inherit; cursor:pointer; }

.cono .paper-bg{
  min-height:100vh;
  background:
    linear-gradient(var(--grid) 1px,transparent 1px) 0 0/100% 30px,
    linear-gradient(90deg,var(--grid) 1px,transparent 1px) 0 0/30px 100%,
    radial-gradient(130% 110% at 50% 38%, transparent 45%, rgba(22,21,15,.05)),
    var(--paper);
}
.cono-wrap{ max-width:1040px; margin:0 auto; padding:24px 28px 72px; }

/* Header */
.cono .al-top{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; padding-bottom:20px; border-bottom:1.5px solid var(--ink); }
.cono .al-brand-btn{ background:none; border:0; padding:0; text-align:left; }
.cono .al-brand{ display:flex; flex-direction:column; gap:3px; }
.cono .al-brand .b{ font-family:var(--disp); font-weight:800; font-size:22px; letter-spacing:-.04em; line-height:1; color:var(--ink); }
.cono .al-brand .b span{ color:var(--lime-ink); }
.cono .al-brand .sub{ font-family:var(--mono); font-size:9.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-40); }
.cono .al-toptag{ font-family:var(--mono); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-60); border:1.5px solid var(--ink); border-radius:999px; padding:6px 13px; background:var(--card); }
.cono .al-toptag-btn:hover{ box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); color:var(--ink); }

/* Hero */
.cono .al-hero{ padding:44px 0 12px; }
/* El botón de Compartir vive ARRIBA, en la fila del eyebrow — no perdido en el medio. */
.cono .al-hero-top{ display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:10px; }
.cono .al-eyebrow{ display:inline-flex; align-items:center; gap:9px; font-family:var(--mono); font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-60); }
.cono .al-eyebrow .d{ width:11px; height:11px; border-radius:50%; background:var(--lime); border:1.5px solid var(--ink); flex:none; }
.cono .al-h1{ font-family:var(--disp); font-weight:800; font-size:clamp(40px,7vw,72px); line-height:.98; letter-spacing:-.03em; color:var(--ink); margin:16px 0 0; }
.cono .al-h1-sm{ font-size:clamp(30px,5vw,44px); }
.cono .al-sub{ font-size:clamp(15px,2vw,18px); line-height:1.6; color:var(--ink-80); max-width:56ch; margin:16px 0 0; }
.cono .al-sub-sm{ font-size:15px; margin-top:6px; }

/* Buscador + desplegable de categoría, arriba de todas las secciones.
   Una sola FILA: el buscador crece y el filtro queda al final, pegado. En pantalla
   angosta envuelve y el filtro pasa a ocupar el ancho, en vez de espicharse hasta
   que su rótulo deje de leerse. */
.cono .al-filtros{ display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:26px; }
.cono .al-buscar{ flex:1 1 260px; display:flex; align-items:center; gap:9px; background:var(--card); border:1.5px solid var(--ink); border-radius:11px; padding:0 12px; box-shadow:var(--shadow-paste); }
.cono .al-buscar:focus-within{ box-shadow:var(--shadow-stamp); }
.cono .al-buscar-ico{ font-size:17px; color:var(--ink-40); line-height:1; }
.cono .al-buscar-in{ flex:1; min-width:0; border:0; outline:0; background:transparent; font-family:var(--disp); font-size:15.5px; color:var(--ink); padding:12px 0; }
.cono .al-buscar-in::placeholder{ color:var(--ink-40); }
/* El aspa nativa del type=search cambia de forma en cada navegador y no se puede
   estilar: se saca y se pone la propia, que además queda del mismo lado siempre. */
.cono .al-buscar-in::-webkit-search-cancel-button{ appearance:none; }
.cono .al-buscar-x{ border:0; background:transparent; cursor:pointer; font-size:19px; line-height:1; color:var(--ink-40); padding:4px; }
.cono .al-buscar-x:hover{ color:var(--ink); }

/* ⚠️ Acá vivían los chips del filtro y NUNCA se vieron como decían: más abajo
   (sección «Chips») hay OTRA regla .al-chip —la de las herramientas de un recurso—
   con la misma especificidad y posterior, así que ganaba ella y pisaba el radio, la
   tipografía y el borde de estos. Dos usos distintos con el mismo nombre de clase en
   la misma hoja: el segundo siempre gana y nada avisa. Ojo con los backticks en este
   bloque: todo el CSS es un template literal y un backtick lo corta al medio.
   Si hace falta un chip nuevo acá, que lleve nombre propio. */
.cono .al-linkbtn{ border:0; background:transparent; padding:0; cursor:pointer; font:inherit; color:var(--lime-ink); text-decoration:underline; }

/* Secciones */
.cono .al-sec{ margin-top:44px; }
.cono .al-seclabel{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; font-family:var(--mono); font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink); padding-bottom:12px; border-bottom:1.5px solid var(--ink-15); margin-bottom:18px; }
/* Sección plegable: el mismo rótulo, pero como <summary>. Hacen falten las DOS
   reglas del marcador nativo (::marker y list-style) o queda el triángulo del
   navegador al lado del chevron propio. */
.cono .al-secfold > summary{ list-style:none; cursor:pointer; }
.cono .al-secfold > summary::-webkit-details-marker{ display:none; }
.cono .al-secfold > summary::marker{ content:''; }
.cono .al-seclabel-fold::before{ content:'›'; display:inline-block; font-size:17px; line-height:1; color:var(--ink-40); transition:transform .15s ease; margin-right:2px; }
.cono .al-secfold[open] > .al-seclabel-fold::before{ transform:rotate(90deg); }
.cono .al-seclabel-fold:hover{ color:var(--ink); }
.cono .al-vol{ color:var(--ink-40); font-size:11px; }

/* Cursos con módulos: DOS niveles plegables (módulo → sección), con <details>.
   El marcador nativo se saca con ::marker y list-style para poder poner el chevron
   propio; sin las DOS reglas, Safari y Firefox siguen dibujando su triangulito. */
.cono .al-modstack{ display:flex; flex-direction:column; gap:18px; }
.cono .al-modgroup > summary::-webkit-details-marker{ display:none; }
.cono .al-modgroup > summary, .cono .al-subgroup > summary{ list-style:none; cursor:pointer; }
.cono .al-modgroup > summary::marker, .cono .al-subgroup > summary::marker{ content:''; }

.cono .al-modtitle{ display:flex; align-items:center; gap:10px; font-family:var(--disp); font-weight:800; font-size:17px; letter-spacing:-.01em; color:var(--ink); margin:0; padding:8px 0 8px 12px; border-left:4px solid var(--lime); line-height:1.2; }
.cono .al-modtitle:hover{ background:var(--ink-05, rgba(0,0,0,.035)); }
/* El chevron gira con el estado abierto: es la única pista de que esto se plega. */
.cono .al-modtitle::before{ content:'›'; display:inline-block; font-size:20px; line-height:1; color:var(--ink-40); transition:transform .15s ease; }
.cono .al-modgroup[open] > .al-modtitle::before{ transform:rotate(90deg); }
.cono .al-modtitle-t{ flex:1; }
.cono .al-modtitle-n{ font-family:var(--mono); font-size:10.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-40); white-space:nowrap; }
.cono .al-modgroup > .al-grid, .cono .al-modgroup > .al-subgroup{ margin-top:14px; }

.cono .al-subgroup{ margin-left:14px; border-left:1.5px solid var(--ink-15); padding-left:14px; }
.cono .al-subtitle{ display:flex; align-items:center; gap:9px; font-family:var(--disp); font-weight:700; font-size:14.5px; color:var(--ink-60); margin:0; padding:6px 0; line-height:1.25; }
.cono .al-subtitle:hover{ color:var(--ink); }
.cono .al-subtitle::before{ content:'›'; display:inline-block; font-size:16px; line-height:1; color:var(--ink-40); transition:transform .15s ease; }
.cono .al-subgroup[open] > .al-subtitle::before{ transform:rotate(90deg); }
.cono .al-subtitle-t{ flex:1; }
.cono .al-subgroup > .al-grid{ margin:10px 0 16px; }

/* Portada del curso: arriba de todo, antes del título. Alto acotado por el
   VIEWPORT y no por el ancho, o en un monitor grande se come la pantalla entera. */
/* Portada en formato BANNER: ancho completo y alto acotado, que es como la quiere el
   dueño. El recorte es inevitable con 9 de 11 tapas en 16:9, así que lo que importa
   es DESDE DÓNDE se recorta.
   ⚠️ Antes recortaba desde el centro y le comía la cara al creador. En una tapa de
   curso la persona está arriba —o arriba a la derecha— y lo prescindible son los
   íconos y el logo del pie, así que el ancla va en 28%: conserva el rostro completo
   y sacrifica la franja de abajo, que es la que sobra.
   No se usa el valor "top" a secas porque muchas tapas tienen un badge o un margen
   superior que quedaría pegado al borde. */
.cono .al-portada{ margin:0 0 22px; border:1.5px solid var(--ink); border-radius:14px; overflow:hidden; box-shadow:var(--shadow-paste); background:var(--card); }
.cono .al-portada img{ display:block; width:100%; max-height:clamp(160px, 34svh, 340px); object-fit:cover; object-position:center 28%; }

/* Grilla de tarjetas */
.cono .al-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); gap:14px; }
.cono .al-rescard{ display:flex; flex-direction:column; align-items:flex-start; gap:9px; text-align:left; background:var(--card); border:1.5px solid var(--ink); border-radius:12px; padding:18px; box-shadow:var(--shadow-paste); transition:transform .14s ease, box-shadow .14s ease; }
.cono .al-rescard:hover{ transform:translate(-2px,-3px); box-shadow:var(--shadow-stamp); }
.cono .al-rescard-top{ display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; }
.cono .al-rescard-badge{ font-family:var(--mono); font-size:10px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--ink); background:var(--lime); border:1.5px solid var(--ink); border-radius:6px; padding:3px 8px; }
.cono .al-rescard-nota{ font-family:var(--mono); font-size:9.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-60); border:1.5px solid var(--ink-15); border-radius:6px; padding:3px 8px; white-space:nowrap; }
.cono .al-rescard-title{ font-family:var(--disp); font-weight:800; font-size:20px; letter-spacing:-.02em; color:var(--ink); line-height:1.1; }
.cono .al-rescard-desc{ font-size:14px; line-height:1.5; color:var(--ink-60); }
/* Tarjeta con miniatura: la imagen va al ras del borde, así que el padding se mueve
   del botón a los hijos — con padding en el botón queda un marco blanco alrededor. */
.cono .al-rescard-img{ padding:0; overflow:hidden; }
.cono .al-rescard-img > .al-rescard-top{ padding:14px 18px 0; }
.cono .al-rescard-img > .al-rescard-title, .cono .al-rescard-img > .al-rescard-desc{ padding:0 18px; }
.cono .al-rescard-img > .al-rescard-go{ padding:0 18px 16px; }
.cono .al-rescard-thumb{ display:block; width:100%; border-bottom:1.5px solid var(--ink); background:var(--ink-05, rgba(0,0,0,.04)); }
/* La miniatura LLENA la tarjeta. Para las 9 tapas de 16:9 no hay recorte —la caja ya
   es 16:9—; a las 2 cuadradas (AvatarHype, MasteryHaus) las recorta arriba y abajo,
   que es lo correcto: son logos centrados, y con contain quedaban flotando en el
   medio con dos franjas vacías a los lados. El dueño pidió expresamente que ocupen
   el ancho completo.
   Va sin object-position a propósito: el centro es lo que conserva un logo, y en las
   16:9 no cambia nada porque no hay nada que recortar. */
.cono .al-rescard-thumb img{ display:block; width:100%; aspect-ratio:16/9; object-fit:cover; }
.cono .al-rescard-go{ font-family:var(--mono); font-size:12px; font-weight:600; letter-spacing:.04em; color:var(--lime-ink); display:inline-flex; align-items:center; gap:6px; margin-top:4px; }
.cono .al-rescard:hover .al-arr{ transform:translateX(3px); }
.cono .al-arr{ transition:transform .14s ease; }

/* Detalle */
.cono .al-detail{ padding-top:8px; }
.cono .al-back{ font-family:var(--mono); font-size:12px; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-60); background:var(--card); border:1.5px solid var(--ink); border-radius:8px; padding:8px 14px; margin:14px 0 22px; transition:.14s; }
.cono .al-back:hover{ box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); color:var(--ink); }
.cono .al-detail-hd{ display:flex; flex-direction:column; align-items:flex-start; gap:12px; margin-bottom:6px; }
.cono .al-detail-badges{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.cono .al-content-act{ display:flex; align-items:center; gap:8px; }
.cono .al-content-act-top{ margin-top:16px; }

.cono .al-video{ position:relative; aspect-ratio:16/9; border-radius:12px; overflow:hidden; background:#000; border:1.5px solid var(--ink); box-shadow:var(--shadow-paste); margin-top:16px; }
.cono .al-video iframe{ position:absolute; inset:0; width:100%; height:100%; border:0; }
.cono .al-video-x{ display:flex; align-items:center; justify-content:center; background:var(--card-2); color:var(--ink-40); font-family:var(--mono); font-size:13px; }

.cono .al-block{ margin-top:24px; }
.cono .al-block-l{ display:block; font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-40); margin-bottom:11px; }

.cono .al-det{ margin-top:22px; border:1.5px solid var(--ink); border-radius:12px; overflow:hidden; background:var(--card); }
.cono .al-det>summary{ cursor:pointer; list-style:none; padding:14px 18px; font-family:var(--mono); font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink); display:flex; align-items:center; gap:9px; }
.cono .al-det>summary::-webkit-details-marker{ display:none; }
.cono .al-det>summary::before{ content:'+'; font-size:16px; color:var(--lime-ink); }
.cono .al-det[open]>summary::before{ content:'−'; }
.cono .al-det[open]>summary{ border-bottom:1.5px solid var(--ink-15); }
.cono .al-transcript{ padding:8px 18px 18px; max-height:440px; overflow-y:auto; }
.cono .al-transcript p{ margin:12px 0 0; font-size:14.5px; line-height:1.7; color:var(--ink-80); }

.cono .al-nota{ margin-top:20px; font-family:var(--mono); font-size:12px; line-height:1.5; color:var(--red); background:rgba(192,57,43,.07); border:1.5px solid rgba(192,57,43,.3); border-radius:10px; padding:12px 14px; }

/* Chips */
.cono .al-chips{ display:flex; flex-wrap:wrap; gap:8px; }
.cono .al-chip{ display:inline-flex; align-items:center; gap:8px; font-size:13.5px; color:var(--ink); background:var(--card); border:1.5px solid var(--ink); border-radius:9px; padding:8px 13px; transition:.14s; }
.cono .al-chip:hover{ box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); }
.cono .al-chip-tool{ font-family:var(--mono); font-size:12.5px; }
.cono .al-chip-note{ color:var(--ink-40); }

/* Contenido formateado (agentes / notion sin ejemplos) */
.cono .al-notion{ font-family:var(--mono); font-size:11.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--ink); background:var(--card); border:1.5px solid var(--ink); border-radius:8px; padding:7px 12px; display:inline-flex; align-items:center; gap:6px; }
.cono .al-notion:hover{ box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); }
.cono .al-notion .al-arr{ color:var(--lime-ink); }
.cono .al-copy{ font-family:var(--mono); font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--ink); background:var(--lime); border:1.5px solid var(--ink); border-radius:8px; padding:8px 14px; font-weight:600; flex:none; transition:.14s; }
.cono .al-copy:hover{ box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); }

.cono .al-docbox{ margin-top:16px; border:1.5px solid var(--ink); border-radius:12px; box-shadow:var(--shadow-paste); padding:16px 20px 20px; max-height:560px; overflow-y:auto; background:var(--card-2); }
.cono .al-docbox-tall{ max-height:none; background:var(--card); }
.cono .al-doc-h4{ font-family:var(--disp); font-weight:800; font-size:15.5px; letter-spacing:-.01em; color:var(--ink); margin:18px 0 8px; }
.cono .al-doc-h4:first-child{ margin-top:2px; }
.cono .al-doc-h5{ font-family:var(--mono); font-size:11.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--lime-ink); margin:16px 0 6px; }
.cono .al-doc-p{ margin:8px 0 0; font-size:14.5px; line-height:1.66; color:var(--ink-80); white-space:pre-line; word-break:break-word; }
.cono .al-doc-ul{ margin:8px 0 0; padding:0; list-style:none; display:flex; flex-direction:column; gap:6px; }
.cono .al-doc-ul li{ position:relative; padding-left:18px; font-size:14.5px; line-height:1.55; color:var(--ink-80); }
.cono .al-doc-ul li::before{ content:'·'; position:absolute; left:5px; top:-1px; color:var(--lime-ink); font-weight:800; font-size:18px; }

/* Intro self-contained del recurso (qué es, para qué, cómo se usa) */
.cono .al-intro{ margin:16px 0 6px; padding:16px 18px; border:1.5px solid var(--ink-15); border-left:4px solid var(--lime); border-radius:12px; background:var(--card); }
.cono .al-intro .al-doc-p{ margin-top:10px; font-size:15.5px; line-height:1.62; color:var(--ink); }
.cono .al-intro .al-doc-p:first-child{ margin-top:0; }

/* Tarjeta por SECCIÓN: título + explicación adentro, filas media|prompt debajo */
.cono .al-cards{ margin-top:20px; display:flex; flex-direction:column; gap:16px; }
.cono .al-card{ border:1.5px solid var(--ink); border-radius:14px; background:var(--card); box-shadow:var(--shadow-paste); overflow:hidden; }
.cono .al-card-hd{ padding:15px 18px; border-bottom:1.5px solid var(--ink-15); background:var(--card-2); }
.cono .al-card-title{ font-family:var(--disp); font-weight:800; font-size:18px; letter-spacing:-.01em; text-transform:uppercase; color:var(--ink); margin:0; line-height:1.15; }
.cono .al-card-x{ margin-top:8px; }
.cono .al-card-x .al-doc-p{ margin-top:7px; font-size:14.5px; line-height:1.58; color:var(--ink-80); }
.cono .al-card-x .al-doc-p:first-child{ margin-top:0; }
.cono .al-card-x .al-doc-ul{ margin-top:7px; }
.cono .al-card-body{ padding:16px 18px; display:flex; flex-direction:column; gap:0; }
.cono .al-row{ display:grid; grid-template-columns:minmax(0,210px) 1fr; gap:18px; align-items:start; padding:16px 0; }
.cono .al-row:first-child{ padding-top:0; }
.cono .al-row:last-child{ padding-bottom:0; }
.cono .al-row + .al-row{ border-top:1.5px dashed var(--ink-15); }
.cono .al-row-textonly{ grid-template-columns:1fr; }
.cono .al-row-media{ display:flex; flex-direction:column; gap:12px; }
.cono .al-row-text{ display:flex; flex-direction:column; align-items:flex-start; gap:12px; min-width:0; }
.cono .al-step-media{ position:relative; display:block; border:1.5px solid var(--ink); border-radius:12px; overflow:hidden; background:var(--card-2); transition:transform .14s ease, box-shadow .14s ease; }
.cono .al-step-media:hover{ box-shadow:var(--shadow-stamp); transform:translate(-2px,-2px); }
.cono .al-step-media img{ display:block; width:100%; height:auto; }

/* Póster de video vertical (abre el clip de ejemplo en Drive) */
.cono .al-vid{ position:relative; display:block; aspect-ratio:9/16; border:1.5px solid var(--ink); border-radius:12px; overflow:hidden; background:#0d0d0d; box-shadow:var(--shadow-paste); transition:transform .14s ease, box-shadow .14s ease; }
.cono .al-vid:hover{ box-shadow:var(--shadow-stamp); transform:translate(-2px,-2px); }
.cono .al-vid-img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.cono .al-vid-play{ position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:44px; height:44px; display:flex; align-items:center; justify-content:center; padding-left:3px; border-radius:50%; background:rgba(205,241,59,.94); border:2px solid var(--ink); color:var(--ink); font-size:15px; }
.cono .al-vid-tag{ position:absolute; left:8px; bottom:8px; font-family:var(--mono); font-size:9.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:#fff; background:rgba(0,0,0,.6); border-radius:6px; padding:3px 8px; }

/* Etiqueta del prompt + su explicación (qué hace) */
.cono .al-blabel-wrap{ display:flex; flex-direction:column; align-items:flex-start; gap:7px; width:100%; }
.cono .al-blabel{ font-family:var(--mono); font-size:10.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--ink); background:var(--lime); border:1.5px solid var(--ink); border-radius:6px; padding:3px 9px; }
.cono .al-blabel-x{ width:100%; }
.cono .al-blabel-x .al-doc-p{ margin:0; font-size:14px; line-height:1.5; color:var(--ink-80); }
.cono .al-bprompt{ position:relative; width:100%; background:var(--card-2); border:1.5px solid var(--ink); border-radius:10px; box-shadow:var(--shadow-paste); }
.cono .al-bprompt .al-copy{ position:absolute; top:9px; right:9px; z-index:2; padding:5px 10px; font-size:11px; }
.cono .al-bprompt-pre{ margin:0; padding:14px 16px 14px; padding-top:34px; max-height:260px; overflow:auto; font-family:var(--mono); font-size:12.5px; line-height:1.55; color:var(--ink-80); white-space:pre-wrap; word-break:break-word; }

/* Marca de dato EXTERNO (fuera de nuestro dominio) */
.cono .al-ext{ display:inline-flex; align-items:center; gap:3px; font-family:var(--mono); font-size:9px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#8a5a00; background:#ffe9a8; border:1.5px solid #d9a400; border-radius:6px; padding:2px 6px; white-space:nowrap; vertical-align:middle; cursor:help; }
.cono .al-ext-badge{ position:absolute; top:8px; right:8px; z-index:3; padding:3px 7px; font-size:11px; box-shadow:0 2px 6px rgba(0,0,0,.35); }

/* Título del detalle + link a Notion al final */
.cono .al-detail-titlerow{ display:flex; align-items:baseline; justify-content:space-between; gap:16px; flex-wrap:wrap; width:100%; }
.cono .al-notion-title{ align-self:center; flex:none; }

/* Visor de PDF */
.cono .al-pdf{ aspect-ratio:4/3; border:1.5px solid var(--ink); border-radius:12px; overflow:hidden; background:var(--card-2); box-shadow:var(--shadow-paste); }
.cono .al-pdf-tall{ margin-top:18px; aspect-ratio:3/4; }
.cono .al-pdf iframe{ width:100%; height:100%; border:0; display:block; }

/* Listas (bancos) */
.cono .al-list{ display:flex; flex-direction:column; gap:9px; margin-top:18px; }
.cono .al-list-item{ display:flex; align-items:center; justify-content:space-between; font-size:15px; color:var(--ink); background:var(--card); border:1.5px solid var(--ink); border-radius:10px; padding:14px 16px; box-shadow:var(--shadow-paste); transition:.14s; }
.cono .al-list-item:hover{ box-shadow:var(--shadow-stamp); transform:translate(-2px,-2px); }
.cono .al-list-r{ display:inline-flex; align-items:center; gap:9px; flex:none; }
.cono .al-list-item .al-arr{ color:var(--lime-ink); }

/* Descargable sin vista previa (zip, rar…) */
.cono .al-file{ display:flex; align-items:center; gap:14px; margin-top:12px; color:var(--ink); background:var(--card); border:1.5px solid var(--ink); border-radius:10px; padding:14px 16px; box-shadow:var(--shadow-paste); transition:.14s; }
.cono .al-file:hover{ box-shadow:var(--shadow-stamp); transform:translate(-2px,-2px); }
.cono .al-file-ext{ flex:none; font-family:var(--mono); font-size:11px; font-weight:700; letter-spacing:.08em; color:var(--lime-ink); background:var(--lime); border:1.5px solid var(--ink); border-radius:7px; padding:7px 9px; }
.cono .al-file-t{ display:flex; flex-direction:column; gap:2px; min-width:0; flex:1; }
/* El nombre puede ser larguísimo (viene del archivo original) y no se corta: se
   deja envolver. Un ellipsis acá esconde justo la parte que distingue un
   descargable de otro. */
.cono .al-file-n{ font-size:15px; font-weight:600; line-height:1.35; overflow-wrap:anywhere; }
.cono .al-file-d{ font-family:var(--mono); font-size:11px; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-40); }
.cono .al-file .al-arr{ flex:none; color:var(--lime-ink); }

/* Copiar y descargar: SOLO el ícono, en la misma línea del rótulo y a la derecha.
   El rótulo empuja y las acciones quedan pegadas al borde. */
.cono .al-det summary{ display:flex; align-items:center; gap:10px; }
.cono .al-det-t{ flex:1; min-width:0; }
.cono .al-tx-acc{ display:inline-flex; align-items:center; gap:6px; flex:none; }
.cono .al-tx-btn{ display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; color:var(--ink); background:var(--card); border:1.5px solid var(--ink); border-radius:8px; padding:0; cursor:pointer; transition:.14s; }
.cono .al-tx-btn:hover{ background:var(--lime); box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); }
.cono .al-tx-btn svg{ flex:none; }

/* Anterior / Siguiente entre clases, PEGADOS al video (no al pie de la página).
   En lima, como el badge de la clase: es navegación del curso, no una acción suelta. */
.cono .al-nav{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:18px 0 24px; }
.cono .al-nav-b{ display:flex; flex-direction:column; gap:2px; text-align:left; color:var(--ink); background:var(--lime); border:1.5px solid var(--ink); border-radius:9px; padding:8px 12px; cursor:pointer; box-shadow:var(--shadow-paste); transition:.14s; min-width:0; }
.cono .al-nav-b:hover{ background:var(--lime-d); box-shadow:var(--shadow-stamp); transform:translate(-2px,-2px); }
/* Con una sola salida se alinea a SU lado: «Siguiente» a la derecha aunque no haya
   «Anterior», que es donde el ojo lo busca. */
.cono .al-nav-next{ text-align:right; grid-column:2; }
.cono .al-nav-l{ font-family:var(--mono); font-size:9.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-80); }
/* UNA línea y corta con puntos suspensivos: el botón es una salida, no una tarjeta.
   Con dos líneas, un título largo duplicaba el alto de la fila entera. */
.cono .al-nav-t{ font-size:13px; font-weight:600; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
@media (max-width:560px){
  .cono .al-nav{ grid-template-columns:1fr; }
  .cono .al-nav-next{ grid-column:1; text-align:left; }
}

/* Pie del material compartido (solo en /compartido) */
.cono .al-shared-ft{ margin-top:56px; padding-top:18px; border-top:1.5px solid var(--ink-15); font-family:var(--mono); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-40); text-align:center; }

@media (max-width:680px){
  .cono-wrap{ padding:18px 16px 56px; }
  .cono .al-grid{ grid-template-columns:1fr; }
  .cono .al-row{ grid-template-columns:1fr; }
  .cono .al-row-media{ max-width:320px; }
  .cono .al-step-media, .cono .al-vid{ max-width:320px; }
  .cono .al-detail-titlerow{ gap:8px; }
  .cono .al-brand .b{ font-size:19px; }
  .cono .al-toptag{ font-size:10px; padding:5px 10px; }
}
`;
