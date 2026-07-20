'use client';

// =============================================================================
// /conocimientos — Portal interno de formación (admin). Curso AVATARHYPE.
// =============================================================================
// Réplica del "Área de alumnos" de AvatarHype (avatarhype.ai/alumnos): portal
// OSCURO con acentos neón, hero + grilla de tarjetas. Autocontenido como una
// capa fixed que tapa y oculta el sidebar del layout raíz
// (body:has(.cono) aside{display:none}), mismo truco que _detalle/FeatureDetail.
// Fuentes propias del diseño por Google Fonts: Bebas Neue (display), DM Sans
// (texto), Space Mono (labels/mono). El contenido vive en ./curso.
//
// Media incrustada: los videos de cada clase son archivos de Drive → se
// incrustan con el iframe /preview. Los demás recursos van como links.

import { useState } from 'react';
import { CURSO, type Clase, type Recurso } from './curso';

const DRIVE_PREVIEW = (id: string) => `https://drive.google.com/file/d/${id}/preview`;

function CopyBtn({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="c-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1600);
        } catch {
          /* clipboard bloqueado: el usuario puede seleccionar el texto a mano */
        }
      }}
    >
      {ok ? '✓ Copiado' : label}
    </button>
  );
}

// Íconos mínimos por tipo de recurso.
const RIC: Record<Recurso['tipo'], string> = {
  gpt: '◆', notion: '▤', capturas: '▦', pdf: '▧', zip: '⬇', doc: '▤', link: '↗',
};

function ClaseCard({ c }: { c: Clase }) {
  return (
    <article className="c-clase" id={`clase-${c.n}`}>
      <header className="c-clase-hd">
        <span className="c-num">{String(c.n).padStart(2, '0')}</span>
        <div>
          <span className="c-clase-eyebrow">Clase {c.n}</span>
          <h3 className="c-clase-title">{c.titulo}</h3>
        </div>
      </header>

      {c.videoId ? (
        <div className="c-video">
          <iframe
            src={DRIVE_PREVIEW(c.videoId)}
            title={`Clase ${c.n}: ${c.titulo}`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : (
        <div className="c-video c-video-missing"><span>Video no disponible</span></div>
      )}

      {c.resumen.length > 0 && (
        <ul className="c-resumen">
          {c.resumen.map((r, i) => (<li key={i}>{r}</li>))}
        </ul>
      )}

      {c.transcripcion.length > 0 ? (
        <details className="c-det">
          <summary>Ver transcripción</summary>
          <div className="c-transcript">
            {c.transcripcion.map((p, i) => (<p key={i}>{p}</p>))}
          </div>
        </details>
      ) : c.transcripcionNota ? (
        <div className="c-nota">{c.transcripcionNota}</div>
      ) : null}

      {c.recursos.length > 0 && (
        <div className="c-block">
          <span className="c-block-l">Recursos</span>
          <div className="c-chips">
            {c.recursos.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="c-chip">
                <span className="c-chip-ic">{RIC[r.tipo]}</span>{r.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {c.herramientas.length > 0 && (
        <div className="c-block">
          <span className="c-block-l">Herramientas</span>
          <div className="c-chips">
            {c.herramientas.map((h, i) => (
              <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" className="c-chip c-chip-tool">
                {h.nombre}{h.nota ? <span className="c-chip-note"> · {h.nota}</span> : null}
              </a>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default function Conocimientos() {
  return (
    <div className="cono">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* Fuentes del diseño AvatarHype */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- fuentes propias del diseño, scopeadas a esta ruta (igual que el layout carga Geist) */}
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <header className="c-hdr">
        <div className="c-hdr-in">
          <a href="/admin" className="c-logo" aria-label="Volver a admin">
            <span className="c-logo-mk">avatar<span className="c-logo-mk-2">hype</span></span>
            <span className="c-logo-pill">área de alumnos</span>
          </a>
          <a href="/admin" className="c-back">← Admin</a>
        </div>
      </header>

      <main className="c-main">
        {/* Hero */}
        <section className="c-hero">
          <span className="c-hero-eyebrow">{CURSO.eyebrow}</span>
          <h1 className="c-hero-h1">{CURSO.titulo}</h1>
          <p className="c-hero-sub">{CURSO.subtitulo}</p>
          <div className="c-hero-meta">
            <span><b>{CURSO.clases.length}</b> clases</span>
            <span className="c-dot" />
            <span>Imagen · Video · UGC con IA</span>
            <span className="c-dot" />
            <span>{CURSO.volumen}</span>
          </div>
        </section>

        {/* Clases */}
        <section className="c-sec">
          <div className="c-sec-hd">
            <h2 className="c-sec-h">El curso</h2>
            <span className="c-sec-tag">{CURSO.clases.length} clases</span>
          </div>
          <div className="c-clases">
            {CURSO.clases.map((c) => (<ClaseCard key={c.n} c={c} />))}
          </div>
        </section>

        {/* Biblioteca de prompts (copiables) */}
        <section className="c-sec">
          <div className="c-sec-hd">
            <h2 className="c-sec-h">Biblioteca de prompts</h2>
            <span className="c-sec-tag">copia y pega</span>
          </div>
          <div className="c-banks">
            {CURSO.prompts.map((p, i) => (
              <div key={i} className="c-bank c-bank-prompt">
                <div className="c-bank-top">
                  <h3 className="c-bank-t">{p.titulo}</h3>
                  <CopyBtn text={p.texto} />
                </div>
                <p className="c-bank-d">{p.desc}</p>
                <details className="c-det c-det-prompt">
                  <summary>Ver prompt completo</summary>
                  <pre className="c-pre">{p.texto}</pre>
                </details>
              </div>
            ))}
          </div>
        </section>

        {/* Bancos de recursos */}
        <section className="c-sec">
          <div className="c-sec-hd">
            <h2 className="c-sec-h">Tus recursos</h2>
          </div>
          <div className="c-banks">
            {CURSO.bancos.map((b, i) => (
              <div key={i} className="c-bank">
                <h3 className="c-bank-t">{b.titulo}</h3>
                <p className="c-bank-d">{b.desc}</p>
                <div className="c-bank-items">
                  {b.items.map((it, j) => (
                    it.url ? (
                      <a key={j} href={it.url} target="_blank" rel="noopener noreferrer" className="c-bank-item">
                        {it.label}<span className="c-arrow">↗</span>
                      </a>
                    ) : (
                      <span key={j} className="c-bank-item c-bank-item-soon">{it.label}</span>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="c-foot">
        <span className="c-logo-mk">avatar<span className="c-logo-mk-2">hype</span></span>
        <p>Formación interna · organizado en MaKo. Solo para el equipo.</p>
      </footer>
    </div>
  );
}

const CSS = `
body:has(.cono) aside { display: none !important; }

.cono {
  position: fixed; inset: 0; z-index: 100;
  overflow-y: auto; overflow-x: hidden;
  background:
    radial-gradient(1100px 500px at 80% -10%, rgba(0,255,135,.06), transparent 60%),
    radial-gradient(900px 500px at 0% 0%, rgba(255,79,0,.05), transparent 55%),
    #080808;
  color: #ECEBE4;
  font-family: 'DM Sans', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.cono * { box-sizing: border-box; }
.cono ::selection { background: rgba(0,255,135,.25); color: #fff; }
.cono a { text-decoration: none; }

/* Logo */
.c-logo-mk { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: .06em; line-height: .8; color: #F4F1E8; }
.c-logo-mk-2 { color: #00FF87; }

/* Header */
.c-hdr { position: sticky; top: 0; z-index: 40; background: rgba(8,8,8,.72); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,.07); }
.c-hdr-in { max-width: 1120px; margin: 0 auto; padding: 0 28px; height: 62px; display: flex; align-items: center; justify-content: space-between; }
.c-logo { display: flex; align-items: center; gap: 12px; }
.c-logo-pill { font-family: 'Space Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: .12em; color: #A7A49A; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 4px 11px; }
.c-back { font-family: 'Space Mono', monospace; font-size: 12.5px; color: #A7A49A; padding: 7px 14px; border: 1px solid rgba(255,255,255,.12); border-radius: 9px; transition: .18s; }
.c-back:hover { color: #fff; border-color: rgba(0,255,135,.5); }

.c-main { max-width: 1120px; margin: 0 auto; padding: 0 28px 20px; }

/* Hero */
.c-hero { padding: 68px 0 40px; border-bottom: 1px solid rgba(255,255,255,.07); }
.c-hero-eyebrow { font-family: 'Space Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: .18em; color: #00FF87; }
.c-hero-h1 { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: clamp(48px, 9vw, 104px); line-height: .92; letter-spacing: .01em; margin: 16px 0 0; color: #F7F4EA; text-transform: uppercase; }
.c-hero-sub { margin: 18px 0 0; max-width: 620px; font-size: 18px; line-height: 1.6; color: #B4B1A7; }
.c-hero-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; margin-top: 26px; font-family: 'Space Mono', monospace; font-size: 13px; color: #8B887F; }
.c-hero-meta b { color: #F4F1E8; }
.c-dot { width: 4px; height: 4px; border-radius: 50%; background: #4A4842; }

/* Secciones */
.c-sec { padding: 52px 0; border-bottom: 1px solid rgba(255,255,255,.07); }
.c-sec-hd { display: flex; align-items: baseline; gap: 14px; margin-bottom: 26px; }
.c-sec-h { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 34px; letter-spacing: .02em; text-transform: uppercase; color: #F4F1E8; margin: 0; }
.c-sec-tag { font-family: 'Space Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #8B887F; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; padding: 4px 10px; }

/* Clases */
.c-clases { display: flex; flex-direction: column; gap: 18px; }
.c-clase { background: linear-gradient(180deg,#141310,#101010); border: 1px solid rgba(255,255,255,.08); border-radius: 20px; padding: 26px; }
.c-clase-hd { display: flex; align-items: center; gap: 18px; margin-bottom: 20px; }
.c-num { font-family: 'Bebas Neue', sans-serif; font-size: 54px; line-height: .8; color: transparent; -webkit-text-stroke: 1.4px rgba(0,255,135,.55); }
.c-clase-eyebrow { font-family: 'Space Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: #FF4F00; }
.c-clase-title { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 30px; letter-spacing: .01em; text-transform: uppercase; color: #F7F4EA; margin: 2px 0 0; }

.c-video { position: relative; aspect-ratio: 16 / 9; border-radius: 14px; overflow: hidden; background: #000; border: 1px solid rgba(255,255,255,.08); }
.c-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.c-video-missing { display: flex; align-items: center; justify-content: center; font-family: 'Space Mono', monospace; font-size: 13px; color: #6C695F; }

.c-resumen { list-style: none; margin: 22px 0 0; padding: 0; display: grid; gap: 11px; }
.c-resumen li { position: relative; padding-left: 22px; font-size: 15px; line-height: 1.55; color: #C8C5BB; }
.c-resumen li::before { content: '→'; position: absolute; left: 0; top: 0; color: #00FF87; font-weight: 700; }

/* Details */
.c-det { margin-top: 18px; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; overflow: hidden; background: rgba(255,255,255,.02); }
.c-det > summary { cursor: pointer; list-style: none; padding: 13px 18px; font-family: 'Space Mono', monospace; font-size: 12.5px; text-transform: uppercase; letter-spacing: .08em; color: #CDF13B; display: flex; align-items: center; gap: 9px; }
.c-det > summary::-webkit-details-marker { display: none; }
.c-det > summary::before { content: '+'; font-size: 16px; color: #CDF13B; }
.c-det[open] > summary::before { content: '−'; }
.c-det[open] > summary { border-bottom: 1px solid rgba(255,255,255,.08); }
.c-transcript { padding: 8px 18px 18px; max-height: 460px; overflow-y: auto; }
.c-transcript p { margin: 12px 0 0; font-size: 14.5px; line-height: 1.7; color: #ACA99F; }

.c-nota { margin-top: 16px; font-family: 'Space Mono', monospace; font-size: 12px; color: #8B887F; background: rgba(255,79,0,.06); border: 1px solid rgba(255,79,0,.2); border-radius: 10px; padding: 11px 14px; }

/* Blocks (recursos / herramientas) */
.c-block { margin-top: 20px; }
.c-block-l { display: block; font-family: 'Space Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #6C695F; margin-bottom: 10px; }
.c-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.c-chip { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; color: #D8D5CB; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1); border-radius: 9px; padding: 8px 13px; transition: .16s; }
.c-chip:hover { border-color: rgba(0,255,135,.45); color: #fff; background: rgba(0,255,135,.06); }
.c-chip-ic { color: #00FF87; font-size: 12px; }
.c-chip-tool { font-family: 'Space Mono', monospace; font-size: 12.5px; color: #E8B08A; }
.c-chip-tool:hover { border-color: rgba(255,79,0,.5); color: #FF7A3C; background: rgba(255,79,0,.06); }
.c-chip-note { color: #8B887F; }

/* Banks (biblioteca / recursos) */
.c-banks { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.c-bank { background: linear-gradient(180deg,#151410,#0F0F0E); border: 1px solid rgba(255,255,255,.08); border-radius: 18px; padding: 24px; display: flex; flex-direction: column; }
.c-bank-prompt { grid-column: span 2; }
.c-bank-top { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.c-bank-t { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 24px; letter-spacing: .02em; text-transform: uppercase; color: #F7F4EA; margin: 0; }
.c-bank-d { margin: 8px 0 0; font-size: 14px; line-height: 1.55; color: #A7A49A; }
.c-bank-items { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
.c-bank-item { display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: #D8D5CB; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.09); border-radius: 10px; padding: 11px 14px; transition: .16s; }
.c-bank-item:hover { border-color: rgba(0,255,135,.45); color: #fff; }
.c-bank-item-soon { color: #6C695F; }
.c-arrow { color: #00FF87; }

.c-copy { font-family: 'Space Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #080808; background: #00FF87; border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-weight: 700; flex: none; transition: .16s; }
.c-copy:hover { background: #4dffa8; }

.c-det-prompt { margin-top: 16px; }
.c-pre { margin: 0; padding: 16px 18px; max-height: 380px; overflow: auto; font-family: 'Space Mono', monospace; font-size: 12.5px; line-height: 1.6; color: #B8B5AB; white-space: pre-wrap; word-break: break-word; }

/* Footer */
.c-foot { max-width: 1120px; margin: 0 auto; padding: 40px 28px 56px; }
.c-foot p { margin: 10px 0 0; font-family: 'Space Mono', monospace; font-size: 12px; color: #6C695F; }

@media (max-width: 760px) {
  .c-banks { grid-template-columns: 1fr; }
  .c-bank-prompt { grid-column: auto; }
  .c-main, .c-hdr-in, .c-foot { padding-left: 18px; padding-right: 18px; }
  .c-clase { padding: 20px; }
  .c-num { font-size: 42px; }
  .c-logo-pill { display: none; }
}
`;
