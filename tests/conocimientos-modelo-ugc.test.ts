// =============================================================================
// Un curso de Conocimientos, traducido al dibujo de los cursos (app/conocimientos/modelo-ugc.ts)
// =============================================================================
// Desde el 08/10/2026 Conocimientos monta app/_cursos/CursoUgc.tsx, como el portal del alumno y la tab
// Curso, y dejó su copia del DOM (CursoReplica.tsx, borrado). Lo que se EJECUTA acá: el adaptador puro,
// contra un curso de prueba (los ajustes del super admin) y contra el CATÁLOGO ENTERO (que sin ajustes
// todo se vea exactamente como con la réplica: los mismos módulos, los mismos números y las mismas
// tapas, y que los `#mod=<nombre>` que circulan sigan abriendo el mismo módulo).
//
// La regla de la réplica está COPIADA abajo (`reglaDeLaReplica`) a propósito: es la referencia contra
// la que se mide, y no puede salir del mismo módulo que se está probando.
//
// ── Roturas (08/10/2026; scratchpad/cono/romper.mjs, que restaura deshaciendo el reemplazo) ──
// Sin romper: 8 / 0. Una por vez, cada una tumbó SU test (7 / 1):
//   · la key del módulo por su nombre DIBUJADO          → «reordenar o renombrar». ⚠️ Sin la
//     aserción del caso RENOMBRADO esta rotura daba 8 / 0 (medido con scratchpad/cono/medir-key.mjs):
//     sin renombrar, nombre y key coinciden, así que el catálogo entero pasaba igual.
//   · `numerosDeModulos` sin renumerar al reordenar      → «reordenar o renombrar»
//   · el módulo oculto sin aviso ni atenuado             → «lo oculto»
//   · la tapa de la ficha encima de la lámina elegida    → «las tapas elegidas»
//   · el número de la ficha en una clase movida          → «una clase movida»
//   · Conocimientos dibujando su propio `ugc-shell`      → «Conocimientos monta el dibujo»
//   · «+ Nueva clase» sin preguntar por `onNueva` · `claseEstado` sin `is-atenuado`
//                                                        → «el dibujo atenúa lo oculto»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Clase, Curso } from '../app/conocimientos/curso';
import { aplicarAjustes } from '../lib/conocimiento-ajustes';
import { valorDeLamina } from '../lib/laminas';
import { DRIVE_THUMB, chipsDeClase, clasesUgc, minutosDe, modulosUgc, numerosDeModulos, portadaUgc } from '../app/conocimientos/modelo-ugc';
import { clasesVisibles } from '../app/_cursos/reglas';

const RAIZ = join(__dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const clase = (n: number, grupo: string | undefined, extra: Partial<Clase> = {}): Clase => ({
  n, grupo, titulo: `Clase ${n}`, cardDesc: '2:30 · Formatos', videoId: `v${n}`, resumen: '', transcripcion: [],
  recursoSlugs: [], herramientas: [], ...extra,
});
const A = 'Módulo 1 - Intro';
const B = 'Módulo 2 - Base';
const C = 'Módulo 3 - Cierre';
const CURSO: Curso = {
  slug: 'demo', categoria: 'Categoría', cardDesc: '5 clases', eyebrow: '', titulo: 'Demo - Autor', tituloCorto: 'Demo',
  subtitulo: '', volumen: '', resumen: 'De qué va', portada: '/cono-portadas/demo.webp',
  clases: [
    clase(10, A, { vn: 1, portadaClase: '/cono-ugc/c10.webp' }), clase(11, A, { vn: 2 }),
    clase(20, B, { vn: 1, codigo: '2.1' }), clase(21, B, { vn: 2, codigo: '2.2', videoId: null }),
    clase(30, C, { vn: 1 }),
  ],
  recursos: [],
};
const fila = (objeto: string, objeto_id: string, campo: string, valor: string) => ({ curso_slug: 'demo', objeto, objeto_id, campo, valor });

// ── La referencia: lo que hacía CursoReplica, copiado tal cual ──────────────────────
const SIN_MODULO = 'Clases';
const ORDINAL = /^\s*[([]?\s*(?:m[oó]dulo|semana|unidad|secci[oó]n|bloque|cap[ií]tulo)\s*[)\]]?\s*(\d{1,3})(\.\d+)?\b/iu;
function reglaDeLaReplica(curso: Curso) {
  const m = new Map<string, Clase[]>();
  for (const c of curso.clases) {
    const g = c.grupo || SIN_MODULO;
    if (!m.has(g)) m.set(g, []);
    m.get(g)!.push(c);
  }
  const grupos = [...m.entries()];
  const propios = grupos.map(([nombre]) => ORDINAL.exec(nombre));
  const numeros = propios.every((o) => o && !o[2]) ? propios.map((o) => Number(o![1])) : null;
  return grupos.map(([nombre, clases], i) => {
    const n = numeros ? numeros[i] : (Number((clases[0]?.codigo ?? '').split('.')[0]) || i + 1);
    const portada = curso.portadasModulo ? `${curso.portadasModulo}${n}.webp` : (clases.find((c) => c.portadaClase)?.portadaClase ?? null);
    return { n, nombre, clases, portada };
  });
}

// ROTURA: la key del módulo por su nombre DIBUJADO en vez del original → cae ESTE test (y el de abajo).
test('el CATÁLOGO ENTERO, sin ajustes, se ve igual que con la réplica', async () => {
  const { CURSOS_TODOS } = await import('../app/conocimientos/catalogo');
  assert.ok(CURSOS_TODOS.length > 100, `el catálogo trajo ${CURSOS_TODOS.length} cursos: esto no está mirando el de verdad`);
  let modulos = 0;
  let clases = 0;
  for (const curso of CURSOS_TODOS) {
    const cur = aplicarAjustes(curso, []);
    const ref = reglaDeLaReplica(curso);
    const ms = modulosUgc(cur);
    assert.deepEqual(ms.map((m) => m.key), ref.map((r) => r.nombre), `${curso.slug}: la key es el nombre del grupo`);
    assert.deepEqual(ms.map((m) => m.nombre), ref.map((r) => r.nombre), `${curso.slug}: el nombre`);
    assert.deepEqual(ms.map((m) => m.n), ref.map((r) => r.n), `${curso.slug}: el número de cada módulo`);
    assert.deepEqual(ms.map((m) => m.portada ?? null), ref.map((r) => r.portada), `${curso.slug}: la tapa de cada módulo`);
    assert.deepEqual(ms.map((m) => m.cuantas), ref.map((r) => r.clases.length), `${curso.slug}: cuántas clases`);

    const cs = clasesUgc(cur);
    assert.equal(cs.length, curso.clases.length, `${curso.slug}: no se pierde ninguna clase`);
    const porN = new Map(curso.clases.map((c) => [c.n, c]));
    for (const u of cs) {
      const c = porN.get(u.id)!;
      assert.equal(u.vn, c.vn ?? c.codigo ?? c.n, `${curso.slug}#${c.n}: el número de la tarjeta`);
      assert.equal(u.tapa ?? null, c.portadaClase ? c.portadaClase : c.videoId ? DRIVE_THUMB(c.videoId) : null, `${curso.slug}#${c.n}: la tapa`);
    }
    // Los `#mod=<nombre>` que ya circulan abren las MISMAS clases que abrían.
    for (const r of ref) {
      const vis = clasesVisibles(cs, ms, r.nombre, '');
      assert.deepEqual(vis?.map((u) => u.id), r.clases.map((c) => c.n), `${curso.slug}: #mod=${r.nombre}`);
    }
    const p = portadaUgc(cur);
    assert.equal(p.titulo, curso.tituloCorto ?? curso.titulo);
    assert.equal(p.eyebrow, curso.categoria);
    assert.equal(p.tapa ?? null, curso.clases[0]?.portadaClase ?? curso.portada ?? null, `${curso.slug}: la tapa de la portada`);
    modulos += ms.length;
    clases += cs.length;
  }
  // El censo del relevo del 08/10/2026: 1.352 módulos y 9.603 clases. Si baja mucho, se perdió algo.
  assert.ok(modulos > 1300 && clases > 9500, `${modulos} módulos y ${clases} clases`);
});

// ── Con ajustes ────────────────────────────────────────────────────────────────────
// ROTURA: `numerosDeModulos` sin renumerar al reordenar → cae ESTE test.
test('reordenar o renombrar renumera sobre lo que se ve; la tapa de la ficha sigue a su módulo', () => {
  const conTapas: Curso = { ...CURSO, portadasModulo: '/cono-ugc/m' };
  const cur = aplicarAjustes(conTapas, [fila('modulo', C, 'orden', '0'), fila('modulo', A, 'orden', '1'), fila('modulo', B, 'orden', '2')]);
  const ms = modulosUgc(cur);
  // Los tres traen su ordinal en el nombre: se respeta, aunque el orden cambie.
  assert.deepEqual(ms.map((m) => [m.key, m.n]), [[C, 3], [A, 1], [B, 2]]);
  // Renombrado sin ordinal: la posición.
  const r = modulosUgc(aplicarAjustes(conTapas, [fila('modulo', C, 'orden', '0'), fila('modulo', A, 'orden', '1'), fila('modulo', B, 'orden', '2'), fila('modulo', A, 'nombre', 'Bienvenida')]));
  assert.deepEqual(r.map((m) => m.n), [1, 2, 3]);
  // ⚠️ Renombrado, su KEY sigue siendo el nombre de la ficha: es lo que llevan los `#mod=` que circulan,
  //    y lo que nombra a su módulo cada clase (`moduloKey`). Sin esto, el módulo se dibuja y queda vacío.
  assert.deepEqual(r.map((m) => [m.key, m.nombre]), [[C, C], [A, 'Bienvenida'], [B, B]]);
  // ⚠️ La foto de la ficha sale del número de la FICHA, no del que se dibuja: mover el módulo no le cambia la tapa.
  assert.deepEqual(r.map((m) => m.portada), ['/cono-ugc/m3.webp', '/cono-ugc/m1.webp', '/cono-ugc/m2.webp']);
  // Ocultar uno (para quien cursa) renumera sin huecos.
  const sinB = aplicarAjustes(CURSO, [fila('modulo', A, 'nombre', 'Hola'), fila('modulo', B, 'oculto', '1')]);
  assert.deepEqual(numerosDeModulos(sinB), [1, 2]);
});

test('las tapas elegidas le ganan a las de la ficha, y una lámina no queda tapada', () => {
  const lam = valorDeLamina({ diseno: 'nota', a: '#FFE66D', b: '#E4572E', texto: 'Arranque' });
  const cur = aplicarAjustes(CURSO, [
    fila('modulo', A, 'portada', lam),
    fila('clase', '10', 'portada', 'grad:oceano'),
    fila('clase', '11', 'portada', lam),
    fila('curso', '', 'portada', 'grad:noche'),
  ]);
  const a = modulosUgc(cur)[0];
  assert.equal(a.portada, null, 'con una lámina elegida, la tapa de la ficha no se dibuja encima');
  assert.equal(a.lamina?.diseno, 'nota');
  assert.equal(a.lamina?.texto, 'Arranque');
  const [c10, c11] = clasesUgc(cur);
  assert.equal(c10.tapa, null, 'su portadaClase de la ficha quedaría encima del degradado');
  assert.match(String(c10.fondo), /gradient/);
  assert.equal(c11.tapa, null, 'la miniatura del video taparía la lámina');
  assert.equal(c11.lamina?.diseno, 'nota');
  const p = portadaUgc(cur);
  assert.equal(p.tapa, null);
  assert.match(String(p.fondo), /gradient/);
});

// ROTURA: el adaptador sin `aviso`/`atenuado` en un módulo oculto → cae ESTE test.
test('lo oculto (sólo el super admin) se dibuja atenuado y dicho; la portada lleva a la primera que se ve', () => {
  const cur = aplicarAjustes(CURSO, [fila('modulo', B, 'oculto', '1'), fila('clase', '10', 'oculta', '1')], { conOcultos: true });
  const ms = modulosUgc(cur);
  assert.deepEqual(ms.map((m) => [m.key, !!m.atenuado, m.aviso ?? null]), [[A, false, null], [B, true, 'Oculto'], [C, false, null]]);
  const cs = clasesUgc(cur);
  assert.deepEqual(cs.filter((u) => u.atenuado).map((u) => u.id), [10, 20, 21]);
  assert.deepEqual(chipsDeClase(cur.clases[0]), [{ tono: 'aviso', texto: 'Oculta' }]);
  assert.deepEqual(chipsDeClase(cur.clases[1]), []);
  assert.equal(portadaUgc(cur).claseId, 11, '«Empezar» lleva a la primera clase que se ve');
});

test('una clase movida: su número es su lugar en el módulo nuevo; la pastilla dice el nombre que se ve', () => {
  const cur = aplicarAjustes(CURSO, [fila('clase', '30', 'modulo', A), fila('modulo', A, 'nombre', 'Bienvenida')]);
  const cs = clasesUgc(cur);
  const enA = cs.filter((u) => u.moduloKey === A);
  assert.deepEqual(enA.map((u) => [u.id, u.vn]), [[10, 1], [11, 2], [30, 3]]);
  assert.equal(enA[0].pastilla, 'Bienvenida');
  assert.equal(cs.find((u) => u.id === 20)!.pastilla, `${B} · 2.1`, 'el módulo y el código del origen');
});

test('minutosDe: la suma de los «m:ss» de las clases', () => {
  assert.equal(minutosDe([{ cardDesc: '2:30 · Formatos' }, { cardDesc: '1:30' }, { cardDesc: 'sin duración' }]), '4 min');
  assert.equal(minutosDe([{ cardDesc: '' }]), undefined);
});

// ── Un solo dibujo ─────────────────────────────────────────────────────────────────
// ROTURA: volver a escribir el DOM del origen en Conocimientos → cae ESTE test.
test('Conocimientos monta el dibujo de los cursos y no tiene su propia copia del DOM', () => {
  const dir = join(RAIZ, 'app/conocimientos');
  const archivos = readdirSync(dir).filter((f) => /\.tsx?$/.test(f));
  assert.ok(!archivos.includes('CursoReplica.tsx'), 'la copia del DOM volvió');
  for (const f of archivos) {
    assert.doesNotMatch(sinComentarios(leer(`app/conocimientos/${f}`)), /className="ugc-shell"/, `${f} dibuja su propio shell del curso`);
  }
  const cono = sinComentarios(leer('app/conocimientos/CursoConocimientos.tsx'));
  assert.match(cono, /<CursoUgc\b/);
  // La salida del curso y la de la marca son la misma: el nivel de arriba (todos los cursos).
  assert.match(cono, /onSalir=\{onSalir\}/);
  assert.match(cono, /marca=\{\{ texto: 'Cono', resaltado: 'cimientos', onClick: onSalir/);
});

// Las dos cosas que Conocimientos le pidió al dibujo (app/_cursos), con una edición puntual cada una.
// ROTURAS: el «+ Nueva clase» sin preguntar por `onNueva` · `claseEstado` sin `is-atenuado`.
test('el dibujo atenúa lo oculto y no ofrece «+ Nueva clase» si la pantalla no sabe crearla', () => {
  const dibujo = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  // Un «+ Nueva clase» que no hace nada se lee como que la app está rota: sin `onNueva`, no se dibuja.
  assert.match(dibujo, /\{editando && !modulo\?\.sinEdicion && edicion!\.onNueva && \(/, '«+ Nueva clase» se dibuja sin quién la cree');
  // La clase de estado del módulo la usan su renglón de la barra y sus dos tarjetas: ahí va.
  const estado = dibujo.split('\n').find((l) => l.startsWith('const claseEstado = ')) ?? '';
  assert.ok(estado.includes("${m.atenuado ? ' is-atenuado' : ''}"), 'el módulo oculto no se atenúa');
  assert.match(dibujo, /className=\{`ugc-modcard\$\{clase\.atenuado \? ' is-atenuado' : ''\}`\}/, 'la clase oculta no se atenúa');
  const css = leer('app/_cursos/estilos.ts');
  assert.match(css, /\.ahdoc\.ahdoc--ugc \.ugc \.ugc-modcard\.is-atenuado \.ugc-modcard-cover > :not\(\.ugc-modcard-aviso\)/, 'falta la regla que atenúa la tarjeta (y deja leer su aviso)');
  // Y Conocimientos no le pasa `onNueva`: sus clases salen de la ficha.
  assert.doesNotMatch(sinComentarios(leer('app/conocimientos/EditorConocimientos.tsx')), /onNueva\b/);
});
