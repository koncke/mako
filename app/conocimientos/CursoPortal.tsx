'use client';

// =============================================================================
// CursoPortal — el SELECTOR de cursos y el SHELL del portal (el papel, la barra de arriba)
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
//
// ⚠️ DESDE EL 08/10/2026 ACÁ QUEDAN SÓLO EL SELECTOR Y EL SHELL. El portal de un curso (hub, clase,
// recurso) se fue: el catálogo marcaba `replica: true` en TODOS los cursos, así que este archivo cortaba
// en CursoReplica antes de llegar al hub, y el Hub, ClaseDetail y RecursoDetail eran código muerto
// (lo que se les agregaba no se veía en ninguna parte). El curso lo dibuja ./CursoConocimientos.tsx,
// con el dibujo de los cursos (app/_cursos/CursoUgc.tsx). La hoja `CSS` de abajo todavía trae reglas
// de esas vistas (`.al-hub`, `.al-det`, `.al-doc`…): no rompen nada y se podan en una pasada aparte.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Curso, Recurso } from './curso';
// El desplegable de la casa, y no uno propio: ya resuelve portal (para que no lo
// recorte ningún overflow), click afuera, Escape, cierre al scrollear y foco. Sus
// tokens viven en `:root` de globals.css, que carga el layout raíz — o sea que
// también funciona en /compartido/<token>, que va sin login.
import { Dropdown } from '../components/Dropdown';
import { Miniatura } from './Miniatura';

export const TIPO_BADGE: Record<Recurso['tipo'], string> = { gpt: 'Agente', notion: 'Prompts', pdf: 'Catálogo', bank: 'Recursos', file: 'Descarga' };

// `img` es opcional a propósito: la tarjeta de un curso con portada la muestra, y la
// de una clase o un recurso sigue siendo la misma tarjeta sin imagen. Un componente
// por caso los haría divergir en tres números, que es lo que ya pasó con `.mk-fila`.
export function Card({ badge, nota, titulo, desc, resumen, onClick, ariaLabel, img, fondo }: {
  badge: string; nota?: string; titulo: string; desc: string; resumen?: string; onClick: () => void; ariaLabel: string; img?: string;
  /**
   * Una tapa que NO es foto: el degradado que el super admin le eligió al curso (lib/conocimiento-ajustes.ts),
   * como `background` CSS. Va en el mismo marco que la foto; con las dos, gana la foto.
   */
  fondo?: string;
}) {
  // Si la miniatura da 404, la tarjeta vuelve a la variante SIN imagen — no se queda con
  // el marco vacío. Por eso el estado vive acá y no adentro de `Miniatura`: el que decide
  // el `className` es este componente.
  const [sinImg, setSinImg] = useState(false);
  const conImg = !!img && !sinImg;
  const conFondo = !conImg && !!fondo;
  return (
    <button type="button" className={conImg || conFondo ? 'al-rescard al-rescard-img' : 'al-rescard'} onClick={onClick} aria-label={ariaLabel}>
      {conImg && (
        <span className="al-rescard-thumb">
          <Miniatura src={img!} onFalta={() => setSinImg(true)} />
        </span>
      )}
      {conFondo && (
        <span className="al-rescard-thumb" aria-hidden>
          <span className="al-rescard-fondo" style={{ background: fondo }} />
        </span>
      )}
      <span className="al-rescard-top">
        <span className="al-rescard-badge">{badge}</span>
        {nota && <span className="al-rescard-nota">{nota}</span>}
      </span>
      <span className="al-rescard-title">{titulo}</span>
      {/* DE QUÉ VA antes de CUÁNTO HAY: parado frente a la grilla, «33 clases en 2
          módulos» no ayuda a elegir hasta después de saber de qué se trata. Y las dos
          van arriba del «Abrir», que es el orden en que se decide entrar. */}
      {resumen && <span className="al-rescard-resumen">{resumen}</span>}
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
export function Selector({ cursos, enter, compartir, compartirDe, sinMarca, foco }: {
  /** Con lo que el super admin les cambió aplicado (`ajustarFicha`): el título, el resumen y la tapa. */
  cursos: Array<Curso & { fondo?: string }>;
  enter: (slug: string) => void;
  compartir?: ReactNode;
  /**
   * El botón de compartir de UN curso, desde la grilla.
   *
   * Es una función y no un nodo porque hay uno por tarjeta. Y viene inyectada —como
   * `compartir`— por la misma razón: la vista pública no lo pasa, así que no se
   * re-comparte lo que te compartieron y ese código no llega al invitado.
   *
   * ⚠️ El control es HERMANO de la tarjeta, nunca un hijo: `Card` ES un `<button>` y
   * un botón adentro de otro no es HTML válido — el navegador reparenta y el de
   * adentro deja de recibir clicks.
   */
  compartirDe?: (c: Curso & { fondo?: string }) => ReactNode;
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
    // El resumen entra al pajar: es donde viven las herramientas y los temas que el título
    // no nombra («ManyChat», «ETFs», «embudos»), o sea justo lo que alguien tipea.
    const heno = norm(`${c.titulo} ${c.cardDesc} ${c.categoria} ${c.subtitulo} ${c.resumen ?? ''}`);
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
    const m: Record<string, Array<Curso & { fondo?: string }>> = {};
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
        <p className="al-sub">Formación interna. Elige un curso para entrar. Cada categoría junta los cursos del mismo tema.</p>
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
            {list.map((c) => {
              const tarjeta = (
                <Card key={c.slug} badge="Curso" titulo={c.titulo} desc={c.cardDesc} resumen={c.resumen} img={c.portada} fondo={c.fondo}
                  ariaLabel={`Entrar a ${c.titulo}`} onClick={() => enter(c.slug)} />
              );
              // Sin `compartirDe` la tarjeta va PELADA, sin el envoltorio: la vista
              // pública no tiene nada que apoyar encima y una caja vacía de más cambia
              // el layout de la grilla sin que nadie la haya pedido.
              if (!compartirDe) return tarjeta;
              return (
                <div className="al-rescard-wrap" key={c.slug}>
                  {tarjeta}
                  <span className="al-cardshare">{compartirDe(c)}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
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
/* El resumen: de qué va el curso, arriba del «Abrir». Se recorta a 3 líneas — las
   descripciones de la plataforma van de 80 a 400 caracteres, así que sin tope una
   tarjeta mide el triple que la de al lado y la grilla queda dentada. */
.cono .al-rescard-resumen{ font-size:14px; line-height:1.5; color:var(--ink-80); display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; line-clamp:3; overflow:hidden; }
/* Con las dos al mismo peso la tarjeta tiene dos párrafos y ninguno manda, así que el
   volumen («33 clases en 2 módulos») baja a dato al lado de la prosa. El selector es de
   HERMANO a propósito: al-rescard-desc es también la línea de una clase («19:15 · 1.
   $100M Money Models») y la de un recurso, que no tienen resumen — bajarla en todas
   cambiaría tres tarjetas para arreglar una.
   ⚠️ Y NADA de backticks en un comentario de acá: esta hoja entera es un template
   literal, así que uno solo la cierra a la mitad. El síntoma no es un error de CSS —
   es la mitad del portal sin renderizar y un typecheck quejándose de una propiedad
   que no existe en un string. */
.cono .al-rescard-resumen + .al-rescard-desc{ font-family:var(--mono); font-size:11.5px; letter-spacing:.02em; color:var(--ink-60); }
/* Tarjeta con miniatura: la imagen va al ras del borde, así que el padding se mueve
   del botón a los hijos — con padding en el botón queda un marco blanco alrededor. */
.cono .al-rescard-img{ padding:0; overflow:hidden; }
.cono .al-rescard-img > .al-rescard-top{ padding:14px 18px 0; }
.cono .al-rescard-img > .al-rescard-title, .cono .al-rescard-img > .al-rescard-desc, .cono .al-rescard-img > .al-rescard-resumen{ padding:0 18px; }
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
.cono .al-rescard-fondo{ display:block; width:100%; aspect-ratio:16/9; }
.cono .al-rescard-go{ font-family:var(--mono); font-size:12px; font-weight:600; letter-spacing:.04em; color:var(--lime-ink); display:inline-flex; align-items:center; gap:6px; margin-top:4px; }
.cono .al-rescard:hover .al-arr{ transform:translateX(3px); }

/* Compartir UN curso desde la grilla.
   La tarjeta ES un button, así que el control va HERMANO y apoyado encima con un
   envoltorio relativo. La esquina es abajo a la derecha, la única libre en las dos
   variantes de tarjeta: arriba vive el badge, arriba a la derecha la miniatura llega
   al ras del borde, y abajo a la izquierda está el Abrir.
   ⚠️ El lift de hover lo dispara el ENVOLTORIO y no la tarjeta. Con el :hover de la
   tarjeta, pasar el cursor por el botón no la levanta —el puntero está sobre un
   hermano— y el botón se despegaría de la tarjeta a mitad del gesto. Los dos valores
   son los mismos que al-rescard:hover ya usa: esto no cambia el movimiento, cambia
   QUIÉN lo escucha. */
.cono .al-rescard-wrap{ position:relative; display:flex; }
.cono .al-rescard-wrap > .al-rescard{ flex:1; min-width:0; }
.cono .al-rescard-wrap:hover > .al-rescard{ transform:translate(-2px,-3px); box-shadow:var(--shadow-stamp); }
.cono .al-rescard-wrap:hover .al-arr{ transform:translateX(3px); }
.cono .al-cardshare{ position:absolute; right:14px; bottom:13px; z-index:2; transition:transform .14s ease; }
.cono .al-rescard-wrap:hover > .al-cardshare{ transform:translate(-2px,-3px); }
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
