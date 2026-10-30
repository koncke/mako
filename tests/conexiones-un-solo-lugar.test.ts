// =============================================================================
// Lo que MaKo sabe de cómo conectar cada cosa sale de UN lugar (25/10/2026, tanda 3)
// =============================================================================
// Martín, 25/10/2026: «Revisa si MaKo tiene la info de toda la app de como conectar cada cosa, y mas ahora que vamos
// implementando nuevas cosas como Zernio... Y también si los modales de conexión tienen su URL propia». Estaba escrito en ocho
// lugares que ya se contradecían: el prompt tenía tres links a mano (meta, anthropic, landing) y le prohibía a MaKo dar otros;
// las capacidades decían que WhatsApp se conecta en Integraciones (el QR vive en Chats); los `DEEP_LINKS` mandaban a
// «/integraciones» a secas; la intención no reconocía «conectar» y todavía nombraba el inbox oficial retirado. Ahora todo sale
// del catálogo único (lib/conexiones-catalogo.ts). Plan: docs/conexiones-y-ayuda.md.
//
// Lo que fija este test:
//   1. el prompt (`hechosMako`) da el link de cada conexión que más se pide, armado por el código, y manda a `como_conectar`;
//   2. las capacidades, los `DEEP_LINKS` y los carteles no tienen su propia lista;
//   3. la intención trae las herramientas de conectar cuando se habla de conectar, y no en un pedido de anuncios;
//   4. ningún texto de estos módulos manda a «/integraciones» a secas;
//   5. el contrato de los links está escrito en AGENTS.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hechosMako } from '../lib/hechos-mako';
import { EN_EL_PROMPT, conexion } from '../lib/conexiones-catalogo';
import { RUTA_CONEXION } from '../lib/fallo-ia-texto';
import { areasDelMensaje } from '../lib/mako-intencion';

const RAIZ = join(__dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const BASE = 'https://hola-mako.com';

test('1. el prompt da el link de cada conexión que más se pide, armado por el código', () => {
  const h = hechosMako(BASE);
  for (const k of EN_EL_PROMPT) {
    const c = conexion(k);
    assert.ok(c, `«${k}» no está en el catálogo`);
    assert.ok(h.includes(`${BASE}${c!.ruta}`), `el prompt no da el link de «${k}»`);
  }
  for (const k of ['fathom', 'zernio', 'pc', 'openai']) assert.ok((EN_EL_PROMPT as readonly string[]).includes(k), `«${k}» salió del prompt`);
  assert.match(h, /como_conectar/, 'el prompt no dice cómo guiar las otras');
  assert.match(h, /nunca ofrezcas Gemini/);
  assert.doesNotMatch(h, /abrir=gemini|abrir=groq/, 'el prompt manda a conectar Gemini o Groq');
  // Lo que viaja en cada turno no se infla: las demás se encuentran con como_conectar.
  assert.ok(EN_EL_PROMPT.length <= 12, `el prompt lleva ${EN_EL_PROMPT.length} conexiones`);
});

test('2. las capacidades, los DEEP_LINKS y los carteles no tienen su propia lista', () => {
  const cap = sinComentarios(leer('lib/mako-capacidades.ts'));
  const conectar = cap.slice(cap.indexOf("id: 'conectar'"), cap.indexOf("id: 'funnel'"));
  assert.doesNotMatch(conectar, /Conectar Meta, WhatsApp/, 'volvió «WhatsApp se conecta en Integraciones» (el QR vive en Chats)');
  assert.match(conectar, /en Chats/);
  assert.match(conectar, /Tus cuentas de IA/);
  const doer = leer('lib/mako-doer-in.ts');
  const deep = doer.slice(doer.indexOf('const DEEP_LINKS'), doer.indexOf('Ej: "Con Jesús'));
  // Meta se conecta por Zernio (27/10/2026): ningún DEEP_LINK manda a la tarjeta de Meta Ads.
  assert.match(deep, /Conectar Meta \(sus anuncios\): con su Facebook, por Zernio: \$\{APP_URL\}\/integraciones\?abrir=zernio/);
  assert.doesNotMatch(deep, /abrir=meta/);
  assert.match(deep, /como_conectar/);
  assert.doesNotMatch(deep, /\$\{APP_URL\}\/integraciones(?!\?abrir=)/, 'un DEEP_LINK manda a /integraciones a secas');
  for (const k of ['openai', 'anthropic', 'fathom', 'pc'] as const) assert.equal(RUTA_CONEXION[k], conexion(k)!.ruta);
});

test('3. la intención trae las herramientas de conectar cuando se habla de conectar, y no en un pedido de anuncios', () => {
  for (const m of ['¿cómo conecto mi Fathom?', 'quiero conectar mi Claude', 'ayúdame con la app de escritorio', 'dónde pongo mi clave de openai',
    'conectar zernio', 'ya conecté instagram?', 'tengo chatgpt plus, sirve?', 'mi claude no me contesta']) {
    assert.ok(areasDelMensaje(m).includes('integraciones'), `«${m}» no trae el área integraciones`);
  }
  for (const m of ['los anuncios de facebook de ayer', 'cuántos leads entraron por instagram', 'hola, cómo va', 'pasame las tareas de hoy']) {
    assert.ok(!areasDelMensaje(m).includes('integraciones'), `«${m}» trae el área integraciones sin hablar de conectar`);
  }
  assert.doesNotMatch(leer('lib/mako-intencion.ts'), /chatwoot/i, 'la intención volvió a nombrar el inbox retirado');
});

test('4. ningún texto de estos módulos manda a «/integraciones» a secas', () => {
  const archivos = [
    'lib/fallo-ia-texto.ts', 'lib/conexiones-catalogo.ts', 'lib/hechos-mako.ts', 'lib/ia-mensajes.ts', 'lib/mako-turno-app-reglas.ts',
    ...readdirSync(join(RAIZ, 'lib/api-mako/areas')).filter((f) => f.endsWith('.run.ts')).map((f) => `lib/api-mako/areas/${f}`),
  ];
  const malos: string[] = [];
  for (const f of archivos) {
    const lineas = sinComentarios(leer(f)).split('\n');
    lineas.forEach((l, i) => {
      // Un import (también el dinámico: `await import('./integraciones.run')`, diagnosticar_negocio, 29/10/2026) es una ruta, no un texto.
      if (/^\s*(import|export \* from)\b/.test(l) || /\bfrom ['"]/.test(l) || /\bimport\(['"]/.test(l)) return;
      // Un texto (entre comillas o backticks) con «/integraciones» que no abre un modal (`?abrir=`, `?servicio=`).
      for (const m of l.matchAll(/(['"`])((?:(?!\1).)*?)\/integraciones(?![?\w/-])/g)) {
        if (/lib$|@$/.test(m[2])) continue;
        malos.push(`${f}:${i + 1} → ${l.trim().slice(0, 120)}`);
      }
    });
  }
  assert.deepEqual(malos, [], `estos textos mandan a /integraciones a secas; usa el link de ESA conexión (lib/conexiones-catalogo.ts):\n${malos.join('\n')}`);
});

test('5. el contrato de los links está escrito en AGENTS.md', () => {
  const agents = leer('AGENTS.md');
  assert.match(agents, /EL LINK A UNA CONEXIÓN ES CONTRATO/);
  for (const ruta of ['/integraciones?abrir=<key>', '/integraciones?abrir=ia', '/perfil/ia?computadora=1', '/chats?conectar=whatsapp',
    '/perfil/instalar', '/perfil/seguridad?ver=', '/perfil/notificaciones?canal=', '/configuraciones/fiscal', '/metodo']) {
    assert.ok(agents.includes(ruta), `AGENTS.md no nombra ${ruta}`);
  }
  assert.ok(agents.includes('lib/conexiones-catalogo.ts'));
});

// ── ROTURAS (25/10/2026) ───────────────────────────────────────────────────────────────────────────
// Una por vez (reemplazar el texto, correr este archivo, devolverlo con un script node con `finally`). Base 5 / 0; después de
// las nueve, 5 / 0 otra vez y el diff igual:
//   R1. Fathom y Zernio salen del prompt (`EN_EL_PROMPT`)                                      → 1 falla (1)
//   R2. el prompt vuelve a los tres links escritos a mano                                       → 1 falla (1)
//   R3. las capacidades vuelven a no decir dónde va la computadora ni el QR                    → 1 falla (2)
//   R4. el DEEP_LINK de Meta vuelve a /integraciones a secas                                    → 1 falla (2)
//   R5. el cartel vuelve a su propia ruta para la computadora                                  → 1 falla (2)
//   R6. la intención vuelve al `\b` después de «conect…» («ya conecté instagram?» no entra)   → 1 falla (3)
//   R7. la intención suma «instagram» y «facebook» solos                                        → 1 falla (3)
//   R8. el Closing vuelve a «se arregle la key en /integraciones»                              → 1 falla (4)
//   R9. el prompt vuelve a mandar «a la pantalla de Integraciones» en vez de como_conectar     → 1 falla (1)
