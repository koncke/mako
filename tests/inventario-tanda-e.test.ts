// =============================================================================
// EL INVENTARIO DE BOTONES, TANDA E (21/11/2026): lo que quedó «sin hacer» y el Cerebro decidió hacer
// =============================================================================
//   1. No grabar mientras MaKo contesta: el onboarding V2 pasa `voz` a la caja, como las demás (`apagada` mientras está ocupado).
//   2. La nota de voz se puede CANCELAR mientras se transcribe, y una que FALLA no se pierde: queda para reintentar o borrar
//      (app/_chat/useNotaConEspera.ts; antes `enviar` vaciaba la revisión antes de entregar y la nota se iba).
//   3. Los videos de los días 2 a 7 abiertos desde el desplegable o el pin cuentan lo tocado y marcan lo que falta al terminar, igual que
//      desde el hilo (`avisosDelDia`).
//   4. El catálogo de videos en UN toque: elegir el video lo arranca (`arrancar`).
//   5. La barra del video se arrastra y se maneja con el teclado (flechas ±5 s, Inicio y Fin): app/_ui/tutorial/pista.ts.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SALTO_TECLA, segundoConTecla, segundoEnLaPista } from '../app/_ui/tutorial/pista';
import { senalDeCorte } from '../app/_components/transcribir-nota';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. el onboarding V2 pasa `voz` a la caja: no se graba mientras MaKo contesta, y la nota que quedó se ve', () => {
  const c = sinComentarios(fuente('app/onboarding/ChatArranqueV2.tsx'));
  assert.match(c, /voz=\{\{ onAudio: nota\.onAudio, onError: \(m\) => setError\(m\), rotuloEnviar: 'Enviar audio', apagada: ocupado \|\| nota\.enCurso, pendiente: nota\.pendiente \}\}/);
  assert.match(c, /const nota = useNotaConEspera\(\{ onTexto: mandarEste, onError: \(m\) => setError\(m\) \}\);/);
});

test('2. la nota se cancela mientras se transcribe, y una que falla queda para reintentar o borrar', () => {
  const h = sinComentarios(fuente('app/_chat/useNotaConEspera.ts'));
  // Falla: no se suelta; queda como `pendiente` con «borrar» (que también CANCELA la que está en camino) y «volver a mandar».
  assert.match(h, /if \('error' in r\) \{ onError\.current\(r\.error\); return; \}/, 'al fallar, la nota queda');
  assert.match(h, /pendiente: nota \? \{ url: nota\.url, secs: nota\.secs, onBorrar: borrar, onDejar: reintentar \} : null/);
  assert.match(h, /const borrar = useCallback\(\(\) => \{\n\s*corte\.current\?\.abort\(\);/, 'borrar corta la transcripción en camino');
  assert.match(h, /transcribirNota\(mp3, 300_000, 'chat', c\.signal\)/, 'la transcripción lleva la señal de corte');
  // La señal: corta con el tope o con quien cancela, también sin AbortSignal.any.
  const corte = new AbortController();
  const s = senalDeCorte(60_000, corte.signal);
  assert.ok(s && !s.aborted);
  corte.abort();
  assert.equal(s!.aborted, true, 'cancelar corta el pedido');
});

test('3. los días 2 a 7 desde el desplegable o el pin, con lo que hace el hilo al tocar y al terminar', () => {
  const r = sinComentarios(fuente('app/second-brain/reto/ChatDelReto.tsx'));
  assert.match(r, /export const avisosDelDia = new Map<number, \{ alTocar\?: \(sel: string\) => void; alTerminar\?: \(\) => void \}>\(\);/);
  assert.match(r, /const avisos = \{ \.\.\.avisosDelDia\.get\(dia\.n\), \.\.\.o \};/, 'sin avisos propios, los del hilo');
  assert.match(r, /\.\.\.\(avisos\.alTocar \? \{ alTocar: avisos\.alTocar \} : \{\}\), alTerminar: \(\) => avisos\.alTerminar\?\.\(\)/);
  assert.match(r, /avisosDelDia\.set\(dia\.n, \{ alTocar: onTocado, alTerminar: onFin \}\);/, 'el hilo los deja anotados');
});

test('4. el catálogo de videos en un toque: elegirlo lo arranca', () => {
  assert.match(sinComentarios(fuente('app/second-brain/reto/CatalogoTutoriales.tsx')), /<VideoDelMomento clave=\{t\.key\} titulo=\{t\.titulo\} revision=\{false\} arrancar \/>/);
  const v = sinComentarios(fuente('app/_ui/tutorial/VideoDelMomento.tsx'));
  assert.match(v, /useEffect\(\(\) => \{ if \(arrancar && v\) reproducir\(\); \}, \[arrancar, v\?\.archivo\]\);/);
});

test('5. la barra del video se arrastra y se maneja con el teclado (±5 s, Inicio, Fin)', () => {
  assert.equal(SALTO_TECLA, 5);
  assert.equal(segundoConTecla('ArrowRight', 10, 60), 15);
  assert.equal(segundoConTecla('ArrowLeft', 3, 60), 0, 'no baja de 0');
  assert.equal(segundoConTecla('ArrowRight', 58, 60), 60, 'no pasa del final');
  assert.equal(segundoConTecla('Home', 30, 60), 0);
  assert.equal(segundoConTecla('End', 30, 60), 60);
  assert.equal(segundoConTecla('a', 30, 60), null, 'otra tecla no mueve');
  assert.equal(segundoEnLaPista(150, { left: 100, width: 200 }, 60), 15, 'a un cuarto, el segundo 15');
  assert.equal(segundoEnLaPista(50, { left: 100, width: 200 }, 60), 0, 'arrastrar afuera no se pasa');
  for (const f of ['app/_ui/tutorial/VideoDelMomento.tsx', 'app/_ui/tutorial/BarraDelVideo.tsx']) {
    const s = sinComentarios(fuente(f));
    assert.match(s, /<div className="mk-vmom__pista" \{\.\.\.propsDePista\(/, `${f}: la barra sin arrastre ni teclado`);
  }
  const p = sinComentarios(fuente('app/_ui/tutorial/pista.ts'));
  assert.match(p, /role: 'slider', tabIndex: 0,/);
  assert.match(p, /onPointerMove: \(e: PointerEvent<HTMLDivElement>\) => \{ if \(e\.currentTarget\.hasPointerCapture\?\.\(e\.pointerId\)\) ir\(e\.clientX, e\.currentTarget\); \},/);
});

// ⚠️ PROBADO ROMPIÉNDOLO (21/11/2026, base 5/0; al restaurar, 5/0). Cada rotura, de a una, cae:
//   - el V2 sin `voz` (o sin `apagada`) → 1;  la nota que se suelta al fallar → 2;  borrar sin cortar → 2;  la señal sin el corte → 2
//   - verVideoDelDia sin los avisos del hilo → 3;  el catálogo sin `arrancar` → 4;  la tecla de ±1 s → 5;  la barra sin arrastre → 5
