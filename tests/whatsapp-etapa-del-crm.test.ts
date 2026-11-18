// F157 (18/11/2026): la API de MaKo contestaba la «etapa del inbox» de un lead con la derivación FIJA de las bandejas de
// WhatsApp que ya no existen (`derivarEtapa`, lib/wa-etapas.ts: cliente, agendo, no-show…), ciega a las etapas de cada
// negocio. Ahora `etapa_inbox` es la etapa del CRM de su tablero, leída con el funnel de su casa, como Chats
// (`etapasDelCrmPorId`, lib/chats.ts). La regla que decide la etapa es `etapaVigenteDe` (lib/funnel-etapas.ts): se ejecuta
// acá contra la derivación fija, con un funnel propio, y se mira que los dos runners usen la del CRM.
//
// Probado rompiéndolo (base 3/0):
//   · `etapa_inbox_de_lead` devolviendo otra vez `derivarEtapa(lead)` en `etapa_inbox` → 2/1;
//   · la lista de conversaciones (`listar_conversaciones_whatsapp_oficial`) con `derivarEtapa(g.lead)` → 2/1;
//   · `etapasDelCrmPorId` leyendo todos con el funnel del negocio (sin `embudosDeLeads`) → 2/1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { etapaVigenteDe } from '../lib/funnel-etapas';
import { derivarEtapa } from '../lib/wa-etapas';

const leer = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encuentro ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encuentro el fin de ${desde}`);
  return src.slice(i, j);
};

test('un lead movido a mano a una etapa propia del negocio: el CRM dice esa etapa, la derivación fija dice otra cosa', () => {
  // Un funnel de inmobiliaria con sus etapas propias (las claves de un funnel editado se numeran st0, st1…).
  const etapas = [{ key: 'lead' }, { key: 'st0' }, { key: 'st1' }, { key: 'ganado' }];
  const lead = {
    estado_lead: 'abierto' as const, pipeline_stage: 'st1', fecha_agenda: '2026-11-10', fecha_junta_1: null, fecha_junta_2: null,
    asistio_j1: null, asistio_j2: null,
  };
  assert.equal(etapaVigenteDe(lead, etapas), 'st1', 'la columna donde está en su tablero');
  assert.equal(derivarEtapa(lead).key, 'agendo', 'la derivación fija no sabe de esa columna');
});

test('los dos runners de la API contestan la etapa del CRM', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/whatsapp.run.ts'));
  const deLead = bloque(run, 'etapa_inbox_de_lead: {', 'lead_insiste_con_lo_mismo: {');
  assert.match(deLead, /etapasDelCrmPorId\(\[lead\.id\]\)/);
  assert.match(deLead, /etapa_inbox: crm,/, 'etapa_inbox es la del CRM');
  assert.match(deLead, /etapa_etiqueta_whatsapp: etiqueta,/, 'la derivación fija va aparte, con su nombre');
  const lista = bloque(run, 'listar_conversaciones_whatsapp_oficial: {', 'listar_etiquetas_whatsapp: {');
  assert.match(lista, /const etapa = g\.lead \? etapas\?\.get\(Number\(g\.lead\.id\)\) \?\? null : null;/);
  assert.doesNotMatch(lista, /derivarEtapa\(/, 'la lista ya no deriva la etapa');
});

test('la etapa del CRM se lee con el funnel de la CASA de cada lead, como Chats', () => {
  const chats = sinComentarios(leer('lib/chats.ts'));
  const f = bloque(chats, 'export async function etapasDelCrmPorId(', '\n}\n');
  assert.match(f, /const embudoDe = await embudosDeLeads\(filas, \{ stages: e\.stages, labels: e\.labels \}\);/);
  assert.match(f, /out\.set\(Number\(l\.id\), etapaDe\(l, emb\.stages, emb\.labels\)\);/);
});
