/**
 * UNA PESTAÑA DE ANTES DE UN DESPLIEGUE (27/10/2026). Cada build cambia el id de las server actions: una pestaña abierta
 * desde antes llama a uno que ya no existe y Next contesta en inglés («An unexpected response was received from the
 * server», «Failed to find Server Action»). Lo que lo arregla es recargar; reintentar falla igual las veces que se apriete.
 *
 * Medido dos veces: con una clienta el 04/09/2026 en el puente de Flow (app/video-generator/PuenteEnlace.tsx, que tiene su
 * propia copia de esta lectura), y el 26/10/2026 con Leila (Fathom 876470842-10): después de un «Extraer» de varios
 * minutos, con despliegues en el medio, la ficha de los leads RECIÉN extraídos decía «No se pudo cargar el lead» y las de
 * los de antes abrían — salían de la memoria de la ficha (`LeadEditModal`), que se callaba el error. F5 lo arreglaba.
 *
 * Sin `server-only`: la usan componentes del cliente.
 */

/** ¿El error es el de una pestaña de antes de un despliegue? Se reconoce por el texto (Next no expone un código). */
export function esPaginaVieja(e: unknown): boolean {
  const t = e instanceof Error ? `${e.name} ${e.message}` : String(e ?? '');
  return /unexpected response was received from the server|Failed to find Server Action|Server Action .{0,80}not found|UnrecognizedActionError/i.test(t);
}

/** Cuánto tiene que pasar para volver a recargar solo por la misma clave: más seguido, es que recargar no lo arregla. */
export const ENTRE_RECARGAS_MS = 60_000;

/**
 * Recarga en `url` UNA vez por `clave` cada `ENTRE_RECARGAS_MS`. Devuelve si recargó. Sin `sessionStorage` (bloqueado, un
 * modo privado estricto) no recarga sola: sin la marca no hay cómo frenar un bucle, y el que llama muestra el botón.
 */
export function recargarUnaVez(clave: string, url: string, ahora: number = Date.now()): boolean {
  try {
    const k = `mako-recarga:${clave}`;
    const antes = Number(window.sessionStorage.getItem(k) || 0);
    if (ahora - antes < ENTRE_RECARGAS_MS) return false;
    window.sessionStorage.setItem(k, String(ahora));
  } catch {
    return false;
  }
  window.location.assign(url);
  return true;
}

/** La misma página con `?abrir=<id>`: el CRM abre ese lead apenas carga (CrmBoard). */
export function urlParaAbrirLead(href: string, leadId: number): string {
  const u = new URL(href);
  u.searchParams.set('abrir', String(leadId));
  return u.toString();
}
