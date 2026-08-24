'use client';

import { useState } from 'react';

/**
 * Una miniatura que DESAPARECE si el archivo no está, en vez de dejar el ícono de imagen
 * rota.
 *
 * ⚠️ Existe porque en este portal «la imagen no está» y «la imagen está» se veían igual de
 * bien desde el código: ninguno de los `<img>` tenía `onError`, así que un 404 no dejaba
 * ni un log ni una pantalla distinta — dejaba un marco con el ícono roto del navegador y
 * nada más. Medido el 24/08/2026: el módulo «Creativos Animados» pedía
 * `/cono-ugc/m6.webp`, que nunca existió, en CADA carga del índice del curso.
 *
 * Es la misma regla que ya gobierna la portada del curso en `curso-a-portal.mjs` —«se
 * declara SOLO si el archivo existe: un `portada` apuntando a un 404 pinta una tarjeta con
 * la imagen rota, que es peor que una tarjeta sin imagen»— pero aplicada del lado del
 * navegador, que es donde se puede saber si la URL contestó.
 *
 * `onFalta` avisa al que la dibuja, para que pueda sacar también el marco: una caja vacía
 * con borde tampoco es lo que se quiere ver.
 */
export function Miniatura({ src, alt = '', className, onFalta }: {
  src: string;
  alt?: string;
  className?: string;
  onFalta?: () => void;
}) {
  const [rota, setRota] = useState(false);
  if (rota) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- estática en public/ o miniatura de Drive; no pasa por el optimizador
    <img
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading="lazy"
      className={className}
      onError={() => { setRota(true); onFalta?.(); }}
    />
  );
}
