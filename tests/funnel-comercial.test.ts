// =============================================================================
// El tramo comercial del tablero sale del FUNNEL DEL WORKSPACE
// =============================================================================
// DOS SUJETOS, y hacen falta los dos. Con uno solo —el funnel por defecto— una
// resolución cableada a `form_agenda` / `agenda_asistio` / `asistio_calificado` /
// `calificado_cierre` pasa TODAS las pruebas: es justo lo que tenía el código.
// Los sujetos son:
//
//   · SIN funnel propio: null, [], DEFAULT_PIPELINE y la plantilla `highticket`.
//     Tienen que resolver las cuatro keys canónicas de siempre, en el mismo orden,
//     con los mismos umbrales y los mismos contadores. Es lo innegociable: no se
//     puede romper a los que ya andan.
//   · CON funnel propio: las plantillas `simple` / `presencial` (una reunión),
//     `directa` / `conversaciones` (ninguna) y un funnel armado a mano en
//     producción. Para ellos el tramo tiene OTRAS keys y —lo que importa— otra
//     COHORTE: sin reuniones, `fecha_junta_1` es null en todos sus leads, así que
//     contar sobre esa cohorte da cero sin ningún error.
//
// PROBADO ROMPIÉNDOLO (con el arreglo puesto: 13 pasan, 0 fallan):
//   · `pasosComercialesDe` devuelve siempre DOS_REUNIONES — la resolución cableada,
//     o sea el bug original                                            -> 8 / 5
//   · el tramo de 0 reuniones cuenta sobre la cohorte de la R1
//     (`cierres_cohorte` en vez de `cierres_entradas`)                 -> 11 / 2
//   · `reunionesMedibles` deja de topear en 2 (saca `slotPorIndice`)    -> 12 / 1
//   · `rolesComercialesDe` deja de resolver `base`                      -> 10 / 3
//   · `getFunnelEtapas` vuelve a cablear una key canónica               -> 12 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  pasosComercialesDe,
  rolesComercialesDe,
  reunionesMedibles,
  ROLES_EN_ORDEN,
  type ContadorComercial,
} from '../lib/funnel-comercial';
import { DEFAULT_PIPELINE, FUNNEL_TEMPLATES, type Stage } from '../lib/pipeline';

const RAIZ = join(import.meta.dirname, '..');

const plantilla = (id: string): Stage[] => {
  const t = FUNNEL_TEMPLATES.find((x) => x.id === id);
  assert.ok(t, `la plantilla '${id}' ya no existe: este test está midiendo otra cosa`);
  return t.pipeline;
};

/** El funnel REAL que una inmobiliaria armó a mano (fixture de tests/funnel-estructura). */
const A_MANO: Stage[] = [
  { key: 'lead', kind: 'entrada', label: 'Lead (Instant form)' } as Stage,
  { key: 'agenda', kind: 'grupo', label: 'En revision' } as Stage,
  { key: 'ganado', kind: 'grupo', label: 'Calificado' } as Stage,
  { key: 'st0', kind: 'cierre', label: 'NO Calificado' } as Stage,
  { key: 'st1', kind: 'reunion', label: 'TASACION / PRE LISTING' } as Stage,
];

const keysDe = (stages: readonly EtapaLiteLocal[] | null) => pasosComercialesDe(stages).map((p) => p.key);
type EtapaLiteLocal = { key: string; kind?: string };

// ─────────────────────────────────────────────────────────────────────────────
// SUJETO 1 — sin funnel propio: nada cambia
// ─────────────────────────────────────────────────────────────────────────────

test('sin funnel propio resuelve las cuatro keys canónicas de siempre', () => {
  for (const sujeto of [null, undefined, [] as Stage[], DEFAULT_PIPELINE, plantilla('highticket')]) {
    assert.deepEqual(
      pasosComercialesDe(sujeto).map((p) => p.key),
      ['form_agenda', 'agenda_asistio', 'asistio_calificado', 'calificado_cierre'],
      `el funnel por defecto (${Array.isArray(sujeto) ? `${sujeto.length} etapas` : String(sujeto)}) cambió de pasos`,
    );
  }
});

test('sin funnel propio los contadores, umbrales y bloques son los de hoy', () => {
  const esperado = [
    { key: 'form_agenda', bloque: 'puente', entrada: 'forms', salida: 'agendas', umbral: { rojo: 25, ambar: 45, max: 100 }, fuenteKey: 'meta_insights' },
    { key: 'agenda_asistio', bloque: 'comercial', entrada: 'r1_cohorte', salida: 'asistencias', umbral: { rojo: 65, ambar: 75, max: 100 }, fuenteKey: 'calendly' },
    { key: 'asistio_calificado', bloque: 'comercial', entrada: 'asistencias', salida: 'limpias', umbral: { rojo: 40, ambar: 60, max: 100 }, fuenteKey: null },
    { key: 'calificado_cierre', bloque: 'comercial', entrada: 'limpias', salida: 'cierres_cohorte', umbral: { rojo: 20, ambar: 30, max: 100 }, fuenteKey: null },
  ];
  assert.deepEqual(
    pasosComercialesDe(DEFAULT_PIPELINE).map((p) => ({
      key: p.key, bloque: p.bloque, entrada: p.entrada, salida: p.salida, umbral: p.umbral, fuenteKey: p.fuenteKey,
    })),
    esperado,
  );
  // Los labels también: son los que la pantalla dibuja y los que MaKo cita.
  assert.deepEqual(
    pasosComercialesDe(null).map((p) => p.label),
    ['Formulario → Agenda', 'Agenda → Asistió R1', 'Asistió → Limpia', 'Limpia → Cierre'],
  );
});

test('sin funnel propio los roles apuntan donde apuntaban', () => {
  assert.deepEqual(rolesComercialesDe(DEFAULT_PIPELINE), {
    agendas: { key: 'form_agenda', campo: 'salida' },
    r1: { key: 'agenda_asistio', campo: 'salida' },
    r2: { key: 'asistio_calificado', campo: 'salida' },
    cierres: { key: 'calificado_cierre', campo: 'salida' },
    // El denominador de la tasa de cierre: las agendas de la R1, igual que antes.
    base: { key: 'agenda_asistio', campo: 'entrada' },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUJETO 2 — con funnel propio
// ─────────────────────────────────────────────────────────────────────────────

test('con UNA reunión el cierre cuelga de la asistencia, no de una R2 que no existe', () => {
  for (const id of ['simple', 'presencial', 'vsl']) {
    const stages = plantilla(id);
    assert.equal(reunionesMedibles(stages), 1, `'${id}' debería medir una sola reunión`);
    assert.deepEqual(keysDe(stages), ['form_agenda', 'agenda_asistio', 'asistio_cierre'], `'${id}'`);

    const roles = rolesComercialesDe(stages);
    // El rol que el funnel NO tiene es null, nunca un paso con salida 0: una barra
    // «R2» en cero afirma una caída que no existe.
    assert.equal(roles.r2, null, `'${id}' no tiene R2`);
    assert.deepEqual(roles.cierres, { key: 'asistio_cierre', campo: 'salida' }, `'${id}'`);

    const cierre = pasosComercialesDe(stages).find((p) => p.key === 'asistio_cierre');
    assert.equal(cierre?.entrada, 'asistencias', 'el denominador del cierre no puede ser `limpias`');
    assert.equal(cierre?.salida, 'cierres_cohorte');
  }
});

test('SIN reuniones el tramo mide la cohorte del ALTA, no la de una reunión inexistente', () => {
  for (const id of ['directa', 'conversaciones']) {
    const stages = plantilla(id);
    assert.equal(reunionesMedibles(stages), 0, `'${id}' no tiene reuniones`);
    assert.deepEqual(keysDe(stages), ['lead_cierre'], `'${id}'`);

    const paso = pasosComercialesDe(stages)[0];
    // ⚠️ ESTA ES LA ASERCIÓN QUE EL BUG NO PASABA. Con los contadores de la cohorte
    // de la R1 (`r1_cohorte` / `asistencias` / `limpias` / `cierres_cohorte`) este
    // funnel mide CERO: `fecha_junta_1` es null en todos sus leads.
    assert.equal(paso.entrada, 'entradas', `'${id}': la entrada tiene que ser el alta del lead`);
    assert.equal(paso.salida, 'cierres_entradas', `'${id}': los cierres tienen que salir de la cohorte del alta`);
    assert.ok(!paso.salida.includes('cohorte'), `'${id}': ningún contador de la cohorte de la R1 acá`);

    const roles = rolesComercialesDe(stages);
    assert.equal(roles.agendas, null, `'${id}' no agenda nada`);
    assert.equal(roles.r1, null);
    assert.equal(roles.r2, null);
    assert.deepEqual(roles.cierres, { key: 'lead_cierre', campo: 'salida' }, `'${id}'`);
    assert.deepEqual(roles.base, { key: 'lead_cierre', campo: 'entrada' }, `'${id}'`);
  }
});

test('los dos sujetos no pueden compartir la resolución', () => {
  const porDefecto = rolesComercialesDe(DEFAULT_PIPELINE);
  const propio = rolesComercialesDe(plantilla('directa'));
  // Si estas tres fueran iguales, la resolución estaría cableada a las keys de
  // siempre y los tableros del segundo sujeto medirían cero.
  assert.notEqual(porDefecto.cierres?.key, propio.cierres?.key);
  assert.notEqual(porDefecto.base?.key, propio.base?.key);
  assert.notDeepEqual(keysDe(DEFAULT_PIPELINE), keysDe(plantilla('directa')));
});

test('un funnel armado a mano se resuelve por su kind, no por sus labels', () => {
  // Una sola etapa `kind: 'reunion'`, y se llama `st1`: ninguna key canónica.
  assert.equal(reunionesMedibles(A_MANO), 1);
  assert.deepEqual(keysDe(A_MANO), ['form_agenda', 'agenda_asistio', 'asistio_cierre']);
  assert.equal(rolesComercialesDe(A_MANO).r2, null);
});

test('la tercera reunión no tiene dónde vivir: el tramo topea en dos', () => {
  const tres: EtapaLiteLocal[] = [
    { key: 'lead', kind: 'entrada' },
    { key: 'agenda', kind: 'reunion' },
    { key: 'agendaj2', kind: 'reunion' },
    { key: 'agendaj3', kind: 'reunion' },
    { key: 'ganado', kind: 'cierre' },
  ];
  // `leads` tiene DOS pares de columnas de reunión: la tercera no se puede medir.
  assert.equal(reunionesMedibles(tres), 2);
  assert.deepEqual(keysDe(tres), keysDe(DEFAULT_PIPELINE));
});

test('todo rol resuelto apunta a un paso que existe en el tramo', () => {
  for (const id of ['highticket', 'simple', 'presencial', 'directa', 'conversaciones', 'vsl']) {
    const stages = plantilla(id);
    const keys = new Set(keysDe(stages));
    const roles = rolesComercialesDe(stages);
    for (const rol of [...ROLES_EN_ORDEN, 'base' as const]) {
      const f = roles[rol];
      if (f) assert.ok(keys.has(f.key), `'${id}': el rol ${rol} apunta a ${f.key}, que no está en el tramo`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cableado — que los consumidores no vuelvan a tener su propia tabla de keys
// ─────────────────────────────────────────────────────────────────────────────
// Un guard de cableado NO reemplaza a los tests de arriba: contesta «¿está
// enchufado?», nunca «¿hace lo que dice?». Van los dos.

/** El fuente sin comentarios: la convención de la casa es explicar en el comentario
 *  justo lo que el guard prohíbe, y así un guard se acusa a sí mismo.
 *  ⚠️ Los de línea van PRIMERO (un `//` puede contener la apertura de un bloque). */
const limpio = (src: string) => src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de una función, cortado en el ARRANQUE del bloque siguiente — nunca
 *  en un número de caracteres elegido a ojo. */
function cuerpo(src: string, abre: string, cierra: string): string {
  const i = src.indexOf(abre);
  assert.ok(i >= 0, `no se encontró '${abre}': el guard está mirando otro archivo`);
  const j = src.indexOf(cierra, i + abre.length);
  assert.ok(j > i, `no se encontró el cierre '${cierra}' después de '${abre}'`);
  const trozo = src.slice(i, j);
  // Si mañana mide el doble, está mirando otra cosa.
  assert.ok(trozo.length < 6000, `el recorte quedó en ${trozo.length} caracteres: está abarcando más que la función`);
  return trozo;
}

test('getFunnelEtapas no escribe las keys del tramo comercial a mano', () => {
  const src = limpio(readFileSync(join(RAIZ, 'lib/queries.ts'), 'utf8'));
  const fn = cuerpo(src, 'export async function getFunnelEtapas(', '\nexport type FunnelSeries');
  for (const k of ['form_agenda', 'agenda_asistio', 'asistio_calificado', 'calificado_cierre']) {
    assert.ok(!fn.includes(`'${k}'`), `getFunnelEtapas volvió a cablear '${k}'`);
  }
  assert.ok(fn.includes('pasosComercialesDe('), 'getFunnelEtapas no resuelve el tramo con el módulo');
  assert.ok(fn.includes('rolesComercialesDe('), 'getFunnelEtapas no devuelve los roles resueltos');
  // El contador de la cohorte del ALTA tiene que estar cableado de verdad: sin esta
  // consulta, el tramo sin reuniones queda con los dos lados en 0.
  assert.ok(fn.includes('cierres_entradas:'), 'falta el contador `cierres_entradas` en getFunnelEtapas');
  assert.ok(/created_at/.test(fn), 'falta la cohorte del alta (created_at) en getFunnelEtapas');
});

test('retro-datos lee los números por ROL y no por key canónica', () => {
  const src = limpio(readFileSync(join(RAIZ, 'lib/retro-datos.ts'), 'utf8'));
  for (const k of ['form_agenda', 'agenda_asistio', 'asistio_calificado', 'calificado_cierre']) {
    assert.ok(!src.includes(`'${k}'`), `retro-datos volvió a buscar '${k}' por key`);
  }
  assert.ok(src.includes('funnel.roles'), 'retro-datos no consume la resolución del funnel');
});

test('el módulo de la resolución NO lleva server-only: si no, no hay test', () => {
  // Sin comentarios: la cabecera del módulo EXPLICA que no lleva server-only, así
  // que un guard sobre el fuente crudo se acusa a sí mismo.
  const src = limpio(readFileSync(join(RAIZ, 'lib/funnel-comercial.ts'), 'utf8'));
  assert.ok(!/['"]server-only['"]/.test(src), 'con server-only ningún test puede importar esto');
});

// El compilador ya garantiza que cada `ContadorComercial` tenga su cuenta en
// `getFunnelEtapas` y en `getFunnelSeries` (los dos mapas son `Record<
// ContadorComercial, …>`), así que acá sólo se fija que el tipo no se vacíe.
test('los contadores del tramo siguen siendo ocho', () => {
  const usados = new Set<ContadorComercial>();
  for (const t of FUNNEL_TEMPLATES) for (const p of pasosComercialesDe(t.pipeline)) { usados.add(p.entrada); usados.add(p.salida); }
  assert.equal(usados.size, 8, `las plantillas usan ${usados.size} contadores: ${[...usados].sort().join(', ')}`);
});
