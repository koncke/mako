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

/** ¿El código de error de Meta es de PERMISOS? 10 y 200-299, según la tabla de Meta. */
export function esErrorDePermisoMeta(code: unknown): boolean {
  const n = typeof code === 'number' ? code : Number.NaN;
  return n === 10 || (n >= 200 && n <= 299);
}
