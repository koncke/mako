// =============================================================================
// MaKo no inventa los leads de Meta por anuncio (17/10/2026)
// =============================================================================
// `ver_rendimiento_anuncios` (la API de MaKo) devolvía `leads_meta` = 10 en TODOS los anuncios —la
// META de leads con la que se valida uno (`RECON_LEADS_VALIDACION`), no «los leads de Meta»— y
// `leads_crm` = los leads que reporta Meta. El renglón y la cuenta del CRM viven ahora en
// lib/ads-rendimiento.ts, que es puro, y se prueban acá con datos.
//
// Probado rompiéndolo (17/10/2026; base en verde: 5 pasan, 0 fallan). Cada rotura se aplicó, se corrió
// este archivo y se restauró (pasan / fallan):
//   · filaDeRendimiento: `leads_meta: s.meta_leads` (el bug original)                       -> 4 / 1
//   · filaDeRendimiento: `leads_crm: s.leads`                                               -> 4 / 1
//   · bajadaCrmPorAnuncio: cuenta el lead aunque haya entrado fuera del rango               -> 4 / 1
//   · ads.run.ts: el map envuelve o arma el renglón a mano                              -> 4 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bajadaCrmPorAnuncio, filaDeRendimiento, type SenalParaFila } from '../lib/ads-rendimiento';

const RAIZ = join(import.meta.dirname, '..');

const senal = (extra: Partial<SenalParaFila> = {}): SenalParaFila => ({
  ad_id: '120000000000001', ad_name: 'Anuncio A', campana: 'Campaña', adset_name: 'Conjunto',
  spend_usd: 312.4, leads: 37, meta_leads: 10, leads_crm: 29,
  agendas: 4, cierres: 1, cash_usd: 1500, dias_corriendo: 9, veredicto: 'validada',
  hook_rate: 31.234, hold_rate: 12.5, ctr_link: 1.111, cpl_usd: 8.443, cpm_usd: 20.1, frequency: 1.4, impressions: 15000,
  ...extra,
});

test('los leads de Meta son los que REPORTA Meta, no la meta de 10', () => {
  const f = filaDeRendimiento(senal());
  assert.equal(f.leads_meta, 37);
  assert.equal(f.meta_leads_para_validar, 10);
  // Dos anuncios distintos no pueden dar el mismo número fijo.
  const g = filaDeRendimiento(senal({ ad_id: '2', leads: 3 }));
  assert.equal(g.leads_meta, 3);
});

test('los leads del CRM salen del CRM, y sin el dato se dice null (no un cero)', () => {
  assert.equal(filaDeRendimiento(senal()).leads_crm, 29);
  assert.equal(filaDeRendimiento(senal({ leads_crm: undefined })).leads_crm, null);
});

test('el CRM cuenta los leads que ENTRARON en el rango; agendas, cierres y cash de cualquier fecha', () => {
  const m = bajadaCrmPorAnuncio([
    { meta_ad_id: 'A', fecha_junta_1: '2026-10-02', estado_lead: 'ganado', total_cobrado_usd: 500, created_at: '2026-10-01T14:00:00Z' },
    { meta_ad_id: 'A', fecha_junta_1: null, estado_lead: 'abierto', total_cobrado_usd: null, created_at: '2026-10-15T23:00:00Z' },
    // Entró antes del rango: no es un lead de ESTE rango, pero su cierre y su plata siguen siendo del anuncio.
    { meta_ad_id: 'A', fecha_junta_1: '2026-08-02', estado_lead: 'ganado', total_cobrado_usd: 1000, created_at: '2026-08-01T10:00:00Z' },
    { meta_ad_id: 'B', fecha_junta_1: null, estado_lead: 'abierto', total_cobrado_usd: null, created_at: '2026-10-05T10:00:00Z' },
    { meta_ad_id: null, fecha_junta_1: null, estado_lead: 'abierto', total_cobrado_usd: null, created_at: '2026-10-05T10:00:00Z' },
  ], '2026-10-01', '2026-10-15');
  assert.deepEqual(m.get('A'), { leads: 2, agendas: 2, cierres: 2, cash: 1500 });
  assert.deepEqual(m.get('B'), { leads: 1, agendas: 0, cierres: 0, cash: 0 });
  assert.equal(m.size, 2);
});

test('la API arma el renglón con filaDeRendimiento, no a mano', () => {
  const run = readFileSync(join(RAIZ, 'lib/api-mako/areas/ads.run.ts'), 'utf8');
  assert.match(run, /anuncios:\s*orden\.slice\(0,\s*limite\)\.map\(filaDeRendimiento\)/);
  assert.doesNotMatch(run, /leads_meta:\s*s\.meta_leads/);
});

test('getSenalesRecon llena leads_crm desde el CRM', () => {
  const q = readFileSync(join(RAIZ, 'lib/queries.ts'), 'utf8');
  assert.match(q, /bajadaCrmPorAnuncio\(leadRows, start, end\)/);
  assert.match(q, /leads_crm:\s*down\.leads/);
});
