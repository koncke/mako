'use server';

// =============================================================================
// Server actions de Customer Success
// =============================================================================
// Queda UNA: el trabajo de un cliente en el tablero. Es lo único que la pantalla
// hace, y la pantalla es una lista de clientes con sus proyectos, sus tareas y
// sus recurrentes.
//
// ⚠️ `marcarEstadoAction` SE FUE CON LOS BOTONES (26/09/2026). Ponía a un cliente
// en pausa / terminado / baja en `cs_clientes`, y esos tres botones eran parte de
// lo que esta pantalla nunca tuvo que tener. La CAPACIDAD no se perdió: MaKo la
// sigue teniendo entera en `lib/api-mako/areas/cs.helpers.ts`
// (`marcarEstadoCliente`), que es donde vive ese mecanismo. Si vuelve a hacer
// falta un botón, el server action se reescribe en cuatro líneas; lo que no se
// puede es dejarlo acá sin nadie que lo llame.
//
// ⚠️ SE FUERON TRES MÁS, Y EL PORQUÉ IMPORTA (26/09/2026). `emitirLinkAction`,
// `revocarLinksAction`, `avanceDelClienteAction` y `sincronizarWhopAction` eran
// del programa de 44 clases de UN cliente: el link abría SU cuestionario, el
// avance leía `cs_respuestas` (0 filas en todo el producto) y el sync subía SU
// temario a Whop. Nada de eso es de un workspace cualquiera.
// Los links ya emitidos se siguen operando desde MaKo
// (`lib/api-mako/areas/cs.helpers.ts`), que es donde vive ese mecanismo ahora.
//
// ⚠️ Y EL WORKSPACE ES EL ACTUAL, SIN EXCEPCIONES. `wsActual()` devolvía
// `OWNER_WS` cuando quien miraba era admin, para que la tab de Mauricio se
// viera desde cualquier lado. Con eso, un admin parado en OTRO cliente escribía
// el estado sobre la cartera de Mauricio. Es la misma pantalla para todos: el
// inquilino lo resuelve `getTenantDb()`.

import { getTenantDb, adminDeWorkspaceActual, crearWorkspace } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { esAgencia } from '@/lib/agencia';
import { saneaPortada, saneaIcono, urlDeImagenOk, yPortada } from '@/lib/portadas';
import { createLead, updateLead } from '@/lib/leads';
// La clase vive en su módulo, no en `lib/leads`, que sólo la re-usa.
import { LeadDuplicadoError } from '@/lib/leads-duplicados';
import { ORIGEN_LEAD } from '@/app/crm/origen-lead';
import { revalidatePath } from 'next/cache';
import { autoasignar } from './trabajo';
import { crearUsuario, buscarUsuarioPorEmail } from '@/lib/usuarios';
import { emailUtilizable, emailNormalizado } from '@/lib/agencia-altas';
import { moverClienteDeEtapa, sacarClienteDeEntrega } from '@/lib/cs-mover-etapa';
import { guardarEtapasEntrega } from '@/lib/entrega-servicio';
import { crearProductoConFunnel } from '@/lib/producto-con-funnel';
import type { EtapaEntrega, FaseEntrega } from '@/lib/servicio-etapas';

/** ¿Este lead es un cliente DE ESTE workspace? Fail-closed: sin esto, un POST
 *  con el id de un lead ajeno leería o escribiría datos de otro inquilino. */
async function clienteDelWorkspace(leadId: number): Promise<{ id: number; nombre: string; email: string | null } | null> {
  if (!Number.isFinite(leadId) || leadId <= 0) return null;
  const db = await getTenantDb();
  // El EMAIL viene en la misma lectura: lo necesita el alta de su cuenta, y pedirlo
  // aparte sería una segunda consulta por un campo que ya estaba en la fila.
  const { data } = await db.from('leads')
    .select('id, nombre, email').eq('id', leadId).eq('estado_lead', 'ganado').maybeSingle();
  return (data as { id: number; nombre: string; email: string | null } | null) ?? null;
}

// ⚠️ SE FUERON CUATRO ACTIONS MÁS EL 27/09/2026, CON EL BOTÓN QUE LAS LLAMABA.
// `trabajoDelClienteAction`, `catalogoAsignableAction`, `asignarTrabajoAction` y
// `trabajoAsignadoAction` alimentaban el selector de «Asignarle trabajo», que se sacó a
// pedido: «si ya copiamos la tab de plan, ya hay otros botones para eso». Tenía razón —
// la ficha monta el tablero de verdad, así que lo que se crea adentro nace del cliente y
// a lo que ya existe se le pone el cliente desde su propio detalle.
//
// No se dejan «por si vuelven»: una action exportada sin call site es una puerta abierta
// que nadie audita, y la pregunta «¿quién la llama?» ya costó caro en este repo. El
// mecanismo sigue entero en `./trabajo.ts` (`asignarTrabajo`), que es lo que usa la
// corrida de `autoasignar`.

// ── Cargar un cliente que nunca pasó por el CRM ──────────────────────────────

/**
 * Crea el cliente. Que es: crea el LEAD en el CRM y lo marca ganado.
 *
 * ⚠️ NO HAY TABLA DE CLIENTES, Y ESA ES LA DECISIÓN. «Al cargarse se debería cargar en el
 * CRM también» (26/09/2026) — y la única forma de que eso no se desincronice nunca es que
 * no haya dos lugares: un cliente ES un lead ganado. Con una tabla propia habría clientes
 * que el CRM no conoce, y el día que alguien busque a uno por teléfono no lo encuentra.
 *
 * ⚠️ Y PASA POR `createLead`, no por un insert propio: ahí viven la detección de
 * duplicados, la auto-asignación de vendedor y el alta del hilo de WhatsApp. Un insert a
 * mano se saltea las tres sin que nada falle.
 */
export async function crearClienteAction(datos: {
  nombre: string; empresa?: string; email?: string; telefono?: string;
}): Promise<{ ok: boolean; leadId?: number; error?: string }> {
  const nombre = (datos.nombre ?? '').trim();
  if (nombre.length < 2) return { ok: false, error: 'Falta el nombre.' };
  const email = (datos.email ?? '').trim() || null;
  const telefono = (datos.telefono ?? '').trim() || null;
  if (!email && !telefono) {
    return { ok: false, error: 'Carga un email o un teléfono: sin eso el cliente es incontactable.' };
  }

  try {
    // ⚠️ `carga_manual`, el MISMO valor que el alta del CRM, y no uno propio de esta
    // pantalla: la pregunta que contesta la columna es «¿cómo llegó esta persona?», y
    // la respuesta —alguien la tipeó— no cambia porque el formulario viva en otra tab.
    // Un valor por pantalla partiría el filtro de origen del CRM en dos opciones que
    // significan lo mismo. De dónde se lo cargó es otra pregunta, y la contesta el
    // historial del lead, no este campo.
    const lead = await createLead({
      nombre, empresa: (datos.empresa ?? '').trim() || null, email, telefono,
      origen_lead: ORIGEN_LEAD.carga_manual.id,
    });
    // El desenlace va en una segunda escritura porque `createLead` no lo acepta: su
    // trabajo es dar de alta un lead, y `estado_lead` es del recorrido. `updateLead`
    // deriva `cerro` solo (lib/leads.ts), así que las dos columnas quedan de acuerdo.
    await updateLead(lead.id, { estado_lead: 'ganado' });
    revalidatePath('/customer-success');
    revalidatePath('/crm');
    return { ok: true, leadId: lead.id };
  } catch (e) {
    // El duplicado tiene su propio error y su propio mensaje: mandar a alguien a cargar
    // de nuevo a un cliente que YA está es cómo se termina con dos fichas de la misma
    // persona y ninguna forma de saber cuál es la buena.
    const msg = e instanceof Error ? e.message : 'No se pudo cargar.';
    if (e instanceof LeadDuplicadoError) {
      return { ok: false, error: 'Ya tienes a alguien con ese nombre o contacto en el CRM. Márcalo como ganado ahí y aparece aquí.' };
    }
    return { ok: false, error: msg };
  }
}

/**
 * Que MaKo asigne lo evidente. Devuelve cuántas y por qué vía, porque son dos cosas
 * distintas: lo del nombre es un hecho y lo de la IA es un juicio.
 */
export async function autoasignarAction(): Promise<
  { ok: true; porNombre: number; porIA: number; consultadas: number; sinRespuesta: number } | { ok: false; error: string }
> {
  try {
    const r = await autoasignar();
    if (r.ok) revalidatePath('/customer-success');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo.' };
  }
}

/**
 * Su foto y su portada (mig 0173).
 *
 * ⚠️ LO QUE MANDA EL NAVEGADOR ES UNA PROPUESTA, y acá se sanea. Las dos cosas
 * terminan dibujadas en la pantalla de cualquiera que abra la tab —una en un `<img>`
 * y la otra adentro de un `url()` de CSS—, así que una URL de un origen cualquiera
 * sería una pieza de un tercero cargándose con el referer del cliente. `saneaPortada`
 * y `urlDeImagenOk` comparan `new URL(v).origin` contra una lista, nunca un prefijo:
 * `https://picsum.photos@evil.tld/x` pasa cualquier `startsWith` y su origen REAL es
 * el del atacante (AGENTS.md → «Un guard de ORIGEN se escribe con `origin`»).
 *
 * ⚠️ `undefined` = «no lo toques» y `null` = «sacalo». Son dos cosas distintas y las
 * dos tienen que poder viajar, o quitarse la foto sería imposible.
 */
export async function guardarImagenClienteAction(leadId: number, cambio: {
  avatarUrl?: string | null;
  portada?: string | null;
  /** El encuadre vertical de cada imagen, 0-100. `null` = centrado (mig 0174). */
  portadaY?: number | null;
  avatarY?: number | null;
  /** `icon:<set>:<nombre>` o una URL. `null` = sin ícono propio (mig 0174). */
  icono?: string | null;
}): Promise<{ ok: true; avatarUrl: string | null; portada: string | null; portadaY: number | null; avatarY: number | null; icono: string | null } | { ok: false; error: string }> {
  try {
    // El mismo guard que el resto de la pantalla: sin esto, un POST con el id de un
    // lead ajeno escribiría sobre la ficha de otro inquilino.
    const cliente = await clienteDelWorkspace(leadId);
    if (!cliente) return { ok: false, error: 'Ese cliente no es de este workspace.' };

    const upd: Record<string, unknown> = {};
    if (cambio.avatarUrl !== undefined) upd.avatar_url = urlDeImagenOk(cambio.avatarUrl);
    if (cambio.portada !== undefined) upd.portada = saneaPortada(cambio.portada);
    // ⚠️ EL ENCUADRE SE BORRA CUANDO CAMBIA LA IMAGEN, y no es un detalle: un `y` de la
    // foto anterior aplicado a una foto nueva la deja encuadrada en cualquier lado, y
    // quien la eligió no tiene forma de saber por qué. Si el que llama manda las dos
    // cosas juntas, gana lo que mandó; si cambia sólo la imagen, el encuadre se resetea.
    if (cambio.portada !== undefined && cambio.portadaY === undefined) upd.portada_y = null;
    if (cambio.avatarUrl !== undefined && cambio.avatarY === undefined) upd.avatar_y = null;
    if (cambio.portadaY !== undefined) upd.portada_y = yPortada(cambio.portadaY);
    if (cambio.avatarY !== undefined) upd.avatar_y = yPortada(cambio.avatarY);
    if (cambio.icono !== undefined) upd.icono = saneaIcono(cambio.icono);
    if (!Object.keys(upd).length) return { ok: false, error: 'No había nada que cambiar.' };

    const db = await getTenantDb();
    const { data, error } = await db.from('leads').update(upd).eq('id', leadId)
      .select('avatar_url, portada, portada_y, avatar_y, icono').single();
    if (error) return { ok: false, error: error.message };

    revalidatePath('/customer-success');
    const fila = data as { avatar_url: string | null; portada: string | null; portada_y: number | null; avatar_y: number | null; icono: string | null };
    // Se devuelve LO QUE QUEDÓ GUARDADO, no lo que se pidió: si el saneo descartó la
    // URL, la pantalla tiene que enterarse en vez de pintar algo que la base no tiene.
    return { ok: true, avatarUrl: fila.avatar_url, portada: fila.portada, portadaY: fila.portada_y, avatarY: fila.avatar_y, icono: fila.icono };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

/**
 * EL NOMBRE Y LA EMPRESA de un cliente, editables en el lugar.
 *
 * «Debería poder editar el nombre del cliente junto con la empresa. Solo clickeando
 * y escribiendo, como los títulos o las descripciones de la tarea, que no parezca
 * que haya un recuadro de texto» (27/09/2026).
 *
 * ⚠️ ESCRIBE `leads`, QUE ES EL CRM. No hay una tabla de clientes: un cliente es un
 * lead ganado (`lib/clientes-ganados.ts`), así que renombrarlo acá lo renombra en el
 * CRM, en el funnel y en cada conversación que lo muestre. Es lo correcto —son la
 * misma persona— y hay que saberlo: no es un apodo local de esta pantalla.
 *
 * ⚠️ Y EL NOMBRE VACÍO NO SE GUARDA. El nombre es lo que identifica a la fila en
 * media app y además de él sale el color y las iniciales; dejarlo en blanco por un
 * borrado accidental deja una tarjeta anónima que nadie sabe de quién es. La empresa
 * sí puede quedar vacía: es un dato opcional de verdad.
 */
export async function guardarDatosClienteAction(leadId: number, cambio: {
  nombre?: string;
  empresa?: string | null;
}): Promise<{ ok: true; nombre: string; empresa: string | null } | { ok: false; error: string }> {
  try {
    // El mismo guard que el resto de la pantalla: sin esto, un POST con el id de un
    // lead ajeno escribiría sobre la ficha de otro inquilino.
    const cliente = await clienteDelWorkspace(leadId);
    if (!cliente) return { ok: false, error: 'Ese cliente no es de este workspace.' };

    const upd: Record<string, unknown> = {};
    if (cambio.nombre !== undefined) {
      const n = cambio.nombre.trim().slice(0, 120);
      if (!n) return { ok: false, error: 'El nombre no puede quedar vacío.' };
      upd.nombre = n;
    }
    if (cambio.empresa !== undefined) upd.empresa = cambio.empresa?.trim().slice(0, 120) || null;
    if (!Object.keys(upd).length) return { ok: false, error: 'No había nada que cambiar.' };

    const db = await getTenantDb();
    const { data, error } = await db.from('leads').update(upd).eq('id', leadId)
      .select('nombre, empresa').single();
    if (error) return { ok: false, error: error.message };

    revalidatePath('/customer-success');
    const fila = data as { nombre: string | null; empresa: string | null };
    // Lo que QUEDÓ guardado, no lo que se pidió: mismo criterio que las imágenes.
    return { ok: true, nombre: fila.nombre ?? '', empresa: fila.empresa };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

/**
 * Abrirle una cuenta de MaKo a un cliente ganado — queda ESPERANDO APROBACIÓN.
 *
 * Es el puente que faltaba entre las dos pantallas de «Clientes»: ésta lista
 * LEADS y /admin lista WORKSPACES, y hasta la mig 0175 no había ninguna columna
 * que los cruzara. Por eso «Entrar como» no se podía poner acá: no había a dónde
 * entrar.
 *
 * ⚠️ NACE 'pendiente', SIEMPRE. Quien crea la cuenta es la agencia; quien
 * autoriza que la agencia MIRE adentro es el super-admin, y son dos decisiones
 * distintas. Sin ese corte, cualquiera con un workspace se daría de alta clientes
 * y se auto-aprobaría el acceso — o sea, el guard no sería un guard.
 *
 * ⚠️ Y NO HAY ROLLBACK, a propósito de decirlo en vez de fingirlo. Si la fila de
 * la cartera falla después de crear el workspace, ese workspace queda: borrarlo
 * no se puede (ya tiene su `funnels` colgando con FK sin cascade — es el mismo
 * agujero que ya tiene /api/admin/workspaces), así que el mensaje NOMBRA el id
 * que quedó suelto. Un alta a medias en silencio es peor que una que avisa.
 */
export async function crearCuentaMakoAction(leadId: number, email: string): Promise<
  { ok: true; clienteWs: number; estado: string } | { ok: false; error: string }
> {
  try {
    /**
     * ⚠️ EL EMAIL ES OBLIGATORIO, y eso es un cambio de producto del 28/09/2026: «que
     * abrir cuenta pida el email del cliente desde el principio, y tiene que ser
     * obligatorio».
     *
     * El porqué está medido: Código abrió una cuenta el mismo día, el super admin la
     * aprobó, y no le llegó nada a nadie — el workspace quedó con CERO usuarios y el
     * lead ni siquiera tenía email, sólo teléfono. O sea una cuenta que existe y a la
     * que no puede entrar nadie, sin un solo error que lo diga.
     */
    const correo = emailNormalizado(email);
    if (!emailUtilizable(correo)) {
      return { ok: false, error: 'Hace falta el email del cliente: es por donde le llega el acceso.' };
    }
    const agenciaWs = await adminDeWorkspaceActual();
    if (!agenciaWs) return { ok: false, error: 'Sólo el admin de la cuenta puede abrirle una cuenta a un cliente.' };
    // ⚠️ EL GUARD DE VERDAD, y va acá y no sólo en la pantalla: esconder el botón
    // no protege nada, porque una server action se puede invocar igual. Sin esto,
    // cualquier admin de cualquier workspace crea inquilinos en la plataforma.
    if (!(await esAgencia(agenciaWs))) {
      return { ok: false, error: 'Tu cuenta no está habilitada para tener clientes propios.' };
    }

    const cliente = await clienteDelWorkspace(leadId);
    if (!cliente) return { ok: false, error: 'Ese cliente no es de este workspace.' };

    const db = await getTenantDb();
    // Idempotencia: dos clicks, dos pestañas o una conexión mala no pueden dejar
    // dos workspaces para el mismo cliente. Se pregunta ANTES de crear nada.
    const { data: yaTiene } = await db.from('leads').select('cliente_ws').eq('id', leadId).maybeSingle();
    const wsPrevio = (yaTiene as { cliente_ws: number | null } | null)?.cliente_ws ?? null;
    if (wsPrevio) return { ok: false, error: 'Este cliente ya tiene cuenta de MaKo.' };

    // ⚠️ SE COMPRUEBA ANTES DE CREAR EL WORKSPACE. `usuarios.email` es único, así que
    // un email ya usado hace fallar el alta DESPUÉS de haber creado el inquilino — y
    // deja un workspace huérfano que nadie sabe que está.
    if (await buscarUsuarioPorEmail(correo)) {
      return { ok: false, error: 'Ese email ya tiene una cuenta de MaKo. Usa otro, o pide sumarlo desde su equipo.' };
    }

    const nombre = cliente.nombre.trim() || `Cliente ${leadId}`;
    const ws = await crearWorkspace(nombre);

    const { error: eCartera } = await getSupabaseServer()
      .from('agencia_clientes')
      .insert({ agencia_ws: agenciaWs, cliente_ws: ws.id, estado: 'pendiente' });
    if (eCartera) {
      // Corto, y con el número adentro: el id es lo ÚNICO que no se puede
      // reconstruir después, y sin él nadie encuentra el workspace que quedó
      // suelto. El porqué de que no haya rollback está arriba, en el comentario.
      return { ok: false, error: `La cuenta quedó creada (workspace ${ws.id}) pero sin pedir aprobación: ${eCartera.message}` };
    }

    // El puntero del lead a su cuenta. Va ÚLTIMO: si fallara, lo que queda es una
    // cartera pendiente sin ficha que la muestre —recuperable desde /admin—, y no
    // una ficha que promete una cuenta que nadie puede aprobar.
    const { error: eLead } = await db.from('leads').update({ cliente_ws: ws.id }).eq('id', leadId);
    if (eLead) return { ok: false, error: `Se creó la cuenta (workspace ${ws.id}) pero no quedó ligada a esta ficha: ${eLead.message}` };

    /**
     * SU ADMIN, creado ya — PERO SIN AVISARLE TODAVÍA.
     *
     * ⚠️ `crearUsuario` NO manda nada: el mail es `invitarPorEmail`, que va aparte y
     * lo dispara la APROBACIÓN del super admin. Es la regla de la casa aplicada a una
     * persona: la agencia PROPONE la cuenta y alguien la confirma, y avisarle antes
     * sería contarle a un tercero que tiene un acceso que todavía no está autorizado.
     *
     * ⚠️ Y SI ESTO FALLA NO SE DESHACE NADA: la cuenta ya está creada y pedida. Se
     * devuelve el número del workspace, que es lo único que no se puede reconstruir.
     */
    try {
      await crearUsuario({
        email: correo,
        nombre: cliente.nombre.trim() || correo,
        rol: 'usuario',
        workspace_id: ws.id,
        rol_ws: 'admin',
      });
    } catch (e) {
      return { ok: false, error: `La cuenta quedó creada (workspace ${ws.id}) pero sin su usuario: ${e instanceof Error ? e.message : String(e)}` };
    }

    // El email también queda en el LEAD si no tenía: es el mismo dato y tenerlo en un
    // solo lado obliga a acordarse de mirar en el otro.
    if (!cliente.email) await db.from('leads').update({ email: correo }).eq('id', leadId);

    revalidatePath('/customer-success');
    return { ok: true, clienteWs: ws.id, estado: 'pendiente' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo abrir la cuenta.' };
  }
}

// ── La ENTREGA de un servicio (mig 0188) ─────────────────────────────────────
// Las tres pasan por el choke point o por el guardado del catálogo; ninguna escribe
// `cliente_entrega` por su cuenta. Y las tres vuelven a preguntar si el lead es un
// cliente DE ESTE workspace: `getTenantDb()` scopea las tablas de entrega, pero el
// `leadId` lo manda el navegador y un id ajeno tiene que rebotar acá, no en una FK.

/**
 * Mueve a un cliente a una etapa de la entrega de un servicio.
 *
 * Devuelve el movimiento entero para que la pantalla pueda ofrecer un DESHACER que
 * reponga la etapa ANTERIOR: sin `desde`, deshacer tendría que adivinar, y volver a
 * llamar sin ese dato lo dejaría en la primera columna — o sea que deshacer perdería
 * el avance del cliente.
 */
export async function moverEntregaAction(leadId: number, productoId: number, etapa: string | null): Promise<
  { ok: true; desde: string | null; hacia: string; rotulo: string; producto: string; cambio: boolean } | { ok: false; error: string }
> {
  try {
    if (!(await clienteDelWorkspace(leadId))) return { ok: false, error: 'Ese cliente no es tuyo.' };
    const m = await moverClienteDeEtapa({ leadId, productoId, etapa });
    if (!m.ok) return { ok: false, error: m.motivo ?? 'No se pudo mover.' };
    // ⚠️ SÓLO SE REVALIDA SI ALGO CAMBIÓ. Un movimiento idempotente que igual
    // revalida tira las 78 KB del trabajo de la cartera por un gesto que no movió nada.
    if (m.cambio) revalidatePath('/customer-success');
    return { ok: true, desde: m.desde, hacia: m.hacia, rotulo: m.rotulo, producto: m.producto, cambio: m.cambio };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo mover.' };
  }
}

/** Saca a un cliente de la entrega de un servicio, devolviendo la etapa que tenía
 *  para que el deshacer lo reponga DONDE ESTABA. */
export async function sacarDeEntregaAction(leadId: number, productoId: number): Promise<
  { ok: true; etapa: string | null } | { ok: false; error: string }
> {
  try {
    if (!(await clienteDelWorkspace(leadId))) return { ok: false, error: 'Ese cliente no es tuyo.' };
    const r = await sacarClienteDeEntrega(leadId, productoId);
    if (!r.ok) return { ok: false, error: r.motivo ?? 'No se pudo sacar de la entrega.' };
    revalidatePath('/customer-success');
    return { ok: true, etapa: r.etapa };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo sacar de la entrega.' };
  }
}

/**
 * Las etapas de la entrega de un producto, como las dejó el editor.
 *
 * ⚠️ RECIBE LA LISTA ENTERA, no un cambio. Las etapas son un ORDEN, y un merge por
 * clave no puede expresar «esta columna va antes que aquélla» ni un borrado. Lo que
 * protege de perder algo es que la pantalla arme la lista desde lo que leyó — y que
 * `nuevaClaveEtapa` nunca reuse una clave borrada, para que los clientes que estaban
 * en la etapa vieja no reaparezcan dentro de una columna nueva.
 *
 * ⚠️ Y SÓLO UN ADMIN DEL WORKSPACE. Mover un cliente de columna lo hace cualquiera que
 * tenga la tab —es el trabajo del día—, pero RENOMBRAR o BORRAR una columna le cambia
 * el tablero a todo el equipo y puede dejar clientes en una etapa que ya no existe.
 */
export async function guardarEtapasEntregaAction(
  productoId: number,
  etapas: EtapaEntrega[],
  /** Sin default: ver el porqué en `guardarEtapasEntrega`. */
  fases: FaseEntrega[],
): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    if (!(await adminDeWorkspaceActual())) return { ok: false, error: 'Sólo un administrador puede cambiar las etapas de un servicio.' };
    const ok = await guardarEtapasEntrega(productoId, etapas, fases);
    if (!ok) return { ok: false, error: 'Esas etapas no se pudieron guardar. Revisa que ninguna quede sin nombre.' };
    revalidatePath('/customer-success');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

/**
 * Crea un producto DESDE Customer Success, con su embudo.
 *
 * ⚠️ NO ES `upsertProducto`, y es el error que parece obvio. El desplegable del CRM
 * lista EMBUDOS, no productos: un producto suelto no aparece ahí por más que esté en la
 * tabla — o sea que «creo un producto acá y lo veo allá» sería falso. `crearProductoConFunnel`
 * arma la cadena entera (producto → oferta_productos → oferta → funnel_ofertas → funnel) y
 * además hace nacer el funnel CON sus etapas, que es lo que evita que el tablero nuevo se
 * vea idéntico al del negocio — el síntoma que Martín reportó tres veces.
 *
 * El sentido inverso no necesita nada: el alta del CRM escribe en `productos` con
 * `activo: true`, que es exactamente lo que lee esta pantalla.
 *
 * ⚠️ Y LO PUEDE HACER UN ADMIN DEL WORKSPACE, igual que editar las etapas: un producto
 * nuevo le aparece al equipo entero y en las dos pantallas.
 */
export async function crearServicioAction(nombre: string): Promise<
  { ok: true; productoId: number } | { ok: false; error: string }
> {
  try {
    if (!(await adminDeWorkspaceActual())) return { ok: false, error: 'Sólo un administrador puede crear un producto.' };
    const { productoId } = await crearProductoConFunnel(nombre);
    revalidatePath('/customer-success');
    revalidatePath('/crm');
    return { ok: true, productoId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo crear el producto.' };
  }
}
