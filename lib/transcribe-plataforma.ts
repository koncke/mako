// =============================================================================
// transcribe-plataforma — escuchar clases y videos de MaKo (los cursos, el Conocimiento) con las keys de la PLATAFORMA
// =============================================================================
// IA7 (22/10/2026): lib/transcribe.ts era una SEGUNDA cascada de audio con las keys del ENTORNO (Groq → whisper-1 → Gemini),
// fuera de D6b y sin registrar uso, y la usaban también los anuncios de cada negocio. Lo del NEGOCIO (sus anuncios, los
// creativos que sube) ahora pasa por la capa de IA con SUS keys (lib/transcribe.ts → transcribirAudio). Acá quedó lo que es
// de la plataforma y nada más: el Conocimiento de MaKo (app/api/mako/knowledge, del super admin) y los scripts de cursos
// (scripts/curso-transcribir.ts). ⚠️ Un llamador nuevo con datos de un negocio NO va acá: va a lib/transcribe.ts.
//
// Sin `server-only` a propósito: lo corren scripts de línea de comandos.
// =============================================================================

import { salidaDegenerada } from './stt-degenerado';

const OAI = 'https://api.openai.com/v1';
const MAX_BYTES = 25 * 1024 * 1024; // límite de OpenAI audio
// Lector síncrono del entorno. Es válido SOLO después de `await asegurarCreds()`:
// la hidratación de credenciales no está garantizada cuando entra un request
// (ver credencialesListas() en lib/credenciales.ts).
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env var ${name} no definida`);
  return v;
}

/**
 * Barrera: espera la hidratación del boot y, si igual no dejó la key de OpenAI,
 * la resuelve contra la base y la deja en el entorno para que `env()` la vea.
 *
 * No es defensivo de más: sin esto, un cold start a medio hidratar hacía que
 * `transcribeAd` tirara "Env var OPENAI_API_KEY no definida", y el cron guardaba
 * la fila con status 'error' — que hasta hoy contaba como "ya transcrito" y dejaba
 * al anuncio sin texto PARA SIEMPRE. Pasó con 9 anuncios de ws1 y ws3 entre el
 * 2026-07-29 y el 08-03.
 *
 * El import es DINÁMICO y con catch a propósito: este módulo se mantiene libre de
 * `server-only` para que lo puedan usar los scripts CLI (backfill-transcripts), y
 * lib/credenciales sí lo tiene. En un script no hay nada que hidratar — la key ya
 * viene del .env — así que el catch es el camino esperado, no un error.
 */
async function asegurarCreds(): Promise<void> {
  if (process.env.OPENAI_API_KEY) return;
  try {
    const { envCred } = await import('./credenciales');
    const k = await envCred('OPENAI_API_KEY');
    if (k) process.env.OPENAI_API_KEY = k;
  } catch {
    /* contexto sin server (script CLI): se sigue con lo que haya en el entorno */
  }
}

// ── Transcripción de un archivo SUBIDO (clase, video de curso, audio) ─────────
// Genérica: la usa el Conocimiento de MaKo para "bajar a tierra" cursos a partir
// de un video/audio. OpenAI whisper-1 acepta audio y video hasta 25 MB.
export type UploadTranscribeResult = {
  status: 'ok' | 'muy_grande' | 'error';
  transcript: string | null;
  idioma: string | null;
  duracion_s: number | null;
  error: string | null;
  /** Qué proveedor lo transcribió de verdad. Ver la nota de STT_CASCADA. */
  model?: string | null;
};

// ── QUIÉN ESCUCHA, Y EN QUÉ ORDEN ────────────────────────────────────────────
//
// ⚠️ ESTO NO TENÍA FALLBACK, Y SE COBRÓ CARO. Era una sola llamada a OpenAI: el día
// que la cuenta se quedó sin crédito, 7 clases de «Creator Club» quedaron SIN
// transcripción en medio de una corrida de 62 —con el mensaje «You have no credits
// remaining», que es clarísimo, pero llegó después de haber gastado el audio de las
// otras 55—. Y peor: como el .md viejo (truncado) seguía en disco, republicar habría
// publicado el texto cortado igual.
//
// El orden es GRATIS PRIMERO, y no es una degradación: `whisper-large-v3-turbo` de
// Groq es un modelo MÁS grande que `whisper-1`. Es la misma regla que gobierna el
// chat en AGENTS.md —lo que cobra es el último recurso, no el segundo— aplicada a
// escuchar.
//
// ⚠️ Y EL PROVEEDOR QUE ESCUCHÓ SE DEVUELVE, no se calla. «Un fallback que no cobra
// es una degradación silenciosa»: si mañana un proveedor transcribe peor, la única
// forma de enterarse es que el artefacto diga quién lo hizo. `curso-transcribir.ts`
// lo escribe en la cabecera del .md.
//
// No se usa la cascada de `lib/ai-cheap.ts` a propósito, y la diferencia es real: esa
// arranca por Gemini, que manda el audio INLINE y topea en 14 MB, mientras que acá
// entran archivos de hasta 25 MB; además resuelve credenciales por workspace y
// registra uso, que en un script de línea de comandos son efectos que nadie pidió.
// Lo que sí se comparte es el criterio: gratis primero, pago último, y se dice cuál.
const STT_CASCADA: Array<{ nombre: string; base: string; modelo: string; envKey: string }> = [
  { nombre: 'groq', base: 'https://api.groq.com/openai/v1', modelo: 'whisper-large-v3-turbo', envKey: 'GROQ_API_KEY' },
  { nombre: 'openai', base: OAI, modelo: 'whisper-1', envKey: 'OPENAI_API_KEY' },
];

// ── El tercer proveedor, que no habla el mismo protocolo ─────────────────────
//
// Groq y OpenAI comparten `/audio/transcriptions`; Gemini no: manda el audio DENTRO del
// request (`inline_data`) contra `generateContent`. Por eso está aparte y no en la tabla
// de arriba.
//
// Hace falta porque una cascada de dos se agota entera: medido el 2026-08-20, la cuenta
// de OpenAI sin crédito y Groq en su tope de 7.200 s de audio por hora, las dos al mismo
// tiempo, con 48 clases sin transcribir esperando.
//
// ⚠️ Y TRAE UNA TRAMPA QUE WHISPER NO TIENE: un techo de tokens de SALIDA. Con el default
// que usa `lib/ai-cheap.ts` para notas de voz (2.048) una clase de 20 minutos vuelve
// cortada, bien escrita y sin ningún error — que es exactamente la falla que este
// pipeline pasó el día entero sacando. Por eso acá el techo es alto Y se mira
// `finishReason`: si no dice STOP, no es una transcripción, es media.
const MAX_INLINE_GEMINI = 14 * 1024 * 1024;   // va dentro del request: hay techo de tamaño

async function sttGemini(buf: Buffer, mime: string, key: string, hint?: string): Promise<{ texto: string; modelo: string }> {
  if (buf.length > MAX_INLINE_GEMINI) throw new Error(`${(buf.length / 1048576).toFixed(1)} MB: no entra inline (tope 14 MB)`);
  const modelo = process.env.GEMINI_STT_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest';
  // ⚠️ «EN SU IDIOMA ORIGINAL» NO ES UNA PREFERENCIA: ACÁ DECÍA «en español» Y ESO ES UNA
  // ORDEN DE TRADUCIR.
  //
  // Se escribió cuando todos los cursos eran en español, donde no cambiaba nada. El primer
  // curso en inglés (Iman Gadzhi, 24/08/2026) salió con 3 de sus 26 clases TRADUCIDAS al
  // español y 22 en inglés: Gemini obedeció la orden unas veces y la ignoró otras, así que
  // el resultado es una moneda al aire y volver a correrlo no lo arregla.
  //
  // Y no salió gratis en contenido. Traducir compite con transcribir literal —son dos
  // tareas, no una— y en la clase 020 el modelo resolvió el conflicto RESUMIENDO: 95
  // palabras por minuto contra una mediana de 215 en las que quedaron en inglés, con el
  // medio de la clase degenerado en apuntes sueltos («Formulario de admisión.», «Tamaños
  // de audiencia.»). El pedido de traducir se llevó puesta la mitad del material.
  //
  // Es «un tope elegido contra UN proveedor apaga a los demás» (AGENTS.md) aplicada al
  // IDIOMA: un valor elegido cuando el universo era homogéneo pasa a gobernar al primero
  // que no lo es, y nadie vuelve a mirarlo.
  const instruccion = [
    'Transcribe este audio EN SU IDIOMA ORIGINAL. NO traduzcas: si el audio está en inglés,',
    'la transcripción va en inglés; si está en español, en español.',
    'Devuelve SOLO la transcripción literal de lo que se dice: sin comillas, sin timestamps,',
    'sin nombres de hablante, sin comentarios tuyos y sin describir el audio.',
    'Transcribe el audio COMPLETO, de principio a fin, sin resumir ni abreviar.',
    hint?.trim() ? `Contexto (nombres propios y jerga que pueden aparecer): ${hint.trim()}` : '',
  ].filter(Boolean).join(' ');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: instruccion }, { inline_data: { mime_type: (mime || 'audio/mp4').split(';')[0].trim(), data: buf.toString('base64') } }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 65536 },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(300000),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`HTTP ${res.status}: ${data?.error?.message || 'sin detalle'}`);
  const fin = data.candidates?.[0]?.finishReason;
  if (fin && fin !== 'STOP') throw new Error(`se cortó (finishReason=${fin}): no devuelvo media transcripción`);
  const texto = (data.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? '').join('').trim();
  if (!texto) throw new Error('devolvió vacío');
  // ⚠️ Un STOP no garantiza nada: el 08/10/2026 Gemini devolvió un minuto de habla y después
  // «1 2 3 … 699» con `finishReason: STOP` (lib/stt-degenerado.ts). Un bucle es un fallo, no
  // un texto a recortar: media clase se publica igual que una entera.
  const bucle = salidaDegenerada(texto);
  if (bucle) {
    console.error(`[transcribe] gemini devolvió ${bucle.detalle}`);
    throw new Error(bucle.motivo);
  }
  return { texto, modelo };
}

export async function transcribeMediaBuffer(
  bytes: ArrayBuffer,
  mime: string,
  filename: string,
  hint?: string,
): Promise<UploadTranscribeResult> {
  const buf = Buffer.from(bytes);
  if (buf.length > MAX_BYTES) {
    return { status: 'muy_grande', transcript: null, idioma: null, duracion_s: null, model: null, error: `${(buf.length / 1048576).toFixed(1)} MB > 25 MB (límite de OpenAI). Sube solo el audio o recorta el video.` };
  }
  await asegurarCreds();

  const errores: string[] = [];
  for (const p of STT_CASCADA) {
    let key = '';
    try { key = env(p.envKey); } catch { /* sin key: se prueba el que sigue */ }
    if (!key) { errores.push(`${p.nombre}: sin ${p.envKey}`); continue; }
    try {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(buf)], { type: mime || 'application/octet-stream' }), filename || 'clase');
      form.append('model', p.modelo);
      form.append('response_format', 'verbose_json');
      if (hint?.trim()) form.append('prompt', hint.trim()); // sesga ortografía/términos
      const tr = await (await fetch(`${p.base}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form })).json();
      if (tr.error) { errores.push(`${p.modelo}: ${tr.error.message}`); continue; }
      // Whisper también entra en bucle (repite una frase sobre la música o el silencio): se
      // anota y se prueba el que sigue, igual que un error.
      const bucle = salidaDegenerada(tr.text ?? '');
      if (bucle) {
        errores.push(`${p.modelo}: ${bucle.motivo}`);
        console.error(`[transcribe] ${p.modelo} devolvió ${bucle.detalle}`);
        continue;
      }
      // ⚠️ Un 200 con texto VACÍO no es un éxito ni un fallo del proveedor: puede ser
      // un audio sin voz. Se devuelve como ok con el texto vacío y el que llama decide,
      // pero NO se cae al siguiente proveedor —gastar dos veces por un silencio.
      return { status: 'ok', transcript: tr.text ?? '', idioma: tr.language ?? null, duracion_s: tr.duration ?? null, model: p.modelo, error: null };
    } catch (e) {
      errores.push(`${p.modelo}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Gemini va ÚLTIMO entre los gratis y no primero: los dos Whisper devuelven además la
  // duración y el idioma medidos del audio —que es lo que después permite comparar la
  // transcripción contra la fuente— y Gemini no devuelve ninguno de los dos. Se usa
  // cuando los otros no pueden, que es para lo que se sumó.
  const kGemini = (() => { try { return env('GEMINI_API_KEY'); } catch { return ''; } })();
  if (kGemini) {
    try {
      const { texto, modelo } = await sttGemini(buf, mime, kGemini, hint);
      return { status: 'ok', transcript: texto, idioma: null, duracion_s: null, model: modelo, error: null };
    } catch (e) {
      errores.push(`gemini: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errores.push('gemini: sin GEMINI_API_KEY');
  }

  return { status: 'error', transcript: null, idioma: null, duracion_s: null, model: null, error: `ningún proveedor pudo transcribir — ${errores.join(' | ')}` };
}
