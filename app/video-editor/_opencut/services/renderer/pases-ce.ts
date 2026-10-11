// =============================================================================
// Pases de shader en TypeScript (WebGL2) — filtros, ajustes, croma, efectos
// =============================================================================
// El motor de OpenCut aplica efectos en su compositor de Rust compilado a WASM
// (`opencut-wasm`), que trae UN shader (desenfoque gaussiano) registrado a mano en
// Rust. Agregar los filtros, «Ajustar», el croma y las transiciones de CapCut por
// ese camino exige Rust + wasm-pack en el build. En vez de eso, este módulo
// ejecuta pases de fragment shader GLSL en un WebGL2 propio, en el MISMO punto
// donde el motor aplica efectos (`gpuRenderer.applyEffect`: un canvas entra, un
// canvas sale). Un pase cuyo `shader` empieza con `ce-` corre acá; el resto sigue
// yendo al WASM.
//
// Contrato de un shader (GLSL ES 3.00, sólo el fragment):
//   uniform sampler2D u_textura;   // la imagen de entrada (premultiplicada no)
//   uniform vec2 u_resolucion;     // ancho y alto en píxeles
//   in vec2 v_uv;                  // 0..1, (0,0) abajo a la izquierda
//   out vec4 colorSalida;
// más los uniforms propios: un número → float, [a,b] → vec2, [a,b,c] → vec3,
// [a,b,c,d] → vec4, más largo → float[] (declararlo con su tamaño).
// Un segundo canal de entrada (transiciones) se pasa con `fuenteB` y llega como
// `uniform sampler2D u_texturaB`.
//
// Orientación: la imagen se sube con UNPACK_FLIP_Y y el ÚLTIMO pase dibuja en el
// framebuffer del canvas, así la salida queda derecha. Los intermedios van en
// framebuffers con la misma convención.

import type { EffectPass } from "@/app/video-editor/_opencut/effects/types";

export const PREFIJO_PASE_CE = "ce-";

type Fuente = OffscreenCanvas | HTMLCanvasElement | ImageBitmap | HTMLVideoElement | HTMLImageElement | VideoFrame;

const VERTEX = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const shaders = new Map<string, string>();

/** Registra el fragment shader de un pase. El id tiene que empezar con `ce-`. */
export function registrarPase({ id, fragment }: { id: string; fragment: string }): void {
	if (!id.startsWith(PREFIJO_PASE_CE)) {
		throw new Error(`El pase «${id}» tiene que empezar con «${PREFIJO_PASE_CE}»`);
	}
	if (shaders.get(id) !== fragment) {
		shaders.set(id, fragment);
		programas.delete(id);
	}
}

export function esPaseCe(shader: string): boolean {
	return shader.startsWith(PREFIJO_PASE_CE);
}

// ── Estado de WebGL2 (uno por pestaña, perezoso) ─────────────────────────────

let canvas: OffscreenCanvas | null = null;
let gl: WebGL2RenderingContext | null = null;
let quad: WebGLBuffer | null = null;
let disponible: boolean | null = null;
const programas = new Map<string, { prog: WebGLProgram; ubic: Map<string, WebGLUniformLocation | null> }>();
const texturas: WebGLTexture[] = [];
const fbos: { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }[] = [];

function contexto(): WebGL2RenderingContext | null {
	if (disponible === false) return null;
	if (gl && !gl.isContextLost()) return gl;
	try {
		canvas = new OffscreenCanvas(2, 2);
		gl = canvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true }) as WebGL2RenderingContext | null;
	} catch {
		gl = null;
	}
	if (!gl) {
		disponible = false;
		console.warn("[pases-ce] WebGL2 no disponible: los filtros, ajustes y el croma no se aplican");
		return null;
	}
	disponible = true;
	programas.clear();
	texturas.length = 0;
	fbos.length = 0;
	quad = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, quad);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
	return gl;
}

function compilar(g: WebGL2RenderingContext, tipo: number, fuente: string, id: string): WebGLShader {
	const s = g.createShader(tipo);
	if (!s) throw new Error(`[pases-ce] no pude crear el shader ${id}`);
	g.shaderSource(s, fuente);
	g.compileShader(s);
	if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
		const log = g.getShaderInfoLog(s);
		g.deleteShader(s);
		throw new Error(`[pases-ce] el shader ${id} no compila: ${log}`);
	}
	return s;
}

function programa(g: WebGL2RenderingContext, id: string) {
	const ya = programas.get(id);
	if (ya) return ya;
	const fragment = shaders.get(id);
	if (!fragment) throw new Error(`[pases-ce] pase desconocido: ${id}`);
	const prog = g.createProgram();
	if (!prog) throw new Error(`[pases-ce] no pude crear el programa ${id}`);
	g.attachShader(prog, compilar(g, g.VERTEX_SHADER, VERTEX, id));
	g.attachShader(prog, compilar(g, g.FRAGMENT_SHADER, fragment, id));
	g.bindAttribLocation(prog, 0, "a_pos");
	g.linkProgram(prog);
	if (!g.getProgramParameter(prog, g.LINK_STATUS)) {
		throw new Error(`[pases-ce] el programa ${id} no enlaza: ${g.getProgramInfoLog(prog)}`);
	}
	const entrada = { prog, ubic: new Map<string, WebGLUniformLocation | null>() };
	programas.set(id, entrada);
	return entrada;
}

function textura(g: WebGL2RenderingContext, i: number): WebGLTexture {
	let t = texturas[i];
	if (!t) {
		t = g.createTexture() as WebGLTexture;
		g.bindTexture(g.TEXTURE_2D, t);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
		texturas[i] = t;
	}
	return t;
}

function subir(g: WebGL2RenderingContext, i: number, fuente: Fuente): WebGLTexture {
	const t = textura(g, i);
	g.bindTexture(g.TEXTURE_2D, t);
	g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
	g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, fuente as TexImageSource);
	g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
	return t;
}

function fbo(g: WebGL2RenderingContext, i: number, w: number, h: number) {
	let f = fbos[i];
	if (!f || f.w !== w || f.h !== h) {
		if (f) {
			g.deleteFramebuffer(f.fb);
			g.deleteTexture(f.tex);
		}
		const tex = g.createTexture() as WebGLTexture;
		g.bindTexture(g.TEXTURE_2D, tex);
		g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
		const fb = g.createFramebuffer() as WebGLFramebuffer;
		g.bindFramebuffer(g.FRAMEBUFFER, fb);
		g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
		f = { fb, tex, w, h };
		fbos[i] = f;
	}
	return f;
}

function ponerUniform(g: WebGL2RenderingContext, ubic: WebGLUniformLocation | null, valor: number | number[]) {
	if (!ubic) return;
	if (typeof valor === "number") g.uniform1f(ubic, valor);
	else if (valor.length === 2) g.uniform2fv(ubic, valor);
	else if (valor.length === 3) g.uniform3fv(ubic, valor);
	else if (valor.length === 4) g.uniform4fv(ubic, valor);
	else g.uniform1fv(ubic, valor);
}

/**
 * Corre los pases en orden y devuelve un canvas NUEVO con el resultado (el del
 * contexto se reusa en el próximo llamado: devolverlo sería devolver algo que
 * cambia abajo de quien lo está leyendo). Si WebGL2 no está, devuelve la fuente.
 */
export function aplicarPasesCe({
	source,
	width,
	height,
	passes,
	fuenteB,
}: {
	source: Fuente;
	width: number;
	height: number;
	passes: EffectPass[];
	fuenteB?: Fuente;
}): OffscreenCanvas {
	const g = contexto();
	const copiaFuente = () => {
		const c = new OffscreenCanvas(width, height);
		c.getContext("2d")?.drawImage(source as CanvasImageSource, 0, 0, width, height);
		return c;
	};
	if (!g || !canvas || passes.length === 0) {
		return source instanceof OffscreenCanvas ? source : copiaFuente();
	}
	try {
		canvas.width = width;
		canvas.height = height;
		let entrada = subir(g, 0, source);
		const texB = fuenteB ? subir(g, 1, fuenteB) : null;
		g.bindBuffer(g.ARRAY_BUFFER, quad);
		g.enableVertexAttribArray(0);
		g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
		passes.forEach((pase, i) => {
			const ultimo = i === passes.length - 1;
			const destino = ultimo ? null : fbo(g, i % 2, width, height);
			g.bindFramebuffer(g.FRAMEBUFFER, destino ? destino.fb : null);
			g.viewport(0, 0, width, height);
			const { prog, ubic } = programa(g, pase.shader);
			g.useProgram(prog);
			const loc = (n: string) => {
				if (!ubic.has(n)) ubic.set(n, g.getUniformLocation(prog, n));
				return ubic.get(n) ?? null;
			};
			g.activeTexture(g.TEXTURE0);
			g.bindTexture(g.TEXTURE_2D, entrada);
			g.uniform1i(loc("u_textura"), 0);
			if (texB) {
				g.activeTexture(g.TEXTURE1);
				g.bindTexture(g.TEXTURE_2D, texB);
				g.uniform1i(loc("u_texturaB"), 1);
			}
			ponerUniform(g, loc("u_resolucion"), [width, height]);
			for (const [nombre, valor] of Object.entries(pase.uniforms)) ponerUniform(g, loc(nombre), valor);
			g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
			if (destino) entrada = destino.tex;
		});
		const salida = new OffscreenCanvas(width, height);
		salida.getContext("2d")?.drawImage(canvas, 0, 0);
		return salida;
	} catch (error) {
		// Un shader roto no puede tumbar la reproducción: se ve el cuadro sin el
		// pase y el error queda en la consola con el id del shader.
		console.error(error);
		return source instanceof OffscreenCanvas ? source : copiaFuente();
	}
}
