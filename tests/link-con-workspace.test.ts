import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { linkApp } from '../lib/app-url';

// =============================================================================
// Un link que se MANDA afuera lleva el `?ws=`, o abre la pantalla equivocada
// =============================================================================
// Un aviso viaja al teléfono de alguien que puede tener la app parada en OTRO workspace.
// Sin el parámetro, el link abre la pantalla en el workspace de la pestaña y la app contesta
// «este lead no es de esta cuenta» sobre un lead que sí es suyo. Medido el 05/10/2026 con el
// aviso de «nuevo agendado»: se lee como una fuga entre clientes y es un destino que falta.
//
// El guard mira el FUENTE y no los tipos, porque esto no es un error de tipos: un template
// literal con la URL pegada a mano compila perfecto.
//
// Probado rompiéndolo: devolviendo `/crm/${id}` a mano en `linkResumenLead`, cae el primero
// (2 pasan / 1 falla); con `conWs` devolviendo el href intacto, caen los dos de abajo (1/2).

/** Pantallas que viven DENTRO de un workspace: un link a éstas sin `ws` aterriza mal. */
const DE_INQUILINO = ['/crm', '/whatsapp', '/chatbot', '/email', '/customer-success', '/plan', '/funnel', '/mensajes'];

/**
 * Lo que el guard NO mira, con su motivo:
 *  · `mako-doer-in.ts` — es el PROMPT que describe la forma de una URL, no un link que sale.
 *  · `app-url.ts` — es donde vive el helper.
 */
const FUERA = ['lib/mako-doer-in.ts', 'lib/app-url.ts'];

function tsDe(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsDe(p, out);
    else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

test('ningún link que se manda arma la URL a mano', () => {
  const malos: string[] = [];
  for (const abs of [...tsDe(join(RAIZ, 'lib')), ...tsDe(join(RAIZ, 'app', 'api'))]) {
    const rel = abs.replace(/\\/g, '/').replace(/^.*?\/(lib|app)\//, '$1/');
    if (FUERA.some((f) => rel.endsWith(f))) continue;
    const src = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
    for (const linea of src.split('\n')) {
      // `${APP_BASE_URL}/crm…` o `${APP_URL}/whatsapp…`: la URL pegada a mano.
      const m = linea.match(/\$\{APP_(?:BASE_)?URL\}(\/[a-z-]+)/);
      if (m && DE_INQUILINO.includes(m[1])) malos.push(`${rel} → ${m[1]}`);
    }
  }
  assert.deepEqual(malos, [], `Estos links salen sin el workspace; van por linkApp(ruta, ws):\n  ${malos.join('\n  ')}`);
});

test('linkApp le pega el workspace al destino', () => {
  const l = linkApp('/crm/2439/resumen', 13);
  assert.match(l, /\/crm\/2439\/resumen\?ws=13$/);
  // Con query propia, el ws se suma sin pisarla.
  assert.match(linkApp('/whatsapp?canal=no-oficial', 1), /canal=no-oficial/);
  assert.match(linkApp('/whatsapp?canal=no-oficial', 1), /ws=1/);
});

test('sin workspace devuelve el link tal cual, no uno roto', () => {
  // Un cron que todavía no itera inquilinos no tiene ws: el link queda como antes (sin el
  // parámetro) en vez de salir con `ws=null` pegado, que abriría una pantalla vacía.
  const l = linkApp('/crm/7', null);
  assert.ok(l.endsWith('/crm/7'), l);
  assert.ok(!l.includes('ws='), l);
});
