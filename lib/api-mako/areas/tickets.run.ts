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
// ⚠️ QUIÉN LO LEVANTA se fija al PROPONER (`ctx.actor` del chat que lo propuso), no al confirmar: si lo confirma el
// admin desde la bandeja de pendientes, el ticket sigue siendo de quien lo pidió.
// ⚠️ ejecutar() no lanza nunca: `seguro()`.
// =============================================================================

import 'server-only';
import type { Ctx, Ejecutado, Runners, SalidaLectura } from '../tipos';
import { PREFIJO_APP } from '../canal';
import { crearTicket, identidadDe, misTickets } from '@/lib/tickets-db';
import { ROTULO_ESTADO_CLIENTE, estadoParaElCliente, sanearAlta, sanearContexto, type Canal, type ContextoTicket } from '@/lib/tickets-reglas';

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

export const RUNNERS: Runners = {
  levantar_ticket: {
    preparar: async (input, ctx) => {
      const actor = ctx.actor?.trim().toLowerCase();
      if (!actor || !actor.includes('@')) return { error: 'No sé quién eres: levántalo desde «Reportar problema», en el menú de tu perfil.' };
      const a = sanearAlta({ tipo: input.tipo, titulo: input.titulo, descripcion: input.descripcion });
      if (!a.ok) return { error: a.motivo };
      const pedido = await delPedido();
      const delTurno = ctx.contextoTicket?.() ?? {};
      const hilo = ctx.canalKey.startsWith(PREFIJO_APP) ? ctx.canalKey.slice(PREFIJO_APP.length) : ctx.canalKey;
      const contexto: ContextoTicket = sanearContexto({
        ...delTurno,
        ...(pedido.ruta ? { ruta: pedido.ruta } : {}),
        ...(pedido.navegador ? { navegador: pedido.navegador } : {}),
        chat: { donde: ctx.canal === 'whatsapp' ? 'whatsapp' : (pedido.ruta?.split(/[/?]/)[1] || 'chat'), hilo },
        hora: new Date().toISOString(),
        ...(input.noExiste === true ? { noExiste: true } : {}),
      });
      return {
        payload: {
          tipo: a.alta.tipo, titulo: a.alta.titulo, descripcion: a.alta.descripcion,
          ...(contexto.noExiste ? { noExiste: true } : {}),
          canal: canalDe(ctx, pedido.navegador), email: actor, contexto,
        },
        resumen: `Mandarle al equipo de MaKo: «${a.alta.titulo}»`,
      };
    },
    ejecutar: async (p, ctx) => seguro('mandar el ticket', async () => {
      const email = typeof p.email === 'string' ? p.email : ctx.actor ?? '';
      const identidad = await identidadDe(ctx.ws, email);
      const r = await crearTicket({
        identidad, tipo: (p.tipo as never) ?? null, declaradoPor: 'mako',
        titulo: String(p.titulo ?? ''), descripcion: String(p.descripcion ?? ''),
        canal: (p.canal as Canal) ?? 'chat_app', contexto: p.contexto,
      });
      if (!r.ok) return { ok: false, resumen: r.error };
      const sigue = r.triage.autoArreglo
        ? 'Es algo que debería andar: ya está yendo a arreglarse, y te aviso por acá cuando esté.'
        : 'Le llegó al equipo: te aviso por acá cuando lo decidan.';
      return { ok: true, resumen: `Listo, es el ticket #${r.id}. ${sigue}`, datos: { ticketId: r.id } };
    }),
  },

  mis_tickets: {
    leer: async (_input, ctx): Promise<SalidaLectura> => {
      const actor = ctx.actor?.trim().toLowerCase();
      if (!actor) return { content: json({ ok: false, error: 'No sé quién eres: tus tickets están en «Reportar problema», en el menú de tu perfil.' }), isError: true };
      const r = await misTickets(ctx.ws, actor);
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
};
