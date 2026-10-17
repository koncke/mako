// =============================================================================
// «Tu contraseña cambió»: sale cada vez que se crea, se cambia o se restablece (17/10/2026)
// =============================================================================
// Los circuitos 1, 3 y 4 de docs/diseno-login-contrasena.md lo prometían y no existía: quien le
// cambiaba la contraseña a otro (con una sesión robada, o con el link de un correo tomado) lo hacía
// sin que el dueño de la cuenta se enterara. Ahora Seguridad emite `contrasena_cambiada` en el ws de
// la plataforma (lib/contrasena-cambio-aviso.ts) y el mail lo manda la automatización de SuperAdmin
// «Tu Contraseña Cambió» (nada por detrás).
//
// Probado rompiéndolo (17/10/2026), sobre los 3 de este archivo (base 3 / 0): sacando el aviso de
// /api/perfil/seguridad → 2 / 1; emitiendo en `getWorkspaceActual()` en vez de `wsSuperAdmin()` →
// 2 / 1; con la plantilla citando `{{link_restablecer}}` → 2 / 1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLANTILLAS, PLANTILLAS_PLATAFORMA } from '../lib/plantillas-automatizaciones';
import { EVENTOS_MAKO } from '../lib/disparadores';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

test('las tres puertas que guardan una contraseña avisan DESPUÉS de guardarla', () => {
  for (const f of ['app/api/auth/restablecer/route.ts', 'app/api/perfil/seguridad/route.ts', 'app/api/auth/2fa/route.ts']) {
    const src = leer(f);
    const guarda = src.indexOf('await guardarContrasena(');
    const avisa = src.indexOf('avisarContrasenaCambiada(', guarda);
    assert.ok(guarda > 0, `${f}: no encontré dónde guarda`);
    assert.ok(avisa > guarda, `${f}: guarda la contraseña y no avisa (o avisa antes de guardar)`);
    assert.match(src.slice(guarda, avisa + 80), /after\(\(\) => avisarContrasenaCambiada\(uid\)/, `${f}: el aviso va en un after(), fuera de la respuesta`);
  }
});

test('el emisor sale de la PLATAFORMA, por el catálogo, con la persona y sin secretos', () => {
  const src = leer('lib/contrasena-cambio-aviso.ts');
  assert.match(src, /emitirDelCatalogo\('seguridad-contrasena-cambiada', \{\n\s*ws: await wsSuperAdmin\(\),\n\s*datos: \{ usuario_id: String\(usuarioId\) \},/);
  const ev = EVENTOS_MAKO.find((e) => e.subtipo === 'contrasena_cambiada');
  assert.ok(ev, 'falta el evento en EVENTOS_MAKO');
  assert.equal(ev.aviso, 'seguridad-contrasena-cambiada');
  assert.equal(ev.persona, 'aviso', 'va al correo de la CUENTA (lib/destino-usuario.ts)');
});

test('la plantilla es SÓLO de SuperAdmin, un email a la persona y sin datos secretos', () => {
  const p = PLANTILLAS_PLATAFORMA.find((x) => x.id === 'seguridad-contrasena-cambiada');
  assert.ok(p, 'falta la plantilla «Tu Contraseña Cambió»');
  assert.ok(!PLANTILLAS.some((x) => x.id === p.id), 'la de SuperAdmin se metió en la galería de los negocios');
  assert.equal(p.soloPlataforma, true);
  assert.equal(p.cron?.evento, 'contrasena_cambiada');
  const texto = JSON.stringify(p.pasos);
  assert.doesNotMatch(texto, /\{\{link_restablecer\}\}/, 'el aviso de cambio no lleva el link');
  assert.match(texto, /Si no fuiste tú/);
});
