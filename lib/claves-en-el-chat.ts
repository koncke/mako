// =============================================================================
// claves-en-el-chat — NUNCA UNA KEY EN EL CHAT (pieza 1.6 de docs/ops-center-principal.md, 20/10/2026)
// =============================================================================
// Una clave pegada en el chat llegaba al modelo y quedaba guardada en `chart_chats` (§2.8, «Fallas que se arreglan en la
// ola 1»). Ahora el turno la TAPA antes de todo —el historial, el título, El Archivero y el modelo— y le contesta a la
// persona con el botón «Conectar» del servicio que reconoció, para que la pegue donde corresponde.
//
// Las reglas son las de lib/agente-redaccion.ts (las mismas que tapan lo que sube el plugin de Claude Code), pero SÓLO las
// de SECRETOS: en el chat del negocio un email, un teléfono o un monto son su trabajo, no algo para tapar. Más las que esa
// tabla no tenía (OpenRouter, Cerebras, Resend, ElevenLabs, los tokens de MaKo y el fine-grained de GitHub), que van ANTES
// de la de OpenAI porque `sk-or-…` también la cumple.
//
// ⚠️ TAPAR DE MÁS TAMBIÉN ES UN DAÑO, y acá más que en el plugin: el crudo NO se guarda (el turno sólo conserva lo tapado),
// así que lo que una regla se come de texto normal el negocio no lo recupera. agente-redaccion las tiene laxas a propósito
// («ante la duda, tapar de más») y en el chat se comían una campaña (`TEST-CBO-lookalike-compradores-1pct-AR`, por la de
// Mercado Pago), una etiqueta (`re_agendar_despues_de_la_llamada`, por la de Resend) y un cupón (`BLACKFRIDAY_PASS: 30%`,
// por la de .env). Por eso Mercado Pago, Resend y .env se redefinen acá con la FORMA de la clave, no sólo con su prefijo
// (agente-redaccion no se toca: la usa el plugin, y ahí sí conviene la red ancha).
//
// Pura, sin `server-only`: la prueba la importa.
// =============================================================================

import { REGLAS, redactarCon, type Regla } from './agente-redaccion';

/** Lo que recibe el modelo, y lo que queda en la base, en lugar de la clave. */
export const CLAVE_TAPADA = '[clave tapada]';

/**
 * Las reglas de agente-redaccion que son SECRETOS, con el servicio de /integraciones al que pertenecen (null = ninguno).
 * Faltan `mercadopago` y `env` A PROPÓSITO: las de allá son laxas (prefijo + 30 caracteres) y acá se redefinen exactas.
 */
const SERVICIO_DE_REGLA: Readonly<Record<string, string | null>> = {
  anthropic: 'anthropic', openai: 'openai', google: 'gemini', groq: 'groq', stripe: 'stripe',
  meta: 'meta', github: null, slack: null, 'webhook-secreto': null, jwt: null,
};

type ReglaDeClave = Regla & { servicio: string | null };

/** Las que agente-redaccion no tenía. Van primero: `sk-or-` y `sk_` son prefijos que otra regla también cumple. */
const PROPIAS_ANTES: ReglaDeClave[] = [
  { nombre: 'openrouter', re: /\bsk-or-[A-Za-z0-9_-]{20,}/g, con: CLAVE_TAPADA, servicio: 'openrouter' },
  { nombre: 'cerebras', re: /\bcsk-[A-Za-z0-9]{20,}/g, con: CLAVE_TAPADA, servicio: 'cerebras' },
  // Resend: `re_` + 8 + `_` + 24 (la forma de las de verdad). Sin un dígito o una mayúscula NO es una clave —una al azar de
  // 32 caracteres sin ninguno de los dos es una en cien mil—, es una etiqueta en snake_case del negocio
  // (`re_agendar_despues_de_la_llamada`, que con `[A-Za-z0-9_]{20,}` se tapaba y perdía el botón de email por nada).
  // La segunda alternativa es la forma de UN solo bloque, por si hay claves viejas así.
  { nombre: 'resend', re: /\bre_(?=[A-Za-z0-9_]*[0-9A-Z])(?:[A-Za-z0-9]{8}_[A-Za-z0-9]{20,}|[A-Za-z0-9]{28,})/g, con: CLAVE_TAPADA, servicio: 'email' },
  { nombre: 'elevenlabs', re: /\bsk_[a-f0-9]{40,}/g, con: CLAVE_TAPADA, servicio: 'elevenlabs' },
  // Los tokens de MaKo (los acuñan lib/api-mako/tokens.ts, lib/agente-token-nucleo.ts y lib/ia-pc.ts): un `mako_pat_` son
  // 60 hex; un `mkoag_[lpe]_`, 48 hex (los viejos van sin la letra); un `mkopc_`/`mkotn_`, 43 base64url. Quien manda un
  // token de MaKo por el chat se lo está dando a un modelo. La PISTA (`mkoag_e_…a1b2`) no entra: el `…` corta la clase, y
  // no es secreta.
  { nombre: 'mako', re: /\b(?:mako_pat_|mkoag_(?:[lpe]_)?|mkopc_|mkotn_)[A-Za-z0-9_-]{20,}/g, con: CLAVE_TAPADA, servicio: null },
  // El fine-grained de GitHub (`github_pat_` + 22 + `_` + 59); el clásico `ghp_…` ya lo cubre agente-redaccion.
  { nombre: 'github-fine', re: /\bgithub_pat_[A-Za-z0-9_]{50,}/g, con: CLAVE_TAPADA, servicio: null },
];

/**
 * Las que van DESPUÉS de las heredadas: la línea de .env necesita que el valor de una clave ya conocida sea un marcador
 * (`GEMINI_API_KEY=AIza…`), y el `servicio` del botón se lee en este orden.
 */
const PROPIAS_DESPUES: ReglaDeClave[] = [
  // El access token de Mercado Pago: `APP_USR-<app: 16 dígitos>-<MMDDHH>-<32 hex>-<usuario: dígitos>` (y `TEST-` en las
  // viejas de prueba). Se ata a los DÍGITOS de la app: `TEST-CBO-lookalike-compradores-1pct-AR` es una campaña, no un
  // token. Lo que viene después de los dígitos es laxo a propósito (los ejemplos del repo traen un hex corto:
  // tests/mercadopago-api.test.ts). La Public Key (`APP_USR-` + un UUID) ya no cae: no es secreta.
  { nombre: 'mercadopago', re: /\b(?:APP_USR|TEST)-\d{10,}-[A-Za-z0-9-]{16,}/g, con: CLAVE_TAPADA, servicio: 'mercadopago' },
  // Una línea de .env: SÓLO al principio de la línea (con su `export` y su sangría) y con el nombre en MAYÚSCULAS, como se
  // pega. Con `=` vale cualquier valor (una contraseña corta es un secreto igual); con `:` —que es como se escribe en
  // prosa («BLACKFRIDAY_PASS: 30% para todos»)— hace falta un valor de 16+ caracteres sin espacios, que es una clave.
  // Conserva su nombre: «GEMINI_API_KEY=[clave tapada]» dice qué se pegó sin el valor.
  // (El nombre se lee con un lookahead en vez de `[A-Z0-9_]{4,}KEY[A-Z0-9_]*`: así es lineal —una línea de 1 MB de «KEY»
  // repetido no cuelga el turno— y deja pasar `API_KEY` y `DB_PASSWORD`, que con el mínimo de 5 letras de antes se escapaban.)
  { nombre: 'env', re: /^([ \t]*(?:export[ \t]+)?(?=[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL))[A-Z][A-Z0-9_]*)[ \t]*(?:=[ \t]*(?:"[^"\n]*"|'[^'\n]*'|\S+)|:[ \t]*\S{16,})/gm, con: `$1=${CLAVE_TAPADA}`, servicio: null },
];

const REGLAS_DE_SECRETOS: ReglaDeClave[] = [
  ...PROPIAS_ANTES,
  ...REGLAS.filter((r) => r.nombre in SERVICIO_DE_REGLA).map((r) => ({ ...r, con: CLAVE_TAPADA, servicio: SERVICIO_DE_REGLA[r.nombre] })),
  ...PROPIAS_DESPUES,
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
