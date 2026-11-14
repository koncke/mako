// «Editar» un carrusel sin oferta principal: pregunta CUÁL, no adivina (14/11/2026). Y al inspeccionar, el aviso nombra de quién es la IA.
//
// La demo del 13/11/2026 con Julio (Fathom 203125958, min 41:31-42:21; docs/relevo/llamada-julio-13-11.md, «Lo que falló en la
// demo»). Martín tocó «Editar» en Image y leyó en vivo: «no sé por qué no dice MaKo… te dice que no es tu embudo, es el de
// Mauricio». Se creyó que estaba inspeccionando la cuenta de Mauricio y que la IA de Mauricio había fallado. Medido en producción:
//   · las 10 respuestas de IA de esa réplica (anthropic_usage, 21:14:58 → 21:15:48 UTC) son del ws 9, el de Martín: NO inspeccionaba;
//   · la IA contestó (49 s en escribir); la réplica terminó bien a los 95 s (request-logs de Vercel), cuando él ya había pasado a
//     Automations;
//   · su negocio tiene «WhatsApp Ads Funnel» (orden 0), «MaKo Acelerador» y una newsletter, NINGUNA principal, y lo de por defecto
//     tomaba «la primera»: el saludo dijo «para «WhatsApp Ads Funnel»», un embudo que él armó para Mauricio.
//
// Esto fija (lib/carruseles/guiado.ts, app/image-editor/carruseles/ReplicarGuiado.tsx, lib/carruseles/replica.ts y la ruta):
//   1. con varias ofertas y ninguna principal no arranca: pregunta SÓLO la oferta, y al contestar arranca con lo demás por defecto;
//   2. «Lo escribo yo» en esa pregunta también arranca;
//   3. con una principal, con una sola o sin ninguna, arranca como antes (nada que adivinar);
//   4. el saludo dice por qué pregunta, y no nombra una oferta que nadie eligió;
//   5. inspeccionando, el aviso de la IA nombra al negocio y sus Integraciones; sin inspeccionar, el de siempre;
//   6. la ruta pasa el nombre sólo si la vista es del MISMO negocio que el pedido.
//
// Verificado rompiéndolo (14/11/2026), cada rotura sola y restaurada: ver el pie.
//
// Correr: node --import tsx --test tests/carruseles-oferta-sin-principal.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VALOR, escribir, hayQuePreguntarOferta, pasoDe, pedidoDelGuiado, preguntaDe, responder, respuestasPorDefecto, type HechosGuiado,
} from '../lib/carruseles/guiado';
import { avisoSinIA } from '../lib/carruseles/replica';

const leer = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// Las ofertas ACTIVAS del ws 9 el 14/11/2026, tal cual (listarOfertas(true), en su orden).
const DEL_WS9 = [
  { id: 14, nombre: 'WhatsApp Ads Funnel', principal: false },
  { id: 31, nombre: 'MaKo Acelerador', principal: false },
  { id: 34, nombre: 'Newslletter PRUEBA JULIO', principal: false },
];

const hechos = (o: Partial<HechosGuiado> = {}): HechosGuiado => ({
  laminas: 9, creador: '@lifeofarjav', ofertas: DEL_WS9, persona: null, leyendo: true,
  fotos: { cara: true, look: false }, kit: true, ...o,
});

test('1 · varias ofertas sin principal: pregunta SÓLO cuál, y al contestar arranca con lo demás por defecto', () => {
  const h = hechos();
  assert.equal(hayQuePreguntarOferta(DEL_WS9), true);
  const r = respuestasPorDefecto(h);
  assert.equal(r.oferta, undefined, `eligió «${r.oferta && 'nombre' in r.oferta ? r.oferta.nombre : ''}» a ciegas`);
  assert.equal(r.listo, false, 'arrancó sin saber para qué oferta');
  assert.equal(pasoDe(h, r), 'oferta');
  assert.equal(pedidoDelGuiado(h, r), null, 'el pedido salió sin oferta mientras se preguntaba');
  const p = preguntaDe(h, r);
  assert.ok(p && /ofertas/.test(p.texto), p?.texto);
  const valores = (p?.botones ?? []).map((b) => ('valor' in b ? b.valor : null));
  assert.ok(valores.includes(VALOR.oferta(14)) && valores.includes(VALOR.oferta(31)), valores.join(', '));
  // Contesta «MaKo Acelerador»: arranca, sin preguntar la foto ni qué cambiar (eso ya estaba por defecto).
  const r2 = responder(h, r, { tipo: 'respuesta', rotulo: 'MaKo Acelerador', valor: VALOR.oferta(31) });
  assert.equal(pasoDe(h, r2), 'listo', 'después de la oferta siguió preguntando');
  assert.deepEqual(pedidoDelGuiado(h, r2), { ofertaId: 31, ofertaLibre: null, avatar: 'cara', cambio: 'textos', pedido: null });
});

test('2 · «Lo escribo yo» en esa pregunta también arranca', () => {
  const h = hechos();
  const r = responder(h, respuestasPorDefecto(h), { tipo: 'respuesta', rotulo: 'Lo escribo yo', valor: VALOR.ofertaLibre });
  assert.equal(r.escribiendo, 'oferta');
  const r2 = escribir(h, r, 'Mentoría para agencias');
  assert.equal(pasoDe(h, r2), 'listo');
  assert.equal(pedidoDelGuiado(h, r2)?.ofertaLibre, 'Mentoría para agencias');
});

test('3 · con una principal, con una sola o sin ninguna: arranca como antes', () => {
  const conPrincipal = hechos({ ofertas: DEL_WS9.map((o) => ({ ...o, principal: o.id === 31 })) });
  const r = respuestasPorDefecto(conPrincipal);
  assert.deepEqual(r.oferta, { id: 31, nombre: 'MaKo Acelerador' });
  assert.equal(pasoDe(conPrincipal, r), 'listo');
  const una = hechos({ ofertas: [DEL_WS9[0]] });
  assert.deepEqual(respuestasPorDefecto(una).oferta, { id: 14, nombre: 'WhatsApp Ads Funnel' }, 'con una sola no hay nada que adivinar');
  assert.equal(pasoDe(una, respuestasPorDefecto(una)), 'listo');
  const ninguna = hechos({ ofertas: [] });
  assert.equal(pasoDe(ninguna, respuestasPorDefecto(ninguna)), 'listo', 'sin ofertas cargadas también se escribe');
  assert.ok(pedidoDelGuiado(ninguna, respuestasPorDefecto(ninguna)));
  assert.equal(hayQuePreguntarOferta(null), false, '«no sé» (null) no es «varias»');
});

test('4 · el saludo dice por qué pregunta y no nombra una oferta que nadie eligió', () => {
  const src = leer('../app/image-editor/carruseles/ReplicarGuiado.tsx');
  assert.match(src, /const hecho = g\.r\.porDefecto && !g\.r\.soloOferta \? resumenDe/, 'el saludo vuelve a decir «para «X»» mientras pregunta');
  assert.match(src, /Ninguna de tus ofertas está marcada como principal: dime para cuál es y lo armo entero\./);
  assert.match(src, /useState<RespuestasGuiado>\(\(\) => respuestasPorDefecto\(base\)\)/, 'la pantalla dejó de arrancar con lo de por defecto');
});

test('5 · inspeccionando, el aviso de la IA nombra al negocio; sin inspeccionar, el de siempre', () => {
  const N = 'Mauricio Bustos';
  const clave = avisoSinIA('gemini: HTTP 403 API key not valid', N);
  assert.match(clave.aviso, /^El Gemini de Mauricio Bustos rechazó la clave: revísala en sus Integraciones\./);
  assert.ok(clave.conectar, 'sin el link para arreglarlo');
  const sin = avisoSinIA('No hay ninguna IA que pueda mirar esto. Conecta tu Claude, tu GPT o tu Gemini en Integraciones.', N);
  assert.match(sin.aviso, /^Mauricio Bustos no tiene conectada una IA que mire imágenes/);
  assert.match(sin.aviso, /sus Integraciones/);
  for (const e of ['anthropic: HTTP 429 rate_limit_error', 'gemini: timeout after 120000ms', 'gemini: HTTP 503 high demand', 'algo raro', 'request entity too large 413']) {
    const a = avisoSinIA(e, N).aviso;
    assert.doesNotMatch(a, /\b[Tt]u (?:IA|Claude|GPT|Gemini|cuenta|configuración|versión)\b/, `inspeccionando habla de «tu»: ${a}`);
    assert.match(a, /Mauricio Bustos/, a);
  }
  // Sin inspeccionar no cambia nada (lo cuida también tests/carruseles-replica.test.ts).
  assert.match(avisoSinIA('gemini: HTTP 403 API key not valid').aviso, /^Tu Gemini rechazó la clave: revísala en Integraciones\./);
  assert.match(avisoSinIA('gemini: HTTP 403 API key not valid', '  ').aviso, /^Tu Gemini/, 'un nombre vacío no es otro negocio');
});

test('6 · la ruta pasa el nombre sólo si la vista es del MISMO negocio que el pedido', () => {
  const ruta = leer('../app/api/image-editor/carruseles/replicar/route.ts');
  assert.match(ruta, /const negocioAjeno = vista && vista\.clienteWs === p\.ws \? vista\.clienteNombre : null;/);
  assert.match(ruta, /replicarEjemplo\(p\.ws, p\.quien, ejemplo, \{ pedido, guiado, negocioAjeno,/);
  const servidor = leer('../lib/carruseles/replica-servidor.ts');
  assert.match(servidor, /return conGuias\(avisoSinIA\(m, o\.negocioAjeno \?\? null\), errores\);/, 'el aviso no recibe el negocio');
});

// ── Verificado rompiéndolo (14/11/2026), cada rotura sola y restaurada ─────────────────────────────────────────────────
//   · `hayQuePreguntarOferta` siempre false (lo de antes: «la primera»)            → 1 y 2 rojos;
//   · `arrancaSiEraLoUnico` sin `listo: true` (pregunta la foto y qué cambiar)      → 1 y 2 rojos;
//   · `pedidoDelGuiado` sin `|| r.soloOferta` (el pedido sale sin oferta)           → 1 rojo;
//   · el saludo sin `&& !g.r.soloOferta`                                            → 4 rojo;
//   · `avisoSinIA` sin el negocio (`const ajeno = null`)                            → 5 rojo;
//   · la ruta sin `vista.clienteWs === p.ws`                                        → 6 rojo.
