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
//     `crearClienteAction` de la cartera: `createLead` + `updateLead`), entra al kanban del producto
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

import { revalidatePath } from 'next/cache';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { emailNormalizado, emailUtilizable } from '@/lib/agencia-altas';
import { invitarAlCurso, TEXTO_NO_INVITA, type IntentoInvitar } from '@/lib/curso-invitar';
import { clasesDelProducto, productosDelAlumno } from '@/lib/curso-datos';
import { moverClienteDeEtapa } from '@/lib/cs-mover-etapa';
import { updateLead } from '@/lib/leads';
import { puedeUsarCs } from '../puerta';
import { crearClienteAction, quitarDeProductoAction } from '../actions';
import { avisoInvitacionCurso } from '../curso-ficha-lectura';
import { canalesDeInvitacion, fraseWhatsapp, tieneTelefono } from '@/lib/curso-invitar-canales';

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
function fraseDe(r: IntentoInvitar): { enviado: boolean; texto: string } {
  if (r.tipo === 'error') return { enviado: false, texto: r.error };
  if (r.tipo === 'no') return { enviado: false, texto: TEXTO_NO_INVITA[r.motivo] };
  const base = avisoInvitacionCurso({ enviado: r.enviado, error: r.fallo ?? undefined }, r.anotado).texto;
  return { enviado: r.enviado, texto: r.enviado && r.whatsapp ? `${base} ${fraseWhatsapp(r.whatsapp)}` : base };
}

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
export async function invitarClientesAction(items: Array<{ leadId: number; email: string }>, opts?: { canales?: string[] }): Promise<
  { ok: true; resultados: Array<{ leadId: number; enviado: boolean; texto: string }> } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!Array.isArray(items) || !items.length) return { ok: false, error: 'No elegiste a nadie.' };
    if (items.length > TOPE_TANDA) return { ok: false, error: `Hasta ${TOPE_TANDA} por vez.` };
    // Saneados en el server: lo que manda el navegador es una propuesta (`canalesDeInvitacion`).
    const canales = canalesDeInvitacion(opts?.canales);
    if (canales.includes('whatsapp') && items.length > TOPE_TANDA_WHATSAPP) {
      return { ok: false, error: `Con WhatsApp, hasta ${TOPE_TANDA_WHATSAPP} por vez.` };
    }
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };
    const autor = await autorActual();
    const resultados: Array<{ leadId: number; enviado: boolean; texto: string }> = [];
    const vistos = new Set<number>();
    for (const it of items) {
      const leadId = Number(it?.leadId);
      if (!Number.isInteger(leadId) || leadId <= 0 || vistos.has(leadId)) continue;
      vistos.add(leadId);
      const correo = emailNormalizado(typeof it.email === 'string' ? it.email : '');
      if (!emailUtilizable(correo)) { resultados.push({ leadId, enviado: false, texto: 'Ese email no sirve.' }); continue; }
      const r = await invitarAlCurso({ ws, leadId, email: correo, autor, reenviar: false, canales });
      resultados.push({ leadId, ...fraseDe(r) });
    }
    if (resultados.some((x) => x.enviado)) revalidatePath('/customer-success');
    return { ok: true, resultados };
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
 *      invitación por mail: a diferencia del alta de la cartera, el teléfono solo no alcanza);
 *   2. el cliente: `usarLeadId` = uno que ya existe (lo eligió la persona después del aviso de
 *      duplicado; si no era ganado, se lo marca — el botón lo dijo); si no, `crearClienteAction`,
 *      que es la MISMA alta de la cartera, con su chequeo de duplicados. Si choca, NO se crea nada
 *      y vuelve con quién choca;
 *   3. el kanban: si el producto no es su casa ni tiene fila ahí, se lo mete en la PRIMERA etapa
 *      (`moverClienteDeEtapa` con `etapa: null`, el choke point de siempre). Un cliente nuevo nace en
 *      el embudo principal: sin esto, invitado desde el curso de OTRO producto no aparecería en ese
 *      kanban — ni su portal le abriría ese curso (`productosDelAlumno`). Y al revés: si ESTA action
 *      lo hizo cliente, se lo saca de los OTROS (su casa del embudo principal), o el mail le abriría
 *      también ese curso;
 *   4. la invitación (`invitarAlCurso`). Si el mail no sale, el cliente YA quedó creado y se dice:
 *      reintentar el alta chocaría con su propio duplicado.
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
  | { ok: true; leadId: number; enviado: boolean; texto: string }
  | { ok: false; error: string; duplicados?: Array<{ leadId: number; nombre: string; texto: string; ganado: boolean }> }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const productoId = Number(datos?.productoId);
    if (!Number.isInteger(productoId) || productoId <= 0) return { ok: false, error: 'Falta el producto.' };
    const nombre = (datos.nombre ?? '').trim();
    const correo = emailNormalizado(typeof datos.email === 'string' ? datos.email : '');
    if (!emailUtilizable(correo)) return { ok: false, error: 'Ese email no sirve.' };
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No sé en qué cuenta estás.' };
    // `clasesDelProducto` lee con el inquilino puesto: un producto de otro workspace da cero clases.
    if (!(await clasesDelProducto(productoId)).length) return { ok: false, error: 'Este producto todavía no tiene clases.' };
    const autor = await autorActual();

    let leadId: number;
    /** ¿Esta action lo hizo cliente? (lo creó, o lo pasó a ganado). Ver «SÓLO DE ESTE PRODUCTO» abajo. */
    let nuevoCliente = true;
    const usar = Number(datos.usarLeadId);
    if (Number.isInteger(usar) && usar > 0) {
      const db = await getTenantDb();
      const { data, error } = await db.from('leads').select('id, estado_lead').eq('id', usar).maybeSingle();
      if (error) return { ok: false, error: `No pude verificar el cliente: ${error.message}` };
      if (!data) return { ok: false, error: 'Ese cliente no es de este workspace.' };
      // Si no era cliente, pasa a serlo: el botón que mandó esto decía «Marcar como cliente e invitar».
      nuevoCliente = (data as { estado_lead: string | null }).estado_lead !== 'ganado';
      if (nuevoCliente) await updateLead(usar, { estado_lead: 'ganado' });
      leadId = usar;
    } else {
      if (nombre.length < 2) return { ok: false, error: 'Falta el nombre.' };
      const r = await crearClienteAction({
        nombre, email: correo, telefono: datos.telefono, empresa: datos.empresa,
        sinCobro: datos.sinCobro === true, permitirDuplicado: datos.crearIgual === true,
      });
      if (!r.ok || !r.leadId) {
        if (r.duplicados?.length) return { ok: false, error: 'Ya existe.', duplicados: await conEstado(r.duplicados) };
        return { ok: false, error: r.error ?? 'No se pudo cargar.' };
      }
      leadId = r.leadId;
    }

    // ⚠️ DESPUÉS DEL ALTA NADA TIRA HACIA AFUERA COMO «NO SE PUDO»: el cliente ya existe, y un error
    // genérico haría que alguien lo cargue de nuevo. Lo que falla se dice en el texto.
    let enKanban = true;
    let soloAca = true;
    try {
      if (!(await productosDelAlumno(leadId)).includes(productoId)) {
        const m = await moverClienteDeEtapa({ leadId, productoId, etapa: null, por: autor });
        enKanban = m.ok;
        if (!m.ok) console.error('[curso] el alumno nuevo no entró al kanban:', m.motivo);
      }
      // ⚠️ SÓLO DE ESTE PRODUCTO (revisión del 08/10/2026). Un cliente nuevo nace en el embudo
      // PRINCIPAL del CRM, y su casa (./pertenencia.ts) es el producto de ese embudo: invitado desde
      // el curso de OTRO producto quedaba en los DOS kanbans y la invitación (`productosDelAlumno`)
      // le abría también el curso del principal — un programa que no compró, con todas sus clases.
      // Se lo saca de los otros con la MISMA «Quitar de este producto» de la ficha (marca «fuera»
      // sobre la casa, con su línea de historial). Sólo a quien ESTA action hizo cliente: uno que ya
      // era cliente sigue en lo suyo. Si no se pudo, no se invita: el mail le abriría el otro curso.
      if (enKanban && nuevoCliente) {
        for (const otro of (await productosDelAlumno(leadId)).filter((x) => x !== productoId)) {
          const q = await quitarDeProductoAction(leadId, otro);
          if (!q.ok) { soloAca = false; console.error('[curso] el alumno nuevo quedó también en otro producto:', q.error); }
        }
      }
    } catch (e) {
      if (enKanban) soloAca = false; else enKanban = false;
      console.error('[curso] el alumno nuevo no quedó en el kanban de este producto:', e instanceof Error ? e.message : e);
    }
    const r = !enKanban
      // Sin el producto, su portal no le abriría este curso: invitarlo sería mandarle un link a otra cosa.
      ? { enviado: false, texto: 'Se cargó, pero no entró al kanban. Muévelo ahí e invítalo desde su ficha.' }
      : !soloAca
        ? { enviado: false, texto: 'Se cargó, pero quedó en otro producto. Sácalo de ahí e invítalo desde su ficha.' }
        : fraseDe(await invitarAlCurso({ ws, leadId, email: correo, autor, reenviar: false, canales: canalesDeInvitacion(datos.canales) }));
    revalidatePath('/customer-success');
    revalidatePath('/customer-success/curso');
    revalidatePath('/crm');
    return { ok: true, leadId, ...r };
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
