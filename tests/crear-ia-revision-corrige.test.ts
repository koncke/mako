// =============================================================================
// #847: «Crear con IA se quedó pensando» — la revisión va al «Corregir», no al proveedor siguiente (17/10/2026)
// =============================================================================
// Martín en la llamada con Joan (Fathom 863534246, 24:29 y 26:03): «al crear una automatización tarda bastante...
// si tarda muchísimo seguramente debe ser un error de algo». Lo era. ws13, 16/10 21:27-21:29 UTC (anthropic_usage y el
// log de Vercel): Joan pidió «el día y hora de la reunión» en el aviso de un pre-R1; Gemini, Groq dos veces y el Gemini
// de la red escribieron JSON que se LEÍA, los cuatro con el mismo error de la revisión («un dato de la reunión sin
// mirarla»), un Gemini se colgó 100 s, el plazo se fue y el «Corregir» —el único que le dice al modelo qué quedó mal—
// nunca corrió. Ahora la primera pasada para en el primer error de revisión (`pararEnRevision`) y va al «Corregir»;
// y el error dice el arreglo de una tarjeta («reunion_en_pie» delante), que la persona no ve (`paraLaPersona`).
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-847.json`; base 3 / 0). Pasan / fallan:
//   C1 la primera pasada sin `pararEnRevision: true` (sigue probando proveedores)          → 1 / 2
//   C2 `validar` vuelve a devolver false con un error de revisión                          → 2 / 1
//   C3 el error de la reunión sin nombrar `reunion_en_pie`                                  → 2 / 1
//
// Correr: node --import tsx --test tests/crear-ia-revision-corrige.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { deIA, validarIA, falloDeRevision, LISTA_BLANCA_IA, type CtxIA } from '../lib/flujo-ia';
import { porId } from '../lib/api-mako/registro';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';

// El contexto mínimo de tests/flujo-ia.test.ts (`ctxBase`): un producto con «Agendado» y la acción del aviso.
const PRODUCTOS = [{ funnelId: 3, productoId: null, nombre: 'Mentoría', esDefault: true, etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }], etapasEntrega: [] }];
const ctxBase = (): CtxIA => ({
  etiquetas: [], productos: PRODUCTOS, disparadores: [{ value: 'trigger:instant_form_sin_agenda', label: 'Formulario sin agenda' }],
  audios: [], archivos: [], links: {},
  acciones: LISTA_BLANCA_IA.map((id) => { const d = porId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; }),
  catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }),
});
const rndDe = () => { let k = 0; return () => ((k++ * 0.137) % 1); };

const RAIZ = join(import.meta.dirname, '..');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

function hijo(codigo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}

// La cascada de mentira: CUATRO proveedores que escriben un JSON legible con el MISMO error (lo que pasó el 16/10), y
// el «Corregir» (su `user` trae los problemas) que lo arregla. Se cuenta cuántas salidas revisó cada pasada.
const HIJO = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const log = { pasadas: [] };
const ai = await import(${url('lib/ai-cheap.ts')});
mock.module(${url('lib/ai-cheap.ts')}, { exports: { ...real(ai), chatCheapCascade: async (o) => {
  const corrige = o.user.includes('TU RESPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS');
  const salidas = corrige ? ['{"bien": true}'] : ['{"mal": 1}', '{"mal": 2}', '{"mal": 3}', '{"mal": 4}'];
  const vistas = [];
  log.pasadas.push({ corrige, vistas });
  for (const t of salidas) { vistas.push(t); if (o.validar(t)) return t; }
  return '';
} } });
mock.module(${url('lib/model-registry.ts')}, { exports: { ...real(await import(${url('lib/model-registry.ts')})), overrideDeFeature: async () => null } });
const { generar } = await import(${url('lib/flujo-ia-crear.ts')});
const r = await generar({
  system: 's', user: 'u', hastaMs: Date.now() + 200_000,
  traducir: (obj) => (obj.bien ? { r: { avisos: [], ok: true }, errores: [] } : { r: { avisos: [] }, errores: ['un texto usa un dato de la reunión sin mirarla antes'] }),
});
console.log(JSON.stringify({ log, r }));
`;

test('un JSON que se lee pero no pasa la revisión va DIRECTO al «Corregir»: no se le repite el pedido a otro proveedor', () => {
  const { log, r } = hijo(HIJO) as { log: { pasadas: Array<{ corrige: boolean; vistas: string[] }> }; r: { r?: { ok?: boolean }; error?: string } };
  assert.equal(log.pasadas.length, 2, JSON.stringify(log));
  assert.equal(log.pasadas[0]!.corrige, false);
  assert.deepEqual(log.pasadas[0]!.vistas, ['{"mal": 1}'], 'la primera pasada siguió probando proveedores con el mismo pedido');
  assert.equal(log.pasadas[1]!.corrige, true, 'el segundo intento no fue el «Corregir»');
  assert.equal(r.r?.ok, true, JSON.stringify(r));
});

test('el error del dato de la reunión le dice al modelo el arreglo de UNA tarjeta, y a la persona sólo qué quedó mal', () => {
  const ctx = ctxBase();
  const { pasos } = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'accion', operacion: 'avisar_al_equipo', datos: { mensaje: '{{nombre_completo}} agendó para {{reunion_cuando}}' } },
  ] }, ctx, rndDe());
  const e = validarIA(pasos, ctx).find((x) => x.includes('dato de la reunión'));
  assert.ok(e, validarIA(pasos, ctx).join(' | '));
  assert.match(e!, /"campo": "reunion_en_pie"/, 'el «Corregir» no sabe qué tarjeta poner');
  const t = falloDeRevision([e!], pasos);
  assert.match(t, /: Un texto usa un dato de la reunión sin mirarla antes\. Prueba de nuevo/);
  assert.doesNotMatch(t, /reunion_en_pie|reunion en pie|campo/, `a la persona le llegó la clave del JSON: ${t}`);
});

test('la primera pasada para en la revisión; el «Corregir» sí prueba los demás proveedores', () => {
  // (El hijo de arriba lo EJECUTA; esto fija que el «Corregir» no herede el freno: con los errores en el pedido, otro
  // proveedor puede arreglarlo.)
  const src = execFileSync(process.execPath, ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(join(RAIZ, 'lib/flujo-ia-crear.ts'))}, 'utf8'))`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  assert.match(src, /const uno = await pasada\(\{ \.\.\.p, motivo, hastaMs, provs, modelos, errores, erroresRed, pararEnRevision: true \}\);/);
  assert.match(src, /const dos = await pasada\(\{ \.\.\.p, user: corregir, motivo: `Corregir · \$\{motivo\}`, hastaMs, provs, modelos, errores, erroresRed \}\);/);
});
