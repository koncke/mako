'use client';

// =============================================================================
// InicioVideoM — la tab Video en el teléfono: «Nuevo video» y los proyectos de este teléfono
// =============================================================================
// Martín, 29/10/2026: «En "nueva"... TEMPLATES con la sección de ¿Qué vas a crear hoy?», «para todas las secciones de
// "create" no quiero otras tabs» y «En la computadora Y en el teléfono». Arriba, el botón grande «Nuevo video», que abre
// «¿Qué vas a crear hoy?» con las MISMAS tarjetas que la computadora (app/video-editor/plantillas-crear.ts) y con su
// mismo dibujo (las clases de app/_crear/crear.css):
//   · un LIENZO (Reel, YouTube, Cuadrado, Post) abre la galería del teléfono y arma el proyecto con los clips elegidos,
//     uno detrás del otro, en ese tamaño (lo que hace «Nuevo proyecto» de CapCut del teléfono: va DIRECTO a los clips);
//   · «Generar con IA», el Video Generator del teléfono (/m/video);
//   · una plantilla de anuncio, armada en un proyecto nuevo (`?plantilla=`).
// En la computadora la caja de «¿Qué vas a crear hoy?» le escribe al chat de MaKo que está al lado; acá ese chat es otra
// pantalla, así que va «Pídeselo a MaKo», que lleva a él (como Ads del teléfono).
// Abajo, «Proyectos»: una fila por proyecto con su miniatura, el nombre y «tamaño | duración», y su «⋯» con Renombrar y
// Eliminar.
//
// Los proyectos son los del MISMO motor y el MISMO almacenamiento que escritorio (OpenCut: IndexedDB/OPFS del
// navegador, separados por negocio). Por eso cada aparato tiene los suyos: lo que se hizo en la computadora se abre
// allá, y lo de este teléfono, acá (lo dice la fila de la computadora del final).
// =============================================================================

import '@/app/_crear/crear.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { cajaDeMiniatura, marcoDe } from '@/app/_crear/reglas';
import { TITULO_CAJA } from '@/app/web-generator/CajaPedido';
import { useEditor } from '@/app/video-editor/_opencut/editor/use-editor';
import { importarArchivos } from '@/app/video-editor/_opencut/media/importar';
import { buildElementFromMedia } from '@/app/video-editor/_opencut/timeline/element-utils';
import { DEFAULT_NEW_ELEMENT_DURATION } from '@/app/video-editor/_opencut/timeline/creation';
import { addMediaTime, mediaTimeFromSeconds, ZERO_MEDIA_TIME } from '@/app/video-editor/_opencut/wasm';
import { nombreLibre, nombreProyectoNuevo } from '@/app/video-editor/_opencut/inicio/nombre';
import { formatoDuracionTarjeta, formatoPeso, useTamanoProyecto } from '@/app/video-editor/_opencut/inicio/tamano';
import type { TProjectMetadata } from '@/app/video-editor/_opencut/project/types';
import type { EditorCore } from '@/app/video-editor/_opencut/core';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { GENERAR_CON_IA, PERSONAJE_CON_IA, destinoDe, plantillasNuevoVideo, rutaDePlantilla, sinGuiadas, type LienzoNuevo } from '@/app/video-editor/plantillas-crear';
import {
  ComputadoraM, FilaM, ListaM, PieM, SeccionM, SheetM, SkeletonFilas, VacioM, useToastM,
} from '@/app/m/_ui';
import { CampoM, ErrorLineaM } from '../_creacion/escritor';

const rutaProyecto = (id: string) => `/m/video-editor/${encodeURIComponent(id)}`;

/**
 * Proyecto nuevo en el tamaño elegido con los clips elegidos, uno detrás del otro en la pista principal (lo que hace
 * «Nuevo proyecto» de CapCut del teléfono). El orden de los pasos es el de «Editar en el editor»
 * (app/video-editor/desde/ImportarDesde): proyecto, tamaño, archivos a Multimedia por el camino de «Importar», clips en la
 * pista principal y guardar. El tamaño va ANTES de los clips: con la proporción fijada, el primer clip no lo pisa. Si nada
 * se pudo importar, el proyecto vacío se borra: un proyecto fantasma en la lista se lee como «ya lo hice».
 */
async function crearConClips(editor: EditorCore, files: File[], lienzo: LienzoNuevo, alAvanzar: (pct: number) => void): Promise<string> {
  const id = await editor.project.createNewProject({ name: await nombreProyectoNuevo() });
  try {
    await editor.project.updateSettings({ settings: lienzo, pushHistory: false });
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

export function InicioVideoM({ senales = null }: { senales?: SenalesNegocio | null }) {
  const editor = useEditor();
  const router = useRouter();
  const toast = useToastM();
  const cargando = useEditor((e) => e.project.getIsLoading() || !e.project.getIsInitialized());
  const proyectos = useEditor((e) => e.project.getFilteredAndSortedProjects({ searchQuery: '', sortOption: 'updatedAt-desc' }));
  // Sin las guiadas: su guía vive en el chat del editor de la computadora (docs/relevo/nube-tab-video.md §4).
  const plantillas = useMemo(() => sinGuiadas(plantillasNuevoVideo(senales)), [senales]);
  const galeria = useRef<HTMLInputElement>(null);
  // El lienzo elegido en «Nuevo video», mientras la galería está abierta.
  const lienzo = useRef<LienzoNuevo | null>(null);
  const [creando, setCreando] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [hoja, setHoja] = useState<'nuevo' | 'proyecto' | 'renombrar' | null>(null);
  // El proyecto de la hoja queda puesto mientras la hoja se va (LEEME.md).
  const [elegido, setElegido] = useState<TProjectMetadata | null>(null);
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!editor.project.getIsInitialized()) void editor.project.loadAllProjects();
  }, [editor.project]);

  /** Una tarjeta de «¿Qué vas a crear hoy?». La galería se abre EN el toque (fuera de él, el teléfono no la deja abrir). */
  const usar = (id: string) => {
    const d = destinoDe(id);
    if (!d) return;
    if (d.tipo === 'ia') { router.push(GENERAR_CON_IA.movil); return; }
    if (d.tipo === 'personaje') { router.push(PERSONAJE_CON_IA.movil); return; }
    if (d.tipo === 'plantilla') { router.push(rutaDePlantilla(d.id, true)); return; }
    // Las guiadas no se ofrecen acá (`sinGuiadas`): la guía vive en el chat del editor de la computadora.
    if (d.tipo === 'guia') return;
    lienzo.current = d.lienzo;
    setHoja(null);
    galeria.current?.click();
  };

  const alElegir = async (files: File[]) => {
    const tamano = lienzo.current;
    if (files.length === 0 || creando != null || !tamano) return;
    setError(''); setCreando(0);
    try {
      const id = await crearConClips(editor, files, tamano, (pct) => setCreando(Math.round(pct)));
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
      <button type="button" className="m-video-editor-nuevo" disabled={creando != null} onClick={() => setHoja('nuevo')}>
        {creando != null
          ? <><span className="mk-spin" aria-hidden /><span>{creando > 0 ? `Importando ${creando}%` : 'Importando…'}</span></>
          : <><Icon name="plus" size={24} /><span>Nuevo video</span></>}
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

      <SheetM id="nuevo" abierto={hoja === 'nuevo'} onCerrar={() => setHoja(null)} titulo={TITULO_CAJA} snap="alto" rotuloCerrar="Cerrar">
        <div className="m-video-editor-plantillas">
          <button type="button" className="m-video-editor-pedir" onClick={() => router.push('/m/mako')}>
            <Icon name="mako" size={18} /><span>Pídeselo a MaKo</span>
          </button>
          <div className="cr-plantillas__grilla">
            {plantillas.map((pl) => (
              <button key={pl.id} type="button" className="cr-plantilla" onClick={() => usar(pl.id)} aria-label={`Usar la plantilla ${pl.nombre}`}>
                <span className="cr-plantilla__mini" style={{ aspectRatio: '4 / 3' }}>
                  {/* Con imagen, la imagen a SU proporción, como TarjetaPlantilla en la computadora (11/11/2026): acá se dibujaba
                      siempre el marco, y «Tu personaje con IA» seguía siendo un marco vacío en el teléfono. */}
                  {pl.imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pl.imagen} alt="" loading="lazy" style={cajaDeMiniatura(pl.formato) ?? undefined} data-caja={cajaDeMiniatura(pl.formato) ? 'si' : undefined} />
                  ) : (
                    <>
                      <span className="cr-plantilla__marco" style={marcoDe(pl.formato)} />
                      {pl.rotulo ? <span className="cr-plantilla__rotulo">{pl.rotulo}</span> : null}
                    </>
                  )}
                </span>
                <span className="cr-plantilla__nombre">{pl.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      </SheetM>

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
