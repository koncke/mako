// =============================================================================
// El quinto Ops Center (17/10/2026): lo de WhatsApp que Martín pidió a las 17:54, 17:55 y 18:06
// =============================================================================
// Lo que se fija, por pedido (la primera punta):
//   A. la burbuja de Martín muestra SUS números («3.», «7.»), no los que renumera un <ol>;
//   B. las fotos que mandó van adentro de su burbuja (y «Te mando estos adjuntos.» no se lee), y se recuerdan al mandar;
//   2. mantener apretado en el teléfono abre la hoja de WhatsApp, que no se cierra con el dedo que la abrió;
//   3. un solo botón: el micrófono sin nada escrito, la flecha con texto;
//   8. el «atrás» cierra el visor y la hoja del mensaje, no la conversación; «Ya está» se dice «Completado»; la fila avisa;
//   9. una medición de más de 6 horas se ve apagada («Sin medir hace X») y el botón no la usa; «Medido hace X» siempre;
//   18:06. «Uso y Runners» sin la sección repetida «N de N activos», y la hoja abre en «alto» (scrollea hasta el final).
//
// Probado rompiéndolo (17/10/2026, con la base en 0 fallos):
//   · el <ol> sin el número escrito (`co-burbuja__num` fuera de Hilo.tsx) → cae A;
//   · `vencido` sin mirar la edad (siempre false) → caen los dos de 9;
//   · `if (abierto.tactil)` fuera de MenuMensajeWA → cae 2;
//   · BotonMandar sin mirar `hayQueMandar` (siempre la flecha) → cae 3;
//   · `avisaYaEsta` sin comparar con lo visto (siempre true) → cae 8.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LineaChat } from '../lib/centro-chats';
import { avisaYaEsta, vistaPrevia } from '../lib/centro-chats';
import { TEXTO_SOLO_ADJUNTOS, bloquesDeMensaje } from '../lib/centro-caja';
import { cuentasDeUso, usoDeCuenta, usoPrincipal, type Cuota } from '../lib/centro-uso';
import { Hilo } from '../app/admin/operaciones/Hilo';
import { ListaUso } from '../app/admin/operaciones/Uso';
import { BotonMandar } from '../app/admin/operaciones/Microfono';
import { YaEstaMensaje } from '../app/admin/operaciones/Avance';

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
  const cuerpo = motor.slice(motor.indexOf('async function mandar('));
  const fallo = cuerpo.indexOf("if (!r.ok) { avisar(r.error, 'bad'); return; }");
  const recuerda = cuerpo.indexOf('recordarEnviadas(r.id,');
  assert.ok(fallo > 0 && recuerda > fallo, 'se recuerda con el id del trabajo que salió');
});

test('2: mantener apretado con el dedo abre la hoja de WhatsApp, que el dedo que la abrió no cierra', () => {
  const wa = codigo('app/admin/operaciones/MensajeWA.tsx');
  assert.match(wa, /wa\.abrirMenu\(m, x, y, tactil\)/, 'el gesto dice que fue un dedo');
  assert.match(wa, /if \(abierto\.tactil\) return <HojaMensajeWA /, 'con el dedo, la hoja (no el menú de la casa)');
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
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    const s = codigo(f);
    assert.match(s, /<BotonMandar /, `${f}: el botón único`);
    assert.doesNotMatch(s, /<Microfono /, `${f}: sin el micrófono aparte`);
  }
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

test('9: una medición de más de 6 horas se ve apagada y el botón no la usa; «Medido hace X» siempre', () => {
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
  assert.match(una, /Sesión de 5 horas Sin medir hace 8 h Semana Sin medir hace 8 h/);
  assert.doesNotMatch(una, /% usado/, 'nunca el número viejo como si fuera de ahora');
  assert.match(h, /co-uso__ventana--vencida/);
  assert.match(dos, /47% usado/);
  assert.match(dos, /Medido hace 5 min$/);
});

test('18:06: «Uso y Runners» sin «N de N activos» repetido, y la hoja abre en «alto»', () => {
  assert.doesNotMatch(codigo('app/m/operaciones/RunnerMovil.tsx'), /activos/);
  assert.match(codigo('app/m/operaciones/CentroAppMovil.tsx'), /titulo="Uso y Runners" snap="alto"/);
});
