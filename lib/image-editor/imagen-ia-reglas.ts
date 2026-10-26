// =============================================================================
// image-editor/imagen-ia-reglas — crear o editar una imagen con la IA DEL NEGOCIO (puro: proveedores, medidas, fallos)
// =============================================================================
// Martín, 26/10/2026: «que funcione todo, que se pueda editar o crear una imagen a raíz de prompts y chatear con MaKo».
// El chat «MaKo IA» del Image Editor y la API de MaKo (área `imagen`) piden una imagen; la paga el NEGOCIO con SU clave
// (MaKo no paga la IA de un negocio: AGENTS.md, «Quién paga la IA de un cliente: el cliente»). El server-only que lee las
// claves y anota el gasto es ./imagen-ia.ts; acá lo que se puede probar sin la base ni la red:
//   · QUÉ PROVEEDOR: su OpenAI y, si no tiene, su Gemini (`elegirProveedor`). Una clave que es COPIA de la de la
//     plataforma no es suya (`susClaves`, lib/ia-del-negocio.ts); una guardada que no se puede leer, tampoco se usa.
//     Su Claude no hace imágenes. UN proveedor por pedido: si falla, no se prueba el otro (sería cobrar dos veces).
//   · NUNCA SE REINTENTA: el crédito se gasta cuando el pedido viaja (AGENTS.md, «el default es NO reintentar»). Un
//     plazo vencido o un 200 sin imagen se dicen como «puede haberse cobrado igual».
//   · `res.ok` NO ES «SALIÓ BIEN»: la imagen tiene que estar ADENTRO del cuerpo (y sus bytes ser una imagen de verdad).
//   · EL MENSAJE DICE DE QUIÉN FUE Y QUÉ HACER, con el nombre del proveedor primero, y el link al modal de su clave
//     (`/integraciones?abrir=openai`: la pantalla lo abre AHÍ, sin salir de la tab).
//
// ⚠️ LOS MODELOS, VERIFICADOS EL 26/10/2026 (developers.openai.com/api/docs/deprecations y ai.google.dev): `gpt-image-1`
// se APAGÓ el 23/10/2026; su reemplazo es la familia 2.5 (`flare` para crear, `sunburst` para editar «donde la precisión
// importa»; mismo precio). `gemini-2.5-flash-image` sigue, pero sólo para claves que ya usaron los 2.5 y sin plan gratis.
//
// SIN `server-only`: lo leen el server, la API de MaKo y los tests.
// =============================================================================

import type { SuClaveGuardada } from '../ia-del-negocio';

export type ProveedorImagen = 'openai' | 'gemini';

/** Los modelos, fijos (nunca «el último»: uno nuevo cambia el precio y la forma de la respuesta). */
export const MODELOS_IMAGEN = {
  openaiCrear: 'gpt-image-2.5-flare',
  openaiEditar: 'gpt-image-2.5-sunburst',
  gemini: 'gemini-2.5-flash-image',
} as const;

/** La calidad de OpenAI, fija: su default (`auto`) puede elegir `max`, que cuesta varias veces más. */
export const CALIDAD_OPENAI = 'medium';

export const TOPES_IMAGEN_IA = {
  /** Lo que describe la imagen (el chat ya lo corta a 2000). */
  prompt: 4_000,
  /** La imagen de referencia de una edición, en bytes. ⚠️ Vercel corta el cuerpo de un pedido en ~4,5 MB: el navegador la
   *  manda más chica (`TOPES_CHAT_IMAGEN.referencia`, lib/image-editor/chat/catalogo.ts). */
  referenciaBytes: 8 * 1024 * 1024,
  /** Lo que se espera al proveedor. Una imagen tarda de 10 a 90 s; la ruta corta a 180. */
  plazoMs: 150_000,
} as const;

export const NOMBRE_PROVEEDOR: Record<ProveedorImagen, string> = { openai: 'OpenAI', gemini: 'Google (Gemini)' };
const CLAVE_DE: Record<ProveedorImagen, 'OPENAI_API_KEY' | 'GEMINI_API_KEY'> = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY' };

/** El modal de su clave de OpenAI, abierto en la tab (`LinkIntegracion` lo convierte). */
export const LINK_CONECTAR_OPENAI = { texto: 'Conectar tu OpenAI', href: '/integraciones?abrir=openai' } as const;
const LINK_DE: Record<ProveedorImagen, { texto: string; href: string }> = {
  openai: LINK_CONECTAR_OPENAI,
  gemini: { texto: 'Revisar tu Gemini', href: '/integraciones?abrir=gemini' },
};

/**
 * Un fallo, para la persona. `deQuien`: `cuenta` (su clave, su saldo: se arregla en su cuenta y se anota en «Tus cuentas
 * de IA»), `proveedor` (un bache del tercero: no es nada suyo), `contenido` (el proveedor no quiso ESA imagen), `mako`
 * (algo de acá: se reporta). `salio`: el pedido llegó al proveedor (lo que haya cobrado, no se devuelve).
 */
export type FalloImagen = { texto: string; deQuien: 'cuenta' | 'proveedor' | 'contenido' | 'mako'; link?: { texto: string; href: string }; salio: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// Qué proveedor
// ─────────────────────────────────────────────────────────────────────────────

export type Eleccion = { ok: true; proveedor: ProveedorImagen; clave: 'OPENAI_API_KEY' | 'GEMINI_API_KEY' } | { ok: false; fallo: FalloImagen };

/**
 * Con qué clave se pide la imagen: su OpenAI y, si no, su Gemini. Sólo las PROPIAS (`susClaves`): una copia de la de la
 * plataforma (el ws1 tiene copias) no es suya, y una que no se puede leer no se usa. Sin ninguna, el mensaje pide SU
 * OpenAI (desde el 25/10/2026 no se le ofrece Gemini a nadie; quien ya lo tiene, lo usa).
 */
export function elegirProveedor(claves: readonly SuClaveGuardada[]): Eleccion {
  const es = (c: SuClaveGuardada['clave']) => claves.find((x) => x.clave === c)?.es ?? null;
  if (es('OPENAI_API_KEY') === 'propia') return { ok: true, proveedor: 'openai', clave: 'OPENAI_API_KEY' };
  if (es('GEMINI_API_KEY') === 'propia') return { ok: true, proveedor: 'gemini', clave: 'GEMINI_API_KEY' };
  if (es('OPENAI_API_KEY') === 'ilegible') {
    return { ok: false, fallo: { texto: 'Tu clave de OpenAI está guardada pero no se puede leer. Vuelve a pegarla y pide la imagen otra vez.', deQuien: 'cuenta', link: LINK_CONECTAR_OPENAI, salio: false } };
  }
  const soloClaude = es('ANTHROPIC_API_KEY') === 'propia' || es('ANTHROPIC_API_KEY') === 'ilegible';
  const texto = soloClaude
    ? 'Tu Claude no crea imágenes. Para crear o editar imágenes, MaKo usa tu GPT: conecta tu clave de OpenAI y vuelve a pedirla.'
    : 'Para crear o editar imágenes, MaKo usa tu propia IA, y la que hace imágenes es tu GPT. Conecta tu clave de OpenAI y vuelve a pedirla.';
  return { ok: false, fallo: { texto, deQuien: 'cuenta', link: LINK_CONECTAR_OPENAI, salio: false } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Medidas
// ─────────────────────────────────────────────────────────────────────────────

const distancia = (a: number, b: number) => Math.abs(Math.log(a) - Math.log(b));

/** El tamaño de OpenAI más parecido a la caja: cuadrado, apaisado (3:2) o vertical (2:3). */
export function tamanoOpenAI(ancho: number, alto: number): '1024x1024' | '1536x1024' | '1024x1536' {
  const r = ancho > 0 && alto > 0 ? ancho / alto : 1;
  const opciones = [['1024x1024', 1], ['1536x1024', 1.5], ['1024x1536', 2 / 3]] as const;
  return [...opciones].sort((a, b) => distancia(r, a[1]) - distancia(r, b[1]))[0][0];
}

const ASPECTOS_GEMINI = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const;

/** La proporción de Gemini más parecida a la caja (las que acepta `imageConfig.aspectRatio`). */
export function aspectoGemini(ancho: number, alto: number): (typeof ASPECTOS_GEMINI)[number] {
  const r = ancho > 0 && alto > 0 ? ancho / alto : 1;
  const valor = (a: string) => { const [w, h] = a.split(':').map(Number); return w / h; };
  return [...ASPECTOS_GEMINI].sort((a, b) => distancia(r, valor(a)) - distancia(r, valor(b)))[0];
}

/** El tipo de una imagen por sus primeros bytes (PNG, JPEG o WebP; lo demás, null). */
export function tipoDeImagen(b: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

/** El ancho y el alto en píxeles de un PNG, un JPEG o un WebP, leídos de su cabecera; null si no se pueden leer. */
export function medidasDeImagen(b: Uint8Array): { ancho: number; alto: number } | null {
  const tipo = tipoDeImagen(b);
  const u16be = (i: number) => (b[i] << 8) | b[i + 1];
  const u32be = (i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const ok = (ancho: number, alto: number) => (ancho > 0 && alto > 0 && ancho <= 100_000 && alto <= 100_000 ? { ancho, alto } : null);
  if (tipo === 'image/png') return b.length >= 24 ? ok(u32be(16), u32be(20)) : null;
  if (tipo === 'image/jpeg') {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const largo = u16be(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return ok(u16be(i + 7), u16be(i + 5));
      i += 2 + largo;
    }
    return null;
  }
  if (tipo === 'image/webp' && b.length >= 30) {
    const chunk = String.fromCharCode(...b.subarray(12, 16));
    if (chunk === 'VP8X') return ok(1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16)));
    if (chunk === 'VP8 ') return ok((b[26] | (b[27] << 8)) & 0x3fff, (b[28] | (b[29] << 8)) & 0x3fff);
    if (chunk === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return ok((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
  }
  return null;
}

/** Una data URL de imagen (PNG, JPEG o WebP) → sus bytes, verificados por su firma y dentro del tope; o el motivo. */
export function leerReferencia(raw: unknown): { ok: true; mime: 'image/png' | 'image/jpeg' | 'image/webp'; bytes: Uint8Array } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'La imagen de referencia no vino.' };
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(raw);
  if (!m) return { ok: false, error: 'La imagen de referencia no es un PNG, JPEG o WebP.' };
  if (Math.floor((m[2].length * 3) / 4) > TOPES_IMAGEN_IA.referenciaBytes) return { ok: false, error: 'La imagen de referencia pesa más de 8 MB.' };
  const bytes = new Uint8Array(Buffer.from(m[2], 'base64'));
  const real = tipoDeImagen(bytes);
  if (!real || real !== m[1]) return { ok: false, error: 'La imagen de referencia no es lo que dice ser.' };
  return { ok: true, mime: real, bytes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Los fallos, en palabras (el nombre del proveedor PRIMERO)
// ─────────────────────────────────────────────────────────────────────────────

/** El mensaje del proveedor, corto y sin nada que parezca una clave (el 401 de OpenAI trae la clave enmascarada). */
function detalle(msg: string): string {
  return msg.replace(/\b(sk|AIza)[-_A-Za-z0-9*.]{6,}/g, '[clave]').replace(/\s+/g, ' ').trim().slice(0, 160);
}

/** Un fallo con status HTTP (o con el error ADENTRO de un 200): por causa, porque cada causa se arregla distinto. */
export function falloDeRespuesta(p: ProveedorImagen, modelo: string, status: number, mensaje: string): FalloImagen {
  const n = NOMBRE_PROVEEDOR[p];
  const t = mensaje.toLowerCase();
  const link = LINK_DE[p];
  if (/must be verified|verify (your )?organization|organization verification/.test(t)) {
    return { texto: `${n} pide verificar tu organización antes de crear imágenes con ${modelo}. Lo hace quien administra tu cuenta en platform.openai.com → Settings → Organization; después vuelve a pedirla.`, deQuien: 'cuenta', salio: true };
  }
  if (status === 401 || /api_key_invalid|api key not valid|invalid api key|incorrect api key/.test(t)) {
    return { texto: `${n} rechazó tu clave: parece inválida o vencida. Pega una nueva y vuelve a pedirla.`, deQuien: 'cuenta', link, salio: true };
  }
  if (/free_tier|free tier|limit: 0\b/.test(t)) {
    return { texto: `Tu clave de ${n} es del plan gratis, y ${n} no crea imágenes en ese plan. Para crear imágenes, conecta tu clave de OpenAI.`, deQuien: 'cuenta', link: LINK_CONECTAR_OPENAI, salio: true };
  }
  if (status === 429 && /per.?minute/.test(t)) {
    return { texto: `${n} está frenando los pedidos de tu cuenta por un rato (demasiados seguidos). Espera un minuto y vuelve a pedirla.`, deQuien: 'cuenta', salio: true };
  }
  if (/insufficient_quota|billing|exceeded your current quota|credit balance|hard limit|spending limit/.test(t)) {
    return { texto: `${n} dice que tu cuenta no tiene saldo o llegó a su tope de gasto. Carga saldo en tu cuenta de ${n} y vuelve a pedirla.`, deQuien: 'cuenta', salio: true };
  }
  if (status === 429 || /rate.?limit|resource_exhausted/.test(t)) {
    return { texto: `${n} está frenando los pedidos de tu cuenta por un rato (demasiados seguidos). Espera un minuto y vuelve a pedirla.`, deQuien: 'cuenta', salio: true };
  }
  if (/moderation|safety|content.?policy|content_filter|prohibited|blocked/.test(t)) {
    return { texto: `${n} no quiso crear esta imagen por sus reglas de contenido. No es tu clave: cambia el pedido (sin marcas, personas reales ni nada sensible) y vuelve a intentar.`, deQuien: 'contenido', salio: true };
  }
  if (status === 404 || /model_not_found|does not exist|not found|not supported|unsupported model/.test(t)) {
    return { texto: `${n} dice que el modelo ${modelo} no está disponible para tu clave. Es un problema de configuración de MaKo, no de tu clave: repórtalo a Soporte.`, deQuien: 'mako', salio: true };
  }
  if (status === 403) {
    return { texto: `${n} no deja usar ${modelo} con tu clave (permiso denegado). Revisa en tu cuenta de ${n} que la clave tenga acceso a los modelos de imágenes.`, deQuien: 'cuenta', link, salio: true };
  }
  if (status >= 500) {
    return { texto: `${n} está con problemas en este momento (error ${status}): no es tu clave ni tu saldo. Prueba de nuevo en unos minutos.`, deQuien: 'proveedor', salio: true };
  }
  const entre = [status ? `error ${status}` : '', detalle(mensaje)].filter(Boolean).join(': ');
  return { texto: `${n} rechazó el pedido${entre ? ` (${entre})` : ''}. Si se repite, repórtalo a Soporte.`, deQuien: 'mako', salio: true };
}

/** El plazo se venció o la red se cortó con el pedido ya enviado. */
export function falloDeRed(p: ProveedorImagen, e: unknown): FalloImagen {
  const n = NOMBRE_PROVEEDOR[p];
  const nombre = e instanceof Error ? e.name : '';
  if (nombre === 'TimeoutError' || nombre === 'AbortError') {
    return { texto: `${n} no contestó en ${Math.round(TOPES_IMAGEN_IA.plazoMs / 1000)} segundos. Puede que la imagen se haya cobrado igual en tu cuenta: mira tu uso en ${n} antes de volver a pedirla.`, deQuien: 'proveedor', salio: true };
  }
  return { texto: `No pude comunicarme con ${n} (falló la conexión). Puede que el pedido haya llegado: mira tu uso en ${n} antes de volver a pedirla.`, deQuien: 'proveedor', salio: true };
}

/** Contestó 200 y no hay imagen: no es un éxito. */
export function falloSinImagen(p: ProveedorImagen, por?: string): FalloImagen {
  const n = NOMBRE_PROVEEDOR[p];
  return { texto: `${n} contestó, pero sin ninguna imagen${por ? ` (${detalle(por)})` : ''}. Puede que se haya cobrado igual: mira tu uso en ${n} antes de volver a pedirla.`, deQuien: 'proveedor', salio: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Leer lo que contestó cada uno (la imagen ADENTRO del cuerpo)
// ─────────────────────────────────────────────────────────────────────────────

export type Imagen = { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' | 'image/webp'; ancho: number; alto: number };
export type LeidaImagen = { ok: true; imagen: Imagen; uso: Record<string, unknown> } | { ok: false; fallo: FalloImagen };

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Base64 → una imagen de verdad (firma y medidas), o null. */
function imagenDeBase64(b64: unknown): Imagen | null {
  if (typeof b64 !== 'string' || b64.length < 16) return null;
  const bytes = new Uint8Array(Buffer.from(b64, 'base64'));
  const mime = tipoDeImagen(bytes);
  const medidas = medidasDeImagen(bytes);
  return mime && medidas ? { bytes, mime, ...medidas } : null;
}

/** OpenAI (generations y edits): `data[0].b64_json`, y el error puede venir ADENTRO de un 200. */
export function leerRespuestaOpenAI(status: number, json: unknown, modelo: string): LeidaImagen {
  const cuerpo = esObjeto(json) ? json : {};
  const err = esObjeto(cuerpo.error) ? cuerpo.error : null;
  if (status < 200 || status >= 300 || err) {
    const msg = err ? `${String(err.code ?? '')} ${String(err.type ?? '')} ${String(err.message ?? '')}` : '';
    return { ok: false, fallo: falloDeRespuesta('openai', modelo, status >= 200 && status < 300 ? 0 : status, msg) };
  }
  const data = Array.isArray(cuerpo.data) ? cuerpo.data : [];
  const primera = esObjeto(data[0]) ? data[0] : {};
  const imagen = imagenDeBase64(primera.b64_json);
  if (!imagen) return { ok: false, fallo: falloSinImagen('openai') };
  return { ok: true, imagen, uso: esObjeto(cuerpo.usage) ? cuerpo.usage : {} };
}

/** Los `finishReason` de Gemini que son «no quiso por su contenido» (NO_IMAGE, IMAGE_OTHER, MAX_TOKENS son «sin imagen»). */
const MOTIVOS_BLOQUEO_GEMINI = /SAFETY|PROHIBITED|BLOCKLIST|RECITATION|SPII/;

/** Gemini (generateContent): la imagen es un `inlineData` de las partes; un bloqueo viene en `promptFeedback` o en el `finishReason`. */
export function leerRespuestaGemini(status: number, json: unknown, modelo: string): LeidaImagen {
  const cuerpo = esObjeto(json) ? json : {};
  const err = esObjeto(cuerpo.error) ? cuerpo.error : null;
  if (status < 200 || status >= 300 || err) {
    const detalles = err && Array.isArray(err.details) ? JSON.stringify(err.details).slice(0, 600) : '';
    const msg = err ? `${String(err.status ?? '')} ${String(err.message ?? '')} ${detalles}` : '';
    return { ok: false, fallo: falloDeRespuesta('gemini', modelo, status >= 200 && status < 300 ? 0 : status, msg) };
  }
  const fb = esObjeto(cuerpo.promptFeedback) ? cuerpo.promptFeedback : null;
  if (fb && typeof fb.blockReason === 'string' && fb.blockReason) {
    return { ok: false, fallo: falloDeRespuesta('gemini', modelo, 0, `blocked ${fb.blockReason}`) };
  }
  const candidatos = Array.isArray(cuerpo.candidates) ? cuerpo.candidates : [];
  const c = esObjeto(candidatos[0]) ? candidatos[0] : {};
  const partes = esObjeto(c.content) && Array.isArray(c.content.parts) ? c.content.parts : [];
  for (const parte of partes) {
    if (!esObjeto(parte)) continue;
    const inline = esObjeto(parte.inlineData) ? parte.inlineData : esObjeto(parte.inline_data) ? parte.inline_data : null;
    const imagen = inline ? imagenDeBase64(inline.data) : null;
    if (imagen) {
      const u = esObjeto(cuerpo.usageMetadata) ? cuerpo.usageMetadata : {};
      return { ok: true, imagen, uso: { prompt_tokens: u.promptTokenCount ?? 0, completion_tokens: u.candidatesTokenCount ?? 0, total_tokens: u.totalTokenCount ?? 0 } };
    }
  }
  const razon = typeof c.finishReason === 'string' ? c.finishReason : '';
  if (razon && razon !== 'STOP' && MOTIVOS_BLOQUEO_GEMINI.test(razon)) {
    return { ok: false, fallo: falloDeRespuesta('gemini', modelo, 0, `blocked ${razon}`) };
  }
  const texto = partes.map((x) => (esObjeto(x) && typeof x.text === 'string' ? x.text : '')).join(' ').trim();
  return { ok: false, fallo: falloSinImagen('gemini', razon && razon !== 'STOP' ? razon : texto) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pedirla (con el `fetch` que le den: el de verdad en el server, uno de mentira en los tests)
// ─────────────────────────────────────────────────────────────────────────────

export type PedidoImagen = { prompt: string; ancho: number; alto: number; referencia?: { mime: string; bytes: Uint8Array } | null };
export type Generada = { ok: true; imagen: Imagen; proveedor: ProveedorImagen; modelo: string; uso: Record<string, unknown> } | { ok: false; fallo: FalloImagen; proveedor?: ProveedorImagen; modelo?: string };

export type DepsImagen = {
  /** Las claves de IA del negocio, con lo que es cada una (`susClaves`). */
  claves: () => Promise<readonly SuClaveGuardada[]>;
  /** El valor de SU clave (`credDelClienteEstricta`, nunca el entorno). */
  valorDe: (clave: 'OPENAI_API_KEY' | 'GEMINI_API_KEY') => Promise<string | null>;
  fetch: typeof fetch;
};

/** La extensión de un tipo de imagen (para el nombre del archivo que va a OpenAI). */
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

async function pedirOpenAI(clave: string, p: PedidoImagen, f: typeof fetch): Promise<Generada> {
  const edita = !!p.referencia;
  const modelo = edita ? MODELOS_IMAGEN.openaiEditar : MODELOS_IMAGEN.openaiCrear;
  const size = tamanoOpenAI(p.ancho, p.alto);
  let res: Response;
  try {
    if (edita && p.referencia) {
      const form = new FormData();
      form.append('model', modelo);
      form.append('prompt', p.prompt);
      form.append('size', size);
      form.append('quality', CALIDAD_OPENAI);
      form.append('n', '1');
      form.append('output_format', 'png');
      form.append('image[]', new Blob([p.referencia.bytes as BlobPart], { type: p.referencia.mime }), `referencia.${EXT[p.referencia.mime] ?? 'png'}`);
      res = await f('https://api.openai.com/v1/images/edits', {
        method: 'POST', headers: { Authorization: `Bearer ${clave}` }, body: form, signal: AbortSignal.timeout(TOPES_IMAGEN_IA.plazoMs),
      });
    } else {
      res = await f('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelo, prompt: p.prompt, size, quality: CALIDAD_OPENAI, n: 1, output_format: 'png' }),
        signal: AbortSignal.timeout(TOPES_IMAGEN_IA.plazoMs),
      });
    }
  } catch (e) {
    return { ok: false, fallo: falloDeRed('openai', e), proveedor: 'openai', modelo };
  }
  const json = await res.json().catch(() => null);
  const r = leerRespuestaOpenAI(res.status, json, modelo);
  return r.ok ? { ok: true, imagen: r.imagen, proveedor: 'openai', modelo, uso: r.uso } : { ok: false, fallo: r.fallo, proveedor: 'openai', modelo };
}

async function pedirGemini(clave: string, p: PedidoImagen, f: typeof fetch): Promise<Generada> {
  const modelo = MODELOS_IMAGEN.gemini;
  const partes: unknown[] = [];
  if (p.referencia) partes.push({ inline_data: { mime_type: p.referencia.mime, data: Buffer.from(p.referencia.bytes).toString('base64') } });
  partes.push({ text: p.prompt });
  let res: Response;
  try {
    // La clave va en la cabecera, nunca en la URL (que queda en los logs).
    res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': clave, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: partes }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspectoGemini(p.ancho, p.alto) } },
      }),
      signal: AbortSignal.timeout(TOPES_IMAGEN_IA.plazoMs),
    });
  } catch (e) {
    return { ok: false, fallo: falloDeRed('gemini', e), proveedor: 'gemini', modelo };
  }
  const json = await res.json().catch(() => null);
  const r = leerRespuestaGemini(res.status, json, modelo);
  return r.ok ? { ok: true, imagen: r.imagen, proveedor: 'gemini', modelo, uso: r.uso } : { ok: false, fallo: r.fallo, proveedor: 'gemini', modelo };
}

/**
 * La imagen pedida, con la clave del negocio: UN proveedor y UN pedido. Nada se reintenta (ni con el mismo ni con el
 * otro): lo que el proveedor cobró al recibirlo no vuelve. Tira sólo si no pudo leer las claves (la falla la decide quien
 * llama: sin saber si la clave es suya, no se llama).
 */
export async function generarConClaves(p: PedidoImagen, deps: DepsImagen): Promise<Generada> {
  const prompt = p.prompt.trim().slice(0, TOPES_IMAGEN_IA.prompt);
  if (!prompt) return { ok: false, fallo: { texto: 'Falta describir la imagen.', deQuien: 'mako', salio: false } };
  const e = elegirProveedor(await deps.claves());
  if (!e.ok) return { ok: false, fallo: e.fallo };
  const clave = await deps.valorDe(e.clave);
  if (!clave) {
    return { ok: false, fallo: { texto: `Tu clave de ${NOMBRE_PROVEEDOR[e.proveedor]} no está guardada o está vacía. Vuelve a pegarla y pide la imagen otra vez.`, deQuien: 'cuenta', link: LINK_DE[e.proveedor], salio: false }, proveedor: e.proveedor };
  }
  const pedido = { ...p, prompt };
  return e.proveedor === 'openai' ? pedirOpenAI(clave, pedido, deps.fetch) : pedirGemini(clave, pedido, deps.fetch);
}

/** La clave de cada proveedor (para quien anota el fallo de SU clave). */
export const claveDeProveedor = (p: ProveedorImagen) => CLAVE_DE[p];
