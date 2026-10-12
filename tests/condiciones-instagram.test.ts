// =============================================================================
// Condiciones de Instagram y Messenger (duodécima tanda, 12/10/2026)
// =============================================================================
// Pedido de Martín (prueba con Fiesta Music, ws10): condiciones para lo que pasa por Instagram y
// Messenger. Lo que este archivo fija, y por qué cada cosa:
//
//   · «Tiene Instagram / Messenger» = tenemos su conversación por ese canal. Sin fila, «no»; sin la
//     fuente leída, «no sé» (que no se cumple ni negado);
//   · «Se le puede escribir por …» es `decidirSalida(...).via !== null`, la MISMA función del envío:
//     ventana de 24 h abierta, o la respuesta privada a un comentario de menos de 7 días sin usar;
//   · «Te sigue en Instagram» es true / false SÓLO si Meta lo confirma. Quien no escribió, cualquier
//     `unavailableReason` o una cuenta de Zernio con 401/402 es «no sé»; lo pasajero TIRA;
//   · la fila que cuenta (dos cuentas de Instagram) la elige UNA regla, para el envío y la condición;
//   · las secciones nuevas en las dos listas y el origen Instagram / Messenger;
//   · el cableado del motor (`server-only`, así que sobre el FUENTE): una lectura por lote, el
//     workspace explícito, la concurrencia de 4, `refresh=false` y lo que tira.
//
// PROBADO ROMPIÉNDOLO (12/10/2026), con un arnés que restaura DE MEMORIA, una rotura por vez
// (scratchpad/wf-duodecima/ig-condiciones/romper.mjs). Base en verde: este archivo 17 pass / 0 fail. Cada
// rotura y lo que dio (pasan / fallan); cayó EXACTAMENTE el test que la cuida:
//   1. `puedeEscribirle` devuelve `s[canal] != null` (tiene, en vez de decidirSalida)      -> 14 / 3
//      (la ventana cerrada, la respuesta privada y «lo mismo que el envío»)
//   2. `tieneConversacion` sin el bloque leído da false en vez de null                    -> 16 / 1
//   3. `seguimientoDe` ignora `unavailableReason`                                          -> 16 / 1
//   4. `seguimientoNoSe` cuenta el 429 como «no sé» (lo pasajero dejaría de tirar)         -> 16 / 1
//   5. `pedidoDeSeguimiento` no exige la conversación (consultaría a quien sólo comentó)   -> 16 / 1
//   6. `conTope` sin el tope (todos a la vez)                                              -> 16 / 1
//   7. `conversacionQueCuenta` toma la PRIMERA fila (la base, no el último mensaje)        -> 15 / 2
//   8. `hechosDelCatalogo` lee el seguimiento sin `pide('sigue')`                          -> 16 / 1
//   9. `estadosDeSeguimiento` traga toda falla (sin el `throw e`)                           -> 16 / 1
//  10. `sigue_instagram` sin la fuente 'social'                                            -> 16 / 1
//  11. el origen sin Instagram en `OPCIONES_FIJAS`                                          -> 16 / 1
//  12. «Instagram y Messenger» al final de la lista de adquisición                         -> 16 / 1
//      (y 18 / 1 en tests/condiciones-catalogo.test.ts, que fija las dos listas enteras)
// Restaurado: 17 / 0.
//
// Correr: node --import tsx --test tests/condiciones-instagram.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  condicionPorId, cumpleCatalogo, seccionesDeCondiciones, deValorOpcion, fuentesDeFilas, OPCIONES_FIJAS, textoCondicion,
  type HechosCatalogo,
} from '../lib/condiciones-catalogo';
import {
  decidirSalida, conversacionQueCuenta, conversacionesPorLead, conversacionDeFila, pedidoDeSeguimiento, seguimientoDe,
  seguimientoNoSe, conTope, CONCURRENCIA_SEGUIMIENTO, CANALES_SOCIALES, VENTANA_COMENTARIO_MS,
  type ConversacionSocial, type FilaConversacionSocial,
} from '../lib/canal-social';
import type { HechosLead, FilaCondicion } from '../lib/flujo-grafo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas ANTES que los bloques (AGENTS.md: un `/*` adentro de un `//` se come código).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, abre: string, cierra: string, tope: number): string => {
  const ini = src.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = src.indexOf(cierra, ini + abre.length);
  assert.ok(fin > ini, `no encontré el cierre «${cierra}»`);
  const b = src.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};

const AHORA = Date.parse('2026-10-12T12:00:00Z');
const HORA = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const H = (catalogo?: HechosCatalogo): HechosLead => ({
  etiquetas: new Set(), etapa: null, agendo: false, pago: false, yaContactado: false, respondio: false,
  creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: AHORA, ...(catalogo ? { catalogo } : {}),
});
const conv = (o: Partial<ConversacionSocial> = {}): ConversacionSocial => ({
  conversacionId: 'conv_1', cuentaId: 'acc_1', ventanaExpiraAt: null, comentarioId: null, comentarioPostId: null,
  comentarioAt: null, comentarioRespondidoAt: null, ...o,
});
const fila = (o: Partial<FilaConversacionSocial> = {}): FilaConversacionSocial => ({
  id: 1, lead_id: 10, plataforma: 'instagram', zernio_conversation_id: 'conv_1', zernio_account_id: 'acc_1', igsid: '1790000000000001',
  username: 'ana', ventana_expira_at: null, comentario_id: null, comentario_post_id: null, comentario_at: null,
  comentario_respondido_at: null, ultimo_mensaje_at: null, ...o,
});
/** ¿Se cumple, y se cumple negada? `[false, false]` = «no sé». */
const ambas = (campo: string, h: HechosLead): [boolean, boolean] => [
  cumpleCatalogo({ campo } as FilaCondicion, h), cumpleCatalogo({ campo, no: true } as FilaCondicion, h),
];
const NO_SE: [boolean, boolean] = [false, false];

// ── Tiene Instagram / Messenger ─────────────────────────────────────────────────

test('«Tiene Instagram / Messenger»: con fila sí, sin fila no, y sin la fuente leída «no sé»', () => {
  const h = H({ social: { instagram: conv(), messenger: null } });
  assert.deepEqual(ambas('tiene_instagram', h), [true, false]);
  assert.deepEqual(ambas('tiene_messenger', h), [false, true], 'sin conversación de Messenger: «Sin Messenger» se cumple');
  // Sin el bloque (la fuente no se leyó): ni «Tiene» ni «Sin». Afirmar «Sin Instagram» sin leer es inventar.
  assert.deepEqual(ambas('tiene_instagram', H()), NO_SE);
  assert.deepEqual(ambas('tiene_messenger', H({})), NO_SE);
  // Quien sólo comentó también «tiene Instagram»: hay una conversación (su fila), aunque no un DM.
  assert.deepEqual(ambas('tiene_instagram', H({ social: { instagram: conv({ conversacionId: null, comentarioId: 'c1' }), messenger: null } })), [true, false]);
  assert.equal(textoCondicion({ campo: 'tiene_instagram' }), 'Tiene Instagram');
  assert.equal(textoCondicion({ campo: 'tiene_messenger', no: true }), 'Sin Messenger');
});

// ── Se le puede escribir ─────────────────────────────────────────────────────────

test('«Se le puede escribir por Instagram»: la ventana de 24 h abierta sí, cerrada no', () => {
  const abierta = H({ social: { instagram: conv({ ventanaExpiraAt: iso(AHORA + 2 * HORA) }), messenger: null } });
  assert.deepEqual(ambas('puede_escribir_instagram', abierta), [true, false]);
  const cerrada = H({ social: { instagram: conv({ ventanaExpiraAt: iso(AHORA - HORA) }), messenger: null } });
  assert.deepEqual(ambas('puede_escribir_instagram', cerrada), [false, true], 'pasaron 24 h: «No se le puede escribir» se cumple');
  // Sin conversación no hay por dónde: es «no», no «no sé». Sin la fuente, «no sé».
  assert.deepEqual(ambas('puede_escribir_messenger', abierta), [false, true]);
  assert.deepEqual(ambas('puede_escribir_instagram', H()), NO_SE);
  // Sin cuenta desde la que escribir, tampoco sale (la regla del envío).
  assert.deepEqual(ambas('puede_escribir_instagram', H({ social: { instagram: conv({ cuentaId: null, ventanaExpiraAt: iso(AHORA + HORA) }), messenger: null } })), [false, true]);
});

test('«Se le puede escribir»: la respuesta privada a un comentario, una sola y dentro de los 7 días', () => {
  const comento = (hace: number, respondido: string | null = null) => H({
    social: {
      instagram: conv({ conversacionId: null, comentarioId: 'c1', comentarioPostId: 'p1', comentarioAt: iso(AHORA - hace), comentarioRespondidoAt: respondido }),
      messenger: null,
    },
  });
  assert.deepEqual(ambas('puede_escribir_instagram', comento(6 * 24 * HORA)), [true, false], 'comentó hace 6 días: sale la respuesta privada');
  assert.deepEqual(ambas('puede_escribir_instagram', comento(VENTANA_COMENTARIO_MS + HORA)), [false, true], 'a los 7 días ya no');
  assert.deepEqual(ambas('puede_escribir_instagram', comento(HORA, iso(AHORA - 1000))), [false, true], 'la respuesta privada ya se usó');
});

test('«Se le puede escribir» contesta LO MISMO que el envío (`decidirSalida`), caso por caso', () => {
  const casos: ConversacionSocial[] = [
    conv({ ventanaExpiraAt: iso(AHORA + HORA) }),
    conv({ ventanaExpiraAt: iso(AHORA - HORA) }),
    conv({ ventanaExpiraAt: 'no-es-fecha' }),
    conv({ conversacionId: null, comentarioId: 'c', comentarioPostId: 'p', comentarioAt: iso(AHORA - HORA) }),
    conv({ conversacionId: null, comentarioId: 'c', comentarioPostId: null, comentarioAt: iso(AHORA - HORA) }),
    conv({ cuentaId: '  ', ventanaExpiraAt: iso(AHORA + HORA) }),
  ];
  for (const canal of CANALES_SOCIALES) {
    for (const c of casos) {
      const esperado = decidirSalida(c, AHORA, canal).via !== null;
      const h = H({ social: { instagram: canal === 'instagram' ? c : null, messenger: canal === 'messenger' ? c : null } });
      assert.equal(cumpleCatalogo({ campo: `puede_escribir_${canal}` } as FilaCondicion, h), esperado, `${canal} ${JSON.stringify(c)}`);
    }
  }
});

// ── Te sigue en Instagram ────────────────────────────────────────────────────────

test('«Te sigue en Instagram»: sí y no sólo si Meta lo confirmó; null y ausente son «no sé»', () => {
  assert.deepEqual(ambas('sigue_instagram', H({ sigueInstagram: true })), [true, false]);
  assert.deepEqual(ambas('sigue_instagram', H({ sigueInstagram: false })), [false, true]);
  assert.deepEqual(ambas('sigue_instagram', H({ sigueInstagram: null })), NO_SE, 'no sé: ni la rama «sí» ni «No te sigue»');
  assert.deepEqual(ambas('sigue_instagram', H({})), NO_SE, 'no se leyó');
  assert.equal(textoCondicion({ campo: 'sigue_instagram', no: true }), 'No te sigue en Instagram');
});

test('la respuesta de Zernio: true / false sólo sin `unavailableReason`; todo lo demás «no sé»', () => {
  assert.equal(seguimientoDe({ userId: '1', accountId: 'a', isFollower: true, unavailableReason: null }), true);
  assert.equal(seguimientoDe({ isFollower: false }), false);
  assert.equal(seguimientoDe({ isFollower: null, unavailableReason: 'consent_required' }), null, 'nunca le escribió');
  assert.equal(seguimientoDe({ isFollower: true, unavailableReason: 'error' }), null, 'una falla de Meta que ya vino en un 200');
  assert.equal(seguimientoDe({ isFollower: false, unavailableReason: 'dm_access_disabled' }), null);
  assert.equal(seguimientoDe({ isFollower: 'true' }), null);
  assert.equal(seguimientoDe({}), null);
  assert.equal(seguimientoDe(null), null);
  assert.equal(seguimientoDe([true]), null);
});

test('los errores de Zernio: 4xx definitivos son «no sé»; 408/409/425/429 y 5xx tiran', () => {
  for (const s of [400, 401, 402, 403, 404, 410, 422]) assert.equal(seguimientoNoSe(s), true, `${s}`);
  for (const s of [0, 200, 408, 409, 425, 429, 500, 502, 503, 504]) assert.equal(seguimientoNoSe(s), false, `${s}`);
});

test('sólo se le pregunta a quien ESCRIBIÓ: con conversación, cuenta y su id', () => {
  assert.deepEqual(pedidoDeSeguimiento(fila()), { accountId: 'acc_1', igsid: '1790000000000001' });
  assert.equal(pedidoDeSeguimiento(fila({ zernio_conversation_id: null, comentario_id: 'c1' })), null, 'sólo comentó: Meta no contesta');
  assert.equal(pedidoDeSeguimiento(fila({ zernio_account_id: ' ' })), null);
  assert.equal(pedidoDeSeguimiento(fila({ igsid: null })), null);
  assert.equal(pedidoDeSeguimiento(null), null);
  assert.equal(pedidoDeSeguimiento(undefined), null);
});

test('`conTope`: de a 4 como mucho, todos una vez, y si una tira no arranca ninguna más', async () => {
  assert.equal(CONCURRENCIA_SEGUIMIENTO, 4);
  let vuelo = 0;
  let maximo = 0;
  const vistos: number[] = [];
  await conTope(Array.from({ length: 11 }, (_, i) => i), CONCURRENCIA_SEGUIMIENTO, async (x) => {
    vuelo++; maximo = Math.max(maximo, vuelo);
    await new Promise((r) => setTimeout(r, 2));
    vistos.push(x); vuelo--;
  });
  assert.equal(maximo, 4);
  assert.deepEqual([...vistos].sort((a, b) => a - b), Array.from({ length: 11 }, (_, i) => i));
  const arrancados: number[] = [];
  await assert.rejects(conTope(Array.from({ length: 20 }, (_, i) => i), 2, async (x) => {
    arrancados.push(x);
    await new Promise((r) => setTimeout(r, 1));
    if (x === 1) throw new Error('Zernio 503');
  }), /503/);
  assert.ok(arrancados.length < 20, `arrancaron ${arrancados.length}: después de la falla no se sigue`);
  await conTope([], 4, async () => { throw new Error('no debería correr'); });
});

// ── La fila que cuenta ───────────────────────────────────────────────────────────

test('la fila que cuenta: la del último mensaje; sin mensaje va al final; a igual fecha, la más nueva', () => {
  const vieja = fila({ id: 1, ultimo_mensaje_at: '2026-10-10T10:00:00Z' });
  const nueva = fila({ id: 2, ultimo_mensaje_at: '2026-10-11T10:00:00Z' });
  const sinMensaje = fila({ id: 9, ultimo_mensaje_at: null });
  assert.equal(conversacionQueCuenta([vieja, sinMensaje, nueva])?.id, 2);
  assert.equal(conversacionQueCuenta([sinMensaje, vieja])?.id, 1, 'la que nunca tuvo mensaje va al final');
  assert.equal(conversacionQueCuenta([fila({ id: 3, ultimo_mensaje_at: null }), sinMensaje])?.id, 9);
  assert.equal(conversacionQueCuenta([fila({ id: 4, ultimo_mensaje_at: '2026-10-11T10:00:00Z' }), nueva])?.id, 4, 'empate: id mayor');
  assert.equal(conversacionQueCuenta([]), null);
});

test('por lead y canal: facebook es Messenger, y una fila sin lead o de otra plataforma no cuenta', () => {
  const m = conversacionesPorLead([
    fila({ id: 1, lead_id: 10, plataforma: 'instagram', ultimo_mensaje_at: '2026-10-10T10:00:00Z' }),
    fila({ id: 2, lead_id: '10', plataforma: 'instagram', ultimo_mensaje_at: '2026-10-11T10:00:00Z' }),
    fila({ id: 3, lead_id: 10, plataforma: 'facebook' }),
    fila({ id: 4, lead_id: 11, plataforma: 'facebook' }),
    fila({ id: 5, lead_id: null, plataforma: 'instagram' }),
    fila({ id: 6, lead_id: 12, plataforma: 'tiktok' }),
  ]);
  assert.deepEqual([...m.keys()].sort(), [10, 11]);
  assert.equal(m.get(10)?.instagram?.id, 2);
  assert.equal(m.get(10)?.messenger?.id, 3);
  assert.equal(m.get(11)?.instagram, undefined);
  assert.equal(conversacionDeFila(fila({ ventana_expira_at: 'x' })).ventanaExpiraAt, 'x');
});

// ── Lo que se ofrece ─────────────────────────────────────────────────────────────

test('las secciones nuevas, en las DOS listas: «Instagram y Messenger» después de «Mensajes»', () => {
  for (const ambito of ['adquisicion', 'entrega'] as const) {
    const s = seccionesDeCondiciones(ambito, {});
    const titulos = s.map((x) => x.title);
    const i = titulos.indexOf('Instagram y Messenger');
    assert.ok(i > 0 && titulos[i - 1] === 'Mensajes', `${ambito}: ${titulos.join(' · ')}`);
    assert.deepEqual(s[i].options.map((o) => o.label), [
      'Se le puede escribir por Instagram', 'No se le puede escribir por Instagram',
      'Se le puede escribir por Messenger', 'No se le puede escribir por Messenger',
      'Te sigue en Instagram', 'No te sigue en Instagram',
    ]);
    const info = s.find((x) => x.title === 'Información del lead')!.options.map((o) => deValorOpcion(o.value)?.id);
    const k = info.lastIndexOf('tiene_email');   // «Tiene email» y «Sin email»: la última
    assert.deepEqual(info.slice(k + 1, k + 5), ['tiene_instagram', 'tiene_instagram', 'tiene_messenger', 'tiene_messenger'], `${ambito}: al lado de «Tiene email»`);
  }
  for (const id of ['tiene_instagram', 'tiene_messenger', 'puede_escribir_instagram', 'puede_escribir_messenger', 'sigue_instagram']) {
    assert.equal(condicionPorId(id)?.ambito, 'ambos', id);
  }
  // La doc de Zernio no define el número de seguidores ni la verificación: no se ofrecen.
  for (const archivo of ['../lib/condiciones-catalogo.ts', '../lib/canal-social.ts', '../lib/zernio.ts']) {
    assert.doesNotMatch(sinComentarios(leer(archivo)), /followerCount|isVerified/, archivo);
  }
});

test('las fuentes: «Te sigue» pide la conversación y el seguimiento; las otras, sólo la conversación', () => {
  assert.deepEqual([...fuentesDeFilas([{ campo: 'sigue_instagram' }])].sort(), ['lead', 'sigue', 'social']);
  for (const campo of ['tiene_instagram', 'tiene_messenger', 'puede_escribir_instagram', 'puede_escribir_messenger']) {
    assert.deepEqual([...fuentesDeFilas([{ campo }])].sort(), ['lead', 'social'], campo);
  }
});

test('el origen: Instagram y Messenger son los valores que escribe `createLead` desde Zernio', () => {
  const origen = OPCIONES_FIJAS.origen ?? [];
  for (const canal of CANALES_SOCIALES) assert.ok(origen.some((o) => o.value === canal), `falta ${canal}`);
  assert.deepEqual(origen.filter((o) => (CANALES_SOCIALES as readonly string[]).includes(o.value)).map((o) => o.label), ['Instagram', 'Messenger']);
  assert.match(sinComentarios(leer('../lib/zernio-entrante.ts')), /origen_lead: e\.canal,/);
  const lead = (origen: string): HechosCatalogo => ({ lead: {
    origen, estado: 'abierto', calificado: null, deFormularioMeta: false, conVisitante: false, campana: null, emailBaja: false,
    ventaTipo: null, tieneFechaAgenda: false, r1: { fechaMs: null, asistio: null }, r2: { fechaMs: null, asistio: null },
    cerro: null, tieneFechaCierre: false, confirmoCompra: false, proximaReunionMs: null,
  } });
  assert.equal(cumpleCatalogo({ campo: 'origen', valor: 'instagram' }, H(lead('instagram'))), true);
  assert.equal(cumpleCatalogo({ campo: 'origen', valor: 'messenger' }, H(lead('instagram'))), false);
  assert.equal(textoCondicion({ campo: 'origen', valor: 'messenger' }), 'Origen: Messenger');
});

// ── El cableado del motor (módulos `server-only`: sobre el FUENTE) ───────────────

test('el motor: una lectura por lote, «te sigue» sólo si se pide y con el workspace de la corrida', () => {
  const src = sinComentarios(bloque(leer('../lib/nutricion.ts'), 'async function hechosDelCatalogo(', '\n// ── Los HILOS de una inscripción', 20_000));
  assert.match(src, /pide\('social'\) \|\| pide\('sigue'\) \? conversacionesDeLeads\(ids\) : null/);
  const sigue = bloque(src, 'const leerSigue', 'const [vsl', 600);
  assert.match(sigue, /if \(!pide\('sigue'\) \|\| !s\) return null;/);
  assert.match(sigue, /const ws = await getWorkspaceActual\(\);\n\s+if \(ws == null\) throw/, 'sin workspace no se adivina: tira');
  assert.match(sigue, /return siguenEnInstagram\(ws, s\);/);
  assert.match(src, /c\.social = \{ instagram: s\?\.instagram \? conversacionDeFila\(s\.instagram\) : null, messenger: s\?\.messenger \? conversacionDeFila\(s\.messenger\) : null \};/);
  assert.match(src, /if \(sigue\) c\.sigueInstagram = sigue\.get\(f\.id\) \?\? null;/, 'quien no se consultó es «no sé»');
});

test('canal-zernio: el envío y las condiciones eligen la fila con la MISMA regla; sólo se consulta a quien escribió', () => {
  const src = sinComentarios(leer('../lib/canal-zernio.ts'));
  const de = bloque(src, 'async function conversacionDe(', '\n}\n', 900);
  // Decimocuarta tanda: con la cuenta de la tarjeta, sólo sus filas; sin ella, conversacionQueCuenta (lib/canal-social.ts).
  assert.match(de, /return conversacionDelPaso\(\(data \?\? \[\]\) as FilaConversacionSocial\[\], cuenta\);/);
  assert.match(leer('../lib/canal-social.ts'), /if \(!cuenta\) return conversacionQueCuenta\(filas\);/);
  assert.doesNotMatch(de, /\.limit\(1\)/, 'el corte de la base elegía su propia fila');
  const lote = bloque(src, 'export async function conversacionesDeLeads(', '\n}\n', 900);
  assert.match(lote, /for \(const tanda of enTandas\(/);
  assert.match(lote, /leerTodo<FilaConversacionSocial>\(db, 'ig_conversaciones', COLS_CONVERSACION_SOCIAL/);
  assert.match(lote, /return conversacionesPorLead\(filas\);/);
  const sig = bloque(src, 'export async function siguenEnInstagram(', '\n}\n', 900);
  assert.match(sig, /pedidoDeSeguimiento\(c\.instagram\)/);
  assert.match(sig, /return estadosDeSeguimiento\(ws, pedidos\);/);
});

test('zernio: GET follow-status con refresh=false, tiempo propio, de a 4, y lo pasajero TIRA', () => {
  const src = sinComentarios(leer('../lib/zernio.ts'));
  const consultar = bloque(src, 'async function consultarSeguimiento(', '\n}\n', 700);
  assert.match(consultar, /`\/accounts\/\$\{encodeURIComponent\(accountId\)\}\/follow-status\/\$\{encodeURIComponent\(igsid\)\}\?refresh=false`/);
  assert.match(consultar, /TIMEOUT_SEGUIMIENTO_MS\)/);
  assert.match(consultar, /return seguimientoDe\(r\);/);
  assert.match(src, /async function keyDeSeguimiento\(ws: number\)[^{]*\{\n\s+return \(await credWsEstricta\('ZERNIO_API_KEY', ws\)\)/, '«no pude leer la key» no es «no tiene Zernio»');
  const lote = bloque(src, 'export async function estadosDeSeguimiento(', '\n}\n', 1_500);
  assert.match(lote, /await conTope\(pedidos, CONCURRENCIA_SEGUIMIENTO,/);
  assert.match(lote, /if \(!\(e instanceof ZernioError\) \|\| !seguimientoNoSe\(e\.status\)\) throw e;/);
  assert.match(lote, /if \(e\.status === 401 \|\| e\.status === 402\) cuentaCaida = true;/);
  assert.match(src, /signal: AbortSignal\.timeout\(timeoutMs\)/);
});
