/* WEATHER: P.weather.set(key) swaps the animated weather behind/around the
   player. Configs + sheets come from the growtopia-weather package; the
   renderer itself is driven by app.js every frame. */
(function(){
  const el = P.$('#weather');
  let current = null;

  P.weather = {
    get key() { return current; },
    set(name) {
      current = name;
      el.dataset.w = name;
      P.store.set('weather', name);
      P.emit('weather', name);
    }
  };

  /* restore last selection (do not auto-download heavy configs yet) */
  const saved = P.store.get('weather', 'none');
  el.dataset.w = saved;
  current = saved;
})();
