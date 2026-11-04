// =============================================================================
// La barra del Ops Center: lo que se toca se ve (23/10/2026)
// =============================================================================
// Martín, en la vista de un cliente: «Revisá la navegación con el Second Brain, porque funciona bastante mal... Si estoy dentro
// de la ticketera y entro allí no hace nada». Medido en producción: la Ticketera del cliente era un estado suelto, fuera de la
// URL, que nadie cerraba al ir al grafo, y el panel la dibuja antes que el grafo. Las reglas viven en lib/ops-center-navegar.ts.
//
// Correr: node --import tsx --test tests/ops-center-navegacion.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { despuesDe, panelQueSeVe, tocarEnLaBarra, type EntradaBarra, type EstadoPanel, type PanelOps } from '../lib/ops-center-navegar';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** Todos los estados del panel: la Ticketera, el grafo y el chat nuevo, abiertos o no. */
const ESTADOS: EstadoPanel[] = [];
for (const ticketera of [false, true]) for (const mapa of [false, true]) for (const nuevo of [false, true]) ESTADOS.push({ ticketera, mapa, nuevo });

test('1. desde cualquier panel, cada entrada de la barra deja a la vista lo que se tocó (las dos barras)', () => {
  for (const alterna of [false, true]) {
    for (const s of ESTADOS) {
      const antes = panelQueSeVe(s);
      const ver = (e: EntradaBarra) => panelQueSeVe(despuesDe(s, tocarEnLaBarra(e, s, { alterna })));
      const donde = `${alterna ? 'cliente' : 'super admin'}, desde ${JSON.stringify(s)}`;
      // La Ticketera se abre y se cierra.
      assert.equal(ver('ticketera'), antes === 'ticketera' ? panelQueSeVe({ ...s, ticketera: false }) : 'ticketera', `Ticketera, ${donde}`);
      // «Second Brain»: el grafo; el del cliente, con el grafo ya a la vista, vuelve a lo elegido.
      const esperado: PanelOps = alterna && antes === 'mapa' ? 'chat' : 'mapa';
      assert.equal(ver('second-brain'), esperado, `Second Brain, ${donde}`);
      assert.equal(ver('chat'), 'chat', `un chat, ${donde}`);
      assert.equal(ver('nuevo'), 'nuevo', `Nuevo chat, ${donde}`);
    }
  }
});

test('2. el caso de Martín: con la Ticketera abierta, «Second Brain» abre el grafo; y cerrar la Ticketera antes de navegar', () => {
  const enTicketera = { ticketera: true, mapa: false, nuevo: false };
  const paso = tocarEnLaBarra('second-brain', enTicketera, { alterna: true });
  assert.deepEqual(paso, { ticketera: false, nuevo: false, ir: 'mapa' });
  // Con el grafo ya cargado debajo de la Ticketera (la URL era `?panel=mapa&ticketera=tickets`): igual se ve el grafo.
  assert.equal(panelQueSeVe(despuesDe({ ...enTicketera, mapa: true }, tocarEnLaBarra('second-brain', { ...enTicketera, mapa: true }, { alterna: true }))), 'mapa');
  // Sin el grafo (no es admin de la tab), «Second Brain» abre el Cerebro, como un chat.
  assert.equal(panelQueSeVe(despuesDe(enTicketera, tocarEnLaBarra('second-brain', enTicketera, { veMapa: false }))), 'chat');
});

test('3. la pantalla usa esas reglas, y la Ticketera del cliente vive en la URL como la del super admin', () => {
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.doesNotMatch(sb, /ticketsCliente/, 'la Ticketera del cliente no es un estado suelto fuera de la URL');
  // Sigue a `?ticketera=` para los dos (sin el `if (!ops) return` que dejaba afuera al cliente).
  const efecto = sb.slice(sb.indexOf("const qTicketera = useSearchParams().get('ticketera');"), sb.indexOf('const ticketsPorDecidir'));
  assert.match(efecto, /setTicketera\(v\);/);
  assert.doesNotMatch(efecto, /if \(!ops\) return;/, 'el cliente también sigue a la URL');
  assert.match(sb, /: !centro && ticketera \? \(\n\s*<TicketeraDelCliente mis=\{misTickets\}/, 'el panel del cliente sale del mismo estado');
  // Cada botón pasa por `tocar` (o `elegir`, que usa la regla del chat), y la Ticketera se cierra antes de navegar.
  assert.equal((sb.match(/onClick=\{\(\) => tocar\('ticketera'\)\}/g) ?? []).length, 2, 'la Ticketera de las dos barras');
  assert.equal((sb.match(/aria-pressed=\{verMapa && !ticketera\} onClick=\{irAlSecondBrain\}/g) ?? []).length, 2, 'el Second Brain de las dos barras');
  assert.match(sb, /const paso = tocarEnLaBarra\('chat', estadoPanel\(\)\);/);
  assert.match(sb, /if \(ticketera\) cerrarTicketera\(paso\.ir == null\);\n[\s\S]*?if \(paso\.ir\) \{\n\s*setYendo\('fuera'\);\n\s*router\.push/, 'en `elegir`, primero se cierra y después se navega');
  assert.match(sb, /if \(!paso\.ticketera && ticketera\) cerrarTicketera\(paso\.ir == null\);[\s\S]*?if \(paso\.ir\) \{ setYendo\([^)]*\); router\.push/);
  // La página pasa `?ticketera=` también para el cliente.
  assert.match(sinComentarios(leer('app/second-brain/pagina.tsx')), /const ticketera = esVistaTicketera\(q\.ticketera\) \? 'tickets' : null;/);
});

test('4. el clic cambia la vista EN EL ACTO, y la vista sale de la URL (23/10/2026, Martín: «primero se va al chat de "Cerebro" y luego de unos segundos ahí recién entra al second brain»)', () => {
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  // Adónde se fue con el clic manda hasta que el servidor manda lo nuevo.
  assert.match(sb, /const \[yendo, setYendo\] = useState<'mapa' \| 'fuera' \| null>\(null\);\n\s*useEffect\(\(\) => \{ setYendo\(null\); \}, \[mapa\]\);\n\s*const verMapa = yendo \? yendo === 'mapa' : hayMapa;/);
  assert.match(sb, /if \(paso\.ir\) \{ setYendo\(paso\.ir === 'mapa' \? 'mapa' : 'fuera'\); router\.push\(/, 'tocar marca adónde va ANTES de navegar');
  assert.match(sb, /if \(paso\.ir\) \{\n\s*setYendo\('fuera'\);\n\s*router\.push\('id' in e/, 'elegir un chat con el grafo abierto muestra el chat ya');
  assert.match(sb, /\) : verMapa \? \(/, 'el panel decide con lo tocado, no con lo que el servidor todavía no mandó');
  assert.match(sb, /: <CargandoMako que="tu Second Brain" alto="100%" \/>\}/, 'mientras llega el grafo, su loader (no el chat del Cerebro)');
  assert.match(sb, /const estadoPanel = \(\) => \(\{ ticketera: ticketera != null, mapa: verMapa, nuevo: nuevoCentro \}\);/);
  // Un link a la página pelada (el ícono del Ops Center en la barra de la app) vuelve a la entrada, no al último chat.
  assert.match(sb, /if \(qs \|\| !antes \|\| \(!urlPelada\(elegidoRef\.current\) && !guruRef\.current\)\) return;\s*setGuru\(null\);/);
  assert.match(sb, /setElegido\(k\.lista\[0\]\?\.elegido \?\? null\);/, 'el cliente, al Cerebro');
});

// PROBADO ROMPIÉNDOLO (23/10/2026, test 4, base 4/0): el panel con `mapa ?` otra vez → 3/1; sin el `setYendo` de `tocar` → 2/2 (3 y 4).
// PROBADO ROMPIÉNDOLO (23/10/2026, base 3/0):
//   · «Second Brain» sin cerrar la Ticketera (`ticketera: s.ticketera`, lo de producción) → 1/2 (1 y 2)
//   · el efecto de `?ticketera=` otra vez con `if (!ops) return;`                         → 2/1 (3)
//   · «Nuevo chat» con el grafo abierto sin navegar (`ir: null`)                           → 2/1 (1)
