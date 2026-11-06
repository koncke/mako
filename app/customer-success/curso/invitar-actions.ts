'use server';

// =============================================================================
// invitar-actions — invitar alumnos DESDE EL EDITOR del curso
// =============================================================================
// Pedido de Martín (07/10/2026, item 9): «También en la vista de editor de curso debería poder
// invitar a alguien. Ya sea seleccionándolo de la lista de clientes que aún no estén invitados o
// invitándolo de 0, en ese caso, me debe pedir más datos para también agregarlo como cliente al
// kanban». Las dos puertas de ./InvitarAlumnos.tsx:
//
//   · `invitarClientesAction` — VARIOS clientes que ya existen, cada uno con su email.
//   · `invitarNuevoAlumnoAction` — alguien de CERO: se crea como cliente GANADO (la misma
//     alta de la cartera, `crearClienteGanado`), entra al kanban del producto
//     en su PRIMERA etapa y se lo invita. Si se parece a un lead que ya existe, NO falla: devuelve
//     ese lead para que la pantalla ofrezca usarlo.
//
// ⚠️ LA INVITACIÓN NO SE ESCRIBE ACÁ: es `invitarAlCurso` (lib/curso-invitar.ts), la MISMA que usan
// la ficha, la tarjeta del kanban y el CRM. Acá sólo hay puerta y orquestación.
//
// ⚠️ SIN SESIÓN DE «REENVIAR»: estas dos invitan a quien NO estaba invitado (`reenviar: false`), así
// que son idempotentes — un doble clic, o alguien invitado en otra pestaña entre que se abrió la
// lista y se apretó, contesta «Ya está invitado.» y no manda un segundo mail.
//
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md: un `export const` tipa
// perfecto y tira el build). Los tipos de lo que devuelven van inline; los helpers, sin exportar.
//
// ⚠️ LA PRIMERA LÍNEA DE CADA EXPORT ES LA PUERTA (`puedeUsarCs`, ../puerta.ts): una server action
// es un POST que no pasa por `requireCapa`. Lo fija tests/curso-invitar.test.ts.
//
// ── A UN CURSO (puntos 6 y 7 del audio del 08/10/2026 a la noche) ─────────────────────────────────
// Toda invitación de acá lleva el PRODUCTO desde el que se invita (`productoId`): el mail nombra sólo
// ese curso y el acceso del alumno pasa a abrir sólo ése (lib/curso-invitar.ts, «A UN CURSO, NO A
// TODOS»). La tercera puerta, `invitarAlCursoDelProductoAction`, es la del modal de UN cliente
// (./InvitarAlCurso.tsx) cuando quien lo monta sabe el producto: la tarjeta del kanban, la tabla Avance.
//
// ⚠️ «¿ES CLIENTE DE ESTE PRODUCTO?» ES LA REGLA DEL KANBAN (`productosDelCliente`, ../entrega.ts), NO
// `productosDelAlumno`: desde la mig 0232 ésa contesta qué cursos VE el alumno, y a alguien que todavía
// no está invitado a este producto le diría que no es suyo.
//
// ⚠️ SI EL CORREO NO SALIÓ POR CONFIGURACIÓN, LA RESPUESTA DICE DE QUIÉN (`correo`: 'tuyo' | 'mako',
// `correoQueFallo`, lib/curso-invitar-reglas.ts), y el modal ofrece configurar el correo AHÍ MISMO
// (punto 10). Un error de red o del proveedor no es de configuración: `null`, y se reintenta.

import { revalidatePath } from 'next/cache';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { emailNormalizado, emailUtilizable } from '@/lib/agencia-altas';
import { invitarAlCurso, TEXTO_NO_INVITA, type IntentoInvitar } from '@/lib/curso-invitar';
import {
  accesoParaPantalla, productosDeAccesos, accesoDe, revocarAcceso, reactivarAcceso, permisoAManoDe, aManoDeVarios,
  type AccesoParaPantalla,
} from '@/lib/curso-datos';
import { accesosDeClientes, type AccesoFilaInvitacion } from '@/lib/curso-admin';
import { puedeUsarCs } from '../puerta';
import { darDeAltaAlumno } from '@/lib/curso-alta-alumno';
import { frenarAltaPorTope, TopeDelPlanError } from '@/lib/topes-crm';
import { avisoInvitacionCurso, type AvisoInvitacionCurso } from '../curso-ficha-lectura';
import { canalesDeInvitacion, fraseWhatsapp, tieneTelefono } from '@/lib/curso-invitar-canales';
import { correoQueFallo, estadoEnBuscador, type CorreoQueFallo } from '@/lib/curso-invitar-reglas';

/** Tope de una tanda: la lista del editor no tiene más clientes que esto, y cada uno es un mail. */
const TOPE_TANDA = 50;

/** Quién firma: el email de quien está logueado, como en el CRM. Sin sesión con email, 'CRM'. */
async function autorActual(): Promise<string> {
  try {
    return (await getUsuarioActual())?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

/**
 * El resultado de UN intento, en una frase para su fila. `enviado` sale de `enviado`, nunca de que haya
 * resultado. Con «También por WhatsApp» (item 21 del 08/10/2026) la frase suma lo que pasó con el
 * WhatsApp, corto (`fraseWhatsapp`, lib/curso-invitar-canales.ts): el correo puede salir y el WhatsApp no.
 */
function fraseDe(r: IntentoInvitar): { enviado: boolean; texto: string; correo: CorreoQueFallo } {
  if (r.tipo === 'error') return { enviado: false, texto: r.error, correo: null };
  if (r.tipo === 'no') return { enviado: false, texto: TEXTO_NO_INVITA[r.motivo], correo: null };
  const base = avisoInvitacionCurso({ enviado: r.enviado, error: r.fallo ?? undefined }, r.anotado).texto;
  return {
    enviado: r.enviado,
    texto: r.enviado && r.whatsapp ? `${base} ${fraseWhatsapp(r.whatsapp)}` : base,
    correo: r.enviado ? null : correoQueFallo({ error: r.fallo, via: r.via }),
  };
}

/** El producto que llega del navegador: un entero positivo o nada. Que sea de este negocio lo mira el núcleo. */
const productoDe = (x: unknown): number | null => {
  const n = Number(x);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Con «También por WhatsApp», a lo sumo esta cantidad por tanda: cada uno retiene el envío unos segundos («escribiendo…») y una ráfaga es lo que hace que bloqueen la línea. */
const TOPE_TANDA_WHATSAPP = 10;

/**
 * Invita a VARIOS clientes que ya existen (la lista «Clientes sin invitar» del editor), cada uno con
 * el email que se ve en su fila (prellenado del CRM y editable). Devuelve un resultado POR CLIENTE:
 * una tanda puede salir a medias, y la pantalla tiene que decir cuál sí y cuál no.
 *
 * Uno por uno y en serie, no en paralelo: son mails de la plataforma por Resend, y una ráfaga de
 * cincuenta a la vez es la forma de que el proveedor empiece a contestar que no.
 */
export async function invitarClientesAction(items: Array<{ leadId: number; email: string }>, opts?: { canales?: string[]; productoId?: number }): Promise<
  | { ok: true; resultados: Array<{ leadId: number; enviado: boolean; texto: string; correo: CorreoQueFallo }>; correo: CorreoQueFallo }
  | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!Array.isArray(items) || !items.length) return { ok: false, error: 'No elegiste a nadie.' };
    if (items.length > TOPE_TANDA) return { ok: false, error: `Hasta ${TOPE_TANDA} por vez.` };
    // El curso al que se los invita (el del editor). Sin él no se invita: sería abrirles todos.
    const productoId = productoDe(opts?.productoId);
    if (productoId == null) return { ok: false, error: 'Falta el producto.' };
    // Saneados en el server: lo que manda el navegador es una propuesta (`canalesDeInvitacion`).
    const canales = canalesDeInvitacion(opts?.canales);
    if (canales.includes('whatsapp') && items.length > TOPE_TANDA_WHATSAPP) {
      return { ok: false, error: `Con WhatsApp, hasta ${TOPE_TANDA_WHATSAPP} por vez.` };
    }
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };
    const autor = await autorActual();
    const resultados: Array<{ leadId: number; enviado: boolean; texto: string; correo: CorreoQueFallo }> = [];
    const vistos = new Set<number>();
    for (const it of items) {
      const leadId = Number(it?.leadId);
      if (!Number.isInteger(leadId) || leadId <= 0 || vistos.has(leadId)) continue;
      vistos.add(leadId);
      const correo = emailNormalizado(typeof it.email === 'string' ? it.email : '');
      if (!emailUtilizable(correo)) { resultados.push({ leadId, enviado: false, texto: 'Ese email no sirve.', correo: null }); continue; }
      const r = await invitarAlCurso({ ws, leadId, email: correo, autor, reenviar: false, canales, productoId });
      resultados.push({ leadId, ...fraseDe(r) });
      // ⚠️ SI EL CORREO NO ESTÁ CONFIGURADO, NO SE SIGUE: los demás van a fallar igual, y cada intento es
      // una fila de «No salió» que no dice nada nuevo. Se dice una vez y se ofrece configurarlo.
      if (resultados[resultados.length - 1].correo) break;
    }
    if (resultados.some((x) => x.enviado)) revalidatePath('/classroom/clients');
    return { ok: true, resultados, correo: resultados.find((x) => x.correo)?.correo ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo invitar.' };
  }
}

/**
 * Invita a alguien DE CERO: lo crea como cliente ganado, lo pone en el kanban del producto en su
 * primera etapa y lo invita. «Me debe pedir más datos para también agregarlo como cliente al kanban».
 *
 * En orden, y el orden importa:
 *   1. la puerta; el producto tiene que tener clases (sin curso no hay a qué invitar, y crear un
 *      cliente para nada es un lead de más en el CRM); nombre y EMAIL obligatorios (es una
 *      invitación por mail: a diferencia del alta de la cartera, el teléfono solo no alcanza). ⚠️ EL
 *      TELÉFONO ES OPCIONAL (punto 11 del audio del 08/10/2026 a la noche: «esto lo puedo pasar porque
 *      por ahí no lo tengo»): sin él la invitación sale igual por mail; lo que se pierde es «También
 *      por WhatsApp» y todo lo que el negocio le mande por WhatsApp después (recordatorios, avisos);
 *   2. el cliente: `usarLeadId` = uno que ya existe (lo eligió la persona después del aviso de
 *      duplicado; si no era ganado, se lo marca — el botón lo dijo); si no, `crearClienteGanado`,
 *      que es la MISMA alta de la cartera, con su chequeo de duplicados. Si choca, NO se crea nada
 *      y vuelve con quién choca;
 *   3. el kanban: si el producto no es su casa ni tiene fila ahí, se lo mete en la PRIMERA etapa
 *      (`moverClienteDeEtapa` con `etapa: null`, el choke point de siempre). Un cliente nuevo nace en
 *      el embudo principal: sin esto, invitado desde el curso de OTRO producto no aparecería en ese
 *      kanban — ni la invitación lo encontraría cliente de ese producto (`productosDelCliente`). Y al
 *      revés: si ESTA action lo hizo cliente, se lo saca de los OTROS (su casa del embudo principal):
 *      no compró ese programa, y el kanban de ese producto no tiene por qué mostrarlo;
 *   4. la invitación (`invitarAlCurso`), a ESTE producto: el mail nombra sólo este curso y su acceso
 *      abre sólo éste. Si el mail no sale, el cliente YA quedó creado y se dice: reintentar el alta
 *      chocaría con su propio duplicado.
 *
 * Desde el 23/10/2026 los cuatro pasos viven en lib/curso-alta-alumno.ts (`darDeAltaAlumno`), que usa
 * también la API de MaKo; esta action pone la puerta, el texto de la pantalla y los `revalidatePath`.
 */
export async function invitarNuevoAlumnoAction(datos: {
  productoId: number;
  nombre: string;
  email: string;
  telefono?: string;
  empresa?: string;
  sinCobro?: boolean;
  /** Usar ESTE lead (el del aviso de duplicado) en vez de crear uno. */
  usarLeadId?: number | null;
  /** Crearlo aunque se parezca a otro: lo eligió la persona después del aviso. */
  crearIgual?: boolean;
  /** «También por WhatsApp» (item 21 del 08/10/2026): `['email', 'whatsapp']`. Default, sólo correo. */
  canales?: string[];
}): Promise<
  | { ok: true; leadId: number; enviado: boolean; texto: string; correo: CorreoQueFallo }
  | { ok: false; error: string; duplicados?: Array<{ leadId: number; nombre: string; texto: string; ganado: boolean }> }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };
    // El tope de leads del plan cuando el alumno se CREA (no al usar uno que ya existe), como crear_alumno_curso de la API.
    // ⚠️ Con la MISMA condición con que lib/curso-alta-alumno.ts decide reusar: un `usarLeadId: 0` crea, y frena.
    const reusa = Number.isInteger(datos.usarLeadId) && Number(datos.usarLeadId) > 0;
    if (!reusa) {
      try { await frenarAltaPorTope(ws, 'crm.leads'); } catch (e) { if (e instanceof TopeDelPlanError) return { ok: false, error: e.message }; throw e; }
    }
    // El alta, el kanban, «sólo de este producto» y la invitación viven en lib/curso-alta-alumno.ts desde el
    // 23/10/2026: los usa también la API de MaKo (crear_alumno_curso). Acá queda lo de la pantalla.
    const a = await darDeAltaAlumno({
      ws, productoId: Number(datos?.productoId), nombre: datos.nombre, email: datos.email,
      telefono: datos.telefono, empresa: datos.empresa, sinCobro: datos.sinCobro === true,
      usarLeadId: datos.usarLeadId, crearIgual: datos.crearIgual === true,
      canales: canalesDeInvitacion(datos.canales), autor: await autorActual(),
    });
    if (!a.ok) return a.duplicados?.length ? { ok: false, error: a.error, duplicados: await conEstado(a.duplicados) } : { ok: false, error: a.error };
    // ⚠️ DESPUÉS DEL ALTA NADA TIRA HACIA AFUERA COMO «NO SE PUDO»: el cliente ya existe, y un error
    // genérico haría que alguien lo cargue de nuevo. Lo que falla se dice en el texto.
    const r = !a.enKanban
      // Sin el producto, su portal no le abriría este curso: invitarlo sería mandarle un link a otra cosa.
      ? { enviado: false, texto: 'Se cargó, pero no entró al kanban. Muévelo ahí e invítalo desde su ficha.', correo: null }
      : !a.soloAca || !a.invitacion
        ? { enviado: false, texto: 'Se cargó, pero quedó en otro producto. Sácalo de ahí e invítalo desde su ficha.', correo: null }
        : fraseDe(a.invitacion);
    revalidatePath('/classroom/clients');
    revalidatePath('/classroom');
    revalidatePath('/crm');
    return { ok: true, leadId: a.leadId, ...r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo invitar.' };
  }
}

/**
 * Invita (o le reenvía la invitación) a UN cliente al curso de UN producto: la del modal de un cliente
 * (./InvitarAlCurso.tsx) cuando quien lo monta sabe desde qué producto se invita — la tarjeta del kanban
 * de ese producto, la tabla Avance de ese curso. Es `invitarAlCursoAction` (../curso-ficha-actions.ts)
 * con el producto: el mail nombra sólo ese curso y el acceso pasa a abrir ése (puntos 6 y 7 del audio del
 * 08/10/2026 a la noche).
 *
 * `reenviar: true`, como la de la ficha: «Invitar» / «Reenviar invitación» los aprieta una persona, así
 * que no corta por «ya invitado» y no reclama. Devuelve el acceso RELEÍDO con la forma de la ficha
 * (`accesoParaPantalla`, lib/curso-datos.ts) para que quien lo abrió pinte «Invitado» sin recargar, y
 * `correo` cuando no salió por configuración (el modal ofrece configurarlo ahí mismo, punto 10).
 */
export async function invitarAlCursoDelProductoAction(leadId: number, productoId: number, email: string): Promise<
  | { ok: true; enviado: boolean; acceso: AccesoParaPantalla | null; aviso: AvisoInvitacionCurso; correo: CorreoQueFallo }
  | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const id = Number(leadId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Ese cliente no existe.' };
    const producto = productoDe(productoId);
    if (producto == null) return { ok: false, error: 'Falta el producto.' };
    const correo = emailNormalizado(typeof email === 'string' ? email : '');
    if (!emailUtilizable(correo)) return { ok: false, error: 'Ese email no sirve.' };
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };

    // El núcleo mira lo demás: la capa, que el lead sea un ganado de ESTE workspace, cortado gana, y que
    // sea cliente de ESE producto (la regla del kanban).
    const r = await invitarAlCurso({ ws, leadId: id, email: correo, autor: await autorActual(), reenviar: true, productoId: producto });
    if (r.tipo === 'error') return { ok: false, error: r.error };
    if (r.tipo === 'no') return { ok: false, error: TEXTO_NO_INVITA[r.motivo] };
    // Sin `revalidatePath`, como la de la ficha: quien abrió el modal pinta el acceso que vuelve, y
    // resembrar la pantalla de atrás (el kanban, la ficha) pisaría lo que tiene en estado.
    const acceso = await accesoParaPantalla(id, ws).catch(() => null);
    return {
      ok: true, enviado: r.enviado, acceso,
      aviso: avisoInvitacionCurso({ enviado: r.enviado, error: r.fallo ?? undefined }, r.anotado),
      correo: r.enviado ? null : correoQueFallo({ error: r.fallo, via: r.via }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo invitar.' };
  }
}

/**
 * Lo que el modal necesita para ofrecer «También por WhatsApp» (item 21 del audio del 08/10/2026): si la
 * línea de por default del negocio está CONECTADA, si el envío de WhatsApp está PRENDIDO, y cuáles de
 * estos clientes tienen teléfono en el CRM. Lo decide `ofreceWhatsapp` (lib/curso-invitar-canales.ts).
 *
 * ⚠️ LA MISMA LÍNEA POR LA QUE SALE: `getInstanciaRow()` sin `linea` es la de por default
 *    (`lineaPorDefault`), y el envío (`enviarYEspejar` sin `linea`) elige la misma (`elegirLinea`). Con
 *    dos preguntas distintas, la casilla se ofrecería por una línea y el mensaje saldría por otra.
 * ⚠️ «NO PUDE LEER» NO OFRECE NADA: sin la línea o sin el interruptor, la casilla no se dibuja (el
 *    correo sale igual). Una casilla ofrecida sobre una lectura caída promete un mensaje que no sale.
 */
export async function opcionesDeInvitarAction(leadIds: number[]): Promise<
  { ok: true; lineaConectada: boolean; envioPrendido: boolean; conTelefono: number[] } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const ids = [...new Set((Array.isArray(leadIds) ? leadIds : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 1000);
    const [{ getInstanciaRow }, { envioWhatsappHabilitado }] = await Promise.all([import('@/lib/evolution'), import('@/lib/envio-flags')]);
    const [linea, envioPrendido] = await Promise.all([getInstanciaRow(), envioWhatsappHabilitado()]);
    const conTelefono: number[] = [];
    if (ids.length) {
      const db = await getTenantDb();
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await db.from('leads').select('id, telefono').in('id', ids.slice(i, i + 200));
        if (error) throw new Error(error.message);
        for (const f of (data ?? []) as Array<{ id: number; telefono: string | null }>) {
          if (tieneTelefono(f.telefono)) conTelefono.push(Number(f.id));
        }
      }
    }
    return { ok: true, lineaConectada: linea?.estado === 'conectado', envioPrendido, conTelefono };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer el WhatsApp.' };
  }
}

/**
 * Qué cursos abre el acceso de cada uno de estos clientes (mig 0232): lead → lista (`null` = todos; el
 * lead sin acceso no viene). Lo pide el modal del editor al abrirse, para que «Clientes sin invitar»
 * ofrezca a quien está invitado a OTRO curso del negocio y no a éste (`accesoEnProducto`).
 *
 * ⚠️ «NO PUDE LEER» NO CAMBIA LA LISTA: si falla, la lista queda como la arma la página (todo invitado
 * cuenta como invitado), que es de menos y nunca un segundo mail a ciegas.
 */
export async function productosDeLosAccesosAction(leadIds: number[]): Promise<
  { ok: true; productos: Record<number, number[] | null> } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const ids = [...new Set((Array.isArray(leadIds) ? leadIds : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 1000);
    if (!ids.length) return { ok: true, productos: {} };
    return { ok: true, productos: Object.fromEntries(await productosDeAccesos(ids)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer los accesos.' };
  }
}

/** Los duplicados con su estado: «usar ese» dice distinto si ya es cliente o hay que marcarlo. */
async function conEstado(dups: Array<{ leadId: number; nombre: string; texto: string }>): Promise<Array<{ leadId: number; nombre: string; texto: string; ganado: boolean }>> {
  const ids = [...new Set(dups.map((d) => d.leadId))].slice(0, 5);
  let ganados = new Set<number>();
  try {
    const db = await getTenantDb();
    const { data } = await db.from('leads').select('id, estado_lead').in('id', ids);
    ganados = new Set(((data ?? []) as Array<{ id: number; estado_lead: string | null }>).filter((f) => f.estado_lead === 'ganado').map((f) => Number(f.id)));
  } catch { /* sin el estado, el botón dice «Usar»: lo que hace lo vuelve a decidir el server */ }
  // UNO por lead: el mismo puede chocar por email Y por teléfono, y dos botones «Usar» iguales confunden.
  return ids.map((id) => dups.find((d) => d.leadId === id)!).map((d) => ({ ...d, ganado: ganados.has(d.leadId) }));
}

// ── El BUSCADOR de leads, para invitar a alguien que todavía no compró ─────────────────────────────
//
// Pedido de Martín (13/10/2026), textual: «Incluir un buscador de leads en la ventana de invitación a
// cursos que permita seleccionar contactos en cualquier etapa del embudo y no solo los ganados»
// (Fathom 858545195 @91:40).
//
// Hasta acá, invitar al curso exigía DOS cosas —estar en Ganado y ser cliente de ESE producto— y las
// dos las mira `invitarAlCurso`. Las levanta `cualquierEtapa: true`, que SÓLO pone este camino: el
// automático (`crm-curso-al-ganar`, que se dispara al pasar a Ganado) nunca lo manda, porque ahí la
// precondición ES haber ganado. El porqué del reparto está en lib/curso-invitar.ts.
//
// ⚠️ LA CARTERA NO VIAJA AL NAVEGADOR. Se busca en el SERVER y vuelven ~20 filas compactas, con el
//    MISMO criterio que el tablero y el CRM del teléfono (`buscarEnCartera`, app/m/crm/reglas.ts: sin
//    acentos, términos en cualquier orden, «#412» por id, dígitos por id y después por teléfono). Un
//    segundo criterio de búsqueda es un segundo lugar que se queda viejo — y acá el de al lado ya
//    estaba escrito y probado.

/**
 * Busca leads para invitar, en CUALQUIER etapa del embudo. Devuelve lo justo para elegir uno:
 * quién es, cómo distinguirlo de un homónimo, su email del CRM, y en qué estado está con ESE curso.
 *
 * ⚠️ EL `estado` NO ES DECORACIÓN: sin él, el único modo de enterarse de que alguien ya estaba
 *    invitado es apretar y leer «Ya está invitado.» — y con un buscador abierto sobre la cartera
 *    entera eso pasa todo el tiempo. La fila lo dice antes. Desde la mig 0331 son cuatro
 *    (`estadoEnBuscador`): invitar, invitado, dado a mano (se puede cortar) y cortado (se puede volver
 *    a habilitar si fue a mano). Un invitado SIN Ganado ni permiso vuelve a «invitar»: su link no abría.
 *
 * ⚠️ Y NO FILTRA a los ya invitados hacia afuera: buscar a alguien y que no aparezca es
 *    indistinguible de «no existe», y manda a crearlo de nuevo.
 */
export async function buscarLeadsParaInvitarAction(q: string, productoId: number): Promise<
  | {
      ok: true; hayMas: boolean;
      filas: Array<{ id: number; nombre: string; segunda: string | null; email: string | null; estado: 'invitar' | 'invitado' | 'dado-a-mano' | 'cortado'; conPermiso: boolean }>;
    }
  | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const producto = Number(productoId);
    if (!Number.isInteger(producto) || producto <= 0) return { ok: false, error: 'Falta el producto.' };
    const texto = typeof q === 'string' ? q : '';

    const { buscarEnCartera } = await import('@/app/m/crm/reglas');
    const { listLeads } = await import('@/lib/leads');
    const leads = await listLeads();
    const { filas, hayMas } = buscarEnCartera(
      leads.map((l) => ({ id: l.id, nombre: l.nombre, empresa: l.empresa, email: l.email, telefono: l.telefono })),
      texto,
    );
    if (!filas.length) return { ok: true, filas: [], hayMas };

    // El email y el «ya invitado» SÓLO de las ~20 que vuelven: preguntar por la cartera entera sería
    // leer miles de accesos para dibujar veinte renglones.
    const porId = new Map(leads.map((l) => [Number(l.id), l]));
    // Las dos con su `.catch`: sin ellas la fila queda en «invitar», y el núcleo vuelve a decidir al apretar.
    const ids = filas.map((f) => f.id);
    const [accesos, manos] = await Promise.all([
      accesosDeClientes(ids).catch(() => new Map<number, AccesoFilaInvitacion>()),
      aManoDeVarios(ids).catch(() => new Map<number, number[]>()),
    ]);
    return {
      ok: true,
      hayMas,
      filas: filas.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        segunda: f.segunda,
        email: (porId.get(f.id)?.email ?? '').trim() || null,
        estado: estadoEnBuscador({
          acceso: (() => { const a = accesos.get(f.id); return a ? { cortado: a.estado === 'cortado', productos: a.productos, invitacionEnviadaAt: a.invitacionEnviadaAt } : null; })(),
          aMano: manos.get(f.id) ?? [], productoId: producto, ganado: porId.get(f.id)?.estado_lead === 'ganado',
        }),
        conPermiso: (manos.get(f.id) ?? []).length > 0,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo buscar.' };
  }
}

/**
 * Invita a ESE curso a un lead elegido en el buscador, esté en la etapa que esté.
 *
 * ⚠️ NO LO HACE CLIENTE NI LO MUEVE EN EL KANBAN, a propósito. `invitarNuevoAlumnoAction` sí lo hace
 *    —porque ahí se está dando de alta a alguien que no existe—, pero mover de etapa a un lead que YA
 *    está en el embudo es cambiarle la venta a alguien por haberle dado acceso a un curso, y eso lo
 *    decide el CRM. Acá sólo se le abre el curso, con un permiso a mano (mig 0331) cuando hace falta:
 *    sin él, el link del mail de alguien que no está en Ganado no abría.
 *
 * ⚠️ `reenviar: false`: es idempotente. Un doble clic, o alguien invitado en otra pestaña entre que
 *    se buscó y se apretó, contesta «Ya está invitado.» y no manda un segundo mail.
 */
export async function invitarLeadDeCualquierEtapaAction(leadId: number, productoId: number, email: string): Promise<
  | { ok: true; enviado: boolean; acceso: AccesoParaPantalla | null; aviso: AvisoInvitacionCurso; correo: CorreoQueFallo }
  | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const id = Number(leadId);
    const producto = Number(productoId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Ese lead no existe.' };
    if (!Number.isInteger(producto) || producto <= 0) return { ok: false, error: 'Falta el producto.' };
    const correo = emailNormalizado(typeof email === 'string' ? email : '');
    if (!emailUtilizable(correo)) return { ok: false, error: 'Ese email no sirve.' };
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };

    const r = await invitarAlCurso({
      ws, leadId: id, email: correo, autor: await autorActual(), reenviar: false,
      productoId: producto, cualquierEtapa: true,
    });
    if (r.tipo === 'error') return { ok: false, error: r.error };
    if (r.tipo === 'no') return { ok: false, error: TEXTO_NO_INVITA[r.motivo] };
    const acceso = await accesoParaPantalla(id, ws).catch(() => null);
    return {
      ok: true, enviado: r.enviado, acceso,
      aviso: avisoInvitacionCurso({ enviado: r.enviado, error: r.fallo ?? undefined }, r.anotado),
      correo: r.enviado ? null : correoQueFallo({ error: r.fallo, via: r.via }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo invitar.' };
  }
}

/**
 * Corta el acceso de alguien a quien se le abrió el curso a mano desde el buscador (mig 0331). Decisión del Cerebro
 * (23/10/2026): ese permiso NO lo corta pasar a Perdido ni un reembolso —lo dio una persona y no lo deshace otro
 * evento—, así que se corta acá, a mano. Es el mismo corte de la ficha (`revocarAcceso`: versión + 1 y revocado,
 * también sus líderes), y se relee para no decir «cortado» sobre algo que sigue abierto.
 */
export async function cortarAccesoDadoAManoAction(leadId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const id = Number(leadId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Ese lead no existe.' };
    const antes = await accesoDe(id);
    if (!antes) return { ok: false, error: 'No tenía acceso para cortar.' };
    if (!antes.revocado) await revocarAcceso(id);
    const despues = await accesoDe(id);
    if (!despues?.revocado) return { ok: false, error: 'Sigue abierto.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo cortar.' };
  }
}

/**
 * Vuelve a habilitar, desde el buscador, el acceso que se había dado a mano (mig 0331). Sólo si tiene algo a mano: un
 * acceso de la venta se habilita desde su ficha, que es donde se ve todo lo demás. El link es NUEVO (la versión subió
 * al cortar), así que vuelve para copiarlo.
 */
export async function habilitarAccesoDadoAManoAction(leadId: number): Promise<
  | { ok: true; acceso: AccesoParaPantalla }
  | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const id = Number(leadId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Ese lead no existe.' };
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };
    const permiso = await permisoAManoDe(id);
    if (!permiso?.aMano.length) return { ok: false, error: 'Habilítalo desde su ficha.' };
    await reactivarAcceso(id);
    const acceso = await accesoParaPantalla(id, ws);
    if (acceso.revocado) return { ok: false, error: 'Sigue cortado.' };
    return { ok: true, acceso };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo habilitar.' };
  }
}
