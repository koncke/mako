// =============================================================================
// editor-landing/replicar-estructura — la ESTRUCTURA de una página leída: sus secciones, su molde y la fidelidad
// =============================================================================
// Pedido de Martín (28/10/2026, «replicar la landing de otra persona»): «lo que sí quiero replicar son los ángulos de
// comunicación, los dolores, la forma de venta, la cantidad de párrafos, los títulos, cómo está acomodado». Esto es lo
// PURO de la estructura (sin red ni IA, con test: tests/web-generator-replicar-partes.test.ts):
//   · `esquemaDeReplica`: el texto de una página leída (el del extractor o el del lector del navegador: `# título`,
//     `[BOTÓN]`, `•`, `[DESPLEGABLE]`, un bloque por renglón) → las secciones del esquema, en el orden de la página;
//   · `moldeDeSeccion` / `moldeDeEsquema`: cuántos subtítulos, párrafos, viñetas, botones y desplegables tiene cada
//     sección, y cuántas palabras: lo que la réplica tiene que repetir cuando se pide la estructura sin el texto;
//   · `perfilDeTarjeta` / `fidelidadDeEstructura`: lo mismo contado en las secciones que quedaron en el editor, para
//     MEDIR la réplica contra la original (lo usa el log de replicar.ts y el test).
//
// ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: «la réplica tiene las mismas secciones» no era cierto en una landing larga.
//    `esquemaConservado` (ia-reglas.ts, el de «Pegar texto») corta en CADA `#`, `##` y `###` y se queda con las primeras
//    20 (`MAX_SECCIONES`). Medido el 28/10/2026 con el HTML de 100ads.ai: 1 h1, 12 h2 y 20 h3 → 33 cortes, y la réplica
//    se quedaba con 20: las 13 últimas secciones (el producto, la garantía, las preguntas, el cierre) se perdían SIN
//    AVISO, y cada tarjeta de una grilla (un `###` adentro de un `##`) salía como una sección suelta. gohighlevel.com:
//    19 h2 + 3 h3, y se perdían las 3 últimas. Acá se corta en el NIVEL DE SECCIÓN de la página (`nivelDeSeccion`), lo
//    de más adentro queda adentro como subtítulo (`### …`), y si aun así sobran secciones se JUNTAN las vecinas más
//    chicas (`juntarHasta`): nunca se tira texto.
// =============================================================================

import { MAX_SECCIONES, MAX_TITULO_SECCION, cortarPegado, esquemaConservado } from './ia-reglas';
import { TOPES, NODO, type JsonNodo } from './doc';
import type { Esquema, SeccionEsquema } from './api-tipos';
import { sinEnlacesALaOriginal } from './replicar-partes';
import { alTuteo } from '../al-tuteo';

const RE_TITULO = /^(#{1,6})\s+(.+)$/;
const RE_BOTON = /^\[BOT[ÓO]N\]/i;
const RE_DESPLEGABLE = /^\[(?:DESPLEGABLE|PESTAÑA)\]/i;
const RE_VINETA = /^[•▪]\s+/;

/** Las palabras de un renglón leído, sin sus marcas (`#`, `[BOTÓN]`, `•`, la flecha del destino). */
export function palabrasDe(linea: string): number {
  // En un botón, lo de después de la flecha es su DESTINO («→ envía el formulario»), no texto que se ve; en un desplegable
  // es la respuesta, y cuenta (MasterAds, 28/10/2026: 8 palabras de destinos contaban como texto de la original).
  const sinDestino = RE_BOTON.test(linea.trim()) ? linea.replace(/\s→\s[\s\S]*$/, '') : linea;
  const t = sinDestino
    .replace(RE_TITULO, '$2')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(RE_VINETA, '')
    .replace(/\s*→\s*(?:https?:\/\/\S+|#[\w-]+)\s*$/i, '');
  return t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * El nivel de título en el que la página corta sus SECCIONES. El más alto (h1 antes que h2) que aparece al menos dos
 * veces: un h1 solo es el del hero, y las secciones van en h2. Si ése es el h1 y deja menos de 4 secciones, se baja al
 * nivel siguiente que tenga títulos (un sitio que usa h1 en el hero y en el cierre, y h2 para el resto), AUNQUE pase el
 * tope: lo que sobra lo junta `juntarHasta`. ⚠️ Con «mientras no pase del tope» (revisión del 28/10/2026), 2 h1 y 20 h2
 * daban DOS secciones (la primera con 20 subtítulos) y 1 h1 con 20 h2 daba 20: el salto pasaba al cruzar el tope. null =
 * la página no trae títulos que corten (se usa el corte de siempre).
 */
export function nivelDeSeccion(lineas: readonly string[]): number | null {
  const porNivel = [0, 0, 0, 0, 0, 0, 0];
  for (const l of lineas) {
    const m = RE_TITULO.exec(l);
    if (m) porNivel[m[1].length]++;
  }
  /** Las secciones que salen cortando en `n` (todo título de nivel `n` o más alto abre una). */
  const hasta = (n: number) => porNivel.slice(1, n + 1).reduce((a, b) => a + b, 0);
  let nivel = 0;
  for (let n = 1; n <= 6; n++) if (porNivel[n] >= 2) { nivel = n; break; }
  if (!nivel) return null;
  // Sólo con h1: un sitio que usa h1 en dos o tres bloques y h2 para el resto. Con h2 o más adentro, pocas secciones
  // son pocas secciones (las tarjetas de adentro no se sueltan).
  if (nivel === 1) for (let n = 2; n <= 6 && hasta(nivel) < 4; n++) if (porNivel[n]) nivel = n;
  return nivel;
}

/** Las palabras de una sección del esquema (título y puntos). */
const palabrasDeSeccion = (s: SeccionEsquema): number => palabrasDe(s.titulo) + s.puntos.reduce((n, p) => n + palabrasDe(p), 0);

/**
 * Junta secciones vecinas hasta que entren en `tope`: cada vez, el par de vecinas con menos palabras entre las dos (la
 * de abajo pasa como subtítulo de la de arriba). Así lo que sobra se acomoda donde menos se nota, y no se pierde nada.
 */
export function juntarHasta(secciones: readonly SeccionEsquema[], tope = MAX_SECCIONES): SeccionEsquema[] {
  const out = secciones.map((s) => ({ titulo: s.titulo, puntos: [...s.puntos] }));
  while (out.length > tope) {
    let mejor = 1;
    let menor = Infinity;
    for (let i = 1; i < out.length; i++) {
      const p = palabrasDeSeccion(out[i - 1]) + palabrasDeSeccion(out[i]);
      if (p < menor) { menor = p; mejor = i; }
    }
    const [abajo] = out.splice(mejor, 1);
    out[mejor - 1].puntos.push(`### ${abajo.titulo}`, ...abajo.puntos);
  }
  return out;
}

/**
 * El esquema de una página LEÍDA (Replicar e Importar con «Conservar»), con la estructura de la página: una sección
 * por título de su nivel de sección, en el orden de la página, y todo el texto adentro, palabra por palabra. Los
 * títulos de más adentro quedan como renglón `### …` (un subtítulo de la sección). Lo de antes del primer título (un
 * antetítulo, el texto del logo) va al principio de la primera sección. Un texto con cortes `---` (lo partió la
 * persona) o sin títulos que corten sigue por `esquemaConservado`, como siempre.
 */
export function esquemaDeReplica(texto: string, tituloFallback = 'Landing'): Esquema {
  const limpio = String(texto ?? '').replace(/\r\n?/g, '\n');
  if (cortarPegado(limpio).length > 1) return esquemaConservado(limpio, tituloFallback);
  const lineas = limpio.split('\n').map((l) => l.trim()).filter(Boolean);
  const nivel = nivelDeSeccion(lineas);
  if (nivel === null) return esquemaConservado(limpio, tituloFallback);
  const secciones: SeccionEsquema[] = [];
  const antes: string[] = [];
  for (const l of lineas) {
    const m = RE_TITULO.exec(l);
    if (m && m[1].length <= nivel) {
      secciones.push({ titulo: m[2].trim().slice(0, MAX_TITULO_SECCION), puntos: [] });
      continue;
    }
    // Más adentro que el nivel de sección: un subtítulo (siempre `###`, el que dibuja la sección como subtítulo).
    const renglon = m ? `### ${m[2].trim()}` : l;
    if (secciones.length) secciones[secciones.length - 1].puntos.push(renglon.slice(0, TOPES.caracteresTexto));
    else antes.push(renglon.slice(0, TOPES.caracteresTexto));
  }
  if (antes.length) {
    if (secciones.length) secciones[0].puntos.unshift(...antes);
    else return esquemaConservado(limpio, tituloFallback);
  }
  const juntas = juntarHasta(secciones);
  return { titulo: (juntas[0]?.titulo || tituloFallback).slice(0, TOPES.titulo), secciones: juntas };
}

// ─────────────────────────────────────────────────────────────────────────────
// El molde: la forma de cada sección de la original
// ─────────────────────────────────────────────────────────────────────────────

/** La forma de una sección: lo que la réplica repite cuando se pide la estructura sin el texto. */
export type MoldeSeccion = {
  titulo: string;
  /** Los títulos de adentro (las tarjetas de una grilla, los pasos). */
  subtitulos: number;
  parrafos: number;
  vinetas: number;
  botones: number;
  desplegables: number;
  palabras: number;
};

export function moldeDeSeccion(s: SeccionEsquema): MoldeSeccion {
  const m: MoldeSeccion = { titulo: s.titulo, subtitulos: 0, parrafos: 0, vinetas: 0, botones: 0, desplegables: 0, palabras: palabrasDe(s.titulo) };
  for (const p of s.puntos) {
    const t = p.trim();
    if (RE_TITULO.test(t)) m.subtitulos++;
    else if (RE_BOTON.test(t)) m.botones++;
    else if (RE_DESPLEGABLE.test(t)) m.desplegables++;
    else if (RE_VINETA.test(t)) m.vinetas++;
    else m.parrafos++;
    m.palabras += palabrasDe(t);
  }
  return m;
}

export const moldeDeEsquema = (e: Esquema): MoldeSeccion[] => e.secciones.map(moldeDeSeccion);

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** «2 subtítulos · 3 párrafos · 1 botón», lo que se ve en la lectura y lo que lee la IA. Vacío si no tiene nada. */
export function resumenDeMolde(m: MoldeSeccion): string {
  return [
    m.subtitulos ? plural(m.subtitulos, 'subtítulo', 'subtítulos') : '',
    m.parrafos ? plural(m.parrafos, 'párrafo', 'párrafos') : '',
    m.vinetas ? plural(m.vinetas, 'viñeta', 'viñetas') : '',
    m.botones ? plural(m.botones, 'botón', 'botones') : '',
    m.desplegables ? plural(m.desplegables, 'pregunta desplegable', 'preguntas desplegables') : '',
  ].filter(Boolean).join(' · ');
}

/** Las imágenes de una sección de la original, como las deja leer el estilo (`ImagenOriginal`, estilo-original.ts). */
export type ImagenesDeSeccion = { cantidad: number; fondo: boolean };

/**
 * CÓMO ESTÁ ACOMODADA una sección (28/10/2026, Martín: «cómo está acomodado»), con lo que se puede saber sin mirar la
 * página: dónde lleva imágenes (una junto al texto, de fondo, una galería) y si sus subtítulos son tarjetas. Va en el
 * molde: sin el diseño de la original, la réplica deja el HUECO de la imagen donde la otra tenía una (la llena la
 * persona). Vacío si no hay nada que decir.
 */
export function acomodoDeSeccion(m: MoldeSeccion, img: ImagenesDeSeccion | null, disp: DisposicionDeSeccion | null = null): string {
  const partes: string[] = [];
  // 12/11/2026 (la réplica de la masterclass de Clara Pérez): un video junto al texto, y las fotos que vienen en base64 (no se
  // copian, pero dicen cómo está acomodada: `fotos`) cuentan igual que una imagen.
  if (disp?.video) partes.push('un video junto al texto (deja el hueco del video)');
  const fotos = img?.cantidad ?? disp?.fotos ?? 0;
  const enTarjetas = !!disp?.tarjetas?.conFoto;
  if (img?.fondo) partes.push('imagen de fondo');
  else if (!enTarjetas && fotos >= 3) partes.push(`${fotos} imágenes (galería o logos)`);
  else if (!enTarjetas && fotos === 2) partes.push('dos imágenes');
  else if (!enTarjetas && fotos === 1 && !disp?.video) partes.push('una imagen junto al texto');
  // Las TARJETAS que se ven en la página (los testimonios, los pasos numerados): la grilla, con su cantidad EXACTA.
  if (disp?.tarjetas) partes.push(`${disp.tarjetas.cantidad} tarjetas en grilla, ni una más ni una menos${disp.tarjetas.conFoto ? ', cada una con el hueco de su foto' : ''}`);
  // 13/11/2026: la cantidad la pone la original, no la IA (la réplica de Clara trajo 3 pasos de 5); si vuelve con otra, segunda
  // pasada con `notaDeCantidad` (replicar.ts).
  else if (m.subtitulos >= 2) partes.push(`${m.subtitulos} tarjetas o pasos con su subtítulo, ni uno más ni uno menos`);
  if (m.desplegables >= 2) partes.push(`${m.desplegables} preguntas desplegables, ni una más ni una menos`);
  return partes.join(', ');
}

/** Cómo está armada una sección de la original, más allá de sus imágenes (lo de `SeccionOriginal`, estilo-original.ts). */
export type DisposicionDeSeccion = {
  tarjetas: { cantidad: number; conFoto: boolean } | null; fotos: number; video: boolean;
  /** De qué lado del texto va su foto o su video (13/11/2026, `SeccionOriginal.lado`). */
  lado?: 'izquierda' | 'derecha';
  /** El fondo de su parte de la original (13/11/2026, el crema de «Quién es» de Clara sobre una página blanca). */
  fondo?: string;
};

/**
 * La disposición de cada sección de la réplica: la de las partes de la original que le tocan (`partesDeCadaSeccion`). Las
 * tarjetas, las de la parte que más tiene; las fotos, sumadas; el video, si alguna lo tiene. null si no hay nada que decir.
 */
export function disposicionPorSeccion(
  partes: readonly (readonly number[])[],
  secciones: readonly { tarjetas?: { cantidad: number; conFoto: boolean }; fotos?: number; video?: boolean; lado?: 'izquierda' | 'derecha'; fondo?: string | null }[],
): (DisposicionDeSeccion | null)[] {
  return partes.map((ps) => {
    let tarjetas: DisposicionDeSeccion['tarjetas'] = null;
    let fotos = 0;
    let video = false;
    let lado: DisposicionDeSeccion['lado'];
    let fondo: string | undefined;
    for (const p of ps) {
      const s = secciones[p];
      if (!s) continue;
      lado ??= s.lado;
      fondo ??= s.fondo ?? undefined;
      if (s.tarjetas && (!tarjetas || s.tarjetas.cantidad > tarjetas.cantidad)) tarjetas = s.tarjetas;
      fotos += s.fotos ?? 0;
      video ||= s.video === true;
    }
    return tarjetas || fotos || video || fondo ? { tarjetas, fotos, video, ...(lado ? { lado } : {}), ...(fondo ? { fondo } : {}) } : null;
  });
}

/** Las imágenes de cada sección de la réplica: las de las partes de la original que le tocan (`partesDeCadaSeccion`). */
export function imagenesPorSeccion(partes: readonly (readonly number[])[], imagenes: readonly { seccion: number; fondo: boolean }[]): (ImagenesDeSeccion | null)[] {
  return partes.map((ps) => {
    const suyas = imagenes.filter((im) => ps.includes(im.seccion));
    return suyas.length ? { cantidad: suyas.filter((im) => !im.fondo).length || suyas.length, fondo: suyas.some((im) => im.fondo) } : null;
  });
}

/**
 * La NOTA de una sección para la tanda que la escribe (28/10/2026): su ángulo, su molde y su acomodo, en una línea. Viaja
 * CON la sección (`SeccionEsquema.nota`, `pedidoDeTanda`), así cada tanda manda sólo las suyas: en la instrucción común
 * (5.000 caracteres para todas) una lista de 20 secciones con su ángulo no entraba (medido con gohighlevel, leadsales y
 * kommo: se perdían las últimas).
 */
export function notaDeSeccion(m: MoldeSeccion, acomodo = '', angulo = ''): string {
  const t = [angulo ? `ángulo: ${angulo}` : '', `forma: ${resumenDeMolde(m) || 'sólo el título'} (~${m.palabras} palabras)`, acomodo ? `acomodo: ${acomodo}` : '']
    .filter(Boolean).join('; ');
  return t.length > 400 ? `${t.slice(0, 399)}…` : t;
}

/**
 * El molde de la página entera, como lo lee la IA en la tanda de secciones: UNA línea por sección, con su número y su
 * título (la tanda se ubica por el título), su ángulo (`angulos`, «Precio: plan con garantía»), la forma, el largo y cómo
 * está acomodada (`acomodos`, si se leyó el estilo). Va adentro de las instrucciones (`MAX_INSTRUCCIONES`, 5.000) junto con
 * los ángulos generales: el tope lo pone quien llama con lo que sobra (medido el 28/10: con un tope fijo de 1.600 y el
 * ángulo de cada sección en otra lista, gohighlevel, leadsales y kommo perdían las últimas secciones de las DOS listas).
 */
export function textoDeMolde(moldes: readonly MoldeSeccion[], tope = 1_600, acomodos: readonly string[] = [], angulos: readonly string[] = []): string {
  const lineas = moldes.map((m, i) => `${i + 1}. «${m.titulo.slice(0, 45)}»${angulos[i] ? ` [${angulos[i]}]` : ''}: ${resumenDeMolde(m) || 'sólo el título'} (~${m.palabras} palabras)${acomodos[i] ? `; ${acomodos[i]}` : ''}`);
  const out: string[] = [];
  let largo = 0;
  for (const l of lineas) {
    if (largo + l.length + 1 > tope) { out.push(`… y ${lineas.length - out.length} secciones más con la misma regla.`); break; }
    out.push(l);
    largo += l.length + 1;
  }
  return out.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// La fidelidad: la réplica contra la original
// ─────────────────────────────────────────────────────────────────────────────

/** Lo mismo que el molde, contado en una sección del editor. `textos` = párrafos con texto (sueltos, de lista o de ítem). */
export type PerfilTarjeta = { titulos: number; textos: number; botones: number; desplegables: number; palabras: number };

const textoDeNodo = (n: JsonNodo): string => (n.type === 'text' ? String(n.text ?? '') : (n.content ?? []).map(textoDeNodo).join(' '));

export function perfilDeTarjeta(t: JsonNodo): PerfilTarjeta {
  const p: PerfilTarjeta = { titulos: 0, textos: 0, botones: 0, desplegables: 0, palabras: 0 };
  const visitar = (n: JsonNodo) => {
    if (n.type === 'heading') { if (textoDeNodo(n).trim()) p.titulos++; }
    else if (n.type === 'paragraph') { if (textoDeNodo(n).trim()) p.textos++; }
    else if (n.type === NODO.boton) { p.botones++; }
    else if (n.type === NODO.desplegable) p.desplegables++;
    if (n.type === 'text') p.palabras += String(n.text ?? '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    if (n.type !== NODO.boton) for (const c of n.content ?? []) visitar(c);
    else p.palabras += textoDeNodo(n).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  };
  visitar(t);
  return p;
}

/** La original y la réplica, sumadas y sección por sección. */
export type Fidelidad = {
  secciones: { original: number; copia: number };
  titulos: { original: number; copia: number };
  textos: { original: number; copia: number };
  botones: { original: number; copia: number };
  palabras: { original: number; copia: number };
  /** Secciones (de las que están en las dos) cuyos textos están a ±1 o a ±25% de los de la original. */
  seccionesParejas: number;
};

/**
 * Cuánto se parece la estructura de la réplica a la de la original. Los «textos» de la original son sus párrafos,
 * viñetas y desplegables (un desplegable cuenta su pregunta como texto aparte: en el editor es su título); los títulos,
 * el de la sección más sus subtítulos. Es una MEDIDA para el log y el test, no un juicio: la IA puede armar una grilla
 * de tarjetas donde había viñetas, y eso suma títulos sin estar mal.
 */
export function fidelidadDeEstructura(original: readonly MoldeSeccion[], copia: readonly JsonNodo[]): Fidelidad {
  const perfiles = copia.map(perfilDeTarjeta);
  const suma = <T>(xs: readonly T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0);
  const textosOriginal = (m: MoldeSeccion) => m.parrafos + m.vinetas + m.desplegables;
  let parejas = 0;
  for (let i = 0; i < Math.min(original.length, perfiles.length); i++) {
    const a = textosOriginal(original[i]);
    const b = perfiles[i].textos;
    if (Math.abs(a - b) <= Math.max(1, Math.round(a * 0.25))) parejas++;
  }
  return {
    secciones: { original: original.length, copia: copia.length },
    titulos: { original: suma(original, (m) => 1 + m.subtitulos), copia: suma(perfiles, (p) => p.titulos) },
    textos: { original: suma(original, textosOriginal), copia: suma(perfiles, (p) => p.textos) },
    botones: { original: suma(original, (m) => m.botones), copia: suma(perfiles, (p) => p.botones) },
    palabras: { original: suma(original, (m) => m.palabras), copia: suma(perfiles, (p) => p.palabras) },
    seccionesParejas: parejas,
  };
}

/** La fidelidad en una línea, para el log de la réplica. */
export function lineaDeFidelidad(f: Fidelidad): string {
  const par = (k: keyof Omit<Fidelidad, 'seccionesParejas'>) => `${f[k].copia}/${f[k].original}`;
  return `secciones ${par('secciones')}, títulos ${par('titulos')}, textos ${par('textos')}, botones ${par('botones')}, palabras ${par('palabras')}, ${f.seccionesParejas} secciones parejas`;
}

/**
 * La grilla con foto de la original, con el hueco de cada foto en la réplica (13/11/2026). Medido en producción: la de Clara
 * tiene 6 testimonios en grilla, cada uno con su foto; la nota de la sección pedía «6 tarjetas en grilla, cada una con el hueco
 * de su foto» y la IA armó las 6 tarjetas en una variante SIN imagen: no quedaba dónde poner las fotos. Si la sección de la
 * original tiene tarjetas con foto, el bloque de ítems con la cantidad más parecida pasa a «Imágenes con texto» cuando su
 * variante no lleva imagen (en el editor cada ítem muestra «Agregar imagen»; la publicada no muestra el hueco vacío).
 * `conImagen`: las variantes que ya llevan imagen (VARIANTES_CON_IMAGEN de ia-bloques.ts). Puro.
 */
export function conHuecoDeFoto(
  t: JsonNodo, disp: DisposicionDeSeccion | null, conImagen: ReadonlySet<string>,
): { tarjeta: JsonNodo; cambiada: boolean } {
  const pedidas = disp?.tarjetas?.conFoto ? disp.tarjetas.cantidad : 0;
  if (!pedidas) return { tarjeta: t, cambiada: false };
  // El bloque de ítems con la cantidad más parecida a la de la original (2 o más ítems).
  let mejor: JsonNodo | null = null;
  let distancia = Infinity;
  const buscar = (n: JsonNodo) => {
    const items = n.type === NODO.optimizado ? (n.content ?? []).filter((c) => c.type === NODO.optimizadoItem).length : 0;
    if (items >= 2 && Math.abs(items - pedidas) < distancia) { mejor = n; distancia = Math.abs(items - pedidas); }
    for (const c of n.content ?? []) buscar(c);
  };
  buscar(t);
  const elegido = mejor as JsonNodo | null;
  if (!elegido || conImagen.has(String(elegido.attrs?.variante ?? ''))) return { tarjeta: t, cambiada: false };
  const cambiar = (n: JsonNodo): JsonNodo => n === elegido
    ? { ...n, attrs: { ...n.attrs, variante: 'imagenes-texto', mostrarIconos: false } }
    : n.content ? { ...n, content: n.content.map(cambiar) } : n;
  return { tarjeta: cambiar(t), cambiada: true };
}

/** El ancho de la tarjeta para la columna de la original (13/11/2026): «angosto» es 48em (768 px), «normal» 64,5em (1032 px). */
export function anchoDeColumna(px: number | null | undefined): 'angosto' | 'normal' | 'amplio' | null {
  if (!px || !Number.isFinite(px)) return null;
  return px <= 840 ? 'angosto' : px <= 1180 ? 'normal' : 'amplio';
}

/**
 * La foto o el video al COSTADO del texto, como en la original (13/11/2026). Medido en producción: el hero de Clara lleva su
 * video a la derecha y «Quién es» su foto a la izquierda; la réplica los dejaba como texto solo (o con un hueco de imagen
 * abajo de todo). Si la sección de la original tiene un video, o fotos que no son de una grilla de tarjetas, y la tarjeta
 * salió sin imagen de acento, pasa a tener la imagen del lado de la original: en el editor es el hueco «Agregar imagen» con
 * su forma (37,5 % del ancho, alto de la sección); publicada sin foto, la columna no se dibuja (specTarjeta). La imagen
 * vacía que la IA haya dejado en el cuerpo se va: el hueco es el del costado. Puro.
 */
export function conLadoDeFoto(t: JsonNodo, disp: DisposicionDeSeccion | null): { tarjeta: JsonNodo; cambiada: boolean } {
  if (!disp || t.type !== NODO.tarjeta) return { tarjeta: t, cambiada: false };
  const suelta = disp.video || (disp.fotos > 0 && !disp.tarjetas?.conFoto);
  const diseno = String(t.attrs?.diseno ?? 'sin');
  if (!suelta || diseno !== 'sin') return { tarjeta: t, cambiada: false };
  const sinImagenVacia = (n: JsonNodo): JsonNodo | null => {
    if (n.type === NODO.imagen && !String(n.attrs?.src ?? '').trim()) return null;
    return n.content ? { ...n, content: n.content.map(sinImagenVacia).filter((c): c is JsonNodo => c !== null) } : n;
  };
  const limpia = sinImagenVacia(t) ?? t;
  return { tarjeta: { ...limpia, attrs: { ...limpia.attrs, diseno: disp.lado ?? 'derecha' } }, cambiada: true };
}

/**
 * Todas las tarjetas al ancho de la columna de la original. La que eligió «completo» queda a todo el ancho (es un fondo de borde
 * a borde) con su CONTENIDO en la columna (`anchoCuerpo`, 13/11/2026: el hero de Clara va en la misma columna de 760). Puro.
 */
export function conAnchoDeColumna(t: JsonNodo, ancho: ReturnType<typeof anchoDeColumna>): JsonNodo {
  if (!ancho || t.type !== NODO.tarjeta) return t;
  if (t.attrs?.ancho === 'completo') return ancho === 'amplio' ? t : { ...t, attrs: { ...t.attrs, anchoCuerpo: ancho } };
  return { ...t, attrs: { ...t.attrs, ancho } };
}

/** Lo que queda en cada testimonio de la réplica adaptada: huecos para completar, nunca la historia de un cliente de la otra. */
export const TESTIMONIO_PARA_COMPLETAR = ['[Resultado de tu cliente]', '[TESTIMONIO: lo que cuenta, con sus palabras]', '[Nombre · qué hace]'] as const;

/**
 * Los testimonios de la original, como huecos para completar en la réplica ADAPTADA (13/11/2026). Medido en producción: la
 * IA reescribió los 6 casos de las alumnas de Clara («Arrancó de cero… De 0 a 9.000 USD por mes») como si fueran clientes
 * del negocio, aunque el prompt lo prohíbe. En la sección de prueba social, cada ítem de un bloque de 2 o más queda con
 * `TESTIMONIO_PARA_COMPLETAR` (la cantidad, la grilla y el hueco de su foto quedan), y cada cita, «[Testimonio real de un
 * cliente]». El título y la bajada de la sección quedan. Puro.
 */
export function testimoniosParaCompletar(t: JsonNodo): { tarjeta: JsonNodo; items: number } {
  let items = 0;
  const parrafo = (texto: string): JsonNodo => ({ type: 'paragraph', content: [{ type: 'text', text: texto }] });
  const caminar = (n: JsonNodo): JsonNodo => {
    if (n.type === NODO.optimizado && (n.content ?? []).filter((c) => c.type === NODO.optimizadoItem).length >= 2) {
      return {
        ...n,
        content: (n.content ?? []).map((c) => {
          if (c.type !== NODO.optimizadoItem) return c;
          items++;
          const [resultado, cuenta, quien] = TESTIMONIO_PARA_COMPLETAR;
          return {
            ...c,
            attrs: { ...c.attrs, valor: '' },
            content: [{ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: resultado }] }, parrafo(cuenta), parrafo(quien)],
          };
        }),
      };
    }
    if (n.type === 'blockquote') { items++; return { ...n, content: [parrafo('[Testimonio real de un cliente]')] }; }
    return n.content ? { ...n, content: n.content.map(caminar) } : n;
  };
  return { tarjeta: caminar(t), items };
}

/** Desde cuántas partes con el botón principal la original lo REPITE (13/11/2026: la de Clara lo pone en 8). */
export const PARTES_BOTON_REPETIDO = 4;

/**
 * El botón principal después de CADA sección, cuando la original lo repite (13/11/2026). Medido en producción: la de Clara
 * cierra cada sección con su botón dorado; la réplica lo tenía en el hero y casi en ningún otro lado. Cada tarjeta sin
 * botón ni formulario termina con el primer botón de la réplica (el del hero), centrado. Puro.
 */
export function conBotonEnCadaSeccion(tarjetas: readonly JsonNodo[]): { tarjetas: JsonNodo[]; sumados: number } {
  const tiene = (n: JsonNodo, tipo: string): boolean => n.type === tipo || (n.content ?? []).some((c) => tiene(c, tipo));
  let primero: JsonNodo | null = null;
  const buscar = (n: JsonNodo) => {
    if (primero) return;
    if (n.type === NODO.botones) { const b = (n.content ?? []).find((c) => c.type === NODO.boton); if (b) { primero = b; return; } }
    for (const c of n.content ?? []) buscar(c);
  };
  for (const t of tarjetas) buscar(t);
  const boton = primero as JsonNodo | null;
  if (!boton) return { tarjetas: [...tarjetas], sumados: 0 };
  let sumados = 0;
  const out = tarjetas.map((t, i) => {
    if (i === 0 || t.type !== NODO.tarjeta || tiene(t, NODO.botones) || tiene(t, NODO.formulario)) return t;
    sumados++;
    return { ...t, content: [...(t.content ?? []), { type: NODO.botones, attrs: { alinea: 'centro' }, content: [{ ...boton, attrs: { ...boton.attrs, variante: 'primario' } }] }] };
  });
  return { tarjetas: out, sumados };
}

/**
 * Lo que una RÉPLICA no puede publicar todavía (13/11/2026, decisión del Cerebro: «el aviso de cifras tiene que frenar al
 * publicar, no sólo avisar»): los huecos que dejó la réplica adaptada en lugar de lo ajeno — [DATO], [FECHA], [HORA] y los
 * testimonios para completar. El mensaje para la persona, o null si no queda ninguno. Sólo para una landing replicada
 * (`config.origen.basadoEnUrl`): los corchetes de una plantilla son otra cosa. Una cifra que la persona escribe no se puede
 * distinguir de una inventada, así que lo que frena son los huecos, no los números. Puro.
 */
export function huecosParaPublicar(contenido: unknown, config: unknown): string | null {
  const origen = (config as { origen?: { basadoEnUrl?: unknown } } | null)?.origen;
  if (!origen || typeof origen.basadoEnUrl !== 'string' || !origen.basadoEnUrl) return null;
  const texto = JSON.stringify(contenido ?? '');
  const veces = (marca: string) => texto.split(marca).length - 1;
  const datos = veces('[DATO]');
  const fechas = veces('[FECHA]') + veces('[HORA]');
  const testimonios = veces('[TESTIMONIO:') + veces('[Testimonio real de un cliente]');
  const partes = [
    datos ? (datos === 1 ? 'una cifra [DATO]' : `${datos} cifras [DATO]`) : '',
    fechas ? (fechas === 1 ? 'una fecha u hora' : `${fechas} fechas u horas`) : '',
    testimonios ? (testimonios === 1 ? 'un testimonio' : `${testimonios} testimonios`) : '',
  ].filter(Boolean);
  if (!partes.length) return null;
  return `Antes de publicar, completa lo que la réplica dejó para ti: ${partes.join(', ')}. Pon los de tu negocio o pídele a MaKo que los cambie.`;
}

/**
 * El cierre de las secciones de una réplica, ya escritas (13/11/2026): en la ADAPTADA, ningún enlace lleva a la original ni a
 * sus destinos (su agenda, su WhatsApp: `sinEnlacesALaOriginal`), y si la original repite su botón principal (en
 * `PARTES_BOTON_REPETIDO` partes o más), cada sección cierra con el suyo (`conBotonEnCadaSeccion`). La copia LITERAL conserva
 * sus enlaces. Puro: el test lo prueba sobre el resultado, no sobre el texto de replicar.ts.
 */
export function cerrarSecciones(
  tarjetas: readonly JsonNodo[],
  o: { literal: boolean; url: string; destinos: ReadonlySet<string>; botonEnPartes: number },
): { tarjetas: JsonNodo[]; enlacesAjenos: number; botonesSumados: number } {
  let enlacesAjenos = 0;
  const sinAjenos = o.literal ? [...tarjetas] : tarjetas.map((t) => {
    const r = sinEnlacesALaOriginal(t, o.url, o.destinos);
    enlacesAjenos += r.cambiados;
    return r.tarjeta;
  });
  if (o.botonEnPartes < PARTES_BOTON_REPETIDO) return { tarjetas: sinAjenos, enlacesAjenos, botonesSumados: 0 };
  const b = conBotonEnCadaSeccion(sinAjenos);
  return { tarjetas: b.tarjetas, enlacesAjenos, botonesSumados: b.sumados };
}

/** Lo que se le pide a la IA en el hero cuando la original resalta una parte de su titular (`EstiloOriginal.tituloResalta`). */
export const NOTA_TITULO_RESALTA = 'el titular resalta su frase clave en otro color: escribe esa frase entre **';

/**
 * La frase clave del titular en el color de acento, como la original (13/11/2026: el «10K AL MES» dorado de Clara dentro de un
 * h1 negro). La IA la marca en negrita (`NOTA_TITULO_RESALTA`); acá esa negrita del PRIMER título de la sección pasa a llevar
 * además el color de acento del tema (que el lector tomó de esa parte). Sin negrita en el título, queda como está. Puro.
 */
export function conTituloResaltado(t: JsonNodo): { tarjeta: JsonNodo; cambiada: boolean } {
  let hecho = false;
  let cambiada = false;
  const marcar = (n: JsonNodo): JsonNodo => {
    if (n.type !== 'text' || !(n.marks ?? []).some((m) => m.type === 'bold')) return n;
    if ((n.marks ?? []).some((m) => m.type === 'textStyle' && m.attrs?.color)) return n;
    cambiada = true;
    return { ...n, marks: [...(n.marks ?? []).filter((m) => m.type !== 'textStyle'), { type: 'textStyle', attrs: { color: 'acento', tam: null } }] };
  };
  const caminar = (n: JsonNodo): JsonNodo => {
    if (hecho) return n;
    if (n.type === 'heading') { hecho = true; return n.content ? { ...n, content: n.content.map(marcar) } : n; }
    return n.content ? { ...n, content: n.content.map(caminar) } : n;
  };
  const tarjeta = caminar(t);
  return { tarjeta: cambiada ? tarjeta : t, cambiada };
}

/** Cuántos ítems tiene que tener una sección de la réplica: los de la original (13/11/2026, «la cantidad no la decide la IA»). */
export type ItemsEsperados = { cantidad: number; que: 'tarjetas' | 'preguntas' };

/** Las preguntas desplegables de la original, o sus tarjetas en grilla, o sus subtítulos (3 o más). null si no hay ítems. */
export function itemsEsperados(m: MoldeSeccion, disp: DisposicionDeSeccion | null): ItemsEsperados | null {
  if (m.desplegables >= 2) return { cantidad: m.desplegables, que: 'preguntas' };
  if (disp?.tarjetas) return { cantidad: disp.tarjetas.cantidad, que: 'tarjetas' };
  if (m.subtitulos >= 3) return { cantidad: m.subtitulos, que: 'tarjetas' };
  return null;
}

/** Los ítems que trajo una sección: sus desplegables, o el bloque de ítems (o de columnas) más grande. */
export function itemsDeTarjeta(t: JsonNodo, que: ItemsEsperados['que']): number {
  let preguntas = 0;
  let mayor = 0;
  const caminar = (n: JsonNodo) => {
    if (n.type === NODO.desplegable) preguntas++;
    if (n.type === NODO.optimizado) mayor = Math.max(mayor, (n.content ?? []).filter((c) => c.type === NODO.optimizadoItem).length);
    if (n.type === NODO.columnas) mayor = Math.max(mayor, (n.content ?? []).length);
    for (const c of n.content ?? []) caminar(c);
  };
  caminar(t);
  return que === 'preguntas' ? preguntas : mayor;
}

/** La nota firme de la segunda pasada: la cantidad exacta y lo que trajo la vuelta anterior. */
export function notaDeCantidad(e: ItemsEsperados, vino: number): string {
  const que = e.que === 'preguntas' ? 'preguntas desplegables' : 'ítems (tarjetas o pasos) en un solo bloque';
  const dif = vino < e.cantidad ? `faltaron ${e.cantidad - vino}` : `sobraron ${vino - e.cantidad}`;
  return `CANTIDAD EXACTA: ${e.cantidad} ${que}, ni uno más ni uno menos (la vuelta anterior trajo ${vino}: ${dif}).`;
}

/**
 * El texto de la réplica de «tú» (13/11/2026, Cerebro: «Lo que pasa cuando sabés exactamente qué vende» en la de Clara). La IA
 * copia el voseo de una original rioplatense; el texto que escribe el Web Generator va de «tú», como Copywriting y el chat de
 * MaKo (`alTuteo`), salvo que el negocio haya DECLARADO una voz que vosea (eso lo decide quien llama). Todo el texto lo escribió
 * MaKo, también lo que va entre «…». Puro.
 */
export function alTuteoEnTarjeta(t: JsonNodo): JsonNodo {
  const caminar = (n: JsonNodo): JsonNodo => {
    if (n.type === 'text' && typeof (n as { text?: unknown }).text === 'string') {
      const text = alTuteo((n as { text: string }).text, { citas: true });
      return text === (n as { text: string }).text ? n : ({ ...n, text } as JsonNodo);
    }
    return n.content ? { ...n, content: n.content.map(caminar) } : n;
  };
  return caminar(t);
}

/**
 * El fondo de la sección como el de su parte de la original, cuando no es el de la página (13/11/2026: Clara alterna crema
 * #faf7ee en «Quién es», las preguntas y el cierre sobre una página blanca; la réplica iba toda en blanco). La tarjeta que la IA
 * dejó con el fondo del tema pasa a ese color, como FRANJA: a todo el ancho y con el contenido en la columna que tenía
 * (`anchoCuerpo`). La que ya trae un fondo propio queda. Puro.
 */
export function conFondoDeLaOriginal(t: JsonNodo, fondo: string | null | undefined, fondoPagina: string | null | undefined): { tarjeta: JsonNodo; cambiada: boolean } {
  const hex = (c: string | null | undefined) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim().toLowerCase() : null);
  const f = hex(fondo);
  if (!f || t.type !== NODO.tarjeta || f === hex(fondoPagina) || (t.attrs?.fondo && t.attrs.fondo !== 'tema')) return { tarjeta: t, cambiada: false };
  const columna = t.attrs?.ancho === 'completo' ? (t.attrs?.anchoCuerpo ?? null) : t.attrs?.ancho === 'angosto' || t.attrs?.ancho === 'normal' ? t.attrs.ancho : null;
  return { tarjeta: { ...t, attrs: { ...t.attrs, fondo: 'color', fondoColor: f, ancho: 'completo', anchoCuerpo: columna } }, cambiada: true };
}
