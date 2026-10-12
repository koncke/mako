'use client';

// =============================================================================
// Inicio — el Panel de Gamma para las landings y presentaciones de MaKo
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D9).
//
// Tanda 2 (11/10/2026, tarde), textual: «1. Aún no se ve igual... Muchos botones a la
// derecha. 2. "Diagnóstico" no debería ser otra ruta, debería abrirse ahí a la derecha.
// 3. Elimina las tab de "Recientes, creadas por mi, publicadas y favoritas". También elimina
// la tab de "landings", que en la sidebar aparezcan las landings creadas/analizadas con el
// nombre de las mismas... Y también elimina el botón de "diagnostico" de la sidebar, en su
// lugar que esté dentro de los 3 puntos que debe tener cada landing, junto a otros botones
// como renombrar, eliminar, archivar, duplicar, etc... También elimina la funcionalidad de
// "carpetas". 4. También agrega el botón de "Nueva landing" como placeholder en el primer
// puesto arriba de las demás landing.» Decisiones T1 y T2.
//
// Es la barra de DOCUMENTOS de Gamma 5 (relevo gamma-ui §3.2: la lista «Chats» con «Nuevo
// chat», «Cambiar nombre» y «Archivar»), no la de filtros de la versión clásica:
//   · arriba el «Ir a» (Ctrl K), que filtra la lista por nombre y, si lo escrito es la dirección
//     de una página («otra.com»), ofrece «Analizar otra.com»: la puerta para pegar una URL de
//     afuera sin sumar un botón (un link a /landing-generator/analizar sin landing abre, a la
//     derecha, la caja para pegarla: `AnalizarUnaPagina`);
//   · «+ Nueva landing» como primer renglón: abre la caja de crear a la derecha;
//   · un renglón por documento, POR NOMBRE, con el ícono de su tipo (landing, presentación, y
//     las landings de afuera ya analizadas, con su host como nombre: panel-reglas.ts). Clic en
//     uno nuestro abre el editor; en una de afuera, su Diagnóstico a la derecha. Cada renglón
//     tiene su «⋯»: Abrir, Diagnóstico, Cambiar nombre (ahí mismo), Duplicar, Copiar enlace
//     público, Archivar (= la Papelera, restaurable) y Eliminar (el tacho rojo, con una frase
//     de confirmación);
//   · abajo Plantillas, Temas y Papelera, que se abren a la derecha.
// La derecha es la caja «¿Qué vas a crear hoy?» (CajaCrear.tsx, del paquete de crear) y NADA
// más: se fueron la fila de botones (Crear nuevo IA, Nuevo desde cero, Importar), Ordenar por,
// Cuadrícula/Lista, las vistas Landings/Recientes/Creadas por mí/Favoritos/Publicadas y las
// Carpetas (la columna `carpeta` queda en la tabla sin uso). El Diagnóstico de una landing
// (renglón ⋯ → Diagnóstico, o `?diagnostico=` / `?analizar=` en la URL) se monta ACÁ a la
// derecha (diagnostico/PanelDiagnostico.tsx, del paquete del diagnóstico), no en otra ruta:
// /landing-generator/analizar redirige al Panel.
//
// Decisiones que no se ven en el código:
//   · La lista de documentos SCROLLEA adentro de la barra; los destinos fijos (Nueva landing,
//     Plantillas, Temas, Papelera) no. La regla de la casa «una columna de navegación no
//     scrollea» es para los DESTINOS de una barra; una lista de documentos que crece con el uso
//     es contenido (como el historial de chats de Gamma), y el scroll se ve (`scrollbar-width:
//     thin`, nunca escondido).
//   · La derecha viaja en la URL (`queryDeDerecha`, con `history.replaceState`, que no recarga
//     ni pierde el `?ws=`): el link que se copia abre lo que se está viendo.
//   · Crear algo (una plantilla, un tema) navega DURO al editor: lo que cambió es qué existe
//     (AGENTS.md). Lo demás (renombrar, duplicar, archivar, eliminar) se aplica con la
//     respuesta del server en la lista local.
//   · Eliminar desde el «⋯» pasa por la Papelera primero: el server sólo borra lo que ya está
//     ahí (la guarda en positivo de server.ts). Si el segundo paso falla, queda archivada, no
//     perdida.
//   · «Del generador anterior» (los borradores de landing_drafts) se fue con la fila de
//     botones: el diálogo vive en MiniaturaLanding.tsx para que lo abra el «+» de la caja.
//   · Lo que NO se copia de Gamma 5: los chats del agente, «Compartido contigo», «Medios»,
//     «Inspiración», «Fuentes personalizadas» y el «Archivado» aparte de la Papelera (acá
//     archivar ES la papelera).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link, { useRouter, useWs } from '@/app/_ui/Link';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { TEMAS, temaPorId, type Tema } from '@/lib/editor-landing/temas';
import type { Plantilla } from '@/lib/editor-landing/plantillas';
import { CATEGORIAS_PRESENTACION, PLANTILLAS_PRESENTACION, type PlantillaPresentacion } from '@/lib/editor-landing/plantillas-presentaciones';
import { tarjetasDe, urlPublica, type JsonNodo, type LandingContenido } from '@/lib/editor-landing/doc';
import type { LandingResumen, PedidoDocs, TemaPropio } from '@/lib/editor-landing/api-tipos';
import {
  ICONO_TIPO, NOMBRE_TIPO, TIPOS_CREAR, pedidoDeDiseno, pedidoDePlantilla, plantillasDe, type PlantillaCrear, type TipoCrear,
} from './crear/tipo';
import { DialogoObjetivo } from './crear/DialogoObjetivo';
import CajaCrear from './CajaCrear';
import PanelDiagnostico from './diagnostico/PanelDiagnostico';
import { normalizarUrl } from '@/lib/landing-url';
import {
  CSS_GP, DialogoGamma, Filtros, Ico, ItemMenu, MenuFlotante, MiniaturaLanding, MuestraTema, SeparadorMenu, TileTema,
  URL_FUENTE_CHROME, haceCuanto, irDuro, pedirDocs, useAviso,
} from './MiniaturaLanding';
import {
  ICONO_FILA, SIN_TITULO, docDeUrl, enPapelera, esDiagnosticoDe, filasDelPanel, filtrarFilas, hostDe, normalizarTexto,
  queryDeDerecha, urlDeBusqueda, urlParaAnalizar, type Analizada, type Derecha, type FilaPanel, type TipoFila,
} from './panel-reglas';

// ─────────────────────────────────────────────────────────────────────────────
// El Panel
// ─────────────────────────────────────────────────────────────────────────────

export type PropsInicio = {
  docs: LandingResumen[];
  errorLista: string | null;
  /** Las landings de afuera ya analizadas (`listarAnalizadas`); las nuestras se cruzan en panel-reglas. */
  analizadas: Analizada[];
  errorAnalizadas: string | null;
  propios: TemaPropio[];
  errorTemas: string | null;
  /** APP_BASE_URL: «Copiar enlace público» y el cruce de las analizadas que son nuestras. */
  base: string;
  /** Date.now() del server: el primer render del navegador usa el mismo (hidratación). */
  ahora: number;
  /** Lo que pide la URL para la derecha (`derechaDeQuery`, en la página). */
  derechaInicial: Derecha;
};

type PlantillaGaleria = Plantilla | PlantillaPresentacion;

type Dialogo =
  | { tipo: 'eliminarDoc'; doc: LandingResumen }
  | { tipo: 'eliminarAnalizada'; url: string; nombre: string }
  | { tipo: 'plantilla'; plantilla: PlantillaGaleria }
  /** Un DISEÑO de landing: pregunta el objetivo (el copy) y crea. */
  | { tipo: 'diseno'; plantilla: PlantillaCrear }
  | { tipo: 'tema'; tema: Tema };

/** Lo que oye un lector de pantalla del ícono de cada renglón. */
const TEXTO_TIPO: Record<TipoFila, string> = { landing: 'Landing', presentacion: 'Presentación', analizada: 'Página analizada' };

/** Plazo del DELETE de un análisis (el mismo de los pedidos de documentos, cliente.ts). */
const PLAZO_QUITAR_MS = 65_000;

export function Inicio(props: PropsInicio) {
  const router = useRouter();
  const ws = useWs();
  const { avisar, nodo: aviso } = useAviso();

  const [lista, setLista] = useState<LandingResumen[]>(props.docs);
  const [errorLista, setErrorLista] = useState(props.errorLista);
  const [analizadas, setAnalizadas] = useState<Analizada[]>(props.analizadas);
  const [derecha, setDerecha] = useState<Derecha>(props.derechaInicial);
  const [q, setQ] = useState('');
  const [ahora, setAhora] = useState(props.ahora);
  const [menu, setMenu] = useState<{ fila: FilaPanel; ancla: HTMLElement } | null>(null);
  const [renombrando, setRenombrandoEstado] = useState<{ id: number; texto: string } | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [creando, setCreando] = useState(false);
  const busqueda = useRef<HTMLInputElement>(null);
  const contenidoRef = useRef<HTMLDivElement>(null);
  const campoNombre = useRef<HTMLInputElement>(null);
  // El renombre en curso también en un ref: Enter guarda y desmonta el campo, y un blur que
  // llegara después no tiene que mandar el mismo pedido otra vez.
  const renombrandoRef = useRef<{ id: number; texto: string } | null>(null);
  const setRenombrando = (r: { id: number; texto: string } | null) => { renombrandoRef.current = r; setRenombrandoEstado(r); };

  // El reloj de «Editada hace…» (Papelera) se mueve solo después de montar.
  useEffect(() => {
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

  // La derecha viaja en la URL (sin recargar: history.replaceState conserva el ?ws=).
  useEffect(() => {
    const s = queryDeDerecha(window.location.search, derecha);
    if (s !== window.location.search) window.history.replaceState(null, '', window.location.pathname + s + window.location.hash);
  }, [derecha]);

  // El campo de «Cambiar nombre» toma el foco con el texto elegido, como en Gamma.
  const idRenombrando = renombrando?.id ?? null;
  useEffect(() => {
    if (idRenombrando === null) return;
    campoNombre.current?.focus();
    campoNombre.current?.select();
  }, [idRenombrando]);

  const cerrarMenu = useCallback(() => setMenu(null), []);
  const cerrarDialogo = useCallback(() => setDialogo(null), []);
  const cerrarDiagnostico = useCallback(() => setDerecha({ tipo: 'crear' }), []);
  // Una página de afuera recién analizada entra a la barra sin recargar (integración de la tanda 2).
  // Se compara normalizada: es la misma llave que la de landing_analyses, y no se duplica el renglón.
  const sumarAnalizada = useCallback((url: string) => {
    const clave = (u: string) => { try { return normalizarUrl(u); } catch { return u; } };
    setAnalizadas((l) => (l.some((a) => clave(a.url) === clave(url)) ? l : [{ url, veredicto: null, score: null }, ...l]));
  }, []);

  const temaDe = useCallback((id: string) => temaPorId(id, props.propios), [props.propios]);
  const filas = useMemo(() => filtrarFilas(filasDelPanel(lista, analizadas, props.base), q), [lista, analizadas, props.base, q]);
  const urlBuscada = useMemo(() => urlDeBusqueda(q), [q]);

  // ── Acciones ─────────────────────────────────────────────────────────────

  const actualizar = (id: number, cambio: Partial<LandingResumen>) => setLista((l) => l.map((d) => (d.id === id ? { ...d, ...cambio } : d)));

  /** Si la derecha mostraba el diagnóstico de lo que se fue, vuelve a la caja. */
  const soltarDiagnosticoDe = (f: FilaPanel) => setDerecha((d) => (esDiagnosticoDe(d, f) ? { tipo: 'crear' } : d));
  const filaDeDoc = (doc: LandingResumen): FilaPanel => ({ tipo: doc.formato === 'presentacion' ? 'presentacion' : 'landing', clave: `d:${doc.id}`, nombre: doc.titulo, doc });

  /** «+ Nueva landing»: la caja de crear a la derecha, con el foco adentro. */
  const nuevaLanding = () => {
    setDerecha({ tipo: 'crear' });
    window.requestAnimationFrame(() => contenidoRef.current?.querySelector<HTMLElement>('textarea, [contenteditable="true"]')?.focus());
  };

  const abrirDiagnostico = (f: FilaPanel) =>
    setDerecha(f.tipo === 'analizada' ? { tipo: 'diagnostico', url: f.url } : { tipo: 'diagnostico', docId: f.doc.id });

  /** Analizar una página por su dirección (el «Ir a» o la caja del Diagnóstico vacío): si es nuestra, su documento. */
  const analizarUrl = (url: string) => {
    const propia = docDeUrl(url, lista, props.base);
    setDerecha(propia ? { tipo: 'diagnostico', docId: propia } : { tipo: 'diagnostico', url });
    setQ('');
  };

  const guardarNombre = async () => {
    const r0 = renombrandoRef.current;
    setRenombrando(null);
    if (!r0) return;
    const doc = lista.find((d) => d.id === r0.id);
    if (!doc) return;
    const t = r0.texto.replace(/\s+/g, ' ').trim();
    if (!t || t === doc.titulo) return;
    actualizar(doc.id, { titulo: t });
    const r = await pedirDocs({ accion: 'renombrar', id: doc.id, titulo: t });
    if (!r.ok) { actualizar(doc.id, { titulo: doc.titulo }); avisar('No se pudo renombrar'); console.error('[panel] renombrar', r.error); return; }
    actualizar(doc.id, { titulo: r.titulo });
  };

  const duplicar = async (d: LandingResumen) => {
    const r = await pedirDocs({ accion: 'duplicar', id: d.id });
    if (!r.ok) { avisar('No se pudo duplicar'); console.error('[panel] duplicar', r.error); return; }
    setLista((l) => [r.doc, ...l]);
    avisar('Duplicada');
  };

  const restaurar = async (d: LandingResumen) => {
    const r = await pedirDocs({ accion: 'restaurar', id: d.id });
    if (!r.ok) { avisar('No se pudo restaurar'); console.error('[panel] restaurar', r.error); return; }
    actualizar(d.id, { papelera: false });
    avisar('Restaurada');
  };

  const archivar = async (d: LandingResumen) => {
    const r = await pedirDocs({ accion: 'papelera', id: d.id });
    if (!r.ok) { avisar('No se pudo archivar'); console.error('[panel] papelera', r.error); return; }
    actualizar(d.id, { papelera: true });
    soltarDiagnosticoDe(filaDeDoc(d));
    // Deshacer devuelve la MISMA landing (restaurar), no una copia.
    avisar('Archivada', () => void restaurar(d));
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

  /**
   * Eliminar para siempre. El server sólo borra lo que ya está en la Papelera, así que desde el
   * «⋯» pasa por ahí primero; si el borrado falla, la landing queda archivada (no perdida).
   */
  const eliminarDoc = async (d: LandingResumen): Promise<string | null> => {
    if (!d.papelera) {
      const p = await pedirDocs({ accion: 'papelera', id: d.id });
      if (!p.ok) { console.error('[panel] papelera', p.error); return 'No se pudo eliminar.'; }
      actualizar(d.id, { papelera: true });
    }
    const r = await pedirDocs({ accion: 'borrar', id: d.id });
    if (!r.ok) { console.error('[panel] borrar', r.error); return d.papelera ? 'No se pudo eliminar.' : 'No se pudo eliminar: quedó en la Papelera.'; }
    setLista((l) => l.filter((x) => x.id !== d.id));
    soltarDiagnosticoDe(filaDeDoc(d));
    avisar('Eliminada');
    return null;
  };

  /** Quitar una landing de afuera: borra su diagnóstico (no el seguimiento del Pixel). */
  const eliminarAnalizada = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/landing-analyst/view?url=${encodeURIComponent(url)}`, { method: 'DELETE', signal: AbortSignal.timeout(PLAZO_QUITAR_MS) });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) { console.error('[panel] quitar análisis', res.status, j?.error); return 'No se pudo eliminar.'; }
    } catch (e) {
      console.error('[panel] quitar análisis', e);
      return 'No se pudo eliminar.';
    }
    setAnalizadas((l) => l.filter((a) => a.url !== url));
    setDerecha((d) => (d.tipo === 'diagnostico' && d.url === url ? { tipo: 'crear' } : d));
    avisar('Eliminada');
    return null;
  };

  /** Crear algo nuevo y abrirlo: lo que cambió es QUÉ EXISTE, así que la navegación es dura. */
  const crearYAbrir = async (pedido: Extract<PedidoDocs, { accion: 'crear' }>) => {
    if (creando) return;
    setCreando(true);
    const r = await pedirDocs(pedido);
    if (!r.ok) { setCreando(false); avisar('No se pudo crear'); console.error('[panel] crear', r.error); return; }
    irDuro(`/landing-generator/${r.doc.id}`, ws);
  };

  // El config del alta de una plantilla sale de `pedidoDePlantilla` (crear/tipo.ts): una
  // presentación creada sin su formato nacería como página.
  const usarPlantilla = (p: PlantillaGaleria) => void crearYAbrir(pedidoDePlantilla(p));
  const usarDiseno = (p: PlantillaCrear, objetivo: string) => {
    const alta = pedidoDeDiseno(p, objetivo);
    if (!alta) { avisar('No se pudo crear'); return; }
    void crearYAbrir(alta);
  };
  const usarTema = (t: Tema) => void crearYAbrir({ accion: 'crear', config: { tema: t.id, formato: 'pagina', origen: { modo: 'cero' } } });

  const recargarLista = async () => {
    const r = await pedirDocs({ accion: 'listar' });
    if (!r.ok) { setErrorLista(r.error); return; }
    setErrorLista(null);
    setLista(r.docs);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const itemNav = (tipo: 'plantillas' | 'temas' | 'papelera', texto: string, icono: string) => (
    <button key={tipo} type="button" className="gp-nav-item" aria-current={derecha.tipo === tipo ? 'page' : undefined} onClick={() => setDerecha({ tipo })}>
      <Ico n={icono} t={16} />
      <span>{texto}</span>
    </button>
  );

  const renglon = (f: FilaPanel) => {
    if (f.tipo !== 'analizada' && renombrando?.id === f.doc.id) {
      return (
        <li key={f.clave} className="gp-doc" data-renombrando="si">
          <Ico n={ICONO_FILA[f.tipo]} t={16} />
          <input
            ref={campoNombre}
            className="gp-doc-input"
            value={renombrando.texto}
            maxLength={200}
            aria-label="Nombre"
            onChange={(e) => setRenombrando({ id: f.doc.id, texto: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void guardarNombre(); }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setRenombrando(null); }
            }}
            onBlur={() => void guardarNombre()}
          />
        </li>
      );
    }
    const activo = esDiagnosticoDe(derecha, f);
    const abierto = menu?.fila.clave === f.clave;
    const icono = <Ico n={ICONO_FILA[f.tipo]} t={16} />;
    const nombre = <span className="gp-doc-nombre">{f.nombre}</span>;
    return (
      <li key={f.clave} className="gp-doc" data-activo={activo ? 'si' : undefined} data-menu={abierto ? 'si' : undefined}>
        {f.tipo === 'analizada' ? (
          <button type="button" className="gp-doc-abrir" title={f.url} aria-label={`${TEXTO_TIPO[f.tipo]}: ${f.nombre}`} aria-current={activo ? 'true' : undefined} onClick={() => abrirDiagnostico(f)}>
            {icono}{nombre}
          </button>
        ) : (
          <Link href={`/landing-generator/${f.doc.id}`} className="gp-doc-abrir" title={f.nombre} aria-label={`${TEXTO_TIPO[f.tipo]}: ${f.nombre}`} aria-current={activo ? 'true' : undefined}>
            {icono}{nombre}
          </Link>
        )}
        <button
          type="button"
          className="gp-doc-mas"
          aria-label={`Más opciones de ${f.nombre}`}
          aria-haspopup="menu"
          aria-expanded={abierto}
          onClick={(e) => setMenu(abierto ? null : { fila: f, ancla: e.currentTarget })}
        >
          <Ico n="puntos" t={16} />
        </button>
      </li>
    );
  };

  const tarjetaPapelera = (d: LandingResumen) => (
    <article key={d.id} className="gp-card">
      <div className="gp-card-mini"><MiniaturaLanding tarjeta={d.primera} tema={temaDe(d.tema)} formato={d.formato} proporcion={d.proporcion} /></div>
      <div className="gp-card-info">
        <div className="gp-card-titulo">{d.titulo.trim() || SIN_TITULO}</div>
        <div className="gp-card-meta"><span>Editada {haceCuanto(d.actualizado, ahora)}</span></div>
      </div>
      <div className="gp-card-papelera">
        <button type="button" className="gp-btn gp-btn-contorno" onClick={() => void restaurar(d)}><Ico n="deshacer" t={14} /> Restaurar</button>
        <button type="button" className="gp-btn gp-btn-borrar" onClick={() => setDialogo({ tipo: 'eliminarDoc', doc: d })}><IconoBorrar size={14} /> Eliminar para siempre</button>
      </div>
    </article>
  );

  const errorBloque = (
    <div className="gp-error gp-error-bloque" role="alert">
      <span>No se pudieron cargar las landings.</span>
      <button type="button" className="gp-btn gp-btn-contorno" onClick={() => void recargarLista()}>Reintentar</button>
    </div>
  );

  let contenido: ReactNode;
  if (derecha.tipo === 'diagnostico' && !derecha.docId && !derecha.url) {
    // El Diagnóstico sin ninguna landing (un link a /landing-generator/analizar, el onboarding):
    // la caja para pegar la dirección de una página.
    contenido = <AnalizarUnaPagina onAnalizar={analizarUrl} />;
  } else if (derecha.tipo === 'diagnostico') {
    // El `key` con la landing: cambiar de renglón remonta el panel (un useState sembrado de props
    // no se resiembra, AGENTS.md).
    contenido = <PanelDiagnostico key={`${derecha.docId ?? ''}|${derecha.url ?? ''}`} docId={derecha.docId} url={derecha.url} onCerrar={cerrarDiagnostico} onAnalizada={sumarAnalizada} />;
  } else if (derecha.tipo === 'plantillas') {
    contenido = <><h1 className="gp-cabeza-titulo">Plantillas</h1><GaleriaPlantillas onVer={(p) => setDialogo({ tipo: 'plantilla', plantilla: p })} onDiseno={(p) => setDialogo({ tipo: 'diseno', plantilla: p })} /></>;
  } else if (derecha.tipo === 'temas') {
    contenido = <><h1 className="gp-cabeza-titulo">Temas</h1><GaleriaTemas propios={props.propios} errorTemas={props.errorTemas} onVer={(t) => setDialogo({ tipo: 'tema', tema: t })} /></>;
  } else if (derecha.tipo === 'papelera') {
    const archivadas = enPapelera(lista);
    contenido = (
      <>
        <h1 className="gp-cabeza-titulo">Papelera</h1>
        {errorLista ? errorBloque : archivadas.length ? <div className="gp-grilla">{archivadas.map(tarjetaPapelera)}</div> : <p className="gp-vacio">La papelera está vacía.</p>}
      </>
    );
  } else {
    contenido = <CajaCrear />;
  }

  const mf = menu?.fila;

  return (
    <div className="gma gp gp-panel">
      <style dangerouslySetInnerHTML={{ __html: CSS_GP + CSS_PANEL }} />
      <link rel="stylesheet" href={URL_FUENTE_CHROME} />

      <aside className="gp-lateral" aria-label="Landing Generator">
        <label className="gp-ir-a">
          <Ico n="buscar" t={14} />
          <input ref={busqueda} type="search" value={q} placeholder="Ir a" aria-label="Buscar por nombre" onChange={(e) => setQ(e.target.value)} />
          <kbd>Ctrl K</kbd>
        </label>
        <button type="button" className="gp-doc-nuevo" aria-current={derecha.tipo === 'crear' ? 'page' : undefined} onClick={nuevaLanding}>
          <span className="gp-doc-nuevo-mas"><Ico n="mas" t={13} /></span>
          <span>Nueva landing</span>
        </button>
        <ul className="gp-docs" aria-label="Tus landings">
          {errorLista && (
            <li className="gp-docs-aviso" role="alert">
              <span>No se pudieron cargar las landings.</span>
              <button type="button" className="gp-btn gp-btn-contorno" onClick={() => void recargarLista()}>Reintentar</button>
            </li>
          )}
          {props.errorAnalizadas && <li className="gp-docs-aviso" role="alert"><span>No se pudieron leer las páginas analizadas.</span></li>}
          {urlBuscada && (
            <li className="gp-doc">
              <button type="button" className="gp-doc-abrir" title={urlBuscada} onClick={() => analizarUrl(urlBuscada)}>
                <Ico n="reporte" t={16} /><span className="gp-doc-nombre">Analizar {hostDe(urlBuscada)}</span>
              </button>
            </li>
          )}
          {filas.map(renglon)}
          {normalizarTexto(q) && !filas.length && !urlBuscada && <li className="gp-docs-vacio">No se encontraron resultados</li>}
        </ul>
        <nav className="gp-nav gp-nav-abajo" aria-label="Biblioteca">
          {itemNav('plantillas', 'Plantillas', 'plantillas')}
          {itemNav('temas', 'Temas', 'paleta')}
          {itemNav('papelera', 'Papelera', 'papelera')}
        </nav>
      </aside>

      {/* Un <div> y no un <main>: el <main> de la pantalla es el de `Pagina` (AGENTS.md). */}
      <div ref={contenidoRef} className="gp-contenido" data-vista={derecha.tipo}>
        {contenido}
      </div>

      {/* ── El «⋯» de un renglón ── */}
      {menu && mf && (
        <MenuFlotante ancla={menu.ancla} onCerrar={cerrarMenu}>
          {mf.tipo === 'analizada' ? (
            <>
              <ItemMenu icono="reporte" texto="Diagnóstico" onClick={() => { setMenu(null); abrirDiagnostico(mf); }} />
              <ItemMenu icono="flecha-externa" texto="Abrir la página" onClick={() => { setMenu(null); window.open(mf.url, '_blank', 'noopener,noreferrer'); }} />
              <SeparadorMenu />
              <ItemMenu peligro texto="Eliminar" onClick={() => { setMenu(null); setDialogo({ tipo: 'eliminarAnalizada', url: mf.url, nombre: mf.nombre }); }} />
            </>
          ) : (
            <>
              <ItemMenu icono="flecha-externa" texto="Abrir" onClick={() => { setMenu(null); router.push(`/landing-generator/${mf.doc.id}`); }} />
              <ItemMenu icono="reporte" texto="Diagnóstico" onClick={() => { setMenu(null); abrirDiagnostico(mf); }} />
              <ItemMenu icono="lapiz" texto="Cambiar nombre" onClick={() => { setMenu(null); setRenombrando({ id: mf.doc.id, texto: mf.doc.titulo }); }} />
              <ItemMenu icono="duplicar" texto="Duplicar" onClick={() => { setMenu(null); void duplicar(mf.doc); }} />
              {!!mf.doc.slug && !!mf.doc.publicadoAt && (
                <ItemMenu icono="enlace" texto="Copiar enlace público" onClick={() => { setMenu(null); void copiarEnlace(mf.doc); }} />
              )}
              <SeparadorMenu />
              <ItemMenu icono="archivo" texto="Archivar" onClick={() => { setMenu(null); void archivar(mf.doc); }} />
              <ItemMenu peligro texto="Eliminar" onClick={() => { setMenu(null); setDialogo({ tipo: 'eliminarDoc', doc: mf.doc }); }} />
            </>
          )}
        </MenuFlotante>
      )}

      {/* ── Diálogos ── */}
      {dialogo?.tipo === 'eliminarDoc' && (
        <DialogoEliminar
          frase={`Se elimina «${dialogo.doc.titulo.trim() || SIN_TITULO}» con su historial y no se puede deshacer.`}
          onCerrar={cerrarDialogo}
          onConfirmar={() => eliminarDoc(dialogo.doc)}
        />
      )}
      {dialogo?.tipo === 'eliminarAnalizada' && (
        <DialogoEliminar
          frase={`Se borra el diagnóstico de ${dialogo.nombre} y no se puede deshacer.`}
          onCerrar={cerrarDialogo}
          onConfirmar={() => eliminarAnalizada(dialogo.url)}
        />
      )}
      {dialogo?.tipo === 'plantilla' && (
        <DialogoGamma
          titulo={dialogo.plantilla.nombre}
          ancho={720}
          onCerrar={cerrarDialogo}
          cerrable={!creando}
          pie={(
            <button type="button" className="gp-btn gp-btn-primario" data-foco disabled={creando} onClick={() => usarPlantilla(dialogo.plantilla)}>
              {creando ? <span className="gp-giro" /> : null} Usar plantilla
            </button>
          )}
        >
          <VistaPlantilla plantilla={dialogo.plantilla} />
        </DialogoGamma>
      )}
      {dialogo?.tipo === 'diseno' && (
        <DialogoObjetivo ocupado={creando} onElegir={(o) => usarDiseno(dialogo.plantilla, o)} onCerrar={cerrarDialogo} />
      )}
      {dialogo?.tipo === 'tema' && (
        <DialogoGamma
          titulo="Vista previa del tema"
          ancho={560}
          onCerrar={cerrarDialogo}
          cerrable={!creando}
          pie={(
            <button type="button" className="gp-btn gp-btn-primario" data-foco disabled={creando} onClick={() => usarTema(dialogo.tema)}>
              {creando ? <span className="gp-giro" /> : null} Usar tema
            </button>
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

const esDePresentacion = (p: PlantillaGaleria): p is PlantillaPresentacion => 'formato' in p && p.formato === 'presentacion';

/**
 * Plantillas: «Landing | Presentación» (las pastillas de crear) y una tarjeta por plantilla con la
 * miniatura de su primera sección (o diapositiva, con su forma). En una landing son DISEÑOS (el
 * copy se elige después, en «¿De qué quieres crearla?»: feedback de Martín, 12/10/2026); en una
 * presentación, plantillas con chips por categoría y su vista previa.
 * `contenido()` arma ids NUEVOS en cada llamada, así que las muestras se arman después de
 * montar (si no, el HTML del server y el del navegador no coincidirían).
 */
function GaleriaPlantillas({ onVer, onDiseno }: { onVer: (p: PlantillaGaleria) => void; onDiseno: (p: PlantillaCrear) => void }) {
  const [tipo, setTipo] = useState<TipoCrear>('landing');
  const [categoria, setCategoria] = useState<string>('todo');
  const [muestras, setMuestras] = useState<Record<string, JsonNodo | null> | null>(null);
  useEffect(() => {
    const primera = (p: { contenido: () => LandingContenido }): JsonNodo | null => {
      const pagina = p.contenido().paginas[0];
      return pagina ? tarjetasDe(pagina)[0] ?? null : null;
    };
    setMuestras(Object.fromEntries([
      ...plantillasDe('landing').map((p) => [`landing:${p.id}`, primera(p)] as const),
      ...PLANTILLAS_PRESENTACION.map((p) => [`presentacion:${p.id}`, primera(p)] as const),
    ]));
  }, []);
  const disenos = useMemo(() => plantillasDe('landing'), []);
  const lista: readonly (PlantillaGaleria | PlantillaCrear)[] = tipo === 'presentacion'
    ? PLANTILLAS_PRESENTACION.filter((p) => categoria === 'todo' || p.categoria === categoria)
    : disenos;
  const opciones = useMemo(
    () => [{ valor: 'todo', texto: 'Todo' }, ...CATEGORIAS_PRESENTACION.map((c) => ({ valor: c as string, texto: c as string }))],
    [],
  );
  return (
    <div className="gp-galeria">
      <div className="gp-galeria-fila">
        <div className="gp-segmento" role="group" aria-label="Tipo de plantilla">
          {TIPOS_CREAR.map((t) => (
            <button key={t} type="button" aria-pressed={tipo === t} onClick={() => { setTipo(t); setCategoria('todo'); }}>
              <Ico n={ICONO_TIPO[t]} t={14} /> {NOMBRE_TIPO[t]}
            </button>
          ))}
        </div>
        {tipo === 'presentacion' && <Filtros valor={categoria} opciones={opciones} onCambio={setCategoria} etiqueta="Categoría" />}
      </div>
      {lista.length ? (
        <div className="gp-grilla">
          {lista.map((p) => {
            const pres = 'formato' in p && p.formato === 'presentacion';
            const diseno = 'pideObjetivo' in p && !!p.pideObjetivo;
            return (
              <button key={p.id} type="button" className="gp-card gp-card-plantilla" onClick={() => (diseno ? onDiseno(p as PlantillaCrear) : onVer(p as PlantillaGaleria))}>
                <div className="gp-card-mini">
                  {muestras ? (
                    <MiniaturaLanding
                      tarjeta={muestras[`${tipo}:${p.id}`] ?? null}
                      tema={temaPorId(p.tema)}
                      formato={pres ? 'presentacion' : 'pagina'}
                      proporcion={pres ? (p as PlantillaPresentacion).proporcion : undefined}
                    />
                  ) : <div className="gp-mini gp-brillo" style={{ aspectRatio: pres ? '16 / 9' : '16 / 10' }} />}
                  <span className="gp-card-usar">{diseno ? 'Usar diseño' : 'Usar plantilla'}</span>
                </div>
                <div className="gp-card-info">
                  <div className="gp-card-titulo">{p.nombre}</div>
                  <div className="gp-card-meta"><span>{p.descripcion}</span></div>
                </div>
              </button>
            );
          })}
        </div>
      ) : <p className="gp-vacio">No se encontraron resultados</p>}
    </div>
  );
}

/** La vista previa de una plantilla: todas sus secciones (o diapositivas), página por página. */
function VistaPlantilla({ plantilla }: { plantilla: PlantillaGaleria }) {
  const contenido = useMemo(() => plantilla.contenido(), [plantilla]);
  const tema = temaPorId(plantilla.tema);
  const pres = esDePresentacion(plantilla);
  return (
    <div className="gp-vista-plantilla">
      <p className="gp-vista-plantilla-desc">{plantilla.descripcion}</p>
      {contenido.paginas.map((p) => (
        <section key={p.id} className="gp-vista-pagina">
          {contenido.paginas.length > 1 && <h3 className="gp-bloque-titulo">{p.titulo}</h3>}
          {tarjetasDe(p).map((t, i) => (
            <div key={i} className="gp-vista-seccion">
              {pres
                ? <MiniaturaLanding tarjeta={t} tema={tema} formato="presentacion" proporcion={plantilla.proporcion} />
                : <MiniaturaLanding tarjeta={t} tema={tema} entera />}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

type FiltroTema = 'todo' | 'claro' | 'oscuro' | 'profesional' | 'colorido';

/** Temas: «Estándar | Personalizado» como en Gamma, con sus chips, y la vista previa al tocar. */
function GaleriaTemas({ propios, errorTemas, onVer }: { propios: readonly TemaPropio[]; errorTemas: string | null; onVer: (t: Tema) => void }) {
  const [grupo, setGrupo] = useState<'estandar' | 'personalizado'>('estandar');
  const [filtro, setFiltro] = useState<FiltroTema>('todo');
  const temasPropios = useMemo(
    () => propios.map((p) => temaPorId('ws:' + p.id, propios)).filter((t) => t.id.startsWith('ws:')),
    [propios],
  );
  const base = grupo === 'personalizado' ? temasPropios : TEMAS;
  const lista = base.filter((t) => filtro === 'todo' || (filtro === 'claro' || filtro === 'oscuro' ? t.grupo === filtro : t.etiquetas.includes(filtro)));
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
// El Diagnóstico sin landing: pegar la dirección de una página
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que abre un link a /landing-generator/analizar sin ninguna landing (el onboarding de
 * 'landing-an', «Analizar una página» de Crear): la dirección, y el Diagnóstico de esa página a la
 * derecha (PanelDiagnostico analiza solo lo que todavía no tiene comentarios guardados).
 */
function AnalizarUnaPagina({ onAnalizar }: { onAnalizar: (url: string) => void }) {
  const [texto, setTexto] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { campo.current?.focus(); }, []);
  const url = urlParaAnalizar(texto);
  return (
    <section className="gp-analizar" aria-label="Diagnóstico">
      <h1 className="gp-cabeza-titulo">Diagnóstico</h1>
      <p className="gp-analizar-sub">Pega la dirección de una landing.</p>
      <form className="gp-analizar-fila" onSubmit={(e) => { e.preventDefault(); if (url) onAnalizar(url); }}>
        <input
          ref={campo}
          className="gp-campo"
          inputMode="url"
          autoComplete="url"
          value={texto}
          maxLength={2_000}
          placeholder="https://tu-landing.com"
          aria-label="Dirección de la página"
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="gp-btn gp-btn-primario" data-tam="lg" disabled={!url}><Ico n="reporte" t={14} /> Analizar</button>
      </form>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diálogo de eliminar (una frase con la consecuencia, pegada al botón del tacho rojo)
// ─────────────────────────────────────────────────────────────────────────────

function DialogoEliminar({ frase, onCerrar, onConfirmar }: { frase: string; onCerrar: () => void; onConfirmar: () => Promise<string | null> }) {
  const [enVuelo, setEnVuelo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eliminar = async () => {
    setEnVuelo(true);
    setError(null);
    const e = await onConfirmar();
    setEnVuelo(false);
    if (e) { setError(e); return; }
    onCerrar();
  };
  return (
    <DialogoGamma
      titulo="¿Eliminar de forma permanente?"
      onCerrar={onCerrar}
      cerrable={!enVuelo}
      pie={(
        <>
          <button type="button" className="gp-btn gp-btn-contorno" data-foco disabled={enVuelo} onClick={onCerrar}>No eliminar</button>
          <button type="button" className="gp-btn gp-btn-borrar" disabled={enVuelo} onClick={() => void eliminar()}>
            {enVuelo ? <span className="gp-giro" /> : <IconoBorrar size={14} />} Eliminar
          </button>
        </>
      )}
    >
      <p className="gp-dialogo-texto">{frase}</p>
      {error && <div className="gp-error" role="alert">{error}</div>}
    </DialogoGamma>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// La hoja del Panel (gamma-tokens §9-§10: barra ~232px, renglón activo azul claro radio 8)
// ─────────────────────────────────────────────────────────────────────────────

const CSS_PANEL = `
.gp.gp-panel { display: grid; grid-template-columns: 248px minmax(0, 1fr); min-height: 100vh; background: var(--gp-fondo); }
.gp .gp-lateral { position: sticky; top: 0; align-self: start; display: flex; flex-direction: column; gap: 2px; height: 100vh; padding: 14px 10px 10px; background: var(--gp-superficie); border-right: 1px solid var(--gp-borde-suave); }
.gp .gp-ir-a { display: flex; align-items: center; gap: 8px; flex: none; height: 34px; margin-bottom: 8px; padding: 0 10px; border-radius: 8px; background: var(--gp-fondo); color: var(--gp-debil); }
.gp .gp-ir-a input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--gp-texto); font: inherit; font-size: 13.5px; outline: none; }
.gp .gp-ir-a input::placeholder { color: var(--gp-debil); }
.gp .gp-ir-a kbd { font: inherit; font-size: 11px; color: var(--gp-debil); }

/* «+ Nueva landing»: el primer renglón, con cara de lugar vacío. */
.gp .gp-doc-nuevo { display: flex; align-items: center; gap: 10px; flex: none; width: 100%; height: 34px; padding: 0 10px 0 7px; border: 0; border-radius: 8px; background: transparent; color: var(--gp-tenue); font-size: 14px; font-weight: 500; text-align: left; cursor: pointer; }
.gp .gp-doc-nuevo:hover { background: var(--gp-hover); color: var(--gp-texto); }
.gp .gp-doc-nuevo[aria-current="page"] { background: var(--gp-activo-fondo); color: var(--gp-activo-texto); }
.gp .gp-doc-nuevo-mas { display: grid; place-items: center; width: 22px; height: 22px; border: 1px dashed currentColor; border-radius: 6px; }

/* La lista de documentos: scrollea ELLA (contenido), los destinos fijos no (ver la cabecera). */
.gp .gp-docs { list-style: none; display: flex; flex-direction: column; gap: 1px; flex: 1 1 auto; min-height: 0; margin: 2px 0 0; padding: 0 0 6px; overflow-y: auto; scrollbar-width: thin; }
.gp .gp-doc { position: relative; display: flex; align-items: center; min-height: 32px; border-radius: 8px; color: var(--gp-texto); }
.gp .gp-doc:hover, .gp .gp-doc[data-menu="si"] { background: var(--gp-hover); }
.gp .gp-doc[data-activo="si"] { background: var(--gp-activo-fondo); color: var(--gp-activo-texto); }
.gp .gp-doc-abrir { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; height: 32px; padding: 0 4px 0 10px; border: 0; border-radius: 8px; background: transparent; color: inherit; font-size: 14px; font-weight: 500; text-align: left; text-decoration: none; cursor: pointer; }
.gp .gp-doc-abrir .gp-ico { color: var(--gp-tenue); }
.gp .gp-doc[data-activo="si"] .gp-doc-abrir .gp-ico { color: inherit; }
.gp .gp-doc-nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp .gp-doc-mas { display: grid; place-items: center; flex: none; width: 28px; height: 28px; margin-right: 2px; border: 0; border-radius: 6px; background: transparent; color: var(--gp-tenue); cursor: pointer; opacity: 0; }
.gp .gp-doc:hover .gp-doc-mas, .gp .gp-doc:focus-within .gp-doc-mas, .gp .gp-doc[data-menu="si"] .gp-doc-mas, .gp .gp-doc[data-activo="si"] .gp-doc-mas { opacity: 1; }
.gp .gp-doc-mas:hover { background: var(--gp-borde-suave); color: var(--gp-texto); }
@media (hover: none) { .gp .gp-doc-mas { opacity: 1; } }
.gp .gp-doc[data-renombrando="si"] { gap: 10px; padding-left: 10px; color: var(--gp-tenue); }
.gp .gp-doc-input { flex: 1; min-width: 0; height: 28px; margin-right: 2px; padding: 0 8px; border: 1px solid var(--gp-azul-500); border-radius: 6px; background: var(--gp-superficie); color: var(--gp-texto); font: inherit; font-size: 14px; outline: none; box-shadow: 0 0 0 3px rgba(44,136,247,.18); }
.gp .gp-docs-aviso { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 6px 10px; color: var(--gp-peligro); font-size: 13px; font-weight: 500; }
.gp .gp-docs-aviso .gp-btn { height: 28px; }
.gp .gp-docs-vacio { padding: 8px 10px; color: var(--gp-tenue); font-size: 13px; }

.gp .gp-nav { display: flex; flex-direction: column; gap: 1px; }
.gp .gp-nav-item { display: flex; align-items: center; gap: 10px; height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: var(--gp-texto); font-size: 14px; font-weight: 500; text-align: left; cursor: pointer; }
.gp .gp-nav-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp .gp-nav-item:hover { background: var(--gp-hover); }
.gp .gp-nav-item[aria-current="page"] { background: var(--gp-activo-fondo); color: var(--gp-activo-texto); }
.gp .gp-nav-abajo { flex: none; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--gp-borde-suave); }

/* La derecha. */
.gp .gp-contenido { min-width: 0; padding: 24px 32px 48px; }
.gp .gp-contenido[data-vista="crear"] { padding-top: 56px; }
.gp .gp-contenido[data-vista="diagnostico"] { padding: 0; }
.gp .gp-cabeza-titulo { margin: 0 0 16px; font-size: 22px; font-weight: 600; color: var(--gp-titulo); }
.gp .gp-analizar { max-width: 640px; margin: 40px auto 0; }
.gp .gp-analizar .gp-cabeza-titulo { margin-bottom: 4px; }
.gp .gp-analizar-sub { margin: 0 0 16px; color: var(--gp-tenue); font-size: 14px; }
.gp .gp-analizar-fila { display: flex; gap: 8px; }
.gp .gp-analizar-fila .gp-campo { flex: 1; min-width: 0; }
.gp .gp-contenido[data-vista="diagnostico"] > .gp-analizar { padding: 0 16px; }
.gp .gp-segmento { display: inline-flex; gap: 2px; padding: 2px; border-radius: 9999px; background: var(--gp-borde-suave); }
.gp .gp-segmento button { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px; border: 0; border-radius: 9999px; background: transparent; color: var(--gp-texto); font-size: 13px; font-weight: 500; cursor: pointer; }
.gp .gp-segmento button[aria-pressed="true"] { background: var(--gp-superficie); color: var(--gp-activo-texto); box-shadow: var(--gp-sombra-tarjeta); }

/* Tarjetas (Papelera y Plantillas). */
.gp .gp-grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
.gp .gp-card { position: relative; display: flex; flex-direction: column; min-width: 0; padding: 0; border: 0; border-radius: 12px; background: transparent; text-align: left; color: inherit; font: inherit; }
.gp button.gp-card { cursor: pointer; }
.gp .gp-card-mini { position: relative; border-radius: 10px; box-shadow: 0 0 0 1px var(--gp-borde-suave), var(--gp-sombra-tarjeta); transition: box-shadow .15s; }
.gp button.gp-card:hover .gp-card-mini { box-shadow: 0 0 0 2px var(--gp-azul-300), 0 4px 6px -1px rgba(0,0,0,.1); }
.gp .gp-card-mini .gp-mini { border-radius: 10px; }
.gp .gp-card-info { display: flex; flex-direction: column; gap: 4px; padding: 10px 2px 0; }
.gp .gp-card-titulo { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 15px; font-weight: 600; color: var(--gp-titulo); line-height: 1.3; }
.gp .gp-card-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 12.5px; color: var(--gp-tenue); }
.gp .gp-card-papelera { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 2px 0; }
.gp .gp-btn-borrar { background: transparent; border-color: var(--gp-peligro); color: var(--gp-peligro); }
.gp .gp-btn-borrar:hover:not(:disabled) { background: var(--gp-peligro-fondo); }
.gp .gp-card-usar { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 7px 14px; border-radius: 9999px; background: var(--gp-primario); color: var(--gp-primario-texto); font-size: 13px; font-weight: 600; opacity: 0; transition: opacity .15s; pointer-events: none; }
.gp .gp-card-plantilla:hover .gp-card-usar, .gp .gp-card-plantilla:focus-visible .gp-card-usar { opacity: 1; }
.gp .gp-card-plantilla .gp-card-meta > span { -webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }

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
.gp .gp-error-bloque { padding: 24px 0; }

/* Celular: la barra pasa arriba; su lista de documentos tiene tope y scrollea ella. */
@media (max-width: 860px) {
  .gp.gp-panel { grid-template-columns: minmax(0, 1fr); }
  .gp .gp-lateral { position: static; height: auto; padding: 12px 16px; border-right: 0; border-bottom: 1px solid var(--gp-borde-suave); }
  .gp .gp-docs { flex: none; max-height: 40vh; }
  .gp .gp-nav-abajo { flex-direction: row; flex-wrap: wrap; margin-top: 6px; }
  .gp .gp-contenido { padding: 18px 16px 40px; }
  .gp .gp-contenido[data-vista="crear"] { padding-top: 24px; }
  .gp .gp-contenido[data-vista="diagnostico"] { padding: 0; }
  .gp .gp-grilla { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
}
`;
