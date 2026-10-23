// =============================================================================
// Hijo de tests/ia-pc-enlace.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `conectarDesdeEnlace` del programa REAL (scripts/ia-pc/mako-pc.mjs) contra un MaKo de mentira (el `fetch` de acá), con
// su carpeta en un directorio temporal, la ventana de mentira (anota qué preguntó y contesta lo que se le pida) y sin tocar
// el arranque de la PC. Escribe el resultado como JSON.
// =============================================================================

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'mako-pc-enlace-'));
process.env.MAKO_PC_DIR = dir;
process.env.MAKO_PC_SIN_ARRANQUE = '1';
delete process.env.MAKO_PC_SI;

let pedidos = [];
let respuestas = {};
globalThis.fetch = async (entrada, init = {}) => {
  const u = new URL(String(entrada));
  pedidos.push(`${u.host}${u.pathname}`);
  const r = respuestas[u.pathname] ?? { status: 500, datos: { error: 'red de mentira' } };
  return new Response(JSON.stringify(r.datos), { status: r.status, headers: { 'content-type': 'application/json' } });
};

const pc = await import(new URL('../scripts/ia-pc/mako-pc.mjs', import.meta.url).href);
const config = () => { try { return JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')); } catch { return null; } };
const correr = async (enlace, contesta) => {
  pedidos = [];
  const ventanas = [];
  let arrancado = 0;
  const salida = await pc.conectarDesdeEnlace(enlace, {
    ventana: async (titulo, texto, botones = 'si-no') => { ventanas.push({ titulo, texto, botones }); return botones === 'si-no' ? contesta : true; },
    arrancar: () => { arrancado++; },
  });
  return { salida, ventanas, arrancado, pedidos: [...pedidos], config: config() };
};
const BIEN = {
  '/api/ia-pc/emparejar': { status: 200, datos: { token: 'tok-nuevo', negocio: 'Pizzería Ana', persona: 'Ana' } },
  '/api/ia-pc/confirmar': { status: 200, datos: { ok: true } },
  '/api/ia-pc/soltar': { status: 200, datos: { ok: true } },
};
const out = {};

// 1) Un enlace que no es de conectar: se dice, y no sale nada a la red.
out.malo = await correr('https://hola-mako.com/conectar?codigo=ABCD2345', true);
// 2) Dice que NO: se suelta lo pendiente y queda como estaba.
respuestas = BIEN;
out.no = await correr('mako://conectar?codigo=ABCD-2345', false);
// 3) Dice que SÍ (y el enlace trae un servidor ajeno, que se ignora): queda conectada y arranca.
out.si = await correr('mako://conectar?codigo=ABCD2345&servidor=https://malo.example', true);
// 4) Otra vez, con la de antes: la ventana dice que se reemplaza.
respuestas = { ...BIEN, '/api/ia-pc/emparejar': { status: 200, datos: { token: 'tok-otro', negocio: 'Otro negocio', persona: '' } } };
out.reemplaza = await correr('mako://conectar?codigo=ABCD2345', true);
// 5) MaKo rechaza el código: se dice su error, y lo de antes queda.
respuestas = { ...BIEN, '/api/ia-pc/emparejar': { status: 410, datos: { error: 'Ese código ya venció o se usó: pide otro en MaKo.' } } };
out.vencido = await correr('mako://conectar?codigo=ABCD2345', true);
// 6) MaKo no confirma: no cambia nada.
respuestas = { ...BIEN, '/api/ia-pc/emparejar': { status: 200, datos: { token: 'tok-3', negocio: 'Tercero', persona: '' } }, '/api/ia-pc/confirmar': { status: 409, datos: { error: 'No pude confirmar.' } } };
out.sinConfirmar = await correr('mako://conectar?codigo=ABCD2345', true);

writeFileSync(1, `@@ENLACE@@${JSON.stringify(out)}\n`);
rmSync(dir, { recursive: true, force: true });
setTimeout(() => process.exit(0), 200).unref();
