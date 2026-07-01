// =============================================================================
// GET /martinkoncke — Tablero de ejecución (kanban privado de Martín)
// =============================================================================
// Ruta oculta: no figura en el sidebar ni la alcanza ningún botón. Se sirve como
// documento HTML autónomo desde un route handler, por lo que NO hereda el layout
// raíz (sidebar, globals.css): el tablero se ve tal cual su diseño original.
//
// Persistencia: el HTML trae un shim que respalda window.storage con localStorage
// del navegador, así que los cambios (avance, notas, fechas, categorías, tareas
// nuevas) se guardan solos en este equipo. Las 37 tareas semilla son el estado ya
// organizado por prioridad.
//
// Fuente: 'Kanban ORGANIZATIVO.html'. Para editar el tablero, regenerar con el
// script scratchpad/build-route.js (inyecta el shim antes de </head>).
// =============================================================================

export const dynamic = 'force-static';

const HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tablero de ejecución · MaKo</title>
<style>
  :root{
    --bg:#1c1c1e; --panel:#242427; --panel-2:#2a2a2e;
    --line:rgba(255,255,255,.08); --line-strong:rgba(255,255,255,.14);
    --gold:#f0c60a; --gold-dim:rgba(240,198,10,.16);
    --txt:#f5f5f4; --muted:#9b9ba2; --muted-2:#6f6f76;
    --alta:#e5484d; --media:#f0a818; --baja:#46a758;
    --radius:14px; --fast:.18s cubic-bezier(.2,.7,.3,1);
    --chev:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 3.5L5 6.5L8 3.5' stroke='%239b9ba2' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  }
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--txt);color-scheme:dark}
  body{font-family:Arial,-apple-system,"Segoe UI",Roboto,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.45;padding:26px 16px 64px}
  .wrap{max-width:1360px;margin:0 auto}

  /* Encabezado */
  .head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}
  .eyebrow{display:flex;align-items:center;gap:9px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);font-weight:700}
  .eyebrow .sq{width:9px;height:9px;background:var(--gold);display:inline-block}
  h1{font-size:24px;letter-spacing:-.01em;margin:8px 0 2px;font-weight:800}
  .sub{color:var(--muted);font-size:13px;max-width:640px}
  .progress{min-width:220px;flex:0 0 auto}
  .pbar{height:8px;border-radius:99px;background:var(--panel-2);overflow:hidden;border:1px solid var(--line)}
  .pfill{height:100%;width:0;background:linear-gradient(90deg,#caa406,var(--gold));border-radius:99px;transition:width .35s cubic-bezier(.2,.7,.3,1)}
  .pmeta{display:flex;justify-content:space-between;align-items:baseline;margin-top:7px}
  .pmeta b{font-size:18px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
  .pmeta b small{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.04em;margin-left:5px}
  .pmeta span{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}

  /* Agregar */
  .bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:22px 0 12px;padding-top:16px;border-top:1px solid var(--line)}
  .add{display:flex;gap:8px;flex:1;min-width:240px}
  .add input{flex:1;background:var(--panel);border:1px solid var(--line);color:var(--txt);font:inherit;font-size:14px;padding:10px 14px;border-radius:11px;transition:border-color var(--fast)}
  .add input::placeholder{color:var(--muted-2)}
  .add input:focus{outline:none;border-color:var(--gold)}
  .btn{appearance:none;border:1px solid var(--line-strong);background:var(--panel);color:var(--txt);font:inherit;font-size:12.5px;padding:9px 13px;border-radius:99px;cursor:pointer;transition:background var(--fast),border-color var(--fast);white-space:nowrap}
  .btn:hover{background:var(--panel-2);border-color:var(--muted-2)}
  .btn:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .btn.ghost{background:transparent}
  .btn.active{border-color:var(--gold);color:var(--gold);background:var(--gold-dim)}
  .add .btn{border-color:var(--gold);color:var(--gold);background:var(--gold-dim);font-weight:700}
  .add .btn:hover{background:rgba(240,198,10,.24)}

  /* Toolbar orden/filtro */
  .tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px}
  #searchInput{background:var(--panel);border:1px solid var(--line);color:var(--txt);font:inherit;font-size:13px;padding:8px 12px;border-radius:10px;min-width:170px;flex:1;transition:border-color var(--fast)}
  #searchInput:focus{outline:none;border-color:var(--gold)}
  .tool-sel{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;color:var(--muted);white-space:nowrap}
  .tool-sel select{appearance:none;-webkit-appearance:none;-moz-appearance:none;background-color:var(--panel);border:1px solid var(--line-strong);border-radius:9px;color:var(--txt);font:inherit;font-size:12.5px;padding:7px 26px 7px 11px;cursor:pointer;background-repeat:no-repeat;background-position:right 8px center;background-size:10px;background-image:var(--chev)}
  .tool-sel select:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .tool-sel select option{background:#242427;color:var(--txt)}

  /* Panel categorías */
  .cat-panel{background:var(--panel);border:1px solid var(--line-strong);border-radius:12px;padding:14px;margin:0 0 16px}
  .cat-panel[hidden]{display:none}
  .cat-list{display:flex;flex-direction:column;gap:7px;margin-bottom:12px}
  .cat-empty{font-size:12.5px;color:var(--muted-2)}
  .cat-row{display:flex;align-items:center;gap:9px;background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:6px 10px}
  .cat-row .cat-name{flex:1;font-size:13px}
  .cat-del{border:none;background:transparent;color:var(--muted-2);font-size:16px;cursor:pointer;line-height:1;border-radius:6px;width:22px;height:22px;display:grid;place-items:center}
  .cat-del:hover{color:var(--alta);background:rgba(229,72,77,.12)}
  .cat-form{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--line)}
  #newCatName{background:var(--panel-2);border:1px solid var(--line-strong);border-radius:9px;color:var(--txt);font:inherit;font-size:13px;padding:8px 11px;min-width:150px}
  #newCatName:focus{outline:none;border-color:var(--gold)}
  .swatches{display:flex;gap:6px;flex-wrap:wrap}
  .swatch{width:22px;height:22px;border-radius:6px;border:2px solid transparent;cursor:pointer;padding:0}
  .swatch.sel{border-color:var(--txt)}
  .cat-form .btn{border-color:var(--gold);color:var(--gold);background:var(--gold-dim);font-weight:700}

  /* Tablero 4 columnas */
  .board{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;align-items:start}
  @media(max-width:1100px){.board{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:680px){.board{grid-template-columns:1fr}}
  .col{background:rgba(255,255,255,.02);border:1px solid var(--line);border-top:3px solid var(--media);border-radius:var(--radius);padding:12px}
  .col.col-alta{border-top-color:var(--alta)}
  .col.col-media{border-top-color:var(--media)}
  .col.col-baja{border-top-color:var(--baja)}
  .col.col-futuro{border-top-color:var(--muted-2);background:rgba(255,255,255,.012)}
  .col-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}
  .col-title{font-size:12px;font-weight:800;letter-spacing:.14em;display:flex;align-items:center;gap:8px}
  .col-count{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:2px 10px}
  .col-bar{height:4px;background:var(--panel-2);border-radius:99px;overflow:hidden;margin-bottom:12px}
  .col-bar span{display:block;height:100%;background:linear-gradient(90deg,#caa406,var(--gold));border-radius:99px;transition:width .35s}
  .col-futuro .col-bar span{background:linear-gradient(90deg,#5a5a60,#8a8a90)}
  .col-body{display:flex;flex-direction:column;gap:10px;min-height:24px}
  .col-empty{font-size:12.5px;color:var(--muted-2);text-align:center;padding:18px 8px;border:1px dashed var(--line);border-radius:10px}
  .dot{width:8px;height:8px;border-radius:99px;display:inline-block}
  .dot.alta{background:var(--alta)} .dot.media{background:var(--media)} .dot.baja{background:var(--baja)} .dot.futuro{background:var(--muted-2)}

  /* Tarjeta */
  .card{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--media);border-radius:12px;padding:11px 12px;animation:in .26s cubic-bezier(.2,.7,.3,1) both;transition:opacity var(--fast),border-color var(--fast)}
  @keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .card.prio-alta{border-left-color:var(--alta)}
  .card.prio-media{border-left-color:var(--media)}
  .card.prio-baja{border-left-color:var(--baja)}
  .card.prio-futuro{border-left-color:var(--muted-2)}
  .card.done{opacity:.5;border-left-color:var(--muted-2)}
  .card:hover{border-color:var(--line-strong)}

  .card-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
  .ct-left{display:flex;align-items:center;gap:8px;min-width:0}
  .ct-right{display:flex;align-items:center;gap:2px;flex:0 0 auto}
  .num{font-size:10.5px;font-weight:700;color:var(--muted-2);font-variant-numeric:tabular-nums;letter-spacing:.05em}

  .prio-select{appearance:none;-webkit-appearance:none;-moz-appearance:none;background-color:var(--panel-2);border:1px solid var(--line-strong);border-radius:8px;font:inherit;font-size:11px;font-weight:800;padding:4px 22px 4px 9px;cursor:pointer;background-repeat:no-repeat;background-position:right 7px center;background-size:9px;background-image:var(--chev)}
  .prio-select.prio-alta{color:var(--alta)}
  .prio-select.prio-media{color:var(--media)}
  .prio-select.prio-baja{color:var(--baja)}
  .prio-select.prio-futuro{color:var(--muted)}
  .prio-select:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .prio-select option{background:#242427;color:var(--txt)}

  .done-btn{width:22px;height:22px;border-radius:7px;border:1.5px solid var(--muted-2);background:transparent;cursor:pointer;display:grid;place-items:center;transition:all var(--fast);padding:0}
  .done-btn svg{width:12px;height:12px;stroke:#1c1c1e;stroke-width:3.2;fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:0;transform:scale(.5);transition:all var(--fast)}
  .done-btn:hover{border-color:var(--gold)}
  .done-btn:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .card.done .done-btn{background:var(--gold);border-color:var(--gold)}
  .card.done .done-btn svg{opacity:1;transform:none}

  .del{width:22px;height:22px;border:none;background:transparent;color:var(--muted-2);font-size:16px;line-height:1;cursor:pointer;border-radius:6px;opacity:0;transition:all var(--fast);display:grid;place-items:center}
  .card:hover .del,.del:focus-visible{opacity:1}
  .del:hover{color:var(--alta);background:rgba(229,72,77,.12)}
  .del:focus-visible{outline:2px solid var(--gold);outline-offset:1px}

  .title{font-size:13.5px;line-height:1.4;margin-bottom:10px;word-wrap:break-word;overflow-wrap:anywhere;cursor:text;border-radius:6px}
  .title:hover{text-decoration:underline dashed var(--muted-2);text-underline-offset:3px}
  .card.done .title{text-decoration:line-through;text-decoration-color:var(--muted-2);color:var(--muted)}
  .title-edit-box{width:100%;background:var(--panel-2);border:1px solid var(--gold);border-radius:8px;color:var(--txt);font:inherit;font-size:13.5px;padding:8px 9px;resize:vertical;line-height:1.4;outline:none;margin-bottom:10px}

  /* Meta: deadline + categoría */
  .meta{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
  input[type=date]{background:var(--panel-2);border:1px solid var(--line-strong);border-radius:8px;color:var(--txt);font:inherit;font-size:11px;padding:4px 8px;cursor:pointer;max-width:100%}
  input[type=date].dl-empty{color:var(--muted-2)}
  input[type=date].dl-over{color:var(--alta);border-color:rgba(229,72,77,.5)}
  input[type=date].dl-soon{color:var(--media);border-color:rgba(240,168,24,.5)}
  input[type=date]:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.6);cursor:pointer}
  .cat-wrap{display:inline-flex;align-items:center;gap:6px;min-width:0;flex:1}
  .cat-dot{width:8px;height:8px;border-radius:99px;display:inline-block;flex:0 0 auto}
  .cat-dot.empty{border:1px solid var(--muted-2);background:transparent!important}
  .cat-select{appearance:none;-webkit-appearance:none;-moz-appearance:none;background-color:var(--panel-2);border:1px solid var(--line);border-radius:8px;font:inherit;font-size:11px;font-weight:600;padding:4px 22px 4px 8px;cursor:pointer;background-repeat:no-repeat;background-position:right 7px center;background-size:9px;background-image:var(--chev);max-width:100%}
  .cat-select:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .cat-select option{background:#242427;color:var(--txt)}

  /* Progreso */
  .prog{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  input[type=range]{-webkit-appearance:none;appearance:none;flex:1;height:5px;border-radius:99px;outline:none;cursor:pointer;background:var(--panel-2)}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:var(--gold);cursor:pointer;border:2px solid #1c1c1e}
  input[type=range]::-moz-range-thumb{width:15px;height:15px;border-radius:50%;background:var(--gold);cursor:pointer;border:2px solid #1c1c1e}
  input[type=range]:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
  .prog-val{font-size:11.5px;font-weight:800;color:var(--muted);font-variant-numeric:tabular-nums;min-width:38px;text-align:right}
  .card.done .prog-val{color:var(--gold)}

  /* Nota */
  .note{display:block;width:100%;text-align:left;font:inherit;font-size:12px;border-radius:8px;cursor:text}
  .note.addnote{background:transparent;border:1px dashed var(--line-strong);color:var(--muted-2);padding:5px 9px;transition:all var(--fast);cursor:pointer}
  .note.addnote:hover{border-color:var(--gold);color:var(--gold)}
  .note.has{background:var(--panel-2);border:1px solid var(--line);color:var(--muted);padding:7px 9px;white-space:pre-wrap;line-height:1.4;overflow-wrap:anywhere}
  .note.has:hover{border-color:var(--line-strong)}
  .note-edit-box{width:100%;background:var(--panel-2);border:1px solid var(--gold);border-radius:8px;color:var(--txt);font:inherit;font-size:12px;padding:7px 9px;resize:vertical;line-height:1.4;outline:none}

  .foot{margin-top:26px;text-align:center;font-size:11.5px;color:var(--muted-2);letter-spacing:.02em}
  .foot .save{color:var(--baja)}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
<script>
(function(){
  if (window.storage && typeof window.storage.get === "function") return;
  window.storage = {
    get: function(key){
      try {
        var v = window.localStorage.getItem(key);
        return Promise.resolve(v == null ? null : { value: v });
      } catch (e) { return Promise.resolve(null); }
    },
    set: function(key, val){
      try { window.localStorage.setItem(key, val); } catch (e) {}
      return Promise.resolve(true);
    }
  };
})();
</script>
</head>
<body>
<div class="wrap">

  <div class="head">
    <div>
      <div class="eyebrow"><span class="sq"></span> Tablero de ejecución</div>
      <h1>MaKo · Build list</h1>
      <div class="sub">Toca el nombre para editarlo. Asigna fecha y categoría en cada tarjeta. Cambia prioridad en el desplegable. Ordena y filtra arriba.</div>
    </div>
    <div class="progress">
      <div class="pbar"><div class="pfill" id="pfill"></div></div>
      <div class="pmeta"><b id="pavg">0%<small>avance activo</small></b><span id="pdone">0 / 0 al 100%</span></div>
    </div>
  </div>

  <div class="bar">
    <div class="add">
      <input id="addInput" type="text" placeholder="Agregar tarea nueva…" maxlength="180" aria-label="Nueva tarea">
      <button class="btn" id="addBtn">Agregar</button>
    </div>
  </div>

  <div class="tools">
    <input id="searchInput" type="text" placeholder="Buscar…" aria-label="Buscar tareas">
    <label class="tool-sel">Orden
      <select id="sortSel" aria-label="Ordenar por">
        <option value="num">Número</option>
        <option value="deadline">Deadline</option>
        <option value="progDesc">Avance ↓</option>
        <option value="progAsc">Avance ↑</option>
        <option value="az">A–Z</option>
      </select>
    </label>
    <label class="tool-sel">Categoría
      <select id="catFilter" aria-label="Filtrar por categoría"><option value="all">Todas</option></select>
    </label>
    <button class="btn ghost" id="toggleDone">Ocultar completadas</button>
    <button class="btn ghost" id="catBtn">Categorías</button>
    <button class="btn ghost" id="reset">Restaurar</button>
  </div>

  <div class="cat-panel" id="catPanel" hidden>
    <div class="cat-list" id="catList"></div>
    <div class="cat-form">
      <input id="newCatName" type="text" placeholder="Nueva categoría…" maxlength="30" aria-label="Nombre de categoría">
      <div class="swatches" id="swatches"></div>
      <button class="btn" id="newCatAdd">Crear</button>
    </div>
  </div>

  <div class="board" id="board"></div>

  <div class="foot">Tus cambios se guardan solos. <span class="save" id="saveState"></span></div>
</div>

<script>
(function(){
  "use strict";

  var TASKS_KEY="mako_tasks_v1", CATS_KEY="mako_cats_v1";
  var PRIOS=["alta","media","baja","futuro"];
  var ACTIVE=["alta","media","baja"];
  var LABEL={alta:"Alta",media:"Media",baja:"Baja",futuro:"A futuro"};
  var SWATCHES=["#e5484d","#f0a818","#46a758","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#9b9ba2"];

  var DEFAULTS=[
    [1,'Terminar el detalle de cada funcionalidad en la landing','alta',0,'Esto lo hago cuando regrese a Baires'],
    [2,'Corregir el detalle del lead en el CRM','alta',20,''],
    [3,'Implementar la funcionalidad de Perfil de Usuario','alta',0,''],
    [4,'Terminar la funcionalidad de Onboarding','alta',0,''],
    [5,'Implementar el sistema de Usuarios + vista de Admin','alta',0,''],
    [6,'Método para que nuevos usuarios pasen sus Tokens + tutorial de obtención','alta',0,''],
    [7,'Mayor ciberseguridad + depurar código y hacer la app más eficiente','alta',0,''],
    [8,'Implementar funcionalidad de Email Marketing','media',0,''],
    [9,'Implementar funcionalidad de Nutrición Automática','media',0,''],
    [10,'Implementar MaKo multi-agente con todas sus bases de conocimiento','baja',0,''],
    [11,'Implementar la vista de Experimentos','alta',0,''],
    [12,'Crear nuevas campañas desde la app (prompts, templates, subir creativos)','media',95,''],
    [13,'Implementar la tab de Customer Success','baja',0,''],
    [14,'Revisar y terminar el CRM Automático (leads que avanzan de etapa solos)','media',0,''],
    [15,'Terminar Testimonios (editar Lucre y Gabi, recopilar de otros clientes y de Infra)','baja',0,''],
    [16,'Terminar Calendly + configuración back-end (UTM, UUID, etc.)','baja',0,'Esto lo hago cuando regrese a Baires'],
    [17,'Investigar traspaso del ecosistema de las cuentas de Mauricio a las mías (costos)','baja',0,''],
    [18,'Implementar MaKo en las tabs que faltan (WhatsApp y revisar las otras)','media',0,''],
    [19,'Importar/exportar leads (que los importados entren en etapas de nutrición)','media',0,''],
    [20,'Reportes por WhatsApp (semáforo, ads, wins, etc.)','media',0,''],
    [21,'Reportes a leads y clientes post-reuniones','baja',0,''],
    [22,'Implementar y medir la Thank You Page en MaKo','baja',0,''],
    [23,'Evaluar hacer un Loom tutorial/demo por feature','baja',0,''],
    [24,'Implementar la funcionalidad de Landing Analyst','baja',0,''],
    [25,'Implementar la funcionalidad de VSL Analyst','baja',0,''],
    [26,'Implementar la funcionalidad de GhostWriter','baja',0,''],
    [27,'Evaluar costos internos y costos para el cliente','media',0,'Esto lo hago cuando regrese a Baires'],
    [28,'Implementar el Panel de Equipo para Closers y Setters','baja',0,''],
    [29,'Generación de Creativos Estáticos (estilo app de Claudio Conde)','baja',0,''],
    [30,'Protocolo de Beta y versiones (mejorar sin interrumpir a los usuarios)','media',0,''],
    [31,'Transcribir, ordenar y cargar info de cursos (Levantamuertos, Bluehackers, etc.)','media',0,''],
    [32,'Comprar dominio y mejorar ruteo (landing en la raíz, no en /vsl)','baja',0,''],
    [33,'Terminar de integrar la API de Analizar de la IA de Meta','media',0,''],
    [34,'Tab de Análisis de la Competencia','baja',0,''],
    [35,'Mapa de "Calor" para ver qué pestañas y funcionalidades más utilizan los usuarios','baja',0,''],
    [36,'Mejorar el diseño completo de la app','alta',0,''],
    [37,'Mejorar la EXPERIENCIA del usuario. Que todo sea SIMPLE','alta',0,'']
  ];

  function clamp(v){ v=+v; if(isNaN(v))v=0; return Math.max(0,Math.min(100,v)); }

  function seed(){
    return DEFAULTS.map(function(d){
      return {id:"t"+d[0],n:d[0],text:d[1],priority:d[2],prog:d[3]||0,note:d[4]||"",deadline:"",cat:null};
    });
  }
  function seedCats(){
    return [
      {id:"c1",name:"Frontend",color:"#3b82f6"},
      {id:"c2",name:"Backend",color:"#46a758"},
      {id:"c3",name:"Contenido",color:"#f0a818"}
    ];
  }
  function normalize(arr){
    return arr.map(function(t){
      var p=(PRIOS.indexOf(t.priority)>=0)?t.priority:"media";
      var prog=(typeof t.prog==="number")?clamp(t.prog):(t.done?100:0);
      return {
        id:t.id||("t"+(t.n||Math.floor(Math.random()*1e6))),
        n:t.n,text:t.text,priority:p,prog:prog,
        note:(typeof t.note==="string")?t.note:"",
        deadline:(typeof t.deadline==="string")?t.deadline:"",
        cat:(typeof t.cat==="string")?t.cat:null
      };
    });
  }
  function normalizeCats(arr){
    return arr.filter(function(c){return c&&c.id;}).map(function(c){
      return {id:c.id,name:String(c.name||"Categoría"),color:String(c.color||"#9b9ba2")};
    });
  }

  var tasks=[], cats=[];
  var hideDone=false, q="", sortMode="num", catFilterVal="all", selColor=SWATCHES[0];

  var hasStore=(typeof window!=="undefined"&&window.storage&&typeof window.storage.get==="function");

  function loadAll(cb){
    if(!hasStore){ tasks=seed(); cats=seedCats(); cb(); return; }
    Promise.all([
      window.storage.get(TASKS_KEY).catch(function(){return null;}),
      window.storage.get(CATS_KEY).catch(function(){return null;})
    ]).then(function(r){
      var tRes=r[0], cRes=r[1];
      if(tRes&&tRes.value){ try{tasks=normalize(JSON.parse(tRes.value));}catch(e){tasks=seed();} } else { tasks=seed(); }
      if(cRes&&cRes.value){ try{cats=normalizeCats(JSON.parse(cRes.value));}catch(e){cats=seedCats();} } else { cats=seedCats(); saveCats(); }
      cb();
    });
  }
  function save(){ if(!hasStore)return; try{ window.storage.set(TASKS_KEY,JSON.stringify(tasks)).then(flashSaved).catch(function(){}); }catch(e){} }
  function saveCats(){ if(!hasStore)return; try{ window.storage.set(CATS_KEY,JSON.stringify(cats)).then(flashSaved).catch(function(){}); }catch(e){} }
  var saveTimer; function debouncedSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(save,600); }
  var saveEl=document.getElementById("saveState"), flashTimer;
  function flashSaved(){ saveEl.textContent="✓ guardado"; clearTimeout(flashTimer); flashTimer=setTimeout(function(){saveEl.textContent="";},1400); }

  var board=document.getElementById("board");
  function svgCheck(){ return '<svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg>'; }
  function sliderBg(v){ return 'linear-gradient(90deg,#f0c60a '+v+'%,#2a2a2e '+v+'%)'; }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function find(id){ for(var i=0;i<tasks.length;i++) if(tasks[i].id===id) return tasks[i]; return null; }
  function findCat(id){ for(var i=0;i<cats.length;i++) if(cats[i].id===id) return cats[i]; return null; }

  function dlClass(d){
    if(!d) return "dl-empty";
    var today=new Date(); today.setHours(0,0,0,0);
    var due=new Date(d+"T00:00:00");
    if(isNaN(due.getTime())) return "";
    var diff=Math.round((due-today)/86400000);
    if(diff<0) return "dl-over";
    if(diff<=3) return "dl-soon";
    return "";
  }

  function anyFilter(){ return q!==""||catFilterVal!=="all"||hideDone; }
  function passFilter(t){
    if(hideDone&&t.prog===100) return false;
    if(catFilterVal==="none"){ if(t.cat) return false; }
    else if(catFilterVal!=="all"){ if(t.cat!==catFilterVal) return false; }
    if(q){ if(((t.text||"")+" "+(t.note||"")).toLowerCase().indexOf(q)<0) return false; }
    return true;
  }
  function makeCmp(){
    return function(a,b){
      var ad=a.prog===100, bd=b.prog===100;
      if(ad!==bd) return ad?1:-1;
      if(sortMode==="deadline"){ var av=a.deadline||"9999-99-99", bv=b.deadline||"9999-99-99"; if(av!==bv) return av<bv?-1:1; return a.n-b.n; }
      if(sortMode==="progDesc"){ if(b.prog!==a.prog) return b.prog-a.prog; return a.n-b.n; }
      if(sortMode==="progAsc"){ if(a.prog!==b.prog) return a.prog-b.prog; return a.n-b.n; }
      if(sortMode==="az"){ var r=(a.text||"").localeCompare(b.text||"","es"); return r!==0?r:a.n-b.n; }
      return a.n-b.n;
    };
  }

  function prioSelect(t){
    var o=PRIOS.map(function(p){return '<option value="'+p+'"'+(t.priority===p?" selected":"")+'>'+LABEL[p]+'</option>';}).join("");
    return '<select class="prio-select prio-'+t.priority+'" data-act="prio" aria-label="Prioridad">'+o+'</select>';
  }
  function catControl(t){
    var current=t.cat?findCat(t.cat):null;
    var color=current?current.color:"transparent";
    var txtColor=current?current.color:"var(--muted-2)";
    var opts='<option value="">Sin categoría</option>'+cats.map(function(c){
      return '<option value="'+c.id+'"'+(t.cat===c.id?" selected":"")+'>'+escapeHtml(c.name)+'</option>';
    }).join("");
    return '<span class="cat-wrap"><span class="cat-dot'+(current?"":" empty")+'" style="background:'+color+'"></span>'+
      '<select class="cat-select" data-act="cat" aria-label="Categoría" style="color:'+txtColor+'">'+opts+'</select></span>';
  }
  function noteRegion(t){
    if(t.note) return '<div class="note has" data-act="note" title="Editar nota">'+escapeHtml(t.note)+'</div>';
    return '<button class="note addnote" data-act="note">+ nota</button>';
  }
  function card(t){
    var done=t.prog===100, num=String(t.n).padStart(2,"0");
    return ''+
    '<div class="card prio-'+t.priority+(done?" done":"")+'" data-id="'+t.id+'">'+
      '<div class="card-top">'+
        '<div class="ct-left">'+prioSelect(t)+'<span class="num">'+num+'</span></div>'+
        '<div class="ct-right">'+
          '<button class="done-btn" data-act="done" aria-pressed="'+done+'" aria-label="'+(done?"Quitar 100%":"Marcar 100%")+'">'+svgCheck()+'</button>'+
          '<button class="del" data-act="del" aria-label="Eliminar" title="Eliminar">&times;</button>'+
        '</div>'+
      '</div>'+
      '<div class="title" data-act="title" title="Clic para editar">'+escapeHtml(t.text)+'</div>'+
      '<div class="meta">'+
        '<input type="date" class="dl '+dlClass(t.deadline)+'" data-act="dl" value="'+(t.deadline||"")+'" aria-label="Deadline">'+
        catControl(t)+
      '</div>'+
      '<div class="prog">'+
        '<input type="range" min="0" max="100" step="5" value="'+t.prog+'" data-act="prog" aria-label="Progreso" style="background:'+sliderBg(t.prog)+'">'+
        '<span class="prog-val">'+t.prog+'%</span>'+
      '</div>'+
      noteRegion(t)+
    '</div>';
  }

  function render(){
    var cmp=makeCmp(), html="";
    PRIOS.forEach(function(p){
      var items=tasks.filter(function(t){return t.priority===p;});
      var avg=items.length?Math.round(items.reduce(function(s,t){return s+t.prog;},0)/items.length):0;
      var shown=items.filter(passFilter).slice().sort(cmp);
      var body=shown.length?shown.map(card).join(""):'<div class="col-empty">'+(anyFilter()?"Sin coincidencias":"Sin tareas aquí")+'</div>';
      html+='<section class="col col-'+p+'"><div class="col-head"><span class="col-title"><span class="dot '+p+'"></span>'+LABEL[p].toUpperCase()+'</span><span class="col-count">'+items.length+'</span></div><div class="col-bar"><span style="width:'+avg+'%"></span></div><div class="col-body">'+body+'</div></section>';
    });
    board.innerHTML=html;
    paintGlobal();
  }
  function paintGlobal(){
    var active=tasks.filter(function(t){return t.priority!=="futuro";});
    var total=active.length;
    var avg=total?Math.round(active.reduce(function(s,t){return s+t.prog;},0)/total):0;
    var done=active.filter(function(t){return t.prog===100;}).length;
    document.getElementById("pfill").style.width=avg+"%";
    document.getElementById("pavg").innerHTML=avg+'%<small>avance activo</small>';
    document.getElementById("pdone").textContent=done+" / "+total+" al 100%";
  }

  function renderCatList(){
    var el=document.getElementById("catList");
    if(!cats.length){ el.innerHTML='<div class="cat-empty">Aún no hay categorías. Crea una abajo.</div>'; return; }
    el.innerHTML=cats.map(function(c){
      return '<div class="cat-row"><span class="cat-dot" style="background:'+c.color+'"></span><span class="cat-name">'+escapeHtml(c.name)+'</span><button class="cat-del" data-catdel="'+c.id+'" aria-label="Eliminar categoría">&times;</button></div>';
    }).join("");
  }
  function refreshCatFilter(){
    var sel=document.getElementById("catFilter"), cur=sel.value;
    sel.innerHTML='<option value="all">Todas</option>'+cats.map(function(c){return '<option value="'+c.id+'">'+escapeHtml(c.name)+'</option>';}).join("")+'<option value="none">Sin categoría</option>';
    sel.value=(cur==="all"||cur==="none"||findCat(cur))?cur:"all";
    catFilterVal=sel.value;
  }

  // Edición en sitio
  function editBox(cardEl,t,field,cls){
    var region=cardEl.querySelector('[data-act="'+field+'"]');
    if(!region) return;
    var ta=document.createElement("textarea");
    ta.className=cls; ta.rows= field==="title"?2:3;
    ta.value = field==="title"? t.text : (t.note||"");
    ta.placeholder = field==="title"? "Nombre de la tarea" : "Me falta… / nota";
    region.replaceWith(ta); ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length);
    ta.addEventListener("blur",function(){
      var v=ta.value.trim();
      if(field==="title"){ if(v) t.text=v; } else { t.note=v; }
      save(); render();
    },{once:true});
    ta.addEventListener("keydown",function(e){ if(e.key==="Escape") ta.blur(); });
  }

  // Eventos tablero
  board.addEventListener("input",function(e){
    var el=e.target; if(el.getAttribute("data-act")!=="prog") return;
    var cardEl=el.closest(".card"); if(!cardEl) return;
    var t=find(cardEl.dataset.id); if(!t) return;
    var v=clamp(el.value); t.prog=v;
    el.style.background=sliderBg(v);
    var lbl=cardEl.querySelector(".prog-val"); if(lbl) lbl.textContent=v+"%";
    cardEl.classList.toggle("done",v===100);
    debouncedSave();
  });
  board.addEventListener("change",function(e){
    var el=e.target, act=el.getAttribute("data-act");
    if(["prio","prog","cat","dl"].indexOf(act)<0) return;
    var cardEl=el.closest(".card"); if(!cardEl) return;
    var t=find(cardEl.dataset.id); if(!t) return;
    if(act==="prio") t.priority=el.value;
    else if(act==="prog") t.prog=clamp(el.value);
    else if(act==="cat") t.cat=el.value?el.value:null;
    else if(act==="dl") t.deadline=el.value||"";
    render(); save();
  });
  board.addEventListener("click",function(e){
    var btn=e.target.closest("[data-act]"); if(!btn) return;
    var a=btn.getAttribute("data-act");
    if(["prog","prio","cat","dl"].indexOf(a)>=0) return;
    var cardEl=btn.closest(".card"); if(!cardEl) return;
    var t=find(cardEl.dataset.id); if(!t) return;
    if(a==="done"){ t.prog=(t.prog===100?0:100); render(); save(); }
    else if(a==="del"){ if(confirm('¿Eliminar "'+t.text.slice(0,48)+(t.text.length>48?"…":"")+'"?')){ tasks=tasks.filter(function(x){return x.id!==t.id;}); render(); save(); } }
    else if(a==="title"){ editBox(cardEl,t,"title","title-edit-box"); }
    else if(a==="note"){ editBox(cardEl,t,"note","note-edit-box"); }
  });

  // Agregar
  var addInput=document.getElementById("addInput");
  function addTask(){
    var v=addInput.value.trim(); if(!v) return;
    var maxN=tasks.reduce(function(m,t){return Math.max(m,t.n);},0);
    tasks.push({id:"t"+Date.now(),n:maxN+1,text:v,priority:"media",prog:0,note:"",deadline:"",cat:null});
    addInput.value=""; render(); save(); addInput.focus();
  }
  document.getElementById("addBtn").addEventListener("click",addTask);
  addInput.addEventListener("keydown",function(e){ if(e.key==="Enter") addTask(); });

  // Toolbar
  document.getElementById("searchInput").addEventListener("input",function(e){ q=e.target.value.trim().toLowerCase(); render(); });
  document.getElementById("sortSel").addEventListener("change",function(e){ sortMode=e.target.value; render(); });
  document.getElementById("catFilter").addEventListener("change",function(e){ catFilterVal=e.target.value; render(); });
  var toggleBtn=document.getElementById("toggleDone");
  toggleBtn.addEventListener("click",function(){ hideDone=!hideDone; toggleBtn.textContent=hideDone?"Mostrar completadas":"Ocultar completadas"; toggleBtn.classList.toggle("active",hideDone); render(); });
  document.getElementById("reset").addEventListener("click",function(){
    if(confirm("Esto restaura las 37 tareas originales con sus prioridades, y borra avance, fechas, categorías asignadas, notas y tareas agregadas. Las categorías creadas se conservan. ¿Continuar?")){
      tasks=seed(); hideDone=false; q=""; sortMode="num"; catFilterVal="all";
      document.getElementById("searchInput").value=""; document.getElementById("sortSel").value="num";
      toggleBtn.textContent="Ocultar completadas"; toggleBtn.classList.remove("active");
      refreshCatFilter(); render(); save();
    }
  });

  // Categorías
  document.getElementById("catBtn").addEventListener("click",function(){
    var p=document.getElementById("catPanel"); p.hidden=!p.hidden; this.classList.toggle("active",!p.hidden);
  });
  (function buildSwatches(){
    var s=document.getElementById("swatches");
    s.innerHTML=SWATCHES.map(function(c,i){return '<button class="swatch'+(i===0?" sel":"")+'" data-color="'+c+'" style="background:'+c+'" aria-label="Color"></button>';}).join("");
    s.addEventListener("click",function(e){
      var b=e.target.closest(".swatch"); if(!b) return;
      selColor=b.getAttribute("data-color");
      s.querySelectorAll(".swatch").forEach(function(x){x.classList.remove("sel");});
      b.classList.add("sel");
    });
  })();
  function addCat(){
    var input=document.getElementById("newCatName"), name=input.value.trim();
    if(!name){ input.focus(); return; }
    cats.push({id:"c"+Date.now(),name:name,color:selColor});
    input.value=""; saveCats(); renderCatList(); refreshCatFilter(); render();
  }
  document.getElementById("newCatAdd").addEventListener("click",addCat);
  document.getElementById("newCatName").addEventListener("keydown",function(e){ if(e.key==="Enter") addCat(); });
  document.getElementById("catList").addEventListener("click",function(e){
    var b=e.target.closest("[data-catdel]"); if(!b) return;
    var id=b.getAttribute("data-catdel"), c=findCat(id); if(!c) return;
    if(confirm('¿Eliminar la categoría "'+c.name+'"? Las tareas con esta categoría quedarán sin categoría.')){
      cats=cats.filter(function(x){return x.id!==id;});
      tasks.forEach(function(t){ if(t.cat===id) t.cat=null; });
      saveCats(); save(); renderCatList(); refreshCatFilter(); render();
    }
  });

  loadAll(function(){ refreshCatFilter(); renderCatList(); render(); });
})();
</script>
</body>
</html>
`;

export async function GET() {
  return new Response(HTML, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
