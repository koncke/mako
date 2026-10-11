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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  administraShare, puedeCompartirInforme, puedeVerInforme, RECURSO_INFORME, RECURSOS_PLATAFORMA,
  type Administrador, type Share,
} from '../lib/shares';
import { nombreDeShare, INFORME_SIN_NOMBRE } from '../lib/share-nombre';
import { sanearGrafico, sanearHoja, type Grafico, type Hoja, type Tablero } from '../lib/graficos-catalogo';
import { BLOQUES_CON_PERSONAS } from '../lib/graficos-bloques-extra-catalogo';
import type { Resultado } from '../lib/graficos-agregar';
import {
  BLOQUES_COMPARTIBLES, IDS_BLOQUES, bloqueCompartible, campoCompartible, controlDeLista, filtrosCompartidos,
  hojaDeInforme, pedidoBloqueCompartido, pedidoGraficoCompartido, pedidosDeBloques, pedidosDeGraficos,
  periodoCompartido, repartirBloques, resultadoCompartible, tableroParaLink,
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
// dejó el de closer en «Juan».
const LEADS = { id: 'g1', clase: 'grafico', tipo: 'tabla', fuente: 'leads', fecha: 'alta', dimension: 'etapa', metricas: ['leads'] };
const HOJA = hojaCon([LEADS, { id: 'b1', clase: 'bloque', bloque: 'revenue' }, { id: 'b2', clase: 'bloque', bloque: 'cobranza' }], {
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

test('los pedidos del cuerpo: sólo ids de ESTA hoja, de la clase pedida, sin repetir', () => {
  const cuerpo = [{ id: 'g1' }, { id: 'g1' }, { id: 'b1' }, { id: 'zz' }, { id: '../x' }, null, 'g1'];
  assert.deepEqual(pedidosDeGraficos(HOJA, cuerpo).map((x) => x.comp.id), ['g1']);
  assert.deepEqual(pedidosDeBloques(HOJA, cuerpo).map((x) => x.comp.id), ['b1']);
  assert.deepEqual(pedidosDeGraficos(HOJA, 'no-es-lista'), []);
  // Y el bloque también sale del guardado, no del cuerpo.
  const b1 = pedidosDeBloques(HOJA, [{ id: 'b1', bloque: 'cobranza' }])[0];
  assert.equal(pedidoBloqueCompartido(b1.comp, HOJA, b1.cliente, HOY).bloque, 'revenue');
});

test('controlDeLista: sólo una LISTA que la hoja (o ese gráfico) tiene', () => {
  const hoja = hojaCon([{ ...LEADS, controles: [{ id: 'k1', tipo: 'lista', campo: 'leads.origen' }] }], {
    controles: [{ id: 'ce', tipo: 'lista', campo: 'leads.etapa' }, { id: 'cb', tipo: 'texto', campo: 'leads.campana' }],
  });
  assert.equal(controlDeLista(hoja, 'ce', undefined)?.campo, 'leads.etapa');
  assert.equal(controlDeLista(hoja, 'cb', undefined), null, 'una búsqueda no tiene valores que listar');
  assert.equal(controlDeLista(hoja, 'k1', 'g1')?.campo, 'leads.origen', 'el de la cabecera del gráfico');
  assert.equal(controlDeLista(hoja, 'k1', undefined), null, 'sin decir de qué gráfico, no se busca en todos');
  assert.equal(controlDeLista(hoja, 'nada', undefined), null);
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

test('el contrato con la pantalla: la ruta que pide `lectura-compartida.ts` es la de este endpoint', () => {
  // El que encola y el que ejecuta comparten un contrato (AGENTS.md): si la pantalla cambia la ruta, esto cae.
  assert.equal(RUTA_LECTURA_COMPARTIDA, '/api/compartido/graficos');
});

test('BLOQUES_COMPARTIBLES: en positivo — ni personas ni acciones de servidor, y cada uno existe en el catálogo', () => {
  for (const id of Object.keys(BLOQUES_COMPARTIBLES)) assert.ok(IDS_BLOQUES.includes(id), `${id} no es un bloque del catálogo`);
  for (const id of BLOQUES_CON_PERSONAS) assert.equal(bloqueCompartible(id), false, `${id} trae personas: no sale`);
  // Los comerciales: «A quién cobrarle» con «Marcar cobrada», y los desgloses de leads con «Editar lead».
  for (const id of ['cobranza', 'revenue', 'funnel_maduro', 'scl', 'cohortes_mes', 'cohortes_semana']) {
    assert.equal(bloqueCompartible(id), false, `${id}: sus desgloses son personas con acciones que sin sesión fallan`);
  }
  assert.equal(bloqueCompartible('bloque-que-se-sume-manana'), false, 'lo nuevo nace cerrado');
  assert.equal(bloqueCompartible('toString'), false, 'no lo abre una propiedad del prototipo');
  // Y los que sí: cuentas, anuncios, videos y proyectos.
  for (const id of ['embudo_cierre', 'factores_cierre', 'patrones_guiones', 'cuadrante_retencion', 'curva_vsl', 'matriz_proyectos', 'piramide_prioridad']) {
    assert.equal(bloqueCompartible(id), true, id);
  }
});

test('repartirBloques: DOS hojas de dos negocios — decide el TIPO guardado, nunca el id', () => {
  // Dos sujetos con los mismos tipos y ids distintos (el de un negocio puede llamarse como el de otro).
  const hojaA = [{ b: { id: 'a1', bloque: 'embudo_cierre' } }, { b: { id: 'a2', bloque: 'cobranza' } }];
  const hojaB = [{ b: { id: 'cobranza', bloque: 'revenue' } }, { b: { id: 'embudo_cierre', bloque: 'curva_vsl' } }];
  const a = repartirBloques(hojaA);
  const b = repartirBloques(hojaB);
  assert.deepEqual(a.salen.map((x) => x.b.id), ['a1']);
  assert.deepEqual(a.noSalen.map((x) => x.b.id), ['a2'], '«A quién cobrarle» no se lee');
  assert.deepEqual(b.salen.map((x) => x.b.id), ['embudo_cierre'], 'un id que se llama como un bloque permitido no lo abre');
  assert.deepEqual(b.noSalen.map((x) => x.b.id), ['cobranza'], 'Revenue no sale, aunque su id diga otra cosa');
});

test('lo que sale de un bloque permitido: los factores sin los ejemplos, los proyectos de cliente en alias', () => {
  const fac = BLOQUES_COMPARTIBLES.factores_cierre({ ganadas: 2, dimensiones: [{ dimension: 'Rapport', brillo: [{ id: 9 }], falto: [{ id: 8 }] }] }) as { ganadas: number; dimensiones: Array<{ brillo: unknown[]; falto: unknown[] }> };
  assert.deepEqual([fac.dimensiones[0].brillo, fac.dimensiones[0].falto], [[], []], 'cada ejemplo abre la ficha de una llamada');
  assert.equal(fac.ganadas, 2);
  const mat = BLOQUES_COMPARTIBLES.matriz_proyectos({ proyectos: [{ id: 'p1', nombre: 'Cliente: Ana Gómez' }, { id: 'p2', nombre: 'Landing' }] }) as { proyectos: Array<{ nombre: string }> };
  assert.notEqual(mat.proyectos[0].nombre, 'Cliente: Ana Gómez', 'un proyecto de cliente nombra al cliente');
  assert.equal(mat.proyectos[1].nombre, 'Landing');
  assert.equal(BLOQUES_COMPARTIBLES.factores_cierre(null), null, 'un payload raro pasa tal cual (lo descarta la pantalla)');
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
