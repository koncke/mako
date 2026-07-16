// =============================================================================
// reportes — compone el TEXTO de los reportes (horario / diario / semanal)
// =============================================================================
// Reusa las mismas lecturas que alimentan el dashboard (semáforo, ads, wins,
// pendientes). Cada sección va en su try/catch: si una fuente falla, el reporte
// se arma igual sin esa parte (nunca tumba el cron).
// =============================================================================

import 'server-only';
import { getMetaAccountHealth } from './meta-health';
import { getMarketingWindow, getObjetivoProgreso, getPendientesDeMarcar, getFatigaAdsets } from './queries';
import { getCashCollectedPeriodo, getCuotasPendientes } from './pagos';
import {
  hoyEnTijuana, ayerEnTijuana, diasAntes, lunesActualEnTijuana,
  primerDiaDelMesEnTijuana, fmtDDMMYYYY,
} from './date-utils';
import type { NotifPrefs } from './perfil';
import type { NotifSeveridad } from './notificaciones';

export type Reporte = {
  tipo: 'reporte_horario' | 'reporte_diario' | 'reporte_semanal';
  titulo: string;       // 1 línea, para el feed y el asunto del email
  descripcion: string;  // resumen corto para el feed
  texto: string;        // cuerpo multilínea (WhatsApp / email)
  severidad: NotifSeveridad;
  urgente: boolean;     // solo horario: si amerita push
};

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtMxn = (n: number) => `$${Math.round(n).toLocaleString('en-US')} MXN`;

function subir(sev: NotifSeveridad, a: NotifSeveridad): NotifSeveridad {
  const orden: NotifSeveridad[] = ['ok', 'info', 'warn', 'urgente'];
  return orden.indexOf(a) > orden.indexOf(sev) ? a : sev;
}

// ── Diario (rutinario) ────────────────────────────────────────────────────────
export async function buildReporteDiario(prefs: NotifPrefs): Promise<Reporte> {
  const hoy = hoyEnTijuana();
  const ayer = ayerEnTijuana();
  const L: string[] = [`📊 *Reporte del día* — ${fmtDDMMYYYY(hoy)}`];
  let sev: NotifSeveridad = 'info';

  if (prefs.secciones.semaforo) {
    try {
      const s = await getMetaAccountHealth();
      const emoji = s.severidad === 'verde' ? '🟢' : s.severidad === 'ambar' ? '🟡' : '🔴';
      L.push('', `${emoji} *Cuenta Meta:* ${s.statusLabel}${s.entregaFrenada ? ' — ⚠️ entrega frenada' : ''}`);
      L.push(`   Saldo ${fmtUsd(s.balanceUsd)} · gastado ${fmtMxn(s.amountSpentMxn)}`);
      if (s.severidad === 'rojo') sev = subir(sev, 'urgente');
      else if (s.severidad === 'ambar') sev = subir(sev, 'warn');
    } catch { L.push('', '🔻 Semáforo Meta: no disponible ahora.'); }
  }

  if (prefs.secciones.ads) {
    try {
      const a = await getMarketingWindow(ayer, ayer);
      L.push('', '*Ads (ayer)*');
      L.push(`   Gasto ${fmtUsd(a.spend_usd)} · ${a.leads_count} leads · CPL ${a.cpl_global != null ? fmtUsd(a.cpl_global) : '—'}`);
      L.push(`   ${a.impressions.toLocaleString('en-US')} impresiones · CTR ${a.ctr_global != null ? a.ctr_global.toFixed(2) + '%' : '—'}`);
    } catch { L.push('', '🔻 Ads: sin datos de ayer.'); }
  }

  if (prefs.secciones.wins) {
    try {
      const o = await getObjetivoProgreso(hoy);
      const cashMes = await getCashCollectedPeriodo(primerDiaDelMesEnTijuana(), hoy);
      L.push('', '*Wins*');
      L.push(`   Cierres ${o.cierres_actual}${o.cierres_meta != null ? '/' + o.cierres_meta : ''} · Cash ${fmtUsd(o.cash_actual)}${o.cash_meta != null ? ' de ' + fmtUsd(o.cash_meta) : ''}`);
      L.push(`   Cash del mes: ${fmtUsd(cashMes)}`);
    } catch { L.push('', '🔻 Wins: no disponibles.'); }
  }

  if (prefs.secciones.pendientes) {
    try {
      const p = await getPendientesDeMarcar(hoy);
      const c = await getCuotasPendientes(hoy);
      L.push('', '*Pendientes*');
      L.push(`   ${p.total} datos sin marcar · ${c.vencidas.length} cuota(s) vencida(s)`);
      if (c.vencidas.length) sev = subir(sev, 'warn');
    } catch { /* opcional */ }
  }

  return {
    tipo: 'reporte_diario',
    titulo: `Reporte del día · ${fmtDDMMYYYY(hoy)}`,
    descripcion: 'Semáforo, ads, wins y pendientes de hoy.',
    texto: L.join('\n'),
    severidad: sev,
    urgente: false,
  };
}

// ── Horario (lo urgente) ──────────────────────────────────────────────────────
export async function buildReporteHorario(prefs: NotifPrefs): Promise<Reporte> {
  const hoy = hoyEnTijuana();
  const alertas: string[] = [];
  let sev: NotifSeveridad = 'ok';

  if (prefs.secciones.semaforo) {
    try {
      const s = await getMetaAccountHealth();
      if (s.severidad === 'rojo' || s.entregaFrenada) {
        alertas.push(`🔴 Cuenta Meta: ${s.statusLabel}${s.entregaFrenada ? ' — entrega frenada' : ''}.`);
        sev = subir(sev, 'urgente');
      }
    } catch { /* ignorar */ }
  }

  if (prefs.secciones.wins || prefs.secciones.pendientes) {
    try {
      const c = await getCuotasPendientes(hoy);
      if (c.vencidas.length) {
        const tot = c.vencidas.reduce((acc, x) => acc + x.monto_usd, 0);
        alertas.push(`💸 ${c.vencidas.length} cuota(s) vencida(s) — ${fmtUsd(tot)} por cobrar.`);
        sev = subir(sev, 'warn');
      }
    } catch { /* ignorar */ }
  }

  if (prefs.secciones.ads) {
    try {
      const f = await getFatigaAdsets(hoy);
      if (f.length) {
        alertas.push(`📉 ${f.length} adset(s) con fatiga (frecuencia alta / CPL subiendo).`);
        sev = subir(sev, 'warn');
      }
    } catch { /* ignorar */ }
  }

  if (prefs.secciones.pendientes) {
    try {
      const p = await getPendientesDeMarcar(hoy);
      if (p.total >= 5) {
        alertas.push(`📝 ${p.total} datos sin marcar en el CRM.`);
        sev = subir(sev, 'warn');
      }
    } catch { /* ignorar */ }
  }

  const urgente = alertas.length > 0;
  return {
    tipo: 'reporte_horario',
    titulo: urgente ? 'Atención: hay pendientes urgentes' : 'Todo en orden',
    descripcion: urgente ? alertas.join(' · ') : 'Sin alertas.',
    texto: urgente
      ? `⏰ *Lo urgente* — ${fmtDDMMYYYY(hoy)}\n\n${alertas.join('\n')}`
      : `Todo tranquilo ✅ — ${fmtDDMMYYYY(hoy)}`,
    severidad: urgente ? sev : 'ok',
    urgente,
  };
}

// ── Semanal ───────────────────────────────────────────────────────────────────
export async function buildReporteSemanal(prefs: NotifPrefs): Promise<Reporte> {
  const hoy = hoyEnTijuana();
  const lunes = lunesActualEnTijuana();
  const start = diasAntes(lunes, 7); // lunes de la semana pasada
  const end = diasAntes(lunes, 1);   // domingo pasado
  const L: string[] = [`🗓️ *Reporte semanal* — ${fmtDDMMYYYY(start)} a ${fmtDDMMYYYY(end)}`];
  let sev: NotifSeveridad = 'info';

  if (prefs.secciones.ads) {
    try {
      const a = await getMarketingWindow(start, end);
      L.push('', '*Ads (semana)*');
      L.push(`   Gasto ${fmtUsd(a.spend_usd)} · ${a.leads_count} leads · CPL ${a.cpl_global != null ? fmtUsd(a.cpl_global) : '—'}`);
      L.push(`   ${a.cierres_en_ventana} cierres en ventana · CAC ${a.cac != null ? fmtUsd(a.cac) : '—'}`);
    } catch { L.push('', '🔻 Ads: sin datos de la semana.'); }
  }

  if (prefs.secciones.wins) {
    try {
      const o = await getObjetivoProgreso(hoy);
      const cashSem = await getCashCollectedPeriodo(start, end);
      L.push('', '*Wins*');
      L.push(`   Cash de la semana: ${fmtUsd(cashSem)}`);
      L.push(`   Objetivo global: ${o.cierres_actual}${o.cierres_meta != null ? '/' + o.cierres_meta : ''} cierres · ${fmtUsd(o.cash_actual)}${o.cash_meta != null ? ' de ' + fmtUsd(o.cash_meta) : ''}`);
      if (o.semanas_estimadas != null) L.push(`   Ritmo: ~${o.semanas_estimadas} semanas para la meta`);
    } catch { L.push('', '🔻 Wins: no disponibles.'); }
  }

  if (prefs.secciones.pendientes) {
    try {
      const c = await getCuotasPendientes(hoy);
      if (c.vencidas.length) {
        const tot = c.vencidas.reduce((acc, x) => acc + x.monto_usd, 0);
        L.push('', `*Por cobrar:* ${c.vencidas.length} cuota(s) vencida(s) — ${fmtUsd(tot)}`);
        sev = subir(sev, 'warn');
      }
    } catch { /* opcional */ }
  }

  return {
    tipo: 'reporte_semanal',
    titulo: `Reporte semanal · ${fmtDDMMYYYY(start)}–${fmtDDMMYYYY(end)}`,
    descripcion: 'Ads, wins y cobranza de la semana.',
    texto: L.join('\n'),
    severidad: sev,
    urgente: false,
  };
}
