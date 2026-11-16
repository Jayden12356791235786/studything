const config=window.FIREBASE_CONFIG;
const Cloud={configured:false,uid:null,db:null,auth:null};
let initializeApp,getAuth,signInAnonymously,onAuthStateChanged,getFirestore,collection,doc,getDoc,setDoc,updateDoc,addDoc,query,where,onSnapshot,runTransaction,serverTimestamp;
window.CloudReady=(async()=>{try{if(config?.apiKey&&config?.projectId){const [appSdk,authSdk,dbSdk]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js')]);({initializeApp}=appSdk);({getAuth,signInAnonymously,onAuthStateChanged}=authSdk);({getFirestore,collection,doc,getDoc,setDoc,updateDoc,addDoc,query,where,onSnapshot,runTransaction,serverTimestamp}=dbSdk);const app=initializeApp(config);Cloud.auth=getAuth(app);Cloud.db=getFirestore(app);Cloud.configured=true;await new Promise(resolve=>{const stop=onAuthStateChanged(Cloud.auth,u=>{Cloud.uid=u?.uid||null;stop();resolve()})})}}catch(e){Cloud.loadError=e}return Cloud})();
Cloud.restoreProfile=async()=>{if(!Cloud.configured)return null;if(!Cloud.auth.currentUser) return null;const s=await getDoc(doc(Cloud.db,'users',Cloud.auth.currentUser.uid));return s.exists()?s.data():null};
Cloud.register=async(username)=>{
 if(!Cloud.configured)throw new Error('Online play is not connected yet.');
 if(!Cloud.auth.currentUser)await signInAnonymously(Cloud.auth);
 Cloud.uid=Cloud.auth.currentUser.uid;
 const clean=username.trim(),key=clean.toLowerCase(),keyRef=doc(Cloud.db,'usernames',key),userRef=doc(Cloud.db,'users',Cloud.uid);
 await runTransaction(Cloud.db,async tx=>{
   const [taken,profile]=await Promise.all([tx.get(keyRef),tx.get(userRef)]);
   if(profile.exists()&&profile.data().username!==clean)throw new Error('This browser already has a different username. Use that name to continue.');
   if(taken.exists()&&taken.data().uid!==Cloud.uid)throw new Error('That username is already taken. Try a different one.');
   if(!taken.exists())tx.set(keyRef,{uid:Cloud.uid,username:clean});
   tx.set(userRef,{uid:Cloud.uid,username:clean,createdAt:serverTimestamp()},{merge:true});
 });
 return {username:clean,uid:Cloud.uid};
};
Cloud.listenInvites=(callback)=>{
 if(!Cloud.configured||!Cloud.uid)return()=>{};
 return onSnapshot(query(collection(Cloud.db,'invitations'),where('toUid','==',Cloud.uid)),snap=>callback(snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status==='pending')));
};
Cloud.createRoom=async({subject,week,questions,inviteNames})=>{
 if(!Cloud.uid)throw new Error('Choose a username first.');
 const invitees=[];
 for(const name of inviteNames){const key=name.toLowerCase(),user=await getDoc(doc(Cloud.db,'usernames',key));if(!user.exists())throw new Error('No player found with username @'+name+'. Check the spelling.');if(user.data().uid===Cloud.uid)throw new Error('You cannot invite your own username.');if(!invitees.some(x=>x.uid===user.data().uid))invitees.push({uid:user.data().uid,username:user.data().username})}
 if(!invitees.length)throw new Error('Add at least one friend username.');
 if(invitees.length>9)throw new Error('Brainwave Battle has a 10-player maximum, including you. Invite up to 9 friends.');
 const ref=doc(collection(Cloud.db,'rooms'));
 const room={hostUid:Cloud.uid,subject,week,questions,memberUids:[Cloud.uid],inviteUids:[...invitees.map(x=>x.uid)],members:[{uid:Cloud.uid,username:localStorage.jccusername,score:0}],status:'lobby',currentIndex:0,lastAnswer:null,createdAt:serverTimestamp()};
 await setDoc(ref,room);
 for(const player of invitees)await addDoc(collection(Cloud.db,'invitations'),{roomId:ref.id,fromUid:Cloud.uid,fromName:localStorage.jccusername,toUid:player.uid,toName:player.username,subjectName:subject,status:'pending',createdAt:serverTimestamp()});
 return {id:ref.id};
};
Cloud.listenRoom=(id,callback)=>onSnapshot(doc(Cloud.db,'rooms',id),snap=>callback(snap.exists()?{id:snap.id,...snap.data()}:null));
Cloud.acceptInvite=async(inviteId)=>{
 let roomId;
 await runTransaction(Cloud.db,async tx=>{
  const invRef=doc(Cloud.db,'invitations',inviteId),inv=await tx.get(invRef);
  if(!inv.exists()||inv.data().toUid!==Cloud.uid||inv.data().status!=='pending')throw new Error('This invite is no longer available.');
  roomId=inv.data().roomId;const roomRef=doc(Cloud.db,'rooms',roomId),room=await tx.get(roomRef);
  if(!room.exists())throw new Error('That quiz room has closed.');
  const r=room.data(),member={uid:Cloud.uid,username:localStorage.jccusername,score:0};
  if(r.status!=='lobby')throw new Error('This quiz has already started.');
  if(!r.memberUids.includes(Cloud.uid)){if(r.members.length>=10)throw new Error('This quiz already has its maximum of 10 players.');tx.update(roomRef,{memberUids:[...r.memberUids,Cloud.uid],members:[...r.members,member]})}
  tx.update(invRef,{status:'accepted'});
 });
 return {id:roomId};
};
Cloud.start=async id=>{const ref=doc(Cloud.db,'rooms',id),s=await getDoc(ref);if(!s.exists()||s.data().hostUid!==Cloud.uid)throw new Error('Only the quiz host can start.');if(s.data().members.length<2)throw new Error('Wait for at least one friend to join.');await updateDoc(ref,{status:'playing'})};
Cloud.answer=async(id,answer)=>{
 const ref=doc(Cloud.db,'rooms',id);
 await runTransaction(Cloud.db,async tx=>{
  const snap=await tx.get(ref),r=snap.data(),members=r.members||[],q=r.questions[r.currentIndex];
  if(r.status!=='playing'||members[r.currentIndex%members.length]?.uid!==Cloud.uid)throw new Error('It is not your turn.');
  const correct=answer===q.a,uid=Cloud.uid,username=members[r.currentIndex%members.length].username;
  const updated=members.map(m=>m.uid===uid?{...m,score:(m.score||0)+(correct?1:0)}:m);
  tx.update(ref,{members:updated,status:'revealed',lastAnswer:{username,correct,answer}});
 });
};
Cloud.advance=async id=>{
 const ref=doc(Cloud.db,'rooms',id);
 await runTransaction(Cloud.db,async tx=>{const s=await tx.get(ref),r=s.data(),n=r.currentIndex+1;tx.update(ref,n>=r.questions.length?{status:'finished'}:{currentIndex:n,status:'playing',lastAnswer:null})});
};
window.CloudReady=Promise.resolve(Cloud);
const $=s=>document.querySelector(s),subjects=window.CatchupSubjects,scheme=window.SYLLABUS;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const who=()=>localStorage.getItem('jccusername');
const rosterFor=(v,w)=>{
  const chosen=v==='all'?subjects:[subjects[+v]],list=[];
  for(const sub of chosen){
    const calendar=scheme.find(x=>x.subject===sub[0]);if(!calendar)continue;
    const nums=w==='all'?calendar.weeks.map((_,i)=>i+1):[+w];
    for(const n of nums){
      const topic=calendar.weeks[n-1];if(!topic||/break|assessment|examination|revision|review|closing|not listed|practical session|test week/i.test(topic))continue;
      const wrong=calendar.weeks.filter((x,i)=>i!==n-1&&!/break|assessment|examination|revision|review|closing|not listed|practical session|test week/i.test(x));
      const opts=[topic,...wrong.sort(()=>Math.random()-.5).slice(0,3)].sort(()=>Math.random()-.5);
      list.push({sub:sub[0],icon:sub[1],q:'Which topic does '+sub[0]+' cover in Week '+n+'?',why:'The scheme lists “'+topic+'” for Week '+n+'. Use this as a guide to the lesson in your class notes.',opts,a:opts.indexOf(topic)});
    }
  }
  return list;
};
function questionSet(v,w){
 const bank=window.CHALLENGE_BANK||{};
 const toQuiz=(name,rows)=>{const s=subjects.find(x=>x[0]===name);return (rows||[]).map(q=>({sub:name,icon:s?.[1]||'✦',q:q[0],why:q[1],opts:q[2],a:q[3]}))};
 const unique=rows=>[...new Map(rows.map(q=>[q.q,q])).values()];let content;
 if(v==='all'){content=Object.entries(bank).flatMap(([name,rows])=>toQuiz(name,rows));for(const s of window.EXTRA_SUBJECTS||[]){const old=content.filter(q=>q.sub===s[0]);content=content.filter(q=>q.sub!==s[0]);content.push(...unique([...old,...toQuiz(s[0],s[5])]))}}
 else{const name=subjects[+v][0],extra=(window.EXTRA_SUBJECTS||[]).find(s=>s[0]===name);content=unique([...toQuiz(name,bank[name]),...toQuiz(name,extra?.[5]||[])])}
 const scheduled=w==='all'?[]:rosterFor(v,w).slice(0,1);
 let qs=[...content,...scheduled];
 if(!qs.length)qs=content;
 return qs.sort(()=>Math.random()-.5).slice(0,10);
}
function runSolo(){
 let qs=questionSet($('#quizSubject').value,$('#quizWeek').value),i=0,score=0,locked=false,box=$('#quizbox');
 if(!qs.length){box.classList.remove('hide');box.innerHTML='<div class="qbox"><h3>No quiz topic for this week</h3><p>The scheme marks this week as a break, assessment or review. Choose a teaching week to revise a topic.</p></div>';return}
 box.classList.remove('hide');
 const draw=()=>{
  locked=false;let q=qs[i];
  box.innerHTML='<div class="qbox"><small>'+q.icon+' '+q.sub+' · QUESTION '+(i+1)+'/'+qs.length+' · '+score+' CORRECT</small><h3>'+q.q+'</h3><div class="answers">'+q.opts.map((x,j)=>'<button data-a="'+j+'">'+String.fromCharCode(65+j)+'. '+x+'</button>').join('')+'</div><div id="feedback"></div></div>';
  box.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{
   if(locked)return;locked=true;let selected=+b.dataset.a,ok=selected===q.a;
   box.querySelectorAll('[data-a]').forEach((x,j)=>{if(j===q.a)x.classList.add('correct');if(j===selected&&!ok)x.classList.add('wrong')});
   if(ok){score++;let xp=+(localStorage.jccxp||0)+10;localStorage.jccxp=xp;$('#xp').textContent=xp;$('#xp2').textContent=xp}
   $('#feedback').innerHTML='<p>'+(ok?'✓ Correct! +10 XP':'Not quite.')+' '+q.why+'</p><button class="primary" id="soloNext">'+(i===qs.length-1?'See results':'Next question →')+'</button>';
   $('#soloNext').onclick=()=>{i++;if(i<qs.length)draw();else{let pct=Math.round(score/qs.length*100);localStorage.jccbest=Math.max(+(localStorage.jccbest||0),pct);$('#best').textContent=localStorage.jccbest+'%';box.innerHTML='<div class="qbox" style="text-align:center"><h2>'+(pct>=80?'🏆 Brilliant work!':pct>=50?'🌟 Good progress!':'💪 Keep going!')+'</h2><p>You got '+score+' out of '+qs.length+' correct ('+pct+'%).</p></div>'}}
  })
 };
 draw();
}
$('#begin').onclick=runSolo;
function syncQuizWeeks(subjectSelect,weekSelect){const v=subjectSelect.value,chosen=v==='all'?scheme: [scheme[+v]].filter(Boolean),max=Math.max(...chosen.map(x=>x.weeks.length),1),previous=weekSelect.value;weekSelect.innerHTML='<option value="all">Whole term</option>'+Array.from({length:max},(_,i)=>'<option value="'+(i+1)+'">Week '+(i+1)+'</option>').join('');weekSelect.value=+previous<=max?previous:'all'}
syncQuizWeeks($('#quizSubject'),$('#quizWeek'));syncQuizWeeks($('#battleSubject'),$('#battleWeek'));
$('#quizSubject').onchange=()=>syncQuizWeeks($('#quizSubject'),$('#quizWeek'));
$('#battleSubject').onchange=()=>syncQuizWeeks($('#battleSubject'),$('#battleWeek'));
$('#weekSelect').onchange=()=>{window.CatchupSetWeek?.($('#weekSelect').value)};
function welcomeDone(name){
 localStorage.setItem('jccusername',name);$('#welcome').classList.add('hide');$('#signedInAs').textContent='@'+name;$('#profileButton').textContent=name.slice(0,1).toUpperCase();$('#avatarTop').textContent=name.slice(0,1).toUpperCase();$('#profileButton').title='@'+name;$('#title').textContent='Ready to learn, '+name+'.';
}
$('#usernameForm').onsubmit=async e=>{
 e.preventDefault();const name=$('#usernameInput').value.trim();$('#usernameMessage').textContent='Saving your username…';
 try{await window.CloudReady;if(Cloud.loadError)throw new Error('Online setup could not load. Check your internet connection and try again.');if(Cloud.configured){await Cloud.register(name);if(stopInbox)stopInbox();stopInbox=Cloud.listenInvites(paintInbox)}welcomeDone(name);$('#cloudHint').textContent=Cloud.configured?'Connected! Invite friends by their username.':'This username is saved on this device. Online play needs the shared site setup.'}
 catch(err){$('#usernameMessage').textContent=err.message||'That username could not be saved.'}
};
if(who()){$('#usernameInput').value=who();$('#signedInAs').textContent='@'+who();$('#profileButton').textContent=who().slice(0,1).toUpperCase();$('#welcome').classList.add('hide')}

let stopInbox=null,stopRoom=null;
function paintInbox(rows){
 const box=$('#inbox');box.innerHTML=rows.length?'<h4>📨 Quiz invites</h4>':'<p>No quiz invites yet.</p>';
 for(const invite of rows){let row=document.createElement('div');row.className='invite-row';row.innerHTML='<span><b>@'+safe(invite.fromName)+'</b> invited you to '+safe(invite.subjectName)+'</span><button>Join →</button>';row.querySelector('button').onclick=async()=>{try{await Cloud.acceptInvite(invite.id);openRoom(invite.roomId)}catch(e){$('#cloudHint').textContent=e.message}};box.appendChild(row)}
}
function openRoom(id){if(stopRoom)stopRoom();$('#roomPanel').classList.remove('hide');stopRoom=Cloud.listenRoom(id,room=>paintRoom(room))}
function paintRoom(room){
 if(!room)return;const panel=$('#roomPanel'),members=room.members||[],myUid=Cloud.uid;
 if(room.status==='lobby'){panel.innerHTML='<h3>🌐 '+safe(room.subject)+' · '+(room.week==='all'?'Whole term':'Week '+safe(room.week))+'</h3><p>'+members.length+'/10 players · '+members.map(m=>'@'+safe(m.username)).join(', ')+(members.length<2?' · waiting for a friend':'')+'</p>'+(room.hostUid===myUid?'<button class="primary" id="startOnline">Start quiz →</button>':'<p>The host will start when everyone is ready.</p>');const b=$('#startOnline');if(b)b.onclick=async()=>{try{await Cloud.start(room.id)}catch(e){$('#cloudHint').textContent=e.message}};return}
 if(room.status==='revealed'){const q=room.questions[room.currentIndex],la=room.lastAnswer;panel.innerHTML='<small>QUESTION '+(room.currentIndex+1)+' / '+room.questions.length+'</small><h3>'+safe(q.q)+'</h3><p>'+safe(la.username)+' '+(la.correct?'got it right!':'missed that one.')+' '+safe(q.why)+'</p><p>Score: '+members.map(m=>'@'+safe(m.username)+' '+(m.score||0)).join(' · ')+'</p><button class="primary" id="advanceOnline">Next →</button>';$('#advanceOnline').onclick=()=>Cloud.advance(room.id);return}
 if(room.status==='finished'){let winner=[...members].sort((a,b)=>(b.score||0)-(a.score||0))[0];panel.innerHTML='<h2>🏆 '+(winner?'@'+safe(winner.username)+' wins!':'Quiz complete!')+'</h2><p>'+members.map(m=>'@'+safe(m.username)+': '+(m.score||0)).join(' · ')+'</p>';return}
 const q=room.questions[room.currentIndex],active=members[room.currentIndex%members.length];panel.innerHTML='<small>🎮 BRAINWAVE BATTLE · QUESTION '+(room.currentIndex+1)+'/'+room.questions.length+' · '+members.map(m=>'@'+safe(m.username)+' '+(m.score||0)).join(' · ')+'</small><h3>'+safe(q.q)+'</h3>'+(active?.uid===myUid?'<p>Your turn!</p><div class="answers">'+q.opts.map((x,j)=>'<button data-answer="'+j+'">'+String.fromCharCode(65+j)+'. '+safe(x)+'</button>').join('')+'</div>':'<p>Waiting for @'+safe(active?.username||'player')+' to answer…</p>');
 panel.querySelectorAll('[data-answer]').forEach(b=>b.onclick=async()=>{try{await Cloud.answer(room.id,+b.dataset.answer)}catch(e){$('#cloudHint').textContent=e.message}});
}
$('#createRoom').onclick=async()=>{
 try{
  if(!Cloud.configured)throw new Error('Online play needs the shared website connection set up first.');
  if(!who())throw new Error('Choose your username first.');
  const names=$('#inviteNames').value.split(',').map(x=>x.trim()).filter(Boolean);
  const subjectValue=$('#battleSubject').value,subject=subjectValue==='all'?'All subjects':subjects[+subjectValue][0],w=$('#battleWeek').value,questions=questionSet(subjectValue,w);
  if(!questions.length)throw new Error('The selected week is a break, assessment or review. Choose a teaching week for this quiz.');
  const room=await Cloud.createRoom({subject,week:w,questions,inviteNames:names});openRoom(room.id);$('#cloudHint').textContent='Invite sent! Waiting for your friends to join.';
 }catch(e){$('#cloudHint').textContent=e.message||'Could not start that quiz.'}
};
window.CloudReady.then(async()=>{
 if(!Cloud.configured){$('#cloudHint').textContent='Online play setup needed once: connect Firebase, then share the hosted link.';return}
 const profile=await Cloud.restoreProfile();
 if(profile){welcomeDone(profile.username);$('#cloudHint').textContent='Connected! Invite friends by their username.'}
 else{$('#welcome').classList.remove('hide');$('#usernameMessage').textContent='Choose a username for online quizzes.'}
 stopInbox=Cloud.listenInvites(paintInbox)
}).catch(e=>{$('#cloudHint').textContent='Could not connect. Check your internet or the site setup.';console.error(e)});
