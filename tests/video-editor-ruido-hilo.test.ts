// =============================================================================
// Video Editor: «Reducir el ruido» en un WORKER (audio/ruido-hilo/), con el camino de antes de respaldo
// =============================================================================
// RNNoise cuesta ~6 s por minuto de audio y canal: en el hilo de la pantalla, un estéreo de 10 min dejaba el
// editor respondiendo a saltos unos 2 min (docs/editor-video/pendientes-video-editor.md §7.2). Desde el 10/11/2026
// la cuenta corre en un worker. Acá se EJECUTA, con el RNNoise de verdad y una voz sintética:
//   · el protocolo y el atendedor del worker (protocolo.ts) dan el MISMO resultado byte a byte que la cuenta de
//     siempre (dsp/ruido.ts), en mono, en estéreo con un ruido distinto por lado (la coherencia), en estéreo con
//     los dos lados iguales y en un clip más corto que una ventana;
//   · el cliente (cliente.ts) con un worker de mentira que atiende en este proceso con `structuredClone` y
//     transferencia (lo que hace `postMessage`): también byte a byte, y sin desprender los canales del que llama;
//   · el avance (sube, termina en 1, y la estimación cubre el trabajo), cancelar (en el worker y acá), y el
//     respaldo: sin worker, un worker que no carga, uno que no pudo bajar RNNoise, y uno al que le falla la cuenta;
//   · la dirección del .wasm se arma contra el origen (en un worker de Turbopack, `location` es un `blob:`).
// El cableado (quién le pide al worker y que nadie más corra la red) está en tests/video-editor-ruido-hilo-cableado.test.ts:
// recorre la carpeta del editor, y una barredora corre en cada punta; ésta, con RNNoise de verdad, sólo cuando se toca.
//
// Correr: node --import tsx --test tests/video-editor-ruido-hilo.test.ts
// ── Roturas ── al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { reducirRuido } from '../app/video-editor/_opencut/audio/dsp/ruido';
import {
  URL_WASM_RNNOISE,
  direccionWasmRnnoise,
  instanciarRnnoise,
  type MotorRnnoise,
} from '../app/video-editor/_opencut/audio/dsp/rnnoise';
import {
  canalesParaMandar,
  crearAtendedor,
  soltarConMensajes,
  transferibles,
  type MensajeAlHilo,
  type MensajeDelHilo,
} from '../app/video-editor/_opencut/audio/ruido-hilo/protocolo';
import {
  TEXTO_SIN_MOTOR,
  crearReductorEnHilo,
  reductorEnEsteHilo,
  type HiloRuido,
  type ReductorRuido,
} from '../app/video-editor/_opencut/audio/ruido-hilo/cliente';
import { mensajeDeExport, MENSAJE_EXPORT_GENERICO } from '../app/video-editor/_opencut/export/mensaje-error';
import { mezclar, rosa, voz } from './_voz-y-ruido';

const RAIZ = process.cwd();
const WASM = path.join(RAIZ, 'public', URL_WASM_RNNOISE);
let motorCargado: Promise<MotorRnnoise> | null = null;
const motor = () => (motorCargado ??= instanciarRnnoise(fs.readFileSync(WASM)));

/** 4 s de voz sintética: dos tramos con una pausa en el medio. */
const TRAMOS_CORTOS: Array<[number, number]> = [[0.3, 1.4], [2.0, 3.0]];
const sucia = (sr: number, semilla: number, debajo = 15) => {
  const limpia = voz(sr, TRAMOS_CORTOS);
  return mezclar(limpia, rosa(limpia.length, semilla), debajo);
};

/** Iguales BYTE A BYTE (no «parecidos»): mismo largo y mismos bits. */
function mismosBytes(a: readonly Float32Array[], b: readonly Float32Array[], que: string) {
  assert.equal(a.length, b.length, `${que}: ${a.length} canales contra ${b.length}`);
  a.forEach((x, i) => {
    assert.equal(x.length, b[i].length, `${que}, canal ${i}: largo`);
    const bx = Buffer.from(x.buffer, x.byteOffset, x.byteLength);
    const by = Buffer.from(b[i].buffer, b[i].byteOffset, b[i].byteLength);
    assert.ok(bx.equals(by), `${que}, canal ${i}: no es el mismo resultado byte a byte`);
  });
}

const dormir = () => new Promise<void>((r) => setTimeout(r, 0));

/** El atendedor del worker, con lo que manda anotado (ya clonado y transferido, como lo recibiría la pantalla). */
function atendedorDePrueba(cargarMotor: () => Promise<MotorRnnoise> = motor, soltar: () => Promise<void> = dormir) {
  const recibidos: MensajeDelHilo[] = [];
  let soltadas = 0;
  const atender = crearAtendedor({
    cargarMotor,
    enviar: (m, t) => recibidos.push(structuredClone(m, { transfer: t ?? [] })),
    soltar: async () => {
      soltadas++;
      await soltar();
    },
  });
  return { atender, recibidos, soltadas: () => soltadas };
}

/** Un pedido como lo manda el cliente: copias en búferes propios, transferidas. */
function mensajeReducir(id: number, canales: readonly Float32Array[], sampleRate: number, intensidad = 0.85): MensajeAlHilo {
  const copias = canalesParaMandar(canales);
  return structuredClone({ tipo: 'reducir', id, canales: copias, sampleRate, intensidad } as MensajeAlHilo, { transfer: transferibles(copias) });
}

/** Un Worker de mentira: lo que recibe va por `structuredClone` con transferencia al atendedor de verdad, y vuelve igual. */
class HiloDePrueba implements HiloRuido {
  recibidos: Array<{ tipo: MensajeAlHilo['tipo']; id: number }> = [];
  terminado = false;
  private escuchas: Record<string, Array<(e: never) => void>> = { message: [], error: [], messageerror: [] };
  private atender: (m: MensajeAlHilo) => Promise<void>;
  constructor({ cargarMotor = motor, retocar, soltar = dormir }: { cargarMotor?: () => Promise<MotorRnnoise>; retocar?: (m: MensajeDelHilo) => MensajeDelHilo; soltar?: () => Promise<void> } = {}) {
    this.atender = crearAtendedor({
      cargarMotor,
      enviar: (m, t) => {
        const copia = structuredClone(m, { transfer: t ?? [] });
        setTimeout(() => this.emitir('message', { data: retocar ? retocar(copia) : copia }), 0);
      },
      soltar,
    });
  }
  postMessage(mensaje: MensajeAlHilo, transferir: Transferable[]) {
    if (this.terminado) return;
    this.recibidos.push({ tipo: mensaje.tipo, id: mensaje.id });
    const copia = structuredClone(mensaje, { transfer: transferir as ArrayBuffer[] });
    setTimeout(() => void this.atender(copia), 0);
  }
  addEventListener(tipo: string, escuchar: (e: never) => void) {
    this.escuchas[tipo].push(escuchar);
  }
  emitir(tipo: string, evento: unknown) {
    for (const f of this.escuchas[tipo]) f(evento as never);
  }
  terminate() {
    this.terminado = true;
  }
}

/** La cuenta en este hilo, contando cuántas veces se usó (el respaldo). */
function respaldoContado() {
  const local = reductorEnEsteHilo(motor);
  const usos = { n: 0 };
  const enEsteHilo: ReductorRuido = (p, o) => {
    usos.n++;
    return local(p, o);
  };
  return { enEsteHilo, usos };
}

// ─────────────────────────────────────────────────────────────────────────────

test('1: el worker da el MISMO resultado byte a byte que la cuenta de siempre (mono, estéreo, lados iguales, corto)', async () => {
  const m = await motor();
  const L = sucia(44100, 21);
  const casos: Array<{ que: string; canales: Float32Array[]; sr: number }> = [
    { que: 'mono a 44,1 kHz', canales: [L], sr: 44100 },
    { que: 'estéreo, un ruido por lado (la coherencia)', canales: [sucia(48000, 22), sucia(48000, 23, 10)], sr: 48000 },
    { que: 'estéreo con los dos lados iguales', canales: [L, L.slice()], sr: 44100 },
    { que: 'más corto que una ventana', canales: [L.subarray(0, 900).slice()], sr: 44100 },
  ];
  for (const [i, { que, canales, sr }] of casos.entries()) {
    const directo = await reducirRuido({ canales, sampleRate: sr, intensidad: 0.85, motor: m });
    // El primero, con el MessageChannel que suelta el hilo en el worker de verdad; los demás, con un setTimeout.
    const { atender, recibidos } = atendedorDePrueba(motor, i === 0 ? soltarConMensajes() : dormir);
    await atender(mensajeReducir(7, canales, sr));
    const listo = recibidos.at(-1);
    assert.ok(listo?.tipo === 'listo' && listo.id === 7, `${que}: el worker no contestó «listo» (${listo?.tipo})`);
    mismosBytes(listo.canales, directo, que);
  }
});

test('2: el cliente con un worker que transfiere: el mismo resultado, sin desprender los canales del que llama', { timeout: 60_000 }, async () => {
  const m = await motor();
  // Dos canales que son vistas de UN búfer más grande, como el `getChannelData` de un AudioBuffer.
  const largo = sucia(48000, 31).length;
  const grande = new Float32Array(largo * 2 + 10);
  grande.set(sucia(48000, 31), 0);
  grande.set(sucia(48000, 32, 8), largo + 10);
  const canales = [grande.subarray(0, largo), grande.subarray(largo + 10)];
  const directo = await reducirRuido({ canales, sampleRate: 48000, intensidad: 0.85, motor: m });
  const hilo = new HiloDePrueba();
  const { enEsteHilo, usos } = respaldoContado();
  const reducir = crearReductorEnHilo({ crearHilo: () => hilo, enEsteHilo });
  const avances: number[] = [];
  const salida = await reducir({ canales, sampleRate: 48000, intensidad: 0.85 }, { alAvanzar: (h) => avances.push(h) });
  mismosBytes(salida, directo, 'el cliente');
  assert.equal(usos.n, 0, 'fue al respaldo con el worker andando');
  assert.deepEqual(hilo.recibidos, [{ tipo: 'reducir', id: 1 }]);
  assert.equal(grande.buffer.byteLength, grande.length * 4, 'se desprendió el búfer del que llama (se transfirió el original)');
  assert.equal(canales[0].length, largo);
  // Los búferes a transferir: uno por canal, sin repetir, y nunca el del que llama.
  const copias = canalesParaMandar([...canales, canales[0]]);
  const t = transferibles(copias);
  assert.equal(t.length, 3);
  assert.ok(!t.includes(grande.buffer as ArrayBuffer));
  assert.equal(transferibles([copias[0], copias[0]]).length, 1, 'el mismo búfer dos veces es un DataCloneError');
  // El avance: sube, termina en 1, y antes del 1 la estimación ya cubría casi todo el trabajo.
  assert.ok(avances.length >= 5, `${avances.length} avances`);
  for (let i = 1; i < avances.length; i++) assert.ok(avances[i] >= avances[i - 1], `el avance bajó: ${avances[i - 1]} → ${avances[i]}`);
  assert.equal(avances.at(-1), 1);
  assert.ok(avances.at(-2)! >= 0.9 && avances.at(-2)! < 1, `antes de terminar iba en ${avances.at(-2)}: la estimación no cubre el trabajo`);
  assert.ok(avances.filter((h) => h >= 0.99 && h < 1).length <= 2, 'la barra se clavó en 99 %: la estimación se quedó corta');
});

test('3: el avance de la cuenta de siempre: un 1 sólo al final, y como mucho un mensaje del worker por punto', async () => {
  const canales = [sucia(44100, 41), sucia(44100, 42, 9)];
  const avances: number[] = [];
  await reducirRuido({ canales, sampleRate: 44100, motor: await motor(), alAvanzar: (h) => avances.push(h) });
  assert.equal(avances.filter((h) => h === 1).length, 1, 'el 1 salió antes de terminar');
  assert.equal(avances.at(-1), 1);
  assert.ok(avances.at(-2)! >= 0.9, `la estimación se queda corta: ${avances.at(-2)}`);
  assert.ok(avances.at(-2)! <= 0.99, 'una estimación que se pasa no puede decir que terminó');
  assert.ok(avances.filter((h) => h >= 0.99 && h < 1).length <= 2, 'la barra se clavó en 99 %: la estimación se quedó corta');
  const { atender, recibidos } = atendedorDePrueba();
  await atender(mensajeReducir(1, canales, 44100));
  const delWorker = recibidos.filter((r) => r.tipo === 'avance').map((r) => (r as { hecho: number }).hecho);
  assert.ok(delWorker.length >= 20 && delWorker.length <= 100, `${delWorker.length} mensajes de avance`);
  assert.ok(delWorker.every((h) => h < 1), 'el 1 es «listo», no un avance');
  for (let i = 1; i < delWorker.length; i++) assert.ok(delWorker[i] - delWorker[i - 1] >= 0.01 - 1e-9);
});

test('4: cancelar en el worker corta en la próxima pausa y contesta «cancelado», nunca «listo»', { timeout: 60_000 }, async () => {
  // 20 s: sin cortar, serían decenas de pausas más.
  const larga = new Float32Array(48000 * 20);
  const base = sucia(48000, 51);
  for (let i = 0; i < larga.length; i++) larga[i] = base[i % base.length];
  const { atender, recibidos, soltadas } = atendedorDePrueba();
  const corriendo = atender(mensajeReducir(3, [larga], 48000));
  while (!recibidos.some((r) => r.tipo === 'avance')) await dormir();
  const alCancelar = soltadas();
  await atender({ tipo: 'cancelar', id: 3 });
  await corriendo;
  assert.equal(recibidos.at(-1)?.tipo, 'cancelado');
  assert.ok(!recibidos.some((r) => r.tipo === 'listo'));
  assert.ok(soltadas() - alCancelar <= 1, `siguió ${soltadas() - alCancelar} pausas después de cancelar`);
  // Cancelar uno que ya terminó no queda anotado: el mismo id vuelve a andar.
  await atender({ tipo: 'cancelar', id: 4 });
  await atender(mensajeReducir(4, [base], 48000));
  assert.equal(recibidos.at(-1)?.tipo, 'listo');
});

// Con tope: un pedido que nadie contesta tiene que poner rojo ESTE test, no colgar la tanda.
test('5: cancelar desde la pantalla rechaza enseguida, le avisa al worker, y la cuenta de acá también corta', { timeout: 60_000 }, async () => {
  const larga = new Float32Array(48000 * 20);
  const base = sucia(48000, 52);
  for (let i = 0; i < larga.length; i++) larga[i] = base[i % base.length];
  const hilo = new HiloDePrueba();
  const reducir = crearReductorEnHilo({ crearHilo: () => hilo, enEsteHilo: respaldoContado().enEsteHilo });
  const corte = new AbortController();
  let avances = 0;
  const pedido = reducir({ canales: [larga], sampleRate: 48000, intensidad: 0.85 }, { signal: corte.signal, alAvanzar: () => avances++ });
  while (avances === 0) await dormir();
  corte.abort();
  await assert.rejects(pedido, (e: unknown) => e instanceof DOMException && e.name === 'AbortError');
  assert.deepEqual(hilo.recibidos, [{ tipo: 'reducir', id: 1 }, { tipo: 'cancelar', id: 1 }]);
  // Lo que conteste el worker después («cancelado») no rompe nada ni resucita el pedido.
  for (let i = 0; i < 20; i++) await dormir();
  // Ya cancelado antes de pedir: ni se manda.
  await assert.rejects(reducir({ canales: [base], sampleRate: 48000, intensidad: 0.85 }, { signal: AbortSignal.abort() }));
  assert.equal(hilo.recibidos.length, 2);
  // En este hilo (el respaldo), igual.
  const local = reductorEnEsteHilo(motor);
  const corteLocal = new AbortController();
  let vueltas = 0;
  const enCurso = local({ canales: [larga], sampleRate: 48000, intensidad: 0.85 }, {
    signal: corteLocal.signal,
    alAvanzar: () => {
      if (++vueltas === 3) corteLocal.abort();
    },
  });
  await assert.rejects(enCurso, (e: unknown) => e instanceof DOMException && e.name === 'AbortError');
  assert.ok(vueltas <= 4, `la cuenta de acá siguió ${vueltas} pausas`);
});

test('6: el respaldo: sin worker, un worker que no carga, uno que no pudo bajar RNNoise, y uno al que le falla la cuenta', { timeout: 60_000 }, async () => {
  const m = await motor();
  const pedido = { canales: [sucia(44100, 61)], sampleRate: 44100, intensidad: 0.85 };
  const directo = await reducirRuido({ ...pedido, motor: m });

  // a) No se puede crear el worker: acá, y no se vuelve a intentar.
  {
    const { enEsteHilo, usos } = respaldoContado();
    let creados = 0;
    const reducir = crearReductorEnHilo({ crearHilo: () => { creados++; throw new Error('Worker is not defined'); }, enEsteHilo });
    mismosBytes(await reducir(pedido), directo, 'sin worker');
    await reducir(pedido);
    assert.equal(creados, 1, 'volvió a intentar crear el worker');
    assert.equal(usos.n, 2);
  }
  // b) El worker no carga (el evento `error`): lo que estaba en él se rehace acá, con los canales del que llamó.
  {
    const { enEsteHilo, usos } = respaldoContado();
    const hilo = new HiloDePrueba({ cargarMotor: () => new Promise(() => {}) }); // nunca contesta
    const reducir = crearReductorEnHilo({ crearHilo: () => hilo, enEsteHilo });
    const enElAire = reducir(pedido);
    await dormir();
    hilo.emitir('error', new Event('error'));
    mismosBytes(await enElAire, directo, 'worker caído');
    assert.ok(hilo.terminado, 'el worker caído no se terminó');
    await reducir(pedido);
    assert.equal(usos.n, 2, 'después de caerse, todo acá');
    assert.equal(hilo.recibidos.length, 1, 'le siguió mandando al worker caído');
  }
  // c) El worker no pudo bajar RNNoise: ese pedido, acá; el próximo vuelve a probar el worker.
  {
    const { enEsteHilo, usos } = respaldoContado();
    let intentos = 0;
    const hilo = new HiloDePrueba({ cargarMotor: () => (++intentos === 1 ? Promise.reject(new Error('404')) : motor()) });
    const reducir = crearReductorEnHilo({ crearHilo: () => hilo, enEsteHilo });
    mismosBytes(await reducir(pedido), directo, 'sin RNNoise en el worker');
    assert.equal(usos.n, 1);
    mismosBytes(await reducir(pedido), directo, 'el worker, al segundo intento');
    assert.equal(usos.n, 1, 'el segundo pedido no volvió a probar el worker');
    assert.equal(hilo.recibidos.length, 2);
  }
  // d) Falla la CUENTA: se dice, no se repite acá (fallaría igual).
  {
    const { enEsteHilo, usos } = respaldoContado();
    const hilo = new HiloDePrueba({ retocar: (r) => (r.tipo === 'listo' ? { tipo: 'error', id: r.id, donde: 'calculo', error: 'se rompió la cuenta' } : r) });
    const reducir = crearReductorEnHilo({ crearHilo: () => hilo, enEsteHilo });
    await assert.rejects(reducir(pedido), /se rompió la cuenta/);
    assert.equal(usos.n, 0);
  }
});

test('8: los topes: un worker que no contesta se deja y lo suyo se hace acá; uno que avanza, no; y un motor que no carga se dice', { timeout: 60_000 }, async () => {
  const m = await motor();
  const pedido = { canales: [sucia(44100, 71)], sampleRate: 44100, intensidad: 0.85 };
  const directo = await reducirRuido({ ...pedido, motor: m });
  // a) Un worker COLGADO (la bajada del .wasm que nunca contesta, sin evento `error`): pasado el tope, acá.
  {
    const { enEsteHilo, usos } = respaldoContado();
    const hilo = new HiloDePrueba({ cargarMotor: () => new Promise(() => {}) });
    const reducir = crearReductorEnHilo({ crearHilo: () => hilo, enEsteHilo, topeSilencioMs: 80 });
    const inicio = Date.now();
    mismosBytes(await reducir(pedido), directo, 'worker colgado');
    assert.ok(Date.now() - inicio < 20_000, 'esperó de más');
    assert.ok(hilo.terminado, 'el worker colgado no se terminó');
    assert.equal(usos.n, 1);
    await reducir(pedido);
    assert.equal(usos.n, 2, 'después de colgarse, todo acá');
    assert.equal(hilo.recibidos.length, 1, 'le siguió mandando al worker colgado');
  }
  // b) Un worker que tarda pero AVANZA (cada avance vuelve a armar el tope): termina en el worker.
  {
    const { enEsteHilo, usos } = respaldoContado();
    // Más lento que el tope en total, con cada paso más corto que él (la pausa de la cuenta, cada ~28 ms de trabajo).
    const hilo = new HiloDePrueba({ soltar: () => new Promise<void>((r) => setTimeout(r, 30)) });
    const reducir = crearReductorEnHilo({ crearHilo: () => hilo, enEsteHilo, topeSilencioMs: 400 });
    const inicio = Date.now();
    mismosBytes(await reducir(pedido), directo, 'worker lento');
    assert.ok(Date.now() - inicio > 400, `tardó ${Date.now() - inicio} ms: no prueba el tope`);
    assert.equal(usos.n, 0, 'un worker que avanza no se deja');
    assert.ok(!hilo.terminado);
  }
  // c) Acá, un motor que no termina de cargar rechaza con un texto que dice qué hacer (y el export lo cuenta así).
  {
    const colgado = reductorEnEsteHilo(() => new Promise(() => {}), { topeCargaMs: 50 });
    await assert.rejects(colgado(pedido), (e: Error) => e.message === TEXTO_SIN_MOTOR);
    assert.match(TEXTO_SIN_MOTOR, /Revisa tu conexión y vuelve a intentar\.$/);
    const enExport = mensajeDeExport(new Error(TEXTO_SIN_MOTOR));
    assert.notEqual(enExport, MENSAJE_EXPORT_GENERICO);
    assert.match(enExport, /apágala en el clip/);
  }
});

test('7: la dirección del .wasm se arma contra el origen (en un worker de Turbopack, `location` es un `blob:`)', () => {
  const blob = 'blob:https://hola-mako.com/7f3c0f0e-5d3a-4a9c-9d4e-2f6b1c0a1e11';
  // La trampa: contra un `blob:` una ruta no se resuelve (es lo que hacía `fetch("/ve/…")` adentro del worker).
  assert.throws(() => new URL(URL_WASM_RNNOISE, blob));
  assert.equal(direccionWasmRnnoise(new URL(blob).origin), `https://hola-mako.com${URL_WASM_RNNOISE}`);
  assert.equal(direccionWasmRnnoise('http://localhost:3000'), `http://localhost:3000${URL_WASM_RNNOISE}`);
  assert.equal(direccionWasmRnnoise('null'), URL_WASM_RNNOISE, 'un origen opaco no sirve de base');
  assert.equal(direccionWasmRnnoise(null), URL_WASM_RNNOISE);
});

// ── Roturas (10/11/2026, base 7/0 + el cableado 1/0): cada una sola, con un script que rompe, corre ambos archivos y
//    restaura desde la copia en memoria ──
//   R1  sin copiar los canales antes de transferir (`[...canales]`)       → 4 rojos (1, 2, 5, 6: se desprende el del que llama)
//   R2  `transferibles` sin sacar los repetidos                           → el 2
//   R3  la pausa del worker no mira si lo cancelaron                      → el 4 (contesta «listo»)
//   R4  el cliente rechaza cuando el worker no pudo cargar RNNoise        → el 6
//   R5  un worker caído no pasa lo pendiente al respaldo                  → el 6 (por su tope de 60 s: el pedido queda colgado)
//   R6  cancelar no le avisa al worker                                    → el 5
//   R7  sin el 1 al terminar (`avance.fin()`)                             → el 3
//   R8  la estimación sin el espejo (se queda corta)                      → el 3 (la barra se clava en 99 %)
//   R9  la cadena vuelve a `reducirRuido` con `motorRnnoise()`            → el cableado
//   R10 la dirección del .wasm, relativa siempre                          → el 7
//   R11 el worker manda el 1 como un avance                               → 2 y 3
//   R12 el worker suelta con `setTimeout`                                 → el cableado
//   R13 el worker cambia la intensidad (la cuenta deja de ser la misma)   → 1, 2 y 6 (no es el mismo byte a byte)
//   R14 «Borrar silencios» con la cuenta en la pantalla                   → el cableado
//   R15 sin respaldo cuando no hay worker (un pedido que nunca contesta)  → el 6 (por su tope de 60 s)
//   (10/11/2026, la revisión del worker; base 8/0, una rotura por vez, restaurada de memoria):
//   R16 sin el vigía (el tope de silencio)                                → el 8 (a: cancelado por su tope de 60 s, colgado)
//   R17 un avance no vuelve a armar el vigía                              → el 8 (b: el lento se deja)
//   R18 dejar el worker no pasa lo pendiente al respaldo                  → 6 y 8 (cancelados por su tope: quedan colgados)
//   R19 el motor de acá sin tope                                          → el 8 (c: cancelado por su tope de 60 s)
//   R20 el export sin la frase del motor que no cargó                     → el 8 (c)
//   R21 (sin efecto) renombrar `vigilar`                                  → 8 / 0
//   NO lo ve node: que Turbopack empaquete el worker y que en el navegador corra (eso se mira en el editor: ver el relevo).
