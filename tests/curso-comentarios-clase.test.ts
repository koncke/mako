// =============================================================================
// curso-comentarios-clase — los comentarios de UNA clase (item 13 del audio del 08/10/2026, mig 0227)
// =============================================================================
// «Algo que falta dentro de las clases, tal vez estaría bueno, es agregar si el usuario quiere agregar
// un apartado de chat, que a veces muchas plataformas tienen, entonces vos puedes chatear acerca de esa
// clase» (minuto 15:00, docs/feedback-curso-08oct.md).
//
// Lo que estos tests cuidan es lo que, si se rompe, NO se ve:
//   · el CANDADO: un alumno que no puede ver la clase no ve ni comenta sus comentarios, y una clase de
//     otro producto o de otro negocio no se comenta (la regla pura `puedeComentarLaClase`, EJECUTADA, y
//     que la capa de datos la use en la puerta de TODO post: `postDe`);
//   · el AJUSTE: apagado por default, y sólo «si» lo prende (lib/curso-estilo.ts, EJECUTADO);
//   · que los hilos de clase NO salgan en el feed ni en la búsqueda, ni se editen, borren o fijen enteros
//     (su «autor» es quien comentó primero: borrarlo se llevaría los comentarios de todos);
//   · la migración: idempotente, FK en cascada con su DO, un hilo por clase, y su orden de despliegue;
//   · los dos montajes (portal y editor) con el ajuste, y la caja adentro de la hoja del curso.
// Lo que se LEE del fuente se lee SIN comentarios y POR FUNCIÓN (AGENTS.md: un guard que lee el archivo
// entero encuentra lo que el archivo dice de sí).
//
// PROBADO ROMPIÉNDOLO (08/10/2026, scratchpad/general/romper-comentarios.mjs: guarda cada archivo en
// memoria, lo rompe, corre ESTE archivo y lo reescribe — nunca git). Los números, al pie (ROTURAS).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ajusteDe, ajusteValido, armarEstilo, claveDe, comentariosPrendidos, conAjuste, estiloVacio, sanearAjuste, valorDe,
} from '../lib/curso-estilo';
import { puedeComentarLaClase } from '../lib/comunidad-reglas';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de una función: desde su firma hasta la siguiente declaración de primer nivel. */
function cuerpo(src: string, nombre: string): string {
  const ini = src.search(new RegExp(`\\n(export )?(async )?function ${nombre}\\b`));
  assert.ok(ini >= 0, `no encontré la función ${nombre}`);
  const resto = src.slice(ini + 1);
  const fin = resto.search(/\n(export )?(async )?function \w+|\nconst [A-Za-z_]+ = |\ntype \w+ = /);
  const c = fin > 0 ? resto.slice(0, fin) : resto;
  assert.ok(c.length < 6000, `el recorte de ${nombre} mide ${c.length}: está mirando otra cosa`);
  return c;
}
const antesQue = (c: string, a: string, b: string) => {
  const i = c.indexOf(a); const j = c.indexOf(b);
  assert.ok(i >= 0, `falta «${a}»`); assert.ok(j >= 0, `falta «${b}»`);
  return i < j;
};

// ── La regla: quién ve el hilo de una clase ──────────────────────────────────────

const BASE = { mismoWorkspace: true, productoDeLaClase: 5, productoDelActor: 5, comentariosPrendidos: true, abiertaParaElAlumno: true };

test('el ALUMNO: sólo con los comentarios prendidos y la clase ABIERTA para él', () => {
  assert.equal(puedeComentarLaClase({ ...BASE, equipo: false }), true);
  assert.equal(puedeComentarLaClase({ ...BASE, equipo: false, abiertaParaElAlumno: false }), false, 'una clase con candado deja ver sus comentarios');
  assert.equal(puedeComentarLaClase({ ...BASE, equipo: false, comentariosPrendidos: false }), false, 'con el ajuste apagado el alumno comenta igual');
});

test('IDOR: una clase de OTRO producto, de otro negocio o que no existe no se comenta (ni el equipo)', () => {
  for (const equipo of [false, true]) {
    assert.equal(puedeComentarLaClase({ ...BASE, equipo, productoDeLaClase: 6 }), false, `otro producto (equipo=${equipo})`);
    assert.equal(puedeComentarLaClase({ ...BASE, equipo, productoDeLaClase: null }), false, `no existe / otro negocio (equipo=${equipo})`);
    assert.equal(puedeComentarLaClase({ ...BASE, equipo, mismoWorkspace: false }), false, `otro contexto (equipo=${equipo})`);
  }
});

test('el EQUIPO ve el hilo de una clase de su producto con el ajuste apagado (modera)', () => {
  assert.equal(puedeComentarLaClase({ ...BASE, equipo: true, comentariosPrendidos: false, abiertaParaElAlumno: false }), true);
});

// ── El ajuste del curso ──────────────────────────────────────────────────────────

test('«Comentarios en las clases»: apagado por default, y SÓLO «si» lo prende', () => {
  assert.equal(estiloVacio().comentarios, null);
  assert.equal(comentariosPrendidos(estiloVacio()), false);
  assert.equal(comentariosPrendidos(null), false);
  assert.deepEqual(ajusteDe('comentarios'), { tipo: 'comentarios' });
  assert.deepEqual(ajusteValido({ tipo: 'comentarios' }), { tipo: 'comentarios' });
  assert.equal(claveDe({ tipo: 'comentarios' }), 'comentarios');
  assert.equal(sanearAjuste({ tipo: 'comentarios' }, 'si'), 'si');
  for (const raro of [true, 'true', '1', 'SI', 'sí', null, undefined, {}]) {
    assert.equal(sanearAjuste({ tipo: 'comentarios' }, raro), null, `«${String(raro)}» prendió el chat`);
  }
  const e = armarEstilo([{ clave: 'comentarios', valor: 'si' }]);
  assert.equal(e.comentarios, 'si');
  assert.equal(comentariosPrendidos(e), true);
  assert.equal(armarEstilo([{ clave: 'comentarios', valor: 'quizas' }]).comentarios, null, 'una fila rota prende el chat');
  assert.equal(valorDe(e, { tipo: 'comentarios' }), 'si');
  assert.equal(conAjuste(e, { tipo: 'comentarios' }, null).comentarios, null, 'apagarlo no lo apaga');
  assert.equal(conAjuste(estiloVacio(), { tipo: 'comentarios' }, 'si').comentarios, 'si');
});

// ── La capa de datos (lib/comunidad-datos.ts) ────────────────────────────────────

const DATOS = sinComentarios(leer('lib/comunidad-datos.ts'));

test('la PUERTA de todo post (`postDe`) pide la clase y pregunta si el actor ve su hilo', () => {
  const c = cuerpo(DATOS, 'postDe');
  assert.match(c, /\.select\(COLS_POST_CLASE\)/, 'postDe no lee la clase del post: el candado no se puede preguntar');
  assert.match(c, /if \(f && f\.clase_id != null && !\(await veElHiloDeLaClase\(a, Number\(f\.clase_id\)\)\)\) return null;/);
  assert.match(DATOS, /const COLS_POST_CLASE = `\$\{COLS_POST\}, clase_id`;/);
});

test('un comentario de un hilo que el alumno no ve no se likea, responde, edita ni borra (`comentarioDe`)', () => {
  assert.match(cuerpo(DATOS, 'comentarioDe'), /if \(c && !a\.equipo && !\(await postDe\(a, Number\(c\.post_id\)\)\)\) return null;/);
});

test('la lectura de la clase la DECIDE la regla pura, con el candado del portal', () => {
  const c = cuerpo(DATOS, 'leerClaseParaComentar');
  assert.match(c, /const mismoWorkspace = \(await getWorkspaceActual\(\)\) === a\.ws;/);
  assert.ok(antesQue(c, 'comentariosDelCurso(', 'claseDelAlumno('), 'el candado se evalúa con los comentarios apagados');
  assert.match(c, /claseDelAlumno\(a\.leadId, claseId, \{ exigeAbierta: true, alcance: a\.alcance \?\? null \}\)/);
  assert.match(c, /abiertaParaElAlumno: ok != null && ok\.abierta === true/);
  assert.equal((c.match(/puedeComentarLaClase\(\{/g) ?? []).length, 2, 'el equipo o el alumno deciden sin la regla');
  assert.match(c, /productoDeLaClase: c\?\.productoId \?\? null/);
  // El ajuste se lee ESTRICTO: decide si un alumno lee el hilo.
  assert.match(cuerpo(DATOS, 'comentariosDelCurso'), /if \(error\) throw new Error\(error\.message\);/);
});

test('los hilos de clase NO salen en el feed ni en la búsqueda', () => {
  assert.match(cuerpo(DATOS, 'feedComunidad'), /\.eq\('producto_id', a\.productoId\)\.is\('clase_id', null\)/);
  assert.match(cuerpo(DATOS, 'buscarEnComunidad'), /\.eq\('producto_id', a\.productoId\)\.is\('clase_id', null\)/);
});

// ── TODO lector de `comunidad_posts` decide qué hace con los hilos de clase (revisión final, 08/10/2026) ──
// El feed y la búsqueda los sacaban, y la tarea «Comentar en la comunidad» (lib/curso-tarea-comunidad.ts)
// NO: el equipo podía elegir como tarea de la clase 2 el hilo de la clase 7, y el id del hilo que un alumno
// abrió completaba «Publicar en la comunidad» sin publicar nada. Lo encontró la revisión leyendo cada
// `comunidad_posts` del repo, no un test: un lector nuevo no avisa. Este guard los BARRE (lib/ y app/): cada
// consulta a la tabla nombra `clase_id`, o vive en una función de esta lista con su porqué — y la lista
// se poda sola (una entrada que ya no corresponde a ninguna consulta también falla).
const LECTORES_SIN_FILTRO: Record<string, string> = {
  'lib/comunidad-datos.ts#productoDelPost': 'por id, para abrir un link: la puerta del post es `postDe`',
  'lib/comunidad-datos.ts#descartarAdjunto': 'por el path de un adjunto (¿lo nombra algún post?)',
  'lib/comunidad-datos.ts#publicarPost': 'inserta un post del feed (`clase_id` nace null)',
  'lib/comunidad-datos.ts#editarPost': 'por id, después del corte «Es el hilo de una clase.»',
  'lib/comunidad-datos.ts#borrarPost': 'por id, después del corte «Es el hilo de una clase.»',
  'lib/comunidad-datos.ts#fijarPost': 'cuenta los fijados y fija por id, después del corte',
  'lib/comunidad-datos.ts#comentar': 'la actividad del post que `postDe` ya dejó pasar',
  'lib/comunidad-datos.ts#hechosDeLaComunidad': '`contar` agrega el filtro adentro',
  'lib/comunidad-moderacion.ts#cerrarComentarios': 'por id: el equipo cierra también el hilo de una clase',
  'lib/comunidad-campana.ts#titulosDePosts': 'los títulos de las notificaciones de quien ya recibió el aviso',
  'lib/curso-tarea-comunidad.ts#postDeLaComunidad': 'por id, el que eligió el equipo de `opcionesParaTareas` (que ya los saca)',
};
function lectoresDePosts(): Array<{ donde: string; sentencia: string }> {
  const out: Array<{ donde: string; sentencia: string }> = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(join(RAIZ, dir))) {
      const rel = `${dir}/${n}`;
      if (statSync(join(RAIZ, rel)).isDirectory()) { if (n !== 'node_modules' && !n.startsWith('.')) recorrer(rel); continue; }
      if (!/\.tsx?$/.test(n)) continue;
      const src = sinComentarios(leer(rel));
      const re = /\bde\([^()]*?,\s*'comunidad_posts'\)|\.from\('comunidad_posts'\)|leerTodo<[^>]*>\([^,]+,\s*'comunidad_posts'|\bcontar\('comunidad_posts'/g;
      for (const m of src.matchAll(re)) {
        const fin = src.indexOf(';', m.index!);
        const sentencia = src.slice(m.index!, fin > 0 ? fin : undefined);
        // La función de PRIMER nivel que la contiene (sin sangría: un `const b = (…)` de adentro no cuenta).
        const antes = src.slice(0, m.index!);
        const fns = [...antes.matchAll(/\n(?:export )?(?:async )?function (\w+)|\n(?:export )?const (\w+) = (?:async )?\(/g)];
        const fn = fns.length ? (fns[fns.length - 1][1] ?? fns[fns.length - 1][2]) : '?';
        out.push({ donde: `${rel}#${fn}`, sentencia });
      }
    }
  };
  recorrer('lib');
  recorrer('app');
  return out;
}
test('TODO lector de comunidad_posts nombra clase_id, o está en la lista con su porqué', () => {
  const lectores = lectoresDePosts();
  assert.ok(lectores.length >= 15, `encontré ${lectores.length} consultas: el barrido no está mirando`);
  // `COLS_POST_CLASE` es `COLS_POST` + `clase_id` (la pide `postDe`, que decide con ella).
  const sinFiltro = lectores.filter((l) => !/clase_id|COLS_POST_CLASE/.test(l.sentencia)).map((l) => l.donde);
  const nuevos = [...new Set(sinFiltro)].filter((d) => !(d in LECTORES_SIN_FILTRO));
  assert.deepEqual(nuevos, [], 'una consulta a comunidad_posts que no decide qué hace con los hilos de clase');
  const viejos = Object.keys(LECTORES_SIN_FILTRO).filter((d) => !sinFiltro.includes(d));
  assert.deepEqual(viejos, [], 'una excusa de la lista ya no corresponde a ninguna consulta: sacala');
  // Y los dos de la tarea que se olvidaban, por nombre (la lista de arriba no los deja volver a entrar).
  const tarea = sinComentarios(leer('lib/curso-tarea-comunidad.ts'));
  const opciones = cuerpo(tarea, 'opcionesParaTareas');
  assert.equal((opciones.match(/\.eq\('producto_id', productoId\)\.is\('clase_id', null\)/g) ?? []).length, 2, 'la lista de posts para la tarea ofrece hilos de clase');
  assert.match(cuerpo(tarea, 'verificarComunidad'), /\.eq\('miembro', miembro\)\.is\('clase_id', null\)\.maybeSingle\(\)/);
});

test('un hilo de clase no se edita, no se borra entero y no se fija: ANTES de escribir', () => {
  const corta = "if (f.clase_id != null) return { ok: false, error: 'Es el hilo de una clase.' };";
  assert.ok(antesQue(cuerpo(DATOS, 'editarPost'), corta, '.update('));
  assert.ok(antesQue(cuerpo(DATOS, 'borrarPost'), corta, '.delete()'));
  assert.ok(antesQue(cuerpo(DATOS, 'fijarPost'), corta, '.update('));
  // Sacar a alguien con su contenido no se lleva el hilo que abrió (y con él, los comentarios de todos).
  const mod = sinComentarios(leer('lib/comunidad-moderacion.ts'));
  assert.match(mod, /de\(a\.ws, 'comunidad_posts'\)\.delete\(\)\.eq\('producto_id', a\.productoId\)\.eq\('miembro', c\.clave\)\.is\('clase_id', null\)/);
});

test('comentar una clase: valida el texto ANTES de abrir el hilo, y comenta con `comentar` (no una copia)', () => {
  const c = cuerpo(DATOS, 'comentarEnClase');
  assert.ok(antesQue(c, 'claseParaComentar(a, claseId)', 'abrirHiloDeLaClase('), 'abre el hilo sin el candado');
  assert.ok(antesQue(c, 'validarComentario(', 'abrirHiloDeLaClase('), 'un comentario vacío deja un hilo vacío colgado');
  assert.match(c, /await comentar\(a, post\.id, \{ cuerpo: b\.cuerpo, menciones: b\.menciones, responderA: null \}\)/);
  // Dos primeros comentarios a la vez: el índice único deja uno y el otro usa ése.
  const abrir = cuerpo(DATOS, 'abrirHiloDeLaClase');
  assert.match(abrir, /if \(error\.code === '23505'\) \{\s*const otro = await postDeLaClase\(a, clase\.id\);/);
  assert.match(abrir, /clase_id: clase\.id/);
  // Leer el hilo pasa por la misma decisión.
  assert.match(cuerpo(DATOS, 'hiloDeClase'), /const clase = claseId \? await claseParaComentar\(a, claseId\) : null;/);
});

// ── Las puertas: la ruta del alumno, las actions del equipo y las dos APIs ──────

test('la ruta del alumno expone las dos acciones con el actor de la FIRMA', () => {
  const r = sinComentarios(leer('app/api/compartido/comunidad/route.ts'));
  assert.match(r, /const LECTURAS = new Set\(\[[^\]]*'clase'/);
  assert.match(r, /const ESCRITURAS = new Set\(\[[^\]]*'comentarClase'/);
  assert.match(r, /case 'clase': return OK\(await hiloDeClase\(actor, b\.claseId\)\);/);
  assert.match(r, /case 'comentarClase': return OK\(await comentarEnClase\(actor, b\.claseId, b\.comentario\)\);/);
  const api = sinComentarios(leer('app/_comunidad/api.ts'));
  assert.match(api, /hiloClase: \(claseId\) => pedir\('clase', \{ claseId \}\)/);
  assert.match(api, /comentarClase: \(claseId, comentario\) => pedir\('comentarClase', \{ claseId, comentario \}\)/);
  const equipo = sinComentarios(leer('app/customer-success/comunidad/api-equipo.ts'));
  assert.match(equipo, /hiloClase: seguro\(\(claseId\) => hiloDeClaseAction\(p, claseId\)\)/);
  assert.match(equipo, /comentarClase: seguro\(\(claseId, e\) => comentarEnClaseAction\(p, claseId, e\)\)/);
  // La tab Comunidad sigue usando LA API (no una copia que se quede sin estas dos).
  assert.match(sinComentarios(leer('app/customer-success/comunidad/ComunidadEquipo.tsx')), /import \{ apiDelEquipo \} from '\.\/api-equipo';/);
});

// ── La migración ────────────────────────────────────────────────────────────────

test('la 0227: columna, FK en cascada idempotente, UN hilo por clase, RLS y su orden de despliegue', () => {
  const sql = leer('supabase/migrations/0227_comentarios_de_clase.sql');
  assert.match(sql, /ORDEN DE DESPLIEGUE: ANTES del deploy/);
  const s = sql.replace(/^--.*$/gm, '');
  assert.match(s, /alter table comunidad_posts add column if not exists clase_id bigint;/);
  assert.match(s, /if not exists \(select 1 from pg_constraint where conname = 'comunidad_posts_clase_fk'\) then\s+alter table comunidad_posts\s+add constraint comunidad_posts_clase_fk foreign key \(clase_id\) references curso_clases\(id\) on delete cascade;/);
  assert.match(s, /create unique index if not exists comunidad_posts_clase_uk\s+on comunidad_posts \(workspace_id, producto_id, clase_id\) where clase_id is not null;/);
  assert.match(s, /alter table comunidad_posts enable row level security;/);
  assert.match(s, /revoke all on comunidad_posts from anon, authenticated;/);
  // La tabla ya está registrada como de inquilino (la columna no agrega tabla nueva).
  assert.match(leer('lib/workspace.ts'), /'comunidad_posts'/);
  assert.match(leer('lib/tablas-de-inquilino.ts'), /'comunidad_posts'/);
});

// ── Los montajes ────────────────────────────────────────────────────────────────

test('el portal del alumno monta los comentarios SÓLO con el ajuste prendido, y nunca al líder de un área', () => {
  const p = sinComentarios(leer('app/compartido/curso/[token]/PortalAlumno.tsx'));
  assert.match(p, /const conComentarios = comentariosPrendidos\(producto\.estilo\) && !lider;/);
  assert.match(p, /despues: conComentarios\s*\?\s*<ComentariosClase key=\{c\.id\} api=\{apiComentarios\} claseId=\{c\.id\} vistaPrevia=\{vistaPrevia\} \/>/);
  // La API del alumno es la de SU token y SU producto; en la vista previa no hay API (no se pide nada).
  assert.match(p, /conComentarios && !vistaPrevia \? apiDelAlumno\(token, producto\.productoId\) : null/);
});

test('el editor: los comentarios debajo de la lección con el ajuste, y el interruptor en el menú de la marca', () => {
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.match(app, /if \(!comentariosPrendidos\(estiloActual\) \|\| !apiComunidad\) return l;/);
  assert.match(app, /<ComentariosClase key=\{c\.id\} api=\{apiComunidad\} claseId=\{c\.id\}/);
  // «Ver en Comunidad» es un <a> adentro del curso: lleva el ?ws= (AGENTS.md, las cinco formas de navegar).
  assert.match(app, /linkComunidad=\{\(postId\) => conWs\(`\/customer-success\/comunidad\?producto=\$\{c\.productoId\}&post=\$\{postId\}`, wsPestana\)\}/);
  // El interruptor: del CURSO (como el color), con su Deshacer por el mismo camino, y de quien edita.
  const marca = app.slice(app.indexOf('const menuMarca = '), app.indexOf('if (!servicio) {', app.indexOf('const menuMarca = ')));
  assert.ok(marca.length > 500 && marca.length < 9000, `el recorte del menú mide ${marca.length}`);
  assert.match(marca, /cambiarAspecto\(\{ tipo: 'comentarios' \}, comentariosPrendidos\(estilo\) \? null : 'si',/);
  assert.match(marca, /role="switch" aria-checked=\{comentariosPrendidos\(estilo\)\}/);
  assert.ok(antesQue(marca, '{puedeEditar && !estiloError && (', "tipo: 'comentarios'"), 'el interruptor quedó afuera del bloque de quien edita');
  // El hook de la API va ANTES de cualquier return de la pantalla.
  assert.ok(antesQue(app, 'const apiComunidad = useMemo(', 'if (errorEntrega) {'), 'un hook detrás de un return');
});

test('la caja va adentro de la hoja del curso: todo acotado a «.ahdoc .ugc», sin Modal ni Confirm, y en neutro', () => {
  const src = leer('app/_cursos/ComentariosClase.tsx');
  const css = /const CSS_COMENTARIOS = `([\s\S]*?)`;/.exec(src)?.[1] ?? '';
  assert.ok(css.length > 1000, 'no encontré la hoja');
  const reglas = css.replace(/@keyframes[^{]*\{[^{}]*\{[^{}]*\}[^{}]*\}/g, '').replace(/@media[^{]*\{/g, '').split('}')
    .map((r) => r.split('{')[0].trim()).filter(Boolean);
  assert.ok(reglas.length >= 25, `encontré ${reglas.length} reglas`);
  for (const sel of reglas.flatMap((r) => r.split(',')).map((s) => s.trim())) {
    assert.match(sel, /^\.ahdoc \.ugc \.ccl/, `«${sel}» pierde contra el reset de la hoja del curso`);
  }
  const codigo = sinComentarios(src);
  assert.doesNotMatch(codigo, /from '@\/app\/_ui'|<Modal|useConfirm/, 'un diálogo adentro del curso sale sin piel');
  assert.match(codigo, /if \(!api\?\.hiloClase \|\| !api\.comentarClase\) return null;/);
  // Lo que se lee en pantalla, en neutro con TÚ (lo lee el alumno de un negocio mexicano).
  const textos = [...codigo.matchAll(/(?:label|placeholder|title|boton)="([^"]+)"|>([^<>{}\n]{3,})</g)].map((m) => m[1] ?? m[2]).join('\n');
  assert.ok(textos.includes('Escribe un comentario'), 'el barrido de textos no encontró nada');
  assert.deepEqual(marcasDeVoseo(textos), []);
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 08/10/2026 (scratchpad/general/romper.mjs + roturas.mjs). Con todo en su lugar: 15 pass /
// 0 fail. Cada rotura, sola, dio 14 / 1 en el test que le toca:
//   1. la regla: todo lo «suyo» se comenta (sin ajuste ni candado)   → «el ALUMNO…»
//   2. la regla sin mirar el producto de la clase (IDOR)            → «IDOR…»
//   3. el alumno comenta con el ajuste apagado                      → «el ALUMNO…»
//   4. cualquier valor prende el ajuste · 5. el ajuste nace PRENDIDO → «Comentarios en las clases…»
//   6. `postDe` sin el candado de la clase                          → «la PUERTA de todo post…»
//   7. el hilo sale en el feed · 8. sale en la búsqueda             → «NO salen en el feed…»
//   9. `borrarPost` borra el hilo entero · 13. sacar a alguien se lleva el hilo que abrió → «no se edita…»
//  10. `comentarioDe` sin mirar el post del alumno                  → «un comentario de un hilo…»
//  11. el candado sin `exigeAbierta`                                → «la lectura de la clase…»
//  12. comentar sin validar antes de abrir el hilo                  → «comentar una clase…»
//  14. la ruta sin 'comentarClase'                                  → «la ruta del alumno…»
//  15. la FK sin cascada                                            → «la 0227…»
//  16. el líder de un área ve los comentarios                       → «el portal del alumno…»
//  17. el editor los monta con el ajuste apagado                    → «el editor…»
//  18. una regla de la caja sin «.ahdoc .ugc» · 19. un texto voseado → «la caja va adentro…»
// ⚠️ La 19 escrita como «Escribí el primero.» pasó en VERDE (15 / 0): `marcasDeVoseo` no ve los
//    imperativos en -ir (son homógrafos del pretérito, «yo escribí»), el agujero que ya documenta
//    docs/hallazgos-copy.md. Con «Tocá acá…» cae. El guard de voseo de este archivo no cubre -ir.
//
// Revisión final (08/10/2026, scratchpad/revfinal-vgs/romper.mjs, restaurado de memoria con md5). Con
// todo en su lugar: 16 / 0. Cada rotura, sola, en «TODO lector de comunidad_posts…»:
//   R1 la lista de la tarea sin el filtro en los fijados · R2 en los recientes        → 15 / 1
//   R3 `verificarComunidad` acepta el hilo de una clase como «ya publiqué»            → 15 / 1
//   R4 `ultimoPostFijado` sin el filtro                                               → 15 / 1
//   R5 el feed sin el filtro → 14 / 2 (cae también «NO salen en el feed…»)
