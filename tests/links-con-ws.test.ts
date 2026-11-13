// =============================================================================
// Los links a MaKo que escribe el modelo salen con el `?ws=` del grupo (17/10/2026)
// =============================================================================
// Medido en producción (mako_doer_conv, última semana): en el ws13 6 de 10 links sin `?ws=`, en el ws15 4 de 4,
// en el ws18 1 de 1. Quien los toca mirando otro workspace los abre en el suyo. lib/links-con-ws.ts los
// completa en la salida del doer de WhatsApp (lib/mako-doer-in.ts).
//
// Probado rompiéndolo (17/10/2026), sobre los 3 de este archivo (base 3 / 0): sin cortar la cola de
// puntuación → 2 / 1; con el doer mandando `enviar` sin pasar por `linksConWs` → 2 / 1; pisando el `ws` que
// el link ya traía → 2 / 1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { conElDominioDeMaKo, linksConWs } from '../lib/links-con-ws';

const BASE = 'https://hola-mako.com';

test('los casos medidos en producción salen con su ?ws=', () => {
  assert.equal(linksConWs('Mírala acá: hola-mako.com/crm/2742', 15, BASE), 'Mírala acá: hola-mako.com/crm/2742?ws=15');
  assert.equal(linksConWs('👉 https://hola-mako.com/crm/2741.', 13, BASE), '👉 https://hola-mako.com/crm/2741?ws=13.');
  assert.equal(linksConWs('Conéctalo en hola-mako.com/integraciones?abrir=calendario.', 18, BASE), 'Conéctalo en hola-mako.com/integraciones?abrir=calendario&ws=18.');
  assert.equal(linksConWs('**1.** hola-mako.com/crm/2732\n\n**2.**', 13, BASE), '**1.** hola-mako.com/crm/2732?ws=13\n\n**2.**');
  assert.equal(linksConWs('(https://www.hola-mako.com/chats?lead=2723)', 13, BASE), '(https://www.hola-mako.com/chats?lead=2723&ws=13)');
});

test('lo que ya está bien, o no es una pantalla, no se toca', () => {
  // Un link que ya trae su ws manda sobre el contexto.
  assert.equal(linksConWs('hola-mako.com/crm/2741?ws=13', 15, BASE), 'hola-mako.com/crm/2741?ws=13');
  // La portada, otro dominio, sin workspace o sin texto.
  assert.equal(linksConWs('Visítanos: https://hola-mako.com/', 13, BASE), 'Visítanos: https://hola-mako.com/');
  assert.equal(linksConWs('https://otro.com/crm/1', 13, BASE), 'https://otro.com/crm/1');
  assert.equal(linksConWs('hola-mako.com/crm/1', null, BASE), 'hola-mako.com/crm/1');
  assert.equal(linksConWs('', 13, BASE), '');
});

test('el doer de WhatsApp pasa TODO lo que manda al grupo por linksConWs', () => {
  const src = readFileSync('lib/mako-doer-in.ts', 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /const enviar = \[\.\.\.partes, \.\.\.paraLaPersona\]\.map\(\(t\) => linksConWs\(t, wsData, APP_URL\)\);/);
});

// ── 27/10/2026: TODO lo que sale al grupo de un negocio, no sólo lo del modelo ─────────────────────────────────────────
// Leila (ws11) reenvió el aviso «Mira el resumen del lead: hola-mako.com/crm/482/resumen» y al abrirlo: «Este lead no es de
// esta cuenta». El link que arma el código (`linkApp`) lleva su `ws` desde el 06/10 (e307a6a6e); uno escrito a mano en una
// tarjeta («MaKo en WhatsApp», «Avisar al equipo») podía salir pelado. Ahora lo completa el envío al grupo
// (lib/mako-grupo.ts). Roturas (base 4 / 0): `enviarAlGrupoMaKo` sin `linksConWs` → 3 / 1; `enviarPartesAlGrupoMaKo` sin
// `partesConLinksDeWs` → 3 / 1; `partesConLinksDeWs` sin el pie de un archivo → 3 / 1.
test('el link de un aviso al grupo sale con el ws del negocio: el texto y el pie de un archivo', async () => {
  const { partesConLinksDeWs } = await import('../lib/links-con-ws');
  assert.equal(linksConWs('📋 Mira el resumen del lead: hola-mako.com/crm/482/resumen', 11, BASE), '📋 Mira el resumen del lead: hola-mako.com/crm/482/resumen?ws=11');
  const partes = partesConLinksDeWs([
    { tipo: 'texto', texto: 'Entró Ana: https://hola-mako.com/crm/482/resumen' },
    { tipo: 'audio', base64: 'x', mime: 'audio/ogg' },
    { tipo: 'media', base64: 'x', caption: 'El PDF: hola-mako.com/crm/482' },
  ], 11, BASE);
  assert.deepEqual(partes.map((p) => ('texto' in p ? p.texto : 'caption' in p ? p.caption : p.tipo)), [
    'Entró Ana: https://hola-mako.com/crm/482/resumen?ws=11', 'audio', 'El PDF: hola-mako.com/crm/482?ws=11',
  ]);
  // Los dos envíos al grupo de un negocio pasan por ahí.
  const src = readFileSync('lib/mako-grupo.ts', 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /const texto = linksConWs\(texto0, ws, APP_BASE_URL\);/);
  assert.match(src, /const r = await enviarPartesAJid\(jid, partesConLinksDeWs\(partes, ws, APP_BASE_URL\), d\);/);
});

// ── El dominio que el modelo inventa (28/10/2026, «hola-malo.com/crm/2761» a Código Inmobiliario, conv 1502) ─────────────
test('un dominio a una o dos letras del de MaKo se corrige; uno distinto de verdad o propio, no', () => {
  const B = 'https://hola-mako.com';
  assert.equal(conElDominioDeMaKo('la ficha: hola-malo.com/crm/2761.', B), 'la ficha: hola-mako.com/crm/2761.');
  assert.equal(conElDominioDeMaKo('https://www.holamako.com/integraciones', B), 'https://www.hola-mako.com/integraciones');
  assert.equal(conElDominioDeMaKo('entra a hola-mako.co/plan', B), 'entra a hola-mako.com/plan');
  for (const t of ['google.com/maps', 'https://codigoinmobiliario.com.ar/x', 'mako.com/y', 'hola-mako.com/crm/1', 'makodigital.app/z']) {
    assert.equal(conElDominioDeMaKo(t, B, ['makodigital.app']), t, `«${t}» se tocó`);
  }
  assert.equal(conElDominioDeMaKo('', B), '');
});

test('el turno real: lo que sale al grupo y lo que queda en la memoria llevan el dominio de MaKo', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_link-inventado-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 280_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@LINK@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const o = JSON.parse(linea.slice('@@LINK@@'.length));
  assert.equal(o.error, undefined, String(o.error));
  assert.deepEqual(o.salio, ['Aquí está la ficha: hola-mako.com/crm/2761?ws=13. Conecta Meta en https://www.hola-mako.com/integraciones?ws=13 y mira el local en google.com/maps. ¿Quieres que la revise?'], 'el dominio inventado o el voseo salieron al grupo');
  assert.deepEqual(o.memoria, ['Aquí está la ficha: hola-mako.com/crm/2761. Conecta Meta en https://www.hola-mako.com/integraciones y mira el local en google.com/maps. ¿Quieres que la revise?'], 'el dominio inventado o el voseo quedaron en el historial');
});

// ── Probado rompiéndolo (28/10/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   D1 `conElDominioDeMaKo` sin la distancia (no corrige nada)                          → fallan el 4 y el 5
//   D2 la distancia sin tope (corrige mako.com y google.com)                             → fallan el 4 y el 5
//   D3 el doer sin `conElDominioDeMaKo` en `partes`                                      → falla el 5

// ── En TÚ aunque el modelo vosee (11/11/2026, Joan: «Preguntás… ¿Querés que revise…?») ────────────────────────────────────
test('6. lo que MaKo escribe sale en tú; lo que va entre «…» no se toca', async () => {
  const { alTuteo } = await import('../lib/al-tuteo');
  assert.equal(alTuteo('Preguntás si puedo ver las campañas de Meta de tus clientes. ¿Querés que revise si Marcela conectó sus anuncios?'),
    'Preguntas si puedo ver las campañas de Meta de tus clientes. ¿Quieres que revise si Marcela conectó sus anuncios?');
  assert.equal(alTuteo('Mirá, fijate en Integraciones y decime si tenés la clave.'), 'Mira, fíjate en Integraciones y dime si tienes la clave.');
  // Lo que también es otra cosa queda (corrida 1039, 11/11/2026): «Abrí el ticket» es la respuesta fija del código (yo abrí), y
  // «Acá estoy» la de MaKo cuando le preguntan si está (tests/grupos-ops-turno.test.ts). «SOS» es una sigla.
  assert.equal(alTuteo('Abrí el ticket #43: El botón de pagar no anda.'), 'Abrí el ticket #43: El botón de pagar no anda.', 'pasó un pretérito de yo a una orden');
  assert.equal(alTuteo('Ayer elegí la plantilla y escribí el copy. Recibí tu audio.'), 'Ayer elegí la plantilla y escribí el copy. Recibí tu audio.', 'pasó un pretérito de yo a una orden');
  assert.equal(alTuteo('Acá estoy, por WhatsApp.'), 'Acá estoy, por WhatsApp.', '«acá» no es voseo');
  assert.equal(alTuteo('Mandaste un SOS. Sos el dueño.'), 'Mandaste un SOS. Eres el dueño.', 'tocó la sigla o dejó el «sos»');
  // Las dos respuestas reales a Joan del 11/11 a las 23:33 y 23:37 UTC (grupo de Código Inmobiliario).
  assert.equal(alTuteo('No entiendo a qué se refiere `ceo@sellersoficial.com`. ¿Es un email que querés que busque en los leads, una cuenta nueva que conectaste, o algo más?'),
    'No entiendo a qué se refiere `ceo@sellersoficial.com`. ¿Es un email que quieres que busque en los leads, una cuenta nueva que conectaste, o algo más?');
  assert.equal(alTuteo('No me queda claro qué cuenta habilitás.'), 'No me queda claro qué cuenta habilitas.');
  assert.equal(alTuteo('Además, Tomás habló en francés.'), 'Además, Tomás habló en francés.', 'tocó una palabra que no es voseo');
  assert.equal(alTuteo('Anoté tu pedido: «mandale el borrador a Juan, que vos sabés»'), 'Anoté tu pedido: «mandale el borrador a Juan, que vos sabés»', 'cambió las palabras de la persona');
  assert.equal(alTuteo('Las quieres hoy. Puedes verlas en el CRM.'), 'Las quieres hoy. Puedes verlas en el CRM.', 'tocó lo que ya estaba en tú');
  // 13/11/2026, la prueba del grupo de la app en el ws9: «Cargá el gasto de Meta en tu cuenta y agendá a los leads de esa campaña» salió así.
  assert.equal(alTuteo('Cargá el gasto de Meta en tu cuenta y agendá a los leads de esa campaña.'), 'Carga el gasto de Meta en tu cuenta y agenda a los leads de esa campaña.');
  assert.equal(alTuteo('Mandá el link, pasá la lista, agregá la nota, activá o pausá la campaña, dejá el resto y anotá la hora.'),
    'Manda el link, pasa la lista, agrega la nota, activa o pausa la campaña, deja el resto y anota la hora.');
  assert.equal(alTuteo('La agenda está cargada y la campaña quedó activa.'), 'La agenda está cargada y la campaña quedó activa.', 'tocó una palabra que no es voseo');
  assert.equal(alTuteo('Acacia y mirador quedan igual'), 'Acacia y mirador quedan igual', 'cortó una palabra por la mitad');
  assert.equal(alTuteo(''), '');
});

// Probado rompiéndolo (11/11/2026): el doer sin `alTuteo` en `partes` → falla «el turno real»; `alTuteo` dentro de «…» → falla el 6.
// Y tras la corrida 1039: volver a meter «abrí/elegí/escribí» o «acá» al diccionario, o tocar las mayúsculas → falla el 6.
