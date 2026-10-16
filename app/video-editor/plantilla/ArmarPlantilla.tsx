"use client";

// =============================================================================
// «Utilizar plantilla» en un proyecto NUEVO: lo arma y recién ahí abre el editor
// =============================================================================
// La pestaña «Plantillas» manda acá cuando la línea de tiempo del proyecto abierto
// tiene algo (`/video-editor/nuevo?plantilla=<id>`): CapCut abre la plantilla en
// un borrador nuevo, no encima de lo que hay. La page validó el id
// (plantillaPorId); `null` es un id que no existe. El orden:
//
//   1. proyecto nuevo con el nombre de la plantilla;
//   2. usarPlantilla (_opencut/plantillas/instanciar.ts): fuentes, muestras y las
//      pistas en 9:16;
//   3. el historial de deshacer, vacío: el proyecto arranca armado (y el motor no
//      vacía el historial al cambiar de proyecto, así que traería los pasos del
//      proyecto de antes);
//   4. se guarda y se REEMPLAZA la URL por la del proyecto, sin el `?plantilla=`:
//      refrescar o volver atrás no arma la plantilla dos veces.
//
// Molde: ../desde/ImportarDesde.tsx, con lo mismo que aprendió:
// ⚠️ El pestillo es un REF y el efecto NO cancela en su cleanup (StrictMode corre
// el efecto, lo limpia y lo vuelve a correr sobre la MISMA instancia: si el
// cleanup cancelara, nunca se armaría nada; sin pestillo serían dos proyectos), y
// un mapa de módulo con la promesa en vuelo por espacio + plantilla sobrevive a
// un remontaje.

import { useEffect, useRef, useState } from "react";
import Link, { useRouter } from "@/app/_ui/Link";
import { Loader2 } from "lucide-react";
import { EditorCore } from "@/app/video-editor/_opencut/core";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { AVISO_FALLO_PLANTILLA, usarPlantilla } from "@/app/video-editor/_opencut/plantillas/instanciar";
import { conEspacio } from "@/app/video-editor/espacio";
import { plantillaPorId, type Plantilla } from "@/lib/editor-video/plantillas";

/** Los armados en vuelo, por espacio local y plantilla (ver la cabecera). */
const enVuelo = new Map<string, Promise<string>>();

async function armar(plantilla: Plantilla): Promise<string> {
	// Una vuelta del bucle antes de crear: si se llegó desde el editor, su desmontaje
	// mira «al salir» una microtarea después (editor-page.tsx) y, con el proyecto
	// nuevo ya activo, guardaría y haría la miniatura de ÉSTE a mitad de armarlo.
	await new Promise((listo) => setTimeout(listo, 0));
	const editor = EditorCore.getInstance();
	const id = await editor.project.createNewProject({ name: plantilla.nombre });
	try {
		const r = await usarPlantilla(editor, plantilla);
		if (!r.ok) throw new Error(r.motivo);
		editor.command.clear();
		await editor.project.saveCurrentProject();
		return id;
	} catch (e) {
		// Un proyecto vacío con el nombre de la plantilla se lee en el inicio como
		// «ya la armé»: se borra antes de decir que falló.
		await editor.project.deleteProjects({ ids: [id] }).catch(() => {});
		throw e;
	}
}

export function ArmarPlantilla({ id }: { id: string | null }) {
	const plantilla = plantillaPorId(id);
	if (!plantilla) return <Fallo />;
	return <Armando plantilla={plantilla} />;
}

function Armando({ plantilla }: { plantilla: Plantilla }) {
	const router = useRouter();
	const [fallo, setFallo] = useState(false);
	const [intento, setIntento] = useState(0);
	const arrancado = useRef(-1);

	useEffect(() => {
		if (arrancado.current === intento) return;
		arrancado.current = intento;
		const clave = `${conEspacio("")}|${plantilla.id}`;
		let promesa = enVuelo.get(clave);
		if (!promesa) {
			promesa = armar(plantilla);
			enVuelo.set(clave, promesa);
			// Al terminar (bien o mal) sale del mapa: usarla otra vez, más tarde, es OTRO proyecto.
			promesa.finally(() => enVuelo.delete(clave)).catch(() => {});
		}
		promesa.then((proyecto) => router.replace(`/video-editor/${proyecto}`)).catch(() => setFallo(true));
	}, [plantilla, intento, router]);

	if (fallo) {
		return (
			<Fallo
				onReintentar={() => {
					setFallo(false);
					setIntento((n) => n + 1);
				}}
			/>
		);
	}

	return (
		<Pantalla>
			<Loader2 className="size-8 animate-spin text-muted-foreground" />
			<p className="max-w-[320px] truncate text-[12px] text-(--cc-text)" title={plantilla.nombre}>
				{plantilla.nombre}
			</p>
			<span className="text-[11px] text-muted-foreground">Cargando plantilla…</span>
		</Pantalla>
	);
}

/** `pc_loading_fail_comma`, y las dos salidas: intentar de nuevo (si hay plantilla) o volver al inicio. */
function Fallo({ onReintentar }: { onReintentar?: () => void }) {
	return (
		<Pantalla>
			<p className="text-[12px] text-(--cc-text)">{AVISO_FALLO_PLANTILLA}</p>
			<div className="flex gap-2">
				{onReintentar && (
					<Button variant="default" onClick={onReintentar}>
						Intentar de nuevo
					</Button>
				)}
				<Button variant="secondary" asChild>
					<Link href="/video-editor">Volver</Link>
				</Button>
			</div>
		</Pantalla>
	);
}

function Pantalla({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-(--cc-app) px-4 text-center">
			{children}
		</div>
	);
}
