// =============================================================================
// Clientes: «Personalizar tarjetas» con PLANTILLAS, «Nuevo cliente» al «⋯» de la columna y el clic derecho (21/10/2026)
// =============================================================================
// Martín, 21/10/2026: «el pop-up debe ser mucho más grueso y poder ver TEMPLATES de estilos de tarjeta… como las que
// tenemos en CLIENTES y puedes crear otras más, como otra que no tenga foto de perfil, piensa en varios diseños», «Revisa
// estos feedbacks que te doy en otros lugares para implementar lo mismo, la personalización de las tarjetas en clientes,
// plan, etc.», «si le doy click derecho a las cards, debería poder ver la opción de "Personalizar tarjeta"» y «Quiero que
// elimines el botón de "nuevo lead" de donde está en las columnas y lo pongas dentro de los 3 puntos de cada columna».
// El molde es el del CRM (tests/crm-tarjeta-personalizable.test.ts y tests/crm-feedback-21-10.test.ts):
//   1. el catálogo y las plantillas de fábrica, válidos (ejecutado);
//   2. lo guardado se limpia (en el orden del catálogo: cada dato tiene su lugar) y las propias se conservan; lo que
//      pide MaKo se resuelve con `pedidoDeTarjeta` (ejecutado);
//   3. la tarjeta traduce cada dato (`ClienteCard`);
//   4. el pop-up recibe las plantillas de Clientes y dibuja la tarjeta de verdad; «Personalizar tarjetas» en el «⋯»;
//   5. «Nuevo cliente» va al «⋯» de cada columna y el carril ya no lo tiene;
//   6. el clic derecho en una tarjeta: «Abrir ficha» y «Personalizar tarjeta», con las guardas del CRM;
//   7. se guarda en el perfil de la persona y la página lo lee para quien mira;
//   8. la API de MaKo declara la lectura y la acción, sólo por la app y confirmada por la persona.
//
// PROBADO ROMPIÉNDOLO (21/10/2026), con el archivo en 8 / 0, una rotura por vez y restaurada:
//   · `camposTarjetaClienteDe` en el orden de la persona (no del catálogo)                → 7 / 1
//   · `prefsTarjetaClientesDe` sin leer las propias                                       → 7 / 1
//   · `pedidoDeTarjeta` sin el «La tarjeta ya está así»                                  → 7 / 1
//   · ClienteCard: `sinCara={false}` (sin foto sigue la cara)                             → 7 / 1
//   · ClienteCard: los tres números aunque `trabajo` no esté elegido                      → 7 / 1
//   · el pop-up con `ordenFijo` sumando al final (`[...campos, c]`)                       → 7 / 1
//   · la vista previa sin `forma={f} campos={cs}`                                         → 7 / 1
//   · «Personalizar tarjetas» también en la tabla (`true` en vez de `enKanban`)           → 7 / 1
//   · «＋ Nuevo cliente» de vuelta en el carril                                           → 7 / 1
//   · el «⋯» de la columna con `onChange={() => {}}`                                      → 7 / 1
//   · el clic derecho sin la guarda del modal abierto (`aria-modal`)                      → 7 / 1
//   · «Personalizar tarjeta» del clic derecho sin abrir el pop-up                         → 7 / 1
//   · `setTarjetaClientes` pisando las propias cuando no llegan                           → 7 / 1
//   · la acción con `canales: SIN_HTTP` (también por WhatsApp)                            → 7 / 1
//   · la acción sin `faltaParaConfirmar`                                                  → 7 / 1
// Correr: node --import tsx --test tests/clientes-tarjeta-plantillas.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAMPOS_TARJETA_CLIENTE, CAMPOS_TARJETA_CLIENTE_DEFAULT, FORMAS_TARJETA_CLIENTE, NOMBRE_CAMPO_TARJETA_CLIENTE, PLANTILLAS_TARJETA_CLIENTE,
  camposTarjetaClienteDe, prefsTarjetaClientesDe,
} from '../lib/tarjeta-clientes';
import { pedidoDeTarjeta, plantillaPuesta } from '../lib/plantillas-tarjeta';
import { DEFS } from '../lib/api-mako/areas/cs.def';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, desde: string, hasta: string) => {
  const a = src.indexOf(desde);
  const b = src.indexOf(hasta, a + desde.length);
  assert.ok(a >= 0 && b > a, `no encontré el tramo «${desde}»`);
  return src.slice(a, b);
};

const TABLERO = {
  fabrica: PLANTILLAS_TARJETA_CLIENTE, formas: FORMAS_TARJETA_CLIENTE, campos: CAMPOS_TARJETA_CLIENTE,
  limpiarCampos: camposTarjetaClienteDe, nombreCampo: NOMBRE_CAMPO_TARJETA_CLIENTE, donde: 'Clientes',
};

test('el catálogo y las plantillas de fábrica: válidas, la primera es la de siempre, y están las que pidió Martín', () => {
  assert.deepEqual([...CAMPOS_TARJETA_CLIENTE], ['foto', 'empresa', 'avance', 'trabajo']);
  assert.deepEqual([...FORMAS_TARJETA_CLIENTE], ['completa', 'compacta', 'portada']);
  assert.deepEqual([...CAMPOS_TARJETA_CLIENTE_DEFAULT], [...CAMPOS_TARJETA_CLIENTE], 'la de siempre lleva todo');
  const [primera] = PLANTILLAS_TARJETA_CLIENTE;
  assert.equal(primera.id, 'fabrica:completa');
  assert.equal(primera.forma, 'completa');
  assert.deepEqual([...primera.campos], [...CAMPOS_TARJETA_CLIENTE_DEFAULT]);
  assert.equal(new Set(PLANTILLAS_TARJETA_CLIENTE.map((p) => p.id)).size, PLANTILLAS_TARJETA_CLIENTE.length, 'ids repetidos');
  assert.equal(new Set(PLANTILLAS_TARJETA_CLIENTE.map((p) => p.nombre)).size, PLANTILLAS_TARJETA_CLIENTE.length, 'nombres repetidos');
  for (const p of PLANTILLAS_TARJETA_CLIENTE) {
    assert.ok(FORMAS_TARJETA_CLIENTE.includes(p.forma), `«${p.nombre}» con una forma que no existe`);
    // En el orden del catálogo: si no, `plantillaPuesta` no la reconocería al leerla del perfil.
    assert.deepEqual(camposTarjetaClienteDe(p.campos), [...p.campos], `«${p.nombre}» con un dato que no existe o fuera de orden`);
    assert.equal(plantillaPuesta(PLANTILLAS_TARJETA_CLIENTE, p.forma, p.campos)?.id, p.id, `«${p.nombre}» repite a otra`);
  }
  const por = (n: string) => PLANTILLAS_TARJETA_CLIENTE.find((p) => p.nombre === n);
  for (const n of ['Completa', 'Compacta', 'Sin foto', 'Con portada', 'Sin avance', 'Sólo el nombre']) assert.ok(por(n), `falta la plantilla «${n}»`);
  assert.deepEqual({ forma: por('Compacta')!.forma, campos: [...por('Compacta')!.campos] }, { forma: 'compacta', campos: ['foto', 'avance'] });
  assert.ok(!por('Sin foto')!.campos.includes('foto'), 'Martín: «otra que no tenga foto de perfil»');
  assert.equal(por('Con portada')!.forma, 'portada');
  assert.ok(!por('Sin avance')!.campos.includes('avance'));
  assert.deepEqual({ forma: por('Sólo el nombre')!.forma, campos: [...por('Sólo el nombre')!.campos] }, { forma: 'compacta', campos: [] });
});

test('lo guardado se limpia en el orden del catálogo, las propias se conservan, y lo que pide MaKo se resuelve', () => {
  assert.deepEqual(camposTarjetaClienteDe(undefined), [...CAMPOS_TARJETA_CLIENTE_DEFAULT], 'sin nada guardado: lo de siempre');
  assert.deepEqual(camposTarjetaClienteDe('foto'), [...CAMPOS_TARJETA_CLIENTE_DEFAULT], 'algo que no es una lista: lo de siempre');
  assert.deepEqual(camposTarjetaClienteDe([]), [], 'una lista vacía es una elección (sólo el nombre)');
  assert.deepEqual(camposTarjetaClienteDe(['trabajo', 'nada', 'foto', 'foto', 3]), ['foto', 'trabajo'], 'en el orden del CATÁLOGO, sin lo desconocido ni repetidos');
  assert.deepEqual(prefsTarjetaClientesDe(null), { forma: 'completa', campos: [...CAMPOS_TARJETA_CLIENTE_DEFAULT], plantillas: [] });
  assert.deepEqual(prefsTarjetaClientesDe({ forma: 'gigante', campos: ['avance'] }), { forma: 'completa', campos: ['avance'], plantillas: [] }, 'una forma que no existe: la de siempre');
  assert.deepEqual(prefsTarjetaClientesDe({
    forma: 'portada', campos: [],
    plantillas: [
      { id: 'propia:a1', nombre: '  Mi  tarjeta ', forma: 'compacta', campos: ['trabajo', 'foto', 'plata'] },
      { id: 'propia:b2', nombre: 'Del CRM', forma: 'monto', campos: [] },
      'basura',
    ],
  }), { forma: 'portada', campos: [], plantillas: [{ id: 'propia:a1', nombre: 'Mi tarjeta', forma: 'compacta', campos: ['foto', 'trabajo'] }] },
  'las propias, limpias con la misma regla (una forma del CRM no es de acá)');

  const actual = { forma: 'completa' as const, campos: [...CAMPOS_TARJETA_CLIENTE_DEFAULT], plantillas: [] };
  const p = pedidoDeTarjeta({ plantilla: 'sin FOTO' }, actual, TABLERO, 'propia:x');
  assert.ok(p.ok && p.forma === 'completa' && p.plantilla === 'Sin foto' && !p.campos.includes('foto'), 'una plantilla por su nombre, sin mayúsculas');
  const q = pedidoDeTarjeta({ forma: 'compacta', campos: ['trabajo', 'foto'] }, actual, TABLERO, 'propia:x');
  assert.ok(q.ok && q.forma === 'compacta');
  assert.deepEqual(q.ok ? q.campos : null, ['foto', 'trabajo'], 'los datos, en el orden del catálogo');
  assert.deepEqual(pedidoDeTarjeta({ campos: ['plata'] }, actual, TABLERO, 'propia:x').ok, false, 'un dato del CRM no es de acá');
  assert.deepEqual(pedidoDeTarjeta({ plantilla: 'Completa' }, actual, TABLERO, 'propia:x'), { ok: false, error: 'La tarjeta ya está así.', yaEstaba: true });
  const g = pedidoDeTarjeta({ plantilla: 'Compacta', guardarComo: 'La mía' }, actual, TABLERO, 'propia:n1');
  assert.ok(g.ok && g.propias?.length === 1 && g.propias[0].id === 'propia:n1' && g.propias[0].nombre === 'La mía', '«puedes crear otras más»');
  assert.equal(pedidoDeTarjeta({}, actual, TABLERO, 'propia:x').ok, false, 'sin plantilla ni forma ni datos, no hay pedido');
});

test('la tarjeta traduce cada dato: sin foto, sin empresa, sin avance, sin trabajo; y la forma', () => {
  const card = sinComentarios(leer('app/customer-success/ClienteCard.tsx'));
  const cuerpo = tramo(card, 'export function ClienteCard(', '\n}\n');
  assert.match(cuerpo, /forma = 'completa', campos = CAMPOS_TARJETA_CLIENTE_DEFAULT \}/, 'sin elección, la de siempre');
  assert.match(cuerpo, /sinCara=\{!campos\.includes\('foto'\)\}/, 'sin foto, sin la cara');
  assert.match(cuerpo, /subtitulo=\{campos\.includes\('empresa'\) \? \(c\.empresa\?\.trim\(\) \|\| `Cliente \$\{n\}`\) : undefined\}/, 'sin empresa, sin subtítulo');
  assert.match(cuerpo, /const conAvance = campos\.includes\('avance'\) \? \(avance \?\? null\) : null;/);
  assert.match(cuerpo, /avance=\{conAvance\}/, 'sin avance, sin la barra');
  assert.match(cuerpo, /\{conAvance \? null : chipExtra\}/, 'sin la barra vuelve el «hace cuánto»');
  assert.match(cuerpo, /const conTrabajo = campos\.includes\('trabajo'\);/);
  assert.match(cuerpo, /\{!conTrabajo \? null : tableroOk \? \(\s*<span className="tk-chip tk-chip--gris">/, 'sin trabajo, sin los tres números');
  assert.ok(cuerpo.indexOf('No pude leer el tablero') > cuerpo.indexOf('{!conTrabajo ? null : tableroOk ? ('), '«No pude leer el tablero» sólo con el dato elegido');
  assert.match(cuerpo, /compacta=\{forma === 'compacta'\}/);
  assert.match(cuerpo, /portada=\{forma === 'portada' \? colorDeNombre\(nombre\) : null\}/);
});

test('el pop-up: las plantillas de Clientes, la tarjeta de verdad, el orden fijo; y «Personalizar tarjetas» en el «⋯» del kanban', () => {
  const app = sinComentarios(leer('app/customer-success/ClientesApp.tsx'));
  const pop = tramo(app, '<PersonalizarTarjetas<FormaTarjetaCliente, CampoTarjetaCliente>', 'sinMuestra=');
  assert.match(pop, /fabrica=\{PLANTILLAS_TARJETA_CLIENTE\} propias=\{plantillasTarjeta\} forma=\{formaTarjeta\} campos=\{camposTarjeta\}/);
  assert.match(pop, /catalogo=\{CAMPOS_TARJETA_CLIENTE\} nombreCampo=\{NOMBRE_CAMPO_TARJETA_CLIENTE\}/);
  assert.match(pop, /\n\s+ordenFijo\n/, 'cada dato tiene su lugar: sin arrastre');
  assert.match(pop, /const r = await atajar\(guardarTarjetaClientesAction\(cs, f, ps\), 'No pude guardarlo\.'\);/, 'sin red, el «no se guardó» llega (la regla de ClientesApp)');
  assert.match(pop, /<div inert>\s*<ClienteCard c=\{muestraTarjeta\}[\s\S]*?forma=\{f\} campos=\{cs\} \/>/, 'la vista previa es la tarjeta del kanban, con lo que se elige');
  // El kanban dibuja con lo elegido, y su clic derecho abre el mismo pop-up.
  const kanban = tramo(app, '<KanbanEntrega', '/>\n');
  assert.match(kanban, /forma=\{formaTarjeta\} campos=\{camposTarjeta\}/);
  assert.match(kanban, /onPersonalizar=\{\(\) => setPersonalizando\(true\)\}/);
  assert.match(sinComentarios(leer('app/customer-success/KanbanEntrega.tsx')), /forma=\{forma\} campos=\{campos\}/, 'el kanban se lo pasa a cada tarjeta');
  // El «⋯» de la barra: sólo en el kanban (en la tabla no cambiaría nada de lo que se ve).
  const extra = tramo(app, 'accionesExtra={[', ']}\n');
  assert.match(extra, /\.\.\.\(enKanban \? \[\{\s*key: 'personalizar',[\s\S]*?label: 'Personalizar tarjetas'[\s\S]*?onClick: \(\) => setPersonalizando\(true\)/);
  // El pop-up con `ordenFijo`: sin ↑ ↓ y lo que se suma entra en el orden del catálogo.
  const m = sinComentarios(leer('app/_ui/PersonalizarTarjetas.tsx'));
  assert.match(m, /const sumarCampo = \(c: C\) => void aplicar\(forma, ordenFijo \? catalogo\.filter\(\(x\) => x === c \|\| campos\.includes\(x\)\) : \[\.\.\.campos, c\]\);/);
  assert.match(m, /\{!ordenFijo && \(\s*<>\s*<button type="button" style=\{flecha\}/);
});

test('«Nuevo cliente» sale del carril y va al «⋯» de cada columna, por el mismo camino', () => {
  const k = sinComentarios(leer('app/customer-success/KanbanEntrega.tsx'));
  assert.doesNotMatch(k, /ke-nuevo-col|＋ Nuevo cliente/, 'el botón volvió al carril');
  const cab = tramo(k, '<header className="ke-cab">', '</header>');
  assert.match(cab, /<span data-nodrag style=\{\{ flex: 'none', display: 'inline-flex' \}\}>\s*<Dropdown/, 'abrir el menú no arrastra');
  assert.match(cab, /placeholder="⋯"/);
  assert.match(cab, /\n\s+sinFlecha\n/);
  assert.match(cab, /options=\{\[\{ value: 'nuevo', label: 'Nuevo cliente', icono: 'persona-mas' as const \}\]\}/);
  assert.match(cab, /onChange=\{\(v\) => \{ if \(v === 'nuevo'\) onNuevoCliente\(e\.key\); \}\}/, 'nace en ESTA etapa, como antes');
  const carril = tramo(k, '</header>', '{cards.map(');
  assert.doesNotMatch(carril, /<button|onNuevoCliente/, 'el carril volvió a tener el alta');
});

test('clic derecho en una tarjeta → «Abrir ficha» y «Personalizar tarjeta», con las guardas del CRM', () => {
  const k = sinComentarios(leer('app/customer-success/KanbanEntrega.tsx'));
  assert.match(k, /<div className="ke" onContextMenu=\{alClicDerecho\}>/);
  assert.match(k, /<div data-tarjeta data-lead-id=\{c\.leadId\} className=/, 'la tarjeta dice quién es');
  const f = tramo(k, 'const alClicDerecho = ', '\n  };');
  assert.match(f, /if \(t\.closest\('\[role="dialog"\], \[role="menu"\], \[role="listbox"\]'\) \|\| document\.querySelector\('\[aria-modal="true"\]'\)\) return;/, 'no pisa un diálogo ni un modal');
  assert.match(f, /if \(t\.closest\('input:not\(\[type="checkbox"\]\), textarea, select, \[contenteditable="true"\], \[contenteditable=""\], a\[href\]'\)\) return;/, 'ni un campo ni un link');
  assert.match(f, /t\.closest<HTMLElement>\('\[data-lead-id\]'\)/);
  assert.match(f, /ev\.preventDefault\(\);/);
  assert.match(k, /\{ id: 'abrir', label: 'Abrir ficha', icono: 'ver' \}/);
  assert.match(k, /\{ id: 'personalizar_tarjeta', label: 'Personalizar tarjeta', icono: 'configurar' as const \}/);
  const elegir = tramo(k, 'const elegirDelMenu = ', '\n  };');
  assert.match(elegir, /if \(id === 'abrir'\) onAbrir\(leadId\);/);
  assert.match(elegir, /if \(id === 'personalizar_tarjeta'\) onPersonalizar\?\.\(\);/);
});

test('se guarda en el perfil de la persona, sin pisar sus propias, y la página lo lee para quien mira', () => {
  const p = leer('lib/perfil.ts');
  assert.match(p, /const TARJETA_CLIENTES_KEY = 'clientesTarjeta';/);
  const set = tramo(p, 'export async function setTarjetaClientes', '\n}\n');
  assert.match(set, /const u = await filaPropia\(\);/, 'en la fila de QUIEN MIRA');
  assert.match(set, /prefsTarjetaClientesDe\(\{ campos, forma, plantillas: plantillas === undefined \? propiasGuardadas\(u, TARJETA_CLIENTES_KEY\) : plantillas \}\)/, 'sin pisar las propias');
  assert.match(set, /const perfil = \{ \.\.\.u\.perfil, \[TARJETA_CLIENTES_KEY\]: limpios \};/, 'sin borrar las otras claves del perfil');
  const act = sinComentarios(leer('app/customer-success/tarjeta-actions.ts'));
  assert.match(act, /await exigirSesion\(\);\s*const no = await puedeUsarCs\(\); if \(no\) return \{ ok: false, error: no \};/);
  const pag = leer('app/customer-success/pantalla.tsx');
  assert.match(pag, /const lecturaTarjeta = getTarjetaClientes\(\);/);
  assert.match(pag, /tarjeta=\{tarjeta\}/);
});

test('la API de MaKo: ver_tarjeta_clientes y personalizar_tarjetas_clientes, sólo por la app y confirmada por la persona', () => {
  const ver = DEFS.find((d) => d.id === 'ver_tarjeta_clientes');
  assert.ok(ver, 'la API no declara la lectura');
  assert.equal(ver.tipo, 'lectura');
  assert.deepEqual([...ver.canales], ['app'], 'por WhatsApp o HTTP no hay sesión que diga quién es');
  const acc = DEFS.find((d) => d.id === 'personalizar_tarjetas_clientes');
  assert.ok(acc, 'la API no declara la acción');
  assert.equal(acc.tipo, 'accion');
  assert.equal(acc.confirmacion, 'chat');
  assert.deepEqual([...acc.canales], ['app']);
  assert.deepEqual(acc.gating, { tab: 'customer-success' });
  const run = leer('lib/api-mako/areas/cs.run.ts');
  assert.match(run, /ver_tarjeta_clientes: \{\n\s+leer: async \(\) => \{\n\s+const \{ forma, campos, plantillas, guardable \} = await getTarjetaClientes\(\);/);
  assert.match(run, /personalizar_tarjetas_clientes: \{\n\s+faltaParaConfirmar: async \(payload, ctx\) => \{/, 'sólo la confirma la persona de la tarjeta');
  assert.match(run, /payload: \{ email, forma: r\.forma, campos: r\.campos, \.\.\.\(r\.propias \? \{ plantillas: r\.propias \} : \{\}\) \}/);
  assert.match(run, /const r = await setTarjetaClientes\(payload\.campos, payload\.forma, payload\.plantillas\);/);
});
