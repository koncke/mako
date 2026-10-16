// =============================================================================
// Video Editor, animaciones y estilo de texto (paquete H, 11/10/2026)
// =============================================================================
// Una animación de CapCut es una función del progreso que el gancho visual
// compone sobre la transformación del clip (app/video-editor/_opencut/
// animaciones/). Lo que falla SIN error, y por eso se prueba acá:
//
//   1. LAS PUNTAS SON LA IDENTIDAD. Una Entrada que en p = 1 no deja el clip
//      donde estaba, o una Salida que en p = 0 ya lo movió, pega un salto en el
//      cuadro donde empieza o termina la animación. En una captura no se ve.
//   2. EL BUCLE CIERRA: la pose al final de una vuelta es la del comienzo.
//   3. LOS TRAMOS: Entrada + Salida no pasan el largo del clip (cede la Salida),
//      el Combinado se acota al clip, y en el medio del clip la pose es la
//      identidad (un clip animado no queda corrido para siempre).
//   4. LA ESCALA CONSERVA EL SIGNO: el reflejo es escala negativa; una animación
//      que la acote con Math.max la daría vuelta.
//   5. EL SELECTOR Y EL CATÁLOGO COINCIDEN: cada preset es una opción del param
//      (coerceParamValue descarta un id que no está en `options`), y los de
//      texto no se ofrecen a un clip.
//   6. «MÁQUINA DE ESCRIBIR», «PALABRA POR PALABRA», «May./min.» y la opacidad
//      de sombra y fondo.
//   7. AL DIVIDIR, la Entrada queda a la izquierda y la Salida a la derecha.
//   8. LA CURVA: las letras van sobre el arco a la distancia de su ancho, en
//      renglones concéntricos, simétricas si el texto está centrado, y la
//      «Máquina de escribir» corta por letras enteras (un emoji compuesto no se
//      parte). Con fondo o subrayado, recto (como CapCut).
//   9. «NINGUNO» APAGA TODO: cada interruptor de apariencia (trazo, sombra,
//      brillo, fondo) está apagado en SIN_EFECTO, y todo lo que escribe un
//      efecto viaja en «Guardar como parámetro predefinido».
//  10. Una plantilla de SUBTÍTULOS escribe siempre trazo, sombra y brillo: si
//      no, cambiar de plantilla dejaba el halo de un efecto anterior.
//
// Lo que este test NO ve: cómo se ve (trazo, sombra y la vista previa de las
// tarjetas se dibujan con canvas y CSS en el navegador).
//
// Correr: node --import tsx --test tests/video-editor-animaciones.test.ts
// PROBADO ROMPIÉNDOLO: ver el final del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ID_NINGUNO,
  POSE_IDENTIDAD,
  PRESETS,
  componerPoses,
  presetsPara,
  type Pose,
} from '../app/video-editor/_opencut/animaciones/catalogo';
import {
  aplicarPose,
  poseEn,
  revelacionTexto,
  tramosAnimacion,
} from '../app/video-editor/_opencut/animaciones/calcular';
import { sinEntrada, sinSalida } from '../app/video-editor/_opencut/animaciones/reglas';
import { ANIM, paramsAnimaciones } from '../app/video-editor/_opencut/params/extra/animaciones';
import { cuantizarRevelado, lineasReveladas } from '../app/video-editor/_opencut/text/revelado';
import {
  aplicarMayusculas,
  colorConAlfa,
  curvaBloqueada,
  leerEstiloTexto,
} from '../app/video-editor/_opencut/text/estilo';
import {
  grafemas,
  letrasEnArco,
  letrasVisibles,
  recuadroArco,
} from '../app/video-editor/_opencut/text/curva';
import { TEXTO } from '../app/video-editor/_opencut/params/extra/texto';
import {
  CLAVES_ESTILO,
  EFECTOS_TEXTO,
  PLANTILLAS_TEXTO,
  SIN_EFECTO,
} from '../app/video-editor/_opencut/text/estilos-predefinidos';
import {
  PLANTILLAS_SUBTITULO,
  paramsDePlantilla,
} from '../app/video-editor/_opencut/subtitles/estilos';

const CERCA = 1e-6;

function esIdentidad(pose: Pose, contexto: string) {
  const giro = ((pose.giro % 360) + 360) % 360;
  const fallas: string[] = [];
  if (Math.abs(pose.dx) > CERCA) fallas.push(`dx=${pose.dx}`);
  if (Math.abs(pose.dy) > CERCA) fallas.push(`dy=${pose.dy}`);
  if (Math.abs(pose.escala - 1) > CERCA) fallas.push(`escala=${pose.escala}`);
  if (Math.abs(pose.escalaX - 1) > CERCA) fallas.push(`escalaX=${pose.escalaX}`);
  if (Math.abs(pose.escalaY - 1) > CERCA) fallas.push(`escalaY=${pose.escalaY}`);
  if (Math.min(giro, 360 - giro) > 1e-4) fallas.push(`giro=${pose.giro}`);
  if (Math.abs(pose.opacidad - 1) > CERCA) fallas.push(`opacidad=${pose.opacidad}`);
  return fallas.length ? `${contexto}: ${fallas.join(', ')}` : null;
}

const conPose = (parcial: Partial<Pose>) => componerPoses(POSE_IDENTIDAD, parcial);

test('1. las puntas de Entrada, Salida y Combinado son la identidad (sin salto al empezar ni al terminar)', () => {
  const fallas: string[] = [];
  for (const texto of [false, true]) {
    const o = { texto };
    for (const p of PRESETS.entrada) {
      const f = esIdentidad(conPose(p.pose(1, o)), `entrada «${p.nombre}» en p=1 (texto=${texto})`);
      if (f) fallas.push(f);
    }
    for (const p of PRESETS.salida) {
      const f = esIdentidad(conPose(p.pose(0, o)), `salida «${p.nombre}» en p=0 (texto=${texto})`);
      if (f) fallas.push(f);
    }
    for (const p of PRESETS.combo) {
      for (const extremo of [0, 1]) {
        const f = esIdentidad(conPose(p.pose(extremo, o)), `combinado «${p.nombre}» en p=${extremo}`);
        if (f) fallas.push(f);
      }
    }
  }
  assert.deepEqual(fallas, []);
  // Y no es vacío por accidente: ~15 por categoría, como pidió el paquete.
  assert.ok(PRESETS.entrada.length >= 15 && PRESETS.salida.length >= 15, 'faltan presets de entrada o salida');
  assert.ok(PRESETS.combo.length >= 12 && PRESETS.bucle.length >= 12, 'faltan combinados o bucles');
});

test('2. el Bucle cierra: la pose al terminar una vuelta es la del comienzo', () => {
  const fallas: string[] = [];
  for (const p of PRESETS.bucle) {
    const a = conPose(p.pose(0, { texto: false }));
    const b = conPose(p.pose(1, { texto: false }));
    const delta: Pose = {
      dx: b.dx - a.dx,
      dy: b.dy - a.dy,
      escala: b.escala / a.escala,
      escalaX: b.escalaX / a.escalaX,
      escalaY: b.escalaY / a.escalaY,
      giro: b.giro - a.giro,
      opacidad: a.opacidad === 0 ? 1 : b.opacidad / a.opacidad,
    };
    const f = esIdentidad(delta, `bucle «${p.nombre}»`);
    if (f) fallas.push(f);
  }
  assert.deepEqual(fallas, []);
});

test('3. los tramos: Entrada + Salida caben en el clip, el Combinado se acota y el medio queda quieto', () => {
  const params = {
    [ANIM.entrada.id]: 'acercar',
    [ANIM.entrada.duracion]: 0.5,
    [ANIM.salida.id]: 'desaparecer-gradualmente',
    [ANIM.salida.duracion]: 0.5,
  };
  // Clip de 0,6 s: la Salida cede lo que falta.
  const corto = tramosAnimacion(params, 0.6);
  assert.equal(corto.entrada?.duracion, 0.5);
  assert.ok(Math.abs((corto.salida?.duracion ?? 0) - 0.1) < CERCA, `salida ${corto.salida?.duracion}`);
  // Clip de 0,4 s: la Entrada ocupa todo y la Salida no entra.
  const muyCorto = tramosAnimacion(params, 0.4);
  assert.equal(muyCorto.entrada?.duracion, 0.4);
  assert.equal(muyCorto.salida, null);

  // En el medio de un clip de 4 s, nada se mueve; al empezar y al terminar, sí.
  assert.equal(esIdentidad(poseEn(params, 2, 4, false), 'medio'), null);
  assert.ok(poseEn(params, 0.1, 4, false).escala < 1, 'la entrada «Acercar» arranca chica');
  assert.ok(poseEn(params, 3.9, 4, false).opacidad < 0.5, 'la salida se desvanece al final');

  // Un Combinado de 10 s en un clip de 3 s se acota a 3.
  const combo = tramosAnimacion({ [ANIM.combo.id]: 'rotacion', [ANIM.combo.duracion]: 10 }, 3);
  assert.equal(combo.combo?.duracion, 3);

  // El Bucle corre sólo entre la Entrada y la Salida.
  const conBucle = { ...params, [ANIM.bucle.id]: 'balanceo', [ANIM.bucle.duracion]: 1 };
  assert.equal(poseEn(conBucle, 0.25, 4, false).giro, 0, 'durante la entrada no gira');
  assert.notEqual(poseEn(conBucle, 0.75, 4, false).giro, 0, 'después de la entrada sí');

  // «Ninguno», un id desconocido (proyecto de otra versión) y sin params: identidad.
  const sinAnimacion: Record<string, string>[] = [{ [ANIM.entrada.id]: ID_NINGUNO }, { [ANIM.entrada.id]: 'no-existe' }, {}];
  for (const p of sinAnimacion) {
    assert.equal(poseEn(p, 0.1, 4, false), POSE_IDENTIDAD);
  }
});

test('4. aplicar una pose conserva el signo de la escala (el reflejo) y no la deja en cero', () => {
  const estado = {
    transform: { scaleX: -0.8, scaleY: 0.5, position: { x: 10, y: -20 }, rotate: 5 },
    opacity: 0.8,
  };
  const r = aplicarPose(
    estado,
    { dx: 0.1, dy: -0.5, escala: 0.5, escalaX: 1, escalaY: 0, giro: 30, opacidad: 0.5 },
    { width: 1920, height: 1080 },
  );
  assert.ok(r.transform.scaleX < 0, 'el reflejo se perdió');
  assert.ok(Math.abs(r.transform.scaleX + 0.4) < CERCA);
  assert.ok(r.transform.scaleY > 0, 'la escala 0 tiene que quedar en el mínimo, no en 0');
  assert.equal(r.transform.position.x, 10 + 192);
  assert.equal(r.transform.position.y, -20 - 540);
  assert.equal(r.transform.rotate, 35);
  assert.ok(Math.abs(r.opacity - 0.4) < CERCA);
  // La identidad devuelve el MISMO objeto (nada que recalcular).
  assert.equal(aplicarPose(estado, POSE_IDENTIDAD, { width: 1, height: 1 }), estado);
});

test('5. cada preset es una opción de su selector, y los de texto no se ofrecen a un clip', () => {
  const opciones = (tipo: 'video' | 'text' | 'sticker', clave: string) =>
    (paramsAnimaciones[tipo] ?? [])
      .filter((p) => p.key === clave)
      .flatMap((p) => (p.type === 'select' ? p.options.map((o) => o.value) : []));
  const video = opciones('video', ANIM.entrada.id);
  const texto = opciones('text', ANIM.entrada.id);
  assert.ok(video.includes(ID_NINGUNO) && texto.includes(ID_NINGUNO));
  assert.deepEqual(video.slice(1), presetsPara('entrada', false).map((p) => p.id));
  assert.deepEqual(texto.slice(1), presetsPara('entrada', true).map((p) => p.id));
  assert.ok(!video.includes('maquina-escribir') && texto.includes('maquina-escribir'));
  // Combinado en el clip; Bucle en texto y sticker (como CapCut).
  assert.ok(opciones('video', ANIM.combo.id).length > 1 && opciones('video', ANIM.bucle.id).length === 0);
  assert.ok(opciones('text', ANIM.bucle.id).length > 1 && opciones('text', ANIM.combo.id).length === 0);
  assert.ok(opciones('sticker', ANIM.bucle.id).length > 1);
  // Ningún id repetido dentro de una categoría (el Map se quedaría con el último).
  for (const [cat, lista] of Object.entries(PRESETS)) {
    assert.equal(new Set(lista.map((p) => p.id)).size, lista.length, `ids repetidos en ${cat}`);
  }
});

test('6. «Máquina de escribir», «Palabra por palabra», «May./min.» y las opacidades', () => {
  const maquina = { [ANIM.entrada.id]: 'maquina-escribir', [ANIM.entrada.duracion]: 1 };
  assert.deepEqual(revelacionTexto(maquina, 0.5, 3), { fraccion: 0.5, modo: 'caracter' });
  assert.equal(revelacionTexto(maquina, 1.5, 3), null, 'después de la entrada, entero');
  // 10 letras («Hola» + «mundo!» en dos líneas), a la mitad: 5, y la segunda empieza.
  assert.deepEqual(lineasReveladas(['Hola', 'mundo!'], { fraccion: 0.5, modo: 'caracter' }), ['Hola', 'm']);
  assert.deepEqual(lineasReveladas(['Hola'], { fraccion: 0, modo: 'caracter' }), ['']);
  // Por palabra: la primera aparece apenas arranca; los espacios no cuentan.
  assert.deepEqual(lineasReveladas(['uno dos  tres'], { fraccion: 0.01, modo: 'palabra' }), ['uno']);
  assert.deepEqual(lineasReveladas(['uno dos  tres'], { fraccion: 0.6, modo: 'palabra' }), ['uno dos']);
  // Una salida «Máquina de escribir» borra hacia atrás.
  const salida = { [ANIM.salida.id]: 'maquina-escribir', [ANIM.salida.duracion]: 1 };
  assert.ok(Math.abs((revelacionTexto(salida, 2.75, 3)?.fraccion ?? -1) - 0.25) < CERCA);

  // Cuantizada: las MISMAS líneas en todo instante, y quieta entre una letra y la
  // siguiente (si no, la textura del texto se re-dibuja en cada cuadro).
  for (const modo of ['caracter', 'palabra'] as const) {
    const lineas = ['uno dos', 'tres cuatro cinco'];
    for (let f = 0; f <= 1.0001; f += 0.013) {
      const crudo = { fraccion: f, modo };
      assert.deepEqual(lineasReveladas(lineas, cuantizarRevelado(lineas, crudo)), lineasReveladas(lineas, crudo), `${modo} ${f}`);
    }
  }
  assert.deepEqual(
    cuantizarRevelado(['Hola'], { fraccion: 0.51, modo: 'caracter' }),
    cuantizarRevelado(['Hola'], { fraccion: 0.74, modo: 'caracter' }),
  );

  assert.equal(aplicarMayusculas('hola ¿qué tal? ñandú', 'titulo'), 'Hola ¿Qué Tal? Ñandú');
  assert.equal(aplicarMayusculas('Árbol', 'mayusculas'), 'ÁRBOL');
  assert.equal(aplicarMayusculas('ÁRBOL', 'minusculas'), 'árbol');
  assert.equal(aplicarMayusculas('Sin Cambio', 'ninguno'), 'Sin Cambio');

  assert.equal(colorConAlfa('#000000', 0.5), 'rgba(0, 0, 0, 0.5)');
  assert.equal(colorConAlfa('#ff000080', 0.5), 'rgba(255, 0, 0, 0.251)');
  assert.equal(colorConAlfa('#123456', 1), '#123456', 'al 100 % no se toca');
});

test('7. al dividir: la Entrada queda a la izquierda y la Salida a la derecha', () => {
  const params = {
    [ANIM.entrada.id]: 'acercar',
    [ANIM.salida.id]: 'alejar',
    [ANIM.bucle.id]: 'pulso',
  };
  assert.equal(sinSalida(params)[ANIM.salida.id], ID_NINGUNO);
  assert.equal(sinSalida(params)[ANIM.entrada.id], 'acercar');
  assert.equal(sinEntrada(params)[ANIM.entrada.id], ID_NINGUNO);
  assert.equal(sinEntrada(params)[ANIM.bucle.id], 'pulso', 'el bucle es del clip entero');
  // Sin nada que sacar, el MISMO objeto (no se reescribe el elemento).
  const quieto = { [ANIM.entrada.id]: ID_NINGUNO };
  assert.equal(sinEntrada(quieto), quieto);
});

test('8. la Curva: letras sobre el arco, renglones concéntricos y la máquina de escribir por letra entera', () => {
  const ancho = () => 10; // todas las letras de 10 px: las cuentas se hacen a mano
  const base = { ys: [0], alineacion: 'center' as const, espaciado: 0, anchoLetra: ancho };
  assert.equal(letrasEnArco({ ...base, lineas: ['abc'], fuerza: 0 }), null, 'fuerza 0 = recto');

  const [arco] = letrasEnArco({ ...base, lineas: ['abcde'], fuerza: 60 })!;
  assert.equal(arco.length, 5);
  // Centrado: la del medio en la vertical, a la altura del renglón, sin giro.
  assert.ok(Math.abs(arco[2].x) < CERCA && Math.abs(arco[2].y) < CERCA && Math.abs(arco[2].giro) < CERCA);
  // Simétricas, y las puntas BAJAN (arco hacia arriba: centro debajo; la y crece hacia abajo).
  assert.ok(Math.abs(arco[0].x + arco[4].x) < CERCA && Math.abs(arco[0].y - arco[4].y) < CERCA);
  assert.ok(arco[0].y > 0 && arco[0].giro < 0 && arco[4].giro > 0);
  // Cada letra, a la distancia de su ancho sobre el arco (radio · ángulo = 10 px).
  const radio = 50 / ((60 / 100) * ((5 * Math.PI) / 3));
  for (let k = 1; k < 5; k++) {
    const dPhi = arco[k].giro - arco[k - 1].giro;
    assert.ok(Math.abs(radio * dPhi - 10) < 1e-6, `letra ${k}: ${radio * dPhi}`);
  }
  // Fuerza negativa: el espejo vertical (las puntas SUBEN).
  const [abajo] = letrasEnArco({ ...base, lineas: ['abcde'], fuerza: -60 })!;
  assert.ok(Math.abs(abajo[0].y + arco[0].y) < CERCA && abajo[0].giro > 0);

  // Dos renglones: comparten el centro (concéntricos). El centro está a un radio
  // DEBAJO del medio del bloque, y la distancia de cada letra a él es su radio.
  const dos = letrasEnArco({ ...base, lineas: ['abcd', 'ab'], ys: [-6, 6], fuerza: 80 })!;
  const r0 = 40 / ((80 / 100) * ((5 * Math.PI) / 3));
  for (const [i, renglon] of dos.entries()) {
    const esperado = r0 - [-6, 6][i];
    for (const l of renglon) {
      assert.ok(Math.abs(Math.hypot(l.x, l.y - r0) - esperado) < 1e-6, `renglón ${i} fuera de su círculo`);
    }
  }
  // A la izquierda: todos los renglones arrancan en el mismo ángulo.
  const izq = letrasEnArco({ ...base, lineas: ['abcd', 'ab'], ys: [0, 0], alineacion: 'left', fuerza: 80 })!;
  assert.ok(Math.abs(izq[0][0].giro - izq[1][0].giro) < CERCA);

  // El recuadro encierra todas las letras.
  const caja = recuadroArco([arco], 12)!;
  for (const l of arco) {
    assert.ok(l.x > caja.left && l.x < caja.left + caja.width && l.y > caja.top && l.y < caja.top + caja.height);
  }

  // Grafemas: una «é» con tilde combinante y una familia con ZWJ son UNA letra cada una.
  const e = 'e' + String.fromCodePoint(0x301);
  const familia = [0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467].map((c) => String.fromCodePoint(c)).join('');
  assert.deepEqual(grafemas(`${e}${familia}a`), [e, familia, 'a']);
  const [conEmoji] = letrasEnArco({ ...base, lineas: [`${e}${familia}a`], fuerza: 50 })!;
  // La máquina de escribir mostró 3 code points: sólo la «é» entera (2); la familia (5) no entra a medias.
  assert.deepEqual(letrasVisibles(conEmoji, 3).map((l) => l.letra), [e]);
  assert.deepEqual(letrasVisibles(conEmoji, 7).map((l) => l.letra), [e, familia]);

  // Con fondo o subrayado no se curva (y se dice por qué).
  const curvo = { [TEXTO.curvaActiva]: true, [TEXTO.curvaFuerza]: 50 };
  assert.deepEqual(leerEstiloTexto(curvo).curva, { fuerza: 50 });
  assert.equal(leerEstiloTexto({ ...curvo, 'background.enabled': true }).curva, null);
  assert.equal(leerEstiloTexto({ ...curvo, textDecoration: 'underline' }).curva, null);
  assert.equal(curvaBloqueada({ 'background.enabled': true }), 'El texto con fondo no se puede curvar');
  assert.equal(curvaBloqueada({}), null);
});

test('9. «Ninguno» apaga todo interruptor de apariencia, y lo que escribe un efecto se puede guardar', () => {
  // Los interruptores de APARIENCIA (la curva es forma, no apariencia: un efecto no la toca).
  const interruptores = [TEXTO.trazoActivo, TEXTO.sombraActiva, TEXTO.brilloActivo, 'background.enabled'];
  const declarados = Object.values(TEXTO).filter((k) => /\.activ[oa]$/.test(k) && k !== TEXTO.curvaActiva);
  assert.deepEqual(
    [...declarados].sort(),
    interruptores.filter((k) => k !== 'background.enabled').sort(),
    'hay un interruptor nuevo en params/extra/texto.ts: sumalo a SIN_EFECTO y a esta lista',
  );
  for (const k of interruptores) assert.equal(SIN_EFECTO[k], false, `«Ninguno» no apaga ${k}`);
  for (const ef of EFECTOS_TEXTO) {
    for (const k of Object.keys(ef.params)) {
      assert.ok(CLAVES_ESTILO.includes(k), `el efecto «${ef.nombre}» escribe ${k}, que no se guarda como predefinido`);
    }
    assert.equal(ef.params[TEXTO.curvaActiva], undefined, `el efecto «${ef.nombre}» toca la curva`);
  }
  assert.equal(new Set(EFECTOS_TEXTO.map((e) => e.id)).size, EFECTOS_TEXTO.length, 'ids de efectos repetidos');
  assert.equal(new Set(PLANTILLAS_TEXTO.map((e) => e.id)).size, PLANTILLAS_TEXTO.length, 'ids de plantillas repetidos');
  // El brillo: apagado con intensidad 0; prendido, en 0–1.
  assert.equal(leerEstiloTexto({ [TEXTO.brilloActivo]: true, [TEXTO.brilloIntensidad]: 0 }).brillo, null);
  assert.equal(leerEstiloTexto({ [TEXTO.brilloActivo]: true, [TEXTO.brilloIntensidad]: 80 }).brillo?.intensidad, 0.8);
});

test('10. una plantilla de subtítulos escribe siempre trazo, sombra y brillo', () => {
  const lienzo = { width: 1080, height: 1920 };
  for (const p of PLANTILLAS_SUBTITULO) {
    const params = paramsDePlantilla(p, lienzo);
    assert.equal(params[TEXTO.trazoActivo], Boolean(p.trazo), `«${p.nombre}»: trazo`);
    // Desde el 15/10 una plantilla puede traer sombra («Palabra resaltada»): apagada si no.
    assert.equal(params[TEXTO.sombraActiva], Boolean(p.sombra), `«${p.nombre}»: sombra`);
    assert.equal(params[TEXTO.brilloActivo], false, `«${p.nombre}»: brillo`);
  }
  assert.ok(PLANTILLAS_SUBTITULO.some((p) => p.trazo), 'ninguna plantilla con contorno');
});

// ── PROBADO ROMPIÉNDOLO (11/10/2026; base: 7 pasan, 0 fallan) ─────────────────
// Con un arnés que parcha, corre y restaura (scratchpad paqH/romper.py):
//   · la Entrada «Acercar» termina en 0,99 en vez de 1               -> 6 / 1 (el 1)
//   · el Bucle «Rotación» da 350° por vuelta                          -> 6 / 1 (el 2)
//   · la Salida no cede cuando Entrada + Salida pasan el clip         -> 6 / 1 (el 3)
//   · `aplicarPose` devuelve la escala sin signo (se pierde el reflejo) -> 6 / 1 (el 4)
//   · el selector del clip ofrece «Máquina de escribir»               -> 6 / 1 (el 5)
//   · «Palabra por palabra» con floor (la primera tarda en salir)     -> 6 / 1 (el 6)
//   · dividir deja la Salida en la mitad izquierda                    -> 6 / 1 (el 7)
// Y el test, al escribirlo, encontró uno de verdad: el Combinado y el Bucle
// «Latido» terminaban en escala 1,0000015 (la campana de Gauss no llega a 0);
// se arregló con una ventana sin(π·fase) en catalogo.ts.
//
// Los tests 8–10 (Curva, Brillo, plantillas de subtítulos), base 10 / 0, con
// paqH/romper2.py:
//   · los renglones curvos con el mismo radio (no concéntricos)        -> 9 / 1 (el 8)
//   · grafemas por code point (la familia con ZWJ se parte)            -> 9 / 1 (el 8)
//   · la curva ignora el fondo                                         -> 9 / 1 (el 8)
//   · SIN_EFECTO sin `brillo.activo: false` («Ninguno» deja el halo)   -> 9 / 1 (el 9)
//   · una plantilla de subtítulos que no apaga el brillo               -> 9 / 1 (el 10)
// Y la cuantización de la «Máquina de escribir» (paqH/romper3.py):
//   · por palabra con floor (cambia lo que se ve)                      -> 9 / 1 (el 6)
//   · sin cuantizar (la textura se re-dibujaría en cada cuadro)        -> 9 / 1 (el 6)
