import {client,getContext} from './client.js';
try{
 const {profile}=await getContext();
 if(!profile||profile.status!=='Active'){location.replace('./index.html');}
 else{
  window.SAVOR_ACCOUNT=profile;
  window.SAVOR_CLIENT=client;
  window.SAVOR_SIGN_OUT=async()=>{await client.auth.signOut();location.replace('./index.html');};
  document.body.style.display='';
  const script=document.createElement('script');script.src='./workspace-code.js';script.onload=()=>{const routing=document.createElement('script');routing.src='./routing.js?v=20261105';document.body.append(routing);};document.body.append(script);
 }
}catch{location.replace('./index.html');}
