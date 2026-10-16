// =============================================================================
// Los textos del Centro de Operaciones dicen QUÉ HACER y PARA QUÉ, y el cartero se llama Runner (15/10/2026)
// =============================================================================
// Martín, mirando el Centro en producción: «Jamás pongas mensajes no claros como "Este dispositivo todavía no
// firma.", es mucho mejor "Crea tu Token para comenzar a chatear"». Y: «No quiero que se llame más "cartero",
// sino un nombre más formal, tecnico... profesional». Se llama Runner (lib/runner.ts, copiado de GitHub
// Actions); en el código, la base y la PC sigue siendo el cartero.
//
// Lo que fija, cada uno probado rompiéndolo (15/10/2026, con la base en 0 fallos):
//   1. Ningún texto que se dibuja dice «cartero», «clave» ni un estado interno. Devolviendo «Este dispositivo
//      todavía no firma.» a lib/centro-chats.ts → 2 fallos (éste y el 2); «Cartero» en el título del botón de
//      CentroApp.tsx → 1 fallo.
//   2. La caja de cada conversación arranca con lo que hay que hacer, y la frase de Martín va textual.
//   3. La PC reconoce al Runner por su nombre nuevo, el viejo y como sub-chat. Con el regex de antes
//      (/^cartero\b/i) → 1 fallo.
//   4. Las instrucciones que se le pegan al chat Runner nombran comandos que cartero.mjs tiene. Cambiando
//      `acuse` por `confirmar` en lib/runner.ts → 1 fallo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
/** Lo que se dibuja: cadenas con un espacio o que arrancan en mayúscula, y el texto JSX entre etiquetas. Deja afuera
 *  las clases (`co-carteros`), las rutas de import y los ids.
 *  ⚠️ El texto JSX se toma después del `>` de una ETIQUETA (no de un `=>` ni de un `a > b`) y hasta el próximo `<` o
 *  `{`, cruzando renglones: `<Icon … />Runners` sigue en el renglón de abajo con su `<span>`. La primera versión
 *  pedía el `<` en el mismo renglón y no vio un «Cartero» puesto a propósito en ese botón (0 fallos). */
const cadenas = (src: string) => [...src.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
const textoJsx = (src: string) => [...src.matchAll(/(?<=[\w"'}/]>)([^<>{}]+)(?=[<{])/g)].map((m) => m[1])
  .filter((t) => !/[=;()[\]]|&&|\?\?/.test(t));
const visibles = (src: string) => [...cadenas(src), ...textoJsx(src)]
  .map((t) => t.replace(/\$\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim())
  .filter((t) => t && (/\s/.test(t) || /^[A-ZÁÉÍÓÚ¿¡]/.test(t)) && !t.startsWith('@/') && !/^\.{0,2}\//.test(t));

const PANTALLAS = [
  'app/admin/operaciones/CentroApp.tsx', 'app/admin/operaciones/Conversacion.tsx', 'app/admin/operaciones/Hilo.tsx',
  'app/admin/operaciones/PanelRunner.tsx', 'app/admin/operaciones/acciones.ts', 'app/admin/operaciones/mandar.ts',
  'app/admin/operaciones/page.tsx', 'app/admin/operaciones/loading.tsx',
  'app/admin/operaciones/Avance.tsx',
  'app/admin/operaciones/Pregunta.tsx', 'app/admin/operaciones/TicketeraCentro.tsx', 'app/m/operaciones/TicketeraMovil.tsx', 'app/admin/operaciones/Uso.tsx',
  'app/m/operaciones/RunnerMovil.tsx', 'app/m/operaciones/ChatsMovil.tsx', 'app/m/operaciones/CentroAppMovil.tsx', 'app/m/operaciones/page.tsx',
];
const PROHIBIDO: Array<[RegExp, string]> = [
  [/\bcarteros?\b/i, 'el cartero se llama Runner en pantalla'],
  [/\bclaves?\b/i, 'la clave del dispositivo se llama «tu Token» en pantalla'],
  [/todavía no firma|no tiene dirección|dé su vuelta|dando vueltas|\bsin dato\b/i, 'un estado interno: di qué hacer y para qué'],
];

test('ningún texto que se dibuja dice «cartero», «clave» ni un estado interno', async () => {
  for (const f of PANTALLAS) {
    for (const t of visibles(sinComentarios(leer(f)))) {
      for (const [re, porque] of PROHIBIDO) assert.doesNotMatch(t, re, `${f}: «${t}» — ${porque}`);
    }
  }
  const { textoDeEnvio } = await import('../lib/centro-chats');
  const casos = [
    { puede: false, por: 'sin_direccion' }, { puede: false, por: 'sin_clave' }, { puede: false, por: 'clave_no_aceptada' },
    { puede: true, espera: 'cartero', cuenta: 'claude1', donde: 'app' }, { puede: true, espera: 'cartero', cuenta: 'claude2', donde: 'terminal' },
    { puede: true, espera: 'chat_cerrado', cuenta: 'claude2', donde: 'terminal' },
  ] as const;
  for (const e of casos) {
    const t = textoDeEnvio(e) ?? '';
    for (const [re, porque] of PROHIBIDO) assert.doesNotMatch(t, re, `textoDeEnvio(${JSON.stringify(e)}): «${t}» — ${porque}`);
  }
});

test('la caja dice qué hacer: cada frase arranca con la acción, y la de Martín va textual', async () => {
  const { textoDeEnvio } = await import('../lib/centro-chats');
  assert.equal(textoDeEnvio({ puede: false, por: 'sin_clave' }), 'Crea tu Token para comenzar a chatear.');
  const casos = [
    { puede: false, por: 'sin_direccion' }, { puede: false, por: 'sin_clave' }, { puede: false, por: 'clave_no_aceptada' },
    { puede: true, espera: 'cartero', cuenta: 'claude1', donde: 'app' }, { puede: true, espera: 'cartero', cuenta: 'claude2', donde: 'terminal' },
    { puede: true, espera: 'chat_cerrado', cuenta: 'claude2', donde: 'terminal' },
  ] as const;
  for (const e of casos) {
    const t = textoDeEnvio(e);
    assert.ok(t, `${JSON.stringify(e)} tiene que decir algo`);
    assert.match(t, /^(Abre|Crea|Pégale|Copia|Escribe)\b/, `«${t}»: arranca con lo que hay que hacer`);
    assert.match(t, /\bpara\b/, `«${t}»: y dice para qué`);
  }
  assert.equal(textoDeEnvio({ puede: true, espera: null, cuenta: 'claude3', donde: 'app' }), null, 'si sale ya, no hay nada que decir');
});

test('la PC reconoce al Runner por su nombre nuevo, el viejo y como sub-chat de su jefe', async () => {
  const m = await import(pathToFileURL(join(RAIZ, 'scripts/operaciones/cartero.mjs')).href) as { esElCartero: (t: string) => boolean };
  for (const si of ['Runner', 'runner', 'Cartero', 'Centro de Operaciones › Runner', 'Centro de Operaciones > Runner']) assert.equal(m.esElCartero(si), true, si);
  for (const no of ['CRM', 'Runners app', 'CRM › Lead Detail', 'Corredor', '']) assert.equal(m.esElCartero(no), false, no);
});

test('las instrucciones del chat Runner nombran comandos que cartero.mjs tiene', async () => {
  const { INSTRUCCIONES_RUNNER, COMANDO_RUNNER } = await import('../lib/runner');
  const script = leer('scripts/operaciones/cartero.mjs');
  const usados = [...INSTRUCCIONES_RUNNER.matchAll(new RegExp(`${COMANDO_RUNNER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\w+)`, 'g'))].map((x) => x[1]);
  assert.ok(usados.length >= 5, `lee los comandos de las instrucciones (leyó ${usados.length})`);
  for (const c of new Set(usados)) assert.ok(script.includes(`case '${c}'`), `cartero.mjs no tiene el comando «${c}»`);
  // El token del Runner y el Token del dispositivo: los prefijos que dicen las instrucciones son los que acepta la PC.
  assert.match(script, /\^mkop_/, 'la PC acepta tokens mkop_');
  assert.ok(INSTRUCCIONES_RUNNER.includes('mkop_') && INSTRUCCIONES_RUNNER.includes('MFkw'));
});
