(()=>{
 const form=document.querySelector('#usernameForm');
 const nameInput=document.querySelector('#usernameInput');
 const welcome=document.querySelector('#welcome');
 const message=document.querySelector('#usernameMessage');
 const enter=(name)=>{
  localStorage.setItem('jccusername',name);
  welcome.classList.add('hide');
  document.querySelector('#signedInAs').textContent='@'+name;
  document.querySelector('#profileButton').textContent=name.slice(0,1).toUpperCase();
  document.querySelector('#avatarTop').textContent=name.slice(0,1).toUpperCase();
  document.querySelector('#title').textContent='Ready to learn, '+name+'.';
  document.querySelector('#cloudHint').textContent='Username saved on this device. Online play needs the shared site setup.';
 };
 const saved=localStorage.getItem('jccusername');
 if(saved){nameInput.value=saved;welcome.classList.add('hide');document.querySelector('#signedInAs').textContent='@'+saved;document.querySelector('#profileButton').textContent=saved.slice(0,1).toUpperCase();document.querySelector('#avatarTop').textContent=saved.slice(0,1).toUpperCase();document.querySelector('#title').textContent='Ready to learn, '+saved+'.'}
 form.addEventListener('submit',event=>{
  if(window.CloudReady)return;
  event.preventDefault();
  const name=nameInput.value.trim();
  if(!/^[A-Za-z0-9_]{3,18}$/.test(name)){message.textContent='Use 3–18 letters, numbers or underscores.';return}
  enter(name);
 });
})();
