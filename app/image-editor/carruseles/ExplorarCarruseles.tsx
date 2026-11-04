'use client';

// =============================================================================
// ExplorarCarruseles — «Carruseles que funcionan», adentro de Image (`/image-editor?ver=carruseles`)
// =============================================================================
// Martín, 4/11/2026: «mires y copies las funcionalidades… para ponerlos en MaKo en la sección de imagen generator». Se
// copian las FUNCIONES de un explorador de carruseles (lo que Martín vio en la app: Outliers, Trending this week, Bookmarks,
// Trackers, la búsqueda «Search carousels, topics and @creators», Save search y Saved searches, Filters, «Outlier score
// 1×+», el orden por Newest / Oldest / Highest outlier / Most engagement / Recently imported y la grilla de dos tamaños),
// con datos PROPIOS: las publicaciones públicas de las cuentas que este negocio sigue en Competitors Spy. Nunca su
// biblioteca (sus términos lo prohíben; docs/hallazgos-editor-imagen.md, «El explorador de carruseles»).
//
// Desde el 4/11/2026 se suma la BIBLIOTECA DE EJEMPLOS de la plataforma (lib/carruseles/biblioteca.ts): cuentas públicas y
// temas que lee la plataforma para todos, así un negocio que todavía no sigue a nadie ya tiene qué mirar. Se muestran como
// en Spy: con su creador, el link al original y sus números; su id va en negativo.
//
// Cada tarjeta muestra a su CREADOR y el link a la publicación original: es una referencia del negocio, no una plantilla
// de MaKo. El outlier es el de Spy (cuántas veces la mediana de su cuenta). Lo puro (filtros, orden, la URL, guardados):
// lib/carruseles/explorar.ts, con tests/carruseles-explorar.test.ts. Lo mismo en la computadora y en el teléfono
// (app/m/image-editor, `?ver=carruseles`).
//
// Vive en el CENTRO de la pantalla de Create (app/_crear/PantallaCrear.tsx): Image no tiene pestañas arriba (29/10/2026).
// =============================================================================

import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { SelectorVista } from '@/app/_ui/SelectorVista';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { Dropdown, type DropdownGroup } from '@/app/components/Dropdown';
import {
  FILTROS_INICIALES, LARGOS_CARRUSEL, ORDENES_CARRUSEL, ORIGENES_CARRUSEL, OUTLIER_MINIMOS, PERIODOS_CARRUSEL, VISTAS_CARRUSEL,
  contadorCorto, creadoresDe, filtrarCarruseles, filtrosDeQuery, formatosDe, nombreDeBusqueda, queryDeFiltros, rotuloFormato,
  rotuloOutlier, sinFiltros,
  type BusquedaGuardada, type Carrusel, type FiltrosCarrusel, type LargoCarrusel, type OrdenCarrusel, type OrigenFiltro, type PeriodoCarrusel,
} from '@/lib/carruseles/explorar';
import { EditarBiblioteca } from './EditarBiblioteca';
import type { Formato } from '@/lib/spy-detalle';
import { borrarBusquedaAction, guardarBusquedaAction, guardarCarruselAction } from './actions';
import s from './explorar.module.css';

/** Lo que llega del servidor (`leerExplorador`, lib/carruseles/explorar-servidor.ts). */
export type DatosExplorador = {
  carruseles: Carrusel[];
  guardados: number[];
  busquedas: BusquedaGuardada[];
  paso: 'sin-cuentas' | 'sin-instagram' | 'sin-carruseles' | 'listo';
  frase: string;
  accion: { texto: string; ruta: string } | null;
  /** Cuántos vienen de la biblioteca de ejemplos de la plataforma. */
  ejemplos: number;
  /** La biblioteca no se pudo leer (se ve lo del negocio). */
  avisoBiblioteca: string | null;
  /** El admin del negocio de la plataforma: edita la biblioteca desde «Cuentas». */
  puedeEditarBiblioteca?: boolean;
};

/** El perfil público de un creador en Instagram (los de la biblioteca no tienen ficha en Spy del negocio). */
const perfilDeInstagram = (usuario: string) => `https://www.instagram.com/${encodeURIComponent(usuario)}/`;

/** Cuántas tarjetas se dibujan de una vez: más no se miran y la página se pone pesada. «Ver más» suma otras tantas. */
const DE_A = 48;

const CLAVES_FILTRO = ['q', 'de', 'origen', 'min', 'periodo', 'largo', 'formato', 'imagenes', 'orden', 'vista'] as const;

/** Los filtros en la URL de la pestaña, sin tocar lo demás (el `?ws=`, `ver`): un link copiado abre lo mismo. */
function escribirEnLaUrl(f: FiltrosCarrusel) {
  try {
    const u = new URL(window.location.href);
    for (const k of CLAVES_FILTRO) u.searchParams.delete(k);
    for (const [k, v] of new URLSearchParams(queryDeFiltros(f))) u.searchParams.set(k, v);
    window.history.replaceState(window.history.state, '', u.pathname + u.search);
  } catch { /* sin URL que tocar (un test): el estado alcanza */ }
}

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

/** El ícono de guardar (el marcador), lleno cuando está guardado. */
const Marcador = ({ lleno }: { lleno: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={lleno ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
  </svg>
);
const IconoLaminas = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
    <rect x="7" y="3" width="13" height="16" rx="2" /><path d="M4 7v12a2 2 0 0 0 2 2h9" />
  </svg>
);

export function ExplorarCarruseles({ datos, filtrosIniciales, onUsar, telefono = false }: {
  datos: DatosExplorador;
  filtrosIniciales?: FiltrosCarrusel;
  /** «Hacer el mío»: arma un carrusel nuevo con la ESTRUCTURA de este (la etapa 2). Sin esto, no hay botón. */
  onUsar?: (c: Carrusel) => void;
  /** En el teléfono: sin la vista compacta y sin abrir otra pestaña para la publicación. */
  telefono?: boolean;
}) {
  const [f, setF] = useState<FiltrosCarrusel>(filtrosIniciales ?? FILTROS_INICIALES);
  const [guardados, setGuardados] = useState<Set<number>>(() => new Set(datos.guardados));
  const [busquedas, setBusquedas] = useState<BusquedaGuardada[]>(datos.busquedas);
  const [grilla, setGrilla] = useState<'grande' | 'compacta'>('grande');
  const [cuantas, setCuantas] = useState(DE_A);
  const [panel, setPanel] = useState<'carruseles' | 'cuentas'>('carruseles');
  const [aviso, setAviso] = useState<string | null>(null);
  const [, start] = useTransition();
  // El «hace cuánto» se calcula una vez: no hace falta que corra solo (y el server no dibuja fechas relativas).
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => { setAhora(Date.now()); }, []);

  const cambiar = useCallback((cambio: Partial<FiltrosCarrusel>) => {
    setF((prev) => { const nuevo = { ...prev, ...cambio }; escribirEnLaUrl(nuevo); return nuevo; });
    setCuantas(DE_A);
  }, []);

  const creadores = useMemo(() => creadoresDe(datos.carruseles), [datos.carruseles]);
  const propios = useMemo(() => datos.carruseles.filter((c) => c.origen === 'cuentas').length, [datos.carruseles]);
  const dosOrigenes = propios > 0 && datos.ejemplos > 0;
  const formatos = useMemo(() => formatosDe(datos.carruseles), [datos.carruseles]);
  const vistos = useMemo(() => filtrarCarruseles(datos.carruseles, f, guardados, ahora ?? Date.now()), [datos.carruseles, f, guardados, ahora]);
  const total = datos.carruseles.filter((c) => f.conImagenes || c.medio !== 'imagen').length;

  const alternarGuardado = (c: Carrusel) => {
    const guardar = !guardados.has(c.id);
    setGuardados((g) => { const n = new Set(g); if (guardar) n.add(c.id); else n.delete(c.id); return n; });
    setAviso(null);
    start(async () => {
      const r = await guardarCarruselAction(c.id, guardar);
      if (!r.ok) {
        setGuardados((g) => { const n = new Set(g); if (guardar) n.delete(c.id); else n.add(c.id); return n; });
        setAviso(r.error);
      }
    });
  };

  const guardarBusqueda = () => {
    const nombre = window.prompt('Nombre de la búsqueda', nombreDeBusqueda(f, creadores))?.trim();
    if (!nombre) return;
    setAviso(null);
    start(async () => {
      const r = await guardarBusquedaAction(nombre, queryDeFiltros(f));
      if (r.ok) setBusquedas(r.busquedas); else setAviso(r.error);
    });
  };
  const borrarBusqueda = (b: BusquedaGuardada) => {
    setAviso(null);
    start(async () => {
      const r = await borrarBusquedaAction(b.id);
      if (r.ok) setBusquedas(r.busquedas); else setAviso(r.error);
    });
  };
  const usarBusqueda = (b: BusquedaGuardada) => { const nuevo = filtrosDeQuery(new URLSearchParams(b.query)); setF(nuevo); escribirEnLaUrl(nuevo); setCuantas(DE_A); setPanel('carruseles'); };

  // ── Los filtros: un desplegable con secciones (el del Plan y Chats) ──
  const grupos: DropdownGroup[] = [
    { title: 'Publicado', options: PERIODOS_CARRUSEL.map((p) => ({ value: `p:${p.value}`, label: p.label })) },
    { title: 'Láminas', options: LARGOS_CARRUSEL.map((l) => ({ value: `l:${l.value}`, label: l.label })) },
    ...(formatos.length ? [{ title: 'Formato', options: [{ value: 'f:', label: 'Cualquier formato' }, ...formatos.map((x) => ({ value: `f:${x.value}`, label: x.label, sub: `${x.n}` }))] }] : []),
    { title: 'Mostrar', options: [{ value: 'i:1', label: 'Con imágenes sueltas' }] },
    // De dónde: sólo si hay de los dos (lo del negocio y la biblioteca de ejemplos).
    ...(dosOrigenes ? [{ title: 'De dónde', options: ORIGENES_CARRUSEL.map((o) => ({ value: `o:${o.value}`, label: o.label })) }] : []),
  ];
  const marcados = [`p:${f.periodo}`, `l:${f.largo}`, ...(formatos.length ? [`f:${f.formato}`] : []), ...(f.conImagenes ? ['i:1'] : []), ...(dosOrigenes ? [`o:${f.origen}`] : [])];
  const filtrosActivos = [f.periodo !== 'todo', f.largo !== 'todos', !!f.formato, f.conImagenes, f.origen !== 'todos'].filter(Boolean).length;
  const elegirFiltro = (v: string) => {
    if (v.startsWith('o:')) cambiar({ origen: v.slice(2) as OrigenFiltro });
    else if (v.startsWith('p:')) cambiar({ periodo: v.slice(2) as PeriodoCarrusel });
    else if (v.startsWith('l:')) cambiar({ largo: v.slice(2) as LargoCarrusel });
    else if (v.startsWith('f:')) cambiar({ formato: v.slice(2) as Formato | '' });
    else if (v === 'i:1') cambiar({ conImagenes: !f.conImagenes });
  };

  // Hay qué mirar si hay carruseles, sean del negocio o de la biblioteca de ejemplos.
  const hayAlgo = datos.carruseles.length > 0;
  const listos = vistos.slice(0, cuantas);

  return (
    <div className={s.raiz} data-telefono={telefono ? 'si' : undefined}>
      <div className={s.col}>
        <header className={s.cabeza}>
          <div className={s.titulo}>
            <h1>Carruseles que funcionan</h1>
            {hayAlgo ? <span className={s.cuenta}>{total}</span> : null}
          </div>
          <p className={s.bajada}>
            {propios > 0 && datos.ejemplos > 0
              ? <>De las cuentas que sigues en <Link href="/competitor-spy">Competitors Spy</Link> y de la biblioteca de ejemplos.</>
              : datos.ejemplos > 0
                ? 'De la biblioteca de ejemplos: carruseles públicos, cada uno de su creador.'
                : <>De las cuentas que sigues en <Link href="/competitor-spy">Competitors Spy</Link>.</>}
          </p>
        </header>

        {/* Con ejemplos a la vista y nada propio todavía: lo que falta para ver también los de su rubro, en una línea. */}
        {hayAlgo && datos.paso !== 'listo' ? (
          <p className={s.nota}>
            <span>{datos.frase}</span>
            {datos.accion ? <Link href={datos.accion.ruta}>{datos.accion.texto}</Link> : null}
          </p>
        ) : null}
        {datos.avisoBiblioteca ? <p role="alert" className={s.aviso}>{datos.avisoBiblioteca}<ReportarASoporte /></p> : null}

        {!hayAlgo ? (
          <div className={s.vacio}>
            <p>{datos.frase}</p>
            {datos.accion ? <Link href={datos.accion.ruta} className={s.boton}>{datos.accion.texto}</Link> : null}
          </div>
        ) : (
          <>
            <div className={s.barra}>
              <div className={s.vistas} role="tablist" aria-label="Qué carruseles ver">
                {VISTAS_CARRUSEL.map((v) => (
                  <button key={v.value} type="button" role="tab" aria-selected={panel === 'carruseles' && f.vista === v.value}
                    onClick={() => { setPanel('carruseles'); cambiar({ vista: v.value }); }}>
                    {v.value === 'todos' ? 'Los que funcionan' : v.label}
                    {v.value === 'guardados' && guardados.size ? <span className={s.n}>{guardados.size}</span> : null}
                  </button>
                ))}
                <button type="button" role="tab" aria-selected={panel === 'cuentas'} onClick={() => setPanel('cuentas')}>
                  Cuentas <span className={s.n}>{creadores.length}</span>
                </button>
              </div>
              {panel === 'carruseles' && (
                <label className={s.busca}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input value={f.q} onChange={(e) => cambiar({ q: e.target.value })} placeholder="Busca un tema o un @creador" aria-label="Buscar carruseles por tema o por @creador" />
                </label>
              )}
            </div>

            {panel === 'cuentas' ? (
              <Cuentas creadores={creadores} editar={!!datos.puedeEditarBiblioteca}
                onVer={(id) => { setPanel('carruseles'); cambiar({ creadores: [id], vista: 'todos' }); }} />
            ) : (
              <>
                <div className={s.filtros}>
                  <Dropdown value="" varios={marcados} minimo={(formatos.length ? 3 : 2) + (dosOrigenes ? 1 : 0)} columns={[grupos]} subEnColumnas alContenido search={false}
                    ariaLabel="Filtros" botonLabel={<span>Filtros{filtrosActivos ? ` · ${filtrosActivos}` : ''}</span>} onChange={elegirFiltro}
                    buttonStyle={chip(filtrosActivos > 0)} />
                  <Dropdown value={String(f.outlierMin)} search={false} alContenido ariaLabel="Outlier mínimo"
                    options={OUTLIER_MINIMOS.map((m) => ({ value: String(m), label: m ? `Outlier ${m}×+` : 'Cualquier outlier', sub: m ? `${m} veces lo que hace su cuenta, o más` : undefined }))}
                    botonLabel={<span>{f.outlierMin ? `Outlier ${f.outlierMin}×+` : 'Outlier'}</span>} onChange={(v) => cambiar({ outlierMin: Number(v) })}
                    buttonStyle={chip(f.outlierMin > 0)} />
                  {creadores.length > 1 && (
                    <Dropdown value="" varios={f.creadores.map(String)} search={creadores.length > 7} alContenido ariaLabel="Cuentas"
                      options={creadores.map((c) => ({ value: String(c.id), label: c.nombre, sub: c.usuario ? `@${c.usuario} · ${c.n}` : `${c.n}`, avatar: c.foto }))}
                      botonLabel={<span>{f.creadores.length ? (f.creadores.length === 1 ? creadores.find((c) => c.id === f.creadores[0])?.nombre ?? 'Cuenta' : `${f.creadores.length} cuentas`) : 'Cuentas'}</span>}
                      onChange={(v) => { const id = Number(v); cambiar({ creadores: f.creadores.includes(id) ? f.creadores.filter((x) => x !== id) : [...f.creadores, id] }); }}
                      buttonStyle={chip(f.creadores.length > 0)} />
                  )}
                  <Dropdown value={f.orden} search={false} alContenido ariaLabel="Orden" align="right"
                    options={ORDENES_CARRUSEL.map((o) => ({ value: o.value, label: o.label }))}
                    botonLabel={<span>{ORDENES_CARRUSEL.find((o) => o.value === f.orden)?.label}</span>} onChange={(v) => cambiar({ orden: v as OrdenCarrusel })}
                    buttonStyle={chip(false)} />
                  <span className={s.espacio} />
                  {!sinFiltros(f) && <button type="button" className={s.texto} onClick={() => { setF(FILTROS_INICIALES); escribirEnLaUrl(FILTROS_INICIALES); }}>Quitar filtros</button>}
                  {!sinFiltros(f) && <button type="button" className={s.texto} onClick={guardarBusqueda}>Guardar búsqueda</button>}
                  {!telefono && <SelectorVista vistas={['grande', 'compacta'] as const} vista={grilla} onVista={setGrilla} ariaLabel="Tamaño de la grilla" />}
                </div>

                {busquedas.length > 0 && (
                  <div className={s.busquedas} aria-label="Búsquedas guardadas">
                    {busquedas.map((b) => (
                      <span key={b.id} className={s.busqueda} data-activa={queryDeFiltros(f) === b.query ? 'si' : undefined}>
                        <button type="button" onClick={() => usarBusqueda(b)} title="Usar esta búsqueda">{b.nombre}</button>
                        <button type="button" className={s.quitar} onClick={() => borrarBusqueda(b)} aria-label={`Borrar la búsqueda ${b.nombre}`} title="Borrar">✕</button>
                      </span>
                    ))}
                  </div>
                )}

                {aviso && <p role="alert" className={s.aviso}>{aviso}<ReportarASoporte /></p>}

                {vistos.length === 0 ? (
                  <div className={s.vacio}>
                    <p>{f.vista === 'guardados' && !guardados.size
                      ? 'Guarda un carrusel con el marcador y aparece aquí.'
                      : f.vista === 'semana' ? 'Esta semana no publicaron carruseles que pasen estos filtros.' : 'Ningún carrusel pasa estos filtros.'}</p>
                    {!sinFiltros(f) && <button type="button" className={s.boton} onClick={() => { setF(FILTROS_INICIALES); escribirEnLaUrl(FILTROS_INICIALES); }}>Quitar filtros</button>}
                  </div>
                ) : (
                  <>
                    <ul className={s.grilla} data-grilla={grilla} aria-label="Carruseles">
                      {listos.map((c) => (
                        <TarjetaCarrusel key={c.id} c={c} ahora={ahora} guardado={guardados.has(c.id)} onGuardar={() => alternarGuardado(c)} onUsar={onUsar} compacta={grilla === 'compacta'} telefono={telefono} />
                      ))}
                    </ul>
                    {vistos.length > cuantas && (
                      <button type="button" className={s.mas} onClick={() => setCuantas((n) => n + DE_A)}>Ver más ({vistos.length - cuantas})</button>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const chip = (activo: boolean) => ({
  height: 32, padding: '0 12px', borderRadius: 999, gap: 4, fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
  border: `1px solid ${activo ? 'transparent' : 'var(--border)'}`,
  background: activo ? 'var(--primary-bg)' : 'var(--surface)',
  color: activo ? 'var(--primary-strong, var(--primary))' : 'var(--ink)',
});

function TarjetaCarrusel({ c, ahora, guardado, onGuardar, onUsar, compacta, telefono }: {
  c: Carrusel; ahora: number | null; guardado: boolean; onGuardar: () => void; onUsar?: (c: Carrusel) => void; compacta: boolean; telefono: boolean;
}) {
  const titulo = c.gancho || c.texto || '';
  const fuerte = c.outlier != null && c.outlier >= 2;
  return (
    <li className={s.tarjeta} data-compacta={compacta ? 'si' : undefined}>
      <div className={s.mini}>
        {c.miniatura
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.miniatura} alt={titulo ? `Portada: ${titulo.slice(0, 80)}` : `Carrusel de ${c.creador.nombre}`} loading="lazy" referrerPolicy="no-referrer" />
          : <span className={s.sinFoto}>{titulo.slice(0, 140) || 'Sin portada'}</span>}
        <span className={s.marcas}>
          {c.outlier != null && (
            <span className={s.outlier} data-fuerte={fuerte ? 'si' : undefined} title={`Rindió ${rotuloOutlier(c.outlier)} lo que hace una publicación típica de su cuenta`}>
              {rotuloOutlier(c.outlier)}
            </span>
          )}
          {c.medio === 'carrusel' && (
            <span className={s.laminas} title={c.laminas ? `${c.laminas} láminas` : 'Carrusel'}><IconoLaminas />{c.laminas ?? ''}</span>
          )}
        </span>
        <button type="button" className={s.guardar} data-guardado={guardado ? 'si' : undefined} onClick={onGuardar}
          aria-pressed={guardado} aria-label={guardado ? 'Quitar de guardados' : 'Guardar'} title={guardado ? 'Quitar de guardados' : 'Guardar'}>
          <Marcador lleno={guardado} />
        </button>
        {onUsar && !compacta && (
          <button type="button" className={s.usar} onClick={() => onUsar(c)}>Hacer el mío</button>
        )}
      </div>
      {!compacta && (
        <div className={s.pie}>
          <div className={s.creador}>
            {c.creador.foto
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={c.creador.foto} alt="" className={s.cara} referrerPolicy="no-referrer" />
              : <span className={s.cara} aria-hidden>{inicial(c.creador.nombre)}</span>}
            {c.origen === 'biblioteca' && c.creador.usuario ? (
              // De la biblioteca: su perfil público (no tiene ficha en el Spy del negocio).
              <a href={perfilDeInstagram(c.creador.usuario)} target={telefono ? undefined : '_blank'} rel="noopener noreferrer" className={s.quien}
                title={`Ver el perfil de ${c.creador.nombre} en Instagram`}>@{c.creador.usuario}</a>
            ) : (
              <Link href={`/competitor-spy?competidor=${c.competidorId}`} className={s.quien} title={`Ver el análisis de ${c.creador.nombre} en Competitors Spy`}>
                {c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre}
              </Link>
            )}
            {ahora != null && c.publicada ? <span className={s.cuando}>{haceCuanto(c.publicada, ahora)}</span> : null}
          </div>
          {titulo ? <p className={s.texto2}>{titulo}</p> : null}
          <div className={s.numeros}>
            <span title="Me gusta">♥ {contadorCorto(c.megusta)}</span>
            <span title="Comentarios">💬 {contadorCorto(c.comentarios)}</span>
            {c.formato && c.formato !== 'otro' ? <span className={s.formato}>{rotuloFormato(c.formato)}</span> : null}
            {/* Un ícono y no un rótulo: al lado del tipo, «Biblioteca» se cortaba en «Bi…». El nombre va en el title y el aria-label. */}
            {c.origen === 'biblioteca' ? (
              <span className={s.deBiblio} title="De la biblioteca de ejemplos: público, de su creador" aria-label="De la biblioteca de ejemplos" role="img">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 19.5V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2Z" /><path d="M4 19.5A2 2 0 0 0 6 21h12" /><path d="M9 7h6" /></svg>
              </span>
            ) : null}
            {c.url ? (
              <a href={c.url} target={telefono ? undefined : '_blank'} rel="noopener noreferrer" className={s.original} title="Ver la publicación original en Instagram" aria-label={`Ver la publicación original de ${c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre} en Instagram`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>
              </a>
            ) : null}
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * «Cuentas»: las que el negocio sigue con carruseles (con su análisis en Spy y la salida para seguir otra) y, aparte, los
 * creadores de la biblioteca de ejemplos (con su perfil en Instagram). La plataforma edita la biblioteca acá mismo.
 */
/** Cuántos creadores de la biblioteca se ven en «Cuentas» antes de «Ver todos». */
const CREADORES_A_LA_VISTA = 12;

function Cuentas({ creadores, onVer, editar }: { creadores: ReturnType<typeof creadoresDe>; onVer: (id: number) => void; editar: boolean }) {
  const propias = creadores.filter((c) => c.id > 0);
  const deBiblioteca = creadores.filter((c) => c.id < 0);
  const [todosBiblio, setTodosBiblio] = useState(false);
  const fila = (c: (typeof creadores)[number], acciones: ReactNode) => (
    <li key={c.id} className={s.cuentaFila}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {c.foto ? <img src={c.foto} alt="" className={s.cara} referrerPolicy="no-referrer" /> : <span className={s.cara} aria-hidden>{inicial(c.nombre)}</span>}
      <span className={s.cuentaNombre}>
        <strong>{c.nombre}</strong>
        <span>{c.usuario ? `@${c.usuario} · ` : ''}{c.n} {c.n === 1 ? 'carrusel' : 'carruseles'}</span>
      </span>
      <button type="button" className={s.texto} onClick={() => onVer(c.id)}>Ver sus carruseles</button>
      {acciones}
    </li>
  );
  return (
    <div className={s.cuentas}>
      {propias.length > 0 && (
        <>
          <h2 className={s.subtitulo}>Cuentas que sigues</h2>
          <ul aria-label="Cuentas que sigues">
            {propias.map((c) => fila(c, <Link href={`/competitor-spy?competidor=${c.id}`} className={s.texto}>Analizar la cuenta</Link>))}
          </ul>
        </>
      )}
      <Link href="/competitor-spy" className={s.boton}>Seguir otra cuenta</Link>
      {deBiblioteca.length > 0 && (
        <>
          <h2 className={s.subtitulo}>Biblioteca de ejemplos</h2>
          {/* Los que llegaron por un tema pueden ser cientos: se ven los que más tienen, y el resto con «Ver todos». */}
          <ul aria-label="Creadores de la biblioteca de ejemplos">
            {(todosBiblio ? deBiblioteca : deBiblioteca.slice(0, CREADORES_A_LA_VISTA)).map((c) => fila(c, c.usuario
              ? <a href={perfilDeInstagram(c.usuario)} target="_blank" rel="noopener noreferrer" className={s.texto}>Ver en Instagram</a>
              : null))}
          </ul>
          {!todosBiblio && deBiblioteca.length > CREADORES_A_LA_VISTA && (
            <button type="button" className={s.mas} onClick={() => setTodosBiblio(true)}>Ver todos ({deBiblioteca.length})</button>
          )}
        </>
      )}
      {editar ? <EditarBiblioteca /> : null}
    </div>
  );
}
