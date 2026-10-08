'use client';

// =============================================================================
// CursoApp — el curso de cada servicio, y cómo va cada cliente en él
// =============================================================================
// ⚠️ SE DIBUJA CON EL DISEÑO DE CONOCIMIENTOS (app/_cursos/CursoUgc.tsx), el MISMO que ve el
//    alumno en su portal, con los controles de quien lo arma encima. Pedido de Martín el
//    07/10/2026, mirando el portal al lado de /conocimientos: «No se ve para nada igual, COPIA lo
//    que ya hicimos en CONOCIMIENTOS» y, en el mismo hilo, «No solo la vista de alumnos, la vista
//    del editor también se tiene que ver tal cual». Las etapas de la entrega son los módulos de la
//    barra y sus clases las lecciones; la traducción, pura y con test, está en ./modelo-ugc.ts.
//
// Lo que tiene la tab adentro del curso:
//   · Una etapa abierta: sus clases como tarjetas, con ↑ ↓ ✕ y «+ Clase» (sólo un admin: ver
//     actions.ts), y en su cabecera el aviso de que no avanza sola.
//   · Una clase abierta, que se EDITA EN SU LUGAR (./LeccionEditable.tsx, items 13 a 17 del
//     07/10/2026): el título con un clic, el video (o el recuadro de «Agregar video»), la ficha (tipo y
//     minutos), y en el papel la descripción con el editor rico y DEBAJO la tarea. Sin «Editar», sin
//     notas, sin «Grabar / No grabar» y sin pestañas: Martín pidió sacar las cuatro. Desde el audio del
//     08/10/2026 NO SE GUARDA SOLA: un borrador con su botón «Guardar», y salir con cambios pregunta
//     (`useLeccionAbierta`, la guarda de salida vive ahí).
//   · La ESTRUCTURA, editable en su lugar (items 6, 7, 8 y 12 del 07/10/2026): «+ Nuevo módulo» y
//     «+ Nueva clase» primero, el nombre de un módulo con un clic (renombra su etapa del kanban),
//     módulos y clases que se ARRASTRAN (el gesto del Plan), y el menú «…» de cada uno
//     (./MenuCurso.tsx), UNO con la misma forma para módulo y clase (item 15 del 08/10/2026): renombrar,
//     portada, mover antes / después · público o privado · (módulo) «Etapa del kanban», que al apagarse
//     QUITA la etapa y pregunta a dónde van sus clientes (./QuitarEtapa.tsx) · eliminar, a la papelera.
//     Cada gesto deja su «Deshacer» de 5 segundos, que vuelve a escribir en el server (item 18).
//   · «Vista del alumno», «Invitar alumnos» y el «?» arriba a la DERECHA, en el lugar del nombre del
//     curso (item 14 del 08/10/2026), y los DOS RECORRIDOS: el del curso y el de una clase (items 1 y 19).
//   · En el menú de la marca: el curso que se mira, el color y la FUENTE (item 3 del 08/10/2026).
//   · ⚠️ SIN «Avance de los clientes» desde el 08/10/2026 (item 4): es una vista de /customer-success.
//
// ⚠️ EL CURSO CUELGA DE LAS ETAPAS DE LA ENTREGA, no tiene etapas propias (mig 0202). Las
// columnas del kanban de Customer Success SON los módulos de acá: renombrar una allá la renombra
// acá, y una clase de una etapa borrada aparece en «Sin etapa» para moverla.
//
// ⚠️ LAS CLASES VIVEN EN UN ESTADO LOCAL QUE SE RESINCRONIZA CON LAS PROPS. Guardar y borrar
// revalidan la página (llega la lista nueva y pisa la local); mover NO revalida —la flecha
// mueve la tarjeta en el acto y la base confirma detrás—, así que la local es la que manda
// hasta la próxima carga.
//
// ⚠️ LA POSICIÓN (etapa abierta, clase abierta, Avance) VIVE EN EL HASH y su dueño es
// app/conocimientos/posicion.ts, como en Conocimientos. El producto va en `?producto=`; cambiar de
// producto vacía el hash, porque las etapas de dos productos pueden llamarse igual.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pagina, PageHeader, EmptyState, ErrorState, Banner, Toast, useToast, useConfirm,
} from '@/app/_ui';
import Link, { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { PortadaPicker } from '@/app/_components/PortadaPicker';
import type { Clase } from '@/lib/curso';
import { CAMPO_AREAS } from '@/lib/curso';
import { miniaturaDeClase } from './leccion-reglas';
import CursoUgc, { ChipUgc, ItemMenuUgc, TituloMenuUgc } from '@/app/_cursos/CursoUgc';
import type { LeccionUgc, ObjetivoUgc, TextoUgc } from '@/app/_cursos/tipos';
import {
  ACENTOS, ACENTO_DEFAULT, conAjuste, disposicionDe, estiloVacio, tapaDe, valorDe, type Ajuste, type EstiloCurso,
} from '@/lib/curso-estilo';
import { navegar, sembrar, usePosicion } from '@/app/conocimientos/posicion';
import { CSS_PORTAL } from '@/app/compartido/curso/[token]/estilos';
import { marcaDelProducto } from '@/app/compartido/curso/[token]/modelo-ugc';
import { porEtapas, reordenar, type FilaAvance } from './reglas';
import {
  SIN_ETAPA, TEXTOS_EDITOR, chipsDelEditor, cierraLaEtapa, clasesDelEditor, modulosDelEditor, puedeMoverEnEditor,
} from './modelo-ugc';
import {
  borrarClaseAction, moverClaseAction, guardarEstiloCursoAction, renombrarClaseAction,
} from './actions';
import { crearClaseAction, renombrarModuloAction } from './modulos-actions';
import type { ModuloCurso } from '@/lib/curso-modulos';
import { TOPE_NOMBRE_ETAPA } from '@/lib/servicio-etapas';
import { leccionDelEditor, precargarLeccion, useLeccionAbierta, type CtxLeccion } from './LeccionEditable';
import { precargarEditorRico } from './editor-rico-perezoso';
import { guardarCampoClaseAction } from './modulos-actions';
import { tieneTarea } from '@/lib/curso';
import { motivoObligatoria, ofreceObligatoria } from './leccion-reglas';
import type { EtapaVista } from './AvanceCurso';
import type { OnboardingCurso } from './ChecklistCurso';
// ── El editor de la ESTRUCTURA (pedido del 07/10/2026, items 3 a 9, 11 y 12) ──
import { Recorrido, BotonRecorrido, useRecorrido } from '@/app/_ui/Recorrido';
import { claveDe } from '@/lib/curso-estilo';
import type { Bloqueo } from '@/lib/curso-bloqueo';
import {
  borrarModuloAction, crearModuloAction, guardarBloqueoAction, moverClaseAAction,
  reordenarModulosAction, vincularModuloAction, restaurarModuloAction, restaurarClasesAction, previaQuitarAction,
} from './modulos-actions';
import { CSS_MENU_CURSO, MenuClase, MenuModulo } from './MenuCurso';
import { QuitarEtapa, type PreguntaQuitar } from './QuitarEtapa';
import type { EtapaEntrega } from '@/lib/servicio-etapas';
import { avisoDeBloqueo, chipDeBloqueo } from './bloqueo-editor';
import {
  clasesConDevueltas, clasesConMovida, clasesReclaveadas, clavesConMovido, conOrdenDe, estiloReclaveado, lugarDe, modulosEnOrden,
} from './estructura';
import { ModalInvitarAlumnos } from './InvitarAlumnos';
// ── Pista GENERAL, audio del 08/10/2026 (items 13 y 17 de docs/feedback-curso-08oct.md) ──
// «+ Nuevo producto» en el menú de la marca, y los comentarios de cada clase debajo de la lección.
import { NuevoProducto } from './NuevoProducto';
import { ComentariosClase } from '@/app/_cursos/ComentariosClase';
import { apiDelEquipo } from '../comunidad/api-equipo';
import { comentariosPrendidos } from '@/lib/curso-estilo';
import type { ClaseUgc, ControlMenuUgc, ModuloUgc } from '@/app/_cursos/tipos';
// La fuente del curso, en el menú de la marca al lado del color (item 3 del 08/10/2026).
import { SelectorFuente } from '@/app/_cursos/SelectorFuente';
import { PASOS_RECORRIDO, PASOS_RECORRIDO_LECCION, RECORRIDO_CURSO, RECORRIDO_LECCION } from './recorridos-curso';

/**
 * Un servicio con su curso. `etapas` = las columnas del KANBAN (las de la tabla Avance, con su color);
 * `modulos` = los MÓDULOS del curso (D1, lib/curso-modulos.ts: las etapas que son módulo y los
 * sueltos, en orden), que es lo que dibuja el editor. No son lo mismo desde el 08/10/2026: una etapa
 * puede no ser módulo (`enCurso: false`) y un módulo suelto no es una etapa.
 */
export type ServicioCurso = { productoId: number; nombre: string; etapas: EtapaVista[]; modulos: ModuloCurso[] };
export type VistaCurso = 'clases' | 'avance';

/**
 * ⚠️ UNA CONSTANTE Y NO `= {}` EN LOS PARÁMETROS: los estilos se resincronizan comparando la prop por
 * identidad (como las clases), y un `{}` nuevo en cada render sería «llegó otra» en cada render — un
 * setState durante el render que no termina nunca.
 */
const SIN_ESTILOS: Record<number, EstiloCurso> = {};

// ⚠️ LOS DOS RECORRIDOS (el del curso y el de una clase, items 1, 3 y 19) viven en ./recorridos-curso.ts:
//    son datos puros, y así un test puede comprobar que cada paso señala algo que existe en el fuente.

/** La vista previa del alumno de un producto (./vista/page.tsx): sin lead, no crea accesos. */
const hrefVistaPrevia = (productoId: number) => `/customer-success/curso/vista?producto=${productoId}`;

export function CursoApp({
  servicios, clases: clasesProp, avance, avanceError, conAvance, puedeEditar, inicial, errorClases, errorEntrega,
  estilos: estilosProp = SIN_ESTILOS, estiloError = null,
}: {
  servicios: ServicioCurso[];
  /** No se pudieron leer los servicios. ⚠️ No es «no tienes servicios»: son dos pantallas. */
  errorEntrega?: string | null;
  clases: Clase[];
  /** productoId → filas de la tabla de Avance, ya ordenadas. */
  avance: Record<number, FilaAvance[]>;
  avanceError: string | null;
  /** claseId → cuántos clientes ya tienen avance ahí (para el aviso de borrar). */
  conAvance: Record<number, number>;
  puedeEditar: boolean;
  inicial: { productoId: number | null; vista: VistaCurso };
  /** productoId → por qué no se pudieron leer sus clases. */
  errorClases: Record<number, string>;
  /**
   * Los pasos del onboarding de la tab, como los anotó la página (sólo para quien arma el curso).
   * ⚠️ DESDE EL 08/10/2026 LA TAB NO DIBUJA LA LISTA (item 3): la reemplazó el recorrido
   * (`PASOS_RECORRIDO`). Los pasos se siguen anotando (los leen MaKo y la pantalla final del
   * onboarding), y la prop queda para quien quiera mostrarlos.
   */
  onboarding?: OnboardingCurso | null;
  /** productoId → cómo se ve su curso (mig 0214). Sin fila = el de siempre. */
  estilos?: Record<number, EstiloCurso>;
  /**
   * No se pudo leer cómo se ven los cursos. ⚠️ No es «nadie eligió nada»: se dibuja el de siempre,
   * se AVISA, y no se ofrece cambiar el estilo — se editaría encima de algo que no se ve.
   */
  estiloError?: string | null;
}) {
  const [productoId, setProductoId] = useState<number | null>(
    servicios.some((s) => s.productoId === inicial.productoId) ? inicial.productoId : servicios[0]?.productoId ?? null,
  );
  // Ver la cabecera: la lista local se pisa cuando llega otra desde el server.
  const [base, setBase] = useState(clasesProp);
  const [clases, setClases] = useState(clasesProp);
  if (base !== clasesProp) { setBase(clasesProp); setClases(clasesProp); }

  const [moviendo, setMoviendo] = useState<number | null>(null);
  /** «+ Clase» esperando al server: la clase nace ahí y recién después se abre. */
  const [creando, setCreando] = useState(false);
  // El estilo de cada curso: el mismo patrón que las clases (se pisa cuando llega otro del server).
  const [baseEstilos, setBaseEstilos] = useState(estilosProp);
  const [estilos, setEstilos] = useState(estilosProp);
  if (baseEstilos !== estilosProp) { setBaseEstilos(estilosProp); setEstilos(estilosProp); }
  /**
   * Lo último que el SERVER confirmó, por producto. Si un guardado falla, la pantalla vuelve ACÁ y
   * no a lo que había en pantalla: con el color «otro» lo de pantalla es un tono a mitad de camino
   * que nunca se guardó (revisión del 07/10/2026).
   */
  const confirmados = useRef<Record<number, EstiloCurso>>(estilosProp);
  if (baseEstilos !== estilosProp) confirmados.current = estilosProp;
  /** El selector de portadas abierto: qué portada cambia y de qué botón cuelga. */
  // `antes`: la portada que había al abrirlo, para el «Deshacer» al cerrarlo (item 18).
  const [picker, setPicker] = useState<{ ajuste: Ajuste; ancla: HTMLElement; antes: string | null } | null>(null);
  /**
   * LOS MÓDULOS DE CADA CURSO COMO QUEDARON ACÁ (renombrar, arrastrar, crear, desvincular, el
   * candado), por producto, hasta que la página traiga otros. Cada action de los módulos devuelve la
   * lista como QUEDÓ en la base (./modulos-actions.ts) y eso pisa lo de acá: un arrastre puede terminar
   * distinto de lo pedido si el kanban agrupa por fases. Mismo patrón que las clases.
   */
  const [baseServicios, setBaseServicios] = useState(servicios);
  const [modulosLocal, setModulosLocal] = useState<Record<number, ModuloCurso[]>>({});
  if (baseServicios !== servicios) { setBaseServicios(servicios); setModulosLocal({}); }
  /** «Invitar alumnos»: UN modal, que abren el botón de la barra de arriba y el menú de la marca. */
  const [invitando, setInvitando] = useState(false);
  /** «+ Nuevo producto» (item 17 del audio del 08/10/2026): el diálogo del nombre, afuera del curso. */
  const [creandoProducto, setCreandoProducto] = useState(false);
  /** Un cambio de la ESTRUCTURA esperando al server: los controles se apagan, no desaparecen. */
  const [estructurando, setEstructurando] = useState(false);
  /** La pregunta de antes de quitar una etapa o eliminar un módulo (./QuitarEtapa.tsx), afuera del curso. */
  const [quitar, setQuitar] = useState<PreguntaQuitar | null>(null);
  const timerAcento = useRef<number | undefined>(undefined);
  /** El color confirmado cuando se empezó a mover el selector «otro» (su «Deshacer»). `null` = no se está moviendo. */
  const otroAntes = useRef<{ v: string | null } | null>(null);
  /** El turno de cada ajuste del estilo (ver `guardarAjuste`): una respuesta vieja no pisa una más nueva. */
  const turnos = useRef<Record<string, number>>({});
  // Dónde está parado: en el índice, en un módulo o adentro de una clase.
  const { pos } = usePosicion();
  /**
   * LOS DOS RECORRIDOS (items 1, 3 y 19; ./recorridos-curso.ts): el del CURSO y el de una CLASE. Cada
   * uno se abre solo la primera vez, para quien arma el curso, y SÓLO donde explica algo: el de la
   * clase al entrar a editar una, el del curso afuera de las clases. Así nunca se abren los dos juntos,
   * y quien aterriza en una clase (un link, un F5) ve primero el de la clase y, al salir, el del curso.
   * El «?» abre el del lugar donde está (`barraDeArriba`).
   *
   * ⚠️ «Adentro de una clase» es que la URL nombre una clase de ESTE curso: un `#clase=` de otro
   *    producto no dibuja ninguna lección (`CursoUgc` no la encuentra), y abrir ahí el de la clase
   *    sería esperar unos objetivos que no van a aparecer.
   */
  const enClase = pos.clase != null && clases.some((c) => c.id === pos.clase && c.productoId === productoId);
  const recorrido = useRecorrido(RECORRIDO_CURSO, { autoabrir: puedeEditar && !enClase });
  // `!recorrido.abierto`: el del curso abierto con el «?» sigue a la vista adentro de una clase (sus
  // objetivos de la barra siguen ahí), y entrar a una con el Atrás del navegador abriría el segundo encima.
  const recorridoClase = useRecorrido(RECORRIDO_LECCION, { autoabrir: puedeEditar && enClase && !recorrido.abierto });
  const { toast, show, clear } = useToast();
  const { confirm, confirmNode } = useConfirm();

  const servicio = servicios.find((s) => s.productoId === productoId) ?? null;
  /**
   * El camino de los comentarios de una clase (item 13, mig 0227): las server actions de la comunidad del
   * producto, con la sesión del equipo. Una por producto (cambiar de curso es otra comunidad). ⚠️ ANTES de
   * cualquier `return` de esta pantalla: es un hook (AGENTS.md, los hooks no van detrás de un return).
   */
  const productoDelServicio = servicio?.productoId ?? null;
  const apiComunidad = useMemo(() => (productoDelServicio != null ? apiDelEquipo(productoDelServicio) : null), [productoDelServicio]);
  /** El `?ws=` de la pestaña: el link «Ver en Comunidad» es un `<a>` (vive adentro del curso) y lo necesita. */
  const wsPestana = useWs();

  // El producto queda en la URL, para que recargar (o un link desde la ficha del cliente) vuelva
  // al mismo lugar. `replaceState` y no el router: el router volvería a pedir la página entera al
  // server por un cambio que ya está en memoria. La posición adentro del curso va en el hash, que
  // esto conserva (`u.href` lo trae).
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (productoId) u.searchParams.set('producto', String(productoId)); else u.searchParams.delete('producto');
      // `?vista=avance` era la pestaña de antes: hoy es una vista de Clientes (la página redirige).
      u.searchParams.delete('vista');
      if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u.href);
    } catch { /* sin URL no se pierde nada: es una comodidad */ }
  }, [productoId]);

  // Aterrizar adentro (un F5 en una clase, un link pegado) siembra el índice del curso debajo: sin
  // esto la posición del hash no se lee hasta el primer Atrás (ver PortalAlumno, que hace lo mismo).
  useEffect(() => { sembrar({}); }, []);

  // ⚠️ EL AVANCE DE LOS CLIENTES YA NO ESTÁ ACÁ (item 4): es una vista de /customer-success, y un
  //    `?vista=avance` viejo lo redirige la página (./page.tsx). Las filas siguen llegando: son la
  //    lista de «Invitar alumnos» y el aviso de borrar una clase.

  /** Los módulos del curso elegido: los que dejó un cambio de acá, o los que trajo la página. */
  const modulosActuales = useMemo<ModuloCurso[]>(
    () => (servicio ? (modulosLocal[servicio.productoId] ?? servicio.modulos) : []),
    [servicio, modulosLocal],
  );
  const delProducto = useMemo(() => clases.filter((c) => c.productoId === productoId), [clases, productoId]);
  const { porEtapa, huerfanas } = useMemo(
    () => porEtapas(delProducto, modulosActuales.map((m) => m.clave)),
    [delProducto, modulosActuales],
  );
  const filas = productoId ? avance[productoId] ?? [] : [];
  /** El título de una clase del producto, para decir en palabras un candado «Al terminar «X»». */
  const tituloDeClase = (id: number) => delProducto.find((c) => c.id === id)?.titulo ?? null;
  const etapasMin = useMemo(
    () => modulosActuales.map((m) => ({
      key: m.clave,
      label: m.nombre,
      // El candado que le puso el equipo, sobre la tarjeta (lo de siempre no se avisa).
      aviso: avisoDeBloqueo(m.vinculado ? 'vinculado' : 'suelto', m.bloqueo, (id) => delProducto.find((c) => c.id === id)?.titulo ?? null),
    })),
    [modulosActuales, delProducto],
  );
  const estiloActual = productoId != null ? estilos[productoId] : undefined;
  const clasesUgcBase = useMemo(
    () => clasesDelEditor(etapasMin, porEtapa, huerfanas, estiloActual),
    [etapasMin, porEtapa, huerfanas, estiloActual],
  );
  const porId = useMemo(() => new Map(delProducto.map((c) => [c.id, c])), [delProducto]);

  // ── LA LECCIÓN ABIERTA SE GUARDA A MANO (audio del 08/10/2026, items 1 a 4; pista EDITOR) ──
  // «Prefiero que haya un botón que me obligue a guardar de forma manual» (14:30). Lo que se edita adentro
  // de la clase vive en un BORRADOR acá (`useLeccionAbierta`, ./LeccionEditable.tsx) hasta «Guardar», y
  // salir con cambios pregunta: volver al índice, otra clase, otro curso, la vista del alumno (item 3:
  // «que no te permita entrar a la vista del alumno hasta que se actualice todo») o un link de la app.
  // ⚠️ ANTES de cualquier `return` de esta pantalla: es un hook.
  const guardarDisposicionRef = useRef<(d: 'costado' | 'abajo') => Promise<boolean>>(async () => false);
  const leccionAbierta = useLeccionAbierta({
    clases: delProducto,
    abierta: enClase ? pos.clase ?? null : null,
    disposicion: disposicionDe(estiloActual ?? estiloVacio()),
    puedeEditar,
    guardarDisposicion: (d) => guardarDisposicionRef.current(d),
    onClase: (x) => setClases((cs) => cs.map((y) => (y.id === x.id ? x : y))),
    avisar: (t) => show(t, undefined, 'bad'),
  });

  // ── Abrir una clase sin esperar (item 18, 10:40: «está tardando mucho en cargar una clase») ──
  // El editor rico baja A DEMANDA (./editor-rico-perezoso.tsx): se pide al pasar el cursor por una tarjeta
  // de clase —con las URLs de sus imágenes, que si no van en fila detrás de las otras actions de la
  // lección— y, por las dudas, cuando el navegador queda libre. Sólo para quien edita: es su editor.
  useEffect(() => {
    if (!puedeEditar) return;
    const alPasar = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('.ugc-editable[data-arr]');
      if (!el) return;
      precargarEditorRico();
      const c = porId.get(Number(el.getAttribute('data-arr')));
      if (c) precargarLeccion(c);
    };
    document.addEventListener('pointerover', alPasar, { passive: true });
    const libre = window.setTimeout(() => {
      const ric = (window as unknown as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback;
      if (ric) ric(precargarEditorRico); else precargarEditorRico();
    }, 2500);
    return () => { document.removeEventListener('pointerover', alPasar); window.clearTimeout(libre); };
  }, [puedeEditar, porId]);

  // ── EL «DESHACER» DE LA ESTRUCTURA (08/10/2026, item 18: «te falta el botón de arrepentimiento para
  //    muchas acciones, el de 5 segundos de "Deshacer"») ──
  // Cada gesto de la estructura deja el aviso de 5 segundos (`show(texto, deshacer)`, app/_ui/Toast.tsx)
  // con 3-4 palabras, y DESHACER ESCRIBE EN EL SERVER por el MISMO camino que el gesto, con el valor de
  // antes: revertir sólo la pantalla mentiría hasta el próximo F5 (AGENTS.md). Las funciones de abajo
  // (`devolverClase`, `devolverClases`, `devolverModulo`) leen TODO de lo que contesta el server y no del
  // render en el que nacieron: corren desde un aviso, segundos después, con otra pantalla.

  /** Devuelve una clase a un lugar EXACTO (su módulo y la que la seguía): por `moverClaseAAction`, el camino del arrastre. */
  const devolverClase = async (claseId: number, lugar: { clave: string; antesDe: number | null }) => {
    try {
      const r = await moverClaseAAction(claseId, lugar.clave, lugar.antesDe);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      setClases((cs) => conOrdenDe(cs.map((x) => (x.id === r.clase.id ? r.clase : x)), r.clase.productoId, r.clase.etapa, r.ids));
    } catch {
      show('No se pudo deshacer.', undefined, 'bad');
    }
  };

  /** Saca clases de la PAPELERA (mig 0223) y las vuelve a poner: el «Deshacer» de borrar. */
  const devolverClases = async (pid: number, ids: number[]) => {
    try {
      const r = await restaurarClasesAction(pid, ids);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      setClases((cs) => clasesConDevueltas(cs, r.clases));
    } catch {
      show('No se pudo deshacer.', undefined, 'bad');
    }
  };

  const mover = async (c: Clase, dir: 'arriba' | 'abajo') => {
    const ids = (porEtapa[c.etapa] ?? []).map((x) => x.id);
    const nuevos = reordenar(ids, c.id, dir);
    if (!nuevos) return;
    const antes = clases;
    // Dónde estaba, para el «Deshacer»: la clase que la seguía (un lugar EXACTO, no «uno más arriba»).
    const lugar = lugarDe(clases, c.id);
    const ordenar = (lista: number[]) => setClases((cs) => cs.map((x) => {
      const i = x.etapa === c.etapa && x.productoId === c.productoId ? lista.indexOf(x.id) : -1;
      return i >= 0 ? { ...x, orden: i } : x;
    }));
    ordenar(nuevos);
    setMoviendo(c.id);
    const r = await moverClaseAction(c.id, dir);
    setMoviendo(null);
    if (!r.ok) { setClases(antes); show(r.error, undefined, 'bad'); return; }
    // La base manda: si otra pestaña movió en el medio, su orden es el que queda.
    ordenar(r.ids);
    if (lugar) show('Clase movida', () => { void devolverClase(c.id, lugar); });
  };

  /**
   * Borrar una clase (08/10/2026, items 15 y 18): a la PAPELERA (lib/curso-admin.ts, `borrarClase`) y SIN
   * PREGUNTA — no se pierde nada: el «Deshacer» la devuelve con su avance, sus entregas y su portada
   * (AGENTS.md: «sin nada que perder no hay fricción: sale y queda el Deshacer»). Antes preguntaba
   * «Se pierde el avance de N clientes», que era verdad cuando borrar era un `delete`.
   */
  const borrar = async (c: Clase) => {
    try {
      const r = await borrarClaseAction(c.id);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    } catch {
      show('No se pudo borrar.', undefined, 'bad');
      return;
    }
    setClases((cs) => cs.filter((x) => x.id !== c.id));
    // Si era la lección abierta, su borrador se va con ella: no hay dónde guardarlo, y salir no pregunta.
    leccionAbierta.soltar(c.id);
    if (pos.clase === c.id) navegar({ mod: c.etapa }, 'reemplazar');
    show('Clase borrada', () => { void devolverClases(c.productoId, [c.id]); });
  };

  /**
   * «+ Clase»: la clase NACE en el server (`crearClaseAction`, primera de su módulo) y se abre para
   * editarla en su lugar (item 16). Antes abría el editor de la clase, un modal que se fue con
   * «Editar»: ya no hay un formulario que llenar antes de que la clase exista.
   */
  const nuevaClase = async (moduloKey: string) => {
    if (!servicio || creando) return;
    setCreando(true);
    try {
      const r = await crearClaseAction(servicio.productoId, moduloKey);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      setClases((cs) => [...cs, r.clase]);
      navegar({ mod: moduloKey, clase: r.clase.id });
    } catch {
      show('No se pudo crear la clase.', undefined, 'bad');
    } finally {
      setCreando(false);
    }
  };

  // Desde la lista (la × de una tarjeta sin menú) es el mismo borrar: sin pregunta, con «Deshacer».
  const borrarDesdeLista = (c: Clase) => borrar(c);

  if (errorEntrega) {
    return (
      <Pagina>
        <PageHeader titulo="Curso" />
        <ErrorState titulo="No pude leer tus servicios" detalle={errorEntrega} detalleTecnico={errorEntrega} />
      </Pagina>
    );
  }

  if (!servicios.length) {
    return (
      <Pagina>
        <PageHeader titulo="Curso" />
        <EmptyState titulo="Todavía no hay servicios"
          detalle="El curso cuelga de las etapas de un producto. Créalo en Clientes."
          accion={{ label: 'Ir a Clientes', href: '/customer-success' }} />
      </Pagina>
    );
  }

  const nClases = delProducto.length;

  const primeraEtapa = modulosActuales[0]?.clave ?? null;

  const cambiarProducto = (id: number) => {
    // Las etapas de dos productos pueden llamarse igual: la posición es de otro curso. Con la lección a
    // medio guardar, primero la pregunta (Guardar / Descartar / Seguir editando).
    leccionAbierta.pedirSalida(() => {
      navegar({}, 'reemplazar');
      setProductoId(id);
    });
  };

  // ── La ESTRUCTURA del curso: módulos y clases (items 6, 7, 8 y 12) ──
  // Todo optimista, como `mover`: se ve en el acto y el server confirma detrás. Lo que el server
  // contesta MANDA (los módulos como quedaron, la clase como quedó); si rechaza, vuelve a lo de antes
  // con su aviso corto («La primera etapa no se mueve.»). Una action sin red RECHAZA: cada una lleva su
  // catch, o el cambio quedaba en pantalla sobre algo que no se guardó.
  const ponerModulos = (pid: number, ms: ModuloCurso[]) => setModulosLocal((m) => ({ ...m, [pid]: ms }));

  /**
   * «+ Nuevo módulo» (item 12): vinculado por default, o sea que CREA SU ETAPA en el kanban.
   * ⚠️ VA AL FINAL DEL CURSO aunque el botón esté primero: el botón va primero para que se vea (con
   *    treinta módulos, el del final había que ir a buscarlo), y «al principio» un vinculado no puede
   *    ir (la primera etapa es la entrada del kanban: `ERROR_PRIMERA`). Después se arrastra. Y se
   *    ABRE: lo que sigue con un módulo nuevo es su primera clase.
   */
  const nuevoModulo = async (nombre: string, vinculado: boolean): Promise<boolean> => {
    if (!servicio) return false;
    const pid = servicio.productoId;
    setEstructurando(true);
    try {
      const r = await crearModuloAction(pid, { nombre, vinculado, despuesDe: modulosActuales.at(-1)?.clave ?? null });
      if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
      ponerModulos(pid, r.modulos);
      navegar({ mod: r.clave });
      return true;
    } catch {
      show('No se pudo crear el módulo.', undefined, 'bad');
      return false;
    } finally {
      setEstructurando(false);
    }
  };

  /**
   * Arrastrar un módulo (item 7) y «Mover antes / después» del menú: reordena las ETAPAS del kanban
   * (sin mover la primera) y los sueltos. El «Deshacer» vuelve al orden de antes por el MISMO camino
   * (`conDeshacer: false`: deshacer no ofrece deshacer el deshacer).
   */
  const ordenarModulos = async (claves: string[], conDeshacer = true) => {
    if (!servicio) return;
    const pid = servicio.productoId;
    const antes = modulosActuales;
    const previas = antes.map((m) => m.clave);
    ponerModulos(pid, modulosEnOrden(antes, claves));
    setEstructurando(true);
    try {
      const r = await reordenarModulosAction(pid, claves);
      if (!r.ok) { ponerModulos(pid, antes); show(r.error, undefined, 'bad'); return; }
      ponerModulos(pid, r.modulos);
      if (conDeshacer) show('Módulo movido', () => { void ordenarModulos(previas, false); });
    } catch {
      ponerModulos(pid, antes);
      show('No se pudo ordenar.', undefined, 'bad');
    } finally {
      setEstructurando(false);
    }
  };

  /** Arrastrar una clase (en su módulo, o soltada sobre otro de la barra). El «Deshacer» la devuelve a su lugar exacto. */
  const llevarClase = async (claseId: number, clave: string, antesDe: number | null) => {
    const c = porId.get(claseId);
    if (!c) return;
    const antes = clases;
    const lugar = lugarDe(clases, claseId);
    setClases((cs) => clasesConMovida(cs, claseId, clave, antesDe));
    setEstructurando(true);
    try {
      const r = await moverClaseAAction(claseId, clave, antesDe);
      if (!r.ok) { setClases(antes); show(r.error, undefined, 'bad'); return; }
      setClases((cs) => conOrdenDe(cs.map((x) => (x.id === r.clase.id ? r.clase : x)), r.clase.productoId, r.clase.etapa, r.ids));
      // Se dice siempre: a otro módulo la tarjeta se va de la vista, y en el mismo es lo que se deshace.
      if (lugar) show('Clase movida', () => { void devolverClase(claseId, lugar); });
    } catch {
      setClases(antes);
      show('No se pudo mover la clase.', undefined, 'bad');
    } finally {
      setEstructurando(false);
    }
  };

  /**
   * El interruptor «Etapa del kanban» (items 12 y 15). La clave del módulo CAMBIA (lib/curso-modulos-datos.ts,
   * `reclavear`): el server ya mudó sus clases y su portada, y acá se hace lo mismo con lo que hay en
   * memoria — si no, sus clases caerían en «Sin módulo» hasta recargar.
   *
   * APAGARLO QUITA LA ETAPA DEL KANBAN (cambió de sentido el 08/10/2026): con clientes adentro, el server
   * contesta la PREGUNTA (`pregunta`) y acá se abre ./QuitarEtapa.tsx para elegir a dónde van; con la
   * respuesta se vuelve a llamar con el destino, y se los muda SIN mensajes.
   *
   * ⚠️ EL «DESHACER» SÓLO SI NO SE MUDÓ A NADIE: devuelve la MISMA etapa en su lugar (`devolver`). Con
   *    clientes mudados no se ofrece: devolverlos sería un SEGUNDO movimiento silencioso de N personas
   *    con su reloj de etapa arrancando hoy, y la etapa no se recrea sola con ellos adentro. Prenderlo
   *    (crear la etapa) se deshace apagándola, que está vacía.
   */
  const kanban = async (m: ModuloCurso, activo: boolean, o: { destino?: string | null; devolver?: { etapa: EtapaEntrega; indice: number }; deshaciendo?: boolean } = {}) => {
    if (!servicio) return;
    const pid = servicio.productoId;
    setEstructurando(true);
    try {
      const r = await vincularModuloAction(pid, m.clave, activo, o.destino ?? null, o.devolver ?? null);
      if (!r.ok) {
        if (r.pregunta) {
          const p = r.pregunta;
          setQuitar({
            titulo: `Quitar «${m.nombre}» del kanban`, clases: null, clientes: p.clientes, destinos: p.destinos,
            boton: 'Quitar la etapa', hacer: (d) => kanban(m, false, { destino: d }),
          });
          return;
        }
        show(r.error, undefined, 'bad');
        return;
      }
      const nueva = r.clave;
      if (nueva !== m.clave) {
        setClases((cs) => clasesReclaveadas(cs, pid, m.clave, nueva));
        setEstilos((e) => (e[pid] ? { ...e, [pid]: estiloReclaveado(e[pid], m.clave, nueva) } : e));
        const conf = confirmados.current[pid];
        if (conf) confirmados.current = { ...confirmados.current, [pid]: estiloReclaveado(conf, m.clave, nueva) };
        if (pos.mod === m.clave) navegar({ mod: nueva, clase: pos.clase }, 'reemplazar');
      }
      ponerModulos(pid, r.modulos);
      if (o.deshaciendo) return;
      const ahora = r.modulos.find((x) => x.clave === nueva);
      const q = r.quitada;
      if (!activo) {
        if (q && q.movidos === 0 && ahora) show('Etapa quitada', () => { void kanban(ahora, true, { devolver: { etapa: q.etapa, indice: q.indice }, deshaciendo: true }); });
        else show('Etapa quitada');
      } else if (ahora) {
        show('Etapa creada', () => { void kanban(ahora, false, { deshaciendo: true }); });
      }
    } catch {
      show(activo ? 'No se pudo vincular.' : 'No se pudo quitar la etapa.', undefined, 'bad');
    } finally {
      setEstructurando(false);
    }
  };

  /**
   * El ACCESO de un módulo o de una clase (items 8 y 15: público, o privado con su condición). Devuelve
   * por qué no, o `null` si quedó. El «Deshacer» guarda el de antes por el mismo camino.
   */
  const candado = async (objetivo: { modulo: string } | { clase: number }, b: Bloqueo | null, conDeshacer = true): Promise<string | null> => {
    if (!servicio) return null;
    const pid = servicio.productoId;
    const previo: Bloqueo | null = 'modulo' in objetivo
      ? modulosActuales.find((x) => x.clave === objetivo.modulo)?.bloqueo ?? null
      : porId.get(objetivo.clase)?.bloqueo ?? null;
    setEstructurando(true);
    try {
      const r = await guardarBloqueoAction(pid, objetivo, b);
      if (!r.ok) return r.error;
      ponerModulos(pid, r.modulos);
      const x = r.clase;
      if (x) setClases((cs) => cs.map((y) => (y.id === x.id ? x : y)));
      if (conDeshacer && JSON.stringify(previo) !== JSON.stringify(b)) show('Acceso cambiado', () => { void candado(objetivo, previo, false); });
      return null;
    } catch {
      return 'No se pudo guardar el candado.';
    } finally {
      setEstructurando(false);
    }
  };

  // «Por área» (#665) ya no está acá: salió del menú de la clase (item 15) y vive en la tarea, al lado de
  // lo que cambia (./LeccionEditable.tsx, «Una respuesta por área»).

  /**
   * «Eliminar módulo» (08/10/2026, item 15): PREGUNTA primero —cuántas clases y cuántos clientes, corto,
   * y a dónde van sus clientes si es una etapa con gente adentro (./QuitarEtapa.tsx)— y recién ahí borra.
   * Las clases van a la PAPELERA con él (mig 0223).
   */
  const eliminarModulo = async (m: ModuloCurso) => {
    if (!servicio) return;
    const pid = servicio.productoId;
    const clasesDel = (porEtapa[m.clave] ?? []).length;
    let clientes = 0;
    let destinos: Array<{ key: string; label: string }> = [];
    if (m.vinculado) {
      try {
        const p = await previaQuitarAction(pid, m.clave);
        if (!p.ok) { show(p.error, undefined, 'bad'); return; }
        clientes = p.clientes;
        destinos = p.destinos;
      } catch {
        show('No pude contar sus clientes.', undefined, 'bad');
        return;
      }
    }
    setQuitar({
      titulo: `Eliminar «${m.nombre}»`, clases: clasesDel, clientes, destinos, boton: 'Eliminar módulo',
      hacer: (d) => borrarModulo(m, d),
    });
  };

  /**
   * Borra el módulo con lo que contestó la pregunta. Si en el medio cambió algo (alguien sumó un cliente
   * a la etapa), el server vuelve a preguntar y se vuelve a abrir la pregunta con lo de ahora.
   *
   * ⚠️ EL «DESHACER» SÓLO SI NO SE MUDÓ A NADIE (como el interruptor): devuelve el MISMO módulo, sus
   *    clases de la papelera y el orden de antes; una etapa con clientes mudados no se recrea con ellos.
   */
  const borrarModulo = async (m: ModuloCurso, destino: string | null) => {
    if (!servicio) return;
    const pid = servicio.productoId;
    const orden = modulosActuales.map((x) => x.clave);
    setEstructurando(true);
    try {
      const r = await borrarModuloAction(pid, m.clave, destino);
      if (!r.ok) {
        if (r.pregunta) {
          const p = r.pregunta;
          setQuitar({
            titulo: `Eliminar «${m.nombre}»`, clases: (porEtapa[m.clave] ?? []).length, clientes: p.clientes, destinos: p.destinos,
            boton: 'Eliminar módulo', hacer: (d) => borrarModulo(m, d),
          });
          return;
        }
        show(r.error, undefined, 'bad');
        return;
      }
      ponerModulos(pid, r.modulos);
      const idas = new Set(r.clases);
      setClases((cs) => cs.filter((x) => !idas.has(x.id)));
      if (pos.mod === m.clave) navegar({}, 'reemplazar');
      const q = r.quitada;
      if (r.movidos > 0) show('Módulo eliminado');
      else show('Módulo eliminado', () => { void devolverModulo(pid, { clave: m.clave, clases: r.clases, orden, quitada: q ? { etapa: q.etapa, indice: q.indice } : null }); });
    } catch {
      show('No se pudo borrar el módulo.', undefined, 'bad');
    } finally {
      setEstructurando(false);
    }
  };

  /** El «Deshacer» de «Eliminar módulo»: el MISMO módulo, sus clases y el orden de antes (`restaurarModuloAction`). */
  const devolverModulo = async (pid: number, datos: { clave: string; clases: number[]; orden: string[]; quitada: { etapa: EtapaEntrega; indice: number } | null }) => {
    try {
      const r = await restaurarModuloAction(pid, datos);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      ponerModulos(pid, r.modulos);
      setClases((cs) => clasesConDevueltas(cs, r.clases));
    } catch {
      show('No se pudo deshacer.', undefined, 'bad');
    }
  };

  // ── Cómo se ve el curso (mig 0214): color, títulos y portadas ──
  // Optimista, como `mover` y `marcar`: el cambio se ve en el acto y el server confirma detrás. Lo
  // que el server contesta MANDA (un color muy oscuro vuelve aclarado, `acentoLegible`).
  const estilo = (productoId != null ? estilos[productoId] : undefined) ?? estiloVacio();
  const guardarAjuste = async (a: Ajuste, v: string | null): Promise<boolean> => {
    if (productoId == null) return false;
    const pid = productoId;
    // ⚠️ Un color elegido de la paleta CANCELA el «otro» que esperaba guardarse: si no, a los 450 ms
    //    el pendiente pisaba en la base la elección explícita (revisión del 07/10/2026).
    if (a.tipo === 'acento') window.clearTimeout(timerAcento.current);
    const poner = (x: string | null) => setEstilos((m) => ({ ...m, [pid]: conAjuste(m[pid] ?? estiloVacio(), a, x) }));
    // ⚠️ UNA RESPUESTA VIEJA NO PISA A UNA MÁS NUEVA (revisión de las láminas, 08/10/2026). El texto de
    //    una lámina se manda mientras se tipea: con «Uno» y después «Uno dos» en el aire, si la de «Uno»
    //    llegaba última, el campo volvía a «Uno» con «Uno dos» guardado (medido en un arnés). Cada
    //    ajuste lleva su TURNO, y sólo la respuesta del último pedido toca la pantalla; lo CONFIRMADO se
    //    anota siempre (es lo que hay en la base).
    const clave = `${pid}:${claveDe(a)}`;
    const turno = (turnos.current[clave] ?? 0) + 1;
    turnos.current[clave] = turno;
    const vigente = () => turnos.current[clave] === turno;
    /** Vuelve a lo que el server CONFIRMÓ (no a lo de pantalla), si ésta es la respuesta del último pedido. */
    const volver = () => { if (vigente()) poner(valorDe(confirmados.current[pid] ?? estiloVacio(), a)); };
    poner(v);
    try {
      const r = await guardarEstiloCursoAction(pid, a, v);
      if (!r.ok) { volver(); show(r.error, undefined, 'bad'); return false; }
      confirmados.current = { ...confirmados.current, [pid]: conAjuste(confirmados.current[pid] ?? estiloVacio(), a, r.valor) };
      if (vigente()) poner(r.valor);
      return true;
    } catch {
      volver();
      show('No se pudo guardar.', undefined, 'bad');
      return false;
    }
  };

  // «Texto al costado / Texto abajo» se edita en el BORRADOR de la lección y se guarda con «Guardar» (audio
  // del 08/10/2026, contrato (1)): es un ajuste del CURSO, así que va por su camino de siempre.
  guardarDisposicionRef.current = (d) => guardarAjuste({ tipo: 'disposicion' }, d === 'abajo' ? 'abajo' : null);

  /** El color «otro»: el selector nativo dispara un cambio por cada movimiento; se guarda al quedarse quieto. */
  const probarAcento = (hex: string) => {
    if (productoId == null) return;
    const pid = productoId;
    // El color de ANTES de empezar a mover el selector, para el «Deshacer» (item 18): el confirmado al
    // primer movimiento, no el del último (que es un tono a mitad de camino).
    if (!otroAntes.current) otroAntes.current = { v: valorDe(confirmados.current[pid] ?? estiloVacio(), { tipo: 'acento' }) };
    setEstilos((m) => ({ ...m, [pid]: conAjuste(m[pid] ?? estiloVacio(), { tipo: 'acento' }, hex) }));
    window.clearTimeout(timerAcento.current);
    timerAcento.current = window.setTimeout(() => {
      const antes = otroAntes.current;
      otroAntes.current = null;
      void guardarAjuste({ tipo: 'acento' }, hex).then((ok) => {
        if (ok && antes && (antes.v ?? '').toUpperCase() !== hex.toUpperCase()) {
          show('Color cambiado', () => { void guardarAjuste({ tipo: 'acento' }, antes.v); });
        }
      });
    }, 450);
  };

  /** El clic en un texto (ver `TextoEditable` en app/_cursos/CursoUgc.tsx). */
  const guardarTexto = async (que: TextoUgc, valor: string): Promise<boolean> => {
    if (productoId == null) return false;
    const pid = productoId;
    if ((que.tipo === 'curso-titulo' || que.tipo === 'curso-resumen') && estiloError) {
      show('No pude leer cómo se ve el curso.', undefined, 'bad');
      return false;
    }
    // Vacío = volver al default: el nombre del producto, o la descripción automática.
    // Con su «Deshacer» (item 18, revisión final del 08/10/2026), como el nombre de un módulo o de una
    // clase: lo de antes es lo que el server CONFIRMÓ, y deshacer lo vuelve a guardar por el mismo camino.
    if (que.tipo === 'curso-titulo' || que.tipo === 'curso-resumen') {
      const a: Ajuste = { tipo: que.tipo === 'curso-titulo' ? 'titulo' : 'resumen' };
      const antes = valorDe(confirmados.current[pid] ?? estiloVacio(), a);
      const v = valor || null;
      const ok = await guardarAjuste(a, v);
      if (ok && (antes ?? null) !== v) show(a.tipo === 'titulo' ? 'Nombre cambiado' : 'Descripción cambiada', () => { void guardarAjuste(a, antes); });
      return ok;
    }
    if (!valor) { show('El nombre no puede quedar vacío.', undefined, 'bad'); return false; }
    // El nombre de ANTES, para el «Deshacer» (item 18): vuelve a guardarse por este mismo camino.
    const previo = que.tipo === 'modulo' ? modulosActuales.find((x) => x.clave === que.key)?.nombre : porId.get(que.id)?.titulo;
    const deshacer = previo && previo !== valor ? () => { void guardarTexto(que, previo); } : undefined;
    try {
      if (que.tipo === 'modulo') {
        // Un vinculado renombra su ETAPA del kanban (item 6: «que se editen en las etapas del kanban»).
        const r = await renombrarModuloAction(pid, que.key, valor);
        if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
        ponerModulos(pid, r.modulos);
        if (deshacer) show('Nombre cambiado', deshacer);
        return true;
      }
      const r = await renombrarClaseAction(que.id, valor);
      if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
      setClases((cs) => cs.map((x) => (x.id === que.id ? { ...x, titulo: r.titulo } : x)));
      if (deshacer) show('Nombre cambiado', deshacer);
      return true;
    } catch {
      show('No se pudo guardar.', undefined, 'bad');
      return false;
    }
  };

  /** «Portada»: abre el selector de siempre (degradados, fotos, subir) colgado del botón tocado. */
  const abrirPortada = (que: ObjetivoUgc, ancla: HTMLElement) => {
    const ajuste: Ajuste = que.tipo === 'curso' ? { tipo: 'portada' }
      : que.tipo === 'modulo' ? { tipo: 'portada-etapa', etapa: que.key }
        : { tipo: 'portada-clase', clase: que.id };
    setPicker({ ajuste, ancla, antes: valorDe(estilo, ajuste) });
  };

  /** El nombre de un curso: el que se le eligió, o el del producto. */
  const tituloDe = (s: ServicioCurso) => estilos[s.productoId]?.titulo ?? s.nombre;

  /** Con qué número, rótulo y nombre dibuja las láminas la pestaña «Diseños» del selector de portadas. */
  const disenosDe = (a: Ajuste): { n: number; rotulo: string; titulo: string } | undefined => {
    if (a.tipo === 'portada-etapa') {
      const m = modulosActuales.find((x) => x.clave === a.etapa);
      return m ? { n: m.n, rotulo: TEXTOS_EDITOR.modulo ?? 'Módulo', titulo: m.nombre } : undefined;
    }
    if (a.tipo === 'portada-clase') {
      const c = clasesUgcBase.find((x) => x.id === a.clase);
      return c ? { n: Number(c.vn ?? 1) || 1, rotulo: 'Clase', titulo: c.titulo } : undefined;
    }
    return undefined;
  };

  // ── El curso, con el dibujo de Conocimientos ──
  const modulos = servicio ? modulosDelEditor(etapasMin, porEtapa, huerfanas, estilo).map((m) => {
    if (m.key === SIN_ETAPA) {
      return { ...m, acciones: <span className="cu-aviso">Su módulo ya no existe</span> };
    }
    const lista = porEtapa[m.key] ?? [];
    return {
      ...m,
      acciones: (
        <span className="cu-sec-acciones">
          {lista.length > 0 && !cierraLaEtapa(lista) && modulosActuales.find((x) => x.clave === m.key)?.vinculado && (
            <span className="cu-aviso" title="Ninguna clase cierra esta etapa: el cliente no avanza solo.">No avanza sola</span>
          )}
        </span>
      ),
    };
  }) : [];

  const clasesUgc = clasesUgcBase.map((u) => {
    const c = porId.get(u.id)!;
    // El candado propio de la clase (item 8), dicho para quien la arma: va con los demás chips.
    const candadoChip = chipDeBloqueo(c.bloqueo, tituloDeClase);
    // «Cierra el módulo» sólo donde cierra algo: en un módulo que es una etapa del kanban (lo mismo que
    // mira la lección para ofrecer el interruptor, `ctx.vinculado` más abajo).
    const vinculado = modulosActuales.find((m) => m.clave === c.etapa)?.vinculado ?? false;
    return {
      ...u,
      // La lección abierta dibuja su título del BORRADOR (el clic en el título lo edita ahí, sin guardar).
      ...(leccionAbierta.claseId === u.id && leccionAbierta.borrador ? { titulo: leccionAbierta.borrador.titulo } : {}),
      chips: [...chipsDelEditor(c, vinculado), ...(candadoChip ? [candadoChip] : [])]
        .map((ch) => <ChipUgc key={ch.texto} tono={ch.tono}>{ch.texto}</ChipUgc>),
    };
  });

  /**
   * La lección: se edita EN SU LUGAR (./LeccionEditable.tsx). Lo que guarda cada parte vuelve acá
   * (`onClase`), así las tarjetas y la vista del alumno dicen lo mismo sin recargar. Las preguntas
   * («¿Quitar el video?») las dibuja ESTA pantalla, afuera del curso: adentro, la hoja del curso le
   * saca el fondo y el borde a los botones de un diálogo.
   */
  const leccion = (id: number): LeccionUgc => {
    const c = porId.get(id);
    if (!c || !servicio) return {};
    const ctx: CtxLeccion = {
      productoId: servicio.productoId,
      puedeEditar,
      // De los módulos COMO QUEDARON acá: desvincular uno cambia si sus clases pueden cerrar la etapa.
      vinculado: modulosActuales.find((m) => m.clave === c.etapa)?.vinculado ?? false,
      conAvance: conAvance[c.id] ?? 0,
      onClase: (x) => setClases((cs) => cs.map((y) => (y.id === x.id ? x : y))),
      avisar: (t) => show(t, undefined, 'bad'),
      confirmar: (mensaje, o) => confirm(mensaje, { title: o.titulo, confirmLabel: o.boton }),
      // ── Pista LECCIÓN, 08/10/2026 ──
      // El «Deshacer» de 5 segundos (item 18): el MISMO toast de la tab, afuera del curso.
      deshacer: (t, f) => show(t, f),
      // «Una respuesta por área» (items 9 y 15) se ofrece si el curso les pide a sus clientes sus áreas.
      cursoPideAreas: delProducto.some((x) => x.campos.some((f) => f.id === CAMPO_AREAS)),
      // El borrador de la lección abierta y su barra de «Guardar» (audio del 08/10/2026, item 1).
      leccion: leccionAbierta,
    };
    const l = leccionDelEditor(c, ctx);
    // LOS COMENTARIOS DE LA CLASE (item 13 del audio del 08/10/2026, minuto 15:00: «un apartado de chat…
    // para chatear acerca de esa clase»), en el hueco de abajo de la lección: el equipo los lee y contesta
    // acá, y los ve también en la tab Comunidad («Ver en Comunidad», `?post=`). Sólo con el ajuste
    // prendido en el menú de la marca. Lo que ya traiga la lección en ese hueco va primero.
    if (!comentariosPrendidos(estiloActual) || !apiComunidad) return l;
    return {
      ...l,
      despues: (
        <>
          {l.despues}
          <ComentariosClase key={c.id} api={apiComunidad} claseId={c.id}
            linkComunidad={(postId) => conWs(`/customer-success/comunidad?producto=${c.productoId}&post=${postId}`, wsPestana)} />
        </>
      ),
    };
  };

  // Lo que en la pantalla vieja era la cabecera de la tab: los avisos de lectura. Van ADENTRO del
  // curso, debajo del buscador (`arriba`): Martín pidió sacar la barra de arriba entera, «que no
  // aparezca absolutamente nada... ni el título» (07/10/2026).
  //
  // ⚠️ SIN EL RECUADRO «Configura tu curso» (item 3): lo reemplazó el RECORRIDO (`PASOS_RECORRIDO`,
  //    abajo). ./ChecklistCurso.tsx queda: lo importan la cartera de Clientes (`Paso`) y la página
  //    (el tipo de los pasos).
  // ⚠️ «NO PUDE LEER TUS CLIENTES» SE DICE: sin ellos «Invitar alumnos» abriría una lista vacía, que
  //    se leería como que no hay a quién invitar.
  const avisos = (
    (productoId && errorClases[productoId]) || estiloError || avanceError
  ) ? (
    <div className="cu-arriba">
      {productoId && errorClases[productoId] && <Banner tono="bad">No pude leer las clases. {errorClases[productoId]}</Banner>}
      {estiloError && <Banner tono="bad">No pude leer cómo se ve el curso. {estiloError}</Banner>}
      {avanceError && <Banner tono="bad">No pude leer tus clientes. {avanceError}</Banner>}
    </div>
  ) : undefined;

  // ── Los menús «…» de un módulo y de una clase (items 12 y 15): los arma esta pantalla ──
  // UN menú con la MISMA forma para los dos (./MenuCurso.tsx, `seccionesDelMenu`): Renombrar, Portada,
  // Mover antes / después · Público o privado · (módulo) Etapa del kanban · Eliminar. «Mover a» y «Por
  // área» salieron (una clase se lleva a otro módulo arrastrándola a la barra; «Por área» va con la tarea).
  const clasesParaMenu = delProducto.map((c) => ({ id: c.id, etapa: c.etapa, titulo: c.titulo }));
  /** La ENTRADA del kanban (su primera columna): no se quita ni se elimina desde el curso. */
  const claveEntrada = servicio?.etapas[0]?.key ?? null;
  const menuModulo = (m: ModuloUgc, ctl: ControlMenuUgc) => {
    const mc = modulosActuales.find((x) => x.clave === m.key);
    if (!mc) return null;
    const claves = modulosActuales.map((x) => x.clave);
    const mover = (dir: -1 | 1) => { const n = clavesConMovido(claves, mc.clave, dir); return n ? () => { void ordenarModulos(n); } : null; };
    return (
      <MenuModulo modulo={mc} entrada={mc.vinculado && mc.clave === claveEntrada} clases={clasesParaMenu} ctl={ctl} ocupado={estructurando}
        onMover={{ antes: mover(-1), despues: mover(1) }}
        onPortada={estiloError ? undefined : (a) => abrirPortada({ tipo: 'modulo', key: mc.clave }, a)}
        onBloqueo={(b) => candado({ modulo: mc.clave }, b)}
        onKanban={(v) => { void kanban(mc, v); }}
        onEliminar={() => { void eliminarModulo(mc); }} />
    );
  };
  const menuClase = (u: ClaseUgc, ctl: ControlMenuUgc) => {
    const c = porId.get(u.id);
    if (!c) return null;
    const mover1 = (dir: 'arriba' | 'abajo') => (puedeMoverEnEditor(clasesUgc, c.id, dir) ? () => { void mover(c, dir); } : null);
    // «Obligatoria para avanzar» (audio del 08/10/2026, item 7): en una etapa del kanban, o prendida (para
    // poder apagarla). Apagada sin tarea GUARDADA, con su motivo; si la tarea está en el borrador, otro.
    const vinculado = modulosActuales.find((m) => m.clave === c.etapa)?.vinculado ?? false;
    const enBorrador = leccionAbierta.claseId === c.id && leccionAbierta.borrador
      ? tieneTarea({ tarea: '', tareaHtml: leccionAbierta.borrador.tareaHtml, campos: leccionAbierta.borrador.campos })
      : false;
    return (
      <MenuClase clase={c} clases={clasesParaMenu} ctl={ctl} ocupado={estructurando}
        onPortada={estiloError ? undefined : (a) => abrirPortada({ tipo: 'clase', id: c.id }, a)}
        onRenombrar={async (t) => ((await guardarTexto({ tipo: 'clase', id: c.id }, t)) ? null : 'No se guardó.')}
        onMover={{ antes: mover1('arriba'), despues: mover1('abajo') }}
        onBloqueo={(b) => candado({ clase: c.id }, b)}
        onEliminar={() => { void borrar(c); }}
        obligatoria={ofreceObligatoria(vinculado, c.obligatoria) ? {
          prendida: c.obligatoria,
          motivo: motivoObligatoria({ prendida: c.obligatoria, tareaGuardada: tieneTarea(c), tareaEnBorrador: enBorrador }),
          onCambiar: (v) => { void cambiarObligatoria(c, v); },
        } : undefined} />
    );
  };

  /**
   * «Obligatoria para avanzar» desde el menú «…» de la clase (audio del 08/10/2026, item 7, 13:00: «ese
   * botón tal vez no se debería configurar ahí [en la tarea], sino… en el desplegable de cada clase»).
   * INMEDIATO, como el resto del menú —es de la clase, no de la lección que se edita—, y con «Deshacer»
   * por el MISMO camino (`guardarCampoClaseAction`): deshacer escribe en el server.
   */
  const cambiarObligatoria = async (c: Clase, v: boolean, conDeshacer = true) => {
    setEstructurando(true);
    try {
      const r = await guardarCampoClaseAction(c.id, { obligatoria: v });
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      setClases((cs) => cs.map((x) => (x.id === r.clase.id ? r.clase : x)));
      if (conDeshacer) show(v ? 'Obligatoria prendida' : 'Obligatoria apagada', () => { void cambiarObligatoria(r.clase, !v, false); });
    } catch {
      show('No se pudo guardar.', undefined, 'bad');
    } finally {
      setEstructurando(false);
    }
  };

  /**
   * La barra de arriba (item 9 y el recorrido del item 3): lo que se hace con el curso ENTERO, a la
   * vista. «Invitar alumnos» abre el modal de ./InvitarAlumnos.tsx (tus clientes sin invitar, o
   * alguien nuevo que entra como cliente al kanban); «Vista del alumno» abre el ensayo sin lead.
   * ⚠️ VA ARRIBA A LA DERECHA, EN EL LUGAR DEL NOMBRE DEL CURSO, en este orden (item 14 del 08/10/2026:
   *    «Vista de alumnos, invitar a alumno y ? deberían estar donde hoy está "Negocio que escala" 106
   *    clases»): `acciones` de CursoUgc. El alumno sigue viendo ahí el nombre.
   */
  const barraDeArriba = (
    <>
      {/* ⚠️ CON LA LECCIÓN SIN GUARDAR NO SE ENTRA (audio del 08/10/2026, item 3, 15:40: «que no te permita
          entrar a la vista del alumno hasta que se actualice todo»): el link lo ataja `useLeccionAbierta` y
          ofrece «Guardar y ver» (`data-guardar-y-ver`). Sin `prefetch`: una vista bajada antes de guardar
          mostraría la clase de antes. */}
      {productoId != null && (
        <Link className="ugc-btn" href={hrefVistaPrevia(productoId)} prefetch={false} data-recorrido="vista-alumno" data-guardar-y-ver>Vista del alumno</Link>
      )}
      <button type="button" className="ugc-btn" data-recorrido="invitar" onClick={() => setInvitando(true)}>Invitar alumnos</button>
      {/* El «?» abre el recorrido del LUGAR donde está: adentro de una clase, el de la clase (item 1). */}
      {puedeEditar && (
        <BotonRecorrido objetivo="ayuda" titulo={enClase ? 'Ver la guía de la clase' : 'Ver la guía del curso'}
          onClick={enClase ? recorridoClase.reabrir : recorrido.reabrir} />
      )}
    </>
  );

  /**
   * EL ASPECTO DEL CURSO CON SU «DESHACER» (item 18 del 08/10/2026: «Te falta el botón de
   * arrepentimiento para muchas acciones»): el color y la fuente. El valor de antes es el que el server
   * CONFIRMÓ (no el de pantalla: con el color «otro», lo de pantalla es un tono a mitad de camino), y
   * deshacer lo vuelve a guardar por el MISMO camino, o sea que escribe en el server (AGENTS.md: un
   * deshacer que sólo revierte la pantalla miente hasta el próximo F5).
   */
  const cambiarAspecto = async (a: Ajuste, v: string | null, aviso: string) => {
    if (productoId == null) return;
    if (a.tipo === 'acento') otroAntes.current = null;
    const antes = valorDe(confirmados.current[productoId] ?? estiloVacio(), a);
    if (antes === v) return;
    if (await guardarAjuste(a, v)) show(aviso, () => { void guardarAjuste(a, antes); });
  };

  /**
   * EL MENÚ DE LA MARCA: el curso que se mira (era un desplegable aparte), el COLOR y la FUENTE (item 3
   * del 08/10/2026: «Las tipografías se deberían editar en el mismo lugar que se editan los colores»).
   * Es el lugar donde Martín lo pidió: «el desplegable debería ser "Negocio que Escala" de la sidebar».
   * ⚠️ «Vista del alumno» e «Invitar alumnos» YA NO ESTÁN ACÁ desde el 08/10/2026 (item 14): son los
   *    botones de arriba a la derecha, siempre a la vista. Dos lugares para la misma acción parten la
   *    respuesta en dos (AGENTS.md, «contá los controles que ya contestan esa misma pregunta»).
   */
  const acentoActual = estilo.acento ?? ACENTO_DEFAULT;
  const menuMarca = (cerrar: () => void) => (
    <>
      <TituloMenuUgc>Cursos</TituloMenuUgc>
      {servicios.map((s) => (
        <ItemMenuUgc key={s.productoId} activo={s.productoId === productoId}
          onClick={() => { cerrar(); if (s.productoId !== productoId) cambiarProducto(s.productoId); }}>
          {tituloDe(s)}
        </ItemMenuUgc>
      ))}
      {/* «+ Nuevo producto» (item 17 del audio del 08/10/2026, minuto 00:40: «hoy en día tenés que irte
          al CRM y en el CRM pones nuevo producto… eso yo también lo voy a poner ahí en el mismo curso»).
          Al final de la lista de cursos, como en el selector del CRM; el nombre se pide AFUERA del curso
          (./NuevoProducto.tsx). Crear un producto es de un admin, como editar el curso.
          ⚠️ Con la lección a medio guardar, PRIMERO la pregunta (revisión final del 08/10/2026), como al
          cambiar de curso: crear navega DURO al curso nuevo, y sin esto la salida la atajaba el
          `beforeunload` del navegador — con el producto ya creado y el diálogo clavado en «Creando…» si se
          elegía quedarse. */}
      {puedeEditar && (
        <ItemMenuUgc onClick={() => { cerrar(); leccionAbierta.pedirSalida(() => setCreandoProducto(true)); }}>+ Nuevo producto</ItemMenuUgc>
      )}
      {puedeEditar && !estiloError && (
        <>
          <div className="ugc-menu-sep" />
          <TituloMenuUgc>Color</TituloMenuUgc>
          <div className="ugc-swatches">
            {ACENTOS.map((a) => (
              <button key={a.hex} type="button" className="ugc-swatch" style={{ background: a.hex }}
                aria-pressed={acentoActual === a.hex} title={a.nombre} aria-label={a.nombre}
                onClick={() => void cambiarAspecto({ tipo: 'acento' }, a.hex === ACENTO_DEFAULT ? null : a.hex, 'Color cambiado')} />
            ))}
            {/* Cualquier otro color. Uno muy oscuro vuelve aclarado: el acento es FONDO de texto
                oscuro (lib/curso-estilo.ts, `acentoLegible`). */}
            <label className={`ugc-swatch ugc-swatch--otro${ACENTOS.some((a) => a.hex === acentoActual) ? '' : ' on'}`} title="Otro color">
              <input type="color" value={acentoActual} aria-label="Otro color" onChange={(e) => probarAcento(e.target.value)} />
            </label>
          </div>
          <div className="ugc-menu-sep" />
          <TituloMenuUgc>Fuente</TituloMenuUgc>
          {/* Cada fuente escrita con ella misma; cambia el curso entero, el del alumno también. No
              cierra el menú: se prueba mirando, como el color. */}
          <SelectorFuente actual={estilo.fuente} onElegir={(id) => void cambiarAspecto({ tipo: 'fuente' }, id, 'Fuente cambiada')} />
          {/* «Comentarios en las clases» (item 13 del audio del 08/10/2026): un ajuste del CURSO, como el
              color, APAGADO por default (lib/curso-estilo.ts). Prendido, cada clase tiene sus comentarios
              debajo de la lección, en el portal y acá. Con su «Deshacer» por el mismo camino. */}
          <div className="ugc-menu-sep" />
          <TituloMenuUgc>Clases</TituloMenuUgc>
          <button type="button" className="ugc-menu-item" role="switch" aria-checked={comentariosPrendidos(estilo)}
            onClick={() => void cambiarAspecto({ tipo: 'comentarios' }, comentariosPrendidos(estilo) ? null : 'si',
              comentariosPrendidos(estilo) ? 'Comentarios apagados' : 'Comentarios prendidos')}>
            <span aria-hidden>{comentariosPrendidos(estilo) ? '☑' : '☐'}</span> Comentarios en las clases
          </button>
        </>
      )}
    </>
  );

  if (!servicio) {
    return (
      <Pagina>
        <ErrorState titulo="No encontré ese producto" />
      </Pagina>
    );
  }

  return (
    // ⚠️ SIN CABECERA: el curso ES la pantalla, como en Conocimientos. Lo que había arriba se mudó
    //    al menú de la marca (el producto) y a la barra del curso (la vista del alumno, invitar, el «?»).
    <Pagina ancho="completo" style={{ padding: 0 }}>
      <CursoUgc
        key={servicio.productoId}
        modo="pagina"
        // El NOMBRE del curso: lo que se lee mientras carga la hoja. Arriba a la derecha va en su lugar
        // `acciones` (item 14): el nombre ya está en la marca y en la portada.
        titulo={tituloDe(servicio)}
        subtitulo={`${nClases} ${nClases === 1 ? 'clase' : 'clases'}`}
        // Dónde va el texto de la lección: lo mismo que ve el alumno (item 16). Con una lección abierta, la
        // de su BORRADOR (se cambia en la lección y se guarda con «Guardar»).
        disposicion={leccionAbierta.borrador?.disposicion ?? disposicionDe(estilo)}
        marca={{ ...marcaDelProducto(tituloDe(servicio)), menu: menuMarca, ariaLabel: `${tituloDe(servicio)}: cambiar de curso` }}
        acento={estilo.acento}
        // La fuente del curso (item 3): la misma que ve el alumno en su portal.
        fuente={estilo.fuente}
        modulos={modulos}
        clases={clasesUgc}
        portada={{
          eyebrow: 'Curso',
          titulo: tituloDe(servicio),
          // Editando, la descripción vacía muestra su invitación; el alumno ve su avance en su lugar.
          resumen: puedeEditar ? (estilo.resumen ?? '') : (estilo.resumen ?? `${modulosActuales.length} ${modulosActuales.length === 1 ? 'módulo' : 'módulos'} · ${nClases} clases`),
          ...tapaDe(estilo.portada),
        }}
        leccion={(clase) => leccion(clase.id)}
        arriba={avisos}
        // Arriba a la DERECHA, en el lugar del nombre del curso (item 14): quien edita ve sus acciones.
        acciones={barraDeArriba}
        // ⚠️ SIN «Avance de los clientes» (item 4): es una vista de /customer-success.
        edicion={puedeEditar ? {
          // ── La estructura (items 6, 7, 8 y 12): ver las funciones de arriba ──
          onNuevoModulo: nuevoModulo,
          opcionNuevoModulo: 'Etapa del kanban',
          // El tope del nombre de una etapa, que es el de todo módulo (`nombreDeModulo`, lib/curso-modulos.ts):
          // el campo dejaba escribir 80 y el server rebotaba a partir de 40.
          topeNombreModulo: TOPE_NOMBRE_ETAPA,
          onOrdenarModulos: (claves) => { void ordenarModulos(claves); },
          onLlevarClase: (id, clave, antesDe) => { void llevarClase(id, clave, antesDe); },
          menuModulo,
          menuClase,
          onNueva: (k) => { const m = k === SIN_ETAPA ? primeraEtapa : k; if (m) void nuevaClase(m); },
          onMover: (id, dir) => { const c = porId.get(id); if (c) void mover(c, dir); },
          onBorrar: (id) => { const c = porId.get(id); if (c) void borrarDesdeLista(c); },
          puedeMover: (id, dir) => puedeMoverEnEditor(clasesUgc, id, dir),
          ocupado: moviendo !== null || creando || estructurando,
          // El clic en el título de la LECCIÓN ABIERTA escribe en su borrador (audio del 08/10/2026, item 1):
          // se guarda con «Guardar». Lo demás (un módulo, el curso) sigue guardándose en el acto.
          onTexto: (que, valor) => {
            if (que.tipo !== 'clase' || leccionAbierta.claseId !== que.id) return guardarTexto(que, valor);
            if (!valor) { show('El nombre no puede quedar vacío.', undefined, 'bad'); return Promise.resolve(false); }
            leccionAbierta.cambiar({ titulo: valor });
            return Promise.resolve(true);
          },
          onPortada: estiloError ? undefined : abrirPortada,
          // «Texto al costado / Texto abajo» (item 16): un ajuste del CURSO, como el color. Desde el audio
          // del 08/10/2026 va al BORRADOR de la lección y se guarda con ella (`guardarDisposicionRef`).
          onDisposicion: estiloError ? undefined : (d) => { leccionAbierta.cambiar({ disposicion: d === 'abajo' ? 'abajo' : 'costado' }); },
        } : undefined}
        textos={TEXTOS_EDITOR}
      />

      {picker && (
        // El MISMO selector de las portadas del tablero y de la ficha del cliente: degradados,
        // fotos y subir. Elegir no lo cierra (se prueba mirando), y lo que se elige se guarda.
        <PortadaPicker
          valor={valorDe(estilo, picker.ajuste)}
          colorBase={acentoActual}
          ancla={picker.ancla}
          titulo="Portada"
          sinAutomatico
          // LAS LÁMINAS DISEÑADAS (item 5): la pestaña «Diseños», con el cuaderno de siempre adentro
          // («cambio la portada de 1, y luego ya no aparecen»). Sólo para un módulo o una clase: la
          // portada del curso no tiene número, y nada la dibujaría.
          disenos={disenosDe(picker.ajuste)}
          // «Miniatura del video» (item 20, pista LECCIÓN): la tapa de una clase con video. Es la del
          // default (sin portada elegida), así que elegirla es volver a él.
          video={picker.ajuste.tipo === 'portada-clase' ? miniaturaDeClase(porId.get(picker.ajuste.clase)) : undefined}
          onElegir={(v) => { void guardarAjuste(picker.ajuste, v); }}
          // El «Deshacer» va al CERRAR y no en cada elección: elegir no cierra (se prueba mirando), así que
          // la unidad de lo que la persona decidió es la vuelta entera, y deshacer vuelve a la de antes.
          onCerrar={() => {
            const { ajuste, antes } = picker;
            setPicker(null);
            if ((valorDe(estilo, ajuste) ?? null) !== (antes ?? null)) show('Portada cambiada', () => { void guardarAjuste(ajuste, antes); });
          }}
        />
      )}

      {/* Los dos recorridos (items 1, 3 y 19): sólo para quien arma el curso, que es a quien le señalan
          las acciones. Montados los dos siempre: cada uno se dibuja sólo cuando está abierto. */}
      {puedeEditar && <Recorrido id={RECORRIDO_CURSO} pasos={PASOS_RECORRIDO} abierto={recorrido.abierto} onCerrar={recorrido.onCerrar} />}
      {puedeEditar && <Recorrido id={RECORRIDO_LECCION} pasos={PASOS_RECORRIDO_LECCION} abierto={recorridoClase.abierto} onCerrar={recorridoClase.onCerrar} />}

      {invitando && (
        <ModalInvitarAlumnos productoId={servicio.productoId} producto={tituloDe(servicio)} filas={filas}
          onCerrar={() => setInvitando(false)} />
      )}
      {/* «+ Nuevo producto» (item 17): AFUERA del curso, como las preguntas de abajo. */}
      {creandoProducto && <NuevoProducto onCerrar={() => setCreandoProducto(false)} />}

      {/* ⚠️ AFUERA DEL CURSO, a propósito: las preguntas de la lección («¿Quitar el video?») son un
          diálogo de la app, y adentro de la hoja del curso sus botones quedan sin fondo ni borde. */}
      {confirmNode}
      {/* «Hay cambios sin guardar»: Guardar / Descartar / Seguir editando (audio del 08/10/2026, item 1).
          AFUERA del curso, por lo mismo que las de arriba. */}
      {leccionAbierta.dialogo}
      {/* La pregunta de antes de quitar una etapa o eliminar un módulo (items 15): también AFUERA del curso.
          `onCerrar` cierra SÓLO esta pregunta: si la respuesta trajo otra (el server volvió a preguntar
          porque cambió algo en el medio), ésa queda abierta. */}
      {quitar && (
        <QuitarEtapa key={JSON.stringify([quitar.titulo, quitar.clientes, quitar.destinos.map((d) => d.key)])} pregunta={quitar}
          onCerrar={() => setQuitar((q) => (q === quitar ? null : q))} />
      )}
      <Toast state={toast} onClose={clear} />
      <style dangerouslySetInnerHTML={{ __html: CSS + CSS_PORTAL + CSS_MENU_CURSO }} />
    </Pagina>
  );
}

// ⚠️ El video de la clase, la ficha y el papel (descripción y tarea) viven en ./LeccionEditable.tsx
// desde el 08/10/2026, con sus estilos. Acá queda lo de la pantalla de la tab.
// (Revisión final del 08/10/2026: se fueron `.cu-curso` y `.cu-avance`, que no los usaba nadie desde que
// el curso se dibuja con CursoUgc y el Avance se mudó a Clientes.)
const CSS = `
.cu-sec-acciones{ display:inline-flex; flex-wrap:wrap; align-items:center; gap:8px; }
.cu-aviso{ font-family: var(--font-jetbrains), monospace; font-size: 11px; font-weight: 700;
  padding: 5px 10px; border-radius: 999px; background: #ffe2a3; border: 1.5px solid var(--u-ink, #16150f); }
`;
