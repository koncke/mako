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
// de las heredadas (la OpenAI de allá se comía `sk-or-…`; ya no está, pero un prefijo propio no queda a merced de una laxa).
//
// ⚠️ TAPAR DE MÁS TAMBIÉN ES UN DAÑO, y acá más que en el plugin: el crudo NO se guarda (el turno sólo conserva lo tapado),
// así que lo que una regla se come de texto normal el negocio no lo recupera. agente-redaccion las tiene laxas a propósito
// («ante la duda, tapar de más») y en el chat se comían una campaña (`TEST-CBO-lookalike-compradores-1pct-AR`, por la de
// Mercado Pago), una etiqueta (`re_agendar_despues_de_la_llamada`, por la de Resend), un cupón (`BLACKFRIDAY_PASS: 30%`,
// por la de .env) y el slug de un producto (`/products/sk-ii-facial-treatment-essence-230ml`, por la de OpenAI). Por eso
// OpenAI, Mercado Pago, Resend y .env se redefinen acá con la FORMA de la clave, no sólo con su prefijo (agente-redaccion
// no se toca: la usa el plugin, y ahí sí conviene la red ancha).
//
// Pura, sin `server-only`: la prueba la importa.
// =============================================================================

import { REGLAS, redactarCon, type Regla } from './agente-redaccion';

/** Lo que recibe el modelo, y lo que queda en la base, en lugar de la clave. */
export const CLAVE_TAPADA = '[clave tapada]';

/**
 * Las reglas de agente-redaccion que son SECRETOS, con el servicio de /integraciones al que pertenecen (null = ninguno).
 * Faltan `openai`, `mercadopago` y `env` A PROPÓSITO: las de allá son laxas (un prefijo y 20-30 caracteres de cualquier
 * cosa) y acá se redefinen con la forma de la clave. El servicio `openai` del botón lo da la regla de PROPIAS_DESPUES.
 */
const SERVICIO_DE_REGLA: Readonly<Record<string, string | null>> = {
  anthropic: 'anthropic', google: 'gemini', groq: 'groq', stripe: 'stripe',
  meta: 'meta', github: null, slack: null, 'webhook-secreto': null, jwt: null,
};

type ReglaDeClave = Regla & { servicio: string | null };

/** Las que agente-redaccion no tenía. Van primero, antes de las heredadas: `sk-or-` lo cumplía también la OpenAI de allá. */
const PROPIAS_ANTES: ReglaDeClave[] = [
  // IA8: OpenRouter y Cerebras se sacaron de /integraciones. Su clave pegada se sigue tapando, sin botón para conectarla.
  { nombre: 'openrouter', re: /\bsk-or-[A-Za-z0-9_-]{20,}/g, con: CLAVE_TAPADA, servicio: null },
  { nombre: 'cerebras', re: /\bcsk-[A-Za-z0-9]{20,}/g, con: CLAVE_TAPADA, servicio: null },
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
  // OpenAI, con la forma de la clave y no sólo el prefijo: la heredada (`sk-` + 20 de [A-Za-z0-9_-]) se comía cualquier slug
  // que empezara por «sk-» (`/products/sk-ii-facial-treatment-essence-230ml`, `sk-camiseta-oversize-negra-talle-l`).
  //   · la VIEJA es `sk-` + 48 alfanuméricos SIN guiones (con el «T3BlbkFJ» —«OpenAI» en base64— en el medio, o sea siempre un
  //     dígito y una mayúscula): un slug siempre lleva guiones, así que no la cumple;
  //   · las NUEVAS son `sk-proj-`, `sk-svcacct-`, `sk-admin-` (y `sk-None-`, las de usuario sin proyecto) + base64url largo
  //     (las reales pasan de 100; se pide 40+ para no quedarse corto). Se pide además una mayúscula en los primeros 64
  //     caracteres: a una clave al azar le falta en una de 10^14, y un slug (`sk-proj-lanzamiento-verano-2026-promociones-
  //     especiales`) casi nunca la tiene. La ventana va acotada a propósito: un lookahead que corriera hasta el final de la
  //     tirada sería cuadrático con «sk-proj-» repetido (el `-` es de la clase y cada «sk-» abre un `\b` nuevo).
  // `sk-ant-…` y `sk-or-…` no la cumplen (el guion tras «ant»/«or» corta la tirada vieja): siguen ganando sus reglas con su
  // servicio, sin que el orden importe entre ellas. Tampoco importa que quede antes o después de .env: `taparClaves`
  // sigue de largo mientras el servicio sea null, así que `OPENAI_API_KEY=sk-proj-…` dice `openai` aunque .env la pise.
  { nombre: 'openai', re: /\bsk-(?:(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Z])[A-Za-z0-9]{40,}|(?:proj|svcacct|admin|None)-(?=[A-Za-z0-9_-]{0,64}[A-Z])[A-Za-z0-9_-]{40,})/g, con: CLAVE_TAPADA, servicio: 'openai' },
  // El access token de Mercado Pago: `APP_USR-<app: 16 dígitos>-<MMDDHH: 6 dígitos>-<32 hex>-<usuario: dígitos>` (y `TEST-` en
  // las viejas de prueba). Se ata a la FORMA entera, no sólo a los dígitos de la app: `TEST-2026102112-lookalike-compradores-AR`
  // (una fecha pegada a una campaña) cumplía el prefijo y los dígitos, y `TEST-CBO-lookalike-compradores-1pct-AR` el prefijo.
  // Los 32 hex son los que separan un token de un nombre: sin ellos todo con «APP_USR-» o «TEST-» y un número se tapaba.
  // (Los fixtures de tests/mercadopago-api.test.ts traen un hex corto —12— y NO tienen la forma: esa regla es de aquel
  // archivo, no de este. La Public Key, `APP_USR-` + un UUID, tampoco cae: no es secreta.)
  { nombre: 'mercadopago', re: /\b(?:APP_USR|TEST)-\d{10,}-\d{6}-[A-Fa-f0-9]{32}-\d+/g, con: CLAVE_TAPADA, servicio: 'mercadopago' },
  // Una línea de .env: SÓLO al principio de la línea (con su `export` y su sangría) y con el nombre en MAYÚSCULAS, como se
  // pega. El NOMBRE tiene que TERMINAR en KEY, TOKEN, SECRET, PASSWORD, PASS o CREDENTIAL(S), con un sufijo numérico
  // opcional (`GEMINI_API_KEY_2`, que existe): «contiene KEY» se comía `KEYWORDS: zapatillas-running-mujer-ofertas`.
  // Con `=` vale cualquier valor (una contraseña corta es un secreto igual); con `:` —que es como se escribe en prosa
  // («BLACKFRIDAY_PASS: 30% para todos»)— hace falta un valor de 16+ caracteres sin espacios que NO empiece con http(s)://
  // (`BLACKFRIDAY_PASS: https://tienda.com/promo` es un link, no una clave).
  // Sólo con `=` el nombre puede seguir con más palabras después de la clave: `FATHOM_API_KEY_MARTIN` y
  // `ELEVENLABS_API_KEY_MAURICIO_IMPAGA` son nombres REALES del .env.local, y «termina en» los dejaba pasar (la regla vieja
  // sí los tapaba: era un agujero nuevo). Ahí KEY/TOKEN/… tiene que ser una palabra entera entre guiones bajos
  // (`KEYWORDS`, `MAX_TOKENS`, `MONKEY` no cuentan).
  // Conserva su nombre: «GEMINI_API_KEY=[clave tapada]» dice qué se pegó sin el valor.
  // (El nombre se lee con lookaheads, y el primero lo ACOTA a 80 caracteres seguidos de «=» o «:»: los demás recorren esa
  // tirada, así que nunca cuestan más que 80 por línea. Sin la cota, `KEY_KEY_KEY_…` de 1 MB era cuadrático: cada «KEY_»
  // reabría un recorrido hasta el final de la línea. El `(?![A-Z0-9_])` ata el final del nombre a donde termina la tirada.)
  { nombre: 'env', re: /^([ \t]*(?:export[ \t]+)?(?=[A-Z][A-Z0-9_]{0,79}[ \t]*[=:])(?=[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIALS?)(?:_?\d+)?(?![A-Z0-9_])[ \t]*[=:]|(?:[A-Z0-9_]*_)?(?:KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIALS?)_[A-Z0-9][A-Z0-9_]*[ \t]*=)[A-Z][A-Z0-9_]*)[ \t]*(?:=[ \t]*(?:"[^"\n]*"|'[^'\n]*'|\S+)|:[ \t]*(?!https?:\/\/)\S{16,})/gm, con: `$1=${CLAVE_TAPADA}`, servicio: null },
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
