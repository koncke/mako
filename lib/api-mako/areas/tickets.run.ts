// =============================================================================
// api-mako/areas/tickets.run — los cuerpos de levantar_ticket y mis_tickets (área `mako`)
// =============================================================================
// Todo lo escribe lib/tickets-db.ts; acá se arma lo que viaja.
//
// ⚠️ EL CONTEXTO NO SALE DEL MODELO. `preparar()` lo junta de tres lugares que el modelo no escribe:
//   · el TURNO (`ctx.contextoTicket`): lo que pidió la persona, lo que contestó MaKo y los errores que registró el código
//     al correr las herramientas de ESE turno (lib/mako-turno-app.ts);
//   · el PEDIDO HTTP en curso (`headers()`): el navegador y la pantalla desde donde escribió;
//   · la sesión del chat (`ctx.canalKey`): a qué hilo se le avisa cuando se resuelva.
// ⚠️ QUIÉN LO LEVANTA se fija al PROPONER (`quienPideElTicket`: el actor del chat, o la persona del token detallado por HTTP), no
// al confirmar: si lo confirma el admin desde la bandeja de pendientes, el ticket sigue siendo de quien lo pidió. Lo que propone
// un token CLÁSICO por HTTP no trae a nadie (10/11/2026): lo firma quien lo confirma en la bandeja, y por HTTP mismo no se
// confirma (`faltaParaConfirmar`), porque ahí tampoco hay nadie.
// ⚠️ ejecutar() no lanza nunca: `seguro()`.
// =============================================================================

import 'server-only';
import type { Ctx, Ejecutado, Runners, SalidaLectura } from '../tipos';
import { PREFIJO_APP } from '../canal';
import { comentarComoCliente, crearTicket, identidadDelActor, misTickets, ticketDeLaCuenta, ticketsDeLaCuenta } from '@/lib/tickets-db';
import { ROTULO_ESTADO_CLIENTE, estadoParaElCliente, sanearAlta, sanearContexto, type Canal, type ContextoTicket } from '@/lib/tickets-reglas';
import { FILTROS_TICKETS, pasaElFiltro, queSigue, quienPideElTicket, ticketParaLaApi, type FiltroTickets } from '@/lib/tickets-api';

const json = (o: unknown): string => JSON.stringify(o);

async function seguro(que: string, fn: () => Promise<Ejecutado>): Promise<Ejecutado> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[api-mako tickets] ${que}:`, msg);
    return { ok: false, resumen: `No se pudo ${que}: vuelve a intentarlo.` };
  }
}

/** Un navegador de teléfono (la misma URL sirve las dos apps: AGENTS.md, «LAS MISMAS RUTAS»). */
const esTelefono = (ua: string) => /Mobi|Android|iPhone|iPad/i.test(ua);

/** Lo que dice el pedido HTTP en curso: el navegador y la pantalla (el `referer`, sólo si es de MaKo). Fuera de un
 *  pedido (un flujo, un cron) no hay, y no pasa nada. */
async function delPedido(): Promise<{ navegador?: string; ruta?: string }> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    const navegador = h.get('user-agent') ?? undefined;
    const ref = h.get('referer');
    const host = h.get('host');
    let ruta: string | undefined;
    if (ref && host) {
      const u = new URL(ref);
      if (u.host === host) ruta = `${u.pathname}${u.search}`;
    }
    return { navegador, ruta };
  } catch {
    return {};
  }
}

function canalDe(ctx: Ctx, navegador: string | undefined): Canal {
  if (ctx.canal === 'whatsapp') return 'whatsapp';
  if (ctx.canal === 'http') return 'api';
  return navegador && esTelefono(navegador) ? 'chat_movil' : 'chat_app';
}

/** Quién pide, ya buscado en la base. null = el canal no sabe quién es (un token clásico por HTTP) o el actor no se entiende. */
async function quienPide(ctx: Ctx) {
  const actor = quienPideElTicket(ctx);
  return actor ? identidadDelActor(ctx.ws, actor) : null;
}

/** Lo que se le dice a un token clásico que quiere hacer algo que alguien tiene que firmar. */
const SIN_QUIEN_FIRME = 'Por la API no sé quién eres (el token no trae el email de quien lo creó): confírmalo en la app, en /mako/pendientes, o usa un token detallado creado con tu usuario (en /api-mako).';

export const RUNNERS: Runners = {
  levantar_ticket: {
    preparar: async (input, ctx) => {
      // Un email (la app), `whatsapp:<teléfono>` (el doer de WhatsApp) o la persona del token detallado (HTTP): `quienPide`.
      const quien = await quienPide(ctx);
      // Un token clásico por HTTP: se propone igual y lo firma quien lo confirme en la bandeja (`faltaParaConfirmar`).
      const sinFirma = !quien && ctx.canal === 'http';
      if (!quien && !sinFirma) return { error: 'No sé quién eres: levántalo desde «Reportar problema», en el menú de tu perfil.' };
      const a = sanearAlta({ tipo: input.tipo, titulo: input.titulo, descripcion: input.descripcion });
      if (!a.ok) return { error: a.motivo };
      const pedido = await delPedido();
      const delTurno = ctx.contextoTicket?.() ?? {};
      const hilo = ctx.canalKey.startsWith(PREFIJO_APP) ? ctx.canalKey.slice(PREFIJO_APP.length) : ctx.canalKey;
      const contexto: ContextoTicket = sanearContexto({
        ...delTurno,
        ...(pedido.ruta ? { ruta: pedido.ruta } : {}),
        ...(pedido.navegador ? { navegador: pedido.navegador } : {}),
        // Por HTTP no hay un hilo al que avisarle: el aviso de «resuelto» es el estado en /tickets (lib/tickets-cierre.ts, canal `api`).
        ...(ctx.canal === 'http' ? {} : { chat: { donde: ctx.canal === 'whatsapp' ? 'whatsapp' : (pedido.ruta?.split(/[/?]/)[1] || 'chat'), hilo } }),
        hora: new Date().toISOString(),
        ...(input.noExiste === true ? { noExiste: true } : {}),
      });
      return {
        payload: {
          tipo: a.alta.tipo, titulo: a.alta.titulo, descripcion: a.alta.descripcion,
          ...(contexto.noExiste ? { noExiste: true } : {}),
          canal: canalDe(ctx, pedido.navegador), ...(quien ? { email: quien.email } : {}), contexto,
        },
        resumen: `Mandarle al equipo de MaKo: «${a.alta.titulo}»${sinFirma ? ' (lo firma quien lo confirme)' : ''}`,
      };
    },
    // Sin quien lo firme (lo propuso un token clásico) no se reclama: por HTTP no confirma nadie, en la bandeja sí.
    faltaParaConfirmar: async (p, ctx) => (typeof p.email === 'string' || quienPideElTicket(ctx) ? null : SIN_QUIEN_FIRME),
    ejecutar: async (p, ctx) => seguro('mandar el ticket', async () => {
      const identidad = typeof p.email === 'string' ? await identidadDelActor(ctx.ws, p.email) : await quienPide(ctx);
      if (!identidad) return { ok: false, resumen: 'No sé quién lo pidió: levántalo desde «Reportar problema».' };
      const r = await crearTicket({
        // Por HTTP el tipo lo eligió el Claude de la persona, no MaKo: pesa como el que marca la persona en el formulario.
        identidad, tipo: (p.tipo as never) ?? null, declaradoPor: p.canal === 'api' ? 'persona' : 'mako',
        titulo: String(p.titulo ?? ''), descripcion: String(p.descripcion ?? ''),
        canal: (p.canal as Canal) ?? 'chat_app', contexto: p.contexto,
      });
      if (!r.ok) return { ok: false, resumen: r.error };
      // Por la API no hay un «por aquí» donde avisar: el estado se pide con ver_ticket.
      const sigue = p.canal === 'api' ? queSigue(r.triage)
        : r.triage.autoArreglo
          ? 'Es algo que debería andar: ya está yendo a arreglarse, y te aviso por aquí cuando esté.'
          : 'Le llegó al equipo: te aviso por aquí cuando lo decidan.';
      const estado = estadoParaElCliente(r.estado);
      return {
        ok: true, resumen: `Listo, es el ticket #${r.id}. ${sigue}`,
        datos: {
          ticketId: r.id, numero: `#${r.id}`, estado, rotulo: ROTULO_ESTADO_CLIENTE[estado],
          aprobadoPorRegla: r.triage.autoArreglo && r.triage.regla ? r.triage.regla : null, yaExistia: r.yaExistia,
        },
      };
    }),
  },

  mis_tickets: {
    leer: async (_input, ctx): Promise<SalidaLectura> => {
      const quien = await quienPide(ctx);
      if (!quien && ctx.canal === 'http') return { content: 'Con este token no sé quién eres: los tickets de todo el negocio salen con listar_tickets (GET /api/v1/mako/tickets).', isError: true };
      if (!quien) return { content: json({ ok: false, error: 'No sé quién eres: tus tickets están en «Reportar problema», en el menú de tu perfil.' }), isError: true };
      const r = await misTickets(ctx.ws, quien.email);
      if (!r.ok) return { content: json({ ok: false, error: r.faltaTabla ? 'Los tickets todavía no están disponibles.' : 'No pude leer tus tickets ahora.' }), isError: !r.faltaTabla };
      return json({
        ok: true,
        tickets: r.datos.slice(0, 20).map((t) => ({
          numero: `#${t.id}`, titulo: t.titulo, estado: ROTULO_ESTADO_CLIENTE[estadoParaElCliente(t.estado)],
          respuesta_del_equipo: t.respuesta, levantado: t.created_at.slice(0, 10), actualizado: t.updated_at.slice(0, 10),
        })),
        total: r.datos.length,
      });
    },
  },
  // ── Sólo HTTP (10/11/2026): lo que necesita el Claude de la persona para seguir un ticket ──────────────────────────────
  listar_tickets: {
    leer: async (input, ctx): Promise<SalidaLectura> => {
      const filtro: FiltroTickets = (FILTROS_TICKETS as readonly string[]).includes(String(input.estado)) ? input.estado as FiltroTickets : 'todos';
      const r = await ticketsDeLaCuenta(ctx.ws);
      if (!r.ok) return { content: json({ ok: false, error: r.faltaTabla ? 'Los tickets todavía no están disponibles.' : 'No pude leer los tickets ahora.' }), isError: !r.faltaTabla };
      const quien = quienPideElTicket(ctx);
      const filas = r.datos.filter((t) => pasaElFiltro(t.estado, filtro));
      return json({ ok: true, filtro, total: filas.length, tickets: filas.slice(0, 50).map((t) => ticketParaLaApi(t, { emailDeQuienPide: quien })) });
    },
  },

  ver_ticket: {
    leer: async (input, ctx): Promise<SalidaLectura> => {
      const n = Number(input.numero);
      // Un 400 con el motivo (`isError`): sólo sale por HTTP, así que ningún chat lo toma por una falla de MaKo.
      if (!Number.isInteger(n) || n <= 0) return { content: 'Pasa el número del ticket (el 12 de «#12»).', isError: true };
      const r = await ticketDeLaCuenta(ctx.ws, n);
      if (!r) return { content: `No encuentro el ticket #${n} en este negocio: mira los que hay con listar_tickets.`, isError: true };
      return json({ ok: true, ticket: ticketParaLaApi(r.ticket, { eventos: r.eventos, conDetalle: true, emailDeQuienPide: quienPideElTicket(ctx) }) });
    },
  },

  responder_ticket: {
    preparar: async (input, ctx) => {
      const n = Number(input.numero);
      if (!Number.isInteger(n) || n <= 0) return { error: 'Pasa el número del ticket (el 12 de «#12»).' };
      const texto = String(input.texto ?? '').trim();
      if (!texto) return { error: 'Escribe lo que le dices al equipo.' };
      // Que exista, sea del negocio y no esté cerrado: se sabe sin escribir, así que falla acá y no consume la pendiente.
      const t = await ticketDeLaCuenta(ctx.ws, n);
      if (!t) return { error: `No encuentro el ticket #${n} en este negocio.` };
      if (['resuelto', 'rechazado', 'duplicado'].includes(t.ticket.estado)) return { error: `El ticket #${n} ya está cerrado: levanta uno nuevo.` };
      const quien = await quienPide(ctx);
      return {
        payload: { numero: n, texto, ...(quien ? { email: quien.email } : {}) },
        resumen: `Contestar en el ticket #${n} («${t.ticket.titulo}»): ${texto.length > 140 ? `${texto.slice(0, 140)}…` : texto}`,
      };
    },
    faltaParaConfirmar: async (p, ctx) => (typeof p.email === 'string' || quienPideElTicket(ctx) ? null : SIN_QUIEN_FIRME),
    ejecutar: async (p, ctx) => seguro('contestar el ticket', async () => {
      const firma = typeof p.email === 'string' ? p.email : quienPideElTicket(ctx);
      if (!firma) return { ok: false, resumen: SIN_QUIEN_FIRME };
      const n = Number(p.numero);
      // El admin del negocio contesta cualquier ticket del negocio (por la API pregunta él): `email: null`, firmado en `por`.
      const r = await comentarComoCliente(ctx.ws, null, n, String(p.texto ?? ''), [], firma);
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Listo: le contestaste al equipo en el ticket #${n}.`, datos: { ticketId: n } };
    }),
  },
};
