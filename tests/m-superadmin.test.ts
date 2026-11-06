// =============================================================================
// Las herramientas del super admin en el teléfono: Billing y Client Agents (MaKo Messages salió el 26/10/2026)
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
// 26/10/2026: salió MaKo Messages (Martín: «elimina eso»); lo fija tests/mensajes-mako-retirado.test.ts. Con ella se fueron
// sus casos de acá (la fila, la puerta, la lectura del server y la barra de secciones de Automations).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECCIONES_MAS, masCompleto, rutaEscritorio, rutaInterna, rutaMovil } from '../lib/movil-rutas';
import { cabeceraPorRuta } from '../app/m/_ui/cabecera';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const TRES = [
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
  // La pantalla de escritorio es, desde el 6/11/2026, un tipo de evento de Admin › Analytics › Events (la copia de Polar), que
  // lee con la misma función (antes era app/admin/agente/Contenido.tsx, la pestaña Agents).
  assert.match(leer('app/m/agente/page.tsx'), /leerSesionesAgente\(\)/, 'app/m/agente/page.tsx: otra lectura');
  assert.match(leer('app/admin/_polar/datos/eventos-server.ts'), /leerSesionesAgente\(TOPE_SESIONES\)/, 'Analytics › Events: otra lectura');
  for (const f of ['app/admin/_polar/datos/eventos-server.ts', 'app/admin/(polar)/analytics/events/page.tsx']) {
    assert.doesNotMatch(leer(f), /from\('agente_sesiones'\)/, `${f}: la lectura volvió a la página`);
  }
});

