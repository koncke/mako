// =============================================================================
// WhatsApp en /integraciones: la tarjeta con su logo, sus líneas por QR y «Agregar línea» (29/10/2026)
// =============================================================================
// Martín: «En Integraciones falta el logo de WhatsApp para que aparezca eso también, con el QR obvio, con las múltiples líneas,
// claro». El Cerebro: la tarjeta en la computadora y en el teléfono; las líneas conectadas con su número y su estado; «Agregar línea»
// con el QR que ya existe (nada de una conexión nueva); que se vea que pueden ser varias; la línea de MaKo (la del grupo) no va.
//
//   1. LA TARJETA: «WhatsApp» en Mensajería, con su logo; su estado sale de las líneas del negocio, SIN la de MaKo.
//   2. NO TOCA LA API DE MaKo: no entra al catálogo de métodos (`integracionConectada('whatsapp')` es la pregunta del oficial).
//   3. EL MODAL: las líneas con número y estado MEDIDO (lo que nadie midió no es verde) y «Agregar línea» con `EvolutionConnect nueva`.
//   4. EL TELÉFONO: la hoja muestra las líneas (sin el QR, que no se escanea con el mismo teléfono) y lleva a la computadora.
//
// Probado ROMPIÉNDOLO (29/10/2026): ver el pie de este archivo.
//
// Correr: node --import tsx --test tests/whatsapp-tarjeta.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFS, integracionQueConfigura } from '../lib/integraciones-catalogo';
import { SLIDES } from '../lib/servicio-slides';
import { numeroLegible, textoDeEstado } from '../lib/lineas-whatsapp-tarjeta';

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_whatsapp-tarjeta-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');

test('el hijo corrió entero y no salió a la red', () => {
  assert.equal(R.tiro, undefined, String(R.tiro));
  assert.deepEqual(R.red, []);
});

test('la tarjeta: «WhatsApp» en Mensajería, con su logo, que se configura en su propia tarjeta', () => {
  const d = DEFS.find((x) => x.key === 'whatsapp');
  assert.ok(d, 'sin tarjeta de WhatsApp');
  assert.equal(d!.nombre, 'WhatsApp');
  assert.equal(d!.categoria, 'Mensajería');
  assert.deepEqual(d!.envs, []);
  assert.match(d!.descripcion, /varios: uno por setter/);
  assert.equal(integracionQueConfigura('whatsapp'), 'whatsapp');
  assert.match(leer('app/_components/ServicioVisual.tsx'), /\n  whatsapp: \{ sym: 'ic-whatsapp', bg: '#25D366' \},/);
  assert.ok(SLIDES.whatsapp?.length, 'sin el panel negro de qué hace');
  assert.match(SLIDES.whatsapp[0].d, /una línea por setter/);
});

test('su estado sale de las líneas del negocio, y la de MaKo (la del grupo) no cuenta', () => {
  assert.deepEqual(R.sinLineas, { estado: 'falta', detalle: 'Conecta tu WhatsApp con un QR: una línea o varias.', soloServidor: false, categoria: 'Mensajería' });
  assert.deepEqual(R.dosConectadas, { estado: 'conectada', detalle: '2 líneas conectadas.', soloServidor: false, categoria: 'Mensajería' });
  assert.deepEqual(R.soloLaDeMaKo, { estado: 'falta', detalle: 'Ninguna línea conectada: escanea su QR.', soloServidor: false, categoria: 'Mensajería' });
  // La ruta de las líneas marca la de MaKo con la MISMA regla (`esLineaDeMaKo`), y la pantalla la saca.
  assert.match(leer('app/api/whatsapp/evolution/route.ts'), /deMaKo: esLineaDeMaKo\(l\.instance_name\),/);
  assert.match(leer('app/integraciones/LineasWhatsApp.tsx'), /const propias = r\.lineas\.filter\(\(l\) => !l\.deMaKo\);/);
});

test('no toca la API de MaKo: WhatsApp no entra al catálogo de métodos (la pregunta del oficial sigue dando false)', () => {
  const m = leer('lib/metodo-catalogo.ts');
  assert.doesNotMatch(m, /key: 'whatsapp'/);
  assert.match(leer('lib/credenciales.ts'), /const s = servicioMetodo\(servicioKey\);\n\s+if \(!s\) return false;/);
});

test('el modal: cada línea con su número y su estado MEDIDO; lo que nadie midió no es verde', () => {
  assert.deepEqual(textoDeEstado({ medida: { estado: 'conectado', confirmado: true } }), { texto: 'Conectada', tono: 'good' });
  assert.deepEqual(textoDeEstado({ medida: { estado: 'conectado', confirmado: false } }), { texto: 'Conectada (sin comprobar)', tono: 'dim' });
  assert.deepEqual(textoDeEstado({ medida: { estado: 'desconectado', confirmado: true } }), { texto: 'Desconectada: vuelve a escanear su QR', tono: 'warn' });
  assert.deepEqual(textoDeEstado({ medida: { estado: 'conectando', confirmado: true } }), { texto: 'Esperando el QR', tono: 'warn' });
  assert.deepEqual(textoDeEstado({ medida: null }), { texto: 'Comprobando…', tono: 'dim' });
  assert.equal(numeroLegible('549 11 2233-4455'), '+5491122334455');
  assert.equal(numeroLegible(null), null);
  const c = leer('app/integraciones/LineasWhatsApp.tsx');
  // Cada línea se mide aparte (`?linea=`): la fila sola miente.
  assert.match(c, /leer\(`\/api\/whatsapp\/evolution\?linea=\$\{encodeURIComponent\(l\.linea\)\}`\)/);
  assert.match(c, /: \{ estado: l\.estado, confirmado: false \};/, 'sin medida, la fila no se da por confirmada');
});

test('«Agregar línea» abre EL MISMO QR (EvolutionConnect nueva), y se dice que pueden ser varias', () => {
  const c = leer('app/integraciones/LineasWhatsApp.tsx');
  assert.match(c, /import \{ EvolutionConnect \} from '@\/app\/whatsapp\/EvolutionConnect';/);
  assert.match(c, /<EvolutionConnect key="nueva-linea" nueva inline panelVisible/);
  assert.doesNotMatch(c, /action: 'nueva-linea'|'\/api\/whatsapp\/evolution', \{ method: 'POST'/, 'una conexión propia: tiene que ser la de siempre');
  assert.match(c, /Puedes conectar varias líneas: por ejemplo, una por setter\./);
  assert.match(c, /\{lineas && lineas\.length \? 'Agregar otra línea' : 'Agregar línea'\}/);
  const b = leer('app/integraciones/IntegracionesBoard.tsx');
  assert.match(b, /\{esWhatsApp \? \(\n\s+<LineasWhatsApp onCambio=\{onCambio\} \/>/);
});

test('el teléfono: la hoja muestra las líneas sin el QR, y «Agregar una línea» lleva a la computadora', () => {
  const m = leer('app/m/configuraciones/integraciones/IntegracionesM.tsx');
  assert.match(m, /\{abierta\.key === 'whatsapp' && <LineasWhatsApp soloLectura \/>\}/);
  assert.match(m, /abierta\.key === 'whatsapp' \? 'Agregar una línea en la computadora'/);
  const c = leer('app/integraciones/LineasWhatsApp.tsx');
  assert.match(c, /\{!soloLectura && \(agregando \? \(/, 'en el teléfono no hay QR');
});

// ── Probado ROMPIÉNDOLO (29/10/2026) ──────────────────────────────────────────
// Corrido solo: 7 pases y 0 fallos. Rota, una por vez (cada una, 6 / 1):
//   · la línea de MaKo cuenta en la tarjeta
//   · la línea de MaKo se lista en el modal
//   · una línea caída cuenta como conectada
//   · la tarjeta sin su logo
//   · WhatsApp entra al catálogo de métodos (cambia la pregunta del oficial)
//   · un verde que nadie midió
//   · el modal no mide cada línea
//   · «Agregar línea» con una conexión propia
//   · el modal de la grilla vuelve al formulario
//   · el teléfono muestra el QR
//   · no se dice que pueden ser varias
