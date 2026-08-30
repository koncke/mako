'use client';

// =============================================================================
// /conocimientos → "Análisis de Negocio" — el diagnóstico de las 5 fases, vivo
// =============================================================================
// Vista interactiva del portal (estética paper .ahc), organizada en PESTAÑAS (sin
// scroll eterno): Probá tu fase · Las 5 fases · Las 5 dimensiones · La metodología.
// Documenta el ORIGEN (Andrea Estratega, orgánico IG, interactivo también) + NUESTRA
// adaptación (MaKo, VSL + Meta Ads), y deja probar el diagnóstico. Los DATOS de MaKo
// salen de lib/fase-diagnostico.ts (fuente única, la misma que usa el onboarding).

import { useState } from 'react';
import {
  FASES, PREGUNTAS, CANALES, VOLUMEN_POR_CANAL, DIMENSIONES,
  diagnosticar,
  type CanalId, type Diagnostico,
} from '@/lib/fase-diagnostico';
// MISMO componente que el onboarding (app/onboarding/FaseUI.tsx) — el detalle de
// cada fase acá es EXACTAMENTE la pantalla "Tu diagnóstico" del wizard, no una
// réplica que se desincroniza (pedido de Martín: "igual en diseño y copy").
import { FaseIcono, FaseResultado } from '../onboarding/FaseUI';
import Compartir from './Compartir';
import type { Curso } from './curso';

// La ficha se mudo a ./AnalisisNegocio.datos: `catalogo.ts` la importa como VALOR desde el
// SERVER y este archivo es `'use client'`, asi que alla llegaba una referencia de
// cliente en vez del objeto. Se re-exporta para no romper a ningun otro consumidor.
import { CURSO_ANALISIS } from './AnalisisNegocio.datos';
export { CURSO_ANALISIS };

// ── Barras (estrategia de MaKo / mezcla de contenido de Andrea) ──────────────
function Barras({ filas }: { filas: Array<[string, number, string]> }) {
  return (
    <div className="an-bars">
      {filas.map(([lbl, val, col]) => (
        <div key={lbl} className="an-bar">
          <span className="an-bar-l">{lbl}</span>
          <span className="an-bar-track"><span className="an-bar-fill" style={{ width: `${val}%`, background: col }} /></span>
          <span className="an-bar-v">{val}%</span>
        </div>
      ))}
    </div>
  );
}

// ── El detalle de UNA fase: EXACTAMENTE la pantalla del onboarding ────────────
// FaseResultado (el mismo componente del wizard), en una tarjeta blanca con los
// tokens de la app — así el diseño y el copy no pueden desincronizarse jamás.
// Para navegar una fase sin quiz, se sintetiza un Diagnóstico "puro" con la
// función real (todas las respuestas en esa fase → consistencia 100%).
const diagDeFase = (idx: number): Diagnostico => diagnosticar(new Array(PREGUNTAS.length).fill(idx));

function FaseDetalleOnboarding({ diag }: { diag: Diagnostico }) {
  return (
    <div className="an-onb">
      <FaseResultado diag={diag} />
    </div>
  );
}

// ── El formulario interactivo, PASO A PASO (una pregunta por vez) ─────────────
function DiagnosticoForm() {
  const total = PREGUNTAS.length;
  const [resp, setResp] = useState<number[]>(() => new Array(total).fill(-1));
  const [canal, setCanal] = useState<CanalId>('llamadas');
  const [idx, setIdx] = useState(0);
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const reiniciar = () => { setResp(new Array(total).fill(-1)); setIdx(0); setDiag(null); };

  // Resultado: el recuadro de la fase, al final.
  if (diag) return (
    <div className="an-result">
      <div className="an-l an-l-big">Tu fase</div>
      <FaseDetalleOnboarding diag={diag} />
      <div className="an-cta"><button type="button" className="an-btn an-btn-ghost" onClick={reiniciar}>↺ Empezar de nuevo</button></div>
    </div>
  );

  const q = PREGUNTAS[idx];
  const esVolumen = q.id === 'volumen';
  const opciones = esVolumen ? VOLUMEN_POR_CANAL[canal].opciones : q.opciones;
  const texto = esVolumen ? VOLUMEN_POR_CANAL[canal].texto : q.texto;
  const pick = (oi: number) => {
    const nr = [...resp]; nr[idx] = oi; setResp(nr);
    if (idx + 1 >= total) setDiag(diagnosticar(nr, canal)); else setIdx(idx + 1);
  };

  return (
    <div className="an-stepper">
      <div className="an-step-top">
        <span className="an-step-count">Pregunta {idx + 1} de {total}</span>
        <span className="an-progress"><span className="an-progress-fill" style={{ width: `${((idx + 1) / total) * 100}%` }} /></span>
      </div>
      <div className="an-step-q">
        <div className="an-q-head"><span className="an-q-n">{q.emoji}</span><span className="an-q-t">{texto}</span></div>
        {esVolumen && (
          <div className="an-canal">
            <span className="an-canal-l">¿Cómo cierras la venta?</span>
            <div className="an-canal-pills">{CANALES.map((c) => <button key={c.id} type="button" className={`an-pill ${canal === c.id ? 'on' : ''}`} onClick={() => setCanal(c.id)}>{c.label}</button>)}</div>
          </div>
        )}
        <div className="an-step-opts">
          {opciones.map((o, oi) => (
            <button key={oi} type="button" className={`an-opt ${resp[idx] === oi ? 'on' : ''}`} onClick={() => pick(oi)}>{o}</button>
          ))}
        </div>
      </div>
      <div className="an-step-nav">
        {idx > 0 ? <button type="button" className="an-btn an-btn-ghost" onClick={() => setIdx(idx - 1)}>← Atrás</button> : <span />}
        {resp[idx] >= 0 && (idx + 1 < total
          ? <button type="button" className="an-btn" onClick={() => setIdx(idx + 1)}>Siguiente →</button>
          : <button type="button" className="an-btn" onClick={() => setDiag(diagnosticar(resp, canal))}>Ver mi fase →</button>)}
      </div>
    </div>
  );
}

// ── La metodología de Andrea (interactiva también) ───────────────────────────
const TRADUCCION: Array<[string, string]> = [
  ['Seguidores / audiencia', 'Inversión/día en Meta Ads (el combustible)'],
  ['Contenido viral', 'Creativos lanzados/mes (el motor — el diferencial de MaKo)'],
  ['Sistema de captación', 'El funnel: VSL → landing → agenda/checkout → nutrición'],
  ['Lead magnets / prospectos', 'Nutrición y follow-up del lead que no compró hoy'],
  ['Mezcla viral / autoridad / ventas', 'Prospección / Retargeting-Nutrición / Escala'],
];

type AndreaFase = { n: number; nombre: string; ingresos: string; audiencia: string; cuello: string; foco: string; mix: [number, number, number] };
const ANDREA_FASES: AndreaFase[] = [
  { n: 0, nombre: 'Nacimiento', ingresos: '$0 – $100/mes', audiencia: '0 – 2.000 seguidores', cuello: 'Visibilidad', foco: 'Validar el nicho y crear una base de audiencia cualificada.', mix: [80, 20, 0] },
  { n: 1, nombre: 'Crecimiento', ingresos: '$100 – $1.000/mes', audiencia: '2.000 – 5.000 seguidores', cuello: 'Conversión', foco: 'Construir el sistema de captación y las primeras ventas consistentes.', mix: [50, 30, 20] },
  { n: 2, nombre: 'Monetización', ingresos: '$1.000 – $5.000/mes', audiencia: '5.000 – 20.000 seguidores', cuello: 'Sistemas', foco: 'Crear un sistema evergreen que venda sin depender 100% de ti.', mix: [30, 40, 30] },
  { n: 3, nombre: 'Escalamiento', ingresos: '$5.000 – $10.000/mes', audiencia: '30.000 – 50.000 seguidores', cuello: 'Tiempo', foco: 'Delegar, subir precios y activar tráfico pago sistematizado.', mix: [20, 40, 40] },
  { n: 4, nombre: 'Priorización', ingresos: '$10.000 – $20.000+/mes', audiencia: '+50.000 seguidores', cuello: 'Dispersión', foco: 'Simplificar, filtrar y escalar solo lo más rentable.', mix: [0, 50, 10] },
];

const ANDREA_DIM: Array<[string, string]> = [
  ['Producto y Oferta', 'Qué vendes, cómo lo ofreces y si el mercado lo valida. Una oferta mal estructurada hace que nadie entienda qué solucionas ni por qué pagarte.'],
  ['Marketing y Audiencia', 'El flujo de posibles clientes. Sin él, no hay ventas. El contenido es el activo que hace crecer el negocio — pero debe estar alineado con la oferta.'],
  ['Ventas y Monetización', 'Crecer sin convertir no sirve. La clave es un sistema que lleve a la audiencia fría a clientes de forma predecible.'],
  ['Lead Magnets y Prospectos', 'La puerta de entrada al funnel. Un buen lead magnet resuelve un dolor puntual, genera confianza y conecta con la oferta principal.'],
  ['Sistemas y Automatización', 'Liberan tu tiempo y hacen que el negocio funcione sin que estés presente. Sin ellos, eres el cuello de botella de tu propio negocio.'],
];

const ANDREA_LLENAR: Array<[string, string]> = [
  ['Diagnóstico del negocio', 'Tipo de negocio, nicho y sub-nicho, principal problema que resuelves y la transformación que ofreces (el antes vs. después).'],
  ['Situación actual', 'Qué está funcionando, qué NO, y cuál es el cuello: visibilidad, conversión, retención o sistemas.'],
  ['Competencia y mercado', 'Competidores que admiras, qué hacen que tú no, y qué haces tú que ellos no — el embrión de tu vehículo único.'],
  ['Oportunidades', 'Un ángulo de contenido sin explotar, un formato de producto que el mercado necesita y un canal donde tu avatar ya está.'],
];

function AndreaFaseDetalle({ f }: { f: AndreaFase }) {
  return (
    <div className="an-fd">
      <div className="an-fd-hd" style={{ borderColor: 'var(--lime-d)' }}>
        <span className="an-fd-icon" style={{ color: 'var(--lime-ink)' }}><FaseIcono id={f.n + 1} size={28} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="an-fd-kicker">Fase {f.n} (Andrea)</div>
          <div className="an-fd-name">{f.nombre}</div>
        </div>
      </div>
      <div className="an-fd-chips">
        <span className="an-chip">{f.ingresos}</span>
        <span className="an-chip">{f.audiencia}</span>
        <span className="an-chip">Cuello: {f.cuello}</span>
      </div>
      <div className="an-fd-norte"><span className="an-l">Foco de la fase</span>{f.foco}</div>
      <div className="an-fd-block">
        <span className="an-l">Mezcla de contenido</span>
        <Barras filas={[['Viral (alcance)', f.mix[0], '#c98a1a'], ['Autoridad', f.mix[1], '#7a9e1f'], ['Ventas', f.mix[2], '#2f7d4f']]} />
      </div>
    </div>
  );
}

// ── La vista completa (con pestañas) ─────────────────────────────────────────
type Tab = 'probar' | 'fases' | 'dimensiones' | 'metodologia';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'probar', label: '🎯 Prueba tu fase' },
  { id: 'fases', label: '📈 Las 5 fases' },
  { id: 'dimensiones', label: '🔬 Las 5 dimensiones' },
  { id: 'metodologia', label: '📖 La metodología' },
];

export default function AnalisisNegocio({ back, compartible = true }: { back?: (() => void) | null; compartible?: boolean }) {
  const [tab, setTab] = useState<Tab>('probar');
  const [faseSel, setFaseSel] = useState(0);
  const [andreaSel, setAndreaSel] = useState(0);
  return (
    <div className="al-detail an-root">
      <style dangerouslySetInnerHTML={{ __html: AN_CSS }} />
      {back && <button type="button" className="al-back" onClick={back}>← Volver</button>}

      <div className="al-detail-hd">
        <div className="al-hero-top" style={{ width: '100%' }}>
          <span className="al-rescard-badge">Método interno</span>
          {/* El mismo botón de Compartir que el resto del portal — faltaba acá. */}
          {compartible && <Compartir recurso="curso" recursoId={CURSO_ANALISIS.slug} etiqueta={CURSO_ANALISIS.titulo} />}
        </div>
        <h1 className="al-h1 al-h1-sm">Análisis de Negocio — Las 5 Fases</h1>
      </div>
      <p className="al-sub al-sub-sm">El diagnóstico que le da el <b>Norte</b> a cada negocio: todos comparten los mismos problemas según en qué fase están.</p>

      <nav className="an-tabs">
        {TABS.map((t) => <button key={t.id} type="button" className={`an-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </nav>

      {/* PROBÁ TU FASE */}
      {tab === 'probar' && (
        <section className="an-pane">
          <p className="an-p">Responde las 6 preguntas —las mismas del onboarding— y mira tu fase, tu cuello de botella y qué priorizar.</p>
          <DiagnosticoForm />
        </section>
      )}

      {/* LAS 5 FASES */}
      {tab === 'fases' && (
        <section className="an-pane">
          <div className="an-journey">
            {FASES.map((f, i) => (
              <button key={f.id} type="button" className={`an-jnode ${faseSel === i ? 'on' : ''}`} onClick={() => setFaseSel(i)} style={faseSel === i ? { borderColor: f.color, color: f.color } : undefined}>
                <span className="an-jicon"><FaseIcono id={f.id} size={26} /></span>
                <span className="an-jname">Fase {f.id}</span>
                <span className="an-jsub">{f.nombre}</span>
              </button>
            ))}
          </div>
          <FaseDetalleOnboarding diag={diagDeFase(faseSel)} />
        </section>
      )}

      {/* LAS 5 DIMENSIONES */}
      {tab === 'dimensiones' && (
        <section className="an-pane">
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
      )}

      {/* LA METODOLOGÍA (Andrea + adaptación) */}
      {tab === 'metodologia' && (
        <section className="an-pane">
          <div className="an-origen">
            <span className="an-kick">✦ El origen</span>
            <h2 className="an-h2">Andrea Estratega · Fórmula 100k</h2>
            <p className="an-p">La metodología viene del <b>"Análisis de Negocio"</b> de Andrea Estratega. Su idea central es la que adoptamos: <b>el Norte se presetea</b>, porque todos los emprendedores comparten los mismos problemas según en qué fase están. Andrea trabaja <b>orgánico viral por Instagram</b> — por eso su espina dorsal son los seguidores y la mezcla de contenido, y no la pauta.</p>
          </div>

          <div className="an-sub-hd"><span className="an-l">Sus 5 fases (interactivas)</span></div>
          <div className="an-journey">
            {ANDREA_FASES.map((f, i) => (
              <button key={f.n} type="button" className={`an-jnode ${andreaSel === i ? 'on' : ''}`} onClick={() => setAndreaSel(i)} style={andreaSel === i ? { borderColor: 'var(--lime-d)', color: 'var(--lime-ink)' } : undefined}>
                <span className="an-jicon"><FaseIcono id={f.n + 1} size={24} /></span>
                <span className="an-jname">Fase {f.n}</span>
                <span className="an-jsub">{f.nombre}</span>
              </button>
            ))}
          </div>
          <AndreaFaseDetalle f={ANDREA_FASES[andreaSel]} />

          <div className="an-sub-hd" style={{ marginTop: 28 }}><span className="an-l">Sus 5 dimensiones</span></div>
          <div className="an-dims">
            {ANDREA_DIM.map(([nombre, desc]) => (
              <div key={nombre} className="an-dim"><div className="an-dim-hd"><b>{nombre}</b></div><p className="an-p an-p-dim">{desc}</p></div>
            ))}
          </div>

          <div className="an-sub-hd" style={{ marginTop: 28 }}><span className="an-l">Cómo se llena el análisis</span></div>
          <div className="an-reflist">
            {ANDREA_LLENAR.map(([t, d]) => <div key={t} className="an-refrow"><b>{t}</b><span>{d}</span></div>)}
          </div>

          <div className="an-sub-hd" style={{ marginTop: 28 }}><span className="an-l">De Andrea a MaKo — nuestra adaptación</span></div>
          <p className="an-p">Andrea es orgánico por Instagram; MaKo es VSL por anuncios. La espina dorsal se traduce así:</p>
          <div className="an-trad">
            <div className="an-trad-row an-trad-head"><span>Andrea (orgánico IG)</span><span>MaKo (VSL + pauta)</span></div>
            {TRADUCCION.map(([a, b], i) => <div key={i} className="an-trad-row"><span>{a}</span><span>{b}</span></div>)}
          </div>
        </section>
      )}
    </div>
  );
}

const AN_CSS = `
.cono .an-root{ padding-bottom:44px; }
.cono .an-p{ font-size:15px; line-height:1.6; color:var(--ink-80); margin:10px 0 0; max-width:66ch; }
.cono .an-p-dim{ font-size:13px; color:var(--ink-60); }
.cono .an-l{ display:block; font-family:var(--mono); font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-40); margin-bottom:8px; }
.cono .an-l-big{ font-size:12px; color:var(--lime-ink); margin-top:6px; }
.cono .an-kick{ font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--lime-ink); }
.cono .an-h2{ font-family:var(--disp); font-weight:800; font-size:24px; letter-spacing:-.02em; color:var(--ink); margin:8px 0 0; line-height:1.08; }

/* Pestañas */
.cono .an-tabs{ display:flex; flex-wrap:wrap; gap:8px; margin:22px 0 4px; padding-bottom:16px; border-bottom:1.5px solid var(--ink-15); }
.cono .an-tab{ font-family:var(--mono); font-size:12.5px; font-weight:600; letter-spacing:.02em; color:var(--ink-60); background:var(--card); border:1.5px solid var(--ink-15); border-radius:999px; padding:9px 16px; transition:.14s; }
.cono .an-tab:hover{ border-color:var(--ink); color:var(--ink); }
.cono .an-tab.on{ background:var(--ink); color:var(--paper); border-color:var(--ink); }
.cono .an-pane{ padding-top:22px; }
.cono .an-sub-hd{ margin:22px 0 0; }

/* Journey: las 5 fases como íconos */
.cono .an-journey{ display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin:16px 0 20px; }
.cono .an-jnode{ display:flex; flex-direction:column; align-items:center; gap:6px; text-align:center; padding:14px 8px; border-radius:13px; border:1.5px solid var(--ink-15); background:var(--card); color:var(--ink-60); transition:.14s; }
.cono .an-jnode:hover{ border-color:var(--ink); color:var(--ink); }
.cono .an-jnode.on{ border-width:2px; background:var(--card-2); box-shadow:var(--shadow-stamp); transform:translate(-1px,-1px); }
.cono .an-jicon{ display:flex; }
.cono .an-jname{ font-family:var(--disp); font-weight:800; font-size:13px; color:var(--ink); }
.cono .an-jsub{ font-size:11px; color:var(--ink-60); }

/* Fase detalle = el MISMO FaseResultado del onboarding, en tarjeta blanca de la
   app (los tokens de la app cascadean desde :root; .cono solo pisa --ink, que es
   prácticamente idéntico). No estilizar el contenido: es el componente real. */
.cono .an-onb{ margin-top:16px; background:#FFFFFF; border:1.5px solid var(--ink-15); border-radius:18px; box-shadow:var(--shadow-paste); padding:26px 26px 28px; }

/* Fase detalle (lo sigue usando la vista de Andrea) */
.cono .an-fd{ border:1.5px solid var(--ink); border-radius:16px; background:var(--card); box-shadow:var(--shadow-paste); padding:20px 22px 22px; display:flex; flex-direction:column; gap:16px; }
.cono .an-fd-hd{ display:flex; align-items:center; gap:14px; padding-left:14px; border-left:5px solid; }
.cono .an-fd-icon{ flex:none; }
.cono .an-fd-kicker{ font-family:var(--mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-40); }
.cono .an-fd-name{ font-family:var(--disp); font-weight:800; font-size:26px; letter-spacing:-.02em; color:var(--ink); line-height:1.05; }
.cono .an-fd-sub{ font-size:14px; font-weight:600; color:var(--lime-ink); margin-top:2px; }
.cono .an-fd-chips{ display:flex; flex-wrap:wrap; gap:8px; }
.cono .an-chip{ font-family:var(--mono); font-size:11px; color:var(--ink-60); border:1.5px solid var(--ink-15); border-radius:999px; padding:5px 12px; }
.cono .an-fd-norte{ background:var(--card-2); border:1.5px solid var(--ink-15); border-radius:12px; padding:13px 15px; font-size:15px; color:var(--ink); line-height:1.55; font-weight:500; }
.cono .an-fd-block{ }
.cono .an-2col{ display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:start; }

/* Funnel sugerido: pasos conectados con flechas */
.cono .an-funnel{ display:flex; flex-wrap:wrap; align-items:center; gap:6px; }
.cono .an-funnel-step{ font-family:var(--mono); font-size:11.5px; font-weight:700; color:var(--ink); background:var(--card-2); border:1.5px solid var(--ink-15); border-radius:999px; padding:6px 12px; }
.cono .an-funnel-arrow{ color:var(--ink-40); font-size:13px; }
.cono .an-funnel-retarget{ border-style:dashed; color:var(--ink-60); font-weight:600; }

/* Barras */
.cono .an-bars{ display:flex; flex-direction:column; gap:7px; }
.cono .an-bar{ display:flex; align-items:center; gap:10px; }
.cono .an-bar-l{ font-size:12px; color:var(--ink-60); flex:none; width:150px; }
.cono .an-bar-track{ flex:1; height:9px; border-radius:999px; background:var(--ink-15); overflow:hidden; }
.cono .an-bar-fill{ display:block; height:100%; border-radius:999px; }
.cono .an-bar-v{ font-family:var(--mono); font-size:11.5px; font-weight:700; color:var(--ink); flex:none; width:34px; text-align:right; }

/* Listas / acciones */
.cono .an-ul{ margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:6px; }
.cono .an-ul li{ position:relative; padding-left:17px; font-size:13.5px; line-height:1.5; color:var(--ink-80); }
.cono .an-ul li::before{ content:'·'; position:absolute; left:4px; top:-2px; color:var(--lime-ink); font-weight:800; font-size:18px; }
.cono .an-ul-sm li{ font-size:13px; }
.cono .an-acts{ display:flex; flex-direction:column; gap:7px; }
.cono .an-act{ display:flex; gap:9px; align-items:flex-start; background:var(--card-2); border:1.5px solid var(--ink-15); border-radius:10px; padding:9px 11px; font-size:13px; line-height:1.5; color:var(--ink-80); }
.cono .an-act-key{ background:rgba(205,241,59,.22); border-color:var(--ink); }
.cono .an-act-tag{ font-family:var(--mono); font-size:9.5px; font-weight:700; letter-spacing:.06em; color:var(--lime-ink); flex:none; margin-top:2px; }
.cono .an-act-key .an-act-tag{ color:var(--ink); }

/* Cajas */
.cono .an-box{ border:1.5px solid var(--ink-15); border-radius:11px; padding:12px 14px; font-size:13px; line-height:1.5; color:var(--ink-80); }
.cono .an-box-lime{ background:rgba(205,241,59,.14); border-color:var(--lime-d); }
.cono .an-box-red{ background:rgba(192,57,43,.06); border-color:rgba(192,57,43,.3); }
.cono .an-box-warn{ background:rgba(201,138,26,.08); border-color:rgba(201,138,26,.35); }
.cono .an-box b{ color:var(--ink); }
.cono .an-dimhead{ display:flex; align-items:center; gap:8px; font-size:14.5px; color:var(--ink); }
.cono .an-dimhead span{ font-size:17px; }

/* Formulario */
.cono .an-quiz{ display:flex; flex-direction:column; gap:20px; margin-top:16px; }
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
.cono .an-result{ margin-top:8px; }

/* Formulario paso a paso */
.cono .an-stepper{ margin-top:18px; border:1.5px solid var(--ink); border-radius:16px; background:var(--card); box-shadow:var(--shadow-paste); padding:20px 22px 18px; }
.cono .an-step-top{ display:flex; align-items:center; gap:14px; margin-bottom:20px; }
.cono .an-step-count{ font-family:var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-40); flex:none; }
.cono .an-progress{ flex:1; height:7px; border-radius:999px; background:var(--ink-15); overflow:hidden; }
.cono .an-progress-fill{ display:block; height:100%; border-radius:999px; background:var(--lime-ink); transition:width .25s ease; }
.cono .an-step-q{ min-height:180px; }
.cono .an-step-opts{ display:flex; flex-direction:column; gap:9px; margin-top:14px; }
.cono .an-step-opts .an-opt{ padding:14px 16px; font-size:14.5px; }
.cono .an-step-nav{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:22px; padding-top:16px; border-top:1.5px solid var(--ink-15); }

/* Dimensiones */
.cono .an-dims{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px; }
.cono .an-dim{ border:1.5px solid var(--ink); border-radius:12px; background:var(--card); box-shadow:var(--shadow-paste); padding:15px 16px; }
.cono .an-dim-hd{ display:flex; align-items:center; gap:8px; }
.cono .an-dim-hd b{ font-family:var(--disp); font-size:16px; color:var(--ink); }
.cono .an-dim-e{ font-size:18px; }
.cono .an-dim-fase{ margin-left:auto; font-family:var(--mono); font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-40); border:1.5px solid var(--ink-15); border-radius:6px; padding:2px 7px; white-space:nowrap; }

/* Metodología */
.cono .an-origen{ border:1.5px solid var(--ink-15); border-left:4px solid var(--lime); border-radius:12px; background:var(--card); padding:16px 18px; }
.cono .an-reflist{ display:flex; flex-direction:column; gap:8px; margin-top:14px; }
.cono .an-refrow{ display:flex; flex-direction:column; gap:2px; padding:11px 14px; border:1.5px solid var(--ink-15); border-radius:10px; background:var(--card); }
.cono .an-refrow b{ font-family:var(--disp); font-size:15px; color:var(--ink); }
.cono .an-refrow span{ font-size:13px; color:var(--ink-60); line-height:1.5; }
.cono .an-trad{ margin-top:14px; border:1.5px solid var(--ink); border-radius:12px; overflow:hidden; box-shadow:var(--shadow-paste); }
.cono .an-trad-row{ display:grid; grid-template-columns:1fr 1fr; gap:0; font-size:14px; color:var(--ink-80); }
.cono .an-trad-row > span{ padding:12px 15px; border-top:1.5px solid var(--ink-15); }
.cono .an-trad-row > span:first-child{ border-right:1.5px solid var(--ink-15); color:var(--ink-60); }
.cono .an-trad-head{ background:var(--card-2); font-family:var(--mono); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink); font-weight:600; }
.cono .an-trad-head > span{ border-top:0; }
.cono .an-trad-head > span:first-child{ color:var(--ink); }

@media (max-width:680px){
  .cono .an-2col{ grid-template-columns:1fr; }
  .cono .an-opts{ grid-template-columns:1fr; }
  .cono .an-dims{ grid-template-columns:1fr; }
  .cono .an-journey{ gap:5px; }
  .cono .an-jsub{ display:none; }
  .cono .an-trad-row{ grid-template-columns:1fr; }
  .cono .an-trad-row > span:first-child{ border-right:0; }
  .cono .an-tab{ font-size:11.5px; padding:8px 12px; }
}
`;
