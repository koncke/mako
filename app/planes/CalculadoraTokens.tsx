// =============================================================================
// La calculadora de MaKo Tokens de /planes — el deslizable, y lo que mueve en cada columna (15/11/2026)
// =============================================================================
// Martín (14/11/2026): «estaría bueno como lo tienen otros en pricing, hacer como la calculadora en donde tú puedes arrastrar
// para calcular la cantidad de tokens. Y que vaya cambiando como el pricing según la cantidad de token que quieras».
//
// LA TERCERA VUELTA DEL MISMO DÍA, y lo que pidió en cada una:
//   1. «Está horrible… Prefiero algo simple… que sea el deslizable y listo»; «pusiste MaKo Pro al lado cuando ya tenemos una
//      columna de MaKo Pro abajo»; «la idea justamente es que cuando yo haga el desplazable, se me modifica el precio de las
//      columnas». → la barra es el único control y mueve el precio de las columnas de abajo. Sin tarjeta propia.
//   2. «No tiene absoluto sentido que calcula cuántos MaKo Tokens necesitas quede en el medio y no llegue hasta el final»;
//      «elimina textos innecesarios, como el texto que está debajo… y el texto que dice si te faltan sumás más cuando
//      quieras»; «no me gusta el desplazable que hiciste… me gustaba más el anterior… no se nota que es un desplazable».
//      → a todo el ancho de las columnas, el título solo, y LA BARRA DE ANTES: la parte que traen los planes en azul, lo que
//      se suma en negro, y la cifra viajando sobre la barra (la que estaba en producción hasta el 15/11).
//   3. «cuando voy desplazando a más MaKo Tokens, debería ahí justamente cambiar la cantidad de clips o de imágenes que me
//      alcanzan… y el resto de cosas, como el análisis de los competidores, las transcripciones… en cada una de las columnas».
//      → cada columna dice para cuánto le alcanzan SUS tokens (`fraseAlcanza`), y la barra lo mueve junto con el precio.
//
// LOS NÚMEROS NO SE ESCRIBEN ACÁ:
//   · lo que trae cada plan: `CUPO_MENSUAL` por la capa del plan (`PLAN_DE_CAPA`, lib/mako-tokens-reglas.ts).
//     ⚠️ Sus claves son `pro` = MaKo Esencial (US$47) y `growth` = MaKo Pro (US$97): los nombres de agosto, cruzados.
//   · lo que cuesta cada cosa: el clip y la imagen de lib/mako-tokens-reglas.ts y lib/mako-tokens-paquetes.ts, y el resto
//     del MEDIDOR (`mtReservaDeFeature`, lib/mako-tokens-costos.ts), que es el que descuenta de verdad. Un costo escrito a
//     ojo en la vitrina es un cobro inventado.
//   · lo que cuesta sumar: la tarifa (`MT_POR_DOLAR`, US$1 = 250 MT), redondeada hacia arriba al dólar.
//
// Un script chico (`data-visor`) mueve los números: anda sin React y también en el visor de las landings. El único control
// es un <input type=range>, invisible encima de la barra dibujada.
// =============================================================================

import type { CSSProperties } from 'react';
import { MT_POR_DOLAR, MT_POR_CLIP, GENERA_VIDEO } from '@/lib/mako-tokens-paquetes';
import { CUPO_MENSUAL, PLAN_DE_CAPA, mtDeImagenes, type Plan } from '@/lib/mako-tokens-reglas';
import { mtReservaDeFeature } from '@/lib/mako-tokens-costos';
import { GENERACION_SE_VENDE } from '@/lib/planes-comparacion';

const mil = (n: number) => n.toLocaleString('es-AR');

/** El plan como lo necesita la calculadora (lo pasa la vitrina). */
export type PlanCalculadora = { id: string; nombre: string; capa: string; precioUsd: number; cobrable: boolean; destacado?: boolean };

/**
 * LO QUE SE CUENTA EN CADA COLUMNA, en el orden en que se lee (15/11/2026).
 *
 * Martín: «cuando voy desplazando… debería cambiar la cantidad de clips o de imágenes que me alcanzan… también sería bueno
 * de que ya se calcule el resto de cosas, como por ejemplo el análisis de los competidores, las transcripciones o el resto
 * de cosas que también puedan aparecer. Eso en cada una de las columnas».
 *
 * ⚠️ CADA COSTO SALE DE DONDE SE COBRA, no de acá. El clip (`MT_POR_CLIP`) y la imagen (`mtDeImagenes`) son las reglas de
 * venta; el resto es el costo MEDIDO del medidor (`mtReservaDeFeature`, lib/mako-tokens-costos.ts), que es lo que se
 * descuenta del saldo. El `feature` es el del medidor: uno mal escrito cae en su costo por defecto SIN avisar, y por eso un
 * test exige que los cuatro existan de verdad.
 * ⚠️ Y SE ELIGIERON POR SER COSAS QUE LA PERSONA RECONOCE y que se hacen muchas veces — no por ser las más caras. Lo que
 *    Martín nombró (competidores, transcripciones) más lo que más se usa (guiones) y lo que más pesa (la landing entera).
 *
 * `generacion`: el clip y la imagen son GENERACIÓN, y sólo se cuentan si se vende (`GENERACION_SE_VENDE`). `video`: el clip
 * sólo se cuenta en un plan que genera video (`GENERA_VIDEO`): el de US$47 no lo trae, y decirle «te alcanza para N clips»
 * sería prometerle lo que su plan no hace.
 */
export type CosaQueAlcanza = {
  readonly clave: string;
  readonly uno: string;
  readonly varios: string;
  readonly mt: number;
  readonly generacion?: boolean;
  readonly video?: boolean;
  /** El `feature` del medidor de donde sale el costo, cuando sale de ahí. */
  readonly feature?: string;
};

const DEL_MEDIDOR = (clave: string, feature: string, uno: string, varios: string): CosaQueAlcanza =>
  ({ clave, feature, uno, varios, mt: mtReservaDeFeature(feature) });

export const LO_QUE_ALCANZA: readonly CosaQueAlcanza[] = [
  { clave: 'clip', uno: 'clip de video', varios: 'clips de video', mt: MT_POR_CLIP, generacion: true, video: true },
  { clave: 'imagen', uno: 'imagen', varios: 'imágenes', mt: mtDeImagenes(1), generacion: true },
  DEL_MEDIDOR('competidor', 'spy', 'análisis de un competidor', 'análisis de competidores'),
  DEL_MEDIDOR('llamada', 'Llamada grabada · transcribir', 'llamada de venta transcripta', 'llamadas de venta transcriptas'),
  DEL_MEDIDOR('guion', 'reels-writer', 'guion de reel', 'guiones de reels'),
  DEL_MEDIDOR('landing', 'landing-writer', 'landing escrita con IA', 'landings escritas con IA'),
];

/**
 * Una cantidad, REDONDEADA HACIA ABAJO a una cifra que se lea: 2.666 → 2.600, 545 → 540, 26 → 26.
 *
 * Martín pidió números redondos para el cliente, y hacia abajo porque es una promesa: «te alcanza para 2.666» es un
 * número que parece un error de cálculo, y «2.700» promete 34 que no entran.
 */
export function redondoParaLeer(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1000) return Math.floor(n / 100) * 100;
  if (n >= 100) return Math.floor(n / 10) * 10;
  return Math.floor(n);
}

/** Para cuánto alcanzan `mt` MaKo Tokens en un plan que genera video (o no). Sin ceros: lo que no alcanza ni para uno, no va. */
export function alcanzaPara(mt: number, conVideo: boolean): Array<{ clave: string; n: number; que: string }> {
  return LO_QUE_ALCANZA
    .filter((c) => (!c.generacion || GENERACION_SE_VENDE) && (!c.video || conVideo))
    .map((c) => {
      const n = redondoParaLeer(mt / c.mt);
      return { clave: c.clave, n, que: n === 1 ? c.uno : c.varios };
    })
    .filter((x) => x.n > 0);
}

/**
 * LA FRASE DE LA COLUMNA, en HTML con las cifras en negrita. La arman igual el servidor (la primera pantalla) y la barra
 * (cada paso), así que no pueden decir cosas distintas.
 *
 * SE DICE CON «O», no con «y» (Martín, 15/11/2026): «nosotros le decimos al usuario, te alcanza para todo esto, punto.
 * Después que él decida cómo lo reparte». Son los extremos de UNA bolsa, no cajones separados.
 * Y en el plan que no genera video lo dice al final: es LA diferencia con el de US$97, dicha donde se compara.
 */
export function fraseAlcanza(mt: number, conVideo: boolean): string {
  const items = alcanzaPara(mt, conVideo);
  if (!items.length) return '';
  const partes = items.map((x, i) => `${i ? 'o ' : ''}<b>${mil(x.n)}</b> ${x.que}`);
  const sinVideo = GENERACION_SE_VENDE && !conVideo ? ' Sin generación de video.' : '';
  return `Te alcanza para ${partes.join(', ')}.${sinVideo}`;
}

/** ¿El plan de esa capa genera video? Sin capa con cupo, no. */
export const generaVideoLaCapa = (capa: string): boolean => {
  const p: Plan | undefined = PLAN_DE_CAPA[capa];
  return p != null && GENERA_VIDEO[p];
};

/** Lo que la barra le hace a UNA columna en un paso. */
export type PrecioDeColumna = {
  /** El id del plan, que es con lo que el script encuentra su columna. */
  id: string;
  /** El precio del mes, ya escrito: el del plan más lo que haya que sumar. */
  usd: string;
  /** La aclaración debajo del precio cuando hay que sumar, o '' cuando el plan alcanza solo. */
  nota: string;
  /** Los MaKo Tokens de ESA columna en este paso: los que pide la barra, o los del plan si trae más. */
  mt: string;
  /** Para cuánto le alcanzan, en HTML (`fraseAlcanza`). */
  alcanza: string;
};

/** Un paso de la barra. */
export type PasoTokens = {
  /** Los MaKo Tokens de este paso, ya escritos. */
  mt: string;
  /** Cuánto de la barra va lleno, de 0 a 100. */
  pct: number;
  /** Cuánto de lo lleno es lo que ya traen los planes (azul); el resto, lo que se suma (negro). */
  base: number;
  /** Cada columna en este paso. */
  precios: PrecioDeColumna[];
};

/**
 * LOS MONTOS DE MÁS ALLÁ DEL PLAN GRANDE, en MaKo Tokens redondos (15/11/2026). Antes eran «minutos de video» (6, 8, 10…),
 * y desde que el cupo paga toda la IA un paquete de minutos no le sirve al que se quedó sin tokens escribiendo; además
 * daban montos como 56.400, que no se leen.
 */
const MONTOS_DE_MAS: readonly number[] = [30_000, 40_000, 50_000, 60_000, 80_000, 100_000, 125_000, 150_000];

/**
 * Lo que sale cubrir `faltan` MaKo Tokens comprándolos: la TARIFA (`MT_POR_DOLAR`, US$1 = 250 MT), redondeada hacia
 * arriba al dólar entero. El redondeo queda de nuestro lado y el total se lee.
 */
export function usdDeLaDiferencia(faltan: number): number {
  return faltan <= 0 ? 0 : Math.ceil(faltan / MT_POR_DOLAR);
}

/**
 * LOS PASOS DE LA BARRA. Arranca en el cupo del plan más chico — que es lo que las columnas ya muestran dibujadas por el
 * servidor, así la primera pantalla no salta cuando corre el script — pasa por el cupo de cada plan y sigue con montos
 * redondos.
 *
 * Cada columna, en cada paso: sus MaKo Tokens son los que pide la barra o los de su plan si trae más (el de US$97 nunca baja
 * de 24.000), su precio es el del plan más lo que cueste la diferencia, y su frase dice para cuánto le alcanza.
 *
 * Devuelve null si ninguno de los planes tiene cupo decidido (el Acelerador no lo tiene): sin cupo no hay barra que mover.
 */
export function pasosDeLaBarra(planes: readonly PlanCalculadora[]): PasoTokens[] | null {
  const conCupo = planes
    .map((p) => ({ p, clave: PLAN_DE_CAPA[p.capa] }))
    .filter((x): x is { p: PlanCalculadora; clave: Plan } => x.clave != null)
    .map(({ p, clave }) => ({ id: p.id, precioUsd: p.precioUsd, cupo: CUPO_MENSUAL[clave], video: GENERA_VIDEO[clave] }));
  if (!conCupo.length) return null;
  const cupos = [...new Set(conCupo.map((x) => x.cupo))].sort((a, b) => a - b);
  const techo = cupos[cupos.length - 1];
  const montos = [...cupos, ...MONTOS_DE_MAS.filter((m) => m > techo)];
  const pctDe = (i: number) => (montos.length === 1 ? 100 : Math.round((i / (montos.length - 1)) * 1000) / 10);
  const pctTecho = pctDe(montos.indexOf(techo));
  return montos.map((mt, i) => ({
    mt: mil(mt),
    // El relleno va por POSICIÓN en la lista y no por el valor: los pasos no están igual de separados, y una barra que
    // avanza a saltos desiguales se lee como si se trabara.
    pct: pctDe(i),
    base: Math.min(pctDe(i), pctTecho),
    precios: conCupo.map(({ id, precioUsd, cupo, video }) => {
      const extra = usdDeLaDiferencia(mt - cupo);
      const suyos = Math.max(mt, cupo);
      return {
        id,
        usd: `US$ ${mil(precioUsd + extra)}`,
        nota: extra === 0 ? '' : `US$ ${mil(precioUsd)} del plan + US$ ${mil(extra)} de MaKo Tokens este mes`,
        mt: mil(suyos),
        alcanza: fraseAlcanza(suyos, video),
      };
    }),
  }));
}

/** El atributo con el que la columna de un plan marca su precio, para que la barra lo pueda mover. */
export const ATRIBUTO_PRECIO = 'data-tk-precio';
/** El del renglón de la aclaración, debajo del precio. */
export const ATRIBUTO_NOTA = 'data-tk-nota';
/** El de la cifra de MaKo Tokens de la columna. */
export const ATRIBUTO_MT = 'data-tk-mt';
/** El de la frase de «te alcanza para». */
export const ATRIBUTO_ALCANZA = 'data-tk-alcanza';

/**
 * La barra es LA DE PRODUCCIÓN HASTA EL 15/11 (Martín: «me gustaba más el anterior… eso no se nota que es un
 * desplazable»): 46 px, la parte que traen los planes en azul, lo que se suma en negro, una raya blanca de mango y la
 * cifra viajando al lado del relleno (adentro, en blanco, cuando el relleno llega al final). Lo que se le sacó: los pasos
 * numerados y la elección de plan, que eran de la calculadora de dos paneles.
 */
export const CSS_TOKENS = `
.tk{margin:8px 0 44px;text-align:left}
.tk h2{margin:0 0 22px;font-size:32px;line-height:1.14;font-weight:800;letter-spacing:-.02em}
.tk-barra{position:relative;height:46px;border-radius:12px;background:#EEF1F5;overflow:hidden}
.tk-barra:has(.tk-rango:focus-visible){outline:2px solid #2F6FED;outline-offset:3px}
.tk-lleno,.tk-incluido{position:absolute;top:0;bottom:0;left:0;border-radius:12px 0 0 12px;transition:width .12s ease}
.tk-lleno{width:var(--tk-pct,0%);background:#12151B}
.tk-incluido{width:var(--tk-base,0%);background:#2F6FED}
.tk-mango{position:absolute;top:12px;bottom:12px;left:calc(var(--tk-pct,0%) - 9px);width:2px;border-radius:2px;background:#fff;transition:left .12s ease}
.tk-valor{position:absolute;top:50%;transform:translateY(-50%);left:calc(var(--tk-pct,0%) + 12px);font-size:15px;font-weight:700;color:#12151B;white-space:nowrap;pointer-events:none}
.tk-barra[data-adentro] .tk-valor{left:auto;right:calc(100% - var(--tk-pct,0%) + 20px);color:#fff}
.tk-rango{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.tk-escala{position:relative;height:20px;margin-top:8px;font-size:13.5px;color:#7A8291}
.tk-escala span{position:absolute;top:0;white-space:nowrap}
.tk-escala .tk-fin{right:0}
@media (max-width:900px){
  .tk{margin-bottom:32px}
  .tk h2{font-size:26px}
}
`;

/**
 * El deslizable. Arranca en el primer paso (el cupo del plan más chico), que es exactamente lo que las columnas ya
 * muestran dibujadas por el servidor.
 */
export function CalculadoraTokens({ planes }: { planes: readonly PlanCalculadora[] }) {
  const pasos = pasosDeLaBarra(planes);
  if (!pasos || pasos.length < 2) return null;
  const p0 = pasos[0];
  const ultimo = pasos.length - 1;
  // El script mueve la barra y, en CADA COLUMNA, el precio, su aclaración, sus MaKo Tokens y su «te alcanza para». Si las
  // columnas no están en la página, los `querySelector` no encuentran nada y no pasa nada.
  const script = `(function(){var P=${JSON.stringify(pasos)};var c=document.querySelector('[data-tk]');if(!c)return;var r=c.querySelector('.tk-rango'),b=c.querySelector('.tk-barra'),v=c.querySelector('.tk-valor');function q(a,id){return document.querySelectorAll('['+a+'="'+id+'"]');}function pon(){var p=P[Number(r.value)]||P[0];b.style.setProperty('--tk-pct',p.pct+'%');b.style.setProperty('--tk-base',p.base+'%');if(p.pct>72)b.setAttribute('data-adentro','');else b.removeAttribute('data-adentro');v.textContent=p.mt+' MaKo Tokens';p.precios.forEach(function(x){q('${ATRIBUTO_PRECIO}',x.id).forEach(function(n){n.textContent=x.usd;});q('${ATRIBUTO_NOTA}',x.id).forEach(function(n){n.textContent=x.nota;n.hidden=!x.nota;});q('${ATRIBUTO_MT}',x.id).forEach(function(n){n.textContent=x.mt;});q('${ATRIBUTO_ALCANZA}',x.id).forEach(function(n){n.innerHTML=x.alcanza;});});r.setAttribute('aria-valuetext',p.mt+' MaKo Tokens');}r.addEventListener('input',pon);pon();})();`;
  return (
    <section className="tk" aria-labelledby="tk-titulo" data-tk="">
      <h2 id="tk-titulo">Calcula cuántos MaKo Tokens necesitas</h2>
      {/* data-tema-fijo: el sol y la luna del sitio (TemaSitio) decide color por color mirando la luz de atrás, y el azul, el
          negro y la cifra de la barra son un juego que tiene que quedar igual en los dos modos. */}
      <div className="tk-barra" style={{ '--tk-pct': `${p0.pct}%`, '--tk-base': `${p0.base}%` } as CSSProperties} data-tema-fijo="">
        <span className="tk-lleno" aria-hidden="true" />
        <span className="tk-incluido" aria-hidden="true" />
        <span className="tk-mango" aria-hidden="true" />
        <span className="tk-valor" aria-hidden="true">{p0.mt} MaKo Tokens</span>
        <input
          className="tk-rango" type="range" min={0} max={ultimo} step={1} defaultValue={0}
          aria-label="Cuántos MaKo Tokens necesitas este mes" aria-valuetext={`${p0.mt} MaKo Tokens`}
        />
      </div>
      {/* Sólo las dos puntas, como la barra de antes: el nombre de cada plan en su marca chocaba con la punta de la izquierda
          (los dos primeros pasos quedan a 11 % de distancia), y Martín pidió menos texto, no más. */}
      <div className="tk-escala" aria-hidden="true"><span>{p0.mt}</span><span className="tk-fin">{pasos[ultimo].mt}</span></div>
      <script data-visor="" dangerouslySetInnerHTML={{ __html: script }} />
    </section>
  );
}
