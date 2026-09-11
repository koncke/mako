// =============================================================================
// meta-identidad — con qué página de Facebook y qué Instagram sale un anuncio
// =============================================================================
// Puro (sin server-only): lo usan el wizard (para decidir si pregunta) y el server
// (para validar lo que llega del navegador), y se prueba en node:test.
//
// Pedido de Martín el 2026-09-11: «un usuario de MaKo en su cuenta de Meta puede tener
// varios Facebook o varios Instagram y no hay un paso para seleccionar en cuál se van a
// publicar los ads». Hasta acá la página salía FIJA de la credencial META_PAGE_ID y el
// Instagram del primero que devolviera Meta.
//
// Las opciones salen de lo que la CONEXIÓN puede usar, medido ese día:
//   · /me/accounts con `tasks` → páginas; sólo sirven las que tienen ADVERTISE (sin
//     esa tarea Meta rechaza el anuncio con 1885499, reproducido en ws13);
//   · `instagram_business_account` de cada página + `/{act}/instagram_accounts` → los
//     Instagram con los que la cuenta publicitaria puede publicar.
// En ws13 dio 1 página («Joan») con 1 Instagram (@joandowd.gm); en ws1, 1 página y
// ningún Instagram. Con UNA opción no se pregunta nada: el paso no existe.
// =============================================================================

export type InstagramOpcion = { id: string; username: string | null };

export type PaginaOpcion = {
  id: string;
  nombre: string;
  /** La conexión tiene la tarea ADVERTISE en esta página. */
  puedeAnunciar: boolean;
  /** Instagram vinculado a ESTA página (instagram_business_account), si tiene. */
  instagram: InstagramOpcion | null;
};

export type Identidad = { pageId: string; instagramId: string | null };

/** Las páginas con las que se puede publicar, en el orden de Meta. */
export const paginasUsables = (paginas: PaginaOpcion[]) => paginas.filter((p) => p.puedeAnunciar);

/**
 * Instagram con los que puede salir un anuncio de esta página: el propio de la página
 * primero, y después los de la cuenta publicitaria que no sean ése. Sin duplicados.
 */
export function instagramsPara(pagina: PaginaOpcion | null, deLaCuenta: InstagramOpcion[]): InstagramOpcion[] {
  const out: InstagramOpcion[] = [];
  const vistos = new Set<string>();
  for (const ig of [...(pagina?.instagram ? [pagina.instagram] : []), ...deLaCuenta]) {
    if (!ig?.id || vistos.has(ig.id)) continue;
    vistos.add(ig.id);
    out.push(ig);
  }
  return out;
}

/**
 * La identidad por defecto: la página de la credencial si se puede usar (es lo que
 * el cliente eligió al conectar), si no la única usable. Su Instagram por defecto es el
 * primero de `instagramsPara`. null = no hay con qué publicar.
 */
export function identidadPorDefecto(paginas: PaginaOpcion[], deLaCuenta: InstagramOpcion[], paginaCredencial: string | null): Identidad | null {
  const usables = paginasUsables(paginas);
  const pagina = usables.find((p) => p.id === paginaCredencial) ?? (usables.length === 1 ? usables[0] : usables[0] ?? null);
  if (!pagina) return null;
  return { pageId: pagina.id, instagramId: instagramsPara(pagina, deLaCuenta)[0]?.id ?? null };
}

/** ¿Hay algo que ELEGIR? Con una página usable y a lo sumo un Instagram, no. */
export function hayQuePreguntar(paginas: PaginaOpcion[], deLaCuenta: InstagramOpcion[]): boolean {
  const usables = paginasUsables(paginas);
  if (usables.length > 1) return true;
  return usables.length === 1 && instagramsPara(usables[0], deLaCuenta).length > 1;
}

/**
 * Lo que llega del navegador se valida contra lo que la conexión puede usar: una
 * página donde no es anunciante o un Instagram que no le corresponde se rechazan con
 * un motivo, en vez de dejar que Meta lo rechace a mitad de crear la campaña.
 * `instagramId: null` es válido: «sólo Facebook».
 */
export function validarIdentidad(elegida: Identidad, paginas: PaginaOpcion[], deLaCuenta: InstagramOpcion[]): string | null {
  const pagina = paginas.find((p) => p.id === elegida.pageId);
  if (!pagina) return 'Esa página de Facebook no está en tu conexión de Meta. Elige otra o vuelve a conectar Meta en Integraciones.';
  if (!pagina.puedeAnunciar) return `Tu conexión de Meta no es anunciante en «${pagina.nombre}»: Meta no deja publicar con esa página.`;
  if (elegida.instagramId && !instagramsPara(pagina, deLaCuenta).some((ig) => ig.id === elegida.instagramId)) {
    return 'Esa cuenta de Instagram no está vinculada a la página ni a tu cuenta publicitaria.';
  }
  return null;
}
