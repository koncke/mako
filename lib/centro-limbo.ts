// =============================================================================
// Los mensajes que esperan un chat cerrado: la cuenta, en MaKo (30/10/2026; puro, con test)
// =============================================================================
// Un mensaje de Martín a un chat cerrado se quedaba `escrito` sin que nadie se enterara y, a los 15 días, vencía sin avisar. Medido
// el 30/10: 11 ahí, el más viejo del 24/10. Lo único que lo decía era una línea adentro de ESE chat, que él ya no abre.
// Esto dice cuáles son, con lo que sube la PC (los chats vivos de cada cartero) y sin pedirle nada a la PC: si la PC está apagada, la
// cuenta sigue en pie. El cartel rojo que la usaba lo sacó Martín el 31/10/2026: «elimina el cartel rojo». Queda la regla y sus textos, sin pantalla.
//
// ⚠️ UN CHAT SIN NOTICIAS NO ESTÁ VIVO: `destino` puede no figurar en ningún cartero (un chat viejo, una cuenta sin Runner). Sólo
//    cuenta como vivo el que la PC dice que está abierto.
// ⚠️ VENCER NO LO SACA DE LA LISTA: lo vencido se sigue mostrando hasta que Martín lo descarte o lo mande a otro chat. Su texto sigue
//    en la base; lo único que se borró son los adjuntos.
// ⚠️ SIN `server-only`: lo usan el servidor (al vencer) y la pantalla (al dibujar).

import { pedidosSinChatVivo } from './operaciones-reglas';

/** A los cuántos días vence un mensaje sin entregar. Lo aplica lib/operaciones.ts en cada vuelta del Runner. */
export const VENCE_PEDIDO_DIAS = 15;
export const VENCE_PEDIDO_MS = VENCE_PEDIDO_DIAS * 86_400_000;
/** El motivo con el que queda un mensaje vencido: es lo que lo distingue de los otros `no_entregado`. */
export const MOTIVO_VENCIO = 'Venció con el chat cerrado: ábrelo y vuelve a mandarlo';
/** Desde cuántos días antes de vencer lo dice su fila en rojo. */
export const VENCE_PRONTO_DIAS = 3;

type PedidoDeLimbo = {
  id: string; created_at: string; destino: string; destino_titulo: string | null; destino_cuenta: string | null;
  texto: string; estado: string; motivo: string | null; adjuntos?: readonly string[];
};
type CarteroDeLimbo = { chats?: ReadonlyArray<{ local: string; vivo?: boolean }> };

export type EnLimbo<P extends PedidoDeLimbo = PedidoDeLimbo> = { pedido: P; vencido: boolean; desde: number; vence: number };

/** Lo que espera un chat cerrado (`pedidosSinChatVivo`) y lo que ya venció; lo más viejo primero. */
export function mensajesEnLimbo<P extends PedidoDeLimbo>(cola: readonly P[], carteros: readonly CarteroDeLimbo[], ahora: number): EnLimbo<P>[] {
  const out: EnLimbo<P>[] = [];
  const sinChat = new Set(pedidosSinChatVivo(cola, carteros, ahora));
  for (const pedido of cola) {
    const desde = Date.parse(pedido.created_at);
    if (!Number.isFinite(desde)) continue;
    const vencido = pedido.estado === 'no_entregado' && pedido.motivo === MOTIVO_VENCIO;
    if (vencido || sinChat.has(pedido)) out.push({ pedido, vencido, desde, vence: desde + VENCE_PEDIDO_MS });
  }
  return out.sort((a, b) => a.desde - b.desde);
}

/** «hace 6 días», «hace 3 horas», «hace 20 minutos». */
function haceCuanto(ms: number): string {
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return d === 1 ? 'hace 1 día' : `hace ${d} días`;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
  const m = Math.max(1, Math.floor(ms / 60_000));
  return m === 1 ? 'hace 1 minuto' : `hace ${m} minutos`;
}

/** El cartel: «3 mensajes tuyos esperan un chat cerrado (el más viejo, de hace 6 días)». null = no hay nada. */
export function textoDelCartel(lista: readonly Pick<EnLimbo, 'desde'>[], ahora: number): string | null {
  if (!lista.length) return null;
  const edad = haceCuanto(ahora - lista[0].desde);
  if (lista.length === 1) return `1 mensaje tuyo espera un chat cerrado (de ${edad})`;
  return `${lista.length} mensajes tuyos esperan un chat cerrado (el más viejo, de ${edad})`;
}

/** Lo que dice la fila de cuándo vence: «Venció: ya no le llega», «Vence hoy», «Vence en 9 días». `pronto` la pinta de rojo. */
export function textoDeVence(m: Pick<EnLimbo, 'vencido' | 'vence'>, ahora: number): { texto: string; pronto: boolean } {
  if (m.vencido || m.vence <= ahora) return { texto: 'Venció: ya no le llega', pronto: true };
  const d = Math.ceil((m.vence - ahora) / 86_400_000);
  return { texto: d <= 1 ? 'Vence hoy' : `Vence en ${d} días`, pronto: d <= VENCE_PRONTO_DIAS };
}

/** Los chats a los que se le puede mandar ahora, con los del mismo nombre primero (el «Cerebro» abierto, para uno cerrado). */
export function chatsParaMandarle<C extends { clave: string; titulo: string; estado: string }>(
  titulo: string | null, chats: readonly C[], recibe: (c: C) => boolean,
): C[] {
  const mismo = (c: C) => !!titulo && c.titulo.trim().toLowerCase() === titulo.trim().toLowerCase();
  return chats.filter(recibe).sort((a, b) => Number(mismo(b)) - Number(mismo(a)) || Number(b.estado === 'trabajando') - Number(a.estado === 'trabajando'));
}
