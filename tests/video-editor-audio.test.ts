// =============================================================================
// Video Editor: el audio (paquete J) — sonoridad, fundidos, ritmos, ruido, tono
// =============================================================================
// Lo que se oye mal no se ve en ninguna pantalla: un fundido que la
// reproducción programa distinto que el export, una normalización que mide 3 dB
// de más, ritmos corridos del golpe. Esto fija las cuentas (audio/claves.ts y
// audio/dsp/), que corren igual en el navegador y acá:
//
//   1. sonoridad BS.1770: un seno de 1 kHz estéreo a 0,1 de pico mide −20 LUFS;
//      el mismo en MONO también (se mide como suena, por los dos canales); a 1,0
//      en un solo canal, −3,01 (el valor de referencia de la norma);
//   2. fundidos: las rampas lineales entre los puntos de `puntosFundido` (lo
//      que programa la reproducción) dan EXACTO el factor que aplica el export
//      muestra a muestra, también arrancando a mitad de un fundido;
//   3. normalizar: apagada o sin medir no suma nada; el tope de +20 dB;
//   4. ritmos: bombos sintéticos a 95, 120 y 140 BPM → el tempo a ±1 BPM, los
//      golpes a menos de 10 ms de media, y Ritmo 1 la mitad que Ritmo 2;
//   5. (reducir el ruido pasó a tests/video-editor-ruido.test.ts el 28/10/2026: es
//      RNNoise y se mide con voz, ruido rosa, ventilador y estéreo);
//   6. tono: +12 semitonos lleva 440 Hz a 880 Hz sin cambiar el largo;
//   7. las listas de ritmos van y vuelven, y un clip sin nada no se procesa;
//   8. bajar la tasa por TROZOS (como llega del decodificador) da lo mismo que
//      de una vez: sin el resto entre trozos, los ritmos se correrían.
//
// Correr: node --import tsx --test tests/video-editor-audio.test.ts
//
// ── Roturas (11/10/2026; base en verde: 8 pasan, 0 fallan) ──
//   · intensidad.ts con `peso = 1` (el mono sin duplicar)                 -> 7 / 1 (el 1: −23,0 en vez de −20)
//   · puntosFundido sin el corte en `duracion - salida`                   -> 7 / 1 (el 2: 0,9987 en vez de 1)
//   · ritmos.ts sin el corrimiento de 0,8 saltos en `aSegundos`           -> 7 / 1 (el 4: 8,9 ms de media)
//   · tono.ts sin `st.pitchSemitones = semitonos`                         -> 7 / 1 (el 6: 440 Hz en vez de 880)
//   · AcumuladorAnalisis tirando el resto de cada trozo                   -> 7 / 1 (el 8)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intensidadIntegrada } from '../app/video-editor/_opencut/audio/dsp/intensidad';
import { AcumuladorAnalisis, aMonoAnalisis, detectarRitmos } from '../app/video-editor/_opencut/audio/dsp/ritmos';
import { cambiarTono } from '../app/video-editor/_opencut/audio/dsp/tono';
import {
  FUNDIDO_ENTRADA,
  FUNDIDO_SALIDA,
  INTENSIDAD_MEDIDA,
  NORMALIZAR,
  NORMALIZAR_OBJETIVO,
  REDUCIR_RUIDO,
  RITMOS,
  RITMOS_MANUALES,
  VOZ,
  claveProcesado,
  dbNormalizacion,
  escribirLista,
  factorFundido,
  leerFundidos,
  leerLista,
  puntosFundido,
  ritmosDeFuente,
} from '../app/video-editor/_opencut/audio/claves';

const SR = 48000;
const seno = (segundos: number, hz: number, amplitud: number) => {
  const x = new Float32Array(Math.round(SR * segundos));
  for (let i = 0; i < x.length; i++) x[i] = amplitud * Math.sin((2 * Math.PI * hz * i) / SR);
  return x;
};
const azar = (semilla: number) => {
  let s = semilla;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647 - 0.5;
  };
};
const cerca = (a: number, b: number, tol: number, msg: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('1: sonoridad BS.1770 (LUFS) de los tonos de referencia', () => {
  const s = seno(5, 1000, 0.1);
  cerca(intensidadIntegrada([s, s], SR), -20, 0.1, 'estéreo a 0,1');
  cerca(intensidadIntegrada([s], SR), -20, 0.1, 'mono a 0,1 (como suena por los dos lados)');
  cerca(intensidadIntegrada([seno(5, 1000, 1), new Float32Array(SR * 5)], SR), -3.01, 0.1, 'un canal a 1,0');
  assert.equal(intensidadIntegrada([new Float32Array(SR * 2)], SR), Number.NEGATIVE_INFINITY, 'silencio');
});

test('2: las rampas de la reproducción dan el mismo fundido que el export', () => {
  const casos = [
    { dur: 10, entrada: 2, salida: 3 },
    { dur: 4, entrada: 0, salida: 1.5 },
    { dur: 4, entrada: 1, salida: 0 },
    { dur: 3, entrada: 2.5, salida: 2.5 }, // se pisan: leerFundidos acota la salida
  ];
  for (const c of casos) {
    const f = leerFundidos({ [FUNDIDO_ENTRADA]: c.entrada, [FUNDIDO_SALIDA]: c.salida }, c.dur);
    assert.ok(f.entrada + f.salida <= c.dur + 1e-9, 'no se superponen');
    for (const desde of [0, c.dur * 0.1, c.dur * 0.5, c.dur * 0.93]) {
      const puntos = puntosFundido(desde, c.dur, f);
      for (let t = desde; t <= c.dur; t += 0.01) {
        const k = puntos.findIndex((p) => p.t >= t);
        const b = puntos[Math.max(0, k)];
        const a = puntos[Math.max(0, k - 1)];
        const interpolado = b.t === a.t ? b.factor : a.factor + ((t - a.t) / (b.t - a.t)) * (b.factor - a.factor);
        cerca(interpolado, factorFundido(t, c.dur, f), 1e-9, `dur ${c.dur} desde ${desde} t ${t.toFixed(2)}`);
      }
    }
  }
  assert.equal(factorFundido(0, 10, { entrada: 1, salida: 0 }), 0, 'arranca en silencio');
  assert.equal(factorFundido(10, 10, { entrada: 0, salida: 1 }), 0, 'termina en silencio');
});

test('3: normalizar suma objetivo − medido, con tope, y nada si está apagada', () => {
  assert.equal(dbNormalizacion({ [NORMALIZAR]: false, [INTENSIDAD_MEDIDA]: -30 }), 0);
  assert.equal(dbNormalizacion({ [NORMALIZAR]: true }), 0, 'sin medir');
  cerca(dbNormalizacion({ [NORMALIZAR]: true, [INTENSIDAD_MEDIDA]: -30 }), 7, 1e-9, 'a −23 por defecto');
  cerca(dbNormalizacion({ [NORMALIZAR]: true, [INTENSIDAD_MEDIDA]: -30, [NORMALIZAR_OBJETIVO]: '-12' }), 18, 1e-9, 'TikTok');
  assert.equal(dbNormalizacion({ [NORMALIZAR]: true, [INTENSIDAD_MEDIDA]: -60, [NORMALIZAR_OBJETIVO]: '-12' }), 20, 'tope');
});

test('4: ritmos de bombos sintéticos: tempo y golpes en su lugar', async () => {
  // Sin el corrimiento de 0,8 saltos los golpes salen 8,6–8,9 ms ANTES (máximo
  // 14,8); con él, 2,7 de media y 6,3 de máximo. El umbral de 5 ms separa las dos.
  for (const bpm of [95, 120, 140]) {
    const dur = 20;
    const x = new Float32Array(SR * dur);
    const r = azar(bpm);
    for (let i = 0; i < x.length; i++) x[i] = 0.02 * r();
    const golpes: number[] = [];
    for (let t = 0.3; t < dur - 0.2; t += 60 / bpm) {
      golpes.push(t);
      const s0 = Math.round(t * SR);
      for (let k = 0; k < SR * 0.15; k++) x[s0 + k] += 0.8 * Math.exp(-k / (SR * 0.03)) * Math.sin((2 * Math.PI * 60 * k) / SR);
    }
    const { muestras, tasa } = aMonoAnalisis([x, x], SR);
    const ritmos = await detectarRitmos({ muestras, tasa });
    cerca(ritmos.bpm, bpm, 1, `tempo a ${bpm}`);
    assert.ok(ritmos.ritmo2.length >= golpes.length - 2, `${bpm}: ${ritmos.ritmo2.length} de ${golpes.length} golpes`);
    const errores = ritmos.ritmo2.map((t) => Math.min(...golpes.map((g) => Math.abs(g - t))));
    const media = errores.reduce((a, b) => a + b, 0) / errores.length;
    assert.ok(media < 0.005, `${bpm}: error medio ${(media * 1000).toFixed(1)} ms`);
    assert.ok(Math.max(...errores) < 0.012, `${bpm}: error máximo ${(Math.max(...errores) * 1000).toFixed(1)} ms`);
    cerca(ritmos.ritmo1.length, ritmos.ritmo2.length / 2, 1, `${bpm}: Ritmo 1 es uno cada dos`);
  }
});

test('6: el tono sube una octava sin cambiar el largo', async () => {
  const x = seno(2, 440, 0.5);
  const [y] = await cambiarTono({ canales: [x], sampleRate: SR, semitonos: 12 });
  assert.equal(y.length, x.length);
  let cruces = 0;
  for (let i = SR * 0.5 + 1; i < SR * 1.5; i++) if (y[i - 1] < 0 !== y[i] < 0) cruces++;
  cerca(cruces / 2, 880, 8, 'frecuencia');
  const [igual] = await cambiarTono({ canales: [x], sampleRate: SR, semitonos: 0 });
  assert.deepEqual(igual, x, 'sin cambio de tono no se procesa');
});

test('7: las listas de ritmos y lo que obliga a procesar el clip', () => {
  const lista = escribirLista([2.5, 1.0004, 1, 3.25]);
  assert.equal(lista, '1,2.5,3.25');
  assert.deepEqual(leerLista({ [RITMOS]: lista }, RITMOS), [1, 2.5, 3.25]);
  assert.deepEqual(ritmosDeFuente({ [RITMOS]: '1,3', [RITMOS_MANUALES]: '2' }), [1, 2, 3]);
  assert.equal(claveProcesado({}), null);
  assert.equal(claveProcesado({ [VOZ]: 'original' }), null);
  assert.notEqual(claveProcesado({ [VOZ]: 'robot' }), null);
  assert.notEqual(claveProcesado({ [REDUCIR_RUIDO]: true }), null);
});

test('8: bajar la tasa por trozos da lo mismo que de una vez', () => {
  const x = new Float32Array(SR * 3);
  const r = azar(3);
  for (let i = 0; i < x.length; i++) x[i] = r();
  const entero = aMonoAnalisis([x, x], SR);
  const acumulador = new AcumuladorAnalisis();
  // Trozos de largo impar (1021): el factor es 2 y a cada borde le sobra una muestra.
  for (let i = 0; i < x.length; i += 1021) acumulador.agregar([x.subarray(i, i + 1021), x.subarray(i, i + 1021)], SR);
  const porTrozos = acumulador.resultado();
  assert.equal(porTrozos.tasa, entero.tasa);
  assert.equal(porTrozos.muestras.length, entero.muestras.length);
  for (let i = 0; i < entero.muestras.length; i += 997) cerca(porTrozos.muestras[i], entero.muestras[i], 1e-6, `muestra ${i}`);
});
