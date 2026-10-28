"use client";

// =============================================================================
// El proyecto abierto, SIN la ruta: qué abre el editor y cómo se cambia en el lugar (27/10/2026)
// =============================================================================
// Martín, 27/10/2026: «que los "proyectos" se vean en la barra del costado, y que no cambie de ruta». Desde ese día el
// proyecto que muestra el editor del escritorio no lo decide la URL sino el marco (../marco.tsx): la lista de la tarjeta,
// el inicio embebido, el Menú del editor y el EditorProvider le piden a ESTE contexto abrir, crear o volver al inicio, y
// el marco guarda lo pendiente, cambia el proyecto en el lugar y acompaña la URL con `history.replaceState`
// (../../proyectos.ts).
//
// ⚠️ Nadie de adentro del editor navega para cambiar de proyecto (un `router.push` a `/video-editor/<otro>` desmonta el
// marco entero y la tarjeta del chat parpadea): lo fija tests/video-editor-marco.test.ts.
// ⚠️ SIN EL MARCO (el editor del TELÉFONO, app/m/video-editor/EditorVideoM.tsx, monta el EditorProvider solo) no hay a
// quién pedírselo: ahí rige lo de antes, NAVEGAR (`sinMarco`). Por eso el hook no tira si falta el proveedor: tiraba, y
// el EditorProvider —que el teléfono también usa— rompía esa pantalla.
// =============================================================================

import { createContext, useContext, useMemo } from "react";
import { useRouter } from "@/app/_ui/Link";
import { rutaEditor } from "@/app/video-editor/ruta";

export type ProyectoAbierto = {
	/** El proyecto que el editor tiene (o está abriendo). `null`: ninguno, y en su lugar va el inicio. */
	id: string | null;
	/** El inicio («Crear proyecto» y todos los proyectos) está EN LUGAR del editor, como «Nueva landing» del Web Generator. */
	inicio: boolean;
	/** Guarda lo pendiente del abierto y abre otro en el lugar (la tarjeta vuelve al chat). */
	abrir: (id: string) => Promise<void>;
	/** Guarda lo pendiente, crea uno vacío con el nombre MMDD de CapCut y lo abre en el lugar. */
	crear: () => Promise<void>;
	/** El inicio en lugar del editor, y la lista en la tarjeta («Nuevo proyecto», «Volver a la página de inicio»). */
	verInicio: () => void;
	/** Después de borrar: si entre los borrados estaba el abierto, el editor queda sin proyecto (y muestra el inicio). */
	alBorrar: (ids: readonly string[]) => void;
};

const Contexto = createContext<ProyectoAbierto | null>(null);

export const ProveedorProyectoAbierto = Contexto.Provider;

export function useProyectoAbierto(): ProyectoAbierto {
	const c = useContext(Contexto);
	const router = useRouter();
	// Lo de antes del marco, para la pantalla que no lo tiene (el teléfono): navegar. `nuevo` es un id que no existe,
	// y el EditorProvider abre uno nuevo en su lugar (lo mismo que usa «Editar en el editor» de Video Generator).
	const sinMarco = useMemo<ProyectoAbierto>(
		() => ({
			id: null,
			inicio: false,
			abrir: async (id) => router.replace(rutaEditor(`/video-editor/${id}`)),
			crear: async () => router.push(rutaEditor("/video-editor/nuevo")),
			verInicio: () => router.push(rutaEditor("/video-editor")),
			alBorrar: () => router.push(rutaEditor("/video-editor")),
		}),
		[router],
	);
	return c ?? sinMarco;
}
