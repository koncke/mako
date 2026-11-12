// =============================================================================
// buscar-negocio-reglas — qué negocio de la plataforma es un nombre (11/11/2026)
// =============================================================================
// «¿cuánto va a pagar Código Inmobiliario…?» y MaKo no sabía que era el 13. El bloque del grupo SuperAdmin que lista los negocios lo
// trae el chat de WhatsApp (lib/doer-plataforma.ts en punta/wa-sorda-1011, todavía no en main); esto es la herramienta `buscar_negocio` (lib/api-mako/areas/cs.run.ts), para cualquier canal de la
// plataforma: el número, el nombre, la capa, si está en pausa, la agencia que lo administra y, si es una agencia, sus clientes.
// Sin montos (los trae ver_mensualidades_agencias). Puro, con test (tests/buscar-negocio.test.ts).
// =============================================================================

import { capaDef } from './capas';
import { buscarNegocio } from './diagnostico-negocio';

export type NegocioLeido = { ws: number; nombre: string | null; capa: string | null; estado: string | null };
export type FilaCarteraLeida = { agencia_ws: number; cliente_ws: number; estado: string | null };

export type NegocioHallado = {
  ws: number;
  nombre: string;
  capa: string;
  en_pausa: boolean;
  /** La agencia que lo administra (pendiente o aprobada; una revocada es historia). */
  agencia: { ws: number; nombre: string; espera_aprobacion: boolean } | null;
  /** Si es una agencia: sus clientes vigentes. */
  clientes: Array<{ ws: number; nombre: string; espera_aprobacion: boolean }>;
};

const nombreDe = (n: NegocioLeido | undefined, ws: number): string => (n?.nombre || '').trim() || `Cuenta ${ws}`;
const vigente = (f: FilaCarteraLeida): boolean => (f.estado === 'pendiente' || f.estado === 'aprobado') && f.agencia_ws !== f.cliente_ws;

/** Los negocios que puede ser `pedido` (número o nombre, sin tildes, como el diagnóstico), con su agencia y sus clientes. */
export function negociosDelPedido(pedido: string, negocios: readonly NegocioLeido[], cartera: readonly FilaCarteraLeida[]): NegocioHallado[] {
  const porWs = new Map(negocios.map((n) => [n.ws, n]));
  const vigentes = cartera.filter(vigente);
  const halladas = buscarNegocio(pedido, negocios.map((n) => ({ ws: n.ws, nombre: nombreDe(n, n.ws) })));
  return halladas.map(({ ws }) => {
    const n = porWs.get(ws);
    const suya = vigentes.find((f) => f.cliente_ws === ws) ?? null;
    return {
      ws,
      nombre: nombreDe(n, ws),
      capa: capaDef(n?.capa).nombre,
      en_pausa: n?.estado === 'pausado',
      agencia: suya ? { ws: suya.agencia_ws, nombre: nombreDe(porWs.get(suya.agencia_ws), suya.agencia_ws), espera_aprobacion: suya.estado === 'pendiente' } : null,
      clientes: vigentes.filter((f) => f.agencia_ws === ws).sort((a, b) => a.cliente_ws - b.cliente_ws)
        .map((f) => ({ ws: f.cliente_ws, nombre: nombreDe(porWs.get(f.cliente_ws), f.cliente_ws), espera_aprobacion: f.estado === 'pendiente' })),
    };
  });
}
