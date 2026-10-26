// =============================================================================
// MaKo recomienda (26/10/2026): dónde aparece, quién lo ve, y que nada se escriba ni salga solo
// =============================================================================
// Lee el FUENTE (las pantallas y la ruta no se pueden montar en un test de node). Lo que fija:
//   1. donde hay un MaKo (el Cerebro del Ops Center, el chat del lienzo de Automations, el de Offer y el del Web Generator) va
//      `RecomendacionesDeMako`, y ésa dibuja con el BLOQUE de preguntas (`BloqueDePreguntas` → `deLaTab`), nunca una lista;
//   2. la ruta es del ADMIN (un miembro recibe `[]`, no un error) y el GET no decide nada: decidir es sólo el POST;
//   3. el motor no manda nada hacia afuera (ni WhatsApp, ni email, ni una automatización) y la IA va sólo con la del negocio;
//   4. la API declara las dos operaciones con el gating del admin, y la de decidir con confirmación por chat.
//
// Probado rompiéndolo (26/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { porId } from '../lib/api-mako/registro';
import { CATALOGO_MODELOS } from '../lib/model-catalogo';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const PANTALLAS: Array<{ archivo: string; superficie: string }> = [
  { archivo: 'app/second-brain/ChatSecondBrain.tsx', superficie: 'ops-center' },
  { archivo: 'app/automations/ChatMakoVista.tsx', superficie: 'automations' },
  { archivo: 'app/offer/ChatOffer.tsx', superficie: 'offer' },
  { archivo: 'app/web-generator/editor/paneles/PanelAgente.tsx', superficie: 'landing' },
];

test('1. cada MaKo tiene sus recomendaciones, con su pantalla y la caja de esa pantalla', () => {
  for (const { archivo, superficie } of PANTALLAS) {
    const src = fuente(archivo);
    assert.match(src, new RegExp(`<RecomendacionesDeMako superficie="${superficie}" alPedir=\\{`), `${archivo} no monta las recomendaciones de «${superficie}»`);
  }
  assert.match(fuente('app/second-brain/ChatSecondBrain.tsx'), /k\.esJefe && <RecomendacionesDeMako/, 'en el Ops Center del cliente, sólo en el Cerebro');
});

test('1. se dibujan con el bloque de preguntas del Ops Center, no con una lista propia', () => {
  const src = fuente('app/_chat/RecomendacionesDeMako.tsx');
  assert.match(src, /<BloqueDePreguntas chat=\{`recomienda:\$\{superficie\}`\} deLaTab=\{preguntas\} \/>/);
  assert.doesNotMatch(src, /<(ul|ol|li)\b/, 'una lista suelta arriba del hilo es lo que Martín rechazó el 22/10/2026');
  assert.match(src, /if \(!preguntas\.length\) return null;/, 'sin nada que decir, no se dibuja nada');
  // «Hacerlo» deja el pedido escrito en la caja: no lo manda solo.
  assert.match(src, /alPedir\(pedido\)/);
  assert.doesNotMatch(src, /enviar\(|onMandar\(/, 'el pedido no se manda solo: la persona lo lee y lo envía');
});

test('2. la ruta es del admin, un miembro recibe una lista vacía, y el GET no decide nada', () => {
  const src = fuente('app/api/mako/recomendaciones/route.ts');
  const get = src.slice(src.indexOf('export async function GET'), src.indexOf('export async function POST'));
  const post = src.slice(src.indexOf('export async function POST'));
  assert.match(get, /if \(!q\.admin\) return json\(\{ ok: true, recomendaciones: \[\]/);
  assert.doesNotMatch(get, /decidirRecomendacion/, 'el GET no escribe la memoria');
  assert.match(post, /if \(!q\.admin\) return json\(\{ ok: false, error: '[^']+' \}, 403\)/);
  assert.match(post, /decidirRecomendacion/);
  assert.doesNotMatch(fuente('lib/rutas-publicas.ts'), /recomendaciones/, 'no es pública');
});

test('3. el motor no manda nada hacia afuera, y redacta sólo con la IA del negocio', () => {
  for (const rel of ['lib/recomendaciones.ts', 'lib/recomendaciones-senales.ts', 'lib/recomendaciones-reglas.ts']) {
    const src = fuente(rel);
    assert.doesNotMatch(src, /\b(sendText|enviarTexto|enviarYEspejar|sendEmail|crearDesdePlantilla|crearBorrador|dispararEvento|avisar)\(/, `${rel} manda algo`);
    // Una escritura sobre una TABLA (`.from('x')…insert(`): el `.delete()` de un Map (el caché) no cuenta.
    assert.doesNotMatch(src, /\.from\([^)]*\)[^;]{0,200}\.(insert|update|delete|upsert)\(/, `${rel} escribe en una tabla`);
  }
  const motor = fuente('lib/recomendaciones.ts');
  assert.match(motor, /async function puedeRedactar\(ws: number\)[\s\S]{0,300}claveDeIAPropia\(ws\)/);
  assert.match(motor, /const redacta = ws != null && \(await puedeRedactar\(ws\)\)/);
  const cat = CATALOGO_MODELOS.find((f) => f.feature === 'mako-recomienda');
  assert.ok(cat, 'la tarea está en el catálogo de modelos');
  assert.equal(cat!.pii, true, 'lleva datos del negocio: va sólo a lo que no entrena');
  assert.equal(cat!.def.provider, 'gemini', 'un default que cobra es un cobro silencioso');
});

test('4. la API: leer y decidir, del admin, y decidir se confirma', () => {
  const leer = porId('que_recomienda_mako');
  const decidir = porId('decidir_recomendacion');
  assert.ok(leer && decidir);
  assert.equal(leer!.tipo, 'lectura');
  assert.equal(leer!.gating?.rolMinimo, 'admin');
  assert.equal(decidir!.tipo, 'accion');
  assert.equal(decidir!.gating?.rolMinimo, 'admin');
  assert.equal((decidir as { confirmacion?: string }).confirmacion, 'chat');
  assert.equal((decidir as { reversible?: boolean }).reversible, true, 'reabierta es el camino de vuelta, en la misma operación');
});

// ── Probado rompiéndolo (26/10/2026) ─────────────────────────────────────────────────────────────────────────────────
//   1. sacar el montaje de ChatOffer.tsx                                 → rojo «1. cada MaKo…».
//   2. `k.esJefe &&` fuera (en todos los chats del Ops Center)           → rojo «1. cada MaKo…».
//   3. `if (!q.admin)` del GET devolviendo las de verdad                  → rojo «2. la ruta…».
//   4. `rolMinimo` fuera de que_recomienda_mako                          → rojo «4. la API…».
//   5. `puedeRedactar` sin `claveDeIAPropia` (siempre true)               → rojo «3. el motor…».
//   6. un `db.from('leads').update({})` en lib/recomendaciones.ts           → rojo «3. el motor…».
// La primera versión del chequeo de escrituras daba rojo SIN romper nada: confundía el `.delete()` del caché (un Map) con un
// borrado en la base. Ahora mira sólo `.from(…)…insert|update|delete|upsert(`.
