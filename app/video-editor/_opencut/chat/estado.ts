// A qué mensaje tiene que ir el chat «Editar con IA» (chat/PanelChat.tsx).
//
// Hasta el 29/10/2026 este store decía además si el panel estaba ABIERTO: lo abría y cerraba un botón de la barra
// superior y lo dibujaba editor-page.tsx en una columna a la derecha. Desde ese día el chat es la tarjeta izquierda de la
// pantalla de Create (app/_crear/PantallaCrear.tsx), que NO se cierra (Martín: «el chat de MaKo SIEMPRE abierto a la
// izquierda»), y `abierto` se fue: nada lo abre porque nada lo cierra.
//
// `foco` es el mensaje al que el panel tiene que ir: el de la propuesta que trajo el link `?propuesta=<id>`
// (chat/propuestas.ts → enfocarPropuesta). El panel baja hasta él, lo resalta y lo suelta.

import { create } from "zustand";

export const useChatAbierto = create<{
	foco: string | null;
	setFoco: (id: string | null) => void;
}>()((set) => ({
	foco: null,
	setFoco: (foco) => set({ foco }),
}));
