'use client';

// =============================================================================
// EditorGuion — una página del Copywriter, copiada de Notion: ícono, título, propiedades y el cuerpo por bloques
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D2, D3, D11). De la página de Notion (notion.com/product/docs, la captura del
// editor): arriba las migas y el estado del guardado; el ícono grande; el título enorme; las PROPIEDADES en renglones
// (nombre gris a la izquierda, valor a la derecha): Tipo y, en los tipos con método (anuncios, reels, stories, YouTube,
// VSL), Ángulo, Estructura y Duración; una línea; y el cuerpo. El cuerpo es BlockNote (./CuerpoNotion.tsx, 29/10/2026):
// el «/», el asa ⋮⋮ para arrastrar, la barra de la selección y Tab para anidar, como Notion.
//
// ESTE COMPONENTE ES EL DUEÑO DEL DOCUMENTO ABIERTO. Las decisiones que no se ven, con el molde del Web Generator
// (app/web-generator/editor/EditorLanding.tsx):
//   1. EL AUTOGUARDADO es concurrencia optimista: cada guardado manda la `version` que tiene y el server contesta 409 si
//      otra pestaña guardó en el medio; la pantalla lo dice con «Recargar», nunca pisa. Los guardados van EN FILA (una
//      promesa encadenada): dos en paralelo mandarían la misma versión y el segundo daría un conflicto falso. Respiro de
//      1,2 s; al ocultarse la pestaña o al cerrar el guion se manda lo pendiente (con `keepalive` si entra).
//   2. NO SE GUARDA LO QUE NO SE PUDO ABRIR: el documento guardado pasa a los bloques de BlockNote por un conversor que
//      no tira texto (lib/copywriter/notion-bloques.ts, probado ida y vuelta); lo que el editor no conoce se abre como
//      párrafo con su texto, nunca como un documento vacío que el autoguardado escribiría encima.
//   3. EL TÍTULO Y EL ÍCONO SON DE LA PÁGINA (el árbol), no del documento: van por `onTitulo`/`onEmoji` al armazón, que
//      los guarda en el índice. Las propiedades y el cuerpo, acá.
//   4. CON UNA PROPUESTA DE MaKo ABIERTA (`pausa`), el autoguardado no escribe y el editor no se toca: lo que se ve es
//      la propuesta, todavía no el guion (docs/diseno-copywriter.md, D5). Al soltarla, lo pendiente sale.
//   5. COMPARTIDO PARA EDITAR (`compartido`, D9: /compartido/<token>): el MISMO editor, con el guardar que le pasa la
//      página del link (nunca /api/copywriter: quien abre el link puede tener SU sesión). Sin MaKo, sin la Papelera, sin
//      el ícono y con las propiedades a la vista pero sin cambiar (son del método). La barra se ve también angosta.
//   6. «ÚLTIMA EDICIÓN» (D9): la marca de quién guardó, como la propiedad de Notion. Si fue alguien con un link, el
//      dueño la ve resaltada.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { plantillaPorId, restosDelEjemplo } from '@/lib/copywriter/plantillas';
import { INFO_TIPO, SIN_TITULO, TIPOS_GUION, tieneMetodo, type GuionAbierto, type JsonNodo, type PaginaCopy, type PropsGuion, type TipoGuion } from '@/lib/copywriter/tipos';
import { docDeEstructura, sinTexto, textoDelDoc } from '@/lib/copywriter/doc';
import { rutaDe } from '@/lib/copywriter/arbol';
import { estructurasDelTipo, type CatalogosCopy } from '@/lib/copywriter/catalogos';
import { quienYCuando } from '@/lib/copywriter/editado';
import { pedirGuardar, pedirOriginal, type GuardarGuion } from '../cliente';
import { ROTULO_TEXTO, rotuloDeFormato, type OutlierCopy } from '@/lib/copywriter/outliers';
import dynamic from 'next/dynamic';
import { useCerrarAfuera } from './cerrar-afuera';
import { useRouter } from '@/app/_ui/Link';
import { llevarAlCalendario } from '@/app/calendario/publicar-desde-crear';
import { rutaUsarEnAnuncio } from '@/lib/anuncio-desde-pieza';
import type { DocVivo } from './propuesta';

// BlockNote es sólo del navegador (usa el DOM al crearse): en Next se carga sin SSR, como pide su documentación. El
// renglón de espera ocupa el alto de un párrafo para que la página no salte al llegar.
const CuerpoNotion = dynamic(() => import('./CuerpoNotion').then((m) => m.CuerpoNotion), {
  ssr: false, loading: () => <div className="nt-bn-cargando" aria-busy="true" style={{ minHeight: 30 }} />,
});

type EstadoGuardado = 'guardado' | 'pendiente' | 'guardando' | 'error' | 'conflicto' | 'roto';

const RESPIRO_MS = 1_200;

/** Los íconos que ofrece la página (Notion abre su selector entero; acá, los de un guion). */
export const EMOJIS_PAGINA = ['📄', '📣', '🎬', '📱', '▶️', '🎥', '✉️', '📝', '✍️', '🔥', '🎯', '💡', '📌', '🧲', '🤝', '📖', '🎓', '🌉', '😩', '🚀'] as const;

const TEXTO_ESTADO: Record<EstadoGuardado, string> = {
  guardado: 'Guardado',
  pendiente: 'Editando…',
  guardando: 'Guardando…',
  error: 'No se pudo guardar',
  conflicto: 'Cambió en otro lado',
  roto: 'No se pudo abrir',
};

export type PropsEditorGuion = {
  guion: GuionAbierto;
  paginas: readonly PaginaCopy[];
  catalogos: CatalogosCopy;
  movil?: boolean;
  /** Lo que cambia en el árbol mientras se escribe (título, tipo): se dibuja en el acto. */
  onPaginaEnVivo: (c: Partial<Pick<PaginaCopy, 'titulo' | 'tipo' | 'emoji'>>) => void;
  /** El título, ya para guardar (el armazón lo manda al índice). */
  onTitulo: (titulo: string) => void;
  onEmoji: (emoji: string | null) => void;
  onAbrir: (id: string) => void;
  onPapelera: () => void;
  /** El documento vivo, para el chat de MaKo (que escribe en él). */
  onEditor?: (e: DocVivo | null) => void;
  /** «Pedirle a MaKo» del «/» (el foco a la caja) o «Preguntar a MaKo» con lo seleccionado. */
  onMako: (seleccion?: string) => void;
  /** Una propuesta de MaKo abierta: no se guarda ni se edita (ver la cabecera). */
  pausa?: boolean;
  /** La barra de la izquierda, plegada: las migas ofrecen volver a abrirla. */
  arbolPlegado?: boolean;
  onDesplegarArbol?: () => void;
  /** Avisar algo corto (el toast del armazón), con «Deshacer» si se pasa. */
  avisar: (texto: string, deshacer?: () => void) => void;
  /** El título y las propiedades de ahora, para el chat (que los manda con cada pedido aunque no se hayan guardado). */
  onVivo?: (v: { titulo: string; props: PropsGuion }) => void;
  /** Lo que el chat puede cambiar de la página al ACEPTAR una propuesta de MaKo (el título y las propiedades). */
  onApi?: (api: ApiPagina | null) => void;
  /** «Compartir para editar» del menú ⋯ (D9). Sin esto, el menú no lo ofrece. */
  onCompartir?: () => void;
  /** Abierto con un link para editar (ver la cabecera, 5): el guardar es el del link. */
  compartido?: { guardar: GuardarGuion };
};

/** Lo que el chat cambia de la página (no del cuerpo: el cuerpo lo escribe en el editor). */
export type ApiPagina = { cambiarTitulo: (t: string) => void; cambiarProps: (c: Partial<PropsGuion>) => void };

export function EditorGuion(p: PropsEditorGuion) {
  const { guion, catalogos, movil = false, pausa = false } = p;
  const compartido = !!p.compartido;
  const id = guion.pagina.id;
  const [editado, setEditado] = useState(guion.doc.editado ?? null);
  const [props, setProps] = useState<PropsGuion>(guion.doc.props);
  const [titulo, setTitulo] = useState(guion.pagina.titulo === SIN_TITULO ? '' : guion.pagina.titulo);
  const [estado, setEstado] = useState<EstadoGuardado>('guardado');
  const [emojis, setEmojis] = useState(false);
  const [menuPagina, setMenuPagina] = useState(false);
  const [doc, setDoc] = useState<DocVivo | null>(null);
  const enfocarCuerpo = useRef<(() => void) | null>(null);
  const versionRef = useRef(guion.doc.version);
  const pendiente = useRef<{ contenido?: JsonNodo; props?: PropsGuion } | null>(null);
  const cola = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<number | null>(null);
  const roto = useRef(false);
  const pausaRef = useRef(pausa);
  pausaRef.current = pausa;
  const vivo = useRef(p);
  vivo.current = p;
  const refEmojis = useRef<HTMLDivElement>(null);
  const refMenu = useRef<HTMLDivElement>(null);
  useCerrarAfuera(refEmojis, emojis, () => setEmojis(false));
  useCerrarAfuera(refMenu, menuPagina, () => setMenuPagina(false));

  const guardarAhora = useCallback((keepalive = false): Promise<void> => {
    if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null; }
    const cambio = pendiente.current;
    if (!cambio || roto.current || pausaRef.current) return cola.current;
    pendiente.current = null;
    cola.current = cola.current.then(async () => {
      setEstado('guardando');
      const conLink = vivo.current.compartido;
      const r = conLink
        ? await conLink.guardar({ version: versionRef.current, ...cambio }, keepalive)
        : await pedirGuardar({ id, version: versionRef.current, ...cambio }, keepalive);
      if (r.ok) {
        versionRef.current = r.version;
        if (r.editado !== undefined) setEditado(r.editado);
        setEstado(pendiente.current ? 'pendiente' : 'guardado');
        return;
      }
      if (r.conflicto) { roto.current = true; setEstado('conflicto'); return; }
      // Lo que no salió vuelve a la cola (lo nuevo, encima).
      pendiente.current = { ...cambio, ...(pendiente.current ?? {}) };
      setEstado('error');
    });
    return cola.current;
  }, [id]);

  const marcar = useCallback((c: { contenido?: JsonNodo; props?: PropsGuion }) => {
    if (roto.current) return;
    pendiente.current = { ...(pendiente.current ?? {}), ...c };
    setEstado('pendiente');
    if (pausaRef.current) return;
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void guardarAhora(); }, RESPIRO_MS);
  }, [guardarAhora]);

  // Lo que queda del ejemplo de la plantilla de la que nació la página (29/10/2026, docs/plantillas-reales/copywriter.md,
  // 3.5): bloques iguales a los del negocio ficticio y «[DATO:» por completar. Se cuenta con lo que escribe la persona y
  // al soltar una propuesta de MaKo.
  const plantilla = useMemo(() => { const pl = plantillaPorId(catalogos, props.plantilla); return pl?.ejemplo ? pl : null; }, [catalogos, props.plantilla]);
  const [restos, setRestos] = useState(() => (plantilla ? restosDelEjemplo(guion.doc.contenido, plantilla) : { bloques: 0, datos: 0 }));
  const contarRestos = useCallback((d: JsonNodo) => {
    if (!plantilla) return;
    const r = restosDelEjemplo(d, plantilla);
    setRestos((x) => (x.bloques === r.bloques && x.datos === r.datos ? x : r));
  }, [plantilla]);

  // Lo que escribe la persona (lo que pone MaKo no pasa por acá: ./CuerpoNotion.tsx). En pausa no se marca para guardar.
  const alCambiar = useCallback((d: JsonNodo) => {
    if (pausaRef.current) return;
    marcar({ contenido: d });
    contarRestos(d);
  }, [marcar, contarRestos]);

  // El documento vivo, para el chat.
  const alDoc = useCallback((d: DocVivo | null) => { setDoc(d); vivo.current.onEditor?.(d); }, []);

  // 4. La pausa de una propuesta: no se edita y se saca una foto. Al soltarla, si el cuerpo quedó distinto de la foto
  //    (se ACEPTÓ), se guarda; si quedó igual (se descartó), no hay nada que guardar. Y lo pendiente de antes, sale.
  const fotoPausa = useRef<string | null>(null);
  useEffect(() => {
    if (!doc || roto.current) return;
    if (pausa) { fotoPausa.current = JSON.stringify(doc.leer()); return; }
    const foto = fotoPausa.current;
    fotoPausa.current = null;
    const ahora = doc.leer();
    if (foto != null && JSON.stringify(ahora) !== foto) { marcar({ contenido: ahora }); contarRestos(ahora); return; }
    if (pendiente.current) timer.current = window.setTimeout(() => { void guardarAhora(); }, RESPIRO_MS);
  }, [pausa, doc, guardarAhora, marcar, contarRestos]);

  // 1. Al ocultar la pestaña, al irse y al cerrar el guion: lo pendiente sale.
  useEffect(() => {
    const oculta = () => { if (document.visibilityState === 'hidden') void guardarAhora(true); };
    const saliendo = () => { void guardarAhora(true); };
    document.addEventListener('visibilitychange', oculta);
    window.addEventListener('pagehide', saliendo);
    return () => {
      document.removeEventListener('visibilitychange', oculta);
      window.removeEventListener('pagehide', saliendo);
      void guardarAhora();
    };
  }, [guardarAhora]);

  // El título: en el árbol en el acto; al índice, con un respiro.
  const timerTitulo = useRef<number | null>(null);
  const cambiarTitulo = (v: string) => {
    const limpio = v.replace(/\n/g, ' ');
    setTitulo(limpio);
    vivo.current.onPaginaEnVivo({ titulo: limpio.trim() || SIN_TITULO });
    if (timerTitulo.current != null) window.clearTimeout(timerTitulo.current);
    timerTitulo.current = window.setTimeout(() => vivo.current.onTitulo(limpio), 600);
  };
  useEffect(() => () => {
    if (timerTitulo.current != null) { window.clearTimeout(timerTitulo.current); }
  }, []);

  const cambiarProps = (c: Partial<PropsGuion>) => {
    const nuevas = { ...props, ...c };
    setProps(nuevas);
    if (c.tipo) vivo.current.onPaginaEnVivo({ tipo: c.tipo });
    marcar({ props: nuevas });
  };

  // Lo de ahora, para el chat.
  useEffect(() => { vivo.current.onVivo?.({ titulo: titulo.trim() || SIN_TITULO, props }); }, [titulo, props]);

  // Lo que el chat cambia de la página al aceptar (por ref: siempre el estado de AHORA).
  const cambiarPropsRef = useRef(cambiarProps);
  cambiarPropsRef.current = cambiarProps;
  const cambiarTituloRef = useRef(cambiarTitulo);
  cambiarTituloRef.current = cambiarTitulo;

  useEffect(() => {
    vivo.current.onApi?.({ cambiarTitulo: (t) => cambiarTituloRef.current(t), cambiarProps: (c) => cambiarPropsRef.current(c) });
    return () => { vivo.current.onApi?.(null); };
  }, []);

  /**
   * «Ver ejemplo» (Martín, 29/10/2026: «Poné la estructura, la misma, y en algún lado un botón de "ver ejemplo" para que se
   * entienda que es un ejemplo»): el ejemplo de la plantilla se ve APARTE, en una caja que dice que el negocio es ficticio.
   * Nunca entra solo a la página: sólo con «Usar como base», en UN paso de deshacer (Ctrl+Z, o «Deshacer» en el aviso).
   */
  const [verEjemplo, setVerEjemplo] = useState(false);
  /**
   * «Ver el original» (11/11/2026, D18): la página replica un outlier (`props.outlier`) y el original se ve APARTE, como el
   * ejemplo de una plantilla. Se lee al abrirlo (la pantalla no lo trae: viaja entero sólo cuando se pide).
   */
  const [original, setOriginal] = useState<OutlierCopy | 'leyendo' | { error: string } | null>(null);
  const verOriginal = async () => {
    if (!props.outlier) return;
    setOriginal('leyendo');
    const r = await pedirOriginal(props.outlier);
    setOriginal(r.ok ? r.outlier : { error: r.error });
  };
  const ejemploDoc = useMemo(() => (verEjemplo && plantilla ? plantilla.contenido() : null), [verEjemplo, plantilla]);
  const usarComoBase = () => {
    setVerEjemplo(false);
    if (!doc || !plantilla || pausaRef.current) return;
    const antes = doc.leer();
    if (!doc.poner(plantilla.contenido(), { historial: true })) { p.avisar('No se pudo cambiar la página'); return; }
    marcar({ contenido: doc.leer() });
    contarRestos(doc.leer());
    p.avisar('El ejemplo quedó como base', () => { if (doc.poner(antes, { historial: true })) { marcar({ contenido: doc.leer() }); contarRestos(doc.leer()); } });
  };

  const { estructuras, propias } = estructurasDelTipo(catalogos, props.tipo);
  const estructura = catalogos.estructuras.find((e) => e.id === props.estructura) ?? null;

  /** Elegir la estructura: si el cuerpo está vacío, arma sus secciones (un título por etiqueta). */
  const elegirEstructura = (idE: string) => {
    const e = catalogos.estructuras.find((x) => x.id === idE) ?? null;
    cambiarProps({ estructura: e?.id ?? null });
    if (!e || !doc) return;
    if (sinTexto(doc.leer())) {
      if (doc.poner(docDeEstructura(e.etiquetas), { historial: true })) { marcar({ contenido: doc.leer() }); p.avisar(`Secciones de ${e.nombre}`); }
    }
  };

  const copiarTexto = async () => {
    setMenuPagina(false);
    if (!doc) return;
    const t = [titulo.trim(), textoDelDoc(doc.leer())].filter(Boolean).join('\n\n');
    // Lo copiado sale de la app: si todavía tiene datos del negocio ficticio o algo por completar, se dice.
    const queda = plantilla ? restosDelEjemplo(doc.leer(), plantilla) : { bloques: 0, datos: 0 };
    const ojo = queda.bloques ? ` Todavía tiene ${queda.bloques === 1 ? '1 bloque' : `${queda.bloques} bloques`} del ejemplo.` : queda.datos ? ` Faltan ${queda.datos === 1 ? '1 dato' : `${queda.datos} datos`}.` : '';
    try { await navigator.clipboard.writeText(t); p.avisar(`Texto copiado.${ojo}`); } catch { p.avisar('No se pudo copiar'); }
  };

  // «Publicar en redes» (29/10/2026, Martín: «que con las funcionalidades que ya creamos puedan publicar en Facebook, TikTok,
  // LinkedIn…»): el texto de la página va al Calendario como el texto de una Publicación (el título, como su título). Ahí se eligen
  // la red, el día, la hora y la imagen o el video. Nunca desde el editor COMPARTIDO: quien edita por un link no tiene Calendario.
  const router = useRouter();
  const [publicando, setPublicando] = useState(false);
  const publicarTexto = async () => {
    setMenuPagina(false);
    if (!doc || publicando) return;
    setPublicando(true);
    try {
      const r = await llevarAlCalendario({ origen: 'texto', titulo: titulo.trim() || null, texto: textoDelDoc(doc.leer()) });
      if (r.ok) router.push(r.url);
      else p.avisar(r.error);
    } finally {
      setPublicando(false);
    }
  };
  // «Usar en un anuncio» (6/11/2026, lo prometido a la agencia de Thiago): el texto de la página como el texto principal de una
  // campaña, en /anuncio/nuevo (app/_crear/usar-en-anuncio.ts). Ahí se elige el video o la imagen y se PROPONE: lanzarla la
  // confirma una persona en /mako/revisar. Tampoco desde el editor compartido: quien edita por un link no tiene anuncios.
  const usarEnAnuncio = () => {
    setMenuPagina(false);
    if (!doc) return;
    router.push(rutaUsarEnAnuncio({ origen: 'copywriter', titulo: titulo.trim() || null, texto: textoDelDoc(doc.leer()) }));
  };

  const ruta = rutaDe(p.paginas, id);
  const emojiPagina = guion.pagina.emoji ?? INFO_TIPO[props.tipo].emoji;
  const enError = estado === 'error' || estado === 'conflicto' || estado === 'roto';
  const angulo = catalogos.angulos.find((a) => a.id === props.angulo) ?? null;

  return (
    <div className="nt-doc">
      {(!movil || compartido) && (
        <div className="nt-barra">
          <nav className="nt-migas" aria-label="Dónde está este guion">
            {p.arbolPlegado && (
              <button type="button" className="nt-boton-ico" onClick={p.onDesplegarArbol} title="Abrir la barra de guiones" aria-label="Abrir la barra de guiones">»</button>
            )}
            {ruta.map((x, i) => (
              <span key={x.id} style={{ display: 'contents' }}>
                {i > 0 && <span className="nt-miga-sep" aria-hidden>/</span>}
                <button type="button" className="nt-miga" onClick={() => p.onAbrir(x.id)} aria-current={x.id === id ? 'page' : undefined}>
                  <span aria-hidden>{x.emoji ?? INFO_TIPO[x.tipo].emoji}</span>
                  <span>{x.id === id ? titulo.trim() || SIN_TITULO : x.titulo}</span>
                </button>
              </span>
            ))}
          </nav>
          <span className="nt-guardado" data-error={enError ? '' : undefined} role="status">{pausa && !enError ? 'Sin guardar: propuesta de MaKo' : TEXTO_ESTADO[estado]}</span>
          <div style={{ position: 'relative' }} ref={refMenu}>
            <button type="button" className="nt-boton-ico" onClick={() => setMenuPagina((m) => !m)} aria-expanded={menuPagina} aria-haspopup="menu" aria-label="Más opciones del guion">⋯</button>
            {menuPagina && (
              <div className="nt-menu" data-chico="" role="menu" style={{ position: 'absolute', right: 0, top: 30 }}>
                <button type="button" role="menuitem" className="nt-menu-fila" onClick={() => void copiarTexto()}>
                  <span className="nt-menu-cuadro" aria-hidden>⧉</span><span className="nt-menu-textos"><span className="nt-menu-nombre">Copiar el texto</span></span>
                </button>
                {!compartido && (
                  <button type="button" role="menuitem" className="nt-menu-fila" data-publicar-texto="" disabled={publicando} onClick={() => void publicarTexto()}>
                    <span className="nt-menu-cuadro" aria-hidden>↑</span><span className="nt-menu-textos"><span className="nt-menu-nombre">{publicando ? 'Llevándolo al Calendario…' : 'Publicar en redes'}</span></span>
                  </button>
                )}
                {!compartido && (
                  <button type="button" role="menuitem" className="nt-menu-fila" data-usar-en-anuncio="" onClick={usarEnAnuncio}>
                    <span className="nt-menu-cuadro" aria-hidden>📣</span><span className="nt-menu-textos"><span className="nt-menu-nombre">Usar en un anuncio</span></span>
                  </button>
                )}
                {p.onCompartir && !compartido && (
                  <button type="button" role="menuitem" className="nt-menu-fila" onClick={() => { setMenuPagina(false); p.onCompartir?.(); }}>
                    <span className="nt-menu-cuadro" aria-hidden>↗</span><span className="nt-menu-textos"><span className="nt-menu-nombre">Compartir para editar</span></span>
                  </button>
                )}
                {!compartido && (
                  <button type="button" role="menuitem" className="nt-menu-fila" data-peligro="" onClick={() => { setMenuPagina(false); p.onPapelera(); }}>
                    <span className="nt-menu-cuadro" aria-hidden>✕</span><span className="nt-menu-textos"><span className="nt-menu-nombre">Mover a la Papelera</span></span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="nt-scroll">
        {enError && (
          <div className="nt-aviso" role="alert">
            {estado === 'conflicto' && <>Este guion cambió en otra pestaña o lo editó alguien más. Para no pisar lo otro, <button type="button" className="nt-miga" onClick={() => window.location.reload()}>recarga la página</button>.</>}
            {estado === 'error' && <>No se pudo guardar lo último. <button type="button" className="nt-miga" onClick={() => void guardarAhora()}>Reintentar</button></>}
            {estado === 'roto' && <>Este guion no se pudo abrir: queda como estaba, sin cambios.</>}
            <ReportarASoporte />
          </div>
        )}
        {!compartido && plantilla && (
          // De qué plantilla nació y su ejemplo, aparte. Lo que adapta lo ofrece MaKo en el chat, no esta franja (Martín,
          // 29/10/2026: «EN LUGAR de que esté en la top bar arriba "adaptar con MaKo"»).
          <div className="nt-aviso nt-restos" role="status">
            <span>
              {restos.bloques || restos.datos
                ? [restos.bloques ? (restos.bloques === 1 ? 'Queda 1 bloque del ejemplo' : `Quedan ${restos.bloques} bloques del ejemplo`) : '', restos.datos ? `${restos.datos === 1 ? '1 dato' : `${restos.datos} datos`} por completar` : ''].filter(Boolean).join(' · ')
                : `Plantilla: ${plantilla.nombre}`}
            </span>
            <button type="button" className="nt-miga nt-ver-ejemplo" onClick={() => setVerEjemplo(true)}>Ver ejemplo</button>
          </div>
        )}
        {!compartido && !plantilla && props.outlier && (
          // De qué outlier nació la página y el original, aparte (la franja de «Ver ejemplo», D17). Lo que replica lo pide MaKo.
          <div className="nt-aviso nt-restos" role="status">
            <span>Réplica de un outlier</span>
            <button type="button" className="nt-miga nt-ver-ejemplo" onClick={() => void verOriginal()}>Ver el original</button>
          </div>
        )}
        {original && (
          <Modal titulo={typeof original === 'object' && 'id' in original ? `El original: ${original.creador.usuario ? `@${original.creador.usuario}` : original.creador.nombre}` : 'El original'}
            encabezado={typeof original === 'object' && 'id' in original ? rotuloDeFormato(original) : undefined} ancho={760} onCerrar={() => setOriginal(null)}
            pie={(
              <>
                <Button variant="tertiary" onClick={() => setOriginal(null)}>Cerrar</Button>
                {typeof original === 'object' && 'id' in original
                  ? <a className="nt-miga" href={original.url} target="_blank" rel="noopener noreferrer">Ver original ↗</a> : null}
              </>
            )}>
            {original === 'leyendo' ? <p className="nt-ejemplo-nota">Leyendo el original…</p>
              : 'error' in original ? <p className="nt-ejemplo-nota" role="alert">No se pudo leer el original: {original.error} <ReportarASoporte /></p>
                : (
                  <>
                    <p className="nt-ejemplo-nota">{ROTULO_TEXTO[original.deDonde]}. MaKo copia su estructura, su tipo de gancho y su ritmo, nunca sus frases.</p>
                    <div className="nt-original">{original.texto}</div>
                  </>
                )}
          </Modal>
        )}
        {verEjemplo && plantilla && ejemploDoc && (
          <Modal titulo={`Ejemplo: ${plantilla.ejemplo!.negocio}`} encabezado="Negocio ficticio" ancho={760} onCerrar={() => setVerEjemplo(false)}
            pie={(
              <>
                <Button variant="tertiary" onClick={() => setVerEjemplo(false)}>Cerrar</Button>
                <Button variant="primary" disabled={pausa || !doc} onClick={usarComoBase}>Usar como base</Button>
              </>
            )}>
            <p className="nt-ejemplo-nota">Un ejemplo para ver la forma. El negocio, las cifras y los nombres son inventados: no son tuyos.</p>
            <div className="nt nt-ejemplo" data-en-crear="">
              <CuerpoNotion inicial={ejemploDoc} editable={false} etiquetas={[]} conMako={false} onCambio={() => {}} onMako={() => {}} movil={movil} />
            </div>
          </Modal>
        )}
        <div className="nt-pagina" style={{ position: 'relative' }}>
          <div className="nt-portada" />
          <div style={{ position: 'relative' }} ref={refEmojis}>
            {compartido
              ? <span className="nt-icono" aria-hidden>{emojiPagina}</span>
              : <button type="button" className="nt-icono" onClick={() => setEmojis((v) => !v)} aria-expanded={emojis} aria-label="Cambiar el ícono del guion" title="Cambiar el ícono">{emojiPagina}</button>}
            {emojis && !compartido && (
              <div className="nt-menu" data-chico="" role="dialog" aria-label="Ícono" style={{ position: 'absolute', top: 84, left: 0, width: 'auto' }}>
                <div className="nt-emojis">
                  {EMOJIS_PAGINA.map((e) => (
                    <button key={e} type="button" onClick={() => { setEmojis(false); p.onEmoji(e); }} aria-label={`Usar ${e}`}>{e}</button>
                  ))}
                </div>
                <div className="nt-menu-sep" />
                <button type="button" className="nt-menu-fila" onClick={() => { setEmojis(false); p.onEmoji(null); }}>
                  <span className="nt-menu-textos"><span className="nt-menu-nombre">Usar el del tipo</span></span>
                </button>
              </div>
            )}
          </div>
          <textarea className="nt-titulo" rows={1} value={titulo} placeholder={SIN_TITULO} aria-label="Título del guion" maxLength={200}
            onChange={(e) => cambiarTitulo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enfocarCuerpo.current?.(); } }} />

          <div className="nt-props" aria-label="Propiedades">
            {compartido ? (
              // Con un link: a la vista, sin cambiar (son del método, y la biblioteca no viaja: ver compartir-reglas.ts).
              <>
                <div className="nt-prop"><span className="nt-prop-nombre"><span aria-hidden>◉</span><span>Tipo</span></span>
                  <span className="nt-prop-valor nt-prop-fija">{INFO_TIPO[props.tipo].emoji} {INFO_TIPO[props.tipo].label}</span></div>
                {angulo && <div className="nt-prop"><span className="nt-prop-nombre"><span aria-hidden>↗</span><span>Ángulo</span></span>
                  <span className="nt-prop-valor nt-prop-fija">{angulo.emoji} {angulo.nombre}</span></div>}
                {estructura && <div className="nt-prop"><span className="nt-prop-nombre"><span aria-hidden>≡</span><span>Estructura</span></span>
                  <span className="nt-prop-valor nt-prop-fija">{estructura.emoji} {estructura.nombre}</span></div>}
                {props.duracion != null && <div className="nt-prop"><span className="nt-prop-nombre"><span aria-hidden>◷</span><span>Duración</span></span>
                  <span className="nt-prop-valor nt-prop-fija">{props.duracion} segundos</span></div>}
              </>
            ) : (<>
            <div className="nt-prop">
              <span className="nt-prop-nombre"><span aria-hidden>◉</span><span>Tipo</span></span>
              <span className="nt-prop-valor">
                <select aria-label="Tipo" value={props.tipo} onChange={(e) => cambiarProps({ tipo: e.target.value as TipoGuion })}>
                  {TIPOS_GUION.map((t) => <option key={t} value={t}>{INFO_TIPO[t].emoji} {INFO_TIPO[t].label}</option>)}
                </select>
              </span>
            </div>
            {/* Ángulo, Estructura y Duración: sólo en los tipos con método (un email o una página en blanco no los tienen). */}
            {tieneMetodo(props.tipo) && (<>
            <div className="nt-prop">
              <span className="nt-prop-nombre"><span aria-hidden>↗</span><span>Ángulo</span></span>
              <span className="nt-prop-valor">
                <select aria-label="Ángulo" value={props.angulo ?? ''} onChange={(e) => cambiarProps({ angulo: e.target.value || null })} className={props.angulo ? undefined : 'nt-prop-vacio'}>
                  <option value="">Vacío</option>
                  {catalogos.angulos.map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.nombre}</option>)}
                </select>
              </span>
            </div>
            <div className="nt-prop">
              <span className="nt-prop-nombre"><span aria-hidden>≡</span><span>Estructura</span></span>
              <span className="nt-prop-valor">
                <select aria-label="Estructura" value={props.estructura ?? ''} onChange={(e) => elegirEstructura(e.target.value)} className={props.estructura ? undefined : 'nt-prop-vacio'}>
                  <option value="">Vacío</option>
                  {estructuras.map((x) => <option key={x.id} value={x.id}>{x.emoji} {x.nombre}</option>)}
                </select>
                {!propias && props.estructura == null && <span className="nt-prop-vacio" style={{ fontSize: 12 }}>Todavía no hay de {INFO_TIPO[props.tipo].label}</span>}
              </span>
            </div>
            <div className="nt-prop">
              <span className="nt-prop-nombre"><span aria-hidden>◷</span><span>Duración</span></span>
              <span className="nt-prop-valor">
                <input type="number" min={1} max={7200} inputMode="numeric" aria-label="Duración en segundos" placeholder="Vacío" value={props.duracion ?? ''}
                  onChange={(e) => { const n = Number(e.target.value); cambiarProps({ duracion: e.target.value && Number.isFinite(n) && n > 0 ? Math.round(n) : null }); }} />
                {props.duracion != null && <span className="nt-prop-vacio">segundos</span>}
              </span>
            </div>
            </>)}
            </>)}
            {editado && (
              <div className="nt-prop">
                <span className="nt-prop-nombre"><span aria-hidden>✎</span><span>Última edición</span></span>
                <span className="nt-prop-valor nt-prop-fija" data-afuera={editado.afuera && !compartido ? '' : undefined}>{quienYCuando(editado)}</span>
              </div>
            )}
          </div>
          <div className="nt-separador-props" />

          <div className="nt-cuerpo">
            <CuerpoNotion inicial={guion.doc.contenido} editable={!pausa && estado !== 'conflicto' && estado !== 'roto'} etiquetas={estructura?.etiquetas ?? []}
              conMako={!compartido} onCambio={alCambiar} onDoc={alDoc} onMako={(s) => vivo.current.onMako(s)} enfocarRef={enfocarCuerpo} movil={movil} />
          </div>
        </div>
      </div>
    </div>
  );
}
