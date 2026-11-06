'use client';

// =============================================================================
// ExplorarCarruseles — los carruseles de ejemplo, para elegir uno y editarlo (la portada de `/image-editor`, 6/11/2026)
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
// Y lo que pidió Martín el 6/11/2026 (en producción), y cómo quedó:
//   · «La tab de "Encuentra tu siguiente OUTLIER" tiene que ser la principal, no "¿Qué vas a crear hoy?"» → esto es la portada de
//     Image (`/image-editor`, sin `?ver=`); las plantillas están detrás de «Crear desde cero» (`?ver=crear`), también en el celular.
//   · «elimina el filtro de "CTA"… hay algunos que sí sirven, reflexiones» → sin chip ni contador; la tarjeta sigue diciendo qué
//     pide comentar. «en el filtro de CTA pusiste puros de DenBorg» → ningún creador llena la pantalla (lib/carruseles/variedad.ts).
//   · «elimina lo de "biblioteca"… está horrible» → sin la pastilla ni su modal; la biblioteca se carga desde la PC
//     (scripts/carruseles-biblioteca.mts) y por la API de MaKo.
//   · «"Tamaño de la tarjeta" eso no lo quiero, solo grande» → una sola tarjeta. «No quiero que esté activado el filtro semanal por
//     defecto» → se entra con todo el período.
//   · «Muchos no tengo el botón para desplazar a la derecha» → las flechas salen con las láminas guardadas, también en el celular.
//   · «en anuncios trajiste un montón de videos» → sólo los anuncios de imagen (lib/carruseles/anuncios.ts).
//   · «una tab que sea "Thumbnails"» → la tercera opción, con su tarjeta 16:9 (./Thumbnails.tsx, lib/thumbnails/).
//
// Lo puro (filtros, orden, la URL, guardados): lib/carruseles/explorar.ts, con tests/carruseles-explorar.test.ts. La misma
// pieza en la computadora y en el teléfono (app/m/image-editor).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { Dropdown } from '@/app/components/Dropdown';
import {
  FILTROS_INICIALES, ORDENES_CARRUSEL, QUE_VER_CARRUSEL,
  contadorCorto, creadoresDe, creadoresParecidos, filtrarCarruseles, filtrosDeQuery, formatosDe, imagenesDe, nivelDeMultiplo, nombreDeBusqueda,
  parecidosA, queryDeFiltros, rotuloCta, rotuloFormato, rotuloOutlier, sinFiltros,
  type BusquedaGuardada, type Carrusel, type FiltrosCarrusel, type OrdenCarrusel, type QueVer,
} from '@/lib/carruseles/explorar';
import { FILTROS_THUMBNAIL, queryDeThumbnails, type FiltrosThumbnail, type Thumbnail } from '@/lib/thumbnails/explorar';
import { rotuloAire } from '@/lib/carruseles/anuncios';
import { explicarMultiplo } from '@/lib/multiplo-rendimiento';
import { EditarCarrusel } from './EditarCarrusel';
import { CarruselAbierto } from './CarruselAbierto';
import { FiltrosCarruselModal } from './FiltrosCarruselModal';
import { PanelThumbnails, type DatosThumbnails } from './Thumbnails';
import { borrarBusquedaAction, guardarBusquedaAction, guardarCarruselAction, guardarThumbnailAction } from './actions';
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
  /** Cuántos anuncios de la competencia trajo Spy (el filtro «Anuncios»), sólo los de imagen. Ausente = 0. */
  anuncios?: number;
  /** Las miniaturas de YouTube de la biblioteca (Thumbnails, 6/11/2026). Ausente = no se leyeron (se dice al elegirlas). */
  thumbnails?: DatosThumbnails | null;
};

/** El perfil público de un creador en Instagram (los de la biblioteca no tienen ficha en Spy del negocio). */
const perfilDeInstagram = (usuario: string) => `https://www.instagram.com/${encodeURIComponent(usuario)}/`;

/** Cuántas tarjetas se dibujan de una vez: más no se miran y la página se pone pesada. «Ver más» suma otras tantas. */
const DE_A = 40;

/** TODAS las claves que escriben los filtros (de carruseles y de miniaturas), y las viejas: así no queda ninguna colgada. */
const CLAVES_FILTRO = ['q', 'de', 'origen', 'min', 'omax', 'imin', 'imax', 'lmin', 'lmax', 'ocultar', 'periodo', 'largo', 'formato', 'imagenes', 'orden', 'vista', 'cta', 'tam', 'que', 'nicho', 'idioma', 'ver'] as const;

/** Los filtros en la URL de la pestaña, sin tocar lo demás (el `?ws=`): un link copiado abre lo mismo. */
function escribirEnLaUrl(query: string) {
  try {
    const u = new URL(window.location.href);
    for (const k of CLAVES_FILTRO) u.searchParams.delete(k);
    for (const [k, v] of new URLSearchParams(query)) u.searchParams.set(k, v);
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

export function ExplorarCarruseles({ datos, filtrosIniciales, thumbnailsIniciales, telefono = false, rutaCrear = '/image-editor?ver=crear' }: {
  datos: DatosExplorador;
  filtrosIniciales?: FiltrosCarrusel;
  /** Los filtros de las miniaturas que dice la URL (lib/thumbnails/explorar.ts, `filtrosThumbnailDeQuery`). */
  thumbnailsIniciales?: FiltrosThumbnail;
  /** En el teléfono: una columna y sin abrir otra pestaña para la publicación. */
  telefono?: boolean;
  /** «Crear desde cero»: las plantillas de Image (en el teléfono, su ruta de /m). */
  rutaCrear?: string;
}) {
  const [f, setF] = useState<FiltrosCarrusel>(filtrosIniciales ?? FILTROS_INICIALES);
  const [ft, setFt] = useState<FiltrosThumbnail>(thumbnailsIniciales ?? FILTROS_THUMBNAIL);
  const [guardados, setGuardados] = useState<Set<number>>(() => new Set(datos.guardados));
  const [guardadosT, setGuardadosT] = useState<Set<number>>(() => new Set(datos.thumbnails && datos.thumbnails.ok ? datos.thumbnails.guardados : []));
  const enThumbs = f.que === 'thumbnails';
  const [busquedas, setBusquedas] = useState<BusquedaGuardada[]>(datos.busquedas);
  const [cuantas, setCuantas] = useState(DE_A);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<Carrusel | null>(null);
  /** El carrusel abierto (el modal de dos partes), el modal de filtros y «parecidos a…». */
  const [abierto, setAbierto] = useState<Carrusel | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [parecidosDe, setParecidosDe] = useState<Carrusel | null>(null);
  const [, start] = useTransition();
  // El «hace cuánto» se calcula una vez montada la pantalla (el server no dibuja fechas relativas).
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => { setAhora(Date.now()); }, []);

  const cambiar = useCallback((cambio: Partial<FiltrosCarrusel>) => {
    setF((prev) => { const nuevo = { ...prev, ...cambio }; escribirEnLaUrl(queryDeFiltros(nuevo)); return nuevo; });
    setCuantas(DE_A);
  }, []);
  const cambiarT = useCallback((cambio: Partial<FiltrosThumbnail>) => {
    setFt((prev) => { const nuevo = { ...prev, ...cambio }; escribirEnLaUrl(queryDeThumbnails(nuevo)); return nuevo; });
  }, []);
  const reiniciar = () => { const nuevo = { ...FILTROS_INICIALES, que: f.que }; setF(nuevo); escribirEnLaUrl(queryDeFiltros(nuevo)); setCuantas(DE_A); };
  /** Carruseles · Anuncios · Thumbnails: cada lado con sus filtros (las cuentas y los tipos de uno no son los del otro). */
  const irA = (que: QueVer) => {
    setParecidosDe(null);
    if (que === 'thumbnails') { setF((prev) => ({ ...prev, que })); escribirEnLaUrl(queryDeThumbnails(ft)); return; }
    cambiar({ que, creadores: [], formato: '', ocultar: [], orden: que === 'anuncios' ? 'aire' : 'outlier' });
  };

  // Lo de cada lado (carruseles o anuncios): las cuentas y los tipos del filtro salen de lo que se está mirando.
  const delLado = useMemo(() => datos.carruseles.filter((c) => (c.clase === 'anuncio') === (f.que === 'anuncios')), [datos.carruseles, f.que]);
  const creadores = useMemo(() => creadoresDe(delLado), [delLado]);
  const propios = useMemo(() => datos.carruseles.filter((c) => c.origen === 'cuentas' && c.clase !== 'anuncio').length, [datos.carruseles]);
  const dosOrigenes = f.que === 'carruseles' && propios > 0 && datos.ejemplos > 0;
  const formatos = useMemo(() => formatosDe(delLado), [delLado]);
  const vistos = useMemo(() => filtrarCarruseles(datos.carruseles, f, guardados, ahora ?? Date.now()), [datos.carruseles, f, guardados, ahora]);
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

  const alternarThumbnail = (t: Thumbnail) => {
    const guardar = !guardadosT.has(t.id);
    setGuardadosT((g) => { const n = new Set(g); if (guardar) n.add(t.id); else n.delete(t.id); return n; });
    setAviso(null);
    start(async () => {
      const r = await guardarThumbnailAction(t.id, guardar);
      if (!r.ok) {
        setGuardadosT((g) => { const n = new Set(g); if (guardar) n.delete(t.id); else n.add(t.id); return n; });
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
    setF(nuevo); escribirEnLaUrl(queryDeFiltros(nuevo)); setCuantas(DE_A);
  };
  const borrarBusqueda = (b: BusquedaGuardada) => {
    setAviso(null);
    start(async () => {
      const r = await borrarBusquedaAction(b.id);
      if (r.ok) setBusquedas(r.busquedas); else setAviso(r.error);
    });
  };

  // ── Los filtros: un modal (./FiltrosCarruselModal.tsx). Acá, cuántos hay prendidos para el botón ──
  const filtrosActivos = [f.periodo !== 'todo', f.largo !== 'todos', !!f.formato, f.conImagenes, f.origen !== 'todos', f.outlierMin > 0 || !!f.outlierMax,
    !!f.interMin || !!f.interMax, !!f.lamMin || !!f.lamMax, !!f.ocultar?.length].filter(Boolean).length;
  const ordenes = ORDENES_CARRUSEL.filter((o) => (f.que === 'anuncios' ? o.value !== 'outlier' && o.value !== 'interaccion' : o.value !== 'aire'));
  const orden = f.que === 'anuncios' && (f.orden === 'outlier' || f.orden === 'interaccion') ? 'aire' : f.orden;

  const hayAlgo = datos.carruseles.length > 0;
  const listas = parecidosDe ? parecidosA(parecidosDe, delLado) : vistos;
  const listos = listas.slice(0, cuantas);
  const guardadosVista = enThumbs ? ft.vista === 'guardados' : f.vista === 'guardados';
  const nGuardados = enThumbs ? guardadosT.size : guardados.size;
  const abrirParecidos = (c: Carrusel) => { setAbierto(null); setParecidosDe(c); setCuantas(DE_A); };
  const hayThumbs = !!datos.thumbnails && datos.thumbnails.ok && datos.thumbnails.lista.length > 0;

  // Las pastillas (Guardados, Búsquedas, Seguir cuentas, Crear desde cero): en la computadora van bajo el título; en el teléfono,
  // en la MISMA fila que los filtros, que se desliza (así el primer ejemplo no arranca a la mitad de la pantalla).
  const botones = (
    <div className={s.botones}>
      <button type="button" className={s.pastilla} aria-pressed={guardadosVista}
        onClick={() => (enThumbs ? cambiarT({ vista: guardadosVista ? 'todos' : 'guardados' }) : cambiar({ vista: guardadosVista ? 'todos' : 'guardados' }))}>
        <Marcador lleno={guardadosVista} /> Guardados{nGuardados ? <span className={s.n}>{nGuardados}</span> : null}
      </button>
      {busquedas.length > 0 && !enThumbs && (
        <Dropdown value="" search={busquedas.length > 7} alContenido ariaLabel="Búsquedas guardadas"
          options={busquedas.map((b) => ({ value: b.id, label: b.nombre }))}
          botonLabel={<span>{telefono ? 'Búsquedas' : 'Búsquedas guardadas'} <span className={s.n}>{busquedas.length}</span></span>}
          onChange={usarBusqueda} buttonStyle={pastilla(false, telefono)} />
      )}
      <Link href="/competitor-spy" className={s.pastilla}>+ Seguir cuentas</Link>
      {/* Las plantillas de «¿Qué vas a crear hoy?» (6/11/2026: lo principal son los ejemplos; crear de cero queda a un toque). */}
      <Link href={rutaCrear} className={s.crear}><span aria-hidden>＋</span> Crear desde cero</Link>
    </div>
  );

  const segmento = (
    <div className={s.segmento} role="radiogroup" aria-label="Qué ver">
      {QUE_VER_CARRUSEL.map((q) => (
        <button key={q.value} type="button" role="radio" aria-checked={f.que === q.value} onClick={() => irA(q.value)}>
          {q.label}{q.value === 'anuncios' && anuncios ? <span className={s.n}>{anuncios}</span> : null}
        </button>
      ))}
    </div>
  );

  return (
    <div className={s.raiz} data-telefono={telefono ? 'si' : undefined}>
      <div className={s.col}>
        <header className={s.cabeza}>
          <h1>Encuentra tu siguiente <mark>OUTLIER</mark></h1>
          {telefono ? null : botones}
          {(hayAlgo || hayThumbs) && (
            <label className={s.busca}>
              <Lupa />
              {enThumbs ? (
                <input type="search" value={ft.q} onChange={(e) => cambiarT({ q: e.target.value })} placeholder={telefono ? 'Busca miniaturas o @canales' : 'Busca miniaturas, temas o @canales'}
                  aria-label="Buscar miniaturas por tema o por @canal" enterKeyHint="search" />
              ) : (
                <input type="search" value={f.q} onChange={(e) => { setParecidosDe(null); cambiar({ q: e.target.value }); }} placeholder={telefono ? 'Busca carruseles o @creadores' : 'Busca carruseles, temas o @creadores'}
                  aria-label="Buscar carruseles por tema o por @creador" enterKeyHint="search" />
              )}
            </label>
          )}
        </header>

        {datos.avisoBiblioteca ? <p role="alert" className={s.aviso}>{datos.avisoBiblioteca}<ReportarASoporte /></p> : null}

        {enThumbs ? (
          <>
            {aviso && <p role="alert" className={s.aviso}>{aviso}<ReportarASoporte /></p>}
            <PanelThumbnails datos={datos.thumbnails} f={ft} cambiar={cambiarT} guardados={guardadosT} alternarGuardado={alternarThumbnail}
              ahora={ahora} telefono={telefono} segmento={segmento} botones={botones} />
          </>
        ) : !hayAlgo ? (
          <div className={s.vacio}>
            <p>{datos.frase}</p>
            {datos.accion ? <Link href={datos.accion.ruta} className={s.boton}>{datos.accion.texto}</Link> : null}
            {hayThumbs ? <button type="button" className={s.texto} onClick={() => irA('thumbnails')}>Ver miniaturas de YouTube</button> : null}
          </div>
        ) : (
          <>
            <div className={s.filtros}>
              {/* En el teléfono, qué ver (Carruseles · Anuncios · Thumbnails) va PRIMERO en la fila que se desliza: es lo que cambia la
                  pantalla, y al final quedaba fuera de la vista (6/11/2026, autocrítica). Las pastillas, después. */}
              {segmento}
              {telefono ? botones : null}
              <button type="button" className={s.chip} aria-pressed={filtrosActivos > 0} onClick={() => setFiltrosAbiertos(true)}>
                <Ajustes /> Filtros{filtrosActivos ? <span className={s.n}>{filtrosActivos}</span> : null}
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
              {telefono ? null : <span className={s.total}>{contadorCorto(vistos.length)} {f.que === 'anuncios' ? (vistos.length === 1 ? 'anuncio' : 'anuncios') : (vistos.length === 1 ? 'carrusel' : 'carruseles')}</span>}
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

            {parecidosDe ? (
              <div className={s.banda}>
                <span>Parecidos a «{(parecidosDe.gancho || parecidosDe.texto || 'este carrusel').slice(0, 60)}»</span>
                <button type="button" className={s.texto} onClick={() => setParecidosDe(null)}>Volver</button>
              </div>
            ) : null}

            {aviso && <p role="alert" className={s.aviso}>{aviso}<ReportarASoporte /></p>}

            {listas.length === 0 ? (
              <div className={s.vacio}>
                <p>{parecidosDe ? 'No hay otros ejemplos parecidos a este.' : guardadosVista && !guardados.size
                  ? 'Guarda un carrusel con el marcador y aparece aquí.'
                  : f.que === 'anuncios' && !anuncios
                    ? 'Todavía no hay anuncios de las cuentas que sigues. Spy los trae de la Biblioteca de Anuncios al leer cada cuenta.'
                    : 'Ningún ejemplo pasa estos filtros.'}</p>
                {parecidosDe ? <button type="button" className={s.boton} onClick={() => setParecidosDe(null)}>Volver</button>
                  : f.que === 'anuncios' && !anuncios
                    ? <Link href="/competitor-spy" className={s.boton}>Abrir Competitors Spy</Link>
                    : !sinFiltros({ ...f, que: 'carruseles' }) ? <button type="button" className={s.boton} onClick={reiniciar}>Quitar filtros</button> : null}
              </div>
            ) : (
              <>
                <ul className={s.grilla} aria-label={f.que === 'anuncios' ? 'Anuncios' : 'Carruseles'}>
                  {listos.map((c) => (
                    <TarjetaCarrusel key={c.id} c={c} ahora={ahora} guardado={guardados.has(c.id)} telefono={telefono}
                      onAbrir={() => setAbierto(c)} onGuardar={() => alternarGuardado(c)} onEditar={() => setEditando(c)} onParecidos={() => abrirParecidos(c)} />
                  ))}
                </ul>
                {listas.length > cuantas && (
                  <button type="button" className={s.mas} onClick={() => setCuantas((n) => n + DE_A)}>Ver más</button>
                )}
              </>
            )}
          </>
        )}
      </div>
      {abierto ? (
        <CarruselAbierto key={abierto.id} c={abierto} guardado={guardados.has(abierto.id)} telefono={telefono}
          nParecidos={parecidosA(abierto, delLado).length} creadoresParecidos={creadoresParecidos(abierto, delLado)}
          onGuardar={() => alternarGuardado(abierto)} onEditar={() => { const c = abierto; setAbierto(null); setEditando(c); }}
          onParecidos={() => abrirParecidos(abierto)} onCreador={(id) => { setAbierto(null); setParecidosDe(null); cambiar({ creadores: [id] }); }}
          onCerrar={() => setAbierto(null)} />
      ) : null}
      {filtrosAbiertos ? (
        <FiltrosCarruselModal filtros={f} carruseles={delLado} formatos={formatos} dosOrigenes={dosOrigenes}
          onAplicar={(c) => { setFiltrosAbiertos(false); setParecidosDe(null); cambiar(c); }} onCerrar={() => setFiltrosAbiertos(false)} />
      ) : null}
      {editando ? <EditarCarrusel key={editando.id} carrusel={editando} onCerrar={() => setEditando(null)} /> : null}
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
          <span className={s.indice}>{i + 1}/{total}</span>
        </>
      )}
    </>
  );
}

const Ajustes = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
);
const Parecidos = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden><rect x="3" y="6" width="12" height="15" rx="2" /><path d="M8 3h11a2 2 0 0 1 2 2v12" /></svg>
);

function TarjetaCarrusel({ c, ahora, guardado, onAbrir, onGuardar, onEditar, onParecidos, telefono }: {
  c: Carrusel; ahora: number | null; guardado: boolean; onAbrir: () => void; onGuardar: () => void; onEditar: () => void; onParecidos: () => void; telefono: boolean;
}) {
  const titulo = c.gancho || c.texto || '';
  const anuncio = c.clase === 'anuncio';
  const nivel = anuncio ? null : nivelDeMultiplo(c.outlier);
  const aire = anuncio ? rotuloAire(c) : null;
  const sinLaminasGuardadas = !anuncio && (c.laminas ?? 0) > 1 && imagenesDe(c).length <= 1;
  return (
    <li className={s.tarjeta}>
      {/* Tocar la imagen abre el carrusel; los botones de adentro hacen lo suyo. */}
      <div className={s.mini} data-anuncio={anuncio ? 'si' : undefined}
        onClick={(e) => { if (!(e.target as HTMLElement).closest('button, a')) onAbrir(); }}>
        <Laminas c={c} titulo={titulo} />
        <span className={s.marcas}>
          {aire ? <span className={s.aire} data-activo={c.activo === false ? undefined : 'si'}>{aire}</span> : null}
          {sinLaminasGuardadas ? <span className={s.laminas} title={`${c.laminas} láminas`}>{c.laminas} láminas</span> : null}
        </span>
        <span className={s.sobreImagen}>
          <button type="button" className={s.editar} onClick={onEditar}>Editar</button>
          <button type="button" className={s.icono} onClick={onParecidos} aria-label="Ver parecidos" title="Ver parecidos"><Parecidos /></button>
          <button type="button" className={s.icono} data-guardado={guardado ? 'si' : undefined} onClick={onGuardar}
            aria-pressed={guardado} aria-label={guardado ? 'Quitar de guardados' : 'Guardar'} title={guardado ? 'Quitar de guardados' : 'Guardar'}>
            <Marcador lleno={guardado} />
          </button>
        </span>
      </div>
      <div className={s.pie}>
        <div className={s.fila1}>
          {c.outlier != null && nivel ? (
            <span className={s.mult} data-nivel={nivel} title={c.multiplo ? explicarMultiplo(c.multiplo) : `${String(c.outlier).replace('.', ',')} veces lo que suele hacer esta cuenta`}>
              {rotuloOutlier(c.outlier)}
            </span>
          ) : null}
          {titulo ? <button type="button" className={s.gancho} onClick={onAbrir}>{titulo}</button> : null}
        </div>
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
        <div className={s.datos}>
          {!anuncio && <span title="Me gusta">♥ {contadorCorto(c.megusta)}</span>}
          {!anuncio && <span title="Comentarios">💬 {contadorCorto(c.comentarios)}</span>}
          {c.cta ? <span className={s.cta} title="Pide comentar una palabra">{rotuloCta(c.cta)}</span> : c.formato && c.formato !== 'otro' ? <span className={s.formato}>{rotuloFormato(c.formato)}</span> : null}
        </div>
        {/* En el celular no hay «pasar el mouse»: «Editar» queda a la vista, liviano. */}
        <button type="button" className={s.editarLiviano} onClick={onEditar}>Editar</button>
      </div>
    </li>
  );
}
