// =============================================================================
// /admin/estrategia — la pantalla. Los números viven en `datos.ts`.
// =============================================================================
// ⚠️ SIN UN BYTE DE JAVASCRIPT PROPIO EN EL NAVEGADOR, como /admin/runway: todo se
// arma en el server. Las tortas son SVG dibujado acá (arcos), no recharts: recharts
// obliga a un componente 'use client' para algo que no se mueve. El «hover» de cada
// porción es el <title> nativo del SVG, y el dato entero está igual en la leyenda.
//
// ⚠️ EL TEXTO QUE SE DIBUJA ES CORTO (regla de la casa): título, rótulos y números.
// El porqué de cada cuenta va en `datos.ts`, al lado de la cuenta.
//
// ⚠️ COPY EN ESPAÑOL NEUTRO (tú o impersonal): esta carpeta está dentro del guard de
// voseo (tests/puente-panel-copy.test.ts). El imperativo de los verbos en -ir no lo
// ve el guard: se revisa a mano.

import type { CSSProperties, ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import './estrategia.css';
import {
  DESDE, HITOS, dia, pct, anclaje, faltan, num, usd,
  HITO_ANUNCIOS, HITO_PLATA, HITO_FIN, CAPITAL, VENTANA, OBJETIVO_MES_USD,
  PRECIO_PRO, PRECIO_GROWTH, PRECIO_GRUPAL, CUOTAS_GRUPAL, RENOVACION_GRUPAL_USD,
  TORTAS, porcentajes, type Torta, type ClavePorcion,
  CAC_GRUPAL, CAC_PRO, DEJA_GRUPAL, type FilaCac,
  TECHO_PRO, TECHO_GROWTH, LTV_PRO, LTV_GROWTH, VIDA_PRO, VIDA_GROWTH,
  COSTO_REFERIDO, COMISION_GRUPAL, COMISION_GRUPAL_PCT, DESCUENTO_MAX_97,
  PASOS, CANALES, DIAG, DIAG_PASOS, LOOM_PASOS, LOOM_MIRA, LOOM_DICE, ANALISIS, DUDA,
  ASISTE, CIERRA, AGENDADAS, EFECTIVAS, VENTAS, PAUTA, FACTURADO, NETO, COBRADO_EN_EL_MES,
  VENTAS_OBJETIVO, AGENDAS_OBJETIVO, COSTO_POR_AGENDA, FUTURO,
} from './datos';

// ── Iconos mínimos (trazo, 24×24) ────────────────────────────────────────────
const I = {
  megafono: ['M18 8a3 3 0 0 1 0 6', 'M10 8v11a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-5', 'M12 8h0l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8'],
  chat: ['M8 9h8', 'M8 13h6', 'M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z'],
  video: ['M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z', 'M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'],
  chev: ['M9 6l6 6l-6 6'],
  check: ['M5 12l4 4l10 -10'],
  flecha: ['M5 12l14 0', 'M13 18l6 -6', 'M13 6l6 6'],
  persona: ['M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  comparte: ['M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M8.7 10.7l6.6 -3.4', 'M8.7 13.3l6.6 3.4'],
  edificio: ['M3 21l18 0', 'M9 8l1 0', 'M9 12l1 0', 'M9 16l1 0', 'M14 8l1 0', 'M14 12l1 0', 'M14 16l1 0', 'M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16'],
  grupo: ['M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2', 'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0 -3 -3.85'],
  pagina: ['M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z', 'M3 9h18', 'M7 13h6', 'M7 16h10'],
  etiqueta: ['M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3z'],
  barras: ['M3 21h18', 'M6 17v-5', 'M12 17v-10', 'M18 17v-7'],
  cruz: ['M18 6l-12 12', 'M6 6l12 12'],
  igual: ['M5 10h14', 'M5 14h14'],
} as const;

function Ic({ d, size = 18 }: { d: readonly string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => <path key={p} d={p} />)}
    </svg>
  );
}

const minCol = (px: number) => ({ ['--min' as string]: `${px}px` }) as CSSProperties;

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="est-sec">
      <h2 className="est-h2">{titulo}</h2>
      {children}
    </section>
  );
}

// ── a. Las cifras ────────────────────────────────────────────────────────────
function Cifras({ hoy }: { hoy: string }) {
  const aAnuncios = faltan(HITO_ANUNCIOS.fecha, hoy);
  const aPlata = faltan(HITO_PLATA.fecha, hoy);
  const cifras: { clave: string; valor: string; sub: string; k: string; ink?: string }[] = [
    {
      clave: 'Capital restante', valor: CAPITAL, k: 'var(--bad)', ink: 'var(--bad)',
      sub: aPlata > 0 ? `Se acaba el ${HITO_PLATA.rotulo} · en ${aPlata} días` : `Se acabó el ${HITO_PLATA.rotulo}`,
    },
    {
      clave: 'A los anuncios', k: 'var(--primary)',
      valor: aAnuncios > 0 ? `${aAnuncios} días` : 'En curso',
      sub: `Arrancan el ${HITO_ANUNCIOS.rotulo}`,
    },
    { clave: 'Ventana de venta', valor: VENTANA, k: 'var(--mako)', sub: `${HITO_ANUNCIOS.rotulo} → ${HITO_FIN.rotulo}` },
    // El objetivo NO es lo que proyecta el embudo: el sub dice cuánto proyecta, para que no se lean como lo mismo.
    { clave: 'Objetivo del mes', valor: usd(OBJETIVO_MES_USD), k: 'var(--good)', ink: 'var(--good)', sub: `Proyección: ${usd(FACTURADO)}` },
  ];
  return (
    <div className="est-grid" style={minCol(200)}>
      {cifras.map((c) => (
        <div key={c.clave} className="est-kpi" style={{ ['--k' as string]: c.k, ['--k-ink' as string]: c.ink } as CSSProperties}>
          <p className="est-eyebrow" style={{ margin: 0 }}>{c.clave}</p>
          <p className="est-kpi-v est-num">{c.valor}</p>
          <p className="est-kpi-s">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── b. El calendario ─────────────────────────────────────────────────────────
function Riel({ hoy }: { hoy: string }) {
  const pHoy = pct(hoy);
  const hoyEnRiel = pHoy >= 0 && pHoy <= 100;
  // La lista (sólo en caja angosta): los hitos en orden, con HOY intercalado.
  const lista = [
    ...HITOS.map((h) => ({ fecha: h.fecha, rotulo: h.rotulo, nota: h.nota ?? '', malo: h.tono === 'malo', hoy: false })),
    ...(hoyEnRiel ? [{ fecha: hoy, rotulo: 'HOY', nota: '', malo: false, hoy: true }] : []),
  ].sort((a, b) => dia(a.fecha) - dia(b.fecha) || (a.hoy ? -1 : 1));

  return (
    <div className="est-caja est-riel-caja">
      <div className="est-riel">
        <div className="est-riel-pista" />
        <div className="est-riel-plata" style={{ width: `${pct(HITO_PLATA.fecha)}%` }}
          title={`Capital: del ${DESDE} al ${HITO_PLATA.fecha}`} />
        <div className="est-riel-ventana" style={{ left: `${pct(HITO_ANUNCIOS.fecha)}%` }}
          title={`Ventana de venta: del ${HITO_ANUNCIOS.fecha} al ${HITO_FIN.fecha}`} />
        {HITOS.map((h, i) => {
          const p = pct(h.fecha);
          const cls = [
            'est-riel-linea',
            h.tono === 'malo' ? 'est-riel-linea--malo' : h.peso === 'fuerte' ? 'est-riel-linea--fuerte' : '',
            dia(h.fecha) < dia(hoy) ? 'est-riel-linea--pasado' : '',
          ].join(' ');
          return (
            <div key={h.fecha} className={cls} style={{ left: `${p}%` }}>
              {h.nota && (
                // Dos renglones alternados: con 4 días entre dos hitos, dos notas en el mismo renglón se pisan.
                <span className="est-riel-nota" style={{ top: i % 2 ? 21 : 0, transform: anclaje(p) }}>{h.nota}</span>
              )}
              <span className={`est-riel-fecha${h.tono === 'malo' ? ' est-riel-fecha--malo' : ''}`} style={{ transform: anclaje(p) }}>
                {h.rotulo}
              </span>
            </div>
          );
        })}
        {hoyEnRiel && (
          <div className="est-riel-hoy" style={{ left: `${pHoy}%` }}>
            <span style={{ transform: anclaje(pHoy) }}>HOY</span>
          </div>
        )}
      </div>

      <div className="est-ley-riel">
        <span><i style={{ background: 'linear-gradient(90deg, var(--good), var(--warn-fill) 60%, var(--bad))' }} />Capital</span>
        <span><i style={{ background: 'var(--primary)' }} />Ventana de venta</span>
      </div>

      <div className="est-hitos">
        {lista.map((h) => {
          const n = faltan(h.fecha, hoy);
          const cls = ['est-hito', h.malo ? 'est-hito--malo' : '', h.hoy ? 'est-hito--hoy' : '', !h.hoy && n < 0 ? 'est-hito--pasado' : ''].join(' ');
          return (
            <div key={`${h.fecha}-${h.rotulo}`} className={cls}>
              <b>{h.rotulo}</b>
              <span>{h.nota}</span>
              <small>{h.hoy ? '' : n > 0 ? `en ${n} días` : n === 0 ? 'hoy' : ''}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── c. La oferta ─────────────────────────────────────────────────────────────
function Oferta() {
  const cuota = PRECIO_GRUPAL / CUOTAS_GRUPAL;
  return (
    <div className="est-grid" style={minCol(250)}>
      <div className="est-plan">
        <span className="est-eyebrow">Software</span>
        <div className="est-precio"><b className="est-num">{usd(PRECIO_PRO)}</b><span>/ mes</span></div>
        <div className="est-arbol">
          <span className="est-nodo est-nodo--padre est-nodo--solo"><Ic d={I.persona} size={14} /> Tu negocio · {num(PRECIO_PRO)}</span>
        </div>
        <p className="est-pie">Un workspace: el tuyo</p>
      </div>

      <div className="est-plan est-plan--97">
        <span className="est-eyebrow">Software + agencia</span>
        <div className="est-precio"><b className="est-num">{usd(PRECIO_GROWTH)}</b><span>/ mes</span></div>
        <div className="est-arbol">
          <span className="est-nodo est-nodo--padre">Tu cuenta · {num(PRECIO_GROWTH)}</span>
          <div className="est-hijos">
            <span className="est-nodo">Cliente · {num(PRECIO_PRO)}</span>
            <span className="est-nodo">Cliente · {num(PRECIO_GROWTH)}</span>
          </div>
        </div>
        <p className="est-pie">Cada workspace de cliente paga su plan</p>
      </div>

      <div className="est-plan est-plan--grupal">
        <span className="est-eyebrow">Programa grupal</span>
        <div className="est-precio"><b className="est-num">{usd(PRECIO_GRUPAL)}</b><span>{CUOTAS_GRUPAL} meses de entrega</span></div>
        <div className="est-cuotas">
          {Array.from({ length: CUOTAS_GRUPAL }, (_, i) => (
            <div key={i} className="est-cuota">
              <b className="est-num">{usd(cuota)}</b>
              <span>Cuota {i + 1}</span>
            </div>
          ))}
        </div>
        <p className="est-pie">Renueva: {usd(RENOVACION_GRUPAL_USD)} cada 3 meses · o {usd(PRECIO_GROWTH)}/mes sólo software</p>
      </div>
    </div>
  );
}

// ── d. A dónde va cada dólar ─────────────────────────────────────────────────
const COLOR: Record<ClavePorcion, string> = {
  ganancia: 'var(--est-s-ganancia)',
  conseguir: 'var(--est-s-conseguir)',
  servir: 'var(--est-s-servir)',
  reembolso: 'var(--est-s-reembolso)',
  cobro: 'var(--est-s-cobro)',
};
const TINTA: Record<ClavePorcion, string> = {
  // Sobre el verde, tinta oscura: el blanco da 3,39:1 en claro.
  ganancia: 'var(--est-s-tinta-verde)',
  conseguir: 'var(--est-s-tinta-oro)',
  servir: 'var(--est-s-tinta)',
  reembolso: 'var(--est-s-tinta)',
  cobro: 'var(--est-s-tinta)',
};

/** Un anillo entre los ángulos a0 y a1 (radianes, 0 = arriba, sentido horario). */
function arco(a0: number, a1: number, R: number, r: number): string {
  const p = (a: number, rad: number) => `${(rad * Math.sin(a)).toFixed(3)} ${(-rad * Math.cos(a)).toFixed(3)}`;
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(a0, R)} A${R} ${R} 0 ${grande} 1 ${p(a1, R)} L${p(a1, r)} A${r} ${r} 0 ${grande} 0 ${p(a0, r)} Z`;
}

function Dona({ t }: { t: Torta }) {
  const R = 94;
  const r = 60;
  const pcts = porcentajes(t.porciones.map((p) => p.usd), t.total);
  let acumulado = 0;
  const arcos = t.porciones.map((p, i) => {
    const a0 = (acumulado / t.total) * 2 * Math.PI;
    acumulado += p.usd;
    const a1 = (acumulado / t.total) * 2 * Math.PI;
    return { p, pct: pcts[i], a0, a1 };
  });
  return (
    <div className="est-caja est-torta">
      <p className="est-eyebrow" style={{ margin: 0, alignSelf: 'flex-start' }}>{t.nombre}</p>
      <svg className="est-dona" viewBox="-100 -100 200 200" role="img"
        aria-label={`${t.nombre}, ${usd(t.total)}: ${t.porciones.map((p, i) => `${p.label} ${usd(p.usd)} (${num(pcts[i], 1)}%)`).join(', ')}`}>
        {arcos.map(({ p, pct: pc, a0, a1 }) => (
          <path key={p.clave} d={arco(a0, a1, R, r)} style={{ fill: COLOR[p.clave] }}>
            <title>{`${p.label}: ${usd(p.usd)} · ${num(pc, 1)}% · ${p.cuenta}`}</title>
          </path>
        ))}
        {/* El % adentro sólo en las porciones grandes: en una chica no entra (la leyenda lo trae igual). */}
        {arcos.filter((a) => a.pct >= 10).map(({ p, a0, a1 }) => {
          const m = (a0 + a1) / 2;
          const rr = (R + r) / 2;
          return (
            <text key={p.clave} x={(rr * Math.sin(m)).toFixed(2)} y={(-rr * Math.cos(m)).toFixed(2)}
              textAnchor="middle" dominantBaseline="central" className="est-dona-pct" style={{ fill: TINTA[p.clave] }}>
              {/* Del valor CRUDO: redondear el % ya redondeado a un decimal da 21% sobre un 20,47%. */}
              {Math.round((p.usd / t.total) * 100)}%
            </text>
          );
        })}
        <text className="est-dona-total" y={-2} textAnchor="middle" style={{ fontSize: t.total >= 1000 ? 22 : 28 }}>
          {usd(t.total)}
        </text>
        <text className="est-dona-unidad" y={18} textAnchor="middle">{t.unidad}</text>
      </svg>
      <ul className="est-ley">
        {t.porciones.map((p, i) => (
          <li key={p.clave} className={i === 0 ? 'est-ley--heroe' : undefined} title={p.cuenta}>
            <span className="est-sw" style={{ background: COLOR[p.clave] }} />
            <span>{p.label}</span>
            <span className="est-ley-usd est-num">{usd(p.usd)}</span>
            <span className="est-ley-pct est-num">{num(pcts[i], 1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── e. Lo que cuesta conseguir un cliente ────────────────────────────────────
/** El tope de una escala: el múltiplo de 50 de arriba. */
const tope = (...v: number[]) => Math.ceil(Math.max(...v) / 50) * 50;
/** ⚠️ Recortado al 100%: un valor por encima del tope desborda la PÁGINA, no la barra. */
const ancho = (v: number, max: number) => `${Math.min(100, (v / max) * 100)}%`;

/**
 * Costo de conseguir un cliente contra UN techo, con la marca del techo rotulada.
 * Se usa dos veces (el grupal y el 47 vendido solo): cada uno con su escala y su
 * techo, porque 1.190 y 81 en la misma escala dejan las barras del 47 en nada.
 */
function CostoContraTecho({ filas, techo, rotuloTecho }: { filas: FilaCac[]; techo: number; rotuloTecho: string }) {
  const max = tope(...filas.map((c) => c.usd), techo);
  const pT = (techo / max) * 100;
  const orden = [...filas].sort((a, b) => b.usd - a.usd);
  return (
    <div className="est-caja">
      <div className="est-barras">
        <div className="est-fila" aria-hidden="true">
          <span className="est-fila-l" />
          <div style={{ position: 'relative', height: 16 }}>
            <span className="est-techo-cab" style={{ left: `${pT}%`, transform: anclaje(pT) }}>{rotuloTecho} · {usd(techo)}</span>
          </div>
          <span />
        </div>
        {orden.map((c) => {
          const entra = c.usd <= techo;
          return (
            <div key={c.label} className="est-fila">
              <span className="est-fila-l">{c.label}</span>
              <div className="est-carril" title={`${c.label}: ${usd(c.usd)} por cliente · ${c.detalle}`}>
                <div className={`est-barra ${entra ? 'est-barra--entra' : 'est-barra--no'}`} style={{ width: ancho(c.usd, max) }} />
                <div className="est-techo" style={{ left: `${pT}%` }} />
              </div>
              <span className="est-fila-v est-num">
                {usd(c.usd)}
                {c.nota
                  ? <small>{c.nota}</small>
                  : <small className={`est-cabe ${entra ? 'est-cabe--si' : 'est-cabe--no'}`}>{entra ? '✓ entra' : '✕ no entra'}</small>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Ltv() {
  const max = Math.max(LTV_PRO, LTV_GROWTH);
  const filas = [
    { label: `Plan de ${num(PRECIO_PRO)}`, ltv: LTV_PRO, techo: TECHO_PRO, vida: VIDA_PRO },
    { label: `Plan de ${num(PRECIO_GROWTH)}`, ltv: LTV_GROWTH, techo: TECHO_GROWTH, vida: VIDA_GROWTH },
  ];
  return (
    <div className="est-caja">
      <div className="est-barras">
        {filas.map((f) => (
          <div key={f.label} className="est-fila">
            <span className="est-fila-l">{f.label} <span className="est-pie" style={{ display: 'inline' }}>· {num(f.vida, 1)} meses</span></span>
            {/* Estilo bullet chart: el techo es una barra FINA centrada adentro de la del LTV,
                así se lee «techo dentro del LTV» y no una barra apilada oro + verde. */}
            <div className="est-carril" style={{ height: 22 }}>
              <div className="est-barra est-barra--ltv" style={{ width: ancho(f.ltv, max) }} title={`LTV: ${usd(f.ltv)}`} />
              <div className="est-barra est-barra--techo" style={{ width: ancho(f.techo, max) }} title={`Techo de CAC: ${usd(f.techo)}`} />
            </div>
            <span className="est-fila-v est-num">{usd(f.ltv)}<small>techo {usd(f.techo)}</small></span>
          </div>
        ))}
      </div>
      <div className="est-ley-riel">
        <span><i className="est-sw-ltv" />Lo que deja en su vida (LTV)</span>
        <span><i style={{ background: 'var(--mako)', height: 4 }} />Lo máximo para conseguirlo</span>
      </div>
    </div>
  );
}

// ── f. Estrategia de adquisición ─────────────────────────────────────────────
/**
 * Los tres pasos, uno al lado del otro. `detalle[i]` va en el `title` del paso: las
 * viñetas de la página vieja (qué se mira, qué se le dice) quedan a un hover y no
 * se dibujan — poco texto, pedido del 10/10.
 */
function Mini({ pasos, verde, detalle = [] }: { pasos: readonly string[]; verde?: boolean; detalle?: readonly (readonly string[] | undefined)[] }) {
  return (
    <div className={`est-mini${verde ? ' est-mini--A' : ''}`}>
      {pasos.map((s, i) => (
        <div key={s} className="est-mini-i" title={detalle[i]?.join(' · ')}>
          <b className="est-num">{i + 1}</b><span>{s}</span>
        </div>
      ))}
    </div>
  );
}

function Adquisicion() {
  // La MISMA escala para los dos embudos: si no, 400 y 1.000 se dibujan del mismo largo.
  const maxEmbudo = Math.max(...CANALES.flatMap((c) => c.embudo.map((e) => e.n)));
  return (
    <>
      <div className="est-flujo">
        {PASOS.map((p, i) => (
          <div key={p.n} style={{ display: 'contents' }}>
            {i > 0 && <div className="est-flecha"><Ic d={I.chev} size={24} /></div>}
            <div className={`est-paso${i === PASOS.length - 1 ? ' est-paso--fin' : ''}`}>
              <div className="est-paso-ic"><Ic d={I[p.icono]} size={24} /></div>
              <span className="est-paso-n">{p.n}</span>
              <h3>{p.t}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="est-grid" style={{ ...minCol(300), marginTop: 14 }}>
        {CANALES.map((c) => (
          <div key={c.id} className={`est-caja est-canal est-canal--${c.id}`}>
            <div className="est-canal-hd">
              <span className="est-canal-id">{c.id}</span>
              <div>
                <h3 className="est-h3">{c.nombre}</h3>
                <span className="est-canal-sub">{c.sub}</span>
              </div>
              <span className={`est-chip ${c.inversion ? 'est-chip--azul' : 'est-chip--verde'}`}>
                {c.inversion ? usd(c.inversion) : 'Costo cero'}
              </span>
            </div>
            {c.hechos.map((h) => <div key={h} className="est-hecho"><b>{h}</b></div>)}
            {c.fases && (
              <>
                <div className="est-fases" role="img" aria-label={c.fases.map((f) => `${f.t} ${usd(f.usd)}`).join(', ')}>
                  {c.fases.map((f, i) => (
                    <div key={f.t} className={`est-fase est-num${i ? ' est-fase--2' : ''}`} style={{ flex: `${f.usd} 1 0` }}>
                      {usd(f.usd)}
                    </div>
                  ))}
                </div>
                <div className="est-fases-rot" aria-hidden="true">
                  {c.fases.map((f, i) => (
                    <span key={f.t} style={{ flex: `${f.usd} 1 0` }}><b>Fase {i + 1}</b> · {f.t}</span>
                  ))}
                </div>
              </>
            )}
            <div className="est-embudo">
              {c.embudo.map((e, i) => (
                <div key={e.l} className={`est-escalon${i === c.embudo.length - 1 ? ' est-escalon--fin' : ''}`}>
                  <div className="est-escalon-hd">
                    <span>{e.l}</span>
                    {e.tasa && <small>{e.tasa}</small>}
                    <b className="est-num">{num(e.n)}</b>
                  </div>
                  <div className="est-carril"><div className="est-barra" style={{ width: ancho(e.n, maxEmbudo) }} /></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="est-sub">El lead magnet y el Loom</p>
      <div className="est-grid" style={minCol(300)}>
        <div className="est-caja est-canal est-canal--B">
          <div>
            <span className="est-chip est-chip--azul">Campaña de mensajes</span>
            <h3 className="est-h3" style={{ marginTop: 8 }}>Diagnóstico de anuncios</h3>
          </div>
          <Mini pasos={DIAG_PASOS} detalle={[undefined, undefined, DIAG]} />
          <div className="est-puente"><span>Su anuncio</span><Ic d={I.flecha} size={16} /><span>Su funnel completo, en la llamada</span></div>
        </div>
        <div className="est-caja est-canal est-canal--A">
          <div>
            <span className="est-chip est-chip--verde">Prospección</span>
            <h3 className="est-h3" style={{ marginTop: 8 }}>Un Loom VSL por cada lead</h3>
          </div>
          <Mini pasos={LOOM_PASOS} verde detalle={[LOOM_MIRA, LOOM_DICE]} />
        </div>
      </div>

      <p className="est-sub">Por qué agenda la llamada</p>
      <div className="est-caja" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <p className="est-cita">«Sales de la llamada con toda tu estrategia para conseguir clientes con anuncios pagados, armada para tu negocio.»</p>
        {/* Sólo el título y su ícono; la frase de cada eje va en el title. */}
        <div className="est-ejes">
          {ANALISIS.map((a) => (
            <div key={a.t} className="est-eje" title={a.w}>
              <span className="est-eje-ic"><Ic d={I[a.icono]} size={20} /></span>
              <strong>{a.t}</strong>
            </div>
          ))}
        </div>
        <div className="est-que-como">
          <div className="est-que"><b>Se dice el QUÉ</b><p>Qué está mal, qué le falta y qué hay que hacer, sobre su negocio.</p></div>
          <div className="est-como"><b>Nunca el CÓMO</b><p>Cómo se ejecuta es lo que se compra. Si se regala, no queda nada que vender.</p></div>
        </div>
        <p className="est-pie" style={{ fontSize: 13.5 }}>«Esto es lo que hay que hacer; puedes intentarlo por tu cuenta, o lo hacemos juntos.»</p>
      </div>

      <p className="est-sub">¿Realmente conviene hacerlo personalizado?</p>
      <DudaMatriz />
    </>
  );
}

/** La duda como matriz: un criterio por fila, con ✓ / ✕ / = en cada lado. */
function DudaMatriz() {
  const marca = (lado: 'con' | 'sin', gana: 'con' | 'sin' | 'empate') =>
    gana === 'empate' ? { cls: 'est-marca--igual', d: I.igual, txt: 'empate' }
      : gana === lado ? { cls: 'est-marca--si', d: I.check, txt: 'mejor' }
        : { cls: 'est-marca--no', d: I.cruz, txt: 'peor' };
  const cuenta = (lado: 'con' | 'sin') => DUDA.filter((f) => f.gana === lado).length;
  return (
    <div className="est-caja est-duda" role="table" aria-label="Con personalización contra sin personalización">
      <div className="est-duda-fila est-duda-fila--cab" role="row">
        <span role="columnheader" />
        <span role="columnheader" className="est-duda-cab est-duda-cab--con">Con personalización <b className="est-num">{cuenta('con')}</b></span>
        <span role="columnheader" className="est-duda-cab">Sin personalización <b className="est-num">{cuenta('sin')}</b></span>
      </div>
      {DUDA.map((f) => (
        <div key={f.criterio} className="est-duda-fila" role="row" title={f.detalle}>
          <span role="rowheader" className="est-duda-crit">{f.criterio}</span>
          {(['con', 'sin'] as const).map((lado) => {
            const m = marca(lado, f.gana);
            return (
              <span key={lado} role="cell" className="est-duda-celda">
                <span className={`est-marca ${m.cls}`} role="img" aria-label={m.txt}><Ic d={m.d} size={13} /></span>
                <span>{f[lado]}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── g. Proyección ────────────────────────────────────────────────────────────
function Proyeccion() {
  const deCanal = CANALES.map((c) => `${c.embudo.at(-1)?.n ?? 0} de ${c.nombre.toLowerCase()}`).join(' + ');
  const escalones = [
    { l: 'Agendadas', n: AGENDADAS, tasa: deCanal },
    { l: 'Efectivas', n: EFECTIVAS, tasa: `${num(ASISTE * 100)}% asiste` },
    { l: 'Ventas', n: VENTAS, tasa: `${num(CIERRA * 100)}% cierra` },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="est-caja est-proy">
        {escalones.map((e, i) => (
          <div key={e.l} className={`est-escalon${i === escalones.length - 1 ? ' est-escalon--fin' : ''}`}>
            <div className="est-escalon-hd">
              <span>{e.l}</span>
              <small>{e.tasa}</small>
              <b className="est-num">{num(e.n)}</b>
            </div>
            <div className="est-carril"><div className="est-barra" style={{ width: ancho(e.n, AGENDADAS) }} /></div>
          </div>
        ))}
      </div>
      {/* Lo FACTURADO sale de las ventas × el precio del grupal, no del objetivo: el
          objetivo se dibuja abajo, aparte, con la brecha a la vista. */}
      <div className="est-cuenta">
        <div className="est-cuenta-i" title={`En ${CUOTAS_GRUPAL} cuotas: en el mes entran ${usd(COBRADO_EN_EL_MES)}`}>
          <span className="est-eyebrow">Vendido</span>
          <b className="est-num">{usd(FACTURADO)}</b>
          <small className="est-cuenta-s est-num">{num(VENTAS)} × {usd(PRECIO_GRUPAL)}</small>
        </div>
        <span className="est-op" aria-hidden="true">−</span>
        <div className="est-cuenta-i"><span className="est-eyebrow">Ads</span><b className="est-num">{usd(PAUTA)}</b></div>
        <span className="est-op" aria-hidden="true">=</span>
        <div className="est-cuenta-i est-cuenta-i--neto"><span className="est-eyebrow">Neto</span><b className="est-num">{usd(NETO)}</b></div>
      </div>
      <Brecha />
      <div><span className="est-chip est-chip--gris"><span className="est-num">{usd(COSTO_POR_AGENDA)}</span> por agenda de la campaña</span></div>
    </div>
  );
}

/** Lo proyectado contra el objetivo: una barra, y lo que falta para llegar. */
function Brecha() {
  const p = Math.min(100, (FACTURADO / OBJETIVO_MES_USD) * 100);
  const falta = Math.max(0, OBJETIVO_MES_USD - FACTURADO);
  return (
    <div className="est-caja est-brecha">
      <div className="est-brecha-hd">
        <span className="est-eyebrow">Objetivo del mes</span>
        <b className="est-num">{usd(OBJETIVO_MES_USD)}</b>
      </div>
      <div className="est-brecha-carril" role="img"
        aria-label={`Proyección ${usd(FACTURADO)} de un objetivo de ${usd(OBJETIVO_MES_USD)}`}>
        <div className="est-brecha-llena" style={{ width: `${p}%` }}><span className="est-num">{usd(FACTURADO)}</span></div>
        {falta > 0 && <div className="est-brecha-falta"><span className="est-num">−{usd(falta)}</span></div>}
      </div>
      {falta > 0 && (
        <p className="est-brecha-pie">
          Para llegar: <b className="est-num">{num(VENTAS_OBJETIVO)} ventas</b> ≈ <b className="est-num">{num(AGENDAS_OBJETIVO)} agendas</b>
        </p>
      )}
    </div>
  );
}

// ── h. Referidos ─────────────────────────────────────────────────────────────
function Referidos() {
  const max = tope(...COSTO_REFERIDO.flatMap((c) => [c.usd, c.techo]));
  const cuota = COMISION_GRUPAL / CUOTAS_GRUPAL;
  // Los pies van en UN renglón; el detalle de cada regla, en el title de la tarjeta.
  // Cada lado de una ecuación es un grupo que no se parte: el corte cae ANTES del
  // operador, nunca deja un «47 + 47 =» colgando al final del renglón.
  return (
    <>
      <div className="est-grid est-grid--2x2">
        <div className="est-caja est-quien" title={`Plan de ${num(PRECIO_PRO)}: el primer mes gratis. Plan de ${num(PRECIO_GROWTH)}: como mucho ${num(DESCUENTO_MAX_97 * 100)}% del primer mes.`}>
          <div className="est-quien-hd"><span className="est-quien-ic"><Ic d={I.persona} /></span><h3 className="est-h3">El que llega</h3></div>
          <div className="est-gana"><span className="est-nodo">Plan de {num(PRECIO_PRO)}</span><span className="est-eq-lado"><Ic d={I.flecha} size={14} /><span className="est-gana-txt">1er mes gratis</span></span></div>
          <div className="est-gana"><span className="est-nodo">Plan de {num(PRECIO_GROWTH)}</span><span className="est-eq-lado"><Ic d={I.flecha} size={14} /><span className="est-gana-txt">Hasta {num(DESCUENTO_MAX_97 * 100)}%</span></span></div>
          <p className="est-pie">Del primer mes</p>
        </div>

        <div className="est-caja est-quien" title="El primer mes de cada cliente nuevo se le descuenta de su suscripción, una sola vez. Lo que sobra se acumula. Cuenta cuando el cliente ya pagó 2 meses.">
          <div className="est-quien-hd"><span className="est-quien-ic"><Ic d={I.comparte} /></span><h3 className="est-h3">El que refiere</h3></div>
          <div className="est-eq">
            <span className="est-eq-lado"><span className="est-nodo">{num(PRECIO_PRO)}</span><i>+</i><span className="est-nodo">{num(PRECIO_PRO)}</span></span>
            <span className="est-eq-lado"><i>=</i><span className="est-nodo est-nodo--gratis">Su mes de {num(PRECIO_GROWTH)} gratis</span></span>
          </div>
          <div className="est-eq">
            <span className="est-eq-lado"><span className="est-nodo">{num(PRECIO_GROWTH)}</span></span>
            <span className="est-eq-lado"><i>=</i><span className="est-nodo est-nodo--gratis">Su mes de {num(PRECIO_GROWTH)} gratis</span></span>
          </div>
          <p className="est-pie">Desde su 2º pago · se acumula</p>
        </div>

        <div className="est-caja est-quien" title="Primero se le descuenta de su suscripción; una vez cubierta, lo que sobra se le paga en efectivo, por transferencia local.">
          <div className="est-quien-hd"><span className="est-quien-ic"><Ic d={I.edificio} /></span><h3 className="est-h3">Revendedor</h3></div>
          <div className="est-tramo" role="img" aria-label="Primero se descuenta de su suscripción; lo que sobra, en efectivo">
            <span>Suscripción</span>
            <span>Efectivo</span>
          </div>
          <p className="est-pie">Lo que sobra, por transferencia</p>
        </div>

        <div className="est-caja est-quien est-quien--grupal" title={`En efectivo, el ${num(COMISION_GRUPAL_PCT)}% de cada cuota. Lo puede referir cualquiera. Sin comisión si hay reembolso.`}>
          <div className="est-quien-hd"><span className="est-quien-ic"><Ic d={I.grupo} /></span><h3 className="est-h3">Grupal</h3></div>
          <span className="est-gana-big est-num">{usd(COMISION_GRUPAL)}</span>
          <div className="est-eq">
            <span className="est-nodo est-num">{num(CUOTAS_GRUPAL)} × {usd(cuota)}</span>
          </div>
          <p className="est-pie">{num(COMISION_GRUPAL_PCT)}% de cada cuota</p>
        </div>
      </div>

      <p className="est-sub">Costo de un referido vs. techo</p>
      <div className="est-caja">
        <div className="est-barras">
          {COSTO_REFERIDO.map((c) => {
            const entra = c.usd <= c.techo;
            const pT = (c.techo / max) * 100;
            return (
              <div key={c.clave} className="est-fila">
                <span className="est-fila-l">{c.label}</span>
                <div className="est-carril" title={`${c.label}: ${usd(c.usd)} (${c.cuenta}) · techo ${usd(c.techo)}`}>
                  <div className={`est-barra ${entra ? 'est-barra--entra' : 'est-barra--no'}`} style={{ width: ancho(c.usd, max) }} />
                  <div className="est-techo" style={{ left: `${pT}%` }} />
                </div>
                <span className="est-fila-v est-num">{usd(c.usd)}<small>techo {usd(c.techo)}</small></span>
              </div>
            );
          })}
        </div>
        <div className="est-ley-riel">
          <span><i style={{ background: 'var(--good)' }} />Costo esperado</span>
          <span><i style={{ background: 'var(--ink)', width: 3 }} />Techo de CAC</span>
        </div>
      </div>
    </>
  );
}

// ── i. Canales a futuro ──────────────────────────────────────────────────────
const TONO_FUTURO = { ok: 'est-chip--verde', caja: 'est-chip--azul', palanca: 'est-chip--oro' } as const;

function Futuro() {
  return (
    <div className="est-grid" style={minCol(200)}>
      {/* Letra, chip y título: el párrafo de cada canal va en el title (poco texto). */}
      {FUTURO.map((c) => (
        <div key={c.id} className={`est-caja est-futuro${c.tono === 'palanca' ? ' est-futuro--palanca' : ''}`} title={c.que}>
          <div className="est-futuro-hd">
            <span className="est-futuro-id">{c.id}</span>
            <span className={`est-chip ${TONO_FUTURO[c.tono]}`}>{c.costo}</span>
          </div>
          <h3 className="est-h3" style={{ fontSize: 15 }}>{c.nombre}</h3>
        </div>
      ))}
    </div>
  );
}

// ── La página ────────────────────────────────────────────────────────────────
export default function Estrategia({ hoy }: { hoy: string }) {
  return (
    <div className="est">
      <Cifras hoy={hoy} />

      <Seccion titulo="Calendario"><Riel hoy={hoy} /></Seccion>

      <Seccion titulo="La oferta"><Oferta /></Seccion>

      <Seccion titulo="A dónde va cada dólar">
        {/* 280 y no 250: con tres columnas de ~250 la leyenda partía «Captación» y «reembolso». */}
        <div className="est-grid" style={minCol(280)}>
          {TORTAS.map((t) => <Dona key={t.clave} t={t} />)}
        </div>
      </Seccion>

      {/* Dos gráficos, uno por lo que se vende y cada uno contra SU techo: el grupal es lo
          que venden los canales A y B de esta página; el 47 solo es lo que modela CAC_CANALES. */}
      <Seccion titulo="Lo que cuesta conseguir un cliente">
        <p className="est-sub" style={{ marginTop: 0 }}>Un alumno del grupal</p>
        <CostoContraTecho filas={CAC_GRUPAL} techo={DEJA_GRUPAL} rotuloTecho="Lo que deja" />
        <p className="est-sub">Un cliente del plan de {num(PRECIO_PRO)}, vendido solo</p>
        <CostoContraTecho filas={CAC_PRO} techo={TECHO_PRO} rotuloTecho="Techo" />
        <p className="est-sub">Lo que deja un cliente</p>
        <Ltv />
      </Seccion>

      <Seccion titulo="Estrategia de adquisición"><Adquisicion /></Seccion>

      <Seccion titulo="Proyección del mes"><Proyeccion /></Seccion>

      <Seccion titulo="Referidos"><Referidos /></Seccion>

      <Seccion titulo="Canales a futuro"><Futuro /></Seccion>

      <section className="est-sec">
        <div className="est-grid" style={minCol(260)}>
          <Link href="/admin/runway" className="est-caja est-link">
            <span><span className="est-eyebrow">Avance del producto</span><br /><b>Runway</b></span>
            <Ic d={I.flecha} />
          </Link>
          <Link href="/admin/dev/pricing" className="est-caja est-link">
            <span><span className="est-eyebrow">Modelo completo</span><br /><b>Pricing</b></span>
            <Ic d={I.flecha} />
          </Link>
        </div>
      </section>
    </div>
  );
}
