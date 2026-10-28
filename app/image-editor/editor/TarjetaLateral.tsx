'use client';

// =============================================================================
// La tarjeta de la izquierda del Image Editor: el chat de MaKo o tus diseños, en el MISMO lugar
// =============================================================================
// Como la del Web Generator (app/web-generator/editor/EditorLanding.tsx, `panelIzq`): la «←» de la cabecera del chat
// pasa a la lista de diseños y la estrella de MaKo (o tocar el diseño abierto) vuelve al chat. Nada navega
// (27/10/2026, Martín: «que los "proyectos" se vean en la barra del costado, y que no cambie de ruta»).
//
// Va en dos lugares: fija a la izquierda en la computadora (EditorApp → `chatLateral`, desde ./PantallaEditor.tsx) y como
// la hoja del chat de la tira de abajo en la pantalla chica (../mako/registro.ts, `PANEL_IA`). Qué muestra lo decide el
// estudio (./estudio.ts), así que sobrevive a cambiar de diseño. Sin estudio (fuera de ./Estudio.tsx), sólo el chat.
// =============================================================================

import { PanelMakoIA } from '../mako/chat/PanelMakoIA';
import { ListaDisenos } from '../mako/ListaDisenos';
import { useEstudio } from './estudio';

export function TarjetaLateral(_props: { close?: () => void }) {
  const estudio = useEstudio();
  if (estudio?.tarjeta === 'disenos') return <ListaDisenos />;
  return <PanelMakoIA />;
}
