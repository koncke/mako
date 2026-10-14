// =============================================================================
// La ficha del lead, pedido del 06/10/2026 (seis puntos)
// =============================================================================
// 1. el desplegable de productos en el pop-up · 2. «Web» en lugar de «Dirección» ·
// 3. un solo botón de WhatsApp · 4. la foto de perfil (WhatsApp → email) · 5. sin
// «Reactivar» · 6. las sesiones de ENTREGA no son R2 (y los desplegables a la derecha).
//
// Lo puro se EJECUTA; el cableado se fija leyendo el fuente sin comentarios.
// PROBADO ROMPIÉNDOLO — el resultado de cada rotura está al lado de su test.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { esGrabacionDeEntrega } from '../lib/insights-llamada-reparto';
import { hrefDeWeb, candidatasDeFoto, venceFotoWa, numeroCanonico, fotosVigentes, leadsParaGuardarFoto } from '../lib/contacto-lead';
import { emojiDe } from './_emoji';

// Normalizado: LeadSheet.tsx es CRLF y los demás LF (AGENTS.md: todo test que lee fuente
// normaliza los saltos ANTES de buscar).
const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 6. Entrega ≠ R2 ───────────────────────────────────────────────────────────
// Los casos son los MEDIDOS en producción (lead #21 del cliente más grande y los tres
// cierres en el mismo día de la R2).
//
// PROBADO ROMPIÉNDOLO: con `>=` en lugar de `>`, cae el caso «el mismo día del cierre»;
// comparando contra `fecha_primer_pago`, cae el caso del #21.
test('una sesión POSTERIOR al cierre ganado es entrega; la R2 del día del cierre o después del pago, no', () => {
  const ganado = { estado_lead: 'ganado', fecha_cierre: '2026-06-09' };
  assert.equal(esGrabacionDeEntrega({ fecha: '2026-07-08' }, ganado), true, 'sesión de julio: entrega');
  assert.equal(esGrabacionDeEntrega({ fecha: '2026-06-09' }, ganado), false, 'R2 el MISMO día del cierre: venta');
  // El #21 pagó el apartado el 29/05 (en la R1) y su R2 fue el 01/06: sigue siendo venta.
  assert.equal(esGrabacionDeEntrega({ fecha: '2026-06-01' }, ganado), false, 'R2 posterior al primer pago: venta');
  // Sin ganar, o sin fecha de cierre, nada es entrega por fecha.
  assert.equal(esGrabacionDeEntrega({ fecha: '2026-07-08' }, { estado_lead: 'abierto', fecha_cierre: '2026-06-09' }), false);
  assert.equal(esGrabacionDeEntrega({ fecha: '2026-07-08' }, { estado_lead: 'ganado', fecha_cierre: null }), false);
  // La categoría del Closing Analyst, cuando existe, decide sola.
  assert.equal(esGrabacionDeEntrega({ fecha: null, categoria: 'entrega_servicio' }, { estado_lead: 'abierto' }), true);
  // Con hora adentro se compara el día.
  assert.equal(esGrabacionDeEntrega({ fecha: '2026-06-10T01:00:00Z' }, { estado_lead: 'ganado', fecha_cierre: '2026-06-09T00:00:00Z' }), true);
});

// PROBADO ROMPIÉNDOLO: con la guarda borrada del webhook, cae.
test('el webhook de Fathom NO engancha una sesión de entrega como R2 (y sale antes de aplicar nada)', () => {
  const w = sinComentarios(leer('app/api/webhooks/fathom/route.ts'));
  const guarda = w.indexOf('if (esGrabacionDeEntrega({ fecha }, lead)) {');
  assert.ok(guarda > 0, 'falta la guarda');
  assert.match(w.slice(guarda, guarda + 400), /return Response\.json\(\{ ok: true, ignored: true, reason: 'sesion de entrega' \}\)/);
  // Y va ANTES de escribir, de disparar el evento y de pagar el análisis.
  assert.ok(guarda < w.indexOf('applyFathomRecording(lead,'), 'la guarda tiene que ir antes de applyFathomRecording');
  assert.ok(guarda < w.indexOf("dispararEvento('reunion.ocurrio'"), 'y antes del evento de R2');
});

// ── 2. Web ────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO: sin el chequeo de esquema, `javascript:` pasa como link y cae.
test('la web se linkea con https:// si no trae esquema, y un esquema que no es http(s) NO se linkea', () => {
  assert.equal(hrefDeWeb('acme.com'), 'https://acme.com');
  assert.equal(hrefDeWeb('http://acme.com/x'), 'http://acme.com/x');
  assert.equal(hrefDeWeb('  https://acme.com  '), 'https://acme.com');
  assert.equal(hrefDeWeb('javascript:alert(1)'), null);
  assert.equal(hrefDeWeb('data:text/html,hola'), null);
  assert.equal(hrefDeWeb('dos palabras'), null);
  assert.equal(hrefDeWeb(''), null);
  assert.equal(hrefDeWeb(null), null);
});

test('«Dirección» se fue y «Web» se guarda, se audita, se deshace y tiene su columna', () => {
  const card = sinComentarios(leer('app/crm/lead-view/InfoPrincipalCard.tsx'));
  // ⚠️ DESDE EL 14/10/2026 «Dirección» VUELVE, pero APAGADA: Martín (13/10) la nombró entre lo que
  // «otros» negocios quieren ver en el Resumen personalizable. Lo del 06/10 sigue siendo lo que se ve
  // si nadie la prende (lib/resumen-ficha.ts, porDefecto false), y sólo se dibuja detrás de su interruptor.
  // Probado rompiéndolo: con la Dirección prendida por default, 1 fallo (17/1).
  assert.match(card, /direccion !== undefined && ve\('direccion'\) \? \[\s*<Row key="direccion" label="Dirección"/);
  assert.match(leer('lib/resumen-ficha.ts'), /\{ id: 'direccion', label: 'Dirección', grupo: 'Datos', porDefecto: false \}/);
  assert.match(card, /label="Web"[\s\S]{0,200}onGuardar=\{guardar\('web', web\)\}/);
  const leads = sinComentarios(leer('lib/leads.ts'));
  assert.match(leads, /\{ k: 'web', label: 'Web' \}/, 'el historial lo audita');
  assert.match(leads, /if \(meta\.web !== undefined\) payload\.web = meta\.web;/, 'saveLeadMeta lo escribe');
  const acc = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(acc, /case 'Web': await saveLeadMeta\(leadId, \{ web: v \}\); break;/, 'y se deshace desde el historial');
  assert.ok(existsSync('supabase/migrations/0194_lead_web.sql'));
  assert.match(leer('supabase/migrations/0194_lead_web.sql'), /alter table leads add column if not exists web text;/);
});

// ── 3. Un solo WhatsApp ───────────────────────────────────────────────────────
test('queda UN botón de WhatsApp en la ficha: el link al oficial se fue', () => {
  const card = sinComentarios(leer('app/crm/lead-view/InfoPrincipalCard.tsx'));
  assert.doesNotMatch(card, /\/whatsapp\?lead=/);
  assert.match(card, /<EnviarNoOficial /);
});

// ── 4. La foto ────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO: sin el `return []` de lo elegido, cae el primer assert.
test('la foto: lo elegido gana, después WhatsApp (con el ?ws=) y después el email; el email nunca va crudo', () => {
  assert.deepEqual(candidatasDeFoto({ avatarUrl: 'https://x/y.jpg', telefono: '5215555555555', fotoEmail: 'https://www.gravatar.com/avatar/abc?d=404&s=160' }, 7), []);
  const c = candidatasDeFoto({ telefono: '+52 1 55 5555 5555', fotoEmail: 'https://www.gravatar.com/avatar/abc?d=404&s=160' }, 7);
  assert.equal(c.length, 2);
  assert.match(c[0], /avatarimg=5215555555555/);
  assert.match(c[0], /[?&]ws=7/, 'sin el ?ws=, el super admin pediría la foto a SU línea');
  assert.match(c[1], /gravatar\.com\/avatar\/abc\?d=404/);
  assert.ok(c.every((u) => !u.includes('@')), 'un email crudo no viaja en una URL');
  assert.deepEqual(candidatasDeFoto({ telefono: '1234' }, null), [], 'menos de 8 dígitos no es un WhatsApp');
});

test('la cara va en la CABECERA de las dos puertas, y la tarjeta ya no dibuja otra', () => {
  // Desde el 12/10/2026 la cabecera de las dos puertas es UNA pieza (lead-view/CabeceraLead.tsx,
  // la portada con la cara cruzándola: punto 11), y la cadena de la foto entra por
  // `useCaraDelLead` (lead-view/CaraDelLead.tsx). Verificado rompiéndolo (12/10/2026): sin
  // `fotoEmail` en la cabecera del modal, 1 fallo.
  for (const f of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/LeadDetailBody.tsx']) {
    assert.match(sinComentarios(leer(f)), /<CabeceraLead\s+lead=\{lead\}\s+fotoEmail=\{fotoEmail\}/, `${f} no dibuja la cara`);
  }
  const cab = sinComentarios(leer('app/crm/lead-view/CabeceraLead.tsx'));
  assert.match(cab, /useCaraDelLead\(\{\s*telefono: lead\.telefono, fotoEmail, fotoGuardada: lead\.foto_auto_url,/, 'la cabecera no usa la cadena de la foto');
  assert.match(cab, /icono=\{icono\} foto=\{foto\}/, 'y lo que devuelve la cadena es lo que dibuja la marca');
  assert.doesNotMatch(sinComentarios(leer('app/crm/lead-view/InfoPrincipalCard.tsx')), /LeadFoto/);
  // La foto del email sale armada del server en las dos puertas.
  assert.match(sinComentarios(leer('app/crm/actions.ts')), /const fotoEmail = lead\.email\?\.trim\(\) \? urlGravatar\(lead\.email, 160\) : null;/);
  assert.match(sinComentarios(leer('app/crm/[id]/page.tsx')), /fotoEmail=\{lead\.email\?\.trim\(\) \? urlGravatar\(lead\.email, 160\) : null\}/);
});

// ── 1. El producto en el pop-up, con el NOMBRE del producto ─────────────────────
// ⚠️ DESDE EL MISMO 06/10 EL DESPLEGABLE YA NO MUEVE: dice en cuáles productos está el lead
// (mig 0207). Ya no recibe `funnelId` ni `productos`: recibe el estado de
// `useProductosDeLaFicha`, que toma los productos como FOTO. Lo nuevo lo fija
// tests/lead-funnel-ficha.test.ts; acá sigue lo de este pedido (que esté y en qué orden).
//
// PROBADO ROMPIÉNDOLO: con `nombre: f.nombre` de vuelta en la ruta, cae; y sin
// `foto: productos` en el pop-up, cae (1 fallo, 17 pases; medido el 06/10/2026).
test('el pop-up tiene el desplegable de producto, y las dos puertas muestran el nombre del PRODUCTO', () => {
  const sheet = sinComentarios(leer('app/crm/LeadSheet.tsx'));
  // ⚠️ Desde el 12/10/2026 producto y etapa son UN desplegable en árbol (punto 9: «Que sea solo 1
  // desplegable de "PROSPECCIÓN" que es el funnel, y que sea un desplegable tipo arbol»): el
  // funnel adentro tiene sus etapas. Lo que se ofrece lo fija tests/lead-funnel-ficha.test.ts.
  assert.match(sheet, /<FunnelYEtapa ficha=\{fichaProd\}[^>]*ariaLabel="Cambiar etapa o funnel"/, 'el desplegable del funnel y su etapa, uno solo');
  assert.doesNotMatch(sheet, /<ProductoDelLead|<EtapaEnProducto|ariaLabel="Cambiar etapa"/, 'volvieron los dos desplegables');
  assert.match(sheet, /useProductosDeLaFicha\(\{\s*leadId: lead\.id, casa: lead\.funnel_id, foto: productos,/, 'el desplegable se dibuja al toque con los productos que la ficha ya tiene');
  for (const f of ['app/crm/actions.ts', 'app/crm/[id]/page.tsx']) {
    // Con `nombreVisible` (lib/lead-funnel-reglas.ts) desde el 08/10/2026: la regla era una
    // copia en 11 lugares y ahora es una función, ejecutada en tests/inbox-agregar-al-crm.test.ts.
    assert.match(sinComentarios(leer(f)), /nombre: nombreVisible\(f\)/, `${f} muestra «Funnel principal»`);
  }
});

// ── 5. Sin «Reactivar» ─────────────────────────────────────────────────────────
// ⚠️ EL 13/10/2026 MARTÍN PIDIÓ IGNORAR CADA DATO DESDE LA FICHA («en ese desplegable... otro
// ícono para "ignorar"»), así que «ignorado» ya no está prohibido acá. Lo que sigue prohibido es
// el «Reactivar» del 06/10: el renglón no cambia de botón, dice «Ver →» siempre.
test('el aviso de datos sin marcar es siempre el mismo: sin «Reactivar»', () => {
  const card = sinComentarios(leer('app/crm/lead-view/DatosSinMarcarCard.tsx'));
  assert.doesNotMatch(card, /Reactivar|onReactivar/);
  for (const f of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/LeadDetailBody.tsx']) {
    assert.match(sinComentarios(leer(f)), /<DatosSinMarcarCard leadId=\{lead\.id\} datos=\{datos\} onSolucionar=\{solucionarDato\}/);
  }
});

// ── 6b. Los desplegables a la DERECHA ─────────────────────────────────────────
// Desde el 12/10/2026 la cabecera de las dos puertas es `CabeceraLead`, y la columna de la derecha
// (el funnel arriba, «N sin marcar» debajo) es su `.cl-acc`: pegada a la derecha con `margin-left:
// auto` y sin ceder (`flex:none`); el que cede es el texto (`.cd-txt`, CabeceraDetalle).
// PROBADO ROMPIÉNDOLO (12/10/2026): sin el `margin-left:auto` de `.cl-acc`, cae (1 fallo).
test('en las dos puertas, el bloque del nombre cede y la columna del funnel queda a la derecha', () => {
  const cab = leer('app/crm/lead-view/CabeceraLead.tsx');
  assert.match(cab, /\.cl-acc\{ display:flex; flex-direction:column; align-items:flex-end; gap:8px; flex:none; margin-left:auto; \}/);
  assert.match(sinComentarios(cab), /acciones=\{acciones \? <div className="cl-acc">\{acciones\}<\/div> : undefined\}/);
  for (const f of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/LeadDetailBody.tsx']) {
    assert.match(sinComentarios(leer(f)), /acciones=\{\s*<>\s*<FunnelYEtapa /, `${f}: el desplegable no va en la columna de la derecha`);
  }
});

// ── Sin emoji en la pantalla ───────────────────────────────────────────────────
// «No pongas emoji, siempre iconos para que sea más profesional» (Martín, 06/10/2026, en
// el chat de Ads Manager). Se mira el ARCHIVO entero sin comentarios —no un bloque—, que
// es la lección de ese mismo chat: el guard que leía sólo el bloque conocido dejó pasar
// cuatro. `✓` y `✕` quedan permitidos: son tipografía monocroma y los usa todo el repo.
//
// El rango vive en tests/_emoji.ts, compartido con el guard de Ads Manager: había tres
// rangos distintos en dos archivos, y el flojo no cazaba `⚠` (26A0).
//
// PROBADO ROMPIÉNDOLO: con la planta de vuelta en «Nutrición», y con un `⚠` en el mismo
// lugar, cae (10 / 1 las dos veces).
test('las pantallas de la ficha y de las campañas no tienen emoji (íconos o nada)', () => {
  const archivos = [
    'app/crm/LeadSheet.tsx', 'app/crm/[id]/page.tsx', 'app/crm/[id]/LeadDetailBody.tsx',
    'app/crm/lead-view/InfoPrincipalCard.tsx', 'app/crm/lead-view/DatosSinMarcarCard.tsx',
    'app/crm/lead-view/CaraDelLead.tsx', 'app/crm/CampanasModal.tsx', 'app/crm/CampanasDelProducto.tsx',
    // La cabecera y el desplegable en árbol (12/10/2026).
    'app/crm/lead-view/CabeceraLead.tsx', 'app/crm/lead-view/ProductoDelLead.tsx', 'app/crm/lead-view/AnalystDelLead.tsx',
  ];
  const malos = archivos.map((f) => ({ f, e: emojiDe(leer(f)) })).filter((x) => x.e).map((x) => `${x.f}: ${x.e!.join(' ')}`);
  assert.deepEqual(malos, []);
});

// ── La foto GUARDADA (mig 0195, «Sí, guarda las fotos sin problemas») ───────────
const oe = (ms: number) => Math.floor(ms / 1000).toString(16);
const AHORA = Date.parse('2026-10-06T12:00:00Z');
const urlWa = (venceMs: number, n = 1) => `https://pps.whatsapp.net/v/t61/foto${n}.jpg?oh=x&oe=${oe(venceMs)}`;

test('el vencimiento de una foto de WhatsApp sale de su `oe` (segundos en hex)', () => {
  assert.equal(venceFotoWa(urlWa(AHORA + 5 * 86_400_000)), Math.floor((AHORA + 5 * 86_400_000) / 1000) * 1000);
  assert.equal(venceFotoWa('https://pps.whatsapp.net/x.jpg'), null);
  assert.equal(venceFotoWa('no es una url'), null);
});

test('52·1·10 y 52·10 son la MISMA línea', () => {
  assert.equal(numeroCanonico('5215512345678'), '525512345678');
  assert.equal(numeroCanonico('+52 55 1234 5678'), '525512345678');
  assert.equal(numeroCanonico('123'), null);
});

// PROBADO ROMPIÉNDOLO: sin la marca de 'ambigua', la colisión le pone a un lead la foto de
// otro número y cae; sin el filtro de vencidas, entra la URL muerta y cae.
test('fotos vigentes: sin vencidas, sin colisiones de número, y entre dos de la misma línea la que vence más tarde', () => {
  const f = fotosVigentes([
    { telefono: '5215512345678', fotoUrl: urlWa(AHORA + 2 * 86_400_000, 1) },
    { telefono: '525512345678', fotoUrl: urlWa(AHORA + 9 * 86_400_000, 2) },   // misma línea, vence después
    { telefono: '5219990000001', fotoUrl: urlWa(AHORA - 3600_000, 3) },         // vencida
    { telefono: '525511112222', fotoUrl: urlWa(AHORA + 5 * 86_400_000, 4) },    // dos números distintos
    { telefono: '15511112222', fotoUrl: urlWa(AHORA + 5 * 86_400_000, 5) },     // con los mismos 10 últimos
  ], AHORA);
  assert.equal(f.get('5512345678'), urlWa(AHORA + 9 * 86_400_000, 2));
  assert.equal(f.has('9990000001'), false, 'una foto vencida no se puede bajar');
  assert.equal(f.has('5511112222'), false, 'dos personas bajo la misma clave: no se elige ninguna');
});

test('se guarda la foto de quien no tiene copia o la tiene vieja (30 días), y de nadie más', () => {
  const fotos = new Map([['5512345678', 'https://pps.whatsapp.net/a.jpg']]);
  const leads = [
    { id: 1, telefono: '+52 55 1234 5678', foto_auto_at: null },
    { id: 2, telefono: '5512345678', foto_auto_at: new Date(AHORA - 3 * 86_400_000).toISOString() },  // reciente
    { id: 3, telefono: '5512345678', foto_auto_at: new Date(AHORA - 40 * 86_400_000).toISOString() }, // vieja
    { id: 4, telefono: '5599999999', foto_auto_at: null },                                            // sin foto
  ];
  assert.deepEqual(leadsParaGuardarFoto(leads, fotos, AHORA).map((x) => x.id), [1, 3]);
});

test('la ficha usa la foto GUARDADA antes que WhatsApp en vivo y que el email; lo elegido sigue ganando', () => {
  const c = candidatasDeFoto({ fotoGuardada: 'https://x.supabase.co/storage/v1/object/public/avatars/leads/1/9.jpg?v=1', telefono: '5215555555555', fotoEmail: 'https://www.gravatar.com/avatar/abc?d=404' }, 1);
  assert.equal(c.length, 3);
  assert.match(c[0], /\/avatars\/leads\/1\/9\.jpg/);
  assert.deepEqual(candidatasDeFoto({ avatarUrl: 'https://x/elegida.jpg', fotoGuardada: 'https://x/auto.jpg' }, 1), []);
});

test('el cron escribe en `foto_auto_url` —nunca en la cara elegida— y está agendado', () => {
  const lib = sinComentarios(leer('lib/fotos-contacto.ts'));
  assert.match(lib, /update\(\{ foto_auto_url: url, foto_auto_at:/);
  assert.doesNotMatch(lib, /avatar_url|icono/);
  assert.match(lib, /AbortSignal\.timeout\(8000\)/, 'una descarga colgada no puede llevarse el cron');
  const cron = JSON.parse(leer('vercel.json')).crons as { path: string }[];
  assert.ok(cron.some((c) => c.path === '/api/cron/fotos-contacto'), 'sin la entrada en vercel.json el cron no corre nunca');
  assert.ok(existsSync('supabase/migrations/0195_lead_foto_guardada.sql'));
  // Desde el 12/10/2026 la cara la dibuja UNA cabecera para las dos puertas (lead-view/CabeceraLead.tsx).
  assert.match(sinComentarios(leer('app/crm/lead-view/CabeceraLead.tsx')), /fotoGuardada: lead\.foto_auto_url/, 'la cabecera no pasa la foto guardada');
});

// ── La cabecera del pop-up: el funnel ARRIBA del aviso, a la derecha ────────────
// Hasta el 12/10/2026 era una fila de controles debajo de la cabecera (producto, etapa y el aviso a
// la derecha). Martín (punto 9): «Que sea solo 1 desplegable de "PROSPECCIÓN"... Y que ese
// desplegable esté arriba de donde hoy está "1 sin marcar"». El desplegable va primero en la columna
// de la derecha y el aviso debajo; el ícono del cubo lo pone el desplegable.
// PROBADO ROMPIÉNDOLO (12/10/2026): con el aviso antes del desplegable en el pop-up caen 2 acá (éste y
// el de la columna de la derecha, que pide el desplegable primero) y 1 en tests/crm-ficha-y-selector.
test('el pop-up pone el funnel arriba y el aviso debajo, en la columna de la derecha de la cabecera', () => {
  const s = sinComentarios(leer('app/crm/LeadSheet.tsx'));
  const iDrop = s.indexOf('<FunnelYEtapa');
  const iAviso = s.indexOf('<DatosSinMarcarCard');
  assert.ok(iDrop >= 0 && iAviso > iDrop, 'el desplegable va ARRIBA del aviso');
  assert.match(sinComentarios(leer('app/crm/lead-view/ProductoDelLead.tsx')), /icono=\{<span title="Funnel"[^>]*><IconoProducto \/><\/span>\}/, 'el desplegable lleva el ícono del cubo');
  assert.doesNotMatch(s, /<button onClick=\{onClose\}/, 'volvió el botón de cerrar propio: la cruz va sobre la portada');
});
