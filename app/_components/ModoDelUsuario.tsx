'use client';

// =============================================================================
// ModoDelUsuario — mantiene el oscuro que la persona eligió mientras navega (17/10/2026)
// =============================================================================
// La mitad de cliente de `ModoArranque` (el <script> del primer pintado). El script corre sólo cuando el navegador
// parsea un documento NUEVO; al navegar por links no vuelve a correr, y tres cosas pueden sacar el atributo en el
// camino: el shell del teléfono al salir de /m (ShellM), una pantalla que lo PRESTÓ al irse (TemaOscuro) y el taller de
// paletas del super admin. Este efecto lo vuelve a poner en cada ruta si la persona eligió oscuro.
//
// ⚠️ NUNCA lo SACA: con la elección en claro, el oscuro que haya es de una pantalla que lo pide para sí (el editor de
// video) o del Cliente de Diseño, y quien lo puso lo saca. Sacar el modo es cosa del interruptor (`aplicarModo`).

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ATTR_MODO, LS_MODO } from '@/lib/temas-candidatos';

function aplicarElegido() {
  try {
    if (localStorage.getItem(LS_MODO) !== 'oscuro') return;
  } catch { return; /* sin almacenamiento: claro */ }
  const d = document.documentElement;
  if (d.getAttribute(ATTR_MODO) !== 'oscuro') d.setAttribute(ATTR_MODO, 'oscuro');
}

export function ModoDelUsuario() {
  const pathname = usePathname();
  useEffect(() => { aplicarElegido(); }, [pathname]);
  useEffect(() => {
    // Otra pestaña cambió la elección: ésta la sigue (el interruptor de ésta ya avisa con 'mako-modo').
    const alGuardar = (e: StorageEvent) => {
      if (e.key !== LS_MODO) return;
      if (e.newValue === 'oscuro') aplicarElegido();
      // Pasó a claro: se saca, salvo que esta pantalla lo haya pedido para sí (TemaOscuroScript lo marca PRESTADO).
      else if (!document.documentElement.hasAttribute('data-tema-prestado')) document.documentElement.removeAttribute(ATTR_MODO);
      window.dispatchEvent(new Event('mako-modo'));
    };
    window.addEventListener('storage', alGuardar);
    return () => window.removeEventListener('storage', alGuardar);
  }, []);
  return null;
}
