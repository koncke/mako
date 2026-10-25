// =============================================================================
// Las herramientas del super admin en el teléfono: MaKo Messages, Billing y Client Agents
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
//
// 25/10/2026: AI Models y MaKo Context se fueron, en la computadora y en el teléfono (Martín, puntos 13 y 14). Lo que sabe
// MaKo está en Classroom › Methodology y los prompts en Settings › Prompts; las rutas viejas redirigen (next.config.ts).
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

test('las MISMAS rutas de datos que la computadora', () => {
  const mensajes = leer('app/m/mensajes/MensajesM.tsx');
  assert.match(mensajes, /const RUTA = '\/api\/admin\/plantillas'/);
  assert.match(mensajes, /action: 'enabled', id: p\.id, enabled/);
  // Abren con lo que leyó el SERVER, con la MISMA función que su ruta, y se montan con `key` nuevo en cada pasada del
  // server (refrescar trae lo nuevo). Si el server no leyó, la pantalla la pide como la computadora.
  const lecturas: [string, string, RegExp][] = [
    ['mensajes', 'app/api/admin/plantillas/route.ts', /enElStoreDeLaPestana/],
  ];
  for (const [carpeta, ruta, lectura] of lecturas) {
    const pagina = leer(`app/m/${carpeta}/page.tsx`);
    assert.match(pagina, lectura, `${carpeta}: otra lectura que su ruta`);
    assert.match(leer(ruta), lectura, `${ruta}: la ruta dejó de usar la lectura compartida`);
    assert.match(pagina, /key=\{Date\.now\(\)\} iniciales=\{iniciales\}/, `${carpeta}: refrescar no trae lo nuevo`);
  }
  for (const f of ['app/m/mensajes/MensajesM.tsx']) {
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

test('More del super admin ya no tiene AI Models, MaKo Context ni Dev (se fueron el 25/10/2026)', () => {
  const sa = masCompleto('admin', 'superadmin', true).flatMap((g) => g.filas);
  for (const label of ['AI Models', 'MaKo Context', 'Dev']) assert.ok(!sa.some((x) => x.label === label), `${label} volvió a More`);
  for (const ruta of ['/m/modelos-ia', '/m/contexto']) assert.ok(!SECCIONES_MAS.some((s) => s.href === ruta), `${ruta} volvió`);
  // La ruta de escritorio no se lleva al teléfono: redirige antes (next.config.ts).
  assert.equal(rutaMovil('/contexto'), rutaMovil('/una-que-no-existe'));
});

test('Billing: lo que mueve plata queda en la computadora, y Client Agents lee con la función de escritorio', () => {
  const cobros = leer('app/m/cobros/CobrosM.tsx');
  assert.doesNotMatch(cobros, /anularCobroMakoAction|reembolsarCobroMakoAction|crearCobro|venderPlan/i, 'una acción que mueve plata en el teléfono');
  assert.match(leer('app/m/cobros/page.tsx'), /cobrosDeMakoAction\(\)/);
  for (const f of ['app/admin/agente/page.tsx', 'app/m/agente/page.tsx']) assert.match(leer(f), /leerSesionesAgente\(\)/, `${f}: otra lectura`);
  assert.doesNotMatch(leer('app/admin/agente/page.tsx'), /from\('agente_sesiones'\)/, 'la lectura volvió a la página');
});

