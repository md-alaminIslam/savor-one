const cfg=window.SAVOR_CONFIG||{};
export let client=null;
export let setupError='';
if(!/^https:\/\/[^/]+\.supabase\.co$/.test(cfg.supabaseUrl||'')||!cfg.supabasePublishableKey){
 setupError='Supabase setup is required. Add your Project URL and public publishable key to site/config.js, then run supabase/setup.sql in your project.';
}else{
 try{const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.118.0');client=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});}catch{setupError='Unable to load sign-in. Check your internet connection and Supabase configuration.';}
}
export async function getContext(){
 if(!client)return {user:null,profile:null};
 const {data,error}=await client.auth.getUser();if(error||!data.user)return {user:null,profile:null};
 const {data:profile,error:pe}=await client.from('profiles').select('*').eq('id',data.user.id).single();if(pe)throw new Error('Account profile could not be loaded. Check the Supabase setup and database policies.');
 return {user:data.user,profile};
}
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
