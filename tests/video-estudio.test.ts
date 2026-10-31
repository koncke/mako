// =============================================================================
// El estudio de video (27/10/2026): los proyectos de la barra y el anuncio nuevo en una pantalla
// =============================================================================
// Copiado de Arcads (docs/hallazgos-generativa.md → «El estudio de video copiado de Arcads»): un proyecto por anuncio en la
// barra del costado, el anuncio nuevo en UNA pantalla (guion + formato + lugar) y el chat de MaKo al costado.
//
// Probado rompiéndolo (27/10/2026, base 8/0):
//   · `faseDe` sin el chequeo de `confirmada` (todo escenario cuenta como aprobado)           → 5/2
//   · `urlConPlan` reconstruye la query sólo con `plan` (se pierde el `?ws=`)                  → 6/1
//   · `estadoDelComposer` sin la rama del puente (deja generar con el puente caído)            → 6/1
//   · `planExistente` sin comparar el formato (abre el anuncio de OTRO formato)                → 6/1
//   · `lugarDelPedido` sin mirar la cámara (acepta una oficina en un selfie de auto)           → 6/1
//   · WizardAnuncio vuelve a mandar al paso del lugar siempre (sin `lugarEnElAlta`)            → 6/1
//   · `proyectoNuevo` devuelve el primero de la lista (abre uno que ya estaba)                 → 7/1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { faseDe, filaDeProyecto, planDeUrl, proyectoNuevo, tituloDeProyecto, urlConPlan } from '../app/video-generator/estudio/proyectos';
import { LUGAR_MAKO, estadoDelComposer, lugarDelPedido, lugarValido, lugaresPara, planExistente } from '../app/video-generator/estudio/composer-reglas';
import { puestasOfrecidas, type Puesta } from '../lib/puestas-data';
import { CATALOGO_ESCENARIOS } from '../lib/escenarios-data';
import type { PlanGuardado } from '../app/video-generator/video-datos';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Un anuncio de mentira, con lo mínimo que lee la fase. */
function plan(over: Partial<PlanGuardado> = {}, clips = 3): PlanGuardado {
  return {
    id: 'p1', pedido: 'Hola', at: '2026-10-27T10:00:00Z',
    plan: { titulo: 'Mi anuncio', puestaId: 'x', clips: Array.from({ length: clips }, (_, i) => ({ n: i + 1, voz: `toma ${i + 1}`, segundos: 8 })) },
    ...over,
  } as unknown as PlanGuardado;
}
const escenas = (n: number) => Array.from({ length: n }, (_, i) => ({ n: i + 1 })) as unknown as PlanGuardado['escenas'];

test('faseDe: guion → escenario sin aprobar → tomas → listo, del dato', () => {
  assert.deepEqual(faseDe(plan()), { id: 'guion' });
  assert.deepEqual(faseDe(plan({ escenas: escenas(2), imagenes: { 1: { confirmada: true } } as never })), { id: 'escenario', n: 2 });
  const aprobadas = { 1: { confirmada: true }, 2: { confirmada: true } } as never;
  assert.deepEqual(faseDe(plan({ escenas: escenas(2), imagenes: aprobadas, video: { 1: { url: 'u' } } as never })), { id: 'tomas' });
  const todo = { 1: { url: 'a' }, 2: { url: 'b' }, 3: { url: 'c' } } as never;
  assert.deepEqual(faseDe(plan({ escenas: escenas(2), imagenes: aprobadas, video: todo })), { id: 'listo' });
});

test('filaDeProyecto: dice en qué anda, primero lo que bloquea', () => {
  assert.equal(filaDeProyecto(plan()).detalle, 'Revisa el guion');
  assert.equal(filaDeProyecto(plan({ escenas: escenas(3) })).detalle, 'Escenario 1 de 3');
  assert.equal(filaDeProyecto(plan({ escenas: escenas(1) })).detalle, 'Aprueba el escenario');
  const aprobada = { 1: { confirmada: true } } as never;
  const base = { escenas: escenas(1), imagenes: aprobada };
  assert.equal(filaDeProyecto(plan({ ...base })).detalle, 'Sin filmar');
  assert.equal(filaDeProyecto(plan({ ...base, video: { 1: { url: 'a' } } as never })).detalle, '1 de 3 tomas');
  assert.equal(filaDeProyecto(plan({ ...base, video: { 2: { trabajoId: 4 } } as never })).detalle, 'Filmando…');
  const falla = filaDeProyecto(plan({ ...base, video: { 1: { url: 'a' }, 2: { error: 'x' }, 3: { trabajoId: 2 } } as never }));
  assert.deepEqual([falla.detalle, falla.tono], ['Una toma no salió', 'bad']);
  assert.equal(tituloDeProyecto({ plan: { titulo: '' } as never, pedido: '' }), 'Anuncio');
});

test('el proyecto abierto viaja en ?plan= y la URL conserva el ?ws= del cliente', () => {
  assert.equal(planDeUrl('?plan=abc-123&ws=7'), 'abc-123');
  assert.equal(planDeUrl('?plan=../x'), null);
  assert.equal(urlConPlan('/video-generator?ws=7', 'abc-123'), '/video-generator?ws=7&plan=abc-123');
  assert.equal(urlConPlan('/video-generator?ws=7&plan=viejo', null), '/video-generator?ws=7');
  assert.equal(urlConPlan('https://hola-mako.com/video-generator?plan=a', 'b'), '/video-generator?plan=b');
  // Un id que no es un id no se escribe.
  assert.equal(urlConPlan('/video-generator?ws=7', '<script>'), '/video-generator?ws=7');
});

const PUESTAS = puestasOfrecidas();
const conCamara = (c: string): Puesta => PUESTAS.find((p) => p.camara === c) ?? ({ ...PUESTAS[0], camara: c } as Puesta);

test('el lugar: sólo los que sirven con la cámara del formato, y «Que lo elija MaKo» siempre', () => {
  assert.deepEqual(lugaresPara(null), []);
  for (const p of PUESTAS) {
    const ls = lugaresPara(p);
    assert.ok(ls.length > 0, `${p.id}: sin lugares`);
    for (const l of ls) assert.ok(!l.camaras.length || l.camaras.includes(p.camara), `${p.id}: ${l.id} no sirve con ${p.camara}`);
  }
  // Un lugar que no sirve con la cámara nueva vuelve a MaKo; uno que sirve, se queda.
  const restringido = CATALOGO_ESCENARIOS.find((e) => e.camaras.length > 0);
  if (restringido) {
    const otraCamara = PUESTAS.find((p) => !restringido.camaras.includes(p.camara));
    if (otraCamara) {
      assert.equal(lugarValido(otraCamara, restringido.id), LUGAR_MAKO);
      const r = lugarDelPedido(otraCamara, restringido.id);
      assert.equal(r.ok, false, 'la acción no guarda un lugar que no sirve con el formato');
    }
    const sirve = conCamara(restringido.camaras[0]);
    assert.equal(lugarValido(sirve, restringido.id), restringido.id);
    assert.deepEqual(lugarDelPedido(sirve, restringido.id), { ok: true, escenarioId: restringido.id });
  }
  assert.deepEqual(lugarDelPedido(PUESTAS[0], LUGAR_MAKO), { ok: true, escenarioId: null });
  assert.deepEqual(lugarDelPedido(PUESTAS[0], undefined), { ok: true, escenarioId: null });
  assert.equal(lugarDelPedido(PUESTAS[0], 'luna').ok, false);
});

test('planExistente: el mismo guion con el MISMO formato se abre; con otro formato es otro anuncio', () => {
  const h = [{ id: 'a', guionId: 'g1', plan: { puestaId: 'office' } }, { id: 'b', guionId: 'g2', plan: { puestaId: 'car' } }];
  assert.equal(planExistente(h, 'g1', 'office'), 'a');
  assert.equal(planExistente(h, 'g1', 'car'), null);
  assert.equal(planExistente(h, null, 'office'), null);
});

test('estadoDelComposer: el botón dice qué hace y la línea de abajo dice por qué no responde', () => {
  const puesta = PUESTAS[0];
  const guion = { id: 'g1', hablado: 'Hola, soy yo. Te cuento algo corto.' };
  const base = { guion, puesta, existente: null, puenteAnda: true, extensionVieja: false };
  assert.equal(estadoDelComposer({ ...base, guion: null }).consecuencia, 'Elige un guion.');
  assert.equal(estadoDelComposer({ ...base, puesta: null }).consecuencia, 'Elige un formato.');
  assert.deepEqual(
    [estadoDelComposer({ ...base, puenteAnda: false }).puede, estadoDelComposer({ ...base, puenteAnda: false }).consecuencia],
    [false, 'Conecta tu navegador con Google Flow para seguir.'],
  );
  assert.equal(estadoDelComposer({ ...base, extensionVieja: true }).puede, false);
  const ok = estadoDelComposer(base);
  assert.equal(ok.puede, true);
  assert.equal(ok.boton, 'Generar anuncio');
  assert.match(ok.consecuencia, /^Escribirlo es gratis\. Filmarlo son \d+ tomas\.$/);
  // Abrir lo hecho no necesita el puente.
  const abre = estadoDelComposer({ ...base, existente: 'p9', puenteAnda: false });
  assert.deepEqual([abre.puede, abre.abre, abre.boton], [true, 'p9', 'Abrir el que ya tienes']);
  // Un guion que no entra avisa y deja seguir.
  const largo = estadoDelComposer({ ...base, guion: { id: 'g', hablado: 'palabra '.repeat(4000) } });
  assert.deepEqual([largo.puede, largo.desborda], [true, true]);
  assert.match(largo.consecuencia, /sobran \d+ palabras/);
});

test('el wizard no vuelve a preguntar el lugar decidido al crear, y la fase sale de una sola regla', () => {
  const w = sinComentarios(leer('app/video-generator/WizardAnuncio.tsx'));
  assert.match(w, /onSiguiente: \(\) => setForzado\(item\.lugarEnElAlta \? \{ id: 'escenario', n: 1 \} : \{ id: 'lugar' \}\)/);
  assert.match(w, /\.\.\.\(item\.lugarEnElAlta \? \[\] : \['lugar'\]\)/);
  assert.match(w, /const f = faseDe\(item\);/, 'pasoDe tiene que leer la fase de estudio/proyectos.ts');
  // La acción guarda el lugar con la MISMA regla de la pantalla.
  const a = sinComentarios(leer('app/video-generator/actions.ts'));
  assert.match(a, /lugarDelPedido\(puesta, input\.lugar\)/);
  assert.match(a, /lugarEnElAlta: true as const/);
});

test('lo que MaKo creó por el chat se abre: sólo un anuncio NUEVO, nunca uno que ya estaba', () => {
  assert.equal(proyectoNuevo([{ id: 'a' }, { id: 'b' }], [{ id: 'c' }, { id: 'a' }, { id: 'b' }]), 'c');
  assert.equal(proyectoNuevo([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'a' }]), null, 'MaKo cambió uno que ya estaba: no se salta a él');
  assert.equal(proyectoNuevo([], []), null);
  const e = leer('app/video-generator/estudio/EstudioVideo.tsx');
  assert.match(e, /const nuevo = proyectoNuevo\(historialRef\.current, r\.historial\);/);
  assert.match(e, /if \(nuevo\) abrir\(nuevo\);/);
});

