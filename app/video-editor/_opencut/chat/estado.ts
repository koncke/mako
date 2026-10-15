// Si el panel «Editar con IA» está abierto. Lo abre el botón de la barra superior
// (components/editor/editor-header.tsx) y lo dibuja editor-page.tsx al costado de los
// paneles de CapCut. No se recuerda entre sesiones: el editor abre como CapCut, sin el chat.

import { create } from "zustand";

export const useChatAbierto = create<{ abierto: boolean; setAbierto: (v: boolean) => void }>()((set) => ({
	abierto: false,
	setAbierto: (abierto) => set({ abierto }),
}));
