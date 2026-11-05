// =============================================================================
// La barra del bloque elegido, más simple: lo que casi nadie toca va en «⋯» (5/11/2026)
// =============================================================================
// El encargo (docs/relevo/suscripciones-ficha-encargo.md): una vista de edición de la ficha más simple, sin perder la
// personalización. Lo medido en producción (docs/relevo/suscripciones-medicion.md §3): de 58 acciones en el historial, 36
// son quitar, 5 poner y 4 mover; ancho, diseño, título, ícono y «Obligatorio» suman 5. La barra llegaba a 12 botones.
// Ahora: nombre, mover, Datos u Opciones, «⋯» y quitar; el resto, en «⋯» (`masDelBloque`, app/crm/lead-view/ficha/armar.ts).
//
// PROBADO ROMPIÉNDOLO (5/11/2026), contra una base de 4 / 0, de a una y restaurando:
//   · `masDelBloque` ofreciendo el ancho con un solo ancho posible                         → 3 / 1
//   · `masDelBloque` poniendo «Obligatorio» en un bloque que elige sus datos               → 3 / 1 (con un solo dato:
//     la primera versión del test sólo probaba dos y daba verde)
//   · `masDelBloque` sin el «Obligatorio» de varios datos                                  → 3 / 1
//   · la barra volviendo a dibujar los anchos afuera del «⋯»                               → 3 / 1
//   · el «⋯» sin el botón del título                                                       → 3 / 1
//   · renombrar `desdeMas` a `abrirDesdeMas` (sin efecto)                                  → 4 / 0
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bloqueDef, type BloqueId } from '../lib/ficha/catalogo';
import { masDelBloque } from '../app/crm/lead-view/ficha/armar';
import { REGLAS_RESUMEN } from '../app/crm/lead-view/ficha/reglas-resumen';
import { REGLAS_PAGOS } from '../app/crm/lead-view/ficha/reglas-pagos';
import type { ReglasBloque } from '../app/crm/lead-view/ficha/tipos';

const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src.replace(/\r\n/g, '\n').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const reglas = (id: BloqueId): ReglasBloque => ((REGLAS_RESUMEN as Record<string, ReglasBloque>)[id] ?? (REGLAS_PAGOS as Record<string, ReglasBloque>)[id] ?? {});
const def = (id: BloqueId) => { const d = bloqueDef(id); assert.ok(d, `el catálogo no tiene «${id}»`); return d!; };

test('el ancho va en «⋯» sólo si el bloque tiene más de uno', () => {
  assert.ok(masDelBloque(def('siguiente-accion'), reglas('siguiente-accion'), { cubre: 0 }).includes('ancho'), 'siguiente acción va de ½ o completo');
  assert.ok(!masDelBloque(def('posibles-duplicados'), reglas('posibles-duplicados'), { cubre: 0 }).includes('ancho'), 'posibles duplicados sólo va completo');
});

test('«Obligatorio»: un dato es un interruptor, varios abren su lista, y un bloque que elige sus datos lo lleva en «Datos ▾»', () => {
  const uno = masDelBloque(def('siguiente-accion'), reglas('siguiente-accion'), { cubre: 1 });
  assert.ok(uno.includes('obligatorio') && !uno.includes('obligatorio-varios'));
  const varios = masDelBloque(def('siguiente-accion'), reglas('siguiente-accion'), { cubre: 3 });
  assert.ok(varios.includes('obligatorio-varios') && !varios.includes('obligatorio'));
  const ninguno = masDelBloque(def('siguiente-accion'), reglas('siguiente-accion'), { cubre: 0 });
  assert.ok(!ninguno.includes('obligatorio') && !ninguno.includes('obligatorio-varios'));
  for (const cubre of [1, 2]) {
    const contacto = masDelBloque(def('contacto'), reglas('contacto'), { cubre });
    assert.ok(!contacto.includes('obligatorio') && !contacto.includes('obligatorio-varios'), `el contacto (${cubre} datos) lo pide dato por dato en «Datos ▾»`);
  }
});

test('el título y el ícono están siempre; el diseño, sólo si el bloque sabe dibujar más de uno', () => {
  for (const id of ['siguiente-accion', 'contacto', 'posibles-duplicados', 'suscripcion'] as BloqueId[]) {
    const m = masDelBloque(def(id), reglas(id), { cubre: 0 });
    assert.ok(m.includes('titulo') && m.includes('icono'), `${id}: falta el título o el ícono`);
  }
  assert.ok(masDelBloque(def('suscripcion'), reglas('suscripcion'), { cubre: 0 }).every((x) => x !== 'diseno'), 'la suscripción dibuja un solo diseño');
});

test('la barra del bloque: nombre, mover, Datos u Opciones, «⋯» y quitar; los anchos, el título y el ícono, sólo en «⋯»', () => {
  const a = sinComentarios(readFileSync(join(RAIZ, 'app/crm/lead-view/ficha/Armador.tsx'), 'utf8'));
  const ini = a.indexOf('<div className="fb-barra-bloque"');
  const fin = a.indexOf("{menu?.tipo === 'mas' && (", ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré la barra');
  const barra = a.slice(ini, fin);
  assert.ok(barra.length < 4000, `la barra mide ${barra.length}: está mirando otra cosa`);
  assert.doesNotMatch(barra, /anchosDeLaBarra/, 'los anchos volvieron a la barra');
  assert.doesNotMatch(barra, /onClick=\{abrir\('(titulo|icono|diseno|obligatorio)'\)\}/, 'un menú del «⋯» volvió a la barra');
  assert.match(barra, /onClick=\{abrir\('mas'\)\}/);
  assert.match(barra, /onClick=\{abrir\('datos'\)\}/);
  assert.match(barra, /<BotonBorrar /);
  const mas = a.slice(fin, a.indexOf("{menu?.tipo === 'diseno' && (", fin));
  for (const t of ['diseno', 'obligatorio', 'titulo', 'icono']) assert.match(mas, new RegExp(`onClick=\\{\\w+\\('${t}'\\)\\}`), `el «⋯» no abre ${t}`);
  assert.match(mas, /anchosDeLaBarra\(b\.def\)\.filter\(\(a\) => a\.puede\)/);
});
