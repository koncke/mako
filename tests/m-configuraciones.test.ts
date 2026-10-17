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
//   · Equipo sin `leido` en el efecto (refrescar no traía nada)        → 5 / 1
//   · Integraciones llamando a `reconciliarIncidentes`                 → 5 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUTA_CONFIG_M, SECCIONES_NEGOCIO_M, rutaEscritorio, rutaInterna, rutaMovil, type SeccionNegocioM } from '../lib/movil-rutas';
import { seccionesNegocio } from '../lib/ajustes-secciones';
import { cabeceraPorRuta } from '../app/m/_ui/cabecera';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const CLAVES = Object.keys(SECCIONES_NEGOCIO_M).filter((k): k is SeccionNegocioM => k in SECCIONES_NEGOCIO_M);
/** Todas las secciones que existen (con todo disponible): de ahí sale el índice de las dos pantallas. */
const TODAS = seccionesNegocio({ general: true, integraciones: true, metodo: true, plan: true });

test('cada sección con pantalla es la MISMA ruta de escritorio que dice lib/ajustes-secciones.ts', () => {
  for (const k of CLAVES) {
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
  assert.deepEqual(cabeceraPorRuta(`${RUTA_CONFIG_M}/equipo`).padre, { href: RUTA_CONFIG_M, label: 'Configuración del negocio' });
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
  assert.match(notif, /JSON\.stringify\(\{ telefonos, emails \}\)/, 'guarda las DOS listas, como DestinatariosCanal');
  // `leido` cambia con cada pasada del server: sin él en el efecto, tirar hacia abajo animaba y no traía nada.
  for (const f of ['app/m/configuraciones/equipo/EquipoM.tsx', 'app/m/configuraciones/notificaciones/NotificacionesNegocioM.tsx']) {
    assert.match(leer(f), /useEffect\(\(\) => \{ void cargar\(\); \}, \[cargar, leido\]\);/, `${f}: refrescar no vuelve a leer`);
  }
  assert.match(leer('app/m/configuraciones/fiscal/FiscalM.tsx'), /saveIdentidadFiscalAction\(/);
  assert.match(leer('app/m/configuraciones/plan/PlanM.tsx'), /darmeDeBajaAction\(\)/);
});

test('Integraciones en el teléfono sólo LEE: ni reconcilia incidentes ni le pega a Meta al abrir', () => {
  const src = leer('app/m/configuraciones/integraciones/page.tsx');
  assert.match(src, /getIntegraciones\(\)/);
  assert.doesNotMatch(src, /reconciliarIncidentes|getMetaHealth/);
});
