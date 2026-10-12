'use client';

// =============================================================================
// BloqueFunnel — Salud del funnel comercial: las cohortes MADURAS
// =============================================================================
// El de la tab vieja (SaludFunnel + FunnelKPI de app/comercial/page.tsx, hasta 7527b8c2). Va sobre las
// cohortes SEMANALES maduras —una semana es madura si su última reunión 1 fue hace 14 días o más—, así
// todos sus leads tuvieron dos semanas para cerrar y la tasa es confiable. Un embudo de cuatro
// trapecios dorados (Agenda, Asistió, Calificado, Cierre), los conectores con el % entre etapas, y
// cuatro KPI. Cada etapa y cada KPI abre su lista de leads (getFunnelMadurasLeads, que cuadra exacto con
// el conteo de getResumenComercialMaduras).
//
// ⚠️ Las definiciones son las de la vieja y las de la vista (0084_cohortes_workspace.sql), NO las del
//    embudo genérico de la fuente «leads»: «calificado» = asistió Y calificado (las «limpias»), y la
//    tasa de cierre = cierres ÷ calificadas. Con menos de 3 casos se muestra «X de Y», no un porcentaje.
//
// Los dorados salen de mezclar el token --mako con la superficie (color-mix): en el tema oscuro la
// superficie es oscura y los trapecios se oscurecen solos, con la tinta clara encima.

import type { DesgloseData, DesgloseItem } from '@/app/_components/Desglose';
import type { FunnelLeadItem } from '@/lib/queries';
import type { EstiloEfectivo } from '@/lib/graficos-temas';
import { conversiones, type DatosFunnel } from './datos-comercial';
import { Abrible, Kpi, MONO, fecha, num, pct, plural, usd } from './piezas';

const mezcla = (p: number) => `color-mix(in srgb, var(--mako) ${p}%, var(--surface))`;
const BORDE = 'color-mix(in srgb, var(--mako-ink) 40%, var(--surface))';
const RELLENOS = [mezcla(15), mezcla(25), mezcla(38), mezcla(52)];
// Los recortes del embudo, de ancho a angosto (los de la tab vieja).
const CLIPS = [
  'polygon(0% 0, 100% 0, 84% 100%, 16% 100%)',
  'polygon(16% 0, 84% 0, 74% 100%, 26% 100%)',
  'polygon(26% 0, 74% 0, 65% 100%, 35% 100%)',
  'polygon(35% 0, 65% 0, 58% 100%, 42% 100%)',
];

function filas(arr: readonly FunnelLeadItem[], valor: (l: FunnelLeadItem) => string, focus = 'datos-comerciales'): DesgloseItem[] {
  return arr.map((l) => ({
    nombre: l.nombre,
    valor: valor(l),
    detalle: `${l.empresa ? `${l.empresa} · ` : ''}R1 ${fecha(l.fechaJ1)}`,
    leadId: l.leadId,
    focus,
  }));
}

export function BloqueFunnel({ d, estilo }: { d: DatosFunnel; estilo: EstiloEfectivo }) {
  const m = d.maduras;
  const l = d.leads;
  const cv = conversiones(m);
  const noShowN = m.total_j1 - m.asistencias;

  const dg = {
    agenda: { label: 'Agenda · R1 de cohortes maduras', value: num(m.total_j1), color: 'var(--ink)', items: filas(l.agenda, (x) => fecha(x.fechaJ1)), emptyText: 'Sin agendas maduras.' },
    asistio: { label: 'Asistió a R1', value: num(m.asistencias), color: 'var(--good)', items: filas(l.asistio, () => '✓ asistió'), emptyText: 'Nadie asistió aún.' },
    noShow: { label: 'No-show · no asistió a R1', value: num(noShowN), color: 'var(--bad)', items: filas(l.noShow, () => '✗ no asistió'), emptyText: 'Sin no-shows.' },
    calificado: { label: 'Calificados', value: num(m.limpias), color: 'var(--ink)', items: filas(l.calificado, () => '✓ calificado'), emptyText: 'Sin calificados.' },
    cierre: { label: 'Cierres maduros', value: num(m.cierres), color: 'var(--good)', items: filas(l.cierre, (x) => usd(x.monto), 'plan-pagos'), emptyText: 'Sin cierres maduros.' },
  } satisfies Record<string, DesgloseData>;

  const etapas = [
    { rotulo: 'Agenda', valor: m.total_j1, dg: dg.agenda },
    { rotulo: 'Asistió', valor: m.asistencias, dg: dg.asistio },
    { rotulo: 'Calificado', valor: m.limpias, dg: dg.calificado },
    { rotulo: 'Cierre', valor: m.cierres, dg: dg.cierre },
  ];
  const conectores = [
    { pct: cv.asisten, nota: 'asisten a R1', verde: true },
    { pct: cv.califican, nota: 'califican', verde: false },
    { pct: cv.cierran, nota: 'cierran', verde: false },
  ];

  const tasa = m.tasa_cierre_madura;
  const pocasLimpias = m.limpias < 3;
  const pocasAgendas = m.total_j1 < 3;

  if (m.cohortes_maduras_count === 0) {
    return <div className="bq-msg">Sin cohortes maduras en este período</div>;
  }

  return (
    <div className="bq-funnel">
      {/* El embudo */}
      <div>
        {etapas.map((e, i) => (
          <div key={e.rotulo}>
            <Abrible data={e.dg} titulo={`Ver los leads de «${e.rotulo}»`}>
              <div style={{ height: 78, background: BORDE, clipPath: CLIPS[i], padding: 2 }}>
                <div style={{ height: '100%', background: RELLENOS[i], clipPath: CLIPS[i], display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--dim)', marginBottom: 5 }}>{e.rotulo}</span>
                  <span style={{ fontWeight: 600, fontSize: 27, letterSpacing: '-0.02em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{num(e.valor)}</span>
                </div>
              </div>
            </Abrible>
            {i < conectores.length && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '6px 0' }}>
                <span style={{
                  fontFamily: MONO, fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 7,
                  color: conectores[i].verde ? 'var(--good)' : 'var(--dim)', background: conectores[i].verde ? 'var(--good-bg)' : 'var(--surface-2)',
                }}>{pct(conectores[i].pct)}</span>
                <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{conectores[i].nota}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Las cuatro KPI */}
      <div className="bq-funnel-kpis">
        <Abrible data={dg.cierre}>
          <Kpi estilo={estilo} rotulo="Ratio de cierre" ver="ver →"
            valor={pocasLimpias ? `${m.cierres} de ${m.limpias}` : pct(tasa)}
            color={tasa != null && !pocasLimpias && tasa >= 30 ? 'var(--good)' : 'var(--ink)'} filete="var(--good)"
            sub={`${m.cierres} ÷ ${m.limpias} calificadas`} />
        </Abrible>
        <Abrible data={dg.noShow}>
          <Kpi estilo={estilo} rotulo="No-show rate" ver="ver →"
            valor={pocasAgendas ? `${noShowN} de ${m.total_j1}` : pct(cv.noShow)}
            color={cv.noShow == null ? 'var(--ink)' : cv.noShow > 35 ? 'var(--bad)' : 'var(--good)'} filete="var(--border-strong)"
            sub={`${noShowN} de ${m.total_j1} · maduras`} />
        </Abrible>
        <Abrible data={dg.cierre}>
          <Kpi estilo={estilo} rotulo="Cierres maduros" ver="ver →" valor={num(m.cierres)} color="var(--ink)"
            sub={plural(m.cohortes_maduras_count, 'cohorte madura', 'cohortes maduras')} />
        </Abrible>
        <Kpi estilo={estilo} rotulo="CAC acumulado" color="var(--ink)"
          valor={d.cac && d.cac.cac_usd != null ? usd(d.cac.cac_usd, estilo.compacto) : '—'}
          sub={d.cac ? 'Spend ÷ cierres' : 'No pude leer el gasto'} />
      </div>
    </div>
  );
}
