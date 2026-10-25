// =============================================================================
// «Probar» un DM de Instagram con botones: quien prueba los toca y la prueba sigue por ahí (25/10/2026)
// =============================================================================
// El Cerebro (25/10, con el pedido de Leandro): «Probar, Editar con IA y la ficha no conocen el toque. Ciérralo». Fija:
//   · el simulador (lib/simulador-grafo.ts) anota los botones de flujo de cada DM que sale (`toques`); un DM con botones y
//     sin otra flecha deja la prueba ESPERANDO el toque (no dice «Fin»: `esperaUnToque`);
//   · `tocar` abre el camino del botón, como `tocarBoton` del motor: el gate de seguidor de ManyChat se recorre entero
//     («Obtener recurso» → ¿te sigue? → no → «Ya te sigo» → ¿te sigue? → sí → el link);
//   · un flujo sin botones termina como siempre;
//   · el DM de la prueba (SimuladorSocial) dibuja los botones bajo el texto y avisa el toque al panel, que pone el toque
//     del lado del lead y sigue; uno de link abre la página.
// Correr: node --import tsx --test tests/probar-botones.test.ts
// ROTURAS (25/10/2026, una por vez y restaurada; base 5 / 0): el mensaje sin anotar sus toques → 4 / 1; `sinHilos` que
// termina igual (lo de antes) → 4 / 1; `tocar` que no abre el camino → 4 / 1; el DM de la prueba sin los botones → 4 / 1;
// el panel sin `onTocar` → 4 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { iniciar, siguiente, elegir, tocar, esperaUnToque, type EstadoSim } from '../lib/simulador-grafo';
import { RESULTADO_SI_NO, type PasoGrafo } from '../lib/flujo-grafo';
import { SimuladorSocial } from '../app/automations/SimuladorSocial';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

/** El gate de seguidor, como lo arma «Crear» (tests/crear-ia-botones.test.ts), escrito a mano. */
const GATE: PasoGrafo[] = [
  { id: 'cron', nodo: 'inicio', canal: 'instagram', siguiente: 'm1' } as PasoGrafo,
  { id: 'm1', canal: 'instagram', cuerpo: '¡Ey! Te dejo el recurso:', siguiente: null, botones: [{ id: 'b1', titulo: 'Obtener recurso', siguiente: 'c1' }] } as PasoGrafo,
  { id: 'c1', nodo: 'condicion', canal: 'instagram', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'sigue_instagram' }], siguiente: 'm2' }], si_no: 'm3' } as PasoGrafo,
  { id: 'm2', canal: 'instagram', cuerpo: '¡Aquí está! https://fiesta.example/recurso', siguiente: null } as PasoGrafo,
  { id: 'm3', canal: 'instagram', cuerpo: 'Síguenos y toca el botón.', siguiente: null, botones: [{ id: 'b1', titulo: 'Ya te sigo', siguiente: 'c1' }] } as PasoGrafo,
];

/** Corre hasta que la prueba se quede quieta; devuelve lo que salió. */
function correr(estado: EstadoSim, pasos = GATE): { estado: EstadoSim; vistos: string[] } {
  let st = estado;
  const vistos: string[] = [];
  for (let k = 0; k < 50; k++) {
    const r = siguiente(pasos, st);
    st = r.estado;
    if (!r.evento) break;
    vistos.push(r.evento.t === 'mensaje' ? r.evento.nodo : r.evento.t === 'fin' ? 'FIN' : r.evento.t);
    if (r.evento.t === 'fin' || r.evento.t === 'condicion') break;
  }
  return { estado: st, vistos };
}

test('un DM con botones y sin otra flecha deja la prueba esperando el toque (no «Fin»)', () => {
  const { estado, vistos } = correr(iniciar(GATE));
  assert.deepEqual(vistos, ['m1']);
  assert.equal(estado.terminado, false, 'la prueba terminó con un botón por tocar');
  assert.equal(esperaUnToque(estado), true);
  assert.deepEqual(estado.toques, [{ nodo: 'm1', opciones: [{ puerto: 'btn:b1', texto: 'Obtener recurso', destino: 'c1' }] }]);
});

test('tocar recorre el gate de ManyChat entero: «Obtener recurso» → no sigue → «Ya te sigo» → sigue → el link', () => {
  let { estado } = correr(iniciar(GATE));
  estado = tocar(estado, 'm1', 'btn:b1');
  let r = correr(estado);
  assert.deepEqual(r.vistos, ['condicion']);
  r = correr(elegir(r.estado, RESULTADO_SI_NO));
  assert.deepEqual(r.vistos, ['m3'], 'no le pidió que siga');
  assert.equal(esperaUnToque(r.estado), true);
  r = correr(tocar(r.estado, 'm3', 'btn:b1'));
  assert.deepEqual(r.vistos, ['condicion'], '«Ya te sigo» no volvió a revisar');
  r = correr(elegir(r.estado, 'r1'));
  assert.deepEqual(r.vistos, ['m2', 'FIN'], 'el link no llegó, o la prueba no terminó');
});

test('un botón que no está no hace nada; un flujo sin botones termina como siempre', () => {
  const { estado } = correr(iniciar(GATE));
  assert.equal(tocar(estado, 'm1', 'btn:zz'), estado);
  assert.equal(tocar(estado, 'm9', 'btn:b1'), estado);
  const sin: PasoGrafo[] = [GATE[0], { id: 'm1', canal: 'instagram', cuerpo: 'Hola', siguiente: null } as PasoGrafo];
  assert.deepEqual(correr(iniciar(sin), sin).vistos, ['m1', 'FIN']);
});

test('el DM de la prueba dibuja los botones bajo su texto (el de link, con su flecha)', () => {
  const html = renderToStaticMarkup(createElement(SimuladorSocial, {
    canal: 'instagram', negocio: 'Fiesta Music', typing: null, onEnviarTexto: async () => true,
    mensajes: [{ id: 'tx-1', fromMe: false, texto: '¡Ey! Te dejo el recurso:', fecha: '2026-10-25T03:00:00Z' }] as never,
    botones: new Map([['tx-1', { botones: [{ id: 'b1', titulo: 'Obtener recurso', siguiente: 'c1' }, { id: 'b2', titulo: 'Ver la web', url: 'https://fiesta.example' }] }]]),
    onTocar: () => {},
  }));
  assert.match(html, /data-botones-dm=""[\s\S]*>Obtener recurso<\/button>[\s\S]*>Ver la web ↗<\/button>/);
});

test('el panel: los botones del último texto, el toque del lado del lead, y espera sin «Fin»', () => {
  const p = leer('app/automations/PanelProbar.tsx');
  assert.match(p, /const conBotones = bts\.length && k === ultimoTexto \? \{ nodo, lista: bts \} : undefined;/);
  assert.match(p, /poner\(\{ id: nuevoId\('tq'\), fromMe: true, texto: b\.titulo,/);
  assert.match(p, /const despues = tocar\(antes, x\.nodo, puertoDeBoton\(b\.id\)\);/);
  assert.match(p, /if \(esperaUnToque\(estado\) && !avisoToque\.current\) \{ avisoToque\.current = true; sistema\('Toca un botón para seguir'\); \}/);
  assert.match(p, /if \(!evento\) \{ siEsperaUnToque\(estado\); return; \}/);
  assert.match(p, /botones=\{botonesMsg\} onTocar=\{tocarEnLaPrueba\}/);
});
