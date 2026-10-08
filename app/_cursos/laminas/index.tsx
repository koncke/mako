/**
 * EL CATÁLOGO DE LÁMINAS DIBUJADAS y la pieza que despacha a cada una (item 5 del curso tipo Skool,
 * 07/10/2026; contrato en docs/diseno-curso-skool.md, D6).
 *
 *   LAMINAS   los diseños de lib/laminas.ts (`DISENOS_LAMINA`: id, nombre, tope, colores) con su
 *             dibujo y la tinta de su texto. Una fila de allá sin dibujo acá no entra (y el test lo
 *             dice); un dibujo sin fila no se puede guardar.
 *   <Lamina>  dibuja una lámina: `diseno n rotulo texto a b className`, más `nombre` (lo que va
 *             debajo del número cuando `texto` está vacío) e `instancia` (para separar dos iguales
 *             en la misma página: la tarjeta y su miniatura en el selector).
 *
 * Sin `'use client'` y sin hooks: lo dibuja el server (el portal del alumno) y el navegador (el
 * selector, la tab Curso). Lo que se guarda y su saneo NO viven acá: viven en lib/laminas.ts, que
 * no puede depender de React.
 */

import type { JSX } from 'react';
import {
  DISENOS_LAMINA, DISENO_DEFAULT, disenoLamina, hexLamina, textoLamina, valorDeLamina,
  type DisenoLamina, type ValorLamina,
} from '@/lib/laminas';
import { ACENTO_DEFAULT, hexValido, mezclar } from '@/lib/curso-estilo';
import { h32 } from '@/app/conocimientos/PortadaModulo';
import { textoDeLamina, uidLamina, type AjusteDeTexto, type PropsDibujo } from './comun';
import { Cuaderno, tintaCuaderno } from './cuaderno';
import { AJUSTE_PIZARRA, Pizarra, tintaPizarra } from './pizarra';
import { AJUSTE_NOTA, Nota, tintaNota } from './nota';
import { AJUSTE_KRAFT, Kraft, tintaKraft } from './kraft';
import { AJUSTE_PLANO, Plano, tintaPlano } from './plano';
import { AJUSTE_POSTER, Poster, tintaPoster } from './poster';
import { AJUSTE_ENTRADA, Entrada, tintaEntrada } from './entrada';

/** La tinta del texto de un diseño y lo que tiene detrás: lo que el test del contraste mide. */
type TintaDe = (a: string, b: string) => { tinta: string; fondo: string };
type Entrada_ = { Dibujo: ((p: PropsDibujo) => JSX.Element) | null; tinta: TintaDe; ajuste: AjusteDeTexto | null };

/**
 * `Dibujo: null` = el cuaderno, que no recibe `PropsDibujo` (es PortadaModulo con sus propias props),
 * y `ajuste: null` porque su texto lo acomoda la cadena de restas de PortadaModulo, no una caja fija.
 */
const DIBUJOS: ReadonlyMap<string, Entrada_> = new Map<string, Entrada_>([
  ['cuaderno', { Dibujo: null, tinta: (a) => tintaCuaderno(a), ajuste: null }],
  ['pizarra', { Dibujo: Pizarra, tinta: (a) => tintaPizarra(a), ajuste: AJUSTE_PIZARRA }],
  ['nota', { Dibujo: Nota, tinta: (a) => tintaNota(a), ajuste: AJUSTE_NOTA }],
  ['kraft', { Dibujo: Kraft, tinta: (a) => tintaKraft(a), ajuste: AJUSTE_KRAFT }],
  ['plano', { Dibujo: Plano, tinta: (a) => tintaPlano(a), ajuste: AJUSTE_PLANO }],
  ['poster', { Dibujo: Poster, tinta: (a) => tintaPoster(a), ajuste: AJUSTE_POSTER }],
  ['entrada', { Dibujo: Entrada, tinta: (a) => tintaEntrada(a), ajuste: AJUSTE_ENTRADA }],
]);

export type LaminaDelCatalogo = DisenoLamina & { tintaDelTexto: TintaDe; ajuste: AjusteDeTexto | null };

/** El catálogo, en el orden en que lo ofrece el selector. Sólo los diseños que tienen dibujo. */
export const LAMINAS: readonly LaminaDelCatalogo[] = DISENOS_LAMINA.flatMap((d) => {
  const x = DIBUJOS.get(d.id);
  return x ? [{ ...d, tintaDelTexto: x.tinta, ajuste: x.ajuste }] : [];
});

/** Los ids que tienen dibujo (para el test: el catálogo de lib/laminas.ts y éste dicen lo mismo). */
export const DISENOS_DIBUJADOS: readonly string[] = [...DIBUJOS.keys()];

/**
 * Los colores con los que NACE un diseño en el selector.
 *
 * ⚠️ EL CUADERNO NACE CON EL ACENTO DEL CURSO, no con el lima: es lo que dibuja una tarjeta sin
 *    portada (`varsDeAcento` en lib/curso-estilo.ts: el brochazo es el acento aclarado un 25 % y el
 *    sticker, el acento). Con el lima de siempre, cuando nadie eligió acento.
 */
export function coloresDeLamina(diseno: string, acento?: string | null): { a: string; b: string } {
  const d = disenoLamina(diseno) ?? (disenoLamina(DISENO_DEFAULT) as DisenoLamina);
  if (d.id === DISENO_DEFAULT) {
    const ac = hexValido(acento);
    if (ac && ac !== ACENTO_DEFAULT) return { a: mezclar(ac, '#FFFFFF', 0.25), b: ac };
  }
  return { a: d.a, b: d.b };
}

/**
 * ¿Esta lámina ES la de siempre? El cuaderno, con los colores del acento y sin texto propio: lo
 * mismo que dibuja una tarjeta sin portada. El selector guarda `null` en ese caso (volver al
 * default) en vez de una copia, así la tarjeta sigue al acento si después cambia.
 */
export function esLaminaDeSiempre(l: ValorLamina, acento?: string | null): boolean {
  if (l.diseno !== DISENO_DEFAULT || textoLamina(l.texto, 999) !== '') return false;
  const c = coloresDeLamina(DISENO_DEFAULT, acento);
  return hexLamina(l.a) === c.a && hexLamina(l.b) === c.b;
}

/** Lo que el selector guarda al elegir `l`: `null` si es la de siempre, el valor `lam:` si no. */
export const valorElegido = (l: ValorLamina, acento?: string | null): string | null =>
  (esLaminaDeSiempre(l, acento) ? null : valorDeLamina(l));

/**
 * ¿La tarjeta dibuja su chip del número (`.ugc-modcard-n`, el cuadradito lima de arriba a la
 * izquierda) encima de esta lámina? Sí sin lámina, y con los diseños que dejan esa esquina libre.
 *
 * ⚠️ El chip mide 28 css px a 10 px del borde, o sea más o menos el cuadrado de 10 a 47 del lienzo
 *    (la tarjeta tiene 260 a 330 px de ancho). El cuaderno la deja sobre el espiral —su contenido
 *    arranca en x 47— y la nota sobre el corcho (la nota arranca en x 62): conviven con el chip. Los
 *    otros la usan: el rótulo del póster arranca en (16, 18), la cinta del kraft en (16, 20), la
 *    franja del talón de la entrada en (14, 32), el número de la pizarra en (30, 22) y la cota del
 *    plano en x 20. Dibujadas como la tarjeta con el chip encima (revisión del 08/10/2026, captura
 *    en Chrome a 280 px), el póster y el kraft perdían la «M» de «MÓDULO» y la pizarra la punta del
 *    número. Y esos diseños ya dibujan el número, grande: el chip sólo lo repetía.
 *    Un diseño nuevo que deje la esquina libre se suma a `DEJAN_LA_ESQUINA`.
 */
const DEJAN_LA_ESQUINA: ReadonlySet<string> = new Set(['cuaderno', 'nota']);
export const conChipDeNumero = (l: { diseno: string } | null | undefined): boolean =>
  !l || DEJAN_LA_ESQUINA.has(disenoLamina(l.diseno)?.id ?? DISENO_DEFAULT);

/**
 * UNA LÁMINA. Todo lo que llega se sanea acá —un diseño que no existe dibuja el cuaderno, un color
 * roto el del diseño—, porque esto también se monta con datos de la base.
 */
export function Lamina({ diseno, n, rotulo, texto, nombre, a, b, className, instancia }: {
  diseno: string; n: number; rotulo: string;
  /** El texto elegido. Vacío = `nombre`. */
  texto?: string | null;
  /** El nombre del módulo (o de la clase): lo que se dibuja si no hay texto elegido. */
  nombre?: string | null;
  a?: string | null; b?: string | null;
  className?: string;
  instancia?: string;
}) {
  const d = disenoLamina(diseno) ?? (disenoLamina(DISENO_DEFAULT) as DisenoLamina);
  const ca = hexLamina(a) ?? d.a;
  const cb = hexLamina(b) ?? d.b;
  const x = DIBUJOS.get(d.id);
  if (!x?.Dibujo) {
    return <Cuaderno n={n} rotulo={rotulo} propio={textoLamina(texto, d.tope)} nombre={nombre ?? ''} a={ca} b={cb}
      className={className} instancia={instancia} />;
  }
  const t = textoDeLamina(texto, nombre, d.tope);
  const Dibujo = x.Dibujo;
  return (
    <Dibujo n={n} rotulo={rotulo} texto={t} a={ca} b={cb} className={className}
      uid={uidLamina([d.id, n, t, ca, cb, rotulo, instancia])} semilla={h32(`${n}|${t}`)} />
  );
}
