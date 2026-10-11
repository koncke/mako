'use client';

// =============================================================================
// MapaMexico — el mapa de la vieja «Audiencia y alcance»: México por estado
// =============================================================================
// Se mudó de app/marketing/ad-charts.tsx (11/10/2026) para que lo monten los dos: el Dashboard
// (app/dashboard/Grafico.tsx, con next/dynamic) y el desglose de cuenta del Ads Manager
// (`BreakdownCharts`). Importarlo de ad-charts habría arrastrado el Ads Analyst al Dashboard.
//
// Lo que no se ve en la firma:
//   · Cada región se UBICA con un diccionario por código ISO (MX-CMX…), nunca por prefijo. Meta
//     nombra «Distrito Federal», «State of Mexico», «Coahuila de Zaragoza», «Michoacán de Ocampo»,
//     «Querétaro Arteaga» y «San Luis Potosi» (medido el 11/10/2026, Graph v25.0), y el GeoJSON
//     dice «Ciudad de México», «México», «Coahuila», «Michoacán», «Querétaro», «San Luis Potosí».
//     Con el `startsWith` de antes, CDMX y el Estado de México —los dos estados con más
//     impresiones de la cuenta del ws1— salían en CERO (docs/hallazgos-ads.md, «El mapa de México
//     no pinta cero: pinta el estado equivocado»).
//   · Lo que no se ubica NO se pinta en cero: se cuenta aparte («N regiones sin ubicar en el
//     mapa»). Una cuenta de otro país dibuja el mapa gris con el aviso, no un México que parece
//     medido. Y un estado que no vino no es un cero: el tooltip dice «Sin datos».
//   · El GeoJSON se baja UNA vez por sesión (una promesa a nivel módulo). Si falla, se avisa y
//     quedan los chips; el próximo mapa que se monte lo vuelve a intentar.
//   · Se ajusta a la tarjeta (flex + ResizeObserver) y recalcula la proyección con el tamaño real.
//     Fuera de un contenedor flex (el Ads Manager) se le pasa `alto`. La caja medida se dibuja
//     SIEMPRE: si sólo existiera con el GeoJSON cargado, el efecto que la mide no la encontraría.
//   · El color es el que recibe (el del tema de la hoja) y la intensidad va en `fill-opacity`: así
//     sirve igual con un hex que con un `var(--token)`.

import { useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { Spinner } from '@/app/_ui';

export type RegionMapa = { etiqueta: string; valor: number };

const GEOURL = 'https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json';
const MONO = "'Geist Mono', monospace";

/** Los 32 estados por su código ISO 3166-2 (el `id` del GeoJSON), con el nombre que se dibuja. */
export const ESTADOS: Readonly<Record<string, string>> = {
  'MX-AGU': 'Aguascalientes', 'MX-BCN': 'Baja California', 'MX-BCS': 'Baja California Sur', 'MX-CAM': 'Campeche',
  'MX-CHP': 'Chiapas', 'MX-CHH': 'Chihuahua', 'MX-COA': 'Coahuila', 'MX-COL': 'Colima', 'MX-CMX': 'Ciudad de México',
  'MX-DUR': 'Durango', 'MX-GUA': 'Guanajuato', 'MX-GRO': 'Guerrero', 'MX-HID': 'Hidalgo', 'MX-JAL': 'Jalisco',
  'MX-MEX': 'Estado de México', 'MX-MIC': 'Michoacán', 'MX-MOR': 'Morelos', 'MX-NAY': 'Nayarit', 'MX-NLE': 'Nuevo León',
  'MX-OAX': 'Oaxaca', 'MX-PUE': 'Puebla', 'MX-QUE': 'Querétaro', 'MX-ROO': 'Quintana Roo', 'MX-SLP': 'San Luis Potosí',
  'MX-SIN': 'Sinaloa', 'MX-SON': 'Sonora', 'MX-TAB': 'Tabasco', 'MX-TAM': 'Tamaulipas', 'MX-TLA': 'Tlaxcala',
  'MX-VER': 'Veracruz', 'MX-YUC': 'Yucatán', 'MX-ZAC': 'Zacatecas',
};

/**
 * Los otros nombres con que llega cada estado, ya normalizados. Los de Meta salen de la medición
 * del 11/10/2026; «México» a secas es el estado (así lo nombra el GeoJSON), nunca el país.
 */
const ALIAS: Readonly<Record<string, readonly string[]>> = {
  'MX-BCN': ['baja california norte'],
  'MX-COA': ['coahuila de zaragoza'],
  'MX-CMX': ['distrito federal', 'mexico city', 'cdmx', 'df', 'mexico df', 'ciudad de mexico df', 'federal district'],
  'MX-MEX': ['mexico', 'state of mexico', 'mexico state', 'edomex'],
  'MX-MIC': ['michoacan de ocampo'],
  'MX-QUE': ['queretaro arteaga', 'queretaro de arteaga'],
  'MX-VER': ['veracruz de ignacio de la llave', 'veracruz llave'],
};

/** Sin acentos, en minúsculas, sin puntos y con un espacio entre palabras: «México D.F.» → «mexico df». */
export function normalizarRegion(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const POR_NOMBRE: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [cod, nombre] of Object.entries(ESTADOS)) m.set(normalizarRegion(nombre), cod);
  for (const [cod, otros] of Object.entries(ALIAS)) for (const x of otros) m.set(x, cod);
  return m;
})();

/** El código del estado de un nombre (de Meta o del GeoJSON), o null si no es uno de los 32. Igualdad exacta, sin prefijos. */
export function codigoDeRegion(nombre: string): string | null {
  return POR_NOMBRE.get(normalizarRegion(nombre)) ?? null;
}

/**
 * Las regiones repartidas en estados. Dos nombres del mismo estado se suman (el mapa sólo acepta
 * métricas que se suman). Lo que no es un estado y trae algo va a `sinUbicar`: no se dibuja en cero.
 */
export function ubicarRegiones(regiones: readonly RegionMapa[]): { porCodigo: Map<string, number>; sinUbicar: RegionMapa[] } {
  const porCodigo = new Map<string, number>();
  const sinUbicar: RegionMapa[] = [];
  for (const r of regiones) {
    const valor = Number.isFinite(r.valor) ? r.valor : 0;
    const cod = codigoDeRegion(r.etiqueta);
    if (cod) porCodigo.set(cod, (porCodigo.get(cod) ?? 0) + valor);
    else if (valor !== 0) sinUbicar.push(r);
  }
  return { porCodigo, sinUbicar };
}

type GeoFeature = { type: string; properties: Record<string, unknown>; geometry: unknown };

let geo: Promise<GeoFeature[]> | null = null;
/** El GeoJSON, una vez por sesión. Un fallo no se guarda: el próximo mapa lo vuelve a pedir. */
function bajarGeo(): Promise<GeoFeature[]> {
  if (!geo) {
    const p = fetch(GEOURL).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { features?: unknown };
      if (!Array.isArray(j.features) || !j.features.length) throw new Error('el GeoJSON vino sin estados');
      return j.features as GeoFeature[];
    });
    p.catch(() => { if (geo === p) geo = null; });
    geo = p;
  }
  return geo;
}

const nombreDeFeature = (f: GeoFeature) => String(f.properties.name ?? f.properties.NAME_1 ?? f.properties.ESTADO ?? f.properties.estado ?? '');
function codigoDeFeature(f: GeoFeature): string | null {
  const id = typeof f.properties.id === 'string' ? f.properties.id : '';
  return ESTADOS[id] ? id : codigoDeRegion(nombreDeFeature(f));
}

export default function MapaMexico({ regiones, color, fmt, alto }: { regiones: RegionMapa[]; color: string; fmt: (v: number) => string; alto?: number }) {
  const [features, setFeatures] = useState<GeoFeature[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<{ cod: string | null; nombre: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    bajarGeo().then((f) => { if (vivo) setFeatures(f); }, () => { if (vivo) setFallo(true); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      const w = Math.floor(r.width);
      const h = Math.floor(r.height);
      setTam((t) => (t && t.w === w && t.h === h ? t : { w, h }));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ub = useMemo(() => ubicarRegiones(regiones), [regiones]);
  const max = useMemo(() => Math.max(0, ...Array.from(ub.porCodigo.values())), [ub]);

  // Los trazos sólo se recalculan con la geometría o el tamaño: pasar el mouse no los rehace.
  const trazos = useMemo(() => {
    if (!features || !tam || tam.w < 40 || tam.h < 40) return null;
    const fc = { type: 'FeatureCollection', features } as unknown as Parameters<ReturnType<typeof geoMercator>['fitSize']>[1];
    const path = geoPath(geoMercator().fitSize([tam.w, tam.h], fc));
    return features.map((f, i) => ({ i, cod: codigoDeFeature(f), nombre: nombreDeFeature(f), d: path(f as unknown as Parameters<typeof path>[0]) ?? '' }));
  }, [features, tam]);

  const top = useMemo(() => [...regiones].filter((r) => r.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 6), [regiones]);
  const nombreDe = (etiqueta: string) => { const c = codigoDeRegion(etiqueta); return c ? ESTADOS[c] : etiqueta; };
  const sinUbicar = ub.sinUbicar.length;
  const valorHover = hover?.cod ? ub.porCodigo.get(hover.cod) : undefined;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div ref={caja} style={{ flex: 1, minHeight: alto ?? 120, height: alto, position: 'relative' }} onMouseLeave={() => setHover(null)}>
        {!features ? (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--faint)', fontSize: 13 }}>
            {fallo ? 'No pude cargar el mapa' : <Spinner size={18} />}
          </div>
        ) : trazos && tam ? (
          <svg width={tam.w} height={tam.h} viewBox={`0 0 ${tam.w} ${tam.h}`} role="img" aria-label="Mapa de México por estado" style={{ position: 'absolute', inset: 0, display: 'block' }}>
            {trazos.map((t) => {
              const v = t.cod ? ub.porCodigo.get(t.cod) : undefined;
              const intensidad = v != null && v > 0 && max > 0 ? v / max : null;
              return (
                <path
                  key={t.i}
                  d={t.d}
                  stroke="var(--border)"
                  strokeWidth={0.6}
                  style={intensidad != null ? { fill: color, fillOpacity: 0.14 + intensidad * 0.78 } : { fill: 'var(--surface-2)' }}
                  onMouseMove={(e) => {
                    const r = caja.current?.getBoundingClientRect();
                    if (r) setHover({ cod: t.cod, nombre: t.cod ? ESTADOS[t.cod] : t.nombre, x: e.clientX - r.left, y: e.clientY - r.top });
                  }}
                  // Sobre el mar no hay estado: el tooltip no se queda con el último.
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </svg>
        ) : null}
        {hover && tam && (
          <div style={{
            position: 'absolute', left: Math.max(4, Math.min(hover.x + 12, tam.w - 170)), top: Math.max(4, Math.min(hover.y + 12, tam.h - 36)),
            pointerEvents: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px',
            fontSize: 12.5, color: 'var(--ink)', boxShadow: '0 6px 20px rgba(18,21,27,.08)', whiteSpace: 'nowrap', zIndex: 1,
          }}>
            <b>{hover.nombre}</b>: {valorHover != null ? fmt(valorHover) : 'Sin datos'}
          </div>
        )}
      </div>
      {top.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 'none' }}>
          {top.map((r) => (
            <span key={r.etiqueta} style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 8px' }}>
              {nombreDe(r.etiqueta)}: {fmt(r.valor)}
            </span>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: 'var(--faint)', flex: 'none' }} title={sinUbicar ? ub.sinUbicar.map((r) => r.etiqueta).join(', ') : undefined}>
        Meta no da la ciudad, sólo el estado.
        {sinUbicar > 0 && ` ${sinUbicar} ${sinUbicar === 1 ? 'región' : 'regiones'} sin ubicar en el mapa.`}
      </div>
    </div>
  );
}
