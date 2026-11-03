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
  SECCIONES_CUENTA, TITULO_CUENTA, conLaQuery, gruposAjustes, rutaDeTabVieja, seccionesCuenta, seccionesNegocio,
} from '../lib/ajustes-secciones';
import { detalleDeUrl, estadoGeneral, filasDeAcceso, filasDeDispositivos, type EstadoSeguridad } from '../app/perfil/seguridad/reglas';
import { rutaEscritorio, rutaMovil } from '../lib/movil-rutas';
import { TITULO_CUENTA as TITULO_TELEFONO } from '../app/m/_ui/cabecera';
import { USER_NAV } from '../app/_components/nav';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TODAS = { integraciones: true, plan: true };

test('las dos listas: el orden y los rótulos que aprobó Martín', () => {
  // 24/10/2026 (Martín): «Perfil primero en lugar de Información personal» y «Elimina la tab de Tus cuentas de IA».
  assert.deepEqual(SECCIONES_CUENTA.map((s) => s.label), ['Perfil', 'Seguridad', 'Notificaciones', 'Instalar la app']);
  // «Tu plan» se sumó el 15/10/2026: cancelar uno mismo el plan de MaKo, como todo SaaS (lo decidió Estrategia).
  // «Notificaciones» del negocio salió del índice el 25/10/2026 (estaba dos veces): vive en la de «Tu cuenta», abajo.
  // «General» y «Método» salieron el 26/10/2026 (Martín: «Elimina la tab General...», «Elimina Método... Si para eso ya tenemos
  // Integraciones»): la zona del negocio es una fila de Perfil; las credenciales, las tarjetas de Integraciones.
  assert.deepEqual(seccionesNegocio(TODAS).map((s) => s.label), ['Equipo', 'Integraciones', 'Identidades fiscales', 'Tu plan']);
  // «Prompts» también salió el 26/10/2026 (Martín: «sobra la de prompts en super admin»): su pantalla sigue, sin entrada acá.
  assert.ok(!seccionesNegocio(TODAS).some((s) => s.key === 'general' || s.key === 'metodo'), 'volvió General o Método al índice');
  // Sin Integraciones (no lo compró).
  assert.deepEqual(seccionesNegocio({ integraciones: false, plan: true }).map((s) => s.key), ['equipo', 'fiscal', 'plan']);
  // En el workspace de la PLATAFORMA no hay «Tu plan»: la plataforma no tiene un plan de MaKo (15/10/2026).
  assert.ok(!seccionesNegocio({ integraciones: true, plan: false }).some((s) => s.key === 'plan'));
  // Mirando a un cliente, «Tu cuenta» muestra su perfil; lo tuyo sólo si es donde estás parado.
  assert.deepEqual(seccionesCuenta(true, 'info').map((s) => s.key), ['info']);
  assert.deepEqual(seccionesCuenta(true, 'seguridad').map((s) => s.key), ['info', 'seguridad']);
  // Quien administra ese negocio sí ve Notificaciones: ahí vive a quién le avisa MaKo (ticket #49, tests/agencia-grupos.test.ts).
  assert.deepEqual(seccionesCuenta(true, 'info', true).map((s) => s.key), ['info', 'notificaciones']);
});

test('el ?tab= viejo de los avisos ya mandados cae en su sección, con el ?ws= del cliente', () => {
  assert.equal(rutaDeTabVieja('notif'), '/configuraciones/notificaciones');
  assert.equal(rutaDeTabVieja('fiscal'), '/configuraciones/fiscal');
  assert.equal(rutaDeTabVieja('equipo'), '/equipo');
  assert.equal(rutaDeTabVieja('otra'), null);
  assert.equal(conLaQuery('/configuraciones/notificaciones', { tab: 'notif', ws: '3' }, ['tab']), '/configuraciones/notificaciones?ws=3');
  // /configuraciones ya no es una pantalla (26/10/2026): el ?tab= viejo se decide ANTES que la entrada por defecto, si no
  // «apagar este reporte» cae en Equipo. Y los de «General» (horario, criterio) van a Perfil, donde quedó la zona del negocio.
  assert.equal(rutaDeTabVieja('horario'), '/perfil');
  assert.equal(rutaDeTabVieja('criterio'), '/perfil');
  const general = sinComentarios(leer('app/configuraciones/page.tsx'));
  const viejo = general.indexOf("if (vieja) redirect(conLaQuery(vieja, sp, ['tab']));");
  const porDefecto = general.indexOf("redirect(conLaQuery(secciones[0]?.href ?? '/equipo', sp, ['tab']));");
  assert.ok(viejo > 0 && porDefecto > viejo, 'el ?tab= viejo se decide antes que la entrada por defecto: si no, «apagar este reporte» cae en Equipo');
  assert.doesNotMatch(general, /<AjustesPagina/, '/configuraciones volvió a ser una pantalla');
  // Desde el 20/10/2026 un aviso con lead lleva a su ficha (lib/aviso-lead.ts); sin lead, sigue cayendo acá.
  assert.match(leer('lib/avisos.ts'), /link: a\.link \?\? linkDelLeadDelAviso\(a\) \?\? '\/configuraciones\?tab=notif'/, 'el link de los avisos cambió: revisar a dónde cae');
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
  for (const f of ['app/perfil/page.tsx', 'app/perfil/notificaciones/page.tsx', 'app/perfil/instalar/page.tsx', 'app/perfil/ia/page.tsx']) {
    assert.match(sinComentarios(leer(f)), /await requireRolWs\(\['closer', 'setter'\]\);/, `${f} echa a closers y setters de lo suyo`);
  }
  for (const f of ['app/configuraciones/page.tsx', 'app/configuraciones/notificaciones/page.tsx', 'app/configuraciones/fiscal/page.tsx', 'app/equipo/page.tsx']) {
    assert.match(sinComentarios(leer(f)), /await requireRolWs\(\[\], \{ nav: 'configuraciones' \}\);/, `${f} sin el guard del negocio`);
  }
});

test('el celular dice lo mismo: el título, las secciones y la ruta de Seguridad', () => {
  assert.equal(TITULO_TELEFONO, TITULO_CUENTA);
  const cuenta = sinComentarios(leer('app/m/cuenta/CuentaM.tsx'));
  assert.match(cuenta, /import \{ [^}]*\bSECCIONES_CUENTA\b[^}]* \} from '@\/lib\/ajustes-secciones';/);
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
  // En inglés desde el 17/10/2026 noche (prototipo de coherencia). Desde el 24/10/2026 UN lugar, «Settings», primero: la key
  // `perfil` con ese nombre, y «Business settings» como sección (`soloSeccion`, su key sigue siendo la puerta de sus páginas).
  assert.equal(porKey.perfil.label, 'Settings');
  assert.equal(porKey.configuraciones.label, 'Business settings');
  assert.equal(porKey.configuraciones.soloSeccion, true);
  assert.equal(porKey.integraciones.soloSeccion, true);
  assert.equal(porKey.integraciones.soloSeccion, true);
  assert.ok(porKey.configuraciones.match('/integraciones'), 'en Integraciones no se marca «Configuración del negocio»');
  assert.match(sinComentarios(leer('app/_components/Sidebar.tsx')), /USER_NAV\.filter\(\(it\) => (it\.key !== 'perfil' && )?!it\.soloSeccion && /, 'Integraciones vuelve al menú como un lugar más');
});

// ROTURAS (15/10/2026), una por vez y restaurando de memoria. Base: 8 pases, 0 fallos. Cada una dio 7/1:
//   Seguridad después de Notificaciones · `?tab=notif` a General · el `?tab=` viejo DESPUÉS de la entrada
//   por defecto · /perfil con `requireRolWs([])` · Integraciones marcando otra sección · un rótulo escrito
//   a mano en el teléfono · sin la ruta /perfil/seguridad → /m/cuenta/seguridad · «Olvidar todos» en la
//   vista general · los dispositivos sin numerar · Integraciones de vuelta en el menú (el filtro, y el
//   ítem sin `soloSeccion`) · el teléfono titulado «Perfil» · Integraciones con `maxDuration = 60`.
// ⚠️ La rotura del orden se armó mal la primera vez y dio VERDE (8/0): movía el redirect viejo justo
// antes del de la entrada por defecto, o sea al orden correcto. Rehecha poniéndolo después: 7/1.

test('«Notificaciones» UNA vez: ningún nombre se repite en el índice, y la del negocio vive en la de tu cuenta (25/10/2026)', () => {
  // Martín: «En settings no me gusta el diseño de "Perfil, Notificaciones, Instalar App, Equipo, Notificaciones..."»: estaba dos
  // veces, una por grupo, y las dos se marcaban a la vez.
  const indice = gruposAjustes(SECCIONES_CUENTA, seccionesNegocio(TODAS)).flatMap((g) => g.secciones);
  const nombres = indice.map((s) => s.label);
  assert.deepEqual(nombres.filter((n, i) => nombres.indexOf(n) !== i), [], 'un nombre repetido en el índice');
  const claves = indice.map((s) => s.key);
  assert.deepEqual(claves.filter((k, i) => claves.indexOf(k) !== i), [], 'dos secciones con la misma clave se marcan juntas');
  // La página de tu cuenta muestra lo del negocio (los canales WhatsApp y Email) a quien lo administra (25/10/2026: los canales
  // de Linear, app/perfil/NotificacionesPanel.tsx).
  const cuenta = sinComentarios(leer('app/perfil/notificaciones/page.tsx'));
  assert.match(cuenta, /const admin = rol === 'admin';/);
  assert.match(cuenta, /<NotificacionesPanel canal=\{canalDeUrl\(sp\.canal\)\} admin=\{admin\} /);
  const panel = sinComentarios(leer('app/perfil/NotificacionesPanel.tsx'));
  assert.match(panel, /\{admin && <FilaAjustes icono="whatsapp"/, 'WhatsApp del negocio a cualquiera del equipo');
  assert.match(panel, /\{admin && <FilaAjustes icono="email"/, 'Email del negocio a cualquiera del equipo');
  // Y la ruta vieja (ahí caen los avisos con `?tab=notif`) redirige ahí, con el `?ws=` del cliente, después del guard del negocio.
  const vieja = sinComentarios(leer('app/configuraciones/notificaciones/page.tsx'));
  assert.match(vieja, /await requireRolWs\(\[\], \{ nav: 'configuraciones' \}\);\s*redirect\(conLaQuery\('\/perfil\/notificaciones', await searchParams\)\);/);
});
