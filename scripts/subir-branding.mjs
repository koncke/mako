// =============================================================================
// Sube el material de marca a Supabase Storage y arma el catálogo (mig 0098)
// =============================================================================
// Uso:
//   node scripts/subir-branding.mjs --dry-run     (no toca nada: solo el plan)
//   node scripts/subir-branding.mjs               (sube de verdad)
//   node scripts/subir-branding.mjs --seccion=iconos
//
// Corre LOCAL y habla directo con Storage: sumar material no cuesta un deploy.
// Es idempotente — se puede volver a correr y solo pisa lo que cambió.
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, extname, basename } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local') });

const DRY = process.argv.includes('--dry-run');
const SOLO = (process.argv.find((a) => a.startsWith('--seccion=')) || '').split('=')[1] || null;
const WS = 1;                                   // material de la agencia (workspace del dueño)
const BUCKET = 'branding';

const ESCRITORIO = 'C:/Users/marti/OneDrive/Escritorio';
const G = `${ESCRITORIO}/MaKo-Graficos`;
const I = `${ESCRITORIO}/MaKo-Iconos`;
const V = `${ESCRITORIO}/MaKo-VSL`;

const MIMES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mov': 'video/quicktime' };
const mimeDe = (f) => MIMES[extname(f).toLowerCase()] || 'application/octet-stream';

// ── Títulos legibles: el nombre del archivo no se le muestra crudo a nadie ──
const FEATURES = {
  funnel: 'Funnel', crm: 'CRM', semaforo: 'Semáforo', dashboard: 'Dashboard', ads: 'Ads Manager',
  script: 'Ads Analyst', closing: 'Closing Analyst', cobranza: 'Cobranza', contrato: 'Contrato',
  whatsapp: 'WhatsApp', email: 'Email', mako: 'MaKo consultor', retro: 'Retro', experimentos: 'Experimentos',
  prioridades: 'Prioridades', pipeline: 'Embudo', onboarding: 'Onboarding', api: 'API de Meta',
  seguimiento: 'Seguimiento', customer: 'Customer Success', 'fase-norte': 'Fase y Norte',
  conocimiento: 'Conocimiento', integraciones: 'Integraciones', equipo: 'Equipo', 'perfil-reportes': 'Reportes',
};
const linda = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

function tituloGrafico(archivo) {
  const base = archivo.replace(/\.png$/i, '');
  const [feature, , ...tipo] = base.split('-');
  return `${FEATURES[feature] || linda(feature)} · ${linda(tipo.join(' '))}`;
}

// ── Inventario ──────────────────────────────────────────────────────────────
function inventario() {
  const items = [];
  const push = (o) => { if (!SOLO || o.seccion === SOLO) items.push(o); };

  // 1. Gráficos de las landings (+ su miniatura, que pesa 20× menos)
  if (existsSync(`${G}/landings`)) {
    readdirSync(`${G}/landings`).filter((f) => f.endsWith('.png')).sort().forEach((f, i) => {
      const mini = `${G}/miniaturas/${f.replace(/\.png$/i, '.jpg')}`;
      push({
        seccion: 'graficos', grupo: f.split('-')[0], archivo: f, titulo: tituloGrafico(f),
        local: `${G}/landings/${f}`, localThumb: existsSync(mini) ? mini : null, orden: i,
      });
    });
  }
  // 2. Animaciones sacadas de los VSL
  if (existsSync(`${G}/animaciones-video`)) {
    readdirSync(`${G}/animaciones-video`).filter((f) => f.endsWith('.mp4')).sort().forEach((f, i) => {
      push({ seccion: 'animaciones', grupo: 'video', archivo: f, titulo: linda(f.replace(/\.mp4$/i, '')), local: `${G}/animaciones-video/${f}`, orden: i });
    });
  }
  // 3. Íconos y logos
  ['iconos', 'iconos-con-nombre', 'logos-originales'].forEach((sub) => {
    if (!existsSync(`${I}/${sub}`)) return;
    readdirSync(`${I}/${sub}`).sort().forEach((f, i) => {
      push({ seccion: 'iconos', grupo: sub, archivo: f, titulo: linda(basename(f, extname(f))), local: `${I}/${sub}/${f}`, orden: i });
    });
  });
  // 4. Los mini-VSL: se VEN por Panda y se DESCARGAN de acá
  const PANDA = 'https://player-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=';
  [
    { f: `${V}/funnel/video/MaKo-funnel-VSL-COMPLETO.mp4`, t: 'VSL · Tu funnel en un solo lugar', e: `${PANDA}8d035c87-3767-4b84-8a3d-da41efc6524f` },
    { f: `${V}/crm/video/MaKo-CRM-VSL-v1.mp4`, t: 'VSL · CRM Automatizado', e: `${PANDA}018788b3-453e-496c-86c1-124bae1fea4c` },
    { f: `${V}/semaforo/video/MaKo-Semaforo-VSL-v1.mp4`, t: 'VSL · Semáforo del Negocio', e: `${PANDA}8b1d420a-00bd-4f18-9c6a-730067a5125c` },
  ].forEach((v, i) => {
    if (!existsSync(v.f)) return;
    push({ seccion: 'videos', grupo: 'mini-vsl', archivo: basename(v.f), titulo: v.t, local: v.f, embed: v.e, orden: i });
  });

  return items;
}

// ── Main ────────────────────────────────────────────────────────────────────
const items = inventario();
const total = items.reduce((a, b) => a + statSync(b.local).size, 0);
const porSeccion = {};
items.forEach((i) => { porSeccion[i.seccion] = (porSeccion[i.seccion] || 0) + 1; });
console.log(`${DRY ? '[DRY-RUN] ' : ''}${items.length} piezas · ${(total / 1048576).toFixed(1)} MB`);
console.log(porSeccion);

if (DRY) {
  items.slice(0, 3).forEach((i) => console.log('  ej:', i.seccion, '|', i.titulo, '|', i.archivo));
  console.log('(no se escribió nada)');
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

let ok = 0, fail = 0;
for (const it of items) {
  const id = `${it.seccion}-${it.grupo}-${basename(it.archivo, extname(it.archivo))}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 120);
  const path = `${WS}/${it.seccion}/${it.archivo}`;
  try {
    const buf = readFileSync(it.local);
    const up = await sb.storage.from(BUCKET).upload(path, buf, { contentType: mimeDe(it.archivo), upsert: true });
    if (up.error) throw new Error(up.error.message);

    let thumb = null;
    if (it.localThumb) {
      thumb = `${WS}/thumbs/${basename(it.localThumb)}`;
      const t = await sb.storage.from(BUCKET).upload(thumb, readFileSync(it.localThumb), { contentType: 'image/jpeg', upsert: true });
      if (t.error) thumb = null;
    }

    const row = {
      id, workspace_id: WS, seccion: it.seccion, grupo: it.grupo, archivo: it.archivo, titulo: it.titulo,
      mime: mimeDe(it.archivo), bytes: statSync(it.local).size, storage_path: path, thumb_path: thumb,
      panda_embed: it.embed || null, orden: it.orden,
    };
    const { error } = await sb.from('branding_assets').upsert(row, { onConflict: 'workspace_id,id' });
    if (error) throw new Error(error.message);
    ok++;
    if (ok % 25 === 0) console.log(`  ${ok}/${items.length}…`);
  } catch (e) {
    fail++; console.error('  ✖', it.archivo, '-', e.message);
  }
}
console.log(`LISTO — ${ok} subidas, ${fail} fallos`);
