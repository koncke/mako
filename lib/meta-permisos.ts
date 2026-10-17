// =============================================================================
// meta-permisos — cuándo un error de Meta es «la conexión no tiene permiso de anuncios»
// =============================================================================
// Sin `server-only`, a propósito: el texto lo usa la tarjeta de /integraciones (un
// componente cliente) y la regla la prueba un test.
//
// EL CASO (08-13/10/2026). Conectada con la app MaKo, la cuenta de Martín (ws9) traía
// la página y los leads pero no `ads_read` ni `ads_management`, y Meta contestaba la
// lectura de la cuenta con «(#200) Ad account owner has NOT grant ads_management or
// ads_read permission». La tarjeta de Meta decía «No se pudo leer el estado de Meta»
// y nada más: el porqué estaba en la respuesta y se tiraba.
//
// La regla sale de los códigos de error que Meta documenta: 10 («API Permission
// Denied») y 200-299 («API Permission»). Se mira el CÓDIGO, no el texto, que Meta
// cambia sin avisar.
// =============================================================================

/** Lo que dice la tarjeta (y el incidente) cuando falta el permiso. */
export const FALTAN_PERMISOS_META = 'Faltan permisos de anuncios';

/** El aviso del detalle: qué pasó y qué hacer, en una frase cada cosa. */
export const AVISO_FALTAN_PERMISOS_META =
  'La conexión de Meta no tiene permiso para ver tus anuncios. Vuelve a conectarla y acepta los permisos de anuncios.';

/** Los permisos sin los cuales el Ads Manager no lee (`ads_read`) ni opera (`ads_management`) la cuenta. */
export const PERMISOS_DE_ANUNCIOS = ['ads_read', 'ads_management'] as const;

/**
 * Los permisos de anuncios que NO vinieron concedidos, leyendo `GET /me/permissions` (`data: [{ permission, status }]`).
 * Al CONECTAR (17/10/2026): hasta ese día la tarjeta lo decía recién cuando una lectura fallaba; ahora el «Conectar con
 * Meta» lo avisa en el acto. Un cuerpo que no se entiende devuelve [] (no se afirma lo que no se sabe).
 */
export function permisosDeAnunciosFaltantes(cuerpo: unknown): string[] {
  const data = (cuerpo as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const concedidos = new Set(data.filter((p) => (p as { status?: unknown }).status === 'granted').map((p) => String((p as { permission?: unknown }).permission)));
  return PERMISOS_DE_ANUNCIOS.filter((p) => !concedidos.has(p));
}

/** ¿El código de error de Meta es de PERMISOS? 10 y 200-299, según la tabla de Meta. */
export function esErrorDePermisoMeta(code: unknown): boolean {
  const n = typeof code === 'number' ? code : Number.NaN;
  return n === 10 || (n >= 200 && n <= 299);
}
