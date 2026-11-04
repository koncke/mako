'use client';

// =============================================================================
// BuscadorAlta — «Mirar a alguien más»: el buscador de merrin, con un grupo por red (4/11/2026)
// =============================================================================
// Martín, 4/11: «La barra principal de búsqueda debería funcionar igual que cuando le doy al "+", solo que ahí
// debería estar diferenciado las redes, Instagram, YouTube, Sitio Web...», «si busco solo nombre, y tarda en buscar,
// debería ir diciéndome "Esto puede tardar 20 segundos..."», «si busco solo el nombre TAMBIÉN debería buscar en
// YouTube... diferenciado de qué red social es... Tal vez con el logo de la red social».
//
// ⚠️ SE COPIÓ DE LA REFERENCIA, NO SE INVENTÓ (3/11/2026): el `.finder` de demo.codeandchill.store/merrin/, el
// buscador de ⌘K de un CRM. Medidas y reglas en docs/diseno/referencia-spy.md. Lo de este cambio son los GRUPOS, que
// es lo que el `.finder` ya hace (pedidos, clientes, productos): acá son Instagram, YouTube, TikTok y Sitio web, cada
// uno con su logo, y cada uno se llena cuando llega lo suyo.
//
// QUÉ SE PIDE Y CUÁNDO lo decide `planDeBusqueda` (lib/spy-buscar-reglas.ts), que se EJECUTA en un test. Acá sólo se
// pide y se dibuja. Los pedidos salen EN PARALELO a /api/competitor-spy/buscar (una ruta y no actions: las actions
// hacen fila), y lo rápido —el @ exacto, el canal de YouTube— no espera a lo lento —el nombre—.
//
// ⚠️ NADA ENTRA SIN EL «SÍ» (Martín, 2/11: «súper importante que lo valides»). Elegir una fila lleva a la
// confirmación con su cara; sólo «Sí, agregar» guarda. Buscar por nombre trae a otras personas.
//
// ⚠️ LA LISTA NO VA EN UN PORTAL COMO EN EL ALTA DEL CRM: acá la lista ES el modal.
// =============================================================================

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as TeclaReact, type ReactNode } from 'react';
import { Icon } from '../_components/icons';
import { BrandDefs, SvcIcon } from '../_components/ServicioVisual';
import { useConectarIntegracion } from '../_components/ConectarIntegracion';
import { fotoPorNosotros } from '@/lib/foto-instagram-reglas';
import { dibujarContador } from '@/lib/spy-reglas';
import { caricaturaDeCompetidor, nombreDeTarjeta } from '@/lib/spy-caricatura';
import { ESPERA_COMPLETAR_MS, coincideCompetidor } from '@/lib/spy-alta-reglas';
import {
  cualesCompletar, esperaDe, filasDeLaBusqueda, planDeBusqueda, pedidosDelPlan,
  type CanalHallado, type FilaBusqueda, type PerfilHallado, type RespuestasBusqueda,
} from '@/lib/spy-buscar-reglas';
import type { Competidor } from '@/lib/spy';
import type { VistaPrevia } from './actions';

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
.spy-finder__red{display:inline-flex;align-items:center;gap:7px}
.spy-finder__aviso{margin:0;padding:6px 14px 10px 40px;font-size:12.5px;color:var(--faint)}
.spy-finder__espera{font-weight:600;letter-spacing:0;text-transform:none;color:var(--faint)}
.spy-finder__avatar{position:relative;flex:none;width:36px;height:36px}
.spy-finder__marca{position:absolute;right:-3px;bottom:-3px;display:grid;place-items:center;border-radius:6px;
  box-shadow:0 0 0 2px var(--surface)}
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

/** El tope de la ruta (60 s) + un margen: un `fetch` sin tope es un giro eterno. */
const TOPE_MS = 62_000;
const MAX_MIRADOS = 6;

const FLECHA = (
  <svg className="spy-finder__flecha" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const inicial = (s: string) => s.replace(/^@/, '').charAt(0).toUpperCase() || '?';
const sinProtocolo = (s: string) => s.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

/** El logo de cada red: el oficial (ServicioVisual.tsx), nunca uno dibujado por nosotros. */
const LOGO: Record<'instagram' | 'youtube' | 'tiktok', string> = { instagram: 'red-instagram', youtube: 'youtube', tiktok: 'red-tiktok' };
function LogoRed({ red, box = 18 }: { red: 'instagram' | 'youtube' | 'tiktok' | 'sitio'; box?: number }) {
  if (red === 'sitio') return <Icon name="web" size={box - 2} />;
  return <SvcIcon k={LOGO[red]} box={box} size={Math.round(box * 0.62)} radius={Math.round(box * 0.28)} />;
}

/** La cara de una fila: su foto por NUESTRA ruta (directo, el CDN de Instagram la bloquea) o su inicial, y el logo de su red en la esquina. */
function Cara({ src, nombre, red }: { src: string | null; nombre: string; red?: 'instagram' | 'youtube' | 'tiktok' }) {
  const [rota, setRota] = useState<string | null>(null);
  return (
    <span className="spy-finder__avatar" aria-hidden>
      <span className="spy-finder__cara">
        {src && rota !== src
          // eslint-disable-next-line @next/next/no-img-element -- la sirve nuestra ruta, nuestro bucket o YouTube: acá sólo se mira
          ? <img src={src} alt="" loading="lazy" onError={() => setRota(src)} />
          : inicial(nombre)}
      </span>
      {red && <span className="spy-finder__marca"><LogoRed red={red} box={16} /></span>}
    </span>
  );
}

const QUE_ES: Record<VistaPrevia['campo'], string> = {
  instagram: 'Instagram', youtube_id: 'Canal de YouTube', tiktok: 'TikTok', landing_url: 'Sitio', nombre: 'Nombre',
};
const PREGUNTA: Record<VistaPrevia['campo'], string> = {
  instagram: '¿Es esta persona?', youtube_id: '¿Es este canal?', tiktok: '¿Es este TikTok?', landing_url: '¿Es este sitio?', nombre: '¿Agregar con este nombre?',
};

const vistaDePerfil = (p: PerfilHallado): VistaPrevia => ({ campo: 'instagram', valor: p.usuario, nombre: p.nombre, foto: p.foto, seguidores: p.seguidores, bio: p.bio ?? null, web: p.web ?? null });
const vistaDeCanal = (c: CanalHallado): VistaPrevia => ({ campo: 'youtube_id', valor: c.ref, nombre: c.nombre, foto: c.foto, seguidores: c.suscriptores });

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
  const [activoK, setActivoK] = useState<string | null>(null);
  // Lo que contestó cada pedido, por su clave. Vive lo que el modal: escribir otra cosa y volver no paga dos veces.
  const [resp, setResp] = useState<RespuestasBusqueda>({});
  const [inicio, setInicio] = useState<Record<string, number>>({});
  const [ahora, setAhora] = useState(() => Date.now());
  const [completos, setCompletos] = useState<Record<string, PerfilHallado>>({});
  const pedidos = useRef(new Set<string>());
  const completando = useRef(new Map<string, Promise<void>>());
  const [ronda, setRonda] = useState(0);
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
  const plan = useMemo(() => planDeBusqueda(t), [t]);
  // Los @ y los canales que ya se miran: no se buscan ni se ofrecen, salen arriba en «Ya los miras».
  const ya = useMemo(() => ({
    instagram: new Set(competidores.map((c) => (c.instagram ?? '').toLowerCase()).filter(Boolean)),
    youtube: new Set(competidores.map((c) => (c.youtube_id ?? '').toLowerCase()).filter(Boolean)),
  }), [competidores]);

  const pedir = useCallback((k: string, url: string) => {
    if (pedidos.current.has(k)) return;
    pedidos.current.add(k);
    setInicio((v) => ({ ...v, [k]: Date.now() }));
    void fetch(url, { signal: AbortSignal.timeout(TOPE_MS) })
      .then((r) => r.json().catch(() => null))
      .then((j: unknown) => setResp((v) => ({ ...v, [k]: j && typeof j === 'object' && (j as { ok?: boolean }).ok ? j as RespuestasBusqueda[string] : { fallo: true } })))
      .catch(() => {
        // Un pedido cortado se puede volver a hacer: no queda anotado como hecho.
        pedidos.current.delete(k);
        setResp((v) => ({ ...v, [k]: { fallo: true } }));
      });
  }, []);

  // ── Pedir, cuando la persona deja de escribir ──────────────────────────────
  // ⚠️ NO EN CADA TECLA: un nombre espera más que un @, porque buscar un nombre cuesta dos corridas de Apify.
  useEffect(() => {
    const lista = pedidosDelPlan(plan, ya);
    if (!lista.length) return;
    const espera = setTimeout(() => { for (const p of lista) pedir(p.k, p.url); }, plan.nombre ? 750 : 350);
    return () => clearTimeout(espera);
  }, [plan, ya, pedir, ronda]);

  // ── Las filas ──────────────────────────────────────────────────────────────
  const mirados = useMemo(() => (t ? competidores.filter((c) => coincideCompetidor(c, t, nombreDeTarjeta(c))) : competidores).slice(0, MAX_MIRADOS), [t, competidores]);
  const busqueda = useMemo(() => filasDeLaBusqueda(plan, resp, completos, ya), [plan, resp, completos, ya]);

  // ── Completar las primeras filas de Instagram con su foto y sus seguidores, en UNA corrida ─────────────
  useEffect(() => {
    if (busqueda.sinCupo) return;
    const faltan = cualesCompletar(busqueda.instagram, new Set([...completando.current.keys(), ...Object.keys(completos)]));
    if (!faltan.length) return;
    const espera = setTimeout(() => {
      const promesa = fetch(`/api/competitor-spy/buscar?fuente=completar&u=${encodeURIComponent(faltan.join(','))}`, { signal: AbortSignal.timeout(TOPE_MS) })
        .then((r) => r.json().catch(() => null))
        .then((j: { ok?: boolean; perfiles?: PerfilHallado[] } | null) => {
          const leidos = Array.isArray(j?.perfiles) ? j.perfiles : [];
          setCompletos((v) => {
            const n = { ...v };
            for (const p of leidos) if (p?.usuario) n[p.usuario] = p;
            // Lo que no se pudo leer queda anotado igual: no se vuelve a pedir en esta búsqueda.
            for (const u of faltan) if (!n[u]) n[u] = { usuario: u, nombre: null, foto: null, seguidores: null, sinLeer: true };
            return n;
          });
        })
        .catch(() => { /* se muestra lo que hay */ })
        .finally(() => { for (const u of faltan) completando.current.delete(u); });
      for (const u of faltan) completando.current.set(u, promesa);
    }, ESPERA_COMPLETAR_MS);
    return () => clearTimeout(espera);
  }, [busqueda.instagram, busqueda.sinCupo, completos]);

  // El reloj de los mensajes de espera: corre sólo mientras algo de lo escrito está en camino.
  const enCamino = busqueda.instagramCargando || busqueda.youtubeCargando;
  useEffect(() => {
    if (!enCamino) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enCamino]);
  const desdeQue = (claves: readonly string[]) => {
    const ts = claves.map((k) => inicio[k]).filter((x): x is number => typeof x === 'number');
    return ts.length ? Math.max(0, ahora - Math.min(...ts)) : 0;
  };

  const filas: FilaBusqueda[] = useMemo(() => [
    ...mirados.map((c): FilaBusqueda => ({ k: `c:${c.id}`, tipo: 'mirado', grupo: 'mirados', competidorId: c.id })),
    ...busqueda.filas,
  ], [mirados, busqueda.filas]);
  const iEncontrado = filas.findIndex((f) => f.k === activoK);
  const iActivo = filas.length ? (iEncontrado >= 0 ? iEncontrado : 0) : -1;
  const idFila = (i: number) => `${idLista}-${i}`;
  const moverA = (i: number) => {
    setActivoK(filas[i]?.k ?? null);
    requestAnimationFrame(() => document.getElementById(idFila(i))?.scrollIntoView({ block: 'nearest' }));
  };

  const integracion = useConectarIntegracion({
    onConectado: () => {
      // Con la clave recién puesta, lo escrito se vuelve a buscar.
      pedidos.current.clear();
      setResp({});
      setRonda((n) => n + 1);
    },
  });
  const conectando = integracion.abierto != null;

  // ── Elegir y confirmar ─────────────────────────────────────────────────────
  const irAConfirmar = useCallback(async (pegado: string, previa: VistaPrevia, leer?: () => Promise<VistaPrevia | null>) => {
    const turno = ++vigencia.current;
    setElegido({ pegado }); setVista(leer ? null : previa); setErrorVista(null); setFotoRota(false);
    cajaRef.current?.focus();
    if (!leer) return;
    const v = await leer().catch(() => null);
    if (turno !== vigencia.current) return;
    // Un perfil que no se pudo leer NO frena el alta: se muestra lo que se sabía y se dice.
    setVista(v ?? { ...previa, aviso: 'No pude leerlo para mostrarte quién es. Puedes agregarlo igual.' });
  }, []);

  /** Un perfil de Instagram: con bio ya leída se confirma en el acto; si no, se lee (y si ya se está leyendo, se espera). */
  const elegirPerfil = (p: PerfilHallado) => {
    const c = completos[p.usuario];
    const lleno = c && !c.sinLeer ? { ...p, ...c } : p;
    if (lleno.bio !== undefined && lleno.foto) { void irAConfirmar(`@${p.usuario}`, vistaDePerfil(lleno)); return; }
    void irAConfirmar(`@${p.usuario}`, vistaDePerfil(lleno), async () => {
      // ⚠️ SI ESA FILA YA SE ESTÁ COMPLETANDO, SE ESPERA ESA CORRIDA: pedir otra pagaría dos veces a la misma persona.
      await completando.current.get(p.usuario);
      const r = await fetch(`/api/competitor-spy/buscar?fuente=ig&u=${encodeURIComponent(p.usuario)}`, { signal: AbortSignal.timeout(TOPE_MS) });
      const j = (await r.json().catch(() => null)) as { perfil?: PerfilHallado | null } | null;
      return j?.perfil ? vistaDePerfil({ ...lleno, ...j.perfil }) : null;
    });
  };

  const elegir = (f: FilaBusqueda) => {
    if (f.tipo === 'mirado') onAbrir(f.competidorId);
    else if (f.tipo === 'perfil') elegirPerfil(f.perfil);
    else if (f.tipo === 'usar') void irAConfirmar(`@${f.usuario}`, { campo: 'instagram', valor: f.usuario });
    else if (f.tipo === 'canal') void irAConfirmar(f.canal.url, vistaDeCanal(f.canal));
    else if (f.tipo === 'directo') void irAConfirmar(f.pegar, { campo: f.campo, valor: f.valor });
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
      // Con el modal de la integración encima, el Escape es de él.
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
  const vacio = ((): { titulo: string; texto: string; conectar?: boolean } | null => {
    if (plan.noReconocido === 'youtube-c') return { titulo: 'No reconozco ese enlace', texto: 'Pega el de su canal: el que lleva su @ o /channel/.' };
    if (plan.noReconocido === 'instagram-post') return { titulo: 'Ese enlace es una publicación', texto: 'Pega el de su perfil, o escribe su @.' };
    if (!t && !competidores.length) return { titulo: 'A quién quieres mirar', texto: 'Escribe su nombre, su @, su canal de YouTube o su sitio.' };
    if (t && !filas.length && !busqueda.algoEnCamino && !busqueda.algoPedido) return { titulo: 'Sigue escribiendo', texto: 'Con 3 letras ya busco.' };
    if (busqueda.algoEnCamino || busqueda.filas.length) return null;
    if (busqueda.sinClave) return { titulo: 'Conecta Apify para buscar por nombre', texto: 'Con tu clave de Apify busco en Instagram y en YouTube.', conectar: true };
    if (busqueda.sinCupo) return { titulo: 'Ya no quedan búsquedas por hoy', texto: 'Se renuevan mañana. Si sabes su @, puedes agregarlo igual.' };
    if (busqueda.fallo) return { titulo: 'No pude buscar', texto: 'Prueba de nuevo en un rato, o escribe su @ exacto.' };
    if (busqueda.algoPedido) return { titulo: 'No encontré a nadie', texto: plan.nombre ? 'Prueba con su @ exacto.' : 'Revisa que esté bien escrito.' };
    return null;
  })();

  // ── La confirmación: el mismo cuadro, con su cara ──────────────────────────
  if (elegido) {
    const nombre = vista?.nombre || sinProtocolo(vista?.valor ?? elegido.pegado);
    const foto = !fotoRota ? fotoPorNosotros(vista?.foto) : null;
    const detalle = vista && [
      QUE_ES[vista.campo],
      vista.campo === 'instagram' ? `@${vista.valor}` : vista.campo === 'youtube_id' && vista.valor.startsWith('@') ? vista.valor : null,
      vista.seguidores != null ? `${dibujarContador(vista.seguidores)} ${vista.campo === 'youtube_id' ? 'suscriptores' : 'seguidores'}` : null,
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
                  // eslint-disable-next-line @next/next/no-img-element -- la sirve nuestra ruta o YouTube: acá sólo se mira
                  : foto ? <img src={foto} alt="" onError={() => setFotoRota(true)} />
                    : vista.campo === 'youtube_id' ? <SvcIcon k="youtube" box={88} size={52} radius={22} />
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
          {vista?.aviso && <p className="spy-finder__nota">{vista.aviso}</p>}
          {error && <p className="spy-finder__nota spy-finder__nota--mal">{error}</p>}
          <div className="spy-finder__botones">
            <button type="button" className="spy-boton" disabled={ocupado} onClick={volver}>No, volver</button>
            <button type="button" className="spy-boton spy-boton-primario" disabled={!vista || ocupado} onClick={agregar}>
              {ocupado ? 'Un momento…' : 'Sí, agregar'}
            </button>
          </div>
        </div>
        <BrandDefs />
      </>
    );
  }

  // ── La lista ───────────────────────────────────────────────────────────────
  const dibujarFila = (f: FilaBusqueda, i: number): ReactNode => {
    const comun = {
      id: idFila(i), role: 'option' as const, 'aria-selected': i === iActivo, className: 'spy-finder__fila',
      onMouseEnter: () => setActivoK(f.k), onClick: () => elegir(f),
    };
    if (f.tipo === 'mirado') {
      const c = competidores.find((x) => x.id === f.competidorId);
      if (!c) return null;
      const titulo = nombreDeTarjeta(c);
      const canales = [c.instagram ? 'Instagram' : null, c.youtube_id ? 'YouTube' : null, c.tiktok ? 'TikTok' : null, c.landing_url ? 'Su web' : null].filter(Boolean).join(' · ');
      return (
        <div key={f.k} {...comun}>
          <Cara src={c.avatar || caricaturaDeCompetidor(c)} nombre={titulo} />
          <span className="spy-finder__texto"><b>{titulo}</b><small>{canales || 'Sin canales todavía'}</small></span>
          {FLECHA}
        </div>
      );
    }
    if (f.tipo === 'perfil') {
      const p = f.perfil;
      const seguidores = p.seguidores != null ? `${dibujarContador(p.seguidores)} seguidores` : null;
      return (
        <div key={f.k} {...comun}>
          {f.completando && !p.foto ? <span className="spy-hueso spy-hueso--cara" aria-hidden /> : <Cara src={fotoPorNosotros(p.foto)} nombre={p.nombre || p.usuario} red="instagram" />}
          <span className="spy-finder__texto">
            <b>{p.nombre || `@${p.usuario}`}</b>
            {p.nombre || seguidores
              ? <small>{[`@${p.usuario}`, seguidores].filter(Boolean).join(' · ')}</small>
              : f.completando ? <span className="spy-hueso spy-hueso--s" aria-hidden /> : <small>Ver quién es</small>}
          </span>
          {FLECHA}
        </div>
      );
    }
    if (f.tipo === 'canal') {
      const c = f.canal;
      const subs = c.suscriptores != null ? `${dibujarContador(c.suscriptores)} suscriptores` : null;
      return (
        <div key={f.k} {...comun}>
          <Cara src={c.foto} nombre={c.nombre || c.ref} red="youtube" />
          <span className="spy-finder__texto">
            <b>{c.nombre || c.ref}</b>
            <small>{[c.ref.startsWith('@') ? c.ref : null, subs].filter(Boolean).join(' · ') || 'Canal de YouTube'}</small>
          </span>
          {FLECHA}
        </div>
      );
    }
    if (f.tipo === 'usar') {
      return (
        <div key={f.k} {...comun}>
          <span className="spy-finder__ico" aria-hidden><LogoRed red="instagram" box={20} /></span>
          <span className="spy-finder__texto"><b>Usar @{f.usuario}</b><small>Tal como lo escribiste</small></span>
          {FLECHA}
        </div>
      );
    }
    if (f.tipo === 'directo') {
      return (
        <div key={f.k} {...comun}>
          <span className="spy-finder__ico" aria-hidden><LogoRed red={f.campo === 'tiktok' ? 'tiktok' : f.campo === 'youtube_id' ? 'youtube' : 'sitio'} box={20} /></span>
          <span className="spy-finder__texto"><b>{f.titulo}</b><small>{f.detalle}</small></span>
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

  const huesos = (n: number, red: 'instagram' | 'youtube') => Array.from({ length: n }, (_, i) => (
    <div key={`h-${red}-${i}`} className="spy-finder__fila spy-finder__esq" aria-hidden>
      <span className="spy-hueso spy-hueso--cara" />
      <span className="spy-finder__texto"><span className="spy-hueso spy-hueso--b" /><span className="spy-hueso spy-hueso--s" /></span>
    </div>
  ));

  // Los grupos, en orden fijo. Un grupo sin filas y sin nada en camino no se dibuja.
  // ⚠️ YouTube dice qué pasó aunque no traiga a nadie (Martín, 4/11: «solamente me trae Instagram»). Sólo con otras filas
  // en la lista: sin ninguna, lo dice el vacío de abajo.
  const avisoYoutube = !filas.length ? undefined
    : busqueda.youtubeEstado === 'ninguno' ? (plan.nombre ? 'Ningún canal con ese nombre.' : 'No encontré ese canal.')
    : busqueda.youtubeEstado === 'no-pude' ? 'No pude buscar en YouTube. Prueba de nuevo en un rato.'
    : busqueda.youtubeEstado === 'sin-clave' ? 'Conecta Apify para buscar canales por nombre.'
    : busqueda.youtubeEstado === 'sin-cupo' ? 'Ya no quedan búsquedas de canales por hoy.'
    : undefined;
  const GRUPOS: Array<{ id: FilaBusqueda['grupo']; nombre: string; red?: 'instagram' | 'youtube' | 'tiktok' | 'sitio'; cargando?: boolean; espera?: string; aviso?: string }> = [
    { id: 'mirados', nombre: 'Ya los miras' },
    { id: 'instagram', nombre: 'Instagram', red: 'instagram', cargando: busqueda.instagramCargando, espera: busqueda.instagramCargando ? esperaDe(desdeQue(busqueda.clavesInstagram), !!plan.nombre) : undefined },
    { id: 'youtube', nombre: 'YouTube', red: 'youtube', cargando: busqueda.youtubeCargando, espera: busqueda.youtubeCargando && !busqueda.instagramCargando ? esperaDe(desdeQue(busqueda.clavesYoutube), !!plan.nombre) : undefined, aviso: avisoYoutube },
    { id: 'tiktok', nombre: 'TikTok', red: 'tiktok' },
    { id: 'sitio', nombre: 'Sitio web', red: 'sitio' },
    { id: 'nombre', nombre: 'Sin redes' },
  ];
  let i = 0;
  const bloques = GRUPOS.map((g) => {
    const deEste = filas.filter((f) => f.grupo === g.id);
    if (!deEste.length && !g.cargando && !g.aviso) return null;
    const desde = i;
    i += deEste.length;
    return (
      <div key={g.id}>
        <div className="spy-finder__grupo">
          <span className="spy-finder__red">{g.red && <LogoRed red={g.red} box={16} />}{g.nombre}</span>
          {g.espera && <span className="spy-finder__espera" aria-live="polite">{g.espera}</span>}
        </div>
        {deEste.map((f, j) => dibujarFila(f, desde + j))}
        {g.cargando && huesos(deEste.length ? 1 : 3, g.id === 'youtube' ? 'youtube' : 'instagram')}
        {g.aviso && <p className="spy-finder__aviso">{g.aviso}</p>}
      </div>
    );
  });

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
            onChange={(e) => { setTexto(e.target.value); setActivoK(null); }}
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
        <div id={idLista} className="spy-finder__lista" role="listbox" aria-label="Resultados" aria-busy={enCamino} onMouseDown={(e) => e.preventDefault()}>
          {bloques}
          {vacio && (
            <div className="spy-finder__vacio">
              <b>{vacio.titulo}</b>
              <p>{vacio.texto}</p>
              {/* Sin la clave de Apify no hay con qué buscar por nombre: el botón, ahí mismo y sin salir de la tab. */}
              {vacio.conectar && (
                <button type="button" className="spy-boton" data-conectar-integracion="apify-instagram" onClick={() => integracion.abrir('apify-instagram')}>Conectar Apify</button>
              )}
            </div>
          )}
        </div>
        <div className="spy-finder__pie" aria-hidden>
          <span><span className="spy-kbd">↑↓</span> moverte</span>
          <span><span className="spy-kbd">↵</span> elegir</span>
        </div>
      </div>
      <BrandDefs />
      {integracion.modal}
    </>
  );
}

