// =============================================================================
// Settings por la API de MaKo (25/10/2026)
// =============================================================================
// Martín, 25/10: «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API». Lo que Settings deja
// ver o cambiar y no tenía operación se declaró en el área equipo (lib/api-mako/areas/equipo.*). Lo que se fija acá:
//   · la forma: lo de la PERSONA sólo con sesión (SOLO_APP, como ver_perfil), lo del negocio sólo para quien lo administra,
//     y toda escritura con confirmación (nunca directa);
//   · que cada una escriba con la MISMA función que su pantalla (una segunda implementación se separa sola);
//   · que la seguridad se LEA y no se cambie: una llave de la API no puede tocar cómo se entra a MaKo.
//
// Correr: node --import tsx --test tests/api-mako-settings.test.ts
// Probado ROMPIÉNDOLO (25/10/2026): los números, en ROTURAS al final.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const DE_LA_PERSONA = ['ver_avisos_celular', 'ver_mi_seguridad', 'editar_mi_perfil', 'configurar_aviso_celular', 'fijar_no_molestar', 'configurar_notificaciones_inapp'];
// El criterio de reuniones salió el 26/10/2026 con «General» (pantalla y API; quien lo tenía lo sigue usando con su valor).
const DEL_NEGOCIO = ['ver_horario_envio', 'renombrar_negocio', 'configurar_horario_envio'];
const RETIRADAS = ['ver_criterio_reuniones', 'guardar_criterio_reuniones'];

/** El cuerpo de un runner: desde su nombre hasta el siguiente runner del objeto. */
function runner(src: string, id: string): string {
  const i = src.indexOf(`\n  ${id}: {`);
  assert.ok(i > 0, `falta el runner de ${id}`);
  const j = src.slice(i + 1).search(/\n {2}[a-z_0-9]+: \{/);
  return src.slice(i, j < 0 ? undefined : i + 1 + j);
}

test('lo de la persona, sólo con su sesión; lo del negocio, sólo para quien lo administra', () => {
  for (const id of DE_LA_PERSONA) {
    const d = porId(id);
    assert.ok(d, `${id} no está en el registro`);
    assert.deepEqual([...d.canales], ['app'], `${id}: es de la persona logueada, no sale por WhatsApp ni por HTTP`);
  }
  for (const id of DEL_NEGOCIO) {
    const d = porId(id);
    assert.ok(d, `${id} no está en el registro`);
    assert.equal(d.gating?.rolMinimo, 'admin', `${id}: la pantalla es de quien administra el negocio`);
  }
});

test('toda escritura se confirma, y lo que no tiene vuelta lo dice', () => {
  for (const id of [...DE_LA_PERSONA, ...DEL_NEGOCIO]) {
    const d = porId(id)!;
    if (!esAccion(d)) { assert.equal(d.tipo, 'lectura'); continue; }
    assert.ok(d.confirmacion === 'chat' || d.confirmacion === 'pantalla', `${id}: escribe sin confirmación`);
    assert.ok(d.escribe, `${id}: no dice qué escribe`);
  }
  // Las del criterio ya no están: ni en el registro ni en la REST.
  for (const id of RETIRADAS) assert.equal(porId(id), undefined, `${id} volvió al registro`);
  assert.doesNotMatch(leer('lib/api-mako/rest.ts'), /criterio_reuniones|criterio-reuniones/, 'una ruta REST del criterio volvió');
});

test('cada una escribe con la MISMA función que su pantalla', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/equipo.run.ts'));
  const usa: Record<string, RegExp[]> = {
    editar_mi_perfil: [/await setPerfil\(limpio\)/, /zonaCanonica\(tzCruda\)/],
    renombrar_negocio: [/limpiarNombreNegocio\(/, /await actualizarWorkspace\(ctx\.ws, \{ nombre: r\.nombre \}\)/],
    configurar_aviso_celular: [/await setNotifPush\(/],
    fijar_no_molestar: [/await setNotifPush\(\{ \.\.\.p, silencio: s \}\)/, /normalizarSilencio\(/],
    configurar_notificaciones_inapp: [/await setNotifInApp\(siguiente\)/],
    configurar_horario_envio: [/horarioParaGuardar\(/, /await setSetting\(KEY_HORARIO_ENVIO, r\.valor\)/],
  };
  for (const [id, res] of Object.entries(usa)) {
    const cuerpo = runner(run, id);
    for (const re of res) assert.match(cuerpo, re, `${id}: no usa lo mismo que su pantalla (${re})`);
  }
  // Los avisos al celular que se ofrecen son los de la pantalla: los de admin, sólo a admin.
  assert.match(run, /const tiposPushDe = \(rol: RolPush\) => PUSH_TIPOS\.filter\(\(t\) => rol === 'admin' \|\| !PUSH_SOLO_ADMINS\.has\(t\.id\)\);/);
});

test('la seguridad se LEE por la API y no se cambia', () => {
  const d = porId('ver_mi_seguridad')!;
  assert.equal(d.tipo, 'lectura');
  const cuerpo = runner(sinComentarios(leer('lib/api-mako/areas/equipo.run.ts')), 'ver_mi_seguridad');
  assert.doesNotMatch(cuerpo, /guardar|quitar|revocar|activar|generar|setear|update|insert|delete/i, 'la lectura de la seguridad escribe algo');
  // Ninguna operación de la API toca los factores de la PERSONA (los de la plataforma, exigir el 2FA a un negocio, son otra cosa).
  const defs = sinComentarios(leer('lib/api-mako/areas/equipo.def.ts'));
  assert.doesNotMatch(defs, /id: '[a-z_]*(totp|passkey|contrasena|codigos_recuperacion|dispositivo)[a-z_]*', area: 'equipo', tipo: 'accion'/);
});

test('los días del horario se dicen por su nombre y el enum es el mismo de la API', () => {
  const d = porId('configurar_horario_envio')!;
  const dias = d.parametros.find((p) => p.nombre === 'dias');
  assert.deepEqual(dias?.enum, ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']);
  const run = leer('lib/api-mako/areas/equipo.run.ts');
  assert.match(run, /const DIA_DE_NOMBRE: Record<string, DiaSemana> = \{ domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 \};/);
});

// ROTURAS (25/10/2026), una por vez y restaurando de memoria (base 5/0); cada una dio 4/1:
//   · editar_mi_perfil con canales ['app', 'whatsapp']
//   · configurar_horario_envio sin `gating: ADMIN`
//   · fijar_no_molestar escribiendo con setNotifInApp en vez de setNotifPush
//   · ver_mi_seguridad llamando a una escritura (`guardarContrasena`)
//   · tiposPushDe ofreciendo los de admin a cualquiera
