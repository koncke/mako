// =============================================================================
// api-mako/docs — la referencia de la API, GENERADA del registro
// =============================================================================
// La sirve GET /api/v1/docs y la escribe scripts/generar-api-doc.mjs en
// docs/api-mako.md, con `--check` en el pre-push. No se edita a mano: lo que se
// escribe a mano se queda viejo el día que alguien agrega una operación (es el bug
// del contrato del `detalle`, otra vez).
//
// Documenta lo que sale por HTTP (`canales` incluye 'http'). Lo que solo existe
// por WhatsApp o en la app no es parte de la API pública.
//
// Español NEUTRO: esto lo lee un cliente. Hay un test de voseo sobre todo lib/.
// SIN `server-only`: lo importa el script generador desde node.
// =============================================================================

import { AREAS, AREA_INFO, ALCANCES, esAccion, esControl, esLectura, alcanceMinimo, type OperacionDef, type Parametro } from './tipos';
import { TEXTO_ALCANCE } from './alcance';
import { porArea } from './registro';

const fila = (celdas: string[]) => `| ${celdas.map((c) => c.replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`;

function tablaParametros(ps: readonly Parametro[]): string {
  if (!ps.length) return '_Sin parámetros._';
  const out = [fila(['Parámetro', 'Tipo', 'Obligatorio', 'Descripción']), fila(['---', '---', '---', '---'])];
  const agregar = (p: Parametro, prefijo: string) => {
    const tipo = p.enum?.length ? `${p.tipo} (${p.enum.join(' \\| ')})` : p.tipo;
    out.push(fila([`\`${prefijo}${p.nombre}\``, tipo, p.obligatorio ? 'sí' : 'no', p.descripcion]));
    for (const c of p.campos ?? []) agregar(c, `${prefijo}${p.nombre}.`);
  };
  for (const p of ps) agregar(p, '');
  return out.join('\n');
}

function ejemploCurl(d: OperacionDef, base: string): string {
  const ruta = `${base}/api/v1/${d.area}/${d.id}`;
  if (esLectura(d)) {
    const qs = d.parametros.filter((p) => p.obligatorio).map((p) => `${p.nombre}=${encodeURIComponent(String(p.ejemplo ?? '…'))}`).join('&');
    return `curl -s "${ruta}${qs ? `?${qs}` : ''}" -H "Authorization: Bearer $TOKEN"`;
  }
  const body: Record<string, unknown> = {};
  for (const p of d.parametros) if (p.obligatorio || p.ejemplo !== undefined) body[p.nombre] = p.ejemplo ?? (p.tipo === 'number' ? 0 : p.tipo === 'boolean' ? true : p.tipo.endsWith('[]') ? [] : '…');
  return `curl -s -X POST "${ruta}" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\\n  --data-binary '${JSON.stringify(body)}'`;
}

function seccionOperacion(d: OperacionDef, base: string): string {
  const metodo = esLectura(d) ? 'GET' : 'POST';
  const l: string[] = [];
  l.push(`### \`${metodo} /api/v1/${d.area}/${d.id}\` — ${d.titulo}`);
  l.push('');
  l.push(d.descripcion);
  l.push('');
  l.push(`- **Alcance mínimo del token:** ${alcanceMinimo(d)}`);
  if (esAccion(d)) {
    l.push(`- **Confirmación:** ${d.confirmacion === 'chat'
      ? 'queda **pendiente** (vence a las 2 h). La confirma una persona en la bandeja de MaKo o por WhatsApp; un token con alcance `ejecutar` puede confirmarla con `POST /api/v1/mako/confirmar_accion`.'
      : `deja una **propuesta** y devuelve un **link** (${d.pantalla ?? '/mako/revisar'}) a la pantalla donde una persona la revisa, la corrige y la confirma.`}`);
    l.push(`- **Escribe:** ${d.escribe}`);
    l.push(`- **Reversible:** ${d.reversible ? 'sí' : 'no'}`);
  } else if (esLectura(d)) {
    l.push(`- **Devuelve:** ${d.salida}${d.formatos?.length ? ` (también \`?formato=\` ${d.formatos.join(' | ')})` : ''}`);
  } else if (esControl(d)) {
    l.push('- **Control:** corre directo sobre una pendiente ya existente.');
  }
  l.push(`- **Costo:** ${d.costo}${d.lenta ? ' · puede tardar' : ''}`);
  if (d.gating?.soloWs1) l.push('- **Solo el workspace principal.**');
  if (d.gating?.rolMinimo) l.push('- **Solo el administrador del workspace.**');
  if (d.gating?.integracion) l.push(`- **Requiere conectada:** ${d.gating.integracion}`);
  if (d.gating?.tab) l.push(`- **Requiere la tab:** ${d.gating.tab}`);
  if (d.alias?.length) l.push(`- **También responde como:** ${d.alias.map((a) => `\`${a}\``).join(', ')}`);
  l.push('');
  l.push(tablaParametros(d.parametros));
  l.push('');
  l.push('```bash');
  l.push(ejemploCurl(d, base));
  l.push('```');
  l.push('');
  return l.join('\n');
}

const porHttp = (area: (typeof AREAS)[number]) => porArea(area).filter((d) => d.canales.includes('http'));

/** La referencia entera. `base` es la URL de la app (sin barra final). */
export function referenciaMarkdown(base: string): string {
  const b = base.replace(/\/+$/, '');
  const out: string[] = [];
  out.push('# API de MaKo — referencia');
  out.push('');
  out.push('> Generada de `lib/api-mako/areas/*.def.ts` por `scripts/generar-api-doc.mjs`. No la edites a mano: cambia la definición y regenera.');
  out.push('');
  out.push('## Cómo se usa');
  out.push('');
  out.push('- **Autenticación:** `Authorization: Bearer <token>`. El token se genera en **Integraciones → Claude** de MaKo y es de UN workspace: no hay forma de pedir los datos de otro.');
  out.push('- **Alcance del token** (se elige al generarlo):');
  for (const a of ALCANCES) out.push(`  - \`${a}\` — **${TEXTO_ALCANCE[a].titulo}.** ${TEXTO_ALCANCE[a].que}`);
  out.push('- **Catálogo:** `GET /api/v1` devuelve, para tu token, todas las operaciones con sus parámetros. Empieza por ahí: lo que no aparece, no existe para ese token.');
  out.push('- **Lecturas:** `GET /api/v1/{area}/{operacion}?param=valor`. La respuesta trae `Content-Type` según la salida (`application/json`, `text/markdown`, `text/csv` o `text/plain`).');
  out.push('- **Acciones:** `POST /api/v1/{area}/{operacion}` con el cuerpo en JSON. Ninguna escribe directo: devuelve una **pendiente** (la confirma una persona en MaKo o por WhatsApp) o una **propuesta** con un link a la pantalla donde se revisa.');
  out.push('- **Pendientes:** `GET /api/v1/mako/listar_pendientes` lista las vigentes; `POST /api/v1/mako/cancelar_accion` descarta una; `POST /api/v1/mako/confirmar_accion` la ejecuta, solo con alcance `ejecutar` y siempre con su `id`.');
  out.push('- **Errores:** siempre `{ ok: false, error }`, con `faltan` (parámetros) o `disponibles` (qué sí se puede pedir) cuando ayuda. 400 es tuyo, 401 es el token, 404 no existe para este token, 429 es el ritmo, 500 es nuestro.');
  out.push('- **Cuerpos con acentos:** manda el JSON desde un archivo (`--data-binary @archivo.json`), no inline en la shell.');
  out.push('- **Tope del cuerpo:** 256 KB. Los textos cortan en 4000 caracteres y las listas en 200 ítems salvo que la operación declare otro tope.');
  out.push('');
  out.push('## Índice');
  out.push('');
  for (const area of AREAS) {
    const ops = porHttp(area);
    if (!ops.length) continue;
    out.push(`- **${AREA_INFO[area].titulo}** (\`${area}\`): ${ops.map((d) => `\`${d.id}\``).join(' · ')}`);
  }
  out.push('');
  for (const area of AREAS) {
    const ops = porHttp(area);
    if (!ops.length) continue;
    out.push(`## ${AREA_INFO[area].titulo} — \`${area}\``);
    out.push('');
    out.push(`Tab **${AREA_INFO[area].tab}** (\`${AREA_INFO[area].ruta}\`). ${ops.filter(esLectura).length} lecturas · ${ops.filter(esAccion).length} acciones${ops.some(esControl) ? ` · ${ops.filter(esControl).length} controles` : ''}.`);
    out.push('');
    for (const d of ops) out.push(seccionOperacion(d, b));
  }
  return out.join('\n');
}
