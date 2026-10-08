// =============================================================================
// curso-ficha-lectura — cómo se LEE el curso de un cliente adentro de su ficha (puro)
// =============================================================================
// Pedido de Martín (06/10/2026): «Dentro del Detail de los clientes de Mauricio se tiene que
// ver este CURSO». Acá vive lo que decide QUÉ se muestra: las etapas en orden con la actual
// marcada, cuánto vio de cada clase, en qué quedó su tarea y lo que contestó, formateado según
// los campos del formulario.
//
// ⚠️ SIN 'use client' NI 'server-only', a propósito: lo arma la action (curso-ficha-actions.ts),
// lo dibuja la pestaña (FichaCurso.tsx) y un test lo EJECUTA (tests/curso-ficha.test.ts). Acá
// no se lee ni se escribe nada: entran clases y avance, sale lo que se dibuja. El nombre dice
// «lectura» en el sentido de «cómo se lee», no de «va a la base»: eso es la action, que usa la
// capa de datos de lib/curso-datos.ts y no escribe una consulta propia.
//
// ⚠️ Los TIPOS de lib/curso-datos.ts (que es `server-only`) entran con `import type`: se borran
// al compilar, así que ni el navegador ni el test cargan ese módulo.

//
// ⚠️ LOS CONTEOS Y LOS RÓTULOS NO SE ESCRIBEN ACÁ: salen de lib/curso.ts (`conteoDeEtapa`,
// `reproductorDeClase`, `ROTULO_TAREA`, `ROTULO_SIN_MEDIR`), que es lo que también usan la tab y
// el portal. Hasta el 06/10/2026 esta ficha tenía su propio «X de Y», su propio «Revisada» y su
// propio «medible», y la tab pintaba «lista» una etapa con otra regla que la de acá.

import {
  PCT_VISTO, ROTULO_SIN_MEDIR, conteoDeEtapa, reproductorDeClase, tieneTarea,
  type Campo, type Clase, type EstadoTarea, type Progreso, type TipoClase, type Valores, type EstadoPropuesta,
} from '@/lib/curso';
import type { Sesion } from '@/lib/curso-datos';
import { moduloPermitido, productoRestringido, type AlcanceCurso } from '@/lib/curso-alcance';
import { motivoDeFase } from '@/lib/curso-mensajes-texto';
import { avanceDeCliente } from './curso/reglas';
import type { DatosAvance, EtapaVista } from './curso/FilaAvance';

// ── El video: ¿se puede medir? ───────────────────────────────────────────────

/**
 * `medible` = hay un número que creerle (YouTube, Vimeo, archivo subido o directo).
 * `sin-medir` = hay video y se ve, pero su reproductor no expone el tiempo (Drive, Loom, una
 * página cualquiera). `sin-video` = la clase todavía no tiene video.
 *
 * ⚠️ «SIN MEDIR» NO ES «0%», y es la razón de que esto exista: un 0% al lado de una clase de
 * Drive se lee como «no la vio» sobre algo que no hay forma de saber (lib/curso.ts, `medible`).
 */
export type Medicion = 'medible' | 'sin-medir' | 'sin-video';

export function medicionDe(c: Pick<Clase, 'videoTipo' | 'videoUrl' | 'videoPath'>): Medicion {
  // ⚠️ LA REGLA ES LA DEL REPRODUCTOR (`reproductorDeClase`, lib/curso.ts), no una copia: la tab
  // promedia «cuánto vio» sobre los videos MEDIBLES con esa misma función (`vistoDeEtapa`), y si
  // esta ficha decidiera «medible» por su cuenta, el mismo cliente tendría un % allá sobre videos
  // que acá dicen «sin medir». Pregunta al LINK, no a la etiqueta guardada.
  const r = reproductorDeClase(c);
  if (!r.video) return 'sin-video';
  return r.medible ? 'medible' : 'sin-medir';
}

export type Tono = 'good' | 'dim' | 'faint';

/**
 * Lo que dice la columna «visto» de una clase.
 *
 * ⚠️ TRES «NO SÉ» DISTINTOS Y NINGUNO ES UN NÚMERO: sin video, sin medir (el reproductor no lo
 * dice) y sin abrir (nunca le dio play). Y una fila con progreso pero SIN duración tampoco tiene
 * %: `pctVisto` devuelve 0 en ese caso, y pintarlo sería el «0%» que `lib/curso.ts` prohíbe.
 */
export function rotuloVisto(m: Medicion, p: Progreso | null | undefined): { texto: string; tono: Tono } {
  if (m === 'sin-video') return { texto: 'Sin video', tono: 'faint' };
  if (m === 'sin-medir') return { texto: p?.vistoAt ? `Abierta, ${ROTULO_SIN_MEDIR.toLowerCase()}` : ROTULO_SIN_MEDIR, tono: 'faint' };
  if (!p || (!p.vistoAt && !(p.segundosMax > 0))) return { texto: 'Sin abrir', tono: 'faint' };
  if (!p.duracionSeg || !(p.duracionSeg > 0)) return { texto: ROTULO_SIN_MEDIR, tono: 'faint' };
  return { texto: `${p.pct}%`, tono: p.pct >= PCT_VISTO ? 'good' : 'dim' };
}

// ── La tarea ──────────────────────────────────────────────────────────────────

/**
 * En qué quedó su tarea. `null` = la clase no pide nada (no hay tarea que mirar).
 * Cómo se NOMBRA cada estado no vive acá: es `ROTULO_TAREA` de lib/curso.ts.
 */
export function estadoDeTarea(c: Pick<Clase, 'tarea' | 'campos'>, p: Progreso | null | undefined): EstadoTarea | null {
  if (!tieneTarea(c)) return null;
  return p?.estado ?? 'pendiente';
}

// ── Lo que contestó ───────────────────────────────────────────────────────────

/**
 * Un campo contestado, ya con su forma de dibujarse. Las tablas salen COMO TABLA (columnas y
 * filas), nunca aplanadas a texto: una tabla de cinco columnas en una línea no la lee nadie.
 */
export type BloqueRespuesta =
  | { id: string; label: string; tipo: 'texto'; texto: string }
  | { id: string; label: string; tipo: 'lista'; items: string[] }
  | { id: string; label: string; tipo: 'tabla'; columnas: string[]; filas: string[][] }
  | { id: string; label: string; tipo: 'vacio' };

const celda = (x: unknown): string => (typeof x === 'string' ? x.trim() : x == null ? '' : String(x).trim());
const esTabla = (v: unknown): v is unknown[][] => Array.isArray(v) && v.length > 0 && v.every(Array.isArray);

/**
 * La tabla de un campo, como se lee.
 *
 * ⚠️ LAS FILAS FIJAS MANDAN SU PRIMERA COLUMNA. Con `filasFijas` (la tabla de «las buenas, las
 * medias, las que pierden»), la primera columna es la pregunta y no la escribe el cliente: se
 * dibuja la etiqueta del formulario aunque lo guardado traiga otra cosa —o nada— en esa celda.
 * Es el molde del formulario viejo (`tablaParaEditar` en 07d07139^:lib/cs-valores.ts). Las
 * filas que alguien agregó de más debajo de las fijas se conservan.
 */
function tablaDe(c: Campo, v: unknown): { columnas: string[]; filas: string[][] } | null {
  const columnas = c.columnas?.length ? [...c.columnas] : [''];
  const n = columnas.length;
  const guardadas = esTabla(v) ? v.map((f) => f.map(celda)) : [];
  const ancho = (f: string[]) => Array.from({ length: n }, (_, j) => f[j] ?? '');
  const llena = (f: string[], desde = 0) => f.slice(desde).some((x) => x.length > 0);

  if (c.filasFijas?.length) {
    const fijas = c.filasFijas.map((etiqueta, i) => { const f = ancho(guardadas[i] ?? []); f[0] = etiqueta; return f; });
    const extra = guardadas.slice(c.filasFijas.length).map(ancho).filter((f) => llena(f));
    // Sin una sola celda contestada (fuera de las etiquetas), la tabla está vacía: dibujar las
    // preguntas con rayas afirmaría que contestó «nada» en cada una.
    if (!fijas.some((f) => llena(f, 1)) && !extra.length) return null;
    return { columnas, filas: [...fijas, ...extra] };
  }
  const filas = guardadas.map(ancho).filter((f) => llena(f));
  return filas.length ? { columnas, filas } : null;
}

/** Un valor suelto, con la forma que tenga. Para lo que llega sin campo que lo describa. */
function bloqueGenerico(id: string, label: string, v: unknown): BloqueRespuesta {
  if (typeof v === 'string') return v.trim() ? { id, label, tipo: 'texto', texto: v.trim() } : { id, label, tipo: 'vacio' };
  if (esTabla(v)) {
    const filas = v.map((f) => f.map(celda)).filter((f) => f.some(Boolean));
    if (!filas.length) return { id, label, tipo: 'vacio' };
    const n = Math.max(...filas.map((f) => f.length));
    return { id, label, tipo: 'tabla', columnas: Array.from({ length: n }, () => ''), filas: filas.map((f) => Array.from({ length: n }, (_, j) => f[j] ?? '')) };
  }
  if (Array.isArray(v)) {
    const items = v.map(celda).filter(Boolean);
    return items.length ? { id, label, tipo: 'lista', items } : { id, label, tipo: 'vacio' };
  }
  return { id, label, tipo: 'vacio' };
}

/**
 * Lo que contestó en una clase, campo por campo y en el orden del formulario.
 *
 * Sin campos, la tarea es una respuesta libre (`{respuesta}`, ver `sanearValores`).
 *
 * ⚠️ LO QUE CONTESTÓ Y YA NO TIENE CAMPO SE MUESTRA IGUAL, al final y con su clave como rótulo.
 * Si Mauricio edita el formulario después de que el cliente contestó, las claves viejas siguen
 * en `valores`: esconderlas haría desaparecer trabajo del cliente sin que nadie lo decidiera.
 *
 * ⚠️ Y SE LEE A LA DEFENSIVA: `valores` es un jsonb que escribió un navegador sin sesión (lo
 * sanea `sanearValores` al guardar, pero contra los campos de ESE momento). Un campo `checks`
 * con un texto adentro se dibuja como texto, no revienta.
 */
export function respuestaDe(campos: readonly Campo[], valores: Valores | null | undefined): BloqueRespuesta[] {
  const vs: Record<string, unknown> = valores && typeof valores === 'object' ? valores : {};
  const out: BloqueRespuesta[] = [];
  const conCampo = new Set<string>();

  if (!campos.length) {
    const r = vs.respuesta;
    if (typeof r === 'string' && r.trim()) out.push({ id: 'respuesta', label: 'Respuesta', tipo: 'texto', texto: r.trim() });
    conCampo.add('respuesta');
  }
  for (const c of campos) {
    conCampo.add(c.id);
    const v = vs[c.id];
    if (c.tipo === 'tabla' && (esTabla(v) || v == null || (Array.isArray(v) && !v.length))) {
      const t = tablaDe(c, v);
      out.push(t ? { id: c.id, label: c.label, tipo: 'tabla', ...t } : { id: c.id, label: c.label, tipo: 'vacio' });
    } else if (c.tipo === 'checks' && Array.isArray(v) && !esTabla(v)) {
      const items = v.map(celda).filter(Boolean);
      out.push(items.length ? { id: c.id, label: c.label, tipo: 'lista', items } : { id: c.id, label: c.label, tipo: 'vacio' });
    } else if (Array.isArray(v) && !esTabla(v)) {
      // Una lista donde se esperaba un texto (el campo cambió de tipo): se junta en una línea.
      const items = v.map(celda).filter(Boolean);
      out.push(items.length ? { id: c.id, label: c.label, tipo: 'texto', texto: items.join(', ') } : { id: c.id, label: c.label, tipo: 'vacio' });
    } else {
      out.push(bloqueGenerico(c.id, c.label, v));
    }
  }
  for (const [k, v] of Object.entries(vs)) {
    if (conCampo.has(k)) continue;
    const b = bloqueGenerico(k, k, v);
    if (b.tipo !== 'vacio') out.push(b);
  }
  return out;
}

/** ¿Contestó algo? Para decir «Sin contestar» en vez de una lista de rayas. */
export const contestoAlgo = (bloques: readonly BloqueRespuesta[]): boolean => bloques.some((b) => b.tipo !== 'vacio');

// ── Las etapas ────────────────────────────────────────────────────────────────

/** Una clase, como la dibuja la ficha: lo que hace falta y nada del guion de grabación. */
export type ClaseFicha = {
  id: number;
  etapa: string;
  orden: number;
  titulo: string;
  tipo: TipoClase;
  minutos: number | null;
  tarea: string;
  campos: Campo[];
  obligatoria: boolean;
  medicion: Medicion;
  /** `null` = nunca la abrió ni contestó nada (no tiene fila en `curso_progreso`). */
  progreso: Progreso | null;
  /**
   * Una clase POR ÁREA (#665): lo que contestó cada área, una por una. Van las áreas que declaró
   * HOY y además las que contestaron con un nombre que ya no está en su tabla (lo renombró): lo
   * contestado no se esconde. Ausente = se contesta una vez.
   */
  porArea?: Array<{ area: string; progreso: Progreso | null; vigente: boolean }>;
};

export type ResumenEtapa = {
  clases: number;
  /** Las clases que piden algo. */
  tareas: number;
  /** Enviadas o revisadas: lo que cuenta para cerrar la etapa es ENVIAR. */
  enviadas: number;
  /** La regla del paso automático (`etapaCompleta`): envió TODAS las obligatorias. */
  completa: boolean;
};

/**
 * El resumen de una etapa: cuántas tareas envió y si con eso la etapa está completa.
 *
 * ⚠️ SALE DE `conteoDeEtapa` (lib/curso.ts), EL MISMO QUE USAN LA TABLA AVANCE Y EL PORTAL, y
 * «completa» es la regla que MUEVE al cliente (las obligatorias enviadas), no «enviadas ===
 * tareas». Con dos reglas, la ficha diría «completa» sobre una etapa en la que el paso
 * automático no lo movió (o al revés) — y una etapa sin obligatorias NO se completa sola,
 * aunque haya enviado todo lo que tenía (lib/curso.ts explica por qué).
 */
export function resumenDeEtapa(clases: readonly ClaseFicha[]): ResumenEtapa {
  const estado = new Map(clases.map((c) => [c.id, c.progreso?.estado]));
  const k = conteoDeEtapa(clases, (id) => estado.get(id));
  return { clases: clases.length, tareas: k.tareas, enviadas: k.enviadas, completa: k.completa };
}

// ── La propuesta de la IA (paso 5 de #665) ────────────────────────────────────

/**
 * En qué quedó la propuesta de la IA de UNA clase, para el chip de la ficha. `null` = no hay.
 *
 * En una clase POR ÁREA mira todas sus áreas (también las que ya no están en su lista: lo contestado
 * no se esconde): alguna pendiente gana — es lo que el equipo tiene que saber primero —, después
 * alguna aprobada, después corregida.
 */
export function propuestaDeClase(c: Pick<ClaseFicha, 'progreso' | 'porArea'>): EstadoPropuesta | null {
  const estados = (c.porArea ? c.porArea.map((a) => a.progreso?.ia?.estado) : [c.progreso?.ia?.estado])
    .filter((e): e is EstadoPropuesta => !!e);
  for (const e of ['pendiente', 'aprobada', 'corregida'] as const) if (estados.includes(e)) return e;
  return null;
}

/** Cuántas clases de una etapa tienen una propuesta de la IA esperando el ok del cliente. */
export const propuestasPendientes = (clases: readonly ClaseFicha[]): number =>
  clases.filter((c) => propuestaDeClase(c) === 'pendiente').length;

/** «2/3 tareas», o «Sin tareas». El «Completa» va aparte, como chip. */
export function fraseResumen(r: ResumenEtapa): string {
  return r.tareas ? `${r.enviadas}/${r.tareas} ${r.tareas === 1 ? 'tarea' : 'tareas'}` : 'Sin tareas';
}

export type EtapaFicha = {
  key: string;
  label: string;
  /** Es la etapa en la que está hoy (`etapaActualDe`). */
  actual: boolean;
  /** Clases que apuntan a una etapa que la entrega ya no tiene. */
  huerfana: boolean;
  clases: ClaseFicha[];
  resumen: ResumenEtapa;
};

export type ProductoFicha = {
  productoId: number;
  nombre: string;
  /** `null` también cuando su etapa está BORRADA: la ficha no marca ninguna como «Actual». */
  etapaActual: string | null;
  /**
   * La clave de su fila cuando el catálogo ya no la tiene (`ubicacionEnEntregaDe`). Es lo que
   * la cabecera de la ficha llama «Etapa borrada», y esta pestaña tiene que decir lo mismo.
   */
  etapaBorrada: string | null;
  etapas: EtapaFicha[];
  /**
   * La FILA de la tabla Avance de la tab Curso, para este cliente (pedido del 06/10/2026: «el
   * Avance del curso debería también verse en el detail de cada cliente»). Las etapas con su
   * color y los números de `avanceDeCliente` (./curso/reglas.ts): la MISMA cuenta que la tabla,
   * así que la ficha y la tab no pueden decir dos cosas distintas del mismo cliente.
   */
  avance: { etapas: EtapaVista[]; fila: Omit<DatosAvance, 'acceso'> };
};

/** La clave del grupo de las clases cuya etapa ya no existe. No choca con una clave real:
 *  `nuevaClaveEtapa` sólo arma claves de letras, números y guiones. */
export const ETAPA_HUERFANA = '~sin-etapa';

/**
 * El curso de un producto, por etapas y EN EL ORDEN DE LA ENTREGA. `null` = el producto no
 * tiene clases (la ficha no lo muestra: «por producto del cliente que tenga clases»).
 *
 * ⚠️ TODAS LAS ETAPAS, TAMBIÉN LAS QUE NO TIENEN CLASES: la etapa actual se marca sobre el
 * recorrido entero, y saltear las vacías haría que «dónde está» se lea fuera de contexto.
 *
 * ⚠️ Y LAS CLASES DE UNA ETAPA BORRADA NO SE PIERDEN: van al final, en su propio grupo. Sacar
 * una etapa de la entrega no borra sus clases (la FK es al producto, no a la etapa), y una
 * ficha que no las dibujara escondería tareas que el cliente ya contestó.
 *
 * ⚠️ Y SI EL CLIENTE ESTÁ EN UNA ETAPA BORRADA (`etapaBorrada`), NINGUNA ES LA «ACTUAL». El
 * portal y el paso automático lo tratan como si estuviera en la primera (`etapaActualDe`), y la
 * cabecera de la ficha dice «Etapa borrada»: si esta pestaña marcara la primera, la misma ficha
 * diría dos etapas distintas del mismo cliente. Se dice el hecho —su etapa ya no existe— y se lo
 * mueve desde la cabecera. La fila de Avance lo dice con `etapaBorrada`.
 */
export function armarProducto(p: {
  productoId: number;
  nombre: string;
  /** `color` = el de la etapa en el kanban (`colorDeEtapa`, con sus fases). */
  etapas: ReadonlyArray<{ key: string; label: string; color?: string }>;
  clases: readonly Clase[];
  /** El progreso EFECTIVO (`progresoEfectivo`): una clase por área cuenta con todas sus áreas. */
  progreso: ReadonlyMap<number, Progreso>;
  /** Lo que contestó cada área en las clases por área (#665). Ausente = sin áreas. */
  porArea?: ReadonlyMap<number, ReadonlyMap<string, Progreso>>;
  /** Las áreas que declaró el cliente. */
  areas?: readonly string[];
  etapaActual: string | null;
  /** La clave de su fila si el catálogo ya no la tiene. Ausente o `null` = no es el caso. */
  etapaBorrada?: string | null;
}): ProductoFicha | null {
  if (!p.clases.length) return null;
  const borrada = p.etapaBorrada || null;
  const actual = borrada ? null : p.etapaActual;
  const areas = p.areas ?? [];
  const deAreas = (c: Clase): ClaseFicha['porArea'] => {
    if (c.porArea !== true) return undefined;
    const filas = p.porArea?.get(c.id);
    const viejas = [...(filas?.keys() ?? [])].filter((a) => !areas.includes(a));
    if (!areas.length && !viejas.length) return undefined;
    return [
      ...areas.map((a) => ({ area: a, progreso: filas?.get(a) ?? null, vigente: true })),
      ...viejas.map((a) => ({ area: a, progreso: filas?.get(a) ?? null, vigente: false })),
    ];
  };
  const aFicha = (c: Clase): ClaseFicha => {
    const pa = deAreas(c);
    return {
      id: c.id, etapa: c.etapa, orden: c.orden, titulo: c.titulo, tipo: c.tipo, minutos: c.minutos,
      tarea: c.tarea, campos: c.campos, obligatoria: c.obligatoria,
      medicion: medicionDe(c), progreso: p.progreso.get(c.id) ?? null,
      ...(pa ? { porArea: pa } : {}),
    };
  };
  const ordenar = (xs: ClaseFicha[]) => xs.sort((a, b) => a.orden - b.orden || a.id - b.id);
  const porEtapa = new Map<string, ClaseFicha[]>();
  for (const c of p.clases) {
    const xs = porEtapa.get(c.etapa) ?? [];
    xs.push(aFicha(c));
    porEtapa.set(c.etapa, xs);
  }
  const conocidas = new Set(p.etapas.map((e) => e.key));
  const etapas: EtapaFicha[] = p.etapas.map((e) => {
    const clases = ordenar(porEtapa.get(e.key) ?? []);
    return { key: e.key, label: e.label, actual: e.key === actual, huerfana: false, clases, resumen: resumenDeEtapa(clases) };
  });
  const sueltas = ordenar([...porEtapa.entries()].filter(([k]) => !conocidas.has(k)).flatMap(([, xs]) => xs));
  if (sueltas.length) {
    etapas.push({ key: ETAPA_HUERFANA, label: 'Sin etapa', actual: false, huerfana: true, clases: sueltas, resumen: resumenDeEtapa(sueltas) });
  }
  // La fila de Avance: la misma función que arma la tabla de la tab (page.tsx), con las MISMAS
  // entradas — las clases del producto, las claves de la entrega, la etapa actual y el progreso.
  // Las huérfanas no entran (la tabla tampoco las cuenta: no tienen columna).
  const keys = p.etapas.map((e) => e.key);
  const a = avanceDeCliente(p.clases, keys, actual, p.progreso);
  const avance = {
    etapas: p.etapas.map((e) => ({ key: e.key, label: e.label, color: e.color ?? 'var(--faint)' })),
    fila: { etapa: actual, etapaBorrada: borrada != null, porEtapa: a.porEtapa, pctVisto: a.pctVisto, videosSinMedir: a.videosSinMedir },
  };
  return { productoId: p.productoId, nombre: p.nombre, etapaActual: actual, etapaBorrada: borrada, etapas, avance };
}

// ── El acceso y las llamadas ──────────────────────────────────────────────────

/**
 * Lo que hace falta para decir en qué quedó la INVITACIÓN de un cliente al curso, venga de la
 * ficha (`AccesoFicha`) o de una fila de la tabla Avance.
 *
 * ⚠️ `undefined` EN LOS DOS CAMPOS DE LA INVITACIÓN ES «NO LO SÉ», NO «NUNCA SE INVITÓ». La tabla
 * Avance arma su acceso en la página de la tab, y si esa lectura no trae la invitación (mig 0206),
 * pintar «Sin invitar» sería afirmar algo que nadie leyó — sobre alguien a quien quizás sí le
 * llegó el mail. `null` sí es «nunca».
 */
export type AccesoInvitacion = {
  /** `false` = nunca se le dio acceso (no tiene fila en `curso_accesos`). */
  existe: boolean;
  revocado: boolean;
  ingresos: number;
  ultimoIngresoAt: string | null;
  /** A qué dirección salió la invitación. */
  email?: string | null;
  /** Cuándo SALIÓ el mail (se escribe sólo si salió). */
  invitacionEnviadaAt?: string | null;
};

/**
 * Su acceso al portal, como lo dibuja la ficha.
 *
 * ⚠️ ABRIR LA FICHA YA NO CREA EL ACCESO (06/10/2026). Antes, mirar la pestaña escribía la fila
 * (versión 1, habilitada), así que «tiene fila» no decía nada y la tabla Avance no podía
 * distinguir «nunca se lo invitó» de «alguien abrió su ficha». Ahora la fila nace sólo al
 * invitar, copiar el link o mandarlo por WhatsApp. Por eso `existe`.
 *
 * `link`: el link del portal de la versión VIGENTE, firmado al leer (no escribe nada). `null` con
 * `existe` y sin `revocado` = no hay secreto para firmar (AUTH_SECRET): se dice así, no como
 * «cortado».
 */
export type AccesoFicha = AccesoInvitacion & {
  link: string | null;
  email: string | null;
  invitacionEnviadaAt: string | null;
  /**
   * Los PERMISOS del alumno (mig 0219): qué módulos ve. `null` = todo. Viaja con el acceso porque
   * vive en la misma fila; lo dibuja «Permisos del curso» de la ficha. Opcional porque el acceso de
   * un LÍDER (`AccesoLiderFicha`) no lo lleva: el alcance es del cliente (lib/curso-datos.ts).
   */
  alcance?: AlcanceCurso;
};

// ── Los permisos: qué módulos se ofrecen y cuáles están tildados ─────────────

/** Un módulo, como lo ofrece «Permisos del curso». */
export type ModuloPermiso = { key: string; label: string; clases: number };

/**
 * Los módulos de un producto para elegir permisos: sus etapas EN EL ORDEN DE LA ENTREGA (D1: un
 * módulo vinculado es una etapa), con cuántas clases tiene cada una.
 *
 * ⚠️ SIN EL GRUPO DE HUÉRFANAS (`ETAPA_HUERFANA`): es una clave inventada para dibujar las clases
 * de una etapa borrada, no un módulo. Guardada en un alcance no abriría nada nunca.
 */
export function modulosParaPermisos(prod: Pick<ProductoFicha, 'etapas'>): ModuloPermiso[] {
  return prod.etapas.filter((e) => !e.huerfana).map((e) => ({ key: e.key, label: e.label, clases: e.clases.length }));
}

/**
 * Lo que dibujan las casillas de UN producto: `null` = «Todos los módulos» (el producto no está
 * restringido); un array = las claves tildadas, en el orden de la entrega.
 *
 * Sale de `moduloPermitido` (lib/curso-alcance.ts), la MISMA regla que aplica el portal: si la
 * ficha decidiera «tildado» por su cuenta, podría mostrar abierto lo que el alumno no ve.
 */
export function modulosElegidos(alcance: AlcanceCurso | undefined, productoId: number, modulos: readonly ModuloPermiso[]): string[] | null {
  const a = alcance ?? null;
  if (!productoRestringido(a, productoId)) return null;
  return modulos.filter((m) => moduloPermitido(a, productoId, m.key)).map((m) => m.key);
}

export type EstadoInvitacion =
  | { tipo: 'cortado' }
  | { tipo: 'invitado'; email: string | null; enviadaAt: string }
  | { tipo: 'sin-invitar' }
  /** Quien armó el acceso no leyó la invitación: no se afirma nada. */
  | { tipo: 'no-se' };

/**
 * En qué quedó su invitación. CORTADO GANA: un acceso cortado no abre aunque se le haya
 * mandado el mail, y lo que hay que hacer ahí es habilitarlo, no reenviar.
 */
export function estadoDeInvitacion(a: AccesoInvitacion | null | undefined): EstadoInvitacion {
  if (!a) return { tipo: 'no-se' };
  if (a.revocado) return { tipo: 'cortado' };
  // Sin fila no hay invitación posible: `marcarInvitacion` escribe sobre la fila del acceso.
  if (!a.existe) return { tipo: 'sin-invitar' };
  if (typeof a.invitacionEnviadaAt === 'string' && a.invitacionEnviadaAt) {
    return { tipo: 'invitado', email: a.email ?? null, enviadaAt: a.invitacionEnviadaAt };
  }
  return a.invitacionEnviadaAt === null ? { tipo: 'sin-invitar' } : { tipo: 'no-se' };
}

/**
 * El acceso de una fila de Avance, como lo arma la lectura en lote (`accesosDeClientes`,
 * lib/curso-admin.ts): `sin-link` = no tiene fila. `null` = no se pudo leer.
 */
export type AccesoDeFila = {
  estado: 'sin-link' | 'activo' | 'cortado';
  ingresos: number;
  ultimoIngresoAt: string | null;
  email?: string | null;
  invitacionEnviadaAt?: string | null;
} | null;

/**
 * El acceso de una fila, como lo leen la celda «Acceso», la tarjeta del kanban y la lista «Clientes
 * sin invitar» del editor. «Sin link» = no tiene fila: nunca se lo invitó.
 *
 * ⚠️ UNA traducción para las tres (vivía adentro de ./curso/AvanceCurso.tsx): con dos, una diría
 * «Invitado» y la otra ofrecería «Invitar» sobre el mismo cliente — que es un segundo mail.
 */
export function accesoDeFila(a: AccesoDeFila): AccesoInvitacion | null {
  if (!a) return null;
  const existe = a.estado !== 'sin-link';
  return {
    existe,
    revocado: a.estado === 'cortado',
    ingresos: a.ingresos,
    ultimoIngresoAt: a.ultimoIngresoAt,
    email: a.email,
    invitacionEnviadaAt: existe ? a.invitacionEnviadaAt : null,
  };
}

/**
 * Las opciones del CURSO en el menú «Acciones» de la tarjeta del kanban (item 9, 07/10/2026): «En
 * cada cliente del kanban se debería poder invitar al curso … Y claro poder administrar los permisos».
 *
 * ⚠️ NO DEPENDEN DE QUE EL WORKSPACE SEA AGENCIA (`conCuentas`): eso decide lo de la CUENTA de MaKo,
 * y el curso no crea cuentas. Dependen de que el producto tenga curso (`curso` presente).
 *   · Invitar / Reenviar: con el acceso LEÍDO y no cortado. Sin leer, no se invita a ciegas (podría
 *     ser un segundo mail); cortado, la invitación rebota — se habilita en la ficha.
 *   · Permisos: siempre que haya curso y alguien que abra la ficha.
 * Vive acá (puro) y no en la tarjeta para que un test la EJECUTE: la tarjeta es un componente de
 * cliente que arrastra server actions y ningún test la puede importar.
 */
export function opcionesDeCursoEnTarjeta(
  curso: { acceso: AccesoInvitacion | null } | null | undefined,
  conPermisos: boolean,
): Array<{ value: 'curso-invitar' | 'curso-permisos'; label: string }> {
  if (!curso) return [];
  const estado = curso.acceso ? estadoDeInvitacion(curso.acceso) : null;
  // ⚠️ EN POSITIVO: sólo «sin invitar» o «invitado». `no-se` (el acceso se leyó pero sin la
  // invitación) ofrecía «Invitar al curso» —nunca «Reenviar»— que es justo el segundo mail que la
  // regla de arriba promete no mandar; la lista del editor ya lo dejaba afuera (`clientesSinInvitar`).
  return [
    ...(estado && (estado.tipo === 'sin-invitar' || estado.tipo === 'invitado')
      ? [{ value: 'curso-invitar' as const, label: estado.tipo === 'invitado' ? 'Reenviar invitación' : 'Invitar al curso' }]
      : []),
    ...(conPermisos ? [{ value: 'curso-permisos' as const, label: 'Permisos del curso' }] : []),
  ];
}

/** Un cliente de la lista «Clientes sin invitar» del editor: su nombre y el email con que se prellena. */
export type ClienteSinInvitar = { leadId: number; nombre: string; empresa: string | null; email: string };

/**
 * Los clientes de un producto que TODAVÍA NO están invitados, para elegirlos en el editor del curso.
 *
 * ⚠️ SÓLO «SIN INVITAR» DE VERDAD: un cortado no se invita (primero se habilita, en su ficha), un
 * invitado ya tiene su mail, y uno cuyo acceso no se pudo leer (`null`) o no trae la invitación
 * («no lo sé») queda AFUERA — ofrecerlo sería invitar a ciegas a alguien a quien quizás ya le llegó.
 * El email arranca con el del CRM (o el de un intento anterior) y se edita en la lista.
 */
export function clientesSinInvitar(filas: ReadonlyArray<{ leadId: number; nombre: string; empresa: string | null; email?: string | null; acceso: AccesoDeFila }>): ClienteSinInvitar[] {
  return filas
    .filter((f) => estadoDeInvitacion(accesoDeFila(f.acceso)).tipo === 'sin-invitar')
    .map((f) => ({ leadId: f.leadId, nombre: f.nombre, empresa: f.empresa, email: (f.email ?? f.acceso?.email ?? '').trim() }));
}

/** Un día, en la hora local de quien mira: «6 oct». */
function fechaCortaLocal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(d);
}

/** La frase del estado de la invitación. Una sola frase, y vacía cuando no se sabe. */
export function fraseInvitacion(e: EstadoInvitacion): string {
  if (e.tipo === 'cortado') return 'Acceso cortado';
  if (e.tipo === 'sin-invitar') return 'Sin invitar';
  if (e.tipo === 'no-se') return '';
  const cuando = fechaCortaLocal(e.enviadaAt);
  return `Invitado${e.email ? ` a ${e.email}` : ''}${cuando ? ` · ${cuando}` : ''}`;
}

/** Si ya entró al portal. Lo cuenta el portal en cada navegación de documento (no las vistas previas). */
export function fraseIngresos(a: Pick<AccesoInvitacion, 'ingresos' | 'ultimoIngresoAt'>): string {
  if (!a.ingresos) return 'Todavía no entró';
  return `Entró ${a.ingresos} ${a.ingresos === 1 ? 'vez' : 'veces'} · última ${fechaHoraLocal(a.ultimoIngresoAt) ?? '—'}`;
}

export type AvisoInvitacionCurso = { tono: 'ok' | 'warn'; texto: string };

/**
 * Qué se le dice a quien invitó, después de intentarlo.
 *
 * ⚠️ SALE DE `enviado`, NUNCA DE QUE HAYA UN RESULTADO. `invitarAlCursoPorEmail` devuelve
 * SIEMPRE un objeto —también cuando el mail no salió (remitente de prueba, Resend que rechaza)—,
 * así que un `inv ? ok : warn` dice «enviada» sobre un mail que no existe. Es exactamente el
 * falso éxito que tenían los dos avisos de aprobación de agencia (app/api/admin/agencia/route.ts
 * y altas/route.ts), arreglados en la misma tanda.
 *
 * Y `anotado` aparte: si el mail salió y no se pudo anotar, la ficha va a seguir diciendo «Sin
 * invitar» — hay que decirlo, o alguien lo reenvía y le llegan dos.
 */
export function avisoInvitacionCurso(inv: { enviado: boolean; error?: string } | null | undefined, anotado: boolean): AvisoInvitacionCurso {
  if (!inv?.enviado) return { tono: 'warn', texto: `No salió el correo${inv?.error ? `: ${inv.error}` : ''}.` };
  if (!anotado) return { tono: 'warn', texto: 'Salió el correo, pero no quedó anotado.' };
  return { tono: 'ok', texto: 'Invitación enviada.' };
}

/**
 * Lo que lee la pestaña Curso, en UNA action al abrirse.
 *
 * ⚠️ CADA MITAD FALLA POR SU CUENTA, y «no pude leer» viaja como `null` + su error, nunca como
 * un vacío: con un solo valor, una lectura caída de las llamadas diría «sin llamadas agendadas»
 * y alguien agendaría otra encima. Es la regla de `FichaExtra` (./ficha-datos.ts).
 *
 * `acceso: null` sin error = no hay curso (ningún producto suyo tiene clases): no se lo invita
 * a un portal vacío.
 */
export type CursoDeCliente = {
  /** Su nombre y el email del CRM: el título del modal de invitar y con qué viene prellenado. */
  nombre: string;
  emailCrm: string | null;
  productos: ProductoFicha[] | null;
  errorProductos?: string;
  acceso: AccesoFicha | null;
  errorAcceso?: string;
  sesiones: Sesion[] | null;
  errorSesiones?: string;
  /**
   * Las áreas que declaró en su tabla de áreas (#665), SÓLO si su curso tiene clases por área: sin
   * ellas no hay a qué invitar a un líder, y la ficha no ofrece nada. `[]` = no aplica.
   */
  areas?: string[];
  /** El acceso de cada LÍDER de área que ya tiene uno (invitado o con su link copiado). */
  lideres?: AccesoLiderFicha[];
};

/**
 * El acceso del LÍDER de un área, como lo dibuja la ficha (#665). Es el de un cliente más su área.
 * `link`: el `c2.` de la versión vigente, firmado al leer (no escribe). `null` = cortado o sin secreto.
 */
export type AccesoLiderFicha = AccesoFicha & { area: string };

/**
 * Un `datetime-local` («2026-10-12T10:30») a ISO, en el NAVEGADOR.
 *
 * ⚠️ ES HORA LOCAL DE QUIEN LA ESCRIBE, y por eso la conversión va acá y no en el server: una
 * fecha-hora sin zona, en `new Date()`, se interpreta en la zona del que la corre (ECMAScript,
 * a diferencia de una fecha sola, que va en UTC). En el server sería la zona de Vercel, y la
 * llamada de las 10 quedaría a las 4 o a las 17 según dónde corra la función.
 * `null` = no es una fecha-hora válida.
 */
export function isoDeLocal(valor: string): string | null {
  const v = (valor ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Un instante, en la hora local de quien mira: «12 oct, 10:30». */
export function fechaHoraLocal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}

export type AvisoSesion = { cual: 'previo' | 'posterior'; estado: 'enviado' | 'pendiente' | 'no-salio' };

/**
 * En qué quedaron los dos avisos de una llamada (los manda el cron: lib/curso-mensajes.ts).
 *
 * ⚠️ «NO SALIÓ» SÓLO PARA EL PREVIO DE UNA LLAMADA QUE YA PASÓ: su momento se fue. El posterior
 * de una llamada pasada sigue «pendiente» — sale después, y el cron puede no haber corrido
 * todavía. Afirmar «no salió» ahí sería adelantarse al cron.
 *
 * ⚠️ LA MARCA NO ES «LE LLEGÓ»: ES «SE PROCESÓ». El cron la escribe ANTES de mandar
 * (compare-and-set, para no mandar dos veces) y no la deshace si el envío falló o si el cliente
 * estaba al día. (Sin teléfono, contacto bloqueado y acceso cortado ya NO marcan desde el
 * 06/10/2026: la sesión queda sin marca, con su motivo, esperando a que se arregle — o sea
 * «pendiente» con el porqué debajo.) Lo que distingue es el motivo anotado de esa fase
 * (`motivoDeFase`): con motivo, no salió. Leyendo sólo la marca, la ficha decía «enviado» con
 * «Antes: sin teléfono» escrito justo debajo (revisión del 06/10/2026).
 */
export function avisosDeSesion(
  s: Pick<Sesion, 'fecha' | 'avisoPrevioAt' | 'avisoPosteriorAt'> & { avisoMotivo?: string | null },
  ahora: number = Date.now(),
): AvisoSesion[] {
  const t = Date.parse(s.fecha);
  const paso = Number.isFinite(t) && t <= ahora;
  const est = (marca: string | null, fase: 'previo' | 'posterior', vencido: boolean): AvisoSesion['estado'] =>
    marca ? (motivoDeFase(s.avisoMotivo, fase) ? 'no-salio' : 'enviado') : vencido ? 'no-salio' : 'pendiente';
  return [
    { cual: 'previo', estado: est(s.avisoPrevioAt, 'previo', paso) },
    { cual: 'posterior', estado: est(s.avisoPosteriorAt, 'posterior', false) },
  ];
}
