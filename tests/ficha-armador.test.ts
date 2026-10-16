// =============================================================================
// El armador de la ficha por bloques: qué se dibuja, con qué ancho, a qué tab lleva «Solucionar», y que
// las dos puertas monten la MISMA pieza con la MISMA lectura
// =============================================================================
// Pedido de Martín (14/10/2026, 03:06): la ficha del lead como el editor del Dashboard, por bloques, con
// plantillas y los avisos de «datos sin marcar» en el mismo lugar. Diseño: docs/diseno-ficha-bloques.md.
// Lo puro (app/crm/lead-view/ficha/armar.ts y las reglas de cada tab) se prueba EJECUTÁNDOLO; lo que es
// montaje (las dos puertas, el botón del admin, los modales que se fueron) se lee del fuente, sin comentarios.
//
// Correr: npx tsx --test tests/ficha-armador.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (re-medido el 15/10/2026, base 11/0), cada rotura restaurada de memoria antes de la
// siguiente. Los números del 14/10 («base 15/0») no eran de este archivo: el WIP no corrió sus tests completos,
// y dos roturas que decía cazar NO las cazaba (marcadas con ✱; se arreglaron las aserciones, ver abajo):
//   · `bloquesDeLaGrilla` sin saltear lo vacío mirando (`if (vacio && !o.editando) return;` fuera)  → 9 / 2
//   · `spansDeFilas` sin estirar la fila (devuelve los anchos tal cual)                              → 9 / 2
//   · ✱ `cubre: []` fuera del banner «Va bien» (`proxima-reunion`)                                     → 10 / 1
//       (antes 11/0: el lead del test no tenía el banner dibujado; ahora tiene la R1 por delante)
//   · `tabDelDato` mirando todas las tabs y no sólo las que ve el lead                                → 10 / 1
//   · ✱ `ofrecerEnAgregar` ofreciendo también lo que no tiene componente                             → 10 / 1
//       (antes 11/0: probaba con `redes-y-web`, que ya está puesto; ahora con `siguiente-accion`)
//   · `puedePersonalizar` sin mirar el rol (sólo `puedeEditarFicha`)                                  → 10 / 1
//   · la ruta /crm/[id] montando `<InfoPrincipalCard` a mano de nuevo                                 → 10 / 1
//   · page.tsx calculando `faltantesDeLead` por su cuenta (sin `getLeadFullAction`)                  → 10 / 1
//   · `REGLAS_RESUMEN.contacto` sin `incluye` (el respaldo deja la cohorte y las redes sin bloque)    → 10 / 1
//   · `estaVacio` fuera de `origen` (un bloque que se calla sin regla para callarse)                   → 9 / 2
//   · `registro-pagos.tsx` con una clave que sus reglas no tienen                                      → 10 / 1
//   · `<ResumenModal` de vuelta en InfoPrincipalCard                                                    → 10 / 1
// Y la vista por dispositivo (15/10/2026), cada una                                                    → 10 / 1:
//   `dispositivoVisto` sin volver al escritorio; un nombre distinto del Dashboard ('Tablet'); la tablet a
//   768 px; el celular sin apilar los bloques; el armador fuera de la página del dispositivo; la ficha sin
//   `dispositivoVisto` (queda angostada al volver a «Ver»); un `transform` en la página del dispositivo.
//
// ⚠️ UNA ASERCIÓN REESCRITA EL 15/10/2026 porque cambió DÓNDE vive lo que fija, no lo que fija: el celular de
//   «Personalizar» apila SIN `!important`: el ancho del bloque dejó de ir en un `style` en línea (va en
//   variables, ./Armador.tsx, para que la tablet corte por CSS) y ya no hay nada que pisar. El corte de la
//   tablet y del celular lo fija tests/ficha-pantallas.test.ts. Re-medido: base 11/0; sin apilar → 10/1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COLS } from '../lib/graficos-catalogo';
import { TEMA_BASE } from '../lib/graficos-temas';
import { bloqueDef, type BloqueId, type TabFicha } from '../lib/ficha/catalogo';
import { fichaEfectiva, RESPALDO_VACIO, type BloquePuesto } from '../lib/ficha/config';
import { PLANTILLA_RESPALDO, listaDePlantilla } from '../lib/ficha/plantillas';
import {
  COLS_FICHA, DISPOSITIVOS_FICHA, bloquesDeLaGrilla, disenoADibujar, disenosOfrecidos, dispositivoVisto, estiloDeFicha, lugarAlSoltar,
  ofrecerEnAgregar, puedePersonalizar, spansDeFilas, tabDelDato,
} from '../app/crm/lead-view/ficha/armar';
import { REGLAS, REGLAS_POR_ARCHIVO, reglasDe } from '../app/crm/lead-view/ficha/reglas';
import type { CtxFicha } from '../app/crm/lead-view/ficha/tipos';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

/** Un lead de prueba, con lo que leen las reglas. */
function ctxDe(lead: Record<string, unknown> = {}, data: Record<string, unknown> = {}, etapa = 'lead'): CtxFicha {
  const l = { id: 1, nombre: 'Ana', estado_lead: 'abierto', visitor_id: null, ...lead };
  return {
    data: { respuestasForm: [], respuestasLanding: [], campana: { texto: null, tooltip: null }, adNombre: null, adId: null,
      visitas: { total_visitas: 0, dias_distintos: 0 }, vslEng: { plays: 0, max_pct: null, sin_datos: true, porVideo: [] }, tracking: [], ...data },
    lead: l, stages: [], etapa, hoy: '2026-10-14', rol: 'admin', esAdmin: true, verPrivado: true, releer: () => {}, parchear: () => {},
  } as unknown as CtxFicha;
}
const vacioCon = (ctx: CtxFicha) => (p: BloquePuesto, r: { estaVacio?: (c: CtxFicha, p: BloquePuesto) => boolean }) => !!r.estaVacio?.(ctx, p);
const respaldo = fichaEfectiva('respaldo', null, RESPALDO_VACIO);

test('la grilla es la del Dashboard, y una fila que no se llena se estira', () => {
  assert.equal(COLS_FICHA, COLS, 'la ficha tiene que usar las mismas columnas que el Dashboard');
  assert.deepEqual(spansDeFilas([12]), [12]);
  assert.deepEqual(spansDeFilas([4]), [12], 'un ⅓ solo en su fila ocupa la fila entera: no deja ⅔ en blanco');
  assert.deepEqual(spansDeFilas([4, 6]), [5, 7], 'dos que suman 10 se reparten las 12 en proporción');
  assert.deepEqual(spansDeFilas([4, 4, 4]), [4, 4, 4]);
  assert.deepEqual(spansDeFilas([6, 6, 4]), [6, 6, 12], 'el que no entra baja de fila');
  assert.deepEqual(spansDeFilas([12, 4, 12]), [12, 12, 12]);
  assert.deepEqual(spansDeFilas([3, 3]), [6, 6]);
  for (const caso of [[3, 4, 6, 12, 4], [6, 4, 3, 3, 6], [4, 4, 6, 6, 3]]) {
    const s = spansDeFilas(caso);
    assert.equal(s.length, caso.length);
    assert.ok(s.every((x) => x >= 1 && x <= 12));
  }
});

test('mirando, lo vacío no se dibuja ni deja hueco; editando, se dibuja marcado como vacío', () => {
  const ctx = ctxDe();
  const mirando = bloquesDeLaGrilla(respaldo.tabs.resumen, { reglasDe, vacio: vacioCon(ctx), editando: false, verPrivado: true });
  // Un lead nuevo: sin reunión por delante, sin respuestas, sin origen, sin salida y fuera de la nutrición manual.
  assert.deepEqual(mirando.map((b) => b.def.id), ['contacto', 'calificacion', 'notas']);
  assert.deepEqual(mirando.map((b) => b.span), [12, 12, 12], 'la calificación queda sola entre dos de ancho completo: se estira');
  const editando = bloquesDeLaGrilla(respaldo.tabs.resumen, { reglasDe, vacio: vacioCon(ctx), editando: true, verPrivado: true });
  assert.ok(editando.some((b) => b.def.id === 'origen' && b.vacio), 'editando, lo vacío se ve (para moverlo o sacarlo)');
  assert.ok(!editando.some((b) => b.def.id === 'redes-y-web'), 'lo que no tiene componente no se dibuja ni editando');

  const perdido = ctxDe({ estado_lead: 'perdido', utm_source: 'ig' });
  const ids = bloquesDeLaGrilla(respaldo.tabs.resumen, { reglasDe, vacio: vacioCon(perdido), editando: false, verPrivado: true }).map((b) => b.def.id);
  assert.ok(ids.includes('motivo-de-salida'), 'el motivo sale sólo si salió');
  assert.ok(ids.includes('origen'), 'con un dato de origen, el origen se dibuja');
  const conCoaching: BloquePuesto[] = [{ id: 'coaching-de-la-llamada', ancho: 6, diseno: 'puntaje' }];
  const reglaFalsa = () => ({});
  assert.equal(bloquesDeLaGrilla(conCoaching, { reglasDe: reglaFalsa, vacio: () => false, editando: false, verPrivado: false }).length, 0, 'lo privado no se le dibuja a quien no lo ve');
  assert.equal(bloquesDeLaGrilla(conCoaching, { reglasDe: reglaFalsa, vacio: () => false, editando: false, verPrivado: true }).length, 1);
});

test('«Solucionar» va a la tab donde ESTA ficha dibuja el campo, entre las que el lead ve', () => {
  const ctx = ctxDe();
  const o = { listaDe: (t: TabFicha) => respaldo.tabs[t], reglasDe, vacio: vacioCon(ctx), verPrivado: true };
  const todas: TabFicha[] = ['resumen', 'tracking', 'reuniones', 'pagos'];
  assert.equal(tabDelDato('telefono', todas, o), 'resumen');
  assert.equal(tabDelDato('setter', todas, o), 'reuniones', 'el setter vive adentro de la reunión (ReunionesCard)');
  // Con el banner «Va bien» DIBUJADO (la R1 por delante): igual va a Reuniones, porque el banner no tiene el
  // campo de la fecha. Con un lead sin reunión el banner ni se dibuja y esto no probaba nada (15/10/2026).
  const conR1 = ctxDe({ fecha_junta_1: '2026-10-20', asistio_j1: null });
  const oR1 = { ...o, vacio: vacioCon(conR1) };
  assert.ok(bloquesDeLaGrilla(respaldo.tabs.resumen, { reglasDe, vacio: vacioCon(conR1), editando: false, verPrivado: true }).some((b) => b.def.id === 'proxima-reunion'));
  assert.equal(tabDelDato('fechaJ1', todas, oR1), 'reuniones', 'el banner «Va bien» del Resumen no tiene el campo de la fecha');
  assert.equal(tabDelDato('monto', todas, o), 'pagos');
  assert.equal(tabDelDato('setter', ['resumen', 'pagos'], o), null, 'sin la tab Reuniones, el asistente');
  assert.equal(tabDelDato('motivo', todas, o), null, 'un lead que no salió no dibuja el motivo: el asistente');
});

test('«Agregar bloque» ofrece sólo lo que tiene componente y no está puesto', () => {
  const lista = respaldo.tabs.resumen;
  const ofrece = (l: readonly BloquePuesto[], buscar?: string) => ofrecerEnAgregar('resumen', l, { registrado: (id) => !!reglasDe(id), verPrivado: true, buscar }).map((d) => d.id);
  assert.ok(!ofrece(lista).includes('notas'), 'lo puesto no se ofrece otra vez');
  assert.ok(!ofrece(lista).includes('redes-y-web'), 'lo que no tiene componente no se ofrece («pronto» no)');
  // Uno que NO está puesto y no tiene componente: con `redes-y-web` sólo, esto pasaba porque ya estaba puesto.
  assert.ok(!lista.some((p) => p.id === 'siguiente-accion') && !reglasDe('siguiente-accion'));
  assert.ok(!ofrece(lista).includes('siguiente-accion'), 'lo que no tiene componente no se ofrece («pronto» no)');
  const sinNotas = lista.filter((p) => p.id !== 'notas');
  assert.ok(ofrece(sinNotas).includes('notas'));
  assert.deepEqual(ofrece(sinNotas, 'NOTA'), ['notas'], 'el buscador no distingue mayúsculas');
  assert.ok(ofrece(lista).includes('visitas'), 'un bloque de otra tab con «también en» Resumen se ofrece');
});

test('mover, el diseño y el estilo de la ficha', () => {
  assert.equal(lugarAlSoltar(0, 3), 3);
  assert.equal(lugarAlSoltar(3, 0), 1);
  assert.equal(lugarAlSoltar(2, 2), null);
  assert.equal(lugarAlSoltar(2, 3), null, 'soltarlo justo después de sí mismo no lo mueve');

  const def = bloqueDef('proxima-reunion')!;
  const r = REGLAS['proxima-reunion']!;
  assert.equal(disenoADibujar({ id: 'proxima-reunion', ancho: 12, diseno: 'automatico' }, def, r), 'banner', 'un diseño que el componente no sabe dibujar cae al que sabe');
  assert.deepEqual(disenosOfrecidos(def, r).map((d) => d.id), ['banner', 'renglon'], 'en el orden del componente: el primero es el suyo');
  assert.deepEqual(disenosOfrecidos(bloqueDef('notas')!, REGLAS.notas!), [], 'con un solo diseño, no se ofrece «Diseño»');

  assert.deepEqual(estiloDeFicha({ tema: TEMA_BASE, densidad: 'normal' }), { clases: [], vars: {} }, 'con el estilo de siempre no se pisa nada');
  assert.deepEqual(estiloDeFicha({ tema: TEMA_BASE, densidad: 'compacta' }).clases, ['fb-dens-compacta']);
  const suave = estiloDeFicha({ tema: { plantilla: 'suave', acento: null, fuente: null }, densidad: 'normal' });
  assert.ok(suave.clases.includes('fb--tema') && suave.clases.includes('fb--letra'));
  assert.ok(suave.vars['--primary'] && suave.vars['--dash-tarjeta-radio'], 'el tema del Dashboard pinta la ficha con sus variables');
});

test('«Personalizar» es sólo del admin, y sólo con la ficha del funnel leída', () => {
  const ficha = { funnel: { id: 1 } } as never;
  assert.equal(puedePersonalizar({ puedeEditarFicha: true, rol: 'admin', ficha }), true);
  assert.equal(puedePersonalizar({ puedeEditarFicha: true, rol: 'setter', ficha }), false);
  assert.equal(puedePersonalizar({ puedeEditarFicha: false, rol: 'closer', ficha }), false);
  assert.equal(puedePersonalizar({ puedeEditarFicha: true, rol: 'admin', ficha: null }), false, 'sin la ficha leída, el primer cambio pisaría una que no se vio');

  const panel = sinComentarios(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx'));
  assert.match(panel, /const puede = puedePersonalizar\(data\);/);
  assert.match(panel, /const boton = puede \? \(/, 'el botón «Personalizar» se dibuja sólo con `puede`');
  assert.match(panel, />\{enEdicion \? 'Ver' : 'Personalizar'\}|\{enEdicion \? 'Ver' : 'Personalizar'\}/);
  assert.doesNotMatch(panel, /nombre="configurar"/, '«Personalizar» es un botón con texto, no un engranaje');
  const acc = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(acc, /puedeEditarFicha: rol === 'admin'/, 'el server dice que sólo el admin personaliza');
});

// Martín (14/10/2026): «tal como lo tenemos en la edición de Landing Generator, tienes que poder visualizar
// en la versión mobile». Es el selector del Dashboard, copiado, y angosta la ficha REAL.
test('personalizando, la vista por dispositivo del Dashboard angosta la ficha real', () => {
  // Los mismos tres que el editor del Dashboard, con sus nombres (DISPOSITIVOS, app/dashboard/EditorInforme.tsx).
  const dash = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  const lista = dash.slice(dash.indexOf('const DISPOSITIVOS'), dash.indexOf('];', dash.indexOf('const DISPOSITIVOS')));
  const delDash = [...lista.matchAll(/\{ id: '(\w+)', nombre: '([^']+)'/g)].map((m) => ({ id: m[1], nombre: m[2] }));
  assert.equal(delDash.length, 3, 'no encontré DISPOSITIVOS en el editor del Dashboard');
  assert.deepEqual(DISPOSITIVOS_FICHA.map((d) => ({ id: d.id, nombre: d.nombre })), delDash);
  // Sólo personalizando: al volver a «Ver», el escritorio.
  assert.equal(dispositivoVisto(true, 'movil'), 'movil');
  assert.equal(dispositivoVisto(false, 'movil'), 'escritorio', 'mirando la ficha no se queda angostada');
  assert.equal(dispositivoVisto(false, 'tableta'), 'escritorio');

  // La página del dispositivo envuelve al MISMO armador (no una vista aparte), y el selector va en la barra
  // de la edición con el dispositivo que se ve.
  const ficha = sinComentarios(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx'));
  assert.match(ficha, /const dispositivo = dispositivoVisto\(enEdicion, dispositivoElegido\);/);
  assert.match(ficha, /<div className="fb-pagina" data-dispositivo=\{dispositivo === 'escritorio' \? undefined : dispositivo\}>\s*\{armador\}\s*<\/div>/,
    'el dispositivo tiene que angostar el armador de verdad');
  assert.match(ficha, /<SelectorDispositivo valor=\{dispositivo\} onCambiar=\{setDispositivo\} \/>/);
  assert.equal((ficha.match(/<SelectorDispositivo\b/g) ?? []).length, 1);
  assert.ok(ficha.indexOf('<SelectorDispositivo') > ficha.indexOf('if (!enEdicion || !ff.ficha) return armador;'), 'el selector es de la edición');

  // Los anchos del Dashboard (app/dashboard/editor-css.ts), y en el celular un bloque abajo del otro.
  const ancho = (css: string, sel: string, disp: string) => css.match(new RegExp(`\\.${sel}\\[data-dispositivo="${disp}"\\] \\{[^}]*?width: (\\d+)px`))?.[1];
  const dashCss = leer('app/dashboard/editor-css.ts');
  const fichaCss = leer('app/crm/lead-view/ficha/ficha-css.ts');
  for (const d of ['tableta', 'movil']) {
    assert.ok(ancho(dashCss, 'lk-pagina', d), `no encontré el ancho de ${d} en el Dashboard`);
    assert.equal(ancho(fichaCss, 'fb-pagina', d), ancho(dashCss, 'lk-pagina', d), `el ${d} de la ficha no mide lo mismo que el del Dashboard`);
  }
  assert.match(fichaCss, /\.fb-pagina\[data-dispositivo="movil"\] \.fb-bloque \{ grid-column: 1 \/ -1; \}/, 'en el celular los bloques no van uno abajo del otro');
  const reglasDisp = fichaCss.split('\n').filter((l) => /\.fb-(lienzo|pagina)\[data-dispositivo/.test(l)).join('\n');
  assert.ok(reglasDisp.length > 0);
  assert.doesNotMatch(reglasDisp, /[{;\s](transform|filter|container-type)\s*:/, 'la página del dispositivo es ancestro de las tarjetas: un `position: fixed` adentro (modales, toasts) quedaría atado a ella');
});

test('los registros: cada bloque en el archivo de su tab, una vez, con las mismas claves que sus reglas', () => {
  const tabDeArchivo: Record<string, readonly string[]> = { resumen: ['resumen'], reuniones: ['reuniones'], tracking: ['tracking'], pagos: ['pagos'], cs: ['cs-resumen', 'cs-pagos'] };
  const vistos = new Set<string>();
  for (const [archivo, reglas] of Object.entries(REGLAS_POR_ARCHIVO)) {
    const claves = Object.keys(reglas);
    for (const id of claves) {
      const def = bloqueDef(id);
      assert.ok(def, `«${id}» no es un bloque del catálogo`);
      assert.ok(tabDeArchivo[archivo].includes(def!.tab), `«${id}» es de ${def!.tab} y está en reglas-${archivo}.ts`);
      assert.ok(!vistos.has(id), `«${id}» está registrado dos veces`);
      vistos.add(id);
      for (const inc of reglas[id as BloqueId]?.incluye ?? []) assert.ok(bloqueDef(inc), `«${id}» incluye «${inc}», que no existe`);
    }
    // El componente de cada regla, y ninguno de más: el registro y sus reglas tienen las mismas claves.
    const src = sinComentarios(leer(`app/crm/lead-view/ficha/registro-${archivo}.tsx`));
    const ini = src.indexOf(`export const REGISTRO_${archivo.toUpperCase()}`);
    assert.ok(ini > 0, `registro-${archivo}.tsx no exporta REGISTRO_${archivo.toUpperCase()}`);
    const enRegistro = [...src.slice(ini).matchAll(/^\s*'?([a-z0-9-]+)'?: \{ Componente:/gm)].map((m) => m[1]).sort();
    assert.deepEqual(enRegistro, [...claves].sort(), `registro-${archivo}.tsx y reglas-${archivo}.ts no registran lo mismo`);
  }
});

test('los registros cubren TODA la plantilla de respaldo, y lo que se calla tiene su regla para callarse', () => {
  const cubiertos = new Set<string>();
  for (const [id, r] of Object.entries(REGLAS)) { cubiertos.add(id); for (const inc of r?.incluye ?? []) cubiertos.add(inc); }
  for (const tab of ['resumen', 'reuniones', 'pagos', 'tracking'] as const) {
    for (const id of listaDePlantilla(PLANTILLA_RESPALDO, tab)) {
      assert.ok(cubiertos.has(id), `«${id}» (${tab}) no tiene componente ni lo dibuja otro: con el respaldo, la ficha perdería algo de antes`);
    }
  }
  for (const [id, r] of Object.entries(REGLAS)) {
    if (bloqueDef(id)?.sinDatos === 'se-calla') assert.ok(r?.estaVacio, `«${id}» se calla sin datos y no dice cuándo está vacío`);
  }
});

test('las DOS puertas montan la MISMA ficha con la MISMA lectura', () => {
  const sheet = sinComentarios(leer('app/crm/LeadSheet.tsx'));
  const body = sinComentarios(leer('app/crm/[id]/LeadDetailBody.tsx'));
  const ruta = sinComentarios(leer('app/crm/[id]/page.tsx'));
  for (const [cual, f] of [['el pop-up', sheet], ['la ruta', body]] as const) {
    assert.equal((f.match(/<FichaPorBloques\b/g) ?? []).length, 1, `${cual}: monta FichaPorBloques una vez`);
    for (const pieza of ['LeadTabs', 'InfoPrincipalCard', 'CalificacionCard', 'RespuestasFormulario', 'NotasCard', 'OrigenCard', 'ComportamientoCard', 'ReunionesCard', 'DealDetailsCard', 'OfertaDelLead', 'AnalystDelLead', 'AuditHistory', 'MotivoCard']) {
      assert.doesNotMatch(f, new RegExp(`<${pieza}\\b`), `${cual}: vuelve a montar <${pieza}> a mano (la ficha es una sola pieza)`);
    }
  }
  assert.match(ruta, /await getLeadFullAction\(idNum\)/, 'la ruta lee con la misma action que el pop-up');
  assert.match(ruta, /<LeadDetailBody data=\{data\}/);
  for (const propio of ['faltantesDeLead', 'estadoDatosDeLead', 'getPagosByLead', 'resumenDelNegocio', '<InfoPrincipalCard', 'tabs={']) {
    assert.ok(!ruta.includes(propio), `la ruta vuelve a armar por su cuenta: ${propio}`);
  }
  // «N sin marcar» se cuenta UNA vez, con el plan como booleano y la grabación del encuentro.
  const acc = sinComentarios(leer('app/crm/actions.ts'));
  const ini = acc.indexOf('export async function getLeadFullAction');
  const cuerpo = acc.slice(ini, acc.indexOf('\nexport ', ini + 10));
  assert.match(cuerpo, /const extraReq = \{[^}]*grabable \}/);
  assert.match(cuerpo, /faltantesDeLead\(lead, pagos\.length > 0, extraReq\)/);
  assert.match(cuerpo, /if \(!sesion\) return null;/, 'sin sesión no se lee ningún lead (caería al ws1)');
});

test('no vuelven el modal del Resumen ni el de los avisos a la ficha', () => {
  assert.equal(existsSync(resolve(RAIZ, 'app/crm/lead-view/ResumenModal.tsx')), false, 'ResumenModal se fue: el Resumen se arma en «Personalizar»');
  assert.equal(existsSync(resolve(RAIZ, 'app/crm/resumen-actions.ts')), false, 'sus acciones quedaron sin uso y se fueron con él');
  const archivos = execFileSync('git', ['ls-files', 'app', 'components'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => /\.tsx?$/.test(f) && existsSync(resolve(RAIZ, f)));
  assert.ok(archivos.length > 100, `git ls-files devolvió ${archivos.length} archivos: esto no corrió en el repo`);
  const montan = (modal: string) => archivos.filter((f) => !f.endsWith(`/${modal}.tsx`) && new RegExp(`<${modal}\\b|/${modal}'`).test(sinComentarios(leer(f))));
  assert.deepEqual(montan('ResumenModal'), []);
  // ⚠️ La ÚNICA puerta que queda al modal de avisos es el panel «A revisar»: mezcla leads de varios funnels,
  //    así que ahí van los del NEGOCIO, el respaldo de cada funnel (tests/ficha-avisos.test.ts). La ficha
  //    tiene los suyos, los de su funnel, en «Personalizar».
  assert.deepEqual(montan('AvisosDatosModal'), ['app/_components/MakoConfirmGate.tsx']);
  const datos = sinComentarios(leer('app/crm/lead-view/DatosSinMarcarCard.tsx'));
  assert.doesNotMatch(datos, /onConfigurar|nombre="configurar"/, 'volvió el engranaje del desplegable de datos sin marcar');
  const info = sinComentarios(leer('app/crm/lead-view/InfoPrincipalCard.tsx'));
  assert.doesNotMatch(info, /nombre="configurar"|ResumenModal|setConfigurando/, 'volvió el engranaje del Resumen');
});
