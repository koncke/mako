// =============================================================================
// Ayudante de los tests de workflows: correr un paso de verdad, y evaluar la condición `if:` de un job contra un evento.
// =============================================================================
// Un workflow no se prueba leyéndolo: «copiar una línea en un regex no prueba nada» (AGENTS.md, 4/11/2026). Lo que decide si
// algo corre es la condición del job y el script del paso, así que el test corre el script en bash (como el runner, `bash -e`)
// y evalúa la condición con el subconjunto de expresiones de GitHub que usan estos archivos: `==`, `!=`, `&&`, `||`, `!`,
// paréntesis, `contains()` (sin distinguir mayúsculas, como GitHub), `startsWith()`, cadenas '…', y rutas `a.b.c` (lo que
// falta es null). Una expresión con algo más TIRA: el evaluador no adivina.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

/** El cuerpo del `run: |` de un paso (los pasos van a 6 espacios y su script a 10, como en todos los workflows del repo). */
export function scriptDelPaso(yml: string, nombre: string): string {
  const lineas = sinComentarios(yml).split('\n');
  const i = lineas.findIndex((l) => l.trim() === `- name: ${nombre}`);
  if (i < 0) throw new Error(`no encuentro el paso «${nombre}»`);
  let fin = lineas.findIndex((l, k) => k > i && /^ {6}- /.test(l));
  if (fin < 0) fin = lineas.length;
  const bloque = lineas.slice(i, fin);
  const r = bloque.findIndex((l) => /^ {8}run: \|$/.test(l));
  if (r < 0) throw new Error(`el paso «${nombre}» no tiene un run: |`);
  return bloque.slice(r + 1).map((l) => l.slice(10)).join('\n');
}

/** Corre el script de un paso en bash, con `antes` (funciones de mentira: gh, node…) y el entorno que pida el test. */
export function correrPaso(yml: string, nombre: string, o: { antes?: string; env?: Record<string, string>; cwd?: string } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'wf-paso-'));
  const script = join(tmp, 'paso.sh');
  writeFileSync(script, `${o.antes ?? ''}\n${scriptDelPaso(yml, nombre)}\n`);
  const resumen = join(tmp, 'resumen');
  const salidaGh = join(tmp, 'github-output');
  writeFileSync(resumen, '');
  writeFileSync(salidaGh, '');
  const r = spawnSync('bash', ['-e', script], {
    cwd: o.cwd ?? tmp,
    encoding: 'utf8',
    // NODE_ENV: con los .d.ts de Next, ProcessEnv lo pide obligatorio (lo cazó el filtro de la punta: TS2769).
    env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', HOME: tmp, RUNNER_TEMP: tmp, GITHUB_STEP_SUMMARY: resumen, GITHUB_OUTPUT: salidaGh, ...o.env },
  });
  if (r.error) throw r.error;
  return { codigo: r.status, salida: `${r.stdout}${r.stderr}`, resumen: readFileSync(resumen, 'utf8'), outputs: readFileSync(salidaGh, 'utf8') };
}

/** La condición `if:` de un JOB (a 4 espacios), en una línea o como bloque `>-`. null si el job no tiene. */
export function condicionDelJob(yml: string, job: string): string | null {
  const lineas = sinComentarios(yml).split('\n');
  const i = lineas.findIndex((l) => l === `  ${job}:`);
  if (i < 0) throw new Error(`no encuentro el job «${job}»`);
  let fin = lineas.findIndex((l, k) => k > i && /^ {2}\S/.test(l));
  if (fin < 0) fin = lineas.length;
  for (let k = i + 1; k < fin; k++) {
    const m = /^ {4}if: (.*)$/.exec(lineas[k]);
    if (!m) continue;
    if (m[1].trim() !== '>-') return m[1].trim().replace(/^"(.*)"$/, '$1');
    const partes: string[] = [];
    for (let j = k + 1; j < fin && /^ {6,}\S/.test(lineas[j]); j++) partes.push(lineas[j].trim());
    return partes.join(' ');
  }
  return null;
}

type Valor = string | number | boolean | null | Record<string, unknown> | unknown[];

/** Evalúa una expresión de GitHub Actions contra un contexto (`{ github: { event_name, event: {...} } }`). */
export function evaluar(expr: string, ctx: Record<string, unknown>): Valor {
  const fuente = expr.replace(/^\$\{\{\s*|\s*\}\}$/g, '');
  const tokens = [...fuente.matchAll(/\s*(\|\||&&|==|!=|!|\(|\)|,|'(?:[^']|'')*'|[A-Za-z_][\w.-]*|\d+)/gy)].map((m) => m[1]);
  if (tokens.join('').replace(/\s/g, '') !== fuente.replace(/\s/g, '')) throw new Error(`no entiendo la expresión: ${expr}`);
  let p = 0;
  const ver = () => tokens[p];
  const tomar = (t?: string) => { const x = tokens[p++]; if (t && x !== t) throw new Error(`esperaba «${t}» y vino «${x}» en: ${expr}`); return x; };
  const verdad = (v: Valor) => !(v === null || v === false || v === '' || v === 0 || v === undefined);
  const ruta = (r: string): Valor => {
    let v: unknown = ctx;
    for (const k of r.split('.')) v = v != null && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
    return v === undefined ? null : (v as Valor);
  };
  const primario = (): Valor => {
    const t = tomar();
    if (t === '(') { const v = o(); tomar(')'); return v; }
    if (t === '!') return !verdad(primario());
    if (t.startsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
    if (/^\d+$/.test(t)) return Number(t);
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t === 'null') return null;
    if (ver() === '(') {
      tomar('(');
      const args: Valor[] = [o()];
      while (ver() === ',') { tomar(','); args.push(o()); }
      tomar(')');
      const [a, b] = args.map((x) => (x == null ? '' : String(x).toLowerCase()));
      if (t === 'contains') return args[0] != null && a.includes(b);
      if (t === 'startsWith') return args[0] != null && a.startsWith(b);
      throw new Error(`función que el evaluador no conoce: ${t}`);
    }
    return ruta(t);
  };
  const comparacion = (): Valor => {
    const a = primario();
    if (ver() === '==' || ver() === '!=') {
      const op = tomar();
      const b = primario();
      const igual = typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : a === b;
      return op === '==' ? igual : !igual;
    }
    return a;
  };
  const y = (): Valor => { let v = comparacion(); while (ver() === '&&') { tomar(); const w = comparacion(); v = verdad(v) ? w : v; } return v; };
  const o = (): Valor => { let v = y(); while (ver() === '||') { tomar(); const w = y(); v = verdad(v) ? v : w; } return v; };
  const v = o();
  if (p !== tokens.length) throw new Error(`sobra «${tokens.slice(p).join(' ')}» en: ${expr}`);
  return v;
}

/** ¿El job corre con este evento? (sin `if:`, siempre). */
export function corre(yml: string, job: string, github: Record<string, unknown>): boolean {
  const c = condicionDelJob(yml, job);
  if (c == null) return true;
  const v = evaluar(c, { github });
  return !(v === null || v === false || v === '' || v === 0);
}

export const leerWorkflow = (raiz: string, archivo: string) => readFileSync(join(raiz, '.github', 'workflows', archivo), 'utf8');
