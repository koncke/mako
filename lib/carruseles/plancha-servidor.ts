// =============================================================================
// La plancha de cada lámina de una réplica, en el servidor (13/11/2026)
// =============================================================================
// Lo que hace la plancha y por qué: ./plancha-local.ts. Acá lo que necesita el servidor, en dos momentos:
//   · ANTES de la IA (`marcarLaminas`): cada lámina a píxeles (sharp, al tamaño del diseño) y sus renglones y figuras detectados.
//     La IA mira las láminas LIMPIAS: numerar sobre la imagen no sirvió (los renglones, inventó su propia cuenta; las figuras,
//     las listó como textos y corrió todo una lámina). La copia numerada queda sólo para mirar en seco (`--salida`).
//   · DESPUÉS (`planchasDeLaReplica`): cada lámina sin sus letras ni su persona, a JPEG, al bucket del editor (o como data URL en
//     seco: scripts/carruseles-probar-editar.mts no sube nada).
//
// Nunca tira: una lámina que no se pudo leer o planchar queda null y `documentoDeReplica` arma TODO como antes. El motivo va al
// log, porque es lo que hay que mirar para que la próxima entre.
// =============================================================================
import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSupabaseServer } from '../supabase';
import { BUCKET_IMAGE } from '../image-editor/reglas';
import { asignarRenglones, bloquesSinDueno, cajaDe, esDeUnaLista, esPrincipal, leerLamina, planchar, type LecturaDeLamina, type Rgba } from './plancha-local';
import { RECORTES_MAX, anchoEsperadoDe, type PlanchaDeLamina, type Replica, type TextoCompletado, type TextoReplica } from './replica';


/** Una lámina leída: sus píxeles al tamaño del diseño y lo que se detectó en ella. */
export type LaminaLeida = { img: Rgba; lectura: LecturaDeLamina };

async function aPixeles(dataUrl: string, W: number, H: number): Promise<Rgba | null> {
  const coma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:image/') || coma < 0) return null;
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(Buffer.from(dataUrl.slice(coma + 1), 'base64'))
    .rotate().resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { ancho: info.width, alto: info.height, px: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
}

const escapar = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

/** La lámina con sus figuras marcadas (azul, F1…), para mirarla en seco. La IA NO la mira (ver arriba). */
async function marcada(img: Rgba, l: LecturaDeLamina): Promise<string> {
  const { default: sharp } = await import('sharp');
  const partes: string[] = [];
  for (const f of l.figuras) {
    partes.push(`<rect x="${f.caja.x}" y="${f.caja.y}" width="${f.caja.ancho}" height="${f.caja.alto}" fill="none" stroke="#1565C0" stroke-width="3" stroke-dasharray="10 6"/>`);
    partes.push(`<rect x="${f.caja.x + 2}" y="${f.caja.y + 2}" width="${14 + 11 * f.n.length}" height="24" rx="4" fill="#1565C0"/><text x="${f.caja.x + 9}" y="${f.caja.y + 20}" font-family="Arial" font-weight="700" font-size="18" fill="#fff">${escapar(f.n)}</text>`);
  }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${img.ancho}" height="${img.alto}">${partes.join('')}</svg>`);
  const jpeg = await sharp(Buffer.from(img.px.buffer, img.px.byteOffset, img.px.byteLength), { raw: { width: img.ancho, height: img.alto, channels: 4 } })
    .removeAlpha().composite([{ input: svg }]).jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/**
 * Cada lámina leída y su copia marcada, en orden. null donde no se pudo (la IA mira esa lámina sin marcas, y la réplica sale
 * como antes). Nunca tira.
 */
export async function marcarLaminas(imagenes: readonly string[], W: number, H: number): Promise<Array<{ leida: LaminaLeida; marcada: string } | null>> {
  return Promise.all(imagenes.map(async (src, i) => {
    try {
      const img = await aPixeles(src, W, H);
      if (!img) return null;
      const lectura = leerLamina(img);
      return { leida: { img, lectura }, marcada: await marcada(img, lectura) };
    } catch (e) {
      console.warn(`[carruseles] no pude leer la lámina ${i + 1} para numerarla:`, e instanceof Error ? e.message : e);
      return null;
    }
  }));
}

/** Un contador de lámina («02 / 06»): en otra lámina lleva SU número. */
const CONTADOR = /^(\s*)(\d+)(\s*\/\s*\d+\s*)$/;

/**
 * Lo del MARCO que la IA dio en una lámina y se olvidó en otra (13/11/2026, @lifeofarjav: el @ del pie lo listó en la portada y
 * no en las otras cinco, y quedaba el @ del original quemado en la plancha). Un renglón que en otra lámina es un texto del marco
 * (una firma o un rótulo de un renglón) y acá está en el MISMO lugar y del mismo tamaño, sin ser de nadie, es ese mismo texto: se
 * agrega a esta lámina (con su número de lámina, si es un contador) y se le asigna ese renglón. Modifica `textos` y `asignados`.
 */
function delMarcoEnTodas(textos: TextoReplica[][], leidas: readonly LaminaLeida[], asignados: number[][][]): void {
  const marco: Array<{ caja: { x: number; y: number; ancho: number; alto: number }; t: TextoReplica }> = [];
  textos.forEach((l, i) => l.forEach((t, k) => {
    if ((t.rol !== 'firma' && t.rol !== 'rotulo') || asignados[i][k].length !== 1) return;
    const r = leidas[i].lectura.renglones.find((x) => x.n === asignados[i][k][0]);
    if (r) marco.push({ caja: r.caja, t });
  }));
  textos.forEach((l, i) => {
    const usados = new Set(asignados[i].flat());
    for (const r of leidas[i].lectura.renglones) {
      if (usados.has(r.n)) continue;
      const igual = marco.find((m) => Math.abs(m.caja.x - r.caja.x) <= 10 && Math.abs(m.caja.y - r.caja.y) <= 10
        && Math.abs(m.caja.alto - r.caja.alto) <= Math.max(3, 0.2 * m.caja.alto) && Math.abs(m.caja.ancho - r.caja.ancho) <= Math.max(12, 0.15 * m.caja.ancho));
      if (!igual) continue;
      const c = CONTADOR.exec(igual.t.texto);
      const texto = c ? `${c[1]}${String(i + 1).padStart(c[2].length, '0')}${c[3]}` : igual.t.texto;
      l.push({ ...igual.t, texto });
      asignados[i].push([r.n]);
      usados.add(r.n);
    }
  });
}

/** El segundo pedido a la IA (lo arma ./replica-servidor.ts con la IA del negocio): los recortes, cuántos son textos, lo que ya
 *  dicen las láminas nuevas. null = no contestó (lo que faltaba queda como en el original y se sigue). */
export type Completar = (p: { recortes: string[]; textos: number; figuras: number; contexto: string }) =>
  Promise<{ textos: Array<TextoCompletado | null>; personas: boolean[] } | null>;

/** Un pedazo de la lámina como JPEG (al doble si es chico: la IA lee mejor una letra de 40 px que una de 14). */
async function recorte(img: Rgba, c: { x: number; y: number; ancho: number; alto: number }, aire: number): Promise<string> {
  const { default: sharp } = await import('sharp');
  const x = Math.max(0, Math.floor(c.x - aire));
  const y = Math.max(0, Math.floor(c.y - aire));
  const ancho = Math.min(img.ancho - x, Math.ceil(c.ancho + 2 * aire));
  const alto = Math.min(img.alto - y, Math.ceil(c.alto + 2 * aire));
  let pieza = sharp(Buffer.from(img.px.buffer, img.px.byteOffset, img.px.byteLength), { raw: { width: img.ancho, height: img.alto, channels: 4 } })
    .extract({ left: x, top: y, width: Math.max(1, ancho), height: Math.max(1, alto) }).removeAlpha();
  if (alto < 60) pieza = pieza.resize({ height: alto * 2 });
  return `data:image/jpeg;base64,${(await pieza.jpeg({ quality: 88 }).toBuffer()).toString('base64')}`;
}

/** Cómo se alinea un bloque, por dónde está: centrado en la lámina, pegado a la derecha, o a la izquierda. */
function alineacionDe(c: { x: number; ancho: number }, W: number): 'left' | 'center' | 'right' {
  const centro = c.x + c.ancho / 2;
  if (Math.abs(centro - W / 2) < 0.04 * W) return 'center';
  return c.x > 0.5 * W && c.x + c.ancho > 0.85 * W ? 'right' : 'left';
}

/**
 * Lo que la lámina tiene y la IA no dijo (13/11/2026): los bloques de texto principales sin dueño y las figuras grandes que no
 * marcó como persona van RECORTADOS en un segundo pedido; lo que vuelve se suma a la lámina con el lugar del recorte. Modifica
 * `textos`, `asignados` y `personas`.
 */
async function completarLoQueFalta(
  leidas: readonly LaminaLeida[], textos: TextoReplica[][], asignados: number[][][], personas: string[][], completar: Completar,
): Promise<void> {
  const W = leidas[0].img.ancho;
  const H = leidas[0].img.alto;
  // UN pedido por lámina, todos a la vez (13/11/2026): con los recortes de las seis láminas en un solo pedido, la IA corría las
  // respuestas y los textos de una captura de la lámina 3 terminaban en la portada, y la persona de la portada en la lámina 2.
  await Promise.all(leidas.map(async (le, i) => {
    const bloques = bloquesSinDueno(le.img, le.lectura, new Set(asignados[i].flat())).slice(0, RECORTES_MAX.textos);
    const figuras = le.lectura.figuras.filter((f) => !personas[i].includes(f.n) && f.caja.ancho * f.caja.alto >= (0.12 * W) ** 2).slice(0, RECORTES_MAX.figuras);
    if (!bloques.length && !figuras.length) return;
    const recortes = await Promise.all([...bloques.map((b) => recorte(le.img, cajaDe(b), 8)), ...figuras.map((f) => recorte(le.img, f.caja, 0))]);
    const contexto = textos[i].filter((t) => t.texto).map((t) => t.texto.replace(/\n/g, ' ')).join(' · ');
    const r = await completar({ recortes, textos: bloques.length, figuras: figuras.length, contexto }).catch(() => null);
    if (!r) return;
    bloques.forEach((b, k) => {
      const t = r.textos[k];
      if (!t) return;
      const c = cajaDe(b);
      const alto = Math.max(...b.map((x) => x.caja.alto));
      const nuevo: TextoReplica = {
        ...t, letra: 'sans', negrita: t.rol === 'titulo' || t.rol === 'cta' || t.rol === 'rotulo',
        x: c.x / W, y: c.y / H, ancho: c.ancho / W, tamano: Math.min(0.16, Math.max(0.016, alto / 0.85 / W)), alinear: alineacionDe(c, W),
      };
      // Lo que leyó tiene que caber en su recorte: un texto el doble de largo (o la mitad) es la respuesta de OTRO recorte.
      const razon = anchoEsperadoDe(nuevo, W) / Math.max(1, c.ancho);
      if (razon < 0.6 || razon > 1.7) return;
      textos[i].push(nuevo);
      asignados[i].push(b.map((x) => x.n));
    });
    figuras.forEach((f, k) => { if (r.personas[k]) personas[i].push(f.n); });
  }));
}

/** Lo más chico que se reescribe (en píxeles de la lámina, el alto del renglón): el marco (©, @, «02 / 06») mide de 15 a 25; la
 *  letra de una captura o de una lista, de 10 a 14. */
const RENGLON_MINIMO = 15;

/** Lo del marco que es igual en cualquier negocio: el «© 2026» y el número de lámina. */
const MARCO_FIJO = /^\s*(©\s*\d{4}|\d{1,2}\s*\/\s*\d{1,2})\s*$/;
/** Desde este alto, un renglón adentro de una caja es parte del diseño (una llamada a la acción en su recuadro), no de una captura. */
const RENGLON_DE_CAJA = 20;

/**
 * Lo que se deja como está en el original, sin borrar ni escribir encima (13/11/2026). Modifica `textos` y `asignados`.
 *   · El marco que no cambia («© 2026», «02 / 06»): el original tiene su letra exacta y su color (el «02» naranja).
 *   · La letra chica (la de una captura, una ventana, una lista), y adentro de una caja todo lo que no es grande: la IA adaptaba
 *     unos renglones de un párrafo de captura y otros no, y quedaba una mezcla de dos idiomas con letras que se pisaban (la
 *     lámina 4 de @lifeofarjav). Lo grande de una caja (la llamada a la acción en su recuadro) sí se reescribe.
 */
function quedanComoEnElOriginal(leidas: readonly LaminaLeida[], textos: TextoReplica[][], asignados: number[][][]): void {
  const limpio = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');
  leidas.forEach((le, i) => {
    const porNumero = new Map(le.lectura.renglones.map((r) => [r.n, r]));
    textos[i].forEach((t, k) => {
      const rs = asignados[i][k].map((n) => porNumero.get(n)).filter((r): r is NonNullable<typeof r> => !!r);
      // También los VACÍOS (el @ del original, con un negocio sin @): sólo se borran, y uno mal ubicado borraba dos renglones de
      // una captura (13/11/2026, lámina 5 de @lifeofarjav) y dejaba el @ del pie.
      if (!rs.length) return;
      // Sólo lo que no cambia de un negocio a otro (el «© 2026», el «02 / 06»): a veces la IA escribe en «original» el texto NUEVO
      // (13/11/2026: en una corrida, en todos; «PASO 1» por «STEP 1»), así que un texto igual a su «original» no dice nada.
      const igual = MARCO_FIJO.test(t.texto) && !!t.original && limpio(t.original).replace(/\s/g, '') === limpio(t.texto).replace(/\s/g, '');
      // Adentro de una caja, la letra GRANDE es del diseño (la llamada a la acción en su recuadro) y se reescribe; la chica de un
      // párrafo, no.
      const alto = Math.max(...rs.map((r) => r.caja.alto));
      const deCaptura = esDeUnaLista(le.lectura, rs) || alto < RENGLON_MINIMO || (!esPrincipal(le.img, rs) && alto < RENGLON_DE_CAJA);
      if (igual || deCaptura) { textos[i][k] = { ...t, texto: '' }; asignados[i][k] = []; }
    });
  });
}

/**
 * La plancha de cada lámina de la réplica, en orden, con los renglones y las personas que dijo la IA. Todo o nada: con una sola
 * lámina redibujada en medio de las fieles, el carrusel se ve armado con dos moldes.
 */
export async function planchasDeLaReplica(
  ws: number, replica: Replica, leidas: ReadonlyArray<LaminaLeida | null>, o: { seco: boolean; completar?: Completar; lugarDePersona?: boolean },
): Promise<Array<PlanchaDeLamina | null>> {
  const nada = replica.laminas.map(() => null);
  if (leidas.length < replica.laminas.length || leidas.some((x) => !x)) return nada;
  const { default: sharp } = await import('sharp');
  const W = leidas[0]!.img.ancho;
  const H = leidas[0]!.img.alto;
  const asignados = replica.laminas.map((l, i) => asignarRenglones(l.textos.map((t) => ({
    x: t.x * W, y: t.y * H, ancho: t.ancho * W, em: t.tamano * W, alinear: t.alinear,
    renglones: Math.max(1, (t.original ?? t.texto).split('\n').length), anchoEsperado: anchoEsperadoDe(t, W),
  })), leidas[i]!.lectura.renglones, W));
  // Se trabaja sobre una COPIA de los textos: sólo si TODAS las láminas se planchean, la réplica se queda con lo agregado del marco
  // y sin los textos chicos que no se encontraron (con una que falle, se arma todo como antes, con lo que dijo la IA).
  const textos = replica.laminas.map((l) => [...l.textos]);
  delMarcoEnTodas(textos, leidas as LaminaLeida[], asignados);
  const personas = replica.laminas.map((l) => [...(l.personas ?? [])]);
  if (o.completar) await completarLoQueFalta(leidas as LaminaLeida[], textos, asignados, personas, o.completar);
  quedanComoEnElOriginal(leidas as LaminaLeida[], textos, asignados);
  const out: Array<PlanchaDeLamina | null> = [];
  for (const [i, l] of replica.laminas.entries()) {
    const leida = leidas[i]!;
    // Se planchea una COPIA: la lámina leída queda como estaba por si hay que volver a intentar.
    const img: Rgba = { ancho: leida.img.ancho, alto: leida.img.alto, px: new Uint8ClampedArray(leida.img.px) };
    const r = planchar(img, leida.lectura, { textos: asignados[i].map((rs) => ({ renglones: rs })), personas: personas[i] });
    // planchar devuelve un bloque por texto, en el orden de `textos[i]` (los de la IA y, después, los del marco agregados).
    if (!r.ok) { console.warn(`[carruseles] la lámina ${i + 1} no se plancheó (se arma todo como antes): ${r.motivo}`); return nada; }
    // Un texto de la IA que no se encontró en la lámina no se escribe: no tiene lugar medido. Nunca era uno principal sin más:
    // la IA lista también letra de adentro de una captura («Estrategia.pdf», como titular), y si era uno principal, su bloque
    // quedó sin dueño y el segundo pedido ya lo leyó y lo adaptó (`completarLoQueFalta`). Se deja como está en el original.
    for (const [k, t] of textos[i].entries()) if (t.texto && !r.textos[k]) textos[i][k] = { ...t, texto: '' };
    const jpeg = await sharp(Buffer.from(img.px.buffer, img.px.byteOffset, img.px.byteLength), { raw: { width: img.ancho, height: img.alto, channels: 4 } })
      .removeAlpha().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    // La persona del original se borró siempre; su lugar queda marcado para la del negocio salvo con «Sin persona» en el guiado.
    const lugares = o.lugarDePersona === false ? [] : r.personas;
    if (o.seco) { out.push({ src: `data:image/jpeg;base64,${jpeg.toString('base64')}`, textos: r.textos, personas: lugares }); continue; }
    const ruta = `${ws}/plancha-${randomUUID()}.jpg`;
    const bucket = getSupabaseServer().storage.from(BUCKET_IMAGE);
    const up = await bucket.upload(ruta, jpeg, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
    if (up.error) { console.warn(`[carruseles] la plancha de la lámina ${i + 1} no se subió: ${up.error.message}`); return nada; }
    out.push({ src: bucket.getPublicUrl(ruta).data.publicUrl, textos: r.textos, personas: lugares });
  }
  replica.laminas.forEach((l, i) => { l.textos = textos[i]; l.personas = personas[i]; });
  return out;
}
