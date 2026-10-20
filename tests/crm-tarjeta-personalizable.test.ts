// =============================================================================
// La tarjeta de un lead, personalizable por cada persona (20/10/2026)
// =============================================================================
// Martín, 20/10 (en la app, con captura de /crm): «Las cards, las debería poder personalizar también, por si el usuario
// quiere más o menos info». Decidido: POR PERSONA (`usuarios.perfil`, como sus avisos), la misma en todos los funnels
// — es cómo mira cada uno; por funnel le cambiaría la tarjeta a todo el equipo. Se elige en «⋯» › «Personalizar
// tarjetas» y se lee por la API de MaKo (`ver_campos_tarjeta_crm`, sólo app y sólo lectura, como el perfil).
//   1. lo guardado se limpia contra el catálogo y se ordena como la tarjeta (ejecutado);
//   2. el tablero dibuja cada dato sólo si la persona lo eligió, y el pop-up se abre desde el «⋯»;
//   3. se guarda en el perfil de la persona, y la página lo lee para quien mira;
//   4. la API lo declara sólo por la app y sólo como lectura.
//
// PROBADO ROMPIÉNDOLO (20/10/2026), con el archivo en 4 / 0 (5 / 0 con el teléfono), de a una rotura y restaurada:
//   · `camposTarjetaDe` devolviendo lo guardado sin limpiar                         → 3 / 1
//   · app/crm/CrmBoard.tsx de antes (la tarjeta fija, sin «Personalizar tarjetas»)  → 3 / 1
//   · (y el teléfono, abajo) app/m/crm/TableroCrm.tsx de antes                         → 4 / 1
// Correr: node --import tsx --test tests/crm-tarjeta-personalizable.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAMPOS_TARJETA_DEFAULT, CAMPOS_TARJETA_LEAD, camposTarjetaDe } from '../lib/tarjeta-kanban';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('lo guardado se limpia contra el catálogo, en el orden de la tarjeta', () => {
  assert.deepEqual(camposTarjetaDe(undefined), [...CAMPOS_TARJETA_DEFAULT], 'sin nada guardado: lo de siempre');
  assert.deepEqual(camposTarjetaDe('foto'), [...CAMPOS_TARJETA_DEFAULT], 'algo que no es una lista: lo de siempre');
  assert.deepEqual(camposTarjetaDe([]), [], 'una lista vacía es una elección (sólo el nombre)');
  assert.deepEqual(camposTarjetaDe(['telefono', 'nada', 'foto', 'foto', 3]), ['foto', 'telefono'], 'sin lo desconocido, sin repetidos, en orden');
  assert.ok(CAMPOS_TARJETA_DEFAULT.every((c) => CAMPOS_TARJETA_LEAD.includes(c)));
});

test('el tablero dibuja cada dato sólo si la persona lo eligió, y el pop-up sale del «⋯»', () => {
  const b = leer('app/crm/CrmBoard.tsx');
  assert.match(b, /sinCara=\{!ve\.has\('foto'\)\}/);
  assert.match(b, /ve\.has\('plata'\) \? \(isGanado \? montoDeTarjeta\(l\)\.texto/);
  assert.match(b, /ve\.has\('canal'\) \? l\.canal : null/);
  for (const c of ['vence', 'datos', 'agenda', 'fuera', 'empresa', 'telefono', 'campana', 'alta']) {
    assert.match(b, new RegExp(`ve\\.has\\('${c}'\\)`), `el dato «${c}» se dibuja sin mirar la elección`);
  }
  assert.match(b, /onPersonalizarTarjetas=\{\(\) => setPersonalizando\(true\)\}/);
  assert.match(b, /<CamposTarjetaModal campos=\{campos\} guardable=\{camposGuardables\} onCambio=\{setCampos\} onCerrar=\{cerrarPersonalizar\} \/>/);
  assert.match(leer('app/crm/CrmToolbar.tsx'), /label="Personalizar tarjetas"/);
  assert.match(leer('app/_ui/TarjetaKanban.tsx'), /\{sinCara \? null : <CaraTarjeta/);
});

test('se guarda en el perfil de la persona y la página lo lee para quien mira', () => {
  const p = leer('lib/perfil.ts');
  assert.match(p, /const TARJETA_CRM_KEY = 'crmTarjeta';/);
  const set = p.slice(p.indexOf('export async function setCamposTarjetaCrm'), p.indexOf('export async function setCamposTarjetaCrm') + 800);
  assert.match(set, /const limpios = camposTarjetaDe\(campos\);/, 'se guarda limpio');
  assert.match(set, /const u = await filaPropia\(\);/, 'se guarda en la fila de QUIEN MIRA');
  const page = leer('app/crm/page.tsx');
  assert.match(page, /const pCampos = getCamposTarjetaCrm\(\);/);
  assert.match(page, /camposTarjeta=\{camposTarjeta\.campos\}/);
  assert.match(leer('app/crm/tarjeta-campos-actions.ts'), /if \(!\(await getRolWsEfectivo\(\)\)\) return \{ ok: false/);
});

test('la API de MaKo lo lee sólo por la app (es de una persona), y no lo escribe', () => {
  const def = leer('lib/api-mako/areas/crm.def.ts');
  const i = def.indexOf("id: 'ver_campos_tarjeta_crm'");
  assert.ok(i > 0, 'la API no declara la tarjeta personalizada');
  const op = def.slice(i, def.indexOf('\n  },', i));
  assert.match(op, /tipo: 'lectura'/);
  assert.match(op, /canales: \['app'\]/, 'por WhatsApp o HTTP no hay sesión que diga quién es');
  assert.match(leer('lib/api-mako/areas/crm.run.ts'), /ver_campos_tarjeta_crm: \{\n\s+leer: async \(\) => \{\n\s+const \{ campos, guardable \} = await getCamposTarjetaCrm\(\);/);
});

// El teléfono sigue la MISMA elección (la foto, la plata y por dónde llegó): se elige en la computadora y vale ahí.
// Probado rompiéndolo (20/10/2026), con el archivo en 5 / 0: app/m/crm/TableroCrm.tsx de antes → 4 / 1.
test('el teléfono dibuja la tarjeta con la misma elección', () => {
  const t = leer('app/m/crm/TableroCrm.tsx');
  assert.match(t, /\{ve\.has\('foto'\) && <CaraTarjeta/);
  assert.match(t, /subtituloLead\(ve\.has\('plata'\) \? t\.plata : null, ve\.has\('canal'\) \? t\.canal : null\)/);
  assert.match(leer('app/m/crm/datos.ts'), /campos: \(await getCamposTarjetaCrm\(\)\)\.campos,/);
});
