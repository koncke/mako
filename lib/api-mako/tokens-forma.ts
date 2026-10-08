// =============================================================================
// api-mako/tokens-forma — los topes y opciones de un token detallado, sin nada de servidor
// =============================================================================
// Lo que el FORMULARIO de la pantalla necesita saber (las opciones de vencimiento de
// GitHub, los topes del nombre y la descripción) y la API valida. Aparte de tokens-lista.ts
// porque ése importa `node:crypto`, que no existe en el navegador: un componente cliente
// importa ESTE módulo (es una de las excepciones del test de imports del cliente).
// =============================================================================

/** Más de cincuenta es otra cosa (tokens por persona, por cliente de una agencia): se decide,
 *  no se acumula. */
export const MAX_TOKENS = 50;
export const MAX_NOMBRE = 40;
/** GitHub acepta 1024 caracteres en la descripción de un token. */
export const MAX_DESCRIPCION = 1024;
/** El tope de una expiración a elegir, como en GitHub (un año). */
export const MAX_DIAS_EXPIRACION = 366;

/** Las opciones de expiración de GitHub, en el mismo orden. `30` es la de por defecto. */
export const OPCIONES_EXPIRACION = ['7', '30', '60', '90', 'personalizada', 'sin'] as const;
export type OpcionExpiracion = (typeof OPCIONES_EXPIRACION)[number];
export const EXPIRACION_POR_DEFECTO: OpcionExpiracion = '30';
export const TEXTO_EXPIRACION: Record<OpcionExpiracion, string> = {
  '7': '7 días', '30': '30 días', '60': '60 días', '90': '90 días',
  personalizada: 'Personalizada…', sin: 'Sin vencimiento',
};
