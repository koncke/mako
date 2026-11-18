// =============================================================================
// La TOPOLOGÍA del grafo del negocio, medida sobre el armado de verdad (F109, 18/11/2026)
// =============================================================================
// Hasta este día no había ningún test que mirara la forma del grafo que se dibuja: todo vivía adentro de
// `construirCerebro` (lib/cerebro-grafo.ts, con `server-only`), así que las métricas de scripts/medir-grafo.mjs sólo se
// podían sacar del HTML renderizado de una pantalla de producción. Las reglas de forma escritas en el armado («las
// etapas de nutrición no se cuelgan de su área: el hub pasa de 4,5×», «los padres nunca se cuelgan de la raíz», «un solo
// componente») eran comentarios: nada se ponía rojo si alguien las deshacía. Ahora el armado es puro
// (lib/cerebro-armado.ts → `armarCerebro`) y este test le pasa las lecturas de un negocio completo y de uno recién
// creado, en las cuatro plantillas de funnel, y mide:
//   · UNA sola componente siempre (AGENTS.md → «NINGÚN CEREBRO SE DIVIDE EN DOS»), también en el negocio vacío;
//   · en el negocio completo, los umbrales de Obsidian de scripts/medir-grafo.mjs: densidad ≥ 1,5 aristas por nodo,
//     hojas (grado 1) ≤ 30 %, hub (grado máximo / grado medio) ≤ 4,5× y clustering ≥ 0,15.
// Y lo que cambió el mismo día en el armado:
//   · F108: los campos del brief salen del ESQUEMA VIVO (un campo nuevo creado con «+ Campo» aparece como nodo);
//   · F82: la meta sale de `objectives` (los nodos `okr:`): ya no hay un nodo `objetivo` de los settings viejos.
//
// Probado rompiéndolo (18/11/2026): el resultado de cada rotura está al pie del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { armarCerebro, camposDelBrief, type GrupoBrief, type LecturasCerebro } from '../lib/cerebro-armado';
import { LECTURAS_VACIAS, type LecturasVivas } from '../lib/cerebro-vivo';
import { componentes } from '../lib/cerebro-union';
import { buildFunnel } from '../lib/funnel-fila';
import { FUNNEL_TEMPLATES } from '../lib/pipeline';
import { PERSONALIDAD_PREGUNTAS } from '../lib/personalidad';
import type { AristaCerebro, NodoCerebro } from '../lib/cerebro-modelo';

// ── El esquema del brief, con las claves de DEFAULT_SCHEMA (lib/onboarding.ts lleva `server-only`) ─────────────────
const ESQUEMA: GrupoBrief[] = [
  { key: 'negocio', fields: ['negocio_que_hace', 'negocio_objetivo', 'negocio_freno'].map((key) => ({ key, label: `¿${key}?` })) },
  { key: 'oferta', fields: ['oferta_nombre', 'oferta_ticket', 'oferta_promesa', 'oferta_incluye', 'oferta_garantia'].map((key) => ({ key, label: `¿${key}?` })) },
  { key: 'avatar', fields: ['avatar_quien', 'avatar_dolor', 'avatar_deseo', 'avatar_objecion', 'avatar_nicho'].map((key) => ({ key, label: `¿${key}?` })) },
  { key: 'marca', fields: ['marca_nombre', 'marca_tono', 'marca_valores', 'marca_no', 'marca_frase'].map((key) => ({ key, label: `¿${key}?` })) },
];
const deClaves = (claves: string[]) => Object.fromEntries(claves.map((k) => [k, `Lo que dice ${k}`]));

function funnelDe(plantilla: string) {
  const t = FUNNEL_TEMPLATES.find((x) => x.id === plantilla);
  assert.ok(t, `no existe la plantilla «${plantilla}»`);
  return buildFunnel(t.pipeline, t.suppressed ?? []);
}

/** Lo vivo de un negocio en marcha: una oferta con dos productos, un funnel, leads, clientes, dos OKR con sus KPI. */
function vivoCompleto(): LecturasVivas {
  return {
    ...LECTURAS_VACIAS,
    ofertas: [{
      id: 1, nombre: 'Mentoría de 12 semanas', precio_usd: 1500, modelo: 'unico', precio_nota: null, promesa: 'Tu primer cliente en 30 días.',
      incluye: 'Sesiones semanales', garantia: '30 días', para_quien: 'Coaches', bonos: [{ nombre: 'Plantillas' }], es_principal: true, activa: true, origen: 'offer',
    }],
    ligasProducto: [{ oferta_id: 1, producto_id: 10, rol: 'principal' }, { oferta_id: 1, producto_id: 11, rol: 'bump' }],
    ligasFunnel: [{ funnel_id: 7, oferta_id: 1, es_principal: true }],
    leadMagnets: [{ id: 3, oferta_id: 1, nombre: 'Checklist de arranque', tipo: 'pdf', que_es: 'Diez pasos.', fomo: 'Bájalo hoy', enlace: null }],
    funnels: [{ id: 7, nombre: 'Funnel principal', canal: 'llamadas', esDefault: true }],
    leads: { total: 40, nuevos7d: 6, sinAsignar: 2, porEtapa: [], origenes: [{ origen: 'meta', leads: 30 }] },
    objetivos: [
      { id: 'o1', titulo: 'Cierres del trimestre', metrica: 'cierres', metaValor: 12, unidad: 'cantidad', quarter: 4, anio: 2026, funnelIds: [] },
      { id: 'o2', titulo: 'Facturación del trimestre', metrica: 'cash_usd', metaValor: 30000, unidad: 'usd', quarter: 4, anio: 2026, funnelIds: [7] },
    ],
    kpis: [
      { id: 'k1', nombre: 'Llamadas agendadas', objectiveId: 'o1', compromiso: 10, unidad: 'cantidad', cadencia: 'semanal', funnelIds: [] },
      { id: 'k2', nombre: 'Cobrado', objectiveId: 'o2', compromiso: 2500, unidad: 'usd', cadencia: 'semanal', funnelIds: [7] },
    ],
    clientes: { total: 5, recientes: [1, 2, 3].map((i) => ({ leadId: 100 + i, nombre: `Cliente ${i}`, empresa: null, fechaCierre: '2026-11-01', sinCobro: false })) },
    reuniones: [{ id: 9, leadId: 101, leadNombre: 'Cliente 1', titulo: null, fecha: '2026-10-30', tipo: 'R1', closer: 'Ana', score: 8, outcome: 'ganada', resumen: 'Cerró.', duracionMin: 40 }],
    fechas: {},
  };
}

/** Un negocio con todo lo que el grafo sabe leer. */
function completo(plantilla: string): LecturasCerebro {
  const funnel = funnelDe(plantilla);
  const respuestas = Object.fromEntries(PERSONALIDAD_PREGUNTAS.slice(0, 6).map((q) => [q.key, { rasgo: 'directo', texto: 'Te digo la verdad.' }]));
  return {
    schema: ESQUEMA,
    schemaPorDefecto: ESQUEMA,
    diag: { fase: 1, canal: 'llamadas' },
    // Los campos del brief salen, como en un negocio real, de los documentos del Archivero; dos los corrigió a mano.
    files: [
      { id: 'd1', nombre: 'Guion de ventas.pdf', campos: deClaves(['oferta_nombre', 'oferta_promesa', 'oferta_incluye', 'oferta_garantia', 'avatar_objecion']), razonamiento: 'Es el guion de la llamada.' },
      { id: 'd2', nombre: 'Presentación.pdf', campos: deClaves(['negocio_que_hace', 'oferta_ticket', 'avatar_quien', 'avatar_dolor', 'avatar_deseo', 'avatar_nicho']), razonamiento: 'La presentación del programa.' },
      { id: 'd3', nombre: 'Manual de marca.pdf', campos: deClaves(['marca_nombre', 'marca_tono', 'marca_valores', 'marca_no', 'marca_frase']), razonamiento: 'Cómo habla la marca.' },
    ],
    manual: deClaves(['negocio_objetivo', 'negocio_freno']),
    panorama: [
      '# IDENTIDAD Y POSICIONAMIENTO', 'Mentoría para coaches que arrancan.',
      '# OFERTA Y PRECIOS', 'Un programa de 12 semanas a USD 1.500.',
      '# AVATAR Y CLIENTE IDEAL', 'Coaches con su primer año.',
      '# NICHO Y MERCADO', 'Coaching de negocios.',
      '# TONO Y VOZ DE MARCA', 'Directo y cálido.',
    ].join('\n'),
    productos: [
      { id: 10, nombre: 'Mentoría', tipo: 'unico', monto_usd: 1500, suscripcion_meses: null, promesa: 'Doce semanas.', incluye: 'Sesiones', garantia: '30 días', activo: true },
      { id: 11, nombre: 'Auditoría', tipo: 'unico', monto_usd: 300, suscripcion_meses: null, promesa: 'Una revisión.', incluye: null, garantia: null, activo: true },
      { id: 12, nombre: 'Comunidad', tipo: 'suscripcion', monto_usd: 50, suscripcion_meses: null, promesa: 'El grupo.', incluye: null, garantia: null, activo: true },
    ],
    entregables: [{ id: 'e1', nombre: 'Plan de 30 días', queEs: 'Un plan', fomo: 'Pídelo hoy' }],
    avatares: [
      { id: 'a1', nombre: 'Coach que arranca', segmento: 'Primer año', dolor: 'No tiene clientes', senalesMeta: 'Intereses: coaching' },
      { id: 'a2', nombre: 'Coach estancado', segmento: 'Factura poco', dolor: 'No escala', senalesMeta: 'Intereses: negocios' },
    ],
    razones: [
      { id: 'r1', avatarId: 'a1', nombre: 'Quiere su primer cliente', descripcion: 'x', copy: 'Tu primer cliente', anguloImagen: 'comparacion', anguloVideo: 'hook-problema' },
      { id: 'r2', avatarId: 'a1', nombre: 'Tiene miedo de vender', descripcion: 'x', copy: 'Vender sin miedo', anguloImagen: 'antes-despues', anguloVideo: 'testimonio-hablado' },
      { id: 'r3', avatarId: 'a2', nombre: 'Quiere escalar', descripcion: 'x', copy: 'Escala', anguloImagen: 'comparacion', anguloVideo: 'demo-walkthrough' },
      { id: 'r4', avatarId: 'a2', nombre: 'No tiene tiempo', descripcion: 'x', copy: 'Más tiempo', anguloImagen: 'checklist', anguloVideo: 'hook-problema' },
    ],
    persona: { descripcion: 'Mujer de 35, sonrisa fácil.', fotos: [{}] },
    personalidad: { respuestas, muletillas: 'Te soy sincera' },
    funnel,
    secuencias: [{ clave: 'bienvenida', nombre: 'Bienvenida', etapa: funnel.pipeline[0].key, pasos: [{}, {}, {}] }],
    landings: [{ url: 'https://ejemplo.test/landing', titulo: 'La landing', score: 7, veredicto: 'Bien', resumen: 'Clara.', promesa: 'Tu primer cliente', avatar: 'Coaches' }],
    audios: [{ id: 1, titulo: 'Saludo', duracion_s: 20 }, { id: 2, titulo: 'Seguimiento', duracion_s: 35 }],
    vozManual: { tono: 'Directo' },
    vozEvidencia: { convsConVenta: 4 },
    glosario: [
      { titulo: 'Cliente semilla', activo: true, area: 'glosario', categoria: null },
      { titulo: 'Ruta de 30 días', activo: true, area: 'glosario', categoria: null },
    ],
    vivo: vivoCompleto(),
    kitsCrudo: { kits: [{ id: 'k1', nombre: 'Principal', colores: [{ hex: '#112233' }], fuentes: { titulos: 'Inter' } }] },
  };
}

/** Un negocio recién creado: el diagnóstico y nada más. */
function recienCreado(plantilla: string): LecturasCerebro {
  return {
    schema: ESQUEMA, schemaPorDefecto: ESQUEMA, diag: { fase: 0, canal: 'llamadas' }, files: [], manual: {}, panorama: '',
    productos: [], entregables: [], avatares: [], razones: [], persona: { descripcion: '', fotos: [] },
    personalidad: { respuestas: {}, muletillas: '' }, funnel: funnelDe(plantilla), secuencias: [], landings: [], audios: [],
    vozManual: null, vozEvidencia: null, glosario: [], vivo: LECTURAS_VACIAS, kitsCrudo: null,
  };
}

// ── Las métricas de scripts/medir-grafo.mjs, sobre los nodos y las aristas (sin el SVG) ────────────────────────────
function medir(nodos: NodoCerebro[], aristas: AristaCerebro[]) {
  const ids = new Set(nodos.map((n) => n.id));
  const pares = aristas.filter((a) => a.de !== a.a && ids.has(a.de) && ids.has(a.a));
  const grado = new Map(nodos.map((n) => [n.id, 0]));
  const ady = new Map(nodos.map((n) => [n.id, new Set<string>()]));
  for (const a of pares) {
    grado.set(a.de, grado.get(a.de)! + 1); grado.set(a.a, grado.get(a.a)! + 1);
    ady.get(a.de)!.add(a.a); ady.get(a.a)!.add(a.de);
  }
  const g = [...grado.values()];
  const gMedio = (2 * pares.length) / nodos.length;
  let suma = 0, con = 0;
  for (const vec of ady.values()) {
    const d = vec.size;
    if (d < 2) continue;
    const arr = [...vec];
    let enlaces = 0;
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (ady.get(arr[i])!.has(arr[j])) enlaces++;
    suma += (2 * enlaces) / (d * (d - 1)); con++;
  }
  const mayores = [...grado.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, d]) => `${id} (${d})`).join(', ');
  return {
    n: nodos.length,
    mayores,
    densidad: pares.length / nodos.length,
    hojas: g.filter((x) => x === 1).length / nodos.length,
    hub: Math.max(...g) / gMedio,
    clustering: con ? suma / con : 0,
    componentes: componentes(nodos, aristas).length,
  };
}

const PLANTILLAS = ['highticket', 'simple', 'directa', 'vsl'] as const;
const fmt = (n: number) => n.toFixed(2);

test('un negocio completo pasa los umbrales de Obsidian en las cuatro plantillas de funnel', () => {
  for (const p of PLANTILLAS) {
    const { nodos, aristas } = armarCerebro(completo(p));
    const m = medir(nodos, aristas);
    const que = `«${p}» (${m.n} nodos)`;
    assert.equal(m.componentes, 1, `${que}: el cerebro se partió en ${m.componentes}`);
    assert.ok(m.densidad >= 1.5, `${que}: densidad ${fmt(m.densidad)} aristas por nodo, el piso es 1,5`);
    assert.ok(m.hojas <= 0.3, `${que}: ${fmt(m.hojas * 100)} % de hojas, el techo es 30 %`);
    assert.ok(m.hub <= 4.5, `${que}: hub ${fmt(m.hub)}×, el techo es 4,5× (los más conectados: ${m.mayores})`);
    assert.ok(m.clustering >= 0.15, `${que}: clustering ${fmt(m.clustering)}, el piso es 0,15`);
  }
});

test('un negocio recién creado es UN solo cerebro, desde la raíz se llega a todo', () => {
  for (const p of PLANTILLAS) {
    const { nodos, aristas } = armarCerebro(recienCreado(p));
    assert.ok(nodos.length > 3, `«${p}»: el negocio recién creado no armó nada (${nodos.length} nodos)`);
    assert.equal(medir(nodos, aristas).componentes, 1, `«${p}»: el cerebro recién creado se partió`);
    assert.equal(nodos.filter((n) => n.id === 'raiz').length, 1);
  }
});

test('la excepción «sólo la fila Activo»: las etapas de nutrición no cuelgan del nodo de área del funnel', () => {
  // El armado lo explica (lib/cerebro-armado.ts, «Y UNA EXCEPCIÓN, medida»): colgarlas todas le llevaba el hub a 6,1× en el
  // negocio más chico. Medido el 18/11/2026 con el armado de hoy, rompiéndola el hub de un negocio sin documentos queda en
  // 3,7× (el funnel principal y los leads ya reparten el racimo), así que el umbral solo ya no la cuida: se fija directo.
  for (const p of PLANTILLAS) {
    const lect = completo(p);
    const { aristas } = armarCerebro(lect);
    const nutricion = lect.funnel.stages.filter((e) => e.band !== 'pipeline').map((e) => `etapa:${e.key}`);
    const activas = lect.funnel.stages.filter((e) => e.band === 'pipeline').map((e) => `etapa:${e.key}`);
    const alArea = new Set(aristas.filter((a) => a.a === 'area:funnel').map((a) => a.de));
    assert.deepEqual(nutricion.filter((id) => alArea.has(id)), [], `«${p}»: una etapa de nutrición cuelga del nodo de área`);
    assert.ok(activas.some((id) => alArea.has(id)), `«${p}»: la fila Activo no cuelga de su área (el racimo se deshizo)`);
  }
});

test('F108: los campos del brief salen del esquema VIVO, por grupo; un campo nuevo aparece en el grafo', () => {
  const base = completo('highticket');
  const conCampoNuevo: GrupoBrief[] = [
    ...ESQUEMA.map((g) => (g.key === 'oferta' ? { ...g, fields: [...g.fields, { key: 'campo_ab12cd', label: '¿Cuánto dura la entrega?' }] } : g)),
    { key: 'grupo_x9', label: 'Equipo', fields: [{ key: 'campo_zz11', label: '¿Quién atiende?' }] },
  ];
  const c = armarCerebro({ ...base, schema: conCampoNuevo, manual: { ...base.manual, campo_ab12cd: '12 semanas', campo_zz11: 'Ana y Luis' } });
  const nuevo = c.nodos.find((n) => n.id === 'campo:campo_ab12cd');
  assert.ok(nuevo, 'un campo creado con «+ Campo» en un grupo conocido no apareció');
  assert.equal(nuevo.area, 'oferta', 'el campo nuevo va al área de su grupo');
  assert.equal(nuevo.etiqueta, 'Cuánto dura la entrega', 'su nombre sale de su pregunta (sin signos)');
  assert.equal(c.nodos.find((n) => n.id === 'campo:campo_zz11')?.area, 'panorama', 'un grupo nuevo cae en el Resumen del negocio');
  assert.equal(medir(c.nodos, c.aristas).componentes, 1);

  // La raíz no es además un campo, y un campo del esquema de fábrica que el vivo no tiene se sigue recorriendo.
  const sinNegocio = camposDelBrief(ESQUEMA.filter((g) => g.key !== 'negocio'), ESQUEMA);
  assert.ok(!sinNegocio.some((x) => x.key === 'negocio_que_hace'), 'la raíz se dibujó también como campo');
  assert.deepEqual(sinNegocio.filter((x) => x.key.startsWith('negocio_')).map((x) => [x.key, x.area]),
    [['negocio_objetivo', 'norte'], ['negocio_freno', 'norte']], 'un esquema guardado antes de un campo de fábrica lo perdía');
  // Una clave que se mudó de grupo en el vivo va al área de su grupo nuevo, y no se dibuja dos veces.
  const mudado: GrupoBrief[] = [{ key: 'marca', fields: [{ key: 'oferta_garantia', label: '¿Garantía?' }] }];
  const r = camposDelBrief(mudado, ESQUEMA);
  assert.equal(r.filter((x) => x.key === 'oferta_garantia').length, 1);
  assert.equal(r.find((x) => x.key === 'oferta_garantia')?.area, 'voz');
  // Con el esquema de fábrica, el reparto de siempre.
  const deSiempre = camposDelBrief(ESQUEMA, ESQUEMA);
  assert.equal(deSiempre.length, 17);
  assert.deepEqual([...new Set(deSiempre.map((x) => x.area))], ['norte', 'oferta', 'cliente', 'voz']);
});

test('F82: la meta sale de `objectives`; ya no hay un nodo `objetivo` de los settings viejos', () => {
  const c = armarCerebro(completo('highticket'));
  assert.ok(!c.nodos.some((n) => n.id === 'objetivo'), 'volvió el nodo de los settings viejos');
  const cierre = c.nodos.find((n) => n.id.startsWith('etapa:') && n.id === 'etapa:ganado');
  assert.ok(cierre, 'el funnel de prueba no tiene la etapa de cierre');
  assert.ok(c.aristas.some((a) => a.de === 'okr:o1' && a.a === 'etapa:ganado'), 'el objetivo de CIERRES no se engancha con la etapa de cierre');
  assert.ok(!c.aristas.some((a) => a.de === 'okr:o2' && a.a === 'etapa:ganado'), 'el de facturación no cuenta cierres');
  assert.ok(c.aristas.some((a) => a.de === 'okr:o2' && a.a === 'funnel:7'), 'el de facturación cuenta su funnel');
});

// ── Probado rompiéndolo (18/11/2026) ──────────────────────────────────────────────────────────────────────────────
// Cada cambio aplicado a lib/cerebro-armado.ts o lib/cerebro-vivo.ts con un script que cambia, corre y restaura de
// memoria. Base 5 pasan / 0 fallan → con la rotura (pasan / fallan):
//   R1. sin `aristas.push(...puentesARaiz(nodos, aristas, RAIZ))`                              → 3 / 2 (el completo y el recién creado)
//   R2. las etapas de nutrición colgadas de su área (sin `nutricionDelFunnel.has(n.id) ||`)   → 4 / 1 (la excepción)
//   R3. los padres del nivel 1 colgados además de la raíz                                     → 4 / 1 (el hub del completo)
//   R4. `camposDelBrief` sin el esquema vivo (sólo `porDefecto`)                               → 4 / 1 (F108)
//   R5. el OKR de cierres sin su arista a la etapa de cierre                                   → 4 / 1 (F82)
//   R6. el nodo `objetivo` de vuelta                                                          → 4 / 1 (F82)
// Y lo que NO caza: el negocio completo arma ~90 nodos con hub 3,8-4,1×; un negocio con los 13 campos del brief cargados
// A MANO (cada uno cuelga de la raíz) llega a 6,9× con el armado de hoy. Está anotado en docs/hallazgos-second-brain.md.
