import 'server-only';

// =============================================================================
// curso-alta-alumno — invitar al curso a alguien DE CERO
// =============================================================================
// Lo crea como cliente ganado, lo pone en el kanban del producto en su primera etapa y lo invita: «Me
// debe pedir más datos para también agregarlo como cliente al kanban». Vivía adentro de
// `invitarNuevoAlumnoAction` (app/customer-success/curso/invitar-actions.ts) y se mudó acá el
// 23/10/2026 para que lo use también la API de MaKo (`crear_alumno_curso`, P0-3 de la auditoría: la
// migración de un curso de Panda trae alumnos que no están en el CRM). La action sigue haciendo lo
// suyo —la puerta, los `revalidatePath`, el texto de la pantalla— y delega acá.
//
// En orden, y el orden importa:
//   1. el producto tiene que tener clases (sin curso no hay a qué invitar, y crear un cliente para
//      nada es un lead de más en el CRM); nombre y EMAIL obligatorios (es una invitación por mail: a
//      diferencia del alta de la cartera, el teléfono solo no alcanza). ⚠️ EL TELÉFONO ES OPCIONAL
//      (punto 11 del audio del 08/10/2026 a la noche: «esto lo puedo pasar porque por ahí no lo
//      tengo»): sin él la invitación sale igual por mail; lo que se pierde es «También por WhatsApp»
//      y todo lo que el negocio le mande por WhatsApp después (recordatorios, avisos);
//   2. el cliente: `usarLeadId` = uno que ya existe (lo eligió la persona después del aviso de
//      duplicado; si no era ganado, se lo marca); si no, `crearClienteGanado`, que es la MISMA alta de
//      la cartera, con su chequeo de duplicados. Si choca, NO se crea nada y vuelve con quién choca;
//   3. el kanban: si el producto no es su casa ni tiene fila ahí, se lo mete en la PRIMERA etapa
//      (`moverClienteDeEtapa` con `etapa: null`, el choke point de siempre). Un cliente nuevo nace en
//      el embudo principal: sin esto, invitado desde el curso de OTRO producto no aparecería en ese
//      kanban — ni la invitación lo encontraría cliente de ese producto (`productosDelCliente`);
//   4. ⚠️ SÓLO DE ESTE PRODUCTO (revisión del 08/10/2026). Su casa (app/customer-success/pertenencia.ts)
//      es el producto del embudo principal: invitado desde el curso de OTRO producto quedaba en los DOS
//      kanbans — un programa que no compró. Se lo saca de los otros con la MISMA «Quitar de este
//      producto» de la ficha (`quitarClienteDeProducto`). Sólo a quien ESTE alta hizo cliente: uno que
//      ya era cliente sigue en lo suyo. Si no se pudo, no se invita y se dice;
//   5. la invitación (`invitarAlCurso`), a ESTE producto: el mail nombra sólo este curso y su acceso
//      abre sólo éste.
//
// ⚠️ DESPUÉS DEL ALTA NADA TIRA HACIA AFUERA COMO «NO SE PUDO»: el cliente ya existe, y un error
// genérico haría que alguien lo cargue de nuevo. Lo que falla vuelve en `enKanban` y `soloAca`, o en el
// resultado de la invitación, y quien llama lo dice.
// =============================================================================

import { getTenantDb } from './workspace';
import { emailNormalizado, emailUtilizable } from './agencia-altas';
import { invitarAlCurso, type IntentoInvitar } from './curso-invitar';
import { clasesDelProducto } from './curso-datos';
import { moverClienteDeEtapa } from './cs-mover-etapa';
import { quitarClienteDeProducto } from './cs-quitar-producto';
import { crearClienteGanado } from './cs-crear-cliente';
import { updateLead } from './leads';
import type { MotivoDuplicado } from './leads-duplicados';
import { productosDelCliente } from '@/app/customer-success/entrega';

export type PedidoAltaAlumno = {
  ws: number;
  productoId: number;
  nombre: string;
  email: string;
  telefono?: string;
  empresa?: string;
  sinCobro?: boolean;
  /** Usar ESTE lead (el del aviso de duplicado) en vez de crear uno. */
  usarLeadId?: number | null;
  /** Crearlo aunque se parezca a otro: lo eligió alguien después del aviso. */
  crearIgual?: boolean;
  /** «También por WhatsApp»: ya saneados por quien llama (`canalesDeInvitacion`). */
  canales?: string[];
  /** Quién firma el alta, el kanban y la invitación. */
  autor: string;
};

export type AltaAlumno =
  | {
    ok: true;
    leadId: number;
    /** ¿Este alta lo hizo cliente? (lo creó, o lo pasó a ganado). */
    nuevoCliente: boolean;
    /** Quedó en el kanban de este producto. Sin eso no se lo invita: su portal no le abriría este curso. */
    enKanban: boolean;
    /** Quedó SÓLO en este producto (si lo hizo cliente este alta). Sin eso no se lo invita. */
    soloAca: boolean;
    /** El resultado de la invitación, o null si no se invitó (por `enKanban` o `soloAca`). */
    invitacion: IntentoInvitar | null;
  }
  | { ok: false; error: string; duplicados?: Array<{ leadId: number; nombre: string; texto: string; motivo: MotivoDuplicado }> };

export async function darDeAltaAlumno(p: PedidoAltaAlumno): Promise<AltaAlumno> {
  const productoId = Number(p.productoId);
  if (!Number.isInteger(productoId) || productoId <= 0) return { ok: false, error: 'Falta el producto.' };
  const nombre = (p.nombre ?? '').trim();
  const correo = emailNormalizado(typeof p.email === 'string' ? p.email : '');
  if (!emailUtilizable(correo)) return { ok: false, error: 'Ese email no sirve.' };
  // `clasesDelProducto` lee con el inquilino puesto: un producto de otro workspace da cero clases.
  if (!(await clasesDelProducto(productoId)).length) return { ok: false, error: 'Este producto todavía no tiene clases.' };
  const autor = p.autor;

  let leadId: number;
  let nuevoCliente = true;
  const usar = Number(p.usarLeadId);
  if (Number.isInteger(usar) && usar > 0) {
    const db = await getTenantDb();
    const { data, error } = await db.from('leads').select('id, estado_lead').eq('id', usar).maybeSingle();
    if (error) return { ok: false, error: `No pude verificar el cliente: ${error.message}` };
    if (!data) return { ok: false, error: 'Ese cliente no es de este workspace.' };
    // Si no era cliente, pasa a serlo: quien eligió «usar ese» lo hizo sabiendo que lo marca como cliente.
    nuevoCliente = (data as { estado_lead: string | null }).estado_lead !== 'ganado';
    if (nuevoCliente) await updateLead(usar, { estado_lead: 'ganado' });
    leadId = usar;
  } else {
    if (nombre.length < 2) return { ok: false, error: 'Falta el nombre.' };
    const r = await crearClienteGanado({
      nombre, email: correo, telefono: p.telefono, empresa: p.empresa,
      sinCobro: p.sinCobro === true, permitirDuplicado: p.crearIgual === true,
    }, autor);
    if (!r.ok || !r.leadId) {
      if (r.duplicados?.length) return { ok: false, error: 'Ya existe.', duplicados: r.duplicados };
      return { ok: false, error: r.error ?? 'No se pudo cargar.' };
    }
    leadId = r.leadId;
  }

  let enKanban = true;
  let soloAca = true;
  try {
    if (!(await productosDelCliente(leadId)).productos.includes(productoId)) {
      const m = await moverClienteDeEtapa({ leadId, productoId, etapa: null, por: autor });
      enKanban = m.ok;
      if (!m.ok) console.error('[curso] el alumno nuevo no entró al kanban:', m.motivo);
    }
    if (enKanban && nuevoCliente) {
      for (const otro of (await productosDelCliente(leadId)).productos.filter((x) => x !== productoId)) {
        const q = await quitarClienteDeProducto(leadId, otro, autor);
        if (!q.ok) { soloAca = false; console.error('[curso] el alumno nuevo quedó también en otro producto:', q.error); }
      }
    }
  } catch (e) {
    if (enKanban) soloAca = false; else enKanban = false;
    console.error('[curso] el alumno nuevo no quedó en el kanban de este producto:', e instanceof Error ? e.message : e);
  }
  // Sin el producto, su portal no le abriría este curso: invitarlo sería mandarle un link a otra cosa.
  const invitacion = enKanban && soloAca
    ? await invitarAlCurso({ ws: p.ws, leadId, email: correo, autor, reenviar: false, canales: p.canales, productoId })
    : null;
  return { ok: true, leadId, nuevoCliente, enKanban, soloAca, invitacion };
}
