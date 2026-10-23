// =============================================================================
// Hijo de tests/ia-pc-mac-app.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `abrirLaApp` del programa REAL (scripts/ia-pc/mako-pc.mjs) con su carpeta en un directorio temporal, sin tocar el
// arranque de la PC, y con todo lo de la Mac de mentira (las ventanas, el portapapeles, Claude Code, la conexión). Escribe el
// resultado como JSON.
// =============================================================================

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'mako-pc-mac-'));
process.env.MAKO_PC_DIR = dir;
process.env.MAKO_PC_SIN_ARRANQUE = '1';
delete process.env.MAKO_PC_SI;
const pc = await import(new URL('../scripts/ia-pc/mako-pc.mjs', import.meta.url).href);
const guardar = (c) => writeFileSync(join(dir, 'config.json'), JSON.stringify(c));
const borrar = () => rmSync(join(dir, 'config.json'), { force: true });

async function caso({ config = null, copiado = '', escrito = null, claude = 'con-sesion', instala = 0, contesta = true }) {
  borrar();
  if (config) guardar(config);
  const hizo = { ventanas: [], pidio: 0, instalo: 0, arranco: 0, inicio: 0, conecto: null, avisos: [] };
  let estadoClaude = claude;
  const salida = await pc.abrirLaApp({
    ventana: async (_t, texto, botones = 'si-no') => { hizo.ventanas.push({ texto, botones }); return botones === 'si-no' ? contesta : true; },
    pedir: async () => { hizo.pidio++; return escrito; },
    copiado: () => copiado,
    sesion: async () => estadoClaude,
    instalarClaude: async () => { hizo.instalo++; if (instala === 0) estadoClaude = 'sin-sesion'; return instala; },
    iniciarSesion: async () => { hizo.inicio++; return 0; },
    arrancar: () => { hizo.arranco++; },
    conectar: async (enlace, p) => { hizo.conecto = { enlace, conArranque: typeof p.arrancar === 'function', conSesion: typeof p.sesionDeClaude === 'function' }; return 0; },
    aviso: (t) => { hizo.avisos.push(t); },
  });
  return { salida, ...hizo };
}

const out = {};
out.delPortapapeles = await caso({ copiado: ' abcd-2345 \n' });
out.escrito = await caso({ copiado: 'cualquier otra cosa', escrito: 'WXYZ6789' });
out.nada = await caso({ copiado: '', escrito: null });
out.sinClaude = await caso({ copiado: 'ABCD2345', claude: 'falta', instala: 0 });
out.noInstala = await caso({ copiado: 'ABCD2345', claude: 'falta', instala: 1 });
out.yaConectada = await caso({ config: { token: 'tok', negocio: 'Mauricio' }, copiado: '' });
out.yaConectadaSinSesion = await caso({ config: { token: 'tok', negocio: 'Mauricio' }, claude: 'sin-sesion' });
out.otroNegocio = await caso({ config: { token: 'tok', negocio: 'Mauricio' }, copiado: 'MNPQ2345' });
out.codigos = ['ABCD-2345', 'abcd 2345', 'ABCD2345', 'ABCD-234O', 'Hola ABCD2345', '', 'ABCD23456'].map((x) => pc.codigoDelTexto(x));
out.plist = pc.plistDelArranque('/Users/mau/.mako-pc/bin/mako-pc', '/Users/mau');
writeFileSync(1, `@@MAC@@${JSON.stringify(out)}\n`);
rmSync(dir, { recursive: true, force: true });
setTimeout(() => process.exit(0), 200).unref();
