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
import { guardarAdjuntos, leerAdjuntosGuardados } from './adjuntos-guardados';
import { Visor } from './Visor';

type Foto = { url: string; nombre: string };
/** Lo ya leído de cada trabajo (por su id): la burbuja se vuelve a dibujar con cada refresco y no relee IndexedDB. */
const leidas = new Map<string, Foto[]>();
const direccionDe = (id: string) => `enviado:${id}`;
const LADO_MINIATURA = 640;

async function miniatura(f: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, LADO_MINIATURA / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(bmp.width * k));
    lienzo.height = Math.max(1, Math.round(bmp.height * k));
    lienzo.getContext('2d')?.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.78));
    return blob ? new File([blob], f.name, { type: 'image/jpeg' }) : f;
  } catch { return f; }
}

/** Lo llama el motor (useCentro.ts → mandar) apenas el trabajo salió: la foto se ve en el acto y queda para después. */
export function recordarEnviadas(id: string, archivos: readonly File[]) {
  const fotos = archivos.filter((f) => f.type.startsWith('image/'));
  if (!fotos.length) return;
  leidas.set(id, fotos.map((f) => ({ url: URL.createObjectURL(f), nombre: f.name })));
  void Promise.all(fotos.map(miniatura)).then((ms) => guardarAdjuntos(direccionDe(id), ms));
}

/** Lo adjuntado en una burbuja propia: las fotos que este navegador tiene, y el nombre de lo demás. */
export function AdjuntosEnBurbuja({ id, nombres }: { id: string; nombres: readonly string[] }) {
  const [fotos, setFotos] = useState<Foto[] | null>(() => leidas.get(id) ?? null);
  const [viendo, setViendo] = useState<Foto | null>(null);
  useEffect(() => {
    const ya = leidas.get(id);
    if (ya) { setFotos(ya); return; }
    let vivo = true;
    void leerAdjuntosGuardados(direccionDe(id)).then((fs) => {
      const lista = fs.map((f) => ({ url: URL.createObjectURL(f), nombre: f.name }));
      leidas.set(id, lista);
      if (vivo) setFotos(lista);
    });
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
