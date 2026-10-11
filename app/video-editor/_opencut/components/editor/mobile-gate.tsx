"use client";

// =============================================================================
// Pantallas chicas: el editor es de escritorio, como CapCut Desktop
// =============================================================================
// Por debajo de 1024 px de ancho los cuatro paneles no entran. En vez de un
// editor roto, un aviso con dos salidas: volver, o entrar igual (se recuerda en
// este navegador). Sin el «Roadmap» de OpenCut, que llevaba a una página que en
// MaKo no existe.

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ComputerIcon } from "@hugeicons/core-free-icons";
import { useRouter } from "@/app/_ui/Link";
import { rutaEditor } from "@/app/video-editor/ruta";

const STORAGE_KEY = "mobile-acknowledged";

export function MobileGate({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	// El editor se monta sólo en el navegador (VideoEditorCliente, `ssr: false`):
	// `window` y `localStorage` existen ya en el primer dibujo.
	const [show, setShow] = useState(() => {
		let visto = false;
		try {
			visto = localStorage.getItem(STORAGE_KEY) === "true";
		} catch {
			// Sin almacenamiento: se vuelve a preguntar la próxima vez, nada más.
		}
		return window.innerWidth < 1024 && !visto;
	});

	if (!show) return <>{children}</>;

	const entrarIgual = () => {
		try {
			localStorage.setItem(STORAGE_KEY, "true");
		} catch {
			// Idem: la decisión vale para esta vez.
		}
		setShow(false);
	};

	return (
		<div className="relative flex h-full w-full flex-col overflow-hidden bg-(--cc-app)">
			<button
				type="button"
				onClick={() => router.push(rutaEditor("/video-editor"))}
				className="absolute top-5 left-4 flex cursor-pointer items-center gap-1 text-[13px] text-(--cc-text-2)"
			>
				<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
				Atrás
			</button>

			<div className="flex flex-1 flex-col justify-center gap-5 px-6">
				<HugeiconsIcon icon={ComputerIcon} className="size-10 text-primary" />
				<div className="flex flex-col gap-2">
					<h1 className="text-[22px] font-semibold text-(--cc-text)">Solo para computadora</h1>
					<p className="text-[14px] leading-relaxed text-(--cc-text-3)">
						El editor necesita una pantalla más grande.
					</p>
				</div>
				<div>
					<button
						type="button"
						onClick={entrarIgual}
						className="h-9 cursor-pointer rounded-[4px] bg-(--cc-raised) px-4 text-[13px] text-(--cc-text) hover:brightness-110"
					>
						Continuar
					</button>
				</div>
			</div>
		</div>
	);
}
