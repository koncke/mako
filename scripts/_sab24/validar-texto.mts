// Valida un texto de aviso de arreglo con las reglas del script (largo, groserías, promesas). No manda nada.
import { readFileSync } from 'node:fs';
import { textoDelAviso } from '../../lib/aviso-arreglo-reglas';
for (const f of process.argv.slice(2)) {
  const t = readFileSync(f, 'utf8');
  const v = textoDelAviso(t);
  console.log(`${f}: ${t.trim().length} caracteres → ${v.ok ? 'PASA' : `NO PASA: ${v.error}`}`);
}
