'use client';

// =============================================================================
// EditorGuion — la página de un guion, copiada de Notion: ícono, título, propiedades y el cuerpo por bloques
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D2, D3). De la página de Notion (notion.com/product/docs, la captura del editor):
// arriba las migas y el estado del guardado; el ícono grande; el título enorme; las PROPIEDADES en renglones (nombre
// gris a la izquierda, valor a la derecha): Tipo, Ángulo, Estructura y Duración; una línea; y el cuerpo, con el «/» y
// el asa del margen.
//
// ESTE COMPONENTE ES EL DUEÑO DEL DOCUMENTO ABIERTO. Las decisiones que no se ven, con el molde del Web Generator
// (app/web-generator/editor/EditorLanding.tsx):
//   1. EL AUTOGUARDADO es concurrencia optimista: cada guardado manda la `version` que tiene y el server contesta 409 si
//      otra pestaña guardó en el medio; la pantalla lo dice con «Recargar», nunca pisa. Los guardados van EN FILA (una
//      promesa encadenada): dos en paralelo mandarían la misma versión y el segundo daría un conflicto falso. Respiro de
//      1,2 s; al ocultarse la pestaña o al cerrar el guion se manda lo pendiente (con `keepalive` si entra).
//   2. NO SE GUARDA LO QUE NO SE PUDO ABRIR: si el JSON no cumple el esquema, TipTap abre un documento VACÍO sin error y
//      el autoguardado lo escribiría encima. Se valida con `schema.nodeFromJSON(...).check()` antes de dar el guion por
//      abierto; si falla, queda de sólo lectura y lo dice.
//   3. EL TÍTULO Y EL ÍCONO SON DE LA PÁGINA (el árbol), no del documento: van por `onTitulo`/`onEmoji` al armazón, que
//      los guarda en el índice. Las propiedades y el cuerpo, acá.
//   4. CON UNA PROPUESTA DE MaKo ABIERTA (`pausa`), el autoguardado no escribe y el editor no se toca: lo que se ve es
//      la propuesta, todavía no el guion (docs/diseno-copywriter.md, D5). Al soltarla, lo pendiente sale.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { INFO_TIPO, SIN_TITULO, TIPOS_GUION, type GuionAbierto, type JsonNodo, type PaginaCopy, type PropsGuion, type TipoGuion } from '@/lib/copywriter/tipos';
import { docDeEstructura, sinTexto, textoDelDoc } from '@/lib/copywriter/doc';
import { rutaDe } from '@/lib/copywriter/arbol';
import { estructurasDelTipo, type CatalogosCopy } from '@/lib/copywriter/catalogos';
import { pedirGuardar } from '../cliente';
import { extensionesCopy } from './extensiones';
import { catalogoCopy } from './bloques';
import { MenuBloques } from './MenuBloques';
import { Asa } from './Asa';
import { useCerrarAfuera } from './cerrar-afuera';

type EstadoGuardado = 'guardado' | 'pendiente' | 'guardando' | 'error' | 'conflicto' | 'roto';

const RESPIRO_MS = 1_200;

/** Los íconos que ofrece la página (Notion abre su selector entero; acá, los de un guion). */
export const EMOJIS_PAGINA = ['📣', '🎬', '📱', '▶️', '✍️', '🔥', '🎯', '💡', '📌', '🧲', '🤝', '📖', '🎓', '🌉', '😩', '🚀'] as const;

const TEXTO_ESTADO: Record<EstadoGuardado, string> = {
  guardado: 'Guardado',
  pendiente: 'Editando…',
  guardando: 'Guardando…',
  error: 'No se pudo guardar',
  conflicto: 'Cambió en otra pestaña',
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
  /** El editor vivo, para el chat de MaKo (que escribe en él). */
  onEditor?: (e: Editor | null) => void;
  /** Llevar el foco a la caja de MaKo («Pedirle a MaKo» del «/»). */
  onMako: () => void;
  /** Una propuesta de MaKo abierta: no se guarda ni se edita (ver la cabecera). */
  pausa?: boolean;
  /** La barra de la izquierda, plegada: las migas ofrecen volver a abrirla. */
  arbolPlegado?: boolean;
  onDesplegarArbol?: () => void;
  /** Avisar algo corto (el toast del armazón). */
  avisar: (texto: string) => void;
  /** El título y las propiedades de ahora, para el chat (que los manda con cada pedido aunque no se hayan guardado). */
  onVivo?: (v: { titulo: string; props: PropsGuion }) => void;
  /** Lo que el chat puede cambiar de la página al ACEPTAR una propuesta de MaKo (el título y las propiedades). */
  onApi?: (api: ApiPagina | null) => void;
};

/** Lo que el chat cambia de la página (no del cuerpo: el cuerpo lo escribe en el editor). */
export type ApiPagina = { cambiarTitulo: (t: string) => void; cambiarProps: (c: Partial<PropsGuion>) => void };

export function EditorGuion(p: PropsEditorGuion) {
  const { guion, catalogos, movil = false, pausa = false } = p;
  const id = guion.pagina.id;
  const [props, setProps] = useState<PropsGuion>(guion.doc.props);
  const [titulo, setTitulo] = useState(guion.pagina.titulo === SIN_TITULO ? '' : guion.pagina.titulo);
  const [estado, setEstado] = useState<EstadoGuardado>('guardado');
  const [emojis, setEmojis] = useState(false);
  const [menuPagina, setMenuPagina] = useState(false);
  const [scroll, setScroll] = useState<HTMLDivElement | null>(null);
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
      const r = await pedirGuardar({ id, version: versionRef.current, ...cambio }, keepalive);
      if (r.ok) {
        versionRef.current = r.version;
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

  const extensiones = useMemo(() => extensionesCopy(), []);
  const editor = useEditor({
    extensions: extensiones,
    content: guion.doc.contenido,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { 'aria-label': 'El guion', spellcheck: 'true' } },
    onCreate: ({ editor: e }) => {
      // 2. NO SE GUARDA LO QUE NO SE PUDO ABRIR.
      try { e.schema.nodeFromJSON(guion.doc.contenido).check(); } catch {
        roto.current = true;
        e.setEditable(false);
        setEstado('roto');
      }
    },
    onUpdate: ({ editor: e, transaction }) => {
      if (!transaction.docChanged || pausaRef.current) return;
      marcar({ contenido: e.getJSON() as JsonNodo });
    },
  });

  // El editor vivo, para el chat.
  useEffect(() => {
    vivo.current.onEditor?.(editor ?? null);
    return () => { vivo.current.onEditor?.(null); };
  }, [editor]);

  // 4. La pausa de una propuesta: no se edita y se saca una foto. Al soltarla, si el cuerpo quedó distinto de la foto
  //    (se ACEPTÓ), se guarda; si quedó igual (se descartó), no hay nada que guardar. Y lo pendiente de antes, sale.
  const fotoPausa = useRef<string | null>(null);
  useEffect(() => {
    if (!editor || roto.current) return;
    editor.setEditable(!pausa);
    if (pausa) { fotoPausa.current = JSON.stringify(editor.getJSON()); return; }
    const foto = fotoPausa.current;
    fotoPausa.current = null;
    if (foto != null && JSON.stringify(editor.getJSON()) !== foto) { marcar({ contenido: editor.getJSON() as JsonNodo }); return; }
    if (pendiente.current) timer.current = window.setTimeout(() => { void guardarAhora(); }, RESPIRO_MS);
  }, [pausa, editor, guardarAhora, marcar]);

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

  const { estructuras, propias } = estructurasDelTipo(catalogos, props.tipo);
  const estructura = catalogos.estructuras.find((e) => e.id === props.estructura) ?? null;
  const catalogoMenu = useMemo(() => catalogoCopy(estructura?.etiquetas ?? []), [estructura]);

  /** Elegir la estructura: si el cuerpo está vacío, arma sus secciones (un título por etiqueta). */
  const elegirEstructura = (idE: string) => {
    const e = catalogos.estructuras.find((x) => x.id === idE) ?? null;
    cambiarProps({ estructura: e?.id ?? null });
    if (!e || !editor) return;
    if (sinTexto(editor.getJSON() as JsonNodo)) {
      editor.commands.setContent(docDeEstructura(e.etiquetas), { emitUpdate: true });
      p.avisar(`Secciones de ${e.nombre}`);
    }
  };

  const copiarTexto = async () => {
    setMenuPagina(false);
    if (!editor) return;
    const t = [titulo.trim(), textoDelDoc(editor.getJSON() as JsonNodo)].filter(Boolean).join('\n\n');
    try { await navigator.clipboard.writeText(t); p.avisar('Texto copiado'); } catch { p.avisar('No se pudo copiar'); }
  };

  const ruta = rutaDe(p.paginas, id);
  const emojiPagina = guion.pagina.emoji ?? INFO_TIPO[props.tipo].emoji;
  const enError = estado === 'error' || estado === 'conflicto' || estado === 'roto';

  return (
    <div className="nt-doc">
      {!movil && (
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
                <button type="button" role="menuitem" className="nt-menu-fila" data-peligro="" onClick={() => { setMenuPagina(false); p.onPapelera(); }}>
                  <span className="nt-menu-cuadro" aria-hidden>✕</span><span className="nt-menu-textos"><span className="nt-menu-nombre">Mover a la Papelera</span></span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="nt-scroll" ref={setScroll}>
        {enError && (
          <div className="nt-aviso" role="alert">
            {estado === 'conflicto' && <>Este guion cambió en otra pestaña. Para no pisar lo de allá, <button type="button" className="nt-miga" onClick={() => window.location.reload()}>recarga la página</button>.</>}
            {estado === 'error' && <>No se pudo guardar lo último. <button type="button" className="nt-miga" onClick={() => void guardarAhora()}>Reintentar</button></>}
            {estado === 'roto' && <>Este guion no se pudo abrir: queda como estaba, sin cambios.</>}
            <ReportarASoporte />
          </div>
        )}
        <div className="nt-pagina" style={{ position: 'relative' }}>
          <div className="nt-portada" />
          <div style={{ position: 'relative' }} ref={refEmojis}>
            <button type="button" className="nt-icono" onClick={() => setEmojis((v) => !v)} aria-expanded={emojis} aria-label="Cambiar el ícono del guion" title="Cambiar el ícono">{emojiPagina}</button>
            {emojis && (
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
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus('start'); } }} />

          <div className="nt-props" aria-label="Propiedades">
            <div className="nt-prop">
              <span className="nt-prop-nombre"><span aria-hidden>◉</span><span>Tipo</span></span>
              <span className="nt-prop-valor">
                <select aria-label="Tipo" value={props.tipo} onChange={(e) => cambiarProps({ tipo: e.target.value as TipoGuion })}>
                  {TIPOS_GUION.map((t) => <option key={t} value={t}>{INFO_TIPO[t].emoji} {INFO_TIPO[t].label}</option>)}
                </select>
              </span>
            </div>
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
          </div>
          <div className="nt-separador-props" />

          <div className="nt-cuerpo">
            {editor && <EditorContent editor={editor} />}
          </div>
        </div>
        {/* El asa vive en el contenedor que scrollea (su posición se mide contra él). */}
        {editor && !movil && <Asa editor={editor} contenedor={scroll} />}
      </div>
      {editor && <MenuBloques editor={editor} catalogo={catalogoMenu} alMako={p.onMako} />}
    </div>
  );
}
