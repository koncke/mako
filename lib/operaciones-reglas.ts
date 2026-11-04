// =============================================================================
// El Centro de Operaciones — las reglas puras (sin server-only, a propósito: las importan la
// pantalla, el servidor y los tests)
// =============================================================================
// Pedido de Martín (15/10/2026): «continua y termina el centro de operaciones». El diseño, en
// docs/diseno-centro-de-operaciones.md; lo que costó, en docs/hallazgos-operaciones.md.
//
// ⚠️ LA VERDAD DE UN PEDIDO ES EL TEXTO FIRMADO. El navegador de Martín arma el JSON con
// `armarFirmable`, lo firma con una clave que no se puede exportar y que el servidor no tiene, y
// el cartero de la PC verifica la firma y entrega lo que dice ESE texto. El servidor lo guarda tal
// cual y no lo vuelve a armar: si lo reconstruyera, la firma dejaría de cubrir lo que se entrega.
// Por eso acá no hay una «canonicalización» que tenga que coincidir entre dos lugares: el cartero
// sólo PARSEA el texto que verificó (scripts/operaciones/cartero.mjs, y un test diferencial
// prueba que los dos lados leen lo mismo).
// =============================================================================

import { ACCEPT_ADJUNTOS_CHAT, TOPE_ADJUNTOS, TOPE_TOTAL_BYTES, tipoPorFirma } from './mako-adjuntos';

export const VERSION_PEDIDO = 1 as const;
/** Tope del texto de un pedido. Se RECHAZA, no se recorta (AGENTS.md: un tope en un texto que
 *  escribe una persona rechaza). */
export const MAX_TEXTO = 8000;
/**
 * Los mensajes largos de Martín (18/10/2026: «debería poder enviar mensajes mucho más largos»; el de su feedback tenía
 * ~12.000). El servidor los acepta hasta este tope; la caja los ofrece sólo a un Runner que también los acepta
 * (`aceptaTextoLargo`): uno de antes rechazaría el trabajo entero, y saldría «No se pudo».
 */
export const MAX_TEXTO_LARGO = 40_000;
export const VERSION_TEXTO_LARGO = '1.15.8';
export const aceptaTextoLargo = (version: string | null | undefined): boolean => versionAlMenos(version, VERSION_TEXTO_LARGO);
/** Un pedido firmado vale dos semanas: alcanza para que vuelva una cuenta inactiva. */
export const VENCE_DIAS = 14;
/** Más que esto sin noticias del cartero y la pantalla deja de decir «vivo» y le dice a Martín desde cuándo no hay noticias.
 *  ⚠️ Este número depende de cada cuánto da noticias el cartero, que vive en la PC: con vueltas cada 10 minutos, la PC prendida
 *  salía «no responde» (31/10/2026). Por eso la pantalla sólo dice desde cuándo no hay noticias. Hoy `vigilar` corre en fila y da
 *  noticias cada menos de 2 minutos; el que cambie eso mira este número. Ver docs/hallazgos-operaciones.md. */
export const CARTERO_VIVO_MS = 4 * 60 * 1000;
/** Un trabajo `tomado` sin acuse por más que esto se da por «no sé si llegó» (y sus adjuntos se borran). Es mucho más que
 *  los 30 minutos con que la PC vence su buzón: el acuse de la PC llega antes, salvo que se haya perdido (un Runner que
 *  se cortó bajando un adjunto, un acuse cuyo UPDATE falló). Sin esto, quedaba `tomado` para siempre. */
export const TOMADO_VENCE_MS = 2 * 3600 * 1000;

/** Cuántos pedidos reclama el cartero por vuelta. */
export const POR_VUELTA = 10;

export const ESTADOS = ['escrito', 'tomado', 'entregado', 'no_entregado', 'incierto', 'hecho', 'comprobado', 'cancelado'] as const;
export type EstadoPedido = (typeof ESTADOS)[number];

/** Los rótulos de la pantalla: una o dos palabras. escrito ≠ entregado ≠ hecho ≠ comprobado. */
export const ROTULO: Record<EstadoPedido, string> = {
  escrito: 'Escrito',
  tomado: 'Entregando',
  entregado: 'Entregado',
  no_entregado: 'No se pudo',
  incierto: 'No sé si llegó',
  hecho: 'Hecho',
  comprobado: 'Comprobado',
  cancelado: 'Cancelado',
};

export const ALCANCES = ['solo_esto', 'de_ahora_en_mas'] as const;
export type Alcance = (typeof ALCANCES)[number];

/**
 * El modelo y el esfuerzo con los que Martín quiere que corra el chat (17/10/2026: «que los jefes y el cerebro tengan la
 * capacidad de ahorrar tokens... eligiendo qué modelo de IA debe correr»). Van ADENTRO de la firma, OPCIONALES: sin
 * ellos el texto firmado es idéntico al de siempre, y un cartero de antes los ignora. Los aplica el Runner (lib/runner.ts)
 * y sólo en un chat de la app (lib/centro-cuentas.ts → aceptaModelo). El cartero los valida igual (test diferencial).
 */
export const MODELOS = ['opus', 'sonnet', 'haiku'] as const;
export type Modelo = (typeof MODELOS)[number];
export const ESFUERZOS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Esfuerzo = (typeof ESFUERZOS)[number];

export type PayloadPedido = {
  v: typeof VERSION_PEDIDO;
  /** uuid que pone el navegador; va adentro de la firma. */
  id: string;
  texto: string;
  /** El id del chat: `local_…` para uno de la app de escritorio, `cli_…` para una sesión de
   *  terminal. Nunca el nombre: se repiten entre cuentas y dentro de una. */
  destino: string;
  /** claude1 … claude5, o null si el cartero no lo sabe. Informativo. */
  cuenta: string | null;
  /** El título del chat al firmar. Informativo: el cartero entrega por `destino`. */
  titulo: string | null;
  alcance: Alcance;
  creado: string;
  vence: string;
  /** null o ausente = «Automático»: no se toca el modelo del chat. */
  modelo?: Modelo | null;
  esfuerzo?: Esfuerzo | null;
  /** Las fotos y los PDF que van con el trabajo (17/10/2026). Ausente = sin adjuntos: el texto firmado es el de siempre. */
  adjuntos?: AdjuntoPedido[];
  /** Lo mandó como NOTA DE VOZ (26/10/2026): `texto` es su transcripción. Ausente = escrito («Las notas de voz enviadas»). */
  voz?: VozDelPedido;
};

// ── Los adjuntos de un trabajo (17/10/2026) ──────────────────────────────────────────────────────────────────────────
// Martín: adjuntar imágenes y archivos en la caja, y pegar una captura con Ctrl+V, y que lleguen al chat. Dio el OK de que
// un archivo baje a la PC, con estas condiciones, que no se negocian:
//   · baja SÓLO lo que nombra un trabajo FIRMADO: el `sha256` de cada archivo lo calcula el navegador sobre los bytes que
//     sube y va adentro de la firma; la PC lo compara con lo que baja. Con MaKo comprometida, lo peor es que no baje;
//   · a una carpeta fija por trabajo (`~/.claude/operaciones/adjuntos/<id>/`), con un nombre que arma la PC;
//   · con el tipo y el tamaño validados (por los primeros bytes, no por la extensión), y nunca un ejecutable: sólo las
//     fotos y el PDF que ya acepta el chat con MaKo (lib/mako-adjuntos.ts), con los mismos topes;
//   · el chat recibe la RUTA local en el mensaje (scripts/operaciones/cartero.mjs → bajarAdjuntos).
export const MIMES_ADJUNTO = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
  // 18/10/2026 (cartero 1.16.0; el Cerebro, por el «una img o un doc» de Martín): Word, Excel y PowerPoint, y texto.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/markdown', 'text/csv',
] as const;
/** Los de texto no tienen firma: se aceptan si son texto de verdad (`esTextoSeguro`), y su tipo lo da el nombre. */
export const MIMES_TEXTO: readonly string[] = ['text/plain', 'text/markdown', 'text/csv'];
/** Lo que ofrece el «Adjuntar archivo» de la caja (con un Runner 1.16.0). */
export const ACCEPT_ADJUNTOS_CENTRO = `${ACCEPT_ADJUNTOS_CHAT},.docx,.xlsx,.pptx,.txt,.md,.csv`;
const OFFICE: ReadonlyArray<readonly [string, string]> = [
  ['word/document.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['xl/workbook.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['ppt/presentation.xml', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
];
const latin1 = (b: Uint8Array) => Array.from(b, (x) => String.fromCharCode(x)).join('');

/**
 * Un Word, un Excel o un PowerPoint por su ESTRUCTURA (18/10/2026): un zip («PK\x03\x04») con `[Content_Types].xml` y la
 * parte principal de UNO de los tres, mirado en el directorio del zip (al final). Los que traen macros (docm, xlsm, pptm:
 * `vbaProject.bin`) no entran. La MISMA regla que el cartero (test diferencial).
 */
export function oficinaPorZip(b: Uint8Array): string | null {
  if (!(b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04)) return null;
  const cola = latin1(b.subarray(Math.max(0, b.length - 2 * 1024 * 1024)));
  if (!cola.includes('[Content_Types].xml') || cola.includes('vbaProject.bin')) return null;
  const tipos = OFFICE.filter(([parte]) => cola.includes(parte)).map(([, mime]) => mime);
  return tipos.length === 1 ? tipos[0] : null;
}

/** El tipo de un archivo por sus BYTES: las fotos y el PDF (lib/mako-adjuntos.ts) y los de Office. null = ninguno. */
export const mimePorFirmaCentro = (b: Uint8Array): string | null => tipoPorFirma(b)?.mime ?? oficinaPorZip(b);

/**
 * ¿Es TEXTO de verdad? UTF-8 válido y sin bytes nulos (un binario los tiene), y NUNCA una página ni un script: ni HTML, ni
 * SVG, ni PHP, ni un «#!» al principio, ni un `<script` adentro. Un texto se guarda con la extensión de su tipo (.txt, .md,
 * .csv): no se ejecuta.
 */
export function esTextoSeguro(b: Uint8Array): boolean {
  if (!b.length || b.includes(0)) return false;
  let t: string;
  try { t = new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { return false; }
  const inicio = t.replace(/^\uFEFF/, '').trimStart().slice(0, 200).toLowerCase();
  if (inicio.startsWith('#!') || /^<(!doctype|html|head|body|script|svg|\?php|\?xml)/.test(inicio)) return false;
  return !/<script[\s>]/i.test(t);
}

/** ¿Los bytes son de ese tipo? Lo usa la PC antes de guardar, y el navegador antes de subir. */
export const tipoAceptado = (b: Uint8Array, mime: string): boolean =>
  MIMES_TEXTO.includes(mime) ? esTextoSeguro(b) : mimePorFirmaCentro(b) === mime;

/** El tipo de un texto, por su nombre (no tiene firma). */
export function mimeTextoPorNombre(nombre: string): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(nombre)?.[1]?.toLowerCase();
  return ext === 'txt' ? 'text/plain' : ext === 'md' || ext === 'markdown' ? 'text/markdown' : ext === 'csv' ? 'text/csv' : null;
}

/** El tipo con el que se firma un archivo: por sus bytes; un texto, por su nombre si de verdad es texto. */
export const mimeDeArchivoCentro = (b: Uint8Array, nombre: string): string | null =>
  mimePorFirmaCentro(b) ?? (mimeTextoPorNombre(nombre) && esTextoSeguro(b) ? mimeTextoPorNombre(nombre) : null);

/** ¿La caja lo toma? Fotos y PDF siempre; Office y texto, sólo con un Runner 1.16.0. 'image' se ve como foto; lo demás, chip. */
export function tipoDeElegidoCentro(f: { name: string; type: string }, grandes: boolean): 'image' | 'document' | null {
  if (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name)) return 'image';
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'document';
  if (grandes && /\.(docx|xlsx|pptx|txt|md|markdown|csv)$/i.test(f.name)) return 'document';
  return null;
}
export type MimeAdjunto = (typeof MIMES_ADJUNTO)[number];
/**
 * Cuántos archivos y cuánto cada uno (18/10/2026, Martín: «hay limitación de hasta 4mb de archivos, quita esa limitación»
 * y «dice "Máximo 4 archivos" elimina esa restricción»). Medido ese día: el bucket `archivero` no tiene tope propio y el
 * proyecto acepta al menos 2 GB por archivo (el bucket `curso-videos` tiene 2 GB); el corte de 4 MB era Vercel, que no
 * deja pasar más de ~4,5 MB por una ruta. Desde el cartero 1.16.0 el archivo NO pasa por Vercel: el navegador lo sube
 * directo al storage y la PC lo baja de ahí, los dos con una URL firmada. El tope que queda es el de la memoria: el
 * navegador (también el teléfono) y la PC lo tienen entero para calcular su sha256.
 */
export const MAX_ADJUNTOS = 20;
export const MAX_BYTES_ADJUNTO = 100 * 1024 * 1024;
/** Con un Runner de antes de la 1.16.0, los de antes: los del chat con MaKo, porque el archivo pasa por Vercel. */
export const MAX_ADJUNTOS_CHICOS = TOPE_ADJUNTOS;
export const MAX_BYTES_ADJUNTOS_CHICOS = TOPE_TOTAL_BYTES;
export const VERSION_ADJUNTOS_GRANDES = '1.16.0';
export const MAX_NOMBRE_ADJUNTO = 120;
/** `ref`: dónde lo guardó MaKo (un uuid); `bytes` y `sha256`: los del archivo que salió del navegador. */
export type AdjuntoPedido = { ref: string; nombre: string; mime: MimeAdjunto; bytes: number; sha256: string };

/** null si los adjuntos de un texto firmado valen; si no, el motivo. La MISMA regla que el cartero (test diferencial). */
export function problemaDeAdjuntos(x: unknown): string | null {
  if (!Array.isArray(x) || !x.length || x.length > MAX_ADJUNTOS) return 'adjuntos inválidos';
  const refs = new Set<string>();
  let total = 0;
  for (const a of x) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return 'adjuntos inválidos';
    const o = a as Record<string, unknown>;
    if (typeof o.ref !== 'string' || !UUID_RE.test(o.ref) || refs.has(o.ref)) return 'adjuntos inválidos';
    refs.add(o.ref);
    if (typeof o.nombre !== 'string' || !o.nombre.trim() || o.nombre.length > MAX_NOMBRE_ADJUNTO || /[\u0000-\u001f]/.test(o.nombre)) return 'adjuntos inválidos';
    if (!(MIMES_ADJUNTO as readonly unknown[]).includes(o.mime)) return 'adjuntos inválidos';
    if (typeof o.bytes !== 'number' || !Number.isInteger(o.bytes) || o.bytes < 1 || o.bytes > MAX_BYTES_ADJUNTO) return 'adjuntos inválidos';
    if (typeof o.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(o.sha256)) return 'adjuntos inválidos';
    total += o.bytes;
  }
  return total > MAX_ADJUNTOS * MAX_BYTES_ADJUNTO ? 'adjuntos inválidos' : null;
}

/** El cartero que baja adjuntos. Con uno de antes, el trabajo saldría SIN sus archivos y nadie lo diría: la caja no ofrece
 *  adjuntar hasta que el Runner de esa cuenta suba esta versión (o una más nueva). */
export const VERSION_ADJUNTOS = '1.9.1';
export const aceptaAdjuntos = (version: string | null | undefined): boolean => versionAlMenos(version, VERSION_ADJUNTOS);
/** El cartero que baja por URL firmada: con él, la caja ofrece los topes grandes (`MAX_ADJUNTOS`, `MAX_BYTES_ADJUNTO`). */
export const aceptaAdjuntosGrandes = (version: string | null | undefined): boolean => versionAlMenos(version, VERSION_ADJUNTOS_GRANDES);

/** Lo que la caja le dice a Martín si lo elegido no entra (null = entra). `grandes`: el Runner tiene la 1.16.0. */
export function problemaDeAdjuntosCaja(bytes: readonly number[], grandes: boolean): string | null {
  if (!grandes) {
    if (bytes.length > MAX_ADJUNTOS_CHICOS) return `Máximo ${MAX_ADJUNTOS_CHICOS} archivos con este Runner.`;
    return bytes.reduce((n, b) => n + b, 0) > MAX_BYTES_ADJUNTOS_CHICOS ? 'Hasta 4 MB con este Runner.' : null;
  }
  if (bytes.length > MAX_ADJUNTOS) return `Máximo ${MAX_ADJUNTOS} archivos.`;
  return bytes.some((b) => b > MAX_BYTES_ADJUNTO) ? `Hasta ${MAX_BYTES_ADJUNTO / 1024 / 1024} MB cada uno.` : null;
}

/** ¿La versión de un cartero es ésta o una más nueva? Por número: «1.10.0» es mayor que «1.9.1». Sin versión, no. */
export function versionAlMenos(version: string | null | undefined, minima: string): boolean {
  const v = /^(\d+)\.(\d+)\.(\d+)/.exec(version ?? '');
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(minima);
  if (!v || !m) return false;
  for (let i = 1; i <= 3; i++) if (Number(v[i]) !== Number(m[i])) return Number(v[i]) > Number(m[i]);
  return true;
}

/** Los nombres de los adjuntos de un texto firmado, para dibujarlos en la conversación (vacío si no tiene). */
export function nombresDeAdjuntos(firmado: string | null | undefined): string[] {
  try {
    const o = JSON.parse(firmado ?? '') as { adjuntos?: unknown };
    if (!Array.isArray(o.adjuntos)) return [];
    return o.adjuntos.map((a) => (a as { nombre?: unknown })?.nombre).filter((n): n is string => typeof n === 'string' && !!n.trim()).slice(0, MAX_ADJUNTOS).map((n) => n.slice(0, MAX_NOMBRE_ADJUNTO));
  } catch {
    return [];
  }
}

// ── Las fotos enviadas, vistas desde cualquier dispositivo (23/10/2026) ────────────────────────────────────────────────
// Hasta acá una foto mandada por la caja se veía SÓLO en el navegador que la mandó (su miniatura en IndexedDB): en el
// teléfono salía su nombre. Martín, 18/10: «cuando envío imágenes por aquí o adjunto cosas también deberían aparecer en el
// Center», y con eso quedó decidido que las fotos del Ops Center SÍ quedan del lado del servidor: bucket privado, URL
// firmada, y sólo para quien puede operar. El ORIGINAL se sigue borrando al entregar (lo que protege el canal a la PC,
// lib/operaciones-adjuntos.ts); lo que queda es la MINIATURA de 640 px que arma el navegador que la mandó, atada a la foto
// por su `ref` (el uuid del original, adentro del texto firmado).
/** Lo que pesa como mucho una miniatura. Medido: la de 640 px en JPEG al 0,78 pesa de 40 a 150 KB. */
export const MAX_BYTES_MINIATURA = 400 * 1024;
const MIMES_MINIATURA: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
/** Cuánto queda una miniatura en el servidor. La conversación dibuja los últimos 100 trabajos (lib/operaciones.ts →
 *  `listarPedidos`), que son días: pasado esto, no hay burbuja que la pida. */
export const MINIATURA_VENCE_MS = 14 * 24 * 60 * 60 * 1000;
export type FotoDeTrabajo = { ref: string; nombre: string };

/**
 * Las FOTOS de un texto firmado (no los PDF ni los documentos), en su orden y con su `ref`. El nombre se recorta igual que
 * en `nombresDeAdjuntos`: la burbuja separa lo que es foto de lo que es documento comparando nombres. Vacío si no tiene.
 */
export function fotosDeFirmado(firmado: string | null | undefined): FotoDeTrabajo[] {
  try {
    const o = JSON.parse(firmado ?? '') as { adjuntos?: unknown };
    if (!Array.isArray(o.adjuntos)) return [];
    const fotos: FotoDeTrabajo[] = [];
    for (const a of o.adjuntos.slice(0, MAX_ADJUNTOS)) {
      const x = (a ?? {}) as { ref?: unknown; nombre?: unknown; mime?: unknown };
      if (typeof x.ref !== 'string' || !UUID_RE.test(x.ref) || typeof x.mime !== 'string' || !MIMES_MINIATURA.includes(x.mime)) continue;
      if (typeof x.nombre !== 'string' || !x.nombre.trim()) continue;
      fotos.push({ ref: x.ref, nombre: x.nombre.slice(0, MAX_NOMBRE_ADJUNTO) });
    }
    return fotos;
  } catch {
    return [];
  }
}

/** El tipo de una miniatura por sus BYTES (una foto, nunca otra cosa). null = no es una foto. */
export function mimeDeMiniatura(b: Uint8Array): string | null {
  const m = tipoPorFirma(b)?.mime;
  return m && MIMES_MINIATURA.includes(m) ? m : null;
}

/** null si la miniatura vale para ESA foto de ESE trabajo; si no, el motivo (lo que contesta la ruta). */
export function problemaDeMiniatura(bytes: Uint8Array, fotos: readonly FotoDeTrabajo[], ref: string): string | null {
  if (!UUID_RE.test(ref) || !fotos.some((f) => f.ref === ref)) return 'Esa foto no es de este mensaje.';
  if (!bytes.length || bytes.length > MAX_BYTES_MINIATURA) return 'La miniatura pesa demasiado.';
  return mimeDeMiniatura(bytes) ? null : 'Solo una foto.';
}

/** De lo que lista el storage, las miniaturas que ya vencieron (su nombre). Sin fecha legible, no se toca. */
export function miniaturasVencidas(objetos: ReadonlyArray<{ name?: string | null; created_at?: string | null }>, ahora: number): string[] {
  return objetos.flatMap((o) => {
    const t = o.created_at ? Date.parse(o.created_at) : NaN;
    return o.name && UUID_RE.test(o.name) && Number.isFinite(t) && ahora - t > MINIATURA_VENCE_MS ? [o.name] : [];
  });
}

// ── Las notas de voz enviadas (26/10/2026) ───────────────────────────────────────────────────────────────────────────
// Martín, desde el Centro, con captura de su nota de voz dibujada como texto: «Y esto fue un audio, se deberia mandar el
// audio directamente... Y de ultima en los 3 puntitos ver la transcripción». Lo que se graba en la caja se sigue
// TRANSCRIBIENDO y el chat recibe ese texto, como siempre (app/_chat/nota-que-se-manda.ts). Lo nuevo:
//   · el trabajo FIRMA que fue una nota (`voz: { segundos }`). Los dos validadores (este y el del cartero) dejan pasar una
//     clave que no conocen, así que la PC lo entrega igual y no hace nada con él: no hace falta un cartero nuevo;
//   · el navegador que la grabó sube el MP3, y queda del lado del servidor como la miniatura de una foto: bucket privado,
//     URL firmada de 10 minutos, sólo para quien puede operar, 14 días (lib/operaciones-adjuntos.ts → «Las notas de voz»);
//   · la burbuja dibuja el reproductor de la casa (AudioPlay) y la transcripción va en el menú del mensaje.
// ⚠️ EL AUDIO NUNCA VA A LA PC: no es un adjunto (no está en `adjuntos`), y el cartero sólo baja lo que nombra `adjuntos`.
export type VozDelPedido = { segundos: number };
/** Lo que dura como mucho una nota (lo mismo que se transcribe sin cortar no pasa de unos minutos). */
export const MAX_SEGUNDOS_VOZ = 60 * 60;
/** Lo que pesa como mucho el MP3 de una nota: lo que entra en un POST a Vercel (~4,5 MB). A 96 kbps son ~5 minutos. */
export const MAX_BYTES_VOZ = 4 * 1024 * 1024;
/** Los segundos de una nota, enteros y en su rango (null = no vale). */
export function segundosDeVoz(x: unknown): number | null {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  const s = Math.round(x);
  return s >= 1 && s <= MAX_SEGUNDOS_VOZ ? s : null;
}
/** La nota de voz de un texto firmado (null = no lo fue, o no se lee). */
export function vozDeFirmado(firmado: string | null | undefined): VozDelPedido | null {
  try {
    const o = JSON.parse(firmado ?? '') as { voz?: { segundos?: unknown } | null };
    const segundos = o?.voz && typeof o.voz === 'object' ? segundosDeVoz(o.voz.segundos) : null;
    return segundos ? { segundos } : null;
  } catch {
    return null;
  }
}
/** ¿Es un MP3? Por los BYTES: la etiqueta ID3, o un cuadro MPEG (la sincronía de 11 bits). Lo que arma la caja es un MP3. */
export function esMp3(b: Uint8Array): boolean {
  if (b.length < 4) return false;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true;
  return b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0;
}
/** null si el audio vale para ESE trabajo (que FIRMÓ ser una nota); si no, el motivo (lo que contesta la ruta). */
export function problemaDeVoz(bytes: Uint8Array, voz: VozDelPedido | null): string | null {
  if (!voz) return 'Ese mensaje no es una nota de voz.';
  if (!bytes.length || bytes.length > MAX_BYTES_VOZ) return 'La nota pesa demasiado.';
  return esMp3(bytes) ? null : 'Solo una nota de voz.';
}

// ── Abrir un chat de terminal con un clic (17/10/2026, docs/diseno-nuevo-chat-un-clic.md) ──────────────────────────────
// Martín: «un clic + el permiso de la PC», nunca pegar un comando en PowerShell. Es un trabajo firmado como cualquiera,
// con `destino: 'nuevo'`: la `cuenta` dice en qué terminal, el `titulo` es el nombre del chat y el `texto` su primer
// mensaje. La PC lo abre sólo con el permiso local prendido (cartero.mjs → `abrir-permitir`).
// ⚠️ EL NOMBRE VA POR UNA LISTA BLANCA, no por «todo menos esto» (lo pidió la revisión de seguridad del Cerebro): con
//    él se arma el comando que abre la ventana. Letras (con tildes y ñ), números, espacios y `› > - _ . , ( ) + :`,
//    empezando con letra o número (nunca parece una opción). Sin comillas de ningún tipo: la función del perfil hace
//    `claude @args`, y Windows PowerShell 5.1 parte en varios argumentos un texto con `"` al pasarlo a claude.exe. Por lo
//    mismo el primer mensaje NO va como argumento: la PC lo escribe en un archivo y el chat arranca leyéndolo.
export const DESTINO_NUEVO = 'nuevo';
export const MAX_NOMBRE_NUEVO = 80;
export const NOMBRE_NUEVO_RE = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} ›>\-_.,()+:]*$/u;
/** null si el nombre de un chat nuevo vale; si no, el motivo. La MISMA regla que el cartero (test diferencial). */
export function problemaDeNombreNuevo(x: unknown): string | null {
  if (typeof x !== 'string' || x.length > MAX_NOMBRE_NUEVO || !NOMBRE_NUEVO_RE.test(x) || x !== x.trim()) return 'nombre inválido';
  return null;
}
/** Las cuentas en las que la PC dice que puede abrir un chat (cartero 1.11.0: una terminal y el permiso prendido). */
export function sanearAbre(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return [...new Set(x.filter((c): c is string => typeof c === 'string' && CUENTA_RE.test(c)))].slice(0, 10);
}
/** El cartero que abre chats (`abrir`): con uno de antes, el trabajo quedaría escrito para siempre. */
export const VERSION_ABRIR = '1.11.1';
export const aceptaAbrir = (version: string | null | undefined): boolean => versionAlMenos(version, VERSION_ABRIR);
/** El cartero que baja los adjuntos de un chat NUEVO y los nombra en su primer mensaje (28/10/2026). Uno de antes rechaza el
 *  trabajo («un chat nuevo no lleva adjuntos»): la caja del chat nuevo los ofrece sólo con éste. */
export const VERSION_ADJUNTOS_EN_NUEVO = '1.22.0';
export const aceptaAdjuntosEnNuevo = (version: string | null | undefined): boolean => versionAlMenos(version, VERSION_ADJUNTOS_EN_NUEVO);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const DESTINO_RE = /^(local|cli)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const CUENTA_RE = /^claude\d{1,2}$/;
/** El id de un chat de la NUBE (17/10/2026): lo que no es de esta PC (`local_…`/`cli_…`). Lo anota el Runner de la app con
 *  lo que le da list_sessions (cartero.mjs → `nube`). Sólo se ve: no tiene canal para entregarle. */
export const NUBE_RE = /^(?!local_|cli_)[A-Za-z][A-Za-z0-9_-]{5,100}$/;

/** El texto que se firma. El orden de las claves es fijo, pero nadie tiene que reproducirlo:
 *  se guarda y se verifica este mismo string. */
export function armarFirmable(p: PayloadPedido): string {
  return JSON.stringify({
    v: p.v, id: p.id, texto: p.texto, destino: p.destino, cuenta: p.cuenta,
    titulo: p.titulo, alcance: p.alcance, creado: p.creado, vence: p.vence,
    // Sólo si se eligieron: sin ellos, el texto firmado es el de siempre.
    ...(p.modelo ? { modelo: p.modelo } : {}),
    ...(p.esfuerzo ? { esfuerzo: p.esfuerzo } : {}),
    // Los adjuntos, sólo si hay: sin ellos, el texto firmado es el de siempre.
    ...(p.adjuntos?.length ? { adjuntos: p.adjuntos.map((a) => ({ ref: a.ref, nombre: a.nombre, mime: a.mime, bytes: a.bytes, sha256: a.sha256 })) } : {}),
    // La nota de voz, sólo si lo fue: sin ella, el texto firmado es el de siempre.
    ...(p.voz ? { voz: { segundos: p.voz.segundos } } : {}),
  });
}

export function nuevoPayload(entrada: {
  id: string; texto: string; destino: string; cuenta: string | null; titulo: string | null; alcance: Alcance;
  modelo?: Modelo | null; esfuerzo?: Esfuerzo | null; adjuntos?: readonly AdjuntoPedido[]; voz?: VozDelPedido | null;
}, ahora: number): PayloadPedido {
  const segundos = entrada.voz ? segundosDeVoz(entrada.voz.segundos) : null;
  return {
    v: VERSION_PEDIDO,
    id: entrada.id,
    texto: entrada.texto.trim(),
    destino: entrada.destino,
    cuenta: entrada.cuenta,
    titulo: entrada.titulo,
    alcance: entrada.alcance,
    creado: new Date(ahora).toISOString(),
    vence: new Date(ahora + VENCE_DIAS * 86_400_000).toISOString(),
    modelo: entrada.modelo ?? null,
    esfuerzo: entrada.esfuerzo ?? null,
    ...(entrada.adjuntos?.length ? { adjuntos: [...entrada.adjuntos] } : {}),
    ...(segundos ? { voz: { segundos } } : {}),
  };
}

export type Lectura = { ok: true; p: PayloadPedido } | { ok: false; motivo: string };

/** Lee y valida un texto firmado. La usan el servidor (al encolar) y los tests; el cartero tiene
 *  la suya, en JS plano, y el test diferencial las compara. */
export function leerFirmable(texto: string, ahora: number): Lectura {
  let x: unknown;
  try { x = JSON.parse(texto); } catch { return { ok: false, motivo: 'no es JSON' }; }
  if (!x || typeof x !== 'object' || Array.isArray(x)) return { ok: false, motivo: 'no es un objeto' };
  const o = x as Record<string, unknown>;
  if (o.v !== VERSION_PEDIDO) return { ok: false, motivo: 'versión desconocida' };
  if (typeof o.id !== 'string' || !UUID_RE.test(o.id)) return { ok: false, motivo: 'id inválido' };
  if (typeof o.texto !== 'string' || !o.texto.trim()) return { ok: false, motivo: 'sin texto' };
  if (o.texto.length > MAX_TEXTO_LARGO) return { ok: false, motivo: `el texto pasa de ${MAX_TEXTO_LARGO} caracteres` };
  const nuevo = o.destino === DESTINO_NUEVO;
  if (!nuevo && (typeof o.destino !== 'string' || !DESTINO_RE.test(o.destino))) return { ok: false, motivo: 'destino inválido' };
  if (o.cuenta !== null && (typeof o.cuenta !== 'string' || !CUENTA_RE.test(o.cuenta))) return { ok: false, motivo: 'cuenta inválida' };
  if (o.titulo !== null && typeof o.titulo !== 'string') return { ok: false, motivo: 'título inválido' };
  // Un chat nuevo dice en qué cuenta y con qué nombre. Desde el cartero 1.22.0 (28/10/2026) también lleva adjuntos: los baja
  // la PC antes de abrirlo (VERSION_ADJUNTOS_EN_NUEVO).
  if (nuevo && o.cuenta === null) return { ok: false, motivo: 'falta la cuenta' };
  if (nuevo) { const m = problemaDeNombreNuevo(o.titulo); if (m) return { ok: false, motivo: m }; }
  if (!(ALCANCES as readonly unknown[]).includes(o.alcance)) return { ok: false, motivo: 'alcance inválido' };
  if (o.modelo != null && !(MODELOS as readonly unknown[]).includes(o.modelo)) return { ok: false, motivo: 'modelo inválido' };
  if (o.esfuerzo != null && !(ESFUERZOS as readonly unknown[]).includes(o.esfuerzo)) return { ok: false, motivo: 'esfuerzo inválido' };
  if (o.adjuntos !== undefined) { const m = problemaDeAdjuntos(o.adjuntos); if (m) return { ok: false, motivo: m }; }
  const creado = typeof o.creado === 'string' ? Date.parse(o.creado) : NaN;
  const vence = typeof o.vence === 'string' ? Date.parse(o.vence) : NaN;
  if (!Number.isFinite(creado) || !Number.isFinite(vence)) return { ok: false, motivo: 'fechas inválidas' };
  if (vence <= creado || vence - creado > (VENCE_DIAS + 1) * 86_400_000) return { ok: false, motivo: 'vencimiento inválido' };
  // Un minuto de margen por relojes corridos entre el teléfono y el servidor.
  if (creado > ahora + 60_000) return { ok: false, motivo: 'fecha en el futuro' };
  if (vence <= ahora) return { ok: false, motivo: 'venció' };
  return {
    ok: true,
    p: {
      // `destino` ya se validó arriba (una sesión, o `nuevo`); el chequeo por `nuevo` no lo estrecha para TypeScript.
      v: VERSION_PEDIDO, id: o.id, texto: o.texto, destino: o.destino as string,
      cuenta: (o.cuenta as string | null) ?? null, titulo: (o.titulo as string | null) ?? null,
      alcance: o.alcance as Alcance, creado: o.creado as string, vence: o.vence as string,
      modelo: (o.modelo as Modelo | null | undefined) ?? null, esfuerzo: (o.esfuerzo as Esfuerzo | null | undefined) ?? null,
      ...(o.adjuntos !== undefined ? { adjuntos: o.adjuntos as AdjuntoPedido[] } : {}),
    },
  };
}

/** El id corto de una clave pública: los primeros 16 hex del SHA-256 de su SPKI. */
export const claveIdDe = (sha256Hex: string): string => sha256Hex.slice(0, 16).toLowerCase();

// ── La guarda de plataforma ─────────────────────────────────────────────────────────────────
// ⚠️ `getSesionAdmin()` contesta «¿es admin global?», y eso no alcanza para una puerta a la PC de
// Martín. Se pide además, EN POSITIVO: que la sesión sea del workspace de la plataforma
// (`wsSuperAdmin()`, nunca OWNER_WS), que tenga una fila real (no `dev`, `password` ni `legacy`) y
// que haya pasado un segundo factor de verdad (`mfa` firmado y distinto de `dev`). Medido el 15/10:
// hay UN admin global, Martín, en el ws 9 (capa superadmin) y con 2FA.
export type SesionMinima = {
  sub: string; rol: string; ws?: number | null; legacy?: boolean; mfa?: string;
};
const SUBS_SIN_FILA = new Set(['dev', 'password', 'legacy']);

export function puedeOperar<T extends SesionMinima>(s: T | null | undefined, wsPlataforma: number): s is T {
  if (!s) return false;
  if (s.rol !== 'admin') return false;
  if (s.legacy) return false;
  if (!s.sub || SUBS_SIN_FILA.has(s.sub)) return false;
  if (!s.mfa || s.mfa === 'dev') return false;
  return typeof s.ws === 'number' && s.ws === wsPlataforma;
}

// ── Lo que sube el cartero ──────────────────────────────────────────────────────────────────
export type ChatCartero = {
  local: string;
  titulo: string;
  cuenta: string | null;
  /** true = la sesión está corriendo en la PC ahora (puede recibir). */
  vivo: boolean;
  /** busy / idle cuando está vivo. */
  estado: 'busy' | 'idle' | null;
  /** La última actividad que registra la app, ISO. */
  actividad: string | null;
  /**
   * ¿Hay un Runner abierto en la carpeta de config de esta sesión? SendMessage sólo llega a las sesiones de la
   * MISMA carpeta (medido el 16/10/2026: «ENOINBOX: no-key»), y cada cuenta de terminal tiene la suya: un chat vivo
   * sin Runner en su carpeta no recibe. Falta (undefined) en lo que subió un cartero de antes de la 1.4.0.
   */
  runner?: boolean;
  /** Es un Runner (cartero 1.10.0): se ve en la lista, pero no se le escribe ni se le entrega nada. */
  esRunner?: true;
  /** Es un chat de la nube (cartero 1.10.0): se ve en la lista; no está en esta PC, así que no recibe. `local` es su id. */
  nube?: true;
};

const corto = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function sanearChats(x: unknown): ChatCartero[] {
  if (!Array.isArray(x)) return [];
  const out: ChatCartero[] = [];
  const vistos = new Set<string>();
  for (const c of x.slice(0, 400)) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const nube = o.nube === true;
    const local = corto(o.local, nube ? 101 : 60);
    if (!(nube ? NUBE_RE : DESTINO_RE).test(local) || vistos.has(local)) continue;
    vistos.add(local);
    const cuenta = corto(o.cuenta, 12);
    const act = corto(o.actividad, 40);
    out.push({
      local,
      titulo: corto(o.titulo, 120) || '(sin título)',
      cuenta: CUENTA_RE.test(cuenta) ? cuenta : null,
      vivo: o.vivo === true,
      estado: o.estado === 'busy' || o.estado === 'idle' ? o.estado : null,
      actividad: act && Number.isFinite(Date.parse(act)) ? act : null,
      ...(typeof o.runner === 'boolean' ? { runner: o.runner } : {}),
      ...(o.esRunner === true ? { esRunner: true as const } : {}),
      // Uno de la nube nunca está vivo para la PC: no tiene canal.
      ...(nube ? { nube: true as const, vivo: false } : {}),
    });
  }
  return out;
}

/**
 * Lo que un cartero dice que la PC puede entregar ahora (1.4.0): sus chats vivos con un Runner en su carpeta. Sólo
 * cuenta lo que ESTE mismo cartero subió vivo en la vuelta: no se reclama nada para un chat que no mostró. Sin la
 * lista (un cartero de antes), todos sus vivos, como siempre.
 */
export function sanearEntregables(x: unknown, chats: readonly ChatCartero[]): string[] {
  // Al Runner no se le entrega nada, y uno de la nube no tiene canal: nunca se reclama un trabajo para ellos.
  const vivos = chats.filter((c) => c.vivo && !c.esRunner && !c.nube).map((c) => c.local);
  if (!Array.isArray(x)) return vivos;
  const pedidos = new Set(x.filter((v): v is string => typeof v === 'string'));
  return vivos.filter((l) => pedidos.has(l));
}

export function sanearClaves(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return [...new Set(x.filter((k): k is string => typeof k === 'string' && /^[0-9a-f]{16}$/.test(k)))].slice(0, 20);
}

export type Acuse = { id: string; estado: 'entregado' | 'no_entregado' | 'incierto'; motivo: string | null };

export function sanearAcuses(x: unknown): Acuse[] {
  if (!Array.isArray(x)) return [];
  const out: Acuse[] = [];
  for (const a of x.slice(0, 100)) {
    if (!a || typeof a !== 'object') continue;
    const o = a as Record<string, unknown>;
    if (typeof o.id !== 'string' || !UUID_RE.test(o.id)) continue;
    if (o.estado !== 'entregado' && o.estado !== 'no_entregado' && o.estado !== 'incierto') continue;
    out.push({ id: o.id, estado: o.estado, motivo: corto(o.motivo, 300) || null });
  }
  return out;
}

// ── Lo que se dijo en cada chat (17/10/2026) ──────────────────────────────────────────────────────────────────────
// Martín, mirando el Centro en producción: «los chats no se entienden... No se entiende la conversación que se tiene».
// La conversación tiene que leerse como un chat de verdad: lo que se le dijo y lo que CONTESTÓ (el texto final de cada
// turno). Lo saca la PC del transcript de cada chat (cartero.mjs → turnosDeLineas) y lo sube en la vuelta, sólo lo
// nuevo; MaKo guarda los últimos de cada chat (lib/centro-turnos-db.ts).

/** Un turno: `yo` = lo que se le escribió (Martín, en la app o por un trabajo); `el` = lo que contestó al terminar;
 *  `otro` = lo que le mandó otra sesión (`de`: su nombre, por ejemplo «Cerebro»). `trabajo` = el id del trabajo del Centro
 *  que lo trajo (ese ya se ve como trabajo: el turno no se repite). */
export type TurnoChat = {
  local: string; uuid: string; rol: 'yo' | 'el' | 'otro'; de: string | null; texto: string; at: string; trabajo: string | null;
  /** Lo que Martín adjuntó en la app de Claude (cartero 1.17.0): sólo en un turno «yo». */
  adjuntos?: AdjuntoTurno[];
  /** El ENCARGO con el que otra sesión abrió este chat (`esEncargoDeOtraSesion`): un `otro` del Cerebro que sí se dibuja,
   *  plegado. Nunca es de Martín. */
  encargo?: true;
  /** El resumen del `wrap_up` del turno que CIERRA (cartero 1.21.0, 27/10/2026): lo que hizo, en dos o tres oraciones. El
   *  «Completado» lo muestra primero (BloqueCompletado.tsx); el texto entero queda abajo, plegado. */
  resumen?: string;
  /** De qué RONDA del chat es este texto (cartero 1.21.0): el uuid del primero de la ronda. `fin`: es el que la cierra. Con
   *  eso, un «Ya está» de a mitad de la ronda cede el «Completado» al cierre de esa ronda (lib/centro-chats.ts →
   *  completadosDelChat). */
  inicio?: string;
  fin?: true;
  /** El turno terminó con trabajo de FONDO vivo (cartero 1.21.0: una tarea en segundo plano, un Monitor, un Workflow): no es un
   *  «Completado» y el chat sigue «Trabajando» (Martín, 27/10 23:07: «El cuadro de COMPLETADO debe ser dopamínico»). */
  fondo?: true;
};
/** Copia de `TOPE_RESUMEN` del cartero: un tope técnico, no de lectura. */
export const TOPE_RESUMEN = 2000;

// ── El Ops Center sólo muestra lo que es para Martín (22/10/2026) ─────────────────────────────────────────────────────
// Martín, desde el teléfono y con captura: «me salen estos textos largos innecesarios en muchos chats... No los quiero». En
// su «Cerebro» se leía entero, como si lo hubiera escrito él, un mensaje de un chat a otro («Integración → Cerebro: READY.
// 87365c830 está EN PRODUCCIÓN…»), con el nombre del que lo mandó como cita. Medido en la base ese día (71 chats, 1.937
// turnos): 279 eran mensajes de OTRO chat (`otro`, la coordinación: 195 del Cerebro) y 14 «de Martín» eran el resumen que
// Claude Code escribe al compactar una conversación («This session is being continued from a previous conversation…»).
// Ninguno de los dos es para él. Se dibuja lo que escribe Martín y lo que el chat contesta (su «Voy a trabajar en…», su «Ya
// está», sus preguntas), y un pedido suyo que llega por el Runner (`yo` con `trabajo`).
// ⚠️ EL `otro` SE SIGUE GUARDANDO: cuenta para que una pregunta quede atrás (lib/centro-preguntas-chat.ts), sólo no se dibuja
//    (lib/centro-chats.ts → lineasDeConversacion, vistaPrevia). El resumen de la compactación, en cambio, no sirve para nada:
//    `sanearTurnos` lo saca al subir Y al leer, así que tampoco vuelve lo que ya estaba guardado.

/** El resumen que escribe Claude Code al compactar un chat. Lo sube el cartero como si fuera de Martín, y no lo escribió nadie. */
export const esResumenDeCompactacion = (texto: string): boolean =>
  /^\s*This session is being continued from a previous conversation/i.test(texto);

/**
 * ¿Es el ENCARGO con el que otra sesión abrió este chat? (27/10/2026, Martín: «Yo NO envié ese mensaje confuso y largo».) El
 * chat que el Cerebro abre con `start_session` arranca con un mensaje que en el transcript es del USUARIO («Background (from
 * the session that started this one): … Task: …»), y el cartero lo sube como `yo`: se dibujaba como un mensaje de Martín, con
 * su foto. Lo escribió el Cerebro. `sanearTurnos` lo vuelve un `otro` del Cerebro con `encargo`, al subir y al leer.
 */
export const esEncargoDeOtraSesion = (texto: string): boolean =>
  /^\s*Background \(from the session that started this one\):/.test(texto);
/** Lo que se le pidió en el encargo: su «Task:» (sin el «Background…» de arriba), o el texto sin el rótulo. */
export const textoDelEncargo = (texto: string): string =>
  /\n\s*Task:\s*\n?([\s\S]+)/.exec(texto)?.[1]?.trim() ?? texto.replace(/^\s*Background \(from the session that started this one\):\s*/, '').trim();

/** ¿Este turno se le muestra a Martín? Lo suyo y lo que el chat le contesta, sí; lo que un chat le dice a otro, no, salvo el
 *  encargo con el que lo abrieron (va plegado: «Encargo del Cerebro»). */
export const esParaMartin = (t: Pick<TurnoChat, 'rol' | 'texto'> & { encargo?: boolean }): boolean =>
  (t.rol !== 'otro' || t.encargo === true) && !(t.rol === 'yo' && esResumenDeCompactacion(t.texto));

// ── Lo que Martín adjunta DIRECTO en la app de Claude (20/10/2026, el punto 4 del 18/10; cartero 1.17.0) ──────────────
// Martín: «cuando envío imágenes por aquí o adjunto cosas también deberían aparecer en el Center». En el transcript, una
// captura que pegó es un bloque `image` (un PDF, `document`) en base64 dentro de SU mensaje; las de las herramientas van
// adentro de un `tool_result` y no cuentan. La PC la saca del turno, la mira por sus BYTES y la sube DIRECTO al storage
// (bucket privado `archivero`, `operaciones-turnos/<ref>`) con una URL firmada que pide con su token; el turno viaja sólo
// con su `ref`. La pantalla la ve con una URL firmada de 10 minutos que da `turnosCentroAction` (puedeOperar).
export const MIMES_ADJUNTO_TURNO: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
export const MAX_ADJUNTOS_TURNO = 8;
export const MAX_BYTES_ADJUNTO_TURNO = 30 * 1024 * 1024;
/** `ref`: `<local>/<uuid del turno>/<n>`. `url`: la firmada, sólo al dibujar (nunca se guarda). */
export type AdjuntoTurno = { ref: string; mime: string; bytes: number; url?: string };
export const refAdjuntoTurno = (local: string, uuid: string, n: number): string => `${local}/${uuid}/${n}`;

/** Los adjuntos de un turno, saneados: de ESE turno (su `local` y su `uuid` en el `ref`), con un tipo y un tamaño que valen. */
export function sanearAdjuntosTurno(x: unknown, local: string, uuid: string): AdjuntoTurno[] {
  if (!Array.isArray(x)) return [];
  const out: AdjuntoTurno[] = [];
  for (const a of x.slice(0, MAX_ADJUNTOS_TURNO)) {
    const o = (a ?? {}) as Record<string, unknown>;
    if (typeof o.ref !== 'string' || typeof o.mime !== 'string' || typeof o.bytes !== 'number') continue;
    const [l, u, n, ...resto] = o.ref.split('/');
    if (resto.length || l !== local || u !== uuid || !/^[0-7]$/.test(n ?? '')) continue;
    if (!MIMES_ADJUNTO_TURNO.includes(o.mime) || !Number.isInteger(o.bytes) || o.bytes < 1 || o.bytes > MAX_BYTES_ADJUNTO_TURNO) continue;
    out.push({ ref: o.ref, mime: o.mime, bytes: o.bytes });
  }
  return out;
}
/**
 * Lo más largo de un turno que se guarda. ⚠️ ES UN TOPE TÉCNICO, NO UN CORTE (25/10/2026, Martín: «que no haya nunca un limite
 * de caracteres, en todo caso achica el mensaje y hazlo más claro»): hasta ese día eran 4000, la PC cortaba ahí y el «Completado»
 * decía «Cortado a los 4000 caracteres». Ahora el texto llega entero; esto sólo frena un abuso, y lo largo se ve plegado con
 * «Ver todo» (app/admin/operaciones/Avance.tsx). El cartero tiene su copia (scripts/operaciones/cartero.mjs, desde la 1.19.0).
 * El servidor acepta lo largo ANTES de que llegue un cartero que lo mande: uno viejo sigue mandando 4000 y no se rompe nada.
 */
export const TOPE_TURNO = 200_000;
/** Lo que cortaba un cartero de antes de la 1.19.0: un texto de justo este largo llegó cortado (`cortadoPorLaPC`). */
export const TOPE_TURNO_VIEJO = 4000;
/** Lo que escribió Martín (rol «yo»): entero también, con el mismo tope técnico (hasta el 25/10/2026, `MAX_TEXTO_LARGO`). */
export const TOPE_TURNO_YO = TOPE_TURNO;
/** Cuánto texto se guarda por chat, sumando sus turnos (25/10/2026). Con turnos enteros, los `TURNOS_POR_CHAT` de un chat podían
 *  pesar megas en cada lectura: se quedan los más nuevos que entren, y el último entra siempre, aunque solo lo pase. */
export const TEXTO_POR_CHAT = 600_000;
/** Cuántos turnos sube una vuelta, como mucho (la primera de un chat largo trae su historia). */
export const MAX_TURNOS_VUELTA = 300;
/** Cuántos turnos se guardan por chat (los últimos). */
export const TURNOS_POR_CHAT = 60;

export function sanearTurnos(x: unknown): TurnoChat[] {
  if (!Array.isArray(x)) return [];
  const out: TurnoChat[] = [];
  for (const a of x.slice(0, MAX_TURNOS_VUELTA)) {
    if (!a || typeof a !== 'object') continue;
    const o = a as Record<string, unknown>;
    if (typeof o.local !== 'string' || !DESTINO_RE.test(o.local)) continue;
    if (typeof o.uuid !== 'string' || !/^[\w-]{8,64}$/.test(o.uuid)) continue;
    if (o.rol !== 'yo' && o.rol !== 'el' && o.rol !== 'otro') continue;
    // El resumen de una compactación no es de nadie: ni se guarda ni vuelve lo guardado (ver `esParaMartin`).
    if (o.rol === 'yo' && typeof o.texto === 'string' && esResumenDeCompactacion(o.texto)) continue;
    // Una captura sola, sin texto, también es un mensaje de Martín (20/10/2026).
    const adjuntos = o.rol === 'yo' ? sanearAdjuntosTurno(o.adjuntos, o.local, o.uuid) : [];
    if (typeof o.texto !== 'string' || (!o.texto.trim() && !adjuntos.length)) continue;
    const at = typeof o.at === 'string' ? Date.parse(o.at) : NaN;
    if (!Number.isFinite(at)) continue;
    // El encargo de otra sesión no es de Martín (`esEncargoDeOtraSesion`): es del Cerebro, y se dibuja plegado.
    if (o.rol === 'yo' && !o.trabajo && esEncargoDeOtraSesion(o.texto)) {
      out.push({ local: o.local, uuid: o.uuid, rol: 'otro', de: 'Cerebro', texto: o.texto.slice(0, TOPE_TURNO), at: new Date(at).toISOString(), trabajo: null, encargo: true });
      continue;
    }
    out.push({
      local: o.local, uuid: o.uuid, rol: o.rol, de: o.rol === 'otro' ? corto(o.de, 60) || null : null,
      texto: o.texto.slice(0, o.rol === 'yo' ? TOPE_TURNO_YO : TOPE_TURNO), at: new Date(at).toISOString(),
      trabajo: typeof o.trabajo === 'string' && UUID_RE.test(o.trabajo) ? o.trabajo : null,
      ...(adjuntos.length ? { adjuntos } : {}),
      ...(o.rol === 'otro' && o.encargo === true ? { encargo: true as const } : {}),
      ...(o.rol === 'el' && typeof o.resumen === 'string' && o.resumen.trim() ? { resumen: o.resumen.trim().slice(0, TOPE_RESUMEN) } : {}),
      ...(o.rol === 'el' && typeof o.inicio === 'string' && /^[\w-]{8,64}$/.test(o.inicio) ? { inicio: o.inicio } : {}),
      ...(o.rol === 'el' && o.fin === true ? { fin: true as const } : {}),
      ...(o.rol === 'el' && o.fondo === true ? { fondo: true as const } : {}),
    });
  }
  return out;
}

/** Une lo que había con lo nuevo: sin repetir (por `uuid`: dos Runners pueden subir lo mismo), por hora, y sólo los
 *  últimos `TURNOS_POR_CHAT` que entren en `TEXTO_POR_CHAT` (el último, siempre). */
export function unirTurnos(antes: readonly TurnoChat[], nuevos: readonly TurnoChat[]): TurnoChat[] {
  const porId = new Map<string, TurnoChat>();
  for (const t of [...antes, ...nuevos]) porId.set(t.uuid, t);
  const ultimos = [...porId.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-TURNOS_POR_CHAT);
  let total = ultimos.reduce((n, t) => n + t.texto.length, 0);
  let desde = 0;
  while (total > TEXTO_POR_CHAT && desde < ultimos.length - 1) total -= ultimos[desde++].texto.length;
  return desde ? ultimos.slice(desde) : ultimos;
}

/**
 * Los turnos de la conversación de un chat, de TODAS sus sesiones: los últimos `TURNOS_POR_CHAT` (`unirTurnos`) y, aunque hayan
 * quedado afuera, su último «Ya está» y lo que hace falta para saber qué respondía (`pedidoDelCompletado`, lib/centro-chats.ts):
 * el «Ya está» de antes (donde empieza ese tramo), lo último de Martín y lo último de otro chat en el tramo, y lo último de
 * Martín de antes. `esYa` es `esYaEsta` (vive en lib/centro-chats.ts, que importa este módulo).
 * ⚠️ MEDIDO EL 25/10/2026: el CRM decía «Completado» en la lista (`resumirTurnos` guarda el último «Ya está» de CADA sesión) y al
 *    abrirlo no había bloque ni ✓ que dar, y la fila dejaba de decirlo: su «Ya está» era del 23/10, de una sesión vieja, y sus
 *    6 sesiones juntas pasaban los 60 turnos. Al cerrarlo volvía a decir «Completado»: no había forma de darlo por visto.
 */
/**
 * El CIERRE de la ronda de un «Ya está» (cartero 1.21.0: `inicio` y `fin`), si el «Ya está» no la cierra él mismo. Es el que
 * la conversación muestra como «Completado» (lib/centro-chats.ts → completadosDelChat): los recortes de la fila y de la
 * conversación lo tienen que traer, o la fila, la API y el chat abierto eligen distinto (revisión de 928bdde0d, media).
 */
export function cierreDeLaRonda(turnos: readonly TurnoChat[], ya: TurnoChat): TurnoChat | null {
  if (ya.fin) return null;
  const ronda = ya.inicio ?? ya.uuid;
  return turnos.find((t) => t.rol === 'el' && t.fin && t.inicio === ronda && Date.parse(t.at) >= Date.parse(ya.at)) ?? null;
}

export function turnosDeLaConversacion(todos: readonly TurnoChat[], esYa: (texto: string) => boolean): TurnoChat[] {
  const unidos = unirTurnos([], todos);
  const orden = [...new Map(todos.map((t) => [t.uuid, t])).values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const esSuYa = (t: TurnoChat) => t.rol === 'el' && esYa(t.texto);
  const deMartin = (t: TurnoChat) => t.rol === 'yo' && !t.trabajo;
  const iy = orden.findLastIndex(esSuYa);
  if (iy < 0) return unidos;
  const antes = orden.slice(0, iy);
  const ip = antes.findLastIndex(esSuYa);
  const tramo = antes.slice(ip + 1);
  const estan = new Set(unidos.map((t) => t.uuid));
  const faltan = new Map<string, TurnoChat>();
  for (const t of [orden[iy], cierreDeLaRonda(orden, orden[iy]), antes[ip], tramo.findLast(deMartin), tramo.findLast((x) => x.rol === 'otro'), antes.findLast(deMartin)]) {
    if (t && !estan.has(t.uuid)) faltan.set(t.uuid, t);
  }
  return faltan.size ? [...faltan.values(), ...unidos].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)) : unidos;
}

// ── Lo último de CADA chat, para su fila de la lista (17/10/2026, el aviso del «Completado» que no salía) ─────────────────
// Los turnos completos viajan sólo del chat que se mira, así que la fila de uno que no se abrió nunca sabía que su último
// mensaje era un «Ya está»: el aviso del «Completado» sin ver no salía (docs/hallazgos-operaciones.md). Cada refresco trae,
// de TODOS los chats, sólo lo último y recortado: lo que hace falta para la fila (el primer renglón) y no la conversación.
/** Cuántos turnos por chat viajan para la lista, y hasta qué antigüedad (lo de más de 3 días ya no avisa nada). */
export const ULTIMOS_POR_CHAT = 3;
export const ULTIMOS_VENTANA_MS = 3 * 86_400_000;
/** Cuánto del texto viaja: alcanza para el primer renglón (el «Ya está», «Sin incidentes nuevos»). */
export const ULTIMOS_TEXTO = 300;

/**
 * Los últimos turnos de un chat para su fila: los `ULTIMOS_POR_CHAT` más nuevos de los últimos 3 días, con el texto
 * recortado. ⚠️ SON PARA LA FILA, NUNCA PARA LA CONVERSACIÓN: el texto va cortado (el chat abierto trae los suyos enteros).
 */
export function resumirTurnos(
  turnos: readonly TurnoChat[], ahora: number,
  /** Con esto (`esYaEsta`), también el último «Ya está» del chat aunque no esté entre los últimos: la lista lo necesita para
   *  el ✓ del «Completado» (18/10/2026: si el chat escribía 3 cosas después, el «Completado» no llegaba a la lista). */
  esYa?: (texto: string) => boolean,
): TurnoChat[] {
  const orden = turnos.filter((t) => ahora - Date.parse(t.at) < ULTIMOS_VENTANA_MS).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const ultimos = orden.slice(-ULTIMOS_POR_CHAT);
  const ya = esYa ? [...orden].reverse().find((t) => t.rol === 'el' && esYa(t.texto)) : undefined;
  // Y el cierre de su ronda (revisión de 928bdde0d): es el «Completado» que la fila tiene que ofrecer y cerrar con su ✓.
  const cierre = ya ? cierreDeLaRonda(orden, ya) : null;
  const extra = [ya, cierre].filter((t): t is TurnoChat => !!t && !ultimos.includes(t));
  // El resumen del wrap_up también va recortado: la lista viaja en cada refresco (revisión de 928bdde0d, baja).
  return [...extra, ...ultimos].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((t) => ({ ...t, texto: t.texto.slice(0, ULTIMOS_TEXTO), ...(t.resumen ? { resumen: t.resumen.slice(0, ULTIMOS_TEXTO) } : {}) }));
}

/** El cierre de cuatro renglones (§3 del diseño): lo deja el chat al terminar. */
/** `revisar`: la página de MaKo donde se mira lo que hizo (punto 6, la sub-tab «Review»). Sólo una ruta interna. */
export type Cierre = { decidido: string; hecho: string; comprobado: string; sigue: string; prueba: string | null; revisar?: string | null };

/**
 * Una ruta para revisar: «/algo» de MaKo, en un renglón y hasta 300 caracteres; lo demás no se guarda (null). Es la
 * MISMA regla que `esHrefInterno` de la Ticketera (app/admin/runway/decisiones.ts), escrita acá porque ese módulo
 * importa éste: importarla al revés sería circular. tests/centro-revisar.test.ts fija que las dos digan lo mismo.
 */
export function rutaParaRevisar(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const r = v.trim();
  if (!r || r.length > 300 || /[\s\u0000-\u001f]/.test(r)) return null;
  return r.startsWith('/') && !r.startsWith('//') && !r.startsWith('/\\') ? r : null;
}
export type CierreEntrante = { id: string; cierre: Cierre };

export function sanearCierres(x: unknown): CierreEntrante[] {
  if (!Array.isArray(x)) return [];
  const out: CierreEntrante[] = [];
  for (const c of x.slice(0, 100)) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    if (typeof o.id !== 'string' || !UUID_RE.test(o.id)) continue;
    const k = (o.cierre && typeof o.cierre === 'object' ? o.cierre : {}) as Record<string, unknown>;
    const cierre: Cierre = {
      decidido: corto(k.decidido, 600), hecho: corto(k.hecho, 600),
      comprobado: corto(k.comprobado, 600), sigue: corto(k.sigue, 600),
      prueba: corto(k.prueba, 300) || null,
    };
    const revisar = rutaParaRevisar(k.revisar);
    if (revisar) cierre.revisar = revisar;
    if (!cierre.hecho && !cierre.decidido) continue;
    out.push({ id: o.id, cierre });
  }
  return out;
}

/** Un cierre con prueba pasa a `comprobado`; sin prueba, a `hecho`. */
export const estadoDeCierre = (c: Cierre): EstadoPedido => (c.prueba ? 'comprobado' : 'hecho');

// ── Qué dice la pantalla de un pedido que espera ────────────────────────────────────────────
// Hay UN CARTERO POR CUENTA (las tres corren a la vez, decisión de Martín del 15/10): cada uno lee
// el registro de sesiones de SU directorio de configuración y entrega adentro de su cuenta, que es
// donde SendMessage funciona. La pantalla junta lo que suben los tres.
export type VistaCartero = { cuenta: string; vistoAt: string | null; chats: ChatCartero[] };

/** Un mensaje que todavía no salió, desde cuándo cuenta como sin chat: antes de esto, lo normal es que la PC no haya dado la vuelta. */
export const SIN_CHAT_VIVO_MS = 10 * 60_000;

/** Lo que hace falta para leer una foto de los chats: de quién es, de cuándo, y qué chats trae. */
export type FotoDeChats = {
  cuenta?: string; vistoAt?: string | null; noticiasAt?: string | null;
  chats?: ReadonlyArray<{ local: string; vivo?: boolean; runner?: boolean }>;
};

/** La última vez que llegó algo de esa cuenta, de un Runner o del servicio. Sin `noticiasAt` (falta la mig 0355), `vistoAt`. */
export const noticiaDe = (k: Pick<FotoDeChats, 'vistoAt' | 'noticiasAt'>): string | null => (k.noticiasAt !== undefined ? k.noticiasAt : k.vistoAt) ?? null;

/** ¿La foto de esa cuenta está al día? `vivo` es de su última vuelta: con la foto vieja no dice nada de ahora. */
export const fotoAlDia = (k: Pick<FotoDeChats, 'vistoAt' | 'noticiasAt'>, ahora: number): boolean => carteroVivo({ vistoAt: noticiaDe(k) }, ahora);

/**
 * Cómo está ese chat ahora, según lo que subió la PC.
 *   `abierto`: una foto al día lo trae vivo y con un Runner que le entrega.
 *   `sin_runner`: una foto al día lo trae vivo, y ningún Runner en su carpeta (lo que deja un `/clear`). Abrir el chat no sirve.
 *   `cerrado`: una foto al día no lo trae vivo, o su cuenta está al día y no lo conoce.
 *   `sin_noticias`: su foto es vieja. No se sabe si está abierto; lo que falta es el Runner de esa cuenta.
 * ⚠️ UNA FOTO VIEJA NO DICE NI ABIERTO NI CERRADO (30/10/2026). Una fila vieja con `vivo: true` tapaba un chat que ya cerró, y una con
 * `vivo: false` hacía decir «chat cerrado» de uno que se abrió después. Si dos cuentas suben el mismo chat, manda la fresca.
 */
export function comoEstaElDestino(destino: string, cuenta: string | null | undefined, carteros: readonly FotoDeChats[], ahora: number): 'abierto' | 'sin_runner' | 'cerrado' | 'sin_noticias' {
  const lo = (k: FotoDeChats) => (k.chats ?? []).filter((c) => c.local === destino);
  const frescas = carteros.filter((k) => fotoAlDia(k, ahora)).flatMap(lo);
  if (frescas.length) {
    const vivas = frescas.filter((c) => !!c.vivo);
    if (!vivas.length) return 'cerrado';
    return vivas.every((c) => c.runner === false) ? 'sin_runner' : 'abierto';
  }
  const enVieja = carteros.some((k) => lo(k).length > 0);
  const suyo = carteros.find((k) => k.cuenta === cuenta);
  return enVieja || (suyo && !fotoAlDia(suyo, ahora)) ? 'sin_noticias' : 'cerrado';
}

/**
 * Los mensajes `escrito` hace más de `SIN_CHAT_VIVO_MS` hacia un chat que una foto al día dice cerrado (30/10/2026): la cuenta es de MaKo,
 * con lo que subió la PC. La usan el vigía del Runner y el aviso al Cerebro (lib/limbo-al-cerebro.ts), que dice; el cartel del Ops Center se sacó el 31/10/2026. El aviso dice
 * «espera un chat cerrado»: lo demás que no sale (sin Runner, un chat por abrir) tiene otra causa, y la clasifica `mensajesEnLimbo`.
 */
export function pedidosSinChatVivo<P extends { created_at: string; destino: string; destino_cuenta?: string | null; estado: string }>(
  pedidos: readonly P[], carteros: readonly FotoDeChats[], ahora: number,
): P[] {
  return pedidos.filter((p) => p.estado === 'escrito' && p.destino !== DESTINO_NUEVO && ahora - Date.parse(p.created_at) > SIN_CHAT_VIVO_MS
    && comoEstaElDestino(p.destino, p.destino_cuenta, carteros, ahora) === 'cerrado');
}

/**
 * ¿Hay un Runner dando vueltas en esa cuenta? ⚠️ `vistoAt` ES LA ÚLTIMA VUELTA DE UN RUNNER, no la de cualquiera (30/10/2026): sale de
 * `runner_visto_at` (`vistoDeLaFila`). Lo que dice «la PC dio noticias» es `noticiasAt`, y sólo lo lee lib/centro-chats.ts.
 */
export function carteroVivo(c: { vistoAt: string | null } | null | undefined, ahora: number): boolean {
  if (!c?.vistoAt) return false;
  const t = Date.parse(c.vistoAt);
  return Number.isFinite(t) && ahora - t < CARTERO_VIVO_MS;
}

// ── Las dos preguntas: «¿hay noticias de la PC?» y «¿hay un Runner?» (30/10/2026; docs/diseno-cartero-servicio.md §2.6) ───────────────
// El servicio de la PC (cartero 1.25.0) sube cada 2 minutos sin ningún Runner. Si `visto_at` siguiera siendo «hay Runner», el Ops Center
// diría «Activo» justo en el caso que el servicio viene a mostrar. En la base: `visto_at` = llegó algo, `runner_visto_at` = llegó un Runner.
// En el código, `vistoAt` sigue siendo el Runner: TODOS sus lectores preguntan eso, y uno que se olvide queda del lado seguro.

/** Lo que dice de sí misma una vuelta del servicio (`servicio: { version, desde }` en el POST). Una de Runner no lo trae. */
export type ServicioPc = { version: string | null; desde: string | null };

/** null = no es del servicio. Un objeto con campos rotos SÍ lo es: una vuelta que se declara servicio nunca pasa por un Runner. */
export function sanearServicio(x: unknown): ServicioPc | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const t = typeof o.desde === 'string' && o.desde.length <= 40 ? Date.parse(o.desde) : NaN;
  return {
    version: typeof o.version === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(o.version) ? o.version : null,
    desde: Number.isFinite(t) ? new Date(t).toISOString() : null,
  };
}

/**
 * Lo que escribe una vuelta en `operaciones_carteros`. `fila` con las columnas de la mig 0355; `sinColumnas`, lo que se manda si todavía no
 * se aplicó. ⚠️ EL SERVICIO NO NOMBRA `version` NI `runner_visto_at`: un upsert que no los nombra los deja como están. Su versión pisaría la
 * del Runner, y con ésa MaKo decide qué le da (`versionAlMenos`).
 */
export function filaDeLaVuelta<C, K>(v: {
  cuenta: string; version: string | null; chats: C; claves: K; cuota: unknown; servicio: ServicioPc | null; ahoraIso: string;
}): { fila: Record<string, unknown>; sinColumnas: Record<string, unknown> } {
  const comun = { cuenta: v.cuenta, visto_at: v.ahoraIso, chats: v.chats, claves: v.claves, updated_at: v.ahoraIso, ...(v.cuota ? { cuota: v.cuota } : {}) };
  if (v.servicio) return { fila: { ...comun, servicio: { ...v.servicio, visto_at: v.ahoraIso } }, sinColumnas: comun };
  return { fila: { ...comun, version: v.version, runner_visto_at: v.ahoraIso }, sinColumnas: { ...comun, version: v.version } };
}

/** ¿Falta la mig 0355? 42703 al leer, PGRST204 al escribir. */
export const faltaColumnaDeLaVuelta = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === '42703' || e.code === 'PGRST204') && /runner_visto_at|servicio/.test(e.message ?? '');

/**
 * El `vistoAt` y el `noticiasAt` de una fila. Con la columna, lo que diga (null = ningún Runner dio nunca una vuelta: el `visto_at` de una
 * fila que creó el servicio no cuenta). Sin ella (falta la migración), `visto_at`, como siempre.
 */
export function vistoDeLaFila(f: Record<string, unknown>): { vistoAt: string | null; noticiasAt: string | null } {
  const noticiasAt = (f.visto_at as string | null | undefined) ?? null;
  return { vistoAt: 'runner_visto_at' in f ? ((f.runner_visto_at as string | null) ?? null) : noticiasAt, noticiasAt };
}

/** Los chats de todos los carteros, cada uno con la cuenta de SU cartero si no trae la suya. */
export function todosLosChats(carteros: VistaCartero[]): ChatCartero[] {
  const vistos = new Map<string, ChatCartero>();
  for (const k of carteros) {
    for (const c of k.chats) {
      const previo = vistos.get(c.local);
      if (!previo || (c.vivo && !previo.vivo)) vistos.set(c.local, { ...c, cuenta: c.cuenta ?? k.cuenta });
    }
  }
  return [...vistos.values()];
}

/** Para un pedido `escrito`: por qué todavía no salió. null = sale en la próxima vuelta. */
export function motivoDeEspera(
  p: { estado: EstadoPedido; destino: string; destino_cuenta: string | null },
  carteros: VistaCartero[],
  ahora: number,
): string | null {
  if (p.estado !== 'escrito') return null;
  if (p.destino === DESTINO_NUEVO) return 'Espera que el Runner lo abra: con la apertura prendida en la PC';
  const chat = todosLosChats(carteros).find((x) => x.local === p.destino);
  const cuenta = chat?.cuenta ?? p.destino_cuenta;
  const suyo = carteros.find((k) => k.cuenta === cuenta);
  const n = cuenta ? cuenta.replace('claude', '') : '?';
  if (!carteroVivo(suyo, ahora)) return `Espera al cartero de la cuenta ${n}`;
  if (chat?.vivo) return null;
  return 'El chat está cerrado: sale cuando se abra';
}
