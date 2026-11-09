// =============================================================================
// «Guardar en MaKo» desde la extensión: el perfil abierto de Instagram o de LinkedIn, como lead del CRM (6/11/2026)
// =============================================================================
// Lo prometido a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md). Corre de verdad:
//   · extension/perfil-reglas.js y extension/perfil-leer.js, cargados como los carga Chrome (un script clásico en otro contexto);
//   · lib/perfil-captura.ts (qué se entiende del perfil), contra la regla del desplegable, caso por caso;
//   · lib/perfil-captura-db.ts y la ruta app/api/crm/extension, con sus vecinos de la base reemplazados (`server-only` no deja
//     importarlos de otra forma, y lo que corre tiene que ser lo que corre en producción).
//
// Probado rompiéndolo (6/11/2026), base 11/0:
//   · `leerPerfil` sin comparar la red de la captura con la de la dirección → 1 fallo, 10 pases;
//   · `nombreDeInstagram` sin exigir que el usuario entre paréntesis sea el de la dirección → 1 fallo, 10 pases;
//   · `guardarPerfil` sin mirar si el perfil ya estaba (saltea `yaGuardado`) → 2 fallos, 9 pases;
//   · `guardarPerfil` ignorando `aunqueSeLlameIgual` (frena siempre por un parecido) → 1 fallo, 10 pases;
//   · la ruta sin preguntar `negocioPausado` → 1 fallo, 10 pases;
//   · `perfil-reglas.js` aceptando `/explore/` de Instagram como perfil → 1 fallo, 10 pases (la paridad con el servidor).
//     (Sacarle `p` no lo nota: `/p/<código>/` ya cae porque el código no es una pestaña del perfil. No es la red.)

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { leerCapturaPerfil, leerPerfil, linkedinComparable, nombreDeInstagram, nombreDeLinkedin, nombreParaGuardar, perfilDeDireccion, type CapturaPerfil } from '../lib/perfil-captura';
import { canalDeEntrada } from '../app/crm/lead-view/ficha/resumen/logica';
import { esPublica } from '../lib/rutas-publicas';
import { esMasVieja } from '../lib/version-comparar';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const plano = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

// ── El desplegable y el servidor dicen lo mismo de una dirección ─────────────────────────────────

const reglas = runInNewContext(`${leer('extension/perfil-reglas.js')}; MakoPerfil`, { URL }) as {
  queHay: (u: string) => { red: string; usuario?: string; slug?: string } | null;
  detalle: (h: unknown) => string;
};

const DIRECCIONES: Array<[string, string | null]> = [
  ['https://www.instagram.com/ana.lopez/', 'instagram:ana.lopez'],
  ['https://instagram.com/Ana_Lopez', 'instagram:ana_lopez'],
  ['https://www.instagram.com/ana.lopez/reels/', 'instagram:ana.lopez'],
  ['https://www.instagram.com/ana.lopez/?hl=es', 'instagram:ana.lopez'],
  ['https://www.instagram.com/p/C1234567/', null],
  ['https://www.instagram.com/explore/', null],
  ['https://www.instagram.com/reel/C1234567/', null],
  ['https://www.instagram.com/accounts/edit/', null],
  ['https://www.instagram.com/ana.lopez/p/C123/', null],
  ['https://www.instagram.com/', null],
  ['http://www.instagram.com/ana.lopez/', null],
  ['https://www.linkedin.com/in/ana-lopez-123/', 'linkedin:ana-lopez-123'],
  ['https://es.linkedin.com/in/Ana-Lopez', 'linkedin:ana-lopez'],
  ['https://www.linkedin.com/in/ana-lopez-123/details/experience/', 'linkedin:ana-lopez-123'],
  ['https://www.linkedin.com/company/acme/', null],
  ['https://www.linkedin.com/feed/', null],
  ['https://www.linkedin.com/in/%E0%A4%A/', null],
  ['https://instagram.com.otro.com/ana/', null],
  ['https://web.whatsapp.com/', null],
];

test('el desplegable ofrece «Guardar en MaKo» exactamente donde el servidor ve un perfil', () => {
  for (const [url, esperado] of DIRECCIONES) {
    const s = perfilDeDireccion(url);
    const c = reglas.queHay(url);
    assert.equal(s ? `${s.red}:${s.id}` : null, esperado, `servidor: ${url}`);
    assert.equal(c ? `${c.red}:${c.usuario ?? c.slug}` : null, esperado, `desplegable: ${url}`);
  }
  assert.equal(perfilDeDireccion('https://instagram.com/Ana_Lopez')?.url, 'https://www.instagram.com/ana_lopez/', 'una sola forma');
  assert.equal(reglas.detalle({ red: 'instagram', usuario: 'ana' }), 'Crea el lead de @ana en tu CRM');
});

// ── El lector, como lo carga Chrome ────────────────────────────────────────────────────────────

function correrLector(href: string, doc: { titulo?: string; metas?: Record<string, string>; encabezados?: string[] } = {}) {
  const u = new URL(href);
  return plano(runInNewContext(leer('extension/perfil-leer.js'), {
    location: { href, hostname: u.hostname, pathname: u.pathname, search: u.search, origin: u.origin },
    document: {
      title: doc.titulo ?? '',
      querySelector: (q: string) => {
        const m = q.match(/^meta\[property="([^"]+)"\]$/);
        const v = m ? doc.metas?.[m[1]] : undefined;
        return v == null ? null : { getAttribute: (a: string) => (a === 'content' ? v : null) };
      },
      querySelectorAll: () => (doc.encabezados ?? []).map((t) => ({ textContent: t })),
      get cookie(): string { throw new Error('leyó las cookies'); },
      get forms(): never { throw new Error('leyó los formularios'); },
    },
    get localStorage(): never { throw new Error('leyó el almacenamiento'); },
    get fetch(): never { throw new Error('pidió algo a la red'); },
  }));
}

test('el lector devuelve el perfil sin la consulta de la dirección, y nada que no sea del perfil', () => {
  const c = correrLector('https://www.instagram.com/ana.lopez/?igsh=secreto&utm_source=x', {
    titulo: 'Ana López (@ana.lopez) • Fotos y videos de Instagram',
    metas: { 'og:title': 'Ana López (@ana.lopez) • Instagram photos and videos', 'og:image': 'https://scontent-xx.cdninstagram.com/v/f.jpg' },
    encabezados: ['ana.lopez', 'ana.lopez', 'Ana López'],
  });
  assert.equal(c.modo, 'perfil');
  assert.equal(c.red, 'instagram');
  assert.equal(c.url, 'https://www.instagram.com/ana.lopez/');
  assert.deepEqual(c.encabezados, ['ana.lopez', 'Ana López'], 'sin repetidos');
  assert.doesNotMatch(JSON.stringify(c), /secreto|utm_source/);
  assert.deepEqual(correrLector('https://www.facebook.com/ana/'), { modo: 'prohibido' }, 'fuera de Instagram y LinkedIn no lee nada');
  // Lo que el lector no hace, en su fuente: ni mueve la página, ni escribe, ni pide a la red.
  const src = sinComentarios(leer('extension/perfil-leer.js'));
  assert.doesNotMatch(src, /\.click\(|scroll|\.focus\(|\.value\b|cookie|localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|innerHTML|\.(append|remove|set)\w*\(/);
});

// ── Lo que se entiende del perfil ────────────────────────────────────────────────────────────────

const captura = (o: Partial<CapturaPerfil> = {}): CapturaPerfil => ({
  red: 'instagram', url: 'https://www.instagram.com/ana.lopez/', titulo: '', ogTitulo: '', ogDescripcion: '', ogImagen: '', encabezados: [], ...o,
});

test('el nombre de Instagram es el del perfil de la DIRECCIÓN, en inglés o en castellano', () => {
  assert.equal(nombreDeInstagram(captura({ ogTitulo: 'Ana López (@ana.lopez) • Instagram photos and videos' }), 'ana.lopez'), 'Ana López');
  assert.equal(nombreDeInstagram(captura({ titulo: 'Ana López (@ana.lopez) • Fotos y videos de Instagram' }), 'ana.lopez'), 'Ana López');
  assert.equal(nombreDeInstagram(captura({ ogDescripcion: '3M Followers, 1,234 Following - See Instagram photos and videos from Ana López (@ana.lopez)' }), 'ana.lopez'), 'Ana López');
  assert.equal(nombreDeInstagram(captura({ ogDescripcion: 'Ver fotos y videos de Instagram de María de la Cruz (@mdlc)' }), 'mdlc'), 'María de la Cruz', 'un nombre con «de»');
  assert.equal(nombreDeInstagram(captura({ ogTitulo: 'Ana (@otra) • Instagram photos and videos' }), 'ana.lopez'), null, 'el título nombra a otro usuario');
  assert.equal(nombreDeInstagram(captura({ ogTitulo: '(@ana.lopez) • Instagram photos and videos' }), 'ana.lopez'), null, 'sin nombre puesto');
});

test('el nombre de LinkedIn sale del título y gana el encabezado que lo repite', () => {
  assert.equal(nombreDeLinkedin({ titulo: '(3) Ana Lopez | LinkedIn', ogTitulo: '', encabezados: ['Ana López', 'Fundadora en ACME'] }), 'Ana López');
  assert.equal(nombreDeLinkedin({ titulo: 'Ana López - Fundadora - ACME | LinkedIn', ogTitulo: '', encabezados: [] }), 'Ana López');
  assert.equal(nombreDeLinkedin({ titulo: 'LinkedIn', ogTitulo: '', encabezados: ['Ana López'] }), 'Ana López');
  assert.equal(nombreDeLinkedin({ titulo: '', ogTitulo: '', encabezados: [] }), null);
});

test('el perfil sale de la dirección; una captura que dice otra red no es un perfil', () => {
  const ig = leerPerfil(captura({ ogTitulo: 'Ana López (@ana.lopez) • Instagram photos and videos', ogImagen: 'https://scontent-xx.cdninstagram.com/v/f.jpg' }));
  assert.deepEqual(ig, { red: 'instagram', id: 'ana.lopez', url: 'https://www.instagram.com/ana.lopez/', nombre: 'Ana López', foto: 'https://scontent-xx.cdninstagram.com/v/f.jpg' });
  assert.equal(leerPerfil(captura({ ogImagen: 'https://otro.com/f.jpg' }))?.foto, null, 'una foto que no es del CDN de Meta no se baja');
  assert.equal(leerPerfil(captura({ red: 'linkedin' })), null, 'red y dirección no coinciden');
  assert.equal(leerPerfil(captura({ url: 'https://www.instagram.com/p/C123/' })), null);
  assert.equal(leerCapturaPerfil({ modo: 'sitio', red: 'instagram' }), null);
  assert.equal(leerCapturaPerfil({ modo: 'perfil', red: 'tiktok' }), null);
  assert.equal(nombreParaGuardar('  Ana  ', 'Leído'), 'Ana');
  assert.equal(nombreParaGuardar('   ', 'Leído'), 'Leído', 'vacío en el desplegable: el leído');
  assert.equal(nombreParaGuardar('', null), null);
  assert.equal(linkedinComparable('linkedin.com/in/Ana-Lopez?trk=x'), 'ana-lopez');
  assert.equal(linkedinComparable('https://es.linkedin.com/in/ana-lopez/'), 'ana-lopez');
  assert.equal(linkedinComparable('ana-lopez'), null, 'un texto suelto no es un perfil');
});

// ── Lo que se escribe, con una base de mentira ───────────────────────────────────────────────────

type Lead = { id: number; nombre: string; instagram?: string | null; linkedin?: string | null };
const estado = {
  leads: [] as Lead[],
  altas: [] as Array<Record<string, unknown>>,
  fotos: [] as Array<[number, string]>,
  tope: false,
  pausado: false,
  workspaces: [] as number[],
};

const coincide = (a: string, b: string) => a.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() === b.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

class TopeFalso extends Error { constructor(readonly tope: number) { super(`Llegaste al tope de ${tope} leads de tu plan.`); } }

const falsos: Record<string, unknown> = {
  'server-only': {},
  leads: {
    duplicadosDeLead: async (c: { nombre?: string; instagram?: string }) => {
      const out: Array<{ lead: Lead; motivo: string; texto: string }> = [];
      for (const l of estado.leads) {
        if (c.instagram && l.instagram === c.instagram) out.push({ lead: l, motivo: 'instagram', texto: '' });
        else if (c.nombre && coincide(l.nombre, c.nombre)) out.push({ lead: l, motivo: 'nombre', texto: '' });
      }
      return out;
    },
    createLead: async (input: Record<string, unknown>) => {
      estado.altas.push(input);
      const l = { id: 900 + estado.altas.length, nombre: String(input.nombre) };
      estado.leads.push({ ...l, instagram: (input.instagram as string) ?? null, linkedin: (input.linkedin as string) ?? null });
      return l;
    },
  },
  'topes-crm': {
    frenarAltaPorTope: async () => { if (estado.tope) throw new TopeFalso(50); },
    TopeDelPlanError: TopeFalso,
  },
  'supabase-paginado': {
    leerTodo: async () => estado.leads.filter((l) => l.linkedin).map((l) => ({ id: l.id, nombre: l.nombre, linkedin: l.linkedin })),
  },
  'foto-instagram': { guardarFotoDeInstagram: async (id: number, url: string) => { estado.fotos.push([id, url]); return true; } },
  workspace: {
    getTenantDb: async () => ({}),
    negocioPausado: async () => estado.pausado,
    runWithWorkspace: (ws: number, fn: () => unknown) => { estado.workspaces.push(ws); return fn(); },
  },
  'flow-cola': { workspaceDeToken: async (t: string) => (t === 'flow_bueno' ? 3 : null) },
  'limite-publico': { limitePorClave: () => null },
};

const M = Module as unknown as { _load: (pedido: string, padre: unknown, main: boolean) => unknown };
const original = M._load;
M._load = (pedido, padre, main) => {
  const nombre = pedido.split('/').pop() as string;
  const propio = pedido.startsWith('.') || pedido.startsWith('@/');
  if (pedido === 'server-only') return falsos['server-only'];
  if (propio && nombre in falsos) return falsos[nombre];
  return original(pedido, padre, main);
};
// eslint-disable-next-line @typescript-eslint/no-require-imports -- los falsos de arriba tienen que estar puestos antes de cargarlo
const { verPerfil, guardarPerfil } = require('../lib/perfil-captura-db') as typeof import('../lib/perfil-captura-db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../app/api/crm/extension/route') as typeof import('../app/api/crm/extension/route');

beforeEach(() => {
  estado.leads = [];
  estado.altas = [];
  estado.fotos = [];
  estado.tope = false;
  estado.pausado = false;
  estado.workspaces = [];
});

const conNombre = captura({ ogTitulo: 'Ana López (@ana.lopez) • Instagram photos and videos', ogImagen: 'https://scontent-xx.cdninstagram.com/v/f.jpg' });
const deLinkedin = captura({ red: 'linkedin', url: 'https://www.linkedin.com/in/ana-lopez/', titulo: 'Ana López | LinkedIn', encabezados: ['Ana López'] });

test('ver no escribe: dice qué entendió y si ya está', async () => {
  const r = await verPerfil(3, conNombre);
  assert.ok(r.ok);
  assert.deepEqual(r.perfil, { red: 'instagram', rotulo: '@ana.lopez', nombre: 'Ana López', foto: true });
  assert.equal(r.ya, null);
  assert.equal(estado.altas.length, 0, 'mirar no crea nada');
  estado.leads = [{ id: 7, nombre: 'Ana L.', instagram: 'ana.lopez' }];
  const ya = await verPerfil(3, conNombre);
  assert.ok(ya.ok && ya.ya?.id === 7 && ya.ya.link.endsWith('/crm/7?ws=3'));
});

test('guardar crea el lead de Instagram con su @, su origen y su foto', async () => {
  const r = await guardarPerfil(3, conNombre, { nombre: 'Ana López Pérez' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(estado.altas, [{ nombre: 'Ana López Pérez', origen_lead: 'perfil_instagram', instagram: 'ana.lopez', permitirDuplicado: true }]);
  assert.deepEqual(estado.fotos, [[901, 'https://scontent-xx.cdninstagram.com/v/f.jpg']]);
  assert.equal(canalDeEntrada('perfil_instagram').texto, 'Lo guardaste desde su perfil de Instagram');
  // Con el mismo @ otra vez: «ya está», y no se crea un segundo.
  const otra = await guardarPerfil(3, conNombre, { nombre: 'Ana' });
  assert.equal(!otra.ok && otra.motivo, 'ya');
  assert.equal(estado.altas.length, 1);
});

test('LinkedIn: nace con el link de su perfil, y el mismo perfil escrito de otra forma ya está', async () => {
  const r = await guardarPerfil(3, deLinkedin, {});
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(estado.altas[0], { nombre: 'Ana López', origen_lead: 'perfil_linkedin', linkedin: 'https://www.linkedin.com/in/ana-lopez/', permitirDuplicado: true });
  assert.equal(estado.fotos.length, 0, 'de LinkedIn no se baja ninguna foto');
  estado.leads = [{ id: 8, nombre: 'A. López', linkedin: 'linkedin.com/in/Ana-Lopez?trk=perfil' }];
  const ya = await guardarPerfil(3, deLinkedin, {});
  assert.equal(!ya.ok && ya.motivo, 'ya');
});

test('un parecido de nombre lo decide la persona; sin nombre, se lo pide; el tope del plan frena con su link', async () => {
  estado.leads = [{ id: 5, nombre: 'Ana López' }];
  const parecido = await guardarPerfil(3, conNombre, {});
  assert.equal(!parecido.ok && parecido.motivo, 'parecido');
  assert.equal(estado.altas.length, 0);
  const igual = await guardarPerfil(3, conNombre, { aunqueSeLlameIgual: true });
  assert.ok(igual.ok, 'la persona vio el aviso y eligió guardarlo igual');
  const sinNombre = await guardarPerfil(3, captura(), { nombre: '  ' });
  assert.equal(!sinNombre.ok && sinNombre.motivo, 'sin-nombre');
  estado.tope = true;
  const tope = await guardarPerfil(3, captura({ url: 'https://www.instagram.com/otra/' }), { nombre: 'Otra' });
  assert.ok(!tope.ok && tope.motivo === 'tope' && tope.planes.endsWith('/configuraciones/plan?ws=3'));
});

const pedir = (cuerpo: unknown, token: string | null = 'flow_bueno', crudo = false) => POST(new Request('https://hola-mako.com/api/crm/extension', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { 'x-flow-token': token } : {}) },
  body: crudo ? String(cuerpo) : JSON.stringify(cuerpo),
}) as unknown as Parameters<typeof POST>[0]);

test('la ruta: token del puente, negocio activo, cuerpo chico y la captura con su forma', async () => {
  const ok = { accion: 'ver', captura: { modo: 'perfil', ...conNombre } };
  assert.equal((await pedir(ok, 'flow_malo')).status, 404);
  assert.equal((await pedir(ok, null)).status, 404);
  estado.pausado = true;
  assert.equal((await pedir(ok)).status, 404, 'un negocio pausado no guarda leads');
  estado.pausado = false;
  assert.equal((await pedir('x'.repeat(50_000), 'flow_bueno', true)).status, 413);
  assert.equal((await pedir('{roto', 'flow_bueno', true)).status, 400);
  assert.equal((await pedir({ accion: 'ver', captura: { modo: 'sitio' } })).status, 400);
  assert.equal((await pedir({ accion: 'borrar', captura: ok.captura })).status, 400);
  const r = await pedir(ok);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).perfil.nombre, 'Ana López');
  assert.deepEqual(estado.workspaces, [3]);
  const g = await (await pedir({ accion: 'guardar', captura: ok.captura, nombre: 'Ana' })).json();
  assert.equal(g.ok, true);
  assert.equal(esPublica('/api/crm/extension'), true, 'la extensión no tiene sesión: la ruta está en PUBLICOS');
  assert.equal(esPublica('/api/crm/otra'), false, 'sólo la ruta exacta');
});

test('el desplegable lee la pestaña con el toque, en el mundo aislado, y sin permisos nuevos', () => {
  const pop = sinComentarios(leer('extension/popup.js'));
  assert.match(pop, /files: \['perfil-leer\.js'\], world: 'ISOLATED'/);
  // El primer toque mira; recién el segundo («Guardar en mi CRM») guarda.
  assert.match(pop, /pedirPerfil\(\{ accion: 'ver', captura \}\)/);
  assert.match(pop, /addEventListener\('click', \(\) => void guardarPerfil\(/);
  assert.match(leer('extension/popup.html'), /<script src="perfil-reglas\.js"><\/script>/);
  const m = JSON.parse(leer('extension/manifest.json'));
  // «Guardar en MaKo» llegó con la 0.78.0: el paquete es ésa o una más nueva, y el espejo dice la misma que el paquete.
  // (Fijaba '0.78.0' literal: cada versión nueva lo ponía rojo con todo bien, 9/11/2026.)
  assert.ok(!esMasVieja(m.version, '0.78.0'), `el paquete (${m.version}) no trae «Guardar en MaKo»`);
  assert.ok(leer('extension/injected.js').includes(`const VERSION_ESPEJO = '${m.version}';`), 'el espejo dice la misma versión');
  assert.equal(m.content_scripts.flatMap((c: { js: string[] }) => c.js).includes('perfil-leer.js'), false, 'no es un content script: corre sólo con el toque');
  const pol = leer('app/privacidad/extension/page.tsx');
  assert.match(pol, /<H>Al guardar un perfil en tu CRM<\/H>/);
  assert.match(pol, /No lee sus publicaciones, sus mensajes\s+ni a quién sigue/);
});
