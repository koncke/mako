// =============================================================================
// Las fuentes de MUESTRA de las miniaturas (Plantillas de subtítulos, Efectos y
// Plantillas de texto): sólo las letras que se ven, y recién en pantalla
// =============================================================================
// Hasta el 15/10/2026 cada biblioteca, al abrirse, cargaba ENTERAS las familias de
// todas sus tarjetas (`loadFonts` → un `<link>` de Google Fonts por familia, con
// todos sus subconjuntos y pesos). Medido en producción con Long Animation Frames:
// abrir Subtítulos › Plantillas agregaba 5 hojas y 38 caras de golpe, con ~2,6 s de
// bloqueo, y en un proyecto con video dejó la pestaña colgada (hallazgos →
// «lo que se cuelga no es el karaoke»).
//
// Como el menú de fuentes de Google (y CapCut y Canva, que muestran imágenes): la
// miniatura pide SÓLO los caracteres que dibuja (`&text=`), bajo un nombre de
// familia propio («Anton · muestra»), así no pisa la fuente entera ni declara sus
// subconjuntos; y la pide cuando la tarjeta entra en pantalla (IntersectionObserver).
// La fuente ENTERA se carga al elegir la tarjeta o al pasar el mouse por encima
// (antes de arrastrarla): soltar una tarjeta sin su fuente dibujaría la primera
// textura con la de respaldo, y el compositor no la vuelve a pedir.
//
// Lo de armar la URL y leer la respuesta es puro, con test
// (tests/video-editor-fuentes.test.ts); cargar y observar, del navegador.
// =============================================================================

import { useEffect, useState, type RefObject } from "react";
import { SYSTEM_FONTS } from "./system-fonts";

const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2";
export const SUFIJO_MUESTRA = " · muestra";

/** Los caracteres distintos de lo que dibuja la miniatura, en orden (sin espacios). */
export function letrasDe(texto: string): string {
	return [...new Set(Array.from(texto.replace(/\s+/g, "")))].sort().join("");
}

/** La hoja de Google con SÓLO esas letras. Sin `wght` para el 400 (hay familias con un solo peso). */
export function urlMuestra({ familia, peso, texto }: { familia: string; peso: number; texto: string }): string {
	const fam = familia.trim().replace(/ /g, "+");
	const conPeso = peso !== 400 ? `${fam}:wght@${peso}` : fam;
	return `${GOOGLE_FONTS_CSS}?family=${conPeso}&text=${encodeURIComponent(letrasDe(texto))}`;
}

/** El archivo de la cara que devuelve Google (la primera `url(…)`), o null. */
export function urlDeCssMuestra(css: string): string | null {
	const m = /src:\s*url\(\s*['"]?([^'")\s]+)['"]?\s*\)/.exec(css);
	return m ? m[1] : null;
}

/** El nombre de familia de la muestra: no pisa a la fuente entera. */
export const familiaMuestra = (familia: string, peso: number) => `${familia}${SUFIJO_MUESTRA} ${peso}`;

const enVuelo = new Map<string, Promise<string | null>>();

async function pedirCss(url: string): Promise<string | null> {
	try {
		const r = await fetch(url);
		if (!r.ok) return null;
		const css = await r.text();
		// Un 200 con HTML no es una hoja (AGENTS.md → «El 200 también puede ser NUESTRO»).
		return css.includes("@font-face") ? css : null;
	} catch {
		return null;
	}
}

/**
 * Carga la muestra y devuelve el nombre de familia que hay que usar en el CSS, o null
 * si no se pudo (la miniatura queda con la de respaldo). Una fuente del sistema no se
 * pide: se devuelve tal cual. Si el peso no existe en esa familia (Anton en negrita),
 * se pide la normal y el navegador la engrosa.
 */
export function cargarMuestra({ familia, peso, texto }: { familia: string; peso: number; texto: string }): Promise<string | null> {
	if (!familia || SYSTEM_FONTS.has(familia)) return Promise.resolve(familia || null);
	if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve(null);
	const clave = `${familia}|${peso}|${letrasDe(texto)}`;
	const ya = enVuelo.get(clave);
	if (ya) return ya;
	const promesa = (async () => {
		let css = await pedirCss(urlMuestra({ familia, peso, texto }));
		if (!css && peso !== 400) css = await pedirCss(urlMuestra({ familia, peso: 400, texto }));
		const archivo = css ? urlDeCssMuestra(css) : null;
		if (!archivo) return null;
		const nombre = familiaMuestra(familia, peso);
		try {
			const cara = new FontFace(nombre, `url(${archivo})`, { weight: String(peso) });
			await cara.load();
			document.fonts.add(cara);
			return nombre;
		} catch {
			return null;
		}
	})();
	enVuelo.set(clave, promesa);
	return promesa;
}

/**
 * El nombre de familia para la miniatura que está en `ref`: null hasta que la tarjeta
 * entra en pantalla y llega su muestra (mientras, la de respaldo).
 */
export function useFuenteMuestra({
	ref,
	familia,
	peso,
	texto,
}: {
	ref: RefObject<Element | null>;
	familia: string | null | undefined;
	peso: number;
	texto: string;
}): string | null {
	const [nombre, setNombre] = useState<string | null>(null);
	useEffect(() => {
		setNombre(null);
		const el = ref.current;
		if (!el || !familia) return;
		let vivo = true;
		const pedir = () =>
			void cargarMuestra({ familia, peso, texto }).then((n) => {
				if (vivo) setNombre(n);
			});
		if (typeof IntersectionObserver === "undefined") {
			pedir();
			return () => {
				vivo = false;
			};
		}
		const obs = new IntersectionObserver(
			(entradas) => {
				if (!entradas.some((e) => e.isIntersecting)) return;
				obs.disconnect();
				pedir();
			},
			{ rootMargin: "100px" },
		);
		obs.observe(el);
		return () => {
			vivo = false;
			obs.disconnect();
		};
	}, [ref, familia, peso, texto]);
	return nombre;
}

/** El `font-family` del CSS de una miniatura: la muestra si llegó, si no la de respaldo. */
export const cssFamilia = (muestra: string | null) => (muestra ? `"${muestra.replace(/"/g, "")}", sans-serif` : "sans-serif");
