// =============================================================================
// «Exportar a»: la carpeta donde quedan los archivos
// =============================================================================
// CapCut escribe en una carpeta del disco. En el navegador hay dos caminos:
//
// · Chrome/Edge tienen `showDirectoryPicker` (File System Access): la persona
//   elige una carpeta UNA vez por sesión y los archivos se escriben ahí, uno al
//   lado del otro, como en CapCut. El permiso vive mientras la pestaña viva; la
//   carpeta elegida se guarda en memoria (no en IndexedDB) a propósito: un
//   permiso de escritura que sobrevive al cierre es más de lo que pidió.
// · Sin esa API (Firefox, Safari) o sin carpeta elegida: la descarga normal del
//   navegador, que cae en «Descargas».
//
// ⚠️ Varias descargas seguidas (video + audio + SRT + GIF) disparan en Chrome el
// permiso «descargar varios archivos» la primera vez: es del navegador, no un error.

type ManejadorCarpeta = {
	name: string;
	getFileHandle(nombre: string, opciones: { create: boolean }): Promise<{
		createWritable(): Promise<{ write(datos: Blob): Promise<void>; close(): Promise<void> }>;
	}>;
};

type VentanaConCarpetas = Window & {
	showDirectoryPicker?: (opciones?: { mode?: "read" | "readwrite"; id?: string }) => Promise<ManejadorCarpeta>;
};

let carpeta: ManejadorCarpeta | null = null;

export function puedeElegirCarpeta(): boolean {
	return typeof window !== "undefined" && typeof (window as VentanaConCarpetas).showDirectoryPicker === "function";
}

export function carpetaElegida(): string | null {
	return carpeta?.name ?? null;
}

/** Devuelve el nombre de la carpeta, o null si la persona cerró el selector. */
export async function elegirCarpeta(): Promise<string | null> {
	const picker = (window as VentanaConCarpetas).showDirectoryPicker;
	if (!picker) return null;
	try {
		carpeta = await picker({ mode: "readwrite", id: "mako-video-editor-exportar" });
		return carpeta.name;
	} catch {
		// AbortError = cerró el selector: no es un error, queda la carpeta anterior.
		return carpeta?.name ?? null;
	}
}

/** `Mi video: final?` → `Mi video- final-`: lo que Windows no acepta en un nombre de archivo. */
export function nombreArchivo(nombre: string): string {
	return nombre.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "video";
}

export async function guardarArchivo({ blob, nombre }: { blob: Blob; nombre: string }): Promise<void> {
	if (carpeta) {
		try {
			const archivo = await carpeta.getFileHandle(nombre, { create: true });
			const escritor = await archivo.createWritable();
			await escritor.write(blob);
			await escritor.close();
			return;
		} catch (error) {
			// Permiso revocado o carpeta borrada: se olvida y cae a la descarga, que
			// siempre anda. Perder el archivo exportado por la carpeta sería peor.
			console.warn("[exportar] no se pudo escribir en la carpeta elegida; va a Descargas", error);
			carpeta = null;
		}
	}
	descargar({ blob, nombre });
}

/**
 * La descarga del navegador. La URL se revoca DESPUÉS (no en la misma vuelta,
 * como `downloadBlob` de utils/browser): con varios archivos seguidos, Firefox
 * cancela la descarga cuyo blob ya se revocó.
 */
function descargar({ blob, nombre }: { blob: Blob; nombre: string }): void {
	const url = URL.createObjectURL(blob);
	const enlace = document.createElement("a");
	enlace.href = url;
	enlace.download = nombre;
	document.body.appendChild(enlace);
	enlace.click();
	enlace.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
