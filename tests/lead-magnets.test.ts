// =============================================================================
// El Lead Magnet Generator (5/11/2026): lo que decide sin base ni red
// =============================================================================
// Ejecuta el código (AGENTS.md, «Un test nuevo ejecuta el código»): las plantillas, el esqueleto que nace en Copywriting, la
// landing que nace en el Web Generator, qué página deja leer un link público, y la página que ve el lead.
//
// Probado rompiéndolo (base 8 pases, 0 fallos; cada rotura dio 1 fallo y 7 pases, en el test que la nombra):
//   · `guiasQueQuedan` devolviendo siempre []                → cae «el link no sale con la guía puesta».
//   · `personalizarLanding` sin poner `redirigir`             → cae «el formulario lleva a la página de gracias».
//   · `enlaceParaBoton` aceptando cualquier texto             → cae «un javascript: no llega al botón».
//   · `paginaDelShareLM` sin mirar el permiso                 → cae «un link de este recurso nunca edita».
//   · `hrefSeguro` de LeadMagnetCompartido aceptando todo     → cae «la página del lead no dibuja un javascript:».
//   · `piezaDe` aceptando cualquier id de Copywriting         → cae «una pieza con un id que no es de la herramienta no se guarda».
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PLANTILLAS_LEAD_MAGNET, plantillaLeadMagnet, nombreInicial, chipsDeLeadMagnet } from '../lib/lead-magnets/plantillas';
import { esqueletoLeadMagnet, guiasQueQuedan, tieneContenidoPropio } from '../lib/lead-magnets/esqueleto';
import { personalizarLanding, enlaceParaBoton, conLinkNuevo, SIN_PROMESA_DE_CORREO } from '../lib/lead-magnets/landing';
import { fundirDelOnboarding } from '../lib/entregable-fundir';
import { piezaDe, paginaDe, plantillaGuardada, rutaDePieza } from '../lib/lead-magnets/pieza';
import { paginaDelShareLM } from '../lib/lead-magnets/compartir';
import { RECURSO_LEAD_MAGNET } from '../lib/share-nombre';
import { esEtiqueta, nombreDeSeccion, sanearContenido, textoDelDoc, NODOS } from '../lib/copywriter/doc';
import type { JsonNodo } from '../lib/copywriter/tipos';
import { DISENOS_LANDING, landingDesde } from '../lib/editor-landing/disenos-landing';
import { PLANTILLAS as OBJETIVOS } from '../lib/editor-landing/plantillas';
import { estadoDe, plantillasParaCrear, vistaDeLeadMagnet } from '../app/lead-magnet-generator/reglas';
import LeadMagnetCompartido from '../app/compartido/[token]/LeadMagnetCompartido';
import { REALES, sinAcentos } from './_reales';

/** El elenco ficticio de docs/plantillas-reales/README.md (2.2): ningún otro negocio en un ejemplo. */
const ELENCO = ['Cierre Consultivo', 'Consulta Rentable', 'Pulso Dental', 'Torre Alameda', 'Voz de Líder'];
const nodosDe = (n: unknown): Record<string, unknown>[] => {
  const o = n as { content?: unknown[] };
  return [n as Record<string, unknown>, ...(o.content ?? []).flatMap(nodosDe)];
};

test('las plantillas: ids únicos, etiquetas del Copywriter, y un ejemplo del elenco con una parte por sección', () => {
  const ids = PLANTILLAS_LEAD_MAGNET.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of PLANTILLAS_LEAD_MAGNET) {
    assert.ok(p.secciones.length >= 3, `${p.id}: muy pocas secciones`);
    for (const s of p.secciones) {
      assert.ok(esEtiqueta(s.etiqueta), `${p.id}: «${s.etiqueta}» no es una etiqueta del Copywriter (MAYÚSCULA, 2 a 20)`);
      assert.ok(s.guia.length > 10 && s.guia.length <= 140, `${p.id} · ${s.etiqueta}: la guía`);
    }
    assert.ok(ELENCO.includes(p.ejemplo.negocio), `${p.id}: «${p.ejemplo.negocio}» no es del elenco ficticio`);
    // Una parte por sección, en el mismo orden: «Ver ejemplo» muestra lo mismo que la pieza va a tener.
    assert.equal(p.ejemplo.partes.length, p.secciones.length, `${p.id}: el ejemplo no tiene una parte por sección`);
    p.ejemplo.partes.forEach((parte, i) => {
      assert.ok(parte.titulo.startsWith(nombreDeSeccion(p.secciones[i].etiqueta)), `${p.id}: la parte «${parte.titulo}» no es la sección ${p.secciones[i].etiqueta}`);
    });
    const todo = sinAcentos([p.nombre, p.ayuda, p.ejemplo.titulo, ...p.ejemplo.partes.flatMap((x) => [x.titulo, x.texto])].join(' '));
    for (const r of REALES) assert.ok(!todo.includes(sinAcentos(r)), `${p.id}: nombra a ${r}, que es real`);
    // El ejemplo está LLENO: nada «por completar». (Los corchetes de un prompt para copiar son su contenido: «[cliente]».)
    assert.doesNotMatch(p.ejemplo.partes.map((x) => x.texto).join(' '), /por completar|\[(completar|nombre de|tu |escribe)/i, `${p.id}: el ejemplo tiene huecos`);
    if (p.herramienta === 'web') assert.ok(OBJETIVOS.some((o) => o.id === p.objetivoLanding), `${p.id}: su objetivo de landing no existe`);
  }
  assert.equal(plantillaLeadMagnet('no-existe'), null);
  assert.equal(plantillaLeadMagnet(42), null);
  assert.equal(nombreInicial(plantillaLeadMagnet('guia')!, '   '), 'Guía práctica');
  assert.equal(nombreInicial(plantillaLeadMagnet('guia')!, '  Mi   guía  '), 'Mi guía');
  assert.deepEqual(chipsDeLeadMagnet(plantillaLeadMagnet('checklist')!).slice(0, 2), ['Para qué sirve', 'Antes']);
});

test('las tarjetas de «Nuevo lead magnet» traen la estructura y «Ver ejemplo» aparte', () => {
  const t = plantillasParaCrear();
  assert.equal(t.length, PLANTILLAS_LEAD_MAGNET.length);
  for (const x of t) {
    assert.equal(x.verEjemplo, true, `${x.id}: sin «Ver ejemplo»`);
    assert.ok(x.ejemplo && x.extracto && x.chips?.length, `${x.id}: la tarjeta es un rectángulo con un nombre`);
  }
});

test('la página nace con la ESTRUCTURA (nunca el ejemplo), pasa el saneo del Copywriter y no se comparte con la guía puesta', () => {
  for (const p of PLANTILLAS_LEAD_MAGNET.filter((x) => x.herramienta === 'copywriter')) {
    const doc = esqueletoLeadMagnet(p);
    const s = sanearContenido(doc);
    assert.ok(s.ok, `${p.id}: el saneo rechazó el esqueleto`);
    const texto = textoDelDoc(doc);
    for (const parte of p.ejemplo.partes) assert.ok(!texto.includes(parte.texto.split('\n')[0]), `${p.id}: el ejemplo se coló en la pieza`);
    // Recién nacida: todas las guías siguen puestas y no hay nada propio.
    assert.deepEqual(guiasQueQuedan(doc, p), p.secciones.map((x) => x.etiqueta), `${p.id}: el link no sale con la guía puesta`);
    assert.equal(tieneContenidoPropio(doc, p), false, `${p.id}: una página recién nacida no tiene nada que compartir`);
    // La persona reemplaza la guía de la primera sección con su texto.
    const escrito: JsonNodo = JSON.parse(JSON.stringify(doc));
    const guia = escrito.content!.find((n) => n.type === NODOS.parrafo && n.content?.[0]?.text === p.secciones[0].guia)!;
    guia.content = [{ type: 'text', text: 'Lo que escribió el negocio.' }];
    assert.deepEqual(guiasQueQuedan(escrito, p), p.secciones.slice(1).map((x) => x.etiqueta));
    assert.equal(tieneContenidoPropio(escrito, p), true);
  }
  // Cada forma tiene su nodo: tareas en el checklist, desplegables en los prompts, tabla en la planilla.
  const tipos = (id: string) => (esqueletoLeadMagnet(plantillaLeadMagnet(id)!).content ?? []).map((n) => n.type);
  assert.ok(tipos('checklist').includes(NODOS.tareas));
  assert.ok(tipos('prompts').includes(NODOS.desplegable));
  assert.ok(tipos('planilla').includes(NODOS.tabla));
  // Las columnas de la tabla son de la plantilla, no de la persona.
  const planilla = plantillaLeadMagnet('planilla')!;
  assert.equal(tieneContenidoPropio(esqueletoLeadMagnet(planilla), planilla), false);
});

test('la landing que nace: el nombre puesto, el formulario lleva a la página de gracias y su botón al link del lead magnet', () => {
  const minimal = DISENOS_LANDING.find((d) => d.id === 'minimal')!;
  const base = landingDesde(minimal, 'lead-magnet')!;
  const gracias = base.paginas.find((x) => x.ruta === 'gracias')!;
  const c = personalizarLanding(base, { nombre: 'Guía: tu agenda llena', enlace: 'https://hola-mako.com/compartido/abc' });
  const todo = JSON.stringify(c);
  assert.ok(!todo.includes('[Nombre de la guía]'), 'quedó el marcador del nombre');
  assert.ok(todo.includes('Guía: tu agenda llena'));
  const nodos = (n: unknown): Record<string, unknown>[] => {
    const o = n as { content?: unknown[] };
    return [n as Record<string, unknown>, ...(o.content ?? []).flatMap(nodos)];
  };
  const forms = c.paginas.filter((x) => x.ruta !== 'gracias').flatMap((x) => nodos(x.doc)).filter((n) => n.type === 'formulario');
  assert.ok(forms.length >= 1);
  for (const f of forms) assert.equal((f.attrs as Record<string, unknown>).redirigir, `pagina:${gracias.id}`, 'el formulario lleva a la página de gracias');
  const botones = nodos(c.paginas.find((x) => x.ruta === 'gracias')!.doc).filter((n) => n.type === 'boton');
  assert.ok(botones.some((b) => (b.attrs as Record<string, unknown>).href === 'https://hola-mako.com/compartido/abc'));
  // La de antes no se tocó (devuelve una copia).
  assert.ok(JSON.stringify(base).includes('[Nombre de la guía]'));
  // Nada promete un correo que nadie manda (la revisión del 6/11/2026): la página de gracias da el link en el acto.
  assert.ok(JSON.stringify(base).includes('Revisa tu correo'), 'la plantilla cambió: revisar SIN_PROMESA_DE_CORREO');
  assert.doesNotMatch(todo, /correo en|tu correo\.|va en camino/i, 'la página promete un correo');
  for (const [antes, ahora] of Object.entries(SIN_PROMESA_DE_CORREO)) assert.ok(!todo.includes(JSON.stringify(antes).slice(1, -1)) || antes === ahora, `quedó «${antes}»`);
  // Un link que no es http(s) no llega al botón.
  const mal = personalizarLanding(base, { nombre: 'x', enlace: 'javascript:alert(1)' });
  assert.ok(!JSON.stringify(mal).includes('javascript:'), 'un javascript: no llega al botón');
  assert.equal(enlaceParaBoton('javascript:alert(1)'), null);
  assert.equal(enlaceParaBoton('https://user:clave@x.com'), null);
  assert.equal(enlaceParaBoton('https://x.com/a'), 'https://x.com/a');
  // La clase grabada: el formulario también lleva a la clase.
  const clase = personalizarLanding(landingDesde(DISENOS_LANDING.find((d) => d.id === 'claro-clasico')!, 'clase-grabada')!, { nombre: 'Mi clase' });
  const deClase = clase.paginas[0].doc;
  assert.ok(nodos(deClase).some((n) => n.type === 'formulario' && String((n.attrs as Record<string, unknown>).redirigir).startsWith('pagina:')));
  assert.ok(!JSON.stringify(clase).includes('[Nombre de la clase]'));
});

test('el link nuevo pasa al botón de gracias que llevaba al viejo (o que quedó sin destino), y a ningún otro', () => {
  const minimal = DISENOS_LANDING.find((d) => d.id === 'minimal')!;
  const c = personalizarLanding(landingDesde(minimal, 'lead-magnet')!, { nombre: 'X', enlace: 'https://a.com/viejo' });
  const botones = (x: typeof c) => x.paginas.flatMap((pg) => nodosDe(pg.doc).filter((n) => n.type === 'boton').map((n) => ({ ruta: pg.ruta, href: (n.attrs as Record<string, unknown>).href })));
  const nuevo = conLinkNuevo(c, 'https://a.com/viejo', 'https://b.com/nuevo')!;
  assert.ok(nuevo, 'no cambió nada');
  assert.deepEqual(botones(nuevo).filter((b) => b.ruta === 'gracias').map((b) => b.href), ['https://b.com/nuevo']);
  // Los botones de las otras páginas (los del inicio, que van al formulario) no se tocan.
  assert.deepEqual(botones(nuevo).filter((b) => b.ruta !== 'gracias'), botones(c).filter((b) => b.ruta !== 'gracias'));
  assert.equal(conLinkNuevo(nuevo, 'https://a.com/viejo', 'https://b.com/nuevo'), null, 'ya estaba: nada que guardar');
  // Uno que quedó en «#» (una página de antes) también lo toma; sacar el link lo deja en «#».
  const sinLink = personalizarLanding(landingDesde(minimal, 'lead-magnet')!, { nombre: 'X' });
  assert.deepEqual(botones(conLinkNuevo(sinLink, null, 'https://b.com/n')!).filter((b) => b.ruta === 'gracias').map((b) => b.href), ['https://b.com/n']);
  assert.deepEqual(botones(conLinkNuevo(nuevo, 'https://b.com/nuevo', null)!).filter((b) => b.ruta === 'gracias').map((b) => b.href), ['#']);
});

test('guardar el Entregable del onboarding no borra lo armado en la tab, ni su link, ni el orden', () => {
  const guardada = [
    { id: 'b', nombre: 'Checklist', tipo: 'Checklist', queEs: '', fomo: '', enlace: 'https://x.com/b', pieza: { herramienta: 'copywriter' as const, id: 'gbbbbbbbbbb' }, pagina: 4 },
    { id: 'a', nombre: 'Guía vieja', tipo: 'Documento', queEs: 'q', fomo: 'f', enlace: 'https://x.com/a' },
    { id: 'c', nombre: 'Borrador', tipo: 'Documento', queEs: '', fomo: '' },
  ];
  // La pantalla del onboarding abrió antes de que existiera «b»: manda «a» (con otro nombre) y una nueva; «c» la borró.
  const f = fundirDelOnboarding(guardada, [
    { id: 'a', nombre: 'Guía nueva', tipo: 'Documento', queEs: 'q2', fomo: 'f2' },
    { id: 'n', nombre: 'Nueva', tipo: 'Plantilla', queEs: '', fomo: '' },
  ]);
  assert.deepEqual(f.map((e) => e.id), ['b', 'a', 'n'], 'el orden es el guardado; la nueva va al final; la borrada sale');
  assert.equal(f[0].pieza?.id, 'gbbbbbbbbbb', 'lo armado en la tab se queda');
  assert.equal(f[1].nombre, 'Guía nueva');
  assert.equal(f[1].enlace, 'https://x.com/a', 'su link sigue');
  // Una tarjeta vacía no se guarda.
  assert.deepEqual(fundirDelOnboarding([], [{ id: 'v', nombre: '', tipo: '', queEs: '', fomo: '' }]), []);
  // Ni una nueva sin nombre: quedaba guardada e invisible (ninguna pantalla lista una sin nombre).
  assert.deepEqual(fundirDelOnboarding([], [{ id: 'v', nombre: ' ', tipo: 'Guía', queEs: 'algo', fomo: '' }]), []);
  // Vaciar el nombre de una guardada conserva el que tenía (sin nombre se escondía, y si era la primera cambiaba el link).
  const vaciada = fundirDelOnboarding(guardada, [{ id: 'a', nombre: '', tipo: 'Documento', queEs: 'q3', fomo: 'f3' }]);
  assert.equal(vaciada.find((e) => e.id === 'a')?.nombre, guardada.find((e) => e.id === 'a')?.nombre);
  assert.equal(vaciada.find((e) => e.id === 'a')?.queEs, 'q3', 'lo demás sí cambia');
});

test('lo que viaja a la pantalla: si su página existe y si está publicada, en una lectura', () => {
  const lm = { id: 'a', nombre: 'Guía', tipo: 'Documento', enlace: 'https://x.com', pieza: { herramienta: 'copywriter' as const, id: 'gabc123defg' }, pagina: 7 };
  const landings = new Map([[7, { url: null }], [9, { url: 'https://hola-mako.site/clase' }]]);
  assert.deepEqual(vistaDeLeadMagnet(lm, landings), { ...lm, paginaPublicada: false });
  assert.equal(estadoDe(vistaDeLeadMagnet(lm, landings)).falta, 'Falta publicar su página.', 'una página sin publicar no es «listo»');
  assert.equal(estadoDe(vistaDeLeadMagnet(lm, new Map([[7, { url: 'https://hola-mako.site/g' }]]))).falta, null);
  // Se borró: vuelve «Crear su página».
  assert.equal(vistaDeLeadMagnet(lm, new Map()).pagina, undefined);
  // No se pudo leer: no se afirma nada (ni que se borró, ni que no está publicada).
  const sinLeer = vistaDeLeadMagnet(lm, null);
  assert.equal(sinLeer.pagina, 7);
  assert.equal(sinLeer.paginaPublicada, null);
  assert.equal(estadoDe(sinLeer).falta, null);
  const clase = { id: 'c', nombre: 'Clase', tipo: 'Metodología', pieza: { herramienta: 'web' as const, id: '9' } };
  assert.equal(vistaDeLeadMagnet(clase, landings).piezaUrl, 'https://hola-mako.site/clase');
  // «Dejar de compartir» sale de los links ABIERTOS de su página, no de su link: uno cambiado por la API deja el viejo abierto.
  const conDrive = { ...lm, enlace: 'https://drive.google.com/x' };
  assert.equal(vistaDeLeadMagnet(conDrive, landings, new Map([['gabc123defg', 1]])).compartidos, 1);
  assert.equal(vistaDeLeadMagnet(conDrive, landings, new Map()).compartidos, 0);
  assert.equal(vistaDeLeadMagnet(conDrive, landings, null).compartidos, undefined, 'sin leerlos no se ofrece');
  assert.equal(vistaDeLeadMagnet(clase, landings, new Map([['9', 2]])).compartidos, undefined, 'una landing no tiene links de solo lectura');
});

test('dónde vive la pieza: sólo un id de su herramienta se guarda', () => {
  assert.deepEqual(piezaDe({ herramienta: 'copywriter', id: 'gabc123defg' }), { herramienta: 'copywriter', id: 'gabc123defg' });
  assert.deepEqual(piezaDe({ herramienta: 'web', id: 42 }), { herramienta: 'web', id: '42' });
  assert.equal(piezaDe({ herramienta: 'copywriter', id: '../../x' }), null, 'una pieza con un id que no es de la herramienta no se guarda');
  assert.equal(piezaDe({ herramienta: 'web', id: 'gabc123defg' }), null);
  assert.equal(piezaDe({ herramienta: 'dashboard', id: '1' }), null);
  assert.equal(piezaDe(null), null);
  assert.equal(paginaDe('17'), 17);
  assert.equal(paginaDe(-1), null);
  assert.equal(paginaDe('1.5'), null);
  assert.equal(plantillaGuardada('guia'), 'guia');
  assert.equal(plantillaGuardada('<script>'), null);
  assert.equal(rutaDePieza({ herramienta: 'copywriter', id: 'gabc123defg' }), '/copywriter/gabc123defg');
  assert.equal(rutaDePieza({ herramienta: 'web', id: '42' }), '/web-generator/42');
});

test('el link público deja LEER una página, de un negocio, y nunca edita', () => {
  const ok = { recurso: RECURSO_LEAD_MAGNET, workspace_id: 3, alcance: 'item', recurso_id: 'gabc123defg', permiso: 'ver' };
  assert.deepEqual(paginaDelShareLM(ok), { ws: 3, id: 'gabc123defg' });
  assert.deepEqual(paginaDelShareLM({ ...ok, workspace_id: '3' }), { ws: 3, id: 'gabc123defg' });
  assert.equal(paginaDelShareLM({ ...ok, permiso: 'editar' }), null, 'un link de este recurso nunca edita');
  assert.equal(paginaDelShareLM({ ...ok, recurso: 'copywriter' }), null);
  assert.equal(paginaDelShareLM({ ...ok, alcance: 'todo' }), null);
  assert.equal(paginaDelShareLM({ ...ok, workspace_id: 0 }), null);
  assert.equal(paginaDelShareLM({ ...ok, recurso_id: null }), null);
  assert.equal(paginaDelShareLM({ ...ok, recurso_id: '../otra' }), null);
});

test('la página que ve el lead: el título, las tareas, y ningún link que no sea http(s) o mailto', () => {
  const doc: JsonNodo = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Antes' }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Revisar' }] }] }] },
      { type: 'paragraph', content: [
        { type: 'text', text: 'malo', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
        { type: 'text', text: 'bueno', marks: [{ type: 'link', attrs: { href: 'https://x.com' } }] },
      ] },
      { type: 'toggle', attrs: { abierto: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Prompt 1' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'adentro' }] }] },
      { type: 'nodoRaro', content: [{ type: 'text', text: 'no se dibuja' }] },
    ],
  };
  const html = renderToStaticMarkup(createElement(LeadMagnetCompartido, { titulo: 'Checklist <b>', emoji: '✅', doc }));
  assert.match(html, /<h1 class="lmc-titulo">Checklist &lt;b&gt;<\/h1>/);
  assert.match(html, /data-hecho="si"/);
  assert.ok(!html.includes('javascript:'), 'la página del lead no dibuja un javascript:');
  assert.match(html, /<a href="https:\/\/x.com" target="_blank" rel="noopener noreferrer nofollow">bueno<\/a>/);
  assert.match(html, /<details class="lmc-desplegable"><summary>/, 'un desplegable cerrado se dibuja cerrado');
  assert.ok(!html.includes('no se dibuja'));
});

test('qué le falta a un lead magnet para llegarle a un lead', () => {
  const copy = { id: 'a', nombre: 'Guía', tipo: 'Documento', pieza: { herramienta: 'copywriter' as const, id: 'gabc123defg' } };
  assert.equal(estadoDe(copy).falta, 'Falta su link: escríbela y créalo.');
  assert.equal(estadoDe(copy).puedeCompartir, true);
  assert.equal(estadoDe({ ...copy, enlace: 'https://x.com' }).falta, 'Falta la página donde la piden.');
  assert.equal(estadoDe({ ...copy, enlace: 'https://x.com', pagina: 4 }).falta, null);
  const viejo = { id: 'b', nombre: 'Plantilla', tipo: 'Plantilla' };
  assert.equal(estadoDe(viejo).falta, 'Falta su link.');
  assert.equal(estadoDe(viejo).puedeCompartir, false);
  assert.equal(estadoDe(copy).puedePrimero, false, 'sin link no se pone primero: las automatizaciones mandarían un link vacío');
  assert.equal(estadoDe({ ...copy, enlace: 'https://x.com' }).puedePrimero, true);
  const clase = { id: 'c', nombre: 'Clase', tipo: 'Metodología', pieza: { herramienta: 'web' as const, id: '9' } };
  assert.equal(estadoDe(clase).puedeCaptar, false, 'la clase grabada ya es una página con su formulario');
  assert.equal(estadoDe(clase).falta, 'Falta publicarla y usar su link.', 'una clase sin link no es «listo»');
  assert.equal(estadoDe({ ...clase, piezaUrl: 'https://hola-mako.site/c' }).falta, 'Falta usar su link.');
  assert.equal(estadoDe({ ...clase, enlace: 'https://hola-mako.site/c' }).falta, null);
});
