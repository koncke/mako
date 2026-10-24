// =============================================================================
// La lista del Ops Center dice lo último desde el primer cuadro, y cada sub-chat va con SU jefe (23/10/2026)
// =============================================================================
// Martín, desde su Android: «Muchas veces cuando entro al Ops Center, los chats no reflejan lo ultimo... me decia que Cerebro
// estaba apagado y luego de unos segundos se prendió... O incluso a veces cambian los chats». Dos capturas de las 20:52: en una el
// Cerebro «Completado» con un 1, en la otra gris y dormido; y «↳ Integración» colgado de «Integraciones».
//   1. el ✓ de cada «Completado» (`yaVistos`) viaja CON la carga: antes llegaba con el primer refresco y la lista cambiaba sola;
//      y lo visto en este navegador se lee antes de pintar;
//   2. «Cerebro › Integración» va debajo del Cerebro, no suelto en la otra lista (donde parecía de «Integraciones»).
//
// Correr: node --import tsx --test tests/ops-center-lista-viva.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { porJefe, seccionesDeChats, SECCION_CEREBRO, type ChatCentro } from '../lib/centro-chats';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const chat = (titulo: string, estado: ChatCentro['estado'] = 'abierto', actividad = 0) =>
  ({ clave: `nombre:${titulo}`, titulo, estado, viejo: false, actividad }) as unknown as ChatCentro;

test('1. el ✓ de cada «Completado» viaja con la carga, y lo visto en este navegador se lee antes de pintar', () => {
  for (const f of ['app/admin/operaciones/datos.ts', 'app/m/operaciones/page.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /leerUltimosTurnos\(ahora\),\n\s*leerYaVistosDe\(\),\n\s*\]\);/, `${f}: se lee con lo demás`);
    assert.match(src, /yaVistosIniciales: yaVistos,/, `${f}: y viaja a la pantalla`);
  }
  const motor = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  assert.match(motor, /const \[yaVistos, setYaVistos\] = useState<YaVistos \| null>\(d\.yaVistosIniciales \?\? null\);/, 'el primer cuadro ya los tiene');
  assert.match(motor, /useLayoutEffect\(\(\) => \{ setVistos\(leerVistos\(Date\.now\(\)\)\); \}, \[\]\);/, 'antes de pintar, no después');
});

test('2. «Cerebro › Integración» va debajo del Cerebro, nunca suelto en la otra lista', () => {
  const lista = [chat('Integraciones', 'trabajando', 3), chat('Cerebro › Integración', 'trabajando', 2), chat('Cerebro', 'abierto', 1), chat('CRM', 'abierto', 4)];
  const secciones = seccionesDeChats(lista);
  const cerebro = secciones.find((s) => s.clave === SECCION_CEREBRO)!;
  assert.deepEqual(cerebro.chats.map((c) => c.titulo), ['Cerebro', 'Cerebro › Integración'], 'el Cerebro primero y su sub-chat debajo');
  const resto = secciones.find((s) => s.clave !== SECCION_CEREBRO)!;
  assert.ok(!resto.chats.some((c) => c.titulo.startsWith('Cerebro')), 'nada del Cerebro en la otra lista');
  const g = porJefe(cerebro.chats);
  assert.equal(g.length, 1);
  assert.equal(g[0].chat?.titulo, 'Cerebro');
  assert.deepEqual(g[0].subs.map((c) => c.titulo), ['Cerebro › Integración']);
  // «Integraciones» e «Integración» no se juntan por parecido: son jefes distintos.
  assert.deepEqual(porJefe([chat('Integraciones'), chat('Integración › Algo')]).map((x) => x.jefe), ['Integraciones', 'Integración']);
});

test('3. las dos pantallas agrupan las dos secciones, y un sub-chat sin su jefe en la lista no se corre como si fuera de otro', () => {
  const movil = sinComentarios(leer('app/m/operaciones/ChatsMovil.tsx'));
  assert.match(movil, /const deLaSeccion = porJefe\(corte\)\n\s*\.flatMap\(\(g\) => \(g\.chat \? \[\{ c: g\.chat, sub: false \}, \.\.\.g\.subs\.map\(\(c\) => \(\{ c, sub: true \}\)\)\] : g\.subs\.map\(\(c\) => \(\{ c, sub: false \}\)\)\)\)/);
  const compu = sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx'));
  assert.match(compu, /\{!plegada && <GruposPorJefe chats=\{corte\} fila=\{fila\} \/>\}/, 'la sección del Cerebro también agrupa');
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 3/0):
//   · `yaVistos` arrancando en null otra vez                  → 2/1 (1)
//   · `seccionesDeChats` con el Cerebro por nombre exacto     → 2/1 (2)
//   · el teléfono corriendo a los huérfanos (`sub: true`)     → 2/1 (3)
