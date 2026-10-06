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
// las de ./actions.ts: hay sesión contra la base, el workspace tiene Customer Success en su capa
// (`requireCapa('customer-success')` de page.tsx, sin el redirect: acá se contesta), y el lead
// es un cliente GANADO de ESTE workspace (`clienteDelWorkspace` de ./actions.ts). Fail-closed.
//
// ⚠️ ABRIR LA PESTAÑA NO ESCRIBE NADA (06/10/2026). Hasta acá `cursoDeClienteAction` llamaba a
// `linkDeAcceso`, que CREA la fila del acceso: mirar la ficha «le daba acceso» a alguien, y la
// tabla Avance no podía distinguir «nunca se lo invitó» de «alguien abrió su ficha». Ahora la
// fila nace sólo en las tres acciones que la necesitan: invitar, copiar el link y mandarlo por
// WhatsApp. Lo fija tests/curso-ficha.test.ts.

import { getTenantDb, getWorkspaceActual, getCapaActual, getRolWsEfectivo, getWorkspace } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { getUsuarioActual } from '@/lib/auth';
import { listProductos } from '@/lib/productos';
import { entregasDeProductos } from '@/lib/entrega-servicio';
import { colorDeEtapa } from '@/lib/servicio-etapas';
import { linkApp } from '@/lib/app-url';
import { firmarAccesoCurso } from '@/lib/curso-acceso';
import { emailNormalizado, emailUtilizable } from '@/lib/agencia-altas';
import { invitarAlCursoPorEmail } from '@/lib/invitaciones';
import {
  clasesDelProducto, claseDeId, progresoDelCliente, accesoDe, linkDeAcceso, urlDeToken, marcarInvitacion,
  revocarAcceso, reactivarAcceso, sesionesDe, agendarSesion, borrarSesion, aprobarTarea, productosDelAlumno,
  etapaActualDe, type EstadoAcceso, type Sesion,
} from '@/lib/curso-datos';
import { mandarLinkDelCurso } from '@/lib/curso-mensajes';
import type { Clase, EstadoTarea } from '@/lib/curso';
import {
  armarProducto, avisoInvitacionCurso,
  type AccesoFicha, type AvisoInvitacionCurso, type CursoDeCliente, type ProductoFicha,
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
 */
async function puerta(leadId: number): Promise<{ ok: true; lead: LeadPuerta } | Fallo> {
  if (!Number.isInteger(leadId) || leadId <= 0) return { ok: false, error: 'Ese cliente no existe.' };
  if ((await getRolWsEfectivo()) == null) return { ok: false, error: 'Tu sesión venció. Vuelve a entrar.' };
  if (!tabEnCapa('customer-success', await getCapaActual())) return { ok: false, error: 'Esta cuenta no tiene Customer Success.' };
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
 * ⚠️ NO ESCRIBE: el link se FIRMA con la versión vigente (`firmarAccesoCurso`), no se pide a
 * `linkDeAcceso`, que crea la fila. Sin fila no hay link (`existe: false`): lo crean invitar,
 * copiar o mandar.
 */
async function accesoActual(leadId: number, ws: number | null): Promise<AccesoFicha> {
  return aFicha(await accesoDe(leadId), leadId, ws);
}

function aFicha(a: EstadoAcceso | null, leadId: number, ws: number | null): AccesoFicha {
  const token = a && !a.revocado && ws ? firmarAccesoCurso({ ws, leadId, version: a.version }) : null;
  return {
    existe: a != null,
    link: token ? urlDeToken(token) : null,
    revocado: a?.revocado ?? false,
    ingresos: a?.ingresos ?? 0,
    ultimoIngresoAt: a?.ultimoIngresoAt ?? null,
    email: a?.email ?? null,
    invitacionEnviadaAt: a?.invitacionEnviadaAt ?? null,
  };
}

/**
 * Sus productos (los del ALUMNO) que tienen al menos una clase, con su nombre y sus clases.
 * Lo usan el avance de la ficha y la invitación (el nombre del programa va en el asunto).
 *
 * ⚠️ LOS PRODUCTOS SON LOS DEL ALUMNO (`productosDelAlumno`), la MISMA regla que el kanban y que
 * el portal: la ficha no puede mostrar —ni invitar a— un curso que el link del cliente no le
 * abre, ni al revés.
 */
async function cursosDelCliente(leadId: number): Promise<{ ids: number[]; cursos: Array<{ productoId: number; nombre: string; clases: Clase[] }> }> {
  const ids = await productosDelAlumno(leadId);
  if (!ids.length) return { ids, cursos: [] };
  const [catalogo, clases] = await Promise.all([
    listProductos(false),
    Promise.all(ids.map(async (id) => [id, await clasesDelProducto(id)] as const)),
  ]);
  const nombre = new Map(catalogo.map((p) => [Number(p.id), p.nombre]));
  return {
    ids,
    cursos: clases.filter(([, cs]) => cs.length > 0).map(([id, cs]) => ({ productoId: id, nombre: nombre.get(id) ?? 'Producto', clases: cs })),
  };
}

/**
 * Sus productos CON CLASES, armados por etapa, con la actual marcada y la fila de Avance.
 *
 * ⚠️ `etapaActualDe` SÓLO PARA LOS QUE TIENEN CLASES. Cada llamada vuelve a resolver los productos
 * del alumno salvo que se le pasen (`ids`), así que pedirla para un producto sin curso es pagar
 * esa lectura para no dibujar nada.
 */
async function productosConCurso(leadId: number): Promise<ProductoFicha[]> {
  const { ids, cursos } = await cursosDelCliente(leadId);
  if (!cursos.length) return [];
  const [entregas, progreso, actuales] = await Promise.all([
    entregasDeProductos(cursos.map((c) => c.productoId)),
    progresoDelCliente(leadId),
    Promise.all(cursos.map((c) => etapaActualDe(leadId, c.productoId, ids))),
  ]);
  const out: ProductoFicha[] = [];
  cursos.forEach((c, i) => {
    const cfg = entregas.get(c.productoId);
    const p = armarProducto({
      productoId: c.productoId,
      nombre: c.nombre,
      // El color es el del kanban (`colorDeEtapa`, con sus fases), el mismo que la tabla Avance.
      etapas: (cfg?.etapas ?? []).map((e) => ({ key: e.key, label: e.label, color: colorDeEtapa(e, cfg?.fases ?? []) })),
      clases: c.clases,
      progreso,
      etapaActual: actuales[i],
    });
    if (p) out.push(p);
  });
  return out;
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
    const [productos, sesiones, acceso] = await Promise.allSettled([
      productosConCurso(leadId), sesionesDe(leadId), accesoActual(leadId, ws),
    ]);
    if (productos.status === 'fulfilled') curso.productos = productos.value;
    else curso.errorProductos = productos.reason instanceof Error ? productos.reason.message : 'No pude leer sus clases.';
    if (sesiones.status === 'fulfilled') curso.sesiones = sesiones.value;
    else curso.errorSesiones = sesiones.reason instanceof Error ? sesiones.reason.message : 'No pude leer sus llamadas.';

    // Sin curso no hay acceso que mostrar: no se lo invita a un portal vacío.
    if (curso.productos?.length) {
      if (acceso.status === 'fulfilled') curso.acceso = acceso.value;
      else curso.errorAcceso = acceso.reason instanceof Error ? acceso.reason.message : 'No pude leer su acceso.';
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
 * En orden, y el orden importa:
 *   1. la puerta, y un email utilizable (normalizado: es la identidad con la que va a entrar);
 *   2. que tenga curso (sin clases no se lo invita a un portal vacío);
 *   3. su acceso, CREÁNDOLO si no tenía — y si está CORTADO no se invita: un mail con un link que
 *      no abre es peor que ningún mail. Primero se habilita;
 *   4. el link de ENTRADA de la versión VIGENTE (reenviar después de cortar y habilitar manda el
 *      link nuevo, no el que dejó de abrir);
 *   5. el mail, y SÓLO SI SALIÓ se anota (`marcarInvitacion`). Anotar en el intento haría que la
 *      ficha diga «Invitado» sobre un mail que no llegó;
 *   6. si el lead no tenía email en el CRM, se le guarda: es el mismo dato.
 *
 * ⚠️ DESPUÉS DEL ENVÍO NADA PUEDE TIRAR. Si el mail salió y algo de lo que sigue falla, devolver
 * un error haría que alguien lo reenvíe y le lleguen dos. Por eso lo de abajo va con su `catch`.
 *
 * ⚠️ EL AVISO SALE DE `inv.enviado`, NUNCA DE QUE HAYA UN RESULTADO (`avisoInvitacionCurso`): el
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

    const { cursos } = await cursosDelCliente(leadId);
    if (!cursos.length) return { ok: false, error: 'Sus productos todavía no tienen clases.' };

    const autor = await autorActual();
    await linkDeAcceso(leadId, ws, autor);
    const a = await accesoDe(leadId);
    if (!a || a.revocado) return { ok: false, error: 'Su acceso está cortado. Primero vuelve a habilitarlo.' };
    const token = firmarAccesoCurso({ ws, leadId, version: a.version });
    if (!token) return { ok: false, error: 'No pude armar su link.' };

    // ⚠️ EL LINK DE ENTRADA lo sirve /api/compartido/curso/entrar (otro paquete de la misma
    // tanda). Se arma acá con `linkApp` y sin `?ws=`: el workspace viaja adentro de la firma.
    // TODO-COMPARTIR: si ese paquete exporta una función para armar este link, éste la llama.
    const enlace = linkApp('/api/compartido/curso/entrar?t=' + token, null);
    const negocio = (await getWorkspace(ws).catch(() => null))?.nombre?.trim() || null;
    const programa = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(cursos.map((c) => c.nombre));

    const inv = await invitarAlCursoPorEmail({
      email: correo, nombre: p.lead.nombre, programa, negocio, enlace, entrarConGoogle: linkApp('/login', null),
    });

    let anotado = false;
    if (inv.enviado) {
      try {
        await marcarInvitacion(leadId, correo, autor);
        anotado = true;
      } catch (e) {
        console.error('[curso] la invitación salió y no se pudo anotar:', e instanceof Error ? e.message : e);
      }
    }
    if (!p.lead.email) {
      try {
        const db = await getTenantDb();
        const { error } = await db.from('leads').update({ email: correo }).eq('id', leadId);
        if (error) throw new Error(error.message);
      } catch (e) {
        console.error('[curso] no pude guardar el email del cliente:', e instanceof Error ? e.message : e);
      }
    }
    const acceso = await accesoActual(leadId, ws).catch(() => null);
    return { ok: true, enviado: inv.enviado, acceso, aviso: avisoInvitacionCurso(inv, anotado) };
  } catch (e) {
    return mal(e, 'No se pudo invitar.');
  }
}

/** Corta su acceso: sube la versión y todos los links ya mandados dejan de abrir. */
export async function cortarAccesoCursoAction(leadId: number): Promise<{ ok: true; acceso: AccesoFicha } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    await revocarAcceso(leadId);
    const acceso = await accesoActual(leadId, await getWorkspaceActual());
    // Lo que QUEDÓ: si la fila no existía (nunca se le dio), revocar no hace nada y se dice.
    if (!acceso.revocado) return { ok: false, error: 'No tenía acceso para cortar.' };
    return { ok: true, acceso };
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
      if (!(await productosDelAlumno(leadId)).includes(productoId)) return { ok: false, error: 'Ese producto no es suyo.' };
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
