// =============================================================================
// La barra de MaKo Tokens de /planes: cuánto sale sumar más, y cuánto le alcanza a cada plan (15/11/2026)
// =============================================================================
// Martín (14/11/2026): «estaría bueno como lo tienen otros en pricing, hacer como la calculadora en donde tú puedes arrastrar
// para calcular la cantidad de tokens».
//
// LAS VUELTAS DEL 15/11, y lo que quedó de cada una (Martín, textual):
//   · «la idea no es que el precio de abajo se modifique, sino que la idea es que la barra deslizable diga el precio en
//     dólares. Y de última que en otro lado se muestren los tokens que estarías comprando.»
//     → EL PRECIO DE LAS COLUMNAS NO SE TOCA. La barra dice cuánto sale sumar («+US$ 40/mes»), y debajo, los tokens.
//   · «cuando voy ajustando la barra, cambie también la cantidad de cosas que me alcanzan y tokens abajo en los planes.»
//     → LOS MaKo TOKENS Y LO QUE ALCANZAN de cada columna sí se mueven: los del plan más los extra (`pasosDeLaBarra`).
//   · «siempre tiene que empezar como en un punto, que es el punto donde ya te trae los tokens de tu propio plan, y menos de
//     eso que no se pueda bajar» → un tramo ya lleno, «Tu plan», y el botón arranca donde termina.
//   · «el texto que está al final, que no desaparezca cuando no puse nada… que diga más 0 MaKo Tokens… y no pondría este mes,
//     sino extras al mes» → «+0 MaKo Tokens extras al mes», siempre a la vista.
//   · «no me gusta que ahora la barra sea tan finita»; «lo haría más grueso… actualmente no se llega a entender muy bien de que
//     esa barra sirve para aumentar los MaKo Tokens» → riel de 18 px, botón de 36, el precio siempre en la burbuja.
//   · «eliminaría el texto de calcula cuántos MaKo Tokens necesitas, pondría la barra directamente abajo de mensual o anual»;
//     «tampoco separaría tanto el mensual y anual de la barra» → sin título, pegada al selector (TarjetasPlanes, `barra`).
//
// LOS NÚMEROS NO SE ESCRIBEN ACÁ:
//   · lo que se suma: la TARIFA (`MT_POR_DOLAR`, US$1 = 288 MT, lineal, lib/mako-tokens-paquetes.ts): cada US$10 son
//     2 minutos de video, y US$100 son 20 (Martín, 17/11/2026, la opción B).
//
// LO DEL 17/11 (Martín, textual): «en las columnas de los planes ya no pongas 0 clip de video, sino o 26 clips de video con
// IA, sino que pongas 0 minutos o 4 minutos, 10 minutos, lo que sea» → el video se cuenta en MINUTOS en las columnas y en
// la línea de la barra («+11.520 MaKo Tokens extras al mes = 8 minutos más de video»), y la barra llega a US$100.
//   · lo que trae cada plan: `CUPO_MENSUAL` por la capa (`PLAN_DE_CAPA`, lib/mako-tokens-reglas.ts).
//   · lo que cuesta cada cosa: el clip y la imagen de las reglas de venta, y el resto del MEDIDOR (`mtReservaDeFeature`,
//     lib/mako-tokens-costos.ts), que es lo que se descuenta del saldo.
//
// Un script chico (`data-visor`) mueve la burbuja, la línea de abajo y lo de cada columna: anda sin React y también en el
// visor de las landings. Lo que escribe en las columnas lo arma `htmlAlcanza`, la MISMA función que usa el servidor para la
// primera pantalla: no pueden decir cosas distintas.
// =============================================================================

import type { CSSProperties } from 'react';
import { MT_POR_DOLAR, MT_POR_MINUTO, GENERA_VIDEO, redondoParaLeer } from '@/lib/mako-tokens-paquetes';
import { CUPO_MENSUAL, PLAN_DE_CAPA, mtDeImagenes, type Plan } from '@/lib/mako-tokens-reglas';
import { mtReservaDeFeature } from '@/lib/mako-tokens-costos';
import { GENERACION_SE_VENDE } from '@/lib/planes-comparacion';

const mil = (n: number) => n.toLocaleString('es-AR');

/**
 * LO QUE SE CUENTA EN CADA COLUMNA, debajo de sus MaKo Tokens, en el orden en que se lee (15/11/2026, copy aprobado por
 * Martín esa noche: «me gusta cómo está»).
 *
 * ⚠️ CADA COSTO SALE DE DONDE SE COBRA, no de acá. El minuto (`MT_POR_MINUTO`) y la imagen (`mtDeImagenes`) son las reglas de
 * venta; el resto es el costo MEDIDO del medidor (`mtReservaDeFeature`). El `feature` es el del medidor: uno mal escrito cae
 * en su costo por defecto SIN avisar, y por eso un test exige que los cuatro existan de verdad.
 *
 * `generacion`: el video y la imagen son GENERACIÓN, y sólo se cuentan si se vende (`GENERACION_SE_VENDE`). `video`: el video
 * sólo se cuenta en un plan que genera video (`GENERA_VIDEO`): el de US$47 no lo trae. El video va en MINUTOS (17/11/2026).
 * Las palabras son las de la persona: «páginas de venta», no «landings» (Martín: «no con lenguaje nuestro»).
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
  { clave: 'video', uno: 'minuto de video con IA', varios: 'minutos de video con IA', mt: MT_POR_MINUTO, generacion: true, video: true },
  { clave: 'imagen', uno: 'imagen con IA', varios: 'imágenes con IA', mt: mtDeImagenes(1), generacion: true },
  DEL_MEDIDOR('competidor', 'spy', 'análisis de un competidor', 'análisis de competidores'),
  // ⚠️ SIN «GUIONES DE REELS» (15/11/2026, a la noche). Martín: «lo que no queda claro es guiones con IA. Creo que quisiste
  // poner transcripciones con IA». La transcripción se cuenta por una llamada de venta (~30 min de audio: el costo del
  // medidor), así que un reel o un anuncio, que son más cortos, cuestan menos: la cifra es un piso, no una promesa de más.
  DEL_MEDIDOR('transcripcion', 'Llamada grabada · transcribir', 'transcripción con IA', 'transcripciones con IA'),
  DEL_MEDIDOR('pagina', 'landing-writer', 'página de venta escrita con IA', 'páginas de venta escritas con IA'),
];

// `redondoParaLeer` vive en lib/mako-tokens-paquetes.ts desde el 17/11/2026: la tabla de comparación (lib/planes-comparacion.ts)
// tiene que redondear igual que las columnas, y lib no puede importar de app. Se re-exporta para los que la buscan acá.
export { redondoParaLeer };

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
 * LOS RENGLONES DE LA COLUMNA, en HTML. La usan el servidor (la primera pantalla) y la barra (cada paso). Los textos son
 * nuestros, no del usuario: no hay nada que escapar.
 *
 * Martín, 15/11/2026, a la noche, mirándolos:
 *   · «me gustaba que antes decía o, es decir, 2.200 imágenes o 3.000 o tanto» → cada renglón, desde el segundo, con «o»:
 *     son los extremos de UNA bolsa, no cajones que se suman.
 *   · «elimina el texto de los repartes como quieras. Eso no es necesario» → sin nota al final; la «o» ya lo dice.
 *   · «intentaría que más o menos sigan como un mismo lineamiento… puedes en el de 47, 0 clips de videos con IA o algo en rojo
 *     tipo tachado» → el plan que NO genera video abre con «0 minutos de video con IA» (en clips hasta el 17/11), tachado y en
 *     rojo: así las dos columnas tienen los mismos renglones en el mismo orden, y la diferencia se ve en la misma línea. Es el
 *     ÚNICO cero que se dibuja.
 */
export function htmlAlcanza(mt: number, conVideo: boolean): string {
  const items = alcanzaPara(mt, conVideo);
  if (!items.length) return '';
  const video = LO_QUE_ALCANZA.find((c) => c.clave === 'video');
  // El renglón tachado va PRIMERO y ocupa el lugar de los minutos: desde ahí, todos los demás llevan «o».
  const tachado = GENERACION_SE_VENDE && !conVideo && video ? `<li class="mkpl-alcanza-sin"><b>0</b> ${video.varios}</li>` : '';
  const filas = items.map((x, i) => `<li>${i || tachado ? 'o ' : ''}<b>${mil(x.n)}</b> ${x.que}</li>`);
  return tachado + filas.join('');
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
 * LOS PASOS DE LA BARRA, EN DÓLARES REDONDOS (porque la barra dice el precio): de cero —lo que ya trae tu plan— a US$100,
 * de a US$10 (17/11/2026). Martín: «que paguen como máximo $100 extra y que con esos $100 extra ya le alcance los 30
 * minutos». Hasta el 16/11 llegaba a US$200. Con US$1 = 288 MT, cada paso suma 2.880 MT = 2 minutos: redondo en minutos.
 * Los cuatro paquetes que se venden (`PAQUETES`, lib/mako-tokens-paquetes.ts: 10, 20, 40 y 100) son pasos de la barra.
 */
export const PASOS_USD: readonly number[] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/** Los minutos de video que suman `mt` MaKo Tokens extra, redondeado hacia abajo: es una promesa. */
export const minutosDeMt = (mt: number): number => (mt > 0 ? Math.floor(mt / MT_POR_MINUTO) : 0);

/**
 * La línea de debajo de la barra, en HTML: los MaKo Tokens extra y, si el video se vende, sus minutos (17/11/2026: «+US$40
 * = 8 minutos más»). En cero queda como la pidió Martín el 15/11: «+0 MaKo Tokens extras al mes», sin minutos.
 * La usan el servidor (la primera pantalla) y el script de la barra: no pueden decir cosas distintas.
 */
export function htmlExtra(mt: number): string {
  const min = GENERACION_SE_VENDE ? minutosDeMt(mt) : 0;
  const minutos = min > 0 ? ` = <b>${mil(min)} ${min === 1 ? 'minuto' : 'minutos'}</b> más de video` : '';
  return `<b>+${mil(mt)}</b> MaKo Tokens extras al mes${minutos}`;
}

/** Un plan, como lo necesita la barra: con qué id lo encuentra el script en su columna y de qué capa es. */
export type PlanBarra = { id: string; capa: string };

/** Una columna en un paso: sus MaKo Tokens (los del plan más los extra) y sus renglones de «alcanza». */
export type ColumnaEnPaso = { id: string; mt: string; alcanza: string };

export type PasoTokens = { usd: number; mt: number; extra: string; columnas: ColumnaEnPaso[] };

/**
 * Los pasos de la barra para estos planes. Cada paso suma los MISMOS MaKo Tokens extra a todas las columnas; cada columna
 * los suma a los de su plan. El precio de la columna no está acá a propósito: no lo mueve nadie.
 */
export function pasosDeLaBarra(planes: readonly PlanBarra[] = []): PasoTokens[] {
  const conCupo = planes
    .map((p) => ({ id: p.id, plan: PLAN_DE_CAPA[p.capa] }))
    .filter((x): x is { id: string; plan: Plan } => x.plan != null);
  return PASOS_USD.map((usd) => {
    const extra = usd * MT_POR_DOLAR;
    return {
      usd,
      mt: extra,
      extra: htmlExtra(extra),
      columnas: conCupo.map(({ id, plan }) => {
        const total = CUPO_MENSUAL[plan] + extra;
        return { id, mt: mil(total), alcanza: htmlAlcanza(total, GENERA_VIDEO[plan]) };
      }),
    };
  });
}

/** La marca de la cifra de MaKo Tokens de una columna, para que la barra la mueva. */
export const ATRIBUTO_MT = 'data-tk-mt';
/** La marca de la lista de «alcanza» de una columna. */
export const ATRIBUTO_ALCANZA = 'data-tk-alcanza';
/** La marca del «+ US$ X» debajo del precio de una columna: lo que suma la barra, aparte del plan (oculto en cero). */
export const ATRIBUTO_EXTRA = 'data-tk-extra';

/** El texto de la burbuja: el precio de lo que se suma, por mes. */
export const textoBurbuja = (usd: number): string => `+US$ ${mil(usd)}/mes`;

/** El tramo de la izquierda que ya viene lleno: lo que trae tu plan. Desde ahí arranca el botón. */
const TRAMO_PLAN = 12;

/**
 * La barra: un riel GRUESO con un botón redondo grande (Martín: «lo haría más grueso… no se llega a entender que esa barra
 * sirve para aumentar los MaKo Tokens»), un tramo fijo a la izquierda que es «tu plan», el precio SIEMPRE en una burbuja
 * sobre el botón, y debajo, siempre, los tokens extra. Pegada al selector mensual / anual.
 * `data-tema-fijo`: el sol y la luna del sitio decide color por color, y la burbuja y el riel son un juego.
 */
export const CSS_TOKENS = `
.tk{margin:0 0 30px;padding-top:46px}
.tk-pista{position:relative;height:36px}
.tk-riel{position:absolute;left:0;right:0;top:50%;height:18px;margin-top:-9px;border-radius:9px;background:#E4E8EF}
.tk-relleno{position:absolute;left:0;top:50%;height:18px;margin-top:-9px;border-radius:9px;background:#2F6FED;width:calc(${TRAMO_PLAN}% + (100% - ${TRAMO_PLAN}%) * var(--tk-pct,0) / 100)}
.tk-zona{position:absolute;top:0;bottom:0;left:${TRAMO_PLAN}%;right:0}
.tk-rango{-webkit-appearance:none;appearance:none;position:absolute;left:-18px;right:-18px;top:0;width:calc(100% + 36px);height:36px;margin:0;background:transparent;cursor:grab}
.tk-rango:active{cursor:grabbing}
.tk-rango::-webkit-slider-runnable-track{height:36px;background:transparent}
.tk-rango::-moz-range-track{height:36px;background:transparent}
.tk-rango::-webkit-slider-thumb{-webkit-appearance:none;width:36px;height:36px;border-radius:50%;background:#fff;border:4px solid #2F6FED;box-shadow:0 2px 8px rgba(18,21,27,.3)}
.tk-rango::-moz-range-thumb{width:28px;height:28px;border-radius:50%;background:#fff;border:4px solid #2F6FED;box-shadow:0 2px 8px rgba(18,21,27,.3)}
.tk-rango:focus-visible{outline:none}
.tk-rango:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 5px rgba(47,111,237,.3)}
.tk-burbuja{position:absolute;bottom:calc(100% + 8px);left:calc(var(--tk-pct,0) * 1%);transform:translateX(-50%);padding:6px 11px;border-radius:9px;background:#12151B;color:#fff;font-size:15px;font-weight:800;white-space:nowrap;pointer-events:none}
.tk-burbuja::after{content:"";position:absolute;left:50%;top:100%;margin-left:-6px;border:6px solid transparent;border-top-color:#12151B}
.tk-pie{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:10px}
.tk-plan{font-size:13.5px;font-weight:600;color:#7A8291;white-space:nowrap}
.tk-extra{font-size:15.5px;color:#4A5260;text-align:right}
.tk-extra b{color:#12151B;font-weight:800}
@media (max-width:600px){
  .tk-extra{font-size:14px}
}
`;

/**
 * La barra, para ir DEBAJO del selector mensual / anual (TarjetasPlanes la recibe por `barra`). Arranca en «tu plan»: el
 * botón en el primer paso, cero dólares de más.
 */
export function CalculadoraTokens({ planes = [] }: { planes?: readonly PlanBarra[] }) {
  const pasos = pasosDeLaBarra(planes);
  const ultimo = pasos.length - 1;
  const script = `(function(){var P=${JSON.stringify(pasos)};var c=document.querySelector('[data-tk]');if(!c)return;var r=c.querySelector('.tk-rango'),b=c.querySelector('.tk-burbuja'),x=c.querySelector('.tk-extra');function m(n){return n.toLocaleString('es-AR');}function q(a,id){return document.querySelectorAll('['+a+'="'+id+'"]');}function pon(){var i=Number(r.value),p=P[i]||P[0];c.style.setProperty('--tk-pct',String(${ultimo} ? i*100/${ultimo} : 0));b.textContent='+US$ '+m(p.usd)+'/mes';x.innerHTML=p.extra;p.columnas.forEach(function(k){q('${ATRIBUTO_MT}',k.id).forEach(function(n){n.textContent=k.mt;});q('${ATRIBUTO_ALCANZA}',k.id).forEach(function(n){n.innerHTML=k.alcanza;});q('${ATRIBUTO_EXTRA}',k.id).forEach(function(n){n.hidden=!p.usd;n.textContent=p.usd?'+ US$ '+m(p.usd)+' / mes en créditos extra':'';});});r.setAttribute('aria-valuetext','Sumas '+m(p.mt)+' MaKo Tokens extras al mes por US$ '+m(p.usd));}r.addEventListener('input',pon);pon();})();`;
  return (
    <section className="tk" aria-label="Sumar MaKo Tokens extras al mes" data-tk="" style={{ '--tk-pct': '0' } as CSSProperties}>
      {/* `data-tema-fijo` va en la PISTA y no en toda la barra (15/11/2026): el riel y la burbuja son un juego que el sol y la luna
          no deben separar, pero los textos de abajo sí tienen que darse vuelta; fijos, en el modo oscuro quedaban negro sobre
          negro (contraste 1,08 en el «+0»). */}
      <div className="tk-pista" data-tema-fijo="">
        <span className="tk-riel" aria-hidden="true" />
        <span className="tk-relleno" aria-hidden="true" />
        <div className="tk-zona">
          {/* El precio de lo que se suma, siempre a la vista: también en cero, para que se entienda desde el arranque que la
              barra es para sumar (Martín: «no se llega a entender muy bien de que esa barra sirve para aumentar los MaKo Tokens»). */}
          <span className="tk-burbuja" aria-hidden="true">{textoBurbuja(0)}</span>
          <input
            className="tk-rango" type="range" min={0} max={ultimo} step={1} defaultValue={0}
            aria-label="MaKo Tokens extras al mes" aria-valuetext="Sumas 0 MaKo Tokens extras al mes por US$ 0"
          />
        </div>
      </div>
      <div className="tk-pie">
        <span className="tk-plan" aria-hidden="true">Tu plan</span>
        <span className="tk-extra" aria-live="polite" dangerouslySetInnerHTML={{ __html: htmlExtra(0) }} />
      </div>
      <script data-visor="" dangerouslySetInnerHTML={{ __html: script }} />
    </section>
  );
}
