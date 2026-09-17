(() => {
  let installPrompt = null;

  const isStandalone = () => (
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  );

  const isIos = () => /iPad|iPhone|iPod/.test(window.navigator.userAgent) || (
    window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1
  );

  function showInstallFeedback(message) {
    const previousFeedback = document.querySelector('[data-install-feedback]');
    if (previousFeedback) previousFeedback.remove();

    const feedback = document.createElement('p');
    feedback.className = 'install-app-feedback';
    feedback.dataset.installFeedback = '';
    feedback.setAttribute('role', 'status');
    feedback.textContent = message;
    document.body.append(feedback);
    window.setTimeout(() => feedback.remove(), 7000);
  }

  function getInstallButton() {
    return document.querySelector('[data-install-app]');
  }

  function removeInstallButton() {
    getInstallButton()?.remove();
  }

  async function requestInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      installPrompt = null;

      if (choice.outcome === 'accepted') {
        removeInstallButton();
      }
      return;
    }

    if (isIos()) {
      showInstallFeedback('No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.');
      return;
    }

    showInstallFeedback('Abra o menu do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”.');
  }

  function addInstallButton() {
    if (isStandalone() || getInstallButton()) return;

    const header = document.querySelector('.header');
    if (!header) return;

    const button = document.createElement('button');
    button.className = 'install-app-button';
    button.type = 'button';
    button.dataset.installApp = '';
    button.textContent = 'Instalar app';
    button.addEventListener('click', requestInstall);

    const actions = header.querySelector('.usuario');
    (actions || header).append(button);
  }

  function setupInlineValidation() {
    let formCounter = 0;

    function errorKey(control) {
      const form = control.form;
      if (form && !form.dataset.clientValidationId) {
        form.dataset.clientValidationId = `form-${formCounter += 1}`;
      }
      return `${form?.dataset.clientValidationId || 'form'}-${control.name || control.id}`;
    }

    function errorTarget(control) {
      return ['radio', 'checkbox'].includes(control.type)
        ? control.closest('fieldset') || control.parentElement
        : control;
    }

    function clearError(control) {
      const message = document.querySelector(`[data-client-field-error="${errorKey(control)}"]`);
      message?.remove();
    }

    function showError(control) {
      if (!control.name || control.validity.valid) return;

      clearError(control);
      const message = document.createElement('p');
      message.className = 'field-error';
      message.dataset.clientFieldError = errorKey(control);
      message.textContent = control.validationMessage || 'Revise este campo.';
      errorTarget(control)?.insertAdjacentElement('afterend', message);
    }

    document.addEventListener('invalid', (event) => showError(event.target), true);
    document.addEventListener('input', (event) => clearError(event.target));
    document.addEventListener('change', (event) => clearError(event.target));
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    addInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    removeInstallButton();
    showInstallFeedback('GestCare instalado com sucesso.');
  });

  window.addEventListener('DOMContentLoaded', addInstallButton);
  window.addEventListener('DOMContentLoaded', setupInlineValidation);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch((error) => {
        console.warn('Não foi possível registrar o modo offline.', error);
      });
    });
  }
})();
