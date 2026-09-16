document.addEventListener('DOMContentLoaded', () => {
  const exclusiveOptions = new Set(['Nenhuma', 'Não tive gestação anterior', 'Nenhuma complicação']);

  document.querySelectorAll('.risk-options input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', () => {
      const group = document.querySelectorAll(`input[name="${input.name}"]`);

      if (exclusiveOptions.has(input.value) && input.checked) {
        group.forEach((option) => {
          if (option !== input) option.checked = false;
        });
        return;
      }

      if (input.checked) {
        group.forEach((option) => {
          if (exclusiveOptions.has(option.value)) option.checked = false;
        });
      }
    });
  });
});
