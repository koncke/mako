// =============================================================================
// CentinelaArranque — cuando la app muere ARRIBA de nuestros boundaries: se avisa y se reintenta UNA vez (21/10/2026)
// =============================================================================
// Martín, desde su Android (21/10, 22:54): «siempre que entro me sale el reload». La captura era «This page couldn't
// load. Reload to try again, or go back.»: la pantalla PROPIA de Next 16 (next/dist/client/components/builtin/
// global-error.js), no la nuestra. Next anida dos boundaries: el de afuera, con esa pantalla, y adentro el de
// app/global-error.tsx. Que se vea la de Next quiere decir que el error saltó por ENCIMA de app/global-error.tsx y de
// app/error.tsx (una acción del router cuya promesa se rechazó: AppRouter → `use(state)`), así que ninguno de los dos se
// enteró. Y el reportador de la ventana (ReportarErrores.tsx) no estaba montado en el teléfono. Por eso la Ticketera no
// tenía ni un error del navegador (medido: errores_app, 2 filas en total, las dos de MaKo).
//
// Lo que hace, sin React (corre antes de que hidrate, y sigue vivo cuando React ya se cayó):
//   1. guarda los últimos errores de la ventana (los que tira `reportError`, que es como Next avisa los suyos) y los
//      archivos que no cargaron (un chunk que falla es un <script> que no llega);
//   2. si <html> pasa a tener `id="__next_error__"` —la marca de la pantalla de Next, y sólo de ella: app/global-error.tsx
//      no la pone—, manda el error real a /api/errores como `PantallaDeNext` (lib/errores-app-reglas.ts no lo trata como
//      ruido: la persona VIO la app rota);
//   3. y recarga UNA vez, lo mismo que hacía Martín a mano con «Reload». Sin bucle: la marca de sessionStorage dice cuándo
//      fue el último reintento, y otro error dentro de `MS_REINTENTO` deja la pantalla de Next (el aviso sale igual).
//      Sin sessionStorage no se reintenta: sin la marca no hay con qué cortar un bucle.
//   El reintento es un `location.reload()` y alcanza: el HTML de la app sale con `Cache-Control: no-store` y los chunks
//   llevan su hash y `?dpl=` (medido en producción el 21/10/2026), así que recargar ya trae el deploy de ahora.
//
// ⚠️ Sólo con sesión (lo monta app/layout.tsx así): /api/errores la exige, y una página pública no recarga sola.
// ⚠️ UN SOLO template literal (tests/minificador-templates.test.ts): partido con `+`, el minificador se come el texto.
// ⚠️ SIN 'use client': renderizado desde el layout (server), el <script> entra en el HTML y corre antes que React.

import { ID_PANTALLA_DE_NEXT, PANTALLA_DE_NEXT } from '@/lib/errores-app-reglas';

/** La marca del último reintento automático (sessionStorage: dura lo que la pestaña o la app instalada). */
export const CLAVE_REINTENTO = 'mako_reintento_arranque';
/** Dentro de esta ventana, un segundo error no recarga: se queda en la pantalla de Next. */
export const MS_REINTENTO = 60_000;
/** Cuántos errores se guardan mientras carga (el último es el que tumbó la pantalla). */
export const TOPE_ERRORES = 5;

export const CENTINELA_ARRANQUE = `(function(){try{if(window.__makoCentinela)return;window.__makoCentinela=1;var E=[];var g=function(n,m,s){if(E.length>=${TOPE_ERRORES})E.shift();E.push({n:String(n||'Error').slice(0,60),m:String(m||'').slice(0,500),s:String(s||'').slice(0,4000)});};addEventListener('error',function(e){var t=e&&e.target;if(t&&t!==window&&(t.src||t.href)){g('RecursoNoCargo',String(t.src||t.href).split('?')[0],'');return;}var x=e&&e.error;g(x&&x.name,(x&&x.message)||(e&&e.message),x&&x.stack);},true);addEventListener('unhandledrejection',function(e){var r=e&&e.reason;g((r&&r.name)||'PromesaRechazada',(r&&r.message)||String(r),r&&r.stack);});var d=document.documentElement,hecho=0;var mirar=function(){if(hecho||d.id!=='${ID_PANTALLA_DE_NEXT}')return;hecho=1;var u=E[E.length-1]||{n:'',m:'',s:''};try{fetch('/api/errores',{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({nombre:'${PANTALLA_DE_NEXT}',mensaje:(u.n?u.n+': ':'')+(u.m||'(sin error capturado)'),stack:u.s,ruta:location.pathname+location.search,navegador:navigator.userAgent,pantalla:innerWidth+'x'+innerHeight})}).catch(function(){});}catch(e){}var antes=null;try{antes=sessionStorage.getItem('${CLAVE_REINTENTO}');}catch(e){return;}if(antes&&Date.now()-Number(antes)<${MS_REINTENTO})return;try{sessionStorage.setItem('${CLAVE_REINTENTO}',String(Date.now()));}catch(e){return;}setTimeout(function(){location.reload();},150);};new MutationObserver(mirar).observe(d,{attributes:true,attributeFilter:['id']});}catch(e){}})()`;

export function CentinelaArranque() {
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: CENTINELA_ARRANQUE }} />;
}
