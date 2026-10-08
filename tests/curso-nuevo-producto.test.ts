// =============================================================================
// curso-nuevo-producto — «+ Nuevo producto» en el menú de la marca del curso
// =============================================================================
// Item 17 del audio del 08/10/2026 (docs/feedback-curso-08oct.md, minuto 00:40). Martín, textual: «hoy en
// día tenés que irte al CRM y en el CRM pones nuevo producto… eso yo también lo voy a poner ahí en el
// mismo curso, que vos puedas agregar un nuevo producto».
//
// Lo que estos tests cuidan es lo que NO se ve hasta que alguien lo nota en otra pantalla:
//   · que se cree con la CADENA del CRM (`crearServicioAction` → `crearProductoConFunnel`: producto →
//     oferta → embudo con sus etapas) y no con `upsertProducto`, que deja un producto que el desplegable
//     del CRM no lista (lista EMBUDOS) — el error que parece obvio, ya escrito en
//     app/customer-success/actions.ts;
//   · que al crearlo se navegue DURO y con el `?ws=` (lo que cambió es QUÉ EXISTE: un `router.refresh()`
//     dejaría la tab sin el producto recién creado, y sin el `?ws=` el super admin terminaría en su
//     propio workspace);
//   · que el diálogo viva AFUERA del curso (adentro, la hoja le saca la piel a sus botones) y sea de
//     quien edita.
// Se lee el fuente SIN comentarios y por bloque (AGENTS.md).
//
// PROBADO ROMPIÉNDOLO (08/10/2026, scratchpad/general/romper-producto.mjs, en memoria y sin git): al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\s*\}/g, '{}');

const APP = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
const NUEVO = sinComentarios(leer('app/customer-success/curso/NuevoProducto.tsx'));

test('el menú de la marca ofrece «+ Nuevo producto» a quien edita, al final de la lista de cursos', () => {
  const ini = APP.indexOf('const menuMarca = ');
  const marca = APP.slice(ini, APP.indexOf('if (!servicio) {', ini));
  assert.ok(marca.length > 500 && marca.length < 9000, `el recorte del menú mide ${marca.length}`);
  // `pedirSalida` primero (revisión final del 08/10/2026): crear navega DURO, y con la lección a medio
  // guardar la salida la atajaba el `beforeunload` con el producto ya creado. Roto (sin `pedirSalida`): 4 / 1.
  const item = /\{puedeEditar && \(\s*<ItemMenuUgc onClick=\{\(\) => \{ cerrar\(\); leccionAbierta\.pedirSalida\(\(\) => setCreandoProducto\(true\)\); \}\}>\+ Nuevo producto<\/ItemMenuUgc>\s*\)\}/;
  assert.match(marca, item, '«+ Nuevo producto» sin la puerta de quien edita, sin cerrar el menú, o sin preguntar por la lección sin guardar');
  assert.ok(marca.indexOf('servicios.map(') < marca.search(item), 'va al FINAL de la lista de cursos');
});

test('el diálogo va AFUERA del curso, montado por la pantalla', () => {
  const finCurso = APP.indexOf('textos={TEXTOS_EDITOR}');
  const dialogo = APP.indexOf('{creandoProducto && <NuevoProducto onCerrar={() => setCreandoProducto(false)} />}');
  assert.ok(finCurso > 0 && dialogo > finCurso, 'el diálogo quedó adentro de <CursoUgc> (sus botones salen sin piel)');
});

test('crea con la CADENA del CRM (producto → oferta → embudo), nunca con upsertProducto', () => {
  assert.match(NUEVO, /import \{ crearServicioAction \} from '\.\.\/actions';/);
  assert.match(NUEVO, /const r = await crearServicioAction\(n\);/);
  assert.doesNotMatch(NUEVO, /upsertProducto|from '@\/app\/crm/, 'una segunda forma de crear un producto');
  // Y la action sigue siendo la de la cadena entera, de un admin.
  const acc = sinComentarios(leer('app/customer-success/actions.ts'));
  const ini = acc.indexOf('export async function crearServicioAction(');
  const crear = acc.slice(ini, acc.indexOf('\n}\n', ini));
  assert.match(crear, /if \(!\(await adminDeWorkspaceActual\(\)\)\) return/);
  assert.match(crear, /await crearProductoConFunnel\(nombre\)/);
});

test('al crearlo se navega DURO al curso nuevo, con el ?ws= de la pestaña; con error, el diálogo se queda', () => {
  assert.match(NUEVO, /const ws = useWs\(\);/);
  assert.match(NUEVO, /window\.location\.href = conWs\(rutaDelCurso\(r\.productoId\), ws\);/);
  assert.match(NUEVO, /const rutaDelCurso = \(id: number\) => `\/customer-success\/curso\?producto=\$\{id\}`;/);
  assert.doesNotMatch(NUEVO, /router\.refresh\(\)/, 'un refresh llega tarde para lo que cambió QUÉ EXISTE');
  // Un error no cierra el diálogo: se dice y se puede corregir el nombre.
  assert.match(NUEVO, /if \(!r\.ok\) \{ setError\(r\.error\); setCreando\(false\); return; \}/);
  assert.ok(NUEVO.indexOf('if (!r.ok)') < NUEVO.indexOf('window.location.href'), 'navega antes de saber si se creó');
});

test('el texto del diálogo: corto y en neutro', () => {
  const textos = [...NUEVO.matchAll(/(?:label|placeholder|hint|titulo)="([^"]+)"|>([^<>{}\n]{3,})</g)].map((m) => m[1] ?? m[2]).join('\n');
  assert.ok(textos.includes('Crear producto'), 'el barrido de textos no encontró nada');
  assert.deepEqual(marcasDeVoseo(textos), []);
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 08/10/2026 (scratchpad/general/romper.mjs + roturas.mjs, en memoria y sin git). Con todo en
// su lugar: 5 pass / 0 fail. Cada rotura, sola, dio 4 / 1:
//  33. «+ Nuevo producto» sin `puedeEditar`        → «el menú de la marca ofrece…»
//  34. navega sin el `?ws=` · 36. con error navega igual → «al crearlo se navega DURO…»
//  35. crea con `upsertProducto`                   → «crea con la CADENA del CRM…»
//  37. el diálogo no se monta afuera del curso     → «el diálogo va AFUERA del curso…»
