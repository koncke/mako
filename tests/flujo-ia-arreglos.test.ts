// =============================================================================
// CREAR CON IA: los arreglos de la revisión de la segunda tanda (09/10/2026)
// =============================================================================
// Cada test persigue UN hallazgo confirmado de la revisión del frente IA (lib/flujo-ia.ts, la ruta
// app/api/chat-agent/secuencias/ia/route.ts y app/chatbot/CrearConIA.tsx). Lo puro se EJECUTA; lo
// que es cableado (la ruta, la pantalla) se fija leyendo el fuente sin comentarios y en LF.
//
// ⚠️ PROBADO ROMPIENDO CADA ARREGLO, 09/10/2026: el arnés FIXIA-romper.mjs (scratchpad de la sesión)
// revierte el arreglo, corre este archivo, cuenta y RESTAURA DE MEMORIA (md5 verificado). El
// resultado de cada rotura está al lado de su test («rotura: …»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LISTA_BLANCA_IA, type CtxIA } from '../lib/flujo-ia';
import { porId } from '../lib/api-mako/registro';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});
export const ctxBase = (o: Partial<CtxIA> = {}): CtxIA => ({
  etiquetas: [{ id: 7, nombre: 'Cualificado' }],
  productos: [
    { funnelId: 3, productoId: null, nombre: 'Mentoría', esDefault: true, etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }, { value: 'ganado', label: 'Ganado' }] },
    { funnelId: 5, productoId: 11, nombre: 'Curso', etapas: [{ value: 'agendado', label: 'Agendado' }] },
  ],
  disparadores: [{ value: 'trigger:instant_form_sin_agenda', label: 'Formulario sin agenda' }],
  audios: [],
  archivos: [],
  acciones,
  links: { agenda: { url: 'https://cal.com/negocio/llamada', para: 'agendar una llamada' } },
  automatizaciones: [],
  secuenciaId: 99,
  ...o,
});
void ctxBase;

// ── asignar_closer_setter: una tarjeta que el lienzo dibuja configurada y nunca hace nada ──
// rotura (volver a sumarla a LISTA_BLANCA_IA): 1 fallo de 1.
test('asignar_closer_setter NO está en la lista blanca: sus nombres no se pueden validar', () => {
  assert.ok(!LISTA_BLANCA_IA.includes('asignar_closer_setter'));
  // Y el bloque ACCIONES del prompt no la ofrece: sale de la lista blanca.
  assert.ok(!acciones.some((a) => a.id === 'asignar_closer_setter'));
});
