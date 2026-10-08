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
//     notas, sin «Grabar / No grabar» y sin pestañas: Martín pidió sacar las cuatro.
//   · La ESTRUCTURA, editable en su lugar (items 6, 7, 8 y 12 del 07/10/2026): «+ Nuevo módulo» y
//     «+ Nueva clase» primero, el nombre de un módulo con un clic (renombra su etapa del kanban),
//     módulos y clases que se ARRASTRAN (el gesto del Plan), y el menú «…» de cada uno
//     (./MenuCurso.tsx): la portada, «Es una etapa del kanban», cuándo se abre, borrar.
//   · «Invitar alumnos» y «Vista del alumno» en la barra de arriba, y el RECORRIDO de la tab.
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
import Link from '@/app/_ui/Link';
import { PortadaPicker } from '@/app/_components/PortadaPicker';
import type { Clase } from '@/lib/curso';
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
import { leccionDelEditor, type CtxLeccion } from './LeccionEditable';
import type { EtapaVista } from './AvanceCurso';
import type { OnboardingCurso } from './ChecklistCurso';
// ── El editor de la ESTRUCTURA (pedido del 07/10/2026, items 3 a 9, 11 y 12) ──
import { Recorrido, BotonRecorrido, useRecorrido, type PasoRecorrido } from '@/app/_ui/Recorrido';
import { claveDe } from '@/lib/curso-estilo';
import type { Bloqueo } from '@/lib/curso-bloqueo';
import {
  borrarModuloAction, crearModuloAction, guardarBloqueoAction, guardarCampoClaseAction, moverClaseAAction,
  reordenarModulosAction, vincularModuloAction,
} from './modulos-actions';
import { MenuClase, MenuModulo } from './MenuCurso';
import { avisoDeBloqueo, chipDeBloqueo } from './bloqueo-editor';
import { clasesConMovida, clasesReclaveadas, clavesConMovido, conOrdenDe, estiloReclaveado, modulosEnOrden } from './estructura';
import { ModalInvitarAlumnos } from './InvitarAlumnos';
import type { ClaseUgc, ControlMenuUgc, ModuloUgc } from '@/app/_cursos/tipos';

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

/**
 * EL RECORRIDO DE LA TAB (item 3, Martín, 07/10/2026): «Elimina el recuadro de "Configura tu curso"…
 * haz el típico tutorial de app, donde se pone todo medio oscuro y salen flechas apuntándote a las
 * acciones disponibles». Cada paso señala un `data-recorrido` de la pantalla (los del dibujo están en
 * app/_cursos/CursoUgc.tsx; «Invitar» y «Vista del alumno», en la barra de arriba de acá). Un paso
 * cuyo objetivo no está en pantalla se saltea solo (app/_ui/Recorrido.tsx): sin módulos no hay
 * «Tus módulos».
 *
 * ⚠️ TEXTOS CORTOS (una frase): es texto de pantalla. El porqué de cada cosa va en el código.
 */
const PASOS_RECORRIDO: PasoRecorrido[] = [
  { objetivo: 'marca', titulo: 'Tu programa', texto: 'Elige qué curso editas, su color y la vista del alumno.', lado: 'derecha' },
  { objetivo: 'titulo', titulo: 'El nombre del curso', texto: 'Haz clic para cambiarlo.' },
  { objetivo: 'portada', titulo: 'La portada', texto: 'Pasa el cursor y elige su imagen.' },
  { objetivo: 'nuevo-modulo', titulo: 'Nuevo módulo', texto: 'Escribe su nombre: crea su etapa en el kanban.' },
  { objetivo: 'modulo', titulo: 'Tus módulos', texto: 'Arrástralos para ordenarlos. Clic en el nombre para cambiarlo.', lado: 'derecha' },
  { objetivo: 'invitar', titulo: 'Invita alumnos', texto: 'Tus clientes o alguien nuevo.' },
  { objetivo: 'vista-alumno', titulo: 'Vista del alumno', texto: 'Mira el curso como lo ve tu cliente.' },
];

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
  const [picker, setPicker] = useState<{ ajuste: Ajuste; ancla: HTMLElement } | null>(null);
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
  /** Un cambio de la ESTRUCTURA esperando al server: los controles se apagan, no desaparecen. */
  const [estructurando, setEstructurando] = useState(false);
  const timerAcento = useRef<number | undefined>(undefined);
  /** El turno de cada ajuste del estilo (ver `guardarAjuste`): una respuesta vieja no pisa una más nueva. */
  const turnos = useRef<Record<string, number>>({});
  // El recorrido de la tab (item 3): se abre solo la primera vez, para quien arma el curso.
  const recorrido = useRecorrido('cs-curso', { autoabrir: puedeEditar });
  // Dónde está parado: la lista del onboarding va sólo en el índice.
  const { pos } = usePosicion();
  const { toast, show, clear } = useToast();
  const { confirm, confirmNode } = useConfirm();

  const servicio = servicios.find((s) => s.productoId === productoId) ?? null;

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

  const mover = async (c: Clase, dir: 'arriba' | 'abajo') => {
    const ids = (porEtapa[c.etapa] ?? []).map((x) => x.id);
    const nuevos = reordenar(ids, c.id, dir);
    if (!nuevos) return;
    const antes = clases;
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
  };

  const borrar = async (c: Clase) => {
    const r = await borrarClaseAction(c.id);
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    setClases((cs) => cs.filter((x) => x.id !== c.id));
    show('Clase borrada');
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

  const borrarDesdeLista = async (c: Clase) => {
    const n = conAvance[c.id] ?? 0;
    const ok = await confirm(
      n > 0 ? `Se pierde el avance de ${n} ${n === 1 ? 'cliente' : 'clientes'}.` : 'Nadie la empezó todavía.',
      { title: `¿Borrar «${c.titulo}»?`, confirmLabel: 'Borrar' },
    );
    if (ok) await borrar(c);
  };

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
    // Las etapas de dos productos pueden llamarse igual: la posición es de otro curso.
    navegar({}, 'reemplazar');
    setProductoId(id);
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

  /** Arrastrar un módulo (item 7): reordena las ETAPAS del kanban (sin mover la primera) y los sueltos. */
  const ordenarModulos = async (claves: string[]) => {
    if (!servicio) return;
    const pid = servicio.productoId;
    const antes = modulosActuales;
    ponerModulos(pid, modulosEnOrden(antes, claves));
    setEstructurando(true);
    try {
      const r = await reordenarModulosAction(pid, claves);
      if (!r.ok) { ponerModulos(pid, antes); show(r.error, undefined, 'bad'); return; }
      ponerModulos(pid, r.modulos);
    } catch {
      ponerModulos(pid, antes);
      show('No se pudo ordenar.', undefined, 'bad');
    } finally {
      setEstructurando(false);
    }
  };

  /** Arrastrar una clase (en su módulo, o soltada sobre otro de la barra) y «Mover a» del menú. */
  const llevarClase = async (claseId: number, clave: string, antesDe: number | null) => {
    const c = porId.get(claseId);
    if (!c) return;
    const antes = clases;
    setClases((cs) => clasesConMovida(cs, claseId, clave, antesDe));
    setEstructurando(true);
    try {
      const r = await moverClaseAAction(claseId, clave, antesDe);
      if (!r.ok) { setClases(antes); show(r.error, undefined, 'bad'); return; }
      setClases((cs) => conOrdenDe(cs.map((x) => (x.id === r.clase.id ? r.clase : x)), r.clase.productoId, r.clase.etapa, r.ids));
      // A otro módulo, la tarjeta se va de la vista: se dice a dónde fue.
      if (clave !== c.etapa) show('Clase movida');
    } catch {
      setClases(antes);
      show('No se pudo mover la clase.', undefined, 'bad');
    } finally {
      setEstructurando(false);
    }
  };

  /**
   * «Es una etapa del kanban» (item 12). La clave del módulo CAMBIA (lib/curso-modulos-datos.ts,
   * `reclavear`): el server ya mudó sus clases y su portada, y acá se hace lo mismo con lo que hay en
   * memoria — si no, sus clases caerían en «Sin módulo» hasta recargar.
   */
  const vincular = async (m: ModuloCurso, v: boolean): Promise<string | null> => {
    if (!servicio) return null;
    const pid = servicio.productoId;
    setEstructurando(true);
    try {
      const r = await vincularModuloAction(pid, m.clave, v);
      if (!r.ok) return r.error;
      const nueva = r.clave;
      if (nueva !== m.clave) {
        setClases((cs) => clasesReclaveadas(cs, pid, m.clave, nueva));
        setEstilos((e) => (e[pid] ? { ...e, [pid]: estiloReclaveado(e[pid], m.clave, nueva) } : e));
        const conf = confirmados.current[pid];
        if (conf) confirmados.current = { ...confirmados.current, [pid]: estiloReclaveado(conf, m.clave, nueva) };
        if (pos.mod === m.clave) navegar({ mod: nueva, clase: pos.clase }, 'reemplazar');
      }
      ponerModulos(pid, r.modulos);
      return null;
    } catch {
      return v ? 'No se pudo vincular.' : 'No se pudo desvincular.';
    } finally {
      setEstructurando(false);
    }
  };

  /** El candado de un módulo o de una clase (item 8, D2). Devuelve por qué no, o `null` si quedó. */
  const candado = async (objetivo: { modulo: string } | { clase: number }, b: Bloqueo | null): Promise<string | null> => {
    if (!servicio) return null;
    const pid = servicio.productoId;
    setEstructurando(true);
    try {
      const r = await guardarBloqueoAction(pid, objetivo, b);
      if (!r.ok) return r.error;
      ponerModulos(pid, r.modulos);
      const x = r.clase;
      if (x) setClases((cs) => cs.map((y) => (y.id === x.id ? x : y)));
      return null;
    } catch {
      return 'No se pudo guardar el candado.';
    } finally {
      setEstructurando(false);
    }
  };

  /** «Por área» de una clase (#665): cada área del cliente contesta su tarea. */
  const porArea = async (c: Clase, v: boolean): Promise<string | null> => {
    try {
      const r = await guardarCampoClaseAction(c.id, { porArea: v });
      if (!r.ok) return r.error;
      setClases((cs) => cs.map((y) => (y.id === r.clase.id ? r.clase : y)));
      return null;
    } catch {
      return 'No se pudo guardar.';
    }
  };

  /** Borrar un módulo SUELTO y VACÍO (el menú no lo ofrece para otro: ver ./MenuCurso.tsx). */
  const borrarModulo = async (m: ModuloCurso) => {
    if (!servicio) return;
    const pid = servicio.productoId;
    setEstructurando(true);
    try {
      const r = await borrarModuloAction(pid, m.clave);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      ponerModulos(pid, r.modulos);
      if (pos.mod === m.clave) navegar({}, 'reemplazar');
      show('Módulo borrado');
    } catch {
      show('No se pudo borrar el módulo.', undefined, 'bad');
    } finally {
      setEstructurando(false);
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

  /** El color «otro»: el selector nativo dispara un cambio por cada movimiento; se guarda al quedarse quieto. */
  const probarAcento = (hex: string) => {
    if (productoId == null) return;
    const pid = productoId;
    setEstilos((m) => ({ ...m, [pid]: conAjuste(m[pid] ?? estiloVacio(), { tipo: 'acento' }, hex) }));
    window.clearTimeout(timerAcento.current);
    timerAcento.current = window.setTimeout(() => { void guardarAjuste({ tipo: 'acento' }, hex); }, 450);
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
    if (que.tipo === 'curso-titulo') return guardarAjuste({ tipo: 'titulo' }, valor || null);
    if (que.tipo === 'curso-resumen') return guardarAjuste({ tipo: 'resumen' }, valor || null);
    if (!valor) { show('El nombre no puede quedar vacío.', undefined, 'bad'); return false; }
    try {
      if (que.tipo === 'modulo') {
        // Un vinculado renombra su ETAPA del kanban (item 6: «que se editen en las etapas del kanban»).
        const r = await renombrarModuloAction(pid, que.key, valor);
        if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
        ponerModulos(pid, r.modulos);
        return true;
      }
      const r = await renombrarClaseAction(que.id, valor);
      if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
      setClases((cs) => cs.map((x) => (x.id === que.id ? { ...x, titulo: r.titulo } : x)));
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
    setPicker({ ajuste, ancla });
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
    };
    return leccionDelEditor(c, ctx);
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

  // ── Los menús «…» de un módulo y de una clase (item 12): los arma esta pantalla ──
  const clasesParaMenu = delProducto.map((c) => ({ id: c.id, etapa: c.etapa, titulo: c.titulo }));
  const menuModulo = (m: ModuloUgc, ctl: ControlMenuUgc) => {
    const mc = modulosActuales.find((x) => x.clave === m.key);
    if (!mc) return null;
    const claves = modulosActuales.map((x) => x.clave);
    const mover = (dir: -1 | 1) => { const n = clavesConMovido(claves, mc.clave, dir); return n ? () => { void ordenarModulos(n); } : null; };
    return (
      <MenuModulo modulo={mc} conClases={(porEtapa[mc.clave] ?? []).length} clases={clasesParaMenu} ctl={ctl} ocupado={estructurando}
        onMover={{ antes: mover(-1), despues: mover(1) }}
        onPortada={estiloError ? undefined : (a) => abrirPortada({ tipo: 'modulo', key: mc.clave }, a)}
        onVincular={(v) => vincular(mc, v)}
        onBloqueo={(b) => candado({ modulo: mc.clave }, b)}
        onBorrar={() => void borrarModulo(mc)} />
    );
  };
  const menuClase = (u: ClaseUgc, ctl: ControlMenuUgc) => {
    const c = porId.get(u.id);
    if (!c) return null;
    return (
      <MenuClase clase={c} modulos={modulosActuales} clases={clasesParaMenu} ctl={ctl} ocupado={estructurando}
        onPortada={estiloError ? undefined : (a) => abrirPortada({ tipo: 'clase', id: c.id }, a)}
        onBloqueo={(b) => candado({ clase: c.id }, b)}
        onPorArea={(v) => porArea(c, v)}
        onMover={(k) => void llevarClase(c.id, k, null)}
        onBorrar={() => void borrarDesdeLista(c)} />
    );
  };

  /**
   * La barra de arriba (item 9 y el recorrido del item 3): lo que se hace con el curso ENTERO, a la
   * vista. «Invitar alumnos» abre el modal de ./InvitarAlumnos.tsx (tus clientes sin invitar, o
   * alguien nuevo que entra como cliente al kanban); «Vista del alumno» abre el ensayo sin lead.
   */
  const barraDeArriba = (
    <>
      {productoId != null && (
        <Link className="ugc-btn" href={hrefVistaPrevia(productoId)} data-recorrido="vista-alumno">Vista del alumno</Link>
      )}
      <button type="button" className="ugc-btn" data-recorrido="invitar" onClick={() => setInvitando(true)}>Invitar alumnos</button>
      {puedeEditar && <BotonRecorrido onClick={recorrido.reabrir} />}
    </>
  );

  /**
   * EL MENÚ DE LA MARCA. Lo que estaba en la barra de arriba que se sacó: el producto que se mira
   * (era un desplegable aparte), la vista del alumno, y lo nuevo, el color. Es el lugar donde
   * Martín lo pidió: «el desplegable debería ser "Negocio que Escala" de la sidebar».
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
      {puedeEditar && !estiloError && (
        <>
          <div className="ugc-menu-sep" />
          <TituloMenuUgc>Color</TituloMenuUgc>
          <div className="ugc-swatches">
            {ACENTOS.map((a) => (
              <button key={a.hex} type="button" className="ugc-swatch" style={{ background: a.hex }}
                aria-pressed={acentoActual === a.hex} title={a.nombre} aria-label={a.nombre}
                onClick={() => void guardarAjuste({ tipo: 'acento' }, a.hex === ACENTO_DEFAULT ? null : a.hex)} />
            ))}
            {/* Cualquier otro color. Uno muy oscuro vuelve aclarado: el acento es FONDO de texto
                oscuro (lib/curso-estilo.ts, `acentoLegible`). */}
            <label className={`ugc-swatch ugc-swatch--otro${ACENTOS.some((a) => a.hex === acentoActual) ? '' : ' on'}`} title="Otro color">
              <input type="color" value={acentoActual} aria-label="Otro color" onChange={(e) => probarAcento(e.target.value)} />
            </label>
          </div>
        </>
      )}
      {productoId != null && (
        <>
          <div className="ugc-menu-sep" />
          <Link className="ugc-menu-item" href={hrefVistaPrevia(productoId)} onClick={cerrar}>Vista del alumno</Link>
        </>
      )}
      {/* El mismo modal que el botón de la barra de arriba (item 9): uno solo, con un solo estado. */}
      <ItemMenuUgc onClick={() => { cerrar(); setInvitando(true); }}>Invitar alumnos</ItemMenuUgc>
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
    //    al menú de la marca (el producto, la vista del alumno) y al pie del buscador (las clases).
    <Pagina ancho="completo" style={{ padding: 0 }}>
      <CursoUgc
        key={servicio.productoId}
        modo="pagina"
        // Arriba a la derecha va el NOMBRE del curso, como en Conocimientos: «Curso» era el título
        // de la barra que Martín pidió sacar («ni el título»).
        titulo={tituloDe(servicio)}
        subtitulo={`${nClases} ${nClases === 1 ? 'clase' : 'clases'}`}
        // Dónde va el texto de la lección: lo mismo que ve el alumno (item 16).
        disposicion={disposicionDe(estilo)}
        marca={{ ...marcaDelProducto(tituloDe(servicio)), menu: menuMarca, ariaLabel: `${tituloDe(servicio)}: cambiar de curso` }}
        acento={estilo.acento}
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
        topbarExtra={barraDeArriba}
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
          onTexto: guardarTexto,
          onPortada: estiloError ? undefined : abrirPortada,
          // «Texto al costado / Texto abajo» (item 16): un ajuste del CURSO, como el color. Al costado
          // es el default, y volver a él borra la fila (`sanearAjuste`).
          onDisposicion: estiloError ? undefined : (d) => { void guardarAjuste({ tipo: 'disposicion' }, d === 'abajo' ? 'abajo' : null); },
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
          onElegir={(v) => { void guardarAjuste(picker.ajuste, v); }}
          onCerrar={() => setPicker(null)}
        />
      )}

      {/* El recorrido (item 3): sólo para quien arma el curso, que es a quien le señala las acciones. */}
      {puedeEditar && <Recorrido id="cs-curso" pasos={PASOS_RECORRIDO} abierto={recorrido.abierto} onCerrar={recorrido.onCerrar} />}

      {invitando && (
        <ModalInvitarAlumnos productoId={servicio.productoId} producto={tituloDe(servicio)} filas={filas}
          onCerrar={() => setInvitando(false)} />
      )}

      {/* ⚠️ AFUERA DEL CURSO, a propósito: las preguntas de la lección («¿Quitar el video?») son un
          diálogo de la app, y adentro de la hoja del curso sus botones quedan sin fondo ni borde. */}
      {confirmNode}
      <Toast state={toast} onClose={clear} />
      <style dangerouslySetInnerHTML={{ __html: CSS + CSS_PORTAL }} />
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
