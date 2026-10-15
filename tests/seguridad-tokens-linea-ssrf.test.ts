// =============================================================================
// Auditoría de seguridad del 14/10/2026, paquete g5: el token clásico, la línea de MaKo y el Archivero
// =============================================================================
// Cuatro hallazgos, cada uno con su guarda:
//
//   1. El token clásico (`mkoag_…`, el de la skill) seguía valiendo cuando quien lo acuñó perdía el
//      acceso: una agencia a la que le sacaban el cliente se iba con un bearer que leía leads y
//      ejecutaba escrituras. Ahora el setting guarda al creador y cada pedido lo revisa
//      (lib/agente-token-nucleo.ts); revocar la agencia o suspender a la persona además lo borra.
//   2. Cualquier admin hacía que la línea de WhatsApp de MaKo —una sola para toda la plataforma—
//      agregara a su grupo o le mandara DM a números arbitrarios, sin tope. Ahora hay un cupo por
//      workspace (lib/mako-linea-tope.ts) y el código va por DM ANTES de sumar a nadie al grupo.
//   3. «Sumar una web» del Archivero era un SSRF: miraba el texto del host y `fetch` seguía los
//      redirects sin revalidar. Ahora cada salto pasa por `validarDestino` y la conexión va a la IP
//      validada (lib/archivero-bajada.ts).
//   4. La guarda del path de un archivo subido (`startsWith(`${ws}/`)`) dejaba pasar `5/../7/<uuid>`.
//
// Lo que es decisión pura se EJECUTA (con almacenes de mentira y un server HTTP local); lo que es
// cableado se lee del fuente, sin comentarios y con los fines de línea normalizados.
//
// Correr: node --import tsx --test tests/seguridad-tokens-linea-ssrf.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez y restaurando desde el texto en memoria
// (nunca con git), sobre los 15 tests de este archivo (base: 15 pasan / 0 fallan). Las 23:
//   · wsDeTokenCon sin el chequeo del creador (`return ws` tras `coincide`)        → 13 / 2
//   · wsDeTokenCon que deja pasar un token CON creador si el almacén no sabe mirar  → 14 / 1
//   · leerGuardado tomando un `creadoPor` raro como «sin creador»                   → 14 / 1
//   · revocarSiCreadorSinAcceso con escribirSetting en vez del compare-and-set      → 14 / 1
//   · revocarSiCreadorSinAcceso sin mirar si el creador sigue (revoca siempre)      → 13 / 2
//   · acunarCon sin guardar el creador en el setting                                → 11 / 4
//   · lib/agente-token.ts con el almacén real sin `creadorVigente`                  → 14 / 1
//   · /api/agente/token acuñando sin el email de la sesión                          → 14 / 1
//   · /api/admin/agencia sin la llamada a la revocación                             → 14 / 1
//   · /api/equipo suspendiendo sin revocar                                          → 14 / 1
//   · reclamarContactoLinea sin el cupo                                             → 13 / 2
//   · reclamarContactoLinea con `siempre` ignorado (el código gratis al repetir)    → 14 / 1
//   · reclamarContactoLinea tragándose el error de contar (`.catch(() => true)`)    → 14 / 1
//   · enviarCodigoVerificacion volviendo a setNumeroDuenoYSync antes del código     → 14 / 1
//   · setNumeroDuenoYSync guardando el número ANTES de prepararContacto             → 14 / 1
//   · enviarInvitacionGrupo sin la marca de «una por número y ventana»              → 14 / 1
//   · prepararContacto sin pedir cupo                                               → 14 / 1
//   · pathSubidoValido vuelto a `path.startsWith(`${ws}/`)`                         → 14 / 1
//   · bajarWebSegura validando sólo el primer salto                                 → 14 / 1
//   · pedirClavado sin `lookup` (resuelve el nombre por su cuenta)                  → 13 / 2
//   · pedirClavado sin el techo mientras lee                                        → 14 / 1
//   · la ruta del Archivero volviendo a `fetch(url, { redirect: 'follow' })`        → 14 / 1
//   · la ruta del Archivero volviendo a la guarda por prefijo                       → 14 / 1
// Restaurado: 15 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  acunarCon, guardadoDeToken, leerGuardado, revocarSiCreadorSinAcceso, wsDeTokenCon, type AlmacenAgente,
} from '../lib/agente-token-nucleo';
import { hashDeToken } from '../lib/api-mako/tokens-lista';
import { reclamarContactoLinea, TOPE_LINEA_MAKO, type AlmacenTope } from '../lib/mako-linea-tope';
import { bajarWebSegura, pathSubidoValido, pedirClavado, MAX_BYTES_WEB, type DepsBajada } from '../lib/archivero-bajada';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Los bloques que ARRANCAN una línea (los JSDoc) y las líneas de comentario. No los `/* */` sueltos
// en medio del código: un string como '*/*' haría tragarse media función.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '');
/** El cuerpo de una función: desde su firma hasta el primer `}` de primer nivel. */
const bloque = (src: string, firma: string) => {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré «${firma}»: el test no está mirando nada`);
  const fin = src.indexOf('\n}\n', ini);
  return src.slice(ini, fin > ini ? fin : undefined);
};
/** Que `a` aparezca, que `b` aparezca, y en ese orden (un -1 no puede pasar por «antes»). */
const antes = (src: string, a: string, b: string, msg: string) => {
  const ia = src.indexOf(a), ib = src.indexOf(b);
  assert.ok(ia >= 0, `falta «${a}»`);
  assert.ok(ib >= 0, `falta «${b}»`);
  assert.ok(ia < ib, msg);
};

// ── 1. El token clásico y su creador ────────────────────────────────────────────

/** Una base falsa: settings por ws, el índice, y quién sigue teniendo acceso. */
function baseFalsa(opts: { conAcceso?: Set<string>; sinCreadorVigente?: boolean; sinCas?: boolean } = {}) {
  const settings = new Map<number, string>();
  const indice = new Map<string, number>();
  const conAcceso = opts.conAcceso ?? new Set<string>();
  const preguntas: Array<{ ws: number; email: string; fresco: boolean }> = [];
  const alm: AlmacenAgente = {
    leerSetting: async (ws) => settings.get(ws) ?? null,
    escribirSetting: async (ws, v) => { settings.set(ws, v); },
    wsPorIndice: async (id) => indice.get(id) ?? null,
    indexar: async (id, ws) => { if (!indice.has(id)) indice.set(id, ws); return indice.get(id) === ws ? 'ok' : 'ocupado'; },
    borrarIndicesEnClaro: async () => {},
    ...(opts.sinCreadorVigente ? {} : {
      creadorVigente: async (ws: number, email: string, fresco?: boolean) => {
        preguntas.push({ ws, email, fresco: !!fresco });
        return conAcceso.has(email);
      },
    }),
    ...(opts.sinCas ? {} : {
      cambiarSettingSi: async (ws: number, antes: string | null, despues: string) => {
        if ((settings.get(ws) ?? null) !== antes) return false;
        settings.set(ws, despues);
        return true;
      },
    }),
  };
  return { alm, settings, indice, conAcceso, preguntas };
}

let n = 0;
const azar = () => (++n).toString(16).padStart(4, '0').repeat(12);

test('el token clásico guarda a quien lo acuñó y deja de valer cuando esa persona pierde el acceso', async () => {
  const b = baseFalsa({ conAcceso: new Set(['admin@agencia.com']) });
  const { token } = await acunarCon(b.alm, 15, 'ejecutar', azar, '  Admin@Agencia.com ');
  const g = leerGuardado(b.settings.get(15));
  assert.ok(g?.forma === 'hash' && g.creadoPor === 'admin@agencia.com', 'el setting no guardó al creador (o no lo normalizó)');
  assert.ok(!(b.settings.get(15) ?? '').includes(token), 'el setting guardó el token en claro');

  assert.equal(await wsDeTokenCon(b.alm, token), 15, 'con el creador vigente, el token tiene que andar');
  // El cliente le saca la agencia: el creador deja de tener acceso.
  b.conAcceso.delete('admin@agencia.com');
  assert.equal(await wsDeTokenCon(b.alm, token), null, 'la agencia revocada se fue con un bearer que sigue valiendo');
  assert.deepEqual(b.preguntas.map((p) => p.email), ['admin@agencia.com', 'admin@agencia.com']);
  assert.ok(b.preguntas.every((p) => !p.fresco), 'el chequeo por pedido usa la memoria de un minuto, no lee fresco cada vez');
});

test('un token SIN creador (las skills de antes del 14/10) sigue valiendo', async () => {
  // ws1, ws9 y ws11 tienen token y ninguno guarda creador: romperlos sería romper las skills instaladas.
  const b = baseFalsa({ conAcceso: new Set() });
  const viejo = `mkoag_p_${'5a'.repeat(24)}`;
  b.settings.set(1, guardadoDeToken(viejo));          // hash + pista, sin creador
  b.indice.set(hashDeToken(viejo), 1);
  assert.equal(await wsDeTokenCon(b.alm, viejo), 1);
  assert.deepEqual(b.preguntas, [], 'a un token sin creador no hay a quién preguntarle');
  // El formato en claro (anterior al 09/10) tampoco tiene creador.
  const claro = `mkoag_${'cd'.repeat(24)}`;
  b.settings.set(9, claro);
  b.indice.set(claro, 9);
  assert.equal(await wsDeTokenCon(b.alm, claro), 9);
  // Y sin creador el setting queda IGUAL que antes: el script de conversión lo escribe así.
  assert.equal(guardadoDeToken(viejo), guardadoDeToken(viejo, ''));
  assert.ok(!guardadoDeToken(viejo).includes('creadoPor'));
});

test('con creador y sin forma de revisarlo, NO vale (fail-closed); la base caída TIRA', async () => {
  const b = baseFalsa({ sinCreadorVigente: true });
  const { token } = await acunarCon(b.alm, 4, 'proponer', azar, 'ana@negocio.com');
  assert.equal(await wsDeTokenCon(b.alm, token), null, 'un almacén que no sabe mirar al creador dejó pasar el token');

  const c = baseFalsa();
  const t2 = (await acunarCon(c.alm, 5, 'proponer', azar, 'ana@negocio.com')).token;
  c.alm.creadorVigente = async () => { throw new Error('usuarios: fetch failed'); };
  // «No pude leer» no es «tu token dejó de valer»: tira, y quien autentica contesta 503.
  await assert.rejects(wsDeTokenCon(c.alm, t2), /fetch failed/);
});

test('el setting con un creador que no escribió este código no autentica', () => {
  const base = { hash: 'a'.repeat(64), pista: 'mkoag_e_…abcd' };
  assert.equal(leerGuardado(JSON.stringify({ ...base, creadoPor: 7 })), null);
  assert.equal(leerGuardado(JSON.stringify({ ...base, creadoPor: { email: 'x' } })), null);
  assert.equal(leerGuardado(JSON.stringify({ ...base, creadoPor: 'x'.repeat(400) })), null);
  assert.equal(leerGuardado(JSON.stringify(base))?.forma, 'hash');
});

test('revocar: borra el token SÓLO si su creador perdió el acceso, leyendo fresco y con compare-and-set', async () => {
  const b = baseFalsa({ conAcceso: new Set(['duena@negocio.com', 'admin@agencia.com']) });
  // El token de la dueña no se toca aunque se revoque a la agencia.
  await acunarCon(b.alm, 15, 'proponer', azar, 'duena@negocio.com');
  b.conAcceso.delete('admin@agencia.com');
  assert.equal(await revocarSiCreadorSinAcceso(b.alm, 15), false);
  assert.ok(leerGuardado(b.settings.get(15)), 'se borró el token de alguien que sigue teniendo acceso');

  // El de la agencia sí.
  await acunarCon(b.alm, 17, 'ejecutar', azar, 'admin@agencia.com');
  assert.equal(await revocarSiCreadorSinAcceso(b.alm, 17), true);
  assert.equal(b.settings.get(17), '', 'el token de la agencia sigue guardado');
  assert.ok(b.preguntas.filter((p) => p.ws === 17).every((p) => p.fresco), 'la revocación le creyó a la memoria de un minuto');

  // Sin creador: no se sabe de quién es, no se toca.
  b.settings.set(1, guardadoDeToken(`mkoag_p_${'7c'.repeat(24)}`));
  assert.equal(await revocarSiCreadorSinAcceso(b.alm, 1), false);
  assert.notEqual(b.settings.get(1), '');

  // Con `email`, sólo los de esa persona.
  await acunarCon(b.alm, 18, 'ejecutar', azar, 'admin@agencia.com');
  assert.equal(await revocarSiCreadorSinAcceso(b.alm, 18, 'otra@agencia.com'), false);
  assert.equal(await revocarSiCreadorSinAcceso(b.alm, 18, 'ADMIN@agencia.com'), true);
});

test('revocar no pisa un token que alguien rotó entre la lectura y la escritura', async () => {
  const b = baseFalsa({ conAcceso: new Set(['duena@negocio.com']) });
  await acunarCon(b.alm, 19, 'ejecutar', azar, 'admin@agencia.com');
  // Mientras se revisa al creador viejo, la dueña rota uno nuevo.
  const revisar = b.alm.creadorVigente!;
  let nuevo = '';
  b.alm.creadorVigente = async (ws, email, fresco) => {
    nuevo = (await acunarCon(b.alm, 19, 'ejecutar', azar, 'duena@negocio.com')).token;
    return revisar(ws, email, fresco);
  };
  assert.equal(await revocarSiCreadorSinAcceso(b.alm, 19), false);
  b.alm.creadorVigente = revisar;
  assert.equal(await wsDeTokenCon(b.alm, nuevo), 19, 'la revocación se llevó puesto el token recién rotado por la dueña');
});

test('cableado del token: la ruta guarda el email, el almacén revisa al creador, y quitar el acceso revoca', () => {
  const ruta = sinComentarios(leer('../app/api/agente/token/route.ts'));
  assert.match(ruta, /rotarAgenteToken\(ws, alcance, sesion\.email \?\? ''\)/, 'el token se acuña sin guardar quién lo pidió');

  const agente = sinComentarios(leer('../lib/agente-token.ts'));
  assert.match(agente, /creadorVigente: \(ws, email, fresco\) => creadorVigente\(ws, email, fresco\)/, 'el almacén real no revisa al creador: con creador guardado, ningún token andaría');
  assert.match(agente, /cambiarSettingSi: \(ws, antes, despues\) =>/, 'sin compare-and-set la revocación no hace nada');
  assert.match(agente, /from '\.\/api-mako\/tokens-creador-vigente'/);
  // Las dos clases de token, con la MISMA lectura del creador.
  assert.match(sinComentarios(leer('../lib/api-mako/tokens.ts')), /import \{ creadorVigente \} from '\.\/tokens-creador-vigente';/);

  const agencia = sinComentarios(leer('../app/api/admin/agencia/route.ts'));
  assert.match(agencia, /if \(estado !== 'aprobado'\) await revocarAgenteTokenSiPerdioAcceso\(clienteWs\);/,
    'revocar una agencia no apaga el token que su admin acuñó desde la vista del cliente');

  for (const f of ['../app/api/admin/usuarios/route.ts', '../app/api/equipo/route.ts']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /actualizarUsuario\(objetivo\.id, \{ estado \}\);\s*if \(estado === 'suspendido'\) await revocarAgenteTokensDe\(objetivo\.email\);/, `${f}: suspender no revoca`);
    assert.match(src, /await eliminarUsuario\(objetivo\.id\);\s*await revocarAgenteTokensDe\(objetivo\.email\);/, `${f}: eliminar no revoca`);
  }
});

// ── 2. La línea de MaKo: cupo por workspace ─────────────────────────────────────

function topeFalso(opts: { roto?: boolean } = {}) {
  const casilleros = new Set<number>();
  const tocados = new Set<string>();
  const alm: AlmacenTope = {
    tocadoReciente: async (num) => tocados.has(num),
    reclamarCasillero: async (i) => {
      if (opts.roto) throw new Error('No pude guardar');
      if (casilleros.has(i)) return false;
      casilleros.add(i);
      return true;
    },
    marcar: async (num) => { tocados.add(num); },
  };
  return { alm, casilleros, tocados };
}

test('la línea de MaKo toca a lo sumo TOPE números nuevos por ventana y workspace', async () => {
  const t = topeFalso();
  const resultados: boolean[] = [];
  for (let i = 0; i < TOPE_LINEA_MAKO + 3; i++) resultados.push(await reclamarContactoLinea(t.alm, `54911000000${i}`));
  assert.equal(resultados.filter(Boolean).length, TOPE_LINEA_MAKO, 'un bucle de números distintos pasó el tope');
  assert.deepEqual(resultados.slice(TOPE_LINEA_MAKO), [false, false, false]);
  assert.ok(TOPE_LINEA_MAKO <= 10, 'el tope dejó de ser un tope');
});

test('volver a tocar el mismo número no gasta cupo; el CÓDIGO sí, cada vez', async () => {
  const t = topeFalso();
  assert.equal(await reclamarContactoLinea(t.alm, '5491122334455'), true);
  // Guardar la lista de destinatarios dos veces vuelve a «agregar» a los mismos.
  for (let i = 0; i < 10; i++) assert.equal(await reclamarContactoLinea(t.alm, '5491122334455'), true);
  assert.equal(t.casilleros.size, 1, 're-guardar la misma lista agotó el cupo de alguien que no hizo nada raro');
  // Reenviar el código es otro mensaje a esa persona: gasta.
  for (let i = 0; i < TOPE_LINEA_MAKO - 1; i++) assert.equal(await reclamarContactoLinea(t.alm, '5491122334455', { siempre: true }), true);
  assert.equal(await reclamarContactoLinea(t.alm, '5491122334455', { siempre: true }), false, 'el código se reenvía sin tope');
  // Sin número no hay contacto, y sin poder contar TIRA (quien llama no manda).
  assert.equal(await reclamarContactoLinea(topeFalso().alm, ''), false);
  await assert.rejects(reclamarContactoLinea(topeFalso({ roto: true }).alm, '5491100000000'));
});

test('cableado de la línea: el código va por DM y al grupo se entra recién verificado', () => {
  const src = sinComentarios(leer('../lib/mako-grupo.ts'));

  const enviar = bloque(src, 'export async function enviarCodigoVerificacion(');
  assert.ok(!/setNumeroDuenoYSync\(/.test(enviar), 'el código volvió a sumar al grupo un número sin verificar');
  assert.ok(!/enviarAlGrupoMaKo\(/.test(enviar), 'el código volvió a escribirse en el grupo (hay que sumar al número antes)');
  antes(enviar, 'prepararContacto(ws, num, { siempre: true })', 'enviarDmVozMaKo(', 'el DM sale antes de contar el cupo');

  const verificar = bloque(src, 'export async function verificarCodigoContacto(');
  antes(verificar, "if (codigo.trim() !== v.codigo) return", 'setNumeroDuenoYSync(', 'se suma al grupo antes de comprobar el código');
  antes(verificar, 'setNumeroDuenoYSync(', 'verificado: true', 'queda verificado aunque el grupo no salga');

  const sync = bloque(src, 'export async function setNumeroDuenoYSync(');
  antes(sync, 'prepararContacto(ws, crudo)', 'guardarNumeroDueno(ws', 'el número se guarda como dueño antes de validarlo y contarlo');

  const agregar = bloque(src, 'export async function agregarParticipanteGrupo(');
  antes(agregar, 'prepararContacto(ws, crudo)', 'sumarAlGrupo(', 'el alta sale sin pasar por el cupo');

  const invitar = bloque(src, 'export async function enviarInvitacionGrupo(');
  antes(invitar, 'cupoLinea(ws, num)', '/group/sendInvite/', 'la invitación (un DM) sale sin pasar por el cupo');
  antes(invitar, "reclamarEspaciado(ws, 'linea-mako-invitacion'", '/group/sendInvite/', 'la invitación sale una vez por intento, no una por número y ventana');

  const preparar = bloque(src, 'async function prepararContacto(');
  antes(preparar, 'numeroTieneWhatsApp(crudo)', 'cupoLinea(ws, num, opts.siempre)', 'un número que no existe gasta cupo');
  assert.match(preparar, /if \(!cupo\.ok\) return cupo;/);
});

// ── 3. El Archivero: el path y el SSRF ─────────────────────────────────────────

test('el path de un archivo subido es EXACTAMENTE el que acuñó upload-url', () => {
  const id = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';
  assert.equal(pathSubidoValido(5, id, `5/${id}`), true);
  for (const malo of [
    `5/../7/${id}`, `5/./${id}`, `5//${id}`, `5/${id}/../../7/${id}`, `5/%2e%2e/7/${id}`,
    `7/${id}`, `/5/${id}`, `5/${id}/`, `5/${id}.pdf`, `5/${id}\n`, `05/${id}`,
  ]) assert.equal(pathSubidoValido(5, id, malo), false, `pasó «${malo}»`);
  // El fileId tiene que ser un UUID: si no, `${ws}/${fileId}` podría traer el `..` adentro.
  assert.equal(pathSubidoValido(5, '../7/x', '5/../7/x'), false);
  assert.equal(pathSubidoValido(5, '', '5/'), false);
  assert.equal(pathSubidoValido(0, id, `0/${id}`), false);
});

/** `validarDestino` de mentira: un DNS chico, y la misma regla (TODAS las IPs públicas). */
const DNS: Record<string, string[]> = { 'publico.com': ['93.184.216.34'], 'otro-publico.com': ['93.184.216.35'], 'localtest.me': ['127.0.0.1'], 'x.127.0.0.1.nip.io': ['127.0.0.1'] };
const privada = (ip: string) => /^(127\.|10\.|192\.168\.|169\.254\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip);
function depsFalsos(respuestas: Record<string, { status: number; location?: string }>) {
  const pedidos: string[] = [];
  const validados: string[] = [];
  const deps: DepsBajada = {
    validar: async (raw) => {
      validados.push(raw);
      const u = new URL(raw);
      const ips = /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) ? [u.hostname] : DNS[u.hostname];
      if (!ips) return { ok: false, error: 'No se pudo resolver el dominio.' };
      if (ips.some(privada)) return { ok: false, error: 'Esa dirección apunta a una red interna, no a una página pública.' };
      return { ok: true, url: u, ips };
    },
    pedir: async (url) => {
      pedidos.push(url.toString());
      const r = respuestas[url.toString()] ?? { status: 404 };
      return { status: r.status, location: r.location ?? null, cuerpo: Buffer.from('<title>ok</title>') };
    },
  };
  return { deps, pedidos, validados };
}

test('SSRF: un redirect hacia una IP interna se revalida y NO se pide', async () => {
  const f = depsFalsos({ 'https://publico.com/': { status: 302, location: 'http://127.0.0.1:8080/admin' } });
  await assert.rejects(bajarWebSegura('https://publico.com/', f.deps), /red interna/);
  assert.deepEqual(f.pedidos, ['https://publico.com/'], 'el server le pidió la página a una IP interna');
  assert.equal(f.validados.length, 2, 'el segundo salto no se validó');

  // Un nombre público que resuelve a loopback (lo que el chequeo de texto dejaba pasar).
  for (const u of ['http://localtest.me:3000/', 'http://x.127.0.0.1.nip.io/']) {
    const g = depsFalsos({});
    await assert.rejects(bajarWebSegura(u, g.deps), /red interna/);
    assert.deepEqual(g.pedidos, []);
  }

  // Un redirect entre públicos se sigue; y se corta si son demasiados.
  const h = depsFalsos({ 'https://publico.com/': { status: 301, location: 'https://otro-publico.com/' }, 'https://otro-publico.com/': { status: 200 } });
  const ok = await bajarWebSegura('https://publico.com/', h.deps);
  assert.equal(ok.status, 200);
  assert.equal(ok.final, 'https://otro-publico.com/');
  const bucle = depsFalsos({ 'https://publico.com/': { status: 302, location: '/' } });
  await assert.rejects(bajarWebSegura('https://publico.com/', bucle.deps), /demasiadas veces/);
});

/** Un server local que contesta `cuerpo` a cualquier cosa. */
async function serverLocal(cuerpo: Buffer): Promise<{ puerto: number; cerrar: () => Promise<void> }> {
  const s = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(cuerpo); });
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return { puerto: (s.address() as AddressInfo).port, cerrar: () => new Promise<void>((r) => s.close(() => r())) };
}

test('la conexión va a la IP VALIDADA, no a la que resolvería el nombre (sin rebinding)', async () => {
  const s = await serverLocal(Buffer.from('<title>clavada</title>'));
  try {
    // `.invalid` no resuelve NUNCA (RFC 6761): si el pedido llega, es porque usó la IP clavada.
    const r = await pedirClavado(new URL(`http://no-resuelve.invalid:${s.puerto}/`), ['127.0.0.1']);
    assert.equal(r.status, 200);
    assert.match(r.cuerpo.toString('utf8'), /clavada/);
  } finally { await s.cerrar(); }
});

test('el techo de 3 MB se aplica MIENTRAS se lee', async () => {
  const s = await serverLocal(Buffer.alloc(MAX_BYTES_WEB + 1024 * 1024, 'a'));
  try {
    const r = await pedirClavado(new URL(`http://no-resuelve.invalid:${s.puerto}/`), ['127.0.0.1']);
    assert.equal(r.cuerpo.length, MAX_BYTES_WEB);
  } finally { await s.cerrar(); }
});

test('cableado del Archivero: la ruta usa las dos barandas', () => {
  const src = sinComentarios(leer('../app/api/onboarding/archivero/route.ts'));
  const directo = bloque(src, 'async function procesarDirecto(');
  assert.match(directo, /if \(!pathSubidoValido\(ws, fileId, path\)\) return/, 'el path del archivo subido volvió a aceptarse con un prefijo');
  assert.ok(!/startsWith\(`\$\{ws\}\/`\)/.test(directo), 'volvió la guarda por prefijo, que deja pasar `..`');

  const web = bloque(src, 'async function fetchWebText(');
  assert.match(web, /bajarWebSegura\(url, \{ validar: validarDestino, pedir: pedirClavado \}\)/);
  assert.ok(!/\bfetch\(/.test(web), 'la web pegada volvió a bajarse con fetch, que resuelve por su cuenta');
  assert.ok(!/redirect: 'follow'/.test(web), 'los redirects volvieron a seguirse sin revalidar');
  assert.match(src, /import \{ validarDestino \} from '@\/lib\/landing-fetch';/);
});
