// =============================================================================
// Un lead que vuelve a entrar con el mismo @ de Instagram no se duplica
// =============================================================================
// 23/10/2026, pedido: «que no se duplique un lead que vuelve a entrar con el mismo @». Un lead puede nacer con SÓLO su @
// (lib/contacto-minimo.ts) y entonces `duplicadosDeLead` —que miraba email y teléfono— lo comparaba por NOMBRE o no lo
// comparaba: el alta manual del mismo @ pasaba. Lo que se fija acá:
//   1. El @ es una llave, y se compara por el USUARIO NORMALIZADO de los dos lados (`instagramComparable`): lo guardado
//      puede ser `ana_lopez`, `@Ana_Lopez` o el link del perfil, según por dónde entró el lead.
//   2. El `_` de un usuario de Instagram es comodín en `ilike`: `ana_lopez` no puede traer a `anaxlopez` (`patronDeInstagram`).
//   3. Orden de motivos: email, teléfono, Instagram, nombre. El @ gana al nombre, pero NO lo apaga: casi ninguna ficha vieja
//      tiene la columna (mig 0258), así que «Juan Pérez + @juanp» tiene que seguir avisando de un «Juan Pérez» que ya está.
//   4. La columna `instagram` (mig 0258) se pide SÓLO en la consulta del @ y SÓLO si el candidato trae @.
//   5. Los llamadores que ya tienen el @ lo pasan, y ningún consumidor del motivo se rompe con uno nuevo.
//
// Probado rompiéndolo (23/10/2026), en dos rondas. PRIMERA: base 22 / 0; una rotura por vez, restaurando desde memoria
// dentro del mismo proceso (los archivos quedaron iguales byte a byte). Dieron rojo, cada una con SU test (las dos de «nombre
// con @» se reemplazaron en la segunda ronda, porque lo que fijaban era justo el error):
//   · escape sacado de patronDeInstagram                 → 21 / 1 («el guion bajo… NO es comodín»)
//   · escape sacado de la consulta del server            → 21 / 1 (SERVER: escapa los comodines)
//   · normalización sacada de lo guardado / del candidato → 20 / 2 y 18 / 4 (las tres formas, el orden, el dato fuerte)
//   · instagramComparable sin links; «p» fuera de las rutas → 17 / 5 y 19 / 3 (incluida «es LA MISMA regla que usuarioInstagram»)
//   · el @ antes que el email en la lista                 → 20 / 2 (el orden de los motivos)
//   · la columna pedida siempre / en la consulta de email → 21 / 1 y 21 / 1 (SERVER: sólo en la consulta del @)
//   · la consulta del @ sin su guarda `ig ?`              → 21 / 1 (la misma)
//   · filas del mismo lead pisadas en vez de fundidas     → 21 / 1 · `.catch` del @ sacado → 21 / 1 · error de email/teléfono callado → 21 / 1
//   · crm.run.ts: duplicados_lead sin el @, editar sin pasarlo, editar sin la condición → 21 / 1 las tres
//   · createLead sin el input entero → 21 / 1 · texto del motivo sin «Instagram» → 21 / 1
//   · MotivoDuplicado sin 'instagram', un consumidor que ramifica por el literal, una unión copiada a mano → 21 / 1 las tres
// SEGUNDA (tras el revisor adversarial: el @ NO tiene que apagar el nombre; ya no hay lista PENDIENTES), base 23 / 0:
//   · buscarDuplicados vuelve a apagar el nombre con @     → 22 / 1 («el @ NO apaga el nombre…»)
//   · la consulta por nombre del server la apaga el @      → 21 / 2 (SERVER: el @ no apaga la consulta por nombre)
//   · la consulta por nombre sin su `.catch` propio        → 22 / 1 (SERVER: si falla la consulta del @…)
//   · el nombre se compara aunque haya email o teléfono    → 22 / 1 («con email o teléfono, el nombre sigue sin mirarse»)
//   · el nombre repite a quien ya salió por el @ (sin yaEsta) → 22 / 1 (el mismo del primero)
//   · un consumidor repite la unión a mano (NewLeadForm)   → 22 / 1 (nadie repite la unión de motivos)
//   · la columna instagram en la lista base de columnas    → 22 / 1 (SERVER: la columna instagram se pide SÓLO…)
// (La base 23 / 0 se corrió con `app/customer-success/actions.ts` parchado EN MEMORIA, `motivo: MotivoDuplicado`: ese archivo no
// era de esta pieza y el arreglo no estaba aplicado en su árbol. Sin él, "nadie repite la unión de motivos" da rojo, 22 / 1, y es
// lo correcto: el repo no compila (TS2322) y tsx no lo ve.)
//
// Correr: node --import tsx --test tests/duplicados-instagram.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buscarDuplicados, instagramComparable, patronDeInstagram, textoDuplicado, LeadDuplicadoError,
  type LeadExistente,
} from '../lib/leads-duplicados';
import { usuarioInstagram } from '../app/crm/campo-inline';
import { datosOptin } from '../lib/optin-aviso';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md): un comentario que nombra lo que se prohíbe no cuenta.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El CUERPO de una función de primer nivel: de su firma al `}` en columna 0 (no una ventana de N caracteres). */
const cuerpoDe = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\n}\n', i);
  assert.ok(fin > i, `no encontré el cierre de «${firma}»`);
  return src.slice(i, fin + 3);
};
/** Un trozo entre dos marcas, para los archivos largos donde no hay una función de primer nivel. */
const entre = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
};

const L = (id: number, nombre: string | null, email: string | null, tel: string | null, instagram?: string | null): LeadExistente =>
  ({ id, nombre, email, telefono_normalizado: tel, ...(instagram !== undefined ? { instagram } : {}) });

// ── 1. El usuario normalizado ────────────────────────────────────────────────

test('el mismo usuario, escrito de cualquier forma, es el mismo usuario', () => {
  for (const v of [
    'ana_lopez', '@Ana_Lopez', '  ANA_LOPEZ  ', '@@ana_lopez',
    'https://instagram.com/ana_lopez/', 'https://www.instagram.com/Ana_Lopez/?igsh=abc123',
    'http://m.instagram.com/ana_lopez#x', 'instagram.com/ana_lopez', 'www.instagram.com/ana_lopez/reels/',
  ]) {
    assert.equal(instagramComparable(v), 'ana_lopez', `«${v}» tendría que comparar como ana_lopez`);
  }
  assert.equal(instagramComparable('martin.koncke'), 'martin.koncke', 'el punto es parte del usuario');
});

test('lo que no es un usuario no es una llave', () => {
  // Un nombre, un post, un reel o vacío no nombran a nadie: con uno de éstos como «@» el lead quedaría atado a una cuenta
  // inventada, y dos altas distintas se frenarían entre sí por nada.
  for (const v of ['', '   ', null, undefined, 'Ana Lopez', 'https://instagram.com/p/Cabc123/', 'https://instagram.com/reel/Cabc/',
    'https://instagram.com/explore/', '___', '@', 'a'.repeat(31), 'ana/lopez', 42]) {
    assert.equal(instagramComparable(v), null, `«${String(v)}» no es un usuario`);
  }
});

test('es LA MISMA regla que usuarioInstagram (la de la ficha y el alta), no una parecida', () => {
  // Hay dos copias de cómo se saca el usuario de un LINK (ésta, pura, y la de app/crm/campo-inline.ts); QUÉ ES un usuario
  // es una sola (`usuarioDeTexto`). Si se separan, una ficha guarda `x` y el chequeo busca `y`: el duplicado se cuela sin error.
  const tabla = [
    '@martinkoncke', 'martinkoncke', 'MartinKoncke', 'https://www.instagram.com/martinkoncke/?igsh=1', 'http://instagram.com/Martin.Koncke',
    'instagram.com/martinkoncke', 'm.instagram.com/martinkoncke/', 'https://instagram.com/p/xyz/', 'https://instagram.com/reel/xyz/',
    'https://instagram.com/reels/', 'https://instagram.com/tv/xyz', 'https://instagram.com/explore/tags/x', 'https://instagram.com/stories/x/1',
    'https://instagram.com/accounts/login', 'https://instagram.com/direct/inbox', 'https://instagram.com/about', 'https://instagram.com/legal/terms',
    'https://instagram.com/developer', 'Martin Koncke', '___', '@@', '', '   ', 'a.b_c', 'ana-lopez', 'x'.repeat(30), 'x'.repeat(31),
  ];
  for (const v of tabla) assert.equal(instagramComparable(v), usuarioInstagram(v), `«${v}»: las dos reglas se separaron`);
  assert.equal(instagramComparable(null), usuarioInstagram(null));
  assert.equal(instagramComparable(undefined), usuarioInstagram(undefined));
});

// ── 2. El comodín ────────────────────────────────────────────────────────────

/** `ilike` de Postgres: `%` y `_` son comodines, `\` escapa al carácter que sigue; sin distinguir mayúsculas. */
function ilike(valor: string, patron: string): boolean {
  const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let re = '';
  for (let i = 0; i < patron.length; i++) {
    const c = patron[i];
    if (c === '\\' && i + 1 < patron.length) { re += esc(patron[++i]); continue; }
    re += c === '%' ? '.*' : c === '_' ? '.' : esc(c);
  }
  return new RegExp(`^${re}$`, 'is').test(valor);
}

test('el guion bajo de un usuario NO es comodín: ana_lopez no trae a anaxlopez', () => {
  const patron = patronDeInstagram('ana_lopez');
  assert.equal(patron, '%ana\\_lopez%', 'el `_` va escapado');
  for (const otro of ['anaxlopez', 'ana.lopez', 'anaalopez', 'ana-lopez']) {
    assert.equal(ilike(otro, patron), false, `«${otro}» entró por el comodín`);
  }
  // Y la trampa es real: sin escapar, el mismo patrón sí los trae.
  assert.equal(ilike('anaxlopez', '%ana_lopez%'), true, 'el `_` crudo es un comodín: por eso se escapa');
  // `%` y `\` no son letras de un usuario, pero el patrón no puede depender de que el llamador los haya filtrado.
  assert.equal(patronDeInstagram('a%b'), '%a\\%b%');
  assert.equal(patronDeInstagram('a\\b'), '%a\\\\b%');
});

test('el prefiltro no deja afuera a ninguno de los que SON el mismo usuario', () => {
  // Es un superconjunto por substring: lo guardado puede venir en varias formas. Lo que trae de más lo descarta la
  // comparación exacta; lo que NO puede es dejar afuera a uno real.
  const guardados = [
    'ana_lopez', '@Ana_Lopez', 'ANA_LOPEZ', 'https://instagram.com/ana_lopez/', 'https://www.instagram.com/Ana_Lopez/?igsh=abc',
    'instagram.com/ana_lopez', 'anaxlopez', 'ana.lopez', 'ana_lopez2', 'mana_lopez', 'otra_persona', 'https://instagram.com/p/ana_lopez/',
  ];
  const queSon = (xs: string[]) => xs.filter((g) => instagramComparable(g) === 'ana_lopez');
  const traidos = guardados.filter((g) => ilike(g, patronDeInstagram('ana_lopez')));
  assert.deepEqual(queSon(traidos), queSon(guardados), 'el patrón dejó afuera a un duplicado real');
  assert.deepEqual(queSon(guardados), ['ana_lopez', '@Ana_Lopez', 'ANA_LOPEZ', 'https://instagram.com/ana_lopez/',
    'https://www.instagram.com/Ana_Lopez/?igsh=abc', 'instagram.com/ana_lopez']);
  // Con punto y guion bajo juntos.
  assert.ok(ilike('https://instagram.com/a.b_c/', patronDeInstagram('a.b_c')));
  assert.ok(!ilike('axb_c', patronDeInstagram('a.b_c')), 'el punto tampoco es comodín');
});

// ── 3. La comparación ────────────────────────────────────────────────────────

test('encuentra por el @ en las tres formas, de los dos lados', () => {
  // El candidato escrito de cualquier forma contra lo guardado normalizado…
  const base = [L(1, 'Ana López', null, null, 'ana_lopez'), L(2, 'Otro', null, null, 'otro_usuario')];
  for (const v of ['@Ana_Lopez', 'ana_lopez', 'https://instagram.com/ana_lopez/', 'https://www.instagram.com/Ana_Lopez/?igsh=1']) {
    const r = buscarDuplicados({ instagram: v }, base);
    assert.equal(r.length, 1, `«${v}» no encontró a Ana`);
    assert.equal(r[0].motivo, 'instagram');
    assert.equal(r[0].lead.id, 1);
  }
  // …y el candidato normalizado contra lo guardado como haya entrado.
  for (const guardado of ['@Ana_Lopez', 'ANA_LOPEZ', 'https://instagram.com/ana_lopez/', 'instagram.com/ana_lopez?hl=es']) {
    const r = buscarDuplicados({ instagram: 'ana_lopez' }, [L(7, 'Ana', null, null, guardado)]);
    assert.equal(r.length, 1, `lo guardado como «${guardado}» no se reconoció`);
  }
});

test('ana_lopez NO es duplicado de anaxlopez, ni de ana.lopez, ni de ana_lopez2', () => {
  const otros = [L(1, 'X', null, null, 'anaxlopez'), L(2, 'Y', null, null, 'ana.lopez'), L(3, 'Z', null, null, 'ana_lopez2'), L(4, 'W', null, null, 'mana_lopez')];
  assert.deepEqual(buscarDuplicados({ instagram: 'ana_lopez' }, otros), []);
});

test('el motivo dice «Instagram» sin jerga, con el usuario normalizado', () => {
  const cs = buscarDuplicados({ instagram: 'https://www.instagram.com/Ana_Lopez/?igsh=1' }, [L(5, 'Ana López', null, null, '@ANA_LOPEZ')]);
  assert.equal(cs[0].texto, 'mismo Instagram (@ana_lopez)');
  assert.equal(textoDuplicado(cs), 'Ya tienes a «Ana López» con el Instagram (@ana_lopez).');
  assert.match(new LeadDuplicadoError(cs).message, /Instagram \(@ana_lopez\)/, 'el error del alta lleva la misma frase');
  // El aviso de la landing recorta el «mismo » del texto: con el motivo nuevo no se rompe.
  const aviso = datosOptin({ nombre: 'Ana', telefono: null, email: null, respuestas: [], campana: null, funnels: 1, link: 'x', revisar: true, duplicados: cs });
  assert.equal(aviso.optin_coincide, 'Instagram (@ana_lopez)');
});

test('el orden de los motivos es email, teléfono, Instagram, nombre — y el de la lista es el de los motivos', () => {
  // `existentes` va en el orden CONTRARIO a propósito: lo que manda es el motivo, no la posición en la base.
  const ig = L(1, 'Por Instagram', 'otro1@x.com', '1111111111', 'ana_lopez');
  const tel = L(2, 'Por teléfono', 'otro2@x.com', '9981361529', 'otra_cuenta');
  const email = L(3, 'Por email', 'ana@x.com', '2222222222', 'otra_mas');
  const cs = buscarDuplicados({ email: 'ANA@x.com', telefono: '+52 998 136 1529', instagram: '@ana_lopez', nombre: 'Por Nombre' }, [ig, tel, email]);
  assert.deepEqual(cs.map((c) => c.motivo), ['email', 'telefono', 'instagram']);
  assert.deepEqual(cs.map((c) => c.lead.id), [3, 2, 1]);
  assert.match(textoDuplicado(cs), /Por email/, 'el aviso nombra a la más concluyente');
});

test('un lead que coincide por varios datos sale UNA vez, con el más concluyente', () => {
  const uno = L(1, 'Ana', 'ana@x.com', '9981361529', 'ana_lopez');
  const cs = buscarDuplicados({ email: 'ana@x.com', telefono: '9981361529', instagram: 'ana_lopez' }, [uno]);
  assert.equal(cs.length, 1);
  assert.equal(cs[0].motivo, 'email');
  // Sin el email, el siguiente.
  assert.equal(buscarDuplicados({ email: 'otro@x.com', telefono: '9981361529', instagram: 'ana_lopez' }, [uno])[0].motivo, 'telefono');
  assert.equal(buscarDuplicados({ email: 'otro@x.com', telefono: '5550000000', instagram: 'ana_lopez' }, [uno])[0].motivo, 'instagram');
});

test('con email Y @ distintos del existente, sólo marca por lo que COINCIDE', () => {
  const mismoMail = L(1, 'Mismo mail', 'ana@x.com', null, 'otra_cuenta');
  const mismoIg = L(2, 'Mismo @', 'otro@x.com', null, 'ana_lopez');
  const ninguno = L(3, 'Ninguno', 'zzz@x.com', null, 'zzz');
  const cs = buscarDuplicados({ email: 'ana@x.com', instagram: 'ana_lopez' }, [mismoMail, mismoIg, ninguno]);
  assert.deepEqual(cs.map((c) => [c.lead.id, c.motivo]), [[1, 'email'], [2, 'instagram']]);
  // Un @ DISTINTO no impide el aviso por email, y un email distinto no impide el aviso por @.
  assert.equal(buscarDuplicados({ email: 'ana@x.com', instagram: 'sin_relacion' }, [mismoMail]).length, 1);
  assert.equal(buscarDuplicados({ email: 'nadie@x.com', instagram: 'ana_lopez' }, [mismoIg]).length, 1);
});

test('el @ NO apaga el nombre: el existente sin @ (el caso normal) se reconoce por nombre', () => {
  // `leads.instagram` es de la mig 0258 y casi ninguna ficha vieja lo tiene: que el existente NO tenga @ no descarta nada.
  // Copiar la regla del email («si hay un dato fuerte, el nombre sobra») dejó sin aviso al alta «Juan Pérez + @juanp» contra
  // el «Juan Pérez» que ya estaba con email y teléfono, que es lo que SÍ avisaba antes de que existiera el @.
  const sinColumna = L(1, 'Juan Pérez', 'juan@x.com', '9981361529');
  const conNull = L(2, 'Juan Pérez', null, null, null);
  const cs = buscarDuplicados({ nombre: 'Juan Perez', instagram: 'juanp' }, [sinColumna, conNull]);
  assert.deepEqual(cs.map((c) => [c.lead.id, c.motivo]), [[1, 'nombre'], [2, 'nombre']]);
  assert.match(textoDuplicado(cs), /Juan Pérez/);
  // Control: sin @ avisa igual (el comportamiento de antes), y con el @ ya escrito de otra forma también.
  assert.equal(buscarDuplicados({ nombre: 'Juan Perez' }, [sinColumna]).length, 1);
  assert.equal(buscarDuplicados({ nombre: 'Juan Perez', instagram: 'https://instagram.com/juanp/' }, [sinColumna]).length, 1);
  // El costo, a propósito: mismo nombre con OTRO @ también avisa (dos cuentas de una persona, o dos personas). Se avisa y no
  // se bloquea. Si algún día se decide que un @ distinto descarta, es otra regla y se cambia acá, no se aprende por accidente.
  assert.deepEqual(buscarDuplicados({ nombre: 'Ana Lopez', instagram: 'otra_cuenta' }, [L(3, 'Ana López', null, null, 'cuenta_de_ana')]).map((c) => c.motivo), ['nombre']);
  // Lo que salió por el @ no se repite por el nombre: la ficha con el mismo @ y el mismo nombre sale UNA vez, por Instagram.
  const igual = buscarDuplicados({ nombre: 'Ana Lopez', instagram: '@Cuenta_De_Ana' }, [L(4, 'Ana López', null, null, 'cuenta_de_ana')]);
  assert.deepEqual(igual.map((c) => c.motivo), ['instagram']);
  // Y el nombre de otra ficha que NO tiene ese @ se suma a la lista, detrás de la que salió por el @.
  const dos = buscarDuplicados({ nombre: 'Ana Lopez', instagram: 'cuenta_de_ana' }, [L(5, 'Ana López', 'ana@x.com', null), L(6, 'Otra', null, null, 'cuenta_de_ana')]);
  assert.deepEqual(dos.map((c) => [c.lead.id, c.motivo]), [[6, 'instagram'], [5, 'nombre']]);
});

test('con email o teléfono, el nombre sigue sin mirarse — el @ no cambia esa regla', () => {
  // Esos dos datos sí están en casi todas las fichas: si el candidato los trae y no coinciden, el nombre sólo suma falsos positivos.
  const viejo = L(1, 'Juan Pérez', 'juan@x.com', '9981361529');
  assert.deepEqual(buscarDuplicados({ nombre: 'Juan Perez', email: 'otro@x.com', instagram: 'juanp' }, [viejo]), []);
  assert.deepEqual(buscarDuplicados({ nombre: 'Juan Perez', telefono: '5550000000', instagram: 'juanp' }, [viejo]), []);
  assert.deepEqual(buscarDuplicados({ nombre: 'Juan Perez', email: 'otro@x.com' }, [viejo]), []);
  // Un @ que no es un usuario (un nombre, un post) tampoco cambia nada: el nombre cuenta como siempre.
  const existente = L(2, 'Ana López', null, null, 'cuenta_de_ana');
  assert.equal(buscarDuplicados({ nombre: 'Ana Lopez', instagram: 'Ana Lopez' }, [existente]).length, 1);
  assert.equal(buscarDuplicados({ nombre: 'Ana Lopez', instagram: 'https://instagram.com/p/Cabc/' }, [existente]).length, 1);
});

test('un existente sin la columna (no se pidió) no coincide con nada por @', () => {
  // `instagram` ausente es «no sé»: la consulta de email o teléfono no la trae, y eso no puede leerse como «es el mismo».
  assert.deepEqual(buscarDuplicados({ instagram: 'ana_lopez' }, [L(1, 'Ana', 'ana@x.com', null)]), []);
  assert.deepEqual(buscarDuplicados({ instagram: 'ana_lopez' }, [L(1, 'Ana', null, null, null)]), []);
  assert.deepEqual(buscarDuplicados({ instagram: 'ana_lopez' }, [L(1, 'Ana', null, null, '')]), []);
  // Y sin @ en el candidato, lo guardado en el existente no hace nada (el comportamiento de antes).
  assert.deepEqual(buscarDuplicados({ email: 'nadie@x.com' }, [L(1, 'Ana', 'ana@x.com', null, 'ana_lopez')]), []);
});

// ── 4. El server: lo que no se prueba sin base, por su fuente ────────────────

const LEADS = leer('../lib/leads.ts');
const DUP = sinComentarios(cuerpoDe(LEADS, 'export async function duplicadosDeLead('));

test('SERVER: la consulta del @ escapa los comodines', () => {
  assert.match(DUP, /\.ilike\('instagram', patronDeInstagram\(ig\)\)/, 'el `ilike` del @ no pasa por patronDeInstagram');
  assert.ok(!/\.ilike\('instagram', `/.test(DUP), 'el patrón del @ se arma a mano, sin escapar');
});

test('SERVER: la columna instagram se pide SÓLO en la consulta del @, y SÓLO si el candidato trae @', () => {
  const cols = DUP.match(/const cols = '([^']*)';/);
  assert.ok(cols, 'no encontré la lista de columnas base');
  assert.ok(!/instagram/.test(cols[1]), 'la columna base ya pide instagram: una base sin la 0258 rechazaría TODAS las altas');
  // Las consultas de email y teléfono usan la lista base, tal cual.
  assert.equal((DUP.match(/\.select\(cols\)/g) ?? []).length, 2, 'email y teléfono tienen que pedir sólo las columnas base');
  // La del nombre, también.
  assert.match(DUP, /leerTodo<LeadExistente>\(db, 'leads', cols, \{/);
  // Y la columna entra una sola vez, dentro de la rama que sólo corre con @.
  assert.equal((DUP.match(/`\$\{cols\}, instagram`/g) ?? []).length, 1);
  assert.match(DUP, /\big\s*\?\s*leerTodo<LeadExistente>\(db, 'leads', `\$\{cols\}, instagram`/, 'la consulta del @ no está guardada por `ig ?`');
  assert.match(DUP, /const ig = instagramComparable\(cand\.instagram\);/, 'el @ del candidato se normaliza antes de decidir si se consulta');
});

test('SERVER: el @ no apaga la consulta por nombre, y sin ningún dato no se consulta nada', () => {
  assert.match(DUP, /!email && !tel && nombre\s*\?\s*leerTodo/, 'la consulta por nombre corre cuando no hay email ni teléfono');
  // La ficha vieja del mismo nombre no tiene @, así que no sale por la consulta del @: si ésta apagara la del nombre, el alta
  // con @ perdería el aviso que el alta sin @ sí da.
  assert.ok(!/!email && !tel && !ig && nombre/.test(DUP), 'el @ apaga la consulta por nombre: «Juan Pérez + @juanp» ya no ve al «Juan Pérez» sin @');
  assert.match(DUP, /if \(!email && !tel && !ig && !nombre\) return \[\];/);
});

test('SERVER: si falla la consulta del @, el resto sigue comparando — y queda dicho', () => {
  const rama = entre(DUP, "`${cols}, instagram`", '        : { data: [] },');
  assert.match(rama, /\.catch\(\(e: unknown\) => \{[\s\S]*?console\.error\([\s\S]*?return \{ data: \[\] as LeadExistente\[\] \};/,
    'sin este `catch` una columna caída tira el Promise.all entero y se pierde también el chequeo por email y teléfono');
  // email y teléfono devuelven `error` sin tirar: no se leen como «no hay nadie» en silencio.
  assert.match(DUP, /for \(const \[que, r\] of \[\['email', porEmail\], \['teléfono', porTel\]\] as const\)/);
  assert.match(DUP, /if \(msg\) console\.error\(/);
  // El contrato de siempre: una consulta caída no bloquea el alta.
  assert.match(DUP, /catch \(e\) \{[\s\S]{0,400}return \[\]/);
  // Con @ y sin email ni teléfono corren la del @ Y la del nombre juntas: si la del nombre tira, no se lleva lo que el @ ya trajo.
  const ramaNombre = entre(DUP, '!email && !tel && nombre', '    ]);');
  assert.match(ramaNombre, /\.catch\(\(e: unknown\) => \{[\s\S]*?console\.error\([\s\S]*?return \{ data: \[\] as LeadExistente\[\] \};/,
    'sin este `catch` una consulta por nombre caída tira el Promise.all y se pierde también lo que encontró el @');
});

test('SERVER: las filas de un mismo lead se FUNDEN (el @ viene sólo en la fila de su consulta)', () => {
  assert.match(DUP, /unicos\.set\(l\.id, \{ \.\.\.unicos\.get\(l\.id\), \.\.\.l \}\)/,
    'con `set(l.id, l)` a secas, el lead que salió también por teléfono perdía su columna instagram');
  assert.match(DUP, /\.\.\.\(porIg\.data \?\? \[\]\)/, 'las filas del @ no entran a la comparación');
});

test('SERVER: createLead le pasa a duplicadosDeLead el input ENTERO, así que el @ viaja solo', () => {
  const crear = cuerpoDe(LEADS, 'export async function createLead(');
  assert.match(crear, /const dup = await duplicadosDeLead\(input\);/);
  // …y el alta manual le pasa el @ ya normalizado (lo fija también tests/contacto-instagram.test.ts).
  const alta = entre(leer('../app/crm/actions.ts'), 'async function altaDeLead(', 'export type ChoqueDeLead');
  assert.match(alta, /instagram: igDelAlta,/);
});

// ── 5. Los llamadores y los consumidores del motivo ──────────────────────────

test('API de MaKo: los DOS llamadores de duplicadosDeLead pasan el @', () => {
  const run = leer('../lib/api-mako/areas/crm.run.ts');
  const buscar = entre(run, '  duplicados_lead: {', '  propuestas_lead_pendientes: {');
  assert.match(buscar, /instagram: usuarioInstagram\(s\(input\.instagram\)\)/, 'duplicados_lead no lee el @');
  assert.match(buscar, /!cand\.instagram\) return fallo\(/, 'con sólo el @ la búsqueda se rechaza por «falta un dato»');
  const editar = entre(run, '  editar_contacto_lead: {', '  agregar_link_fathom: {');
  assert.match(editar, /payload\.instagram !== undefined\) \{/, 'cambiar el @ de un lead no comprueba si otro ya lo tiene');
  assert.match(editar, /instagram: \(payload\.instagram as string \| undefined\) \?\? null/);
});

const CONSUMIDORES = [
  'app/crm/actions.ts', 'app/crm/new/NewLeadForm.tsx', 'app/whatsapp/EmpresaInbox.tsx', 'app/crm/lead-view/ficha/resumen/bloques-actions.ts',
  'app/api/track/optin/route.ts', 'lib/optin-aviso.ts', 'lib/api-mako/areas/crm.run.ts', 'lib/api-mako/areas/chats.run.ts',
  'app/crm/grupo-wa-server.ts', 'app/admin/cobros/actions.ts', 'lib/compra-plan.ts', 'lib/editor-landing/pago-landing-server.ts', 'app/customer-success/actions.ts',
];

test('ningún consumidor de una Coincidencia ramifica por el LITERAL del motivo', () => {
  // Un `if (c.motivo === 'telefono') … else …` mandaba el motivo nuevo al `else` (que dice «nombre», «teléfono» o lo que
  // sea). Hoy todos usan `texto`, que lo escribe `buscarDuplicados`: así un motivo nuevo no necesita tocar a nadie.
  for (const f of CONSUMIDORES) {
    const src = sinComentarios(leer(`../${f}`));
    assert.ok(!/\bmotivo\s*(===|!==|==|!=)\s*'(email|telefono|instagram|nombre)'/.test(src), `${f} ramifica por el literal del motivo`);
    assert.ok(!/switch\s*\([^)]*\bmotivo\b/.test(src), `${f} hace un switch sobre el motivo`);
  }
  // El choque del alta lleva el TEXTO (un string), no la unión: la pantalla no puede quedar con un tipo que no conoce el motivo.
  const choque = cuerpoDe(sinComentarios(leer('../app/crm/actions.ts')), 'async function choqueDeLead(');
  assert.match(choque, /motivo: c\.texto,/);
  assert.match(sinComentarios(leer('../app/crm/lead-view/ficha/resumen/bloques-actions.ts')), /porque: c\.texto/);
});

test('nadie repite la unión de motivos a mano: se importa MotivoDuplicado', () => {
  // ⚠️ ESTE TEST ES LA ÚNICA RED: tsx borra los tipos, así que una unión copiada que ya no alcanza (la de
  // `duplicados[].motivo` de app/customer-success/actions.ts, a la que se le asigna `c.motivo`) pasa el test y rompe `tsc` y
  // `next build`. Por eso NO hay lista de excepciones: si falla acá, el arreglo es de una línea en ese archivo
  // (`motivo: MotivoDuplicado`, con `type MotivoDuplicado` importado de '@/lib/leads-duplicados').
  const copia = /'email'\s*\|\s*'telefono'\s*\|\s*'nombre'|'nombre'\s*\|\s*'telefono'\s*\|\s*'email'/;
  for (const f of CONSUMIDORES) {
    assert.ok(!copia.test(sinComentarios(leer(`../${f}`))),
      `${f} copia la unión de motivos: con 'instagram' deja de compilar (TS2322). Importa «type MotivoDuplicado» de '@/lib/leads-duplicados' en vez de repetirla`);
  }
  // La unión en sí: el orden del tipo es el de concluyencia (el que usa `buscarDuplicados`).
  assert.match(leer('../lib/leads-duplicados.ts'), /export type MotivoDuplicado = 'email' \| 'telefono' \| 'instagram' \| 'nombre';/);
});
