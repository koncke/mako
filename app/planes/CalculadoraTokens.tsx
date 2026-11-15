// =============================================================================
// La calculadora de MaKo Tokens de /planes — el deslizable, y nada más (15/11/2026)
// =============================================================================
// Martín (14/11/2026): «estaría bueno como lo tienen otros en pricing, hacer como la calculadora en donde tú puedes arrastrar
// para calcular la cantidad de tokens. Y que vaya cambiando como el pricing según la cantidad de token que quieras».
//
// ⚠️ LA SEGUNDA MITAD DE ESA FRASE ES LA QUE FALTABA, Y ES EL REDISEÑO DE HOY. Martín, 15/11/2026, textual:
//   · «Está horrible la sección de calcula cuántos MaKo Tokens necesitas. Prefiero algo simple como lo que teníamos antes,
//     que sea el deslizable y listo. Tal vez algún que otra cosa más, pero algo simple.»
//   · «Luego pusiste MaKo Pro al lado cuando ya tenemos una columna de MaKo Pro abajo. No tiene sentido.»
//   · «Y la idea justamente es que cuando yo haga el desplazable, se me modifica el precio de las columnas. Es decir, por
//     ejemplo, el de 97 o el de 47.»
//
// Lo que había y por qué no servía: una pantalla de DOS paneles copiada de ElevenLabs, con tres pasos numerados (elegir el
// plan, la barra, y una tabla de cinco filas con lo que gasta cada cosa) y, a la derecha, UNA TARJETA DE PLAN completa —
// nombre, precio, cuatro checks y su botón. O sea que /planes dibujaba la tarjeta de MaKo Pro dos veces, una arriba en la
// calculadora y otra abajo en la columna, con distinto diseño y distinto botón. Y el paso 1 («elige tu plan») pedía la
// decisión que la persona vino a tomar ANTES de darle con qué tomarla.
//
// Lo que hace ahora, que es lo que Martín pidió: **la barra es el único control, y mueve el precio de las columnas de abajo.**
// No hay tarjeta, no hay elegir el plan, no hay tabla de costos. Se arrastra «cuántos MaKo Tokens necesito este mes» y cada
// columna de `TarjetasPlanes` recalcula su precio: el del plan, más lo que cueste la diferencia si ese plan no alcanza. Así la
// comparación la hace la fila de columnas, que es donde ya estaba, en vez de competir con ella.
//
// LOS NÚMEROS NO SE ESCRIBEN ACÁ:
//   · lo que trae cada plan: `CUPO_MENSUAL` (lib/mako-tokens-reglas.ts) por la capa del plan (`PLAN_DE_CAPA`).
//     ⚠️ Sus claves son `pro` = MaKo Esencial (US$47) y `growth` = MaKo Pro (US$97): los nombres de agosto, cruzados.
//   · los topes de video y de imagen de cada plan: `CLIPS_POR_MES` e `IMAGENES_POR_MES` (lib/mako-tokens-paquetes.ts).
//     Mandan sobre los tokens: desde el 15/11 el de US$47 tiene CERO video, así que su columna nunca habla de minutos.
//   · lo que cuesta sumar más: `USD_POR_CLIP_SUELTO` y `MT_POR_CLIP`. Es una compra SUELTA (el ledger la anota como
//     `compra`, supabase/migrations/0412_mako_tokens.sql), no un aumento del abono: por eso el extra dice «este mes».
//
// Un script chico (`data-visor`) mueve los números: anda sin React y también en el visor de las landings. Sin <button>: el
// único control es un <input type=range>.
// =============================================================================

import type { CSSProperties } from 'react';
import { MT_POR_DOLAR, CLIPS_POR_MES, CLIPS_POR_MINUTO, MT_POR_CLIP, USD_POR_CLIP_SUELTO } from '@/lib/mako-tokens-paquetes';
import { CUPO_MENSUAL, PLAN_DE_CAPA, mtDeImagenes } from '@/lib/mako-tokens-reglas';
import { GENERACION_SE_VENDE } from '@/lib/planes-comparacion';

const mil = (n: number) => n.toLocaleString('es-AR');

/**
 * LO QUE GASTA CADA COSA, en MaKo Tokens (14/11/2026, revisado el 15/11).
 *
 * ⚠️ YA NO SE DIBUJA. Era el «paso 3» de la calculadora vieja y se fue con el rediseño: Martín pidió «el deslizable y
 * listo», y una tabla de cinco filas con una explicación en cada una es exactamente lo que llamó «horrible». Queda
 * exportada porque la cita la cosecha (docs/hallazgos-planes-y-cobro.md) y la cruza el test.
 *
 * ⚠️ Y ESTÁ POR QUEDAR VIEJA, A PROPÓSITO (15/11/2026). Tres de sus cinco filas dicen «No gasta: usa tu IA», que era la
 * decisión de Martín del 22/10 («cada negocio paga su IA»). Hoy la dio vuelta: «vinculemos todas las cosas que utilicen
 * inteligencia artificial y que todo utilice MaKo Tokens… Lo mismo con la generación de transcripciones, la generación de
 * análisis de la competencia, que eso también gasta dinero. O sea, todo debería consumir MaKo Tokens». El costo medido de
 * cada una de esas acciones lo está derivando el medidor, en `lib/mako-tokens-costos.ts`; cuando exista, esta tabla se
 * reemplaza por ésa. **No se le inventa un número mientras tanto**: un costo escrito a ojo acá es un cobro inventado.
 *
 * Lo que sí está medido y no cambia:
 *   · el clip de video de 10 s: `MT_POR_CLIP` = 500. Costo medido el 7/11: US$0,412 con su imagen de referencia.
 *   · la imagen: `mtDeImagenes(1)` = 12 (US$0,012, FLUX.2 dev, `USD_POR_IMAGEN.normal`, lib/mako-tokens-reglas.ts).
 */
export const COSTO_POR_ACCION: ReadonlyArray<{ que: string; mt: number | null; porque?: 'competidores' | 'su-ia' }> = [
  { que: 'Un clip de video de 10 segundos', mt: MT_POR_CLIP },
  { que: 'Una imagen', mt: mtDeImagenes(1) },
  { que: 'Seguir a tu competencia', mt: null, porque: 'competidores' },
  { que: 'Guiones, copys y transcripciones', mt: null, porque: 'su-ia' },
  { que: 'Respuestas del setter y análisis de ofertas', mt: null, porque: 'su-ia' },
];

/** El plan como lo necesita la calculadora (lo pasa la vitrina). */
export type PlanCalculadora = { id: string; nombre: string; capa: string; precioUsd: number; cobrable: boolean; destacado?: boolean };

/** Lo que la barra le hace al precio de UNA columna, en un paso. */
export type PrecioDeColumna = {
  /** El id del plan, que es con lo que el script encuentra su precio en la tarjeta. */
  id: string;
  /** El precio del mes, ya escrito: el del plan más lo que haya que sumar. */
  usd: string;
  /** La aclaración debajo del precio cuando hay que sumar, o '' cuando el plan alcanza solo. */
  nota: string;
};

/** Un paso de la barra. */
export type PasoTokens = {
  /** Los MaKo Tokens de este paso, ya escritos. */
  mt: string;
  /** Para qué alcanzan: «4 minutos de video, o 2.020 imágenes». */
  alcanza: string;
  /** Cuánto de la barra va lleno, de 0 a 100. */
  pct: number;
  /** El precio de cada columna en este paso. */
  precios: PrecioDeColumna[];
};

/**
 * LOS PASOS DE LA BARRA, y por qué son éstos.
 *
 * Arranca en el cupo del plan más chico y termina arriba del paquete más grande, pasando por el cupo de cada plan: así cada
 * columna tiene un punto de la barra donde su precio todavía es el de su plan, y uno donde ya hay que sumar. Si la barra
 * arrancara en cero, la mitad de su recorrido mostraría los dos planes al mismo precio, que no dice nada.
 */
const MINUTOS_EXTRA = [0, 1, 2, 3, 4, 6, 8, 10, 12, 15, 20] as const;

/**
 * Lo que sale cubrir `faltan` MaKo Tokens comprándolos: la TARIFA (`MT_POR_DOLAR`, US$1 = 250 MT), redondeada hacia
 * arriba al dólar entero.
 *
 * ⚠️ ANTES CONTABA CLIPS (`Math.ceil(faltan / MT_POR_CLIP) * USD_POR_CLIP_SUELTO`) y eso ya no sirve, por dos razones:
 *   · desde el 15/11/2026 el cupo paga también imágenes y texto, así que al que le faltan tokens no necesariamente le
 *     faltan clips — cobrarle clips enteros le cobra de más por algo que no va a generar;
 *   · y con el clip suelto derivado de la tarifa (US$3,60) los totales dejaban de ser redondos, que es justo lo que
 *     Martín pidió evitar: «no me gusta que sea un número que no sea redondo».
 * Redondear hacia arriba al dólar es lo que mantiene la regla de la casa: el redondeo queda de nuestro lado.
 */
export function usdDeLaDiferencia(faltan: number): number {
  return faltan <= 0 ? 0 : Math.ceil(faltan / MT_POR_DOLAR);
}

/**
 * A CUÁNTO EQUIVALEN `mt` MaKo Tokens: imágenes, o minutos de video.
 *
 * ⚠️ ES UNA CONVERSIÓN DE LA MONEDA, NO LO QUE TU PLAN TE DEJA HACER, y la diferencia importa desde el 15/11/2026: el
 * plan de US$47 tiene CERO generación de video (`CLIPS_POR_MES.pro`). Si esta frase dijera «te alcanza para 3 minutos de
 * video» con la barra en el cupo del de US$47, estaría prometiendo justo lo que ese plan no hace. Por eso se redacta como
 * equivalencia — «11.750 MaKo Tokens equivalen a …» — y quién genera video lo dice el pie de la barra
 * (`TEXTO_QUIEN_GENERA_VIDEO`) y, con todas las letras, los checks de cada columna.
 *
 * ⚠️ Y nunca dice «0 segundos de video»: la calculadora vieja, con el de US$47 en cero clips, escribía literalmente
 * «Hasta 0 segundos de video» — lo cazó el test antes que nadie. Sin minutos, se habla sólo de imágenes.
 */
export function textoAlcanza(mt: number): string {
  const minutos = Math.floor(mt / MT_POR_CLIP / CLIPS_POR_MINUTO);
  const imagenes = Math.floor(mt / mtDeImagenes(1));
  const img = `${mil(imagenes)} ${imagenes === 1 ? 'imagen' : 'imágenes'}`;
  if (minutos <= 0) return img;
  return `${img}, o ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} de video`;
}

/**
 * EL PIE DE LA BARRA: quién genera video y quién no, sacado del tope y no escrito a mano (15/11/2026).
 *
 * Es la aclaración que vuelve honesta la equivalencia de arriba, y de paso es la diferenciación que Martín pidió («debería
 * haber una diferenciación clara de lo que hace el plan de 97 y lo que hace el plan de 47») dicha en un renglón. El día que
 * el de US$47 vuelva a traer video, esta frase desaparece sola: no hay nada que aclarar.
 */
export const TEXTO_QUIEN_GENERA_VIDEO: string | null =
  GENERACION_SE_VENDE && CLIPS_POR_MES[PLAN_DE_CAPA.completo] === 0 && CLIPS_POR_MES[PLAN_DE_CAPA.agencia] > 0
    ? 'La generación de video es de MaKo Pro. El plan más chico genera imágenes.'
    : null;

/**
 * Los pasos de la barra para estos planes. Puro: lo prueba el test.
 *
 * Devuelve null si ninguno de los planes tiene cupo decidido (el Acelerador no lo tiene): sin cupo no hay barra que mover,
 * y una barra que no cambia nada es peor que no tenerla.
 */
export function pasosDeLaBarra(planes: readonly PlanCalculadora[]): PasoTokens[] | null {
  const conCupo = planes
    .map((p) => ({ p, clave: PLAN_DE_CAPA[p.capa] }))
    .filter((x): x is { p: PlanCalculadora; clave: NonNullable<typeof x.clave> } => x.clave != null)
    .map(({ p, clave }) => ({ id: p.id, precioUsd: p.precioUsd, cupo: CUPO_MENSUAL[clave] }));
  if (!conCupo.length) return null;
  const piso = Math.min(...conCupo.map((x) => x.cupo));
  const techo = Math.max(...conCupo.map((x) => x.cupo));
  // Los MaKo Tokens de cada paso: los cupos de los planes, y después el techo más cada paquete de minutos.
  const cupos = [...new Set(conCupo.map((x) => x.cupo))].sort((a, b) => a - b);
  const montos = [...new Set([...cupos, ...MINUTOS_EXTRA.map((m) => techo + m * CLIPS_POR_MINUTO * MT_POR_CLIP)])]
    .sort((a, b) => a - b);
  return montos.map((mt, i) => ({
    mt: mil(mt),
    // ⚠️ VACÍO MIENTRAS LA GENERACIÓN NO SE VENDA, y se decide ACÁ y no en el JSX a propósito: este texto sale por TRES
    // caminos (la línea visible, el `aria-valuetext` del deslizable y el JSON que el script embute en la página), y
    // esconder sólo la línea dejaba la promesa en los otros dos. El test la encontró en el `aria-valuetext`, que no se ve
    // pero está en el DOM — y es justamente lo que lee quien usa un lector de pantalla.
    alcanza: GENERACION_SE_VENDE ? textoAlcanza(mt) : '',
    // El relleno va por POSICIÓN en la lista y no por el valor: los pasos no están igual de separados (del cupo de uno al
    // del otro hay menos que entre dos paquetes), y una barra que avanza a saltos desiguales se lee como si se trabara.
    pct: montos.length === 1 ? 100 : Math.round((i / (montos.length - 1)) * 1000) / 10,
    precios: conCupo.map(({ id, precioUsd, cupo }) => {
      const extra = usdDeLaDiferencia(mt - cupo);
      return {
        id,
        usd: `US$ ${mil(precioUsd + extra)}`,
        nota: extra === 0 ? '' : `US$ ${mil(precioUsd)} del plan + US$ ${mil(extra)} de MaKo Tokens este mes`,
      };
    }),
  }));
}

/** El atributo con el que la tarjeta de un plan marca su precio, para que la barra lo pueda mover. */
export const ATRIBUTO_PRECIO = 'data-tk-precio';
/** Y el del renglón de la aclaración, debajo del precio. */
export const ATRIBUTO_NOTA = 'data-tk-nota';

export const CSS_TOKENS = `
.tk{margin:8px 0 40px;text-align:left;max-width:720px}
.tk h2{margin:0;font-size:32px;line-height:1.14;font-weight:800;letter-spacing:-.02em}
.tk-p{margin:10px 0 0;font-size:16px;line-height:1.5;color:#5B6472}
.tk-cifra{margin:26px 0 10px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.tk-cifra b{font-size:44px;line-height:1;font-weight:800;letter-spacing:-.03em;color:#2F6FED}
.tk-cifra span{font-size:17px;font-weight:600}
.tk-barra{position:relative;height:46px;border-radius:12px;background:#EEF1F5;overflow:hidden}
.tk-barra:has(.tk-rango:focus-visible){outline:2px solid #2F6FED;outline-offset:3px}
.tk-lleno{position:absolute;top:0;bottom:0;left:0;width:var(--tk-pct,0%);border-radius:12px 0 0 12px;background:#2F6FED;transition:width .12s ease}
.tk-mango{position:absolute;top:10px;bottom:10px;left:calc(var(--tk-pct,0%) - 3px);width:6px;border-radius:3px;background:#fff;box-shadow:0 1px 4px rgba(18,21,27,.35);transition:left .12s ease}
.tk-rango{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.tk-escala{display:flex;justify-content:space-between;gap:12px;margin-top:8px;font-size:13.5px;color:#7A8291}
.tk-alcanza{margin:16px 0 0;font-size:16px;line-height:1.5}
.tk-alcanza b{font-weight:700}
.tk-pie{margin:8px 0 0;font-size:14px;color:#7A8291}
@media (max-width:900px){
  .tk{margin-bottom:32px}
  .tk h2{font-size:26px}
  .tk-cifra b{font-size:34px}
}
`;

/**
 * El deslizable. Arranca en el cupo del plan recomendado, que es el precio que las columnas ya muestran dibujadas por el
 * servidor: así la primera pantalla es coherente aunque el script todavía no haya corrido.
 */
export function CalculadoraTokens({ planes }: { planes: readonly PlanCalculadora[] }) {
  const pasos = pasosDeLaBarra(planes);
  if (!pasos || pasos.length < 2) return null;
  const recomendado = planes.find((p) => p.destacado) ?? planes[0];
  const claveReco = PLAN_DE_CAPA[recomendado.capa];
  const mtReco = claveReco ? mil(CUPO_MENSUAL[claveReco]) : null;
  const arranque = Math.max(0, pasos.findIndex((x) => x.mt === mtReco));
  const p0 = pasos[arranque];
  const ultimo = pasos.length - 1;
  // El script: mueve la cifra, la barra, la frase y EL PRECIO DE CADA COLUMNA (lo que pidió Martín). Si las tarjetas no
  // están en la página (la portada dibuja las columnas sin esta barra), los `querySelector` no encuentran nada y no pasa nada.
  const script = `(function(){var P=${JSON.stringify(pasos)};var c=document.querySelector('[data-tk]');if(!c)return;var r=c.querySelector('.tk-rango'),b=c.querySelector('.tk-barra');function pon(){var p=P[Number(r.value)]||P[0];c.querySelectorAll('[data-tk-v]').forEach(function(n){var q=n.getAttribute('data-tk-v');if(q in p)n.textContent=p[q];});b.style.setProperty('--tk-pct',p.pct+'%');p.precios.forEach(function(x){document.querySelectorAll('[${ATRIBUTO_PRECIO}="'+x.id+'"]').forEach(function(n){n.textContent=x.usd;});document.querySelectorAll('[${ATRIBUTO_NOTA}="'+x.id+'"]').forEach(function(n){n.textContent=x.nota;n.hidden=!x.nota;});});r.setAttribute('aria-valuetext',p.mt+' MaKo Tokens'+(p.alcanza?': '+p.alcanza:''));}r.addEventListener('input',pon);pon();})();`;
  return (
    <section className="tk" aria-labelledby="tk-titulo" data-tk="">
      <h2 id="tk-titulo">Calcula cuántos MaKo Tokens necesitas</h2>
      <p className="tk-p">Con MaKo Tokens generas video e imágenes con IA. Mueve la barra y abajo vas viendo lo que sale cada plan.</p>

      <p className="tk-cifra"><b data-tk-v="mt">{p0.mt}</b><span>MaKo Tokens al mes</span></p>
      {/* data-tema-fijo: el sol y la luna del sitio (TemaSitio) decide color por color mirando la luz de atrás, y la parte
          llena de la barra y su mango son un par — medido el 15/11 en las pastillas de las tarjetas, que quedaron verde
          sobre negro por exactamente eso. */}
      <div className="tk-barra" style={{ '--tk-pct': `${p0.pct}%` } as CSSProperties} data-tema-fijo="">
        <span className="tk-lleno" aria-hidden="true" />
        <span className="tk-mango" aria-hidden="true" />
        <input
          className="tk-rango" type="range" min={0} max={ultimo} step={1} defaultValue={arranque}
          aria-label="Cuántos MaKo Tokens necesitas este mes"
          aria-valuetext={p0.alcanza ? `${p0.mt} MaKo Tokens: ${p0.alcanza}` : `${p0.mt} MaKo Tokens`}
        />
      </div>
      <div className="tk-escala" aria-hidden="true"><span>{pasos[0].mt}</span><span>{pasos[ultimo].mt}</span></div>

      {/* ⚠️ LA EQUIVALENCIA SÓLO SE DIBUJA CUANDO LA GENERACIÓN SE VENDE (`GENERACION_SE_VENDE`, lib/planes-comparacion.ts).
          Dos razones, y la segunda es la que la saca hoy:
            1. Promete generación: decir «equivalen a 2.020 imágenes, o 4 minutos de video» es prometer exactamente lo que
               esa bandera frena mientras generar imágenes con IA no exista en MaKo.
            2. Y CHOCA CON LA COLUMNA, que es peor que no decir nada. La equivalencia se calcula desde los TOKENS (24.250
               ÷ 896 ÷ 6 = 4,5 minutos) y la columna dice el TOPE del plan (3 minutos), porque el cupo tiene que pagar
               también las imágenes y el texto. Las dos son ciertas y en la misma pantalla se leen como un error.
          Cuando la generación se venda, esta línea y los checks de la columna hablan del mismo tope. */}
      {GENERACION_SE_VENDE && <p className="tk-alcanza">Equivalen a <b data-tk-v="alcanza">{p0.alcanza}</b>.</p>}
      {GENERACION_SE_VENDE && TEXTO_QUIEN_GENERA_VIDEO && <p className="tk-pie">{TEXTO_QUIEN_GENERA_VIDEO}</p>}
      {/* El paquete suelto también es generación, así que sigue la misma bandera: vender el minuto a US$18 antes de que
          generar video ande de punta a punta es cobrar por algo que no se puede entregar. */}
      {GENERACION_SE_VENDE
        ? <p className="tk-pie">Lo que te falte lo sumas cuando quieras: US$ {mil(USD_POR_CLIP_SUELTO * CLIPS_POR_MINUTO)} el minuto de video.</p>
        : <p className="tk-pie">Si te faltan, sumas más cuando quieras.</p>}
      <script data-visor="" dangerouslySetInnerHTML={{ __html: script }} />
    </section>
  );
}
