// =============================================================================
// Hijo de tests/caja-nota-con-adjuntos.test.ts — NO es un test
// =============================================================================
// Dibuja la caja ÚNICA de verdad (app/_chat/CajaChat.tsx) sin navegador. Va de mentira lo que no carga o no se puede tocar en node:
// `AdjuntosCaja` (importa su CSS), la sesión del micrófono (`useGrabacionVoz`, para ver cuál se arranca y qué le entrega) y los dos botones
// finales de Microfono.tsx (para leer qué le llega a cada uno). Corre con --experimental-test-module-mocks y le imprime el JSON al test.
// =============================================================================

import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const url = (r: string) => pathToFileURL(join(__dirname, '..', r)).href;

type Sesion = { fase: string; revision: null; onSend: (b: Blob, s: number) => void | Promise<void>; arrancada: boolean; start: () => Promise<void> };
let sesiones: Sesion[] = [];
let grabando: number | null = null;
let onGrabar: (() => void) | null = null;
const transcripciones: string[] = [];

mock.module(url('app/admin/operaciones/AdjuntosCaja.tsx'), { namedExports: { ListaAdjuntos: () => null, MasCaja: () => null, alPegar() {}, alSoltar() {}, traeArchivos: () => false } });
mock.module(url('app/whatsapp/_shared/VoiceRecorder.tsx'), {
  namedExports: {
    useGrabacionVoz: (onSend: Sesion['onSend']) => {
      const i = sesiones.length;
      const s: Sesion = { fase: grabando === i ? 'grabando' : 'quieta', revision: null, onSend, arrancada: false, start: async () => { s.arrancada = true; } };
      sesiones.push(s);
      return s;
    },
    BarraGrabacion: ({ voz }: { voz: Sesion }) => createElement('i', { 'data-barra': sesiones.indexOf(voz) }),
  },
});
mock.module(url('app/admin/operaciones/Microfono.tsx'), {
  namedExports: {
    BotonMandar: (p: { hayQueMandar: boolean }) => createElement('i', { 'data-flecha': p.hayQueMandar ? 'manda' : 'dicta' }),
    BotonGrabar: (p: { onGrabar: () => void }) => { onGrabar = p.onGrabar; return createElement('i', { 'data-grabar': '' }); },
  },
});
mock.module(url('app/second-brain/nota-de-voz.ts'), { namedExports: { notaEnMp3: async (b: Blob) => b } });
mock.module(url('app/_components/transcribir-nota.ts'), { namedExports: { transcribirNota: async () => { transcripciones.push('pedida'); return { ok: true, texto: 'mira esta captura' }; } } });

const ADJUNTO = { id: 'a', file: new File(['x'], 'captura.png', { type: 'image/png' }), tipo: 'image', url: '' };
const ADJUNTOS = (n: number) => ({ items: n ? [ADJUNTO] : [], puede: true, accept: 'image/*', onSumar() {}, onQuitar() {} });

async function main() {
  const { CajaChat } = await import('../app/_chat/CajaChat');
  const dibujar = (props: Record<string, unknown>, sesionGrabando: number | null = null) => {
    sesiones = [];
    grabando = sesionGrabando;
    onGrabar = null;
    const html = renderToStaticMarkup(createElement(CajaChat as unknown as ComponentType<Record<string, unknown>>, { texto: '', onTexto() {}, onMandar() {}, placeholder: 'Escríbele a MaKo', ...props }));
    return {
      grabarAlLado: html.includes('data-grabar'),
      micSolo: html.includes('aria-label="Grabar una nota de voz"'),
      flecha: /data-flecha="manda"/.test(html),
      barra: /data-barra="(\d+)"/.exec(html)?.[1] ?? null,
      sesiones: sesiones.length,
    };
  };

  const estados = {
    sinNada: dibujar({ adjuntos: ADJUNTOS(0) }),
    conAdjunto: dibujar({ adjuntos: ADJUNTOS(1) }),
    conAdjuntoYTexto: dibujar({ adjuntos: ADJUNTOS(1), texto: 'hola' }),
    soloTexto: dibujar({ adjuntos: ADJUNTOS(0), texto: 'hola' }),
    conAdjuntoBloqueada: dibujar({ adjuntos: ADJUNTOS(1), bloqueo: { frase: 'Instala MaKo', boton: null } }),
    conAdjuntoSaliendo: dibujar({ adjuntos: ADJUNTOS(1), enviando: true }),
    grabandoLaDeAdjuntos: dibujar({ adjuntos: ADJUNTOS(1) }, 1),
    grabandoLaDeLaPantalla: dibujar({ adjuntos: ADJUNTOS(0) }, 0),
  };

  // Un cambio de la caja con lo adjuntado: qué sesión arranca el micrófono y a dónde va lo que entrega cada una.
  const textos: string[] = [];
  const enElActo: unknown[] = [];
  dibujar({ adjuntos: ADJUNTOS(1), onTexto: (t: string) => textos.push(t), onGrabada: (g: unknown) => enElActo.push(g) });
  const [dePantalla, deAdjuntos] = sesiones;
  (onGrabar as unknown as () => void)();
  const arranco = { pantalla: dePantalla.arrancada, adjuntos: deAdjuntos.arrancada };
  const nota = new Blob(['audio']);
  await deAdjuntos.onSend(nota, 3);
  const trasLaDeAdjuntos = { textos: [...textos], enElActo: enElActo.length, transcripciones: transcripciones.length };
  await dePantalla.onSend(nota, 3);
  const trasLaDePantalla = { textos: [...textos], enElActo: enElActo.length, transcripciones: transcripciones.length };

  // Con `voz`: la pantalla recibe el audio por la suya; la de adjuntos, igual que sin `voz`, no se lo da.
  const audios: unknown[] = [];
  textos.length = 0;
  dibujar({ adjuntos: ADJUNTOS(1), onTexto: (t: string) => textos.push(t), voz: { onAudio: (b: Blob) => { audios.push(b); } } });
  await sesiones[1].onSend(nota, 3);
  const conVoz = { audios: audios.length, textos: [...textos] };

  process.stdout.write(`@@R@@${JSON.stringify({ estados, arranco, trasLaDeAdjuntos, trasLaDePantalla, conVoz })}`);
  process.exit(0);
}

void main().catch((e) => { console.error(e); process.exit(1); });
