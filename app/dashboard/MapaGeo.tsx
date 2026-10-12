'use client';

// =============================================================================
// MapaGeo — el mapa de CUALQUIER país: por país, por región o con las ciudades como burbujas
// =============================================================================
// Reemplaza a MapaMexico (punto 18, v5). Lo montan el Dashboard (app/dashboard/Grafico.tsx, con next/dynamic,
// para el tipo «Mapa») y el desglose de cuenta del Ads Manager (app/marketing/ad-charts.tsx).
//
// Lo que no se ve en la firma:
//   · LA GEOMETRÍA ES NUESTRA: /geo/v1/paises.json (el mundo), /geo/v1/admin1/<ISO2>.json (cada país por
//     región) y /geo/v1/indice.json, generados con scripts/geo-paises.mjs desde Natural Earth (dominio
//     público). Antes se bajaba un GeoJSON de México de raw.githubusercontent EN EL NAVEGADOR de quien miraba.
//     Cada archivo se baja una vez por sesión (una promesa por URL); un fallo no se guarda.
//   · EL PAÍS: `pais` es un ISO-2 o 'auto'. Con 'auto' manda el que diga el server (`paisDetectado`: el de la
//     cuenta de Meta), y si no vino, el que ADIVINAN las regiones (lib/geo-regiones.ts, `adivinarPais`):
//     primero contra México sin bajar nada (el informe guardado de hoy es de México), después contra el índice
//     de todos. Si no se puede saber, NO se adivina: se pide elegir (y lo elegido es de la vista, no se guarda).
//   · CADA REGIÓN SE UBICA por igualdad exacta normalizada, nunca por prefijo, y lo que no se ubica se cuenta
//     aparte («N sin ubicar»), nunca se pinta en cero. Una región que no vino es «Sin datos», no un cero.
//   · CIUDADES COMO BURBUJAS (lat/lon, radio ∝ √valor) sobre las regiones del país: no hay polígonos de ciudad
//     parejos para todos los países, y la burbuja no los necesita. Meta no da ciudades: son datos propios
//     (las visitas del Pixel, conjunto `ubicacion`).
//   · LA PROYECCIÓN: Mercator girada al centro del país (Rusia y Fiyi cruzan el antimeridiano: sin el giro, el
//     país ocupa el mundo entero); Estados Unidos va con Albers (Alaska y Hawái en recuadro); el mundo, Equal
//     Earth.
//   · El color es el del tema de la hoja y la intensidad va en `fill-opacity`, en `style` (sirve igual con un
//     hex que con un var(--token), y un var() en un atributo SVG no está garantizado).
//   · Se ajusta a la tarjeta (flex + ResizeObserver). Fuera de un contenedor flex (el Ads Manager) se le pasa
//     `alto`. La caja medida se dibuja SIEMPRE: si sólo existiera con la geometría cargada, el efecto que la mide
//     no la encontraría.

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { geoAlbersUsa, geoBounds, geoEqualEarth, geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { Spinner } from '@/app/_ui';
import { Dropdown } from '@/app/components/Dropdown';
import { adivinarPais, codigoEn, diccionario, indiceConocido, type RegionGeo } from '@/lib/geo-regiones';
import { radioBurbuja } from '@/lib/graficos-gordo';
import { EstilosGraficos } from './graficos/estilos';

/** Una fila del mapa. Con ciudades, además dónde queda (y de qué país es, si se sabe). */
export type RegionMapa = { etiqueta: string; valor: number; lat?: number; lon?: number; pais?: string };
export type NivelMapa = 'pais' | 'region' | 'ciudad';

type Props = { c: string; n: string; a?: string[] };
type GeoFeature = { type: 'Feature'; properties: Props; geometry: unknown };
type Coleccion = { type: 'FeatureCollection'; features: GeoFeature[] };

const RAIZ = '/geo/v1';
const cache = new Map<string, Promise<unknown>>();
/** Un archivo de geometría, una vez por sesión. Un fallo no se guarda: el próximo mapa lo vuelve a pedir. */
function bajar<T>(ruta: string): Promise<T> {
  let p = cache.get(ruta) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${RAIZ}/${ruta}`).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as T;
    });
    p.catch(() => { if (cache.get(ruta) === p) cache.delete(ruta); });
    cache.set(ruta, p);
  }
  return p;
}
const regionesDe = (fc: Coleccion): RegionGeo[] => fc.features.map((f) => ({ codigo: f.properties.c, nombre: f.properties.n, alias: f.properties.a ?? [] }));
const esIso2 = (v: string | null | undefined): v is string => !!v && /^[A-Z]{2}$/.test(v);

/** La proyección del país: Albers para EE. UU., Equal Earth para el mundo, Mercator girada al centro para el resto. */
function proyeccion(fc: Coleccion, pais: string | null, w: number, h: number): GeoProjection {
  const objeto = fc as unknown as Parameters<GeoProjection['fitSize']>[1];
  if (!pais) return geoEqualEarth().fitSize([w, h], objeto);
  if (pais === 'US') return geoAlbersUsa().fitSize([w, h], objeto) as unknown as GeoProjection;
  const [[oeste], [este]] = geoBounds(objeto);
  const centro = oeste <= este ? (oeste + este) / 2 : ((oeste + este + 360) / 2) % 360;
  return geoMercator().rotate([-centro, 0]).fitSize([w, h], objeto);
}

export default function MapaGeo({ regiones, color, fmt, alto, pais = 'auto', paisDetectado = null, nivel = 'region', alClic }: {
  regiones: RegionMapa[]; color: string; fmt: (v: number) => string; alto?: number;
  pais?: string; paisDetectado?: string | null; nivel?: NivelMapa;
  /** El clic en una región o una ciudad: la etiqueta como vino en los datos. */
  alClic?: (etiqueta: string) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<{ nombre: string; valor: number | null; x: number; y: number } | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [adivinado, setAdivinado] = useState<{ para: string; pais: string | null } | null>(null);
  const [geo, setGeo] = useState<{ ruta: string; fc: Coleccion | null; fallo: boolean } | null>(null);
  const [mundo, setMundo] = useState<Coleccion | null>(null);

  // ── El país ─────────────────────────────────────────────────────────────────────────────
  const etiquetas = useMemo(() => regiones.filter((r) => r.valor !== 0).map((r) => r.etiqueta), [regiones]);
  const firma = etiquetas.join('|');
  const paisDeCiudades = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const r of regiones) if (esIso2(r.pais)) cuenta.set(r.pais, (cuenta.get(r.pais) ?? 0) + Math.max(0, r.valor));
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [regiones]);
  const pedido = (pais || 'auto').toUpperCase();
  const sinAdivinar = nivel === 'pais' ? null
    : esIso2(pedido) ? pedido
      : elegido ?? (esIso2(paisDetectado ?? null) ? paisDetectado!.toUpperCase() : null) ?? (nivel === 'ciudad' ? paisDeCiudades : null) ?? adivinarPais(etiquetas, indiceConocido());
  const paisFinal = nivel === 'pais' ? null : sinAdivinar ?? (adivinado?.para === firma ? adivinado.pais : null);
  const buscando = nivel !== 'pais' && !sinAdivinar && adivinado?.para !== firma;

  useEffect(() => {
    if (!buscando) return;
    let vivo = true;
    bajar<Record<string, string[]>>('indice.json').then(
      (indice) => { if (vivo) setAdivinado({ para: firma, pais: adivinarPais(etiquetas, indice) }); },
      () => { if (vivo) setAdivinado({ para: firma, pais: null }); },
    );
    return () => { vivo = false; };
  }, [buscando, firma, etiquetas]);

  // ── La geometría ────────────────────────────────────────────────────────────────────────
  const ruta = nivel === 'pais' ? 'paises.json' : paisFinal ? `admin1/${paisFinal}.json` : null;
  useEffect(() => {
    if (!ruta) return;
    let vivo = true;
    bajar<Coleccion>(ruta).then(
      (fc) => { if (vivo) setGeo({ ruta, fc: Array.isArray(fc?.features) && fc.features.length ? fc : null, fallo: !(Array.isArray(fc?.features) && fc.features.length) }); },
      () => { if (vivo) setGeo({ ruta, fc: null, fallo: true }); },
    );
    return () => { vivo = false; };
  }, [ruta]);
  // La lista de países para elegir: sólo si hace falta elegir.
  const hayQueElegir = nivel !== 'pais' && !paisFinal && !buscando;
  useEffect(() => {
    if (!hayQueElegir || mundo) return;
    let vivo = true;
    bajar<Coleccion>('paises.json').then((fc) => { if (vivo) setMundo(fc); }, () => undefined);
    return () => { vivo = false; };
  }, [hayQueElegir, mundo]);

  // ── La medida ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => {
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
      setTam((t) => (t && t.w === w && t.h === h ? t : { w, h }));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fc = geo && geo.ruta === ruta ? geo.fc : null;
  const fallo = !!geo && geo.ruta === ruta && geo.fallo;

  // ── Ubicar: regiones (o países) por código; ciudades por lat/lon ─────────────────────────
  const dic = useMemo(() => (fc ? diccionario(nivel === 'pais' ? '' : paisFinal ?? '', regionesDe(fc)) : null), [fc, nivel, paisFinal]);
  const ub = useMemo(() => {
    const porCodigo = new Map<string, number>();
    const etiquetaDe = new Map<string, string>();
    const sinUbicar: RegionMapa[] = [];
    const ciudades: Array<RegionMapa & { lat: number; lon: number }> = [];
    if (!dic) return { porCodigo, etiquetaDe, sinUbicar, ciudades, nombres: new Map<string, string>() };
    for (const r of regiones) {
      const valor = Number.isFinite(r.valor) ? r.valor : 0;
      if (nivel === 'ciudad') {
        const afuera = esIso2(r.pais) && r.pais !== paisFinal;
        if (r.lat != null && r.lon != null && Number.isFinite(r.lat) && Number.isFinite(r.lon) && !afuera) ciudades.push({ ...r, lat: r.lat, lon: r.lon, valor });
        else if (valor !== 0) sinUbicar.push(r);
        continue;
      }
      const cod = codigoEn(dic, r.etiqueta);
      if (cod) { porCodigo.set(cod, (porCodigo.get(cod) ?? 0) + valor); if (!etiquetaDe.has(cod)) etiquetaDe.set(cod, r.etiqueta); }
      else if (valor !== 0) sinUbicar.push(r);
    }
    return { porCodigo, etiquetaDe, sinUbicar, ciudades, nombres: dic.nombres };
  }, [dic, regiones, nivel, paisFinal]);
  const max = useMemo(() => Math.max(0, ...Array.from(ub.porCodigo.values()), ...ub.ciudades.map((c) => c.valor)), [ub]);

  // Los trazos sólo se recalculan con la geometría o el tamaño: pasar el mouse no los rehace.
  const dibujo = useMemo(() => {
    if (!fc || !tam || tam.w < 40 || tam.h < 40) return null;
    const proy = proyeccion(fc, paisFinal, tam.w, tam.h);
    const path = geoPath(proy);
    const trazos = fc.features.map((f, i) => ({ i, cod: f.properties.c, nombre: f.properties.n, d: path(f as unknown as Parameters<typeof path>[0]) ?? '' }));
    return { trazos, proy };
  }, [fc, tam, paisFinal]);

  const burbujas = useMemo(() => {
    if (!dibujo || nivel !== 'ciudad') return [];
    return ub.ciudades
      .map((c) => ({ c, p: dibujo.proy([c.lon, c.lat]), r: radioBurbuja(c.valor, max) }))
      .filter((b): b is { c: typeof b.c; p: [number, number]; r: number } => !!b.p && b.r > 0)
      .sort((a, b) => b.r - a.r);
  }, [dibujo, ub, nivel, max]);

  const top = useMemo(() => [...regiones].filter((r) => r.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 6), [regiones]);
  const nombreDe = (etiqueta: string) => {
    if (nivel === 'ciudad' || !dic) return etiqueta;
    const c = codigoEn(dic, etiqueta);
    return (c && ub.nombres.get(c)) || etiqueta;
  };
  const sinUbicar = ub.sinUbicar.length;
  const mover = (e: MouseEvent, nombre: string, valor: number | null) => {
    const r = caja.current?.getBoundingClientRect();
    if (r) setHover({ nombre, valor, x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const opcionesPais = useMemo(() => (mundo?.features ?? []).map((f) => ({ value: f.properties.c, label: f.properties.n, buscar: [f.properties.c, ...(f.properties.a ?? [])].join(' ') })).sort((a, b) => a.label.localeCompare(b.label, 'es')), [mundo]);

  return (
    <div className="gr-mapa">
      <EstilosGraficos />
      <div ref={caja} className="gr-mapa-caja" style={{ minHeight: alto ?? 120, height: alto }} onMouseLeave={() => setHover(null)}>
        {hayQueElegir ? (
          <div className="gr-mapa-msj">
            <span>¿De qué país es el mapa?</span>
            {mundo ? <Dropdown value={elegido ?? ''} options={opcionesPais} onChange={(v) => setElegido(v)} search placeholder="Elegir país" ariaLabel="País del mapa" /> : <Spinner size={18} />}
          </div>
        ) : !fc ? (
          <div className="gr-mapa-msj">{fallo ? 'No pude cargar el mapa' : <Spinner size={18} />}</div>
        ) : dibujo && tam ? (
          <svg width={tam.w} height={tam.h} viewBox={`0 0 ${tam.w} ${tam.h}`} role="img" aria-label="Mapa" style={{ position: 'absolute', inset: 0, display: 'block' }}>
            {dibujo.trazos.map((t) => {
              const v = nivel === 'ciudad' ? undefined : ub.porCodigo.get(t.cod);
              const intensidad = v != null && v > 0 && max > 0 ? v / max : null;
              const etiqueta = ub.etiquetaDe.get(t.cod);
              const abre = alClic && etiqueta && v != null ? () => alClic(etiqueta) : undefined;
              return (
                <path key={t.i} d={t.d} strokeWidth={1}
                  style={{ ...(intensidad != null ? { fill: color, fillOpacity: 0.16 + intensidad * 0.76 } : { fill: 'var(--surface-2)' }), stroke: 'var(--surface)', cursor: abre ? 'pointer' : undefined }}
                  onMouseMove={nivel === 'ciudad' ? undefined : (e) => mover(e, ub.nombres.get(t.cod) ?? t.nombre, v ?? null)}
                  onMouseLeave={() => setHover(null)} onClick={abre} />
              );
            })}
            {burbujas.map(({ c, p, r }) => (
              <circle key={`${c.etiqueta}-${c.lat}-${c.lon}`} cx={p[0]} cy={p[1]} r={r} strokeWidth={1.5}
                style={{ fill: color, fillOpacity: 0.55, stroke: color, cursor: alClic ? 'pointer' : undefined }}
                onMouseMove={(e) => mover(e, c.etiqueta, c.valor)} onMouseLeave={() => setHover(null)}
                onClick={alClic ? () => alClic(c.etiqueta) : undefined} />
            ))}
          </svg>
        ) : null}
        {hover && tam && (
          <div className="gr-mapa-tip" style={{ left: Math.max(4, Math.min(hover.x + 12, tam.w - 180)), top: Math.max(4, Math.min(hover.y + 12, tam.h - 36)) }}>
            <b>{hover.nombre}</b>: {hover.valor != null ? fmt(hover.valor) : 'Sin datos'}
          </div>
        )}
      </div>
      {top.length > 0 && !hayQueElegir && (
        <div className="gr-mapa-chips">
          {top.map((r) => <span key={r.etiqueta}>{nombreDe(r.etiqueta)}: {fmt(r.valor)}</span>)}
        </div>
      )}
      {sinUbicar > 0 && fc && (
        <div className="gr-mapa-nota" title={ub.sinUbicar.map((r) => r.etiqueta).join(', ')}>
          {sinUbicar} sin ubicar en el mapa
        </div>
      )}
    </div>
  );
}
