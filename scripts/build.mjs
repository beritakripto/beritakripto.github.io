import fs from 'node:fs';import path from 'node:path';

const OUT='dist';
fs.rmSync(OUT,{recursive:true,force:true});
fs.mkdirSync(OUT,{recursive:true});

const site=JSON.parse(fs.readFileSync('content/data/site.json','utf8'));
const posts=[];

function walk(d){
  for(const e of fs.readdirSync(d,{withFileTypes:true})){
    const p=path.join(d,e.name);
    if(e.isDirectory()) walk(p);
    else if(e.name==='article.md') posts.push(readArticle(p));
  }
}
function readArticle(file){
  const s=fs.readFileSync(file,'utf8');
  const m=s.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
  if(!m) throw new Error(`Invalid frontmatter: ${file}`);
  const x={};
  for(const line of m[1].split(/\r?\n/)){
    const z=line.match(/^([\w-]+):\s*(.*)$/);
    if(!z) continue;
    let v=z[2].trim();
    if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
    else if(v==='true'||v==='false') v=v==='true'||v==='false'&&v==='true';
    else if(v.startsWith('[')){try{v=JSON.parse(v)}catch{v=[]}}
    x[z[1]]=v;
  }
  x.body=m[2];
  if(x.status!=='published') return null;
  if(!x.slug||!x.title||!x.date) throw new Error(`Missing required frontmatter: ${file}`);
  return x;
}
walk('content/posts');
for(let i=posts.length-1;i>=0;i--) if(!posts[i]) posts.splice(i,1);
const slugs=new Set();
for(const p of posts){if(slugs.has(p.slug))throw new Error('Duplicate slug: '+p.slug);slugs.add(p.slug)}

const esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const safeHtml=s=>String(s??'')
  .replace(/<script[\s\S]*?<\/script>/gi,'')
  .replace(/<iframe[\s\S]*?<\/iframe>/gi,'')
  .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi,'')
  .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi,'');
const dateFmt=d=>new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeZone:site.timezone}).format(new Date(d));
const base=site.baseUrl.replace(/\/$/,'');
const card=p=>`<a class="card" href="/${esc(p.slug)}/"><img src="${esc(p.image||'/images/default-news.svg')}" alt="${esc(p.imageAlt||p.title)}" loading="lazy"><div class="body"><div class="meta">${esc(p.category)} · ${esc(dateFmt(p.date))}</div><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p></div></a>`;
const shell=(title,body,head='')=>`<!doctype html><html lang="${esc(site.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow,max-image-preview:large"><title>${esc(title)}</title>${head}<link rel="stylesheet" href="/assets/site.css"></head><body><header class="top"><div class="container nav"><a class="brand" href="/">${esc(site.logoText)}<span>${esc(site.logoAccent)}</span></a><nav class="links"><a href="/">Beranda</a><a href="/category/crypto/">Crypto</a><a href="/category/bitcoin/">Bitcoin</a><a href="/category/defi/">DeFi</a><a href="/search/">Cari</a></nav></div></header>${body}<footer class="footer"><div class="container">${esc(site.name)} — ${esc(site.description)}</div></footer></body></html>`;

fs.cpSync('public',OUT,{recursive:true});
posts.sort((a,b)=>new Date(b.date)-new Date(a.date));

const latest=posts.slice(0,30).map(card).join('');
fs.writeFileSync(path.join(OUT,'index.html'),shell(site.name,`<main class="container"><section class="hero"><small>PORTAL BERITA</small><h1>${esc(site.tagline)}</h1><p>${esc(site.description)}</p></section><h2>Berita Terbaru</h2><div class="grid">${latest}</div></main>`));

for(const p of posts){
  const dir=path.join(OUT,p.slug);fs.mkdirSync(dir,{recursive:true});
  const url=p.canonical||`${base}/${p.slug}/`;
  const image=p.image?`${base}${p.image.startsWith('/')?'':'/'}${p.image}`:`${base}/images/default-news.svg`;
  const schema={"@context":"https://schema.org","@type":"NewsArticle","headline":p.title,"description":p.excerpt,"image":[image],"datePublished":p.date,"dateModified":p.updated||p.date,"author":{"@type":"Person","name":p.author||'Redaksi'},"publisher":{"@type":"Organization","name":site.name},"mainEntityOfPage":{"@type":"WebPage","@id":url}};
  const body=`<main class="container article"><div class="meta">${esc(p.category)} · ${esc(dateFmt(p.date))} · ${esc(p.author||'Redaksi')}</div><h1>${esc(p.title)}</h1><p class="lead">${esc(p.excerpt)}</p><img class="heroimg" src="${esc(p.image||'/images/default-news.svg')}" alt="${esc(p.imageAlt||p.title)}" width="1200" height="630"><div class="prose">${safeHtml(p.body)}</div><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script></main>`;
  const head=`<meta name="description" content="${esc(p.seoDescription||p.excerpt)}"><link rel="canonical" href="${esc(url)}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.excerpt)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image">`;
  fs.writeFileSync(path.join(dir,'index.html'),shell(p.seoTitle||p.title,body,head));
}

const cats=[...new Set(posts.map(p=>p.category).filter(Boolean))];
for(const c of cats){
  const slug=c.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const dir=path.join(OUT,'category',slug);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),shell(c,`<main class="container" style="padding:45px 0 80px"><h1>${esc(c)}</h1><div class="grid">${posts.filter(p=>p.category===c).map(card).join('')}</div></main>`));
}

fs.mkdirSync(path.join(OUT,'search'),{recursive:true});
const data=posts.map(p=>({title:p.title,slug:p.slug,excerpt:p.excerpt,category:p.category,image:p.image,imageAlt:p.imageAlt,date:dateFmt(p.date)}));
fs.writeFileSync(path.join(OUT,'search','index.html'),shell('Cari Berita',`<main class="container" style="padding:45px 0 80px"><h1>Cari Berita</h1><input id="q" style="width:100%;padding:14px;border:1px solid #cbd5e1;border-radius:9px" placeholder="Cari berita..."><div id="r" class="grid" style="margin-top:20px"></div></main><script>const P=${JSON.stringify(data)};const E=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));function run(){const q=document.getElementById('q').value.toLowerCase();document.getElementById('r').innerHTML=P.filter(p=>(p.title+' '+p.excerpt+' '+p.category).toLowerCase().includes(q)).map(p=>'<a class="card" href="/'+p.slug+'/"><img src="'+E(p.image||'/images/default-news.svg')+'" alt="'+E(p.imageAlt||p.title)+'"><div class="body"><div class="meta">'+E(p.category)+' · '+E(p.date)+'</div><h3>'+E(p.title)+'</h3><p>'+E(p.excerpt)+'</p></div></a>').join('')}document.getElementById('q').oninput=run;run();</script>`));

const urls=[`${base}/`,...posts.map(p=>`${base}/${p.slug}/`),...cats.map(c=>`${base}/category/${c.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}/`)];
fs.writeFileSync(path.join(OUT,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${esc(u)}</loc></url>`).join('')}</urlset>`);
fs.writeFileSync(path.join(OUT,'rss.xml'),`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.name)}</title><link>${esc(base)}</link><description>${esc(site.description)}</description>${posts.slice(0,30).map(p=>`<item><title>${esc(p.title)}</title><link>${esc(base+'/'+p.slug+'/')}</link><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${esc(p.excerpt)}</description></item>`).join('')}</channel></rss>`);
fs.writeFileSync(path.join(OUT,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT,'404.html'),shell('404',`<main class="container" style="padding:80px 0"><h1>404</h1><p>Halaman tidak ditemukan.</p><a href="/">Kembali ke beranda</a></main>`));
console.log(`Build OK: ${posts.length} published posts`);
