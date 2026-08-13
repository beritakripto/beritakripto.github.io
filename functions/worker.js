const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,X-CMS-Secret','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
function out(body,status=200){return new Response(body,{status,headers:{...cors,'content-type':'application/json','cache-control':'no-store'}})}
async function githubToken(env){
  const now=Math.floor(Date.now()/1000),b64=x=>btoa(String.fromCharCode(...new Uint8Array(x))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const header=b64(new TextEncoder().encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
  const payload=b64(new TextEncoder().encode(JSON.stringify({iat:now-30,exp:now+540,iss:env.GITHUB_APP_ID})));
  const pem=env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g,'\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
  const der=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(header+'.'+payload));
  const jwt=header+'.'+payload+'.'+b64(sig);
  const r=await fetch(`https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,{method:'POST',headers:{Authorization:`Bearer ${jwt}`,Accept:'application/vnd.github+json','User-Agent':'CryptoNews-CMS'}});
  if(!r.ok)throw new Error('GitHub installation token failed');
  return (await r.json()).token;
}
async function gh(env,token,path,opt={}){
  const r=await fetch('https://api.github.com'+path,{...opt,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','User-Agent':'CryptoNews-CMS','Content-Type':'application/json',...(opt.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.message||`GitHub ${r.status}`);
  return d;
}
function b64(s){return btoa(unescape(encodeURIComponent(s)))}
function validSlug(s){return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&s.length<=180}
export default{async fetch(req,env){
  if(req.method==='OPTIONS')return new Response('',{status:204,headers:cors});
  const u=new URL(req.url);
  if(!u.pathname.startsWith('/api/'))return out({ok:true,service:'CryptoNews CMS'});
  if(req.headers.get('X-CMS-Secret')!==env.CMS_SECRET)return out({error:'Unauthorized'},401);
  if(req.method==='GET'&&u.pathname==='/api/health')return out({ok:true});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const body=await req.json();
    if(JSON.stringify(body).length>7000000) return out({error:'Payload too large'},413);
    const action=body.action;
    const token=await githubToken(env);
    const owner=env.GITHUB_OWNER,repo=env.GITHUB_REPO,branch=env.GITHUB_BRANCH||'main';
    if(action==='publish'){
      const d=body.article||{};
      if(!d.title||!d.slug||!d.excerpt||!d.body)return out({error:'Missing required fields'},400);
      if(!validSlug(d.slug))return out({error:'Invalid slug'},400);
      if(!Array.isArray(d.tags))d.tags=[];
      if(d.tags.length>30)return out({error:'Too many tags'},400);
      const now=new Date().toISOString(),y=now.slice(0,4),m=now.slice(5,7);
      const path=`content/posts/${y}/${m}/${d.slug}/article.md`;
      const safe=JSON.stringify;
      const md=`---\ntitle: ${safe(d.title)}\nslug: ${safe(d.slug)}\nexcerpt: ${safe(d.excerpt)}\ndate: ${safe(d.date||now)}\nupdated: ${safe(now)}\nauthor: ${safe(d.author||'Redaksi')}\ncategory: ${safe(d.category||'Crypto')}\ntags: ${JSON.stringify(d.tags)}\nstatus: "published"\nfeatured: ${!!d.featured}\nbreaking: ${!!d.breaking}\nimage: ${safe(d.image||'/images/default-news.svg')}\nimageAlt: ${safe(d.imageAlt||d.title)}\nseoTitle: ${safe(d.seoTitle||d.title)}\nseoDescription: ${safe(d.seoDescription||d.excerpt)}\ncanonical: ${safe(d.canonical||'')}\n---\n\n${String(d.body).slice(0,500000)}\n`;
      let sha;
      try{const old=await gh(env,token,`/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);sha=old.sha}catch{}
      const payload={message:`content: ${sha?'update':'publish'} ${d.slug}`,content:b64(md),branch};
      if(sha)payload.sha=sha;
      const r=await gh(env,token,`/repos/${owner}/${repo}/contents/${path}`,{method:'PUT',body:JSON.stringify(payload)});
      return out({ok:true,path,commit:r.commit?.sha||null});
    }
    if(action==='upload'){
      const f=body.file||{};if(!f.name||!f.content)return out({error:'Missing file'},400);
      if(f.content.length>7_000_000)return out({error:'File too large'},413);
      const clean=f.name.toLowerCase().replace(/[^a-z0-9._-]/g,'-');
      const path=`public/images/uploads/${Date.now()}-${clean}`;
      const r=await gh(env,token,`/repos/${owner}/${repo}/contents/${path}`,{method:'PUT',body:JSON.stringify({message:`media: upload ${clean}`,content:f.content,branch})});
      return out({ok:true,path:'/'+path,commit:r.commit?.sha||null});
    }
    return out({error:'Unknown action'},400);
  }catch(e){return out({error:e.message||'Server error'},500)}
}};