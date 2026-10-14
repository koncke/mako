"use client";

// =============================================================================
// «Editar en el editor»: baja el anuncio, arma el proyecto y abre el editor
// =============================================================================
// Lo que la page resolvió en el server (./resolver.ts) llega acá como
// `{ titulo, archivo, url }`. El orden importa:
//
//   1. se BAJA el mp4 entero a un Blob, ANTES de crear nada: si la red falla no
//      queda un proyecto vacío con el nombre del anuncio en el inicio;
//   2. proyecto nuevo con el título del anuncio, el archivo a Multimedia (el mismo
//      camino que «Importar», así queda en el almacenamiento local del workspace)
//      y el clip en la PISTA PRINCIPAL desde el cero. El primer clip visual le
//      da al lienzo su tamaño y sus fps (InsertElementCommand): un anuncio 9:16
//      abre en 9:16, como en CapCut;
//   3. se guarda y se REEMPLAZA la URL por la del proyecto, sin el `?desde=`:
//      refrescar o volver atrás no importa el anuncio dos veces.
//
// ⚠️ CORS: medido el 11/10/2026 con curl contra el bucket público `video-clips`
// (un `toma-1.mp4` real, `Origin: https://hola-mako.com`): `206` con
// `Access-Control-Allow-Origin: *`, y el preflight con `Range` también pasa. Por
// eso se baja directo, sin una ruta proxy. Si el bucket dejara de ser público o
// cambiara su CORS, esto falla con «error en la red» y hace falta servirlo por una
// ruta autenticada.
//
// ⚠️ El pestillo es un REF y el efecto NO cancela en su cleanup. Con StrictMode el
// efecto corre, se limpia y vuelve a correr sobre la MISMA instancia: si el cleanup
// cancelara, la primera corrida quedaría cancelada y el pestillo frenaría la
// segunda — o sea, nunca se importaría nada. Y sin pestillo serían dos proyectos.

import { useEffect, useRef, useState } from "react";
import Link, { useRouter } from "@/app/_ui/Link";
import { Loader2 } from "lucide-react";
import { EditorCore } from "@/app/video-editor/_opencut/core";
import { importarArchivos } from "@/app/video-editor/_opencut/media/importar";
import { buildElementFromMedia } from "@/app/video-editor/_opencut/timeline/element-utils";
import { DEFAULT_NEW_ELEMENT_DURATION } from "@/app/video-editor/_opencut/timeline/creation";
import { mediaTimeFromSeconds, ZERO_MEDIA_TIME } from "@/app/video-editor/_opencut/wasm";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { Progress } from "@/app/video-editor/_opencut/components/ui/progress";
import { conEspacio } from "@/app/video-editor/espacio";
import type { DesdeEditor } from "./desde";
import { bajarVideo } from "./bajar";

type Listo = Extract<DesdeEditor, { estado: "listo" }>;

/** De qué lado falló: la red (bajar) o el motor (procesar y guardar). */
class FalloImportar extends Error {
	constructor(readonly donde: "red" | "importar") {
		super(donde);
	}
}

/**
 * Las importaciones en vuelo, por espacio local y ref. Sobrevive a un remontaje
 * del componente (el pestillo de abajo no): dos montajes del mismo `?desde=`
 * esperan la MISMA promesa en vez de armar dos proyectos.
 */
const enVuelo = new Map<string, Promise<string>>();

async function importar(desde: Listo, alAvanzar: (pct: number) => void): Promise<string> {
	const blob = await bajarVideo(desde.url, alAvanzar).catch(() => {
		throw new FalloImportar("red");
	});
	const editor = EditorCore.getInstance();
	const id = await editor.project.createNewProject({ name: desde.titulo });
	try {
		const archivo = new File([blob], desde.archivo, { type: blob.type || "video/mp4" });
		const [medio] = await importarArchivos({ editor, files: [archivo] });
		if (!medio) throw new FalloImportar("importar");
		const principal = editor.scenes.getActiveScene().tracks.main;
		editor.timeline.insertElement({
			element: buildElementFromMedia({
				mediaId: medio.id,
				mediaType: medio.type,
				name: medio.name,
				duration:
					medio.duration != null
						? mediaTimeFromSeconds({ seconds: medio.duration })
						: DEFAULT_NEW_ELEMENT_DURATION,
				startTime: ZERO_MEDIA_TIME,
			}),
			placement: { mode: "explicit", trackId: principal.id },
		});
		await editor.project.saveCurrentProject();
		return id;
	} catch (e) {
		// Un proyecto vacío con el nombre del anuncio se lee en el inicio como «ya
		// lo importé»: se borra antes de decir que falló.
		await editor.project.deleteProjects({ ids: [id] }).catch(() => {});
		throw e instanceof FalloImportar ? e : new FalloImportar("importar");
	}
}

type Fase =
	| { fase: "bajando"; pct: number }
	| { fase: "fallo"; donde: "red" | "importar" };

export function ImportarDesde({ desde }: { desde: DesdeEditor }) {
	if (desde.estado !== "listo") return <SinAnuncio estado={desde.estado} />;
	return <Importando desde={desde} />;
}

function Importando({ desde }: { desde: Listo }) {
	const router = useRouter();
	const [fase, setFase] = useState<Fase>({ fase: "bajando", pct: 0 });
	const [intento, setIntento] = useState(0);
	const arrancado = useRef(-1);

	useEffect(() => {
		if (arrancado.current === intento) return;
		arrancado.current = intento;
		const clave = `${conEspacio("")}|${desde.ref}`;
		let promesa = enVuelo.get(clave);
		if (!promesa) {
			promesa = importar(desde, (pct) => setFase({ fase: "bajando", pct }));
			enVuelo.set(clave, promesa);
			// Al terminar (bien o mal) sale del mapa: «Editar en el editor» otra vez,
			// más tarde y en la misma pestaña, es OTRO proyecto, como en CapCut.
			promesa.finally(() => enVuelo.delete(clave)).catch(() => {});
		}
		promesa
			.then((id) => router.replace(`/video-editor/${id}`))
			.catch((e) => setFase({ fase: "fallo", donde: e instanceof FalloImportar ? e.donde : "importar" }));
	}, [desde, intento, router]);

	if (fase.fase === "fallo") {
		return (
			<Pantalla>
				<p className="text-[12px] text-(--cc-text)">
					{fase.donde === "red"
						? "Se produjo un error en la red durante la descarga."
						: "No se pudo importar el anuncio."}
				</p>
				<div className="flex gap-2">
					<Button
						variant="default"
						onClick={() => {
							setFase({ fase: "bajando", pct: 0 });
							setIntento((n) => n + 1);
						}}
					>
						Intentar de nuevo
					</Button>
					<Button variant="secondary" asChild>
						<Link href="/video-generator">Volver</Link>
					</Button>
				</div>
			</Pantalla>
		);
	}

	return (
		<Pantalla>
			<Loader2 className="size-8 animate-spin text-muted-foreground" />
			<p className="max-w-[320px] truncate text-[12px] text-(--cc-text)" title={desde.titulo}>
				{desde.titulo}
			</p>
			<div className="flex w-[240px] flex-col items-center gap-1.5">
				<Progress value={fase.pct} className="h-1 bg-(--cc-raised)" />
				<span className="text-[11px] text-muted-foreground tabular-nums">Importando… {fase.pct}%</span>
			</div>
		</Pantalla>
	);
}

/** La ref no resolvió: decirlo, y dejar las dos salidas (otro proyecto o volver). */
function SinAnuncio({ estado }: { estado: "no-esta" | "error" }) {
	const router = useRouter();
	return (
		<Pantalla>
			<p className="text-[12px] text-(--cc-text)">
				{estado === "no-esta" ? "Ese anuncio ya no está." : "No se pudo leer el anuncio."}
			</p>
			<div className="flex gap-2">
				{estado === "error" ? (
					<Button variant="default" onClick={() => router.refresh()}>
						Intentar de nuevo
					</Button>
				) : (
					<Button variant="default" asChild>
						<Link href="/video-editor/nuevo">Nuevo proyecto</Link>
					</Button>
				)}
				<Button variant="secondary" asChild>
					<Link href="/video-generator">Volver</Link>
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
