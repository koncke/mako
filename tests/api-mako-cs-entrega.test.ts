// =============================================================================
// La ENTREGA de un cliente por la API de MaKo (23/10/2026, P0-5 de la auditoría de la API)
// =============================================================================
// Pedido de Martín (23/10/2026, desde el Ops Center): «Revisá esto... Y si hay que hacer una revisión completa de la
// API, porque creo que faltan muchas acciones posibles». La auditoría puso ésta en P0: proponer_cambio_etapa y
// mover_lead_en_producto mueven el CRM, y nada del registro escribía la entrega (cliente_entrega). Lo que fija:
//   · las tres operaciones usan LAS MISMAS funciones que el kanban y la ficha, y el área no escribe la entrega a mano;
//   · las etapas se leen ESTRICTO (validar contra las de fábrica deja a un cliente en una columna que no se dibuja);
//   · quitar no deja a nadie sin servicio, y lo frena en preparar();
//   · devolver mira lo que QUEDÓ: sin etapa y sin ser el servicio de su embudo, entra a la primera;
//   · «Quitar de este producto» y su deshacer son UNA implementación (lib/cs-quitar-producto.ts) para la pantalla y la API.
//
// Probado rompiéndolo (23/10/2026, este archivo, base 6 / 0), cada rotura → 1 fallo y 5 pases:
//   · mover con entregaDeProducto (la tolerante) en vez de la estricta;
//   · quitar sin la pregunta de «es su único servicio»;
//   · devolver sin mirar si quedó en el servicio;
//   · mover_cliente_entrega con HTTP;
//   · la action de la pantalla con su propia copia de la regla (escribe cliente_entrega_fuera otra vez);
//   · cs.run.ts escribiendo cliente_entrega por su cuenta.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFS } from '../lib/api-mako/areas/cs.def';
import { esAccion } from '../lib/api-mako/tipos';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RUN = sinComentarios(leer('lib/api-mako/areas/cs.run.ts'));

function runner(id: string): string {
  const ini = RUN.indexOf(`  ${id}: {`);
  assert.ok(ini >= 0, `no encontré el runner ${id}`);
  const fin = RUN.slice(ini + 1).search(/\n {2}[a-z_]+: \{|\n\};/);
  const cuerpo = fin < 0 ? RUN.slice(ini) : RUN.slice(ini, ini + 1 + fin);
  assert.ok(cuerpo.length > 200 && cuerpo.length < 7000, `el recorte de ${id} mide ${cuerpo.length}: está mirando otra cosa`);
  return cuerpo;
}
const ENTREGA = ['mover_cliente_entrega', 'quitar_cliente_de_servicio', 'devolver_cliente_a_servicio'] as const;

test('las tres están: sin HTTP, para quien usa la tab, y con «sí» fuerte las que arrancan automatizaciones', () => {
  for (const id of ENTREGA) {
    const d = DEFS.find((x) => x.id === id);
    assert.ok(d && esAccion(d), `falta ${id}`);
    assert.ok(!d.canales.includes('http'), `${id} sale por HTTP: mueve clientes de etapa con datos de personas`);
    assert.equal(d.confirmacion, 'chat', id);
    assert.equal(d.reversible, true, id);
    assert.equal(d.gating?.rolMinimo, undefined, `${id}: la pantalla no mira el rol, y MaKo no puede esconder lo que la pantalla muestra`);
    assert.equal(d.aTerceros === true, id !== 'quitar_cliente_de_servicio', `${id}: entrar a una etapa arranca sus automatizaciones`);
  }
});

test('mover usa el choke point, con las etapas leídas ESTRICTO, y vuelve a mirar al cliente al confirmar', () => {
  const r = runner('mover_cliente_entrega');
  assert.match(r, /await moverClienteDeEtapa\(\{ leadId, productoId: Number\(p\.productoId\), etapa: String\(p\.etapa\), por: autorDe\(ctx\) \}\)/);
  assert.match(r, /if \(!\(await clienteDelWorkspace\(leadId\)\)\) return \{ ok: false/, 'entre la propuesta y el «sí» pudo dejar de ser cliente');
  const pedido = RUN.slice(RUN.indexOf('async function servicioPedido('), RUN.indexOf('function etapaPedida('));
  assert.match(pedido, /await entregaDeProductoEstricta\(/);
  assert.doesNotMatch(pedido, /entregaDeProducto\(/, 'la tolerante cae a las etapas de fábrica');
});

test('quitar no deja a nadie sin servicio, y lo frena antes de confirmar', () => {
  const r = runner('quitar_cliente_de_servicio');
  assert.match(r, /if \(suyos\.length < 2\) return \{ error:/);
  assert.match(r, /await quitarClienteDeProducto\(leadId, Number\(p\.productoId\), autorDe\(ctx\)\)/);
});

test('devolver mira lo que QUEDÓ: si no volvió al servicio, entra a la primera etapa por el choke point', () => {
  const r = runner('devolver_cliente_a_servicio');
  assert.match(r, /await volverClienteAProducto\(leadId, productoId, etapa, null, por\)/);
  assert.match(r, /if \(!\(await productosDelCliente\(leadId\)\)\.productos\.includes\(productoId\)\) \{\s*const m = await moverClienteDeEtapa\(\{ leadId, productoId, etapa: null, por \}\)/);
});

test('el área no escribe la entrega por su cuenta', () => {
  assert.doesNotMatch(RUN, /from\('cliente_entrega(?:_fuera)?'\)\.(?:insert|update|upsert|delete)\(/, 'cs.run.ts escribiría la entrega con una segunda forma');
});

test('«Quitar de este producto» y su deshacer: la pantalla delega en la misma implementación que la API', () => {
  const acc = sinComentarios(leer('app/customer-success/actions.ts'));
  assert.match(acc, /await quitarClienteDeProducto\(leadId, productoId, await autorActual\(\)\)/);
  assert.match(acc, /await volverClienteAProducto\(leadId, productoId, etapa, reloj, await autorActual\(\)\)/);
  assert.doesNotMatch(acc, /cliente_entrega_fuera/, 'la action volvió a tener su propia copia de la regla');
});
