'use client';

// =============================================================================
// /m/comunidad — lo chico que comparten las vistas: el contexto, la cara con su nivel, el reloj, el texto
// con links y menciones, y el pulgar
// =============================================================================
// Escritorio tiene estas piezas en app/_comunidad/piezas.tsx, pero ese módulo es 'use client' y trae el menú
// de los tres puntos, la pila de modales y el contexto de escritorio: el teléfono dibuja SU versión con las
// primitivas de /m, y reusa lo que no es dibujo (los íconos de ./iconos.tsx, `haceCuanto`, el like de la API).
//
// ⚠️ NINGÚN TEXTO DE UNA PERSONA SE INYECTA COMO HTML: el cuerpo llega partido en pedazos (`tokensDeTexto`) y
//    cada uno se dibuja como texto de React; un link es un `<a>` con un href que el server ya validó.
// ⚠️ EL RELOJ ARRANCA EN `null` Y SE PRENDE AL MONTAR (como escritorio): el feed llega dibujado del server, y
//    un «hace 3 min» calculado allá y otro acá no coinciden al hidratar.
// ⚠️ EL PULGAR NUNCA VA DOS VECES A LA VEZ (`enCurso`, un ref): un doble toque mandaría «sí» y «no» en un
//    orden que nadie elige.

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ApiComunidad } from '@/app/_comunidad/api';
import { Ico } from '@/app/_comunidad/iconos';
import type { ComunidadVista, MiembroVista, PostVista } from '@/lib/comunidad-tipos';
import type { TokenTexto } from '@/lib/comunidad-reglas';
import { haptico } from '@/lib/haptico';
import { inicialesM, useConexion, useToastM } from '@/app/m/_ui';
import { R, T, likeOptimista } from './modelo';

// ── El contexto ─────────────────────────────────────────────────────────────────

export type CtxComunidadM = {
  api: ApiComunidad;
  comunidad: ComunidadVista;
  /** El reloj de los «hace cuánto» (cada minuto). `null` hasta montar. */
  ahora: number | null;
  /** Abre un post: con su tarjeta (se dibuja ya) o sólo con su id (`?post=`). */
  abrirPost: (p: PostVista | number) => void;
  abrirPerfil: (clave: string) => void;
  /** Un cambio de un post (el like, los comentarios, el voto) que su tarjeta del feed tiene que ver. */
  cambiarTarjeta: (id: number, cambio: Partial<PostVista>) => void;
};

export const CtxM = createContext<CtxComunidadM | null>(null);

export function useComunidadM(): CtxComunidadM {
  const c = useContext(CtxM);
  if (!c) throw new Error('useComunidadM fuera de <ComunidadM>');
  return c;
}

/** El reloj de la pantalla. La primera lectura en un timeout (un setState sincrónico en un efecto es un render en cascada). */
export function useAhora(): number | null {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    const primera = setTimeout(() => setAhora(Date.now()), 0);
    const t = setInterval(() => setAhora(Date.now()), 60_000);
    return () => { clearTimeout(primera); clearInterval(t); };
  }, []);
  return ahora;
}

// ── La cara con su nivel (abajo a la derecha, como Skool) ─────────────────────────

export function AvatarNivelM({ m, tam = 40, enLinea = false }: {
  m: Pick<MiembroVista, 'nombre' | 'foto' | 'nivel'>;
  tam?: number;
  /** El punto verde de Skool: actividad en los últimos 5 minutos. */
  enLinea?: boolean;
}) {
  const [rota, setRota] = useState(false);
  return (
    <span className="m-comunidad-av" style={{ width: tam, height: tam }} data-grande={tam >= 64 || undefined} aria-hidden>
      {m.foto && !rota ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="m-comunidad-av__foto" src={m.foto} alt="" width={tam} height={tam} referrerPolicy="no-referrer"
          onError={() => setRota(true)} />
      ) : (
        <span className="m-comunidad-av__ini" style={{ fontSize: Math.round(tam * 0.36) }}>{inicialesM(m.nombre)}</span>
      )}
      <span className="m-comunidad-av__nivel">{m.nivel}</span>
      {enLinea && <i className="m-comunidad-av__linea" />}
    </span>
  );
}

// ── El texto ────────────────────────────────────────────────────────────────────

/**
 * Un cuerpo ya partido en texto, links y menciones. La mención va en negrita y NO abre el perfil: abrir una
 * hoja desde la del post la reemplaza (nunca hay dos), y se perdería el post que se estaba leyendo.
 */
export function TextoM({ tokens }: { tokens: readonly TokenTexto[] }) {
  return (
    <p className="m-comunidad-texto">
      {tokens.map((t, i) => {
        if (t.tipo === 'link') return <a key={i} className="m-comunidad-link" href={t.href} target="_blank" rel="noopener noreferrer nofollow">{t.texto}</a>;
        if (t.tipo === 'mencion') return <b key={i} className="m-comunidad-mencion">{t.texto}</b>;
        return <span key={i}>{t.texto}</span>;
      })}
    </p>
  );
}

// ── El pulgar ───────────────────────────────────────────────────────────────────

/**
 * El like de un post (`p:<id>`) o de un comentario (`c:<id>`). Optimista: cambia en el acto y, si el server
 * dice que no, vuelve a lo de antes con el motivo. Lo propio no se likea (apagado; el server lo rechaza igual).
 */
export function LikeM({ objetivo, likes, meGusta, puede, onCambio }: {
  objetivo: string;
  likes: number;
  meGusta: boolean;
  puede: boolean;
  onCambio: (likes: number, meGusta: boolean) => void;
}) {
  const { api } = useComunidadM();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const enCurso = useRef(false);

  const cambiar = async () => {
    if (!puede || enCurso.current) return;
    if (!enLinea) { toast(T.sinConexion); return; }
    const antes = { likes, meGusta };
    const nuevo = likeOptimista(likes, meGusta);
    haptico('light');
    onCambio(nuevo.likes, nuevo.meGusta);
    enCurso.current = true;
    const r = await api.like(objetivo, nuevo.meGusta);
    enCurso.current = false;
    if (r.ok) onCambio(r.likes, r.meGusta);
    else { onCambio(antes.likes, antes.meGusta); toast(r.error); }
  };

  return (
    <button type="button" className="m-comunidad-accion" data-on={meGusta || undefined} aria-pressed={meGusta} disabled={!puede}
      aria-label={puede ? `${meGusta ? R.quitarLike : R.meGusta}, ${likes}` : `${R.esTuyo}, ${likes}`}
      onClick={() => { void cambiar(); }}>
      <Ico n="like" size={20} /><span>{likes}</span>
    </button>
  );
}
