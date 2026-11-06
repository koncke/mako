// Genera app/admin/_polar/orbit/icons/material.tsx: los íconos de Material que usa Polar (la lista de Orbit,
// clients/packages/orbit/src/icons/material.ts) con los trazos de @mui/icons-material 7.3.11 (MIT). MaKo no carga @mui.
// Uso: node scripts/admin-polar-iconos.mjs <material.ts de Polar> <carpeta esm de @mui/icons-material> <salida.tsx> [Nombre=Fuente …]
// (npm pack @mui/icons-material@7.3.11 en una carpeta temporal y tar xzf: la carpeta esm es package/esm).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [lista, esm, salida, ...extra] = process.argv.slice(2);
const pares = [];
for (const m of readFileSync(lista, 'utf8').matchAll(/export \{ default as (\w+) \} from '@mui\/icons-material\/(\w+)'/g)) pares.push([m[1], m[2]]);
for (const e of extra) { const [n, f] = e.split('='); pares.push([n, f ?? n]); }

const elementos = (src) => {
  const out = [];
  for (const m of src.matchAll(/_jsx\("(\w+)", \{([\s\S]*?)\}(?:, "\d+")?\)/g)) {
    const attrs = {};
    for (const a of m[2].matchAll(/(\w+): ("[^"]*"|[\d.]+)/g)) attrs[a[1]] = a[2].startsWith('"') ? a[2].slice(1, -1) : a[2];
    out.push([m[1], attrs]);
  }
  return out;
};

const vistos = new Set();
let cuerpo = '';
for (const [nombre, fuente] of pares) {
  if (vistos.has(nombre)) continue;
  const f = join(esm, `${fuente}.js`);
  if (!existsSync(f)) { console.error('falta', fuente); continue; }
  const els = elementos(readFileSync(f, 'utf8'));
  if (!els.length) { console.error('sin path', fuente); continue; }
  vistos.add(nombre);
  const jsx = els.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k === 'fillOpacity' ? 'fillOpacity' : k}="${v}"`).join(' ')} />`).join('');
  cuerpo += `export const ${nombre} = icono('${nombre}', <>${jsx}</>)\n`;
}

const cabecera = `// Los íconos de Material que usa Polar (polarsource/polar, clients/packages/orbit/src/icons/material.ts, Apache-2.0), con los
// trazos de @mui/icons-material 7.3.11 (MIT, Material Icons de Google, Apache-2.0). Avisos: lib/avisos/LICENSE-POLAR y
// lib/avisos/LICENSE-MUI-ICONS. Se generan con scripts/admin-polar-iconos.mjs: MaKo no carga
// @mui/material, así que cada ícono es su <svg> con el mismo tamaño que el SvgIcon de MUI (1.5rem, o el fontSize pedido).
import * as React from 'react'

export type SvgIconProps = React.SVGProps<SVGSVGElement> & { fontSize?: 'inherit' | 'small' | 'medium' | 'large' }

const TAMANO = { inherit: 'inherit', small: '1.25rem', medium: '1.5rem', large: '2.1875rem' } as const

function icono(nombre: string, trazos: React.ReactNode) {
  const C = ({ fontSize = 'medium', style, className, ...props }: SvgIconProps) => (
    <svg
      viewBox="0 0 24 24"
      focusable="false"
      aria-hidden="true"
      fill="currentColor"
      className={className}
      style={{ width: '1em', height: '1em', display: 'inline-block', flexShrink: 0, userSelect: 'none', fontSize: TAMANO[fontSize], ...style }}
      {...props}
    >
      {trazos}
    </svg>
  )
  C.displayName = nombre
  return C
}

`;
writeFileSync(salida, cabecera + cuerpo);
console.log(`${vistos.size} íconos → ${salida}`);
