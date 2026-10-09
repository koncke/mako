// =============================================================================
// /crm/revisar/<id>: lo que una propuesta de lead trae ADEMÁS de la tabla
// =============================================================================
// Lo que se perdía al confirmar una propuesta —sobre todo las de la LANDING, que caen acá
// cuando el contacto ya existe o cuando el alta directa falla—:
//   · el «ya existe» no se mostraba: el botón decía «Crear 1 lead», el server descubría el
//     duplicado al confirmar, lo omitía en silencio y la persona no quedaba en ningún lado;
//   · los PRODUCTOS que pidió: el lead nacía en el embudo del negocio, y el que ya existía
//     no se agregaba a ninguno («agregar, nunca mover»);
//   · la ATRIBUCIÓN: nacía como «importación», sin campaña, sin fbclid y sin la visita.
//
// ⚠️ PROBADO ROMPIÉNDOLO (9 tests, 09/10/2026, base en 0 fallos, restaurando de memoria).
// Cada rotura da 1 fallo y 8 pases, y cada una tira un test distinto o una aserción
// distinta del mismo:
//   · el repetido naciendo tildado · la atribución también para Claude · copiar campos
//     vacíos · aceptar ids de producto basura · «Llegó de tu landing» borrado · la página
//     sin `marcarExistentes` · el botón sin contar «completar» · al que ya estaba sólo los
//     productos que siguen a la casa · la atribución también a la ficha que ya existía ·
//     confirmar sin pasar la casa · el importador sin el id de lo completado · el opt-in
//     sin `funnels` en la propuesta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  filasDePropuesta, filasIniciales, productosDePropuesta, atribucionDePropuesta, quienPropuso,
} from '../app/crm/revisar/[id]/propuesta-lead';

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('filasDePropuesta: el lote y la forma vieja, con ids p<i> que el server reconoce', () => {
  const f = filasDePropuesta({ leads: [{ nombre: 'Ana', email: 'a@x.test' }, { nombre: 'Bruno', telefono: '5512345678' }] });
  assert.deepEqual(f.map((x) => x.id), ['p0', 'p1']);
  assert.equal(f[0].nombre, 'Ana');
  const vieja = filasDePropuesta({ nombre: 'Carla', email: 'c@x.test' });
  assert.deepEqual(vieja.map((x) => [x.id, x.nombre]), [['p0', 'Carla']]);
});

test('filasIniciales: el que ya existe se ve como tal y nace DESTILDADO', () => {
  const marcadas = filasDePropuesta({ leads: [{ nombre: 'Ana', email: 'a@x.test' }, { nombre: 'Bruno', email: 'b@x.test' }] })
    .map((f) => (f.id === 'p0' ? { ...f, yaExiste: true, leadExistenteId: 77 } : f));
  const [ana, bruno] = filasIniciales(marcadas);
  assert.equal(ana.motivo, 'duplicado');
  assert.equal(ana.incluir, false, 'el repetido nace destildado, como en el importador');
  assert.equal(ana.leadExistenteId, 77, 'y conserva a quién completar');
  assert.equal(bruno.motivo ?? null, null);
  assert.equal(bruno.incluir, true);
});

test('productosDePropuesta: en orden, sin repetidos, con el del negocio (null) y sin basura', () => {
  assert.deepEqual(productosDePropuesta({ funnels: [18, null, 18, '22', 0, -3, 'x', 2.5, null] }), [18, null, 22]);
  assert.deepEqual(productosDePropuesta({}), [], 'Claude y WhatsApp no traen productos');
  assert.deepEqual(productosDePropuesta({ funnels: 'no' }), []);
});

test('atribucionDePropuesta: sólo la landing, sólo lo que vino, por id de fila', () => {
  const datos = { leads: [
    { nombre: 'Ana', utm_campaign: '120211', fbclid: 'fb.1', visitor_id: 'v-1', utm_source: '' },
    { nombre: 'Bruno' },
  ] };
  const a = atribucionDePropuesta('landing', datos);
  assert.deepEqual(a.p0, { origen_lead: 'landing', utm_campaign: '120211', fbclid: 'fb.1', visitor_id: 'v-1' });
  assert.deepEqual(a.p1, { origen_lead: 'landing' }, 'lo que no vino no se inventa');
  assert.deepEqual(atribucionDePropuesta('claude', datos), {}, 'una propuesta de Claude no trae campaña');
  assert.deepEqual(atribucionDePropuesta('whatsapp', datos), {});
});

test('quienPropuso: «Claude» sólo si fue Claude', () => {
  assert.equal(quienPropuso('landing', {}), 'Llegó de tu landing');
  assert.ok(!quienPropuso('whatsapp', {}).includes('Claude'));
  assert.ok(!quienPropuso('app', {}).includes('Claude'));
  assert.equal(quienPropuso('claude', { origen: 'Gmail' }), 'Lo propuso Claude desde Gmail');
});

test('la página resuelve el «ya existe» ANTES de dibujar', () => {
  const page = sinComentarios(leer('../app/crm/revisar/[id]/page.tsx'));
  assert.match(page, /filasIniciales\(await marcarExistentes\(crudas\)/);
  const comp = sinComentarios(leer('../app/crm/revisar/[id]/RevisarLead.tsx'));
  assert.match(comp, /useState<FilaImport\[\]>\(iniciales\)/, 'el componente usa las filas del server, no las suyas');
  assert.match(comp, /const haceAlgo = c\.tildadas \+ c\.aEnriquecer;/, 'completar también es hacer algo');
  assert.match(comp, /puedeAvanzar=\{haceAlgo > 0\}/);
  assert.ok(!/Lo propuso Claude/.test(comp), 'el origen lo dice quienPropuso, no una constante');
});

test('confirmar: la casa es el primer producto, la atribución va a lo CREADO y los productos se AGREGAN', () => {
  const src = sinComentarios(leer('../app/crm/revisar/[id]/acciones.ts'));
  assert.match(src, /casaParaEscribir\(productos\[0\], defaultId\)/);
  assert.match(src, /importarLeadsRevisadosAction\(filas, casa\)/);
  assert.match(src, /const creados = \(r\.ids \?\? \[\]\)\.filter\(\(x\) => x\.destino === 'crear'\);/,
    'una ficha que ya existía conserva su primer contacto');
  assert.match(src, /x\.destino === 'crear' \? productos\.slice\(1\) : productos/,
    'al nuevo, lo que sigue a su casa; al que ya estaba, todos');
  assert.match(src, /agregarAProducto\(x\.leadId, real\)/);
  assert.ok(!/updateLead|moverLead|setPipelineStage/.test(src), 'agregar, nunca mover');
});

test('el importador devuelve QUÉ lead quedó detrás de cada fila (crear y completar)', () => {
  const src = sinComentarios(leer('../app/crm/actions.ts'));
  assert.match(src, /ids\.push\(\{ filaId: f\.id, leadId: f\.leadExistenteId, destino: 'enriquecer' \}\);/);
  assert.match(src, /ids\.push\(\{ filaId: f\.id, leadId: creado\.id, destino: 'crear' \}\);/);
  assert.match(src, /errores: errores\.slice\(0, 20\), ids \};/);
});

test('el opt-in guarda en la propuesta los productos que pidió', () => {
  const src = sinComentarios(leer('../app/api/track/optin/route.ts'));
  const ini = src.indexOf('await crearPropuesta({');
  assert.ok(ini > 0);
  assert.match(src.slice(ini, ini + 2500), /funnels: funnelesDelLead,/);
});
