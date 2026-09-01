// =============================================================================
// Medir un formato: la densidad no se pregunta, se calcula
// =============================================================================
// El creador de formatos no puede pedirle a nadie «¿cuántas palabras por segundo
// querés?». Nadie sabe eso de sí mismo, y la regla de la casa lo prohíbe: nunca
// un campo libre, y se pregunta un HECHO. Lo que la persona sí puede dar es un
// video que le gusta.
//
// El calibre de estos tests son los DOS formatos que existen y están medidos
// contra Flow: si la aritmética no los reproduce, está mal.

import test from 'node:test';
import assert from 'node:assert/strict';
import { formatoDeMedida, duracionDeFlow, rangoAlrededor, porQueNoSirve } from '../lib/formato-medir';
import { DURACIONES_FLOW } from '../lib/costo-clip';
import { CATALOGO_PUESTAS } from '../lib/puestas-data';

// ── La duración: sólo existen cuatro ────────────────────────────────────────

test('se elige la duración de Flow MÁS CERCANA, no el piso ni el techo', () => {
  // Redondear siempre hacia abajo le aprieta texto a cada toma; siempre hacia
  // arriba deja a la persona muda al final. La más cercana reparte el error.
  assert.equal(duracionDeFlow(8.4), 8);
  assert.equal(duracionDeFlow(9.6), 10);
  assert.equal(duracionDeFlow(6.9), 6);

  // ⚠️ EN UN EMPATE EXACTO GANA LA MÁS CORTA, y está decidido, no es el orden
  // del array. 9 está entre 8 y 10: con 8 se habla apurado, con 10 la persona se
  // queda MUDA un segundo —que se lee como que el video falló— y encima cuesta
  // 15 créditos en vez de 12.
  assert.equal(duracionDeFlow(9), 8);
  assert.equal(duracionDeFlow(5), 4);
  assert.equal(duracionDeFlow(7), 6);
});

test('nunca devuelve una duración que Flow no genere', () => {
  // Pedirle 9 segundos a Flow no da un clip de 9: da uno que no existe.
  for (const s of [1, 3, 5, 7, 9, 11, 40, 0.5]) {
    assert.ok(
      (DURACIONES_FLOW as readonly number[]).includes(duracionDeFlow(s)),
      `${s} → ${duracionDeFlow(s)} no está en el catálogo de Flow`,
    );
  }
});

// ── La densidad, contra los formatos que SÍ están medidos ───────────────────

test('la cuenta cierra en las dos direcciones (y esto NO es un calibre)', () => {
  // ⚠️ SE LLAMABA «reproduce la densidad de Car Talks» Y ERA UNA TAUTOLOGÍA:
  // calculaba `palabras = densidad × duración` y después comprobaba que
  // `palabras / duración === densidad`. Eso prueba que la división es la inversa
  // de la multiplicación, no que el número signifique algo.
  //
  // Se deja porque el round-trip sí vale la pena fijarlo —el redondeo a dos
  // decimales podría romperlo— pero con el nombre honesto.
  //
  // Un calibre DE VERDAD necesitaría el conteo real de palabras del ejemplo de
  // Car Talks, que hoy no está en el repo: hay que transcribirlo. Queda dicho
  // para que nadie crea que este test cubre eso.
  const car = CATALOGO_PUESTAS.find((p) => p.id === 'selfie-movimiento')!;
  const dur = car.ejemplo!.duracionSeg;
  const f = formatoDeMedida({ duracion: dur, palabras: Math.round(car.densidad * dur), cortes: [0, 10, 20] })!;
  assert.equal(f.densidad, car.densidad);
});

test('⚠️ un locutor rápido se RECHAZA aunque sea un video real y bueno', () => {
  // La densidad de un video mide a un HUMANO; la de un formato mide cuánto
  // acepta el MODELO antes de trabarse. No son la misma magnitud. Los ocho
  // formatos del catálogo van de 2,1 a 3: nadie llega a 3,5.
  const m = { duracion: 60, palabras: 260, cortes: [0, 10, 20, 30, 40, 50] };
  const no = porQueNoSirve(m, formatoDeMedida(m)!);
  assert.ok(no && /se traba/.test(no), no ?? 'aceptó 4,33 palabras por segundo');
});

test('⚠️ la densidad se mide contra la duración TOTAL, no contra el habla', () => {
  // `palabrasQueEntran` hace `densidad * segundos` donde `segundos` es lo que
  // dura el CLIP entero —pausas y respiraciones incluidas—. Medirla contra los
  // segundos de habla daría un número más grande, el tope quedaría inflado y el
  // texto no entraría.
  const f = formatoDeMedida({ duracion: 100, palabras: 250, cortes: [0] })!;
  assert.equal(f.densidad, 2.5);
});

test('sin habla o sin duración no se inventa un formato', () => {
  // Un número inventado no da error: da anuncios donde la persona se queda muda.
  assert.equal(formatoDeMedida({ duracion: 0, palabras: 100, cortes: [] }), null);
  assert.equal(formatoDeMedida({ duracion: 60, palabras: 0, cortes: [] }), null);
});

// ── Los clips ───────────────────────────────────────────────────────────────

test('la cantidad de clips sale de los cortes, y sin cortes es un plano único', () => {
  assert.equal(formatoDeMedida({ duracion: 56, palabras: 168, cortes: [0, 8, 16, 24, 32, 40, 48] })!.clips, 7);
  assert.equal(formatoDeMedida({ duracion: 30, palabras: 90, cortes: [] })!.clips, 1);
});

test('el rango lleva AIRE hacia arriba, y eso no es decoración', () => {
  // `cabidaDeGuion` busca dentro del rango la combinación que hace entrar el
  // guion. Un rango de un solo valor obliga a que todo guion mida exactamente
  // eso, y el que no entra no tiene a dónde crecer.
  const f = formatoDeMedida({ duracion: 56, palabras: 168, cortes: [0, 8, 16, 24, 32, 40, 48] })!;
  assert.ok(f.rangoClips[1] > f.clips, 'sin aire, un guion largo desborda la última toma');
  assert.equal(f.rangoSegundos[0], f.segundos);
  assert.ok(f.rangoSegundos[1] >= f.segundos);
});

test('el rango de segundos nunca se sale del catálogo de Flow', () => {
  for (const s of DURACIONES_FLOW) {
    const [a, b] = rangoAlrededor(s);
    assert.ok((DURACIONES_FLOW as readonly number[]).includes(a));
    assert.ok((DURACIONES_FLOW as readonly number[]).includes(b));
  }
  assert.deepEqual(rangoAlrededor(10), [10, 10], 'en el techo no hay hacia dónde abrir');
});

// ── Y lo que NO se acepta, que es la mitad del trabajo ──────────────────────

test('un video sin habla se RECHAZA en vez de guardarse con densidad 0,4', () => {
  // Lo que hace daño no es el rechazo: es aceptar en silencio. Una densidad de
  // 0,4 se guarda igual de bien que una de 3 y aparece semanas después como
  // «los anuncios de este formato salen todos con la persona callada».
  const m = { duracion: 60, palabras: 20, cortes: [0] };
  const f = formatoDeMedida(m)!;
  const no = porQueNoSirve(m, f);
  assert.ok(no && /habla muy poco/i.test(no), no ?? 'lo aceptó');
});

test('y uno con 40 cortes, diciendo lo que COSTARÍA', () => {
  // Cada corte es un clip de Flow, o sea créditos. Un formato así no es un
  // anuncio con avatar: es un montaje, y la persona tiene que ver el número.
  const cortes = Array.from({ length: 40 }, (_, i) => i * 3);
  const m = { duracion: 120, palabras: 360, cortes };
  const no = porQueNoSirve(m, formatoDeMedida(m)!);
  assert.ok(no && /créditos/.test(no), no ?? 'lo aceptó');
  assert.ok(no!.includes('480'), 'tiene que decir el costo, no sólo que son muchos');
});

test('un video demasiado corto o demasiado largo tampoco sirve', () => {
  const corto = { duracion: 5, palabras: 15, cortes: [0] };
  assert.ok(porQueNoSirve(corto, formatoDeMedida(corto)!));
  const largo = { duracion: 900, palabras: 2700, cortes: [0] };
  assert.ok(porQueNoSirve(largo, formatoDeMedida(largo)!));
});

test('los dos formatos de fábrica PASAN su propio control', () => {
  // Si la validación rechazara a Car Talks o a The Office, estaría midiendo otra
  // cosa. Es el calibre: lo que ya sabemos que funciona tiene que entrar.
  for (const p of CATALOGO_PUESTAS.filter((x) => x.ejemplo)) {
    const dur = p.ejemplo!.duracionSeg;
    const m = {
      duracion: dur,
      palabras: Math.round(p.densidad * dur),
      cortes: Array.from({ length: p.clips[0] }, (_, i) => i),
    };
    const f = formatoDeMedida(m)!;
    assert.equal(porQueNoSirve(m, f), null, `${p.nombre} no pasó: ${porQueNoSirve(m, f)}`);
  }
});
