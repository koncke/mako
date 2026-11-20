// =============================================================================
// LA ENTRADA DE UN VIDEO EN UN CHAT: la pantalla oscura, MaKo escribiendo y el «dale play» (20/11/2026, V5)
// =============================================================================
// Lo acordado (memoria onboarding-16-11-decisiones.md:71; la maqueta, cuerpo.html: b-of-entra, b-d2-entra, el paso «escribe» y la
// marca `invita`): cada chat que abre con un video (los coaches, cada día del reto, la llegada al Ops Center) entra como la
// bienvenida. La pantalla se oscurece y MaKo escribe (los tres puntitos), y después llega el mensaje con el video. Mientras el video
// está QUIETO, el motor lo marca con «{título}: dale play», hasta que lo reproducen o lo cierran.
// Las piezas (todas detrás del interruptor del V2: el motor sólo se monta para quien lo ve):
//   · `useEntrada(clave, activa)` + `<EntradaEscribiendo foto={…} />` (./EntradaEscribiendo.tsx): la primera vez de esa clave,
//     1,8 s de MaKo escribiendo con la pantalla oscura alrededor (con el barrido del sol y la luna: ./iris.ts);
//   · `<VideoDelMomento dalePlay />` (./VideoDelMomento.tsx) o `useDalePlay(ref, …)` (./useDalePlay.ts) para otro botón de play.
// Aquí, sólo las decisiones (las prueba tests/tutorial-entrada.test.ts sin navegador).
// =============================================================================

/** Lo que dura MaKo escribiendo antes del mensaje con el video (lo mismo que la bienvenida del onboarding y la llegada). */
export const MS_ESCRIBE_ENTRADA = 1800;

/** Cuánto del video tiene que verse para marcarlo: medio video asomado abajo no se marca (la tarjeta quedaría afuera). */
export const PARTE_A_LA_VISTA = 0.6;

/** «Tu recorrido por MaKo: dale play» (la maqueta, textual). */
export function tituloDalePlay(titulo: string): string {
  const t = titulo.trim();
  return `${t.charAt(0).toLocaleUpperCase('es')}${t.slice(1)}: dale play`;
}

/**
 * ¿Se marca el video con «dale play»? Sólo QUIETO (nunca reproducido), a la vista, sin otra cosa en el motor (no pisa un tutorial ni
 * otra marca: espera a que terminen) y si la persona no lo cerró con la X.
 */
export function tocaDalePlay(o: { activo: boolean; aLaVista: boolean; motorLibre: boolean; cerrado: boolean }): boolean {
  return o.activo && o.aLaVista && o.motorLibre && !o.cerrado;
}

/** ¿Se suelta la marca que ya está puesta? Cuando el video dejó de estar quieto o salió de la vista. */
export function sueltaDalePlay(o: { activo: boolean; aLaVista: boolean }): boolean {
  return !o.activo || !o.aLaVista;
}

// Lo visto y lo cerrado: la entrada de una clave sale UNA vez, y un «dale play» tocado, reproducido o cerrado con la X no vuelve.
// GUARDADO en el navegador (20/11, la verificación de V5: vivía sólo en la página, y en cada recarga el día de hoy del reto volvía a
// oscurecer la pantalla y a «escribir», y «Día 7: dale play» volvía sobre un video ya visto). Una clave por cosa (la del día del reto
// es `reto-dia-<n>`: se guarda por día). Si el navegador no deja guardar, queda lo de la página.
const entradas = new Set<string>();
const cerrados = new Set<string>();
const leerGuardado = (k: string): boolean => { try { return typeof localStorage !== 'undefined' && localStorage.getItem(k) === '1'; } catch { return false; } };
const guardar = (k: string): void => { try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, '1'); } catch { /* sin storage: queda la página */ } };
export const yaEntro = (clave: string): boolean => entradas.has(clave) || leerGuardado(`mk-entrada:${clave}`);
export const anotarEntrada = (clave: string): void => { entradas.add(clave); guardar(`mk-entrada:${clave}`); };
export const dalePlayCerrado = (clave: string): boolean => cerrados.has(clave) || leerGuardado(`mk-dale-play:${clave}`);
export const cerrarDalePlay = (clave: string): void => { cerrados.add(clave); guardar(`mk-dale-play:${clave}`); };
