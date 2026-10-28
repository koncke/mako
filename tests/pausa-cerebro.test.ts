// La PAUSA del Cerebro por archivo (scripts/pausa-cerebro.mjs): mientras existe, tests-afectados y tsc-acotado esperan.
// 28/10/2026: pedida por mensaje, tres chats corrieron pruebas igual durante la subida de tren-v y el push cayó «sin RAM».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esperarSinPausa, pausaVigente, PAUSA_OLVIDADA_MS } from '../scripts/pausa-cerebro.mjs';

/** Corre `fn` sin CI ni MAKO_IGNORAR_PAUSA (en Actions CI=true apaga la pausa) y restaura el entorno. */
async function sinCi<T>(fn: () => Promise<T> | T, extra: Record<string, string> = {}): Promise<T> {
  const antes = { CI: process.env.CI, IGN: process.env.MAKO_IGNORAR_PAUSA, ...Object.fromEntries(Object.keys(extra).map((k) => [k, process.env[k]])) };
  delete process.env.CI;
  delete process.env.MAKO_IGNORAR_PAUSA;
  Object.assign(process.env, extra);
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries({ CI: antes.CI, MAKO_IGNORAR_PAUSA: antes.IGN, ...Object.fromEntries(Object.keys(extra).map((k) => [k, (antes as Record<string, string | undefined>)[k]])) })) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
}

const carpeta = () => mkdtempSync(join(tmpdir(), 'pausa-cerebro-'));

test('sin archivo no hay pausa; con archivo, el motivo; vacío, un motivo por defecto', () => sinCi(() => {
  const dir = carpeta();
  try {
    const f = join(dir, 'pausa.txt');
    assert.equal(pausaVigente(f), null);
    writeFileSync(f, 'subiendo tren-w');
    assert.equal(pausaVigente(f), 'subiendo tren-w');
    writeFileSync(f, '');
    assert.equal(pausaVigente(f), 'pausa del Cerebro');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('una pausa de más de 90 minutos se da por olvidada y no frena a nadie', () => sinCi(() => {
  const dir = carpeta();
  try {
    const f = join(dir, 'pausa.txt');
    writeFileSync(f, 'vieja');
    const hace = (Date.now() - PAUSA_OLVIDADA_MS - 60_000) / 1000;
    utimesSync(f, hace, hace);
    assert.equal(pausaVigente(f), null);
    assert.equal(pausaVigente(f, Date.now() - 2 * PAUSA_OLVIDADA_MS), 'vieja', 'medida desde un reloj anterior, sigue vigente');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('en Actions (CI) y con MAKO_IGNORAR_PAUSA=1 la pausa no existe', async () => {
  const dir = carpeta();
  try {
    const f = join(dir, 'pausa.txt');
    writeFileSync(f, 'subiendo');
    await sinCi(() => assert.equal(pausaVigente(f), null), { CI: 'true' });
    await sinCi(() => assert.equal(pausaVigente(f), null), { MAKO_IGNORAR_PAUSA: '1' });
    await sinCi(() => assert.equal(pausaVigente(f), 'subiendo'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('esperarSinPausa espera mientras está prendida y sigue cuando el Cerebro la apaga', () => sinCi(async () => {
  const dir = carpeta();
  try {
    const f = join(dir, 'pausa.txt');
    writeFileSync(f, 'subiendo tren-w');
    let reloj = Date.now();
    let vueltas = 0;
    const dicho: string[] = [];
    const ok = await esperarSinPausa({
      quien: 'test', archivo: f, ahora: () => reloj, out: (t) => { dicho.push(t); return true; },
      dormir: async () => { reloj += 5000; if (++vueltas === 3) rmSync(f); },
    });
    assert.equal(ok, true);
    assert.equal(vueltas, 3, 'esperó hasta que se borró el archivo');
    assert.match(dicho.join(''), /pidió PAUSA \(«subiendo tren-w»\)/);
    assert.match(dicho.join(''), /levantó la pausa/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('esperarSinPausa nunca bloquea para siempre: pasado el tope, corre igual y lo dice', () => sinCi(async () => {
  const dir = carpeta();
  try {
    const f = join(dir, 'pausa.txt');
    writeFileSync(f, 'colgada');
    let reloj = Date.now();
    const dicho: string[] = [];
    const ok = await esperarSinPausa({
      quien: 'test', archivo: f, esperaMaxMs: 20_000, ahora: () => reloj, out: (t) => { dicho.push(t); return true; },
      dormir: async () => { reloj += 5000; },
    });
    assert.equal(ok, false);
    assert.match(dicho.join(''), /corro igual/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('tests-afectados: la pausa cuenta como «no hay RAM», aunque haya RAM y aunque esté MAKO_TESTS_SIN_ESPERA', async () => {
  const dir = carpeta();
  const f = join(dir, 'pausa.txt');
  try {
    await sinCi(async () => {
      const { esperarRam } = await import('../scripts/tests-afectados.mjs');
      const sinPiso = () => 0;
      assert.equal(await esperarRam(2, { pisoGb: sinPiso, esperaMaxMs: 0, quien: 'test' }), 2, 'sin pausa y con RAM, corre');
      writeFileSync(f, 'subiendo tren-w');
      assert.equal(await esperarRam(2, { pisoGb: sinPiso, esperaMaxMs: 0, quien: 'test' }), 0, 'con pausa no corre: «no hay RAM»');
    }, { MAKO_PAUSA_ARCHIVO: f, MAKO_TESTS_SIN_ESPERA: '1' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
