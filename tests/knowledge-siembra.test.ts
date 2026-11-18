// La siembra de Knowledge (C3, 18/11/2026): las fichas destiladas de los cursos que scripts/sembrar-knowledge.mts carga en
// mako_knowledge con `fuente: 'mako'`. Este test EJECUTA los datos y la regla de la siembra; nunca toca la base.
//   · cada módulo de lib/knowledge-modulos.ts tiene sus fichas, con su `modulo` bien puesto;
//   · cada ficha cabe (TOPE_CUERPO) y cada módulo entra entero en el prompt de una tab (TOPE_MODULO);
//   · ni voseo, ni gente real del producto, ni el nombre de un referente (el método es de MaKo: no se atribuye a quien la
//     persona no eligió — AGENTS.md, «Una ficha de referente que la persona NO eligió…»);
//   · `de` nombra algo que existe (un curso del portal o un archivo del repo);
//   · `planDeSiembra` crea lo que falta, no duplica lo que ya está y sólo actualiza si se le pide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULOS_KNOWLEDGE, moduloDeKey } from '../lib/knowledge-modulos';
import { FICHAS_POR_MODULO, TODAS_LAS_FICHAS, TOPE_CUERPO, TOPE_MODULO, cursoDeModulo } from '../lib/knowledge-siembra';
import { PLANTILLAS_GUION } from '../lib/knowledge-siembra/plantillas-guion';
import { planDeSiembra, filaDeFicha, type FilaExistente } from '../lib/knowledge-siembra/plan';
import { ASESORES } from '../lib/asesores/catalogo';
import { marcasDeVoseo } from '../lib/voseo';
import { realesEn, sinAcentos, ARGENTINISMOS } from './_reales';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Los slugs de los cursos del portal, leídos de los archivos (el `slug:` de cada `curso-*.ts`). */
const SLUGS = (() => {
  const dir = join(RAIZ, 'app', 'conocimientos');
  const s = new Set<string>();
  for (const f of readdirSync(dir)) {
    if (!/^curso-.*\.ts$/.test(f)) continue;
    const m = readFileSync(join(dir, f), 'utf8').match(/\bslug:\s*'([^']+)'/);
    if (m) s.add(m[1]);
  }
  return s;
})();

/** Los nombres de los referentes, sin tildes: ninguna ficha los nombra. */
const NOMBRES_REFERENTES = [...new Set(ASESORES.flatMap((a) => [a.nombre, a.completo]))].map(sinAcentos);

test('hay cursos para validar `de` (el denominador no es cero)', () => {
  assert.ok(SLUGS.size > 50, `leí ${SLUGS.size} slugs de app/conocimientos: el lector de cursos está roto`);
  assert.ok(NOMBRES_REFERENTES.length > 20, `leí ${NOMBRES_REFERENTES.length} nombres de referentes`);
});

test('cada módulo de Knowledge tiene su lista, y no hay listas de módulos que no existen', () => {
  for (const m of MODULOS_KNOWLEDGE) assert.ok(FICHAS_POR_MODULO[m.key], `el módulo ${m.key} no tiene entrada en lib/knowledge-siembra/index.ts`);
  for (const k of Object.keys(FICHAS_POR_MODULO)) assert.ok(moduloDeKey(k), `«${k}» no es un módulo de lib/knowledge-modulos.ts`);
});

for (const m of MODULOS_KNOWLEDGE) {
  test(`módulo ${m.key}: sus fichas cumplen el formato`, () => {
    const fichas = FICHAS_POR_MODULO[m.key] ?? [];
    assert.ok(fichas.length >= 5, `${m.key} tiene ${fichas.length} fichas: el mínimo es 5`);
    const titulos = new Set<string>();
    let total = 0;
    for (const f of fichas) {
      const donde = `${m.key} › «${f.titulo}»`;
      assert.equal(f.modulo, m.key, `${donde}: dice modulo «${f.modulo}» y está en la lista de ${m.key}`);
      assert.ok(f.titulo.trim().length >= 8 && f.titulo.length <= 90, `${donde}: el título tiene que tener de 8 a 90 caracteres`);
      assert.ok(!titulos.has(sinAcentos(f.titulo)), `${donde}: título repetido en el módulo (es la clave de la siembra)`);
      titulos.add(sinAcentos(f.titulo));
      assert.ok(f.categoria.trim().length >= 3, `${donde}: falta la categoría`);
      assert.ok(f.cuerpo.trim().length >= 300, `${donde}: el cuerpo tiene ${f.cuerpo.trim().length} caracteres; una ficha de menos de 300 no enseña nada`);
      assert.ok(f.cuerpo.length <= TOPE_CUERPO, `${donde}: el cuerpo tiene ${f.cuerpo.length} caracteres (tope ${TOPE_CUERPO}): son dos fichas`);
      total += f.titulo.length + f.cuerpo.length;
      const texto = `${f.titulo}\n${f.categoria}\n${f.cuerpo}`;
      assert.deepEqual(marcasDeVoseo(texto), [], `${donde}: tiene voseo`);
      assert.deepEqual(texto.match(ARGENTINISMOS) ?? [], [], `${donde}: tiene regionalismos`);
      assert.deepEqual(realesEn(texto), [], `${donde}: nombra gente real del producto`);
      const sin = sinAcentos(texto);
      const nombrados = NOMBRES_REFERENTES.filter((n) => sin.includes(n));
      assert.deepEqual(nombrados, [], `${donde}: nombra a un referente; el método es de MaKo`);
      assert.ok(f.de.length > 0, `${donde}: falta de dónde salió`);
      for (const d of f.de) {
        const ok = SLUGS.has(d) || existsSync(join(RAIZ, d));
        assert.ok(ok, `${donde}: «${d}» no es un curso del portal ni un archivo del repo`);
      }
    }
    assert.ok(total <= TOPE_MODULO, `${m.key} suma ${total} caracteres (tope ${TOPE_MODULO}): no entraría entero en el prompt de su tab`);
  });
}

test('las plantillas de guion (pedido 3.2 del 30/10) son del módulo orgánico y se marcan como plantillas', () => {
  assert.ok(PLANTILLAS_GUION.length >= 4, `hay ${PLANTILLAS_GUION.length} plantillas de guion; el mínimo es 4`);
  for (const p of PLANTILLAS_GUION) {
    assert.equal(p.modulo, 'organico', `«${p.titulo}»: las plantillas las consume el Copywriting (módulo organico)`);
    assert.equal(p.categoria, 'Plantilla de guion', `«${p.titulo}»: la categoría es la que agrupa las plantillas en Methodology`);
  }
  assert.ok(FICHAS_POR_MODULO.organico.some((f) => f.categoria === 'Plantilla de guion'), 'las plantillas no llegaron a la lista del módulo');
});

test('filaDeFicha: va con fuente mako, el área del módulo y el curso del módulo', () => {
  const f = TODAS_LAS_FICHAS[0];
  assert.ok(f, 'no hay fichas');
  const fila = filaDeFicha(f);
  const m = moduloDeKey(f.modulo)!;
  assert.equal(fila.fuente, 'mako');
  assert.equal(fila.area, m.area);
  assert.equal(fila.curso, cursoDeModulo(m.nombre));
  assert.equal(fila.autor, 'MaKo');
  assert.equal(fila.activo, true);
  assert.ok(!('de' in fila), 'el `de` no viaja a la base');
});

test('planDeSiembra: crea lo que falta, saltea lo igual y sólo actualiza si se le pide', () => {
  const fichas = TODAS_LAS_FICHAS.slice(0, 3);
  assert.equal(fichas.length, 3);
  const [a, b, c] = fichas.map(filaDeFicha);
  const existentes: FilaExistente[] = [
    { id: 10, curso: a.curso, titulo: a.titulo, cuerpo: a.cuerpo, area: a.area, fuente: 'mako', activo: true },
    { id: 11, curso: b.curso, titulo: b.titulo, cuerpo: 'una versión vieja', area: b.area, fuente: 'mako', activo: true },
  ];
  const sinActualizar = planDeSiembra(existentes, fichas, { actualizar: false });
  assert.deepEqual(sinActualizar.crear.map((f) => f.titulo), [c.titulo]);
  assert.equal(sinActualizar.iguales, 1);
  assert.deepEqual(sinActualizar.actualizar, []);
  assert.deepEqual(sinActualizar.distintas.map((d) => d.id), [11], 'la distinta se informa aunque no se toque');
  const conActualizar = planDeSiembra(existentes, fichas, { actualizar: true });
  assert.deepEqual(conActualizar.actualizar.map((u) => u.id), [11]);
  assert.deepEqual(conActualizar.crear.map((f) => f.titulo), [c.titulo]);
});

test('planDeSiembra: una fila con el mismo título pero cargada a mano (fuente manual) no se pisa', () => {
  const [f] = TODAS_LAS_FICHAS;
  const fila = filaDeFicha(f);
  const plan = planDeSiembra([{ id: 7, curso: fila.curso, titulo: fila.titulo, cuerpo: 'otra', area: fila.area, fuente: 'manual', activo: true }], [f], { actualizar: true });
  assert.deepEqual(plan.actualizar, [], 'lo que cargó una persona a mano no lo reescribe la siembra');
  assert.deepEqual(plan.crear, [], 'tampoco se duplica: ya hay una con esa clave');
  assert.deepEqual(plan.ajenas.map((x) => x.id), [7]);
});

test('planDeSiembra: el título se compara sin tildes ni mayúsculas (no duplica por una tilde)', () => {
  const [f] = TODAS_LAS_FICHAS;
  const fila = filaDeFicha(f);
  const plan = planDeSiembra([{ id: 3, curso: fila.curso, titulo: sinAcentos(fila.titulo).toUpperCase(), cuerpo: fila.cuerpo, area: fila.area, fuente: 'mako', activo: true }], [f], { actualizar: false });
  assert.deepEqual(plan.crear, []);
  assert.equal(plan.iguales, 1);
});
