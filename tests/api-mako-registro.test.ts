// =============================================================================
// El registro de operaciones de la API de MaKo: lo que tiene que ser cierto SIEMPRE
// =============================================================================
// El registro (lib/api-mako/registro.ts) es de donde salen el catálogo HTTP, los
// ToolDefs del doer, la referencia y la skill. Estas son las cosas que, si se
// rompen, no dan error en ningún lado: una def sin runner contesta 500 en
// producción; un id repetido hace que una tool pise a otra; una acción sin
// confirmación declarada no compila, pero un `as` la deja pasar; un `'use client'`
// que importe el registro manda cientos de descripciones al bundle de cada cliente;
// una ruta de /api/v1 que no esté en PUBLICOS la corta el middleware antes de mirar
// el bearer — y en local no se nota; y una lectura que salga por HTTP sin que nadie
// lo haya DECIDIDO es una lista derivada, que es lo que la casa prohíbe.
//
// Las defs se importan de verdad (no llevan server-only, a propósito). Los runners
// sí, así que se leen del fuente.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { REGISTRO, porId, aToolDef, toolsDelRegistro, visible, gatingOk, catalogo, PROBLEMAS_DE_CARGA, type Vista } from '../lib/api-mako/registro';
import { AREAS, CANALES, esAccion, esControl, esLectura, alcanceMinimo } from '../lib/api-mako/tipos';
import { validarInput, esquemaJson } from '../lib/api-mako/validar';
import { canalKeyDe, canalDeClave, puedeConfirmar } from '../lib/api-mako/canal';
import { alcanceDeToken, prefijoDeAlcance, permite } from '../lib/api-mako/alcance';
import { esPublica } from '../lib/rutas-publicas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
/** El fuente sin comentarios. Un chequeo por regex sobre el fuente CRUDO matchea la
 *  cabecera que explica la regla, y da verde con el código borrado. */
const sinComentarios = (src: string) => src.replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1').replace(/(^|[^A-Za-z0-9_])\/\*[\s\S]*?\*\//g, '$1');

function archivos(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (['node_modules', '.next', 'graphify-out', 'plugin'].includes(e) || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) archivos(p, out);
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

const vistaHttp = (alcance: 'lectura' | 'proponer' | 'ejecutar' = 'ejecutar', ws = 9): Vista => ({ canal: 'http', alcance, ws, rol: 'admin', tabs: null });

test('el registro cargó sin problemas (ids únicos, snake_case, alias que no pisan)', () => {
  assert.deepEqual(PROBLEMAS_DE_CARGA, []);
  assert.ok(REGISTRO.length >= 3, `hay ${REGISTRO.length} operaciones`);
  for (const d of REGISTRO) {
    assert.match(d.id, /^[a-z][a-z0-9_]*$/, `«${d.id}» no es snake_case`);
    assert.ok((AREAS as readonly string[]).includes(d.area), `«${d.id}» tiene un área desconocida: ${d.area}`);
    for (const a of d.alias ?? []) assert.equal(porId(a)?.id, d.id, `el alias «${a}» no resuelve a «${d.id}»`);
  }
});

test('toda def tiene su runner en el .run.ts de su área, y todo runner tiene def', () => {
  const porArea = new Map<string, Set<string>>();
  for (const a of AREAS) {
    const p = join(RAIZ, 'lib', 'api-mako', 'areas', `${a}.run.ts`);
    assert.ok(existsSync(p), `falta ${p}`);
    const s = leer(p);
    assert.match(s, /^import 'server-only';$/m, `${a}.run.ts tiene que llevar server-only: toca la base`);
    porArea.set(a, new Set([...s.matchAll(/^\s{2}'?([a-z][a-z0-9_]*)'?:\s*\{/gm)].map((m) => m[1])));
  }
  const ids = new Set(REGISTRO.map((d) => d.id));
  for (const d of REGISTRO) assert.ok(porArea.get(d.area)?.has(d.id), `«${d.id}» (${d.area}) está en el catálogo y no tiene runner en ${d.area}.run.ts`);
  for (const [a, claves] of porArea) for (const k of claves) assert.ok(ids.has(k), `${a}.run.ts implementa «${k}» y ninguna .def.ts la declara`);
});

test('las defs, tipos, registro, docs, canal y alcance NO importan valores de módulos con server-only', () => {
  // El generador de la referencia corre con `node --import tsx` sin `--conditions
  // react-server`: un import transitivo de server-only revienta el pre-push de las
  // dos cuentas con un error que no nombra la def. Se mira el ARCHIVO DESTINO de
  // cada import, no una lista escrita a mano.
  const libres = [
    ...AREAS.map((a) => join(RAIZ, 'lib', 'api-mako', 'areas', `${a}.def.ts`)),
    ...['tipos', 'registro', 'docs', 'canal', 'alcance', 'validar'].map((m) => join(RAIZ, 'lib', 'api-mako', `${m}.ts`)),
  ];
  for (const archivo of libres) {
    const s = leer(archivo);
    assert.ok(!/^import 'server-only';$/m.test(s), `${archivo} lleva server-only`);
    for (const m of s.matchAll(/^import\s+(?!type\s)[^;]*?\s+from\s+['"]([^'"]+)['"]/gm)) {
      const mod = m[1];
      let destino: string;
      if (mod.startsWith('@/')) destino = join(RAIZ, mod.slice(2));
      else if (mod.startsWith('.')) destino = resolve(dirname(archivo), mod);
      else continue; // un paquete de node_modules
      const ruta = ['.ts', '.tsx', '/index.ts'].map((ext) => destino + ext).find(existsSync);
      assert.ok(ruta, `${archivo.slice(RAIZ.length)} importa «${mod}» y no lo encuentro`);
      assert.ok(!/^import 'server-only';$/m.test(leer(ruta!)), `${archivo.slice(RAIZ.length)} importa un VALOR de «${mod}», que lleva server-only`);
    }
  }
});

test('cada operación declara canales en positivo, y lo que sale por HTTP es una decisión', () => {
  for (const d of REGISTRO) {
    assert.ok(Array.isArray(d.canales) && d.canales.length > 0, `«${d.id}» no declara canales`);
    for (const c of d.canales) assert.ok((CANALES as readonly string[]).includes(c), `«${d.id}»: canal desconocido ${c}`);
  }
  // EL SNAPSHOT. Es el reemplazo de «LA GUARDA» de agente-consultas: lo que se
  // expone a un token que vive en la máquina de un tercero. Si cambia, alguien
  // DECIDIÓ que cambie y actualiza esta lista en el mismo commit.
  const http = REGISTRO.filter((d) => d.canales.includes('http')).map((d) => d.id).sort();
  const esperado = leer(join(RAIZ, 'tests', 'api-mako-http.snapshot.txt')).split('\n').map((s) => s.trim()).filter(Boolean).sort();
  assert.deepEqual(http, esperado,
    'cambió el conjunto de operaciones que salen por HTTP. Si es a propósito, regenerá tests/api-mako-http.snapshot.txt ' +
    '(node --import tsx scripts/generar-api-doc.mjs lo escribe) y commitealo con el cambio.');
});

test('toda acción declara confirmación, reversible, escribe y pantalla si es de pantalla; los controles solo en mako', () => {
  for (const d of REGISTRO) {
    assert.ok(d.descripcion.trim().length >= 40, `«${d.id}»: la descripción es lo que lee el modelo; ${d.descripcion.length} caracteres no alcanzan`);
    assert.ok(d.titulo.trim().split(/\s+/).length <= 8, `«${d.id}»: el título es de 3-6 palabras`);
    if (esAccion(d)) {
      assert.ok(['chat', 'pantalla'].includes(d.confirmacion), `«${d.id}»: confirmación inválida ${String(d.confirmacion)}`);
      assert.equal(typeof d.reversible, 'boolean', `«${d.id}» no dice si es reversible`);
      assert.ok(d.escribe.trim().length > 10, `«${d.id}» no dice qué escribe`);
      if (d.confirmacion === 'pantalla') {
        assert.ok(d.pantalla, `«${d.id}» es de pantalla y no dice cuál`);
        const page = join(RAIZ, 'app', ...d.pantalla!.split('/').filter(Boolean), '[id]', 'page.tsx');
        const bandeja = join(RAIZ, 'app', ...d.pantalla!.split('/').filter(Boolean), 'page.tsx');
        assert.ok(existsSync(page) || existsSync(bandeja), `«${d.id}» apunta a ${d.pantalla} y esa pantalla no existe en app/`);
      }
      if (d.costo === 'dinero') assert.equal(d.confirmacion, 'pantalla', `«${d.id}» gasta plata: se confirma en pantalla, nunca por chat`);
      if (d.costo === 'dinero') assert.equal(d.gating?.rolMinimo, 'admin', `«${d.id}» gasta plata: solo el admin`);
    } else if (esControl(d)) {
      assert.equal(d.area, 'mako', `«${d.id}» es un control y solo el área mako puede tenerlos`);
      assert.ok(['confirmar_accion', 'cancelar_accion'].includes(d.id), `«${d.id}»: los controles son solo confirmar y cancelar`);
    } else {
      assert.ok(['json', 'markdown', 'texto'].includes(d.salida), `«${d.id}»: salida inválida`);
    }
  }
  assert.equal(alcanceMinimo(porId('confirmar_accion')!), 'ejecutar');
  assert.equal(alcanceMinimo(porId('cancelar_accion')!), 'proponer');
});

test('los parámetros están bien formados', () => {
  const revisar = (id: string, ps: readonly { nombre: string; tipo: string; enum?: readonly string[]; campos?: readonly unknown[]; max?: number }[], nivel: string) => {
    const nombres = new Set<string>();
    for (const p of ps) {
      assert.match(p.nombre, /^[a-zA-Z][a-zA-Z0-9_]*$/, `«${id}»: parámetro «${nivel}${p.nombre}» con nombre raro`);
      assert.ok(!nombres.has(p.nombre), `«${id}»: parámetro «${nivel}${p.nombre}» repetido`);
      nombres.add(p.nombre);
      if (p.enum) assert.ok(p.enum.length > 0 && ['string', 'string[]'].includes(p.tipo), `«${id}»: «${nivel}${p.nombre}» tiene enum vacío o sobre un tipo que no lo admite`);
      if (p.max != null) assert.ok(p.max > 0 && ['string', 'string[]', 'object[]'].includes(p.tipo), `«${id}»: «${nivel}${p.nombre}» declara max sobre un tipo que no lo usa`);
      if (p.tipo === 'object' || p.tipo === 'object[]') {
        assert.ok(p.campos && p.campos.length, `«${id}»: «${nivel}${p.nombre}» es object y no declara campos`);
        revisar(id, p.campos as never, `${nivel}${p.nombre}.`);
      } else {
        assert.ok(!p.campos, `«${id}»: «${nivel}${p.nombre}» no es object y declara campos`);
      }
    }
  };
  for (const d of REGISTRO) revisar(d.id, d.parametros, '');
});

test('el ToolDef derivado tiene el esquema de Claude, con required solo de los obligatorios', () => {
  for (const d of REGISTRO) {
    const t = aToolDef(d);
    assert.equal(t.name, d.id);
    const req = ((t.input_schema as { required?: string[] }).required ?? []).sort();
    assert.deepEqual(req, d.parametros.filter((p) => p.obligatorio).map((p) => p.nombre).sort(), `«${d.id}»: required no coincide con los obligatorios`);
  }
});

test('la vista decide qué existe: canal, alcance, ws principal, rol y capa', () => {
  const confirmar = porId('confirmar_accion')!;
  assert.equal(visible(confirmar, vistaHttp('proponer')), false, 'confirmar no existe para un token que solo propone');
  assert.equal(visible(confirmar, vistaHttp('ejecutar')), true);
  assert.equal(visible(porId('cancelar_accion')!, vistaHttp('proponer')), true, 'cancelar lo propio no exige ejecutar');
  assert.equal(visible(porId('listar_pendientes')!, vistaHttp('lectura')), true);
  const fingida = { ...porId('listar_pendientes')!, gating: { soloWs1: true as const, tab: 'crm', rolMinimo: 'admin' as const } };
  assert.equal(visible(fingida, vistaHttp('lectura', 9)), false, 'soloWs1: fuera del ws 1 no existe');
  assert.equal(visible(fingida, { ...vistaHttp('lectura', 1), rol: 'miembro' }), false, 'rolMinimo: un miembro no la ve');
  assert.equal(visible(fingida, { ...vistaHttp('lectura', 1), tabs: ['plan'] }), false, 'tab: una capa sin CRM no la ve');
  assert.equal(visible(fingida, { ...vistaHttp('lectura', 1), tabs: ['plan', 'crm'] }), true);
  assert.equal(visible({ ...fingida, gating: undefined, canales: ['whatsapp'] }, vistaHttp('ejecutar')), false, 'canal: lo que no sale por http no existe por http');
  const cat = catalogo(vistaHttp('proponer'));
  assert.ok(!cat.some((a) => a.operaciones.some((o) => o.id === 'confirmar_accion')), 'el catálogo de un token que propone no anuncia confirmar');
  const soloLectura = toolsDelRegistro({ vista: vistaHttp('ejecutar'), incluirAcciones: false });
  assert.ok(soloLectura.every((t) => esLectura(porId(t.name)!)), 'incluirAcciones:false dejó pasar algo que no es lectura');
});

test('el alcance vive en el prefijo del token, fail-closed, y los viejos son proponer', () => {
  const hex = 'a'.repeat(48);
  assert.equal(alcanceDeToken(`mkoag_${hex}`), 'proponer', 'un token acuñado antes del alcance hace lo que ya hacía: proponer');
  assert.equal(alcanceDeToken(`mkoag_l_${hex}`), 'lectura');
  assert.equal(alcanceDeToken(`mkoag_p_${hex}`), 'proponer');
  assert.equal(alcanceDeToken(`mkoag_e_${hex}`), 'ejecutar');
  assert.equal(alcanceDeToken(`mkoag_x_${hex}`), 'lectura', 'una letra desconocida es lo MENOS');
  assert.equal(alcanceDeToken(''), 'lectura');
  assert.equal(alcanceDeToken('basura'), 'lectura');
  for (const a of ['lectura', 'proponer', 'ejecutar'] as const) assert.equal(alcanceDeToken(`${prefijoDeAlcance(a)}${hex}`), a);
  assert.equal(permite('proponer', porId('confirmar_accion')!), false);
  assert.equal(permite('ejecutar', porId('confirmar_accion')!), true);
  assert.equal(permite('lectura', porId('cancelar_accion')!), false);
});

test('la clave de scope no colisiona entre canales, y solo confirma quien tiene a una persona en el circuito', () => {
  for (const jid of ['120363429155511457@g.us', '5491122334455@s.whatsapp.net']) {
    assert.equal(canalDeClave(canalKeyDe('whatsapp', jid)), 'whatsapp');
    assert.ok(!jid.startsWith('api:') && !jid.startsWith('app:'));
  }
  assert.equal(canalDeClave(canalKeyDe('http', 9)), 'http');
  assert.equal(canalDeClave(canalKeyDe('app', 'sesion-42')), 'app');
  assert.equal(puedeConfirmar('whatsapp', 'proponer'), true);
  assert.equal(puedeConfirmar('app', 'lectura'), true);
  assert.equal(puedeConfirmar('http', 'proponer'), false, 'por HTTP nadie confirma sin ejecutar: sería escribir directo con delay');
  assert.equal(puedeConfirmar('http', 'ejecutar'), true);
  assert.equal(puedeConfirmar('http', 'lectura', true), true, 'la bandeja de la app siempre puede');
});

test('la validación: solo pasa lo declarado, coerciona la query, dice qué falta y tiene tope', () => {
  const ps = [
    { nombre: 'leadId', tipo: 'number', descripcion: 'x', obligatorio: true },
    { nombre: 'limite', tipo: 'number', descripcion: 'x' },
    { nombre: 'cual', tipo: 'string', descripcion: 'x', enum: ['R1', 'R2'] },
    { nombre: 'activa', tipo: 'boolean', descripcion: 'x' },
    { nombre: 'nota', tipo: 'string', descripcion: 'x', max: 10 },
  ] as const;
  let r = validarInput(ps, { leadId: '42', limite: '', cual: 'R2', activa: 'true', inventada: 'sí' }, 'query');
  assert.ok('input' in r);
  assert.deepEqual(r.input, { leadId: 42, cual: 'R2', activa: true }, 'la clave inventada no pasa, el vacío no se manda, los tipos se coercionan');
  r = validarInput(ps, {}, 'query');
  assert.ok('error' in r && r.faltan?.includes('leadId'), 'dice qué falta');
  r = validarInput(ps, { leadId: 'el de ana' }, 'query');
  assert.ok('error' in r && /número/.test(r.error), 'un número que no es número se rechaza, no llega como NaN');
  r = validarInput(ps, { leadId: 1, cual: 'R3' }, 'json');
  assert.ok('error' in r && /R1 \| R2/.test(r.error), 'un enum fuera de rango dice cuáles valen');
  r = validarInput(ps, { leadId: 1, nota: 'x'.repeat(11) }, 'json');
  assert.ok('error' in r && /tope de 10/.test(r.error), 'el max declarado corta');
  r = validarInput([{ nombre: 't', tipo: 'string', descripcion: 'x' }], { t: 'x'.repeat(4001) }, 'json');
  assert.ok('error' in r && /4000/.test(r.error), 'sin max declarado, corta en 4000');
  assert.deepEqual(esquemaJson(ps).required, ['leadId']);
});

test('ningún componente cliente importa un VALOR del registro, de las defs ni de la skill', () => {
  const culpables: string[] = [];
  for (const p of [...archivos(join(RAIZ, 'app')), ...archivos(join(RAIZ, 'lib'))]) {
    const s = leer(p);
    if (!/^\s*['"]use client['"]/m.test(s.slice(0, 400))) continue;
    // Con alias Y con ruta relativa: un `../../lib/api-mako/registro` mete lo mismo al bundle.
    for (const m of s.matchAll(/^import\s+(type\s+)?([^;]*?)\s+from\s+['"](?:@\/|(?:\.\.?\/)+)lib\/(api-mako\/[^'"]+|agente-skill)['"]/gm)) {
      const soloTipos = !!m[1] || m[2].replace(/[{}]/g, '').split(',').filter((x) => x.trim()).every((x) => /^\s*type\s/.test(x));
      if (!soloTipos) culpables.push(`${p.slice(RAIZ.length)} → ${m[0].slice(0, 90)}`);
    }
  }
  assert.deepEqual(culpables, [], `estos componentes cliente meten el registro (o la skill, que lo importaría) en el bundle del navegador:\n${culpables.join('\n')}`);
});

test('bajo app/api/v1 hay EXACTAMENTE las rutas previstas, todas bearer, y /api/v1 entra sin sesión', () => {
  // La regla «rutas exactas, nunca prefijo» existe porque en /api/agente conviven
  // bearer y navegador. Acá la carpeta entera es bearer POR CONSTRUCCIÓN, y esto es
  // lo que lo mantiene: una ruta nueva bajo /api/v1 falla acá hasta que alguien
  // decide que también es bearer y la agrega.
  const rutas = archivos(join(RAIZ, 'app', 'api', 'v1')).map((p) => p.slice(join(RAIZ, 'app', 'api', 'v1').length).replace(/\\/g, '/')).sort();
  assert.deepEqual(rutas, ['/[area]/[operacion]/route.ts', '/docs/route.ts', '/route.ts']);
  for (const r of ['/api/v1', '/api/v1/docs', '/api/v1/crm/buscar_leads', '/api/v1/mako/confirmar_accion']) {
    assert.equal(esPublica(r), true, `${r} tiene que estar en PUBLICOS o el middleware lo corta antes del bearer`);
  }
  assert.equal(esPublica('/api/v10'), false, 'el prefijo matchea con la barra, no por parecerse');
  for (const p of archivos(join(RAIZ, 'app', 'api', 'v1'))) {
    const s = leer(p);
    assert.ok(/autenticar\(/.test(s), `${p.slice(RAIZ.length)} no pasa por autenticar()`);
    assert.ok(!/from ['"]next\/headers['"]/.test(s) && !/getUsuarioActual|getSesionAdmin|cookies\(/.test(s), `${p.slice(RAIZ.length)} lee la sesión`);
  }
  // Y el choke point hace el wrap del workspace ÉL, y lo comprueba. Se mira el CÓDIGO
  // sin comentarios: la cabecera de ejecutar.ts nombra las dos cosas para explicarlas,
  // y con el regex sobre el fuente crudo este chequeo dio verde con el wrap BORRADO
  // (revisión adversarial del 16/09/2026: 14 de 14 en verde sin runWithWorkspace).
  const ejecutar = sinComentarios(leer(join(RAIZ, 'lib', 'api-mako', 'ejecutar.ts')));
  assert.match(ejecutar, /return await runWithWorkspace\(ctx\.ws,/, 'ejecutarOperacion tiene que correr el runner dentro de runWithWorkspace(ctx.ws)');
  assert.match(ejecutar, /if \(enCurso !== ctx\.ws\) throw/, 'ejecutarOperacion tiene que comprobar que el workspace en curso sea el del contexto');
});

test('la referencia generada está al día con el registro (docs/api-mako.md)', () => {
  // Mismo criterio que el --check del pre-push, normalizando los \r.
  const { referenciaMarkdown } = require('../lib/api-mako/docs') as typeof import('../lib/api-mako/docs');
  const enDisco = existsSync(join(RAIZ, 'docs', 'api-mako.md')) ? leer(join(RAIZ, 'docs', 'api-mako.md')) : '';
  assert.equal(enDisco.replace(/\r/g, ''), referenciaMarkdown('https://hola-mako.com').replace(/\r/g, ''),
    'docs/api-mako.md quedó viejo: node --import tsx scripts/generar-api-doc.mjs');
});

test('el gating se vuelve a mirar al confirmar, y no depende del canal ni del alcance', () => {
  // Es la guarda que corre en acciones.ts ANTES de reclamar una pendiente o aplicar
  // una propuesta: entre proponer y confirmar puede cambiar quién está (el dueño
  // propone por WhatsApp, un closer abre la bandeja) y la capa del workspace.
  const base = porId('listar_pendientes')!;
  const conGating = { ...base, gating: { soloWs1: true as const, rolMinimo: 'admin' as const, tab: 'crm' } };
  assert.equal(gatingOk(conGating, { ws: 1, rol: 'admin', tabs: ['crm'] }), true);
  assert.equal(gatingOk(conGating, { ws: 1, rol: 'miembro', tabs: ['crm'] }), false, 'un closer en la bandeja no confirma lo que es del admin');
  assert.equal(gatingOk(conGating, { ws: 9, rol: 'admin', tabs: null }), false, 'soloWs1 fuera del ws 1');
  assert.equal(gatingOk(conGating, { ws: 1, rol: 'admin', tabs: ['plan'] }), false, 'una capa sin la tab');
  assert.equal(gatingOk(base, { ws: 9, rol: 'miembro', tabs: [] }), true, 'sin gating, pasa');
  // CADA GUARDA EN SU PROPIO CASO. Con las tres juntas, `soloWs1` rechaza al miembro
  // antes de que `rolMinimo` se evalúe, y borrar la guarda del rol daba verde.
  // Verificado rompiéndolo (16/09/2026): sin la línea de rolMinimo en gatingOk, antes
  // 17 pass / 0 fail; con estos casos, 1 fail. Sin la de `tab`, 1 fail.
  const soloAdmin = { ...base, gating: { rolMinimo: 'admin' as const } };
  assert.equal(gatingOk(soloAdmin, { ws: 9, rol: 'miembro', tabs: null }), false, 'rolMinimo solo: un miembro no pasa');
  assert.equal(gatingOk(soloAdmin, { ws: 9, rol: 'admin', tabs: null }), true, 'rolMinimo solo: el admin de cualquier ws pasa');
  const soloTab = { ...base, gating: { tab: 'crm' } };
  assert.equal(gatingOk(soloTab, { ws: 9, rol: 'admin', tabs: ['plan'] }), false, 'tab sola: una capa sin CRM no pasa');
  assert.equal(gatingOk(soloTab, { ws: 9, rol: 'admin', tabs: null }), true, 'tab sola: sin capa leída (null) no se inventa un rechazo');
  const soloWs1 = { ...base, gating: { soloWs1: true as const } };
  assert.equal(gatingOk(soloWs1, { ws: 1, rol: 'miembro', tabs: null }), false, 'soloWs1 exige además el rol admin');
  assert.equal(gatingOk(soloWs1, { ws: 1, rol: 'admin', tabs: null }), true);
  // y visible() es gatingOk() + canal + alcance: nunca menos.
  assert.equal(visible(conGating, { ...vistaHttp('ejecutar', 1), rol: 'miembro' }), false);
});

test('toda acción con tipoPendiente resuelve por ese tipo, y los slugs heredados nunca apuntan a otra cosa', () => {
  // Las pendientes que dejó el doer de WhatsApp tienen `tipo` = el case de
  // ejecutarAccion. Si un área declara el slug, la confirmación la encuentra; si
  // ninguna lo declara todavía, acciones.ts la corre por el camino viejo. Lo que no
  // puede pasar es que el slug resuelva a una operación que NO es una acción.
  for (const d of REGISTRO) {
    if (esAccion(d) && d.tipoPendiente) assert.equal(porId(d.tipoPendiente)?.id, d.id, `«${d.id}» declara tipoPendiente «${d.tipoPendiente}» y no resuelve`);
  }
  for (const t of ['lead_etapa', 'nutricion_toggle', 'meta_nombre', 'meta_presupuesto', 'meta_estado', 'tareas_plan', 'agendar_reunion']) {
    const d = porId(t);
    if (d) assert.ok(esAccion(d), `el slug heredado «${t}» resuelve a «${d.id}», que no es una acción`);
  }
});

test('la validación: enteros, rangos, carácter nulo y listas obligatorias vacías', () => {
  const ps = [
    { nombre: 'leadId', tipo: 'number', descripcion: 'x', obligatorio: true, entero: true, minimo: 1 },
    { nombre: 'dias', tipo: 'number', descripcion: 'x', minimo: 1, maximo: 90 },
    { nombre: 'etiquetas', tipo: 'string[]', descripcion: 'x', obligatorio: true },
    { nombre: 'nota', tipo: 'string', descripcion: 'x' },
  ] as const;
  const ok = { etiquetas: ['a'] };
  let r = validarInput(ps, { ...ok, leadId: 1.5 }, 'json');
  assert.ok('error' in r && /entero/.test(r.error), '1.5 no es un leadId');
  r = validarInput(ps, { ...ok, leadId: -5 }, 'json');
  assert.ok('error' in r && /al menos 1/.test(r.error), 'un id negativo se rechaza');
  r = validarInput(ps, { ...ok, leadId: 3, dias: 1e12 }, 'json');
  assert.ok('error' in r && /como mucho 90/.test(r.error), 'un rango declarado corta');
  r = validarInput(ps, { ...ok, leadId: 3, nota: 'hola\u0000mundo' }, 'json');
  assert.ok('error' in r && /nulo/.test(r.error), 'un NUL no llega a la base');
  r = validarInput(ps, { leadId: 3, etiquetas: [] }, 'json');
  assert.ok('error' in r && r.faltan?.includes('etiquetas'), 'una lista obligatoria vacía es una lista que no vino');
  r = validarInput(ps, { leadId: 3, etiquetas: ['', ' '] }, 'json');
  assert.ok('error' in r && r.faltan?.includes('etiquetas'), 'y también si queda vacía después de limpiar');
  r = validarInput(ps, { leadId: '7', etiquetas: 'a,b' }, 'query');
  assert.ok('input' in r && r.input.leadId === 7 && Array.isArray(r.input.etiquetas));
  assert.equal((esquemaJson(ps).properties as Record<string, { type: string }>).leadId.type, 'integer');
});

