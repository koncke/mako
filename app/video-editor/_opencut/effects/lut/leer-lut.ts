// =============================================================================
// Leer una LUT 3D: .cube (Adobe/Resolve) y .3dl (Autodesk/Lustre)
// =============================================================================
// CapCut importa «Archivos CUBE y 3DL» (Ajuste › LUT y Ajustar › LUT). Las dos
// son texto plano con N³ puntos de salida RGB:
//
//   .cube   `LUT_3D_SIZE N`, opcional `DOMAIN_MIN/MAX`, y N³ líneas «r g b» en
//           0..1 (o en el dominio), con R variando MÁS RÁPIDO.
//   .3dl    una primera línea con los N valores de entrada de la malla
//           («0 64 128 … 1023»), y N³ líneas de enteros «r g b» (10, 12 o 16
//           bits según el máximo), con B variando más rápido.
//
// Sale siempre en el orden que espera pases-ce.ts (R más rápido), RGBA8.
// Una LUT 1D (`LUT_1D_SIZE`) o un archivo roto tira un error con el texto que
// se muestra («Se detectaron archivos LUT no compatibles»).

export type LutLeida = { tamano: number; rgba: Uint8Array };

export const LUT_NO_COMPATIBLE = "Se detectaron archivos LUT no compatibles";

const TAMANO_MAXIMO = 65;

function aByte(v: number): number {
	return Math.max(0, Math.min(255, Math.round(v * 255)));
}

function numeros(linea: string): number[] | null {
	const partes = linea.trim().split(/\s+/);
	if (partes.length < 3) return null;
	const ns = partes.slice(0, 3).map(Number);
	return ns.every(Number.isFinite) ? ns : null;
}

export function leerCube(texto: string): LutLeida {
	let tamano = 0;
	let min = [0, 0, 0];
	let max = [1, 1, 1];
	const puntos: number[][] = [];
	for (const cruda of texto.split(/\r?\n/)) {
		const linea = cruda.trim();
		if (!linea || linea.startsWith("#")) continue;
		const clave = linea.split(/\s+/)[0]?.toUpperCase();
		if (clave === "LUT_1D_SIZE") throw new Error(LUT_NO_COMPATIBLE);
		if (clave === "LUT_3D_SIZE") {
			tamano = Number.parseInt(linea.split(/\s+/)[1] ?? "", 10);
			continue;
		}
		if (clave === "DOMAIN_MIN" || clave === "DOMAIN_MAX") {
			const v = numeros(linea.slice(clave.length));
			if (v) (clave === "DOMAIN_MIN" ? (min = v) : (max = v));
			continue;
		}
		if (clave === "TITLE" || clave === "LUT_3D_INPUT_RANGE" || /^[A-Z_]+$/.test(clave ?? "")) continue;
		const v = numeros(linea);
		if (v) puntos.push(v);
	}
	if (!(tamano >= 2 && tamano <= TAMANO_MAXIMO) || puntos.length !== tamano ** 3) {
		throw new Error(LUT_NO_COMPATIBLE);
	}
	const rgba = new Uint8Array(tamano ** 3 * 4);
	puntos.forEach((v, i) => {
		for (let c = 0; c < 3; c++) {
			const rango = max[c] - min[c] || 1;
			rgba[i * 4 + c] = aByte((v[c] - min[c]) / rango);
		}
		rgba[i * 4 + 3] = 255;
	});
	return { tamano, rgba };
}

export function leer3dl(texto: string): LutLeida {
	const lineas = texto
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith("#") && !/^[A-Za-z]/.test(l));
	// La PRIMERA línea de números es la malla de entrada, tenga los que tenga (con
	// N = 3 tiene 3, igual que un punto: no se la puede reconocer por el largo).
	const indiceMalla = 0;
	if (lineas.length === 0) throw new Error(LUT_NO_COMPATIBLE);
	const tamano = lineas[indiceMalla].split(/\s+/).length;
	const puntos = lineas
		.slice(indiceMalla + 1)
		.map(numeros)
		.filter((v): v is number[] => v !== null);
	if (!(tamano >= 2 && tamano <= TAMANO_MAXIMO) || puntos.length < tamano ** 3) {
		throw new Error(LUT_NO_COMPATIBLE);
	}
	// Sin `Math.max(...)`: 33³·3 argumentos revientan la pila de llamadas.
	let maximo = 0;
	for (let i = 0; i < tamano ** 3; i++) maximo = Math.max(maximo, puntos[i][0], puntos[i][1], puntos[i][2]);
	const tope = maximo <= 1023 ? 1023 : maximo <= 4095 ? 4095 : 65535;
	const rgba = new Uint8Array(tamano ** 3 * 4);
	// En el .3dl el índice de la línea es ((r·N)+g)·N+b; en la textura, ((b·N)+g)·N+r.
	for (let r = 0; r < tamano; r++) {
		for (let g = 0; g < tamano; g++) {
			for (let b = 0; b < tamano; b++) {
				const v = puntos[(r * tamano + g) * tamano + b];
				const i = ((b * tamano + g) * tamano + r) * 4;
				rgba[i] = aByte(v[0] / tope);
				rgba[i + 1] = aByte(v[1] / tope);
				rgba[i + 2] = aByte(v[2] / tope);
				rgba[i + 3] = 255;
			}
		}
	}
	return { tamano, rgba };
}

/** Lee un archivo .cube o .3dl (por la extensión). */
export async function leerArchivoLut(archivo: File): Promise<LutLeida> {
	const texto = await archivo.text();
	const nombre = archivo.name.toLowerCase();
	if (nombre.endsWith(".3dl")) return leer3dl(texto);
	if (nombre.endsWith(".cube")) return leerCube(texto);
	throw new Error(LUT_NO_COMPATIBLE);
}
