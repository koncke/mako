'use client';

// =============================================================================
// Meta — la Meta objetivo y la Acción del día, cada una su bloque
// =============================================================================
// Martín, 14/10/2026 (la tercera vuelta): «Rediseña completamente el grafico de "Objetivo" y "Acción del día", deben ser
// 2 gráficos diferentes... Y que el primero se llame "Meta objetivo". Y que no tenga un diseño dark... Los usuarios pueden
// elegir cambiarlo en la edición personalizada de cada bloque, pero por defecto tiene que ser como el resto».
//
// Eran UNA pieza (la cabecera oscura de ../Cabecera.tsx, con ../Ahora.tsx a la derecha) y desde acá son dos tarjetas de
// la hoja, claras, con los tokens de la casa: la isla oscura es la opción «Fondo: Oscuro» de cada bloque, que el editor
// aplica dando vuelta los tokens (app/dashboard/ElementoGeneral.tsx). Lo que NO cambió, y son decisiones de Martín del
// 08/09/2026 que no se rediscuten:
//   · la meta mide FACTURACIÓN (el OKR que manda: `objetivoQueManda`), con su barra y la MARCA DEL TIEMPO: si el relleno
//     pasó la marca, vas adelantado. Contesta «¿voy a tiempo?» sin una palabra.
//   · el ritmo dice «a esta altura», nunca «vas a llegar»: el prorrateo es LINEAL. La fecha estimada va rotulada.
//   · sin meta NO se inventa un número (el «?? 20» del hero viejo): va el placeholder y el control que la carga.
//   · la acción es `elegirFoco` y NUNCA el copy de una alerta (si no, el semáforo la repite); visible va sólo la RAZÓN, y
//     los otros cuatro campos del contrato (#523) se abren.
// ⚠️ La acción calla según el CAMPO (`foco.pideConfigurar === 'objetivo'`), nunca comparando el texto del botón
//    (tests/vista-general-modelo.test.ts).
// =============================================================================

import { useState } from 'react';
import { fmtUSD, fmtNum } from '@/lib/format';
import { METRICA_LABEL } from '@/lib/objectives-modelo';
import { ORIGEN_LABEL, type Foco } from '@/lib/focus';
import type { ObjectiveConAvance, CapacidadLeida } from '@/lib/objectives';
import { opcionDe, type OpcionesElegidas } from '@/lib/general-piezas';
import { LinkIntegracion } from '../../_components/ConectarIntegracion';
import { DesgloseTrigger, type DesgloseData } from '../../_components/Desglose';
import { EditarObjetivo, EditarCapacidad } from '../EditarObjetivo';
import type { DatosGeneral } from '../datos-tipos';
import { Cabeza, Fallo, Placeholder } from './comun';
import { META_MUESTRA, FOCO_MUESTRA } from './muestras';

type Cab = Extract<DatosGeneral['cabecera'], { ok: true }>['d'];

/** El valor de un objetivo, en su unidad. Sin abreviar: `US$127k` esconde precisión. */
const fmtValor = (n: number | null, unidad: string): string => (unidad === 'usd' ? fmtUSD(n) : n === null ? '—' : fmtNum(n));

// ── La Meta objetivo ────────────────────────────────────────────────────────────────────────────────────────────────

function CuerpoMeta({ c, detalle }: { c: Cab; detalle: string }) {
  const objetivo = c.objetivo!;
  // ⚠️ `pct` topea en 100 y `metaValor` puede ser 0 (se guarda con el campo vacío): sin la guarda, el número más grande
  //    del bloque es una división por cero.
  const metaOk = objetivo.metaValor > 0;
  const supera = metaOk && objetivo.actual !== null && objetivo.actual > objetivo.metaValor;
  const alDia = objetivo.ritmo?.alDia ?? true;
  const colorBarra = supera || alDia ? 'var(--good)' : 'var(--warn-fill)';
  const periodo = objetivo.quarter === null ? `${c.anio}` : `Q${c.quarter} ${c.anio}`;
  const completo = detalle !== 'simple';

  const numero = (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <span className="gb-num" style={{ fontSize: 'clamp(40px, 12cqi, 84px)', fontWeight: 750, lineHeight: 0.95, letterSpacing: '-0.035em', color: 'var(--ink)' }}>
        {fmtValor(objetivo.actual, objetivo.unidad)}
      </span>
      <span className="gb-num" style={{ fontSize: 'clamp(15px, 3.4cqi, 22px)', fontWeight: 500, color: 'var(--dim)' }}>
        {metaOk ? `de ${fmtValor(objetivo.metaValor, objetivo.unidad)}` : 'sin meta cargada'}
      </span>
    </span>
  );

  return (
    <>
      {/* Qué OKR es (se edita tocándolo) y cuál de las dos métricas de plata mide: «Facturación» a secas no distingue lo
          cobrado de lo firmado. */}
      <EditarObjetivo
        objetivo={{ id: objetivo.id, titulo: objetivo.titulo, metrica: objetivo.metrica, metaValor: objetivo.metaValor, quarter: objetivo.quarter, avanceManual: objetivo.avanceManual }}
        anio={c.anio} quarter={c.quarter}
        disparador={(
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'pointer', marginBottom: 12 }} title="Editar la meta">
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--dim)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{objetivo.titulo}</span>
            {objetivo.metrica !== 'libre' && <span className="gb-chip" style={{ flex: 'none' }}>{METRICA_LABEL[objetivo.metrica]}</span>}
          </span>
        )}
      />

      {c.desglose
        ? <DesgloseTrigger data={c.desglose} style={{ display: 'block', width: 'auto', cursor: 'pointer', textAlign: 'left' }}>{numero}</DesgloseTrigger>
        : numero}

      {metaOk && objetivo.actual !== null && (
        <div style={{ marginTop: 18 }}>
          {/* La barra ES el dato y la marca vertical es el tiempo. Recortada al 100% y con marca de corte: una barra llena
              que no avisa que se pasó afirma «llegaste justo». */}
          <div aria-hidden style={{ position: 'relative', height: 14, borderRadius: 999, background: 'var(--gb-losa-2)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, objetivo.pct ?? 0)}%`, height: '100%', borderRadius: 999, background: colorBarra }} />
            {supera && <span style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 5, background: 'repeating-linear-gradient(135deg, var(--ink) 0 2px, transparent 2px 4px)', opacity: 0.6 }} />}
            <span style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(100, c.fraccion * 100)}%`, width: 2, background: 'var(--ink)', opacity: 0.45 }} />
          </div>
          {completo && <Ritmo objetivo={objetivo} supera={supera} periodo={periodo} />}
        </div>
      )}

      {objetivo.actual === null && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--warn)' }}>
          {objetivo.metrica === 'libre' ? 'Este objetivo lo mides tú y todavía no cargaste el avance.' : `No pude leer el avance${objetivo.error ? `: ${objetivo.error}` : '.'}`}
        </p>
      )}

      {completo && (
        <div style={{ marginTop: 'auto', paddingTop: 14, display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--dim)' }}>
          <span className="gb-num">{periodo} · {c.progreso.diasRestantes === 0 ? 'último día' : `quedan ${c.progreso.diasRestantes} días`}</span>
          {c.complemento && <Complemento c={c.complemento} />}
          <Capacidad capacidad={c.capacidad} />
        </div>
      )}
    </>
  );
}

/** El ritmo, en una frase: «a esta altura», nunca «vas a llegar» (el prorrateo es lineal). */
function Ritmo({ objetivo, supera, periodo }: { objetivo: ObjectiveConAvance; supera: boolean; periodo: string }) {
  const r = objetivo.ritmo;
  const fuerte = { color: 'var(--ink)', fontWeight: 600 } as const;
  let texto: React.ReactNode;
  if (supera) texto = <>Meta superada: <strong style={fuerte}>{fmtValor(objetivo.actual, objetivo.unidad)}</strong></>;
  else if (r === null || r.desvioPct === null) texto = <>{periodo} recién arranca: todavía no hay ritmo</>;
  else {
    const delta = fmtValor(Math.abs(r.desvio), objetivo.unidad);
    texto = r.alDia
      ? <>Vas <strong style={fuerte}>{delta} arriba</strong> de lo esperado a esta altura</>
      : <>Vas <strong style={fuerte}>{delta} abajo</strong> de lo esperado a esta altura</>;
  }
  return (
    <p style={{ margin: '10px 0 0', fontSize: 'clamp(13.5px, 2.6cqi, 16px)', lineHeight: 1.45, color: 'var(--dim)' }}>
      {texto}
      {r?.llegadaEstimada && !supera && <span> · estimado: llegas el {r.llegadaEstimada.split('-').reverse().join('/')}</span>}
    </p>
  );
}

/** La otra métrica de plata del mismo período (firmado si el objetivo es cobrado, y al revés). */
function Complemento({ c }: { c: { label: string; valor: string; pie: string; desglose: DesgloseData | null } }) {
  const inner = <span>{c.label} <b className="gb-num" style={{ color: 'var(--ink)' }}>{c.valor}</b></span>;
  return c.desglose ? <DesgloseTrigger data={c.desglose} style={{ display: 'inline', cursor: 'pointer' }}>{inner}</DesgloseTrigger> : inner;
}

/**
 * La capacidad instalada. «No pude contarlos» NO es «cero clientes»: con la lectura caída `activos` vale 0 y `libres`
 * null, y pintar ese cero diría «tienes todo el lugar libre» justo donde se decide si vender más.
 */
function Capacidad({ capacidad }: { capacidad: CapacidadLeida }) {
  return (
    <EditarCapacidad cupo={capacidad.cupo} mesesEntrega={capacidad.mesesEntrega} disparador={(
      <span style={{ cursor: 'pointer' }}>
        {capacidad.error ? 'clientes: no pude contarlos'
          : capacidad.cupo === null ? <>{capacidad.activos} clientes · <span style={{ color: 'var(--primary)' }}>define tu cupo</span></>
          : <span className="gb-num"><b style={{ color: 'var(--ink)' }}>{capacidad.activos}</b>/{capacidad.cupo} clientes{capacidad.libres === 0 ? <span style={{ color: 'var(--warn)' }}> · sin lugar</span> : ` · ${capacidad.libres} libres`}</span>}
      </span>
    )} />
  );
}

const CargarMeta = ({ c, rotulo = 'Cargar la meta' }: { c: Pick<Cab, 'anio' | 'quarter'>; rotulo?: string }) => (
  <EditarObjetivo objetivo={null} anio={c.anio} quarter={c.quarter} disparador={<span className="gb-boton">{rotulo}</span>} />
);

export function BloqueMetaObjetivo({ d, op }: { d: DatosGeneral['cabecera']; op?: OpcionesElegidas }) {
  if (!d.ok) return <Fallo titulo="Meta objetivo" error={d.error} />;
  const detalle = opcionDe('cabecera', op, 'detalle');
  const c = d.d;
  return (
    <div className="gb">
      <Cabeza titulo="Meta objetivo" />
      {c.objetivo
        ? <CuerpoMeta c={c} detalle={detalle} />
        : <Placeholder muestra={<CuerpoMeta c={{ ...c, ...META_MUESTRA }} detalle={detalle} />} texto="Sin una meta no puedo decirte si vas bien." accion={<CargarMeta c={c} />} />}
    </div>
  );
}

export function MuestraMetaObjetivo({ d, op }: { d: DatosGeneral['cabecera']; op?: OpcionesElegidas }) {
  const base = d.ok ? d.d : null;
  return (
    <div className="gb">
      <Cabeza titulo="Meta objetivo" />
      {base?.objetivo ? <CuerpoMeta c={base} detalle={opcionDe('cabecera', op, 'detalle')} /> : base ? <CuerpoMeta c={{ ...base, ...META_MUESTRA }} detalle="completo" /> : null}
    </div>
  );
}

// ── La Acción del día ───────────────────────────────────────────────────────────────────────────────────────────────

/** El nivel se lee en un punto, no en un filete ni en un fondo de color: no convertir cada señal en una alarma. */
const COLOR: Record<Foco['nivel'], string> = { rojo: 'var(--bad)', ambar: 'var(--warn-fill)', neutro: 'var(--good)' };

function CuerpoAccion({ foco, conRazon }: { foco: Foco; conRazon: boolean }) {
  const [abierto, setAbierto] = useState(false);
  // Centrada en el alto (`gb-centro`): al lado de la Meta objetivo mide lo mismo que ella, y pegada arriba dejaba un
  // hueco del tercio de la tarjeta abajo del botón (la captura de la quinta vuelta).
  return (
    <div className="gb-centro">
      <p style={{ display: 'flex', alignItems: 'flex-start', gap: 12, margin: 0, fontSize: 'clamp(24px, 6.4cqi, 40px)', fontWeight: 700, lineHeight: 1.18, letterSpacing: '-0.022em', color: 'var(--ink)' }}>
        <span aria-hidden style={{ flex: 'none', width: 12, height: 12, borderRadius: '50%', background: COLOR[foco.nivel], marginTop: '0.4em' }} />
        <span style={{ minWidth: 0 }}>{foco.accion}</span>
      </p>
      {conRazon && <p style={{ margin: '12px 0 0', paddingLeft: 24, fontSize: 'clamp(14.5px, 3cqi, 18px)', lineHeight: 1.45, color: 'var(--dim)' }}>{foco.razon}</p>}
      {/* El botón va pegado a la razón, no al pie: abajo de todo dejaba un hueco del alto de la tarjeta en el medio. */}
      <div style={{ paddingTop: 16, paddingLeft: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {/* Si la acción nombra una integración (`/integraciones?abrir=…`), abre su modal acá: nunca se sale de la tab. */}
        <LinkIntegracion href={foco.href} className="gb-boton">{foco.hrefLabel} →</LinkIntegracion>
        <button type="button" className="gb-cab-link" style={{ marginLeft: 0, color: 'var(--dim)', fontWeight: 500 }} onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
          {abierto ? 'Ocultar el detalle' : 'Por qué esta y no otra'}
        </button>
      </div>
      {abierto && (
        <dl style={{ margin: '12px 0 0 20px', padding: '12px 0 0', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 14px', fontSize: 13, lineHeight: 1.45 }}>
          <dt style={{ color: 'var(--dim)' }}>Sale de</dt><dd style={{ margin: 0 }}>{ORIGEN_LABEL[foco.origen]}</dd>
          <dt style={{ color: 'var(--dim)' }}>Debería mover</dt><dd style={{ margin: 0 }}>{foco.resultadoEsperado}</dd>
          <dt style={{ color: 'var(--dim)' }}>Quién</dt><dd style={{ margin: 0 }}>{foco.responsable}</dd>
          {foco.progreso && (<><dt style={{ color: 'var(--dim)' }}>Progreso</dt><dd style={{ margin: 0 }}>{foco.progreso}</dd></>)}
          <dt style={{ color: 'var(--dim)' }}>Se revisa</dt><dd style={{ margin: 0 }}>{foco.siguienteRevision}</dd>
        </dl>
      )}
    </div>
  );
}

export function BloqueAccion({ d, op }: { d: DatosGeneral['cabecera']; op?: OpcionesElegidas }) {
  if (!d.ok) return <Fallo titulo="Acción del día" error={d.error} />;
  const conRazon = opcionDe('accion', op, 'razon') === 'si';
  const { foco } = d.d;
  return (
    <div className="gb">
      <Cabeza titulo="Acción del día" />
      {/* Cuando lo que falta es la meta, la acción no tiene de dónde salir: el placeholder pide cargarla, que es lo
          mismo que pide la Meta objetivo. */}
      {foco.pideConfigurar === 'objetivo'
        ? <Placeholder muestra={<CuerpoAccion foco={FOCO_MUESTRA} conRazon={conRazon} />} texto="Con tu meta cargada, aquí va qué hacer hoy." accion={<CargarMeta c={d.d} />} />
        : <CuerpoAccion foco={foco} conRazon={conRazon} />}
    </div>
  );
}

export function MuestraAccion({ op }: { op?: OpcionesElegidas }) {
  return (
    <div className="gb">
      <Cabeza titulo="Acción del día" />
      <CuerpoAccion foco={FOCO_MUESTRA} conRazon={opcionDe('accion', op, 'razon') === 'si'} />
    </div>
  );
}
