'use client';

// =============================================================================
// ExplorarCarruseles — los carruseles de ejemplo, para elegir uno y editarlo (`/image-editor?ver=carruseles`, 6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «no se entiende bien la funcionalidad». Lo que pidió, y cómo quedó:
//   · «Lo principal al entrar son los ejemplos de carruseles. Ahí mismo se elige uno para editar, y recién entonces aparece la
//     vista de edición. La barra lateral de MaKo no se muestra salvo mientras se edita» → la pantalla es SÓLO la grilla (sin
//     la tarjeta del chat: ../ImageEditorCliente.tsx la monta fuera de PantallaCrear) y cada tarjeta trae «Editar»
//     (./EditarCarrusel.tsx), que arma tu versión y abre el editor, donde está el chat de MaKo.
//   · «Copiá la interfaz de Top Carousels: el encabezado "Encuentra tu siguiente OUTLIER" y sus botones, el filtro, las
//     opciones, el diseño de las tarjetas y poder pasar a la siguiente slide dentro de la tarjeta» → la interfaz, nunca sus
//     datos ni sus puntajes (sus términos lo prohíben: docs/hallazgos-carruseles.md). ⚠️ Armada con la descripción del pedido
//     y la del 4/11 (docs/relevo/nube-carruseles.md): las capturas que pone el Cerebro (docs/carruseles/referencia-top-carousels/)
//     no estaban al escribirla; los valores se ajustan contra ellas (docs/relevo/nube-carruseles-rediseno.md).
//   · «Sacá el texto "De las cuentas que sigues…", el botón "compacta" y las pestañas "Esta semana" y "Cuentas". Lo que hacían
//     pasa a filtros. Sin textos innecesarios» → «Esta semana» es «Publicado: últimos 7 días» (un link viejo con `vista=semana`
//     abre eso: lib/carruseles/explorar.ts) y «Cuentas» es el filtro de cuentas; seguir otra es el botón de arriba.
//   · «Filtro "CTA"» → los que piden comentar una palabra (lib/carruseles/cta.ts), y la tarjeta lo dice.
//   · «Espía de anuncios en imagen… sumalo a esta misma tab con filtros» → «Carruseles | Anuncios»: los anuncios que Competitors
//     Spy trajo de las cuentas que sigue el negocio (lib/carruseles/anuncios.ts), con sus días al aire.
//
// Lo puro (filtros, orden, la URL, guardados): lib/carruseles/explorar.ts, con tests/carruseles-explorar.test.ts. La misma
// pieza en la computadora y en el teléfono (app/m/image-editor, `?ver=carruseles`).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from '@/app/_ui/Link';
import { Modal } from '@/app/_ui/Modal';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { Dropdown, type DropdownGroup } from '@/app/components/Dropdown';
import {
  FILTROS_INICIALES, LARGOS_CARRUSEL, ORDENES_CARRUSEL, ORIGENES_CARRUSEL, OUTLIER_MINIMOS, PERIODOS_CARRUSEL, QUE_VER_CARRUSEL,
  contadorCorto, creadoresDe, filtrarCarruseles, filtrosDeQuery, formatosDe, imagenesDe, nombreDeBusqueda, queryDeFiltros,
  rotuloCta, rotuloFormato, rotuloOutlier, sinFiltros,
  type BusquedaGuardada, type Carrusel, type FiltrosCarrusel, type LargoCarrusel, type OrdenCarrusel, type OrigenFiltro, type PeriodoCarrusel,
} from '@/lib/carruseles/explorar';
import { rotuloAire } from '@/lib/carruseles/anuncios';
import { explicarMultiplo, MULTIPLO_FUERTE } from '@/lib/multiplo-rendimiento';
import type { Formato } from '@/lib/spy-detalle';
import { EditarBiblioteca } from './EditarBiblioteca';
import { EditarCarrusel } from './EditarCarrusel';
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
  /** El admin del negocio de la plataforma: edita la biblioteca (el botón de arriba). */
  puedeEditarBiblioteca?: boolean;
  /** Cuántos anuncios de la competencia trajo Spy (el filtro «Anuncios»). Ausente = 0. */
  anuncios?: number;
};

/** El perfil público de un creador en Instagram (los de la biblioteca no tienen ficha en Spy del negocio). */
const perfilDeInstagram = (usuario: string) => `https://www.instagram.com/${encodeURIComponent(usuario)}/`;

/** Cuántas tarjetas se dibujan de una vez: más no se miran y la página se pone pesada. «Ver más» suma otras tantas. */
const DE_A = 40;

const CLAVES_FILTRO = ['q', 'de', 'origen', 'min', 'periodo', 'largo', 'formato', 'imagenes', 'orden', 'vista', 'cta', 'que'] as const;

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

const Marcador = ({ lleno }: { lleno: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={lleno ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
  </svg>
);
const Flecha = ({ izq }: { izq?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {izq ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
  </svg>
);
const Lupa = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);

export function ExplorarCarruseles({ datos, filtrosIniciales, telefono = false }: {
  datos: DatosExplorador;
  filtrosIniciales?: FiltrosCarrusel;
  /** En el teléfono: una columna y sin abrir otra pestaña para la publicación. */
  telefono?: boolean;
}) {
  const [f, setF] = useState<FiltrosCarrusel>(filtrosIniciales ?? FILTROS_INICIALES);
  const [guardados, setGuardados] = useState<Set<number>>(() => new Set(datos.guardados));
  const [busquedas, setBusquedas] = useState<BusquedaGuardada[]>(datos.busquedas);
  const [cuantas, setCuantas] = useState(DE_A);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<Carrusel | null>(null);
  const [biblioteca, setBiblioteca] = useState(false);
  const [, start] = useTransition();
  // El «hace cuánto» se calcula una vez montada la pantalla (el server no dibuja fechas relativas).
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => { setAhora(Date.now()); }, []);

  const cambiar = useCallback((cambio: Partial<FiltrosCarrusel>) => {
    setF((prev) => { const nuevo = { ...prev, ...cambio }; escribirEnLaUrl(nuevo); return nuevo; });
    setCuantas(DE_A);
  }, []);
  const reiniciar = () => { const nuevo = { ...FILTROS_INICIALES, que: f.que }; setF(nuevo); escribirEnLaUrl(nuevo); setCuantas(DE_A); };

  // Lo de cada lado (carruseles o anuncios): las cuentas y los tipos del filtro salen de lo que se está mirando.
  const delLado = useMemo(() => datos.carruseles.filter((c) => (c.clase === 'anuncio') === (f.que === 'anuncios')), [datos.carruseles, f.que]);
  const creadores = useMemo(() => creadoresDe(delLado), [delLado]);
  const propios = useMemo(() => datos.carruseles.filter((c) => c.origen === 'cuentas' && c.clase !== 'anuncio').length, [datos.carruseles]);
  const dosOrigenes = f.que === 'carruseles' && propios > 0 && datos.ejemplos > 0;
  const formatos = useMemo(() => formatosDe(delLado), [delLado]);
  const vistos = useMemo(() => filtrarCarruseles(datos.carruseles, f, guardados, ahora ?? Date.now()), [datos.carruseles, f, guardados, ahora]);
  const conCta = useMemo(() => delLado.filter((c) => c.cta).length, [delLado]);
  const anuncios = datos.anuncios ?? datos.carruseles.filter((c) => c.clase === 'anuncio').length;

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
  const usarBusqueda = (id: string) => {
    const b = busquedas.find((x) => x.id === id);
    if (!b) return;
    const nuevo = filtrosDeQuery(new URLSearchParams(b.query));
    setF(nuevo); escribirEnLaUrl(nuevo); setCuantas(DE_A);
  };
  const borrarBusqueda = (b: BusquedaGuardada) => {
    setAviso(null);
    start(async () => {
      const r = await borrarBusquedaAction(b.id);
      if (r.ok) setBusquedas(r.busquedas); else setAviso(r.error);
    });
  };

  // ── Los filtros: un desplegable con secciones (el de siempre de la casa) ──
  const grupos: DropdownGroup[] = [
    { title: 'Publicado', options: PERIODOS_CARRUSEL.map((p) => ({ value: `p:${p.value}`, label: p.label })) },
    ...(f.que === 'carruseles' ? [{ title: 'Láminas', options: LARGOS_CARRUSEL.map((l) => ({ value: `l:${l.value}`, label: l.label })) }] : []),
    ...(formatos.length ? [{ title: 'Tipo', options: [{ value: 'f:', label: 'Cualquier tipo' }, ...formatos.map((x) => ({ value: `f:${x.value}`, label: x.label, sub: `${x.n}` }))] }] : []),
    ...(dosOrigenes ? [{ title: 'De dónde', options: ORIGENES_CARRUSEL.map((o) => ({ value: `o:${o.value}`, label: o.label })) }] : []),
    ...(f.que === 'carruseles' ? [{ title: 'Mostrar', options: [{ value: 'i:1', label: 'También imágenes sueltas' }] }] : []),
  ];
  const marcados = [
    `p:${f.periodo}`, ...(f.que === 'carruseles' ? [`l:${f.largo}`] : []), ...(formatos.length ? [`f:${f.formato}`] : []),
    ...(dosOrigenes ? [`o:${f.origen}`] : []), ...(f.conImagenes ? ['i:1'] : []),
  ];
  const filtrosActivos = [f.periodo !== 'todo', f.largo !== 'todos', !!f.formato, f.conImagenes, f.origen !== 'todos'].filter(Boolean).length;
  const elegirFiltro = (v: string) => {
    if (v.startsWith('o:')) cambiar({ origen: v.slice(2) as OrigenFiltro });
    else if (v.startsWith('p:')) cambiar({ periodo: v.slice(2) as PeriodoCarrusel });
    else if (v.startsWith('l:')) cambiar({ largo: v.slice(2) as LargoCarrusel });
    else if (v.startsWith('f:')) cambiar({ formato: v.slice(2) as Formato | '' });
    else if (v === 'i:1') cambiar({ conImagenes: !f.conImagenes });
  };
  const ordenes = ORDENES_CARRUSEL.filter((o) => (f.que === 'anuncios' ? o.value !== 'outlier' && o.value !== 'interaccion' : o.value !== 'aire'));
  const orden = f.que === 'anuncios' && (f.orden === 'outlier' || f.orden === 'interaccion') ? 'aire' : f.orden;

  const hayAlgo = datos.carruseles.length > 0;
  const listos = vistos.slice(0, cuantas);
  const guardadosVista = f.vista === 'guardados';

  return (
    <div className={s.raiz} data-telefono={telefono ? 'si' : undefined}>
      <div className={s.col}>
        <header className={s.cabeza}>
          <h1>Encuentra tu siguiente <mark>OUTLIER</mark></h1>
          <div className={s.botones}>
            <button type="button" className={s.pastilla} aria-pressed={guardadosVista} onClick={() => cambiar({ vista: guardadosVista ? 'todos' : 'guardados' })}>
              <Marcador lleno={guardadosVista} /> Guardados{guardados.size ? <span className={s.n}>{guardados.size}</span> : null}
            </button>
            {busquedas.length > 0 && (
              <Dropdown value="" search={busquedas.length > 7} alContenido ariaLabel="Búsquedas guardadas"
                options={busquedas.map((b) => ({ value: b.id, label: b.nombre }))}
                botonLabel={<span>{telefono ? 'Búsquedas' : 'Búsquedas guardadas'} <span className={s.n}>{busquedas.length}</span></span>}
                onChange={usarBusqueda} buttonStyle={pastilla(false, telefono)} />
            )}
            <Link href="/competitor-spy" className={s.pastilla}>+ Seguir cuentas</Link>
            {datos.puedeEditarBiblioteca ? <button type="button" className={s.pastilla} onClick={() => setBiblioteca(true)}>Biblioteca</button> : null}
          </div>
          {hayAlgo && (
            <label className={s.busca}>
              <Lupa />
              <input type="search" value={f.q} onChange={(e) => cambiar({ q: e.target.value })} placeholder={telefono ? 'Busca carruseles o @creadores' : 'Busca carruseles, temas o @creadores'}
                aria-label="Buscar carruseles por tema o por @creador" enterKeyHint="search" />
            </label>
          )}
        </header>

        {datos.avisoBiblioteca ? <p role="alert" className={s.aviso}>{datos.avisoBiblioteca}<ReportarASoporte /></p> : null}

        {!hayAlgo ? (
          <div className={s.vacio}>
            <p>{datos.frase}</p>
            {datos.accion ? <Link href={datos.accion.ruta} className={s.boton}>{datos.accion.texto}</Link> : null}
          </div>
        ) : (
          <>
            <div className={s.filtros}>
              <div className={s.segmento} role="radiogroup" aria-label="Qué ver">
                {QUE_VER_CARRUSEL.map((q) => (
                  <button key={q.value} type="button" role="radio" aria-checked={f.que === q.value}
                    onClick={() => cambiar({ que: q.value, creadores: [], formato: '', orden: q.value === 'anuncios' ? 'aire' : 'outlier' })}>
                    {q.label}{q.value === 'anuncios' && anuncios ? <span className={s.n}>{anuncios}</span> : null}
                  </button>
                ))}
              </div>
              <Dropdown value="" varios={marcados} minimo={marcados.length} columns={[grupos]} subEnColumnas alContenido search={false}
                ariaLabel="Filtros" botonLabel={<span>Filtros{filtrosActivos ? ` · ${filtrosActivos}` : ''}</span>} onChange={elegirFiltro}
                buttonStyle={chip(filtrosActivos > 0)} />
              {f.que === 'carruseles' && (
                <Dropdown value={String(f.outlierMin)} search={false} alContenido ariaLabel="Outlier mínimo"
                  options={OUTLIER_MINIMOS.map((m) => ({ value: String(m), label: m ? `Outlier ${m}×+` : 'Cualquier outlier', sub: m ? `${m} veces lo que hace su cuenta, o más` : undefined }))}
                  botonLabel={<span>{f.outlierMin ? `Outlier ${f.outlierMin}×+` : 'Outlier'}</span>} onChange={(v) => cambiar({ outlierMin: Number(v) })}
                  buttonStyle={chip(f.outlierMin > 0)} />
              )}
              <button type="button" className={s.chip} aria-pressed={f.cta} onClick={() => cambiar({ cta: !f.cta })}
                title="Los que piden comentar una palabra: los que publican los dueños de negocio">
                CTA{conCta ? <span className={s.n}>{conCta}</span> : null}
              </button>
              {creadores.length > 1 && (
                <Dropdown value="" varios={f.creadores.map(String)} search={creadores.length > 7} alContenido ariaLabel="Cuentas"
                  options={creadores.map((c) => ({ value: String(c.id), label: c.nombre, sub: c.usuario ? `@${c.usuario} · ${c.n}` : `${c.n}`, avatar: c.foto }))}
                  botonLabel={<span>{f.creadores.length ? (f.creadores.length === 1 ? creadores.find((c) => c.id === f.creadores[0])?.nombre ?? 'Cuenta' : `${f.creadores.length} cuentas`) : 'Cuentas'}</span>}
                  onChange={(v) => { const id = Number(v); cambiar({ creadores: f.creadores.includes(id) ? f.creadores.filter((x) => x !== id) : [...f.creadores, id] }); }}
                  buttonStyle={chip(f.creadores.length > 0)} />
              )}
              <span className={s.espacio} />
              {!sinFiltros({ ...f, que: 'carruseles' }) && <button type="button" className={s.texto} onClick={reiniciar}>Quitar filtros</button>}
              {!sinFiltros(f) && <button type="button" className={s.texto} onClick={guardarBusqueda}>Guardar búsqueda</button>}
              <span className={s.total}>{contadorCorto(vistos.length)}</span>
              <Dropdown value={orden} search={false} alContenido ariaLabel="Orden" align="right"
                options={ordenes.map((o) => ({ value: o.value, label: o.label }))}
                botonLabel={<span>{ORDENES_CARRUSEL.find((o) => o.value === orden)?.label}</span>} onChange={(v) => cambiar({ orden: v as OrdenCarrusel })}
                buttonStyle={chip(false)} />
            </div>

            {busquedas.length > 0 && guardadosVista === false && busquedas.some((b) => b.query === queryDeFiltros(f)) ? (
              <div className={s.busquedas}>
                {busquedas.filter((b) => b.query === queryDeFiltros(f)).map((b) => (
                  <span key={b.id} className={s.busqueda}>
                    {b.nombre}
                    <button type="button" onClick={() => borrarBusqueda(b)} aria-label={`Borrar la búsqueda ${b.nombre}`} title="Borrar la búsqueda">✕</button>
                  </span>
                ))}
              </div>
            ) : null}

            {aviso && <p role="alert" className={s.aviso}>{aviso}<ReportarASoporte /></p>}

            {vistos.length === 0 ? (
              <div className={s.vacio}>
                <p>{guardadosVista && !guardados.size
                  ? 'Guarda un carrusel con el marcador y aparece aquí.'
                  : f.que === 'anuncios' && !anuncios
                    ? 'Todavía no hay anuncios de las cuentas que sigues. Spy los trae de la Biblioteca de Anuncios al leer cada cuenta.'
                    : 'Ningún ejemplo pasa estos filtros.'}</p>
                {f.que === 'anuncios' && !anuncios
                  ? <Link href="/competitor-spy" className={s.boton}>Abrir Competitors Spy</Link>
                  : !sinFiltros({ ...f, que: 'carruseles' }) ? <button type="button" className={s.boton} onClick={reiniciar}>Quitar filtros</button> : null}
              </div>
            ) : (
              <>
                <ul className={s.grilla} aria-label={f.que === 'anuncios' ? 'Anuncios' : 'Carruseles'}>
                  {listos.map((c) => (
                    <TarjetaCarrusel key={c.id} c={c} ahora={ahora} guardado={guardados.has(c.id)} telefono={telefono}
                      onGuardar={() => alternarGuardado(c)} onEditar={() => setEditando(c)} />
                  ))}
                </ul>
                {vistos.length > cuantas && (
                  <button type="button" className={s.mas} onClick={() => setCuantas((n) => n + DE_A)}>Ver más</button>
                )}
              </>
            )}
          </>
        )}
      </div>
      {editando ? <EditarCarrusel key={editando.id} carrusel={editando} onCerrar={() => setEditando(null)} /> : null}
      {biblioteca ? (
        <Modal titulo="Biblioteca de ejemplos" onCerrar={() => setBiblioteca(false)} ancho={720}>
          <EditarBiblioteca />
        </Modal>
      ) : null}
    </div>
  );
}

const chip = (activo: boolean) => ({
  height: 34, padding: '0 14px', borderRadius: 999, gap: 4, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 550,
  border: `1px solid ${activo ? 'transparent' : 'var(--border)'}`,
  background: activo ? 'var(--primary-bg)' : 'var(--surface)',
  color: activo ? 'var(--primary-strong, var(--primary))' : 'var(--ink)',
});
// En el teléfono, más chica: con las de la computadora, cada una ocupaba su propio renglón.
const pastilla = (activo: boolean, telefono = false) => ({ ...chip(activo), height: telefono ? 32 : 36, padding: telefono ? '0 12px' : '0 16px', fontSize: telefono ? 13 : 13.5, fontWeight: 600 });

/** Las láminas dentro de la tarjeta: se pasan con las flechas o deslizando (el dedo en el teléfono). */
function Laminas({ c, titulo }: { c: Carrusel; titulo: string }) {
  const imagenes = imagenesDe(c);
  const pista = useRef<HTMLDivElement | null>(null);
  const [i, setI] = useState(0);
  const total = imagenes.length;
  const ir = (k: number) => {
    const el = pista.current;
    if (!el) return;
    const n = Math.max(0, Math.min(total - 1, k));
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  };
  const alMover = () => {
    const el = pista.current;
    if (el && el.clientWidth) setI(Math.round(el.scrollLeft / el.clientWidth));
  };
  if (!total) return <span className={s.sinFoto}>{titulo.slice(0, 140) || 'Sin portada'}</span>;
  return (
    <>
      <div ref={pista} className={s.pista} onScroll={alMover} tabIndex={total > 1 ? 0 : -1} aria-label={total > 1 ? `${total} láminas: desliza para pasarlas` : undefined}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); ir(i + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1); } }}>
        {imagenes.map((src, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={k === 0 && titulo ? `Portada: ${titulo.slice(0, 80)}` : `Lámina ${k + 1}`} loading="lazy" referrerPolicy="no-referrer" draggable={false} />
        ))}
      </div>
      {total > 1 && (
        <>
          {i > 0 && <button type="button" className={s.ant} onClick={() => ir(i - 1)} aria-label="Lámina anterior"><Flecha izq /></button>}
          {i < total - 1 && <button type="button" className={s.sig} onClick={() => ir(i + 1)} aria-label="Lámina siguiente"><Flecha /></button>}
          <span className={s.puntos} aria-hidden>{imagenes.map((src, k) => <i key={src} data-actual={k === i ? 'si' : undefined} />)}</span>
          <span className={s.indice}>{i + 1}/{total}</span>
        </>
      )}
    </>
  );
}

function TarjetaCarrusel({ c, ahora, guardado, onGuardar, onEditar, telefono }: {
  c: Carrusel; ahora: number | null; guardado: boolean; onGuardar: () => void; onEditar: () => void; telefono: boolean;
}) {
  const titulo = c.gancho || c.texto || '';
  const anuncio = c.clase === 'anuncio';
  const fuerte = c.outlier != null && c.outlier >= MULTIPLO_FUERTE;
  const aire = anuncio ? rotuloAire(c) : null;
  const sinLaminasGuardadas = !anuncio && (c.laminas ?? 0) > 1 && imagenesDe(c).length <= 1;
  return (
    <li className={s.tarjeta}>
      <div className={s.mini} data-anuncio={anuncio ? 'si' : undefined}>
        <Laminas c={c} titulo={titulo} />
        <span className={s.marcas}>
          {c.outlier != null && (
            <span className={s.outlier} data-fuerte={fuerte ? 'si' : undefined}
              title={c.multiplo ? explicarMultiplo(c.multiplo) : `${String(c.outlier).replace('.', ',')} veces lo que suele hacer esta cuenta`}>
              {rotuloOutlier(c.outlier)}
            </span>
          )}
          {aire ? <span className={s.aire} data-activo={c.activo === false ? undefined : 'si'}>{aire}</span> : null}
          {sinLaminasGuardadas ? <span className={s.laminas} title={`${c.laminas} láminas`}>{c.laminas} láminas</span> : null}
        </span>
        <button type="button" className={s.guardar} data-guardado={guardado ? 'si' : undefined} onClick={onGuardar}
          aria-pressed={guardado} aria-label={guardado ? 'Quitar de guardados' : 'Guardar'} title={guardado ? 'Quitar de guardados' : 'Guardar'}>
          <Marcador lleno={guardado} />
        </button>
      </div>
      <div className={s.pie}>
        <div className={s.creador}>
          {c.creador.foto
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={c.creador.foto} alt="" className={s.cara} referrerPolicy="no-referrer" />
            : <span className={s.cara} aria-hidden>{inicial(c.creador.nombre)}</span>}
          {c.origen === 'biblioteca' && c.creador.usuario ? (
            <a href={perfilDeInstagram(c.creador.usuario)} target={telefono ? undefined : '_blank'} rel="noopener noreferrer" className={s.quien}
              title={`Ver el perfil de ${c.creador.nombre} en Instagram`}>@{c.creador.usuario}</a>
          ) : (
            <Link href={`/competitor-spy?competidor=${c.competidorId}`} className={s.quien} title={`Ver el análisis de ${c.creador.nombre} en Competitors Spy`}>
              {c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre}
            </Link>
          )}
          {ahora != null && c.publicada && !anuncio ? <span className={s.cuando}>{haceCuanto(c.publicada, ahora)}</span> : null}
        </div>
        {titulo ? <p className={s.gancho}>{titulo}</p> : null}
        <div className={s.datos}>
          {!anuncio && <span title="Me gusta">♥ {contadorCorto(c.megusta)}</span>}
          {!anuncio && <span title="Comentarios">💬 {contadorCorto(c.comentarios)}</span>}
          {c.cta ? <span className={s.cta} title="Pide comentar una palabra">{rotuloCta(c.cta)}</span> : c.formato && c.formato !== 'otro' ? <span className={s.formato}>{rotuloFormato(c.formato)}</span> : null}
        </div>
        <div className={s.acciones}>
          <button type="button" className={s.editar} onClick={onEditar}>Editar</button>
          {c.url ? (
            <a href={c.url} target={telefono ? undefined : '_blank'} rel="noopener noreferrer" className={s.original}
              title={anuncio ? 'Ver el anuncio en la Biblioteca de Anuncios' : 'Ver la publicación original en Instagram'}
              aria-label={anuncio ? 'Ver el anuncio original' : 'Ver la publicación original'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>
            </a>
          ) : null}
        </div>
      </div>
    </li>
  );
}
