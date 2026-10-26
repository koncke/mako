// =============================================================================
// «MaKo Messages» salió de Automations del super admin, y los avisos siguen saliendo (26/10/2026)
// =============================================================================
// Martín (26/10/2026): «En Automations de Super Admin tengo "MaKo Messages" elimina eso». El Cerebro: «deprecar no es
// romper»: sale la pantalla, y lo que MaKo manda solo sigue andando con su configuración. Era el editor de la BASE de los
// avisos al dueño (`mako.plantillas.base`), que en producción no existe (medido): desde el 10/10 no le cambiaba nada a nadie.
// Fija:
//   · ni la barra ni la sección de Automations ni el menú del super admin la nombran, en la computadora y en el teléfono;
//   · /mensajes y /m/mensajes redirigen a Automations (next.config.ts), y el `?tab=plantillas` viejo de /agencia también;
//   · las pantallas se fueron (escritorio, teléfono y la lista que sólo usaban ellas);
//   · lo que sigue vivo NO se tocó: el envío (lib/avisos.ts) lee el store de cada negocio, y lo que lo toca desde una pantalla
//     (`/api/perfil/plantillas` y el detalle de un mensaje, que usa la bandeja de correo). No hay un interruptor por aviso de
//     WhatsApp en Notificaciones: docs/hallazgos-comunicacion.md, «Nueve avisos de Notificaciones no le salen a nadie».
// Correr: node --import tsx --test tests/mensajes-mako-retirado.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_NAV, FAMILIAS, SUPERADMIN_MENU, TODOS_LOS_ITEMS } from '../app/_components/nav';
import { SECCIONES_MAS, masCompleto, rutaMovil } from '../lib/movil-rutas';
import { seccionesDeTabM } from '../app/m/_ui/SeccionesTabM';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

test('ninguna barra la nombra: ni la sidebar, ni la sección de Automations, ni el menú del super admin, ni el teléfono', () => {
  const tabs = FAMILIAS.flatMap((f) => f.bloques.flat());
  const todos = [...tabs, ...tabs.flatMap((t) => t.secciones ?? []), ...SUPERADMIN_MENU, ...ADMIN_NAV, ...TODOS_LOS_ITEMS];
  assert.deepEqual(todos.filter((i) => i.href === '/mensajes' || i.label === 'MaKo Messages').map((i) => i.key), [], 'MaKo Messages volvió a la barra');
  const automations = tabs.find((t) => t.key === 'automatizaciones')!;
  assert.deepEqual((automations.secciones ?? []).map((s) => s.key), ['setting'], 'Automations volvió a tener otra sección');
  assert.equal(automations.match('/mensajes'), false, '/mensajes ya no es de Automations: redirige antes');
  // El teléfono: ni la fila, ni la sección de la barra de Automations.
  assert.deepEqual(seccionesDeTabM('automatizaciones', { adminShell: true, rolWs: 'admin', capa: 'completo' }).map((s) => s.id), ['setting']);
  assert.ok(!SECCIONES_MAS.some((s) => s.href === '/m/mensajes'), '/m/mensajes volvió a More');
  assert.ok(!masCompleto('admin', 'superadmin', true).flatMap((g) => g.filas).some((x) => x.label === 'MaKo Messages'));
  assert.equal(rutaMovil('/mensajes'), rutaMovil('/una-que-no-existe'), 'la ruta de escritorio no se lleva al teléfono: redirige antes');
});

test('los links viejos caen en Automations, y las pantallas se fueron', () => {
  const config = leer('next.config.ts');
  assert.match(config, /\{ source: '\/mensajes', destination: '\/automations', permanent: false \},/);
  assert.match(config, /\{ source: '\/m\/mensajes', destination: '\/m\/automations', permanent: false \},/);
  assert.match(leer('app/agencia/page.tsx'), /if \(tab === 'plantillas'\) redirect\(await rutaConWs\('\/automations'\)\);/);
  for (const f of ['app/mensajes/page.tsx', 'app/mensajes/MensajesMaKo.tsx', 'app/m/mensajes/page.tsx', 'app/m/mensajes/MensajesM.tsx', 'app/agencia/PlantillasView.tsx']) {
    assert.ok(!existsSync(join(RAIZ, f)), `${f} volvió`);
  }
});

test('lo que MaKo manda solo sigue andando: el envío lee el store de cada negocio, y cada negocio edita los suyos', () => {
  // El punto único de los avisos lee el texto, el flujo y si está prendido del store (lib/plantillas.ts): no es código muerto.
  const avisos = leer('lib/avisos.ts');
  assert.match(avisos, /const \{ getFlujo \} = await import\('\.\/plantillas'\);/);
  assert.match(avisos, /const \{ getPlantilla, referenciaResuelta, generarMensajeAviso \} = await import\('\.\/plantillas'\);/);
  assert.match(leer('lib/avisos-programados.ts'), /import \{ plantillaActiva, getPlantilla \} from '\.\/plantillas';/);
  assert.match(leer('lib/flujos.ts'), /import \{ listarFlujosActivos \} from '\.\/plantillas';/);
  // Lo que toca el store de un negocio desde una pantalla: su ruta y el detalle de un mensaje, que usa la bandeja de correo.
  assert.ok(existsSync(join(RAIZ, 'app/api/perfil/plantillas/route.ts')));
  assert.match(leer('app/perfil/BandejaEmail.tsx'), /import \{ TemplateDetalleModal, type PlantillaVista \} from '\.\.\/agencia\/TemplateDetalleModal';/);
});

// ROTURAS (26/10/2026, harness del scratchpad `roturas-mensajes.cjs`, una por vez y restaurada; base 3 / 0): la sección vuelve
// a Automations · /mensajes vuelve a marcar Automations · sin el redirect de escritorio · sin el del teléfono ·
// `?tab=plantillas` vuelve a /mensajes · la ruta del teléfono vuelve · el envío deja de leer el store → 2 / 1 cada una.
