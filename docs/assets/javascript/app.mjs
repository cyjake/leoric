function main() {
  Array.from(document.querySelectorAll('#header nav a'), function markActive(el) {
    if (location.pathname.replace(/\/$/, '') === el.getAttribute('href')) {
      el.classList.add('active');
      const trigger = el.closest('.dropdown-trigger');
      if (trigger) trigger.classList.add('active');
    }
  });

  const colorSchemes = ['os-default', 'light', 'dark'];

  function switchColorScheme(value) {
    if (colorSchemes.includes(value)) {
      document.documentElement.classList.remove(...colorSchemes);
      document.documentElement.classList.add(value);
      try {
        localStorage.setItem('color-scheme', value);
      } catch (e) {}
      // Update toggle button active states
      Array.from(document.querySelectorAll('.color-scheme-toggle button'), function(btn) {
        btn.classList.toggle('active', btn.value === value);
      });
    }
  }

  let colorScheme = 'os-default';
  try {
    colorScheme = localStorage.getItem('color-scheme') || 'os-default';
  } catch (e) {}
  switchColorScheme(colorScheme);

  Array.from(document.querySelectorAll('.color-scheme-toggle'), function bind(el) {
    el.addEventListener('click', function onClick(e) {
      const btn = e.target.closest('button');
      if (btn) switchColorScheme(btn.value);
    });
  });
}

main();
