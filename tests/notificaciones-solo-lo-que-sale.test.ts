// =============================================================================
// Notificaciones muestra sólo los avisos que SALEN (26/10/2026)
// =============================================================================
// Martín (26/10/2026, por el Ops Center, pregunta 86c71ad9): «Sacarlos de Notificaciones». Nueve avisos se veían prendidos y
// no le salían a ningún negocio: el interruptor de la pantalla y el del store son dos cortes distintos, y sin `porDefecto` un
// aviso nace APAGADO en el store (`estaPrendida`, lib/plantillas.ts), que es lo que lee el envío. Fija:
//   · todo aviso de la lista (`AVISOS_WA_EN_VIVO`, y con ella el push) sale: va por un evento de MaKo o tiene `porDefecto`
//     'on' o 'siempre' en el catálogo;
//   · los nueve que salieron no vuelven sin su `porDefecto`, y siguen en el catálogo (su código no se tocó).
// Correr: node --import tsx --test tests/notificaciones-solo-lo-que-sale.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { AVISOS_WA_EN_VIVO, PUSH_TIPOS } from '../lib/notif-catalogo';
import { CATALOGO_AVISOS } from '../lib/avisos-catalogo';
import { AVISOS_POR_EVENTO } from '../lib/aviso-evento';

const SALIERON = ['crm-lead-estancado', 'crm-lead-quieto', 'tareas-autocompletadas', 'retro-lista', 'plan-proyecto-vence',
  'avisos-resumen', 'objetivo-en-riesgo', 'meta-alcanzada', 'quarter-planificar'];
const sale = (id: string): boolean => {
  if (AVISOS_POR_EVENTO.has(id)) return true;
  const d = CATALOGO_AVISOS.find((c) => c.id === id)?.porDefecto;
  return d === 'on' || d === 'siempre';
};

test('cada aviso de Notificaciones sale: por un evento de MaKo, o con `porDefecto` prendido', () => {
  const mudos = AVISOS_WA_EN_VIVO.filter((a) => !sale(a.id)).map((a) => a.id);
  assert.deepEqual(mudos, [], 'un interruptor que no hace nada: sin `porDefecto` nace apagado y esta pantalla no lo prende');
});

test('los nueve que salieron no vuelven a la lista ni al push, y siguen en el catálogo', () => {
  for (const id of SALIERON) {
    assert.ok(!AVISOS_WA_EN_VIVO.some((a) => a.id === id), `${id} volvió a Notificaciones`);
    assert.ok(!PUSH_TIPOS.some((a) => a.id === id), `${id} volvió al push`);
    assert.ok(CATALOGO_AVISOS.some((c) => c.id === id), `${id} se fue del catálogo: su código lo sigue emitiendo`);
  }
});

// ROTURAS (26/10/2026, una por vez y restaurada; base 2 / 0): vuelve uno de los nueve a la lista → 0 / 2; uno de la lista
// pierde su `porDefecto` (meta-anuncio-espera-aprobacion) → 1 / 1.
