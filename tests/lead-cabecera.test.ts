// =============================================================================
// La cabecera y el marco de la ficha del lead (feedback de Martín del 12/10/2026)
// =============================================================================
// Puntos 9, 11, 12, 13, 14, 16, 18 y 19 del feedback sobre el CRM, en las DOS puertas de la ficha
// (el pop-up app/crm/LeadSheet.tsx y la ruta app/crm/[id]/page.tsx + LeadDetailBody.tsx):
//   · 9  — un solo desplegable en árbol (lo fija tests/lead-funnel-ficha.test.ts) y las etiquetas
//          arriba del nombre;
//   · 11 — portada y foto del lead, y el nombre grande editable con un clic;
//   · 12 — sin «Cerrar» abajo: ahí va «Borrar lead», rojo;
//   · 13 — «Reuniones» sólo si el funnel tiene una etapa de reunión;
//   · 14 — el pop-up más ancho;
//   · 16 — la fila de pestañas queda pegada arriba al scrollear;
//   · 18 — «Tracking» sólo si el funnel del lead tiene una campaña de Meta asignada;
//   · 19 — «Análisis» pasa a ser «MaKo Analyst», un chat atado al lead.
//
// La regla de Tracking es pura y se EJECUTA; el cableado se mira sobre el código sin comentarios.
//
// ⚠️ PROBADO ROMPIÉNDOLO (12/10/2026), restaurando de memoria. Con todo puesto: 9 pases, 0 fallos.
//   · `funnelTieneCampana` sin traducir el id real del funnel del negocio a null ... 1 FALLO, 8 pases
//   · el modal dibuja Tracking siempre (sin `verTracking ?`) ....................... 1 FALLO, 8 pases
//   · la ruta dibuja Reuniones siempre (sin `verReuniones ?`) ...................... 1 FALLO, 8 pases
//   · la lectura de Tracking devuelve `false` con la base caída .................... 1 FALLO, 8 pases
//   · la action de la cara sin el `.eq('workspace_id', ws)` ........................ 1 FALLO, 8 pases
//   · la ruta sin `fija` en sus pestañas ........................................... 1 FALLO, 8 pases
//   · vuelve el botón «Cerrar» al pie del pop-up .................................... 1 FALLO, 8 pases
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { funnelTieneCampana } from '../lib/tracking-ficha';
import { ANCHO_FICHA_LEAD } from '../app/crm/lead-view/ficha-medidas';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const codigo = (p: string) => sinComentarios(leer(p));

const SHEET = codigo('app/crm/LeadSheet.tsx');
const BODY = codigo('app/crm/[id]/LeadDetailBody.tsx');
const PAGE = codigo('app/crm/[id]/page.tsx');
const CAB = codigo('app/crm/lead-view/CabeceraLead.tsx');
/**
 * ⚠️ DESDE EL 14/10/2026 LAS TABS SON UNA SOLA PIEZA PARA LAS DOS PUERTAS (la ficha por bloques): el pop-up
 * y la ruta montan `FichaPorBloques` con la MISMA lectura (`getLeadFullAction`). Las reglas de qué tab sale
 * (Tracking, Reuniones) y MaKo Analyst se piden ahí, una vez; de cada puerta, que la monte.
 */
const FICHA = codigo('app/crm/lead-view/ficha/FichaPorBloques.tsx');

// ── 18 · Tracking: la regla, ejecutada ─────────────────────────────────────────

test('Tracking: sólo si el funnel del lead tiene una campaña asignada; el del negocio es null en las dos puntas', () => {
  const DEF = 7; // el id real del funnel del negocio
  // El del negocio se guarda como null en el mapa de campañas Y en `leads.funnel_id`.
  assert.equal(funnelTieneCampana([{ funnelId: null }], null, DEF), true);
  assert.equal(funnelTieneCampana([{ funnelId: 14 }], null, DEF), false, 'la campaña es de OTRO funnel');
  assert.equal(funnelTieneCampana([], null, DEF), false, 'sin ninguna campaña asignada, no hay pestaña');
  assert.equal(funnelTieneCampana([{ funnelId: 14 }], 14, DEF), true);
  assert.equal(funnelTieneCampana([{ funnelId: '14' }], '14', DEF), true, 'un bigint puede llegar como string');
  // Una fila vieja con el id REAL del funnel del negocio cuenta como el del negocio, en las dos puntas.
  assert.equal(funnelTieneCampana([{ funnelId: null }], DEF, DEF), true);
  assert.equal(funnelTieneCampana([{ funnelId: DEF }], null, DEF), true);
  // Sin saber cuál es el del negocio (la lectura de funnels falló), null sigue siendo null.
  assert.equal(funnelTieneCampana([{ funnelId: null }], null, null), true);
});

test('Tracking: lo decide el SERVER en las dos puertas, y con la lectura caída se DIBUJA', () => {
  const srv = codigo('lib/tracking-ficha-server.ts');
  assert.match(srv, /import 'server-only';/);
  assert.match(srv, /leerCampanasAsignadasEstricto\(\)/, 'la tolerante convierte un error en «ninguna campaña»');
  assert.match(srv, /\} catch \{\s*return true;\s*\}/, '«no pude leer» no es «no hay campaña»');
  // Las DOS puertas lo reciben de getLeadFullAction (desde el 14/10/2026 la ruta también lee con ella).
  // ⚠️ CAMBIADO A PROPÓSITO EL 14/10/2026: la regla se aplica una vez, en la ficha compartida.
  const acc = codigo('app/crm/actions.ts');
  assert.match(acc, /const verTrackingP = verTrackingDeLead\(lead\.funnel_id\);/);
  assert.match(acc, /verTracking: await verTrackingP[,}\s]/);
  assert.match(PAGE, /await getLeadFullAction\(idNum\)/, 'la ruta lee con la action del pop-up');
  assert.match(FICHA, /const verTracking = data\.verTracking \?\? true;/);
  assert.match(FICHA, /\.\.\.\(verTracking \? \['tracking' as const\] : \[\]\)/, 'Tracking no mira verTracking');
  for (const [nombre, src] of [['modal', SHEET], ['ruta', BODY]] as const) {
    assert.match(src, /<FichaPorBloques\b/, `${nombre}: no monta la ficha compartida`);
  }
});

// ── 13 · Reuniones ─────────────────────────────────────────────────────────────

test('Reuniones: sólo si el funnel del lead tiene una etapa de reunión, con la MISMA regla en las dos puertas', () => {
  // ⚠️ CAMBIADO A PROPÓSITO EL 14/10/2026: una regla, en la ficha compartida de las dos puertas.
  assert.match(FICHA, /const verReuniones = tieneEtapaDeReunion\(stages\);/, 'no usa tieneEtapaDeReunion');
  assert.match(FICHA, /\.\.\.\(verReuniones \? \['reuniones' as const\] : \[\]\)/, 'Reuniones no mira verReuniones');
  // 16/10/2026: la tab se declara con `deTab` (su nombre es el de la ficha del funnel, que el admin puede cambiar).
  assert.match(FICHA, /\.\.\.\(tabsBloques\.includes\('reuniones'\) \? \[deTab\('reuniones'\)\] : \[\]\)/);
  for (const src of [SHEET, BODY]) assert.match(src, /<FichaPorBloques\b/);
});

// ── 19 · MaKo Analyst ──────────────────────────────────────────────────────────

test('MaKo Analyst: el chat atado al lead en las dos puertas, y el análisis de llamadas plegado y sólo si hay algo', () => {
  const pieza = codigo('app/crm/lead-view/AnalystDelLead.tsx');
  assert.match(pieza, /import \{ MakoAnalystLead \} from '\.\/MakoAnalystLead';/);
  assert.match(pieza, /<MakoAnalystLead leadId=\{lead\.id\} nombre=\{lead\.nombre\} \/>/, 'el chat se monta con el lead');
  assert.match(pieza, /const hayAnalisis = !!inicial \|\| llamadas\.length > 0;/);
  assert.match(pieza, /\{hayAnalisis && \(\s*<details/, 'lo de antes va plegado (details) y sólo si hay algo');
  // ⚠️ CAMBIADO A PROPÓSITO EL 14/10/2026: el chat se monta una vez, en la ficha compartida; cada puerta
  // le dice cuánto alto le queda visible.
  // Desde el 16/10/2026 el chat vive en el panel «AI Analyst» (a la izquierda, alto completo), no en una pestaña.
  assert.match(FICHA, /<AnalystDelLead[\s\S]*?alto="calc\(100vh - 90px\)"/);
  assert.match(SHEET, /<FichaPorBloques[\s\S]*?altoChat=\{ALTO_CHAT_EN_EL_POPUP\}/);
  assert.match(BODY, /<FichaPorBloques[\s\S]*?altoChat=\{ALTO_CHAT_EN_LA_RUTA\}/);
  for (const src of [SHEET, PAGE, BODY, FICHA]) assert.doesNotMatch(src, /<GeneratedInsightCard/, 'el análisis viejo no se monta suelto');
});

// ── 11 · Portada, cara y nombre ────────────────────────────────────────────────

test('la cabecera: portada y foto con las piezas de la casa, y el nombre se edita con un clic', () => {
  assert.match(CAB, /<CabeceraDetalle/, 'es la cabecera de la casa, no una copia');
  assert.match(CAB, /<PortadaPicker/);
  assert.match(CAB, /<IdentidadPicker/);
  assert.match(CAB, /onPortada=\{/);
  assert.match(CAB, /onIcono=\{/);
  assert.match(CAB, /onEncuadre=\{\(y\) => aplicar\(\{ portadaY: y \}\)\}/);
  assert.match(CAB, /await guardarCaraLeadAction\(lead\.id, cambio\)/);
  // El nombre: EditableInline + el mismo camino que «Información principal», y nunca vacío.
  assert.match(CAB, /<EditableInline[\s\S]*?onGuardar=\{guardarNombre\}/);
  assert.match(CAB, /await saveLeadMetaAction\(lead\.id, \{ nombre: nuevo \}\);/);
  assert.match(CAB, /if \(!nuevo\) \{ setVuelta/, 'un nombre vacío no se guarda');
  // Las etiquetas AL LADO del nombre, compactas («+N»), desde las dos puertas (13/10/2026: «poniendo
  // la opción de etiquetas al lado del título, y si tienen más de una etiqueta que aparezca como
  // "+2" y un desplegable»). Antes iban arriba, en el `kicker` (punto 9 del 12/10).
  // Probado rompiéndolo: devolverlas al `kicker` en el pop-up, 1 fallo.
  for (const src of [SHEET, BODY]) {
    assert.match(src, /junto=\{<EtiquetasDelLead compacto leadId=\{lead\.id\}/, 'las etiquetas no van al lado del nombre');
    assert.doesNotMatch(src, /kicker=\{<EtiquetasDelLead/, 'volvió el renglón de etiquetas arriba del nombre');
  }
  assert.match(CAB, /\{junto != null && <span className="cl-junto">\{junto\}<\/span>\}/);
});

// Martín, 14/10/2026: «Y la etiqueta, vuelve a como estaba antes, pero que esté ubicado donde esta
// ahora... Antes estaba bien el diseño, yo me refería a "+2" cuando son más de 1 etiqueta
// seleccionada, pero la primera siempre debe estar visible normalmente». El 13/10 (a98318cb) la
// forma compacta había achicado el chip (`chico`) y dejado agregar en un «＋» suelto de 30 px; el
// lugar (al lado del nombre) se queda, el diseño vuelve: el chip de siempre, el «+N» sólo desde la
// segunda, con su ✕ por renglón, y la píldora «＋ Etiqueta» de 150 × 30.
//
// ⚠️ Verificado rompiéndolo (14/10/2026), una rotura por vez y restaurando. Con todo puesto: 10
// pases, 0 fallos. Cada rotura, 1 FALLO y 9 pases:
//   · devolverle `chico` al chip de la primera .......................................... 1 fallo
//   · el «+N» con UNA sola etiqueta (`(suyas ?? []).length > 0` en vez de `resto`) ........ 1 fallo
//   · la píldora otra vez de 30 al lado del nombre (`width={compacto ? 30 : 150}`) ....... 1 fallo
//   · los renglones del «+N» sin su ✕ (sin `acciones`) ................................... 1 fallo
//   · la píldora sin texto (`placeholder=""`, el «＋» suelto de antes) ..................... 1 fallo
//   · la píldora antes del «+N» (`{agregar}` pegado a la primera) ......................... 1 fallo
// (Las seis, vueltas a correr el 14/10/2026 con un script que rompe y restaura: 9 pases, 1 fallo
// cada una.)
//
// Lo que este test NO cubre, porque vive en CabeceraLead.tsx: `.cl-junto` es `flex:none`, así que
// el `flexWrap` del grupo no se activa nunca y, en una pantalla angosta, una etiqueta larga (el chip
// llega a 220 px) + «+N» + la píldora de 150 pasan el ancho y `.cd-txt` (overflow:hidden) recorta
// la píldora.
test('las etiquetas al lado del nombre: la primera es el chip de siempre, el «+N» desde la segunda y la píldora «＋ Etiqueta»', () => {
  const src = codigo('app/crm/lead-view/EtiquetasDelLead.tsx');
  const iCompacto = src.indexOf('if (compacto) {');
  const iNormal = src.indexOf('<div style={{ display: \'flex\', flexDirection: \'column\'', iCompacto);
  assert.ok(iCompacto > 0 && iNormal > iCompacto, 'no encontré las dos formas: el test quedó viejo');
  const compacto = src.slice(iCompacto, iNormal);

  // Un solo chip y una sola píldora para las dos formas, sin nada que dependa de `compacto`.
  assert.match(src, /const chip = \(e: EtiquetaDelLead\) => \(\s*<ChipEtiqueta key=\{e\.id\} e=\{e\} ocupado=\{ocupada === e\.id\} onSacar=\{\(\) => void escribir\('sacar', e\)\} \/>\s*\);/);
  assert.doesNotMatch(src, /\bchico\b/, 'la primera etiqueta se ve normal, no en un chip chico');
  assert.doesNotMatch(src, /compacto \?/, 'el chip o la píldora vuelven a cambiar al lado del nombre');
  const agregar = src.slice(src.indexOf('const agregar = ('), src.indexOf('if (compacto) {'));
  assert.match(agregar, /<SelectorEtiqueta value=\{null\} accion editable placeholder="Etiqueta" ariaLabel="Agregar una etiqueta"/);
  assert.match(agregar, /width=\{150\}/);
  assert.match(agregar, /buttonStyle=\{\{ height: 30, padding: '0 10px', borderRadius: 999, fontSize: 12\.5 \}\}/);

  // Al lado del nombre: la primera, el «+N» con las DEMÁS (sólo si hay), y la píldora.
  assert.match(compacto, /const \[primera, \.\.\.resto\] = suyas \?\? \[\];/);
  assert.match(compacto, /\{primera && chip\(primera\)\}/);
  assert.match(compacto, /\{resto\.length > 0 && \(\s*<Dropdown value="" botonLabel=\{`\+\$\{resto\.length\}`\}/, 'el «+N» es de las demás, y sólo aparece desde la segunda');
  assert.match(compacto, /options=\{resto\.map\(\(e\) => \(\{[\s\S]*?acciones: \[\{ icono: <span aria-hidden[^>]*>×<\/span>, title: `Eliminar \$\{e\.nombre\}`, onClick: \(\) => void escribir\('sacar', e\) \}\]/, 'cada renglón del «+N» con su ✕');
  assert.ok(compacto.indexOf('{agregar}') > compacto.indexOf('<Dropdown'), 'la píldora va después del «+N»');
});

test('la action de la cara: la puerta del CRM, el workspace de la sesión y el mismo saneo que Customer Success', () => {
  const src = leer('app/crm/lead-cabecera-actions.ts');
  const cod = sinComentarios(src);
  assert.match(src, /^'use server';/);
  // Un 'use server' sólo exporta funciones async (y tipos).
  const exportados = [...cod.matchAll(/^export\s+(\w+)\s+(\w+)/gm)].map((m) => `${m[1]} ${m[2]}`);
  assert.ok(exportados.length >= 2, 'no encontré los exports: el test quedó viejo');
  assert.ok(exportados.every((e) => e === 'async function' || e.startsWith('type ')), `exporta algo que no es una función async: ${exportados.join(', ')}`);
  assert.match(cod, /getRolWsEfectivo\(\)\) == null\) return/, 'sin sesión, nada');
  assert.match(cod, /tabEnCapa\('crm', await getCapaActual\(\)\)/, 'sin el CRM en la capa, nada');
  assert.match(cod, /\.update\(upd\)\.eq\('id', leadId\)\.eq\('workspace_id', ws\)/, 'el lead tiene que ser del workspace de la sesión');
  assert.match(cod, /if \(!data\) return \{ ok: false, error: 'Ese lead no es de esta cuenta\.' \};/);
  assert.match(cod, /saneaPortada\(cambio\.portada\)/);
  assert.match(cod, /saneaIcono\(cambio\.icono\)/);
  assert.doesNotMatch(cod, /avatar_url/, 'la foto vieja no se toca: «Quitar» la tiene que devolver');
});

// ── 12 · El pie del pop-up ─────────────────────────────────────────────────────

test('el pop-up: la cruz va sobre la portada, el pie no tiene «Cerrar» y «Borrar lead» es el tacho rojo', () => {
  assert.match(SHEET, /<CabeceraLead[\s\S]*?onCerrar=\{onClose\}/);
  assert.doesNotMatch(SHEET, />Cerrar<\/button>/, 'volvió el «Cerrar» del pie');
  assert.match(SHEET, /<BotonBorrar texto="Borrar lead"/);
  assert.match(BODY, /<BotonBorrar texto="Borrar lead"/);
  // La ruta no tiene cruz: es una pantalla, se vuelve con «Volver». (Desde el 13/10/2026 la ruta
  // monta el señalador y el modal de avisos, que sí se cierran: lo que se mira es la CABECERA.)
  const iCab = BODY.indexOf('<CabeceraLead');
  const cab = BODY.slice(iCab, BODY.indexOf('\n      />', iCab));
  assert.ok(iCab > 0 && cab.length > 100, 'no encontré la cabecera de la ruta');
  assert.doesNotMatch(cab, /onCerrar=/);
});

// ── 14 y 16 · Ancho y pestañas pegadas ─────────────────────────────────────────

test('el pop-up es más ancho, y la ruta usa el mismo ancho', () => {
  assert.ok(ANCHO_FICHA_LEAD >= 1000, `«bastante más ancho» que 760: ${ANCHO_FICHA_LEAD}`);
  assert.match(SHEET, /maxWidth: ANCHO_FICHA_LEAD/);
  assert.match(PAGE, /maxWidth: ANCHO_FICHA_LEAD/);
  assert.doesNotMatch(SHEET, /maxWidth: 760/);
});

test('la fila de pestañas queda pegada arriba en las dos puertas, contra el ancestro que scrollea', () => {
  const tabs = codigo('app/crm/lead-view/LeadTabs.tsx');
  assert.match(tabs, /\.\.\.\(fija \? \{ position: 'sticky' as const, top: 0, zIndex: 5, background: fija\.fondo/);
  // ⚠️ Desde el 14/10/2026 la fila la dibuja la ficha compartida (FichaPorBloques), con el fondo que le
  // pasa cada puerta.
  assert.match(FICHA, /fija=\{\{ fondo: fondoTabs \}\}/);
  assert.match(SHEET, /fondoTabs="var\(--surface\)"/);
  assert.match(BODY, /fondoTabs="var\(--bg\)"/);
  // En el pop-up el que scrollea es el cuerpo, que TIENE ALTO (flex: 1 en un panel topeado), y la
  // cabecera queda afuera de él: fija.
  const iCab = SHEET.indexOf('<CabeceraLead');
  const iCuerpo = SHEET.indexOf("flex: 1, minHeight: 0, overflowY: 'auto'");
  const iTabs = SHEET.indexOf('<FichaPorBloques');
  assert.ok(iCab >= 0 && iCuerpo > iCab && iTabs > iCuerpo, 'la cabecera va ANTES del cuerpo que scrollea, y las pestañas adentro');
  // ⚠️ Y entre las pestañas y el cuerpo que scrollea no puede haber nada con `overflow`, `transform` ni
  // `container-type`: el sticky se pegaría a eso (y lo fijo de las tarjetas también).
  const css = codigo('app/crm/lead-view/ficha/ficha-css.ts');
  assert.doesNotMatch(css, /container-type|[\s;{]transform:|\.fb \{[^}]*overflow/,'la ficha le puso a un ancestro algo que rompe el sticky o lo fijo');
});
