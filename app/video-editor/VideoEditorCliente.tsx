'use client';

// =============================================================================
// El Video Editor del lado del navegador: la pantalla de Create con el motor adentro
// =============================================================================
// Martín, 29/10/2026: «para todas las secciones de "create" no quiero otras tabs... Quiero que en las tabs de Editor e
// Image, pongas los colores de MaKo... En todas las tabs el mismo diseño de la barra lateral del chat de MaKo SIEMPRE
// abierto a la izquierda, y que los diferentes proyectos sean todos como en "Web generator"... En "nueva"... TEMPLATES con
// la sección de ¿Qué vas a crear hoy?». «No quiero paja, prefiero deprecar antes que conservar».
//
// Por eso la tab es la pantalla de Create (app/_crear/PantallaCrear.tsx), como todas:
//   · a la izquierda, la tarjeta que no se cierra. En la portada es el chat de MaKo (el Cerebro); con un proyecto abierto,
//     el chat «Editar con IA» del editor (_opencut/chat/PanelChat.tsx), que edita ESE proyecto. Su «←» da vuelta la
//     tarjeta a la lista de proyectos (los del navegador, ./proyectos.ts) con «Nuevo video» y el «⋯» de cada uno;
//   · al centro, sin proyecto, «¿Qué vas a crear hoy?» con las plantillas de «Nuevo video» (./plantillas-crear.ts: los
//     lienzos, «Generar con IA» y las plantillas de anuncio). La portada de CapCut se borró ese día;
//   · con proyecto, el editor de CapCut (el motor de OpenCut portado), o lo que arma uno nuevo: «Editar en el editor»
//     (`?desde=`, desde/ImportarDesde.tsx) y «Utilizar plantilla» (`?plantilla=`, plantilla/ArmarPlantilla.tsx).
//
// El motor usa `window`, IndexedDB, OPFS, WebGPU y un .wasm: entra por `dynamic(..., { ssr: false })`, que tiene que vivir
// en un client component (Next lo prohíbe en uno de server). La raíz lleva `.ce`: ahí viven los tokens del motor, que
// desde el 29/10 son los de MaKo (capcut-theme.css), y adentro `#ce-portal`, donde se montan los menús y diálogos de radix
// para que hereden esos tokens (ver portal.ts). Todo va adentro de `.ce`, también la tarjeta del chat: los avisos del
// motor (sonner) y sus diálogos (Renombrar) se dibujan desde ahí.
// =============================================================================

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import { PantallaCrear, type PlantillaCrear, type ProyectoCrear } from '@/app/_crear/PantallaCrear';
import { useRouter } from '@/app/_ui/Link';
import { TooltipProvider } from './_opencut/components/ui/tooltip';
import { Toaster } from './_opencut/components/ui/sonner';
import { RenameProjectDialog } from './_opencut/project/components/rename-project-dialog';
import { ID_PORTAL_CE } from './portal';
import { fijarEspacio } from './espacio';
import type { DesdeEditor } from './desde/desde';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { SenalesNegocioProvider } from './sugeridas';
import { EJEMPLOS_NUEVO_VIDEO, GENERAR_CON_IA, destinoDe, plantillasNuevoVideo, rutaDePlantilla } from './plantillas-crear';
import { ejemploDeVideo, type EjemploVideo } from '@/lib/editor-video/plantillas-ejemplos';
import { EjemploPlantillaVideo } from './EjemploPlantillaVideo';
import { cargarMotor, useProyectosVideo } from './proyectos';

const EditorPage = dynamic(() => import('./_opencut/editor-page').then((m) => m.EditorPage), { ssr: false });
// «Editar con IA»: el chat del editor, en la tarjeta izquierda y siempre abierto (antes, una columna a la derecha que se
// abría y cerraba con un botón de la barra superior).
const PanelChat = dynamic(() => import('./_opencut/chat/PanelChat').then((m) => m.PanelChat), { ssr: false });
// «Editar en el editor» de Video Generator (`?desde=`): baja el anuncio, arma el
// proyecto y recién ahí reemplaza la URL por la del proyecto (desde/ImportarDesde.tsx).
const ImportarDesde = dynamic(() => import('./desde/ImportarDesde').then((m) => m.ImportarDesde), { ssr: false });
// «Utilizar plantilla» (`?plantilla=`): proyecto nuevo, la plantilla armada, y recién
// ahí la URL del proyecto (plantilla/ArmarPlantilla.tsx).
const ArmarPlantilla = dynamic(() => import('./plantilla/ArmarPlantilla').then((m) => m.ArmarPlantilla), { ssr: false });

type Props = {
  vista: 'inicio' | 'editor';
  proyectoId?: string;
  ws: number | null;
  desde?: DesdeEditor;
  /** El id de `?plantilla=` ya validado; `null` si vino uno que no existe. */
  plantilla?: string | null;
  /** El `?propuesta=` del link (un uuid ya validado): el chat abre en ÉSA (chat/propuestas.ts). */
  propuesta?: string | null;
  /** Lo que se sabe del negocio: las plantillas sugeridas van primero (./sugeridas.tsx, ./plantillas-crear.ts). */
  senales?: SenalesNegocio | null;
};

export function VideoEditorCliente(props: Props) {
  const { ws, senales = null } = props;
  // El espacio local se fija ANTES de que el motor abra una sola base: el render
  // de este componente corre antes que el import dinámico de abajo. Y si la
  // pestaña cambia de cliente sin recargar, el EditorCore (un singleton) se
  // reinicia: si no, seguiría con el proyecto del cliente anterior en memoria.
  const wsPrevio = useRef<number | null | undefined>(undefined);
  if (wsPrevio.current !== ws) {
    if (wsPrevio.current !== undefined) void import('./_opencut/core').then((m) => m.EditorCore.reset());
    fijarEspacio(ws);
    wsPrevio.current = ws;
  }
  return (
    <div key={ws ?? 0} className="ce" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TooltipProvider>
        <Toaster />
        <SenalesNegocioProvider senales={senales}>
          <CrearVideo {...props} />
        </SenalesNegocioProvider>
      </TooltipProvider>
      <div id={ID_PORTAL_CE} />
    </div>
  );
}

/** El nombre de la copia: «1011 (1)» como CapCut (el motor la nombraría «(1) 1011»). */
async function duplicar(id: string, nombre: string, nombres: readonly string[]): Promise<void> {
  const [editor, { nombreLibre }] = await Promise.all([cargarMotor(), import('./_opencut/inicio/nombre')]);
  const [nuevo] = await editor.project.duplicateProjects({ ids: [id] });
  if (!nuevo) return;
  await editor.project.renameProject({ id: nuevo, name: nombreLibre(nombre.replace(/\s\(\d+\)$/, ''), nombres) });
}

function CrearVideo({ vista, proyectoId, desde, plantilla, propuesta = null, senales = null }: Props) {
  const router = useRouter();
  const editor = vista === 'editor' && !!proyectoId;
  // El proyecto abierto de verdad: mientras se importa o se arma uno (`?desde=`, `?plantilla=`), la URL dice «nuevo».
  const actual = editor && !desde && plantilla === undefined ? proyectoId : null;
  const { proyectos, error, reintentar } = useProyectosVideo(!editor);
  const [renombrando, setRenombrando] = useState<{ id: string; nombre: string } | null>(null);

  const lista = useMemo((): ProyectoCrear[] | null => {
    if (!proyectos) return null;
    const nombres = proyectos.map((p) => p.name);
    return proyectos.map((p) => ({
      id: p.id,
      nombre: p.name,
      href: `/video-editor/${p.id}`,
      cuando: new Date(p.updatedAt).getTime(),
      menu: [
        { rotulo: 'Cambiar nombre', hacer: () => setRenombrando({ id: p.id, nombre: p.name }) },
        { rotulo: 'Duplicar', hacer: () => duplicar(p.id, p.name, nombres) },
        {
          rotulo: 'Eliminar',
          peligro: true,
          confirmar: `¿Eliminar «${p.name}»? Se borra de este navegador y no se puede deshacer.`,
          hacer: async () => {
            const motor = await cargarMotor();
            await motor.project.deleteProjects({ ids: [p.id] });
            // El abierto se fue: se vuelve a «¿Qué vas a crear hoy?».
            if (p.id === actual) router.push('/video-editor');
          },
        },
      ],
    }));
  }, [proyectos, actual, router]);

  const plantillas = useMemo(() => plantillasNuevoVideo(senales), [senales]);
  // «Ver ejemplo» de una plantilla de anuncio (6/11/2026): el ejemplo ficticio como guion de rodaje, aparte.
  const [ejemplo, setEjemplo] = useState<{ id: string; nombre: string; e: EjemploVideo } | null>(null);
  const verEjemplo = (pl: PlantillaCrear) => {
    const d = destinoDe(pl.id);
    const e = d?.tipo === 'plantilla' ? ejemploDeVideo(d.id) : null;
    if (d?.tipo === 'plantilla' && e) setEjemplo({ id: d.id, nombre: pl.nombre, e });
  };

  const usarPlantilla = async (pl: PlantillaCrear): Promise<string | null> => {
    const d = destinoDe(pl.id);
    if (!d) return 'Esa plantilla ya no existe.';
    if (d.tipo === 'ia') { router.push(GENERAR_CON_IA.escritorio); return null; }
    if (d.tipo === 'plantilla') { router.push(rutaDePlantilla(d.id)); return null; }
    // Un lienzo vacío: el proyecto nuevo con ese tamaño, guardado, y recién ahí el editor (lo mismo que «Nuevo proyecto»
    // del Menú del editor, components/editor/editor-header.tsx, más el tamaño).
    const [motor, { nombreProyectoNuevo }] = await Promise.all([cargarMotor(), import('./_opencut/inicio/nombre')]);
    if (motor.project.getActiveOrNull()) await motor.project.prepareExit().catch(() => {});
    const id = await motor.project.createNewProject({ name: await nombreProyectoNuevo() });
    await motor.project.updateSettings({ settings: d.lienzo, pushHistory: false });
    await motor.project.saveCurrentProject();
    router.push(`/video-editor/${id}`);
    return null;
  };

  const pieza = !editor ? null
    : desde ? <ImportarDesde desde={desde} />
      : plantilla !== undefined ? <ArmarPlantilla id={plantilla} />
        : <EditorPage projectId={proyectoId} propuesta={propuesta} />;

  return (
    <>
      <PantallaCrear
        tab="Video"
        nuevo="Nuevo video"
        proyectos={lista}
        errorProyectos={error}
        onReintentar={reintentar}
        actual={actual}
        plantillas={plantillas}
        onPlantilla={usarPlantilla}
        onVerEjemplo={verEjemplo}
        ejemplos={EJEMPLOS_NUEVO_VIDEO}
        chat={editor ? (volver) => <PanelChat volver={volver} /> : undefined}
        // El editor necesita el ancho (29/10/2026: la barra cortaba «Transicio…» y el reproductor quedaba chico): el chat se pliega.
        plegable
      >
        {pieza}
      </PantallaCrear>
      {ejemplo && (
        <EjemploPlantillaVideo nombre={ejemplo.nombre} e={ejemplo.e} alSalir={() => setEjemplo(null)}
          alUsar={() => { const id = ejemplo.id; setEjemplo(null); router.push(rutaDePlantilla(id)); }} />
      )}
      {renombrando && (
        <RenameProjectDialog
          isOpen
          onOpenChange={(abierto) => { if (!abierto) setRenombrando(null); }}
          projectName={renombrando.nombre}
          onConfirm={(nombre) => {
            const { id } = renombrando;
            setRenombrando(null);
            void cargarMotor().then((m) => m.project.renameProject({ id, name: nombre }));
          }}
        />
      )}
    </>
  );
}
