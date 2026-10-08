// =============================================================================
// curso-modulos-actions — la PUERTA de las actions de los módulos, y qué columnas escribe cada una
// =============================================================================
// D1, D2 y D4 (docs/diseno-curso-skool.md, 08/10/2026): app/customer-success/curso/modulos-actions.ts
// crea, renombra, vincula, reordena y borra módulos, les pone candados, y edita la lección en su lugar.
// Una server action es un POST que se puede mandar sin pasar por la página, así que cada una pregunta
// sola. Lo que se fija acá, ENUMERANDO los exports (no una lista a mano: la action de mañana también):
//   · cada export es una función async (en 'use server', otra cosa tira el build);
//   · cada export ABRE (adentro de su `try`) con la puerta: admin + producto propio, o admin + una
//     clase que se lee con el inquilino puesto;
//   · `revalidatePath` sólo donde cambia el kanban;
//   · `guardarCampoClase` escribe UNA parte de la clase: las columnas de ESE cambio, nunca la fila.
// Y `validarVideoEntrada` (puro) se ejecuta: es lo que termina en las columnas del video.
//
// ⚠️ SE LEE CON EL COMPILADOR DE TYPESCRIPT, como tests/cs-acciones-puerta.test.ts: «la primera
// sentencia del cuerpo» es una pregunta sobre la ESTRUCTURA, y `getText()` deja afuera los comentarios.
//
// PROBADO ROMPIÉNDOLO: la tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { validarVideoEntrada } from '../app/customer-success/curso/reglas';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const fuente = (p: string) => ts.createSourceFile(p, leer(p), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const plano = (n: ts.Node, sf: ts.SourceFile) => n.getText(sf).replace(/\s+/g, ' ').trim();
const tiene = (n: ts.Node, k: ts.SyntaxKind) => !!ts.getModifiers(n as ts.HasModifiers)?.some((m) => m.kind === k);

type Fn = { nombre: string; nodo: ts.FunctionDeclaration };
const funciones = (sf: ts.SourceFile): Fn[] => sf.statements
  .filter((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && !!s.name && !!s.body)
  .map((nodo) => ({ nombre: nodo.name!.text, nodo }));
const exportadas = (sf: ts.SourceFile) => funciones(sf).filter((f) => tiene(f.nodo, ts.SyntaxKind.ExportKeyword));
/** Las dos primeras sentencias adentro del `try` de arriba (o del cuerpo), juntas y sin comentarios. */
const abre = (f: Fn, sf: ts.SourceFile) => {
  const primera = f.nodo.body?.statements[0];
  const bloque = primera && ts.isTryStatement(primera) ? primera.tryBlock : f.nodo.body;
  return (bloque?.statements.slice(0, 2) ?? []).map((s) => plano(s, sf)).join(' ');
};

const RUTA = 'app/customer-success/curso/modulos-actions.ts';
const ACC = fuente(RUTA);
const ADMIN = fuente('lib/curso-admin.ts');

const PUERTA_PRODUCTO = 'const no = await puertaProducto(productoId); if (no) return { ok: false, error: no };';
const PUERTA_CLASE = 'const no = await puedeEditar(); if (no) return { ok: false, error: no };';

test('modulos-actions: «use server», sólo funciones async exportadas, y las nueve que la pantalla usa', () => {
  assert.match(leer(RUTA), /^'use server';/);
  const malos = ACC.statements
    .filter((s) => tiene(s, ts.SyntaxKind.ExportKeyword) || ts.isExportAssignment(s) || ts.isExportDeclaration(s))
    .filter((s) => !(ts.isFunctionDeclaration(s) && tiene(s, ts.SyntaxKind.AsyncKeyword)))
    .map((s) => plano(s, ACC).slice(0, 80));
  assert.deepEqual(malos, [], 'un export que no es una función async tira el build');
  // Piso, no techo: el CONTRATO con el editor (los nombres que importa la pantalla).
  const nombres = exportadas(ACC).map((f) => f.nombre);
  for (const n of ['crearModuloAction', 'renombrarModuloAction', 'vincularModuloAction', 'reordenarModulosAction', 'borrarModuloAction',
    'guardarBloqueoAction', 'crearClaseAction', 'moverClaseAAction', 'guardarCampoClaseAction']) {
    assert.ok(nombres.includes(n), `falta ${n}`);
  }
});

test('cada action ABRE con la puerta: por su producto (admin + propio) o por su clase (admin, y la clase se lee con el inquilino)', () => {
  const porClase = new Set(['moverClaseAAction', 'guardarCampoClaseAction']);
  const sinPuerta = exportadas(ACC).filter((f) => abre(f, ACC) !== (porClase.has(f.nombre) ? PUERTA_CLASE : PUERTA_PRODUCTO)).map((f) => f.nombre);
  assert.deepEqual(sinPuerta, [], `estas actions no abren con su puerta: ${sinPuerta.join(', ')}`);
  // La puerta del producto: admin PRIMERO, y después que el producto sea de este workspace.
  const pp = funciones(ACC).find((f) => f.nombre === 'puertaProducto');
  assert.ok(pp);
  assert.equal((pp!.nodo.body?.statements ?? []).map((s) => plano(s, ACC)).join(' '),
    'const no = await puedeEditar(); if (no) return no; return productoPropio(Number(productoId));');
  // Las de una clase: lo primero que hacen es leerla con el inquilino puesto (una de otro negocio no
  // existe), y mover además valida el producto y el módulo de destino.
  for (const nombre of ['moverClaseA', 'guardarCampoClase']) {
    const f = funciones(ADMIN).find((x) => x.nombre === nombre)!;
    assert.ok(f, nombre);
    assert.match(abre(f, ADMIN), /^(const presentes|if \(!cambio)|^const c = await claseCruda\(claseId\);/, nombre);
    assert.match(plano(f.nodo, ADMIN), /const c = await claseCruda\(claseId\); if \(!c\) return \{ ok: false, error: 'Esa clase ya no existe\.' \};/, nombre);
  }
  const cruda = funciones(ADMIN).find((x) => x.nombre === 'claseCruda')!;
  assert.match(plano(cruda.nodo, ADMIN), /const db = await getTenantDb\(\);/);
  const mover = plano(funciones(ADMIN).find((x) => x.nombre === 'moverClaseA')!.nodo, ADMIN);
  assert.match(mover, /const prod = await productoConModulos\(c\.productoId\); if \(!prod\) return/);
  assert.match(mover, /if \(!prod\.claves\.includes\(moduloClave\)\) return \{ ok: false, error: 'Ese módulo no existe\.' \};/);
  // Y no la lleva a un módulo que se abre con la tarea de ESTA clase: no se abriría nunca (revisión
  // 08/10; `guardarBloqueo` cierra la misma puerta al poner el candado).
  assert.match(mover, /if \(destino\?\.bloqueo\?\.tipo === 'tarea' && destino\.bloqueo\.claseId === c\.id\) return \{ ok: false/);
  assert.match(plano(funciones(fuente('lib/curso-modulos-datos.ts')).find((x) => x.nombre === 'guardarBloqueo')!.nodo, fuente('lib/curso-modulos-datos.ts')),
    /if \(otra\.etapa === m\.clave\) return \{ ok: false, error: 'Un módulo no puede esperar a una clase suya\.' \};/);
});

test('revalidatePath sólo donde cambia el KANBAN (crear, renombrar, vincular, reordenar)', () => {
  const con = exportadas(ACC).filter((f) => /alKanban\(\)|revalidatePath\(/.test(plano(f.nodo, ACC))).map((f) => f.nombre).sort();
  assert.deepEqual(con, ['crearModuloAction', 'renombrarModuloAction', 'reordenarModulosAction', 'vincularModuloAction']);
});

test('guardarCampoClase: UN cambio por vez, y cada uno escribe SÓLO sus columnas (nunca la fila entera)', () => {
  const f = funciones(ADMIN).find((x) => x.nombre === 'guardarCampoClase')!;
  const sw = (() => {
    let out: ts.SwitchStatement | null = null;
    const ver = (n: ts.Node): void => { if (ts.isSwitchStatement(n)) out = n; else ts.forEachChild(n, ver); };
    ver(f.nodo);
    return out as ts.SwitchStatement | null;
  })();
  assert.ok(sw, 'no encontré el switch de los cambios');
  const fila: Record<string, string> = {};
  const caso: Record<string, string> = {};
  for (const c of sw!.caseBlock.clauses) {
    if (!ts.isCaseClause(c)) continue;
    const clave = plano(c.expression, ADMIN).replace(/'/g, '');
    caso[clave] = plano(c, ADMIN);
    const asign = caso[clave].match(/fila = (\{[^;]*\});/);
    fila[clave] = asign ? asign[1] : '';
  }
  assert.deepEqual(fila, {
    titulo: '{ titulo }',
    descripcionHtml: '{ descripcion_html: v.html, descripcion: v.texto.slice(0, TOPE_TEXTO) }',
    video: '{ ...v.video }',
    tarea: '{ tarea, ...(c.obligatoria && !tieneTarea({ tarea, campos: c.campos }) ? { obligatoria: false } : {}) }',
    campos: '{ campos: v.campos, ...(c.obligatoria && !tieneTarea({ tarea: c.tarea, campos: v.campos }) ? { obligatoria: false } : {}) }',
    obligatoria: '{ obligatoria: valor }',
    porArea: '{ por_area: valor }',
    // 08/10/2026 (paso LECCIÓN): la ficha de la lección, que eran campos del modal «Editar».
    minutos: '{ minutos: m === null ? null : Math.round(m) }',
    tipo: '{ tipo: valor }',
  });
  // Y lo que se escribe pasa por el mismo tope que el guardado entero (`validarClase`): sin esto, la
  // ficha guardaría −3 minutos o un tipo inventado que el portal no sabe dibujar.
  assert.match(caso.minutos, /typeof valor !== 'number' \|\| !Number\.isFinite\(m\) \|\| m < 0 \|\| m > 600\)\) return \{ ok: false/);
  assert.match(caso.tipo, /typeof valor !== 'string' \|\| !TIPOS_CLASE\.some\(\(t\) => t\.value === valor\)\) return \{ ok: false/);
  const cuerpo = plano(f.nodo, ADMIN);
  assert.match(cuerpo, /if \(presentes\.length !== 1\) return \{ ok: false, error: 'Un cambio por vez\.' \};/);
  assert.match(cuerpo, /\.update\(\{ \.\.\.fila, updated_at: ahora \}\) \.eq\('id', c\.id\)\.eq\('producto_id', c\.productoId\)/);
  assert.doesNotMatch(cuerpo, /\.upsert\(|guardarClase\(/, 'una parte no reescribe la fila');
  // «Cierra la etapa» sólo en un módulo VINCULADO: en un suelto no movería a nadie.
  assert.match(cuerpo, /if \(!prod\.modulos\.find\(\(m\) => m\.clave === c\.etapa\)\?\.vinculado\) return \{ ok: false, error: ERROR_OBLIGATORIA_SUELTO \};/);
});

test('desvincular / vincular: el ORDEN de las escrituras deja el curso visible, y `reclavear` muda TODO lo que nombra la clave', () => {
  // Revisión 08/10: lo más delicado del paso (varias escrituras sin transacción) no tenía test. El orden
  // es el contrato de la cabecera de `vincularModulo`: cortado a mitad queda un módulo DE MÁS, nunca
  // clases colgando de una clave que no es de ningún módulo (desaparecen del portal).
  const DATOS = fuente('lib/curso-modulos-datos.ts');
  const vin = plano(funciones(DATOS).find((x) => x.nombre === 'vincularModulo')!.nodo, DATOS);
  const corte = vin.indexOf('const etapa = etapaDeModulo(');
  const desv = vin.slice(vin.indexOf('if (!vincular) {'), corte);
  const vinc = vin.slice(corte);
  assert.ok(desv.length > 300 && vinc.length > 300, `recortes de ${desv.length} y ${vinc.length}`);
  const posiciones = (s: string, marcas: string[]) => marcas.map((m) => { const i = s.indexOf(m); assert.ok(i >= 0, `falta ${m}`); return i; });
  const d = posiciones(desv, ["from('curso_modulos').insert(", 'await reclavear(productoId, clave, nueva)', '{ ...e, enCurso: false }', 'guardarEtapasEntrega(', "from('curso_modulos').delete()"]);
  assert.deepEqual([...d].sort((a, b) => a - b), d, 'desvincular: nace el suelto, se mudan las clases, la etapa sale del curso y recién ahí se borra la fila vieja');
  // La etapa QUEDA en el kanban (los clientes que están ahí no se mueven): se marca, no se filtra.
  assert.doesNotMatch(desv, /etapas\.filter\(/);
  const v = posiciones(vinc, ['guardarEtapasEntrega(', 'await reclavear(productoId, clave, etapa.key)', "from('curso_modulos').delete()"]);
  assert.deepEqual([...v].sort((a, b) => a - b), v, 'vincular: nace la etapa, se mudan las clases y recién ahí se borra el suelto');
  // Las seis cosas que nombran la clave de un módulo.
  const rc = plano(funciones(DATOS).find((x) => x.nombre === 'reclavear')!.nodo, DATOS);
  for (const t of [
    "from('curso_clases').update({ etapa: nueva", "from('curso_estilo').update({ clave:", "from('curso_desbloqueos').update({ clave: nueva })",
    "from('curso_clase_notas').update({ etapa: nueva })", "from('comunidad_eventos').update({ acceso: { tipo: 'modulo', clave: nueva } })",
    "from('curso_accesos').update({ alcance:",
  ]) assert.ok(rc.includes(t), `reclavear no muda ${t}`);
});

test('guardarBloqueo y borrarModulo validan ANTES de escribir (revisión 08/10: sin esto, la suite seguía verde)', () => {
  const DATOS = fuente('lib/curso-modulos-datos.ts');
  const cuerpo = (n: string) => plano(funciones(DATOS).find((x) => x.nombre === n)!.nodo, DATOS);
  const g = cuerpo('guardarBloqueo');
  // Un candado que no se entiende se RECHAZA: guardado como null sería el default (abrirle a todos lo
  // que se quiso cerrar).
  assert.match(g, /const b: Bloqueo \| null = raw == null \? null : saneaBloqueo\(raw\); if \(raw != null && !b\) return \{ ok: false/);
  assert.match(g, /const no = bloqueoPermitido\(m\.vinculado \? 'vinculado' : 'suelto', b\); if \(no\) return \{ ok: false, error: no \};/);
  assert.match(g, /const no = bloqueoPermitido\('clase', b, \{ claseId: id \}\); if \(no\) return \{ ok: false, error: no \};/);
  // Una `tarea` apunta a una clase de ESTE producto (`claseDelProducto` filtra por producto).
  assert.match(g, /from\('curso_clases'\)\.select\('id, etapa'\)\.eq\('id', id\)\.eq\('producto_id', productoId\)/);
  const b = cuerpo('borrarModulo');
  assert.match(b, /if \(m\.vinculado\) return \{ ok: false/, 'un vinculado es una columna del kanban con clientes: se borra allá');
  assert.match(b, /if \(\(count \?\? 0\) > 0\) return \{ ok: false/, 'con clases se llevaría el avance de cada alumno');
  assert.ok(b.indexOf("from('curso_modulos').delete()") > b.indexOf('(count ?? 0) > 0'), 'se borra DESPUÉS de contar las clases');
});

test('clavesUsadas: las claves que no se reusan se leen ESTRICTAS (decide una clave nueva, no dibuja)', () => {
  // Revisión 08/10: era `clientesEnEntrega`, que devuelve [] con la consulta caída. Con eso, una etapa
  // nueva podía heredar la clave de una borrada y sentar adentro a los clientes que la nombran.
  const DATOS = fuente('lib/curso-modulos-datos.ts');
  const f = funciones(DATOS).find((x) => x.nombre === 'clavesUsadas');
  assert.ok(f, 'no encontré clavesUsadas');
  const cuerpo = plano(f!.nodo, DATOS);
  assert.doesNotMatch(cuerpo, /clientesEnEntrega\(/, 'la lectura que cae a [] no decide qué claves están libres');
  assert.match(cuerpo, /leerTodo<[^>]*>\(db, 'cliente_entrega', 'id, etapa'/);
  assert.match(cuerpo, /leerTodo<[^>]*>\(db, 'curso_clases', 'id, etapa'/);
});

test('validarVideoEntrada: lo que termina en las columnas del video son EXACTAMENTE las tres', () => {
  const ctx = { ws: 1, productoId: 7 };
  for (const raw of [null, { tipo: 'url', url: 'https://youtu.be/abc' }, { tipo: 'link', url: 'https://www.loom.com/share/x' }]) {
    const r = validarVideoEntrada(raw, ctx);
    assert.ok(r.ok, JSON.stringify(raw));
    assert.deepEqual(r.ok && Object.keys(r.video).sort(), ['video_path', 'video_tipo', 'video_url'], JSON.stringify(raw));
  }
});

// ── Probado ROMPIÉNDOLO (08/10/2026) ──────────────────────────────────────────
// Arnés que rompe UNA cosa por vez y restaura de MEMORIA (scratchpad/nucleo/romper.mjs). Sin romper:
// 5 pass / 0 fail. Cada rotura dio 4 / 1, en SU test:
//   · `borrarModuloAction` sin la puerta · `guardarCampoClaseAction` sin `puedeEditar`
//     · `puertaProducto` sin el producto propio                    → «cada action ABRE con la puerta»
//   · cambiar el título escribe otra columna · `guardarCampoClase` como upsert de la fila
//     · «cierra la etapa» en un suelto                             → «guardarCampoClase: UN cambio por vez…»
//   · `revalidatePath` al borrar un suelto                          → «revalidatePath sólo donde…»
//   · un `export const` en el archivo 'use server'                  → «sólo funciones async exportadas»
// REVISIÓN del 08/10/2026 (scratchpad/rev-nucleo/romper-final.mjs, restaurado de memoria). Sin romper:
// 8 pass / 0 fail. Cada rotura dio 7 / 1, en SU test. (Antes de la revisión, romper `guardarBloqueo`
// o `borrarModulo` no tumbaba nada, y desvincular/vincular y `reclavear` —lo más delicado del paso,
// varias escrituras sin transacción— no tenían test.)
//   · `moverClaseA` sin el guard del módulo que espera a esa clase  → «cada action ABRE…»
//   · `clavesUsadas` con `clientesEnEntrega` (cae a [] al fallar)    → «clavesUsadas…»
//   · `reclavear` sin los permisos · desvincular borrando la fila vieja ANTES de mudar las clases ·
//     desvincular SACANDO la etapa del kanban · vincular mudando las clases antes de crear la etapa
//                                                                    → «desvincular / vincular…»
//   · `guardarBloqueo` guardando un candado roto como default · sin `bloqueoPermitido` ·
//     `borrarModulo` borrando un vinculado · o uno con clases       → «guardarBloqueo y borrarModulo…»
// LA FICHA DE LA LECCIÓN (08/10/2026, paso LECCIÓN: `{ minutos }` y `{ tipo }`, que eran campos del modal
// «Editar»; scratchpad/leccion/romper.mjs, restaurado de memoria con md5). Sin romper 8 / 0; cada rotura
// dio 7 / 1 en «guardarCampoClase: UN cambio por vez…»:
//   · los minutos escritos sin redondear · sin el rango 0 a 600 · el tipo sin `TIPOS_CLASE`
//   (las dos últimas pasaban en VERDE antes de sumar las aserciones del `caso`: el mapa de `fila = …`
//   no mira la validación de arriba.)
