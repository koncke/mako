// Las dos piezas que deciden si una notificación se ve/suena y cómo se llama la
// pestaña. Las dos son lógica pura y las dos fallan en silencio si se rompen: un
// pop-up que deja de aparecer no tira ningún error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIF_IN_APP, AVISOS_WA_EN_VIVO, REPORTES, DEFAULT_IN_APP,
  inAppActivo, normalizarInApp, normalizarDestinatarios,
} from '../lib/notif-catalogo';
import { tituloDe } from '../lib/titulo-tab';

// ── Pop-up y sonido ───────────────────────────────────────────────────────────
test('sin preferencias cargadas todo se ve y suena', () => {
  // Vale un pop-up de más antes que perderse un mensaje mientras carga.
  assert.equal(inAppActivo(null, 'wa-mensaje', 'popup'), true);
  assert.equal(inAppActivo(null, 'wa-mensaje', 'sonido'), true);
});

test('el interruptor general apaga todo sin borrar el ajuste de cada uno', () => {
  // ⚠️ El ejemplo es `wa-plantilla` y no `wa-mensaje`: el mensaje de WhatsApp DEJÓ
  // DE SONAR el 27/09/2026 (tanda 3 de la fricción del CRM), así que su `sonido`
  // queda forzado en false por el catálogo y ya no sirve para probar que el
  // interruptor general no pisa el ajuste individual. La plantilla resuelta sí suena:
  // es un evento puntual que se espera, no uno con cada mensaje que entra.
  const p = normalizarInApp({ sonido: false });
  assert.equal(inAppActivo(p, 'wa-plantilla', 'sonido'), false);
  assert.equal(inAppActivo(p, 'wa-plantilla', 'popup'), true, 'el pop-up es independiente del sonido');
  // El ajuste individual sigue en true: al volver a prender el general, vuelve.
  assert.equal(p.items['wa-plantilla'].sonido, true);
});

test('se puede apagar el sonido de UNA notificación y dejar su pop-up', () => {
  const p = normalizarInApp({ items: { 'wa-mensaje': { sonido: false } } });
  assert.equal(inAppActivo(p, 'wa-mensaje', 'sonido'), false);
  assert.equal(inAppActivo(p, 'wa-mensaje', 'popup'), true);
  assert.equal(inAppActivo(p, 'wa-plantilla', 'sonido'), true, 'no toca a las demás');
});

test('lo que nunca suena queda en false aunque venga true de la base', () => {
  // Era `ia-uso`, que se fue del catálogo con su pop-up el 27/09/2026. El caso que
  // prueba sigue existiendo y ahora lo representa el mensaje de WhatsApp: una fila
  // vieja en la base puede decir `sonido: true` y el catálogo manda.
  const p = normalizarInApp({ items: { 'wa-mensaje': { sonido: true } } });
  assert.equal(p.items['wa-mensaje'].sonido, false);
});

test('normalizar completa todas las notificaciones del catálogo', () => {
  const p = normalizarInApp(undefined);
  for (const n of NOTIF_IN_APP) assert.ok(p.items[n.id], `falta ${n.id}`);
  assert.equal(p.popup, true);
  assert.equal(p.sonido, true);
});

test('el default no apaga nada', () => {
  assert.equal(DEFAULT_IN_APP.popup, true);
  assert.equal(DEFAULT_IN_APP.sonido, true);
});

// ── El mapa no puede tener ids repetidos ─────────────────────────────────────
// Dos filas con el mismo id serían dos interruptores para lo mismo: uno pisa al
// otro y el usuario ve uno prendido y otro apagado.
test('no hay ids repetidos en el mapa de notificaciones', () => {
  const ids = [...NOTIF_IN_APP.map((n) => n.id), ...AVISOS_WA_EN_VIVO.map((a) => a.id), ...REPORTES.map((r) => r.key)];
  assert.equal(new Set(ids).size, ids.length);
});

// ── Destinatarios (varios números y varios emails por negocio) ───────────────
test('el mismo número escrito de dos formas entra una sola vez', () => {
  // "+54 9 376 467-3479" y "5493764673479" son la misma persona: si entraran dos
  // veces, recibiría cada reporte duplicado.
  const d = normalizarDestinatarios({ telefonos: ['+54 9 376 467-3479', '5493764673479'] });
  assert.deepEqual(d.telefonos, ['5493764673479']);
});

test('el orden se conserva: el primero es el principal', () => {
  // Con el primero se crea el grupo de WhatsApp, así que no se puede reordenar.
  const d = normalizarDestinatarios({ telefonos: ['5491100000000', '5493764673479'] });
  assert.equal(d.telefonos[0], '5491100000000');
});

test('lo inválido se descarta en vez de guardarse roto', () => {
  const d = normalizarDestinatarios({ telefonos: ['123', ''], emails: ['no-es-mail', 'a@b'] });
  assert.deepEqual(d.telefonos, []);
  assert.deepEqual(d.emails, []);
});

test('los emails se comparan sin mayúsculas ni espacios', () => {
  const d = normalizarDestinatarios({ emails: ['  Hola@Mako.com ', 'hola@mako.com'] });
  assert.deepEqual(d.emails, ['hola@mako.com']);
});

test('sin destinatarios no explota', () => {
  assert.deepEqual(normalizarDestinatarios({}), { telefonos: [], emails: [] });
});

// ── Título de la pestaña ──────────────────────────────────────────────────────
test('el título lleva la sección donde estás parado', () => {
  assert.equal(tituloDe('/crm'), 'MaKo - CRM');
  assert.equal(tituloDe('/whatsapp'), 'MaKo - WhatsApp');
  // «Configuración del negocio» desde el 15/10/2026 (lib/ajustes-secciones.ts); Seguridad es de «Tu cuenta».
  assert.equal(tituloDe('/configuraciones'), 'MaKo - Configuración del negocio');
  assert.equal(tituloDe('/perfil/seguridad'), 'MaKo - Tu cuenta');
});

test('una subruta hereda el nombre de su sección', () => {
  assert.equal(tituloDe('/crm/123'), 'MaKo - CRM');
});

test('/marketing/salud gana sobre /marketing', () => {
  assert.equal(tituloDe('/marketing'), 'MaKo - Dashboard');
  assert.equal(tituloDe('/marketing/salud'), 'MaKo - Salud de Meta');
});

test('el login no anuncia sección', () => {
  assert.equal(tituloDe('/login'), 'MaKo');
});

test('una ruta sin entrada en el menú igual queda legible', () => {
  assert.equal(tituloDe('/algo-nuevo'), 'MaKo - Algo nuevo');
});

test('la marca no se repite cuando ya está en el nombre de la sección', () => {
  // "MaKo - WhatsApp de MaKo" se leía dos veces el producto.
  // Desde el 16/10/2026 /mako es el Second Brain (el chat con MaKo): su título es el de la entrada de la barra. El
  // NOMBRE del proyecto en lib/plan-proyectos-catalogo.ts sigue siendo «Feature: Preguntale a MaKo»: ese es una CLAVE
  // guardada en la base, no copy, y renombrarlo huérfana las tarjetas.
  assert.equal(tituloDe('/mako'), 'MaKo - Second Brain', 'sin la marca en el nombre, la pestaña la suma (una vez)');
  assert.equal(tituloDe('/agencia'), 'WhatsApp de MaKo');
});

test('las sub-rutas de /admin no se comen el título entre sí', () => {
  // El item de Clientes excluye a mano cada sub-ruta de /admin para que lean su
  // propio nombre. Si algo más general se evalúa antes, ese esfuerzo se anula y
  // todas se leen «Clientes».
  //
  // OJO: la fábrica de guiones ya NO se llama «Guiones». /admin/guiones redirige
  // a /admin/dev/ads-writer y el título sale del item de Dev, que se llama como
  // la feature. Este test decía 'MaKo - Guiones' y fue lo único que avisó del
  // renombre — el pre-push corre tipos, no tests.
  assert.equal(tituloDe('/admin/guiones'), 'MaKo - Ads Writer');
  // ⚠️ Desde el 28/09/2026 /admin es un REDIRECT a /customer-success y ya no tiene
  // item propio, así que cae al fallback («Admin», el primer segmento). Está bien:
  // es una ruta de paso, y el nombre que importa lo lee el destino.
  assert.equal(tituloDe('/admin'), 'MaKo - Admin');
  assert.notEqual(tituloDe('/admin'), tituloDe('/admin/guiones'));
  assert.notEqual(tituloDe('/admin'), tituloDe('/admin/dev/semaforo'));
});

test('una sub-ruta de /admin SIN item propio no se lee «Clientes»', () => {
  // El `match` del item Clientes era una lista de exclusiones —«/admin menos
  // guiones, menos ui, menos docs, menos dev, menos agente»— y el 27/09/2026 ya
  // estaba VIEJA: no excluía /admin/friccion, que existe desde ese mismo día, así
  // que esa pantalla leía «MaKo - Clientes» y encima prendía la fila equivocada en
  // la barra. Una condición negativa se queda vieja sola: cada ruta nueva entra en
  // la lista de las no contempladas sin que nada avise.
  //
  // Ahora es `p === '/admin'`, en positivo, y esto es lo que impide que vuelva.
  // Una ruta sin item propio cae al fallback («Admin», el primer segmento), que es
  // lo correcto: mejor el nombre de la sección que el de otra pantalla.
  //
  // ⚠️ Probado ROMPIÉNDOLO: volviendo el match a la forma vieja
  //   (p) => starts('/admin')(p) && !starts('/admin/guiones')(p) && …
  // el archivo pasa de 20/20 a **19 pases y 1 FALLO**, y el fallo es éste: corta
  // en el primer assert, con 'MaKo - Clientes' donde tenía que decir 'MaKo -
  // Admin'. Uno solo, y alcanza: es el único test del repo capaz de distinguir
  // una lista de exclusiones vieja de una al día.
  assert.equal(tituloDe('/admin/friccion'), 'MaKo - Admin');
  assert.equal(tituloDe('/admin/una-ruta-que-todavia-no-existe'), 'MaKo - Admin');
  // Y la que SÍ tiene item propio sigue leyendo el suyo.
  assert.equal(tituloDe('/admin/copywriting'), 'MaKo - Copywriting');
});
