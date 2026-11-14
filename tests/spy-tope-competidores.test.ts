// =============================================================================
// El tope del plan en Competitor Spy: Esencial suma UN competidor, Pro los que quiera (14/11/2026)
// =============================================================================
// Martín: «Tu competencia solamente debería poder scrapear a una persona de la competencia, el de 97 ilimitado».
// La tabla es lib/topes-plan.ts ('spy.competidores'); la regla, lib/spy-tope-reglas.ts; la lectura, lib/spy-tope.ts; el
// único punto donde nace un competidor, `agregarCompetidor` (lib/spy.ts). Lo que falla callado si se rompe:
//   1. EL TOPE LE CAE AL WS1 O A UN ALTA A MANO: también tienen capa `completo`, y no pagan por la pasarela.
//   2. SE FRENA LO QUE NO ES NUEVO: volver a pegar a alguien que ya mira, o sumarle un canal (las otras redes, la extensión).
//   3. SE CREA ANTES DE FRENAR: el freno va DESPUÉS de buscar el duplicado y ANTES del upsert.
//   4. SIN PODER LEER EL PLAN, SE FRENA: el tope vende, no protege; un error nuestro no le corta el trabajo al cliente.
//   5. SE LE SACA A ALGUIEN LO QUE YA TIENE: la lectura diaria de los seguidos no mira este tope.
//   6. LA PANTALLA DICE EL ERROR SIN «Pasar a Pro».
//
// PROBADO ROMPIÉNDOLO (14/11/2026), con el archivo en 6 / 0, una rotura por vez (y vuelto a poner):
//   · sin el corte del freno en `agregarCompetidor`         → 5 / 1
//   · el freno después del upsert                           → 5 / 1
//   · el freno antes de buscar el duplicado                 → 5 / 1
//   · la regla sin mirar `aplica`                           → 5 / 1
//   · la lectura sin `aplicanTopes`                         → 5 / 1
//   · `topeDeCompetidores` frena si no puede leer el plan    → 5 / 1
//   · la regla frena lo que no es nuevo                     → 5 / 1
//   · el error del buscador sin «Pasar a Pro»               → 5 / 1
//
// Correr: node --import tsx --test tests/spy-tope-competidores.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { topeAlSumarCompetidor } from '../lib/spy-tope-reglas';
import { RUTA_CAMBIAR_PLAN, textoTope, topeDe } from '../lib/topes-plan';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de una función exportada, hasta la próxima exportada: así una aserción no la satisface otra función del archivo. */
function cuerpoDe(src: string, firma: string): string {
  const desde = src.indexOf(firma);
  assert.ok(desde >= 0, `no encontré «${firma}»`);
  const hasta = src.indexOf('\nexport ', desde + firma.length);
  return sinComentarios(src.slice(desde, hasta < 0 ? undefined : hasta));
}

const esencial = { aplica: true, capa: 'completo', nuevo: true };

test('la regla: Esencial suma uno; con 1 ya no, con el cartel y «Pasar a Pro»; Pro no tiene tope', () => {
  assert.equal(topeDe('completo', 'spy.competidores'), 1, 'MaKo Esencial suma UN competidor (lib/topes-plan.ts)');
  assert.equal(topeDe('agencia', 'spy.competidores'), null, 'MaKo Pro no tiene tope de competidores');

  assert.deepEqual(topeAlSumarCompetidor({ ...esencial, usadas: 0 }), { ok: true }, 'el primero siempre entra');
  assert.deepEqual(topeAlSumarCompetidor({ ...esencial, usadas: 1 }), {
    ok: false, tope: 1, error: textoTope(1), pasarAPro: RUTA_CAMBIAR_PLAN,
  }, 'con 1, el segundo no entra: el cartel es `textoTope` y el botón lleva a «Tu plan»');
  assert.equal(textoTope(1), 'Llegaste al tope de tu plan (1). Pasa a MaKo Pro para tener más.');
  // Quien ya tenía más (de antes del tope) los conserva, pero no suma otro.
  assert.equal(topeAlSumarCompetidor({ ...esencial, usadas: 3 }).ok, false, 'con 3 de antes, un cuarto entraba');

  assert.deepEqual(topeAlSumarCompetidor({ ...esencial, capa: 'agencia', usadas: 40 }), { ok: true }, 'Pro tenía tope');
});

test('la regla: sin plan cobrado, sin una capa de plan o sin algo nuevo, no frena', () => {
  assert.deepEqual(topeAlSumarCompetidor({ ...esencial, aplica: false, usadas: 5 }), { ok: true }, 'al ws1 o a un alta a mano se le aplicaba el tope');
  assert.deepEqual(topeAlSumarCompetidor({ ...esencial, capa: null, usadas: 5 }), { ok: true }, 'una capa desconocida frenaba');
  assert.deepEqual(topeAlSumarCompetidor({ ...esencial, capa: 'superadmin', usadas: 5 }), { ok: true }, 'la plataforma (sus «Sugeridos») tenía tope');
  assert.deepEqual(topeAlSumarCompetidor({ ...esencial, nuevo: false, usadas: 1 }), { ok: true }, 'lo que cae sobre una fila que ya existe no suma uno más');
});

test('`agregarCompetidor` pasa por el freno DESPUÉS de buscar el duplicado y ANTES de crear la fila', () => {
  const alta = cuerpoDe(leer('lib/spy.ts'), 'export async function agregarCompetidor');
  const freno = alta.indexOf('await topeDeCompetidores(');
  assert.ok(freno >= 0, '`agregarCompetidor` no pasa por el tope del plan: un Esencial suma todos los que quiera');
  assert.ok(alta.indexOf('if (yaEsta)') >= 0 && alta.indexOf('if (yaEsta)') < freno,
    'el freno va antes de buscar el duplicado: volver a pegar al que ya mira (o sumarle un canal) se frena');
  assert.ok(freno < alta.indexOf('.upsert('), 'el freno va después del upsert: la fila ya se creó');
  // El freno CORTA: devuelve el error con «Pasar a Pro» antes de armar la fila.
  const corte = alta.slice(freno, alta.indexOf('.upsert('));
  assert.match(corte, /if \(!plan\.ok\) return \{ ok: false, error: plan\.error, pasarAPro: plan\.pasarAPro \}/,
    'el freno no corta, o corta sin decirle a la pantalla que ofrezca «Pasar a Pro»');
  // Cuenta las filas del NEGOCIO (`existentes`, por el proxy del inquilino): los «Sugeridos» son del ws de la plataforma.
  assert.match(corte, /topeDeCompetidores\(existentes\.length,/, 'el tope cuenta otra cosa que los competidores del negocio');
});

test('la lectura: sólo si `aplicanTopes`, y sin poder leer el plan deja pasar', () => {
  const src = sinComentarios(leer('lib/spy-tope.ts'));
  assert.match(src, /import \{ aplicanTopes \} from '\.\/topes-plan-server'/);
  assert.match(src, /!\(await aplicanTopes\(ws\)\)\) return \{ ok: true \}/, 'el tope corre sin preguntar si MaKo le cobra el plan');
  assert.match(src, /catch \(e\) \{[\s\S]*?return \{ ok: true \};\s*\}/, 'sin poder leer el plan, frena: un error nuestro le corta el trabajo al cliente');
});

test('nadie pierde lo que ya tiene: la lectura diaria de los seguidos no mira el tope', () => {
  for (const f of ['app/api/cron/spy-todo/route.ts', 'lib/spy-todo.ts']) {
    const src = leer(f);
    assert.doesNotMatch(src, /spy-tope|topeDeCompetidores|spy\.competidores/, `${f} mira el tope: se le dejaría de leer a quien ya tiene más de uno`);
  }
});

test('la pantalla dice el error tal cual, con «Pasar a Pro» al lado (el de app/crm/PasarAPro.tsx)', () => {
  const app = leer('app/competitor-spy/SpyApp.tsx');
  assert.match(app, /setErrorConPro\(r\.pasarAPro \? r\.error : null\)/, 'sumar uno no recuerda que el error es el tope');
  assert.match(app, /pasarAPro=\{errorModal != null && errorModal === errorConPro\}/, 'el buscador del «+» no recibe que el error es el tope');
  assert.match(app, /import \{ PasarAPro \} from '\.\.\/crm\/PasarAPro'/);

  const buscador = leer('app/competitor-spy/BuscadorAlta.tsx');
  assert.match(buscador, /import \{ PasarAPro \} from '\.\.\/crm\/PasarAPro'/, 'el botón se copió en vez de usar el de siempre (con `CtaPasarAPro` adentro)');
  assert.match(buscador, /\{error\}\{pasarAPro && <> <PasarAPro \/><\/>\}/, 'el error del tope sale sin «Pasar a Pro»');

  // Las actions dejan pasar la marca hasta la pantalla.
  const actions = leer('app/competitor-spy/actions.ts');
  assert.equal((actions.match(/\{ ok: false; error: string; pasarAPro\?: string \}/g) ?? []).length, 2, 'sumar o sumar un sugerido pierde la marca del tope');
});
