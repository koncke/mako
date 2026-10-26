// =============================================================================
// MaKo recomienda (26/10/2026): «¿qué me recomiendas?» llega con su herramienta, por WhatsApp y en la app
// =============================================================================
// AGENTS.md, regla 8 del registro: una capacidad nueva del doer se prueba con el turno que CORRE (`clasificarIntencion` +
// `herramientasDelTurno`), con las frases como las escribe la persona. Molde: tests/agenda-whatsapp.test.ts. Lo que fija:
//   1. las preguntas por recomendaciones traen `que_recomienda_mako` en WhatsApp y en la app;
//   2. una pregunta no trae la escritura (`decidir_recomendacion`): MaKo la ofrece, la persona decide;
//   3. «no me recomiendes eso porque…» sí trae la escritura (la corrección en lenguaje natural de Linear).
//
// Probado rompiéndolo (26/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import type { Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');

/** Los nombres de las herramientas de siempre (viven en módulos con `server-only`: se piden a un node con la condición). */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));

const WHATSAPP: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };
const APP: Vista = { canal: 'app', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

function turno(mensaje: string, vista: Vista) {
  const veredicto = clasificarIntencion(mensaje, { ...(vista.canal === 'app' ? { canal: 'app' as const } : {}) });
  const t = herramientasDelTurno({ veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: false, contextoDelSi: null });
  return { veredicto, nombres: t.tools.map((x) => x.name) };
}

const PREGUNTAS = [
  '¿qué me recomiendas?',
  'Mako, qué me recomendás hacer esta semana',
  '¿qué debería mejorar en mi negocio?',
  'dame recomendaciones',
  '¿cómo vengo con las ventas? ¿qué me sugieres?',
  'tenés alguna recomendación para mí?',
];

test('las preguntas por recomendaciones traen la lectura, por WhatsApp y en la app', () => {
  for (const vista of [WHATSAPP, APP]) {
    for (const m of PREGUNTAS) {
      const r = turno(m, vista);
      assert.ok(r.nombres.includes('que_recomienda_mako'),
        `[${vista.canal}] «${m}» → ${r.veredicto.intencion}: no trae que_recomienda_mako (llegaron ${r.nombres.length}: ${r.nombres.slice(0, 8).join(', ')}…)`);
    }
  }
});

test('una pregunta no trae la escritura: MaKo la ofrece y la persona decide', () => {
  for (const vista of [WHATSAPP, APP]) {
    for (const m of PREGUNTAS) assert.ok(!turno(m, vista).nombres.includes('decidir_recomendacion'), `[${vista.canal}] «${m}» trae decidir_recomendacion`);
  }
});

test('«no me recomiendes eso porque…» trae la escritura (corregir a MaKo con palabras)', () => {
  for (const vista of [WHATSAPP, APP]) {
    for (const m of ['no me recomiendes más lo de la landing, esa página es de prueba', 'descarta esa recomendación, ya lo hago a mano']) {
      const r = turno(m, vista);
      assert.ok(r.nombres.includes('decidir_recomendacion'), `[${vista.canal}] «${m}» → ${r.veredicto.intencion}: no trae decidir_recomendacion (${r.nombres.slice(0, 8).join(', ')}…)`);
    }
  }
});
