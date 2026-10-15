// =============================================================================
// Cómo entró el lead: su @ de Instagram, la primera entrada social y la página donde se registró
// =============================================================================
// Tanda B del CRM (14/10/2026, docs/diseno-ficha-bloques.md §5, «Datos que hacen falta»). Los bloques
// `redes-y-web`, `charla-dm`, `origen`, `pagina-de-registro` y `publicacion-de-entrada` necesitan datos
// que el alta conocía y tiraba:
//
//   · el lead de Instagram nacía sin su @ (quedaba en `ig_conversaciones.username`);
//   · de cómo entró no quedaba nada: la fila de la persona guarda el ÚLTIMO comentario (lo pisa el
//     siguiente, a propósito: el motor contesta ése por privado), el texto del comentario no iba a
//     ningún lado, y el `ref` y el anuncio se tiraban (`createLead` no escribía `meta_ad_id`);
//   · el alta por Instagram no dejaba ninguna línea en el historial;
//   · la página del opt-in se usaba para decidir el producto y no se guardaba en el lead.
//
// Lo puro se EJECUTA (lib/canal-social.ts, lib/lead-alta-columnas.ts); el cableado de los módulos
// `server-only` (lib/zernio-entrante.ts, lib/leads.ts, la ruta del opt-in) se mira sobre el FUENTE,
// sin comentarios, porque un test no puede importarlos.
//
// Correr: npx tsx --test tests/crm-entrada-social.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (14/10/2026), una rotura por vez y restaurando. Base en verde: 11 pass / 0 fail.
//   (los números de cada rotura, abajo, junto al test que la caza)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  eventoSocialDe, instagramDelEvento, entradaSocialDe, entradaSocialGuardada, lineaDeEntradaSocial, TOPE_TEXTO_ENTRADA,
  type EventoSocial,
} from '../lib/canal-social';
import { faltaColumnaNuevaDelAlta, sinColumnasNuevas, traeColumnasNuevas, COLUMNAS_NUEVAS_DEL_ALTA } from '../lib/lead-alta-columnas';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas ANTES que los bloques (AGENTS.md).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, desde: string, hasta: string): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: ¿se renombró?`);
  const j = src.indexOf(hasta, i + desde.length);
  return src.slice(i, j < 0 ? undefined : j);
};

// ── Las formas del webhook de Zernio (las mismas de tests/canal-social.test.ts) ──────────────
const cuenta = (platform: string) => ({ id: 'acc1', accountId: 'acc1', profileId: 'prof1', platform, username: 'negocio' });
const mensaje = (platform: string, metadata: Record<string, unknown> | null = null, sender: Record<string, unknown> = { id: 'igsid-1', name: 'Luis Pérez', username: 'LuisP' }) => ({
  id: 'ev-1', event: 'message.received', timestamp: '2026-10-09T17:00:00Z',
  message: { id: 'm1', conversationId: 'c1', platform, direction: 'incoming', text: 'hola, quiero info', attachments: [], sender, sentAt: '2026-10-09T16:59:58.123Z' },
  conversation: { id: 'c1', participantId: 'igsid-1', participantName: 'Luis Pérez', status: 'active' },
  account: cuenta(platform),
  metadata,
});
const comentario = (platform: string, text: string, extra: Record<string, unknown> = {}) => ({
  id: 'ev-2', event: 'comment.received', timestamp: '2026-10-09T17:00:00Z',
  comment: { id: 'k1', platformPostId: 'p1', platform, text, createdAt: '2026-10-09T16:58:00Z', author: { id: 'au-1', username: 'ana.lopez', name: 'Ana' }, ...extra },
  account: { id: 'acc1', accountId: 'acc1', platform, username: 'negocio' },
});
const referral = (platform: string, ref: Record<string, unknown>, timestamp = '2026-10-09T17:00:00Z') => ({
  id: 'ev-3', event: 'referral.received', timestamp, referral: ref,
  sender: { id: 'psid-1' }, conversation: { id: 'c2', participantId: 'psid-1', participantUsername: 'pepe', status: 'active' },
  account: cuenta(platform),
});
const evento = (body: unknown): EventoSocial => {
  const r = eventoSocialDe(body);
  assert.ok('evento' in r, `se ignoró: ${'ignorar' in r ? r.ignorar : ''}`);
  return r.evento;
};

// Rotura: `instagramDelEvento` sin el corte de Messenger → 10 / 1 (éste).
test('el @ con que nace el lead: el de Instagram, normalizado; el de Messenger NO (es el de Facebook)', () => {
  assert.equal(instagramDelEvento(evento(mensaje('instagram'))), 'luisp', 'sin la @ y en minúsculas, como lo guarda la ficha');
  assert.equal(instagramDelEvento(evento(comentario('instagram', 'INFO'))), 'ana.lopez');
  assert.equal(instagramDelEvento({ canal: 'instagram', usuario: '@@Marta_99' }), 'marta_99');
  // Messenger: la plataforma es `facebook` y el usuario es el de Facebook.
  assert.equal(instagramDelEvento(evento(mensaje('facebook'))), null);
  assert.equal(instagramDelEvento(evento(referral('facebook', { ref: 'promo' }))), null);
  // Lo que no tiene forma de usuario de Instagram no se escribe.
  assert.equal(instagramDelEvento({ canal: 'instagram', usuario: 'Luis Pérez' }), null);
  assert.equal(instagramDelEvento({ canal: 'instagram', usuario: '___' }), null);
  assert.equal(instagramDelEvento({ canal: 'instagram', usuario: null }), null);
});

// Rotura: `entradaSocialDe` sin el texto del comentario → 9 / 2 (éste y el de la línea del historial).
// Rotura: `entradaSocialDe` guardando el texto también de un DM → 9 / 2 (éste y el de la línea del historial).
test('la entrada de un comentario guarda la publicación, el comentario y lo que escribió (la palabra clave)', () => {
  const en = entradaSocialDe(evento(comentario('instagram', '  INFO  ')));
  assert.deepEqual(en, { canal: 'instagram', como: 'comentario', at: '2026-10-09T16:58:00.000Z', cuenta_id: 'acc1', post_id: 'p1', comentario_id: 'k1', texto: 'INFO' });
  const vivo = entradaSocialDe(evento(comentario('instagram', 'quiero', { isLive: true })));
  assert.equal(vivo.como, 'comentario_vivo');
  assert.equal(vivo.texto, 'quiero');
  const largo = entradaSocialDe(evento(comentario('instagram', 'x'.repeat(1000))));
  assert.equal(largo.texto!.length, TOPE_TEXTO_ENTRADA);
  // Un DM: su texto ya queda entero en `ig_mensajes`, acá no se repite.
  const dm = entradaSocialDe(evento(mensaje('instagram')));
  assert.deepEqual(dm, { canal: 'instagram', como: 'mensaje', at: '2026-10-09T16:59:58.123Z', cuenta_id: 'acc1' });
  assert.equal(entradaSocialDe(evento(mensaje('instagram', { storyReply: { storyId: 's1' } }))).como, 'historia');
});

// Rotura: `entradaSocialDe` sin el anuncio → 10 / 1 (éste).
test('el DM de un anuncio guarda el anuncio; el enlace de referencia y el QR, su ref', () => {
  const ad = entradaSocialDe(evento(mensaje('instagram', { referral: { ad_id: '120210000000000001', source: 'ADS', ref: 'oct' } })));
  assert.equal(ad.como, 'anuncio');
  assert.equal(ad.anuncio_id, '120210000000000001');
  assert.equal(ad.ref, 'oct');
  const ref = entradaSocialDe(evento(referral('facebook', { ref: 'bio-link' })));
  assert.deepEqual([ref.canal, ref.como, ref.ref], ['messenger', 'referencia', 'bio-link']);
  assert.equal(entradaSocialDe(evento(referral('facebook', { ref: 'qr-mostrador' }))).como, 'qr');
});

// Rotura: `entradaSocialDe` copiando `e.fecha` sin mirarla → 9 / 2 (éste y el del comentario).
test('la fecha no se inventa: sin la del evento, la clave no va (el 1/1/1970 de `eventoSocialDe` no es un dato)', () => {
  const sinFecha = evento({ ...referral('instagram', { ref: 'x' }), timestamp: undefined });
  assert.equal(sinFecha.fecha, new Date(0).toISOString(), 'el default de eventoSocialDe cambió: revisa este test');
  assert.equal('at' in entradaSocialDe(sinFecha), false);
});

// Rotura: `entradaSocialGuardada` aceptando un `como` cualquiera → 10 / 1 (éste).
test('lo guardado se sanea al leerlo: lo que no es una entrada social es null', () => {
  const en = entradaSocialDe(evento(comentario('instagram', 'INFO')));
  assert.deepEqual(entradaSocialGuardada(JSON.parse(JSON.stringify(en))), en, 'ida y vuelta por la base');
  for (const malo of [null, undefined, 'instagram', [], {}, { canal: 'whatsapp', como: 'mensaje' }, { canal: 'instagram', como: 'otra' }]) {
    assert.equal(entradaSocialGuardada(malo), null, JSON.stringify(malo));
  }
  const sucio = entradaSocialGuardada({ canal: 'instagram', como: 'comentario', at: 'ayer', texto: 'y'.repeat(900), ref: 42 });
  assert.deepEqual(sucio, { canal: 'instagram', como: 'comentario', texto: 'y'.repeat(TOPE_TEXTO_ENTRADA) });
});

test('la línea del historial es corta y dice qué hizo', () => {
  assert.equal(lineaDeEntradaSocial(entradaSocialDe(evento(comentario('instagram', 'INFO')))), 'Comentó tu publicación: «INFO»');
  assert.equal(lineaDeEntradaSocial(entradaSocialDe(evento(mensaje('instagram')))), 'Te escribió un mensaje');
  assert.equal(lineaDeEntradaSocial(entradaSocialDe(evento(referral('facebook', { ref: 'bio-link' })))), 'Tocó tu enlace de referencia · ref bio-link');
  const larga = lineaDeEntradaSocial(entradaSocialDe(evento(comentario('instagram', 'z'.repeat(200)))));
  assert.ok(larga.length <= 90, `mide ${larga.length}`);
  assert.match(larga, /…»$/);
});

// ── El alta sin la migración ──────────────────────────────────────────────────────────────────

// Rotura: `faltaColumnaNuevaDelAlta` sin exigir que la columna sea una de las nuevas → 10 / 1 (éste).
test('sin la migración el alta reintenta UNA vez, y sólo si lo que falta es una de las columnas nuevas', () => {
  assert.deepEqual([...COLUMNAS_NUEVAS_DEL_ALTA], ['pagina_registro', 'entrada_social']);
  assert.equal(faltaColumnaNuevaDelAlta({ code: 'PGRST204', message: "Could not find the 'pagina_registro' column of 'leads' in the schema cache" }), true);
  assert.equal(faltaColumnaNuevaDelAlta({ code: '42703', message: 'column "entrada_social" of relation "leads" does not exist' }), true);
  assert.equal(faltaColumnaNuevaDelAlta({ message: "Could not find the 'entrada_social' column of 'leads' in the schema cache" }), true, 'sin code (un error envuelto)');
  // Otra columna, la red, un permiso: el reintento no lo arregla y el error tiene que subir.
  assert.equal(faltaColumnaNuevaDelAlta({ code: 'PGRST204', message: "Could not find the 'instagram' column of 'leads' in the schema cache" }), false);
  assert.equal(faltaColumnaNuevaDelAlta({ code: '23505', message: 'duplicate key value violates unique constraint (pagina_registro)' }), false);
  assert.equal(faltaColumnaNuevaDelAlta({ message: 'fetch failed' }), false);
  assert.equal(faltaColumnaNuevaDelAlta(null), false);
  const fila = { nombre: 'Ana', pagina_registro: 'https://x.com/a', entrada_social: { canal: 'instagram' }, instagram: 'ana' };
  assert.deepEqual(sinColumnasNuevas(fila), { nombre: 'Ana', instagram: 'ana' });
  assert.equal('pagina_registro' in fila, true, 'no toca la original');
  assert.equal(traeColumnasNuevas(fila), true);
  assert.equal(traeColumnasNuevas({ nombre: 'Ana' }), false);
});

// ── El cableado (módulos `server-only`: sobre el FUENTE) ───────────────────────────────────────

// Rotura: sacar `instagram: instagramDelEvento(e),` del alta de Zernio → 10 / 1 (éste).
// Rotura: el `logLeadEvent` ANTES del compare-and-set → 10 / 1 (éste).
test('el alta de Zernio pasa el @, el anuncio y la entrada, y deja su línea sólo para el lead que quedó unido', () => {
  const src = sinComentarios(leer('../lib/zernio-entrante.ts'));
  const crear = bloque(src, 'async function crearLeadDe(', '\n}\n');
  assert.match(crear, /const entrada = entradaSocialDe\(e\);/);
  assert.match(crear, /instagram: instagramDelEvento\(e\),/);
  assert.match(crear, /meta_ad_id: e\.anuncioId,/);
  assert.match(crear, /entrada_social: entrada,/);
  const iCas = crear.indexOf(".is('lead_id', null)");
  const iSinUnir = crear.indexOf('quedó sin unir');
  const iLinea = crear.indexOf("logLeadEvent(lead.id, 'Entrada', lineaDeEntradaSocial(entrada), NOMBRE_CANAL[e.canal])");
  assert.ok(iCas > 0 && iSinUnir > iCas && iLinea > iSinUnir, 'la línea va después del compare-and-set y del «quedó sin unir»: el lead que perdió no es el de esta persona');
  // La fila de la persona sigue guardando el ÚLTIMO comentario: lo necesita la respuesta privada.
  assert.match(bloque(src, 'function filaDe(', '\n}\n'), /f\.comentario_post_id = e\.postId;/);
});

// Rotura: sacar el `meta_ad_id` del insert de `createLead` → 10 / 1 (éste).
// Rotura: sacar el reintento sin las columnas nuevas → 10 / 1 (éste).
test('createLead escribe el anuncio, la página y la entrada, y sin la migración el lead entra igual', () => {
  const src = sinComentarios(leer('../lib/leads.ts'));
  const crear = bloque(src, 'export async function createLead(', '\n}\n');
  assert.match(crear, /\.\.\.\(input\.meta_ad_id\?\.trim\(\) \? \{ meta_ad_id: input\.meta_ad_id\.trim\(\) \} : \{\}\),/);
  assert.match(crear, /\.\.\.\(input\.pagina_registro\?\.trim\(\) \? \{ pagina_registro: input\.pagina_registro\.trim\(\) \} : \{\}\),/);
  assert.match(crear, /\.\.\.\(input\.entrada_social \? \{ entrada_social: input\.entrada_social \} : \{\}\),/);
  assert.match(crear, /if \(error && traeColumnasNuevas\(fila\) && faltaColumnaNuevaDelAlta\(error\)\) \{/);
  assert.match(crear, /\(\{ data, error \} = await insertar\(sinColumnasNuevas\(fila\)\)\);/);
  assert.equal((crear.match(/insertar\(/g) ?? []).length, 2, 'un intento y UN reintento: más es escribir de más');
  // El tipo `Lead` trae lo que existe en la base y faltaba (migs 0046, 0204, 0272) y lo nuevo.
  const tipo = bloque(src, 'export type Lead = {', '\n};\n');
  for (const c of ['junta_1_url', 'junta_2_url', 'email_opt_out', 'oferta_id', 'pagina_registro', 'entrada_social']) {
    assert.match(tipo, new RegExp(`\\n  ${c}\\?: `), `falta ${c} en el tipo Lead`);
  }
  // ⚠️ Y el tablero NO las pide: `LISTA_COLS` con una columna nueva haría que el CRM abra vacío sin la migración.
  const cols = bloque(src, 'const LISTA_COLS =', ';\n');
  for (const c of ['pagina_registro', 'entrada_social']) assert.ok(!cols.includes(c), `${c} en LISTA_COLS ata el tablero a la migración`);
});

// Rotura: sacar `pagina_registro: paginaOptin,` del alta directa → 10 / 1 (éste).
test('el opt-in guarda la página donde se registró, por los DOS caminos', () => {
  const src = sinComentarios(leer('../app/api/track/optin/route.ts'));
  assert.match(src, /const paginaOptin = normalizarUrl\(urlTxt\(body\.pagina\) \?\? ''\);/);
  const alta = bloque(src, 'createLead({', '}));');
  assert.match(alta, /pagina_registro: paginaOptin,/, 'el alta directa');
  const prop = bloque(src, 'await crearPropuesta({', '\n  });');
  assert.match(prop, /pagina_registro: paginaOptin,/, 'la propuesta (la escribe quien confirma)');
});

// Rotura: el backfill sin `plataforma = 'instagram'` → 10 / 1 (éste).
// Rotura: el insert a `lead_audit` sin `workspace_id` → 10 / 1 (éste).
test('las migraciones: las dos columnas, y el @ de los viejos sólo de Instagram, sólo donde está vacío y con su línea en el ws del lead', () => {
  const cols = leer('../supabase/migrations/XXXX_lead_entrada.sql');
  assert.match(cols, /ORDEN DE DESPLIEGUE: ANTES O JUNTO CON EL DEPLOY/);
  assert.match(cols, /alter table leads add column if not exists pagina_registro text;/);
  assert.match(cols, /alter table leads add column if not exists entrada_social jsonb;/);
  const bf = leer('../supabase/migrations/XXXX_lead_instagram_desde_ig.sql');
  assert.match(bf, /ORDEN DE DESPLIEGUE: DESPUÉS DEL DEPLOY/);
  const sql = bf.replace(/^\s*--.*$/gm, '');
  assert.match(sql, /ic\.plataforma = 'instagram'/, 'en Messenger el usuario es el de Facebook');
  assert.match(sql, /\(l\.instagram is null or btrim\(l\.instagram\) = ''\)/, 'lo que cargó una persona no se pisa');
  assert.match(sql, /l\.workspace_id = e\.workspace_id/);
  assert.match(sql, /usuario ~ '\^\[a-z0-9\._\]\{1,30\}\$'/, 'la regla de usuarioDeTexto');
  assert.match(sql, /insert into lead_audit \(lead_id, workspace_id, campo, valor_anterior, valor_nuevo, autor\)/,
    'sin workspace_id explícito la línea cae al ws1 (default 1, mig 0054), que es un cliente real');
});
