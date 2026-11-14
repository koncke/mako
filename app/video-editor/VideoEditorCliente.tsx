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
import { useEffect, useMemo, useRef, useState } from 'react';
import { PantallaCrear, type PlantillaCrear, type ProyectoCrear } from '@/app/_crear/PantallaCrear';
import { useRouter } from '@/app/_ui/Link';
import { toast } from 'sonner';
import { TooltipProvider } from './_opencut/components/ui/tooltip';
import { Toaster } from './_opencut/components/ui/sonner';
import { RenameProjectDialog } from './_opencut/project/components/rename-project-dialog';
import { ID_PORTAL_CE } from './portal';
import { fijarEspacio } from './espacio';
import type { DesdeEditor } from './desde/desde';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { SenalesNegocioProvider } from './sugeridas';
import { cambiarHilo, conId } from './_opencut/chat/hilo';
import { recetaDe, textoDeReceta } from '@/lib/video-recetas';
import type { Plantilla } from '@/lib/editor-video/plantillas';
import { EJEMPLOS_NUEVO_VIDEO, GENERAR_CON_IA, LIENZO_GUIADO, PERSONAJE_CON_IA, destinoDe, plantillasNuevoVideo, rutaDePlantilla, type LienzoNuevo } from './plantillas-crear';
import { empezarGuia } from './guia/estado';
import { RUTA_CREAR_VIDEO } from './vista';
import { ejemploDeVideo, type EjemploVideo } from '@/lib/editor-video/plantillas-ejemplos';
import { EjemploPlantillaVideo } from './EjemploPlantillaVideo';
import { cargarMotor, useProyectosVideo } from './proyectos';

// ⚠️ Todo lo que se carga a pedido entra por UNA puerta (./editor-cargado.ts): un `import()` por cada pieza bajaba y
// compilaba el núcleo del motor TRES veces (12/11/2026, «se me traba exageradamente todo»).
const EditorPage = dynamic(() => import('./editor-cargado').then((m) => m.EditorPage), { ssr: false });
// «Editar con IA»: el chat del editor, en la tarjeta izquierda y siempre abierto (antes, una columna a la derecha que se
// abría y cerraba con un botón de la barra superior).
const PanelChat = dynamic(() => import('./editor-cargado').then((m) => m.PanelChat), { ssr: false });
// «Editar en el editor» de Video Generator (`?desde=`): baja el anuncio, arma el
// proyecto y recién ahí reemplaza la URL por la del proyecto (desde/ImportarDesde.tsx).
const ImportarDesde = dynamic(() => import('./editor-cargado').then((m) => m.ImportarDesde), { ssr: false });
// «Utilizar plantilla» (`?plantilla=`): proyecto nuevo, la plantilla armada, y recién
// ahí la URL del proyecto (plantilla/ArmarPlantilla.tsx).
const ArmarPlantilla = dynamic(() => import('./editor-cargado').then((m) => m.ArmarPlantilla), { ssr: false });

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
  /** El «Replicar» de un outlier (`?replicar=`, ya validado en ./vista.ts): arma ese proyecto guiado al abrir. */
  replicar?: string | null;
  /**
   * Al entrar a la tab sin pedir nada (./vista.ts → `abreElEditor`): 'editor' abre el lienzo de edición (el último proyecto, o
   * uno vertical nuevo). Martín, 11/11/2026: «que se note que ahí se editan videos antes de que ahí sean full Outliers».
   */
  alEntrar?: 'editor' | 'crear';
  /** El «Replicar» de una receta (`?receta=`, validado en ./vista.ts): arma su proyecto y MaKo la dice en el chat. */
  receta?: string | null;
  /**
   * «Abrir en el editor» de un video DESARMADO (`?desarme=`, ticket 97): la plantilla «toca para reemplazar» y la receta para el
   * chat, armadas en el server con lo que guardó este negocio (./[proyecto]/page.tsx). `null` = ese video no está desarmado.
   */
  desarmado?: { plantilla: Plantilla; mensaje: string } | null;
};

export function VideoEditorCliente(props: Props) {
  const { ws, senales = null } = props;
  // El espacio local se fija ANTES de que el motor abra una sola base: el render
  // de este componente corre antes que el import dinámico de abajo. Y si la
  // pestaña cambia de cliente sin recargar, el EditorCore (un singleton) se
  // reinicia: si no, seguiría con el proyecto del cliente anterior en memoria.
  const wsPrevio = useRef<number | null | undefined>(undefined);
  if (wsPrevio.current !== ws) {
    if (wsPrevio.current !== undefined) void import('./editor-cargado').then((m) => m.EditorCore.reset());
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

/**
 * Un proyecto nuevo con ese tamaño, guardado, y su id (lo mismo que «Nuevo proyecto» del Menú del editor,
 * components/editor/editor-header.tsx, más el tamaño). Sin nombre, el de siempre («1011»); con nombre, ése, sin repetir.
 */
async function proyectoConLienzo(lienzo: LienzoNuevo, nombre?: string): Promise<string> {
  const [motor, { nombreProyectoNuevo, nombreProyectoLibre }] = await Promise.all([cargarMotor(), import('./editor-cargado')]);
  if (motor.project.getActiveOrNull()) await motor.project.prepareExit().catch(() => {});
  const id = await motor.project.createNewProject({ name: nombre ? await nombreProyectoLibre(nombre) : await nombreProyectoNuevo() });
  await motor.project.updateSettings({ settings: lienzo, pushHistory: false });
  await motor.project.saveCurrentProject();
  return id;
}

/** El nombre de la copia: «1011 (1)» como CapCut (el motor la nombraría «(1) 1011»). */
async function duplicar(id: string, nombre: string, nombres: readonly string[]): Promise<void> {
  const [editor, { nombreLibre }] = await Promise.all([cargarMotor(), import('./editor-cargado')]);
  const [nuevo] = await editor.project.duplicateProjects({ ids: [id] });
  if (!nuevo) return;
  await editor.project.renameProject({ id: nuevo, name: nombreLibre(nombre.replace(/\s\(\d+\)$/, ''), nombres) });
}

function CrearVideo({ vista, proyectoId, desde, plantilla, propuesta = null, senales = null, replicar = null, alEntrar = 'crear', receta = null, desarmado }: Props) {
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
            if (p.id === actual) router.push(RUTA_CREAR_VIDEO);
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
    if (d.tipo === 'personaje') { router.push(PERSONAJE_CON_IA.escritorio); return null; }
    if (d.tipo === 'plantilla') { router.push(rutaDePlantilla(d.id)); return null; }
    if (d.tipo === 'guia') return crearGuiada(d, false);
    router.push(`/video-editor/${await proyectoConLienzo(d.lienzo)}`);
    return null;
  };

  /**
   * Una plantilla GUIADA (9/11/2026): el proyecto vertical con su nombre, marcado como de esa plantilla ANTES de abrirlo (el
   * chat del editor lo lee al montar y MaKo arranca con su primer paso: ./guia/GuiaEnElChat.tsx). Desde «Replicar» la URL se
   * REEMPLAZA: con «Atrás» se volvería a `?replicar=` y se armaría otro.
   */
  // Uno a la vez: un doble clic en la tarjeta (o la tarjeta y «Replicar» juntos) armaba DOS proyectos (la revisión del 9/11/2026).
  const creando = useRef(false);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const crearGuiada = async (d: { id: string; lienzo: LienzoNuevo; nombre: string }, reemplazar: boolean): Promise<string | null> => {
    if (creando.current) return null;
    creando.current = true;
    try {
      const id = await proyectoConLienzo(d.lienzo, d.nombre);
      empezarGuia(id, d.id);
      // La persona se fue a otra pantalla mientras se armaba: el proyecto queda en la lista, sin arrastrarla de vuelta.
      if (!montado.current) return null;
      if (reemplazar) router.replace(`/video-editor/${id}`); else router.push(`/video-editor/${id}`);
      return null;
    } catch {
      return 'No pude armar el proyecto. Vuelve a intentar.';
    } finally {
      creando.current = false;
    }
  };
  const replicado = useRef(false);
  useEffect(() => {
    if (!replicar || replicado.current) return;
    replicado.current = true;
    const d = destinoDe(`guia:${replicar}`);
    if (d?.tipo !== 'guia') return;
    void crearGuiada(d, true).then((error) => {
      if (!error || !montado.current) return;
      toast.error(error);
      // Sin el `?replicar=`: un F5 no vuelve a intentar armarlo solo.
      router.replace(RUTA_CREAR_VIDEO);
    });
  }, [replicar]); // eslint-disable-line react-hooks/exhaustive-deps

  // EL EDITOR PRIMERO (11/11/2026, Martín: «En lugar de la vista de Outliers, que esté la vista del lienzo de edición, donde
  // están todas las configuraciones de edición, y que de última ahí haya un lugarcito para seleccionar ciertos Outliers, por
  // ejemplo donde se hace la importación»). Entrando a la tab sin pedir nada, se abre el último proyecto (la lista ya viene del
  // más reciente: ./proyectos.ts) y, sin ninguno, uno vertical nuevo. Los outliers: Multimedia › «Outliers», al lado de
  // «Importar». «Nuevo video» (`?ver=crear`) sigue mostrando las plantillas.
  // «Replicar» de una RECETA (lib/video-recetas.ts; 11/11/2026, Martín: «replicarlo y que arme el proyecto»): el proyecto
  // vertical con el nombre de la receta y, en su chat, MaKo con la receta entera (estructura, grabación con avatar o con otra
  // persona, y la edición). El chat une lo escrito acá con lo que traiga la base al abrir (_opencut/chat/hilo.ts → cargarHilo).
  const recetaHecha = useRef(false);
  useEffect(() => {
    const r = recetaDe(receta);
    if (!r || recetaHecha.current) return;
    recetaHecha.current = true;
    proyectoConLienzo(LIENZO_GUIADO, r.nombre)
      .then((id) => {
        cambiarHilo(id, (h) => ({ ...h, mensajes: [...h.mensajes, conId({ de: 'mako', texto: textoDeReceta(r) })] }));
        if (montado.current) router.replace(`/video-editor/${id}`);
      })
      .catch(() => {
        if (!montado.current) return;
        toast.error('No pude armar el proyecto. Vuelve a intentar.');
        router.replace(RUTA_CREAR_VIDEO);
      });
  }, [receta]); // eslint-disable-line react-hooks/exhaustive-deps

  const entrado = useRef(false);
  useEffect(() => {
    if (alEntrar !== 'editor' || editor || replicar || receta || entrado.current || !proyectos) return;
    entrado.current = true;
    if (proyectos[0]) { router.replace(`/video-editor/${proyectos[0].id}`); return; }
    proyectoConLienzo(LIENZO_GUIADO, 'Mi video')
      .then((id) => { if (montado.current) router.replace(`/video-editor/${id}`); })
      .catch(() => { entrado.current = false; toast.error('No pude abrir el editor. Vuelve a intentar.'); });
  }, [alEntrar, editor, replicar, proyectos]); // eslint-disable-line react-hooks/exhaustive-deps

  const pieza = !editor ? null
    : desde ? <ImportarDesde desde={desde} />
      : plantilla !== undefined ? <ArmarPlantilla id={plantilla} />
        : desarmado !== undefined ? <ArmarPlantilla plantilla={desarmado?.plantilla ?? null} mensaje={desarmado?.mensaje} />
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
