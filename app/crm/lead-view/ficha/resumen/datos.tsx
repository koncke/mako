'use client';

// =============================================================================
// ficha/resumen/datos — los datos de un vistazo del Resumen: el ingreso estimado, el setter y el closer, cuánto lleva
// en la etapa, el motivo de salida y el plazo de la nutrición manual
// =============================================================================
// LA REFERENCIA: los HIGHLIGHTS de Attio (la tab Overview abre con hasta seis datos, cada uno con su rótulo chico y el
// valor grande; documentación oficial, «Configure record pages»). Cada bloque es UN dato que se lee de un vistazo y se
// corrige en el lugar con los campos de la ficha (../../CampoEditable.tsx: guardan, dejan el historial y «Deshacer»).
// ÉPICO (General y MaKo Mobile v3): el dato es el protagonista; sin la metadata.
//
// Reemplaza a MotivoYPlazoCard (el motivo y el plazo) y a las filas del ingreso de InfoPrincipalCard en la ficha del CRM.
// El setter y el closer y el tiempo en la etapa no tenían tarjeta en el Resumen: vivían en la reunión (sólo con etapa de
// reunión) y en el aviso del lead quieto.
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import { marcaDato } from '@/lib/datos-aviso';
import { motivoFinalDe, motivosDeSalida } from '@/app/crm/motivos-salida';
import { CajaCampo, FechaEditable, MontoEditable, PersonaEditable, TextoEditable, useGuardarCampo } from '../../CampoEditable';
import { Toast } from '@/app/_ui/Toast';
import type { PropsBloque } from '../tipos';
import { tiempoEnEtapaAction } from './bloques-actions';
import { diasEntre, textoDias, tiempoEnEtapa, type EnEtapa } from './logica';
import { Bloque, Prop } from './piezas';

/** El tamaño del protagonista épico, para los campos que llevan su letra en `estilo` (el monto, la fecha). */
const PROTAGONISTA: CSSProperties = { fontSize: 'clamp(36px, 2.4vw + 18px, 64px)', fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1 };
const NUMERO: CSSProperties = { fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.1 };

// ── Ingreso estimado ─────────────────────────────────────────────────────────

/** Lo que se cree que vale el lead mientras está abierto, en USD. No es una venta (en un ganado se calla). */
export function IngresoEstimado({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { lead } = ctx;
  const valor = lead.ingreso_estimado ?? null;
  const campo = (estilo?: CSSProperties) => <MontoEditable leadId={lead.id} campo="ingreso_estimado" valor={valor} titulo="Ingreso estimado del lead, en dólares" estilo={estilo} />;
  if (diseno === 'fila' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false}>
        <div className="fr-props"><Prop k="En USD" editable>{campo()}</Prop></div>
      </Bloque>
    );
  }
  return (
    <Bloque titulo={titulo} epico={epico}>
      <CajaCampo style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {campo(epico ? PROTAGONISTA : NUMERO)}
        {!epico && <span className="fr-sub">En dólares · no es una venta</span>}
      </CajaCampo>
    </Bloque>
  );
}

// ── Setter y closer ──────────────────────────────────────────────────────────

/** Quién le escribe y quién le vende. Si la grabación detectó un closer, lo sugiere (el «de Fathom» de la reunión). */
export function SetterYCloser({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { lead, data } = ctx;
  const equipo = data.equipo ?? [];
  const hintCloser = data.closerDetectado && !lead.closer ? `${data.closerDetectado} (de Fathom)` : undefined;
  // La foto la pone el desplegable del equipo al lado del nombre (`opcionesEquipo`): una segunda cara sería repetirla.
  const persona = (campo: 'setter' | 'closer') => (
    <span className="fr-persona"><PersonaEditable leadId={lead.id} campo={campo} valor={lead[campo] ?? null} equipo={equipo} hint={campo === 'closer' ? hintCloser : undefined} /></span>
  );
  if (diseno === 'renglon' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false}>
        <div className="fr-props">
          <Prop k="Setter" editable marca={marcaDato('setter')}>{persona('setter')}</Prop>
          <Prop k="Closer" editable marca={marcaDato('closer')}>{persona('closer')}</Prop>
        </div>
      </Bloque>
    );
  }
  if (diseno === 'chips' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false}>
        <div className="fr-chips">
          {(['setter', 'closer'] as const).map((c) => (
            <CajaCampo key={c} marca={marcaDato(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', maxWidth: '100%' }}>
              <span className="fr-sub" style={{ flex: 'none' }}>{c === 'setter' ? 'Setter' : 'Closer'}</span>
              {persona(c)}
            </CajaCampo>
          ))}
        </div>
      </Bloque>
    );
  }
  return (
    <Bloque titulo={titulo} epico={epico}>
      <div className="fr-dos">
        {(['setter', 'closer'] as const).map((c) => (
          <CajaCampo key={c} marca={marcaDato(c)} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, padding: epico ? '16px 18px' : '10px 12px', borderRadius: 12, background: 'color-mix(in srgb, var(--ink) 4.5%, transparent)' }}>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
              <span className="fr-sub">{c === 'setter' ? 'Setter' : 'Closer'}</span>
              <span style={{ minWidth: 0 }}>{persona(c)}</span>
            </span>
          </CajaCampo>
        ))}
      </div>
    </Bloque>
  );
}

// ── Tiempo en la etapa ───────────────────────────────────────────────────────

/**
 * «N días en <etapa>» contra el plazo de la etapa (§3). Lo lee del historial al montarse (`tiempoEnEtapaAction`: no
 * viene en la ficha). Sin historial dice «Sin registro» y no inventa un número (la regla de lib/lead-quieto.ts).
 */
export function TiempoEnEtapa({ ctx, titulo, diseno, epico }: PropsBloque) {
  // `ahora` se toma cuando llega la lectura (no al dibujar: un render tiene que ser puro, react-hooks/purity).
  const [leido, setLeido] = useState<{ etapa: string; desde: string | null; plazo: number | null; ahora: number } | null | 'cargando'>('cargando');
  useEffect(() => {
    let vivo = true;
    void tiempoEnEtapaAction(ctx.lead.id).then((r) => { if (vivo) setLeido(r ? { ...r, ahora: Date.now() } : null); }).catch(() => { if (vivo) setLeido(null); });
    return () => { vivo = false; };
    // La etapa cambia con un movimiento: se vuelve a leer (el reloj arranca de nuevo).
  }, [ctx.lead.id, ctx.etapa]);
  const etapa = ctx.stages.find((s) => s.key === ctx.etapa)?.label ?? ctx.etapa;
  if (leido === 'cargando') return <Bloque titulo={titulo} epico={epico}><span className="fr-sub">Cargando…</span></Bloque>;
  const t: EnEtapa | null = leido ? tiempoEnEtapa(leido.desde, leido.plazo, leido.ahora) : null;
  if (!t) {
    return (
      <Bloque titulo={titulo} epico={epico}>
        <span className={epico ? 'fr-p' : 'fr-num'} style={{ color: 'var(--faint)' }}>—</span>
        <span className="fr-sub">Sin registro de cuándo entró a {etapa}.</span>
      </Bloque>
    );
  }
  const color = t.tono === 'rojo' ? 'var(--bad)' : t.tono === 'ambar' ? 'var(--warn)' : t.tono === 'verde' ? 'var(--good)' : 'var(--ink)';
  const dias = t.dias === 0 ? 'Hoy' : textoDias(t.dias);
  if (diseno === 'chip' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false}>
        <span className="fr-chip" style={{ alignSelf: 'flex-start' }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: t.tono === 'gris' ? 'var(--dim)' : color, flex: 'none' }} />
          {dias} en {etapa}
        </span>
        {t.plazo && <span className="fr-sub">Plazo de la etapa: {textoDias(t.plazo)}</span>}
      </Bloque>
    );
  }
  if (diseno === 'barra' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false}>
        <span style={{ fontSize: 15, fontWeight: 650 }}>{t.plazo ? `${t.dias} de ${textoDias(t.plazo)}` : dias} <span className="fr-sub" style={{ fontWeight: 500 }}>en {etapa}</span></span>
        <div className="fr-barra" data-tono={t.tono} aria-hidden><span style={{ width: `${t.pct ?? 100}%` }} /></div>
        {!t.plazo && <span className="fr-sub">La etapa no tiene plazo.</span>}
      </Bloque>
    );
  }
  return (
    <Bloque titulo={titulo} epico={epico}>
      <span className={epico ? 'fr-p' : 'fr-num'} style={{ color: t.tono === 'gris' ? undefined : color }}>{dias}</span>
      <span className="fr-sub">en {etapa}{!epico && t.plazo ? ` · plazo ${textoDias(t.plazo)}` : ''}</span>
    </Bloque>
  );
}

// ── Motivo de salida ─────────────────────────────────────────────────────────

/**
 * Por qué se perdió o se descalificó, corregible en el lugar. Se dibuja aunque esté vacío: el lead perdido sin motivo es
 * justo el que hay que completar. «Chips y texto» suma las categorías de la salida (las del wizard de la etapa,
 * app/crm/motivos-salida.ts): tocar una reescribe la categoría y conserva el detalle.
 */
export function MotivoDeSalida({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { lead } = ctx;
  const motivo = lead.motivo_perdida ?? null;
  const { guardar, toast, clear } = useGuardarCampo(lead.id, 'motivo_perdida');
  const cats = motivosDeSalida(lead.estado_lead === 'descalificado' ? 'descal' : 'perdido');
  const cat = cats.find((c) => motivo === c || motivo?.startsWith(`${c} — `)) ?? null;
  const detalle = cat ? (motivo ?? '').slice(cat.length).replace(/^ — /, '') : (motivo ?? '');
  return (
    <Bloque titulo={titulo} epico={epico}>
      {diseno === 'chips' && (
        <span className="fr-seg" role="group" aria-label="Motivo">
          {cats.map((c) => (
            <button key={c} type="button" aria-pressed={c === cat} onClick={() => {
              const nuevo = c === cat ? (detalle.trim() || null) : motivoFinalDe(c, detalle);
              if (nuevo !== motivo) guardar(nuevo, motivo);
            }}>{c}</button>
          ))}
        </span>
      )}
      <CajaCampo marca={marcaDato('motivo')} style={{ fontSize: epico ? undefined : 14.5, lineHeight: 1.5 }}>
        <div className={epico ? 'fr-frase' : undefined}>
          <TextoEditable leadId={lead.id} campo="motivo_perdida" valor={motivo} titulo="Motivo de salida" placeholder="Por qué se perdió" />
        </div>
      </CajaCampo>
      <Toast state={toast} onClose={clear} />
    </Bloque>
  );
}

// ── Plazo de la nutrición manual ─────────────────────────────────────────────

/**
 * Hasta cuándo se lo sigue a mano. Sólo en la etapa de nutrición manual. NO se puede vaciar (el candado es del server,
 * `valorDeCampo`): de esa fecha cuelga el aviso de la nutrición vencida. «Cuenta regresiva» dice cuánto falta.
 */
export function PlazoNutricion({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { lead, hoy } = ctx;
  const d = lead.nutricion_manual_deadline ?? null;
  const dias = d ? diasEntre(hoy, d) : null;
  const cuenta = dias == null ? 'Sin plazo' : dias === 0 ? 'Vence hoy' : dias > 0 ? `Faltan ${textoDias(dias)}` : `Venció hace ${textoDias(-dias)}`;
  const color = dias == null || dias < 0 ? 'var(--bad)' : dias <= 2 ? 'var(--warn)' : 'var(--ink)';
  const fecha = (estilo: CSSProperties) => (
    <FechaEditable leadId={lead.id} campo="nutricion_manual_deadline" valor={d} titulo="Fecha límite de la nutrición manual" vacio="sin plazo"
      estilo={{ ...estilo, color: d ? 'var(--ink)' : 'var(--bad)' }} />
  );
  if (diseno === 'cuenta' || epico) {
    return (
      <Bloque titulo={titulo} epico={epico}>
        <span className={epico ? 'fr-p' : 'fr-num'} style={{ color }}>{cuenta}</span>
        <CajaCampo style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span className="fr-sub">Hasta el</span>{fecha({ fontSize: 14.5, fontWeight: 650 })}
        </CajaCampo>
      </Bloque>
    );
  }
  return (
    <Bloque titulo={titulo} epico={false}>
      <CajaCampo style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {fecha(NUMERO)}
        <span className="fr-sub" style={{ color: dias != null && dias < 0 ? 'var(--bad)' : undefined }}>{d ? cuenta : 'Si vence sin que avance, vuelve a datos sin marcar.'}</span>
      </CajaCampo>
    </Bloque>
  );
}
