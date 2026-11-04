// =============================================================================
// Un mensaje del hilo de un chat en el teléfono: la burbuja, la nota o el evento
// =============================================================================
// Vivía adentro de la página. Salió para poder dibujarla en un test: una `page.tsx` sólo exporta lo que Next conoce.
// El audio es el reproductor de la casa (`AudioPlay`), no el `<audio controls>` nativo: el del iPhone no deja cambiar la velocidad (ticket #50).
// =============================================================================

import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';
import type { DiaHiloM } from '../hilo-modelo';

export function BurbujaChatM({ m }: { m: DiaHiloM['items'][number] }) {
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
      {m.media?.tipo === 'audio' && <AudioPlay src={m.media.url} color="var(--primary)" style={{ width: 260, maxWidth: '100%' }} />}
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
