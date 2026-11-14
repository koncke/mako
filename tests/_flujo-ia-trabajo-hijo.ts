// =============================================================================
// Hijo de tests/flujo-ia-trabajo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La ruta REAL de «Pídeselo a MaKo» (app/api/chat-agent/secuencias/ia/route.ts) con la sesión, la base, el push y `after`
// de mentira (tests/_grupos-ops-arnes.ts). Lo único de mentira de crear es el modelo: `crearFlujoConIA` espera a que el
// test lo suelte y, si su señal está cortada, no escribe (como el core real, lib/flujo-ia-crear-core.ts). En el medio, el
// test cierra la pestaña (corta el pedido) o toca «Cancelar» (la marca).

import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { db, comoPersona, correrDespues, decirResultado, escenaNueva, pushes, sesionDe, usuario } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const url = (r: string) => pathToFileURL(join(__dirname, '..', r)).href;
const WS = 13;
const ANA = usuario(101, 'ana@negocio.test', 'Ana', WS, 'admin');

let soltar: (() => void) | null = null;
const cortadas: boolean[] = [];
mock.module(url('lib/flujo-ia-crear.ts'), {
  namedExports: {
    armarContexto: async () => ({}), crearNuevas: async () => ({}), generar: async () => ({}),
    crearFlujoConIA: async (o: { secuenciaId: number; signal?: AbortSignal; alFase?: (f: unknown) => void }) => {
      o.alFase?.({ t: 'fase', fase: 'modelo' });
      await new Promise<void>((r) => { soltar = r; });
      soltar = null;
      cortadas.push(!!o.signal?.aborted);
      if (o.signal?.aborted) return { ok: false, error: 'Cancelado', cancelado: true };
      return { ok: true, secuenciaId: o.secuenciaId, nombre: 'Bienvenida', pasos: [], orden: [], avisos: [], etiquetasNuevas: [], disparador: null, texto: 'Creé «Bienvenida». Quedó pausada.' };
    },
  },
});

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function hastaQueEscriba(): Promise<void> {
  for (let i = 0; i < 200 && !soltar; i++) await esperar(10);
  if (!soltar) throw new Error('el modelo de mentira no arrancó');
}

async function main() {
  db.workspaces.push({ id: WS, capa: 'completo', nombre: 'Negocio', estado: 'activo' });
  db.usuarios.push(ANA);
  db.push_suscripciones.push({ id: 900, usuario_id: 101, endpoint: 'https://push.test/ana', p256dh: 'p'.repeat(87), auth: 'a'.repeat(22), fallos: 0 });
  for (const id of [77, 78, 79]) db.nutricion_secuencias.push({ id, workspace_id: WS, nombre: 'Nueva automatización', pasos: [], activa: false, trigger_tipo: 'manual', etapa: null, etapas: null, funnel_id: null, producto_id: null, etiqueta_id: null });
  const { NextRequest } = await import('next/server');
  const ruta = await import('../app/api/chat-agent/secuencias/ia/route');
  const { leerChat } = await import('../lib/automatizacion-chat-db');
  const { runWithWorkspace } = await import('../lib/workspace');
  const post = (cuerpo: Record<string, unknown>, signal?: AbortSignal) => comoPersona(sesionDe(ANA), () => ruta.POST(new NextRequest('https://hola-mako.com/api/chat-agent/secuencias/ia', { method: 'POST', body: JSON.stringify(cuerpo), signal })));
  const chat = async (id: number) => (await runWithWorkspace(WS, () => leerChat(WS, id))).mensajes.map((m) => `${m.de}: ${m.texto}`);
  const out: Record<string, unknown> = {};

  // 1 · Cierra la pestaña mientras MaKo escribe: el trabajo sigue, la deja en el chat y le avisa por push.
  escenaNueva();
  const pestana = new AbortController();
  await post({ pedido: 'Dale la bienvenida a cada lead nuevo', modo: 'crear', secuenciaId: 77 }, pestana.signal);
  await hastaQueEscriba();
  pestana.abort();
  soltar!();
  await correrDespues();
  out.cerroCortada = cortadas.shift();
  out.cerroChat = await chat(77);
  out.cerroPush = pushes.map((p) => ({ a: p.endpoint, titulo: p.cuerpo.titulo, url: p.cuerpo.url }));

  // 2 · «Cancelar» de verdad: la marca corta el trabajo antes de escribir; no queda nada ni suena nada.
  escenaNueva();
  const otra = new AbortController();
  await post({ pedido: 'Recordar la reunión', modo: 'crear', secuenciaId: 78 }, otra.signal);
  await hastaQueEscriba();
  out.cancelar = await (await post({ modo: 'cancelar', secuenciaId: 78 })).json();
  otra.abort();
  await esperar(2_600);
  soltar!();
  await correrDespues();
  out.cancelCortada = cortadas.shift();
  out.cancelChat = await chat(78);
  out.cancelPush = pushes.length;

  // 3 · Se queda mirando: el chat lo dice y no hace falta un push.
  escenaNueva();
  await post({ pedido: 'Etiquetar a quien responde', modo: 'crear', secuenciaId: 79 });
  await hastaQueEscriba();
  soltar!();
  await correrDespues();
  out.miraCortada = cortadas.shift();
  out.miraPush = pushes.length;

  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
