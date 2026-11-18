// =============================================================================
// LA NOTA DE VOZ POR GRABAR (18/11/2026, F80) — cada puerta, EJECUTADA
// =============================================================================
// «Mándale un audio» en Crear con IA, con el negocio sin ese audio en la biblioteca. Hasta hoy la IA sacaba la nota de voz
// («Ese audio no está en tu biblioteca: el mensaje va como texto») y `setSecuenciaPasos` volvía texto toda tarjeta `tipo:
// 'audio'` sin su audio: al lead le salía escrito lo que tenía que ser una nota de voz. Lo que queda (lib/flujo-grafo.ts →
// `audioPorGrabar`):
//   1. se GUARDA como borrador y NO se PUBLICA (`validarGrafo` la frena: «Graba el audio de «X» antes de publicar»);
//   2. el motor no la manda NUNCA, ni como texto (`procesarEnvios`), y la ficha dice por qué (`porQueNoSale`);
//   3. la tarjeta dice «Audio por grabar» (BurbujaHilo, con el rótulo que le pasa el lienzo);
//   4. la IA la pide con `"audio": "grabar"` (`nodoDe`, sin el texto que le escribió), la revisión la acepta, y Crear la deja
//      en el BORRADOR (`crearConIA` → `guardarBorrador`), con su aviso primero.
// Lo que toca la base corre con el código real contra un PostgREST de mentira (tests/_email-campana-hijo.ts).
//
// Probado rompiéndolo (base 9 / 0; scratchpad automations-f79/romper-f80.py, cada rotura restaurada de memoria):
//   R1 sin la regla en `erroresDeForma` (publicar la deja pasar)                              → 7 / 2 (2 y 9)
//   R2 `audiosPorGrabar` ignorado (crear no la puede revisar)                                → 6 / 3 (2, 6 y 9)
//   R3 sin el corte del motor (`audioPorGrabar(paso)` en `procesarEnvios`)                   → 8 / 1 (9)
//   R4 sin la línea de `porQueNoSale`                                                       → 8 / 1 (3)
//   R5 `nodoDe` sin la marca «grabar» (vuelve «el mensaje va como texto»)                      → 7 / 2 (5 y 6)
//   R6 crear guarda con `guardarPasos` aunque lleve la nota por grabar                        → 8 / 1 (6)
//   R7 `setSecuenciaPasos` vuelve a degradar el audio sin id a texto                          → 8 / 1 (9)
//   R8 la burbuja ignora `rotuloSinAudio`                                                    → 8 / 1 (4)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { validarGrafo, validarParaGuardar, audioPorGrabar, claseDe, AUDIO_POR_GRABAR, NOTA_AUDIO_POR_GRABAR, type PasoGrafo } from '../lib/flujo-grafo';
import { errorLegible, frenoDelFlujo } from '../lib/flujo-conversacion';
import { porQueNoSale, type ContextoDelEnvio, type FilaQueEspera } from '../lib/por-que-no-sale';
import { deIA, validarIA, aIA, type CtxIA } from '../lib/flujo-ia';
import { crearConIA, AVISO_AUDIO_POR_GRABAR, type DepsCrearIA } from '../lib/flujo-ia-crear-core';
import { BurbujaHilo } from '../app/whatsapp/_shared/BurbujaHilo';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

/** Una tarjeta de mensaje con la nota de voz sin grabar, y lo que la rodea en un flujo de verdad. */
const porGrabar = (extra: Partial<PasoGrafo> = {}): PasoGrafo => ({ id: 't1', orden: 1, canal: 'whatsapp', tipo: 'audio', audio_id: null, cuerpo: '', siguiente: null, ...extra });
const flujo = (p: PasoGrafo): PasoGrafo[] => [p];

test('1. audioPorGrabar: tipo audio SIN su audio (null, 0, nada); un audio con id (aunque ya no esté) es otra cosa', () => {
  assert.equal(audioPorGrabar(porGrabar()), true);
  assert.equal(audioPorGrabar(porGrabar({ audio_id: 0 })), true);
  assert.equal(audioPorGrabar({ tipo: 'audio' }), true);
  assert.equal(audioPorGrabar(porGrabar({ audio_id: 7 })), false, 'un audio con id que no está en la biblioteca es «no disponible», no «por grabar»');
  assert.equal(audioPorGrabar({ tipo: 'texto', audio_id: null }), false);
  assert.equal(audioPorGrabar(null), false);
});

test('2. publicar la frena con su motivo en palabras de producto; guardar (y crear) la deja pasar', () => {
  const f = flujo(porGrabar());
  const errores = validarGrafo(f);
  assert.deepEqual(errores, ['graba el audio de la tarjeta t1 antes de publicar'], 'Publicar no frena la nota por grabar');
  assert.equal(errorLegible(errores[0], f), 'Graba el audio de «WHATSAPP» antes de publicar', 'el error no nombra la tarjeta como se ve');
  assert.deepEqual(validarParaGuardar(f), [], 'un borrador con la nota por grabar no se puede guardar');
  assert.deepEqual(validarGrafo(f, { audiosPorGrabar: true }), [], '`audiosPorGrabar` no la deja pasar');
  // El lienzo (Publicar y Probar) dice lo MISMO y abre esa tarjeta.
  assert.deepEqual(frenoDelFlujo(f), { error: 'Graba el audio de «WHATSAPP» antes de publicar', tarjeta: 't1' });
  // Con su audio, sale como siempre.
  assert.deepEqual(validarGrafo(flujo(porGrabar({ audio_id: 7 }))), []);
});

test('3. por qué no sale: lo dice la ficha, después del envío apagado y antes de la línea (el orden del motor)', () => {
  const ctx: ContextoDelEnvio = { ahoraMs: Date.parse('2026-11-18T15:00:00Z'), tz: 'America/Mexico_City', whatsappPrendido: true, linea: { dia: 50, usadoDia: 0, hora: 20, usadoHora: 0 } };
  const fila: FilaQueEspera = { proximoEnvioAt: '2026-11-19T15:00:00Z', automatizacionActiva: true, canal: 'whatsapp', hayLinea: false, horario: null, audioPorGrabar: true };
  assert.deepEqual(porQueNoSale(fila, ctx), { texto: 'No sale: la nota de voz de esta tarjeta todavía no está grabada.', corto: AUDIO_POR_GRABAR, saleAt: null });
  assert.equal(porQueNoSale(fila, { ...ctx, whatsappPrendido: false })?.corto, 'WhatsApp apagado', 'el envío apagado va primero');
  assert.equal(porQueNoSale({ ...fila, audioPorGrabar: false }, ctx)?.corto, 'Sin línea de WhatsApp');
});

test('4. la burbuja de la tarjeta dice «Audio por grabar», no «audio (no disponible)»', () => {
  const html = (audio: Parameters<typeof BurbujaHilo>[0]['contenido']['audio']) =>
    renderToStaticMarkup(createElement(BurbujaHilo, { compacta: true, saliente: true, contenido: { audio } }));
  const pg = html({ url: null, rotuloSinAudio: AUDIO_POR_GRABAR });
  assert.match(pg, /Audio por grabar/);
  assert.doesNotMatch(pg, /no disponible/);
  assert.match(html({ url: null, titulo: 'Bienvenida' }), /Bienvenida \(no disponible\)/, 'el audio que ya no está sigue diciendo eso');
});

const CTX: CtxIA = {
  etiquetas: [], productos: [], audios: [{ id: 4, titulo: 'Presentación' }], archivos: [], acciones: [],
  links: { agenda: { url: 'https://cal.com/elevate/llamada', para: 'agendar' } },
  disparadores: [{ value: 'venta:3:nuevo', label: 'Llega a «Nuevo»' }],
};
const pedidoDelModelo = (tarjeta: Record<string, unknown>) => ({ nombre: 'Bienvenida con audio', disparador: 'd1', inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', sigue: null, ...tarjeta }] });

test('5. la IA la pide con "audio": "grabar": queda sin texto (lo dice él al grabar) y con su link; la revisión la acepta', () => {
  const r = deIA(pedidoDelModelo({ canal: 'whatsapp', audio: 'grabar', texto: 'Hola, te cuento cómo trabajamos.', link: 'agenda' }), CTX);
  const m = r.pasos.find((p) => claseDe(p) === 'mensaje') as PasoGrafo | undefined;
  assert.ok(m, 'la tarjeta de la nota se perdió');
  assert.equal(audioPorGrabar(m), true, 'no quedó por grabar');
  assert.equal(m.cuerpo, 'https://cal.com/elevate/llamada', 'el texto que escribió la IA tiene que salir, el link queda');
  assert.ok(r.avisos.includes('Saqué el texto de la nota de voz: lo dices tú al grabarla'), r.avisos.join(' | '));
  assert.deepEqual(validarIA(r.pasos, CTX), [], 'la revisión la toma por un audio que no está en la biblioteca');
  // Un id de la biblioteca sigue siendo ese audio; por email no hay nota de voz (ni por grabar).
  const conId = deIA(pedidoDelModelo({ canal: 'whatsapp', audio: 4 }), CTX).pasos.find((p) => claseDe(p) === 'mensaje') as PasoGrafo;
  assert.equal(conId.audio_id, 4);
  const email = deIA(pedidoDelModelo({ canal: 'email', asunto: 'Hola', texto: 'Hola', audio: 'grabar' }), CTX);
  assert.ok(email.avisos.includes('Un email no lleva nota de voz: la saqué'), email.avisos.join(' | '));
  // Editar la ve como la pidió (`aIA`, lo que el modelo lee del flujo).
  assert.equal(aIA(r.pasos).tarjetas.find((t) => t.id === m.id)?.audio, 'grabar');
});

/** Dependencias de mentira que anotan qué se guardó y por dónde. */
function deps(tarjeta: Record<string, unknown>) {
  const ops: string[] = [];
  let borrador: PasoGrafo[] | null = null;
  let publicados: PasoGrafo[] = [];
  const d: DepsCrearIA = {
    contexto: async () => ({ ctx: CTX, perfil: 'Vendo mentorías.', voz: null }),
    system: async () => 'system',
    generar: async (p) => {
      const tr = p.traducir(pedidoDelModelo(tarjeta));
      assert.deepEqual(tr.errores, [], 'la revisión de crear frena el flujo de mentira');
      return { r: tr.r };
    },
    crearEtiquetas: async () => ({ ids: new Map(), creadas: [] }),
    filaDe: async () => ({ pasos: publicados, nombre: 'Bienvenida con audio' }),
    insertar: async (nombre) => { ops.push('insertar'); return { id: 500, nombre: String(nombre) }; },
    borrar: async () => { ops.push('borrar'); },
    pausar: async () => { ops.push('pausar'); },
    guardarPasos: async (_id, pasos) => { ops.push('publicar'); publicados = pasos; },
    guardarBorrador: async (_id, pasos) => { ops.push('borrador'); borrador = pasos; },
    borradorDe: async () => borrador,
    motivoDePasos: () => null,
    ponerDisparador: async () => { ops.push('cron'); },
    motivoDeDisparador: () => null,
    renombrar: async (_id, n) => n || null,
    guardarChat: async () => { ops.push('chat'); },
  };
  return { d, ops };
}

test('6. crear con la nota por grabar la deja en el BORRADOR (nunca publicada), con el aviso primero', async () => {
  const { d, ops } = deps({ canal: 'whatsapp', audio: 'grabar', link: 'agenda' });
  const r = await crearConIA({ ws: 3, pedido: 'Mándale un audio de bienvenida con el link de la agenda' }, d);
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(ops.includes('borrador') && !ops.includes('publicar'), `se publicó: ${ops.join(' → ')}`);
  assert.equal(r.borrador, true);
  assert.equal(audioPorGrabar(r.pasos.find((p) => claseDe(p) === 'mensaje')), true, 'lo que vuelve no es lo del borrador');
  assert.equal(r.avisos[0], AVISO_AUDIO_POR_GRABAR, r.avisos.join(' | '));
});

test('7. crear sin la nota por grabar publica como siempre (no toca el borrador)', async () => {
  const { d, ops } = deps({ canal: 'whatsapp', audio: 4 });
  const r = await crearConIA({ ws: 3, pedido: 'Mándale la presentación en audio' }, d);
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(ops.includes('publicar') && !ops.includes('borrador'), ops.join(' → '));
  assert.equal(r.borrador, undefined);
  assert.ok(!r.avisos.includes(AVISO_AUDIO_POR_GRABAR));
});

test('8. el motivo del motor es el que lee la ficha (`ultimoFallo`), en minúscula y sin punto', () => {
  assert.equal(NOTA_AUDIO_POR_GRABAR, 'la nota de voz de la tarjeta está por grabar');
});

// ── Lo que toca la base, con el código real ─────────────────────────────────────────────────
let resultado: Record<string, unknown> | null = null;
function hijo(): Record<string, unknown> {
  if (resultado) return resultado;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'tests/_email-campana-hijo.ts', 'audio-por-grabar'], {
    cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024,
  });
  const i = salida.lastIndexOf('@@RESULTADO@@');
  assert.ok(i >= 0, `el hijo no devolvió resultado:\n${salida.slice(-2000)}`);
  resultado = JSON.parse(salida.slice(i + '@@RESULTADO@@'.length)) as Record<string, unknown>;
  return resultado;
}

test('9. la base: publicar tira sin escribir; como borrador queda la nota (no un texto); el motor no la manda', () => {
  const r = hijo();
  assert.deepEqual(r.publicar, { invalido: true, mensaje: 'No se guardó: graba el audio de la tarjeta t1 antes de publicar.' });
  assert.deepEqual(r.pasosTrasPublicar, []);
  assert.deepEqual(r.pasosTrasBorrador, [], 'el borrador escribió lo publicado');
  assert.equal(r.baseEsLaDeVacio, true, 'el borrador no está armado sobre lo publicado vacío: la pantalla no lo abriría');
  assert.deepEqual(r.tarjetaDelBorrador, [{ tipo: 'audio', audio_id: null, cuerpo: 'Te dejo el link de la agenda' }], 'la nota de voz se volvió texto al guardar');
  assert.equal(r.seAbre, true);
  // El motor: falla con su motivo, vuelve a mirar mañana, y no le pidió nada a WhatsApp.
  assert.deepEqual(r.detalle, [{ estado: 'fallo', nota: NOTA_AUDIO_POR_GRABAR }]);
  assert.deepEqual(r.envios, [{ estado: 'fallo', error: NOTA_AUDIO_POR_GRABAR }]);
  assert.ok(Date.parse(String(r.proximo)) > Date.now() + 20 * 3600_000, `vuelve a intentar ${r.proximo}`);
  assert.deepEqual(r.otros, [], 'salió un pedido fuera de la base');
});
