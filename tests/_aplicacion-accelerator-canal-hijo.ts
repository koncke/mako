// =============================================================================
// Hijo de tests/aplicacion-accelerator.test.ts (test 18) — NO es un test (no termina en .test.ts)
// =============================================================================
// GET /api/accelerator/canal DE VERDAD (app/api/accelerator/canal/route.ts y lib/aplicacion-accelerator-canal.ts), con la búsqueda
// de Competitor Spy (lib/spy-buscar.ts) y el workspace de mentira: Spy cuesta crédito de Apify, y lo que se prueba acá es qué se le
// pide, en qué workspace, con qué reserva y cuándo NO se le pide (los topes). Necesita `--conditions=react-server` y
// `--experimental-test-module-mocks`. Imprime el resultado como JSON.

import { mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = join(import.meta.dirname, '..');

/** Todo lo que el módulo exporta, de mentira; arriba, lo que este arnés necesita. Un nombre que falta no carga el módulo. */
function stub(rel: string, propios: Record<string, unknown>): void {
  const src = readFileSync(join(RAIZ, rel), 'utf8');
  const nombres = [...src.matchAll(/^export (?:async )?(?:function\*? |const |let )(\w+)/gm)].map((m) => m[1]);
  const namedExports: Record<string, unknown> = {};
  for (const n of nombres) namedExports[n] = () => { throw new Error(`${rel}: ${n} sin mock`); };
  mock.module(pathToFileURL(join(RAIZ, rel)).href, { namedExports: { ...namedExports, ...propios } });
}

let enLaPlataforma = 0;
let fueraDeLaPlataforma = 0;
let dentro = false;
stub('lib/workspace.ts', {
  wsSuperAdmin: async () => 9,
  runWithWorkspace: async (ws: number, f: () => unknown) => {
    if (ws === 9) enLaPlataforma++; else fueraDeLaPlataforma++;
    dentro = true;
    try { return await f(); } finally { dentro = false; }
  },
});

const llamadas = { leerExacto: [] as Array<{ ws: number; usuario: string; reserva?: number }>, leerCanalHallado: [] as string[], buscarEnGoogle: 0 };
let modoIg: 'esta' | 'foto-http' | 'sin-credito' | 'no-esta' = 'esta';
let ytTira = false;
stub('lib/spy-buscar.ts', {
  leerExacto: async (ws: number, usuario: string, o: { reserva?: number } = {}) => {
    if (!dentro) fueraDeLaPlataforma++;
    llamadas.leerExacto.push({ ws, usuario, reserva: o.reserva });
    if (modoIg === 'sin-credito') return { perfil: null, vacio: 'fallo' };
    if (modoIg === 'no-esta') return { perfil: null, vacio: null };
    return { perfil: { usuario, nombre: 'Ana Coach', foto: modoIg === 'foto-http' ? 'http://cdn.example/ana.jpg' : 'https://cdn.example/ana.jpg', seguidores: 12400 }, vacio: null };
  },
  leerCanalHallado: async (ref: string) => {
    if (!dentro) fueraDeLaPlataforma++;
    llamadas.leerCanalHallado.push(ref);
    if (ytTira) throw new Error('YouTube no contestó');
    return { canal: { ref, nombre: 'Ana Coach TV', foto: null, suscriptores: 900, url: `https://www.youtube.com/${ref}` }, vacio: null };
  },
  buscarEnGoogle: async () => {
    if (!dentro) fueraDeLaPlataforma++;
    llamadas.buscarEnGoogle++;
    const p = (u: string) => ({ usuario: u, nombre: u, foto: null, seguidores: null });
    return { instagram: ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'].map(p), youtube: [], vacio: null };
  },
});

async function main() {
  const { GET } = await import('../app/api/accelerator/canal/route');
  const { NextRequest } = await import('next/server');
  let ip = 0;
  const pedir = async (q: Record<string, string>, o: { ip?: string; sitio?: string } = {}) => {
    const headers: Record<string, string> = { 'x-forwarded-for': o.ip ?? `10.1.0.${++ip}`, 'sec-fetch-site': o.sitio ?? 'same-origin' };
    const r = await GET(new NextRequest(`https://hola-mako.com/api/accelerator/canal?${new URLSearchParams(q)}`, { headers }));
    return { status: r.status, body: await r.json() };
  };
  const out: Record<string, unknown> = {};
  out.igExacto = await pedir({ red: 'instagram', q: 'https://www.instagram.com/Ana.Coach/' });
  modoIg = 'foto-http';
  out.igFotoHttp = await pedir({ red: 'instagram', q: '@ana.coach' });
  modoIg = 'sin-credito';
  out.igSinCredito = await pedir({ red: 'instagram', q: '@ana.coach' });
  modoIg = 'no-esta';
  out.igNoEsta = await pedir({ red: 'instagram', q: '@nadie.aca' });
  modoIg = 'esta';
  out.igNombre = await pedir({ red: 'instagram', q: 'Ana Coach' });
  out.ytExacto = await pedir({ red: 'youtube', q: 'https://www.youtube.com/@anacoach' });
  ytTira = true;
  out.ytTira = await pedir({ red: 'youtube', q: '@otrocanal' });
  ytTira = false;
  const antes = JSON.stringify(llamadas);
  out.corto = await pedir({ red: 'instagram', q: '@an' });
  out.cortoNoLlama = JSON.stringify(llamadas) === antes;
  out.sinRed = await pedir({ red: 'tiktok', q: '@ana' });
  out.otroSitio = await pedir({ red: 'instagram', q: '@ana.coach' }, { sitio: 'cross-site' });
  // El tope por IP: 20 por hora, con búsquedas de YouTube por @ (las del día de Apify no se tocan).
  const porIp: string[] = [];
  for (let i = 0; i < 21; i++) {
    const r = await pedir({ red: 'youtube', q: `@canal${i}x` }, { ip: '203.0.113.7' });
    porIp.push(r.body.vacio === 'limite' ? 'limite' : 'ok');
  }
  out.porIp = porIp;
  // El tope del día por nombre (Google por Apify): 15 entre todos. Ya se usó una (`igNombre`): de 15 más, la última no se busca.
  const porDia: string[] = [];
  for (let i = 0; i < 15; i++) {
    const r = await pedir({ red: 'instagram', q: `Nombre Distinto ${i}` });
    porDia.push(r.body.vacio === 'limite' ? 'limite' : 'ok');
  }
  out.porDia = porDia;
  out.googleTrasElTope = llamadas.buscarEnGoogle;
  out.llamadas = llamadas;
  out.todoEnLaPlataforma = enLaPlataforma > 0 && fueraDeLaPlataforma === 0;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
