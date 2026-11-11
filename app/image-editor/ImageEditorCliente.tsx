'use client';

// =============================================================================
// El Image Editor del lado del navegador: la pantalla de Create con el editor de Canva (Doory) adentro
// =============================================================================
// Martín, 29/10/2026: «En todas las tabs el mismo diseño de la barra lateral del chat de MaKo SIEMPRE abierto a la
// izquierda, y que los diferentes proyectos sean todos como en "Web generator"… En "nueva"… TEMPLATES con la sección de
// ¿Qué vas a crear hoy?». Es `PantallaCrear` (app/_crear/PantallaCrear.tsx), la de todas las tabs de Create:
//   · a la IZQUIERDA, la tarjeta que no se cierra. Sin diseño abierto es el chat de MaKo de siempre (el Cerebro); con un
//     diseño abierto es el chat de MaKo DEL EDITOR (mako/chat/PanelMakoIA.tsx: edita el diseño abierto), que se monta
//     adentro del motor y se dibuja en el hueco de la tarjeta (editor/PantallaEditor.tsx). Su «←» da vuelta la tarjeta a
//     la lista de diseños del negocio, con «Nuevo diseño» y el «⋯» de cada uno (Cambiar nombre, Duplicar, Eliminar);
//   · en el CENTRO, el editor del diseño o, sin diseño o tocando «Nuevo carrusel», los EJEMPLOS que mejor rindieron
//     (./carruseles/ExplorarCarruseles.tsx; Martín, 9/11/2026: «"Nuevo carrusel" muestra los OUTLIERS… se elimina "¿Qué vas a
//     crear hoy?"»). Su «Editar» abre el guiado (./carruseles/ReplicarGuiado.tsx): el original en el centro y MaKo preguntando
//     la oferta, el avatar y qué cambiar en la tarjeta. Las plantillas de ./plantillas-crear.ts quedan detrás de «Crear desde
//     cero» (`?ver=crear`): ahí viven las plantillas que guardó el negocio. La home de Canva (el `inicio/` de antes) se borró.
//
// Monta el motor portado de Doory sin SSR: usa `window`, IndexedDB, fabric.js (canvas) y workers, y nada de eso existe
// en el server. El `dynamic(..., { ssr: false })` tiene que vivir en un client component, por eso este archivo existe.
// La raíz del editor lleva la clase `.cv`: ahí viven los tokens del editor (_doory/styles/tokens.css, `--cv-*`, que
// desde el 29/10/2026 son los de MaKo: siguen el tema claro u oscuro de la app) y sus estilos base (_doory/styles/global.css).
// =============================================================================

import type { KitMarca } from '@/lib/marca/kits';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { PantallaCrear, type AccionProyecto, type PlantillaCrear, type ProyectoCrear } from '@/app/_crear/PantallaCrear';
import { ModalGuardarPlantilla } from '@/app/creaciones/PublicarCreacion';
import { usePlantillasPropias } from '@/app/creaciones/usePlantillasPropias';
import { CabeceraDeChat } from '@/app/admin/operaciones/PanelChat';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { useRouter } from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import type { ResumenDiseno } from '@/lib/image-editor/tipos';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import type { CargaEditor, EditorAbierto } from './editor/PantallaEditor';
import { borrarDiseno, crearDiseno, guardarDiseno, leerDiseno, listarDisenos } from './mako/nube';
import { leerHilo, suscribir, type Hilo } from './mako/chat/hilo';
import { crearDisenoNuevoAction } from './actions';
import { EJEMPLOS_NUEVO_DISENO, PLANTILLAS_NUEVO_DISENO } from './plantillas-crear';
import { RUTA_CREAR, RUTA_INICIO, rutaDiseno } from './ruta';
import { ExplorarCarruseles, type DatosExplorador } from './carruseles/ExplorarCarruseles';
import { BASE_SIN_DATOS, ChatReplica, ReplicarGuiado, useGuiado, type BaseGuiado } from './carruseles/ReplicarGuiado';
import { useCarruselesDeImage } from './carruseles/useCarruselesDeImage';
import { MiniaturaTarjetaDiseno } from './MiniaturaDiseno';
import { plantillaImagen, type DocumentoDoory } from '@/lib/image-editor/plantillas-reales';
import type { Carrusel, FiltrosCarrusel } from '@/lib/carruseles/explorar';
import type { FiltrosThumbnail } from '@/lib/thumbnails/explorar';
import chat from './mako/chat/chat.module.css';
import './_doory/styles/tokens.css';
import './_doory/styles/global.css';

const EjemploPlantillaImagen = dynamic(() => import('./EjemploPlantillaImagen').then((m) => m.EjemploPlantillaImagen), { ssr: false });
const PantallaEditor = dynamic(() => import('./editor/PantallaEditor').then((m) => m.PantallaEditor), { ssr: false });

const SIN_HILO: Hilo = { mensajes: [], corriendo: false };

/** La tarjeta izquierda con un diseño abierto: la cabecera de los chats de MaKo y, abajo, el hueco donde el editor dibuja su chat. */
function ChatDelEditor({ disenoId, volver, carga, onRanura }: {
  disenoId: string; volver: ReactNode; carga: CargaEditor; onRanura: (el: HTMLDivElement | null) => void;
}) {
  // Trabajando mientras MaKo arma la propuesta: el hilo vive fuera del motor (mako/chat/hilo.ts), así que se lee acá también.
  const hilo = useSyncExternalStore(suscribir, () => leerHilo(disenoId), () => SIN_HILO);
  return (
    <section className={`co-panel ${chat.marco}`} aria-label="Conversación con MaKo sobre el diseño">
      {/* «MaKo» con su estrella, como toda tarjeta de Create (la regla de las criaturas, 21/10): no la criatura de la tab. */}
      <CabeceraDeChat clave={`imagen:${disenoId}`} titulo="MaKo" criatura="MaKo" aspecto={ASPECTO_MAKO} animo={hilo.corriendo ? 'trabajando' : 'despierto'} antes={volver} />
      {carga === 'cargando' && <p className={chat.espera}>Abriendo el diseño…</p>}
      <div ref={onRanura} className={chat.ranura} hidden={carga !== 'listo'} />
    </section>
  );
}

const rutaDe = (id: string) => `${RUTA_INICIO}/${encodeURIComponent(id)}`;

export function ImageEditorCliente({ vista, disenoId, ws, senales = null, salir = null, explorador = null, negocio = null, kit = null, guiado = null }: {
  /** Lo que el guiado sabe del negocio (sus ofertas, sus fotos, su kit), leído en el server con los ejemplos. */
  guiado?: BaseGuiado | null;
  /** El kit de marca de por defecto (lib/marca/kits.ts): las miniaturas de los carruseles lo muestran como se va a crear. */
  kit?: KitMarca | null;
  /** El nombre del negocio: va en la cabecera de los carruseles que se crean, y en sus miniaturas. */
  negocio?: string | null;
  /** `carruseles`: los ejemplos, la portada de Image desde el 6/11/2026 (./carruseles/ExplorarCarruseles.tsx). `inicio`: las
   *  plantillas de «Crear desde cero» (`?ver=crear`). */
  vista: 'inicio' | 'editor' | 'carruseles';
  /** Lo del explorador, leído en el server; `{ error }` = no se pudo leer (no es «no hay ninguno»). */
  explorador?: { datos: DatosExplorador; filtros: FiltrosCarrusel; filtrosThumbnails?: FiltrosThumbnail } | { error: true } | null;
  disenoId?: string;
  ws: number | null;
  /** Lo que se sabe del negocio: el panel de plantillas pone primero las sugeridas (mako/plantillas.ts). */
  senales?: SenalesNegocio | null;
  /** La «‹» de la barra del editor (el teléfono, donde el editor tapa la pantalla): a dónde vuelve. */
  salir?: string | null;
}) {
  const router = useRouter();
  const abierto = vista === 'editor' && disenoId ? disenoId : null;
  const [disenos, setDisenos] = useState<ResumenDiseno[] | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ranura, setRanura] = useState<HTMLDivElement | null>(null);
  const [carga, setCarga] = useState<CargaEditor>('cargando');
  const editor = useRef<EditorAbierto | null>(null);

  const cargar = useCallback(() => {
    void listarDisenos().then((r) => {
      if (r.ok) { setDisenos(r.disenos); setErrorLista(null); } else setErrorLista(r.error);
    });
  }, []);
  // Primero sube lo que haya quedado en este navegador de la etapa 1 (mako/mudanza.ts); después lista. Si la mudanza
  // falla, la copia local queda y se reintenta la próxima vez: la lista sale igual.
  useEffect(() => {
    void import('./mako/mudanza').then((m) => m.mudarLocales(ws)).catch(() => undefined).finally(cargar);
  }, [ws, cargar]);

  const conTitulo = useCallback((id: string, titulo: string) => {
    setDisenos((xs) => xs?.map((d) => (d.id === id ? { ...d, titulo } : d)) ?? xs);
  }, []);

  const renombrar = useCallback(async (d: ResumenDiseno) => {
    const nuevo = window.prompt('Nuevo nombre del diseño', d.titulo)?.trim();
    if (!nuevo || nuevo === d.titulo) return;
    setAviso(null);
    // El abierto se renombra POR el editor: si fuera directo a la base, su próximo guardado chocaría con la versión.
    if (editor.current?.id === d.id) { editor.current.renombrar(nuevo); return; }
    const leido = await leerDiseno(d.id);
    const r = leido.ok ? await guardarDiseno(d.id, { version: leido.diseno.version, titulo: nuevo }) : leido;
    if (!r.ok) { setAviso(`No se pudo cambiar el nombre: ${r.error}`); return; }
    conTitulo(d.id, nuevo);
  }, [conTitulo]);

  const duplicar = useCallback(async (d: ResumenDiseno) => {
    setAviso(null);
    // El abierto se copia como está en pantalla (con lo que todavía no se guardó).
    const enPantalla = editor.current?.id === d.id ? editor.current.documento() : null;
    const leido = enPantalla ? null : await leerDiseno(d.id);
    if (leido && !leido.ok) { setAviso(`No se pudo duplicar: ${leido.error}`); return; }
    const r = await crearDiseno({ titulo: `${d.titulo} (copia)`, doc: enPantalla ?? leido?.diseno.doc });
    if (!r.ok) { setAviso(`No se pudo duplicar: ${r.error}`); return; }
    cargar();
  }, [cargar]);

  const eliminar = useCallback(async (d: ResumenDiseno) => {
    setAviso(null);
    const r = await borrarDiseno(d.id);
    if (!r.ok) { setAviso(`No se pudo eliminar: ${r.error}`); return; }
    setDisenos((xs) => xs?.filter((x) => x.id !== d.id) ?? xs);
    // El que se borró era el abierto: la tab vuelve a «¿Qué vas a crear hoy?».
    if (d.id === abierto) router.push(RUTA_CREAR);
  }, [abierto, router]);

  const proyectos = useMemo((): ProyectoCrear[] | null => disenos?.map((d) => {
    const menu: AccionProyecto[] = [
      { rotulo: 'Cambiar nombre', hacer: () => renombrar(d) },
      { rotulo: 'Duplicar', hacer: () => duplicar(d) },
      { rotulo: 'Guardar como plantilla', hacer: () => setComoPlantilla({ id: d.id, nombre: d.titulo }) },
      { rotulo: 'Eliminar', hacer: () => eliminar(d), peligro: true, confirmar: `¿Eliminar «${d.titulo}»? No se puede deshacer.` },
    ];
    return { id: d.id, nombre: d.titulo, href: rutaDe(d.id), cuando: Date.parse(d.actualizado) || null, menu };
  }) ?? null, [disenos, renombrar, duplicar, eliminar]);

  // Plantillas propias (6/11/2026, Leila): las que guardó el negocio y las mejores de la comunidad, primero en «Nuevo diseño».
  const [comoPlantilla, setComoPlantilla] = useState<{ id: string; nombre: string } | null>(null);
  const propias = usePlantillasPropias('formato_imagen');
  const plantillasNuevo = useMemo(() => [...propias.plantillas, ...PLANTILLAS_NUEVO_DISENO], [propias.plantillas]);

  // «Usar plantilla»: la misma acción que el teléfono. Abierto el diseño nuevo, la pantalla se va: la tarjeta queda en
  // «Creando» hasta entonces (un segundo clic no crea otro).
  const onPlantilla = useCallback(async (p: { id: string }) => {
    const propia = await propias.usar(p as PlantillaCrear);
    if (propia !== false) return propia ?? new Promise<null>(() => {});
    const r = await crearDisenoNuevoAction(p.id);
    if (!r.ok) return r.error;
    router.push(rutaDiseno(r.id));
    return new Promise<null>(() => {});
  }, [router, propias]);

  // Los carruseles por tipo (su miniatura, «Ver ejemplo») y «Hacer el mío» desde el explorador: ./carruseles/useCarruselesDeImage.tsx.
  const crearPlantilla = useCallback(async (id: string) => {
    const r = await onPlantilla({ id });
    return typeof r === 'string' ? r : null;
  }, [onPlantilla]);
  const carruseles = useCarruselesDeImage({ negocio, kit, crearPlantilla });

  // Las plantillas reales (6/11/2026, lib/image-editor/plantillas-reales.ts): la tarjeta dibuja la ESTRUCTURA que se crea y
  // «Ver ejemplo» abre la misma composición llena, de un negocio ficticio. Los carruseles siguen con lo suyo.
  const estructuras = useMemo(() => {
    let n = 0;
    const out = new Map<string, DocumentoDoory>();
    for (const p of PLANTILLAS_NUEVO_DISENO) {
      const real = p.real ? plantillaImagen(p.real) : null;
      if (real) out.set(p.id, real.estructura(() => `t${++n}`));
    }
    return out;
  }, []);
  const [ejemploReal, setEjemploReal] = useState<{ tarjeta: string; real: string } | null>(null);
  const miniaturaCarrusel = carruseles.miniatura;
  const miniatura = useCallback((p: { id: string; nombre: string }) => {
    const doc = estructuras.get(p.id);
    return doc ? <MiniaturaTarjetaDiseno doc={doc} nombre={p.nombre} /> : miniaturaCarrusel(p);
  }, [estructuras, miniaturaCarrusel]);
  const verEjemploCarrusel = carruseles.onVerEjemplo;
  const onVerEjemplo = useCallback((p: { id: string }) => {
    const real = PLANTILLAS_NUEVO_DISENO.find((x) => x.id === p.id)?.real;
    if (real) setEjemploReal({ tarjeta: p.id, real });
    else verEjemploCarrusel(p);
  }, [verEjemploCarrusel]);
  const plantillaDelEjemplo = ejemploReal ? plantillaImagen(ejemploReal.real) : null;

  // El ejemplo que se está replicando (9/11/2026): su «Editar» ya no abre el editor solo; abre el guiado, con MaKo preguntando en la
  // tarjeta de la izquierda (./carruseles/ReplicarGuiado.tsx). Nada se guarda hasta «Generar».
  const [replicando, setReplicando] = useState<Carrusel | null>(null);
  const g = useGuiado(abierto ? null : replicando, guiado ?? BASE_SIN_DATOS);
  const ejemplos = !abierto && vista === 'carruseles' && explorador != null;
  const salirDelGuiado = useCallback(() => setReplicando(null), []);
  // «Nuevo carrusel» es SIEMPRE los ejemplos (Martín, 9/11/2026: «"Nuevo carrusel" muestra los OUTLIERS… se elimina "¿Qué vas a
  // crear hoy?"»). En la portada, es soltar el que se replicaba; desde el editor o «Crear desde cero», ir a la portada, que es
  // donde están leídos.
  const irAEjemplos = useCallback(() => router.push(RUTA_INICIO), [router]);

  const onTitulo = useCallback((t: string) => { if (abierto) conTitulo(abierto, t); }, [abierto, conTitulo]);
  const alAbrir = useCallback((a: EditorAbierto | null) => { editor.current = a; }, []);

  // Los ejemplos (6/11/2026) en el centro de «Nuevo carrusel», con la tarjeta de MaKo a la izquierda (9/11/2026, Martín: «La barra
  // del chat de MaKo nunca desaparece»; antes la portada era la grilla SOLA y sus diseños no se encontraban).
  const explorar = !ejemplos || !explorador ? null : 'error' in explorador ? (
    <div role="alert" style={{ margin: 'auto', padding: 24, textAlign: 'center', color: 'var(--dim)' }}>
      No pude leer los carruseles de ejemplo. Vuelve a intentar.<ReportarASoporte />
    </div>
  ) : <ExplorarCarruseles datos={explorador.datos} filtrosIniciales={explorador.filtros} thumbnailsIniciales={explorador.filtrosThumbnails} rutaCrear={RUTA_CREAR} onReplicar={setReplicando} />;

  return (
    <>
    {/* Otro diseño (o la portada) es otra pantalla: la tarjeta vuelve al chat y «Nuevo diseño» se cierra. */}
    <PantallaCrear
      // Empezar a replicar es otra pantalla: la tarjeta vuelve al chat (el del guiado) aunque estuviera en la lista.
      key={`${ws ?? 0}:${abierto ?? vista}:${g?.c.id ?? ''}`}
      tab="Image"
      nuevo="Nuevo carrusel"
      proyectos={proyectos}
      errorProyectos={errorLista}
      onReintentar={cargar}
      actual={abierto}
      nueva={explorar ?? undefined}
      alNuevo={ejemplos ? salirDelGuiado : irAEjemplos}
      pieLista={aviso ? <p role="alert" style={{ margin: 0, color: 'var(--bad)' }}>{aviso}<ReportarASoporte /></p> : null}
      plantillas={plantillasNuevo}
      onPlantilla={onPlantilla}
      miniatura={miniatura}
      onVerEjemplo={onVerEjemplo}
      ejemplos={EJEMPLOS_NUEVO_DISENO}
      // Sin la franja de «Carruseles que funcionan» arriba de las plantillas (6/11/2026): los ejemplos son la portada de Image, y
      // esto es «Crear desde cero».
      chat={abierto && carga !== 'falla'
        ? (volver) => <ChatDelEditor disenoId={abierto} volver={volver} carga={carga} onRanura={setRanura} />
        : g ? (volver) => <ChatReplica g={g} volver={volver} /> : undefined}
      // En una ventana angosta, el guiado abre en el chat: ahí está la pregunta (10/11/2026). La key cambia con el guiado, así que
      // esto vale al entrar a cada uno.
      movilDeEntrada={g ? 'mako' : undefined}
      // El lienzo necesita el ancho, como el Video Editor (29/10/2026): el chat se pliega a una barra fina. Mientras se replica,
      // NO: la tarjeta es donde MaKo pregunta.
      plegable={!!abierto}
    >
      {abierto ? (
        <div className="cv" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PantallaEditor disenoId={abierto} ws={ws} ranuraChat={ranura} salir={salir} onAbierto={alAbrir} onCarga={setCarga} onTitulo={onTitulo} senales={senales} />
        </div>
      ) : g ? <ReplicarGuiado g={g} onSalir={salirDelGuiado} /> : null}
    </PantallaCrear>
    {carruseles.dialogos}
    {ejemploReal && plantillaDelEjemplo && (
      <EjemploPlantillaImagen p={plantillaDelEjemplo} alSalir={() => setEjemploReal(null)} alUsar={() => crearPlantilla(ejemploReal.tarjeta)} />
    )}
    <ModalGuardarPlantilla tipo="formato_imagen" de={comoPlantilla} alSalir={() => setComoPlantilla(null)} alGuardar={propias.recargar} />
    </>
  );
}
