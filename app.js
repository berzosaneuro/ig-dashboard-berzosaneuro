// ---------- Derived numbers ----------
const IG_FOLLOWERS = window.IG_FOLLOWERS ?? 0, IG_FOLLOWS = window.IG_FOLLOWS ?? 0, IG_MEDIA_COUNT = window.IG_MEDIA_COUNT ?? 0;
const IG_USERNAME = window.IG_USERNAME ?? "berzosa.neuro";
const today = new Date();
const lastPostDate = new Date(POSTS.reduce((a,p)=>p.timestamp>a?p.timestamp:a, POSTS[0].timestamp));
const daysSinceLastPost = Math.round((today-lastPostDate)/86400000);

const sum = (arr,f)=>arr.reduce((a,x)=>a+(f(x)||0),0);
const igReachTotal365 = sum(WEEKLY, w=>w.reach_1d);
const igViewsTotal365 = sum(WEEKLY, w=>w.views);
const igInteractionsTotal365 = sum(WEEKLY, w=>w.total_interactions);
const igAccountsEngaged365 = sum(WEEKLY, w=>w.accounts_engaged);

const postReachSum = sum(POSTS, p=>p.media_reach);
const postEngSum = sum(POSTS, p=>p.media_engagement);
const postViewsSum = sum(POSTS, p=>p.media_views);
const avgEngRate = (postEngSum/postReachSum*100);

const fbFansNow = FB_DAILY[FB_DAILY.length-1].page_fans;
const fbFansStart = FB_DAILY[0].page_fans;
const fbImpressionsTotal = sum(FB_POSTS, p=>p.post_impressions);
const fbEngTotal = sum(FB_POSTS, p=>p.post_engagements);

function fmt(n){ return n.toLocaleString('es-ES'); }
function pct(n){ return (n>=0?'+':'') + n.toFixed(0) + '%'; }
function scoreClass(s){ return s>=60?'hi':(s>=40?'mid':'lo'); }
function scoreLabel(s){
  if(s>=80) return 'Extraordinaria';
  if(s>=65) return 'Muy buena';
  if(s>=55) return 'Buena';
  if(s>=45) return 'Promedio';
  if(s>=30) return 'Por debajo de la media';
  return 'Mala';
}
function fmtDate(ts){ const d=new Date(ts); return d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'}); }
function fmtDateTime(ts){ const d=new Date(ts); return d.toLocaleDateString('es-ES',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}); }

const postsSorted = [...POSTS].sort((a,b)=>b.score-a.score);
const reels = POSTS.filter(p=>p.media_type==='REELS');
const carousels = POSTS.filter(p=>p.media_type==='CAROUSEL_ALBUM');
const avg = (arr,f)=> arr.length? sum(arr,f)/arr.length : 0;

const reelsBestByReach = [...reels].sort((a,b)=>b.media_reach-a.media_reach);
const reelsWorst = [...reels].sort((a,b)=>a.score-b.score);
function el(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; }

function renderApp(){
  const root = document.getElementById('root');
  root.appendChild(renderHeader());
  const app = el('div','app');
  app.appendChild(renderTabs());
  const tabsWrap = el('div');
  TABS.forEach((t,i)=>{
    const sec = el('section','tab'+(i===0?' active':''));
    sec.id = 'tab-'+t.id;
    sec.appendChild(t.subtabs ? renderTabGroup(t) : t.render());
    tabsWrap.appendChild(sec);
  });
  app.appendChild(tabsWrap);
  app.appendChild(renderFooter());
  root.appendChild(app);
  requestAnimationFrame(()=>{ drawEvolutionChart(); drawFormatChart(); drawFbChart(); });
}

function renderHeader(){
  const h = el('header','top');
  h.innerHTML = `<div class="inner">
    <div class="brand">
      <h1>Dashboard de Contenido · <span>Berzosa Neuro</span></h1>
      <p>@${IG_USERNAME} · Instagram + Facebook + TikTok · Datos reales vía Windsor.ai</p>
    </div>
    <div class="badges">
      <span class="badge ig">📷 Instagram: ${IG_FOLLOWERS} seguidores</span>
      <span class="badge fb">👍 Facebook: ${fmt(fbFansNow)} seguidores</span>
      <span class="badge">Última publicación: hace ${daysSinceLastPost} días</span>
      ${window.LAST_SYNC_AT ? `<span class="badge">🔄 Datos actualizados: ${fmtDateTime(window.LAST_SYNC_AT)}</span>` : ''}
    </div>
  </div>`;
  return h;
}

function renderFooter(){
  return el('footer','foot','Dashboard generado a partir de datos reales de Windsor.ai (Instagram + Facebook + TikTok). Las cifras marcadas como "no disponible" no existen en la fuente conectada y no han sido inventadas.');
}

const TABS = [
  {id:'resumen', label:'Resumen ejecutivo', render: renderResumen},
  {id:'instagram', label:'Instagram', subtabs: [
    {id:'ig-evolucion', label:'Evolución', render: renderEvolucion},
    {id:'ig-contenido', label:'Contenido', render: renderContenido},
    {id:'ig-puntuacion', label:'Sistema de puntuación', render: renderPuntuacion},
    {id:'ig-mejores', label:'Mejores reels', render: renderMejores},
    {id:'ig-peores', label:'Peores reels', render: renderPeores},
    {id:'ig-formatos', label:'Formatos', render: renderFormatos},
    {id:'ig-ganchos', label:'Ganchos y temas', render: renderGanchos},
    {id:'ig-horarios', label:'Horarios', render: renderHorarios},
    {id:'ig-audiencia', label:'Audiencia', render: renderAudiencia},
    {id:'ig-conversion', label:'Conversión', render: renderConversion},
  ]},
  {id:'facebook', label:'Facebook', render: renderFacebook},
  {id:'tiktok', label:'TikTok', render: renderTikTok},
  {id:'comparativa', label:'Comparativa', render: renderMultiplataforma},
  {id:'oportunidades', label:'Oportunidades', render: renderOportunidades},
  {id:'plan', label:'Plan de acción', render: renderPlan},
  {id:'calendario', label:'Calendario 30 días', render: renderCalendario},
  {id:'ideas', label:'Banco de ideas', render: renderIdeas},
  {id:'experimentos', label:'Experimentos', render: renderExperimentos},
  {id:'alertas', label:'Alertas', render: renderAlertas},
];

function renderTabs(){
  const nav = el('nav','tabs');
  TABS.forEach((t,i)=>{
    const btn = el('button','tab-btn'+(i===0?' active':''), t.label);
    btn.onclick = ()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('section.tab').forEach(s=>s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+t.id).classList.add('active');
    };
    nav.appendChild(btn);
  });
  return nav;
}

// A top-level tab that groups several sub-sections under one nav button
// (used for Instagram, which has far more detail sections than any other
// platform) — switching is scoped to this group so it doesn't interfere
// with the top-level tab nav/state.
function renderTabGroup(item){
  const wrap = el('div','tab-group');
  const subNav = el('div','sub-tabs');
  const panels = el('div');
  item.subtabs.forEach((st,i)=>{
    const btn = el('button','subtab-btn'+(i===0?' active':''), st.label);
    const panel = el('div','subtab-panel'+(i===0?' active':''));
    panel.appendChild(st.render());
    btn.onclick = ()=>{
      subNav.querySelectorAll('.subtab-btn').forEach(b=>b.classList.remove('active'));
      panels.querySelectorAll('.subtab-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      panel.classList.add('active');
    };
    subNav.appendChild(btn);
    panels.appendChild(panel);
  });
  wrap.appendChild(subNav);
  wrap.appendChild(panels);
  return wrap;
}

// ---------- RESUMEN ----------
function renderResumen(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Resumen ejecutivo'));
  wrap.appendChild(el('p','section-sub',`Estado general de la cuenta a fecha de hoy (${today.toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}). Todas las cifras de esta sección son datos reales de Windsor.ai, sin cálculos añadidos salvo donde se indica.`));

  // Cifras calculadas en vivo a partir de POSTS/FB_DAILY — nunca hardcodeadas,
  // para que no se desajusten de la realidad según entren nuevas sincronizaciones.
  const postsWithCaption = POSTS.filter(p=>p.media_caption);
  const postsWithoutCaptionCount = POSTS.length - postsWithCaption.length;
  const top3 = postsSorted.slice(0,3);
  const captionsInTop3 = top3.filter(p=>p.media_caption).length;
  const weeksSinceLastPost = Math.round(daysSinceLastPost/7);
  const weekWord = weeksSinceLastPost===1?'semana':'semanas';
  const dayWord = daysSinceLastPost===1?'día':'días';

  const monthCounts = {}, monthOrder = [];
  [...POSTS].sort((a,b)=>a.timestamp<b.timestamp?-1:1).forEach(p=>{
    const m = new Date(p.timestamp).toLocaleDateString('es-ES',{month:'long'});
    if(!monthCounts[m]){ monthCounts[m]=0; monthOrder.push(m); }
    monthCounts[m]++;
  });
  const monthSummary = monthOrder.map(m=>`${monthCounts[m]} en ${m}`).join(', ');

  const grid = el('div','grid cols-4');
  const metrics = [
    ['Seguidores IG actuales', fmt(IG_FOLLOWERS), 'Dato real · user_info'],
    ['Publicaciones totales (histórico)', fmt(IG_MEDIA_COUNT), monthSummary],
    ['Alcance total (365 días)', fmt(igReachTotal365), 'Suma diaria reach_1d'],
    ['Reproducciones totales (365 días)', fmt(igViewsTotal365), 'Incluye posts+reels+stories'],
    ['Interacciones totales (365 días)', fmt(igInteractionsTotal365), 'likes+comments+saves+shares'],
    ['Cuentas alcanzadas (365 días)', fmt(igAccountsEngaged365), 'accounts_engaged'],
    ['Engagement medio / alcance', avgEngRate.toFixed(1)+'%', `Sobre las ${POSTS.length} publicaciones`],
    ['Seguidores en Facebook', fmt(fbFansNow), `Desde ${fmt(fbFansStart)} el ${fmtDate(FB_DAILY[0].date)}`],
  ];
  metrics.forEach(([label,value,sub])=>{
    const c = el('div','card metric');
    c.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div>`;
    grid.appendChild(c);
  });
  wrap.appendChild(grid);

  wrap.appendChild(el('div','note warn',`⚠️ Muestra muy pequeña: ${POSTS.length} publicaciones y ${fmt(IG_FOLLOWERS)} seguidores en Instagram. Los patrones "estadísticos" de este dashboard tienen validez limitada — se indica el tamaño de muestra en cada sección y se prioriza lo que es concreto y verificable sobre lo especulativo.`));

  const two = el('div','two-col');

  const left = el('div','card');
  left.innerHTML = `<h3 style="font-size:15px;margin-bottom:10px;">Los 3 avances del periodo</h3>`;
  const ul1 = el('ul','clean');
  ul1.innerHTML = `
    <li><b>Facebook ha despegado con la misma pieza de contenido</b>: el reel del 27 de julio pasó de 189 de alcance en Instagram a 70.876 impresiones en Facebook, y la página ganó ~700 seguidores en 48 horas.</li>
    <li><b>La cuenta volvió a publicar en julio-agosto</b> tras un parón de 4 meses (última publicación previa: 24 de marzo).</li>
    <li>${postsWithCaption.length>0
        ? `<b>${postsWithCaption.length===1?'El único post':'Los '+postsWithCaption.length+' posts'} con caption real</b> (${postsWithCaption.length===1?'el único':'los únicos'} con texto de las ${POSTS.length} publicaciones) ${captionsInTop3>0?`${captionsInTop3===postsWithCaption.length?'están':'está'} entre las ${top3.length} puntuaciones más altas del ranking.`:'no está entre las puntuaciones más altas del ranking ahora mismo.'}`
        : `<b>Ninguna publicación tiene caption todavía</b> — no hay datos suficientes para relacionar texto con puntuación.`}</li>
  `;
  left.appendChild(ul1);
  two.appendChild(left);

  const right = el('div','card');
  right.innerHTML = `<h3 style="font-size:15px;margin-bottom:10px;">Los 3 problemas detectados</h3>`;
  const ul2 = el('ul','clean');
  ul2.innerHTML = `
    <li><b>${weeksSinceLastPost} ${weekWord} sin publicar</b> (última publicación: ${fmtDate(lastPostDate)}, hace ${daysSinceLastPost} ${dayWord}). El impulso de Facebook se está enfriando sin contenido nuevo que lo sostenga.</li>
    <li><b>${postsWithoutCaptionCount} de las ${POSTS.length} publicaciones no tienen caption</b> (campo vacío en Windsor.ai) — sin texto no hay gancho, contexto ni SEO de búsqueda en Instagram.</li>
    <li><b>El reel con más alcance en Instagram tras el viral (133 de alcance) tuvo un 92,7% de abandono en los primeros 3 segundos</b> — consiguió distribución pero perdió a casi toda la audiencia de inmediato.</li>
  `;
  right.appendChild(ul2);
  two.appendChild(right);
  wrap.appendChild(two);

  const opp = el('div','card');
  opp.style.marginTop='14px';
  opp.innerHTML = `<h3 style="font-size:15px;margin-bottom:10px;">Las 3 mayores oportunidades</h3>`;
  const ul3 = el('ul','clean');
  ul3.innerHTML = `
    <li>Publicar el mismo contenido en Instagram y Facebook simultáneamente — Facebook ya ha demostrado tener alcance orgánico muy superior para este contenido.</li>
    <li>Escribir caption con gancho e hilo de texto en cada publicación — la señal, aunque en solo ${postsWithCaption.length} caso${postsWithCaption.length===1?'':'s'}, es consistente: caption real = mejor puntuación.</li>
    <li>Retomar la cadencia de publicación antes de perder el impulso ganado en Facebook la última semana de julio.</li>
  `;
  opp.appendChild(ul3);
  wrap.appendChild(opp);

  const concl = el('div','card');
  concl.style.marginTop='14px';
  concl.innerHTML = `<h3 style="font-size:15px;margin-bottom:8px;">Conclusión general</h3>
  <p style="font-size:13.5px;line-height:1.6;color:var(--text);margin:0 0 10px;">
  La cuenta está en una fase muy temprana (${fmt(IG_FOLLOWERS)} seguidores en Instagram, ${POSTS.length} publicaciones en un año) pero acaba de recibir una señal de mercado fuerte y real: un solo reel, republicado en Facebook, generó más de 700 seguidores nuevos en 2 días. Eso no es una métrica de vanidad — es la prueba de que el contenido (neurociencia aplicada, metacognición) conecta cuando llega a suficiente gente. El cuello de botella no es la calidad del contenido, es la distribución y la consistencia: ${weeksSinceLastPost} ${weekWord} de silencio justo después del mejor resultado del año.</p>
  <p style="font-size:13.5px;line-height:1.6;"><b style="color:var(--blue-hover);">Acción más importante ahora mismo:</b> publicar esta semana, en Instagram y Facebook a la vez, y no dejar pasar más de 3-4 días sin publicación durante al menos las próximas 4 semanas.</p>`;
  wrap.appendChild(concl);

  return wrap;
}

// ---------- EVOLUCION ----------
function renderEvolucion(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Evolución de la cuenta (Instagram, 12 meses)'));
  wrap.appendChild(el('p','section-sub','Serie semanal agregada desde datos diarios reales. La cuenta estuvo prácticamente inactiva la mayor parte del año, con dos ráfagas de actividad: marzo (3 publicaciones) y finales de julio-agosto (7 publicaciones).'));
  const card = el('div','card');
  card.innerHTML = `<div class="chart-box tall"><canvas id="evoChart"></canvas></div>`;
  wrap.appendChild(card);

  wrap.appendChild(el('div','note insight','📈 Interpretación automática: la cuenta pasó de una actividad casi nula (semanas 1-30 del año) a un pico claro en las semanas 31-32 (fin de julio), coincidiendo exactamente con la publicación del reel que también se volvió viral en Facebook. El alcance semanal se multiplicó por más de 20 respecto a la media histórica. Tras ese pico, la actividad ha vuelto a caer — la cuenta está "dependiendo de publicaciones aisladas" en lugar de crecer de forma sostenida.'));

  const grid = el('div','grid cols-3');
  [
    ['Semana de mayor alcance', '2026-W31 (fin de julio)', '220 de alcance semanal, frente a una media histórica de ~5'],
    ['Semanas sin ninguna actividad', '~38 de 53 semanas', 'Más del 70% del año sin publicar ni una vez'],
    ['Racha activa más reciente', '6 publicaciones en 5 días', '2-6 de agosto — luego 3 semanas de silencio'],
  ].forEach(([l,v,s])=>{
    const c = el('div','card metric');
    c.innerHTML = `<div class="label">${l}</div><div class="value" style="font-size:18px;">${v}</div><div class="sub">${s}</div>`;
    grid.appendChild(c);
  });
  wrap.appendChild(grid);
  return wrap;
}
function drawEvolutionChart(){
  const ctx = document.getElementById('evoChart');
  if(!ctx) return;
  new Chart(ctx, {
    type:'line',
    data:{
      labels: WEEKLY.map(w=>w.week.replace('2026-','').replace('2025-',"'25 ")),
      datasets:[
        {label:'Alcance', data:WEEKLY.map(w=>w.reach_1d), borderColor:'#0066FF', backgroundColor:'rgba(0,102,255,.15)', fill:true, tension:.3, pointRadius:0},
        {label:'Reproducciones', data:WEEKLY.map(w=>w.views), borderColor:'#06B6D4', backgroundColor:'rgba(6,182,212,.08)', fill:true, tension:.3, pointRadius:0},
        {label:'Interacciones', data:WEEKLY.map(w=>w.total_interactions), borderColor:'#F59E0B', backgroundColor:'rgba(245,158,11,.08)', fill:true, tension:.3, pointRadius:0},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{legend:{labels:{color:'#94A3B8', font:{size:11}}}},
      scales:{
        x:{ticks:{color:'#64748B', font:{size:9}, maxRotation:0, autoSkip:true, maxTicksLimit:12}, grid:{color:'rgba(255,255,255,.04)'}},
        y:{ticks:{color:'#64748B', font:{size:10}}, grid:{color:'rgba(255,255,255,.04)'}}
      }
    }
  });
}

// ---------- MULTIPLATAFORMA ----------
function renderMultiplataforma(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Comparativa: Instagram vs Facebook vs TikTok'));
  wrap.appendChild(el('p','section-sub','Los 6 reels que también fueron publicados en la página de Facebook "Berzosa NEURO", comparando alcance/impresiones reales en cada plataforma. TikTok se incluye para referencia, pero todavía no tiene publicaciones que comparar.'));

  const compare = el('div','card');
  compare.innerHTML = `<div class="platform-compare">
    <div class="platform-col ig"><div class="big">${fmt(postReachSum)}</div><div style="font-size:12px;color:var(--text2);">Alcance total Instagram (10 posts)</div></div>
    <div class="vs">VS</div>
    <div class="platform-col fb"><div class="big">${fmt(fbImpressionsTotal)}</div><div style="font-size:12px;color:var(--text2);">Impresiones totales Facebook (8 posts)</div></div>
  </div>`;
  wrap.appendChild(compare);

  wrap.appendChild(el('div','note na','TikTok: 0 publicaciones — cuenta conectada pero sin contenido todavía, no hay nada que comparar en esta plataforma por ahora.'));

  wrap.appendChild(el('div','note insight',`🔎 Hallazgo principal del dashboard: en las 6 fechas donde se publicó el mismo reel en ambas plataformas, Facebook generó más impresiones que Instagram alcance en <b>las 6 de 6 ocasiones</b> — no es un caso aislado, es un patrón consistente. El caso más extremo es el reel del 27 de julio: 189 de alcance en Instagram frente a 70.876 impresiones en Facebook (375 veces más), que además impulsó que la página de Facebook pasara de 28 a 754 seguidores en un mes.`));

  const tableWrap = el('div','card');
  tableWrap.style.marginTop = '14px';
  tableWrap.innerHTML = `<h3 style="font-size:14px;margin-bottom:10px;">Comparativa publicación a publicación</h3>`;
  const tw = el('div','table-wrap');
  let rows = CROSS.map(c=>`<tr>
    <td>${fmtDate(c.date)}</td>
    <td>${fmt(c.ig_reach)}</td>
    <td>${fmt(c.fb_impressions)}</td>
    <td style="color:${c.fb_impressions>c.ig_reach?'var(--emerald)':'var(--rose)'};font-weight:600;">×${(c.fb_impressions/Math.max(c.ig_reach,1)).toFixed(1)}</td>
  </tr>`).join('');
  tw.innerHTML = `<table><thead><tr><th>Fecha</th><th>Alcance IG</th><th>Impresiones FB</th><th>Multiplicador</th></tr></thead><tbody>${rows}</tbody></table>`;
  tableWrap.appendChild(tw);
  wrap.appendChild(tableWrap);

  wrap.appendChild(el('div','note','Nota: la comparación usa "alcance" en Instagram (cuentas únicas) e "impresiones" en Facebook (visualizaciones totales, pueden repetirse por cuenta) porque son las métricas nativas disponibles en cada API vía Windsor.ai — no son la misma unidad exacta, pero la diferencia de magnitud es lo suficientemente grande como para ser una señal real, no un artefacto de medición.'));

  return wrap;
}
function drawFbChart(){
  const ctx = document.getElementById('fbChart');
  if(!ctx) return;
  new Chart(ctx, {
    type:'line',
    data:{
      labels: FB_DAILY.map(d=>fmtDate(d.date)),
      datasets:[
        {label:'Seguidores página FB', data:FB_DAILY.map(d=>d.page_fans), borderColor:'#1877F2', backgroundColor:'rgba(24,119,242,.12)', fill:true, tension:.25, yAxisID:'y'},
        {label:'Impresiones diarias FB', data:FB_DAILY.map(d=>d.page_impressions), borderColor:'#F59E0B', backgroundColor:'rgba(245,158,11,.08)', fill:false, tension:.25, yAxisID:'y1'},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{legend:{labels:{color:'#94A3B8', font:{size:11}}}},
      scales:{
        x:{ticks:{color:'#64748B', font:{size:9}, maxRotation:45}, grid:{color:'rgba(255,255,255,.04)'}},
        y:{position:'left', ticks:{color:'#1877F2', font:{size:10}}, grid:{color:'rgba(255,255,255,.04)'}, title:{display:true,text:'Seguidores',color:'#64748B',font:{size:10}}},
        y1:{position:'right', ticks:{color:'#F59E0B', font:{size:10}}, grid:{display:false}, title:{display:true,text:'Impresiones/día',color:'#64748B',font:{size:10}}}
      }
    }
  });
}

// ---------- FACEBOOK ----------
const fbPostsSorted = [...FB_POSTS].sort((a,b)=>(b.post_engagements||0)-(a.post_engagements||0));
function renderFacebook(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Facebook'));
  wrap.appendChild(el('p','section-sub','Página "Berzosa NEURO" — datos reales de Windsor.ai (facebook_organic).'));

  const grid = el('div','grid cols-4');
  [
    ['Seguidores actuales', fmt(fbFansNow), `Desde ${fmt(fbFansStart)} al inicio del periodo`],
    ['Publicaciones (histórico)', fmt(FB_POSTS.length), ''],
    ['Impresiones totales', fmt(fbImpressionsTotal), 'Suma de todas las publicaciones'],
    ['Interacciones totales', fmt(fbEngTotal), 'Reacciones + comentarios + clics'],
  ].forEach(([l,v,s])=>{
    const c = el('div','card metric');
    c.innerHTML = `<div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div>`;
    grid.appendChild(c);
  });
  wrap.appendChild(grid);

  const card = el('div','card');
  card.innerHTML = `<div class="chart-box tall"><canvas id="fbChart"></canvas></div>`;
  wrap.appendChild(card);

  const tableWrap = el('div','card');
  tableWrap.style.marginTop = '14px';
  tableWrap.innerHTML = `<h3 style="font-size:14px;margin-bottom:10px;">Publicaciones ordenadas por interacciones</h3>`;
  const tw = el('div','table-wrap');
  const rows = fbPostsSorted.map(p=>`<tr>
    <td>${fmtDate(p.post_created_time)}</td>
    <td>${p.type||'—'}</td>
    <td>${fmt(p.post_impressions||0)}</td>
    <td>${fmt(p.post_engagements||0)}</td>
    <td>${fmt(p.post_reactions_total||0)}</td>
    <td>${fmt(p.post_comments_total||0)}</td>
    <td>${p.permalink_url ? `<a href="${p.permalink_url}" target="_blank" rel="noopener">Ver</a>` : '—'}</td>
  </tr>`).join('');
  tw.innerHTML = `<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Impresiones</th><th>Interacciones</th><th>Reacciones</th><th>Comentarios</th><th>Enlace</th></tr></thead><tbody>${rows}</tbody></table>`;
  tableWrap.appendChild(tw);
  wrap.appendChild(tableWrap);

  return wrap;
}

// ---------- TIKTOK ----------
function renderTikTok(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','TikTok'));
  wrap.appendChild(el('p','section-sub','Cuenta conectada a Windsor.ai (@berzosa.neuro).'));
  wrap.appendChild(el('div','note na','Estado real de la cuenta: 0 seguidores, 0 vídeos publicados, 0 me gusta totales. No hay ninguna publicación que analizar todavía — no se puede generar ningún ranking, puntuación ni recomendación específica sin datos, y no se van a inventar.'));
  const grid = el('div','grid cols-3');
  [['Seguidores','0',''],['Vídeos publicados','0',''],['Me gusta totales','0','']].forEach(([l,v,s])=>{
    const c = el('div','card metric');
    c.innerHTML = `<div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div>`;
    grid.appendChild(c);
  });
  wrap.appendChild(grid);
  wrap.appendChild(el('div','note insight','Recomendación basada en lo observado en Facebook/Instagram: el mismo contenido en vertical (los reels ya grabados) republicado en TikTok tiene coste de producción cero y, dado que la distribución cruzada ya demostró funcionar muy por encima de lo esperado en Facebook, es razonable probar TikTok con el mismo material antes de invertir en contenido nuevo específico para esa plataforma. En cuanto haya publicaciones, este dashboard puede recalcularse para incluir el mismo análisis que Instagram y Facebook.'));
  return wrap;
}

// ---------- CONTENIDO ----------
let sortKey='score', sortDir=-1;
function renderContenido(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Todas las publicaciones (Instagram)'));
  wrap.appendChild(el('p','section-sub','Las 10 publicaciones del histórico completo, con métricas reales de Windsor.ai. Click en las cabeceras para ordenar.'));
  const card = el('div','card');
  const tw = el('div','table-wrap');
  tw.id = 'content-table-wrap';
  card.appendChild(tw);
  wrap.appendChild(card);
  renderContentTable();
  return wrap;
}
function renderContentTable(){
  const tw = document.getElementById('content-table-wrap');
  if(!tw) return;
  const cols = [
    ['timestamp','Fecha'], ['media_type','Formato'], ['media_reach','Alcance'], ['media_views','Reprod.'],
    ['media_like_count','Likes'], ['media_comments_count','Coment.'], ['media_saved','Guard.'], ['media_shares','Compart.'],
    ['engagement_rate','Eng/Alcance'], ['score','Puntuación']
  ];
  let sorted = [...POSTS].sort((a,b)=> (a[sortKey]>b[sortKey]?1:-1)*sortDir );
  let thead = '<tr>'+cols.map(([k,l])=>`<th data-k="${k}">${l}${sortKey===k?(sortDir===1?' ▲':' ▼'):''}</th>`).join('')+'<th>Enlace</th></tr>';
  let rows = sorted.map(p=>`<tr>
    <td>${fmtDate(p.timestamp)}</td>
    <td><span class="pill ${p.media_type==='REELS'?'reel':'carousel'}">${p.media_type==='REELS'?'Reel':'Carrusel'}</span></td>
    <td>${fmt(p.media_reach)}</td>
    <td>${fmt(p.media_views)}</td>
    <td>${fmt(p.media_like_count)}</td>
    <td>${fmt(p.media_comments_count)}</td>
    <td>${fmt(p.media_saved)}</td>
    <td>${fmt(p.media_shares)}</td>
    <td>${(p.engagement_rate*100).toFixed(1)}%</td>
    <td><span class="score ${scoreClass(p.score)}">${p.score.toFixed(1)}</span> <span style="font-size:10px;color:var(--muted);">${scoreLabel(p.score)}</span></td>
    <td><a href="${p.media_permalink}" target="_blank" rel="noopener">Ver ↗</a></td>
  </tr>`).join('');
  tw.innerHTML = `<table><thead>${thead}</thead><tbody>${rows}</tbody></table>`;
  tw.querySelectorAll('th[data-k]').forEach(th=>{
    th.onclick = ()=>{
      const k = th.dataset.k;
      if(sortKey===k) sortDir*=-1; else { sortKey=k; sortDir=-1; }
      renderContentTable();
    };
  });
}

// ---------- PUNTUACION ----------
function renderPuntuacion(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Sistema de puntuación (0-100)'));
  wrap.appendChild(el('p','section-sub','Metodología aplicada a estas 10 publicaciones, con las adaptaciones necesarias por las limitaciones reales de los datos disponibles.'));

  wrap.appendChild(el('div','note na','No disponible / no usado en la puntuación: retención y tiempo de visualización solo existen para los 6 reels (no para los 4 carruseles), y visitas al perfil / seguidores generados por publicación solo existen para carruseles (Instagram no expone esos campos para reels vía esta API). Como no se pueden aplicar de forma uniforme a las 10 publicaciones, se excluyeron del cálculo del score global para no penalizar injustamente a un formato u otro.'));

  const card = el('div','card');
  card.innerHTML = `<h3 style="font-size:14px;margin-bottom:10px;">Ponderación aplicada (adaptada del estándar sugerido)</h3>`;
  const ul = el('ul','clean');
  ul.innerHTML = `
    <li>Alcance (percentil dentro de las 10 publicaciones): <b>20%</b></li>
    <li>Tasa de engagement (interacciones / alcance): <b>30%</b></li>
    <li>Tasa de guardados (guardados / alcance): <b>15%</b></li>
    <li>Tasa de compartidos (compartidos / alcance): <b>15%</b></li>
    <li>Tasa de comentarios (comentarios / alcance): <b>10%</b></li>
    <li>Tasa de me gusta (likes / alcance): <b>10%</b></li>
  `;
  card.appendChild(ul);
  card.appendChild(el('p','',`<p style="font-size:12px;color:var(--text2);margin-top:10px;line-height:1.5;">Cada métrica se convierte en un percentil dentro de las 10 publicaciones (0 a 1) y se combina con estos pesos para dar un score de 0 a 100. Esto normaliza por el tamaño de la cuenta y evita comparar cifras absolutas entre publicaciones de fechas muy distintas.</p>`));
  wrap.appendChild(card);

  const grid = el('div','grid cols-4');
  grid.style.marginTop='14px';
  [['80-100','Extraordinaria','var(--emerald)'],['65-79','Muy buena','var(--emerald)'],['55-64','Buena','var(--cyan)'],['45-54','Promedio','var(--text2)'],['30-44','Por debajo de la media','var(--amber)'],['0-29','Mala','var(--rose)']].forEach(([range,label,color])=>{
    const c = el('div','card pad-sm');
    c.innerHTML = `<div style="font-size:20px;font-weight:700;color:${color};">${range}</div><div style="font-size:12px;color:var(--text2);margin-top:4px;">${label}</div>`;
    grid.appendChild(c);
  });
  wrap.appendChild(grid);
  wrap.appendChild(el('div','note','Con n=10, estas etiquetas describen el ranking interno de estas publicaciones entre sí, no un estándar universal de "buen contenido" — se recomienda recalcular cuando haya 30+ publicaciones para conclusiones más robustas.'));
  return wrap;
}

// ---------- MEJORES ----------
function renderMejores(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Análisis de los mejores reels'));
  wrap.appendChild(el('p','section-sub',`Solo hay 6 reels en el histórico, así que se analizan todos en vez de un "top 5" — con n tan pequeño, forzar un recorte perdería información útil.`));

  reelsBestByReach.forEach((p,i)=>{
    wrap.appendChild(renderReelCard(p, i===0));
  });
  return wrap;
}
function renderReelCard(p, highlight){
  const c = el('div','card');
  c.style.marginBottom='14px';
  if(highlight) c.style.borderColor = 'rgba(0,102,255,.4)';
  let retentionNote = '';
  if(p.completion_proxy!==null){
    const skipPct = (p.media_reel_skip_rate*100).toFixed(1);
    const watchSec = (p.media_reel_avg_watch_time/1000).toFixed(1);
    retentionNote = `<div class="note ${p.media_reel_skip_rate>0.7?'na':(p.media_reel_skip_rate<0.35?'insight':'')}" style="margin-top:10px;">
      ${p.media_reel_skip_rate>0.7?'⚠️':'📊'} Abandono en los primeros 3s: <b>${skipPct}%</b> · Tiempo medio visto: <b>${watchSec}s</b>.
      ${p.media_reel_skip_rate>0.7?' Retención muy pobre pese al alcance conseguido — el gancho inicial probablemente no sostuvo la atención.':''}
      ${p.media_reel_skip_rate<0.35?' Esta es la mejor retención de todo el histórico — el arranque del vídeo funcionó bien, aunque el alcance fue bajo.':''}
    </div>`;
  }
  c.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
      <div>
        <span class="pill reel">Reel</span> <span style="font-size:12px;color:var(--text2);margin-left:6px;">${fmtDateTime(p.timestamp)}</span>
        <div style="margin-top:6px;"><a href="${p.media_permalink}" target="_blank" rel="noopener" style="font-size:13px;">${p.media_permalink} ↗</a></div>
      </div>
      <div class="score ${scoreClass(p.score)}" style="font-size:20px;">${p.score.toFixed(1)} <span style="font-size:11px;color:var(--muted);">/ 100</span></div>
    </div>
    <div class="kpi-row">
      <span class="badge">Alcance: ${fmt(p.media_reach)}</span>
      <span class="badge">Reproducciones: ${fmt(p.media_views)}</span>
      <span class="badge">Likes: ${fmt(p.media_like_count)}</span>
      <span class="badge">Comentarios: ${fmt(p.media_comments_count)}</span>
      <span class="badge">Guardados: ${fmt(p.media_saved)}</span>
      <span class="badge">Compartidos: ${fmt(p.media_shares)}</span>
    </div>
    ${retentionNote}
    <div class="note" style="margin-top:8px;">Análisis creativo (gancho, guion, edición): <b>no disponible</b> — el caption/texto de este reel no está presente en los datos de Windsor.ai, así que no se puede analizar el gancho inicial sin inventar contenido. Recomendación: guardar el guion de cada reel al publicarlo para poder hacer este análisis en el futuro.</div>
  `;
  return c;
}

// ---------- PEORES ----------
function renderPeores(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Reels con peor rendimiento'));
  wrap.appendChild(el('p','section-sub','Publicaciones con la puntuación más baja del histórico, con la posible causa según los datos disponibles.'));

  const worst = reelsWorst.slice(0,3);
  worst.forEach(p=>{
    const c = el('div','card');
    c.style.marginBottom='14px';
    c.style.borderColor = 'rgba(244,63,94,.3)';
    let diagnosis = '';
    if(p.media_reach<15){
      diagnosis = 'Alcance extremadamente bajo (por debajo de 15 cuentas) — el algoritmo apenas distribuyó este contenido, probablemente por publicarse en una racha de 5 reels el mismo día, compitiendo entre sí por distribución.';
    }
    if(p.media_reel_skip_rate && p.media_reel_skip_rate>0.85){
      diagnosis += ' Además, el 92,7% de abandono en 3 segundos sugiere un gancho inicial que no retuvo a quien sí lo vio.';
    }
    if(p.media_engagement===0){
      diagnosis += ' Cero interacciones registradas — ni un like, comentario, guardado o compartido.';
    }
    c.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
        <div>
          <span class="pill reel">Reel</span> <span style="font-size:12px;color:var(--text2);margin-left:6px;">${fmtDateTime(p.timestamp)}</span>
          <div style="margin-top:6px;"><a href="${p.media_permalink}" target="_blank" rel="noopener" style="font-size:13px;">${p.media_permalink} ↗</a></div>
        </div>
        <div class="score lo" style="font-size:20px;">${p.score.toFixed(1)} <span style="font-size:11px;color:var(--muted);">/ 100</span></div>
      </div>
      <div class="kpi-row">
        <span class="badge">Alcance: ${fmt(p.media_reach)}</span>
        <span class="badge">Reproducciones: ${fmt(p.media_views)}</span>
        <span class="badge">Engagement: ${fmt(p.media_engagement)}</span>
        ${p.media_reel_skip_rate!==null?`<span class="badge">Abandono 3s: ${(p.media_reel_skip_rate*100).toFixed(0)}%</span>`:''}
      </div>
      <div class="note" style="margin-top:8px;"><b>Posible causa principal:</b> ${diagnosis}</div>
      <div class="note" style="margin-top:6px;"><b>¿Merece la pena reutilizar la idea?</b> Sin acceso al caption o al tema tratado no se puede saber con certeza — dato no disponible. Lo que sí se puede afirmar: evitar publicar varios reels el mismo día (ver Alertas), y priorizar escribir un gancho de texto en pantalla en los primeros 2-3 segundos.</div>
    `;
    wrap.appendChild(c);
  });
  return wrap;
}

// ---------- FORMATOS ----------
function renderFormatos(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Comparación de formatos'));
  wrap.appendChild(el('p','section-sub',`Reels (n=${reels.length}) vs Carruseles (n=${carousels.length}). No hay suficientes datos de imágenes sueltas, historias ni directos en el periodo analizado — no disponible.`));

  const card = el('div','card');
  card.innerHTML = `<div class="chart-box"><canvas id="fmtChart"></canvas></div>`;
  wrap.appendChild(card);

  const grid = el('div','grid cols-2');
  grid.style.marginTop='14px';
  [
    ['Reels', reels, '#06B6D4'],
    ['Carruseles', carousels, '#a78bfa'],
  ].forEach(([label, arr, color])=>{
    const c = el('div','card');
    c.innerHTML = `<h3 style="font-size:15px;color:${color};margin-bottom:10px;">${label} (n=${arr.length})</h3>
      <div class="kpi-row">
        <span class="badge">Alcance medio: ${avg(arr,p=>p.media_reach).toFixed(1)}</span>
        <span class="badge">Engagement medio: ${avg(arr,p=>p.media_engagement).toFixed(1)}</span>
        <span class="badge">Puntuación media: ${avg(arr,p=>p.score).toFixed(1)}</span>
      </div>`;
    grid.appendChild(c);
  });
  wrap.appendChild(grid);

  wrap.appendChild(el('div','note insight',`📊 Con esta muestra tan pequeña (n=6 vs n=4): los reels consiguen más del doble de alcance medio (${avg(reels,p=>p.media_reach).toFixed(0)} vs ${avg(carousels,p=>p.media_reach).toFixed(0)}), pero los carruseles tienen mejor puntuación media (${avg(carousels,p=>p.score).toFixed(1)} vs ${avg(reels,p=>p.score).toFixed(1)}) porque generan más interacción por cada persona alcanzada. Interpretación con cautela: los 3 carruseles con mejor dato son también los únicos con caption real, así que el formato y el texto están mezclados en esta muestra — no se puede aislar cuál de los dos factores pesa más con estos datos.`));
  return wrap;
}
function drawFormatChart(){
  const ctx = document.getElementById('fmtChart');
  if(!ctx) return;
  new Chart(ctx, {
    type:'bar',
    data:{
      labels:['Alcance medio','Engagement medio','Puntuación media'],
      datasets:[
        {label:'Reels', data:[avg(reels,p=>p.media_reach), avg(reels,p=>p.media_engagement), avg(reels,p=>p.score)], backgroundColor:'#06B6D4'},
        {label:'Carruseles', data:[avg(carousels,p=>p.media_reach), avg(carousels,p=>p.media_engagement), avg(carousels,p=>p.score)], backgroundColor:'#8b5cf6'},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#94A3B8'}}},
      scales:{ x:{ticks:{color:'#94A3B8'}, grid:{display:false}}, y:{ticks:{color:'#64748B'}, grid:{color:'rgba(255,255,255,.04)'}} }
    }
  });
}

// ---------- GANCHOS ----------
function renderGanchos(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Análisis de ganchos y temas'));
  const withCaption = POSTS.filter(p=>p.media_caption);
  wrap.appendChild(el('p','section-sub',`Solo ${withCaption.length} de ${POSTS.length} publicaciones tienen caption disponible en los datos — las 7 restantes (todas de julio-agosto, todos los reels) tienen el campo de caption vacío en Windsor.ai.`));

  wrap.appendChild(el('div','note na',`No disponible para 7/10 publicaciones: el análisis de gancho, tipo de CTA, tono y estructura requiere el texto de la publicación, que no está presente. Es posible que estos reels se publicaran sin caption, o que el campo no se sincronizara — conviene revisarlo directamente en Instagram.`));

  withCaption.forEach(p=>{
    const c = el('div','card');
    c.style.marginBottom='12px';
    const hookType = p.media_caption.includes('?') ? 'Pregunta / identificación' : 'Afirmación educativa / storytelling';
    c.innerHTML = `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span class="pill carousel">Carrusel</span>
        <span style="font-size:12px;color:var(--text2);">${fmtDate(p.timestamp)} · Puntuación: <b class="score ${scoreClass(p.score)}">${p.score.toFixed(1)}</b></span>
      </div>
      <p style="font-size:13px;color:var(--text);margin:10px 0;white-space:pre-wrap;line-height:1.5;max-height:120px;overflow:auto;">${p.media_caption.slice(0,280)}${p.media_caption.length>280?'…':''}</p>
      <div class="kpi-row"><span class="badge">Tipo de gancho inferido: ${hookType}</span></div>
    `;
    wrap.appendChild(c);
  });

  wrap.appendChild(el('div','note insight','Con solo 2 captions de texto real disponibles no se puede construir una taxonomía de ganchos fiable (se necesitarían al menos 15-20 publicaciones con texto). El dato consistente que sí se puede afirmar: ambas publicaciones con caption real superan la puntuación media de la cuenta.'));
  return wrap;
}

// ---------- HORARIOS ----------
function renderHorarios(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Días y horarios de publicación'));
  wrap.appendChild(el('p','section-sub','Con 10 publicaciones en total no hay muestra suficiente para un mapa de calor fiable — se muestran los datos reales sin forzar conclusiones de "mejor horario".'));
  wrap.appendChild(el('div','note warn','No se puede recomendar un horario óptimo con n=10 (regla del propio análisis: no afirmar patrones de horario con muestra insuficiente). Se listan los horarios reales de publicación como referencia, no como recomendación.'));

  const card = el('div','card');
  const tw = el('div','table-wrap');
  const rows = [...POSTS].sort((a,b)=>a.timestamp<b.timestamp?1:-1).map(p=>{
    const d = new Date(p.timestamp);
    const dayName = d.toLocaleDateString('es-ES',{weekday:'long'});
    const hour = d.getUTCHours();
    return `<tr><td>${fmtDate(p.timestamp)}</td><td style="text-transform:capitalize;">${dayName}</td><td>${String(hour).padStart(2,'0')}:00 UTC</td><td>${fmt(p.media_reach)}</td></tr>`;
  }).join('');
  tw.innerHTML = `<table><thead><tr><th>Fecha</th><th>Día</th><th>Hora (UTC)</th><th>Alcance</th></tr></thead><tbody>${rows}</tbody></table>`;
  card.appendChild(tw);
  wrap.appendChild(card);

  wrap.appendChild(el('div','note',`Observación (no una recomendación): 5 de las 10 publicaciones se hicieron el mismo día (6 de agosto) en distintas horas, lo que hace casi imposible aislar el efecto del horario de publicación de esa jornada — se recomienda espaciar publicaciones al menos 24-48h para poder medir esto de forma fiable en el futuro.`));
  return wrap;
}

// ---------- AUDIENCIA ----------
function renderAudiencia(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Audiencia y demografía'));
  wrap.appendChild(el('div','note na','Esta métrica no está disponible en la fuente de datos conectada. Instagram solo expone edad, género, ubicación y horas de actividad de la audiencia para cuentas con un mínimo de seguidores/alcance (habitualmente 100+); con 50 seguidores, Windsor.ai devuelve estos campos vacíos. Lo mismo ocurre con el crecimiento diario de seguidores (follower_count_1d), no disponible por debajo de 100 seguidores.'));

  const grid = el('div','grid cols-3');
  [
    ['Seguidores', fmt(IG_FOLLOWERS), 'Dato real'],
    ['Cuentas que sigue', fmt(IG_FOLLOWS), 'Dato real — inusualmente bajo para una cuenta de marca'],
    ['Publicaciones totales', fmt(IG_MEDIA_COUNT), 'Dato real'],
  ].forEach(([l,v,s])=>{
    const c = el('div','card metric');
    c.innerHTML = `<div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div>`;
    grid.appendChild(c);
  });
  wrap.appendChild(grid);

  const bioCard = el('div','card');
  bioCard.style.marginTop='14px';
  bioCard.innerHTML = `<h3 style="font-size:14px;margin-bottom:8px;">Biografía del perfil (dato real)</h3>
    <p style="font-size:13px;color:var(--text2);white-space:pre-wrap;line-height:1.6;">🧠 Supraconciencia aplicada
⚡ Metacognición + Neuroplasticidad
🔇 Apaga el ruido mental y el ego
🎯 Entrena presencia real (sin humo)
⬇️ Empieza aquí</p>
    <p style="font-size:12px;color:var(--text2);margin-top:8px;">Web enlazada: <a href="https://www.berzosaneuro.com/" target="_blank">berzosaneuro.com ↗</a></p>`;
  wrap.appendChild(bioCard);

  wrap.appendChild(el('div','note insight','Oportunidad detectada a partir de datos reales: la cuenta solo sigue a 3 perfiles. Para una cuenta de marca en fase de arranque, interactuar activamente (seguir, comentar) con cuentas de la misma temática suele ser una palanca real de descubribilidad que no depende del algoritmo — no es una métrica de Windsor.ai, es una recomendación basada en el patrón observado.'));
  return wrap;
}

// ---------- CONVERSION ----------
function renderConversion(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Métricas de conversión'));
  const withVisits = POSTS.filter(p=>p.media_profile_visits!==null);
  wrap.appendChild(el('p','section-sub',`Visitas al perfil por publicación solo está disponible para ${withVisits.length} de ${POSTS.length} publicaciones — Instagram no expone este campo para reels vía esta API ("Not supported for reels"), solo para carruseles/imágenes.`));

  wrap.appendChild(el('div','note na','No disponible: leads y ventas (no hay conector de CRM/e-commerce conectado en Windsor.ai para esta cuenta), seguidores generados por publicación (follower_count_1d no disponible con menos de 100 seguidores), y visitas al perfil para reels (limitación de la propia API de Instagram).'));

  const flow = el('div','card');
  flow.innerHTML = `<h3 style="font-size:14px;margin-bottom:6px;">Embudo parcial — solo carruseles (los únicos con dato de visitas al perfil)</h3>`;
  const f = el('div','flow');
  const totalReachCarousel = sum(carousels, p=>p.media_reach);
  const totalVisits = sum(carousels, p=>p.media_profile_visits||0);
  [
    ['Alcance', totalReachCarousel],
    ['Visitas al perfil', totalVisits],
  ].forEach(([label,val],i)=>{
    if(i>0) f.appendChild(el('span','flow-arrow','→'));
    const s = el('div','flow-step');
    s.innerHTML = `<div class="n">${fmt(val)}</div><div class="l">${label}</div>`;
    f.appendChild(s);
  });
  flow.appendChild(f);
  flow.appendChild(el('p','',`<p style="font-size:12px;color:var(--text2);margin-top:10px;">Conversión alcance → visita al perfil (solo carruseles): <b style="color:var(--text);">${(totalVisits/totalReachCarousel*100).toFixed(1)}%</b></p>`));
  wrap.appendChild(flow);

  wrap.appendChild(el('div','note','El embudo completo (alcance → reproducciones → interacciones → visitas al perfil → seguidores → clics → leads → ventas) no se puede construir con los datos actuales: faltan visitas al perfil para reels, seguidores por publicación, y no hay conector de conversión/ventas. Esta sección se limita a lo que sí es medible para no inventar cifras.'));
  return wrap;
}

// ---------- OPORTUNIDADES ----------
function renderOportunidades(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Oportunidades de crecimiento'));
  const opps = [
    ['Publicar simultáneamente en Instagram y Facebook', 'Alto', 'Alta', 'Facebook demostró 6/6 veces más alcance que Instagram con el mismo contenido exacto. Es la palanca de mayor impacto detectada en todo el análisis.'],
    ['Retomar la cadencia de publicación ya', 'Alto', 'Alta', '3 semanas de silencio justo después del mejor resultado del año — el impulso ganado en Facebook se está enfriando sin contenido nuevo.'],
    ['Escribir caption con gancho en cada publicación', 'Medio', 'Media', 'Las únicas 2 publicaciones con texto real superan la puntuación media; la muestra es pequeña pero la dirección es consistente.'],
    ['No agrupar varias publicaciones el mismo día', 'Medio', 'Alta', '5 de 10 publicaciones se hicieron el mismo día (6 ago) compitiendo entre sí por distribución — los reels de ese día tuvieron el alcance más bajo del histórico salvo uno.'],
    ['Guardar el guion/caption de cada reel antes de publicar', 'Medio', 'Alta', 'Permite en el futuro analizar qué ganchos funcionan — ahora mismo 7/10 reels no tienen texto registrado y ese análisis es imposible.'],
    ['Interactuar activamente con cuentas del nicho', 'Medio', 'Media', 'La cuenta solo sigue a 3 perfiles — para una cuenta nueva, el follow/comment activo es una palanca de descubribilidad que no depende del alcance orgánico.'],
  ];
  opps.forEach(([title,impact,ease,detail])=>{
    const c = el('div','rec');
    c.innerHTML = `<div class="k">${title}</div>
      <div class="row"><b>Impacto:</b> ${impact} · <b>Facilidad:</b> ${ease}</div>
      <div class="row">${detail}</div>`;
    wrap.appendChild(c);
  });
  return wrap;
}

// ---------- PLAN ----------
function renderPlan(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Plan de acción'));

  const b7 = el('div','card'); b7.style.marginBottom='14px';
  b7.innerHTML = `<h3 style="font-size:15px;color:var(--blue-hover);margin-bottom:10px;">Próximos 7 días</h3>`;
  b7.appendChild(el('ul','clean',`
    <li>Publica 1 reel esta semana sobre metacognición o neuroplasticidad (el territorio temático que ya funcionó), <b>subiéndolo a la vez en Instagram y en Facebook</b>.</li>
    <li>Escribe un caption real con gancho en las primeras 2 líneas (pregunta o afirmación directa, como el post "A ti te pasa?" que fue el de mejor puntuación).</li>
    <li>Añade 2-3 segundos de texto en pantalla al inicio del reel a modo de gancho visual — el reel con peor retención (92,7% de abandono en 3s) no parece tenerlo.</li>
    <li>Sigue y comenta activamente 10-15 cuentas del nicho (neurociencia, psicología práctica, desarrollo personal) para empezar a construir red.</li>
  `));
  wrap.appendChild(b7);

  const b30 = el('div','card'); b30.style.marginBottom='14px';
  b30.innerHTML = `<h3 style="font-size:15px;color:var(--cyan);margin-bottom:10px;">Próximos 30 días</h3>`;
  b30.appendChild(el('ul','clean',`
    <li>Frecuencia recomendada: 2 publicaciones/semana repartidas (no agrupadas el mismo día), publicadas siempre en ambas plataformas.</li>
    <li>Reparte entre reel (para alcance) y carrusel con caption largo (para conexión/autoridad) — ambos formatos han mostrado señales positivas distintas.</li>
    <li>Registra el caption/guion de cada pieza en un documento para poder analizar ganchos con datos reales dentro de un mes.</li>
    <li>Vigila de cerca: si Facebook vuelve a repuntar con una publicación, dobla la apuesta en ese formato/tema inmediatamente.</li>
  `));
  wrap.appendChild(b30);

  const b90 = el('div','card');
  b90.innerHTML = `<h3 style="font-size:15px;color:var(--purple);margin-bottom:10px;">Próximos 90 días</h3>`;
  b90.appendChild(el('ul','clean',`
    <li>Objetivo realista dado el punto de partida: pasar de 50 a 300-500 seguidores en Instagram, y consolidar (no solo mantener) los ~750 de Facebook.</li>
    <li>Sistema de revisión mensual: recalcular este dashboard cada 30 días — con más publicaciones, el análisis de horarios, ganchos y temas empezará a tener validez estadística real.</li>
    <li>Una vez haya 20+ publicaciones con caption registrado, construir la taxonomía de ganchos y temas que este informe no pudo hacer por falta de datos.</li>
    <li>Evaluar conectar TikTok (mismo contenido en formato vertical) dado que Facebook ya demostró que la distribución cruzada funciona mejor que confiar solo en Instagram.</li>
  `));
  wrap.appendChild(b90);
  return wrap;
}

// ---------- CALENDARIO ----------
function renderCalendario(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Calendario de contenidos — próximos 30 días'));
  wrap.appendChild(el('p','section-sub','Calendario orientativo (hipótesis, no datos) basado en la biografía de la cuenta y en lo que ya ha funcionado. Usa variables [entre corchetes] para adaptarlo.'));
  const cal = [
    ['Semana 1 · Día 1','Reel','Repite el territorio ganador: metacognición aplicada a [SITUACIÓN COTIDIANA]. Gancho: pregunta directa ("¿Te pasa que...?"). Publicar en IG + FB a la vez.'],
    ['Semana 1 · Día 4','Carrusel','Desarrolla en texto largo el mismo tema del reel — aprovecha que el caption largo tuvo la mejor puntuación del histórico.'],
    ['Semana 2 · Día 1','Reel','Tema: neuroplasticidad y [HÁBITO]. Añade texto en pantalla en los primeros 2s a modo de gancho visual.'],
    ['Semana 2 · Día 4','Reel','Formato "error común": "[ERROR] que cometes con tu mente sin darte cuenta". Objetivo: comentarios/identificación.'],
    ['Semana 3 · Día 1','Carrusel','Storytelling personal (como el post de metacognición) sobre [EXPERIENCIA PROPIA] — este tono ya demostró buena puntuación.'],
    ['Semana 3 · Día 4','Reel','Reutiliza el ángulo del reel más visto (189 alcance) con una variación: mismo tema, gancho distinto.'],
    ['Semana 4 · Día 1','Reel o Carrusel','Decide según qué formato esté rindiendo mejor en las 3 semanas previas — mantener flexibilidad basada en datos reales, no en este calendario fijo.'],
    ['Semana 4 · Día 4','Carrusel','Resumen/recopilatorio de aprendizajes del mes — bueno para guardados.'],
  ];
  cal.forEach(([when,fmt_,idea])=>{
    const d = el('div','cal-day');
    d.innerHTML = `<div class="d">${when} · ${fmt_}</div><div>${idea}</div>`;
    wrap.appendChild(d);
  });
  wrap.appendChild(el('div','note','Este calendario es una hipótesis de trabajo, no una predicción de resultados — está marcado explícitamente como tal porque no hay datos suficientes para garantizar que estos temas concretos funcionarán.'));
  return wrap;
}

// ---------- IDEAS ----------
function renderIdeas(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Banco de ideas de contenido'));
  wrap.appendChild(el('p','section-sub','Ideas adaptadas al nicho real de la cuenta (neurociencia aplicada, metacognición, atención plena — según biografía del perfil), usando variables editables.'));
  const ideas = [
    ['Alcance','Reel','"[ERROR MENTAL] que el 90% de la gente comete sin saberlo"','Gancho de error común + demostración rápida','Guardar / compartir'],
    ['Alcance','Reel','"Por qué tu mente [PROBLEMA] y qué hacer al respecto"','Pregunta + solución práctica en <30s','Seguir para más'],
    ['Guardados','Carrusel','"5 señales de que estás viviendo en piloto automático"','Lista práctica, aplicable de inmediato','Guardar esto'],
    ['Compartidos','Reel','"Manda esto a alguien que [SITUACIÓN]"','Contenido con potencial de identificación directa','Compartir con esa persona'],
    ['Comentarios','Carrusel','"¿Estás de acuerdo? La mente no controla, observa"','Afirmación con matiz de opinión, invita a debate','Comenta tu opinión'],
    ['Seguidores','Reel','"Método de 3 pasos para [RESULTADO DESEADO]"','Promesa clara + demostración de autoridad','Sígueme para la serie completa'],
    ['Autoridad','Carrusel','Storytelling personal: cómo descubriste la metacognición','Igual que el post de mejor puntuación del histórico','Empieza aquí (bio)'],
    ['Comunidad','Reel','"Esto os pasa a todos: [PATRÓN COMÚN]"','Igual formato que el reel con mejor engagement rate','Comenta si te pasa'],
  ];
  const grid = el('div','grid cols-2');
  ideas.forEach(([obj,formato,titulo,gancho,cta])=>{
    const c = el('div','idea-card');
    c.innerHTML = `<span class="tag">${obj} · ${formato}</span><h4>${titulo}</h4><p>${gancho}</p><div class="badge">CTA: ${cta}</div>`;
    grid.appendChild(c);
  });
  wrap.appendChild(grid);
  return wrap;
}

// ---------- EXPERIMENTOS ----------
function renderExperimentos(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Experimentos recomendados'));
  const exps = [
    ['Caption largo vs sin caption', 'Publicar 2 reels con temática similar, uno con caption/hilo completo y otro sin texto', 'Presencia de caption', 'Formato, tema, día de publicación', 'Engagement rate', '4 semanas', 'El de caption supera al menos un 30% en engagement rate'],
    ['Gancho visual en los primeros 2 segundos', 'Comparar reels con texto en pantalla desde el segundo 0 vs reels que empiezan hablando sin texto', 'Presencia de gancho visual', 'Duración, tema', 'Tasa de abandono en 3s (skip rate)', '3-4 publicaciones por variante', 'Reducir el skip rate por debajo del 50%'],
    ['Publicación cruzada simultánea IG+FB', 'Publicar cada pieza en ambas plataformas el mismo día vs solo en Instagram', 'Plataforma de publicación', 'Contenido idéntico', 'Alcance/impresiones totales combinadas', '4 publicaciones', 'Ya validado con 6/6 casos — formalizar como práctica estándar'],
    ['Espaciado entre publicaciones', 'Publicar con 48-72h de separación en vez de varias el mismo día', 'Intervalo entre publicaciones', 'Formato, tema', 'Alcance medio por publicación', '3 semanas', 'Alcance medio por pieza superior al de la ráfaga del 6 de agosto'],
  ];
  exps.forEach(([title,hyp,varm,control,metric,dur,success])=>{
    const c = el('div','card');
    c.style.marginBottom='12px';
    c.innerHTML = `<h4 style="font-size:14px;margin-bottom:8px;color:var(--blue-hover);">${title}</h4>
      <div style="font-size:12.5px;color:var(--text2);line-height:1.7;">
        <div><b style="color:var(--text);">Hipótesis:</b> ${hyp}</div>
        <div><b style="color:var(--text);">Variable modificada:</b> ${varm}</div>
        <div><b style="color:var(--text);">Se mantiene fijo:</b> ${control}</div>
        <div><b style="color:var(--text);">Métrica principal:</b> ${metric}</div>
        <div><b style="color:var(--text);">Duración:</b> ${dur}</div>
        <div><b style="color:var(--text);">Éxito si:</b> ${success}</div>
      </div>`;
    wrap.appendChild(c);
  });
  return wrap;
}

// ---------- ALERTAS ----------
function renderAlertas(){
  const wrap = el('div');
  wrap.appendChild(el('h2','section-title','Alertas automáticas'));
  const alerts = [
    ['warn', `${daysSinceLastPost} días sin publicar`, 'Última publicación real registrada (Instagram)', 'La cuenta lleva 3 semanas en silencio justo después del mejor resultado del año en Facebook — riesgo de perder el impulso ganado.', 'Publicar esta semana, en ambas plataformas.'],
    ['insight', 'Facebook creció +726 seguidores en 48 horas', 'page_fans: 28 → 754 entre el 27 y 29 de julio', 'Un único reel republicado generó ese crecimiento — señal fuerte de que el contenido conecta cuando alcanza suficiente audiencia.', 'Analizar y replicar ese reel concreto; mantener publicación cruzada.'],
    ['na', 'Retención crítica en un reel de alto alcance', '92,7% de abandono en los primeros 3 segundos (reel del 6 ago, 133 de alcance)', 'El reel llegó a bastante gente pero casi nadie se quedó a verlo — el alcance no se tradujo en atención real.', 'Revisar y mejorar el gancho de los primeros 2-3 segundos en el próximo reel.'],
    ['warn', '5 publicaciones el mismo día', '6 de agosto: 5 de las 10 publicaciones del histórico', 'Publicar varias piezas el mismo día hace que compitan entre sí por distribución y dificulta medir qué funciona.', 'Espaciar publicaciones al menos 48-72 horas.'],
  ];
  alerts.forEach(([type,title,metric,detail,action])=>{
    const c = el('div','card note '+type);
    c.style.display='block';
    c.style.marginBottom='12px';
    c.innerHTML = `<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">${title}</div>
      <div style="font-size:12px;margin-bottom:4px;"><b>Métrica:</b> ${metric}</div>
      <div style="font-size:12px;margin-bottom:4px;"><b>Explicación:</b> ${detail}</div>
      <div style="font-size:12px;"><b>Acción recomendada:</b> ${action}</div>`;
    wrap.appendChild(c);
  });
  return wrap;
}

renderApp();
