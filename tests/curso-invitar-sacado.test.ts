// =============================================================================
// A quien sacaron de un programa en Members no se lo vuelve a invitar a ese curso (18/11/2026, O12)
// =============================================================================
// O12 de docs/pendientes-verificados-17-11.md. Desde el 24/10 (55cb01be6) «Sacar» en Members saca de la comunidad y del
// curso: si el alumno tenía otros cursos, su acceso queda con la lista achicada. Pero `invitarAlCurso` sólo frenaba con el
// acceso CORTADO, así que volver a invitarlo a ese curso se lo volvía a sumar a la lista: el programa se reabría sin pasar
// por «Volver a admitir». Ahora pregunta el baneo vigente (`estaSacado`, lib/comunidad-moderacion.ts) y contesta el motivo
// `sacado`, con su texto en `TEXTO_NO_INVITA` (lo leen todas las pantallas y la API).
//
// El hijo (tests/_curso-invitar-sacado-hijo.ts) corre `invitarAlCurso`, `estaSacado` y `admitirAlumno` REALES contra un
// PostgREST de mentira.
//
// PROBADO ROMPIÉNDOLO (18/11/2026, cada rotura sola, restaurada después; base 5 / 0):
//   R1 `invitarAlCurso` sin la guarda del baneo (lo de antes)                 → 3 / 2 (fallan el 1 y el 3)
//   R2 `estaSacado` sin `.is('levantado_at', null)` (cuenta un baneo levantado) → 3 / 2 (fallan el 2 y el 4: el curso
//      admitido y el «después de admitir» quedan cortados)
//   R3 la guarda sólo sin `reenviar` («Reenviar invitación» se la saltea)       → 4 / 1 (falla el 1)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marcasDeVoseo } from '../lib/voseo';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
type Caso = { r: { tipo: string; motivo?: string; error?: string; enviado?: boolean }; contrato?: Record<string, unknown>; log: string[] };
type Corrida = Record<string, Caso> & {
  admitir: { admitido: { ok: boolean; cursoCortado?: boolean }; sigueSacado: boolean; baneo: string | null; acceso: number[] | null };
  textos: Record<string, string>;
};
let corrida: Corrida | null = null;
let fallo: unknown = null;
function R(): Corrida {
  if (corrida) return corrida;
  if (fallo) throw fallo;
  try {
    const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_curso-invitar-sacado-hijo.ts')], {
      cwd: RAIZ, encoding: 'utf8', timeout: 170_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
    corrida = JSON.parse(salida.slice(salida.indexOf('@@SACADO@@') + '@@SACADO@@'.length)) as Corrida;
    return corrida;
  } catch (e) { fallo = e; throw e; }
}
const mando = (c: Caso) => c.log.some((x) => x.startsWith('mandar:'));

test('1. sacado de ese programa: no sale nada, ni reenviando ni desde el buscador, y el motivo es el suyo', () => {
  const s = R();
  for (const n of ['sacado', 'sacadoReenviando', 'sacadoDesdeElBuscador'] as const) {
    assert.deepEqual(s[n].r, { tipo: 'no', motivo: 'sacado' }, `${n}: volver a invitarlo le reabre el programa`);
    assert.ok(!mando(s[n]), `${n}: le mandó la invitación a alguien que sacaron`);
    assert.ok(!s[n].log.includes('link') && !s[n].log.includes('reclamar'), `${n}: le creó el acceso o reclamó la fila para nada`);
  }
  // Sin sesión (el CRM al pasar a Ganado), el contrato lo dice como un «no hacía falta», con su motivo.
  assert.deepEqual(s.sacado.contrato, { ok: true, enviado: false, motivo: 'sacado' });
});

test('2. lo que no es ese baneo no corta: otro curso ya admitido, sin producto, y el baneo de otro negocio', () => {
  const s = R();
  assert.equal(s.otroCursoAdmitido.r.tipo, 'mandado', 'un baneo LEVANTADO le cortó la invitación');
  assert.equal(s.sinProducto.r.tipo, 'mandado', 'sin producto, el mail nombra los cursos que ve: no hay baneo que mirar');
  assert.ok(!s.sinProducto.log.some((x) => x.startsWith('sacado:')), 'sin producto no se pregunta el baneo');
  assert.equal(s.baneoDeOtroNegocio.r.tipo, 'mandado', 'el baneo de otro negocio le cortó la invitación a éste');
});

test('3. la base no contesta: falla cerrada, con el error y sin mail', () => {
  const c = R().baseCaida;
  assert.equal(c.r.tipo, 'error');
  assert.ok(!mando(c), 'con «no sé si lo sacaron», mandó la invitación igual');
});

test('4. «Volver a admitir» en Members levanta el baneo, y después la invitación a ese curso sale', () => {
  const s = R();
  assert.deepEqual(s.admitir.admitido, { ok: true, cursoCortado: false });
  assert.ok(s.admitir.baneo, 'el baneo no quedó levantado');
  assert.equal(s.admitir.sigueSacado, false);
  assert.deepEqual(s.admitir.acceso, [10, 39], 'volver a admitir no le devolvió el curso a su acceso');
  assert.equal(s.trasAdmitir.r.tipo, 'mandado', 'después de volver a admitirlo, invitarlo sigue frenado');
  assert.ok(s.trasAdmitir.log.includes('marcar:ana@x.mx:39'));
});

test('5. el motivo se le dice a la persona: qué hacer y dónde, en neutro y en tú', () => {
  const t = R().textos.sacado;
  assert.ok(t, 'falta el texto del motivo `sacado`');
  assert.match(t, /Members/, 'no dice dónde se arregla');
  assert.match(t, /vuelve a admitir/i, 'no dice qué hacer');
  assert.deepEqual(marcasDeVoseo(t), [], 'vosea');
  assert.doesNotMatch(t, /\blo sacaron\b|\badmitirlo\b/i, 'no es neutro en género');
});
