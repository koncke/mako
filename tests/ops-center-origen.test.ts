// =============================================================================
// Cada chat dice de dónde viene, y se ven los del CRM y la ficha (22/10/2026, OC4)
// =============================================================================
// La lista del Ops Center del cliente pintaba «de antes» sólo con el título, y listaba por la clave EXACTA: las 68
// conversaciones del CRM (`mako-movil:<persona>:crm:<id>`) y las de la ficha de un lead (`:lead:<id>`) no aparecían nunca.
//   1. el origen sale de la clave (CRM, Ficha, Dashboard, Ads, Automations) y va adelante del título, «Origen › título»;
//   2. los de las tabs de la persona se listan con los de antes y se SIGUEN igual (la ruta prueba las dos reglas);
//      el prefijo lleva su «:» (sin él, `mako-movil:ana` traería los de `mako-movil:anabel`);
//   3. el botón para conectar la IA dice «Conectar tu IA» (Claude o GPT).
//
// Correr: node --import tsx --test tests/ops-center-origen.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conOrigen, listaDelCliente, origenDeClave } from '../lib/chat-mako-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el origen sale de la clave (las formas medidas el 22/10) y va adelante del título', () => {
  const casos: Array<[string, string | null]> = [
    ['mako-movil:ana@x.com:crm:12', 'CRM'], ['mako-movil:ana@x.com:lead:7', 'Ficha'],
    ['dashboard:hoja1:mk-cac', 'Dashboard'], ['comercial-revenue-mensual', 'Dashboard'], ['marketing-funnel', 'Dashboard'],
    ['ad-detail-120237960510320570', 'Ads'], ['mkt-campaign-120237959905760570', 'Ads'], ['marketing-ad-120244631031330570', 'Ads'],
    ['whatsapp-secuencias', 'Automations'], ['mako-general', null], ['mako-movil:ana@x.com', null], ['', null],
  ];
  for (const [k, o] of casos) assert.equal(origenDeClave(k), o, k);
  assert.equal(conOrigen('CRM', 'Seguimiento'), 'CRM › Seguimiento');
  assert.equal(conOrigen(null, 'Seguimiento'), 'Seguimiento');
  const lista = listaDelCliente({
    sesiones: [], offer: [], busca: '',
    antes: [
      { id: 1, titulo: 'Seguimiento de Ana', clave: 'mako-movil:p:crm:4', updatedAt: '2026-10-22T10:00:00Z' },
      { id: 2, titulo: '¿Cómo vamos?', clave: 'comercial-revenue-mensual', updatedAt: '2026-10-22T09:00:00Z' },
      { id: 3, titulo: 'Lo que dijo', origen: 'Ficha · Ana', updatedAt: '2026-10-22T08:00:00Z' },
      { id: 4, titulo: 'Viejo', clave: 'mako-general', updatedAt: '2026-10-22T07:00:00Z' },
      { id: 5, titulo: null, clave: 'mako-movil:p:crm:9', updatedAt: '2026-10-22T06:00:00Z' },
      { id: 6, titulo: null, clave: 'mako-general', updatedAt: '2026-10-22T05:00:00Z' },
    ],
  });
  assert.deepEqual(lista.slice(1).map((f) => f.titulo), ['CRM › Seguimiento de Ana', 'Dashboard › ¿Cómo vamos?', 'Ficha · Ana › Lo que dijo', 'Viejo', 'CRM', 'Chat de antes'],
    'sin título, su origen solo');
  assert.equal(lista[1].criatura, 'CRM', 'la criatura de su área');
});

test('2. los de las tabs de la persona se listan con los de antes y se siguen igual, sólo los suyos', () => {
  const indice = sinComentarios(leer('lib/chat-mako-indice.ts'));
  assert.match(indice, /listSessionsDePersona\(`\$\{p\.chartKey\}:`\)/, 'el prefijo con su «:»');
  assert.match(indice, /s\.chart_key\.startsWith\(`\$\{p\.chartKey\}:`\) && origenDeClave\(s\.chart_key\) \? s\.chart_key : null/, 'sólo una de SUS tabs');
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /const chartKey = \(q \? await claveDeAntes\(q, sessionId\) : null\) \?\? await claveDeTab\(persona, sessionId\);/);
  assert.match(ruta, /const \[deAntes, deTabs\] = await Promise\.all\(\[chatsDeAntes\(q\), chatsDeLasTabs\(persona\)\]\);/);
});

test('3. el botón dice «Conectar tu IA» (Claude o GPT)', () => {
  const piezas = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  assert.match(piezas, />Conectar tu IA<\/button>/);
  assert.doesNotMatch(piezas, /Conectar tu Claude/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 3/0):
//   · el CRM sin su origen en origenDeClave                    → 2/1 (1)
//   · la fila de antes sin `conOrigen`                          → 2/1 (1)
//   · el prefijo sin su «:»                                     → 2/1 (2)
//   · la ruta sin probar la regla de las tabs                   → 2/1 (2)
