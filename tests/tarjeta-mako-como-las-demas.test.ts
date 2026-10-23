// =============================================================================
// La tarjeta «MaKo en WhatsApp» con el diseño de las demás: sin desplegables arriba del mensaje (23/10/2026)
// =============================================================================
// Martín, sobre /automations?sec=289 en producción: «Te había pedido que no rompas el diseño de las tarjetas, mirá esos 3
// botones... Completamente roto y no se entiende la tarjeta de MaKo en WhatsApp... Por qué agregar email si para eso ya
// tenemos una tarjeta de EMAIL». Los tres desplegables («Por dónde», «Sin grupo de MaKo», «Fuera del horario») los metieron
// 12ac3cb85 (16/10), e94f798a3 (17/10) y c46ee888f (15/10). Regla: una tarjeta no gana controles; lo que haga falta va por
// CONDITION, DELAY, Configuraciones o el ⓘ, y cada canal es SU tarjeta.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lienzo = readFileSync(new URL('../app/automations/FlujoLienzo.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const tramo = (desde: string) => {
  const i = lienzo.indexOf(desde);
  assert.ok(i >= 0, `no encontré ${desde}`);
  return lienzo.slice(i, lienzo.indexOf('\n}\n', i));
};

test('el editor de la tarjeta MaKo no tiene desplegables: el mensaje y nada más (salvo el asunto de la que ya va por email)', () => {
  const editor = tramo('function EditorMako(');
  assert.doesNotMatch(editor, /<Dropdown\b/, 'volvió un desplegable a la tarjeta de MaKo');
  assert.doesNotMatch(editor, /<EnvioDeMako\b|campoFuera/);
  assert.match(editor, /\{porEmail && <AsuntoDeMako params=\{paramsAhora\} busy=\{busy\} onCambio=\{cambiarEnvio\} \/>\}/);
  // El asunto es un campo, no un desplegable, y no ofrece cambiar de canal.
  const asunto = tramo('function AsuntoDeMako(');
  assert.doesNotMatch(asunto, /<Dropdown\b|canal:/);
});

test('la tarjeta de MaKo no ofrece email: ni «Por dónde», ni «Sin grupo de MaKo», ni el aviso de destinatarios', () => {
  for (const rx of [/data-canal-mako/, /data-sin-grupo-mako/, /data-fuera-de-horario/, /CANALES_MAKO|ROTULO_CANAL_MAKO|SINES_GRUPO|ROTULO_SIN_GRUPO/, /useSinDestinatariosEmail/]) {
    assert.doesNotMatch(lienzo, rx, `volvió ${rx}`);
  }
});
