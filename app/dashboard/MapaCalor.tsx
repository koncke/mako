'use client';
// =============================================================================
// MapaCalor — el gráfico «Mapa de calor de página» del Dashboard (tipo `mapa_calor`, conjunto `toques`)
// =============================================================================
// Lo monta CuerpoGrafico por el registro de dibujos propios (app/dashboard/graficos/registro.ts, con carga
// perezosa: su código no viaja a quien no tiene un mapa en la hoja). Reemplaza al bloque de la hoja Landing, que
// montaba tal cual el de la tab vieja y miraba SUS 30 días (relevo v5, área D, punto 23).
//
// QUÉ MIRA: el período y los filtros que resolvió la hoja para este gráfico (`efectivoDe`: el control de período,
// la página, el dispositivo, botón o no). Los puntos no vienen por /api/graficos —un resultado agregado no tiene
// puntos—: se piden a /api/landing-analyst/mapa con ese período y esos filtros (lib/landing-mapa-filtros.ts).
// Si quien lo monta no pasa `efectivo`, mira sólo lo que decide el gráfico (su período fijo, si tiene, o el
// automático), sin los controles de la hoja: ver «PENDIENTE» del paquete P7.
//
// QUÉ DIBUJA (decisión de Martín, 12/10/2026):
//   · EN VIVO, si se puede (MapaCalorVivo): la página de hoy adentro de un celular o de una compu, con el calor
//     encima. Se puede cuando la página tiene un Pixel que baja un r.js (v21+), es https y no es de MaKo.
//   · Si no, o si el puente no contesta: la FOTO de una grabación (MapaCalorFoto), con su hoja arreglada y
//     carteles donde había un video o una agenda.
// Un rótulo corto dice cuál de las dos se está viendo.
//
// Una sola página y un solo aparato a la vez (nunca se mezclan celular y compu: son dos páginas distintas). Si
// los filtros dejan varias, se elige acá adentro; la elección es de la VISTA y no se guarda en el informe.
// =============================================================================

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Select, Spinner } from '@/app/_ui';
import { AreaMedida } from './graficos/medida';
import type { PropsDibujo } from './graficos/registro';
import { efectivoDe, hojaVacia, type Efectivo, type Hoja } from '@/lib/graficos-catalogo';
import { hoyEnTijuana } from '@/lib/date-utils';
import { rankingDe, type Dispositivo } from '@/lib/landing-mapa';
import { hostPath } from '@/lib/landing-mapa-rotulo';
import { filtrosDeToques } from '@/lib/landing-mapa-filtros';
import { PIXEL_PUENTE_DESDE } from '@/lib/landing-mapa-puente';
import { esHostPropio } from '@/lib/embeds';
import type { DatosDelMapa, PaginaDelMapa } from '@/lib/landing-mapa-server';
import { MapaCalorVivo } from './MapaCalorVivo';
import { MapaCalorFoto, type InfoFoto } from './MapaCalorFoto';
import { Leyenda, Ranking } from './MapaCalorPiezas';

/** Una hoja sin controles: el respaldo de `efectivo` (sólo lo que decide el gráfico). Se arma una vez. */
let hojaSin: Hoja | null = null;
const hojaSinControles = (): Hoja => (hojaSin ??= hojaVacia('Mapa'));

/** «En vivo» se puede: un Pixel que baja un r.js, https y una página que no es de MaKo. */
function sePuedeEnVivo(d: Pick<DatosDelMapa, 'url' | 'version'>): boolean {
  if (d.version == null || d.version < PIXEL_PUENTE_DESDE) return false;
  try {
    const u = new URL(d.url);
    const propio = typeof location !== 'undefined' ? location.hostname : null;
    return u.protocol === 'https:' && !esHostPropio(u.hostname, propio);
  } catch {
    return false;
  }
}

const diaMes = (iso: string): string => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `${d.getDate()}/${d.getMonth() + 1}` : '';
};

const NOMBRE_DISP: Record<Dispositivo, string> = { movil: 'Celular', escritorio: 'Computadora' };

type Leido<T> = { clave: string; ok: true; v: T } | { clave: string; ok: false; error: string };

/** Un GET de la ruta del mapa. «No pude» y «no te toca» son dos cosas y se dicen distinto. */
async function leer<T>(clave: string, campo: 'paginas' | 'data'): Promise<Leido<T>> {
  try {
    const r = await fetch(`/api/landing-analyst/mapa?${clave}`);
    const j = await r.json().catch(() => null);
    if (r.status === 401 || r.status === 403) return { clave, ok: false, error: 'Sin acceso al mapa' };
    if (!r.ok || !j?.ok) return { clave, ok: false, error: 'No pude leer los toques' };
    return { clave, ok: true, v: j[campo] as T };
  } catch {
    return { clave, ok: false, error: 'No pude leer los toques' };
  }
}

export default function MapaCalor({ g, efectivo }: PropsDibujo & { efectivo?: Efectivo }) {
  const hoy = useMemo(() => hoyEnTijuana(), []);
  const ef = useMemo(() => efectivo ?? efectivoDe(g, hojaSinControles(), {}, hoy), [efectivo, g, hoy]);
  const consulta = useMemo(
    () => new URLSearchParams({ desde: ef.desde, hasta: ef.hasta, filtros: JSON.stringify(filtrosDeToques(ef.filtros)) }).toString(),
    [ef.desde, ef.hasta, ef.filtros],
  );

  // ── Las páginas con toques en el período ──────────────────────────────────────────────
  const [paginas, setPaginas] = useState<Leido<PaginaDelMapa[]> | null>(null);
  useEffect(() => {
    let vivo = true;
    void leer<PaginaDelMapa[]>(consulta, 'paginas').then((r) => { if (vivo) setPaginas(r); });
    return () => { vivo = false; };
  }, [consulta]);
  const lp = paginas?.clave === consulta ? paginas : null;
  const lista = lp?.ok ? lp.v.filter((p) => p.movil + p.escritorio > 0) : null;

  const [elegida, setElegida] = useState<string | null>(null);
  const pagina = lista ? (lista.find((p) => p.url === elegida) ?? lista[0] ?? null) : null;
  const [dispElegido, setDispElegido] = useState<Dispositivo | null>(null);
  const disps = pagina ? (['movil', 'escritorio'] as const).filter((d) => pagina[d] > 0) : [];
  const disp: Dispositivo | null = !pagina ? null
    : dispElegido && disps.includes(dispElegido) ? dispElegido
      : pagina.escritorio > pagina.movil ? 'escritorio' : 'movil';

  // ── Los toques de la página elegida ───────────────────────────────────────────────────
  const claveDatos = pagina && disp ? `${consulta}&url=${encodeURIComponent(pagina.url)}&disp=${disp}` : null;
  const [datos, setDatos] = useState<Leido<DatosDelMapa> | null>(null);
  useEffect(() => {
    if (!claveDatos) return;
    let vivo = true;
    void leer<DatosDelMapa>(claveDatos, 'data').then((r) => { if (vivo) setDatos(r); });
    return () => { vivo = false; };
  }, [claveDatos]);
  const ld = claveDatos && datos?.clave === claveDatos ? datos : null;
  const d = ld?.ok ? ld.v : null;

  // ── En vivo o la foto ─────────────────────────────────────────────────────────────────
  const [sinPuente, setSinPuente] = useState<string | null>(null);
  const modo: 'vivo' | 'foto' | null = !d || !claveDatos ? null : sePuedeEnVivo(d) && sinPuente !== claveDatos ? 'vivo' : 'foto';
  const [infoFoto, setInfoFoto] = useState<InfoFoto>({ estado: 'cargando' });
  const [resaltado, setResaltado] = useState<string | null>(null);
  const ranking = useMemo(() => rankingDe(d?.toques ?? []), [d]);

  const error = (lp && !lp.ok ? lp.error : null) ?? (ld && !ld.ok ? ld.error : null);
  const centro = (contenido: ReactNode) => (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--faint)', fontSize: 'var(--fs-md)', textAlign: 'center', padding: 8 }}>{contenido}</div>
  );
  if (error) return centro(error);
  if (!lista) return centro(<Spinner size={20} />);
  if (!lista.length || !pagina || !disp) return centro('Sin toques en este período');

  const rotuloModo = modo === 'vivo' ? 'En vivo'
    : modo === 'foto' ? (infoFoto.estado === 'ok' ? `Foto · ${diaMes(infoFoto.grabada)}` : 'Foto') : null;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* La barra del mapa: la página y el aparato (si hay de dónde elegir), el modo y la escala. */}
      <div className="lk-no-arrastrar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
        {lista.length > 1 ? (
          <Select ariaLabel="Página" value={pagina.url} width={260}
            onChange={(v) => { setElegida(v); setResaltado(null); }}
            options={lista.map((p) => ({ value: p.url, label: hostPath(p.url) }))} />
        ) : (
          <span style={{ fontSize: 13, color: 'var(--dim)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pagina.url}>{hostPath(pagina.url)}</span>
        )}
        {disps.length > 1 && (
          <div role="group" aria-label="Aparato" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', flex: 'none' }}>
            {disps.map((x) => (
              <button key={x} type="button" aria-pressed={disp === x} onClick={() => { setDispElegido(x); setResaltado(null); }}
                style={{ padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: disp === x ? 'var(--primary-bg)' : 'var(--surface)', color: disp === x ? 'var(--primary)' : 'var(--dim)' }}>
                {NOMBRE_DISP[x]}
              </button>
            ))}
          </div>
        )}
        {rotuloModo && (
          <span style={{ fontSize: 13, fontWeight: 600, color: modo === 'vivo' ? 'var(--good)' : 'var(--dim)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 10px', flex: 'none' }}>
            {rotuloModo}
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
          {d && <span style={{ fontSize: 13, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{d.toques.length} toques · {d.personas} personas</span>}
          <Leyenda compacta />
        </span>
      </div>

      <AreaMedida>
        {(tam) => {
          if (!d || !modo) return centro(<Spinner size={20} />);
          const conRanking = tam.w >= 600 && ranking.filas.length > 0;
          const ANCHO_RANKING = 230;
          const caja = { w: Math.max(120, tam.w - (conRanking ? ANCHO_RANKING + 16 : 0)), h: tam.h };
          return (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'center' }}>
              <div style={{ width: caja.w, height: caja.h, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', flex: 'none' }}>
                {modo === 'vivo' ? (
                  <MapaCalorVivo key={claveDatos} url={d.url} disp={disp} toques={d.toques} resaltado={resaltado} caja={caja}
                    onSinPuente={() => setSinPuente(claveDatos)} />
                ) : (
                  <MapaCalorFoto key={claveDatos} url={d.url} disp={disp} toques={d.toques} resaltado={resaltado} caja={caja} onInfo={setInfoFoto} />
                )}
              </div>
              {conRanking && (
                <div className="lk-no-arrastrar" style={{ height: caja.h, overflow: 'hidden', flex: 'none' }}>
                  <Ranking filas={ranking.filas} resto={ranking.resto} resaltado={resaltado} onResaltar={setResaltado} ancho={ANCHO_RANKING} />
                </div>
              )}
            </div>
          );
        }}
      </AreaMedida>
    </div>
  );
}
