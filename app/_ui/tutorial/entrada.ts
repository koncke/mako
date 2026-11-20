// =============================================================================
// LA ENTRADA DE UN VIDEO EN UN CHAT: la pantalla oscura, MaKo escribiendo y el «dale play» (20/11/2026, V5)
// =============================================================================
// Lo acordado (memoria onboarding-16-11-decisiones.md:71; la maqueta, cuerpo.html: b-of-entra, b-d2-entra, el paso «escribe» y la
// marca `invita`): cada chat que abre con un video (los coaches, cada día del reto, la llegada al Ops Center) entra como la
// bienvenida. La pantalla se oscurece y MaKo escribe (los tres puntitos), y después llega el mensaje con el video. Mientras el video
// está QUIETO, el motor lo marca con «{título}: dale play», hasta que lo reproducen o lo cierran.
// Las piezas (todas detrás del interruptor del V2: el motor sólo se monta para quien lo ve):
//   · `useEntrada(clave, activa)` + `<EntradaEscribiendo foto={…} />` (./EntradaEscribiendo.tsx): la primera vez de esa clave,
//     MaKo escribiendo (según el largo de lo que dice: lib/puntitos.ts) con la pantalla oscura alrededor (con el barrido: ./iris.ts);
//   · `<VideoDelMomento dalePlay />` (./VideoDelMomento.tsx) o `useDalePlay(ref, …)` (./useDalePlay.ts) para otro botón de play.
// Aquí, sólo las decisiones (las prueba tests/tutorial-entrada.test.ts sin navegador).
// =============================================================================

// Lo que dura MaKo escribiendo antes del mensaje con el video: ya no 1,8 s fijos (20/11, la auditoría de chats, videos-4), sino la
// función única de todos los chats según el largo de lo que dice (lib/puntitos.ts → msEscribiendo; sin texto, el tope: 3,5 s, la maqueta).

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

/**
 * ¿El video ya está DIBUJADO? (20/11/2026, el Cerebro en producción: con el arranque en frío la página tardó 15 s, y «Tu recorrido por
 * MaKo: dale play» salía desvanecida sobre la pantalla vacía.) La marca oscurece todo menos el video, y el video era el cuadro vacío: el
 * manifiesto o el póster todavía en camino. «A la vista» mide el LUGAR, no si hay algo dibujado: el «dale play» espera a que SU póster
 * (no otro) haya cargado. Sin póster no hay nada que señalar.
 */
export function videoDibujado(o: { poster: string | null | undefined; posterCargado: string | null }): boolean {
  return !!o.poster && o.posterCargado === o.poster;
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
