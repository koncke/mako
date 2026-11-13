// =============================================================================
// El retargeting de los funnels sin VSL: las reglas (13/11/2026). PURO: sin base, sin red, sin IA.
// =============================================================================
// Martín, después de la llamada con Leila: «que MaKo revise las conversaciones una vez por semana, no constantemente», marque en
// el CRM a los que no respondieron, no siguieron o no compraron, y a los que compraron, y con eso arme los públicos de Meta: a los
// que no avanzaron, otro anuncio; a los que compraron, nunca el mismo. El Cerebro: todo lead con chat, menos los de un funnel VSL.
//
// Lo que decide el CÓDIGO no gasta IA: compró, agendó, no respondió, y lo que una persona ya dijo con la etapa. La IA del negocio
// lee sólo a los que contestaron y quedaron quietos (`dudoso`), y sólo si hubo mensajes nuevos desde la última revisión.
// El orquestador vive en lib/retargeting-motor.ts; la base, la IA y Meta, en lib/retargeting.ts y lib/retargeting-meta.ts.
// =============================================================================

/** Dónde quedó un lead para el retargeting. `sigue` y `agendo` no se retargetean: están avanzando. */
export type Segmento = 'compro' | 'agendo' | 'no_respondio' | 'no_siguio' | 'no_compro' | 'no_califica' | 'sigue';
export const SEGMENTOS: readonly Segmento[] = ['no_respondio', 'no_siguio', 'no_compro', 'no_califica', 'compro', 'sigue', 'agendo'];

/** Los que van al público «No avanzaron»: el anuncio para que vuelvan. */
export const NO_AVANZARON: readonly Segmento[] = ['no_respondio', 'no_siguio', 'no_compro'];

/** Lo que contesta la IA de UNA charla. `dice_que_pago` cuenta como compró: a quien pagó nunca se le muestra el mismo anuncio. */
export type VeredictoIA = 'sigue' | 'no_siguio' | 'no_compro' | 'no_califica' | 'dice_que_pago';
const VEREDICTOS: readonly VeredictoIA[] = ['sigue', 'no_siguio', 'no_compro', 'no_califica', 'dice_que_pago'];

/** Las etiquetas del CRM que pone MaKo. Una por lead a la vez; `sigue` y `agendo` no llevan ninguna. Sin etapa vinculada: no mueven al lead. */
export type SegmentoConEtiqueta = 'no_respondio' | 'no_siguio' | 'no_compro' | 'no_califica' | 'compro';
export const ETIQUETAS: Record<SegmentoConEtiqueta, { nombre: string; color: string; emoji: string }> = {
  no_respondio: { nombre: 'Retargeting: no respondió', color: '#bf616a', emoji: '🔁' },
  no_siguio: { nombre: 'Retargeting: no siguió', color: '#d08770', emoji: '🔁' },
  no_compro: { nombre: 'Retargeting: no compró', color: '#ebcb8b', emoji: '🔁' },
  no_califica: { nombre: 'Retargeting: no califica', color: '#4c566a', emoji: '⛔' },
  compro: { nombre: 'Retargeting: compró', color: '#a3be8c', emoji: '✅' },
};
export const conEtiqueta = (s: Segmento | null | undefined): s is SegmentoConEtiqueta => !!s && s in ETIQUETAS;

/** Cuántos días sin mensajes hacen «quieta» una charla. Antes, sigue viva y no se toca. */
export const DIAS_QUIETO = 3;
/** Cuántas charlas lee la IA por llamada, y cuántas por negocio y por semana como máximo. */
export const POR_LLAMADA = 15;
export const TOPE_IA_SEMANAL = 300;
/** Cuántos mensajes de cada charla ve la IA (los últimos), y cuánto de cada uno. */
export const MENSAJES_A_LA_IA = 30;
export const LARGO_DE_UN_MENSAJE = 220;

/** Las etapas que ya dicen dónde quedó: lo que decidió una persona manda sobre lo que diga la charla. */
const POR_ETAPA: Record<string, Segmento> = {
  ganado: 'compro', facturando: 'compro', descal: 'no_califica', perdido: 'no_compro', noresp: 'no_respondio',
};

export type LeadRT = {
  id: number; nombre: string; telefono: string | null; email: string | null;
  cerro: boolean | null; etapa: string | null; cobrado: number | null;
  /** La reunión agendada (fecha o fecha y hora, ISO). */
  agenda: string | null;
  /** Está en un funnel con VSL: ese retargeting es por el píxel, no por la charla. */
  enVsl: boolean;
};
export type MensajeRT = { id: number; deNegocio: boolean; texto: string; at: string };
/** Los mensajes de la charla de un lead, del más viejo al más nuevo. */
export type ChatRT = { leadId: number; mensajes: MensajeRT[] };

const DIA = 86_400_000;

/** Lo que el código sabe de una charla sin leerla. */
export function resumenDelChat(c: ChatRT): { entrantes: number; salientes: number; respondioDespues: number; ultimoAt: number; ultimoId: number } {
  let entrantes = 0, salientes = 0, respondioDespues = 0, yaHabloElNegocio = false, ultimoAt = 0, ultimoId = 0;
  for (const m of c.mensajes) {
    if (m.deNegocio) { salientes++; yaHabloElNegocio = true; } else { entrantes++; if (yaHabloElNegocio) respondioDespues++; }
    const t = Date.parse(m.at);
    if (Number.isFinite(t) && t > ultimoAt) ultimoAt = t;
    if (m.id > ultimoId) ultimoId = m.id;
  }
  return { entrantes, salientes, respondioDespues, ultimoAt, ultimoId };
}

/**
 * EL SEGMENTO POR CÓDIGO, o `dudoso` (lo decide la IA), o null (no entra: un funnel VSL, o sin charla).
 * El orden importa: lo que compró manda sobre todo; después, lo que dijo una persona con la etapa; después, la agenda; y recién
 * ahí la charla. Una charla con mensajes de los últimos `DIAS_QUIETO` días sigue viva, y una que el negocio nunca contestó no se
 * le cobra al lead (tampoco se retargetea: es del negocio).
 */
export function segmentoPorCodigo(lead: LeadRT, chat: ChatRT | null, ahora: Date): Segmento | 'dudoso' | null {
  if (esComprador(lead)) return 'compro';
  if (lead.enVsl || !chat || !chat.mensajes.length) return null;
  const porEtapa = lead.etapa ? POR_ETAPA[lead.etapa] : undefined;
  if (porEtapa) return porEtapa;
  if (lead.agenda) {
    const t = Date.parse(lead.agenda);
    if (Number.isFinite(t) && t >= ahora.getTime() - DIA) return 'agendo';
  }
  const r = resumenDelChat(chat);
  if (ahora.getTime() - r.ultimoAt < DIAS_QUIETO * DIA) return 'sigue';
  if (!r.salientes) return 'sigue';
  if (!r.respondioDespues) return 'no_respondio';
  return 'dudoso';
}

/** Compró, para el público de exclusión: con o sin charla, de cualquier funnel. Nunca el mismo anuncio a quien ya pagó. */
export function esComprador(l: Pick<LeadRT, 'cerro' | 'etapa' | 'cobrado'>): boolean {
  return l.cerro === true || (l.etapa != null && POR_ETAPA[l.etapa] === 'compro') || (l.cobrado ?? 0) > 0;
}

// ── La IA ───────────────────────────────────────────────────────────────────────────────────────────────────────

export const SYSTEM_DE_LA_REVISION = [
  'Eres el analista comercial de un negocio que vende por WhatsApp. Te paso varias conversaciones con leads, cada una con su id.',
  'En cada línea, «N:» es el negocio y «L:» es el lead. Todas están quietas desde hace días y el lead no agendó ni compró.',
  'Para CADA conversación decide UNA de estas, según lo que pasó de verdad en la charla:',
  '- "sigue": quedó algo pendiente del negocio o el lead dijo que vuelve en una fecha que todavía no pasó.',
  '- "no_siguio": el lead se enfrió ANTES de recibir una oferta concreta (no contestó más, dijo que lo pensaba, cambió de tema).',
  '- "no_compro": recibió precio, propuesta, link de pago o una llamada, y no compró.',
  '- "no_califica": no es cliente posible (proveedor, busca trabajo, equivocado, spam, no le sirve el servicio, sin presupuesto dicho).',
  '- "dice_que_pago": el lead dice que ya pagó o compró.',
  'Contesta SOLO un JSON: {"r":[{"id":123,"v":"no_siguio","por":"dijo que lo pensaba y no volvió"}]}, con todas las conversaciones.',
  '"por" en español, de 4 a 12 palabras, sin nombres ni teléfonos.',
].join('\n');

/** El pedido de un lote: cada charla con su id y sus últimos mensajes, cortos. */
export function loteParaLaIA(chats: ReadonlyArray<ChatRT>): string {
  return chats.map((c) => {
    const ultimos = c.mensajes.slice(-MENSAJES_A_LA_IA).map((m) => {
      const t = m.texto.replace(/\s+/g, ' ').trim() || '(un archivo)';
      return `${m.deNegocio ? 'N' : 'L'}: ${t.length > LARGO_DE_UN_MENSAJE ? `${t.slice(0, LARGO_DE_UN_MENSAJE)}…` : t}`;
    });
    return `### id ${c.leadId}\n${ultimos.join('\n')}`;
  }).join('\n\n');
}

/** Lo que contestó la IA, sólo de los ids pedidos y con un veredicto válido. Lo demás no existe (queda sin revisar). Nunca tira. */
export function leerVeredictos(texto: string, pedidos: ReadonlyArray<number>): Map<number, { v: VeredictoIA; por: string }> {
  const out = new Map<number, { v: VeredictoIA; por: string }>();
  let crudo: unknown;
  try {
    const limpio = texto.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const i = limpio.indexOf('{'), j = limpio.lastIndexOf('}');
    crudo = JSON.parse(i >= 0 && j > i ? limpio.slice(i, j + 1) : limpio);
  } catch { return out; }
  const filas = Array.isArray((crudo as { r?: unknown })?.r) ? (crudo as { r: unknown[] }).r : Array.isArray(crudo) ? crudo : [];
  const validos = new Set(pedidos);
  for (const f of filas) {
    const o = (f ?? {}) as { id?: unknown; v?: unknown; por?: unknown };
    const id = Number(o.id);
    const v = String(o.v ?? '') as VeredictoIA;
    if (!validos.has(id) || !VEREDICTOS.includes(v) || out.has(id)) continue;
    out.set(id, { v, por: String(o.por ?? '').replace(/\s+/g, ' ').trim().slice(0, 90) });
  }
  return out;
}

export const segmentoDelVeredicto = (v: VeredictoIA): Segmento => (v === 'dice_que_pago' ? 'compro' : v);

// ── Los públicos de Meta ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * El teléfono como lo compara Meta: SÓLO dígitos, con el código de país, sin «+» ni ceros adelante (la normalización de Meta
 * antes del hash: con el «+» el hash no coincide con nadie). null si no parece un teléfono.
 */
export function telefonoParaMeta(t: string | null | undefined): string | null {
  const d = String(t ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return d.length >= 8 && d.length <= 15 ? d : null;
}
export function emailParaMeta(e: string | null | undefined): string | null {
  const x = String(e ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) ? x : null;
}

/** Una persona en un público: lo que se sube (teléfono y/o email). */
export type Persona = { phone?: string; email?: string };
export const personaDe = (l: Pick<LeadRT, 'telefono' | 'email'>): Persona | null => {
  const phone = telefonoParaMeta(l.telefono) ?? undefined;
  const email = emailParaMeta(l.email) ?? undefined;
  return phone || email ? { ...(phone ? { phone } : {}), ...(email ? { email } : {}) } : null;
};
const claveDe = (p: Persona): string => `${p.phone ?? ''}|${p.email ?? ''}`;

/**
 * Qué agregar y qué sacar de un público para que quede como `deseado`. `antes` es lo que MaKo subió (por lead): sólo se saca lo
 * que subió MaKo, y una persona cuyo teléfono cambió sale con el viejo y entra con el nuevo.
 */
export function difDelPublico(antes: Readonly<Record<string, Persona>>, deseado: ReadonlyMap<number, Persona>): { agregar: Persona[]; sacar: Persona[]; quedan: Record<string, Persona> } {
  const agregar: Persona[] = [], sacar: Persona[] = [];
  for (const [id, p] of Object.entries(antes)) {
    const ahora = deseado.get(Number(id));
    if (!ahora || claveDe(ahora) !== claveDe(p)) sacar.push(p);
  }
  for (const [id, p] of deseado) {
    const previo = antes[String(id)];
    if (!previo || claveDe(previo) !== claveDe(p)) agregar.push(p);
  }
  return { agregar, sacar, quedan: Object.fromEntries([...deseado].map(([id, p]) => [String(id), p])) };
}

/** Los nombres de los dos públicos en la cuenta de Meta del negocio. */
export const PUBLICOS = {
  noAvanzaron: { nombre: 'MaKo · No avanzaron', descripcion: 'Leads que no respondieron, no siguieron o no compraron. Lo actualiza MaKo cada lunes.' },
  compraron: { nombre: 'MaKo · Compraron', descripcion: 'Leads que compraron: para excluirlos. Lo actualiza MaKo cada lunes.' },
} as const;
export type CualPublico = keyof typeof PUBLICOS;
