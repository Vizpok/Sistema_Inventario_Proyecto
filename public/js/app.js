/* Comportamiento general: menú móvil, tema claro/oscuro y confirmaciones. */
(function () {
  const raiz = document.documentElement;

  // Tema: alterna entre claro y oscuro y lo recuerda en este navegador
  document.querySelectorAll('[data-tema]').forEach((b) => b.addEventListener('click', () => {
    const oscuro = raiz.dataset.theme
      ? raiz.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    raiz.dataset.theme = oscuro ? 'light' : 'dark';
    try { localStorage.setItem('tema', raiz.dataset.theme); } catch (e) { /* sin almacenamiento */ }
    document.dispatchEvent(new Event('tema-cambiado'));
  }));

  // Menú lateral en pantallas pequeñas
  document.querySelectorAll('[data-abrir-menu]').forEach((b) => b.addEventListener('click', () => document.body.classList.add('menu-abierto')));
  document.querySelectorAll('[data-cerrar-menu]').forEach((b) => b.addEventListener('click', () => document.body.classList.remove('menu-abierto')));

  // Confirmación antes de acciones sensibles: <form data-confirmar="¿Seguro?">
  document.querySelectorAll('form[data-confirmar]').forEach((f) => f.addEventListener('submit', (e) => {
    if (!window.confirm(f.dataset.confirmar)) e.preventDefault();
  }));

  // Filtros que se envían al cambiar un select: <select data-auto-enviar>
  document.querySelectorAll('[data-auto-enviar]').forEach((s) => s.addEventListener('change', () => s.form.submit()));
})();
