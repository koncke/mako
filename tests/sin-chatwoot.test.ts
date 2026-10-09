// =============================================================================
// Chatwoot NO EXISTE en MaKo, y no vuelve sin que alguien lo decida.
// =============================================================================
// Martín, 09/10/2026: «Elimina de todos lados la integración con Chatwoot, que no exista
// más. Guardalo en privado, por si en un futuro queremos volver a utilizarla, pero por
// ahora quitalo». Ese día primero se APAGÓ con un interruptor (`CHATWOOT_APAGADO`, commit
// 2375d53a) y después, con «terminalo todo», se BORRÓ el código. Lo que había está entero en
// la etiqueta de git `archivo/chatwoot-2026-10-09` (`git checkout archivo/chatwoot-2026-10-09 -- <rutas>`).
// Volver a traerlo es una decisión de Martín: este test falla hasta que alguien la tome.
//
// Lo que fija:
//   1. lib/chatwoot.ts es un cascarón: ni un import (salvo 'server-only'), ni un `fetch`, ni una
//      credencial, y `chatwootConfigurado()`
//      contesta false. Sigue existiendo SÓLO porque lo importan archivos que tiene a medio cambiar
//      otra rama (wip/api-acciones-0910) y las plantillas de Meta (segunda tanda).
//   2. Quién lo importa, en POSITIVO y en las dos direcciones: un importador nuevo falla, y uno
//      de la lista que dejó de importarlo también (así la lista sólo se achica).
//   3. Quién lo NOMBRA, en positivo y en las dos direcciones: cada archivo de app/, lib/ y
//      scripts/ que dice «Chatwoot» está en PUEDEN_NOMBRARLO con su motivo, y uno que dejó de
//      nombrarlo tiene que salir de la lista. La mayoría es historia (bitácoras, comentarios que
//      cuentan qué se borró); lo que no es historia está marcado como pendiente.
//   4. Que no vuelvan ni las rutas, ni la integración en los catálogos (tampoco en la API de MaKo:
//      `ver_activacion_tab`), ni una credencial.
//   5. Los textos que se ven (lo que fijaba la versión del interruptor).
//
// PROBADO ROMPIÉNDOLO (09/10/2026), una rotura por vez y restaurando de memoria, sobre 9 tests:
//   · un `fetch(` en lib/chatwoot.ts ........................................ 1 fallo / 8 pases
//   · `chatwootConfigurado()` devolviendo true .............................. 1 fallo / 8 pases
//   · lib/notify.ts volviendo a importar de lib/chatwoot ..................... 1 fallo / 8 pases
//     (sólo el de importadores: notify ya está en PUEDEN_NOMBRARLO por su comentario)
//   · lib/meta-templates.ts dejando de importarlo (lista vieja) ............ 1 fallo / 8 pases
//   · un comentario «Chatwoot» en lib/evolution-envio.ts (no está en la lista) 1 fallo / 8 pases
//   · `CHATWOOT_API_TOKEN` de vuelta en lib/metodo-catalogo.ts ............. 2 fallos / 7 pases
//     (la credencial y el registro)
//   · el texto «si tienes Chatwoot conectado» en TelefonosPanel ............. 1 fallo / 8 pases
//   · app/api/webhooks/chatwoot/route.ts recreado ........................... 1 fallo / 8 pases
// Con todo en su lugar: 9 pases, 0 fallos.
//
// REVISIÓN (09/10/2026, mismo día): el regex de importadores sólo aceptaba UN `../`, así que
// `import { chatwootConfigurado } from '../../chatwoot'` en lib/api-mako/areas/equipo.def.ts daba
// 9 pases / 0 fallos (medido). Y el cascarón sólo miraba `fetch(` y `CHATWOOT_`: un `credWs`
// importado de lib/credenciales pasaba. Se amplió el regex, el cascarón tiene que importar sólo
// 'server-only', y entró el test de la activación de tabs de la API. Roturas sobre 10 tests, una
// por vez y restaurando de memoria:
//   · `from '../../chatwoot'` en lib/api-mako/areas/equipo.def.ts .......... 1 fallo / 9 pases
//   · `from '../../lib/chatwoot'` en app/whatsapp/page.tsx ................. 1 fallo / 9 pases
//   · lib/chatwoot.ts importando `credWs` de ./credenciales ................ 1 fallo / 9 pases
//   · lib/chatwoot.ts con un `await import('./credenciales')` .............. 1 fallo / 9 pases
//   · integraciones.def.ts volviendo a la lista a mano con 'whatsapp' ...... 1 fallo / 9 pases
//   · integraciones.run.ts volviendo a la lista a mano ..................... 1 fallo / 9 pases
// Con todo en su lugar: 10 pases, 0 fallos.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { TABS_ACTIVACION } from '../lib/tab-activacion';
import { DEFS as DEFS_INTEGRACIONES } from '../lib/api-mako/areas/integraciones.def';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (ver AGENTS.md).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Lo que se barre: el código de la app (git ls-files, o sea lo que está en el índice). */
const ARCHIVOS = execFileSync('git', ['ls-files', 'app', 'lib', 'scripts', 'proxy.ts', 'next.config.ts', 'instrumentation.ts'], { cwd: RAIZ, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((f) => /\.(ts|tsx|mjs|cjs|js|sh|json)$/.test(f) && existsSync(join(RAIZ, f)));

/** Quién puede importar lib/chatwoot.ts todavía, y por qué. Se ACHICA: no se le agrega a nadie. */
const IMPORTADORES: Record<string, string> = {
  'app/crm/actions.ts': 'rama wip/api-acciones-0910 (ensureContactoWhatsapp)',
  'lib/api-mako/areas/whatsapp.helpers.ts': 'rama wip/api-acciones-0910 (la bandeja oficial del registro)',
  'lib/api-mako/areas/whatsapp.run.ts': 'rama wip/api-acciones-0910 (las operaciones del oficial)',
  'lib/nutricion.ts': 'rama wip/api-acciones-0910 (el paso por el oficial, sendWhatsappTemplate)',
  'lib/meta-templates.ts': 'plantillas de Meta: leen la cuenta de WhatsApp Business del inbox (segunda tanda)',
};

const HISTORIA = 'historia: cuenta lo que pasó, no es código vivo';
const SE_FUE = 'comentario que cuenta que Chatwoot se borró, y por qué el código quedó así';
const PROTEGIDO = 'rama wip/api-acciones-0910 a medio terminar: no se toca hasta que se integre';
const PLANTILLAS = 'plantillas de Meta / reporte por WhatsApp: segunda tanda';

/** Quién puede NOMBRAR Chatwoot todavía. Se ACHICA. */
const PUEDEN_NOMBRARLO: Record<string, string> = {
  // El cascarón.
  'lib/chatwoot.ts': 'el cascarón: firmas apagadas para los importadores de arriba',
  // Los que no se tocan.
  'app/crm/actions.ts': PROTEGIDO,
  'lib/api-mako/areas/chatbot.def.ts': PROTEGIDO,
  'lib/api-mako/areas/crm.def.ts': PROTEGIDO,
  'lib/api-mako/areas/whatsapp.def.ts': PROTEGIDO,
  'lib/api-mako/areas/whatsapp.helpers.ts': PROTEGIDO,
  'lib/api-mako/areas/whatsapp.run.ts': PROTEGIDO,
  'lib/api-mako/tipos.ts': PROTEGIDO,
  'lib/evolution-mensajes.ts': PROTEGIDO,
  'lib/mako-intencion.ts': PROTEGIDO,
  'lib/nutricion.ts': PROTEGIDO,
  // Pendientes de la segunda tanda.
  'lib/meta-templates.ts': PLANTILLAS,
  'lib/api-mako/areas/equipo.def.ts': PLANTILLAS,
  'lib/api-mako/rest.ts': 'la ruta REST de crear_contacto_chatwoot_lead, que declara whatsapp.def.ts (protegido)',
  'app/vsl/_detalle/features.ts': 'copy pública de /vsl/<slug>: las secciones del inbox oficial y del reporte por WhatsApp se reescriben aparte',
  'lib/flujos-tipos.ts': "el evento 'lead.wa_entrante' quedó sin emisor (lo emitía el webhook borrado)",
  // Historia.
  'app/admin/dev/_historial.generado.ts': HISTORIA,
  'app/admin/dev/areas.ts': HISTORIA,
  'app/admin/dev/chatbot/bitacora.ts': HISTORIA,
  'app/admin/dev/crm/auditoria.ts': HISTORIA,
  'app/admin/dev/instagram/bitacora.ts': HISTORIA,
  'app/admin/dev/integraciones/bitacora.ts': HISTORIA,
  'app/admin/dev/local-dev-environment/bitacora.ts': HISTORIA,
  'app/admin/dev/onboarding/bitacora.ts': HISTORIA,
  'app/admin/dev/pricing/modelo.ts': HISTORIA,
  'app/admin/dev/vsl-tracking/bitacora.ts': HISTORIA,
  'app/admin/dev/webhook-gateway/bitacora.ts': HISTORIA,
  'app/admin/docs/catalogo.ts': HISTORIA,
  'app/admin/runway/datos.ts': HISTORIA,
  'app/plan/PlanBoard.tsx': 'el plan semilla (datos de septiembre)',
  'app/conocimientos/curso.ts': 'el material de un curso ajeno',
  'app/conocimientos/curso-dominia-academy-skool.ts': 'el material de un curso ajeno',
  'scripts/proponer-seguridad-legal.ts': HISTORIA,
  'lib/avisos.ts': HISTORIA,
  'lib/calendly-error.ts': 'reconoce el formato de error que tenía lib/chatwoot.ts (puede seguir en los logs)',
  'lib/clonar-config.ts': HISTORIA,
  'lib/datos-mau.ts': 'la columna crm_etiquetas.chatwoot_label sigue en la base y no se copia',
  'lib/flujos.ts': HISTORIA,
  'lib/google-calendar.ts': HISTORIA,
  'lib/leads.ts': HISTORIA,
  'lib/setter-conversacion.ts': HISTORIA,
  'lib/webhook-fallo-ruteo.ts': 'lo que se midió de cada proveedor (Chatwoot incluido) el 07/10/2026',
  // Lo que se borró y lo cuenta donde se borró.
  'app/_components/NotificationsProvider.tsx': SE_FUE,
  'app/api/agente/consultar/route.ts': SE_FUE,
  'app/api/cron/avisos-resumen/route.ts': SE_FUE,
  'app/api/cron/reporte-diario/route.ts': SE_FUE,
  'app/api/cron/reporte-horario/route.ts': SE_FUE,
  'app/api/cron/reporte-semanal/route.ts': SE_FUE,
  'app/api/mako/nutricion/route.ts': SE_FUE,
  'app/api/onboarding/route.ts': SE_FUE,
  'app/api/webhooks/calendly/route.ts': SE_FUE,
  'app/api/webhooks/meta-leads/route.ts': SE_FUE,
  'app/api/whatsapp/advisor/route.ts': SE_FUE,
  'app/api/whatsapp/envio/route.ts': SE_FUE,
  'app/configuraciones/TelefonosPanel.tsx': SE_FUE,
  'app/configuraciones/telefonos-actions.ts': SE_FUE,
  'app/whatsapp/WhatsAppApp.tsx': SE_FUE,
  'app/whatsapp/_shared/PanelBorradores.tsx': SE_FUE,
  'app/whatsapp/_shared/VoiceRecorder.tsx': SE_FUE,
  'app/whatsapp/audio.ts': SE_FUE,
  'app/whatsapp/page.tsx': SE_FUE,
  'lib/borrador-camino.ts': SE_FUE,
  'lib/crm-auto.ts': SE_FUE,
  'lib/etiquetas-motor.ts': SE_FUE,
  'lib/etiquetas.ts': SE_FUE,
  'lib/evolution.ts': SE_FUE,
  'lib/integraciones-catalogo.ts': SE_FUE,
  'lib/integraciones.ts': SE_FUE,
  'lib/lead-insights.ts': SE_FUE,
  'lib/mako-tools.ts': SE_FUE,
  'lib/metodo-catalogo.ts': SE_FUE,
  'lib/notify.ts': SE_FUE,
  'lib/plan-senales.ts': SE_FUE,
  'lib/reporte-template.ts': SE_FUE,
  'lib/servicio-slides.ts': SE_FUE,
  'lib/tab-activacion.ts': SE_FUE,
  'lib/webhook-ruteo-huella.ts': SE_FUE,
  'next.config.ts': SE_FUE,
};

test('lib/chatwoot.ts es un cascarón: ni un pedido, ni una credencial, y nadie lo tiene configurado', () => {
  const src = sinComentarios(leer('lib/chatwoot.ts'));
  // Lo único que importa es 'server-only'. Buscar `fetch(` no alcanza: un helper importado de
  // otro módulo (o un `credWs` traído de lib/credenciales) devuelve el pedido sin que la palabra
  // aparezca acá. Un cascarón no necesita importar nada más.
  const imports = (src.match(/^\s*import\b[^;]*;/gm) ?? []).map((s) => s.trim());
  assert.deepEqual(imports, ["import 'server-only';"], 'el cascarón volvió a importar algo: un pedido o una credencial pueden entrar por ahí');
  assert.doesNotMatch(src, /\bfrom\s*['"]|\brequire\s*\(|\bimport\s*\(/, 'el cascarón trae código de otro módulo (re-export o import dinámico)');
  assert.doesNotMatch(src, /\bfetch\(/, 'volvió un pedido a Chatwoot');
  assert.doesNotMatch(src, /\bcredWs|process\.env|CHATWOOT_[A-Z]/, 'volvió a leer una credencial de Chatwoot');
  assert.match(src, /export async function chatwootConfigurado\(\): Promise<boolean> \{\s*return false;\s*\}/, 'chatwootConfigurado ya no contesta false: alguien lo prendió');
});

test('quién importa lib/chatwoot.ts: sólo la lista, y la lista sólo se achica', () => {
  // Cualquier forma de nombrar el módulo: el alias, `./`, y CUALQUIER profundidad relativa
  // (`../../chatwoot` desde lib/api-mako/areas/, `../../lib/chatwoot` desde app/), con o sin
  // `.ts`, por `from`, `import()` o `require()`. La versión anterior sólo aceptaba UN `../`:
  // un `import … from '../../chatwoot'` en un archivo de lib/api-mako/areas/ pasaba en verde.
  const importa = (f: string) => /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"](?:@\/lib\/|(?:\.{1,2}\/)+(?:lib\/)?)chatwoot(?:\.ts)?['"]/.test(sinComentarios(leer(f)));
  const reales = ARCHIVOS.filter((f) => f !== 'lib/chatwoot.ts' && importa(f));
  const nuevos = reales.filter((f) => !(f in IMPORTADORES));
  assert.deepEqual(nuevos, [], 'lo importa alguien nuevo: Chatwoot se borró (decisión de Martín, 09/10/2026)');
  const viejos = Object.keys(IMPORTADORES).filter((f) => !reales.includes(f));
  assert.deepEqual(viejos, [], 'ya no lo importa: sacalo de IMPORTADORES (y si es el último, borrá lib/chatwoot.ts)');
});

test('quién nombra Chatwoot en app/, lib/ y scripts/: sólo la lista, y la lista sólo se achica', () => {
  const nombran = ARCHIVOS.filter((f) => /chatwoot/i.test(leer(f)));
  const nuevos = nombran.filter((f) => !(f in PUEDEN_NOMBRARLO));
  assert.deepEqual(nuevos, [], 'estos archivos nombran Chatwoot y no están en PUEDEN_NOMBRARLO: si es código, no va; si es historia, va con su motivo');
  const viejos = Object.keys(PUEDEN_NOMBRARLO).filter((f) => !nombran.includes(f));
  assert.deepEqual(viejos, [], 'ya no lo nombran: sacalos de PUEDEN_NOMBRARLO');
});

test('ninguna credencial de Chatwoot vive en el código', () => {
  const con = ARCHIVOS
    .filter((f) => !f.startsWith('app/admin/dev/'))   // las bitácoras cuentan la historia
    .filter((f) => /CHATWOOT_[A-Z]/.test(sinComentarios(leer(f))));
  assert.deepEqual(con, [], 'volvió una credencial de Chatwoot');
});

test('la integración no está en los registros (tarjeta, campos, ping, ruteo)', () => {
  for (const f of ['lib/integraciones-catalogo.ts', 'lib/metodo-catalogo.ts', 'lib/metodo-verificar.ts', 'lib/webhook-routing.ts', 'lib/webhook-ruteo-huella.ts', 'lib/tab-activacion.ts']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /chatwoot/i, `${f} volvió a registrar Chatwoot`);
  }
  assert.ok(!existsSync(join(RAIZ, 'lib/chatwoot-canales.ts')), 'volvió lib/chatwoot-canales.ts');
});

test('la API de MaKo ofrece la activación sólo de las tabs que la tienen (la de WhatsApp se fue)', () => {
  // La entrada `whatsapp` de lib/tab-activacion.ts pedía las credenciales de Chatwoot y se fue con
  // él. La API la seguía ofreciendo en `ver_activacion_tab` (una lista copiada a mano en la def y
  // otra en el runner): MaKo, ante «¿por qué mi WhatsApp está vacío?», llamaba con una key que el
  // runner contestaba «no tiene activación declarada». Ahora la def y el runner DERIVAN la lista.
  const def = DEFS_INTEGRACIONES.find((d) => d.id === 'ver_activacion_tab');
  assert.ok(def, 'no encontré ver_activacion_tab en el área integraciones');
  const enumKey = def.parametros.find((p) => p.nombre === 'key')?.enum ?? [];
  assert.deepEqual([...enumKey].sort(), Object.keys(TABS_ACTIVACION).sort(), 'el enum de ver_activacion_tab no es el catálogo de tabs con activación');
  assert.ok(!enumKey.includes('whatsapp'), 'la API volvió a ofrecer la activación de WhatsApp');
  const run = sinComentarios(leer('lib/api-mako/areas/integraciones.run.ts'));
  assert.match(run, /no tiene activación declarada\.`, Object\.keys\(TABS_ACTIVACION\)\)/, 'el runner volvió a copiar a mano la lista de tabs');
});

test('no vuelve ninguna ruta del canal oficial', () => {
  for (const r of [
    'app/api/webhooks/chatwoot/route.ts', 'app/api/whatsapp/chatwoot/route.ts',
    'app/api/whatsapp/conversations/route.ts', 'app/api/whatsapp/thread/route.ts',
    'app/api/whatsapp/file/route.ts', 'app/api/whatsapp/lead/[id]/route.ts',
    'app/api/whatsapp/contacts/[id]/messages/route.ts', 'app/whatsapp/ChatwootWebhookChip.tsx',
  ]) {
    assert.ok(!existsSync(join(RAIZ, r)), `volvió ${r}`);
  }
});

test('la bandeja de /whatsapp es una sola: la del número de empresa', () => {
  const app = sinComentarios(leer('app/whatsapp/WhatsAppApp.tsx'));
  assert.doesNotMatch(app, /mostrarOficial|canal === 'oficial'|\/api\/whatsapp\/(?:conversations|thread|contacts)/, 'volvió la bandeja oficial');
  assert.doesNotMatch(sinComentarios(leer('app/_components/NotificationsProvider.tsx')), /\/api\/whatsapp\/conversations/, 'volvió el sondeo de la bandeja oficial');
});

test('los textos que se ven ya no mandan a conectar Chatwoot', () => {
  assert.doesNotMatch(leer('app/configuraciones/TelefonosPanel.tsx'), /si tienes Chatwoot conectado/);
  assert.doesNotMatch(leer('app/experimentos/RetroReport.tsx'), /Chatwoot todavía sin conectar/);
  assert.doesNotMatch(sinComentarios(leer('app/privacidad/page.tsx')), /Chatwoot/, 'la política de privacidad sigue nombrando a Chatwoot como proveedor');
});

test('el número nuevo de un teléfono del workspace no nace como Chatwoot', () => {
  const panel = sinComentarios(leer('app/configuraciones/TelefonosPanel.tsx'));
  assert.match(panel, /const nuevo = \(\) => setDraft\(\{ numero: '', etiqueta: '', fuente: 'personal', setters: \[\] \}\);/);
});
