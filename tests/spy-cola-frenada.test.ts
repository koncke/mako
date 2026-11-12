// =============================================================================
// Una cola de caricaturas frenada SE VE, y sólo la ve el super admin (6/11/2026)
// =============================================================================
// Las caricaturas las hace el Runner en la PC, con Canva. Si su cuenta de Claude no tiene Canva conectado **no se anota
// ningún error**: la pendiente espera, la tarjeta del competidor sigue diciendo «Haciendo su caricatura…» para siempre y
// lo único que lo delata es la espera, que crece. Hasta hoy `masVieja` tenía UN solo lector en todo el repo
// (`scripts/spy-caricaturas-pendientes.mjs`): ni cron ni pantalla. Se podía estar frenada hace días.
//
//   1. desde cuándo espera la pendiente más vieja de un negocio (y qué NO cuenta: la que falló y espera, la rendida,
//      la que ya está, la de un referente dibujado);
//   2. «frenada» es una espera que pasó el umbral, no cualquier espera;
//   3. (12/11/2026) la pantalla NO lo dice: Martín, «hay un texto innecesario que dice las caricaturas no se están
//      haciendo... el texto innecesario no lo pongas». La espera queda en `masVieja` del script del Runner.
//
// PROBADO ROMPIÉNDOLO (6/11/2026), una rotura por vez, base en verde:
//   · `esperaMasVieja` que cuenta las que esperan su reintento                 → 1
//   · `colaFrenadaDesde` sin el umbral (cualquier espera es «frenada»)         → 2
//   · (12/11) el renglón de vuelta en la pantalla, la prop en la página o `frenadaDesde` en la ruta → 3
// Correr: node --import tsx --test tests/spy-cola-frenada.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  COLA_FRENADA_MS, ESPERA_TRAS_FALLO_MS, FALLOS_HASTA_RENDIRSE,
  colaFrenadaDesde, esperaMasVieja, type RegistroCaricaturas,
} from '../lib/spy-caricatura-reglas';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const T0 = Date.parse('2026-11-06T12:00:00Z');
const hace = (ms: number) => new Date(T0 - ms).toISOString();
const HORA = 60 * 60 * 1000;
// Una foto NUESTRA: sin eso el competidor queda «fuera» de la cola (`fotoEsNuestra`).
const FOTO = 'https://xyz.supabase.co/storage/v1/object/public/spy-miniaturas/spy/foto/instagram-den.borgg.jpg';
const uno = (id: number) => ({ id, avatar: FOTO, referente: false });

test('1. desde cuándo espera la pendiente más vieja del negocio', () => {
  const reg: RegistroCaricaturas = {
    '1': { desde: hace(2 * HORA) },
    '2': { desde: hace(9 * HORA) },
    '3': { desde: hace(30 * HORA) },
  };
  assert.equal(esperaMasVieja(reg, [uno(1), uno(2), uno(3)], T0), hace(30 * HORA), 'la más vieja de las tres');
  assert.equal(esperaMasVieja(reg, [uno(1)], T0), hace(2 * HORA), 'sólo las que están en la lista del negocio');
  assert.equal(esperaMasVieja({}, [uno(1)], T0), null, 'sin registro, nada');
  assert.equal(esperaMasVieja(reg, [], T0), null);

  // Lo que NO cuenta como espera, porque no está pendiente:
  const lista: RegistroCaricaturas = { '1': { desde: hace(30 * HORA), url: `${FOTO}#caricatura` } };
  assert.equal(esperaMasVieja(lista, [uno(1)], T0), null, 'la que YA está no espera');
  const esperando: RegistroCaricaturas = { '1': { desde: hace(30 * HORA), fallos: 1, ultimoFallo: hace(HORA) } };
  assert.equal(esperaMasVieja(esperando, [uno(1)], T0), null, 'la que falló y espera su reintento no está frenada: Canva contestó');
  const rendida: RegistroCaricaturas = { '1': { desde: hace(30 * HORA), fallos: FALLOS_HASTA_RENDIRSE } };
  assert.equal(esperaMasVieja(rendida, [uno(1)], T0), null, 'la rendida ya no se intenta');
  assert.equal(esperaMasVieja(reg, [{ id: 1, avatar: FOTO, referente: true }], T0), null, 'un referente dibujado no lleva caricatura');
  assert.equal(esperaMasVieja(reg, [{ id: 1, avatar: 'https://instagram.example.com/foto.jpg', referente: false }], T0), null, 'una foto que no es nuestra queda fuera');

  // El fallo que ya cumplió su espera vuelve a ser pendiente, y su espera cuenta desde que entró.
  const reintenta: RegistroCaricaturas = { '1': { desde: hace(30 * HORA), fallos: 1, ultimoFallo: hace(ESPERA_TRAS_FALLO_MS + HORA) } };
  assert.equal(esperaMasVieja(reintenta, [uno(1)], T0), hace(30 * HORA));
});

test('2. «frenada» es una espera que pasó el umbral, no cualquier espera', () => {
  assert.equal(colaFrenadaDesde(null, T0), null, 'sin nadie esperando, no se dice nada');
  assert.equal(colaFrenadaDesde(hace(COLA_FRENADA_MS - 60_000), T0), null, 'recién entró: el Runner la hace en ~30 s, dale tiempo');
  assert.equal(colaFrenadaDesde(hace(COLA_FRENADA_MS), T0), hace(COLA_FRENADA_MS), 'justo en el umbral, sí');
  assert.equal(colaFrenadaDesde(hace(5 * 24 * HORA), T0), hace(5 * 24 * HORA));
  assert.equal(colaFrenadaDesde('no es una fecha', T0), null, 'una fecha que no es fecha no afirma nada');
  // El umbral vive por debajo de la espera tras un fallo: pasado eso, la pendiente ya no estaría «pendiente».
  assert.ok(COLA_FRENADA_MS < ESPERA_TRAS_FALLO_MS, 'con un umbral más largo que la espera tras un fallo, nunca se diría');
});

test('3. la pantalla no dice que la cola está frenada: ni a un cliente, ni al super admin', () => {
  // La espera se sigue calculando (el script del Runner la imprime como `masVieja`): lo que se fue es el renglón.
  const spy = sinComentarios(leer('lib/spy.ts'));
  assert.match(spy, /caricaturasDesde: esperaMasVieja\(registro, filas\.map/);

  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.doesNotMatch(app, /no se est[áa]n haciendo/, 'Martín, 12/11: «el texto innecesario no lo pongas»');
  assert.doesNotMatch(app, /Runner|Canva/, 'la pantalla no explica cómo se hacen las caricaturas');
  assert.doesNotMatch(app, /frenadaDesde|caricaturasFrenadasDesde/);
  assert.doesNotMatch(sinComentarios(leer('app/competitor-spy/page.tsx')), /caricaturasFrenadasDesde|colaFrenadaDesde/);
  assert.doesNotMatch(sinComentarios(leer('app/api/competitor-spy/caricaturas/route.ts')), /frenadaDesde|colaFrenadaDesde/);
});
