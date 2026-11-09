'use client';

// =============================================================================
// GuiaEnElChat — MaKo lleva los pasos de una plantilla guiada, en el chat del editor (la tab Video, 9/11/2026)
// =============================================================================
// Martín, 9/11/2026: «al seleccionar un template tiene que quedar claro qué hacer… MaKo lo pide en el chat del costado, como la
// animación del tutorial: se opaca todo el resto de la pantalla y se marca el mensaje con la pregunta de MaKo… "pásame una foto
// o selecciona de estas", con las fotos que ya subió, y lo mismo para la voz si no la grabó». docs/relevo/nube-tab-video.md §4.
//
// Las piezas son las de siempre, no unas nuevas:
//   · lo que dice MaKo es una APERTURA (lib/aperturas/video-guia.ts), dibujada por AperturaMako, con sus fotos cliqueables
//     (`galeria`). La arma el código, sin IA: anda sin la app de escritorio;
//   · el velo es el de la guía (app/_ui/guia/VeloGuia.tsx) en su modo de pregunta marcada (`destacarEnElChat`);
//   · subir una foto es la ruta de siempre (/api/onboarding/persona, la misma del estudio del personaje); la voz se clona con el
//     modal de siempre (app/automations/VozAIStep.tsx → ModalClonar, la ruta /api/onboarding/voz);
//   · lo elegido queda en el proyecto (./estado.ts), y la apertura lo vuelve a leer: un paso contestado no vuelve.
// =============================================================================

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AperturaMako, useApertura, type EstadoApertura } from '@/app/_chat/AperturaMako';
import type { Quien } from '@/app/_chat/HiloMako';
import { destacarEnElChat } from '@/app/_ui/guia/store';
import { inicioAvatarAction } from '@/app/ai-avatar/actions';
import { PASO, SUPERFICIE_VIDEO_GUIA, VALOR, type AccionVideoGuia, type HechosVideoGuia } from '@/lib/aperturas/video-guia';
import { PLANTILLA_MENSAJE_PARA } from '@/lib/video-plantillas/mensaje-para';
import { cambiarGuia, useGuiaVideo } from './estado';
import { conEleccion, conGuion, hechosDelProyecto } from './reglas';
import { EditorGuion } from './EditorGuion';

// El modal de clonar trae su CSS y su grabador: sólo cuando se pide.
const ModalClonar = dynamic(() => import('@/app/automations/VozAIStep').then((m) => m.ModalClonar), { ssr: false });

type Datos = { fotos: { id: string; url: string }[]; personajes: { id: string; url: string; nombre: string }[] };

/** Las fotos y los personajes de la persona, de `inicioAvatarAction` (la misma lectura del estudio del personaje). */
async function leerDatos(): Promise<Datos> {
  const r = await inicioAvatarAction().catch(() => null);
  if (!r || !r.ok) return { fotos: [], personajes: [] };
  return {
    fotos: r.fotos,
    personajes: r.looks.filter((l) => l.estado === 'listo' && !!l.url).map((l) => ({ id: l.id, url: l.url, nombre: l.nombre })),
  };
}

/** ¿Tiene la voz clonada y viva? null = no se pudo saber (MaKo no pregunta a ciegas). */
async function leerVoz(): Promise<{ clonada: boolean | null; hayKey: boolean }> {
  try {
    const j = (await (await fetch('/api/onboarding/voz')).json()) as { ok: boolean; clon?: { voiceId: string } | null; vivo?: boolean | null; hayKey?: boolean };
    if (!j.ok) return { clonada: null, hayKey: false };
    return { clonada: !!j.clon && j.vivo !== false, hayKey: !!j.hayKey };
  } catch { return { clonada: null, hayKey: false }; }
}

export function GuiaEnElChat({ proyectoId, ocupado, quien }: { proyectoId: string; ocupado: boolean; quien: Quien }) {
  const estadoGuia = useGuiaVideo(proyectoId);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [voz, setVoz] = useState<{ clonada: boolean | null; hayKey: boolean } | null>(null);
  const [guionAbierto, setGuionAbierto] = useState(false);
  const [clonando, setClonando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const guiado = !!estadoGuia;

  useEffect(() => {
    if (!guiado) return;
    let vivo = true;
    void leerDatos().then((d) => { if (vivo) setDatos(d); });
    void leerVoz().then((v) => { if (vivo) setVoz(v); });
    return () => { vivo = false; };
  }, [guiado]);

  const hechos = useMemo((): HechosVideoGuia | null => {
    if (!estadoGuia || !datos) return null;
    return { proyecto: proyectoId, ...hechosDelProyecto(estadoGuia), fotos: datos.fotos, personajes: datos.personajes, vozClonada: voz?.clonada ?? null, ocupado };
  }, [estadoGuia, datos, voz, proyectoId, ocupado]);

  const estado = useApertura({ superficie: SUPERFICIE_VIDEO_GUIA, hechos, libre: !ocupado && !guionAbierto && !clonando, entidad: proyectoId });
  const idActual = estado.apertura?.id ?? null;

  // La pregunta de ahora pide la atención: el resto se opaca y su mensaje queda marcado (un toque fuera del chat lo apaga).
  useEffect(() => {
    destacarEnElChat(!!idActual);
    return () => destacarEnElChat(false);
  }, [idActual]);

  // Lo contestado queda en el PROYECTO (la memoria de las aperturas sólo calla lo ya dicho): la apertura lo vuelve a leer.
  const estadoConProyecto: EstadoApertura<AccionVideoGuia> = {
    ...estado,
    elegir: (b) => {
      if (b.tipo === 'respuesta' && estado.apertura) cambiarGuia(proyectoId, (x) => conEleccion(x, estado.apertura!.id, b.valor));
      estado.elegir(b);
    },
  };

  const subirFoto = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const j = (await (await fetch('/api/onboarding/persona', { method: 'POST', body: fd })).json()) as { ok: boolean; error?: string; fotos?: { id: string; url: string | null }[] };
      if (!j.ok) { toast.error(j.error || 'No se pudo subir la foto.'); return; }
      const lista = (j.fotos ?? []).filter((x): x is { id: string; url: string } => !!x.url);
      const nueva = lista.at(-1);
      setDatos((d) => ({ fotos: lista, personajes: d?.personajes ?? [] }));
      // La recién subida queda elegida: es la que la persona acaba de mandar.
      if (nueva) cambiarGuia(proyectoId, (x) => conEleccion(x, PASO.personaje, `foto:${nueva.id}`));
      toast('Tu foto quedó en tu personaje');
    } catch {
      toast.error('No se pudo subir la foto. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setSubiendo(false);
      if (campo.current) campo.current.value = '';
    }
  };

  const acciones: Record<AccionVideoGuia, () => void> = {
    'ver-referencia': () => {
      window.open(PLANTILLA_MENSAJE_PARA.referencia.url, '_blank', 'noopener,noreferrer');
      cambiarGuia(proyectoId, (x) => conEleccion(x, PASO.referencia, VALOR.vista));
    },
    guion: () => setGuionAbierto(true),
    'ver-clips': () => {
      setGuionAbierto(true);
      cambiarGuia(proyectoId, (x) => conEleccion(x, PASO.clips, 'visto'));
    },
    'subir-foto': () => { if (!subiendo) campo.current?.click(); },
    'grabar-voz': () => setClonando(true),
  };

  if (!estadoGuia) return null;
  return (
    <>
      {estado.apertura && (
        <div data-mako-destacado="" style={{ borderRadius: 14 }}>
          <AperturaMako estado={estadoConProyecto} quien={quien} acciones={acciones} />
        </div>
      )}
      <input ref={campo} type="file" accept="image/*" hidden onChange={(e) => void subirFoto(e.target.files)} />
      {guionAbierto && (
        <EditorGuion inicial={estadoGuia.guion} onCerrar={() => setGuionAbierto(false)}
          onGuardar={(g) => { cambiarGuia(proyectoId, (x) => conGuion(x, g)); setGuionAbierto(false); toast('Guion guardado'); }} />
      )}
      {clonando && (
        <ModalClonar destino="propia" hayKey={voz?.hayKey ?? false} onCerrar={() => setClonando(false)}
          onListo={() => { setClonando(false); setVoz((v) => ({ clonada: true, hayKey: v?.hayKey ?? true })); }} />
      )}
    </>
  );
}
