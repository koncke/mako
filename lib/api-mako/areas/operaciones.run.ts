import 'server-only';

// =============================================================================
// Área «operaciones» — los cuerpos. Sólo lecturas (ver operaciones.def.ts).
// =============================================================================

import type { Runners, SalidaLectura } from '../tipos';
import { leerCarteros, listarPedidos } from '@/lib/operaciones';
import { ESTADOS, ROTULO, carteroVivo, type EstadoPedido } from '@/lib/operaciones-reglas';

const json = (o: unknown): string => JSON.stringify(o);
const cuentaN = (c: string | null) => (c ? `cuenta ${c.replace('claude', '')}` : 'cuenta desconocida');

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
        token: tokenPista ? 'configurado' : 'sin token: se crea en /admin/operaciones',
        nota: carteros.length ? 'Un pedido a una cuenta cuyo cartero no está vivo espera.' : 'Ningún cartero pasó todavía.',
      });
    },
  },
};
