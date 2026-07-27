// =============================================================================
// Limpia el material viejo de "Branding MaKo" y sube el material de MARCA
// =============================================================================
// Uso:
//   node scripts/branding-limpiar-y-marca.mjs --dry-run
//   node scripts/branding-limpiar-y-marca.mjs
//
// (1) BORRA los gráficos de las features cuyas landings todavía tienen los
//     mockups autogenerados del build original. Quedan solo los que hicimos a
//     mano: funnel, crm y semáforo.
// (2) SUBE el material de marca: logotipo, insignia, letras y sus animaciones
//     con fondo transparente.
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local') });

const DRY = process.argv.includes('--dry-run');
const WS = 1;
const BUCKET = 'branding';
const A_MANO = ['funnel', 'crm', 'semaforo'];         // los únicos gráficos que sobreviven

const E = 'C:/Users/marti/OneDrive/Escritorio';
const M = `${E}/MaKo-Animacion`;

const MIMES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mov': 'video/quicktime' };
const mimeDe = (f) => MIMES[extname(f).toLowerCase()] || 'application/octet-stream';

// El material de marca, con nombres que se entienden solos.
const MARCA = [
  { f: `${M}/mako-animacion-completa.mov`, t: 'Animación completa de MaKo (fondo transparente)', g: 'animacion' },
  { f: `${M}/mako-animacion-completa.png`, t: 'Animación completa · cuadro final', g: 'animacion' },
  { f: `${M}/mako-logo-transparente.mov`, t: 'Logo de MaKo animado (fondo transparente)', g: 'animacion' },
  { f: `${M}/1920x1080/MaKo-1920x1080-insignia-blanca.mov`, t: 'Insignia blanca animada · 1920×1080', g: 'animacion' },
  { f: `${M}/1920x1080/MaKo-1920x1080-letras-blancas.mov`, t: 'Letras blancas animadas · 1920×1080', g: 'animacion' },
  { f: `${M}/1920x1080/MaKo-1920x1080-insignia-blanca.png`, t: 'Insignia blanca · 1920×1080', g: 'logo' },
  { f: `${M}/1920x1080/MaKo-1920x1080-letras-blancas.png`, t: 'Letras blancas · 1920×1080', g: 'logo' },
  { f: `${M}/MaKo-insignia-blanca.png`, t: 'Insignia blanca', g: 'logo' },
  { f: `${M}/MaKo-letras-blancas.png`, t: 'Letras blancas', g: 'logo' },
  { f: 'C:/Users/marti/Downloads/MaKo.svg', t: 'Logo de MaKo (vector)', g: 'logo' },
  { f: 'C:/Users/marti/Downloads/mako-logo.png', t: 'Logo de MaKo', g: 'logo' },
  { f: 'C:/Users/marti/Downloads/mako-estrella.png', t: 'Estrella de MaKo', g: 'logo' },
  { f: 'C:/Users/marti/Downloads/mako-logo-blanco.png', t: 'Logo de MaKo en blanco', g: 'logo' },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('faltan credenciales de Supabase'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

// ── 1. Qué se borra ─────────────────────────────────────────────────────────
const { data: viejos, error } = await sb.from('branding_assets')
  .select('id,grupo,archivo,storage_path,thumb_path,bytes')
  .eq('workspace_id', WS).eq('seccion', 'graficos');
if (error) { console.error(error.message); process.exit(1); }

const aBorrar = (viejos ?? []).filter((a) => !A_MANO.includes(a.grupo));
const sobreviven = (viejos ?? []).length - aBorrar.length;
const mb = (n) => (n / 1048576).toFixed(1);
console.log(`${DRY ? '[DRY-RUN] ' : ''}BORRAR: ${aBorrar.length} gráficos (${mb(aBorrar.reduce((a, b) => a + Number(b.bytes || 0), 0))} MB) · SOBREVIVEN: ${sobreviven} (${A_MANO.join(', ')})`);

// ── 2. Qué se sube ──────────────────────────────────────────────────────────
const marca = MARCA.filter((m) => existsSync(m.f));
const faltan = MARCA.filter((m) => !existsSync(m.f)).map((m) => basename(m.f));
console.log(`SUBIR marca: ${marca.length} piezas (${mb(marca.reduce((a, b) => a + statSync(b.f).size, 0))} MB)${faltan.length ? ` · no encontradas: ${faltan.join(', ')}` : ''}`);

if (DRY) { console.log('(no se tocó nada)'); process.exit(0); }

// ── Borrado ─────────────────────────────────────────────────────────────────
if (aBorrar.length) {
  const paths = aBorrar.flatMap((a) => [a.storage_path, a.thumb_path].filter(Boolean));
  for (let i = 0; i < paths.length; i += 100) {
    const { error: e } = await sb.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (e) console.error('  ✖ storage:', e.message);
  }
  const ids = aBorrar.map((a) => a.id);
  for (let i = 0; i < ids.length; i += 100) {
    const { error: e } = await sb.from('branding_assets').delete().eq('workspace_id', WS).in('id', ids.slice(i, i + 100));
    if (e) console.error('  ✖ tabla:', e.message);
  }
  console.log(`  borrados ${aBorrar.length} gráficos viejos`);
}

// ── Subida de la marca ──────────────────────────────────────────────────────
let ok = 0, fail = 0;
for (const [i, m] of marca.entries()) {
  const archivo = basename(m.f);
  const id = `marca-${m.g}-${basename(archivo, extname(archivo))}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 120);
  const path = `${WS}/marca/${archivo}`;
  try {
    const up = await sb.storage.from(BUCKET).upload(path, readFileSync(m.f), { contentType: mimeDe(archivo), upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { error: e } = await sb.from('branding_assets').upsert({
      id, workspace_id: WS, seccion: 'marca', grupo: m.g, archivo, titulo: m.t,
      mime: mimeDe(archivo), bytes: statSync(m.f).size, storage_path: path, thumb_path: null,
      panda_embed: null, orden: i,
    }, { onConflict: 'workspace_id,id' });
    if (e) throw new Error(e.message);
    ok++;
  } catch (err) { fail++; console.error('  ✖', archivo, '-', err.message); }
}
console.log(`LISTO — marca: ${ok} subidas, ${fail} fallos`);

const { count } = await sb.from('branding_assets').select('id', { count: 'exact', head: true }).eq('workspace_id', WS);
console.log(`catálogo final: ${count} piezas`);
