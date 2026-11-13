// =============================================================================
// Hijo de tests/comprobante-en-la-app.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El comprobante que una agencia manda por el grupo de la APP, de punta a punta: el POST real con su sesión, el autollamado al cron real SIN sesión y el turno real. Lo único de mentira, además del
// arnés (tests/_grupos-ops-arnes.ts), es la lectura del comprobante (lib/agencia-mes-comprobante.ts): la escena dice si la agencia tiene la mensualidad prendida y si el archivo era un comprobante.

process.env.MAKO_DOER_VENTANA_MS = '0';
import { mock } from 'node:test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { db, comoPersona, correrDespues, decirResultado, escena, escenaNueva, aEvolution, alModelo, sesionDe, storage, usuario, OPENAI_NEGOCIO, PLATAFORMA } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const RAIZ = join(import.meta.dirname, '..');
const WS = 13, OTRO = 10, AJENO = 14;
const JID = '120363000000000013@g.us', JID_OTRO = '120363000000000010@g.us';

/** Lo que la escena le hace decir a la lectura del comprobante, y lo que le llegó. */
const lectura = { prendida: new Set<number>([WS]), atendido: true, llamadas: [] as Array<{ ws: number; id: string; bytes: number; png: boolean }> };
mock.module(pathToFileURL(join(RAIZ, 'lib/agencia-mes-comprobante.ts')).href, {
  namedExports: {
    hayQueLeerComprobante: async (ws: number) => lectura.prendida.has(ws),
    atenderComprobanteDeAgencia: async (p: { agenciaWs: number; waMensajeId: string; bytes: Uint8Array }) => {
      lectura.llamadas.push({ ws: p.agenciaWs, id: p.waMensajeId, bytes: p.bytes.byteLength, png: p.bytes[0] === 0x89 && p.bytes[1] === 0x50 });
      if (!lectura.atendido) return { atendido: false, que: 'no es un comprobante' };
      // Lo que contesta el código de verdad: `textoAlGrupoDeLaAgencia`, como equipo.
      const { enviarAlGrupoMaKo } = await import('../lib/mako-grupo');
      await enviarAlGrupoMaKo(p.agenciaWs, 'Recibí tu comprobante. Lo revisa el equipo de MaKo y te confirmo por aquí.', 'equipo');
      return { atendido: true, que: 'a Martín' };
    },
  },
});

const ANA = usuario(101, 'ana@codigo.test', 'Ana', WS, 'admin');
const BOB = usuario(102, 'bob@codigo.test', 'Bob', WS, 'admin');
const LEO = usuario(103, 'leo@otro.test', 'Leo', OTRO, 'admin');
const JOAN = usuario(201, 'joan@ajeno.test', 'Joan', AJENO, 'admin');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const clase = (c: string, resumen = 'lo que pide') => JSON.stringify({ clase: c, resumen, reenviado: false });

function limpiar() {
  for (const t of ['grupo_mensajes', 'mako_doer_conv', 'mako_doer_buffer', 'mako_doer_lock', 'mako_acciones_pendientes', 'tickets', 'ticket_eventos', 'insistencias', 'flujo_corridas']) db[t].splice(0);
  db.app_settings = db.app_settings.filter((f) => !String(f.key).startsWith('mako.doer.'));
  lectura.llamadas.splice(0);
  lectura.atendido = true;
}

async function main() {
  db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 1, capa: 'cliente', nombre: 'Dueño', estado: 'activo' },
    { id: WS, capa: 'agencia', nombre: 'Código', estado: 'activo' }, { id: OTRO, capa: 'cliente', nombre: 'Otro', estado: 'activo' }, { id: AJENO, capa: 'cliente', nombre: 'Ajeno', estado: 'activo' });
  db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID }, { workspace_id: OTRO, key: 'mako.grupo_jid', value: JID_OTRO }, { workspace_id: 1, key: 'mako.voz.instancia', value: 'mako_superadmin_x' });
  db.usuarios.push(ANA, BOB, LEO, JOAN);
  db.grupo_invitados.push({ workspace_id: WS, email: JOAN.email, usuario_id: JOAN.id, invito_usuario_id: 101, desde_id: 0, invitado_at: '2026-01-01T00:00:00.000Z', abrio_at: '2026-01-01T00:00:00.000Z', avisado_at: null, salio_at: null });
  const { cifrarSecreto } = await import('../lib/credenciales');
  for (const ws of [WS, OTRO]) db.credenciales.push({ workspace_id: ws, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI_NEGOCIO, ws, 'OPENAI_API_KEY'), servicio: 'openai' });

  const { NextRequest } = await import('next/server');
  const mensajes = await import('../app/api/grupos/[ws]/mensajes/route');
  const cron = await import('../app/api/cron/grupo-turno/route');
  const conCron = (req: Request) => cron.POST(new NextRequest(req.url, { method: req.method, headers: req.headers, body: (req as unknown as { body?: BodyInit }).body, duplex: 'half' } as never));
  escena.cron = conCron;

  /** Una persona manda una foto, con o sin texto, y corre lo de después de responder. */
  const foto = async (u: Record<string, unknown>, ws: number, campos: Record<string, string> = {}) => {
    const f = new FormData();
    f.append('archivo', new File([PNG], 'comprobante.png', { type: 'image/png' }));
    for (const [k, v] of Object.entries(campos)) f.append(k, v);
    const r = await comoPersona(sesionDe(u), () => mensajes.POST(new NextRequest(`https://hola-mako.com/api/grupos/${ws}/mensajes`, { method: 'POST', body: f }), { params: Promise.resolve({ ws: String(ws) }) }));
    const status = r.status;
    await correrDespues();
    return status;
  };
  const hilo = (ws = WS) => db.grupo_mensajes.filter((f) => f.workspace_id === ws).map((f) => ({ autor: f.autor_tipo, texto: f.texto, adjunto: (f.adjunto as { tipo?: string } | null)?.tipo ?? null }));
  const cola = () => db.mako_doer_buffer.map((f) => ({ id: f.wa_message_id, estado: f.estado, ws: f.workspace_id }));
  const out: Record<string, unknown> = {};

  // 1. La foto suelta del comprobante, en el grupo de la agencia: se lee, se contesta en el hilo, y el turno de MaKo no corre.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'No debería salir.' });
  const s1 = await foto(ANA, WS);
  out.suelta = { status: s1, llamadas: [...lectura.llamadas], hilo: hilo(), cola: cola(), modelo: alModelo().length, evolution: aEvolution() };

  // 2. Con «mako» en el texto y era un comprobante: tampoco hay turno (MaKo no contesta dos veces).
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'No debería salir.' });
  await foto(ANA, WS, { texto: 'mako, ahí va el pago de Nico Sellers' });
  out.nombrada = { llamadas: lectura.llamadas.length, hilo: hilo(), cola: cola(), modelo: alModelo().length };

  // 3. No era un comprobante y nombra a MaKo: entra a la cola y MaKo la mira, como siempre.
  limpiar(); lectura.atendido = false; escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Es una captura de la campaña.' });
  await foto(ANA, WS, { texto: 'mako, ¿qué ves en esta captura?' });
  out.noEra = { llamadas: lectura.llamadas.length, hilo: hilo(), cola: cola(), modelo: alModelo().length };

  // 4. No era un comprobante y es una foto suelta entre dos personas: MaKo no se mete (la regla del 3/11 no cambia).
  limpiar(); lectura.atendido = false; escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'No debería salir.' });
  await foto(BOB, WS);
  out.sueltaNoEra = { llamadas: lectura.llamadas.length, hilo: hilo(), cola: cola(), modelo: alModelo().length };

  // 5. Un invitado no paga nada: su foto no se lee como comprobante.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hola.' });
  await foto(JOAN, WS, { texto: 'mako, mirá' });
  out.invitado = { llamadas: lectura.llamadas.length };

  // 6. Un negocio sin la mensualidad: la foto con «mako» va derecho a la cola, sin leerla como comprobante.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Veo la foto.' });
  await foto(LEO, OTRO, { texto: 'mako, ¿qué ves?' });
  out.sinMensualidad = { llamadas: lectura.llamadas.length, hilo: hilo(OTRO), cola: cola(), modelo: alModelo().length };

  // 7. El autollamado no llega: lo que iba para MaKo entra a la cola igual (lo levanta doer-flush); lo que no, queda sólo en el hilo.
  limpiar(); lectura.atendido = false; escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hola.' });
  escena.cron = null;
  await foto(ANA, WS, { texto: 'mako, ¿qué ves?' });
  const conMaKo = cola();
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hola.' });
  await foto(BOB, WS);
  out.sinAutollamado = { conMaKo, suelta: cola() };
  escena.cron = conCron;

  void storage;
  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
