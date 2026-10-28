document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-admin-question-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      if (!window.confirm('Salvar a pergunta e a recomendação deste item?')) {
        event.preventDefault();
        return;
      }

      const button = form.querySelector('button[type="submit"]');
      if (button) {
        button.disabled = true;
        button.textContent = 'Salvando...';
      }
    });
  });
});
