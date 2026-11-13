// =============================================================================
// La prueba del Web Generator en producción del 12/11/2026 (chat «probar-web»): lo que se arregló
// =============================================================================
// Probado como Martín, en hola-mako.com (ws3 y ws9), replicando la masterclass de clase.highticketclarity.com desde su
// tarjeta de outliers y recorriendo plantillas, editor, chat por texto y por AUDIO y publicar. Lo que fija:
//   1. la marca que la IA no nombra sale del DOMINIO, no del primer subdominio («clase.», «lp.», «programa.»);
//   2. los nombres propios de la referencia (su autor, el que da la clase, sus @cuentas) van en la instrucción y se cuentan;
//   3. una réplica adaptada en la que la IA no escribió NINGUNA sección no se crea (el ws3, sin IA, la creaba igual);
//   4. el extractor: las entidades (`&times;`), los modales y popups escondidos y los botones del reproductor no son copy;
//   5. lo que se veía mal: la caja del chat más ancha que su columna («Enviar audio» cortado), el audio del globo cortado,
//      el hueco del video sin contraste en un tema oscuro, «MaKo no pudo leer los ángulos» sin haberlos pedido, y la vista
//      previa que no hacía nada con las ventanas emergentes bloqueadas.
// Correr: node --import tsx --test tests/web-generator-probar-1211.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  adaptacionSinNingunaSeccion, errorDeAdaptacion, instruccionDePartes, marcaDeUrl, mencionesDe, nombresDeLaReferencia, PARTES_INICIALES,
} from '../lib/editor-landing/replicar-partes';
import { RE_CONTROL_MEDIA, decodificar, extraerBloques, sinLoOculto, textoDeBloques } from '../lib/landing-extraer';

const fuente = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

test('1. la marca es la del dominio, no la del subdominio de la landing', () => {
  assert.equal(marcaDeUrl('https://clase.highticketclarity.com/'), 'Highticketclarity');
  assert.equal(marcaDeUrl('https://lp.acquisition.com/leila-frameworks'), 'Acquisition');
  assert.equal(marcaDeUrl('https://programa.formacionmomentum.com/video'), 'Formacionmomentum');
  assert.equal(marcaDeUrl('https://www.tienda.com.ar/'), 'Tienda', 'los de país con «com» adelante');
  // Lo de antes sigue igual.
  assert.equal(marcaDeUrl('https://tryholo.ai/'), 'Holo');
  assert.equal(marcaDeUrl('https://www.reportei.com/es/'), 'Reportei');
  assert.equal(marcaDeUrl('no es una dirección'), null);
  // «High Ticket Clarity» separada en tres palabras también cuenta.
  assert.equal(mencionesDe('High Ticket Clarity · Clara Pérez · highticketclarity.com', 'Highticketclarity'), 2);
  assert.equal(mencionesDe('Un ticket alto, con claridad', 'Highticketclarity'), 0);
});

test('2. los nombres propios de la referencia: autor, el que da la clase y las @cuentas', () => {
  const n = nombresDeLaReferencia([
    'Imaginá agregar 10K AL MES a tu facturación',
    'Con Clara Pérez · Lunes 28 de septiembre',
    'Con un sistema de contenido predecible: sabés qué publicar',
    'Con MaKo: la plataforma que centraliza tu CRM',
    'Quién es Clara Pérez',
    '+192.000 seguidores en TikTok · @soyclaraperez · TikTok',
    'Mel Mazzeo · @melmazzeo · mentora de marca personal',
    'Who is Alex Hormozi?',
  ]);
  assert.deepEqual(n, ['Clara Pérez', '@soyclaraperez', '@melmazzeo', 'Alex Hormozi']);
  assert.deepEqual(nombresDeLaReferencia(['con un sistema de contenido', 'sobre el método']), [], 'en minúscula no es un nombre');
  assert.equal(nombresDeLaReferencia(Array.from({ length: 30 }, (_, i) => `@cuenta${i}x`), 5).length, 5, 'con tope');
  // Se cuentan como la marca: «Clara Pérez» sin acento y la @cuenta pegada.
  assert.equal(mencionesDe('Quién es Clara Perez. Sígueme en @soyclaraperez', 'Clara Pérez'), 1);
  assert.equal(mencionesDe('Sígueme en @soyclaraperez', '@soyclaraperez'), 1);
  // A la IA: la lista, con la regla; sin nombres, nada.
  const i = instruccionDePartes(PARTES_INICIALES, { nombres: ['Clara Pérez', '@soyclaraperez'] })!;
  assert.match(i, /NOMBRES DE LA REFERENCIA \(no los escribas en ninguna forma;[^)]*\): Clara Pérez, @soyclaraperez\./);
  assert.ok(i.indexOf('NOMBRES DE LA REFERENCIA') < i.indexOf('TEXTO (no se toma)'), 'entre las reglas, antes de los datos');
  assert.doesNotMatch(instruccionDePartes(PARTES_INICIALES)!, /NOMBRES DE LA REFERENCIA/);
  const rep = fuente('lib/editor-landing/replicar.ts');
  assert.match(rep, /const nombres = partes\.texto \? \[\] : nombresDeLaReferencia\(\[esq\.titulo, \.\.\.esq\.secciones\.flatMap\(\(s\) => \[s\.titulo, \.\.\.s\.puntos\]\)\]\);/);
  assert.match(rep, /const instruccionSecciones = instruccionDePartes\(partes, \{[^}]*marca: marca \?\? undefined, nombres \}\);/);
  assert.match(rep, /nombrados\.length \? `De la original quedó: /, 'lo que quedó se dice');
});

test('3. una adaptada sin NINGUNA sección escrita por la IA no se crea, y se dice por qué', () => {
  assert.equal(adaptacionSinNingunaSeccion(true, 9, 0), true);
  assert.equal(adaptacionSinNingunaSeccion(true, 9, 1), false, 'con una escrita, sale (el resto lo dice el aviso)');
  assert.equal(adaptacionSinNingunaSeccion(false, 9, 0), false, 'la copia tal cual no pasa por la IA');
  assert.equal(adaptacionSinNingunaSeccion(true, 0, 0), false);
  const e = errorDeAdaptacion('No hay ninguna IA conectada, así que MaKo no puede editar la landing');
  assert.match(e, /^MaKo no pudo escribir el texto para tu oferta, así que no creó la copia adaptada\. No hay ninguna IA conectada, así que MaKo no puede editar la landing\. Para copiarla tal cual, prende «Texto literal»\.$/);
  assert.doesNotMatch(errorDeAdaptacion(''), /\.\s\./, 'sin lo de la IA, sin un punto suelto');
  const rep = fuente('lib/editor-landing/replicar.ts');
  const corte = rep.indexOf('if (adaptacionSinNingunaSeccion(!!receta.adaptar, esq.secciones.length, porIndice.size))');
  assert.ok(corte > rep.indexOf("await correr(faltan, '2ª vuelta')"), 'después de la segunda vuelta');
  assert.ok(corte < rep.indexOf('const tarjetasArmadas = esq.secciones.map('), 'antes de armar las secciones con el texto de la original');
  assert.ok(rep.indexOf('const creada = await crearLanding(nombreDeCopia(partes', corte) > corte, 'y antes de crear la copia');
  assert.match(rep, /else \{ errorDeIA = r\.error; console\.warn/);
});

test('4. el extractor: entidades, modales y popups escondidos, y los botones del reproductor', () => {
  assert.equal(decodificar('&times; &copy; &Aacute;rbol &rarr; 5&deg; &middot; &bull;'), '× © Árbol → 5° · •');
  assert.equal(decodificar('&noexiste;'), '&noexiste;', 'lo que no se conoce queda');
  const html = `<html><body>
    <section><h1>Imaginá agregar 10K al mes</h1>
      <div class="hero-video"><video src="x.mp4"></video><button class="hero-sonido" aria-label="Activar el sonido"><span>Activá el sonido</span></button></div>
      <a class="btn" href="#registro">Quiero mi lugar en la masterclass</a></section>
    <section><h2>Preguntas frecuentes</h2>
      <button aria-expanded="false">¿Es en vivo?</button><div hidden><p>Sí, en vivo y con preguntas.</p></div>
      <button aria-expanded="false">¿Cuánto dura?</button><div hidden="until-found"><p>Una hora y media.</p></div></section>
    <div class="modal" id="modal" hidden role="dialog" aria-modal="true"><div class="modal-card"><button class="modal-x">&times;</button>
      <h2>Reservá tu lugar</h2><div><label>Tu nombre *</label><input name="n"></div><button type="submit">Reservar</button></div></div>
    <div class="modal" id="salida" hidden><div class="modal-card"><h2>Esperá un segundo</h2><button>No, gracias</button></div></div>
    <div role="dialog" class="cookies"><p>Usamos cookies para mejorar tu experiencia.</p><button>Aceptar</button></div>
    <footer><p>High Ticket Clarity · Clara Pérez</p></footer>
  </body></html>`;
  const t = textoDeBloques(extraerBloques(html));
  for (const fuera of ['Reservá tu lugar', 'Tu nombre', 'Esperá un segundo', 'No, gracias', 'Usamos cookies', '&times;', 'Activá el sonido']) {
    assert.ok(!t.includes(fuera), `«${fuera}» no es copy de la página`);
  }
  for (const queda of ['# Imaginá agregar 10K al mes', '[BOTÓN] Quiero mi lugar en la masterclass', '[DESPLEGABLE] ¿Es en vivo? → Sí, en vivo y con preguntas.', '[DESPLEGABLE] ¿Cuánto dura? → Una hora y media.', 'High Ticket Clarity · Clara Pérez']) {
    assert.ok(t.includes(queda), `«${queda}» sigue (las respuestas en <div hidden> de un acordeón NO se tocan)`);
  }
  // Lo que no cierra no se corta (se llevaría la página), y lo que no es diálogo queda igual.
  assert.equal(sinLoOculto('<div role="dialog"><p>sin cierre'), '<div role="dialog"><p>sin cierre');
  assert.equal(sinLoOculto('<div hidden><p>x</p></div>'), '<div hidden><p>x</p></div>');
  assert.match(sinLoOculto('<div class="popup" hidden><div><div>a</div></div></div><p>b</p>'), /^\s*<p>b<\/p>$/, 'hasta SU cierre, con los del mismo nombre adentro');
  // Los controles del reproductor, sólo con el texto ENTERO.
  for (const s of ['Activá el sonido', 'Activar el sonido', 'Tap to unmute', 'Unmute', 'Play', 'Reproducir']) assert.ok(RE_CONTROL_MEDIA.test(s), s);
  for (const s of ['Activar el sonido de la clase', 'Ver el video', 'Quiero mi lugar', 'Reproducir mi clase gratis']) assert.ok(!RE_CONTROL_MEDIA.test(s), s);
});

test('5. lo que se veía mal en la pantalla', () => {
  // La caja del chat nunca más ancha que su columna (Web Generator y Video: «Enviar audio» cortado).
  assert.match(fuente('app/admin/operaciones/centro.css'), /\n\.co-caja \{ width: 100%; min-width: 0; \}/);
  // El audio en el globo, como mucho del ancho del globo.
  assert.match(fuente('app/_chat/HiloMako.tsx'), /<AudioPlay src=\{x\.voz\.url\} duracion=\{x\.voz\.secs\} color="var\(--primary\)" style=\{\{ width: 240, maxWidth: '100%' \}\} \/>/);
  // El hueco del video con el color de la sección (un tema oscuro).
  const barra = fuente('app/web-generator/editor/BarraFormato.tsx');
  assert.match(barra, /'\.gmx-nv-vacio\{[^']*color:inherit;cursor:pointer\}'/);
  assert.match(barra, /'\.gmx-nv-vacio \.gmx-nota\{color:inherit;opacity:\.72\}'/);
  assert.doesNotMatch(barra, /'\.gmx-nv-vacio\{[^']*color:var\(--gmx-texto-2\)/);
  // «MaKo no pudo leer los ángulos» sólo cuando de verdad no pudo.
  const rep = fuente('app/web-generator/crear/Replicar.tsx');
  assert.doesNotMatch(rep, /lectura\.errorAngulos \?\? 'MaKo no pudo leer los ángulos\.'/);
  assert.match(rep, /\{lectura\.errorAngulos\s*\? `\$\{lectura\.errorAngulos\} La estructura y el diseño se replican igual\.`\s*: 'Van con el texto de cada sección: MaKo los toma al replicar\.'\}/);
  // La vista previa con las ventanas emergentes bloqueadas lo dice, y el aviso de la réplica dura lo que tarda leerlo.
  const ed = fuente('app/web-generator/editor/EditorLanding.tsx');
  assert.match(ed, /const otra = window\.open\(r\.url, '_blank'\);\s*if \(otra\) otra\.opener = null;\s*else avisar\('Tu navegador bloqueó la pestaña: habilita las ventanas emergentes'/);
  assert.match(ed, /avisar\(texto, undefined, Math\.min\(15_000, Math\.max\(8_000, texto\.length \* 70\)\)\)/);
  assert.match(ed, /toastTimer\.current = window\.setTimeout\(\(\) => setToast\(null\), ms \?\? \(onDeshacer \? 6000 : 3500\)\);/);
});
