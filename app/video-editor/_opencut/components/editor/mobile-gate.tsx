"use client";

// =============================================================================
// Pantallas chicas: el editor es de escritorio, como CapCut Desktop
// =============================================================================
// Por debajo de 1024 px de ancho los cuatro paneles no entran. En vez de un
// editor roto, un aviso con dos salidas: volver, o entrar igual (se recuerda en
// este navegador). Sin el «Roadmap» de OpenCut, que llevaba a una página que en
// MaKo no existe.
//
// Desde el 27/10/2026 el aviso va a la derecha de la tarjeta de MaKo (../../../marco.tsx) y «Atrás» NO navega: lo decide
// el marco (en el teléfono vuelve a la tarjeta del chat; en una tablet, al inicio en el lugar). El chat se usa igual con
// el aviso puesto: el proyecto se carga por fuera (editor-page.tsx).

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ComputerIcon } from "@hugeicons/core-free-icons";

const STORAGE_KEY = "mobile-acknowledged";

export function MobileGate({ children, onAtras }: { children: React.ReactNode; onAtras?: () => void }) {
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
		<div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-(--cc-app)">
			{onAtras && (
				<button
					type="button"
					onClick={onAtras}
					className="absolute top-5 left-4 flex cursor-pointer items-center gap-1 text-[13px] text-(--cc-text-2)"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
					Atrás
				</button>
			)}

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
