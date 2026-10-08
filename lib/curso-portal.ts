// =============================================================================
// curso-portal — lo que arma la vista del ALUMNO (el portal de su link personal)
// =============================================================================
// «Quiero que los clientes de Mauricio puedan ingresar a MaKo con un nivel de acceso especial
// que solo ellos tienen, donde solo ven las clases de Mauricio y las tareas» (Martín, 06/10/2026).
// El portal vive en /compartido/curso/<token> y escribe por /api/compartido/curso/{progreso,tarea}
// y sirve el video subido por /api/compartido/curso/video. El modelo y su porqué, en la cabecera
// de supabase/migrations/0202_curso.sql; las reglas del curso, en lib/curso.ts.
//
// #665 (06/10/2026, mig 0212): el mismo portal abre el link del LÍDER de un área (`c2.`), que ve
// SÓLO las clases por área de su área (`decidirClase` con `lider`, `armarModulos` con `opts.lider`);
// una clase por área se contesta una vez por área (`areaDeLaTarea`); y el link de agenda de una etapa
// viaja recién con la etapa completa (`armarModulos`).
//
// 08/10/2026 (D1 y D2 de docs/diseno-curso-skool.md): el portal arma MÓDULOS, no etapas. Un módulo
// vinculado es una etapa del kanban y uno SUELTO no (lib/curso-modulos.ts); hasta acá las clases de
// un módulo que no era una etapa se tiraban sin aviso. Y cada módulo y cada clase pasan por su
// CANDADO (lib/curso-bloqueo.ts): el de siempre —la posición en el kanban— es ahora uno de ocho.
//
// Dos mitades en el mismo archivo:
//   · LO PURO (qué módulo y qué clase se abren, qué reproductor lleva cada clase, si una clase se le
//     abre al alumno, el tope del cuerpo): lo EJECUTA tests/curso-portal.test.ts.
//   · LO QUE LEE (armarVistaAlumno, claseDelAlumno): corre en el server, adentro de
//     `runWithWorkspace(firma.ws, …)` con el workspace que sale de la FIRMA del link.
//
// ⚠️ ES LA ÚNICA PUERTA. Lo que se dibuja (`armarVistaAlumno` → `armarModulos`) y lo que las rutas
// dejan leer o escribir (`claseDelAlumno`) deciden con la MISMA evaluación (`aperturasDe`, que es
// `evaluarBloqueos` con el curso armado una vez): con dos, el portal mostraría abierta una clase cuya
// tarea la ruta rechaza, o al revés.
//
// ⚠️ SIN `import 'server-only'` ARRIBA, A PROPÓSITO, y las lecturas importan sus módulos con
// `await import(...)`: así el test puede importar la mitad pura sin que `server-only` (que tira
// fuera de la condición react-server) lo voltee. Lo que mantiene esto fuera del navegador sigue
// siendo `server-only`: lib/curso-datos.ts y lib/workspace.ts lo llevan, y un componente cliente
// que llamara a `armarVistaAlumno` arrastraría ese import y el build lo frenaría. Es el mismo
// criterio que `productosDelAlumno` (lib/curso-datos.ts) usa para no traerse la pantalla entera.

import {
  tieneTarea, obligatoriasDe, reproductorDeClase, etapaCompleta, nombreDeArea, camposParaAlumno,
  type VideoVista, type Clase, type Progreso, type Campo, type Valores, type EstadoTarea, type Calificacion,
} from './curso';
import { agendaValida } from './servicio-etapas';
import { estiloVacio, soloDeClases, type EstiloCurso } from './curso-estilo';
import { moduloPermitido, type AlcanceCurso } from './curso-alcance';
import {
  estadosDeEtapas, aperturasDe, claseCompleta, MOTIVO_MANUAL,
  type Aperturas, type ContextoBloqueo, type EstadoEtapa,
} from './curso-bloqueo';
import type { ModuloCurso } from './curso-modulos';

// ── Las etapas del kanban ─────────────────────────────────────────────────────

// `estadosDeEtapas` y `EstadoEtapa` viven en lib/curso-bloqueo.ts desde el 08/10/2026 (el bloqueo
// `etapa` es uno de los ocho candados); se re-exportan para quien los importaba de acá.
export { estadosDeEtapas };
export type { EstadoEtapa };

/** ¿El alumno puede abrir (ver el video, mandar la tarea) algo de una etapa en este estado? */
export const etapaAbierta = (e: EstadoEtapa | undefined): boolean => e === 'hecha' || e === 'actual';

/**
 * ¿Esta clase se le abre a ESTE alumno? Lo deciden las rutas públicas antes de leer o escribir
 * nada de la clase.
 *
 *   · `no-existe` → 404. También cuando la clase existe pero es de un producto que el cliente no
 *     compró: un link válido no abre el curso de otro producto, y contestar distinto («existe,
 *     pero no es tuya») ayudaría a enumerar ids.
 *   · `bloqueada` → la clase está CERRADA para él (su candado, o el de su módulo, o es de un módulo
 *     que ya no existe: la pantalla no la muestra, así que tampoco se escribe).
 *
 * `abierta` (lo que contestó `aperturasDe` para ESTA clase) sólo cuenta cuando `exigeAbierta`.
 *
 * `lider`: el área del LÍDER que abrió el portal con su link (#665); `null`/ausente = el cliente.
 * ⚠️ AL LÍDER SÓLO SE LE ABREN LAS CLASES POR ÁREA, y una que no lo es contesta `no-existe`, igual
 * que una ajena: el líder de Ventas no tiene por qué saber que existe el cuestionario de números
 * del dueño. Es la regla en el SERVER: lo que no se dibuja tampoco se lee ni se escribe.
 */
export type DecisionClase = 'ok' | 'no-existe' | 'bloqueada';
export function decidirClase(
  clase: Pick<Clase, 'productoId' | 'porArea'> | null,
  productosDelAlumno: readonly number[],
  abierta: boolean | undefined,
  exigeAbierta: boolean,
  lider: string | null = null,
): DecisionClase {
  if (!clase) return 'no-existe';
  if (!productosDelAlumno.includes(clase.productoId)) return 'no-existe';
  if (lider != null && clase.porArea !== true) return 'no-existe';
  if (exigeAbierta && abierta !== true) return 'bloqueada';
  return 'ok';
}

/**
 * De qué área es la tarea que se está guardando, o `null` si el pedido no puede escribirla.
 *
 *   · El LÍDER escribe SIEMPRE su área, la de su acceso: lo que mande el pedido no cuenta (una
 *     clase por área, ya lo filtró `decidirClase`).
 *   · El CLIENTE, en una clase que no es por área (o sin áreas declaradas): la suya, `''`. Y en una
 *     por área con áreas: la que pide, si es UNA DE SUS ÁREAS — un nombre inventado dejaría una
 *     fila que ningún «etapa completa» cuenta.
 */
export function areaDeLaTarea(
  clase: Pick<Clase, 'porArea'>,
  acceso: { area: string | null },
  pedida: unknown,
  areasDelCliente: readonly string[],
): string | null {
  if (acceso.area != null) return clase.porArea === true ? acceso.area : null;
  const p = nombreDeArea(pedida);
  if (clase.porArea !== true || !areasDelCliente.length) return p ? null : '';
  return areasDelCliente.includes(p) ? p : null;
}

// ── El video de una clase ─────────────────────────────────────────────────────

// ⚠️ LA REGLA VIVE EN lib/curso.ts (`reproductorDeClase`) desde el 06/10/2026: la tab Curso, la
// ficha y este portal decidían cada uno por su cuenta si un video «se mide», con dos funciones
// del mismo nombre y formas distintas. Coincidían, y el primer tipo nuevo (o el arreglo del Vimeo
// no listado) las habría separado: la tab diciendo «se mide» sobre un video que el portal no
// puede medir. El nombre de acá se conserva porque lo usan la página y su test.
export type { VideoVista } from './curso';
export const videoDeClase = reproductorDeClase;

// ── La vista ──────────────────────────────────────────────────────────────────

export type ClaseVista = {
  id: number;
  titulo: string;
  descripcion: string;
  /**
   * La descripción RICA (mig 0216), SANEADA EN EL SERVER otra vez antes de viajar (`armarVistaAlumno`
   * la pasa por `sanearHtml`): `''` = no tiene, y se dibuja `descripcion`. Los adjuntos van por
   * referencia (`mako-adjunto:<id>`) y los traduce quien dibuja, con el token del alumno.
   */
  descripcionHtml: string;
  minutos: number | null;
  video: VideoVista | null;
  /** % visto (0-100). `null` = este video NO se puede medir: la pantalla dice «sin medir», no 0%. */
  pct: number | null;
  tarea: string;
  /**
   * La consigna de la tarea con formato (mig 0226), SANEADA OTRA VEZ antes de viajar
   * (`conHtmlSaneado`). `null` = no tiene: se dibuja `tarea`. Las tareas de más viajan adentro de
   * `campos` (las `seccion`, con su consigna también re-saneada): las agrupa `tareasDeClase`.
   */
  tareaHtml?: string | null;
  campos: Campo[];
  tieneTarea: boolean;
  obligatoria: boolean;
  estado: EstadoTarea;
  valores: Valores;
  /**
   * La marcó HECHA (mig 0220): el tilde de una clase SIN tarea. Siempre `false` en una con tarea
   * (ésa se completa enviándola).
   */
  hecha: boolean;
  /**
   * ¿La completó? (lib/curso-bloqueo.ts, `claseCompleta`: envió la tarea, o la marcó hecha, o vio el
   * video). Es lo que abre lo que espera a «la anterior».
   */
  completa: boolean;
  /**
   * Una clase POR ÁREA (#665): una tarea por área, cada una con lo suyo. AUSENTE en una clase que
   * se contesta una vez (y la lista blanca de tests/curso-portal.test.ts sigue valiendo para ésas).
   * Al cliente le llegan todas sus áreas; al líder, SÓLO la suya — lo que contestó otra área no
   * viaja a su navegador.
   */
  areas?: TareaDeArea[];
  /**
   * La versión de la IA de su respuesta, PENDIENTE de que la apruebe o la corrija (paso 5 de #665).
   * AUSENTE si no hay una pendiente (y en una clase con áreas: viaja en cada área). Una ya aprobada o
   * corregida no viaja: ya es su respuesta, o la descartó.
   */
  ia?: PropuestaVista;
  /**
   * La nota de sus quizzes (#18, mig 0218): en qué quedó cada uno y cuántos intentos usó. AUSENTE si
   * no hay. La pone `claseVista`; con áreas viajaría en cada área (todavía no: ver lib/curso-entregas.ts).
   */
  calificacion?: Calificacion;
};

/**
 * Una clase CERRADA adentro de un módulo abierto (D2): viaja SÓLO su título y el porqué. Ni el
 * video, ni la descripción, ni la tarea, ni lo que contestó: lo que no se abre no viaja.
 */
export type ClaseCerrada = { id: number; titulo: string; cerrada: true; motivo: string };
export type ClaseDelModulo = ClaseVista | ClaseCerrada;
export const esClaseCerrada = (c: ClaseDelModulo): c is ClaseCerrada => (c as ClaseCerrada).cerrada === true;

/**
 * Lo que viaja de una propuesta pendiente: la versión de la IA y su `desde`, que es el token con el
 * que se aprueba (compare-and-set). De qué grabación salió no viaja: es del equipo.
 */
export type PropuestaVista = { valores: Valores; desde: string };

/** La tarea de UNA área de una clase por área. */
export type TareaDeArea = { area: string; estado: EstadoTarea; valores: Valores; ia?: PropuestaVista; calificacion?: Calificacion };

/**
 * La propuesta que viaja al navegador: sólo una PENDIENTE (ver `ClaseVista.ia`).
 *
 * ⚠️ SALE DEL PROGRESO QUE SE LE PASA, que es el de ESTE alumno (`avanceDelCliente(leadId)` filtra
 * por el lead de la firma) y de ESTA área: quien llama decide de qué fila. Por eso nunca puede viajar
 * la propuesta de otro cliente, ni al líder la de otra área (lo fija tests/curso-propuesta.test.ts).
 */
export function propuestaVista(p: Progreso | undefined): PropuestaVista | undefined {
  return p?.ia?.estado === 'pendiente' ? { valores: p.ia.valores, desde: p.ia.desde } : undefined;
}

/**
 * Un MÓDULO del curso, como lo ve el alumno.
 *
 * ⚠️ UNO CERRADO SE VE Y NO SE ABRE: viajan su nombre, cuántas clases tiene, sus números y el porqué
 * (`motivo`), nunca sus clases (`clases: []`). Es el mapa del programa: esconderlo haría que el curso
 * pareciera más corto de lo que es. Un módulo que sus PERMISOS no le dan, en cambio, no viaja en
 * absoluto (ni el nombre).
 */
export type ModuloVista = {
  /** La clave del módulo (la de su etapa si es vinculado). */
  key: string;
  /** Su nombre (el de su etapa si es vinculado). */
  label: string;
  vinculado: boolean;
  /** Sólo los vinculados: dónde está el alumno en el kanban respecto de esta etapa. */
  etapa?: EstadoEtapa;
  /** ¿Se le abre? (su candado y lo abierto a mano, ya evaluados en el server). */
  abierto: boolean;
  /** Cerrado: por qué, CORTO («Se abre al terminar «Arranque»»). Ausente si está abierto. */
  motivo?: string;
  /**
   * El link para agendar la sesión de su ETAPA (su Calendly), SÓLO si es vinculado, está abierto y el
   * alumno la completó (#665). Ausente = no hay link, o todavía no: en los dos casos no viaja.
   */
  agendaUrl?: string;
  /** Vacío en un módulo cerrado: lo que no se abre no viaja al navegador. */
  clases: ClaseDelModulo[];
  /** Cuántas clases tiene, aunque esté cerrado (para decir «3 clases» sin mandarlas). */
  cuantas: number;
  /** Tareas obligatorias del módulo y cuántas ya envió (lo que cierra la ETAPA, ver `etapaCompleta`). */
  obligatorias: number;
  enviadas: number;
  /**
   * TODAS las tareas del módulo y cuántas envió: lo que se le muestra al alumno. Con sólo las
   * obligatorias la cabecera decía «0 de 1 tarea enviada» arriba de ocho clases marcadas «Tarea
   * pendiente», y la ficha del equipo «0/9 tareas» sobre la misma etapa (06/10/2026).
   */
  tareas: number;
  tareasEnviadas: number;
  /** ¿Completó todas sus clases? (lo que abre al módulo que espera a «el anterior»). */
  completo: boolean;
};

export type ProductoVista = {
  productoId: number; nombre: string; modulos: ModuloVista[];
  /**
   * Cómo se ve el curso (mig 0214): el color, el título, la descripción y las portadas que eligió
   * el equipo (`estiloVacio()` = el de siempre). Viaja al alumno a propósito: es lo que él tiene que
   * ver, con las portadas recortadas a las clases abiertas y a los módulos que viajan.
   * ⚠️ OBLIGATORIO a propósito: opcional, borrar la línea que lo llena en `armarVistaAlumno` o en la
   *    vista previa compilaba y el alumno veía el lima de siempre sin que nada avisara.
   */
  estilo: EstiloCurso;
};
/**
 * `area`: el área del LÍDER que abrió el portal (#665); `null` = es el cliente. Con un líder,
 * `nombre` es `null`: el nombre del lead es el del CLIENTE, y saludar al líder con él sería
 * llamarlo como a otra persona.
 */
export type VistaAlumno = { nombre: string | null; area: string | null; productos: ProductoVista[] };

const enviada = (e: EstadoTarea | undefined) => e === 'enviada' || e === 'aprobada';

/**
 * Una clase ABIERTA, como la ve el alumno: lo que se guarda en el bucket, el `origen` y el candado no
 * viajan.
 *
 * ⚠️ LOS CAMPOS VIAJAN SIN LAS RESPUESTAS CORRECTAS DE LOS QUIZZES (`camposParaAlumno`, #18): ésta es
 * la única puerta por la que llegan al navegador del alumno (el portal, /mi-curso y la vista previa
 * arman la vista acá), y un quiz con las correctas en el HTML se aprueba leyendo la página. El quiz se
 * corrige en el server (/api/compartido/curso/tarea). Lo fija tests/curso-tareas-tipos.test.ts.
 *
 * `calificacion`: la nota de sus quizzes (mig 0218), para que vea en qué quedó y cuántos intentos le
 * quedan. AUSENTE si no hay (y la lista blanca de tests/curso-portal.test.ts sigue valiendo).
 *
 * ⚠️ `descripcionHtml` SALE COMO ESTÁ GUARDADA (ya saneada al guardar): quien la manda al navegador la
 * vuelve a sanear (`conHtmlSaneado`), que es lo que hace `armarVistaAlumno`.
 */
export function claseVista(c: Clase, p: Progreso | undefined, areas?: TareaDeArea[]): ClaseVista {
  const { video, medible } = videoDeClase(c);
  const calificacion = !areas && p?.calificacion && Object.keys(p.calificacion).length ? p.calificacion : null;
  const conTarea = tieneTarea(c);
  return {
    id: c.id, titulo: c.titulo, descripcion: c.descripcion, descripcionHtml: c.descripcionHtml ?? '', minutos: c.minutos, video,
    pct: medible ? Math.max(0, Math.min(100, p?.pct ?? 0)) : null,
    tarea: c.tarea, tareaHtml: c.tareaHtml ?? null,
    campos: camposParaAlumno(c.campos), tieneTarea: conTarea, obligatoria: c.obligatoria,
    // Con áreas, lo contestado vive en cada área: el `valores` de la fila del cliente no viaja.
    estado: p?.estado ?? 'pendiente', valores: areas ? {} : p?.valores ?? {},
    hecha: !conTarea && !!p?.hechaAt,
    completa: claseCompleta(c, p),
    ...(areas ? { areas } : {}),
    // Y su propuesta, igual: con áreas, la de cada área viaja en SU área (al líder, sólo la suya).
    ...(!areas && propuestaVista(p) ? { ia: propuestaVista(p) } : {}),
    ...(calificacion ? { calificacion } : {}),
  };
}

/**
 * Lo que `armarModulos` necesita saber de las áreas (#665). Todo opcional: sin esto arma el portal
 * de antes (lo usan así la vista previa del equipo y los tests de siempre).
 *   · `porArea`: lo que contestó cada área (claseId → área → progreso).
 *   · `areas`: las áreas que declaró el cliente.
 *   · `lider`: el área del líder que mira; ausente = mira el cliente.
 */
export type OpcionesVista = {
  porArea?: ReadonlyMap<number, ReadonlyMap<string, Progreso>>;
  areas?: readonly string[];
  lider?: string | null;
};

/** Lo que entra a `armarModulos`. */
export type EntradaModulos = {
  /** Los módulos del curso, en su orden (`derivarModulos`). */
  modulos: readonly ModuloCurso[];
  /** El kanban de la entrega ENTERO (también las etapas que no son módulo), con su link de agenda. */
  etapas: readonly { key: string; label: string; agendaUrl?: string }[];
  /** La etapa en la que está HOY en el kanban (sin fila = la primera). */
  actual: string | null | undefined;
  clases: readonly Clase[];
  /** El progreso EFECTIVO (`progresoEfectivo`). */
  progreso: ReadonlyMap<number, Progreso>;
  /** Los permisos (lib/curso-alcance.ts). Un módulo no permitido NO viaja. Default: todo. */
  permitido?: (clave: string) => boolean;
  /** Las fechas, su nivel y lo abierto a mano. Default: nada de eso (lo que depende queda cerrado). */
  contexto?: ContextoBloqueo;
  opts?: OpcionesVista;
};

/**
 * Los módulos de un producto con sus clases, en el orden del curso, cada uno con su candado ya
 * evaluado (`aperturasDe`).
 *
 * ⚠️ UNA CLASE CUYO MÓDULO YA NO EXISTE NO SE MUESTRA. Su etapa se borró del kanban (o se sacó del
 * curso con `enCurso: false` sin mudar sus clases): dibujarla «en algún lado» la pondría en un módulo
 * que no es el suyo. Las rutas la tratan igual (`claseDelAlumno` → cerrada).
 *
 * ⚠️ LO CERRADO NO VIAJA. De un módulo cerrado: su nombre, `cuantas`, sus números y el motivo. De una
 * clase cerrada adentro de un módulo abierto: su título y el motivo (`ClaseCerrada`). De un módulo que
 * sus permisos no le dan: nada.
 *
 * ⚠️ EL LINK DE AGENDA (`agendaUrl` de la etapa, #665) VIAJA SÓLO CON LA ETAPA COMPLETA
 * (`etapaCompleta`, la misma regla que mueve al cliente), el módulo abierto, y nunca al líder de un
 * área: la sesión es del cliente con Mauricio. Antes de eso no está en el HTML: no se esconde al
 * pintar, no se manda. La traba es BLANDA (el link existe afuera, lib/servicio-etapas.ts lo dice). Un
 * módulo SUELTO no tiene etapa y por eso tampoco agenda.
 *
 * `progreso` es el EFECTIVO (`progresoEfectivo`): una clase por área cuenta enviada cuando la
 * enviaron todas sus áreas. Con `opts.lider`, el portal es el del líder: sólo las clases por área,
 * sólo los módulos que tienen alguna, y de cada una SÓLO lo que contestó su área.
 */
export function armarModulos(p: EntradaModulos): ModuloVista[] {
  const opts = p.opts ?? {};
  const lider = opts.lider ?? null;
  const areas = opts.areas ?? [];
  const permitido = p.permitido ?? (() => true);
  const estados = estadosDeEtapas(p.etapas.map((e) => e.key), p.actual);
  const agendaDe = new Map(p.etapas.map((e) => [e.key, e.agendaUrl]));
  const porModulo = new Map<string, Clase[]>();
  for (const c of p.clases) {
    if (!porModulo.has(c.etapa)) porModulo.set(c.etapa, []);
    porModulo.get(c.etapa)!.push(c);
  }
  // ⚠️ AL LÍDER no se le NOMBRA en un motivo lo que no ve (revisión del 08/10/2026): una clase que no
  // es por área, o un módulo que no tiene ninguna. «Se abre al terminar «Tus números»» le contaría que
  // existe el cuestionario del dueño, que es justo lo que #665 no le muestra.
  const porAreaIds = new Set(p.clases.filter((c) => c.porArea === true).map((c) => c.id));
  const nombrable = lider != null ? {
    clase: (id: number) => porAreaIds.has(id),
    modulo: (clave: string) => (porModulo.get(clave) ?? []).some((c) => porAreaIds.has(c.id)),
  } : undefined;
  const ap: Aperturas = aperturasDe({
    modulos: p.modulos, etapas: p.etapas, actual: p.actual, clases: p.clases, progreso: p.progreso,
    permitido, contexto: p.contexto, nombrable,
  });
  /** Lo de UNA área, como lo guardó (o pendiente si nunca la tocó). */
  const tareaDe = (c: Clase, area: string): TareaDeArea => {
    const pr = opts.porArea?.get(c.id)?.get(area);
    const ia = propuestaVista(pr);
    // La nota de sus quizzes (mig 0218): sin esto, al recargar, el líder no ve en qué quedó.
    const calificacion = pr?.calificacion && Object.keys(pr.calificacion).length ? pr.calificacion : null;
    return {
      area, estado: pr?.estado ?? 'pendiente', valores: pr?.valores ?? {},
      ...(ia ? { ia } : {}), ...(calificacion ? { calificacion } : {}),
    };
  };
  /** Las tareas por área que viajan con la clase. `undefined` = se contesta una vez. */
  const areasDe = (c: Clase): TareaDeArea[] | undefined => {
    if (c.porArea !== true) return undefined;
    if (lider != null) return [tareaDe(c, lider)];
    return areas.length ? areas.map((a) => tareaDe(c, a)) : undefined;
  };
  /** El estado que se le muestra: el efectivo al cliente; al líder, el de SU área. */
  const estadoDe = (id: number): EstadoTarea | undefined => {
    if (lider == null) return p.progreso.get(id)?.estado;
    return opts.porArea?.get(id)?.get(lider)?.estado;
  };
  const out: ModuloVista[] = [];
  for (const m of p.modulos) {
    if (!permitido(m.clave)) continue;
    const todas = (porModulo.get(m.clave) ?? []).slice().sort((a, b) => a.orden - b.orden || a.id - b.id);
    const deModulo = lider != null ? todas.filter((c) => c.porArea === true) : todas;
    if (lider != null && !deModulo.length) continue;
    const a = ap.modulos.get(m.clave) ?? { abierta: false, motivo: MOTIVO_MANUAL };
    const etapa = m.vinculado ? estados[m.clave] : undefined;
    const ob = obligatoriasDe(deModulo);
    // ⚠️ LA AGENDA MIRA LA ETAPA ENTERA (`todas`), con la regla que mueve al cliente: no la del líder.
    const agenda = m.vinculado && lider == null && a.abierta && etapaAbierta(etapa)
      && etapaCompleta(todas, (id) => p.progreso.get(id)?.estado)
      ? agendaValida(agendaDe.get(m.clave))
      : null;
    out.push({
      key: m.clave, label: m.nombre, vinculado: m.vinculado,
      ...(etapa ? { etapa } : {}),
      abierto: a.abierta,
      ...(!a.abierta ? { motivo: a.motivo ?? MOTIVO_MANUAL } : {}),
      ...(agenda ? { agendaUrl: agenda } : {}),
      clases: a.abierta
        ? deModulo.map((c): ClaseDelModulo => {
          const ac = ap.clases.get(c.id);
          if (!ac?.abierta) return { id: c.id, titulo: c.titulo, cerrada: true, motivo: ac?.motivo ?? MOTIVO_MANUAL };
          const deAreas = areasDe(c);
          const vista = claseVista(c, p.progreso.get(c.id), deAreas);
          // Al líder, el chip de la clase dice en qué quedó SU área, no el de todas.
          return lider != null && deAreas ? { ...vista, estado: deAreas[0].estado } : vista;
        })
        : [],
      cuantas: deModulo.length,
      obligatorias: ob.length,
      enviadas: ob.filter((c) => enviada(estadoDe(c.id))).length,
      tareas: deModulo.filter((c) => tieneTarea(c)).length,
      tareasEnviadas: deModulo.filter((c) => tieneTarea(c) && enviada(estadoDe(c.id))).length,
      completo: todas.every((c) => claseCompleta(c, p.progreso.get(c.id))),
    });
  }
  return out;
}

/**
 * Los módulos con la descripción rica pasada OTRA VEZ por el saneo del server, que es lo último que
 * pasa antes de viajar. Se guardó saneada (lib/html-seguro.ts, `validarHtmlRico`), pero la lista
 * blanca puede achicarse después de guardar, y lo que dibuja el navegador es lo que manda esta
 * función. `sanear` se pasa desde afuera porque lib/html-seguro.ts es `server-only` y este módulo lo
 * importa un test.
 */
export function conHtmlSaneado(modulos: readonly ModuloVista[], sanear: (html: string) => string): ModuloVista[] {
  // ⚠️ TODO EL HTML QUE VIAJA, no sólo la descripción (08/10/2026): la consigna de la tarea (mig 0226)
  //    y la de cada tarea de más (`seccion`). Una lista blanca que se achica después de guardar tiene
  //    que valer también para lo que se escribió antes.
  return modulos.map((m) => ({
    ...m,
    clases: m.clases.map((c) => {
      if (esClaseCerrada(c)) return c;
      const conSecciones = c.campos.some((x) => x.tipo === 'seccion' && x.descripcionHtml);
      if (!c.descripcionHtml && !c.tareaHtml && !conSecciones) return c;
      return {
        ...c,
        ...(c.descripcionHtml ? { descripcionHtml: sanear(c.descripcionHtml) } : {}),
        ...(c.tareaHtml ? { tareaHtml: sanear(c.tareaHtml) || null } : {}),
        ...(conSecciones ? {
          campos: c.campos.map((x) => {
            if (x.tipo !== 'seccion' || !x.descripcionHtml) return x;
            const h = sanear(x.descripcionHtml);
            if (h) return { ...x, descripcionHtml: h };
            const { descripcionHtml: _fuera, ...sin } = x;
            return sin;
          }),
        } : {}),
      };
    }),
  }));
}

/**
 * ¿Un módulo VACÍO se le muestra igual al alumno? Sólo si el equipo lo dejó PÚBLICO: un vinculado con
 * «Público» (`bloqueo: abierto`, `bloqueoPublico` en app/customer-success/curso/bloqueo-editor.ts) o un
 * suelto que no se cerró (un suelto nace abierto y lo crea el equipo a mano en el curso).
 */
export const moduloPublico = (m: Pick<ModuloCurso, 'vinculado' | 'bloqueo'>): boolean =>
  m.vinculado ? m.bloqueo?.tipo === 'abierto' : !m.bloqueo || m.bloqueo.tipo === 'abierto';

/**
 * ¿El curso de un producto se le LISTA al alumno? Con alguna clase en un módulo que puede ver, sí; sin
 * ninguna, sólo si tiene un módulo PÚBLICO que puede ver (`moduloPublico`).
 *
 * ⚠️ ITEM 16 DEL AUDIO DEL 08/10/2026 (03:00): «si está público, que aparezca acá en la vista de alumno el
 *    módulo… En Skool se pueden publicar módulos aunque no haya nada dentro». Hasta acá un producto SIN
 *    CLASES no se listaba (`if (!clases.length) continue`), así que publicar el primer módulo vacío —un
 *    «Lanzamiento (próximamente)»— dejaba al alumno en «Todavía no hay clases».
 * ⚠️ Y NO ES «cualquier producto con módulos»: todo producto con kanban tiene módulos (sus etapas), y
 *    entonces un cliente vería como curso vacío cada producto que compró y que no tiene curso. Lo que
 *    distingue «un curso que arranca» de «no hay curso» es que alguien lo PUBLICÓ.
 * `permitido`: los permisos del alumno (mig 0219). Con todo escondido por ellos, no se lista.
 */
export function cursoSeLista(
  modulos: readonly Pick<ModuloCurso, 'clave' | 'vinculado' | 'bloqueo'>[],
  clases: readonly Pick<Clase, 'etapa'>[],
  permitido: (clave: string) => boolean = () => true,
): boolean {
  const visibles = modulos.filter((m) => permitido(m.clave));
  const claves = new Set(visibles.map((m) => m.clave));
  return clases.some((c) => claves.has(c.etapa)) || visibles.some(moduloPublico);
}

/**
 * El estilo que viaja: las portadas recortadas a las CLASES ABIERTAS y a los MÓDULOS que viajan. La
 * portada de una clase cerrada o la clave de un módulo que sus permisos no le dan no tienen por qué
 * estar en el HTML.
 */
export function estiloQueViaja(estilo: EstiloCurso, modulos: readonly ModuloVista[]): EstiloCurso {
  const clases = new Set(modulos.flatMap((m) => m.clases.filter((c) => !esClaseCerrada(c)).map((c) => c.id)));
  const mods = new Set(modulos.map((m) => m.key));
  const conClases = soloDeClases(estilo, clases);
  const portadasEtapa: Record<string, string> = {};
  for (const [k, v] of Object.entries(conClases.portadasEtapa)) if (mods.has(k)) portadasEtapa[k] = v;
  return { ...conClases, portadasEtapa };
}

/** El primer nombre del cliente, para el saludo. `null` si no hay nada que decir. */
export function primerNombre(nombre: string | null | undefined): string | null {
  const n = (nombre ?? '').trim().split(/\s+/)[0] ?? '';
  return n ? n.slice(0, 40) : null;
}

// ── El cuerpo de las rutas que escriben ───────────────────────────────────────

/** Topes del cuerpo. La tarea más larga del programa viejo (18 tablas) no pasa de unas decenas de KB. */
export const TOPE_TAREA = 200_000;
export const TOPE_PROGRESO = 2_000;

/**
 * Lee un cuerpo JSON SIN pasarse del tope. `413` = demasiado grande, `400` = no es JSON.
 *
 * ⚠️ SE LEE EL CUERPO, NO SE CONFÍA EN `content-length`: el header se mira primero porque corta
 * barato, pero puede faltar (chunked) o mentir. Lo que corta de verdad es contar los bytes a
 * medida que llegan y cancelar al pasarse — un `req.json()` lo leería entero a memoria primero.
 *
 * ⚠️ NO MIRA EL `content-type`: el progreso llega también por `navigator.sendBeacon` al cerrar la
 * pestaña, que va como `text/plain` (un Blob `application/json` en un beacon no es «simple» y
 * hay navegadores que lo rechazan).
 */
export async function leerJsonTopeado(req: Request, tope: number): Promise<{ ok: true; valor: unknown } | { ok: false; status: 400 | 413 }> {
  const declarado = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(declarado) && declarado > tope) return { ok: false, status: 413 };
  if (!req.body) return { ok: false, status: 400 };
  const lector = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > tope) {
      await lector.cancel().catch(() => {});
      return { ok: false, status: 413 };
    }
    partes.push(value);
  }
  const junto = new Uint8Array(total);
  let i = 0;
  for (const p of partes) { junto.set(p, i); i += p.byteLength; }
  try {
    return { ok: true, valor: JSON.parse(new TextDecoder().decode(junto)) };
  } catch {
    return { ok: false, status: 400 };
  }
}

/** Un id de clase que llega del navegador: entero positivo o nada. */
export function idDeClase(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,12}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ── Lo que lee (server) ───────────────────────────────────────────────────────

/**
 * La vista entera del alumno: su nombre y, por cada producto suyo QUE TENGA CLASES, sus módulos.
 *
 * ⚠️ Corre adentro de `runWithWorkspace(firma.ws, …)` y DESPUÉS de `resolverAcceso` (o de
 * `resolverAccesoPortal`): todo lo de acá usa `getTenantDb`, que sin ese contexto cae al workspace
 * por defecto (el de Mauricio) — y en una prueba con un cliente de Mauricio se vería perfecto.
 *
 * `opts.lider`: el área del líder que abrió el portal (#665), y SALE DE SU FILA EN LA BASE
 * (`resolverAccesoPortal`), nunca del pedido. Con un líder: sin nombre, sólo los productos que
 * tienen clases por área y, adentro, sólo esas (`armarModulos`).
 *
 * `opts.alcance`: los PERMISOS del alumno (mig 0219, `curso_accesos.alcance`), que también salen de
 * su fila en la base. Un módulo que no le permiten NO VIAJA: ni su nombre ni sus clases (lo que no
 * se abre no viaja, la regla de siempre del portal). Se aplica en `armarModulos`, DESPUÉS de evaluar
 * con el kanban entero: el estado de una etapa sale de su POSICIÓN, y filtrar antes correría las
 * posiciones.
 *
 * ⚠️ LAS ETAPAS Y LOS MÓDULOS SE LEEN ESTRICTOS (`modulosDelCurso(…, { estricta: true })`): con la
 * lectura caída, la tolerante devolvía las etapas DE FÁBRICA y el candado decidía sobre ellas qué
 * contenido le llegaba a cada alumno (riesgo 12 del relevo del 07/10/2026). Sin poder leer, la página
 * dice «No pudimos cargar tus clases»: un error se reintenta, un curso abierto de más no se cierra.
 */
export async function armarVistaAlumno(
  leadId: number,
  opts: { lider?: string | null; alcance?: AlcanceCurso } = {},
): Promise<VistaAlumno> {
  const lider = opts.lider ?? null;
  const alcance = opts.alcance ?? null;
  const [datos, modulosDatos, { getTenantDb }, { estilosDeProductos }, { sanearHtml }] = await Promise.all([
    import('./curso-datos'),
    import('./curso-modulos-datos'),
    import('./workspace'),
    import('./curso-estilo-datos'),
    import('./html-seguro'),
  ]);
  const db = await getTenantDb();
  const [{ productos, casa }, avance, { data: lead }] = await Promise.all([
    datos.productosConCasaDelAlumno(leadId),
    datos.avanceDelCliente(leadId),
    db.from('leads').select('nombre').eq('id', leadId).maybeSingle(),
  ]);
  const nombre = lider != null ? null : primerNombre((lead as { nombre: string | null } | null)?.nombre);
  if (!productos.length) return { nombre, area: lider, productos: [] };

  const { data: filasProd, error } = await db.from('productos').select('id, nombre').in('id', productos);
  if (error) throw new Error(error.message);
  const nombreDe = new Map(((filasProd ?? []) as Array<{ id: number; nombre: string }>).map((p) => [Number(p.id), p.nombre]));
  // Cómo se ve cada curso. Si la lectura falla vuelve el de siempre: es cosmético (ver ahí).
  const estilos = await estilosDeProductos(productos);

  // En el orden de `productosDelAlumno` (el del catálogo), uno por uno: son uno o dos, y cada
  // `etapaActualDe` ya consulta lo suyo.
  const out: ProductoVista[] = [];
  for (const productoId of productos) {
    const clases = await datos.clasesDelProducto(productoId);
    if (lider != null && !clases.some((c) => c.porArea === true)) continue;
    const [cur, actual] = await Promise.all([
      modulosDatos.modulosDelCurso(productoId, { estricta: true }),
      datos.etapaActualDe(leadId, productoId, productos),
    ]);
    if (!cur) throw new Error(`no pude leer los módulos del producto ${productoId}`);
    const permitido = (clave: string) => moduloPermitido(alcance, productoId, clave);
    // Sin clases, sólo si el equipo PUBLICÓ algún módulo (item 16, `cursoSeLista`); y con todo
    // escondido por sus permisos, tampoco: un programa vacío que nadie publicó se lee como roto.
    if (!cursoSeLista(cur.modulos, clases, permitido)) continue;
    const contexto = await modulosDatos.contextoDelAlumno({ leadId, productoId, casa, modulos: cur.modulos, clases });
    const modulos = conHtmlSaneado(armarModulos({
      modulos: cur.modulos, etapas: cur.entrega.etapas, actual, clases, progreso: avance.progreso,
      permitido,
      contexto,
      opts: { porArea: avance.porArea, areas: avance.areas, lider },
    }), sanearHtml);
    out.push({
      productoId,
      nombre: nombreDe.get(productoId) ?? 'Tu programa',
      estilo: estiloQueViaja(estilos.get(productoId) ?? estiloVacio(), modulos),
      modulos,
    });
  }
  return { nombre, area: lider, productos: out };
}

/**
 * La clase `claseId`, si se le abre a este alumno. Lo usan las rutas públicas (tarea, video,
 * progreso, adjunto, entrega).
 *
 * Valida las cosas que pide el portal: que la clase exista en el workspace de la firma
 * (`claseDeId`, que filtra por inquilino), que su producto sea uno del alumno
 * (`productosDelAlumno`), que su módulo esté en sus permisos (`alcance`, mig 0219: si no, el mismo
 * 404 que una clase de otro producto, así la respuesta no cuenta que existe) y, con `exigeAbierta`,
 * que esté ABIERTA para él: su candado y el de su módulo, con la MISMA evaluación que el dibujo
 * (`aperturasDe`). Con `lider`, que sea una clase POR ÁREA (`decidirClase`).
 *
 * `abierta` vuelve en el resultado (o `undefined` si no se pidió).
 *
 * ⚠️ Corre adentro de `runWithWorkspace(firma.ws, …)` y después de `resolverAccesoPortal`. Y TIRA si
 * no puede leer lo que decide (las etapas, los módulos): la ruta contesta su error, no una clase
 * abierta por una lectura caída.
 */
export async function claseDelAlumno(
  leadId: number,
  claseId: number,
  opts: { exigeAbierta: boolean; lider?: string | null; alcance?: AlcanceCurso },
): Promise<{ decision: Exclude<DecisionClase, 'ok'> } | { decision: 'ok'; clase: Clase; abierta: boolean | undefined }> {
  const datos = await import('./curso-datos');
  const [clase, { productos, casa }] = await Promise.all([datos.claseDeId(claseId), datos.productosConCasaDelAlumno(leadId)]);
  const alcance = opts.alcance ?? null;
  if (clase && productos.includes(clase.productoId) && !moduloPermitido(alcance, clase.productoId, clase.etapa)) {
    return { decision: 'no-existe' };
  }
  let abierta: boolean | undefined;
  if (opts.exigeAbierta && clase && productos.includes(clase.productoId)) {
    abierta = (await aperturasDelAlumno({ leadId, productoId: clase.productoId, productos, casa, alcance }))
      .clases.get(clase.id)?.abierta === true;
  }
  const decision = decidirClase(clase, productos, abierta, opts.exigeAbierta, opts.lider ?? null);
  return decision === 'ok' && clase ? { decision, clase, abierta } : { decision: decision === 'ok' ? 'no-existe' : decision };
}

/**
 * Lo que se le abre a UN alumno en UN producto, leído y evaluado: sus módulos ESTRICTOS, su etapa,
 * sus permisos y su contexto (fechas, nivel, lo abierto a mano), con la MISMA evaluación que dibuja
 * el portal (`aperturasDe`). La usan las rutas (`claseDelAlumno`) y los mensajes que NOMBRAN clases
 * (lib/curso-mensajes.ts: el recordatorio de videos y lo pendiente de una llamada).
 *
 * ⚠️ UN MENSAJE TAMBIÉN ES UNA PUERTA (revisión del 08/10/2026). El recordatorio listaba los videos sin
 * ver de su etapa sin mirar candados ni permisos: le pedía por WhatsApp ver una clase que no puede
 * abrir, o le nombraba una de un módulo que sus permisos no le dan (que en el portal no viaja «ni el
 * nombre»). Con un armado propio en cada lugar, «abierta» querría decir dos cosas.
 *
 * TIRA si no puede leer lo que decide. `clases` y `progreso` los pasa quien ya los tiene (el cron los
 * lee una vez) y si no se leen acá, en la MISMA ronda que los módulos (la ruta del progreso pega cada
 * ~10 s: una ronda de más es medio pulso). `progreso` es el EFECTIVO (`progresoDelCliente`).
 */
export async function aperturasDelAlumno(p: {
  leadId: number;
  productoId: number;
  productos: readonly number[];
  casa: number | null;
  alcance: AlcanceCurso;
  clases?: readonly Clase[];
  progreso?: ReadonlyMap<number, Progreso>;
}): Promise<Aperturas> {
  const [datos, modulosDatos] = await Promise.all([import('./curso-datos'), import('./curso-modulos-datos')]);
  const [cur, actual, clases, progreso] = await Promise.all([
    modulosDatos.modulosDelCurso(p.productoId, { estricta: true }),
    datos.etapaActualDe(p.leadId, p.productoId, p.productos),
    p.clases ?? datos.clasesDelProducto(p.productoId),
    p.progreso ?? datos.progresoDelCliente(p.leadId),
  ]);
  if (!cur) throw new Error(`no pude leer los módulos del producto ${p.productoId}`);
  const contexto = await modulosDatos.contextoDelAlumno({ leadId: p.leadId, productoId: p.productoId, casa: p.casa, modulos: cur.modulos, clases });
  return aperturasDe({
    modulos: cur.modulos, etapas: cur.entrega.etapas, actual, clases, progreso,
    permitido: (clave) => moduloPermitido(p.alcance, p.productoId, clave),
    contexto,
  });
}

/**
 * Cuánto vive la URL firmada de un video subido.
 *
 * ⚠️ NO SON LOS 120 s DE /api/compartido/archivo: aquello es una descarga, que arranca y
 * termina. Un `<video>` pide RANGOS a medida que se reproduce y al adelantar, contra la URL a la
 * que lo redirigieron — si vence a mitad de la clase, el próximo salto falla. Cuatro horas cubren
 * una clase con pausas; si igual vence, el reproductor vuelve a pedir el endpoint (que revalida
 * el link) y sigue desde donde estaba. El costo: la URL firmada sobrevive a revocar el acceso
 * por ese rato, y es un video del curso, no un dato del cliente.
 */
export const VIDA_URL_VIDEO = 4 * 3600;
