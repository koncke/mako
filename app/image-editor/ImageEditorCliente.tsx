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
//   · en el CENTRO, el editor del diseño o, sin diseño o tocando «Nuevo diseño», «¿Qué vas a crear hoy?» con las
//     plantillas de ./plantillas-crear.ts (las mismas del teléfono). La home de Canva (el `inicio/` de antes) se borró.
//
// Monta el motor portado de Doory sin SSR: usa `window`, IndexedDB, fabric.js (canvas) y workers, y nada de eso existe
// en el server. El `dynamic(..., { ssr: false })` tiene que vivir en un client component, por eso este archivo existe.
// La raíz del editor lleva la clase `.cv`: ahí viven los tokens del editor (_doory/styles/tokens.css, `--cv-*`, que
// desde el 29/10/2026 son los de MaKo: siguen el tema claro u oscuro de la app) y sus estilos base (_doory/styles/global.css).
// =============================================================================

import type { KitMarca } from '@/lib/marca/kits';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { PantallaCrear, type AccionProyecto, type ProyectoCrear } from '@/app/_crear/PantallaCrear';
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
import { RUTA_INICIO, rutaDiseno } from './ruta';
import { ExplorarCarruseles, type DatosExplorador } from './carruseles/ExplorarCarruseles';
import { FranjaCarruseles } from './carruseles/FranjaCarruseles';
import { useCarruselesDeImage } from './carruseles/useCarruselesDeImage';
import type { FiltrosCarrusel } from '@/lib/carruseles/explorar';
import chat from './mako/chat/chat.module.css';
import './_doory/styles/tokens.css';
import './_doory/styles/global.css';

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

export function ImageEditorCliente({ vista, disenoId, ws, senales = null, salir = null, explorador = null, negocio = null, kit = null }: {
  /** El kit de marca de por defecto (lib/marca/kits.ts): las miniaturas de los carruseles lo muestran como se va a crear. */
  kit?: KitMarca | null;
  /** El nombre del negocio: va en la cabecera de los carruseles que se crean, y en sus miniaturas. */
  negocio?: string | null;
  /** `carruseles`: en el centro, «Carruseles que funcionan» (./carruseles/ExplorarCarruseles.tsx, `?ver=carruseles`). */
  vista: 'inicio' | 'editor' | 'carruseles';
  /** Lo del explorador, leído en el server; `{ error }` = no se pudo leer (no es «no hay ninguno»). */
  explorador?: { datos: DatosExplorador; filtros: FiltrosCarrusel } | { error: true } | null;
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
    if (d.id === abierto) router.push(RUTA_INICIO);
  }, [abierto, router]);

  const proyectos = useMemo((): ProyectoCrear[] | null => disenos?.map((d) => {
    const menu: AccionProyecto[] = [
      { rotulo: 'Cambiar nombre', hacer: () => renombrar(d) },
      { rotulo: 'Duplicar', hacer: () => duplicar(d) },
      { rotulo: 'Eliminar', hacer: () => eliminar(d), peligro: true, confirmar: `¿Eliminar «${d.titulo}»? No se puede deshacer.` },
    ];
    return { id: d.id, nombre: d.titulo, href: rutaDe(d.id), cuando: Date.parse(d.actualizado) || null, menu };
  }) ?? null, [disenos, renombrar, duplicar, eliminar]);

  // «Usar plantilla»: la misma acción que el teléfono. Abierto el diseño nuevo, la pantalla se va: la tarjeta queda en
  // «Creando» hasta entonces (un segundo clic no crea otro).
  const onPlantilla = useCallback(async (p: { id: string }) => {
    const r = await crearDisenoNuevoAction(p.id);
    if (!r.ok) return r.error;
    router.push(rutaDiseno(r.id));
    return new Promise<null>(() => {});
  }, [router]);

  // Los carruseles por tipo (su miniatura, «Ver ejemplo») y «Hacer el mío» desde el explorador: ./carruseles/useCarruselesDeImage.tsx.
  const crearPlantilla = useCallback(async (id: string) => {
    const r = await onPlantilla({ id });
    return typeof r === 'string' ? r : null;
  }, [onPlantilla]);
  const carruseles = useCarruselesDeImage({ negocio, kit, crearPlantilla });

  const onTitulo = useCallback((t: string) => { if (abierto) conTitulo(abierto, t); }, [abierto, conTitulo]);
  const alAbrir = useCallback((a: EditorAbierto | null) => { editor.current = a; }, []);

  return (
    <>
    {/* Otro diseño (o la portada) es otra pantalla: la tarjeta vuelve al chat y «Nuevo diseño» se cierra. */}
    <PantallaCrear
      key={`${ws ?? 0}:${abierto ?? vista}`}
      tab="Image"
      nuevo="Nuevo diseño"
      proyectos={proyectos}
      errorProyectos={errorLista}
      onReintentar={cargar}
      actual={abierto}
      pieLista={aviso ? <p role="alert" style={{ margin: 0, color: 'var(--bad)' }}>{aviso}<ReportarASoporte /></p> : null}
      plantillas={PLANTILLAS_NUEVO_DISENO}
      onPlantilla={onPlantilla}
      miniatura={carruseles.miniatura}
      onVerEjemplo={carruseles.onVerEjemplo}
      ejemplos={EJEMPLOS_NUEVO_DISENO}
      // Arriba de las plantillas, los carruseles que mejor les funcionan a las cuentas que sigue el negocio (4/11/2026).
      arribaDePlantillas={vista === 'carruseles' ? null : <FranjaCarruseles />}
      chat={abierto && carga !== 'falla'
        ? (volver) => <ChatDelEditor disenoId={abierto} volver={volver} carga={carga} onRanura={setRanura} />
        : undefined}
      // El lienzo necesita el ancho, como el Video Editor (29/10/2026): el chat se pliega a una barra fina.
      plegable
    >
      {abierto ? (
        <div className="cv" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PantallaEditor disenoId={abierto} ws={ws} ranuraChat={ranura} salir={salir} onAbierto={alAbrir} onCarga={setCarga} onTitulo={onTitulo} senales={senales} />
        </div>
      ) : vista === 'carruseles' && explorador ? (
        'error' in explorador ? (
          <div role="alert" style={{ margin: 'auto', padding: 24, textAlign: 'center', color: 'var(--dim)' }}>
            No pude leer los carruseles de las cuentas que sigues. Vuelve a intentar.<ReportarASoporte />
          </div>
        ) : <ExplorarCarruseles datos={explorador.datos} filtrosIniciales={explorador.filtros} onUsar={carruseles.onUsar} />
      ) : null}
    </PantallaCrear>
    {carruseles.dialogos}
    </>
  );
}
