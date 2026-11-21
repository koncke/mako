// =============================================================================
// Hijo de tests/agencia-pago-consulta.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre lo REAL de los dos arreglos del 20/11/2026 (Código Inmobiliario): `atenderComprobanteDeAgencia` (lib/agencia-mes-comprobante.ts) con
// la lectura del mensaje 1047 tal como quedó en producción, y `respuestaDelPagoDeLaAgencia` (lib/agencia-mes-consulta.ts) con la cuenta de
// Pablo Chavez en «Paga para entrar». Lo de mentira: la base, la lectura de la IA, Binance, lo que se manda al grupo y a Martín.

import { mock } from 'node:test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decirYSalir } from './_salir-cuando-salio';
import { diferencialDe } from '../lib/agencia-mes-reglas';

const RAIZ = join(import.meta.dirname, '..');
const url = (p: string) => pathToFileURL(join(RAIZ, p)).href;

/** Lo que salió: al grupo de la agencia, a Martín, y las lecturas guardadas. */
const salio = { grupo: [] as string[], martin: [] as string[], guardadas: 0, mensualidades: 0, esperas: 0 };
/** La lectura de la IA del mensaje 1047, tal como quedó en comprobantes_leidos (id 6, ws 13). */
const LECTURA_1047 = {
  esComprobante: true, monto: 23.5, moneda: 'USD', fecha: null, hora: null, medio: null, destinatario: 'Pablo Chavez', operacion: null,
  dudas: "No se ve la fecha completa de la operación, solo dice '15 días del 20/11 al 04/12'. No se especifica el medio de pago. Se menciona 'Vence hoy' pero sin fecha clara.",
};
const escena = { lectura: LECTURA_1047 as Record<string, unknown>, payId: null as string | null, config: true, ok: true };

const ENTRADA = diferencialDe('2026-11-20', 47);
const M = () => ({
  ok: escena.ok, error: 'la base no contestó', agenciaWs: 13, agencia: 'Codigo Inmobiliario', hoy: '2026-11-20', zona: 'America/Argentina/Buenos_Aires',
  config: escena.config ? { medio: 'Binance', desde: '2026-12', entradasDesde: '2026-11-06' } : null,
  agenciaEnPausa: false,
  clientes: [
    { ws: 17, nombre: 'Giselle Belanti', situacion: { tipo: 'cuenta', desde: '2026-11-16' } },
    { ws: 18, nombre: 'Pablo Chavez', situacion: { tipo: 'paga-para-entrar', vencio: '2026-11-11', entrada: ENTRADA } },
  ],
  pendientes: [{ tipo: 'entrada', ws: 18, nombre: 'Pablo Chavez', plan: 'esencial', entrada: ENTRADA, pagadoUsd: 0, debeUsd: ENTRADA.montoUsd, limite: '2026-11-20' }],
  libro: { ordenes: new Map() },
});

mock.module(url('lib/workspace.ts'), { namedExports: { runWithWorkspace: async (_ws: number, f: () => unknown) => f(), wsSuperAdmin: async () => 9 } });
// La base: sólo la espera del pago que todavía no se ve en Binance (`esperarElPago` la anota en los ajustes de la plataforma).
mock.module(url('lib/supabase.ts'), { namedExports: { getSupabaseServer: () => ({ from: () => ({ upsert: async () => { salio.esperas++; return { error: null }; } }) }) } });
mock.module(url('lib/comprobantes.ts'), {
  namedExports: {
    anotarAplicadoDelGrupo: async () => {},
    guardarLecturaDelGrupo: async () => { salio.guardadas++; return { ok: true, id: 6, repetido: false }; },
    lecturaPreviaDelGrupo: async () => null,
    leerArchivoComprobante: async () => ({ ok: true, lectura: escena.lectura, proveedor: 'anthropic' }),
    mimeDeComprobante: () => 'image/jpeg',
    ordenEnUnaLecturaDelGrupo: async () => false,
  },
});
mock.module(url('lib/agencia-mes.ts'), {
  namedExports: {
    aplicarPagoDeAgencia: async () => ({ ok: false, error: 'no se aplica en este hijo' }),
    avisarAMartin: async (t: string) => { salio.martin.push(t); },
    cerrarElPagoDeAgencia: async () => ({ recibo: null, activas: null, texto: '' }),
    mensualidadDeAgencia: async () => { salio.mensualidades++; return M(); },
    mensualidadPrendida: async () => true,
    textoAlGrupoDeLaAgencia: async (_ws: number, t: string) => { salio.grupo.push(t); },
  },
});
// Los datos de cobro como los carga el Cerebro el 20/11: con el checkout público de /planes APAGADO (Martín: «por ahora… todo por pasarela»).
// A la agencia se le dice igual a dónde pagar.
mock.module(url('lib/pago-directo.ts'), {
  namedExports: {
    leerDatosDePagoDirecto: async () => ({
      binancePayId: escena.payId, linkBinance: null, linkTransferencia: null, alias: null, cvu: null, titular: null, whatsapp: null, email: null, checkoutPublico: false,
    }),
  },
});
mock.module(url('lib/mako-pendientes.ts'), { namedExports: { crearPendiente: async () => ({ error: 'no en este hijo' }) } });
mock.module(url('lib/mako-grupo.ts'), { namedExports: { getGrupoSuperAdminJid: async () => null } });
mock.module(url('lib/grupo-salida.ts'), { namedExports: { claveDeLaApp: (ws: number) => `app:${ws}`, conSalidaDelGrupo: async (_o: unknown, f: () => unknown) => f() } });
mock.module(url('lib/recibos.ts'), { namedExports: { reciboDePago: async () => null, guardarComprobante: async () => ({ ok: false }) } });
// Binance contesta lo mismo que en producción el 20/11: 451, desde un lugar restringido.
mock.module(url('lib/binance-pay.ts'), { namedExports: { pagosRecibidosEnBinance: async () => ({ ok: false, error: 'Binance contestó 451: Service unavailable from a restricted location' }) } });

const limpiar = () => { salio.grupo.splice(0); salio.martin.splice(0); salio.guardadas = 0; salio.mensualidades = 0; salio.esperas = 0; escena.lectura = LECTURA_1047; escena.payId = null; escena.config = true; escena.ok = true; };
const PIE_1047 = 'mako aca me dice que Pablo Chavez para ponerlo como activo tiene que pagar USD 23,50, confirmame si esta bien';

async function main() {
  const { atenderComprobanteDeAgencia } = await import('../lib/agencia-mes-comprobante');
  const { respuestaDelPagoDeLaAgencia } = await import('../lib/agencia-mes-consulta');
  const foto = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
  const out: Record<string, unknown> = {};
  const atender = async (pie: string | null, id = '3EB0EEDBF42E8BBE2BC1C7') => {
    const r = await atenderComprobanteDeAgencia({ agenciaWs: 13, waMensajeId: id, bytes: foto, ...(pie != null ? { pie } : {}) });
    return { ...r, grupo: [...salio.grupo], martin: salio.martin.length, guardadas: salio.guardadas, esperas: salio.esperas };
  };

  // 1. El 1047: la captura de la app con la pregunta. Ni «Recibí tu comprobante», ni Martín, ni lectura guardada: sigue al turno.
  limpiar(); out.pregunta = await atender(PIE_1047);
  // 2. La MISMA captura sin texto: como siempre (un comprobante dudoso le llega a Martín; nunca se pierde en silencio).
  limpiar(); out.sinPie = await atender(null);
  // 3. Un comprobante de Binance de verdad (con su orden) que además pregunta: es un pago. Sigue como comprobante.
  limpiar(); escena.lectura = { ...LECTURA_1047, medio: 'Binance', operacion: '4660001999873228880', fecha: '2026-11-20', hora: '20:30', destinatario: 'Martin-Koncke', dudas: null };
  out.pagoConPregunta = await atender('mako ya pagué lo de Pablo Chavez, ¿me confirmas que llegó?');

  // 4. La consulta: la pregunta de Juan Francisco (1042), con el Pay ID cargado.
  limpiar(); escena.payId = '123456789';
  out.consulta = { texto: await respuestaDelPagoDeLaAgencia(13, 'pasame cuanto hay que pagar de Pablo Chavez para activar su cuenta'), mensualidades: salio.mensualidades };
  // 5. Sin Pay ID cargado (como está producción el 20/11): el medio, sin número.
  limpiar(); out.sinPayId = await respuestaDelPagoDeLaAgencia(13, 'pasame cuanto hay que pagar de Pablo Chavez para activar su cuenta');
  // 6. El pie del 1047, ya en el turno: lo confirma.
  limpiar(); out.confirma = await respuestaDelPagoDeLaAgencia(13, PIE_1047);
  // 7. Otra cosa: ni se lee la mensualidad.
  limpiar(); out.otra = { texto: await respuestaDelPagoDeLaAgencia(13, 'Carolina Cassab pasame'), mensualidades: salio.mensualidades };
  // 8. La mensualidad apagada, o no se pudo leer: sigue el turno de siempre.
  limpiar(); escena.config = false; out.apagada = await respuestaDelPagoDeLaAgencia(13, 'cuanto debo este mes');
  limpiar(); escena.ok = false; out.sinLeer = await respuestaDelPagoDeLaAgencia(13, 'cuanto debo este mes');
  // 9. Una cuenta que no es de la agencia (un lead del CRM): no la contesta el código.
  limpiar(); out.lead = await respuestaDelPagoDeLaAgencia(13, 'cuanto hay que pagar para activar la cuenta de Carolina Cassab');

  decirYSalir(`@@RESULTADO@@${JSON.stringify(out)}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
