// =============================================================================
// Ticket #41 (3/11/2026): «Pusiste "mbustos" donde lo ven todos los usuarios, revisa en toda la app que no hayan quedado cosas así»
// =============================================================================
// La app nació como el dashboard de una sola cuenta y lo de esa cuenta quedó escrito en texto: el comando del plugin que copia un
// cliente, los system prompts que decían a qué se dedica «su» negocio, el pie de una propuesta, un placeholder. Un comentario o una
// bitácora interna sí pueden nombrarla: lo que se mira es lo que llega a una pantalla o a un modelo.
//
// Probado rompiéndolo (3/11/2026), una rotura por vez: «mbustos-digital» en TutorialAgente, 2 fallos; «Mauricio Bustos» en el prompt
// de closing, 2; en el placeholder de Plantillas, 1; en el pie de la propuesta, 1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** Lo que NO lleva a ninguna pantalla de cliente, con su razón. */
const AFUERA = [
  /^app[\\/]admin[\\/]dev[\\/]/,            // el registro de construcción: lo lee el equipo
  /^lib[\\/]datos-mau/,                     // los datos de ESE negocio
];

function archivos(dir: string): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const rel = join(dir, n);
    const st = statSync(join(RAIZ, rel));
    if (st.isDirectory()) return n === 'node_modules' || n === '.next' ? [] : archivos(rel);
    return /\.(?:tsx?|mjs|html|json|md)$/.test(n) ? [rel] : [];
  });
}

/** Sin comentarios: en un .ts dicen de dónde viene una decisión, y eso no llega a nadie. */
const sinComentarios = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/[ \t]\/\/ .*$/gm, '');

test('ninguna pantalla ni prompt nombra a «mbustos» ni a «Mauricio Bustos»', () => {
  const lugares = ['app', 'lib', 'plugin', 'public/vsl-assets'].flatMap(archivos).concat('scripts/generar-plugin.mjs');
  const caen: string[] = [];
  for (const rel of lugares) {
    if (AFUERA.some((r) => r.test(rel))) continue;
    const src = /\.tsx?$|\.mjs$/.test(rel) ? sinComentarios(leer(rel)) : leer(rel);
    for (const linea of src.split('\n')) {
      const m = /mbustos|mauricio bustos/i.exec(linea);
      if (m) caen.push(`${relative('.', rel)}: …${linea.slice(Math.max(0, m.index - 40), m.index + 40)}…`);
    }
  }
  assert.deepEqual(caen, []);
});

test('los comandos del plugin que copia el cliente son de koncke/, y el generador y el README dicen lo mismo', () => {
  const tutorial = leer('app/_components/TutorialAgente.tsx');
  assert.match(tutorial, /'\/plugin marketplace add koncke\/mako-plugin'/);
  assert.match(tutorial, /'\/plugin install mako@mako'/);
  assert.match(tutorial, /desde github\.com\/koncke\/mako-plugin'/);
  assert.match(leer('scripts/generar-plugin.mjs'), /\/plugin marketplace add koncke\/mako-plugin/);
  assert.match(leer('plugin/README.md'), /\/plugin marketplace add koncke\/mako-plugin/);
});

test('los prompts de análisis no le dicen al modelo a qué se dedica OTRO negocio', () => {
  for (const [rel, frase] of [['lib/ads-analyst.ts', 'analista de guiones publicitarios de este negocio'], ['lib/ads-analyst.ts', 'analista de guiones de este negocio'], ['lib/closing.ts', 'analista de cierres de este negocio']] as const) {
    assert.ok(leer(rel).includes(frase), `${rel}: falta «${frase}»`);
  }
  assert.doesNotMatch(leer('lib/closing.ts'), /Eres MaKo[^\n]{0,120}programa de mentoría/);
  assert.doesNotMatch(leer('lib/ads-analyst.ts'), /Eres MaKo[^\n]{0,180}programa de mentoría/);
});

// 06/11/2026: esta guarda existía y NO cazó el bug de `RE_SERVICIO_EXPLICITO`, que tenía los nombres de los PROGRAMAS de ese
// cliente decidiendo qué llamada se descartaba para todos los workspaces. Buscaba sólo el nombre de la persona, así que
// «paddock & pit» o «scaling up» le pasaban por al lado. Lo de un cliente no es sólo cómo se llama: es también cómo llama a lo
// que vende. Ver docs/hallazgos-closing.md y lib/closing-marcadores.ts.
test('ninguna pantalla ni decisión nombra los PROGRAMAS de un cliente', () => {
  // Sólo los distintivos. «Mesa de trabajo» queda afuera a propósito: es castellano corriente y daría falsos rojos en copy
  // legítimo — ese archivo lo cubre la guarda de tests/closing-marcadores.test.ts, que mira `lib/closing.ts` entero.
  const PROGRAMAS = /paddock|scaling\s*up|programa\s+v[ií]a/i;
  const lugares = ['app', 'lib', 'plugin'].flatMap(archivos);
  const caen: string[] = [];
  for (const rel of lugares) {
    if (AFUERA.some((r) => r.test(rel))) continue;
    const src = /\.tsx?$|\.mjs$/.test(rel) ? sinComentarios(leer(rel)) : leer(rel);
    for (const linea of src.split('\n')) {
      const m = PROGRAMAS.exec(linea);
      if (m) caen.push(`${relative('.', rel)}: …${linea.slice(Math.max(0, m.index - 40), m.index + 40)}…`);
    }
  }
  assert.deepEqual(caen, [], 'el nombre del programa de un cliente no decide ni se muestra a los demás: sale a configuración por workspace');
});
