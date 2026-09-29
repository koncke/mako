// =============================================================================
// El email de MaKo: que se vea como un email, y que salga por donde se eligió
// =============================================================================
// Dos cosas que se pidieron juntas el 29/09/2026 y que comparten las trampas:
//
//   · «Los templates de email deben estar formateados como si fuera un email
//     producido, como los que te envían de marketing tipo HTML.»
//   · «Solo hay 1 template, crea más.»
//
// La segunda no se resolvía sumando filas: había UNA porque el único camino de
// email eran los tres reportes y el cliente sólo ve uno. Ahora cada aviso elige
// su canal (`canales` de su plantilla), así que los seis pueden salir por mail —
// y eso trae el riesgo de mandar correo que nadie pidió. De ahí la mitad de este
// archivo.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderEmailHtml, marcasAHtml, escapeHtml } from '../lib/email-html';
import { canalesDeMensaje, claveDeReporte } from '../lib/mensaje-canales';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

/**
 * El fuente sin sus comentarios. Los de LINEA van primero: un bloque puede
 * abrirse adentro de un comentario de linea y tragarse cincuenta lineas de codigo
 * de verdad, que es como un guard de esta casa dio verde sobre algo que nunca miro.
 */
function sinComentarios(src: string): string {
  return src.replace(/^[ 	]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

// ── El render, que ahora vive fuera de `server-only` ─────────────────────────

test('El render del email no importa NADA del repo, ni transitivamente', () => {
  // Lo importa un componente `use client` (app/perfil/BandejaEmail.tsx) para
  // previsualizar el correo. `tests/frontera-use-client.test.ts` sólo mira imports
  // DIRECTOS, así que un import transitivo de algo con `server-only` no lo cazaría
  // nadie: el modo de falla es el build entero, con un error que nombra otra ruta.
  //
  // Probado rompiéndolo: agregando `import { getSetting } from './settings';` a
  // lib/email-html.ts -> 1 falla / 9 pasan.
  const src = leer('../lib/email-html.ts');
  const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(imports, [], `lib/email-html.ts importó ${imports.join(', ')}: tiene que quedarse sin dependencias del repo`);
});

test('Las marcas de WhatsApp se convierten DESPUÉS de escapar, no antes', () => {
  // Al revés, `escapeHtml` convierte los `<strong>` recién puestos en `&lt;strong&gt;`
  // y el lector ve las etiquetas como texto. Es el orden que ya tenía `linkify`.
  const html = renderEmailHtml({ subject: 'x', bodyText: '*Ads:* $640 y un <script> ajeno' });
  assert.ok(html.includes('<strong>Ads:</strong>'), 'la negrita de WhatsApp no llegó como <strong>');
  assert.ok(!html.includes('&lt;strong&gt;'), 'el <strong> salió escapado: marcasAHtml corre ANTES de escapeHtml');
  assert.ok(html.includes('&lt;script&gt;'), 'dejó de escapar el HTML que viene en el cuerpo');
});

test('El cuerpo que MaKo borraba ahora se ve: *negrita* no se tira', () => {
  // `lib/notify.ts` pasaba el cuerpo por un `sinMarcas()` de tres líneas, así que el
  // MISMO reporte salía con énfasis por WhatsApp y plano por email. No lo decidió
  // nadie: lo decidió una función privada para que no se vieran los asteriscos.
  const src = leer('../lib/notify.ts');
  assert.ok(!/function sinMarcas/.test(src), 'volvió `sinMarcas`: el email pierde el énfasis que WhatsApp sí tiene');
  assert.ok(/marca: 'mako'/.test(src), 'el reporte dejó de declarar la banda de marca');
});

test('Un correo de la PLATAFORMA se firma en el código, nunca con el remitente del workspace', () => {
  // Sin `from`, `sendEmail` resuelve el `resend_from` DEL WORKSPACE, y un cliente sin
  // dominio conectado —casi todos— cae en el remitente sandbox de Resend, que entrega
  // sólo al dueño de la cuenta: el reporte no llega y nada lo dice. Es la regla de
  // `OWNER_WS` no es la plataforma, aplicada al canal de email.
  for (const ruta of ['../lib/notify.ts', '../lib/avisos.ts']) {
    const src = leer(ruta);
    assert.ok(/from: REMITENTE_MAKO/.test(src), `${ruta} manda sin \`from\`: el mail sale con el remitente del inquilino`);
  }
});

test('El aviso por email NO pasa por el flag de nutrición', () => {
  // `envioEmailHabilitado` gobierna los broadcasts y la nutrición —lo que el cliente
  // le manda a SUS leads— y es fail-closed para todo workspace sin la setting. Usarlo
  // acá sería un SEGUNDO interruptor para un hecho que ya tiene el suyo: el cliente
  // prende el email del aviso, no pasa nada, y no hay forma de saber por qué.
  // ⚠️ SIN LOS COMENTARIOS. El archivo NOMBRA `envioEmailHabilitado` justo en el
  // párrafo que explica por qué no se usa, así que un grep crudo hace que el guard se
  // acuse a sí mismo — el mismo tropiezo que ya está escrito en AGENTS.md para el
  // guard de `/funnel`. Se midió: con el `src` crudo, 1 falla / 9 pasan.
  const src = sinComentarios(leer('../lib/avisos.ts'));
  assert.ok(!/envioEmailHabilitado/.test(src), 'el aviso por email quedó detrás del flag de nutrición: son dos interruptores para un hecho');
  assert.ok(/getDestinatariosDe\(wsCorreo\)/.test(src), 'el destinatario dejó de resolverse por workspace explícito');
});

// ── El canal por mensaje ─────────────────────────────────────────────────────

test('El email arranca APAGADO y WhatsApp prendido', () => {
  // Prender el email tiene consecuencias que el interruptor de WhatsApp no tiene:
  // cuesta plata, se le escribe a direcciones que quizá nadie revisó, y un correo no
  // deseado quema la reputación del dominio para TODOS los mails del producto.
  assert.deepEqual(canalesDeMensaje('cuota-vencida', null, null), { wa: true, email: false });
  assert.deepEqual(canalesDeMensaje('cuota-vencida', { canales: { wa: false, email: true } }, null), { wa: false, email: true });
});

test('El canal de un REPORTE sale de sus prefs, no de su plantilla', () => {
  // Son dos tiendas y no es un descuido: los crons de reporte leen `notification_prefs`
  // desde antes de que existiera el store de plantillas. Lo que no puede pasar es que
  // cada pantalla decida por su cuenta de dónde leer — ahí nacen los dos interruptores
  // que dicen cosas distintas sobre el mismo mensaje.
  assert.equal(claveDeReporte('reporte-semanal'), 'semanal');
  assert.equal(claveDeReporte('cuota-vencida'), null);

  const prefs = { semanal: { wa: false, email: true } };
  const plantilla = { canales: { wa: true, email: false } };   // el default, que NO manda acá
  assert.deepEqual(canalesDeMensaje('reporte-semanal', plantilla, prefs), { wa: false, email: true });

  // Y si las prefs no se pudieron leer, NO se inventa un «sí» sobre un canal que no se midió.
  assert.deepEqual(canalesDeMensaje('reporte-semanal', plantilla, null), { wa: true, email: false });
});

test('El interruptor y el canal son DOS preguntas, y apagar los dos canales apaga', () => {
  // Estaban fundidas en un booleano, y por eso «éste sí, pero sólo por mail» no
  // existía: el único camino era apagar el aviso entero.
  //
  // Probado rompiéndolo: volviendo el gate a `if (!canal.activo)` -> 1 falla / 9 pasan.
  const src = leer('../lib/avisos.ts');
  assert.ok(
    /if \(!canal\.activo \|\| \(!canal\.wa && !canal\.email\)\)/.test(src),
    'el gate del choke point volvió a mirar un solo valor: «sólo por email» deja de existir',
  );
  assert.ok(/const email = canal\.email \? await enviarAvisoPorEmail/.test(src), 'el envío por email dejó de colgar del canal elegido');
});

test('El workspace se resuelve ANTES de leer la plantilla', () => {
  // `emitirDelCatalogo` leía `plantillaActiva(id)` en el contexto AMBIENTE, antes de
  // resolver `opts.ws`: un cron que pasa el workspace explícito sin estar adentro de un
  // `runWithWorkspace` —así llaman los que iteran inquilinos— consultaba el interruptor
  // del DUEÑO ahí y el del CLIENTE ocho líneas más abajo. O sea que un aviso que el
  // dueño tenía apagado moría para todos sus clientes.
  const src = leer('../lib/avisos.ts');
  const iWs = src.indexOf('const ws = opts.ws ?? (await getWorkspaceActual()) ?? OWNER_WS;');
  const iPlantilla = src.indexOf('plantillaActiva(id)');
  assert.ok(iWs > 0 && iPlantilla > 0, 'no se ubicaron las dos marcas en emitirDelCatalogo');
  assert.ok(iWs < iPlantilla, 'la plantilla se vuelve a leer en el contexto ambiente: lee el store del dueño');
  assert.ok(
    /runWithWorkspace\(ws, \(\) => plantillaActiva\(id\)\)/.test(src),
    'la lectura de la plantilla perdió su runWithWorkspace',
  );
});

test('El escape sigue siendo el de siempre', () => {
  assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  // Un asterisco suelto (una viñeta) no se come medio párrafo hasta el siguiente.
  assert.equal(marcasAHtml('* uno\n* dos'), '* uno\n* dos');
});
