'use client';

// =============================================================================
// /conocimientos — Portal interno de formación (admin). Curso AVATARHYPE.
// =============================================================================
// Réplica del "Área de alumnos" de AvatarHype (avatarhype.ai/alumnos), scope
// `.ahc`: estética PAPEL (crema #F4F1E8 + grilla azulada), tinta oscura, acento
// LIMA #CDF13B, tarjetas casi blancas con borde 1.5px y sombra de papel.
// Fuentes: Bricolage Grotesque (títulos 800), Spline Sans Mono (labels/botones),
// DM Sans (cuerpo) — por Google Fonts.
//
// NO tapa el sidebar: se renderiza DENTRO del layout de admin (a la derecha del
// sidebar). Navegación tipo hub → detalle con estado local: la grilla muestra
// tarjetas de CLASES y de RECURSOS; al abrir una, se entra a su detalle.
// Contenido en ./curso.

import { useState, type ReactNode } from 'react';
import { CURSO, type Clase, type Recurso } from './curso';

const DRIVE_PREVIEW = (id: string) => `https://drive.google.com/file/d/${id}/preview`;
const nn = (n: number) => String(n).padStart(2, '0');

type View = { t: 'hub' } | { t: 'clase'; n: number } | { t: 'recurso'; slug: string };

const RIC: Record<Recurso['tipo'], string> = {
  gpt: '◆', notion: '▤', capturas: '▦', pdf: '▧', zip: '⬇', tool: '↗',
};

// Tarjetas de "Tus recursos" (cada una abre su detalle).
const RECURSOS = [
  { slug: 'prompts', badge: 'Biblioteca', titulo: 'Biblioteca de prompts', desc: 'El UGC Prompt Engine y la plantilla Veo 3, listos para copiar y pegar.' },
  { slug: 'agentes', badge: 'Biblioteca', titulo: CURSO.bancos[0].titulo, desc: CURSO.bancos[0].desc },
  { slug: 'musica', badge: 'Recursos', titulo: CURSO.bancos[1].titulo, desc: CURSO.bancos[1].desc },
  { slug: 'tools', badge: 'Recursos', titulo: CURSO.bancos[2].titulo, desc: CURSO.bancos[2].desc },
];
const BANCO_POR_SLUG: Record<string, number> = { agentes: 0, musica: 1, tools: 2 };

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="al-copy" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1600); } catch { /* seleccionar a mano */ }
    }}>{ok ? '✓ Copiado' : 'Copiar'}</button>
  );
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
        <div className="al-seclabel"><span>Tus recursos</span><span className="al-vol">Prompts · agentes · música</span></div>
        <div className="al-grid">
          {RECURSOS.map((r) => (
            <Card key={r.slug} badge={r.badge} titulo={r.titulo} desc={r.desc}
              ariaLabel={`Abrir ${r.titulo}`} onClick={() => go({ t: 'recurso', slug: r.slug })} />
          ))}
        </div>
      </section>
    </>
  );
}

function Chips({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="al-block">
      <span className="al-block-l">{label}</span>
      <div className="al-chips">{children}</div>
    </div>
  );
}

// Un recurso, embebido directo: doc (texto copiable) · captura/PDF (visor) ·
// zip/herramienta (link, cuando no queda otra).
function RecursoItem({ r }: { r: Recurso }) {
  if ((r.tipo === 'gpt' || r.tipo === 'notion') && r.texto) {
    return (
      <div className="al-embed">
        <div className="al-embed-hd">
          <span className="al-embed-t"><span className="al-embed-ic">{RIC[r.tipo]}</span>{r.label}</span>
          <CopyBtn text={r.texto} />
        </div>
        <details className="al-det">
          <summary>Ver contenido</summary>
          <pre className="al-pre">{r.texto}</pre>
        </details>
      </div>
    );
  }
  if ((r.tipo === 'capturas' || r.tipo === 'pdf') && r.driveId) {
    return (
      <div className="al-embed">
        <span className="al-embed-t"><span className="al-embed-ic">{RIC[r.tipo]}</span>{r.label}</span>
        <div className="al-pdf">
          <iframe src={DRIVE_PREVIEW(r.driveId)} title={r.label} loading="lazy" allowFullScreen />
        </div>
      </div>
    );
  }
  return (
    <a href={r.url} target="_blank" rel="noopener noreferrer" className="al-list-item">
      <span><span className="al-embed-ic">{RIC[r.tipo]}</span>{r.label}</span><span className="al-arr">↗</span>
    </a>
  );
}

function ClaseDetail({ c, back }: { c: Clase; back: () => void }) {
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

      {c.recursos.length > 0 && (
        <div className="al-block">
          <span className="al-block-l">Recursos</span>
          <div className="al-embeds">
            {c.recursos.map((r, i) => (<RecursoItem key={i} r={r} />))}
          </div>
        </div>
      )}
      {c.herramientas.length > 0 && (
        <Chips label="Herramientas">
          {c.herramientas.map((h, i) => (
            <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" className="al-chip al-chip-tool">
              {h.nombre}{h.nota ? <span className="al-chip-note"> · {h.nota}</span> : null}
            </a>
          ))}
        </Chips>
      )}
    </div>
  );
}

function RecursoDetail({ slug, back }: { slug: string; back: () => void }) {
  const esPrompts = slug === 'prompts';
  const banco = esPrompts ? null : CURSO.bancos[BANCO_POR_SLUG[slug]];
  const titulo = esPrompts ? 'Biblioteca de prompts' : banco!.titulo;

  return (
    <div className="al-detail">
      <button type="button" className="al-back" onClick={back}>← Todos los recursos</button>
      <div className="al-detail-hd">
        <span className="al-rescard-badge">{esPrompts ? 'Biblioteca' : 'Recursos'}</span>
        <h1 className="al-h1 al-h1-sm">{titulo}</h1>
      </div>

      {esPrompts ? (
        <div className="al-prompts">
          {CURSO.prompts.map((p, i) => (
            <div key={i} className="al-prompt">
              <div className="al-prompt-hd">
                <span className="al-prompt-t">{p.titulo}</span>
                <CopyBtn text={p.texto} />
              </div>
              <p className="al-prompt-d">{p.desc}</p>
              <details className="al-det">
                <summary>Ver prompt completo</summary>
                <pre className="al-pre">{p.texto}</pre>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="al-sub al-sub-sm">{banco!.desc}</p>
          <div className="al-embeds">
            {banco!.items.map((it, i) => (
              it.texto ? (
                <div key={i} className="al-prompt">
                  <div className="al-prompt-hd"><span className="al-prompt-t">{it.label}</span><CopyBtn text={it.texto} /></div>
                  <details className="al-det"><summary>Ver contenido</summary><pre className="al-pre">{it.texto}</pre></details>
                </div>
              ) : it.url ? (
                <a key={i} href={it.url} target="_blank" rel="noopener noreferrer" className="al-list-item">
                  <span>{it.label}</span><span className="al-arr">↗</span>
                </a>
              ) : <span key={i} className="al-list-item al-list-soon">{it.label}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Conocimientos() {
  const [view, setView] = useState<View>({ t: 'hub' });
  const go = (v: View) => { setView(v); if (typeof window !== 'undefined') window.scrollTo({ top: 0 }); };
  const back = () => go({ t: 'hub' });
  const claseActual = view.t === 'clase' ? CURSO.clases.find((c) => c.n === view.n) : undefined;

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
          {view.t === 'clase' && claseActual && <ClaseDetail c={claseActual} back={back} />}
          {view.t === 'recurso' && <RecursoDetail slug={view.slug} back={back} />}
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
.cono .al-sub{ font-size:clamp(15px,2vw,18px); line-height:1.6; color:var(--ink-80); max-width:52ch; margin:16px 0 0; }
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
.cono .al-detail-hd{ display:flex; flex-direction:column; align-items:flex-start; gap:12px; margin-bottom:22px; }

.cono .al-video{ position:relative; aspect-ratio:16/9; border-radius:12px; overflow:hidden; background:#000; border:1.5px solid var(--ink); box-shadow:var(--shadow-paste); }
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
.cono .al-chip-ic{ color:var(--lime-ink); font-size:12px; }
.cono .al-chip-tool{ font-family:var(--mono); font-size:12.5px; }
.cono .al-chip-note{ color:var(--ink-40); }

/* Recursos: prompts + listas */
.cono .al-prompts{ display:flex; flex-direction:column; gap:16px; }
.cono .al-prompt{ background:var(--card); border:1.5px solid var(--ink); border-radius:12px; padding:20px; box-shadow:var(--shadow-paste); }
.cono .al-prompt-hd{ display:flex; align-items:center; justify-content:space-between; gap:14px; }
.cono .al-prompt-t{ font-family:var(--disp); font-weight:800; font-size:19px; letter-spacing:-.02em; color:var(--ink); }
.cono .al-prompt-d{ margin:8px 0 0; font-size:14px; line-height:1.5; color:var(--ink-60); }
.cono .al-copy{ font-family:var(--mono); font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--ink); background:var(--lime); border:1.5px solid var(--ink); border-radius:8px; padding:8px 14px; font-weight:600; flex:none; transition:.14s; }
.cono .al-copy:hover{ box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); }
.cono .al-pre{ margin:0; padding:16px 18px; max-height:380px; overflow:auto; font-family:var(--mono); font-size:12.5px; line-height:1.6; color:var(--ink-80); white-space:pre-wrap; word-break:break-word; background:var(--card-2); }

.cono .al-list{ display:flex; flex-direction:column; gap:9px; margin-top:16px; }
.cono .al-list-item{ display:flex; align-items:center; justify-content:space-between; font-size:15px; color:var(--ink); background:var(--card); border:1.5px solid var(--ink); border-radius:10px; padding:14px 16px; box-shadow:var(--shadow-paste); transition:.14s; }
.cono .al-list-item:hover{ box-shadow:var(--shadow-stamp); transform:translate(-2px,-2px); }
.cono .al-list-item .al-arr{ color:var(--lime-ink); }
.cono .al-list-soon{ color:var(--ink-40); box-shadow:none; }

/* Recursos embebidos (doc copiable / visor de PDF) */
.cono .al-embeds{ display:flex; flex-direction:column; gap:12px; }
.cono .al-embed{ background:var(--card); border:1.5px solid var(--ink); border-radius:12px; padding:16px 18px; box-shadow:var(--shadow-paste); }
.cono .al-embed-hd{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
.cono .al-embed-t{ font-family:var(--disp); font-weight:800; font-size:16px; letter-spacing:-.01em; color:var(--ink); display:inline-flex; align-items:center; gap:9px; }
.cono .al-embed-ic{ color:var(--lime-ink); font-size:12px; flex:none; }
.cono .al-embed .al-det{ margin-top:12px; }
.cono .al-pdf{ margin-top:12px; aspect-ratio:4/3; border:1.5px solid var(--ink); border-radius:10px; overflow:hidden; background:var(--card-2); }
.cono .al-pdf iframe{ width:100%; height:100%; border:0; display:block; }

@media (max-width:640px){
  .cono-wrap{ padding:18px 16px 56px; }
  .cono .al-grid{ grid-template-columns:1fr; }
  .cono .al-brand .b{ font-size:19px; }
  .cono .al-toptag{ display:none; }
}
`;
