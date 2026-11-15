// =============================================================================
// La barra de MaKo Tokens de /planes: cuánto sale sumar más, arriba de las columnas (15/11/2026)
// =============================================================================
// Martín (14/11/2026): «estaría bueno como lo tienen otros en pricing, hacer como la calculadora en donde tú puedes arrastrar
// para calcular la cantidad de tokens».
//
// LA CUARTA VUELTA DEL MISMO DÍA, y lo que quedó de cada una. Martín, 15/11/2026, a la noche, textual:
//   · «la idea no es que el precio de abajo se modifique, sino que la idea es que la barra deslizable diga el precio en
//     dólares. Y de última que en otro lado se muestren los tokens que estarías comprando.»
//     → LAS COLUMNAS NO SE TOCAN. La barra dice cuánto sale sumar, en dólares, y debajo, los tokens que se suman.
//   · «no me gusta el diseño de esa barra deslizable. Me gustaba el que teníamos antes, el que habías hecho antes, que era
//     como una barrita más simple, porque eso no se nota que es una barra.»
//     → LA DE LA PRIMERA CALCULADORA (commit 9e16fc4b2, 14/11): un <input type=range> como se ve en cualquier página — riel
//       fino, botón redondo, el azul de la casa — en vez de un bloque de 46 px con la cifra adentro.
//   · «tampoco me gusta que empiecen cero, o sea, siempre tiene que empezar como en un punto, que es el punto donde ya te trae
//     los tokens de tu propio plan, y menos de eso que no se pueda bajar por abajo de eso.»
//     → LA BARRA ARRANCA CON UN TRAMO YA LLENO, «tu plan», y el botón empieza donde termina. El deslizable sólo cubre lo que
//       se suma: no hay forma de llevarlo por debajo de lo que el plan ya trae.
//   · «Tal vez incluso eliminaría el texto de calcula cuántos MaKo Tokens necesitas, pondría la barra directamente abajo de
//     mensual o anual.» → sin título: la barra vive en las columnas, debajo del selector (TarjetasPlanes, `barra`).
//
// LOS NÚMEROS NO SE ESCRIBEN ACÁ:
//   · lo que se suma: la TARIFA (`MT_POR_DOLAR`, US$1 = 250 MT, lib/mako-tokens-paquetes.ts), con el mismo 75% del plan.
//   · lo que cuesta cada cosa (para «te alcanza para» de cada columna): el clip y la imagen de las reglas de venta, y el resto
//     del MEDIDOR (`mtReservaDeFeature`, lib/mako-tokens-costos.ts), que es lo que se descuenta del saldo.
//
// Un script chico (`data-visor`) mueve la burbuja y la línea de abajo: anda sin React y también en el visor de las landings.
// =============================================================================

import type { CSSProperties } from 'react';
import { MT_POR_DOLAR, MT_POR_CLIP, GENERA_VIDEO } from '@/lib/mako-tokens-paquetes';
import { PLAN_DE_CAPA, mtDeImagenes, type Plan } from '@/lib/mako-tokens-reglas';
import { mtReservaDeFeature } from '@/lib/mako-tokens-costos';
import { GENERACION_SE_VENDE } from '@/lib/planes-comparacion';

const mil = (n: number) => n.toLocaleString('es-AR');

/**
 * LO QUE SE CUENTA EN CADA COLUMNA, en el orden en que se lee (15/11/2026).
 *
 * Martín: «también sería bueno de que ya se calcule el resto de cosas, como por ejemplo el análisis de los competidores, las
 * transcripciones o el resto de cosas que también puedan aparecer. Eso en cada una de las columnas». Y después: «no me gusta
 * que sea un texto largo… debería ser un diseño similar a lo que está abajo, lo de incluye. E incluso debería estar ahí en
 * unos ítems de incluye» → cada columna los dibuja como renglones debajo de su check de MaKo Tokens (Tarjetas.tsx).
 *
 * ⚠️ CADA COSTO SALE DE DONDE SE COBRA, no de acá. El clip (`MT_POR_CLIP`) y la imagen (`mtDeImagenes`) son las reglas de
 * venta; el resto es el costo MEDIDO del medidor (`mtReservaDeFeature`). El `feature` es el del medidor: uno mal escrito cae
 * en su costo por defecto SIN avisar, y por eso un test exige que los cuatro existan de verdad.
 *
 * `generacion`: el clip y la imagen son GENERACIÓN, y sólo se cuentan si se vende (`GENERACION_SE_VENDE`). `video`: el clip
 * sólo se cuenta en un plan que genera video (`GENERA_VIDEO`): el de US$47 no lo trae.
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
  DEL_MEDIDOR('llamada', 'Llamada grabada · transcribir', 'llamada transcripta', 'llamadas transcriptas'),
  DEL_MEDIDOR('guion', 'reels-writer', 'guion de reel', 'guiones de reels'),
  DEL_MEDIDOR('landing', 'landing-writer', 'landing escrita con IA', 'landings escritas con IA'),
];

/**
 * Una cantidad, REDONDEADA HACIA ABAJO a una cifra que se lea: 2.666 → 2.600, 545 → 540, 26 → 26.
 * Hacia abajo porque es una promesa: «2.700» promete 34 que no entran.
 */
export function redondoParaLeer(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1000) return Math.floor(n / 100) * 100;
  if (n >= 100) return Math.floor(n / 10) * 10;
  return Math.floor(n);
}

/**
 * Para cuánto alcanzan `mt` MaKo Tokens en un plan que genera video (o no). Sin ceros: lo que no alcanza ni para uno, no va.
 * Son ALTERNATIVAS de una sola bolsa (Martín: «te alcanza para todo esto, punto. Después que él decida cómo lo reparte»).
 */
export function alcanzaPara(mt: number, conVideo: boolean): Array<{ clave: string; n: number; que: string }> {
  return LO_QUE_ALCANZA
    .filter((c) => (!c.generacion || GENERACION_SE_VENDE) && (!c.video || conVideo))
    .map((c) => {
      const n = redondoParaLeer(mt / c.mt);
      return { clave: c.clave, n, que: n === 1 ? c.uno : c.varios };
    })
    .filter((x) => x.n > 0);
}

/** ¿El plan de esa capa genera video? Sin capa con cupo, no. */
export const generaVideoLaCapa = (capa: string): boolean => {
  const p: Plan | undefined = PLAN_DE_CAPA[capa];
  return p != null && GENERA_VIDEO[p];
};

/**
 * Lo que sale cubrir `faltan` MaKo Tokens comprándolos: la TARIFA, redondeada hacia arriba al dólar entero. El redondeo
 * queda de nuestro lado y el total se lee.
 */
export function usdDeLaDiferencia(faltan: number): number {
  return faltan <= 0 ? 0 : Math.ceil(faltan / MT_POR_DOLAR);
}

/**
 * LOS PASOS DE LA BARRA, EN DÓLARES REDONDOS (porque la barra dice el precio): de cero —lo que ya trae tu plan— a US$200.
 * Los MaKo Tokens de cada paso salen de la tarifa, y con US$1 = 250 quedan redondos en las dos unidades (US$10 = 2.500).
 * Los cuatro paquetes que se venden (`PAQUETES`, lib/mako-tokens-paquetes.ts: 10, 20, 40 y 100) son pasos de la barra.
 */
export const PASOS_USD: readonly number[] = [0, 10, 20, 40, 60, 80, 100, 120, 160, 200];

export type PasoTokens = { usd: number; mt: number };

export function pasosDeLaBarra(): PasoTokens[] {
  return PASOS_USD.map((usd) => ({ usd, mt: usd * MT_POR_DOLAR }));
}

/** El tramo de la izquierda que ya viene lleno: lo que trae tu plan. Desde ahí arranca el botón. */
const TRAMO_PLAN = 12;

/**
 * La barra: el deslizable de la PRIMERA calculadora (un range con el azul de la casa, riel fino y botón redondo) con un tramo
 * fijo a la izquierda, «tu plan». El precio va en una burbuja sobre el botón; los tokens que se suman, debajo.
 * `data-tema-fijo`: el sol y la luna del sitio decide color por color, y la burbuja y el riel son un juego.
 */
export const CSS_TOKENS = `
.tk{margin:6px 0 30px;padding-top:34px}
.tk-pista{position:relative;height:32px}
.tk-riel{position:absolute;left:0;right:0;top:50%;height:12px;margin-top:-6px;border-radius:6px;background:#E4E8EF}
.tk-relleno{position:absolute;left:0;top:50%;height:12px;margin-top:-6px;border-radius:6px;background:#2F6FED;width:calc(${TRAMO_PLAN}% + (100% - ${TRAMO_PLAN}%) * var(--tk-pct,0) / 100)}
.tk-zona{position:absolute;top:0;bottom:0;left:${TRAMO_PLAN}%;right:0}
.tk-rango{-webkit-appearance:none;appearance:none;position:absolute;left:-14px;right:-14px;top:0;width:calc(100% + 28px);height:32px;margin:0;background:transparent;cursor:grab}
.tk-rango:active{cursor:grabbing}
.tk-rango::-webkit-slider-runnable-track{height:32px;background:transparent}
.tk-rango::-moz-range-track{height:32px;background:transparent}
.tk-rango::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;margin-top:2px;border-radius:50%;background:#fff;border:3px solid #2F6FED;box-shadow:0 2px 6px rgba(18,21,27,.3)}
.tk-rango::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid #2F6FED;box-shadow:0 2px 6px rgba(18,21,27,.3)}
.tk-rango:focus-visible{outline:none}
.tk-rango:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px rgba(47,111,237,.3)}
.tk-burbuja{position:absolute;bottom:calc(100% + 6px);left:calc(var(--tk-pct,0) * 1%);transform:translateX(-50%);padding:5px 10px;border-radius:8px;background:#12151B;color:#fff;font-size:14px;font-weight:700;white-space:nowrap;pointer-events:none}
.tk-burbuja::after{content:"";position:absolute;left:50%;top:100%;margin-left:-5px;border:5px solid transparent;border-top-color:#12151B}
.tk-suma{margin:10px 0 0;min-height:21px;text-align:right;font-size:14.5px;color:#4A5260}
.tk-suma b{color:#12151B;font-weight:800}
.tk-plan{position:absolute;left:0;top:100%;margin-top:6px;font-size:13px;color:#7A8291;white-space:nowrap}
/* MÁS GRUESA (15/11/2026, a la noche): riel de 12 px y botón de 28. Martín, de la de 6 px: «tampoco me gusta que ahora la barra
   deslizable sea tan finita, casi que ni se nota». Sigue siendo la barra simple de riel y botón; sólo se ve. */
`;

/**
 * La barra, para ir DEBAJO del selector mensual / anual (TarjetasPlanes la recibe por `barra`). Arranca en «tu plan»: el
 * botón en el primer paso, que es cero dólares de más.
 */
export function CalculadoraTokens() {
  const pasos = pasosDeLaBarra();
  const ultimo = pasos.length - 1;
  const script = `(function(){var P=${JSON.stringify(pasos)};var c=document.querySelector('[data-tk]');if(!c)return;var r=c.querySelector('.tk-rango'),b=c.querySelector('.tk-burbuja'),s=c.querySelector('.tk-suma');function m(n){return n.toLocaleString('es-AR');}function pon(){var i=Number(r.value),p=P[i]||P[0];c.style.setProperty('--tk-pct',String(${ultimo} ? i*100/${ultimo} : 0));b.textContent='+US$ '+m(p.usd);b.hidden=!p.usd;s.innerHTML=p.usd?'<b>+'+m(p.mt)+'</b> MaKo Tokens este mes':'';r.setAttribute('aria-valuetext',p.usd?'Sumas '+m(p.mt)+' MaKo Tokens por US$ '+m(p.usd):'Lo que trae tu plan');}r.addEventListener('input',pon);pon();})();`;
  return (
    <section className="tk" aria-label="Sumar MaKo Tokens" data-tk="" data-tema-fijo="" style={{ '--tk-pct': '0' } as CSSProperties}>
      <div className="tk-pista">
        <span className="tk-riel" aria-hidden="true" />
        <span className="tk-relleno" aria-hidden="true" />
        <span className="tk-plan" aria-hidden="true">Tu plan</span>
        <div className="tk-zona">
          {/* La burbuja dice el PRECIO de lo que se suma, y en el arranque no se muestra: ahí no se suma nada, y Martín no quiere
              ver un cero («no me gusta que empiecen cero»). Lo que dice el arranque lo dice «Tu plan», debajo del tramo lleno. */}
          <span className="tk-burbuja" aria-hidden="true" hidden>+US$ 0</span>
          <input
            className="tk-rango" type="range" min={0} max={ultimo} step={1} defaultValue={0}
            aria-label="Cuántos MaKo Tokens sumas este mes" aria-valuetext="Lo que trae tu plan"
          />
        </div>
      </div>
      <p className="tk-suma" aria-live="polite" />
      <script data-visor="" dangerouslySetInnerHTML={{ __html: script }} />
    </section>
  );
}
