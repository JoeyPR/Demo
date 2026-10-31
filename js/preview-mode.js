/* One scene: passive outfit inspection or an interactive live preview. */
(function(){
  const button=document.createElement('button');
  button.id='preview-mode-toggle';button.type='button';
  button.setAttribute('aria-pressed','false');
  const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');
  const label=document.createElement('span');button.append(icon,label);document.body.append(button);
  function position(){
    const rect=document.getElementById('pv').getBoundingClientRect();
    button.style.left=Math.max(0,rect.left)+8+'px';
    button.style.top=Math.max(0,rect.top)+8+'px';
  }
  function sync(){
    const live=!!P.previewMode?.live;
    document.body.classList.toggle('live-preview',live);
    button.disabled=!P.previewMode;
    button.setAttribute('aria-pressed',String(live));
    button.setAttribute('aria-label',live?'Return to Preview':'Start Live Preview');
    icon.textContent=live?'■':'▶';label.textContent=live?'Preview':'Live Preview';
    position();
  }
  button.addEventListener('click',()=>{P.previewMode?.setLive(!P.previewMode.live);button.blur();});
  P.on('preview-mode',sync);P.on('boot',sync);P.on('preview',position);
  addEventListener('resize',position);sync();
})();
