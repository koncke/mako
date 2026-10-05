// =============================================================================
// replay-sellado — cómo un lote entra, y cómo N lotes se vuelven UN objeto
// =============================================================================
// `lib/replay-contrato.ts` decide QUÉ se graba, qué cabe y cuándo vence. Este
// módulo decide la otra mitad, la que el contrato a propósito no toca: en qué
// FORMA viaja un lote, en qué forma se guarda, y qué hay exactamente adentro del
// `.jsonl.gz` que queda en el bucket.
//
// Vive aparte y lo importan TRES: el receptor (`app/api/track/replay`), el
// sellador (`lib/replay-ingesta.ts`) y —cuando exista— el reproductor, que tiene
// que poder leer el objeto sin volver a inventar el formato. Es la regla de la
// casa: si el formato del objeto se escribe dos veces, la segunda se queda vieja
// y el síntoma es una grabación que no se puede reproducir.
//
// ⚠️ SIN `server-only`, igual que el contrato, para que esto tenga test. Lo que
// hay que poder probar sin base de datos es justamente lo que decide: qué lote se
// acepta, cuántos eventos trae y qué se recorta cuando no entra. Importa
// `node:zlib`, así que ningún componente de navegador lo puede importar — y eso
// es la guarda, no un descuido.
//
// Lo que NO está acá: ninguna llamada a Supabase, a Storage ni a `fetch`.
// =============================================================================

import { gunzipSync, gzipSync } from 'node:zlib';
import { REPLAY_BEACON_MAX_BYTES, REPLAY_TOPE_BYTES } from './replay-contrato';

// ─────────────────────────────────────────────────────────────────────────────
// 1. LOS TOPES DE LA PUERTA — un lote gigante no puede tumbar la ruta
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Tope del CUERPO del POST, leído del `content-length` ANTES de parsear.
 *
 * ⚠️ Esto se chequea antes de `request.json()`, y no es prolijidad: parsear un
 * cuerpo de 50 MB es trabajo que ya se hizo cuando uno se da cuenta de que no lo
 * quería. Es la misma familia que los tres topes del entorno que AGENTS.md
 * documenta — el entorno tiene el suyo y el nuestro tiene que ser más chico, no
 * más grande.
 *
 * El número: un lote típico son ~17 kB (10 s a ~100 kB/min), el techo de
 * `sendBeacon` son 64 KiB, y en hexadecimal sobre el cable eso se duplica. 1 MiB
 * es 8× el peor lote legítimo imaginable y sigue siendo barato de tirar.
 */
export const REPLAY_CUERPO_MAX_BYTES = 1024 * 1024;

/**
 * Tope de UN lote, ya decodificado.
 *
 * Cuatro veces la cuota de `sendBeacon` (64 KiB): el grabador no puede mandar más
 * que eso al salir de la página, y por POST normal podría mandar un poco más si
 * acumuló. Más que esto no es un lote, es otra cosa.
 *
 * ⚠️ Y el tope de SESIÓN (`REPLAY_TOPE_BYTES`, 2 MiB) no cubre esto: un solo lote
 * de 1,9 MiB cabe en la sesión y aun así es un cuerpo que no se quiere parsear ni
 * guardar en una fila.
 */
export const REPLAY_LOTE_MAX_BYTES = 4 * REPLAY_BEACON_MAX_BYTES;

/**
 * Cuántos lotes puede tener UNA sesión.
 *
 * Con el tope de 10 minutos y un lote cada 10 s son ~60. El límite por cantidad
 * de eventos puede hacer más, así que 2.000 deja 33× de margen y a la vez acota
 * cuántas filas puede meter un visitante en el buffer caliente: sin esto, `n` es
 * un entero que el navegador elige y la clave primaria no tiene techo.
 */
export const REPLAY_LOTES_MAX = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// 2. `bytea` SOBRE EL CABLE — PostgREST quiere el hexadecimal de Postgres
// ─────────────────────────────────────────────────────────────────────────────
/**
 * El binario de un lote va a una columna `bytea`, y PostgREST la escribe y la lee
 * como el texto hexadecimal de Postgres.
 *
 * ⚠️ ESO DUPLICA EL TAMAÑO EN TRÁNSITO (dos caracteres por byte, contra el +33 %
 * de base64), y es el precio de guardar el cuerpo como binario en vez de como
 * texto —que es lo que la migración 0191 decide y argumenta—. Se paga una vez por
 * lote de ~17 kB entre nuestro server y la base, en la misma región; lo que NO se
 * paga es inflar un 33 % el cuerpo que queda guardado durante minutos, ni volver
 * a codificar al sellar.
 */
export const aBytea = (buf: Buffer): string => '\\x' + buf.toString('hex');

/** Lo que PostgREST devuelve de una `bytea`, de vuelta a bytes. `null` si no se entiende. */
export function deBytea(valor: unknown): Buffer | null {
  if (Buffer.isBuffer(valor)) return valor;
  if (typeof valor !== 'string') return null;
  // PostgREST entrega el hexadecimal con el prefijo de Postgres; según el driver
  // puede llegar con la barra escapada.
  let hex: string | null = null;
  if (valor.startsWith('\\\\x')) hex = valor.slice(3);
  else if (valor.startsWith('\\x')) hex = valor.slice(2);
  if (hex == null || !/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) return null;
  return Buffer.from(hex, 'hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LA PUERTA — qué lote se acepta, y por qué se rechaza el que no
// ─────────────────────────────────────────────────────────────────────────────
/** Por qué un lote no entró. Nunca un descarte mudo: el motivo se escribe. */
export type MotivoRechazo =
  | 'vacio'        // `e` no es una cadena con contenido
  | 'pesado'       // pasa REPLAY_LOTE_MAX_BYTES
  | 'base64'       // `z: 1` y el texto no es base64 legible
  | 'no_gzip'      // `z: 1` y los bytes no arrancan con la firma de gzip
  | 'no_json';     // `z: 0` y el texto no arranca como un arreglo JSON

export type LoteAceptado = { cuerpo: Buffer; z: 0 | 1 };

/**
 * Decodifica el `e` de un lote a los bytes que se van a GUARDAR.
 *
 * ⚠️ NO DESCOMPRIME, Y ESO ES LA DECISIÓN. Un `gunzip` de 17 kB en el camino
 * caliente de un beacon es trabajo que el visitante paga en latencia, y la
 * migración ya lo dice: «se guarda lo que llegó; el servidor NUNCA adivina». Lo
 * que sí se hace es mirar la FIRMA —dos bytes para gzip, un carácter para JSON—,
 * que es gratis y caza la basura obvia. La validación de verdad vive en el
 * sellador, que corre en un cron y ahí el tiempo no lo paga nadie.
 */
export function cuerpoDeLote(e: unknown, z: unknown): LoteAceptado | { rechazo: MotivoRechazo } {
  if (typeof e !== 'string' || !e.length) return { rechazo: 'vacio' };
  // ⚠️ ESTE `if` NO DECIDE QUÉ LOTE ENTRA: decide si se asigna medio mega de
  // Buffer antes de tirarlo. El chequeo de abajo —después de decodificar— es
  // SIEMPRE más estricto (con `z:0` éste dispara a los 524.288 bytes y el otro a
  // los 262.144; con `z:1`, a 393.216 contra 262.144), así que sacarlo no cambia
  // ni un veredicto y ningún test lo puede ver. Queda, y queda dicho que es un
  // guard de COSTO y no de resultado — el día que alguien lo borre «porque está
  // duplicado», lo que se pierde es no parsear basura.
  if (e.length > REPLAY_LOTE_MAX_BYTES * 2) return { rechazo: 'pesado' };

  if (z === 1) {
    if (!/^[A-Za-z0-9+/=\r\n]+$/.test(e)) return { rechazo: 'base64' };
    const cuerpo = Buffer.from(e, 'base64');
    if (!cuerpo.length) return { rechazo: 'base64' };
    if (cuerpo.length > REPLAY_LOTE_MAX_BYTES) return { rechazo: 'pesado' };
    // 0x1f 0x8b es la firma de gzip. Un cuerpo que dice venir comprimido y no la
    // trae es un cuerpo que el sellador no va a poder abrir — mejor rechazarlo
    // acá que guardarlo y descubrirlo cuando ya ocupó lugar.
    if (cuerpo[0] !== 0x1f || cuerpo[1] !== 0x8b) return { rechazo: 'no_gzip' };
    return { cuerpo, z: 1 };
  }

  const cuerpo = Buffer.from(e, 'utf8');
  if (cuerpo.length > REPLAY_LOTE_MAX_BYTES) return { rechazo: 'pesado' };
  if (e.trimStart()[0] !== '[') return { rechazo: 'no_json' };
  return { cuerpo, z: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. EL SELLADO — N lotes a UN objeto
// ─────────────────────────────────────────────────────────────────────────────
/**
 * EL FORMATO DEL OBJETO, que es lo único que el reproductor necesita saber:
 *
 *   · **una línea por LOTE**, en orden de `n`, separadas por un salto de línea;
 *   · cada línea es el arreglo JSON de eventos de rrweb de ese lote;
 *   · todo comprimido con gzip, guardado en `<ws>/<YYYY-MM-DD>/<sesion>.jsonl.gz`.
 *
 * Por qué una línea por lote y no un único arreglo gigante: el reproductor puede
 * leer de a pedazos y, sobre todo, **un lote ilegible se tira solo** sin arruinar
 * la sesión entera. Un solo arreglo obliga a parsear 2 MiB para saber si el byte
 * 12 está mal.
 */
// La extensión NO se declara acá: la arma `rutaDeSesion` en el contrato, y un
// segundo lugar que diga `.jsonl.gz` es un segundo lugar que se queda viejo.

/**
 * El texto de un lote guardado, descomprimido si hace falta.
 *
 * `null` cuando el cuerpo no se puede abrir, que es un dato y no un error: el
 * sellador lo CUENTA y lo deja escrito en vez de tirar la sesión.
 */
export function textoDeLote(cuerpo: Buffer, z: 0 | 1): string | null {
  try {
    const bytes = z === 1 ? gunzipSync(cuerpo) : cuerpo;
    const txt = bytes.toString('utf8');
    return txt.trim() ? txt : null;
  } catch {
    return null;
  }
}

/**
 * Una línea de JSONL a partir del texto de un lote, con su cuenta de eventos.
 *
 * ⚠️ PARSEA, Y A PROPÓSITO. Cuesta recorrer los bytes una vez más y compra tres
 * cosas que no se consiguen de otra forma: que la línea sea JSON válido (una
 * línea rota deja la sesión sin reproducir y el reproductor no tiene de dónde
 * sacar el motivo), que no tenga un salto de línea literal adentro —que partiría
 * el JSONL en dos líneas inválidas—, y el NÚMERO DE EVENTOS, que es la mitad del
 * piso (`motivoDeDescarte`) y que no viaja en el lote. Se paga una vez por sesión
 * y en un cron, donde el tiempo no lo paga nadie.
 */
export function lineaDeLote(texto: string): { linea: string; eventos: number } | null {
  let x: unknown;
  try { x = JSON.parse(texto); } catch { return null; }
  if (!Array.isArray(x)) return null;
  if (!x.length) return { linea: '[]', eventos: 0 };
  return { linea: JSON.stringify(x), eventos: x.length };
}

export type Sellado = {
  gz: Buffer;
  /** Líneas que quedaron adentro del objeto. */
  lineas: number;
  /** Líneas que NO entraron por el tope de bytes. 0 es lo normal. */
  recortadas: number;
  eventos: number;
  /** Peso del objeto, que es lo que de verdad ocupa en el bucket. */
  bytes: number;
};

/**
 * Arma el objeto de una sesión y lo recorta si no entra en el tope.
 *
 * ⚠️ EL RECORTE SACA DEL FINAL, nunca del principio. El primer lote de rrweb es
 * el `FullSnapshot` —la foto del DOM entero— y sin él los eventos siguientes no
 * se pueden aplicar a nada: una grabación sin su primera línea no es una
 * grabación corta, es ninguna. Se pierde el final, que es lo que el `corte`
 * declara.
 *
 * Y el recorte es proporcional, no de a una línea: re-comprimir 2 MiB una vez por
 * línea sobrante es cuadrático, y el tope se cruza por poco en el caso normal.
 */
export function armarSellado(lineas: string[], eventos: number[], tope = REPLAY_TOPE_BYTES): Sellado {
  let n = lineas.length;
  let recortadas = 0;
  for (let vuelta = 0; vuelta < 24; vuelta++) {
    const gz = gzipSync(Buffer.from(lineas.slice(0, n).join('\n') + '\n', 'utf8'), { level: 9 });
    if (gz.length <= tope || n <= 1) {
      return {
        gz,
        lineas: n,
        recortadas,
        eventos: eventos.slice(0, n).reduce((a, b) => a + b, 0),
        bytes: gz.length,
      };
    }
    // Cuánto sobra, en proporción, más un 5 % de margen: con el tope cruzado por
    // poco esto saca una o dos líneas y termina en la segunda vuelta.
    const sobra = Math.max(1, Math.ceil(n * (1 - tope / gz.length) + n * 0.05));
    n = Math.max(1, n - sobra);
    recortadas = lineas.length - n;
  }
  // 24 vueltas sin converger: se queda con la primera línea, que es la única
  // imprescindible. No puede pasar con el recorte proporcional, y si pasa es
  // mejor una grabación de un cuadro que ninguna.
  const gz = gzipSync(Buffer.from((lineas[0] ?? '[]') + '\n', 'utf8'), { level: 9 });
  return { gz, lineas: 1, recortadas: lineas.length - 1, eventos: eventos[0] ?? 0, bytes: gz.length };
}

/** Las líneas de un objeto sellado. Lo usa el reproductor. */
export function leerSellado(gz: Buffer): string[] {
  return gunzipSync(gz).toString('utf8').split('\n').filter((l) => l.trim().length > 0);
}

/**
 * Los eventos de un objeto sellado, en orden y aplanados.
 *
 * Una línea ilegible se SALTEA y no tira la sesión — es el motivo por el que el
 * objeto es JSONL y no un único arreglo.
 */
export function eventosDeSellado(gz: Buffer): unknown[] {
  const out: unknown[] = [];
  for (const linea of leerSellado(gz)) {
    try {
      const x: unknown = JSON.parse(linea);
      if (Array.isArray(x)) out.push(...x);
    } catch { /* una línea rota no se lleva la grabación */ }
  }
  return out;
}
