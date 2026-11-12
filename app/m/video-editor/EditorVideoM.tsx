'use client';

// =============================================================================
// EditorVideoM — el editor de UN proyecto en el teléfono, como el editor de CapCut del celular
// =============================================================================
// Copiado de la estructura del editor de CapCut para el teléfono, a pantalla completa (con los colores de MaKo y su
// tema claro u oscuro desde el 29/10/2026, no el oscuro fijo de CapCut):
//   · arriba, ✕ (vuelve a los proyectos), el nombre y «Exportar»;
//   · el reproductor (el MISMO de escritorio: PreviewPanel del motor; su cabecera «Reproductor ≡» y su fila de abajo se
//     esconden, ./video-editor.css). Si al teléfono le falta el archivo de algún clip, encima va el aviso que lo nombra
//     con «Elegir» para volver a enlazarlo (ArchivosFaltantes, 12/11/2026: antes se veía negro y mudo);
//   · ▶ y el cabezal, para moverse por el video con el dedo;
//   · la tira de clips de la pista principal (tocar uno lo elige y lleva el cabezal a su inicio) y el «+» del final,
//     que agrega clips de la galería del teléfono, como el «+» de la línea de tiempo de CapCut;
//   · abajo, la barra de herramientas que se desliza: Dividir · Eliminar · Deshacer · Rehacer · Agregar.
//
// NINGUNA herramienta tiene lógica propia: cada una INVOCA la acción del motor que dispara escritorio con su atajo o
// su menú (`invokeAction('split')`, `'delete-selected'`, `'undo'`, `'redo'`), registradas por el EditorProvider
// (useEditorActions). Lo que el teléfono hace distinto es CÓMO se elige: sin línea de tiempo, se elige el clip en la
// tira. «Exportar» usa la exportación de un archivo del motor (`editor.project.export`, MP4 en alta) y al terminar
// ofrece guardarlo en el teléfono (la hoja de compartir del sistema, que en iOS tiene «Guardar video»).
// Lo que queda en la computadora (lo dice la fila del final): la línea de tiempo con todas sus pistas, texto,
// efectos, transiciones, audio, subtítulos y «Editar con IA».
//
// Como escritorio (app/video-editor/_opencut/editor-page.tsx): al salir se guarda el último cambio y la miniatura
// (`prepareExit`), y la copia de lectura para la API de MaKo se sube un rato después de cada cambio (`iniciarEspejo`).
// =============================================================================

// Todas las funciones de la copia de CapCut se registran antes del primer dibujo (como editor-page.tsx).
import '@/app/video-editor/ce/extensiones';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { TooltipProvider } from '@/app/video-editor/_opencut/components/ui/tooltip';
import { Toaster } from '@/app/video-editor/_opencut/components/ui/sonner';
import { EditorProvider } from '@/app/video-editor/_opencut/components/providers/editor-provider';
import { StoragePersistenceDialog } from '@/app/video-editor/_opencut/services/storage/components/storage-persistence-dialog';
import { PreviewPanel } from '@/app/video-editor/_opencut/preview/components';
import { useEditor } from '@/app/video-editor/_opencut/editor/use-editor';
import { invokeAction } from '@/app/video-editor/_opencut/actions';
import { importarArchivos } from '@/app/video-editor/_opencut/media/importar';
import { aceptaDelFaltante, archivosFaltantes, textoDelAviso, type ArchivoFaltante } from '@/app/video-editor/_opencut/media/archivos-faltantes';
import { reenlazarArchivo } from '@/app/video-editor/_opencut/media/reenlazar';
import { buildElementFromMedia } from '@/app/video-editor/_opencut/timeline/element-utils';
import { DEFAULT_NEW_ELEMENT_DURATION } from '@/app/video-editor/_opencut/timeline/creation';
import { mediaTimeFromSeconds, mediaTimeToSeconds, ZERO_MEDIA_TIME, type MediaTime } from '@/app/video-editor/_opencut/wasm';
import { DEFAULT_EXPORT_OPTIONS } from '@/app/video-editor/_opencut/export/defaults';
import { getExportMimeType } from '@/app/video-editor/_opencut/export';
import { nombreArchivo } from '@/app/video-editor/_opencut/export/destino';
import { iniciarEspejo } from '@/app/video-editor/_opencut/chat/espejo';
import { conEspacio } from '@/app/video-editor/espacio';
import { ID_PORTAL_CE } from '@/app/video-editor/portal';
import { ImportarDesde } from '@/app/video-editor/desde/ImportarDesde';
import { ArmarPlantilla } from '@/app/video-editor/plantilla/ArmarPlantilla';
import type { DesdeEditor } from '@/app/video-editor/desde/desde';
import type { EditorCore } from '@/app/video-editor/_opencut/core';

const RUTA_INICIO = '/m/video-editor';

/** «0:07» / «1:02:03», el reloj corto de CapCut del teléfono. */
function reloj(t: MediaTime): string {
  const s = Math.max(0, Math.floor(mediaTimeToSeconds({ time: t })));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Agrega los archivos al FINAL de la pista principal (las fotos y videos) o a su pista (la música). */
async function agregarAlFinal(editor: EditorCore, files: File[]): Promise<number> {
  const medios = await importarArchivos({ editor, files });
  const principal = editor.scenes.getActiveScene().tracks.main;
  for (const m of medios) {
    const duracion = m.duration != null ? mediaTimeFromSeconds({ seconds: m.duration }) : DEFAULT_NEW_ELEMENT_DURATION;
    const fin = editor.timeline.getTotalDuration();
    editor.timeline.insertElement({
      element: buildElementFromMedia({ mediaId: m.id, mediaType: m.type, name: m.name, duration: duracion, startTime: m.type === 'audio' ? ZERO_MEDIA_TIME : fin }),
      placement: m.type === 'audio' ? { mode: 'auto' } : { mode: 'explicit', trackId: principal.id },
    });
  }
  return medios.length;
}

export function EditorVideoM({ proyectoId, desde, plantilla }: { proyectoId: string; desde?: DesdeEditor; plantilla?: string | null }) {
  return (
    <div className="ce m-video-editor-ed">
      <TooltipProvider>
        <Toaster />
        {/* Los archivos viven en el navegador (OPFS): sin el permiso persistente, el del teléfono los puede borrar solo.
            La computadora lo pide en editor-page.tsx; el teléfono no lo pedía (12/11/2026: el video quedó negro). */}
        <StoragePersistenceDialog />
        {desde ? <ImportarDesde desde={desde} />
          : plantilla !== undefined ? <ArmarPlantilla id={plantilla} />
            : <EditorProvider projectId={proyectoId}><Editor /></EditorProvider>}
      </TooltipProvider>
      <div id={ID_PORTAL_CE} />
    </div>
  );
}

function Editor() {
  const editor = useEditor();
  const nombre = useEditor((e) => e.project.getActiveOrNull()?.metadata.name ?? '');
  const [exportando, setExportando] = useState(false);

  // Salir (por ✕ o por «atrás») deja guardados el último cambio y la miniatura, como editor-page.tsx. Si lo que
  // desmonta es un cambio de negocio, el espacio ya es otro y NO se guarda (escribiría en el almacenamiento ajeno).
  // La salida se mira una microtarea después: el doble montaje de desarrollo no es salir.
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    const espacio = conEspacio('');
    return () => {
      montado.current = false;
      if (conEspacio('') !== espacio) return;
      queueMicrotask(() => {
        if (montado.current) return;
        void editor.project.prepareExit().catch(() => {});
      });
    };
  }, [editor]);
  useEffect(() => iniciarEspejo(editor), [editor]);

  return (
    <>
      <header className="m-video-editor-barra">
        <Link href={RUTA_INICIO} className="m-video-editor-boton" aria-label="Cerrar el proyecto">
          <Icon name="x" size={22} />
        </Link>
        <span className="m-video-editor-barra__nombre">{nombre}</span>
        <button type="button" className="m-video-editor-exportar" onClick={() => setExportando(true)}>
          Exportar
        </button>
      </header>

      <div className="m-video-editor-escenario">
        <PreviewPanel overlayControls={[]} overlayInstances={[]} onOverlayVisibilityChange={() => {}} />
        <ArchivosFaltantes />
      </div>

      <Cabezal />
      <TiraClips />
      <Herramientas />
      <p className="m-video-editor-compu">Texto, efectos, audio y la línea de tiempo completa: en la computadora.</p>

      {exportando && <Exportar nombre={nombre} onCerrar={() => setExportando(false)} />}
    </>
  );
}

/** Los archivos que la línea usa y no están en este teléfono (media/archivos-faltantes.ts), uno por archivo. */
function useArchivosFaltantes(): ArchivoFaltante[] {
  const tracks = useEditor((e) => e.scenes.getActiveScene().tracks);
  const medios = useEditor((e) => e.media.getAssets());
  // Mientras carga la biblioteca está vacía: todo «faltaría» un instante.
  const cargando = useEditor((e) => e.media.isLoadingMedia());
  return useMemo(
    () => (cargando ? [] : archivosFaltantes(tracks, new Set(medios.map((m) => m.id)))),
    [tracks, medios, cargando],
  );
}

/**
 * El aviso de los archivos que faltan en este teléfono, ENCIMA del reproductor: si el navegador perdió el archivo de
 * un clip (el OPFS se vació y el proyecto en IndexedDB quedó), el reproductor quedaba negro y mudo sin decir nada
 * (producción, 12/11/2026). Nombra cada archivo con «Elegir», que abre la galería y lo vuelve a enlazar con el MISMO
 * medio (media/reenlazar.ts → MediaManager.reenlazarMedio): el clip conserva todo, el aviso se va y el video se ve.
 */
function ArchivosFaltantes() {
  const editor = useEditor();
  const faltan = useArchivosFaltantes();
  const entrada = useRef<HTMLInputElement>(null);
  const pedido = useRef<ArchivoFaltante | null>(null);
  const [enlazando, setEnlazando] = useState<string | null>(null);
  if (!faltan.length) return null;

  // El selector se abre en el mismo toque (si no, el navegador no lo abre), con el tipo del clip.
  const elegir = (f: ArchivoFaltante) => {
    const input = entrada.current;
    if (!input || enlazando) return;
    pedido.current = f;
    input.accept = aceptaDelFaltante(f.tipo);
    input.click();
  };
  const enlazar = async (file: File | undefined) => {
    const f = pedido.current;
    pedido.current = null;
    if (!file || !f) return;
    setEnlazando(f.mediaId);
    try { await reenlazarArchivo({ editor, mediaId: f.mediaId, tipo: f.tipo, file }); } finally { setEnlazando(null); }
  };
  const boton = (f: ArchivoFaltante, texto: string, clase: string) => (
    <button type="button" className={clase} disabled={enlazando !== null} aria-label={`Elegir ${f.nombre}`}
      onClick={() => elegir(f)}>
      {enlazando === f.mediaId ? <span className="mk-spin" aria-hidden /> : texto}
    </button>
  );

  return (
    <div className="m-video-editor-falta" role="alert">
      <p className="m-video-editor-falta__t">{textoDelAviso(faltan)}</p>
      {faltan.length === 1 ? boton(faltan[0], 'Elegir el archivo', 'm-video-editor-export__boton') : (
        <ul className="m-video-editor-falta__lista">
          {faltan.map((f) => (
            <li key={f.mediaId}>
              <span className="m-video-editor-falta__nombre">{f.nombre}</span>
              {boton(f, 'Elegir', 'm-video-editor-exportar')}
            </li>
          ))}
        </ul>
      )}
      <input ref={entrada} type="file" hidden
        onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void enlazar(file); }} />
    </div>
  );
}

/**
 * La fila de reproducir de CapCut del teléfono: ▶ y el cabezal, que se arrastra con el dedo (lo que en CapCut es
 * deslizar la línea de tiempo). Reemplaza la fila de abajo del reproductor de escritorio, que el teléfono esconde
 * (./video-editor.css: el tiempo en HH:MM:SS:FF y sus cuatro menús no entran en 390 px y se pisaban con ▶).
 */
function Cabezal() {
  const editor = useEditor();
  const reproduciendo = useEditor((e) => e.playback.getIsPlaying());
  const ahora = useEditor((e) => e.playback.getCurrentTime());
  const total = useEditor((e) => e.timeline.getTotalDuration());
  const max = Math.max(0, mediaTimeToSeconds({ time: total }));
  const valor = Math.min(max, mediaTimeToSeconds({ time: ahora }));
  return (
    <div className="m-video-editor-cabezal">
      {/* ▶ / ❚❚: la acción del motor (`invokeAction('toggle-play')`, la barra espaciadora de escritorio). */}
      <button type="button" className="m-video-editor-play" aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}
        disabled={max <= 0} onClick={() => invokeAction('toggle-play')}>
        <Icon name={reproduciendo ? 'pausa' : 'play'} size={22} />
      </button>
      <span className="m-video-editor-cabezal__t">{reloj(ahora)}</span>
      <input
        type="range"
        min={0}
        max={max || 0}
        step={0.04}
        value={valor}
        disabled={max <= 0}
        aria-label="Cabezal"
        onChange={(e) => editor.playback.seek({ time: mediaTimeFromSeconds({ seconds: Number(e.target.value) }) })}
      />
      <span className="m-video-editor-cabezal__t">{reloj(total)}</span>
    </div>
  );
}

/** La pista principal como tira de clips. Tocar uno lo elige (lo que Eliminar y Dividir usan) y va a su inicio. */
function TiraClips() {
  const editor = useEditor();
  const principal = useEditor((e) => e.scenes.getActiveScene().tracks.main);
  const medios = useEditor((e) => e.media.getAssets());
  const elegidos = useEditor((e) => e.selection.getSelectedElements());
  const total = useEditor((e) => e.timeline.getTotalDuration());
  const galeria = useRef<HTMLInputElement>(null);
  const [agregando, setAgregando] = useState(false);

  const faltan = useArchivosFaltantes();

  const miniatura = useMemo(() => new Map(medios.map((m) => [m.id, m.thumbnailUrl ?? null])), [medios]);
  const sinArchivo = useMemo(() => new Set(faltan.map((f) => f.mediaId)), [faltan]);
  const elegido = new Set(elegidos.map((r) => r.elementId));
  const totalSeg = Math.max(1, mediaTimeToSeconds({ time: total }));

  const agregar = async (files: File[]) => {
    if (!files.length || agregando) return;
    setAgregando(true);
    try { await agregarAlFinal(editor, files); } finally { setAgregando(false); }
  };

  return (
    <div className="m-video-editor-tira" data-m-sin-pull>
      {/* En el ORDEN DEL VIDEO, no en el del arreglo: el ⊕ de la computadora suelta en el cabezal y el imán lo pone ADELANTE
          sin moverlo en el arreglo. Medido el 12/11/2026: la tira decía toma-a, toma-b y el video empezaba con toma-b. */}
      {[...principal.elements].sort((a, b) => a.startTime - b.startTime).map((el) => {
        const seg = mediaTimeToSeconds({ time: el.duration });
        const mediaId = 'mediaId' in el && typeof el.mediaId === 'string' ? el.mediaId : null;
        const img = mediaId ? miniatura.get(mediaId) : null;
        // Sin su archivo en este teléfono: borde punteado de aviso (el aviso con «Elegir» va sobre el reproductor).
        const falta = mediaId !== null && sinArchivo.has(mediaId);
        const es = elegido.has(el.id);
        return (
          <button
            key={el.id}
            type="button"
            className="m-video-editor-clip"
            aria-pressed={es}
            data-falta={falta || undefined}
            aria-label={falta ? `${el.name}, falta el archivo` : `${el.name}, ${Math.round(seg)} segundos`}
            // El ancho dice cuánto dura (como la línea de tiempo), con un mínimo para poder tocarlo.
            style={{ flexBasis: `${Math.max(64, Math.round((seg / totalSeg) * 520))}px` }}
            onClick={() => {
              editor.selection.setSelectedElements({ elements: es ? [] : [{ trackId: principal.id, elementId: el.id }] });
              if (!es) editor.playback.seek({ time: el.startTime });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {img ? <img src={img} alt="" /> : <Icon name="video" size={18} />}
            <span className="m-video-editor-clip__seg">{Math.round(seg)}s</span>
          </button>
        );
      })}
      <input
        ref={galeria}
        type="file"
        accept="video/*,image/*,audio/*"
        multiple
        hidden
        onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void agregar(fs); }}
      />
      <button type="button" className="m-video-editor-mas-clip" aria-label="Agregar clips" disabled={agregando}
        onClick={() => galeria.current?.click()}>
        {agregando ? <span className="mk-spin" aria-hidden /> : <Icon name="plus" size={22} />}
      </button>
    </div>
  );
}

/** La barra de herramientas de abajo (la de CapCut del teléfono): cada una es la acción del motor. */
function Herramientas() {
  const hayElegido = useEditor((e) => e.selection.getSelectedElements().length > 0);
  const puedeDeshacer = useEditor((e) => e.command.canUndo());
  const puedeRehacer = useEditor((e) => e.command.canRedo());
  const herramientas: Array<{ id: string; label: string; icono: string; on: () => void; apagada?: boolean }> = [
    { id: 'dividir', label: 'Dividir', icono: 'tijera', on: () => invokeAction('split') },
    { id: 'eliminar', label: 'Eliminar', icono: 'trash', on: () => invokeAction('delete-selected'), apagada: !hayElegido },
    // La flecha circular del set: espejada es «deshacer», tal cual es «rehacer» (las dos de CapCut).
    { id: 'deshacer', label: 'Deshacer', icono: 'regenerar', on: () => invokeAction('undo'), apagada: !puedeDeshacer },
    { id: 'rehacer', label: 'Rehacer', icono: 'regenerar', on: () => invokeAction('redo'), apagada: !puedeRehacer },
  ];
  return (
    <nav className="m-video-editor-herramientas" aria-label="Herramientas" data-m-sin-pull>
      {herramientas.map((h) => (
        <button key={h.id} type="button" className="m-video-editor-herramienta" onClick={h.on} disabled={h.apagada}
          data-h={h.id}>
          <Icon name={h.icono} size={22} />
          <span>{h.label}</span>
        </button>
      ))}
    </nav>
  );
}

/**
 * «Exportar»: el MP4 en alta con la exportación de un archivo del motor, y después «Guardar en el teléfono» (la hoja
 * de compartir del sistema; un toque nuevo, porque el navegador no la abre si no viene de un toque) o descargarlo.
 */
function Exportar({ nombre, onCerrar }: { nombre: string; onCerrar: () => void }) {
  const editor = useEditor();
  const progreso = useEditor((e) => e.project.getExportState().progress);
  const [estado, setEstado] = useState<{ fase: 'exportando' } | { fase: 'listo'; archivo: File } | { fase: 'error'; mensaje: string }>({ fase: 'exportando' });
  const arrancado = useRef(false);

  useEffect(() => {
    if (arrancado.current) return;
    arrancado.current = true;
    void (async () => {
      const r = await editor.project.export({ options: DEFAULT_EXPORT_OPTIONS });
      if (r.cancelled) { onCerrar(); return; }
      if (!r.success || !r.buffer) { setEstado({ fase: 'error', mensaje: r.error || 'No se pudo exportar el video.' }); return; }
      const tipo = getExportMimeType({ format: DEFAULT_EXPORT_OPTIONS.format });
      setEstado({ fase: 'listo', archivo: new File([r.buffer], `${nombreArchivo(nombre || 'video')}.${DEFAULT_EXPORT_OPTIONS.format}`, { type: tipo }) });
    })();
  }, [editor, nombre, onCerrar]);

  const guardar = async (archivo: File) => {
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [archivo] })) {
      try { await nav.share({ files: [archivo], title: archivo.name }); return; } catch { /* cerró la hoja: queda la descarga */ }
    }
    const url = URL.createObjectURL(archivo);
    const a = document.createElement('a');
    a.href = url; a.download = archivo.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div className="m-video-editor-export" role="dialog" aria-modal="true" aria-label="Exportar">
      <div className="m-video-editor-export__caja">
        {estado.fase === 'exportando' && (
          <>
            <p className="m-video-editor-export__t">{`Exportando ${Math.round(progreso * 100)}%`}</p>
            <div className="m-video-editor-export__barra"><i style={{ width: `${Math.round(progreso * 100)}%` }} /></div>
            <p className="m-video-editor-export__nota">Deja esta pantalla abierta.</p>
            <button type="button" className="m-video-editor-export__boton m-video-editor-export__boton--sec" onClick={() => editor.project.cancelExport()}>
              Cancelar
            </button>
          </>
        )}
        {estado.fase === 'listo' && (
          <>
            <p className="m-video-editor-export__t">Tu video está listo</p>
            <button type="button" className="m-video-editor-export__boton" onClick={() => void guardar(estado.archivo)}>
              Guardar en el teléfono
            </button>
            <button type="button" className="m-video-editor-export__boton m-video-editor-export__boton--sec" onClick={onCerrar}>
              Seguir editando
            </button>
          </>
        )}
        {estado.fase === 'error' && (
          <>
            <p className="m-video-editor-export__t">{estado.mensaje}</p>
            <button type="button" className="m-video-editor-export__boton m-video-editor-export__boton--sec" onClick={onCerrar}>
              Volver al editor
            </button>
          </>
        )}
      </div>
    </div>
  );
}
