// =============================================================================
// Los TIPOS de «Nuevo CRM»: cada uno nace con etapas que el tablero sabe dónde poner
// =============================================================================
// Pedido de Martín (14/10/2026, §2 de docs/diseno-ficha-bloques.md): los tipos que faltaban
// —DM funnel, Instagram orgánico, LinkedIn, YouTube, recurso gratis, dos reuniones y anuncio con
// formulario de Meta— más los de siempre, cada uno como canal + entrada + etapas renombradas.
//
// Lo que se fija acá, EJECUTANDO cada tipo:
//   · sus etapas usan claves que `deriveStageKey` conoce. Una clave nueva (`sesion`, `webinar`)
//     no falla en ningún lado: el lead con la fecha de su reunión deriva `agenda`, el tablero no
//     la encuentra y lo dibuja en la PRIMERA columna. Es la falla que tenía la plantilla `vsl`.
//   · la plantilla de ficha que le tocaría por la REGLA de la §4 es la de la tabla de la §2.
//   · «Otro, lo armo yo» siembra lo mismo que antes, y lo que no existe no cae a un default.
//
// Verificado rompiéndolo (14/10/2026, el archivo da 8 / 0):
//   · la R1 de `linkedin` con la clave `sesion`              → 7 / 1 (las claves)
//   · `recurso_gratis` con la entrada `chat_entrante`         → 7 / 1 (la §4: «te-escriben»)
//   · `siembraDeCrm` con un tipo inexistente cayendo a `llamada` → 7 / 1 (falla cerrado)
//   · `apagadasAlCrear` sin `suppressedInicial`               → 7 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPOS_CRM, TIPO_CRM_OTRO, siembraDeCrm, apagadasAlCrear, generateFunnel, suppressedInicial, templateDeCanal,
  tipoDeFunnel, fechaFijaDelEvento, MAX_LABEL_ETAPA, ENTRADAS_OFRECIDAS,
  type Stage, type StageDerivable, type TipoCrm, type TipoCrmId,
} from '../lib/pipeline';
import { etapaVigenteDe } from '../lib/funnel-etapas';
import { tieneEtapaDeReunion } from '../lib/etapa-reunion';
import { CANALES } from '../lib/fase-diagnostico';

const BASE: StageDerivable = {
  estado_lead: 'abierto', pipeline_stage: null, fecha_agenda: null, fecha_junta_1: null,
  fecha_junta_2: null, asistio_j1: null, asistio_j2: null, nutricion_realizada: false,
};

/**
 * Un lead que tendría que estar en la etapa `key` de este pipeline, armado con los DATOS que lo
 * llevan ahí (fechas, asistencias, estado) y no con un override, salvo donde no hay otra forma:
 * `conversando` se abre a mano (la abre una persona o MaKo), y `facturando` sin R2 también.
 * Una clave que no está acá es una que el cálculo de etapa no conoce: devuelve null.
 */
function leadEn(key: string, pipeline: readonly Stage[]): StageDerivable | null {
  const tieneR2 = pipeline.some((s) => s.key === 'agendaj2');
  switch (key) {
    case 'lead': return BASE;
    case 'agenda': return { ...BASE, fecha_agenda: '2026-10-10', fecha_junta_1: '2026-10-20' };
    case 'agendaj2': return { ...BASE, fecha_junta_1: '2026-10-10', asistio_j1: true, fecha_junta_2: '2026-10-20' };
    case 'facturando': return tieneR2
      ? { ...BASE, fecha_junta_1: '2026-10-10', asistio_j1: true, fecha_junta_2: '2026-10-20', asistio_j2: true }
      : { ...BASE, pipeline_stage: 'facturando' };
    case 'conversando': return { ...BASE, pipeline_stage: 'conversando' };
    case 'ganado': return { ...BASE, estado_lead: 'ganado' };
    default: return null;
  }
}

/** La columna del tablero: la etapa vigente si el funnel la tiene; si no, la PRIMERA (CrmBoard `effStage`). */
function columna(lead: StageDerivable, stages: readonly Stage[]): string {
  const k = etapaVigenteDe(lead, stages);
  return stages.some((s) => s.key === k) ? k : stages[0].key;
}

/**
 * La REGLA de la §4 de docs/diseno-ficha-bloques.md («Cómo se elige, sin preguntarte nada»),
 * escrita acá a propósito: la función que elige la plantilla es de otro frente (el armador de la
 * ficha), y lo que este test fija es que cada TIPO caiga donde dice la tabla de la §2. Cuando esa
 * función exista, este test puede llamarla a ella en vez de a esta copia.
 *   1. dos etapas de reunión → R1 y R2;
 *   2. una, con evento de fecha fija → Evento; una, sin evento → Una llamada;
 *   3. ninguna: la entrada (carrito, te escriben, tú les escribes, formulario de Meta, landing);
 *   4. nada → Respaldo.
 * Las reuniones se cuentan con la regla de la tab Reuniones (`tieneEtapaDeReunion`).
 */
function plantillaDeFicha(t: Pick<TipoCrm, 'pipeline' | 'canal' | 'entradas'>): string {
  const reuniones = t.pipeline.filter((e) => tieneEtapaDeReunion([e])).length;
  if (reuniones >= 2) return 'r1-r2';
  if (reuniones === 1) return fechaFijaDelEvento(t.canal) ? 'evento' : 'una-llamada';
  if (t.canal === 'carrito') return 'carrito';
  switch (tipoDeFunnel(t.entradas)?.id) {
    case 'anuncios_carrito': return 'carrito';
    case 'anuncios_whatsapp': return 'te-escriben';
    case 'prospeccion': return 'prospeccion';
    case 'anuncios_formulario': return 'formulario-meta';
    case 'anuncios_landing': return 'landing';
    default: return 'respaldo';
  }
}

/** La columna «Plantilla de ficha» de la tabla de la §2, para el caso con el que nace cada tipo. */
const FICHA_DE_LA_TABLA: Record<TipoCrmId, string> = {
  dos_reuniones: 'r1-r2',
  llamada: 'una-llamada',
  conversaciones: 'te-escriben',
  carrito: 'carrito',
  webinar: 'evento',
  presencial: 'evento',
  formulario_meta: 'formulario-meta',
  dm_funnel: 'te-escriben',
  instagram: 'te-escriben',
  linkedin: 'una-llamada',
  youtube: 'una-llamada',
  recurso_gratis: 'landing',
};

const tipo = (id: TipoCrmId): TipoCrm => TIPOS_CRM.find((t) => t.id === id)!;

test('están los doce tipos de la §2, cada uno con un canal y una entrada que existen', () => {
  assert.deepEqual(new Set(TIPOS_CRM.map((t) => t.id)), new Set(Object.keys(FICHA_DE_LA_TABLA)), 'los tipos no son los de la tabla');
  assert.equal(new Set(TIPOS_CRM.map((t) => t.id)).size, TIPOS_CRM.length, 'hay un tipo repetido');
  for (const t of TIPOS_CRM) {
    // Un tipo NO es un canal nuevo: combina uno de los cinco que ya existen.
    assert.ok(CANALES.some((c) => c.id === t.canal), `«${t.id}»: el canal «${t.canal}» no existe`);
    // Una sola entrada, como el «Tipo de funnel» del editor («que solo se pueda elegir 1 opción»).
    assert.equal(t.entradas.length, 1, `«${t.id}» trae ${t.entradas.length} entradas`);
    assert.ok(t.pipeline.length >= 3, `«${t.id}» no tiene etapas`);
    assert.equal(t.pipeline[0].kind, 'entrada', `«${t.id}» no arranca por la entrada`);
    assert.equal(t.pipeline[t.pipeline.length - 1].key, 'ganado', `«${t.id}» no termina en Ganado`);
  }
  // Los dos que «Nuevo CRM» no ofrecía y el editor sí: la plantilla de dos reuniones y el formulario de Meta.
  assert.equal(tipo('dos_reuniones').pipeline.filter((s) => s.kind === 'reunion').length, 2);
  assert.deepEqual(tipo('formulario_meta').entradas, ['formulario_anuncio']);
});

test('cada etapa de cada tipo usa una clave que el tablero sabe ubicar', () => {
  for (const t of TIPOS_CRM) {
    const { stages } = generateFunnel(t.pipeline, apagadasAlCrear(t.pipeline, t.suppressed));
    for (const etapa of t.pipeline) {
      const lead = leadEn(etapa.key, t.pipeline);
      assert.ok(lead, `«${t.id}»: la etapa «${etapa.label}» usa la clave «${etapa.key}», que deriveStageKey no conoce — el lead caería en la primera columna`);
      assert.equal(columna(lead, stages), etapa.key, `«${t.id}»: un lead de «${etapa.label}» cae en otra columna`);
      // Y la columna lleva el nombre del tipo, no el de la plantilla.
      assert.equal(stages.find((s) => s.key === etapa.key)?.label, etapa.label, `«${t.id}»: el nombre de «${etapa.key}» no llegó al tablero`);
    }
  }
});

test('§4: la plantilla de ficha que le toca a cada tipo es la de la tabla de la §2', () => {
  for (const t of TIPOS_CRM) {
    assert.equal(plantillaDeFicha(t), FICHA_DE_LA_TABLA[t.id], `«${t.id}» elegiría «${plantillaDeFicha(t)}»`);
  }
});

test('ningún nombre de etapa pasa el tope, y el texto que se dibuja es corto', () => {
  for (const t of TIPOS_CRM) {
    // Más largo que el tope, el editor lo recorta al primer guardado (sanearLabels).
    for (const s of t.pipeline) assert.ok(s.label.length <= MAX_LABEL_ETAPA, `«${t.id}»: «${s.label}» pasa de ${MAX_LABEL_ETAPA}`);
    assert.ok(t.label.length <= 24, `«${t.id}»: el nombre «${t.label}» es largo`);
    assert.ok(t.linea.length <= 36, `«${t.id}»: la línea «${t.linea}» es larga`);
  }
});

test('ningún tipo sin reunión genera nutrición de No Show de reunión', () => {
  // El daño de sembrar mal (tests/funnel-por-canal.test.ts): avisos de reuniones que no existen.
  for (const t of TIPOS_CRM.filter((x) => !x.pipeline.some((s) => s.kind === 'reunion'))) {
    const { stages } = generateFunnel(t.pipeline, apagadasAlCrear(t.pipeline, t.suppressed));
    const noShow = stages.filter((s) => /^noshow_r[12]$/.test(s.key)).map((s) => s.key);
    assert.deepEqual(noShow, [], `«${t.id}» generó ${noShow.join(', ')}`);
  }
});

test('siembraDeCrm: un tipo trae su canal, su entrada y sus etapas', () => {
  const s = siembraDeCrm({ tipo: 'dm_funnel' });
  assert.ok(!('error' in s));
  assert.equal(s.tipo, 'dm_funnel');
  assert.equal(s.canal, 'conversaciones');
  assert.deepEqual(s.entradas, ['chat_entrante']);
  assert.equal(s.pipeline[0].label, 'Lead entrante (comentó)');
  // Lo que viene del modal con «Otro» de antes no se mezcla: con un tipo, canal y entradas se ignoran.
  const t = siembraDeCrm({ tipo: 'linkedin', canal: 'carrito', entradas: ['carrito'] });
  assert.ok(!('error' in t));
  assert.equal(t.canal, 'llamadas');
  assert.deepEqual(t.entradas, ['chat_saliente']);
});

test('siembraDeCrm: «Otro, lo armo yo» siembra lo mismo que antes, y lo que falta no cae a un default', () => {
  const o = siembraDeCrm({ tipo: TIPO_CRM_OTRO, canal: 'llamadas', entradas: ['landing', 'chat_entrante'] });
  assert.ok(!('error' in o));
  assert.equal(o.tipo, null);
  assert.equal(o.canal, 'llamadas');
  assert.deepEqual(o.entradas, ['landing', 'chat_entrante']);
  assert.deepEqual(o.pipeline, templateDeCanal('llamadas')!.pipeline, 'con «Otro» las etapas dejaron de ser las del canal');
  // Falla CERRADO: elegir es justo lo que este alta vino a hacer.
  for (const malo of [
    { tipo: TIPO_CRM_OTRO, entradas: ['landing'] },
    { tipo: TIPO_CRM_OTRO, canal: 'inventado', entradas: ['landing'] },
    { tipo: TIPO_CRM_OTRO, canal: 'llamadas' },
    { tipo: TIPO_CRM_OTRO, canal: 'llamadas', entradas: ['inventada'] },
    { tipo: 'inventado' },
    { tipo: '' },
    {},
  ]) {
    assert.ok('error' in siembraDeCrm(malo), `${JSON.stringify(malo)} sembró algo`);
  }
  // Y las entradas que ofrece «Otro» siguen siendo las del modal de siempre.
  assert.ok(ENTRADAS_OFRECIDAS.every((e) => !('error' in siembraDeCrm({ tipo: TIPO_CRM_OTRO, canal: 'carrito', entradas: [e] }))));
});

test('apagadasAlCrear: la cuenta de crearFunnel, y cambia con las etapas del tipo', () => {
  const p = tipo('presencial');
  const ap = apagadasAlCrear(p.pipeline, p.suppressed);
  // Lo propio de la plantilla se respeta y se suma a lo calculado, sin duplicar.
  assert.ok(ap.includes('nopaga>reunion_excepcional'));
  for (const id of suppressedInicial(p.pipeline)) assert.ok(ap.includes(id), `falta ${id}`);
  assert.equal(new Set(ap).size, ap.length, 'hay ids repetidas');
  // ⚠️ Por esto `crearCrm` las vuelve a calcular: «dos reuniones» se crea sobre el canal `llamadas`,
  // cuya plantilla tiene UNA reunión, y las ids de `suppressed` salen de las claves del pipeline.
  const dos = tipo('dos_reuniones');
  assert.notDeepEqual(
    apagadasAlCrear(dos.pipeline, dos.suppressed).sort(),
    apagadasAlCrear(templateDeCanal(dos.canal)!.pipeline, templateDeCanal(dos.canal)!.suppressed).sort(),
    'con las etapas del canal alcanzaría: entonces el tipo no cambia nada',
  );
});
