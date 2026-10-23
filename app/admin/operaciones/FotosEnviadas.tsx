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
// Lo que se hizo el 17/10: la foto la tenía el navegador que la mandó (el original en memoria y una miniatura en
// IndexedDB). En otro dispositivo, o un PDF, iba el renglón con el nombre (WhatsApp dibuja así un documento).
//
// EN CUALQUIER DISPOSITIVO (23/10/2026): Martín decidió el 18/10 que las fotos del Ops Center SÍ quedan del lado del
// servidor («cuando envío imágenes por aquí o adjunto cosas también deberían aparecer en el Center»): bucket privado, URL
// firmada y sólo para quien puede operar. El original se sigue borrando al entregar; el navegador que la mandó sube la
// MINIATURA (640 px), y la burbuja de cualquier dispositivo la pide con una URL de 10 minutos (fotos-enviadas.ts, de dónde
// sale cada una; lib/operaciones-adjuntos.ts → «Las fotos enviadas»). Sólo la pide un trabajo que TIENE fotos (`fotos`,
// los nombres que el servidor saca del texto firmado): una burbuja con un PDF no va al servidor. Y sabe cuántas espera:
// mientras falte alguna (suben de a una), vuelve a preguntar durante los primeros minutos del mensaje.

import { useEffect, useState } from 'react';
import { IconoChat } from '@/app/m/mako/iconos';
import { leerFotosEnviadas, fotosYaLeidas, nombresSinFoto, proximoIntento, type Foto } from './fotos-enviadas';
import type { AdjuntoTurno } from '@/lib/operaciones-reglas';
import { Visor } from './Visor';

/**
 * Lo adjuntado en una burbuja propia: sus fotos (de este navegador o del servidor), y el nombre de lo demás.
 * ⚠️ Quien la monta le da `key={id}` (Hilo.tsx): la conversación se dibuja por posición, y sin la clave una burbuja que
 *    pasa a ser de OTRO mensaje mostraría las fotos del anterior hasta que llegan las suyas.
 * `creado`: cuándo salió el mensaje. Mientras falten fotos, vuelve a preguntar (12, 24, 48 s…) durante sus primeros 3
 * minutos (`proximoIntento`): las miniaturas suben de a una, después de mandar.
 */
export function AdjuntosEnBurbuja({ id, nombres, fotos: nombresDeFotos, creado }: { id: string; nombres: readonly string[]; fotos?: readonly string[]; creado?: string }) {
  const [fotos, setFotos] = useState<Foto[] | null>(() => fotosYaLeidas(id));
  const [viendo, setViendo] = useState<Foto | null>(null);
  const esperadas = nombresDeFotos?.length ?? 0;
  useEffect(() => {
    let vivo = true;
    let reloj: ReturnType<typeof setTimeout> | null = null;
    let tengo = -1;
    let intento = 0;
    const desde = creado ? Date.parse(creado) : NaN;
    const mirar = () => {
      void leerFotosEnviadas(id, esperadas).then((lista) => {
        if (!vivo) return;
        if (lista.length > tengo) { tengo = lista.length; setFotos(lista); }
        if (tengo >= esperadas) return;
        const espera = proximoIntento(intento, desde, Date.now());
        intento += 1;
        if (espera != null) reloj = setTimeout(mirar, espera);
      });
    };
    mirar();
    return () => { vivo = false; if (reloj) clearTimeout(reloj); };
  }, [id, esperadas, creado]);
  const otros = nombresSinFoto(nombres, fotos ?? []);
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
      {otros.map((n, i) => (
        <span key={`${n}-${i}`} className="co-doc-enviado"><IconoChat nombre={/\.pdf$/i.test(n) ? 'archivo' : 'foto'} size={18} /><span>{n}</span></span>
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
