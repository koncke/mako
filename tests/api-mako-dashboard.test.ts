// =============================================================================
// El Dashboard por la API de MaKo (lib/api-mako/areas/dashboard.*): lo que tiene que ser cierto SIEMPRE
// =============================================================================
// Decisiones de Martín (11/10/2026): TODO el Dashboard se consume por la API, sobre el informe de la
// persona que se nombre (sin nombrar y con un solo informe guardado, ése; con varios, pide elegir). Y del
// relevo de Automations: en un flujo la persona es OBLIGATORIA, y crear, borrar y restablecer no corren
// en un flujo.
//
// Lo que se EJECUTA (dashboard.helpers.ts es puro, a propósito): la resolución de la persona, la búsqueda
// de hojas y componentes, el período, la validación de un gráfico (que NUNCA corrige en silencio), el
// cambio que se aplica a un informe, la privacidad por HTTP, el CSV y el texto del AI Analyst. Lo que se
// LEE del fuente (sin comentarios, CRLF normalizado): que el runner no deje correr en un flujo lo que no
// va, que lea con las funciones de la pantalla, y que escriba con compare-and-set.
//
// Probado rompiéndolo (11/10/2026), una rotura por vez y restaurando de memoria, base 24 pass / 0 fail:
//   1. `elegirPersona` sin el chequeo de `enFlujo` (cae al «único informe»)            → 23 / 1
//   2. un closer sin informe aceptado como persona                                     → 23 / 1
//   3. `etiquetaPersona` con el nombre también por HTTP                                → 23 / 1
//   4. `armarGrafico` sin el rechazo de una métrica que no sirve (deja que sanee)      → 23 / 1
//   5. `filtrosDeConsulta` sin el corte de HTTP sobre una dimensión con personas       → 23 / 1
//   6. `resultadoPara` sin `sinPersonas` por HTTP                                      → 23 / 1
//   7. `aplicarCambio` borrando la última hoja                                         → 23 / 1
//   8. `guardarTableroSi` sin comparar la versión (lib/graficos-tablero.ts)            → 23 / 1
//   9. `crear_hoja_dashboard` sin `noEnFlujo`                                          → 23 / 1
//  10. `textoDeAnalisis` con todos los hallazgos                                       → 23 / 1
//  11. `leer_hoja_dashboard` leyendo los bloques también por HTTP                      → 23 / 1
//  12. `armarElemento` sin mirar TIPOS_ELEMENTO (acepta un tipo inventado)             → 23 / 1
// Y con base 25 / 0:
//  13. `armarElemento` sin `videoDe`/`insertableDe` (un sitio cualquiera como Video)    → 24 / 1
//  14. `urlParaCanal` sin redactar la grabación de Fathom por HTTP                    → 24 / 1
// (La 11 miraba los bloques de antes de v5: hoy la fija la rotura 16.)
//
// v5 (12/10/2026), con base 35 / 0, una rotura por vez con el arnés del paquete P9 (restaura de memoria y
// compara byte a byte, nunca git); medido dos veces, la segunda sobre el árbol de la ola 3. CADA UNA → 34 / 1:
//  15. `periodoPedido` cortando un rango a medida en hoy · 15b. la consulta mostrando el período sin cortar
//  16. la def con un parámetro `bloque` · 16b. insertar_elemento nombrando el rectángulo
//  17. `controlesDeFiltros` sin `fijo: true` · 17b. `conFiltrosFijos` dejando los fijos de antes
//      · 17c. por HTTP, guardar un filtro sobre un campo de personas
//  18. `armarGrafico` descartando el período pedido (el bug de antes) · 18b. el período naciendo a la vista
//  19. `armarGrafico` sin escribir `mako`
//  20. `armarElemento` aceptando la ficha · 20b. sin el tope de cajas al armar · 20c. una acción de llamada en
//      un botón de la hoja · 20d. sin el tope de cajas al aplicar
//  21. quitar un componente dejando sus conectores · 21b. duplicar sin seguir los conectores · 21c. ni lo que
//      lee la caja · 21d. «ya están unidos» sin `yaEstaba`
//  22. las columnas extra de una tabla saliendo con nombres por HTTP
//  23. la hoja en palabras sin «Lo define»
//  24. leer la caja de un pop-up · 24b. `cajasDeHoja` viendo las de un pop-up · 24c. los nombres reales por
//      HTTP · 24d. generar con lo abierto (`ref`)
//  25. un filtro de la hoja dejando elegido un nombre por HTTP · 25b. el runner sin avisar que es HTTP
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGISTRO } from '../lib/api-mako/registro';
import { RUTAS_REST } from '../lib/api-mako/rest';
import {
  ERROR_PERSONA_EN_FLUJO, aplicarCambio, armarConector, armarControlHoja, armarElemento, armarGrafico, buscarCajas, buscarComponente,
  buscarConector, buscarHoja, catalogoJson, catalogoMarkdown, conFiltrosFijos, controlParaHttp, controlesDeFiltros, copiaDeHoja,
  elegirPersona, etiquetaPersona, filtrosDeConsulta, filtrosFijosDe, hojaMarkdown, juntarTotales, periodoDeGrafico, periodoPedido,
  periodoGuardado, recortar, resultadoMarkdown, resultadoPara, textoDeAnalisis, urlParaCanal, type MiembroCuenta, type PersonaInforme,
} from '../lib/api-mako/areas/dashboard.helpers';
import { MAX_IA_POR_HOJA, fuenteDe, sanearGrafico, sanearHoja, TIPOS_ELEMENTO, type Elemento, type Grafico, type Hoja, type Tablero } from '../lib/graficos-catalogo';
import { tableroInicial } from '../lib/graficos-plantillas';
import { Alias } from '../lib/graficos-analisis';
import type { Resultado } from '../lib/graficos-agregar';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RUN = sinComentarios(leer('lib/api-mako/areas/dashboard.run.ts'));
/** El cuerpo de UN runner: desde su id hasta el id del siguiente runner (o el final). */
function runner(id: string): string {
  const i = RUN.indexOf(`\n  ${id}: {`);
  assert.ok(i > 0, `no encontré el runner ${id}`);
  const resto = RUN.slice(i + 4);
  const j = resto.search(/\n {2}[a-z_]+: \{/);
  return j > 0 ? resto.slice(0, j) : resto;
}

const ANA: PersonaInforme = { sub: '11', email: 'ana@negocio.com', nombre: 'Ana Pérez' };
const LUIS: PersonaInforme = { sub: '12', email: 'luis@negocio.com', nombre: 'Luis Gómez' };
const admin = (p: PersonaInforme): MiembroCuenta => ({ ...p, rol: 'admin' });
const CLOSER: MiembroCuenta = { sub: '13', email: 'carla@negocio.com', nombre: 'Carla Ruiz', rol: 'closer' };
const base = { sinPersonaVaElInicial: false, enFlujo: false };

// ── La persona ───────────────────────────────────────────────────────────────────────────────

test('la persona: nombrada por email o por nombre, sin acentos ni mayúsculas', () => {
  const e = elegirPersona({ ...base, informes: [ANA, LUIS], miembros: [admin(ANA)], pedido: ' ANA@negocio.com ' });
  assert.ok(e.ok && e.persona?.sub === '11' && e.guardado && e.como === 'nombrada');
  const n = elegirPersona({ ...base, informes: [ANA, LUIS], miembros: [], pedido: 'luis gomez' });
  assert.ok(n.ok && n.persona?.sub === '12');
  const nadie = elegirPersona({ ...base, informes: [ANA], miembros: [], pedido: 'otra@x.com' });
  assert.ok(!nadie.ok && nadie.disponibles.includes('ana@negocio.com'), 'no la encuentra y dice quiénes hay');
  const dos = elegirPersona({ ...base, informes: [ANA, { ...LUIS, nombre: 'Ana Pérez' }], miembros: [], pedido: 'Ana Pérez' });
  assert.ok(!dos.ok && /2 personas/.test(dos.error), 'dos con el mismo nombre: se pide el email');
});

test('sin nombrar: el único informe; con varios, pide elegir; sin ninguno, el inicial para leer y el único admin para escribir', () => {
  const uno = elegirPersona({ ...base, informes: [ANA], miembros: [admin(ANA), admin(LUIS)] });
  assert.ok(uno.ok && uno.persona?.sub === '11' && uno.como === 'unico_informe');
  const varios = elegirPersona({ ...base, informes: [ANA, LUIS], miembros: [] });
  assert.ok(!varios.ok && /2 informes/.test(varios.error) && varios.disponibles.length === 2);
  const leer = elegirPersona({ ...base, sinPersonaVaElInicial: true, informes: [], miembros: [admin(ANA), admin(LUIS)] });
  assert.ok(leer.ok && leer.persona === null && leer.como === 'inicial');
  const escribir = elegirPersona({ ...base, informes: [], miembros: [admin(ANA), CLOSER] });
  assert.ok(escribir.ok && escribir.persona?.sub === '11' && escribir.como === 'unico_admin' && !escribir.guardado, 'el closer no cuenta como admin');
  const dosAdmins = elegirPersona({ ...base, informes: [], miembros: [admin(ANA), admin(LUIS)] });
  assert.ok(!dosAdmins.ok && /2 admins/.test(dosAdmins.error));
  const sinAdmins = elegirPersona({ ...base, informes: [], miembros: [] });
  assert.ok(!sinAdmins.ok);
});

// Rotura 1.
test('⚠️ EN UNA AUTOMATIZACIÓN la persona es OBLIGATORIA: nunca «el único informe»', () => {
  const e = elegirPersona({ informes: [ANA], miembros: [admin(ANA)], sinPersonaVaElInicial: true, enFlujo: true });
  assert.ok(!e.ok, 'con un solo informe guardado igual se pide: el día que otro guarde uno, el paso fallaría');
  assert.equal(e.error, ERROR_PERSONA_EN_FLUJO);
  assert.match(ERROR_PERSONA_EN_FLUJO, /^En una automatización elige la persona del informe/);
  const nombrada = elegirPersona({ informes: [ANA], miembros: [], pedido: 'ana@negocio.com', sinPersonaVaElInicial: false, enFlujo: true });
  assert.ok(nombrada.ok, 'nombrada, corre igual en un flujo');
});

// Rotura 2.
test('un closer o un setter no tienen informe propio (su Dashboard es la hoja Closing)', () => {
  const e = elegirPersona({ ...base, informes: [ANA], miembros: [admin(ANA), CLOSER], pedido: 'carla@negocio.com' });
  assert.ok(!e.ok && /closer/.test(e.error));
  const conInforme = elegirPersona({ ...base, informes: [ANA, CLOSER], miembros: [admin(ANA), CLOSER], pedido: 'carla@negocio.com' });
  assert.ok(conInforme.ok, 'si guardó uno (cuando era admin), se puede leer');
});

// Rotura 3.
test('por HTTP no se escribe el nombre ni el email de quien el que llama no nombró', () => {
  const unico = elegirPersona({ ...base, informes: [ANA], miembros: [] });
  assert.ok(unico.ok);
  assert.doesNotMatch(etiquetaPersona(unico, true), /Ana|ana@/);
  assert.match(etiquetaPersona(unico, false), /Ana Pérez \(ana@negocio\.com\)/);
  const admin1 = elegirPersona({ ...base, informes: [], miembros: [admin(ANA)] });
  assert.ok(admin1.ok);
  assert.doesNotMatch(etiquetaPersona(admin1, true), /Ana|ana@/);
  assert.match(etiquetaPersona(admin1, true), /parte del inicial/);
});

// ── Hojas, componentes y período ─────────────────────────────────────────────────────────────

test('la hoja: por id, por nombre sin acentos, y si no está, las que hay', () => {
  const t = tableroInicial();
  const porId = buscarHoja(t, 'comercial');
  assert.ok(porId.ok && porId.valor.nombre === 'Comercial');
  const porNombre = buscarHoja(t, 'MARKETING');
  assert.ok(porNombre.ok && porNombre.valor.id === 'marketing');
  const no = buscarHoja(t, 'Ventas');
  assert.ok(!no.ok && no.disponibles.some((d) => d.startsWith('marketing')));
  const repetidas: Tablero = { ...t, hojas: [t.hojas[0], { ...t.hojas[1], nombre: 'Marketing', id: 'otra' }] };
  const amb = buscarHoja(repetidas, 'marketing ');
  assert.ok(amb.ok && amb.valor.id === 'marketing', 'el id exacto gana');
  const amb2 = buscarHoja(repetidas, 'Marketing');
  assert.ok(!amb2.ok && amb2.disponibles.length === 2, 'por nombre y hay dos: se pide el id');
});

test('el componente: por id o por título', () => {
  const h = tableroInicial().hojas[0];
  const c = buscarComponente(h, 'mk-cac');
  assert.ok(c.ok && c.valor.id === 'mk-cac');
  const t = buscarComponente(h, 'cac real');
  assert.ok(t.ok && t.valor.id === 'mk-cac');
  const no = buscarComponente(h, 'nada');
  assert.ok(!no.ok && no.disponibles.length === h.componentes.length);
});

// v5: el período de una lectura va TAL CUAL; el corte en hoy vive en `datosDeGraficos` (una fecha que mira hacia
// adelante, como el vencimiento de una cuota, no se corta). Rotura 15.
test('el período: un preset o desde y hasta, en orden, y SIN cortar en hoy (lo corta la lectura)', () => {
  const hoy = '2026-10-11';
  assert.deepEqual(periodoPedido({}, hoy), { preset: 'ult30', desde: '2026-09-12', hasta: hoy });
  assert.deepEqual(periodoPedido({ periodo: 'este_mes' }, hoy), { preset: 'este_mes', desde: '2026-10-01', hasta: hoy });
  assert.deepEqual(periodoPedido({ periodo: 'este_mes_completo' }, hoy), { preset: 'este_mes_completo', desde: '2026-10-01', hasta: '2026-10-31' }, 'lo que vence en el mes, entero');
  assert.deepEqual(periodoPedido({ desde: '2026-10-01', hasta: '2026-12-31' }, hoy), { preset: 'personalizado', desde: '2026-10-01', hasta: '2026-12-31' });
  const medio = periodoPedido({ desde: '2026-10-01' }, hoy);
  assert.ok('error' in medio);
  const reves = periodoPedido({ desde: '2026-10-05', hasta: '2026-10-01' }, hoy);
  assert.ok('error' in reves && /al revés/.test(reves.error));
  const inventado = periodoPedido({ periodo: 'ult45' }, hoy);
  assert.ok('error' in inventado && Array.isArray(inventado.disponibles) && (inventado.disponibles as string[]).includes('ult30'));
  assert.deepEqual(periodoGuardado({}), { periodo: 'auto', desde: null, hasta: null });
});

// ── Un gráfico: nunca se corrige en silencio ─────────────────────────────────────────────────

// Rotura 4.
test('⚠️ UN GRÁFICO PEDIDO NO SE CORRIGE EN SILENCIO: lo que no sirve se rechaza con los disponibles', () => {
  const ok = armarGrafico({ tipo: 'barras', conjunto: 'leads', metricas: ['leads', 'cierres'], dimension: 'etapa' }, null, { x: 0, y: 9 });
  assert.ok(ok.ok && ok.grafico.tipo === 'barras' && ok.grafico.dimension === 'etapa' && ok.grafico.metricas.join() === 'leads,cierres' && ok.grafico.y === 9);
  const tipo = armarGrafico({ tipo: 'radar', conjunto: 'leads', metricas: ['leads'], dimension: 'etapa' }, null);
  assert.ok(!tipo.ok && Array.isArray(tipo.disponibles), 'sanearGrafico lo pasaría a «barras»');
  const conjunto = armarGrafico({ tipo: 'barras', conjunto: 'ventas', metricas: ['leads'], dimension: 'etapa' }, null);
  assert.ok(!conjunto.ok && (conjunto.disponibles as string[]).includes('leads'));
  const metrica = armarGrafico({ tipo: 'barras', conjunto: 'leads', metricas: ['gasto'], dimension: 'etapa' }, null);
  assert.ok(!metrica.ok && (metrica.disponibles as string[]).includes('leads'), 'sanearGrafico pondría la primera del conjunto');
  const razonEnTorta = armarGrafico({ tipo: 'circular', conjunto: 'leads', metricas: ['tasa_cierre'], dimension: 'etapa' }, null);
  assert.ok(!razonEnTorta.ok && /se suman/.test(razonEnTorta.error));
  const sinDim = armarGrafico({ tipo: 'barras', conjunto: 'leads', metricas: ['leads'] }, null);
  assert.ok(!sinDim.ok && /lleva una dimensión/.test(sinDim.error), 'sanearGrafico elegiría una por su cuenta');
  const dimMala = armarGrafico({ tipo: 'serie', conjunto: 'leads', metricas: ['leads'], dimension: 'etapa' }, null);
  assert.ok(!dimMala.ok && (dimMala.disponibles as string[]).includes('dia'), 'una serie va por tiempo');
  const kpi = armarGrafico({ tipo: 'numero', conjunto: 'negocio', metricas: ['cac'], dimension: 'mes' }, null);
  assert.ok(!kpi.ok && /no lleva dimensión/.test(kpi.error));
});

test('editar un gráfico conserva lo no pedido y DICE lo que tuvo que sacar', () => {
  const g = sanearGrafico({ id: 'g1', tipo: 'tabla', fuente: 'leads', dimension: 'etapa', metricas: ['leads', 'tasa_cierre'], titulo: 'Leads', x: 0, y: 0 })!;
  const a = armarGrafico({ tipo: 'circular' }, g);
  assert.ok(a.ok, 'la razón sale y la tabla pasa a torta');
  assert.deepEqual(a.grafico.metricas, ['leads']);
  assert.ok(a.notas.some((n) => /tasa_cierre/.test(n)));
  assert.equal(a.grafico.id, 'g1');
  assert.equal(a.grafico.titulo, 'Leads');
  const cambio = armarGrafico({ conjunto: 'pagos' }, g);
  assert.ok(!cambio.ok && /di sus métricas/.test(cambio.error), 'cambiar de conjunto sin métricas no deja las del otro');
});

// ── El cambio de un informe ──────────────────────────────────────────────────────────────────

// Rotura 7.
test('el cambio: crear, duplicar con ids nuevos, borrar (nunca la última), editar «ya está así»', () => {
  const t = tableroInicial();
  const copia = copiaDeHoja(t.hojas[0]);
  assert.notEqual(copia.id, t.hojas[0].id);
  assert.ok(copia.componentes.every((c, i) => c.id !== t.hojas[0].componentes[i].id), 'todo lo que tiene id se acuña de nuevo');
  const dup = aplicarCambio(t, { op: 'duplicar_hoja', hojaId: 'marketing', copia });
  assert.ok(dup.ok && dup.tablero.hojas[1].id === copia.id, 'al lado de la original');
  const sola: Tablero = { ...t, hojas: [t.hojas[0]] };
  const ultima = aplicarCambio(sola, { op: 'borrar_hoja', hojaId: 'marketing' });
  assert.ok(!ultima.ok && /única hoja/.test(ultima.error));
  const borrar = aplicarCambio(t, { op: 'borrar_hoja', hojaId: 'comercial' });
  assert.ok(borrar.ok && borrar.tablero.hojas.length === 1);
  const igual = aplicarCambio(t, { op: 'editar_hoja', hojaId: 'marketing', nombre: 'Marketing' });
  assert.ok(!igual.ok && igual.yaEstaba === true, 'lo que ya está así no se propone');
  const mover = aplicarCambio(t, { op: 'editar_hoja', hojaId: 'comercial', posicion: 1 });
  assert.ok(mover.ok && mover.tablero.hojas[0].id === 'comercial');
  const ini = aplicarCambio(t, { op: 'restablecer' });
  assert.ok(!ini.ok && ini.yaEstaba, 'el inicial ya es el inicial');
  const fuera = aplicarCambio(t, { op: 'quitar_componente', hojaId: 'nada', componenteId: 'x' });
  assert.ok(!fuera.ok);
});

test('el cambio: agregar arriba corre lo demás; reemplazar igual es «ya está así»; filtros uno por cosa', () => {
  const t = tableroInicial();
  const g = armarGrafico({ tipo: 'numero', conjunto: 'leads', metricas: ['leads'] }, null);
  assert.ok(g.ok);
  const arriba = aplicarCambio(t, { op: 'agregar_componente', hojaId: 'marketing', componente: g.grafico, lugar: 'arriba' });
  assert.ok(arriba.ok);
  const h = arriba.tablero.hojas[0];
  assert.equal(h.componentes[0].y, 0);
  assert.ok(h.componentes.slice(1).every((c) => c.y >= g.grafico.h), 'lo de antes bajó');
  const mismo = aplicarCambio(t, { op: 'reemplazar_componente', hojaId: 'marketing', componente: t.hojas[0].componentes[0] });
  assert.ok(!mismo.ok && mismo.yaEstaba);
  const otroPeriodo = armarControlHoja(t.hojas[0], { tipo: 'periodo', periodo: 'ult90' });
  assert.ok(!otroPeriodo.ok && /uno por cosa/.test(otroPeriodo.error), 'la hoja ya tiene uno de período');
  const lista = armarControlHoja(t.hojas[0], { tipo: 'lista', campo: 'campana', valores: ['Verano'] });
  assert.ok(lista.ok && lista.control.campo === 'campana' && lista.control.valores?.[0] === 'Verano');
  const inventado = armarControlHoja(t.hojas[0], { tipo: 'lista', campo: 'zzz' });
  assert.ok(!inventado.ok && Array.isArray(inventado.disponibles));
});

// ── La privacidad por HTTP ───────────────────────────────────────────────────────────────────

// Rotura 5.
test('⚠️ POR HTTP no se filtra por una dimensión con nombres de personas', () => {
  const leads = fuenteDe('leads')!;
  const http = filtrosDeConsulta(leads, [{ campo: 'closer', valores: ['Juan'] }], true);
  assert.ok(!http.ok && /personas/.test(http.error), 'filtrar por un nombre y mirar si da cero es preguntar si existe');
  const app = filtrosDeConsulta(leads, [{ campo: 'closer', valores: ['Juan'] }], false);
  assert.ok(app.ok && app.filtros[0].dimension === 'closer');
  const publico = filtrosDeConsulta(leads, [{ campo: 'campana', valores: ['Verano'] }], true);
  assert.ok(publico.ok);
  const nada = filtrosDeConsulta(leads, [{ campo: 'etapa' }], false);
  assert.ok(!nada.ok, 'un filtro sin valores ni texto no es un filtro');
});

// Rotura 6.
test('⚠️ POR HTTP las etiquetas de personas salen como alias; por WhatsApp y la app, tal cual', () => {
  const g = sanearGrafico({ id: 'g', tipo: 'tabla', fuente: 'leads', dimension: 'closer', metricas: ['leads'] })!;
  const r: Resultado = { columnas: [{ id: 'leads', nombre: 'Leads', formato: 'numero' }], filas: [{ clave: 'Juan Pérez', etiqueta: 'Juan Pérez', valores: [3] }], totales: [3], fuera: 0, clase: 'categoria' };
  const http = resultadoPara(g, r, true, new Alias());
  assert.equal(http.filas[0].etiqueta, 'Closer 1');
  assert.doesNotMatch(JSON.stringify(http), /Juan/);
  assert.equal(resultadoPara(g, r, false, new Alias()).filas[0].etiqueta, 'Juan Pérez');
  const ctl = controlParaHttp({ id: 'c', tipo: 'lista', campo: 'closer', preset: 'ult30', desde: null, hasta: null, valores: ['Juan Pérez'], texto: '', agrupar: 'auto' }, new Alias());
  assert.doesNotMatch(JSON.stringify(ctl), /Juan/);
});

test('las lecturas con personas no salen por HTTP, y todo pide la tab del Dashboard y el rol admin', () => {
  const del = REGISTRO.filter((d) => d.id.endsWith('_dashboard'));
  assert.equal(del.length, 25, `son ${del.length}`);
  for (const id of ['listar_informes_dashboard', 'ver_detalle_numero_dashboard', 'listar_valores_campo_dashboard']) {
    assert.ok(!REGISTRO.find((d) => d.id === id)!.canales.includes('http'), `${id} trae nombres de personas y sale por HTTP`);
  }
  for (const d of del) {
    assert.equal(d.area, 'metricas');
    assert.deepEqual(d.gating, { tab: 'graphics', rolMinimo: 'admin' }, `${d.id}: la tab Dashboard es del admin`);
    if (d.tipo === 'accion') assert.equal(d.confirmacion, 'chat', `${d.id}: se confirma con un «sí»`);
    for (const p of d.parametros) assert.ok(!p.enum || !['conjunto', 'tipo', 'periodo', 'plantilla', 'tema', 'bloque', 'agrupar', 'tamano', 'campo', 'unidad'].includes(p.nombre), `${d.id}.${p.nombre}: el catálogo como enum ata la referencia`);
  }
  // Los nombres de los parámetros son contrato (el editor de Automations arma selectores por nombre).
  const nombres = new Set(del.flatMap((d) => d.parametros.map((p) => p.nombre)));
  for (const n of ['persona', 'hoja', 'componente', 'conjunto', 'metricas', 'dimension', 'periodo']) assert.ok(nombres.has(n), `falta el parámetro ${n}`);
  for (const n of ['hojaId', 'fuente', 'componenteId', 'email', 'metrics', 'dimensiones']) assert.ok(!nombres.has(n), `«${n}» no es uno de los nombres fijos`);
  for (const d of del.filter((x) => x.canales.includes('http'))) assert.ok(RUTAS_REST.some(([, , op]) => op === d.id), `${d.id} sin ruta REST`);
});

// ── El AI Analyst ────────────────────────────────────────────────────────────────────────────

// Rotura 10.
test('el texto corto del AI Analyst: resumen, hasta tres hallazgos y el link', () => {
  const h = (n: number) => ({ titulo: `Hallazgo ${n}`, texto: `texto ${n}`, tono: 'neutro' as const, cita: { grafico: 'g', titulo: 't', columna: 'c', nombre: 'n', fila: null, valor: n, formato: 'numero' as const } });
  const t = textoDeAnalisis({ resumen: 'Todo sube.', hallazgos: [h(1), h(2), h(3), h(4)] }, 'Marketing', 'https://x/dashboard?hoja=marketing');
  assert.match(t, /^AI Analyst · Marketing\nTodo sube\./);
  assert.match(t, /Hallazgo 3/);
  assert.doesNotMatch(t, /Hallazgo 4/);
  assert.ok(t.endsWith('https://x/dashboard?hoja=marketing'));
  assert.ok(!/\n\n/.test(textoDeAnalisis({ resumen: 'x', hallazgos: [] }, 'H', '')), 'sin hallazgos ni link no deja renglones vacíos');
});

// ── Lo que sale ──────────────────────────────────────────────────────────────────────────────

test('el markdown de un resultado: la tabla con su unidad, el total y lo que no entra, dicho', () => {
  const g = sanearGrafico({ id: 'g', tipo: 'tabla', fuente: 'negocio', dimension: 'mes', metricas: ['gasto', 'cierres'] })!;
  const r: Resultado = {
    columnas: [{ id: 'gasto', nombre: 'Gasto en anuncios', formato: 'usd' }, { id: 'cierres', nombre: 'Cierres', formato: 'numero' }],
    filas: [{ clave: '2026-09', etiqueta: 'sep 2026', valores: [1200, 3] }, { clave: '2026-10', etiqueta: 'oct | 2026', valores: [800, null] }],
    totales: [2000, 3], fuera: 0, clase: 'tiempo',
  };
  const md = resultadoMarkdown(g, r, { desde: '2026-09-01', hasta: '2026-10-11', topeFilas: 1 }).join('\n');
  assert.match(md, /Gasto en anuncios \(US\$\)/);
  assert.match(md, /\| Mes \|/);
  assert.match(md, /\(y 1 filas más\)/, 'un recorte callado se lee como un total');
  assert.match(md, /Total: /);
  const tot = juntarTotales([
    { columnas: [{ id: 'a', nombre: 'A', formato: 'numero' }], filas: [], totales: [1], fuera: 0, clase: null },
    { columnas: [{ id: 'b', nombre: 'B', formato: 'usd' }], filas: [], totales: [2], fuera: 0, clase: null, anterior: [1] },
  ]);
  assert.deepEqual(tot.totales, [1, 2]);
  assert.deepEqual(tot.anterior, [null, 1]);
  assert.match(recortar('a\n'.repeat(50), 20), /Recortado/);
});

test('el catálogo: los ids que piden las otras operaciones, y un conjunto inventado dice los que hay', () => {
  const md = catalogoMarkdown({});
  assert.ok(typeof md === 'string' && md.includes('`leads`') && md.includes('`barras`') && md.includes('`revenue`'));
  const no = catalogoMarkdown({ conjunto: 'ventas' });
  assert.ok(typeof no !== 'string' && Array.isArray(no.disponibles));
  const j = catalogoJson({ seccion: 'elementos' }) as { elementos: Array<{ id: string }> };
  assert.deepEqual(j.elementos.map((e) => e.id), TIPOS_ELEMENTO.map((e) => e.id), 'los elementos VIGENTES del catálogo');
});

// Rotura 12.
test('un elemento se valida contra los tipos VIGENTES, y una dirección sólo https', () => {
  const inventado = armarElemento({ tipo: 'holograma' }, 0);
  assert.ok(!inventado.ok && (inventado.disponibles as string[]).includes('texto'));
  const texto = armarElemento({ tipo: 'texto', texto: 'Ventas de octubre' }, 3);
  assert.ok(texto.ok && texto.elemento.y === 3);
  const sinTexto = armarElemento({ tipo: 'texto' }, 0);
  assert.ok(!sinTexto.ok);
  const http = armarElemento({ tipo: 'imagen', url: 'http://x.com/a.png' }, 0);
  assert.ok(!http.ok && /https/.test(http.error) && http.error.includes('http://x.com/a.png'), 'la dirección se muestra entera');
  const sinUrl = armarElemento({ tipo: 'imagen' }, 0);
  assert.ok(!sinUrl.ok);
  const img = armarElemento({ tipo: 'imagen', url: 'https://x.com/a.png' }, 0);
  assert.ok(img.ok);
});

// Roturas 13 y 14.
test('un Video y un Insertar se miden como en la pantalla, y una grabación no sale por HTTP', () => {
  const yt = armarElemento({ tipo: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, 0);
  assert.ok(yt.ok, 'un video de YouTube entra');
  const cualquiera = armarElemento({ tipo: 'video', url: 'https://ejemplo.com/pagina' }, 0);
  assert.ok(!cualquiera.ok, 'una página cualquiera no es un video: va por Insertar');
  const codigo = armarElemento({ tipo: 'insertado', url: '<iframe src="https://lookerstudio.google.com/embed/reporting/abc"></iframe>' }, 0);
  assert.ok(codigo.ok && (codigo.elemento as { url?: string }).url === 'https://lookerstudio.google.com/embed/reporting/abc', 'del código pegado se guarda el src');
  const fathom = 'https://fathom.video/share/abc123';
  assert.equal(urlParaCanal(fathom, false), fathom, 'por WhatsApp y la app, tal cual');
  assert.ok(!urlParaCanal(fathom, true).includes('fathom.video'), 'por HTTP, la grabación no sale');
  assert.equal(urlParaCanal('https://ejemplo.com', true), 'https://ejemplo.com');
});

// ── Lo que hace el runner (leído del fuente) ─────────────────────────────────────────────────

// Rotura 9.
test('⚠️ crear, borrar y restablecer NO corren en un flujo; la persona se resuelve con el chequeo de flujo', () => {
  for (const id of ['crear_hoja_dashboard', 'borrar_hoja_dashboard', 'restablecer_informe_dashboard']) {
    assert.match(runner(id), /\{ noEnFlujo: '/, `${id} correría una vez por cada lead`);
  }
  for (const id of ['editar_hoja_dashboard', 'agregar_grafico_dashboard', 'analizar_hoja_dashboard']) assert.doesNotMatch(runner(id), /noEnFlujo/);
  assert.match(RUN, /if \(opts\.noEnFlujo && enFlujo\(ctx\)\) return \{ error: noEnFlujo\(opts\.noEnFlujo\) \};/);
  assert.match(RUN, /const enFlujo = \(ctx: Ctx\): boolean => ctx\.canalKey\.startsWith\(PREFIJO_FLUJO\);/);
  assert.match(RUN, /elegirPersona\(\{ informes, miembros, pedido: str\(input, 'persona'\), sinPersonaVaElInicial: modo === 'leer', enFlujo: enFlujo\(ctx\) \}\)/);
});

// Rotura 8 (en lib/graficos-tablero.ts) y la del runner.
test('⚠️ ESCRIBIR ES COMPARE-AND-SET: el runner relee y compara, y el guardado no escribe si cambió', () => {
  const aplicar = RUN.slice(RUN.indexOf('async function aplicar('), RUN.indexOf('function laHoja('));
  assert.match(aplicar, /const actual = await leerTableroVersionado\(sub\);\s*if \(actual\.version !== version\) return \{ ok: false, resumen: TEXTO_CAMBIO \};/);
  assert.match(aplicar, /await guardarTableroSi\(sub, ap\.tablero, version\);\s*if \(!g\.ok\) return \{ ok: false, resumen: TEXTO_CAMBIO \};/);
  assert.doesNotMatch(RUN, /guardarTableroDe\(|setSetting\(|leerTablero\(\)/, 'el runner no usa las de sesión ni escribe a ciegas');
  const tablero = sinComentarios(leer('lib/graficos-tablero.ts'));
  const si = tablero.slice(tablero.indexOf('export async function guardarTableroSi'), tablero.indexOf('export type InformeGuardadoCrudo'));
  assert.match(si, /if \(versionDe\(actual\?\.value \?\? null\) !== version\) return \{ ok: false \};/);
  assert.match(si, /\.eq\('updated_at', actual\.updated_at\)/, 'el candado es la hora de la fila, en la base');
  assert.match(si, /ignoreDuplicates: true/, 'sin fila: dos «sí» a la vez crean UNA');
  assert.doesNotMatch(si, /\.eq\('value'/, 'el informe entero en un filtro viaja en la URL, y el proxy la corta');
  assert.match(tablero, /export async function leerTablero\(\): Promise<LecturaTablero> \{[\s\S]*?return leerTableroDe\(s\.sub\);/, 'las de sesión delegan');
  assert.match(tablero, /export async function guardarTablero\(raw: unknown\): Promise<Tablero> \{[\s\S]*?return guardarTableroDe\(s\.sub, raw\);/);
});

// Rotura 11.
test('⚠️ leer una hoja: las MISMAS lecturas que la pantalla, el CSV del botón Exportar, y sin bloques (v5)', () => {
  const r = runner('leer_hoja_dashboard');
  assert.match(r, /pedidosDeHoja\(hoja, \{\}, hoy, 0\)/, 'los pedidos de la pantalla, con la vista vacía');
  assert.match(r, /datosDeGraficos\(/);
  assert.doesNotMatch(RUN, /datosDeBloques|graficos-bloques|armarBloque|leer_bloque_dashboard/, 'los bloques se fueron: nadie los lee');
  assert.match(r, /csvDeHoja\(\{ hoja, resultados, efectivos, hoy \}\)/, 'el MISMO CSV que el botón Exportar');
  assert.match(r, /resultadoPara\(c, d\.resultado, http, alias\)/);
  assert.match(runner('consultar_datos_dashboard'), /filtrosDeConsulta\(fuente, input\.filtros as EntradaFiltro\[\] \| undefined, http\)/);
});

test('el AI Analyst por la API arranca y corre POR DETRÁS (/api/v1 corta a los 60 s)', () => {
  const r = runner('analizar_hoja_dashboard');
  assert.match(r, /arrancarAMano\(\{/);
  assert.match(r, /porDetras\(ctx\.ws, \(\) => analizarHoja\(r\.pedido\)\)/);
  assert.match(r, /ctx\.canal === 'http' \? PLAZO_ANALISIS_HTTP_MS : PLAZO_ANALISIS_MS/);
  assert.match(RUN, /try \{ after\(envuelto\); return 'fondo'; \} catch \{ await envuelto\(\); return 'en_linea'; \}/);
  assert.match(runner('leer_analisis_dashboard'), /r\.http \? vista\.ultimo\.salida : salidaConNombres\(/, 'los nombres reales no salen por HTTP');
});

test('una URL que pasó por un modelo se muestra ENTERA en lo que la persona confirma', () => {
  assert.match(runner('insertar_elemento_dashboard'), /con la dirección \$\{url\}/);
});

// ── v5 (12/10/2026): sin bloques, filtros de definición, el período como control, lo nuevo de una hoja ─────────

const hojaDe = (componentes: unknown[], extra: Record<string, unknown> = {}): Hoja => sanearHoja({ id: 'h', nombre: 'H', componentes, ...extra }, 0)!;

// Rotura 16.
test('v5: sin bloques en la API — ni la operación, ni el parámetro, ni la sección del catálogo, ni las formas', () => {
  const del = REGISTRO.filter((d) => d.id.endsWith('_dashboard'));
  assert.ok(!del.some((d) => d.id === 'leer_bloque_dashboard'), 'leer_bloque_dashboard se fue');
  for (const d of del) {
    assert.ok(!d.parametros.some((p) => p.nombre === 'bloque'), `${d.id} todavía acepta un bloque`);
    const dice = [d.titulo, d.descripcion, ...d.parametros.map((p) => `${p.descripcion} ${(p.enum ?? []).join(' ')}`)].join(' ');
    assert.doesNotMatch(dice, /\bbloques?\b|rect[aá]ngulo|c[ií]rculo/i, `${d.id} nombra lo que ya no existe`);
  }
  const md = catalogoMarkdown({});
  assert.ok(typeof md === 'string' && !/Bloques armados/.test(md));
  assert.ok(!('bloques' in (catalogoJson({}) as Record<string, unknown>)));
});

// Rotura 17.
test('v5: los filtros que se GUARDAN en un gráfico son de DEFINICIÓN (fijo); reemplazarlos deja los de mirar; por HTTP no sobre personas', () => {
  const leads = fuenteDe('leads')!;
  const cf = controlesDeFiltros(leads, [{ campo: 'etapa', valores: ['Ganado'] }, { campo: 'campana', texto: 'Verano' }]);
  assert.ok(cf.ok);
  assert.ok(cf.controles.every((k) => k.fijo === true), 'nacían como chips de la tarjeta (el punto 1 del pedido v5)');
  assert.deepEqual(cf.controles.map((k) => k.tipo), ['lista', 'texto']);
  const http = controlesDeFiltros(leads, [{ campo: 'closer', valores: ['Juan'] }], true);
  assert.ok(!http.ok && /personas/.test(http.error), 'guardado en el informe es el mismo oráculo que en una consulta');
  assert.ok(controlesDeFiltros(leads, [{ campo: 'closer', valores: ['Juan'] }], false).ok, 'por WhatsApp y la app, sí');
  assert.ok(!controlesDeFiltros(leads, [{ campo: 'etapa', valores: ['A'] }, { campo: 'leads.etapa', valores: ['B'] }]).ok, 'uno por campo');
  // Reemplazar: se van los fijos de antes; quedan el período y los de mirar, salvo el del mismo campo (manda el que define).
  const g = sanearGrafico({
    id: 'g1', tipo: 'tabla', fuente: 'leads', dimension: 'etapa', metricas: ['leads'], periodo: 'ult90',
    controles: [{ id: 'k1', tipo: 'lista', campo: 'campana' }, { id: 'k2', tipo: 'lista', campo: 'leads.origen', fijo: true, valores: ['Meta'] }, { id: 'k3', tipo: 'texto', campo: 'leads.etapa' }],
  })!;
  const nuevos = controlesDeFiltros(leads, [{ campo: 'campana', valores: ['Verano'] }]);
  assert.ok(nuevos.ok);
  const cc = conFiltrosFijos(g.controles, nuevos.controles);
  assert.ok(cc.ok);
  assert.deepEqual(cc.controles.map((k) => `${k.tipo}:${k.campo ?? ''}:${k.fijo ? 'fijo' : 'mirar'}`), ['periodo::fijo', 'texto:leads.etapa:mirar', 'lista:campana:fijo']);
  assert.deepEqual(filtrosFijosDe({ controles: cc.controles }).map((k) => k.campo), ['campana']);
});

// Rotura 18.
test('v5: el período de un gráfico se escribe como control FIJO (y «auto» lo saca); los nombres de los parámetros no cambian', () => {
  const a = armarGrafico({ tipo: 'tabla', conjunto: 'leads', metricas: ['leads'], dimension: 'etapa', periodo: 'ult90' }, null);
  assert.ok(a.ok);
  const p = a.grafico.controles.filter((k) => k.tipo === 'periodo');
  assert.equal(p.length, 1);
  assert.equal(p[0].fijo, true);
  assert.equal(p[0].preset, 'ult90');
  assert.equal(p[0].id, `${a.grafico.id}-fecha`);
  assert.equal(a.grafico.periodo, 'auto', 'el campo de antes no se usa');
  assert.deepEqual(periodoDeGrafico(a.grafico), { periodo: 'ult90', desde: null, hasta: null, fijo: true });
  // EL caso: un gráfico que ya tiene un control de período. Con el campo de antes, el saneo descartaba el pedido.
  const conVisible = sanearGrafico({ id: 'g2', tipo: 'tabla', fuente: 'leads', dimension: 'etapa', metricas: ['leads'], controles: [{ id: 'p', tipo: 'periodo', preset: 'ult7' }] })!;
  const b = armarGrafico({ desde: '2026-09-01', hasta: '2026-09-30' }, conVisible);
  assert.ok(b.ok);
  assert.deepEqual(periodoDeGrafico(b.grafico), { periodo: 'personalizado', desde: '2026-09-01', hasta: '2026-09-30', fijo: true });
  assert.equal(b.grafico.controles.filter((k) => k.tipo === 'periodo').length, 1);
  const c = armarGrafico({ periodo: 'auto' }, b.grafico);
  assert.ok(c.ok && !c.grafico.controles.some((k) => k.tipo === 'periodo') && periodoDeGrafico(c.grafico).periodo === 'auto', '«auto» = el de la hoja');
  // El editor de Automations arma selectores por NOMBRE: periodo, desde y hasta siguen siendo esos.
  for (const op of ['agregar_grafico_dashboard', 'editar_grafico_dashboard']) {
    const nombres = new Set(REGISTRO.find((d) => d.id === op)!.parametros.map((x) => x.nombre));
    for (const n of ['periodo', 'desde', 'hasta', 'filtros', 'mako']) assert.ok(nombres.has(n), `${op}: ${n}`);
  }
  // Y lo que se MUESTRA de una consulta va cortado como en la pantalla (lo pedido viaja entero a la lectura).
  assert.match(runner('consultar_datos_dashboard'), /const hasta = cortarEnHoyDe\(principal, per\.desde, per\.hasta\);/);
});

// Rotura 19.
// 13/10/2026: se guardan los DOS valores (ausente = lo del tipo, `conMako`), y `pedido_mako` cambia lo que responde.
test('el botón de MaKo se apaga y se prende por gráfico, y se le cambia lo que responde', () => {
  const a = armarGrafico({ tipo: 'numero', conjunto: 'leads', metricas: ['leads'], mako: false }, null);
  assert.ok(a.ok && a.grafico.mako === false);
  const b = armarGrafico({ mako: true }, a.grafico);
  assert.ok(b.ok && b.grafico.mako === true, 'prenderlo es elegirlo: con lo de entrada SIN botón, sacar la marca lo dejaría apagado');
  const p = armarGrafico({ pedidoMako: 'Por qué bajó' }, b.grafico);
  assert.ok(p.ok && p.grafico.makoIA?.pedido === 'Por qué bajó');
  const sin = armarGrafico({ pedidoMako: '' }, p.grafico);
  assert.ok(sin.ok && sin.grafico.makoIA === undefined, 'un pedido vacío vuelve al análisis de siempre');
  const c = armarGrafico({ titulo: 'Leads' }, a.grafico);
  assert.ok(c.ok && c.grafico.mako === false, 'sin pedirlo, como estaba');
});

// Rotura 20.
test('v5: los elementos nuevos — sección, caja de IA con su configuración, acción de la hoja — y la ficha NO', () => {
  const h = hojaDe([
    { id: 'g-a', tipo: 'tabla', fuente: 'leads', dimension: 'etapa', metricas: ['leads'], titulo: 'Por etapa' },
    { id: 'g-b', tipo: 'numero', fuente: 'leads', metricas: ['cierres'], y: 8 },
  ]);
  const s = armarElemento({ tipo: 'seccion', texto: 'Cobranza', plegable: true, abierto: false, fondo: 2 }, 0, h);
  assert.ok(s.ok);
  const sec = s.elemento as Elemento;
  assert.deepEqual(sec.seccion, { fondo: 2, plegable: true, abierto: false });
  assert.deepEqual([sec.x, sec.w], [0, 12], 'una sección va a lo ancho');
  const ia = armarElemento({ tipo: 'ia', texto: 'Qué pasa', pedido: 'Qué etapa frena', componentes: ['Por etapa'], muestra: 'hallazgos', largo: 'corto' }, 0, h);
  assert.ok(ia.ok);
  assert.deepEqual((ia.elemento as Elemento).ia, { pedido: 'Qué etapa frena', fuentes: ['g-a'], vista: 'hallazgos', largo: 'corto', formato: 'parrafo', lee: 'hoja', cron: null });
  const malGrafico = armarElemento({ tipo: 'ia', componentes: ['no-esta'] }, 0, h);
  assert.ok(!malGrafico.ok && (malGrafico.disponibles as string[]).some((x) => x.startsWith('g-a')));
  assert.ok(!armarElemento({ tipo: 'ia', muestra: 'poema' }, 0, h).ok);
  const llena = hojaDe([...h.componentes, ...Array.from({ length: MAX_IA_POR_HOJA }, (_, i) => ({ id: `ia${i}`, clase: 'elemento', tipo: 'ia', ia: {}, y: 20 + i * 8 }))]);
  const quinta = armarElemento({ tipo: 'ia' }, 0, llena);
  assert.ok(!quinta.ok && /máximo/.test(quinta.error), 'el saneo la tiraría sin decir nada');
  const boton = armarElemento({ tipo: 'accion', accion: 'sincronizar_llamadas' }, 0, h);
  assert.ok(boton.ok);
  assert.deepEqual((boton.elemento as Elemento).accion, { id: 'sincronizar_llamadas', rotulo: 'Sincronizar llamadas' });
  const deLlamada = armarElemento({ tipo: 'accion', accion: 'reanalizar_llamada' }, 0, h);
  assert.ok(!deLlamada.ok && (deLlamada.disponibles as string[]).includes('sincronizar_llamadas'), 'una acción de una llamada vive en su pop-up');
  const ficha = armarElemento({ tipo: 'entidad' }, 0, h);
  assert.ok(!ficha.ok && /pop-up/.test(ficha.error));
  for (const viejo of ['rectangulo', 'circulo']) assert.ok(!armarElemento({ tipo: viejo }, 0, h).ok, viejo);
  // Y una quinta caja que llegó en el medio (entre proponer y confirmar) se dice al aplicar.
  const cuarta = armarElemento({ tipo: 'ia' }, 0, h);
  assert.ok(cuarta.ok);
  const ap = aplicarCambio({ v: 3, nombre: 'D', hojas: [llena] }, { op: 'agregar_componente', hojaId: 'h', componente: cuarta.elemento, lugar: 'abajo' });
  assert.ok(!ap.ok && /máximo/.test(ap.error));
});

// Rotura 21.
test('v5: los conectores — unir, «ya están unidos», sacar, y se van con el componente que tocaban; duplicar los sigue', () => {
  const h = hojaDe([
    { id: 'g-a', tipo: 'numero', fuente: 'leads', metricas: ['leads'], titulo: 'Leads' },
    { id: 'g-b', tipo: 'numero', fuente: 'leads', metricas: ['cierres'], titulo: 'Cierres', x: 6 },
  ]);
  const t: Tablero = { v: 3, nombre: 'D', hojas: [h] };
  const a = armarConector(h, { origen: 'Leads', destino: 'g-b', trazo: 'recta' });
  assert.ok(a.ok && a.conector.desde === 'g-a' && a.conector.hasta === 'g-b' && a.conector.trazo === 'recta' && a.conector.punta === 'fin');
  assert.ok(!armarConector(h, { origen: 'g-a', destino: 'g-a' }).ok, 'no a sí mismo');
  assert.ok(!armarConector(h, { origen: 'g-a', destino: 'g-b', punta: 'flecha' }).ok);
  const ap = aplicarCambio(t, { op: 'agregar_conector', hojaId: 'h', conector: a.conector });
  assert.ok(ap.ok && ap.tablero.hojas[0].conectores?.length === 1);
  const h2 = ap.tablero.hojas[0];
  const otra = armarConector(h2, { origen: 'g-b', destino: 'g-a' });
  assert.ok(!otra.ok && otra.yaEstaba, 'el mismo par, en cualquier sentido');
  const b = buscarConector(h2, { origen: 'Cierres', destino: 'Leads' });
  assert.ok(b.ok && b.valor.id === a.conector.id);
  const fuera = aplicarCambio(ap.tablero, { op: 'quitar_conector', hojaId: 'h', conectorId: a.conector.id });
  assert.ok(fuera.ok && !(fuera.tablero.hojas[0].conectores ?? []).length);
  const sinB = aplicarCambio(ap.tablero, { op: 'quitar_componente', hojaId: 'h', componenteId: 'g-b' });
  assert.ok(sinB.ok && !(sinB.tablero.hojas[0].conectores ?? []).length, 'un conector a un componente que no está no queda colgado');
  // Duplicar una hoja: los conectores y lo que lee una caja siguen a los ids NUEVOS.
  const conCaja = hojaDe([...h2.componentes, { id: 'ia1', clase: 'elemento', tipo: 'ia', ia: { fuentes: ['g-a'] }, y: 20 }], { conectores: h2.conectores, plantilla: 'closing' });
  const copia = copiaDeHoja(conCaja);
  const nuevoA = copia.componentes.find((c) => c.clase === 'grafico' && c.titulo === 'Leads')!.id;
  assert.notEqual(nuevoA, 'g-a');
  assert.equal(copia.conectores?.length, 1, 'el saneo los descartaba: apuntaban a ids que no están');
  assert.equal(copia.conectores![0].desde, nuevoA);
  assert.deepEqual((copia.componentes.find((c) => c.clase === 'elemento') as Elemento).ia?.fuentes, [nuevoA], 'la caja se quedaba leyendo nada');
  assert.equal(copia.plantilla, undefined, 'la copia no es la hoja de la plantilla');
});

// Rotura 22.
test('v5: por HTTP tampoco nombran personas las COLUMNAS EXTRA de una tabla, y una fila-persona va sin su miniatura', () => {
  const g = sanearGrafico({ id: 'g', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'llamada', metricas: ['llamadas'], tabla: { columnas: ['closer', 'reunion'] } })!;
  const r: Resultado = {
    columnas: [{ id: 'llamadas', nombre: 'Llamadas', formato: 'numero' }], totales: [1], fuera: 0, clase: 'categoria',
    filas: [{ clave: 'Llamada con Ana', etiqueta: 'Llamada con Ana', valores: [1], extra: { closer: 'Juan Pérez', reunion: 'R1' }, imagen: 'https://x.com/a.png' }],
  };
  const http = resultadoPara(g, r, true, new Alias());
  assert.doesNotMatch(JSON.stringify(http), /Juan|Ana|a\.png/);
  assert.equal(http.filas[0].extra?.reunion, 'R1', 'una columna pública va tal cual');
  assert.equal(resultadoPara(g, r, false, new Alias()), r, 'por WhatsApp y la app, tal cual');
  // Las tarjetas de un guion (público) sí llevan su miniatura.
  const t = sanearGrafico({ id: 't', tipo: 'tarjetas', fuente: 'guiones', dimension: 'guion', metricas: [] })!;
  const rt: Resultado = { ...r, filas: [{ clave: 'Hook 1', etiqueta: 'Hook 1', valores: [1], imagen: 'https://x.com/b.png' }] };
  assert.equal(resultadoPara(t, rt, true, new Alias()).filas[0].imagen, 'https://x.com/b.png');
});

// Rotura 23.
test('v5: la hoja en palabras dice lo nuevo — lo que define un gráfico, el botón de MaKo, el pop-up, los elementos y los conectores', () => {
  const h = hojaDe([
    { id: 'g-a', tipo: 'numero', fuente: 'leads', metricas: ['leads'], titulo: 'Ganados', mako: true, makoIA: { pedido: 'Por qué bajó', sugerencias: [] }, alClic: 'popup', popup: { titulo: 'Lead', componentes: [{ id: 'p-t', clase: 'elemento', tipo: 'texto', texto: 'x' }] } },
    { id: 's1', clase: 'elemento', tipo: 'seccion', texto: 'Cobranza', seccion: { plegable: true, abierto: false }, y: 4 },
    { id: 'ia1', clase: 'elemento', tipo: 'ia', texto: 'Qué pasa', ia: { pedido: 'Qué frena', vista: 'hallazgos' }, y: 6 },
    { id: 'b1', clase: 'elemento', tipo: 'accion', accion: { id: 'sincronizar_llamadas', rotulo: 'Traer llamadas' }, y: 14 },
  ], { conectores: [{ id: 'k1', desde: 'g-a', hasta: 'ia1' }] });
  const g = h.componentes[0] as Grafico;
  const md = hojaMarkdown({
    hoja: h, quien: 'el informe de Ana', periodoHoja: 'Últimos 30 días', link: '', topeFilas: 10, controles: [],
    leidos: [
      { c: g, desde: '2026-10-01', hasta: '2026-10-11', agrupar: null, filtros: [], fijos: ['Etapa: Ganado'], noAplica: [], resultado: null, error: 'x' },
      ...h.componentes.filter((c): c is Elemento => c.clase === 'elemento').map((c) => ({ c })),
    ],
  });
  assert.match(md, /Lo define: Etapa: Ganado/);
  // Desde el 13/10/2026 el botón va sólo donde suma: la hoja dice cuándo lo LLEVA y qué responde.
  assert.match(md, /con el botón de MaKo \(responde: «Por qué bajó»\)/);
  assert.match(md, /abre un pop-up «Lead»/);
  assert.match(md, /Sección: Cobranza · se pliega, cerrada de entrada/);
  assert.match(md, /Conclusiones de MaKo: Qué pasa · muestra hallazgos.*pide «Qué frena»/);
  assert.match(md, /Acción: Traer llamadas · corre `sincronizar_llamadas`/);
  assert.match(md, /Conectores:\n- `k1` Ganados → Conclusiones de MaKo: Qué pasa/);
});

// Rotura 24.
test('v5: las cajas de Conclusiones que toca la API son las SUELTAS EN LA HOJA — nunca la de un pop-up (lee una llamada)', () => {
  const h = hojaDe([
    { id: 'tab', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'llamada', metricas: ['llamadas'], alClic: 'popup', popup: { titulo: 'Llamada', componentes: [{ id: 'ia-pop', clase: 'elemento', tipo: 'ia', ia: { lee: 'entidad' } }] } },
    { id: 'ia-hoja', clase: 'elemento', tipo: 'ia', texto: 'Qué decide los cierres', ia: {}, y: 12 },
  ]);
  const todas = buscarCajas(h, '');
  assert.ok(todas.ok && todas.valor.map((e) => e.id).join() === 'ia-hoja');
  assert.ok(!buscarCajas(h, 'ia-pop').ok, 'la del pop-up no existe para la API');
  assert.ok(buscarCajas(h, 'Qué decide los cierres').ok, 'por título');
  // El runner llama a las funciones de las cajas SIEMPRE sin pop-up y sin lo abierto.
  for (const id of ['leer_conclusiones_dashboard', 'generar_conclusiones_dashboard']) {
    const r = runner(id);
    const vistas = [...r.matchAll(/vistaDeCaja\(([^)]*)\)/g)];
    assert.ok(vistas.length >= 1, `${id} sin vistaDeCaja`);
    for (const m of vistas) assert.match(m[1], /popupDe: '', elementoId: e\.id, ref: ''/, `${id}: ${m[1]}`);
  }
  assert.match(runner('generar_conclusiones_dashboard'), /arrancarCaja\(\{\s*usuario: sub, hoja, elementoId, popupDe: null, ref: null,/);
  const llamadas = [...RUN.matchAll(/\b(vistaDeCaja|arrancarCaja|vistaDeCajaDeLaCuenta|programarCaja|drenarCajasVencidas)\(/g)].length;
  assert.equal(llamadas, 3, 'una llamada nueva a las cajas pasa por esta guarda');
  // Salen por HTTP con alias, como el AI Analyst: generar cuesta IA (gratis), se confirma y corre por detrás.
  const gen = REGISTRO.find((d) => d.id === 'generar_conclusiones_dashboard')!;
  assert.equal(gen.costo, 'ia');
  assert.equal(gen.lenta, true);
  assert.match(runner('generar_conclusiones_dashboard'), /porDetras\(ctx\.ws, \(\) => analizarCaja\(r\.pedido\)\)/);
  assert.match(runner('leer_conclusiones_dashboard'), /r\.http \? vista\.ultimo\.salida : salidaCajaConNombres\(/);
});

// Rotura 25.
test('v5: por HTTP, un filtro de la hoja no deja ELEGIDO un nombre (sí el filtro sin valores)', () => {
  const h = hojaDe([]);
  const conNombre = armarControlHoja(h, { tipo: 'lista', campo: 'closer', valores: ['Juan'] }, true);
  assert.ok(!conNombre.ok && /personas/.test(conNombre.error));
  assert.ok(armarControlHoja(h, { tipo: 'lista', campo: 'closer' }, true).ok);
  assert.ok(armarControlHoja(h, { tipo: 'lista', campo: 'closer', valores: ['Juan'] }, false).ok);
  assert.match(runner('agregar_filtro_dashboard'), /\}, ctx\.canal === 'http'\);/);
});
