'use server';

// =============================================================================
// curso-ficha-actions — la pestaña «Curso» de la ficha de un cliente
// =============================================================================
// Pedido de Martín (06/10/2026): «Dentro del Detail de los clientes de Mauricio se tiene que
// ver este CURSO». Lo que se ve (y se hace) acá: su avance clase por clase, lo que contestó,
// marcar una tarea revisada, su link personal al portal y las llamadas de la entrega.
//
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC. Un `export const` o un
// `export type` con valor tipan perfecto y TIRAN EL BUILD (AGENTS.md). Los tipos de lo que
// devuelven viven en ./curso-ficha-lectura.ts; los helpers de acá abajo van sin exportar.
//
// ⚠️ NINGUNA CONSULTA PROPIA SALVO LA PUERTA: todo pasa por lib/curso-datos.ts (la capa de datos
// del curso, que también usan la tab Curso, el portal y el cron). Una segunda forma de leer el
// avance o de revocar un acceso es la copia que diverge.
//
// ⚠️ LA PUERTA SE PREGUNTA EN CADA ACTION, no al abrir la pestaña: una server action es un POST
// que cualquiera puede mandar con cualquier `leadId`. Las tres preguntas son las de la página y
// las de ./actions.ts: hay sesión contra la base, el workspace tiene Customer Success en su capa
// (`requireCapa('customer-success')` de page.tsx, sin el redirect: acá se contesta), y el lead
// es un cliente GANADO de ESTE workspace (`clienteDelWorkspace` de ./actions.ts). Fail-closed.

import { getTenantDb, getWorkspaceActual, getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { getUsuarioActual } from '@/lib/auth';
import { listProductos } from '@/lib/productos';
import { entregasDeProductos } from '@/lib/entrega-servicio';
import {
  clasesDelProducto, claseDeId, progresoDelCliente, accesoDe, linkDeAcceso, revocarAcceso, reactivarAcceso,
  sesionesDe, agendarSesion, borrarSesion, aprobarTarea, productosDelAlumno, etapaActualDe, type Sesion,
} from '@/lib/curso-datos';
import { mandarLinkDelCurso } from '@/lib/curso-mensajes';
import type { EstadoTarea } from '@/lib/curso';
import { armarProducto, type AccesoFicha, type CursoDeCliente, type ProductoFicha } from './curso-ficha-lectura';

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

/**
 * La puerta de todas las actions de acá. Ver la cabecera.
 *
 * ⚠️ «NO PUDE VERIFICAR» NO ES «ES TUYO»: si la lectura del lead falla, se corta. Un error de la
 * consulta tratado como un vacío dejaría pasar, y uno tratado como «no es tuyo» mentiría: se
 * dice lo que pasó.
 */
async function puerta(leadId: number): Promise<{ ok: true } | Fallo> {
  if (!Number.isInteger(leadId) || leadId <= 0) return { ok: false, error: 'Ese cliente no existe.' };
  if ((await getRolWsEfectivo()) == null) return { ok: false, error: 'Tu sesión venció. Vuelve a entrar.' };
  if (!tabEnCapa('customer-success', await getCapaActual())) return { ok: false, error: 'Esta cuenta no tiene Customer Success.' };
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id').eq('id', leadId).eq('estado_lead', 'ganado').maybeSingle();
  if (error) return { ok: false, error: `No pude verificar el cliente: ${error.message}` };
  if (!data) return { ok: false, error: 'Ese cliente no es de este workspace.' };
  return { ok: true };
}

/** El estado de su acceso tal cual lo ve la ficha, leído DESPUÉS de lo que se haya hecho. */
async function accesoActual(leadId: number, link: string | null): Promise<AccesoFicha> {
  const a = await accesoDe(leadId);
  return { link, revocado: a?.revocado ?? false, ingresos: a?.ingresos ?? 0, ultimoIngresoAt: a?.ultimoIngresoAt ?? null };
}

/**
 * Sus productos CON CLASES, armados por etapa y con la actual marcada.
 *
 * ⚠️ LOS PRODUCTOS SON LOS DEL ALUMNO (`productosDelAlumno`), la MISMA regla que el kanban y que
 * el portal: la ficha no puede mostrar un curso que el link del cliente no le abre, ni al revés.
 *
 * ⚠️ `etapaActualDe` SÓLO PARA LOS QUE TIENEN CLASES. Cada llamada vuelve a resolver los productos
 * del alumno (es su contrato: no se edita lib/curso-datos.ts), así que pedirla para un producto
 * sin curso es pagar esa lectura para no dibujar nada.
 */
async function productosConCurso(leadId: number): Promise<ProductoFicha[]> {
  const ids = await productosDelAlumno(leadId);
  if (!ids.length) return [];
  const [catalogo, entregas, progreso, clases] = await Promise.all([
    listProductos(false),
    entregasDeProductos(ids),
    progresoDelCliente(leadId),
    Promise.all(ids.map(async (id) => [id, await clasesDelProducto(id)] as const)),
  ]);
  const nombre = new Map(catalogo.map((p) => [Number(p.id), p.nombre]));
  const conClases = clases.filter(([, cs]) => cs.length > 0);
  const actuales = await Promise.all(conClases.map(([id]) => etapaActualDe(leadId, id)));
  const out: ProductoFicha[] = [];
  conClases.forEach(([id, cs], i) => {
    const p = armarProducto({
      productoId: id,
      nombre: nombre.get(id) ?? 'Producto',
      etapas: entregas.get(id)?.etapas ?? [],
      clases: cs,
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
 * ⚠️ ARMAR EL LINK ESCRIBE: `linkDeAcceso` le crea su fila de acceso si no tenía (versión 1,
 * habilitado). Es idempotente y es lo que el link necesita para abrir (`resolverAcceso` exige la
 * fila), así que pedir «muéstrame su link» y que el link no abra sería peor. Sólo pasa si tiene
 * CURSO: sin clases no se le arma un link a un portal vacío.
 */
export async function cursoDeClienteAction(leadId: number): Promise<{ ok: true; curso: CursoDeCliente } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const curso: CursoDeCliente = { productos: null, acceso: null, sesiones: null };

    const [productos, sesiones] = await Promise.allSettled([productosConCurso(leadId), sesionesDe(leadId)]);
    if (productos.status === 'fulfilled') curso.productos = productos.value;
    else curso.errorProductos = productos.reason instanceof Error ? productos.reason.message : 'No pude leer sus clases.';
    if (sesiones.status === 'fulfilled') curso.sesiones = sesiones.value;
    else curso.errorSesiones = sesiones.reason instanceof Error ? sesiones.reason.message : 'No pude leer sus llamadas.';

    if (curso.productos?.length) {
      try {
        const ws = await getWorkspaceActual();
        if (!ws) throw new Error('No sé en qué cuenta estás.');
        curso.acceso = await accesoActual(leadId, await linkDeAcceso(leadId, ws, await autorActual()));
      } catch (e) {
        curso.errorAcceso = e instanceof Error ? e.message : 'No pude leer su acceso.';
      }
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
 * Le manda su link por WhatsApp. El cuerpo del envío NO vive acá: es el contrato de
 * lib/curso-mensajes.ts (`mandarLinkDelCurso`), y su motivo vuelve tal cual si no salió.
 */
export async function mandarLinkCursoAction(leadId: number): Promise<{ ok: true } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const r = await mandarLinkDelCurso(leadId, { porQuien: await autorActual() });
    return r.ok ? { ok: true } : { ok: false, error: r.motivo?.trim() || 'No se mandó.' };
  } catch (e) {
    return mal(e, 'No se mandó.');
  }
}

/** Corta su acceso: sube la versión y todos los links ya mandados dejan de abrir. */
export async function cortarAccesoCursoAction(leadId: number): Promise<{ ok: true; acceso: AccesoFicha } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    await revocarAcceso(leadId);
    const acceso = await accesoActual(leadId, null);
    // Lo que QUEDÓ: si la fila no existía (nunca se le dio), revocar no hace nada y se dice.
    if (!acceso.revocado) return { ok: false, error: 'No tenía acceso para cortar.' };
    return { ok: true, acceso };
  } catch (e) {
    return mal(e, 'No se pudo cortar.');
  }
}

/**
 * Lo vuelve a habilitar. El link es NUEVO: la versión subió al cortar, así que el viejo sigue
 * sin abrir — hay que mandarle éste.
 */
export async function habilitarAccesoCursoAction(leadId: number): Promise<{ ok: true; acceso: AccesoFicha } | Fallo> {
  try {
    const p = await puerta(leadId);
    if (!p.ok) return p;
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };
    await reactivarAcceso(leadId);
    const acceso = await accesoActual(leadId, await linkDeAcceso(leadId, ws, await autorActual()));
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
