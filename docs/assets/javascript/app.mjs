function main() {
  Array.from(document.querySelectorAll('#header nav a'), function markActive(el) {
    if (location.pathname.startsWith(el.getAttribute('href'))) {
      el.classList.add('active');
      const trigger = el.closest('.dropdown-trigger');
      if (trigger) trigger.classList.add('active');
    }
  });
}

main();
