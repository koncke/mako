// Un mensaje de MaKo en el chat del reto (la fila del chat con su muñeco). Lo usan el chat (ChatDelReto.tsx) y la tarjeta del clip.
import type { ReactNode } from 'react';
import { FilaDelChat } from '@/app/admin/operaciones/Hilo';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';

export function Burbuja({ children, ancho = false }: { children: ReactNode; ancho?: boolean }) {
  return <FilaDelChat m={null} quien={{ titulo: 'MaKo', aspecto: ASPECTO_MAKO }} marcas={null} hora={null} ancho={ancho}><div className="rt-md">{children}</div></FilaDelChat>;
}
