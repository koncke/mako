// =============================================================================
// La tab Chats ENTRA al producto: barra, capas, badge, links, API de MaKo y /admin/dev
// =============================================================================
// Una tab que existe y no se ve no da ningún síntoma: no rompe, no loguea, y nadie la abre nunca (lo
// dijo Martín de otra: «no veo la tab en la sidebar»). Este test fija las piezas de plataforma de Chats
// (14/10/2026, docs/diseno-chats.md §4) para que ninguna se pierda en silencio:
//
//   · la barra: primero en las conversaciones de Operate, con los roles de WhatsApp, y WhatsApp sigue
//     (hasta que Martín valide que Chats lo reemplaza, plano §6.1);
//   · las capas: Chats se ve EXACTAMENTE donde WhatsApp. No hay permisos por usuario que listen tabs
//     (userNavKeys es por capa): la paridad se fija en las dos listas de cada capa, así una capa nueva
//     que nombre `whatsapp` sin `chats` cae acá;
//   · el badge: el mismo número que WhatsApp, y la familia cerrada no lo cuenta dos veces;
//   · los links: el aviso de mensaje nuevo y los `?lead=` muertos van a /chats;
//   · la API de MaKo: el área `chats`, sin HTTP (conversaciones de personas) y sin ninguna operación que
//     mande un mensaje o asigne (eso ya existe en whatsapp y crm);
//   · /admin/dev: la ficha, la bitácora con el pedido LITERAL y su fila en la barra de dev.
//
// PROBADO ROMPIÉNDOLO (14/10/2026) con un arnés que aplica cada rotura, corre y restaura de memoria, contra
// una base en verde de 6 pass / 0 fail (con los archivos nuevos de los cuatro equipos en el índice: el barrido de
// `?lead=` enumera con git ls-files). Trece roturas, cada una 5 / 1, y cae el test que la cuida:
//   · el ítem `chats` DESPUÉS de `whatsapp` en nav.ts                      → la barra
//   · `rolesWs: ['setter']` en el ítem `chats`                             → la barra
//   · `'whatsapp'` sumado a la capa pm sin `chats`                         → las capas
//   · la decisión de la capa superadmin borrada del comentario de capas.ts → las capas
//   · `sumaDeContadores` sin el Set de fuentes (suma por tab)               → el badge
//   · el aviso de NotificationsProvider de vuelta a `/whatsapp?canal=…`     → los links
//   · `href={`/whatsapp?lead=${lead.id}`}` de vuelta en /crm/[id]/resumen   → los links
//   · `${APP_URL}/whatsapp?lead={id}` de vuelta en los DEEP_LINKS del doer  → los links
//   · `canales` con 'http' en las operaciones de chats.def.ts              → la API
//   · `reabrir_chat` renombrada `responder_chat`                           → la API
//   · el pedido de la bitácora resumido («Implementar la tab Chats como respond.io») → /admin/dev
//   · la fila `dev-chats` borrada de nav.ts                                → /admin/dev
//   · el área de /admin/dev en el grupo 'Onboarding'                       → /admin/dev
// Restaurado: 6 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FAMILIAS, ADMIN_NAV, TODOS_LOS_ITEMS, fuenteContador, sumaDeContadores } from '../app/_components/nav';
import { NOMBRES_ICONO } from '../app/_components/icons';
import { CAPAS_LISTA, navEnCapa, userNavEnCapa } from '../lib/capas';
import { AREAS, AREA_INFO, esAccion, esLectura } from '../lib/api-mako/tipos';
import { REGISTRO } from '../lib/api-mako/registro';
import { AREA_KEYWORDS } from '../lib/mako-intencion';
import { rutaChatsDeLead, rutaChatsDeWhatsapp, rutaChatsDeClave, RUTA_CHATS } from '../lib/chats-links';
import { decidirDesvio } from '../lib/movil-desvio';
import { areaDe } from '../app/admin/dev/areas';
import { registroDe } from '../app/admin/dev/registros';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la barra: Chats PRIMERO en las conversaciones de Operate, con los roles de WhatsApp, y WhatsApp sigue', () => {
  const operate = FAMILIAS.find((f) => f.key === 'operate');
  assert.ok(operate, 'no está la familia Operate');
  const bloque = operate!.bloques.find((b) => b.some((i) => i.key === 'chats'));
  assert.ok(bloque, 'Chats no está en ningún bloque de Operate');
  assert.equal(bloque![0].key, 'chats', 'Chats va PRIMERO en su bloque: es la bandeja de todos los días');
  const chats = bloque![0];
  const wa = bloque!.find((i) => i.key === 'whatsapp');
  assert.ok(wa, 'WhatsApp sale del menú sólo cuando Martín valide que Chats lo reemplaza (plano §6.1)');
  assert.equal(chats.href, RUTA_CHATS);
  assert.equal(chats.label, 'Chats');
  assert.deepEqual([...(chats.rolesWs ?? [])].sort(), [...(wa!.rolesWs ?? [])].sort(), 'los mismos roles que WhatsApp: es el mismo trabajo del setter');
  assert.ok((NOMBRES_ICONO as readonly string[]).includes(chats.icon), `el ícono «${chats.icon}» no existe: dibujaría un punto`);
  assert.ok(chats.match('/chats') && chats.match('/chats/x'), 'el match no marca la tab');
  assert.ok(!chats.match('/chatsx') && !chats.match('/whatsapp'), 'el match marca rutas ajenas');
  assert.equal(TODOS_LOS_ITEMS.filter((i) => i.key === 'chats').length, 1, 'la key chats está repetida');
  // En el teléfono cae en «se usa en la computadora», igual que /whatsapp (v2: /m/chats).
  assert.deepEqual(decidirDesvio('/chats'), { tipo: 'computadora' });
});

test('las capas: Chats se ve EXACTAMENTE donde WhatsApp (barra y menú de la foto)', () => {
  for (const c of CAPAS_LISTA) {
    assert.equal(navEnCapa('chats', c.id), navEnCapa('whatsapp', c.id), `capa ${c.id}: chats y whatsapp difieren en la barra`);
    assert.equal(userNavEnCapa('chats', c.id), userNavEnCapa('whatsapp', c.id), `capa ${c.id}: chats y whatsapp difieren en el menú de la foto`);
  }
  // La decisión de la capa superadmin está ESCRITA (AGENTS.md «Una tab nueva decide si entra en la capa superadmin»).
  assert.match(leer('lib/capas.ts'), /`chats` NO ENTRA/, 'falta la decisión escrita de la capa superadmin');
});

test('el badge: Chats muestra el número de WhatsApp, y la familia cerrada no lo cuenta dos veces', () => {
  assert.equal(fuenteContador('chats'), 'mensajes');
  assert.equal(fuenteContador('whatsapp'), 'mensajes');
  assert.equal(fuenteContador('crm'), 'crm');
  assert.equal(fuenteContador('general'), null);
  assert.equal(fuenteContador('toString'), null, 'una key que es una propiedad del prototipo no cuenta');
  const valor = (f: 'mensajes' | 'crm') => (f === 'mensajes' ? 7 : 3);
  assert.equal(sumaDeContadores(['general', 'chats', 'whatsapp', 'crm'], valor), 10, '7 mensajes + 3 del CRM, no 17');
  const sidebar = sinComentarios(leer('app/_components/Sidebar.tsx'));
  assert.match(sidebar, /sumaDeContadores\(/, 'el Sidebar no suma por fuente');
  assert.match(sidebar, /fuenteContador\(key\)/, 'el badge de cada tab no sale de fuenteContador');
});

test('los links: el aviso de mensaje nuevo y los ?lead= muertos van a /chats', () => {
  assert.equal(rutaChatsDeLead(412), '/chats?lead=412');
  assert.equal(rutaChatsDeClave('wa:ventas:5512345678'), '/chats?c=wa%3Aventas%3A5512345678');
  const u = new URL(rutaChatsDeWhatsapp('ventas', '5215512345678@s.whatsapp.net', 9), 'https://x');
  assert.equal(u.pathname, '/chats');
  assert.equal(u.searchParams.get('linea'), 'ventas');
  assert.equal(u.searchParams.get('chat'), '5215512345678@s.whatsapp.net');
  assert.ok(!new URL(rutaChatsDeWhatsapp(null, 'x@s.whatsapp.net'), 'https://x').searchParams.has('linea'), 'sin línea no va el parámetro vacío');

  const notif = sinComentarios(leer('app/_components/NotificationsProvider.tsx'));
  assert.match(notif, /router\.push\(rutaChatsDeWhatsapp\(/, 'el aviso de mensaje nuevo no lleva a Chats');
  assert.doesNotMatch(notif, /\/whatsapp\?canal=/, 'el aviso de mensaje nuevo sigue yendo a /whatsapp');

  // `/whatsapp?lead=` lo entendía la bandeja oficial, que se borró: la de empresa lo ignora y abre el primer chat
  // de la lista, el de OTRA persona. Ningún código lo arma (los comentarios que lo cuentan, sí pueden).
  // Las bitácoras y el historial de /admin/dev son PROSA (cuentan la trampa): se exceptúan como en sin-instagram.
  const PROSA = [/^app\/admin\/dev\/.*bitacora\.ts$/, /^app\/admin\/dev\/areas\.ts$/, /^app\/admin\/dev\/_historial\.generado\.ts$/];
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((x) => x.trim())
    .filter((f) => /\.(ts|tsx)$/.test(f) && !PROSA.some((r) => r.test(f)) && existsSync(join(RAIZ, f)));
  assert.ok(archivos.length > 500, `se revisaron ${archivos.length} archivos: el listado está mal`);
  const muertos = archivos.filter((f) => sinComentarios(leer(f)).includes('/whatsapp?lead='));
  assert.deepEqual(muertos, [], 'un link a /whatsapp?lead= abre el chat de otra persona: va a rutaChatsDeLead');
});

test('la API de MaKo: el área chats existe, lee sin HTTP, y no manda ni asigna', () => {
  assert.ok((AREAS as readonly string[]).includes('chats'));
  assert.equal(AREA_INFO.chats.ruta, RUTA_CHATS);
  const ops = REGISTRO.filter((d) => d.area === 'chats');
  assert.deepEqual(ops.map((d) => d.id).sort(), ['cerrar_chat', 'hilo_chat', 'listar_chats', 'posponer_chat', 'reabrir_chat']);
  for (const d of ops) {
    // Conversaciones de personas no salen por HTTP (AGENTS.md); las acciones tampoco: sin la lista no hay clave.
    assert.ok(!d.canales.includes('http'), `«${d.id}» sale por HTTP`);
    assert.equal(d.gating?.tab, 'chats', `«${d.id}» no está atada a la capa de la tab`);
    assert.equal(d.gating?.rolMinimo, undefined, `«${d.id}» pide admin, y closer y setter usan la tab`);
    assert.doesNotMatch(d.id, /instagram|zernio/, 'el canal es un parámetro, no la operación (tests/sin-instagram.test.ts)');
    assert.doesNotMatch(d.id, /enviar|mandar|responder|escribir|asignar/, `«${d.id}»: un canal propone y una persona confirma; asignar ya es asignar_closer_setter`);
    if (esAccion(d)) {
      assert.equal(d.confirmacion, 'chat', `«${d.id}» cambia el estado de UNA conversación: se confirma con un «sí»`);
      assert.equal(d.reversible, true);
    } else {
      assert.ok(esLectura(d), `«${d.id}» no es lectura ni acción`);
    }
  }
  // El runner existe para cada una (la paridad completa la fija tests/api-mako-registro.test.ts).
  const run = leer('lib/api-mako/areas/chats.run.ts');
  for (const d of ops) assert.match(run, new RegExp(`^  ${d.id}: \\{`, 'm'), `«${d.id}» sin runner`);
  // El doer la trae cuando le preguntan por chats, y no cuando hablan de una tarea.
  assert.ok(AREA_KEYWORDS.chats.test('¿quién me escribió hoy?'));
  assert.ok(AREA_KEYWORDS.chats.test('cerrá el chat de Ana'));
  assert.ok(AREA_KEYWORDS.chats.test('¿qué DMs tengo sin responder?'));
  assert.ok(!AREA_KEYWORDS.chats.test('reabrir la tarea del lunes'));
  assert.ok(!AREA_KEYWORDS.chats.test(''));
});

test('/admin/dev: la ficha del área, la bitácora con el pedido LITERAL y su fila en la barra de dev', () => {
  const area = areaDe('chats');
  assert.ok(area, 'falta el área chats en app/admin/dev/areas.ts');
  assert.equal(area!.familia, 'Operate');
  assert.equal(area!.grupo, 'Comunicación');
  assert.equal(area!.verEnApp, RUTA_CHATS);
  assert.equal(area!.hallazgos, 'hallazgos-comunicacion');

  const r = registroDe('chats');
  const prompt = r.bitacora.find((h) => h.tipo === 'prompt');
  assert.ok(prompt?.pedido, 'falta el hito del pedido');
  // El pedido es el de Martín TEXTUAL (AGENTS.md: «el tercer destino, que es el que se olvida»): se compara con el
  // del plano, que es la fuente, sin los «> » de la cita ni los saltos de línea.
  const plano = leer('docs/diseno-chats.md');
  const literal = /Pedido de Martín \(14\/10\/2026\), literal: «([\s\S]*?)»\.?\n/.exec(plano)?.[1];
  assert.ok(literal, 'el plano perdió el pedido literal');
  const plano1 = (s: string) => s.replace(/\n>\s?/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(plano1(prompt!.pedido!), plano1(literal!), 'el pedido de la bitácora no es el literal del plano');

  const fila = ADMIN_NAV.find((i) => i.key === 'dev-chats');
  assert.ok(fila, 'la bitácora existe y no tiene fila en la barra de dev: es una tab que NO SE VE');
  assert.equal(fila!.href, '/admin/dev/chats');
});
