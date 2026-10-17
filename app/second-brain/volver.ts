'use client';

// =============================================================================
// «Volver a los chats», para la cabecera del grafo (17/10/2026)
// =============================================================================
// El grafo lo arma el SERVIDOR (app/second-brain/pagina.tsx → mapaDelSecondBrain) y viaja como un nodo ya
// renderizado a la pantalla del Ops Center (ChatSecondBrain.tsx). Una función no puede viajar del servidor al
// cliente, así que el botón de volver no puede llegarle como prop: se la da la pantalla por CONTEXTO, que sí cruza
// esa frontera (VistaCerebro es un componente de cliente que React monta adentro del árbol de ChatSecondBrain).
// Sin pantalla que lo provea (null) la cabecera no dibuja el botón: nunca se promete uno que no lleva a ningún lado.

import { createContext, useContext } from 'react';

export const VolverDelGrafo = createContext<(() => void) | null>(null);

export const useVolverDelGrafo = () => useContext(VolverDelGrafo);
