// =============================================================================
// #874: «Invitar al curso» como ⚡ Acción de un flujo, con el curso elegido de una lista (17/10/2026)
// =============================================================================
// Martín con Mauricio (Fathom 863534245, 40:08): «La opción que me falta es en acciones de invitar al curso». El
// onboarding de «Negocio que escala» para los Ganado escribía mensajes que nombraban el portal sin que nada creara el
// acceso. La acción `invitar_cliente_curso_cs` venía madura en la rama a medias `wip/api-acciones-1410` (quieta desde
// el 14/10): se trajo SÓLO ésa, sobre `invitarAlCurso` (lib/curso-invitar.ts, el mismo de la ficha y del CRM al
// ganar). En el lienzo va en «Cliente», y el curso se ELIGE entre los productos con clases (control `curso`). Después,
// `{{curso_link}}` en un mensaje es su link (sólo tiene valor si ya se le dio el acceso).
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-874.json`; base 3 / 0). Pasan / fallan:
//   I1 «ya invitado» como un error (sin `yaEstaba`): un flujo le mandaría una alarma al dueño en cada lead  → 2 / 1
//   I2 el éxito leído de que hubo un resultado, no de `enviado`                                       → 2 / 1
//   I3 el `productoId` de un cobro también como curso                                               → 2 / 1
//
// Correr: node --import tsx --test tests/accion-invitar-curso.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { accionDelFlujo, controlDe, AREA_DE_GRUPO } from '../lib/editor-acciones';
import { porId } from '../lib/api-mako/registro';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('la acción está en el registro y en el lienzo, en «Cliente» (Customer Success)', () => {
  const def = porId('invitar_cliente_curso_cs');
  assert.ok(def && def.tipo === 'accion', 'falta en el registro');
  assert.equal(def.reversible, false);
  assert.ok(def.canales.includes('app'), 'un flujo corre con el canal app');
  const a = accionDelFlujo('invitar_cliente_curso_cs');
  assert.ok(a, 'el lienzo no la ofrece');
  assert.equal(a!.grupo, 'Cliente');
  assert.equal(AREA_DE_GRUPO[a!.grupo], 'Customer Success');
});

test('el curso se elige: el `productoId` de una acción de curso es el control `curso`; el de un cobro, no', () => {
  const p = porId('invitar_cliente_curso_cs')!.parametros.find((x) => x.nombre === 'productoId')!;
  assert.equal(controlDe(p), 'curso');
  const cobro = { nombre: 'productoId', tipo: 'number' as const, descripcion: 'id del producto del catálogo de ofertas (de listar_productos), con su precio. NO es el embudoId del CRM.' };
  assert.equal(controlDe(cobro), 'numero', 'un producto con precio no es un curso');
  const ruta = leer('app/api/flujos/opciones/route.ts');
  assert.match(ruta, /db\.from\('curso_clases'\)\.select\('producto_id'\)\.is\('borrada_at', null\)/, 'los cursos son los productos con clases vivas');
  assert.match(leer('app/_components/EditorAccionMako.tsx'), /case 'curso':\n\s*return <SelectorCurso /);
});

test('la ejecución: «ya invitado» es «ya está así», y el éxito sale de `enviado`', () => {
  const run = leer('lib/api-mako/areas/cs.run.ts');
  const i = run.indexOf('  invitar_cliente_curso_cs: {');
  assert.ok(i > 0);
  const bloque = run.slice(i, run.indexOf('\n  },\n', i));
  assert.match(bloque, /if \(!reenviar && yaInvitado\) return \{ error: [^\n]*, yaEstaba: true \};/);
  assert.match(bloque, /const r = await invitarAlCurso\(\{ ws: ctx\.ws, leadId: Number\(p\.leadId\)/);
  assert.match(bloque, /if \(!r\.enviado\) \{/, 'un correo que no salió se contaría como invitación');
});
