/* Shared routing augments the existing browser-local workspace without moving old drafts. */
(() => {
  'use strict';
  const api = window.SAVOR_CLIENT, me = window.SAVOR_ACCOUNT;
  const labels = {requests:'Requisition',todos:'To-do assignment',campaigns:'Marketing report',assets:'IT inventory',daily:'Daily report'};
  const viewKeys = {requisitions:'requests',todo:'todos',marketing:'campaigns',inventory:'assets'};
  let directory = [], submissions = [], ready = false, failure = '', inboxFilter = 'received';
  const originalRender = render, originalEditor = editRecord;
  const selections = {};
  const person = id => directory.find(p => p.id === id);
  const headList = () => directory.filter(p => ['Admin','Department Head'].includes(p.role));
  const moduleLabel = key => labels[key] || state.modules.find(m => m.id === key)?.name || 'Record';
  const labelFor = key => key.replace(/([A-Z])/g,' $1').replace(/_/g,' ');
  const displayPayload = obj => Object.entries(obj).filter(([k])=>!['id','recipient_id'].includes(k)).map(([k,v])=>`${labelFor(k)}: ${typeof v==='object'?JSON.stringify(v):v??'—'}`).join('\n');
  const bodyFor = (key,obj) => `SAVOR INTERNATIONAL LIMITED\n${moduleLabel(key)}\nFrom: ${me.name} (${me.email})\nDepartment: ${me.department}\n\n${displayPayload(obj)}`;
  const titleFor = (key,obj) => String(obj.item || obj.title || obj.name || (moduleLabel(key)+' · '+(obj.date||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'})))).slice(0,140);
  function errorText(e){return e?.message || 'Unable to save. Check your connection and try again.';}
  function openWhatsApp(head,text){
    const number = (head?.whatsapp || '').replace(/\D/g,'');
    if(!/^[1-9]\d{7,14}$/.test(number)){toast('Ask Admin to add this Head’s WhatsApp number in Sharing settings.');return;}
    window.open('https://wa.me/'+number+'?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');
  }
  function widget(scope){
    const box=document.createElement('div');box.className='full route-box';
    box.style.cssText='border:1px solid #dce6f4;border-radius:12px;padding:18px;background:#f7faff;margin:12px 0';
    box.innerHTML='<h3 style="margin-bottom:14px">Send to Department Head</h3>';
    if(!ready){box.insertAdjacentHTML('beforeend',`<p class="small" role="status">${esc(failure||'Loading reporting contacts…')}</p>`);return {box,head:()=>null};}
    const heads=headList(), departments=[...new Set(heads.map(p=>p.department))];
    const pref=selections[scope]||{};
    const dept=document.createElement('select'), head=document.createElement('select');
    dept.setAttribute('aria-label','Recipient department');head.setAttribute('aria-label','Department Head or Admin');
    dept.innerHTML='<option value="">All departments</option>'+departments.map(d=>`<option value="${esc(d)}">${esc(d||'General')}</option>`).join('');
    dept.value=pref.department??(departments.includes(me.department)?me.department:'');
    const grid=document.createElement('div');grid.className='formgrid';
    const a=document.createElement('label');a.textContent='Department';a.append(dept);
    const b=document.createElement('label');b.textContent='Department Head / Admin';b.append(head);grid.append(a,b);box.append(grid);
    const note=document.createElement('p');note.className='small';note.style.marginTop='12px';box.append(note);
    const populate=()=>{
      const current=head.value||pref.head;
      head.innerHTML='<option value="">Select recipient</option>'+heads.filter(p=>!dept.value||p.department===dept.value).map(p=>`<option value="${p.id}">${esc(p.name)} · ${esc(p.role)} · ${esc(p.email)}</option>`).join('');
      head.value=[...head.options].some(o=>o.value===current)?current:'';update();
    };
    const update=()=>{const p=person(head.value);selections[scope]={department:dept.value,head:head.value};note.textContent=p?(p.whatsapp?'WhatsApp: +'+p.whatsapp+' · Optional sharing opens a message for you to send.':'WhatsApp not configured. Admin can add the number in Sharing settings.'):'Choose an Active Department Head or Admin. Admin manages account roles from Manage user accounts.';};
    dept.onchange=()=>{head.value='';pref.head='';populate();};head.onchange=update;populate();
    return {box,head:()=>person(head.value)};
  }
  async function submitCopy(key,obj,head,id){
    if(!head || !headList().some(p=>p.id===head.id))throw new Error('Select a Department Head / Admin first.');
    const payload={...obj};
    const row={id,sender_id:me.id,recipient_id:head.id,module:key,title:titleFor(key,obj),payload,status:'Sent'};
    const {data,error}=await api.from('work_submissions').insert(row).select().single();
    if(error)throw error;
    submissions.unshift(data);return data;
  }
  function addRouting(form,key,read=()=>Object.fromEntries(new FormData(form)),localSave=true){
    if(!form||form.dataset.routing)return;form.dataset.routing='1';
    const route=widget(form.id||key);form.append(route.box);
    const actions=document.createElement('div');actions.className='full actions';
    const send=document.createElement('button');send.type='submit';send.className='primary';send.dataset.route='send';send.textContent='Save & submit to Head';send.disabled=!ready;
    const wa=document.createElement('button');wa.type='button';wa.className='green';wa.textContent='WhatsApp to selected Head (optional)';wa.disabled=!ready;
    wa.onclick=()=>{if(!form.reportValidity())return;const h=route.head();if(!h){toast('Select the recipient first.');return;}openWhatsApp(h,bodyFor(key,read()));};
    actions.append(send,wa);form.append(actions);
    const original=form.onsubmit;
    if(localSave){const old=form.querySelector('button:not([type="button"])');if(old&&old!==send)old.textContent='Save local draft';}
    let busy=false,submissionId=newId();
    form.onsubmit=async e=>{
      e.preventDefault();
      if(localSave&&e.submitter!==send){if(original)original.call(form,e);return;}
      if(busy)return;
      const obj=read();
      if(key==='assets' && localSave && (state.assets||[]).some((a,i)=>a.code===obj.code && (!editTarget || editTarget.index!==i))){toast('This asset ID already exists.');return;}
      if(key==='todos'&&obj.due<obj.start){toast('Deadline must be after the start time.');return;}
      const h=route.head();if(!h){toast('Choose a Department Head / Admin before submitting.');return;}
      busy=true;send.disabled=true;
      try{
        await submitCopy(key,obj,h,submissionId);submissionId=newId();
        if(localSave&&original)original.call(form,e);else render();
        toast('Submitted to '+h.name+'. They can open it in Inbox & sent.');
      }catch(err){toast(errorText(err));}finally{busy=false;send.disabled=!ready;}
    };
  }
  function submissionsPanel(key){
    const rows=submissions.filter(r=>r.module===key&&r.sender_id===me.id);
    const box=document.createElement('section');box.className='card';box.style.marginTop='22px';
    box.innerHTML=`<div class="cardtitle"><h2>Submitted to Head</h2><button class="textbtn" type="button" data-inbox>Open inbox & sent →</button></div><p class="small">Submitted copies are saved online. Local drafts and inventory remain in this browser.</p>${rows.slice(0,8).map(r=>`<div class="task"><div><h3>${esc(r.title)}</h3><p>To: ${esc(person(r.recipient_id)?.name||'Recipient')} · ${esc(r.status)}</p></div></div>`).join('')||'<p class="small" style="margin-top:15px">No submitted copies yet.</p>'}`;
    box.querySelector('[data-inbox]').onclick=()=>{inboxFilter='sent';go('inbox');};return box;
  }
  function existingDrafts(key){
    const rows=state[key]||[];if(!rows.length)return null;
    const box=document.createElement('section');box.className='card';box.style.marginTop='22px';
    box.innerHTML=`<h2>Send an existing local draft</h2><form id="send-existing-${key}" class="formgrid" style="margin-top:18px"><div class="full"><label>Choose saved draft</label><select name="draft">${rows.map((r,i)=>`<option value="${i}">${esc(titleFor(key,r))}</option>`).join('')}</select></div></form>`;
    const form=box.querySelector('form');addRouting(form,key,()=>({...rows[Number(form.elements.draft.value)]}),false);return box;
  }
  function inboxView(){
    const filtered=submissions.filter(r=>inboxFilter==='all'||(inboxFilter==='sent'?r.sender_id===me.id:r.recipient_id===me.id));
    return title('Inbox & sent','Requisitions, tasks and reports shared with the selected Head.','<button type="button" id="refresh-inbox">Refresh</button>')+`<div class="actions" style="margin-bottom:20px"><button data-inbox-filter="received" class="${inboxFilter==='received'?'primary':''}">Received</button><button data-inbox-filter="sent" class="${inboxFilter==='sent'?'primary':''}">Sent</button>${me.role==='Admin'?`<button data-inbox-filter="all" class="${inboxFilter==='all'?'primary':''}">All submissions</button>`:''}</div>${failure?`<div class="notice" role="alert">${esc(failure)}</div>`:''}<p class="small" style="margin-bottom:16px">Showing the latest 100 accessible submissions. Refresh to see new items. Status changes do not send messages automatically.</p>${filtered.map(r=>`<article class="card" style="margin-bottom:18px"><div class="cardtitle"><div><h2>${esc(r.title)}</h2><p class="small">${esc(moduleLabel(r.module))} · ${new Date(r.created_at).toLocaleString('en-GB',{timeZone:'Asia/Dhaka'})}</p></div><span class="badge blue">${esc(r.status)}</span></div><p class="small">From: ${esc(person(r.sender_id)?.name||r.sender_id)} → To: ${esc(person(r.recipient_id)?.name||r.recipient_id)}</p><details style="margin-top:15px"><summary>View details</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.8;margin:15px 0">${esc(displayPayload(r.payload))}</pre></details><div class="actions" style="margin-top:18px"><button type="button" class="green" data-wa="${r.id}">WhatsApp to recipient (optional)</button>${r.recipient_id===me.id||me.role==='Admin'?`<select aria-label="Review status for ${esc(r.title)}" data-review="${r.id}">${['Sent','Reviewed',...(r.module==='requests'?['Approved','Rejected']:[])].map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select><button type="button" data-review-save="${r.id}">Save status</button>`:''}</div></article>`).join('')||(ready?'<div class="card"><p>No submissions in this view yet.</p></div>':'<div class="card">Loading submissions…</div>')}`;
  }
  function bindInbox(){
    $('refresh-inbox').onclick=()=>loadData(true);
    document.querySelectorAll('[data-inbox-filter]').forEach(b=>b.onclick=()=>{inboxFilter=b.dataset.inboxFilter;render();});
    document.querySelectorAll('[data-wa]').forEach(b=>b.onclick=()=>{const r=submissions.find(x=>x.id===b.dataset.wa);openWhatsApp(person(r.recipient_id),bodyFor(r.module,r.payload));});
    document.querySelectorAll('[data-review-save]').forEach(b=>b.onclick=async()=>{
      const id=b.dataset.reviewSave,select=document.querySelector(`[data-review="${id}"]`);b.disabled=true;
      try{const {data,error}=await api.from('work_submissions').update({status:select.value}).eq('id',id).select().single();if(error)throw error;submissions=submissions.map(r=>r.id===id?data:r);render();toast('Review status saved.');}catch(e){toast(errorText(e));}finally{b.disabled=false;}
    });
  }
  function contactsPanel(){
    const box=document.createElement('section');box.className='card';box.style.marginTop='22px';
    box.innerHTML='<h2>Department Heads & WhatsApp contacts</h2><p class="small" style="margin:12px 0">These contacts are shared across staff accounts. Admin assigns Department Head roles through Manage user accounts.</p>';
    headList().forEach(h=>{
      const row=document.createElement('div');row.className='task';row.style.flexWrap='wrap';
      const text=document.createElement('div');text.innerHTML=`<h3>${esc(h.name)}</h3><p>${esc(h.department)} · ${esc(h.role)}<br>${esc(h.email)}</p>`;row.append(text);
      if(me.role==='Admin'){
        const form=document.createElement('form');form.className='actions';const input=document.createElement('input');input.type='tel';input.value=h.whatsapp;input.placeholder='+8801XXXXXXXXX';input.setAttribute('aria-label','WhatsApp number for '+h.name);input.style.maxWidth='220px';
        const save=document.createElement('button');save.type='submit';save.textContent='Save number';form.append(input,save);row.append(form);
        form.onsubmit=async e=>{e.preventDefault();const n=input.value.replace(/[\s+()-]/g,'');if(n&&!/^[1-9]\d{7,14}$/.test(n)){toast('Use country code and 8–15 digits.');return;}save.disabled=true;try{const {error}=await api.from('head_contacts').upsert({profile_id:h.id,whatsapp:n});if(error)throw error;h.whatsapp=n;toast('Head’s WhatsApp contact saved for all staff.');}catch(err){toast(errorText(err));}finally{save.disabled=false;}};
      }else{const p=document.createElement('span');p.className='small';p.textContent=h.whatsapp?'+'+h.whatsapp:'Number not set by Admin';row.append(p);}
      box.append(row);
    });
    if(!headList().length)box.insertAdjacentHTML('beforeend','<p class="small">No Active Head / Admin contacts available.</p>');return box;
  }
  render=function(){
    if(view==='inbox'){$('main').innerHTML=inboxView();bindInbox();return;}
    originalRender();
    const key=viewKeys[view];
    const map={requests:'reqform',todos:'todoform',campaigns:'campaignform',assets:'assetform'};
    if(key){addRouting($(map[key]),key);const existing=existingDrafts(key);if(existing)$('main').append(existing);$('main').append(submissionsPanel(key));}
    if(view==='daily'){
      const section=document.createElement('section');section.className='card';section.style.marginTop='22px';section.innerHTML='<h2>Submit daily report to Head</h2><form id="route-daily" style="margin-top:16px"></form>';$('main').append(section);addRouting($('route-daily'),'daily',()=>({...state.report}),false);$('main').append(submissionsPanel('daily'));
    }
    if(view==='settings')$('main').prepend(contactsPanel());
    // Preserve truthful scope: only submitted copies are shared; old module drafts are local.
    const footer=$('main').querySelector('.footer');if(footer){footer.lastElementChild.textContent='Local drafts · Shared submissions';$('main').append(footer);}
    if(view==='requisitions'){const hint=$('reqform').querySelector('p.small');if(hint)hint.textContent='Save a local draft, or submit a copy to the selected Head’s inbox.';}
  };
  editRecord=function(key,index=-1){originalEditor(key,index);if(key!=='employees')addRouting($('recordeditor'),key);};
  const previousShareWA=shareWA,previousShareEmail=shareEmail;
  shareWA=function(){if(!['todo','daily'].includes(view)){previousShareWA();return;}shareCurrent(false);};
  shareEmail=function(){if(!['todo','daily'].includes(view)){previousShareEmail();return;}shareCurrent(true);};
  function shareCurrent(email){
    ensureDialog();$('dialogBody').innerHTML='<div class="cardtitle"><h2>Choose report recipient</h2><button type="button" id="close-route">×</button></div>';
    const w=widget('share-current');$('dialogBody').append(w.box);const b=document.createElement('button');b.textContent=email?'Open email draft':'Open WhatsApp message';b.className=email?'primary':'green';b.onclick=()=>{const h=w.head();if(!h){toast('Select a recipient first.');return;}if(email)location.href='mailto:'+encodeURIComponent(h.email)+'?subject='+encodeURIComponent(view==='todo'?'Morning work plan':'Daily report')+'&body='+encodeURIComponent(reportText());else openWhatsApp(h,reportText());};$('dialogBody').append(b);$('close-route').onclick=closeEditor;$('adminDialog').showModal();
  }
  async function loadData(redraw=false){
    try{
      const [d,s]=await Promise.all([api.rpc('staff_directory'),api.from('work_submissions').select('*').order('created_at',{ascending:false}).limit(100)]);
      if(d.error)throw d.error;if(s.error)throw s.error;directory=d.data||[];submissions=s.data||[];ready=true;failure='';
    }catch(e){failure=errorText(e);toast('Reporting contacts could not load: '+failure);}
    if(redraw)render();
  }
  if(!state.modules.some(m=>m.id==='inbox')){state.modules.push({id:'inbox',name:'Inbox & sent',icon:'✉',visible:true,order:state.modules.length,custom:false});persist();}
  // Avoid today's form default pointing to the old demonstration date.
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'});planDate=today;
  loadData().then(()=>go(view));
})();
