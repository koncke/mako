'use client';

// =============================================================================
// InicioVideoM — el inicio del Video Editor en el teléfono, como el de CapCut del celular
// =============================================================================
// Copiado de la app de CapCut para el teléfono (su pantalla de inicio): arriba el botón grande «Nuevo proyecto»,
// que abre la galería del teléfono para elegir los clips; abajo «Proyectos», una fila por proyecto con su
// miniatura, el nombre y «tamaño | duración», y su «⋯» con Renombrar y Eliminar. En CapCut del teléfono, «Nuevo
// proyecto» va DIRECTO a elegir los clips y los pone uno detrás del otro: acá igual (`crearConClips`).
//
// Los proyectos son los del MISMO motor y el MISMO almacenamiento que escritorio (OpenCut: IndexedDB/OPFS del
// navegador, separados por negocio). Por eso cada aparato tiene los suyos: lo que se hizo en la computadora se abre
// allá, y lo de este teléfono, acá (lo dice la fila de la computadora del final).
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { useEditor } from '@/app/video-editor/_opencut/editor/use-editor';
import { importarArchivos } from '@/app/video-editor/_opencut/media/importar';
import { buildElementFromMedia } from '@/app/video-editor/_opencut/timeline/element-utils';
import { DEFAULT_NEW_ELEMENT_DURATION } from '@/app/video-editor/_opencut/timeline/creation';
import { addMediaTime, mediaTimeFromSeconds, ZERO_MEDIA_TIME } from '@/app/video-editor/_opencut/wasm';
import { nombreLibre, nombreProyectoNuevo } from '@/app/video-editor/_opencut/inicio/nombre';
import { formatoDuracionTarjeta, formatoPeso, useTamanoProyecto } from '@/app/video-editor/_opencut/inicio/tamano';
import type { TProjectMetadata } from '@/app/video-editor/_opencut/project/types';
import type { EditorCore } from '@/app/video-editor/_opencut/core';
import {
  ComputadoraM, FilaM, ListaM, PieM, SeccionM, SheetM, SkeletonFilas, VacioM, useToastM,
} from '@/app/m/_ui';
import { CampoM, ErrorLineaM } from '../_creacion/escritor';

const rutaProyecto = (id: string) => `/m/video-editor/${encodeURIComponent(id)}`;

/**
 * Proyecto nuevo con los clips elegidos, uno detrás del otro en la pista principal (lo que hace «Nuevo proyecto» de
 * CapCut del teléfono). El orden de los pasos es el de «Editar en el editor» (app/video-editor/desde/ImportarDesde):
 * proyecto, archivos a Multimedia por el camino de «Importar», clips en la pista principal y guardar. Si nada se pudo
 * importar, el proyecto vacío se borra: un proyecto fantasma en la lista se lee como «ya lo hice».
 */
async function crearConClips(editor: EditorCore, files: File[], alAvanzar: (pct: number) => void): Promise<string> {
  const id = await editor.project.createNewProject({ name: await nombreProyectoNuevo() });
  try {
    const medios = await importarArchivos({ editor, files, onProgress: alAvanzar });
    if (medios.length === 0) throw new Error('No se importó ningún archivo');
    const principal = editor.scenes.getActiveScene().tracks.main;
    let inicio = ZERO_MEDIA_TIME;
    for (const m of medios) {
      const duracion = m.duration != null ? mediaTimeFromSeconds({ seconds: m.duration }) : DEFAULT_NEW_ELEMENT_DURATION;
      editor.timeline.insertElement({
        element: buildElementFromMedia({ mediaId: m.id, mediaType: m.type, name: m.name, duration: duracion, startTime: m.type === 'audio' ? ZERO_MEDIA_TIME : inicio }),
        // La música va a su pista; la imagen y el video, en fila en la principal.
        placement: m.type === 'audio' ? { mode: 'auto' } : { mode: 'explicit', trackId: principal.id },
      });
      if (m.type !== 'audio') inicio = addMediaTime({ a: inicio, b: duracion });
    }
    await editor.project.saveCurrentProject();
    return id;
  } catch (e) {
    await editor.project.deleteProjects({ ids: [id] }).catch(() => {});
    throw e;
  }
}

function fecha(d: Date | string): string {
  try { return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); } catch { return ''; }
}

/** Una fila de «Proyectos»: la miniatura 9:16, el nombre, la fecha y «tamaño | duración» (como CapCut). */
function FilaProyecto({ p, onMas }: { p: TProjectMetadata; onMas: () => void }) {
  const bytes = useTamanoProyecto(p);
  return (
    <FilaM
      leading={(
        <span className="m-video-editor-mini" aria-hidden>
          <Icon name="video" size={18} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.thumbnail && <img src={p.thumbnail} alt="" />}
        </span>
      )}
      titulo={p.name}
      segunda={`${fecha(p.updatedAt)} · ${bytes == null ? '…' : formatoPeso(bytes)} | ${formatoDuracionTarjeta(p.duration)}`}
      href={rutaProyecto(p.id)}
      control={(
        <button type="button" className="m-video-editor-mas" aria-label={`Más opciones de ${p.name}`} onClick={onMas}>
          <Icon name="mas" size={20} />
        </button>
      )}
    />
  );
}

export function InicioVideoM() {
  const editor = useEditor();
  const router = useRouter();
  const toast = useToastM();
  const cargando = useEditor((e) => e.project.getIsLoading() || !e.project.getIsInitialized());
  const proyectos = useEditor((e) => e.project.getFilteredAndSortedProjects({ searchQuery: '', sortOption: 'updatedAt-desc' }));
  const galeria = useRef<HTMLInputElement>(null);
  const [creando, setCreando] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [hoja, setHoja] = useState<'proyecto' | 'renombrar' | null>(null);
  // El proyecto de la hoja queda puesto mientras la hoja se va (LEEME.md).
  const [elegido, setElegido] = useState<TProjectMetadata | null>(null);
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!editor.project.getIsInitialized()) void editor.project.loadAllProjects();
  }, [editor.project]);

  const alElegir = async (files: File[]) => {
    if (files.length === 0 || creando != null) return;
    setError(''); setCreando(0);
    try {
      const id = await crearConClips(editor, files, (pct) => setCreando(Math.round(pct)));
      // `creando` queda prendido: la pantalla se va, y un segundo toque no arma otro proyecto.
      router.push(rutaProyecto(id));
    } catch {
      setError('No se pudieron importar esos archivos. Prueba con otros videos o fotos.');
      setCreando(null);
    }
  };

  const renombrar = async () => {
    if (!elegido || !nombre.trim() || ocupado) return;
    setOcupado(true);
    try {
      const otros = proyectos.filter((p) => p.id !== elegido.id).map((p) => p.name);
      await editor.project.renameProject({ id: elegido.id, name: nombreLibre(nombre.trim(), otros) });
      setHoja(null);
      toast('Proyecto renombrado');
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = async () => {
    if (!elegido || ocupado) return;
    setOcupado(true);
    try {
      await editor.project.deleteProjects({ ids: [elegido.id] });
      setHoja(null);
      toast('Proyecto eliminado');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <input
        ref={galeria}
        type="file"
        accept="video/*,image/*"
        multiple
        hidden
        onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void alElegir(fs); }}
      />
      <button type="button" className="m-video-editor-nuevo" disabled={creando != null}
        onClick={() => galeria.current?.click()}>
        {creando != null
          ? <><span className="mk-spin" aria-hidden /><span>{creando > 0 ? `Importando ${creando}%` : 'Importando…'}</span></>
          : <><Icon name="plus" size={24} /><span>Nuevo proyecto</span></>}
      </button>
      {error && <ErrorLineaM>{error}</ErrorLineaM>}

      {cargando ? (
        <SkeletonFilas filas={3} />
      ) : proyectos.length === 0 ? (
        <VacioM frase="Todavía no hay proyectos en este teléfono." />
      ) : (
        <SeccionM titulo="Proyectos">
          <ListaM>
            {proyectos.map((p) => (
              <FilaProyecto key={p.id} p={p} onMas={() => { setElegido(p); setNombre(p.name); setHoja('proyecto'); }} />
            ))}
          </ListaM>
        </SeccionM>
      )}

      <ComputadoraM que="Los proyectos de la computadora y la línea de tiempo completa" />

      <SheetM
        id="proyecto"
        abierto={hoja === 'proyecto' && elegido != null}
        onCerrar={() => setHoja(null)}
        titulo={elegido?.name ?? 'Proyecto'}
        ocupado={ocupado}
        rotuloCerrar="Cerrar"
        pie={elegido ? (
          <PieM consecuencia="Eliminarlo lo borra de este teléfono.">
            <Button variant="primary" size="lg" full onClick={() => router.push(rutaProyecto(elegido.id))}>Abrir el proyecto</Button>
            <Button variant="secondary" size="lg" full onClick={() => setHoja('renombrar')}>Renombrar</Button>
            <Button variant="danger" size="lg" full icon={<Icon name="trash" size={18} />} loading={ocupado} onClick={() => void eliminar()}>
              Eliminar el proyecto
            </Button>
          </PieM>
        ) : undefined}
      />

      <SheetM
        id="renombrar"
        abierto={hoja === 'renombrar' && elegido != null}
        onCerrar={() => setHoja(null)}
        titulo="Renombrar"
        ocupado={ocupado}
        rotuloCerrar="Cerrar"
        pie={(
          <PieM>
            <Button variant="primary" size="lg" full loading={ocupado} disabled={!nombre.trim()} onClick={() => void renombrar()}>
              Guardar el nombre
            </Button>
          </PieM>
        )}
      >
        <CampoM valor={nombre} onCambio={setNombre} etiqueta="Nombre del proyecto" filas={1} />
      </SheetM>

    </>
  );
}
