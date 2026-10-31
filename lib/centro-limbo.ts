// =============================================================================
// Los mensajes que esperan un chat cerrado: la cuenta, en MaKo (30/10/2026; puro, con test)
// =============================================================================
// Un mensaje de Martín a un chat cerrado se quedaba `escrito` sin que nadie se enterara y, a los 15 días, vencía sin avisar. Medido
// el 30/10: 11 ahí, el más viejo del 24/10. Lo único que lo decía era una línea adentro de ESE chat, que él ya no abre.
// Esto dice cuáles son, con lo que sube la PC (los chats vivos de cada cartero) y sin pedirle nada a la PC: si la PC está apagada, la
// cuenta sigue en pie. El cartel rojo que la usaba lo sacó Martín el 31/10/2026: «elimina el cartel rojo». Queda la regla y sus textos, sin pantalla.
//
// ⚠️ LA LISTA NO ES SÓLO DE CHATS CERRADOS: es todo lo que no sale y nadie más dice (30/10/2026). Cada uno lleva su causa, porque el remedio
//    es otro: abrir el chat, abrir el Runner de esa cuenta, o prender la apertura. Con un Runner dando vueltas en OTRA cuenta, `estadoDeLaPc`
//    se calla: lo que espera al Runner de ésta se dice acá, o no lo dice nadie (`causa: 'sin_runner'`).
// ⚠️ UNA FOTO VIEJA NO DICE «CERRADO»: `comoEstaElDestino` (lib/operaciones-reglas.ts). Con la cuenta callada, lo que falta es su Runner.
// ⚠️ VENCER NO LO SACA DE LA LISTA: lo vencido se sigue mostrando hasta que Martín lo descarte o lo mande a otro chat. Su texto sigue
//    en la base; lo único que se borró son los adjuntos.
// ⚠️ SIN `server-only`: lo usan el servidor (al vencer) y la pantalla (al dibujar).

import { DESTINO_NUEVO, SIN_CHAT_VIVO_MS, comoEstaElDestino, type FotoDeChats } from './operaciones-reglas';

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

/** Por qué no sale. `vencido` ya no sale; los otros tres, cuando se haga lo que dice `queHacer`. */
export type CausaDeLimbo = 'chat_cerrado' | 'sin_runner' | 'chat_nuevo' | 'vencido';
export type EnLimbo<P extends PedidoDeLimbo = PedidoDeLimbo> = { pedido: P; causa: CausaDeLimbo; vencido: boolean; desde: number; vence: number };

/** La causa de ese mensaje, o null si no le falta nada. Lo recién mandado (`SIN_CHAT_VIVO_MS`) todavía no: lo normal es que la PC no haya dado la vuelta. */
function causaDe(p: PedidoDeLimbo, desde: number, carteros: readonly FotoDeChats[], ahora: number): CausaDeLimbo | null {
  if (p.estado === 'no_entregado' && p.motivo === MOTIVO_VENCIO) return 'vencido';
  if (p.estado !== 'escrito' || ahora - desde <= SIN_CHAT_VIVO_MS) return null;
  if (p.destino === DESTINO_NUEVO) return 'chat_nuevo';
  const estado = comoEstaElDestino(p.destino, p.destino_cuenta, carteros, ahora);
  return estado === 'abierto' ? null : estado === 'cerrado' ? 'chat_cerrado' : 'sin_runner';
}

/** Lo que no sale, con su causa, y lo que ya venció; lo más viejo primero. */
export function mensajesEnLimbo<P extends PedidoDeLimbo>(cola: readonly P[], carteros: readonly FotoDeChats[], ahora: number): EnLimbo<P>[] {
  const out: EnLimbo<P>[] = [];
  for (const pedido of cola) {
    const desde = Date.parse(pedido.created_at);
    if (!Number.isFinite(desde)) continue;
    const causa = causaDe(pedido, desde, carteros, ahora);
    if (causa) out.push({ pedido, causa, vencido: causa === 'vencido', desde, vence: desde + VENCE_PEDIDO_MS });
  }
  return out.sort((a, b) => a.desde - b.desde);
}

const numeroDeCuenta = (c: string | null | undefined) => (c ? c.replace(/^claude/, '') : null);

/** Qué hacer con ese mensaje, en su fila. null = no queda nada por hacer con ese chat (venció: lo dice `textoDeVence`). */
export function queHacer(m: { causa: CausaDeLimbo; pedido: Pick<PedidoDeLimbo, 'destino_cuenta'> }): string | null {
  const n = numeroDeCuenta(m.pedido.destino_cuenta);
  if (m.causa === 'chat_cerrado') return `Abre este chat${n ? ` en la cuenta ${n}` : ''} para que lo reciba.`;
  if (m.causa === 'sin_runner') return `Abre el Runner${n ? ` de la cuenta ${n}` : ''} para que salga.`;
  if (m.causa === 'chat_nuevo') return 'Se abre cuando prendas la apertura de chats en el Runner.';
  return null;
}

/** Lo que dice una lista de una sola causa: [de uno, de varios]. */
const CAUSA_DEL_CARTEL: Record<CausaDeLimbo, readonly [string, string]> = {
  chat_cerrado: ['espera un chat cerrado', 'esperan un chat cerrado'],
  sin_runner: ['espera al Runner', 'esperan al Runner'],
  chat_nuevo: ['espera un chat por abrir', 'esperan un chat por abrir'],
  vencido: ['venció sin salir', 'vencieron sin salir'],
};

/** «hace 6 días», «hace 3 horas», «hace 20 minutos». */
export function haceCuanto(ms: number): string {
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return d === 1 ? 'hace 1 día' : `hace ${d} días`;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
  const m = Math.max(1, Math.floor(ms / 60_000));
  return m === 1 ? 'hace 1 minuto' : `hace ${m} minutos`;
}

/**
 * El cartel: «3 mensajes tuyos esperan un chat cerrado (el más viejo, de hace 6 días)». null = no hay nada. Dice sólo lo que es cierto de
 * TODOS: con causas mezcladas, «no salieron», y cada fila dice la suya. Un vencido no «espera», y lo de un chat por abrir no es de uno cerrado.
 */
export function textoDelCartel(lista: readonly Pick<EnLimbo, 'desde' | 'causa' | 'pedido'>[], ahora: number): string | null {
  if (!lista.length) return null;
  const edad = haceCuanto(ahora - lista[0].desde);
  const causa = lista.every((m) => m.causa === lista[0].causa) ? lista[0].causa : null;
  const [uno, varios] = causa ? CAUSA_DEL_CARTEL[causa] : ['no salió', 'no salieron'];
  const cuentas = new Set(lista.map((m) => m.pedido.destino_cuenta));
  const n = numeroDeCuenta([...cuentas][0]);
  const deCuenta = causa === 'sin_runner' && cuentas.size === 1 && n ? ` de la cuenta ${n}` : '';
  if (lista.length === 1) return `1 mensaje tuyo ${uno}${deCuenta} (de ${edad})`;
  return `${lista.length} mensajes tuyos ${varios}${deCuenta} (el más viejo, de ${edad})`;
}

/** Lo que dice la fila de cuándo vence: «Venció: ya no le llega», «Vence hoy», «Vence en 9 días». `pronto` la pinta de rojo. */
export function textoDeVence(m: Pick<EnLimbo, 'vencido' | 'vence'>, ahora: number): { texto: string; pronto: boolean } {
  if (m.vencido || m.vence <= ahora) return { texto: 'Venció: ya no le llega', pronto: true };
  const d = Math.ceil((m.vence - ahora) / 86_400_000);
  return { texto: d <= 1 ? 'Vence hoy' : `Vence en ${d} días`, pronto: d <= VENCE_PRONTO_DIAS };
}

/**
 * El texto y el título que Martín firmó, si lo que trajo la lista es eso (30/10/2026). `texto` es una columna que se puede escribir en la base;
 * lo que vale es `firmado` (AGENTS.md: «La verdad de un pedido es el texto FIRMADO en el dispositivo»), y volver a firmar `texto` sin mirarlo
 * convertiría una escritura en la base en una orden con firma válida. `verificar`: la firma, si este dispositivo fue el que firmó; otro
 * dispositivo no deja verificarla acá (su clave pública sólo la tiene la PC). Por eso la pantalla también muestra el texto entero antes.
 */
export async function originalParaReenviar(
  p: { id: string; texto: string },
  o: { firmado: string; firma: string; claveId: string | null },
  claveDeEste: string | null | undefined,
  verificar: (firmado: string, firma: string) => Promise<boolean>,
): Promise<{ ok: true; texto: string; titulo: string | null } | { ok: false; error: string }> {
  const cambio = { ok: false as const, error: 'Este mensaje cambió después de que lo firmaste: no lo firmo de nuevo.' };
  let x: Record<string, unknown> | null = null;
  try { x = JSON.parse(o.firmado) as Record<string, unknown>; } catch { return cambio; }
  if (!x || x.id !== p.id || typeof x.texto !== 'string' || x.texto !== p.texto) return cambio;
  if (claveDeEste && o.claveId === claveDeEste && !(await verificar(o.firmado, o.firma).catch(() => false))) return cambio;
  return { ok: true, texto: x.texto, titulo: typeof x.titulo === 'string' ? x.titulo : null };
}

/** Los chats a los que se le puede mandar ahora, con los del mismo nombre primero (el «Cerebro» abierto, para uno cerrado). */
export function chatsParaMandarle<C extends { clave: string; titulo: string; estado: string }>(
  titulo: string | null, chats: readonly C[], recibe: (c: C) => boolean,
): C[] {
  const mismo = (c: C) => !!titulo && c.titulo.trim().toLowerCase() === titulo.trim().toLowerCase();
  return chats.filter(recibe).sort((a, b) => Number(mismo(b)) - Number(mismo(a)) || Number(b.estado === 'trabajando') - Number(a.estado === 'trabajando'));
}
