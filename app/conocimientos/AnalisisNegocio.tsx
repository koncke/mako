'use client';

// =============================================================================
// /conocimientos → "Análisis de Negocio" — el diagnóstico de las 5 fases, vivo
// =============================================================================
// Vista interactiva del portal (estética paper .ahc): documenta el ORIGEN de la
// metodología (Andrea Estratega, orgánico IG) + NUESTRA adaptación (MaKo, VSL +
// Meta Ads), deja probar el DIAGNÓSTICO (las 6 preguntas → tu fase) y muestra los
// modales de las 5 fases y las 5 dimensiones. Los DATOS salen de
// lib/fase-diagnostico.ts (fuente única, la misma que usa el onboarding).

import { useState } from 'react';
import {
  FASES, PREGUNTAS, CANALES, VOLUMEN_POR_CANAL, DIMENSIONES,
  diagnosticar, faseDef, dimensionDeFase, repartoTexto,
  type CanalId, type Diagnostico,
} from '@/lib/fase-diagnostico';
import type { Curso } from './curso';

// Descriptor para que aparezca como "curso" en el selector del portal.
export const CURSO_ANALISIS: Curso = {
  slug: 'analisis-negocio',
  categoria: 'Estrategia y negocio',
  titulo: 'Análisis de Negocio — Las 5 Fases',
  cardDesc: 'El diagnóstico que le da el Norte a cada negocio: en qué fase estás, tu cuello y qué priorizar. Probalo acá mismo.',
  eyebrow: 'Método interno',
  subtitulo: 'La metodología de Andrea Estratega (Fórmula 100k) adaptada al modelo VSL + Meta Ads de MaKo. Probá el diagnóstico y mirá las 5 fases.',
  volumen: '5 fases · 5 dimensiones',
  recursos: [],
  clases: [],
};

// ── Traducción Andrea (orgánico IG) → MaKo (VSL + ads) ───────────────────────
const TRADUCCION: Array<[string, string]> = [
  ['Seguidores / audiencia', 'Inversión/día en Meta Ads (el combustible)'],
  ['Contenido viral', 'Creativos lanzados/mes (el motor — el diferencial de MaKo)'],
  ['Sistema de captación', 'El funnel: VSL → landing → agenda/checkout → nutrición'],
  ['Lead magnets / prospectos', 'Nutrición y follow-up del lead que no compró hoy'],
  ['Mezcla viral / autoridad / ventas', 'Prospección / Retargeting-Nutrición / Escala'],
];

// Las 5 fases ORIGINALES de Andrea (del PDF), para dejar el origen documentado.
const ANDREA_FASES: Array<[string, string]> = [
  ['Fase 0 · Nacimiento', 'Ingresos $0–100/mes · 0–2k seguidores · Cuello: Visibilidad · 80% viral / 20% autoridad / 0% ventas'],
  ['Fase 1 · Crecimiento', 'Ingresos $100–1k/mes · 2–5k seguidores · Cuello: Conversión · 50 / 30 / 20'],
  ['Fase 2 · Monetización', 'Ingresos $1k–5k/mes · 5–20k seguidores · Cuello: Sistemas · 30 / 40 / 30'],
  ['Fase 3 · Escalamiento', 'Ingresos $5k–10k/mes · 30–50k seguidores · Cuello: Tiempo · 20 / 40 / 40'],
  ['Fase 4 · Priorización', 'Ingresos $10k–20k+/mes · +50k seguidores · Cuello: Dispersión · 0 / 50 / 10'],
];
const ANDREA_DIM = ['Producto y Oferta', 'Marketing y Audiencia', 'Ventas y Monetización', 'Lead Magnets y Prospectos', 'Sistemas y Automatización'];

// ── El modal de UNA fase (mismo contenido que el resultado del onboarding) ────
function FaseModal({ idx, diag }: { idx: number; diag?: Diagnostico }) {
  const f = faseDef(idx);
  const dim = dimensionDeFase(f.id);
  const barras: Array<[string, number, string]> = [
    ['Prospección', f.estrategia.prospeccion, '#7a9e1f'],
    ['Retargeting y nutrición', f.estrategia.nutricion, '#c98a1a'],
    ['Escala', f.estrategia.escala, '#2f7d4f'],
  ];
  return (
    <div className="an-modal">
      <div className="an-modal-hd" style={{ borderLeft: `6px solid ${f.color}` }}>
        <span className="an-modal-emoji">{f.emoji}</span>
        <div style={{ minWidth: 0 }}>
          <div className="an-modal-kicker">Fase {f.id}{diag ? ` · consistencia ${diag.consistencia}%` : ''}</div>
          <div className="an-modal-name">{f.nombre}</div>
          <div className="an-modal-sub">{f.subtitulo}</div>
          <div className="an-modal-meta">{f.rango} · Cuello: {f.cuelloLabel}</div>
        </div>
      </div>

      {diag?.mixto && (
        <div className="an-box an-box-warn">
          <span className="an-l">Diagnóstico mixto ({repartoTexto(diag.reparto)})</span>
          Tus respuestas se reparten entre fases: avanzaste en una dimensión y te atrasaste en otra. Trabajá primero el cuello de tu fase más baja.
        </div>
      )}

      <div className="an-sec">
        <span className="an-l">Tu Norte: enfocá todo en {f.cuelloLabel}</span>
        <p className="an-p an-p-strong">{f.objetivo}</p>
      </div>

      <div className="an-sec">
        <span className="an-l">Síntomas de esta fase</span>
        <ul className="an-ul">{f.sintomas.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </div>

      <div className="an-sec">
        <span className="an-l">Acciones clave</span>
        <div className="an-acts">
          {f.acciones.map((a, i) => (
            <div key={i} className={`an-act ${a.critica ? 'an-act-key' : ''}`}>
              <span className="an-act-tag">{a.critica ? 'CLAVE' : i + 1}</span>
              <span>{a.texto}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="an-sec">
        <span className="an-l">Estrategia de pauta</span>
        <div className="an-bars">
          {barras.map(([lbl, val, col]) => (
            <div key={lbl} className="an-bar">
              <span className="an-bar-l">{lbl}</span>
              <span className="an-bar-track"><span className="an-bar-fill" style={{ width: `${val}%`, background: col }} /></span>
              <span className="an-bar-v">{val}%</span>
            </div>
          ))}
        </div>
        <p className="an-p an-p-dim">{f.estrategia.nota}</p>
      </div>

      <div className="an-box an-box-lime">
        <span className="an-l">Hito para pasar a la siguiente fase</span>
        {f.hito}
      </div>

      <div className="an-box an-box-red">
        <b>No hagas ahora:</b> {f.noHacer}
      </div>

      <div className="an-box">
        <span className="an-l">Tu dimensión débil</span>
        <div className="an-dimhead"><span>{dim.emoji}</span><b>{dim.nombre}</b></div>
        <p className="an-p an-p-dim" style={{ marginTop: 4 }}>{dim.descripcion}</p>
      </div>
    </div>
  );
}

// ── El formulario interactivo (las 6 preguntas → tu fase) ────────────────────
function DiagnosticoForm() {
  const [resp, setResp] = useState<number[]>(() => new Array(PREGUNTAS.length).fill(-1));
  const [canal, setCanal] = useState<CanalId>('llamadas');
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const completo = resp.every((r) => r >= 0);
  const pick = (qi: number, oi: number) => { setResp((r) => { const c = [...r]; c[qi] = oi; return c; }); setDiag(null); };
  return (
    <div>
      <div className="an-quiz">
        {PREGUNTAS.map((q, qi) => {
          const esVolumen = q.id === 'volumen';
          const opciones = esVolumen ? VOLUMEN_POR_CANAL[canal].opciones : q.opciones;
          const texto = esVolumen ? VOLUMEN_POR_CANAL[canal].texto : q.texto;
          return (
            <div key={q.id} className="an-q">
              <div className="an-q-head"><span className="an-q-n">{q.emoji}</span><span className="an-q-t">{texto}</span></div>
              {esVolumen && (
                <div className="an-canal">
                  <span className="an-canal-l">¿Cómo cerrás la venta?</span>
                  <div className="an-canal-pills">
                    {CANALES.map((c) => (
                      <button key={c.id} type="button" className={`an-pill ${canal === c.id ? 'on' : ''}`} onClick={() => { setCanal(c.id); setDiag(null); }}>{c.label}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="an-opts">
                {opciones.map((o, oi) => (
                  <button key={oi} type="button" className={`an-opt ${resp[qi] === oi ? 'on' : ''}`} onClick={() => pick(qi, oi)}>{o}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="an-cta">
        <button type="button" className="an-btn" disabled={!completo} onClick={() => setDiag(diagnosticar(resp, canal))}>
          {completo ? 'Ver mi diagnóstico →' : 'Respondé las 6 preguntas'}
        </button>
        {diag && <button type="button" className="an-btn an-btn-ghost" onClick={() => { setResp(new Array(PREGUNTAS.length).fill(-1)); setDiag(null); }}>Reiniciar</button>}
      </div>
      {diag && (
        <div className="an-result">
          <div className="an-l an-l-big">Tu diagnóstico</div>
          <FaseModal idx={diag.fase} diag={diag} />
        </div>
      )}
    </div>
  );
}

// ── La vista completa ────────────────────────────────────────────────────────
export default function AnalisisNegocio({ back }: { back: () => void }) {
  const [faseSel, setFaseSel] = useState(0);
  return (
    <div className="al-detail an-root">
      <style dangerouslySetInnerHTML={{ __html: AN_CSS }} />
      <button type="button" className="al-back" onClick={back}>← Volver</button>

      <div className="al-detail-hd">
        <span className="al-rescard-badge">Método interno</span>
        <h1 className="al-h1 al-h1-sm">Análisis de Negocio — Las 5 Fases</h1>
      </div>
      <p className="al-sub al-sub-sm">
        El diagnóstico que le da el <b>Norte</b> a cada negocio: todos los emprendedores comparten los
        mismos problemas según en qué fase están. Acá está el origen, nuestra adaptación, el formulario
        para probarlo y los modales de las 5 fases.
      </p>

      {/* PROBALO */}
      <section className="an-block">
        <div className="an-block-hd"><span className="an-kick">✦ Probalo</span><h2 className="an-h2">Hacé el diagnóstico</h2></div>
        <p className="an-p">Respondé las 6 preguntas —las mismas del onboarding— y mirá tu fase, tu cuello de botella y qué priorizar.</p>
        <DiagnosticoForm />
      </section>

      {/* LAS 5 FASES */}
      <section className="an-block">
        <div className="an-block-hd"><span className="an-kick">✦ Los modales</span><h2 className="an-h2">Las 5 fases</h2></div>
        <p className="an-p">Así queda el modal de cada fase (síntomas, acciones clave, estrategia de pauta, hito y dimensión débil). Elegí una:</p>
        <div className="an-fasetabs">
          {FASES.map((f, i) => (
            <button key={f.id} type="button" className={`an-fasetab ${faseSel === i ? 'on' : ''}`} onClick={() => setFaseSel(i)} style={faseSel === i ? { borderColor: f.color } : undefined}>
              <span className="an-fasetab-e">{f.emoji}</span>
              <span className="an-fasetab-t"><b>Fase {f.id}</b><span>{f.nombre}</span></span>
            </button>
          ))}
        </div>
        <FaseModal idx={faseSel} />
      </section>

      {/* LAS 5 DIMENSIONES */}
      <section className="an-block">
        <div className="an-block-hd"><span className="an-kick">✦ El diagnóstico por dimensiones</span><h2 className="an-h2">Las 5 dimensiones</h2></div>
        <p className="an-p">Cada negocio tiene estas 5 dimensiones y el cuello siempre vive en una. Estas son las señales de que esa es tu dimensión débil.</p>
        <div className="an-dims">
          {DIMENSIONES.map((d) => (
            <div key={d.nombre} className="an-dim">
              <div className="an-dim-hd"><span className="an-dim-e">{d.emoji}</span><b>{d.nombre}</b><span className="an-dim-fase">Cuello en Fase {d.faseCuello}</span></div>
              <p className="an-p an-p-dim">{d.descripcion}</p>
              <ul className="an-ul an-ul-sm">{d.senales.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      {/* NUESTRA ADAPTACIÓN */}
      <section className="an-block">
        <div className="an-block-hd"><span className="an-kick">✦ De Andrea a MaKo</span><h2 className="an-h2">Nuestra adaptación</h2></div>
        <p className="an-p">Andrea diagnostica un negocio de <b>orgánico viral por Instagram</b>. MaKo es <b>VSL por anuncios (Meta Ads)</b>. La espina dorsal se traduce así:</p>
        <div className="an-trad">
          <div className="an-trad-row an-trad-head"><span>Andrea (orgánico IG)</span><span>MaKo (VSL + pauta)</span></div>
          {TRADUCCION.map(([a, b], i) => (
            <div key={i} className="an-trad-row"><span>{a}</span><span>{b}</span></div>
          ))}
        </div>
        <p className="an-p an-p-dim">Lo que conservamos de Andrea es lo bueno: un cuello de botella por fase y un hito claro para avanzar. El "Norte se presetea" — la idea central del original.</p>
      </section>

      {/* EL ORIGEN (Andrea) */}
      <section className="an-block">
        <div className="an-block-hd"><span className="an-kick">✦ El origen</span><h2 className="an-h2">Andrea Estratega (Fórmula 100k)</h2></div>
        <p className="an-p">La metodología viene del <b>"Análisis de Negocio"</b> de Andrea Estratega. Su marco original (orgánico por Instagram), para dejar el crédito y la referencia:</p>
        <details className="an-details">
          <summary>Ver el framework original de Andrea</summary>
          <div className="an-details-body">
            <span className="an-l">Las 5 fases originales</span>
            <div className="an-reflist">
              {ANDREA_FASES.map(([t, d], i) => (
                <div key={i} className="an-refrow"><b>{t}</b><span>{d}</span></div>
              ))}
            </div>
            <span className="an-l" style={{ marginTop: 18 }}>Las 5 dimensiones originales</span>
            <ul className="an-ul an-ul-sm">{ANDREA_DIM.map((d, i) => <li key={i}>{d}</li>)}</ul>
            <p className="an-p an-p-dim" style={{ marginTop: 14 }}>
              El original también trae "cómo llenar el análisis" (tipo de negocio, nicho, problema, transformación,
              qué funciona / qué no, cuello de botella, competencia y oportunidades). MaKo pide esa misma info por
              El Archivero y el brief, no como un formulario largo.
            </p>
          </div>
        </details>
      </section>
    </div>
  );
}

const AN_CSS = `
.cono .an-root{ padding-bottom:40px; }
.cono .an-block{ margin-top:40px; padding-top:26px; border-top:1.5px solid var(--ink-15); }
.cono .an-block-hd{ display:flex; flex-direction:column; gap:6px; margin-bottom:8px; }
.cono .an-kick{ font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--lime-ink); }
.cono .an-h2{ font-family:var(--disp); font-weight:800; font-size:26px; letter-spacing:-.02em; color:var(--ink); margin:0; line-height:1.05; }
.cono .an-p{ font-size:15px; line-height:1.6; color:var(--ink-80); margin:10px 0 0; max-width:64ch; }
.cono .an-p-strong{ color:var(--ink); font-weight:600; }
.cono .an-p-dim{ font-size:13.5px; color:var(--ink-60); }
.cono .an-l{ display:block; font-family:var(--mono); font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-40); margin-bottom:8px; }
.cono .an-l-big{ font-size:12px; color:var(--lime-ink); margin-top:6px; }

/* Formulario */
.cono .an-quiz{ display:flex; flex-direction:column; gap:20px; margin-top:20px; }
.cono .an-q-head{ display:flex; align-items:baseline; gap:9px; margin-bottom:11px; }
.cono .an-q-n{ font-size:18px; flex:none; }
.cono .an-q-t{ font-family:var(--disp); font-weight:700; font-size:17px; color:var(--ink); letter-spacing:-.01em; }
.cono .an-canal{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:0 0 11px; }
.cono .an-canal-l{ font-family:var(--mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-40); }
.cono .an-canal-pills{ display:flex; gap:7px; flex-wrap:wrap; }
.cono .an-pill{ font-family:var(--mono); font-size:11.5px; font-weight:600; padding:6px 12px; border-radius:999px; border:1.5px solid var(--ink); background:var(--card); color:var(--ink-60); }
.cono .an-pill.on{ background:var(--lime); color:var(--ink); }
.cono .an-opts{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.cono .an-opt{ text-align:left; font-size:13.5px; line-height:1.4; padding:11px 13px; border-radius:10px; border:1.5px solid var(--ink-15); background:var(--card); color:var(--ink-80); transition:.12s; }
.cono .an-opt:hover{ border-color:var(--ink); }
.cono .an-opt.on{ border-color:var(--ink); background:var(--lime); color:var(--ink); font-weight:600; box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); }

.cono .an-cta{ display:flex; gap:10px; align-items:center; margin-top:22px; flex-wrap:wrap; }
.cono .an-btn{ font-family:var(--mono); font-size:13px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--ink); background:var(--lime); border:1.5px solid var(--ink); border-radius:10px; padding:12px 20px; transition:.14s; }
.cono .an-btn:hover:not(:disabled){ box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); }
.cono .an-btn:disabled{ opacity:.4; cursor:not-allowed; }
.cono .an-btn-ghost{ background:var(--card); color:var(--ink-60); }
.cono .an-result{ margin-top:26px; }

/* Modal de fase */
.cono .an-modal{ margin-top:16px; border:1.5px solid var(--ink); border-radius:14px; background:var(--card); box-shadow:var(--shadow-paste); padding:20px 22px 22px; display:flex; flex-direction:column; gap:18px; }
.cono .an-modal-hd{ display:flex; align-items:flex-start; gap:14px; padding:4px 0 4px 14px; }
.cono .an-modal-emoji{ font-size:38px; flex:none; line-height:1; }
.cono .an-modal-kicker{ font-family:var(--mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-40); }
.cono .an-modal-name{ font-family:var(--disp); font-weight:800; font-size:26px; letter-spacing:-.02em; color:var(--ink); line-height:1.05; }
.cono .an-modal-sub{ font-size:14px; font-weight:600; color:var(--lime-ink); margin-top:2px; }
.cono .an-modal-meta{ font-family:var(--mono); font-size:11.5px; color:var(--ink-60); margin-top:6px; }
.cono .an-sec{ }
.cono .an-ul{ margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:6px; }
.cono .an-ul li{ position:relative; padding-left:17px; font-size:14px; line-height:1.5; color:var(--ink-80); }
.cono .an-ul li::before{ content:'·'; position:absolute; left:4px; top:-2px; color:var(--lime-ink); font-weight:800; font-size:18px; }
.cono .an-ul-sm li{ font-size:13px; }
.cono .an-acts{ display:flex; flex-direction:column; gap:8px; }
.cono .an-act{ display:flex; gap:10px; align-items:flex-start; background:var(--card-2); border:1.5px solid var(--ink-15); border-radius:10px; padding:10px 12px; font-size:13.5px; line-height:1.5; color:var(--ink-80); }
.cono .an-act-key{ background:rgba(205,241,59,.22); border-color:var(--ink); }
.cono .an-act-tag{ font-family:var(--mono); font-size:9.5px; font-weight:700; letter-spacing:.06em; color:var(--lime-ink); flex:none; margin-top:2px; }
.cono .an-act-key .an-act-tag{ color:var(--ink); }
.cono .an-bars{ display:flex; flex-direction:column; gap:7px; }
.cono .an-bar{ display:flex; align-items:center; gap:10px; }
.cono .an-bar-l{ font-size:12px; color:var(--ink-60); flex:none; width:150px; }
.cono .an-bar-track{ flex:1; height:9px; border-radius:999px; background:var(--ink-15); overflow:hidden; }
.cono .an-bar-fill{ display:block; height:100%; border-radius:999px; }
.cono .an-bar-v{ font-family:var(--mono); font-size:11.5px; font-weight:700; color:var(--ink); flex:none; width:34px; text-align:right; }
.cono .an-box{ border:1.5px solid var(--ink-15); border-radius:11px; padding:12px 14px; font-size:13.5px; line-height:1.5; color:var(--ink-80); }
.cono .an-box-lime{ background:rgba(205,241,59,.14); border-color:var(--lime-d); }
.cono .an-box-red{ background:rgba(192,57,43,.06); border-color:rgba(192,57,43,.3); }
.cono .an-box-warn{ background:rgba(201,138,26,.08); border-color:rgba(201,138,26,.35); }
.cono .an-box b{ color:var(--ink); }
.cono .an-dimhead{ display:flex; align-items:center; gap:9px; font-size:15px; color:var(--ink); }
.cono .an-dimhead span{ font-size:18px; }

/* Tabs de fases */
.cono .an-fasetabs{ display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-top:18px; }
.cono .an-fasetab{ display:flex; flex-direction:column; align-items:center; gap:5px; text-align:center; padding:12px 8px; border-radius:11px; border:1.5px solid var(--ink-15); background:var(--card); transition:.12s; }
.cono .an-fasetab:hover{ border-color:var(--ink); }
.cono .an-fasetab.on{ border-width:2px; background:var(--card-2); box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); }
.cono .an-fasetab-e{ font-size:22px; }
.cono .an-fasetab-t{ display:flex; flex-direction:column; line-height:1.2; }
.cono .an-fasetab-t b{ font-family:var(--disp); font-size:13px; color:var(--ink); }
.cono .an-fasetab-t span{ font-size:11px; color:var(--ink-60); }

/* Dimensiones */
.cono .an-dims{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:18px; }
.cono .an-dim{ border:1.5px solid var(--ink); border-radius:12px; background:var(--card); box-shadow:var(--shadow-paste); padding:15px 16px; }
.cono .an-dim-hd{ display:flex; align-items:center; gap:8px; }
.cono .an-dim-hd b{ font-family:var(--disp); font-size:16px; color:var(--ink); }
.cono .an-dim-e{ font-size:18px; }
.cono .an-dim-fase{ margin-left:auto; font-family:var(--mono); font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-40); border:1.5px solid var(--ink-15); border-radius:6px; padding:2px 7px; white-space:nowrap; }

/* Traducción */
.cono .an-trad{ margin-top:18px; border:1.5px solid var(--ink); border-radius:12px; overflow:hidden; box-shadow:var(--shadow-paste); }
.cono .an-trad-row{ display:grid; grid-template-columns:1fr 1fr; gap:0; font-size:14px; color:var(--ink-80); }
.cono .an-trad-row > span{ padding:12px 15px; border-top:1.5px solid var(--ink-15); }
.cono .an-trad-row > span:first-child{ border-right:1.5px solid var(--ink-15); color:var(--ink-60); }
.cono .an-trad-head{ background:var(--card-2); font-family:var(--mono); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink); font-weight:600; }
.cono .an-trad-head > span{ border-top:0; }
.cono .an-trad-head > span:first-child{ color:var(--ink); }

/* Referencia Andrea */
.cono .an-details{ margin-top:16px; border:1.5px solid var(--ink); border-radius:12px; overflow:hidden; background:var(--card); }
.cono .an-details > summary{ cursor:pointer; list-style:none; padding:14px 18px; font-family:var(--mono); font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink); display:flex; align-items:center; gap:9px; }
.cono .an-details > summary::-webkit-details-marker{ display:none; }
.cono .an-details > summary::before{ content:'+'; font-size:16px; color:var(--lime-ink); }
.cono .an-details[open] > summary::before{ content:'−'; }
.cono .an-details[open] > summary{ border-bottom:1.5px solid var(--ink-15); }
.cono .an-details-body{ padding:16px 18px 18px; }
.cono .an-reflist{ display:flex; flex-direction:column; gap:8px; }
.cono .an-refrow{ display:flex; flex-direction:column; gap:2px; padding:9px 12px; border:1.5px solid var(--ink-15); border-radius:9px; background:var(--card-2); }
.cono .an-refrow b{ font-family:var(--disp); font-size:14px; color:var(--ink); }
.cono .an-refrow span{ font-size:12.5px; color:var(--ink-60); line-height:1.45; }

@media (max-width:680px){
  .cono .an-opts{ grid-template-columns:1fr; }
  .cono .an-fasetabs{ grid-template-columns:repeat(5,1fr); gap:5px; }
  .cono .an-fasetab-t span{ display:none; }
  .cono .an-dims{ grid-template-columns:1fr; }
  .cono .an-trad-row{ grid-template-columns:1fr; }
  .cono .an-trad-row > span:first-child{ border-right:0; }
}
`;
