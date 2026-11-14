// =============================================================================
// El aviso de una automatización sobre un lead le llega a SU setter, no sólo al grupo (14/11/2026)
// =============================================================================
// La llamada de Martín con Julio (13/11, min 01:27): «te avisa al celular o la app del setter y por WhatsApp». No era así:
// el aviso le llegaba a todo el grupo del negocio o a nadie. `lead.setter` es un nombre suelto; ahora se resuelve a UNA
// persona del negocio (lib/aviso-al-setter-reglas.ts) y se le manda un push a su teléfono y un WhatsApp por la puerta de
// MaKo (lib/mako-salida.ts), en el aviso de la tarjeta desde un flujo («Sólo te avisa», «Otra cosa») y en el hand-off.
//
// Correr: node --import tsx --test tests/aviso-al-setter.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jidDelTelefono, nombreComparable, setterDelNegocio } from '../lib/aviso-al-setter-reglas';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_aviso-al-setter-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  return corrida;
}
const sinComentarios = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('⛔ el aviso de una automatización sobre un lead le suena a SU setter, y a nadie más por esto', () => {
  assert.deepEqual(R().flujoSono, ['juan'], 'desde un flujo: el push le llega a Juan, el setter de Ana');
  assert.deepEqual(R().apagadoSono, ['juan'], 'ni al Juan Pérez de otro negocio');
  assert.deepEqual(R().chatSono, [], 'pedido desde el chat no es una automatización: va al grupo como siempre');
  const p = R().apagadoPush;
  assert.equal(p.titulo, 'Ana Gómez: te toca a ti');
  assert.match(p.url, /\/crm\/501$/, 'abre la ficha del lead');
  assert.equal(p.tag, 'grupo:13', 'con el tag del grupo: si le sonó el del grupo, éste lo reemplaza en vez de apilarse');
});

test('el WhatsApp sale SÓLO por la puerta de MaKo, a su número personal, y dice por qué cuando no', () => {
  assert.deepEqual(R().apagado.whatsapp, { ok: false, error: 'el bot está apagado' });
  assert.deepEqual(R().apagadoSalio, [], 'con el bot apagado no sale nada por WhatsApp');
  assert.deepEqual(R().prendidoSalio, ['5491155550001@s.whatsapp.net'], 'el teléfono de su perfil, en el formato de WhatsApp');
  assert.match(R().prendidoTexto, /^🔔 \*Ana Gómez\* te necesita\.\n\nAna preguntó por el precio[\s\S]*Su ficha: https:\/\/hola-mako\.com\/crm\/501\?ws=13/);
  const src = sinComentarios('lib/aviso-al-setter.ts');
  assert.match(src, /import\('\.\/mako-salida'\)/);
  assert.doesNotMatch(src, /evolution|sendText|enviarTexto/i, 'nada le escribe a una persona por fuera de lib/mako-salida.ts');
});

test('con el freno de «Contéstale tú», el segundo mensaje del mismo lead no le vuelve a sonar', () => {
  assert.equal(R().frenoPrimero.push.enviados, 1);
  assert.deepEqual(R().frenoSegundo, { setter: { id: 701, nombre: 'Juan Pérez' }, push: null, whatsapp: null, frenado: true });
  assert.deepEqual(R().frenoSono, ['juan'], 'una vez, no dos');
});

test('sin adivinar: con dos que se llaman igual, o con MaKo de setter, no le avisa a nadie', () => {
  assert.deepEqual(R().repetido, { setter: null, push: null, whatsapp: null });
  assert.deepEqual(R().mako, { setter: null, push: null, whatsapp: null });
  assert.deepEqual(R().nadieSono, []);
  assert.equal(nombreComparable('  Juán   PÉREZ '), 'juan perez');
  const gente = [{ id: 1, nombre: 'Juan Pérez', estado: 'suspendido' }, { id: 2, nombre: 'Juan Perez' }];
  assert.equal(setterDelNegocio('juan perez', gente)?.id, 2, 'un suspendido no cuenta');
  assert.equal(setterDelNegocio('', gente), null);
  assert.equal(jidDelTelefono('+54 9 11 5555-0001'), '5491155550001@s.whatsapp.net');
  assert.equal(jidDelTelefono('123'), null);
});

test('los tres hand-off del motor también le avisan: «Otra cosa» sin tarjeta, «Contéstale tú» y el clásico', () => {
  const n = sinComentarios('lib/nutricion.ts');
  /** El tramo de `src` desde `desde` hasta el siguiente `hasta`. */
  const tramo = (src: string, desde: string, hasta: string) => {
    const i = src.indexOf(desde);
    assert.ok(i >= 0, `no encuentro «${desde}»`);
    return src.slice(i, src.indexOf(hasta, i));
  };
  // El de respaldo del AI Step: sólo cuando la charla pasó a una persona (con la tarjeta de avisar, ya avisó ésa).
  assert.ok(n.includes('if (charlaPasaAUnaPersona({ contesto, siguio, noPudoDecidir })) {\n    aUnaPersona = true;'));
  assert.ok(tramo(n, 'if (!redacto && !avisoDelFlujo) {', 'return true;').includes('if (aUnaPersona && wsAviso != null) {\n      const { avisarAlSetterDelLead }'));
  // «Contéstale tú» de la charla cerrada: con SU freno de 12 h por lead, ANTES del aviso al grupo (el aviso es lo último y la
  // charla devuelve `false`: tests/instagram-primer-dm.test.ts).
  const charla = tramo(n, 'async function seguirCharla(', '\n}\n');
  const iSetter = charla.indexOf('{ freno: { clave: `lead:${leadId}:charla-cerrada`, minutos: 60 * 12 } });');
  assert.ok(iSetter > 0 && iSetter < charla.indexOf("await emitirDelCatalogo('wa-mensaje-entrante'"), 'el aviso al setter de «Contéstale tú», antes del aviso al grupo');
  // El clásico (chat-agent-handoff): después del aviso al grupo.
  const h = sinComentarios('lib/chat-agent-handoff.ts');
  assert.ok(tramo(h, "await emitirDelCatalogo('wa-mensaje-entrante'", '/* el aviso es best-effort').includes('await avisarAlSetterDelLead(ws, input.leadId,'));
});
