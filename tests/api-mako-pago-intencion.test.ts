// =============================================================================
// «Juan me pagó 500 mil pesos» y «cambiale el vencimiento a la cuota 3» llegan con SUS herramientas (17/10/2026)
// =============================================================================
// Medido el 17/10/2026 con tsx contra `herramientasDelTurno` (el turno que CORRE), ANTES de esta regla:
//   · «ya me pagó la cuota 2», «Juan me pagó 500 mil pesos», «registrá un pago de 500 mil pesos de Juan» → `capturar`,
//     dudosa, DOS herramientas. MaKo no tenía `registrar_pago_suelto` ni `marcar_pago_cobrado` en el turno: el pago no se
//     podía registrar (y el diagnóstico obvio, «a la operación le falta la moneda», dejaba esto sin ver);
//   · «cambiale el vencimiento a la cuota 3» y «mandale el link de la cuota 2» → sin área: las nueve operaciones de
//     Pagos campo por campo (área `cobros`) sólo viajaban cuando el mensaje nombraba un «link de pago».
// La señal es el HECHO o el objeto (una cuota con su número, un pago, un monto) más el verbo, la misma lección de
// `esPedidoDeCobro` (lib/mako-intencion.ts). Lo que NO tiene que cambiar —la cuota de IA, una pregunta, «anotá en el
// plan…», lo que pagó mi socio por la comida— está fijado acá también.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez con un arnés que restaura byte a byte. Con el código como está: 3 / 0.
// Rota (pases / fallos), todas lib/mako-intencion.ts:
//   · sin el tipo `pago` (sin verbo de cobro)                                                → 2 / 1
//   · sin el tipo `cuota` (con verbo de cobro)                                               → 2 / 1
//   · la cuota de IA o de WhatsApp cuenta como cuota de pago (sin `CUOTA_DE_USO`)             → 2 / 1  (antes de sumar «cortale el recordatorio de la cuota diaria de WhatsApp»: 3 / 0)
//   · «pagó» sin tilde es su propio objeto (se busca el objeto CON el verbo)                   → 2 / 1
//   · una pregunta de pago («¿ya te pagó Ana?») se ejecuta                                      → 2 / 1
//   · el pago sin el área `cobros` (sin ver_moneda_negocio)                                   → 2 / 1
//   · la cuota sin el área `crm` (sin cobranza_lead)                                          → 2 / 1
// Correr: MAKO_TESTS_SIN_ESPERA=1 node --test --import tsx tests/api-mako-pago-intencion.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion, esPedidoDeCobro } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import type { Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');

/** Los NOMBRES de las herramientas de siempre (server-only): se los pide a un node aparte, como api-mako-cobros.test.ts. */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

function turno(mensaje: string) {
  const veredicto = clasificarIntencion(mensaje, {});
  const t = herramientasDelTurno({ veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: false });
  return { veredicto, nombres: t.tools.map((x) => x.name) };
}

const PAGOS: Array<{ mensaje: string; espera: string[] }> = [
  { mensaje: 'ya me pagó la cuota 2', espera: ['marcar_pago_cobrado', 'cobranza_lead', 'registrar_pago_suelto'] },
  { mensaje: 'Juan me pagó 500 mil pesos', espera: ['registrar_pago_suelto', 'marcar_pago_cobrado', 'ver_moneda_negocio'] },
  { mensaje: 'Ana me transfirió 300 dólares', espera: ['registrar_pago_suelto'] },
  { mensaje: 'registrá un pago de 500 mil pesos de Juan', espera: ['registrar_pago_suelto'] },
  { mensaje: 'Pedro pagó 200 de la cuota 3', espera: ['marcar_pago_cobrado', 'cobranza_lead'] },
  { mensaje: 'marcá la cuota 2 de Ana como cobrada', espera: ['marcar_pago_cobrado', 'cobranza_lead'] },
  { mensaje: 'me pagaron la cuota de Laura', espera: ['marcar_pago_cobrado'] },
];
const CUOTAS: Array<{ mensaje: string; espera: string[] }> = [
  { mensaje: 'cambiale el vencimiento a la cuota 3 de Ana', espera: ['editar_cuota', 'cobranza_lead', 'buscar_leads'] },
  { mensaje: 'cambiá el vencimiento de la cuota 3 de Ana al 20', espera: ['editar_cuota'] },
  { mensaje: 'mandale el link de la cuota 2 a Pedro', espera: ['crear_link_cuota', 'cobranza_lead'] },
  { mensaje: 'cortale el recordatorio de la cuota 2', espera: ['cortar_recordatorio_cuota'] },
  { mensaje: 'ponele 300 a la cuota 3 de Juan', espera: ['editar_cuota'] },
  { mensaje: 'hola mako, mové la tercera cuota de Laura al 15', espera: ['editar_cuota'] },
  { mensaje: '¿puedes cambiar el vencimiento de la cuota 2 de Ana?', espera: ['editar_cuota'] },
  { mensaje: 'pasale el link de la cuota inicial a Sofía', espera: ['crear_link_cuota'] },
];

test('⚠️ un pago que llegó, dicho o pedido, es una acción y trae SUS herramientas (por el turno que CORRE)', () => {
  for (const { mensaje, espera } of PAGOS) {
    const r = turno(mensaje);
    assert.equal(r.veredicto.intencion, 'actuar', `«${mensaje}» no es una acción: ${r.veredicto.porque}`);
    assert.equal(esPedidoDeCobro(mensaje)?.tipo, 'pago', mensaje);
    for (const id of espera) assert.ok(r.nombres.includes(id), `«${mensaje}» → ${r.veredicto.porque}: no trae ${id} (llegaron ${r.nombres.length})`);
  }
});

test('⚠️ cambiar, mandar el link o cortar el recordatorio de una cuota trae las herramientas de cobros', () => {
  for (const { mensaje, espera } of CUOTAS) {
    const r = turno(mensaje);
    assert.equal(r.veredicto.intencion, 'actuar', `«${mensaje}» no es una acción: ${r.veredicto.porque}`);
    assert.equal(esPedidoDeCobro(mensaje)?.tipo, 'cuota', mensaje);
    for (const id of espera) assert.ok(r.nombres.includes(id), `«${mensaje}» → ${r.veredicto.porque}: no trae ${id} (llegaron ${r.nombres.length})`);
  }
});

test('lo que NO es un pago ni una cuota del plan sigue siendo lo que era', () => {
  const no = [
    'aumentá la cuota de IA',                              // la cuota del NEGOCIO
    'cortale el recordatorio de la cuota diaria de WhatsApp', // «cuota» + «recordatorio» sin ser un pago
    'la cuota diaria de WhatsApp está llena',
    'cuántas cuotas tiene el plan de Ana',                  // una pregunta
    '¿ya te pagó Ana la cuota 2?',                          // una pregunta se contesta
    '¿cuánto le falta pagar en la cuota 2?',
    'mi socio me pagó la comida',                           // pagar no es siempre un cobro: falta lo que se pagó
    'me pagó el cliente',
    'anotá en el plan: cambiar el vencimiento de la cuota 3', // del Plan
    'anotá en el plan: registrar el pago de Ana',
    'Idea: cuotas automáticas para todos',                  // un volcado
    'Stripe registra el pago solo',                         // tercera persona
    'el cliente cambia la cuota 3 cada mes',
  ];
  for (const m of no) assert.equal(esPedidoDeCobro(m), null, `«${m}» se leyó como un pedido de cobro`);
  // Lo de antes conserva su tipo: un reembolso de una cuota es un reembolso, un link de pago es un link.
  assert.equal(esPedidoDeCobro('reembolsale la cuota 2 a Ana')?.tipo, 'reembolso');
  assert.equal(esPedidoDeCobro('mandale un link de pago a Ana')?.tipo, 'link');
  assert.equal(esPedidoDeCobro('cancelá la suscripción de Pedro')?.tipo, 'suscripcion');
  // Una pregunta se contesta: no viaja la que escribe.
  const q = turno('¿ya te pagó Ana la cuota 2?');
  assert.notEqual(q.veredicto.intencion, 'actuar');
  assert.ok(!q.nombres.includes('registrar_pago_suelto'));
});
