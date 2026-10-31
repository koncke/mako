'use client';

// =============================================================================
// El onboarding de Competitor Spy — Conectar → Contexto → Ensayo, en ese orden invertido
// =============================================================================
// Molde: `app/ads-writer/OnboardingCopyGen.tsx` (WizardShell en modo fullscreen + embebido). Las
// reglas son las de la skill `tab-onboarding`, y dos de ellas deciden la forma de esta pantalla:
//
//  1. **LO ABURRIDO VA AL FINAL.** Conectar una credencial de Instagram o de YouTube es lo que más
//     gente pierde, así que va en el ÚLTIMO paso y además es OPCIONAL: la tab entrega valor sin
//     ninguna credencial, porque con el sitio del competidor alcanza para ver qué piezas tiene y
//     para replicar su landing. Lo primero es elegir a quién mirar, que es lo único que no se puede
//     inferir de nada que ya tengamos.
//  2. **NUNCA UN CAMPO LIBRE EN UN FORMULARIO, Y NUNCA PEDIR QUE ALGUIEN REDACTE.** Acá no hay
//     formulario: hay UN campo donde se pega lo que la persona ya tiene a mano (un @, un enlace) y
//     el código resuelve qué es. Es el mismo patrón del enlace pegado del Web Generator.
//
// Y el ENSAYO de esta tab es la PRIMERA LECTURA DE VERDAD, no un simulacro: en una tab de
// conversación el ensayo necesita que MaKo haga de cliente, y acá la prueba de que la tab quedó
// lista es mirar al competidor que la persona acaba de cargar y mostrarle lo que salió — incluido
// lo que NO se pudo leer, que es la mitad honesta del resultado.
//
// El copy va en español neutro, con «tú»: el producto se usa en México.

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../_components/icons';
import { WizardShell } from '../_components/WizardShell';
import { NOMBRE_CANAL, type CanalSpy } from '@/lib/spy-reglas';
import {
  canalesDeCompetidorAction, competidoresAction, marcarPasoSpyAction, primeraLecturaAction,
  sumarCanalAction, sumarCompetidorAction, type PasoSpy,
} from './onboarding-actions';

/** ⚠️ El ORDEN TIENE QUE SER EL DEL CATÁLOGO (lib/tab-onboarding-catalogo.ts): `marcarPasoTab` lo
 *  hace valer en el SERVER y rechaza un paso fuera de orden. Si acá se cambia, se cambia allá. */
const PASOS = ['spy_primero', 'spy_canales', 'spy_lectura', 'spy_conectar'] as const;
type Paso = (typeof PASOS)[number];

const PREGUNTA: Record<Paso, { pregunta: string; sub?: string }> = {
  spy_primero: { pregunta: 'Tu primer competidor', sub: '¿A quién quieres mirar? Alcanza con un dato suyo.' },
  spy_canales: { pregunta: 'Dónde mirarlo', sub: 'Cada canal que agregues es un bloque más de su ficha.' },
  spy_lectura: { pregunta: 'La primera lectura', sub: 'Vamos a leerlo ahora para que veas qué sale y qué no.' },
  spy_conectar: { pregunta: 'Conectar Instagram y YouTube', sub: 'Opcional. Sin esto igual ves su sitio y los anuncios que guardes tú.' },
};

const CAJA: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12,
  padding: '13px 15px', textAlign: 'left',
};
const EYEBROW: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)', fontSize: 10, letterSpacing: '.08em',
  textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 7,
};
const CUERPO: React.CSSProperties = { fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 };

const ENTRADA: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--ink)', fontSize: 14,
};
const BOTON: React.CSSProperties = {
  alignSelf: 'center', padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 14, cursor: 'pointer',
};

/** El bloque gris de contexto: una respuesta corta en prosa, visible sin desplegar nada. */
function Contexto({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={CAJA}>
      <div style={EYEBROW}>{titulo}</div>
      <div style={CUERPO}>{children}</div>
    </div>
  );
}

export function OnboardingSpy({ alSalir }: { alSalir: () => void }) {
  const [paso, setPaso] = useState<Paso>('spy_primero');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // El competidor con el que se está haciendo el recorrido.
  const [id, setId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [canales, setCanales] = useState<string[]>([]);

  // Cada acción muestra SU propio progreso: un solo `busy` compartido pone «Leyendo…» en el botón
  // de al lado.
  const [pegado, setPegado] = useState('');
  const [sumando, setSumando] = useState(false);
  const [otro, setOtro] = useState('');
  const [sumandoCanal, setSumandoCanal] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [lectura, setLectura] = useState<Array<{ canal: CanalSpy; ok: boolean; detalle: string; nuevas: number }> | null>(null);

  const idx = PASOS.indexOf(paso);
  const enUltimo = idx === PASOS.length - 1;

  // Retomar donde quedó: si ya hay un competidor cargado, el recorrido no vuelve a pedir el primero.
  useEffect(() => {
    void (async () => {
      const r = await competidoresAction();
      if (!r.ok || !r.competidores.length) return;
      const c = r.competidores[0];
      setId(c.id);
      setNombre(c.nombre);
      const cs = await canalesDeCompetidorAction(c.id);
      if (cs.ok) setCanales(cs.canales);
    })();
  }, []);

  const cerrarPaso = useCallback(async (cual: Paso): Promise<boolean> => {
    setError(null);
    setPending(true);
    try {
      const r = await marcarPasoSpyAction(cual as PasoSpy);
      if (!r.ok) { setError(r.error); return false; }
      return true;
    } finally {
      setPending(false);
    }
  }, []);

  const sumarPrimero = async () => {
    setError(null);
    setSumando(true);
    try {
      const r = await sumarCompetidorAction(pegado.trim());
      if (!r.ok) { setError(r.error); return; }
      setId(r.id);
      setNombre(r.nombre);
      setCanales(r.canales);
      setPegado('');
    } finally {
      setSumando(false);
    }
  };

  const sumarOtroCanal = async () => {
    if (id == null) return;
    setError(null);
    setSumandoCanal(true);
    try {
      const r = await sumarCanalAction(id, otro.trim());
      if (!r.ok) { setError(r.error); return; }
      setCanales(r.canales);
      setOtro('');
    } finally {
      setSumandoCanal(false);
    }
  };

  const leerAhora = async () => {
    if (id == null) return;
    setError(null);
    setLeyendo(true);
    try {
      const r = await primeraLecturaAction(id);
      if ('error' in r) { setError(r.error); return; }
      setLectura(r.canales.map((c) => ({ canal: c.canal, ok: c.ok, detalle: c.detalle, nuevas: c.nuevas })));
    } finally {
      setLeyendo(false);
    }
  };

  // Qué hace falta para poder avanzar en cada paso. El último es opcional y nunca traba.
  const puedeAvanzar =
    paso === 'spy_primero' ? id != null
    : paso === 'spy_canales' ? canales.length > 0
    : paso === 'spy_lectura' ? lectura != null
    : true;

  return (
    <WizardShell
      titulo="Competitor Spy · Configuración"
      pasos={PASOS}
      pasoActual={paso}
      pregunta={PREGUNTA[paso].pregunta}
      sub={PREGUNTA[paso].sub}
      error={error}
      puedeAvanzar={puedeAvanzar}
      enUltimo={enUltimo}
      confirmLabel="Entrar a Competitor Spy →"
      pending={pending}
      atrasLabel="Atrás"
      hideAtras={idx === 0}
      onAtras={() => setPaso(PASOS[Math.max(0, idx - 1)])}
      onSiguiente={() => { void (async () => { if (await cerrarPaso(paso)) setPaso(PASOS[idx + 1]); })(); }}
      onConfirmar={() => { void (async () => { if (await cerrarPaso(paso)) alSalir(); })(); }}
      onClose={alSalir}
      // `extraFooter` y no un `bloqueante`: la tab abre igual sin terminar el recorrido, porque sin
      // configurar ya se puede guardar un anuncio a mano. Trabar a alguien en un paso opcional es
      // perderlo.
      extraFooter={
        <button type="button" onClick={alSalir} style={{ background: 'none', border: 'none', color: 'var(--faint)', fontSize: 13, cursor: 'pointer' }}>
          Lo configuro después
        </button>
      }
      fullscreen
      embebido
      anchoCuerpo={560}
    >
      {paso === 'spy_primero' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {id == null ? (
            <>
              <input
                style={ENTRADA}
                placeholder="@sucuenta · youtube.com/@sucanal · susitio.com"
                value={pegado}
                onChange={(e) => setPegado(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && pegado.trim() && !sumando) void sumarPrimero(); }}
              />
              <button type="button" style={BOTON} disabled={!pegado.trim() || sumando} onClick={() => void sumarPrimero()}>
                {sumando ? 'Agregando…' : 'Agregar'}
              </button>
            </>
          ) : (
            // Prueba visible de que lo leyó: se dice qué se entendió, no sólo un tilde.
            <div style={{ ...CAJA, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="check" size={16} />
              <div style={CUERPO}>
                <strong style={{ color: 'var(--ink)' }}>{nombre}</strong>
                {canales.length ? ` — se reconoció ${canales.map((c) => NOMBRE_CANAL[c as CanalSpy]).join(' y ')}.` : ' — todavía sin canales: en el paso siguiente agregas dónde mirarlo.'}
              </div>
            </div>
          )}
          <Contexto titulo="¿Por qué uno solo?">
            La tab sirve para mirar pocos competidores a fondo, no para armar un directorio. Con uno
            ya ves cómo funciona, y después agregas los demás desde la lista.
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
              Sirve cualquier dato suyo: su @ de Instagram, el enlace de su canal de YouTube o el de
              su sitio. Lo que pegues decide qué bloques de su ficha se pueden llenar.
            </div>
          </Contexto>
        </div>
      )}

      {paso === 'spy_canales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {(['instagram', 'youtube', 'landing'] as const).map((c) => {
              const tiene = canales.includes(c);
              return (
                <span
                  key={c}
                  style={{
                    padding: '6px 11px', borderRadius: 999, fontSize: 12,
                    border: '1px solid var(--border)',
                    background: tiene ? 'var(--surface-2)' : 'transparent',
                    color: tiene ? 'var(--ink)' : 'var(--faint)',
                  }}
                >
                  {tiene ? '✓ ' : ''}{NOMBRE_CANAL[c]}
                </span>
              );
            })}
          </div>
          <input
            style={ENTRADA}
            placeholder="Pega otro canal suyo (opcional)"
            value={otro}
            onChange={(e) => setOtro(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && otro.trim() && !sumandoCanal) void sumarOtroCanal(); }}
          />
          <button type="button" style={BOTON} disabled={!otro.trim() || sumandoCanal} onClick={() => void sumarOtroCanal()}>
            {sumandoCanal ? 'Agregando…' : 'Agregar canal'}
          </button>
          <Contexto titulo="Qué da cada canal">
            De su <strong style={{ color: 'var(--ink)' }}>Instagram</strong> salen sus publicaciones
            con vistas, «me gusta» y comentarios. De su{' '}
            <strong style={{ color: 'var(--ink)' }}>YouTube</strong>, sus videos con etiquetas y
            miniaturas. De su <strong style={{ color: 'var(--ink)' }}>sitio</strong>, qué piezas tiene
            (video, formulario, agenda, botón de WhatsApp) y el botón para replicarlo.
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
              Los <strong style={{ color: 'var(--ink)' }}>anuncios</strong> no están aquí porque no se
              pueden traer solos: la Biblioteca de Meta sólo entrega anuncios comerciales de Europa.
              Cuando veas uno suyo, pegas su enlace en la ficha y queda guardado con la fecha.
            </div>
          </Contexto>
        </div>
      )}

      {paso === 'spy_lectura' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {lectura == null ? (
            <button type="button" style={BOTON} disabled={leyendo || id == null} onClick={() => void leerAhora()}>
              {leyendo ? 'Leyendo sus canales…' : `Leer ${nombre || 'a tu competidor'} ahora`}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lectura.map((l) => (
                <div key={l.canal} style={{ ...CAJA, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Icon name={l.ok ? 'check' : 'x'} size={15} />
                  <div style={CUERPO}>
                    <strong style={{ color: 'var(--ink)' }}>{NOMBRE_CANAL[l.canal]}</strong>
                    {' — '}{l.detalle}
                    {l.ok && l.nuevas > 0 ? ` (${l.nuevas} piezas nuevas)` : ''}
                  </div>
                </div>
              ))}
              {!lectura.length && <div style={{ ...CAJA, ...CUERPO }}>No había ningún canal que leer.</div>}
            </div>
          )}
          <Contexto titulo="Lo que esta lectura empieza a construir">
            Lo que MaKo agrega sobre abrir sus perfiles a mano es una sola cosa, y es la más útil:
            desde hoy guarda una foto por día, así que va a poder decirte{' '}
            <strong style={{ color: 'var(--ink)' }}>desde cuándo</strong> está a la vista cada pieza.
            Una que lleva tres meses es de las que le funcionan; una de ayer es una prueba. Ese dato
            no está en ninguna pantalla de Instagram ni de Meta: hay que haberlo estado mirando.
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
              Si algún canal dice que no se pudo leer, no quiere decir que esté vacío. MaKo distingue
              «no lo pude leer» de «no tiene nada», y nunca te va a mostrar un cero que no midió.
            </div>
          </Contexto>
        </div>
      )}

      {paso === 'spy_conectar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <a href="/integraciones" style={{ ...BOTON, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="plug" size={15} /> Abrir Integraciones
          </a>
          <Contexto titulo="Qué cambia si las conectas">
            Sin conectar nada, Competitor Spy ya lee el sitio de tus competidores y guarda los
            anuncios que pegues. Con Instagram conectado suma sus publicaciones con vistas y «me
            gusta»; con YouTube, sus videos con etiquetas.
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
              Instagram pide una cuenta profesional vinculada a tu página de Facebook; es el mismo
              permiso que ya usa el buscador de perfiles del CRM. YouTube pide una clave de su API,
              gratuita.
            </div>
          </Contexto>
        </div>
      )}
    </WizardShell>
  );
}
