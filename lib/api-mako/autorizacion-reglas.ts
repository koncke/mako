// =============================================================================
// POR QUÉ un pedido a la API no trae un token usable — la regla, sin servidor (ticket #60, 7/11/2026)
// =============================================================================
// Mauricio escribió desde el móvil que su token «no funciona para conectar Claude», después de probar DOS tokens recién
// generados. Lo que lo destrabó fue darse cuenta SOLO de que el mensaje salía idéntico sin mandar ningún token:
// `autenticar()` contestaba «Token inválido o revocado.» para cuatro cosas distintas. Con todas diciendo lo mismo, el
// camino natural es REGENERAR EL TOKEN una y otra vez, que es lo único que no arregla tres de los cuatro casos.
//
// Vive acá y no en http.ts porque http.ts hace `import 'server-only'` y el corredor de tests
// (scripts/tests-afectados.mjs) usa `node --import tsx --test` SIN `--conditions react-server`: un test que importara
// http.ts se rompería en CI al cargar. Por eso ningún test de este repo importa ese módulo, y por eso la decisión que
// hay que poder probar vive en un archivo puro.
//
// ⚠️ LA CAUSA DE FONDO DEL #60 ERA OTRA, Y NO ESTABA EN /api/v1 (9/11/2026). El cliente de Mauricio le pegaba a
// /api/agente/*, las rutas de la skill de Claude, que seguían contestando «token inválido o revocado» para todo. Y sus
// tokens eran DETALLADOS (MaKo → API → Tokens), que la skill no acepta a propósito: sólo el CLÁSICO de Integraciones →
// Claude (la frontera, tests/api-mako-tokens.test.ts). Reproducido en el ws3 contra producción con un `mako_pat_` real:
// /api/v1 200, /api/agente/contexto, /plan y /skill 401. Por eso `mensajeDeAutorizacionAgente`: el 401 de la skill dice
// CUÁL token va cuando llega uno de la pantalla de API, y manda a Integraciones → Claude cuando el que llegó no existe.
// Lo prueba tests/agente-token-equivocado.test.ts.
// =============================================================================

import { PREFIJO_DETALLADO } from './tokens-lista';
import { PREFIJO_AGENCIA } from './tokens-cartera';
import { PREFIJO_PRINCIPAL } from '../agente-token-nucleo';

/** Un token de la pantalla API → Tokens (el detallado de una cuenta o el de agencia): sólo vale para /api/v1. */
const esDeLaPantallaDeApi = (token: string) => token.startsWith(PREFIJO_DETALLADO) || token.startsWith(PREFIJO_AGENCIA);

/** Qué le pasa a la autorización de un pedido. `bearer` = la cabecera está bien armada. */
export type CasoAutorizacion =
  | { caso: 'sin-cabecera' }
  | { caso: 'sin-esquema' }
  | { caso: 'otro-esquema'; esquema: string }
  | { caso: 'bearer'; token: string };

/** Los esquemas que la API acepta, con el nombre que se escribe en la cabecera. */
const ACEPTADOS = /^(?:bearer|token)\s+(.+)$/i;
/** Un esquema es una palabra seguida de un espacio. Si no hay espacio, lo primero ES el token. */
const ESQUEMA = /^([A-Za-z]{1,20})\s/;

/**
 * Mira la cabecera `Authorization` cruda y dice cuál de los cuatro casos es.
 * ⚠️ No decide si el token EXISTE: eso pide la base. Acá sólo se mira la forma.
 */
export function casoDeAutorizacion(cruda: string | null | undefined): CasoAutorizacion {
  const t = (cruda ?? '').trim();
  if (!t) return { caso: 'sin-cabecera' };
  const m = ACEPTADOS.exec(t);
  if (m) return { caso: 'bearer', token: m[1].trim() };
  const e = ESQUEMA.exec(t);
  return e ? { caso: 'otro-esquema', esquema: e[1] } : { caso: 'sin-esquema' };
}

/**
 * Qué se le dice a quien no pudo autorizarse. `tokenDesconocido` es el cuarto caso: la cabecera venía bien y el token
 * no existe (o fue revocado) — el ÚNICO en el que regenerarlo sirve.
 *
 * ⚠️ DEL HEADER NO SE REPITE NADA SALVO EL ESQUEMA, y sólo cuando vino seguido de un espacio: si llegó sin esquema, lo
 * primero de la cabecera ES el token, y devolverlo en el error lo escribiría en los registros de todo el camino.
 */
export function mensajeDeAutorizacion(c: CasoAutorizacion, tokenDesconocido = false): string {
  switch (c.caso) {
    case 'sin-cabecera':
      return 'Falta el header Authorization. Mándalo como «Authorization: Bearer TU_TOKEN».';
    case 'sin-esquema':
      return 'El header Authorization llegó sin esquema: no alcanza con el token solo. Mándalo como «Authorization: Bearer TU_TOKEN».';
    case 'otro-esquema':
      return `El header Authorization llegó con el esquema «${c.esquema}» y la API espera «Bearer». Mándalo como «Authorization: Bearer TU_TOKEN».`;
    case 'bearer':
      if (!tokenDesconocido) return 'Token inválido o revocado.';
      // El clásico se regenera donde nace: mandar a API → Tokens a quien tiene uno de la skill le da OTRO tipo de token.
      return c.token.startsWith(PREFIJO_PRINCIPAL)
        ? 'Ese token no existe o fue revocado. Es el de la skill de Claude: genera uno nuevo en MaKo → Integraciones → Claude.'
        : 'Ese token no existe o fue revocado. Genera uno nuevo en MaKo → API → Tokens.';
  }
}

// ── /api/agente/* (la skill de Claude) ──────────────────────────────────────

/**
 * El token que la skill lee de la cabecera: SÓLO el esquema «Bearer», como siempre (`/^bearer\s+(.+)$/i`). Es la regla de
 * `bearerDe` (lib/agente-token.ts) sacada a un lugar puro para poder probarla; no la de `casoDeAutorizacion`, que acepta
 * también «token».
 *
 * ⚠️ NO SE AMPLÍA DE PASO (9/11/2026, la revisión de b5f621c6f): la primera versión del arreglo del #60 hizo que `bearerDe`
 * delegara en `casoDeAutorizacion`, y con eso `Authorization: token <mkoag_ vigente>` pasó de 401 a autorizar las siete
 * rutas y /hook. No entraba ninguna credencial nueva, pero la puerta dejó de ser idéntica en un cambio que decía tocar
 * sólo el texto. Abrir el esquema «token» en la skill es una decisión aparte; acá, «token …» es un esquema equivocado y el
 * 401 dice cuál va.
 */
export function bearerDeCabecera(cruda: string | null | undefined): string {
  const m = /^bearer\s+(.+)$/i.exec((cruda ?? '').trim());
  return m ? m[1].trim() : '';
}

/**
 * Los casos de la cabecera para /api/agente: los mismos de `casoDeAutorizacion`, salvo que «token …» (que /api/v1 acepta)
 * acá es un esquema equivocado, porque `bearerDeCabecera` no lo lee. Así el 401 nunca dice «ese token no existe» de un
 * token que ni siquiera se miró.
 */
export function casoDeAutorizacionAgente(cruda: string | null | undefined): CasoAutorizacion {
  const token = bearerDeCabecera(cruda);
  if (token) return { caso: 'bearer', token };
  const c = casoDeAutorizacion(cruda);
  if (c.caso !== 'bearer') return c;
  // Llegó con un esquema que /api/v1 acepta y la skill no («token»). Del header se repite sólo esa palabra.
  return { caso: 'otro-esquema', esquema: ESQUEMA.exec((cruda ?? '').trim())?.[1] ?? 'token' };
}

/**
 * Lo que contesta el 401 de /api/agente/* (las rutas de la skill de Claude). Sólo se llama cuando el bearer NO resolvió
 * a un workspace, así que `bearer` quiere decir «no es un token de la skill vigente».
 *
 * ⚠️ LA SKILL NO ACEPTA LOS TOKENS DE API → TOKENS, Y ESO NO SE CAMBIA ACÁ: `/api/agente/skill` mete en el archivo el
 * bearer que se le presentó y el reporte del plugin tiene su consentimiento atado al clásico (lib/api-mako/tokens-lista.ts).
 * Lo que sí se hace es DECIRLO: «inválido o revocado» sobre un token vigente de otra pantalla mandaba a regenerarlo, que
 * es lo único que nunca lo arregla. Mismo cuidado que arriba: del token no se repite nada.
 * ⚠️ «PARECE», NO «ES»: esto no mira la base, sólo el prefijo. Un `mako_pat_` revocado o inventado oye lo mismo que uno
 * vigente, así que no se le afirma que «sirve» para /api/v1: se le dice por dónde van esos tokens.
 */
export function mensajeDeAutorizacionAgente(c: CasoAutorizacion): string {
  const deLaSkill = 'con el token de la skill: MaKo → Integraciones → Claude';
  switch (c.caso) {
    case 'sin-cabecera':
      return `Falta el header Authorization. Mándalo como «Authorization: Bearer TU_TOKEN», ${deLaSkill}.`;
    case 'sin-esquema':
      return `El header Authorization llegó sin esquema: no alcanza con el token solo. Mándalo como «Authorization: Bearer TU_TOKEN», ${deLaSkill}.`;
    case 'otro-esquema':
      return `El header Authorization llegó con el esquema «${c.esquema}» y la skill espera «Bearer». Mándalo como «Authorization: Bearer TU_TOKEN», ${deLaSkill}.`;
    case 'bearer':
      return esDeLaPantallaDeApi(c.token)
        ? `Ese parece un token de MaKo → API → Tokens: esos van por la API (/api/v1), no por la skill de Claude. La skill usa su propio token, el de MaKo → Integraciones → Claude (empieza con «${PREFIJO_PRINCIPAL}»). Generar otro en API → Tokens no lo arregla.`
        : 'Ese token no existe o fue revocado. La skill de Claude usa el token de MaKo → Integraciones → Claude: genera uno nuevo ahí.';
  }
}
