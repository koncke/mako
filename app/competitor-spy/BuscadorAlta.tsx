'use client';

// =============================================================================
// BuscadorAlta — «Mirar a alguien más»: el buscador de merrin, tal cual (3/11/2026)
// =============================================================================
// Martín, 3/11: «No se mejoró ni el modal, sigue horrible el diseño... Y no tiene sentido que tenga 2
// tabs... La tab de "pegar un dato" no tiene sentido, eliminala». Y antes, cuatro veces: «te pido por favor
// que visualmente lo copies de otro dashboard, no te inventes cosas».
//
// ⚠️ SE EMPEZÓ POR LA REFERENCIA, NO POR LO NUESTRO. Es el `.finder` de demo.codeandchill.store/merrin/, la
// plantilla de un CRM: el buscador de ⌘K, que es exactamente esta tarea (escribir, ver filas, elegir una).
// Medidas y reglas en docs/diseno/referencia-spy.md. Lo que se ve acá es eso con los tokens de MaKo:
//   · 620 px, a 12vh de arriba, r 22, sombra + línea de 1 px. En el teléfono, a 10 px del borde.
//   · El campo NO es un campo: 60 px sobre la misma tarjeta, sin fondo y sin borde, con un filete abajo.
//     Por eso no se ve gris. El gris venía del `campo` del alta del CRM, que no se copió.
//   · Filas de 53 px: círculo o ícono de 36, negrita y línea chica, flecha a la derecha.
//   · Grupos en versalita de 11 px, y el pie con las teclas.
//   · Vacío, sin escribir: lo que ya existe. En merrin son pedidos y clientes; acá, a quiénes ya mira.
//     Y lo mismo al escribir: así nadie agrega dos veces a la misma persona.
//
// LO QUE SE FUE, y era el motivo de la queja (medido en producción el 3/11, a 480 × 254 px):
//   · `padding: 0` en la caja: el texto pegado a los bordes.
//   · Las dos pestañas, y dos botones «Buscar» a la vista.
//   · Dos campos para lo mismo. Ahora es uno, y lo escrito decide (`queSeHace`, lib/spy-alta-reglas.ts): un
//     canal de YouTube o un sitio no se buscan en Instagram, salen como UNA fila y siguen igual que los demás.
//   · «Cargar a mano»: de un nombre sin redes sale una fila, y sus otros canales se suman desde la ficha.
//
// ⚠️ NADA ENTRA SIN EL «SÍ» (Martín, 2/11: «súper importante que lo valides»). Elegir una fila lleva a la
// confirmación con su cara; sólo «Sí, agregar» guarda. Buscar por nombre trae a otras personas.
//
// ⚠️ LA LISTA NO VA EN UN PORTAL COMO EN EL ALTA DEL CRM. Allá el campo vive en un formulario y la lista flota
// encima; acá la lista ES el modal.
// =============================================================================

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as TeclaReact } from 'react';
import { Icon } from '../_components/icons';
import { useConectarIntegracion } from '../_components/ConectarIntegracion';
import { useBusquedaInstagram, type PerfilIg } from '@/app/crm/new/InstagramBuscador';
import { avisoSinResultados, perfilManual, pideConectarMeta, usuarioDeTexto } from '@/lib/instagram-buscar';
import { fotoPorNosotros } from '@/lib/foto-instagram-reglas';
import { dibujarContador } from '@/lib/spy-reglas';
import { caricaturaDeCompetidor, nombreDeTarjeta } from '@/lib/spy-caricatura';
import { ESPERA_COMPLETAR_MS, coincideCompetidor, cualesCompletar, queSeHace, usuarioDelNombre, type OpcionDirecta } from '@/lib/spy-alta-reglas';
import type { Competidor } from '@/lib/spy';
import { vistaPreviaAction, type VistaPrevia } from './actions';

/* Sin comillas invertidas adentro de este CSS: cierran el template literal. */
const CSS = `
.spy-velo{position:fixed;inset:0;z-index:300;background:rgba(18,20,16,.38);animation:mkFade .16s ease}
[data-tema="oscuro"] .spy-velo{background:rgba(0,0,0,.55)}
.spy-finder{position:fixed;z-index:300;top:12vh;left:50%;width:min(620px,calc(100vw - 24px));
  margin-left:max(-310px,calc(12px - 50vw));overflow:hidden;border-radius:22px;background:var(--surface);
  color:var(--ink);box-shadow:var(--sombra-modal),inset 0 0 0 1px var(--border-strong);animation:mkPop .2s cubic-bezier(.2,.7,.3,1)}
.spy-finder:focus{outline:0}
.spy-finder__in{display:flex;align-items:center;gap:10px;height:60px;padding:0 16px;
  border-bottom:1px solid var(--border);color:var(--faint)}
.spy-finder__in input{flex:1;min-width:0;height:100%;border:0;outline:0;background:none;
  font:inherit;font-size:17px;font-weight:500;color:var(--ink)}
.spy-finder__in input::placeholder{color:var(--faint);opacity:1}
.spy-finder__pregunta{flex:1;min-width:0;font-size:17px;font-weight:600;color:var(--ink)}
.spy-finder__volver{display:grid;place-items:center;flex:none;width:34px;height:34px;margin-left:-6px;border:0;
  border-radius:10px;background:none;color:var(--ink);cursor:pointer}
.spy-finder__volver:hover{background:var(--surface-2)}
.spy-kbd{display:inline-grid;place-items:center;flex:none;min-width:26px;height:24px;padding:0 6px;border:0;border-radius:7px;
  background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border);font:inherit;font-size:11px;font-weight:700;color:var(--faint)}
button.spy-kbd{cursor:pointer}
.spy-finder__lista{max-height:min(56vh,460px);padding:8px;overflow-y:auto}
.spy-finder__grupo{display:flex;justify-content:space-between;gap:8px;padding:10px 10px 4px;font-size:11px;font-weight:700;
  letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
.spy-finder__fila{display:flex;align-items:center;gap:12px;width:100%;padding:8px 10px;border-radius:12px;text-align:left;cursor:pointer}
.spy-finder__fila[aria-selected="true"]{background:var(--surface-2)}
.spy-finder__flecha{flex:none;color:var(--faint)}
.spy-finder__texto{flex:1;min-width:0}
.spy-finder__texto b{display:block;overflow:hidden;font-size:14px;font-weight:600;line-height:20px;white-space:nowrap;text-overflow:ellipsis}
.spy-finder__texto small{display:block;overflow:hidden;font-size:12px;font-weight:500;line-height:17px;color:var(--faint);white-space:nowrap;text-overflow:ellipsis}
.spy-finder__ico{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:10px;
  background:var(--surface-2);color:var(--dim)}
.spy-finder__fila[aria-selected="true"] .spy-finder__ico{background:var(--surface)}
.spy-finder__cara{display:grid;place-items:center;flex:none;width:36px;height:36px;overflow:hidden;border-radius:50%;
  background:var(--t1);color:var(--t-ink);font-size:12px;font-weight:700}
.spy-finder__cara img{display:block;width:100%;height:100%;object-fit:cover}
.spy-finder__esq{cursor:default}
.spy-hueso{display:block;border-radius:6px;background:var(--surface-2);animation:spy-latido 1.4s var(--ease-out) infinite}
.spy-hueso--cara{flex:none;width:36px;height:36px;border-radius:50%}
.spy-hueso--b{width:42%;height:12px;margin:4px 0 7px}
.spy-hueso--s{width:64%;height:10px;margin:3px 0 4px}
.spy-finder__vacio{display:flex;flex-direction:column;align-items:center;gap:6px;padding:32px 20px;text-align:center;color:var(--faint)}
.spy-finder__vacio b{font-size:15px;font-weight:600;color:var(--ink)}
.spy-finder__vacio p{margin:0;max-width:40ch;font-size:12.5px;line-height:1.5}
.spy-finder__vacio button{margin-top:6px}
.spy-finder__pie{display:flex;gap:14px;padding:10px 16px;border-top:1px solid var(--border);font-size:12px;color:var(--faint)}
.spy-finder__pie span{display:inline-flex;align-items:center;gap:6px}
.spy-finder__quien{display:grid;grid-template-columns:176px minmax(0,1fr);gap:18px;padding:18px 20px}
.spy-finder__rostro{display:grid;place-items:center;width:176px;aspect-ratio:1/1;overflow:hidden;border-radius:18px;
  background:var(--t1);color:var(--t-ink);font-size:56px;font-weight:700}
.spy-finder__rostro img{display:block;width:100%;height:100%;object-fit:cover}
.spy-finder__datos{min-width:0;display:flex;flex-direction:column;gap:6px}
.spy-finder__datos b{font-size:20px;font-weight:700;letter-spacing:-.015em;line-height:1.2;overflow-wrap:anywhere}
.spy-finder__datos small{font-size:12.5px;line-height:1.45;color:var(--faint);overflow-wrap:anywhere}
.spy-finder__bio{margin:2px 0 0;font-size:13.5px;line-height:1.45;color:var(--dim);
  display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.spy-finder__nota{margin:0 20px 12px;font-size:12.5px;line-height:1.45;color:var(--faint)}
.spy-finder__nota--mal{color:var(--bad)}
.spy-finder__botones{display:flex;justify-content:flex-end;gap:8px;padding:0 20px 20px}
.spy-solo-tactil{display:none}
@media (max-width:760px){
  .spy-finder{top:calc(10px + env(safe-area-inset-top))}
  .spy-finder__in input{font-size:16px}
  .spy-finder__lista{max-height:min(64dvh,520px)}
  .spy-finder__quien{grid-template-columns:minmax(0,1fr);padding:16px}
  .spy-finder__rostro{width:min(100%,200px);margin:0 auto}
  .spy-finder__botones{padding:0 16px 16px}
  .spy-finder__botones .spy-boton{flex:1}
}
@media (hover:none){
  .spy-finder__pie{display:none}
  .spy-solo-teclado{display:none}
  .spy-solo-tactil{display:inline-grid}
}
@media (prefers-reduced-motion:reduce){.spy-hueso{animation:none}}
`;

/** El tope de la ruta del perfil (60 s) + un margen: un `fetch` sin tope es un giro eterno. */
const TOPE_PERFIL_MS = 62_000;
const MAX_MIRADOS = 6;

type PerfilCompleto = { usuario: string; nombre: string | null; foto: string | null; seguidores: number | null; bio: string | null; web: string | null };

type Fila =
  | { k: string; tipo: 'mirado'; grupo: string; c: Competidor }
  | { k: string; tipo: 'perfil'; grupo: string; p: PerfilIg }
  | { k: string; tipo: 'usar'; grupo: string; usuario: string }
  | { k: string; tipo: 'directo'; grupo: string; o: OpcionDirecta }
  | { k: string; tipo: 'nombre'; grupo: string; nombre: string };

const FLECHA = (
  <svg className="spy-finder__flecha" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const inicial = (s: string) => s.replace(/^@/, '').charAt(0).toUpperCase() || '?';
const sinProtocolo = (s: string) => s.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const vistaDe = (c: PerfilCompleto): VistaPrevia => ({ campo: 'instagram', valor: c.usuario, nombre: c.nombre, foto: c.foto, seguidores: c.seguidores, bio: c.bio, web: c.web });

/** La cara de una fila: su foto por NUESTRA ruta (directo, el CDN de Instagram la bloquea) o su inicial. */
function Cara({ src, nombre }: { src: string | null; nombre: string }) {
  const [rota, setRota] = useState<string | null>(null);
  return (
    <span className="spy-finder__cara" aria-hidden>
      {src && rota !== src
        // eslint-disable-next-line @next/next/no-img-element -- la sirve nuestra ruta o nuestro bucket: acá sólo se mira
        ? <img src={src} alt="" loading="lazy" onError={() => setRota(src)} />
        : inicial(nombre)}
    </span>
  );
}

const QUE_ES: Record<VistaPrevia['campo'], string> = {
  instagram: 'Instagram', youtube_id: 'Canal de YouTube', tiktok: 'TikTok', landing_url: 'Sitio', nombre: 'Nombre',
};
const PREGUNTA: Record<VistaPrevia['campo'], string> = {
  instagram: '¿Es esta persona?', youtube_id: '¿Es este canal?', tiktok: '¿Es este TikTok?', landing_url: '¿Es este sitio?', nombre: '¿Agregar con este nombre?',
};

export function BuscadorAlta({ textoInicial = '', competidores, ocupado, error, onClose, onAgregar, onAbrir }: {
  textoInicial?: string;
  competidores: Competidor[];
  ocupado: boolean;
  error: string | null;
  onClose: () => void;
  /** `nombre` y `web` los leyó la confirmación: no se vuelven a pagar al guardar. */
  onAgregar: (pegado: string, nombre?: string, deLaBio?: string | null) => void;
  /** Alguien que ya se mira: se abre su ficha en vez de agregarlo otra vez. */
  onAbrir: (id: number) => void;
}) {
  const [texto, setTexto] = useState(textoInicial);
  const [activo, setActivo] = useState(0);
  const [ronda, setRonda] = useState(0);
  // Lo que ya se leyó de cada @, y lo que está en camino. Vive lo que el modal: escribir otra cosa y volver no paga dos veces.
  const [completos, setCompletos] = useState<Record<string, PerfilCompleto | null>>({});
  const [completando, setCompletando] = useState<ReadonlySet<string>>(() => new Set());
  const pedidos = useRef(new Set<string>());
  const enCamino = useRef(new Map<string, Promise<PerfilCompleto | null>>());
  const sinCupo = useRef(false);
  // La confirmación.
  const [elegido, setElegido] = useState<{ pegado: string } | null>(null);
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [errorVista, setErrorVista] = useState<string | null>(null);
  const [fotoRota, setFotoRota] = useState(false);
  const vigencia = useRef(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const cajaRef = useRef<HTMLDivElement>(null);
  const idLista = useId();

  const t = texto.trim();
  const accion = useMemo(() => queSeHace(t), [t]);
  const consulta = accion.que === 'buscar' ? accion.consulta : t;
  // Los @ que ya se miran: no se buscan ni se ofrecen, salen arriba en «Ya los miras». Buscar a quien ya está es gastar para nada.
  const ya = useMemo(() => new Set(competidores.map((c) => (c.instagram ?? '').toLowerCase()).filter(Boolean)), [competidores]);
  const buscable = accion.que === 'buscar' && !(consulta.startsWith('@') && ya.has(consulta.slice(1)));
  const [resp, setResp] = useBusquedaInstagram(consulta, buscable, ronda, () => setActivo(0));
  const actual = resp && resp.texto === consulta ? resp : null;
  const encontrados = actual && 'perfiles' in actual ? actual.perfiles : null;
  const fallo = !!actual && 'fallo' in actual;
  const limite = !!actual && 'limite' in actual && actual.limite;
  const buscando = buscable && !actual;
  const delNombre = buscable ? usuarioDelNombre(consulta) : null;

  const integracion = useConectarIntegracion({ onConectado: () => { setResp(null); setRonda((n) => n + 1); } });
  const conectando = integracion.abierto != null;

  // ── Completar solas las primeras filas ─────────────────────────────────────
  // ⚠️ NO EN CADA TECLA: espera a que la lista esté y a que la persona deje de escribir. Lo que ya viene con foto y nombre no
  // se lee (`cualesCompletar`), y el servidor frena solo antes de agotar el tope (`RESERVA_DEL_ALTA`).
  useEffect(() => {
    if (!encontrados || sinCupo.current) return;
    const pedir = cualesCompletar(encontrados, pedidos.current, delNombre);
    if (!pedir.length) return;
    const ctrl = new AbortController();
    const tope = setTimeout(() => ctrl.abort(), ESPERA_COMPLETAR_MS + TOPE_PERFIL_MS);
    const espera = setTimeout(() => {
      for (const u of pedir) pedidos.current.add(u);
      setCompletando((v) => new Set([...v, ...pedir]));
      for (const u of pedir) {
        enCamino.current.set(u, (async () => {
          try {
            const r = await fetch(`/api/competitor-spy/perfil?usuario=${encodeURIComponent(u)}`, { signal: ctrl.signal });
            const j = (await r.json().catch(() => null)) as { ok?: boolean; perfil?: PerfilCompleto | null; limite?: boolean } | null;
            if (j?.limite) sinCupo.current = true;
            const perfil = j?.ok ? j.perfil ?? null : null;
            setCompletos((v) => ({ ...v, [u]: perfil }));
            return perfil;
          } catch {
            // Cancelado porque cambió lo escrito: el servidor igual terminó y lo guardó, así que volver a pedirlo es gratis.
            pedidos.current.delete(u);
            return null;
          } finally {
            enCamino.current.delete(u);
            setCompletando((v) => { const n = new Set(v); n.delete(u); return n; });
          }
        })());
      }
    }, ESPERA_COMPLETAR_MS);
    return () => { clearTimeout(espera); clearTimeout(tope); ctrl.abort(); };
  }, [encontrados, delNombre]);

  // ── Las filas ──────────────────────────────────────────────────────────────
  const filas: Fila[] = useMemo(() => {
    const out: Fila[] = [];
    const mirados = t ? competidores.filter((c) => coincideCompetidor(c, t, nombreDeTarjeta(c))) : competidores;
    for (const c of mirados.slice(0, MAX_MIRADOS)) out.push({ k: `c:${c.id}`, tipo: 'mirado', grupo: 'Ya los miras', c });
    if (accion.que === 'directo') {
      out.push({ k: `d:${accion.opcion.campo}`, tipo: 'directo', grupo: accion.opcion.grupo, o: accion.opcion });
      if (accion.tambienUsuario && !ya.has(accion.tambienUsuario)) out.push({ k: `u:${accion.tambienUsuario}`, tipo: 'usar', grupo: 'Instagram', usuario: accion.tambienUsuario });
    }
    if (accion.que === 'buscar') {
      const conDatos = (p: PerfilIg): PerfilIg => {
        const c = completos[p.usuario];
        return c ? { usuario: p.usuario, nombre: c.nombre ?? p.nombre, foto: c.foto ?? p.foto } : p;
      };
      // El @ del nombre pegado sólo aparece si esa cuenta EXISTE: lo dijo la lectura, no una suposición.
      const hallado = delNombre ? completos[delNombre] : null;
      const lista = [
        ...(hallado && !(encontrados ?? []).some((p) => p.usuario === delNombre) ? [{ usuario: hallado.usuario, nombre: hallado.nombre, foto: hallado.foto }] : []),
        ...(encontrados ?? []).map(conDatos),
      ];
      for (const p of lista) if (!ya.has(p.usuario)) out.push({ k: `p:${p.usuario}`, tipo: 'perfil', grupo: 'Instagram', p });
      const manual = perfilManual(consulta);
      if (manual && !ya.has(manual.usuario) && !lista.some((p) => p.usuario === manual.usuario)) {
        out.push({ k: `u:${manual.usuario}`, tipo: 'usar', grupo: 'Instagram', usuario: manual.usuario });
      }
      if (!usuarioDeTexto(consulta) && actual) out.push({ k: 'n', tipo: 'nombre', grupo: 'Sin redes', nombre: t });
    }
    return out;
  }, [t, consulta, ya, competidores, accion, encontrados, completos, delNombre, actual]);

  const iActivo = filas.length ? Math.min(activo, filas.length - 1) : -1;
  const idFila = (i: number) => `${idLista}-${i}`;

  // El scroll sigue al teclado y nada más: si siguiera al mouse, pasar por una fila a medio ver movería la lista bajo el dedo.
  const moverA = (i: number) => {
    setActivo(i);
    requestAnimationFrame(() => document.getElementById(idFila(i))?.scrollIntoView({ block: 'nearest' }));
  };

  // ── Elegir y confirmar ─────────────────────────────────────────────────────
  const irAConfirmar = useCallback(async (pegado: string, ya: VistaPrevia | null, leyendo?: Promise<PerfilCompleto | null>) => {
    const turno = ++vigencia.current;
    setElegido({ pegado }); setVista(ya); setErrorVista(null); setFotoRota(false);
    cajaRef.current?.focus();
    if (ya) return;
    // ⚠️ SI ESA FILA YA SE ESTÁ LEYENDO, SE LA ESPERA: pedir otra pagaría dos veces a la misma persona, y es lo más común del
    // mundo, porque se elige justo mientras las filas se están completando.
    const c = leyendo ? await leyendo : null;
    if (turno !== vigencia.current) return;
    if (c) { setVista(vistaDe(c)); return; }
    const r = await vistaPreviaAction(pegado).catch(() => ({ ok: false as const, error: 'No pude leerlo ahora. Prueba de nuevo en un rato.' }));
    if (turno !== vigencia.current) return;
    if (r.ok) setVista(r.vista);
    else setErrorVista(r.error);
  }, []);

  const elegirUsuario = (usuario: string) => {
    const c = completos[usuario];
    void irAConfirmar(`@${usuario}`, c ? vistaDe(c) : null, enCamino.current.get(usuario));
  };

  const elegir = (f: Fila) => {
    if (f.tipo === 'mirado') onAbrir(f.c.id);
    else if (f.tipo === 'perfil') elegirUsuario(f.p.usuario);
    else if (f.tipo === 'usar') elegirUsuario(f.usuario);
    else if (f.tipo === 'directo') void irAConfirmar(t, { campo: f.o.campo, valor: f.o.valor });
    else void irAConfirmar(t, { campo: 'nombre', valor: f.nombre });
  };

  const volver = useCallback(() => {
    vigencia.current++;
    setElegido(null); setVista(null); setErrorVista(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const agregar = () => {
    if (!elegido || !vista || ocupado) return;
    onAgregar(elegido.pegado, vista.nombre?.trim() || undefined, vista.web ?? null);
  };

  // ── Lo de cualquier modal: el fondo quieto, el foco adentro y la tecla Escape ───────
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => { document.body.style.overflow = antes; previo?.focus?.(); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Con el modal de Meta encima, el Escape es de él.
      if (e.key !== 'Escape' || conectando) return;
      e.stopPropagation();
      if (elegido) volver();
      else onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [conectando, elegido, volver, onClose]);

  const cicloDelTab = (e: TeclaReact<HTMLDivElement>) => {
    // Enter confirma, como elige en la lista. `repeat` afuera: dejar la tecla apretada no puede contestar «sí» sin haber mirado.
    if (elegido && e.key === 'Enter' && !e.repeat && e.target === cajaRef.current) { e.preventDefault(); agregar(); return; }
    if (e.key !== 'Tab') return;
    const focables = cajaRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href]');
    if (!focables?.length) return;
    const primero = focables[0];
    const ultimo = focables[focables.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  };

  const onTecla = (e: TeclaReact<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && filas.length) {
      e.preventDefault();
      moverA((iActivo + 1) % filas.length);
    } else if (e.key === 'ArrowUp' && filas.length) {
      e.preventDefault();
      moverA((iActivo - 1 + filas.length) % filas.length);
    } else if (e.key === 'Enter' && iActivo >= 0) {
      e.preventDefault();
      elegir(filas[iActivo]);
    }
  };

  const esc = (
    <button type="button" className="spy-kbd" aria-label="Cerrar" onClick={onClose}>
      <span className="spy-solo-teclado">esc</span>
      <span className="spy-solo-tactil"><Icon name="x" size={13} /></span>
    </button>
  );

  // ── Lo que dice la lista cuando no tiene qué mostrar ──────────────────────
  const meta = actual && 'meta' in actual ? actual.meta : null;
  const sinPerfiles = !buscando && !filas.some((f) => f.tipo === 'perfil');
  const leyendoAlguno = completando.size > 0;
  const pideConectar = pideConectarMeta(meta);
  const vacio = (() => {
    if (accion.que === 'no-reconocido') return { titulo: 'No reconozco ese enlace', texto: 'Pega el de su canal: el que lleva su @ o /channel/.' };
    if (!t && !competidores.length) return { titulo: 'A quién quieres mirar', texto: 'Escribe su nombre, su @, su canal de YouTube o su sitio.' };
    if (t && accion.que === 'nada' && !filas.length) return { titulo: 'Sigue escribiendo', texto: 'Con 3 letras ya busco.' };
    if (!buscable || !actual) return null;
    if (fallo) return { titulo: 'No pude buscar', texto: 'Prueba de nuevo en un rato, o escribe su @ exacto.' };
    if (limite) return { titulo: 'Ya no quedan búsquedas por hoy', texto: 'Se renuevan mañana. Si sabes su @, puedes agregarlo igual.' };
    if (sinPerfiles && !leyendoAlguno) {
      // Por nombre se dice sin el «por nombre no se puede» del alta del CRM: acá buscar por nombre sí anda, y esta vez no trajo nada.
      const conArroba = usuarioDeTexto(consulta) != null;
      return { titulo: 'No encontré a nadie', texto: conArroba ? avisoSinResultados({ esUsuario: true, meta, porNombre: 'porNombre' in actual ? actual.porNombre : null }) : 'Prueba con su @ exacto.' };
    }
    return null;
  })();

  // ── La confirmación: el mismo cuadro, con su cara ──────────────────────────
  if (elegido) {
    const nombre = vista?.nombre || sinProtocolo(vista?.valor ?? elegido.pegado);
    const foto = !fotoRota ? fotoPorNosotros(vista?.foto) : null;
    const detalle = vista && [
      QUE_ES[vista.campo],
      vista.campo === 'instagram' ? `@${vista.valor}` : null,
      vista.seguidores != null ? `${dibujarContador(vista.seguidores)} seguidores` : null,
    ].filter(Boolean).join(' · ');
    return (
      <>
        <style>{CSS}</style>
        <div className="spy-velo" onClick={onClose} />
        <div ref={cajaRef} tabIndex={-1} className="spy-finder" role="dialog" aria-modal="true" aria-label="Mirar a alguien más" onKeyDown={cicloDelTab}>
          <div className="spy-finder__in">
            <button type="button" className="spy-finder__volver" aria-label="Volver a la lista" onClick={volver}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            </button>
            <span className="spy-finder__pregunta">{vista ? PREGUNTA[vista.campo] : errorVista ? 'No pude leerlo' : 'Leyendo su perfil…'}</span>
            <button type="button" className="spy-kbd" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={13} /></button>
          </div>
          {!errorVista && (
            <div className="spy-finder__quien" aria-busy={!vista}>
              <span className="spy-finder__rostro" aria-hidden>
                {!vista
                  ? <span className="spy-hueso" style={{ width: '100%', height: '100%' }} />
                  // eslint-disable-next-line @next/next/no-img-element -- la sirve nuestra ruta: acá sólo se mira
                  : foto ? <img src={foto} alt="" onError={() => setFotoRota(true)} />
                    : vista.campo === 'youtube_id' ? <Icon name="youtube" size={56} />
                      : vista.campo === 'landing_url' ? <Icon name="web" size={56} /> : inicial(nombre)}
              </span>
              <span className="spy-finder__datos">
                {!vista
                  ? (
                    <>
                      <span className="spy-hueso" style={{ width: '70%', height: 20 }} />
                      <span className="spy-hueso" style={{ width: '55%', height: 12 }} />
                      <span className="spy-hueso" style={{ width: '90%', height: 12, marginTop: 8 }} />
                      <span className="spy-hueso" style={{ width: '80%', height: 12 }} />
                    </>
                  )
                  : (
                    <>
                      <b>{nombre}</b>
                      <small>{detalle}</small>
                      {vista.bio && <p className="spy-finder__bio">{vista.bio}</p>}
                      {vista.web && <small>Su web: {sinProtocolo(vista.web)}</small>}
                    </>
                  )}
              </span>
            </div>
          )}
          {errorVista && <p className="spy-finder__nota spy-finder__nota--mal" style={{ marginTop: 16 }}>{errorVista}</p>}
          {/* Un perfil que no se pudo leer NO frena el alta: se dice y se deja agregar igual. */}
          {vista?.aviso && <p className="spy-finder__nota">{vista.aviso}</p>}
          {error && <p className="spy-finder__nota spy-finder__nota--mal">{error}</p>}
          <div className="spy-finder__botones">
            <button type="button" className="spy-boton" disabled={ocupado} onClick={volver}>No, volver</button>
            <button type="button" className="spy-boton spy-boton-primario" disabled={!vista || ocupado} onClick={agregar}>
              {ocupado ? 'Un momento…' : 'Sí, agregar'}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── La lista ───────────────────────────────────────────────────────────────
  // El grupo se escribe una sola vez, arriba de su primera fila.
  const grupos: Array<{ nombre: string; desde: number; filas: Fila[] }> = [];
  filas.forEach((f, i) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.nombre === f.grupo) ultimo.filas.push(f);
    else grupos.push({ nombre: f.grupo, desde: i, filas: [f] });
  });
  const iInstagram = grupos.findIndex((g) => g.nombre === 'Instagram');

  const dibujarFila = (f: Fila, i: number) => {
    const comun = {
      id: idFila(i), role: 'option' as const, 'aria-selected': i === iActivo, className: 'spy-finder__fila',
      onMouseEnter: () => setActivo(i), onClick: () => elegir(f),
    };
    if (f.tipo === 'mirado') {
      const titulo = nombreDeTarjeta(f.c);
      const canales = [f.c.instagram ? 'Instagram' : null, f.c.youtube_id ? 'YouTube' : null, f.c.tiktok ? 'TikTok' : null, f.c.landing_url ? 'Su web' : null].filter(Boolean).join(' · ');
      return (
        <div key={f.k} {...comun}>
          <Cara src={f.c.avatar || caricaturaDeCompetidor(f.c)} nombre={titulo} />
          <span className="spy-finder__texto"><b>{titulo}</b><small>{canales || 'Sin canales todavía'}</small></span>
          {FLECHA}
        </div>
      );
    }
    if (f.tipo === 'perfil') {
      const c = completos[f.p.usuario];
      const seguidores = c?.seguidores != null ? `${dibujarContador(c.seguidores)} seguidores` : null;
      const enCamino = completando.has(f.p.usuario);
      return (
        <div key={f.k} {...comun}>
          {enCamino && !f.p.foto ? <span className="spy-hueso spy-hueso--cara" aria-hidden /> : <Cara src={fotoPorNosotros(f.p.foto)} nombre={f.p.nombre || f.p.usuario} />}
          <span className="spy-finder__texto">
            <b>{f.p.nombre || `@${f.p.usuario}`}</b>
            {f.p.nombre || seguidores
              ? <small>{[`@${f.p.usuario}`, seguidores].filter(Boolean).join(' · ')}</small>
              : enCamino ? <span className="spy-hueso spy-hueso--s" aria-hidden /> : <small>Ver quién es</small>}
          </span>
          {FLECHA}
        </div>
      );
    }
    if (f.tipo === 'usar') {
      return (
        <div key={f.k} {...comun}>
          <span className="spy-finder__ico" aria-hidden><Icon name="instagram" size={18} /></span>
          <span className="spy-finder__texto"><b>Usar @{f.usuario}</b><small>Tal como lo escribiste</small></span>
          {FLECHA}
        </div>
      );
    }
    if (f.tipo === 'directo') {
      return (
        <div key={f.k} {...comun}>
          <span className="spy-finder__ico" aria-hidden><Icon name={f.o.campo === 'youtube_id' ? 'youtube' : 'web'} size={18} /></span>
          <span className="spy-finder__texto"><b>{f.o.titulo}</b><small>{f.o.detalle}</small></span>
          {FLECHA}
        </div>
      );
    }
    return (
      <div key={f.k} {...comun}>
        <span className="spy-finder__ico" aria-hidden><Icon name="users" size={18} /></span>
        <span className="spy-finder__texto"><b>Agregar «{f.nombre}»</b><small>Con su nombre: sus redes las buscas después</small></span>
        {FLECHA}
      </div>
    );
  };

  const huesos = buscando && (
    <>
      {iInstagram < 0 && <div className="spy-finder__grupo"><span>Instagram</span><span>Buscando…</span></div>}
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="spy-finder__fila spy-finder__esq" aria-hidden>
          <span className="spy-hueso spy-hueso--cara" />
          <span className="spy-finder__texto"><span className="spy-hueso spy-hueso--b" /><span className="spy-hueso spy-hueso--s" /></span>
        </div>
      ))}
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="spy-velo" onClick={onClose} />
      <div ref={cajaRef} tabIndex={-1} className="spy-finder" role="dialog" aria-modal="true" aria-label="Mirar a alguien más" onKeyDown={cicloDelTab}>
        <div className="spy-finder__in">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            type="text"
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setActivo(0); }}
            onKeyDown={onTecla}
            placeholder="Nombre, @, canal de YouTube o sitio"
            aria-label="Buscar a quién mirar"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={filas.length > 0}
            aria-controls={idLista}
            aria-activedescendant={iActivo >= 0 ? idFila(iActivo) : undefined}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          {esc}
        </div>
        <div id={idLista} className="spy-finder__lista" role="listbox" aria-label="Resultados" aria-busy={buscando} onMouseDown={(e) => e.preventDefault()}>
          {grupos.map((g, ig) => (
            <div key={g.nombre}>
              <div className="spy-finder__grupo">
                <span>{g.nombre}</span>
                {g.nombre === 'Instagram' && buscando && <span>Buscando…</span>}
              </div>
              {ig === iInstagram && huesos}
              {g.filas.map((f, j) => dibujarFila(f, g.desde + j))}
            </div>
          ))}
          {iInstagram < 0 && huesos}
          {vacio && (
            <div className="spy-finder__vacio">
              <b>{vacio.titulo}</b>
              <p>{vacio.texto}</p>
              {/* Sin Meta ni clave de Spy no hay con qué buscar: el botón, ahí mismo y sin salir de la tab. */}
              {pideConectar && (
                <button type="button" className="spy-boton" data-conectar-integracion="meta" onClick={() => integracion.abrir('meta')}>Conectar Meta</button>
              )}
            </div>
          )}
        </div>
        <div className="spy-finder__pie" aria-hidden>
          <span><span className="spy-kbd">↑↓</span> moverte</span>
          <span><span className="spy-kbd">↵</span> elegir</span>
        </div>
      </div>
      {integracion.modal}
    </>
  );
}
