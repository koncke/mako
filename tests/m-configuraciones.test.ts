// =============================================================================
// «Configuración del negocio» en el teléfono (/m/configuraciones): las mismas secciones, rutas, puertas y APIs
// =============================================================================
// 17/10/2026, «Mobile 2» (Martín: «Implementa completamente MaKo Mobile en todas las tabs»). Hasta ese día «Tu cuenta»
// del teléfono decía «Configuración del negocio · En la computadora». Ahora es Ajustes de iOS: el índice y una pantalla
// por sección. Lo que fija este archivo es lo invisible:
//   · cada sección con pantalla es la MISMA ruta de escritorio (la tabla del teléfono no puede derivar de la de
//     lib/ajustes-secciones.ts), y la que no tiene pantalla tiene su motivo;
//   · cada pantalla tiene la MISMA puerta que su página de escritorio;
//   · cada pantalla usa la MISMA API (/api/equipo, /api/perfil/destinatarios, las acciones de escritorio) y vuelve a
//     leer al refrescar;
//   · Integraciones sólo LEE (no reconcilia incidentes ni le pega a Meta al abrir).
//
// Verificado ROMPIÉNDOLO (17/10/2026, scratchpad/mobile2/romper_m2.py, de a una; base 6 / 0):
//   · `SECCIONES_NEGOCIO_M.plan` = '/configuraciones/planes'           → 5 / 1 (la tabla contra lib/ajustes-secciones.ts)
//   · la pantalla de Integraciones con la key 'configuraciones'        → 5 / 1 (la puerta)
//   · el índice sin el motivo de «metodo»                              → 5 / 1 (sin pantalla y sin motivo)
//   · Equipo sin `key` nuevo en cada pasada del server (refrescar no traía nada) → 5 / 1
//   · Integraciones llamando a `reconciliarIncidentes`                 → 5 / 1
//   · el GET de /api/equipo con su propia lectura (no `equipoDe`)      → 5 / 1 (17/10/2026, al abrir con lo del server)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUTA_CONFIG_M, SECCIONES_NEGOCIO_M, rutaEscritorio, rutaInterna, rutaMovil, type SeccionNegocioM } from '../lib/movil-rutas';
import { seccionesNegocio } from '../lib/ajustes-secciones';
import { cabeceraPorRuta } from '../app/m/_ui/cabecera';
import { tituloDe } from '../lib/titulo-tab';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const CLAVES = Object.keys(SECCIONES_NEGOCIO_M).filter((k): k is SeccionNegocioM => k in SECCIONES_NEGOCIO_M);
/** Todas las secciones que existen (con todo disponible): de ahí sale el índice de las dos pantallas. */
const TODAS = seccionesNegocio({ integraciones: true, plan: true });

test('cada sección con pantalla es la MISMA ruta de escritorio que dice lib/ajustes-secciones.ts', () => {
  for (const k of CLAVES) {
    // «Notificaciones» del negocio salió del índice de la computadora el 25/10/2026 (estaba dos veces): vive en la de «Tu cuenta»
    // (/perfil/notificaciones, sus canales WhatsApp y Email) y su ruta de escritorio quedó como un redirect ahí. El teléfono
    // sigue con su pantalla.
    if (k === 'notificaciones') {
      assert.equal(SECCIONES_NEGOCIO_M[k], '/configuraciones/notificaciones');
      assert.match(leer('app/configuraciones/notificaciones/page.tsx'), /redirect\(conLaQuery\('\/perfil\/notificaciones'/);
      continue;
    }
    const s = TODAS.find((x) => x.key === k);
    assert.ok(s, `${k}: no es una sección de «Configuración del negocio»`);
    assert.equal(SECCIONES_NEGOCIO_M[k], s.href, `${k}: la tabla del teléfono no es la ruta de escritorio`);
  }
});

test('ida y vuelta: /configuraciones es el índice y cada sección, la suya; el `?tab=` viejo va donde la computadora', () => {
  assert.equal(rutaMovil('/configuraciones'), RUTA_CONFIG_M);
  assert.equal(rutaEscritorio(RUTA_CONFIG_M), '/configuraciones');
  for (const k of CLAVES) {
    const m = `${RUTA_CONFIG_M}/${k}`;
    assert.equal(rutaMovil(SECCIONES_NEGOCIO_M[k]), m, k);
    assert.equal(rutaEscritorio(m), SECCIONES_NEGOCIO_M[k], k);
    assert.equal(rutaInterna(SECCIONES_NEGOCIO_M[k]), m, k);
    assert.ok(existsSync(join(RAIZ, `app/m/configuraciones/${k}/page.tsx`)), `${k}: sin página en el teléfono`);
    assert.equal(tituloDe(m), tituloDe(SECCIONES_NEGOCIO_M[k]), `${k}: la pestaña no se titula como en la computadora`);
  }
  // Los 49 avisos de «apagar este reporte» dicen `?tab=notif` (lib/avisos.ts): a las Notificaciones del negocio.
  assert.equal(rutaMovil('/configuraciones?tab=notif&ws=3'), `${RUTA_CONFIG_M}/notificaciones`);
  assert.equal(rutaMovil('/configuraciones?tab=equipo'), `${RUTA_CONFIG_M}/equipo`);
  // `?abrir=` abre ESA integración (lib/integracion-en-tab.ts) en los dos lados; el `?ws=` no viaja.
  assert.equal(rutaMovil('/integraciones?abrir=meta&ws=3'), `${RUTA_CONFIG_M}/integraciones?abrir=meta`);
  assert.equal(rutaEscritorio(`${RUTA_CONFIG_M}/integraciones?abrir=meta`), '/integraciones?abrir=meta');
  // Método no tiene pantalla: la computadora la tapa con «se usa en la computadora».
  assert.equal(rutaMovil('/metodo'), null);
  // Cada sección vuelve al índice.
  assert.deepEqual(cabeceraPorRuta(`${RUTA_CONFIG_M}/equipo`).padre, { href: RUTA_CONFIG_M, label: 'Business settings' });
});

test('el índice ofrece lo de la computadora, y lo que no tiene pantalla dice por qué', () => {
  const indice = leer('app/m/configuraciones/page.tsx');
  assert.match(indice, /seccionesNegocio\(await disponiblesNegocio\(\)\)/, 'el índice no lo decide la sesión, como en escritorio');
  for (const s of TODAS.filter((x) => !(x.key in SECCIONES_NEGOCIO_M))) {
    assert.match(indice, new RegExp(`\\n  ${s.key}: '[^']{40,}'`), `${s.key}: sin pantalla y sin motivo en EN_LA_COMPUTADORA`);
  }
});

test('cada pantalla tiene la MISMA puerta que su página de escritorio', () => {
  const puertas: Record<SeccionNegocioM, [string, string]> = {
    equipo: ['app/equipo/page.tsx', 'configuraciones'],
    integraciones: ['app/integraciones/page.tsx', 'integraciones'],
    notificaciones: ['app/configuraciones/notificaciones/page.tsx', 'configuraciones'],
    fiscal: ['app/configuraciones/fiscal/page.tsx', 'configuraciones'],
    plan: ['app/configuraciones/plan/page.tsx', 'configuraciones'],
  };
  for (const k of CLAVES) {
    const [escritorio, key] = puertas[k];
    assert.match(leer(escritorio), new RegExp(`requireRolWs\\(\\[\\], \\{ nav: '${key}' \\}\\)`), `${escritorio}: cambió su puerta`);
    assert.match(leer(`app/m/configuraciones/${k}/page.tsx`), new RegExp(`requireMovil\\(\\{ navKey: '${key}' \\}\\)`), `${k}: otra puerta que escritorio`);
  }
  assert.match(leer('app/m/configuraciones/page.tsx'), /requireMovil\(\{ navKey: 'configuraciones' \}\)/);
});

test('la MISMA API que escritorio, y refrescar vuelve a leer', () => {
  const equipo = leer('app/m/configuraciones/equipo/EquipoM.tsx');
  for (const a of ['invitar', 'rolws', 'reinvitar', 'estado', 'eliminar']) assert.match(equipo, new RegExp(`action: '${a}'`), `Equipo sin «${a}»`);
  assert.match(equipo, /fetch\('\/api\/equipo'/);
  const notif = leer('app/m/configuraciones/notificaciones/NotificacionesNegocioM.tsx');
  assert.match(notif, /fetch\('\/api\/perfil\/destinatarios'/);
  assert.match(notif, /JSON\.stringify\(\{ telefonos, emails, \.\.\.\(wsLeido != null \? \{ ws: wsLeido \} : \{\}\) \}\)/, 'guarda las DOS listas, como DestinatariosCanal');
  // Abre con lo que leyó el SERVER, con la MISMA función que la ruta (17/10/2026, «que el teléfono ande más rápido»), y
  // se monta con `key` nuevo en cada pasada del server: tirar hacia abajo trae lo nuevo. Si el server no leyó, la pide.
  const lecturas: [string, string, string, RegExp][] = [
    // La de la ruta, en su GET (el POST también la usa, para validar el objetivo: no alcanza con que aparezca).
    ['app/m/configuraciones/equipo/page.tsx', 'app/m/configuraciones/equipo/EquipoM.tsx', 'app/api/equipo/route.ts', /equipoDe\(/],
    ['app/m/configuraciones/notificaciones/page.tsx', 'app/m/configuraciones/notificaciones/NotificacionesNegocioM.tsx', 'app/api/perfil/destinatarios/route.ts', /destinatariosDelNegocio\(\)/],
  ];
  for (const [pagina, cliente, ruta, lectura] of lecturas) {
    assert.match(leer(pagina), lectura, `${pagina}: otra lectura que la ruta`);
    assert.match(leer(ruta), lectura, `${ruta}: la ruta dejó de usar la lectura compartida`);
  }
  assert.match(leer('app/api/equipo/route.ts'), /equipo: await equipoDe\(ctx\.ws\)/, 'el GET de /api/equipo dejó de usar `equipoDe`');
  for (const [pagina, cliente] of lecturas) {
    assert.match(leer(pagina), /key=\{Date\.now\(\)\} iniciales=\{iniciales\}/, `${pagina}: refrescar no trae lo nuevo`);
    assert.match(leer(cliente), /useEffect\(\(\) => \{ if \(iniciales == null\) void cargar\(\); \}, \[cargar, iniciales\]\);/, `${cliente}: sin lo del server, no lo pide`);
  }
  assert.match(leer('app/m/configuraciones/fiscal/FiscalM.tsx'), /saveIdentidadFiscalAction\(/);
  assert.match(leer('app/m/configuraciones/plan/PlanM.tsx'), /darmeDeBajaAction\(\)/);
});

test('Integraciones en el teléfono sólo LEE: ni reconcilia incidentes ni le pega a Meta al abrir', () => {
  const src = leer('app/m/configuraciones/integraciones/page.tsx');
  assert.match(src, /getIntegraciones\(\)/);
  assert.doesNotMatch(src, /reconciliarIncidentes|getMetaHealth/);
});

test('«Conectar mi IA» (`?abrir=ia`) en el teléfono lleva a «Tus cuentas de IA» (13/11/2026, en producción: quedaba la lista sin nada abierto)', () => {
  const pagina = leer('app/m/configuraciones/integraciones/page.tsx');
  assert.ok(pagina.includes("if ((await searchParams).abrir?.trim().toLowerCase() === ABRIR_IA) redirect(await rutaConWs('/perfil/ia'));"));
  // Antes de leer las integraciones: la redirección no espera a la base.
  assert.ok(pagina.indexOf('ABRIR_IA) redirect') < pagina.indexOf('getIntegraciones(), getIncidentes'));
});
