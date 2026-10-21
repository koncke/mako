// =============================================================================
// claves-en-el-chat — NUNCA UNA KEY EN EL CHAT (pieza 1.6 de docs/ops-center-principal.md, 20/10/2026)
// =============================================================================
// Una clave pegada en el chat llegaba al modelo y quedaba guardada en `chart_chats` (§2.8, «Fallas que se arreglan en la
// ola 1»). Ahora el turno la TAPA antes de todo —el historial, el título, El Archivero y el modelo— y le contesta a la
// persona con el botón «Conectar» del servicio que reconoció, para que la pegue donde corresponde.
//
// Las reglas son las de lib/agente-redaccion.ts (las mismas que tapan lo que sube el plugin de Claude Code), pero SÓLO las
// de SECRETOS: en el chat del negocio un email, un teléfono o un monto son su trabajo, no algo para tapar. Más tres
// prefijos que esa tabla no tenía (OpenRouter, Cerebras, Resend y ElevenLabs), que van ANTES de la de OpenAI porque
// `sk-or-…` también la cumple.
//
// Pura, sin `server-only`: la prueba la importa.
// =============================================================================

import { REGLAS, redactarCon, type Regla } from './agente-redaccion';

/** Lo que recibe el modelo, y lo que queda en la base, en lugar de la clave. */
export const CLAVE_TAPADA = '[clave tapada]';

/** Las reglas de agente-redaccion que son SECRETOS, con el servicio de /integraciones al que pertenecen (null = ninguno). */
const SERVICIO_DE_REGLA: Readonly<Record<string, string | null>> = {
  anthropic: 'anthropic', openai: 'openai', google: 'gemini', groq: 'groq', stripe: 'stripe', mercadopago: 'mercadopago',
  meta: 'meta', github: null, slack: null, 'webhook-secreto': null, jwt: null, env: null,
};

/** Las que agente-redaccion no tenía. Van primero: `sk-or-` y `sk_` son prefijos que otra regla también cumple. */
const PROPIAS: Array<Regla & { servicio: string }> = [
  { nombre: 'openrouter', re: /\bsk-or-[A-Za-z0-9_-]{20,}/g, con: CLAVE_TAPADA, servicio: 'openrouter' },
  { nombre: 'cerebras', re: /\bcsk-[A-Za-z0-9]{20,}/g, con: CLAVE_TAPADA, servicio: 'cerebras' },
  { nombre: 'resend', re: /\bre_[A-Za-z0-9_]{20,}/g, con: CLAVE_TAPADA, servicio: 'email' },
  { nombre: 'elevenlabs', re: /\bsk_[a-f0-9]{40,}/g, con: CLAVE_TAPADA, servicio: 'elevenlabs' },
];

const REGLAS_DE_SECRETOS: Array<Regla & { servicio: string | null }> = [
  ...PROPIAS,
  ...REGLAS.filter((r) => r.nombre in SERVICIO_DE_REGLA).map((r) => ({
    ...r,
    // La línea de .env conserva su nombre («GEMINI_API_KEY=[clave tapada]»): dice qué se pegó sin el valor.
    con: r.nombre === 'env' ? `$1=${CLAVE_TAPADA}` : CLAVE_TAPADA,
    servicio: SERVICIO_DE_REGLA[r.nombre],
  })),
];

export type Tapado = {
  /** El texto con cada clave cambiada por `CLAVE_TAPADA`. */
  texto: string;
  /** Cuántas se taparon. 0 = el texto quedó igual. */
  tapadas: number;
  /** El servicio de la primera clave reconocida (para el botón «Conectar»), o null si no se sabe de cuál es. */
  servicio: string | null;
};

/** Tapa las claves de un mensaje del chat. Nunca tira. */
export function taparClaves(entrada: string): Tapado {
  const texto = typeof entrada === 'string' ? entrada : '';
  let servicio: string | null = null;
  for (const r of REGLAS_DE_SECRETOS) {
    if (servicio) break;
    r.re.lastIndex = 0;
    if (r.re.test(texto)) servicio = r.servicio;
    r.re.lastIndex = 0;
  }
  const r = redactarCon(texto, REGLAS_DE_SECRETOS);
  return { texto: r.texto, tapadas: r.tapadas, servicio: r.tapadas ? servicio : null };
}

/** Lo que se le dice a la persona: corto, y con el botón del servicio cuando se sabe cuál es. */
export function avisoClaveTapada(servicio: string | null): string {
  return servicio ? 'Tapé tu clave: no quedó en el chat. Pégala aquí, en su conexión.' : 'Tapé tu clave: no quedó en el chat.';
}
