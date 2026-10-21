'use client';

// =============================================================================
// Las fotos de un mensaje ya enviado, adentro de su burbuja (17/10/2026)
// =============================================================================
// Martín: «no se ve la preview de la img que adjunté». Como WhatsApp: la foto arriba, ocupando la burbuja, el texto debajo,
// y tocarla la abre en grande (con el «atrás» que cierra sólo la foto, atras.ts).
//
// POR QUÉ NO SE VEÍA (lo obvio era «la URL firmada del adjunto» o «el mensaje optimista sin el adjunto», y no era ninguno):
// la burbuja nunca dibujó imágenes. El trabajo sólo guarda los NOMBRES (`TrabajoP.adjuntos`), y el binario del bucket se
// BORRA cuando la PC lo baja (lib/operaciones-adjuntos.ts: «EL BINARIO NO QUEDA», es la protección del canal). No hay de
// dónde firmar una URL después de entregado.
// Lo que se hizo: la foto la tiene el navegador que la mandó. Al mandar, el original queda en memoria (se ve en el acto,
// también en el mensaje optimista) y una MINIATURA (640 px, JPEG) en IndexedDB con la dirección `enviado:<id del trabajo>`
// (adjuntos-guardados.ts), así sobrevive a un F5. En otro dispositivo, o un PDF, va el renglón con el nombre (WhatsApp
// dibuja así un documento).
// ⚠️ Sin miniatura en el servidor a propósito: guardarla ahí es un binario de Martín que queda, contra la regla de arriba.

import { useEffect, useState } from 'react';
import { IconoChat } from '@/app/m/mako/iconos';
import { leerFotosEnviadas, fotosYaLeidas, type Foto } from './fotos-enviadas';
import type { AdjuntoTurno } from '@/lib/operaciones-reglas';
import { Visor } from './Visor';

/** Lo adjuntado en una burbuja propia: las fotos que este navegador tiene, y el nombre de lo demás. */
export function AdjuntosEnBurbuja({ id, nombres }: { id: string; nombres: readonly string[] }) {
  const [fotos, setFotos] = useState<Foto[] | null>(() => fotosYaLeidas(id));
  const [viendo, setViendo] = useState<Foto | null>(null);
  useEffect(() => {
    let vivo = true;
    void leerFotosEnviadas(id).then((lista) => { if (vivo) setFotos(lista); });
    return () => { vivo = false; };
  }, [id]);
  const conFoto = new Set((fotos ?? []).map((f) => f.nombre));
  const otros = nombres.filter((n) => !conFoto.has(n));
  return (
    <>
      {!!fotos?.length && (
        <span className={`co-fotos co-fotos--${Math.min(fotos.length, 4)}`}>
          {fotos.slice(0, 4).map((f, i) => (
            <button key={`${f.nombre}-${i}`} type="button" className="co-fotos__ver" onClick={() => setViendo(f)} aria-label={`Ver ${f.nombre}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- una foto local (blob:) */}
              <img src={f.url} alt="" />
              {i === 3 && fotos.length > 4 && <span className="co-fotos__mas">{`+${fotos.length - 4}`}</span>}
            </button>
          ))}
        </span>
      )}
      {otros.map((n) => (
        <span key={n} className="co-doc-enviado"><IconoChat nombre={/\.pdf$/i.test(n) ? 'archivo' : 'foto'} size={18} /><span>{n}</span></span>
      ))}
      {viendo && <Visor url={viendo.url} nombre={viendo.nombre} tipo="image" onCerrar={() => setViendo(null)} />}
    </>
  );
}

/**
 * Lo que Martín adjuntó DIRECTO en la app de Claude (20/10/2026, cartero 1.17.0): las fotos arriba del texto, como las que
 * salen por el Ops Center, y un PDF como su chip. La URL es firmada y dura 10 minutos (la da `turnosCentroAction`, que
 * pasa por puedeOperar): sin URL, el chip sin link. Tocar una foto la amplía.
 */
export function AdjuntosDeLaApp({ adjuntos }: { adjuntos: readonly AdjuntoTurno[] }) {
  const [viendo, setViendo] = useState<string | null>(null);
  const fotos = adjuntos.filter((a) => a.mime.startsWith('image/') && a.url);
  const otros = adjuntos.filter((a) => !(a.mime.startsWith('image/') && a.url));
  return (
    <>
      {!!fotos.length && (
        <span className={`co-fotos co-fotos--${Math.min(fotos.length, 4)}`}>
          {fotos.slice(0, 4).map((a, i) => (
            <button key={a.ref} type="button" className="co-fotos__ver" onClick={() => setViendo(a.url ?? null)} aria-label="Ver la foto">
              {/* eslint-disable-next-line @next/next/no-img-element -- una URL firmada del storage, de 10 minutos */}
              <img src={a.url} alt="" />
              {i === 3 && fotos.length > 4 && <span className="co-fotos__mas">{`+${fotos.length - 4}`}</span>}
            </button>
          ))}
        </span>
      )}
      {otros.map((a) => {
        const pdf = a.mime === 'application/pdf';
        const contenido = <><IconoChat nombre={pdf ? 'archivo' : 'foto'} size={18} /><span>{pdf ? 'PDF' : 'Foto'}</span></>;
        return a.url
          ? <a key={a.ref} className="co-doc-enviado" href={a.url} target="_blank" rel="noreferrer">{contenido}</a>
          : <span key={a.ref} className="co-doc-enviado">{contenido}</span>;
      })}
      {viendo && <Visor url={viendo} nombre="Foto" tipo="image" onCerrar={() => setViendo(null)} />}
    </>
  );
}
