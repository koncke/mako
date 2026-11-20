// «HOLA DE NUEVO» SIEMPRE PRIMERO (20/11/2026, Martín en la llamada con Leila, 00:37:54: «este Hola de Nuevo debería aparecerte en
// cualquiera… no importa el caso»). Dos caminos lo salteaban:
//   · RESET (la barra del Cliente de Prueba) no borraba lo visto del V2 del perfil: el recorrido seguía «visto» y el día 1 sonaba
//     primero (00:35:28). Ahora pasa el perfil por `perfilReiniciado`, como «Reiniciar onboarding».
//   · Quien termina en el TELÉFONO llega a la PC por /inicio u /onboarding, sin `?reto=1`: el chat del reto (donde está la llegada con
//     «Hola de nuevo») no se abría. Ahora /second-brain lo abre la primera vez (empezó el V2 y no vio el recorrido), sin un chat elegido.
// Roto a propósito el 20/11 (cada uno cae): RESET sin `perfilReiniciado` (1), /second-brain sin abrir el reto (2), abriéndolo aunque
// la URL elija un chat (2), y llevando al chat «Onboarding» en la primera vez (2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { perfilReiniciado } from '../lib/reiniciar-onboarding';
import { ID_RECORRIDO } from '../lib/onboarding-v2/llegada';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. RESET borra lo visto del V2 del perfil (el recorrido de «Hola de nuevo» incluido), como «Reiniciar onboarding»', () => {
  // Lo que hace `perfilReiniciado` con el recorrido de la llegada.
  const { perfil } = perfilReiniciado({ recorridos: { [ID_RECORRIDO]: '2026-11-20T15:20:00Z', 'otra-cosa': 'x' }, onboardingV2: 'x' }, '2026-11-20T19:00:00Z');
  assert.ok(!(ID_RECORRIDO in (perfil.recorridos as Record<string, unknown>)), 'el recorrido sigue visto');
  // Y que RESET lo usa, ANTES de sacar lo copiado de Mauricio (que sigue saliendo).
  const reset = sinComentarios(leer('lib/reset-workspace.ts'));
  assert.match(reset, /const perfil: Record<string, unknown> = perfilReiniciado\(u\.perfil, ahora\)\.perfil;\n\s*for \(const k of PERFIL_EXTRA\) delete perfil\[k\];/);
});

test('2. /second-brain la primera vez (empezó el V2 y no vio el recorrido), sin un chat elegido, abre el reto: ahí está «Hola de nuevo»', () => {
  const p = sinComentarios(leer('app/second-brain/page.tsx'));
  const sin = /const sinEleccion = !\(([^;]+)\);/.exec(p);
  assert.ok(sin, 'falta `sinEleccion`');
  // Cada cosa que elige un chat o un panel en la URL cuenta como elección (y el `?ws=` y el `?rebote=`, no).
  for (const k of ['chat', 'coach', 'grupo', 'offer', 'antes', 'panel', 'area', 'centro', 'ticketera', 'recorrido', 'reto', 'guru']) {
    assert.match(sin[1], new RegExp(`\\.${k}\\b`), `?${k}= no cuenta como elección`);
  }
  assert.doesNotMatch(sin[1], /\.ws\b|rebote/);
  assert.match(p, /const alReto = sinEleccion && \(await seguirEnPcPendiente\(\)\.catch\(\(\) => false\)\);/);
  assert.match(p, /const qPantalla: QuerySecondBrain = retoV2 && alReto \? \{ \.\.\.q, reto: '1' \} : q;/);
  // El chat «Onboarding» se crea igual, pero NO lleva a él: ese redirect salteaba la llegada (el dueño que llega del teléfono).
  const iAl = p.indexOf('const alReto =');
  assert.ok(iAl > 0 && iAl < p.indexOf('const hiloNuevo ='), '`alReto` se decide antes del chat «Onboarding»');
  assert.match(p, /if \(hiloNuevo && !alReto\) redirect\(await rutaConWs\(rutaDelHilo\(hiloNuevo\)\)\);/);
  assert.match(p, /<PantallaSecondBrain [^>]*q=\{qPantalla\}/, 'la pantalla recibe la query con el reto');
  // `seguirEnPcPendiente` es «empezó el V2 y no vio el recorrido» (y en un administrador mirando, lo del dueño): lib/seguir-en-pc.ts.
  assert.match(sinComentarios(leer('lib/seguir-en-pc.ts')), /return !Object\.prototype\.hasOwnProperty\.call\(vistosDePerfil\(perfil\), ID_RECORRIDO_PC\);/);
  assert.match(sinComentarios(leer('lib/seguir-en-pc.ts')), /const ID_RECORRIDO_PC = 'tutorial-ops-center';/);
  assert.equal(ID_RECORRIDO, 'tutorial-ops-center', 'la llegada y «Sigamos en tu computadora» miran el mismo recorrido');
});
