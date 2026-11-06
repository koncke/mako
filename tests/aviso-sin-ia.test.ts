// =============================================================================
// Un aviso que la IA no redactó NO sale con el ejemplo de fábrica (06/11/2026)
// =============================================================================
// `generarMensajeAviso` (lib/plantillas.ts) devolvía la referencia tal cual cuando la IA fallaba, y la referencia de un
// negocio que nunca editó el texto es el EJEMPLO del catálogo, con una reunión inventada y el link a un lead de otro
// negocio (docs/relevo/automations-nube-2710.md, Leila 1). La regla vive en lib/aviso-sin-ia.ts.
//
// PROBADO ROMPIÉNDOLO (base 3 / 0):
//   · `textoSinIA` devolviendo siempre `resuelta` (lo de antes)                → 2 / 1
//   · `generarMensajeAviso` volviendo a `return ref;` en el catch              → 2 / 1
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { textoSinIA } from '../lib/aviso-sin-ia';
import { CATALOGO_AVISOS } from '../lib/avisos-catalogo';

const RAIZ = join(__dirname, '..');

test('sin la IA: el ejemplo de fábrica no sale; salen los datos reales del evento', () => {
  const cat = CATALOGO_AVISOS.find((c) => c.id === 'reunion-recordatorio' && c.ejemplo);
  assert.ok(cat?.ejemplo, 'el catálogo tiene el ejemplo del recordatorio');
  const contexto = 'Reunión R1 con Paola Rivas en 30 minutos. Resumen: https://hola-mako.com/crm/77/resumen';
  const out = textoSinIA({ referencia: cat!.ejemplo!, resuelta: cat!.ejemplo!, deFabrica: cat!.ejemplo, contexto });
  assert.equal(out, contexto);
  assert.doesNotMatch(out, /Laura Gil|crm\/482/, 'nada del ejemplo inventado');
});

test('sin la IA: el texto que escribió el negocio sale, con sus variables resueltas', () => {
  const out = textoSinIA({ referencia: 'Hola, {{lead_nombre}} agendó', resuelta: 'Hola, Paola agendó', deFabrica: 'Ejemplo de fábrica', contexto: 'datos' });
  assert.equal(out, 'Hola, Paola agendó');
  // Un contexto vacío no deja el aviso sin texto.
  assert.equal(textoSinIA({ referencia: 'Ejemplo', resuelta: 'Ejemplo', deFabrica: 'Ejemplo', contexto: '  ' }), 'Ejemplo');
});

test('CABLEADO: generarMensajeAviso usa la regla en los dos retornos sin IA', () => {
  const src = readFileSync(join(RAIZ, 'lib/plantillas.ts'), 'utf8').replace(/\r\n/g, '\n');
  const cuerpo = src.slice(src.indexOf('export async function generarMensajeAviso('));
  const fin = cuerpo.indexOf('\n}\n');
  const f = cuerpo.slice(0, fin);
  assert.ok(f.length > 300, 'encontré la función');
  assert.match(f, /const sinIA = textoSinIA\(/);
  assert.match(f, /return out\.trim\(\) \|\| sinIA;/);
  assert.match(f, /catch \{\n\s*return sinIA;/);
  assert.doesNotMatch(f, /return ref;|\|\| ref;/, 'ningún retorno devuelve la referencia cruda');
});
