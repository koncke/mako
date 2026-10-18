// =============================================================================
// El aviso «ya quedó arreglado», firmado por el Desarrollador, al grupo de MaKo de un cliente
// =============================================================================
// El pedido de Martín (17/10/2026, por el Ops Center) y por qué cada guarda: lib/aviso-arreglo-reglas.ts y
// lib/aviso-arreglo.ts. Lo que fija:
//   1. la firma, y que un aviso con una promesa o una grosería NO sale (rechaza, no corrige);
//   2. el ws de Mauricio sólo a propósito, la clave de un arreglo, y el tope del día;
//   3. el orden del envío: reservar ANTES de mandar (un aviso por arreglo), soltar la reserva si no salió, registrar y
//      anotar el eco si salió;
//   4. que el script de los jefes no manda sin `--enviar` y prueba la producción (git + Vercel) antes de llamar;
//   5. que NO es una operación del registro de la API (el modelo y las automatizaciones no firman como el equipo).
//
// Probado rompiéndolo (17/10/2026): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  textoDelAviso, claveDelAviso, bloqueoDelWs, avisosDelDia, FIRMA_DESARROLLADOR, PREFIJO_REGISTRO_AVISO, TOPE_AVISOS_POR_DIA,
} from '../lib/aviso-arreglo-reglas';
import { porId } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const JOAN = 'Ya quedó arreglado: cuando le pidas a MaKo «reprogramame la reunión…», ahora te propone moverla y, con tu «sí», la mueve.';

test('el aviso sale firmado por el Desarrollador, una sola firma', () => {
  const t = textoDelAviso(JOAN);
  assert.ok(t.ok);
  assert.ok(t.ok && t.texto.startsWith(`${FIRMA_DESARROLLADOR}\n`), 'el aviso no va firmado: el cliente lo lee como si fuera MaKo');
  // Si ya venía firmado, no se firma dos veces.
  const dos = textoDelAviso(`${FIRMA_DESARROLLADOR}\n${JOAN}`);
  assert.ok(dos.ok && dos.texto.split(FIRMA_DESARROLLADOR).length === 2, 'la firma salió dos veces');
});

test('un aviso con una promesa, una grosería o vacío no sale', () => {
  for (const malo of [
    'Ya te lo arreglo en un rato.', // promete: un aviso de arreglo dice lo que YA pasó
    'Déjame ver y te aviso cuando esté.',
    'La cagada ya está arreglada.',
    '   ',
    'x'.repeat(501),
  ]) assert.equal(textoDelAviso(malo).ok, false, `salió: «${malo.slice(0, 40)}»`);
});

test('el ws de Mauricio sólo a propósito; la clave identifica UN arreglo; el tope cuenta las últimas 24 h', () => {
  assert.ok(bloqueoDelWs(1, false), 'el ws1 (un cliente, el más viejo) recibe avisos sin que nadie lo decida');
  assert.equal(bloqueoDelWs(1, true), null);
  assert.equal(bloqueoDelWs(13, false), null);
  assert.ok(bloqueoDelWs(0, true));
  assert.equal(claveDelAviso(' Conv:12345 '), 'conv:12345');
  assert.equal(claveDelAviso('ticket:42'), 'ticket:42');
  assert.equal(claveDelAviso('a b'), null);
  assert.equal(claveDelAviso('x'), null);
  const ahora = Date.parse('2026-10-17T12:00:00Z');
  const filas = [
    { key: `${PREFIJO_REGISTRO_AVISO}conv:1`, updated_at: '2026-10-17T10:00:00Z' },
    { key: `${PREFIJO_REGISTRO_AVISO}conv:2`, updated_at: '2026-10-16T13:00:00Z' },
    { key: `${PREFIJO_REGISTRO_AVISO}conv:3`, updated_at: '2026-10-16T11:00:00Z' }, // hace más de 24 h
    { key: 'mako.grupo_jid', updated_at: '2026-10-17T11:00:00Z' }, // otra fila del negocio
  ];
  assert.equal(avisosDelDia(filas, ahora), 2);
  assert.ok(TOPE_AVISOS_POR_DIA >= 1 && TOPE_AVISOS_POR_DIA <= 5);
});

test('el envío reserva ANTES de mandar, suelta la reserva si no salió, y registra y anota el eco si salió', () => {
  const src = sinComentarios(leer('lib/aviso-arreglo.ts'));
  const fn = src.slice(src.indexOf('export async function avisarArregloAlGrupo'));
  const reserva = fn.indexOf('cambiarSettingSi(key, null,');
  const manda = fn.indexOf('enviarAlGrupoMaKo(p.ws, t.texto)');
  assert.ok(reserva > 0 && manda > reserva, 'no reserva antes de mandar: dos llamadas con la misma clave mandan dos avisos');
  assert.ok(fn.indexOf('avisosDelDia(') > 0 && fn.indexOf('avisosDelDia(') < reserva, 'el tope no se mira antes de reservar');
  const fallo = fn.slice(manda, fn.indexOf('setSetting(key'));
  assert.match(fallo, /\.delete\(\)\.eq\('workspace_id', p\.ws\)\.eq\('key', key\)/, 'si no salió, la reserva queda: el arreglo figura avisado sin que nadie lo leyera');
  assert.match(fn, /estado: 'enviado', id: env\.id/, 'si salió, no queda el registro de qué se dijo');
  assert.match(fn, /anotarEnviadoAlGrupo\(jid, env\.id\)/, 'el eco del aviso no se anota: MaKo le contesta a su propio aviso');
  assert.match(fn, /falta la prueba de que el arreglo está en producción/, 'sale sin prueba de producción');
});

test('el script no manda sin --enviar y prueba la producción con git y con Vercel antes de llamar', () => {
  const src = sinComentarios(leer('scripts/avisar-arreglo-al-grupo.mts'));
  const corte = src.indexOf("if (!enviar) { console.log('(sin --enviar: no se mandó nada)'); process.exit(0); }");
  const llama = src.indexOf('await avisarArregloAlGrupo(');
  assert.ok(corte > 0 && llama > corte, 'el script manda sin --enviar');
  assert.ok(src.indexOf('pruebaDeProduccion()') > 0 && src.indexOf('pruebaDeProduccion()') < corte, 'no prueba la producción antes');
  assert.match(src, /'merge-base', '--is-ancestor', base, punta/, 'no mira que el commit esté en main');
  assert.match(src, /'--meta', `githubCommitSha=\$\{sha\}`/, 'no mira el despliegue de Vercel de ese commit');
  assert.match(src, /●\\s\*Ready/, 'no exige que el despliegue esté Ready');
  // Y lee la tabla de Vercel donde sale: por stderr (18/10/2026, el primer aviso real no la veía).
  assert.match(src, /const salida = `\$\{r\.stdout \?\? ''\}\\n\$\{r\.stderr \?\? ''\}`;/, 'el script lee sólo stdout: la tabla de Vercel (con «Ready») sale por stderr y nunca encuentra el despliegue');
});

test('no es una operación del registro de la API: ni el modelo ni una automatización firman como el equipo', () => {
  assert.equal(porId('avisar_arreglo_al_grupo'), undefined, 'el aviso del desarrollador quedó como operación del registro: lo puede pedir el modelo');
  // Y la firma la pone sólo esta lib: ningún otro archivo de lib/ la escribe.
  const libs = readdirSync(join(RAIZ, 'lib')).filter((f) => f.endsWith('.ts') && f !== 'aviso-arreglo-reglas.ts');
  const conFirma = libs.filter((f) => readFileSync(join(RAIZ, 'lib', f), 'utf8').includes('Desarrollador de MaKo'));
  assert.deepEqual(conFirma, [], 'otro archivo firma como el Desarrollador de MaKo');
});

// Probado rompiéndolo (17/10/2026), una rotura por vez, todo en verde antes (6 de 6). 11 roturas, 1 fallo cada una:
//   · sin la firma · sin el rechazo de promesas · el ws1 sin `ws1Seguro` · una clave con espacios · el tope sin mirar la
//     hora · sin la reserva antes de mandar · sin soltar la reserva si no salió · sin anotar el eco · sin exigir la
//     prueba de producción · el script sin el corte de `--enviar` · el script sin mirar Vercel.
