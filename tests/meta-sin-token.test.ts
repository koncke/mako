// =============================================================================
// «¿Conectar Meta sigue igual, con el access token?» → No: con Facebook, por Zernio (27/10/2026)
// =============================================================================
// Joan preguntó en el grupo de Código Inmobiliario (ws13) la frase de abajo, textual. MaKo le contestó «Sí…» con el link a la
// tarjeta de Meta Ads (`?abrir=meta`). Martín: «Esta muy mal esta rpta, ya no existe TOKEN de meta, todo por zernio con un simple
// login de facebook, aclaralo bien y modifica el onboarding». Todo lo que MaKo sabe de conectar Meta sale de
// lib/conexiones-catalogo.ts (`META_POR_ZERNIO`): la ruta (la tarjeta de Zernio), los pasos y la aclaración. Este test pasa la
// pregunta de Joan por el camino del código —qué conexión nombra, qué link y qué pasos le da la guía de WhatsApp, qué lee el
// modelo en su prompt— y exige que nada diga «token» ni mande a `?abrir=meta`.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buscarConexion, conexion, conexionesParaElPrompt, importanteDe } from '../lib/conexiones-catalogo';
import { textoDelPaso } from '../lib/doer-ayuda';
import { hechosMako } from '../lib/hechos-mako';
import { areasDelMensaje } from '../lib/mako-intencion';
import { POSTERGABLE_TXT } from '../lib/capas';

const PREGUNTA_DE_JOAN = 'el proceso de onboarding de conexion con la app de meta, generar el access token y eso sigue siendo el mismo?';
const BASE = 'https://hola-mako.com';
const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

test('la pregunta de Joan cae en Meta, y Meta se conecta en la tarjeta de Zernio', () => {
  assert.ok(areasDelMensaje(PREGUNTA_DE_JOAN).includes('integraciones'), 'la pregunta no trae las herramientas de conectar');
  assert.ok(areasDelMensaje('cómo genero el access token de meta?').includes('integraciones'), 'sin «conexión», el token no trae como_conectar');
  const c = buscarConexion(PREGUNTA_DE_JOAN);
  assert.equal(c?.key, 'meta');
  assert.equal(c!.ruta, '/integraciones?abrir=zernio');
  assert.equal(c!.aclaracion, 'con tu Facebook, por Zernio');
});

test('lo que la guía de WhatsApp le manda a Joan, paso por paso, no dice «token» ni manda a abrir=meta', () => {
  const c = conexion('meta')!;
  const pasos = c.pasos ?? [];
  assert.ok(pasos.length >= 3 && pasos.length <= 5, `${pasos.length} pasos`);
  const link = `${BASE}${c.ruta}&ws=13`;
  const respuesta = pasos.map((_, i) => textoDelPaso(c, pasos, i, link)).join('\n\n');
  assert.doesNotMatch(respuesta, /token/i);
  assert.doesNotMatch(respuesta, /abrir=meta/);
  assert.match(respuesta, /abrir=zernio/);
  assert.match(respuesta, /Facebook/);
  // La API key de Zernio, en UNA línea y sólo si hace falta (el Cerebro, 27/10).
  assert.deepEqual(pasos.filter((p) => /API key/.test(p)).map((p) => /^Si te pide/.test(p)), [true]);
  // Lo que lee el modelo con la conexión: tampoco nombra el token.
  assert.doesNotMatch(importanteDe(c) ?? '', /token/i);
});

test('el prompt de MaKo: Meta con su aclaración y a la tarjeta de Zernio, el método de antes no se explica', () => {
  const lista = conexionesParaElPrompt(BASE);
  assert.match(lista, /- Meta Ads \(con tu Facebook, por Zernio\): https:\/\/hola-mako\.com\/integraciones\?abrir=zernio/);
  const h = hechosMako(BASE);
  assert.ok(!h.includes('abrir=meta'), 'el prompt manda a conectar Meta en su tarjeta');
  assert.match(h, /META SE CONECTA CON FACEBOOK, POR ZERNIO, Y SÓLO ASÍ/);
  assert.match(h, /no expliques lo de antes ni lo nombres/);
});

test('nada del código le da a la persona un link a abrir=meta para conectar', () => {
  // La ayuda del doer (DEEP_LINKS) y la API de MaKo: el link de Meta sale del catálogo.
  const doer = leer('../lib/mako-doer-in.ts');
  assert.doesNotMatch(doer.slice(doer.indexOf('const DEEP_LINKS'), doer.indexOf('Ej: "Con Jesús')), /abrir=meta/);
  const run = sinComentarios(leer('../lib/api-mako/areas/integraciones.run.ts'));
  assert.match(run, /const linkIntegracion = \(key: string\): string => linkPantalla\(conexion\(key\)\?\.ruta \?\?/);
  assert.doesNotMatch(run, /abrir=meta/);
  // Los pasos de la CONEXIÓN ganan sobre el tutorial del modal de Meta, en la API y en la guía de WhatsApp.
  assert.match(run, /pasos: c\.pasos \?\? tarjeta\?\.tutorial\.pasos \?\? \[\],/);
  assert.match(run, /pasos: cx\?\.pasos \?\? s\.tutorial\.pasos,/);
  assert.match(doer, /const pasos = c\.pasos \?\? servicioMetodo\(c\.key\)\?\.tutorial\.pasos \?\? \[\];/);
  // Lo que viaja hacia el modelo no se llama «token_de_meta».
  assert.doesNotMatch(run, /token_de_meta/);
});

test('el onboarding: el paso de Meta que quedó pendiente lleva a conectar con Facebook, a la misma ruta que el catálogo', () => {
  assert.equal(POSTERGABLE_TXT.integraciones.ruta, conexion('meta')!.ruta);
  assert.match(POSTERGABLE_TXT.integraciones.que, /Facebook/);
  assert.doesNotMatch(POSTERGABLE_TXT.integraciones.que, /token/i);
});
