// =============================================================================
// Los gurús con su FICHA escrita y SIN su caricatura todavía — hoy no hay ninguno (4/11/2026)
// =============================================================================
// Martín: «faltan un montón de gurús que nos habían quedado por la mitad». Eran diez (juan-carrizo, vilma-nunez, samuel-albaa,
// alvaro-luque, sergio-begueria, romuald-fons, mateo-maffia, francisco-doglio, andy-landa, gonzalo-sere): su ficha estaba escrita
// (se escribe en la nube) y faltaba su caricatura, que se hace con Canva desde la PC (el prompt aprobado, en docs/hallazgos-ops-center.md).
// El mismo 4/11 llegaron las diez caras y pasaron a `ASESORES` (./catalogo.ts) y a `FICHAS` (./fichas.ts): la lista quedó vacía.
//
// SIGUE SIENDO LA SALA DE ESPERA para el próximo. Un gurú necesita las DOS cosas: su ficha destilada de un curso de Knowledge y su
// caricatura (public/asesores/<id>.png y public/asesores/grandes/<id>.png), la que aprueba Martín.
//
// CÓMO ENTRA UNO A LA GALERÍA, cuando llega su cara: se suben sus dos PNG, se pasa su fila de acá a `ASESORES` (y su id a
// `IdAsesor`) en ./catalogo.ts, y su ficha a `FICHAS` en ./fichas.ts. `tests/gurus-en-espera.test.ts` lo pide en cuanto ve el PNG.
//
// ⚠️ NO SE ELIGEN NI SE CONTESTAN DESDE ACÁ: sin cara, su fila sería un disco vacío (tests/coaches-ops-center.test.ts). Sólo el
// servidor: las fichas pesan, y el navegador no las usa.

/** Un gurú que espera su caricatura: lo mismo que una fila de `ASESORES`, con su ficha al lado. */
export type GuruEnEspera = {
  id: string;
  nombre: string;
  completo: string;
  especialidad: string;
  /** El curso de Knowledge del que sale su ficha (su slug está en ./cursos.ts). */
  curso: string;
  ficha: string;
};

export const EN_ESPERA: readonly GuruEnEspera[] = [];

/** El tope de una ficha: viaja en cada mensaje del chat (lib/asesores/contexto.ts). Es el mismo de tests/coaches-ops-center.test.ts. */
export const TOPE_FICHA = 5_200;

/**
 * Lo que una ficha nueva tiene que cumplir para entrar, como texto que se puede mostrar. Vacío = lista. `marcasDeVoseo` y `hayPng` se
 * pasan de afuera: lo que lee el disco o la guarda del voseo no vive en este módulo.
 */
export function problemasDeLaFicha(g: GuruEnEspera, o: { marcasDeVoseo: (t: string) => string[]; hayPng: boolean }): string[] {
  const p: string[] = [];
  const f = g.ficha;
  if (f.length <= 2_000 || f.length > TOPE_FICHA) p.push(`mide ${f.length} caracteres: va entre 2.000 y ${TOPE_FICHA}`);
  if (!f.includes(`«${g.curso}»`)) p.push(`no nombra su curso, «${g.curso}»: el chat dice de dónde sale lo que aconseja`);
  if (!/no hables como si fueras (él|ella)/.test(f)) p.push('no dice «no hables como si fueras él»: el chat nunca dice ser esa persona');
  if (!/\(clase: /.test(f)) p.push('cada marco dice de qué clase sale («(clase: …)»)');
  if (!/NO SE TRASLADA/.test(f)) p.push('falta «⚠️ NO SE TRASLADA»: lo que el curso enseña y el chat no repite (promesas de ingresos, escasez inventada)');
  const voseo = o.marcasDeVoseo(f);
  if (voseo.length) p.push(`tiene voseo (${voseo.slice(0, 3).join(', ')}): la app habla de tú`);
  if (o.hayPng) p.push('ya tiene su caricatura: pásalo a ASESORES (lib/asesores/catalogo.ts) y su ficha a FICHAS (lib/asesores/fichas.ts)');
  return p;
}
