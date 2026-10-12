// =============================================================================
// editor-landing/spec-a-doc — un LandingSpec del generador anterior → un documento
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Decisión D2 de
// docs/diseno-editor-landing.md: `landing_drafts` (el generador anterior) no se toca;
// sus filas se ofrecen en «Importar → Del generador anterior» y se convierten acá.
//
// PURO (sin server-only): lo llaman la ruta de importar (paquete E) y el server de
// documentos (paquete D, `importarBorrador`). No llama a ningún modelo: es un mapeo
// determinista de la forma de lib/landing-spec.ts a la gramática de ia-bloques.ts, y de
// ahí a tarjetas con `bloquesATarjetas` (la MISMA conversión que usa la IA: un solo
// lugar valida las listas cerradas).
//
// El mapeo, por tipo de bloque del spec:
//   hero          → «Título» (headline) + texto grande (subheadline) + botón
//   beneficios    → optimizado «Íconos con texto»
//   como_funciona → optimizado «Etapas» (horizontales hasta 4, verticales con más)
//   testimonios   → optimizado «Citas con caras» (con marcadores si no hay prueba)
//   faq/objeciones→ desplegables (la pregunta es el título)
//   precio/oferta → optimizado «Cajas sólidas»
//   garantia      → recuadro de éxito
//   prueba_social → «Números grandes» si los ítems son cifras; si no, una lista
//   cta_final     → encabezado + botón (o el formulario, según el objetivo)
//   el resto      → encabezado + párrafo + lista
// La `nota` de cada bloque («por qué esta sección va acá», para el dueño) NO va al
// contenido: va a las NOTAS DEL ORADOR de su sección, que no se publican.
//
// ⚠️ NO SE INVENTA PRUEBA. El generador anterior ya tenía prohibido inventar testimonios
// (LANDING_JSON_SHAPE): si el bloque de testimonios llegó vacío, acá se ponen MARCADORES
// entre corchetes («[Nombre del cliente]»), que se ven como lo que son y no como un dato.
// =============================================================================

import { nuevoId, docPagina, type LandingContenido, type Pagina } from './doc';
import type { LandingSpec, BloqueLanding } from '../landing-spec';
import { bloquesATarjetas, primerIcono, type TarjetaIA, type BloqueIA, type ItemOptimizadoIA, type CampoIA } from './ia-bloques';

const limpio = (s: unknown): string => (typeof s === 'string' ? s.trim() : '');
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map(limpio).filter(Boolean) : []);

/** «¿Pregunta? Respuesta», «Título: texto», «Título — texto» → { titulo, texto }. */
export function partirItem(b: string): { titulo: string; texto: string } {
  const s = b.trim();
  const q = s.indexOf('?');
  if (q > 0 && q < s.length - 1) return { titulo: s.slice(0, q + 1).trim(), texto: s.slice(q + 1).trim() };
  for (const sep of [' — ', ' – ', ': ', ' - ', ' → ']) {
    const i = s.indexOf(sep);
    if (i > 0 && i < s.length - sep.length) return { titulo: s.slice(0, i).trim(), texto: s.slice(i + sep.length).trim() };
  }
  return { titulo: s, texto: '' };
}

/** «"Me ayudó a…" — Ana P.» → { cita, autor }. Sin autor, el marcador. */
function partirCita(b: string): { cita: string; autor: string } {
  const m = /^(.*\S)\s+[—–-]\s*([^—–-]{2,80})$/.exec(b.trim());
  const cita = (m ? m[1] : b).trim().replace(/^[«"“']+|[»"”']+$/g, '').trim();
  return { cita: `«${cita}»`, autor: m ? m[2].trim() : '[Nombre del cliente]' };
}

/** «+120 clientes», «97% de satisfacción», «3x más rápido» → { valor, titulo }. */
function partirCifra(b: string): { valor: string; titulo: string } | null {
  const m = /^([+~]?\$?\d[\d.,]*\s?(?:%|x|k|mil|\+)?)\s+(.+)$/i.exec(b.trim());
  return m ? { valor: m[1].trim(), titulo: m[2].trim() } : null;
}

// Íconos genéricos para cuando el spec no dice cuál (el generador anterior no tenía íconos).
// Se proponen sinónimos: el set lo escribe el paquete B y `primerIcono` se queda con el que haya.
const ICONOS_GENERICOS: string[][] = [
  ['check', 'exito'],
  ['rayo', 'fuego'],
  ['objetivo', 'brujula'],
  ['estrella', 'estrella-llena'],
  ['escudo', 'candado'],
  ['reloj', 'cronometro'],
];
const iconoGenerico = (i: number) => primerIcono(...ICONOS_GENERICOS[i % ICONOS_GENERICOS.length]);

function parrafos(copy: string): BloqueIA[] {
  return copy ? [{ t: 'p', texto: copy }] : [];
}

function itemsDe(bullets: string[], icono: boolean): ItemOptimizadoIA[] {
  return bullets.map((b, i) => {
    const { titulo, texto } = partirItem(b);
    const it: ItemOptimizadoIA = { titulo, texto };
    const ic = icono ? iconoGenerico(i) : undefined;
    if (ic) it.icono = ic;
    return it;
  });
}

function camposPara(objetivo: string): CampoIA[] {
  const base: CampoIA[] = [
    { tipo: 'nombre', etiqueta: 'Nombre', requerido: true },
    { tipo: 'email', etiqueta: 'Correo electrónico', requerido: true },
  ];
  if (objetivo === 'agendar') base.push({ tipo: 'telefono', etiqueta: 'Teléfono (WhatsApp)', requerido: true });
  return base;
}

/** Los bloques del cuerpo de una sección del spec (sin el encabezado ni el botón). */
function cuerpoDe(b: BloqueLanding): BloqueIA[] {
  const copy = limpio(b.copy);
  const bullets = lista(b.bullets);
  switch (b.tipo) {
    case 'beneficios':
      return [...parrafos(copy), ...(bullets.length ? [{ t: 'optimizado', variante: 'iconos-texto', items: itemsDe(bullets, true) } as BloqueIA] : [])];
    case 'como_funciona':
      return [...parrafos(copy), ...(bullets.length ? [{ t: 'optimizado', variante: bullets.length > 4 ? 'etapas-verticales' : 'etapas-horizontales', items: itemsDe(bullets, false) } as BloqueIA] : [])];
    case 'testimonios': {
      const items: ItemOptimizadoIA[] = bullets.length
        ? bullets.map((x) => { const { cita, autor } = partirCita(x); return { titulo: autor, texto: cita }; })
        : [1, 2, 3].map(() => ({ titulo: '[Nombre del cliente] · [Cargo o negocio]', texto: '«[Lo que dijo el cliente sobre el resultado que obtuvo]»' }));
      return [...parrafos(copy), { t: 'optimizado', variante: 'citas-caras', items }];
    }
    case 'faq': case 'objeciones':
      return [...parrafos(copy), ...(bullets.length ? [{ t: 'desplegables', items: bullets.map(partirItem) } as BloqueIA] : [])];
    case 'precio': case 'oferta':
      return [...parrafos(copy), ...(bullets.length ? [{ t: 'optimizado', variante: 'cajas-solidas', items: itemsDe(bullets, false) } as BloqueIA] : [])];
    case 'garantia':
      return [
        ...(copy ? [{ t: 'recuadro', tono: 'exito', texto: copy } as BloqueIA] : []),
        ...(bullets.length ? [{ t: 'lista', items: bullets } as BloqueIA] : []),
      ];
    case 'prueba_social': {
      const cifras = bullets.map(partirCifra);
      if (bullets.length && cifras.every(Boolean)) {
        return [...parrafos(copy), { t: 'optimizado', variante: 'numeros-grandes', items: cifras.map((c) => ({ titulo: c!.titulo, texto: '', valor: c!.valor })) }];
      }
      return [...parrafos(copy), ...(bullets.length ? [{ t: 'lista', items: bullets } as BloqueIA] : [])];
    }
    default:
      return [...parrafos(copy), ...(bullets.length ? [{ t: 'lista', items: bullets } as BloqueIA] : [])];
  }
}

/**
 * El spec del generador anterior → un documento del editor (una página). Las notas de
 * cada bloque van a las notas del orador de su sección; el SEO del spec, al de la página.
 */
export function specADoc(spec: LandingSpec, op: { descartes?: string[] } = {}): LandingContenido {
  const bloques = Array.isArray(spec?.bloques) ? spec.bloques : [];
  const objetivo = limpio(spec?.objetivo);
  const conFormulario = objetivo === 'agendar' || objetivo === 'registrar' || objetivo === 'descargar';
  const iHero = bloques.findIndex((b) => b?.tipo === 'hero');
  const hero = iHero >= 0 ? bloques[iHero] : null;
  const resto = bloques.filter((_, i) => i !== iHero);
  const ctaPrincipal = limpio(spec?.cta_principal);

  // Orden final de las secciones: hero, el resto en su orden y, si hace falta un formulario
  // y no hay cierre, una sección de cierre al final.
  const agregarCierre = conFormulario && !resto.some((b) => b?.tipo === 'cta_final');
  // Sin formulario («vender») el botón apunta a una SECCIÓN, y cuál es se sabe recién al
  // final (un bloque vacío se omite y corre la cuenta): se escribe un marcador y se resuelve
  // abajo, sobre las posiciones reales.
  const PENDIENTE = '@destino';
  const destino = conFormulario ? '#formulario' : PENDIENTE;
  const boton = (texto: string): BloqueIA[] => (texto ? [{ t: 'botones', items: [{ texto, destino, estilo: 'primario' }] }] : []);

  const notas = (...xs: unknown[]) => xs.map(limpio).filter(Boolean).join('\n\n');
  const formulario = (textoBoton: string): BloqueIA => ({
    t: 'formulario', campos: camposPara(objetivo), boton: textoBoton || 'Enviar', exito: '¡Gracias! Ya recibimos tus datos.',
  });

  const tarjetas: TarjetaIA[] = [];
  /** El tipo de bloque del spec de cada tarjeta, en el mismo orden (para el destino de venta). */
  const tipos: string[] = ['hero'];

  // ── Hero ──
  const titulo = limpio(spec?.headline) || limpio(hero?.titulo) || limpio(spec?.nombre) || 'Tu landing';
  const sub = limpio(spec?.subheadline);
  const heroCopy = limpio(hero?.copy);
  tarjetas.push({
    bloques: [
      { t: 'titulo', texto: titulo },
      ...(sub ? [{ t: 'p-grande', texto: sub } as BloqueIA] : []),
      ...(heroCopy && heroCopy !== sub ? parrafos(heroCopy) : []),
      ...(hero && lista(hero.bullets).length ? [{ t: 'lista', items: lista(hero.bullets) } as BloqueIA] : []),
      ...boton(limpio(hero?.cta) || ctaPrincipal),
    ],
    notas: notas(hero?.nota, spec?.rationale ? `Por qué esta estructura: ${limpio(spec.rationale)}` : ''),
  });

  // ── El resto, en su orden ──
  for (const b of resto) {
    if (!b || typeof b !== 'object') continue;
    const h2 = limpio(b.titulo);
    const cuerpo = cuerpoDe(b);
    const cta = limpio(b.cta);
    const esCierre = b.tipo === 'cta_final';
    const pie: BloqueIA[] = esCierre && conFormulario
      ? [formulario(cta || ctaPrincipal)]
      : boton(cta || (esCierre ? ctaPrincipal : ''));
    const contenido: BloqueIA[] = [...(h2 ? [{ t: 'h2', texto: h2 } as BloqueIA] : []), ...cuerpo, ...pie];
    if (!contenido.length) { op.descartes?.push(`bloque «${b.tipo}» sin contenido, se omite`); continue; }
    tarjetas.push({ bloques: contenido, notas: notas(b.nota) });
    tipos.push(b.tipo);
  }

  // El destino de venta: el precio o la oferta; si no hay, el cierre. Una sección no se
  // apunta a sí misma (el botón del cierre, si el cierre es el destino, queda sin destino).
  if (!conFormulario) {
    const iDestino = [tipos.indexOf('precio'), tipos.indexOf('oferta'), tipos.indexOf('cta_final')].filter((i) => i >= 0).sort((a, b) => a - b)[0];
    tarjetas.forEach((t, i) => {
      for (const b of t.bloques) {
        if (b.t !== 'botones') continue;
        for (const it of b.items) if (it.destino === PENDIENTE) it.destino = iDestino !== undefined && iDestino !== i ? `#seccion-${iDestino + 1}` : '#';
      }
    });
  }

  if (agregarCierre) {
    tarjetas.push({ bloques: [{ t: 'h2', texto: ctaPrincipal || 'Da el siguiente paso' }, formulario(ctaPrincipal)] });
  }

  const pagina: Pagina = {
    id: nuevoId('p'),
    titulo: 'Inicio',
    ruta: '',
    doc: docPagina(bloquesATarjetas(tarjetas, { descartes: op.descartes })),
    ...(limpio(spec?.meta_titulo) ? { seoTitulo: limpio(spec.meta_titulo).slice(0, 60) } : {}),
    ...(limpio(spec?.meta_descripcion) ? { seoDescripcion: limpio(spec.meta_descripcion).slice(0, 160) } : {}),
  };
  return { v: 1, paginas: [pagina] };
}
