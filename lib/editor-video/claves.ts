// =============================================================================
// «Resaltar palabras clave automáticamente»: qué palabra de cada subtítulo va de color
// =============================================================================
// Pedido de Leila (llamada del 30/10/2026): el interruptor de «Subtítulos automáticos»
// estaba en «Próximamente». Las apps de subtítulos (Submagic, Opus Clip) pintan de otro
// color la palabra que carga el sentido de cada subtítulo («GRATIS», «$500», el nombre
// de la marca): se lee de un vistazo con el video sin sonido.
//
// QUÉ SE ELIGE (sin IA, en el navegador, gratis): por subtítulo, la palabra que más
// pesa según reglas que se prueban (tests/video-editor-subtitulos-claves.test.ts):
//   · las que la marca pidió siempre (`siempre`, del preset de la marca);
//   · números, montos y porcentajes («500», «$1.200», «30%»);
//   · palabras de venta («gratis», «garantía», «hoy», «secreto»…) y números dichos
//     con letras («mil», «doble»);
//   · nombres propios (una mayúscula que no abre la frase);
//   · si no hay nada de eso, la palabra de contenido más larga, pero sólo si tiene
//     peso (≥ 6 letras): un subtítulo de puras palabras cortas («y entonces lo vi») no
//     lleva ninguna. Resaltar por resaltar es lo que hace que no se note la que importa.
// Una por subtítulo (dos si es largo). La que ya se resaltó en los dos subtítulos de
// antes pierde puntos: la misma palabra de color tres veces seguidas deja de decir algo.
//
// DÓNDE: en el parámetro `subtitulo.claves` de cada subtítulo, como las palabras
// NORMALIZADAS (sin tildes ni mayúsculas ni signos) separadas por «|». Se guardan las
// palabras y no sus posiciones: corregir el texto (una letra, una palabra de al lado)
// no corre el resaltado a otra palabra, y «Dividir» deja a cada mitad con lo suyo.
// Lo dibuja text/resaltado.ts (`clavesDe`) con el color `subtitulo.clavesColor`.
//
// ⚠️ `subtitulo.claves` NO es estilo: es de SU texto, como los tiempos por palabra. No
// viaja con «Aplicar en todos los subtítulos» (subtitles/insert.ts → NO_ESTILO) y no se
// declara en params/extra (lo declarado se dibuja como control).
//
// Puro: sin canvas, sin motor y sin `wasm` (lo importan los tests, el chat y el B-roll, ./broll.ts). Vive en lib/
// desde el 06/11/2026 para que la ruta del B-roll lo pueda usar (un módulo del servidor no importa el motor);
// app/video-editor/_opencut/subtitles/claves.ts lo re-exporta.

export const PARAM_CLAVES = "subtitulo.claves";

/** Cuántas palabras clave como mucho en un subtítulo corto y en uno largo (≥ 8 palabras). */
export const MAX_CLAVES = { corto: 1, largo: 2, largoDesde: 8 } as const;
/** Lo mínimo para resaltar una palabra (una de contenido de 6 letras da 3). */
export const PUNTAJE_MINIMO = 3;
/**
 * Lo que pierde la que ya se resaltó en los dos subtítulos de antes. 5: una palabra de
 * venta (7) queda por debajo del mínimo, y un número (10) sigue pasando.
 */
export const PENALIZACION_REPETIDA = 5;
/** Las palabras que la marca pide siempre y lo que se guarda por subtítulo: con tope. */
export const TOPES_CLAVES = { siempre: 30, palabra: 40, porSubtitulo: 6 } as const;

/** Sin tildes, en minúscula y sin signos al principio ni al final («¡GRATIS!» → «gratis», «$500» → «500»). */
export function normalizarClave(palabra: string): string {
	return palabra
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** Las palabras del texto como las cuenta el dibujo (separadas por espacios). */
export function palabrasDelTexto(texto: string): string[] {
	return texto.split(/\s+/).filter(Boolean);
}

/** Lo que se guarda: las claves normalizadas, sin repetir, con tope. */
export function codificarClaves(claves: readonly string[]): string {
	const vistas = new Set<string>();
	for (const c of claves) {
		const n = normalizarClave(c).slice(0, TOPES_CLAVES.palabra);
		if (n && !n.includes("|")) vistas.add(n);
		if (vistas.size >= TOPES_CLAVES.porSubtitulo) break;
	}
	return [...vistas].join("|");
}

/** Lo guardado, leído. Cualquier cosa que no sea un string da ninguna. */
export function leerClaves(param: unknown): string[] {
	if (typeof param !== "string" || !param) return [];
	return param.split("|").map(normalizarClave).filter(Boolean).slice(0, TOPES_CLAVES.porSubtitulo);
}

// ── Lo que se calcula en cada cuadro, leído una vez ──────────────────────────

const TOPE_CACHE = 512;
const cache = new Map<string, readonly number[]>();

/**
 * Qué palabras del texto (contadas en orden, como el dibujo) son clave. Vacío si no
 * hay claves o ninguna aparece en el texto (lo reescribieron). Con caché: se llama en
 * cada cuadro por cada texto visible.
 */
export function indicesDeClaves(contenido: string, param: unknown): readonly number[] {
	if (typeof param !== "string" || !param) return [];
	const clave = `${contenido}\u0000${param}`;
	const guardado = cache.get(clave);
	if (guardado) return guardado;
	const claves = new Set(leerClaves(param));
	const indices: number[] = [];
	palabrasDelTexto(contenido).forEach((p, i) => {
		if (claves.has(normalizarClave(p))) indices.push(i);
	});
	if (cache.size >= TOPE_CACHE) {
		const vieja = cache.keys().next().value;
		if (vieja !== undefined) cache.delete(vieja);
	}
	cache.set(clave, indices);
	return indices;
}

// ── Elegir ───────────────────────────────────────────────────────────────────

/** Las que nunca son clave: artículos, preposiciones, pronombres y verbos de relleno (normalizadas). */
const VACIAS = new Set(
	(
		"a al algo alguien algun alguna algunas alguno algunos ante antes aqui ahi alli asi aun como con contra cual cuales cuando " +
		"de del desde donde durante e el ella ellas ello ellos en entre era eres es esa esas ese eso esos esta estas este esto estos " +
		"estoy estamos estan estar estas fue fueron ha han has hay he hemos haber habia la las le les lo los me mi mis mucho mucha " +
		"muchos muchas muy mas nada nadie ni no nos nosotros o os otra otro otras otros para pero poco por porque pues que quien " +
		"se ser sea si sin sobre son su sus tambien tampoco tan te tener tengo tienes tiene tenemos tienen ti todo toda todos todas " +
		"tu tus un una uno unos unas ya yo y voy vas va vamos van hacer hago haces hace hacemos hacen entonces bueno este osea cosa " +
		"cosas puedo puedes puede podemos pueden poder quiero quieres quiere decir digo dice dijo ver veo solo cada mismo misma " +
		"usted ustedes ahora okay ok eh mira oye sabes " +
		"the a an and or to of in on for is are it you i we this that with be so but my your just like"
	).split(/\s+/),
);

/** Las que venden: pesan aunque sean cortas (normalizadas). */
const DE_VENTA = new Set(
	(
		"gratis gratuito gratuita nuevo nueva nuevos nuevas hoy secreto secretos garantia garantizado garantizada facil " +
		"rapido rapida nunca jamas siempre error errores dinero clientes cliente ventas venta vender resultados resultado exito " +
		"ganar gana ganancia ganancias mejor peor unico unica exclusivo exclusiva oferta descuento ahorra ahorro ahorrar " +
		"prohibido verdad mentira problema problemas solucion clave importante urgente ultimo ultima limitado limitada " +
		"increible bono regalo inversion negocio crecer escalar facturar facturacion ingresos metodo sistema estrategia " +
		"cuidado alerta atencion stop ojo free new now secret best never"
	).split(/\s+/),
);

/** Números dichos con letras. */
const NUMEROS_EN_LETRAS = new Set(
	"dos tres cuatro cinco seis siete ocho nueve diez cien cientos mil millon millones doble triple mitad cero".split(/\s+/),
);

const FIN_DE_FRASE = /[.!?¿¡…:]$/;

export type OpcionesClaves = {
	/** Palabras de la marca que se resaltan siempre que se dicen (del preset). */
	siempre?: readonly string[];
	/** Cuántas por subtítulo (por defecto, MAX_CLAVES). */
	maxPorSubtitulo?: number;
};

type Candidata = { norm: string; puntaje: number; orden: number; largo: number };

/** El peso de una palabra en su subtítulo (0 = no es candidata). */
export function puntajeDePalabra(
	original: string,
	i: number,
	palabras: readonly string[],
	siempre: ReadonlySet<string>,
): number {
	const norm = normalizarClave(original);
	if (!norm) return 0;
	if (siempre.has(norm)) return 20;
	// Un número, un monto o un porcentaje: lo que más se mira sin sonido.
	if (/\p{N}/u.test(norm)) return 10;
	if (VACIAS.has(norm)) return 0;
	let puntaje: number;
	if (NUMEROS_EN_LETRAS.has(norm)) puntaje = 8;
	else if (DE_VENTA.has(norm)) puntaje = 7;
	else if (norm.length >= 9) puntaje = 4;
	else if (norm.length >= 6) puntaje = 3;
	else if (norm.length >= 4) puntaje = 2;
	else puntaje = 1;
	// Un nombre propio: mayúscula que no abre la frase (Whisper pone mayúscula al empezar).
	const primeraLetra = original.replace(/^[^\p{L}]+/u, "").charAt(0);
	const abreFrase = i === 0 || FIN_DE_FRASE.test(palabras[i - 1] ?? "");
	if (!abreFrase && primeraLetra && primeraLetra === primeraLetra.toUpperCase() && primeraLetra !== primeraLetra.toLowerCase()) {
		puntaje = Math.max(puntaje, 6);
	}
	if (/!$/.test(original)) puntaje += 2;
	return puntaje;
}

/**
 * Las palabras clave de cada subtítulo, en el orden de `textos`, normalizadas. Un
 * subtítulo sin ninguna que pese lo suficiente queda vacío.
 */
export function elegirClaves(textos: readonly string[], opciones: OpcionesClaves = {}): string[][] {
	const siempre = new Set((opciones.siempre ?? []).map(normalizarClave).filter(Boolean).slice(0, TOPES_CLAVES.siempre));
	const recientes: string[][] = [];
	return textos.map((texto) => {
		const palabras = palabrasDelTexto(texto);
		const tope = opciones.maxPorSubtitulo ?? (palabras.length >= MAX_CLAVES.largoDesde ? MAX_CLAVES.largo : MAX_CLAVES.corto);
		const yaUsadas = new Set(recientes.flat());
		const porNorm = new Map<string, Candidata>();
		palabras.forEach((p, i) => {
			let puntaje = puntajeDePalabra(p, i, palabras, siempre);
			if (puntaje <= 0) return;
			const norm = normalizarClave(p);
			// La misma de color en los dos subtítulos de antes: pierde (las de la marca, no).
			if (yaUsadas.has(norm) && !siempre.has(norm)) puntaje -= PENALIZACION_REPETIDA;
			const previa = porNorm.get(norm);
			if (!previa || puntaje > previa.puntaje) porNorm.set(norm, { norm, puntaje, orden: previa?.orden ?? i, largo: norm.length });
		});
		const ordenadas = [...porNorm.values()]
			.filter((c) => c.puntaje >= PUNTAJE_MINIMO)
			.sort((a, b) => b.puntaje - a.puntaje || b.largo - a.largo || a.orden - b.orden);
		// Las de la marca entran todas; el resto, hasta el tope.
		const deMarca = ordenadas.filter((c) => siempre.has(c.norm));
		const otras = ordenadas.filter((c) => !siempre.has(c.norm)).slice(0, Math.max(0, tope - deMarca.length));
		const elegidas = [...deMarca, ...otras].map((c) => c.norm);
		recientes.push(elegidas);
		if (recientes.length > 2) recientes.shift();
		return elegidas;
	});
}

/**
 * Las palabras que la persona nombró («resalta "gratis" y "hoy"»), en cada subtítulo
 * que las dice. Un subtítulo que no dice ninguna queda vacío.
 */
export function clavesNombradas(textos: readonly string[], nombradas: readonly string[]): string[][] {
	const pedidas = new Set(nombradas.map(normalizarClave).filter(Boolean));
	return textos.map((texto) => {
		const vistas = new Set<string>();
		for (const p of palabrasDelTexto(texto)) {
			const n = normalizarClave(p);
			if (pedidas.has(n)) vistas.add(n);
		}
		return [...vistas];
	});
}
