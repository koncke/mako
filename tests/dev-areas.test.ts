// =============================================================================
// Las áreas de /admin/dev: una ruta inventada manda a leer un archivo que no está
// =============================================================================
// El `vive` de cada área es lo primero que mira un agente antes de tocarla, y las
// 121 entradas se armaron con ayuda de subagentes leyendo el repo. Eso trae un
// riesgo concreto: una ruta plausible pero inexistente no rompe nada, no la ve el
// compilador, y manda al próximo agente a buscar un archivo que no está — con la
// confianza de que el registro dice la verdad.
//
// Estos tests son la red. Corren contra el disco: si un archivo se renombra o se
// borra, el área que lo declaraba falla acá y no en la cara de alguien.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREAS, FAMILIAS, areaDe, porGrupo } from '../app/admin/dev/areas';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('EL PEDIDO: toda ruta declarada en `vive` existe de verdad', () => {
  const fantasmas: string[] = [];
  for (const a of AREAS) {
    for (const ruta of a.vive) {
      if (!existsSync(resolve(RAIZ, ruta))) fantasmas.push(`${a.slug} → ${ruta}`);
    }
  }
  assert.deepEqual(
    fantasmas,
    [],
    `Estas rutas no existen en el disco. O el archivo se movió y hay que actualizar ` +
    `el área, o la ruta se inventó:\n  ${fantasmas.join('\n  ')}`,
  );
});

test('un área por construir no declara rutas, y una construida sí', () => {
  for (const a of AREAS) {
    if (a.estado === 'por-construir') continue; // todavía no hay dónde vivir
    assert.ok(
      a.vive.length > 0,
      `${a.slug} dice estar ${a.estado} pero no declara dónde vive. Si no tiene código, es 'por-construir'.`,
    );
  }
});

test('los slugs son únicos: dos áreas con el mismo slug se pisan la pantalla', () => {
  const vistos = new Map<string, string>();
  for (const a of AREAS) {
    const previo = vistos.get(a.slug);
    assert.ok(!previo, `slug duplicado '${a.slug}': «${previo}» y «${a.titulo}»`);
    vistos.set(a.slug, a.titulo);
    assert.match(a.slug, /^[a-z0-9-]+$/, `${a.slug}: el slug es una URL, va en kebab-case`);
  }
});

test('cada área tiene título, familia conocida y un alcance que dice algo', () => {
  for (const a of AREAS) {
    assert.ok(a.titulo.trim(), `${a.slug} sin título`);
    assert.ok(
      (FAMILIAS as readonly string[]).includes(a.familia),
      `${a.slug}: familia desconocida «${a.familia}». Las válidas: ${FAMILIAS.join(', ')}`,
    );
    assert.ok(
      a.alcance.trim().length >= 40,
      `${a.slug}: el alcance tiene que decir qué cubre el área, no ser un rótulo (${a.alcance.length} caracteres)`,
    );
  }
});

test('el documento de hallazgos al que apunta un área existe', () => {
  for (const a of AREAS) {
    if (!a.hallazgos) continue;
    assert.ok(
      existsSync(resolve(RAIZ, 'docs', `${a.hallazgos}.md`)),
      `${a.slug} apunta a docs/${a.hallazgos}.md, que no existe`,
    );
  }
});

test('las seis áreas con bitácora escrita a mano siguen existiendo', () => {
  // Tienen registro curado (`<area>/bitacora.ts`), entrada en el nav y links que ya
  // circularon. Renombrar su slug rompe las tres cosas en silencio.
  for (const slug of ['admin', 'onboarding', 'general', 'chatbot', 'ads-writer', 'semaforo']) {
    assert.ok(areaDe(slug), `desapareció el área '${slug}', que tiene bitácora escrita a mano`);
  }
});

test('toda área cae en su familia y ninguna se pierde al agrupar', () => {
  const agrupadas = FAMILIAS.flatMap((f) => porGrupo(f).flatMap((g) => g.areas));
  assert.equal(agrupadas.length, AREAS.length, 'porGrupo() pierde áreas: alguna tiene una familia que no está en FAMILIAS');
});

test('un área con proyectos del tablero los nombra con el prefijo del catálogo', () => {
  // El Roadmap sale de estos nombres: si no matchean con `plan_proyectos`, el área
  // se muestra vacía y parece que no tiene trabajo pendiente.
  const PREFIJOS = ['Feature: ', 'Agente: ', 'Vender MaKo: ', 'Cliente: '];
  const SUELTOS = ['Diseño de la app', 'Infraestructura y versionado', 'Legal y fiscal', 'Seguridad y multi-inquilino', 'Avisos y reportes'];
  for (const a of AREAS) {
    for (const p of a.proyectos ?? []) {
      assert.ok(
        PREFIJOS.some((x) => p.startsWith(x)) || SUELTOS.includes(p),
        `${a.slug}: el proyecto «${p}» no usa ningún prefijo del catálogo ni es uno de los transversales conocidos`,
      );
    }
  }
});
