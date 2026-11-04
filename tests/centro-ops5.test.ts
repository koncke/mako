// =============================================================================
// El quinto Ops Center (17/10/2026): lo de WhatsApp que Martín pidió a las 17:54, 17:55 y 18:06
// =============================================================================
// Lo que se fija, por pedido (la primera punta):
//   A. la burbuja de Martín muestra SUS números («3.», «7.»), no los que renumera un <ol>;
//   B. las fotos que mandó van adentro de su burbuja (y «Te mando estos adjuntos.» no se lee), y se recuerdan al mandar;
//   2. mantener apretado en el teléfono abre la hoja de WhatsApp, que no se cierra con el dedo que la abrió;
//   3. un solo botón: el micrófono sin nada escrito, la flecha con texto;
//   8. el «atrás» cierra el visor y la hoja del mensaje, no la conversación; «Ya está» se dice «Completado»; la fila avisa;
//   9. una medición de más de 6 horas no la usa el botón; «Medido hace X» siempre. (Hasta el 22/10 la tarjeta la apagaba
//      con «Sin medir hace X»; desde ahí muestra el último número en gris con su edad: tests/centro-uso-ultimo.test.ts.)
//   18:06. «Uso y Runners» sin la sección repetida «N de N activos», y la hoja abre en «alto» (scrollea hasta el final).
//
// Probado rompiéndolo (17/10/2026, con la base en 0 fallos):
//   · el <ol> sin el número escrito (`co-burbuja__num` fuera de Hilo.tsx) → cae A;
//   · `vencido` sin mirar la edad (siempre false) → caen los dos de 9;
//   · `if (abierto.tactil)` fuera de MenuMensajeWA → cae 2;
//   · BotonMandar sin mirar `hayQueMandar` (siempre la flecha) → cae 3;
//   · `avisaYaEsta` sin comparar con lo visto (siempre true) → cae 8.
//
// La segunda punta (1, 4, 5, 6 y 10):
//   1. cada mensaje en su globo con la colita: lo de Martín con SU foto, lo especial como tarjeta de color;
//   4. pegar una imagen la adjunta (de `items` o de `files`; con texto escrito, gana el texto; un link no es texto);
//   5. los emojis en su botón junto al campo (WhatsApp), donde está el cursor; el «+» ordenado como el «Adjuntar» de WhatsApp;
//   6. un borrador sin mandar se ve en la fila: «Borrador: …» (de TODOS los chats, no sólo el abierto);
//   10. en el teléfono la cabecera del chat queda pegada arriba y abre la criatura y «Tu foto de perfil».
// Probado rompiéndolo:
//   · <MiFoto /> fuera del trabajo en Hilo.tsx → cae 1;
//   · alPegar sin mirar el texto (siempre la imagen) → cae 4;
//   · `conEmoji` agregando al final en vez de en el cursor → cae 5;
//   · `segundoRenglon` sin el borrador → cae 6.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LineaChat } from '../lib/centro-chats';
import { avisaYaEsta, segundoRenglon, vistaPrevia } from '../lib/centro-chats';
import { TEXTO_SOLO_ADJUNTOS, bloquesDeMensaje } from '../lib/centro-caja';
import { cuentasDeUso, usoDeCuenta, usoPrincipal, type Cuota } from '../lib/centro-uso';
import { Hilo } from '../app/admin/operaciones/Hilo';
import { ListaUso } from '../app/admin/operaciones/Uso';
import { BotonMandar } from '../app/admin/operaciones/Microfono';
import { YaEstaMensaje } from '../app/admin/operaciones/Avance';
import { alPegar, archivosDelPortapapeles } from '../app/admin/operaciones/pegar';
import type { AdjuntosDeCaja } from '../app/admin/operaciones/AdjuntosCaja';
import { conEmoji } from '../app/admin/operaciones/Emojis';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const codigo = (r: string) => leer(r).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const AHORA = Date.UTC(2026, 9, 17, 21);
const S1 = 'local_aaaaaaaa-1111-2222-3333-444444444444';

const trabajo = (texto: string, extra: Record<string, unknown> = {}): LineaChat => ({
  tipo: 'trabajo', instante: AHORA - 60_000, trabajo: {
    id: 'bbbbbbbb-1111-4222-8333-444444444444', destino: S1, destino_titulo: 'CRM', destino_cuenta: 'claude1',
    created_at: new Date(AHORA - 60_000).toISOString(), texto, estado: 'entregado', motivo: null, cierre: null, ...extra,
  },
} as LineaChat);
const turno = (uuid: string, rol: 'yo' | 'el', texto: string, instante: number): LineaChat => ({
  tipo: 'turno', instante, turno: { local: S1, uuid, rol, de: null, texto, at: new Date(instante).toISOString(), trabajo: null },
} as LineaChat);
const dibujar = (lineas: LineaChat[]) => renderToStaticMarkup(createElement(Hilo, {
  lineas, pushes: [], ahora: AHORA, vacio: '', quien: { titulo: 'CRM', animo: 'despierto' },
}));

test('A: la burbuja de Martín lleva SUS números, también con un renglón en el medio', () => {
  const b = bloquesDeMensaje('Pasos:\n3. tres\n4. cuatro\nuna nota\n7. siete');
  assert.deepEqual(b.filter((x) => x.tipo === 'lista').map((x) => (x.tipo === 'lista' ? x.marcas : [])), [['3.', '4.'], ['7.']]);
  const html = dibujar([trabajo('Pasos:\n3. tres\n4. cuatro\nuna nota\n7. siete')]);
  const numeros = [...html.matchAll(/<span class="co-burbuja__num">([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(numeros, ['3.', '4.', '7.'], 'los que escribió, no 1, 2, 1');
});

test('B: las fotos van adentro de la burbuja, arriba del texto, y se recuerdan al mandar', () => {
  const html = dibujar([trabajo(TEXTO_SOLO_ADJUNTOS, { adjuntos: ['captura.png'] })]);
  assert.match(html, /co-burbuja co-burbuja--con-adjuntos/);
  // Sin la foto en este navegador (el servidor, otro dispositivo), el nombre como documento: nunca «Adjuntó …» afuera.
  assert.match(html, /class="co-doc-enviado"[\s\S]*captura\.png/);
  assert.doesNotMatch(html, /Adjuntó/);
  assert.doesNotMatch(html, new RegExp(TEXTO_SOLO_ADJUNTOS.replace('.', '\\.')), 'una foto sola va sin epígrafe');
  // Con texto, el texto sí.
  assert.match(dibujar([trabajo('Mira esto', { adjuntos: ['captura.png'] })]), /Mira esto/);
  // El motor la recuerda DESPUÉS de saber que salió (si no salió, la caja la conserva).
  const motor = codigo('app/admin/operaciones/useCentro.ts');
  const cuerpo = motor.slice(motor.indexOf('  function mandar('));
  // Desde el 27/10/2026 la firma corre en la tarea de la cola (envios-en-curso.ts): `if (!r.ok) return r;` es su fallo.
  const fallo = cuerpo.indexOf('if (!r.ok) return r;');
  const recuerda = cuerpo.indexOf('recordarEnviadas(r.id,');
  assert.ok(fallo > 0 && recuerda > fallo, 'se recuerda con el id del trabajo que salió');
});

test('2: mantener apretado con el dedo abre la hoja de WhatsApp, que el dedo que la abrió no cierra', () => {
  const wa = codigo('app/admin/operaciones/MensajeWA.tsx');
  assert.match(wa, /wa\.abrirMenu\(m, x, y, tactil\)/, 'el gesto dice que fue un dedo');
  // Con el aviso de «Reportar» al lado desde el 4/11/2026 (ticket #57): sigue siendo la hoja, ahora en un fragmento.
  assert.match(wa, /if \(abierto\.tactil\) (?:\{\s*)?return (?:<>\s*)?<HojaMensajeWA /, 'con el dedo, la hoja (no el menú de la casa)');
  const hoja = wa.slice(wa.indexOf('export function HojaMensajeWA'), wa.indexOf('export function InfoMensaje'));
  assert.match(hoja, /onPointerDownCapture=\{\(\) => \{ listo\.current = true; \}\}/, 'sólo cuenta un toque que empezó con la hoja abierta');
  assert.match(hoja, /useAtrasCierra\(true, onCerrar\)/, 'el «atrás» la cierra a ella');
  assert.doesNotMatch(hoja, /addEventListener\('(contextmenu|resize|blur)'/, 'lo que cerraba el menú de la casa no la cierra');
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    assert.match(codigo(f), /abrirMenu: \(m, x, y, tactil\) => setMenuWA\(\{ m, x, y, tactil \}\)/, `${f}: pasa el dedo`);
  }
});

test('3: un solo botón, el micrófono sin nada escrito y la flecha con texto, en la computadora y el teléfono', () => {
  const base = { valor: '', onValor: () => {}, onError: () => {}, enviando: false, onMandar: () => {} };
  assert.match(renderToStaticMarkup(createElement(BotonMandar, { ...base, hayQueMandar: false })), /aria-label="Dictar"/);
  const flecha = renderToStaticMarkup(createElement(BotonMandar, { ...base, valor: 'hola', hayQueMandar: true }));
  assert.match(flecha, /aria-label="Firmar y mandar"/);
  assert.doesNotMatch(flecha, /Dictar/);
  // Desde el 20/10/2026 la caja es UNA pieza (app/_chat/CajaChat.tsx): el botón único vive ahí, y las dos pantallas la usan.
  const pieza = codigo('app/_chat/CajaChat.tsx');
  assert.match(pieza, /<BotonMandar /, 'la caja única: el botón único');
  assert.doesNotMatch(pieza, /<Microfono /, 'sin el micrófono aparte');
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) assert.match(codigo(f), /<CajaChat /, `${f}: la caja única`);
});

test('8: «Completado» en pantalla, el aviso en la fila sólo si no se vio, y el «atrás» cierra la foto', () => {
  const ya = turno('u1', 'el', 'Ya está: el filtro del CRM\nPruébalo en /crm', AHORA - 5_000);
  const html = renderToStaticMarkup(createElement(YaEstaMensaje, { t: (ya as Extract<LineaChat, { tipo: 'turno' }>).turno }));
  assert.match(html, />Completado</);
  assert.doesNotMatch(html, />Ya está</);
  const p = vistaPrevia([turno('u0', 'yo', 'Arreglá el filtro', AHORA - 60_000), ya]);
  assert.equal(p?.ya, true);
  assert.equal(p?.texto, 'el filtro del CRM', 'sin el «Ya está» de adelante: la fila pone su sello');
  assert.equal(avisaYaEsta(p, { desde: AHORA - 3_600_000, chats: {} }, 'crm'), true, 'llegó después de abrir el Ops Center: avisa');
  assert.equal(avisaYaEsta(p, { desde: AHORA - 3_600_000, chats: { crm: AHORA } }, 'crm'), false, 'abierto después: no');
  assert.equal(avisaYaEsta(p, { desde: AHORA, chats: {} }, 'crm'), false, 'de antes del primer uso: no');
  assert.equal(avisaYaEsta(p, null, 'crm'), false, 'sin saber qué se vio, no avisa');
  // El visor (la foto antes de mandar y la enviada) se cierra con el «atrás», sin cerrar la conversación.
  assert.match(codigo('app/admin/operaciones/Visor.tsx'), /useAtrasCierra\(true, onCerrar\)/);
  const atras = codigo('app/admin/operaciones/atras.ts');
  assert.match(atras, /window\.history\.pushState\(null, '', window\.location\.href\)/, 'la misma URL: la hoja ve su ?sheet= y no se cierra');
  assert.match(atras, /if \(!porAtras\) window\.history\.back\(\)/, 'cerrada con la ✕, consume su entrada');
});

test('9: una medición de más de 6 horas no la usa el botón, y la tarjeta nunca la lee como de ahora; «Medido hace X» siempre', () => {
  const cuota = (medido: string): Cuota => ({ cinco: { pct: 12, reinicia: '2026-10-17T23:00:00Z' }, semana: { pct: 47, reinicia: '2026-10-21T09:00:00Z' }, medido });
  const fresca = cuota(new Date(AHORA - 5 * 60_000).toISOString());
  const vieja = cuota(new Date(AHORA - 8 * 3_600_000).toISOString());
  assert.equal(usoDeCuenta(fresca, AHORA).vencido, false);
  assert.equal(usoDeCuenta(cuota(new Date(AHORA - 5 * 3_600_000).toISOString()), AHORA).vencido, false, '5 horas todavía vale');
  assert.equal(usoDeCuenta(vieja, AHORA).vencido, true);
  assert.equal(usoPrincipal([{ cuenta: 'claude1', cuota: vieja }], AHORA), null);
  const h = renderToStaticMarkup(createElement(ListaUso, {
    cuentas: cuentasDeUso([{ cuenta: 'claude1', vistoAt: null, cuota: vieja }, { cuenta: 'claude2', vistoAt: new Date(AHORA).toISOString(), cuota: fresca }], ['claude1', 'claude2']),
    ahora: AHORA,
  }));
  const [una, dos] = h.split('<section').slice(1).map((s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
  assert.match(una, /Sin Runner · se mide a mano/);
  // 22/10/2026 (Martín: «no debería desaparecer los % de uso que tenía la última vez»): el último número con su edad, en gris.
  assert.match(una, /Sesión de 5 horas 12% · medido hace 8 h .*Semana 47% · medido hace 8 h/);
  assert.doesNotMatch(una, /% usado/, 'nunca el número viejo como si fuera de ahora');
  assert.match(h, /co-uso__ventana--vieja/);
  assert.match(dos, /47% usado/);
  assert.match(dos, /Medido hace 5 min$/);
});

test('18:06: «Uso y Runners» sin «N de N activos» repetido, y la hoja abre en «alto»', () => {
  assert.doesNotMatch(codigo('app/m/operaciones/RunnerMovil.tsx'), /activos/);
  assert.match(codigo('app/m/operaciones/CentroAppMovil.tsx'), /titulo="Tus cuentas de IA" snap="alto"/);
});

test('1: cada mensaje en su globo con su colita; lo de Martín con SU foto, lo especial como tarjeta', () => {
  const html = dibujar([
    trabajo('Arreglá el filtro'),
    turno('u1', 'el', 'Listo, lo miro', AHORA - 30_000),
    turno('u2', 'el', 'Ya está: el filtro\nPruébalo en /crm', AHORA - 10_000),
  ]);
  assert.match(html, /class="co-burbuja"[\s\S]*?<\/div><span class="co-mifoto"/, 'su foto, al lado de su globo');
  assert.match(html, /class="co-el co-el--especial"/, 'el «Completado» es una tarjeta especial');
  const css = leer('app/admin/operaciones/centro.css');
  assert.match(css, /\.co-yo \.co-burbuja::after \{[\s\S]*?clip-path/, 'la colita del globo de Martín');
  assert.match(css, /\.co-el:not\(\.co-trabajando\) > \.co-el__cuerpo:not\(\.co-el__cuerpo--ancho\)::before \{[\s\S]*?clip-path/, 'y la del chat');
  assert.match(codigo('app/admin/operaciones/MiFoto.tsx'), /fetch\('\/api\/perfil'\)/, 'la foto es la del perfil');
});

test('4: pegar una imagen la adjunta; con texto escrito gana el texto, y un link no es texto', () => {
  const png = new File([new Uint8Array([137, 80, 78, 71])], 'captura.png', { type: 'image/png' });
  const pegar = (texto: string, puede = true, enItems = false) => {
    const sumados: File[][] = [];
    let noPuede = 0;
    let frenado = false;
    const a: AdjuntosDeCaja = { items: [], puede, onSumar: (fs) => sumados.push(fs), onQuitar: () => {}, onNoPuede: () => { noPuede += 1; } };
    const e = {
      preventDefault: () => { frenado = true; },
      clipboardData: {
        files: enItems ? [] : [png],
        items: enItems ? [{ kind: 'file', getAsFile: () => png }] : [],
        getData: (t: string) => (t === 'text/plain' ? texto : ''),
      },
    };
    alPegar(e as unknown as Parameters<typeof alPegar>[0], a);
    return { sumados: sumados.flat().length, noPuede, frenado };
  };
  assert.deepEqual(pegar(''), { sumados: 1, noPuede: 0, frenado: true }, 'una captura sola');
  assert.deepEqual(pegar('', true, true), { sumados: 1, noPuede: 0, frenado: true }, 'la imagen que viene sólo en `items`');
  assert.deepEqual(pegar('https://hola-mako.com/foto.png'), { sumados: 1, noPuede: 0, frenado: true }, '«Copiar imagen» trae su dirección: gana la imagen');
  assert.deepEqual(pegar('Ventas | 120'), { sumados: 0, noPuede: 0, frenado: false }, 'una celda de Excel: se pega el texto');
  assert.deepEqual(pegar('', false), { sumados: 0, noPuede: 1, frenado: true }, 'un chat que no recibe adjuntos lo dice');
  assert.equal(archivosDelPortapapeles({ files: [png] as unknown as FileList, items: [{ kind: 'file', getAsFile: () => png }] as unknown as DataTransferItemList }).length, 1, 'sin repetir');
});

test('5: los emojis donde está el cursor, en su botón junto al campo; el «+» como el «Adjuntar» de WhatsApp', () => {
  assert.deepEqual(conEmoji('hola mundo', 4, 4, '👍'), { texto: 'hola👍 mundo', cursor: 6 });
  assert.deepEqual(conEmoji('hola mundo', 5, 10, '🔥'), { texto: 'hola 🔥', cursor: 7 }, 'reemplaza lo seleccionado');
  assert.deepEqual(conEmoji('hola', null, null, '✅'), { texto: 'hola✅', cursor: 5 }, 'sin cursor, al final');
  // La carita, junto al campo, en la caja única (app/_chat/CajaChat.tsx, 20/10/2026), que usan la computadora y el teléfono.
  assert.match(codigo('app/_chat/CajaChat.tsx'), /<\/MasCaja>\}[\s\S]{0,160}<BotonEmojis campo=\{caja\}/, 'la carita, junto al campo');
  const mas = codigo('app/admin/operaciones/AdjuntosCaja.tsx');
  const rotulos = [...mas.matchAll(/<\/span><span>([^<]+)<\/span>\s*<\/button>/g)].map((m) => m[1]);
  // 20/10/2026: «Pegar» al final, la captura copiada (el teclado del teléfono no la ofrece en la caja; tests/centro-app-adjuntos.test.ts).
  assert.deepEqual(rotulos, ['Documento', 'Fotos', 'Cámara', 'Pegar'], 'los círculos de WhatsApp, en su orden');
  assert.match(mas, /co-mas-caja__titulo">Con qué corre</);
});

test('6: el borrador ya NO va en la fila (20/10/2026, Martín: «Jamás debe decir el subtitulo las cosas que ponen»)', () => {
  // Desde el 20/10 la fila dice «Trabajando…», «Espera tu respuesta» o nada (tests/centro-subtitulo.test.ts). El borrador
  // sigue guardado en su chat (la B del 17/10), pero no se lista.
  const quieto = { estado: 'abierto' as const, viejo: false };
  assert.equal(segundoRenglon(quieto, 0), null, 'con un borrador, sin subtítulo');
  assert.equal(segundoRenglon(quieto, 1), 'espera', 'lo que espera a Martín');
  assert.equal(segundoRenglon({ estado: 'trabajando', viejo: false }, 0), 'vivo');
  // Las dos listas usan la MISMA regla.
  assert.match(codigo('app/admin/operaciones/PiezasCentro.tsx'), /const r = segundoRenglon\(c, espera, sinVer\);/);
  assert.match(codigo('app/m/operaciones/ChatsMovil.tsx'), /const renglon = segundoRenglon\(c, espera, nuevo\);/);
  // Los de TODOS los chats, no sólo los que se abrieron: se leen de este navegador al aparecer en la lista.
  assert.match(codigo('app/admin/operaciones/useCentro.ts'), /for \(const c of chats\) if \(!conBorradorLeido\.current\.has\(c\.clave\)\) \{[^}]*cargarBorrador\(c, null\)/);
});

test('10: en el teléfono el título de la hoja es el chat (criatura a la izquierda) y ya no lleva «Tu foto de perfil»', () => {
  // Cambió el 17/10/2026, 19:31 (Martín: «la criatura va AL LADO del título, a la izquierda, como la foto en WhatsApp», «SACÁ la
  // opción de cambiar la foto de perfil de Martín de la cabecera del chat: eso se configura en su perfil»). Lo de las 18:06
  // (la cabecera pegada con «Tu foto de perfil») quedó atrás; los fijados siguen pegados arriba.
  const movil = codigo('app/m/operaciones/ChatsMovil.tsx');
  assert.match(movil, /className="m-operaciones-cabeza"/, 'los fijados siguen pegados arriba');
  assert.match(leer('app/m/operaciones/operaciones.css'), /\.m-operaciones-cabeza \{ position: sticky; top: 0;/);
  assert.doesNotMatch(movil, /Tu foto de perfil|\/api\/perfil\/avatar|ponerMiFoto|<MiFoto/, 'la foto de perfil se cambia en Tu cuenta');
  assert.match(leer('app/m/operaciones/operaciones.css'), /\.m-operaciones-titulo__muneco/);
});

