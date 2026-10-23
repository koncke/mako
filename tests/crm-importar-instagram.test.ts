// =============================================================================
// Una lista exportada con sólo el @ de Instagram entra al CRM: el CSV, la planilla y la tabla de revisión lo leen
// =============================================================================
// 23/10/2026. `docs/hallazgos-crm.md` («Un lead puede entrar con sólo su @ de Instagram») dejó anotado que el CSV no
// leía una columna de Instagram: una lista de otra herramienta con sólo el @ seguía cayendo como «sin email ni
// teléfono», aunque `recalcular` ya aceptaba el @ como contacto. Lo que se fija acá:
//
//   1. La columna se reconoce por ENCABEZADO, por palabra (`ig` por inclusión leía «Origen» como el @ de cada lead).
//   2. Una columna que nombra a Instagram y NO es el usuario (seguidores, bio, «¿tiene?») no se lee.
//   3. Una celda que no es un usuario queda vacía: «no», «ninguno», «0», un nombre, un link a un post. Nada se inventa.
//   4. Con sólo el @ la fila no es «sin contacto» y el email y el teléfono quedan VACÍOS.
//   5. El email y el teléfono mandan sobre Instagram; el nombre y la empresa no se llevan la columna de Instagram.
//   6. El @ es llave de duplicados en las tres formas en que llega, dentro del archivo y contra el CRM (el índice y la
//      marca de «ya existe» se EJECUTAN desde el fuente de importar-server.ts: ese módulo lleva `server-only` y un
//      test no lo puede importar).
//   7. La tabla de revisión dibuja el @ en el lugar del email cuando es su único canal, sin rótulo de «falta» y sin
//      una columna nueva.
//   8. Mientras el email tiene el foco, esa celda sigue siendo el input: borrar el email para corregirlo no lo desmonta.
//
// ⚠️ LOS ENCABEZADOS QUE «NO» SE PRUEBAN CON UN VALOR QUE SÍ PASARÍA COMO USUARIO («referido»). Con un número de
// seguidores la celda se rechaza sola y el test quedaba verde aunque el encabezado se leyera mal: mide una sola cosa
// por vez (el encabezado acá, la celda en su propio test).
//
// Probado rompiéndolo (23/10/2026), RONDA 1: base 32 / 0, UNA rotura por vez sobre el fuente real, restaurando DE MEMORIA
// (los bytes originales, no git), y cada una cae con SU test (pasan / fallan; los conteos son los de esa ronda):
//   · el encabezado `ig`/`insta` por inclusión (lee «Origen») ..................... 29 / 3
//   · sin la lista de encabezados que no son el usuario (seguidores, bio...) ...... 31 / 1
//   · la celda sin su filtro (largo, números, respuestas) ......................... 27 / 5
//   · sin el rechazo de números / sin la lista de respuestas ...................... 31 / 1 · 27 / 5
//   · un link a un perfil que también pasa por la lista de respuestas ............. 31 / 1
//   · la celda devuelve el texto crudo y no el usuario ............................ 21 / 11
//   · `claveInstagram` sin normalizar / `recalcular` con el @ crudo ............... 26 / 6 · 30 / 2
//   · el email o el teléfono buscados saltando la columna de Instagram ............ 30 / 2 · 31 / 1
//   · la empresa o el nombre pueden ser la columna de Instagram ................... 31 / 1 · 31 / 1
//   · sin volver a la columna de Instagram si es la ÚNICA del nombre .............. 31 / 1
//   · Instagram lee una columna ya usada / la columna de pago ..................... 30 / 2 · 31 / 1
//   · sólo la primera columna de Instagram ........................................ 31 / 1
//   · toda fila lleva `instagram` aunque vacío .................................... 22 / 10
//   · el motivo vuelve a «sin email ni teléfono» / el error sin Instagram ......... 29 / 3 · 31 / 1
//   · tabla: el @ nunca en el lugar del email / «solo» ignora el teléfono ......... 31 / 1 · 31 / 1
//   · tabla: sin el @ debajo del email / rótulo de «falta» junto al @ ............. 31 / 1 · 30 / 2
//   · tabla: una columna nueva en la grilla ....................................... 31 / 1
//   · tabla: el @ crudo (sin `claveInstagram`) / sin link / sin `noopener` ........ 31 / 1 · 31 / 1 · 31 / 1
//   · índice: el @ guardado sin normalizar / la fila sin normalizar ............... 29 / 3 · 31 / 1
//   · `porIg` fuera de `apuntan` / `yaExiste` siempre falso ....................... 27 / 5 · 27 / 5
//
// RONDA 2, tras la revisión (base 34 / 0; sólo lo que se tocó). La lista de encabezados que no son el usuario NO tenía caso
// para 25 de sus 34 alternativas: se podían borrar de a una y los 32 tests seguían en verde.
//   · cada una de las 39 alternativas de NO_ES_EL_USUARIO, BORRADA de a una ........ 32 / 2 cada una (cae SU encabezado)
//   · vuelve el atajo [?¿] (el signo de pregunta como regla) ........................ 32 / 2
//   · el encabezado no se pasa a espacios (snake_case) .............................. 33 / 1
//   · una alternativa nueva sin ningún caso / un grupo dentro del regex ............. 33 / 1 · 33 / 1
//   · `arrobaEsSuUnicoCanal` ignora el foco ......................................... 33 / 1
//   · la tabla no le pasa el foco a la decisión / sin onFocus / sin onBlur ......... 33 / 1 · 33 / 1 · 33 / 1
//   · onFocus en TODOS los inputs de la fila / la tabla no guarda el email en edición 33 / 1 · 33 / 1
//
// Correr: node --import tsx --test tests/crm-importar-instagram.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MOTIVO_LABEL, arrobaEsSuUnicoCanal, claveInstagram, clavesDeTelefono, buscarTelefono, esColumnaInstagram, filasDesdeCsv, filasDesdePlanilla, instagramDeCelda, recalcular,
  type FilaImport,
} from '../app/crm/leads-importar';
import { TablaRevisionLeads } from '../app/crm/TablaRevisionLeads';

const leer = (rel: string) => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque de una función: desde su firma hasta la próxima declaración de primer nivel. */
const bloque = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.slice(i + firma.length).search(/\n(export )?(async )?(function|const|type) /);
  return src.slice(i, fin < 0 ? undefined : i + firma.length + fin);
};

/** Un CSV de dos columnas: el nombre y la que se prueba. */
const csv2 = (encabezado: string, celda: string) => `Nombre,${encabezado}\nInmobiliaria Pérez,${celda}\n`;
const unaFila = (texto: string, delim = ','): FilaImport => {
  const r = filasDesdeCsv(texto, delim);
  assert.equal(r.error, undefined, `no debería haber error: ${r.error}`);
  assert.equal(r.filas.length, 1);
  return r.filas[0];
};

// ── 1. El encabezado ─────────────────────────────────────────────────────────

const ENCABEZADOS_QUE_SI = [
  'Instagram', 'instagram', 'INSTAGRAM', ' Instagram ', 'Instagrám', '@Instagram', 'IG', 'ig', 'Insta',
  'Usuario de Instagram', 'Perfil de Instagram', 'Cuenta de Instagram', 'Handle de Instagram', 'Link de Instagram',
  'URL de Instagram', 'Instagram URL', 'Instagram Username', 'insta_user', 'Usuario IG', 'IG handle', 'Perfil de IG',
  // Los de un formulario (Google Forms, Typeform) llevan signo de pregunta y piden el @, no un sí o no: el signo no decide.
  '¿Cuál es tu Instagram?', '¿Cuál es tu usuario de Instagram?', 'Tu usuario de Instagram?', 'What is your Instagram?',
  // Los de un scraper o una base van en snake_case.
  'instagram_user', 'Instagram_Username', 'ig_handle',
];

test('el encabezado de Instagram se reconoce con sus alias, sin importar mayúsculas, acentos ni espacios', () => {
  for (const h of ENCABEZADOS_QUE_SI) {
    assert.equal(esColumnaInstagram(h), true, `«${h}» tendría que ser la columna de Instagram`);
    // El encabezado «Instagram Username» matchea también el 'name' del nombre: tiene que ganar el nombre de verdad.
    const f = unaFila(`Nombre,${h}\nInmobiliaria Pérez,@Ana_Lopez\n`);
    assert.equal(f.instagram, 'ana_lopez', `«${h}»: no leyó el @`);
    assert.equal(f.nombre, 'Inmobiliaria Pérez', `«${h}»: el nombre se movió`);
  }
});

const ENCABEZADOS_QUE_NO = [
  // Palabras que CONTIENEN `ig` o `insta` sin serlo: «Origen» es la columna de cualquier CRM.
  'Origen', 'Digital', 'Significado', 'Dirigido a', 'Instalación', 'Instancia',
  // Mencionan a Instagram y no son el usuario: UNO POR ALTERNATIVA de NO_ES_EL_USUARIO (el test que sigue lo exige;
  // el orden es el de la lista del fuente). Cada uno lo rechaza SÓLO su alternativa.
  'Seguidores en Instagram', 'Instagram Followers', 'Siguiendo en Instagram', 'Instagram Following',
  'Instagram Likes', 'Me gusta en Instagram', 'Instagram Posts', 'Publicaciones de Instagram',
  'Instagram Bio', 'Biografía de Instagram', 'Descripción de Instagram',
  'Instagram verificado', 'Instagram Verified', 'Instagram privado', 'Instagram Private', 'Categoría de Instagram',
  'Foto de Instagram', 'Instagram Photo', 'Imagen de Instagram', 'Instagram Image', 'Instagram Pic', 'Instagram Profile Picture',
  'Fecha de Instagram', 'Instagram Date', 'Instagram Estado', 'Instagram Status', 'Mensaje de Instagram', 'Instagram Message',
  // Las preguntas de sí o no: el VERBO es lo que las distingue de «¿Cuál es tu Instagram?», no el signo. Contestan «sí», «no»
  // o «personal» / «negocio», y estos dos últimos SON usuarios válidos.
  '¿Tiene Instagram?', 'Tiene Instagram', '¿Tienes Instagram?', 'Tienes Instagram', 'Tienen Instagram', '¿Usas Instagram?',
  'Cuentas con Instagram', 'Has Instagram', 'I have Instagram', 'Do you use Instagram', 'Are you on Instagram',
  // Métricas que suelen venir en la misma exportación.
  'Instagram Engagement', 'Alcance de Instagram', 'Instagram Reach',
  // En snake_case (un scraper, una base): `\b` no corta en el guion bajo, así que el encabezado se pasa a espacios antes de mirarlo.
  'instagram_bio', 'has_instagram', 'instagram_status', 'tiene_instagram',
  // Un usuario cualquiera no es el de Instagram: puede ser el de cualquier red.
  'Username', 'Perfil', 'Usuario', 'Cuenta',
];

test('lo que no es la columna del usuario no se lee, aunque su encabezado se parezca', () => {
  for (const h of ENCABEZADOS_QUE_NO) {
    assert.equal(esColumnaInstagram(h), false, `«${h}» no es la columna del usuario de Instagram`);
    // «referido» SÍ pasaría como usuario: si el encabezado se leyera mal, quedaría guardado como el @ de la persona.
    const f = unaFila(csv2(h, 'referido'));
    assert.ok(!('instagram' in f), `«${h}»: se leyó como el @ (${f.instagram})`);
    assert.equal(recalcular([f])[0].motivo, 'sin-contacto', `«${h}»: la fila no tiene ningún canal`);
  }
});

test('cada alternativa de NO_ES_EL_USUARIO tiene un encabezado que SÓLO ella rechaza', () => {
  // Sin esto una alternativa se puede BORRAR del regex y la lista de arriba sigue verde (pasó: de las 34 originales, 25 no tenían
  // ni un caso). Se lee del fuente y se separa por `|`: por eso van planas, sin grupos.
  const fuente = leer('app/crm/leads-importar.ts').match(/const NO_ES_EL_USUARIO = \/(.+)\/;/)?.[1];
  assert.ok(fuente, 'no encontré NO_ES_EL_USUARIO en leads-importar.ts');
  assert.doesNotMatch(fuente, /[()]/, 'las alternativas van PLANAS (sin grupos): este test las separa por «|»');
  const alternativas = fuente.split('|');
  const completa = new RegExp(fuente);
  // El espejo de cómo `esColumnaInstagram` deja el encabezado (sin acentos, mayúsculas ni guiones bajos).
  const plano = (h: string) => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/_/g, ' ');
  const planos = ENCABEZADOS_QUE_NO.map(plano);
  // Si el espejo se desfasara, los que nombran a Instagram dejarían de caer en el regex y la comprobación de abajo mentiría.
  for (const p of planos.filter((x) => x.includes('instagram'))) {
    assert.ok(completa.test(p), `«${p}» no lo rechaza ninguna alternativa (¿se borró la que lo rechazaba, o se desfasó el espejo de \`esColumnaInstagram\`?)`);
  }
  for (const alt of alternativas) {
    const resto = new RegExp(alternativas.filter((a) => a !== alt).join('|'));
    assert.ok(planos.some((p) => completa.test(p) && !resto.test(p)),
      `la alternativa «${alt}» no tiene en ENCABEZADOS_QUE_NO ningún encabezado que SÓLO ella rechace: se puede borrar del regex sin que nada se ponga en rojo`);
  }
});

// ── 2. La celda ──────────────────────────────────────────────────────────────

const CELDAS_QUE_SI = [
  '@Ana_Lopez', 'ana_lopez', 'ANA_LOPEZ', '  @ana_lopez  ', '@@ana_lopez',
  'https://www.instagram.com/ana_lopez/?hl=es', 'http://instagram.com/ana_lopez', 'instagram.com/ana_lopez/',
  'www.instagram.com/Ana_Lopez/reels/', 'https://m.instagram.com/ana_lopez?igsh=abc',
  // Lo que escribe la propia app al exportar un texto que arranca con @ (lib/csv-celda.ts): el apóstrofo no es parte del dato.
  "'@ana_lopez",
];

test('las tres formas de un usuario (con @, sin @, el link del perfil) dan el mismo usuario', () => {
  for (const c of CELDAS_QUE_SI) {
    assert.equal(unaFila(csv2('Instagram', c)).instagram, 'ana_lopez', `«${c}»`);
  }
});

const CELDAS_QUE_NO = [
  // Lo que se escribe cuando NO hay @ (y pasa la regla de un usuario: letras, números, punto y guion bajo).
  'no', 'No', 'NO', 'Ninguno', 'ninguna', 'nada', 'sin', 'null', 'none', 'si', 'true', 'false', 'pendiente', '0', '1', 'x',
  'n/a', 'N/A', '-', '--', '',
  // Un número no es un usuario (seguidores, un id, una pregunta de sí o no).
  '12500', '3',
  // Y los que no pasan la regla.
  'Ana López', 'ana@gmail.com', '@', 'https://twitter.com/ana_lopez', 'https://www.instagram.com/p/Cxyz123/', 'https://www.instagram.com/explore/',
];

test('una celda que no es un usuario queda vacía: nada se inventa', () => {
  for (const c of CELDAS_QUE_NO) {
    assert.equal(instagramDeCelda(c), '', `«${c}» no es un usuario`);
    const f = unaFila(csv2('Instagram', c));
    assert.ok(!('instagram' in f), `«${c}»: la fila trae instagram = ${f.instagram}`);
    assert.equal(f.email, '');
    assert.equal(f.telefono, '');
    assert.equal(recalcular([f])[0].motivo, 'sin-contacto', `«${c}»: sin @ válido la fila no tiene canal`);
  }
});

test('un link a un perfil se acepta aunque el usuario se llame como una respuesta («no»)', () => {
  // La celda de un link ES el perfil; la lista de respuestas sólo vale para texto suelto.
  assert.equal(instagramDeCelda('https://www.instagram.com/no/'), 'no');
  assert.equal(instagramDeCelda('no'), '');
});

// ── 3. Con sólo el @ la fila entra, y nada se rellena ────────────────────────

test('con sólo el @ la fila NO es «sin contacto» y el email y el teléfono quedan VACÍOS', () => {
  const [r] = recalcular([unaFila(csv2('Instagram', '@inmobiliaria.perez'))]);
  assert.equal(r.motivo, null, 'con el @ solo, la fila entra');
  assert.equal(r.instagram, 'inmobiliaria.perez');
  assert.equal(r.email, '', 'el email no se rellena');
  assert.equal(r.telefono, '', 'el teléfono no se rellena');
  // La misma fila sin el @ sigue sin entrar.
  assert.equal(recalcular([unaFila(csv2('Instagram', ''))])[0].motivo, 'sin-contacto');
});

test('un archivo sin columna de Instagram produce las mismas filas de siempre', () => {
  const r = filasDesdeCsv('Nombre,Email,Teléfono,Empresa\nAna Gómez,ana@x.com,5512345678,Acme\n');
  assert.deepEqual(r.filas, [{ id: 'f1', nombre: 'Ana Gómez', email: 'ana@x.com', telefono: '5512345678', empresa: 'Acme', incluir: true, yaExiste: false }]);
  assert.ok(!('instagram' in r.filas[0]), 'una fila sin @ no lleva `instagram` encima');
});

test('la fila de un archivo con columna de Instagram, sin @ en esa celda, tampoco lleva `instagram`', () => {
  const r = filasDesdeCsv('Nombre,Email,Instagram\nAna,ana@x.com,\nLuis,,@luis_g\n');
  assert.ok(!('instagram' in r.filas[0]));
  assert.equal(r.filas[1].instagram, 'luis_g');
  assert.deepEqual(recalcular(r.filas).map((f) => f.motivo), [null, null]);
});

test('el error de «falta el nombre» nombra la columna de Instagram entre las que lee', () => {
  const r = filasDesdeCsv('Email,Instagram\na@b.com,@ana\n');
  assert.match(r.error ?? '', /Instagram/);
});

test('el motivo «sin contacto» nombra los tres canales: el @ también cuenta', () => {
  assert.match(MOTIVO_LABEL['sin-contacto'], /Instagram/);
  assert.match(MOTIVO_LABEL['sin-contacto'], /email/);
  assert.match(MOTIVO_LABEL['sin-contacto'], /teléfono/);
});

// ── 4. El email y el teléfono mandan; el nombre y la empresa no se llevan el @ ──

test('el email y el teléfono no se pisan: si el encabezado los nombra, son ellos', () => {
  // «Email de Instagram» matchea 'email' Y 'instagram': gana el email, como siempre.
  const a = unaFila('Nombre,Email de Instagram,Instagram\nAna,ana@x.com,@ana_ig\n');
  assert.equal(a.email, 'ana@x.com', 'el email se perdió');
  assert.equal(a.instagram, 'ana_ig');
  // Lo mismo con el teléfono.
  const b = unaFila('Nombre,Teléfono IG,Instagram\nAna,5512345678,@ana_ig\n');
  assert.equal(b.telefono, '5512345678', 'el teléfono se perdió');
  assert.equal(b.instagram, 'ana_ig');
  // Y con el email Y el @ juntos, ninguno reemplaza al otro.
  const c = unaFila('Nombre,Email,Teléfono,Instagram\nAna,ana@x.com,5512345678,@ana_ig\n');
  assert.deepEqual([c.email, c.telefono, c.instagram], ['ana@x.com', '5512345678', 'ana_ig']);
});

test('la columna del email no se lee ADEMÁS como Instagram', () => {
  // Si el encabezado nombra el email y a Instagram, la celda es un email: no se prueba como usuario.
  const f = unaFila('Nombre,Email de Instagram\nAna,ana\n');
  assert.equal(f.email, 'ana');
  assert.ok(!('instagram' in f), '«ana» es el email de esa columna, no un usuario');
});

test('«Instagram del negocio» no es la empresa, y «Instagram Username» no es el nombre', () => {
  // 'negocio' (empresa) y 'name' (nombre, por «username») aparecen DENTRO de esos encabezados.
  const a = unaFila('Nombre,Instagram del negocio\nAna Pérez,@casa_perez\n');
  assert.equal(a.empresa, '', 'la empresa quedó con el @');
  assert.equal(a.instagram, 'casa_perez');
  const b = unaFila('Instagram Username,Nombre,Email\ncasa_perez,Ana Pérez,ana@x.com\n');
  assert.equal(b.nombre, 'Ana Pérez', 'el nombre quedó con el usuario');
  assert.equal(b.instagram, 'casa_perez');
});

test('si la ÚNICA columna que nombra a la persona es una de Instagram, sigue siendo el nombre (no se rompe el archivo)', () => {
  const r = filasDesdeCsv('Nombre en Instagram,Email\nanaperez,ana@x.com\n');
  assert.equal(r.error, undefined);
  assert.equal(r.filas[0].nombre, 'anaperez');
  assert.ok(!('instagram' in r.filas[0]), 'la misma columna no puede ser el nombre y el @');
});

test('el apellido y el pago siguen funcionando con la columna de Instagram al lado', () => {
  const f = unaFila('Nombre,Apellido,Instagram,Pago\nAna,Pérez,@ana_ig,1200\n');
  assert.equal(f.nombre, 'Ana Pérez');
  assert.equal(f.instagram, 'ana_ig');
  assert.equal(f.pagoEnArchivo, true);
  assert.equal(f.montoPago, 1200);
});

test('«Pago por Instagram» es plata, no un @', () => {
  // «pagado» pasaría como usuario de Instagram: si la columna de pago también se leyera como @, quedaría guardado.
  const f = unaFila('Nombre,Email,Pago por Instagram\nAna,ana@x.com,pagado\n');
  assert.equal(f.pagoEnArchivo, true, 'la columna de pago dejó de ser la de pago');
  assert.ok(!('instagram' in f), 'se leyó «pagado» como el @');
});

test('con dos columnas de Instagram gana la primera que traiga un usuario, fila por fila', () => {
  const r = filasDesdeCsv('Nombre,Instagram,Instagram URL\nAna,,https://www.instagram.com/ana_url/\nLuis,@luis_ig,https://www.instagram.com/luis_url/\nOmar,no,\n');
  assert.deepEqual(r.filas.map((f) => f.instagram), ['ana_url', 'luis_ig', undefined]);
});

// ── 5. La planilla (xlsx, pegado con TAB) pasa por el mismo lector ────────────

const TEXTO_PLANILLA = [
  '===== Hoja: Portada =====',
  'Resumen',
  '',
  '===== Hoja: Prospectos =====',
  'Nombre\tOrigen\tInstagram',
  'Inmobiliaria Pérez\tReferido\t@Ana_Lopez',
  'Casa del Sur\tFacebook\thttps://www.instagram.com/casa.sur/',
  'Sin Perfil\tDigital\tno',
].join('\n');

test('la planilla (celdas por TAB) lee la columna de Instagram, y «Origen» no es el @', () => {
  const r = filasDesdePlanilla(TEXTO_PLANILLA);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.filas.map((f) => f.instagram), ['ana_lopez', 'casa.sur', undefined]);
  assert.deepEqual(recalcular(r.filas).map((f) => f.motivo), [null, null, 'sin-contacto']);
  assert.ok(r.filas.every((f) => f.email === '' && f.telefono === ''), 'nada se rellena');
});

test('y el JSON que viaja del route al modal y de vuelta al server no pierde el @', () => {
  // El route devuelve las filas como JSON; el modal las edita con spreads y las manda a la action.
  const viaje = JSON.parse(JSON.stringify(filasDesdePlanilla(TEXTO_PLANILLA).filas)) as FilaImport[];
  const editada = recalcular(viaje.map((f) => ({ ...f, incluir: true })));
  assert.deepEqual(editada.map((f) => f.instagram), ['ana_lopez', 'casa.sur', undefined]);
});

// ── 6. Duplicados ────────────────────────────────────────────────────────────

test('dos filas con el mismo @ escrito de dos formas: la segunda es «repetida dentro del archivo»', () => {
  const r = filasDesdeCsv('Nombre,Instagram\nInmobiliaria Pérez,@Ana_Lopez\nOtro nombre,https://www.instagram.com/ana_lopez/?hl=es\nLa tercera,@otra_cuenta\n');
  const f = recalcular(r.filas);
  assert.deepEqual(f.map((x) => x.motivo), [null, 'repetido-archivo', null]);
  assert.equal(f[0].instagram, f[1].instagram, 'las dos formas tienen que dar la misma llave');
});

test('recalcular compara el @ por su usuario normalizado, venga como venga', () => {
  // Otros productores de filas (la prospección, una propuesta) no pasan por el lector del CSV.
  const base: FilaImport = { id: 'a', nombre: 'Ana', email: '', telefono: '', empresa: '', incluir: true, yaExiste: false };
  const f = recalcular([{ ...base, id: 'a', instagram: '@Ana_Lopez' }, { ...base, id: 'b', nombre: 'Otra', instagram: 'ana_lopez' }]);
  assert.deepEqual(f.map((x) => x.motivo), [null, 'repetido-archivo']);
  assert.equal(claveInstagram('@Ana_Lopez'), 'ana_lopez');
  assert.equal(claveInstagram('https://www.instagram.com/Ana_Lopez/'), 'ana_lopez');
  assert.equal(claveInstagram('Ana López'), '', 'lo que no es un usuario no es la llave de nadie');
  assert.equal(claveInstagram(null), '');
  // Un valor que NO es un usuario no cuenta como canal: el server también lo descarta (`usuarioInstagram`).
  assert.equal(recalcular([{ ...base, instagram: 'Ana López' }])[0].motivo, 'sin-contacto');
});

const SRV = sinComentarios(leer('app/crm/importar-server.ts'));

/** `anotar` del índice, tal cual está en el server. */
function anotarDelServer(): (m: Map<string, number | null>, k: string, id: number) => void {
  const m = bloque(SRV, 'export async function indiceContactos(').match(/const anotar = \([^)]*\) => \{\n([\s\S]*?)\n  \};/);
  assert.ok(m, 'no encontré `anotar` en indiceContactos');
  return new Function('m', 'k', 'id', m[1]) as never;
}

/** Lo que el server hace con cada página de `leads` al armar el índice (`indiceContactos`), compilado del fuente. */
function indiceDeLeads(leads: Array<{ id: number; email?: string | null; telefono?: string | null; telefono_normalizado?: string | null; instagram?: string | null }>) {
  const m = bloque(SRV, 'export async function indiceContactos(').match(/\(chunk\) => \{\n([\s\S]*?)\n\s*\},\n\s*\);/);
  assert.ok(m, 'no encontré el recorrido de la página de leads en indiceContactos');
  const emails = new Map<string, number | null>();
  const tels = new Map<string, number | null>();
  const telsSufijo = new Map<string, number | null>();
  const igs = new Map<string, number | null>();
  const recorrer = new Function('chunk', 'anotar', 'emails', 'tels', 'telsSufijo', 'igs', 'clavesDeTelefono', 'claveInstagram', m[1]);
  recorrer(leads.map((l) => ({ email: null, telefono: null, telefono_normalizado: null, ...l })), anotarDelServer(), emails, tels, telsSufijo, igs, clavesDeTelefono, claveInstagram);
  return { emails, tels, telsSufijo, igs };
}

/** `marcarExistentes` sin la base: el cuerpo del `map` compilado del fuente, con un índice que le paso yo. */
function marcarContra(indice: ReturnType<typeof indiceDeLeads>, filas: FilaImport[]): FilaImport[] {
  const cuerpo = bloque(SRV, 'export async function marcarExistentes(');
  const ini = cuerpo.indexOf('filas.map((f) => {');
  const fin = cuerpo.lastIndexOf('}));');
  assert.ok(ini > 0 && fin > ini, 'no encontré el `map` de marcarExistentes');
  const js = cuerpo.slice(ini + 'filas.map((f) => {'.length, fin).replace(/ as number/g, '');
  const marcar = new Function('f', 'emails', 'tels', 'telsSufijo', 'igs', 'buscarTelefono', 'claveInstagram', js) as
    (f: FilaImport, ...r: unknown[]) => FilaImport;
  return recalcular(filas.map((f) => marcar(f, indice.emails, indice.tels, indice.telsSufijo, indice.igs, buscarTelefono, claveInstagram)));
}

const fila = (p: Partial<FilaImport>): FilaImport => ({ id: 'f', nombre: 'Inmobiliaria Pérez', email: '', telefono: '', empresa: '', incluir: true, yaExiste: false, ...p });

test('el @ de un lead que ya está en el CRM marca la fila como «ya existe» y dice a CUÁL', () => {
  const idx = indiceDeLeads([{ id: 7, instagram: 'ana_lopez' }]);
  const [r] = marcarContra(idx, filasDesdeCsv('Nombre,Instagram\nInmobiliaria Pérez,https://www.instagram.com/Ana_Lopez/?hl=es\n').filas);
  assert.equal(r.yaExiste, true);
  assert.equal(r.motivo, 'duplicado', 'con el @ de un lead existente la fila es un duplicado, no una fila nueva');
  assert.equal(r.leadExistenteId, 7, 'y se sabe a quién completar');
  // Un @ que no está en el CRM no marca nada.
  const [otra] = marcarContra(idx, [fila({ instagram: 'otra_cuenta' })]);
  assert.equal(otra.yaExiste, false);
  assert.equal(otra.motivo, null);
});

test('el @ guardado como «@Ana_Lopez» (createLead lo guarda como llega) también matchea', () => {
  const idx = indiceDeLeads([{ id: 7, instagram: '@Ana_Lopez' }]);
  assert.deepEqual([...idx.igs], [['ana_lopez', 7]], 'el índice tiene que guardar la llave normalizada');
  const [r] = marcarContra(idx, [fila({ instagram: 'ana_lopez' })]);
  assert.equal(r.motivo, 'duplicado');
  assert.equal(r.leadExistenteId, 7);
});

test('la fila con el @ en otra forma que la guardada matchea igual', () => {
  const idx = indiceDeLeads([{ id: 7, instagram: 'ana_lopez' }]);
  // Una fila que llegó sin normalizar (no pasa por el lector del CSV) no puede quedar afuera.
  const [r] = marcarContra(idx, [fila({ instagram: '@Ana_Lopez' })]);
  assert.equal(r.yaExiste, true);
  assert.equal(r.leadExistenteId, 7);
});

test('dos leads con el mismo @: «ya existe» sigue siendo cierto y no hay a quién completar', () => {
  const idx = indiceDeLeads([{ id: 7, instagram: 'ana_lopez' }, { id: 9, instagram: '@ANA_LOPEZ' }]);
  assert.deepEqual([...idx.igs], [['ana_lopez', null]]);
  const [r] = marcarContra(idx, [fila({ instagram: 'ana_lopez' })]);
  assert.equal(r.yaExiste, true);
  assert.equal(r.leadExistenteId, null);
});

test('el índice no guarda un valor que no es un usuario, y el @ no le roba el lugar al email ni al teléfono', () => {
  const idx = indiceDeLeads([
    { id: 1, instagram: 'Ana López' },
    { id: 2, instagram: '   ' },
    { id: 3, instagram: null },
    { id: 4, email: 'ana@x.com', telefono: '5512345678', instagram: 'ana_ig' },
  ]);
  assert.deepEqual([...idx.igs], [['ana_ig', 4]]);
  assert.deepEqual([...idx.emails], [['ana@x.com', 4]]);
  // La misma persona por el email y por el @: es UN lead, así que se puede completar.
  const [r] = marcarContra(idx, [fila({ email: 'ANA@x.com', instagram: '@ana_ig' })]);
  assert.equal(r.leadExistenteId, 4);
  // El email de un lead y el @ de OTRO: ya existe, pero no hay a quién completar.
  const idx2 = indiceDeLeads([{ id: 1, email: 'ana@x.com' }, { id: 2, instagram: 'luis_ig' }]);
  const [dos] = marcarContra(idx2, [fila({ email: 'ana@x.com', instagram: 'luis_ig' })]);
  assert.equal(dos.yaExiste, true);
  assert.equal(dos.leadExistenteId, null);
});

// ── 7. La tabla de revisión ──────────────────────────────────────────────────

const html = (filas: FilaImport[]) => renderToStaticMarkup(createElement(TablaRevisionLeads, { filas: recalcular(filas), onFilas: () => {} }));
const celdaEmail = (id: string) => new RegExp(`aria-label="Email de la fila ${id}"`);
const celdaTelefono = (id: string) => new RegExp(`aria-label="Teléfono de la fila ${id}"`);

test('con el @ como único canal, el @ está EN EL LUGAR DEL EMAIL y no hay rótulo de «falta»', () => {
  const h = html([fila({ id: 'solo', instagram: 'ana_lopez' })]);
  assert.match(h, /<a href="https:\/\/www\.instagram\.com\/ana_lopez\/"[^>]*data-solo-instagram=""[^>]*>@ana_lopez<\/a>/, 'el @ no está en la celda del email');
  assert.doesNotMatch(h, celdaEmail('solo'), 'en su lugar no queda un campo de email vacío');
  assert.match(h, celdaTelefono('solo'), 'el teléfono es el de siempre');
  assert.match(h, /aria-label="Abrir el Instagram de Inmobiliaria Pérez"/);
  assert.match(h, /target="_blank" rel="noopener noreferrer"/, 'el perfil se abre en otra pestaña, sin darle la ventana');
  // Ni un rótulo de dato faltante, ni «sin contacto»: la fila entra.
  assert.doesNotMatch(h, /falta/i);
  assert.doesNotMatch(h, /sin contacto|sin email|sin teléfono/i);
  assert.match(h, />entra</);
});

test('con otro canal, el @ va debajo del email y el email sigue siendo editable', () => {
  for (const [id, canal] of [['mail', { email: 'ana@x.com' }], ['tel', { telefono: '5512345678' }]] as const) {
    const h = html([fila({ id, instagram: 'ana_lopez', ...canal })]);
    assert.match(h, celdaEmail(id), `${id}: el email dejó de poder editarse`);
    assert.match(h, /data-instagram=""[^>]*>@ana_lopez<\/a>/, `${id}: el @ que se va a guardar no se ve`);
    assert.doesNotMatch(h, /data-solo-instagram/, `${id}: no es su único canal`);
    assert.doesNotMatch(h, /falta/i);
  }
});

const TABLA = sinComentarios(leer('app/crm/TablaRevisionLeads.tsx'));

test('mientras el email tiene el foco, la celda sigue siendo el input: borrarlo para corregirlo no lo desmonta', () => {
  // Una fila con @ y email (sin teléfono) dibuja el input. Si la persona lo borra para corregirlo, en cuanto queda vacío el
  // @ pasaba a ser su único canal y la celda se cambiaba por el link EN MEDIO del tipeo: el input perdía el foco y no
  // quedaba dónde escribir el nuevo. El valor cambia con cada tecla; el foco, no.
  const base = { email: 'ana@x.com', telefono: '', instagram: 'ana_lopez' };
  assert.equal(arrobaEsSuUnicoCanal(base), false, 'con un email, el @ no es su único canal');
  assert.equal(arrobaEsSuUnicoCanal({ ...base, email: '' }), true, 'sin foco, un email borrado deja al @ como único canal');
  assert.equal(arrobaEsSuUnicoCanal({ ...base, email: '' }, true), false, 'con el foco en el email, la celda sigue siendo el input');
  assert.equal(arrobaEsSuUnicoCanal({ ...base, email: '   ' }, true), false, 'tampoco con sólo espacios');
  // El foco no inventa un link: sin un usuario válido no hay nada que dibujar, y el teléfono sigue siendo un canal.
  assert.equal(arrobaEsSuUnicoCanal({ email: '', telefono: '', instagram: undefined }), false);
  assert.equal(arrobaEsSuUnicoCanal({ email: '', telefono: '', instagram: 'Ana López' }), false);
  assert.equal(arrobaEsSuUnicoCanal({ email: '', telefono: '5512345678', instagram: 'ana_lopez' }), false);

  // El enchufe, que un render estático no puede probar (no hay DOM donde tipear): el input del email avisa cuando toma y
  // cuando suelta el foco, y la tabla se lo pasa a la decisión.
  assert.match(TABLA, /const \[emailEnEdicion, setEmailEnEdicion\] = useState<string \| null>\(null\);/,
    'la tabla no recuerda qué email se está tipeando');
  const i = TABLA.indexOf('const campo = (');
  assert.ok(i > 0, 'no encontré `campo` en la tabla de revisión');
  const campo = TABLA.slice(i, TABLA.indexOf('const ig = ', i));
  assert.match(campo, /onFocus=\{k === 'email' \? \(\) => setEmailEnEdicion\(f\.id\) : undefined\}/,
    'el input del email no avisa que tomó el foco: borrarlo lo desmonta a mitad de tipeo');
  assert.match(campo, /onBlur=\{k === 'email' \? \(\) => setEmailEnEdicion\(\(id\) => \(id === f\.id \? null : id\)\) : undefined\}/,
    'al soltar el foco la celda no vuelve a decidir por el valor: la fila se queda con un campo de email vacío');
  assert.match(TABLA, /const soloIg = arrobaEsSuUnicoCanal\(f, emailEnEdicion === f\.id\);/,
    'la decisión de dibujar el @ en el lugar del email no sabe qué email se está tipeando');
});

test('una fila sin @ se dibuja como siempre, y la que no tiene ningún canal sigue marcada «sin contacto»', () => {
  const h = html([fila({ id: 'a', email: 'ana@x.com' }), fila({ id: 'b' })]);
  assert.match(h, celdaEmail('a'));
  assert.match(h, celdaEmail('b'));
  assert.doesNotMatch(h, /data-instagram/);
  assert.match(h, /sin email, teléfono ni Instagram/, 'el motivo nombra los tres canales');
});

test('el @ de una fila que NO es un usuario no se dibuja como si lo fuera, ni cuenta como canal', () => {
  // La tabla recibe lo que le llegue (una propuesta, la prospección): la misma llave que `recalcular`.
  const h = html([fila({ id: 'raro', email: 'ana@x.com', instagram: 'Ana López' }), fila({ id: 'raro2', instagram: 'Ana López' })]);
  assert.doesNotMatch(h, /data-instagram|instagram\.com|@Ana/);
  assert.match(h, celdaEmail('raro2'), 'sin un usuario válido la fila vuelve a mostrar su campo de email');
  assert.match(h, /sin email, teléfono ni Instagram/, 'y no tiene ningún canal');
});

test('la grilla es la fija de siempre: ninguna columna nueva, y la tabla sigue scrolleando en su propio eje', () => {
  const h = html([fila({ id: 'solo', instagram: 'ana_lopez' }), fila({ id: 'mail', email: 'ana@x.com', instagram: 'luis' }), fila({ id: 'sin' })]);
  const plantillas = [...h.matchAll(/grid-template-columns:([^;"]*)/g)].map((m) => m[1]);
  assert.equal(plantillas.length, 4, 'el encabezado y las tres filas');
  assert.deepEqual([...new Set(plantillas)], ['26px 1.2fr 1.4fr 1fr 1fr 156px'], 'cambió la plantilla de columnas');
  assert.deepEqual([...h.matchAll(/<span style="[^"]*text-transform:uppercase[^"]*">([^<]+)<\/span>/g)].map((m) => m[1]).slice(-5), ['Nombre', 'Email', 'Teléfono', 'Empresa', 'Estado'], 'cambió el encabezado');
  assert.match(h, /overflow-x:auto/);
  assert.match(h, /min-width:730px/);
});

test('la tabla de la importación y la de /crm/revisar son LA MISMA: sólo el @ se suma, en esa tabla', () => {
  // `RevisarLead` (propuestas de un canal) usa este componente y sus filas no traen @: se tienen que ver igual que antes.
  const h = html([fila({ id: 'p', email: 'ana@x.com', telefono: '5512345678', empresa: 'Acme' })]);
  assert.match(h, celdaEmail('p'));
  assert.match(h, celdaTelefono('p'));
  assert.doesNotMatch(h, /data-instagram|instagram\.com/);
});
