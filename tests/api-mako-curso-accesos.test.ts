// =============================================================================
// Los ACCESOS del curso por la API de MaKo (23/10/2026): darle y sacarle el curso a un alumno
// =============================================================================
// Pedido de Martín (23/10/2026, desde el Ops Center), sobre un chat que no encontraba en la API cómo dar o quitar el
// acceso a un curso: «Revisá esto... Y si hay que hacer una revisión completa de la API, porque creo que faltan muchas
// acciones posibles». Lo necesita la migración de un curso de Panda: no vender sin entregar, y cortarle a quien se da de
// baja. Lo que este test fija:
//   · la decisión de «sacarle un curso» antes de escribir (`decidirQuitarCurso`): se EJECUTA;
//   · que cada operación pase por LA MISMA puerta de la pantalla (lib/), nunca una segunda forma de abrir o cerrar;
//   · abrir exige un cliente ganado de ese producto; cerrar se puede siempre;
//   · nada de lo que vuelve por HTTP trae el email del lead;
//   · sus rutas REST, como los colaboradores de un repo de GitHub.
//
// Probado rompiéndolo (23/10/2026, este archivo, base 7 / 0), cada rotura → 1 fallo y 6 pases:
//   · `decidirQuitarCurso` con el «ya estaba» y el «único» al revés;
//   · `cualquierEtapa: true` en la llamada de dar_acceso_curso a invitarAlCurso;
//   · habilitar_acceso_curso sin la pregunta de Ganado;
//   · `email: r.email` en lo que devuelve dar_acceso_curso;
//   · quitar_curso_del_acceso que exige Ganado (cerrar no lo pide);
//   · borrar la ruta REST del corte.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFS } from '../lib/api-mako/areas/curso.def';
import { decidirQuitarCurso } from '../lib/api-mako/areas/curso.helpers';
import { RUTAS_REST } from '../lib/api-mako/rest';
import { esAccion } from '../lib/api-mako/tipos';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RUN = sinComentarios(leer('lib/api-mako/areas/curso.run.ts'));

/** El cuerpo de un runner: desde su id hasta el id del siguiente (o el final del objeto). */
function runner(id: string): string {
  const ini = RUN.indexOf(`  ${id}: {`);
  assert.ok(ini >= 0, `no encontré el runner ${id}`);
  const fin = RUN.slice(ini + 1).search(/\n {2}[a-z_]+: \{/);
  const cuerpo = fin < 0 ? RUN.slice(ini) : RUN.slice(ini, ini + 1 + fin);
  assert.ok(cuerpo.length > 200 && cuerpo.length < 9000, `el recorte de ${id} mide ${cuerpo.length}: está mirando otra cosa`);
  return cuerpo;
}

const ACCESOS = ['ver_acceso_curso', 'dar_acceso_curso', 'quitar_curso_del_acceso', 'cortar_acceso_curso', 'habilitar_acceso_curso'] as const;

test('sacarle un curso: se saca si le quedan otros; «ya estaba» si no lo ve; «único» si es lo único que le abre', () => {
  // Abre «todos sus productos» (null): se materializa la lista sin ése.
  assert.deepEqual(decidirQuitarCurso(null, [5, 7], 5), { ok: true, productos: [7] });
  // No lo ve: ni está en lo que abre ni es cliente de ese producto.
  assert.deepEqual(decidirQuitarCurso([5, 7], [5, 7], 9), { yaEstaba: true });
  assert.deepEqual(decidirQuitarCurso(null, [], 5), { yaEstaba: true }, 'un lead que ya no es cliente de nada no lo ve');
  // Lo abre pero ya no es cliente de ese producto: no lo ve, así que ya está así.
  assert.deepEqual(decidirQuitarCurso([5], [7], 5), { yaEstaba: true });
  // Es lo único que le abre: eso es cortar el portal.
  assert.deepEqual(decidirQuitarCurso([5], [5, 7], 5), { unico: true });
  assert.deepEqual(decidirQuitarCurso(null, [5], 5), { unico: true });
});

test('las cinco están, cada una con lo que declara: sólo dar le llega a alguien, y dar no se deshace', () => {
  const porId = new Map(DEFS.map((d) => [d.id, d]));
  for (const id of ACCESOS) assert.ok(porId.has(id), `falta ${id}`);
  assert.equal(porId.get('ver_acceso_curso')!.tipo, 'lectura');
  for (const id of ACCESOS.slice(1)) {
    const d = porId.get(id)!;
    assert.ok(esAccion(d), `${id} no es una acción`);
    assert.equal(d.confirmacion, 'chat', id);
    assert.equal(d.aTerceros === true, id === 'dar_acceso_curso', `${id}: aTerceros es sólo de lo que le manda algo al alumno`);
    assert.equal(d.reversible, id !== 'dar_acceso_curso', `${id}: dar manda un correo (no se deshace); sacar, cortar y habilitar sí`);
    assert.notEqual(d.costo, 'dinero', id);
  }
});

test('cada una pasa por la MISMA puerta de la pantalla (lib/), y el área no escribe accesos por su cuenta', () => {
  const dar = runner('dar_acceso_curso');
  assert.match(dar, /await invitarAlCurso\(\{/, 'dar es el núcleo de la ficha, la tarjeta, el CRM e invitar_cliente_curso_cs');
  assert.doesNotMatch(dar, /cualquierEtapa/, 'por la API sólo se invita a un cliente ganado (el portal no le abre a otro)');
  const quitar = runner('quitar_curso_del_acceso');
  assert.match(quitar, /decidirQuitarCurso\(/, 'la regla, en preparar(): falla antes de confirmar');
  assert.match(quitar, /await quitarCursoDelAcceso\(/);
  assert.match(runner('cortar_acceso_curso'), /await revocarAcceso\(leadId\)/);
  assert.match(runner('habilitar_acceso_curso'), /await reactivarAcceso\(leadId\)/);
  assert.doesNotMatch(RUN, /from\('curso_accesos'\)/, 'curso.run.ts escribiría el acceso con una segunda forma');
});

test('abrir exige un cliente GANADO (y de ese producto); cerrar se puede siempre', () => {
  const dar = runner('dar_acceso_curso');
  assert.match(dar, /if \(!lead\.ganado\) return \{ error:/);
  assert.match(dar, /productosDelCliente\(leadId\)\)\.productos\.includes\(productoId\)/, 'cliente de ESE producto: la regla del kanban');
  assert.match(runner('habilitar_acceso_curso'), /if \(!lead\.ganado\) return \{ error:/);
  for (const id of ['quitar_curso_del_acceso', 'cortar_acceso_curso']) {
    assert.doesNotMatch(runner(id), /\.ganado|clienteDelWorkspace/, `${id} exige Ganado: a quien se da de baja (y sale del embudo) no se le podría cortar`);
  }
});

test('lo que vuelve por HTTP no trae el email del lead', () => {
  const dar = runner('dar_acceso_curso');
  assert.doesNotMatch(dar, /\$\{correo\}|\$\{r\.email\}|email: r\.email|email: correo,\s*enviado/, 'dar_acceso_curso devolvería el email del CRM por la puerta de una acción');
  assert.doesNotMatch(runner('ver_acceso_curso'), /email/i, 'ver_acceso_curso lee el estado del acceso, no los datos de la persona');
});

test('sus rutas REST: PUT le da el curso, DELETE se lo saca, y el corte es un recurso del acceso', () => {
  const esperadas: Array<[string, string, string]> = [
    ['GET', '/curso/accesos/{leadId}', 'ver_acceso_curso'],
    ['PUT', '/curso/cursos/{productoId}/accesos/{leadId}', 'dar_acceso_curso'],
    ['DELETE', '/curso/cursos/{productoId}/accesos/{leadId}', 'quitar_curso_del_acceso'],
    ['PUT', '/curso/accesos/{leadId}/corte', 'cortar_acceso_curso'],
    ['DELETE', '/curso/accesos/{leadId}/corte', 'habilitar_acceso_curso'],
  ];
  for (const [m, r, op] of esperadas) {
    assert.ok(RUTAS_REST.some(([m2, r2, op2]) => m2 === m && r2 === r && op2 === op), `falta ${m} ${r} → ${op}`);
  }
});

test('la guía «Migrar un curso con Claude» enseña a darles el curso a los alumnos', () => {
  const guia = leer('app/api-mako/Articulos.tsx');
  const ini = guia.indexOf('function MigrarCurso');
  const cuerpo = guia.slice(ini, guia.indexOf('\n}\n', ini));
  assert.match(cuerpo, /PUT \/api\/v1\/curso\/cursos\/\{productoId\}\/accesos\/\{leadId\}/, 'el mensaje para Claude no nombra cómo dar el acceso');
  assert.match(cuerpo, /\/corte/, 'la guía no dice cómo cortarle el acceso a quien se da de baja');
});
