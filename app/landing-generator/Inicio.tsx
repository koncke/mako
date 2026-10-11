'use client';

// =============================================================================
// Inicio — el Panel de Gamma para las landings de MaKo
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D9).
//
// Es el Panel de Gamma (relevo gamma-ui §3) con la caja de Gamma 5 arriba:
//   · barra lateral: Landings (el «Gammas» de Gamma), Recientes, Creadas por mí,
//     Favoritos, Publicadas (el «Sitios» de Gamma), Carpetas con su «+», Plantillas,
//     Temas y Papelera — más el «Ir a» (Ctrl K), que acá filtra por título;
//   · la caja «¿Qué quieres crear?» con su «+» (Subir archivos, Agregar una plantilla,
//     Importar desde URL), el modo Plan | Express y el ↑ de enviar: entra a Crear con el
//     pedido precargado (crear/CrearConIA.tsx);
//   · «+ Crear nuevo IA», «+ Nuevo desde cero» e «Importar ▾» (archivo o URL, y «Del
//     generador anterior»: los borradores de landing_drafts, que se convierten con
//     specADoc del lado del server);
//   · la grilla o la lista de landings: miniatura (la primera sección con el render
//     público), título, «Creada por… · Editada hace…», el chip «Publicada», ⭐ y el
//     menú ⋯ (Abrir, Duplicar, Cambiar nombre, Mover a carpeta…, Favoritos, Copiar
//     enlace público, Enviar a la papelera); en la Papelera, Restaurar y Eliminar para
//     siempre con la confirmación de Gamma («¿Eliminar de forma permanente?»);
//   · Plantillas (lib/editor-landing/plantillas.ts) con su vista previa y «Usar
//     plantilla», y Temas (la galería con «Estándar | Personalizado» y sus chips).
//
// Decisiones que no se ven en el código:
//   · Crear algo (desde cero, una plantilla, un tema, un borrador viejo) navega DURO al
//     editor: lo que cambió es qué existe (AGENTS.md). Lo demás (favorito, renombrar,
//     carpeta, papelera) se aplica con la respuesta del server en la lista local: el
//     server devuelve la fila y no hay una lista del server que refrescar.
//   · «Recientes» es lo abierto desde ESTE navegador (localStorage, `marcarReciente`):
//     no hay registro de vistas en la base y no se inventa uno. «Creadas por mí» compara
//     con el nombre que guarda el server al crear (el mismo `nombre || email`).
//   · Las carpetas son el campo `carpeta` de cada landing (Gamma deja una carpeta vacía;
//     acá una carpeta nueva vive en este navegador hasta que se le mueve una landing).
//   · Lo que NO se copia: arrastrar una landing a una carpeta (un gesto se verifica
//     arrastrando en un navegador, AGENTS.md), «Compartido contigo», «Inspiración»,
//     «Fuentes personalizadas», los formatos de Gamma 5 (Presentación, Social…: acá
//     todo es una página web) y los conectores del «+».
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link, { useRouter, useWs } from '@/app/_ui/Link';
import { TEMAS, temaPorId, type Tema } from '@/lib/editor-landing/temas';
import { CATEGORIAS_PLANTILLA, PLANTILLAS, type CategoriaPlantilla, type Plantilla } from '@/lib/editor-landing/plantillas';
import { tarjetasDe, urlPublica, type JsonNodo } from '@/lib/editor-landing/doc';
import type { LandingResumen, PedidoDocs, TemaPropio } from '@/lib/editor-landing/api-tipos';
import type { BorradorViejo } from '@/lib/editor-landing/server';
import {
  CSS_GP, DialogoGamma, Filtros, Ico, ItemMenu, MenuFlotante, MiniaturaLanding, MuestraTema, SeparadorMenu, TileTema,
  dejarCaja, guardarLocal, haceCuanto, irDuro, leerLocal, leerRecientes, marcarReciente, pedirDocs, useAviso,
  type OpcionDesplegable, Desplegable, URL_FUENTE_CHROME,
} from './MiniaturaLanding';

// ─────────────────────────────────────────────────────────────────────────────
// Lo puro
// ─────────────────────────────────────────────────────────────────────────────

export type Vista =
  | 'todas' | 'recientes' | 'mias' | 'favoritos' | 'publicadas' | 'plantillas' | 'temas' | 'papelera'
  | `carpeta:${string}`;
export type Orden = 'editada' | 'creada' | 'titulo';

const VISTAS_FIJAS: readonly Vista[] = ['todas', 'recientes', 'mias', 'favoritos', 'publicadas', 'plantillas', 'temas', 'papelera'];

/** La vista de la query (`?vista=plantillas` desde Crear), o la de siempre. */
export function vistaValida(v: string | null | undefined): Vista {
  if (!v) return 'todas';
  if ((VISTAS_FIJAS as readonly string[]).includes(v)) return v as Vista;
  return v.startsWith('carpeta:') && v.length > 8 ? (v as Vista) : 'todas';
}

/** Publicada = tiene slug y una foto publicada (el «Sitios» de Gamma). */
export function esPublicada(d: Pick<LandingResumen, 'slug' | 'publicadoAt'>): boolean {
  return !!d.slug && !!d.publicadoAt;
}

export const normalizar = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Las landings de una vista. La Papelera es un mundo aparte: lo que está ahí no aparece
 * en ninguna otra vista (ni en su carpeta, ni en Favoritos), como en Gamma.
 */
export function filtrarDocs(docs: readonly LandingResumen[], vista: Vista, q: string, yo: string, recientes: Readonly<Record<string, number>>): LandingResumen[] {
  const enPapelera = vista === 'papelera';
  let l = docs.filter((d) => d.papelera === enPapelera);
  if (vista === 'recientes') l = l.filter((d) => recientes[String(d.id)]);
  else if (vista === 'mias') l = l.filter((d) => !!yo && d.creadoPor === yo);
  else if (vista === 'favoritos') l = l.filter((d) => d.favorito);
  else if (vista === 'publicadas') l = l.filter(esPublicada);
  else if (vista.startsWith('carpeta:')) l = l.filter((d) => d.carpeta === vista.slice('carpeta:'.length));
  const n = normalizar(q);
  return n ? l.filter((d) => normalizar(d.titulo).includes(n)) : l;
}

export function ordenarDocs(docs: readonly LandingResumen[], orden: Orden, asc: boolean): LandingResumen[] {
  const signo = asc ? 1 : -1;
  const clave = (d: LandingResumen) => (orden === 'creada' ? d.creado : d.actualizado);
  return [...docs].sort((a, b) => {
    if (orden === 'titulo') return signo * a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' });
    return signo * clave(a).localeCompare(clave(b)) || b.id - a.id;
  });
}

/** Las carpetas que existen: las que tienen landings (fuera de la papelera) y las creadas acá. */
export function carpetasDe(docs: readonly LandingResumen[], locales: readonly string[]): string[] {
  const s = new Set<string>();
  for (const d of docs) if (d.carpeta && !d.papelera) s.add(d.carpeta);
  for (const c of locales) if (c.trim()) s.add(c.trim());
  return [...s].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Comodidades de este navegador
// ─────────────────────────────────────────────────────────────────────────────

const CLAVE_PREFS = 'gp.panel.prefs';
const CLAVE_CARPETAS = 'gp.panel.carpetas';
type Prefs = { orden: Orden; asc: boolean; lista: boolean };
const PREFS_DEFAULT: Prefs = { orden: 'editada', asc: false, lista: false };
const TOPE_CARPETAS_VISIBLES = 6;

const ORDENES: readonly OpcionDesplegable<Orden>[] = [
  { valor: 'editada', texto: 'Última edición', icono: 'reloj' },
  { valor: 'creada', texto: 'Fecha de creación', icono: 'calendario' },
  { valor: 'titulo', texto: 'Alfabético', icono: 'texto-aa' },
];

const TITULO_VISTA: Record<string, string> = {
  todas: 'Landings', recientes: 'Recientes', mias: 'Creadas por mí', favoritos: 'Favoritos',
  publicadas: 'Publicadas', plantillas: 'Plantillas', temas: 'Temas', papelera: 'Papelera',
};

const VACIO: Record<string, string> = {
  todas: 'Aún no tienes landings. Crea la primera con IA o desde cero.',
  recientes: 'Aún no has abierto ninguna landing en este navegador.',
  mias: 'Aún no has creado ninguna landing.',
  favoritos: 'No se encontraron favoritos',
  publicadas: 'Aún no has publicado ninguna landing.',
  papelera: 'La papelera está vacía.',
};

// ─────────────────────────────────────────────────────────────────────────────
// El Panel
// ─────────────────────────────────────────────────────────────────────────────

export type PropsInicio = {
  docs: LandingResumen[];
  errorLista: string | null;
  propios: TemaPropio[];
  errorTemas: string | null;
  /** El nombre con el que el server firma lo que crea esta persona («Creadas por mí»). */
  yo: string;
  /** APP_BASE_URL, para «Copiar enlace público». */
  base: string;
  /** Date.now() del server: el primer render del navegador usa el mismo (hidratación). */
  ahora: number;
  vistaInicial: string | null;
};

type Dialogo =
  | { tipo: 'renombrar'; doc: LandingResumen }
  | { tipo: 'carpeta'; doc: LandingResumen }
  | { tipo: 'eliminar'; doc: LandingResumen }
  | { tipo: 'nuevaCarpeta' }
  | { tipo: 'borradores' }
  | { tipo: 'plantilla'; plantilla: Plantilla }
  | { tipo: 'tema'; tema: Tema };

export function Inicio(props: PropsInicio) {
  const router = useRouter();
  const ws = useWs();
  const { avisar, nodo: aviso } = useAviso();

  const [lista, setLista] = useState<LandingResumen[]>(props.docs);
  const [errorLista, setErrorLista] = useState(props.errorLista);
  const [vista, setVista] = useState<Vista>(() => vistaValida(props.vistaInicial));
  const [q, setQ] = useState('');
  const [prefs, setPrefs] = useState<Prefs>(PREFS_DEFAULT);
  const [recientes, setRecientes] = useState<Record<string, number>>({});
  const [carpetasLocales, setCarpetasLocales] = useState<string[]>([]);
  const [ahora, setAhora] = useState(props.ahora);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [menuDoc, setMenuDoc] = useState<{ doc: LandingResumen; ancla: HTMLElement } | null>(null);
  const [menuImportar, setMenuImportar] = useState<HTMLElement | null>(null);
  const [menuMas, setMenuMas] = useState<HTMLElement | null>(null);
  const [menuCarpetas, setMenuCarpetas] = useState<HTMLElement | null>(null);
  const [caja, setCaja] = useState('');
  const [modoCaja, setModoCaja] = useState<'plan' | 'express'>('plan');
  const [creando, setCreando] = useState(false);
  const busqueda = useRef<HTMLInputElement>(null);

  // Lo de este navegador se lee después de montar (el server no lo tiene).
  useEffect(() => {
    const p = leerLocal<Partial<Prefs>>(CLAVE_PREFS, {});
    setPrefs({
      orden: ORDENES.some((o) => o.valor === p.orden) ? (p.orden as Orden) : PREFS_DEFAULT.orden,
      asc: p.asc === true,
      lista: p.lista === true,
    });
    setRecientes(leerRecientes());
    const c = leerLocal<unknown>(CLAVE_CARPETAS, []);
    setCarpetasLocales(Array.isArray(c) ? c.filter((x): x is string => typeof x === 'string').slice(0, 50) : []);
    setAhora(Date.now());
    const t = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // Ctrl/⌘ K = «Ir a» (Gamma): enfoca la búsqueda.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); busqueda.current?.focus(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);

  const cambiarPrefs = (p: Partial<Prefs>) => setPrefs((x) => { const n = { ...x, ...p }; guardarLocal(CLAVE_PREFS, n); return n; });
  const cerrarDialogo = useCallback(() => setDialogo(null), []);
  const cerrarMenuDoc = useCallback(() => setMenuDoc(null), []);
  const cerrarImportar = useCallback(() => setMenuImportar(null), []);
  const cerrarMas = useCallback(() => setMenuMas(null), []);
  const cerrarCarpetas = useCallback(() => setMenuCarpetas(null), []);

  const temaDe = useCallback((id: string) => temaPorId(id, props.propios), [props.propios]);
  const carpetas = useMemo(() => carpetasDe(lista, carpetasLocales), [lista, carpetasLocales]);

  const esDeLandings = vista !== 'plantillas' && vista !== 'temas';
  const visibles = useMemo(() => {
    if (!esDeLandings) return [];
    const f = filtrarDocs(lista, vista, q, props.yo, recientes);
    if (vista === 'recientes') return [...f].sort((a, b) => (recientes[String(b.id)] ?? 0) - (recientes[String(a.id)] ?? 0));
    return ordenarDocs(f, prefs.orden, prefs.asc);
  }, [esDeLandings, lista, vista, q, props.yo, recientes, prefs.orden, prefs.asc]);

  // ── Acciones sobre una landing ───────────────────────────────────────────

  const actualizar = (id: number, cambio: Partial<LandingResumen>) => setLista((l) => l.map((d) => (d.id === id ? { ...d, ...cambio } : d)));

  const abrir = (d: LandingResumen) => { marcarReciente(d.id); router.push(`/landing-generator/${d.id}`); };

  const favorito = async (d: LandingResumen) => {
    const valor = !d.favorito;
    actualizar(d.id, { favorito: valor });
    const r = await pedirDocs({ accion: 'favorito', id: d.id, valor });
    if (!r.ok) { actualizar(d.id, { favorito: d.favorito }); avisar('No se pudo guardar'); console.error('[panel] favorito', r.error); }
  };

  const duplicar = async (d: LandingResumen) => {
    const r = await pedirDocs({ accion: 'duplicar', id: d.id });
    if (!r.ok) { avisar('No se pudo duplicar'); console.error('[panel] duplicar', r.error); return; }
    setLista((l) => [r.doc, ...l]);
    avisar('Landing duplicada');
  };

  const restaurar = async (d: LandingResumen) => {
    const r = await pedirDocs({ accion: 'restaurar', id: d.id });
    if (!r.ok) { avisar('No se pudo restaurar'); console.error('[panel] restaurar', r.error); return; }
    actualizar(d.id, { papelera: false });
    avisar('Landing restaurada');
  };

  const aPapelera = async (d: LandingResumen) => {
    const r = await pedirDocs({ accion: 'papelera', id: d.id });
    if (!r.ok) { avisar('No se pudo mover'); console.error('[panel] papelera', r.error); return; }
    actualizar(d.id, { papelera: true });
    // Deshacer devuelve la MISMA landing (restaurar), no una copia.
    avisar('Enviada a la papelera', () => void restaurar(d));
  };

  const copiarEnlace = async (d: LandingResumen) => {
    if (!d.slug) return;
    try {
      await navigator.clipboard.writeText(urlPublica(props.base, d.slug));
      avisar('Enlace copiado');
    } catch {
      avisar('No se pudo copiar');
    }
  };

  /** Crear algo nuevo y abrirlo: lo que cambió es QUÉ EXISTE, así que la navegación es dura. */
  const crearYAbrir = async (pedido: Extract<PedidoDocs, { accion: 'crear' }>) => {
    if (creando) return;
    setCreando(true);
    const r = await pedirDocs(pedido);
    if (!r.ok) { setCreando(false); avisar('No se pudo crear'); console.error('[panel] crear', r.error); return; }
    marcarReciente(r.doc.id);
    irDuro(`/landing-generator/${r.doc.id}`, ws);
  };

  const nuevoDesdeCero = () => void crearYAbrir({ accion: 'crear', config: { origen: { modo: 'cero' } } });
  const usarPlantilla = (p: Plantilla) => void crearYAbrir({
    accion: 'crear', titulo: p.nombre, contenido: p.contenido(), config: { tema: p.tema, origen: { modo: 'plantilla', plantilla: p.id } },
  });
  const usarTema = (t: Tema) => void crearYAbrir({ accion: 'crear', config: { tema: t.id, origen: { modo: 'cero' } } });

  const enviarCaja = () => {
    const p = caja.trim();
    if (!p) return;
    const q2 = new URLSearchParams({ desde: 'caja', modo: modoCaja });
    // Sin sessionStorage (ventana privada estricta), el pedido viaja en la URL, recortado.
    if (!dejarCaja({ prompt: p, modo: modoCaja })) q2.set('prompt', p.slice(0, 1_500));
    router.push(`/landing-generator/crear?${q2.toString()}`);
  };

  const recargarLista = async () => {
    const r = await pedirDocs({ accion: 'listar' });
    if (!r.ok) { setErrorLista(r.error); return; }
    setErrorLista(null);
    setLista(r.docs);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const irVista = (v: Vista) => { setVista(v); setMenuCarpetas(null); };
  const tituloVista = vista.startsWith('carpeta:') ? vista.slice('carpeta:'.length) : TITULO_VISTA[vista] ?? 'Landings';
  const carpetasVisibles = carpetas.slice(0, TOPE_CARPETAS_VISIBLES);

  const itemNav = (v: Vista, texto: string, icono: string) => (
    <button key={v} type="button" className="gp-nav-item" aria-current={vista === v ? 'page' : undefined} onClick={() => irVista(v)}>
      <Ico n={icono} t={16} />
      <span>{texto}</span>
    </button>
  );

  const tarjetaLanding = (d: LandingResumen) => {
    const publicada = esPublicada(d);
    const autor = d.creadoPor && d.creadoPor === props.yo ? 'Creada por ti' : d.creadoPor ? `Creada por ${d.creadoPor}` : null;
    const editada = `Editada ${haceCuanto(d.actualizado, ahora)}`;
    const mini = <MiniaturaLanding tarjeta={d.primera} tema={temaDe(d.tema)} />;
    if (vista === 'papelera') {
      return (
        <article key={d.id} className="gp-card" data-papelera="si">
          <div className="gp-card-mini">{mini}</div>
          <div className="gp-card-info">
            <div className="gp-card-titulo">{d.titulo || 'Sin título'}</div>
            <div className="gp-card-meta">{editada}</div>
          </div>
          <div className="gp-card-papelera">
            <button type="button" className="gp-btn gp-btn-contorno" onClick={() => void restaurar(d)}><Ico n="deshacer" t={14} /> Restaurar</button>
            <button type="button" className="gp-btn gp-btn-borrar" onClick={() => setDialogo({ tipo: 'eliminar', doc: d })}>Eliminar para siempre</button>
          </div>
        </article>
      );
    }
    return (
      <article key={d.id} className="gp-card">
        <Link href={`/landing-generator/${d.id}`} className="gp-card-enlace" aria-label={`Abrir ${d.titulo || 'Sin título'}`} onClick={() => marcarReciente(d.id)}>
          <div className="gp-card-mini">{mini}</div>
          <div className="gp-card-info">
            <div className="gp-card-titulo">{d.titulo || 'Sin título'}</div>
            <div className="gp-card-meta">
              {publicada && <span className="gp-chip gp-chip-publicada"><Ico n="globo" t={11} /> Publicada</span>}
              {autor && <span className="gp-card-autor">{autor}</span>}
              <span>{editada}</span>
            </div>
          </div>
        </Link>
        <button
          type="button"
          className="gp-card-fav"
          data-activo={d.favorito ? 'si' : undefined}
          aria-label={d.favorito ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          aria-pressed={d.favorito}
          onClick={() => void favorito(d)}
        >
          <Ico n={d.favorito ? 'estrella-llena' : 'estrella'} t={16} />
        </button>
        <button
          type="button"
          className="gp-card-mas"
          aria-label="Más opciones"
          aria-haspopup="menu"
          onClick={(e) => setMenuDoc(menuDoc?.doc.id === d.id ? null : { doc: d, ancla: e.currentTarget })}
        >
          <Ico n="puntos" t={16} />
        </button>
      </article>
    );
  };

  let contenido: ReactNode;
  if (vista === 'plantillas') {
    contenido = <GaleriaPlantillas q={q} onVer={(p) => setDialogo({ tipo: 'plantilla', plantilla: p })} />;
  } else if (vista === 'temas') {
    contenido = <GaleriaTemas q={q} propios={props.propios} errorTemas={props.errorTemas} onVer={(t) => setDialogo({ tipo: 'tema', tema: t })} />;
  } else if (errorLista) {
    contenido = (
      <div className="gp-error gp-error-bloque" role="alert">
        <span>No se pudieron cargar las landings.</span>
        <button type="button" className="gp-btn gp-btn-contorno" onClick={() => void recargarLista()}>Reintentar</button>
      </div>
    );
  } else if (!visibles.length) {
    contenido = <p className="gp-vacio">{q.trim() ? 'No se encontraron resultados' : vista.startsWith('carpeta:') ? 'Carpeta vacía.' : VACIO[vista] ?? ''}</p>;
  } else {
    contenido = <div className={prefs.lista ? 'gp-lista' : 'gp-grilla'}>{visibles.map(tarjetaLanding)}</div>;
  }

  const md = menuDoc?.doc;

  return (
    <div className="gma gp gp-panel">
      <style dangerouslySetInnerHTML={{ __html: CSS_GP + CSS_PANEL }} />
      <link rel="stylesheet" href={URL_FUENTE_CHROME} />

      <aside className="gp-lateral" aria-label="Landing Generator">
        <label className="gp-ir-a">
          <Ico n="buscar" t={14} />
          <input ref={busqueda} type="search" value={q} placeholder="Ir a" aria-label="Buscar por título" onChange={(e) => setQ(e.target.value)} />
          <kbd>Ctrl K</kbd>
        </label>
        <nav className="gp-nav">
          {itemNav('todas', 'Landings', 'paginas')}
          {itemNav('recientes', 'Recientes', 'reloj')}
          {itemNav('mias', 'Creadas por mí', 'usuario')}
          {itemNav('favoritos', 'Favoritos', 'estrella')}
          {itemNav('publicadas', 'Publicadas', 'globo')}
          {/* Cambia de RUTA (el diagnóstico de una landing, ex Landing Analyst): va como Link y no por itemNav. */}
          <Link href="/landing-generator/analizar" className="gp-nav-item"><Ico n="reporte" t={16} /><span>Diagnóstico</span></Link>
        </nav>
        <div className="gp-nav-seccion">
          <span>Carpetas</span>
          <button type="button" className="gp-icono-btn" aria-label="Crear una carpeta" onClick={() => setDialogo({ tipo: 'nuevaCarpeta' })}><Ico n="mas" t={14} /></button>
        </div>
        <nav className="gp-nav">
          {carpetasVisibles.map((c) => itemNav(`carpeta:${c}`, c, 'carpeta'))}
          {carpetas.length > TOPE_CARPETAS_VISIBLES && (
            <button type="button" className="gp-nav-item gp-nav-mas" onClick={(e) => setMenuCarpetas(menuCarpetas ? null : e.currentTarget)}>
              <Ico n="puntos" t={16} /><span>Ver todas ({carpetas.length})</span>
            </button>
          )}
        </nav>
        <nav className="gp-nav gp-nav-abajo">
          {itemNav('plantillas', 'Plantillas', 'plantillas')}
          {itemNav('temas', 'Temas', 'paleta')}
          {itemNav('papelera', 'Papelera', 'papelera')}
        </nav>
      </aside>

      {/* Un <div> y no un <main>: el <main> de la pantalla es el de `Pagina` (AGENTS.md). */}
      <div className="gp-contenido">
        {vista === 'todas' && (
          <section className="gp-home" aria-label="Crear">
            <h1 className="gp-home-titulo">¿Qué vas a crear hoy?</h1>
            <form className="gp-caja" onSubmit={(e) => { e.preventDefault(); enviarCaja(); }}>
              <textarea
                className="gp-caja-entrada"
                value={caja}
                rows={2}
                maxLength={8_000}
                placeholder="¿Qué quieres crear?"
                aria-label="¿Qué quieres crear?"
                onChange={(e) => setCaja(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarCaja(); } }}
              />
              <div className="gp-caja-fila">
                <button type="button" className="gp-caja-mas" aria-label="Agregar" aria-haspopup="menu" onClick={(e) => setMenuMas(menuMas ? null : e.currentTarget)}>
                  <Ico n="mas" t={16} />
                </button>
                <Desplegable
                  etiqueta="Modo"
                  valor={modoCaja}
                  onCambio={setModoCaja}
                  ancho={300}
                  opciones={[
                    { valor: 'plan', texto: 'Plan', etiqueta: 'Predeterminado', sub: 'Revisa el esquema antes de crear', icono: 'lista' },
                    { valor: 'express', texto: 'Express', sub: 'Más rápido, sin revisar el esquema', icono: 'rayo' },
                  ]}
                />
                <button type="submit" className="gp-caja-enviar" aria-label="Enviar" disabled={!caja.trim()}>
                  <Ico n="flecha-arriba" t={16} />
                </button>
              </div>
            </form>
          </section>
        )}

        <div className="gp-cabeza">
          <h2 className="gp-cabeza-titulo">
            {vista.startsWith('carpeta:') && <Ico n="carpeta-abierta" t={20} />}
            {tituloVista}
          </h2>
          {esDeLandings && vista !== 'papelera' && (
            <div className="gp-acciones">
              <Link href="/landing-generator/crear" className="gp-btn gp-btn-primario"><Ico n="mas" t={14} /> Crear nuevo <span className="gp-insignia-ia">IA</span></Link>
              <button type="button" className="gp-btn gp-btn-contorno" disabled={creando} onClick={nuevoDesdeCero}><Ico n="mas" t={14} /> Nuevo desde cero</button>
              <button type="button" className="gp-btn gp-btn-contorno" aria-haspopup="menu" onClick={(e) => setMenuImportar(menuImportar ? null : e.currentTarget)}>
                <Ico n="descargar" t={14} /> Importar <Ico n="chevron-abajo" t={12} />
              </button>
            </div>
          )}
        </div>

        {esDeLandings && !errorLista && (
          <div className="gp-herramientas">
            <span className="gp-cuenta">{visibles.length === 1 ? '1 landing' : `${visibles.length} landings`}</span>
            {vista !== 'recientes' && (
              <>
                <span className="gp-herr-rotulo">Ordenar por</span>
                <Desplegable etiqueta="Ordenar por" valor={prefs.orden} opciones={ORDENES} onCambio={(v) => cambiarPrefs({ orden: v })} alinear="derecha" />
                <button type="button" className="gp-icono-btn" aria-label={prefs.asc ? 'Orden ascendente' : 'Orden descendente'} onClick={() => cambiarPrefs({ asc: !prefs.asc })}>
                  <Ico n={prefs.asc ? 'flecha-arriba' : 'flecha-abajo'} t={14} />
                </button>
              </>
            )}
            <div className="gp-segmento" role="group" aria-label="Vista">
              <button type="button" aria-pressed={!prefs.lista} onClick={() => cambiarPrefs({ lista: false })}><Ico n="columnas-3" t={14} /> Cuadrícula</button>
              <button type="button" aria-pressed={prefs.lista} onClick={() => cambiarPrefs({ lista: true })}><Ico n="lista" t={14} /> Lista</button>
            </div>
          </div>
        )}

        {contenido}
      </div>

      {/* ── Menús ── */}
      {menuDoc && md && (
        <MenuFlotante ancla={menuDoc.ancla} onCerrar={cerrarMenuDoc} alinear="derecha">
          <ItemMenu icono="flecha-externa" texto="Abrir" onClick={() => { setMenuDoc(null); abrir(md); }} />
          <ItemMenu icono="duplicar" texto="Duplicar" onClick={() => { setMenuDoc(null); void duplicar(md); }} />
          <ItemMenu icono="lapiz" texto="Cambiar nombre" onClick={() => { setMenuDoc(null); setDialogo({ tipo: 'renombrar', doc: md }); }} />
          <ItemMenu icono="carpeta" texto="Mover a carpeta…" onClick={() => { setMenuDoc(null); setDialogo({ tipo: 'carpeta', doc: md }); }} />
          <ItemMenu icono={md.favorito ? 'estrella-llena' : 'estrella'} texto={md.favorito ? 'Quitar de favoritos' : 'Añadir a favoritos'} onClick={() => { setMenuDoc(null); void favorito(md); }} />
          {esPublicada(md) && <ItemMenu icono="enlace" texto="Copiar enlace público" onClick={() => { setMenuDoc(null); void copiarEnlace(md); }} />}
          <SeparadorMenu />
          <ItemMenu peligro texto="Enviar a la papelera" onClick={() => { setMenuDoc(null); void aPapelera(md); }} />
        </MenuFlotante>
      )}
      {menuImportar && (
        <MenuFlotante ancla={menuImportar} onCerrar={cerrarImportar} ancho={280}>
          <ItemMenu icono="subir" texto="Importar archivo o URL" sub="PowerPoint, Word, PDF o una página web" onClick={() => { setMenuImportar(null); router.push('/landing-generator/crear?paso=importar'); }} />
          <ItemMenu icono="historial" texto="Del generador anterior" sub="Tus borradores del Landing Generator" onClick={() => { setMenuImportar(null); setDialogo({ tipo: 'borradores' }); }} />
        </MenuFlotante>
      )}
      {menuMas && (
        <MenuFlotante ancla={menuMas} onCerrar={cerrarMas} ancho={260}>
          <ItemMenu icono="subir" texto="Subir archivos" onClick={() => { setMenuMas(null); router.push('/landing-generator/crear?paso=importar'); }} />
          <ItemMenu icono="plantillas" texto="Agregar una plantilla" onClick={() => { setMenuMas(null); irVista('plantillas'); }} />
          <ItemMenu icono="enlace" texto="Importar desde URL" onClick={() => { setMenuMas(null); router.push('/landing-generator/crear?paso=importar'); }} />
        </MenuFlotante>
      )}
      {menuCarpetas && (
        <MenuFlotante ancla={menuCarpetas} onCerrar={cerrarCarpetas} ancho={240}>
          {carpetas.map((c) => <ItemMenu key={c} icono="carpeta" texto={c} activo={vista === `carpeta:${c}`} onClick={() => irVista(`carpeta:${c}`)} />)}
        </MenuFlotante>
      )}

      {/* ── Diálogos ── */}
      {dialogo?.tipo === 'renombrar' && (
        <DialogoRenombrar doc={dialogo.doc} onCerrar={cerrarDialogo} onListo={(titulo) => { actualizar(dialogo.doc.id, { titulo }); avisar('Nombre cambiado'); }} />
      )}
      {dialogo?.tipo === 'carpeta' && (
        <DialogoCarpeta
          doc={dialogo.doc}
          carpetas={carpetas}
          onCerrar={cerrarDialogo}
          onListo={(carpeta) => { actualizar(dialogo.doc.id, { carpeta }); avisar(carpeta ? 'Movida a la carpeta' : 'Quitada de la carpeta'); }}
        />
      )}
      {dialogo?.tipo === 'eliminar' && (
        <DialogoEliminar doc={dialogo.doc} onCerrar={cerrarDialogo} onListo={() => { setLista((l) => l.filter((x) => x.id !== dialogo.doc.id)); avisar('Landing eliminada'); }} />
      )}
      {dialogo?.tipo === 'nuevaCarpeta' && (
        <DialogoNuevaCarpeta
          existentes={carpetas}
          onCerrar={cerrarDialogo}
          onListo={(nombre) => {
            const n = [...carpetasLocales.filter((c) => c !== nombre), nombre];
            setCarpetasLocales(n);
            guardarLocal(CLAVE_CARPETAS, n);
            irVista(`carpeta:${nombre}`);
          }}
        />
      )}
      {dialogo?.tipo === 'borradores' && <DialogoBorradores onCerrar={cerrarDialogo} ws={ws} ahora={ahora} />}
      {dialogo?.tipo === 'plantilla' && (
        <DialogoGamma
          titulo={dialogo.plantilla.nombre}
          ancho={720}
          onCerrar={cerrarDialogo}
          cerrable={!creando}
          pie={(
            <>
              <button type="button" className="gp-btn gp-btn-contorno" disabled={creando} onClick={cerrarDialogo}>Cancelar</button>
              <button type="button" className="gp-btn gp-btn-primario" data-foco disabled={creando} onClick={() => usarPlantilla(dialogo.plantilla)}>
                {creando ? <span className="gp-giro" /> : null} Usar plantilla
              </button>
            </>
          )}
        >
          <VistaPlantilla plantilla={dialogo.plantilla} />
        </DialogoGamma>
      )}
      {dialogo?.tipo === 'tema' && (
        <DialogoGamma
          titulo="Vista previa del tema"
          ancho={560}
          onCerrar={cerrarDialogo}
          cerrable={!creando}
          pie={(
            <>
              <button type="button" className="gp-btn gp-btn-contorno" disabled={creando} onClick={cerrarDialogo}>Cancelar</button>
              <button type="button" className="gp-btn gp-btn-primario" data-foco disabled={creando} onClick={() => usarTema(dialogo.tema)}>
                {creando ? <span className="gp-giro" /> : null} Usar tema
              </button>
            </>
          )}
        >
          <div className="gp-vista-tema">
            <MuestraTema tema={dialogo.tema} grande />
            <strong>{dialogo.tema.nombre}</strong>
            <span>Se crea una landing en blanco con este tema.</span>
          </div>
        </DialogoGamma>
      )}

      {aviso}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Galerías
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plantillas: chips por categoría y una tarjeta por plantilla con la miniatura de su primera
 * sección. `contenido()` arma ids NUEVOS en cada llamada, así que las muestras se arman
 * después de montar (si no, el HTML del server y el del navegador no coincidirían).
 */
function GaleriaPlantillas({ q, onVer }: { q: string; onVer: (p: Plantilla) => void }) {
  const [categoria, setCategoria] = useState<'todo' | CategoriaPlantilla>('todo');
  const [muestras, setMuestras] = useState<Record<string, JsonNodo | null> | null>(null);
  useEffect(() => {
    setMuestras(Object.fromEntries(PLANTILLAS.map((p) => {
      const pagina = p.contenido().paginas[0];
      return [p.id, pagina ? tarjetasDe(pagina)[0] ?? null : null];
    })));
  }, []);
  const n = normalizar(q);
  const lista = PLANTILLAS.filter((p) => (categoria === 'todo' || p.categoria === categoria) && (!n || normalizar(`${p.nombre} ${p.descripcion}`).includes(n)));
  const opciones = useMemo(() => [{ valor: 'todo' as const, texto: 'Todo' }, ...CATEGORIAS_PLANTILLA.map((c) => ({ valor: c, texto: c }))], []);
  return (
    <div className="gp-galeria">
      <Filtros valor={categoria} opciones={opciones} onCambio={setCategoria} etiqueta="Categoría" />
      {lista.length ? (
        <div className="gp-grilla">
          {lista.map((p) => (
            <button key={p.id} type="button" className="gp-card gp-card-plantilla" onClick={() => onVer(p)}>
              <div className="gp-card-mini">
                {muestras ? <MiniaturaLanding tarjeta={muestras[p.id] ?? null} tema={temaPorId(p.tema)} /> : <div className="gp-mini gp-brillo" style={{ aspectRatio: '16 / 10' }} />}
                <span className="gp-card-usar">Usar plantilla</span>
              </div>
              <div className="gp-card-info">
                <div className="gp-card-titulo">{p.nombre}</div>
                <div className="gp-card-meta"><span>{p.descripcion}</span></div>
              </div>
            </button>
          ))}
        </div>
      ) : <p className="gp-vacio">No se encontraron resultados</p>}
    </div>
  );
}

/** La vista previa de una plantilla: todas sus secciones, página por página. */
function VistaPlantilla({ plantilla }: { plantilla: Plantilla }) {
  const contenido = useMemo(() => plantilla.contenido(), [plantilla]);
  const tema = temaPorId(plantilla.tema);
  return (
    <div className="gp-vista-plantilla">
      <p className="gp-vista-plantilla-desc">{plantilla.descripcion}</p>
      {contenido.paginas.map((p) => (
        <section key={p.id} className="gp-vista-pagina">
          {contenido.paginas.length > 1 && <h3 className="gp-bloque-titulo">{p.titulo}</h3>}
          {tarjetasDe(p).map((t, i) => (
            <div key={i} className="gp-vista-seccion"><MiniaturaLanding tarjeta={t} tema={tema} entera /></div>
          ))}
        </section>
      ))}
    </div>
  );
}

type FiltroTema = 'todo' | 'claro' | 'oscuro' | 'profesional' | 'colorido';

/** Temas: «Estándar | Personalizado» como en Gamma, con sus chips, y la vista previa al tocar. */
function GaleriaTemas({ q, propios, errorTemas, onVer }: { q: string; propios: readonly TemaPropio[]; errorTemas: string | null; onVer: (t: Tema) => void }) {
  const [grupo, setGrupo] = useState<'estandar' | 'personalizado'>('estandar');
  const [filtro, setFiltro] = useState<FiltroTema>('todo');
  const temasPropios = useMemo(
    () => propios.map((p) => temaPorId('ws:' + p.id, propios)).filter((t) => t.id.startsWith('ws:')),
    [propios],
  );
  const n = normalizar(q);
  const base = grupo === 'personalizado' ? temasPropios : TEMAS;
  const lista = base.filter((t) =>
    (filtro === 'todo' || (filtro === 'claro' || filtro === 'oscuro' ? t.grupo === filtro : t.etiquetas.includes(filtro)))
    && (!n || normalizar(t.nombre).includes(n)));
  return (
    <div className="gp-galeria">
      <div className="gp-galeria-fila">
        <div className="gp-segmento" role="group" aria-label="Grupo de temas">
          <button type="button" aria-pressed={grupo === 'personalizado'} onClick={() => setGrupo('personalizado')}>Personalizado</button>
          <button type="button" aria-pressed={grupo === 'estandar'} onClick={() => setGrupo('estandar')}>Estándar</button>
        </div>
        <Filtros
          valor={filtro}
          onCambio={setFiltro}
          etiqueta="Filtrar temas"
          opciones={[
            { valor: 'todo', texto: 'Todo' }, { valor: 'oscuro', texto: 'Oscuro' }, { valor: 'claro', texto: 'Claro' },
            { valor: 'profesional', texto: 'Profesional' }, { valor: 'colorido', texto: 'Colorido' },
          ]}
        />
      </div>
      {grupo === 'personalizado' && errorTemas && <div className="gp-error" role="alert">No se pudieron leer tus temas.</div>}
      {lista.length ? (
        <div className="gp-tema-grilla">
          {lista.map((t) => <TileTema key={t.id} tema={t} etiqueta="Vista previa" onClick={() => onVer(t)} />)}
        </div>
      ) : (
        <p className="gp-vacio">{grupo === 'personalizado' && !temasPropios.length && !errorTemas ? 'Aún no tienes temas propios. Se crean desde el editor.' : 'No se encontraron resultados'}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diálogos
// ─────────────────────────────────────────────────────────────────────────────

function DialogoRenombrar({ doc, onCerrar, onListo }: { doc: LandingResumen; onCerrar: () => void; onListo: (titulo: string) => void }) {
  const [titulo, setTitulo] = useState(doc.titulo);
  const [enVuelo, setEnVuelo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    const t = titulo.replace(/\s+/g, ' ').trim();
    if (!t || t === doc.titulo) { onCerrar(); return; }
    setEnVuelo(true);
    const r = await pedirDocs({ accion: 'renombrar', id: doc.id, titulo: t });
    setEnVuelo(false);
    if (!r.ok) { setError(r.error); return; }
    onListo(r.titulo);
    onCerrar();
  };
  return (
    <DialogoGamma
      titulo="Cambiar nombre"
      onCerrar={onCerrar}
      cerrable={!enVuelo}
      pie={(
        <>
          <button type="button" className="gp-btn gp-btn-contorno" disabled={enVuelo} onClick={onCerrar}>Cancelar</button>
          <button type="button" className="gp-btn gp-btn-primario" disabled={enVuelo || !titulo.trim()} onClick={() => void guardar()}>Guardar</button>
        </>
      )}
    >
      <form onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
        <input data-foco className="gp-campo" value={titulo} maxLength={200} aria-label="Nombre" onChange={(e) => setTitulo(e.target.value)} />
      </form>
      {error && <div className="gp-error" role="alert">{error}</div>}
    </DialogoGamma>
  );
}

function DialogoCarpeta({ doc, carpetas, onCerrar, onListo }: { doc: LandingResumen; carpetas: readonly string[]; onCerrar: () => void; onListo: (c: string | null) => void }) {
  const [elegida, setElegida] = useState<string | null>(doc.carpeta);
  const [nueva, setNueva] = useState('');
  const [enVuelo, setEnVuelo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mover = async (carpeta: string | null) => {
    setEnVuelo(true);
    const r = await pedirDocs({ accion: 'carpeta', id: doc.id, carpeta });
    setEnVuelo(false);
    if (!r.ok) { setError(r.error); return; }
    onListo(r.carpeta);
    onCerrar();
  };
  const destino = nueva.replace(/\s+/g, ' ').trim().slice(0, 80) || elegida;
  return (
    <DialogoGamma
      titulo="Mover a carpeta"
      onCerrar={onCerrar}
      cerrable={!enVuelo}
      pie={(
        <>
          {doc.carpeta && <button type="button" className="gp-btn gp-btn-fantasma" disabled={enVuelo} onClick={() => void mover(null)}>Quitar de la carpeta</button>}
          <button type="button" className="gp-btn gp-btn-contorno" disabled={enVuelo} onClick={onCerrar}>Cancelar</button>
          <button type="button" className="gp-btn gp-btn-primario" disabled={enVuelo || !destino || destino === doc.carpeta} onClick={() => void mover(destino)}>Mover</button>
        </>
      )}
    >
      {carpetas.length > 0 && (
        <div className="gp-opciones-carpeta" role="radiogroup" aria-label="Carpetas">
          {carpetas.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={!nueva.trim() && elegida === c} className="gp-opcion-carpeta" onClick={() => { setElegida(c); setNueva(''); }}>
              <Ico n="carpeta" t={15} /> {c}
            </button>
          ))}
        </div>
      )}
      <label className="gp-campo-etiquetado">
        <span className="gp-etiqueta">Nueva carpeta</span>
        <input data-foco className="gp-campo" value={nueva} maxLength={80} placeholder="Nombre de la carpeta" onChange={(e) => setNueva(e.target.value)} />
      </label>
      {error && <div className="gp-error" role="alert">{error}</div>}
    </DialogoGamma>
  );
}

function DialogoEliminar({ doc, onCerrar, onListo }: { doc: LandingResumen; onCerrar: () => void; onListo: () => void }) {
  const [enVuelo, setEnVuelo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eliminar = async () => {
    setEnVuelo(true);
    const r = await pedirDocs({ accion: 'borrar', id: doc.id });
    setEnVuelo(false);
    if (!r.ok) { setError(r.error); return; }
    onListo();
    onCerrar();
  };
  return (
    <DialogoGamma
      titulo="¿Eliminar de forma permanente?"
      onCerrar={onCerrar}
      cerrable={!enVuelo}
      pie={(
        <>
          <button type="button" className="gp-btn gp-btn-contorno" data-foco disabled={enVuelo} onClick={onCerrar}>Cancelar</button>
          <button type="button" className="gp-btn gp-btn-peligro" disabled={enVuelo} onClick={() => void eliminar()}>Eliminar</button>
        </>
      )}
    >
      <p className="gp-dialogo-texto">«{doc.titulo || 'Sin título'}» se elimina con su historial. Esta acción no se puede deshacer.</p>
      {error && <div className="gp-error" role="alert">{error}</div>}
    </DialogoGamma>
  );
}

function DialogoNuevaCarpeta({ existentes, onCerrar, onListo }: { existentes: readonly string[]; onCerrar: () => void; onListo: (nombre: string) => void }) {
  const [nombre, setNombre] = useState('');
  const limpio = nombre.replace(/\s+/g, ' ').trim().slice(0, 80);
  const repetida = existentes.some((c) => normalizar(c) === normalizar(limpio));
  const crear = () => { if (!limpio || repetida) return; onListo(limpio); onCerrar(); };
  return (
    <DialogoGamma
      titulo="Crear una carpeta"
      onCerrar={onCerrar}
      pie={(
        <>
          <button type="button" className="gp-btn gp-btn-contorno" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="gp-btn gp-btn-primario" disabled={!limpio || repetida} onClick={crear}>Crear carpeta</button>
        </>
      )}
    >
      <form onSubmit={(e) => { e.preventDefault(); crear(); }}>
        <input data-foco className="gp-campo" value={nombre} maxLength={80} placeholder="Nombre de la carpeta" aria-label="Nombre de la carpeta" onChange={(e) => setNombre(e.target.value)} />
      </form>
      {repetida && <div className="gp-error">Ya existe esa carpeta.</div>}
    </DialogoGamma>
  );
}

/** «Del generador anterior»: los borradores de landing_drafts, convertidos al abrirlos. */
function DialogoBorradores({ onCerrar, ws, ahora }: { onCerrar: () => void; ws: number | null; ahora: number }) {
  const [borradores, setBorradores] = useState<BorradorViejo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    const r = await pedirDocs({ accion: 'borradoresViejos' });
    if (!r.ok) { setError(r.error); return; }
    setBorradores(r.borradores);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const importar = async (b: BorradorViejo) => {
    setImportando(b.id);
    setError(null);
    const r = await pedirDocs({ accion: 'importarBorrador', draftId: b.id }, 60_000);
    if (!r.ok) { setImportando(null); setError(r.error); return; }
    marcarReciente(r.doc.id);
    irDuro(`/landing-generator/${r.doc.id}`, ws);
  };

  return (
    <DialogoGamma titulo="Del generador anterior" ancho={600} onCerrar={onCerrar} cerrable={importando === null}>
      {error && (
        <div className="gp-error" role="alert">
          <span>{error}</span>
          {!borradores && <button type="button" className="gp-btn gp-btn-contorno" onClick={() => { setError(null); void cargar(); }}>Reintentar</button>}
        </div>
      )}
      {!borradores && !error && <div className="gp-esperando-centro"><span className="gp-giro" /></div>}
      {borradores && !borradores.length && <p className="gp-vacio">No hay borradores del generador anterior.</p>}
      {borradores && borradores.length > 0 && (
        <ul className="gp-borradores">
          {borradores.map((b) => (
            <li key={b.id}>
              <button type="button" className="gp-borrador" disabled={importando !== null} onClick={() => void importar(b)}>
                <span className="gp-borrador-textos">
                  <span className="gp-borrador-titulo">{b.titulo}</span>
                  <span className="gp-borrador-sub">{b.pedido.slice(0, 110) || 'Sin pedido'} · {haceCuanto(b.creado, ahora)}</span>
                </span>
                {importando === b.id ? <span className="gp-giro" /> : <Ico n="chevron-derecha" t={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </DialogoGamma>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// La hoja del Panel (gamma-tokens §9-§10: sidebar ~232px, ítem activo azul claro radio 8)
// ─────────────────────────────────────────────────────────────────────────────

const CSS_PANEL = `
.gp.gp-panel { display: grid; grid-template-columns: 232px minmax(0, 1fr); min-height: 100vh; background: var(--gp-fondo); }
.gp .gp-lateral { position: sticky; top: 0; align-self: start; display: flex; flex-direction: column; gap: 4px; height: 100vh; padding: 14px 10px; background: var(--gp-superficie); border-right: 1px solid var(--gp-borde-suave); }
.gp .gp-ir-a { display: flex; align-items: center; gap: 8px; height: 34px; margin-bottom: 8px; padding: 0 10px; border-radius: 8px; background: var(--gp-fondo); color: var(--gp-debil); }
.gp .gp-ir-a input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--gp-texto); font: inherit; font-size: 13.5px; outline: none; }
.gp .gp-ir-a input::placeholder { color: var(--gp-debil); }
.gp .gp-ir-a kbd { font: inherit; font-size: 11px; color: var(--gp-debil); }
.gp .gp-nav { display: flex; flex-direction: column; gap: 1px; }
.gp .gp-nav-item { display: flex; align-items: center; gap: 10px; height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: var(--gp-texto); font-size: 14px; font-weight: 500; text-align: left; cursor: pointer; }
.gp .gp-nav-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp .gp-nav-item:hover { background: var(--gp-hover); }
.gp .gp-nav-item[aria-current="page"] { background: var(--gp-activo-fondo); color: var(--gp-activo-texto); }
.gp .gp-nav-mas { color: var(--gp-tenue); }
.gp .gp-nav-seccion { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding: 0 2px 0 10px; color: var(--gp-tenue); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.gp .gp-nav-seccion .gp-icono-btn { width: 26px; height: 26px; }
.gp .gp-nav-abajo { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--gp-borde-suave); }

.gp .gp-contenido { min-width: 0; padding: 24px 32px 48px; }
.gp .gp-home { display: flex; flex-direction: column; align-items: center; gap: 16px; margin: 8px auto 28px; max-width: 720px; }
.gp .gp-home-titulo { margin: 0; text-align: center; font-size: 34px; font-weight: 600; letter-spacing: -0.02em; color: var(--gp-titulo); }
.gp .gp-caja { width: 100%; border-radius: 14px; background: var(--gp-superficie); box-shadow: 0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -2px rgba(0,0,0,.04); border: 1px solid var(--gp-borde-suave); }
.gp .gp-caja:focus-within { border-color: var(--gp-azul-300); }
.gp .gp-caja-entrada { display: block; width: 100%; min-height: 64px; padding: 16px 18px 6px; border: 0; background: transparent; color: var(--gp-texto); font: inherit; font-size: 16px; line-height: 1.5; resize: none; outline: none; }
.gp .gp-caja-entrada::placeholder { color: var(--gp-debil); }
.gp .gp-caja-fila { display: flex; align-items: center; gap: 8px; padding: 8px 10px 10px; }
.gp .gp-caja-mas { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 9999px; background: var(--gp-azul-50); color: var(--gp-azul-600); cursor: pointer; }
[data-tema="oscuro"] .gp .gp-caja-mas { background: #0b2e79; color: #aad5fe; }
.gp .gp-caja-enviar { display: grid; place-items: center; width: 34px; height: 34px; margin-left: auto; border: 0; border-radius: 9999px; background: var(--gp-azul-500); color: #fff; cursor: pointer; }
.gp .gp-caja-enviar:disabled { background: var(--gp-borde); cursor: not-allowed; }

.gp .gp-cabeza { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.gp .gp-cabeza-titulo { display: inline-flex; align-items: center; gap: 8px; margin: 0; font-size: 22px; font-weight: 600; color: var(--gp-titulo); }
.gp .gp-acciones { display: flex; flex-wrap: wrap; gap: 8px; }
.gp .gp-acciones a.gp-btn { text-decoration: none; }
.gp .gp-herramientas { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; color: var(--gp-tenue); font-size: 13px; }
.gp .gp-cuenta { margin-right: auto; }
.gp .gp-segmento { display: inline-flex; gap: 2px; padding: 2px; border-radius: 9999px; background: var(--gp-borde-suave); }
.gp .gp-segmento button { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px; border: 0; border-radius: 9999px; background: transparent; color: var(--gp-texto); font-size: 13px; font-weight: 500; cursor: pointer; }
.gp .gp-segmento button[aria-pressed="true"] { background: var(--gp-superficie); color: var(--gp-activo-texto); box-shadow: var(--gp-sombra-tarjeta); }

/* Grilla y lista. */
.gp .gp-grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
.gp .gp-card { position: relative; display: flex; flex-direction: column; min-width: 0; padding: 0; border: 0; border-radius: 12px; background: transparent; text-align: left; color: inherit; font: inherit; }
.gp button.gp-card { cursor: pointer; }
.gp .gp-card-enlace { display: flex; flex-direction: column; color: inherit; text-decoration: none; }
.gp .gp-card-mini { position: relative; border-radius: 10px; box-shadow: 0 0 0 1px var(--gp-borde-suave), var(--gp-sombra-tarjeta); transition: box-shadow .15s, transform .15s; }
.gp .gp-card:hover .gp-card-mini { box-shadow: 0 0 0 2px var(--gp-azul-300), 0 4px 6px -1px rgba(0,0,0,.1); }
.gp .gp-card-mini .gp-mini { border-radius: 10px; }
.gp .gp-card-info { display: flex; flex-direction: column; gap: 4px; padding: 10px 40px 0 2px; }
.gp .gp-card-titulo { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 15px; font-weight: 600; color: var(--gp-titulo); line-height: 1.3; }
.gp .gp-card-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 12.5px; color: var(--gp-tenue); }
.gp .gp-card-meta > span + span:not(.gp-chip)::before { content: "·"; margin-right: 8px; color: var(--gp-debil); }
.gp .gp-chip-publicada { background: #e2f7e1; color: #266d28; }
[data-tema="oscuro"] .gp .gp-chip-publicada { background: #1a561c; color: #c4eec4; }
.gp .gp-card-fav { position: absolute; top: 8px; right: 8px; display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 9999px; background: rgba(255,255,255,.92); color: #66666b; box-shadow: var(--gp-sombra-tarjeta); cursor: pointer; opacity: 0; transition: opacity .15s; }
.gp .gp-card:hover .gp-card-fav, .gp .gp-card-fav:focus-visible, .gp .gp-card-fav[data-activo="si"] { opacity: 1; }
.gp .gp-card-fav[data-activo="si"] { color: var(--gp-dorado); }
@media (hover: none) { .gp .gp-card-fav { opacity: 1; } }
.gp .gp-card-mas { position: absolute; right: 0; bottom: 0; display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 9999px; background: transparent; color: var(--gp-tenue); cursor: pointer; }
.gp .gp-card-mas:hover { background: var(--gp-hover); color: var(--gp-texto); }
.gp .gp-card-papelera { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 2px 0; }
.gp .gp-btn-borrar { background: transparent; border-color: var(--gp-peligro); color: var(--gp-peligro); }
.gp .gp-btn-borrar:hover { background: var(--gp-peligro-fondo); }
.gp .gp-card-usar { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 7px 14px; border-radius: 9999px; background: var(--gp-primario); color: var(--gp-primario-texto); font-size: 13px; font-weight: 600; opacity: 0; transition: opacity .15s; pointer-events: none; }
.gp .gp-card-plantilla:hover .gp-card-usar, .gp .gp-card-plantilla:focus-visible .gp-card-usar { opacity: 1; }
.gp .gp-card-plantilla .gp-card-info { padding-right: 2px; }
.gp .gp-card-plantilla .gp-card-meta > span { -webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }

.gp .gp-lista { display: flex; flex-direction: column; gap: 2px; }
.gp .gp-lista .gp-card { flex-direction: row; align-items: center; padding: 6px 8px; border-radius: 10px; }
.gp .gp-lista .gp-card:hover { background: var(--gp-superficie); }
.gp .gp-lista .gp-card-enlace { flex-direction: row; align-items: center; gap: 14px; flex: 1; min-width: 0; }
.gp .gp-lista .gp-card-mini { width: 96px; flex: none; }
.gp .gp-lista .gp-card-info { padding: 0; flex: 1; min-width: 0; }
.gp .gp-lista .gp-card-titulo { -webkit-line-clamp: 1; }
.gp .gp-lista .gp-card-fav { position: static; opacity: 1; background: transparent; box-shadow: none; }
.gp .gp-lista .gp-card-mas { position: static; }
.gp .gp-lista .gp-card-papelera { padding: 0; }

/* Galerías y diálogos del Panel. */
.gp .gp-galeria { display: flex; flex-direction: column; gap: 16px; }
.gp .gp-galeria-fila { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.gp .gp-vista-plantilla { display: flex; flex-direction: column; gap: 14px; }
.gp .gp-vista-plantilla-desc { margin: 0; color: var(--gp-tenue); }
.gp .gp-vista-pagina { display: flex; flex-direction: column; gap: 10px; }
.gp .gp-vista-seccion { border-radius: 8px; overflow: hidden; box-shadow: 0 0 0 1px var(--gp-borde-suave); }
.gp .gp-vista-tema { display: flex; flex-direction: column; gap: 8px; }
.gp .gp-vista-tema strong { color: var(--gp-titulo); font-size: 16px; }
.gp .gp-vista-tema span { color: var(--gp-tenue); }
.gp .gp-dialogo-texto { margin: 0; }
.gp .gp-campo-etiquetado { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.gp .gp-opciones-carpeta { display: flex; flex-direction: column; gap: 2px; max-height: 240px; overflow-y: auto; }
.gp .gp-opcion-carpeta { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: var(--gp-texto); font-size: 14px; text-align: left; cursor: pointer; }
.gp .gp-opcion-carpeta:hover { background: var(--gp-hover); }
.gp .gp-opcion-carpeta[aria-checked="true"] { background: var(--gp-activo-fondo); color: var(--gp-activo-texto); }
.gp .gp-borradores { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.gp .gp-borrador { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border: 1px solid var(--gp-borde-suave); border-radius: 10px; background: var(--gp-superficie); text-align: left; cursor: pointer; color: var(--gp-tenue); }
.gp .gp-borrador:hover:not(:disabled) { border-color: var(--gp-azul-300); }
.gp .gp-borrador-textos { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.gp .gp-borrador-titulo { color: var(--gp-titulo); font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp .gp-borrador-sub { font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp .gp-esperando-centro { display: flex; justify-content: center; padding: 24px; color: var(--gp-tenue); }
.gp .gp-error-bloque { padding: 24px 0; }

/* Celular: la barra lateral pasa arriba y ENVUELVE (una barra de navegación no scrollea). */
@media (max-width: 860px) {
  .gp.gp-panel { grid-template-columns: minmax(0, 1fr); }
  .gp .gp-lateral { position: static; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px 6px; padding: 12px 16px; border-right: 0; border-bottom: 1px solid var(--gp-borde-suave); }
  .gp .gp-ir-a { width: 100%; margin-bottom: 4px; }
  .gp .gp-nav, .gp .gp-nav-abajo { flex-direction: row; flex-wrap: wrap; margin: 0; padding: 0; border: 0; }
  .gp .gp-nav-seccion { margin: 0 0 0 4px; }
  .gp .gp-contenido { padding: 18px 16px 40px; }
  .gp .gp-home-titulo { font-size: 26px; }
  .gp .gp-grilla { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
}
`;
