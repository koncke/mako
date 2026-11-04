// Un contacto compartido en el grupo se busca por TELÉFONO antes de proponer un lead (27/10/2026, P6: el de Leila terminó en
// un lead nuevo; `buscar_leads` compara el texto tal cual). lib/contacto-compartido*.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bloqueDelContacto } from '../lib/contacto-compartido-reglas';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('1. si ya es un lead, lo dice con su número y pide no proponer otro; si no, se puede proponer; si no se pudo leer, no afirma', () => {
  const b = bloqueDelContacto([
    { contacto: { nombre: 'Juan Pérez', telefono: '+54 9 11 5555-5555' }, leads: [{ id: 812, nombre: 'Juan P.' }] },
    { contacto: { nombre: 'Ana', telefono: '+54 9 11 4444-4444' }, leads: [] },
    { contacto: { nombre: 'Rosa', telefono: '+54 9 11 3333-3333' }, leads: null },
  ]);
  assert.match(b, /^EL CONTACTO QUE COMPARTIERON, BUSCADO POR SU TELÉFONO EN EL CRM:/);
  assert.match(b, /- «Juan Pérez» \(\+54 9 11 5555-5555\): YA ES un lead: #812 Juan P\.\. NO propongas uno nuevo: trabaja con ése\./);
  assert.match(b, /- «Ana» \(\+54 9 11 4444-4444\): no hay ningún lead con ese teléfono/);
  assert.match(b, /- «Rosa» [^\n]*: no pude buscarlo en el CRM; búscalo con buscar_leads/);
  assert.equal(bloqueDelContacto([]), '');
});

test('2. el doer lo busca antes del turno y lo pone en el system (nunca al de la red)', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /const contactosCompartidos = contactosDelMensaje\(data\.message\);/);
  assert.match(doer, /\[bloqueQuienEscribe\(data\.pushName\), (?:ctxCita, )?(?:ctxParaElEquipo, )?ctxContacto, (?:ctxEquipo, ctxPedidos, )?ctxYaSeHablo, ctxMostrado\]/);
  const srv = leer('lib/contacto-compartido.ts');
  assert.match(srv, /\.like\('telefono_normalizado', `%\$\{norm\.slice\(-10\)\}`\)/, 'no busca por el teléfono normalizado');
});
