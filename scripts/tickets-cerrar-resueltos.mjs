// Cierra tickets YA RESUELTOS en producción, por la API REST de Supabase (el host directo es sólo IPv6).
// Martín, 28/10/2026, en el chat del Cerebro: «Si ya están resueltos siempre ciérralos, no me preguntes y siempre envía
// mensaje al grupo avisando con un buen copy que ya está solucionado».
// Compare-and-set sobre el estado (sólo cierra si sigue en el estado que se leyó), deja la respuesta que ve el cliente en
// /tickets y una nota del Cerebro en el historial. El aviso al grupo va aparte (scripts/avisar-arreglo-al-grupo.mts).
// Uso: node scripts/tickets-cerrar-resueltos.mjs <.env.local> <archivo.json con [{ id, respuesta, nota }]>
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(process.argv[2], 'utf8').split(/\r?\n/)
  .filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const pedido = async (metodo, q, cuerpo) => {
  const r = await fetch(`${URL_}/rest/v1/${q}`, { method: metodo, headers: h, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (!r.ok) throw new Error(`${metodo} ${q.split('?')[0]}: ${r.status} ${await r.text()}`);
  return r.json();
};

const lista = JSON.parse(readFileSync(process.argv[3], 'utf8'));
for (const t of lista) {
  const [fila] = await pedido('GET', `tickets?select=id,estado&id=eq.${t.id}`);
  if (!fila) { console.log(`#${t.id}: no existe`); continue; }
  if (fila.estado === 'resuelto') { console.log(`#${t.id}: ya estaba resuelto`); continue; }
  const ahora = new Date().toISOString();
  const hecho = await pedido('PATCH', `tickets?id=eq.${t.id}&estado=eq.${fila.estado}`,
    { estado: 'resuelto', resuelto_at: ahora, respuesta: t.respuesta.slice(0, 2000), avisado_at: null, updated_at: ahora });
  if (!hecho.length) { console.log(`#${t.id}: cambió mientras tanto (${fila.estado}), no lo toqué`); continue; }
  await pedido('POST', 'ticket_eventos', { ticket_id: t.id, actor: 'cerebro', tipo: 'nota', texto: t.nota.slice(0, 2000) });
  console.log(`#${t.id}: ${fila.estado} → resuelto`);
}
