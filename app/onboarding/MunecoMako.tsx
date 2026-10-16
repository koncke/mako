// =============================================================================
// MunecoMako — la cara de MaKo en el onboarding: uno de los muñecos del Centro
// =============================================================================
// Pedido de Martín (16/10/2026): «una animación de los mismos 3 pasos que incluya al muñequito de MaKo,
// alguno que esté en los chats del "Centro", piensa en el más "normal" que sea ese. Y que al terminar la
// animación se posicione en su lugar como "foto de perfil"».
//
// Es el dibujo del Centro (app/admin/operaciones/Muneco.tsx), no una copia: el de Estrategia, el que
// reparte a los chats. Círculo, verde lima y sonrisa, que son los casos por defecto del dibujo (el «cero»
// del diseño) y sin accesorio. El aspecto va EXPLÍCITO y no por el título: «MaKo» no está en la tabla del
// Centro y caería a un hash cualquiera.
//
// ⚠️ EL ASPECTO VA COMO OBJETO `as const` PASADO POR VARIABLE, no como literal en la llamada: el tipo
// `Aspecto` cambia entre main (exige `accesorio`) y la rama del Centro que les sacó los accesorios. Un
// objeto ya construido no pasa el chequeo de propiedades de más, así que compila con los dos.
// ⚠️ LA TINTA VA FIJA: el muñeco dibuja ojos y boca con `var(--ink)`, que en tema oscuro es casi blanco, y
// el verde pastel no cambia: los ojos quedaban blancos sobre el verde. El onboarding es oscuro siempre.
// ⚠️ Los estados (parpadeo, flotar) viven en centro.css (clases `.mun*`, sin raíz que las limite).
// =============================================================================

import type { CSSProperties } from 'react';
import '@/app/admin/operaciones/centro.css';
import { Muneco, type Animo } from '@/app/admin/operaciones/Muneco';

const ASPECTO_MAKO = { forma: 'circulo', color: '--grafo-avatares', cara: 'sonrisa', accesorio: 'ninguno' } as const;

export function MunecoMako({ size = 40, animo = 'despierto', style }: { size?: number; animo?: Animo; style?: CSSProperties }) {
  return (
    <span role="img" aria-label="MaKo" style={{ display: 'inline-flex', flex: 'none', ['--ink' as string]: '#12151B', ...style }}>
      <Muneco titulo="MaKo" animo={animo} size={size} aspecto={ASPECTO_MAKO} />
    </span>
  );
}
