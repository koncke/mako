'use client';

// =============================================================================
// /conocimientos — Portal de formación interna (admin). RAG-source de MaKo.
// =============================================================================
// Hub MULTI-CURSO con estética "área de alumnos" de AvatarHype (scope .ahc,
// papel + lima). Navegación por URL (?curso=…&clase=N / ?r=slug) para que el
// botón Atrás funcione y volver desde un recurso te devuelva a donde viniste.
// Sin tapar el sidebar de admin. Contenido en ./curso (CURSOS).
//
// Vistas: selector de cursos → hub del curso → detalle de clase / de recurso.
// El detalle de un recurso Notion se muestra INTERCALADO y lado a lado (imagen
// de referencia | su etiqueta + prompt) para que se entienda fácil.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CURSOS, type Curso, type Clase, type Recurso } from './curso';
import { CURSO_VSL } from './curso-vsl';

// curso.ts es AUTO-GENERADO desde transcripciones: los módulos escritos a mano
// viven en su propio archivo y se suman acá.
const TODOS: Curso[] = [...CURSOS, CURSO_VSL];

const DRIVE_PREVIEW = (id: string) => `https://drive.google.com/file/d/${id}/preview`;
const DRIVE_VIEW = (id: string) => `https://drive.google.com/file/d/${id}/view`;
const DRIVE_THUMB = (id: string) => `https://drive.google.com/thumbnail?id=${id}&sz=w480`;
const nn = (n: number) => String(n).padStart(2, '0');
const TIPO_BADGE: Record<Recurso['tipo'], string> = { gpt: 'Agente', notion: 'Prompts', pdf: 'Catálogo', bank: 'Recursos' };
const claseTag = (clases?: number[]) => !clases || !clases.length ? undefined : (clases.length === 1 ? `Clase ${clases[0]}` : `Clases ${clases.join('·')}`);

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

function CopyBtn({ text }: { text: string }) {
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
function DocContent({ text }: { text: string }) {
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

function Card({ badge, nota, titulo, desc, onClick, ariaLabel }: { badge: string; nota?: string; titulo: string; desc: string; onClick: () => void; ariaLabel: string }) {
  return (
    <button type="button" className="al-rescard" onClick={onClick} aria-label={ariaLabel}>
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

// ── Selector de cursos (landing) ─────────────────────────────────────────────
function Selector({ enter }: { enter: (slug: string) => void }) {
  const cats = useMemo(() => {
    const m: Record<string, Curso[]> = {};
    for (const c of TODOS) (m[c.categoria] = m[c.categoria] || []).push(c);
    return m;
  }, []);
  return (
    <>
      <section className="al-hero">
        <span className="al-eyebrow"><span className="d" /> Conocimientos · MaKo</span>
        <h1 className="al-h1">Cursos</h1>
        <p className="al-sub">Formación interna. Elegí un curso para entrar. Cada categoría junta los cursos del mismo tema.</p>
      </section>
      {Object.entries(cats).map(([cat, list]) => (
        <section className="al-sec" key={cat}>
          <div className="al-seclabel"><span>{cat}</span><span className="al-vol">{list.length} curso{list.length > 1 ? 's' : ''}</span></div>
          <div className="al-grid">
            {list.map((c) => (
              <Card key={c.slug} badge="Curso" titulo={c.titulo} desc={c.cardDesc}
                ariaLabel={`Entrar a ${c.titulo}`} onClick={() => enter(c.slug)} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

// ── Hub del curso ────────────────────────────────────────────────────────────
function Hub({ curso, goClase, goRecurso }: { curso: Curso; goClase: (n: number) => void; goRecurso: (slug: string) => void }) {
  // Cursos con módulos (grupo) se agrupan por sub-título; los planos van en grilla.
  const grupos = useMemo(() => {
    const m = new Map<string, Clase[]>();
    for (const c of curso.clases) { const g = c.grupo || ''; if (!m.has(g)) m.set(g, []); m.get(g)!.push(c); }
    return [...m.entries()];
  }, [curso]);
  const conModulos = curso.clases.some((c) => c.grupo);
  const claseCard = (c: Clase) => (
    <Card key={c.n} badge={`Clase ${nn(c.vn ?? c.n)}`} titulo={c.titulo} desc={c.cardDesc}
      ariaLabel={`Abrir ${c.titulo}`} onClick={() => goClase(c.n)} />
  );
  return (
    <>
      <section className="al-hero">
        <span className="al-eyebrow"><span className="d" /> {curso.eyebrow} · {curso.titulo}</span>
        <h1 className="al-h1">Tus recursos</h1>
        <p className="al-sub">{curso.subtitulo}</p>
      </section>
      <section className="al-sec">
        <div className="al-seclabel"><span>El curso</span><span className="al-vol">{curso.clases.length} clases · {curso.volumen}</span></div>
        {conModulos ? (
          <div className="al-modstack">
            {grupos.map(([g, cs]) => (
              <div key={g} className="al-modgroup">
                <h3 className="al-modtitle">{g}</h3>
                <div className="al-grid">{cs.map(claseCard)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="al-grid">{curso.clases.map(claseCard)}</div>
        )}
      </section>
      <section className="al-sec">
        <div className="al-seclabel"><span>Recursos</span><span className="al-vol">Agentes · prompts · catálogos</span></div>
        <div className="al-grid">
          {curso.recursos.map((r) => (
            <Card key={r.slug} badge={TIPO_BADGE[r.tipo]} nota={claseTag(r.clases)} titulo={r.label} desc={r.cardDesc}
              ariaLabel={`Abrir ${r.label}`} onClick={() => goRecurso(r.slug)} />
          ))}
        </div>
      </section>
    </>
  );
}

// Transcripción diferida: puede ser enorme (+130k chars), así que NO viaja en el
// bundle. Se sirve estática en /cono-tx/<videoId>.json y se baja al abrir el
// <details>, una sola vez.
function TranscriptLazy({ videoId }: { videoId: string }) {
  const [paras, setParas] = useState<string[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const load = () => {
    if (paras || state === 'loading') return;
    setState('loading');
    fetch(`/cono-tx/${videoId}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: string[]) => { setParas(d); setState('idle'); })
      .catch(() => setState('error'));
  };
  return (
    <details className="al-det" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) load(); }}>
      <summary>Ver transcripción</summary>
      <div className="al-transcript">
        {state === 'loading' && <p>Cargando transcripción…</p>}
        {state === 'error' && <p>No se pudo cargar la transcripción.</p>}
        {paras && paras.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </details>
  );
}

// ── Detalle de clase ─────────────────────────────────────────────────────────
function ClaseDetail({ curso, c, goRecurso, back }: { curso: Curso; c: Clase; goRecurso: (slug: string) => void; back: () => void }) {
  const bySlug = useMemo(() => Object.fromEntries(curso.recursos.map((r) => [r.slug, r])), [curso]);
  return (
    <div className="al-detail">
      <button type="button" className="al-back" onClick={back}>← Volver</button>
      <div className="al-detail-hd">
        <span className="al-rescard-badge">Clase {nn(c.n)}</span>
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

      {c.resumen && (
        <div className="al-block">
          <span className="al-block-l">Resumen</span>
          <div className="al-docbox al-docbox-tall"><DocContent text={c.resumen} /></div>
        </div>
      )}

      {c.hasTx && c.videoId ? (
        <TranscriptLazy videoId={c.videoId} />
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
function RecursoDetail({ r, back }: { r: Recurso; back: () => void }) {
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

export default function Conocimientos() {
  const router = useRouter();
  const params = useSearchParams();
  const cursoSlug = params.get('curso');
  const claseN = params.get('clase');
  const rSlug = params.get('r');
  const curso = cursoSlug ? TODOS.find((c) => c.slug === cursoSlug) : undefined;

  const viewKey = params.toString();
  const scrollKey = (k: string) => 'cono-scroll:' + k;

  const nav = (q: Record<string, string>) => {
    // Guardo el scroll de la vista actual para poder restaurarlo si vuelvo acá.
    try { sessionStorage.setItem(scrollKey(viewKey), String(window.scrollY)); } catch { /* noop */ }
    const qs = new URLSearchParams(q).toString();
    router.push('/conocimientos' + (qs ? '?' + qs : ''), { scroll: false });
  };
  const back = () => router.back();

  // Al cambiar de vista (incluye Atrás del navegador y "Volver"): restaurar el
  // scroll guardado de esa vista, o ir arriba si es una vista nueva.
  useEffect(() => {
    let saved = 0;
    try { saved = parseInt(sessionStorage.getItem(scrollKey(viewKey)) || '0', 10) || 0; } catch { /* noop */ }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: 'instant' as ScrollBehavior })); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [viewKey]);

  const clase = curso && claseN ? curso.clases.find((c) => String(c.n) === claseN) : undefined;
  const recurso = curso && rSlug ? curso.recursos.find((r) => r.slug === rSlug) : undefined;

  let body: ReactNode;
  if (!curso) body = <Selector enter={(slug) => nav({ curso: slug })} />;
  else if (clase) body = <ClaseDetail curso={curso} c={clase} goRecurso={(s) => nav({ curso: curso.slug, r: s })} back={back} />;
  else if (recurso) body = <RecursoDetail r={recurso} back={back} />;
  else body = <Hub curso={curso} goClase={(n) => nav({ curso: curso.slug, clase: String(n) })} goRecurso={(s) => nav({ curso: curso.slug, r: s })} />;

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
            <button type="button" className="al-brand-btn" onClick={() => nav({})} aria-label="Ir a los cursos">
              <span className="al-brand"><span className="b">Cono<span>cimientos</span></span><span className="sub">MaKo · formación</span></span>
            </button>
            {curso && <button type="button" className="al-toptag al-toptag-btn" onClick={() => nav({ curso: curso.slug })}>{curso.titulo}</button>}
          </div>
          {body}
        </div>
      </div>
    </div>
  );
}

const CSS = `
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
.cono .al-eyebrow{ display:inline-flex; align-items:center; gap:9px; font-family:var(--mono); font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-60); }
.cono .al-eyebrow .d{ width:11px; height:11px; border-radius:50%; background:var(--lime); border:1.5px solid var(--ink); flex:none; }
.cono .al-h1{ font-family:var(--disp); font-weight:800; font-size:clamp(40px,7vw,72px); line-height:.98; letter-spacing:-.03em; color:var(--ink); margin:16px 0 0; }
.cono .al-h1-sm{ font-size:clamp(30px,5vw,44px); }
.cono .al-sub{ font-size:clamp(15px,2vw,18px); line-height:1.6; color:var(--ink-80); max-width:56ch; margin:16px 0 0; }
.cono .al-sub-sm{ font-size:15px; margin-top:6px; }

/* Secciones */
.cono .al-sec{ margin-top:44px; }
.cono .al-seclabel{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; font-family:var(--mono); font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink); padding-bottom:12px; border-bottom:1.5px solid var(--ink-15); margin-bottom:18px; }
.cono .al-vol{ color:var(--ink-40); font-size:11px; }

/* Cursos con módulos: cada grupo con su sub-título */
.cono .al-modstack{ display:flex; flex-direction:column; gap:30px; }
.cono .al-modtitle{ font-family:var(--disp); font-weight:800; font-size:17px; letter-spacing:-.01em; color:var(--ink); margin:0 0 14px; padding-left:12px; border-left:4px solid var(--lime); line-height:1.2; }

/* Grilla de tarjetas */
.cono .al-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); gap:14px; }
.cono .al-rescard{ display:flex; flex-direction:column; align-items:flex-start; gap:9px; text-align:left; background:var(--card); border:1.5px solid var(--ink); border-radius:12px; padding:18px; box-shadow:var(--shadow-paste); transition:transform .14s ease, box-shadow .14s ease; }
.cono .al-rescard:hover{ transform:translate(-2px,-3px); box-shadow:var(--shadow-stamp); }
.cono .al-rescard-top{ display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; }
.cono .al-rescard-badge{ font-family:var(--mono); font-size:10px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--ink); background:var(--lime); border:1.5px solid var(--ink); border-radius:6px; padding:3px 8px; }
.cono .al-rescard-nota{ font-family:var(--mono); font-size:9.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-60); border:1.5px solid var(--ink-15); border-radius:6px; padding:3px 8px; white-space:nowrap; }
.cono .al-rescard-title{ font-family:var(--disp); font-weight:800; font-size:20px; letter-spacing:-.02em; color:var(--ink); line-height:1.1; }
.cono .al-rescard-desc{ font-size:14px; line-height:1.5; color:var(--ink-60); }
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
