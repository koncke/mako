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
// =============================================================================

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
      return tokenDesconocido
        ? 'Ese token no existe o fue revocado. Genera uno nuevo en MaKo → API → Tokens.'
        : 'Token inválido o revocado.';
  }
}
