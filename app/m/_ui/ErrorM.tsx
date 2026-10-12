'use client';

// =============================================================================
// ErrorM — algo falló: de quién fue y qué hacer (AGENTS.md: «Un mensaje de error
// dice DE QUIÉN fue y QUÉ HACER, o no sirve»)
// =============================================================================
// La frase la escribe quien llama, porque sólo él sabe la causa:
//   · nuestra  → «No pudimos cargar tus leads. No es nada tuyo.»
//   · de red   → la cinta del shell ya lo dice; acá alcanza con reintentar.
//   · de un tercero → se lo NOMBRA primero («Google no contestó…»), y sólo si
//     está medido.
// Nunca «Reintenta» sobre algo que va a fallar igual (una cuota agotada, una
// credencial que falta): ahí la salida es un link a donde se arregla.
//
// Por defecto el botón vuelve a pedir los datos de la página (`router.refresh()`).
// =============================================================================

import { useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button, ButtonLink } from '@/app/_ui/Button';

export function ErrorM({ frase, onReintentar, rotulo = 'Volver a cargar', arreglo }: {
  /** Qué pasó y de quién fue, en una frase. */
  frase: string;
  /** Lo que reintenta. Sin pasarlo, refresca los datos de la página. */
  onReintentar?: () => void;
  rotulo?: string;
  /** Si la salida NO es reintentar: un link a donde se arregla (y entonces no hay reintento). */
  arreglo?: { rotulo: string; href: string };
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const reintentar = onReintentar ?? (() => empezar(() => router.refresh()));
  return (
    <div className="m-vacio" role="alert">
      <p className="m-vacio__frase m-error__frase">{frase}</p>
      {arreglo ? (
        <ButtonLink href={arreglo.href} variant="secondary" size="md">{arreglo.rotulo}</ButtonLink>
      ) : (
        <Button variant="secondary" size="md" onClick={reintentar} loading={pendiente}>{rotulo}</Button>
      )}
    </div>
  );
}
