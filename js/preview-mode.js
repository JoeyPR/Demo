/* One scene: passive outfit inspection or an interactive live preview. */
(function(){
  const button=document.createElement('button');
  button.id='preview-mode-toggle';button.type='button';
  button.setAttribute('aria-pressed','false');
  const icon=document.createElement('span');
  icon.className='preview-mode-icon';
  icon.setAttribute('aria-hidden','true');
  button.append(icon);document.body.append(button);
  function position(){
    const rect=document.getElementById('pv').getBoundingClientRect();
    button.style.left=Math.max(0,rect.left)+8+'px';
    button.style.top=Math.max(0,rect.top)+8+'px';
    const hud=document.getElementById('hud');
    if(hud){
      hud.style.removeProperty('left');hud.style.removeProperty('top');
      const status=hud.getBoundingClientRect(),control=button.getBoundingClientRect();
      if(status.right>control.left&&status.left<control.right&&status.bottom>control.top&&status.top<control.bottom){
        hud.style.left=control.right+8+'px';hud.style.top=control.top+'px';
      }
    }
  }
  function sync(){
    const live=!!P.previewMode?.live;
    document.body.classList.toggle('live-preview',live);
    button.disabled=!P.previewMode;
    button.setAttribute('aria-pressed',String(live));
    button.setAttribute('aria-label',live?'Pause Live Preview':'Start Live Preview');
    button.title=live?'Pause Live Preview':'Start Live Preview';
    icon.textContent=live?'':'>';
    position();
  }
  button.addEventListener('click',()=>{P.previewMode?.setLive(!P.previewMode.live);button.blur();});
  P.on('preview-mode',sync);P.on('boot',sync);P.on('preview',position);
  addEventListener('resize',position);sync();
})();
