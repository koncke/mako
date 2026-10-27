// =============================================================================
// Zernio cobra desde la tercera cuenta: MaKo avisa ANTES de abrir el login (27/10/2026)
// =============================================================================
// Feedback de Leila (876470842-23): Zernio le cobró US$16 y MaKo sólo lo decía en una línea fija de la tarjeta. Zernio cobra por
// cuenta ACTIVA de toda su cuenta (las 2 primeras gratis; de la 3.ª a la 10.ª, US$6 por mes, prorrateado por día), y la página, el
// Instagram y los anuncios cuentan aparte. Ahora el servidor cuenta antes de pedir el link y, si la que viene se paga, la pantalla
// pregunta; «Conectar igual» vuelve a pedirlo con el permiso.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avisoDeCobroZernio, textoAvisoCobro, CUENTAS_GRATIS_ZERNIO, MENSAJES_DE_MOTIVO, type ConexionZernio } from '../lib/zernio-redes';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const cuenta = (plataforma: string, activa = true): ConexionZernio => ({ accountId: `id_${plataforma}`, plataforma, usuario: plataforma, nombre: plataforma, activa, vencida: false });

test('se avisa cuando ya hay 2 cuentas activas y la red que viene es nueva', () => {
  assert.equal(CUENTAS_GRATIS_ZERNIO, 2);
  assert.deepEqual(avisoDeCobroZernio({ conectadas: [cuenta('facebook'), cuenta('instagram')], red: 'metaads' }), { cuentas: 2 });
  assert.deepEqual(avisoDeCobroZernio({ conectadas: [cuenta('facebook'), cuenta('instagram'), cuenta('metaads')], red: 'youtube' }), { cuentas: 3 });
  // Con 1, la que viene es la 2.ª: gratis.
  assert.equal(avisoDeCobroZernio({ conectadas: [cuenta('facebook')], red: 'instagram' }), null);
  // Las inactivas (ocultas o desconectadas) no cuentan para Zernio.
  assert.equal(avisoDeCobroZernio({ conectadas: [cuenta('facebook'), cuenta('instagram', false)], red: 'metaads' }), null);
  // Volver a entrar con la misma red no suma otra cuenta (Zernio conserva su id): no se avisa.
  assert.equal(avisoDeCobroZernio({ conectadas: [cuenta('facebook'), cuenta('instagram'), cuenta('metaads')], red: 'instagram' }), null);
});

test('el aviso dice cuántas hay y cuánto cuesta la que viene', () => {
  const t = textoAvisoCobro(2);
  assert.match(t, /ya tiene 2 cuentas conectadas/);
  assert.match(t, /US\$6 por mes/);
  assert.match(t, /desde la 3\.ª/);
  assert.ok(MENSAJES_DE_MOTIVO.cobro.length > 0);
});

test('el servidor cuenta ANTES de pedir el link, sólo con la clave del negocio, y deja pasar con el permiso o al reconectar', () => {
  const s = leer('../lib/zernio-conectar.ts');
  const f = s.slice(s.indexOf('export async function urlConectarViaZernio('), s.indexOf('// ── Quedó conectada'));
  const iAviso = f.indexOf("motivo: 'cobro'");
  const iLink = f.indexOf('`/connect/${def.ruta}');
  assert.ok(iAviso > 0 && iLink > iAviso, 'el aviso va antes de pedir el link de Zernio');
  assert.match(f, /if \(!opc\.reconectarId && !opc\.aceptaCobro && \(await usaCuentaPropia\(ws\)/);
  // Se cuenta TODA la cuenta de Zernio (cobra por equipo), no sólo el perfil del negocio.
  assert.match(f, /zFetch<unknown>\(c\.apiKey, '\/accounts\?excludeHidden=true'\)/);
  assert.match(leer('../app/api/zernio/route.ts'), /aceptaCobro: body\.aceptaCobro === true,/);
});

test('la pantalla pregunta y «Conectar igual» vuelve a pedir el link con el permiso, desde un clic nuevo', () => {
  const h = leer('../app/_components/ConectarViaZernio.tsx');
  assert.match(h, /if \(motivo === 'cobro'\) \{ setFase\('listo'\); setAvisoCobro\(/);
  assert.match(h, /conectar\(a\.red, \{ \.\.\.a\.extra, aceptaCobro: true \}\)/);
  // El aviso va en el `modal` que ya dibujan todas las pantallas que conectan.
  assert.match(h, /return \{ fase, red, error, pagoUrl, nota, conectar, modal: modalTodo \};/);
});
