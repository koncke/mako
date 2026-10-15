// =============================================================================
// El ARMAZÓN del editor de landings (copiado de Gamma 5): lo que no se ve y rompe en silencio
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». El armazón
// (app/web-generator/editor/EditorLanding.tsx) es el único dueño del documento: guarda,
// cambia de página y reparte el contexto que usan todas las piezas (./contexto.ts). Lo que este
// test fija es lo que, roto, no da ningún error en pantalla:
//
//   · el autoguardado manda la `version` que tiene (concurrencia optimista: sin ella, el server
//     no puede decir «otra pestaña guardó en el medio» y una pisa a la otra en silencio);
//   · hay flush al ocultarse la pestaña (cerrar el navegador no desmonta el componente: sin el
//     `visibilitychange` lo escrito en el último respiro de 1,5 s se pierde) y al desmontar;
//   · CADA valor del contexto está implementado, ninguno es una función vacía (una pieza que
//     llama `recargar` y no pasa nada se lee como que la app está rota, y el typecheck no lo ve:
//     `async () => {}` tipa perfecto);
//   · el botón de la esquina de abajo a la derecha lleva `data-esquina-ocupada` (si no, la
//     esquina de avisos de la app lo tapa: AGENTS.md);
//   · las reglas puras de la tira y de las páginas (dónde cae un arrastre, la ruta libre, la
//     página de inicio única) y la subida en tres pasos (firmar → PUT → registrar).
//
// Los guards que leen fuente lo hacen SIN COMENTARIOS (la casa explica en el comentario lo que
// el código hace, y un guard que lee el comentario se da la razón a sí mismo) y con los saltos
// de línea normalizados (un fuente en CRLF en un worktree no puede dar un rojo falso).
//
// ── Roturas (11/10/2026, arnés que restaura de MEMORIA; base en verde: 9 pasan, 0 fallan) ──
//   · el guardado sin `version`                                   -> 8 / 1 (autoguardado)
//   · la versión no se sube con la respuesta                      -> 8 / 1 (autoguardado)
//   · los guardados en paralelo (sin la fila de promesas)         -> 8 / 1 (autoguardado)
//   · sin el listener de visibilitychange                         -> 8 / 1 (flush)
//   · desmontar no vacía lo pendiente                             -> 8 / 1 (flush)
//   · el flush no cancela el respiro                              -> 8 / 1 (flush)
//   · `recargar: async () => {}` en el contexto                    -> 8 / 1 (contexto)
//   · falta `irATarjeta` en el contexto                           -> 8 / 1 (contexto)
//   · `setPaginas` apunta a un useCallback vacío                  -> 8 / 1 (contexto)
//   · la esquina sin data-esquina-ocupada                         -> 8 / 1 (esquina)
//   · `indiceFinal` sin restar al bajar                           -> 8 / 1 (tira)
//   · `rutaLibre` sin sufijo                                      -> 8 / 1 (páginas)
//   · `hacerInicio` deja la vieja de inicio sin ruta              -> 8 / 1 (páginas)
//   · `duplicarPagina` conserva los ids de sección                -> 8 / 1 (páginas)
//   · subir sin corregir el tipo por la extensión                 -> 7 / 2 (los dos de subir)
//   · subir sin `registrar`                                       -> 8 / 1 (subir, el orden)
//   · sin el `onProgreso(100)` final                              -> 8 / 1 (subir, el orden)
//   · el selector de imágenes sin montar                          -> 8 / 1 (piezas)
//   Las 18 restauradas con su hash verificado. El arnés vive en el scratchpad de la corrida
//   (paqH/romper.mjs): lee el archivo, reemplaza UNA ocurrencia exacta, corre y reescribe el original.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (un `/*` adentro de un `//` no abre nada). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ARMAZON = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
const CONTEXTO = sinComentarios(leer('app/web-generator/editor/contexto.ts'));

/** El texto entre `desde` y `hasta` (el bloque real, no N caracteres a ojo). */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}

test('el autoguardado manda la versión que tiene, y la sube con la respuesta', () => {
  const mandar = bloque(ARMAZON, 'const mandar = useCallback(', 'const encolar = useCallback(');
  assert.ok(mandar.length < 4000, `el recorte de «mandar» mide ${mandar.length}: está mirando otra cosa`);
  assert.match(mandar, /accion:\s*'guardar'/, 'el guardado no es la acción «guardar»');
  assert.match(mandar, /version:\s*versionRef\.current/, 'el guardado no manda la versión abierta');
  assert.match(mandar, /versionRef\.current\s*=\s*r\.version/, 'la versión no se sube con la respuesta: el segundo guardado daría conflicto');
  assert.match(mandar, /r\.conflicto/, 'un conflicto no se distingue de un error');
  // Y los guardados van EN FILA: dos en paralelo mandarían la misma versión.
  const encolar = bloque(ARMAZON, 'const encolar = useCallback(', 'const encolarRef = useRef(');
  assert.match(encolar, /colaRef\.current\.then\(/, 'los guardados no se encadenan');
  assert.match(ARMAZON, /const RESPIRO_MS = 1500;/, 'el respiro del autoguardado no es 1,5 s');
});

test('hay flush al ocultarse la pestaña y al desmontar', () => {
  const efecto = bloque(ARMAZON, "const visibilidad = () =>", '}, [vaciarPendiente]);');
  assert.match(efecto, /document\.visibilityState === 'hidden'\)\s*vaciarPendiente\(\)/, 'ocultar la pestaña no manda lo pendiente');
  assert.match(efecto, /document\.addEventListener\('visibilitychange', visibilidad\)/, 'no se escucha visibilitychange');
  assert.match(efecto, /document\.removeEventListener\('visibilitychange', visibilidad\)/, 'el listener no se saca al desmontar');
  // El cleanup del efecto (lo que corre al desmontar) también vacía lo pendiente.
  const limpieza = efecto.slice(efecto.indexOf('return () => {'));
  assert.match(limpieza, /\n\s*vaciarPendiente\(\);/, 'desmontar (volver al Panel) no manda lo pendiente');
  // Y el flush de verdad corta el respiro: si no, lo escrito en el último 1,5 s espera un timer que ya no corre.
  const vaciar = bloque(ARMAZON, 'const vaciarPendiente = useCallback(', '}, []);');
  assert.match(vaciar, /clearTimeout\(timerRef\.current\)/, 'el flush no cancela el respiro');
  assert.match(vaciar, /encolarRef\.current\(true\)/, 'el flush no manda (con keepalive)');
});

test('cada valor del contexto está implementado, y ninguno es una función vacía', () => {
  const tipo = bloque(CONTEXTO, 'export type CtxEditorLanding = {', '\n};');
  const claves = [...tipo.matchAll(/^\s{2}([a-zA-Z]+)\??:/gm)].map((m) => m[1]);
  assert.ok(claves.length >= 30, `el contrato trae ${claves.length} claves: esto no leyó el tipo`);

  const objeto = bloque(ARMAZON, 'const ctx = useMemo<CtxEditorLanding>(() => ({', '}), [');
  const VACIA = /^(async\s*)?\(\s*[^)]*\)\s*=>\s*(\{\s*\}|undefined|null|void 0)\s*$/;
  for (const k of claves) {
    const m = objeto.match(new RegExp(`\\n\\s*${k}(?::\\s*([^\\n]+?))?,\\s*\\n`));
    assert.ok(m, `el contexto no implementa «${k}»`);
    const valor = (m[1] ?? k).trim();
    assert.doesNotMatch(valor, VACIA, `«${k}» es una función vacía`);
    // Si el valor es un nombre, su declaración tampoco puede ser un useCallback vacío.
    if (/^[a-zA-Z]+$/.test(valor)) {
      const decl = ARMAZON.match(new RegExp(`const ${valor} = useCallback\\(\\s*((?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{\\s*\\})\\s*,`));
      assert.equal(decl, null, `«${k}» apunta a «${valor}», que es un useCallback vacío`);
    }
  }
});

test('el botón de la esquina de abajo a la derecha lleva data-esquina-ocupada', () => {
  const esquina = bloque(ARMAZON, '<div className="gma-esquina"', '</div>');
  assert.match(esquina, /data-esquina-ocupada/, 'la esquina del zoom y los atajos no se marca: la esquina de avisos la tapa');
  assert.match(esquina, /className="gma-zoom/, 'el zoom no está en la esquina marcada');
  assert.match(esquina, /className="gma-ayuda/, 'el «?» no está en la esquina marcada');
});

test('la tira: dónde cae un arrastre y a qué índice queda', async () => {
  const { destinoDeArrastre, indiceFinal } = await import('../app/web-generator/editor/TiraSecciones');
  const mitades = [50, 150, 250];
  assert.equal(destinoDeArrastre(mitades, 10), 0);
  assert.equal(destinoDeArrastre(mitades, 120), 1);
  assert.equal(destinoDeArrastre(mitades, 260), 3);
  assert.equal(indiceFinal(0, 3), 2, 'bajar el primero al final deja 3 ítems: queda en el índice 2');
  assert.equal(indiceFinal(2, 0), 0);
  assert.equal(indiceFinal(1, 1), 1, 'soltar en su propia ranura no lo mueve');
  assert.equal(indiceFinal(1, 2), 1, 'la ranura de abajo de sí mismo tampoco');
});

test('las páginas: ruta libre, una sola de inicio, y el orden', async () => {
  const { rutaLibre, hacerInicio, moverEnLista, motivoRuta, duplicarPagina } = await import('../app/web-generator/editor/PanelPaginas');
  assert.equal(rutaLibre('Gracias por tu compra', []), 'gracias-por-tu-compra');
  assert.equal(rutaLibre('Oferta', ['oferta', 'oferta-2']), 'oferta-3');
  assert.equal(rutaLibre('Sí', []), 'pagina', 'un título que da menos de 3 caracteres cae a «pagina»');

  const doc = { type: 'doc' as const, content: [] };
  const paginas = [
    { id: 'p1', titulo: 'Inicio', ruta: '', doc },
    { id: 'p2', titulo: 'Gracias', ruta: 'gracias', doc },
  ];
  const r = hacerInicio(paginas, 'p2');
  assert.equal(r[0].id, 'p2');
  assert.equal(r[0].ruta, '');
  assert.equal(r.filter((p) => p.ruta === '').length, 1, 'quedaron dos páginas de inicio');
  assert.equal(r.find((p) => p.id === 'p1')?.ruta, 'inicio', 'la que era de inicio no recibió una ruta');

  assert.deepEqual(moverEnLista(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.equal(motivoRuta('gracias', 'p1', paginas), 'Esa ruta ya existe');
  assert.equal(motivoRuta('ab', 'p1', paginas), 'De 3 a 60: a-z, 0-9 y guiones');
  assert.equal(motivoRuta('oferta', 'p1', paginas), null);

  const tarjeta = { type: 'tarjeta', attrs: { id: 'tViejo' }, content: [] };
  const copia = duplicarPagina({ id: 'p2', titulo: 'Gracias', ruta: 'gracias', doc: { type: 'doc', content: [tarjeta] } }, paginas);
  assert.notEqual(copia.id, 'p2');
  assert.notEqual(copia.ruta, 'gracias');
  assert.notEqual(copia.doc.content[0].attrs?.id, 'tViejo', 'la copia comparte el id de sección con el original');
});

test('subir: el tipo se corrige por la extensión y lo que no se admite no sale', async () => {
  const { tipoDeArchivo, motivoParaNoSubir } = await import('../app/web-generator/editor/subir');
  assert.equal(tipoDeArchivo({ name: 'foto.PNG', type: '' }), 'image/png');
  assert.equal(tipoDeArchivo({ name: 'x.webp', type: 'application/octet-stream' }), 'image/webp');
  assert.equal(tipoDeArchivo({ name: 'logo.svg', type: 'image/svg+xml' }), null, 'un SVG entraría al bucket público (XSS)');
  assert.equal(motivoParaNoSubir({ name: 'a.png', type: 'image/png', size: 16 * 1024 * 1024 }), 'Pesa más de 15 MB');
  assert.equal(motivoParaNoSubir({ name: 'a.png', type: 'image/png', size: 10 }), null);
});

test('subir: firmar → PUT al bucket con progreso → registrar, en ese orden', async () => {
  const { subirArchivo } = await import('../app/web-generator/editor/subir');
  const pasos: string[] = [];
  let tipoFirmado = '';
  const fetchViejo = globalThis.fetch;
  const xhrViejo = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const cuerpo = JSON.parse(init.body);
    pasos.push(cuerpo.accion);
    if (cuerpo.accion === 'firmar') {
      tipoFirmado = cuerpo.tipo;
      return new Response(JSON.stringify({ ok: true, path: '3/subidas/u.png', signedUrl: 'https://bucket/u.png?token=t', apikey: 'k' }));
    }
    return new Response(JSON.stringify({ ok: true, url: 'https://publico/u.png', tipo: 'image/png' }));
  }) as unknown as typeof fetch;
  class XhrFalso {
    upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
    status = 0;
    responseText = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    open(metodo: string, url: string) { pasos.push(`${metodo} ${url}`); }
    setRequestHeader() { /* nada */ }
    send() {
      setTimeout(() => {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
        this.status = 200;
        this.onload?.();
      }, 0);
    }
    abort() { this.onabort?.(); }
  }
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = XhrFalso;
  try {
    const progreso: number[] = [];
    const url = await subirArchivo(new File([new Uint8Array([137, 80, 78, 71])], 'foto.PNG', { type: '' }), (p) => progreso.push(p));
    assert.equal(url, 'https://publico/u.png');
    assert.deepEqual(pasos, ['firmar', 'PUT https://bucket/u.png?token=t', 'registrar']);
    assert.equal(tipoFirmado, 'image/png', 'el tipo vacío del navegador no se corrigió por la extensión');
    assert.ok(progreso.includes(50), 'el progreso de la subida no llegó');
    assert.equal(progreso[progreso.length - 1], 100, 'el 100 tiene que llegar DESPUÉS de registrar');
  } finally {
    globalThis.fetch = fetchViejo;
    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = xhrViejo;
  }
});

test('las piezas de los otros paquetes se montan con el contrato del diseño', () => {
  // Cada diálogo y panel derecho recibe un onCerrar de identidad FIJA (useCallback), nunca una flecha
  // nueva por render (AGENTS.md: el campo del diálogo perdería el foco en cada tecla). Eso vale para
  // los de I1, que reciben `onCerrar`; los de I2 se cierran solos por el contexto, y Presentar avisa
  // con `onSalir`.
  for (const pieza of ['DialogoCompartir', 'DialogoPublicar', 'DialogoExportar', 'DialogoConfiguracion']) {
    assert.match(ARMAZON, new RegExp(`<${pieza} onCerrar=\\{cerrarDialogo\\} />`), `${pieza} no se monta con cerrarDialogo`);
  }
  assert.match(ARMAZON, /<PanelTema onCerrar=\{cerrarPanelDer\} \/>/, 'PanelTema no se monta con cerrarPanelDer');
  assert.match(ARMAZON, /<Presentar onSalir=\{cerrarDialogo\} \/>/, 'Presentar no se monta con cerrarDialogo');
  for (const pieza of ['DialogoAnalitica', 'DialogoAtajos', 'PanelComentarios', 'PanelHistorial', 'PanelAgente']) {
    assert.match(ARMAZON, new RegExp(`<${pieza} />`), `${pieza} no está montado`);
  }
  assert.match(ARMAZON, /const cerrarDialogo = useCallback\(\(\) => setDialogo\(null\), \[\]\);/);
  assert.match(ARMAZON, /<SelectorImagen \{\.\.\.selector\} \/>/, 'el selector de imágenes no está montado: elegirImagen quedaría colgada');
  assert.match(ARMAZON, /immediatelyRender:\s*false/);
  assert.match(ARMAZON, /shouldRerenderOnTransaction:\s*false/);
});
