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
//   3. el pop-up (21/10/2026: la pieza de todos los tableros, app/_ui/PersonalizarTarjetas.tsx): la galería de plantillas
//      dibujadas con la tarjeta de verdad, la tarjeta en vivo, arrastrar y ↑ ↓ para acomodar, y guardar las propias;
//   4. se guarda en el perfil de la persona, y la página lo lee para quien mira;
//   5. la API lo declara sólo por la app y sólo como lectura;
//   6. el teléfono sigue la misma elección (la foto, y la plata y el canal en su orden).
//
// PROBADO ROMPIÉNDOLO (20/10/2026, noche), con el archivo en 6 / 0, de a una rotura y restaurada:
//   · `camposTarjetaDe` volviendo a ordenar por el catálogo (perdía el orden arrastrado)  → 5 / 1
//   · app/crm/CrmBoard.tsx de antes (chips fijos, sin diseño ni vista previa)            → 5 / 1
//   · app/crm/CamposTarjetaModal.tsx de antes (sólo casillas, sin arrastre ni diseño)    → 5 / 1
// Y el 21/10/2026 (las plantillas), con el archivo en 7 / 0:
//   · `prefsTarjetaDe` sin leer las propias                                              → 6 / 1
//   · la galería con un dibujo propio en vez de `vistaPrevia(p.forma, p.campos)`          → 6 / 1
//   · «Monto grande» con la plata también en el subtítulo (`subtituloEnOrden(cs,`)         → 6 / 1
//   · `setCamposTarjetaCrm` pisando las propias cuando no llegan                          → 6 / 1
//   · app/m/crm/TableroCrm.tsx de antes (sin la elección)                                 → 5 / 1
// Correr: node --import tsx --test tests/crm-tarjeta-personalizable.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAMPOS_TARJETA_DEFAULT, CAMPOS_TARJETA_LEAD, DISENOS_TARJETA, PLANTILLAS_TARJETA_LEAD, camposTarjetaDe, fechaReunionCorta, moverCampo,
  prefsTarjetaDe, subtituloEnOrden,
} from '../lib/tarjeta-kanban';
import { MAX_PLANTILLAS_PROPIAS, guardarPlantillaPropia, plantillaPuesta, plantillasPropiasDe } from '../lib/plantillas-tarjeta';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('lo guardado se limpia y conserva el orden de la persona; el diseño, también del formato viejo', () => {
  assert.deepEqual(camposTarjetaDe(undefined), [...CAMPOS_TARJETA_DEFAULT], 'sin nada guardado: lo de siempre');
  assert.deepEqual(camposTarjetaDe('foto'), [...CAMPOS_TARJETA_DEFAULT], 'algo que no es una lista: lo de siempre');
  assert.deepEqual(camposTarjetaDe([]), [], 'una lista vacía es una elección (sólo el nombre)');
  assert.deepEqual(camposTarjetaDe(['telefono', 'nada', 'foto', 'telefono', 3]), ['telefono', 'foto'], 'en SU orden, sin lo desconocido ni repetidos');
  assert.ok(CAMPOS_TARJETA_DEFAULT.every((c) => CAMPOS_TARJETA_LEAD.includes(c)));
  assert.deepEqual(prefsTarjetaDe(['canal', 'foto']), { diseno: 'completa', campos: ['canal', 'foto'], plantillas: [] }, 'el formato del 20/10 (sólo la lista)');
  assert.deepEqual(prefsTarjetaDe({ diseno: 'avance', campos: ['plata'] }), { diseno: 'avance', campos: ['plata'], plantillas: [] });
  assert.equal(prefsTarjetaDe({ diseno: 'gigante', campos: [] }).diseno, 'completa', 'un diseño que no existe: el de siempre');
  assert.equal(subtituloEnOrden(['canal', 'foto', 'plata'], { plata: '$97', canal: 'WhatsApp' }), 'WhatsApp · $97', 'la plata y el canal en SU orden');
  assert.equal(subtituloEnOrden(['plata'], { plata: '$97', canal: 'WhatsApp' }), '$97');
  assert.equal(subtituloEnOrden(['canal'], { plata: '$97', canal: 'Sin origen' }), '', 'el relleno «Sin origen» no es un dato');
  assert.deepEqual(moverCampo(['foto', 'plata', 'canal'], 2, 0), ['canal', 'foto', 'plata']);
  assert.deepEqual(moverCampo(['foto', 'plata'], 0, 5), ['foto', 'plata'], 'fuera de rango no mueve');
});

test('las plantillas: las de fábrica, cuál está puesta, y las propias limpias, sin repetir nombre y con tope', () => {
  // Las de fábrica: válidas contra el catálogo, ids únicos, la primera es la de siempre.
  assert.equal(PLANTILLAS_TARJETA_LEAD[0].id, 'fabrica:completa');
  assert.deepEqual([...PLANTILLAS_TARJETA_LEAD[0].campos], [...CAMPOS_TARJETA_DEFAULT]);
  assert.equal(new Set(PLANTILLAS_TARJETA_LEAD.map((p) => p.id)).size, PLANTILLAS_TARJETA_LEAD.length);
  for (const p of PLANTILLAS_TARJETA_LEAD) {
    assert.ok(DISENOS_TARJETA.includes(p.forma), p.nombre);
    assert.deepEqual(camposTarjetaDe(p.campos), [...p.campos], `«${p.nombre}» con un dato que no existe`);
  }
  assert.ok(PLANTILLAS_TARJETA_LEAD.some((p) => !p.campos.includes('foto')), 'Martín: «otra que no tenga foto de perfil»');
  // Cuál está puesta: la que coincide en forma Y en orden; si ninguna, «Personalizada».
  assert.equal(plantillaPuesta(PLANTILLAS_TARJETA_LEAD, 'completa', CAMPOS_TARJETA_DEFAULT)?.nombre, 'Completa');
  assert.equal(plantillaPuesta(PLANTILLAS_TARJETA_LEAD, 'compacta', []), PLANTILLAS_TARJETA_LEAD.find((p) => p.id === 'fabrica:nombre'));
  assert.equal(plantillaPuesta(PLANTILLAS_TARJETA_LEAD, 'completa', [...CAMPOS_TARJETA_DEFAULT].reverse()), null, 'otro orden es otra tarjeta');
  // Las propias: lo guardado se limpia (forma desconocida, sin nombre, id raro, dato que no existe) y se lee igual.
  const leidas = plantillasPropiasDe([
    { id: 'propia:a1', nombre: '  Mi   tarjeta ', forma: 'monto', campos: ['plata', 'nada'] },
    { id: 'propia:a1', nombre: 'Repetida', forma: 'completa', campos: [] },
    { id: 'otra:x', nombre: 'Id raro', forma: 'completa', campos: [] },
    { id: 'propia:b2', nombre: '', forma: 'completa', campos: [] },
    { id: 'propia:c3', nombre: 'Gigante', forma: 'gigante', campos: [] },
    'basura',
  ], DISENOS_TARJETA, camposTarjetaDe);
  assert.deepEqual(leidas, [{ id: 'propia:a1', nombre: 'Mi tarjeta', forma: 'monto', campos: ['plata'] }]);
  assert.deepEqual(prefsTarjetaDe({ diseno: 'monto', campos: ['plata'], plantillas: [{ id: 'propia:z', nombre: 'Z', forma: 'portada', campos: ['foto'] }] }).plantillas,
    [{ id: 'propia:z', nombre: 'Z', forma: 'portada', campos: ['foto'] }], 'el perfil trae las propias');
  // Guardar: con el MISMO nombre (sin mayúsculas ni acentos) la reemplaza; sin nombre o sin lugar, no.
  const una = guardarPlantillaPropia([], 'Reunión', 'evento', ['agenda'], 'propia:n1');
  assert.ok(una.ok);
  const otra = guardarPlantillaPropia(una.ok ? una.propias : [], 'reunion', 'monto', ['plata'], 'propia:n2');
  assert.ok(otra.ok && otra.propias.length === 1 && otra.propias[0].id === 'propia:n1' && otra.propias[0].forma === 'monto');
  assert.deepEqual(guardarPlantillaPropia([], '   ', 'completa', [], 'propia:n3'), { ok: false, error: 'sin-nombre' });
  const llenas = Array.from({ length: MAX_PLANTILLAS_PROPIAS }, (_, i) => ({ id: `propia:l${i}`, nombre: `P${i}`, forma: 'completa' as const, campos: [] }));
  assert.deepEqual(guardarPlantillaPropia(llenas, 'Una más', 'completa', [], 'propia:x'), { ok: false, error: 'lleno' });
  assert.equal(fechaReunionCorta('2026-10-23T15:00:00Z'), 'vie 23 oct');
  assert.equal(fechaReunionCorta(null), 'Sin agendar');
});

test('el tablero arma la tarjeta con UNA función, que también arma la vista previa', () => {
  const b = leer('app/crm/CrmBoard.tsx');
  assert.match(b, /\{\.\.\.propsDeTarjeta\(l, campos, diseno\)\}/, 'la tarjeta del tablero');
  assert.match(b, /\{\.\.\.propsDeTarjeta\(m, cs, d\)\}/, 'la vista previa, con la MISMA función');
  const f = b.slice(b.indexOf('const propsDeTarjeta = '), b.indexOf('const muestraTarjeta = '));
  assert.match(f, /sinCara: !cs\.includes\('foto'\)/);
  assert.match(f, /compacta: dis === 'compacta'/);
  assert.match(f, /avance: dis === 'avance' && iPaso >= 0/, 'el diseño «Con avance» lleva la barra del paso');
  assert.match(f, /subtitulo: subtituloEnOrden\(csChicos,/, 'la plata y el canal en el orden de la persona (menos lo que va grande)');
  // Después de los elegidos, los estados que van SIEMPRE y no se eligen, en este orden: el de la automatización (22/10/2026,
  // tests/crm-automatizacion-lead.test.ts) y, si el @ de Instagram es su ÚNICO canal, ese @ (23/10/2026, tests/contacto-instagram.test.ts).
  // La cola se fija ENTERA, hasta el `</>`: un chip nuevo al final es una decisión y se anota acá, no un `.*` que deje pasar cualquiera.
  assert.match(f, /chips: <>\{csChicos\.map\(\(c\) => <Fragment key=\{c\}>\{chip\(c\)\}<\/Fragment>\)\}\{aut && <span [^>]*>\{aut\.texto\}<\/span>\}\{soloInstagram\(l\) && <span [^>]*>@\{soloInstagram\(l\)\}<\/span>\}<\/>/, 'los chips en el orden de la persona, y después los estados fijos: la automatización y el @ único');
  // Las formas del 21/10: lo que va GRANDE sale del subtítulo y de los chips (no se dice dos veces).
  assert.match(f, /const enGrande: CampoTarjetaLead \| null = dis === 'monto' \? 'plata' : dis === 'evento' \? 'agenda' : null;/);
  assert.match(f, /portada: dis === 'portada' \? colorDeNombre\(l\.name\) : null,/);
  for (const c of ['vence', 'datos', 'agenda', 'fuera', 'empresa', 'telefono', 'campana', 'alta']) assert.match(f, new RegExp(`case '${c}':`), `falta el dato «${c}»`);
  assert.match(b, /onPersonalizarTarjetas=\{\(\) => setPersonalizando\(true\)\}/);
  assert.match(leer('app/crm/CrmToolbar.tsx'), /label="Personalizar tarjetas"/);
  const kit = leer('app/_ui/TarjetaKanban.tsx');
  assert.match(kit, /const cara = sinCara \? null : <CaraTarjeta/);
  assert.match(kit, /compacta \? 'tk--compacta' : ''/);
});

test('el pop-up: ancho, la galería de plantillas con la tarjeta de verdad, la tarjeta en vivo, acomodar y guardar las propias', () => {
  const m = leer('app/_ui/PersonalizarTarjetas.tsx');
  assert.match(m, /<Modal titulo=\{titulo\} ancho=\{1060\}/, '«mucho más grueso» (era de 460)');
  assert.match(m, /\{vistaPrevia \? vistaPrevia\(p\.forma, p\.campos\) :/, 'cada plantilla, dibujada con la tarjeta del tablero');
  assert.match(m, /\{vistaPrevia \? vistaPrevia\(forma, campos\) :/, 'la tarjeta en vivo');
  assert.match(m, /role="radiogroup" aria-label="Plantillas de la tarjeta" className="pt-galeria">\{fabrica\.map\(miniatura\)\}/);
  assert.match(m, /onDrop=\{\(e\) => \{ e\.preventDefault\(\); if \(arrastrado != null\) moverCampo\(arrastrado, i\);/, 'arrastrar para acomodar');
  assert.match(m, /onClick=\{\(\) => moverCampo\(i, i - 1\)\}[\s\S]{0,200}onClick=\{\(\) => moverCampo\(i, i \+ 1\)\}/, 'y con el teclado');
  assert.match(m, /const r = guardarPlantillaPropia\(propias, nombreNueva, forma, campos, idPlantillaNueva\(\)\);/, '«puedes crear otras más»');
  assert.match(m, /@media \(max-width: 860px\) \{ \.pt-grid \{ grid-template-columns: minmax\(0, 1fr\);/, 'en una pantalla angosta se apila');
  const b = leer('app/crm/CrmBoard.tsx');
  assert.match(b, /fabrica=\{PLANTILLAS_TARJETA_LEAD\} propias=\{plantillas\} forma=\{diseno\} campos=\{campos\}/, 'el CRM le pasa sus plantillas');
});

test('se guarda en el perfil de la persona y la página lo lee para quien mira', () => {
  const p = leer('lib/perfil.ts');
  assert.match(p, /const TARJETA_CRM_KEY = 'crmTarjeta';/);
  const set = p.slice(p.indexOf('export async function setCamposTarjetaCrm'), p.indexOf('export async function setCamposTarjetaCrm') + 800);
  assert.match(set, /const limpios = prefsTarjetaDe\(\{ campos, diseno, plantillas: plantillas === undefined \? previas : plantillas \}\);/, 'se guarda limpio, sin pisar las propias');
  assert.match(set, /const u = await filaPropia\(\);/, 'se guarda en la fila de QUIEN MIRA');
  const page = leer('app/crm/page.tsx');
  assert.match(page, /const pCampos = getCamposTarjetaCrm\(\);/);
  assert.match(page, /camposTarjeta=\{camposTarjeta\.campos\}\n\s+disenoTarjeta=\{camposTarjeta\.diseno\}\n\s+plantillasTarjeta=\{camposTarjeta\.plantillas\}/);
  assert.match(leer('app/crm/tarjeta-campos-actions.ts'), /await exigirSesion\(\);/);
});

test('la API de MaKo lo lee y lo propone sólo por la app (es de una persona), y lo confirma esa persona', () => {
  const def = leer('lib/api-mako/areas/crm.def.ts');
  const i = def.indexOf("id: 'ver_campos_tarjeta_crm'");
  assert.ok(i > 0, 'la API no declara la tarjeta personalizada');
  const op = def.slice(i, def.indexOf('\n  },', i));
  assert.match(op, /tipo: 'lectura'/);
  assert.match(op, /canales: \['app'\]/, 'por WhatsApp o HTTP no hay sesión que diga quién es');
  const run = leer('lib/api-mako/areas/crm.run.ts');
  assert.match(run, /ver_campos_tarjeta_crm: \{\n\s+leer: async \(\) => \{\n\s+const \{ campos, diseno, plantillas, guardable \} = await getCamposTarjetaCrm\(\);/);
  // La acción (21/10/2026): sólo por la app, con «sí», y sólo la confirma la persona de la tarjeta.
  const j = def.indexOf("id: 'personalizar_tarjetas_crm'");
  assert.ok(j > 0, 'la API no declara la acción de personalizar');
  const acc = def.slice(j, def.indexOf('\n  },', j));
  assert.match(acc, /tipo: 'accion', confirmacion: 'chat'/);
  assert.match(acc, /canales: \['app'\]/);
  assert.match(run, /personalizar_tarjetas_crm: \{\n\s+faltaParaConfirmar: async \(payload, ctx\) => \{/);
  assert.match(run, /payload: \{ email, forma, campos, \.\.\.\(plantillas \? \{ plantillas \} : \{\}\) \}/);
});

test('el teléfono dibuja la tarjeta con la misma elección', () => {
  const t = leer('app/m/crm/TableroCrm.tsx');
  assert.match(t, /\{campos\.includes\('foto'\) && <CaraTarjeta/);
  assert.match(t, /subtituloEnOrden\(campos, \{ plata: t\.plata, canal: t\.canal \}\)/);
  assert.match(leer('app/m/crm/datos.ts'), /campos: \(await getCamposTarjetaCrm\(\)\)\.campos,/);
});
