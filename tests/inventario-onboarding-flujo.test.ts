// =============================================================================
// EL INVENTARIO DE BOTONES (20/11/2026, Martín: «Tienes que fijarte todas las opciones que tiene el usuario, todos los botones que
// puede apretar»): los arreglos del onboarding V2, su caja y la barra del administrador
// =============================================================================
// El inventario lo hicieron tres lectores de código (la tabla, en docs/hallazgos-onboarding.md). Lo que fallaba, en esta tanda:
//   1. RESET vaciaba el negocio pero dejaba en el navegador lo del onboarding que no empieza con «mako» (la llegada, el «dale play», la
//      entrada de cada coach): el onboarding volvía con «¿cómo te llamas?» antes del video, como «Reiniciar» antes de arreglarse.
//   2. «Salir de la vista» no miraba la respuesta del DELETE: con un 401 o un 500 navegaba igual, la cookie quedaba y la barra volvía.
//   3. El ejemplo del teléfono era argentino («9 11 5555 0101») con México (+52) por defecto: TelefonoConPais ya lo arma por país.
//   4. «Entrar a MaKo» usaba `AbortSignal.timeout`, que un Safari de antes del 16 no tiene: tiraba antes del fetch y el botón quedaba en
//      «Entrando…» para siempre.
//   5. En el cierre la caja seguía prendida y lo que se mandaba se perdía en silencio.
//   6. El panel de emojis quedaba abierto con la caja apagada (mientras se transcribe una nota): se podía escribir en un campo apagado.
//   7. Las opciones de una pregunta: con opciones marcadas Y texto escrito, «Responder» mandaba sólo el texto, sin avisar; y si el envío
//      fallaba, lo marcado y lo escrito se perdían (el recuadro se desmonta mientras envía).
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { senalConTope } from '../lib/senal-con-tope';
import { ejemploDeTelefono } from '../lib/paises';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const bloque = (s: string, desde: string) => { const i = s.indexOf(desde); assert.ok(i >= 0, `no está: ${desde}`); return s.slice(i, s.indexOf('\n  }\n', i)); };

// 21/11/2026: el RESET que vaciaba todo salió de la barra (Martín) y es «Borrar todos los datos» en /admin/customers/<ws>; sigue
// limpiando lo del onboarding en este navegador (tests/revision-reset-y-autocompletar.test.ts prueba dónde vive y quién lo ve).
test('1. «Borrar todos los datos» (el RESET viejo) limpia también lo del onboarding en este navegador, cuando el server dijo que sí', () => {
  const h = sinComentarios(fuente('app/admin/_polar/web/Customer/CustomerPage/CustomerHeader.tsx'));
  const desde = h.indexOf('const onBorrarDatos = useCallback(');
  assert.ok(desde > 0, 'no está onBorrarDatos');
  const r = h.slice(desde, h.indexOf('}, [negocio, router])', desde));
  const i = r.indexOf('limpiarClavesDelOnboarding([window.localStorage, window.sessionStorage])');
  assert.ok(i > r.indexOf('if (!j.ok) {') && i < r.indexOf('setBorrado(`'), 'después del sí del server y antes de decir lo que se llevó');
});

test('2. «Salir de la vista» navega SÓLO si el servidor sacó la cookie; si no, el botón vuelve', () => {
  const b = sinComentarios(fuente('app/_components/ImpersonationBanner.tsx'));
  assert.match(b, /const r = await fetch\(modoAgencia \? '\/api\/agencia\/entrar' : '\/api\/admin\/impersonate', \{ method: 'DELETE' \}\);\n\s*if \(!r\.ok\) \{ setSaliendo\(false\); return; \}\n\s*window\.location\.href = salida;/);
});

test('3. el ejemplo del teléfono es el del país elegido (TelefonoConPais), no uno argentino fijo', () => {
  const c = sinComentarios(fuente('app/onboarding/ChatArranqueV2.tsx'));
  assert.match(c, /<TelefonoConPais lada=\{lada\} numero=\{numero\} onLada=\{setLada\} onNumero=\{setNumero\} onEnter=\{seguir\} inputStyle=\{CAMPO\} \/>/);
  assert.doesNotMatch(c, /placeholder="9 11 5555 0101"/);
  assert.notEqual(ejemploDeTelefono('+52'), '9 11 5555 0101', 'México con un ejemplo argentino');
});

test('4. «Entrar a MaKo» no se traba en un navegador sin AbortSignal.timeout', () => {
  const real = AbortSignal.timeout;
  try {
    // Como un Safari de antes del 16: sin `timeout`, igual da una señal que se corta sola.
    (AbortSignal as unknown as { timeout?: unknown }).timeout = undefined;
    const s = senalConTope(20);
    assert.ok(s instanceof AbortSignal && !s.aborted);
  } finally { (AbortSignal as unknown as { timeout: typeof real }).timeout = real; }
  assert.ok(senalConTope(20) instanceof AbortSignal);
  const c = sinComentarios(fuente('app/onboarding/ChatArranqueV2.tsx'));
  assert.doesNotMatch(c, /AbortSignal\.timeout\(/, 'directo, tira en un navegador viejo');
  assert.match(c, /body: JSON\.stringify\(\{ action: 'hilo' \}\), signal: senalConTope\(20_000\),/);
});

test('5. en el cierre la caja se apaga (lo escrito se perdía en silencio); 6. el panel de emojis se cierra con la caja apagada', () => {
  assert.match(sinComentarios(fuente('app/onboarding/ChatArranqueV2.tsx')), /apagado=\{fase !== 'chat' \|\| etapa === 'listo' \|\| etapa === 'cierre'\}/);
  assert.match(sinComentarios(fuente('app/admin/operaciones/Emojis.tsx')), /useEffect\(\(\) => \{ if \(apagado\) setAbierto\(false\); \}, \[apagado\]\);/);
});

test('7. las opciones: lo que se manda es lo que se ve (escribir desmarca, marcar borra lo escrito); y lo elegido sobrevive a un envío que falla', () => {
  const c = sinComentarios(fuente('app/onboarding/ChatArranqueV2.tsx'));
  const r = c.slice(c.indexOf('function Recuadro('));
  assert.match(r, /onChange=\{\(e\) => \{ setOtra\(e\.target\.value\); if \(e\.target\.value\.trim\(\)\) setMarcadas\(\[\]\); \}\}/, 'escribir desmarca');
  assert.match(r, /const marcar = \(o: string\) => \{\n\s*setAviso\(null\);\n\s*setOtra\(''\);/, 'marcar borra lo escrito');
  // El borrador vive en la pantalla (el recuadro se desmonta mientras envía): vuelve con lo de antes si el envío falla.
  assert.match(r, /const \[marcadas, setMarcadas\] = useState<string\[\]>\(inicial\?\.marcadas \?\? \[\]\);/);
  assert.match(r, /const \[otra, setOtra\] = useState\(inicial\?\.otra \?\? ''\);/);
  assert.match(r, /useEffect\(\(\) => \{ onBorrador\(\{ marcadas, otra \}\); \}, \[marcadas, otra, onBorrador\]\);/);
  assert.match(c, /inicial=\{borradores\.current\.get\(enRecuadro\.id\)\} onBorrador=\{guardarBorrador\(enRecuadro\.id\)\}/);
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 7/0; al restaurar, 7/0). Cada rotura, de a una, cae:
//   - RESET sin limpiar lo del onboarding → 1;  «Salir» sin mirar la respuesta → 2;  el ejemplo argentino fijo → 3
//   - senalConTope sin la vuelta para el navegador viejo → 4;  la caja prendida en el cierre → 5;  el panel abierto con la caja apagada → 5
//   - escribir sin desmarcar → 7;  el borrador que no se guarda → 7
