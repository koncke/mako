// =============================================================================
// La tarjeta de un lead, personalizable por cada persona (20/10/2026)
// =============================================================================
// Martín, 13/10: «Tener varios diseños template, como el que tenemos en Clientes, y otros. Y poder elegir qué datos se
// colocan en la tarjeta… que siempre los personalizables muestren en tiempo real cómo quedaría y que se pueda arrastrar
// campos, acomodarlos». Y el 20/10: «Las cards, las debería poder personalizar también, por si el usuario quiere más o
// menos info». Decidido: POR PERSONA (`usuarios.perfil`, como sus avisos), la misma en todos los funnels. Se elige en
// «⋯» › «Personalizar tarjetas» y se lee por la API de MaKo (`ver_campos_tarjeta_crm`, sólo app y sólo lectura).
//   1. lo guardado se limpia y conserva EL ORDEN de la persona; el diseño se lee también del formato viejo (ejecutado);
//   2. el tablero arma la tarjeta con UNA función (datos en orden, diseño, avance) que también arma la vista previa;
//   3. el pop-up: la tarjeta en vivo, los tres diseños, arrastrar y ↑ ↓ para acomodar;
//   4. se guarda en el perfil de la persona, y la página lo lee para quien mira;
//   5. la API lo declara sólo por la app y sólo como lectura;
//   6. el teléfono sigue la misma elección (la foto, y la plata y el canal en su orden).
//
// PROBADO ROMPIÉNDOLO (20/10/2026, noche), con el archivo en 6 / 0, de a una rotura y restaurada:
//   · `camposTarjetaDe` volviendo a ordenar por el catálogo (perdía el orden arrastrado)  → 5 / 1
//   · app/crm/CrmBoard.tsx de antes (chips fijos, sin diseño ni vista previa)            → 5 / 1
//   · app/crm/CamposTarjetaModal.tsx de antes (sólo casillas, sin arrastre ni diseño)    → 5 / 1
//   · app/m/crm/TableroCrm.tsx de antes (sin la elección)                                 → 5 / 1
// Correr: node --import tsx --test tests/crm-tarjeta-personalizable.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAMPOS_TARJETA_DEFAULT, CAMPOS_TARJETA_LEAD, camposTarjetaDe, moverCampo, prefsTarjetaDe, subtituloEnOrden,
} from '../lib/tarjeta-kanban';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('lo guardado se limpia y conserva el orden de la persona; el diseño, también del formato viejo', () => {
  assert.deepEqual(camposTarjetaDe(undefined), [...CAMPOS_TARJETA_DEFAULT], 'sin nada guardado: lo de siempre');
  assert.deepEqual(camposTarjetaDe('foto'), [...CAMPOS_TARJETA_DEFAULT], 'algo que no es una lista: lo de siempre');
  assert.deepEqual(camposTarjetaDe([]), [], 'una lista vacía es una elección (sólo el nombre)');
  assert.deepEqual(camposTarjetaDe(['telefono', 'nada', 'foto', 'telefono', 3]), ['telefono', 'foto'], 'en SU orden, sin lo desconocido ni repetidos');
  assert.ok(CAMPOS_TARJETA_DEFAULT.every((c) => CAMPOS_TARJETA_LEAD.includes(c)));
  assert.deepEqual(prefsTarjetaDe(['canal', 'foto']), { diseno: 'completa', campos: ['canal', 'foto'] }, 'el formato del 20/10 (sólo la lista)');
  assert.deepEqual(prefsTarjetaDe({ diseno: 'avance', campos: ['plata'] }), { diseno: 'avance', campos: ['plata'] });
  assert.equal(prefsTarjetaDe({ diseno: 'gigante', campos: [] }).diseno, 'completa', 'un diseño que no existe: el de siempre');
  assert.equal(subtituloEnOrden(['canal', 'foto', 'plata'], { plata: '$97', canal: 'WhatsApp' }), 'WhatsApp · $97', 'la plata y el canal en SU orden');
  assert.equal(subtituloEnOrden(['plata'], { plata: '$97', canal: 'WhatsApp' }), '$97');
  assert.equal(subtituloEnOrden(['canal'], { plata: '$97', canal: 'Sin origen' }), '', 'el relleno «Sin origen» no es un dato');
  assert.deepEqual(moverCampo(['foto', 'plata', 'canal'], 2, 0), ['canal', 'foto', 'plata']);
  assert.deepEqual(moverCampo(['foto', 'plata'], 0, 5), ['foto', 'plata'], 'fuera de rango no mueve');
});

test('el tablero arma la tarjeta con UNA función, que también arma la vista previa', () => {
  const b = leer('app/crm/CrmBoard.tsx');
  assert.match(b, /\{\.\.\.propsDeTarjeta\(l, campos, diseno\)\}/, 'la tarjeta del tablero');
  assert.match(b, /\{\.\.\.propsDeTarjeta\(muestraTarjeta, cs, d\)\}/, 'la vista previa, con la MISMA función');
  const f = b.slice(b.indexOf('const propsDeTarjeta = '), b.indexOf('const muestraTarjeta = '));
  assert.match(f, /sinCara: !cs\.includes\('foto'\)/);
  assert.match(f, /compacta: dis === 'compacta'/);
  assert.match(f, /avance: dis === 'avance' && iPaso >= 0/, 'el diseño «Con avance» lleva la barra del paso');
  assert.match(f, /subtitulo: subtituloEnOrden\(cs,/, 'la plata y el canal en el orden de la persona');
  assert.match(f, /chips: <>\{cs\.map\(\(c\) => <Fragment key=\{c\}>\{chip\(c\)\}<\/Fragment>\)\}<\/>/, 'los chips en el orden de la persona');
  for (const c of ['vence', 'datos', 'agenda', 'fuera', 'empresa', 'telefono', 'campana', 'alta']) assert.match(f, new RegExp(`case '${c}':`), `falta el dato «${c}»`);
  assert.match(b, /onPersonalizarTarjetas=\{\(\) => setPersonalizando\(true\)\}/);
  assert.match(leer('app/crm/CrmToolbar.tsx'), /label="Personalizar tarjetas"/);
  const kit = leer('app/_ui/TarjetaKanban.tsx');
  assert.match(kit, /\{sinCara \? null : <CaraTarjeta/);
  assert.match(kit, /compacta \? 'tk--compacta' : ''/);
});

test('el pop-up: la tarjeta en vivo, los tres diseños, y arrastrar o ↑ ↓ para acomodar', () => {
  const m = leer('app/crm/CamposTarjetaModal.tsx');
  assert.match(m, /\{vistaPrevia \? vistaPrevia\(campos, diseno\) :/, 'la tarjeta en vivo');
  assert.match(m, /role="radiogroup" aria-label="Diseño de la tarjeta"[\s\S]{0,240}\{DISENOS_TARJETA\.map\(/, 'los diseños');
  assert.match(m, /onDrop=\{\(e\) => \{ e\.preventDefault\(\); if \(arrastrado != null\) mover\(arrastrado, i\);/, 'arrastrar para acomodar');
  assert.match(m, /onClick=\{\(\) => mover\(i, i - 1\)\}[\s\S]{0,200}onClick=\{\(\) => mover\(i, i \+ 1\)\}/, 'y con el teclado');
  assert.match(m, /const mover = \(de: number, a: number\) => void guardar\(moverCampo\(campos, de, a\), diseno\);/);
});

test('se guarda en el perfil de la persona y la página lo lee para quien mira', () => {
  const p = leer('lib/perfil.ts');
  assert.match(p, /const TARJETA_CRM_KEY = 'crmTarjeta';/);
  const set = p.slice(p.indexOf('export async function setCamposTarjetaCrm'), p.indexOf('export async function setCamposTarjetaCrm') + 800);
  assert.match(set, /const limpios = prefsTarjetaDe\(\{ campos, diseno \}\);/, 'se guarda limpio');
  assert.match(set, /const u = await filaPropia\(\);/, 'se guarda en la fila de QUIEN MIRA');
  const page = leer('app/crm/page.tsx');
  assert.match(page, /const pCampos = getCamposTarjetaCrm\(\);/);
  assert.match(page, /camposTarjeta=\{camposTarjeta\.campos\}\n\s+disenoTarjeta=\{camposTarjeta\.diseno\}/);
  assert.match(leer('app/crm/tarjeta-campos-actions.ts'), /await exigirSesion\(\);/);
});

test('la API de MaKo lo lee sólo por la app (es de una persona), y no lo escribe', () => {
  const def = leer('lib/api-mako/areas/crm.def.ts');
  const i = def.indexOf("id: 'ver_campos_tarjeta_crm'");
  assert.ok(i > 0, 'la API no declara la tarjeta personalizada');
  const op = def.slice(i, def.indexOf('\n  },', i));
  assert.match(op, /tipo: 'lectura'/);
  assert.match(op, /canales: \['app'\]/, 'por WhatsApp o HTTP no hay sesión que diga quién es');
  const run = leer('lib/api-mako/areas/crm.run.ts');
  assert.match(run, /ver_campos_tarjeta_crm: \{\n\s+leer: async \(\) => \{\n\s+const \{ campos, diseno, guardable \} = await getCamposTarjetaCrm\(\);/);
});

test('el teléfono dibuja la tarjeta con la misma elección', () => {
  const t = leer('app/m/crm/TableroCrm.tsx');
  assert.match(t, /\{campos\.includes\('foto'\) && <CaraTarjeta/);
  assert.match(t, /subtituloEnOrden\(campos, \{ plata: t\.plata, canal: t\.canal \}\)/);
  assert.match(leer('app/m/crm/datos.ts'), /campos: \(await getCamposTarjetaCrm\(\)\)\.campos,/);
});
