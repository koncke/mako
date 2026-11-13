'use client';

// =============================================================================
// La pantalla del editor de un diseño
// =============================================================================
// Lee el diseño de la base (/api/image-editor/disenos/<id>, mig 0278), arma el adaptador de MaKo
// (../mako/adaptadorNube.ts: guarda con compare-and-set, sube a «Subidos») y monta el EditorApp de
// Doory en modo `account`. Si el diseño no está en la base pero sí en ESTE navegador (lo creó la
// etapa 1, antes del 14/10), se sube primero (../mako/mudanza.ts) y se abre.
//
// Lo que Doory pide a su backend y MaKo todavía no tiene queda en `null` (Marca, fotos de stock,
// versiones, compartir, comentarios): el editor esconde esas herramientas solo.
//
// Vive en el CENTRO de la pantalla de Create (app/_crear/PantallaCrear.tsx, desde ../ImageEditorCliente.tsx, 29/10/2026):
//   · el chat de MaKo del editor (../mako/chat/PanelMakoIA.tsx) va en la tarjeta de la IZQUIERDA, siempre abierto. Edita
//     el diseño abierto, así que necesita el motor: se monta ADENTRO del EditorApp (`dentro`) y se dibuja por portal en
//     `ranuraChat`, el hueco que le deja la tarjeta. Ya no es un panel del riel ni se abre con un botón;
//   · los diseños del negocio y «Nuevo diseño» son la lista de esa tarjeta (la «←»): el riel ya no tiene «Proyectos»;
//   · el crédito de Doory queda como franja fina al pie, visible en cada apertura (lo exige su licencia).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import Link, { useRouter } from '@/app/_ui/Link';
import { EditorApp, type EditorHandle } from '../_doory/editor';
import { registerCommand } from '../_doory/editor/extensions';
import type { EditorAdapter } from '../_doory/types/adapter';
import type { DoryDocument } from '../_doory/types/document';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { repositorioDe } from '../espacio';
import { crearAdaptadorNube } from '../mako/adaptadorNube';
import { mudarLocales } from '../mako/mudanza';
import { crearDiseno, leerDiseno } from '../mako/nube';
import { PanelMakoIA } from '../mako/chat/PanelMakoIA';
import { prenderQuitarFondo } from '../mako/quitar-fondo';
import { RUTA_CREAR, rutaDiseno } from '../ruta';
import styles from './pantalla.module.css';

type Abierto = { id: string; titulo: string; doc: DoryDocument; version: number };
type Carga = { estado: 'cargando' } | { estado: 'listo'; diseno: Abierto } | { estado: 'no-existe' } | { estado: 'error'; mensaje: string };

/** Lo que la pantalla de afuera (la lista de la tarjeta izquierda) puede pedirle al diseño abierto. */
export type EditorAbierto = {
  id: string;
  /** Cambiarle el nombre POR el editor: si fuera directo a la base, el próximo guardado chocaría con la versión (409). */
  renombrar: (titulo: string) => void;
  /** El documento como está en pantalla (con lo que todavía no se guardó), para «Duplicar». */
  documento: () => DoryDocument | null;
};

/** Cómo va la apertura: la tarjeta izquierda espera al editor para mostrar su chat. */
export type CargaEditor = 'cargando' | 'listo' | 'falla';

async function abrir(id: string, ws: number | null): Promise<Carga> {
  let r = await leerDiseno(id);
  // No está en la base: si lo tiene este navegador (etapa 1), se sube y se vuelve a leer.
  if (!r.ok && /no existe/i.test(r.error)) {
    const m = await mudarLocales(ws, id);
    if (m.mudados) r = await leerDiseno(id);
  }
  if (r.ok) return { estado: 'listo', diseno: { id: r.diseno.id, titulo: r.diseno.titulo, doc: r.diseno.doc as DoryDocument, version: r.diseno.version } };
  return /no existe/i.test(r.error) ? { estado: 'no-existe' } : { estado: 'error', mensaje: r.error };
}

export function PantallaEditor({ disenoId, ws, senales = null, ranuraChat = null, onAbierto, onCarga, onTitulo, salir = null }: {
  disenoId: string;
  ws: number | null;
  /** Lo que se sabe del negocio (lo lee la page): el panel de plantillas pone primero las sugeridas. */
  senales?: SenalesNegocio | null;
  /** El hueco de la tarjeta izquierda donde se dibuja el chat de MaKo del editor. */
  ranuraChat?: HTMLElement | null;
  onAbierto?: (a: EditorAbierto | null) => void;
  onCarga?: (c: CargaEditor) => void;
  /** El nombre cambió (en la barra del editor o desde la lista): la lista lo muestra sin volver a leer. */
  onTitulo?: (titulo: string) => void;
  /** A dónde lleva la «‹» de la barra del editor. Sólo el teléfono (el editor tapa toda la pantalla); en la computadora
   *  la lista de la tarjeta izquierda ya lleva a los otros diseños y a «Nuevo diseño». */
  salir?: string | null;
}) {
  const router = useRouter();
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  // El nombre que se le pasa al motor (`meta.title`): cambiarlo lo renombra y el guardado de siempre lo sube.
  const [titulo, setTitulo] = useState('');
  const editorRef = useRef<EditorHandle>(null);
  // «Quitar fondo» prendido (12/11/2026, ../mako/quitar-fondo.ts): registra el motor; el modelo se baja recién al usarlo.
  useEffect(() => { prenderQuitarFondo(); }, []);
  const avisos = useRef({ onAbierto, onCarga, onTitulo });
  useEffect(() => { avisos.current = { onAbierto, onCarga, onTitulo }; });

  useEffect(() => {
    let vivo = true;
    setCarga({ estado: 'cargando' });
    avisos.current.onCarga?.('cargando');
    void abrir(disenoId, ws).then((c) => {
      if (!vivo) return;
      if (c.estado === 'listo') setTitulo(c.diseno.titulo);
      setCarga(c);
      avisos.current.onCarga?.(c.estado === 'listo' ? 'listo' : c.estado === 'cargando' ? 'cargando' : 'falla');
    });
    return () => { vivo = false; };
  }, [disenoId, ws]);

  const listo = carga.estado === 'listo';
  // La lista de afuera renombra y duplica el diseño abierto POR acá. Y al irse (otro diseño de la lista, la barra
  // lateral), lo que estaba sin guardar se manda ANTES de que el motor se apague: `engine.stop()` suelta el guardado
  // pendiente sin mandarlo. Este efecto se limpia antes que el del EditorApp (React desmonta de arriba hacia abajo).
  useEffect(() => {
    if (!listo) return;
    const h = editorRef.current;
    avisos.current.onAbierto?.({
      id: disenoId,
      renombrar: (t) => { const limpio = t.trim(); if (limpio) { setTitulo(limpio); avisos.current.onTitulo?.(limpio); } },
      documento: () => editorRef.current?.getDocument() ?? null,
    });
    return () => {
      avisos.current.onAbierto?.(null);
      if (h?.isDirty()) void h.saveNow().catch(() => undefined);
    };
  }, [listo, disenoId]);

  // «Archivo → Crear un diseño nuevo» de Canva: el editor no sabe de rutas, así que la cáscara lo registra
  // como comando (TopBar lo muestra si existe). Va a la portada de la tab, «¿Qué vas a crear hoy?»; el `?ws=` lo pone el router.
  useEffect(
    () => registerCommand({ id: 'file.new', label: 'Crear un diseño nuevo', run: () => router.push(RUTA_CREAR) }),
    [router],
  );

  const version = useMemo(() => {
    let v = carga.estado === 'listo' ? carga.diseno.version : 1;
    return { get: () => v, set: (n: number) => { v = n; } };
  }, [carga]);

  const adapter = useMemo<EditorAdapter>(() => crearAdaptadorNube({
    id: disenoId,
    version,
    repoLocal: repositorioDe(ws),
    // «Copiar y redimensionar»: la copia es un diseño nuevo del workspace y se abre al toque.
    duplicar: async ({ title, document }) => {
      const r = await crearDiseno({ titulo: title, doc: document });
      if (!r.ok) throw new Error(r.error);
      router.push(rutaDiseno(r.id));
    },
    senales,
  }), [disenoId, version, ws, router, senales]);

  // Otra pestaña guardó este diseño en el medio (409). «Recargar» trae la última; «Guardar una copia»
  // guarda lo de ESTA pestaña como un diseño nuevo y lo abre, sin pisar a nadie.
  async function resolverConflicto(eleccion: 'reload' | 'save-as-copy') {
    if (eleccion === 'reload') { window.location.reload(); return; }
    const doc = editorRef.current?.getDocument();
    if (!doc) return;
    const r = await crearDiseno({ titulo: `${titulo || 'Diseño sin título'} (copia)`, doc });
    if (r.ok) window.location.href = rutaDiseno(r.id);
  }

  if (carga.estado === 'cargando') return <div className={styles.aviso}>Abriendo…</div>;
  if (carga.estado !== 'listo') {
    return (
      <div className={styles.aviso}>
        <p>{carga.estado === 'no-existe' ? 'Este diseño no existe o se eliminó.' : carga.mensaje}</p>
        <Link href={RUTA_CREAR} className={styles.volver}>Crear otro diseño</Link>
      </div>
    );
  }

  return (
    <div className={styles.pantalla}>
      <div className={styles.editor}>
        <EditorApp
          ref={editorRef}
          document={carga.diseno.doc}
          meta={{ id: carga.diseno.id, title: titulo || carga.diseno.titulo, mode: 'account', revision: carga.diseno.version }}
          adapter={adapter}
          onTitleChange={(t) => { setTitulo(t); onTitulo?.(t); }}
          onConflictResolve={(c) => void resolverConflicto(c)}
          topBarStart={salir ? (
            <Link href={salir} className={styles.inicio} data-testid="ie-inicio" aria-label="Volver a tus diseños">
              <ChevronLeft size={20} aria-hidden="true" />
            </Link>
          ) : undefined}
          dentro={ranuraChat ? createPortal(<PanelMakoIA />, ranuraChat) : null}
        />
      </div>
    </div>
  );
}
