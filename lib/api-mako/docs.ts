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
// Desde el 08/10/2026 («copialo todo de GitHub, tal cual») cada operación se documenta por
// su ruta REST (lib/api-mako/rest.ts), con el permiso que pide a un token detallado y el
// ejemplo de lib/api-mako/ejemplos.ts (el mismo que muestra la pantalla). La ruta por
// operación de siempre se nombra al lado: sigue andando.
//
// Español NEUTRO: esto lo lee un cliente. Hay un test de voseo sobre todo lib/.
// SIN `server-only`: lo importa el script generador desde node.
// =============================================================================

import { AREAS, AREA_INFO, ALCANCES, esAccion, esControl, esLectura, alcanceMinimo, type OperacionDef, type Parametro } from './tipos';
import { TEXTO_ALCANCE } from './alcance';
import { porArea } from './registro';
import { rutaRestDe } from './rest';
import { ejemplosDe } from './ejemplos';
import { nivelRequerido, permisoAceptado } from './permisos';
import { VERSION_API, TOPE_POR_MINUTO_WS, TOPE_POR_MINUTO_IP, TOPE_CUERPO_BYTES } from './version';

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

/** El curl de una operación (el de la pantalla: ruta REST, encabezados de GitHub). */
export function ejemploCurl(d: OperacionDef, base: string): string {
  return ejemplosDe(d, base)?.curl ?? '';
}

function seccionOperacion(d: OperacionDef, base: string): string {
  const metodo = esLectura(d) ? 'GET' : 'POST';
  const rest = rutaRestDe(d.id);
  const l: string[] = [];
  l.push(`### \`${rest ? `${rest.metodo} /api/v1${rest.ruta}` : `${metodo} /api/v1/${d.area}/${d.id}`}\` — ${d.titulo}`);
  l.push('');
  l.push(d.descripcion);
  l.push('');
  if (rest) l.push(`- **Ruta por operación:** \`${metodo} /api/v1/${d.area}/${d.id}\``);
  l.push(`- **Token detallado:** permiso \`${permisoAceptado(d)}\` (${nivelRequerido(d) === 'lectura' ? 'Solo lectura' : 'Lectura y escritura'} en «${AREA_INFO[d.area].titulo}»)`);
  l.push(`- **Token clásico:** alcance mínimo ${alcanceMinimo(d)}`);
  if (esAccion(d)) {
    l.push(`- **Con un token detallado:** ${d.costo === 'dinero'
      ? 'gasta dinero, así que queda como **propuesta** (202) y la confirma una persona en la pantalla del link.'
      : 'lo hace **en el acto** (200, `{ ok, hecho, resumen }`).'}`);
    l.push(`- **Con el token clásico:** ${d.confirmacion === 'chat'
      ? 'queda **pendiente** (202, vence a las 2 h). La confirma una persona en la bandeja de MaKo o por WhatsApp; un token clásico con alcance `ejecutar` puede confirmarla con `POST /api/v1/mako/confirmar_accion`.'
      : `deja una **propuesta** (202) y devuelve un **link** (${d.pantalla ?? '/mako/revisar'}) a la pantalla donde una persona la revisa, la corrige y la confirma.`}`);
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
  out.push('- **Autenticación:** `Authorization: Bearer <token>`. Cada token es de UN workspace: no hay forma de pedir los datos de otro. Dos clases, como en GitHub:');
  out.push('  - **Detallado** (`mako_pat_…`): se crea en la pantalla **API → Tokens** de MaKo, uno por integración. Tiene **permisos por área** (Sin acceso, Solo lectura o Lectura y escritura) y **vencimiento** (7, 30, 60 o 90 días, una fecha hasta un año, o sin vencimiento). Con escritura en un área, **escribe en el acto**; lo que gasta dinero queda igual como propuesta. Vale solo para `/api/v1`.');
  out.push('  - **Clásico** (`mkoag_…`): el de la skill de Claude, se genera en **Integraciones → Claude**. Un alcance para todo, y nunca escribe directo:');
  for (const a of ALCANCES) out.push(`    - \`${a}\` — **${TEXTO_ALCANCE[a].titulo}.** ${TEXTO_ALCANCE[a].que}`);
  out.push(`- **Versión:** \`X-MaKo-Api-Version: ${VERSION_API}\` (por fecha, como GitHub). Sin el encabezado se usa esa; una que no existe es 400. La respuesta trae \`X-MaKo-Api-Version-Selected\`.`);
  out.push('- **Encabezados:** `User-Agent` obligatorio (sin él, 403). `Accept: application/json` recomendado.');
  out.push('- **Catálogo:** `GET /api/v1` devuelve, para tu token, todas las operaciones con sus parámetros, su ruta REST y el permiso que piden. Empieza por ahí: lo que no aparece, no existe para ese token.');
  out.push('  - Entero es muy largo para un agente. `?compacto=1` trae solo el índice (id, método, ruta y título), `?area=crm,ads` solo esas áreas y `?operacion=<id>` una sola con todo. El camino barato: el índice, y después el detalle de la que vas a usar.');
  out.push('- **Rutas REST:** cada operación tiene una ruta por recurso con el verbo de GitHub (`GET` lee, `POST` crea, `PATCH` modifica, `PUT` fija un estado, `DELETE` borra), p. ej. `POST /api/v1/crm/leads/{leadId}/notas`. Lo que va entre llaves se reemplaza por el valor. La ruta por operación de siempre (`GET|POST /api/v1/{area}/{operacion}`) sigue andando.');
  out.push('- **Lecturas:** la respuesta trae `Content-Type` según la salida (`application/json`, `text/markdown`, `text/csv` o `text/plain`) y un `ETag`: con `If-None-Match` y sin cambios, 304.');
  out.push('- **Acciones:** con el cuerpo en JSON. Con un token detallado con escritura: 200 y `{ ok, hecho, resumen }`. Con el clásico, o si gasta dinero: 202 con una **pendiente** (la confirma una persona en MaKo o por WhatsApp) o una **propuesta** con un link a la pantalla donde se revisa.');
  out.push('- **Pendientes:** `GET /api/v1/mako/listar_pendientes` lista las vigentes; `POST /api/v1/mako/cancelar_accion` descarta una; `POST /api/v1/mako/confirmar_accion` la ejecuta, con su `id`.');
  out.push('- **Permisos que faltan:** 403 «Recurso no accesible con un token de acceso personal detallado», con `X-Accepted-MaKo-Permissions` diciendo cuál (p. ej. `crm=write`).');
  out.push(`- **Límites:** ${TOPE_POR_MINUTO_WS} pedidos por minuto por workspace (todos sus tokens) y ${TOPE_POR_MINUTO_IP} por IP. Cada respuesta trae \`x-ratelimit-limit\`, \`-remaining\`, \`-used\`, \`-reset\` y \`-resource\`; al pasarte, 429 con \`retry-after\`. \`GET /api/v1/rate_limit\` dice cuánto queda sin gastar un pedido.`);
  out.push('- **Errores:** `{ message, documentation_url, status }` (como GitHub) más `{ ok: false, error }`, con `faltan` (parámetros) o `disponibles` (qué sí se puede pedir) cuando ayuda. 400 es tuyo, 401 es el token (falta, no existe o venció), 403 un permiso, 404 no existe para este token, 422 no se pudo hacer, 429 es el ritmo, 5xx es nuestro (reporta el `X-MaKo-Request-Id`).');
  out.push('- **OpenAPI:** `GET /api/v1/openapi.json` (OpenAPI 3.1), para importar la API en n8n, Postman o un generador de SDK.');
  out.push('- **Cuerpos con acentos:** manda el JSON desde un archivo (`--data-binary @archivo.json`), no inline en la shell.');
  out.push(`- **Tope del cuerpo:** ${TOPE_CUERPO_BYTES / 1024} KB. Los textos cortan en 4000 caracteres y las listas en 200 ítems salvo que la operación declare otro tope.`);
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
