// =============================================================================
// Quien LEE `usuarios.foto_url` para una pantalla la pasa por el filtro de orígenes (18/11/2026, F173)
// =============================================================================
// tests/foto-persona-origen.test.ts fija el FILTRO (`fotoDePersonaSegura`, lib/foto-perfil.ts) y que se aplica al guardar el
// perfil y en tres lectores. Quedaban otros que mandaban la columna cruda a una pantalla: el equipo del CRM y de Chats
// (`getEquipoAction`), el historial de un lead, el equipo de Configuración (GET /api/equipo y el teléfono, por `equipoDe`), los
// miembros de un grupo y la barra (/api/perfil). Y la acción 'foto' de /api/admin/usuarios guardaba cualquier URL. Una foto de
// afuera que ya está en la base es un web bug: el servidor de quien la puso se entera de quién abrió cada una de esas pantallas.
//
// Lo que se EJECUTA acá: `conFotoSegura`, y lib/usuarios.ts entero contra una base de mentira (un `fetch` falso que contesta
// filas con una foto de afuera): lo que lee sale filtrado, y lo que escribe (`actualizarUsuario`, `registrarLogin`) no deja
// entrar la de afuera. Y un BARRIDO: en todo archivo de app/ y lib/ que lee la tabla `usuarios`, cada lectura de `.foto_url` va
// por el filtro en la misma línea, salvo las dos de la copia de respaldo de «Traer datos de Mau», que guardan y devuelven la
// celda tal cual estaba.
//
// Probado rompiéndolo (18/11/2026), base 5 pases / 0 fallos:
//   · `fila` de lib/usuarios.ts devolviendo `u` sin filtrar                         → 4 / 1 (lo que lee lib/usuarios)
//   · `actualizarUsuario` con `{ ...patch }` en vez de `limpio`                      → 4 / 1 (lo que escribe)
//   · `registrarLogin` con la foto cruda (`datos.foto_url?.trim()`)                  → 3 / 2 (lo que escribe y el barrido)
//   · `getEquipoAction` devolviendo `foto_url: u.foto_url ?? null`                  → 4 / 1 (el barrido)
//   · `conFotoSegura` devolviendo la fila tal cual                                   → 3 / 2
// Corre en su propio proceso (toca `globalThis.fetch`, `process.env` y `Module._load`).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import Module from 'node:module';
import { join } from 'node:path';
import { conFotoSegura } from '../lib/foto-perfil';

const RAIZ = join(__dirname, '..');
const STORAGE = 'proyecto-de-prueba.supabase.co';
const AFUERA = 'https://servidor-suyo.example/pixel.gif';
const GOOGLE = 'https://lh3.googleusercontent.com/a/foto.png';

test('conFotoSegura filtra sólo la foto y deja el resto de la fila', () => {
  const u = { id: 7, nombre: 'Ana', foto_url: AFUERA };
  assert.deepEqual(conFotoSegura(u, { storage: STORAGE }), { id: 7, nombre: 'Ana', foto_url: null });
  assert.deepEqual(conFotoSegura({ id: 8, foto_url: GOOGLE }, { storage: STORAGE }), { id: 8, foto_url: GOOGLE });
  // Idempotente: lo que ya venía filtrado no cambia.
  const una = conFotoSegura({ foto_url: GOOGLE }, { storage: STORAGE });
  assert.deepEqual(conFotoSegura(una, { storage: STORAGE }), una);
  // Una fila sin la columna no gana una.
  assert.deepEqual(conFotoSegura({ id: 9 } as { id: number; foto_url?: string | null }), { id: 9 });
});

// ── lib/usuarios.ts contra una base de mentira ─────────────────────────────────────────────────────────────────────────────

type Pedido = { metodo: string; url: string; cuerpo: unknown };
const pedidos: Pedido[] = [];
const FILA = {
  id: 1, email: 'ana@negocio.test', nombre: 'Ana Prueba', rol: 'usuario', estado: 'activo', foto_url: AFUERA,
  invitado_por: null, ultimo_login: null, created_at: '2026-11-01', workspace_id: 3, rol_ws: 'closer', perfil: {},
  invitacion_enviada_at: null, mfa_activo: false,
};

async function cargarUsuarios() {
  type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
  const M = Module as unknown as { _load: Cargador };
  const original = M._load;
  M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
    pedido === 'server-only' ? {} : Reflect.apply(original, Module, [pedido, padre, esMain])) as Cargador;
  process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${STORAGE}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
  globalThis.fetch = (async (u: RequestInfo | URL, init?: RequestInit) => {
    const url = String(u);
    const metodo = (init?.method ?? 'GET').toUpperCase();
    let cuerpo: unknown = null;
    try { cuerpo = init?.body ? JSON.parse(String(init.body)) : null; } catch { cuerpo = init?.body ?? null; }
    pedidos.push({ metodo, url, cuerpo });
    const h = new Headers(init?.headers);
    const objeto = (h.get('accept') ?? '').includes('vnd.pgrst.object');
    // Sólo `usuarios` contesta la fila; el resto de las tablas (las invitaciones del grupo de registrarLogin) contesta vacío.
    const filas = url.includes('/rest/v1/usuarios') ? [FILA] : [];
    return new Response(JSON.stringify(objeto ? filas[0] ?? null : filas), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return import('../lib/usuarios');
}

test('lo que LEE lib/usuarios.ts sale con la foto filtrada', async () => {
  const u = await cargarUsuarios();
  const todos = await u.listarUsuarios();
  assert.equal(todos.length, 1);
  assert.equal(todos[0].foto_url, null, 'listarUsuarios dejó pasar una foto de afuera');
  assert.equal(todos[0].nombre, 'Ana Prueba', 'el filtro no puede tocar el resto de la fila');
  assert.equal((await u.equipoDe(3))[0]?.foto_url, null, 'equipoDe (lo dibujan /api/equipo y el teléfono)');
  assert.equal((await u.buscarUsuarioPorEmail('ana@negocio.test'))?.foto_url, null, 'buscarUsuarioPorEmail');
  assert.equal((await u.buscarUsuarioPorNombre('Ana Prueba'))?.foto_url, null, 'buscarUsuarioPorNombre');
  assert.equal((await u.crearUsuario({ email: 'nueva@negocio.test' })).foto_url, null, 'crearUsuario devuelve la fila filtrada');
});

test('lo que ESCRIBE lib/usuarios.ts no deja entrar una foto de afuera', async () => {
  const u = await cargarUsuarios();
  pedidos.length = 0;
  await u.actualizarUsuario(1, { foto_url: AFUERA });
  const patch = pedidos.find((p) => p.metodo === 'PATCH' && p.url.includes('/rest/v1/usuarios'));
  assert.ok(patch, 'actualizarUsuario no escribió nada');
  assert.equal((patch.cuerpo as { foto_url?: unknown }).foto_url, null, 'actualizarUsuario guardó una foto de afuera');

  pedidos.length = 0;
  await u.actualizarUsuario(1, { foto_url: GOOGLE });
  const buena = pedidos.find((p) => p.metodo === 'PATCH' && p.url.includes('/rest/v1/usuarios'));
  assert.equal((buena?.cuerpo as { foto_url?: unknown }).foto_url, GOOGLE, 'la foto de Google se guarda tal cual');

  pedidos.length = 0;
  await u.registrarLogin('ana@negocio.test', { foto_url: AFUERA });
  const login = pedidos.find((p) => p.metodo === 'PATCH' && p.url.includes('/rest/v1/usuarios'));
  assert.ok(login, 'registrarLogin no marcó el login');
  assert.ok(!('foto_url' in (login.cuerpo as object)), 'registrarLogin escribió una foto de afuera (se queda la que había)');

  pedidos.length = 0;
  await u.registrarLogin('ana@negocio.test', { foto_url: GOOGLE });
  const conGoogle = pedidos.find((p) => p.metodo === 'PATCH' && p.url.includes('/rest/v1/usuarios'));
  assert.equal((conGoogle?.cuerpo as { foto_url?: unknown }).foto_url, GOOGLE, 'la foto del login con Google se sigue guardando');
});

// ── El barrido: todo lector de `usuarios` filtra `.foto_url` ───────────────────────────────────────────────────────────────

const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** Las lecturas que NO pasan por el filtro, a propósito. Cada una con su porqué. */
const EXCEPCIONES: Record<string, string> = {
  // «Traer datos de Mau» guarda la fila del destino en un recibo para poder deshacer, y al deshacer la devuelve: es la celda
  // tal cual estaba, de la base a la base, y nunca se dibuja. Filtrarla haría que «Eliminar» no devuelva lo que había.
  'lib/datos-mau.ts · foto_url: dest.foto_url,': 'el recibo guarda la celda como estaba',
  'lib/datos-mau.ts · foto_url: p.foto_url,': 'deshacer devuelve la celda del recibo',
};
const FILTROS = /fotoDePersonaSegura\(|conFotoSegura\(|caraDeUsuario\(/;

test('todo archivo que lee la tabla usuarios pasa cada `.foto_url` por el filtro', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.tsx?$/.test(f));
  const lectores: string[] = [];
  const faltan: string[] = [];
  const usadas = new Set<string>();
  for (const f of archivos) {
    const src = sinComentarios(readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n'));
    if (!/from\('usuarios'\)|usuarios\(foto_url/.test(src) || !src.includes('foto_url')) continue;
    lectores.push(f);
    for (const linea of src.split('\n')) {
      // Una LECTURA de la columna (`x.foto_url`, `x?.foto_url`), no una asignación (`patch.foto_url = …`).
      if (!/[\w)\]?]\.foto_url\b(?!\s*=[^=])/.test(linea)) continue;
      if (FILTROS.test(linea)) continue;
      const clave = `${f} · ${linea.trim()}`;
      if (EXCEPCIONES[clave]) { usadas.add(clave); continue; }
      faltan.push(clave);
    }
  }
  // El denominador: si deja de ver a los lectores conocidos, el barrido no está mirando nada.
  for (const f of ['lib/usuarios.ts', 'app/crm/actions.ts', 'lib/grupo-puerta.ts', 'lib/perfil.ts', 'lib/tickets-db.ts']) {
    assert.ok(lectores.includes(f), `el barrido dejó de ver ${f} como lector de usuarios (vio ${lectores.length})`);
  }
  assert.deepEqual(faltan, [], `estas líneas mandan la foto de una persona sin el filtro de orígenes (usá fotoDePersonaSegura de lib/foto-perfil.ts):\n${faltan.join('\n')}`);
  const viejas = Object.keys(EXCEPCIONES).filter((k) => !usadas.has(k));
  assert.deepEqual(viejas, [], `estas excepciones ya no corresponden a ninguna línea: sacalas\n${viejas.join('\n')}`);
});

test('la acción «foto» del panel rechaza una foto de afuera con su motivo', () => {
  const src = sinComentarios(readFileSync(join(RAIZ, 'app/api/admin/usuarios/route.ts'), 'utf8').replace(/\r\n/g, '\n'));
  const caso = src.slice(src.indexOf("case 'foto':"), src.indexOf("case 'reinvitar':"));
  assert.ok(caso.length > 50 && caso.length < 1500, `no encontré el caso 'foto' (${caso.length})`);
  assert.match(caso, /const segura = url \? fotoDePersonaSegura\(url\) : null;/);
  assert.match(caso, /if \(url && !segura\) return NextResponse\.json\(\{ ok: false, error: '[^']+' \}, \{ status: 400 \}\);/);
  assert.match(caso, /actualizarUsuario\(objetivo\.id, \{ foto_url: segura \}\)/);
});
