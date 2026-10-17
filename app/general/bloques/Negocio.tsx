'use client';

// =============================================================================
// Negocio — ¿cómo viene? Lo que falta marcar en el CRM, el funnel de hoy, a quién cobrarle y el mes
// =============================================================================
// La segunda vuelta del 14/10/2026 («la mayoría son solamente texto»): los pendientes son un número con una barra
// partida por tipo; el funnel, un embudo de verdad (cada etapa más angosta, con lo que pasa de una a la otra); la
// cobranza, filas con el color de su urgencia; el mes, dos barras por métrica contra el mes anterior.
// =============================================================================

import type { CSSProperties } from 'react';
import { fmtUSD, fmtNum } from '@/lib/format';
import { estadoPendientes } from '@/lib/vista-general-modelo';
import { opcionDe, numeroDe, type OpcionesElegidas } from '@/lib/general-piezas';
import { rotuloDeFunnels } from '@/lib/funnels-elegidos';
import type { ConteoFunnel } from '@/lib/general-alcance';
import type { MetricaMTD, ResumenComparativo } from '@/lib/queries';
import type { CobroM } from '@/app/m/dashboard/modelo';
import { DesgloseTrigger, type DesgloseData } from '../../_components/Desglose';
import { Cobranza } from '../Cobranza';
import type { DatosGeneral } from '../datos-tipos';
import { Cabeza, Fallo, Placeholder } from './comun';
import { FUNNEL_MUESTRA, COBROS_MUESTRA, MES_MUESTRA } from './muestras';

// ── Los pendientes del CRM ──────────────────────────────────────────────────────────────────────────────────────────

const TIPOS_PENDIENTE = [
  { k: 'A', l: 'sin asistencia a R1', c: '#d50000' },
  { k: 'B', l: 'sin R2 ni resolución', c: '#f4511e' },
  { k: 'C', l: 'sin asistencia a R2', c: '#e3a008' },
  { k: 'M', l: 'nutrición manual vencida', c: '#8e24aa' },
] as const;

export function BloquePendientes({ d }: { d: DatosGeneral['pendientes'] }) {
  if (!d.ok) return <Fallo titulo="Pendientes del CRM" error={d.error} />;
  const p = d.d;
  // ⚠️ «Al día» sólo si se leyó TODO (`estadoPendientes`): con un aviso y cero pendientes, «no pude confirmar».
  const estado = estadoPendientes(p);
  const aviso = (p.aviso ?? '').trim();
  const tipos = TIPOS_PENDIENTE.map((t) => ({ ...t, n: p.porTipo[t.k] ?? 0 })).filter((t) => t.n > 0);
  const total = tipos.reduce((s, t) => s + t.n, 0) || 1;
  return (
    <div className="gb">
      <Cabeza titulo="Pendientes del CRM" href="/crm" link={estado === 'por-marcar' ? 'Marcar en el CRM' : undefined} />
      {estado === 'por-marcar' ? (
        // El número, la barra partida por tipo y la leyenda, uno debajo del otro: entra en media hoja sin saltos.
        <div className="gb-centro" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="gb-p" style={{ color: 'var(--bad)' }}>{p.total}</span>
            <span className="gb-d">{p.total === 1 ? 'lead sin marcar' : 'leads sin marcar'}</span>
          </span>
          <div aria-hidden style={{ display: 'flex', height: 'clamp(10px, calc(2cqi + 4px), 20px)', borderRadius: 999, overflow: 'hidden', background: 'var(--gb-losa-2)' }}>
            {tipos.map((t) => <span key={t.k} style={{ width: `${(t.n / total) * 100}%`, background: t.c }} />)}
          </div>
          <div style={{ display: 'flex', gap: '6px 14px', flexWrap: 'wrap' }}>
            {tipos.map((t) => (
              <span key={t.k} className="gb-d" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: t.c }} />
                <b className="gb-num" style={{ color: 'var(--ink)' }}>{t.n}</b> {t.l}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span aria-hidden style={{ flex: 'none', width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 700,
            background: estado === 'al-dia' ? 'color-mix(in srgb, var(--good) 15%, transparent)' : 'color-mix(in srgb, var(--warn-fill) 18%, transparent)',
            color: estado === 'al-dia' ? 'var(--good)' : 'var(--warn)' }}>{estado === 'al-dia' ? '✓' : '!'}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{estado === 'al-dia' ? 'Datos al día' : 'No pude confirmar que estén al día'}</span>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>{estado === 'al-dia' ? 'El tablero es confiable.' : aviso}</span>
          </span>
        </div>
      )}
      {estado === 'por-marcar' && aviso && <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--warn)' }}>{aviso}</p>}
    </div>
  );
}

// ── El funnel de hoy ────────────────────────────────────────────────────────────────────────────────────────────────

/** El embudo: cada etapa centrada y más angosta según cuántos tiene, con el % que pasa a la siguiente entre medio. */
function Embudo({ c }: { c: ConteoFunnel }) {
  const tope = Math.max(1, ...c.etapas.map((e) => e.n));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
      {c.etapas.map((e, i) => {
        const ancho = Math.max(22, (e.n / tope) * 100);
        const sig = c.etapas[i + 1];
        const paso = sig && e.n > 0 ? Math.round((sig.n / e.n) * 100) : null;
        return (
          <div key={e.key}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 24%) 1fr minmax(52px, auto)', alignItems: 'center', gap: 'clamp(10px, 2cqi, 18px)' }}>
              <span className="gb-d" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{e.label}</span>
              <span style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{ width: `${Math.min(100, ancho)}%`, height: 'clamp(22px, calc(3cqi + 12px), 40px)', borderRadius: 8, background: e.dot || 'var(--primary)', opacity: e.n ? 1 : 0.25 }} />
              </span>
              <span className="gb-t gb-num" style={{ fontWeight: 800, color: e.n ? 'var(--ink)' : 'var(--faint)' }}>{fmtNum(e.n)}</span>
            </div>
            {paso != null && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 24%) 1fr minmax(52px, auto)', gap: 'clamp(10px, 2cqi, 18px)' }}>
                <span />
                <span className="gb-num" style={{ textAlign: 'center', fontSize: 'clamp(12px, calc(1cqi + 9px), 14px)', color: 'var(--faint)', lineHeight: '18px' }}>↓ {paso}%</span>
                <span />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Barras({ c }: { c: ConteoFunnel }) {
  const tope = Math.max(1, ...c.etapas.map((e) => e.n));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.6cqi, 14px)' }}>
      {c.etapas.map((e) => (
        <div key={e.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 26%) 1fr auto', alignItems: 'center', gap: 'clamp(10px, 2cqi, 18px)' }}>
          <span className="gb-d" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
          {/* La barra se recorta al 100% y su carril lleva overflow: hidden (AGENTS.md). */}
          <span style={{ display: 'block', height: 'clamp(12px, calc(2.2cqi + 4px), 26px)', borderRadius: 999, background: 'var(--gb-losa-2)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', borderRadius: 999, width: `${Math.min(100, (e.n / tope) * 100)}%`, background: e.dot || 'var(--primary)', opacity: e.n ? 1 : 0 }} />
          </span>
          <span className="gb-t gb-num" style={{ textAlign: 'right', fontWeight: 800, minWidth: '2ch', color: e.n ? 'var(--ink)' : 'var(--faint)' }}>{fmtNum(e.n)}</span>
        </div>
      ))}
    </div>
  );
}

const CuerpoFunnel = ({ c, estilo }: { c: ConteoFunnel; estilo: string }) => (estilo === 'barras' ? <Barras c={c} /> : <Embudo c={c} />);
/** Con muchas etapas, sólo las que tienen leads: diez renglones en cero no dicen nada y no entran. */
const conLeads = (c: ConteoFunnel): ConteoFunnel => (c.etapas.length > 6 ? { ...c, etapas: c.etapas.filter((e) => e.n > 0) } : c);

export function BloqueFunnel({ d, funnel, op }: { d: DatosGeneral['funnels']; funnel: number | null; op?: OpcionesElegidas }) {
  if (!d.ok) return <Fallo titulo="Tu funnel hoy" error={d.error} />;
  const estilo = opcionDe('funnel', op, 'estilo');
  const f = funnel ? d.d.find((x) => x.id === funnel) : d.d.find((x) => x.principal) ?? d.d[0];
  if (funnel && !f) return <Fallo titulo="Tu funnel hoy" error="Ese funnel ya no está. Elige otro en el panel." />;
  if (f && !f.conteo) return <Fallo titulo="Tu funnel hoy" error="No pude leer el CRM." />;
  const c = f?.conteo ?? null;
  return (
    <div className="gb">
      <Cabeza titulo="Tu funnel hoy" extra={c?.nombre ?? null} href="/crm" link="Abrir el CRM" />
      {c && c.total > 0 ? (
        <div className="gb-par">
          {/* El total, de un vistazo: el protagonista. En una tarjeta ancha, al lado de las etapas (`gb-par`). */}
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 'clamp(12px, 2.4cqi, 22px)', flexWrap: 'wrap' }}>
            <span className="gb-p">{fmtNum(c.total)}</span>
            <span className="gb-d">{c.total === 1 ? 'lead' : 'leads'} en el funnel</span>
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {conLeads(c).etapas.length ? <CuerpoFunnel c={conLeads(c)} estilo={estilo} /> : null}
            {c.sinEtapa > 0 && <span className="gb-d" style={{ marginTop: 8, color: 'var(--faint)' }}>{c.sinEtapa === c.total ? 'Todos están' : `${c.sinEtapa} están`} en una etapa que el funnel ya no tiene</span>}
          </div>
        </div>
      ) : (
        <Placeholder muestra={<CuerpoFunnel c={FUNNEL_MUESTRA} estilo={estilo} />}
          texto={c ? 'Todavía no hay leads en este funnel.' : 'Todavía no hay un funnel.'} accion={{ href: '/crm', rotulo: 'Abrir el CRM' }} />
      )}
    </div>
  );
}

export function MuestraFunnel({ op }: { op?: OpcionesElegidas }) {
  // La misma cabecera que el bloque (el total en grande): la miniatura de una plantilla es la hoja «tal cual».
  return (
    <div className="gb">
      <Cabeza titulo="Tu funnel hoy" />
      <div className="gb-par">
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 'clamp(12px, 2.4cqi, 22px)', flexWrap: 'wrap' }}>
          <span className="gb-p">{fmtNum(FUNNEL_MUESTRA.total)}</span>
          <span className="gb-d">leads en el funnel</span>
        </span>
        <div style={{ minWidth: 0 }}><CuerpoFunnel c={FUNNEL_MUESTRA} estilo={opcionDe('funnel', op, 'estilo')} /></div>
      </div>
    </div>
  );
}

// ── A quién cobrarle ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * `elegidos`: los funnels del bloque (desde el 17/10/2026, uno O VARIOS: la cobranza de «VSL + Renovación» es la unión de
 * sus clientes). Vacío = todo el negocio. Un cliente es de un funnel por su casa o por estar agregado (`deQuien`).
 */
export function BloqueCobranza({ d, elegidos, funnels, op }: { d: DatosGeneral['cobranza']; elegidos: readonly number[]; funnels: DatosGeneral['funnels']; op?: OpcionesElegidas }) {
  const limite = numeroDe(opcionDe('cobranza', op, 'limite'));
  const soloVencidas = opcionDe('cobranza', op, 'cuales') === 'vencidas';
  const filtra = elegidos.length > 0;
  const nombreFunnel = filtra && funnels.ok ? rotuloDeFunnels(elegidos, funnels.d) : null;
  const vacio = (
    <Placeholder muestra={<Cobranza filas={COBROS_MUESTRA.slice(0, Math.min(4, limite))} tz="" error={null} muestra sinCabeza />}
      texto={soloVencidas ? 'Ninguna cuota vencida.' : 'Nadie con cuotas por cobrar.'} accion={{ href: '/crm', rotulo: 'Abrir el CRM' }} />
  );
  if (!d.ok) return <Cobranza filas={[]} tz="" error={d.error} alcance={nombreFunnel} />;
  // Un filtro que no se pudo armar no es «nadie debe»: la cobranza de un funnel sin saber de quién es cada cliente lo dice.
  if (filtra && d.d.deQuien == null) return <Cobranza filas={[]} tz={d.d.tz} error="No pude leer de qué funnel es cada cliente." alcance={nombreFunnel} />;
  let filas: CobroM[] = d.d.cobros;
  if (filtra && d.d.deQuien) filas = filas.filter((c) => d.d.deQuien?.[c.leadId]?.some((f) => elegidos.includes(f)));
  if (soloVencidas) filas = filas.filter((c) => c.urgencia === 'vencida');
  return <Cobranza filas={filas} tz={d.d.tz} error={null} alcance={nombreFunnel} limite={limite} vacio={vacio} />;
}

export function MuestraCobranza() {
  return <Cobranza filas={COBROS_MUESTRA} tz="" error={null} muestra />;
}

// ── El mes ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * El mes, comparado: dos barras por métrica —este mes y el anterior— a la misma escala (la de la mayor de las dos).
 * Sin comparar, el número solo. La proyección no vuelve: un número inventado no puede verse igual que uno medido.
 */
function ResumenMes({ c, desgloses, comparar }: { c: ResumenComparativo; desgloses: Record<string, DesgloseData>; comparar: boolean }) {
  const items: Array<{ label: string; m: MetricaMTD; f: (n: number) => string; invertir?: boolean }> = [
    { label: 'Ad Spend', m: c.inversion_usd, f: fmtUSD, invertir: true },
    { label: 'Agendas', m: c.agendas, f: fmtNum },
    { label: 'Cierres', m: c.cierres, f: fmtNum },
    { label: 'Cash Collected', m: c.cash_usd, f: fmtUSD },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'clamp(10px, 1.6cqi, 16px)' }}>
      {items.map((it) => {
        const dg = desgloses[it.label];
        const sube = it.m.actual > it.m.anterior;
        const igual = it.m.actual === it.m.anterior;
        const color = igual ? 'var(--faint)' : it.invertir ? 'var(--dim)' : sube ? 'var(--good)' : 'var(--bad)';
        const delta = it.m.anterior > 0 ? Math.round(((it.m.actual - it.m.anterior) / it.m.anterior) * 100) : null;
        // Una LOSA por métrica (./comun.tsx), no una tarjeta dentro de la tarjeta del bloque. La baldosa del teléfono: el
        // número primero y en grande, su rótulo y su delta. La losa es el CONTENEDOR del número (`container-type`): mide
        // contra su ancho y no contra el del bloque, así cuatro a lo ancho no se pasan y dos en el teléfono quedan en 27 px.
        // Sin la línea «mismo período del mes anterior: $1,650» (la saca el teléfono): el anterior está en el título del
        // bloque y en el desglose.
        const tarjeta: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, padding: 'clamp(12px, 2cqi, 18px) clamp(14px, 2cqi, 20px)', borderRadius: 16, background: 'var(--gb-losa)', border: 'none', cursor: dg ? 'pointer' : 'default', textAlign: 'left', font: 'inherit', color: 'inherit', containerType: 'inline-size', minWidth: 0 };
        const inner = (
          <>
            <span className="gb-num" style={{ fontWeight: 800, fontSize: 'clamp(26px, calc(24cqi - 6px), 76px)', color: 'var(--ink)', letterSpacing: '-0.035em', lineHeight: 1.02 }}>{it.f(it.m.actual)}</span>
            <span style={{ fontSize: 'clamp(13.5px, calc(3cqi + 9px), 17px)', color: 'var(--dim)' }}>{it.label}</span>
            {comparar && delta != null && !igual && <span className="gb-num" style={{ fontSize: 'clamp(12.5px, calc(2.6cqi + 8px), 16px)', fontWeight: 700, color }}>{delta > 0 ? '↑' : '↓'} {Math.abs(delta)}%</span>}
          </>
        );
        return dg
          ? <DesgloseTrigger key={it.label} data={dg} style={tarjeta}>{inner}</DesgloseTrigger>
          : <div key={it.label} style={tarjeta}>{inner}</div>;
      })}
    </div>
  );
}

export function BloqueMes({ d, op }: { d: DatosGeneral['mes']; op?: OpcionesElegidas }) {
  if (!d.ok) return <Fallo titulo="El mes" error={d.error} />;
  const comparar = opcionDe('mes', op, 'comparar') === 'si';
  const c = d.d.comparativo;
  return (
    <div className="gb">
      <Cabeza titulo="El mes" extra={c && comparar ? `vs. ${c.etiqueta_anterior}` : null} />
      {/* Esconder el bloque escondería el fallo: el mes sigue existiendo y la pantalla no diría que no lo pudo leer. */}
      {c ? <ResumenMes c={c} desgloses={d.d.desgloses} comparar={comparar} /> : <span className="gb-fallo">No pude leer el resumen del mes.</span>}
    </div>
  );
}

export function MuestraMes({ op }: { op?: OpcionesElegidas }) {
  return (
    <div className="gb">
      <Cabeza titulo="El mes" />
      <ResumenMes c={MES_MUESTRA} desgloses={{}} comparar={opcionDe('mes', op, 'comparar') === 'si'} />
    </div>
  );
}
