'use client';

// =============================================================================
// EstrategiaWizard — la estrategia de una secuencia, UNA PREGUNTA POR PANTALLA
// =============================================================================
// Reemplaza al formulario denso de la sub-tab «Estrategia», que pedía SIETE
// decisiones a la vez: objetivo, gancho, preguntas de cualificación, criterio de
// califica, criterio de descalifica, qué hacer cuando el lead responde, cuándo
// se logra y cuándo falla. Todo en una columna, con dos textareas en grilla de
// dos columnas y cuatro dropdowns.
//
// Pedido de Martín: «Mejora el diseño del form de a 1 paso a la vez, como
// estamos acostumbrados».
//
// ⚠️ NO ES UNA PANTALLA PROPIA: es `WizardShell` en modo `fullscreen embebido
// desnudo`, que es el lenguaje que el propio Martín pidió y que ya está escrito
// en esa pieza — «Sin "contenedor", y diferente son los puntos de las slides de
// los pasos que quedan». Escribir un stepper nuevo acá sería la peor forma de
// tener un componente común: una pieza compartida que cada pantalla nueva
// esquiva. Si algo no entra, se le agrega al WizardShell.
//
// Y por qué el wizard reemplaza al panel entero en vez de vivir adentro de la
// sub-tab: `fullscreen desnudo` trae `minHeight: 100vh` y fondo propio, así que
// anidarlo dentro de un panel que ya tiene su topbar, su cabecera y sus tabs
// deja dos marcos peleando. El onboarding de esta misma tab lo usa igual.

import { useState } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { Dropdown } from '../components/Dropdown';
import type { Opcion } from './ChatAgentApp';
import type { Desenlace, ModoRespuesta } from '@/lib/setting-estrategia';

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 11,
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)',
  fontSize: 14.5, fontFamily: "'Geist', sans-serif", outline: 'none', lineHeight: 1.55,
};

const EMOJI_OBJ: Record<string, string> = { agendar: '📅', preparar: '🎯', reactivar: '🧲', cualificar: '❓', confirmar_pago: '💳' };

/** Tarjeta grande de opción. Un paso por pantalla se paga en TAMAÑO: si las opciones siguen siendo un dropdown, partir el formulario no compró nada. */
function Opciones({ valor, onElegir, opciones, columnas = 2 }: {
  valor: string; onElegir: (v: string) => void;
  opciones: Array<{ v: string; t: string; d?: string; e?: string }>;
  columnas?: number;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columnas}, minmax(0,1fr))`, gap: 10 }}>
      {opciones.map((o) => {
        const on = valor === o.v;
        return (
          <button
            key={o.v} type="button" onClick={() => onElegir(o.v)} aria-pressed={on}
            style={{
              textAlign: 'left', padding: '15px 16px', borderRadius: 13, cursor: 'pointer',
              fontFamily: 'inherit',
              border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border-strong)'),
              background: on ? 'var(--primary-bg)' : 'var(--surface)',
              boxShadow: on ? '0 0 0 1px var(--primary)' : 'none',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {o.e && <span style={{ fontSize: 18 }}>{o.e}</span>}{o.t}
            </div>
            {o.d && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 4, lineHeight: 1.45 }}>{o.d}</div>}
          </button>
        );
      })}
    </div>
  );
}

export type EstrategiaBorrador = {
  objetivo: string; gancho: string; preguntas: string;
  califica: string; descalifica: string;
  modo: ModoRespuesta; desenlace: Desenlace;
};

export function EstrategiaWizard({ valor, objetivos, nombreSecuencia, guardando, error, onCambiar, onSugerirCriterio, sugiriendo, onGuardar, onSalir }: {
  valor: EstrategiaBorrador;
  objetivos: Opcion[];
  nombreSecuencia: string;
  guardando: boolean;
  error: string | null;
  onCambiar: (parche: Partial<EstrategiaBorrador>) => void;
  onSugerirCriterio: () => void;
  sugiriendo: boolean;
  onGuardar: () => void;
  onSalir: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const v = valor;

  // Las preguntas de cada paso viven en un array y no en un switch gigante: así
  // agregar un paso es una entrada, y el `total` del progreso no se puede
  // quedar viejo (sale de la longitud).
  const pasos = [
    {
      k: 'objetivo',
      q: '¿Qué tiene que conseguir esta secuencia?',
      s: 'Es lo que decide cuándo dejar de mandar mensajes. Sin esto, la secuencia manda hasta quedarse sin pasos.',
      // El objetivo es lo único obligatorio: todo lo demás tiene un default
      // sano, y trabar a alguien por un campo que puede completar después es
      // un candado sin llave.
      listo: () => Boolean(v.objetivo),
      cuerpo: (
        <>
          <Opciones
            valor={v.objetivo} onElegir={(x) => onCambiar({ objetivo: x })}
            opciones={objetivos.map((o) => ({ v: o.value, t: o.label, e: EMOJI_OBJ[o.value] }))}
          />
          <div>
            <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 7 }}>¿Con qué los enganchas? <span style={{ color: 'var(--faint)' }}>(opcional)</span></div>
            <input value={v.gancho} onChange={(e) => onCambiar({ gancho: e.target.value })} placeholder="Una guía, un diagnóstico gratis, una oferta…" style={inp} />
          </div>
        </>
      ),
    },
    {
      k: 'preguntas',
      q: '¿Qué necesitas saber de esta persona?',
      s: 'MaKo las siembra en la charla, en este orden. Una por línea.',
      listo: () => true,
      cuerpo: (
        <textarea
          value={v.preguntas} onChange={(e) => onCambiar({ preguntas: e.target.value })} rows={6}
          placeholder={'¿Cuánto facturas hoy?\n¿Tienes equipo?\n¿Hace cuánto lo intentas?'}
          style={{ ...inp, resize: 'vertical' }}
        />
      ),
    },
    {
      k: 'criterio',
      q: '¿Cómo sabes si esta persona te sirve?',
      s: 'Es lo que decide si la charla termina en llamada o en despedida amable.',
      listo: () => true,
      cuerpo: (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--good)', fontWeight: 650, marginBottom: 6 }}>✓ Sí, si…</div>
              <textarea value={v.califica} onChange={(e) => onCambiar({ califica: e.target.value })} rows={5}
                placeholder={'Tiene equipo a cargo\nQuiere escalar sin depender de él'} style={{ ...inp, resize: 'vertical' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 650, marginBottom: 6 }}>✕ No, si…</div>
              <textarea value={v.descalifica} onChange={(e) => onCambiar({ descalifica: e.target.value })} rows={5}
                placeholder={'Recién arranca, sin facturación\nBusca empleo, no consultoría'} style={{ ...inp, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button type="button" onClick={onSugerirCriterio} disabled={sugiriendo}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13.5, fontWeight: 600, cursor: sugiriendo ? 'default' : 'pointer', fontFamily: 'inherit', opacity: sugiriendo ? 0.6 : 1 }}>
              {sugiriendo ? 'MaKo lo está deduciendo…' : '✨ Que MaKo lo deduzca de tus leads ya calificados'}
            </button>
          </div>
        </>
      ),
    },
    {
      k: 'modo',
      q: 'Cuando te contesten, ¿qué hago?',
      s: 'Pase lo que pase, la secuencia se frena en cuanto el lead escribe: nadie recibe el mensaje 3 después de haber contestado.',
      listo: () => true,
      cuerpo: (
        <Opciones
          valor={v.modo} onElegir={(x) => onCambiar({ modo: x as ModoRespuesta })}
          opciones={[
            { v: 'asistido', e: '🙋', t: 'Te aviso y te dejo el borrador', d: 'MaKo redacta la respuesta y tú la mandas con un clic' },
            { v: 'automatico', e: '⏸', t: 'Solo pausar', d: 'La secuencia se frena y sigues tú por tu cuenta' },
          ]}
        />
      ),
    },
    {
      k: 'fin',
      q: '¿Cuándo damos por terminada esta secuencia?',
      s: 'Lo que pase después —encadenar otra, avisarte— se decide con esto.',
      listo: () => true,
      cuerpo: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13.5, color: 'var(--good)', fontWeight: 650, marginBottom: 8 }}>Se logra cuando el lead…</div>
            <Dropdown
              value={v.desenlace.logrado} width="100%" ariaLabel="Cuándo se logra"
              onChange={(x) => onCambiar({ desenlace: { ...v.desenlace, logrado: x as Desenlace['logrado'] } })}
              options={[
                { value: 'respondio', label: 'Responde cualquier cosa' },
                { value: 'agendo', label: 'Agenda una reunión' },
                { value: 'pago', label: 'Paga' },
                { value: 'ninguno', label: 'No cierra sola' },
              ]}
            />
          </div>
          <div>
            {/* En HORAS: no es lo mismo que no conteste en 2 horas a que no
                conteste en un mes, y el umbral correcto depende del objetivo. */}
            <div style={{ fontSize: 13.5, color: 'var(--warn)', fontWeight: 650, marginBottom: 8 }}>Se da por perdida cuando…</div>
            <Dropdown
              value={String(v.desenlace.falloHoras)} width="100%" ariaLabel="Cuándo falla"
              onChange={(x) => onCambiar({ desenlace: { ...v.desenlace, falloHoras: Number(x) } })}
              options={[
                { value: '0', label: 'Nunca: la dejo corriendo' },
                { value: '2', label: 'Pasan 2 horas sin respuesta' },
                { value: '12', label: 'Pasan 12 horas sin respuesta' },
                { value: '24', label: 'Pasa 1 día sin respuesta' },
                { value: '72', label: 'Pasan 3 días sin respuesta' },
                { value: '168', label: 'Pasan 7 días sin respuesta' },
                { value: '720', label: 'Pasan 30 días sin respuesta' },
              ]}
            />
          </div>
        </div>
      ),
    },
  ];

  const paso = pasos[idx];
  const enUltimo = idx === pasos.length - 1;

  return (
    <WizardShell
      fullscreen embebido desnudo
      titulo={nombreSecuencia}
      total={pasos.length} idx={idx}
      pregunta={paso.q} sub={paso.s}
      error={error}
      puedeAvanzar={paso.listo()}
      enUltimo={enUltimo}
      confirmLabel="Guardar la estrategia"
      siguienteLabel="Siguiente"
      pending={guardando}
      // En el primer paso el botón izquierdo sale del wizard; después, vuelve
      // un paso. Es el destino declarado por PANTALLA, no `history.back()`.
      atrasLabel={idx === 0 ? 'Volver' : 'Atrás'}
      onAtras={() => (idx === 0 ? onSalir() : setIdx(idx - 1))}
      onSiguiente={() => setIdx(Math.min(pasos.length - 1, idx + 1))}
      onConfirmar={onGuardar}
      onClose={onSalir}
    >
      {paso.cuerpo}
    </WizardShell>
  );
}
