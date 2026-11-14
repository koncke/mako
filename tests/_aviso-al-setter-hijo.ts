// =============================================================================
// Hijo de tests/aviso-al-setter.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El aviso de una automatización sobre un lead, con la base, el push y Evolution de mentira (tests/_grupos-ops-arnes.ts) y
// el código real: `avisarAlSetterDelLead` (lib/aviso-al-setter.ts) y la acción `avisar_al_equipo` desde un flujo y desde
// el chat. Imprime a qué teléfonos les sonó y a qué chats salió un WhatsApp.

import { db, decirResultado, escenaNueva, pushes, red } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const JUAN_JID = '5491155550001@s.whatsapp.net';

async function main() {
  db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 13, capa: 'completo', nombre: 'Inmobiliaria', estado: 'activo' }, { id: 11, capa: 'completo', nombre: 'Otro', estado: 'activo' });
  db.leads = [
    { id: 501, workspace_id: 13, nombre: 'Ana Gómez', setter: '  juan  PEREZ ', telefono: '5491100000001', empresa: null },
    { id: 502, workspace_id: 13, nombre: 'Beto', setter: 'Repetido', telefono: null, empresa: null },
    { id: 503, workspace_id: 13, nombre: 'Caro', setter: 'MaKo', telefono: null, empresa: null },
  ];
  db.usuarios.push(
    { id: 701, workspace_id: 13, nombre: 'Juan Pérez', email: 'juan@x.co', rol: 'cliente', rol_ws: 'setter', estado: 'activo', perfil: { telefono: '+54 9 11 5555-0001' } },
    { id: 702, workspace_id: 11, nombre: 'Juan Pérez', email: 'juan@otro.co', rol: 'cliente', rol_ws: 'setter', estado: 'activo', perfil: {} },
    { id: 703, workspace_id: 13, nombre: 'Repetido', email: 'r1@x.co', rol: 'cliente', rol_ws: 'setter', estado: 'activo', perfil: {} },
    { id: 704, workspace_id: 13, nombre: 'Repetido', email: 'r2@x.co', rol: 'cliente', rol_ws: 'closer', estado: 'activo', perfil: {} },
  );
  for (const [uid, ep] of [[701, 'juan'], [702, 'juan-de-otro-negocio'], [703, 'repetido-1'], [704, 'repetido-2']] as const) {
    db.push_suscripciones.push({ id: 900 + uid, usuario_id: uid, endpoint: `https://push.test/${ep}`, p256dh: 'p'.repeat(87), auth: 'a'.repeat(22), fallos: 0 });
  }
  const { avisarAlSetterDelLead } = await import('../lib/aviso-al-setter');
  const sonoA = () => pushes.map((p) => p.endpoint.replace('https://push.test/', ''));
  const salioA = () => red.filter((x) => x.host === 'evolution.test' && x.camino.includes('/message/')).map((x) => (JSON.parse(x.cuerpo || '{}') as { number?: string }).number ?? '?');
  const out: Record<string, unknown> = {};

  // 1 · El bot apagado: el push sí, el WhatsApp no (y dice por qué).
  escenaNueva();
  out.apagado = await avisarAlSetterDelLead(13, 501, 'Ana preguntó por el precio y no encajó en ningún caso.');
  out.apagadoSono = sonoA();
  out.apagadoPush = pushes[0]?.cuerpo ?? null;
  out.apagadoSalio = salioA();

  // 2 · El bot prendido y Juan le escribió a MaKo hace un rato: sale el WhatsApp a SU número.
  db.app_settings.push(
    { id: 60, workspace_id: 9, key: 'mako.bot.activo', value: 'si' },
    { id: 61, workspace_id: 9, key: 'mako.bot.instancia', value: 'mako_superadmin_prueba' },
  );
  db.mako_bot_contactos = [{ jid: JUAN_JID, ultimo_entrante_at: new Date(Date.now() - 3600_000).toISOString() }];
  escenaNueva();
  out.prendido = await avisarAlSetterDelLead(13, 501, 'Ana preguntó por el precio y no encajó en ningún caso.');
  out.prendidoSalio = salioA();
  out.prendidoTexto = red.filter((x) => x.host === 'evolution.test' && x.camino.includes('/message/')).map((x) => (JSON.parse(x.cuerpo) as { text?: string }).text ?? '')[0] ?? null;

  // 3 · Dos con el mismo nombre, o MaKo de setter: a nadie.
  escenaNueva();
  out.repetido = await avisarAlSetterDelLead(13, 502, 'x');
  out.mako = await avisarAlSetterDelLead(13, 503, 'x');
  out.nadieSono = sonoA();

  // 4 · La acción de la tarjeta MAKO: desde un flujo le avisa también al setter; desde el chat, no.
  const { runnerDe } = await import('../lib/api-mako/runners');
  const { runWithWorkspace } = await import('../lib/workspace');
  const ctx = (canalKey: string) => ({ ws: 13, canal: 'app', canalKey, alcance: 'workspace', rol: 'admin' }) as never;
  const accion = runnerDe('avisar_al_equipo') as { ejecutar: (p: Record<string, unknown>, c: never) => Promise<unknown> };
  escenaNueva();
  out.flujo = await runWithWorkspace(13, () => accion.ejecutar({ leadId: 501, mensaje: 'No encajó en ningún caso: síguelo tú.', respuesta: '¿Y cuánto sale?' }, ctx('app:flujo:77')));
  out.flujoSono = sonoA();
  escenaNueva();
  out.chat = await runWithWorkspace(13, () => accion.ejecutar({ leadId: 501, mensaje: 'Revisa a Ana.' }, ctx('app:sesion-1')));
  out.chatSono = sonoA();
  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
