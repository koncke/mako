// =============================================================================
// El segundo feedback del CRM del 12/10/2026: el botón de reuniones, el borrador del alta, la
// banda de la barra, las etapas que faltaban en el editor y las opciones de cada etiqueta
// =============================================================================
// Verificado ROMPIÉNDOLO, una rotura por vez (base: 9 pass / 0 fail):
//   · `hayBorrador` contando la lada sola como algo guardable → 7 / 2 (cae también el saneo:
//     un borrador vacío con su lada por defecto se restauraba)
//   · el efecto de guardar SIN el salto de la primera corrida → 8 / 1
//   · la sección «Tus reuniones» de vuelta arriba de la barra → 8 / 1
//   · `filaQuieta` sin las fijas (Ganado y descartados) → 8 / 1
//   · el selector de la ficha sin `editable` → 8 / 1
// Y con el tercer feedback del 12/10 (base: 12 pass / 0 fail):
//   · `sanearLada` devolviendo los dígitos sin «+» → 10 / 2
//   · el alta con `onLada={setLada}` (la elegida no se recuerda) → 11 / 1
//   · el subtítulo «Ya la tiene» de vuelta en la etiqueta puesta → 11 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claveBorradorAlta, claveLadaAlta, hayBorrador, ladaDeZona, ladaInicial, leerBorradorAlta, sanearLada } from '../app/crm/new/borrador-alta';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const VACIO = { nombre: '', email: '', lada: '52', numero: '', ig: '', perfil: null };

test('el borrador del alta: la clave lleva el workspace de la pestaña', () => {
  assert.equal(claveBorradorAlta(13), 'mako.crm.alta.13');
  assert.equal(claveBorradorAlta(null), 'mako.crm.alta.propio');
  assert.notEqual(claveBorradorAlta(13), claveBorradorAlta(14));
});

test('el borrador del alta: la lada sola no es un borrador; cualquier campo escrito sí', () => {
  assert.equal(hayBorrador(VACIO), false);
  assert.equal(hayBorrador({ ...VACIO, lada: '54' }), false);
  assert.equal(hayBorrador({ ...VACIO, numero: ' - ' }), false);
  assert.equal(hayBorrador({ ...VACIO, nombre: 'Ana' }), true);
  assert.equal(hayBorrador({ ...VACIO, numero: '686 399' }), true);
  assert.equal(hayBorrador({ ...VACIO, ig: '@ana' }), true);
  assert.equal(hayBorrador({ ...VACIO, perfil: { usuario: 'ana', nombre: null, foto: null } }), true);
});

test('el borrador del alta: lo guardado se sanea, y lo roto o vacío no restaura nada', () => {
  assert.equal(leerBorradorAlta(null), null);
  assert.equal(leerBorradorAlta('{no es json'), null);
  assert.equal(leerBorradorAlta('[]'), null);
  assert.equal(leerBorradorAlta(JSON.stringify(VACIO)), null);
  const b = leerBorradorAlta(JSON.stringify({ nombre: 'Ana', email: 3, lada: '+54', numero: '11 2345', ig: '', perfil: { usuario: '' } }));
  // Tercer feedback del 12/10, punto 2: la lada vuelve CON su «+». Sin él («54») no es ninguna
  // opción del desplegable, y el control abría en «Selecciona…».
  assert.deepEqual(b, { nombre: 'Ana', email: '', lada: '+54', numero: '11 2345', ig: '', perfil: null });
});

test('la lada del alta: con su «+», sólo de la lista, y abre con borrador → última elegida → zona → MX', () => {
  assert.equal(sanearLada('+54'), '+54');
  assert.equal(sanearLada('54'), '+54');          // los borradores de antes del arreglo
  assert.equal(sanearLada('+999'), null);         // no es una lada de la lista
  assert.equal(sanearLada(''), null);
  assert.equal(sanearLada(52), null);
  assert.equal(claveLadaAlta(13), 'mako.crm.alta.lada.13');
  assert.equal(ladaDeZona('America/Argentina/Buenos_Aires'), '+54');
  assert.equal(ladaDeZona('America/Bogota'), '+57');
  assert.equal(ladaDeZona('Mars/Olympus'), null);
  assert.equal(ladaInicial({ borrador: '+57', preferida: '+54', zona: 'America/Mexico_City' }), '+57');
  assert.equal(ladaInicial({ preferida: '+54', zona: 'America/Bogota' }), '+54');
  assert.equal(ladaInicial({ preferida: 'roto', zona: 'America/Bogota' }), '+57');
  assert.equal(ladaInicial({ zona: 'Mars/Olympus' }), '+52');
  assert.equal(ladaInicial({}), '+52');
});

test('el alta guarda la lada ELEGIDA como preferencia, y al abrir no la escribe', () => {
  const src = sinComentarios(leer('app/crm/new/NewLeadForm.tsx'));
  assert.match(src, /onLada=\{elegirLada\}/);
  assert.match(src, /const elegirLada = \(l: string\) => \{\s*setLada\(l\);\s*try \{ window\.localStorage\.setItem\(claveLada, l\)/);
  // El efecto que abre calcula la lada y NO toca la preferencia.
  assert.match(src, /setLada\(ladaPorDefecto\(b\?\.lada\)\);/);
  assert.equal((src.match(/setItem\(claveLada/g) ?? []).length, 1);
});

test('el alta guarda el borrador en el modal, y el guardado se saltea la primera corrida', () => {
  const src = sinComentarios(leer('app/crm/new/NewLeadForm.tsx'));
  // Restaurar y guardar corren en el mismo commit: sin el salto, el guardado borraba lo que el
  // efecto de restaurar acababa de leer.
  assert.match(src, /if \(primeraVez\.current\) \{ primeraVez\.current = false; return; \}/);
  assert.match(src, /window\.localStorage\.setItem\(clave, JSON\.stringify\(borrador\)\)/);
  // Se olvida al terminar el alta, en los TRES finales (crear, crear igual, agregar al que ya
  // estaba), y en «Vaciar»: cuatro llamadas.
  assert.equal((src.match(/olvidarBorrador\(\);/g) ?? []).length, 4);
});

test('las reuniones cercanas son un botón de la barra, no una sección arriba', () => {
  const src = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.doesNotMatch(src, />Tus reuniones</);
  const iFiltro = src.indexOf('<CrmFilterMenu');
  const iBoton = src.indexOf('<BotonReuniones');
  const iElastico = src.indexOf('crm-tb-elastico');
  assert.ok(iFiltro > 0 && iBoton > iFiltro && iElastico > iBoton, 'el botón va después de «Filtrar» y antes del elástico');
  const comp = sinComentarios(leer('app/crm/ReunionesProximas.tsx'));
  // Sólo aparece si hay alguna, y late.
  assert.match(comp, /if \(juntas\.length === 0\) return null;/);
  assert.match(comp, /className="crm-reunion-latido"/);
});

test('la barra es un contenedor del ancho del kanban, redondeado, y va antes de los avisos', () => {
  const src = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  const iBarra = src.indexOf('className="crm-tb"');
  const iAviso = src.indexOf('{errorMsg && !errorCerrado && (');
  assert.ok(iBarra > 0 && iAviso > iBarra, 'la barra va antes del aviso de error');
  // Tercer feedback del 12/10, punto 5: del ancho del kanban (sin márgenes negativos) y redondeada.
  assert.match(src, /className="crm-tb" style=\{\{[^}]*marginBottom: 16, padding: '12px 14px', background: 'var\(--surface\)', border: '1px solid var\(--border\)', borderRadius: 16/);
  assert.doesNotMatch(src, /margin: '-16px -44px/);
});

test('el editor de etapas lista también las de nutrición y las fijas (Ganado y descartados)', () => {
  const src = sinComentarios(leer('app/crm/EtapasModal.tsx'));
  assert.match(src, /nutricionEtapas\.map\(\(e\) => filaQuieta\(e, 'Nutrición'/);
  // Tercer feedback del 12/10, punto 1: UNA sola lista en el orden del tablero — las propias,
  // «+ Agregar etapa», Ganado, las de nutrición y los descartados.
  const iNueva = src.indexOf('<NuevaEtapa');
  const iGanado = src.indexOf("fijas.filter((e) => e.key === 'ganado').map((e) => filaQuieta(e, 'Ganado'))");
  const iNutri = src.indexOf("nutricionEtapas.map((e) => filaQuieta(e, 'Nutrición'");
  const iDesc = src.indexOf("fijas.filter((e) => e.key !== 'ganado').map((e) => filaQuieta(e, 'Descartado'))");
  assert.ok(iNueva > 0 && iGanado > iNueva && iNutri > iGanado && iDesc > iNutri, 'propias → agregar → Ganado → nutrición → descartados');
  // Y el bloque aparte de abajo (con su margen) no vuelve.
  assert.doesNotMatch(src, /marginTop: 14[^}]*\}\}>\s*\{fijas/);
  // Quitar una nutrición es apagarla con TODOS sus ids, y el deshacer la prende.
  assert.match(src, /op: 'nutricion', id, activa: false, tambien/);
  assert.match(src, /op: 'nutricion', id, activa: true, tambien/);
  // Y el server las manda.
  const act = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(act, /nutricionEtapas: nutricion,/);
  const pipe = sinComentarios(leer('lib/pipeline.ts'));
  assert.match(pipe, /nutricion: stages\.filter\(\(st\) => st\.band === 'nutricion' && !esTerminal\(st\.key\)\)\.map\(uno\)/);
});

test('el editor de etapas asigna campañas desde la fila de entrada, con el modal de «Leads entrantes»', () => {
  const src = sinComentarios(leer('app/crm/EtapasModal.tsx'));
  assert.match(src, /onClick=\{\(\) => setCampanas\(true\)\}/);
  assert.match(src, /<CampanasModal\s+funnelId=\{emb\?\.esDefault \|\| funnelId == null \? null : funnelId\}[^>]*anidada\s+onCerrar=\{cerrarCampanas\}/);
  // `onCerrar` de identidad fija (AGENTS.md).
  assert.match(src, /const cerrarCampanas = useCallback\(/);
});

test('el desplegable de etiquetas de la ficha lleva el lápiz de cada etiqueta, y la puesta va opaca sin subtítulo', () => {
  const ficha = sinComentarios(leer('app/crm/lead-view/EtiquetasDelLead.tsx'));
  assert.match(ficha, /<SelectorEtiqueta value=\{null\} accion editable /);
  const sel = sinComentarios(leer('app/_components/etiquetas-cliente.tsx'));
  assert.match(sel, /\.\.\.\(editable \? \{ acciones: \[\{ icono: <Lapiz \/>/);
  assert.doesNotMatch(sel, /TresPuntos|Ya la tiene/);
  // Crear una etiqueta: un ✓, no la palabra «Crear».
  assert.match(sel, /aria-label="Crear la etiqueta"[^>]*><IconoMenu nombre="check"/);
  assert.match(sel, /\{editando && <EditarEtiqueta etiqueta=\{editando\} onCerrar=\{cerrarEditor\} onCambio=\{avisarCambioEtiquetas\} \/>\}/);
});

test('editar una etiqueta va por el POST del CRUD y archivar pregunta sólo si algo la usa', () => {
  const src = sinComentarios(leer('app/_components/EditarEtiqueta.tsx'));
  assert.match(src, /post\(\{ action: 'editar', id: etiqueta\.id, nombre: limpio, color \}\)/);
  assert.match(src, /post\(\{ action: 'archivar', id: etiqueta\.id \}\)/);
  assert.match(src, /consecuenciaDeArchivar\(j\.uso\)/);
});
