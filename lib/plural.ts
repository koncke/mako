// =============================================================================
// plural — la misma cuenta, escrita una sola vez
// =============================================================================
// Estaba escrita DOS veces, con dos firmas casi iguales y dos significados
// distintos: `lib/cs-senal.ts` devolvía sólo LA PALABRA y
// `lib/closing-job-estado.ts` el NÚMERO Y LA PALABRA. Dos funciones con el
// mismo nombre en el mismo repo son la forma más barata de que alguien importe
// la que no era y le salga «3» o «3 3 días».
//
// Sin `server-only` a propósito: lo usan pantallas del navegador (las tarjetas
// del panel de la plataforma) y módulos del server.

/** Sólo la palabra: «día» / «días». `varias` por default es `una` + «s». */
export const palabra = (n: number, una: string, varias = `${una}s`): string =>
  (n === 1 ? una : varias);

/** El número y la palabra: «1 miembro», «3 clientes». */
export const plural = (n: number, una: string, varias = `${una}s`): string =>
  `${n} ${palabra(n, una, varias)}`;
