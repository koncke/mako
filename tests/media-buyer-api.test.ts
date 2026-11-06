// =============================================================================
// Todo el Media Buyer se usa por la API de MaKo
// =============================================================================
// Martín, 25/10/2026: «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API». Lo que hace
// la pantalla /ads-manager pasa por /api/media-buyer (una `op` por botón); cada `op` tiene acá la operación de la API
// que hace lo mismo. Un botón nuevo sin su operación, o un ajuste nuevo de la config que la API no puede cambiar, rompe
// este test hasta que alguien lo sume (o lo anote en FALTA, con el porqué).
// Correr: node --import tsx --test tests/media-buyer-api.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { porId } from '../lib/api-mako/registro';
import { RUTAS_REST } from '../lib/api-mako/rest';
import { CONFIG_POR_DEFECTO } from '../lib/media-buyer/tipos';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
// flujo.ts es `server-only`: su lista se lee del fuente.
const NO_EN_FLUJOS = new Set([...(leer('lib/api-mako/flujo.ts').match(/export const NO_EN_FLUJOS[^;]*;/)?.[0] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));

/** Cada `op` de /api/media-buyer → las operaciones de la API que hacen lo mismo. */
const DE_LA_PANTALLA: Record<string, string[]> = {
  lanzar: ['lanzar_decision_media_buyer'],
  deshacer: ['deshacer_decision_media_buyer'],
  descartar: ['descartar_decision_media_buyer'],
  reabrir: ['reabrir_decision_media_buyer'],
  calificar: ['calificar_decision_media_buyer'],
  config: ['modo_media_buyer', 'topes_media_buyer', 'metas_media_buyer', 'cuenta_media_buyer', 'automatizacion_media_buyer', 'zona_media_buyer', 'hasta_media_buyer'],
  analizar: ['analizar_cuenta_media_buyer'],
  estado_zernio: ['ver_campanas_media_buyer'],
  hooks_a_video: ['hooks_al_video_media_buyer'],
  campanas: ['ver_campanas_media_buyer'],
  subir_preparar: ['ver_campanas_media_buyer', 'preparar_subida_media_buyer'],
  subir_creativos: ['subir_creativos_media_buyer'],
  // La charla del arranque guarda lo respondido para seguir donde quedó; lo que DEJA es config (el resultado, el modo, el
  // tope diario y las metas del mes), y eso sale por la API.
  arranque: ['modo_media_buyer', 'topes_media_buyer', 'metas_media_buyer'],
  lienzo: ['ver_campanas_media_buyer'],
  // La primera entrada del Marketing CoPilot (6/11/2026): lo respondido, por negocio.
  copiloto: ['ver_copiloto_media_buyer', 'copiloto_media_buyer'],
  // La charla relee lo guardado después de un turno de MaKo (6/11/2026): es la misma lectura.
  copiloto_leer: ['ver_copiloto_media_buyer'],
  agente: ['agente_media_buyer'],
  agente_borrar: ['borrar_agente_media_buyer'],
  // DÓNDE, HASTA y «Nueva campaña» (29/10/2026).
  lugares: ['buscar_lugares_meta'],
  hasta_campana: ['hasta_media_buyer'],
  nueva_preparar: ['listar_formularios_meta', 'listar_pixeles_meta', 'ver_campanas_media_buyer', 'ver_media_buyer'],
  crear_campana: ['proponer_crear_campana'],
};

/** Lo que la pantalla muestra sin una `op` propia (sale de la página o de `config`), con su lectura o acción de la API. */
const SIN_OP = ['ver_biblioteca_media_buyer', 'modo_agente_media_buyer'];

/** Lo que todavía NO está en la API, con el porqué. Sumar acá es decidirlo: queda escrito. */
// Vacío desde el 27/10/2026: subir creativos entró a la API en dos pasos, como la pantalla (preparar_subida_media_buyer firma
// la subida al staging y subir_creativos_media_buyer publica).
const FALTA: Record<string, string> = {};

/** Lo que mueve plata en la cuenta de Meta: se confirma en una pantalla y nunca corre como paso de una automatización. */
const MUEVEN_PLATA = ['lanzar_decision_media_buyer', 'deshacer_decision_media_buyer', 'modo_media_buyer', 'topes_media_buyer', 'automatizacion_media_buyer', 'cuenta_media_buyer', 'modo_agente_media_buyer',
  'zona_media_buyer', 'hasta_media_buyer', 'proponer_crear_campana', 'subir_creativos_media_buyer'];

const opsDeLaPantalla = (): string[] => {
  const src = leer('app/api/media-buyer/route.ts');
  const post = src.slice(src.indexOf('export async function POST'));
  return [...post.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]);
};

test('cada botón del Media Buyer (una op de /api/media-buyer) tiene su operación en la API de MaKo, o su porqué en FALTA', () => {
  const ops = opsDeLaPantalla();
  assert.ok(ops.length >= 10, `se leyeron ${ops.length} ops de la ruta: cambió su forma y este test ya no la ve`);
  const sinApi = ops.filter((op) => !DE_LA_PANTALLA[op] && !FALTA[op]);
  assert.deepEqual(sinApi, [], `ops de la pantalla sin operación en la API: ${sinApi.join(', ')}`);
  const viejas = [...Object.keys(DE_LA_PANTALLA), ...Object.keys(FALTA)].filter((op) => !ops.includes(op));
  assert.deepEqual(viejas, [], `ops que la ruta ya no tiene: ${viejas.join(', ')}`);
});

test('cada operación del Media Buyer existe, sale por HTTP y tiene su URL REST', () => {
  const ids = [...new Set(['ver_media_buyer', 'ver_automatizaciones_media_buyer', ...SIN_OP, ...Object.values(DE_LA_PANTALLA).flat()])];
  for (const id of ids) {
    const d = porId(id);
    assert.ok(d, `${id} no está en el registro`);
    assert.ok((d.canales as readonly string[]).includes('http'), `${id} no sale por HTTP`);
    assert.equal(RUTAS_REST.filter((r) => r[2] === id).length, 1, `${id} no tiene su URL en lib/api-mako/rest.ts`);
  }
});

test('lo que mueve plata se confirma en una pantalla, cuesta «dinero» (por HTTP también va a la pantalla) y no corre en un flujo', () => {
  for (const id of MUEVEN_PLATA) {
    const d = porId(id)!;
    assert.equal(d.costo, 'dinero', `${id}: costo`);
    assert.equal('confirmacion' in d ? d.confirmacion : null, 'pantalla', `${id}: confirmación`);
    assert.ok(NO_EN_FLUJOS.has(id), `${id} no está en NO_EN_FLUJOS`);
  }
});

test('cada ajuste de la config del Media Buyer se puede cambiar por la API', () => {
  // El nombre del parámetro que lo cambia, si no es el mismo campo.
  const otroNombre: Record<string, string> = { encendido: 'modo', tacticas: 'tactica', hastaCampanas: 'campanaId' };
  const params = new Set(['modo_media_buyer', 'topes_media_buyer', 'metas_media_buyer', 'cuenta_media_buyer', 'automatizacion_media_buyer', 'zona_media_buyer', 'hasta_media_buyer']
    .flatMap((id) => porId(id)!.parametros.map((p) => p.nombre)));
  const sinApi = Object.keys(CONFIG_POR_DEFECTO).filter((k) => !params.has(otroNombre[k] ?? k));
  assert.deepEqual(sinApi, [], `ajustes que la API no puede cambiar: ${sinApi.join(', ')}`);
});

test('ver_media_buyer devuelve las tres pestañas de la pantalla, con las estrellas, el motivo, las metas y la cuenta', () => {
  const src = leer('lib/api-mako/areas/ads.run.ts');
  const ver = src.slice(src.indexOf('  ver_media_buyer: {'), src.indexOf('  lanzar_decision_media_buyer: {'));
  for (const campo of ['abiertas:', 'hechas:', 'descartadas:', 'estrellas:', 'motivoDescarte:', 'metas:', 'cuentaPublicitaria:', 'agentes:', 'agentesPropios:', 'alertas:', 'agente: firma(d)']) {
    assert.ok(ver.includes(campo), `ver_media_buyer no devuelve ${campo}`);
  }
  assert.match(ver, /leerDecisionesMB\(ctx\.ws, 30\)/, 'los mismos 30 días que la pantalla');
});
