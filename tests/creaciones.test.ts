// Las creaciones y sus estrellas (pedido de Martín del 13/10/2026, punto 10): las reglas puras
// (lib/creaciones-reglas.ts), la migración 0273, lo que el server deja salir (lib/creaciones.ts) y su lugar
// en la API de MaKo (área «creaciones»). La definición publicable de una automatización tiene su propio test
// (tests/creaciones-automatizacion.test.ts).
//
// Verificado rompiéndolo (13/10/2026), con la base en verde (10 de 10, antes del test del id), cada rotura → 1 fallo y 9 pases:
//   · `porQueNoEstrella` sin el corte de «es tuya».
//   · sacar 'dashboard' de `POR_ENCHUFAR` (un tipo queda sin enchufe y sin dueño).
//   · sacar el `revoke all on creacion_usos` de la migración.
//   · agregar `workspace_origen` al tipo `Creacion` que sale a otros negocios.
//   · cambiar `getSupabaseServer` por `getTenantDb` en lib/creaciones.ts.
//   · sacar `rolMinimo: 'admin'` del gating del área.
//   · borrar la ruta REST de `dar_estrella`.
// Y el test del id (14/10): aflojar la regex de sanearOrigenId → 1 fallo y 10 pases.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENCHUFADOS, INFO_TIPO, POR_ENCHUFAR, TIPOS_CREACION, definicionCabe, normalizarBusqueda, numeroCorto, patronBusqueda,
  porQueNoEstrella, puedeRetirar, sanearOrigenId, sanearPublicacion, TOPE_TITULO_CREACION,
} from '../lib/creaciones-reglas';
import { porArea } from '../lib/api-mako/registro';

const leer = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/^\s*--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('una estrella es de OTRO negocio y de algo publicado', () => {
  assert.equal(porQueNoEstrella({ workspaceOrigen: 9, estado: 'publicada' }, 3), null);
  assert.match(porQueNoEstrella({ workspaceOrigen: 3, estado: 'publicada' }, 3) ?? '', /tuya/);
  assert.match(porQueNoEstrella({ workspaceOrigen: 9, estado: 'retirada' }, 3) ?? '', /publicada/);
  assert.equal(puedeRetirar({ workspaceOrigen: 9 }, 3, false), false, 'un negocio retira lo de otro');
  assert.equal(puedeRetirar({ workspaceOrigen: 9 }, 9, false), true);
  assert.equal(puedeRetirar({ workspaceOrigen: 9 }, 3, true), true, 'la plataforma modera');
});

test('publicar: título obligatorio y con tope; espacios colapsados', () => {
  assert.deepEqual(sanearPublicacion({ titulo: '  Bienvenida   a  leads  ', descripcion: ' Para nuevos ', autorNombre: ' Ana ' }), { titulo: 'Bienvenida a leads', descripcion: 'Para nuevos', autorNombre: 'Ana' });
  assert.ok('error' in sanearPublicacion({ titulo: '   ' }));
  assert.ok('error' in sanearPublicacion({ titulo: 'x'.repeat(TOPE_TITULO_CREACION + 1) }));
  assert.ok(definicionCabe({ a: 1 }));
  assert.equal(definicionCabe({ a: 'x'.repeat(500_000) }), false);
});

test('buscar: sin lo que parte el filtro de PostgREST, con los acentos, y con los comodines escapados', () => {
  assert.equal(normalizarBusqueda(' automatización,  (de) "leads" '), 'automatización de leads');
  assert.equal(patronBusqueda('50%_off'), '%50\\%\\_off%');
  assert.equal(normalizarBusqueda(42), '');
});

test('el id de lo que se publica es TEXTO: un número o un UUID, nunca otra cosa', () => {
  assert.equal(sanearOrigenId(12), '12');
  assert.equal(sanearOrigenId(' 12 '), '12');
  assert.equal(sanearOrigenId('3f2b9c1e-7a4d-4b8e-9c21-0a1b2c3d4e5f'), '3f2b9c1e-7a4d-4b8e-9c21-0a1b2c3d4e5f');
  assert.equal(sanearOrigenId(''), null);
  assert.equal(sanearOrigenId('12; drop table'), null);
  assert.equal(sanearOrigenId(null), null);
});

test('el número corto, como GitHub', () => {
  assert.equal(numeroCorto(0), '0');
  assert.equal(numeroCorto(999), '999');
  assert.equal(numeroCorto(1200), '1,2 mil');
  assert.equal(numeroCorto(15400), '15 mil');
});

test('cada tipo tiene enchufe o un chat dueño que lo enchufa, nunca las dos ni ninguna', () => {
  for (const t of TIPOS_CREACION) {
    const enchufado = (ENCHUFADOS as readonly string[]).includes(t);
    const pendiente = t in POR_ENCHUFAR;
    assert.ok(enchufado !== pendiente, `«${t}»: enchufado=${enchufado}, por enchufar=${pendiente}`);
  }
  for (const k of Object.keys(POR_ENCHUFAR)) assert.ok((TIPOS_CREACION as readonly string[]).includes(k), `«${k}» no es un tipo`);
});

test('la tab de cada tipo existe en la barra (es lo que se mira en la capa para usarla)', () => {
  const nav = leer('../app/_components/nav.ts');
  for (const t of TIPOS_CREACION) assert.match(nav, new RegExp(`key: '${INFO_TIPO[t].nav}'`), `«${t}» apunta a una tab que no existe`);
});

test('migración 0273: las tres tablas con RLS y revoke, y la columna NO se llama workspace_id', () => {
  const sql = sinComentarios(leer('../supabase/migrations/0273_creaciones.sql'));
  for (const t of ['creaciones', 'creacion_estrellas', 'creacion_usos']) {
    assert.match(sql, new RegExp(`alter table ${t} enable row level security;`), `${t} sin RLS`);
    assert.match(sql, new RegExp(`revoke all on ${t} from anon, authenticated;`), `${t} sin revoke`);
  }
  assert.match(sql, /revoke all on function creaciones_contar_estrellas\(\) from public, anon, authenticated;/);
  assert.match(sql, /revoke all on function creaciones_contar_usos\(\) from public, anon, authenticated;/);
  assert.doesNotMatch(sql, /\bworkspace_id\b/, 'una columna workspace_id la filtraría getTenantDb (y es de todos)');
  assert.match(sql, /primary key \(creacion_id, workspace_estrella\)/, 'una estrella por negocio');
  assert.match(sql, /primary key \(creacion_id, workspace_uso\)/, 'un uso por negocio');
  assert.doesNotMatch(leer('../lib/workspace.ts'), /'creaci(o|ó)n(es|_estrellas|_usos)'/, 'las creaciones no son de un inquilino');
});

test('lo que sale a otro negocio no trae el negocio de origen ni el email de quien publicó', () => {
  const src = leer('../lib/creaciones.ts');
  const ini = src.indexOf('export type Creacion = {');
  const tipo = sinComentarios(src.slice(ini, src.indexOf('\n};\n', ini)));
  assert.ok(tipo.length > 100 && tipo.length < 1500, `el recorte mide ${tipo.length}`);
  assert.doesNotMatch(tipo, /workspace|publicado_por|publicadoPor|email|origen/i);
  assert.match(sinComentarios(src), /getSupabaseServer\(\)/, 'las creaciones se leen de TODOS: cliente crudo');
  assert.doesNotMatch(sinComentarios(src), /getTenantDb/, 'getTenantDb filtraría por el inquilino del contexto');
});

test('la API: todo el área es del admin, sin dinero, y cada operación tiene su ruta REST', () => {
  const defs = porArea('creaciones');
  assert.deepEqual(defs.map((d) => d.id).sort(), ['dar_estrella', 'listar_creaciones', 'mis_creaciones', 'publicar_creacion', 'quitar_estrella', 'retirar_creacion', 'usar_creacion', 'ver_creacion']);
  for (const d of defs) {
    assert.equal(d.gating?.rolMinimo, 'admin', `${d.id} sin rolMinimo admin (la pantalla es requireRolWs([]))`);
    assert.notEqual(d.costo, 'dinero', d.id);
  }
  const rest = leer('../lib/api-mako/rest.ts');
  for (const d of defs) assert.match(rest, new RegExp(`'${d.id}'\\]`), `${d.id} sin ruta REST`);
  assert.match(rest, /\['PUT', '\/creaciones\/creaciones\/\{creacionId\}\/estrella', 'dar_estrella'\]/);
  assert.match(rest, /\['DELETE', '\/creaciones\/creaciones\/\{creacionId\}\/estrella', 'quitar_estrella'\]/);
});

test('publicar no recibe la definición del pedido: el enchufe la arma desde la base', () => {
  const def = porArea('creaciones').find((d) => d.id === 'publicar_creacion')!;
  const nombres = (def.parametros ?? []).map((p) => p.nombre);
  assert.ok(!nombres.some((n) => /definicion|pasos|contenido/i.test(n)), `publicar acepta ${nombres.join(', ')}`);
  const run = sinComentarios(leer('../lib/creaciones.ts'));
  assert.match(run, /ENCHUFES\[input\.tipo\]\.exportar\(input\.origenId\)/);
});
