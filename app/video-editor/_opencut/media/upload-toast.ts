// El toast de importar archivos a la biblioteca. Los textos son los de CapCut
// («Importando…», «Importado», «Importado (%1)», «No se pudo importar»), cortos:
// el nombre del archivo ya se ve en la grilla.

import { toast } from "sonner";

export interface MediaUploadToastResult {
	uploadedCount: number;
	assetNames?: string[];
}

function waitForNextPaint(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resolve());
		});
	});
}

export async function showMediaUploadToast<T extends MediaUploadToastResult>({
	filesCount: _filesCount,
	promise,
}: {
	filesCount: number;
	promise: Promise<T> | (() => Promise<T>);
}) {
	const run = typeof promise === "function" ? promise : () => promise;
	const toastPromise = toast.promise(
		async () => {
			await waitForNextPaint();
			return run();
		},
		{
			loading: "Importando…",
			success: ({ uploadedCount }) => {
				if (uploadedCount === 1) return "Importado";
				if (uploadedCount > 1) return `Importado (${uploadedCount})`;
				return "No se pudo importar";
			},
			error: "No se pudo importar",
		},
	);

	return toastPromise.unwrap();
}
