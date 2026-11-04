// =============================================================================
// Los gurús con su FICHA escrita y SIN su caricatura todavía (4/11/2026)
// =============================================================================
// Martín: «faltan un montón de gurús que nos habían quedado por la mitad». Son los doce que pidió el 2/11 menos Puigrredón y
// Alborna (docs/pendientes-martin.md, #14), con su curso ya localizado (./cursos.ts). Un gurú necesita las DOS cosas: su ficha
// destilada de un curso de Knowledge y su caricatura (public/asesores/<id>.png y public/asesores/grandes/<id>.png), la que aprueba
// Martín. La ficha se escribe en la nube; la caricatura se hace con Canva desde la PC (el prompt aprobado, en
// docs/hallazgos-ops-center.md), y una sesión en la nube no tiene Canva.
//
// CÓMO ENTRA UNO A LA GALERÍA, cuando llega su cara: se suben sus dos PNG, se pasa su fila de acá a `ASESORES` (y su id a
// `IdAsesor`) en ./catalogo.ts, y su ficha a `FICHAS` en ./fichas.ts. `tests/gurus-en-espera.test.ts` lo pide en cuanto ve el PNG.
//
// ⚠️ NO SE ELIGEN NI SE CONTESTAN DESDE ACÁ: sin cara, su fila sería un disco vacío (tests/coaches-ops-center.test.ts). Sólo el
// servidor: las fichas pesan, y el navegador no las usa.

import { FICHA_JUAN_CARRIZO } from './ficha-juan-carrizo';
import { FICHA_VILMA_NUNEZ } from './ficha-vilma-nunez';
import { FICHA_SAMUEL_ALBAA } from './ficha-samuel-albaa';
import { FICHA_ALVARO_LUQUE } from './ficha-alvaro-luque';
import { FICHA_SERGIO_BEGUERIA } from './ficha-sergio-begueria';
import { FICHA_ROMUALD_FONS } from './ficha-romuald-fons';
import { FICHA_MATEO_MAFFIA } from './ficha-mateo-maffia';
import { FICHA_FRANCISCO_DOGLIO } from './ficha-francisco-doglio';
import { FICHA_ANDY_LANDA } from './ficha-andy-landa';
import { FICHA_GONZALO_SERE } from './ficha-gonzalo-sere';

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

export const EN_ESPERA: readonly GuruEnEspera[] = [
  { id: 'juan-carrizo', nombre: 'Juan Carrizo', completo: 'Juan Carrizo', especialidad: 'Oferta y valor', curso: 'Aumenta tu valor y ATV ADVANTAGE', ficha: FICHA_JUAN_CARRIZO },
  { id: 'vilma-nunez', nombre: 'Vilma Núñez', completo: 'Vilma Núñez', especialidad: 'Marketing y crecimiento', curso: 'Certificación en Marketing Digital potenciada por IA', ficha: FICHA_VILMA_NUNEZ },
  { id: 'samuel-albaa', nombre: 'Samuel Albaa', completo: 'Samuel Albaa', especialidad: 'Práctica del closer', curso: 'Growing Closer', ficha: FICHA_SAMUEL_ALBAA },
  { id: 'alvaro-luque', nombre: 'Álvaro Luque', completo: 'Álvaro Luque', especialidad: 'Lanzamientos', curso: 'The perfect launch', ficha: FICHA_ALVARO_LUQUE },
  { id: 'sergio-begueria', nombre: 'Sergio Begueria', completo: 'Sergio Begueria', especialidad: 'Marca personal y video', curso: 'Instituto De Marca Personal', ficha: FICHA_SERGIO_BEGUERIA },
  { id: 'romuald-fons', nombre: 'Romuald Fons', completo: 'Romuald Fons', especialidad: 'SEO', curso: 'Bigseo Academy', ficha: FICHA_ROMUALD_FONS },
  { id: 'mateo-maffia', nombre: 'Mateo Maffia', completo: 'Mateo Maffia', especialidad: 'Video corto que vende', curso: 'BYF', ficha: FICHA_MATEO_MAFFIA },
  { id: 'francisco-doglio', nombre: 'Francisco Doglio', completo: 'Francisco Doglio', especialidad: 'Equipo comercial y webinars', curso: 'ARCADIA', ficha: FICHA_FRANCISCO_DOGLIO },
  { id: 'andy-landa', nombre: 'Andy Landa', completo: 'Andy Landa', especialidad: 'Automatizaciones de Instagram', curso: 'ManyChat Master - Instagram', ficha: FICHA_ANDY_LANDA },
  { id: 'gonzalo-sere', nombre: 'Gonzalo Seré', completo: 'Gonzalo Seré', especialidad: 'Estrategia de contenido', curso: 'Growing Content Specialist', ficha: FICHA_GONZALO_SERE },
];

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
