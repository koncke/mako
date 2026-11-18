// =============================================================================
// El núcleo de la API de MaKo: lo que quedaba sin hacer (F114 y F96, 18/11/2026)
// =============================================================================
// Correr: node --import tsx --test tests/api-mako-nucleo-1811.test.ts
//
// La tabla «Lo que quedó sin hacer en el núcleo» de docs/hallazgos-api-mako.md, punto por punto, con el código REAL:
//   · la idempotencia de una propuesta: una ACCIÓN aplicada no le gana a la misma pedida de nuevo (lib/propuestas-ref.ts);
//   · quién confirmó, en su propio campo del resultado (lib/api-mako/resultado-propuesta.ts);
//   · las confirmadas que se cortaron se cierran (lib/pendientes-colgadas.ts, `cerrarConfirmadasColgadas`), y reclamar tolera
//     la migración 0420 sin aplicar;
//   · una tool vieja que falla por nosotros lo dice como falla (`noCorrio` → isError), no como un dato;
//   · el link a UNA conversación de WhatsApp lo escribe el código (lib/respuesta-doer.ts, `conLinksDeAccion`);
//   · y de F96: lo subido que nunca se usó (lib/subidas-colgadas.ts).
// Lo que corre contra la base va en tests/_doer-falla-propia-hijo.ts.
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026). Base: 8 pass / 0 fail. Cada rotura, restaurada después:
//   · `refYaTomada` con una acción aplicada que bloquea (`return true`)                              → 7/1 (ref)
//   · `resultadoParaGuardar` con lo del runner encima (`{ ...datos, resumen, ok, por }` al revés)    → 7/1 (actor)
//   · `cerrarConfirmadasColgadas` sin el corte por vencimiento (las de antes de la 0420 no se cierran) → 7/1 (colgadas)
//   · `conColumnaNueva` sin el reintento (devuelve el primer intento siempre)                         → 7/1 (columna)
//   · `proponer_lead` sin `noCorrio` en su catch                                                     → 7/1 (falla nuestra)
//   · `LINK_CHAT_WHATSAPP` sin el último carácter que no es puntuación                                → 7/1 (link)
//   · `sinTrabajoQueLosNombre` que devuelve todos                                                    → 7/1 (subidas)
//   · un cambio sin efecto (renombrar `deEsta` en conLinksDeAccion)                                  → 8/0

import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { refYaTomada } from '../lib/propuestas-ref'
import { resultadoParaGuardar } from '../lib/api-mako/resultado-propuesta'
import { conColumnaNueva, faltaLaColumna, COLGADA_TRAS_MS, RESULTADO_COLGADA } from '../lib/pendientes-colgadas'
import { conLinksDeAccion } from '../lib/respuesta-doer'
import { comoFallaSiNoCorrio } from '../lib/doer-falla'
import { sinTrabajoQueLosNombre, viejosDeLaCarpeta, SUBIDA_SIN_USAR_TRAS_MS } from '../lib/subidas-colgadas'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))

type Hijo = {
  crudo: string
  regla: string
  refs: Record<'accion1' | 'accion2' | 'accion3' | 'lead1' | 'lead2', { id: string; nueva: boolean }>
  cerradas: number
  colgadas: Array<{ id: number; estado: string; resultado: string | null }>
  ia: string[]
}
let cache: Hijo | null = null
const hijo = (): Hijo => {
  if (cache) return cache
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_doer-falla-propia-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 280_000,
  })
  cache = JSON.parse(salida.slice(salida.indexOf('@@JSON@@') + 8, salida.indexOf('@@FIN@@'))) as Hijo
  return cache
}

test('ref: una acción aplicada no le gana a la misma pedida otra vez; un lead aplicado, sí; una pendiente siempre', () => {
  assert.equal(refYaTomada('accion', 'aplicada'), false, 'pedir de nuevo una acción ya hecha es un pedido nuevo')
  assert.equal(refYaTomada('lead', 'aplicada'), true, 'un lead aplicado ya está en el CRM: re-proponerlo lo duplica')
  assert.equal(refYaTomada('accion', 'pendiente'), true)
  assert.equal(refYaTomada('lead', 'pendiente'), true)
  assert.equal(refYaTomada('lead', 'descartada'), false)
  assert.equal(refYaTomada('accion', null), false)
  // El código real, contra la base de mentira.
  const r = hijo().refs
  assert.equal(r.accion2.nueva, true, 'la misma acción, aplicada la primera: se propone de nuevo')
  assert.notEqual(r.accion2.id, r.accion1.id)
  assert.deepEqual(r.accion3, { id: r.accion2.id, nueva: false }, 'mientras la segunda espera, un doble envío es la MISMA')
  assert.deepEqual(r.lead2, { id: r.lead1.id, nueva: false }, 'el lead aplicado sigue bloqueando')
  assert.deepEqual(hijo().ia, [], 'nada salió a la red')
})

test('actor: quién confirmó va en su campo, y lo del runner no lo pisa (ni el «salió bien» ni el texto)', () => {
  const g = resultadoParaGuardar({ ok: true, resumen: 'Listo', datos: { por: 'otro@x.test', ok: false, resumen: 'mentira', claseId: 7 } }, 'carla@estudio.test')
  assert.deepEqual(g, { resumen: 'Listo', ok: true, por: 'carla@estudio.test', datos: { por: 'otro@x.test', ok: false, resumen: 'mentira', claseId: 7 } })
  assert.deepEqual(resultadoParaGuardar({ ok: false, resumen: 'No se pudo' }, undefined), { resumen: 'No se pudo', ok: false, por: null }, 'sin datos, sin la clave')
  assert.deepEqual(resultadoParaGuardar({ ok: true, resumen: 'Listo', datos: {} }, null), { resumen: 'Listo', ok: true, por: null })
})

test('colgadas: se cierran las cortadas (por su reclamo o su vencimiento) y nada más', () => {
  const h = hijo()
  const estado = new Map(h.colgadas.map((c) => [c.id, c]))
  assert.equal(h.cerradas, 2)
  assert.equal(estado.get(1)?.estado, 'error', 'reclamada hace más de 30 minutos y sin resultado')
  assert.equal(estado.get(1)?.resultado, RESULTADO_COLGADA)
  assert.equal(estado.get(3)?.estado, 'error', 'sin la hora del reclamo, vencida hace más de 30 minutos')
  assert.equal(estado.get(2)?.estado, 'confirmada', 'reclamada hace 5 minutos: puede estar corriendo')
  assert.equal(estado.get(4)?.estado, 'confirmada', 'vencida hace 10 minutos: todavía no')
  assert.equal(estado.get(5)?.estado, 'ejecutada', 'lo que terminó no se toca')
  assert.equal(estado.get(6)?.estado, 'pendiente', 'lo que nadie reclamó no se toca')
  assert.ok(COLGADA_TRAS_MS > 800_000, 'el margen tiene que pasar lo más largo que corre una confirmación (800 s)')
})

test('reclamar tolera la 0420 sin aplicar: con la columna que falta, repite sin ella', async () => {
  assert.equal(faltaLaColumna({ code: 'PGRST204', message: "Could not find the 'reclamada_at' column of 'mako_acciones_pendientes'" }), true)
  assert.equal(faltaLaColumna({ code: '42703', message: 'column "reclamada_at" does not exist' }), true)
  assert.equal(faltaLaColumna({ code: '23505', message: 'duplicate key' }), false)
  assert.equal(faltaLaColumna(null), false)
  const intentos: boolean[] = []
  const r = await conColumnaNueva(async (con) => {
    intentos.push(con)
    return con ? { data: null, error: { code: 'PGRST204', message: 'no column' } } : { data: [{ id: 1 }], error: null }
  })
  assert.deepEqual(intentos, [true, false])
  assert.deepEqual(r.data, [{ id: 1 }])
  const otro = await conColumnaNueva(async () => ({ data: null, error: { code: '57014', message: 'timeout' } }))
  assert.equal(otro.error?.code, '57014', 'otro error vuelve tal cual: no se reintenta a ciegas')
})

test('una tool vieja que falla por nosotros lo dice como falla (isError), y una regla sigue siendo regla', () => {
  const h = hijo()
  const falla = JSON.parse(h.crudo) as { ok: boolean; noCorrio?: boolean; error: string }
  assert.equal(falla.ok, false)
  assert.equal(falla.noCorrio, true, 'la propuesta no se guardó por la base: es nuestra')
  assert.deepEqual(comoFallaSiNoCorrio(h.crudo), { content: h.crudo, isError: true }, 'el doer la recibe con isError y deja ticket')
  assert.equal(comoFallaSiNoCorrio(h.regla), h.regla, 'la que falta el nombre es una guarda: texto, sin isError')
})

test('el link a UNA conversación de WhatsApp lo escribe el código, no el modelo', () => {
  const real = 'https://hola-mako.com/whatsapp?canal=no-oficial&chat=5215512345678%40s.whatsapp.net&linea=mako_ws3&ws=3'
  const bien = `Te dejé el borrador para Ana: ${real}.`
  assert.equal(conLinksDeAccion(bien, [real]), bien, 'bien copiado, con el punto de la frase: no se toca')
  const mal = conLinksDeAccion('Revísalo aquí: https://hola-mako.com/whatsapp?canal=no-oficial&chat=5215512345678%40s.whatsap.net', [real])
  assert.ok(mal.includes(real), 'el real tiene que estar')
  assert.equal(mal.match(/whatsapp\?/g)?.length, 1, 'el mal copiado (un jid de otra persona) sale')
  assert.ok(conLinksDeAccion('Listo, quedó el borrador.', [real]).endsWith(real), 'si no lo escribió, se agrega')
  // Cada familia por su lado: un /mako/revisar real no toca un link de chat del historial, y al revés.
  const revisar = 'https://hola-mako.com/mako/revisar/propmskimbc4s4b4h'
  const historial = 'Como te pasé ayer: /whatsapp?canal=no-oficial&chat=123%40s.whatsapp.net'
  assert.equal(conLinksDeAccion(`${historial}\n\nAquí: ${revisar}`, [revisar]), `${historial}\n\nAquí: ${revisar}`)
})

test('subidas: se borra lo de más de un día que ningún trabajo nombra; lo que espera en la cola, no', () => {
  const ahora = Date.parse('2026-11-18T12:00:00Z')
  const hace = (h: number) => new Date(ahora - h * 3_600_000).toISOString()
  const a = '11111111-1111-4111-8111-111111111111'
  const b = '22222222-2222-4222-8222-222222222222'
  const c = '33333333-3333-4333-8333-333333333333'
  const viejos = viejosDeLaCarpeta([
    { name: a, created_at: hace(30) }, { name: b, created_at: hace(48) }, { name: c, created_at: hace(2) },
    { name: 'carpeta', created_at: null }, { name: 'no-es-un-uuid', created_at: hace(90) },
  ], ahora)
  assert.deepEqual(viejos, [a, b], 'sólo los uuid de más de un día')
  assert.deepEqual(sinTrabajoQueLosNombre(viejos, [b]), [a], 'b lo nombra un trabajo que espera: queda')
  assert.equal(SUBIDA_SIN_USAR_TRAS_MS, 24 * 3_600_000)
})

test('el cron que lo corre: con su puerta y registrado', async () => {
  const { readFileSync } = await import('node:fs')
  const ruta = readFileSync(join(RAIZ, 'app/api/cron/limpieza-colgados/route.ts'), 'utf8')
  assert.ok(ruta.indexOf('checkCronAuth(req)') > 0 && ruta.indexOf('checkCronAuth(req)') < ruta.indexOf('cerrarConfirmadasColgadas(ahora)'), 'la puerta, antes de todo')
  const crons = (JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8')) as { crons: Array<{ path: string }> }).crons
  assert.ok(crons.some((c) => c.path === '/api/cron/limpieza-colgados'), 'en vercel.json, o no corre nunca')
})
