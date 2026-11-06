'use client';

// =============================================================================
// ConectarMetaZernio — «Conectar con Facebook»: Meta entero por la Zernio del negocio, desde el modal de Meta (25/10/2026)
// =============================================================================
// Martín, 25/10: «implementa zernio y depreca la conexión con API de Meta». Antes se pegaba el token de un usuario del sistema
// con 8 permisos; desde ahora el negocio toca UN botón (la ventana de Zernio, la misma pieza `useConectarViaZernio` que usan
// el Media Buyer, Automations y Chats) y MaKo guarda la conexión, la cuenta publicitaria y el píxel (lib/meta-conexion-zernio.ts).
// Con varias cuentas o píxeles, la persona elige acá.
//
// ⚠️ LA PÁGINA (25/10/2026): con VARIAS páginas concedidas y sin `pageId`, Zernio no crea la conexión (el primer clic de Martín
// volvió sin nada; el segundo, con la página fija, conectó). Copiado de lo que hace Zernio en su app: si MaKo conoce UNA página
// del negocio la manda sola; con varias pregunta ANTES de abrir la ventana; y si la ventana vuelve sin conexión habiendo abierto
// sin página, pide la página (de la lista, o su ID) y se reintenta con ella (`paginaParaConectar`, lib/zernio-meta-cuerpo.ts).
//
// Desde el 29/10/2026 (ticket #28) va en el PASO 2 de Zernio (ConectarRedes), como la fila «Anuncios de Meta»: todo lo de Meta se
// configura en la tarjeta de Zernio, y SÓLO con la clave de Zernio del negocio (`estado.activo`).
// Se carga A DEMANDA (`next/dynamic`): los demás servicios no la traen.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/app/_ui';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { EstadoConexion, useConectarViaZernio } from '@/app/_components/ConectarViaZernio';

const SANS = "'Geist', sans-serif";
const caja: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 };
const select: CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5,
};

type Cuenta = { id: string; nombre: string | null; estado: number | null };
type Pixel = { id: string; nombre: string | null; activo: boolean };
type Pagina = { id: string; nombre: string | null };
export type EstadoMetaZernio = {
  activo: boolean; conexion: string | null; cuentas: Cuenta[]; pixeles: Pixel[]; cuenta: string | null; pixel: string | null; error: string | null;
  paginas: Pagina[]; pagina: { pageId: string | null; preguntar: boolean; sugerida: string | null };
  /** ¿Le llegan a MaKo los leads de los formularios? (lib/meta-conexion-zernio.ts, 29/10/2026). Sin el campo acá, no tipaba. */
  leads?: 'si' | 'tarde' | 'sin-permiso' | null;
  /** Un 429 de Zernio: en cuánto se vuelve a leer sola (ticket #34). */
  reintentarEnMs?: number | null;
};

/** Hasta cuántas veces se relee sola después de un 429 (después, lo dice y espera a la persona). */
const RELECTURAS_TRAS_PAUSA = 3;

const ID_PAGINA = /^\d{5,20}$/;
/** El valor del selector para «escribir el ID a mano». */
const OTRA = 'otra';

async function pedir(init?: RequestInit): Promise<{ estado?: EstadoMetaZernio; error?: string }> {
  try {
    const r = await fetch('/api/integraciones/meta-zernio', { cache: 'no-store', ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; estado?: EstadoMetaZernio; error?: string; conflictos?: string[] } | null;
    if (!j) return { error: 'No pude leer tu conexión de Facebook.' };
    if (!j.ok) return { error: j.error ?? 'No pude leer tu conexión de Facebook.' };
    if (j.conflictos?.length) return { estado: j.estado, error: j.conflictos.join(' ') };
    return { estado: j.estado };
  } catch {
    return { error: 'No pude hablar con MaKo. Revisa tu conexión.' };
  }
}

export default function ConectarMetaZernio({ onEstado, onGuardado }: {
  onEstado?: (e: { activo: boolean; conectada: boolean }) => void;
  /** Se guardó algo (la conexión, la cuenta o el píxel): el formulario de abajo vuelve a leer sus campos. */
  onGuardado?: () => void;
}) {
  const [estado, setEstado] = useState<EstadoMetaZernio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // La página con la que se abre la ventana: la que MaKo dedujo o la sugerida, y la que elige la persona.
  const [pagina, setPagina] = useState('');
  const [paginaManual, setPaginaManual] = useState('');
  const [pedirPagina, setPedirPagina] = useState(false);
  const abrioSinPagina = useRef(false);

  const aplicar = useCallback((r: { estado?: EstadoMetaZernio; error?: string }) => {
    if (r.estado) setEstado(r.estado);
    setError(r.error ?? r.estado?.error ?? null);
  }, []);
  const guardado = useCallback((r: { estado?: EstadoMetaZernio; error?: string }) => {
    aplicar(r);
    if (r.estado) onGuardado?.();
  }, [aplicar, onGuardado]);

  const leer = useCallback(async () => aplicar(await pedir()), [aplicar]);
  useEffect(() => { void leer(); }, [leer]);
  // Un 429 de Zernio (su tope por minuto) se relee solo después de lo que pidió esperar (ticket #34), unas pocas veces.
  const relecturas = useRef(0);
  const reintentarEnMs = estado?.reintentarEnMs ?? null;
  useEffect(() => {
    if (reintentarEnMs == null) { relecturas.current = 0; return; }
    if (relecturas.current >= RELECTURAS_TRAS_PAUSA) return;
    relecturas.current++;
    const t = setTimeout(() => { void leer(); }, reintentarEnMs);
    return () => clearTimeout(t);
  }, [estado, reintentarEnMs, leer]);
  useEffect(() => {
    if (estado) onEstado?.({ activo: estado.activo, conectada: !!estado.conexion && !!estado.cuenta });
  }, [estado, onEstado]);
  // La primera lectura propone la página (la deducida o la sugerida); después manda lo que eligió la persona.
  const propuesta = estado?.pagina.pageId ?? estado?.pagina.sugerida ?? '';
  useEffect(() => { setPagina((p) => p || propuesta); }, [propuesta]);

  // Quedó conectada la ventana: MaKo guarda la conexión y lo que se puede elegir solo.
  const z = useConectarViaZernio({
    volver: '/integraciones?abrir=zernio',
    // La pieza común ya guardó la conexión (`conectada-meta`, app/api/zernio/route.ts) antes de avisar: acá sólo se vuelve a leer.
    onConectado: () => {
      setGuardando(true);
      void pedir().then(guardado).finally(() => setGuardando(false));
    },
  });

  // La ventana volvió sin conexión y se había abierto sin página: lo más probable es que falte elegirla (con varias concedidas,
  // Zernio no crea nada). Se pide y se reintenta con ella.
  useEffect(() => {
    if (z.fase === 'error' && abrioSinPagina.current) setPedirPagina(true);
  }, [z.fase]);

  const pageIdElegido = pagina === OTRA ? paginaManual.trim() : pagina;
  const hayQueElegir = !!estado && !estado.conexion && (estado.pagina.preguntar || pedirPagina);
  const paginaLista = ID_PAGINA.test(pageIdElegido);
  const conectar = () => {
    const pageId = paginaLista ? pageIdElegido : null;
    abrioSinPagina.current = !pageId;
    z.conectar('metaads', { reconectarId: estado?.conexion ?? null, pageId });
  };

  const elegir = async (campo: 'cuenta' | 'pixel', valor: string) => {
    if (!valor) return;
    setGuardando(true);
    guardado(await pedir({ method: 'POST', body: JSON.stringify({ action: 'elegir', [campo]: valor }) }));
    setGuardando(false);
  };

  if (!estado?.activo) return null;
  const conectada = !!estado.conexion;
  const cuenta = estado.cuentas.find((c) => c.id === estado.cuenta);

  return (
    <div data-conectar-meta-zernio style={{ ...caja, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, flex: 'none', background: conectada && cuenta ? 'var(--good)' : conectada ? 'var(--warn)' : 'var(--border-strong)' }} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
            {conectada ? (cuenta ? `Anuncios de Meta · ${cuenta.nombre ?? cuenta.id}` : 'Anuncios de Meta: elige tu cuenta publicitaria') : 'Anuncios de Meta'}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>
            {conectada ? 'Métricas, leads, anuncios y conversiones, con tu Zernio.' : 'Tu cuenta publicitaria: se abre la ventana de Facebook.'}
          </span>
        </span>
        <Button size="sm" variant={conectada ? 'secondary' : 'primary'} loading={z.fase === 'abriendo' || guardando}
          disabled={z.fase === 'abriendo' || guardando || (hayQueElegir && !paginaLista)}
          data-conectar-zernio="metaads" onClick={conectar}>
          {conectada ? 'Volver a conectar' : pedirPagina ? 'Conectar con esta página' : 'Conectar con Facebook'}
        </Button>
      </div>

      {hayQueElegir && (
        <div data-elegir-pagina style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pedirPagina && (
            <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--dim)' }}>
              Facebook no dejó conectar sin saber la página. Elige con qué página publicas tus anuncios y vuelve a conectar.
            </span>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: 'var(--dim)' }}>
            Página de tus anuncios
            <select style={select} value={pagina || (estado.paginas.length ? '' : OTRA)} onChange={(e) => setPagina(e.target.value)}>
              {!pagina && estado.paginas.length > 0 && <option value="">Elige una página…</option>}
              {estado.paginas.map((p) => <option key={p.id} value={p.id}>{p.nombre ? `${p.nombre} (${p.id})` : `Página ${p.id}`}</option>)}
              <option value={OTRA}>Otra: escribir su ID</option>
            </select>
          </label>
          {(pagina === OTRA || estado.paginas.length === 0) && (
            <>
              <input style={select} inputMode="numeric" placeholder="ID de la página, por ejemplo 1315098941694049" value={paginaManual}
                onChange={(e) => { setPaginaManual(e.target.value.replace(/\D/g, '')); if (pagina !== OTRA) setPagina(OTRA); }} />
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>Está en tu página de Facebook → «Información» → «Transparencia de la página».</span>
            </>
          )}
        </div>
      )}

      {conectada && estado.cuentas.length > 1 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: 'var(--dim)' }}>
          Cuenta publicitaria
          <select style={select} value={estado.cuenta ?? ''} disabled={guardando} onChange={(e) => void elegir('cuenta', e.target.value)}>
            {!estado.cuenta && <option value="">Elige una cuenta…</option>}
            {estado.cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre ? `${c.nombre} (${c.id})` : c.id}</option>)}
          </select>
        </label>
      )}

      {conectada && estado.pixeles.length > 1 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: 'var(--dim)' }}>
          Píxel
          <select style={select} value={estado.pixel ?? ''} disabled={guardando} onChange={(e) => void elegir('pixel', e.target.value)}>
            {!estado.pixel && <option value="">Elige un píxel…</option>}
            {estado.pixeles.map((p) => <option key={p.id} value={p.id}>{p.nombre ? `${p.nombre} (${p.id})` : p.id}</option>)}
          </select>
        </label>
      )}

      {conectada && estado.pixeles.length === 0 && !error && (
        <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--dim)' }}>
          Tu conexión no ve ningún píxel. Si tienes uno, dale acceso a esa cuenta publicitaria en Meta y vuelve a conectar.
        </span>
      )}

      {/* Los leads de los formularios (29/10/2026): si no le llegan a MaKo, se dice por qué y qué hacer (`avisoDeLeads`, lib/zernio-leads-estado.ts). */}
      {conectada && estado.leads === 'sin-permiso' && (
        <span role="status" data-leads-zernio="sin-permiso" style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--warn)' }}>
          Los leads de tus formularios no le llegan a MaKo: tu cuenta de Zernio necesita su complemento de anuncios. Actívalo en zernio.com y vuelve a conectar.
        </span>
      )}
      {/* Llegan, pero cada media hora (el barrido): el webhook no los escucha. NO es «no recibe»: eso salía en falso (5/11/2026). */}
      {conectada && estado.leads === 'tarde' && (
        <span role="status" data-leads-zernio="tarde" style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--dim)' }}>
          Tus leads llegan cada media hora. Para que lleguen al instante, toca «Volver a conectar».
        </span>
      )}
      {error && <span role="alert" style={{ fontSize: 12.5, color: 'var(--bad)' }}>{error}<ReportarASoporte /></span>}
      <EstadoConexion z={z} />
      {z.modal}
    </div>
  );
}
