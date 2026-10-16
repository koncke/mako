// =============================================================================
// «Tu cuenta» y «Configuración del negocio»: los dos lugares de ajustes (15/10/2026)
// =============================================================================
// Pedido de Martín: rediseñar Perfil, Integraciones y Configuraciones «como lo hace google», y la
// Seguridad «copia tal cual la sección de seguridad de google». Aprobó dos lugares (lo de la persona y lo
// del negocio) y que cada sección sea su ruta. Lo que se fija acá es lo que no se ve en una captura:
// el orden y los rótulos (los mismos en la computadora y el celular), que cada link caiga en su sección
// —incluidos los 49 avisos que dicen `/configuraciones?tab=notif`— y que la vista general de Seguridad no
// tenga ninguna acción que borre.
//
// Probado ROMPIÉNDOLO (15/10/2026); los números, en ROTURAS al final.
//
// Correr: node --import tsx --test tests/ajustes-cuenta-negocio.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SECCIONES_CUENTA, TITULO_CUENTA, conLaQuery, rutaDeTabVieja, seccionesCuenta, seccionesNegocio,
} from '../lib/ajustes-secciones';
import { detalleDeUrl, estadoGeneral, filasDeAcceso, filasDeDispositivos, type EstadoSeguridad } from '../app/perfil/seguridad/reglas';
import { rutaEscritorio, rutaMovil } from '../lib/movil-rutas';
import { TITULO_CUENTA as TITULO_TELEFONO } from '../app/m/_ui/cabecera';
import { USER_NAV } from '../app/_components/nav';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TODAS = { general: true, integraciones: true, metodo: true, plan: true };

test('las dos listas: el orden y los rótulos que aprobó Martín', () => {
  assert.deepEqual(SECCIONES_CUENTA.map((s) => s.label), ['Información personal', 'Seguridad', 'Notificaciones', 'Instalar la app']);
  // «Tu plan» se sumó el 15/10/2026: cancelar uno mismo el plan de MaKo, como todo SaaS (lo decidió Estrategia).
  assert.deepEqual(seccionesNegocio(TODAS).map((s) => s.label), ['General', 'Equipo', 'Integraciones', 'Notificaciones', 'Identidades fiscales', 'Tu plan', 'Método']);
  // Sin General (hoy, quien no es el super admin), sin Integraciones (no lo compró) y sin Método (no es la agencia).
  assert.deepEqual(seccionesNegocio({ general: false, integraciones: false, metodo: false, plan: true }).map((s) => s.key), ['equipo', 'notificaciones', 'fiscal', 'plan']);
  // En el workspace de la PLATAFORMA no hay «Tu plan»: la plataforma no tiene un plan de MaKo (15/10/2026).
  assert.ok(!seccionesNegocio({ general: true, integraciones: true, metodo: true, plan: false }).some((s) => s.key === 'plan'));
  // Mirando a un cliente, «Tu cuenta» muestra su perfil; lo tuyo sólo si es donde estás parado.
  assert.deepEqual(seccionesCuenta(true, 'info').map((s) => s.key), ['info']);
  assert.deepEqual(seccionesCuenta(true, 'seguridad').map((s) => s.key), ['info', 'seguridad']);
});

test('el ?tab= viejo de los avisos ya mandados cae en su sección, con el ?ws= del cliente', () => {
  assert.equal(rutaDeTabVieja('notif'), '/configuraciones/notificaciones');
  assert.equal(rutaDeTabVieja('fiscal'), '/configuraciones/fiscal');
  assert.equal(rutaDeTabVieja('equipo'), '/equipo');
  assert.equal(rutaDeTabVieja('otra'), null);
  assert.equal(conLaQuery('/configuraciones/notificaciones', { tab: 'notif', ws: '3' }, ['tab']), '/configuraciones/notificaciones?ws=3');
  const general = sinComentarios(leer('app/configuraciones/page.tsx'));
  const viejo = general.indexOf("if (vieja && vieja !== '/configuraciones') redirect(conLaQuery(vieja, sp, ['tab']));");
  const sinGeneral = general.indexOf('if (!disponibles.general) redirect(');
  assert.ok(viejo > 0 && sinGeneral > viejo, 'el ?tab= viejo se decide antes que la entrada por defecto: si no, «apagar este reporte» cae en Equipo');
  assert.match(leer('lib/avisos.ts'), /link: a\.link \?\? '\/configuraciones\?tab=notif'/, 'el link de los avisos cambió: revisar a dónde cae');
});

test('cada sección es su ruta, y su página marca su lugar en el índice', () => {
  const pagina = (href: string) => `app${href}/page.tsx`;
  for (const s of [...SECCIONES_CUENTA, ...seccionesNegocio(TODAS)]) {
    const src = sinComentarios(leer(pagina(s.href)));
    assert.match(src, /<AjustesPagina /, `${s.href} sin el molde`);
    assert.ok(src.includes(`activa="${s.key}"`), `${s.href} marca otra sección en el índice`);
  }
  // Integraciones conserva su techo: el after() de una action vive en el maxDuration de la PÁGINA.
  assert.match(leer('app/integraciones/page.tsx'), /export const maxDuration = 300;/);
});

test('«Tu cuenta» es de todos los roles; «Configuración del negocio», de quien administra', () => {
  for (const f of ['app/perfil/page.tsx', 'app/perfil/notificaciones/page.tsx', 'app/perfil/instalar/page.tsx']) {
    assert.match(sinComentarios(leer(f)), /await requireRolWs\(\['closer', 'setter'\]\);/, `${f} echa a closers y setters de lo suyo`);
  }
  for (const f of ['app/configuraciones/page.tsx', 'app/configuraciones/notificaciones/page.tsx', 'app/configuraciones/fiscal/page.tsx', 'app/equipo/page.tsx']) {
    assert.match(sinComentarios(leer(f)), /await requireRolWs\(\[\], \{ nav: 'configuraciones' \}\);/, `${f} sin el guard del negocio`);
  }
});

test('el celular dice lo mismo: el título, las secciones y la ruta de Seguridad', () => {
  assert.equal(TITULO_TELEFONO, TITULO_CUENTA);
  const cuenta = sinComentarios(leer('app/m/cuenta/CuentaM.tsx'));
  assert.match(cuenta, /import \{ SECCIONES_CUENTA \} from '@\/lib\/ajustes-secciones';/);
  for (const k of ['info', 'seguridad', 'notificaciones', 'instalar']) assert.ok(cuenta.includes(`ROTULO.${k}`), `el teléfono no muestra «${k}» con el rótulo de la computadora`);
  assert.doesNotMatch(cuenta, /titulo="(Perfil|Instalar MaKo|Seguridad|Notificaciones)"/, 'un rótulo escrito a mano en el teléfono');
  assert.equal(rutaMovil('/perfil/seguridad'), '/m/cuenta/seguridad');
  assert.equal(rutaEscritorio('/m/cuenta/seguridad'), '/perfil/seguridad');
});

test('Seguridad: la vista general no tiene ninguna acción que borre (viven en el detalle, como en Google)', () => {
  const src = sinComentarios(leer('app/perfil/seguridad/SeguridadCuenta.tsx'));
  const general = src.slice(src.indexOf('if (!detalle) {'), src.indexOf('if (detalle === VER_DISPOSITIVOS) {'));
  assert.ok(general.length > 500, `recorte: ${general.length}`);
  assert.doesNotMatch(general, /accion: 'quitar'|dispositivo-revocar|codigos-generar|quitar\(/);
});

const base: EstadoSeguridad = {
  obligatorio: true, obligatorioDesde: null, esTelefono: false, cuenta: 'a@b.c', passkeysDisponibles: false, canales: [],
  totp: true, whatsapp: null, email: null, passkeys: [], codigosRestantes: 10, contrasena: true, dispositivos: [],
};

test('las filas: el orden de Google, y dos dispositivos iguales se distinguen', () => {
  assert.deepEqual(filasDeAcceso(base).map((f) => f.clave), ['app', 'llaves', 'contrasena', 'codigos']);
  assert.deepEqual(filasDeAcceso({ ...base, canales: ['whatsapp'] }).map((f) => f.clave), ['app', 'llaves', 'contrasena', 'whatsapp', 'codigos']);
  assert.equal(filasDeAcceso({ ...base, totp: false }).find((f) => f.clave === 'app')?.estado?.tono, 'warn');
  const d = (id: number, nombre: string) => ({ id, nombre, created_at: '2026-10-14T20:00:00Z', usado_at: null, expira_at: '2026-11-13T20:00:00Z' });
  const filas = filasDeDispositivos({ ...base, dispositivos: [d(1, 'Chrome en Android'), d(2, 'Chrome en Windows'), d(3, 'Chrome en Android')] });
  assert.deepEqual(filas.map((f) => f.titulo), ['Chrome en Android (1)', 'Chrome en Windows', 'Chrome en Android (2)']);
  assert.deepEqual(filas.map((f) => f.icono), ['celular', 'computadora', 'celular']);
  // Sin ningún método, la tarjeta de arriba lleva a activar el segundo paso (la contraseña se crea con su código).
  assert.equal(estadoGeneral({ ...base, totp: false, contrasena: false }).ir, 'app');
  assert.equal(estadoGeneral({ ...base, contrasena: false }).ir, 'contrasena');
  assert.equal(estadoGeneral(base).protegida, true);
  assert.equal(detalleDeUrl('dispositivo-12'), 'dispositivo-12');
  assert.equal(detalleDeUrl('dispositivos'), 'dispositivos');
  assert.equal(detalleDeUrl('../admin'), null);
});

test('el menú de la foto: dos lugares, e Integraciones es una sección del negocio', () => {
  const porKey = Object.fromEntries(USER_NAV.map((i) => [i.key, i]));
  assert.equal(porKey.perfil.label, 'Tu cuenta');
  assert.equal(porKey.configuraciones.label, 'Configuración del negocio');
  assert.equal(porKey.integraciones.soloSeccion, true);
  assert.ok(porKey.configuraciones.match('/integraciones'), 'en Integraciones no se marca «Configuración del negocio»');
  assert.match(sinComentarios(leer('app/_components/Sidebar.tsx')), /USER_NAV\.filter\(\(it\) => !it\.soloSeccion && /, 'Integraciones vuelve al menú como un lugar más');
});

// ROTURAS (15/10/2026), una por vez y restaurando de memoria. Base: 8 pases, 0 fallos. Cada una dio 7/1:
//   Seguridad después de Notificaciones · `?tab=notif` a General · el `?tab=` viejo DESPUÉS de la entrada
//   por defecto · /perfil con `requireRolWs([])` · Integraciones marcando otra sección · un rótulo escrito
//   a mano en el teléfono · sin la ruta /perfil/seguridad → /m/cuenta/seguridad · «Olvidar todos» en la
//   vista general · los dispositivos sin numerar · Integraciones de vuelta en el menú (el filtro, y el
//   ítem sin `soloSeccion`) · el teléfono titulado «Perfil» · Integraciones con `maxDuration = 60`.
// ⚠️ La rotura del orden se armó mal la primera vez y dio VERDE (8/0): movía el redirect viejo justo
// antes del de la entrada por defecto, o sea al orden correcto. Rehecha poniéndolo después: 7/1.
