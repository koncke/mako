// =============================================================================
// «Sacar» en Members saca del PROGRAMA: el curso y su comunidad (f32/f33, llamada con Leandro, 24/10/2026)
// =============================================================================
// Textual (Fathom 196023930 @55:00): «Voy a Fiesta Music, voy a Leandro Prueba y no me saca de ningún lado. (...) No me
// saca del curso, pero me saca de la comunidad. Tu acceso a la comunidad no está activo. Reportar a soporte: No
// autenticado». Hasta ese día el baneo cerraba sólo la comunidad (lib/comunidad-moderacion.ts lo decía a propósito).
//
// Lo que fija este archivo: las dos reglas puras (qué le pasa a su acceso al sacarlo y al volver a admitirlo, en
// lib/curso-invitar-reglas.ts), que las dos tablas de Avance no listan a un sacado, que el portal tiene UNA frase de
// entrada (lib/curso-portal-aviso.ts) y que «Reportar a Soporte» no se dibuja donde no hay sesión de MaKo.
// El cableado de sacar y admitir (el instante del baneo, el orden), en tests/comunidad-moderacion.test.ts.
//
// Verificado rompiéndolo: ver «ROTURAS» al final.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { accesoTrasSacar, accesoTrasAdmitir } from '../lib/curso-invitar-reglas';
import { SIN_ACCESO_PORTAL } from '../lib/curso-portal-aviso';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');

test('accesoTrasSacar: le saca ése; si era lo único que veía, se corta; si no lo tenía, no se toca', () => {
  assert.deepEqual(accesoTrasSacar([3, 7], [3, 7], 7), { tipo: 'acotar', productos: [3] });
  // `null` (todos los suyos) pasa a ser lo que ve, menos ése.
  assert.deepEqual(accesoTrasSacar(null, [3, 7], 3), { tipo: 'acotar', productos: [7] });
  // Una lista con un curso que ya no ve (no es más cliente de 9): se conserva, nadie decidió sacárselo.
  assert.deepEqual(accesoTrasSacar([3, 7, 9], [3, 7], 7), { tipo: 'acotar', productos: [3, 9] });
  assert.deepEqual(accesoTrasSacar([7], [7], 7), { tipo: 'cortar' });
  assert.deepEqual(accesoTrasSacar(null, [7], 7), { tipo: 'cortar' }, 'un acceso sin ningún curso dejaría pasar a un portal vacío');
  assert.deepEqual(accesoTrasSacar([7, 9], [7], 7), { tipo: 'cortar' }, 'lo que queda en la lista no lo ve: es lo mismo que nada');
  assert.deepEqual(accesoTrasSacar([3], [3], 7), { tipo: 'nada' });
  assert.deepEqual(accesoTrasSacar(null, [3], 7), { tipo: 'nada' });
  // Lo abre su lista pero hoy no lo ve (dejó de ser cliente): igual se le saca, para que no vuelva solo.
  assert.deepEqual(accesoTrasSacar([3, 7], [3], 7), { tipo: 'acotar', productos: [3] });
});

test('accesoTrasAdmitir: vuelve el curso; un corte se habilita SÓLO si lo hizo ese «sacar»', () => {
  const sacado = '2026-10-24T23:10:05.123Z';
  assert.deepEqual(accesoTrasAdmitir({ abre: [3], revocadoAt: null, sacadoAt: sacado, productoId: 7 }),
    { tipo: 'reabrir', reactivar: false, productos: [3, 7] });
  assert.deepEqual(accesoTrasAdmitir({ abre: null, revocadoAt: null, sacadoAt: sacado, productoId: 7 }), { tipo: 'nada' });
  assert.deepEqual(accesoTrasAdmitir({ abre: [3, 7], revocadoAt: null, sacadoAt: sacado, productoId: 7 }), { tipo: 'nada' });
  // PostgREST escribe el instante distinto que JS: se compara el instante, no el texto.
  assert.deepEqual(accesoTrasAdmitir({ abre: [7], revocadoAt: '2026-10-24T23:10:05.123+00:00', sacadoAt: sacado, productoId: 7 }),
    { tipo: 'reabrir', reactivar: true, productos: [7] });
  assert.deepEqual(accesoTrasAdmitir({ abre: null, revocadoAt: '2026-10-24T23:10:05.123+00:00', sacadoAt: sacado, productoId: 7 }),
    { tipo: 'reabrir', reactivar: true, productos: null });
  // Lo cortó otra persona («Cortar acceso», antes o después): admitirlo en una comunidad no deshace esa decisión.
  assert.deepEqual(accesoTrasAdmitir({ abre: [7], revocadoAt: '2026-10-25T10:00:00.000Z', sacadoAt: sacado, productoId: 7 }), { tipo: 'cortado' });
  assert.deepEqual(accesoTrasAdmitir({ abre: [7], revocadoAt: '2026-10-25T10:00:00.000Z', sacadoAt: null, productoId: 7 }), { tipo: 'cortado' });
});

test('las dos tablas de Avance (Clients y Classroom) no listan a un sacado de ESE programa', () => {
  for (const p of ['app/customer-success/pantalla.tsx', 'app/customer-success/curso/pantalla.tsx']) {
    const s = leer(p);
    assert.match(s, /sacadosPorProducto\(ws\)/, `${p}: no lee a los sacados`);
    assert.match(s, /esDelProducto\(c\.leadId, s\.productoId, entrega\.casaPorLead, asignacion\) && !sacados\.get\(s\.productoId\)\?\.has\(c\.leadId\)/,
      `${p}: lista a los sacados`);
  }
  const m = leer('lib/comunidad-moderacion.ts');
  const f = m.slice(m.indexOf('export async function sacadosPorProducto('), m.indexOf('export async function sacadosDeLaComunidad('));
  assert.match(f, /eq: \{ workspace_id: ws \}, filtros: \(q\) => q\.is\('levantado_at', null\)/, 'un baneo levantado sigue sacando de Avance');
});

test('el portal tiene UNA frase de entrada: el link, /mi-curso y la comunidad del alumno dicen lo mismo', () => {
  assert.equal(SIN_ACCESO_PORTAL, 'Tu acceso ya no está activo.');
  const link = leer('app/compartido/curso/[token]/page.tsx');
  assert.equal((link.match(/<Aviso titulo=\{SIN_ACCESO_PORTAL\} \/>/g) ?? []).length, 2, 'el link con otra frase');
  assert.match(leer('app/mi-curso/page.tsx'), /if \(r === 'inactivo'\) return <AvisoPortal titulo=\{SIN_ACCESO_PORTAL\} \/>;/);
  const api = leer('app/_comunidad/api.ts');
  assert.match(api, /if \(r\.status === 404\) return \{ ok: false, error: SIN_ACCESO_PORTAL \};/, 'la comunidad con otra frase');
  // Con el portal abierto, la comunidad es lo primero que se entera: vuelve a mirar la entrada, una vez.
  const ca = leer('app/_comunidad/ComunidadAlumno.tsx');
  assert.match(ca, /if \(!r\.ok && r\.error === SIN_ACCESO_PORTAL && !mirada\.current\) \{ mirada\.current = true; router\.refresh\(\); \}/);
});

test('«Reportar a Soporte» en el portal del alumno manda con SU token (ya no «no autenticado»); la vista previa, con sesión', () => {
  // El 24/10 se escondió (contestaba «no autenticado»); desde el 27/10 (874749710-18) reporta con el token de su portal y le
  // llega al dueño del curso. La ruta y el ticket, en tests/curso-soporte-alumno.test.ts.
  const r = leer('app/_ui/ReportarASoporte.tsx');
  assert.match(r, /export const SoporteDelAlumnoCtx = createContext<string \| null>\(null\);/);
  assert.match(r, /const alumno = useContext\(SoporteDelAlumnoCtx\);/);
  assert.doesNotMatch(r, /return null;\n  return \(\n    <span ref=\{ref\} data-soporte=""/, 'el botón se vuelve a esconder en el portal');
  const portal = leer('app/compartido/curso/[token]/PortalAlumno.tsx');
  assert.match(portal, /<SoporteDelAlumnoCtx\.Provider value=\{vistaPrevia \? null : token\}>/);
});

test('el modal de Sacar dice lo que pasa: el curso y la comunidad', () => {
  const m = leer('app/_comunidad/Miembros.tsx');
  assert.match(m, />Pierde este curso y su comunidad\. Si es su único curso, se le corta el acceso\.</);
  assert.match(m, />Sacar del curso</);
  assert.doesNotMatch(m, /Su curso sigue abierto/);
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 24/10/2026 contra este archivo (6 tests) y tests/comunidad-moderacion.test.ts, cada una sola:
//   `accesoTrasSacar` sin cortar al sacar lo único que veía · `accesoTrasAdmitir` habilitando cualquier corte · la tabla
//   de Avance del Classroom listando a los sacados · «Reportar a Soporte» escondido de nuevo en el portal (27/10: antes,
//   «dibujándose sin sesión») · el baneo escrito con
//   otro instante que el corte · la comunidad del alumno con su frase vieja · admitir tocando el curso de alguien que
//   no estaba fuera → cada una, 1 fallo y 24 pases (25 tests entre los dos archivos). Script:
//   scratchpad de la sesión «Clients» del 24/10, romper-sacar.mjs (restaura de una copia en memoria).
