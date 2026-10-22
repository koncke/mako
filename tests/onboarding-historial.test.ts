// =============================================================================
// Las preguntas del arranque se GUARDAN con su respuesta y se ven en el Ops Center (21/10/2026, Florencia, ws21)
// =============================================================================
// Medido en producción el 21/10 (Chrome de Martín, super admin, /second-brain?ws=21): el ws21 tiene 0 chats propios; su
// Ops Center muestra «Mi oferta», la proyección de su conversación de Offer (sesión 14), y ésa SÍ trae las preguntas de
// MaKo. Lo que no estaba en ningún lado era el ARRANQUE (el nombre, el negocio, el PDF, la fase, el CRM, cómo llegó, qué
// resolver primero, el teléfono): ni las preguntas ni las respuestas. La conversación empezaba en «¿Tienes un documento
// de tu oferta…?». Y el documento que ella mandó como respuesta (fila 3, sin texto) tampoco se veía.
// lib/onboarding-historial.ts: lo que la pantalla dibuja se anota la primera vez que se ve, y la proyección y el chat
// «Onboarding» lo juntan por hora con la conversación de Offer.
//
// ROTURAS (21/10/2026, con tests/second-brain-offer.test.ts; base 17/0, una por vez y restaurada, arnés romper.mjs del
// scratchpad del chat «Onboarding»):
//   · `conLoNuevo` por id sin el texto (una respuesta corregida no se anota) → 16/1 (1)
//   · lo de antes de Offer anotado tarde con la hora de ahora (sin `primeroDeOffer`) → 15/2 (2, 5)
//   · `leerHistorial` que da [] con lo ilegible (y se escribe encima) → 16/1 (3)
//   · `unirConOffer` con la conversación de Offer antes que todo el historial → 14/3 (4, 5, 6)
//   · `mensajesDeOffer` que vuelve a tirar el adjunto sin texto → 16/1 (7)
//   · el aviso de «Reconstruido» para cualquiera, en la regla → 16/1 (7) · en el índice → 16/1 (9)
//   · la ruta que no anota al contestar (`vistaArranque()` en `listo`) → 16/1 (8)
//   · anotar con la fase sin leer (sin `!h.faseCaida`) → 16/1 (8)
//   · `hiloDeOffer` que pega el historial a CUALQUIER conversación (sin `sesionDelArranque`) → 16/1 (9)
//   · el chat «Onboarding» armado otra vez del estado de hoy (`[...antes, …, ...despues]`) → 16/1 (10)
//   · el script que reconstruye encima de un historial que ya existe → 16/1 (11)
// Y el audio (Martín, 21/10 ~23:00: «No se reproducen sus audios, se ponen la transcripción»), base 20/0:
//   · `mensajesDeOffer` que tira el audio → 19/1 (12) · el índice que pasa el mensaje guardado, con su path → 19/1 (12)
//   · la copia sin el audio (`mensajesDelHilo`) → 19/1 (13) · el bloque sin validar el id del mensaje → 19/1 (13)
//   · el insert del chat «Onboarding» sin `bloques` → 19/1 (13) · la lectura del chat sin el audio → 19/1 (13)
//   · el título «Onboarding» también para quien tiene su copia → 19/1 (14)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mensajesDeArranque, mensajesDelHilo, NOTA_DE_VOZ, type EstadoArranque, type HechosArranque, type MensajeArranque } from '../lib/onboarding-arranque';
import { conLoNuevo, leerHistorial, sesionDelArranque, unirConOffer, type MensajeHistorial } from '../lib/onboarding-historial';
import { AVISO_RECONSTRUIDO, mensajesDeOffer } from '../lib/chat-mako-reglas';
import { audioDeBloques, bloqueDeAudio, sanearBloques } from '../lib/chat-mako-bloques';
import { bloquesGuardados } from '../lib/chat-bloques';

const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8').replace(/\r\n/g, '\n');
const iso = (t: number) => new Date(t).toISOString();
const vistaDe = (antes: MensajeArranque[], despues: MensajeArranque[] = []) => ({ antes, despues });
const m = (id: string, de: 'mako' | 'yo', texto: string): MensajeArranque => ({ id, de, texto });

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: '', nombreWorkspace: '', faseGuardada: false, canalNegocio: null, loQueVende: false,
  conCrm: true, conTelefono: true, terminado: false,
};
const FASE = { canal: 'llamadas' as never, faseResp: Array.from({ length: 20 }, () => 0) };

test('1. se anota lo nuevo, en orden y una sola vez; una respuesta que cambia es otro mensaje', () => {
  const v1 = vistaDe([m('arr-nombre', 'mako', '¿Cómo te llamas?'), m('arr-nombre-r', 'yo', 'Hola, soy Ana'), m('arr-nombre-ok', 'mako', '¿Te llamo «Ana»?')]);
  const h1 = conLoNuevo([], v1, { ahora: 1_000 })!;
  assert.deepEqual(h1.map((x) => [x.id, x.texto, x.at]), [
    ['arr-nombre', '¿Cómo te llamas?', iso(1_000)], ['arr-nombre-r', 'Hola, soy Ana', iso(1_001)], ['arr-nombre-ok', '¿Te llamo «Ana»?', iso(1_002)],
  ]);
  assert.equal(conLoNuevo(h1, v1, { ahora: 2_000 }), null, 'lo mismo otra vez no anota nada');
  // Confirmó: la pantalla dibuja ahora «Ana» como su respuesta, y lo que escribió primero NO se pierde.
  const v2 = vistaDe([m('arr-nombre', 'mako', '¿Cómo te llamas?'), m('arr-nombre-r', 'yo', 'Ana'), m('arr-negocio', 'mako', 'Un gusto, Ana. ¿Cómo se llama tu negocio?')]);
  const h2 = conLoNuevo(h1, v2, { ahora: 1_500 })!;
  assert.deepEqual(h2.map((x) => x.texto), ['¿Cómo te llamas?', 'Hola, soy Ana', '¿Te llamo «Ana»?', 'Ana', 'Un gusto, Ana. ¿Cómo se llama tu negocio?']);
  assert.ok(Date.parse(h2[3].at) > Date.parse(h1[2].at), 'siempre después de lo anotado');
  assert.equal(conLoNuevo([], vistaDe([m('x', 'mako', '   ')]), { ahora: 1 }), null, 'lo vacío no se anota');
});

test('2. lo de ANTES de Offer que se anota tarde va antes de su primer mensaje; lo de después, ahora', () => {
  const v = vistaDe([m('arr-nombre', 'mako', 'Hola'), m('arr-nombre-r', 'yo', 'Ana')], [m('arr-pdf', 'mako', '¿Está correcto?'), m('arr-pdf-r', 'yo', 'Sí')]);
  const h = conLoNuevo([], v, { ahora: 9_000, primeroDeOffer: 5_000, reconstruido: true })!;
  assert.deepEqual(h.map((x) => x.at), [iso(4_998), iso(4_999), iso(9_000), iso(9_001)]);
  assert.ok(h.every((x) => x.reconstruido === true));
  // Sin la conversación empezada (el caso de todos los días), todo con la hora de ahora.
  assert.deepEqual(conLoNuevo([], v, { ahora: 9_000, primeroDeOffer: null })!.map((x) => x.at), [iso(9_000), iso(9_001), iso(9_002), iso(9_003)]);
  assert.equal(conLoNuevo([], v, { ahora: 9_000 })![0].reconstruido, undefined, 'lo anotado en vivo no lleva la marca');
});

test('3. el historial guardado: lo que no se entiende no se pisa', () => {
  assert.deepEqual(leerHistorial(null), []);
  assert.deepEqual(leerHistorial(''), []);
  assert.equal(leerHistorial('{roto'), null, 'ilegible: null, y anotarHistorial no escribe encima');
  assert.equal(leerHistorial('[1,2]'), null);
  assert.deepEqual(leerHistorial(JSON.stringify({ mensajes: [
    { id: 'a', de: 'mako', texto: 'Hola', at: iso(1) }, { id: 'b', de: 'otro', texto: 'x', at: iso(2) }, { id: 'c', de: 'yo', texto: 'Ana', at: 'ayer' },
    { id: 'd', de: 'yo', texto: 'Ana', at: iso(3), reconstruido: true },
  ] })), [{ id: 'a', de: 'mako', texto: 'Hola', at: iso(1) }, { id: 'd', de: 'yo', texto: 'Ana', at: iso(3), reconstruido: true }]);
  assert.equal(sesionDelArranque(JSON.stringify({ sesionId: 14 })), 14);
  assert.equal(sesionDelArranque(JSON.stringify({ sesionId: '14' })), null);
  assert.equal(sesionDelArranque('no'), null);
});

test('4. un onboarding de punta a punta, como pasa: cada pregunta con su respuesta, y Offer en el medio', () => {
  let h: MensajeHistorial[] = [];
  const paso = (e: EstadoArranque, hh: HechosArranque, ahora: number, primero: number | null = null) => {
    h = conLoNuevo(h, mensajesDeArranque(e, hh), { ahora, primeroDeOffer: primero }) ?? h;
  };
  paso({}, H, 1_000);
  paso({ nombre: 'Ana' }, H, 2_000);
  paso({ nombre: 'Ana', negocio: 'Acme' }, H, 3_000);
  // La conversación de Offer (va por /api/offer, no anota acá).
  const offer = [
    { de: 'mako' as const, texto: '¿Tienes un documento de tu oferta?', at: iso(4_000) },
    { de: 'yo' as const, texto: '', at: iso(4_010), adjuntos: [{ nombre: 'oferta.pdf' }] },
    { de: 'mako' as const, texto: 'Ya tengo todas las piezas.', at: iso(4_020) },
  ];
  const listo = { ...H, loQueVende: true };
  paso({ nombre: 'Ana', negocio: 'Acme', pdfOk: 'si' }, listo, 5_000, 4_000);
  const fin: EstadoArranque = { nombre: 'Ana', negocio: 'Acme', pdfOk: 'si', ...FASE, crmTipo: 'llamada', origen: 'Instagram', interes: 'ventas', telefono: 'postergado' };
  paso(fin, { ...listo, faseGuardada: true, canalNegocio: 'llamadas' }, 6_000, 4_000);
  paso(fin, { ...listo, faseGuardada: true, canalNegocio: 'llamadas', terminado: true }, 7_000, 4_000);

  const unido = unirConOffer(h, offer);
  const textos = unido.map((x) => x.texto);
  assert.match(textos[0], /^¡Hola! Soy MaKo/, 'empieza por el saludo, no por la oferta');
  assert.equal(textos[1], 'Ana');
  assert.equal(textos[3], 'Acme');
  const iOffer = textos.indexOf('¿Tienes un documento de tu oferta?');
  assert.ok(iOffer > textos.findIndex((t) => /cuéntame qué vendes en Acme/.test(t)), 'Offer va después del pase');
  assert.ok(textos.findIndex((t) => /PDF con tu oferta/.test(t)) > textos.indexOf('Ya tengo todas las piezas.'), 'el PDF, después de Offer');
  assert.match(textos[textos.length - 1], /^¡Listo, Ana!/);
  // Cada respuesta del arranque tiene su pregunta arriba.
  unido.forEach((x, i) => { if (x.de === 'yo' && h.some((y) => y.texto === x.texto)) assert.equal(unido[i - 1].de, 'mako', `«${x.texto}» sin su pregunta`); });
  // Y está TODO lo que la pantalla dibuja al final (lo que antes se armaba del estado de hoy).
  const final = mensajesDeArranque(fin, { ...listo, faseGuardada: true, canalNegocio: 'llamadas', terminado: true });
  for (const x of [...final.antes, ...final.despues]) assert.ok(h.some((y) => y.id === x.id && y.texto === x.texto), `falta ${x.id}`);
});

test('5. Florencia (ws21): terminó el 18/10 sin historial; reconstruido, su conversación empieza por su nombre', () => {
  // Su estado de verdad (onboarding.arranque del ws21) y las primeras filas de su sesión de Offer 14.
  const e: EstadoArranque = {
    introVista: true, nombre: 'Florencia', negocio: 'mi marca personal: Florencia Ayelen Carballo', sesionId: 14, pdfOk: 'si',
    faseResp: [1, 0, 0, 2, 0, 2], canal: 'llamadas', crmTipo: 'llamada', origen: 'Me lo recomendaron', interes: 'anuncios',
    telefono: 'verificado', telefonoNumero: '+543874747059',
  };
  const hh: HechosArranque = { ...H, loQueVende: true, faseGuardada: true, canalNegocio: 'llamadas', terminado: true };
  const primero = Date.parse('2026-10-18T22:24:41.169Z');
  const historial = conLoNuevo([], mensajesDeArranque(e, hh), { ahora: Date.parse('2026-10-18T23:07:30.832Z') - 1_000, primeroDeOffer: primero, reconstruido: true })!;
  const offer = [
    { de: 'mako' as const, texto: '¿Tienes un documento de tu oferta, tu guion de ventas o el link de tu web o landing?', at: '2026-10-18T22:24:41.169Z' },
    { de: 'yo' as const, texto: 'https://www.instagram.com/florencia__consultora_tesis/', at: '2026-10-18T22:25:21.500Z' },
    { de: 'mako' as const, texto: 'Perfecto: en la primera semana logran claridad absoluta. ¡Gracias!', at: '2026-10-18T22:53:45.918Z' },
  ];
  const unido = unirConOffer(historial, offer);
  assert.deepEqual(unido.slice(0, 4).map((x) => [x.de, x.texto.slice(0, 22)]), [
    ['mako', '¡Hola! Soy MaKo. Para '], ['yo', 'Florencia'], ['mako', 'Un gusto, Florencia. ¿'], ['yo', 'mi marca personal: Flo'],
  ]);
  const iUltimoOffer = unido.findIndex((x) => x.texto.startsWith('Perfecto: en la primera semana'));
  assert.ok(unido.slice(iUltimoOffer + 1).every((x) => x.reconstruido), 'lo de después, todo después de Offer');
  assert.ok(unido.some((x) => x.de === 'yo' && x.texto === 'Me lo recomendaron'));
});

test('6. juntar por hora: cada lista conserva su orden; un mensaje de Offer sin hora queda donde estaba', () => {
  const h = [
    { id: 'b', de: 'yo' as const, texto: 'B', at: iso(20) },
    { id: 'a', de: 'mako' as const, texto: 'A', at: iso(10) },
    { id: 'd', de: 'mako' as const, texto: 'D', at: iso(40) },
  ];
  const o = [{ de: 'mako' as const, texto: 'C', at: iso(20) }, { de: 'yo' as const, texto: 'C2' }, { de: 'mako' as const, texto: 'E', at: iso(50) }];
  assert.deepEqual(unirConOffer(h, o).map((x) => x.texto), ['A', 'B', 'C', 'C2', 'D', 'E'], 'a la misma hora, primero el arranque');
  assert.deepEqual(unirConOffer([], o).map((x) => x.texto), ['C', 'C2', 'E']);
});

test('7. en el Ops Center: el adjunto sin texto se ve, y «Reconstruido» lo lee sólo el super admin', () => {
  const ms = [
    { de: 'mako' as const, texto: '¿Cómo te llamas?', at: iso(1), reconstruido: true },
    { de: 'yo' as const, texto: 'Ana', at: iso(2), reconstruido: true },
    { de: 'mako' as const, texto: '¿Tienes un documento?', at: iso(3) },
    { de: 'yo' as const, texto: '', at: iso(4), adjuntos: [{ nombre: 'tesis.pdf' }] },
    { de: 'mako' as const, texto: '¿Está correcto?', at: iso(5), reconstruido: true },
  ];
  const cliente = mensajesDeOffer(ms);
  assert.deepEqual(cliente.map((x) => x.content), ['¿Cómo te llamas?', 'Ana', '¿Tienes un documento?', 'Adjunto: tesis.pdf', '¿Está correcto?']);
  const admin = mensajesDeOffer(ms, { avisoReconstruido: true });
  assert.deepEqual(admin.map((x) => x.content), [AVISO_RECONSTRUIDO, '¿Cómo te llamas?', 'Ana', '¿Tienes un documento?', 'Adjunto: tesis.pdf', AVISO_RECONSTRUIDO, '¿Está correcto?'], 'un aviso por tramo');
  assert.doesNotMatch(AVISO_RECONSTRUIDO, /\b(vos|tenés|podés)\b/, 'español neutro');
});

test('8. se anota al CONTESTAR (la ruta), nunca al mirar, y nunca con la conversación o la fase sin leer', () => {
  const ruta = leer('app/api/onboarding/arranque/route.ts');
  assert.match(ruta, /const listo = async \(extra: Record<string, unknown> = \{\}\) => NextResponse\.json\(\{ ok: true, \.\.\.extra, vista: await vistaArranque\(\{ anotar: true \}\) \}\);/);
  const get = ruta.slice(ruta.indexOf('export async function GET'), ruta.indexOf('export async function POST'));
  assert.match(get, /vista: await vistaArranque\(\) \}/, 'el GET no anota');
  assert.match(leer('app/onboarding/page.tsx'), /const vista = await vistaArranque\(\);/, 'la página no anota');
  const srv = leer('lib/onboarding-arranque-server.ts');
  assert.match(srv, /if \(o\.anotar && !h\.sesionCaida && !h\.faseCaida\) \{\n    await anotarHistorial\(\{ antes, despues \}, \{ primeroDeOffer: primeroDeOffer\(h\) \}\)\n      \.catch\(/);
  assert.match(srv, /getDiagnosticoFase\(\)\.catch\(\(\) => \{ faseCaida = true; return null; \}\)/);
  const anotar = srv.slice(srv.indexOf('export async function anotarHistorial'), srv.indexOf('export async function hiloDelOnboarding'));
  assert.match(anotar, /const raw = await getSettingEstricto\(CLAVE_HISTORIAL\);/, 'lectura estricta');
  assert.match(anotar, /if \(!previo\) throw new Error/, 'lo ilegible no se pisa');
  assert.match(anotar, /if \(await cambiarSettingSi\(CLAVE_HISTORIAL, raw, JSON\.stringify\(\{ mensajes: nuevo \}\)\)\)/, 'compare-and-set');
});

test('9. el Ops Center pega el historial SÓLO a la conversación del onboarding, y el aviso sólo al super admin', () => {
  const ind = leer('lib/chat-mako-indice.ts');
  const hilo = ind.slice(ind.indexOf('export async function hiloDeOffer'));
  assert.match(hilo, /runWithWorkspace\(ws, \(\) => Promise\.all\(\[\n    leerConversacionOffer\(id\),\n    getSetting\('onboarding\.arranque'\)\.catch\(\(\) => null\),\n    getSetting\(CLAVE_HISTORIAL\)\.catch\(\(\) => null\),\n    getSesionAdmin\(\)\.catch\(\(\) => null\),\n  \]\)\)/);
  assert.match(hilo, /const conversacion = sesionDelArranque\(arranque\) === c\.id \? unirConOffer\(leerHistorial\(historial\) \?\? \[\], deOffer\) : deOffer;/);
  assert.match(hilo, /mensajes: mensajesDeOffer\(conversacion, \{ avisoReconstruido: !!superAdmin \}\)/);
});

test('10. el chat «Onboarding» sale del historial, no del estado de hoy', () => {
  const srv = leer('lib/onboarding-arranque-server.ts');
  const f = srv.slice(srv.indexOf('async function mensajesParaElHilo'), srv.indexOf('const primeroDeOffer'));
  assert.match(f, /await anotarHistorial\(vista, \{ primeroDeOffer: primeroDeOffer\(h\), reconstruidoSiVacio: true \}\);/);
  assert.match(f, /return mensajesDelHilo\(unirConOffer\(historial, h\.sesion\?\.mensajes \?\? \[\]\), e\.interes\);/);
  assert.doesNotMatch(f, /\.\.\.antes|\.\.\.despues/, 'sin armarlo otra vez del estado');
});

test('11. el script de reconstrucción: en seco por defecto, y no toca un historial que ya existe', () => {
  const s = leer('scripts/reconstruir-historial-onboarding.mts');
  assert.match(s, /const APLICAR = process\.argv\.includes\('--aplicar'\);/);
  assert.match(s, /if \(previo\.length\) return fila\(`ya tiene historial/);
  assert.match(s, /if \(!APLICAR\) return fila\('se reconstruiría'/);
  assert.match(s, /reconstruido: true \}\);/);
  assert.match(s, /cambiarSettingSi\(CLAVE_HISTORIAL, raw, JSON\.stringify\(\{ mensajes: nuevo \}\)\)/);
});

test('12. la nota de voz llega al Ops Center como audio, con la transcripción de texto, y sin su ruta de Storage', () => {
  const ms = mensajesDeOffer([
    { de: 'yo', texto: 'El 100% logró el éxito.', at: iso(1), audio: { url: '/api/offer/audio?id=14&m=137906e0', secs: 3 } },
    { de: 'yo', texto: '', at: iso(2), audio: { url: '/api/offer/audio?id=14&m=x', secs: 5 } },
  ]);
  assert.deepEqual(ms[0], { role: 'user', content: 'El 100% logró el éxito.', created_at: iso(1), audio: { url: '/api/offer/audio?id=14&m=137906e0', secs: 3 } });
  assert.equal(ms.length, 2, 'un audio sin transcripción también se ve');
  const ind = leer('lib/chat-mako-indice.ts');
  assert.match(ind, /const deOffer = c\.mensajes\.map\(\(\{ audio, \.\.\.m \}\) => \(audio \? \{ \.\.\.m, audio: \{ url: urlAudio\(c\.id, m\.id\), secs: audio\.secs \} \} : m\)\);/,
    'la URL de la ruta de Offer, que vuelve a mirar la puerta; el path no sale');
  assert.match(leer('lib/mako-turno-app-reglas.ts'), /audio\?: \{ url: string; secs: number \};/);
});

test('13. el chat «Onboarding» guarda qué mensaje de Offer tiene el audio, y al leerlo lo vuelve a reproducir', () => {
  const hilo = mensajesDelHilo([
    { de: 'mako', texto: '¿Cuánto cobras?' },
    { de: 'yo', texto: 'Seis cuotas', id: '4ac9f6df-0000-4000-8000-000000000000', audio: { secs: 110.4 } },
    { de: 'yo', texto: '', id: 'b6caad71-0000-4000-8000-000000000000', audio: { secs: 2 } },
  ], 'anuncios');
  assert.deepEqual(hilo[1], { role: 'user', content: 'Seis cuotas', audio: { mensaje: '4ac9f6df-0000-4000-8000-000000000000', secs: 110 } });
  assert.equal(hilo[2].content, NOTA_DE_VOZ);
  assert.equal(hilo[0].audio, undefined);
  // El bloque: sin ruta de Storage, y los otros lectores lo saltean.
  const b = bloqueDeAudio(14, '4ac9f6df-0000-4000-8000-000000000000', 110);
  assert.deepEqual(audioDeBloques([b]), b);
  assert.equal(audioDeBloques([{ k: 'audio', sesion: 14, mensaje: '../21/offer/x' }]), null);
  assert.equal(audioDeBloques([{ k: 'audio', sesion: '14', mensaje: 'a' }]), null);
  assert.deepEqual(sanearBloques(21, [b]), []);
  assert.deepEqual(bloquesGuardados([b]), []);
  const srv = leer('lib/onboarding-arranque-server.ts');
  assert.match(srv, /bloques: m\.audio && previo\.sesionId \? \[bloqueDeAudio\(previo\.sesionId, m\.audio\.mensaje, m\.audio\.secs\)\] : null,/);
  assert.match(leer('lib/mako-turno-app.ts'), /\.\.\.\(audio \? \{ audio: \{ url: urlAudio\(audio\.sesion, audio\.mensaje\), secs: audio\.secs \} \} : \{\}\),/);
});

test('14. quien no tiene su chat «Onboarding» (el super admin mirando) ve la conversación del onboarding con ese nombre', () => {
  const ind = leer('lib/chat-mako-indice.ts');
  assert.match(ind, /titulo: s\.id === delOnboarding && !copiada \? TITULO_HILO : s\.titulo/);
  assert.match(ind, /const delOnboarding = sesionDelArranque\(arranque\);/);
});
