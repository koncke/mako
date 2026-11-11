'use client';

// =============================================================================
// Thumbnails — las miniaturas de YouTube que mejor rinden, la tercera opción del explorador de Image (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «También quisiera una tab que sea "Thumbnails", para traer de la misma manera miniaturas top en el mercado».
// Es la MISMA pantalla que los carruseles (./ExplorarCarruseles.tsx monta esto cuando se elige «Thumbnails»): la misma fila de
// filtros (Filtros, Cuentas, orden), la misma grilla y el mismo «Editar», con su tarjeta 16:9. Lo puro (de dónde salen, el
// múltiplo y por qué espera un trámite con YouTube, los filtros): lib/thumbnails/explorar.ts.
//
// Lo que piden los términos de YouTube y la tarjeta cumple: la imagen es la de YouTube (i.ytimg.com, no una copia), el video se
// abre EN YouTube («Ver en YouTube»), y un número que no es de YouTube (el múltiplo) lleva su leyenda (LEYENDA_DERIVADA).
// =============================================================================

import { useMemo, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { Dropdown } from '@/app/components/Dropdown';
import { ENMIENDA_III_L, FALTA_LA_ENMIENDA, LEYENDA_DERIVADA } from '@/lib/spy-reglas';
import { explicarMultiplo } from '@/lib/multiplo-rendimiento';
import { contadorCorto, nivelDeMultiplo, NIVELES_MULTIPLO } from '@/lib/carruseles/explorar';
import {
  FILTROS_THUMBNAIL, IDIOMAS_THUMBNAIL, NICHOS_THUMBNAIL, PASOS_MULTIPLO_THUMBNAIL, PERIODOS_THUMBNAIL, ORDEN_INICIAL_THUMBNAIL,
  canalesDe, duracionLegible, filtrarThumbnails, imagenDeVideo, ordenesDisponibles, rotuloOutlierThumbnail, sinFiltrosThumbnail, urlDeVideo, videoDeYoutube,
  type FiltrosThumbnail, type IdiomaThumbnail, type NichoThumbnail, type OrdenThumbnail, type PeriodoThumbnail, type Thumbnail,
} from '@/lib/thumbnails/explorar';
import { Deslizador } from './Deslizador';
import { EditarCarrusel } from './EditarCarrusel';
import s from './explorar.module.css';

/** Lo que llega del servidor (lib/thumbnails/servidor.ts, `leerThumbnails`). `ok: false` = no se pudo leer (no es «no hay»). */
export type DatosThumbnails = { ok: true; lista: Thumbnail[]; guardados: number[]; sinTablas: boolean } | { ok: false };

const DE_A = 40;

const haceCuanto = (iso: string | null, ahora: number): string => {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return '';
  const d = Math.max(0, Math.floor((ahora - t) / 86_400_000));
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  const m = Math.floor(d / 30);
  return m < 12 ? `hace ${m} ${m === 1 ? 'mes' : 'meses'}` : `hace ${Math.floor(m / 12)} ${m < 24 ? 'año' : 'años'}`;
};
const inicial = (n: string) => Array.from(n.trim())[0]?.toUpperCase() ?? '·';

const chip = (activo: boolean) => ({
  height: 34, padding: '0 14px', borderRadius: 999, gap: 4, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 550,
  border: `1px solid ${activo ? 'transparent' : 'var(--border)'}`,
  background: activo ? 'var(--primary-bg)' : 'var(--surface)',
  color: activo ? 'var(--primary-strong, var(--primary))' : 'var(--ink)',
});

const Ajustes = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
);
const Marcador = ({ lleno }: { lleno: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={lleno ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
  </svg>
);

/** Cuántos filtros del modal están prendidos (el número del botón). */
export function filtrosThumbnailActivos(f: FiltrosThumbnail): number {
  return [!!f.nicho, !!f.idioma, f.periodo !== 'todo', ENMIENDA_III_L && (f.outlierMin > 0 || f.outlierMax > 0)].filter(Boolean).length;
}

/**
 * La fila de filtros y la grilla de las miniaturas. `segmento` (Carruseles · Anuncios · Thumbnails) y `botones` (en el teléfono)
 * los pone el explorador, para que la fila sea la misma en las tres.
 */
export function PanelThumbnails({ datos, f, cambiar, guardados, alternarGuardado, ahora, telefono, segmento, botones }: {
  datos: DatosThumbnails | null | undefined;
  f: FiltrosThumbnail;
  cambiar: (c: Partial<FiltrosThumbnail>) => void;
  guardados: ReadonlySet<number>;
  alternarGuardado: (t: Thumbnail) => void;
  ahora: number | null;
  telefono: boolean;
  segmento: React.ReactNode;
  botones: React.ReactNode;
}) {
  const [cuantas, setCuantas] = useState(DE_A);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [editando, setEditando] = useState<Thumbnail | null>(null);
  const [abierta, setAbierta] = useState<Thumbnail | null>(null);
  // «Traer tu outlier» (11/11/2026): el link de un video que no está → se lee con la API de YouTube y se suma a las miniaturas del
  // negocio (app/api/image-editor/carruseles/traer, `que: thumbnails`). Lo traído en esta visita entra ya a la lista, primero.
  const [traidas, setTraidas] = useState<Thumbnail[]>([]);
  const [trayendo, setTrayendo] = useState(false);
  const [errorTraer, setErrorTraer] = useState<string | null>(null);
  const link = videoDeYoutube(f.q);
  const lista = useMemo(() => {
    const base = datos && datos.ok ? datos.lista : [];
    return traidas.length ? [...traidas, ...base.filter((x) => !traidas.some((t) => t.id === x.id))] : base;
  }, [datos, traidas]);
  const traer = async () => {
    if (!link || trayendo) return;
    setTrayendo(true);
    setErrorTraer(null);
    try {
      const res = await fetch('/api/image-editor/carruseles/traer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto: f.q, que: 'thumbnails' }) });
      const r = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; thumbnail?: Thumbnail } | null;
      if (!r?.ok || !r.thumbnail) { setErrorTraer(r?.error || 'No pude traer esa miniatura. Vuelve a intentar.'); return; }
      // Ya es una más: el link del buscador la encuentra (`coincideThumbnail`), así que queda sola en la grilla, y se abre.
      const t = r.thumbnail;
      setTraidas((xs) => [t, ...xs.filter((x) => x.id !== t.id)]);
      setAbierta(t);
    } catch {
      setErrorTraer('No pude traer esa miniatura. Vuelve a intentar.');
    } finally {
      setTrayendo(false);
    }
  };
  const botonTraer = link ? (
    <>
      {errorTraer ? <p role="alert">{errorTraer}</p> : null}
      <button type="button" className={s.boton} onClick={() => { void traer(); }} disabled={trayendo} aria-busy={trayendo || undefined}>{trayendo ? 'Trayendo…' : 'Traer esta miniatura'}</button>
    </>
  ) : null;
  const canales = useMemo(() => canalesDe(lista), [lista]);
  const vistos = useMemo(() => filtrarThumbnails(lista, f, guardados, ahora ?? Date.now()), [lista, f, guardados, ahora]);
  const listos = vistos.slice(0, cuantas);
  const ordenes = ordenesDisponibles();
  const orden = ordenes.some((o) => o.value === f.orden) ? f.orden : ORDEN_INICIAL_THUMBNAIL;
  const activos = filtrosThumbnailActivos(f);
  const cambiarYVolver = (c: Partial<FiltrosThumbnail>) => { cambiar(c); setCuantas(DE_A); };
  const reiniciar = () => cambiarYVolver({ ...FILTROS_THUMBNAIL, vista: f.vista });

  return (
    <>
      <div className={s.filtros}>
        {/* En el teléfono, qué ver (Carruseles · Anuncios · Thumbnails) va PRIMERO en la fila que se desliza: es lo que cambia la
            pantalla, y al final quedaba fuera de la vista (6/11/2026, autocrítica). Las pastillas, después. */}
        {segmento}
        {telefono ? botones : null}
        <button type="button" className={s.chip} aria-pressed={activos > 0} onClick={() => setFiltrosAbiertos(true)}>
          <Ajustes /> Filtros{activos ? <span className={s.n}>{activos}</span> : null}
        </button>
        {canales.length > 1 && (
          <Dropdown value="" varios={f.canales.map(String)} search={canales.length > 7} alContenido ariaLabel="Cuentas"
            options={canales.map((c) => ({ value: String(c.id), label: c.nombre, sub: c.handle ? `${c.handle} · ${c.n}` : `${c.n}`, avatar: c.foto }))}
            botonLabel={<span>{f.canales.length ? (f.canales.length === 1 ? canales.find((c) => c.id === f.canales[0])?.nombre ?? 'Cuenta' : `${f.canales.length} cuentas`) : 'Cuentas'}</span>}
            onChange={(v) => { const id = Number(v); cambiarYVolver({ canales: f.canales.includes(id) ? f.canales.filter((x) => x !== id) : [...f.canales, id] }); }}
            buttonStyle={chip(f.canales.length > 0)} />
        )}
        <span className={s.espacio} />
        {!sinFiltrosThumbnail({ ...f, vista: 'todos' }) && <button type="button" className={s.texto} onClick={reiniciar}>Quitar filtros</button>}
        {telefono ? null : <span className={s.total}>{contadorCorto(vistos.length)} {vistos.length === 1 ? 'miniatura' : 'miniaturas'}</span>}
        <Dropdown value={orden} search={false} alContenido ariaLabel="Orden" align="right"
          options={ordenes.map((o) => ({ value: o.value, label: o.label }))}
          botonLabel={<span>{ordenes.find((o) => o.value === orden)?.label}</span>} onChange={(v) => cambiarYVolver({ orden: v as OrdenThumbnail })}
          buttonStyle={chip(false)} />
      </div>

      {!datos || !datos.ok ? (
        <div className={s.vacio} role="alert"><p>No pude leer las miniaturas de ejemplo. Vuelve a intentar en un rato.</p><ReportarASoporte /></div>
      ) : !lista.length && !link ? (
        <div className={s.vacio}><p>Las miniaturas que mejor rinden en ventas, marketing, emprendimiento y servicios aparecen aquí muy pronto.</p></div>
      ) : vistos.length === 0 ? (
        <div className={s.vacio}>
          <p>{link ? 'Ese video no está entre tus outliers.' : f.vista === 'guardados' && !guardados.size ? 'Guarda una miniatura con el marcador y aparece aquí.' : 'Ninguna miniatura pasa estos filtros.'}</p>
          {link ? botonTraer : !sinFiltrosThumbnail({ ...f, vista: 'todos' }) ? <button type="button" className={s.boton} onClick={reiniciar}>Quitar filtros</button> : null}
        </div>
      ) : (
        <>
          <ul className={`${s.grilla} ${s.grillaAncha}`} aria-label="Miniaturas de YouTube">
            {listos.map((t) => (
              <TarjetaThumbnail key={t.id} t={t} ahora={ahora} guardado={guardados.has(t.id)} telefono={telefono}
                onGuardar={() => alternarGuardado(t)} onEditar={() => setEditando(t)} onAbrir={() => setAbierta(t)} />
            ))}
          </ul>
          {vistos.length > cuantas && <button type="button" className={s.mas} onClick={() => setCuantas((n) => n + DE_A)}>Ver más</button>}
          {/* Un número que no es de YouTube lleva su leyenda (Developer Policies III.L). Sin la enmienda no hay múltiplo: nada que aclarar. */}
          {ENMIENDA_III_L ? <p className={s.notaFuente}>El múltiplo: {LEYENDA_DERIVADA}</p> : null}
        </>
      )}

      {filtrosAbiertos ? (
        <FiltrosThumbnailModal filtros={f} lista={lista} onCerrar={() => setFiltrosAbiertos(false)}
          onAplicar={(c) => { setFiltrosAbiertos(false); cambiarYVolver(c); }} />
      ) : null}
      {abierta ? (
        <ThumbnailAbierta t={abierta} ahora={ahora} guardado={guardados.has(abierta.id)} telefono={telefono} onCerrar={() => setAbierta(null)}
          onGuardar={() => alternarGuardado(abierta)} onEditar={() => { const t = abierta; setAbierta(null); setEditando(t); }} />
      ) : null}
      {editando ? <EditarCarrusel key={`t${editando.id}`} thumbnail={editando} onCerrar={() => setEditando(null)} /> : null}
    </>
  );
}

/** La tarjeta 16:9: la miniatura de YouTube, su duración, el múltiplo (o las vistas), el título, el canal, guardar y «Editar». */
export function TarjetaThumbnail({ t, ahora, guardado, telefono, onGuardar, onEditar, onAbrir }: {
  t: Thumbnail; ahora: number | null; guardado: boolean; telefono: boolean; onGuardar: () => void; onEditar: () => void; onAbrir: () => void;
}) {
  const nivel = nivelDeMultiplo(t.outlier);
  const outlier = rotuloOutlierThumbnail(t);
  const dur = duracionLegible(t.duracion);
  const ver = urlDeVideo(t.video);
  return (
    <li className={s.tarjeta}>
      {/* Tocar la imagen la abre grande (como un carrusel); «Editar» es el botón: abrirla no gasta la IA de nadie. */}
      <div className={`${s.mini} ${s.mini169}`} onClick={(e) => { if (!(e.target as HTMLElement).closest('button, a')) onAbrir(); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.miniImagen} src={imagenDeVideo(t.video)} alt={t.titulo ? `Miniatura: ${t.titulo.slice(0, 80)}` : 'Miniatura del video'} loading="lazy" referrerPolicy="no-referrer" draggable={false} />
        {dur ? <span className={s.duracion}>{dur}</span> : null}
        <span className={s.sobreImagen}>
          <button type="button" className={s.editar} onClick={onEditar}>Editar</button>
          <button type="button" className={s.icono} data-guardado={guardado ? 'si' : undefined} onClick={onGuardar}
            aria-pressed={guardado} aria-label={guardado ? 'Quitar de guardados' : 'Guardar'} title={guardado ? 'Quitar de guardados' : 'Guardar'}>
            <Marcador lleno={guardado} />
          </button>
        </span>
      </div>
      <div className={s.pie}>
        <div className={s.fila1}>
          {outlier && nivel ? (
            <span className={s.mult} data-nivel={nivel} title={t.multiplo ? explicarMultiplo(t.multiplo) : undefined}>{outlier}</span>
          ) : null}
          {t.titulo ? <a className={s.gancho} href={ver} target={telefono ? undefined : '_blank'} rel="noopener noreferrer" title="Ver en YouTube">{t.titulo}</a> : null}
        </div>
        <div className={s.creador}>
          {t.canal.foto
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={t.canal.foto} alt="" className={s.cara} referrerPolicy="no-referrer" />
            : <span className={s.cara} aria-hidden>{inicial(t.canal.nombre)}</span>}
          <span className={s.quien}>{t.canal.handle || t.canal.nombre}</span>
          {ahora != null && t.publicado ? <span className={s.cuando}>{haceCuanto(t.publicado, ahora)}</span> : null}
        </div>
        <div className={s.datos}>
          <span title="Vistas en YouTube">{contadorCorto(t.vistas)} vistas</span>
          <a className={s.yt} href={ver} target={telefono ? undefined : '_blank'} rel="noopener noreferrer">Ver en YouTube</a>
        </div>
        <button type="button" className={s.editarLiviano} onClick={onEditar}>Editar</button>
      </div>
    </li>
  );
}

/** La miniatura grande: para mirarla antes de «Editar», con su canal, sus vistas y el link a YouTube. */
function ThumbnailAbierta({ t, ahora, guardado, telefono, onCerrar, onGuardar, onEditar }: {
  t: Thumbnail; ahora: number | null; guardado: boolean; telefono: boolean; onCerrar: () => void; onGuardar: () => void; onEditar: () => void;
}) {
  const outlier = rotuloOutlierThumbnail(t);
  const nivel = nivelDeMultiplo(t.outlier);
  return (
    <Modal titulo={t.titulo || 'Miniatura'} encabezado={t.canal.handle || t.canal.nombre} onCerrar={onCerrar} ancho={860} completaEnCelular
      pie={(
        <>
          <a className={s.secundario} href={urlDeVideo(t.video)} target={telefono ? undefined : '_blank'} rel="noopener noreferrer">Ver en YouTube</a>
          <button type="button" className={s.secundario} aria-pressed={guardado} onClick={onGuardar}>{guardado ? 'Guardada' : 'Guardar'}</button>
          <button type="button" className={s.primario} onClick={onEditar}><strong>Editar</strong></button>
        </>
      )}>
      <div className={s.abiertaThumb}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imagenDeVideo(t.video, 'max')} onError={(e) => { const i = e.currentTarget; if (!i.dataset.hq) { i.dataset.hq = '1'; i.src = imagenDeVideo(t.video); } }}
          alt={t.titulo ? `Miniatura: ${t.titulo.slice(0, 80)}` : 'Miniatura del video'} referrerPolicy="no-referrer" />
        <div className={s.datos}>
          {outlier && nivel ? <span className={s.mult} data-nivel={nivel} title={t.multiplo ? explicarMultiplo(t.multiplo) : undefined}>{outlier}</span> : null}
          <span>{contadorCorto(t.vistas)} vistas</span>
          {t.megusta != null ? <span>♥ {contadorCorto(t.megusta)}</span> : null}
          {ahora != null && t.publicado ? <span>{haceCuanto(t.publicado, ahora)}</span> : null}
          {duracionLegible(t.duracion) ? <span>{duracionLegible(t.duracion)}</span> : null}
        </div>
      </div>
    </Modal>
  );
}

const posDe = (pasos: readonly number[], v: number): number => { let p = 0; pasos.forEach((x, i) => { if (v >= x) p = i; }); return p; };

/** El modal «Filtros» de las miniaturas: rubro, idioma, publicado, el múltiplo (sólo con la enmienda) y el orden. */
function FiltrosThumbnailModal({ filtros, lista, onAplicar, onCerrar }: {
  filtros: FiltrosThumbnail; lista: readonly Thumbnail[]; onAplicar: (f: Partial<FiltrosThumbnail>) => void; onCerrar: () => void;
}) {
  const [f, setF] = useState<FiltrosThumbnail>(filtros);
  const poner = (c: Partial<FiltrosThumbnail>) => setF((p) => ({ ...p, ...c }));
  const cuantos = useMemo(() => filtrarThumbnails(lista, f, new Set(), Date.now()).length, [lista, f]);
  const ordenes = ordenesDisponibles();
  const mult: [number, number] = [posDe(PASOS_MULTIPLO_THUMBNAIL, f.outlierMin), f.outlierMax ? posDe(PASOS_MULTIPLO_THUMBNAIL, f.outlierMax) : PASOS_MULTIPLO_THUMBNAIL.length - 1];
  return (
    <Modal titulo="Filtros" onCerrar={onCerrar} ancho={760} completaEnCelular
      pie={(
        <>
          <button type="button" className={s.textoIzq} onClick={() => setF({ ...FILTROS_THUMBNAIL, q: f.q, canales: f.canales, vista: f.vista })}>Quitar filtros</button>
          <button type="button" className={s.secundario} onClick={onCerrar}>Cancelar</button>
          <button type="button" className={s.primario} onClick={() => onAplicar(f)}>Ver {contadorCorto(cuantos)} {cuantos === 1 ? 'miniatura' : 'miniaturas'}</button>
        </>
      )}>
      <div className={s.filtrosModal}>
        <section className={s.bloque} aria-label="Qué mostrar">
          <h3>Qué mostrar</h3>
          <div className={s.dosCol}>
            <label className={s.campo}>
              <span className={s.etiqueta}>Rubro</span>
              <select className={s.select} value={f.nicho} onChange={(e) => poner({ nicho: e.target.value as NichoThumbnail | '' })}>
                <option value="">Todos los rubros</option>
                {NICHOS_THUMBNAIL.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </label>
            <label className={s.campo}>
              <span className={s.etiqueta}>Idioma</span>
              <select className={s.select} value={f.idioma} onChange={(e) => poner({ idioma: e.target.value as IdiomaThumbnail | '' })}>
                <option value="">Todos los idiomas</option>
                {IDIOMAS_THUMBNAIL.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </label>
            <label className={s.campo}>
              <span className={s.etiqueta}>Publicado</span>
              <select className={s.select} value={f.periodo} onChange={(e) => poner({ periodo: e.target.value as PeriodoThumbnail })}>
                {PERIODOS_THUMBNAIL.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <label className={s.campo}>
              <span className={s.etiqueta}>Ordenar por</span>
              <select className={s.select} value={ordenes.some((o) => o.value === f.orden) ? f.orden : ORDEN_INICIAL_THUMBNAIL} onChange={(e) => poner({ orden: e.target.value as OrdenThumbnail })}>
                {ordenes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
        </section>
        <section className={s.bloque} aria-label="El múltiplo">
          <h3>Múltiplo</h3>
          {ENMIENDA_III_L ? (
            <>
              <Deslizador nombre="El múltiplo" pasos={PASOS_MULTIPLO_THUMBNAIL} desde={mult[0]} hasta={mult[1]}
                rotulo={(v, ultimo) => `${v}×${ultimo ? '+' : ''}`}
                onCambio={(a, b) => poner({ outlierMin: PASOS_MULTIPLO_THUMBNAIL[a], outlierMax: b === PASOS_MULTIPLO_THUMBNAIL.length - 1 ? 0 : PASOS_MULTIPLO_THUMBNAIL[b] })} />
              <ul className={s.leyenda}>
                {NIVELES_MULTIPLO.map((n) => <li key={n.id}><span className={s.mult} data-nivel={n.id}>{n.rango}</span> {n.rotulo}</li>)}
              </ul>
              <p className={s.nota}>Las vistas del video frente a las de los videos de su canal. {LEYENDA_DERIVADA}</p>
            </>
          ) : (
            <p className={s.nota}>{FALTA_LA_ENMIENDA}</p>
          )}
        </section>
      </div>
    </Modal>
  );
}
