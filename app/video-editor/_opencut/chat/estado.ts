// Lo que muestra la tarjeta de MaKo a la izquierda del editor (_opencut/marco.tsx): el chat (`abierto`) o la lista de
// proyectos. Desde el 27/10/2026 el chat es el PANEL ÚNICO de MaKo, fijo y SIEMPRE a la vista como el del Web Generator
// (Martín: «adaptar las tabs de video e imagen con el chat que tenemos de MaKo... que este al costado, que los
// "proyectos" se vean en la barra del costado»): ya no se cierra. `abierto: false` es la lista de proyectos en la MISMA
// tarjeta (la «←» del chat), y `setAbierto(true)` la devuelve al chat (la estrella de la lista, una propuesta nueva, el
// link `?propuesta=`). Arranca en el chat.

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
	abierto: true,
	setAbierto: (abierto) => set({ abierto }),
	foco: null,
	setFoco: (foco) => set({ foco }),
}));
