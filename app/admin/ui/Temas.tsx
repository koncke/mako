'use client';

// =============================================================================
// Temas — elegir el tema del rebrand probándolo sobre la app REAL
// =============================================================================
// El punto de esta tab: NO mostrar maquetas. Una maqueta siempre se ve linda —
// tiene siete filas y datos inventados. Lo que decide si un tema sirve es el
// CRM con 946 leads, el tablero del plan y un gráfico de gasto. Así que acá se
// elige el tema y se sale a navegar la app de verdad; el chip de abajo a la
// izquierda te acompaña a todas las pantallas con la salida y el interruptor.
//
// Los hexes NO están en este archivo. Se LEEN de la hoja de estilo con
// getComputedStyle sobre una sonda oculta que lleva el atributo del tema. Por
// eso lo que se ve acá es, por construcción, lo que de verdad está aplicado:
// no hay forma de que la tabla y la app digan cosas distintas.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { Section, Button, ButtonLink, Banner, Divider, Status, MONO } from '@/app/_ui';
import { TEMAS, TOKENS_MOSTRADOS, ATTR_TEMA } from '@/lib/temas-candidatos';
import { aplicarTemaCandidato } from '@/app/_components/TemaCandidato';
import { aplicarModo } from '@/app/_components/InterruptorModo';

/** Las pantallas que más castigan a un tema, y por qué cada una. */
const PRUEBAS: { href: string; label: string; porque: string }[] = [
  { href: '/crm', label: 'CRM', porque: 'la prueba dura: cientos de tarjetas, chips de estado y columnas' },
  { href: '/general', label: 'Inicio', porque: 'KPIs grandes y el hero del Norte' },
  { href: '/plan', label: 'Plan', porque: 'tablero denso con prioridad por color' },
  { href: '/dashboard', label: 'Dashboard', porque: 'gráficos de gasto — donde el color carga dato' },
  { href: '/whatsapp', label: 'WhatsApp', porque: 'burbujas: tres colores que significan quién habla' },
  { href: '/second-brain', label: 'Second Brain', porque: 'la única pantalla que YA era oscura' },
];

export function LosTemas() {
  const [activo, setActivo] = useState<string | null>(null);
  const [oscuro, setOscuro] = useState(false);
  const sondas = useRef<Record<string, HTMLDivElement | null>>({});
  const [valores, setValores] = useState<Record<string, Record<string, string>>>({});

  // El estado vive en <html>, no acá: esta tab es una de las formas de tocarlo,
  // no su dueña. Si se cambia desde el chip, esto se entera por el evento.
  useEffect(() => {
    const sync = () => {
      setActivo(document.documentElement.getAttribute(ATTR_TEMA));
      setOscuro(document.documentElement.getAttribute('data-tema') === 'oscuro');
    };
    sync();
    window.addEventListener('mako-tema-candidato', sync);
    window.addEventListener('mako-modo', sync);
    return () => {
      window.removeEventListener('mako-tema-candidato', sync);
      window.removeEventListener('mako-modo', sync);
    };
  }, []);

  // Se leen los tokens de las sondas después de pintar. Las custom properties
  // se heredan, así que un div con el atributo puesto ya tiene los valores del
  // tema aunque el tema no esté aplicado a la página.
  useEffect(() => {
    const t = setTimeout(() => {
      const out: Record<string, Record<string, string>> = {};
      for (const tema of TEMAS) {
        const el = sondas.current[tema.id + (oscuro ? '-o' : '-c')];
        if (!el) continue;
        const cs = getComputedStyle(el);
        out[tema.id] = Object.fromEntries(
          TOKENS_MOSTRADOS.flatMap((g) => g.tokens).map((k) => [k, cs.getPropertyValue(k).trim()]),
        );
      }
      setValores(out);
    }, 60);
    return () => clearTimeout(t);
  }, [oscuro]);

  const elegir = (id: string) => aplicarTemaCandidato(activo === id ? null : id);

  const filas = useMemo(() => TOKENS_MOSTRADOS, []);

  return (
    <>
      {/* Las sondas: invisibles, fuera del flujo, solo para poder LEER los
          tokens de un tema sin aplicarlo. `visibility:hidden` y no `display:none`
          porque un elemento sin caja no computa estilos heredados. */}
      <div aria-hidden style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', visibility: 'hidden' }}>
        {TEMAS.map((t) => (
          <div key={t.id}>
            <div ref={(el) => { sondas.current[t.id + '-c'] = el; }} {...{ [ATTR_TEMA]: t.id }} />
            <div ref={(el) => { sondas.current[t.id + '-o'] = el; }} {...{ [ATTR_TEMA]: t.id }} data-tema="oscuro" />
          </div>
        ))}
      </div>

      <Banner tono={activo ? 'mako' : 'info'}>
        {activo
          ? 'Hay un tema puesto. Sal a navegar la app: el chip de abajo a la izquierda te sigue a todas las pantallas con la salida. El claro/oscuro está en tu perfil, abajo en la barra.'
          : 'Elige un tema y se aplica a TODA la app, no a una maqueta. Nada de esto es producción: es una herramienta para decidir.'}
      </Banner>

      <Section
        titulo="El candidato"
        nota="Nord —que ya traía resueltos los dos modos— con el azul de Meta. Había tres; tener tres paletas es no haber elegido."
        card
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {TEMAS.map((t) => {
            const on = activo === t.id;
            const v = valores[t.id] || {};
            return (
              <div
                key={t.id}
                style={{
                  display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16,
                  alignItems: 'start', padding: '18px 0', borderTop: '1px solid var(--border)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="mk-row" style={{ marginBottom: 6 }}>
                    <strong style={{ fontSize: 'var(--fs-card)' }}>{t.nombre}</strong>
                    {on && <Status tono="mako">Puesto</Status>}
                  </div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55, marginBottom: 8 }}>{t.idea}</p>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>
                    <strong style={{ color: 'var(--ink)' }}>Lo que le falla. </strong>{t.falla}
                  </p>

                  {/* La tira de color se dibuja con los valores LEÍDOS, así que si
                      el CSS cambia, esto cambia sin tocar una línea de acá. */}
                  <div style={{ display: 'flex', marginTop: 12, borderRadius: 'var(--r-sm)', overflow: 'hidden', height: 26 }}>
                    {filas.flatMap((g) => g.tokens).map((k) => (
                      <div key={k} title={`${k} · ${v[k] || '—'}`} style={{ flex: 1, background: v[k] || 'transparent' }} />
                    ))}
                  </div>
                </div>

                <Button variant={on ? 'secondary' : 'primary'} onClick={() => elegir(t.id)}>
                  {on ? 'Sacarlo' : 'Ponérselo a la app'}
                </Button>
              </div>
            );
          })}
        </div>
      </Section>

      <ClienteDeDiseno />

      <Section titulo="Sal a probarlo donde duele" nota="una maqueta siempre se ve bien; estas pantallas no perdonan" card>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {PRUEBAS.map((p) => (
            <div
              key={p.href}
              style={{
                display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16,
                alignItems: 'center', padding: '11px 0', borderTop: '1px solid var(--border)',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 'var(--fs-md)' }}>{p.label}</strong>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}> — {p.porque}</span>
              </span>
              <ButtonLink href={p.href} variant="secondary">Abrir →</ButtonLink>
            </div>
          ))}
        </div>
      </Section>

      <Section
        titulo={`Los tokens, en modo ${oscuro ? 'oscuro' : 'claro'}`}
        nota="leídos de la hoja de estilo, no escritos aquí: es lo que de verdad se aplica"
        card
        accion={<Button variant="secondary" onClick={() => aplicarModo(!oscuro)}>
          Ver en {oscuro ? 'claro' : 'oscuro'}
        </Button>}
      >
        <div className="mk-scroll-x">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr>
                <th style={th}>Token</th>
                {TEMAS.map((t) => <th key={t.id} style={th}>{t.nombre}</th>)}
              </tr>
            </thead>
            <tbody>
              {filas.map((g) => (
                <>
                  <tr key={g.grupo}>
                    <td colSpan={TEMAS.length + 1} style={{ ...td, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', paddingTop: 16 }}>
                      {g.grupo}
                    </td>
                  </tr>
                  {g.tokens.map((k) => (
                    <tr key={k}>
                      <td style={{ ...td, fontFamily: MONO, fontSize: 11.5, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{k}</td>
                      {TEMAS.map((t) => {
                        const hex = (valores[t.id] || {})[k];
                        return (
                          <td key={t.id} style={td}>
                            <span className="mk-row" style={{ gap: 7 }}>
                              <i style={{ width: 14, height: 14, borderRadius: 4, flex: 'none', background: hex || 'transparent', border: '1px solid var(--border-strong)' }} />
                              <span style={{ fontFamily: MONO, fontSize: 11 }}>{hex || '—'}</span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Divider />

      <Section titulo="Dos cosas que el tema NO arregla" card>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6, marginBottom: 12 }}>
          <strong style={{ color: 'var(--ink)' }}>La landing no se entera. </strong>
          <code style={{ fontFamily: MONO, fontSize: 12 }}>app/vsl/</code> usa <strong>cero</strong> tokens de la app
          (<code style={{ fontFamily: MONO, fontSize: 12 }}>var(--</code> aparece 0 veces) y tiene <strong>646 hexes escritos a mano</strong>.
          Tampoco tiene <code style={{ fontFamily: MONO, fontSize: 12 }}>data-tema</code>: no hay modo oscuro ahí ni puede haberlo sin tokenizarla antes.
          Poner un tema aquí deja la landing exactamente igual — medido: cambia el 7,7% de los píxeles, y es casi todo un botón.
        </p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink)' }}>Y el naranja hereda el problema del dorado. </strong>
          <code style={{ fontFamily: MONO, fontSize: 12 }}>--accent</code> es un alias del color de marca <em>sin</em> la
          restricción semántica, y hoy es el token dorado más usado de la app: pinta la tab activa, un KPI, un avatar sin
          foto y hasta la burbuja del humano en el chat. Con el tema puesto, todo eso pasa a ser naranja — o sea que el
          color de MaKo sigue significando «destacado». Cambiarle el hex no lo arregla; hay que eliminar el alias.
          El inventario completo está en <code style={{ fontFamily: MONO, fontSize: 12 }}>docs/hallazgos-ui.md</code>.
        </p>
      </Section>
    </>
  );
}

/**
 * El Cliente de Diseño: un workspace de prueba dedicado a mirar el rebrand.
 *
 * Existe separado del Cliente de Prueba (ws 3) por una razón práctica: en aquel
 * se prueba que las cosas FUNCIONEN, y un reset a mitad de camino te deja sin
 * datos justo cuando estabas mirando un tema. Acá se prueba cómo se VEN.
 *
 * Los datos NO los copia esta pantalla: los trae /api/datos-mau con
 * `action:'todo'`, que es el mismo atajo del otro cliente de prueba y además
 * cierra el onboarding. Una segunda copia de esa lógica se quedaría vieja.
 */
function ClienteDeDiseno() {
  const [est, setEst] = useState<{ existe: boolean; conDatos: boolean; id: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mirar = async () => {
    try {
      const j = await (await fetch('/api/admin/cliente-diseno', { cache: 'no-store' })).json();
      if (j.ok) setEst({ existe: !!j.existe, conDatos: !!j.conDatos, id: j.id });
    } catch { /* la sección simplemente no se puede usar */ }
  };
  useEffect(() => { void mirar(); }, []);

  const crear = async () => {
    setBusy('crear'); setError(null);
    try {
      const j = await (await fetch('/api/admin/cliente-diseno', { method: 'POST' })).json();
      if (!j.ok) setError(j.error || 'No se pudo crear.');
      await mirar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear.');
    } finally { setBusy(null); }
  };

  if (!est) return null;
  const href = `/general?ws=${est.id}`;

  return (
    <Section
      titulo="El Cliente de Diseño"
      nota="un workspace aparte para mirar el rebrand sin tocarle el color a ningún cliente real"
      card
    >
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6, marginBottom: 14 }}>
        Adentro de este cliente, la barra de la agencia trae el <strong style={{ color: 'var(--ink)' }}>cambiador de
        temas</strong>: se salta de un candidato a otro y de claro a oscuro desde cualquier pantalla, sobre los datos
        de Mauricio. Es la forma de decidir mirando el CRM lleno, no una maqueta.
      </p>

      {!est.existe && (
        <div className="mk-row">
          <Button onClick={() => void crear()} disabled={busy !== null}>
            {busy === 'crear' ? 'Creando…' : `Crear el Cliente de Diseño (workspace ${est.id})`}
          </Button>
        </div>
      )}

      {est.existe && !est.conDatos && (
        <>
          <Banner tono="warn">
            El workspace existe pero está vacío. Entra y usa <strong>«Datos de Mauricio → Traer todo»</strong> en la
            barra de arriba: copia todo y da el onboarding por cerrado de una.
          </Banner>
          <div className="mk-row" style={{ marginTop: 12 }}>
            <ButtonLink href={href}>Entrar al Cliente de Diseño →</ButtonLink>
          </div>
        </>
      )}

      {est.existe && est.conDatos && (
        <div className="mk-row">
          <ButtonLink href={href}>Entrar al Cliente de Diseño →</ButtonLink>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
            Listo y con datos. El cambiador de temas está en la barra de arriba.
          </span>
        </div>
      )}

      {error && <Banner tono="bad">{error}</Banner>}
    </Section>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px 8px 0', borderBottom: '1px solid var(--border-strong)',
  fontSize: 'var(--fs-sm)', fontWeight: 600, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '7px 12px 7px 0', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
