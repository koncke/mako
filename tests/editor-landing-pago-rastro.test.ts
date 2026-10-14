// =============================================================================
// El «Botón de pago» de una landing: la poda, el rastro de los rechazos y la campaña (Paquete 3, tanda 6)
// =============================================================================
// Tres ítems de la revisión de la tanda 4 que el triage de la tanda 6 dejó en el Paquete 3:
//   · «Nadie poda `landing_pago_pedidos`»: al soltar el candado se borran las filas de ESA landing de
//     hace más de una semana (`podar`, pago-landing-server.ts; `conCandado`, pago-pedido.ts);
//   · «Los rechazos del POST del pago no dejan rastro consultable» (AGENTS.md: «Una política puede
//     RECHAZAR; no puede no dejar rastro»): los de DESPUÉS de leer la landing suman a un contador por
//     landing, día y motivo (mig 0282); los de antes, al log;
//   · «La atribución del anuncio se pierde en el lead que nace por el botón de pago»: el GET del paso lee
//     el Referer del MISMO host y escribe los utm y el fbclid como inputs hidden; el POST los vuelve a
//     sanear y llegan a `createLead` y a la propuesta.
// Todo sin base: dependencias de mentira y, donde lo que importa es la consulta, el fuente. La rotura de
// cada guard, con números, al final.
// =============================================================================

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'secreto-de-prueba-del-pago-de-landings-0123456789abcdef';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ATRIBUCION_PAGO_VACIA, CAMPOS_ATRIBUCION_PAGO, CAMPO_TRAMPA, CANDADO_VENCE_MS, MOTIVOS_RECHAZO_PAGO, PODA_PEDIDOS_MS,
  TOPE_ATRIBUCION_CODIFICADA, TOPE_ATRIBUCION_UTM, TOPE_EMAIL, TOPE_NOMBRE,
  atribucionDeCampos, atribucionDelReferer, conCandado, corteDePoda, largoEnFormulario, resumirRechazos, valorDeAtribucion,
  type AtribucionPago, type DepCandado, type MotivoRechazoPago,
} from '../lib/editor-landing/pago-pedido';
import {
  TOPE_CUERPO_PAGO, paginaPasoPago, responderPagoPost, responderPasoPago,
  type DepPagoPost, type LandingDelPaso, type ResultadoDelPago,
} from '../lib/editor-landing/pago-pagina';
import type { EstadoCobroLanding } from '../lib/editor-landing/pago-landing';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const APP = 'https://hola-mako.com';
const ESTADO: EstadoCobroLanding = { conectadas: ['stripe'], productos: [{ id: 12, nombre: 'Programa', tipo: 'unico', montoUsd: 990 }] };
const LANDING: LandingDelPaso = { ws: 7, docId: 40, slug: 'mi-landing', titulo: 'Mi landing', sitio: 'Mi sitio', temaId: 'pewter', fuentes: [], productos: [12] };
const BIEN = { slug: 'mi-landing', bloque: '12', nombre: 'Ana Pérez', email: 'ana@mail.com', [CAMPO_TRAMPA]: '' };
const ch = (n: number) => String.fromCharCode(n);

/** Un bloque del fuente: desde `desde` hasta la primera línea que empiece con `hasta`. */
function bloque(src: string, desde: string, hasta: RegExp): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}» en el fuente`);
  const resto = src.slice(i);
  const m = hasta.exec(resto.slice(desde.length));
  return m ? resto.slice(0, desde.length + m.index) : resto;
}

/** Silencia (y junta) lo que el código manda a la consola mientras corre `fn`. */
async function conConsola<T>(fn: () => Promise<T>): Promise<{ valor: T; warn: string[]; error: string[] }> {
  const w = console.warn;
  const e = console.error;
  const warn: string[] = [];
  const error: string[] = [];
  console.warn = (...a: unknown[]) => { warn.push(a.map(String).join(' ')); };
  console.error = (...a: unknown[]) => { error.push(a.map(String).join(' ')); };
  try {
    return { valor: await fn(), warn, error };
  } finally {
    console.warn = w;
    console.error = e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. La poda de `landing_pago_pedidos`
// ─────────────────────────────────────────────────────────────────────────────

function candado(op: { sinTabla?: boolean; podaFalla?: boolean } = {}) {
  const pasos: string[] = [];
  const log: string[] = [];
  const dep: DepCandado = {
    tomar: async () => (op.sinTabla ? { tipo: 'sin-tabla' } : { tipo: 'tomado', id: 9 }),
    soltar: async (id, r) => { pasos.push(`soltar ${id} ${r}`); },
    vencer: async () => { pasos.push('vencer'); },
    esperar: async () => {},
    ahora: () => 0,
    log: (_n, t) => { log.push(t); },
    podar: async () => {
      pasos.push('podar');
      if (op.podaFalla) throw new Error('la base no contestó');
    },
  };
  return { dep, pasos, log };
}

test('poda: al soltar el candado propio se poda UNA vez, y una poda que falla no cambia el pago', async () => {
  {
    const { dep, pasos } = candado();
    const r = await conCandado(dep, async () => 'listo', (x) => x);
    assert.deepEqual(r, { tipo: 'hecho', valor: 'listo' });
    assert.deepEqual([...pasos].sort(), ['podar', 'soltar 9 listo'], 'suelta y poda, una vez cada una');
  }
  {
    const { dep, log } = candado({ podaFalla: true });
    const r = await conCandado(dep, async () => 'listo', (x) => x);
    assert.deepEqual(r, { tipo: 'hecho', valor: 'listo' }, 'la poda no es del pago');
    assert.ok(log.some((t) => /podar/.test(t)), 'pero queda en el log');
  }
  {
    const { dep, pasos } = candado({ sinTabla: true });
    await conCandado(dep, async () => 'listo', (x) => x);
    assert.deepEqual(pasos, [], 'sin la tabla (mig 0276) no hay nada que podar');
  }
});

test('poda: una semana — más que la hora del techo y que el vencimiento del candado', () => {
  assert.ok(PODA_PEDIDOS_MS >= 24 * 3_600_000, 'el techo cuenta la última hora: lo podado nunca entra en la cuenta');
  assert.ok(PODA_PEDIDOS_MS > 1_000 * CANDADO_VENCE_MS, 'una fila en curso así de vieja es un candado muerto');
  const ahora = Date.parse('2026-10-14T12:00:00.000Z');
  assert.equal(corteDePoda(ahora), '2026-10-07T12:00:00.000Z');
});

test('poda: borra sólo las filas de ESA landing, por fecha, y tolera la tabla que falta', () => {
  const src = leer('lib/editor-landing/pago-landing-server.ts');
  const podar = bloque(src, '    podar: async () => {', /\n {4}\},\n/);
  assert.match(podar, /\.delete\(\)/);
  assert.match(podar, /\.eq\('doc_id', docId\)/, 'sólo la landing que cobra (el índice doc_id, created_at de la 0276)');
  assert.match(podar, /\.lt\('created_at', corteDePoda\(/);
  // Sin `en_curso = false`, a propósito: con ese filtro un candado muerto quedaba para siempre.
  assert.doesNotMatch(podar, /en_curso/);
  assert.match(podar, /if \(faltaLaTabla\(error\)\) return;/, 'sin la mig 0276 no tira');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. El rastro de los rechazos
// ─────────────────────────────────────────────────────────────────────────────

function post(cuerpo: Record<string, string>, op: { origin?: string | null; largo?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };
  const origin = op.origin === undefined ? APP : op.origin;
  if (origin) headers.origin = origin;
  if (op.largo) headers['content-length'] = op.largo;
  return new Request(`${APP}/api/landing-generator/pagar`, { method: 'POST', headers, body: new URLSearchParams(cuerpo).toString() });
}

function depPost(over: Partial<DepPagoPost> & { resultado?: ResultadoDelPago; rechazoTira?: boolean } = {}) {
  const rechazos: Array<[number, MotivoRechazoPago]> = [];
  const pagos: Array<{ atribucion: AtribucionPago }> = [];
  let lecturas = 0;
  const { resultado, rechazoTira, ...resto } = over;
  const dep: DepPagoPost = {
    appBaseUrl: APP,
    ip: '1.1.1.1',
    limitar: () => true,
    landing: async () => { lecturas++; return LANDING; },
    esDelDominio: async () => true,
    detalle: async () => ({ estado: ESTADO, estiloTema: null }),
    pagar: async (_l, _p, atribucion) => {
      pagos.push({ atribucion });
      return resultado ?? { tipo: 'redirigir', url: `${APP}/pagar/TOKEN` };
    },
    rechazo: async (docId, motivo) => {
      rechazos.push([docId, motivo]);
      if (rechazoTira) throw new Error('la base no contestó');
    },
    ...resto,
  };
  return { dep, rechazos, pagos, lecturas: () => lecturas };
}

test('rastro: los cuatro rechazos de DESPUÉS de leer la landing suman a su contador, con su motivo', async () => {
  const casos: Array<[string, Request, Parameters<typeof depPost>[0], number, MotivoRechazoPago]> = [
    ['tope por email', post(BIEN), { limitar: (c) => !c.includes(':email:') }, 429, 'tope-email'],
    ['techo de la hora', post(BIEN), { resultado: { tipo: 'demasiados' } }, 429, 'techo'],
    ['un dominio propio de OTRA landing', post(BIEN, { origin: 'https://tunegocio.com' }), { esDelDominio: async () => false }, 403, 'dominio-ajeno'],
    ['un producto que la foto no ofrece', post({ ...BIEN, bloque: '13' }), {}, 404, 'producto'],
  ];
  for (const [nombre, req, over, status, motivo] of casos) {
    const { dep, rechazos } = depPost(over);
    const { valor: r, warn } = await conConsola(() => responderPagoPost(req, dep));
    assert.equal(r.status, status, nombre);
    assert.deepEqual(rechazos, [[LANDING.docId, motivo]], `${nombre}: una suma, de ESA landing`);
    assert.ok(warn.some((t) => t.includes(motivo)), `${nombre}: y el motivo en el log`);
  }
});

test('rastro: lo de ANTES de leer la landing va sólo al log (ni una escritura por pedido de un bot)', async () => {
  const casos: Array<[string, Request, Parameters<typeof depPost>[0], number, string]> = [
    ['tope por IP', post(BIEN), { limitar: (c) => !c.includes(':ip:') }, 429, 'tope-ip'],
    ['cuerpo grande', post(BIEN, { largo: '99999' }), {}, 413, 'tamano'],
    ['sin Origin', post(BIEN, { origin: null }), {}, 403, 'origen'],
    ['Origin ajeno', post(BIEN, { origin: 'https://otro-sitio.vercel.app' }), {}, 403, 'origen'],
    ['forma', post({ ...BIEN, bloque: 'x' }), {}, 400, 'forma'],
    ['trampa', post({ ...BIEN, [CAMPO_TRAMPA]: 'x' }), {}, 400, 'trampa'],
  ];
  for (const [nombre, req, over, status, motivo] of casos) {
    const { dep, rechazos, lecturas } = depPost(over);
    const { valor: r, warn } = await conConsola(() => responderPagoPost(req, dep));
    assert.equal(r.status, status, nombre);
    assert.equal(lecturas(), 0, `${nombre}: no toca la base`);
    assert.deepEqual(rechazos, [], `${nombre}: no escribe`);
    const linea = warn.find((t) => t.includes(motivo));
    assert.ok(linea, `${nombre}: el motivo «${motivo}» queda en el log`);
    assert.doesNotMatch(linea!, /1\.1\.1\.1|ana@mail\.com/, `${nombre}: sin el IP ni el email`);
  }
  // Una landing que no se sirve no tiene a quién anotarle nada: un slug cualquiera no escribe.
  const { dep, rechazos } = depPost({ landing: async () => null });
  assert.equal((await conConsola(() => responderPagoPost(post(BIEN), dep))).valor.status, 404);
  assert.deepEqual(rechazos, []);
});

test('rastro: lo que no es un rechazo no suma, y un contador que falla no cambia lo que ve el visitante', async () => {
  for (const [nombre, req, resultado, status] of [
    ['el pago', post(BIEN), undefined, 303],
    ['un email mal escrito', post({ ...BIEN, email: 'ana@' }), undefined, 400],
    ['no se puede cobrar (queda una propuesta)', post(BIEN), { tipo: 'no-disponible' }, 409],
    ['falló la pasarela (va al historial)', post(BIEN), { tipo: 'fallo' }, 502],
  ] as Array<[string, Request, ResultadoDelPago | undefined, number]>) {
    const { dep, rechazos } = depPost({ resultado });
    assert.equal((await conConsola(() => responderPagoPost(req, dep))).valor.status, status, nombre);
    assert.deepEqual(rechazos, [], nombre);
  }
  const bien = await conConsola(() => responderPagoPost(post(BIEN), depPost({ resultado: { tipo: 'demasiados' } }).dep));
  const mal = await conConsola(() => responderPagoPost(post(BIEN), depPost({ resultado: { tipo: 'demasiados' }, rechazoTira: true }).dep));
  assert.equal(mal.valor.status, 429);
  assert.equal(await mal.valor.text(), await bien.valor.text(), 'la misma página');
  assert.ok(mal.error.some((t) => /no pude anotar el rechazo techo/.test(t)), 'y la falla del contador, al log');
});

test('rastro: los motivos entran en el check de la 0282 y el resumen suma lo que es un número', () => {
  for (const m of MOTIVOS_RECHAZO_PAGO) assert.match(m, /^[a-z][a-z-]{0,39}$/, m);
  const r = resumirRechazos([
    { dia: '2026-10-12', motivo: 'techo', n: 3 },
    { dia: '2026-10-14', motivo: 'tope-email', n: '2' },
    { dia: '2026-10-13', motivo: 'techo', n: 1 },
    { dia: '2026-10-13', motivo: 'uno-futuro', n: 4 },
    { dia: 'basura', motivo: 'producto', n: 'x' },
    { dia: '2026-10-15', motivo: 'producto', n: -1 },
  ]);
  assert.deepEqual(r, { total: 10, porMotivo: { 'tope-email': 2, techo: 4, 'dominio-ajeno': 0, producto: 0 }, otros: 4, ultimoDia: '2026-10-14' });
  assert.deepEqual(resumirRechazos([]), { total: 0, porMotivo: { 'tope-email': 0, techo: 0, 'dominio-ajeno': 0, producto: 0 }, otros: 0, ultimoDia: null });
});

test('rastro: la 0282 es un contador sin datos personales, cerrado a la clave pública, y la ruta lo usa', () => {
  const sql = leer('supabase/migrations/0282_landing_pago_rechazos.sql').replace(/--[^\n]*/g, '');
  assert.match(sql, /create table if not exists landing_pago_rechazos \(/);
  assert.match(sql, /doc_id\s+bigint not null references landing_docs\(id\) on delete cascade/);
  assert.match(sql, /motivo\s+text not null check \(char_length\(motivo\) between 1 and 40\)/);
  assert.match(sql, /primary key \(doc_id, dia, motivo\)/);
  const tabla = bloque(sql, 'create table if not exists landing_pago_rechazos (', /\n\);/);
  assert.doesNotMatch(tabla, /email|ip\b|nombre|telefono|workspace_id/, 'lo que se guarda es que pasó y por qué, no quién');
  assert.match(sql, /alter table landing_pago_rechazos enable row level security;/);
  assert.match(sql, /revoke all on landing_pago_rechazos from anon, authenticated;/);
  assert.match(sql, /create or replace function landing_pago_rechazo_sumar\(p_doc bigint, p_motivo text\)/);
  assert.match(sql, /on conflict \(doc_id, dia, motivo\) do update set n = landing_pago_rechazos\.n \+ 1;/, 'suma en UNA sentencia');
  assert.match(sql, /revoke execute on function landing_pago_rechazo_sumar\(bigint, text\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function landing_pago_rechazo_sumar\(bigint, text\) to service_role;/);
  assert.doesNotMatch(leer('lib/workspace.ts'), /landing_pago_rechazos/, 'sin workspace_id: fuera de TENANT_TABLES');

  const server = leer('lib/editor-landing/pago-landing-server.ts');
  const anotar = bloque(server, 'export async function anotarRechazoDePago(', /\n\}\n/);
  assert.match(anotar, /\.rpc\('landing_pago_rechazo_sumar', \{ p_doc: docId, p_motivo: motivo \}\)/, 'los nombres de la función de la 0282');
  assert.match(anotar, /faltaElRastro\(error\)/);
  for (const c of ['PGRST202', 'PGRST205', '42P01']) assert.ok(server.includes(`'${c}'`), `tolera ${c}`);
  const leerRechazos = bloque(server, 'export async function rechazosDePago(', /\n\}\n/);
  assert.match(leerRechazos, /\.eq\('id', docId\)\.eq\('workspace_id', ws\)/, 'la landing se confirma del workspace antes de leer');
  assert.match(leer('app/api/landing-generator/pagar/route.ts'), /\n\s+rechazo: anotarRechazoDePago,\n/, 'la ruta lo cablea');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. De qué anuncio vino quien paga
// ─────────────────────────────────────────────────────────────────────────────

test('atribución: un valor se limpia (control, ancho cero, bidi), un utm se recorta y un fbclid largo no va', () => {
  const sucio = `  Campaña${ch(0)}${ch(0x7f)}otoño${ch(0x202e)}${ch(0x200b)}  2026${ch(0x9f)}\n`;
  assert.equal(valorDeAtribucion('utm_campaign', sucio), 'Campaña otoño 2026');
  assert.equal(valorDeAtribucion('utm_source', '   '), null);
  assert.equal(valorDeAtribucion('utm_source', 42), null);
  const largo = valorDeAtribucion('utm_campaign', 'a'.repeat(1_000))!;
  assert.equal(largo.length, TOPE_ATRIBUCION_UTM);
  const acentos = valorDeAtribucion('utm_campaign', 'ñ'.repeat(1_000))!;
  assert.ok(largoEnFormulario(acentos) <= TOPE_ATRIBUCION_CODIFICADA, 'el techo es también el del formulario codificado');
  const fbclid = 'IwAR' + 'x'.repeat(100);
  assert.equal(valorDeAtribucion('fbclid', fbclid), fbclid, 'un fbclid se guarda tal cual (mig 0177)');
  assert.equal(valorDeAtribucion('fbclid', 'IwAR' + 'x'.repeat(TOPE_ATRIBUCION_CODIFICADA)), null, 'uno cortado no identifica ningún clic: no va');
  assert.equal(valorDeAtribucion('fbclid', 'IwAR abc'), null);
  assert.ok(!(CAMPOS_ATRIBUCION_PAGO as readonly string[]).includes('utm_term'), 'utm_term es el visitor_id de Calendly en esta casa: no se lee');
});

test('atribución: el Referer cuenta SÓLO si es del mismo host que sirve el paso', () => {
  const ref = 'https://hola-mako.site/mi-landing?utm_source=facebook&utm_campaign=Otoño&fbclid=IwAR123&utm_term=palabra';
  assert.deepEqual(atribucionDelReferer(ref, ['hola-mako.site']), { ...ATRIBUCION_PAGO_VACIA, utm_source: 'facebook', utm_campaign: 'Otoño', fbclid: 'IwAR123' });
  assert.deepEqual(atribucionDelReferer(ref, ['HOLA-MAKO.SITE', null]), atribucionDelReferer(ref, ['hola-mako.site']), 'el host sin mayúsculas');
  for (const [nombre, r, hosts] of [
    ['otro sitio (Referrer-Policy: unsafe-url)', 'https://ajeno.com/?utm_source=x', ['hola-mako.site']],
    ['un subdominio', 'https://x.hola-mako.site/?utm_source=x', ['hola-mako.site']],
    ['otro puerto', 'https://hola-mako.site:8443/?utm_source=x', ['hola-mako.site']],
    ['otro protocolo', 'javascript://hola-mako.site/?utm_source=x', ['hola-mako.site']],
    ['basura', 'no es una url', ['hola-mako.site']],
    ['sin Referer', null, ['hola-mako.site']],
    ['sin hosts', 'https://hola-mako.site/?utm_source=x', []],
  ] as Array<[string, string | null, string[]]>) {
    assert.deepEqual(atribucionDelReferer(r, hosts), ATRIBUCION_PAGO_VACIA, nombre);
  }
});

const getPaso = (url: string, headers: Record<string, string>, metodo = 'GET') =>
  responderPasoPago(new Request(url, { method: metodo, headers }), { slug: 'mi-landing', bloque: '12' }, {
    appBaseUrl: APP,
    landing: async () => LANDING,
    detalle: async () => ({ estado: ESTADO, estiloTema: null }),
  });
const ocultos = (html: string) => Object.fromEntries([...html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)].map((m) => [m[1], m[2]]));

test('atribución: el GET del paso escribe la campaña del Referer como inputs hidden, escapada', async () => {
  const conCampana = await (await getPaso('https://hola-mako.site/l/mi-landing/pagar/12', {
    host: 'hola-mako.site',
    referer: 'https://hola-mako.site/mi-landing?utm_source=fb&utm_medium=paid&utm_content=%22%3E%3Cscript%3Ex%3C%2Fscript%3E&fbclid=IwAR9',
  })).text();
  assert.deepEqual(ocultos(conCampana), { slug: 'mi-landing', bloque: '12', utm_source: 'fb', utm_medium: 'paid', utm_content: '&quot;&gt;&lt;script&gt;x&lt;/script&gt;', fbclid: 'IwAR9' });
  assert.doesNotMatch(conCampana, /<script/i);
  // El dominio propio: el proxy reescribe a /api/landing-generator/dominio y la cabecera Host sigue siendo la del cliente.
  const enDominio = await (await getPaso(`${APP}/api/landing-generator/dominio?h=1`, { host: 'tunegocio.com', referer: 'https://tunegocio.com/?utm_source=ig' })).text();
  assert.equal(ocultos(enDominio).utm_source, 'ig');
  const ajeno = await (await getPaso('https://hola-mako.site/l/mi-landing/pagar/12', { host: 'hola-mako.site', referer: 'https://ajeno.com/?utm_source=fb' })).text();
  assert.deepEqual(ocultos(ajeno), { slug: 'mi-landing', bloque: '12' }, 'de otro sitio no se lee nada');
  assert.equal(await (await getPaso('https://hola-mako.site/l/mi-landing/pagar/12', { host: 'hola-mako.site', referer: 'https://hola-mako.site/?utm_source=fb' }, 'HEAD')).text(), '');
});

test('atribución: el POST la vuelve a sanear, se la pasa al cobro, y un campo mal escrito no la pierde', async () => {
  {
    const { dep, pagos } = depPost();
    const cuerpo = { ...BIEN, utm_source: `fb${ch(0)}${ch(0x202e)}`, utm_campaign: 'c'.repeat(900), fbclid: 'IwAR' + 'y'.repeat(400), utm_term: 'palabra' };
    assert.equal((await conConsola(() => responderPagoPost(post(cuerpo), dep))).valor.status, 303);
    assert.equal(pagos.length, 1);
    const a = pagos[0].atribucion;
    assert.equal(a.utm_source, 'fb', 'lo de los inputs hidden lo escribe cualquiera');
    assert.equal(a.utm_campaign!.length, TOPE_ATRIBUCION_UTM);
    assert.equal(a.fbclid, null);
    assert.equal(a.utm_medium, null);
    assert.ok(!('utm_term' in a));
  }
  {
    const { dep, pagos } = depPost();
    await conConsola(() => responderPagoPost(post(BIEN), dep));
    assert.deepEqual(pagos[0].atribucion, ATRIBUCION_PAGO_VACIA, 'sin campaña, todo null (nunca undefined)');
  }
  {
    const { dep, pagos } = depPost();
    const r = await conConsola(() => responderPagoPost(post({ ...BIEN, email: 'ana@', utm_source: 'fb', fbclid: 'IwAR9' }), dep));
    assert.equal(r.valor.status, 400);
    assert.equal(pagos.length, 0);
    const h = ocultos(await r.valor.text());
    assert.equal(h.utm_source, 'fb', 'vuelve con el formulario');
    assert.equal(h.fbclid, 'IwAR9');
  }
});

test('atribución: el formulario más pesado posible, con la campaña en su techo, entra en TOPE_CUERPO_PAGO', async () => {
  // Lo peor que puede mandar un navegador: el nombre entero en caracteres de 3 bytes (9 al codificarse),
  // el email entero con caracteres que se codifican, el slug y el producto más largos, y cada valor de
  // atribución en su techo (lo que el GET puede llegar a escribir).
  const peor = (k: (typeof CAMPOS_ATRIBUCION_PAGO)[number]) => valorDeAtribucion(k, k === 'fbclid' ? 'Iw' + '_'.repeat(TOPE_ATRIBUCION_CODIFICADA - 2) : '+'.repeat(5_000))!;
  const campos: Record<string, string> = {
    slug: 'a'.repeat(60),
    bloque: '9'.repeat(10),
    nombre: '€'.repeat(TOPE_NOMBRE),
    email: '+'.repeat(TOPE_EMAIL - 12) + '@ejemplo.com',
    ...Object.fromEntries(CAMPOS_ATRIBUCION_PAGO.map((k) => [k, peor(k)])),
    [CAMPO_TRAMPA]: '',
  };
  for (const k of CAMPOS_ATRIBUCION_PAGO) assert.ok(campos[k], `${k} llega a su techo`);
  const cuerpo = new URLSearchParams(campos).toString();
  assert.ok(cuerpo.length <= TOPE_CUERPO_PAGO, `pesa ${cuerpo.length} de ${TOPE_CUERPO_PAGO}`);
  // Y pasa la puerta del tamaño de verdad (con el content-length que manda el navegador).
  const { dep, pagos } = depPost({ landing: async () => ({ ...LANDING, slug: campos.slug, productos: [9_999_999_999] }) });
  const req = new Request(`${APP}/api/landing-generator/pagar`, {
    method: 'POST',
    headers: { origin: APP, 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(cuerpo)) },
    body: cuerpo,
  });
  assert.equal((await conConsola(() => responderPagoPost(req, dep))).valor.status, 303);
  assert.equal(pagos.length, 1);
  // Y el paso lo dibuja con lo mismo (sin `utm_term`).
  const html = paginaPasoPago({ sitio: 'S', appBaseUrl: APP, producto: { nombre: 'P', precio: null }, slug: 'mi-landing', productoId: 12, nota: null, atribucion: atribucionDeCampos(new URLSearchParams(campos)) });
  assert.deepEqual(Object.keys(ocultos(html)).sort(), ['bloque', 'fbclid', 'slug', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source']);
});

test('atribución: el lead NUEVO y la propuesta llevan la campaña (los dos caminos), sin utm_term ni visitor_id', () => {
  const src = leer('lib/editor-landing/pago-landing-server.ts');
  const alta = bloque(src, '      const lead = await createLead({', /\n {6}\}\);\n/);
  for (const k of CAMPOS_ATRIBUCION_PAGO) assert.match(alta, new RegExp(`${k}: atrib\\.${k}`), `createLead recibe ${k}`);
  assert.doesNotMatch(alta, /utm_term|visitor_id/);
  const propuesta = bloque(src, 'async function proponerQuienQuisoPagar(', /\n\}\n/);
  for (const k of CAMPOS_ATRIBUCION_PAGO) assert.match(propuesta, new RegExp(`${k}: atrib\\.${k}`), `la propuesta lleva ${k} (atribucionDePropuesta la escribe al confirmar)`);
  const pagar = bloque(src, 'export async function pagarDesdeLanding(', /\n\}\n/);
  assert.match(pagar, /proponerQuienQuisoPagar\(l, p, motivo, quePide, atribucion\)/);
  assert.match(pagar, /leadDeQuienPaga\(l, \{ nombre: p\.nombre, email: p\.email, autor, atribucion \}\)/);
  assert.match(leer('app/api/landing-generator/pagar/route.ts'), /\n\s+pagar: pagarDesdeLanding,\n/, 'la ruta le pasa la atribución (tercer argumento)');
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez, sólo ESTE archivo (base 14 / 0), con un arnés en
// el scratchpad que guarda cada archivo en memoria, lo rompe, corre y lo reescribe (sha256 igual antes y
// después; nunca `git checkout`). Resultado «pass / fail»:
//    1. `conCandado` no poda al soltar                                     → 13 / 1
//    2. la poda filtra `en_curso = false` (el candado muerto queda)        → 13 / 1
//    3. la poda borra las filas de TODAS las landings (sin doc_id)         → 13 / 1
//    4. la poda a los 30 minutos (dentro de la hora del techo)             → 13 / 1
//    5. el tope por email no suma al contador                              → 13 / 1
//    6. el techo de la hora no suma al contador                            → 12 / 2
//    7. el dominio ajeno se anota como «producto»                          → 13 / 1
//    8. el producto que la foto no ofrece no suma                          → 13 / 1
//    9. un contador que falla tira (sin el try)                            → 13 / 1
//   10. lo de antes de leer la landing va al log SIN el motivo             → 13 / 1
//   11. el Referer de cualquier host                                       → 12 / 2
//   12. sin limpiar control, ancho cero y bidi                             → 12 / 2
//   13. un fbclid largo se recorta en vez de no ir                         → 12 / 2
//   14. el techo codificado sube a 900 (el formulario ya no entra)         → 12 / 2
//   15. el POST pasa los inputs hidden sin sanear                          → 13 / 1
//   16. un email mal escrito pierde la campaña                             → 13 / 1
//   17. el GET no lee el Referer                                           → 13 / 1
//   18. los hosts del pedido sin la cabecera Host (el dominio propio)      → 13 / 1
//   19. `createLead` sin la campaña                                        → 13 / 1
//   20. la propuesta sin la campaña                                        → 13 / 1
//   21. `pagarDesdeLanding` no le pasa la campaña al lead                  → 13 / 1
//   22. la RPC con otros nombres de parámetro que la 0282                  → 13 / 1
//   23. la 0282 sin el revoke execute de la función                        → 13 / 1
//   24. la ruta no cablea el contador                                      → 13 / 1
//   25. un motivo que esta versión no conoce no suma al resumen            → 13 / 1
// Restaurado: 14 / 0. El formulario más pesado posible pesa 3.484 de 4.000 (sin la campaña, 1.925).
// =============================================================================
