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
//     modal de siempre (app/automations/VozAIStep.tsx → ModalClonar, la ruta /api/onboarding/voz).
//
// ⚠️ SU MEMORIA ES EL PROYECTO, NO LA DE LAS APERTURAS (la revisión del 9/11/2026). `useApertura` calla una clave con «Ahora no»
// (14 días, y el segundo para siempre) y con tres vistas sin respuesta; como la guía muestra sólo el primer paso que falta,
// callar ESE paso callaba la guía entera, y «Ahora no» en el personaje dejaba al proyecto sin un solo paso más. Acá lo contestado
// y lo salteado van al proyecto (./estado.ts): un paso salteado se saltea, sigue el siguiente, y la lista de pasos deja retomarlo.
// =============================================================================

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AperturaMako, type EstadoApertura } from '@/app/_chat/AperturaMako';
import type { Quien } from '@/app/_chat/HiloMako';
import { destacarEnElChat } from '@/app/_ui/guia/store';
import { desplegarCrear } from '@/app/_crear/PantallaCrear';
import { inicioAvatarAction } from '@/app/ai-avatar/actions';
import type { Boton } from '@/lib/aperturas/reglas';
import {
  LINEA_FINAL, PASO, SUPERFICIE_VIDEO_GUIA, VALOR, pasosDeLaGuia, type AccionVideoGuia, type HechosVideoGuia, type PasoDeLaGuia,
} from '@/lib/aperturas/video-guia';
import { PLANTILLA_MENSAJE_PARA } from '@/lib/video-plantillas/mensaje-para';
import { cambiarGuia, useGuiaVideo } from './estado';
import { conEleccion, conGuion, hechosDelProyecto, sinEleccion } from './reglas';
import { EditorGuion } from './EditorGuion';

// El modal de clonar trae su CSS y su grabador: sólo cuando se pide.
const ModalClonar = dynamic(() => import('@/app/automations/VozAIStep').then((m) => m.ModalClonar), { ssr: false });

/** La tab de la pantalla de Create donde vive este chat (app/video-editor/VideoEditorCliente.tsx → `tab="Video"`). */
const TAB_CREAR = 'Video';

type Datos = { fotos: { id: string; url: string }[]; personajes: { id: string; url: string; nombre: string }[]; leidas: boolean };

/** Las fotos y los personajes de la persona, de `inicioAvatarAction` (la misma lectura del estudio del personaje). */
async function leerDatos(): Promise<Datos> {
  const r = await inicioAvatarAction().catch(() => null);
  // «No pude leer» no es «no tiene»: MaKo lo dice distinto (y no ofrece una galería vacía como si no hubiera fotos).
  if (!r || !r.ok) return { fotos: [], personajes: [], leidas: false };
  return {
    fotos: r.fotos,
    personajes: r.looks.filter((l) => l.estado === 'listo' && !!l.url).map((l) => ({ id: l.id, url: l.url, nombre: l.nombre })),
    leidas: true,
  };
}

/** ¿Tiene la voz clonada? null = no se pudo saber (MaKo no pregunta a ciegas). Una voz que no responde igual es SU voz: se ofrece. */
async function leerVoz(): Promise<{ clonada: boolean | null; hayKey: boolean }> {
  try {
    const j = (await (await fetch('/api/onboarding/voz')).json()) as { ok: boolean; clon?: { voiceId: string } | null; hayKey?: boolean };
    if (!j.ok) return { clonada: null, hayKey: false };
    return { clonada: !!j.clon, hayKey: !!j.hayKey };
  } catch { return { clonada: null, hayKey: false }; }
}

export function GuiaEnElChat({ proyectoId, ocupado, quien, onHablando }: {
  proyectoId: string;
  ocupado: boolean;
  quien: Quien;
  /** Avisa si MaKo está preguntando un paso: mientras pregunta, el chat esconde lo de siempre (un paso por pantalla). */
  onHablando?: (si: boolean) => void;
}) {
  const estadoGuia = useGuiaVideo(proyectoId);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [voz, setVoz] = useState<{ clonada: boolean | null; hayKey: boolean } | null>(null);
  const [guionAbierto, setGuionAbierto] = useState(false);
  const [clonando, setClonando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  // Lo dicho en ESTA visita (la pregunta y lo que tocó la persona), para que el hilo cuente la charla.
  const [charla, setCharla] = useState<{ mako: string; yo: string }[]>([]);
  const campo = useRef<HTMLInputElement>(null);
  const guiado = !!estadoGuia;

  useEffect(() => {
    if (!guiado) return;
    let vivo = true;
    void leerDatos().then((d) => { if (vivo) setDatos(d); });
    void leerVoz().then((v) => { if (vivo) setVoz(v); });
    return () => { vivo = false; };
  }, [guiado]);

  // Otro proyecto, otra charla.
  useEffect(() => { setCharla([]); }, [proyectoId]);

  const hechos = useMemo((): HechosVideoGuia | null => {
    // Espera las DOS lecturas: con la voz todavía en camino, el paso de la voz se saltearía y volvería al llegar (un parpadeo).
    if (!estadoGuia || !datos || !voz) return null;
    return {
      proyecto: proyectoId, ...hechosDelProyecto(estadoGuia),
      fotos: datos.fotos, personajes: datos.personajes, fotosLeidas: datos.leidas, vozClonada: voz.clonada,
      // Con un modal abierto o una foto subiendo, el paso espera: no se cambia la pregunta debajo de lo que la persona hace.
      ocupado: ocupado || guionAbierto || clonando || subiendo,
    };
  }, [estadoGuia, datos, voz, proyectoId, ocupado, guionAbierto, clonando, subiendo]);

  // Lo contestado ya vuelve como hecho del proyecto: la superficie no necesita respuestas de la memoria (`{}`).
  const apertura = hechos ? SUPERFICIE_VIDEO_GUIA.apertura(hechos, {}) : null;
  const idActual = apertura?.id ?? null;

  // La pregunta de ahora pide la atención: el resto se opaca y su mensaje queda marcado (un toque fuera del chat lo apaga). Si la
  // tarjeta del chat estaba plegada, se abre: una pregunta adentro de una sección escondida no se ve.
  useEffect(() => {
    if (idActual) desplegarCrear(TAB_CREAR);
    destacarEnElChat(!!idActual);
    return () => destacarEnElChat(false);
  }, [idActual]);

  // También con su propio modal abierto (el guion, la voz) o una foto subiendo: si no, la pregunta de los subtítulos aparecía detrás.
  const hablando = !!idActual || guionAbierto || clonando || subiendo;
  useEffect(() => {
    onHablando?.(hablando);
  }, [hablando, onHablando]);
  useEffect(() => () => onHablando?.(false), [onHablando]);

  // Lo contestado y lo salteado quedan en el PROYECTO; `ir` y `hacer` no se anotan: el hecho cambia solo (subió la foto, grabó la
  // voz, guardó el guion), y si no cambió, el paso sigue ahí.
  const elegir = (b: Boton<AccionVideoGuia>) => {
    if (!apertura) return;
    if (b.tipo === 'respuesta') {
      cambiarGuia(proyectoId, (x) => conEleccion(x, apertura.id, b.valor));
      setCharla((xs) => [...xs, { mako: apertura.texto, yo: b.rotulo }]);
    } else if (b.tipo === 'callar') {
      cambiarGuia(proyectoId, (x) => conEleccion(x, apertura.id, VALOR.saltado));
      setCharla((xs) => [...xs, { mako: apertura.texto, yo: b.rotulo }]);
    }
  };
  const estado: EstadoApertura<AccionVideoGuia> = { apertura, charla: apertura ? charla : [], elegir };

  const subirFoto = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setSubiendo(true);
    // La nueva es la que no estaba antes: la ruta devuelve TODAS las fotos, y el orden no promete que la última sea la recién subida.
    const antes = new Set((datos?.fotos ?? []).map((x) => x.id));
    try {
      const fd = new FormData();
      fd.append('file', f);
      const j = (await (await fetch('/api/onboarding/persona', { method: 'POST', body: fd })).json()) as {
        ok: boolean; error?: string; warnings?: string[]; fotos?: { id: string; url: string | null }[];
      };
      if (!j.ok) { toast.error(j.error || 'No se pudo subir la foto.'); return; }
      const lista = (j.fotos ?? []).filter((x): x is { id: string; url: string } => !!x.url);
      const nueva = lista.find((x) => !antes.has(x.id)) ?? null;
      setDatos((d) => ({ fotos: lista, personajes: d?.personajes ?? [], leidas: true }));
      // La ruta saltea lo que no es una imagen o pasa de 15 MB, y lo dice: eso se le muestra, no un «quedó» falso.
      for (const w of j.warnings ?? []) toast.error(w);
      if (!nueva) return;
      cambiarGuia(proyectoId, (x) => conEleccion(x, PASO.personaje, `foto:${nueva.id}`));
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
      cambiarGuia(proyectoId, (x) => conEleccion(x, PASO.clips, VALOR.visto));
    },
    'subir-foto': () => { if (!subiendo) campo.current?.click(); },
    'grabar-voz': () => setClonando(true),
  };

  if (!estadoGuia) return null;
  const pasos = hechos ? pasosDeLaGuia(hechos) : [];
  return (
    <>
      {apertura ? (
        <div data-mako-destacado="" style={{ borderRadius: 14 }}>
          <AperturaMako estado={estado} quien={quien} acciones={acciones} />
        </div>
      ) : hechos && !hechos.ocupado && pasos.length > 0 && (
        <ResumenGuia pasos={pasos} onRetomar={(id) => cambiarGuia(proyectoId, (x) => sinEleccion(x, id))} onGuion={() => setGuionAbierto(true)} />
      )}
      <input ref={campo} type="file" accept="image/*" hidden onChange={(e) => void subirFoto(e.target.files)} />
      {guionAbierto && (
        <EditorGuion inicial={estadoGuia.guion} onCerrar={() => setGuionAbierto(false)}
          onGuardar={(g) => { cambiarGuia(proyectoId, (x) => conGuion(x, g)); setGuionAbierto(false); toast('Guion guardado'); }} />
      )}
      {clonando && (
        <ModalClonar destino="propia" hayKey={voz?.hayKey ?? false} onCerrar={() => setClonando(false)}
          onListo={() => {
            setClonando(false);
            setVoz((v) => ({ clonada: true, hayKey: v?.hayKey ?? true }));
            cambiarGuia(proyectoId, (x) => conEleccion(x, PASO.voz, VALOR.vozClonada));
          }} />
      )}
    </>
  );
}

const ROTULO_ESTADO: Record<PasoDeLaGuia['estado'], string> = { listo: 'Listo', saltado: 'Lo salteaste', pendiente: 'Falta' };

/**
 * La lista de pasos cuando MaKo no tiene qué preguntar: lo hecho, lo salteado (con «Retomar», que lo vuelve a preguntar) y, con
 * todo hecho, lo que sigue. El guion se reabre desde acá. Un renglón por paso, sin párrafos.
 */
function ResumenGuia({ pasos, onRetomar, onGuion }: { pasos: PasoDeLaGuia[]; onRetomar: (id: string) => void; onGuion: () => void }) {
  const todo = pasos.every((p) => p.estado === 'listo');
  return (
    <div className="grid gap-1.5 self-stretch rounded-[12px] border border-(--border) bg-(--surface) px-3 py-2.5" aria-label="Los pasos de tu video">
      <p className="m-0 text-[12px] font-semibold text-(--ink)">Tu video</p>
      <ul className="m-0 grid list-none gap-1 p-0">
        {pasos.map((p) => (
          <li key={p.id} className="flex min-w-0 items-center justify-between gap-2 text-[12px]">
            <span className="min-w-0 truncate text-(--ink)">{p.nombre}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={p.estado === 'listo' ? 'text-(--primary-strong)' : 'text-(--faint)'}>{ROTULO_ESTADO[p.estado]}</span>
              {p.estado === 'saltado' && (
                <button type="button" onClick={() => onRetomar(p.id)} className="cursor-pointer text-(--primary-strong) hover:underline">Retomar</button>
              )}
              {p.id === PASO.guion && p.estado === 'listo' && (
                <button type="button" onClick={onGuion} className="cursor-pointer text-(--primary-strong) hover:underline">Editar</button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {todo && <p className="m-0 text-[12px] text-(--faint)">{LINEA_FINAL}</p>}
    </div>
  );
}
