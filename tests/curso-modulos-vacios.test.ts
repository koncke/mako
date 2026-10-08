// =============================================================================
// curso-modulos-vacios — un módulo PUBLICADO y vacío aparece en la vista del alumno, «como en Skool»
// =============================================================================
// Item 16 del audio del 08/10/2026 (docs/feedback-curso-08oct.md, 03:00): «si está público, que aparezca
// acá en la vista de alumno el módulo… En Skool se pueden publicar módulos aunque no haya nada dentro». El
// que probaba quería un «Lanzamiento (coming soon)».
//
// ⚠️ EL DIAGNÓSTICO: no era el módulo, era el PRODUCTO. Un módulo vacío ya viajaba adentro de un curso
//    con clases (`armarModulos` lo arma con `clases: []`); lo que no pasaba era un curso SIN NINGUNA clase:
//    `armarVistaAlumno` hacía `if (!clases.length) continue` y la vista previa `clases.length ? … : []`,
//    así que publicar el primer módulo vacío daba «Todavía no hay clases».
// ⚠️ Y NO ES «cualquier producto con módulos»: todo producto con kanban tiene módulos (sus etapas), y un
//    cliente vería como curso vacío cada producto que compró sin curso. Lo que lo distingue es que el equipo
//    lo PUBLICÓ (`moduloPublico`).
//
// Probado ROMPIÉNDOLO (08/10/2026, scratchpad/modelo/romper.mjs, restaurado de memoria). Sin romper:
// 6 pass / 0 fail. Las roturas, al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { armarModulos, cursoSeLista, moduloPublico, type ProductoVista } from '../lib/curso-portal';
import type { ModuloCurso } from '../lib/curso-modulos';
import type { Clase } from '../lib/curso';
import { modulosDelPortal, TEXTOS_PORTAL, TEXTO_PROXIMAMENTE } from '../app/compartido/curso/[token]/modelo-ugc';
import { estiloVacio } from '../lib/curso-estilo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const mod = (clave: string, o: Partial<ModuloCurso> = {}): ModuloCurso => ({ clave, nombre: clave, vinculado: true, n: 1, bloqueo: null, ...o });
const clase = (id: number, etapa: string): Clase => ({
  id, productoId: 1, etapa, orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false,
});

test('moduloPublico: un vinculado con «Público» (abierto) o un suelto sin cerrar; uno con su etapa, no', () => {
  assert.equal(moduloPublico(mod('a', { bloqueo: { tipo: 'abierto' } })), true);
  assert.equal(moduloPublico(mod('a')), false, 'un vinculado sin tocar se abre con su etapa: nadie lo publicó');
  assert.equal(moduloPublico(mod('a', { bloqueo: { tipo: 'etapa' } })), false);
  assert.equal(moduloPublico(mod('m_x', { vinculado: false })), true, 'un suelto nace abierto y lo crea el equipo a mano');
  assert.equal(moduloPublico(mod('m_x', { vinculado: false, bloqueo: { tipo: 'manual' } })), false);
});

test('cursoSeLista: con clases sí; sin ninguna, sólo con un módulo público que el alumno puede ver', () => {
  assert.equal(cursoSeLista([mod('a')], [clase(1, 'a')]), true);
  assert.equal(cursoSeLista([mod('a'), mod('b')], []), false, 'el kanban sin curso no es un curso vacío');
  assert.equal(cursoSeLista([mod('a'), mod('b', { bloqueo: { tipo: 'abierto' } })], []), true, 'el «Lanzamiento (próximamente)» publicado');
  // Con los permisos (mig 0219): lo que no puede ver no cuenta.
  const soloA = (k: string) => k === 'a';
  assert.equal(cursoSeLista([mod('a'), mod('b', { bloqueo: { tipo: 'abierto' } })], [], soloA), false);
  assert.equal(cursoSeLista([mod('a'), mod('b')], [clase(1, 'b')], soloA), false, 'clases sólo en lo que sus permisos esconden');
  // Una clase huérfana (su módulo ya no existe) no hace que un curso se liste.
  assert.equal(cursoSeLista([mod('a')], [clase(1, 'borrado')]), false);
});

test('el módulo público y vacío VIAJA abierto y sin clases; uno con candado sigue con su candado', () => {
  const out = armarModulos({
    modulos: [mod('a', { bloqueo: { tipo: 'abierto' } }), mod('b', { bloqueo: { tipo: 'manual' }, n: 2 })],
    etapas: [{ key: 'a', label: 'Lanzamiento' }, { key: 'b', label: 'Después' }],
    actual: 'a', clases: [clase(1, 'b')], progreso: new Map(),
  });
  assert.equal(out[0].abierto, true);
  assert.equal(out[0].cuantas, 0);
  assert.deepEqual(out[0].clases, []);
  assert.equal(out[1].abierto, false, 'el candado manual sigue cerrado');
  assert.deepEqual(out[1].clases, [], 'lo cerrado no viaja');
  assert.equal(out[1].cuantas, 1);
});

test('el dibujo: «Próximamente» en la tarjeta del módulo abierto y vacío, y adentro (moduloVacio)', () => {
  const p: ProductoVista = {
    productoId: 1, nombre: 'Fiesta', estilo: estiloVacio(),
    modulos: [
      { key: 'a', label: 'Lanzamiento', vinculado: true, etapa: 'actual', abierto: true, clases: [], cuantas: 0, obligatorias: 0, enviadas: 0, tareas: 0, tareasEnviadas: 0, completo: true },
      { key: 'b', label: 'Después', vinculado: true, etapa: 'bloqueada', abierto: false, motivo: 'Se abre más adelante', clases: [], cuantas: 0, obligatorias: 0, enviadas: 0, tareas: 0, tareasEnviadas: 0, completo: true },
    ],
  };
  const [abierto, cerrado] = modulosDelPortal(p);
  assert.equal(abierto.textoTarjeta, TEXTO_PROXIMAMENTE);
  assert.equal(cerrado.textoTarjeta, undefined, 'con candado dice su motivo, no «próximamente»');
  assert.equal(cerrado.estado, 'bloqueada');
  assert.equal(TEXTOS_PORTAL.moduloVacio, TEXTO_PROXIMAMENTE);
  assert.ok(TEXTO_PROXIMAMENTE.length <= 14, 'el texto que se DIBUJA es corto');
  // La grilla del curso lo dibuja sólo para quien NO edita, en un módulo abierto y vacío.
  const ugc = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  assert.match(ugc, /\{!edicion && mod && modulo && !clases\.length && t\.moduloVacio && \(\s*<div className="ugc-soon ugc-vacio"><p>\{t\.moduloVacio\}<\/p><\/div>/);
});

test('las dos puertas listan con cursoSeLista: el portal del alumno y la vista previa del equipo', () => {
  const portal = sinComentarios(leer('lib/curso-portal.ts'));
  const i = portal.indexOf('export async function armarVistaAlumno(');
  const vista = portal.slice(i, portal.indexOf('\n}\n', i));
  assert.match(vista, /if \(!cursoSeLista\(cur\.modulos, clases, permitido\)\) continue;/);
  assert.doesNotMatch(vista, /if \(!clases\.length\) continue;/, 'volvió el corte por «sin clases»');
  const previa = sinComentarios(leer('app/customer-success/curso/vista/page.tsx'));
  assert.match(previa, /productos: cursoSeLista\(cur\.modulos, clases\) \? \[\{/);
  assert.doesNotMatch(previa, /productos: clases\.length \?/);
});

test('el líder de un área sigue sin ver un curso sin clases por área', () => {
  const portal = sinComentarios(leer('lib/curso-portal.ts'));
  assert.match(portal, /if \(lider != null && !clases\.some\(\(c\) => c\.porArea === true\)\) continue;/);
});

// ROTURAS (08/10/2026, scratchpad/modelo/romper.mjs, restaurado de memoria y verificado por hash). Sin
// romper: 6 pass / 0 fail.
//   · cursoSeLista sin los módulos públicos (sólo «tiene clases»)  → 5 / 1
//   · moduloPublico: todo vinculado es público                     → 4 / 2 (y cursoSeLista)
//   · armarVistaAlumno vuelve a cortar con `if (!clases.length)`   → 5 / 1
//   · la tarjeta del módulo vacío sin «Próximamente»               → 5 / 1
//   · la grilla del curso sin el estado vacío                      → 5 / 1
//   · la vista previa vuelve a `clases.length ? … : []`            → 5 / 1
