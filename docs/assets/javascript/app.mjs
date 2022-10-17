function main() {
  Array.from(document.querySelectorAll('#header nav a'), function markActive(el) {
    if (location.pathname.startsWith(el.getAttribute('href'))) {
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
    }
  }

  let colorScheme = 'os-default';
  try {
    colorScheme = localStorage.getItem('color-scheme');
  } catch (e) {}
  switchColorScheme(colorScheme);

  Array.from(document.querySelectorAll('#j-color-scheme'), function bind(el) {
    el.addEventListener('change', function onChange(e) {
      const value = e.target.value;
      switchColorScheme(value);
    });
    const selected = el.querySelector(`option[value="${colorScheme}"]`);
    if (selected) selected.selected = true;
  });
}

main();
