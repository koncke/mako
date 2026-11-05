// =============================================================================
// Plan: «Personalizar tarjetas» con PLANTILLAS, «Nueva tarea» al «⋯» de la columna y el clic derecho (21/10/2026)
// =============================================================================
// Martín, 21/10/2026: «poder ver TEMPLATES de estilos de tarjeta, no solo info, sino que otros estilos también… y puedes
// crear otras más… piensa en varios diseños», «la personalización de las tarjetas en clientes, plan, etc.», «si le doy
// click derecho a las cards, debería poder ver la opción de "Personalizar tarjeta"» y «Quiero que elimines el botón de
// "nuevo lead" de donde está en las columnas y lo pongas dentro de los 3 puntos de cada columna». Lo que se pide en un
// lugar se aplica en todos. El molde es el del CRM (tests/crm-tarjeta-personalizable.test.ts):
//   1. el catálogo y las plantillas de fábrica, válidos (ejecutado);
//   2. lo guardado se limpia EN EL ORDEN DE LA PERSONA y las propias se conservan; lo que pide MaKo (ejecutado);
//   3. la tarjeta (`CardTile`) traduce cada dato y la forma, y el check y el tacho quedan siempre;
//   4. el pop-up recibe las plantillas del Plan y dibuja la tarjeta de verdad; «Personalizar tarjetas» en el «⋯»;
//   5. «Nueva tarea» va al «⋯» de la cabecera (también para quien no es admin) y el carril ya no la tiene;
//   6. el clic derecho en una tarjeta: «Abrir» y «Personalizar tarjeta», con las guardas del CRM;
//   7. se guarda en el perfil de la persona y llega con el HTML, por el camino de las columnas (useBoard);
//   8. la API de MaKo declara la lectura y la acción, sólo por la app y confirmada por la persona.
//
// PROBADO ROMPIÉNDOLO (21/10/2026), con el archivo en 8 / 0, una rotura por vez y restaurada:
//   · `camposTarjetaPlanDe` en el orden del catálogo (pierde el de la persona)            → 7 / 1
//   · `prefsTarjetaPlanDe` sin leer las propias                                           → 7 / 1
//   · el renglón con `CAMPOS_TARJETA_PLAN.map` (todos, sin la elección)                   → 7 / 1
//   · el motivo de «Atorada» aunque no esté elegido                                       → 7 / 1
//   · el check gris atado a los datos (`campos.length > 0 &&`)                            → 7 / 1
//   · `<TarjetaPlanCtx.Provider value={null}>` (las tarjetas no ven la elección)          → 7 / 1
//   · la vista previa sin `tarjeta={{ forma: f, campos: cs }}`                            → 7 / 1
//   · «＋ Nueva tarea» de vuelta en el carril                                             → 7 / 1
//   · el «⋯» de la columna sólo con renombrar/agregar/quitar (sólo el admin)              → 7 / 1
//   · el clic derecho sin la guarda de los campos (pisa copiar/pegar)                     → 7 / 1
//   · «Personalizar tarjeta» del clic derecho sin abrir el pop-up                         → 7 / 1
//   · `useBoard` sin `tarjeta, setTarjeta` en su return                                   → 7 / 1
//   · `setTarjetaPlan` pisando las propias cuando no llegan                               → 7 / 1
//   · la acción con `canales: TODOS` (también por WhatsApp y HTTP)                        → 7 / 1
// Correr: node --import tsx --test tests/plan-tarjeta-plantillas.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAMPOS_TARJETA_PLAN, CAMPOS_TARJETA_PLAN_DEFAULT, FORMAS_TARJETA_PLAN, NOMBRE_CAMPO_TARJETA_PLAN, PLANTILLAS_TARJETA_PLAN,
  camposTarjetaPlanDe, prefsTarjetaPlanDe,
} from '../lib/tarjeta-plan';
import { pedidoDeTarjeta, plantillaPuesta } from '../lib/plantillas-tarjeta';
import { DEFS } from '../lib/api-mako/areas/plan.def';

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
const SHELL = sinComentarios(leer('app/plan/board/BoardShell.tsx'));

const TABLERO = {
  fabrica: PLANTILLAS_TARJETA_PLAN, formas: FORMAS_TARJETA_PLAN, campos: CAMPOS_TARJETA_PLAN,
  limpiarCampos: camposTarjetaPlanDe, nombreCampo: NOMBRE_CAMPO_TARJETA_PLAN, donde: 'el plan',
};

test('el catálogo y las plantillas de fábrica: válidas, la primera es la de siempre, y están las pedidas', () => {
  assert.deepEqual([...CAMPOS_TARJETA_PLAN], ['proyecto', 'plazo', 'bloqueo', 'motivo']);
  assert.deepEqual([...FORMAS_TARJETA_PLAN], ['completa', 'compacta', 'color']);
  assert.deepEqual([...CAMPOS_TARJETA_PLAN_DEFAULT], [...CAMPOS_TARJETA_PLAN], 'la de siempre lleva todo');
  const [primera] = PLANTILLAS_TARJETA_PLAN;
  assert.equal(primera.id, 'fabrica:completa');
  assert.equal(primera.forma, 'completa');
  assert.deepEqual([...primera.campos], [...CAMPOS_TARJETA_PLAN_DEFAULT]);
  assert.equal(new Set(PLANTILLAS_TARJETA_PLAN.map((p) => p.id)).size, PLANTILLAS_TARJETA_PLAN.length, 'ids repetidos');
  assert.equal(new Set(PLANTILLAS_TARJETA_PLAN.map((p) => p.nombre)).size, PLANTILLAS_TARJETA_PLAN.length, 'nombres repetidos');
  for (const p of PLANTILLAS_TARJETA_PLAN) {
    assert.ok(FORMAS_TARJETA_PLAN.includes(p.forma), `«${p.nombre}» con una forma que no existe`);
    assert.deepEqual(camposTarjetaPlanDe(p.campos), [...p.campos], `«${p.nombre}» con un dato que no existe`);
    assert.equal(plantillaPuesta(PLANTILLAS_TARJETA_PLAN, p.forma, p.campos)?.id, p.id, `«${p.nombre}» repite a otra`);
  }
  const por = (n: string) => PLANTILLAS_TARJETA_PLAN.find((p) => p.nombre === n);
  for (const n of ['Completa', 'Compacta', 'Sin proyecto', 'Color del proyecto', 'Sólo el título']) assert.ok(por(n), `falta la plantilla «${n}»`);
  assert.equal(por('Compacta')!.forma, 'compacta');
  assert.ok(!por('Sin proyecto')!.campos.includes('proyecto'));
  assert.equal(por('Color del proyecto')!.forma, 'color');
  assert.deepEqual({ forma: por('Sólo el título')!.forma, campos: [...por('Sólo el título')!.campos] }, { forma: 'compacta', campos: [] });
});

test('lo guardado se limpia EN EL ORDEN DE LA PERSONA, las propias se conservan, y lo que pide MaKo se resuelve', () => {
  assert.deepEqual(camposTarjetaPlanDe(undefined), [...CAMPOS_TARJETA_PLAN_DEFAULT], 'sin nada guardado: lo de siempre');
  assert.deepEqual(camposTarjetaPlanDe([]), [], 'una lista vacía es una elección (sólo el título)');
  assert.deepEqual(camposTarjetaPlanDe(['bloqueo', 'nada', 'proyecto', 'bloqueo', 7]), ['bloqueo', 'proyecto'], 'en SU orden, sin lo desconocido ni repetidos');
  assert.deepEqual(prefsTarjetaPlanDe(undefined), { forma: 'completa', campos: [...CAMPOS_TARJETA_PLAN_DEFAULT], plantillas: [] });
  assert.deepEqual(prefsTarjetaPlanDe({ forma: 'portada', campos: ['plazo'] }), { forma: 'completa', campos: ['plazo'], plantillas: [] }, 'una forma de otro tablero: la de siempre');
  assert.deepEqual(prefsTarjetaPlanDe({
    forma: 'color', campos: ['plazo', 'proyecto'],
    plantillas: [{ id: 'propia:z9', nombre: 'Fechas', forma: 'compacta', campos: ['plazo', 'foto'] }, { id: 'propia:z9', nombre: 'Repetida', forma: 'compacta', campos: [] }],
  }), { forma: 'color', campos: ['plazo', 'proyecto'], plantillas: [{ id: 'propia:z9', nombre: 'Fechas', forma: 'compacta', campos: ['plazo'] }] });

  const actual = { forma: 'completa' as const, campos: [...CAMPOS_TARJETA_PLAN_DEFAULT], plantillas: [] };
  const p = pedidoDeTarjeta({ plantilla: 'color del PROYECTO' }, actual, TABLERO, 'propia:x');
  assert.ok(p.ok && p.forma === 'color' && p.plantilla === 'Color del proyecto');
  const q = pedidoDeTarjeta({ campos: ['bloqueo', 'proyecto'] }, actual, TABLERO, 'propia:x');
  assert.deepEqual(q.ok ? { forma: q.forma, campos: q.campos, plantilla: q.plantilla } : null, { forma: 'completa', campos: ['bloqueo', 'proyecto'], plantilla: null }, 'el orden pedido se respeta; sin plantilla que coincida, «Personalizada»');
  assert.equal(pedidoDeTarjeta({ campos: ['foto'] }, actual, TABLERO, 'propia:x').ok, false, 'un dato de otro tablero no es de acá');
  assert.deepEqual(pedidoDeTarjeta({ forma: 'completa' }, actual, TABLERO, 'propia:x'), { ok: false, error: 'La tarjeta ya está así.', yaEstaba: true });
  const lleno = { ...actual, plantillas: Array.from({ length: 12 }, (_, i) => ({ id: `propia:l${i}`, nombre: `P${i}`, forma: 'completa' as const, campos: [] })) };
  const sinLugar = pedidoDeTarjeta({ plantilla: 'Compacta', guardarComo: 'Una más' }, lleno, TABLERO, 'propia:x');
  assert.ok(!sinLugar.ok && /hay que borrar una en el plan/.test(sinLugar.error));
});

test('la tarjeta (`CardTile`) traduce cada dato y la forma; el check y el tacho quedan siempre', () => {
  const card = tramo(SHELL, 'function CardTile(', '\nfunction ');
  assert.match(card, /const delTablero = useContext\(TarjetaPlanCtx\);\s*const \{ forma, campos \} = tarjeta \?\? delTablero \?\? TARJETA_PLAN_DE_SIEMPRE;/, 'la del pop-up, la del tablero o la de siempre');
  const dato = tramo(card, 'const datoDelRenglon = ', '\n  };');
  assert.match(dato, /case 'proyecto':[\s\S]*<LabelChips chips=\{proys\}[\s\S]*emojiTarea\(board, t\)/, 'el proyecto (o su emoji)');
  assert.match(dato, /case 'plazo':[\s\S]*<LineaRepeticion[\s\S]*<LineaDeadline/, 'la fecha o la repetición');
  assert.match(dato, /case 'bloqueo':\s*return <BloqueoChip porQue=\{frenanA\} compacto \/>;/, 'el candado');
  assert.match(card, /\{campos\.map\(\(c\) => <Fragment key=\{c\}>\{datoDelRenglon\(c\)\}<\/Fragment>\)\}/, 'el renglón, en el orden de la persona');
  assert.match(card, /\{campos\.includes\('motivo'\) && estadoDe\(t\) === 'en_seguimiento' && t\.motivoAtorada && \(/, 'el motivo, sólo si está elegido');
  assert.match(card, /WebkitLineClamp: compacta \? 1 : 2/, 'compacta: el título en una línea');
  assert.match(card, /\{forma === 'color' && <div aria-hidden style=\{\{ flex: 'none', height: 26, margin: '0 -13px 10px', background: proys\[0\]\?\.color \?\? 'var\(--surface-2\)' \}\} \/>\}/, 'la banda con el color del proyecto');
  assert.match(card, /data-tarea-id=\{t\.id\}/, 'lo que busca el clic derecho');
  // El check gris y el tacho NO son datos: ninguna elección los saca.
  const check = card.indexOf('className="mk-plan-check"');
  assert.ok(check > 0 && card.indexOf('aria-label={`Eliminar', check) > check);
  assert.doesNotMatch(card.slice(card.lastIndexOf('<span style={{ flex: 1 }} />', check), check), /campos/, 'el check quedó atado a un dato');
  assert.match(SHELL, /<TarjetaPlanCtx\.Provider value=\{tarjetaVista\}>/, 'toda tarjeta del tablero ve la elección');
});

test('el pop-up: las plantillas del Plan y la tarjeta de verdad; «Personalizar tarjetas» en el «⋯» donde hay tarjetas', () => {
  const pop = tramo(SHELL, '<PersonalizarTarjetas<FormaTarjetaPlan, CampoTarjetaPlan>', 'sinMuestra=');
  assert.match(pop, /fabrica=\{PLANTILLAS_TARJETA_PLAN\} propias=\{board\.tarjeta\.plantillas\} forma=\{board\.tarjeta\.forma\} campos=\{board\.tarjeta\.campos\}/);
  assert.match(pop, /catalogo=\{CAMPOS_TARJETA_PLAN\} nombreCampo=\{NOMBRE_CAMPO_TARJETA_PLAN\} guardable=\{board\.tarjeta\.guardable\}/);
  assert.match(pop, /const r = await guardarTarjetaPlanAction\(cs, f, ps\);/);
  assert.match(pop, /onCambio=\{\(f, cs, ps\) => board\.setTarjeta\(/, 'el tablero de atrás cambia en el acto');
  assert.match(pop, /<div inert>\s*<CardTile t=\{muestraTarjeta\}[\s\S]*?tarjeta=\{\{ forma: f, campos: cs \}\} \/>/, 'la vista previa es la tarjeta del tablero');
  assert.match(SHELL, /\.\.\.\(board\.tarjeta && hayTarjetas \? \[\{ key: 'personalizar',[\s\S]{0,900}label: 'Personalizar tarjetas',/, 'el «⋯» de la barra');
  assert.match(SHELL, /const hayTarjetas = \(view === 'tareas' \|\| view === 'recurrentes'\) && !tabla;/);
});

test('«Nueva tarea» sale del carril y va al «⋯» de la cabecera, también para quien no es admin', () => {
  const col = tramo(SHELL, 'function ColumnaKanban(', '\nfunction CampoMotivo(');
  assert.doesNotMatch(col, /＋ Nueva tarea|<button onClick=\{\(\) => onNew\(/, 'el alta volvió al carril');
  assert.match(col, /onNueva=\{\(\) => onNew\(estadoCol, propia \? e : null\)\} \/>/, 'nace en ESTA columna, como antes');
  const cab = tramo(SHELL, 'function ColHeader(', '\nfunction ');
  assert.match(cab, /\{\(onNueva \|\| renombrar \|\| agregar \|\| quitar\) && !editando && \(/, 'el «⋯» se dibuja aunque no sea admin');
  assert.match(cab, /options=\{\[\s*\.\.\.\(onNueva \? \[\{ value: 'nueva', label: 'Nueva tarea', icono: 'agregar' as const \}\] : \[\]\),/, 'el primer renglón');
  assert.match(cab, /if \(v === 'nueva'\) onNueva\?\.\(\);/);
  assert.match(cab, /<span data-nodrag style=\{\{ marginLeft: 'auto', flex: 'none' \}\}>\s*<Dropdown value="" placeholder="⋯" align="right" resetAfterSelect sinFlecha/);
});

test('clic derecho en una tarjeta → «Abrir» y «Personalizar tarjeta», con las guardas del CRM', () => {
  assert.match(SHELL, /<div style=\{\{ minHeight: 0, display: 'flex', flexDirection: 'column' \}\} onContextMenu=\{alClicDerechoTarjeta\}>/);
  const f = tramo(SHELL, 'const alClicDerechoTarjeta = ', '\n  };');
  assert.match(f, /if \(!board\.tarjeta \|\| ev\.defaultPrevented \|\| !\(t instanceof Element\)\) return;/, 'embebido, el menú del navegador');
  assert.match(f, /if \(t\.closest\('\[role="dialog"\], \[role="menu"\], \[role="listbox"\]'\) \|\| document\.querySelector\('\[aria-modal="true"\]'\)\) return;/);
  assert.match(f, /if \(t\.closest\('input:not\(\[type="checkbox"\]\), textarea, select, \[contenteditable="true"\], \[contenteditable=""\], a\[href\]'\)\) return;/);
  assert.match(f, /t\.closest<HTMLElement>\('\[data-tarea-id\]'\)\?\.dataset\.tareaId/);
  const menu = tramo(SHELL, '<MenuContextual key={menuTarjeta.n}', '/>');
  assert.match(menu, /\{ id: 'abrir', label: 'Abrir', icono: 'ver' \}, null, \{ id: 'personalizar_tarjeta', label: 'Personalizar tarjeta', icono: 'configurar' \}/);
  assert.match(menu, /if \(id === 'abrir'\) setOpenId\(menuTarjeta\.id\);/);
  assert.match(menu, /if \(id === 'personalizar_tarjeta'\) setPersonalizando\(true\);/);
});

test('se guarda en el perfil de la persona y llega con el HTML, por el camino de las columnas', () => {
  const p = leer('lib/perfil.ts');
  assert.match(p, /const TARJETA_PLAN_KEY = 'planTarjeta';/);
  const set = tramo(p, 'export async function setTarjetaPlan', '\n}\n');
  assert.match(set, /const u = await filaPropia\(\);/);
  assert.match(set, /prefsTarjetaPlanDe\(\{ campos, forma, plantillas: plantillas === undefined \? propiasGuardadas\(u, TARJETA_PLAN_KEY\) : plantillas \}\)/, 'sin pisar las propias');
  assert.match(set, /const perfil = \{ \.\.\.u\.perfil, \[TARJETA_PLAN_KEY\]: limpios \};/);
  const act = sinComentarios(leer('app/plan/board/tarjeta-actions.ts'));
  assert.match(act, /await exigirSesion\(\);\s*try \{\s*if \(!\(await getRolWsEfectivo\(\)\)\) return/);
  const u = leer('app/plan/board/useBoard.ts');
  assert.match(u, /columnasIniciales: ColumnasDelBoard = null, tarjetaInicial: TarjetaDelBoard = null\)/);
  assert.match(u, /\n\s+tarjeta, setTarjeta,\n/, 'si no está en el `return`, no existe para ninguna pantalla');
  assert.match(leer('app/plan/TodoBoard.tsx'), /useBoard\(tareas\.map\(toBoard\), categorias\.map\(toLabel\), user, repo, \[\], columnas, tarjeta\)/);
  assert.match(leer('app/plan/PlanBoard.tsx'), /useBoard\(tareas, proyectos, user, repo, deps, columnas, tarjeta\)/);
  // La tarjeta viaja en el mismo Promise.all que las columnas; lo que la página lea además (el borrador del plan, 5/11/2026) va después.
  assert.match(leer('app/plan/page.tsx'), /getRolWsEfectivo\(\)\.catch\(\(\) => null\), getTarjetaPlan\(\)(?:, [^\]\n]+)?\]\);[\s\S]*tarjeta=\{demo \? null : tarjeta\}/);
  assert.match(leer('app/plan/agencia/page.tsx'), /getRolWsEfectivo\(\)\.catch\(\(\) => null\), getTarjetaPlan\(\)\]\);[\s\S]*tarjeta=\{tarjeta\}/);
});

test('la API de MaKo: ver_tarjeta_plan y personalizar_tarjetas_plan, sólo por la app y confirmada por la persona', () => {
  const ver = DEFS.find((d) => d.id === 'ver_tarjeta_plan');
  assert.ok(ver, 'la API no declara la lectura');
  assert.equal(ver.tipo, 'lectura');
  assert.deepEqual([...ver.canales], ['app'], 'por WhatsApp o HTTP no hay sesión que diga quién es');
  const acc = DEFS.find((d) => d.id === 'personalizar_tarjetas_plan');
  assert.ok(acc, 'la API no declara la acción');
  assert.equal(acc.tipo, 'accion');
  assert.equal(acc.confirmacion, 'chat');
  assert.deepEqual([...acc.canales], ['app']);
  assert.deepEqual(acc.gating, { tab: 'todo' });
  const run = leer('lib/api-mako/areas/plan.run.ts');
  assert.match(run, /ver_tarjeta_plan: \{\n\s+leer: async \(\) => \{\n\s+const \{ forma, campos, plantillas, guardable \} = await getTarjetaPlan\(\);/);
  assert.match(run, /personalizar_tarjetas_plan: \{\n\s+faltaParaConfirmar: async \(payload, ctx\) => \{/, 'sólo la confirma la persona de la tarjeta');
  assert.match(run, /payload: \{ email, forma: r\.forma, campos: r\.campos, \.\.\.\(r\.propias \? \{ plantillas: r\.propias \} : \{\}\) \}/);
  assert.match(run, /const r = await setTarjetaPlan\(payload\.campos, payload\.forma, payload\.plantillas\);/);
});
