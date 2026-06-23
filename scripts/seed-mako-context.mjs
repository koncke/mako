// =============================================================================
// seed-mako-context — siembra conocimiento + fases + perfil de ejemplo
// =============================================================================
// Uso: node scripts/seed-mako-context.mjs
// - Conocimiento: solo si mako_knowledge está vacía (embebe con OpenAI).
// - Fases y perfil: ON CONFLICT DO NOTHING (no pisa lo que ya hayas editado).

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';
import { createHash } from 'node:crypto';

const DB = process.env.DATABASE_URL;
const OAI_KEY = process.env.OPENAI_API_KEY;
if (!DB) { console.error('Falta DATABASE_URL en .env.local'); process.exit(1); }

const sql = postgres(DB, { ssl: 'require', max: 1 });
const sha = (s) => createHash('sha256').update(s).digest('hex');

async function embed(text) {
  if (!OAI_KEY) return null;
  try {
    const r = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
    });
    const j = await r.json();
    if (j.error) { console.warn('  embed error:', j.error.message); return null; }
    return j.data[0].embedding;
  } catch (e) { console.warn('  embed fail:', e.message); return null; }
}

const KNOWLEDGE = [
  { titulo: 'Framework de anuncio ganador', categoria: 'Ads', cuerpo: 'Un anuncio gana cuando: (1) el hook frena el scroll en los primeros 3 segundos hablándole al dolor real del avatar, (2) la oferta es clara y la promesa específica, (3) hay prueba o autoridad, y (4) el CTA es uno solo. Si el CTR de link es bajo, el problema casi siempre es el hook; si hay clics pero no agendas, es la oferta o la landing.' },
  { titulo: 'El orden importa: oferta → adquisición → sistematización → escala', categoria: 'Estrategia', cuerpo: 'El orden importa más que las tácticas. Primero la oferta (que convierta), después la adquisición (tráfico que rinda), después la sistematización (que no dependa del dueño) y recién ahí la escala. Escalar antes de tener oferta y sistema es tirar plata.' },
  { titulo: 'El play del VSL en landing rinde menos del 16%', categoria: 'Funnel', cuerpo: 'De los que llegan a la landing, menos del 16% le da play al VSL. Es uno de los cuellos más caros del funnel: si subimos ese número baja el costo por agenda sin tocar el ad spend. Palancas: el copy arriba del video, la miniatura y la promesa del primer frame.' },
  { titulo: 'CPM en LATAM: México es Tier 2 (~$3.92 USD)', categoria: 'Ads · Benchmark', cuerpo: 'Referencia de CPM en LATAM: México es Tier 2, con CPM en torno a $3.92 USD. Sirve para juzgar si un CPM está caro o barato según el país y la audiencia antes de pausar un anuncio solo por costo.' },
  { titulo: 'Dolores del avatar (Carlos)', categoria: 'Avatar', cuerpo: 'El avatar (Carlos) es un emprendedor que factura pero sigue siendo el cuello de botella de todo: vende, opera y apaga incendios. Quiere un negocio que funcione sin él. Su miedo es invertir y que no funcione otra vez; su objeción típica es "no tengo tiempo" o "ya probé otras cosas".' },
  { titulo: 'Velocidad, facilidad, honestidad: solo elegís dos', categoria: 'Filosofía', cuerpo: 'De velocidad, facilidad y honestidad solo se eligen dos. Acá elegimos velocidad y honestidad: es real, no es fácil. Sirve para setear expectativas y para no vender humo.' },
];

const FASES = {
  general: 'Lectura rápida del estado del negocio y el foco de la semana.',
  crm: 'Por qué un lead está trabado y la próxima acción.',
  marketing: 'Dónde se cae la adquisición y si el gasto rinde (CPM/CPC, CTR, costo por landing y por VSL).',
  comercial: 'Dónde se enfría el funnel: J1→J2, no-show, tasa de cierre.',
  closing: 'Qué mejorar en las llamadas de cierre.',
};

const ANSWERS = {
  oferta_nombre: 'Negocio que Escala™ — coaching B2B para emprendedores',
  funnel_etapas: 'Meta Lead Ads → VSL → Calendly → llamada de ventas',
  funnel_fuente: 'Meta Lead Ads',
  avatar_dolor: 'Factura pero sigue siendo el cuello de botella de todo',
  avatar_objecion: 'No tengo tiempo / ya probé otras cosas',
  negocio_nicho: 'Consultoría / coaching B2B',
};

// 1. Conocimiento (solo si la tabla está vacía).
const [{ n }] = await sql`select count(*)::int as n from mako_knowledge`;
if (n === 0) {
  for (const k of KNOWLEDGE) {
    const v = await embed(k.cuerpo);
    await sql`insert into mako_knowledge (titulo, categoria, cuerpo, activo, embedding, content_hash, estado)
      values (${k.titulo}, ${k.categoria}, ${k.cuerpo}, true, ${v ? sql.json(v) : null}, ${v ? sha(k.cuerpo) : null}, ${v ? 'indexado' : 'pendiente'})`;
    console.log(`  + ${k.titulo} ${v ? '(indexado)' : '(pendiente)'}`);
  }
  console.log(`Conocimiento: sembradas ${KNOWLEDGE.length} entradas.`);
} else {
  console.log(`Conocimiento: mako_knowledge ya tiene ${n} filas — no se siembra.`);
}

// 2. Fases (no pisa lo editado).
for (const [k, val] of Object.entries(FASES)) {
  await sql`insert into app_settings (key, value, updated_at) values (${'mako.fase.' + k}, ${val}, now()) on conflict (key) do nothing`;
}
console.log('Fases: defaults sembrados (sin pisar lo editado).');

// 3. Perfil del negocio (no pisa lo editado).
await sql`insert into app_settings (key, value, updated_at) values ('mako.onboarding.answers', ${JSON.stringify(ANSWERS)}, now()) on conflict (key) do nothing`;
console.log('Onboarding: perfil de ejemplo sembrado (sin pisar lo editado).');

await sql.end();
console.log('Seed OK.');
