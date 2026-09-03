import 'server-only';

// =============================================================================
// elevenlabs — clonar la voz del cliente, y pisar con ella la voz de Flow
// =============================================================================
//
// ── Por qué existe, y por qué recién ahora ─────────────────────────────────
//
// Flow genera el clip CON voz, y esa voz es un preset de Google. Su propia doc
// cierra la puerta a arreglarlo ahí: «Reference Audio Upload: **Not supported.**
// This API does not accept custom audio uploads». Así que el orden del pipeline
// es fijo y no es una preferencia:
//
//     Flow genera con voz preset → ElevenLabs STS pisa la voz → ffmpeg re-muxea
//
// ⚠️ Y EL BLOQUE ACENTO SIGUE SIENDO OBLIGATORIO en el prompt de video, aunque
// la voz se reemplace: el STS conserva la ENTONACIÓN del clip original, así que
// la boca tiene que estar articulando el idioma correcto o los labios no cierran.
// Lo que deja de hacer falta es el bloque de edad y género.
//
// ── DE QUIÉN ES LA KEY: DE LA PLATAFORMA, Y NO ES UN DETALLE ───────────────
//
// `credWs(clave)` a secas resuelve por el workspace en curso, y su última línea
// es `if (w === OWNER_WS && esValorReal(process.env[clave])) return …`. `OWNER_WS`
// vale 1 y el 1 es **Mauricio, un cliente**: leer así entregaría la key de la
// plataforma dentro del workspace de un cliente sin que nada falle.
//
// ⚠️ ESO CAMBIÓ: desde el 02/09/2026 `elevenKey()` resuelve la key DEL CLIENTE.
// Lo de abajo queda porque explica por qué NO alcanza con `credWs` a secas.
// Antes resolvía contra `wsSuperAdmin()`, y hay un test
// que falla si alguien la llama con un solo argumento.
//
// Y la razón de producto, que es la que decide: el repo ya tiene escrito que
// «cualquier diseño de imagen/video que asuma la key del cliente está muerto
// antes de empezar — el eje es cupo medido dentro del plan, no BYOK». La voz es
// MEDIOS (US$0,045/min contra US$0,00067 del texto: 67× y en grupos distintos a
// propósito). Además el plan gratis de ElevenLabs es NO COMERCIAL, así que una
// key de cliente en su free tier produce audio que no se puede poner en un
// anuncio.
//
// ⚠️ ESO SE DIO VUELTA EL 02/09/2026: AHORA ES BYOK.
//
// Las dos razones de arriba siguen siendo ciertas, y una de ellas es la que lo
// invirtió: si la voz cuesta 67 veces el texto, la casa no la puede costear para
// todos. El dueño: «haz que cada cliente traiga su api de eleven». Así que el
// costo lo paga quien lo usa, y `elevenKey()` resuelve la key DEL CLIENTE.
//
// Lo que NO cambió y por eso sigue escrito arriba: el plan gratis de ElevenLabs
// es NO COMERCIAL. Ahora es una advertencia PARA EL CLIENTE, y vive en el
// tutorial del campo — es lo único de todo esto que no se puede descubrir usando
// el producto, porque no falla: sale bien.
//
// ⚠️ Los clones viven en la cuenta de quien pone la key, o sea la del cliente. Un
// workspace borrado deja un clon huérfano EN SU PROPIA CUENTA si nadie lo borra —
// por eso `borrarVoz` existe y el reset lo llama. Con BYOK eso pasó de ser un
// costo nuestro a ser prolijidad en la cuenta ajena, pero se sigue haciendo.
//
// ── Medido el 02/09/2026 contra la cuenta real ────────────────────────────
//
// La key de la plataforma está RESTRINGIDA y eso cambia qué se puede preguntar:
//
//     GET /v1/user/subscription → 401 «missing the permission user_read»
//     GET /v1/models            → 200 con la lista VACÍA
//     GET /v1/voices            → 200 · 21 premade + 7 clonadas + 1 professional
//
// ⚠️ El del medio es la trampa: **200 con una lista vacía no es «no hay
// modelos»**. Casi se concluye que la cuenta no puede hacer voice conversion,
// cuando lo que pasa es que la key no tiene `models_read`. Cero resultados es una
// respuesta, no un hecho.

import { credDelCliente } from '@/lib/credenciales';
import { clasificarEleven as clasificar, elSondeoDicePuede, pareceAudio, type FalloEleven } from './elevenlabs-fallo';
import { wsSuperAdmin } from '@/lib/workspace';

const API = 'https://api.elevenlabs.io/v1';

/**
 * El único modelo probado para voice conversion en español.
 *
 * No se comparó contra ningún otro: es el que está medido y por eso es el que
 * viaja. Cambiarlo «para modernizar» es exactamente cómo se rompe algo que sólo
 * se nota al escuchar.
 */
export const MODELO_STS = 'eleven_multilingual_sts_v2';

/**
 * El de texto a voz, para que el clon DIGA una línea en el onboarding.
 *
 * ⚠️ NO es el mismo que el de conversión y no se pueden intercambiar: los
 * `_sts_` sólo aceptan audio de entrada. Mandar el de STS a `/text-to-speech`
 * devuelve un error de modelo que se lee como un problema de la voz.
 */
export const MODELO_TTS = 'eleven_multilingual_v2';

/**
 * ⚠️ ESTOS DOS NÚMEROS NO ESTÁN MEDIDOS, y conviene que quede escrito.
 *
 * En el repo conviven tres juegos: el script de producción usa 0.45/0.85, el
 * documento dice 0.55/0.75 «porque sonaba robótica», y el único barrido que se
 * hizo probó 0,00 · 0,35 · 0,60 · 0,85 — o sea que **ninguno de los dos que se
 * pelean por ser el de producción estuvo en la medición**.
 *
 * Y el veredicto de ese barrido fue que `stability` NO es la palanca: ninguno de
 * los cuatro valores bajó del doble del objetivo. Lo que decide la calidad es de
 * qué MATERIAL se clonó. Van los del documento por ser los últimos elegidos a
 * oído, anotados como lo que son.
 */
export const AJUSTES_STS = { stability: 0.55, similarity_boost: 0.75 } as const;

/**
 * El formato de salida. NO es opcional aunque la API tenga default: el pipeline
 * de montaje consume `sts-N.mp3` y el resto trabaja a 48 kHz mono.
 */
export const FORMATO_STS = 'mp3_44100_192';

// El tipo y la clasificación viven en `elevenlabs-fallo.ts`, SIN `server-only`,
// para que se puedan probar sin una cuenta: es donde está lo único que puede
// mandar a alguien a pagar una factura que está al día.
export type { FalloEleven } from './elevenlabs-fallo';

export type Salida<T> =
  | { ok: true; valor: T }
  | { ok: false; motivo: FalloEleven; error: string };

/**
 * La key de ElevenLabs DEL CLIENTE que está mirando.
 *
 * ⚠️ ERA LA DE LA PLATAFORMA HASTA EL 02/09/2026. El dueño lo dio vuelta porque
 * la voz no se puede costear para todos: «haz que cada cliente traiga su api de
 * eleven». Con eso, un cliente sin key no clona — y eso es un estado legítimo:
 * el paso de voz se salta y el anuncio se monta con la voz que genera Flow.
 *
 * ⚠️ ES `credDelCliente` Y NO `credWs`, Y LA DIFERENCIA ES UNA SOLA LÍNEA SUYA.
 * `credWs` cae a `process.env[clave]` cuando el workspace es `OWNER_WS`, que es
 * MAURICIO: un cliente. Usarla acá le entregaría la cuenta de MaKo a él solo,
 * facturada a la casa, y sin fallar — funcionaría. Hay un test que falla si esta
 * llamada vuelve a ser `credWs`.
 *
 * ⚠️ Y NO HAY FALLBACK a la key de la casa a propósito. Un fallback silencioso es
 * exactamente «seguimos pagando y nadie lo ve», que es lo que este cambio vino a
 * cerrar. Sin key se apaga la feature y la pantalla dice cómo encenderla.
 */
/**
 * ⚠️ UNA SOLA VEZ, Y NO SEIS. Este texto estaba escrito a mano en las seis
 * salidas de «no hay key», y las seis decían «cargada en la plataforma» — que
 * desde que la voz es BYOK apunta al lugar equivocado: manda a esperar que MaKo
 * arregle algo que se arregla en la pantalla del propio cliente.
 *
 * El texto completo, con el link, vive en `textoEleven('sin_key')`. Esto es el
 * resumen que viaja en el campo `error` para quien no lo use todavía.
 */
const SIN_KEY = 'Falta conectar tu cuenta de ElevenLabs: la voz clonada corre con tu propia key.';

export async function elevenKey(): Promise<string | null> {
  return credDelCliente('ELEVENLABS_API_KEY');
}
async function pedir(ruta: string, init: RequestInit, key: string): Promise<Response> {
  return fetch(`${API}${ruta}`, {
    ...init,
    headers: { 'xi-api-key': key, ...(init.headers as Record<string, string> | undefined) },
  });
}

// ── El preflight ────────────────────────────────────────────────────────────

/**
 * ¿Esta cuenta puede clonar Y convertir, HOY?
 *
 * ⚠️ EJERCITA LAS DOS OPERACIONES REALES, Y NO GASTA NADA. La técnica: se manda
 * el pedido a propósito SIN cuerpo. Si la key no tiene permiso, ElevenLabs
 * contesta 401 antes de mirar el cuerpo; si lo tiene, contesta **422 “Field
 * required”**. O sea que el permiso se comprueba con la operación de verdad, sin
 * crear una voz ni consumir un solo carácter de cuota.
 *
 * Por qué hace falta tanto: los cuatro caminos baratos dan VERDE sobre una
 * cuenta que no puede generar. Medido el 22/08/2026 — `GET /v1/voices` devolvía
 * 200 con las cinco voces clonadas mientras la suscripción estaba impaga, y
 * `POST /v1/voices/add` también daba 200: **crear un clon funciona, convertir
 * no.** Escribir metadatos y consumir cuota son dos permisos distintos y sólo
 * uno estaba cortado.
 *
 * Es la regla de la casa: el preflight tiene que ejercitar la operación que se
 * va a usar, no una barata del mismo dominio.
 */
export async function preflightEleven(): Promise<Salida<{ clonar: boolean; convertir: boolean }>> {
  const key = await elevenKey();
  if (!key) return { ok: false, motivo: 'sin_key', error: SIN_KEY };

  // Hace falta UNA voz cualquiera para armar la ruta del STS. Sirve una premade:
  // así el preflight no depende de que el clon del cliente ya exista, que es el
  // huevo y la gallina que hace inútil a un preflight.
  const rv = await pedir('/voices', { headers: { accept: 'application/json' } }, key);
  if (!rv.ok) {
    const c = clasificar(rv.status, await rv.text());
    return { ok: false, ...c };
  }
  const voces = ((await rv.json()) as { voices?: { voice_id: string }[] }).voices ?? [];
  const alguna = voces[0]?.voice_id;
  if (!alguna) {
    return { ok: false, motivo: 'proveedor', error: 'La cuenta de ElevenLabs no tiene ninguna voz con la que probar.' };
  }

  const [rc, rs] = await Promise.all([
    pedir('/voices/add', { method: 'POST', body: new FormData() }, key),
    pedir(`/speech-to-speech/${alguna}`, { method: 'POST', body: new FormData() }, key),
  ]);

  // 422 = «te falta el cuerpo», o sea que el permiso está. Cualquier otra cosa se
  // clasifica y se devuelve con su motivo: es lo que distingue «falta permiso» de
  // «hay que pagar la factura», que mandan a lugares opuestos.
  const clonar = elSondeoDicePuede(rc.status);
  const convertir = elSondeoDicePuede(rs.status);
  if (clonar && convertir) return { ok: true, valor: { clonar, convertir } };

  const mala = !convertir ? rs : rc;
  const c = clasificar(mala.status, await mala.text());
  return { ok: false, ...c };
}

// ── Clonar ──────────────────────────────────────────────────────────────────

export type MuestraVoz = { nombre: string; mime: string; buf: Buffer };

/**
 * Crea el clon de la voz del cliente y devuelve su `voice_id`.
 *
 * ⚠️ LO QUE DECIDE LA CALIDAD ES EL MATERIAL, NO LOS PARÁMETROS. Está medido en
 * el repo y es contraintuitivo: un clon hecho con material CONVERSACIONAL sale
 * ~30 Hz por debajo del tono real y suena a lectura. El que gana es el que se
 * clona de la persona **en registro de anuncio, actuando, con CTA**. Por eso el
 * copy del paso pide eso con todas las letras: pedir «un audio tuyo» produce
 * material conversacional y el clon sale peor sin que nadie sepa por qué.
 */
export async function clonarVoz(
  nombre: string,
  muestras: MuestraVoz[],
  descripcion = '',
): Promise<Salida<{ voiceId: string }>> {
  const key = await elevenKey();
  if (!key) return { ok: false, motivo: 'sin_key', error: SIN_KEY };
  if (!muestras.length) return { ok: false, motivo: 'nuestra', error: 'No hay ningún audio con el que clonar.' };

  const fd = new FormData();
  fd.append('name', nombre.slice(0, 100));
  if (descripcion) fd.append('description', descripcion.slice(0, 500));
  for (const m of muestras) {
    fd.append('files', new Blob([new Uint8Array(m.buf)], { type: m.mime || 'audio/mpeg' }), m.nombre || 'muestra.mp3');
  }

  const r = await pedir('/voices/add', { method: 'POST', body: fd }, key);
  const txt = await r.text();
  if (!r.ok) return { ok: false, ...clasificar(r.status, txt) };

  let voiceId = '';
  try { voiceId = String((JSON.parse(txt) as { voice_id?: unknown }).voice_id ?? ''); } catch { /* ver abajo */ }
  if (!voiceId) {
    // ⚠️ Un 200 sin `voice_id` es un fallo, y callarlo dejaría guardado un clon
    // vacío que recién se descubre al convertir — después de gastar el pipeline.
    return { ok: false, motivo: 'proveedor', error: 'ElevenLabs aceptó el clon pero no devolvió su identificador.' };
  }
  return { ok: true, valor: { voiceId } };
}

/**
 * ¿La voz sigue existiendo en la cuenta?
 *
 * ⚠️ SE PREGUNTA ANTES DE GASTAR, y no es prolijidad: un `voice_id` guardado
 * puede haber sido borrado a mano en el panel de ElevenLabs, y entonces el STS
 * falla con `voice_not_found` **después** de que el pipeline ya bajó los clips,
 * los aceleró y los demuxeó. La verificación cuesta una llamada de lectura.
 */
export async function verificarVoz(voiceId: string): Promise<Salida<{ nombre: string }>> {
  const key = await elevenKey();
  if (!key) return { ok: false, motivo: 'sin_key', error: SIN_KEY };
  if (!voiceId) return { ok: false, motivo: 'voz_muerta', error: 'Este workspace no tiene ninguna voz clonada.' };

  const r = await pedir(`/voices/${encodeURIComponent(voiceId)}`, { headers: { accept: 'application/json' } }, key);
  const txt = await r.text();
  if (r.status === 404) {
    return { ok: false, motivo: 'voz_muerta', error: 'La voz clonada ya no existe en ElevenLabs. Hay que volver a clonarla.' };
  }
  if (!r.ok) return { ok: false, ...clasificar(r.status, txt) };
  let nombre = '';
  try { nombre = String((JSON.parse(txt) as { name?: unknown }).name ?? ''); } catch { /* da igual el nombre */ }
  return { ok: true, valor: { nombre } };
}

/**
 * Borra el clon de la cuenta de la plataforma.
 *
 * ⚠️ EXISTE PARA QUE UN WORKSPACE BORRADO NO DEJE UN HUÉRFANO. El reset vacía
 * `app_settings` y el bucket —o sea la muestra Y el `voice_id`—, y sin esta
 * llamada el clon se queda en la cuenta de la plataforma para siempre ocupando
 * un slot de voz, que es un techo de cuántos clientes entran.
 */
export async function borrarVoz(voiceId: string): Promise<Salida<true>> {
  const key = await elevenKey();
  if (!key) return { ok: false, motivo: 'sin_key', error: SIN_KEY };
  if (!voiceId) return { ok: true, valor: true };
  const r = await pedir(`/voices/${encodeURIComponent(voiceId)}`, { method: 'DELETE' }, key);
  // Un 404 es el resultado buscado: ya no está.
  if (r.ok || r.status === 404) return { ok: true, valor: true };
  return { ok: false, ...clasificar(r.status, await r.text()) };
}

// ── Hablar ──────────────────────────────────────────────────────────────────

/**
 * Que la voz clonada DIGA una línea. Devuelve el mp3.
 *
 * ⚠️ ES LA ÚNICA FORMA DE COMPROBAR UN CLON, y por eso existe. Hasta acá el
 * onboarding decía «tu voz está clonada» con un tilde: una afirmación que nadie
 * puede desmentir hasta que sale el primer anuncio, tres pasos y varios créditos
 * después. Escucharse es la prueba, y el repo ya tiene la regla escrita para el
 * paso de conectar — se cierra con evidencia, no con una credencial guardada.
 *
 * Y lo que se oye es representativo: el repo midió el MISMO clon por los dos
 * motores y dio la misma banda de tono —STS 114-133 Hz, TTS 118-131 Hz—, así que
 * una línea por texto suena como va a sonar el anuncio, que va por conversión.
 *
 * ⚠️ Es TEXT-to-speech y no speech-to-speech: acá no hay audio de entrada que
 * convertir, hay una frase escrita. Son dos motores distintos del mismo clon.
 */
export async function decirConVoz(
  voiceId: string,
  texto: string,
): Promise<Salida<{ mp3: Buffer }>> {
  const key = await elevenKey();
  if (!key) return { ok: false, motivo: 'sin_key', error: SIN_KEY };
  if (!voiceId) return { ok: false, motivo: 'voz_muerta', error: 'Todavía no clonaste tu voz.' };

  // ⚠️ EL TOPE ES DE CUOTA, NO DE PROLIJIDAD. Esto se cobra por carácter y corre
  // en un onboarding, o sea en el momento en que más gente lo toca. Una frase de
  // anuncio son ~120 caracteres; 400 deja aire de sobra y pone un techo a lo que
  // puede costar un click.
  const linea = (texto || '').trim().slice(0, 400);
  if (!linea) return { ok: false, motivo: 'nuestra', error: 'No hay ninguna línea que decir.' };

  const r = await pedir(
    `/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${FORMATO_STS}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: linea,
        model_id: MODELO_TTS,
        voice_settings: AJUSTES_STS,
      }),
    },
    key,
  );
  if (!r.ok) return { ok: false, ...clasificar(r.status, await r.text()) };

  const buf = Buffer.from(await r.arrayBuffer());
  // El mismo guard que la conversión: un 200 puede traer el error adentro, y acá
  // el cuerpo se convierte en un <audio> que no suena y no dice por qué.
  if (!pareceAudio(buf.length)) {
    const asTexto = buf.toString('utf8').slice(0, 300);
    return {
      ok: false,
      motivo: /"detail"/.test(asTexto) ? clasificar(200, asTexto).motivo : 'proveedor',
      error: `ElevenLabs devolvió ${buf.length} bytes en vez de audio: ${asTexto.slice(0, 160)}`,
    };
  }
  return { ok: true, valor: { mp3: buf } };
}

// ── Convertir ───────────────────────────────────────────────────────────────

/**
 * Pisa la voz de un audio con la voz clonada, conservando su entonación.
 *
 * Devuelve el mp3 crudo. Quien llama lo escribe donde el pipeline lo espera.
 *
 * ⚠️ EL DESFASE DE LABIOS NO ESTÁ GARANTIZADO, y el repo tiene las dos mitades
 * medidas: una corrida dio 0 ms de desfase mediano sobre 100 s, y otra tanda de
 * tres corridas IDÉNTICAS sobre el mismo audio dio dos con un tramo corrido
 * 290-310 ms y una limpia. O sea que no es una propiedad del STS: es un dato por
 * corrida, y hay que medirlo con correlación cruzada de la envolvente de energía
 * —nunca con los timestamps de un transcriptor, que ya dieron 840 ms de desfase
 * falso—.
 *
 * Esa verificación vive en el worker, que es el único lugar con ffmpeg.
 */
export async function convertirVoz(
  voiceId: string,
  audio: Buffer,
  nombreArchivo = 'toma.wav',
  mime = 'audio/wav',
): Promise<Salida<{ mp3: Buffer }>> {
  const key = await elevenKey();
  if (!key) return { ok: false, motivo: 'sin_key', error: SIN_KEY };
  if (!voiceId) return { ok: false, motivo: 'voz_muerta', error: 'Este workspace no tiene ninguna voz clonada.' };

  const fd = new FormData();
  fd.append('audio', new Blob([new Uint8Array(audio)], { type: mime }), nombreArchivo);
  fd.append('model_id', MODELO_STS);
  fd.append('voice_settings', JSON.stringify(AJUSTES_STS));
  fd.append('remove_background_noise', 'true');

  const r = await pedir(
    `/speech-to-speech/${encodeURIComponent(voiceId)}?output_format=${FORMATO_STS}`,
    { method: 'POST', body: fd },
    key,
  );
  if (!r.ok) return { ok: false, ...clasificar(r.status, await r.text()) };

  const buf = Buffer.from(await r.arrayBuffer());
  // ⚠️ UN 200 PUEDE TRAER EL FALLO ADENTRO, y acá el modo de falla es peor que un
  // error: el cuerpo se escribe en `sts-N.mp3` y ffmpeg revienta tres etapas
  // después con un mensaje sobre el formato. Un JSON de error pesa cientos de
  // bytes; un segundo de mp3 a 192 kbps pesa ~24 KB.
  if (!pareceAudio(buf.length)) {
    const asTexto = buf.toString('utf8').slice(0, 300);
    return {
      ok: false,
      motivo: /"detail"/.test(asTexto) ? clasificar(200, asTexto).motivo : 'proveedor',
      error: `ElevenLabs devolvió ${buf.length} bytes en vez de audio: ${asTexto.slice(0, 160)}`,
    };
  }
  return { ok: true, valor: { mp3: buf } };
}
