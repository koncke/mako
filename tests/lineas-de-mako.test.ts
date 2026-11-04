// =============================================================================
// Las dos líneas de Martín: si se cae una, avisa la otra (03/11/2026)
// =============================================================================
// Martín: «veo que MaKo la linea principal se desconecto... Y si llega a pasar tengo mi linea secundaria para avisarme a mi
// mismo». Medido ese día: la principal cerrada con un 403 a las 19:39:36 UTC, y la secundaria sin que nadie la vigilara.
//
// La foto del primer caso es la que llegó de Evolution ese día, no una inventada.
//
// PROBADO ROMPIÉNDOLO (03/11/2026): 35 roturas, de a una, sobre lib/lineas-de-mako.ts, el vigilante, `fotoDeLinea` y la ruta. La
// primera pasada dejó verdes tres (el envío fallido que no probaba la otra línea, el «desde» que no se limpiaba al volver, y la
// fila de otra línea adoptada si Evolution ignora el filtro): por eso están sus tests. Fallan las 35 (tras el último cambio, el de la voz en la línea de Martín, se repitieron las 7 que lo tocan); restaurado, 31 pasan y 0 fallan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  correrVigilancia, decidirReapertura, hayQueSondear, keyAvisado, keyDesde, rutasDelAviso, tipoDeCaida,
  type DepsVigia, type FotoLinea,
} from '../lib/lineas-de-mako';
import type { Sondeo } from '../lib/evolution-sonda';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
const sinComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const P = 'mako_superadmin_muylqv8r';
const S = 'mako_ws9';
const NUM_P = '5491100002605';
const NUM_S = '5493764673479';
// El minuto 42 es uno en que la sonda no le toca a una línea `open` sin marcas.
const T0 = Date.parse('2026-11-03T19:42:00.000Z');
const MIN = 60_000;

const viva = (numero: string): FotoLinea => ({ existe: true, estado: 'open', codigo: null, cuando: null, numero });
const cerrada403 = (numero: string): FotoLinea => ({ existe: true, estado: 'close', codigo: 403, cuando: '2026-11-03T19:39:36.189Z', numero });
const cortada = (numero: string): FotoLinea => ({ existe: true, estado: 'connecting', codigo: null, cuando: null, numero });

type Mundo = {
  fotos: Record<string, FotoLinea | null>;
  sondas: Record<string, Sondeo>;
  settings: Map<string, string>;
  enviados: Array<{ linea: string; numero: string; texto: string }>;
  mails: Array<{ asunto: string; cuerpo: string }>;
  reabiertas: string[];
  falla: { enviar?: string[]; mail?: boolean; leer?: boolean };
  ahora: number;
  sondeos: string[];
};

function mundo(fotos: Record<string, FotoLinea | null>, sondas: Record<string, Sondeo>): Mundo {
  return { fotos, sondas, settings: new Map(), enviados: [], mails: [], reabiertas: [], falla: {}, ahora: T0, sondeos: [] };
}

function deps(m: Mundo, sobre: Partial<DepsVigia> = {}): DepsVigia {
  return {
    voz: async () => P,
    secundaria: async () => S,
    foto: async (i) => m.fotos[i] ?? null,
    sondear: async (i) => { m.sondeos.push(i); return { sondeo: m.sondas[i] }; },
    leer: async (k) => { if (m.falla.leer) throw new Error('la base no contesta'); return m.settings.get(k) ?? null; },
    escribir: async (k, v) => { m.settings.set(k, v); },
    cambiarSi: async (k, esperado, nuevo) => {
      if ((m.settings.get(k) ?? null) !== esperado) return false;
      m.settings.set(k, nuevo);
      return true;
    },
    enviar: async (linea, numero, texto) => {
      if (m.falla.enviar?.includes(linea)) return { ok: false, error: `${linea}: Connection Closed` };
      m.enviados.push({ linea, numero, texto });
      return { ok: true };
    },
    mail: async (asunto, cuerpo) => {
      if (m.falla.mail) return { enviadoA: 0, error: 'Resend no contestó' };
      m.mails.push({ asunto, cuerpo });
      return { enviadoA: 1 };
    },
    reabrir: async (i) => { m.reabiertas.push(i); },
    linkPrincipal: () => 'https://hola-mako.com/agencia?canal=1',
    linkSecundaria: (i) => `https://hola-mako.com/whatsapp?canal=no-oficial&linea=${i}&ws=9`,
    ahoraMs: () => m.ahora,
    ...sobre,
  };
}

test('el caso del 3/11: la principal cerrada con 403 avisa en la misma corrida, por la secundaria, y una sola vez', async () => {
  const m = mundo({ [P]: cerrada403(NUM_P), [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  const r = await correrVigilancia(deps(m));
  assert.equal(r.lineas[0].que, 'avisar');
  assert.equal(r.lineas[0].llego, true);
  assert.equal(r.lineas[0].por, 'whatsapp');
  // Un solo mensaje, al chat consigo mismo: la secundaria no le escribe a nadie más, y menos a la cuenta baneada.
  assert.deepEqual(m.enviados.map((e) => [e.linea, e.numero]), [[S, NUM_S]]);
  const texto = m.enviados[0].texto;
  assert.match(texto, /Se cayó la línea de MaKo\* \(…2605\)/);
  assert.match(texto, /WhatsApp cerró la sesión hace 2 min/, 'el tiempo sale de cuándo cayó, no de cuándo se midió');
  assert.match(texto, /hola-mako\.com\/agencia\?canal=1/, 'el aviso tiene que traer el link para escanear');
  assert.match(texto, /no escanees/, 'con un 403 también puede ser una cuenta suspendida: hay que decirlo');

  for (const min of [3, 6, 60, 60 * 24]) {
    m.ahora = T0 + min * MIN;
    await correrVigilancia(deps(m));
  }
  assert.equal(m.enviados.length, 1, 'una vez por caída: no se repite mientras siga caída');
  assert.equal(m.mails.length, 0);
});

test('al volver sale UN aviso, y por la línea que volvió hacia la otra: ese sí hace sonar el teléfono', async () => {
  const m = mundo({ [P]: cerrada403(NUM_P), [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  await correrVigilancia(deps(m));
  m.enviados.length = 0;

  m.ahora = T0 + 42 * MIN;
  m.fotos[P] = viva(NUM_P);
  m.sondas[P] = 'vivo';
  const r = await correrVigilancia(deps(m));
  assert.equal(r.lineas[0].que, 'volvio');
  assert.deepEqual(m.enviados.map((e) => [e.linea, e.numero]), [[P, NUM_S]]);
  assert.match(m.enviados[0].texto, /Volvió la línea de MaKo/);
  assert.match(m.enviados[0].texto, /Estuvo caída 42 min/);
  assert.ok(!m.settings.get(keyDesde('principal')), 'el «desde» se limpia en la misma corrida: con uno viejo, la próxima caída se avisaría sin confirmarla');

  m.ahora += 3 * MIN;
  await correrVigilancia(deps(m));
  assert.equal(m.enviados.length, 1, 'el «volvió» no se repite');
  assert.ok(!m.settings.get(keyAvisado('principal')) && !m.settings.get(keyDesde('principal')), 'las marcas quedan limpias para la próxima caída');

  // Una caída nueva vuelve a avisar: es otra caída.
  m.ahora += 60 * MIN;
  m.fotos[P] = cerrada403(NUM_P);
  m.sondas[P] = 'muerto';
  await correrVigilancia(deps(m));
  assert.equal(m.enviados.length, 2);
});

test('si cae la secundaria avisa la principal, con el link de la secundaria', async () => {
  const m = mundo({ [P]: viva(NUM_P), [S]: cerrada403(NUM_S) }, { [P]: 'vivo', [S]: 'muerto' });
  const r = await correrVigilancia(deps(m));
  assert.equal(r.lineas[1].que, 'avisar');
  assert.deepEqual(m.enviados.map((e) => [e.linea, e.numero]), [[P, NUM_S]]);
  assert.match(m.enviados[0].texto, /Se cayó tu línea secundaria\* \(…3479\)/);
  assert.match(m.enviados[0].texto, /whatsapp\?canal=no-oficial&linea=mako_ws9/);
});

test('el aviso NUNCA sale por la línea caída', () => {
  const principal = { instancia: P, numero: NUM_P };
  const secundaria = { instancia: S, numero: NUM_S };
  const lineas = (p: Sondeo, s: Sondeo) => rutasDelAviso({ principal: { ...principal, sondeo: p }, secundaria: { ...secundaria, sondeo: s } }).map((r) => r.linea);
  assert.deepEqual(lineas('muerto', 'vivo'), [S]);
  assert.deepEqual(lineas('sin_respuesta', 'vivo'), [S]);
  assert.deepEqual(lineas('vivo', 'muerto'), [P]);
  assert.deepEqual(lineas('vivo', 'sin_respuesta'), [P]);
  assert.deepEqual(lineas('vivo', 'vivo'), [P, S], 'con las dos vivas gana la que hace sonar el teléfono');
  assert.deepEqual(lineas('muerto', 'muerto'), []);
  assert.deepEqual(rutasDelAviso({ principal: { ...principal, sondeo: 'vivo' }, secundaria: null }), []);
});

test('si caen las dos va UN mail con los dos links, y no se repite', async () => {
  const m = mundo({ [P]: cerrada403(NUM_P), [S]: cerrada403(NUM_S) }, { [P]: 'muerto', [S]: 'muerto' });
  const r = await correrVigilancia(deps(m));
  assert.equal(m.enviados.length, 0, 'no hay por dónde mandar un WhatsApp');
  assert.equal(m.mails.length, 1, 'un solo mail, no uno por línea');
  assert.equal(m.mails[0].asunto, '🚨 Las dos líneas de WhatsApp de MaKo están caídas');
  assert.match(m.mails[0].cuerpo, /agencia\?canal=1/);
  assert.match(m.mails[0].cuerpo, /linea=mako_ws9/);
  assert.ok(!m.mails[0].cuerpo.includes('*'), 'el mail va sin las marcas de WhatsApp');
  assert.deepEqual(r.lineas.map((l) => l.por), ['email', 'email']);
  m.ahora += 3 * MIN;
  await correrVigilancia(deps(m));
  assert.equal(m.mails.length, 1);
});

test('si cae la segunda con la primera ya avisada, el mail igual trae los dos links', async () => {
  const m = mundo({ [P]: cerrada403(NUM_P), [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  await correrVigilancia(deps(m));
  m.ahora += 30 * MIN;
  m.fotos[S] = cerrada403(NUM_S);
  m.sondas[S] = 'muerto';
  await correrVigilancia(deps(m));
  assert.equal(m.mails.length, 1);
  assert.equal(m.mails[0].asunto, '🚨 Las dos líneas de WhatsApp de MaKo están caídas');
  assert.match(m.mails[0].cuerpo, /agencia\?canal=1/);
});

test('un envío que falla prueba la otra línea, después el mail; y si nada llegó, reintenta en la próxima corrida', async () => {
  // La principal dice `open` y es una zombi que nadie sondeó todavía: el envío es lo que lo descubre.
  const m = mundo({ [P]: viva(NUM_P), [S]: cerrada403(NUM_S) }, { [P]: 'vivo', [S]: 'muerto' });
  m.falla.enviar = [P];
  m.falla.mail = true;
  const r = await correrVigilancia(deps(m));
  assert.equal(r.lineas[1].llego, false);
  assert.match(String(r.lineas[1].error), /Resend/);
  assert.ok(!m.settings.get(keyAvisado('secundaria')), 'sin llegar a ningún lado, la marca se suelta');

  m.falla.mail = false;
  m.ahora += 3 * MIN;
  const r2 = await correrVigilancia(deps(m));
  assert.equal(r2.lineas[1].por, 'email');
  assert.equal(r2.lineas[1].llego, true);
  assert.equal(m.mails.length, 1);
  m.ahora += 3 * MIN;
  await correrVigilancia(deps(m));
  assert.equal(m.mails.length, 1, 'y ahora sí se calla');
});

test('dos corridas a la vez mandan un solo aviso', async () => {
  const m = mundo({ [P]: cerrada403(NUM_P), [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  await Promise.all([correrVigilancia(deps(m)), correrVigilancia(deps(m))]);
  assert.equal(m.enviados.length, 1, 'un aviso, no dos');
});

test('«no pude preguntar» no es una caída, y no apaga una que ya estaba avisada', async () => {
  const m = mundo({ [P]: null, [S]: null }, { [P]: 'sin_respuesta', [S]: 'sin_respuesta' });
  await correrVigilancia(deps(m));
  assert.equal(m.enviados.length + m.mails.length, 0);
  assert.equal(m.settings.size, 0, 'no se toca ninguna marca');

  const a = mundo({ [P]: cerrada403(NUM_P), [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  await correrVigilancia(deps(a));
  const marca = a.settings.get(keyAvisado('principal'));
  a.fotos[P] = null;
  a.ahora += 3 * MIN;
  await correrVigilancia(deps(a));
  assert.equal(a.settings.get(keyAvisado('principal')), marca);
  assert.equal(a.enviados.length, 1, 'ni un «volvió» sobre una línea que no se pudo medir');

  // La sonda también puede no contestar con la foto en la mano.
  const b = mundo({ [P]: cortada(NUM_P), [S]: viva(NUM_S) }, { [P]: 'sin_respuesta', [S]: 'vivo' });
  await correrVigilancia(deps(b));
  assert.equal(b.settings.size, 0);
});

test('si no se pudieron leer las marcas o las líneas, no avisa: no sabe si ya avisó', async () => {
  const m = mundo({ [P]: cerrada403(NUM_P), [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  m.falla.leer = true;
  const r = await correrVigilancia(deps(m));
  assert.equal(m.enviados.length, 0);
  assert.match(String(r.lineas[0].error), /no pude leer las marcas/);

  const m2 = mundo({ [P]: cerrada403(NUM_P), [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  const r2 = await correrVigilancia(deps(m2, { voz: async () => { throw new Error('la base no contesta'); } }));
  assert.equal(m2.enviados.length, 0);
  assert.match(String(r2.error), /no pude leer cuáles son las líneas/);
});

test('un corte espera la confirmación, no manda a escanear, y si vuelve antes no dice nada', async () => {
  const m = mundo({ [P]: cortada(NUM_P), [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  await correrVigilancia(deps(m));
  assert.equal(m.enviados.length, 0, 'la primera medición fija el «desde»: un reinicio de Evolution deja todo sin socket unos segundos');
  m.ahora += 3 * MIN;
  await correrVigilancia(deps(m));
  assert.equal(m.enviados.length, 0, 'a los 3 minutos todavía no se confirmó');

  m.ahora += 3 * MIN;
  await correrVigilancia(deps(m));
  assert.equal(m.enviados.length, 1);
  assert.match(m.enviados[0].texto, /Se cortó la línea de MaKo/);
  assert.match(m.enviados[0].texto, /No responde desde hace 6 min/);
  assert.match(m.enviados[0].texto, /Todavía no escanees/, 'escanear tumba una sesión que está por volver');

  const n = mundo({ [P]: cortada(NUM_P), [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  await correrVigilancia(deps(n));
  n.ahora += 3 * MIN;
  n.fotos[P] = viva(NUM_P);
  n.sondas[P] = 'vivo';
  const r = await correrVigilancia(deps(n));
  assert.equal(r.lineas[0].que, 'limpiar');
  assert.equal(n.enviados.length, 0, 'si nunca se avisó la caída, no hay «volvió» que mandar');
  assert.ok(!n.settings.get(keyDesde('principal')));
});

test('si avisó «puede volver sola» y después WhatsApp cerró la sesión, avisa de nuevo, una vez: cambió lo que hay que hacer', async () => {
  const m = mundo({ [P]: cortada(NUM_P), [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  await correrVigilancia(deps(m));
  m.ahora += 6 * MIN;
  await correrVigilancia(deps(m));
  assert.equal(m.enviados.length, 1);

  m.ahora += 3 * MIN;
  m.fotos[P] = cerrada403(NUM_P);
  await correrVigilancia(deps(m));
  assert.equal(m.enviados.length, 2);
  assert.match(m.enviados[1].texto, /WhatsApp cerró la sesión/);

  m.ahora += 3 * MIN;
  await correrVigilancia(deps(m));
  assert.equal(m.enviados.length, 2);
});

test('la zombi: dice `open` y no responde', async () => {
  const m = mundo({ [P]: viva(NUM_P), [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  m.ahora = Date.parse('2026-11-03T19:48:00.000Z'); // minuto 48: le toca la sonda
  await correrVigilancia(deps(m));
  assert.ok(m.settings.get(keyDesde('principal')), 'la sonda la encontró');
  m.ahora += 6 * MIN;
  await correrVigilancia(deps(m));
  assert.match(m.enviados[0].texto, /Figura conectada pero no responde desde hace 6 min/);
  assert.match(m.enviados[0].texto, /escaneando otra vez/);
});

test('la sonda contra WhatsApp se raciona: una línea `open` sin marcas no se pregunta en cada corrida', async () => {
  const hoy = '2026-11-03T19:';
  const toca = (min: string) => hayQueSondear({ estado: 'open', marcas: { desde: null, avisado: null }, ahoraMs: Date.parse(`${hoy}${min}:10.000Z`) });
  const corridas = ['00', '03', '06', '09', '12', '15', '18', '21', '24', '27', '30', '33', '36', '39', '42', '45', '48', '51', '54', '57'];
  assert.deepEqual(corridas.filter(toca), ['00', '12', '24', '36', '48'], 'una de cada cuatro corridas');
  // Medido en el mundo: en un minuto en que no le toca, no sale ninguna sonda y se la da por viva.
  const m = mundo({ [P]: viva(NUM_P), [S]: viva(NUM_S) }, { [P]: 'vivo', [S]: 'vivo' });
  await correrVigilancia(deps(m));
  assert.deepEqual(m.sondeos, []);
  // Con una marca puesta, siempre: sin la sonda no se sabría que volvió.
  assert.equal(hayQueSondear({ estado: 'open', marcas: { desde: '2026-11-03T19:00:00Z', avisado: null }, ahoraMs: T0 }), true);
  assert.equal(hayQueSondear({ estado: 'connecting', marcas: { desde: null, avisado: null }, ahoraMs: T0 }), true);
});

test('una secundaria que se soltó a propósito o que nunca se vinculó no se «cae»', async () => {
  const sinInstancia: FotoLinea = { existe: false, estado: null, codigo: null, cuando: null, numero: null };
  const m = mundo({ [P]: viva(NUM_P), [S]: sinInstancia }, { [P]: 'vivo', [S]: 'muerto' });
  m.settings.set(keyDesde('secundaria'), '2026-11-03T19:00:00.000Z');
  const r = await correrVigilancia(deps(m));
  assert.equal(r.lineas[1].que, 'limpiar');
  assert.equal(m.enviados.length, 0);

  const n = mundo({ [P]: viva(NUM_P), [S]: { existe: true, estado: 'connecting', codigo: null, cuando: null, numero: null } }, { [P]: 'vivo', [S]: 'muerto' });
  for (const min of [0, 6, 12]) { n.ahora = T0 + min * MIN; await correrVigilancia(deps(n)); }
  assert.equal(n.enviados.length, 0);
});

test('con la voz en la misma línea que la secundaria no se avisa a sí misma: se mide una vez, y al volver también va por mail', async () => {
  const m = mundo({ [S]: cerrada403(NUM_S) }, { [S]: 'muerto' });
  const voz = deps(m, { voz: async () => S, secundaria: async () => S });
  const r = await correrVigilancia(voz);
  assert.deepEqual(r.lineas.map((l) => [l.rol, l.instancia]), [['principal', S]]);
  assert.deepEqual(m.enviados, []);
  assert.equal(m.mails.length, 1);
  m.ahora += 30 * MIN;
  m.fotos[S] = viva(NUM_S);
  m.sondas[S] = 'vivo';
  await correrVigilancia(voz);
  assert.deepEqual(m.enviados, [], 'tampoco el «volvió»');
  assert.equal(m.mails.length, 2);
  assert.match(m.mails[1].asunto, /Volvió la línea de MaKo/);
});

test('sin secundaria, o con la secundaria igual a la voz, la caída de la principal va por mail', async () => {
  const m = mundo({ [P]: cerrada403(NUM_P) }, { [P]: 'muerto' });
  await correrVigilancia(deps(m, { secundaria: async () => null }));
  assert.equal(m.enviados.length, 0);
  assert.equal(m.mails.length, 1);
  assert.match(m.mails[0].asunto, /Se cayó la línea de MaKo/);

  const n = mundo({ [P]: cerrada403(NUM_P) }, { [P]: 'muerto' });
  const r = await correrVigilancia(deps(n, { secundaria: async () => P }));
  assert.equal(r.lineas.length, 1);
  assert.equal(n.enviados.length, 0, 'una línea no puede avisar que se cayó ella misma');
});

test('el tipo de caída: el código solo no alcanza', () => {
  assert.equal(tipoDeCaida(cerrada403(NUM_P)), 'desvinculada');
  assert.equal(tipoDeCaida({ ...cerrada403(NUM_P), codigo: 401 }), 'desvinculada');
  // `mako_ws11`, medido el 03/11: `open` con un 401 del 09/10.
  assert.equal(tipoDeCaida({ ...viva(NUM_P), codigo: 401 }), 'zombi');
  assert.equal(tipoDeCaida({ ...cortada(NUM_P), codigo: 401 }), 'cortada', 'un corte con un código viejo no manda a escanear');
  assert.equal(tipoDeCaida({ ...cerrada403(NUM_P), codigo: 428 }), 'cortada');
  assert.equal(tipoDeCaida({ existe: false, estado: null, codigo: null, cuando: null, numero: null }), 'desvinculada');
});

test('reabrir: sólo un `close` que WhatsApp no cerró, y sin insistir', async () => {
  const base = { sondeo: 'muerto' as Sondeo, vigilada: true, ultimo: null, ahoraMs: T0 };
  const conCodigo = (codigo: number | null, estado = 'close'): FotoLinea => ({ existe: true, estado, codigo, cuando: null, numero: NUM_P });
  assert.equal(decidirReapertura({ ...base, foto: conCodigo(428) }), true);
  assert.equal(decidirReapertura({ ...base, foto: conCodigo(null) }), true);
  for (const codigo of [401, 402, 403, 406]) {
    assert.equal(decidirReapertura({ ...base, foto: conCodigo(codigo) }), false, `el ${codigo} lo cerró WhatsApp: insistir no sirve`);
  }
  assert.equal(decidirReapertura({ ...base, foto: conCodigo(428, 'connecting') }), false, 'Evolution ya está reintentando');
  assert.equal(decidirReapertura({ ...base, foto: conCodigo(null, 'open') }), false);
  assert.equal(decidirReapertura({ ...base, sondeo: 'vivo', foto: conCodigo(428) }), false);
  assert.equal(decidirReapertura({ ...base, sondeo: 'sin_respuesta', foto: conCodigo(428) }), false);
  assert.equal(decidirReapertura({ ...base, ultimo: new Date(T0 - 3 * MIN).toISOString(), foto: conCodigo(428) }), false);
  assert.equal(decidirReapertura({ ...base, ultimo: new Date(T0 - 10 * MIN).toISOString(), foto: conCodigo(428) }), true);

  const m = mundo({ [P]: { ...cerrada403(NUM_P), codigo: 428 }, [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  await correrVigilancia(deps(m));
  m.ahora += 3 * MIN;
  await correrVigilancia(deps(m));
  assert.deepEqual(m.reabiertas, [P], 'una vez cada 10 minutos');

  const n = mundo({ [P]: cerrada403(NUM_P), [S]: viva(NUM_S) }, { [P]: 'muerto', [S]: 'vivo' });
  await correrVigilancia(deps(n));
  assert.deepEqual(n.reabiertas, []);
});

test('el vigilante no toca la sesión: ni logout, ni delete, ni create, ni restart', () => {
  const codigo = sinComentarios(leer('../lib/lineas-de-mako-vigilante.ts')) + sinComentarios(leer('../lib/lineas-de-mako.ts'));
  assert.ok(!/logout|\/instance\/delete|\/instance\/create|\/instance\/restart|conectarCanalMaKo|desconectar/i.test(codigo),
    'una vigilancia que puede borrar la sesión le borra el WhatsApp a una línea que quizá estaba por volver');
  const evolution = leer('../lib/evolution.ts');
  const reabrir = evolution.slice(evolution.indexOf('export async function reabrirSesion'));
  assert.match(reabrir.slice(0, reabrir.indexOf('\n}')), /\/instance\/connect\//, 'reabrir es `connect`, que usa la sesión que ya tiene');
});

test('el envío nombra la línea: sin nombre, en la plataforma sale por la de MaKo', () => {
  const codigo = sinComentarios(leer('../lib/lineas-de-mako-vigilante.ts'));
  assert.match(codigo, /enviarTexto\(numero, texto, linea,/);
});

test('un envío que falla con las dos vivas prueba la otra línea: la principal puede ser una zombi que nadie sondeó todavía', async () => {
  const m = mundo({ [P]: viva(NUM_P), [S]: viva(NUM_S) }, { [P]: 'vivo', [S]: 'vivo' });
  m.settings.set(keyDesde('secundaria'), '2026-11-03T19:00:00.000Z');
  m.settings.set(keyAvisado('secundaria'), '2026-11-03T19:01:00.000Z|desvinculada');
  m.falla.enviar = [P];
  const r = await correrVigilancia(deps(m));
  assert.equal(r.lineas[1].que, 'volvio');
  assert.equal(r.lineas[1].por, 'whatsapp');
  assert.deepEqual(m.enviados.map((e) => [e.linea, e.numero]), [[S, NUM_S]]);
  assert.equal(m.mails.length, 0);
  assert.ok(!m.settings.get(keyDesde('secundaria')), 'al volver, el «desde» se limpia en la misma corrida');
});

// ── Con la red enchufada: el vigilante real, sobre las respuestas medidas de Evolution ─────────────────────────────────────
const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_lineas-de-mako-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
const destinos = (v: { enviados: Array<{ linea: string; numero: string }> }) => v.enviados.map((e) => [e.linea, e.numero]);

test('real: la foto se lee de lo que contesta Evolution, y una instancia que no existe no es «no pude preguntar»', () => {
  assert.deepEqual(R.fotoCaida, { existe: true, estado: 'close', codigo: 403, cuando: '2026-11-03T19:39:36.189Z', numero: NUM_P });
  assert.deepEqual(R.fotoNoExiste, { existe: false, estado: null, codigo: null, cuando: null, numero: null },
    'esta ruta dice «not found», no «does not exist»: con el reconocedor de la sonda la línea soltada queda sin medir para siempre');
  assert.equal(R.fotoFiltroIgnorado.existe, false, 'si Evolution ignora el filtro no se adopta la fila de otra línea');
});

test('real: la caída sale por la secundaria nombrada, y no por la de MaKo que `enviarTexto` usa por default en la plataforma', () => {
  assert.deepEqual(destinos(R.caida), [[S, NUM_S]], 'un mensaje, a sí misma: nunca el tráfico de la principal, ni la cuenta baneada');
  assert.equal(R.caida.mails.length, 0);
  assert.equal(R.caida.r.lineas[0].llego, true);
  assert.match(R.caida.enviados[0].texto, /https:\/\/hola-mako\.com\/agencia\?canal=1/);
  assert.deepEqual(destinos(R.repite), [], 'y no se repite');
});

test('real: al volver la principal le escribe a la secundaria: `elegirLinea` la acepta como línea de MaKo', () => {
  assert.deepEqual(destinos(R.volvio), [[P, NUM_S]]);
  assert.match(R.volvio.enviados[0].texto, /Volvió la línea de MaKo/);
});

test('real: si cae la secundaria avisa la principal, con el link que lleva `?ws=` a su negocio', () => {
  assert.deepEqual(destinos(R.secundariaCaida), [[P, NUM_S]]);
  assert.match(R.secundariaCaida.enviados[0].texto, /Se cayó tu línea secundaria/);
  assert.match(R.secundariaCaida.enviados[0].texto, /whatsapp\?canal=no-oficial&linea=mako_ws9/);
  assert.match(R.secundariaCaida.enviados[0].texto, /ws=9/);
});

test('real: si caen las dos sale un mail desde MaKo a equipo@hola-mako.com, sin WhatsApp', () => {
  assert.deepEqual(destinos(R.lasDos), []);
  assert.equal(R.lasDos.mails.length, 1);
  assert.deepEqual(R.lasDos.mails[0].to, ['equipo@hola-mako.com']);
  assert.match(R.lasDos.mails[0].from, /equipo@hola-mako\.com/);
  assert.equal(R.lasDos.mails[0].subject, '🚨 Las dos líneas de WhatsApp de MaKo están caídas');
});

test('real: un corte abandonado se reabre sin avisar todavía, y una línea soltada no avisa', () => {
  assert.deepEqual(R.reabrir.conectadas, [S]);
  assert.deepEqual(destinos(R.reabrir), []);
  assert.deepEqual(destinos(R.soltada), [], 'soltar el número a propósito no es una caída');
  assert.equal(R.soltada.mails.length, 0);
});

test('real: con la voz en una línea de negocio, el link lleva a esa línea, no a escanear el canal baneado', () => {
  assert.deepEqual(destinos(R.vozEnNegocio), []);
  assert.equal(R.vozEnNegocio.mails.length, 1);
  assert.match(R.vozEnNegocio.mails[0].text, /whatsapp\?canal=no-oficial&linea=mako_ws9/);
  assert.ok(!/agencia\?canal=1/.test(R.vozEnNegocio.mails[0].text), 'mandaría a escanear el número baneado');
});

test('real: en toda la corrida no se tocó la sesión de nadie', () => {
  assert.deepEqual(R.tocadas, []);
});

test('alguien la mira: la ruta exige CRON_SECRET y está agendada cada 3 minutos', () => {
  const ruta = sinComentarios(leer('../app/api/cron/vigia-lineas-mako/route.ts'));
  assert.match(ruta, /checkCronAuth\(request\)/);
  assert.match(ruta, /vigilarLineasDeMako\(\)/);
  const crons = (JSON.parse(leer('../vercel.json')) as { crons: Array<{ path: string; schedule: string }> }).crons;
  assert.equal(crons.find((c) => c.path === '/api/cron/vigia-lineas-mako')?.schedule, '*/3 * * * *');
});
