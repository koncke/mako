// =============================================================================
// La API de MaKo dice QUÉ conexión falta, como dato, y cómo se conecta cada cosa (25/10/2026, tanda 2)
// =============================================================================
// Martín, 25/10/2026, por Florencia (ws21): «que si detecta que alguien le falta una conexión o algo que le ofrezca ayuda,
// que le de el link... Revisa si MaKo tiene la info de toda la app de como conectar cada cosa, y mas ahora que vamos
// implementando nuevas cosas como Zernio». Su «Estas analizando mis fathom?» (22/10) recibió un cartel que pedía «una API key»
// y no nombraba Fathom; y con su IA, el runner del Closing decía «Fathom no está conectado: se conecta en /integraciones», un
// texto suelto con el que nadie podía armar el link al modal. Plan: docs/conexiones-y-ayuda.md.
//
// Lo que fija este test:
//   1. el catálogo (lib/conexiones-catalogo.ts) tiene TODA tarjeta de /integraciones y lo que no es tarjeta (la computadora,
//      «Tus cuentas de IA», el QR), con rutas que son contrato, y no ofrece Gemini ni Groq;
//   2. `buscarConexion` entiende cómo lo dice la gente;
//   3. los pasos de la computadora usan los rótulos reales de la pantalla, en tú y cortos;
//   4. los runners del Closing, de cobros, de Panda y del WhatsApp de empresa devuelven `falta: { servicio }` y ya no mandan
//      a «/integraciones» a secas; el Closing pide su Claude por CLAVE (el análisis corre sólo con Claude);
//   5. la puerta de ejecución saca `falta` por `ctx.aFalta`, en el Resultado y por HTTP; al modelo, sin link si el canal lo
//      pone por código;
//   6. el doer agrega la línea con el link de lo que falta, escrita por el código;
//   7. `ver_ia_del_negocio` y `como_conectar` existen, salen por los tres canales, y `ver_integracion` trae los pasos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONEXIONES, conexion, buscarConexion, lineaParaConectar, rutaDeTarjeta, normalizar } from '../lib/conexiones-catalogo';
import { DEFS } from '../lib/integraciones-catalogo';
import { porId } from '../lib/api-mako/registro';
import { marcasDeVoseo } from '../lib/puestas-data';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

test('1. el catálogo tiene toda tarjeta y lo que no es tarjeta, con rutas de contrato, y no ofrece Gemini ni Groq', () => {
  for (const d of DEFS) {
    const c = conexion(d.key);
    assert.ok(c, `la tarjeta «${d.key}» no está en el catálogo de conexiones`);
    // WhatsApp (su tarjeta, 29/10/2026) es «Tu número de WhatsApp»: el link de contrato al QR, no el modal (ver abajo).
    if (d.key === 'whatsapp') continue;
    // Meta se conecta en la tarjeta de Zernio (27/10/2026, tests/meta-sin-token.test.ts): es la única que abre OTRO modal.
    assert.equal(c!.ruta, `/integraciones?abrir=${d.key === 'meta' ? 'zernio' : d.key}`, `la ruta de «${d.key}» no abre su modal`);
    assert.equal(c!.nombre, d.nombre);
  }
  assert.equal(conexion('pc')?.ruta, '/perfil/ia?computadora=1', 'la computadora no abre «Conecta MaKo»');
  assert.equal(conexion('ia')?.ruta, '/integraciones?abrir=ia', '«Tus cuentas de IA» perdió su link');
  assert.equal(conexion('whatsapp')?.ruta, '/chats?conectar=whatsapp', 'el QR perdió su link');
  // Las rutas de Settings (25/10/2026): instalar la app y el perfil, donde va el número que la computadora reconoce en el grupo.
  assert.equal(conexion('instalar')?.ruta, '/perfil/instalar');
  assert.equal(conexion('perfil')?.ruta, '/perfil');
  assert.equal(new Set(CONEXIONES.map((c) => c.key)).size, CONEXIONES.length, 'una key repetida en el catálogo');
  assert.equal(conexion('gemini')?.noSeOfrece, true, 'el catálogo vuelve a ofrecer Gemini (Martín, 25/10)');
  assert.equal(conexion('groq')?.noSeOfrece, true);
  for (const k of ['openai', 'anthropic', 'fathom', 'zernio', 'pc']) assert.ok(!conexion(k)?.noSeOfrece, `«${k}» quedó sin ofrecerse`);
  assert.equal(conexion('github')?.soloPlataforma, true);
  for (const c of CONEXIONES) {
    assert.equal(c.donde, 'computadora');
    assert.ok(c.ruta.startsWith('/') && !c.ruta.includes('ws='), `«${c.key}»: la ruta lleva base o ws (${c.ruta})`);
    assert.ok(c.destraba.trim().length > 10, `«${c.key}» no dice qué destraba`);
  }
  assert.equal(rutaDeTarjeta('fathom'), '/integraciones?abrir=fathom');
});

test('2. `buscarConexion` entiende cómo lo dice la gente', () => {
  const casos: Array<[string, string]> = [
    ['Estas analizando mis fathom?', 'fathom'],
    ['quiero conectar mi Claude', 'pc'],
    ['cómo instalo la app de escritorio', 'pc'],
    ['necesito conectar mis redes', 'zernio'],
    ['conectar instagram', 'zernio'],
    ['mi GPT', 'openai'],
    ['ChatGPT', 'openai'],
    ['google calendar', 'google'],
    ['el calendario de google', 'google'],
    ['mercado pago', 'mercadopago'],
    ['whatsapp', 'whatsapp'],
    ['tus cuentas de ia', 'ia'],
    ['fathom', 'fathom'],
    ['calcom', 'calcom'],
  ];
  for (const [texto, key] of casos) assert.equal(buscarConexion(texto)?.key, key, `«${texto}» no encontró «${key}»`);
  assert.equal(buscarConexion('hola, cómo va todo'), undefined, 'encontró una conexión donde no se nombra ninguna');
  // El píxel de Meta se carga en la tarjeta de Meta (lib/hechos-mako.ts): nunca es el Pixel de MaKo.
  assert.equal(buscarConexion('el pixel de meta')?.key, 'meta', 'el pixel de Meta se confundió con el de MaKo');
  assert.equal(buscarConexion('el pixel de mako')?.key, 'landing');
  assert.equal(buscarConexion('github'), undefined, 'GitHub es de la plataforma');
  assert.equal(buscarConexion('github', { esPlataforma: true })?.key, 'github');
  assert.equal(normalizar('  Teléfono  MÍO '), 'telefono mio');
});

test('3. los pasos de la computadora usan los rótulos reales de «Conecta MaKo», en tú y cortos', () => {
  const pc = conexion('pc')!;
  assert.ok(pc.pasos && pc.pasos.length >= 3 && pc.pasos.length <= 5, 'los pasos de la computadora son de 3 a 5');
  for (const p of pc.pasos!) {
    assert.ok(p.length <= 120, `un paso de más de 120 caracteres: ${p}`);
    assert.deepEqual(marcasDeVoseo(p), [], `voseo: ${p}`);
  }
  // Cada botón que nombra un paso existe en la pantalla (app/integraciones/TusCuentasIA.tsx).
  const pantalla = leer('../app/integraciones/TusCuentasIA.tsx');
  for (const boton of ['Descargar MaKo', 'Iniciar sesión']) {
    assert.ok(pc.pasos!.some((p) => p.includes(`«${boton}»`)), `los pasos no nombran «${boton}»`);
    assert.ok(pantalla.includes(boton), `la pantalla ya no tiene «${boton}»: los pasos de la computadora quedaron viejos`);
  }
  const linea = lineaParaConectar(conexion('fathom')!, 'https://hola-mako.com/integraciones?abrir=fathom');
  assert.equal(linea, 'Para esto falta conectar Fathom (desde tu computadora) 👇\nhttps://hola-mako.com/integraciones?abrir=fathom');
});

test('4. los runners dicen qué falta como DATO, sin mandar a «/integraciones» a secas; el Closing pide su Claude por clave', () => {
  const closing = sinComentarios(leer('../lib/api-mako/areas/closing.run.ts'));
  assert.match(closing, /falta: \{ servicio: 'fathom' \}/, 'exigirFathom no devuelve la conexión que falta');
  assert.match(closing, /falta: \{ servicio: 'anthropic' \}/, 'exigirIa no devuelve la conexión que falta');
  assert.doesNotMatch(closing, /se conecta en \/integraciones|Se carga en \/integraciones/, 'el Closing volvió a mandar a /integraciones a secas');
  // «¿Estás analizando mis fathom?» llega a panorama_closing: sin Fathom, lo dice como dato.
  assert.match(closing, /return sinFathom \? \{ content: salida, falta: sinFathom\.falta \} : salida;/, 'panorama_closing no dice que falta Fathom');
  // Las cuatro salidas de exigir* devuelven el objeto entero (error + falta), no sólo el texto.
  assert.equal(closing.match(/if \(falta\) return falta;/g)?.length, 2);
  assert.match(closing, /if \(faltaIa\) return faltaIa;/);
  assert.match(closing, /if \(falta\) return \{ \.\.\.error\(falta\.error\), falta: falta\.falta \};/);
  const cobros = sinComentarios(leer('../lib/api-mako/areas/cobros.run.ts'));
  assert.equal(cobros.match(/falta: \{ servicio: pasarela \}/g)?.length, 2, 'cobros: la pasarela que falta no viaja como dato');
  const panda = sinComentarios(leer('../lib/api-mako/areas/landing.run.ts'));
  assert.equal(panda.match(/falta: \{ servicio: 'panda' \}/g)?.length, 2);
  const wa = sinComentarios(leer('../lib/api-mako/areas/whatsapp.run.ts'));
  assert.equal(wa.match(/falta: FALTA_EMPRESA/g)?.length, 6, 'el WhatsApp de empresa: no todas sus salidas dicen qué falta');
  assert.doesNotMatch(wa, /Se vincula en la tab WhatsApp/, 'manda a una tab que ya no existe (el QR vive en Chats)');
  // Toda `falta` nombra una conexión que existe en el catálogo.
  for (const src of [closing, cobros, panda]) {
    for (const m of src.matchAll(/falta: \{ servicio: '([a-z]+)' \}/g)) assert.ok(conexion(m[1]), `«${m[1]}» no está en el catálogo`);
  }
  assert.ok(conexion('stripe') && conexion('mercadopago') && conexion('whatsapp'));
});

test('5. la puerta de ejecución saca `falta` por `ctx.aFalta`, en el Resultado y por HTTP', () => {
  const ej = sinComentarios(leer('../lib/api-mako/ejecutar.ts'));
  assert.match(ej, /if \(typeof cruda !== 'string' && cruda\.falta\) ctx\.aFalta\?\.\(cruda\.falta\);/, 'una lectura con `falta` no llega al canal');
  assert.match(ej, /if \('error' in prep && prep\.falta\) ctx\.aFalta\?\.\(prep\.falta\);/, 'una acción con `falta` no llega al canal');
  assert.match(ej, /if \(r\.falta\) cuerpo\.falta = faltaParaElModelo\(r\.falta, ctx\);/, 'el modelo no se entera de qué falta');
  // Con `aFalta` (el doer pone el link) el modelo no recibe link; sin él, el link exacto del catálogo.
  const fpm = ej.slice(ej.indexOf('export function faltaParaElModelo'), ej.indexOf('export function runnerDelRegistro'));
  assert.match(fpm, /if \(ctx\.aFalta\) return \{ servicio: f\.servicio, [^\n]*no escribas ningún link/);
  assert.match(fpm, /link: linkPantalla\(c\.ruta, ctx\.ws\)/);
  assert.match(sinComentarios(leer('../lib/api-mako/http.ts')), /if \(r\.falta\) extra\.falta = r\.falta;/, 'HTTP no devuelve qué falta');
});

test('6. el doer agrega la línea con el link de lo que falta, escrita por el código', () => {
  const doer = sinComentarios(leer('../lib/mako-doer-in.ts'));
  assert.match(doer, /aFalta: \(f\) => \{\s*const c = conexion\(f\.servicio\);\s*const x = c \? lineaParaConectar\(c, linkApp\(c\.ruta, wsData\)\) : null;\s*if \(x && !paraLaPersona\.includes\(x\)\) paraLaPersona\.push\(x\);/,
    'el doer no agrega el link de lo que falta, o lo repite');
  // Lo de `paraLaPersona` sale con el `?ws=` del grupo.
  assert.match(doer, /const enviar = \[\.\.\.partes, \.\.\.paraLaPersona\]\.map\(\(t\) => linksConWs\(t, wsData, APP_URL\)\);/);
});

test('7. `ver_ia_del_negocio` y `como_conectar` existen y salen por los tres canales; `ver_integracion` trae los pasos', () => {
  for (const id of ['ver_ia_del_negocio', 'como_conectar']) {
    const d = porId(id);
    assert.ok(d, `falta la operación ${id}`);
    assert.equal(d!.tipo, 'lectura');
    assert.equal(d!.area, 'integraciones');
    assert.deepEqual([...d!.canales].sort(), ['app', 'http', 'whatsapp']);
  }
  assert.ok(leer('./api-mako-http.snapshot.txt').split('\n').includes('como_conectar'), 'el snapshot de HTTP no se regeneró');
  const run = sinComentarios(leer('../lib/api-mako/areas/integraciones.run.ts'));
  // Los de la conexión ganan (27/10/2026: Meta se conecta en la tarjeta de Zernio, tests/meta-sin-token.test.ts).
  assert.match(run, /pasos: cx\?\.pasos \?\? s\.tutorial\.pasos,/, 'ver_integracion no trae los pasos del tutorial');
  assert.match(run, /pasos: c\.pasos \?\? tarjeta\?\.tutorial\.pasos \?\? \[\],/, 'como_conectar no trae los pasos');
  // ver_ia_del_negocio: nunca una clave, y no le ofrece Gemini.
  const via = run.slice(run.indexOf('ver_ia_del_negocio: {'), run.indexOf('como_conectar: {'));
  assert.doesNotMatch(via, /valor|descifrar|valor_enc/, 'ver_ia_del_negocio lee el valor de una clave');
  assert.match(via, /No le ofrezcas Gemini/);
  assert.match(via, /'nada: necesita su GPT por clave'/);
});

// ── ROTURAS (25/10/2026) ───────────────────────────────────────────────────────────────────────────
// Una por vez (reemplazar el texto, correr este archivo, devolverlo con un script node con `finally`). Base 7 / 0; después de
// las doce, 7 / 0 otra vez y el diff igual:
//   R1.  el catálogo se saltea una tarjeta (`DEFS.slice(1)`)                                 → 2 fallan (1, 2)
//   R2.  Gemini vuelve a ofrecerse (`NO_SE_OFRECEN` sin 'gemini')                           → 1 falla  (1)
//   R3.  `buscarConexion` se queda con la primera frase y no con la más larga               → 1 falla  (2)
//   R4.  un paso de la computadora nombra un botón que no existe («Bajar la app»)           → 1 falla  (3)
//   R5.  `exigirFathom` sin `falta`                                                          → 1 falla  (4)
//   R6.  `panorama_closing` no dice que falta Fathom                                         → 1 falla  (4)
//   R7.  la puerta no saca la `falta` de una acción por `aFalta`                             → 1 falla  (5)
//   R8.  al modelo le llega el link aunque el canal lo ponga por código                      → 1 falla  (5)
//   R9.  el doer repite la línea de lo que falta                                             → 1 falla  (6)
//   R10. `ver_integracion` sin los pasos                                                     → 1 falla  (7)
//   R11. HTTP sin `falta`                                                                    → 1 falla  (5)
//   R12. el WhatsApp de empresa vuelve a «Se vincula en la tab WhatsApp»                     → 1 falla  (4)
