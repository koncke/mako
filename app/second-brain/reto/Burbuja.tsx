// Un mensaje de MaKo en el chat del reto (la fila del chat con su muñeco). Lo usan el chat (ChatDelReto.tsx) y la tarjeta del clip.
import type { ReactNode } from 'react';
import { FilaDelChat } from '@/app/admin/operaciones/Hilo';
import { ASPECTO_APP_MAKO } from '@/lib/centro-munecos';
import { MiFoto } from '@/app/admin/operaciones/MiFoto';

/** `hora`: la del mensaje («9:00»), arriba de la burbuja; sin ella, nada. */
export function Burbuja({ children, ancho = false, hora = null }: { children: ReactNode; ancho?: boolean; hora?: string | null }) {
  return <FilaDelChat m={null} quien={{ titulo: 'MaKo', aspecto: ASPECTO_APP_MAKO }} marcas={null} hora={hora} ancho={ancho}><div className="rt-md">{children}</div></FilaDelChat>;
}

/** Un mensaje de la PERSONA en el chat del reto, a la derecha y con su foto (la maqueta, `yo(rt, …)`): lo que eligió en un recuadro de
 *  opciones queda como su mensaje (verificación D1-06: «Mañana» o «Adelantar al día N»). */
export function DeLaPersona({ texto }: { texto: string }) {
  return (
    <div className="co-yo co-wa co-wa--yo" data-reto-yo="">
      <div className="ch-plegable"><p className="co-burbuja">{texto}</p></div>
      <MiFoto />
    </div>
  );
}
