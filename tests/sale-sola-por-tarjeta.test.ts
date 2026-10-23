// «Sale sola», de vuelta y a la vista, en cada tarjeta de WhatsApp (21/10/2026)
// =============================================================================
// Salió de la pantalla el 09/10 (Martín: «¿Qué es "Revisar antes de enviar"?... Quitalo») y el dato `revisar` lo
// siguió leyendo el motor: por el WhatsApp no oficial, a un lead sin pago, una tarjeta nueva queda como BORRADOR en
// Chats › Borradores sin que nada lo diga. Para la prospección del Sprint de Mauricio serían 1.000 borradores.
// Regla de Martín: MaKo NADA por detrás — toda regla escondida pasa a algo visible.
//
// Se fija: (1) lo que la casilla PINTA es lo que el MOTOR hace, para cada mensaje y cada combinación; (2) el lienzo
// la dibuja para el no oficial y escribe `revisar`; (3) dice lo de a quien ya pagó.
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { saleSolaDelPaso, agregarCaso, cambiarNodo, insertarDesdeLienzo, type PasoParaGrafo } from '../lib/flujo-conversacion';
import { escenariosDeRespuesta, nodoPorId, idDe } from '../lib/flujo-grafo';
import { saleSolo } from '../lib/nutricion-grafo-motor';

const rndDe = (semilla = 1) => { let s = semilla; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const msg = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...extra });

/** Una salida (un texto y un «IA») y «Si responde» con UN caso: su «MaKo contesta» y, en la misma rama, un texto. */
function conCaso(): PasoParaGrafo[] {
  const r: PasoParaGrafo[] = [
    msg('a', { siguiente: 'b' }), msg('b', { tipo: 'ia' }),
    { id: 'R', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'respuesta', casos: [], si_no: 'otra' } as PasoParaGrafo,
    { id: 'otra', canal: 'whatsapp', delay_horas: 0, cuerpo: '', siguiente: null, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento' } } } as PasoParaGrafo,
  ];
  const c = agregarCaso(r, 'R', rndDe(5));
  const ins = insertarDesdeLienzo(c.pasos, c.mensaje!, 'sig', 'mensaje', rndDe(9));
  return cambiarNodo(ins.pasos, ins.id!, { cuerpo: 'te paso el link' });
}

test('la casilla dice lo que el MOTOR hace: para cada mensaje, con y sin «sale sola» de la secuencia, y con revisar puesto o no', () => {
  const base = conCaso();
  const ids = base.map((p, i) => idDe(p, i)).filter((id) => { const p = nodoPorId(base, id)!; return !p.nodo && !p.accion; });
  assert.ok(ids.length >= 4, 'el fixture perdió mensajes');
  let combinaciones = 0;
  for (const envio of [true, false]) {
    for (const revisar of [undefined, true, false] as const) {
      for (const id of ids) {
        const pasos = cambiarNodo(base, id, { revisar } as Partial<PasoParaGrafo>);
        const p = nodoPorId(pasos, id)!;
        const esc = escenariosDeRespuesta(pasos).find((e) => e.siguiente === id && p.tipo === 'ia');
        const motor = esc ? esc.contestaSolo === true : saleSolo(p, envio);
        assert.equal(saleSolaDelPaso(p, pasos, id, envio), motor, `${id} revisar=${String(revisar)} envio=${envio}`);
        combinaciones += 1;
      }
    }
  }
  assert.ok(combinaciones >= 24);
});

test('un revisar que no es booleano no cuenta, y un mensaje que no es de la IA sale solo (23/10/2026)', () => {
  const pasos = [msg('a')];
  assert.equal(saleSolaDelPaso({ revisar: 'no' }, pasos, 'a', true), true);
  assert.equal(saleSolaDelPaso({ revisar: 1 }, pasos, 'a', false), true);
  assert.equal(saleSolaDelPaso({ revisar: true }, pasos, 'a', false), true, 'un mensaje de una automatización quedó para aprobar');
});

// ── El lienzo ───────────────────────────────────────────────────────────────────────────────────────────────────
const LIENZO = readFileSync(join(__dirname, '..', 'app/automations/FlujoLienzo.tsx'), 'utf8').replace(/\r\n/g, '\n');
const ini = LIENZO.indexOf('<div data-sale-sola');
const casilla = ini < 0 ? '' : LIENZO.slice(LIENZO.lastIndexOf('{noOficial', ini), LIENZO.indexOf('</div>', ini));

// ⚠️ 23/10/2026 (Martín por el Cerebro: «SACÁ el "Llega sola" de la tarjeta de WhatsApp»): la casilla se fue, y con ella el
// borrador escondido (el motor ya no deja de borrador un mensaje: `saleSolo`).
test('el lienzo ya NO dibuja «Sale sola» en la tarjeta de WhatsApp', () => {
  assert.equal(ini, -1, 'volvió la casilla «Sale sola»');
  assert.doesNotMatch(LIENZO, /label="Sale sola"/);
  void casilla;
});

// ── Las roturas (4 tests; sin romper nada: 4 pases, 0 fallos) ──────────────────────────────────────────────────────
// 1. `saleSolaDelPaso` sin el `revisarHeredado` (sin elegir = la secuencia a secas, el bug de costuras-3): 1 fallo / 3 pases.
// 2. `saleSolaDelPaso` con `revisar` truthy (no estricto): 1 fallo / 3 pases.
// 3. El lienzo escribiendo `revisar: v` (al revés): 1 fallo / 3 pases.
// 4. La casilla también en el recordatorio (sin `!recordatorio`): 1 fallo / 3 pases.
