'use client';

// =============================================================================
// /conocimientos — Portal interno de formación (admin). Curso AVATARHYPE.
// =============================================================================
// Réplica del "Área de alumnos" de AvatarHype (scope .ahc): estética PAPEL
// (crema #F4F1E8 + grilla azulada), tinta oscura, acento LIMA #CDF13B, tarjetas
// con borde 1.5px y sombra de papel. Fuentes: Bricolage Grotesque (títulos),
// Spline Sans Mono (labels), DM Sans (cuerpo).
//
// NO tapa el sidebar (se renderiza dentro del layout de admin). Navegación
// hub → detalle con estado local. La grilla tiene tarjetas de CLASES y de
// RECURSOS; cada recurso es su propia card con detalle rico: el contenido
// formateado (DocContent), las "capturas" como ejemplos visuales y el link al
// Notion público. Contenido en ./curso.

import { useState, type ReactNode } from 'react';
import { CURSO, type Clase, type Recurso } from './curso';

const DRIVE_PREVIEW = (id: string) => `https://drive.google.com/file/d/${id}/preview`;
const nn = (n: number) => String(n).padStart(2, '0');
const BY_SLUG: Record<string, Recurso> = Object.fromEntries(CURSO.recursos.map((r) => [r.slug, r]));
const TIPO_BADGE: Record<Recurso['tipo'], string> = { gpt: 'Agente', notion: 'Prompts', pdf: 'Catálogo', bank: 'Recursos' };

type View = { t: 'hub' } | { t: 'clase'; n: number } | { t: 'recurso'; slug: string };

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="al-copy" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1600); } catch { /* seleccionar a mano */ }
    }}>{ok ? '✓ Copiado' : 'Copiar'}</button>
  );
}

// Renderiza el contenido de un doc de forma NATIVA: títulos (MAYÚSCULAS / ━━━),
// subtítulos (⭐), listas (1. / - / •) y párrafos (con saltos). No es un volcado.
function DocContent({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let k = 0;
  const flushPara = () => { if (para.length) { out.push(<p key={k++} className="al-doc-p">{para.join('\n')}</p>); para = []; } };
  const flushList = () => { if (list.length) { const items = list.slice(); out.push(<ul key={k++} className="al-doc-ul">{items.map((li, i) => <li key={i}>{li}</li>)}</ul>); list = []; } };
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

function Card({ badge, titulo, desc, onClick, ariaLabel }: { badge: string; titulo: string; desc: string; onClick: () => void; ariaLabel: string }) {
  return (
    <button type="button" className="al-rescard" onClick={onClick} aria-label={ariaLabel}>
      <span className="al-rescard-badge">{badge}</span>
      <span className="al-rescard-title">{titulo}</span>
      <span className="al-rescard-desc">{desc}</span>
      <span className="al-rescard-go">Abrir <span className="al-arr">→</span></span>
    </button>
  );
}

function Hub({ go }: { go: (v: View) => void }) {
  return (
    <>
      <section className="al-hero">
        <span className="al-eyebrow"><span className="d" /> {CURSO.eyebrow} · Curso AVATARHYPE</span>
        <h1 className="al-h1">Tus recursos</h1>
        <p className="al-sub">{CURSO.subtitulo}</p>
      </section>

      <section className="al-sec">
        <div className="al-seclabel"><span>El curso</span><span className="al-vol">{CURSO.clases.length} clases · {CURSO.volumen}</span></div>
        <div className="al-grid">
          {CURSO.clases.map((c) => (
            <Card key={c.n} badge={`Clase ${nn(c.n)}`} titulo={c.titulo} desc={c.cardDesc}
              ariaLabel={`Abrir clase ${c.n}: ${c.titulo}`} onClick={() => go({ t: 'clase', n: c.n })} />
          ))}
        </div>
      </section>

      <section className="al-sec">
        <div className="al-seclabel"><span>Recursos</span><span className="al-vol">Agentes · prompts · catálogos</span></div>
        <div className="al-grid">
          {CURSO.recursos.map((r) => (
            <Card key={r.slug} badge={TIPO_BADGE[r.tipo]} titulo={r.label} desc={r.cardDesc}
              ariaLabel={`Abrir ${r.label}`} onClick={() => go({ t: 'recurso', slug: r.slug })} />
          ))}
        </div>
      </section>
    </>
  );
}

function ClaseDetail({ c, go, back }: { c: Clase; go: (v: View) => void; back: () => void }) {
  return (
    <div className="al-detail">
      <button type="button" className="al-back" onClick={back}>← Todas las clases</button>
      <div className="al-detail-hd">
        <span className="al-rescard-badge">Clase {nn(c.n)}</span>
        <h1 className="al-h1 al-h1-sm">{c.titulo}</h1>
      </div>

      {c.videoId ? (
        <div className="al-video">
          <iframe src={DRIVE_PREVIEW(c.videoId)} title={`Clase ${c.n}: ${c.titulo}`} allow="autoplay; encrypted-media" allowFullScreen loading="lazy" />
        </div>
      ) : <div className="al-video al-video-x"><span>Video no disponible</span></div>}

      {c.resumen.length > 0 && (
        <div className="al-block">
          <span className="al-block-l">Resumen</span>
          <ul className="al-resumen">{c.resumen.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}

      {c.transcripcion.length > 0 ? (
        <details className="al-det">
          <summary>Ver transcripción</summary>
          <div className="al-transcript">{c.transcripcion.map((p, i) => <p key={i}>{p}</p>)}</div>
        </details>
      ) : c.transcripcionNota ? <div className="al-nota">{c.transcripcionNota}</div> : null}

      {c.recursoSlugs.length > 0 && (
        <div className="al-block">
          <span className="al-block-l">Recursos de esta clase</span>
          <div className="al-chips">
            {c.recursoSlugs.map((s) => BY_SLUG[s] ? (
              <button key={s} type="button" className="al-chip al-chip-btn" onClick={() => go({ t: 'recurso', slug: s })}>
                {BY_SLUG[s].label} <span className="al-arr">→</span>
              </button>
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

function RecursoDetail({ r, back }: { r: Recurso; back: () => void }) {
  return (
    <div className="al-detail">
      <button type="button" className="al-back" onClick={back}>← Todos los recursos</button>
      <div className="al-detail-hd">
        <span className="al-rescard-badge">{TIPO_BADGE[r.tipo]}</span>
        <h1 className="al-h1 al-h1-sm">{r.label}</h1>
      </div>
      <p className="al-sub al-sub-sm">{r.cardDesc}</p>

      {(r.tipo === 'gpt' || r.tipo === 'notion') && (r.texto || r.bloques) && (
        <div className="al-content">
          <div className="al-content-hd">
            <span className="al-content-t">{r.tipo === 'gpt' ? 'Prompt del agente' : (r.bloques ? 'Contenido y ejemplos' : 'Contenido')}</span>
            <div className="al-content-act">
              {r.notionUrl && <a href={r.notionUrl} target="_blank" rel="noopener noreferrer" className="al-notion">Ver en Notion <span className="al-arr">↗</span></a>}
              {r.texto && <CopyBtn text={r.texto} />}
            </div>
          </div>
          {r.bloques && r.bloques.length > 0 ? (
            <div className="al-bloques">
              {r.bloques.map((b, i) => b.t === 'img' ? (
                <a key={i} href={b.v} target="_blank" rel="noopener noreferrer" className="al-bimg">
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagen del Notion público, URL externa */}
                  <img src={b.v} alt={`${r.label} — ejemplo`} loading="lazy" />
                </a>
              ) : (
                <div key={i} className="al-btxt"><DocContent text={b.v} /></div>
              ))}
            </div>
          ) : r.texto ? (
            <div className="al-docbox"><DocContent text={r.texto} /></div>
          ) : null}
        </div>
      )}

      {r.tipo === 'notion' && !r.bloques && r.imagenes && r.imagenes.length > 0 && (
        <div className="al-block">
          <span className="al-block-l">Ejemplos ({r.imagenes.length})</span>
          <div className="al-gallery">
            {r.imagenes.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="al-gitem">
                {/* eslint-disable-next-line @next/next/no-img-element -- imágenes del Notion público, URL externa */}
                <img src={src} alt={`${r.label} — ejemplo ${i + 1}`} loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      )}

      {r.tipo === 'notion' && !r.bloques && (!r.imagenes || r.imagenes.length === 0) && r.capturasDriveId && (
        <div className="al-block">
          <span className="al-block-l">Ejemplos visuales</span>
          <div className="al-pdf"><iframe src={DRIVE_PREVIEW(r.capturasDriveId)} title={`${r.label} — ejemplos`} loading="lazy" allowFullScreen /></div>
        </div>
      )}

      {r.tipo === 'pdf' && r.driveId && (
        <div className="al-pdf al-pdf-tall"><iframe src={DRIVE_PREVIEW(r.driveId)} title={r.label} loading="lazy" allowFullScreen /></div>
      )}

      {r.tipo === 'bank' && r.items && (
        <div className="al-list">
          {r.items.map((it, i) => (
            <a key={i} href={it.url} target="_blank" rel="noopener noreferrer" className="al-list-item">
              <span>{it.label}</span><span className="al-arr">↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Conocimientos() {
  const [view, setView] = useState<View>({ t: 'hub' });
  const go = (v: View) => { setView(v); if (typeof window !== 'undefined') window.scrollTo({ top: 0 }); };
  const back = () => go({ t: 'hub' });
  const clase = view.t === 'clase' ? CURSO.clases.find((c) => c.n === view.n) : undefined;
  const recurso = view.t === 'recurso' ? BY_SLUG[view.slug] : undefined;

  return (
    <div className="cono ahc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- fuentes propias del diseño, scopeadas a esta ruta (igual que el layout carga Geist) */}
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div className="paper-bg">
        <div className="cono-wrap">
          <div className="al-top">
            <span className="al-brand">
              <span className="b">avatar<span>hype</span></span>
              <span className="sub">Área de alumnos</span>
            </span>
            <span className="al-toptag">Curso AVATARHYPE</span>
          </div>

          {view.t === 'hub' && <Hub go={go} />}
          {view.t === 'clase' && clase && <ClaseDetail c={clase} go={go} back={back} />}
          {view.t === 'recurso' && recurso && <RecursoDetail r={recurso} back={back} />}
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
.cono .al-brand{ display:flex; flex-direction:column; gap:3px; }
.cono .al-brand .b{ font-family:var(--disp); font-weight:800; font-size:22px; letter-spacing:-.04em; line-height:1; color:var(--ink); }
.cono .al-brand .b span{ color:var(--lime-ink); }
.cono .al-brand .sub{ font-family:var(--mono); font-size:9.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-40); }
.cono .al-toptag{ font-family:var(--mono); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-60); border:1.5px solid var(--ink); border-radius:999px; padding:6px 13px; background:var(--card); }

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

/* Grilla de tarjetas */
.cono .al-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); gap:14px; }
.cono .al-rescard{ display:flex; flex-direction:column; align-items:flex-start; gap:9px; text-align:left; background:var(--card); border:1.5px solid var(--ink); border-radius:12px; padding:18px; box-shadow:var(--shadow-paste); transition:transform .14s ease, box-shadow .14s ease; }
.cono .al-rescard:hover{ transform:translate(-2px,-3px); box-shadow:var(--shadow-stamp); }
.cono .al-rescard-badge{ font-family:var(--mono); font-size:10px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--ink); background:var(--lime); border:1.5px solid var(--ink); border-radius:6px; padding:3px 8px; }
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

.cono .al-video{ position:relative; aspect-ratio:16/9; border-radius:12px; overflow:hidden; background:#000; border:1.5px solid var(--ink); box-shadow:var(--shadow-paste); margin-top:16px; }
.cono .al-video iframe{ position:absolute; inset:0; width:100%; height:100%; border:0; }
.cono .al-video-x{ display:flex; align-items:center; justify-content:center; background:var(--card-2); color:var(--ink-40); font-family:var(--mono); font-size:13px; }

.cono .al-block{ margin-top:24px; }
.cono .al-block-l{ display:block; font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-40); margin-bottom:11px; }
.cono .al-resumen{ list-style:none; margin:0; padding:0; display:grid; gap:10px; }
.cono .al-resumen li{ position:relative; padding-left:22px; font-size:15px; line-height:1.55; color:var(--ink-80); }
.cono .al-resumen li::before{ content:'→'; position:absolute; left:0; top:0; color:var(--lime-ink); font-weight:700; }

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
.cono .al-chip-btn .al-arr{ color:var(--lime-ink); }
.cono .al-chip-tool{ font-family:var(--mono); font-size:12.5px; }
.cono .al-chip-note{ color:var(--ink-40); }

/* Contenido embebido (doc formateado) */
.cono .al-content{ margin-top:18px; }
.cono .al-content-hd{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
.cono .al-content-t{ font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-40); }
.cono .al-content-act{ display:flex; align-items:center; gap:8px; }
.cono .al-notion{ font-family:var(--mono); font-size:11.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--ink); background:var(--card); border:1.5px solid var(--ink); border-radius:8px; padding:7px 12px; display:inline-flex; align-items:center; gap:6px; }
.cono .al-notion:hover{ box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); }
.cono .al-notion .al-arr{ color:var(--lime-ink); }
.cono .al-copy{ font-family:var(--mono); font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--ink); background:var(--lime); border:1.5px solid var(--ink); border-radius:8px; padding:8px 14px; font-weight:600; flex:none; transition:.14s; }
.cono .al-copy:hover{ box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); }

.cono .al-doc{ }
.cono .al-docbox{ border:1.5px solid var(--ink); border-radius:12px; box-shadow:var(--shadow-paste); padding:16px 20px 20px; max-height:560px; overflow-y:auto; background:var(--card-2); }
/* Contenido intercalado texto ↔ imagen (orden real del Notion) */
.cono .al-bloques{ display:flex; flex-direction:column; gap:14px; }
.cono .al-btxt{ }
.cono .al-bimg{ display:block; border:1.5px solid var(--ink); border-radius:12px; overflow:hidden; box-shadow:var(--shadow-paste); background:var(--card-2); max-width:420px; transition:transform .14s ease, box-shadow .14s ease; }
.cono .al-bimg:hover{ box-shadow:var(--shadow-stamp); transform:translate(-2px,-2px); }
.cono .al-bimg img{ display:block; width:100%; height:auto; }
.cono .al-doc-h4{ font-family:var(--disp); font-weight:800; font-size:15.5px; letter-spacing:-.01em; color:var(--ink); margin:18px 0 8px; }
.cono .al-doc-h4:first-child{ margin-top:2px; }
.cono .al-doc-h5{ font-family:var(--mono); font-size:11.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--lime-ink); margin:16px 0 6px; }
.cono .al-doc-p{ margin:8px 0 0; font-size:14px; line-height:1.65; color:var(--ink-80); white-space:pre-line; word-break:break-word; }
.cono .al-doc-ul{ margin:8px 0 0; padding:0; list-style:none; display:flex; flex-direction:column; gap:6px; }
.cono .al-doc-ul li{ position:relative; padding-left:18px; font-size:14px; line-height:1.55; color:var(--ink-80); }
.cono .al-doc-ul li::before{ content:'·'; position:absolute; left:5px; top:-1px; color:var(--lime-ink); font-weight:800; font-size:18px; }

/* Visor de PDF (capturas / catálogo) */
.cono .al-pdf{ aspect-ratio:4/3; border:1.5px solid var(--ink); border-radius:12px; overflow:hidden; background:var(--card-2); box-shadow:var(--shadow-paste); }
.cono .al-pdf-tall{ margin-top:18px; aspect-ratio:3/4; }
.cono .al-pdf iframe{ width:100%; height:100%; border:0; display:block; }

/* Galería de imágenes reales (del Notion) */
.cono .al-gallery{ display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; }
.cono .al-gitem{ display:block; border:1.5px solid var(--ink); border-radius:10px; overflow:hidden; box-shadow:var(--shadow-paste); background:var(--card-2); transition:transform .14s ease, box-shadow .14s ease; }
.cono .al-gitem:hover{ box-shadow:var(--shadow-stamp); transform:translate(-2px,-2px); }
.cono .al-gitem img{ display:block; width:100%; height:auto; }

/* Listas (bancos) */
.cono .al-list{ display:flex; flex-direction:column; gap:9px; margin-top:18px; }
.cono .al-list-item{ display:flex; align-items:center; justify-content:space-between; font-size:15px; color:var(--ink); background:var(--card); border:1.5px solid var(--ink); border-radius:10px; padding:14px 16px; box-shadow:var(--shadow-paste); transition:.14s; }
.cono .al-list-item:hover{ box-shadow:var(--shadow-stamp); transform:translate(-2px,-2px); }
.cono .al-list-item .al-arr{ color:var(--lime-ink); }

@media (max-width:640px){
  .cono-wrap{ padding:18px 16px 56px; }
  .cono .al-grid{ grid-template-columns:1fr; }
  .cono .al-brand .b{ font-size:19px; }
  .cono .al-toptag{ display:none; }
  .cono .al-content-hd{ flex-wrap:wrap; }
}
`;
