// =============================================================================
// La ficha del lead, lo que se edita ADENTRO — feedback de Martín del 12/10/2026
// =============================================================================
// Los puntos 5 (el teléfono de la ficha), 7 (la tarjeta entera abre el campo), 15 (el «Solucionar»
// sin «Guardar y completar después»), 17 (las notas) y 21/28 (el ingreso estimado y el Instagram,
// con su migración). Lo que se puede EJECUTAR se ejecuta (las reglas puras de app/crm/campo-inline.ts
// y el mapper del tablero); lo que vive en el cableado se lee del fuente SIN comentarios, porque la
// casa cita en los comentarios lo que se sacó y un guard que lee la prosa se acusa a sí mismo.
//
// Probado rompiéndolo, uno por uno (12/10/2026). Con el código como está: 12 pases, 0 fallos.
//   · `montoDeTexto` lee «1.500» como 1,5 (sin la regla de los miles)        → 11 / 1
//   · `usuarioInstagram` acepta el link de un post (`/p/…`)                   → 11 / 1
//   · `telefonoAGuardar` reescribe aunque los dígitos no cambien              → 11 / 1
//   · el ingreso estimado se escribe por 'lead' (updateLead) y no por 'meta'  → 11 / 1
//   · `LISTA_COLS` sin `ingreso_estimado`                                     → 11 / 1
//   · el mapper sin `ingresoEstimado` (ejecutado)                             → 11 / 1
//   · una ficha deja de pasar `instagram` a «Información principal»          → 11 / 1
//   · el `update` de una nota sin `.eq('campo', 'Nota')`                      → 11 / 1
//   · la caja de la nota con `resize: 'vertical'`                            → 11 / 1
//   · la tarjeta sin el `contains` del portal (CajaCampo)                     → 11 / 1
//   · el resumen de «Completar datos» se dibuja con una sola pregunta         → 11 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GESTO_INLINE, VIA_INLINE, linkInstagram, montoDeTexto, telefonoAGuardar, usuarioInstagram, valorDeCampo,
} from '../app/crm/campo-inline';
import { TOPE_NOTA, fechaDeNota } from '../app/crm/notas-reglas';
import { splitTelefono } from '../lib/paises';

const RAIZ = resolve(import.meta.dirname, '..');
const crudo = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
/**
 * Sin comentarios: las líneas PRIMERO y los bloques después (AGENTS.md). Un bloque se reconoce
 * cuando ARRANCA un renglón o abre un `{` de JSX: un `accept="image/…"` con su asterisco en el
 * medio de una línea abría un «comentario» que se comía media pantalla del wizard (medido: el
 * stripper ingenuo dejaba StageMoveDialog sin su `const enResumen`).
 */
const sinComentarios = (s: string) => s
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/^([ \t]*)\/\*[\s\S]*?\*\//gm, '$1')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const fuente = (p: string) => sinComentarios(crudo(p));
/** El cuerpo de una función: desde su firma hasta el cierre en la columna 0. */
const cuerpo = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\n}\n', i);
  return src.slice(i, fin < 0 ? undefined : fin);
};

// ── 1 · Las reglas puras ─────────────────────────────────────────────────────

test('un monto se lee como lo escribe una persona, y «1.500» son mil quinientos', () => {
  assert.equal(montoDeTexto('1500'), 1500);
  assert.equal(montoDeTexto('$1,500'), 1500);
  assert.equal(montoDeTexto('1.500'), 1500, 'punto + tres dígitos = miles (es-MX)');
  assert.equal(montoDeTexto('1,500.50'), 1500.5);
  assert.equal(montoDeTexto('1.500,50'), 1500.5);
  assert.equal(montoDeTexto('US$ 2000'), 2000);
  assert.equal(montoDeTexto('1500,5'), 1500.5, 'coma decimal');
  assert.equal(montoDeTexto('1.5'), 1.5);
  assert.equal(montoDeTexto('mil'), null);
  assert.equal(montoDeTexto('-30'), null, 'un negativo no es un ingreso');
  assert.equal(montoDeTexto(''), null);
  // Y el server valida lo mismo (`valorDeCampo`): vaciar es legítimo, no es 0.
  assert.equal(valorDeCampo('ingreso_estimado', '$1,500'), 1500);
  assert.equal(valorDeCampo('ingreso_estimado', 2500.556), 2500.56, 'centavos como mucho');
  assert.equal(valorDeCampo('ingreso_estimado', ''), null);
  assert.equal(valorDeCampo('ingreso_estimado', null), null);
  assert.throws(() => valorDeCampo('ingreso_estimado', 'un montón'), /monto en dólares/);
  assert.throws(() => valorDeCampo('ingreso_estimado', -5), /monto en dólares/);
  assert.throws(() => valorDeCampo('ingreso_estimado', true), /no es un sí\/no/);
  // Un número en un campo de texto no entra (el tipo de la action ahora admite números).
  assert.throws(() => valorDeCampo('closer', 12), /no es un número/);
});

test('el usuario de Instagram sale igual del @, del usuario pelado y del link del perfil', () => {
  assert.equal(usuarioInstagram('@MartinKoncke'), 'martinkoncke');
  assert.equal(usuarioInstagram('martin.koncke_'), 'martin.koncke_');
  assert.equal(usuarioInstagram('https://www.instagram.com/martinkoncke/?igsh=abc'), 'martinkoncke');
  assert.equal(usuarioInstagram('instagram.com/martinkoncke'), 'martinkoncke');
  // Un link a un post o a un reel NO nombra a nadie: guardaría «p» como usuario.
  assert.equal(usuarioInstagram('https://www.instagram.com/p/Cx123/'), null);
  assert.equal(usuarioInstagram('https://instagram.com/reel/abc'), null);
  assert.equal(usuarioInstagram('martin koncke'), null, 'con espacios es un nombre, no un usuario');
  assert.equal(usuarioInstagram('x'.repeat(31)), null);
  assert.equal(usuarioInstagram(''), null);
  assert.equal(linkInstagram('@martinkoncke'), 'https://www.instagram.com/martinkoncke/');
  assert.equal(linkInstagram(null), null);
  assert.equal(valorDeCampo('instagram', '@MartinKoncke'), 'martinkoncke');
  assert.equal(valorDeCampo('instagram', ''), null);
  assert.throws(() => valorDeCampo('instagram', 'martin koncke'), /usuario de Instagram/);
});

test('el teléfono de la ficha no se reescribe si los DÍGITOS no cambiaron', () => {
  // Guardado como lo mandó Calendly: abrirlo y cerrarlo no escribe nada.
  assert.equal(telefonoAGuardar('+52 1 55 5555 5555', '+52', '15555555555'), null);
  assert.equal(telefonoAGuardar('5215555555555', '+52', '1 55-5555-5555'), null);
  // Cambió: salen los dígitos de lada + número (lo que emite TelefonoConPais en todos lados).
  assert.equal(telefonoAGuardar('+52 1 55 5555 5555', '+54', '9 223 355 0684'), '5492233550684');
  assert.equal(telefonoAGuardar(null, '+52', '55 1234 5678'), '525512345678');
  // Vaciar el número es borrar el teléfono; vacío sobre vacío no escribe.
  assert.equal(telefonoAGuardar('5215555555555', '+52', ''), '');
  assert.equal(telefonoAGuardar(null, '+52', ''), null);
});

// Revisión del 12/10/2026: un teléfono guardado SIN código de país no matchea ninguna lada,
// `splitTelefono` lo abre como +52, y cerrar la ficha sin tocar nada guardaba «522233550684».
// ROTO A PROPÓSITO (12/10/2026), restaurando de memoria, contra 15 / 0 de base:
//   · `telefonoAGuardar` sin la regla de `inicial`                  → 14 / 1
//   · el editor sin pasarle `inicial.current`                        → 14 / 1 (cae el guard del
//     cableado, en «las DOS fichas pasan…»)
test('un teléfono guardado sin código de país no se reescribe con +52 al abrirlo y cerrarlo', () => {
  for (const antes of ['2233550684', '044 686 399 6369', '0223 155 123456', '8112345678', '52']) {
    const p = splitTelefono(antes);
    assert.equal(telefonoAGuardar(antes, p.lada, p.resto, p), null, `${antes} se reescribió sin que nadie lo tocara`);
  }
  // Si la persona SÍ cambió algo, se guarda como siempre.
  assert.equal(telefonoAGuardar('2233550684', '+54', '2233550684', { lada: '+52', resto: '2233550684' }), '542233550684');
  assert.equal(telefonoAGuardar('2233550684', '+52', '223 355 0685', { lada: '+52', resto: '2233550684' }), '522233550685');
  assert.equal(telefonoAGuardar('2233550684', '+52', '', { lada: '+52', resto: '2233550684' }), '', 'vaciarlo sigue siendo borrarlo');
});

test('el ingreso estimado y el Instagram se escriben por el camino corto: no son una venta', () => {
  // `updateLead` aplica las invariantes del desenlace (monto ⇔ cerro) y le avisa a Meta. Un
  // estimado no decide nada de eso, y no puede tocar `monto_cierre_usd`, que es lo que cuenta Revenue.
  assert.equal(VIA_INLINE.ingreso_estimado, 'meta');
  assert.equal(VIA_INLINE.instagram, 'meta');
  assert.equal(GESTO_INLINE.ingreso_estimado, 'monto');
  assert.equal(GESTO_INLINE.instagram, 'instagram');
});

// ── 2 · La migración y el camino del dato ────────────────────────────────────

test('la migración 0258 agrega las DOS columnas y dice que va ANTES del deploy', () => {
  const ruta = 'supabase/migrations/0258_lead_ingreso_e_instagram.sql';
  assert.ok(existsSync(resolve(RAIZ, ruta)), 'falta la migración');
  const sql = crudo(ruta);
  assert.match(sql, /alter table leads add column if not exists ingreso_estimado numeric;/);
  assert.match(sql, /alter table leads add column if not exists instagram text;/);
  assert.match(sql, /ORDEN DE DESPLIEGUE: ANTES del deploy/);
});

test('el tablero BAJA las dos columnas, la ficha las tipa y `saveLeadMeta` las escribe', () => {
  const leads = fuente('lib/leads.ts');
  const i = leads.indexOf('const LISTA_COLS =');
  const lista = leads.slice(i, leads.indexOf(';', i));
  const cols = new Set([...lista.matchAll(/'([^']*)'/g)].flatMap((m) => m[1].split(',')).map((c) => c.trim()).filter(Boolean));
  assert.ok(cols.has('ingreso_estimado'), 'LISTA_COLS sin ingreso_estimado: el total de la columna no tendría datos');
  assert.ok(cols.has('instagram'), 'LISTA_COLS sin instagram');
  const tipo = cuerpo(leads, 'export type Lead = {');
  assert.match(tipo, /ingreso_estimado\?: number \| null;/);
  assert.match(tipo, /instagram\?: string \| null;/);
  const save = cuerpo(leads, 'export async function saveLeadMeta(');
  assert.match(save, /if \(meta\.ingreso_estimado !== undefined\) payload\.ingreso_estimado = meta\.ingreso_estimado;/);
  assert.match(save, /if \(meta\.instagram !== undefined\) payload\.instagram = meta\.instagram;/);
  // El historial los registra y se pueden deshacer, por los DOS caminos de revertir.
  assert.match(leads, /\{ k: 'ingreso_estimado', label: 'Ingreso estimado' \}/);
  assert.match(leads, /\{ k: 'instagram', label: 'Instagram' \}/);
  const acc = fuente('app/crm/actions.ts');
  assert.match(acc, /'Ingreso estimado', 'Instagram',/, 'REVERTIBLES');
  assert.match(acc, /case 'Ingreso estimado': await saveLeadMeta\(leadId, \{ ingreso_estimado: ingresoDelHistorial\(v\) \}\); break;/);
  assert.match(acc, /case 'Ingreso estimado': meta\.ingreso_estimado = ingresoDelHistorial\(v\); break;/);
  assert.match(acc, /case 'Instagram': await saveLeadMeta\(leadId, \{ instagram: v \}\); break;/);
  assert.match(acc, /case 'Instagram': meta\.instagram = v; break;/);
  // Y la action del campo en el lugar manda el VALOR del tipo de la columna (un número, no un texto).
  assert.match(cuerpo(acc, 'export async function guardarCampoLeadAction('), /await saveLeadMeta\(id, \{ \[campo\]: v \} as LeadMetaInput\);/);
});

test('el mapper del tablero da `ingresoEstimado` (ejecutado): null no es 0, y un numeric en texto se suma', () => {
  const crmMap = JSON.stringify(resolve(RAIZ, 'app/crm/crm-map.ts'));
  const codigo = `
    import { pathToFileURL } from 'node:url';
    const { mapToCrmLead } = await import(pathToFileURL(${crmMap}).href);
    const base = { id: 1, nombre: 'Prueba', estado_lead: 'abierto', created_at: '2026-10-12T00:00:00Z' };
    console.log(JSON.stringify([
      mapToCrmLead({ ...base, ingreso_estimado: 1500 }, {}).ingresoEstimado,
      mapToCrmLead({ ...base, ingreso_estimado: '2500.5' }, {}).ingresoEstimado,
      mapToCrmLead({ ...base, ingreso_estimado: null }, {}).ingresoEstimado,
      mapToCrmLead({ ...base }, {}).ingresoEstimado,
    ]));
  `;
  const out = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', timeout: 170_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const linea = out.trim().split('\n').filter((x) => x.startsWith('[')).pop();
  assert.ok(linea, `el hijo no devolvió JSON:\n${out}`);
  assert.deepEqual(JSON.parse(linea!), [1500, 2500.5, null, null]);
  // El contrato con el tablero (los totales por columna): el tipo lo lleva y es obligatorio.
  assert.match(fuente('app/crm/CrmBoard.tsx'), /\n  ingresoEstimado: number \| null;/);
});

test('las DOS fichas pasan el ingreso estimado y el Instagram a «Información principal»', () => {
  for (const f of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/page.tsx']) {
    const s = fuente(f);
    const i = s.indexOf('<InfoPrincipalCard');
    const tag = s.slice(i, s.indexOf('/>', i));
    assert.match(tag, /ingresoEstimado=\{lead\.ingreso_estimado \?\? null\}/, `${f}: falta el ingreso estimado`);
    assert.match(tag, /instagram=\{lead\.instagram \?\? null\}/, `${f}: falta el Instagram`);
  }
  const card = fuente('app/crm/lead-view/InfoPrincipalCard.tsx');
  assert.match(card, /<MontoEditable leadId=\{leadId\} campo="ingreso_estimado"/);
  assert.match(card, /<InstagramEditable leadId=\{leadId\} valor=\{instagram\} \/>/);
  // El teléfono, con el país primero (punto 5): ya no es un texto libre.
  assert.match(card, /editor=\{<TelefonoEditable valor=/);
  assert.doesNotMatch(card, /label="Teléfono"\s+onGuardar=/, 'el teléfono volvió a ser texto libre');
  const ed = fuente('app/crm/lead-view/CampoEditable.tsx');
  assert.match(cuerpo(ed, 'export function TelefonoEditable('), /<TelefonoConPais[\s\S]*portalTo=\{nodo\}/);
  assert.match(cuerpo(ed, 'export function TelefonoEditable('), /telefonoAGuardar\(valor, l, n, inicial\.current\)/);
  assert.match(cuerpo(ed, 'export function TelefonoEditable('), /const p = splitTelefono\(valor \?\? ''\);\s*inicial\.current = p;/);
});

// ── 3 · La tarjeta entera abre el campo (punto 7) ────────────────────────────

test('un clic en cualquier parte de la tarjeta abre el campo, y un clic de un portal no', () => {
  const ed = fuente('app/crm/lead-view/CampoEditable.tsx');
  const caja = cuerpo(ed, 'export function CajaCampo(');
  assert.match(caja, /if \(!t \|\| !caja\.contains\(t\)\) return;/, 'un clic que llega por un portal (el menú, el toast) volvería a abrir el campo');
  assert.match(caja, /if \(salir\) return;/, 'tocar la tarjeta para salir de la edición la reabriría');
  // Cada pieza marca su disparador.
  for (const firma of ['export function FechaEditable(', 'export function TriEditable(', 'export function PersonaEditable(', 'export function MontoEditable(', 'export function TelefonoEditable(']) {
    assert.match(cuerpo(ed, firma), /data-campo-abrir/, `${firma} sin disparador marcado`);
  }
  // Y las tarjetas de un solo campo la usan: «que quede bien en todas las tarjetas».
  const usos: Array<[string, number]> = [
    ['app/crm/lead-view/ReunionesCard.tsx', 5],
    ['app/crm/lead-view/MotivoYPlazoCard.tsx', 2],
    ['app/crm/lead-view/CalificacionCard.tsx', 1],
  ];
  for (const [f, n] of usos) assert.equal((fuente(f).match(/<CajaCampo style=/g) ?? []).length, n, f);
  assert.match(fuente('app/crm/lead-view/InfoPrincipalCard.tsx'), /editable \? <CajaCampo style=\{celda\}>/);
});

// ── 4 · Las notas (punto 17) ─────────────────────────────────────────────────

test('las notas: la caja no se redimensiona, se dictan, y cada una se edita y se borra', () => {
  const card = fuente('app/crm/lead-view/NotasCard.tsx');
  assert.match(card, /resize: 'none'/);
  assert.doesNotMatch(card, /resize: 'vertical'/);
  assert.match(card, /<BotonDictar titulo="Dictar la nota" valor=\{texto\} onValor=\{setTexto\}/);
  assert.match(card, /editarNotaLeadAction\(leadId, id, t\)/);
  assert.match(card, /borrarNotaLeadAction\(leadId, n\.id\)/);
  assert.match(card, /<BotonBorrar talla="sm" title="Borrar la nota"/, 'borrar es el tacho rojo de la casa');
  assert.match(card, /<Confirm\s+title="¿Borrar esta nota\?"/);
});

test('las actions de las notas: guardas de las vecinas, y sólo tocan filas `Nota`', () => {
  const src = fuente('app/crm/notas-actions.ts');
  assert.match(crudo('app/crm/notas-actions.ts'), /^'use server';/);
  // En un 'use server' sólo se exportan funciones async (y tipos).
  const exports = [...src.matchAll(/^export (?!type )(.*)$/gm)].map((m) => m[1]);
  // 13/10/2026: + las tres del adjunto de una nota (subir, abrir, descartar; mig 0267).
  assert.ok(exports.length === 5 && exports.every((e) => e.startsWith('async function ')), `exports: ${exports.join(' | ')}`);
  const guarda = cuerpo(src, 'async function notaQueSePuedeTocar(');
  assert.match(guarda, /getRolWsEfectivo\(\)/);
  assert.match(guarda, /tabEnCapa\('crm', capa\)/);
  assert.match(guarda, /getWorkspaceActual\(\)/);
  assert.match(guarda, /rol !== 'admin'/, 'una nota la cambia quien la escribió, o un admin');
  // Las CUATRO consultas (leer, editar, borrar, abrir el adjunto) piden `campo = 'Nota'` y el
  // workspace: sin eso, un id cualquiera del historial se reescribiría o se borraría desde el navegador.
  assert.equal((src.match(/\.eq\('campo', 'Nota'\)/g) ?? []).length, 4);
  assert.equal((src.match(/\.eq\('workspace_id', (?:g\.)?ws/g) ?? []).length, 4);
  // Borrar deja rastro (sin el texto).
  assert.match(cuerpo(src, 'export async function borrarNotaLeadAction('), /logLeadEvent\(leadId, 'Nota borrada'/);
});

// Revisión del 12/10/2026: la edición recortaba a 4000 con un `slice` y el alta no tenía tope, así
// que corregir una letra de una nota dictada larga perdía la cola con el toast «Nota guardada».
// ROTO A PROPÓSITO (12/10/2026), restaurando de memoria, contra 15 / 0 de base:
//   · la edición vuelve a `trim().slice(0, TOPE_NOTA)` sin el rechazo   → 14 / 1
//   · el alta sin su `if (t.length > TOPE_NOTA)`                        → 14 / 1
//   · la caja de la edición sin `maxLength`                             → 14 / 1
test('una nota tiene UN tope para el alta y la edición, y pasarlo se RECHAZA: nunca se recorta en silencio', () => {
  assert.equal(TOPE_NOTA, 4000);
  const src = fuente('app/crm/notas-actions.ts');
  const editar = cuerpo(src, 'export async function editarNotaLeadAction(');
  assert.doesNotMatch(editar, /\.slice\(/, 'la edición volvió a recortar: corregir una letra perdía la cola');
  assert.match(editar, /if \(t\.length > TOPE_NOTA\) return \{ ok: false, error: 'La nota es demasiado larga\.' \};/);
  assert.doesNotMatch(src, /const TOPE_NOTA\b/, 'una segunda copia del tope');
  const alta = cuerpo(fuente('app/crm/actions.ts'), 'export async function addLeadNoteAction(');
  assert.match(alta, /if \(t\.length > TOPE_NOTA\) throw new Error\('La nota es demasiado larga\.'\);/,
    'sin tope en el alta nace una nota que la edición no puede guardar');
  const card = fuente('app/crm/lead-view/NotasCard.tsx');
  assert.equal((card.match(/maxLength=\{TOPE_NOTA\}/g) ?? []).length, 2, 'las dos cajas topean al escribir');
  // Lo dictado no pasa por el maxLength: se frena antes de mandarlo, con su motivo.
  assert.match(card, /if \(t\.length > TOPE_NOTA\) \{ show\('Nota demasiado larga'/);
});

// Revisión del 12/10/2026: «Nota borrada» armaba la fecha con los getters UTC.
// ROTO A PROPÓSITO (12/10/2026), restaurando de memoria, contra 15 / 0 de base:
//   · `fechaDeNota` con `timeZone: 'UTC'` en vez de la zona           → 14 / 1
//   · borrar vuelve a los `getUTCDate`/`getUTCMonth`                  → 14 / 1
test('«Nota borrada» deja la fecha en la zona del NEGOCIO, la que mostraba la tarjeta, nunca en UTC', () => {
  // 18:30 del 11/10 en Tijuana es la 01:30 UTC del 12/10: la tarjeta decía 11/10.
  assert.equal(fechaDeNota('2026-10-12T01:30:00+00:00', 'America/Tijuana'), '11/10/2026');
  assert.equal(fechaDeNota('2026-10-12T01:30:00+00:00', 'UTC'), '12/10/2026');
  assert.equal(fechaDeNota('no es una fecha', 'America/Tijuana'), '');
  assert.equal(fechaDeNota('2026-10-12T01:30:00+00:00', 'Zona/Inventada'), '', 'mejor sin fecha que con la equivocada');
  const borrar = cuerpo(fuente('app/crm/notas-actions.ts'), 'export async function borrarNotaLeadAction(');
  assert.match(borrar, /const fecha = fechaDeNota\(r\.fila\.created_at, await tzActual\(\)\);/);
  assert.doesNotMatch(borrar, /getUTC/);
});

// ── 5 · «Solucionar» (punto 15) ──────────────────────────────────────────────

test('«Completar datos»: sin «Guardar y completar después», y el resumen sólo con más de un paso', () => {
  const d = fuente('app/crm/StageMoveDialog.tsx');
  assert.match(d, /if \(completarDatos\) \{\s*const preguntas = filtrados\.filter\(\(id\) => id !== 'resumen'\);\s*if \(preguntas\.length === 1\) return preguntas;\s*\}/);
  // El último paso confirma aunque no sea el resumen.
  assert.match(d, /const enUltimo = enResumen \|\| paso === pasos\[pasos\.length - 1\];/);
  assert.match(d, /enUltimo=\{enUltimo\}/);
  assert.match(d, /extraFooter=\{!enUltimo && !completarDatos \?/);
});
