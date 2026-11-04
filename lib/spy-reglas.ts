// =============================================================================
// Competitors Spy — las reglas PURAS: qué se puede decir de un competidor y qué no
// =============================================================================
// El plan está en docs/diseno-competitors-spy.md; las trampas medidas, en
// docs/hallazgos-competitors-spy.md. Este archivo es el único lugar donde viven las reglas, para
// que no haya que volver a descubrirlas: cada una de las de abajo se midió el 31/10/2026 entrando
// a la API o a los términos del proveedor, y casi todas tienen la misma forma — **una fuente que
// devuelve otra cosa en vez de un error**.
//
// Lo que este archivo evita, en orden de cuánto cuesta equivocarse:
//
//  1. **Un contador ausente no es cero.** El dueño de una cuenta de Instagram puede ocultar likes,
//     comentarios y vistas UNO POR UNO, y entonces el campo NO VIENE. `dislikeCount` de YouTube es
//     privado desde el 13/12/2021 y tampoco devuelve 0: no devuelve el campo. Un `?? 0` muestra
//     «0 likes» sobre una publicación con miles. Se lee con `contadorPublicado`, que devuelve
//     `null`, y la pantalla distingue «no lo publica» de «cero».
//  2. **Un rango se dice rango.** `spend` e `impressions` de la Ad Library son TRAMOS DE TEXTO
//     (`<100`, `1K-5K`, `>1M`), no números. Coaccionarlos da `NaN` o un 1 — un número inventado.
//     Se leen con `leerTramo`, que devuelve el tramo y nunca un punto de un eje.
//  3. **Derivar una métrica está prohibido por DEFECTO.** Los Developer Policies de YouTube,
//     III.E.4.h, prohíben «create new or derived data or metrics» y nombran el caso: «a score that
//     factors in likes, total views». O sea que el VPH y el outlier —el producto entero de vidIQ—
//     están prohibidos salvo con la enmienda III.L («Analytics & Reporting», del 1/6/2026), que
//     también sube la retención de métricas a 36 meses. Acá eso es un INTERRUPTOR
//     (`ENMIENDA_III_L`), no una nota: sin la enmienda, las funciones derivadas devuelven `null` y
//     la pantalla dice que falta el trámite. La sanción declarada es «quota reduction or
//     termination», y esa key es la misma que usa lib/youtube.ts en producción.
//  4. **Son DOS retenciones, no una,** y van separadas desde la primera migración: las métricas
//     hasta 36 meses con la enmienda; los TÍTULOS, descripciones, nombres y texto de comentarios,
//     30 días SIEMPRE.
//  5. **`ad_type=ALL` de la Ad Library no significa «todos los anuncios».** Fuera de la Unión
//     Europea y el Reino Unido devuelve sólo política, con HTTP 200 y lista vacía. Para un
//     competidor comercial de México o Argentina no hay dato. `adLibraryCubreComercial` lo
//     contesta antes de llamar, así que la pantalla promete lo que hay.
//  6. **Y la pantalla no pelea con nadie.** La política III.L prohíbe enmarcar una comparación como
//     «war» o «battle». La tab se llama Spy; la pantalla mira el mercado.
//
// SIN `server-only`, a propósito: lo leen la pantalla (cliente), el analista del servidor, la
// definición del área `spy` de la API de MaKo —que NO puede importar un valor de un módulo con
// `server-only`— y los tests.
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Los canales que se vigilan de un competidor
// ─────────────────────────────────────────────────────────────────────────────

import { esAgregador } from './spy-otras-redes-reglas';

/**
 * Los cuatro canales, en el orden en que entraron (docs/diseno-competitors-spy.md §6). Los
 * anuncios van ÚLTIMOS a propósito: son los más valiosos y los únicos sin camino automático legal
 * en América Latina.
 */
export const CANALES_SPY = ['instagram', 'youtube', 'landing', 'anuncios'] as const;
export type CanalSpy = (typeof CANALES_SPY)[number];

/** Cómo se llama cada canal en la pantalla. */
export const NOMBRE_CANAL: Record<CanalSpy, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  landing: 'Landing',
  anuncios: 'Anuncios',
};

/**
 * De dónde salió una pieza. Es un dato de la pantalla, no una nota al pie: un anuncio que trajo la
 * persona y uno que leyó un recorrido guiado no tienen el mismo respaldo, y la ficha lo dice.
 *   · `api`       — lo devolvió la API oficial del proveedor (Instagram por Business Discovery,
 *                   YouTube Data API v3).
 *   · `pagina`    — se bajó la página pública y se leyó (la landing del competidor).
 *   · `pegado`    — lo trajo la persona: pegó el link de un anuncio que estaba mirando. No hay
 *                   recolección automatizada, así que no hay riesgo de términos.
 *   · `recorrido` — la leyó la extensión en el navegador de la persona, con un clic y sólo lo que
 *                   la página ya dibujó («Guardar en Spy», decidido por Martín el 3/11/2026, §9.1 del
 *                   plan). El nombre viene de cuando era un recorrido: no recorre nada.
 */
export const FUENTES_PIEZA = ['api', 'pagina', 'pegado', 'recorrido'] as const;
export type FuentePieza = (typeof FUENTES_PIEZA)[number];

/** Cómo se dice en la pantalla de dónde salió cada pieza. */
export const NOMBRE_FUENTE: Record<FuentePieza, string> = {
  api: 'De la API oficial',
  pagina: 'De su página pública',
  pegado: 'Lo pegaste tú',
  recorrido: 'Lo guardaste desde tu navegador',
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Un contador ausente no es cero
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un contador que publicó la fuente, o `null` si NO LO PUBLICA. Nunca 0 por omisión.
 *
 * Es la regla que este repo ya pagó cara con el 0% de retención, y la misma que
 * `lib/landing-vigilancia.ts` lleva escrita en su cabecera: una lectura que falló es «NO SÉ»,
 * jamás «lo sacaron». Acá hay DOS fuentes que la activan todo el tiempo:
 *   · Instagram: el dueño oculta likes, comentarios, vistas, reposts y compartidos uno por uno, y
 *     entonces Meta OMITE el campo. No da error.
 *   · YouTube: `dislikeCount` es privado desde el 13/12/2021 — no devuelve 0, no devuelve el campo.
 *
 * Un string también se lee (las dos APIs devuelven los contadores de `videos.list` como texto),
 * pero sólo si es un número entero: `'1K-5K'` es un TRAMO y va por `leerTramo`, no por acá.
 */
export function contadorPublicado(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.trunc(v) : null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Cómo se dibuja un contador. Es UNA función para que no haya una pantalla que ponga «0» y otra
 * que ponga «—»: el que no se publica se dice, y no se parece a un cero.
 */
export function dibujarContador(v: number | null): string {
  if (v == null) return 'No lo publica';
  if (v === 0) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace('.0', '')} M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1).replace('.0', '')} mil`;
  return String(v);
}

/**
 * ¿Se puede promediar o sumar esta columna? Sólo si TODOS los valores están publicados. Con uno
 * ausente, el promedio miente hacia arriba y el total hacia abajo, y ninguno de los dos avisa.
 * Devuelve `null` cuando no se puede, que es lo que la pantalla tiene que decir.
 */
export function promedioDeLoPublicado(valores: readonly (number | null)[]): number | null {
  const hay = valores.filter((v): v is number => v != null);
  if (!hay.length || hay.length !== valores.length) return null;
  return hay.reduce((a, b) => a + b, 0) / hay.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Un rango se dice rango
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un tramo de la Ad Library tal como lo devuelve Meta: `desde` y `hasta` para poder ordenar, y el
 * `texto` que es lo ÚNICO que se muestra. `hasta: null` es un tramo abierto (`>1M`).
 */
export type Tramo = { desde: number | null; hasta: number | null; texto: string };

/**
 * Lee un tramo de `spend` o `impressions` de la Ad Library. Devuelve `null` si no es un tramo
 * reconocible — y entonces no se muestra nada, que es mejor que mostrar un número inventado.
 *
 * ⚠️ NO devuelve un número, y es a propósito. `Number('1K-5K')` es `NaN` y `parseInt('1K-5K')` es
 * `1`: las dos coacciones producen un dato falso sin dar error. Un eje con «3.000» donde la fuente
 * dijo «1K-5K» es un número que nos inventamos nosotros.
 *
 * ⚠️ Y la doc de Meta SE SALTEA el tramo 500K–1M: la lista de tramos documentada no es la lista de
 * tramos que la API devuelve. Por eso esto parsea la FORMA (`a-b`, `<a`, `>a`) en vez de comparar
 * contra una lista cerrada, que dejaría ese tramo afuera.
 */
export function leerTramo(v: unknown): Tramo | null {
  const texto = typeof v === 'string' ? v.trim() : '';
  if (!texto) return null;
  const n = (s: string): number | null => {
    const m = s.trim().match(/^([\d.,]+)\s*([KMkm]?)$/);
    if (!m) return null;
    const base = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(base)) return null;
    const mult = m[2].toUpperCase() === 'M' ? 1_000_000 : m[2].toUpperCase() === 'K' ? 1_000 : 1;
    return base * mult;
  };
  const menor = texto.match(/^<\s*(.+)$/);
  if (menor) { const h = n(menor[1]); return h == null ? null : { desde: 0, hasta: h, texto }; }
  const mayor = texto.match(/^>\s*(.+)$/);
  if (mayor) { const d = n(mayor[1]); return d == null ? null : { desde: d, hasta: null, texto }; }
  const rango = texto.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (rango) {
    const d = n(rango[1]);
    const h = n(rango[2]);
    return d == null || h == null ? null : { desde: d, hasta: h, texto };
  }
  const exacto = n(texto);
  return exacto == null ? null : { desde: exacto, hasta: exacto, texto };
}

/**
 * Cómo se dibuja un tramo: SU PROPIO TEXTO, tal como lo dijo la fuente. Nunca el promedio de los
 * extremos, que es el atajo que convierte un rango en un dato.
 */
export const dibujarTramo = (t: Tramo | null): string => (t == null ? 'No lo publica' : t.texto);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Las métricas DERIVADAS, y el trámite que las habilita
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Está aceptada la enmienda III.L de los Developer Policies de YouTube («Section 5: Use Cases →
 * Analytics & Reporting», del pedido de ampliación de cuota)?
 *
 * **Hoy NO**, y hasta que lo esté toda métrica derivada devuelve `null`. El trámite es de Martín o
 * del Cerebro, tarda días y es la Etapa 0 del plan (docs/diseno-competitors-spy.md §6). Es una
 * constante y no una configuración de la base a propósito: es un acuerdo que se firmó o no se
 * firmó, igual para todos los negocios, y que alguien pueda prenderlo desde una pantalla es
 * justamente lo que no queremos.
 *
 * Cuando se acepte, se cambia a `true` en un commit que también actualice
 * docs/hallazgos-competitors-spy.md con la fecha, y entonces quedan habilitados el VPH, el outlier
 * y la retención de métricas a 36 meses.
 */
export const ENMIENDA_III_L: boolean = false;

/** Lo que dice la pantalla donde iría una métrica derivada mientras el trámite no esté. */
export const FALTA_LA_ENMIENDA =
  'Falta un trámite con YouTube para poder calcular esto. Mientras tanto se muestran las vistas, los «me gusta» y los comentarios, que son dato suyo.';

/**
 * La leyenda que ACOMPAÑA a toda métrica derivada. La exige la política III.L: lo derivado se
 * presenta «as third-party estimates and not as YouTube approved or published data». No es una
 * cortesía, es la condición del permiso — y acá es también el diferencial: vidIQ vende «vistas por
 * hora» y un «score de SEO» como si fueran datos de YouTube, y son fórmulas propias que no publica.
 */
export const LEYENDA_DERIVADA = 'Cálculo de MaKo, no un dato de YouTube.';

/**
 * Vistas por hora desde que se publicó: la métrica central de vidIQ. `null` sin la enmienda, y
 * `null` también si las vistas no están publicadas o el video es de hace menos de una hora (en la
 * primera hora el divisor tiende a cero y el número se va al infinito — un video de hace un minuto
 * no «rinde 60.000 vistas por hora»).
 */
export function vistasPorHora(vistas: number | null, publicadoEn: string, ahora: Date = new Date()): number | null {
  if (!ENMIENDA_III_L || vistas == null) return null;
  const t = Date.parse(publicadoEn);
  if (!Number.isFinite(t)) return null;
  const horas = (ahora.getTime() - t) / 3_600_000;
  if (horas < 1) return null;
  return vistas / horas;
}

/** Desde qué múltiplo del promedio de SU PROPIO canal un video se considera un outlier. */
export const OUTLIER_DESDE = 2;

/**
 * Cuánto rindió un video por encima del promedio de su canal, como múltiplo. Es la fórmula de
 * `pandich93/youtube-niche-finder` (MIT, verificada entrando al repo el 31/10/2026), y es la que
 * contesta «el reel más viral» del pedido.
 *
 * El promedio se calcula SIN el video que se está midiendo: con un canal de pocos videos, un
 * outlier se mete en su propio promedio y se tapa solo. Y si algún video del canal no publica sus
 * vistas no hay promedio (`promedioDeLoPublicado` devuelve `null`): no se adivina.
 */
export function multiploDelCanal(vistasDelVideo: number | null, vistasDeLosOtros: readonly (number | null)[]): number | null {
  if (!ENMIENDA_III_L || vistasDelVideo == null) return null;
  const promedio = promedioDeLoPublicado(vistasDeLosOtros);
  if (promedio == null || promedio <= 0) return null;
  return vistasDelVideo / promedio;
}

/** ¿Es un outlier? `null` cuando no se puede saber, que no es lo mismo que «no». */
export function esOutlier(multiplo: number | null): boolean | null {
  return multiplo == null ? null : multiplo >= OUTLIER_DESDE;
}

/**
 * El día en que YouTube CAMBIÓ la definición de `viewCount`: desde el 24/8/2026 cuenta la vista en
 * el momento en que el video empieza a reproducirse.
 *
 * ⚠️ Toda serie histórica que cruce esta fecha tiene un SALTO ARTIFICIAL, y se lee como un
 * despegue del competidor. El gráfico marca el corte o miente.
 */
export const CORTE_VIEWCOUNT = '2026-08-24';

/** ¿Esta serie cruza el corte del `viewCount`? Si sí, el gráfico lo marca. */
export function cruzaElCorte(desde: string, hasta: string): boolean {
  const d = Date.parse(desde);
  const h = Date.parse(hasta);
  const c = Date.parse(CORTE_VIEWCOUNT);
  if (!Number.isFinite(d) || !Number.isFinite(h)) return false;
  return d < c && h >= c;
}

/** Lo que dice el gráfico donde cruza el corte. */
export const AVISO_CORTE_VIEWCOUNT =
  'YouTube cambió cómo cuenta las vistas el 24 de agosto de 2026. El salto de esa fecha es del cambio de medición, no del canal.';

// ─────────────────────────────────────────────────────────────────────────────
// 4. Las DOS retenciones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cuánto se guarda cada cosa, y por qué son dos números y no uno.
 *
 * Los Developer Policies de YouTube, III.E.4.b, dicen que los datos de un tercero son
 * «Non-Authorized Data» y no se guardan más de 30 días. La enmienda III.L sube las MÉTRICAS a 36
 * meses, y deja el resto donde estaba, textual: «Other data (such as video titles, creator names,
 * descriptions, and comment text) must still follow the 30-day refresh and deletion policy».
 *
 * ⚠️ Por eso van en COLUMNAS SEPARADAS desde la primera migración (0359). Si nacen juntas, después
 * es una migración — y mientras tanto, o se borra una métrica que se podía guardar tres años, o se
 * guarda un título tres años que había que borrar en 30 días.
 */
export const RETENCION_METRICAS_MESES = 36;
export const RETENCION_TEXTO_DIAS = 30;

/** ¿Hay que refrescar o borrar YA el texto de esta pieza (título, descripción, copy, comentarios)? */
export function textoVencido(leidoEn: string, ahora: Date = new Date()): boolean {
  const t = Date.parse(leidoEn);
  if (!Number.isFinite(t)) return true;
  return ahora.getTime() - t > RETENCION_TEXTO_DIAS * 86_400_000;
}

/**
 * ¿Hay que borrar ya las métricas de esta pieza? Sin la enmienda III.L el plazo de las métricas es
 * el mismo que el del texto: 30 días. Con la enmienda, 36 meses.
 */
export function metricasVencidas(leidoEn: string, ahora: Date = new Date()): boolean {
  const t = Date.parse(leidoEn);
  if (!Number.isFinite(t)) return true;
  const dias = ENMIENDA_III_L ? RETENCION_METRICAS_MESES * 30 : RETENCION_TEXTO_DIAS;
  return ahora.getTime() - t > dias * 86_400_000;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. La Biblioteca de Anuncios: qué cubre y qué no
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los países donde la Ad Library devuelve anuncios COMERCIALES: la Unión Europea y el Reino Unido,
 * y nada más.
 *
 * ⚠️ Esta lista es la trampa más cara de la tab, y es la que hace construir media pantalla antes de
 * darse cuenta. El enum de `ad_type` es TEMÁTICO (`ALL`, `EMPLOYMENT_ADS`,
 * `FINANCIAL_PRODUCTS_AND_SERVICES_ADS`, `HOUSING_ADS`, `POLITICAL_AND_ISSUE_ADS`); la cobertura
 * geográfica es un filtro aparte y FIJO que no se puede cambiar. `ad_type=ALL` sobre México o
 * Argentina devuelve **sólo anuncios de política y temas sociales**: una lista vacía con HTTP 200,
 * no un error. Textual en facebook.com/ads/library/api/, en la nota de `ad_reached_countries`:
 * «Ads that did not reach any location in the EU will only return if they are about social issues,
 * elections or politics».
 *
 * Y la web pública replica exactamente la misma asimetría (verificado sin sesión el 31/10/2026): el
 * detalle de un anuncio de Argentina no tiene gasto ni alcance. **No hay atajo por la interfaz.**
 */
export const PAISES_CON_ANUNCIOS_COMERCIALES: readonly string[] = [
  // Unión Europea, los 27.
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
  // Reino Unido.
  'GB',
];

/**
 * ¿La Ad Library devuelve anuncios comerciales de este país? Se pregunta ANTES de llamar, para que
 * la pantalla prometa lo que hay en vez de mostrar una lista vacía que parece «este competidor no
 * pauta».
 */
export const adLibraryCubreComercial = (pais: string): boolean =>
  PAISES_CON_ANUNCIOS_COMERCIALES.includes((pais ?? '').trim().toUpperCase());

/**
 * Lo que se le dice a quien pide los anuncios de un competidor de un país que la API no cubre. Dice
 * la verdad y ofrece el camino que SÍ existe (pegar el link del anuncio), en vez de callarse.
 */
export const SIN_ANUNCIOS_EN_ESTE_PAIS =
  'La Biblioteca de Anuncios de Meta sólo entrega anuncios comerciales de la Unión Europea y el Reino Unido. En el resto del mundo devuelve únicamente anuncios de política, así que de este competidor no hay nada que traer solo. Si ves uno suyo, pega su enlace y lo guardo en su ficha.';

// ─────────────────────────────────────────────────────────────────────────────
// La etapa de tendencia: lo único que MaKo agrega sobre abrir la Biblioteca a mano
// ─────────────────────────────────────────────────────────────────────────────

/**
 * En qué etapa está una pieza según CUÁNTO LLEVA corriendo. Es la idea central de la tab: a mano se
 * ve qué corre hoy; MaKo guarda una foto por día y entonces puede decir desde cuándo. Un anuncio
 * que lleva 90 días es el que le funciona; uno de ayer es un test. Ese dato no existe en ninguna
 * pantalla de Meta —hay que haberlo estado mirando— y es el que decide qué copiar.
 *
 * Los cortes (14 y 30 días) son los de `athm793/meta-ads-scraper` (Apache-2.0, verificada entrando
 * al repo el 31/10/2026), que es de donde se copia la galería. Son NUESTRO criterio, no un dato del
 * proveedor, y la pantalla lo dice.
 */
export const ETAPAS_TENDENCIA = ['test-nuevo', 'ganando-traccion', 'probado'] as const;
export type EtapaTendencia = (typeof ETAPAS_TENDENCIA)[number];

export const DIAS_GANANDO_TRACCION = 14;
export const DIAS_PROBADO = 30;

/** Cómo se dice cada etapa, y el porqué que la acompaña. */
export const NOMBRE_ETAPA: Record<EtapaTendencia, { rotulo: string; porque: string }> = {
  'test-nuevo': { rotulo: 'Test nuevo', porque: `Lleva menos de ${DIAS_GANANDO_TRACCION} días. Todavía no se sabe si le funciona.` },
  'ganando-traccion': { rotulo: 'Ganando tracción', porque: `Lleva entre ${DIAS_GANANDO_TRACCION} y ${DIAS_PROBADO} días. Lo dejó correr.` },
  probado: { rotulo: 'Probado', porque: `Lleva más de ${DIAS_PROBADO} días. Es de los que le funcionan.` },
};

/** El criterio, dicho entero, para la pantalla: es nuestro, no de Meta. */
export const ETAPA_ES_NUESTRO_CRITERIO = 'La etapa la calcula MaKo por los días que la pieza lleva a la vista. Meta no la publica.';

/**
 * La etapa de una pieza. `null` si no se sabe desde cuándo corre — y eso NO es «test nuevo»: una
 * pieza que vimos por primera vez hoy puede llevar un año corriendo, y decirle «test nuevo» es
 * exactamente el error que esta tab existe para no cometer.
 */
export function etapaDeTendencia(diasCorriendo: number | null): EtapaTendencia | null {
  if (diasCorriendo == null || !Number.isFinite(diasCorriendo) || diasCorriendo < 0) return null;
  if (diasCorriendo >= DIAS_PROBADO) return 'probado';
  if (diasCorriendo >= DIAS_GANANDO_TRACCION) return 'ganando-traccion';
  return 'test-nuevo';
}

/**
 * Cuántos días lleva corriendo una pieza. Se cuenta desde la fecha que DECLARA la fuente
 * (`ad_delivery_start_time` de un anuncio, `timestamp` de una publicación) y, si no la declara,
 * desde que la vimos por primera vez — y entonces devuelve `null` para que nadie confunda «la
 * vimos hace 3 días» con «lleva 3 días».
 */
export function diasCorriendo(
  declaradaPorLaFuente: string | null,
  ahora: Date = new Date(),
): number | null {
  if (!declaradaPorLaFuente) return null;
  const t = Date.parse(declaradaPorLaFuente);
  if (!Number.isFinite(t)) return null;
  const dias = Math.floor((ahora.getTime() - t) / 86_400_000);
  return dias < 0 ? null : dias;
}

/**
 * Tacha de una fila lo que ya venció, al LEERLA. Son las dos retenciones de los Developer Policies
 * de YouTube, y se aplican acá porque es el único lugar por donde pasan todas las lecturas: una poda
 * que vive sólo en un cron deja la fila vieja a la vista hasta que el cron corra.
 *
 * El texto a los 30 días SIEMPRE; las métricas a los 36 meses con la enmienda III.L y a los 30 días
 * sin ella. Lo que se tacha queda `null`, que es «no lo sé» — no «no lo tiene».
 *
 * ⚠️ LOS ANUNCIOS NO SE PODAN. Estas retenciones son de YouTube y alcanzaban a todos los canales. Un
 * anuncio llega porque la persona lo trajo con un clic y nadie lo vuelve a leer solo: a los 30 días
 * quedaba una tarjeta sin texto y sin forma de recuperarlo. Tampoco tiene métricas: Meta no las publica.
 */
export function podarVencido<T extends Record<string, unknown>>(fila: T, ahora: Date = new Date()): T {
  if (fila.canal === 'anuncios') return { ...fila };
  const out: Record<string, unknown> = { ...fila };
  const tTexto = typeof fila.texto_leido_en === 'string' ? fila.texto_leido_en : null;
  if (tTexto && textoVencido(tTexto, ahora)) { out.titulo = null; out.texto = null; out.etiquetas = null; out.analisis = null; }
  const tMetricas = typeof fila.metricas_leidas_en === 'string' ? fila.metricas_leidas_en : null;
  if (tMetricas && metricasVencidas(tMetricas, ahora)) { out.vistas = null; out.megusta = null; out.comentarios = null; }
  return out as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Lo que la pantalla NO dice de una persona
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las palabras con que NO se enmarca una comparación. La política III.L de YouTube prohíbe
 * explícitamente presentar una comparación como «war» o «battle», o como una rivalidad que incite
 * hostigamiento. La tab se llama Spy; la pantalla mira el mercado, no ataca a una persona.
 *
 * Lo mira `tests/spy-reglas.test.ts` sobre el texto de las pantallas de la tab.
 *
 * ⚠️ `contra` NO está en la lista, y es a propósito: es una palabra de uso corriente («ataca esta
 * objeción», «contra la fricción») y un guard que la marque reporta un problema donde no hay
 * ninguno. Un chequeo que marca de más manda a rehacer trabajo que estaba bien.
 */
export const PALABRAS_DE_DUELO: readonly string[] = ['guerra', 'batalla', 'duelo', ' vs ', 'vs.', 'enemigo', 'rival'];

// ⚠️ DOS REGLAS QUE NO SON CONSTANTES PORQUE SE CUMPLEN NO ESCRIBIENDO CÓDIGO, y por eso las
// vigila un test en vez de una variable que nadie lee:
//
//  · **La galería PÚBLICA de plantillas va con arquetipos de estilo: ni cara, ni nombre, ni @ de
//    una persona real** (decisión de Martín, 29/10/2026). Se lee como que esa persona respalda
//    MaKo, y la imagen de alguien necesita su consentimiento. La distinción que hace que la tab
//    funcione igual: dentro del análisis PRIVADO de un negocio, el competidor que ESE negocio
//    eligió sí se ve como fuente —su @, su avatar público— y de ahí sale una plantilla privada de
//    ese workspace. Son dos lugares distintos y no se mezclan. La galería pública es la Etapa 5 y
//    todavía no existe; lo que existe hoy es la ficha privada, donde el @ sí va.
//  · **La foto de perfil de Instagram se DIBUJA, no se guarda:** `profile_picture_url` es una URL
//    del CDN de Meta que VENCE, y persistirla produce avatares rotos semanas después — un defecto
//    que Martín ya marcó dos veces. Se cumple porque la migración 0359 NO TIENE una columna donde
//    guardarla, que es más fuerte que acordarse: `tests/spy-reglas.test.ts` lo afirma sobre el
//    `.sql`, así que agregar la columna pone el test en rojo.

// ─────────────────────────────────────────────────────────────────────────────
// El vocabulario del analista: compartido, no duplicado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Con qué abre la pieza de un competidor: EL MISMO vocabulario con que el Ads Analyst clasifica los
 * guiones propios (lib/ads-analyst-vocabulario.ts). Se comparte en vez de duplicarse: dos
 * vocabularios para la misma pregunta se separan solos, y entonces «lo que hace la competencia» y
 * «lo que hacemos nosotros» dejan de ser comparables, que es justo para lo que sirve la tab.
 */
export { HOOK_TYPES, TAG_VOCAB } from './ads-analyst-vocabulario';
export type { HookType, ScriptTag } from './ads-analyst-vocabulario';

/** Los tipos de pieza que se guardan de un competidor. */
export const TIPOS_PIEZA = ['anuncio', 'reel', 'publicacion', 'video', 'landing'] as const;
export type TipoPieza = (typeof TIPOS_PIEZA)[number];

/** Qué tipos de pieza puede traer cada canal. */
export const TIPOS_POR_CANAL: Record<CanalSpy, readonly TipoPieza[]> = {
  instagram: ['reel', 'publicacion'],
  youtube: ['video'],
  landing: ['landing'],
  anuncios: ['anuncio'],
};

/** Topes de lo que se guarda de una pieza, para que un texto largo no reviente una fila. */
/**
 * El nombre reducido a lo que lo hace comparable: sin tildes, sin espacios, sin puntos ni @, todo
 * en minúsculas. «Sofia Contreras», «sofiacontreras» y «@Sofia.Contreras» dan lo mismo.
 *
 * ⚠️ ES SÓLO PARA COMPARAR. Lo que se guarda y se muestra es el nombre tal como lo escribió la
 * persona: nadie quiere ver «sofiacontreras» en su lista.
 */
export const nombreComparable = (s: string): string =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** El dominio de una landing, para comparar: sin protocolo, sin www, sin barra final ni query. */
export const dominioComparable = (s: string): string =>
  (s ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];

export const TOPES = {
  /** El @ de Instagram, el id de un canal de YouTube o el id de la Biblioteca de Anuncios. */
  ref: 200,
  /** El nombre que el negocio le puso al competidor. */
  nombre: 120,
  /** El título de un video o el encabezado de un anuncio. */
  titulo: 300,
  /** El copy de un anuncio o la descripción de un video. */
  texto: 4_000,
  /** Cuántos competidores por negocio: cinco competidores bien mirados, no un directorio. */
  competidores: 25,
  /** Cuántas piezas se traen de un canal por vuelta. */
  piezasPorVuelta: 50,
} as const;

/** Lo que `queEs` (lib/spy.ts) devuelve: el canal que se reconoció en lo que se pegó. */
export type CanalLeido = { campo: 'instagram' | 'youtube_id' | 'tiktok' | 'landing_url' | 'nombre'; valor: string };

/**
 * Qué canal NUEVO aporta el link de la bio de Instagram, si aporta alguno.
 *
 * Es la mitad gratis del ítem 10 («con un dato, traer todas sus redes», 2/11/2026): la vista previa
 * ya lee el link de la bio para mostrar quién es, y al guardar se tiraba a la basura.
 *
 * Vive acá y no en `lib/spy.ts` por una razón concreta: `spy.ts` importa `server-only` y ningún test
 * puede importarlo, así que una decisión escondida ahí sólo se puede cuidar leyendo el archivo como
 * texto. Acá se EJECUTA.
 *
 * Qué descarta, y por qué cada uno:
 *   · `null`/vacío — no hay bio, o el perfil no se pudo leer.
 *   · `nombre` — la bio tenía texto, no un link. El nombre lo pone el negocio, no su biografía.
 *   · `instagram` — su bio enlaza a otra cuenta de Instagram (o a la suya). Ya estamos agregando esa
 *     red: guardarla como «landing» pondría instagram.com en el canal de su página de venta.
 *   · el MISMO campo que se pegó — si pegaron su sitio y su bio enlaza su sitio, no hay nada nuevo.
 */
export function canalDeLaBio(deLaBio: CanalLeido | null | undefined, yaPegado: CanalLeido['campo']): CanalLeido | null {
  if (!deLaBio) return null;
  // TikTok entra desde el 3/11/2026 (0365): antes `queEs` lo clasificaba como sitio y un link a su
  // TikTok en la bio terminaba guardado como su LANDING.
  if (deLaBio.campo !== 'landing_url' && deLaBio.campo !== 'youtube_id' && deLaBio.campo !== 'tiktok') return null;
  if (deLaBio.campo === yaPegado) return null;
  // Una página de enlaces (beacons, linktree…) no es su web: la abre la cadena de sus redes y saca de ahí su web de verdad
  // (lib/spy-cadena.ts). Medido en producción el 4/11/2026: @den.borgg quedó con su «web» = beacons.page/denborg.
  if (deLaBio.campo === 'landing_url' && esAgregador(deLaBio.valor)) return null;
  return deLaBio;
}
