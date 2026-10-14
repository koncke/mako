'use server';

// =============================================================================
// curso-ficha-actions — la pestaña «Curso» de la ficha de un cliente
// =============================================================================
// Pedido de Martín (06/10/2026): «Dentro del Detail de los clientes de Mauricio se tiene que
// ver este CURSO». Lo que se ve (y se hace) acá: su avance clase por clase, lo que contestó,
// marcar una tarea revisada, su link personal al portal y las llamadas de la entrega. Y desde
// el mismo día, INVITARLO al curso por mail («al igual que en la vista de Agencia, se debería
// poder INVITAR al cliente a MaKo para que tenga acceso al curso»).
//
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC. Un `export const` o un
// `export type` con valor tipan perfecto y TIRAN EL BUILD (AGENTS.md). Los tipos de lo que
// devuelven viven en ./curso-ficha-lectura.ts; los helpers de acá abajo van sin exportar.
//
// ⚠️ NINGUNA CONSULTA PROPIA SALVO LA PUERTA (y guardar el email del lead al invitar, que es
// el mismo dato que guarda `crearCuentaMakoAction`): todo pasa por lib/curso-datos.ts (la capa
// de datos del curso, que también usan la tab Curso, el portal y el cron). Una segunda forma de
// leer el avance o de revocar un acceso es la copia que diverge.
//
// ⚠️ LA PUERTA SE PREGUNTA EN CADA ACTION, no al abrir la pestaña: una server action es un POST
// que cualquiera puede mandar con cualquier `leadId`. Las tres preguntas son las de la página y
// las de ./actions.ts: hay sesión contra la base y el workspace tiene Customer Success en su capa
// (`puedeUsarCs` de ./puerta.ts, que es `requireCapa('customer-success')` de page.tsx sin el
// redirect), y el lead es un cliente GANADO de ESTE workspace. Fail-closed. La primera línea de
// cada export es `puerta(leadId)`: lo fija tests/cs-acciones-puerta.test.ts.
//
// ⚠️ ABRIR LA PESTAÑA NO ESCRIBE NADA (06/10/2026). Hasta acá `cursoDeClienteAction` llamaba a
// `linkDeAcceso`, que CREA la fila del acceso: mirar la ficha «le daba acceso» a alguien, y la
// tabla Avance no podía distinguir «nunca se lo invitó» de «alguien abrió su ficha». Ahora la
// fila nace sólo en las acciones que la necesitan: invitar, copiar el link, mandarlo por
// WhatsApp y —desde el 07/10/2026— guardarle PERMISOS (el alcance vive en esa fila, mig 0219).
// Lo fija tests/curso-ficha.test.ts.

import { getTenantDb, getWorkspaceActual, getWorkspace } from '@/lib/workspace';
import { puedeUsarCs } from './puerta';
import { productosDelCliente } from './entrega';
import { getUsuarioActual } from '@/lib/auth';
import { nombresDeCursos } from '@/lib/curso-nombre-datos';
import { SIN_NOMBRE_EQUIPO } from '@/lib/curso-nombre';
import { entregasDeProductos } from '@/lib/entrega-servicio';
import { colorDeEtapa } from '@/lib/servicio-etapas';
import { emailNormalizado, emailUtilizable } from '@/lib/agencia-altas';
import { invitarLiderPorEmail } from '@/lib/invitaciones';
import { invitarAlCurso, TEXTO_NO_INVITA } from '@/lib/curso-invitar';
import { cambiarModulos, moduloPermitido, type AlcanceCurso } from '@/lib/curso-alcance';
import { modulosDelCurso, contextoDelAlumno } from '@/lib/curso-modulos-datos';
import { aperturasDe } from '@/lib/curso-bloqueo';
import type { ModuloCurso } from '@/lib/curso-modulos';
import {
  clasesDelProducto, claseDeId, progresoDelCliente, avanceDelCliente, accesoDe, linkDeAcceso, marcarInvitacion,
  revocarAcceso, reactivarAcceso, sesionesDe, agendarSesion, borrarSesion, aprobarTarea, productosDelAlumno,
  ubicacionEnEntregaDe, accesosDeLideres, linkDeAccesoLider, linkDeLiderLeido, guardarAlcance, ponerDesbloqueo,
  accesoParaPantalla,
  type EstadoAccesoLider, type Sesion,
} from '@/lib/curso-datos';
import { mandarLinkDelCurso } from '@/lib/curso-mensajes';
import { urlEntregaParaEquipo, darOtroIntento } from '@/lib/curso-entregas';
import { nombreDeArea, type Clase, type EstadoTarea, type Progreso } from '@/lib/curso';
import {
  armarProducto, avisoInvitacionCurso, bloqueosDeFicha,
  type AccesoFicha, type AccesoLiderFicha, type AvisoInvitacionCurso, type CursoDeCliente, type ProductoFicha,
  type BloqueoFicha,
} from './curso-ficha-lectura';

type Fallo = { ok: false; error: string };
const mal = (e: unknown, def: string): Fallo => ({ ok: false, error: e instanceof Error ? e.message : def });

/** Quién firma: el email de quien está logueado, como en el CRM. Sin sesión con email, 'CRM'. */
async function autorActual(): Promise<string> {
  try {
    return (await getUsuarioActual())?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

/** El cliente, como lo devuelve la puerta: su nombre y el email del CRM (para invitarlo). */
type LeadPuerta = { nombre: string; email: string | null };

/**
 * La puerta de todas las actions de acá. Ver la cabecera.
 *
 * ⚠️ «NO PUDE VERIFICAR» NO ES «ES TUYO»: si la lectura del lead falla, se corta. Un error de la
 * consulta tratado como un vacío dejaría pasar, y uno tratado como «no es tuyo» mentiría: se
 * dice lo que pasó.
 *
 * Devuelve el nombre y el email del lead porque ya los tiene en la mano: pedirlos aparte para el
 * modal de invitar sería una segunda lectura de la misma fila.
 *
 * ⚠️ LA SESIÓN Y LA CAPA SON `puedeUsarCs` (./puerta.ts), la MISMA que abre cada action de
 * ./actions.ts, y van PRIMERO: no se le contesta nada sobre un cliente a quien no tiene la tab.
 * Hasta el 06/10/2026 estas dos preguntas estaban escritas acá a mano, y las de ./actions.ts no
 * existían: dos lugares para una regla, y uno vacío.
 */
async function puerta(leadId: number): Promise<{ ok: true; lead: LeadPuerta } | Fallo> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  if (!Number.isInteger(leadId) || leadId <= 0) return { ok: false, error: 'Ese cliente no existe.' };
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id, nombre, email').eq('id', leadId).eq('estado_lead', 'ganado').maybeSingle();
  if (error) return { ok: false, error: `No pude verificar el cliente: ${error.message}` };
  if (!data) return { ok: false, error: 'Ese cliente no es de este workspace.' };
  const l = data as { nombre: string | null; email: string | null };
  return { ok: true, lead: { nombre: (l.nombre ?? '').trim(), email: l.email?.trim() || null } };
}

/**
 * El estado de su acceso tal cual lo ve la ficha, leído DESPUÉS de lo que se haya hecho.
 *
 * ⚠️ NO ESCRIBE: el link se FIRMA con la versión vigente, no se pide a `linkDeAcceso`, que crea
 * la fila. Sin fila no hay link (`existe: false`): lo crean invitar, copiar o mandar.
 *
 * ⚠️ ES `accesoParaPantalla` (lib/curso-datos.ts) DESDE EL 09/10/2026, y no una copia privada: acá
 * vivía `aFicha`, la misma lectura escrita dos veces, y la copia se quedó sin `productos` (qué cursos
 * abre, mig 0232) — justo lo que la ficha necesita para decir «Invitado» o «Invitar» desde el curso
 * elegido arriba (`accesoEnProducto`, FichaCurso.tsx).
 */
async function accesoActual(leadId: number, ws: number | null): Promise<AccesoFicha> {
  return accesoParaPantalla(leadId, ws);
}

/**
 * Sus productos (los del CLIENTE) que tienen al menos una clase, con su nombre y sus clases, y su
 * casa en el CRM. Lo usan el avance de la ficha, los permisos y los candados.
 *
 * ⚠️ «DE QUÉ ES CLIENTE» (`productosDelCliente`, la regla del kanban), NO «QUÉ VE» (09/10/2026, mig
 * 0232). La ficha es del EQUIPO: tiene que mostrar —y dejar invitar a— un curso de un producto del
 * que es cliente aunque su acceso todavía no lo abra. Con `productosDelAlumno` (que desde la 0232
 * contesta «qué cursos VE»), a un alumno invitado sólo a un curso la ficha le escondía los otros, y
 * agendar una llamada de ese producto contestaba «no es suyo».
 */
async function cursosDelCliente(leadId: number): Promise<{ ids: number[]; casa: number | null; cursos: CursoConClases[] }> {
  const { productos: ids, casa } = await productosDelCliente(leadId);
  return { ids, casa, cursos: await cursosDe(ids) };
}

type CursoConClases = { productoId: number; nombre: string; clases: Clase[] };

/** De esos productos, los que tienen al menos una clase, con su nombre y sus clases (en ese orden). */
async function cursosDe(ids: readonly number[]): Promise<CursoConClases[]> {
  if (!ids.length) return [];
  // El nombre de cada curso como lo ve el alumno: el título puesto a mano o el de su OFERTA, NUNCA el del
  // producto, que es el CRM (lib/curso-nombre.ts, 13 y 14/10/2026). Sin ninguno, «Curso sin nombre».
  const [clases, nombresCurso] = await Promise.all([
    Promise.all(ids.map(async (id) => [id, await clasesDelProducto(id)] as const)),
    nombresDeCursos(ids, { conTitulo: true }).catch(() => new Map<number, string>()),
  ]);
  return clases.filter(([, cs]) => cs.length > 0).map(([id, cs]) => ({ productoId: id, nombre: nombresCurso.get(id) ?? SIN_NOMBRE_EQUIPO, clases: cs }));
}

/**
 * Lo cerrado para él y lo abierto a mano en UN producto (D2), con la MISMA evaluación que el portal
 * (`aperturasDe` sobre `contextoDelAlumno`). `undefined` si no se pudo evaluar: la ficha no lo lista
 * (y no ofrece abrir nada a ciegas), y el resto de la pestaña sigue.
 */
async function bloqueosDelProducto(p: {
  leadId: number; productoId: number; casa: number | null; alcance: AlcanceCurso;
  modulos: ModuloCurso[]; etapas: readonly { key: string; label: string }[]; actual: string | null;
  clases: Clase[]; progreso: ReadonlyMap<number, Progreso>;
}): Promise<BloqueoFicha[] | undefined> {
  try {
    const permitido = (clave: string) => moduloPermitido(p.alcance, p.productoId, clave);
    const contexto = await contextoDelAlumno({ leadId: p.leadId, productoId: p.productoId, casa: p.casa, modulos: p.modulos, clases: p.clases });
    const ap = aperturasDe({ modulos: p.modulos, etapas: p.etapas, actual: p.actual, clases: p.clases, progreso: p.progreso, permitido, contexto });
    return bloqueosDeFicha(p.modulos, p.clases, ap, permitido);
  } catch (e) {
    console.warn(`[curso-ficha] no pude evaluar los candados del lead ${p.leadId}:`, e instanceof Error ? e.message : e);
    return undefined;
  }
}

/**
 * Sus productos CON CLASES, armados por etapa, con la actual marcada y la fila de Avance.
 *
 * ⚠️ `ubicacionEnEntregaDe` SÓLO PARA LOS QUE TIENEN CLASES. Cada llamada vuelve a resolver los
 * productos del alumno salvo que se le pasen (`ids`), así que pedirla para un producto sin curso
 * es pagar esa lectura para no dibujar nada.
 *
 * ⚠️ Y ES `ubicacionEnEntregaDe`, NO `etapaActualDe`: con la etapa de su fila borrada, la otra
 * contesta «la primera» (la regla del portal) y esta pestaña marcaba «Actual» una etapa mientras
 * la cabecera de la misma ficha decía «Etapa borrada». `borrada` viaja a `armarProducto`, que no
 * marca ninguna y lo dice en la fila de Avance.
 */
async function productosConCurso(leadId: number): Promise<{ productos: ProductoFicha[]; areas: string[] }> {
  const { ids, casa, cursos } = await cursosDelCliente(leadId);
  if (!cursos.length) return { productos: [], areas: [] };
  // `avanceDelCliente` y no `progresoDelCliente`: trae además lo que contestó cada área y las áreas
  // que declaró (#665), en la MISMA lectura. Los MÓDULOS de cada curso (D1) y el acceso (sus permisos,
  // para no ofrecer abrir a mano lo que no es suyo) van en la misma ronda.
  // La casa sale de la MISMA lectura que los productos (`cursosDelCliente`): es un hecho del CRM y no
  // depende de lo que abra su acceso.
  const [entregas, avance, actuales, cursosMods, acceso] = await Promise.all([
    entregasDeProductos(cursos.map((c) => c.productoId)),
    avanceDelCliente(leadId),
    Promise.all(cursos.map((c) => ubicacionEnEntregaDe(leadId, c.productoId, ids))),
    Promise.all(cursos.map((c) => modulosDelCurso(c.productoId))),
    accesoDe(leadId).catch(() => null),
  ]);
  const out: ProductoFicha[] = [];
  await Promise.all(cursos.map(async (c, i) => {
    const cfg = entregas.get(c.productoId);
    const mods = cursosMods[i].modulos;
    const p = armarProducto({
      productoId: c.productoId,
      nombre: c.nombre,
      // El color es el del kanban (`colorDeEtapa`, con sus fases), el mismo que la tabla Avance.
      etapas: (cfg?.etapas ?? []).map((e) => ({ key: e.key, label: e.label, color: colorDeEtapa(e, cfg?.fases ?? []) })),
      modulos: mods,
      clases: c.clases,
      progreso: avance.progreso,
      porArea: avance.porArea,
      areas: avance.areas,
      etapaActual: actuales[i].etapa,
      etapaBorrada: actuales[i].borrada,
    });
    if (!p) return;
    const b = await bloqueosDelProducto({
      leadId, productoId: c.productoId, casa, alcance: acceso?.alcance ?? null, modulos: mods,
      etapas: cursosMods[i].entrega.etapas, actual: actuales[i].etapa, clases: c.clases, progreso: avance.progreso,
    });
    if (b) p.bloqueos = b;
    out[i] = p;
  }));
  // `out[i]` y no `push`: en el orden de sus productos, aunque las evaluaciones terminen en otro.
  const productos = out.filter(Boolean);
  // Las áreas sólo importan si hay a qué invitar a un líder: alguna clase por área en su curso.
  const conPorArea = cursos.some((c) => c.clases.some((x) => x.porArea === true));
  return { productos, areas: conPorArea ? avance.areas : [] };
}

/** Los accesos de sus líderes, como los dibuja la ficha: leídos y firmados, sin escribir nada. */
async function lideresActuales(leadId: number, ws: number | null): Promise<AccesoLiderFicha[]> {
  return (await accesosDeLideres(leadId)).map((l) => aFichaLider(l, leadId, ws));
}

function aFichaLider(l: EstadoAccesoLider, leadId: number, ws: number | null): AccesoLiderFicha {
  return {
    area: l.area,
    existe: true,
    link: ws ? linkDeLiderLeido(l, ws, leadId) : null,
    revocado: l.revocado,
    ingresos: l.ingresos,
    ultimoIngresoAt: l.ultimoIngresoAt,
    email: l.email,
    invitacionEnviadaAt: l.invitacionEnviadaAt,
  };
}

/**
 * El área pedida, si es UNA DE LAS SUYAS y su curso tiene clases por área. Lo que llega del
 * navegador no se cree: un nombre inventado crearía el acceso de un líder de un área que no existe.
 */
async function areaDelCliente(leadId: number, pedida: unknown): Promise<{ ok: true; area: string } | Fallo> {
  const area = nombreDeArea(pedida);
  if (!area) return { ok: false, error: 'Falta el área.' };
  const { areas } = await productosConCurso(leadId);
  if (!areas.includes(area)) return { ok: false, error: 'Esa área no es de este cliente.' };
  return { ok: true, area };
}

/**
 * Todo lo que la pestaña dibuja, en UNA action al abrirla (y al mover de etapa desde la
 * cabecera, ver FichaCurso).
 *
 * ⚠️ SÓLO LEE. El acceso sale de `accesoActual` (lee y firma); si el cliente nunca tuvo acceso,
 * vuelve `existe: false` y la pantalla dice «Sin invitar». Ver la cabecera.
 */
export async function cursoDeClienteAction(leadId: number): Promise<{ ok: true; curso: CursoDeCliente } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const curso: CursoDeCliente = { nombre: p.lead.nombre, emailCrm: p.lead.email, productos: null, acceso: null, sesiones: null };

    const ws = await getWorkspaceActual();
    const [productos, sesiones, acceso, lideres] = await Promise.allSettled([
      productosConCurso(leadId), sesionesDe(leadId), accesoActual(leadId, ws), lideresActuales(leadId, ws),
    ]);
    if (productos.status === 'fulfilled') {
      curso.productos = productos.value.productos;
      curso.areas = productos.value.areas;
    } else curso.errorProductos = productos.reason instanceof Error ? productos.reason.message : 'No pude leer sus clases.';
    if (sesiones.status === 'fulfilled') curso.sesiones = sesiones.value;
    else curso.errorSesiones = sesiones.reason instanceof Error ? sesiones.reason.message : 'No pude leer sus llamadas.';

    // Sin curso no hay acceso que mostrar: no se lo invita a un portal vacío.
    if (curso.productos?.length) {
      if (acceso.status === 'fulfilled') curso.acceso = acceso.value;
      else curso.errorAcceso = acceso.reason instanceof Error ? acceso.reason.message : 'No pude leer su acceso.';
      // Los líderes: si la lectura falla, la ficha no los lista (y no ofrece nada sobre ellos).
      if (lideres.status === 'fulfilled') curso.lideres = lideres.value;
    }
    return { ok: true, curso };
  } catch (e) {
    return mal(e, 'No pude leer su curso.');
  }
}

/**
 * Marca revisada (o le quita la revisión a) la tarea de una clase.
 *
 * ⚠️ DEVUELVE EL ESTADO QUE QUEDÓ, leído de la base, no el pedido: `aprobarTarea` sólo aprueba
 * una tarea ENVIADA (y sólo des-aprueba una aprobada). Sobre una pendiente no cambia nada, y la
 * pantalla tiene que enterarse en vez de pintar «Revisada» sobre algo que no lo está.
 *
 * ⚠️ NO MUEVE DE ETAPA, a propósito: la etapa cierra al ENVIAR (lib/curso.ts). Revisar es una
 * marca del equipo, no un evento del cliente.
 */
export async function aprobarTareaCursoAction(leadId: number, claseId: number, aprobada: boolean): Promise<{ ok: true; estado: EstadoTarea } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    // La clase tiene que ser de este workspace (`claseDeId` lee con el inquilino puesto).
    if (!(await claseDeId(claseId))) return { ok: false, error: 'Esa clase no existe.' };
    await aprobarTarea(leadId, claseId, aprobada === true);
    const estado = (await progresoDelCliente(leadId)).get(claseId)?.estado ?? 'pendiente';
    return { ok: true, estado };
  } catch (e) {
    return mal(e, 'No se pudo guardar.');
  }
}

/**
 * Su link al portal, CREANDO su acceso si no lo tenía. Lo llama «Copiar link» cuando la ficha
 * todavía no tiene link que copiar (nunca se le dio acceso).
 */
export async function linkDelCursoAction(leadId: number): Promise<{ ok: true; acceso: AccesoFicha } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };
    await linkDeAcceso(leadId, ws, await autorActual());
    const acceso = await accesoActual(leadId, ws);
    if (acceso.revocado) return { ok: false, error: 'Su acceso está cortado.' };
    if (!acceso.link) return { ok: false, error: 'No pude armar su link.' };
    return { ok: true, acceso };
  } catch (e) {
    return mal(e, 'No pude armar su link.');
  }
}

/**
 * Le manda su link por WhatsApp. El cuerpo del envío NO vive acá: es el contrato de
 * lib/curso-mensajes.ts (`mandarLinkDelCurso`), y su motivo vuelve tal cual si no salió.
 *
 * Devuelve el acceso RELEÍDO porque mandar puede haberlo creado (`linkDeAcceso`). Si esa
 * relectura falla, vuelve `null` y NO un error: el mensaje ya salió, y decir «no se mandó» haría
 * que alguien lo mande de nuevo.
 */
export async function mandarLinkCursoAction(leadId: number): Promise<{ ok: true; acceso: AccesoFicha | null } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const r = await mandarLinkDelCurso(leadId, { porQuien: await autorActual() });
    if (!r.ok) return { ok: false, error: r.motivo?.trim() || 'No se mandó.' };
    const acceso = await getWorkspaceActual().then((ws) => accesoActual(leadId, ws)).catch(() => null);
    return { ok: true, acceso };
  } catch (e) {
    return mal(e, 'No se mandó.');
  }
}

/**
 * Lo INVITA al curso por mail (pedido del 06/10/2026). Con la forma de «Abrir cuenta» de la
 * vista de Agencia —el email obligatorio, un mail que sale de verdad, el estado visible y
 * reenviar— pero SIN crear workspace, cuenta ni aprobación cruzada: es el mismo negocio y el que
 * invita es el dueño. El acceso es el del curso (`curso_accesos`, un link firmado).
 *
 * ⚠️ DESDE EL 07/10/2026 ES UN ENVOLTORIO DE SU PUERTA. La invitación entera —el orden (cortado
 * gana, que tenga curso, el link de ENTRADA de la versión vigente con `linkDeEntradaAlumno`, que
 * crea el acceso con `linkDeAcceso`; el mail, y anotar SÓLO si salió; guardarle el email al lead)—
 * vive en lib/curso-invitar.ts (`invitarAlCurso`), porque el CRM la necesita SIN sesión
 * (`invitarAlCursoSinSesion`) y con dos copias una se queda vieja. Acá queda lo que es de una
 * persona apretando un botón: la puerta, el email que tipeó (obligatorio) y `reenviar: true` —
 * «Reenviar invitación» es justamente mandarla otra vez, así que no corta por «ya invitado».
 *
 * ⚠️ EL AVISO SALE DE `enviado`, NUNCA DE QUE HAYA UN RESULTADO (`avisoInvitacionCurso`): el
 * falso éxito que tenían los avisos de aprobación de agencia.
 */
export async function invitarAlCursoAction(leadId: number, email: string): Promise<{ ok: true; enviado: boolean; acceso: AccesoFicha | null; aviso: AvisoInvitacionCurso } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const correo = emailNormalizado(typeof email === 'string' ? email : '');
    if (!emailUtilizable(correo)) return { ok: false, error: 'Ese email no sirve.' };
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };

    const r = await invitarAlCurso({ ws, leadId, email: correo, autor: await autorActual(), reenviar: true });
    if (r.tipo === 'error') return { ok: false, error: r.error };
    if (r.tipo === 'no') return { ok: false, error: TEXTO_NO_INVITA[r.motivo] };
    const acceso = await accesoActual(leadId, ws).catch(() => null);
    return { ok: true, enviado: r.enviado, acceso, aviso: avisoInvitacionCurso({ enviado: r.enviado, error: r.fallo ?? undefined }, r.anotado) };
  } catch (e) {
    return mal(e, 'No se pudo invitar.');
  }
}

/**
 * Los PERMISOS del alumno en UN producto (item 9, 07/10/2026: «poder administrar los permisos de ese
 * alumno, ya sea solo algunos módulos o lo que sea»). `claves: null` = «Todos los módulos»; un array
 * = sólo ésos. Devuelve el acceso como quedó (guardar puede haberlo creado).
 *
 * ⚠️ LO QUE LLEGA DEL NAVEGADOR NO SE CREE: el producto tiene que ser SUYO y con curso, y de las
 * claves quedan sólo las de módulos que existen hoy (las etapas de su entrega y las claves que tienen
 * sus clases). Y se cambia ESE producto sobre lo que está guardado, nunca el alcance entero que mandó
 * la pantalla.
 *
 * ⚠️ SE VALIDA SÓLO EL PRODUCTO QUE CAMBIA (`cambiarModulos`, lib/curso-alcance.ts, con test), y las
 * restricciones de los OTROS quedan como estaban (revisión del 08/10/2026): validarlas todas contra
 * los productos que HOY tienen curso le ABRÍA un producto entero a quien se lo habían cerrado.
 *
 * ⚠️ Y LAS ETAPAS SE LEEN ESTRICTAS (`estricto: true`). La lectura de la ficha cae a las etapas de
 * FÁBRICA si el catálogo no contesta, y eso sirve para dibujar, no para decidir qué claves existen:
 * con las de fábrica, tildar un módulo sin clases lo descartaba en silencio (AGENTS.md, «Una lectura
 * que cae al DEFAULT…»). Con el catálogo caído no se guarda nada y se dice.
 *
 * ⚠️ NO ES ATÓMICO: lee el alcance y lo reescribe entero. Dos guardados de productos distintos en el
 * MISMO instante pueden pisarse (gana el último); lo que sí no pasa es que una pestaña vieja
 * reescriba lo que no tocó, porque se parte de la base y no de la pantalla.
 */
export async function guardarAlcanceCursoAction(leadId: number, productoId: number, claves: string[] | null): Promise<{ ok: true; acceso: AccesoFicha } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    if (!Number.isInteger(productoId) || productoId <= 0) return { ok: false, error: 'Ese producto no existe.' };
    if (claves != null && (!Array.isArray(claves) || claves.some((c) => typeof c !== 'string'))) return { ok: false, error: 'Esos módulos no se entienden.' };
    const { productos } = await productosConCurso(leadId);
    const prod = productos.find((x) => x.productoId === productoId);
    if (!prod) return { ok: false, error: 'Ese producto no es suyo.' };
    // Los módulos que el producto tiene HOY (D1: las etapas que son módulo y los sueltos), leídos
    // ESTRICTOS: con la lectura que cae al default se validaría contra las etapas de fábrica. Sólo
    // hacen falta si se eligieron módulos.
    let existen: string[] = [];
    if (claves != null) {
      const cur = await modulosDelCurso(productoId, { estricta: true });
      if (!cur) return { ok: false, error: 'No pude leer los módulos. Intenta de nuevo.' };
      existen = cur.modulos.map((m) => m.clave);
    }
    const actual = (await accesoDe(leadId))?.alcance ?? null;
    await guardarAlcance(leadId, cambiarModulos(actual, productoId, claves, existen), await autorActual());
    return { ok: true, acceso: await accesoActual(leadId, await getWorkspaceActual()) };
  } catch (e) {
    return mal(e, 'No se guardaron los permisos.');
  }
}

/**
 * «Abrir a mano» (D2): le abre (o le vuelve a cerrar) a ESTE alumno un módulo o una clase que su
 * candado tiene cerrado. Gana sobre cualquier candado (`curso_desbloqueos`, mig 0220). Devuelve su
 * producto como quedó (con lo cerrado y lo abierto a mano), para que la ficha no recargue.
 *
 * ⚠️ LO QUE LLEGA DEL NAVEGADOR SE MIRA CONTRA LA BASE: el producto tiene que ser suyo, el módulo uno
 * del curso (leído ESTRICTO) y la clase una de ese producto. Una clave inventada dejaría una fila que
 * no abre nada — o, peor, que abre lo que se cree mañana con esa clave.
 */
export async function desbloquearAction(
  leadId: number, productoId: number, objeto: 'modulo' | 'clase', clave: string, abrir: boolean,
): Promise<{ ok: true; producto: ProductoFicha } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    if (objeto !== 'modulo' && objeto !== 'clase') return { ok: false, error: 'No se entiende qué abrir.' };
    if (typeof abrir !== 'boolean' || typeof clave !== 'string' || !clave) return { ok: false, error: 'No se entiende qué abrir.' };
    const { productos } = await productosConCurso(leadId);
    if (!productos.some((x) => x.productoId === productoId)) return { ok: false, error: 'Ese producto no es suyo.' };
    if (objeto === 'modulo') {
      const cur = await modulosDelCurso(productoId, { estricta: true });
      if (!cur) return { ok: false, error: 'No pude leer los módulos. Intenta de nuevo.' };
      if (!cur.modulos.some((m) => m.clave === clave)) return { ok: false, error: 'Ese módulo ya no existe.' };
    } else {
      const c = await claseDeId(Number(clave));
      if (!c || c.productoId !== productoId || String(c.id) !== clave) return { ok: false, error: 'Esa clase ya no existe.' };
    }
    await ponerDesbloqueo(leadId, productoId, objeto, clave, abrir, await autorActual());
    const quedo = (await productosConCurso(leadId)).productos.find((x) => x.productoId === productoId);
    if (!quedo) return { ok: false, error: 'Ese producto ya no tiene curso.' };
    return { ok: true, producto: quedo };
  } catch (e) {
    return mal(e, abrir ? 'No se pudo abrir.' : 'No se pudo cerrar.');
  }
}

/**
 * Corta su acceso: sube la versión y todos los links ya mandados dejan de abrir — también los de
 * sus LÍDERES de área (`revocarAcceso` explica por qué), que vuelven releídos.
 */
export async function cortarAccesoCursoAction(leadId: number): Promise<{ ok: true; acceso: AccesoFicha; lideres: AccesoLiderFicha[] | null } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    await revocarAcceso(leadId);
    const ws = await getWorkspaceActual();
    const acceso = await accesoActual(leadId, ws);
    // Lo que QUEDÓ: si la fila no existía (nunca se le dio), revocar no hace nada y se dice.
    if (!acceso.revocado) return { ok: false, error: 'No tenía acceso para cortar.' };
    return { ok: true, acceso, lideres: await lideresActuales(leadId, ws).catch(() => null) };
  } catch (e) {
    return mal(e, 'No se pudo cortar.');
  }
}

/**
 * Lo vuelve a habilitar. El link es NUEVO: la versión subió al cortar, así que el viejo sigue
 * sin abrir — hay que mandarle éste (o reenviarle la invitación, que manda el vigente).
 */
export async function habilitarAccesoCursoAction(leadId: number): Promise<{ ok: true; acceso: AccesoFicha } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };
    await reactivarAcceso(leadId);
    const acceso = await accesoActual(leadId, ws);
    if (acceso.revocado) return { ok: false, error: 'Sigue cortado.' };
    return { ok: true, acceso };
  } catch (e) {
    return mal(e, 'No se pudo habilitar.');
  }
}

// ── Los LÍDERES de área (#665) ─────────────────────────────────────────────────
// «m6-m9 por área con link propio del líder de área» (Martín, 06/10/2026). El líder recibe un link
// (`c2.`) que abre SÓLO las clases por área de SU área. ⛔ NUNCA una cuenta: ni `mako_session`, ni
// fila en `usuarios`, ni la cookie del alumno — nada de acá llama a `crearUsuario`, a `invitarPorEmail`
// (que es el de las cuentas) ni a la entrada del mail del cliente.

/**
 * ¿El acceso DEL CLIENTE está cortado? Mientras lo esté, ningún líder suyo nace ni se habilita:
 * cortar al cliente (porque dejó de pagar) corta a los líderes que existen en ese momento, y un
 * «Copiar link» o un «Volver a habilitar» después le abriría el portal a su gente igual. El portal
 * tampoco lo abre (`resolverAccesoPortal`); esto es para no darle un link que no abre.
 * Cortar a un líder sí se puede siempre.
 */
const CLIENTE_CORTADO = 'El acceso del cliente está cortado.';
async function clienteCortado(leadId: number): Promise<boolean> {
  return (await accesoDe(leadId))?.revocado === true;
}

/**
 * Invita al LÍDER de un área por mail. El mismo orden que `invitarAlCursoAction`: la puerta, un email
 * que sirva, que el área sea SUYA (de las que declaró, y con clases por área en su curso), el acceso
 * del líder —creándolo, y si está cortado no se invita—, el mail, y SÓLO SI SALIÓ se anota. Después
 * del envío nada puede tirar: un error haría que alguien lo reenvíe.
 */
export async function invitarLiderAction(leadId: number, area: string, email: string): Promise<{ ok: true; enviado: boolean; lideres: AccesoLiderFicha[] | null; aviso: AvisoInvitacionCurso } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const correo = emailNormalizado(typeof email === 'string' ? email : '');
    if (!emailUtilizable(correo)) return { ok: false, error: 'Ese email no sirve.' };
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };
    const a = await areaDelCliente(leadId, area);
    if (!a.ok) return a;
    if (await clienteCortado(leadId)) return { ok: false, error: CLIENTE_CORTADO };

    const autor = await autorActual();
    const enlace = await linkDeAccesoLider(leadId, ws, a.area, autor);
    if (!enlace) {
      const cortado = (await accesoDe(leadId, a.area))?.revocado;
      return { ok: false, error: cortado ? 'Su acceso está cortado. Primero vuelve a habilitarlo.' : 'No pude armar su link.' };
    }
    // ⚠️ El mail del LÍDER nombra los cursos que su link ABRE, y su link se rige por el acceso del
    // cliente (lib/curso-datos.ts, `productosQueAbre`): «qué ve» (`productosDelAlumno`), no «de qué es
    // cliente», que es lo que muestra la ficha (09/10/2026).
    const cursos = await cursosDe(await productosDelAlumno(leadId));
    const negocio = (await getWorkspace(ws).catch(() => null))?.nombre?.trim() || null;
    const programa = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(cursos.map((c) => c.nombre));

    const inv = await invitarLiderPorEmail({ email: correo, area: a.area, programa, negocio, enlace });

    let anotado = false;
    if (inv.enviado) {
      try {
        await marcarInvitacion(leadId, correo, autor, a.area);
        anotado = true;
      } catch (e) {
        console.error('[curso] la invitación del líder salió y no se pudo anotar:', e instanceof Error ? e.message : e);
      }
    }
    const lideres = await lideresActuales(leadId, ws).catch(() => null);
    return { ok: true, enviado: inv.enviado, lideres, aviso: avisoInvitacionCurso(inv, anotado) };
  } catch (e) {
    return mal(e, 'No se pudo invitar.');
  }
}

/** El link del líder de un área, CREANDO su acceso si no lo tenía: copiar un link es dárselo. */
export async function linkDeLiderAction(leadId: number, area: string): Promise<{ ok: true; lideres: AccesoLiderFicha[]; link: string } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };
    const a = await areaDelCliente(leadId, area);
    if (!a.ok) return a;
    if (await clienteCortado(leadId)) return { ok: false, error: CLIENTE_CORTADO };
    const link = await linkDeAccesoLider(leadId, ws, a.area, await autorActual());
    if (!link) return { ok: false, error: (await accesoDe(leadId, a.area))?.revocado ? 'Su acceso está cortado.' : 'No pude armar su link.' };
    return { ok: true, lideres: await lideresActuales(leadId, ws), link };
  } catch (e) {
    return mal(e, 'No pude armar su link.');
  }
}

/**
 * Corta (o vuelve a habilitar) el acceso del líder de UN área. Se busca por su fila y no por las
 * áreas que el cliente declara hoy: si renombró el área, el acceso viejo se tiene que poder cortar.
 * Habilitar da un link NUEVO (la versión subió al cortar).
 */
export async function cambiarLiderAction(leadId: number, area: string, cual: 'cortar' | 'habilitar'): Promise<{ ok: true; lideres: AccesoLiderFicha[] } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const nombre = nombreDeArea(area);
    if (!nombre || !(await accesoDe(leadId, nombre))) return { ok: false, error: 'Ese líder no tiene acceso.' };
    if (cual === 'cortar') await revocarAcceso(leadId, nombre);
    else {
      if (await clienteCortado(leadId)) return { ok: false, error: CLIENTE_CORTADO };
      await reactivarAcceso(leadId, nombre);
    }
    return { ok: true, lideres: await lideresActuales(leadId, await getWorkspaceActual()) };
  } catch (e) {
    return mal(e, 'No se pudo.');
  }
}

/** Cuánto atrás se acepta una «próxima» llamada: un margen para el que la carga sobre la hora. */
const TOLERANCIA_PASADO_MS = 15 * 60_000;

/**
 * Anota una llamada de la entrega. De ahí salen el aviso del día antes y el de después (cron).
 *
 * ⚠️ LA FECHA LLEGA EN ISO, YA CONVERTIDA EN EL NAVEGADOR (`isoDeLocal`): el `datetime-local` es
 * la hora de quien la escribe, y acá adentro no hay forma de saber cuál era.
 *
 * ⚠️ UNA FECHA PASADA SE RECHAZA: es «próxima llamada», y una ya pasada dispararía su aviso de
 * «después» en la próxima vuelta del cron, sobre una llamada que nadie confirmó que pasó.
 *
 * ⚠️ EL PRODUCTO TIENE QUE SER SUYO: el aviso le habla de las tareas de ese producto.
 */
export async function agendarLlamadaCursoAction(leadId: number, fechaIso: string, nota: string | null, productoId: number | null): Promise<{ ok: true; sesion: Sesion } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const t = Date.parse(fechaIso);
    if (!Number.isFinite(t)) return { ok: false, error: 'Esa fecha no se entiende.' };
    if (t < Date.now() - TOLERANCIA_PASADO_MS) return { ok: false, error: 'Esa hora ya pasó.' };
    let prod: number | null = null;
    if (productoId != null) {
      // «De qué es cliente» (la regla del kanban), no «qué ve»: la llamada es del equipo, y puede ser de
      // un curso al que todavía no se lo invitó. Sus mensajes no le nombran clases de un curso que su
      // acceso no abre (`contenidoDe`, lib/curso-mensajes.ts).
      if (!(await productosDelCliente(leadId)).productos.includes(productoId)) return { ok: false, error: 'Ese producto no es suyo.' };
      prod = productoId;
    }
    const sesion = await agendarSesion(leadId, prod, new Date(t).toISOString(), (nota ?? '').trim().slice(0, 500) || null);
    return { ok: true, sesion };
  } catch (e) {
    return mal(e, 'No se pudo agendar.');
  }
}

/** Borra una llamada anotada (sólo de ese cliente: el id solo no alcanza). */
export async function borrarLlamadaCursoAction(leadId: number, sesionId: number): Promise<{ ok: true } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    if (!Number.isInteger(sesionId) || sesionId <= 0) return { ok: false, error: 'Esa llamada no existe.' };
    await borrarSesion(leadId, sesionId);
    return { ok: true };
  } catch (e) {
    return mal(e, 'No se pudo borrar.');
  }
}

/**
 * La URL firmada de un archivo que el alumno subió en una tarea (#18, mig 0218), para abrirlo desde
 * la ficha. El path tiene que ser DE ESTE cliente (`urlEntregaParaEquipo` lo mira contra el prefijo
 * <ws>/<producto>/<lead>/): un path ajeno en el pedido no abre nada.
 */
export async function urlEntregaCursoAction(leadId: number, path: string, nombre: string): Promise<{ ok: true; url: string } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const r = await urlEntregaParaEquipo(leadId, path, nombre);
    return r.ok ? { ok: true, url: r.url } : r;
  } catch (e) {
    return mal(e, 'No pude abrir el archivo.');
  }
}

/**
 * Otro intento para un quiz (#18) que el alumno agotó sin aprobar. Sin esto, con `intentos > 0`, el
 * que se queda sin intentos queda trabado sin salida: lo destraba el equipo desde acá.
 */
export async function otroIntentoQuizAction(leadId: number, claseId: number, area: string, campoId: string): Promise<{ ok: true } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    if (!(await claseDeId(claseId))) return { ok: false, error: 'Esa clase no existe.' };
    return (await darOtroIntento(leadId, claseId, area, campoId))
      ? { ok: true }
      : { ok: false, error: 'No había intentos que destrabar.' };
  } catch (e) {
    return mal(e, 'No se pudo.');
  }
}
