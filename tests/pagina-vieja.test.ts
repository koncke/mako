// LA FICHA DE UN LEAD RECIÉN EXTRAÍDO NO CARGABA SIN F5 (Leila, 26/10/2026, Fathom 876470842-10). Una pestaña de antes de
// un despliegue llama a server actions que ya no existen; la ficha de los leads de antes salía de su memoria y se callaba
// el error, la de uno nuevo decía «No se pudo cargar el lead». Ahora se recarga sola UNA vez y abre ese lead (`?abrir=`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esPaginaVieja, recargarUnaVez, urlParaAbrirLead, ENTRE_RECARGAS_MS } from '../lib/pagina-vieja';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

test('se reconoce la pestaña de antes de un despliegue por lo que dice Next, y nada más', () => {
  assert.equal(esPaginaVieja(new Error('An unexpected response was received from the server.')), true);
  assert.equal(esPaginaVieja(new Error('Failed to find Server Action "7f3a". This request might be from an older or newer deployment.')), true);
  assert.equal(esPaginaVieja(Object.assign(new Error('Server Action "7f3a" was not found on the server.'), { name: 'UnrecognizedActionError' })), true);
  assert.equal(esPaginaVieja(new Error('Error obteniendo lead 12: timeout')), false, 'un error de la base no es una página vieja');
  assert.equal(esPaginaVieja(null), false);
});

test('recarga UNA vez por clave (sin bucle), y sin sessionStorage no recarga sola', () => {
  const g = globalThis as Record<string, unknown>;
  const fuiA: string[] = [];
  const guardado = new Map<string, string>();
  g.window = {
    sessionStorage: { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => { guardado.set(k, v); } },
    location: { assign: (u: string) => { fuiA.push(u); } },
  };
  try {
    assert.equal(recargarUnaVez('ficha-7', 'https://hola-mako.com/crm?abrir=7', 1_000_000), true);
    assert.equal(recargarUnaVez('ficha-7', 'https://hola-mako.com/crm?abrir=7', 1_000_000 + 5_000), false, 'recargó dos veces seguidas: si no lo arregla, es un bucle');
    assert.equal(recargarUnaVez('ficha-7', 'https://hola-mako.com/crm?abrir=7', 1_000_000 + ENTRE_RECARGAS_MS + 1), true);
    assert.deepEqual(fuiA, ['https://hola-mako.com/crm?abrir=7', 'https://hola-mako.com/crm?abrir=7']);
    g.window = { sessionStorage: { getItem: () => { throw new Error('bloqueado'); }, setItem: () => {} }, location: { assign: (u: string) => { fuiA.push(u); } } };
    assert.equal(recargarUnaVez('ficha-8', 'x', 1), false, 'sin marca no hay cómo frenar un bucle');
  } finally {
    delete g.window;
  }
  // La dirección conserva lo que tenía (el funnel) y suma el lead.
  assert.equal(urlParaAbrirLead('https://hola-mako.com/crm?funnel=3', 41), 'https://hola-mako.com/crm?funnel=3&abrir=41');
});

test('la ficha la usa, y el tablero abre `?abrir=` apenas tiene el lead', () => {
  const modal = leer('app/crm/LeadEditModal.tsx');
  assert.match(modal, /if \(esPaginaVieja\(e\)\) \{\n\s+if \(recargarUnaVez\(`ficha-\$\{leadId\}`, urlParaAbrirLead\(window\.location\.href, leadId\)\)\) return;/, 'la ficha sigue callándose el error de una página vieja');
  assert.match(modal, /MaKo se actualizó mientras tenías esta página abierta\./);
  const tablero = leer('app/crm/CrmBoard.tsx');
  assert.match(tablero, /const abrirDeUrl = useRef\(sp\.get\('abrir'\)\);/);
  assert.match(tablero, /abrirDeUrl\.current = null;\n\s+setSelectedId\(v\);/, 'el tablero no abre el lead al volver de la recarga');
});
