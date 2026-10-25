// =============================================================================
// Las herramientas del super admin en el teléfono: MaKo Messages, AI Models, MaKo Context, Billing y Client Agents
// =============================================================================
// 17/10/2026, «Mobile 2» (Martín: «Implementa completamente MaKo Mobile en todas las tabs»). Las tres son de la
// plataforma (nav.ts → HERRAMIENTAS). Lo que fija este archivo es lo invisible:
//   · la MISMA URL que la computadora, ida y vuelta (`UNA_A_UNA` sirve a los dos sentidos);
//   · la MISMA puerta: `getSesionAdmin()` antes de leer nada, como la página de escritorio;
//   · las MISMAS rutas de datos, y las opciones de AI Models en UNA copia que comparten las dos pantallas;
//   · MaKo Messages se alcanza como en escritorio, por la barra de secciones de Automations, y sólo el super admin la ve;
//   · refrescar vuelve a leer.
//
// Verificado ROMPIÉNDOLO (17/10/2026, scratchpad/mobile2/romper_m2.py, de a una; base 6 / 0). «Sin `leido`» cae en el 3:
//   · `UNA_A_UNA` sin '/contexto'                                       → 4 / 2 (la ida y vuelta, y la fila de More)
//   · /m/modelos-ia sin `getSesionAdmin()`                              → 5 / 1 (la puerta)
//   · ModelosIA.tsx con su propia copia de CHAT_OPTS                    → 5 / 1 (una sola copia)
//   · la barra de secciones sin `seccionesVisibles` (cualquiera ve MaKo Messages) → 5 / 1
//   · /m/mensajes sin `key` nuevo en cada pasada del server             → 6 / 1 (con los siete de hoy)
// Y Billing y Client Agents (la tanda siguiente; base 7 / 0):
//   · CobrosM importando `reembolsarCobroMakoAction`                    → 6 / 1 (lo que mueve plata, en la computadora)
//   · `UNA_A_UNA` sin '/admin/agente'                                   → 6 / 1 (la ida y vuelta)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECCIONES_MAS, masCompleto, rutaEscritorio, rutaInterna, rutaMovil } from '../lib/movil-rutas';
import { seccionesDeTabM } from '../app/m/_ui/SeccionesTabM';
import { cabeceraPorRuta } from '../app/m/_ui/cabecera';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const TRES = [
  { escritorio: '/mensajes', movil: '/m/mensajes', pagina: 'app/mensajes/page.tsx', titulo: 'MaKo Messages' },
  { escritorio: '/modelos-ia', movil: '/m/modelos-ia', pagina: 'app/modelos-ia/page.tsx', titulo: 'AI Models' },
  { escritorio: '/contexto', movil: '/m/contexto', pagina: 'app/contexto/page.tsx', titulo: 'MaKo Context' },
  // Billing y Client Agents (17/10/2026, la tanda que siguió), del menú de la foto del super admin.
  { escritorio: '/admin/cobros', movil: '/m/cobros', pagina: 'app/admin/cobros/page.tsx', titulo: 'Billing' },
  { escritorio: '/admin/agente', movil: '/m/agente', pagina: 'app/admin/agente/page.tsx', titulo: 'Client Agents' },
];

test('la MISMA URL que la computadora, ida y vuelta, y la cabecera con el nombre de la sidebar', () => {
  for (const t of TRES) {
    assert.equal(rutaMovil(t.escritorio), t.movil, t.escritorio);
    assert.equal(rutaEscritorio(t.movil), t.escritorio, t.movil);
    assert.equal(rutaInterna(t.escritorio), t.movil);
    assert.equal(cabeceraPorRuta(t.movil).titulo, t.titulo);
    const s = SECCIONES_MAS.find((x) => x.href === t.movil);
    assert.ok(s?.superAdmin && s.oculta, `${t.movil}: fila oculta y de super admin`);
  }
});

test('la MISMA puerta que escritorio: getSesionAdmin antes de leer nada', () => {
  for (const t of TRES) {
    assert.match(leer(t.pagina), /getSesionAdmin\(\)/, `${t.pagina}: cambió la puerta de escritorio`);
    const movil = leer(`app${t.movil}/page.tsx`);
    const puerta = movil.indexOf('if (!(await getSesionAdmin())) redirect(');
    assert.ok(puerta > 0, `${t.movil}: sin la puerta del super admin`);
    assert.ok(puerta < movil.indexOf('requireMovil('), `${t.movil}: la puerta va antes que todo`);
  }
});

test('las MISMAS rutas de datos, y las opciones de AI Models en UNA copia', () => {
  const mensajes = leer('app/m/mensajes/MensajesM.tsx');
  assert.match(mensajes, /const RUTA = '\/api\/admin\/plantillas'/);
  assert.match(mensajes, /action: 'enabled', id: p\.id, enabled/);
  assert.match(leer('app/m/modelos-ia/ModelosIAM.tsx'), /const RUTA = '\/api\/admin\/modelos'/);
  const contexto = leer('app/m/contexto/ContextoM.tsx');
  for (const r of ['/api/mako/knowledge', '/api/mako/fases', '/api/mako/prompts']) assert.ok(contexto.includes(`'${r}'`), `Contexto sin ${r}`);
  // Una sola lista de modelos: la computadora y el teléfono la importan de app/modelos-ia/opciones.ts.
  assert.doesNotMatch(leer('app/modelos-ia/ModelosIA.tsx'), /const (CHAT|STT)_OPTS/);
  assert.match(leer('app/modelos-ia/ModelosIA.tsx'), /from '\.\/opciones'/);
  assert.match(leer('app/m/modelos-ia/ModelosIAM.tsx'), /from '@\/app\/modelos-ia\/opciones'/);
  // Abren con lo que leyó el SERVER, con la MISMA función que su ruta, y se montan con `key` nuevo en cada pasada del
  // server (refrescar trae lo nuevo). Si el server no leyó, la pantalla la pide como la computadora.
  const lecturas: [string, string, RegExp][] = [
    ['mensajes', 'app/api/admin/plantillas/route.ts', /enElStoreDeLaPestana/],
    ['modelos-ia', 'app/api/admin/modelos/route.ts', /getModelosConfig\(\)/],
    ['contexto', 'app/api/mako/prompts/route.ts', /getPrompts\(\)/],
  ];
  for (const [carpeta, ruta, lectura] of lecturas) {
    const pagina = leer(`app/m/${carpeta}/page.tsx`);
    assert.match(pagina, lectura, `${carpeta}: otra lectura que su ruta`);
    assert.match(leer(ruta), lectura, `${ruta}: la ruta dejó de usar la lectura compartida`);
    assert.match(pagina, /key=\{Date\.now\(\)\} iniciales=\{iniciales\}/, `${carpeta}: refrescar no trae lo nuevo`);
  }
  for (const f of ['app/m/mensajes/MensajesM.tsx', 'app/m/modelos-ia/ModelosIAM.tsx', 'app/m/contexto/ContextoM.tsx']) {
    assert.match(leer(f), /useEffect\(\(\) => \{ if \(iniciales == null\) void cargar\(\); \}, \[cargar, iniciales\]\);/, `${f}: sin lo del server, no lo pide`);
  }
});

test('MaKo Messages se alcanza por la barra de secciones de Automations, y sólo la ve el super admin', () => {
  const ids = (adminShell: boolean, rolWs: string) => seccionesDeTabM('automatizaciones', { adminShell, rolWs, capa: 'completo' }).map((s) => s.id);
  assert.deepEqual(ids(true, 'admin'), ['setting', 'mensajes']);
  assert.deepEqual(ids(false, 'admin'), ['setting'], 'el admin de un cliente no ve los mensajes de la plataforma');
  assert.deepEqual(ids(false, 'setter'), ['setting']);
  for (const f of ['app/m/automations/page.tsx', 'app/m/mensajes/page.tsx']) {
    assert.match(leer(f), /<SeccionesTabM tab="automatizaciones" activa="(setting|mensajes)"/, `${f}: sin la barra de secciones`);
  }
});

test('More del super admin abre AI Models y MaKo Context en el teléfono; el de un cliente no las tiene', () => {
  const filas = (adminShell: boolean) => masCompleto('admin', 'superadmin', adminShell).flatMap((g) => g.filas);
  const sa = filas(true);
  for (const [label, href] of [['AI Models', '/m/modelos-ia'], ['MaKo Context', '/m/contexto']]) {
    const f = sa.find((x) => x.label === label);
    assert.ok(f && f.tipo === 'pantalla' && f.href === href, `${label}: no abre su pantalla`);
  }
  assert.ok(!masCompleto('admin', 'completo', false).flatMap((g) => g.filas).some((x) => x.label === 'AI Models'));
});

test('Billing: lo que mueve plata queda en la computadora, y Client Agents lee con la función de escritorio', () => {
  const cobros = leer('app/m/cobros/CobrosM.tsx');
  assert.doesNotMatch(cobros, /anularCobroMakoAction|reembolsarCobroMakoAction|crearCobro|venderPlan/i, 'una acción que mueve plata en el teléfono');
  assert.match(leer('app/m/cobros/page.tsx'), /cobrosDeMakoAction\(\)/);
  // La pantalla de escritorio es la pestaña Agents de Customers desde el 25/10/2026 (app/admin/agente/Contenido.tsx).
  for (const f of ['app/admin/agente/Contenido.tsx', 'app/m/agente/page.tsx']) assert.match(leer(f), /leerSesionesAgente\(\)/, `${f}: otra lectura`);
  assert.doesNotMatch(leer('app/admin/agente/Contenido.tsx'), /from\('agente_sesiones'\)/, 'la lectura volvió a la página');
});

test('AI Models sólo ofrece lo que ofrece la computadora (las listas de chat y de voz a texto)', () => {
  assert.match(leer('app/m/modelos-ia/ModelosIAM.tsx'), /\(it\.grupo === 'STT' \? STT_OPTS : CHAT_OPTS\)/);
});
