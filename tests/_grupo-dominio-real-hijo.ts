// =============================================================================
// Hijo de tests/grupo-dominio-real.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Las salidas REALES al grupo de un negocio (lib/mako-grupo.ts) y la copia al hilo de la app (lib/grupo-app.ts), con la base
// y Evolution de mentira del arnés. Cada escena manda un texto con un dominio CASI de MaKo (lo que inventa el modelo) y uno del
// negocio, y anota lo que llegó a Evolution, lo que quedó en el hilo y lo que quedó en la memoria del turno.

import { db, correrDespues, decirResultado, escenaNueva, red } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const WS = 10;
const JID = '120363000000000010@g.us';
const LINEA = 'mako_superadmin_x';

const filas = () => db.grupo_mensajes.filter((f) => f.workspace_id === WS).map((f) => String(f.texto ?? ''));
const aEvo = () => red.filter((x) => x.host === 'evolution.test' && /\/message\/send(Text|Media)\//.test(x.camino)).map((x) => {
  const b = JSON.parse(x.cuerpo || '{}') as { text?: string; caption?: string };
  return b.text ?? b.caption ?? '';
});
function limpiar() {
  db.grupo_mensajes.splice(0); db.mako_doer_conv.splice(0);
  db.app_settings = db.app_settings.filter((f) => !String(f.key).startsWith('mako.espaciado') && !String(f.key).startsWith('mako.doer.sent') && !String(f.key).startsWith('mako.salida'));
}

async function main() {
  db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 1, capa: 'cliente', nombre: 'Dueño', estado: 'activo' }, { id: WS, capa: 'cliente', nombre: 'Casa Luna', estado: 'activo' });
  db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID }, { workspace_id: 1, key: 'mako.voz.instancia', value: LINEA });
  const { enviarAlGrupoMaKo, enviarPartesAlGrupoMaKo } = await import('../lib/mako-grupo');
  const { copiarAlGrupo, ponerIdALaCopia } = await import('../lib/grupo-app');
  const out: Record<string, unknown> = {};

  // ── 1. Un aviso de texto (lo que escribe `generarMensajeAviso` y sale por `enviarAlGrupoMaKo`) ──
  limpiar(); escenaNueva();
  const texto = 'Revisa la ficha: hola-malo.com/crm/2761 y la promo en casaluna.mx/promo y en hola-moda.com/catalogo';
  const r1 = await enviarAlGrupoMaKo(WS, texto, 'mako');
  await correrDespues();
  out.texto = { ok: r1.ok, evolution: aEvo(), hilo: filas(), memoria: db.mako_doer_conv.map((f) => String(f.content ?? '')) };

  // ── 2. Por partes (la tarjeta «MaKo en WhatsApp»): el texto y el pie de un archivo ──
  limpiar(); escenaNueva();
  const r2 = await enviarPartesAlGrupoMaKo(WS, [
    { tipo: 'texto', texto: 'Conecta Meta en https://www.holamako.com/integraciones' },
    { tipo: 'media', base64: 'aGVsbG8=', media: { tipo: 'image', mimetype: 'image/png', fileName: 'plan.png' }, caption: 'El plan: hola-mako.co/plan · nuestra web: casaluna.mx/' },
  ], { esperar: async () => {} });
  out.partes = { ok: r2.ok, evolution: aEvo() };

  // ── 3. El eco: la copia del hilo (escrita ANTES de WhatsApp) tiene que emparejar con lo que volvió de WhatsApp ──
  limpiar(); escenaNueva();
  const copia = await copiarAlGrupo(WS, { texto: 'La ficha: hola-malo.com/crm/2761', de: 'mako' });
  await correrDespues();
  // Lo que WhatsApp devuelve como eco es lo que mandó `enviarAlGrupoMaKo`: ya corregido y con su `?ws=`.
  const empareja = await ponerIdALaCopia(WS, 'eco-1', 'La ficha: hola-mako.com/crm/2761?ws=10', null);
  out.eco = { copia: copia != null, hilo: filas(), empareja, atada: db.grupo_mensajes.find((f) => f.workspace_id === WS)?.wa_message_id ?? null };

  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
