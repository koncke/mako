// =============================================================================
// «Nada por detrás», lote 3: los dos avisos de la prueba del Pixel son automatizaciones de SuperAdmin (17/10/2026)
// =============================================================================
// docs/inventario-nada-por-detras.md, lote 3: `prueba-recibida` (al cerrar una prueba en /integraciones) y `prueba-grabada`
// (el cron prueba-grabacion) armaban su texto en el código, con el singular y el plural escritos ahí. Ahora son los eventos
// de la plataforma `prueba_recibida` y `prueba_grabada`: pasan sólo los hechos (lib/prueba-aviso.ts) y cada fila tiene su
// texto literal, que sirve para uno y para varios.
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-prueba.json`; base 4 / 0). Pasan / fallan:
//   1. los eventos sin su unidad («3» en vez de «3 eventos»)                       → 3 / 1
//   2. sin página, el renglón vacío en vez de faltar                                 → 3 / 1
//   3. el cron vuelve a armar el texto                                               → 3 / 1
//   4. las dos con la misma fuente (cada una ofrecería los datos de la otra)          → 3 / 1
//
// Correr: node --import tsx --test tests/prueba-pixel-evento.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { datosDelEvento } from '../lib/aviso-evento';
import { EVENTOS_MAKO } from '../lib/disparadores';
import { datosPruebaGrabada, datosPruebaRecibida } from '../lib/prueba-aviso';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { textoConDatos } from '../lib/variables-del-lead';
import { partesDeMako } from '../lib/mako-tarjeta';
import { variablesPara } from '../lib/variables-aviso';
import { AVISOS_SOLO_SUPERADMIN } from '../lib/avisos-catalogo';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const tarjeta = (id: string): string => {
  const p = pasosDePlantilla(plantillaPorId(id)!)[0] as unknown as PasoGrafo;
  const parte = partesDeMako((p.accion as { params?: Record<string, unknown> }).params)[0];
  return parte && 'cuerpo' in parte ? String(parte.cuerpo) : '';
};

test('la prueba que se cerró: los eventos con su unidad, y la página en su renglón', () => {
  assert.equal(textoConDatos(tarjeta('mako-prueba-recibida'), datosPruebaRecibida({ eventos: 23, pagina: 'tupagina.com' })),
    '✅ Listo, recibí tu prueba del Pixel\n📄 En *tupagina.com*\n📊 23 eventos\nTe aviso cuando la grabación esté lista. — MaKo');
  assert.equal(textoConDatos(tarjeta('mako-prueba-recibida'), datosPruebaRecibida({ eventos: 1, pagina: null })),
    '✅ Listo, recibí tu prueba del Pixel\n📊 1 evento\nTe aviso cuando la grabación esté lista. — MaKo', 'sin página, el renglón tiene que irse');
});

test('la grabación lista: una lista que sirve para una y para varias', () => {
  const una = textoConDatos(tarjeta('mako-prueba-grabada'), datosPruebaGrabada([{ donde: 'a.com', url: 'https://x/crm/1' }]));
  assert.equal(una, '🎥 Ya puedes ver cómo se vio tu prueba del Pixel:\n• *a.com* 👉 https://x/crm/1\n\n— MaKo');
  const dos = textoConDatos(tarjeta('mako-prueba-grabada'), datosPruebaGrabada([{ donde: 'a.com', url: 'https://x/crm/1' }, { donde: 'b.com', url: 'https://x/crm/2' }]));
  assert.match(dos, /:\n• \*a\.com\* 👉 https:\/\/x\/crm\/1\n• \*b\.com\* 👉 https:\/\/x\/crm\/2\n/);
});

test('las dos son eventos de la plataforma, del super admin, y cada una ofrece SUS datos', () => {
  for (const [subtipo, aviso, suyo, ajeno] of [['prueba_recibida', 'prueba-recibida', 'prueba_eventos', 'prueba_grabaciones'], ['prueba_grabada', 'prueba-grabada', 'prueba_grabaciones', 'prueba_eventos']] as const) {
    const ev = EVENTOS_MAKO.find((e) => e.subtipo === subtipo);
    assert.ok(ev && ev.plataforma === true && ev.aviso === aviso, subtipo);
    assert.ok(AVISOS_SOLO_SUPERADMIN.includes(aviso), aviso);
    const ofrece = variablesPara(datosDelEvento(subtipo)).map((v) => v.key);
    assert.ok(ofrece.includes(suyo), `${subtipo}: falta {{${suyo}}}`);
    assert.ok(!ofrece.includes(ajeno), `${subtipo} ofrece {{${ajeno}}}, que no trae`);
  }
});

test('los emisores pasan sólo los hechos', () => {
  const cron = leer('app/api/cron/prueba-grabacion/route.ts');
  assert.match(cron, /emitirDelCatalogo\('prueba-grabada', \{ ws: w\.id, datos: datosPruebaGrabada\(links\) \}\)/);
  assert.doesNotMatch(cron, /const texto = /, 'volvió el texto armado en el cron');
  const accion = leer('app/integraciones/landing-actions.ts');
  assert.match(accion, /datos: datosPruebaRecibida\(\{ eventos, pagina \}\),/);
  assert.doesNotMatch(accion, /recibí tu prueba del Pixel/, 'volvió el texto armado en la acción');
  const m = leer('scripts/mudanza-avisos-plataforma.mts');
  assert.ok(m.includes("{ plantilla: 'mako-prueba-recibida', evento: 'prueba_recibida' }") && m.includes("{ plantilla: 'mako-prueba-grabada', evento: 'prueba_grabada' }"));
});
