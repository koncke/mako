// =============================================================================
// /api/grupos/[ws]/mensajes — el hilo del grupo de un negocio (3/11/2026)
// =============================================================================
// GET: el hilo (`?despues=`, `?antes=`). POST: lo que escribe una persona. El POST guarda y vuelve YA: dos personas tienen que poder escribir mientras MaKo piensa, y `/api/mako/chat`
// espera el turno hasta 420 s. La respuesta de MaKo llega por el sondeo.
//
// ⛔ NO VIVE EN `app/api/second-brain/`, QUE ES SÓLO DEL ADMIN, Y NO LEE `getWorkspaceActual`. El ws sale de la URL y la puerta lo autoriza para ESTA persona. Un invitado sigue parado en
// su negocio. A quien no le toca, 404: siempre el mismo.
//
// ⛔ EL TURNO DE MaKo NO CORRE EN ESTE PEDIDO: un `getUsuarioActual` adentro del turno vería a quien escribió, y `cobros.run` trataría el turno del Super Admin como suyo; un admin de OTRO
// negocio pasaría `adminDeWorkspaceActual` sobre este ws. El turno corre en otra invocación, sin cookies, como el del webhook: /api/cron/grupo-turno. tests/grupos-ops-turno.
//
// ⚠️ ESTA RUTA NO IMPORTA lib/mako-doer-in (lo fija el mismo test), y `encolar` usa `getTenantDb`: va adentro de `runWithWorkspace(ws)`, o la cola caería en el negocio de un invitado.

import { after, NextResponse, type NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { APP_BASE_URL, linkApp } from '@/lib/app-url';
import { runWithWorkspace } from '@/lib/workspace';
import { taparClaves, CLAVE_TAPADA } from '@/lib/claves-en-el-chat';
import { avisoClaveTapadaEnElGrupo, soloLaClave } from '@/lib/doer-claves';
import { esSoloEmoji } from '@/lib/reaccion-emoji';
import { esMp3, validarAdjuntos } from '@/lib/mako-adjuntos';
import { encolar, pendientes } from '@/lib/mako-doer-buffer';
import { acusarDesdeElGrupo } from '@/lib/insistencias';
import { accesoAlGrupo, miembrosDelGrupo, type PersonaDelGrupo } from '@/lib/grupo-puerta';
import { cartelParaLaApp } from '@/lib/grupo-salida';
import {
  anotarQueAbrio, avisarMiembros, borrarArchivoDelGrupo, claveDeConversacion, escribirDePersona, escribirSistema, filaParaPersona, guardarArchivoDelGrupo, hostsDeMaKo, leerHilo, mensajesDelDia,
} from '@/lib/grupo-app';
import {
  TOPE_MENSAJES_POR_MINUTO, TOPE_TURNOS_INVITADO_POR_DIA, filaAlHilo, leerParticipanteDeApp, msgDeFila, nombraAMaKoEnElTexto, tieneAudioLaFila, tieneMediaLaFila, type AdjuntoGrupo, type FilaGrupo,
} from '@/lib/grupo-reglas';

export const dynamic = 'force-dynamic';
// Sube archivos: nada más. El turno corre en otra invocación.
export const maxDuration = 60;

type Ctx = { params: Promise<{ ws: string }> };
const NO_EXISTE = () => NextResponse.json({ ok: false, error: 'No existe.' }, { status: 404 });
const entero = (v: string | null): number | null => {
  if (!v || !/^\d{1,15}$/.test(v)) return null;
  return Number(v);
};

export async function GET(req: NextRequest, { params }: Ctx) {
  const ws = entero((await params).ws);
  const quien = ws == null ? null : await accesoAlGrupo(ws);
  if (ws == null || !quien) return NO_EXISTE();
  await anotarQueAbrio(ws, quien).catch(() => {});
  const sp = req.nextUrl.searchParams;
  const pagina = await leerHilo(ws, quien, { despues: entero(sp.get('despues')), antes: entero(sp.get('antes')) });
  // Un fallo de la base no es «no hay mensajes»: quien sondea mantiene lo dibujado.
  if (!pagina) return NextResponse.json({ ok: false, error: 'No pude leer el grupo.' }, { status: 503 });
  return NextResponse.json({ ok: true, ...pagina });
}

/** Lo que manda el navegador: JSON, o multipart con el archivo o la nota de voz. */
type Pedido = { texto: string; clienteId: string | null; respondeA: number | null; sigue: boolean; archivo: File | null; voz: File | null; secs: number | null };
async function leerPedido(req: NextRequest): Promise<Pedido | null> {
  try {
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const f = await req.formData();
      const archivo = f.get('archivo'); const voz = f.get('voz');
      return {
        texto: String(f.get('texto') ?? ''), clienteId: String(f.get('clienteId') ?? '').slice(0, 64) || null, respondeA: entero(String(f.get('respondeA') ?? '')),
        sigue: String(f.get('sigue') ?? '') === '1', archivo: archivo instanceof File ? archivo : null, voz: voz instanceof File ? voz : null, secs: entero(String(f.get('secs') ?? '')),
      };
    }
    const b = (await req.json()) as Record<string, unknown>;
    return {
      texto: String(b.texto ?? ''), clienteId: typeof b.clienteId === 'string' ? b.clienteId.slice(0, 64) || null : null, respondeA: entero(b.respondeA == null ? null : String(b.respondeA)),
      sigue: b.sigue === true, archivo: null, voz: null, secs: null,
    };
  } catch { return null; }
}

/**
 * ¿Esta persona tiene algo esperando en la cola de MaKo? Entonces su foto sin nombrarla es de ese pedido: «mako, ¿qué dicen estas fotos?» con tres archivos son tres POST, y sólo el primero la nombra. Sin
 * esto, lo demás no entraba a la cola, el último POST no disparaba el turno (`sigue`) y MaKo contestaba a los 3 minutos, por el cron, mirando una sola foto. Lo de OTRA persona en la cola no cuenta, y lo
 * suyo de hace más de un minuto tampoco: la foto que le manda a un compañero mientras MaKo termina de contestarle otra cosa no es para MaKo.
 */
async function sigueSuPedido(ws: number, quien: PersonaDelGrupo): Promise<boolean> {
  const clave = await claveDeConversacion(ws).catch(() => null);
  if (!clave) return false;
  const cola = await runWithWorkspace(ws, () => pendientes(clave)).catch(() => []);
  const corte = Date.now() - 60_000;
  return cola.some((m) => Date.parse(m.created_at) > corte && leerParticipanteDeApp((m.payload as { key?: { participant?: string } } | null)?.key?.participant)?.email === quien.email);
}

/**
 * ¿ESTE MENSAJE VA A LA COLA DE MaKo? Personas hablando entre ellas: MaKo no se mete. Sólo emojis o sólo una clave, no. Una foto o un PDF sin nombrar a MaKo tampoco, salvo que sea la única persona
 * del grupo: en WhatsApp un adjunto es deliberado, y en un chat entre personas es la charla. Un invitado, con su tope del día, contado en la base: gasta la IA del negocio dueño del grupo.
 */
async function vaALaCola(ws: number, quien: PersonaDelGrupo, f: FilaGrupo, citada: FilaGrupo | null, soloClave: boolean): Promise<boolean> {
  if (soloClave) return false;
  if (!f.adjunto && (!f.texto.trim() || esSoloEmoji(f.texto))) return false;
  if (tieneMediaLaFila(f) && !nombraAMaKoEnElTexto(f.texto) && citada?.autor_tipo !== 'mako') {
    const m = await miembrosDelGrupo(ws).catch(() => null);
    if ((!m || m.conCuenta.length + m.invitadosSinCuenta.length > 1) && !(await sigueSuPedido(ws, quien))) return false;
  }
  if (quien.invitado) {
    const hoy = await mensajesDelDia(ws, quien.usuarioId);
    if (hoy == null || hoy > TOPE_TURNOS_INVITADO_POR_DIA) return false;
  }
  return true;
}

/**
 * ¿PUEDE SER UN COMPROBANTE? (13/11/2026) Una foto o un PDF de quien administra, en el grupo de una agencia con la mensualidad prendida: en WhatsApp se lee ANTES de la cola
 * (lib/mako-doer-in.ts, `comprobanteDeLaMensualidad`) y en la app no se leía nunca. Juan Francisco mandó así el de Nico Sellers el 9 y el 11/11. Sin poder leer el libro, no: la foto sigue como
 * siempre. Es una lectura de la plataforma, sin la sesión; el import es tardío para que la ruta no cargue el cobro de las agencias en cada mensaje.
 */
async function puedeSerComprobante(ws: number, quien: PersonaDelGrupo, f: FilaGrupo, soloClave: boolean): Promise<boolean> {
  if (quien.invitado || soloClave || !tieneMediaLaFila(f)) return false;
  try {
    const { hayQueLeerComprobante } = await import('@/lib/agencia-mes-comprobante');
    return await hayQueLeerComprobante(ws);
  } catch { return false; }
}

/**
 * El autollamado: el turno corre en otra invocación, sin la sesión de quien escribió. Si falla, el mensaje no se pierde: lo levanta `doer-flush`. `comprobante`: el mensaje NO está en la cola y el
 * turno lo lee primero como comprobante (`paraMaKo` y `sigue` le dicen qué hacer si no lo era). false: no llegó.
 */
async function dispararTurno(ws: number, id: number, comprobante?: { paraMaKo: boolean; sigue: boolean }): Promise<boolean> {
  try {
    const r = await fetch(`${APP_BASE_URL}/api/cron/grupo-turno`, {
      method: 'POST', headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ws, id, ...(comprobante ? { comprobante: true, ...comprobante } : {}) }), signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) console.warn(`[grupos] ws${ws}: el autollamado del turno dio ${r.status}; lo levanta doer-flush`);
    return r.ok;
  } catch (e) {
    console.warn(`[grupos] ws${ws}: el autollamado del turno falló; lo levanta doer-flush: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const ws = entero((await params).ws);
  const quien = ws == null ? null : await accesoAlGrupo(ws);
  if (ws == null || !quien) return NO_EXISTE();
  if (!rateLimit(`grupo:${quien.usuarioId}`, TOPE_MENSAJES_POR_MINUTO, 60_000)) return NextResponse.json({ ok: false, error: 'Son muchos mensajes seguidos: espera un momento.' }, { status: 429 });
  const pedido = await leerPedido(req);
  if (!pedido) return NextResponse.json({ ok: false, error: 'No entendí el mensaje.' }, { status: 400 });

  // Una clave pegada se tapa ANTES de guardar: la lee quien esté en el grupo, y la cola y el modelo reciben la tapada.
  const tapado = taparClaves(pedido.texto.slice(0, 20000));
  // ⚠️ LA CITA, DE ESTE GRUPO Y DE LO QUE ESTA PERSONA VE: los ids son globales y correlativos. Sin esto, un invitado cita un id de otro negocio o de antes de entrar, y MaKo se lo lee.
  const citada = pedido.respondeA != null ? await filaParaPersona(ws, pedido.respondeA, quien) : null;
  if (pedido.respondeA != null && !citada) return NO_EXISTE();

  let adjunto: AdjuntoGrupo | null = null;
  if (pedido.archivo) {
    const bytes = new Uint8Array(await pedido.archivo.arrayBuffer());
    const v = validarAdjuntos([{ nombre: pedido.archivo.name, mime: pedido.archivo.type, bytes }]);
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    const a = v.adjuntos[0];
    const path = await guardarArchivoDelGrupo(ws, a.bytes, a.mime, a.nombre);
    if (!path) return NextResponse.json({ ok: false, error: 'No pude guardar el archivo: vuelve a intentarlo.' }, { status: 503 });
    adjunto = { tipo: a.tipo === 'image' ? 'imagen' : 'pdf', path, nombre: a.nombre, mime: a.mime, bytes: a.bytes.byteLength };
  } else if (pedido.voz) {
    // ⚠️ LA NOTA SE GUARDA SIEMPRE: no pasa por `escucharNotaDelChat`, que la rechaza sin IA. Un audio entre personas no puede rebotar porque el negocio no tiene IA. La escucha el doer, después.
    const bytes = new Uint8Array(await pedido.voz.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > 4 * 1024 * 1024 || !esMp3(bytes)) return NextResponse.json({ ok: false, error: 'No pude leer esa nota de voz.' }, { status: 400 });
    const path = await guardarArchivoDelGrupo(ws, bytes, 'audio/mpeg');
    if (!path) return NextResponse.json({ ok: false, error: 'No pude guardar la nota: vuelve a intentarlo.' }, { status: 503 });
    adjunto = { tipo: 'audio', path, mime: 'audio/mpeg', bytes: bytes.byteLength, ...(pedido.secs ? { secs: pedido.secs } : {}) };
  }
  if (!tapado.texto.trim() && !adjunto) return NextResponse.json({ ok: false, error: 'Escribe algo.' }, { status: 400 });

  // Con el mismo `clienteId`, la fila de antes: un reintento del navegador no duplica ni vuelve a llamar a MaKo.
  const r = await escribirDePersona({ ws, quien, texto: tapado.texto, clienteId: pedido.clienteId, respondeA: citada ? citada.id : null, adjunto });
  if ('error' in r) {
    if (adjunto?.path) await borrarArchivoDelGrupo(adjunto.path);
    return NextResponse.json({ ok: false, error: 'No pude guardar tu mensaje: vuelve a intentarlo.' }, { status: 503 });
  }
  const fila = r.fila;
  const mensaje = filaAlHilo(fila, { usuarioId: quien.usuarioId, invitado: quien.invitado, hosts: hostsDeMaKo() });
  // Un reintento ya subió su archivo otra vez: el de la fila es el de antes.
  if (r.repetida) {
    if (adjunto?.path) await borrarArchivoDelGrupo(adjunto.path);
    return NextResponse.json({ ok: true, mensaje, repetida: true });
  }

  const soloClave = tapado.tapadas > 0 && soloLaClave(tapado.texto) && !adjunto;
  if (tapado.tapadas > 0) {
    const link = linkApp(`/integraciones${tapado.servicio ? `?abrir=${tapado.servicio}` : ''}`, ws);
    await escribirSistema(ws, cartelParaLaApp(avisoClaveTapadaEnElGrupo(link)));
  }
  // EL ACUSE: un texto de quien administra corta las insistencias y marca las corridas. ⚠️ No el de un invitado: `esAcuse` es tolerante, y su «dale» apagaría el recordatorio de una cuota
  // o cambiaría una automatización del negocio. Una foto o un audio no acusan. No frena el mensaje.
  if (!quien.invitado && tapado.texto.trim() && !soloClave && !tapado.texto.includes(CLAVE_TAPADA)) {
    await acusarDesdeElGrupo(ws, [tapado.texto]).catch((e) => console.error(`[grupos] ws${ws} acuse: ${e instanceof Error ? e.message : String(e)}`));
  }

  // A la COLA antes de responder (es lo durable: si la función muere, la levanta el cron). Sin poder leer la clave, la fila queda y no se encola: otra clave sería otra cola, otro candado y otras
  // pendientes de un negocio que sí tiene grupo.
  let encolado = false;
  const paraMaKo = await vaALaCola(ws, quien, fila, citada, soloClave);
  // UN POSIBLE COMPROBANTE no entra a la cola acá: lo lee el turno primero (`puedeSerComprobante`). Si el autollamado no llega y era para MaKo, entra a la cola igual y lo levanta doer-flush.
  const comprobante = await puedeSerComprobante(ws, quien, fila, soloClave);
  const aLaCola = async (): Promise<boolean> => {
    const clave = await claveDeConversacion(ws).catch((e) => { console.error(`[grupos] ws${ws}: no pude leer la clave del grupo: ${e instanceof Error ? e.message : String(e)}`); return null; });
    if (!clave) return false;
    const msg = msgDeFila(fila, { clave, email: quien.email, letra: quien.letra, nombre: fila.autor_nombre, citada });
    return runWithWorkspace(ws, () => encolar(clave, { waId: msg.key.id, texto: fila.texto, tieneMedia: tieneMediaLaFila(fila), tieneAudio: tieneAudioLaFila(fila), payload: msg }));
  };
  if (paraMaKo && !comprobante) encolado = await aLaCola();
  after(async () => {
    // `sigue`: vienen más archivos de este mismo envío, y la respuesta es por todos. Se dispara con el último; si no llega, lo levanta el cron. A la vez que el push: uno que tarda no le demora el turno a MaKo.
    const turno = comprobante
      ? dispararTurno(ws, Number(fila.id), { paraMaKo, sigue: pedido.sigue }).then(async (llego) => { if (!llego && paraMaKo) await aLaCola(); })
      : encolado && !pedido.sigue ? dispararTurno(ws, Number(fila.id)) : null;
    await Promise.all([avisarMiembros(ws, fila), turno]);
  });
  return NextResponse.json({ ok: true, mensaje });
}
