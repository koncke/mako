// =============================================================================
// La respuesta al EQUIPO no es para MaKo (28/10/2026, Leila, ws11)
// =============================================================================
// Martín: «Leila respondió al desarrollador y MaKo saltó a decirle cualquier cosa... Te pedí que funcione bien MaKo en
// WhatsApp». El equipo le preguntó en el grupo, firmado, cuántas quincenas eran y en qué moneda. Leila contestó «Nadia es su
// proporcional en mxn son 6 meses de 12000 y luego a 10000», y MaKo le puso 👍 y le contestó una cuenta («eso suma 72,000 MXN…
// dime y lo hacemos juntos»). Lo que fija este test:
//   1. la entrada REAL del grupo (tests/_respuesta-equipo-hijo.ts): el eco firmado del equipo entra a su anillo; la respuesta
//      CITADA y la NO citada dentro de la ventana no llevan 👍, no entran a la cola y quedan para el equipo (el aviso al grupo
//      de SuperAdmin, sin la firma); «mako, …» y un mensaje después de que MaKo habló son para MaKo;
//   2. la regla pura (`respuestaAlEquipo`): la ventana de 6 h, MaKo que habló después, una cita que no es del equipo, un audio;
//   3. la firma cuenta sólo AL PRINCIPIO: la cita de la firma en el aviso a SuperAdmin no calla a Martín en su grupo;
//   4. con ticket, la respuesta va a ESE ticket (y lo vuelve a la bandeja).
//
// Probado rompiéndolo (28/10/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { conElNuevo, respuestaAlEquipo, textoCitado, VENTANA_RESPUESTA_AL_EQUIPO_MS, type DelEquipo } from '../lib/doer-equipo';
import { esFirmaDelEquipo, FIRMA_DESARROLLADOR, sinFirmaDelEquipo } from '../lib/aviso-arreglo-reglas';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RESPUESTA = 'Nadia es su proporcional en mxn son 6 meses de 12000 y luego a 10000';

let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_respuesta-equipo-hijo.ts', import.meta.url))], { encoding: 'utf8', timeout: 280_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@EQUIPO@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@EQUIPO@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}

test('1. el caso de Leila, por la entrada real: la respuesta al equipo (citada o no) sin 👍 ni turno, y queda para el equipo', () => {
  const r = correr();
  assert.deepEqual(r.a, { engaged: false, skip: 'eco de mi propia respuesta' });
  assert.deepEqual(r.anillo, ['EQ-1'], 'la pregunta del equipo (por la línea de MaKo, firmada) no entró a su anillo');
  for (const k of ['b', 'c']) {
    assert.deepEqual(r[k], { engaged: false, skip: 'respuesta al equipo' }, `${k}: ${JSON.stringify(r[k])}`);
    assert.equal(r[`${k}Reacciones`], 0, `${k}: MaKo le puso 👍 a la respuesta al equipo`);
    assert.deepEqual(r[`${k}Cola`], [], `${k}: la respuesta al equipo entró a la cola (MaKo la iba a contestar)`);
    assert.equal(r[`${k}SuperAdmin`].length, 1, `${k}: la respuesta al equipo se perdió`);
    assert.match(r[`${k}SuperAdmin`][0], new RegExp(`Respuesta al equipo — Leila \\(ws11\\), Leila:\\n«${RESPUESTA}»`));
    assert.ok(!esFirmaDelEquipo(r[`${k}SuperAdmin`][0]), 'el eco del aviso a SuperAdmin pasaría por un mensaje del equipo');
    assert.ok(!r[`${k}SuperAdmin`][0].includes(FIRMA_DESARROLLADOR), 'el aviso a SuperAdmin cita la firma del equipo');
  }
  assert.deepEqual(r.dCola, ['LE-3'], '«mako, …» después de la pregunta del equipo no fue para MaKo');
  assert.deepEqual(r.eCola, ['LE-3', 'LE-4'], 'de control: con MaKo hablando después de la pregunta, el mensaje no fue para MaKo');
});

const AHORA = new Date('2026-10-28T20:00:00Z');
const hace = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString();
const PREGUNTA: DelEquipo = { at: hace(1), texto: `${FIRMA_DESARROLLADOR}\n¿Cuántas quincenas eran y en qué moneda?`, id: 'EQ-1' };
const base = { citado: null, anillo: [PREGUNTA], ultimaDeMaKo: hace(3), ahora: AHORA, nombraAMaKo: false, esTexto: true };

test('2. la regla: citado, la ventana de 6 h, MaKo que habló después, nombrarla, una cita ajena, un audio', () => {
  assert.equal(respuestaAlEquipo(base), PREGUNTA, 'sin citar, dentro de la ventana');
  assert.equal(respuestaAlEquipo({ ...base, citado: { id: 'EQ-1', texto: null } }), PREGUNTA, 'citando el del anillo');
  assert.ok(respuestaAlEquipo({ ...base, anillo: [], citado: { id: 'X', texto: PREGUNTA.texto } }), 'citando uno firmado que no está en el anillo');
  assert.equal(respuestaAlEquipo({ ...base, citado: { id: 'M-9', texto: 'Hoy entraron 4 leads.' } }), null, 'una cita a MaKo se tomó por respuesta al equipo');
  assert.equal(respuestaAlEquipo({ ...base, ultimaDeMaKo: hace(0.5) }), null, 'MaKo habló después de la pregunta');
  assert.equal(respuestaAlEquipo({ ...base, anillo: [{ ...PREGUNTA, at: hace(7) }], ultimaDeMaKo: hace(10) }), null, 'fuera de la ventana');
  assert.ok(VENTANA_RESPUESTA_AL_EQUIPO_MS === 6 * 3_600_000);
  assert.equal(respuestaAlEquipo({ ...base, nombraAMaKo: true }), null, 'nombrar a MaKo no ganó');
  assert.equal(respuestaAlEquipo({ ...base, esTexto: false }), null, 'un audio sin citar se tomó por respuesta al equipo');
  assert.equal(respuestaAlEquipo({ ...base, anillo: [{ ...PREGUNTA, texto: `${FIRMA_DESARROLLADOR}\nYa quedó listo.` }] }), null, 'un aviso sin pregunta calla lo que sigue');
});

test('3. la firma cuenta sólo al principio; el mismo mensaje no entra dos veces al anillo; la cita se lee', () => {
  assert.equal(esFirmaDelEquipo(`${FIRMA_DESARROLLADOR}\nhola`), true);
  assert.equal(esFirmaDelEquipo('👨‍💻 Desarrollador de MaKo: hola'), true, 'sin los asteriscos (un copiado)');
  assert.equal(esFirmaDelEquipo(`Contesta a: «${FIRMA_DESARROLLADOR} ¿cuántas?»`), false, 'una cita de la firma en el medio');
  assert.equal(sinFirmaDelEquipo(`${FIRMA_DESARROLLADOR}\n¿Cuántas?`), '¿Cuántas?');
  const una = JSON.stringify(conElNuevo(null, PREGUNTA));
  assert.equal(conElNuevo(una, { ...PREGUNTA, at: hace(0) }).length, 1, 'el envío y su eco entraron dos veces');
  assert.equal(textoCitado({ extendedTextMessage: { text: 'x', contextInfo: { quotedMessage: { conversation: 'la pregunta' } } } }), 'la pregunta');
  assert.equal(textoCitado({ conversation: 'x' }), null);
});

test('4. el cableado: antes del 👍 y de la cola; el eco firmado al anillo; con ticket, a ESE ticket', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  const iEco = doer.indexOf("return { engaged: false, skip: 'eco de mi propia respuesta' };");
  const iEquipo = doer.indexOf('const alEquipo = await contestaAlEquipo(wsData, instance, jid, data, texto, !audio && !adjunto);');
  const iCola = doer.indexOf('const nuevo = await encolar(jid,');
  const iPulgar = doer.indexOf('reaccionarMensaje(jid, data.key, EMOJI_RECIBIDO)');
  assert.ok(iEco > 0 && iEquipo > iEco && iCola > iEquipo && iPulgar > iEquipo, 'la respuesta al equipo se mira después del 👍 o de la cola');
  assert.match(doer, /if \(esFirmaDelEquipo\(texto\)\) \{\n\s*const \{ anotarLoDelEquipo \} = await import\('@\/lib\/mako-grupo'\);/);
  assert.match(doer, /if \(a\.ticket && \(await sumarAlPedidoDelNegocio\(wsData, a\.ticket, `\$\{quien\}: \$\{texto\}`\)/);
  assert.match(leer('lib/tickets-cierre.ts'), /\{ de: 'equipo', ticket: Number\(f\.id\) \}/, 'la respuesta del equipo a un ticket no lleva su ticket');
  assert.match(sinComentarios(leer('lib/tickets-db.ts')), /estado: tk\.estado === 'esperando_cliente' \? 'esperando_decision' : tk\.estado/, 'la respuesta no vuelve el ticket a la bandeja');
});

// ── Probado rompiéndolo (28/10/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   Q1 sin `contestaAlEquipo` en la entrada                                              → falla el 1 (y el 4)
//   Q2 el eco firmado no entra al anillo                                                 → falla el 1
//   Q3 sin la ventana (cualquier pregunta del equipo)                                    → falla el 2
//   Q4 sin mirar si MaKo habló después                                                   → falla el 1 (E) y el 2
//   Q5 la firma en cualquier lugar del texto                                             → falla el 3
//   Q6 el anillo sin el dedup por id                                                     → falla el 3
//   Q7 el aviso a SuperAdmin con la firma                                                → falla el 1
