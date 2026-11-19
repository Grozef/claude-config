// Interactions de la page HTML d'un diagramme generique (zoom, deplacement, surbrillance au survol, theme, export PNG).
// Insere tel quel par lib/render.mjs ; la CSP de la page autorise ce script par son empreinte sha256.
// Donnees : bloc JSON d'id dgm-data (file : nom de l'export PNG).
const D=JSON.parse(document.getElementById('dgm-data').textContent);
const main=document.getElementById('main'),stage=document.getElementById('stage'),svg=stage.querySelector('svg');
let k=1,tx=0,ty=0,pinned=null;
function apply(){stage.style.transform='translate('+tx+'px,'+ty+'px) scale('+k+')'}
function fit(){const r=main.getBoundingClientRect(),w=+svg.getAttribute('width'),h=+svg.getAttribute('height');k=Math.min(r.width/w,r.height/h)*0.97;tx=(r.width-w*k)/2;ty=(r.height-h*k)/2;apply()}
function clear(){main.classList.remove('focus');svg.querySelectorAll('.on,.nb').forEach(e=>e.classList.remove('on','nb'))}
function focusNode(id){clear();main.classList.add('focus');const N=svg.querySelector('.node[data-node="'+CSS.escape(id)+'"]');if(!N)return;N.classList.add('on');
 svg.querySelectorAll('.rel').forEach(r=>{if(r.dataset.from===id||r.dataset.to===id){r.classList.add('on');for(const n of [r.dataset.from,r.dataset.to]){const M=svg.querySelector('.node[data-node="'+CSS.escape(n)+'"]');M&&M.classList.add('nb')}}})}
svg.querySelectorAll('.node').forEach(N=>{N.addEventListener('mouseenter',()=>{if(!pinned)focusNode(N.dataset.node)});
 N.addEventListener('mouseleave',()=>{if(!pinned)clear()});
 N.addEventListener('click',e=>{e.stopPropagation();if(moved)return;pinned=N.dataset.node;focusNode(pinned)})});
svg.querySelectorAll('.rel').forEach(R=>R.addEventListener('click',e=>{e.stopPropagation();if(moved)return;clear();pinned=R.dataset.rel;main.classList.add('focus');R.classList.add('on');
 for(const n of [R.dataset.from,R.dataset.to]){const M=svg.querySelector('.node[data-node="'+CSS.escape(n)+'"]');M&&M.classList.add('nb')}}));
let drag=null,moved=false;
main.addEventListener('mousedown',e=>{drag={x:e.clientX,y:e.clientY,tx,ty};moved=false;main.classList.add('drag')});
addEventListener('mousemove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;tx=drag.tx+dx;ty=drag.ty+dy;apply()});
addEventListener('mouseup',()=>{drag=null;main.classList.remove('drag');setTimeout(()=>moved=false,0)});
main.addEventListener('click',e=>{if(moved)return;if(!e.target.closest('.node,.rel')){pinned=null;clear()}});
main.addEventListener('wheel',e=>{e.preventDefault();const r=main.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,f=Math.exp(-e.deltaY*0.0015),nk=Math.min(4,Math.max(0.05,k*f));tx=mx-(mx-tx)*nk/k;ty=my-(my-ty)*nk/k;k=nk;apply()},{passive:false});
document.getElementById('fit').onclick=fit;
document.getElementById('zin').onclick=()=>{k*=1.25;apply()};document.getElementById('zout').onclick=()=>{k/=1.25;apply()};
document.getElementById('theme').onclick=()=>{const r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('cdc-diagram-theme',r.dataset.theme)}catch(e){}};
try{const t=localStorage.getItem('cdc-diagram-theme');if(t)document.documentElement.dataset.theme=t;else if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.dataset.theme='dark'}catch(e){}
addEventListener('keydown',e=>{if(e.key==='Escape'){pinned=null;clear()}});
document.getElementById('png').onclick=()=>{const dark=document.documentElement.dataset.theme==='dark';
 // le SVG exporte est isole (pas de :root[data-theme]) : les regles du theme sombre y sont recopiees sans ce prefixe
 const css=[...document.styleSheets].flatMap(s=>[...s.cssRules].map(r=>r.cssText)).filter(t=>t.includes('.dgm')).filter(t=>dark||!t.includes('data-theme')).map(t=>t.replace(/:root\[data-theme="?dark"?\]\s*/g,'')).join('\n');
 const c=svg.cloneNode(true);const st=document.createElementNS('http://www.w3.org/2000/svg','style');st.textContent=css;c.insertBefore(st,c.firstChild);
 const w=+svg.getAttribute('width'),h=+svg.getAttribute('height'),img=new Image(),url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)],{type:'image/svg+xml'}));
 img.onload=()=>{const cv=document.createElement('canvas');cv.width=w*2;cv.height=h*2;const g=cv.getContext('2d');g.scale(2,2);g.drawImage(img,0,0);URL.revokeObjectURL(url);
  cv.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=D.file+'.png';a.click()})};img.src=url};
let vw=main.clientWidth,vh=main.clientHeight;
addEventListener('resize',()=>{tx+=(main.clientWidth-vw)/2;ty+=(main.clientHeight-vh)/2;vw=main.clientWidth;vh=main.clientHeight;apply()});
fit();
