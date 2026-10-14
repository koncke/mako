// =============================================================================
// piezas — los bloques de General, armados en el server para el editor (lib/general-piezas.ts)
// =============================================================================
// Desde el 14/10/2026 la tab General es el editor del Dashboard con su propio informe. Los bloques de siempre (el hero
// del objetivo con la acción del día, los KPIs, el semáforo, el mes, los pendientes) y los nuevos (los objetivos, mi
// día, las próximas llamadas, las publicaciones, el funnel de hoy) se ARMAN ACÁ con las mismas lecturas de siempre y
// viajan al editor ya dibujados (app/dashboard/ElementoGeneral.tsx): el editor no aprende a leer nada de esto.
//
// ⚠️ CADA BLOQUE FALLA SOLO: una lectura caída deja ESE bloque diciendo que no pudo, nunca la pantalla en blanco.
// ⚠️ EL DISEÑO ES EL DE SIEMPRE (Martín, 08/09/2026: el hero oscuro, el semáforo dibujado): personalizar es elegir y
//    acomodar los bloques, no redibujarlos. La sección (la caja) la pone la tarjeta del editor.
// ⚠️ LA AGENDA DE GOOGLE (en «Mi día») SE DIBUJA Y NADA MÁS: no viaja a ningún modelo.
// =============================================================================

import 'server-only';
import Link from '@/app/_ui/Link';
import type { CSSProperties, ReactNode } from 'react';
import {
  getAgendasBreakdown,
  getSenalesRecon,
  compareMTD,
  type ResumenComparativo,
  type Pendientes,
  type MetricaMTD,
  type AgendaItem,
  type SenalRecon,
} from '@/lib/queries';
import { fmtUSD, fmtNum } from '@/lib/format';
import { getRevenueBreakdowns, type RevItem, type RevenueBreakdowns } from '@/lib/pagos';
import { leerFunnelsDeGeneral, funnelsDeLeads, conteoDelFunnel, type ConteoFunnel, type FunnelDeGeneral } from '@/lib/general-alcance';
import { leerPlanHoy } from '@/lib/plan-hoy';
import { METRICA_LABEL } from '@/lib/objectives-modelo';
import { leerVistaGeneral } from '@/lib/vista-general';
import {
  estadoPendientes,
  type AlertaGeneral, type CuotaDeAlerta, type EstadoFuentes, type EstadoLampara,
} from '@/lib/vista-general-modelo';
import { leerAQuienCobrar } from '@/lib/datos-comercial-server';
import { fmtValor } from '@/lib/graficos-agregar';
import { leerCalendario, zonaDelCalendario } from '@/lib/calendario';
import { ROTULO_FORMATO, diaDe, horaDe, sumarDias, type ItemCalendario } from '@/lib/calendario-modelo';
import { clavePieza, saludoDeHora, type ValoresVariables } from '@/lib/general-piezas';
import { getUsuarioActual } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase';
import { getWorkspaceActual } from '@/lib/workspace';
import { textoVence, type CobroM } from '@/app/m/dashboard/modelo';
import { DesgloseTrigger, type DesgloseItem, type DesgloseData } from '../_components/Desglose';
import { Icon } from '../_components/icons';
import { Cabecera } from './Cabecera';
import { KpisCard, type KpiVista } from './KpisCard';
import { PrioridadesGeneral, FunnelHoy } from './Bloques';
import { Cobranza } from './Cobranza';

/** El título de una sección. 25px es el de las vecinas: /general se lee como hermana o no. */
const H2: CSSProperties = {
  fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)',
};

function fmtDMY(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function revItemsToDesglose(items: RevItem[], fechaLabel: string, focus = 'plan-pagos'): DesgloseItem[] {
  return items.map((it) => ({
    nombre: it.nombre,
    valor: fmtUSD(it.monto),
    detalle: `${it.detalle ? `${it.detalle} · ` : ''}${fechaLabel} ${fmtDMY(it.fecha)}`,
    leadId: it.leadId,
    focus,
  }));
}

type Nivel = AlertaGeneral['nivel'];
/** Una alerta como la dibuja el escritorio: la de cuotas, con su desglose lead por lead. */
type Alerta = { nivel: Nivel; titulo: string; detalle: string; href: string; hrefLabel: string; desglose?: DesgloseData };

function cuotaItems(arr: CuotaDeAlerta[]): DesgloseItem[] {
  return arr.map((c) => ({
    nombre: c.lead_nombre,
    valor: fmtUSD(c.monto_usd),
    detalle: `cuota ${c.numero === 0 ? 'inicial' : c.numero} · vence ${fmtDMY(c.fecha_esperada)} · ${c.dias < 0 ? `${Math.abs(c.dias)}d vencida` : c.dias === 0 ? 'vence hoy' : `en ${c.dias}d`}`,
    leadId: c.lead_id,
    focus: 'plan-pagos',
  }));
}

/**
 * De la alerta CRUDA (`armarAlertas`, lib/vista-general-modelo.ts) a la fila del escritorio.
 * Las de cuotas traen sus filas y su total; el desglose —que abre la ficha EDITABLE del
 * lead— es cosa de esta pantalla, por eso se arma acá y no en la lib.
 */
function alertaDeEscritorio(a: AlertaGeneral): Alerta {
  const fila: Alerta = { nivel: a.nivel, titulo: a.titulo, detalle: a.detalle, href: a.href, hrefLabel: a.hrefLabel };
  if (!a.cuotas) return fila;
  const vencidas = a.tipo === 'cuotas-vencidas';
  return {
    ...fila,
    desglose: {
      label: vencidas ? 'Cuotas vencidas' : 'Cuotas por vencer',
      value: fmtUSD(a.totalUsd ?? 0),
      color: vencidas ? 'var(--bad)' : 'var(--warn-fill)',
      items: cuotaItems(a.cuotas),
      emptyText: vencidas ? 'Sin cuotas vencidas.' : 'Sin cuotas por vencer.',
    },
  };
}

type Vista = Awaited<ReturnType<typeof leerVistaGeneral>>;

/** El hero oscuro: el objetivo del Q, la facturación y LA acción del día (lo de siempre). */
function BloqueObjetivo({ v }: { v: Vista }) {
  const { objetivoPrincipal, plata } = v;
  // El detalle lead por lead del número grande, y la OTRA métrica de plata del mismo período. `plata` sólo
  // existe para objetivos de plata y si la lectura salió: si falla, el hero muestra el número y esconde el
  // desglose — nunca se cae la pantalla por un detalle.
  let heroDesglose: DesgloseData | null = null;
  let heroComplemento: React.ComponentProps<typeof Cabecera>['complemento'] = null;
  if (objetivoPrincipal && plata) {
    const esCash = plata.esCash;
    heroDesglose = {
      label: `${METRICA_LABEL[objetivoPrincipal.metrica]} del período`,
      value: fmtUSD(plata.totalPropios),
      color: esCash ? 'var(--good)' : 'var(--ink)',
      items: revItemsToDesglose(plata.propios, esCash ? 'pago' : 'cierre', 'plan-pagos'),
      emptyText: esCash ? 'Todavía no entró un pago en este período.' : 'Todavía no se firmó nada en este período.',
    };
    heroComplemento = {
      label: esCash ? 'Firmado' : 'Cobrado',
      valor: fmtUSD(plata.totalOtros),
      pie: esCash ? 'comprometido en contratos, aún no cobrado' : 'lo que efectivamente entró',
      desglose: {
        label: esCash ? 'Firmado en el período' : 'Cobrado en el período',
        value: fmtUSD(plata.totalOtros),
        color: esCash ? 'var(--ink)' : 'var(--good)',
        items: revItemsToDesglose(plata.otros, esCash ? 'cierre' : 'pago', 'plan-pagos'),
        emptyText: esCash ? 'Sin cierres firmados en el período.' : 'Sin cobros en el período.',
      },
    };
  }
  return (
    <Cabecera
      objetivo={objetivoPrincipal}
      foco={v.foco}
      capacidad={v.capacidad}
      progreso={v.progreso}
      fraccion={v.fraccionObjetivo}
      anio={v.qt.anio}
      quarter={v.qt.q}
      desglose={heroDesglose}
      complemento={heroComplemento}
    />
  );
}

function BloqueKpis({ v }: { v: Vista }) {
  const kpisVista: KpiVista[] = v.kpis.map((k) => ({
    id: k.id, nombre: k.nombre, cadencia: k.cadencia, compromiso: k.compromiso,
    unidad: k.unidad, fuente: k.fuente, fuenteId: k.fuenteId, objectiveId: k.objectiveId,
    valor: k.valor, error: k.error, estado: k.estado, pct: k.pct,
    umbralVerde: k.umbralVerde, umbralAmbar: k.umbralAmbar,
  }));
  return (
    <KpisCard
      kpis={kpisVista}
      candidatos={v.candidatos}
      objetivos={v.objetivos.map((o) => ({ id: o.id, titulo: o.titulo }))}
      objetivoPrincipalId={v.objetivoPrincipal?.id ?? null}
    />
  );
}

/**
 * El semáforo. ⚠️ LA ALERTA QUE YA ES EL TITULAR SÓLO SE SALTEA SI EL TITULAR SE DIBUJA: con la vista sin la
 * cabecera (`conCabecera` en false), la alerta de la acción del día va en la lista como cualquier otra — si no,
 * desaparecería de la pantalla y el «La más urgente está arriba» apuntaría a algo que no está.
 */
function BloqueSemaforo({ v, conCabecera }: { v: Vista; conCabecera: boolean }) {
  // Las mismas seis reglas de siempre (armadas en la lib).
  const alertas: Alerta[] = v.alertas.map(alertaDeEscritorio);
  const saltar = conCabecera ? v.foco.alertaIdx : null;
  const restantes = alertas.length - (saltar === null ? 0 : 1);
  return (
    <>
      <h2 style={{ ...H2, marginBottom: 24 }}>Semáforo del negocio</h2>
      <Semaforo
        alertas={alertas}
        fuentes={v.fuentes}
        lampara={v.lampara.estado}
        saltar={saltar}
        restantes={restantes}
        // `objetivoAtrasado` sólo se afirma cuando el avance se pudo LEER (lib/vista-general-modelo.ts).
        objetivoAtrasado={v.objetivoAtrasado}
      />
    </>
  );
}

/** Los desgloses de las cuatro tarjetas del mes. */
function desglosesDelMes(mtdBreak: RevenueBreakdowns, agendasMTD: AgendaItem[], senalesMTD: SenalRecon[]): Record<string, DesgloseData> {
  return {
    'Ad Spend': {
      label: 'Ad Spend del mes · por anuncio',
      value: fmtUSD(senalesMTD.reduce((s, a) => s + a.spend_usd, 0)),
      color: 'var(--ink)',
      items: senalesMTD.filter((s) => s.spend_usd > 0).sort((a, b) => b.spend_usd - a.spend_usd).map((s) => ({
        nombre: s.ad_name,
        valor: fmtUSD(s.spend_usd),
        detalle: [s.campana, s.adset_name].filter(Boolean).join(' · ') || undefined,
      })),
      emptyText: 'Sin gasto a nivel anuncio este mes.',
    },
    Cierres: {
      label: 'Cierres del mes',
      value: String(mtdBreak.sold.length),
      color: 'var(--ink)',
      items: revItemsToDesglose(mtdBreak.sold, 'cierre', 'plan-pagos'),
      emptyText: 'Sin cierres este mes.',
    },
    'Cash Collected': {
      label: 'Cash Collected del mes',
      value: fmtUSD(mtdBreak.cash.reduce((s, i) => s + i.monto, 0)),
      color: 'var(--good)',
      items: revItemsToDesglose(mtdBreak.cash, 'pago', 'plan-pagos'),
      emptyText: 'Sin cobros este mes.',
    },
    Agendas: {
      label: 'Agendas del mes · R1 en el período (CRM)',
      value: String(agendasMTD.length),
      color: 'var(--ink)',
      items: agendasMTD.map((a) => ({
        nombre: a.nombre, valor: fmtDMY(a.fecha), detalle: a.empresa ?? undefined,
        leadId: a.leadId, focus: 'datos-comerciales',
      })),
      emptyText: 'Sin agendas este mes.',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Los bloques de siempre
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El mes, comparado — barras, no tres renglones de texto por métrica.
 *
 * ⚠️ CADA TARJETA TENÍA TRES NÚMEROS EN PROSA: el actual, «mismo período de
 * agosto: X» y «proyección: Y». Doce renglones de texto para cuatro métricas.
 * Ahora la comparación se VE: dos barras por métrica —este mes y el anterior— a
 * la misma escala. Cuál subió y cuál bajó se lee sin leer.
 *
 * La proyección se fue: es una estimación lineal sobre un mes a medio correr, y
 * ocupaba el mismo peso visual que un dato medido. Un número inventado no puede
 * verse igual que uno real.
 */
function ResumenMes({ c, desgloses }: { c: ResumenComparativo; desgloses: Record<string, DesgloseData> }) {
  const items: Array<{ label: string; m: MetricaMTD; f: (n: number) => string; invertir?: boolean }> = [
    { label: 'Ad Spend', m: c.inversion_usd, f: fmtUSD, invertir: true },
    { label: 'Agendas', m: c.agendas, f: fmtNum },
    { label: 'Cierres', m: c.cierres, f: fmtNum },
    { label: 'Cash Collected', m: c.cash_usd, f: fmtUSD },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 26 }}>
      {items.map((it) => {
        const dg = desgloses[it.label];
        // La escala la fija el MAYOR de los dos, así las dos barras de una misma
        // métrica se comparan entre sí. No se comparte escala entre métricas: el
        // spend y los cierres no viven en el mismo orden de magnitud.
        const tope = Math.max(it.m.actual, it.m.anterior, 1);
        const sube = it.m.actual > it.m.anterior;
        const igual = it.m.actual === it.m.anterior;
        const color = igual ? 'var(--faint)' : it.invertir ? 'var(--dim)' : sube ? 'var(--good)' : 'var(--bad)';
        const inner = (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 24, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{it.f(it.m.actual)}</span>
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>{it.label}</span>
            </div>
            {/* Dos barras: arriba este mes, abajo el anterior en gris. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ display: 'block', height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', borderRadius: 999, width: `${Math.min(100, (it.m.actual / tope) * 100)}%`, background: color }} />
              </span>
              {/* ⚠️ La barra recesiva va en `--faint`, no en `--border-strong`: medido,
                  --border-strong sobre --surface-2 da 1,23:1 — invisible. --faint da
                  2,46, que sigue abajo de 3, así que el valor del período anterior
                  TIENE que estar en texto acá abajo. El color nunca es el único
                  portador de un dato. */}
              <span style={{ display: 'block', height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', borderRadius: 999, width: `${Math.min(100, (it.m.anterior / tope) * 100)}%`, background: 'var(--faint)' }} />
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 7 }}>
              {c.etiqueta_anterior}: {it.f(it.m.anterior)}
            </div>
          </>
        );
        return dg
          ? <DesgloseTrigger key={it.label} data={dg} style={{ cursor: 'pointer' }}>{inner}</DesgloseTrigger>
          : <div key={it.label}>{inner}</div>;
      })}
    </div>
  );
}

/**
 * El semáforo — las tres lámparas y las alertas.
 *
 * ⚠️ LAS LÁMPARAS VOLVIERON EL 08/09/2026, POR PEDIDO DEL DUEÑO: «estaban bien
 * diseñadas». Son la síntesis gráfica —el nivel del negocio en un vistazo, que es el
 * test de la casa— y la pasada del 07/09 las sacó junto con lo que sí sobraba.
 *
 * ⚠️ Y LAS LÁMPARAS MIRAN `alertas`, LAS FILAS MIRAN `visibles`. Es la sutileza que
 * hace que esto no reintroduzca la mentira de la #165 por otra puerta: la lámpara
 * dice el estado del NEGOCIO, y las filas listan lo que queda por leer acá. Con una
 * sola alerta roja —que además es el titular de la cabecera— la lista queda vacía y
 * la lámpara tiene que seguir en ROJO: si contara sobre las visibles, saldría verde
 * mientras arriba dice «3 cuotas VENCIDAS». Por eso, cuando la lista queda corta
 * porque una subió al titular, se dice.
 *
 * Lo que NO volvió del semáforo viejo, y cada cosa por su motivo:
 *   · el párrafo de veredicto — repite lo que las lámparas ya dicen, y su rama verde
 *     es TEXTUALMENTE la mentira de la #165 («El negocio está sano») sobre un
 *     workspace sin un solo dato;
 *   · las tres píldoras de conteo — el mismo bit en un tercer lugar, al lado de las
 *     lámparas y de los puntos de cada fila;
 *   · el `detalle` de cada fila — medido el 07/09: el titular y la primera fila eran
 *     ~40 palabras idénticas;
 *   · el filete de 4 px de color por fila — veto duro de la casa, y la cuarta copia
 *     del mismo bit.
 */
function Semaforo({ alertas, fuentes, lampara, saltar, restantes, objetivoAtrasado }: {
  alertas: Alerta[];
  /** Qué se sabe de las fuentes (#165). Cualquier cosa que no sea `con-datos` apaga las lámparas. */
  fuentes: EstadoFuentes;
  /**
   * El color, calculado sobre TODAS las alertas (`estadoLampara`, lib/vista-general-modelo.ts):
   * la lámpara dice el estado del negocio, las filas lo que queda por leer acá.
   */
  lampara: EstadoLampara;
  /** El índice de la alerta que ya es el titular de la pantalla. */
  saltar: number | null;
  /** Cuántas alertas quedan para esta lista, sacando la que ya es titular. */
  restantes: number;
  /**
   * El objetivo del trimestre va por debajo de lo esperado a esta altura.
   *
   * ⚠️ NO ES UNA ALERTA MÁS —no agrega fila, porque el número ya está arriba en la
   * cabecera y repetirlo sería la duplicación que esta pantalla viene arrastrando—,
   * pero SÍ apaga el verde. Medido el 08/09/2026 sobre un workspace real: la cabecera
   * decía «Vas $15.217 abajo de lo esperado» y dos bloques más abajo la lámpara verde
   * certificaba que estaba todo bien. Las seis reglas del semáforo miran señales
   * operativas y ninguna mira el compromiso del trimestre, así que sin esto la
   * pantalla se contradice a sí misma en el mismo scroll.
   */
  objetivoAtrasado: boolean;
}) {
  const sinFuentes = fuentes !== 'con-datos';
  const visibles = alertas.filter((_, i) => i !== saltar);

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap' }}>
      {/* Las tres lámparas. `alignSelf: stretch` y NUNCA `height: 100%`: un porcentaje
          contra un alto indefinido no resuelve, Chrome lo tolera y Safari devuelve
          CERO — que con `overflow: hidden` es una caja en blanco. */}
      <div style={{
        flex: 'none', width: 88, alignSelf: 'stretch',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
        // El token, no el `#14161B` literal que tenía el viejo: la isla oscura de esta
        // pantalla y la de la cabecera tienen que ser el mismo material.
        background: 'var(--sidebar)', borderRadius: 18, padding: '18px 16px',
      }}>
        <Lampara color="var(--bad)" encendida={lampara === 'rojo'} />
        <Lampara color="var(--warn-fill)" encendida={lampara === 'ambar'} />
        <Lampara color="var(--good)" encendida={lampara === 'verde'} />
      </div>

      <div style={{ flex: 1, minWidth: 280 }}>
        {/* ⚠️ El estado «no puedo opinar» (#165) va ANTES que cualquier alerta: cuando
            ninguna fuente entregó jamás un dato, lo que sigue no se sostiene — y por
            eso arriba las TRES lámparas quedan apagadas, que es lo único honesto. */}
        {sinFuentes ? (
          // ⚠️ «No las pude leer» NO es «no hay fuentes»: la primera es nuestra, y mandar a
          // conectar algo que está conectado es mandar a arreglar lo que no se rompió.
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-card)', color: 'var(--dim)' }}>
              {fuentes === 'sin-leer'
                ? 'No pude leer tus fuentes de datos: hoy no puedo opinar de tu negocio.'
                : 'Sin fuentes conectadas no puedo opinar de tu negocio.'}
            </span>
            {fuentes !== 'sin-leer' && (
              <Link href="/integraciones" style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                Conectar →
              </Link>
            )}
          </div>
        ) : visibles.length === 0 ? (
          <span style={{ fontSize: 'var(--fs-card)', color: 'var(--dim)' }}>
            {restantes === 0 && saltar !== null
              ? 'Lo único que hay que atender ya está arriba.'
              : objetivoAtrasado
              ? 'Ninguna señal operativa en rojo, pero el trimestre va por debajo de lo esperado.'
              : 'Nada más que atender.'}
          </span>
        ) : (
          <div>
            {visibles.map((a, i) => {
              const c = a.nivel === 'rojo' ? 'var(--bad)' : a.nivel === 'ambar' ? 'var(--warn-fill)' : 'var(--good)';
              const inner = (
                <>
                  <span aria-hidden style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', background: c }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-card)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
                  <span style={{ flex: 'none', color: 'var(--faint)', fontSize: 'var(--fs-sm)' }}>
                    {a.desglose ? 'ver detalle →' : `${a.hrefLabel} →`}
                  </span>
                </>
              );
              const fila: CSSProperties = {
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '13px 0', textDecoration: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              };
              return a.desglose
                ? <DesgloseTrigger key={i} data={a.desglose} style={fila}>{inner}</DesgloseTrigger>
                : <Link key={i} href={a.href} style={fila}>{inner}</Link>;
            })}
            {saltar !== null && (
              <p style={{ margin: '14px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>
                La más urgente está arriba, en la cabecera.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Lampara({ color, encendida }: { color: string; encendida: boolean }) {
  return (
    <span aria-hidden style={{
      width: 48, height: 48, borderRadius: '50%', background: color,
      // El halo sale del MISMO token que la lámpara. El viejo escribía tres rgba() a
      // mano, así que el día que cambie el rojo del sistema quedan dos rojos.
      ...(encendida
        ? { boxShadow: `0 0 24px 4px color-mix(in srgb, ${color} 55%, transparent)` }
        : { opacity: 0.18 }),
    }} />
  );
}

/**
 * Pendientes de marcar — el número grande, y sólo los tipos que tienen algo.
 *
 * ⚠️ EL VIEJO DIBUJABA CUATRO SUB-TARJETAS FIJAS y en la pantalla real tres decían
 * 0. Una tarjeta que dice cero no informa: ocupa el lugar de la que sí, y es además
 * la regla escrita del dueño («estado vacío = mensaje que explica, nunca un cuadro
 * con los campos vacíos»). La superficie que volvió es la SECCIÓN, que la envuelve;
 * adentro va una lista con filete, que es lo que la casa pide para un grupo de cosas
 * del mismo tipo.
 *
 * Y el botón NO es el rojo lleno del viejo: el único relleno primario de la pantalla
 * es la acción del día. Dos primarios compitiendo es que no hay ninguno.
 */
function PendientesCard({ pendientes }: { pendientes: Pendientes }) {
  // ⚠️ «Al día» sólo si se leyó TODO. Con `aviso` (una lectura que falló) y cero
  // pendientes, la tarjeta decía «Datos al día — el tablero es confiable»: el falso
  // all-clear que `aviso` existe para evitar. Ver `estadoPendientes`.
  const estado = estadoPendientes(pendientes);
  const aviso = (pendientes.aviso ?? '').trim();
  const tipos = [
    { n: pendientes.porTipo.A, l: 'sin asistencia a R1' },
    { n: pendientes.porTipo.B, l: 'sin R2 ni resolución' },
    { n: pendientes.porTipo.C, l: 'sin asistencia a R2' },
    { n: pendientes.porTipo.M, l: 'nutrición manual vencida' },
  ].filter((x) => x.n > 0);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          {/* El número grande sólo cuando HAY algo que marcar. Un «0» de 34 px al lado
              de «datos al día» es un titular sobre la nada: el cero ya lo dice la
              frase, y pintarlo grande le da a lo que no pasó el peso de lo que pasa. */}
          {estado === 'por-marcar' && (
            <span style={{
              fontWeight: 700, fontSize: 'var(--fs-kpi)', letterSpacing: '-0.03em', lineHeight: 1,
              color: 'var(--bad)', fontVariantNumeric: 'tabular-nums',
            }}>
              {pendientes.total}
            </span>
          )}
          <h2 style={H2}>
            {estado === 'por-marcar'
              ? 'leads sin marcar bloquean la confiabilidad del tablero'
              : estado === 'sin-confirmar'
              ? 'No pude confirmar que los datos estén al día'
              : 'Datos al día — el tablero es confiable'}
          </h2>
        </div>
        {estado === 'por-marcar' && (
          <Link href="/crm" style={{
            flex: 'none', alignSelf: 'center', padding: '9px 16px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-strong)', background: 'transparent',
            color: 'var(--dim)', fontSize: 'var(--fs-md)', fontWeight: 500, textDecoration: 'none',
          }}>
            Marcar en el CRM →
          </Link>
        )}
      </div>

      {/* Qué no se pudo leer, con las palabras de quien lo detectó (lib/queries.ts). Con
          pendientes también va: el número es cierto, pero la lista puede estar incompleta. */}
      {aviso !== '' && (
        <p style={{ margin: '12px 0 0', fontSize: 'var(--fs-md)', color: 'var(--warn)' }}>{aviso}</p>
      )}

      {tipos.length > 0 && (
        <div style={{ marginTop: 18 }}>
          {tipos.map((t, i) => (
            <div key={t.l} style={{
              display: 'flex', alignItems: 'baseline', gap: 12,
              padding: '11px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}>
              <span style={{ fontWeight: 600, fontSize: 18, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{t.n}</span>
              <span style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)' }}>{t.l}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Los bloques nuevos (14/10/2026) ────────────────────────────────────────────────────────────────────────────────

const LISTA: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' };
const FILA: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)', minWidth: 0 };
const DIM: CSSProperties = { fontSize: 'var(--fs-md)', color: 'var(--dim)' };
const META: CSSProperties = { fontSize: 'var(--fs-meta)', color: 'var(--dim)', flex: 'none' };
const NOMBRE: CSSProperties = { fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, textDecoration: 'none' };

function Titulo({ texto, href, label }: { texto: string; href?: string; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
      <h2 style={H2}>{texto}</h2>
      {href && label && <Link href={href} style={{ fontSize: 'var(--fs-meta)', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>{label}</Link>}
    </div>
  );
}

/** Los objetivos del trimestre, cada uno con su avance contra el tiempo que pasó (la rayita es «dónde debería ir»). */
function ObjetivosLista({ v }: { v: Vista }) {
  return (
    <>
      <Titulo texto={`Objetivos del Q${v.qt.q}`} />
      {!v.objetivos.length ? <span style={DIM}>Todavía no hay objetivos para este trimestre.</span> : (
        <ul style={LISTA}>
          {v.objetivos.map((o) => {
            const pct = o.pct == null ? null : Math.max(0, Math.min(100, Math.round(o.pct)));
            const atrasado = !!o.ritmo && o.ritmo.desvio < 0;
            return (
              <li key={o.id} style={{ ...FILA, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                  <span style={NOMBRE}>{o.titulo}</span>
                  <span style={{ ...META, color: pct == null ? 'var(--dim)' : atrasado ? 'var(--warn)' : 'var(--good)', fontWeight: 600 }}>{pct == null ? 'Sin leer' : `${pct}%`}</span>
                </div>
                <div aria-hidden style={{ position: 'relative', height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct ?? 0}%`, height: '100%', borderRadius: 999, background: atrasado ? 'var(--warn-fill)' : 'var(--good)' }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.round(v.fraccionObjetivo * 100)}%`, width: 2, background: 'var(--ink)', opacity: 0.35 }} />
                </div>
                <span style={META}>{METRICA_LABEL[o.metrica]} · meta {o.unidad === 'usd' ? fmtUSD(o.metaValor) : fmtNum(o.metaValor)}{o.quarter == null ? ' · anual' : ''}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** «10:30» o «Todo el día». */
const horaDeItem = (it: ItemCalendario, tz: string) => (it.diaCompleto ? 'Todo el día' : horaDe(it.inicio, tz));
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const diaCorto = (fecha: string, hoy: string) => {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';
  const [y, m, d] = fecha.split('-').map(Number);
  return `${DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
};
/** El color de cada capa del Calendario (los de app/calendario/comun.ts: la paleta de Google). */
const COLOR_CAPA: Record<ItemCalendario['capa'], string> = { publicaciones: '#8e24aa', llamadas: '#039be5', bloques: '#33b679', plan: '#f4511e', objetivos: '#616161' };

function ListaDeItems({ items, tz, hoy, vacio, conDia }: { items: ItemCalendario[]; tz: string; hoy: string; vacio: string; conDia?: boolean }) {
  if (!items.length) return <span style={DIM}>{vacio}</span>;
  return (
    <ul style={LISTA}>
      {items.slice(0, 12).map((it) => {
        const color = it.google?.color ?? COLOR_CAPA[it.capa];
        const destino = it.href && it.href.startsWith('/') ? it.href : '/calendario';
        return (
          <li key={it.id} style={FILA}>
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: color, flex: 'none' }} />
            <span style={{ ...META, minWidth: conDia ? 92 : 64 }}>{conDia ? `${diaCorto(diaDe(it.inicio, tz), hoy)} · ` : ''}{horaDeItem(it, tz)}</span>
            <Link href={destino} style={NOMBRE}>{it.titulo}</Link>
            {it.detalle && <span style={META}>{it.detalle}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** El Calendario de los próximos 7 días, leído UNA vez: lo usan Mi día, las llamadas y las publicaciones. */
async function leerSemana(): Promise<{ items: ItemCalendario[]; tz: string; hoy: string; falla: boolean }> {
  const tz = await zonaDelCalendario();
  const hoy = diaDe(new Date().toISOString(), tz);
  const r = await leerCalendario(hoy, sumarDias(hoy, 7), tz);
  const falla = !!(r.fallos.propios || r.fallos.crm);
  const items = [...r.items].sort((a, b) => (a.diaCompleto === b.diaCompleto ? a.inicio.localeCompare(b.inicio) : a.diaCompleto ? -1 : 1));
  return { items, tz, hoy, falla };
}

// ── Las variables de un Texto ─────────────────────────────────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Los valores de las variables de un Texto para quien mira (lib/general-piezas.ts): su nombre, el negocio, hoy, el Q. */
export async function variablesDeQuienMira(): Promise<ValoresVariables> {
  const [s, ws, tz] = await Promise.all([
    getUsuarioActual().catch(() => null), getWorkspaceActual().catch(() => null), zonaDelCalendario().catch(() => 'UTC'),
  ]);
  let negocio = '';
  if (ws != null) {
    try {
      const { data } = await getSupabaseServer().from('workspaces').select('nombre').eq('id', ws).maybeSingle();
      negocio = ((data as { nombre?: string } | null)?.nombre ?? '').trim();
    } catch { /* sin nombre: la variable queda con sus llaves */ }
  }
  const ahora = new Date();
  const hoy = diaDe(ahora.toISOString(), tz);
  const [y, m, d] = hoy.split('-').map(Number);
  const hora = Number(horaDe(ahora.toISOString(), tz).slice(0, 2));
  const nombre = (s?.nombre ?? '').trim().split(/\s+/)[0] ?? '';
  return {
    saludo: saludoDeHora(hora),
    nombre,
    negocio,
    fecha: `${DIAS_LARGOS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} de ${MESES[m - 1]}`,
    trimestre: `Q${Math.floor((m - 1) / 3) + 1} ${y}`,
  };
}

// ── Todos los bloques ─────────────────────────────────────────────────────────────────────────────────────────────

const sinLeer = (que: string) => <span style={DIM}>No pude leer {que}.</span>;

/**
 * Hasta cuántos funnels se arman los bloques que se atan a uno («Tu funnel hoy», «A quién cobrarle»). Se arman TODOS de
 * entrada (como el resto de los bloques): elegir el funnel en el panel cambia el bloque sin volver al server.
 */
const TOPE_FUNNELS = 8;

/** «Tu funnel hoy» de cada funnel, contado ahora. Cada uno falla solo (null = no se pudo contar). */
async function contarFunnels(funnels: readonly FunnelDeGeneral[]): Promise<Map<number, ConteoFunnel | null>> {
  const conteos = await Promise.all(funnels.map((f) => conteoDelFunnel(f.id, f.nombre).catch((e) => {
    console.error('[general] funnel hoy:', f.id, e instanceof Error ? e.message : e);
    return null;
  })));
  return new Map(funnels.map((f, i) => [f.id, conteos[i]]));
}

/** Lo que /general le pasa al editor: los bloques ya dibujados (por `clavePieza`) y los funnels que se pueden elegir. */
export type PiezasArmadas = {
  piezas: Record<string, ReactNode>;
  /** null = no se pudieron leer (el panel no ofrece elegir). */
  funnels: Array<{ id: number; nombre: string }> | null;
};

/**
 * Todos los bloques de General, ya dibujados. Se arman TODOS (no sólo los de la hoja abierta): se puede insertar
 * cualquiera mientras se edita, y cambiar de hoja no vuelve al server. Cada lectura falla sola.
 */
export async function armarPiezas(): Promise<PiezasArmadas> {
  const cobranzaLeida = leerAQuienCobrar();
  const [v, plan, cobranza, funnels, semana] = await Promise.all([
    leerVistaGeneral().catch((e) => { console.error('[general] vista:', e instanceof Error ? e.message : e); return null; }),
    leerPlanHoy().catch((e) => { console.error('[general] plan:', e instanceof Error ? e.message : e); return null; }),
    cobranzaLeida,
    leerFunnelsDeGeneral(),
    leerSemana().catch((e) => { console.error('[general] calendario:', e instanceof Error ? e.message : e); return null; }),
  ]);

  // El mes: sus desgloses, sólo si la vista se leyó.
  let mes: ReactNode = sinLeer('el resumen del mes');
  if (v) {
    const mtd = compareMTD(v.ayer);
    let mtdBreak: RevenueBreakdowns = { sold: [], cash: [], outstanding: [] };
    let agendasMTD: AgendaItem[] = [];
    let senalesMTD: SenalRecon[] = [];
    try {
      [mtdBreak, agendasMTD, senalesMTD] = await Promise.all([
        getRevenueBreakdowns(mtd.actualInicio, mtd.actualFin),
        getAgendasBreakdown(mtd.actualInicio, mtd.actualFin),
        getSenalesRecon(mtd.actualInicio, mtd.actualFin),
      ]);
    } catch { /* las tarjetas muestran los números sin desglose */ }
    mes = (
      <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
          <h2 style={H2}>El mes</h2>
          {v.comparativo && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>vs. {v.comparativo.etiqueta_anterior}</span>}
        </div>
        {v.comparativo
          ? <ResumenMes c={v.comparativo} desgloses={desglosesDelMes(mtdBreak, agendasMTD, senalesMTD)} />
          // Esconder el bloque escondería el fallo: el mes sigue existiendo y la pantalla no diría que no lo pudo leer.
          : <span style={DIM}>No pude leer el resumen del mes.</span>}
      </>
    );
  }

  // Sólo las filas con una cuota que marcar («Marcar cobrada» marca la PRÓXIMA), con el MISMO renglón que el teléfono
  // (app/m/dashboard/datos.ts: «US$500 · vence el jue»). Lo fija tests/general-cobranza.test.ts.
  const cobros: CobroM[] = cobranza.ok ? cobranza.datos.filas.flatMap((f) => (f.cuota ? [{
    leadId: f.leadId, pagoId: f.cuota.pagoId, nombre: f.nombre,
    linea: `${fmtValor(f.cuota.monto, 'usd')} · ${textoVence(f.cuota.vence, f.dias)}`,
    urgencia: f.urgencia,
  }] : [])) : [];

  // Los bloques que se atan a un funnel (lib/general-piezas.ts, `piezaPorFunnel`): uno por funnel, hasta el tope.
  const atables = (funnels ?? []).slice(0, TOPE_FUNNELS);
  const principal = atables.find((f) => f.esDefault) ?? atables[0] ?? null;
  const [conteos, deQuien] = await Promise.all([
    contarFunnels(atables),
    // De qué funnel es cada cliente con cuotas: sólo esos (la lista chica), no los leads del negocio entero.
    atables.length && cobros.length
      ? funnelsDeLeads(cobros.map((c) => c.leadId)).catch((e) => { console.error('[general] cobranza por funnel:', e instanceof Error ? e.message : e); return null; })
      : Promise.resolve(new Map<number, Set<number>>()),
  ]);
  const funnelHoy = (f: FunnelDeGeneral | null) => {
    const c = f ? conteos.get(f.id) : null;
    // Sin funnels leídos o sin poder contar ESE: lo dice («No pude leer el CRM»), nunca «todavía no hay un funnel».
    return <FunnelHoy conteos={c ? [c] : []} error={funnels == null || (f != null && !c)} alcance="todo" />;
  };
  const porFunnel: Record<string, ReactNode> = {};
  for (const f of atables) {
    porFunnel[clavePieza('funnel', f.id)] = funnelHoy(f);
    porFunnel[clavePieza('cobranza', f.id)] = !cobranza.ok
      ? <Cobranza filas={[]} tz="" error="No pude leer la cobranza." alcance={f.nombre} />
      : deQuien == null
        // Un filtro que no se pudo armar no es «nadie debe»: lo dice.
        ? <Cobranza filas={[]} tz={cobranza.datos.tz} error="No pude leer de qué funnel es cada cliente." alcance={f.nombre} />
        : <Cobranza filas={cobros.filter((c) => deQuien.get(c.leadId)?.has(f.id))} tz={cobranza.datos.tz} error={null} alcance={f.nombre} />;
  }

  const deHoy = semana ? semana.items.filter((it) => diaDe(it.inicio, semana.tz) === semana.hoy && it.capa !== 'objetivos') : [];
  const haceUnaHora = new Date(Date.now() - 60 * 60_000).toISOString();
  const llamadas = semana ? semana.items.filter((it) => it.capa === 'llamadas' && it.fuente !== 'google' && it.inicio >= haceUnaHora) : [];
  const publicaciones = semana ? semana.items.filter((it) => it.capa === 'publicaciones') : [];

  const piezas: Record<string, ReactNode> = {
    ...porFunnel,
    cabecera: v ? <BloqueObjetivo v={v} /> : sinLeer('el objetivo del trimestre'),
    objetivos: v ? <ObjetivosLista v={v} /> : sinLeer('los objetivos'),
    kpis: v ? <BloqueKpis v={v} /> : sinLeer('los KPIs'),
    semaforo: v ? <BloqueSemaforo v={v} conCabecera={false} /> : sinLeer('el semáforo'),
    mes,
    pendientes: v ? <PendientesCard pendientes={v.pendientes} /> : sinLeer('los pendientes del CRM'),
    prioridades: <PrioridadesGeneral items={plan ? plan.prioridades : []} objetivo={plan ? plan.objetivo : null} error={!plan} />,
    cobranza: <Cobranza filas={cobros} tz={cobranza.ok ? cobranza.datos.tz : ''} error={cobranza.ok ? null : 'No pude leer la cobranza.'} />,
    funnel: funnelHoy(principal),
    agenda: semana ? (
      <>
        <Titulo texto="Mi día" href="/calendario?vista=dia" label="Abrir el Calendario" />
        <ListaDeItems items={deHoy} tz={semana.tz} hoy={semana.hoy} vacio={semana.falla ? 'No pude leer todo el Calendario.' : 'Nada agendado para hoy.'} />
      </>
    ) : sinLeer('el Calendario'),
    llamadas: semana ? (
      <>
        <Titulo texto="Próximas llamadas" href="/calendario?vista=agenda" label="Ver la agenda" />
        <ListaDeItems items={llamadas} tz={semana.tz} hoy={semana.hoy} conDia vacio="Ninguna llamada en los próximos 7 días." />
      </>
    ) : sinLeer('las llamadas'),
    publicaciones: semana ? (
      <>
        <Titulo texto="Próximas publicaciones" href="/calendario" label="Planear" />
        <ListaDeItems items={publicaciones.map((p) => ({ ...p, detalle: p.formato ? ROTULO_FORMATO[p.formato] : p.detalle }))} tz={semana.tz} hoy={semana.hoy} conDia vacio="Nada planeado para publicar esta semana." />
      </>
    ) : sinLeer('las publicaciones'),
  };
  return { piezas, funnels: funnels ? atables.map((f) => ({ id: f.id, nombre: f.nombre })) : null };
}
