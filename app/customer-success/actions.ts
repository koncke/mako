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
// `revocarLinksAction`, `avanceDelClienteAction` y la action que sincronizaba el
// temario eran del programa de 44 clases de UN cliente: el link abría SU
// cuestionario, el avance leía `cs_respuestas` (0 filas en todo el producto) y el
// sync subía SU temario a la plataforma de cursos externa (que salió del producto
// entera el 06/10/2026: el curso vive en MaKo). Nada de eso es de un workspace
// cualquiera.
// Los links ya emitidos se siguen operando desde MaKo
// (`lib/api-mako/areas/cs.helpers.ts`), que es donde vive ese mecanismo ahora.
//
// ⚠️ Y EL WORKSPACE ES EL ACTUAL, SIN EXCEPCIONES. `wsActual()` devolvía
// `OWNER_WS` cuando quien miraba era admin, para que la tab de Mauricio se
// viera desde cualquier lado. Con eso, un admin parado en OTRO cliente escribía
// el estado sobre la cartera de Mauricio. Es la misma pantalla para todos: el
// inquilino lo resuelve `getTenantDb()`.
//
// ⚠️ LA PRIMERA LÍNEA DE CADA EXPORT ES LA PUERTA (`puedeUsarCs`, ./puerta.ts): sesión viva
// y Customer Success en la capa de este workspace — lo que la página pregunta con
// `requireCapa`, que una action no atraviesa (es un POST directo). Después de la puerta,
// cada una vuelve a preguntar lo suyo: si el lead es un cliente de ESTE workspace
// (`clienteDelWorkspace`) o si quien llama es admin. Lo fija tests/cs-acciones-puerta.test.ts.
//
// ⚠️ Y LOS MOVIMIENTOS DE ENTREGA FIRMAN CON QUIEN LOS HIZO (`autorActual`), igual que
// renombrar: el choke point firmaba «CRM» si nadie le decía otra cosa.

import { getTenantDb, adminDeWorkspaceActual, getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { puedeUsarCs } from './puerta';
import { saneaPortada, saneaIcono, urlDeImagenOk, yPortada } from '@/lib/portadas';
import { getLead, logLeadChanges, type Lead } from '@/lib/leads';
import { getPagosByLead, type Pago } from '@/lib/pagos';
import { DEFAULT_STAGES, type Stage } from '@/lib/pipeline';
import { getUsuarioActual } from '@/lib/auth';
import type { MotivoDuplicado } from '@/lib/leads-duplicados';
import { revalidatePath } from 'next/cache';
import { autoasignar } from './trabajo';
import { abrirCuentaDePartner } from '@/lib/partners';
import { moverClienteDeEtapa, sacarClienteDeEntrega } from '@/lib/cs-mover-etapa';
import { quitarClienteDeProducto, volverClienteAProducto } from '@/lib/cs-quitar-producto';
import { crearClienteGanado } from '@/lib/cs-crear-cliente';
import { frenarAltaPorTope, TopeDelPlanError } from '@/lib/topes-crm';
import { guardarEtapasEntrega, entregaDeProducto } from '@/lib/entrega-servicio';
import { crearProductoConFunnel } from '@/lib/producto-con-funnel';
import { renombrarProducto, getPipelineStagesDeLead } from '@/lib/funnels';
import type { DeshacerEliminar } from './eliminar-programa';
import { eliminarPrograma, restaurarPrograma } from './programa-datos';
import { duplicarPrograma, type ProgramaDuplicado } from '@/lib/curso-duplicar';
import { frenoAlDuplicar } from '@/lib/tope-cursos';
import { RUTA_CAMBIAR_PLAN } from '@/lib/topes-plan';
import type { EtapaEntrega, FaseEntrega } from '@/lib/servicio-etapas';
import { anotarFichaAbierta } from './onboarding-clientes-sync';

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

/** Quién firma en el historial: el email de quien está logueado, como en el CRM (se
 *  resuelve a nombre y foto al leer). Sin sesión con email, 'CRM'. */
async function autorActual(): Promise<string> {
  try {
    return (await getUsuarioActual())?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

/**
 * La venta y las cuotas de un cliente, para la tab «Pagos» de su ficha.
 *
 * Pedido de Martín (06/10/2026): «sería bueno que traigas la tab de Pagos directamente,
 * como está en el CRM». Se monta el MISMO `DealDetailsCard` que la ficha del CRM, y ése
 * pide el lead ENTERO y sus pagos — por eso esto devuelve `Lead` y no un recorte: con un
 * recorte el componente dibujaría `undefined` en los campos que nadie mapeó.
 *
 * ⚠️ SE PIDE AL ABRIR LA TAB, no con el HTML de la página. Es la excepción a la regla de la
 * ficha (ver su cabecera) y es la misma que ya tienen las Notas y el Historial, que también
 * se reusan del CRM con su lectura adentro: bajar las ~60 columnas de cada lead y todas sus
 * cuotas para catorce clientes, en cada carga de la cartera, para una tab que se abre de a
 * una, es pagar la lectura entera siempre.
 */
export async function pagosDeClienteAction(leadId: number): Promise<{ ok: true; lead: Lead; pagos: Pago[]; etapas: Stage[] } | { ok: false; error: string }> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!(await clienteDelWorkspace(leadId))) return { ok: false, error: 'Ese cliente no es de este workspace.' };
    const [lead, pagos] = await Promise.all([getLead(leadId), getPagosByLead(leadId)]);
    if (!lead) return { ok: false, error: 'No encontré a este cliente.' };
    // Las etapas de SU embudo del CRM, para que el Historial pinte «Etapa» con su rótulo y
    // su color (sin ellas muestra la clave cruda). Las mismas que lee la ficha del CRM.
    const etapas = await getPipelineStagesDeLead(lead).catch(() => [] as Stage[]);
    return { ok: true, lead, pagos, etapas: etapas.length ? etapas : DEFAULT_STAGES };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer sus pagos.' };
  }
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
  /** Un becado o bonificado (#747): la venta se marca «sin cobro» (lib/venta-tipo.ts). */
  sinCobro?: boolean;
  /**
   * Crearlo AUNQUE se parezca a otro (07/10/2026, el alta desde el editor del curso). Es la regla de
   * lib/leads-duplicados.ts: «si el usuario lo quiere duplicar bueno, que lo pueda hacer, pero no
   * cargarlo automáticamente». Lo manda SÓLO un botón que la persona apretó después de ver el aviso.
   */
  permitirDuplicado?: boolean;
}): Promise<{
  ok: boolean; leadId?: number; error?: string;
  /**
   * Con quién choca, cuando choca (07/10/2026). Antes el duplicado era sólo un texto: el alta desde el
   * editor del curso necesita el LEAD para ofrecer «usar ese» en vez de fallar («si el email ya es un
   * lead del workspace, ofrecer usar ese lead»).
   */
  duplicados?: Array<{ leadId: number; nombre: string; motivo: MotivoDuplicado; texto: string }>;
}> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  // El tope de leads del plan, como el alta a mano del CRM y la API (6/11/2026: la pantalla de Customer Success no lo
  // miraba y la API sí). Un cliente nuevo es un lead más.
  const wsAlta = await getWorkspaceActual();
  if (wsAlta != null) {
    try { await frenarAltaPorTope(wsAlta, 'crm.leads'); } catch (e) { if (e instanceof TopeDelPlanError) return { ok: false, error: e.message }; throw e; }
  }
  // El alta vive en lib/cs-crear-cliente.ts desde el 23/10/2026 (la usan también el alta de un alumno
  // desde el curso y la API de MaKo): createLead, ganado y «Sin cobro», con su chequeo de duplicados.
  const r = await crearClienteGanado(datos, await autorActual());
  // Con el lead YA creado (lo de «Sin cobro» falló), la cartera igual tiene que mostrarlo.
  if (r.ok || r.leadId) revalidatePath('/classroom/clients');
  if (r.ok) revalidatePath('/crm');
  return r;
}

/**
 * Que MaKo asigne lo evidente. Devuelve cuántas y por qué vía, porque son dos cosas
 * distintas: lo del nombre es un hecho y lo de la IA es un juicio.
 */
export async function autoasignarAction(): Promise<
  { ok: true; porNombre: number; porIA: number; consultadas: number; sinRespuesta: number } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const r = await autoasignar();
    if (r.ok) revalidatePath('/classroom/clients');
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
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
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

    revalidatePath('/classroom/clients');
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
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
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
    // ⚠️ CON HISTORIAL (06/10/2026): «es importante que se registre historial en los
    // clientes de Customer Success». Esto escribía `leads` a pelo, así que renombrar a un
    // cliente desde su ficha no dejaba rastro en la tab Historial — que es la MISMA del CRM
    // (`AuditHistory`). Va el mismo `logLeadChanges` que usa la ficha del CRM, con el
    // antes y el después leídos, nunca supuestos.
    const antes = await getLead(leadId).catch(() => null);
    const { data, error } = await db.from('leads').update(upd).eq('id', leadId)
      .select('nombre, empresa').single();
    if (error) return { ok: false, error: error.message };
    const despues = await getLead(leadId).catch(() => null);
    await logLeadChanges(leadId, antes, despues, await autorActual()).catch(() => {});

    revalidatePath('/classroom/clients');
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
 * ⚠️ DESDE EL 17/10/2026 ES UN ENVOLTORIO de `abrirCuentaDePartner` (lib/partners.ts): las cuentas de los clientes de
 * una agencia viven en MaKo Partners, y abrir una es UNA implementación (con sus reglas: el email obligatorio, nace
 * 'pendiente', el email ya usado se mira antes de crear, sin rollback dicho, el link del primer mes). Ésta sigue para el
 * control de la ficha de Clients, que hoy no se dibuja (Clients ya no lee la cartera: app/customer-success/pantalla.tsx)
 * y se borra con la T3 del CRM. Lo único propio de acá es que el lead sea un CLIENTE (ganado) de este workspace.
 */
export async function crearCuentaMakoAction(leadId: number, email: string): Promise<
  { ok: true; clienteWs: number; estado: string; link: string | null; sinLink: string | null } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const agenciaWs = await adminDeWorkspaceActual();
    if (!agenciaWs) return { ok: false, error: 'Sólo el admin de la cuenta puede abrirle una cuenta a un cliente.' };
    const cliente = await clienteDelWorkspace(leadId);
    if (!cliente) return { ok: false, error: 'Ese cliente no es de este workspace.' };
    const pagador = await getUsuarioActual().then((u) => u?.email ?? null).catch(() => null);
    const r = await abrirCuentaDePartner({ agenciaWs, nombre: cliente.nombre.trim() || `Cliente ${leadId}`, email, leadId, pagador });
    if (!r.ok) return { ok: false, error: r.error };
    revalidatePath('/classroom/clients');
    revalidatePath('/agency');
    return { ok: true, clienteWs: r.clienteWs, estado: 'pendiente', link: r.link, sinLink: r.sinLink };
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
export async function moverEntregaAction(leadId: number, productoId: number, etapa: string | null, relojPrevio?: string | null): Promise<
  { ok: true; desde: string | null; relojPrevio: string | null; hacia: string; rotulo: string; producto: string; cambio: boolean } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!(await clienteDelWorkspace(leadId))) return { ok: false, error: 'Ese cliente no es tuyo.' };
    // `relojPrevio` sólo lo manda el DESHACER: el reloj que la fila tenía antes. `por`
    // firma la línea del Historial con quien lo movió (sin esto, el choke point firma «CRM»).
    const por = await autorActual();
    const m = await moverClienteDeEtapa({ leadId, productoId, etapa, relojPrevio, por });
    if (!m.ok) return { ok: false, error: m.motivo ?? 'No se pudo mover.' };
    // ⚠️ SÓLO SE REVALIDA SI ALGO CAMBIÓ. Un movimiento idempotente que igual
    // revalida tira las 78 KB del trabajo de la cartera por un gesto que no movió nada.
    if (m.cambio) revalidatePath('/classroom/clients');
    return { ok: true, desde: m.desde, relojPrevio: m.relojPrevio, hacia: m.hacia, rotulo: m.rotulo, producto: m.producto, cambio: m.cambio };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo mover.' };
  }
}

/**
 * Mueve VARIOS clientes en la entrega de un servicio: la acción en lote, el arrastre
 * de una selección y su deshacer.
 *
 * Cada movimiento trae su destino: `etapa: null` es «volver al estado derivado» (borrar
 * la fila), que es lo único que deshace el PRIMER movimiento de un cliente que nunca se
 * había movido — escribirle la primera etapa le inventaría una fila y un reloj de etapa
 * que arranca hoy.
 *
 * ⚠️ UNA SOLA LLAMADA, NO N. Desde la pantalla, N server actions se encolan de a una
 * (Next las despacha en serie, medido: ver AGENTS.md «los server actions se encolan»), y
 * un lote de doce serían doce viajes. Acá adentro el orden es el mismo choke point de
 * siempre, uno por cliente: no hay una segunda forma de escribir `cliente_entrega`.
 *
 * Devuelve cada resultado por separado: un lote puede salir a medias, y el deshacer
 * tiene que reponer exactamente los que se movieron, no todos.
 */
export async function moverEntregaLoteAction(productoId: number, movs: Array<{ leadId: number; etapa: string | null; relojPrevio?: string | null }>): Promise<
  { ok: true; resultados: Array<{ leadId: number; ok: boolean; desde: string | null; relojPrevio?: string | null; hacia: string | null; cambio: boolean; error?: string }> } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const ids = [...new Set(movs.map((m) => Number(m.leadId)).filter((n) => Number.isFinite(n) && n > 0))];
    if (!ids.length) return { ok: true, resultados: [] };
    // ⚠️ LA PERTENENCIA SE PREGUNTA PARA TODOS EN UNA CONSULTA, y fail-closed: el que no
    // es un cliente de ESTE workspace no se mueve, aunque el resto sí.
    const db = await getTenantDb();
    const { data, error } = await db.from('leads').select('id').in('id', ids).eq('estado_lead', 'ganado');
    if (error) return { ok: false, error: `No pude verificar los clientes: ${error.message}` };
    const mios = new Set(((data ?? []) as Array<{ id: number }>).map((r) => Number(r.id)));
    const resultados: Array<{ leadId: number; ok: boolean; desde: string | null; relojPrevio?: string | null; hacia: string | null; cambio: boolean; error?: string }> = [];
    let alguno = false;
    // Quién firma, UNA vez para todo el lote: es la misma persona en los doce movimientos.
    const por = await autorActual();
    for (const m of movs) {
      const leadId = Number(m.leadId);
      if (!mios.has(leadId)) { resultados.push({ leadId, ok: false, desde: null, hacia: null, cambio: false, error: 'Ese cliente no es tuyo.' }); continue; }
      if (m.etapa === null) {
        const r = await sacarClienteDeEntrega(leadId, productoId, por);
        if (!r.ok) { resultados.push({ leadId, ok: false, desde: null, hacia: null, cambio: false, error: r.motivo ?? 'No se pudo deshacer.' }); continue; }
        alguno = true;
        resultados.push({ leadId, ok: true, desde: r.etapa, hacia: null, cambio: true });
        continue;
      }
      const r = await moverClienteDeEtapa({ leadId, productoId, etapa: m.etapa, relojPrevio: m.relojPrevio, por });
      if (!r.ok) { resultados.push({ leadId, ok: false, desde: null, hacia: null, cambio: false, error: r.motivo ?? 'No se pudo mover.' }); continue; }
      if (r.cambio) alguno = true;
      resultados.push({ leadId, ok: true, desde: r.desde, relojPrevio: r.relojPrevio, hacia: r.hacia, cambio: r.cambio });
    }
    if (alguno) revalidatePath('/classroom/clients');
    return { ok: true, resultados };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo mover.' };
  }
}

/** Saca a un cliente de la entrega de un servicio, devolviendo la etapa que tenía
 *  para que el deshacer lo reponga DONDE ESTABA. */
export async function sacarDeEntregaAction(leadId: number, productoId: number): Promise<
  { ok: true; etapa: string | null } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!(await clienteDelWorkspace(leadId))) return { ok: false, error: 'Ese cliente no es tuyo.' };
    const r = await sacarClienteDeEntrega(leadId, productoId, await autorActual());
    if (!r.ok) return { ok: false, error: r.motivo ?? 'No se pudo sacar de la entrega.' };
    revalidatePath('/classroom/clients');
    return { ok: true, etapa: r.etapa };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo sacar de la entrega.' };
  }
}

/**
 * «Quitar de este producto» (06/10/2026): «solo para los leads que estén en más de 1
 * producto».
 *
 * Dos caminos según CÓMO es de ese producto (app/customer-success/pertenencia.ts):
 *   · por una FILA de entrega → se borra la fila (`sacarClienteDeEntrega`, con su historial);
 *   · porque es su CASA (el embudo del CRM) → la casa se deriva y no hay nada que borrar, así
 *     que se escribe en `cliente_entrega_fuera` (mig 0196). Si además tenía fila, se borra.
 *
 * ⚠️ EL SERVER VUELVE A CONTAR los productos con la misma regla que la pantalla
 * (`productosDelCliente`): con uno solo, sacarlo lo dejaría en ningún tablero — que es lo que
 * el pedido excluye. Esconder el botón no protege nada.
 *
 * Devuelve lo necesario para DESHACER: la etapa y el reloj de la fila que había, y si era su
 * casa. Deshacer sin el reloj volvería a arrancarlo hoy (ver `relojDeVuelta`).
 */
export async function quitarDeProductoAction(leadId: number, productoId: number): Promise<
  { ok: true; eraCasa: boolean; etapa: string | null; reloj: string | null } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!(await clienteDelWorkspace(leadId))) return { ok: false, error: 'Ese cliente no es tuyo.' };
    // La regla (dos o más productos, la casa contra la fila) vive en lib/cs-quitar-producto.ts desde el
    // 23/10/2026: la usa también la API de MaKo (quitar_cliente_de_servicio).
    const r = await quitarClienteDeProducto(leadId, productoId, await autorActual());
    if (!r.ok) return r;
    revalidatePath('/classroom/clients');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo quitar.' };
  }
}

/**
 * El DESHACER de «Quitar de este producto»: lo devuelve como estaba. Si era su casa se borra
 * la marca de «fuera»; si tenía fila, se repone con su etapa y SU reloj.
 */
export async function volverAProductoAction(leadId: number, productoId: number, etapa: string | null, reloj: string | null): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!(await clienteDelWorkspace(leadId))) return { ok: false, error: 'Ese cliente no es tuyo.' };
    const r = await volverClienteAProducto(leadId, productoId, etapa, reloj, await autorActual());
    if (!r.ok) return r;
    revalidatePath('/classroom/clients');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo devolver.' };
  }
}

/**
 * El ORDEN MANUAL de una columna del kanban (mig 0196): «se guarda + Manual» (06/10/2026).
 *
 * Recibe la LISTA ENTERA de la columna, no un cambio: un orden no se puede expresar como
 * «movelo uno más abajo» si otra pestaña movió a otro en el medio. La arma la pantalla con
 * TODOS los clientes de esa columna —también los que un filtro esconde—, así reordenar con
 * una búsqueda puesta no los manda al final.
 *
 * ⚠️ SÓLO CLIENTES DE ESTE WORKSPACE y una etapa que el producto tiene: los ids viajan desde
 * el navegador. Lo que no pasa se descarta en silencio (un id ajeno no es un error de quien
 * arrastra: es un id que no tiene por qué estar).
 */
export async function ordenarEtapaAction(productoId: number, etapa: string, leadIds: number[]): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!Number.isFinite(productoId) || productoId <= 0 || typeof etapa !== 'string' || !etapa) return { ok: false, error: 'Falta la columna.' };
    const pedidos = [...new Set((Array.isArray(leadIds) ? leadIds : []).map(Number).filter((n) => Number.isFinite(n) && n > 0))].slice(0, 2000);
    const entrega = await entregaDeProducto(productoId);
    if (!entrega.etapas.some((e) => e.key === etapa)) return { ok: false, error: 'Esa etapa ya no existe.' };
    const db = await getTenantDb();
    const { data: prods, error: errProd } = await db.from('productos').select('id').eq('id', productoId).limit(1);
    if (errProd) return { ok: false, error: errProd.message };
    if (!(prods ?? []).length) return { ok: false, error: 'Ese producto no es tuyo.' };
    let validos: number[] = [];
    if (pedidos.length) {
      const { data, error } = await db.from('leads').select('id').in('id', pedidos).eq('estado_lead', 'ganado');
      if (error) return { ok: false, error: error.message };
      const ok = new Set(((data ?? []) as Array<{ id: number }>).map((l) => Number(l.id)));
      validos = pedidos.filter((id) => ok.has(id));
    }
    const { error } = await db.from('cliente_entrega_orden').upsert(
      [{ producto_id: productoId, etapa, lead_ids: validos, updated_at: new Date().toISOString() }],
      { onConflict: 'workspace_id,producto_id,etapa' },
    );
    if (error) return { ok: false, error: error.message };
    revalidatePath('/classroom/clients');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar el orden.' };
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
 *
 * ⚠️ Y EL PRODUCTO TIENE QUE SER DE ESTE WORKSPACE, con la misma lectura que
 * `ordenarEtapaAction`. `guardarEtapasEntrega` hace upsert con el workspace propio
 * estampado, así que un `productoId` ajeno no cruzaba datos: dejaba una fila de catálogo
 * basura colgando de un producto que no es suyo. Se rebota antes de escribir.
 */
export async function guardarEtapasEntregaAction(
  productoId: number,
  etapas: EtapaEntrega[],
  /** Sin default: ver el porqué en `guardarEtapasEntrega`. */
  fases: FaseEntrega[],
): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!(await adminDeWorkspaceActual())) return { ok: false, error: 'Sólo un administrador puede cambiar las etapas de un servicio.' };
    if (!Number.isFinite(productoId) || productoId <= 0) return { ok: false, error: 'Falta el producto.' };
    const db = await getTenantDb();
    const { data: prods, error: errProd } = await db.from('productos').select('id').eq('id', productoId).limit(1);
    if (errProd) return { ok: false, error: errProd.message };
    if (!(prods ?? []).length) return { ok: false, error: 'Ese producto no es tuyo.' };
    const ok = await guardarEtapasEntrega(productoId, etapas, fases);
    if (!ok) return { ok: false, error: 'Esas etapas no se pudieron guardar. Revisa que ninguna quede sin nombre.' };
    revalidatePath('/classroom/clients');
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
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!(await adminDeWorkspaceActual())) return { ok: false, error: 'Sólo un administrador puede crear un producto.' };
    const { productoId } = await crearProductoConFunnel(nombre);
    revalidatePath('/classroom/clients');
    revalidatePath('/crm');
    return { ok: true, productoId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo crear el producto.' };
  }
}

/**
 * Renombra un PRODUCTO desde el editor de etapas.
 *
 * ⚠️ HASTA EL 13/10/2026 ERA «SE DEBE CAMBIAR EN TODOS LADOS, EN EL CRM Y AQUÍ. Y VICEVERSA»
 * (Martín, 05/10/2026), y por eso iba por `renombrarFunnel`. Martín lo revirtió el 13/10:
 * «desvincula lo que hace que se ponga automáticamente el nombre de ese CRM al nombre de un
 * curso». Ahora el CRM y el producto tienen cada uno su nombre, y acá se escribe el producto
 * por `renombrarProducto` (lib/funnels.ts), con el mismo saneo y el mismo tope que el CRM.
 */
export async function renombrarServicioAction(productoId: number, nombreCrudo: string): Promise<
  { ok: true; nombre: string } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!(await adminDeWorkspaceActual())) return { ok: false, error: 'Sólo un administrador puede renombrar un producto.' };
    const nombre = String(nombreCrudo ?? '').trim().replace(/\s+/g, ' ');
    if (!nombre) return { ok: false, error: 'El producto necesita un nombre.' };
    if (nombre.length > 60) return { ok: false, error: 'El nombre no puede pasar de 60 caracteres.' };
    // ⚠️ DESDE EL 13/10/2026 SE RENOMBRA EL PRODUCTO, NUNCA EL CRM. Martín revirtió el «en todos
    // lados» de arriba: «desvincula lo que hace que se ponga automáticamente el nombre de ese
    // CRM al nombre de un curso». El CRM tiene nombre propio (lib/funnels.ts → renombrarFunnel).
    await renombrarProducto(productoId, nombre);
    revalidatePath('/classroom/clients');
    revalidatePath('/crm');
    return { ok: true, nombre };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo renombrar.' };
  }
}

/**
 * «Eliminar» un producto desde el editor de etapas: lo MISMO que el «Eliminar» del CRM.
 *
 * ⚠️ ARCHIVA, NO BORRA. En el CRM eliminar un producto archiva su embudo y queda en
 * «Productos eliminados» para recuperarlo; acá hace exactamente eso (`archivarFunnel`, el
 * mismo de allá, con su guarda de que el embudo principal no se archiva). Un producto sin
 * embudo no tiene «Productos eliminados» donde aparecer, así que se da de baja con
 * `activo = false` — que es lo que el catálogo de productos ya entiende por baja.
 * Las filas de `cliente_entrega` NO se tocan: el histórico del cliente dice lo que pasó.
 */
export async function eliminarServicioAction(productoId: number): Promise<
  { ok: true; deshacer: DeshacerEliminar | null } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!(await adminDeWorkspaceActual())) return { ok: false, error: 'Sólo un administrador puede eliminar un producto.' };
    // La decisión (archivar sus embudos, darlo de baja, o nada) y su escritura: ./programa-datos.ts (la usa también la
    // API de MaKo), con la regla pura en ./eliminar-programa.ts.
    const r = await eliminarPrograma(productoId);
    if (!r.ok) return r;
    revalidatePath('/classroom/clients');
    revalidatePath('/crm');
    // `deshacer`: lo que se hizo, para el «Deshacer» de la cabecera de Clients (`restaurarServicioAction`).
    return { ok: true, deshacer: r.deshacer };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo eliminar.' };
  }
}

/**
 * Lo que la cabecera de Clients necesita para preguntar antes de eliminar un programa (f25, 24/10/2026): cuántos
 * ALUMNOS lo ven (los miembros de su comunidad, la misma regla que el portal: `miembrosDeLaComunidad`) y cuántas clases
 * tiene. Sin ninguno de los dos no se pregunta (./eliminar-programa.ts). Sólo un admin.
 */
export async function previaEliminarServicioAction(productoId: number): Promise<
  { ok: true; alumnos: number; clases: number } | { ok: false; error: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const ws = await adminDeWorkspaceActual();
    if (!ws) return { ok: false, error: 'Sólo un administrador puede eliminar un producto.' };
    const [{ miembrosDeLaComunidad }, { clasesDelProducto }] = await Promise.all([
      import('@/lib/comunidad-datos'), import('@/lib/curso-datos'),
    ]);
    const [comunidad, clases] = await Promise.all([miembrosDeLaComunidad(ws, productoId), clasesDelProducto(productoId)]);
    return { ok: true, alumnos: comunidad.alumnos.size, clases: clases.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude contar sus alumnos.' };
  }
}

/**
 * El «Deshacer» de eliminar un programa: lo INVERSO EXACTO de lo que hizo `eliminarServicioAction` (sus embudos
 * vuelven a la lista, o vuelve a estar de alta). Los embudos tienen que ser de ESE producto (`deshacerValido`): el
 * «Deshacer» viaja por el navegador.
 */
export async function restaurarServicioAction(productoId: number, deshacer: DeshacerEliminar): Promise<{ ok: true } | { ok: false; error: string }> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    if (!(await adminDeWorkspaceActual())) return { ok: false, error: 'Sólo un administrador puede restaurar un producto.' };
    const r = await restaurarPrograma(productoId, deshacer);
    if (!r.ok) return r;
    revalidatePath('/classroom/clients');
    revalidatePath('/crm');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo restaurar.' };
  }
}

/**
 * DUPLICAR un programa (25/10/2026, Martín por el Cerebro: «curso, módulos, clases y su configuración; nunca los alumnos
 * ni su progreso»). Lo hace lib/curso-duplicar.ts; acá, la puerta (un admin) y el «Deshacer»: `deshacer` es lo que
 * archiva la copia (`eliminarServicioAction` sobre el producto nuevo), como cualquier programa.
 */
export async function duplicarServicioAction(productoId: number): Promise<
  { ok: true; copia: ProgramaDuplicado } | { ok: false; error: string; pasarAPro?: string }
> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const ws = await adminDeWorkspaceActual();
    if (!ws) return { ok: false, error: 'Sólo un administrador puede duplicar un producto.' };
    // La copia de un programa con clases es un CURSO más, y MaKo Esencial tiene uno (14/11/2026, lib/tope-cursos.ts).
    const tope = await frenoAlDuplicar(ws, Number(productoId));
    if (tope) return { ok: false, error: tope.texto, pasarAPro: await rutaConWs(RUTA_CAMBIAR_PLAN) };
    const sesion = await getUsuarioActual();
    const r = await duplicarPrograma(ws, productoId, sesion?.nombre || sesion?.email || null);
    if (!r.ok) return r;
    revalidatePath('/classroom/clients');
    revalidatePath('/crm');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo duplicar.' };
  }
}

/**
 * El ENSAYO del onboarding de la tab (#109): alguien abrió la ficha de un cliente. Es el único
 * paso que no se puede leer de la base —abrir una ficha no escribe nada—, así que lo anota la
 * pantalla la primera vez que pasa (ClientesApp, y sólo si el paso no estaba hecho).
 *
 * Cualquiera con la tab lo cierra, no sólo un admin: el onboarding prueba que la TAB funciona, y
 * un closer abriendo la ficha de su cliente lo prueba igual. No revalida la página: la lista se
 * actualiza en el navegador, y pedir el RSC de la cartera entera por un tilde sería el «Leyendo lo
 * suyo» que esta pantalla ya se sacó de encima.
 */
export async function anotarFichaAbiertaAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const o = await anotarFichaAbierta();
    // `o` es lo que se DIBUJA (./onboarding-clientes-sync.ts): con el paso bloqueado por el orden
    // (sin servicio todavía) igual vuelve `cs_ficha: true`, porque abrir la ficha ya pasó. `null` =
    // no se pudo leer lo anotado. Antes esto devolvía «Antes falta tu servicio.» y la lista seguía
    // pidiendo abrir una ficha que la persona tenía abierta en la cara.
    return o ? { ok: true } : { ok: false, error: 'No se pudo anotar.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo anotar.' };
  }
}
