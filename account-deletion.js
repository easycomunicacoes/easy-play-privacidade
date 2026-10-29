const config=window.EASY_CONFIG;
const $=id=>document.querySelector('#'+id);
const result=$('result');let busy=false,accessToken='';
const storageKey='easy-deletion-receipt:'+config.supabaseUrl;
let receipt='';try{receipt=sessionStorage.getItem(storageKey)||'';}catch{}
async function call(path,body,token=''){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(config.supabaseUrl+path,{method:'POST',headers:{apikey:config.anonKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:controller.signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=Error(response.status===429?'Muitas tentativas. Aguarde antes de tentar novamente.':response.status===404?'Não há confirmação registrada com este recibo. Confirme sua identidade novamente.':'Não foi possível concluir. Confira o código ou consulte o andamento antes de repetir.');throw error;}
  return data;
 }finally{clearTimeout(timer);}
}
function show(data){
 if(data.state==='completed'){
  result.textContent='Exclusão concluída: sua conta e os dados elegíveis foram removidos. Assinaturas Google Play e cobranças Asaas/Pix não foram canceladas automaticamente.';
  accessToken='';$('account-code').value='';$('confirm-deletion').checked=false;
 }else if(data.state==='pending_review'){
  result.textContent='Pedido confirmado e pendente de revisão segura de vínculos. A exclusão ainda não foi concluída. Nenhum vínculo duvidoso será excluído automaticamente.';
 }else result.textContent='Exclusão ainda em processamento. Consulte o andamento para retomar com segurança.';
}
async function locked(run){if(busy)return;busy=true;$('send-code').disabled=true;$('confirm-request').disabled=true;$('check-status').disabled=true;
 try{await run();}catch(e){result.textContent=e.name==='AbortError'?'A conexão demorou demais. A operação pode ter sido recebida; consulte o andamento.':e instanceof TypeError?'Sem conexão. A exclusão não foi confirmada; consulte o andamento quando a Internet voltar.':e.message;}
 finally{busy=false;$('send-code').disabled=false;$('confirm-request').disabled=false;$('check-status').disabled=!receipt;}
}
$('send-code').onclick=()=>locked(async()=>{
 if(!$('account-email').reportValidity())return;
 await call('/auth/v1/otp',{email:$('account-email').value.trim(),create_user:false});
 result.textContent='Envio aceito pelo serviço. Confira seu e-mail e Spam. Digite o código somente nesta página.';
});
$('deletion').onsubmit=event=>{event.preventDefault();return locked(async()=>{
 if(!$('deletion').reportValidity()||!$('confirm-deletion').checked)return;
 if(!accessToken){const auth=await call('/auth/v1/verify',{email:$('account-email').value.trim(),token:$('account-code').value.trim(),type:'email'});if(!auth.access_token)throw Error('Identidade não confirmada.');accessToken=auth.access_token;$('account-code').value='';$('account-code').required=false;$('account-email').readOnly=true;}
 if(!receipt){receipt=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');try{sessionStorage.setItem(storageKey,receipt);}catch{}}
 const data=await call('/functions/v1/play-deletion-self-service',{action:'begin',confirm:true,receipt},accessToken);show(data);
 if(data.state==='pending_review'){await call('/auth/v1/logout?scope=local',{},accessToken).catch(()=>{});accessToken='';}
 });};
$('check-status').onclick=()=>locked(async()=>{if(receipt)show(await call('/functions/v1/play-deletion-self-service',{action:'resume',receipt}));});
$('check-status').disabled=!receipt;


