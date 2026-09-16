document.addEventListener('DOMContentLoaded', () => {
  const copyButton = document.querySelector('[data-copy-access-key]');
  const feedback = document.querySelector('[data-copy-feedback]');

  if (!copyButton || !feedback) {
    return;
  }

  const copyWithFallback = (value) => {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  };

  copyButton.addEventListener('click', async () => {
    const accessKey = copyButton.dataset.copyAccessKey;
    let copied = false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(accessKey);
        copied = true;
      } else {
        copied = copyWithFallback(accessKey);
      }
    } catch (error) {
      copied = copyWithFallback(accessKey);
    }

    feedback.textContent = copied
      ? 'Chave copiada. Agora você pode enviá-la para quem precisa acompanhar a gestação.'
      : 'Não foi possível copiar automaticamente. Selecione a chave e copie manualmente.';
    feedback.classList.toggle('copy-error', !copied);

    if (copied) {
      copyButton.classList.add('copied');
      copyButton.setAttribute('aria-label', 'Chave copiada');
      window.setTimeout(() => {
        copyButton.classList.remove('copied');
        copyButton.setAttribute('aria-label', 'Copiar chave de acesso');
      }, 1800);
    }
  });
});
