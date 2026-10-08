// =============================================================================
// comunidad-permisos — un alumno no fija, no borra lo ajeno, no escribe en una categoría del equipo,
// no se likea a sí mismo y no ve otro producto
// =============================================================================
// Dos capas, y las dos hacen falta:
//   · las REGLAS (lib/comunidad-reglas.ts), que se EJECUTAN acá;
//   · que la capa de datos (lib/comunidad-datos.ts) las PREGUNTE antes de escribir, y que cada
//     consulta lleve su workspace y su producto. Eso no se puede ejecutar sin base, así que se lee el
//     fuente: SIN comentarios (la convención de la casa explica en el comentario lo que se sacó, y un
//     guard que busca «esto NO está» se acusaría a sí mismo) y por FUNCIÓN, no el archivo entero (un
//     archivo de 900 líneas encuentra cualquier palabra en algún lado).
//
// Verificado ROMPIÉNDOLO: ver el bloque «ROTURAS» al final (números medidos).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  puedeFijar, puedeBorrar, puedeEditar, puedeConfigurar, puedeDarLike, puedePublicarEn, hayLugarParaFijar,
  puedePostearPorNivel, validarPost, type ActorRegla, type CategoriaRegla,
} from '../lib/comunidad-reglas';

const ALUMNO: ActorRegla = { clave: 'l:7', equipo: false, adminWs: false };
const OTRO_ALUMNO = 'l:8';
const EQUIPO: ActorRegla = { clave: 'u:3', equipo: true, adminWs: false };
const ADMIN: ActorRegla = { clave: 'u:4', equipo: true, adminWs: true };
const CATS: CategoriaRegla[] = [{ id: 1, nombre: 'General', permiso: 'todos' }, { id: 2, nombre: 'Anuncios', permiso: 'equipo' }];

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const DATOS = sinComentarios(readFileSync(join(RAIZ, 'lib', 'comunidad-datos.ts'), 'utf8'));
const RUTA = sinComentarios(readFileSync(join(RAIZ, 'app', 'api', 'compartido', 'comunidad', 'route.ts'), 'utf8'));

/** El cuerpo de una función del fuente: desde su firma hasta la siguiente función de primer nivel. */
function cuerpo(src: string, nombre: string): string {
  const ini = src.search(new RegExp(`\\n(export )?(async )?function ${nombre}\\b`));
  assert.ok(ini >= 0, `no encontré la función ${nombre}`);
  const resto = src.slice(ini + 1);
  const fin = resto.search(/\n(export )?(async )?function \w+|\nconst [A-Z_]+ = |\n\/\/ ──/);
  const c = fin > 0 ? resto.slice(0, fin) : resto;
  assert.ok(c.length < 6000, `el recorte de ${nombre} mide ${c.length}: está mirando otra cosa`);
  return c;
}

/** ¿`antes` aparece antes que `despues` en el cuerpo? (el chequeo va ANTES de escribir) */
const antesQue = (c: string, antes: string | RegExp, despues: string | RegExp) => {
  const i = typeof antes === 'string' ? c.indexOf(antes) : c.search(antes);
  const j = typeof despues === 'string' ? c.indexOf(despues) : c.search(despues);
  return i >= 0 && j >= 0 && i < j;
};

// ── Las reglas ───────────────────────────────────────────────────────────────────

test('un alumno no fija; el equipo sí, hasta 3', () => {
  assert.equal(puedeFijar(ALUMNO), false);
  assert.equal(puedeFijar(EQUIPO), true);
  assert.equal(hayLugarParaFijar(2, false), true);
  assert.equal(hayLugarParaFijar(3, false), false, 'el cuarto no entra');
  assert.equal(hayLugarParaFijar(3, true), true, 'volver a fijar uno ya fijado no suma');
});

test('un alumno no borra lo ajeno; lo suyo sí; el equipo modera', () => {
  assert.equal(puedeBorrar(ALUMNO, OTRO_ALUMNO), false);
  assert.equal(puedeBorrar(ALUMNO, 'u:3'), false, 'tampoco lo del equipo');
  assert.equal(puedeBorrar(ALUMNO, ALUMNO.clave), true);
  assert.equal(puedeBorrar(EQUIPO, OTRO_ALUMNO), true);
});

test('editar es sólo de quien lo escribió: ni el equipo pone palabras ajenas', () => {
  assert.equal(puedeEditar(ALUMNO, OTRO_ALUMNO), false);
  assert.equal(puedeEditar(EQUIPO, ALUMNO.clave), false);
  assert.equal(puedeEditar(ALUMNO, ALUMNO.clave), true);
});

test('un alumno no escribe en una categoría «solo el equipo»', () => {
  assert.equal(puedePublicarEn(ALUMNO, CATS[1]), false);
  assert.equal(puedePublicarEn(EQUIPO, CATS[1]), true);
  const ctx = (actor: ActorRegla) => ({ actor, categorias: CATS, ws: 3, productoId: 12, nombreDe: () => null });
  const r = validarPost({ titulo: 'Hola', categoriaId: 2 }, ctx(ALUMNO));
  assert.equal(r.ok, false);
  assert.equal(validarPost({ titulo: 'Hola', categoriaId: 2 }, ctx(EQUIPO)).ok, true);
});

test('nadie se da like a sí mismo (un like propio sería un punto gratis)', () => {
  assert.equal(puedeDarLike(ALUMNO, ALUMNO.clave), false);
  assert.equal(puedeDarLike(ALUMNO, OTRO_ALUMNO), true);
  assert.equal(puedeDarLike(EQUIPO, 'u:3'), false);
});

test('configurar (categorías, nombres de nivel) es de un admin del workspace, nunca de un alumno', () => {
  assert.equal(puedeConfigurar(ALUMNO), false);
  assert.equal(puedeConfigurar({ ...ALUMNO, adminWs: true }), false, 'un alumno no es equipo aunque venga marcado');
  assert.equal(puedeConfigurar(EQUIPO), false);
  assert.equal(puedeConfigurar(ADMIN), true);
});

test('el nivel mínimo para postear frena al alumno, nunca al equipo', () => {
  assert.equal(puedePostearPorNivel(ALUMNO, 2, 3), false);
  assert.equal(puedePostearPorNivel(ALUMNO, 3, 3), true);
  assert.equal(puedePostearPorNivel(EQUIPO, 1, 9), true);
});

// ── La capa de datos las pregunta ANTES de escribir ──────────────────────────────

test('fijar: pregunta `puedeFijar` antes de escribir, y cuenta los fijados', () => {
  const c = cuerpo(DATOS, 'fijarPost');
  assert.ok(antesQue(c, 'if (!puedeFijar(a))', '.update('), 'fijar sin preguntar quién');
  assert.ok(antesQue(c, 'hayLugarParaFijar(', '.update('), 'fijar sin contar los fijados');
});

test('borrar y editar: preguntan por el AUTOR antes de escribir', () => {
  assert.ok(antesQue(cuerpo(DATOS, 'borrarPost'), 'puedeBorrar(a, f.miembro)', '.delete()'));
  assert.ok(antesQue(cuerpo(DATOS, 'borrarComentario'), 'puedeBorrar(a, c.miembro)', '.delete()'));
  assert.ok(antesQue(cuerpo(DATOS, 'editarPost'), 'puedeEditar(a, f.miembro)', '.update('));
  assert.ok(antesQue(cuerpo(DATOS, 'editarComentario'), 'puedeEditar(a, c.miembro)', '.update('));
});

test('like: pregunta `puedeDarLike` con el autor de lo likeado antes de escribir', () => {
  assert.ok(antesQue(cuerpo(DATOS, 'cambiarLike'), 'puedeDarLike(a, autor)', '.upsert('));
});

test('publicar: valida la categoría (y su permiso) con `validarPost` antes de insertar', () => {
  const c = cuerpo(DATOS, 'publicarPost');
  assert.ok(antesQue(c, 'validarPost(', '.insert('));
  assert.ok(antesQue(c, 'puedePostearPorNivel(', '.insert('), 'el nivel mínimo para postear');
});

test('configurar: las cuatro escrituras arrancan preguntando `puedeConfigurar`', () => {
  for (const f of ['guardarCategoria', 'borrarCategoria', 'moverCategoria', 'guardarNombresNivel']) {
    const c = cuerpo(DATOS, f);
    assert.ok(antesQue(c, 'if (!puedeConfigurar(a))', /\.(insert|update|upsert|delete)\(/), f);
  }
});

test('no ve otro producto: cada lectura de un post o comentario va por SU producto', () => {
  for (const f of ['postDe', 'comentarioDe']) {
    assert.match(cuerpo(DATOS, f), /\.eq\('producto_id', a\.productoId\)/, f);
  }
  assert.match(cuerpo(DATOS, 'feedComunidad'), /\.eq\('producto_id', a\.productoId\)/);
});

test('el portón del alumno: token vigente, NO un líder, el producto es SUYO y no está baneado', () => {
  const c = cuerpo(DATOS, 'actorDelAlumno');
  assert.match(c, /if \(!acceso \|\| acceso\.area != null\) return null;/, 'el link de un líder no abre la comunidad');
  assert.match(c, /if \(!productos\.includes\(productoId\)\) return null;/, 'un producto que no es suyo');
  assert.match(c, /comunidad_baneos[\s\S]*levantado_at/, 'el baneo vigente');
  assert.match(c, /if \(ban\) return null;/);
});

test('cada tabla de la comunidad sale con su workspace (no por getTenantDb, que hoy es passthrough)', () => {
  const de = cuerpo(DATOS, 'de');
  for (const op of ['select', 'update', 'delete']) {
    assert.match(de, new RegExp(`${op}: [^\\n]*\\.eq\\('workspace_id', ws\\)`), `${op} sin workspace`);
  }
  assert.match(de, /insert: [^\n]*conWs\(filas, ws\)/);
  assert.match(de, /upsert: [^\n]*conWs\(filas, ws\)/);
  // Ninguna tabla de la comunidad se toca por fuera de `de()` salvo por leerTodo con su workspace.
  const directas = [...DATOS.matchAll(/\.from\('comunidad_\w+'\)/g)].map((m) => m.index!);
  assert.deepEqual(directas, [], 'un .from(comunidad_*) suelto se salta el workspace');
  for (const m of DATOS.matchAll(/leerTodo<[^(]*\(\s*getSupabaseServer\(\),\s*'(\w+)'[\s\S]*?\);/g)) {
    assert.match(m[0], /workspace_id: (ws|a\.ws)/, `leerTodo de ${m[1]} sin workspace`);
  }
  assert.ok([...DATOS.matchAll(/leerTodo</g)].length >= 8, 'el barrido de leerTodo no encontró las llamadas');
});

test('la segunda mitad (calendario, campana, moderación) pasa por la MISMA puerta: ni un `.from(comunidad_*)` suelto', () => {
  const hermanos = ['comunidad-calendario.ts', 'comunidad-campana.ts', 'comunidad-moderacion.ts']
    .map((f) => ({ f, src: sinComentarios(readFileSync(join(RAIZ, 'lib', f), 'utf8')) }));
  for (const { f, src } of hermanos) {
    assert.deepEqual([...src.matchAll(/\.from\('comunidad_\w+'\)/g)].map((m) => m[0]), [], `${f}: un .from(comunidad_*) suelto se salta el workspace`);
    for (const m of src.matchAll(/leerTodo<[^(]*\(\s*getSupabaseServer\(\),\s*'(\w+)'[\s\S]*?\);/g)) {
      assert.match(m[0], /workspace_id: (ws|a\.ws)/, `${f}: leerTodo de ${m[1]} sin workspace`);
    }
    for (const m of src.matchAll(/\.from\('(leads|curso_modulos)'\)[^;]*;/g)) assert.match(m[0], /\.eq\('workspace_id', /, `${f}: ${m[0]}`);
    assert.match(src, /^import 'server-only';/, `${f} sin server-only`);
  }
  assert.ok(hermanos.reduce((n, h) => n + [...h.src.matchAll(/leerTodo</g)].length, 0) >= 2, 'el barrido de leerTodo no encontró las llamadas');
});

test('los leads y los accesos también llevan el workspace a mano', () => {
  for (const m of DATOS.matchAll(/\.from\('leads'\)[^;]*;/g)) assert.match(m[0], /\.eq\('workspace_id', /, m[0]);
  assert.match(cuerpo(DATOS, 'miembrosDeLaComunidad'), /'curso_accesos'[\s\S]{0,200}eq: \{ workspace_id: ws \}/);
});

test('la ruta del alumno: workspace de la FIRMA, el portón, y ni fijar ni configurar', () => {
  assert.match(RUTA, /runWithWorkspace\(firma\.ws,/);
  assert.match(RUTA, /const actor = await actorDelAlumno\(token, productoId\);\s*if \(!actor\) return NO\(\);/);
  for (const prohibida of ['fijarPost', 'guardarCategoria', 'borrarCategoria', 'moverCategoria', 'guardarNombresNivel']) {
    assert.ok(!RUTA.includes(prohibida), `la ruta del alumno expone ${prohibida}`);
  }
});

// ── La revisión del 08/10/2026: lo que los tests de arriba NO cuidaban ──────────────
// Doce roturas de una línea pasaban los 89 tests de la comunidad en verde (medido, ver ROTURAS): los
// guards de arriba fijan que el permiso se pregunte ANTES de escribir, no QUÉ FILAS toca la escritura,
// ni las puertas que no escriben (el perfil, las menciones), ni la de las server actions.

const HERMANOS = ['comunidad-calendario.ts', 'comunidad-campana.ts', 'comunidad-moderacion.ts']
  .map((f) => sinComentarios(readFileSync(join(RAIZ, 'lib', f), 'utf8')));
const SERVER = [DATOS, ...HERMANOS].join('\n');
const ACTOR = sinComentarios(readFileSync(join(RAIZ, 'app', 'customer-success', 'comunidad', 'actor.ts'), 'utf8'));
const ACTIONS = sinComentarios(readFileSync(join(RAIZ, 'app', 'customer-success', 'comunidad', 'actions.ts'), 'utf8'));

/** Cada `de(…, 'tabla').update(…)` / `.delete()` del server, con su tabla y la sentencia entera hasta el `;`. */
const escrituras = () => [...SERVER.matchAll(/de\([^,]+,\s*'(comunidad_\w+)'\)\s*\.(update\(|delete\(\))[\s\S]*?;/g)]
  .map((m) => ({ tabla: m[1], sentencia: m[0] }));

test('cada update/delete va acotado a SU producto y a la fila (un `.eq` de menos edita o borra la comunidad entera)', () => {
  const lista = escrituras();
  assert.ok(lista.length >= 25, `encontré ${lista.length} escrituras: el barrido está mirando otra cosa`);
  for (const { tabla, sentencia } of lista) {
    assert.match(sentencia, /\.eq\('producto_id', a\.productoId\)/, `${tabla} sin su producto: ${sentencia.slice(0, 140)}`);
    assert.match(sentencia, /\.eq\('(id|miembro|para_miembro|objetivo|serie_de)', /, `${tabla} sin la fila: ${sentencia.slice(0, 140)}`);
  }
});

test('en las tablas de UNA persona (likes, seguimientos, campana) se toca sólo lo de quien actúa', () => {
  const propias = escrituras().filter((e) => ['comunidad_likes', 'comunidad_seguimientos', 'comunidad_notificaciones'].includes(e.tabla));
  assert.ok(propias.length >= 3, `encontré ${propias.length}`);
  for (const { tabla, sentencia } of propias) {
    assert.match(sentencia, /\.eq\('(miembro|para_miembro)', a\.clave\)/, `${tabla}: «quitar el mío» tocaría el de todos: ${sentencia.slice(0, 140)}`);
  }
});

test('el perfil y las menciones: sólo de un MIEMBRO de esta comunidad (si no, el nombre y la foto de cualquier lead)', () => {
  assert.ok(antesQue(cuerpo(DATOS, 'perfilDe'), 'if (!base && !esYo) return null;', 'infoDeMiembros('), 'el perfil de alguien que no es miembro');
  const m = cuerpo(DATOS, 'nombresMencionables');
  assert.ok(antesQue(m, 'claves.filter(esMiembroDe(comunidad))', 'infoDeMiembros('), 'mencionar (y notificar) a cualquiera');
});

test('descartar un adjunto: sólo uno de ESTA comunidad, y nunca uno que un post nombra', () => {
  const c = cuerpo(DATOS, 'descartarAdjunto');
  assert.ok(antesQue(c, 'if (!pathEsDeLaComunidad(path, a.ws, a.productoId))', '.remove('), 'borrar cualquier archivo del bucket');
  assert.ok(antesQue(c, "eq('adjunto_path', path as string)", '.remove('));
});

test('votar: la opción tiene que existir en la encuesta antes de escribir', () => {
  assert.ok(antesQue(cuerpo(DATOS, 'votar'), 'enc.opciones.some((o) => o.id === opcion)', '.upsert('));
});

test('subir un archivo: sólo quien puede publicar (la misma regla que «Escribe algo»), y la ruta topa las subidas aparte', () => {
  const c = cuerpo(DATOS, 'urlSubidaAdjunto');
  // La CONDICIÓN, no sólo que el nombre aparezca antes: un `if (a.equipo)` invertido la dejaría escrita y muerta.
  assert.match(c, /if \(!a\.equipo\) \{[\s\S]{0,400}?if \(!puedePublicarEnLaComunidad\(a, nivel, ajustes\.nivelParaPostear, categorias\.map\(aRegla\)\)\) \{\s*return \{ ok: false/);
  assert.ok(antesQue(c, 'puedePublicarEnLaComunidad(', 'createSignedUploadUrl('), 'firma subidas a quien no puede publicar');
  assert.match(cuerpo(DATOS, 'inicioComunidad'), /puedoPublicar: puedePublicarEnLaComunidad\(/, '«Escribe algo» con otra regla que la subida');
  assert.match(RUTA, /accion === 'subida' && !rateLimit\(`comunidad:lead:\$\{actor\.ws\}:\$\{actor\.leadId\}:subida`, 6, 60_000\)/);
});

test('la puerta del equipo: sesión, capa, cuenta propia y el producto ES del negocio, antes de armar el actor', () => {
  for (const paso of ['await getRolWsEfectivo()', "tabEnCapa('customer-success', await getCapaActual())", 'if (!usuarioId)', 'if (!producto) return']) {
    assert.ok(antesQue(ACTOR, paso, 'return {\n'), `actorDelEquipo sin «${paso}»`);
  }
  assert.match(ACTOR, /const producto = await productoDelWorkspace\(ws, productoId\);/);
});

test('cada server action del equipo pasa por la puerta (`conActor`): una action es un POST que se pide sola', () => {
  const partes = ACTIONS.split(/\nexport async function /).slice(1);
  assert.ok(partes.length >= 35, `encontré ${partes.length} actions`);
  for (const p of partes) {
    const nombre = p.slice(0, p.indexOf('('));
    const cuerpoAction = p.slice(0, p.indexOf('\n}\n') > 0 ? p.indexOf('\n}\n') : undefined);
    assert.match(cuerpoAction, /return conActor\(productoId, /, `${nombre} no pasa por conActor`);
  }
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 08/10/2026 (arnés del scratchpad, restaura de memoria): cada rotura, sola, contra este
// archivo de 17 tests da 1 fallo y 16 pases.
//   En las reglas: cualquiera fija · cualquiera borra · like propio · configura sin ser equipo ·
//     un alumno publica en una categoría del equipo.
//   En lib/comunidad-datos.ts: fijar sin `puedeFijar` · borrar sin `puedeBorrar` · like sin
//     `puedeDarLike` · el link de un LÍDER entra · un producto que no es suyo entra · `de().select` sin
//     workspace · `postDe` sin producto · una categoría sin `puedeConfigurar` · un `leerTodo` sin
//     workspace · publicar sin el nivel mínimo.
//   En la ruta: expone «fijar» · corre en el workspace del producto y no en el de la firma.
// Re-medido con la SEGUNDA mitad (08/10/2026, 18 tests): esas diecisiete siguen dando 1 fallo y 17
// pases. Y las nuevas (scratchpad/comunidad-2/romper.mjs), en los hermanos de la segunda mitad: un
// `.from('comunidad_eventos')` suelto en el calendario · un `leerTodo` de la campana sin workspace ·
// los módulos del curso leídos sin workspace: cada una, 1 / 17.
// La REVISIÓN (08/10/2026, scratchpad/revision-comunidad/romper.mjs). ANTES de los tests de arriba
// «La revisión…», estas doce daban 0 fallos y 89 pases en los seis archivos de la comunidad: el perfil
// de alguien que no es miembro · mencionar a cualquiera · descartar cualquier path del bucket · «quitar
// like» borra los de todos · editar un post reescribe todos los del producto · borrar uno los borra
// todos · cerrar los comentarios de uno los cierra todos · sacar a alguien con su contenido borra el
// de todos · la puerta del equipo sin mirar que el producto sea del negocio · una action sin
// `conActor` · votar una opción que no existe · dejar de seguir un post lo deja de seguir todo el mundo.
// DESPUÉS, contra este archivo de 26 tests, cada una da 1 fallo y 25 pases; y lo mismo las de los
// arreglos de la revisión: la subida sin el permiso (borrado o invertido) · la ruta sin el tope de
// subidas · el «quitar like» sin su producto · la puerta del equipo sin la capa. Las de arriba (las
// diecisiete de la primera mitad y las tres de la segunda), re-medidas: 1 / 25 cada una.
