// El corpus es lo que de verdad aparece en un chat: alguien pegando su .env, un token
// de Meta, el teléfono de un lead. Si una de estas se escapa, viaja al servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactar, redactarTurnos, TOPE_TURNO } from '../lib/agente-redaccion';

const noQueda = (t: string, ...prohibido: string[]) => {
  for (const p of prohibido) assert.ok(!t.includes(p), `se escapó: ${p}\nen: ${t}`);
};

test('tapa las claves de los proveedores que usa este producto', () => {
  const casos: Array<[string, string]> = [
    ['mi key es sk-ant-api03-AAAABBBBCCCCDDDDEEEEFFFFGGGG', 'sk-ant-api03-AAAABBBBCCCCDDDDEEEEFFFFGGGG'],
    ['usá sk-proj-abcdefghijklmnopqrstuvwxyz123456', 'sk-proj-abcdefghijklmnopqrstuvwxyz123456'],
    ['GEMINI: AIzaSyA1234567890123456789012345678901234', 'AIzaSyA1234567890123456789012345678901234'],
    ['groq gsk_abcdefghijklmnopqrstuvwxyz0123', 'gsk_abcdefghijklmnopqrstuvwxyz0123'],
    ['token EAAGm0PX4ZCpsBA1234567890abcdefghijklmnopqrstuvwxyz0123456789', 'EAAGm0PX4ZCpsBA1234567890abcdefghijklmnopqrstuvwxyz0123456789'],
    ['ghp_abcdefghijklmnopqrstuvwxyz0123456789', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'],
  ];
  for (const [entrada, secreto] of casos) {
    const r = redactar(entrada);
    noQueda(r.texto, secreto);
    assert.ok(r.tapadas >= 1, `no contó la redacción de: ${entrada}`);
  }
});

test('tapa una línea de .env entera pero deja ver QUÉ variable era', () => {
  const r = redactar('META_ACCESS_TOKEN=EAAGm0PX4ZCpsBA1234567890abcdefghijklmnopqrstuvwxyz01');
  noQueda(r.texto, 'EAAGm0PX4ZCpsBA1234567890abcdefghijklmnopqrstuvwxyz01');
  // Saber que le falta el token de Meta es útil y no es sensible; el valor no lo es.
  assert.ok(r.texto.includes('META_ACCESS_TOKEN'), r.texto);
});

test('el email se tapa pero el dominio se queda: sirve para saber de qué empresa se habla', () => {
  const r = redactar('escribile a martin.perez@acme-corp.com así cerramos');
  noQueda(r.texto, 'martin.perez');
  assert.ok(r.texto.includes('acme-corp.com'), r.texto);
});

test('tapa teléfonos y contactos de WhatsApp, que es la PII que más circula acá', () => {
  const r = redactar('el lead es +54 9 11 5555-4444, su jid 5491155554444@s.whatsapp.net');
  noQueda(r.texto, '5555-4444', '5491155554444@s.whatsapp.net');
});

test('tapa la ruta del disco, donde suele estar el nombre real de la persona', () => {
  const w = redactar('mirá C:\\Users\\martin.koncke\\Desktop\\claves.txt');
  noQueda(w.texto, 'martin.koncke');
  const u = redactar('está en /Users/martinkoncke/proyectos/mako');
  noQueda(u.texto, 'martinkoncke');
});

test('NO se come texto normal: cero falsos positivos en una frase de trabajo', () => {
  const frase = 'Necesito 3 guiones para el avatar 2, con presupuesto de 50 USD por día y v1.2.3 del plugin';
  const r = redactar(frase);
  assert.equal(r.tapadas, 0, `tapó algo que no debía: ${r.texto}`);
  assert.equal(r.texto, frase);
});

test('recorta los turnos largos y cuenta las redacciones de todo el lote', () => {
  const largo = 'a'.repeat(TOPE_TURNO + 500);
  const { turnos, tapadas } = redactarTurnos([
    { ts: '2026-08-08T10:00:00Z', texto: largo },
    { ts: '2026-08-08T10:01:00Z', texto: 'mi key sk-ant-api03-AAAABBBBCCCCDDDDEEEEFFFF' },
    { texto: '   ' },
  ]);
  assert.equal(turnos.length, 2, 'el turno vacío tenía que descartarse');
  assert.equal(turnos[0].texto.length, TOPE_TURNO);
  assert.ok(tapadas >= 1);
  assert.ok(turnos[1].ts, 'sin ts, tiene que ponerse uno');
});
