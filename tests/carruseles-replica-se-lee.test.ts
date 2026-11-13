// La réplica que SE LEE y no deja huecos (12/11/2026, prueba de Image en producción, ws 9).
//
// Lo que se vio, lámina por lámina al lado del original:
//   · @lifeofarjav (crema, naranja y negro): «STEP 1», «The Result» y el CTA eran texto blanco sobre una pastilla o una caja
//     naranja. La réplica traía el blanco sin la forma: «PASO 1», «EL RESULTADO» y «Comenta ACELERADOR y te la envío» quedaron
//     blancos sobre crema, invisibles. Y «= Tu Acelerador» (Archivo Black, 119 px, caja de 518) se cortaba en «Acelerad».
//   · @vilmanunez (traído por link, 10 láminas con fotos de salones): 7 láminas con un hueco amarillo del tamaño de la foto
//     (se buscaban como mucho 3 escenas), y «ACELERADOR» bajaba hasta quedar encima de una foto oscura.
//   · @AlexHormozi (un anuncio que es una tarjeta de tuit blanca): la IA «leyó» «pantalla dividida, dos cuadros apilados», que era
//     el ejemplo del prompt.
//
// Esto fija:
//   1. el contraste se mide (blanco sobre el crema de @lifeofarjav no se lee);
//   2. el color de cada texto: con pastilla, sin pastilla que se perdió, sobre una foto, y el que ya se leía no se toca;
//   3. una palabra más ancha que su caja achica el texto, y con él el otro pedazo del mismo titular;
//   4. un texto que la IA puso arriba de una foto no baja hasta meterse en ella;
//   5. el documento: la pastilla va como resaltado del texto; un cuadro sin su escena toma otra; sin ninguna foto, tipografía;
//   6. la IA dice la pastilla en `relleno`, y el prompt ya no trae ejemplos de composición que copiar.
//
// Verificado rompiéndolo (12/11/2026), cada rotura sola y restaurada: ver el pie.
//
// Correr: node --import tsx --test tests/carruseles-replica-se-lee.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { medidorReal } from '../lib/carruseles/medir-letra';
import { acomodarTextos, colorQueSeLee, contraste, documentoDeReplica, leerReplica, promptDeReplica, type Replica, type TextoReplica } from '../lib/carruseles/replica';
import { sinVariablesDeCatalogo } from '../lib/carruseles/anuncios';

const CREMA = '#F5E8E0';
const NARANJA = '#C85A17';
const texto = (o: Partial<TextoReplica> & Pick<TextoReplica, 'rol' | 'texto'>): TextoReplica => ({
  x: 0.05, y: 0.1, ancho: 0.9, tamano: 0.05, color: '#000000', negrita: false, alinear: 'left', mayus: false, letra: 'sans', relleno: null, ...o,
});
const nuevoId = (() => { let n = 0; return () => `id${++n}`; })();
const estilo = { titular: { familia: 'Montserrat', respaldo: 'sans-serif' as const, peso: 800 }, texto: { familia: 'Inter', respaldo: 'sans-serif' as const, peso: 400 } } as never;
const salon = { id: 's1', url: 'https://x.supabase.co/storage/v1/object/public/landing-imagenes/9/salon.jpg', ancho: 1600, alto: 1067 };
type Obj = Record<string, unknown>;
const objetosDe = (doc: Obj, i = 0) => ((doc.pages as Obj[])[i].objects as Obj[]);

test('1 · el contraste se mide: blanco sobre crema no se lee, negro sobre blanco es el máximo', () => {
  assert.ok(contraste('#FFFFFF', CREMA) < 1.3, `blanco sobre crema: ${contraste('#FFFFFF', CREMA)}`);
  assert.ok(Math.abs(contraste('#000000', '#FFFFFF') - 21) < 0.01);
  assert.ok(contraste('#FFFFFF', NARANJA) >= 3, 'blanco sobre la pastilla naranja se lee');
});

test('2 · el color de cada texto: la pastilla perdida vuelve, el titular toma tinta, sobre una foto va claro, lo que se lee no se toca', () => {
  const base = { fondo: CREMA, sobreFoto: false, acento: NARANJA };
  // «PASO 1» blanco sin pastilla, sobre crema: la pastilla se perdió → vuelve con el acento de la lámina, y el blanco se lee ahí.
  assert.deepEqual(colorQueSeLee({ rol: 'rotulo', color: '#FFFFFF', relleno: null }, base), { color: '#FFFFFF', relleno: NARANJA });
  assert.deepEqual(colorQueSeLee({ rol: 'cta', color: '#FFFFFF', relleno: null }, base), { color: '#FFFFFF', relleno: NARANJA });
  // Un titular blanco sobre crema no es una pastilla: toma la tinta del fondo.
  assert.deepEqual(colorQueSeLee({ rol: 'titulo', color: '#FFFFFF', relleno: null }, base), { color: '#111111', relleno: null });
  // La IA dijo la pastilla: se respeta; un texto que no se lee sobre ella toma el que sí.
  assert.deepEqual(colorQueSeLee({ rol: 'rotulo', color: '#FFFFFF', relleno: NARANJA }, base), { color: '#FFFFFF', relleno: NARANJA });
  assert.deepEqual(colorQueSeLee({ rol: 'rotulo', color: '#F5E8E0', relleno: '#FFF3B0' }, base), { color: '#111111', relleno: '#FFF3B0' });
  // Sobre una foto que no es la del original: un texto oscuro pasa a blanco (va con sombra).
  assert.deepEqual(colorQueSeLee({ rol: 'titulo', color: '#000000', relleno: null }, { ...base, sobreFoto: true }), { color: '#FFFFFF', relleno: null });
  // Lo que ya se leía queda igual.
  assert.deepEqual(colorQueSeLee({ rol: 'titulo', color: '#000000', relleno: null }, base), { color: '#000000', relleno: null });
  assert.deepEqual(colorQueSeLee({ rol: 'titulo', color: NARANJA, relleno: null }, base), { color: NARANJA, relleno: null });
});

test('3 · «= Tu Acelerador» no se corta: la palabra más larga entra en su caja, y el otro pedazo del titular queda igual', () => {
  const ARCHIVO = { familia: '"Archivo Black", sans-serif', peso: 400, italica: false };
  const a = texto({ rol: 'titulo', texto: 'MaKo +\nClaude', x: 518 / 1080, y: 338 / 1350, ancho: 518 / 1080, tamano: 119 / 1080 });
  const b = texto({ rol: 'titulo', texto: '= Tu Acelerador', x: 518 / 1080, y: 625 / 1350, ancho: 518 / 1080, tamano: 119 / 1080 });
  // El caso de producción: a 119 px «Acelerador» no entra en 518.
  assert.ok(medidorReal('Acelerador', { ...ARCHIVO, tam: 119 }) > 518, 'si entra, el caso no reproduce lo que se vio');
  const [pa, pb] = acomodarTextos([a, b].map((t) => ({ t, fuente: { ...ARCHIVO, tam: 119 }, interlineado: 1.06 })), { ancho: 1080, alto: 1350 });
  for (const p of [pa, pb]) {
    for (const r of p.renglones) assert.ok(medidorReal(r, { ...ARCHIVO, tam: p.tam }) <= p.width, `«${r}» a ${p.tam} px no entra en ${p.width}`);
  }
  assert.equal(pa.tam, pb.tam, 'los dos pedazos del mismo titular quedan del mismo cuerpo');
  assert.ok(pb.tam >= 60, `se achicó de más: ${pb.tam} px`);
});

test('4 · un texto puesto arriba de una foto no baja hasta meterse en ella', () => {
  const MONT = { familia: '"Montserrat", sans-serif', peso: 800, italica: false };
  // @vilmanunez, lámina 1: dos titulares arriba y la foto desde 203 px. «MAKO ACELERADOR» a 89 px no entra en un renglón.
  const t1 = texto({ rol: 'titulo', texto: 'MARTIN KONCKE', x: 0.05, y: 27 / 1350, ancho: 0.9, tamano: 79 / 1080 });
  const t2 = texto({ rol: 'titulo', texto: 'MAKO ACELERADOR', x: 0.05, y: 122 / 1350, ancho: 0.9, tamano: 89 / 1080 });
  const foto = { x: 54, y: 203, ancho: 972, alto: 540 };
  const items = [t1, t2].map((t) => ({ t, fuente: { ...MONT, tam: Math.round(t.tamano * 1080) }, interlineado: 1.06 }));
  const sin = acomodarTextos(items, { ancho: 1080, alto: 1350 });
  assert.ok(sin[1].top + sin[1].alto > foto.y, 'sin la foto como obstáculo, el titular se mete en ella (el caso de producción)');
  const con = acomodarTextos(items, { ancho: 1080, alto: 1350 }, { obstaculos: [foto] });
  for (const p of con) assert.ok(p.top + p.alto <= foto.y, `un titular termina en ${p.top + p.alto}, adentro de la foto (desde ${foto.y})`);
});

test('5 · el documento: la pastilla como resaltado; un cuadro sin su escena toma otra; sin ninguna foto, tipografía que llena', () => {
  const lamina = (cuadros: Replica['laminas'][number]['cuadros']) => ({
    fondo: CREMA, foto: null, cuadros,
    textos: [
      texto({ rol: 'rotulo', texto: 'PASO 1', color: '#FFFFFF', y: 0.07, tamano: 0.04 }),
      texto({ rol: 'titulo', texto: 'Crea tu proyecto', color: '#000000', y: 0.15, tamano: 0.1 }),
      texto({ rol: 'cuerpo', texto: 'Nuevo proyecto. Llámalo como tu oferta.', color: '#333333', y: 0.85, tamano: 0.045 }),
    ],
  });
  const cuadro = (busqueda: string) => ({ x: 0.05, y: 0.45, ancho: 0.9, alto: 0.35, tipo: 'escena' as const, persona: false, descripcion: 'una pantalla', busqueda });
  const r: Replica = { proporcion: '4:5', titulo: 'X', laminas: [lamina([cuadro('modern meeting room')]), lamina([cuadro('stage with screen')]), lamina([])] };
  const doc = documentoDeReplica({ replica: r, estilo, marca: { nombre: 'X', usuario: null }, foto: null, nuevoId, escenas: new Map([['modern meeting room', salon]]) });
  // La pastilla perdida vuelve como resaltado del texto (sigue al texto si se edita), con el acento del texto naranja… o la tinta.
  const paso = objetosDe(doc, 0).find((o) => String(o.text).includes('PASO 1'))!;
  assert.ok(paso.textBackgroundColor, '«PASO 1» blanco sobre crema quedó sin pastilla');
  assert.deepEqual(paso.effects, { background: { color: paso.textBackgroundColor } }, 'el resaltado no está en `effects` (el editor no lo muestra)');
  assert.ok(contraste(String(paso.fill), String(paso.textBackgroundColor)) >= 3, 'el texto no se lee sobre su pastilla');
  // La lámina 2 pidió una escena que no se encontró: lleva la de la lámina 1, no un hueco.
  const img2 = objetosDe(doc, 1).filter((o) => o.type === 'image');
  assert.equal(img2.length, 1, 'el cuadro sin su escena quedó vacío');
  assert.equal(img2[0].src, salon.url);
  // Sin ninguna escena en toda la réplica: la lámina con un cuadro se arma como tipografía (el titular deja su lugar y crece).
  const sinNada = documentoDeReplica({ replica: { ...r, laminas: [lamina([cuadro('modern meeting room')])] }, estilo, marca: { nombre: 'X', usuario: null }, foto: null, nuevoId });
  const objs = objetosDe(sinNada);
  assert.equal(objs.filter((o) => o.type === 'image').length, 0);
  const tit = objs.find((o) => o.name === 'Titular')!;
  const titConFoto = objetosDe(doc, 0).find((o) => o.name === 'Titular')!;
  assert.ok((tit.fontSize as number) > (titConFoto.fontSize as number), `sin foto, el titular no llenó la lámina (${tit.fontSize} contra ${titConFoto.fontSize})`);
});

test('6 · la IA dice la pastilla en `relleno`, y el prompt no trae ejemplos de composición para copiar', () => {
  const crudo = JSON.stringify({
    proporcion: '4:5', titulo: 'X',
    laminas: [{ fondo: CREMA, cuadros: [], textos: [
      { rol: 'rotulo', texto: 'PASO 1', color: '#FFFFFF', relleno: NARANJA },
      { rol: 'titulo', texto: 'Hola', color: '#000000', relleno: CREMA.toLowerCase() },
      { rol: 'cuerpo', texto: 'Chau', color: '#000000', relleno: 'naranja' },
    ] }],
  });
  const r = leerReplica(crudo, { laminas: 1 }) as Replica;
  assert.deepEqual(r.laminas[0].textos.map((t) => t.relleno), [NARANJA, null, null], 'una pastilla del color del fondo, o un color que no es #RRGGBB, no es pastilla');
  const p = promptDeReplica({ laminas: 6, vistas: 6, negocio: '', voz: '', nombreNegocio: 'X', cta: null, conAvatar: false, pedido: null, anuncio: false, pie: null } as never);
  assert.match(p, /"relleno":"#RRGGBB" o null/);
  assert.doesNotMatch(p, /pantalla dividida/i, 'el ejemplo que la IA copió en el anuncio de @AlexHormozi');
  assert.doesNotMatch(p, /rocky beach/i);
});

test('7 · un anuncio de catálogo de Meta no muestra «{{product.name}}» ni lo manda a la réplica', () => {
  assert.equal(sinVariablesDeCatalogo('{{product.name}}\n{{product.brand}}'), null, 'sólo variables: no hay texto');
  assert.equal(sinVariablesDeCatalogo('Envío gratis en {{product.name}} hoy'), 'Envío gratis en hoy');
  assert.equal(sinVariablesDeCatalogo('Learn How to Scale Your Business'), 'Learn How to Scale Your Business', 'un texto normal queda igual');
  assert.equal(sinVariablesDeCatalogo(null), null);
});

test('8 · el marco y el tuit: líneas y tarjetas debajo, el avatar redondo, el @ del negocio, y el texto se lee sobre su tarjeta', () => {
  const crudo = JSON.stringify({
    proporcion: '4:5', titulo: 'Tuit',
    laminas: [{
      fondo: '#1A1A1A',
      formas: [{ tipo: 'linea', x: 0.05, y: 0.07, ancho: 0.9, alto: 0.001, color: '#E0D0C8' }, { tipo: 'caja', x: 0.08, y: 0.3, ancho: 0.84, alto: 0.5, color: '#FFFFFF', radio: 0.05, sombra: true }, { tipo: 'caja', color: 'rojo' }],
      cuadros: [{ x: 0.1, y: 0.1, ancho: 0.2, alto: 0.2, tipo: 'retrato', persona: true, forma: 'circulo', descripcion: 'su foto de perfil' }],
      textos: [
        { rol: 'firma', texto: '@usuario · 02 / 06', x: 0.35, y: 0.12, ancho: 0.6, tamano: 0.03, color: '#555555' },
        { rol: 'titulo', texto: 'La gente compra cuando la ayudas primero.', x: 0.12, y: 0.35, ancho: 0.76, tamano: 0.07, color: '#FFFFFF' },
      ],
    }],
  });
  const conHandle = leerReplica(crudo, { laminas: 1, usuario: 'mako.digital' }) as Replica;
  assert.equal(conHandle.laminas[0].textos[0].texto, '@mako.digital · 02 / 06', 'el comodín no tomó el @ del negocio');
  const sinHandle = leerReplica(crudo, { laminas: 1, usuario: null }) as Replica;
  assert.ok(!sinHandle.laminas[0].textos[0].texto.includes('@'), 'sin @ cargado, el comodín quedó escrito o inventó uno');
  assert.equal(conHandle.laminas[0].formas?.length, 2, 'una forma con un color que no es #RRGGBB no va');
  const foto = { id: 'f1', url: 'https://x.supabase.co/storage/v1/object/public/image-editor/9/cara.jpg', ancho: 1080, alto: 1440 };
  const doc = documentoDeReplica({ replica: conHandle, estilo, marca: { nombre: 'X', usuario: 'mako.digital' }, foto, nuevoId });
  const objs = objetosDe(doc);
  const iLinea = objs.findIndex((o) => o.name === 'Marco: línea');
  const iTarjeta = objs.findIndex((o) => o.name === 'Marco: tarjeta');
  const iTexto = objs.findIndex((o) => o.type === 'textbox');
  assert.ok(iLinea >= 0 && iTarjeta >= 0, 'el marco no se dibujó');
  assert.ok(iLinea < iTexto && iTarjeta < iTexto, 'el marco tiene que ir DEBAJO de los textos');
  assert.ok((objs[iTarjeta].rx as number) > 0 && objs[iTarjeta].shadow, 'la tarjeta perdió las esquinas curvas o la sombra');
  const avatar = objs.find((o) => o.type === 'image')!;
  assert.equal((avatar.slot as { mask?: string }).mask, 'circle', 'el avatar de un tuit va redondo');
  assert.equal((avatar.slot as { width: number }).width, (avatar.slot as { height: number }).height, 'un círculo es cuadrado');
  // El titular blanco está sobre la tarjeta BLANCA de una lámina OSCURA: contra el fondo se leería; contra su tarjeta, no.
  const tit = objs.find((o) => o.name === 'Titular')!;
  assert.equal(tit.fill, '#111111', 'blanco sobre la tarjeta blanca no se lee');
});

test('9 · la cara en la portada cuando el original tiene una persona ahí; en una miniatura, grande', () => {
  const persona = (y: number) => ({ x: 0, y, ancho: 1, alto: 0.5, tipo: 'escena' as const, persona: true, descripcion: 'gente en un salón', busqueda: 'meeting room', forma: 'rect' as const });
  const foto = { id: 'f1', url: 'https://x.supabase.co/storage/v1/object/public/image-editor/9/cara.jpg', ancho: 1080, alto: 1440 };
  const r: Replica = { proporcion: '4:5', titulo: 'X', laminas: [{ fondo: '#FFFF00', foto: null, cuadros: [persona(0.3)], textos: [texto({ rol: 'titulo', texto: 'Hola' })] }] };
  const doc = documentoDeReplica({ replica: r, estilo, marca: { nombre: 'X', usuario: null }, foto, nuevoId, escenas: new Map([['meeting room', salon]]) });
  const suya = objetosDe(doc).filter((o) => o.type === 'image' && o.src === foto.url);
  assert.equal(suya.length, 1, 'eligió su cara y la portada tiene gente: la cara no entró');
  // Sin persona en ningún lado, no va.
  const paisaje: Replica = { ...r, laminas: [{ ...r.laminas[0], cuadros: [{ ...persona(0.3), persona: false }] }] };
  assert.equal(objetosDe(documentoDeReplica({ replica: paisaje, estilo, marca: { nombre: 'X', usuario: null }, foto, nuevoId })).filter((o) => o.src === foto.url).length, 0);
  // Miniatura: un retrato chico en una esquina crece a todo el alto.
  const mini: Replica = { proporcion: '16:9', titulo: 'M', laminas: [{ fondo: '#F2F2F2', foto: null, textos: [texto({ rol: 'titulo', texto: 'UPGRADE' })],
    cuadros: [{ x: 0.66, y: 0.55, ancho: 0.34, alto: 0.45, tipo: 'retrato', persona: true, descripcion: 'él', busqueda: '', forma: 'rect' }] }] };
  const img = objetosDe(documentoDeReplica({ replica: mini, estilo, marca: { nombre: 'X', usuario: null }, foto, nuevoId })).find((o) => o.type === 'image')!;
  assert.equal(img.top, 0, 'la persona de la miniatura sigue chica');
  assert.ok(Math.abs((img.height as number) * (img.scaleY as number) - 720) < 1, 'la persona no ocupa todo el alto');
  const p = promptDeReplica({ laminas: 6, vistas: 6, negocio: '', voz: '', nombreNegocio: 'X', cta: null, conAvatar: true, pedido: null, anuncio: false, pie: null } as never);
  assert.match(p, /"formas":\[\{"tipo":"linea\|caja"/, 'el prompt no pide el marco');
  assert.match(p, /escribe exactamente @usuario/, 'el prompt no dice cómo poner el @ del negocio');
});

// ── Probado rompiéndolo (12/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   R1 `colorQueSeLee` sin la pastilla perdida (rótulo blanco sobre crema queda igual)      → falla el 2 y el 5
//   R2 `acomodarTextos` sin el factor a lo ancho                                             → falla el 3
//   R3 `acomodarTextos` sin `seMeteEnUnaFoto`                                                → falla el 4
//   R4 sin `otraEscena` (el cuadro sin su escena queda vacío)                                → falla el 5
//   R5 `libre` contando los cuadros y no las fotos puestas                                   → falla el 5
//   R6 el prompt con «por ejemplo «pantalla dividida…»» otra vez                             → falla el 6
//   M1 sin leer `formas` (el marco)                                                          → falla el 8
//   M2 sin el recorte del cuadro (el avatar cuadrado)                                        → falla el 8
//   M3 sin cambiar el comodín @usuario                                                       → falla el 8
//   M4 el color medido contra el fondo y no contra la tarjeta de atrás                       → falla el 8
//   M5 sin `conLaCara` (la cara elegida no entra en la portada)                              → falla el 9
