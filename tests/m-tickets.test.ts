// =============================================================================
// «Reportar problema» en el teléfono (/m/tickets): las mismas rutas, la misma puerta y las mismas acciones
// =============================================================================
// 17/10/2026, «Mobile 2» (Martín: «Implementa completamente MaKo Mobile en todas las tabs»). La pantalla copia el
// Messenger de Intercom y el «Mis solicitudes» de Zendesk en el celular; lo que fija este archivo es lo invisible:
//   · /tickets y /tickets?t=<id> (el link del aviso) abren la lista y ESE ticket, y vuelven a la misma URL;
//   · la puerta es la de escritorio: todos los roles, y SIN el onboarding (`gateOnboarding: false` allá);
//   · lee con `misTickets`/`miTicket` (filtran por SU workspace y SU email) y al navegador sólo va `paraElCliente`;
//   · levanta y contesta con las acciones de escritorio, y el contexto del navegador es UNA copia.
//
// Verificado ROMPIÉNDOLO (17/10/2026, scratchpad/mobile2/romper_m2.py, de a una; base 5 / 0):
//   · `rutaMovil('/tickets')` sin mirar `?t=`                 → 4 / 1 (el link del aviso caía en la lista)
//   · `esTrabajo` sin el ticket                               → 4 / 1 (la barra de abajo tapaba la caja de responder)
//   · la página sin `onboarding: false`                       → 4 / 1 (el trabado en el wizard no podía reportar)
//   · TicketsCliente.tsx con su propia copia de `contextoDelNavegador` → 4 / 1 (desde el 23/10/2026, el motor del chat de Soporte)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rutaEscritorio, rutaInterna, rutaMovil, RUTA_MAS } from '../lib/movil-rutas';
import { cabeceraPorRuta, esTrabajo } from '../app/m/_ui/cabecera';
import { TONO_TICKET, rutaTicketM } from '../app/m/tickets/modelo';
import { ROTULO_ESTADO_CLIENTE } from '../lib/tickets-reglas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('las mismas rutas: /tickets es la lista y /tickets?t=<id> abre ESE ticket, ida y vuelta', () => {
  assert.equal(rutaMovil('/tickets'), '/m/tickets');
  assert.equal(rutaMovil('/tickets?t=12&ws=3'), '/m/tickets/12');
  assert.equal(rutaMovil('/tickets?t=abc'), '/m/tickets');
  assert.equal(rutaMovil('/tickets?t=-4'), '/m/tickets');
  assert.equal(rutaTicketM(12), '/m/tickets/12');
  assert.equal(rutaEscritorio('/m/tickets'), '/tickets');
  assert.equal(rutaEscritorio('/m/tickets/12?ws=3'), '/tickets?ws=3&t=12');
  assert.equal(rutaInterna('/tickets', 't=12'), '/m/tickets/12');
  // Lo que NO es «Reportar problema»: la Ticketera del Centro (super admin) y la bandeja de Martín.
  assert.equal(rutaMovil('/tickets/decisiones'), '/m/operaciones?ticketera=tarjetas');
  assert.equal(rutaMovil('/tickets/bandeja'), null);
  assert.equal(rutaEscritorio('/m/tickets/decisiones'), '/admin/operaciones?ticketera=tarjetas');
});

test('la cabecera: la lista vuelve a More; un ticket es una pantalla de trabajo que vuelve a la lista', () => {
  assert.deepEqual(cabeceraPorRuta('/m/tickets'), { titulo: 'Report a problem', padre: { href: RUTA_MAS, label: 'More' }, trabajo: false, conBarra: true });
  assert.equal(esTrabajo('/m/tickets/12'), true);
  assert.equal(esTrabajo('/m/tickets'), false);
  const uno = cabeceraPorRuta('/m/tickets/12');
  assert.deepEqual([uno.padre, uno.trabajo, uno.conBarra], [{ href: '/m/tickets', label: 'Report a problem' }, true, false]);
});

test('la puerta y los datos son los de escritorio: todos los roles, sin el onboarding, sólo lo SUYO', () => {
  const escritorio = leer('app/tickets/page.tsx');
  assert.match(escritorio, /requireRolWs\(\['closer', 'setter'\], \{ nav: 'tickets', gateOnboarding: false \}\)/, 'cambió la puerta de escritorio');
  for (const f of ['app/m/tickets/page.tsx', 'app/m/tickets/[id]/page.tsx']) {
    const src = leer(f);
    assert.match(src, /requireMovil\(\{ navKey: 'tickets', onboarding: false \}\)/, `${f}: la puerta`);
    assert.match(src, /paraElCliente\(/, `${f}: al navegador va sólo lo del cliente`);
  }
  assert.match(leer('app/m/tickets/page.tsx'), /misTickets\(ws, email\)/);
  assert.match(leer('app/m/tickets/[id]/page.tsx'), /miTicket\(ws, email, n\)/);
});

test('levanta y contesta con las acciones de escritorio, y el contexto del navegador es UNA copia', () => {
  // Desde el 23/10/2026 es el chat de Soporte: el MISMO motor en la computadora y en el teléfono (app/tickets/soporte/useSoporte.ts).
  const motor = leer('app/tickets/soporte/useSoporte.ts');
  assert.match(motor, /levantarDesdeSoporteAction\(\{[\s\S]{0,200}?contexto: contextoDelNavegador\(movil \? 'soporte-movil' : 'soporte'\)/);
  assert.match(motor, /contestarTicketAction\(t\.id, x\)/);
  assert.match(leer('app/m/tickets/TicketsM.tsx'), /useSoporte\(\{ tickets, movil: true \}\)/);
  assert.match(leer('app/m/tickets/SoporteM.tsx'), /useSoporte\(\{ tickets: \[t\], inicial: t\.id, movil: true \}\)/);
  for (const f of ['app/tickets/soporte/useSoporte.ts', 'app/m/tickets/TicketsM.tsx', 'app/m/tickets/SoporteM.tsx']) {
    const src = leer(f);
    assert.doesNotMatch(src, /function contextoDelNavegador/, `${f}: una copia propia del contexto`);
  }
  assert.match(motor, /from '\.\.\/navegador'/, 'el contexto sale de app/tickets/navegador.ts');
});

test('cada estado del cliente tiene su color en el teléfono', () => {
  assert.deepEqual(Object.keys(TONO_TICKET).sort(), Object.keys(ROTULO_ESTADO_CLIENTE).sort());
  assert.equal(TONO_TICKET.tu_respuesta, 'warn', 'lo que espera a la persona se ve distinto');
});
