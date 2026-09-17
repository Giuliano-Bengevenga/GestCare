document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-admin-protocol-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      if (!window.confirm('Salvar as alterações deste protocolo?')) {
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
