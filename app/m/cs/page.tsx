// =============================================================================
// /m/cs — Customer Success en el teléfono: la ENTREGA de cada cliente
// =============================================================================
// Prototipo: docs/prototipos/mako-mobile-v2.html, data-ir="cs". Diseño:
// docs/diseno-mako-mobile-v2.md, «Customer Success».
//
// El kanban de la entrega de escritorio (/customer-success, KanbanEntrega) como lista agrupada:
// una sección por etapa con su conteo, cada cliente con su empresa y hace cuánto está ahí, y
// «21 días sin moverse» con el punto rojo. Tocar uno abre un sheet: pasarlo a la siguiente etapa
// (o a otra) con Deshacer, escribirle por WhatsApp y reenviar la invitación al curso.
//
// ⚠️ TODO SALE DE LAS MISMAS LECTURAS QUE ESCRITORIO, ninguna consulta propia salvo el teléfono:
//   · la cartera → `clientesGanados` (lib/clientes-ganados.ts), el universo de «cliente»;
//   · los servicios, sus etapas, las filas, la CASA de cada uno y el orden manual →
//     `carteraEnEntrega` (app/customer-success/entrega.ts), la del kanban;
//   · de qué servicio es cada uno → `esDelProducto` (app/customer-success/pertenencia.ts);
//   · el curso → `clasesDelProducto` + `accesosDeClientes`, leídos y traducidos como la página de
//     escritorio (`accesoDeFila`, `accesoEnProducto`, `estadoDeInvitacion`).
// Mover pasa por `moverEntregaAction`, que entra al CHOKE POINT (`moverClienteDeEtapa`,
// lib/cs-mover-etapa.ts) con su lectura ESTRICTA del catálogo: sin etapas leídas no se mueve.
//
// ⚠️ EL WORKSPACE ES EL DEL REQUEST (`getTenantDb` por dentro de cada lectura), nunca `?ws=`.
// Y la puerta es `requireMovil({ navKey: 'customer-success' })`: la misma regla que el Sidebar.
// =============================================================================

import './cs.css';
import { requireMovil } from '@/lib/movil-guard';
import { puedeVerKey } from '@/lib/movil-rutas';
import { getTenantDb } from '@/lib/workspace';
import { leerTodo } from '@/lib/supabase-paginado';
import { clientesGanados } from '@/lib/clientes-ganados';
import { clasesDelProducto } from '@/lib/curso-datos';
import { accesosDeClientes } from '@/lib/curso-admin';
import { accesoEnProducto } from '@/lib/curso-invitar-reglas';
import { emailNormalizado, emailUtilizable } from '@/lib/agencia-altas';
import { carteraEnEntrega } from '@/app/customer-success/entrega';
import { esDelProducto } from '@/app/customer-success/pertenencia';
import { accesoDeFila, estadoDeInvitacion } from '@/app/customer-success/curso-ficha-lectura';
import { waMeHref } from '@/app/m/crm/reglas';
import { ComputadoraM, ErrorM, PantallaM, VacioM } from '@/app/m/_ui';
import { CustomerSuccessM } from './CustomerSuccessM';
import type { ClienteCs, CursoCs, ServicioCs } from './reglas';

export const dynamic = 'force-dynamic';
// Mover y reenviar la invitación corren server actions desde esta página (el mail tarda).
export const maxDuration = 60;

const COMPU = 'Editar etapas, el curso y la ficha completa';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * El teléfono de cada ganado, para wa.me cuando quien mira no ve el CRM (con el CRM, el link va
 * al chat de /m/crm, que ya ofrece wa.me si el lead nunca escribió a la línea).
 *
 * ⚠️ UNA LECTURA APARTE y no un campo de `clientesGanados`: esa lista enumera columnas a propósito
 * (la usan los pickers del tablero) y el teléfono es de esta pantalla. `null` = no se pudo leer:
 * la fila de WhatsApp no se ofrece, que es de menos y no un link roto.
 */
async function telefonosDeGanados(): Promise<Map<number, string | null> | null> {
  try {
    const db = await getTenantDb();
    const filas = await leerTodo<{ id: number; telefono: string | null }>(db, 'leads', 'id, telefono',
      { orden: 'id', eq: { estado_lead: 'ganado' } });
    return new Map(filas.map((f) => [Number(f.id), f.telefono]));
  } catch (e) {
    console.warn('[m/cs] no pude leer los teléfonos:', msg(e));
    return null;
  }
}

/**
 * Qué invitación al curso se le ofrece a cada cliente, por servicio. Las reglas son las de la
 * tarjeta del kanban (`opcionesDeCursoEnTarjeta`): sólo «sin invitar» o «invitado»; cortado se
 * habilita en la ficha, y un acceso que no se pudo leer no se invita a ciegas (podría ser un
 * segundo mail). Además el teléfono NO pide el email: sólo se ofrece con uno que sirve (el de la
 * invitación anterior, o el del CRM), y el sheet lo dice antes de mandar.
 *
 * Con las clases o los accesos caídos, ningún servicio ofrece nada del curso (`null`).
 */
async function cursoPorServicio(
  servicios: ReadonlyArray<{ productoId: number }>,
  miembros: ReadonlyMap<number, readonly number[]>,
  emailCrm: ReadonlyMap<number, string | null>,
): Promise<Map<number, Record<number, CursoCs> | null>> {
  const out = new Map<number, Record<number, CursoCs> | null>();
  const ids = [...new Set([...miembros.values()].flat())];
  const [conCurso, accesos] = await Promise.all([
    Promise.all(servicios.map(async (s) => [s.productoId, (await clasesDelProducto(s.productoId)).length > 0] as const))
      .then((xs) => new Map(xs))
      .catch((e) => { console.warn('[m/cs] no pude leer las clases:', msg(e)); return null; }),
    ids.length
      ? accesosDeClientes(ids).catch((e) => { console.warn('[m/cs] no pude leer los accesos al curso:', msg(e)); return null; })
      : Promise.resolve(new Map()),
  ]);
  for (const s of servicios) {
    if (!conCurso?.get(s.productoId) || !accesos) { out.set(s.productoId, null); continue; }
    const porLead: Record<number, CursoCs> = {};
    for (const id of miembros.get(s.productoId) ?? []) {
      const crudo = accesoDeFila(accesos.get(id) ?? { estado: 'sin-link', ingresos: 0, ultimoIngresoAt: null });
      // Desde ESTE curso: invitado a otro curso es «Invitar al curso» acá (ClientesApp, `cursoDe`).
      const estado = estadoDeInvitacion(accesoEnProducto(crudo, s.productoId));
      if (estado.tipo !== 'invitado' && estado.tipo !== 'sin-invitar') continue;
      const email = emailNormalizado((estado.tipo === 'invitado' ? estado.email : null) ?? emailCrm.get(id) ?? '');
      if (!emailUtilizable(email)) continue;
      porLead[id] = { email, reenviar: estado.tipo === 'invitado' };
    }
    out.set(s.productoId, porLead);
  }
  return out;
}

export default async function CustomerSuccessMovil() {
  const ctx = await requireMovil({ navKey: 'customer-success' });

  // ⚠️ SI LA CARTERA NO SE PUEDE LEER, NO SE DIBUJA UNA LISTA VACÍA: «no tienes clientes» sobre una
  // consulta que no contestó es la afirmación falsa que escritorio ya se sacó de encima.
  let ganados: Awaited<ReturnType<typeof clientesGanados>>;
  try {
    ganados = await clientesGanados();
  } catch (e) {
    console.error('[m/cs] clientesGanados:', msg(e));
    return <PantallaM refrescable><ErrorM frase="No pudimos leer tus clientes. No es nada tuyo." /></PantallaM>;
  }

  const entrega = await carteraEnEntrega();
  if (!entrega.ok) {
    console.error('[m/cs] carteraEnEntrega:', entrega.error);
    return <PantallaM refrescable><ErrorM frase="No pudimos leer la entrega de tus clientes. No es nada tuyo." /></PantallaM>;
  }
  if (!entrega.servicios.length) {
    return (
      <PantallaM refrescable>
        <VacioM frase="Todavía no hay servicios para entregar." />
        <ComputadoraM que={COMPU} />
      </PantallaM>
    );
  }

  // Con el CRM a la vista, WhatsApp abre el chat de /m/crm (la línea del negocio, y wa.me si nunca
  // escribió). Sin el CRM ese link lo devolvería a Today: ahí va wa.me directo.
  const conCrm = puedeVerKey('crm', ctx.rol, ctx.capa);
  const telefonos = conCrm ? null : await telefonosDeGanados();

  const clientes: ClienteCs[] = ganados.map((c) => ({
    id: c.leadId,
    nombre: c.nombre.trim() || 'Sin nombre',
    empresa: c.empresa?.trim() || null,
    wa: conCrm ? `/m/crm/${c.leadId}/chat` : waMeHref(telefonos?.get(c.leadId) ?? null),
  }));

  // De qué servicio es cada uno: su casa (el embudo del CRM) o una fila ahí — la regla del kanban.
  const miembros = new Map<number, number[]>();
  for (const s of entrega.servicios) {
    const filas = entrega.porServicio[s.productoId] ?? {};
    miembros.set(s.productoId, clientes.filter((c) => esDelProducto(c.id, s.productoId, entrega.casaPorLead, filas)).map((c) => c.id));
  }

  const curso = await cursoPorServicio(entrega.servicios, miembros, new Map(ganados.map((c) => [c.leadId, c.email ?? null])));

  const servicios: ServicioCs[] = entrega.servicios.map((s) => {
    const filas: ServicioCs['filas'] = {};
    for (const [lead, f] of Object.entries(entrega.porServicio[s.productoId] ?? {})) {
      filas[Number(lead)] = { etapa: f.etapa, desde: f.etapa_desde ?? null };
    }
    return {
      id: s.productoId,
      nombre: s.nombre,
      etapas: s.etapas,
      miembros: miembros.get(s.productoId) ?? [],
      filas,
      orden: entrega.ordenPorServicio[s.productoId] ?? {},
      curso: curso.get(s.productoId) ?? null,
    };
  });

  // Sólo viajan los clientes que algún servicio dibuja: el resto no tiene dónde aparecer.
  const enAlguno = new Set(servicios.flatMap((s) => s.miembros));

  return (
    <PantallaM refrescable>
      <CustomerSuccessM servicios={servicios} clientes={clientes.filter((c) => enAlguno.has(c.id))} />
      <ComputadoraM que={COMPU} />
    </PantallaM>
  );
}
