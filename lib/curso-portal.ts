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
// SÓLO las clases por área de su área (`decidirClase` con `lider`, `armarEtapas` con `opts.lider`);
// una clase por área se contesta una vez por área (`areaDeLaTarea`); y el link de agenda de una etapa
// viaja recién con la etapa completa (`armarEtapas`).
//
// Dos mitades en el mismo archivo:
//   · LO PURO (qué etapa está hecha / abierta / bloqueada, qué reproductor lleva cada clase, si
//     una clase se le abre al alumno, el tope del cuerpo): lo EJECUTA tests/curso-portal.test.ts.
//   · LO QUE LEE (armarVistaAlumno, claseDelAlumno): corre en el server, adentro de
//     `runWithWorkspace(firma.ws, …)` con el workspace que sale de la FIRMA del link.
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

// ── Las etapas ────────────────────────────────────────────────────────────────

/**
 * `hecha` = una etapa anterior a la actual: se puede abrir y releer (y corregir sus tareas).
 * `actual` = donde está HOY el cliente: abierta y destacada.
 * `bloqueada` = una etapa que todavía no le toca: se VE (es el mapa del programa) pero no se abre.
 */
export type EstadoEtapa = 'hecha' | 'actual' | 'bloqueada';

/**
 * El estado de cada etapa por su POSICIÓN respecto de la actual, en el orden de la entrega.
 *
 * ⚠️ SIN ETAPA ACTUAL CONOCIDA, LA PRIMERA ES LA ACTUAL. Es la regla del kanban de la entrega
 * (`repartirEnEtapas`) y la de `etapaActualDe`: un cliente sin fila en `cliente_entrega` está en
 * la primera etapa, no «en ninguna». Si acá se tomara «ninguna» como «todo bloqueado», los 14
 * clientes de Mauricio —que al arrancar no tienen fila— abrirían el link a un programa cerrado.
 *
 * ⚠️ «Hecha» es por posición, no por tareas: si Mauricio lo movió a mano, lo de atrás queda
 * hecho aunque falte algo. La etapa la manda la entrega, no esta pantalla.
 */
export function estadosDeEtapas(claves: readonly string[], actual: string | null | undefined): Record<string, EstadoEtapa> {
  const out: Record<string, EstadoEtapa> = {};
  if (!claves.length) return out;
  const i = actual ? claves.indexOf(actual) : -1;
  const iActual = i >= 0 ? i : 0;
  claves.forEach((k, j) => { out[k] = j < iActual ? 'hecha' : j === iActual ? 'actual' : 'bloqueada'; });
  return out;
}

/** ¿El alumno puede abrir (ver el video, mandar la tarea) una clase de una etapa en este estado? */
export const etapaAbierta = (e: EstadoEtapa | undefined): boolean => e === 'hecha' || e === 'actual';

/**
 * ¿Esta clase se le abre a ESTE alumno? Lo deciden las rutas públicas antes de leer o escribir
 * nada de la clase.
 *
 *   · `no-existe` → 404. También cuando la clase existe pero es de un producto que el cliente no
 *     compró: un link válido no abre el curso de otro producto, y contestar distinto («existe,
 *     pero no es tuya») ayudaría a enumerar ids.
 *   · `bloqueada` → la clase es de una etapa que todavía no le toca (o de una etapa que ya no
 *     existe en la entrega: la pantalla no la muestra, así que tampoco se escribe).
 *
 * `estadoEtapa` sólo cuenta cuando `exigeEtapa`: el progreso del video no lo exige (ver la ruta).
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
  estadoEtapa: EstadoEtapa | undefined,
  exigeEtapa: boolean,
  lider: string | null = null,
): DecisionClase {
  if (!clase) return 'no-existe';
  if (!productosDelAlumno.includes(clase.productoId)) return 'no-existe';
  if (lider != null && clase.porArea !== true) return 'no-existe';
  if (exigeEtapa && !etapaAbierta(estadoEtapa)) return 'bloqueada';
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
  minutos: number | null;
  video: VideoVista | null;
  /** % visto (0-100). `null` = este video NO se puede medir: la pantalla dice «sin medir», no 0%. */
  pct: number | null;
  tarea: string;
  campos: Campo[];
  tieneTarea: boolean;
  obligatoria: boolean;
  estado: EstadoTarea;
  valores: Valores;
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

export type EtapaVista = {
  key: string;
  label: string;
  /**
   * El link para agendar la sesión (su Calendly), SÓLO si el alumno completó esta etapa (#665).
   * Ausente = no hay link, o todavía no la completó: en los dos casos el link no viaja.
   */
  agendaUrl?: string;
  estado: EstadoEtapa;
  /** Vacío en una etapa bloqueada: lo que no se abre no viaja al navegador. */
  clases: ClaseVista[];
  /** Cuántas clases tiene, aunque esté bloqueada (para decir «3 clases» sin mandarlas). */
  cuantas: number;
  /** Tareas obligatorias de la etapa y cuántas ya envió (lo que la cierra, ver `etapaCompleta`). */
  obligatorias: number;
  enviadas: number;
  /**
   * TODAS las tareas de la etapa y cuántas envió: lo que se le muestra al alumno. Con sólo las
   * obligatorias la cabecera decía «0 de 1 tarea enviada» arriba de ocho clases marcadas «Tarea
   * pendiente», y la ficha del equipo «0/9 tareas» sobre la misma etapa (06/10/2026).
   */
  tareas: number;
  tareasEnviadas: number;
};

export type ProductoVista = {
  productoId: number; nombre: string; etapas: EtapaVista[];
  /**
   * Cómo se ve el curso (mig 0214): el color, el título, la descripción y las portadas que eligió
   * el equipo (`estiloVacio()` = el de siempre). Viaja al alumno a propósito: es lo que él tiene que
   * ver, con las portadas de clase recortadas a las clases que viajan (`soloDeClases`).
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
 * Una clase, como la ve el alumno: lo que se guarda en el bucket y el `origen` no viajan.
 *
 * ⚠️ LOS CAMPOS VIAJAN SIN LAS RESPUESTAS CORRECTAS DE LOS QUIZZES (`camposParaAlumno`, #18): ésta es
 * la única puerta por la que llegan al navegador del alumno (el portal, /mi-curso y la vista previa
 * arman la vista acá), y un quiz con las correctas en el HTML se aprueba leyendo la página. El quiz se
 * corrige en el server (/api/compartido/curso/tarea). Lo fija tests/curso-tareas-tipos.test.ts.
 *
 * `calificacion`: la nota de sus quizzes (mig 0218), para que vea en qué quedó y cuántos intentos le
 * quedan. AUSENTE si no hay (y la lista blanca de tests/curso-portal.test.ts sigue valiendo).
 */
export function claseVista(c: Clase, p: Progreso | undefined, areas?: TareaDeArea[]): ClaseVista {
  const { video, medible } = videoDeClase(c);
  const calificacion = !areas && p?.calificacion && Object.keys(p.calificacion).length ? p.calificacion : null;
  return {
    id: c.id, titulo: c.titulo, descripcion: c.descripcion, minutos: c.minutos, video,
    pct: medible ? Math.max(0, Math.min(100, p?.pct ?? 0)) : null,
    tarea: c.tarea, campos: camposParaAlumno(c.campos), tieneTarea: tieneTarea(c), obligatoria: c.obligatoria,
    // Con áreas, lo contestado vive en cada área: el `valores` de la fila del cliente no viaja.
    estado: p?.estado ?? 'pendiente', valores: areas ? {} : p?.valores ?? {},
    ...(areas ? { areas } : {}),
    // Y su propuesta, igual: con áreas, la de cada área viaja en SU área (al líder, sólo la suya).
    ...(!areas && propuestaVista(p) ? { ia: propuestaVista(p) } : {}),
    ...(calificacion ? { calificacion } : {}),
  };
}

/**
 * Lo que `armarEtapas` necesita saber de las áreas (#665). Todo opcional: sin esto arma el portal
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

/**
 * Las etapas de un producto con sus clases, en el orden de la entrega.
 *
 * ⚠️ UNA CLASE CUYA ETAPA YA NO EXISTE NO SE MUESTRA. Las etapas se editan desde la pantalla de
 * la entrega y una clave borrada no se reusa (`nuevaClaveEtapa`): esa clase quedó huérfana, y
 * dibujarla «en algún lado» la pondría en una etapa que no es la suya. Las rutas la tratan igual
 * (`decidirClase` con etapa desconocida = bloqueada).
 *
 * ⚠️ LAS CLASES DE UNA ETAPA BLOQUEADA NO VIAJAN: se manda cuántas son, no su contenido. Lo que
 * no se abre no tiene por qué estar en el HTML que recibe el navegador.
 *
 * ⚠️ EL LINK DE AGENDA (`agendaUrl` de la etapa, #665) VIAJA SÓLO CON LA ETAPA COMPLETA
 * (`etapaCompleta`, la misma regla que mueve al cliente) y abierta, y nunca al líder de un área:
 * la sesión es del cliente con Mauricio. Antes de eso no está en el HTML: no se esconde al pintar,
 * no se manda. La traba es BLANDA (el link existe afuera, lib/servicio-etapas.ts lo dice).
 *
 * `progreso` es el EFECTIVO (`progresoEfectivo`): una clase por área cuenta enviada cuando la
 * enviaron todas sus áreas. Con `opts.lider`, el portal es el del líder: sólo las clases por área,
 * sólo las etapas que tienen alguna, y de cada una SÓLO lo que contestó su área.
 */
export function armarEtapas(
  etapas: readonly { key: string; label: string; agendaUrl?: string }[],
  actual: string | null | undefined,
  clases: readonly Clase[],
  progreso: ReadonlyMap<number, Progreso>,
  opts: OpcionesVista = {},
): EtapaVista[] {
  const lider = opts.lider ?? null;
  const areas = opts.areas ?? [];
  const estados = estadosDeEtapas(etapas.map((e) => e.key), actual);
  const porEtapa = new Map<string, Clase[]>();
  for (const c of clases) {
    if (!(c.etapa in estados)) continue;
    if (!porEtapa.has(c.etapa)) porEtapa.set(c.etapa, []);
    porEtapa.get(c.etapa)!.push(c);
  }
  /** Lo de UNA área, como lo guardó (o pendiente si nunca la tocó). */
  const tareaDe = (c: Clase, area: string): TareaDeArea => {
    const p = opts.porArea?.get(c.id)?.get(area);
    const ia = propuestaVista(p);
    // La nota de sus quizzes (mig 0218): sin esto, al recargar, el líder no ve en qué quedó.
    const calificacion = p?.calificacion && Object.keys(p.calificacion).length ? p.calificacion : null;
    return {
      area, estado: p?.estado ?? 'pendiente', valores: p?.valores ?? {},
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
    if (lider == null) return progreso.get(id)?.estado;
    return opts.porArea?.get(id)?.get(lider)?.estado;
  };
  const out: EtapaVista[] = [];
  for (const e of etapas) {
    const todas = (porEtapa.get(e.key) ?? []).slice().sort((a, b) => a.orden - b.orden || a.id - b.id);
    const deEtapa = lider != null ? todas.filter((c) => c.porArea === true) : todas;
    if (lider != null && !deEtapa.length) continue;
    const estado = estados[e.key];
    const ob = obligatoriasDe(deEtapa);
    // ⚠️ LA AGENDA MIRA LA ETAPA ENTERA (`todas`), con la regla que mueve al cliente: no la del líder.
    const agenda = lider == null && etapaAbierta(estado) && etapaCompleta(todas, (id) => progreso.get(id)?.estado)
      ? agendaValida(e.agendaUrl)
      : null;
    out.push({
      key: e.key, label: e.label, estado,
      ...(agenda ? { agendaUrl: agenda } : {}),
      clases: etapaAbierta(estado)
        ? deEtapa.map((c) => {
          const deAreas = areasDe(c);
          const vista = claseVista(c, progreso.get(c.id), deAreas);
          // Al líder, el chip de la clase dice en qué quedó SU área, no el de todas.
          return lider != null && deAreas ? { ...vista, estado: deAreas[0].estado } : vista;
        })
        : [],
      cuantas: deEtapa.length,
      obligatorias: ob.length,
      enviadas: ob.filter((c) => enviada(estadoDe(c.id))).length,
      tareas: deEtapa.filter((c) => tieneTarea(c)).length,
      tareasEnviadas: deEtapa.filter((c) => tieneTarea(c) && enviada(estadoDe(c.id))).length,
    });
  }
  return out;
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
 * La vista entera del alumno: su nombre y, por cada producto suyo QUE TENGA CLASES, sus etapas.
 *
 * ⚠️ Corre adentro de `runWithWorkspace(firma.ws, …)` y DESPUÉS de `resolverAcceso` (o de
 * `resolverAccesoPortal`): todo lo de acá usa `getTenantDb`, que sin ese contexto cae al workspace
 * por defecto (el de Mauricio) — y en una prueba con un cliente de Mauricio se vería perfecto.
 *
 * `opts.lider`: el área del líder que abrió el portal (#665), y SALE DE SU FILA EN LA BASE
 * (`resolverAccesoPortal`), nunca del pedido. Con un líder: sin nombre, sólo los productos que
 * tienen clases por área y, adentro, sólo esas (`armarEtapas`).
 *
 * `opts.alcance`: los PERMISOS del alumno (mig 0219, `curso_accesos.alcance`), que también salen de
 * su fila en la base. Un módulo que no le permiten NO VIAJA: ni su nombre ni sus clases (lo que no
 * se abre no viaja, la regla de siempre del portal). Se descarta DESPUÉS de armar las etapas con la
 * lista entera de la entrega, porque el estado de cada una (hecha / actual / bloqueada) sale de su
 * POSICIÓN en el kanban: filtrar antes correría las posiciones.
 */
export async function armarVistaAlumno(
  leadId: number,
  opts: { lider?: string | null; alcance?: AlcanceCurso } = {},
): Promise<VistaAlumno> {
  const lider = opts.lider ?? null;
  const alcance = opts.alcance ?? null;
  const [datos, { entregaDeProducto }, { getTenantDb }, { estilosDeProductos }] = await Promise.all([
    import('./curso-datos'),
    import('./entrega-servicio'),
    import('./workspace'),
    import('./curso-estilo-datos'),
  ]);
  const db = await getTenantDb();
  const [productos, avance, { data: lead }] = await Promise.all([
    datos.productosDelAlumno(leadId),
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
    if (!clases.length) continue;
    if (lider != null && !clases.some((c) => c.porArea === true)) continue;
    const [cfg, actual] = await Promise.all([entregaDeProducto(productoId), datos.etapaActualDe(leadId, productoId, productos)]);
    const etapas = armarEtapas(cfg.etapas, actual, clases, avance.progreso, { porArea: avance.porArea, areas: avance.areas, lider })
      .filter((e) => moduloPermitido(alcance, productoId, e.key));
    // Con todo escondido por sus permisos, el producto no se lista: un programa vacío se lee como roto.
    if (alcance != null && !etapas.some((e) => e.cuantas > 0)) continue;
    const viajan = new Set(etapas.flatMap((e) => e.clases.map((c) => c.id)));
    out.push({
      productoId,
      nombre: nombreDe.get(productoId) ?? 'Tu programa',
      estilo: soloDeClases(estilos.get(productoId) ?? estiloVacio(), viajan),
      etapas,
    });
  }
  return { nombre, area: lider, productos: out };
}

/**
 * La clase `claseId`, si se le abre a este alumno. Lo usan las tres rutas públicas.
 *
 * Valida las DOS cosas que pide el portal: que la clase exista en el workspace de la firma
 * (`claseDeId`, que filtra por inquilino) Y que su producto sea uno del alumno
 * (`productosDelAlumno`). Con `exigeEtapa`, además, que su etapa esté abierta para él. Con
 * `lider`, que sea una clase POR ÁREA (`decidirClase`): el líder no abre ninguna otra.
 *
 * Con `alcance` (sus permisos, mig 0219), una clase de un módulo que no le permiten es
 * `'no-existe'`: el mismo 404 que una clase de otro producto, así la respuesta no cuenta que existe.
 *
 * ⚠️ Corre adentro de `runWithWorkspace(firma.ws, …)` y después de `resolverAccesoPortal`.
 */
export async function claseDelAlumno(
  leadId: number,
  claseId: number,
  opts: { exigeEtapa: boolean; lider?: string | null; alcance?: AlcanceCurso },
): Promise<{ decision: Exclude<DecisionClase, 'ok'> } | { decision: 'ok'; clase: Clase; estadoEtapa: EstadoEtapa | undefined }> {
  const datos = await import('./curso-datos');
  const [clase, productos] = await Promise.all([datos.claseDeId(claseId), datos.productosDelAlumno(leadId)]);
  let estadoEtapa: EstadoEtapa | undefined;
  if (opts.exigeEtapa && clase && productos.includes(clase.productoId)) {
    const { entregaDeProducto } = await import('./entrega-servicio');
    const [cfg, actual] = await Promise.all([entregaDeProducto(clase.productoId), datos.etapaActualDe(leadId, clase.productoId)]);
    estadoEtapa = estadosDeEtapas(cfg.etapas.map((e) => e.key), actual)[clase.etapa];
  }
  const decision = decidirClase(clase, productos, estadoEtapa, opts.exigeEtapa, opts.lider ?? null);
  if (decision === 'ok' && clase && !moduloPermitido(opts.alcance ?? null, clase.productoId, clase.etapa)) {
    return { decision: 'no-existe' };
  }
  return decision === 'ok' && clase ? { decision, clase, estadoEtapa } : { decision: decision === 'ok' ? 'no-existe' : decision };
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
