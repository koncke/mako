// =============================================================================
// «Compartir» del Dashboard — quién administra un link del informe, y qué sale por él
// =============================================================================
// Martín (11/10/2026, punto 9): «Agrega el botón de "Compartir" que funcione exactamente igual que lo que
// ya tenemos en "Compartir" en la vista de CONOCIMIENTOS de SuperAdmin, que se pueda crear un link de
// acceso a esos graficos y también invitar por email».
//
// Es el primer recurso compartible que NO administra el super admin: lo comparte el admin de cada negocio,
// sobre SU informe (el informe es por persona y por workspace). Las guardas se prueban con DOS sujetos
// (dos workspaces, dos personas): con uno solo, una condición cableada a un número pasa todas las pruebas.
//
// Probado ROMPIÉNDOLO (11/10/2026), cada rotura contra la base en verde (17 pass / 0 fail) y restaurada
// de memoria por un arnés que reescribe el original y verifica que quedó idéntico (nunca git):
//   · `administraShare` sin `s.recurso_id === adm.sub`                        → 16 / 1 (otra persona del mismo ws)
//   · `administraShare` sin el chequeo de workspace                             → 15 / 2 (los dos de administraShare)
//   · `puedeVerInforme` sin `share.recurso !== RECURSO_INFORME`                → 16 / 1 (branding con alcance item)
//   · `puedeCompartirInforme` sin `q.rolWs !== 'admin'`                         → 16 / 1
//   · `filtrosCompartidos` aceptando cualquier dimensión del cuerpo             → 15 / 2
//   · `filtrosCompartidos` sin `delDueno` (se pierde el filtro del dueño)      → 15 / 2
//   · `pedidoGraficoCompartido` con `grafico: cliente.grafico`                  → 16 / 1
//   · `cobranza` agregado a BLOQUES_COMPARTIBLES                                 → 15 / 2
//   · `revenue` agregado a BLOQUES_COMPARTIBLES                                  → 15 / 2
//   · `resultadoCompartible` sin `sinPersonas`                                   → 16 / 1
//   · `nombreDeShare` del informe cayendo al `recurso_id`                        → 16 / 1
//   · `repartirBloques` decidiendo por el id y no por el tipo                    → 16 / 1
//   · `controlParaLink` sin alias (los chips con el nombre real)                 → 16 / 1
//   · `factores_cierre` con sus ejemplos (botones a la ficha de una llamada)     → 16 / 1
// (Las de BLOQUES_COMPARTIBLES, `repartirBloques` y `factores_cierre` son de antes de v5: los bloques se fueron.)
//
// v5 (12/10/2026), con base 21 / 0, una rotura por vez con el arnés del paquete P9 (restaura de memoria y
// compara byte a byte, nunca git); medido dos veces, la segunda sobre el árbol de la ola 3:
//  15. `filtrosPermitidos` dejando mover un filtro FIJO                                → 20 / 1
//  16. `filtrosPermitidos` sin la barra de búsqueda de la tabla (`conBusqueda`)        → 20 / 1
//  17. `periodoCompartido` dejando mover un período de definición                      → 20 / 1
//  18. `resultadoSinPersonas` con las columnas extra crudas                             → 20 / 1
//  18b. y con la miniatura de una fila que es una persona                               → 20 / 1
//  19. `mapa_calor` fuera de TIPOS_QUE_NO_SALEN                                         → 17 / 4
//  20. `ia` en ELEMENTOS_QUE_SALEN                                                      → 19 / 2
//  21. `accion` fuera de ELEMENTOS_QUE_NO_SALEN                                         → 20 / 1
//  22. `graficoParaLink` dejando el pop-up                                              → 20 / 1
//  23. y las acciones de la fila                                                        → 20 / 1
//  24. `seComparte` dejando pasar una grabación de Fathom                               → 20 / 1
//  25. la tarjeta nombrando el TEXTO del elemento (el título de un video es «Llamada con Ana») → 20 / 1
//  26. la tarjeta fuera de su lugar                                                     → 20 / 1
//  27. `controlDeLista` dando los valores de un control fijo                            → 20 / 1
//  28. y los de un gráfico que no sale                                                  → 20 / 1
//  29. `repartirGraficos` decidiendo por el id y no por el tipo                         → 20 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  administraShare, puedeCompartirInforme, puedeVerInforme, RECURSO_INFORME, RECURSOS_PLATAFORMA,
  type Administrador, type Share,
} from '../lib/shares';
import { nombreDeShare, INFORME_SIN_NOMBRE } from '../lib/share-nombre';
import { TIPOS, TIPOS_ELEMENTO, sanearGrafico, sanearHoja, type Elemento, type Grafico, type Hoja, type Tablero } from '../lib/graficos-catalogo';
import type { Resultado } from '../lib/graficos-agregar';
import {
  ELEMENTOS_QUE_NO_SALEN, ELEMENTOS_QUE_SALEN, NO_SE_COMPARTE, TIPOS_QUE_NO_SALEN, campoCompartible, controlDeLista,
  esGrabacionDeLlamada, filtrosCompartidos, filtrosPermitidos, hojaDeInforme, pedidoGraficoCompartido, pedidosDeGraficos,
  periodoCompartido, repartirGraficos, resultadoCompartible, tableroParaLink,
} from '../app/compartido/[token]/informe-reglas';
import { RUTA_LECTURA_COMPARTIDA } from '../app/dashboard/lectura-compartida';
import { Alias } from '../lib/graficos-analisis';

const HOY = '2026-10-11';

// ── Las dos puertas de /api/compartir ───────────────────────────────────────────────────────────

const quien = (extra: Partial<Parameters<typeof puedeCompartirInforme>[0]> = {}) =>
  ({ rolWs: 'admin', tabDashboard: true, ws: 13, sub: 'u1', ...extra });

test('compartir el informe: las CUATRO condiciones, en positivo', () => {
  assert.equal(puedeCompartirInforme(quien()), true, 'el admin de un negocio con la tab Dashboard');
  assert.equal(puedeCompartirInforme(quien({ ws: 14, sub: 'u2' })), true, 'el de OTRO negocio también, sobre lo suyo');
  assert.equal(puedeCompartirInforme(quien({ rolWs: 'closer' })), false, 'el closer mira un informe en memoria que no es suyo');
  assert.equal(puedeCompartirInforme(quien({ rolWs: 'setter' })), false);
  assert.equal(puedeCompartirInforme(quien({ rolWs: null })), false, 'sin sesión');
  assert.equal(puedeCompartirInforme(quien({ tabDashboard: false })), false, 'la tab no está en su capa');
  assert.equal(puedeCompartirInforme(quien({ ws: null })), false, 'un admin sin workspace en curso');
  assert.equal(puedeCompartirInforme(quien({ ws: 0 })), false);
  assert.equal(puedeCompartirInforme(quien({ sub: '' })), false, 'sin persona no hay informe');
  assert.equal(puedeCompartirInforme(quien({ sub: null })), false);
});

const share = (extra: Partial<Share> = {}): Share => ({
  id: 7, workspace_id: 13, recurso: RECURSO_INFORME, alcance: 'item', recurso_id: 'u1',
  modo: 'link', permiso: 'ver', etiqueta: 'Dashboard', expira_at: null, revocado_at: null, ...extra,
});
const informeDe = (ws: number, sub: string): Administrador => ({ tipo: 'informe', ws, sub });
const PLATAFORMA: Administrador = { tipo: 'plataforma', ws: 1 };

test('administraShare: DOS workspaces y DOS personas — cada uno toca sólo lo suyo', () => {
  // Las dos personas del ws 13 y la misma persona (una agencia) mirando los ws 13 y 14.
  assert.equal(administraShare(informeDe(13, 'u1'), share()), true, 'su propio informe');
  assert.equal(administraShare(informeDe(13, 'u2'), share()), false, 'OTRA persona del mismo workspace no lo lista ni lo revoca');
  assert.equal(administraShare(informeDe(14, 'u1'), share()), false, 'la misma persona en OTRO workspace tampoco');
  assert.equal(administraShare(informeDe(14, 'u2'), share({ workspace_id: 14, recurso_id: 'u2' })), true, 'y el segundo sujeto, con lo suyo, sí');
  // Una fila que no es del informe no la toca el admin de un negocio, aunque sea de su workspace.
  for (const recurso of RECURSOS_PLATAFORMA) {
    assert.equal(administraShare(informeDe(13, 'u1'), share({ recurso, recurso_id: 'u1' })), false, recurso);
  }
  assert.equal(administraShare(informeDe(13, 'u1'), share({ recurso_id: null })), false, 'un informe sin persona no es de nadie');
  // bigint que llega como string: se compara como número.
  assert.equal(administraShare(informeDe(13, 'u1'), share({ workspace_id: '13' as unknown as number })), true);
});

test('administraShare: el super admin sigue con lo suyo, y NO con el informe de un negocio', () => {
  assert.equal(administraShare(PLATAFORMA, share({ workspace_id: 1, recurso: 'curso', recurso_id: 'claude' })), true);
  assert.equal(administraShare(PLATAFORMA, share({ workspace_id: 1, recurso: 'conocimientos', alcance: 'todo', recurso_id: null })), true);
  assert.equal(administraShare(PLATAFORMA, share({ workspace_id: 1 })), false, 'el informe de alguien del ws 1 no es de la plataforma');
  assert.equal(administraShare(PLATAFORMA, share({ workspace_id: 13, recurso: 'curso' })), false, 'otro workspace');
  assert.equal(administraShare(PLATAFORMA, share({ workspace_id: 1, recurso: 'tarea-cs' })), false, 'un recurso que nadie declaró, no');
});

test('puedeVerInforme: el recurso PRIMERO — `puedeVer` solo no mira el recurso', () => {
  assert.equal(puedeVerInforme(share(), 'u1'), true);
  assert.equal(puedeVerInforme(share(), 'u2'), false, 'el informe de otra persona');
  // EL caso: un share de branding con alcance `item` y un `recurso_id` cualquiera. `puedeVer` dice que sí.
  assert.equal(puedeVerInforme(share({ recurso: 'branding' }), 'u1'), false, 'un token vivo de OTRO recurso no abre un informe');
  assert.equal(puedeVerInforme(share({ alcance: 'todo' }), 'u1'), false, 'un informe se comparte entero, de UNA persona');
  assert.equal(puedeVerInforme(share({ permiso: 'editar' }), 'u1'), false, 'un link del informe no escribe');
  assert.equal(puedeVerInforme(share({ workspace_id: 0 }), 'u1'), false);
  assert.equal(puedeVerInforme(share({ recurso_id: null }), null), false);
});

test('nombreDeShare del informe: el de hoy, la foto, el inicial — y NUNCA el id de la persona', () => {
  const s = { recurso: RECURSO_INFORME, recurso_id: 'a1b2c3-uuid', etiqueta: 'Ventas Q4' };
  const sinCursos = () => undefined;
  assert.equal(nombreDeShare(s, sinCursos, 'Ventas 2026'), 'Ventas 2026', 'el nombre de HOY manda');
  assert.equal(nombreDeShare(s, sinCursos), 'Ventas Q4', 'sin el de hoy, la foto');
  assert.equal(nombreDeShare({ ...s, etiqueta: null }, sinCursos), INFORME_SIN_NOMBRE);
  assert.equal(nombreDeShare({ ...s, etiqueta: '  ' }, sinCursos, ' '), INFORME_SIN_NOMBRE);
  assert.notEqual(nombreDeShare({ ...s, etiqueta: null }, sinCursos), 'a1b2c3-uuid', 'un id de usuario no es un nombre');
});

// ── Qué sale por el link ────────────────────────────────────────────────────────────────────────

const g = (r: Record<string, unknown>): Grafico => sanearGrafico({ id: 'g1', ...r })!;
const hojaCon = (componentes: unknown[], extra: Record<string, unknown> = {}): Hoja =>
  sanearHoja({ id: 'h1', nombre: 'Comercial', componentes, ...extra }, 0)!;

// Un gráfico de leads con un filtro de ETAPA (público) y uno de CLOSER (personas) en la barra; el dueño
// dejó el de closer en «Juan». (v5: sin bloques; una hoja vieja que los traía llega ya convertida.)
const LEADS = { id: 'g1', clase: 'grafico', tipo: 'tabla', fuente: 'leads', fecha: 'alta', dimension: 'etapa', metricas: ['leads'] };
const HOJA = hojaCon([LEADS, { id: 'g2', tipo: 'numero', fuente: 'pagos', metricas: ['cobrado'], y: 8 }], {
  controles: [
    { id: 'cp', tipo: 'periodo', preset: 'ult30' },
    { id: 'ce', tipo: 'lista', campo: 'leads.etapa' },
    { id: 'cc', tipo: 'lista', campo: 'closer', valores: ['Juan'] },
  ],
});
const G1 = HOJA.componentes.find((c) => c.id === 'g1') as Grafico;

test('campoCompartible: un campo de personas no se mueve; uno público, sí', () => {
  assert.deepEqual(campoCompartible(HOJA, 'leads.etapa'), ['leads']);
  assert.equal(campoCompartible(HOJA, 'closer'), null, 'sus valores serían nombres');
  assert.equal(campoCompartible(HOJA, 'no-existe'), null);
});

test('filtrosCompartidos: el del dueño en lo que no se mueve, el de la vista en lo permitido, y nada más', () => {
  const filtros = filtrosCompartidos(G1, HOJA, [
    { dimension: 'etapa', valores: ['Ganado'] },
    { dimension: 'closer', valores: ['Pedro'] },          // intenta mover un filtro de personas
    { dimension: 'lead', texto: 'Ma' },                     // intenta un oráculo sobre una dimensión sin control
    { dimension: 'producto', valores: ['X'] },              // un control que la hoja no tiene
  ], HOY);
  assert.deepEqual(
    [...filtros].sort((a, b) => a.dimension.localeCompare(b.dimension)),
    [{ dimension: 'closer', valores: ['Juan'] }, { dimension: 'etapa', valores: ['Ganado'] }],
  );
  // Sin nada de la vista: lo que el dueño dejó guardado, tal cual (si se tirara, el gráfico mostraría MÁS).
  assert.deepEqual(filtrosCompartidos(G1, HOJA, undefined, HOY), [{ dimension: 'closer', valores: ['Juan'] }]);
  // Una lista vacía es «todos»: no filtra.
  assert.deepEqual(filtrosCompartidos(G1, HOJA, [{ dimension: 'etapa', valores: [] }], HOY), [{ dimension: 'closer', valores: ['Juan'] }]);
});

// v5, rotura 15: un filtro de DEFINICIÓN no lo mueve un link, aunque la hoja tenga un control para mirar ese campo.
test('v5: un filtro FIJO no lo mueve la vista del link (ni en el gráfico ni sobre el control de la hoja del mismo campo)', () => {
  const definida = hojaCon([{ ...LEADS, controles: [{ id: 'fx', tipo: 'lista', campo: 'leads.etapa', valores: ['Ganado'], fijo: true }] }], {
    controles: [{ id: 'ce', tipo: 'lista', campo: 'leads.etapa' }],
  });
  const gd = definida.componentes[0] as Grafico;
  assert.equal(filtrosPermitidos(gd, definida).has('etapa'), false, 'la definición manda sobre el control de la hoja (como en la pantalla del dueño)');
  assert.deepEqual(filtrosCompartidos(gd, definida, [{ dimension: 'etapa', valores: ['Perdido'] }], HOY), [{ dimension: 'etapa', valores: ['Ganado'] }]);
  // Sin el fijo, el mismo control de la hoja sí se mueve.
  assert.equal(filtrosPermitidos(G1, HOJA).get('etapa'), 'lista');
});

// v5, rotura 16: la barra de búsqueda de una tabla es un control más; sólo se mueve sobre un campo público.
test('v5: la búsqueda de una tabla filtra en el link sólo sobre un campo público', () => {
  const porEtapa = hojaCon([{ ...LEADS, tabla: { buscar: true } }]);
  assert.equal(filtrosPermitidos(porEtapa.componentes[0] as Grafico, porEtapa).get('etapa'), 'texto', 'sin esto, la búsqueda de una tabla no filtraba en un link');
  const porLlamada = hojaCon([{ id: 'g1', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'llamada', metricas: ['llamadas'], tabla: { buscar: true } }]);
  const gl = porLlamada.componentes[0] as Grafico;
  assert.equal(filtrosPermitidos(gl, porLlamada).has('llamada'), false, 'una búsqueda sobre personas sería un oráculo letra por letra');
  assert.deepEqual(filtrosCompartidos(gl, porLlamada, [{ dimension: 'llamada', texto: 'Ana' }], HOY), []);
});

test('el pedido de un gráfico se REARMA desde el guardado: el `grafico` del cuerpo no se lee', () => {
  const otro = { ...LEADS, fuente: 'pagos', dimension: 'lead', metricas: ['cobrado'] };
  const p = pedidoGraficoCompartido(G1, HOJA, { id: 'g1', grafico: otro, desde: '2026-10-01', hasta: '2026-10-05', agrupar: 'mes' }, HOY);
  assert.equal(p.grafico, G1, 'el componente es el GUARDADO');
  assert.equal(p.grafico.fuente, 'leads');
  assert.deepEqual([p.desde, p.hasta], ['2026-10-01', '2026-10-05'], 'el período es de la vista');
  // Un período roto vuelve al que el informe muestra de entrada.
  assert.deepEqual(periodoCompartido(G1, HOJA, '2026-10-05', '2026-10-01', HOY), { desde: '2026-09-12', hasta: HOY });
  assert.deepEqual(periodoCompartido(G1, HOJA, 'ayer', null, HOY), { desde: '2026-09-12', hasta: HOY });
});

// v5, rotura 17: el período de DEFINICIÓN (las cohortes miran «todo») no lo cambia la vista del link.
test('v5: un período FIJO no lo mueve la vista del link', () => {
  const h = hojaCon([{ ...LEADS, periodo: 'todo' }]);
  const gf = h.componentes[0] as Grafico;
  assert.ok(gf.controles.some((k) => k.tipo === 'periodo' && k.fijo), 'el saneo lo migró a un control fijo');
  assert.deepEqual(periodoCompartido(gf, h, '2026-10-01', '2026-10-05', HOY), periodoCompartido(gf, h, null, null, HOY));
  assert.notDeepEqual(periodoCompartido(gf, h, '2026-10-01', '2026-10-05', HOY), { desde: '2026-10-01', hasta: '2026-10-05' });
});

test('los pedidos del cuerpo: sólo gráficos de ESTA hoja, sin repetir', () => {
  const cuerpo = [{ id: 'g1' }, { id: 'g1' }, { id: 'g2' }, { id: 'zz' }, { id: '../x' }, null, 'g1'];
  assert.deepEqual(pedidosDeGraficos(HOJA, cuerpo).map((x) => x.comp.id), ['g1', 'g2']);
  assert.deepEqual(pedidosDeGraficos(HOJA, 'no-es-lista'), []);
});

test('controlDeLista: sólo una LISTA que la hoja (o ese gráfico, si sale en el link) tiene, y que se puede mover', () => {
  const hoja = hojaCon([
    { ...LEADS, controles: [{ id: 'k1', tipo: 'lista', campo: 'leads.origen' }, { id: 'kf', tipo: 'lista', campo: 'leads.etapa', fijo: true }] },
    { id: 'mc', tipo: 'mapa_calor', fuente: 'toques', controles: [{ id: 'k2', tipo: 'lista', campo: 'pagina' }], y: 8 },
  ], {
    controles: [{ id: 'ce', tipo: 'lista', campo: 'leads.etapa' }, { id: 'cb', tipo: 'texto', campo: 'leads.campana' }],
  });
  assert.equal(controlDeLista(hoja, 'ce', undefined)?.campo, 'leads.etapa');
  assert.equal(controlDeLista(hoja, 'cb', undefined), null, 'una búsqueda no tiene valores que listar');
  assert.equal(controlDeLista(hoja, 'k1', 'g1')?.campo, 'leads.origen', 'el de la cabecera del gráfico');
  assert.equal(controlDeLista(hoja, 'k1', undefined), null, 'sin decir de qué gráfico, no se busca en todos');
  assert.equal(controlDeLista(hoja, 'nada', undefined), null);
  assert.equal(controlDeLista(hoja, 'kf', 'g1'), null, 'un filtro de definición no se dibuja: nadie pide sus valores');
  assert.equal(controlDeLista(hoja, 'k2', 'mc'), null, 'el control de lo que no se comparte, tampoco');
});

const res = (r: Partial<Resultado>): Resultado => ({ columnas: [], filas: [], totales: [], fuera: 0, clase: 'categoria', ...r });

test('el resultado sale sin personas y sin el id de cada fila', () => {
  const porCloser = g({ tipo: 'tabla', fuente: 'leads', dimension: 'closer', metricas: ['leads'] });
  const limpio = resultadoCompartible(porCloser, res({ filas: [{ clave: 'Juan Pérez', etiqueta: 'Juan Pérez', valores: [3], ref: '41' }] }));
  assert.notEqual(limpio.filas[0].etiqueta, 'Juan Pérez', 'un closer no sale con su nombre');
  assert.match(limpio.filas[0].etiqueta, /^Closer \d+$/);
  assert.equal('ref' in limpio.filas[0], false, 'el id sólo sirve para abrir el detalle, que no se ofrece');
  // Una dimensión pública queda como está (menos el id).
  const porCampana = g({ tipo: 'tabla', fuente: 'meta', dimension: 'campana', metricas: ['gasto'] });
  const c = resultadoCompartible(porCampana, res({ filas: [{ clave: 'Verano', etiqueta: 'Verano', valores: [10], ref: 'x' }] }));
  assert.equal(c.filas[0].etiqueta, 'Verano');
  assert.equal('ref' in c.filas[0], false);
  // Con el alias del pedido, la misma persona es el mismo «Closer N» en dos gráficos.
  const alias = new Alias();
  const fila = { clave: 'Ana', etiqueta: 'Ana', valores: [1] };
  const uno = resultadoCompartible(porCloser, res({ filas: [{ ...fila, clave: 'Juan Pérez', etiqueta: 'Juan Pérez' }, fila] }), alias);
  const dos = resultadoCompartible(g({ id: 'g2', tipo: 'barras', fuente: 'leads', dimension: 'closer', metricas: ['leads'] }), res({ filas: [fila] }), alias);
  assert.equal(dos.filas[0].etiqueta, uno.filas[1].etiqueta);
});

// v5, rotura 18: lo que `sinPersonas` no miraba — las columnas extra y la miniatura de una fila-persona.
test('v5: las columnas extra de una tabla y la miniatura de una fila-persona tampoco salen; la de un guion, sí', () => {
  const llamadas = g({ tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'llamada', metricas: ['llamadas'], tabla: { columnas: ['closer', 'reunion'] } });
  const r = resultadoCompartible(llamadas, res({ filas: [{ clave: 'Llamada con Ana', etiqueta: 'Llamada con Ana', valores: [1], ref: '9', extra: { closer: 'Juan Pérez', reunion: 'R1' }, imagen: 'https://x.com/a.png', geo: { lat: 1, lon: 2 } }] }));
  assert.doesNotMatch(JSON.stringify(r), /Juan|Ana|a\.png|"geo"/);
  assert.equal(r.filas[0].extra?.reunion, 'R1');
  const tarjetas = g({ tipo: 'tarjetas', fuente: 'guiones', dimension: 'guion', metricas: [] });
  const t = resultadoCompartible(tarjetas, res({ filas: [{ clave: 'Hook 1', etiqueta: 'Hook 1', valores: [1], imagen: 'https://x.com/b.png' }] }));
  assert.equal(t.filas[0].imagen, 'https://x.com/b.png', 'un anuncio no es una persona: su miniatura sale');
});

test('el contrato con la pantalla: la ruta que pide `lectura-compartida.ts` es la de este endpoint', () => {
  // El que encola y el que ejecuta comparten un contrato (AGENTS.md): si la pantalla cambia la ruta, esto cae.
  assert.equal(RUTA_LECTURA_COMPARTIDA, '/api/compartido/graficos');
});

// ── v5: lo que NO sale en un link (decisión 4 de informe-reglas.ts) ──────────────────────────────

// Una hoja con TODO lo que no sale, y lo que sí, con nombres de personas metidos donde se podrían colar.
const HOJA_TODO = hojaCon([
  LEADS,
  { id: 'mc', tipo: 'mapa_calor', fuente: 'toques', titulo: 'Toques de la landing', y: 8 },
  { id: 'ia1', clase: 'elemento', tipo: 'ia', texto: 'Qué decide', ia: { pedido: 'Compara a Juan Pérez con Ana Gómez' }, y: 20 },
  { id: 'ac1', clase: 'elemento', tipo: 'accion', accion: { id: 'sincronizar_llamadas', rotulo: 'Traer llamadas' }, y: 28 },
  {
    id: 'tl', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'llamada', metricas: ['llamadas'], tabla: { acciones: true, buscar: true }, y: 30,
    alClic: 'popup', popup: { titulo: 'Llamada de Juan Pérez', componentes: [
      { id: 'pz', clase: 'elemento', tipo: 'entidad', entidad: { tipo: 'llamada', pieza: 'completo' } },
      { id: 'pia', clase: 'elemento', tipo: 'ia', ia: { lee: 'entidad', pedido: 'Qué dijo Ana Gómez' } },
    ] },
  },
  { id: 'vf', clase: 'elemento', tipo: 'video', texto: 'Llamada con Ana Gómez', url: 'https://fathom.video/share/abc123', y: 40 },
  { id: 's1', clase: 'elemento', tipo: 'seccion', texto: 'Cobranza', seccion: { plegable: true }, y: 48 },
  { id: 'tx', clase: 'elemento', tipo: 'texto', texto: 'Notas de la semana', y: 50 },
], { conectores: [{ id: 'k1', desde: 'mc', hasta: 'tx' }] });

// v5, roturas 19 a 26: EL test del pedido — el link no sirve ninguna de las cosas de la lista.
test('v5: el link NO sirve el mapa de calor, las cajas de IA, los pop-ups, las fichas, las acciones ni una grabación — y lo dice', () => {
  const link = tableroParaLink({ v: 3, nombre: 'Dashboard', hojas: [HOJA_TODO] });
  const h = link.hojas[0];
  const json = JSON.stringify(link);
  assert.doesNotMatch(json, /"mapa_calor"/, 'el mapa de calor monta la página de un cliente en vivo');
  assert.doesNotMatch(json, /"tipo":"(ia|accion|entidad)"/, 'ni una caja de IA, ni un botón, ni una ficha');
  assert.doesNotMatch(json, /"popup"|"alClic"/, 'los pop-ups no viajan');
  assert.doesNotMatch(json, /"acciones"/, 'ni las acciones de la fila');
  assert.doesNotMatch(json, /fathom\.video/, 'ni el link de una grabación');
  assert.doesNotMatch(json, /Juan|Ana/, 'ni un nombre metido en lo que no sale');
  // Cada cosa que no sale queda como su tarjeta, en su lugar, con su id (los conectores siguen valiendo).
  for (const id of ['mc', 'ia1', 'ac1', 'vf']) {
    const c = h.componentes.find((x) => x.id === id) as Elemento | undefined;
    assert.ok(c && c.clase === 'elemento' && c.tipo === 'texto' && c.texto.includes(NO_SE_COMPARTE), `${id}: falta su tarjeta «${NO_SE_COMPARTE}»`);
    const original = HOJA_TODO.componentes.find((x) => x.id === id)!;
    assert.deepEqual([c.x, c.y, c.w, c.h], [original.x, original.y, original.w, original.h], `${id}: la tarjeta va en su lugar`);
  }
  assert.ok((h.componentes.find((x) => x.id === 'mc') as Elemento).texto.startsWith('Toques de la landing'));
  // Lo que sí sale, sale: la tabla (sin su pop-up ni sus acciones, con su búsqueda), la sección, el texto, el conector.
  const tl = h.componentes.find((x) => x.id === 'tl') as Grafico;
  assert.ok(tl && tl.clase === 'grafico' && tl.tabla?.buscar === true);
  assert.ok(h.componentes.some((x) => x.id === 's1' && x.clase === 'elemento' && x.tipo === 'seccion'));
  assert.ok(h.componentes.some((x) => x.id === 'tx' && x.clase === 'elemento' && x.tipo === 'texto' && x.texto === 'Notas de la semana'));
  assert.deepEqual(h.conectores?.map((k) => k.id), ['k1']);
  // El informe real no se toca: con él se leen los datos.
  assert.ok(HOJA_TODO.componentes.some((x) => x.id === 'mc' && x.clase === 'grafico'));
});

test('v5: y el SERVER tampoco lo lee aunque se lo pidan: el mapa de calor contesta «No se comparte», un pop-up ni se encuentra', () => {
  const pedidos = pedidosDeGraficos(HOJA_TODO, [{ id: 'g1' }, { id: 'mc' }, { id: 'tl' }, { id: 'pz' }, { id: 'pia' }, { id: 'ia1' }, { id: 'ac1' }]);
  assert.deepEqual(pedidos.map((x) => x.comp.id), ['g1', 'mc', 'tl'], 'las piezas de un pop-up y los elementos no son gráficos de la hoja');
  const { salen, noSalen } = repartirGraficos(pedidos.map((x) => ({ g: x.comp })));
  assert.deepEqual(salen.map((x) => x.g.id), ['g1', 'tl']);
  assert.deepEqual(noSalen.map((x) => x.g.id), ['mc'], 'decide el TIPO guardado: el mapa de calor ni se lee');
  // Dos negocios con el mismo id: decide el tipo, nunca el id.
  const otro = hojaCon([{ id: 'mc', tipo: 'tabla', fuente: 'leads', dimension: 'etapa', metricas: ['leads'] }]);
  assert.deepEqual(repartirGraficos(pedidosDeGraficos(otro, [{ id: 'mc' }]).map((x) => ({ g: x.comp }))).salen.map((x) => x.g.id), ['mc']);
});

test('v5: qué sale, EN POSITIVO — cada tipo del catálogo decidido, y un dibujo propio nuevo no sale sin decidirlo', () => {
  for (const t of TIPOS_ELEMENTO) {
    const sale = ELEMENTOS_QUE_SALEN.includes(t.id);
    const noSale = Object.prototype.hasOwnProperty.call(ELEMENTOS_QUE_NO_SALEN, t.id);
    assert.ok(sale !== noSale, `el elemento «${t.id}» tiene que estar en UNA de las dos listas (informe-reglas.ts)`);
  }
  for (const id of Object.keys(TIPOS_QUE_NO_SALEN)) assert.ok(TIPOS.some((t) => t.id === id), `${id} no es un tipo del catálogo`);
  // Los tipos con dibujo propio leen por su cuenta, fuera del endpoint del link: cada uno tiene que estar decidido.
  const registro = readFileSync(join(__dirname, '..', 'app', 'dashboard', 'graficos', 'registro.ts'), 'utf8').replace(/\r\n/g, '\n');
  const propios = /TIPOS_CON_DIBUJO_PROPIO: readonly string\[\] = \[([^\]]*)\]/.exec(registro);
  assert.ok(propios, 'no encontré TIPOS_CON_DIBUJO_PROPIO en app/dashboard/graficos/registro.ts');
  for (const id of propios[1].match(/'([a-z_]+)'/g)!.map((x) => x.slice(1, -1))) {
    assert.ok(Object.prototype.hasOwnProperty.call(TIPOS_QUE_NO_SALEN, id), `«${id}» se dibuja por su cuenta: decide si sale en un link`);
  }
  assert.equal(esGrabacionDeLlamada('https://fathom.video/share/x'), true);
  assert.equal(esGrabacionDeLlamada('https://app.fathom.video/calls/1'), true);
  assert.equal(esGrabacionDeLlamada('https://notfathom.video/x'), false);
  assert.equal(esGrabacionDeLlamada('https://www.youtube.com/watch?v=x'), false);
});

test('tableroParaLink: los valores ELEGIDOS de un filtro de personas viajan como alias; los datos siguen leyendo el real', () => {
  const t: Tablero = {
    v: 3, nombre: 'Dashboard',
    hojas: [
      HOJA,
      hojaCon([{ ...LEADS, id: 'g9', controles: [{ id: 'k9', tipo: 'lista', campo: 'closer', valores: ['Juan', 'Ana'] }] }], {
        controles: [{ id: 'cb', tipo: 'texto', campo: 'closer', texto: 'Pe' }, { id: 'ce', tipo: 'lista', campo: 'leads.etapa', valores: ['Ganado'] }],
      }),
    ],
  };
  const link = tableroParaLink(t);
  const cc = link.hojas[0].controles.find((c) => c.id === 'cc')!;
  assert.deepEqual(cc.valores, ['Closer 1'], 'el chip no dice «Juan»');
  const k9 = (link.hojas[1].componentes[0] as Grafico).controles[0];
  assert.deepEqual(k9.valores, ['Closer 1', 'Closer 2'], 'el mismo nombre, el mismo alias en las dos hojas');
  assert.equal(link.hojas[1].controles.find((c) => c.id === 'cb')!.texto, 'una búsqueda', 'una búsqueda no dice qué se buscó');
  assert.deepEqual(link.hojas[1].controles.find((c) => c.id === 'ce')!.valores, ['Ganado'], 'un campo público va tal cual');
  // El informe real no se toca: con él se leen los datos (el filtro del dueño sigue filtrando por Juan).
  assert.deepEqual(HOJA.controles.find((c) => c.id === 'cc')!.valores, ['Juan']);
  assert.deepEqual(filtrosCompartidos(G1, HOJA, [{ dimension: 'closer', valores: ['Closer 1'] }], HOY), [{ dimension: 'closer', valores: ['Juan'] }],
    'el alias que vuelve del navegador no reemplaza al valor real');
});

test('la hoja en que abre el link: la pedida si está; si no, la primera — nunca agrega una', () => {
  const t: Tablero = { v: 3, nombre: 'Dashboard', hojas: [HOJA, { ...HOJA, id: 'h2' }] };
  assert.equal(hojaDeInforme(t, 'h2').id, 'h2');
  assert.equal(hojaDeInforme(t, 'closing').id, 'h1', 'una plantilla que el informe no tiene no se suma');
  assert.equal(hojaDeInforme(t, '<script>').id, 'h1');
  assert.equal(hojaDeInforme(t, null).id, 'h1');
});
