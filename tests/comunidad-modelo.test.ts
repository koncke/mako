// =============================================================================
// comunidad-modelo — la migración 0217 y lo que el código espera de ella
// =============================================================================
// Lo que no da error y rompe igual:
//   · un `onConflict` que no coincide con un índice único COMPLETO hace fallar el upsert entero
//     («there is no unique or exclusion constraint matching the ON CONFLICT specification»);
//   · una tabla sin RLS ni revoke la lee cualquiera con la anon key;
//   · un `workspace_id` con default convierte un insert que se olvidó del workspace en una fila del ws1;
//   · el bucket rechaza un tipo recién al terminar de subir, así que su lista y la de la pantalla son UNA.
// Y tres cosas que dependen de archivos de OTRAS pistas (registro de inquilino y ruta pública): van como
// `todo`, que se informan sin tumbar la suite, hasta que se integren. Integrados el 08/10/2026: ya son tests.
//
// Verificado ROMPIÉNDOLO: ver el bloque «ROTURAS» al final (números medidos).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIME_ADJUNTO, TOPE_ADJUNTO_BYTES, TOPE_BIO, TOPE_CATEGORIA, TOPE_COMENTARIO, TOPE_CUERPO, TOPE_TITULO } from '../lib/comunidad-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');
/** El SQL sin comentarios: la cabecera cuenta en prosa lo que el código no hace. */
const SQL = leer('supabase', 'migrations', '0217_comunidad.sql').replace(/--.*$/gm, '');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const DATOS = sinComentarios(leer('lib', 'comunidad-datos.ts'));
/** Todo lo que escribe en la base: la primera mitad y sus tres hermanos de la segunda. */
const SERVER = [DATOS, ...['comunidad-calendario.ts', 'comunidad-campana.ts', 'comunidad-moderacion.ts'].map((f) => sinComentarios(leer('lib', f)))].join('\n');

const TABLAS = [
  'comunidad_ajustes', 'comunidad_categorias', 'comunidad_posts', 'comunidad_comentarios', 'comunidad_likes',
  'comunidad_votos', 'comunidad_perfiles', 'comunidad_notificaciones', 'comunidad_seguimientos', 'comunidad_baneos',
  'comunidad_eventos', 'comunidad_evento_avisos',
];

/** El bloque `create table … ( … );` de una tabla. */
function bloque(t: string): string {
  const i = SQL.indexOf(`create table if not exists ${t} (`);
  assert.ok(i >= 0, `falta la tabla ${t}`);
  const fin = SQL.indexOf('\n);', i);
  return SQL.slice(i, fin);
}

test('están TODAS las tablas de la comunidad (también las de la segunda mitad), y ninguna más', () => {
  const creadas = [...SQL.matchAll(/create table if not exists (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(creadas.slice().sort(), TABLAS.slice().sort());
});

test('cada tabla: workspace_id NOT NULL, con FK y SIN default (un insert sin workspace falla)', () => {
  for (const t of TABLAS) {
    const linea = bloque(t).split('\n').find((l) => /^\s*workspace_id\s/.test(l)) ?? '';
    assert.match(linea, /bigint not null references workspaces\(id\) on delete cascade/, t);
    assert.doesNotMatch(linea, /default/, `${t}: workspace_id con default`);
  }
});

test('cada tabla: RLS prendido y revoke a anon y authenticated', () => {
  for (const t of TABLAS) {
    assert.match(SQL, new RegExp(`alter table ${t}\\s+enable row level security;`), `${t} sin RLS`);
    assert.match(SQL, new RegExp(`revoke all on ${t}\\s+from anon, authenticated;`), `${t} sin revoke`);
  }
});

test('cada onConflict del código tiene su índice único COMPLETO en la migración', () => {
  const pares = [...SERVER.matchAll(/de\([^,]+,\s*'(comunidad_\w+)'\)\.upsert\([\s\S]*?onConflict:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]);
  assert.ok(pares.length >= 10, `encontré ${pares.length} upserts: el barrido está mirando otra cosa`);
  for (const t of ['comunidad_seguimientos', 'comunidad_notificaciones', 'comunidad_baneos']) {
    assert.ok(pares.some(([x]) => x === t), `no encontré el upsert de ${t}`);
  }
  for (const [tabla, cols] of pares) {
    const enSql = cols.split(',').map((c) => c.trim()).join(', ');
    const re = new RegExp(`create unique index if not exists \\w+ on ${tabla} \\(${enSql}\\);`);
    assert.match(SQL, re, `${tabla} (${cols}) no tiene índice único completo`);
  }
});

test('las reglas que la base repite: nadie se likea, dos niveles de comentarios, un voto por persona', () => {
  assert.match(bloque('comunidad_likes'), /check \(miembro <> autor_miembro\)/);
  assert.match(SQL, /create trigger comunidad_comentario_dos_niveles before insert or update of padre_id, post_id on comunidad_comentarios/);
  assert.match(SQL, /p\.padre_id is null and p\.post_id = new\.post_id and p\.workspace_id = new\.workspace_id/);
  assert.match(SQL, /create unique index if not exists comunidad_votos_uk on comunidad_votos \(workspace_id, post_id, miembro\);/);
  assert.match(SQL, /revoke all on function comunidad_comentario_dos_niveles\(\) from public, anon, authenticated;/);
});

test('la identidad de un miembro: u:<id> o l:<id>, y el lead coincide con la clave', () => {
  for (const t of ['comunidad_posts', 'comunidad_comentarios', 'comunidad_likes', 'comunidad_votos', 'comunidad_perfiles', 'comunidad_seguimientos']) {
    const b = bloque(t);
    assert.match(b, /miembro ~ '\^\(u\|l\):\[1-9\]\[0-9\]\*\$'/, t);
    assert.match(b, /\(lead_id is null or miembro = 'l:' \|\| lead_id::text\)/, t);
  }
});

test('los topes de la base son los del código', () => {
  assert.match(bloque('comunidad_posts'), new RegExp(`titulo\\s+text not null check \\(length\\(btrim\\(titulo\\)\\) between 1 and ${TOPE_TITULO}\\)`));
  assert.match(bloque('comunidad_posts'), new RegExp(`cuerpo\\s+text not null default '' check \\(length\\(cuerpo\\) <= ${TOPE_CUERPO}\\)`));
  assert.match(bloque('comunidad_comentarios'), new RegExp(`between 1 and ${TOPE_COMENTARIO}\\)`));
  assert.match(bloque('comunidad_categorias'), new RegExp(`between 1 and ${TOPE_CATEGORIA}\\)`));
  assert.match(bloque('comunidad_perfiles'), new RegExp(`length\\(bio\\) <= ${TOPE_BIO}`));
});

test('el bucket: privado, con el MISMO tope y la MISMA lista de tipos que la pantalla', () => {
  const m = /values \('comunidad-adjuntos', 'comunidad-adjuntos', false, (\d+), array\[([\s\S]*?)\]\)/.exec(SQL);
  assert.ok(m, 'falta el bucket');
  assert.equal(Number(m[1]), TOPE_ADJUNTO_BYTES);
  const tipos = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.deepEqual(tipos.slice().sort(), Object.keys(MIME_ADJUNTO).sort());
  assert.match(SQL, /on conflict \(id\) do update set public = false/);
});

/** Las columnas de una lista `'a, b, c'` del código. */
const columnas = (lista: string) => lista.split(',').map((c) => c.trim()).filter(Boolean);
/** ¿La tabla tiene la columna? (en su `create table` o en un `add column if not exists`). */
const tieneColumna = (t: string, c: string) =>
  new RegExp(`^\\s+${c}\\s`, 'm').test(bloque(t)) || new RegExp(`alter table ${t} add column if not exists ${c}\\s`).test(SQL);

test('lo que el código LEE existe en la migración (una columna que no está rechaza la consulta ENTERA)', () => {
  const lista = (src: string, nombre: string) => {
    const m = new RegExp(`const ${nombre} = '([^']+)'`).exec(src);
    assert.ok(m, `no encontré ${nombre}`);
    return columnas(m[1]);
  };
  const casos: Array<[string, string[]]> = [
    ['comunidad_posts', lista(DATOS, 'COLS_POST')],
    ['comunidad_eventos', lista(SERVER, 'COLS_EVENTO')],
    ['comunidad_notificaciones', columnas(/select\('(id, tipo, de_miembro[^']+)'\)/.exec(SERVER)?.[1] ?? '')],
  ];
  for (const [t, cols] of casos) {
    assert.ok(cols.length >= 8, `${t}: la lista de columnas mide ${cols.length}`);
    const faltan = cols.filter((c) => !tieneColumna(t, c));
    assert.deepEqual(faltan, [], `${t}: el código lee columnas que la 0217 no tiene`);
  }
});

test('las columnas de la segunda mitad: también como `add column if not exists`, y ANTES del índice que las usa', () => {
  for (const [t, c] of [['comunidad_posts', 'comentarios_cerrados_at'], ['comunidad_notificaciones', 'clave'], ['comunidad_notificaciones', 'ocurrencia'], ['comunidad_eventos', 'ocurrencia_fecha'], ['comunidad_eventos', 'portada']]) {
    assert.match(SQL, new RegExp(`alter table ${t} add column if not exists ${c}\\s`), `${t}.${c}: sin su add column (una 0217 vieja ya aplicada no la tendría)`);
  }
  const alter = SQL.indexOf('alter table comunidad_notificaciones add column if not exists clave');
  const indice = SQL.indexOf('create unique index if not exists comunidad_notificaciones_clave_uk on comunidad_notificaciones (workspace_id, para_miembro, clave);');
  assert.ok(alter >= 0 && indice > alter, 'el índice de la clave va DESPUÉS de agregar la columna');
});

test('la FK de la campana al evento: idempotente (DO + pg_constraint) y en cascada', () => {
  assert.match(SQL, /if not exists \(select 1 from pg_constraint where conname = 'comunidad_notificaciones_evento_fk'\) then\s+alter table comunidad_notificaciones\s+add constraint comunidad_notificaciones_evento_fk foreign key \(evento_id\) references comunidad_eventos\(id\) on delete cascade;/);
});

test('la cabecera dice su orden de despliegue', () => {
  assert.match(leer('supabase', 'migrations', '0217_comunidad.sql'), /ORDEN DE DESPLIEGUE: ANTES del deploy/);
});

// ── Lo que depende de OTRAS pistas (se informa, no tumba la suite hasta integrarse) ─────────

test('INTEGRACIÓN: las 12 tablas en TENANT_TABLES (lib/workspace.ts)', () => {
  const ws = leer('lib', 'workspace.ts');
  const faltan = TABLAS.filter((t) => !ws.includes(`'${t}'`));
  assert.deepEqual(faltan, []);
});

test('INTEGRACIÓN: las 12 tablas en TABLAS_DE_INQUILINO', async () => {
  const { TABLAS_DE_INQUILINO } = await import('../lib/tablas-de-inquilino');
  const faltan = TABLAS.filter((t) => !(TABLAS_DE_INQUILINO as readonly string[]).includes(t));
  assert.deepEqual(faltan, []);
});

test('INTEGRACIÓN: /api/compartido/comunidad acepta POST (PUBLICOS_ESCRITURA)', async () => {
  const { esPublicaDeEscritura } = await import('../lib/rutas-publicas');
  assert.equal(esPublicaDeEscritura('/api/compartido/comunidad'), true);
  assert.equal(esPublicaDeEscritura('/api/compartido/comunidad/x'), false, 'exacta, no por prefijo');
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 08/10/2026 (arnés del scratchpad, restaura de memoria): cada rotura, sola, contra este
// archivo (9 tests + 3 `todo`) da 1 fallo y 8 pases: la tabla de votos sin revoke · el índice de likes
// sin `workspace_id` (incompleto para el onConflict) · el CHECK del like propio en `true` · el bucket
// sin `text/plain` · `workspace_id` con `default 1` · el onConflict de votos sin `workspace_id` · el
// trigger sin `p.padre_id is null` (deja un tercer nivel).
// Re-medido con la SEGUNDA mitad (08/10/2026, 12 tests + 3 `todo`): esas siete siguen dando 1 fallo y
// 11 pases. Y las nuevas (scratchpad/comunidad-2/romper.mjs): el código lee una columna de eventos que no
// existe (`portada_url`): 1 / 11 · sin el `add column` de la clave de la campana: 1 / 11 · la FK de la
// campana sin su `if not exists`: 1 / 11 · el upsert de los avisos con un onConflict sin índice: 1 / 11 ·
// la columna de cerrar comentarios borrada de la migración (el código la sigue leyendo): 2 / 10.

test('el select de la comunidad NO es genérico: con el genérico el typecheck del repo se quedaba sin memoria', () => {
  // 08/10/2026: con `select: <Q extends string>(cols: Q…)` supabase-js corría su parser de tipos sobre
  // cada lista de columnas contra la UNIÓN de las tablas de la comunidad, y `tsc` moría sin memoria a
  // 4, 8 y 14 GB: el pre-push de todas las sesiones quedaba bloqueado. Sin el genérico: 0 errores,
  // 20 s con la caché incremental. Probado rompiéndolo: devolver el genérico tumba este test (y el
  // typecheck vuelve a morir); restaurado, pasa.
  assert.doesNotMatch(SERVER, /<\s*\w+\s+extends\s+string\s*>\s*\(\s*cols/);
  assert.match(DATOS, /select: \(cols: string,[^\n]*\.select\(cols as '\*'/);
});
