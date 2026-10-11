// =============================================================================
// ValoracionGuion — lo que MaKo dice de un guion que todavía no corrió en Meta
// =============================================================================
// Se mudó de app/ads-analyst/ScriptsBrowser.tsx el 11/10/2026, con la tarea «Analiza un guion nuevo»
// (decisión de Martín: lo de Ads Analyst que EJECUTA va a Ads Writer; lo que es análisis, a la hoja
// «Ads Analyst» del Dashboard). El dibujo es el mismo, línea por línea: lo que cambió es de dónde sale
// el color del ángulo.
//
// ⚠️ EL ÁNGULO LLEGA POR PROP (`angulo`), NO POR UN MAPA DE MÓDULO. ScriptsBrowser pinta los ángulos
// con un `let ANGLE` que `applyAngles` pisa en cada render: sirve mientras una sola pantalla lo use, y
// acá lo usan dos (Ads Writer y lo que quede de ScriptsBrowser). Con la función por prop, cada una
// trae su vocabulario y ninguna depende del orden en que se dibujaron.
//
// ⚠️ UNA SOLA COPIA. ScriptsBrowser importa de acá `BLOQUES_GUION`, `chipBloque`, `rgba`,
// `VEREDICTO_VALORACION` y `ValoracionView`: la ficha de un anuncio del Ads Manager (FunnelModal, vía
// app/marketing/ad-charts.tsx) pinta los bloques con estos mismos colores. Cambiar uno acá lo cambia
// en las dos pantallas, que es lo que se quiere.
//
// Sin 'use client' y sin hooks: lo importan dos módulos de cliente, y no exporta nada que un server
// tenga que USAR (AGENTS.md, «'use client' es una frontera de DATOS»).
// =============================================================================

import type { CSSProperties } from 'react';
import type { Valoracion } from '@/lib/ads-analyst';
import { fmtUSD } from '@/lib/ads-analyst-patrones';
import { MONO } from '@/app/_ui/tokens';

/** Un color #RRGGBB con transparencia. Los colores de ángulo llegan saneados a 6 dígitos (lib/script-angles.ts). */
export function rgba(hex: string, a: number): string {
  const n = hex.replace('#', '');
  return `rgba(${parseInt(n.substring(0, 2), 16)},${parseInt(n.substring(2, 4), 16)},${parseInt(n.substring(4, 6), 16)},${a})`;
}

/** Los tipos de bloque de un guion (BEAT_KINDS de lib/ads-analyst.ts), con su rótulo y su color. */
export const BLOQUES_GUION: Record<string, { label: string; c: string }> = {
  gancho: { label: 'Gancho', c: '#C8870C' }, contexto: { label: 'Contexto', c: '#B5742A' }, problema: { label: 'Problema', c: '#D0504A' },
  mecanismo: { label: 'Mecanismo', c: '#2F6DDB' }, prueba: { label: 'Prueba', c: '#3B6D11' }, objecion: { label: 'Objeción', c: '#A8770F' },
  recordatorio: { label: 'Recordatorio', c: '#7C4DD6' }, oferta: { label: 'Oferta + CTA', c: '#7C4DD6' }, cta: { label: 'CTA', c: '#0E8E7E' },
};

/** El chip de un tipo de bloque. Uno desconocido sale gris con su clave. */
export function chipBloque(k: string): CSSProperties {
  const x = BLOQUES_GUION[k] ?? { label: k, c: '#6B675C' };
  return { display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, fontFamily: MONO, letterSpacing: '.05em', textTransform: 'uppercase', background: rgba(x.c, .12), color: x.c, border: `1px solid ${rgba(x.c, .28)}` };
}

/** Los cinco veredictos de una valoración (VERDICTOS_VALORAR de lib/ads-analyst.ts), con su rótulo y su color. */
export const VEREDICTO_VALORACION: Record<string, { label: string; c: string }> = {
  'escalar-candidato': { label: 'Candidato a escalar', c: '#1E9E57' },
  'mejorar-gancho': { label: 'Mejorar gancho', c: '#2F6DDB' },
  'reescribir-cuerpo': { label: 'Reescribir cuerpo', c: '#9A6A09' },
  'repensar-angulo': { label: 'Repensar ángulo', c: '#D0504A' },
  'promesa-pero-validar': { label: 'Promesa — validar', c: '#6B675C' },
};

/** El rótulo y el color de un veredicto; uno que no está en la lista sale gris con su clave. */
export function veredictoDe(k: string | null | undefined): { label: string; c: string } {
  return VEREDICTO_VALORACION[k ?? ''] ?? { label: k || '—', c: '#6B675C' };
}

/** De una clave de ángulo a su nombre y su color, con el vocabulario de quien dibuja. */
export type InfoAngulo = (k: string) => { label: string; c: string };

function chipAngulo(c: string): CSSProperties {
  return { display: 'inline-block', fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 6, fontFamily: MONO, letterSpacing: '.04em', background: rgba(c, .12), color: c, border: `1px solid ${rgba(c, .3)}` };
}

function Chip({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 11px' }}><span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}</span><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{value}</span></div>;
}

function PatList({ title, color, items }: { title: string; color: string; items: Array<{ patron: string; evidencia: string }> }) {
  if (!items.length) return null;
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px' }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{items.map((it, i) => (<div key={i}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{it.patron}</div><div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.4 }}>{it.evidencia}</div></div>))}</div>
    </div>
  );
}

/** La valoración entera: aviso de «predicción sin datos», clasificación, bloques, patrones, qué probar y el plan. */
export function ValoracionView({ v, angulo }: { v: Valoracion; angulo: InfoAngulo }) {
  const vv = veredictoDe(v.prediccion.verdicto);
  const sat = v.perfil.angulo_saturado && v.clasificacion.angle === v.perfil.angulo_saturado;
  const ang = angulo(v.clasificacion.angle);
  return (
    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 12, padding: '13px 15px' }}>
        <span style={{ flex: 'none', color: '#7A5908', fontWeight: 700, fontSize: 15 }}>!</span>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#5A4408' }}>Predicción sin datos. Este guion no corrió en Meta; abajo es lo que MaKo espera comparándolo con tus {v.perfil.n_total} guiones reales ({v.perfil.n_confiables} con señal suficiente).</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <span style={chipAngulo(ang.c)}>{ang.label}</span>
        {sat && <span style={{ fontSize: 11, color: 'var(--bad)' }}>ángulo ya saturado en tu cuenta</span>}
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--dim)' }}>{v.clasificacion.hook_type} · {v.clasificacion.format}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-block', fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 999, background: rgba(vv.c, .1), color: vv.c, border: `1px solid ${rgba(vv.c, .32)}` }}>{vv.label}</span>
      </div>
      {v.clasificacion.tags.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{v.clasificacion.tags.map((t) => <span key={t} style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>{t}</span>)}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip label="Hook (est.)" value={`${v.prediccion.hook_rate_estimado.min}–${v.prediccion.hook_rate_estimado.max}%`} />
        <Chip label="Ret. CTA (est.)" value={`${v.prediccion.retencion_cta_estimada.min}–${v.prediccion.retencion_cta_estimada.max}%`} />
        <Chip label="Confianza" value="Sin dato real" />
      </div>
      <div style={{ background: rgba(vv.c, .06), border: `1px solid ${rgba(vv.c, .26)}`, borderRadius: 13, padding: '16px 18px' }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: vv.c, marginBottom: 8 }}>{v.lectura_estructural.title}</div>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>{v.lectura_estructural.text}</div>
        {v.prediccion.razon && <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)', marginTop: 8 }}>{v.prediccion.razon}</div>}
      </div>
      {v.beats.length > 0 && (
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>El guion en bloques</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {v.beats.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderLeft: `3px solid ${(BLOQUES_GUION[b.kind]?.c) || '#6B675C'}`, paddingLeft: 12 }}>
                <span style={chipBloque(b.kind)}>{BLOQUES_GUION[b.kind]?.label || b.kind}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>{b.text}</div>
                  {v.lectura_estructural.punto_de_fuga?.beat_index === i && <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 3 }}>▼ punto de fuga: {v.lectura_estructural.punto_de_fuga.motivo}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(v.patrones_match.length > 0 || v.patrones_miss.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
          <PatList title="Cumple" color="#1E9E57" items={v.patrones_match} />
          <PatList title="Se pierde / reproduce" color="#D0504A" items={v.patrones_miss} />
        </div>
      )}
      {v.reescrituras.length > 0 && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A6A09', marginBottom: 10 }}>Qué probar</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{v.reescrituras.map((r, i) => (<div key={i}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{r.que_cambiar}</div><div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5 }}>{r.propuesta}</div></div>))}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'rgba(30,158,87,.06)', border: '1px solid rgba(30,158,87,.26)', borderRadius: 13, padding: '14px 16px' }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#1E9E57' }}>Plan de validación</span>
        <Chip label="Presupuesto" value={fmtUSD(v.plan_validacion.presupuesto_usd)} />
        <Chip label="Días" value={String(v.plan_validacion.dias_minimos)} />
        <Chip label="Impresiones" value={v.plan_validacion.impresiones_objetivo.toLocaleString('en-US')} />
        {v.plan_validacion.control && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>control: {v.plan_validacion.control}</span>}
        {v.plan_validacion.nota && <div style={{ flexBasis: '100%', fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>{v.plan_validacion.nota}</div>}
      </div>
    </div>
  );
}
