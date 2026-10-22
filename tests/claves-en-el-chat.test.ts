// =============================================================================
// Nunca una key en el chat (pieza 1.6 de docs/ops-center-principal.md, 20/10/2026)
// =============================================================================
// Una clave pegada en el chat llegaba al modelo y quedaba guardada en `chart_chats`. Lo que fija este archivo:
//   1. QUÉ SE TAPA: las claves de los proveedores (y la línea de un .env), con el servicio de /integraciones al que
//      pertenecen; NO un email, un teléfono ni un monto, que en el chat del negocio son su trabajo;
//   2. EL TURNO la tapa ANTES de todo: lo que se guarda, el título, El Archivero y el modelo leen el texto tapado, y el
//      crudo no se vuelve a leer;
//   3. LA RESPUESTA dice que la tapó y trae el botón «Conectar» de ese servicio;
//   4. LA BURBUJA de la persona (que se dibuja optimista, con la clave) pasa a decir lo guardado, tapado, cuando vuelve el
//      turno —en los cuatro chats—, y NO se tapa de más: lo que una regla laxa se come el negocio no lo recupera.
//
// PROBADO ROMPIÉNDOLO (21/10/2026, arnés del scratchpad `romper-tapado.mjs`: una rotura por vez, restaurada de memoria y
// comprobada con sha256; base 3 / 0). Cada una dio 2 / 1: el turno guardando el crudo (`recortarMensaje(entrada.mensaje…`)
// · los pegados de El Archivero con el crudo · la respuesta sin el botón · OpenRouter detrás de OpenAI (salía «openai») ·
// las reglas de personas adentro (tapaba el email). Restaurado: 3 / 0.
//
// SEGUNDA RONDA (21/10/2026, tras la revisión adversarial; arnés `romper-claves.mjs`, misma disciplina; base 10 / 0).
// 22 roturas, 22 detectadas: sacar la regla de los tokens de MaKo · sacar la del fine-grained de GitHub · volver a las reglas
// LAXAS de Mercado Pago, de Resend y de .env (3) · Mercado Pago con la forma demasiado estrecha (el hex de 32 de la letra del
// pedido no tapa el ejemplo de los tests del repo) · Resend sólo de dos bloques · Resend sin el dígito o la mayúscula
// obligatorios · .env con «:» y un valor corto · .env sin anclar al principio de la línea (lo caza además la línea gigante) ·
// .env con backtracking cuadrático (se cuelga: lo caza la línea gigante, que corre en un proceso aparte con plazo) · .env con
// «=» exigiendo 16+ (rompe `DB_PASSWORD=hunter2`) · la burbuja: nunca reemplaza, reemplaza sin mirar si el servidor tapó, deja el
// «(envió …)» del archivo, lo limpia aunque lo escribió la persona, pisa lo que la persona escribió · cada uno de los cuatro
// chats sin el reemplazo (4) · un quinto chat que arma el hilo sin él. Restaurado: 10 / 0.
//
// TERCERA RONDA (21/10/2026, otra revisión adversarial: seguía tapando texto del negocio; mismo arnés, base 10 / 0). 26 roturas,
// 26 detectadas. OpenAI (14): la heredada de vuelta (`sk-` + 20 de cualquier cosa se comía el slug de un producto) · la vieja
// sin exigir dígito ni mayúscula (3: ni uno ni otro, sin la mayúscula, sin el dígito) · 20 en vez de 40 · la vieja sacada · sin
// `sk-proj-`, `sk-svcacct-`, `sk-admin-` o `sk-None-` (4) · la nueva sin la mayúscula · la ventana de esa mayúscula sin acotar
// (cuadrática: la caza la línea gigante) · el servicio en null · la regla sacada. Mercado Pago (4): la de antes (prefijo + dígitos
// + laxo) · sin los 32 hex · el hex estrecho (33) · la heredada de agente-redaccion. .env (7): la de antes (el nombre CONTIENE
// KEY/PASS) · sin la exclusión de http(s):// · sin el sufijo numérico · sin los nombres con palabras después de la clave · esas
// palabras también con «:» · la clave sin ser palabra entera · el nombre sin acotar a 80 (cuadrática). Y el archivo de antes de
// esta ronda entero. Restaurado: 10 / 0.
// (La 2.ª ronda dejó Mercado Pago laxo porque el fixture de tests/mercadopago-api.test.ts trae 12 hex. Ese fixture no es de este
// archivo: acá se usa uno con la forma real, y el de allá no se toca.)
//
// Correr: npx tsx --test tests/claves-en-el-chat.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CLAVE_TAPADA, avisoClaveTapada, taparClaves } from '../lib/claves-en-el-chat';
import { textoTapadoDeRespuesta } from '../app/m/mako/chat-ui';
import type { RespuestaTurno } from '../lib/mako-turno-app-reglas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Claves de mentira con la forma de las de verdad.
const X = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6';
const CASOS: Array<[string, string, string | null]> = [
  ['anthropic', `mi clave es sk-ant-api03-${X}`, 'anthropic'],
  ['openrouter', `toma sk-or-v1-${X}`, 'openrouter'],
  ['openai', `sk-proj-${X}T3BlbkFJ${X}`, 'openai'],
  ['google', `AIzaSy${X}`, 'gemini'],
  ['groq', `gsk_${X}`, 'groq'],
  ['cerebras', `csk-${X}`, 'cerebras'],
  ['stripe', `sk_live_${X}`, 'stripe'],
  ['resend', `re_${X}`, 'email'],
  ['env con una de Google', `GEMINI_API_KEY=AIzaSy${X}`, 'gemini'],
  ['env sin proveedor', 'MI_SERVICIO_TOKEN=abc123', null],
];

test('se tapa cada clave, con el servicio al que pertenece; lo del negocio (email, teléfono, monto) no', () => {
  for (const [nombre, texto, servicio] of CASOS) {
    const t = taparClaves(texto);
    assert.ok(t.tapadas >= 1, `${nombre}: se tapó`);
    assert.ok(t.texto.includes(CLAVE_TAPADA), `${nombre}: queda «${CLAVE_TAPADA}»`);
    assert.doesNotMatch(t.texto, new RegExp(X), `${nombre}: no queda nada de la clave`);
    assert.equal(t.servicio, servicio, `${nombre}: el servicio del botón`);
  }
  assert.equal(taparClaves('MI_SERVICIO_TOKEN=abc123').texto, `MI_SERVICIO_TOKEN=${CLAVE_TAPADA}`, 'la línea del .env dice qué se pegó');
  // Rota: meter las reglas de personas → este test falla (en el chat del negocio, un email es su trabajo).
  const negocio = 'Escríbele a ana@cliente.com al +54 9 11 2345-6789: el plan sale $1.500 y la reunión es el 12/10.';
  assert.deepEqual(taparClaves(negocio), { texto: negocio, tapadas: 0, servicio: null });
  assert.deepEqual(taparClaves(''), { texto: '', tapadas: 0, servicio: null });
  assert.match(avisoClaveTapada('anthropic'), /Tapé tu clave.*Pégala aquí/);
  assert.equal(avisoClaveTapada(null), 'Tapé tu clave: no quedó en el chat.');
});

// Rellenos con el largo y el alfabeto de lo real (lib/api-mako/tokens.ts, lib/agente-token-nucleo.ts, lib/ia-pc.ts), sin ser nada.
const hex = (n: number) => 'a1b2c3d4e5f60718293a4b5c6d7e8f90'.repeat(4).slice(0, n);
const b64u = (n: number) => 'Ab1-_Cd2Ef3Gh4Ij5Kl6Mn7Op8Qr9St0Uv1Wx2Yz3Ab1-_'.repeat(4).slice(0, n);
const alnum = (n: number) => 'Zy9Xw8Vu7Ts6Rq5Po4Nm3Lk2Ji1Hg0Fe'.repeat(3).slice(0, n);

test('los tokens de MaKo y el fine-grained de GitHub se tapan, en cada forma en que se pegan', () => {
  // [qué es, el texto pegado, la parte que NO puede quedar]
  const TOKENS: Array<[string, string, string]> = [
    ['detallado (mako_pat_, 60 hex)', `mi token es mako_pat_${hex(60)} y no anda`, hex(60)],
    ['principal con alcance (mkoag_e_, 48 hex)', `mkoag_e_${hex(48)}`, hex(48)],
    ['principal viejo, sin la letra', `mkoag_${hex(32)}`, hex(32)],
    ['de la PC, dentro de un JSON', `{"token":"mkopc_${b64u(43)}"}`, b64u(43)],
    ['del turno (mkotn_, 43 base64url)', `mkotn_${b64u(43)}`, b64u(43)],
    ['detrás de «token:»', `token: mkopc_${b64u(43)}`, b64u(43)],
    ['como bearer', `Authorization: Bearer mkopc_${b64u(43)}`, b64u(43)],
    ['fine-grained de GitHub (github_pat_)', `github_pat_11AB${alnum(18)}_${alnum(59)}`, alnum(59)],
  ];
  // Rota: sacar la regla `mako` / `github-fine` de PROPIAS_ANTES → este test falla (daban `tapadas: 0`, la revisión del 21/10).
  for (const [nombre, texto, secreto] of TOKENS) {
    const t = taparClaves(texto);
    assert.equal(t.tapadas, 1, `${nombre}: se tapó una vez`);
    assert.ok(t.texto.includes(CLAVE_TAPADA), `${nombre}: queda «${CLAVE_TAPADA}»`);
    assert.ok(!t.texto.includes(secreto), `${nombre}: no queda nada del token`);
    assert.equal(t.servicio, null, `${nombre}: no tiene botón «Conectar»`);
  }
  // La PISTA (`mkoag_e_…a1b2`, lo que MaKo muestra) y el prefijo suelto no son un secreto: no se tapan.
  const pistas = 'mi token es mkoag_e_…a1b2 y el otro mako_pat_…9f3a; el prefijo es mako_pat_ y el viejo mkoag_';
  assert.deepEqual(taparClaves(pistas), { texto: pistas, tapadas: 0, servicio: null });
});

test('el texto normal del negocio NO se tapa: el crudo no se guarda, y lo que se come no vuelve', () => {
  // Cada una la tapaba una regla laxa de agente-redaccion (la de Mercado Pago, la de Resend, la de .env, la de OpenAI).
  const DEL_NEGOCIO = [
    'Pausa TEST-CBO-lookalike-compradores-1pct-AR y deja la otra',
    'Duplica APP_USR-lookalike-compradores-1pct-argentina-premium en la otra cuenta',
    'Crea la etiqueta re_agendar_despues_de_la_llamada',
    'Usa re_contacto_seguimiento_post_venta_2024 en el flujo',
    're_agendarr_despuesdelallamadaconfirmada',
    'BLACKFRIDAY_PASS: 30% para todos',
    'CODIGO_PASS: BLACK30 hasta el viernes',
    'Promos de hoy:\nBLACKFRIDAY_PASS: 30% para todos\nCYBER_SECRET: 50% solo hoy',
    // OpenAI (la heredada era `sk-` + 20 de cualquier cosa): un link y un producto con slug que empieza por «sk-».
    'mira https://tienda.com/products/sk-ii-facial-treatment-essence-230ml',
    'el producto sk-camiseta-oversize-negra-talle-l',
    'sk-proj-lanzamiento-verano-2026-promociones-especiales-argentina-todo-en-minuscula',
    'sk-camisetaoversizenegratalleldeverano2026edicionlimitadaxl',
    'sk-CamisetaOversizeNegraTalleLDeVeranoEdicionLimitadaXLPremium',
    'Repone el código sk-A1B2C3D4E5F6G7H8I9J0K1L2M3N4 en la bodega',
    // .env: el nombre CONTENÍA «KEY» / «PASS» (la regla vieja) pero no termina en eso; y un link tras «:» no es una clave.
    'KEYWORDS: zapatillas-running-mujer-ofertas',
    'KEYWORDS=zapatillas-running-mujer-ofertas',
    'MAX_TOKENS=4096',
    'BLACKFRIDAY_PASS: https://tienda.com/promo',
    'CYBER_SECRET: http://tienda.com/promo-secreta-de-hoy',
    'PASS_VIERNES: descuento-especial-para-todos-los-clientes',
    'TURKEY_RECIPE=pavo-al-horno-con-papas',
    // Mercado Pago: el prefijo y los dígitos no alcanzan, hacen falta los 32 hex.
    'Pausa TEST-2026102112-lookalike-compradores-AR',
    'Pausa TEST-6472139054868291-040214-lookalike-compradores-AR',
  ];
  // Rota: volver a la regla vieja de Mercado Pago / de Resend / de .env / de OpenAI → este test falla (con el botón equivocado, además).
  for (const texto of DEL_NEGOCIO) {
    assert.deepEqual(taparClaves(texto), { texto, tapadas: 0, servicio: null }, texto);
  }
});

test('las claves de verdad de OpenAI, Mercado Pago, Resend y .env siguen tapándose con la forma exacta', () => {
  // [qué es, el texto, el servicio del botón, lo que NO puede quedar]
  const EXACTAS: Array<[string, string, string | null, string]> = [
    ['Mercado Pago de producción', `mi token: APP_USR-6472139054868291-040214-${hex(32)}-123456789`, 'mercadopago', hex(32)],
    ['Mercado Pago de prueba', `TEST-6472139054868291-040214-${hex(32)}-123456789`, 'mercadopago', hex(32)],
    // Con la FORMA de las de verdad: los 32 hex (el fixture de tests/mercadopago-api.test.ts trae 12 y no la tiene).
    ['Mercado Pago, la forma de los tests del repo con sus 32 hex', `APP_USR-1234567890123456-101112-${hex(32)}-123456`, 'mercadopago', hex(32)],
    ['OpenAI vieja, sk- + 48 alfanuméricos con el T3BlbkFJ', `la mía es sk-${alnum(20)}T3BlbkFJ${alnum(20)} gracias`, 'openai', `T3BlbkFJ${alnum(20)}`],
    ['OpenAI de proyecto, sk-proj-', `sk-proj-${b64u(70)}T3BlbkFJ${b64u(70)}`, 'openai', b64u(70)],
    ['OpenAI de cuenta de servicio, sk-svcacct-', `sk-svcacct-${b64u(70)}T3BlbkFJ${b64u(70)}`, 'openai', b64u(70)],
    ['OpenAI de administración, sk-admin-', `sk-admin-${b64u(70)}T3BlbkFJ${b64u(70)}`, 'openai', b64u(70)],
    ['OpenAI de usuario sin proyecto, sk-None-', `sk-None-${b64u(70)}T3BlbkFJ${b64u(70)}`, 'openai', b64u(70)],
    ['OpenAI en una línea de .env: el botón es el de OpenAI', `OPENAI_API_KEY=sk-proj-${b64u(70)}T3BlbkFJ${b64u(70)}`, 'openai', b64u(70)],
    ['Anthropic larga: sigue ganando sk-ant-, no OpenAI', `sk-ant-api03-${b64u(93)}AA`, 'anthropic', b64u(93)],
    ['OpenRouter larga: sigue ganando sk-or-, no OpenAI', `sk-or-v1-${hex(64)}`, 'openrouter', hex(64)],
    ['.env con sufijo numérico (GEMINI_API_KEY_2)', `GEMINI_API_KEY_2=AIzaSy${X}`, 'gemini', X],
    ['.env con la clave seguida de más palabras (nombre real del .env.local)', `FATHOM_API_KEY_MARTIN=${hex(32)}`, null, hex(32)],
    ['.env con dos puntos, nombre que termina en TOKEN', `SLACK_BOT_TOKEN: ${hex(24)}`, null, hex(24)],
    ['.env con dos puntos y sufijo numérico', `GEMINI_API_KEY_2: ${hex(24)}`, null, hex(24)],
    ['Resend, re_ + 8 + _ + 24', `la key es re_${alnum(8)}_${alnum(24)} gracias`, 'email', alnum(24)],
    ['línea de .env con export y comillas', 'export JWT_SECRET="mi frase larga de verdad"', null, 'frase'],
    ['línea de .env con una contraseña corta', 'DB_PASSWORD=hunter2', null, 'hunter2'],
    ['línea de .env con dos puntos y un valor largo', `API_SECRET: ${hex(24)}`, null, hex(24)],
  ];
  // Rota: la forma exacta demasiado estrecha (el hex de 32 de Mercado Pago, el _ de Resend, un prefijo de OpenAI o el sufijo del
  // nombre en un .env) → falla: la clave se escaparía.
  for (const [nombre, texto, servicio, secreto] of EXACTAS) {
    const t = taparClaves(texto);
    assert.equal(t.tapadas, 1, `${nombre}: se tapó`);
    assert.ok(!t.texto.includes(secreto), `${nombre}: no queda nada de la clave`);
    assert.equal(t.servicio, servicio, `${nombre}: el servicio del botón`);
  }
  // La línea de .env conserva su nombre y su sangría, y sólo cuenta al principio de la línea.
  assert.equal(taparClaves('export JWT_SECRET="mi frase larga de verdad"').texto, `export JWT_SECRET=${CLAVE_TAPADA}`);
  assert.equal(taparClaves(`A=1\nGEMINI_API_KEY=AIzaSy${X}\nOTRA_PASSWORD=zzz\nfin`).texto, `A=1\nGEMINI_API_KEY=${CLAVE_TAPADA}\nOTRA_PASSWORD=${CLAVE_TAPADA}\nfin`);
  assert.equal(taparClaves('Mi línea: STRIPE_SECRET=algo').tapadas, 0, 'en el medio de una frase es prosa, no un .env');
});

test('una línea gigante no cuelga el tapado (las reglas son lineales)', () => {
  // En un proceso aparte y con plazo: una regla con backtracking cuadrático no devuelve un error, SE CUELGA, y un test en el
  // mismo proceso no se enteraría nunca (el regex bloquea el event loop). El mensaje llega entero al tapado, sin tope previo.
  const codigo = `
    const { taparClaves } = await import(${JSON.stringify(pathToFileURL(join(RAIZ, 'lib/claves-en-el-chat.ts')).href)});
    const lineas = [
      'KEY'.repeat(300000), 'A_'.repeat(500000), 're_'.repeat(300000), 'KEY\\n'.repeat(200000), 'mkoag_'.repeat(150000),
      'KEY_'.repeat(250000), ('KEY_'.repeat(19) + 'X' + ':\\n').repeat(12000), 'sk-'.repeat(350000), 'sk-proj-'.repeat(125000),
      'sk-' + 'A1'.repeat(500000), 'TEST-1111111111-'.repeat(60000),
    ];
    for (const t of lineas) {
      const desde = Date.now();
      taparClaves(t);
      if (Date.now() - desde > 2000) process.exit(3);
    }`;
  assert.doesNotThrow(
    () => execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', codigo], { cwd: RAIZ, timeout: 30_000, stdio: 'pipe' }),
    'once líneas de ~1 MB se tapan en menos de 2 s cada una',
  );
});

// ── La burbuja ───────────────────────────────────────────────────────────────

const turno = (content: string, ...mas: RespuestaTurno['mensajes']): Pick<RespuestaTurno, 'mensajes'> =>
  ({ mensajes: [{ role: 'user', content }, ...mas, { role: 'assistant', content: 'Listo.' }] });

test('la burbuja de la persona deja de mostrar la clave cuando vuelve el turno que la tapó', () => {
  const enviado = `mi clave es sk-ant-api03-${X}, conéctala`;
  const guardado = taparClaves(enviado).texto;
  // Lo que hace cada chat al cerrar el turno: marcar(idU, { ..., ...textoTapadoDeRespuesta(r, enviado) }).
  const optimista = { k: 'msg' as const, role: 'user' as const, texto: enviado };
  const burbuja = { ...optimista, ...textoTapadoDeRespuesta(turno(guardado), enviado) };
  // Rota: sacar el reemplazo de la burbuja (devolver siempre `{}`) → este test falla: la clave seguía a la vista hasta recargar.
  assert.equal(burbuja.texto, guardado);
  assert.doesNotMatch(burbuja.texto, new RegExp(X));
  assert.match(burbuja.texto, /\[clave tapada\]/);

  // Con un archivo, el turno antepone el «(envió …)» de la memoria del modelo: en la burbuja no va.
  const conArchivo = `(envió una imagen: plano.jpg) — ${guardado}`;
  assert.deepEqual(textoTapadoDeRespuesta(turno(conArchivo), enviado), { texto: guardado });
  // Tapó la clave y el texto empezaba con ese mismo paréntesis: se deja tal cual (es lo que se guardó).
  assert.deepEqual(textoTapadoDeRespuesta(turno(`(envió una imagen: a.jpg) — ${guardado}`), `(envió una imagen: a.jpg) — sk-ant-api03-${X}`),
    { texto: `(envió una imagen: a.jpg) — ${guardado}` });
});

test('la burbuja sólo cambia cuando el servidor TAPÓ: recortes, pegados y archivos no la tocan', () => {
  // Nada tapado → nada cambia, aunque lo guardado difiera de lo enviado (espacios, el placeholder del archivo, el corte).
  assert.deepEqual(textoTapadoDeRespuesta(turno('hola'), 'hola'), {});
  assert.deepEqual(textoTapadoDeRespuesta(turno('hola'), '  hola  '), {});
  assert.deepEqual(textoTapadoDeRespuesta(turno('(envió un PDF: lista.pdf) — hola'), 'hola'), {});
  assert.deepEqual(textoTapadoDeRespuesta(turno('hola…'), 'hola, esto es mucho más largo'), {});
  assert.deepEqual(textoTapadoDeRespuesta(turno('a\n\n[[texto pegado]]\nb\n[[/texto pegado]]'), 'a\n\n\n[[texto pegado]]\nb\n[[/texto pegado]]'), {});
  // Ella misma escribió «[clave tapada]» (lo copió de un mensaje anterior): lo enviado ya lo trae, no hay nada que mostrar distinto.
  assert.deepEqual(textoTapadoDeRespuesta(turno('mira [clave tapada]'), 'mira [clave tapada]'), {});
  // Un turno que no guardó su mensaje, o una respuesta rara: no tira ni inventa.
  assert.deepEqual(textoTapadoDeRespuesta({ mensajes: [] }, 'hola'), {});
  assert.deepEqual(textoTapadoDeRespuesta({ mensajes: [{ role: 'assistant', content: '[clave tapada]' }] }, 'hola'), {});
  assert.deepEqual(textoTapadoDeRespuesta({} as Pick<RespuestaTurno, 'mensajes'>, 'hola'), {});
});

test('los cuatro chats mezclan lo tapado en el marcar con que cierran el turno (y un quinto no se olvida)', () => {
  const CHATS = [
    'app/second-brain/useChatCliente.ts', 'app/crm/mako-crm/ChatMakoCrm.tsx', 'app/crm/lead-view/MakoAnalystLead.tsx',
  ];
  // Rota: sacar el `...textoTapadoDeRespuesta(` de uno de los chats → este test falla (su burbuja volvería a mostrar la clave).
  for (const f of CHATS) {
    const t = sinComentarios(leer(f));
    assert.match(t, /marcar\(idU, \{ estado: undefined, error: undefined, \.\.\.textoTapadoDeRespuesta\(/, `${f}: la burbuja se reemplaza al volver el turno`);
    assert.match(t, /import \{[^}]*\btextoTapadoDeRespuesta\b[^}]*\} from '[^']*chat-ui'/, `${f}: lo importa de chat-ui`);
  }
  // Cualquier pantalla que arme el hilo con `itemsDeRespuesta(` (un chat nuevo) tiene que hacer lo mismo.
  const usan = execFileSync('git', ['grep', '--untracked', '-l', 'itemsDeRespuesta(', '--', 'app'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((f) => f.trim()).filter((f) => f && f !== 'app/m/mako/chat-ui.ts');
  assert.deepEqual([...usan].sort(), [...CHATS].sort(), 'los chats que usan itemsDeRespuesta son los cuatro de la lista');
});

test('el turno tapa ANTES de guardar, titular, archivar y pensar; el crudo no se vuelve a leer', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  const tapa = t.indexOf("const tapado = taparClaves(entrada.mensaje ?? '');");
  assert.ok(tapa > 0, 'el turno tapa el mensaje');
  // Rota: `recortarMensaje((entrada.mensaje ?? '')…` de vuelta → este test falla (se guardaría el crudo).
  assert.match(t, /const mensaje = tapado\.texto;\s*const textoPersona = recortarMensaje\(mensaje\.trim\(\), TOPE_MENSAJE\);/);
  assert.equal((t.match(/entrada\.mensaje/g) ?? []).length, 1, 'el crudo se lee UNA vez: para taparlo');
  assert.ok(tapa < t.indexOf("appendMessage(s.id, 'user'"), 'se tapa antes de guardar');
  assert.match(t, /partirPegados\(mensaje\)/, 'El Archivero recibe lo tapado');
});

test('la respuesta dice que la tapó, con el botón «Conectar» de su servicio', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  // Rota: sin el `conectar` de la clave → este test falla.
  assert.match(t, /if \(tapado\.tapadas\) \{\s*aviso = \[avisoClaveTapada\(tapado\.servicio\), aviso\]\.filter\(Boolean\)\.join\(' '\);\s*conectar = conectar \?\? tapado\.servicio;\s*\}/);
  assert.match(t, /pantallas, conectar \}/);
});
