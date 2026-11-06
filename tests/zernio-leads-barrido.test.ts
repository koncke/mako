// =============================================================================
// Los leads de Meta por Zernio: el barrido por si el webhook no llega, y el aviso cuando no le llegan a MaKo (29/10/2026)
// =============================================================================
// Martín, en la llamada con Thiago (29/10, [15:12]): «le entran acá los leads» de los formularios de Meta. Con la app propia del
// negocio anda; por Zernio nunca llegó un lead real. El Cerebro: un barrido con /v1/ads/leads por si el webhook no llega, un aviso
// cuando falta el permiso (`leadsEnElWebhook`) y `asegurarWebhook` en los negocios ya conectados. Lo que tiene que pasar:
//
//   1. EL BARRIDO CARGA SÓLO LO QUE FALTA: ni lo que ya está, ni lo de la PAPELERA, ni un lead de menos de 5 minutos (es del webhook),
//      ni uno de LinkedIn. Uno que falla no tumba a los demás.
//   2. CADA CLAVE CON LA SUYA, y SÓLO las cuentas del negocio: en el pedido (`accountIds`) Y lead por lead en memoria, con cualquier
//      clave (revisión de privacidad, 29/10, M1 y M2: si Zernio ignora el filtro, o la clave propia lista el equipo entero, entraban
//      los leads de otro). Sin el complemento de anuncios (403), se dice.
//   2b. SÓLO CREA (M3): la persona que ya es un lead no se toca. LA PAPELERA, entera o nada (M4).
//   (El M3 con la carga REAL, `upsertLeadFromMeta`, lo corre tests/_zernio-leads-barrido-real-hijo.ts.)
//   3. EL CRON: cada 30 minutos y en la pasada diaria; en la diaria, el webhook asegurado donde no escucha los leads.
//   4. EL AVISO en «Anuncios de Meta»: sin permiso o sin webhook, se dice qué hacer.
//
// Probado ROMPIÉNDOLO (29/10/2026): ver el pie de este archivo.
//
// Correr: node --import tsx --test tests/zernio-leads-barrido.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerLeadDelRest, tocaBarrerZernio } from '../lib/zernio-lead';

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_zernio-leads-barrido-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
const salidaReal = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_zernio-leads-barrido-real-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REAL = JSON.parse(salidaReal.slice(salidaReal.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');

test('el hijo corrió entero y no salió a la red', () => {
  assert.equal(R.tiro, undefined, String(R.tiro));
  assert.deepEqual(R.red, []);
  assert.equal(REAL.tiro, undefined, String(REAL.tiro));
  assert.deepEqual(REAL.red, []);
});

test('el barrido carga SÓLO lo que falta: ni lo que está, ni la papelera, ni uno del webhook, ni LinkedIn, ni uno fuera de la ventana', () => {
  assert.deepEqual(R.a.r, { vistos: 7, cargados: 1, yaEstaban: 2, delWebhook: 1, ignorados: 2, ajenos: 0, errores: 0, motivo: null });
  assert.deepEqual(R.a.cargados, ['10000000000003'], 'el repetido en la lista se carga una vez');
  assert.deepEqual(R.a.anunciados, ['10000000000003']);
  assert.deepEqual(R.a.opciones, [{ soloCrear: true }], 'el barrido sólo crea: la persona que ya es un lead no se toca');
  // También con su propia clave (byok), sólo las cuentas del negocio, desde hace 1 día, de a 100.
  assert.deepEqual(R.a.pedidos, ['/ads/leads?platform=meta&since=1793210400&limit=100&accountIds=acc_fb_1']);
  assert.equal(1793210400, Math.floor((Date.parse('2026-10-29T18:00:00Z') - 86_400_000) / 1000));
});

test('con dos claves, cada una se barre con la suya; sin el complemento de anuncios se dice y se sigue', () => {
  assert.deepEqual(R.b.cargados, ['20000000000001', '20000000000002']);
  assert.deepEqual(R.b.claves, ['sk_dos', 'sk_uno']);
  assert.equal(R.c.r.motivo, 'sin-complemento');
  assert.deepEqual(R.c.cargados, ['30000000000001'], 'la otra clave igual se barre');
});

test('uno que falla no tumba a los demás; sin páginas no se pregunta nada', () => {
  assert.equal(R.d.r.errores, 1);
  assert.deepEqual(R.d.cargados, ['40000000000002']);
  assert.deepEqual(R.e, { r: { vistos: 0, cargados: 0, yaEstaban: 0, delWebhook: 0, ignorados: 0, ajenos: 0, errores: 0, motivo: 'sin-paginas' }, pedidosLeads: 0 });
});

test('con la clave de la PLATAFORMA, sólo las cuentas del negocio, y si Zernio ignora el filtro, se descarta en memoria (M1)', () => {
  assert.deepEqual(R.f.pedidos, ['/ads/leads?platform=meta&since=1793210400&limit=100&accountIds=acc_fb_1']);
  assert.deepEqual(R.f.cargados, ['50000000000001'], 'ni el de la página de otro negocio ni uno que no dice de qué cuenta es');
  assert.equal(R.f.r.ajenos, 2);
});

test('con clave PROPIA, lo mismo: sólo los de sus cuentas de Facebook y de anuncios (M2)', () => {
  assert.deepEqual(R.g.cargados, ['60000000000001']);
  assert.equal(R.g.r.ajenos, 2);
});

test('la persona que ya era un lead no se toca: ni la ficha, ni otra conversión, ni otro aviso (M3)', () => {
  assert.deepEqual(R.h.anunciados, []);
  assert.equal(R.h.r.yaEstaban, 1);
  assert.equal(R.h.r.cargados, 0);
  // Con la carga REAL (`upsertLeadFromMeta`): Ana llenó el formulario A y el B, y su ficha tiene el id de B. Tres pasadas: la ficha
  // no cambia de id, no pierde la campaña, no hay conversión de más y sigue siendo una sola. La persona nueva sí entra.
  for (const v of REAL.vueltas) {
    assert.equal(v.meta_lead_id, '90000000000002');
    assert.equal(v.meta_ad_name, 'Anuncio de octubre');
    assert.equal(v.meta_campaign_name, 'Campaña X');
  }
  assert.deepEqual(REAL.conv, ['90000000000003'], 'la conversión, sólo de la persona nueva y una vez');
  assert.equal(REAL.fichas, 2);
  assert.equal(REAL.vueltas[0].r.cargados, 1);
  assert.equal(REAL.vueltas[1].r.cargados, 0);
});

test('la papelera: entera aunque pase de 1000, y si no se puede leer el barrido corta (M4)', () => {
  assert.deepEqual(R.i.cargados, ['80000000009999'], 'el borrado número 1200 no vuelve');
  assert.equal(R.j.tiro, true);
  assert.match(R.j.mensaje, /leads_papelera/);
  assert.deepEqual(R.j.cargados, []);
  assert.deepEqual(R.j.anunciados, []);
});

test('el lector del REST: el fieldData crudo de Meta primero, la fecha es createdTime, y LinkedIn no entra', () => {
  const l = leerLeadDelRest({
    leadgenId: '1234567890123', createdTime: '2026-10-29T17:00:00Z', formId: '9', formName: 'F', adId: '1', adsetId: '2', campaignId: '3',
    fieldData: [{ name: 'full_name', values: ['Ana Pérez'] }, { name: 'email', values: ['ANA@MAIL.COM'] }, { name: 'phone_number', values: ['+5491122334455'] }],
    fields: { full_name: 'otra cosa' },
  });
  assert.ok(!('ignorado' in l));
  assert.equal(l.nombre, 'Ana Pérez');
  assert.equal(l.email, 'ana@mail.com');
  assert.equal(l.creadoEn, '2026-10-29T17:00:00.000Z');
  assert.equal(l.campanaId, '3');
  // Sin fieldData, las respuestas de `fields`.
  const f = leerLeadDelRest({ leadgenId: '1234567890124', fields: { full_name: 'Beto', email: 'b@b.com' } });
  assert.ok(!('ignorado' in f) && f.nombre === 'Beto');
  assert.deepEqual(leerLeadDelRest({ leadgenId: 'urn:li:leadFormResponse:1' }), { ignorado: 'el lead no trae un leadgenId con forma de id de Meta', porque: 'sin_id' });
  assert.equal('ignorado' in leerLeadDelRest(null), true);
});

test('el cron: cada 30 minutos y en la pasada diaria; en la diaria, el webhook asegurado donde no escucha los leads', () => {
  assert.equal(tocaBarrerZernio(new Date('2026-10-29T18:00:00Z'), false), true);
  assert.equal(tocaBarrerZernio(new Date('2026-10-29T18:10:00Z'), false), false);
  assert.equal(tocaBarrerZernio(new Date('2026-10-29T18:20:00Z'), false), false);
  assert.equal(tocaBarrerZernio(new Date('2026-10-29T18:30:00Z'), false), true);
  assert.equal(tocaBarrerZernio(new Date('2026-10-29T18:10:00Z'), true), true);
  const c = leer('app/api/cron/meta-leads-poll/route.ts');
  assert.match(c, /const zernio = tocaBarrerZernio\(new Date\(\), diaria\)\n\s+\? await correrPorWorkspace\('zernio', async \(ws\) => \{/);
  assert.match(c, /if \(diaria\) \{\n[^\n]*\n\s+if \(\(await leadsEnElWebhook\(ws\)\.catch\(\(\) => null\)\) !== true\) await asegurarWebhook\(ws\)/);
  assert.match(c, /const r = await barrerLeadsDeZernio\(ws, dias\);/);
});

// ⚠️ 5/11/2026: «sin webhook» YA NO dice «MaKo todavía no recibe los leads»: con este barrido, llegan igual (cada media hora). Lo
// decide `avisoDeLeads` (lib/zernio-leads-estado.ts) con lo que contesta la API, EJECUTADO en tests/zernio-leads-estado.test.ts y
// tests/zernio-webhook-suscripcion.test.ts (`avisoDeLeadsZernio`). Acá queda lo que une las piezas: la clave de la conexión y el texto.
test('el aviso en «Anuncios de Meta»: sin permiso o «llegan cada media hora», se dice qué hacer; mira la clave de la conexión', () => {
  const m = leer('lib/meta-conexion-zernio.ts');
  assert.match(m, /avisoDeLeadsZernio\(ws, conexion\)\.catch\(\(\) => null\)/, 'el modal no le pregunta por la conexión de anuncios');
  const z = leer('lib/zernio.ts');
  assert.match(z, /const c = cuentaAnuncios \? await cfgDeCuenta\(ws, cuentaAnuncios\) : await cfg\(ws\);/);
  const p = leer('app/integraciones/ConectarMetaZernio.tsx');
  assert.match(p, /\{conectada && estado\.leads === 'sin-permiso' && \(/);
  assert.match(p, /Los leads de tus formularios no le llegan a MaKo: tu cuenta de Zernio necesita su complemento de anuncios\./);
  assert.match(p, /\{conectada && estado\.leads === 'tarde' && \(/);
  assert.doesNotMatch(p, /todavía no recibe los leads/, 'volvió el aviso que salía en falso');
});

// ── Probado ROMPIÉNDOLO (29/10/2026) ──────────────────────────────────────────
// Corrido junto con tests/zernio-varias-claves.test.ts y tests/calendario-recurrentes.test.ts: 29 pases y 0 fallos. Rota, una por vez:
//   · el barrido reescribe lo que ya está                   → 28 / 1
//   · el barrido resucita lo de la papelera                 → 28 / 1
//   · el barrido le gana al webhook (menos de 5 minutos)    → 28 / 1
//   · con la clave de la plataforma, sin filtro de cuentas  → 28 / 1
//   · un lead que falla tumba el barrido                    → 24 / 5
//   · el 403 del complemento tumba el barrido               → 24 / 5
//   · el lector del REST ignora el fieldData crudo          → 28 / 1
//   · el aviso de leads no se muestra                       → 28 / 1
//
// ROTO 29/10 noche (la revisión de privacidad de Integración, 2910-revision-privacidad-zernio-leads-ce56bd693.md; este test solo,
// con el hijo de la carga REAL: 11 / 0 como está). Una por vez:
//   · M1/M2: no se descarta en memoria el lead de otra cuenta        → 9 / 2
//   · M1/M2: un lead que no dice de qué cuenta es, pasa              → 10 / 1
//   · M2: con clave propia, el pedido sin accountIds                 → 10 / 1
//   · B1: un lead fuera de la ventana entra (Zernio ignora since)    → 10 / 1
//   · M3: el barrido no pide «sólo crear»                            → 9 / 2
//   · M3: la persona que ya era lead recibe conversión y aviso       → 10 / 1
//   · M3: upsertLeadFromMeta ignora noTocarExistente                 → 10 / 1
//   · M4: la papelera sin paginar (corta en 1000)                    → 10 / 1
//   · M4: con la papelera caída se sigue igual                       → 10 / 1
