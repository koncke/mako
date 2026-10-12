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
  // El pop-up lo recibe de getLeadFullAction; la ruta lo lee ella.
  const acc = codigo('app/crm/actions.ts');
  assert.match(acc, /const verTrackingP = verTrackingDeLead\(lead\.funnel_id\);/);
  assert.match(acc, /verTracking: await verTrackingP \};/);
  assert.match(PAGE, /verTrackingDeLead\(lead\.funnel_id\)\]\);/);
  assert.match(SHEET, /const verTracking = vigente\.verTracking \?\? true;/);
  for (const [nombre, src] of [['modal', SHEET], ['ruta', PAGE]] as const) {
    assert.match(src, /\.\.\.\(verTracking \? \[\{\s*key: 'comportamiento', label: 'Tracking'/, `${nombre}: Tracking no mira verTracking`);
  }
});

// ── 13 · Reuniones ─────────────────────────────────────────────────────────────

test('Reuniones: sólo si el funnel del lead tiene una etapa de reunión, con la MISMA regla en las dos puertas', () => {
  for (const [nombre, src] of [['modal', SHEET], ['ruta', PAGE]] as const) {
    assert.match(src, /const verReuniones = tieneEtapaDeReunion\(stages\);/, `${nombre}: no usa tieneEtapaDeReunion`);
    assert.match(src, /\.\.\.\(verReuniones \? \[\{ key: 'reuniones', label: 'Reuniones'/, `${nombre}: Reuniones no mira verReuniones`);
  }
});

// ── 19 · MaKo Analyst ──────────────────────────────────────────────────────────

test('MaKo Analyst: el chat atado al lead en las dos puertas, y el análisis de llamadas plegado y sólo si hay algo', () => {
  const pieza = codigo('app/crm/lead-view/AnalystDelLead.tsx');
  assert.match(pieza, /import \{ MakoAnalystLead \} from '\.\/MakoAnalystLead';/);
  assert.match(pieza, /<MakoAnalystLead leadId=\{lead\.id\} nombre=\{lead\.nombre\} \/>/, 'el chat se monta con el lead');
  assert.match(pieza, /const hayAnalisis = !!inicial \|\| llamadas\.length > 0;/);
  assert.match(pieza, /\{hayAnalisis && \(\s*<details/, 'lo de antes va plegado (details) y sólo si hay algo');
  assert.match(SHEET, /<AnalystDelLead[\s\S]*?alto=\{ALTO_CHAT_EN_EL_POPUP\}/);
  assert.match(PAGE, /<AnalystDelLead[\s\S]*?alto=\{ALTO_CHAT_EN_LA_RUTA\}/);
  for (const src of [SHEET, PAGE]) assert.doesNotMatch(src, /<GeneratedInsightCard/, 'el análisis viejo no se monta suelto');
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
  // Las etiquetas arriba del nombre: van en el `kicker`, desde las dos puertas.
  for (const src of [SHEET, BODY]) {
    assert.match(src, /kicker=\{<EtiquetasDelLead leadId=\{lead\.id\}/, 'las etiquetas no van arriba del nombre');
  }
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
  // La ruta no tiene cruz: es una pantalla, se vuelve con «Volver».
  assert.doesNotMatch(BODY, /onCerrar=/);
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
  assert.match(SHEET, /fija=\{\{ fondo: 'var\(--surface\)' \}\}/);
  assert.match(BODY, /fija=\{\{ fondo: 'var\(--bg\)' \}\}/);
  // En el pop-up el que scrollea es el cuerpo, que TIENE ALTO (flex: 1 en un panel topeado), y la
  // cabecera queda afuera de él: fija.
  const iCab = SHEET.indexOf('<CabeceraLead');
  const iCuerpo = SHEET.indexOf("flex: 1, minHeight: 0, overflowY: 'auto'");
  const iTabs = SHEET.indexOf('<LeadTabs');
  assert.ok(iCab >= 0 && iCuerpo > iCab && iTabs > iCuerpo, 'la cabecera va ANTES del cuerpo que scrollea, y las pestañas adentro');
});
