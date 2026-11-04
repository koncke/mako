import 'server-only';

// =============================================================================
// spy-caricatura-flow — dibujar la cara de un competidor que NO es referente (3/11/2026)
// =============================================================================
// Martín: «que ejecutes el proceso de crear esa caricatura con cada nuevo competidor», y el 2/11
// confirmó lo que faltaba saber: **el puente de Google Flow corre sobre SU cuenta y aprueba
// generar con ella**.
//
// ⚠️ NO SE LLAMA A GOOGLE DESDE EL SERVIDOR. Hay una COLA (`lib/flow-cola.ts`): la app encola un
// trabajo y el PUENTE —el navegador de Martín— lo toma y lo ejecuta. Por eso nada de esto es
// sincrónico y por eso `caraDelCompetidor` puede devolver `''` la primera vez: encoló la subida y
// hay que volver en unos segundos. El molde es `app/ai-avatar/actions.ts:171`, que hace lo mismo
// para el look de un avatar.
//
// ⚠️ LOS DOS PASOS, EN ORDEN, y no se pueden juntar:
//   1. `subir_imagen` — la foto tiene que existir DENTRO de Flow para poder usarse como referencia.
//      Lo que devuelve es su `mediaId`.
//   2. `generar_imagen` — recién ahí, con ese `mediaId` como cara.
//
// ⚠️ QUIÉN LA NECESITA: sólo el competidor que NO es referente. Si es uno de los 22 que ya están
// dibujados, la tarjeta usa esa caricatura y acá no hay nada que hacer (`lib/spy-caricatura.ts`).
// =============================================================================

import { randomUUID } from 'node:crypto';
import { encolar } from './flow-cola';
import { pedidoImagenInterfaz, pedidoSubidaInterfaz, rutaDeSubida } from './flow-interfaz';
import { getTenantDb } from './workspace';
import { referenteDeCompetidor } from './spy-caricatura';

/**
 * El prompt aprobado, literal, de `docs/hallazgos-ops-center.md`.
 *
 * ⚠️ SALIÓ DE OCHO VUELTAS DE PRUEBA Y ERROR con Martín y estuvo a punto de perderse: vivía sólo
 * dentro de las llamadas a la herramienta y hubo que rastrear un transcript de 173 MB para
 * recuperarlo. No se «mejora» sin volver a pasar por él.
 *
 * ⚠️ `rasgos` es LO ÚNICO que cambia por persona, y es lo que evita que dos caricaturas salgan
 * indistinguibles —ya pasó con Marcos Razzetti y Víctor Heras—. Sin rasgos, mejor no generar.
 */
export function promptDeCaricatura(rasgos: string, prenda = 'a plain crew-neck t-shirt', fondo = 'soft neutral'): string {
  return [
    'Collectible vinyl toy caricature figure of the man in the reference photo — glossy toy-figurine',
    'look like a Funko/Pop Mart collectible. HEAD AND SHOULDERS ONLY, tightly cropped, centered, facing',
    'forward. Oversized head but keeping HIS OWN face shape — do not widen or round out the face, do not',
    'puff up the cheeks. Eyes NORMAL SIZE and normally proportioned, open and bright, glossy with a small',
    `catchlight — NOT oversized, NOT anime. Make him unmistakable: ${rasgos}. Wearing ${prenda}. Smooth`,
    `glossy vinyl surfaces, soft studio product lighting with gentle reflections. Plain ${fondo}`,
    'background. No text, no logos, no brand marks anywhere.',
  ].join(' ');
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
/** La clave con la que se encuentra después el trabajo de subida de ESTE competidor. */
const claveDeSubida = (competidorId: number): string => `spy:${competidorId}`;

/**
 * El `mediaId` de la cara del competidor DENTRO de Flow. `''` mientras no esté.
 *
 * Si todavía no se subió, encola la subida y devuelve `''`: quien llama vuelve a intentar más
 * tarde. Es el mismo contrato que `caraDeFoto` del AI Avatar.
 */
export async function caraDelCompetidor(competidorId: number, avatarUrl: string): Promise<string> {
  const url = str(avatarUrl);
  if (!url || !/^https:\/\//i.test(url)) return '';
  const fotoId = claveDeSubida(competidorId);
  const db = await getTenantDb();

  const { data } = await db.from('flow_trabajos')
    .select('id, estado, resultado').eq('tipo', 'subir_imagen')
    .filter('pedido->>fotoId', 'eq', fotoId).order('id', { ascending: false }).limit(3);

  for (const t of data ?? []) {
    if (str(t.estado) !== 'listo') continue;
    // ⚠️ En la respuesta de una SUBIDA el id viene en `media.name`, y `media` es un OBJETO —no un
    // array, al revés que en las de generación—. Por eso no sirve `extraerMediaId`.
    const res = (t.resultado ?? {}) as Record<string, unknown>;
    const media = (res.media ?? {}) as Record<string, unknown>;
    const id = str(media.name);
    if (id) return id;
  }
  // Con una en vuelo se espera a ésa: encolar otra subiría la misma foto dos veces.
  if ((data ?? []).some((t) => ['pendiente', 'tomado'].includes(str(t.estado)))) return '';

  const r = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: 'no-store' }).catch(() => null);
  if (!r || !r.ok) return '';
  const b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
  await encolar('subir_imagen', pedidoSubidaInterfaz({
    imagenB64: b64, mime: /\.png($|\?)/i.test(url) ? 'image/png' : 'image/jpeg', fotoId,
  }));
  return '';
}

/**
 * Pide la caricatura. Devuelve el id del trabajo, o `null` si todavía no se puede.
 *
 * ⚠️ NO VA ADENTRO DE «Revisar ahora». Generar una imagen tarda mucho más que bajarla, y esa
 * función ya casi se pasa del tiempo de la ruta: va como trabajo APARTE, después de crear al
 * competidor, y la tarjeta muestra su foto mientras tanto.
 *
 * ⚠️ Y NO SE GENERA PARA UN REFERENTE: ésos ya están dibujados y aprobados.
 */
export async function pedirCaricatura(c: {
  id: number; nombre: string; avatar: string | null; instagram: string | null; youtube_id: string | null;
}, rasgos: string): Promise<number | null> {
  if (referenteDeCompetidor(c)) return null;
  if (!c.avatar || !str(rasgos)) return null;
  const cara = await caraDelCompetidor(c.id, c.avatar);
  if (!cara) return null;
  return encolar('generar_imagen', pedidoImagenInterfaz({
    prompt: promptDeCaricatura(rasgos),
    cara,
    // Cuadrada, como las de los referentes: la tarjeta de Spy es 1:1.
    vertical: false,
    // ⚠️ `rutaDeSubida`, NO una ruta propia (4/11/2026). La cola sólo le firma la subida al puente
    // si la ruta pasa `RUTA_SUBIDA` (lib/flow-cola.ts, `firmarSubidas`): con `spy/caricaturas/…`
    // el puente no la subía, y lo único que volvía era la url de Flow, que vence en una hora. Con
    // ésta la sube a nuestro Storage, y `avanzarCaricatura` (lib/spy-caricatura-auto.ts) la copia
    // al bucket de Spy, donde ya viven su foto y las miniaturas de sus piezas (migración 0361).
    ruta: rutaDeSubida('spy-caricatura', 'escena', 1, randomUUID()),
  }));
}
