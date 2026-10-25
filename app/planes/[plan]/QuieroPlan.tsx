'use client';

// «Lo quiero» sin pasarela (24/10/2026, sin Calendly): nombre, email y WhatsApp. Postea a /api/planes/comprar con
// `quiero: true` (lib/compra-plan.ts, `pedirPlanSinPasarela`): queda el pedido en el CRM de MaKo con el plan, de dónde vino
// y el código de partner, y el equipo escribe por WhatsApp para dar el alta. Nunca dice «pagaste» ni abre un pago.
//
// Con `preguntas` (el Acelerador, 25/10/2026): antes de los datos, el diagnóstico de 2 minutos, UNA pregunta por pantalla y
// con respuestas grandes que avanzan solas al tocarlas (lib/compra-plan-reglas.ts, `PREGUNTAS_DE_LA_PUERTA`). Se mandan los
// índices; el servidor guarda el texto de cada opción.

import { useEffect, useRef, useState } from 'react';
import type { OrigenCompra } from '@/lib/compra-plan-reglas';
import type { Pregunta } from '@/lib/fase-diagnostico';

export function QuieroPlan(p: {
  plan: string; nombrePlan: string; origen: OrigenCompra | null; refCodigo: string | null; preguntas?: readonly Pregunta[];
}) {
  const preguntas = p.preguntas ?? [];
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [web, setWeb] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Al cambiar de paso, el foco va al título del paso nuevo: con lector de pantalla, se escucha la pregunta que sigue.
  const titulo = useRef<HTMLParagraphElement>(null);
  const primerPaso = useRef(true);
  useEffect(() => {
    if (primerPaso.current) { primerPaso.current = false; return; }
    titulo.current?.focus();
  }, [paso]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const diagnostico = preguntas.length ? respuestas : undefined;
      const r = await fetch('/api/planes/comprar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: p.plan, nombre, email, whatsapp, quiero: true, origen: p.origen, ref: p.refCodigo, web, diagnostico }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (r.ok && j.ok) { setListo(true); setEnviando(false); return; }
      setError(j.error ?? 'No pudimos registrar tu pedido. Prueba otra vez.');
    } catch {
      setError('No pudimos conectarnos. Revisa tu internet y prueba otra vez.');
    }
    setEnviando(false);
  }

  if (listo) {
    return (
      <div role="status" aria-live="polite">
        <p className="planes-sub" style={{ marginBottom: 6, color: '#12151B', fontWeight: 600 }}>¡Listo! Recibimos tu pedido de {p.nombrePlan}.</p>
        <p className="planes-sub">
          {preguntas.length ? 'Te escribimos por WhatsApp para coordinar tu llamada.' : 'Te escribimos por WhatsApp para darte de alta. Con tu email entras a MaKo.'}
        </p>
      </div>
    );
  }

  const pasos = preguntas.length ? (
    <div className="planes-pasos" aria-hidden="true">
      {[...preguntas, null].map((_, i) => <span key={i} className={i <= paso ? 'hecho' : undefined} />)}
    </div>
  ) : null;
  const atras = paso > 0
    ? <button type="button" className="planes-atras" onClick={() => setPaso(paso - 1)}>← Atrás</button>
    : null;

  if (paso < preguntas.length) {
    const q = preguntas[paso];
    return (
      <div>
        {/* Los tramos dicen «$» (son los del onboarding) y son dólares: en Argentina «$» se lee pesos. */}
        {paso === 0 && <p className="planes-sub" style={{ marginBottom: 18 }}>Antes de la llamada, {preguntas.length} preguntas sobre tu negocio, con montos en dólares. Toma 2 minutos.</p>}
        {pasos}
        <p className="planes-pregunta" id="qp-pregunta" ref={titulo} tabIndex={-1}>
          <span className="planes-oculto">Paso {paso + 1} de {preguntas.length + 1}. </span>{q.texto}
        </p>
        <div className="planes-respuestas" role="group" aria-labelledby="qp-pregunta">
          {q.opciones.map((o, i) => (
            <button key={o} type="button" className="planes-respuesta" aria-pressed={respuestas[q.id] === i}
              onClick={() => { setRespuestas({ ...respuestas, [q.id]: i }); setPaso(paso + 1); }}>{o}</button>
          ))}
        </div>
        {atras}
      </div>
    );
  }
  return (
    <form onSubmit={enviar} noValidate>
      {pasos}
      {preguntas.length > 0 && (
        <p className="planes-pregunta" ref={titulo} tabIndex={-1}>
          <span className="planes-oculto">Último paso. </span>¿A dónde te escribimos?
        </p>
      )}
      <label htmlFor="qp-nombre">Tu nombre</label>
      <input id="qp-nombre" type="text" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <label htmlFor="qp-email">Tu email</label>
      <input id="qp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="qp-wa">Tu WhatsApp, con el código de país</label>
      <input id="qp-wa" type="tel" autoComplete="tel" inputMode="tel" placeholder="+54 9 11 1234 5678" value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)} required />
      <div className="planes-trampa" aria-hidden="true">
        <label htmlFor="qp-web">Web</label>
        <input id="qp-web" type="text" tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} />
      </div>
      <button className="planes-btn" type="submit" disabled={enviando}>{enviando ? 'Enviando…' : `Quiero ${p.nombrePlan}`}</button>
      {error && <p className="planes-error" role="status" aria-live="polite">{error}</p>}
      <p className="planes-nota">
        {preguntas.length ? 'No se te cobra nada ahora: primero hablamos.' : 'No se te cobra nada ahora: te escribimos para darte de alta.'}
      </p>
      {atras}
    </form>
  );
}
