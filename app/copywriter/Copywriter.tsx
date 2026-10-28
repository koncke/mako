'use client';

// =============================================================================
// Copywriter — el armazón: MaKo a la izquierda, el árbol de guiones y el documento (mila.gg + Notion)
// =============================================================================
// Pedido de Martín (28/10/2026): «Quiero que implementes mila.gg combinado con notion en "copywriter"… Que tenga una
// interfaz similar a la de web generator, con la sidebar de mako y el editor a la derecha». Diseño:
// docs/diseno-copywriter.md (D2).
//
// LO QUE ES DE ESTE ARCHIVO: el árbol (el índice de páginas) y lo que se hace con él —abrir, crear, renombrar, mover,
// Papelera—, siempre en el acto en la pantalla y después en el server; si el server dice que no, vuelve a lo que había
// y lo dice. El DOCUMENTO abierto es de EditorGuion (su autoguardado), y la charla, de PanelMaKo.
// Abrir otro guion NAVEGA (/copywriter/<id>, con el `?ws=` que pone el router de la casa): el server lo abre por su
// puerta, y el editor se monta de nuevo con `key` (AGENTS.md, «Un useState sembrado de props no se resiembra»).
// En el teléfono (`movil`) es un paso por pantalla: la lista, el guion o MaKo (app/m/copywriter).
// =============================================================================

import './notion.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useRouter } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { aPapelera, cambiarPagina, mover as moverEnArbol, restaurar as restaurarEnArbol } from '@/lib/copywriter/arbol';
import { propsNuevas, type GuionAbierto, type PaginaCopy, type TipoGuion } from '@/lib/copywriter/tipos';
import { docDeEstructura } from '@/lib/copywriter/doc';
import { estructuraPorDefecto, type CatalogosCopy } from '@/lib/copywriter/catalogos';
import { pedirCrear, pedirMover, pedirPapelera, pedirRenombrar, pedirRestaurar, rutaGuion } from './cliente';
import { guardarPedido } from './pedido-guardado';
import { Arbol } from './Arbol';
import { Inicio } from './Inicio';
import { EditorGuion } from './editor/EditorGuion';
import { PanelMaKo, type GuionVivo } from './PanelMaKo';

/** Debajo de este ancho la barra de guiones arranca plegada (con la de MaKo y el documento no entran las tres). */
const ANCHO_ARBOL_PLEGADO = 1280;

export type PropsCopywriter = {
  /** El negocio de la pestaña (del server): va en las claves del navegador. */
  ws: number | null;
  paginas: PaginaCopy[];
  guion: GuionAbierto | null;
  /** El guion pedido no se pudo leer (la base): se dice, no es «no existe». */
  error: string | null;
  catalogos: CatalogosCopy;
  /** Las rutas: escritorio (/copywriter) o el teléfono (/m/copywriter, que el proxy sirve en la misma URL). */
  base?: string;
};

export function Copywriter({ ws, paginas: iniciales, guion, error, catalogos, base = '/copywriter' }: PropsCopywriter) {
  const router = useRouter();
  const [paginas, setPaginas] = useState<PaginaCopy[]>(iniciales);
  const [plegado, setPlegado] = useState(false);
  // En una ventana angosta la barra de guiones arranca plegada (Notion cierra su barra igual): MaKo y el documento no
  // entran con las tres columnas. Si la persona la abre o la cierra a mano, manda ella.
  const aMano = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${ANCHO_ARBOL_PLEGADO - 0.02}px)`);
    const aplicar = () => { if (!aMano.current) setPlegado(mq.matches); };
    aplicar();
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, []);
  const plegar = useCallback((v: boolean) => { aMano.current = true; setPlegado(v); }, []);
  const [creando, setCreando] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pausa, setPausa] = useState(false);
  const cajaMako = useRef<HTMLTextAreaElement | null>(null);
  // El título y las propiedades de ahora (los pone EditorGuion; el chat los lee al mandar).
  const vivoGuion = useRef<GuionVivo | null>(null);
  const leerVivo = useCallback(() => vivoGuion.current, []);
  const ponerVivo = useCallback((v: GuionVivo) => { vivoGuion.current = v; }, []);
  const { toast, show, clear } = useToast();
  const avisar = useCallback((t: string, deshacer?: () => void, tono?: 'bad') => show(t, deshacer, tono), [show]);

  // El árbol que trae el server al navegar (otro guion) es el más nuevo: se adopta.
  const vistas = useRef(iniciales);
  useEffect(() => {
    if (vistas.current !== iniciales) { vistas.current = iniciales; setPaginas(iniciales); }
  }, [iniciales]);

  const abierta = guion?.pagina.id ?? null;
  const abrir = useCallback((id: string) => { if (id !== abierta) router.push(base === '/copywriter' ? rutaGuion(id) : `${base}/${id}`); }, [abierta, base, router]);

  /** Un cambio del árbol: en el acto, y si el server dice que no, vuelve a lo de antes y lo dice. */
  const cambiar = useCallback(async (local: (ps: PaginaCopy[]) => PaginaCopy[], server: () => Promise<{ ok: true; paginas: PaginaCopy[] } | { ok: false; error: string }>, fallo: string) => {
    let antes: PaginaCopy[] = [];
    setPaginas((ps) => { antes = ps; return local(ps); });
    const r = await server();
    if (r.ok) { setPaginas(r.paginas); return true; }
    setPaginas(antes);
    avisar(`${fallo}: ${r.error}`, undefined, 'bad');
    return false;
  }, [avisar]);

  const crear = useCallback(async (tipo: TipoGuion, padre: string | null, pedido = '') => {
    if (creando) return;
    setCreando(true);
    const e = estructuraPorDefecto(catalogos, tipo);
    const titulo = pedido ? pedido.replace(/\s+/g, ' ').slice(0, 80) : '';
    const r = await pedirCrear({ tipo, padre, titulo, props: propsNuevas(tipo, e?.id ?? null), ...(e ? { contenido: docDeEstructura(e.etiquetas) } : {}) });
    setCreando(false);
    if (!r.ok) { avisar(`No se pudo crear el guion: ${r.error}`, undefined, 'bad'); return; }
    setPaginas(r.paginas);
    if (pedido) guardarPedido(ws, r.pagina.id, pedido);
    abrir(r.pagina.id);
  }, [abrir, avisar, catalogos, creando, ws]);

  const renombrar = useCallback((id: string, titulo: string) => {
    void cambiar((ps) => { const x = cambiarPagina(ps, id, { titulo }); return x.ok ? x.paginas : ps; }, () => pedirRenombrar(id, { titulo }), 'No se pudo renombrar');
  }, [cambiar]);

  const ponerEmoji = useCallback((id: string, emoji: string | null) => {
    void cambiar((ps) => { const x = cambiarPagina(ps, id, { emoji }); return x.ok ? x.paginas : ps; }, () => pedirRenombrar(id, { emoji }), 'No se pudo cambiar el ícono');
  }, [cambiar]);

  const restaurar = useCallback((id: string) => {
    void cambiar((ps) => { const x = restaurarEnArbol(ps, id); return x.ok ? x.paginas : ps; }, () => pedirRestaurar(id), 'No se pudo restaurar');
  }, [cambiar]);

  const papelera = useCallback(async (id: string) => {
    const ok = await cambiar((ps) => { const x = aPapelera(ps, id, new Date().toISOString()); return x.ok ? x.paginas : ps; }, () => pedirPapelera(id), 'No se pudo mover a la Papelera');
    if (!ok) return;
    avisar('Movido a la Papelera', () => restaurar(id));
    // Si era el abierto (o uno de los suyos), se va al último que quede.
    if (abierta === id) router.push(base);
  }, [abierta, avisar, base, cambiar, restaurar, router]);

  const mover = useCallback((id: string, padre: string | null, posicion: number) => {
    void cambiar((ps) => { const x = moverEnArbol(ps, id, padre, posicion); return x.ok ? x.paginas : ps; }, () => pedirMover(id, padre, posicion), 'No se pudo mover');
  }, [cambiar]);

  /** Lo que cambia mientras se escribe en la página abierta (el título, el tipo): el árbol lo dibuja en el acto. */
  const enVivo = useCallback((c: Partial<Pick<PaginaCopy, 'titulo' | 'tipo' | 'emoji'>>) => {
    if (!abierta) return;
    setPaginas((ps) => { const x = cambiarPagina(ps, abierta, c); return x.ok ? x.paginas : ps; });
  }, [abierta]);

  const alMako = useCallback(() => { cajaMako.current?.focus(); }, []);

  return (
    <div className="nt">
      <PanelMaKo ws={ws} guion={guion} paginas={paginas} editor={editor} leerVivo={leerVivo} campo={cajaMako} onPausa={setPausa} avisar={avisar} />
      <Arbol paginas={paginas} abierta={abierta} plegado={plegado} onPlegar={() => plegar(true)} onAbrir={abrir}
        onCrear={(t, padre) => void crear(t, padre)} onRenombrar={renombrar} onPapelera={(id) => void papelera(id)} onRestaurar={restaurar} onMover={mover} />
      {guion ? (
        <EditorGuion key={guion.pagina.id} guion={guion} paginas={paginas} catalogos={catalogos}
          onPaginaEnVivo={enVivo} onTitulo={(t) => renombrar(guion.pagina.id, t)} onEmoji={(e) => ponerEmoji(guion.pagina.id, e)}
          onAbrir={abrir} onPapelera={() => void papelera(guion.pagina.id)} onEditor={setEditor} onMako={alMako} pausa={pausa}
          arbolPlegado={plegado} onDesplegarArbol={() => plegar(false)} avisar={avisar} onVivo={ponerVivo} />
      ) : error ? (
        <div className="nt-doc"><div className="nt-inicio"><div className="nt-aviso" role="alert">{error}<ReportarASoporte /></div></div></div>
      ) : (
        <Inicio creando={creando} onCrear={(t, pedido) => void crear(t, null, pedido)} arbolPlegado={plegado} onDesplegarArbol={() => plegar(false)} />
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}
