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
import { Cabeza, DeQueFunnels, Fallo, Placeholder } from './comun';
import { META_MUESTRA, FOCO_MUESTRA } from './muestras';

type Cab = Extract<DatosGeneral['cabecera'], { ok: true }>['d'];

/** El valor de un objetivo, en su unidad. Sin abreviar: `US$127k` esconde precisión. */
const fmtValor = (n: number | null, unidad: string): string => (unidad === 'usd' ? fmtUSD(n) : n === null ? '—' : fmtNum(n));

// ── La Meta objetivo ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * El anillo de la meta (el del teléfono, docs/prototipos/mako-mobile-tableros.html): el aro grueso es el AVANCE y el
 * fino de adentro es el TIEMPO corrido del período. Si el grueso le gana al fino, vas adelantado: contesta «¿voy a
 * tiempo?» sin una palabra (la marca del tiempo de la barra de antes, decisión del 08/09/2026). Mide contra la tarjeta.
 */
function AnilloMeta({ pct, fraccion, color }: { pct: number; fraccion: number; color: string }) {
  const R = 50, r = 38;
  const C = 2 * Math.PI * R, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 120 120" aria-hidden style={{ flex: 'none', display: 'block', width: 'clamp(104px, calc(30cqi - 10px), 230px)', height: 'auto', transform: 'rotate(-90deg)' }}>
      <circle cx={60} cy={60} r={R} fill="none" stroke="var(--gb-losa-2)" strokeWidth={11} />
      <circle cx={60} cy={60} r={r} fill="none" stroke="var(--ink)" strokeOpacity={0.28} strokeWidth={3} strokeLinecap="round" strokeDasharray={`${Math.max(0, Math.min(1, fraccion)) * c} ${c}`} />
      <circle cx={60} cy={60} r={R} fill="none" stroke={color} strokeWidth={11} strokeLinecap="round" strokeDasharray={`${(v / 100) * C} ${C}`} />
      <text x={60} y={61} transform="rotate(90 60 60)" textAnchor="middle" dominantBaseline="middle" fontSize={26} fontWeight={800} fill="var(--ink)" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{Math.round(v)}%</text>
    </svg>
  );
}

function CuerpoMeta({ c, detalle }: { c: Cab; detalle: string }) {
  const objetivo = c.objetivo!;
  // ⚠️ `pct` topea en 100 y `metaValor` puede ser 0 (se guarda con el campo vacío): sin la guarda, el número más grande
  //    del bloque es una división por cero.
  const metaOk = objetivo.metaValor > 0;
  const supera = metaOk && objetivo.actual !== null && objetivo.actual > objetivo.metaValor;
  const alDia = objetivo.ritmo?.alDia ?? true;
  const color = supera || alDia ? 'var(--good)' : 'var(--warn-fill)';
  const periodo = objetivo.quarter === null ? `${c.anio}` : `Q${c.quarter} ${c.anio}`;
  const completo = detalle === 'completo';

  const numero = <span className="gb-p" style={{ display: 'block' }}>{fmtValor(objetivo.actual, objetivo.unidad)}</span>;

  return (
    <div className="gb-centro">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px, calc(6cqi - 4px), 48px)', minWidth: 0 }}>
        {metaOk && objetivo.actual !== null && <AnilloMeta pct={objetivo.pct ?? 0} fraccion={c.fraccion} color={color} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 1.4cqi, 12px)', minWidth: 0 }}>
          {c.desglose
            ? <DesgloseTrigger data={c.desglose} style={{ display: 'block', width: 'auto', cursor: 'pointer', textAlign: 'left' }}>{numero}</DesgloseTrigger>
            : numero}
          {/* «de $30,000 · Q4 2026»: la meta, y tocándola se edita (el OKR que manda, con su métrica de plata). */}
          <EditarObjetivo
            objetivo={{ id: objetivo.id, titulo: objetivo.titulo, metrica: objetivo.metrica, metaValor: objetivo.metaValor, quarter: objetivo.quarter, avanceManual: objetivo.avanceManual, funnelIds: objetivo.funnelIds }}
            anio={c.anio} quarter={c.quarter}
            disparador={(
              <span className="gb-d gb-num" style={{ cursor: 'pointer' }} title={`Editar la meta: ${objetivo.titulo}${objetivo.metrica !== 'libre' ? ` (${METRICA_LABEL[objetivo.metrica]})` : ''}`}>
                {metaOk ? `de ${fmtValor(objetivo.metaValor, objetivo.unidad)}` : 'sin meta cargada'} · {periodo}
              </span>
            )}
          />
          {objetivo.funnelIds.length > 0 && <span><DeQueFunnels ids={objetivo.funnelIds} /></span>}
          {metaOk && objetivo.actual !== null && <Ritmo objetivo={objetivo} supera={supera} />}
          {objetivo.actual === null && (
            <span className="gb-d" style={{ color: 'var(--warn)' }}>
              {objetivo.metrica === 'libre' ? 'Este objetivo lo mides tú y todavía no cargaste el avance.' : `No pude leer el avance${objetivo.error ? `: ${objetivo.error}` : '.'}`}
            </span>
          )}
        </div>
      </div>

      {/* Con «Qué muestra: Con el detalle», el pie de antes: los días que quedan, la otra métrica de plata y el cupo. */}
      {completo && (
        <div style={{ marginTop: 'clamp(14px, 3cqi, 24px)', display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--dim)' }}>
          <span className="gb-num">{c.progreso.diasRestantes === 0 ? 'último día' : `quedan ${c.progreso.diasRestantes} días`}</span>
          {c.complemento && <Complemento c={c.complemento} />}
          <Capacidad capacidad={c.capacidad} />
        </div>
      )}
    </div>
  );
}

/**
 * El ritmo, en una línea con su flecha (el delta del teléfono): «a esta altura», nunca «vas a llegar» (el prorrateo es
 * lineal). Sin el «estimado: llegas el…» de antes: es una de las líneas que el teléfono sacó.
 */
function Ritmo({ objetivo, supera }: { objetivo: ObjectiveConAvance; supera: boolean }) {
  const r = objetivo.ritmo;
  if (supera) return <span className="gb-delta" data-sube="">Meta superada</span>;
  if (r === null || r.desvioPct === null) return <span className="gb-d">Recién arranca: todavía no hay ritmo</span>;
  const delta = fmtValor(Math.abs(r.desvio), objetivo.unidad);
  return r.alDia
    ? <span className="gb-delta" data-sube="">↑ {delta} arriba de lo esperado</span>
    : <span className="gb-delta" style={{ color: 'var(--warn)' }}>↓ {delta} abajo de lo esperado</span>;
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

function CuerpoAccion({ foco, conRazon }: { foco: Foco; conRazon: boolean }) {
  const [abierto, setAbierto] = useState(false);
  // La frase y UN botón (la acción del teléfono): el porqué y los cuatro campos del contrato (#523) quedan para quien
  // los pide con «El porqué: Se ve». Centrada en el alto (`gb-centro`): al lado de la Meta objetivo mide lo mismo.
  return (
    <div className="gb-centro">
      <p className="gb-frase">{foco.accion}</p>
      {conRazon && <p className="gb-d" style={{ margin: 'clamp(10px, 2cqi, 16px) 0 0' }}>{foco.razon}</p>}
      <div style={{ paddingTop: 'clamp(16px, 4cqi, 30px)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {/* Si la acción nombra una integración (`/integraciones?abrir=…`), abre su modal acá: nunca se sale de la tab. */}
        <LinkIntegracion href={foco.href} className="gb-boton gb-boton--grande">{foco.hrefLabel} →</LinkIntegracion>
        {conRazon && (
          <button type="button" className="gb-cab-link" style={{ marginLeft: 0, color: 'var(--dim)', fontWeight: 500 }} onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
            {abierto ? 'Ocultar el detalle' : 'Por qué esta y no otra'}
          </button>
        )}
      </div>
      {abierto && (
        <dl style={{ margin: '12px 0 0', padding: '12px 0 0', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 14px', fontSize: 13, lineHeight: 1.45 }}>
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
