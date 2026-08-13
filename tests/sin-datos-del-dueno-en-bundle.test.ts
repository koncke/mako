// =============================================================================
// Ningún módulo de CLIENTE puede traer datos de UNA persona adentro
// =============================================================================
// Un módulo `'use client'` viaja en el bundle y no tiene noción de workspace: lo
// que escribas ahí se le sirve IGUAL a todos los clientes. Cualquier dato que
// dependa de quién está mirando tiene que venir del server.
//
// El caso, del 13/08/2026, en producción: `app/crm/calendly-widget.ts` tenía
//
//     agenda:   'https://calendly.com/mauriciobustoseguia/60min'
//     agendaj2: 'https://calendly.com/mauriciobustoseguia/calificacion-…'
//
// así que el botón «Agendarla por Calendly» del CRM de una clienta abría la
// agenda de OTRO cliente —con su nombre, su foto y el título de su oferta— y su
// prospecto reservaba en el calendario ajeno. Ella no se enteraba nunca: la
// reserva entra por el event type del otro, el webhook la rutea al workspace del
// otro, y en el de ella la fecha no aparece jamás.
//
// El compilador no puede ver esto y ninguna review lo miró en meses.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Todos los .ts/.tsx bajo app/ y lib/ (sin node_modules ni tests). */
function fuentes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fuentes(p, out);
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

/**
 * Agendas PERSONALES de Calendly: `calendly.com/<quien>/<evento>`.
 *
 * No matchea `assets.calendly.com` (el CDN del widget), `api.calendly.com` (la
 * API) ni `calendly.com/integrations/…` (documentación), que no son de nadie.
 */
const AGENDA_PERSONAL = /(?<!assets\.)(?<!api\.)(?<!developer\.)calendly\.com\/(?!integrations\/|app\/)[a-z0-9][a-z0-9-]*\/[a-z0-9-]+/i;

/**
 * La única excepción, y por qué NO es el mismo caso.
 *
 * `/vsl` es la landing PÚBLICA donde MaKo se vende a sí mismo: no vive adentro
 * del workspace de nadie, no la abre ningún cliente desde su CRM, y la agenda que
 * ofrece es la del dueño porque la reunión es CON el dueño. El bug era servirle a
 * un cliente la agenda de otro dentro de su propia herramienta.
 *
 * Se lista por ruta exacta a propósito: una excepción por carpeta se convierte
 * sola en la regla el día que alguien crea un archivo al lado.
 */
const PERMITIDOS = new Set(['app/vsl/Landing.tsx']);

test('ningún módulo de cliente trae una agenda personal de Calendly hardcodeada', () => {
  const culpables: string[] = [];
  for (const f of fuentes(join(RAIZ, 'app'))) {
    if (PERMITIDOS.has(relative(RAIZ, f).replace(/\\/g, '/'))) continue;
    const src = readFileSync(f, 'utf8');
    if (!/^\s*['"]use client['"]/m.test(src)) continue;
    // El comentario que explica el bug menciona la URL vieja: se ignora el texto
    // de los comentarios, que es donde vive la memoria de por qué esto existe.
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const m = codigo.match(AGENDA_PERSONAL);
    if (m) culpables.push(`${relative(RAIZ, f)} → ${m[0]}`);
  }
  assert.deepEqual(
    culpables, [],
    'Un módulo de cliente no tiene workspace: esa agenda se le sirve a TODOS los clientes. ' +
    'La URL la tiene que resolver el server contra la cuenta del workspace (ver linkDeAgendaAction).\n' +
    culpables.join('\n'),
  );
});

test('el CRM resuelve la agenda por workspace, no por una constante', () => {
  const widget = readFileSync(join(RAIZ, 'app/crm/calendly-widget.ts'), 'utf8');
  // Sin comentarios: el comentario de cabecera NOMBRA a `CAL_URLS` para contar
  // qué pasó, y esa memoria es justo lo que no hay que borrar para que pase el test.
  const codigo = widget.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/CAL_URLS/.test(codigo), 'volvió el mapa de URLs en el bundle');
  assert.ok(
    /export async function openCalendlyEn\(\s*url: string/.test(widget),
    'la URL tiene que ser un parámetro OBLIGATORIO: sin default, ningún call-site puede abrir «la agenda de alguien» sin decir de quién',
  );
  const page = readFileSync(join(RAIZ, 'app/crm/page.tsx'), 'utf8');
  assert.ok(/calendlyStages/.test(page), 'qué etapas se agendan por Calendly lo decide el server, con la config del cliente');
});
