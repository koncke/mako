// =============================================================================
// Un paso «⚡ Acción» de un flujo corre cualquier acción de MaKo, por el mismo camino
// =============================================================================
// Decisión de Martín (08/10/2026): un flujo «que pueda hacer todo, sin limitaciones».
// Hasta ese día el paso «⚡ Acción» del lienzo de avisos ofrecía tres acciones fijas que
// dejaban una pendiente `flujo_*` que ningún área del registro declaraba: al confirmarla,
// se cerraba como «operación desconocida». Medido: 1 paso guardado, 0 corridas.
//
// Ahora el paso corre CUALQUIER acción del registro por `ejecutarDesdeFlujo`
// (lib/api-mako/flujo.ts), que propone por el choke point de siempre y confirma en el acto
// por el camino que ya existe para cada forma.
//
// PROBADO ROMPIÉNDOLO (con todo puesto: 6 pasan, 0 fallan). Pasan / fallan:
//   · el lead del evento no se pone cuando el paso no fijó uno             -> 5 / 1
//   · un leadId fijado en el paso se pisa con el del evento                -> 5 / 1
//   · la clave de un flujo deja de empezar con `app:`                      -> 5 / 1
//   · el ejecutor escribe directo en una tabla en vez de pasar por el registro -> 5 / 1
//   · aparece una acción de pantalla propia que el ejecutor no maneja      -> 5 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { paramsDelPaso, filasDeLeads, pideLead, LEAD_DEL_EVENTO } from '../lib/api-mako/flujo-params';
import { PREFIJO_APP, PREFIJO_FLUJO, canalDeClave, etiquetaDeCanal } from '../lib/api-mako/canal';
import type { Parametro } from '../lib/api-mako/tipos';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string =>
  s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const CON_LEAD: Parametro[] = [
  { nombre: 'leadId', tipo: 'number', descripcion: 'el lead', obligatorio: true, entero: true },
  { nombre: 'etapa', tipo: 'string', descripcion: 'a qué etapa' },
];
const SIN_LEAD: Parametro[] = [{ nombre: 'nombre', tipo: 'string', descripcion: 'x' }];

test('⚠️ EL LEAD DEL EVENTO SE PONE CUANDO LA ACCIÓN LO PIDE Y EL PASO NO FIJÓ UNO', () => {
  assert.deepEqual(paramsDelPaso(CON_LEAD, { etapa: 'contactado' }, { leadId: 42 }), { etapa: 'contactado', leadId: 42 });
  assert.deepEqual(paramsDelPaso(CON_LEAD, { leadId: LEAD_DEL_EVENTO, etapa: 'x' }, { leadId: 7 }), { leadId: 7, etapa: 'x' });
  // Un lead fijado a mano en el paso gana: el dueño eligió a esa persona.
  assert.deepEqual(paramsDelPaso(CON_LEAD, { leadId: 99 }, { leadId: 42 }), { leadId: 99 });
  // Sin lead en el evento no se inventa: el validador del registro dirá que falta.
  assert.deepEqual(paramsDelPaso(CON_LEAD, { leadId: LEAD_DEL_EVENTO }, {}), {});
  // Una acción que no pide lead no recibe uno.
  assert.deepEqual(paramsDelPaso(SIN_LEAD, { nombre: 'a' }, { leadId: 42 }), { nombre: 'a' });
  // Los vacíos no viajan: un campo que el dueño dejó en blanco no es un «» que pisa un default.
  assert.deepEqual(paramsDelPaso(SIN_LEAD, { nombre: '  ' }, {}), {});
  assert.equal(pideLead(CON_LEAD), true);
  assert.equal(pideLead(SIN_LEAD), false);
});

test('Las personas de una propuesta de leads: una sola o un lote, y sin nombre no hay persona', () => {
  assert.deepEqual(filasDeLeads({ nombre: 'Ana', telefono: '5215512345678', email: 'A@X.COM' }), [{ nombre: 'Ana', email: 'a@x.com', telefono: '5215512345678', empresa: null }]);
  assert.equal(filasDeLeads({ leads: [{ nombre: 'Ana', email: 'a@x.com' }, { nombre: '', email: 'b@x.com' }, { nombre: 'Bea', telefono: '1' }] }).length, 2);
  assert.deepEqual(filasDeLeads(null), []);
});

test('La clave de un flujo es canal `app` y dice que vino de una automatización', () => {
  assert.ok(PREFIJO_FLUJO.startsWith(PREFIJO_APP), 'si deja de empezar con app:, el confirmar lo trata como WhatsApp');
  assert.equal(canalDeClave(`${PREFIJO_FLUJO}aviso:x`), 'app');
  assert.equal(etiquetaDeCanal(`${PREFIJO_FLUJO}aviso:x`), 'vino de una automatización');
  assert.equal(etiquetaDeCanal('app:123'), 'vino del chat de la app');
});

const FLUJO = sinComentarios(leer('../lib/api-mako/flujo.ts'));

test('⚠️ EL EJECUTOR NO TIENE UN CAMINO DE ESCRITURA PROPIO: pasa por el choke point del registro', () => {
  assert.match(FLUJO, /await ejecutarOperacion\(def\.id, input, ctx, 'json'\)/, 'el paso dejó de validar y preparar por el registro');
  assert.match(FLUJO, /confirmarPendiente\(ctx, r\.pendiente\.id\)/);
  assert.match(FLUJO, /aplicarPropuestaGenerica\(id, null, ctx\)/);
  assert.ok(!/\.from\(['"]/.test(FLUJO), 'el ejecutor escribe directo en una tabla: eso es una segunda implementación de cada acción');
});

test('⚠️ TODA ACCIÓN DE PANTALLA PROPIA TIENE SU FORMA DE APLICARSE EN EL EJECUTOR', () => {
  // Las que traen `proponer` propio no se aplican con la pantalla genérica: cada una tiene
  // su tabla y su forma. Medido el 08/10/2026: son 7. Una nueva que no se maneje acá
  // terminaría en `aplicarPropuestaGenerica`, que contesta «la propuesta no existe».
  const dir = new URL('../lib/api-mako/areas/', import.meta.url);
  const propias: string[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.run.ts'))) {
    const src = leer(`../lib/api-mako/areas/${f}`).split('\n');
    src.forEach((l, i) => {
      if (/^\s*proponer: async/.test(l)) {
        for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
          const m = /^\s{2}([a-z_]+): \{/.exec(src[j]);
          if (m) { propias.push(m[1]); break; }
        }
      }
    });
  }
  assert.equal(propias.length, 7, `cambió la cantidad de acciones con pantalla propia: ${propias.join(', ')}`);
  for (const id of propias) assert.ok(FLUJO.includes(`'${id}'`), `«${id}» tiene pantalla propia y el ejecutor de flujos no sabe aplicarla`);
});

test('El editor recibe el catálogo por la API, no importando el registro', () => {
  const ruta = sinComentarios(leer('../app/api/flujos/acciones/route.ts'));
  assert.match(ruta, /accionesParaFlujo\(ws\)/);
  assert.match(ruta, /rol !== 'admin'/, 'cualquiera del equipo podría ver qué configura el admin');
});

test('El catálogo lo pide UN lector (EditorAccionMako): los lienzos usan su hook, no un fetch propio', () => {
  // Los dos lienzos nacieron con su propia copia del fetch y de la caché, porque el editor no
  // exportaba la suya. Verificado rompiéndolo (08/10/2026): con el fetch de vuelta en
  // FlujoAviso.tsx, 1 fallo; sin él, pasa.
  const pidenElCatalogo: string[] = [];
  const barrer = (rel: string) => {
    for (const ent of readdirSync(new URL(rel, import.meta.url), { withFileTypes: true })) {
      const p = `${rel}${ent.name}`;
      if (ent.isDirectory()) { if (ent.name !== 'api' && ent.name !== 'node_modules') barrer(`${p}/`); continue; }
      if (!/\.tsx?$/.test(ent.name)) continue;
      if (/fetch\(\s*['"`]\/api\/flujos\/acciones/.test(sinComentarios(leer(p)))) pidenElCatalogo.push(p.replace('../', ''));
    }
  };
  barrer('../app/');
  assert.deepEqual(pidenElCatalogo, ['app/_components/EditorAccionMako.tsx']);
  for (const lienzo of ['../app/agencia/FlujoAviso.tsx', '../app/chatbot/FlujoLienzo.tsx']) {
    assert.match(sinComentarios(leer(lienzo)), /useTitulosAcciones\(/, `${lienzo} no usa el lector compartido de títulos`);
  }
});
