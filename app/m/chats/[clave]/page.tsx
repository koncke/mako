// =============================================================================
// /m/chats/[clave] — UNA conversación de Chats en el teléfono (17/10/2026)
// =============================================================================
// La ventana del chat de escritorio (app/chats/VentanaChat.tsx), destilada: el hilo de TODOS los canales
// del contacto (WhatsApp de cada línea, Instagram, Messenger, Email), las notas del equipo y los eventos
// (cerrada, asignada…), y un composer que escribe por el canal elegido. Lo lee `hiloDeChat` (lib/chats.ts),
// lo mismo que GET /api/chats/hilo. En escritorio es /chats?c=<clave> (rutaEscritorio).
//
// Pantalla de TRABAJO (esTrabajo, app/m/_ui/cabecera.ts): sin título grande ni barra de abajo; vuelve a
// Chats. La única acción de la cabecera es la de escritorio que más se usa: Cerrar (o Reabrir).
//
// ⚠️ La HORA y el DÍA se escriben con la zona del NEGOCIO (el server corre en UTC: un mensaje de las 22 h
// en Buenos Aires caía en el día siguiente). Las de escritorio (`armarHilo`) usan la del navegador porque
// se dibujan en el cliente.
// =============================================================================

import '../chats.css';
import { requireMovil } from '@/lib/movil-guard';
import { hiloDeChat, puertaChats } from '@/lib/chats';
import { parsearClave } from '@/lib/chats-reglas';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { CabeceraM, PantallaM, VacioM } from '@/app/m/_ui';
import Link from '@/app/_ui/Link';
import { ComposerChatsM } from './ComposerChatsM';
import { EstadoChatM } from './EstadoChatM';
import { diasDelHilo, type DiaHiloM } from '../hilo-modelo';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function Burbuja({ m }: { m: DiaHiloM['items'][number] }) {
  if (m.tipo === 'evento') return <p className="m-chats-evento">{m.texto}</p>;
  if (m.tipo === 'comentario') {
    return (
      <div className="m-chats-nota">
        <span className="m-chats-nota__autor">{m.autor ? `Nota de ${m.autor}` : 'Nota'}</span>
        {m.texto}
        <span className="m-chats-burbuja__hora">{m.hora}</span>
      </div>
    );
  }
  return (
    <div className={`m-chats-burbuja ${m.saliente ? 'm-chats-burbuja--mia' : 'm-chats-burbuja--suya'}`}>
      {m.asunto && <strong className="m-chats-burbuja__asunto">{m.asunto}</strong>}
      {m.media?.tipo === 'imagen' && <a href={m.media.url} target="_blank" rel="noreferrer"><img className="m-chats-burbuja__img" src={m.media.url} alt="Imagen" loading="lazy" /></a>}
      {m.media?.tipo === 'audio' && <audio className="m-chats-burbuja__audio" controls preload="none" src={m.media.url} />}
      {m.media?.tipo === 'video' && <video className="m-chats-burbuja__img" controls preload="none" src={m.media.url} />}
      {m.media?.tipo === 'archivo' && <a className="m-chats-burbuja__archivo" href={m.media.url} target="_blank" rel="noreferrer">{m.media.nombre}</a>}
      {m.adjuntos.map((a) => (a.url
        ? <a key={a.nombre} className="m-chats-burbuja__archivo" href={a.url} target="_blank" rel="noreferrer">{a.nombre}</a>
        : <span key={a.nombre} className="m-chats-burbuja__archivo">{a.nombre}</span>))}
      {m.texto && <span>{m.texto}</span>}
      <span className="m-chats-burbuja__hora">{m.canal ? `${m.canal} · ` : ''}{m.hora}{m.fallo ? ' · No salió' : ''}</span>
    </div>
  );
}

export default async function HiloChatMovil({ params }: { params: Promise<{ clave: string }> }) {
  await requireMovil({ navKey: 'chats' });
  const { clave: cruda } = await params;
  let clave = cruda;
  try { clave = decodeURIComponent(cruda); } catch { /* ya venía decodificada */ }
  const volver = { href: '/m/chats', label: 'Chats' };

  const puerta = await puertaChats();
  if (!puerta.ok || !parsearClave(clave)) {
    return <PantallaM><CabeceraM titulo="Chat" trabajo padre={volver} /><VacioM frase="No encontré esa conversación." accion={{ rotulo: 'Volver a Chats', href: '/m/chats' }} /></PantallaM>;
  }
  let h: Awaited<ReturnType<typeof hiloDeChat>> | null = null;
  try { h = await hiloDeChat(clave, { usuario: puerta.yo }); } catch (e) {
    console.error(`[m/chats/hilo] ${clave}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!h) return <PantallaM><CabeceraM titulo="Chat" trabajo padre={volver} /><VacioM frase="No pude leer la conversación. Vuelve a intentar en un momento." /></PantallaM>;
  const chat = h.chat;
  if (!chat) {
    return <PantallaM><CabeceraM titulo="Chat" trabajo padre={volver} /><VacioM frase={h.ocultoWhatsapp ? 'Este chat está oculto: MaKo no lo lee.' : 'No encontré esa conversación.'} accion={{ rotulo: 'Volver a Chats', href: '/m/chats' }} /></PantallaM>;
  }

  const tz = await tzDeWorkspace(puerta.ws).catch(() => TZ_DEFAULT);
  const dias = diasDelHilo(h.mensajes, tz);
  const canales = [...new Set(chat.canales.map((i) => i.rotulo))].join(' · ');

  return (
    <PantallaM>
      <CabeceraM titulo={chat.nombre} trabajo padre={volver} accion={<EstadoChatM clave={chat.clave} estado={chat.estado} />} />
      <div className="m-chats-hilo-cabeza">
        <span>{canales}</span>
        {chat.leadId != null && <Link className="m-lnk" href={`/m/crm/${chat.leadId}`}>Ficha</Link>}
      </div>
      {h.fallas.length > 0 && <p className="m-chats-aviso">Falta parte del hilo: no se pudo leer todo.</p>}
      <div className="m-chats-hilo" aria-live="polite">
        {dias.length ? dias.map((d) => (
          <div key={d.dia} style={{ display: 'contents' }}>
            <span className="m-chats-hilo__dia">{d.etiqueta}</span>
            {d.items.map((m) => <Burbuja key={m.id} m={m} />)}
          </div>
        )) : <VacioM frase="Todavía no hay mensajes. Escribe el primero." />}
      </div>
      <ComposerChatsM clave={chat.clave} leadId={chat.leadId} canales={chat.canales} bloqueado={chat.bloqueado} />
    </PantallaM>
  );
}
