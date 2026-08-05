import 'server-only';

// =============================================================================
// reunion-destinatarios — las tareas de OTRO se le mandan a ESE otro
// =============================================================================
// De una reunión salen compromisos que no son tuyos. Antes se bajaban como .md y
// ahí morían: el que tenía que hacerlos nunca se enteraba. Acá vive el reparto:
//
//   1) RESOLVER   — de un email de la reunión a una persona: ¿tiene cuenta en la
//                   app?, ¿en qué workspace?, ¿tenemos su teléfono?
//   2) MANDAR     — sus tareas por WhatsApp y/o por mail (Resend). El WhatsApp
//                   sale del NÚMERO DEL WORKSPACE que manda, no del de MaKo: el
//                   que recibe es del equipo de esa persona y la tiene agendada.
//   3) CARGAR     — si tiene cuenta, dejarle el BORRADOR en SU plan: la próxima vez
//                   que entra ve "Martín te envió estas tareas de la reunión…" y
//                   las confirma. Nunca se le escriben tareas a ciegas en su tablero.
//
// REGLA DE AISLAMIENTO: lo único que cruza de un workspace a otro es un BORRADOR
// PENDIENTE, y solo hacia alguien que ESTUVO EN LA REUNIÓN (esa lista blanca la
// aplica /api/plan-reunion contra los participantes de la grabación). Nunca se
// escriben tareas en el tablero de otro: las crea esa persona al confirmarlas, en su
// propio workspace y con su propio Perro. Sin la lista blanca esto sería un caño para
// empujarle cosas al tablero de cualquiera.
// =============================================================================

import { buscarUsuarioPorEmail, buscarUsuarioPorNombre, telefonoDeUsuario, emailDuenoWorkspace, type Usuario } from './usuarios';
import { getUsuarioActual } from './auth';
import { estaImpersonando, getWorkspaceActual } from './workspace';
import { findLeadByContacto } from './leads';
import { enviarAPersonaMaKo } from './mako-grupo';
import { enviarTexto } from './evolution';
import { sendEmail } from './resend';
import { crearPropuesta, type PropuestaTarea } from './plan-propuesta';
import { APP_BASE_URL as APP_URL } from './app-url';

/** Una tarea que se le reparte a alguien (lo mínimo que viaja del modal al server).
 *  `minuto`/`minutos` viajan para que la tarjeta que le queda a la otra persona abra
 *  la grabación en el momento en que ella asumió el compromiso: sin eso recibe una
 *  frase suelta y tiene que buscar el contexto a mano en dos horas de video. */
export type TareaDeOtro = { titulo: string; detalle?: string; prioridad?: string; proyecto?: string; minuto?: number; minutos?: number[] };

/** La reunión de la que salieron (para el encabezado del mensaje). */
export type ReunionRef = { titulo: string; fecha?: string | null; url?: string | null };

export type Destinatario = {
  email: string;
  nombre: string;
  /** tiene cuenta en la app (y está activa). */
  registrado: boolean;
  /** workspace de su cuenta (null = admin de plataforma sin workspace propio). */
  workspaceId: number | null;
  /** teléfono para WhatsApp (perfil de su cuenta, o el del lead si es un contacto del CRM). */
  telefono: string;
  /** ¿se le puede dejar el borrador en SU plan? (cuenta activa con workspace propio). */
  puedeCargarPlan: boolean;
  /** sos VOS mismo mirando el tablero de otro: el destino es tu propio plan. */
  esVos?: boolean;
};

const nombreDe = (u: Usuario | null, fallbackNombre: string, email: string): string =>
  (u?.nombre || fallbackNombre || email.split('@')[0] || '').trim();

/**
 * Resuelve a quién le podemos mandar qué. `personas` viene de los invitados de la
 * reunión (email + nombre que dijo el calendario).
 */
export async function resolverDestinatarios(personas: Array<{ email: string; nombre?: string }>): Promise<Destinatario[]> {
  const sesion = await getUsuarioActual();
  // De quién es el TABLERO que se está mirando. No es lo mismo que quién está
  // logueado: cuando un admin impersona a un cliente, el board de la pantalla es el
  // del cliente. Excluir siempre al de la sesión dejaba al admin fuera de la lista de
  // destinatarios, así que desde la vista de un cliente NO podía mandarse a su propio
  // plan los compromisos que él mismo asumió en la reunión — que es justo el caso más
  // común, porque el que revisa la reunión del cliente es él.
  const impersonando = await estaImpersonando().catch(() => false);
  const dueno = impersonando ? await emailDuenoWorkspace(await getWorkspaceActual().catch(() => null)).catch(() => '') : '';
  const miEmail = (dueno || sesion?.email || '').trim().toLowerCase();

  const out: Destinatario[] = [];
  const vistos = new Set<string>();
  for (const p of personas) {
    let email = (p.email ?? '').trim().toLowerCase();
    // SIN EMAIL, POR NOMBRE. Media agenda son Meets improvisados: sin evento de
    // calendario Fathom no devuelve invitados, y de la reunión solo queda el nombre con
    // el que la persona habla en la transcripción. Sin esto, MaKo repartía 30 tareas a
    // "Mauricio" y después no había forma de mandárselas: el botón no se dibujaba y no
    // se decía por qué. Solo entra si el nombre matchea a UN usuario de la app.
    if (!email && (p.nombre ?? '').trim()) {
      const u = await buscarUsuarioPorNombre(p.nombre!).catch(() => null);
      if (u?.email) email = u.email.trim().toLowerCase();
    }
    if (!email || email === miEmail || vistos.has(email)) continue;
    vistos.add(email);

    const usuario = await buscarUsuarioPorEmail(email).catch(() => null);
    const activo = !!usuario && usuario.estado !== 'suspendido';
    // Teléfono: primero el de SU cuenta; si no tiene, el del contacto en MI CRM
    // (tenant-scopeado: nunca ve el CRM de otro cliente).
    let telefono = usuario ? await telefonoDeUsuario(email).catch(() => '') : '';
    if (!telefono) {
      const lead = await findLeadByContacto(email, null).catch(() => null);
      telefono = (lead?.telefono ?? '').trim();
    }
    out.push({
      email,
      nombre: nombreDe(usuario, p.nombre ?? '', email),
      registrado: activo,
      workspaceId: usuario?.workspace_id ?? null,
      telefono,
      // Alcanza con que tenga cuenta activa y tablero propio: lo que se le deja es un
      // borrador que ELLA confirma, y el candado de "estuvo en la reunión" ya lo aplicó
      // la ruta. Un admin de plataforma sin workspace propio no tiene dónde recibirlo.
      puedeCargarPlan: activo && usuario?.workspace_id != null,
    });
  }

  // VOS MISMO, cuando mirás el tablero de otro. No es "reparto" —no le mandás nada a
  // nadie—, es llevar a TU plan lo que vos asumiste en la reunión del cliente. Faltaba
  // por dos motivos a la vez: el bucle de arriba excluye a quien mira la pantalla, y
  // encima la grabación del cliente suele traer solo al cliente entre sus invitados,
  // así que tu email no estaba ni en la lista. Sin esto, el modal mostraba tus 17
  // compromisos con un "mandáselo" que no tenía a quién mandárselos.
  if (impersonando && sesion?.email) {
    const yo = sesion.email.trim().toLowerCase();
    if (yo && yo !== miEmail && !vistos.has(yo)) {
      const u = await buscarUsuarioPorEmail(yo).catch(() => null);
      if (u && u.estado !== 'suspendido' && u.workspace_id != null) {
        out.push({
          email: yo, nombre: nombreDe(u, sesion.nombre ?? '', yo), registrado: true,
          workspaceId: u.workspace_id, telefono: await telefonoDeUsuario(yo).catch(() => ''),
          puedeCargarPlan: true, esVos: true,
        });
      }
    }
  }
  return out;
}

// ── Redacción (un solo texto para las tres salidas) ──────────────────────────

const fechaLinda = (iso?: string | null): string => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return ''; }
};

/** Lista de tareas en markdown — lo que se baja como .md y lo que va al WhatsApp. */
export function tareasComoMarkdown(nombre: string, tareas: TareaDeOtro[], reunion: ReunionRef): string {
  const f = fechaLinda(reunion.fecha);
  return [
    `# Tus tareas de la reunión${reunion.titulo ? ` «${reunion.titulo}»` : ''}`,
    f ? `_${f}_` : '',
    nombre ? `\nPara: **${nombre}**` : '',
    '',
    ...tareas.map((t) => `- [ ] **${t.titulo}**${t.detalle ? `\n  ${t.detalle}` : ''}`),
    reunion.url ? `\n\nGrabación: ${reunion.url}` : '',
  ].filter((l) => l !== '').join('\n');
}

function textoWhatsapp(de: string, nombre: string, tareas: TareaDeOtro[], reunion: ReunionRef, link?: string): string {
  const f = fechaLinda(reunion.fecha);
  const cab = `${nombre ? `Hola ${nombre.split(' ')[0]}! ` : ''}De la reunión${reunion.titulo ? ` *${reunion.titulo}*` : ''}${f ? ` del ${f}` : ''}${de ? ` con ${de}` : ''} quedaron ${tareas.length === 1 ? 'estas cosas' : `estas *${tareas.length}* cosas`} de tu lado:`;
  const lista = tareas.map((t, i) => `${i + 1}. *${t.titulo}*${t.detalle ? `\n   ${t.detalle}` : ''}`).join('\n');
  const pie = link ? `\n\nTe las dejé cargadas en tu plan para que las confirmes: ${link}` : '';
  return `📝 ${cab}\n\n${lista}${pie}\n\n— MaKo`;
}

function htmlEmail(de: string, nombre: string, tareas: TareaDeOtro[], reunion: ReunionRef, link?: string): string {
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] ?? c));
  const f = fechaLinda(reunion.fecha);
  const items = tareas.map((t) => `<li style="margin:0 0 12px"><b>${esc(t.titulo)}</b>${t.detalle ? `<br><span style="color:#5b6472">${esc(t.detalle)}</span>` : ''}</li>`).join('');
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#12151b;line-height:1.55">
    <p>${nombre ? `Hola ${esc(nombre.split(' ')[0])},` : 'Hola,'}</p>
    <p>De la reunión${reunion.titulo ? ` <b>${esc(reunion.titulo)}</b>` : ''}${f ? ` del ${f}` : ''}${de ? ` con ${esc(de)}` : ''} quedaron estas tareas de tu lado:</p>
    <ol>${items}</ol>
    ${link ? `<p><a href="${esc(link)}" style="display:inline-block;padding:10px 18px;border-radius:9px;background:#2F6FED;color:#fff;text-decoration:none;font-weight:600">Confirmarlas en tu plan</a></p>` : ''}
    ${reunion.url ? `<p style="font-size:13px;color:#5b6472">Grabación de la reunión: <a href="${esc(reunion.url)}">${esc(reunion.url)}</a></p>` : ''}
    <p style="font-size:13px;color:#8a93a1">— MaKo</p>
  </div>`;
}

// ── Acciones ────────────────────────────────────────────────────────────────

export type EnvioTareas = { wa?: { ok: boolean; error?: string }; email?: { ok: boolean; error?: string } };

/** Le manda a una persona SUS tareas por los canales pedidos. */
export async function enviarTareasAPersona(opts: {
  de: string; dest: Destinatario; tareas: TareaDeOtro[]; reunion: ReunionRef;
  canales: { wa?: boolean; email?: boolean }; telefono?: string; link?: string;
}): Promise<EnvioTareas> {
  const { de, dest, tareas, reunion, canales } = opts;
  const res: EnvioTareas = {};
  if (!tareas.length) return res;

  if (canales.wa) {
    const tel = (opts.telefono || dest.telefono || '').trim();
    if (!tel) res.wa = { ok: false, error: 'no tengo su número de WhatsApp' };
    else {
      const texto = textoWhatsapp(de, dest.nombre, tareas, reunion, opts.link);
      // SALE DEL NÚMERO DEL WORKSPACE, no del de MaKo.
      //
      // Este mensaje no es MaKo hablando: es el dueño de la cuenta mandándole a
      // SU equipo las tareas de SU reunión, y el que las recibe lo conoce a él.
      // Salía por `instanciaVoz()`, que es una sola para toda la plataforma (el
      // número de Martín): a un colaborador de otro cliente le llegaban sus
      // tareas desde un número desconocido, firmadas por alguien que no es su
      // jefe. Con `enviarTexto` sale por la instancia `mako_ws<id>` de quien
      // manda, que es el número que esa persona ya tiene agendado.
      const r = await enviarTexto(tel, texto);
      if (r.ok) res.wa = { ok: true };
      else {
        // El fallback existe para no perder el mensaje cuando el cliente todavía
        // no vinculó su número: ahí sale por MaKo, que es mejor que no salir. Se
        // avisa el motivo para que se entienda por qué llegó de otro número.
        const alt = await enviarAPersonaMaKo(tel, texto);
        res.wa = alt.ok
          ? { ok: true, error: 'salió desde el número de MaKo: este cliente todavía no tiene su WhatsApp vinculado' }
          : { ok: false, error: r.error };
      }
    }
  }
  if (canales.email) {
    const r = await sendEmail({
      to: dest.email,
      subject: `Tus tareas de la reunión${reunion.titulo ? ` «${reunion.titulo}»` : ''}`,
      html: htmlEmail(de, dest.nombre, tareas, reunion, opts.link),
      text: tareasComoMarkdown(dest.nombre, tareas, reunion),
      tags: [{ name: 'tipo', value: 'tareas-reunion' }],
    });
    res.email = r.ok ? { ok: true } : { ok: false, error: r.error };
  }
  return res;
}

/**
 * Deja el BORRADOR de esas tareas en el plan de la otra persona (su workspace). No
 * crea tareas: al entrar a su plan le salta el modal y ella confirma. Devuelve el
 * link a la revisión (sirve para el WhatsApp/mail que la avisa).
 */
export async function cargarTareasEnPlanDe(opts: {
  dest: Destinatario; de: string; tareas: TareaDeOtro[]; reunion: ReunionRef; ref?: string;
}): Promise<{ ok: boolean; id?: string; link?: string; error?: string }> {
  const { dest, de, tareas, reunion } = opts;
  if (!dest.puedeCargarPlan || dest.workspaceId == null) return { ok: false, error: 'Esa persona no tiene un plan al que pueda escribir.' };
  if (!tareas.length) return { ok: false, error: 'No hay tareas para mandar.' };

  const propuestas: PropuestaTarea[] = tareas.map((t) => ({
    titulo: t.titulo,
    detalle: t.detalle,
    proyecto: t.proyecto,
    prioridad: (['alta', 'media', 'baja', 'futuro'].includes(String(t.prioridad)) ? t.prioridad : undefined) as PropuestaTarea['prioridad'],
    minuto: t.minuto,
    minutos: t.minutos,
  }));
  const f = fechaLinda(reunion.fecha);
  const id = await crearPropuesta({
    ws: dest.workspaceId,
    tareas: propuestas,
    origen: 'fathom',
    enviadoPor: de,
    fuenteTitulo: reunion.titulo,
    fuenteUrl: reunion.url ?? undefined,
    ref: opts.ref,
    resumen: `${de || 'Alguien'} te mandó ${tareas.length} ${tareas.length === 1 ? 'tarea' : 'tareas'} de la reunión${reunion.titulo ? ` «${reunion.titulo}»` : ''}${f ? ` del ${f}` : ''}.`,
  });
  return { ok: true, id, link: `${APP_URL}/plan/revisar/${id}` };
}
