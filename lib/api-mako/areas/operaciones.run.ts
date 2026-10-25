import 'server-only';

// =============================================================================
// Área «operaciones» — los cuerpos. Lecturas, y el ✓ de un «Completado» (ver operaciones.def.ts).
// =============================================================================

import type { Runners, SalidaLectura } from '../tipos';
import { leerCarteros, listarPedidos } from '@/lib/operaciones';
import { leerTurnos, leerUltimosTurnos } from '@/lib/centro-turnos-db';
import { leerYaVistosDe, marcarYaVistoDe } from '@/lib/centro-ya-vistos-db';
import {
  completadoSinVer, completadosDeLasCuentas, completadosSinVer, pedidoDelCompletado, sinMarkdown, yaEstaDelChat, type CompletadoDeChat, type LineaChat, type YaVistos,
} from '@/lib/centro-chats';
import { ESTADOS, ROTULO, carteroVivo, type EstadoPedido, type TurnoChat } from '@/lib/operaciones-reglas';

const json = (o: unknown): string => JSON.stringify(o);
const cuentaN = (c: string | null) => (c ? `cuenta ${c.replace('claude', '')}` : 'cuenta desconocida');
const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Los chats que dicen «Completado», con lo mismo que la lista del Ops Center, y el ✓ de cada uno. null = no se pudieron leer los
 *  ✓ (no se inventa). */
async function completados(): Promise<{ lista: CompletadoDeChat[]; vistos: YaVistos } | null> {
  const [{ carteros }, ultimos, vistos] = await Promise.all([leerCarteros(), leerUltimosTurnos(), leerYaVistosDe()]);
  return vistos ? { lista: completadosDeLasCuentas(carteros, ultimos, vistos), vistos } : null;
}
/** Un «Completado», como lo muestra el bloque de arriba de la caja: cuándo, su título, lo que respondía (y quién lo pidió), la
 *  respuesta ENTERA y su página. */
function resumen(lineas: readonly LineaChat[], t: TurnoChat) {
  const instante = Date.parse(t.at);
  const [n] = yaEstaDelChat([{ tipo: 'turno', instante, turno: t }]);
  const p = pedidoDelCompletado(lineas, t);
  return {
    termino: new Date(instante).toISOString(),
    titulo: n?.titulo && n.titulo !== 'Ya está' ? sinMarkdown(n.titulo) : 'Completado',
    pedido: p?.texto ?? null,
    pidio: p ? p.de ?? 'Martín' : null,
    respuesta: t.texto,
    revisar: n?.revisar?.pagina ?? null,
  };
}
/** El de ese nombre (sin mayúsculas ni tildes; «Cerebro» también por su nombre de antes). */
const elDe = (lista: readonly CompletadoDeChat[], chat: string) => lista.find((c) => normal(c.titulo) === normal(chat) || c.clave === `nombre:${normal(chat)}`);

export const RUNNERS: Runners = {
  ver_pedidos_operaciones: {
    leer: async (input): Promise<SalidaLectura> => {
      const estado = ESTADOS.includes(input.estado as EstadoPedido) ? (input.estado as EstadoPedido) : null;
      const limite = typeof input.limite === 'number' && input.limite >= 1 ? Math.min(50, Math.floor(input.limite)) : 20;
      const todos = await listarPedidos(estado ? 100 : limite);
      const pedidos = (estado ? todos.filter((p) => p.estado === estado) : todos).slice(0, limite);
      return json({
        pedidos: pedidos.map((p) => ({
          id: p.id,
          creado: p.created_at,
          chat: p.destino_titulo ?? p.destino,
          cuenta: cuentaN(p.destino_cuenta),
          estado: ROTULO[p.estado],
          texto: p.texto.length > 300 ? `${p.texto.slice(0, 300)}…` : p.texto,
          motivo: p.motivo,
          cierre: p.cierre,
        })),
        nota: pedidos.length
          ? 'Escrito ≠ entregado ≠ hecho ≠ comprobado: «entregado» quiere decir que salió hacia el chat, no que lo terminó.'
          : 'No hay pedidos con ese filtro.',
      });
    },
  },
  ver_carteros_operaciones: {
    leer: async (): Promise<SalidaLectura> => {
      const { carteros, tokenPista } = await leerCarteros();
      const ahora = Date.now();
      return json({
        carteros: carteros.map((k) => ({
          cuenta: cuentaN(k.cuenta),
          vivo: carteroVivo(k, ahora),
          ultimaVuelta: k.vistoAt,
          version: k.version,
          chatsAbiertos: k.chats.filter((c) => c.vivo).map((c) => c.titulo),
          clavesAceptadas: k.claves.length,
        })),
        token: tokenPista ? 'configurado' : 'sin token: se crea en /admin/operaciones → Runners → Nuevo Runner',
        nota: carteros.length ? 'Un trabajo a una cuenta cuyo Runner no está activo espera: se arregla abriendo el chat Runner en la app de Claude.' : 'Ningún Runner se conectó todavía: se conecta desde /admin/operaciones → Runners → Nuevo Runner.',
      });
    },
  },
  ver_completados_operaciones: {
    leer: async (input): Promise<SalidaLectura> => {
      const leido = await completados();
      if (!leido) return json({ error: 'No pude leer qué «Completado» ya viste. Vuelve a intentarlo en un rato.' });
      const todos = leido.lista;
      const chat = typeof input.chat === 'string' && input.chat.trim() ? input.chat.trim() : null;
      const lista = chat ? todos.filter((c) => c === elDe(todos, chat)) : todos;
      // La respuesta ENTERA y lo que pidió Martín: los turnos completos de sus sesiones (la lista trae sólo el renglón).
      const detalle = await Promise.all(lista.map(async (c) => {
        const lineas: LineaChat[] = (await leerTurnos(c.locales)).map((t) => ({ tipo: 'turno', instante: Date.parse(t.at), turno: t }));
        const t = completadoSinVer(lineas, c.instante - 1);
        // Los de antes que tampoco vio, del más viejo al más nuevo: el bloque los muestra de a uno, con las flechas (25/10/2026).
        const antes = completadosSinVer(lineas, leido.vistos[c.clave]).filter((x) => x.uuid !== t?.uuid);
        return {
          chat: c.titulo, cuenta: cuentaN(c.cuenta),
          ...(t ? resumen(lineas, t) : { termino: new Date(c.instante).toISOString(), titulo: 'Completado', pedido: null, pidio: null, respuesta: null, revisar: null }),
          anteriores: antes.map((x) => resumen(lineas, x)),
        };
      }));
      return json({
        completados: detalle,
        nota: detalle.length
          ? 'Cada chat sigue diciendo «Completado» hasta que Martín lo da por visto (en la pantalla, «Ya lo vi»; por aquí, `marcar_visto_operaciones`, que da por vistos también sus `anteriores`).'
          : chat ? `«${chat}» no dice «Completado».` : 'Ningún chat dice «Completado»: todo lo terminado ya está visto.',
      });
    },
  },
  marcar_visto_operaciones: {
    preparar: async (input) => {
      const chat = typeof input.chat === 'string' ? input.chat.trim() : '';
      if (!chat) return { error: 'Falta el chat: el nombre del que dice «Completado».', faltan: ['chat'] };
      const leido = await completados();
      if (!leido) return { error: 'No pude leer qué «Completado» ya viste. Vuelve a intentarlo en un rato.' };
      const c = elDe(leido.lista, chat);
      if (!c) return { error: `«${chat}» no dice «Completado».`, disponibles: leido.lista.map((x) => x.titulo) };
      return { payload: { clave: c.clave, instante: c.instante, chat: c.titulo }, resumen: `Dar por visto el «Completado» de ${c.titulo}.` };
    },
    ejecutar: async (payload) => {
      const clave = typeof payload.clave === 'string' ? payload.clave : '';
      const instante = typeof payload.instante === 'number' && Number.isFinite(payload.instante) ? payload.instante : NaN;
      if (!clave.startsWith('nombre:') || !Number.isFinite(instante)) return { ok: false, resumen: 'No sé qué «Completado» marcar: pide la lista de nuevo.' };
      await marcarYaVistoDe(clave, instante);
      return { ok: true, resumen: `Listo: el «Completado» de ${typeof payload.chat === 'string' ? payload.chat : 'ese chat'} ya está visto.` };
    },
  },
};
