// Las acciones del servidor del explorador de carruseles, de mentira: tests/carruseles-pantalla.test.ts dibuja la pantalla sin
// servidor (las de verdad importan la base). No es un test: lo importa el test.
export const guardarCarruselAction = async () => ({ ok: true as const, ids: [] as number[] });
export const guardarThumbnailAction = async () => ({ ok: true as const, ids: [] as number[] });
export const guardarBusquedaAction = async () => ({ ok: true as const, busquedas: [] });
export const borrarBusquedaAction = async () => ({ ok: true as const, busquedas: [] });
