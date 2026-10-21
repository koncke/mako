// Si el panel «Editar con IA» está abierto. Lo abre el botón de la barra superior
// (components/editor/editor-header.tsx) y lo dibuja editor-page.tsx al costado de los
// paneles de CapCut. No se recuerda entre sesiones: el editor abre como CapCut, sin el chat.

import { create } from "zustand";

//
// `foco` es el mensaje al que el panel tiene que ir al abrirse: el de la propuesta que trajo el link
// `?propuesta=<id>` (chat/propuestas.ts → enfocarPropuesta). El panel baja hasta él, lo resalta y lo suelta.
export const useChatAbierto = create<{
	abierto: boolean;
	setAbierto: (v: boolean) => void;
	foco: string | null;
	setFoco: (id: string | null) => void;
}>()((set) => ({
	abierto: false,
	setAbierto: (abierto) => set({ abierto }),
	foco: null,
	setFoco: (foco) => set({ foco }),
}));
