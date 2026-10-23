// =============================================================================
// «Invitar al curso al ganar» por la API de MaKo (23/10/2026, P0-4 de la auditoría de la API)
// =============================================================================
// Pedido de Martín (23/10/2026, desde el Ops Center): «Revisá esto... Y si hay que hacer una revisión completa de la
// API, porque creo que faltan muchas acciones posibles». La auditoría puso ésta en P0: cierra el par venta → acceso
// («no vender sin entregar») y hasta hoy sólo se prendía desde el «⋯» de la columna Ganado. Lo que este test fija:
//   · las dos operaciones usan LAS MISMAS funciones del interruptor de la pantalla (lib/crm-curso-al-ganar.ts);
//   · «¿tiene curso?» es UNA regla para el tablero y la API (`tieneCurso`);
//   · la API lee el interruptor ESTRICTO: con la base caída, «apagado» sería una afirmación falsa;
//   · prender exige un curso con clases, y se vuelve a mirar al confirmar; apagar no exige nada;
//   · su ruta REST.
//
// Probado rompiéndolo (23/10/2026, este archivo, base 6 / 0), cada rotura → 1 fallo y 5 pases:
//   · la lectura estricta con `embudosQueInvitan()` (la tolerante) en vez de `getSettingEstricto`;
//   · `estadoCursoAlGanar` con su propia regla del curso en vez de `tieneCurso`;
//   · preparar sin la pregunta del curso al prender;
//   · ejecutar sin volver a mirar el curso;
//   · cambiar_curso_al_ganar sin `rolMinimo: 'admin'` (TAB en vez de TAB_ADMIN);
//   · borrar la ruta PUT.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFS } from '../lib/api-mako/areas/crm.def';
import { RUTAS_REST } from '../lib/api-mako/rest';
import { esAccion } from '../lib/api-mako/tipos';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de una función o runner: desde su comienzo hasta el comienzo del siguiente. */
function bloque(src: string, desde: string, hasta: RegExp): string {
  const ini = src.indexOf(desde);
  assert.ok(ini >= 0, `no encontré ${desde}`);
  const fin = src.slice(ini + desde.length).search(hasta);
  const cuerpo = fin < 0 ? src.slice(ini) : src.slice(ini, ini + desde.length + fin);
  assert.ok(cuerpo.length > 80 && cuerpo.length < 6000, `el recorte de ${desde} mide ${cuerpo.length}: está mirando otra cosa`);
  return cuerpo;
}

const LIB = sinComentarios(leer('lib/crm-curso-al-ganar.ts'));
const RUN = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));

test('las dos están declaradas: la lectura para cualquiera de la tab; cambiarla, sólo el admin y con «sí» fuerte', () => {
  const ver = DEFS.find((d) => d.id === 'ver_curso_al_ganar');
  const cambiar = DEFS.find((d) => d.id === 'cambiar_curso_al_ganar');
  assert.ok(ver && cambiar, 'faltan las operaciones');
  assert.equal(ver.tipo, 'lectura');
  assert.ok(esAccion(cambiar));
  assert.equal(cambiar.confirmacion, 'chat');
  assert.equal(cambiar.reversible, true);
  assert.equal(cambiar.aTerceros, true, 'prendida, a cada cliente nuevo le llega un email: por WhatsApp se confirma con un «sí»');
  assert.equal(cambiar.gating?.rolMinimo, 'admin', 'como el interruptor de la pantalla: sólo el admin');
});

test('«¿tiene curso?» es UNA regla para el tablero y la API, y la API lee el interruptor ESTRICTO', () => {
  const tolerante = bloque(LIB, 'export async function estadoCursoAlGanar(', /\nexport async function /);
  const estricta = bloque(LIB, 'export async function estadoCursoAlGanarEstricto(', /\nexport async function /);
  assert.match(tolerante, /tieneCurso\(real\)/, 'el tablero pregunta por el curso con la regla compartida');
  assert.match(estricta, /tieneCurso\(funnelId\)/, 'la API pregunta con la MISMA regla');
  assert.doesNotMatch(tolerante, /clasesDelProducto/, 'una segunda regla del curso adentro del tablero');
  assert.match(estricta, /getSettingEstricto\(CURSO_AL_GANAR_KEY\)/, 'el interruptor, leído estricto');
  assert.doesNotMatch(estricta, /embudosQueInvitan\(/, 'la lectura tolerante convierte una base caída en «apagado»');
});

test('los runners usan las funciones de la pantalla; prender exige curso al proponer Y al confirmar', () => {
  const cambiar = bloque(RUN, '  cambiar_curso_al_ganar: {', /\n {2}[a-z_]+: \{/);
  assert.match(bloque(RUN, '  ver_curso_al_ganar: {', /\n {2}[a-z_]+: \{/), /estadoCursoAlGanarEstricto\(p\.embudoId\)/);
  assert.match(cambiar, /if \(prendido && !e\.curso\) return \{ error:/, 'prender sin curso se frena en preparar()');
  assert.match(cambiar, /if \(prendido && !\(await estadoCursoAlGanarEstricto\(embudoId\)\)\.curso\) return \{ ok: false/, 'y se vuelve a mirar al confirmar');
  assert.match(cambiar, /await cambiarCursoAlGanar\(embudoId, prendido\)/, 'escribe con la función del interruptor');
  assert.match(cambiar, /yaEstaba: true/, '«ya estaba así» es un 200 sin cambios, no un 422');
  assert.doesNotMatch(RUN, /setSetting\(CURSO_AL_GANAR_KEY/, 'el área escribiría el interruptor por su cuenta');
});

test('su ruta REST: el interruptor es un recurso del CRM, como el estado del CRM automático', () => {
  for (const [m, r, op] of [['GET', '/crm/curso-al-ganar', 'ver_curso_al_ganar'], ['PUT', '/crm/curso-al-ganar', 'cambiar_curso_al_ganar']] as const) {
    assert.ok(RUTAS_REST.some(([m2, r2, op2]) => m2 === m && r2 === r && op2 === op), `falta ${m} ${r} → ${op}`);
  }
});

test('el CRM se busca entre los DEL negocio, y por su id real', () => {
  const cambiar = bloque(RUN, '  cambiar_curso_al_ganar: {', /\n {2}[a-z_]+: \{/);
  assert.match(cambiar, /await productosCrm\(\)/, 'un embudoId de otro negocio no puede llegar al interruptor');
  assert.match(cambiar, /payload: \{ embudoId: crm\.embudoId,/, 'el id real: es lo que guarda el interruptor');
});

test('la pantalla sigue igual: su acción usa la lectura tolerante', () => {
  const accion = sinComentarios(leer('app/crm/curso-al-ganar-actions.ts'));
  assert.match(accion, /estadoCursoAlGanar\(real\)/);
  assert.doesNotMatch(accion, /Estricto/);
});
