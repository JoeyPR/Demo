(function(){
  const button=document.createElement('button');button.id='preview-mode-toggle';button.type='button';button.setAttribute('aria-pressed','false');
  const icon=document.createElement('span');icon.className='preview-mode-icon';icon.setAttribute('aria-hidden','true');button.append(icon);document.body.append(button);
  function position(){
    const rect=document.getElementById('pv').getBoundingClientRect(), vv=window.visualViewport;
    const viewLeft=vv?.offsetLeft??0, viewTop=vv?.offsetTop??0, viewRight=viewLeft+(vv?.width??innerWidth), viewBottom=viewTop+(vv?.height??innerHeight);
    const width=button.offsetWidth||32, height=button.offsetHeight||32;
    const left=Math.max(viewLeft+8,Math.min(viewRight-width-8,rect.left+(rect.width-width)/2));
    const top=Math.max(viewTop+8,Math.min(viewBottom-height-8,rect.top-height-8));
    button.style.left=left+'px';button.style.top=top+'px';
    const hud=document.getElementById('hud');if(hud){hud.style.removeProperty('left');hud.style.removeProperty('top');
      const status=hud.getBoundingClientRect(),control=button.getBoundingClientRect();
      if(status.right>control.left&&status.left<control.right&&status.bottom>control.top&&status.top<control.bottom){
        hud.style.left=Math.min(control.right+8,viewRight-status.width-8)+'px';
        hud.style.top=Math.max(viewTop+8,Math.min(control.top,viewBottom-status.height-8))+'px';
      }
    }
  }
  function sync(){const live=!!P.previewMode?.live;document.body.classList.toggle('live-preview',live);button.disabled=!P.previewMode;
    button.setAttribute('aria-pressed',String(live));button.setAttribute('aria-label',live?'Pause Live Preview':'Start Live Preview');
    button.title=live?'Pause Live Preview':'Start Live Preview';icon.textContent=live?'':'>';position();}
  button.addEventListener('click',()=>{P.previewMode?.setLive(!P.previewMode.live);button.blur();});
  P.on('preview-mode',sync);P.on('boot',sync);P.on('preview',position);addEventListener('resize',position);
  window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);sync();
})();
