'use client';

// =============================================================================
// «Tu marca» DENTRO del carrusel: el brandboard y una carpeta de piezas propias, sin salir de «Editar» (20/11/2026)
// =============================================================================
// La llamada con Leila (Fathom 205366178, 00:53:42): «habría que ver el tema de cómo cargar tu carpeta o tu brandboard… para que lo
// puedas personalizar un poco más exacto». El kit de marca ya existía en Second Brain › Marca (app/second-brain/MarcaView.tsx: MaKo
// lee el manual o la imagen del brandboard y propone colores, letras y logo), pero desde el carrusel nadie lo encontraba.
//
// Acá se abre ESA misma pantalla (no una copia) en una caja, y además una carpeta de piezas propias: las imágenes van a «Subidos»
// del editor (las mismas que el chat de Image ofrece como "fotos"), para usarlas en el carrusel. Al guardar la marca, el carrusel
// ofrece «Con mis colores» (lib/carruseles/guiado.ts → `opcionesParaRehacer`, con el kit).
// =============================================================================

import { useRef, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { MarcaView } from '@/app/second-brain/MarcaView';
import { IMAGEN_DIRECTA, subirArchivo } from '@/app/image-editor/mako/nube';
import s from './explorar.module.css';

/** Cuántas piezas se suben como mucho de una carpeta (cada una es una subida; más no ayuda a nadie a elegir). */
const PIEZAS_MAX = 40;

/** Las medidas de una imagen local (sin subirla). */
function medidasDe(f: File): Promise<{ ancho: number; alto: number }> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { ok({ ancho: img.naturalWidth || 1080, alto: img.naturalHeight || 1080 }); URL.revokeObjectURL(url); };
    img.onerror = () => { ok({ ancho: 1080, alto: 1080 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/** El botón «Tu marca» y su caja: el brandboard (la pantalla de Second Brain › Marca) y la carpeta de piezas. */
export function TuMarca({ alGuardar }: { alGuardar?: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const [subiendo, setSubiendo] = useState<{ hechas: number; de: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const carpetaRef = useRef<HTMLInputElement>(null);
  const piezasRef = useRef<HTMLInputElement>(null);

  const subir = async (lista: FileList | null) => {
    const fotos = Array.from(lista ?? []).filter((f) => IMAGEN_DIRECTA.has(f.type)).slice(0, PIEZAS_MAX);
    if (!fotos.length) { setAviso('No encontré imágenes (PNG, JPG, WEBP o GIF) en lo que elegiste.'); return; }
    setAviso(null);
    setSubiendo({ hechas: 0, de: fotos.length });
    let bien = 0;
    for (const [i, f] of fotos.entries()) {
      try {
        const m = await medidasDe(f);
        await subirArchivo(f, { nombre: f.name.slice(0, 120), tipo: f.type, ancho: m.ancho, alto: m.alto });
        bien++;
      } catch (e) { console.warn('[image/tu-marca] no pude subir', f.name, e); }
      setSubiendo({ hechas: i + 1, de: fotos.length });
    }
    setSubiendo(null);
    setAviso(bien === fotos.length
      ? `Listo: ${bien === 1 ? 'tu pieza quedó' : `tus ${bien} piezas quedaron`} en «Subidos». Las tienes en el editor para tus carruseles.`
      : `Subí ${bien} de ${fotos.length}. Las que faltan, vuelve a intentarlas.`);
  };

  const cerrar = () => { setAbierta(false); setAviso(null); alGuardar?.(); };

  return (
    <>
      <button type="button" className={s.pastilla} onClick={() => setAbierta(true)}>Tu marca</button>
      {abierta ? (
        <Modal titulo="Tu marca" onCerrar={cerrar} ancho={720} completaEnCelular
          pie={<button type="button" className={s.pastilla} onClick={cerrar}>Listo</button>}>
          <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.45 }}>
            Sube tu brandboard (un PDF o una imagen): MaKo lee tus colores, tus letras y tu logo, y tu carrusel puede salir con ellos
            («Con mis colores», al lado del resultado). También puedes subir una carpeta con tus piezas: quedan en «Subidos» del editor.
          </p>
          <MarcaView />
          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button type="button" className={s.pastilla} disabled={!!subiendo} onClick={() => carpetaRef.current?.click()}>Subir una carpeta de piezas</button>
            <button type="button" className={s.pastilla} disabled={!!subiendo} onClick={() => piezasRef.current?.click()}>Elegir imágenes</button>
            {subiendo ? <span role="status" style={{ fontSize: 13 }}>Subiendo {subiendo.hechas} de {subiendo.de}…</span> : null}
            {aviso ? <span role="status" style={{ fontSize: 13 }}>{aviso}</span> : null}
          </div>
          {/* `webkitdirectory`: elegir una CARPETA entera (Chrome, Edge, Safari y Firefox lo entienden). */}
          <input ref={carpetaRef} type="file" hidden multiple accept="image/*" {...{ webkitdirectory: '', directory: '' }}
            onChange={(e) => { void subir(e.target.files); e.target.value = ''; }} />
          <input ref={piezasRef} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => { void subir(e.target.files); e.target.value = ''; }} />
        </Modal>
      ) : null}
    </>
  );
}
