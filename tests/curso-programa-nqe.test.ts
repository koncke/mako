// =============================================================================
// curso-programa-nqe — el programa de Mauricio como curso (lib/curso-programa-nqe.ts)
// =============================================================================
// Lo que se carga en curso_clases del ws1 con scripts/curso-cargar-programa.ts. El test EJECUTA
// la semilla (no lee el fuente): lo que mira es exactamente lo que el cargador inserta.
//
// Probado ROMPIÉNDOLO (06/10/2026) con un arnés que muta lib/curso-programa-nqe.ts de a una
// regla y lo restaura DE MEMORIA. Sobre 11 tests:
//   · la obligatoria en la PRIMERA Demostración, no la última   → 10 / 1, cae «una obligatoria…»
//   · un campo con `origen` adentro (sin pasar por sinOrigen)    → 10 / 1, cae «los campos…»
//   · un `atoro` agregado a un formulario                         → 10 / 1, cae «nada del guion…»
//   · «Mauricio» en una ayuda                                     → 10 / 1, cae «nada del guion…»
//   · «Completá» en una tarea                                     → 10 / 1, cae «ni voseo…»
//   · un em dash en un objetivo                                   → 10 / 1, cae «ni voseo…»
//   · `PASO_ORDEN` en 1 (sin hueco)                               → 10 / 1, cae «origen único…»
//   · sin el 0.1 (re-anclando m0c1 para aislarlo)                 →  9 / 2, caen «las 63…» y «determinista»
//   · el 7.2 sin su excepción (re-anclando m8c1 para aislarlo)    →  9 / 2, caen «el reparto…» y «detrás del video…»
//   · el 7.2 sin su excepción, sin re-anclar                      →  3 / 8, la semilla TIRA: m8c1 → palancas/7.2
//   · m6c4 colgado del 5.3 (otra etapa)                           →  3 / 8, la semilla TIRA y lo nombra

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { programaNqe, ETAPAS_NQE, CURSO_NQE, type ClaseSemilla } from '../lib/curso-programa-nqe';
import { sanearCampos, etapaCompleta } from '../lib/curso';

// Si la semilla TIRA (un formulario anclado a un video que no está en su etapa), se ve en el
// primer test con su motivo; sin esto el archivo entero muere al importarse sin decir cuál.
let errorAlArmar: unknown = null;
const P: ClaseSemilla[] = (() => { try { return programaNqe(); } catch (e) { errorAlArmar = e; return []; } })();
const videos = P.filter((c) => /^planilla:\d+\.\d+$/.test(c.origen));
const formularios = P.filter((c) => c.origen.startsWith('catalogo:'));
const numero = (c: ClaseSemilla) => c.origen.slice('planilla:'.length);
const fase = (c: ClaseSemilla) => Number(numero(c).split('.')[0]);

/** Todo lo que lee el CLIENTE de una clase. */
const textosDe = (c: ClaseSemilla): string[] => [
  c.titulo, c.descripcion, c.tarea,
  ...c.campos.flatMap((f) => [f.label, f.ayuda ?? '', ...(f.opciones ?? []), ...(f.columnas ?? []), ...(f.filasFijas ?? [])]),
].filter(Boolean);
const sinAcentos = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const palabras = (t: string) => [...t.matchAll(/\p{L}+/gu)].map((m) => m[0]);

test('la semilla se arma: ningún formulario cuelga de un video de otra etapa', () => {
  if (errorAlArmar) throw errorAlArmar;
});

test('las 63 clases de la planilla, una por video, con sus minutos y su tarea', () => {
  assert.equal(videos.length, 63);
  // Por fase, contando el 0.1 que la planilla pegó debajo de sus totales (por eso dice 62/351).
  const porFase = new Map<number, number>();
  for (const v of videos) porFase.set(fase(v), (porFase.get(fase(v)) ?? 0) + 1);
  assert.deepEqual(Object.fromEntries(porFase), { 0: 7, 1: 6, 2: 4, 3: 3, 4: 5, 5: 6, 6: 5, 7: 6, 8: 7, 9: 7, 10: 4, 11: 3 });
  assert.equal(videos.reduce((n, v) => n + (v.minutos ?? 0), 0), 356);
  for (const v of videos) {
    assert.ok(['concepto', 'demostracion', 'clinica'].includes(v.tipo), `${v.origen}: tipo ${v.tipo}`);
    // «Todo video termina en una instrucción de llenado»: sin tarea no hay video.
    assert.ok(v.tarea.trim().length > 0, `${v.origen} sin tarea`);
    assert.ok(v.descripcion.includes('\n• '), `${v.origen}: la descripción no trae los puntos`);
    assert.equal(v.video_tipo, 'ninguno');
    assert.deepEqual(v.campos, []);
  }
});

test('el reparto en las 9 etapas de la entrega (el 7.2 va a palancas)', () => {
  assert.deepEqual([...ETAPAS_NQE], ['bienvenida', 'contexto', 'pas', 'norte', 'criterio', 'palancas', 'tablero', 'ritmo', 'instalado']);
  assert.deepEqual({ ws: CURSO_NQE.workspaceId, producto: CURSO_NQE.productoId }, { ws: 1, producto: 1 });
  const esperado = (c: ClaseSemilla): string => {
    if (numero(c) === '7.2') return 'palancas';
    return ['bienvenida', 'contexto', 'contexto', 'norte', 'norte', 'criterio', 'palancas', 'tablero', 'ritmo', 'pas', 'instalado', 'instalado'][fase(c)];
  };
  for (const v of videos) assert.equal(v.etapa, esperado(v), `${v.origen}`);
  for (const e of ETAPAS_NQE) assert.ok(P.some((c) => c.etapa === e), `la etapa ${e} quedó vacía`);
});

test('una obligatoria por etapa, y es su ÚLTIMA Demostración (la regla «Secuencia» de la planilla)', () => {
  const cierres: Record<string, string> = {};
  for (const e of ETAPAS_NQE) {
    const cs = P.filter((c) => c.etapa === e);
    const ob = cs.filter((c) => c.obligatoria);
    assert.equal(ob.length, 1, `${e}: ${ob.length} obligatorias`);
    assert.equal(ob[0].tipo, 'demostracion');
    const ultimaD = cs.filter((c) => c.tipo === 'demostracion').sort((a, b) => b.orden - a.orden)[0];
    assert.equal(ob[0].origen, ultimaD.origen, `${e}: la obligatoria no es la última Demostración`);
    cierres[e] = numero(ob[0]);

    // Y la regla de lib/curso.ts la reconoce: con la obligatoria enviada la etapa cierra, con
    // todo lo demás enviado y ella no, no cierra.
    const ids = new Map(cs.map((c, i) => [c, i + 1]));
    const conId = cs.map((c) => ({ ...c, id: ids.get(c)! }));
    const idOb = ids.get(ob[0])!;
    assert.equal(etapaCompleta(conId, (id) => (id === idOb ? 'enviada' : undefined)), true, e);
    assert.equal(etapaCompleta(conId, (id) => (id === idOb ? undefined : 'enviada')), false, e);
  }
  assert.deepEqual(cierres, {
    bienvenida: '0.6', contexto: '2.3', pas: '9.5', norte: '4.4', criterio: '5.5',
    palancas: '6.4', tablero: '7.5', ritmo: '8.5', instalado: '11.2',
  });
});

test('los 43 formularios del catálogo: con campos, sin obligatoria y detrás de un video de su etapa', () => {
  assert.equal(formularios.length, 43);
  // m0c2 queda afuera a propósito (el relevo no lo reparte): ver la cabecera de los formularios.
  assert.ok(!formularios.some((f) => f.origen === 'catalogo:m0c2'));
  for (const f of formularios) {
    assert.equal(f.tipo, 'formulario');
    assert.ok(f.campos.length > 0, `${f.origen} sin campos`);
    assert.equal(f.obligatoria, false, `${f.origen}: un formulario no cierra la etapa`);
    assert.equal(f.descripcion, '', `${f.origen}: un formulario no trae texto del video viejo`);
    assert.equal(f.minutos, null);
  }
  // La logística, arriba de todo y sin tarea.
  const primera = P.find((c) => c.etapa === 'bienvenida')!;
  assert.deepEqual([primera.origen, primera.tipo, primera.tarea], ['planilla:logistica', 'clase', '']);
  assert.match(primera.descripcion, /^Martes: [\s\S]*\nJueves: /);
});

test('los campos se guardan tal cual: sanearCampos no les cambia nada', () => {
  let total = 0;
  for (const c of P) {
    total += c.campos.length;
    assert.deepStrictEqual(sanearCampos(c.campos), c.campos, `${c.origen}: sanearCampos lo modifica`);
    for (const f of c.campos) assert.ok(!('origen' in f), `${c.origen}/${f.id}: el origen no va a la base`);
  }
  // 114 del catálogo menos los 3 de m0c2.
  assert.equal(total, 111);
});

test('nada del guion viejo ni de otros clientes en lo que lee el cliente', () => {
  const PROHIBIDAS = new Set(['graba', 'puntos', 'atoro', 'mismoVideoQue']);
  const claves = (o: unknown, out: string[] = []): string[] => {
    if (Array.isArray(o)) o.forEach((x) => claves(x, out));
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.push(k); claves(v, out); }
    return out;
  };
  assert.deepEqual(claves(P).filter((k) => PROHIBIDAS.has(k)), []);

  // Los nombres que el catálogo viejo traía en sus guiones (TEXX, HMO, Baja Teriyaki, Patricia,
  // Esquer) y la gente real del producto. Ya están en el repo: el guard caza LOS CONOCIDOS.
  const REALES = [
    'Mauricio', 'Mau', 'Bustos', 'Leila', 'Martín', 'Joan', 'Juan Francisco', 'Código Inmobiliario',
    'MasteryHaus', 'Vértice', 'AvatarHype', 'HMO', 'Esquer', 'TEXX', 'Baja Teriyaki', 'Patricia',
  ];
  const malos: string[] = [];
  for (const c of P) {
    for (const t of textosDe(c)) {
      const llano = ` ${palabras(sinAcentos(t)).join(' ')} `;
      for (const r of REALES) if (llano.includes(` ${palabras(sinAcentos(r)).join(' ')} `)) malos.push(`${c.origen}: «${r}» en «${t.slice(0, 80)}»`);
    }
  }
  assert.deepEqual(malos, []);
});

test('ni voseo ni regionalismos: lo leen clientes mexicanos', () => {
  // ⚠️ Lista BLANCA a propósito. El voseo se reconoce por la FORMA (completá, escribí, tenés):
  // palabras que terminan en vocal acentuada. Las que se usan hoy están revisadas una por una;
  // una nueva falla acá hasta que alguien la mire y la sume. Una lista NEGRA a mano cubre lo
  // que ya se escribió y nunca el verbo que todavía no usó nadie (AGENTS.md, «La voz de MaKo»).
  const NEUTRAS = new Set([
    'qué', 'más', 'está', 'estás', 'esté', 'sí', 'aquí', 'allá', 'ahí', 'sé', 'así', 'después',
    'además', 'demás', 'deberá', 'tendrá', 'harás', 'seguirá', 'dirá',
  ]);
  const REGIONAL = new Set(['vos', 'sos', 'acá', 'plata', 'laburo', 'che', 'boludo']);
  const malos: string[] = [];
  for (const c of P) {
    for (const t of textosDe(c)) {
      for (const w of palabras(t).map((x) => x.toLowerCase())) {
        if (REGIONAL.has(w)) malos.push(`${c.origen}: «${w}»`);
        else if (/[áéí]s?$/.test(w) && !NEUTRAS.has(w)) malos.push(`${c.origen}: «${w}» (¿voseo?)`);
      }
      // «Sin em dash» es regla de marca de Mauricio (hoja Reglas de diseño, «Marca y lenguaje»).
      if (t.includes('—')) malos.push(`${c.origen}: em dash en «${t.slice(0, 60)}»`);
    }
  }
  assert.deepEqual(malos, []);
});

test('origen único y orden creciente con hueco dentro de cada etapa', () => {
  assert.equal(new Set(P.map((c) => c.origen)).size, P.length);
  for (const e of ETAPAS_NQE) {
    const ordenes = P.filter((c) => c.etapa === e).map((c) => c.orden);
    for (let i = 1; i < ordenes.length; i++) assert.ok(ordenes[i] > ordenes[i - 1] + 1, `${e}: ${ordenes.join(',')}`);
  }
});

test('la semilla es determinista (el cargador cuenta lo que salta contra la base)', () => {
  assert.deepStrictEqual(programaNqe(), P);
  assert.equal(P.length, 63 + 43 + 1);
});

test('cada formulario va detrás del video que llena el mismo bloque, nunca abre una etapa', () => {
  for (const e of ETAPAS_NQE) {
    const cs = P.filter((c) => c.etapa === e);
    assert.notEqual(cs[0].tipo, 'formulario', `${e} arranca con un formulario`);
  }
  // Los anclajes que no son una inferencia de forma: la tabla D2 detrás del 5.3, la ficha de
  // nueve campos detrás del 6.3, los umbrales detrás del 7.2, el 20% detrás del 8.7.
  const antes = (origen: string) => { const i = P.findIndex((c) => c.origen === origen); return P[i - 1]?.origen; };
  assert.equal(antes('catalogo:m2c2'), 'planilla:5.3');
  assert.equal(antes('catalogo:m6c4'), 'planilla:6.3');
  assert.equal(antes('catalogo:m8c1'), 'planilla:7.2');
  assert.equal(antes('catalogo:m10c3'), 'planilla:8.7');
});
