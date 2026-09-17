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

  const form = document.querySelector('[data-risk-form]');
  if (!form) return;

  const steps = [...form.querySelectorAll('[data-risk-step]')];
  const progressLabel = form.querySelector('[data-risk-progress]');
  const progressBar = form.querySelector('[data-risk-progress-bar]');
  let currentStep = Number(form.dataset.initialStep) || 1;

  function clearCheckboxGroupError(group) {
    group.forEach((input) => input.setCustomValidity(''));
  }

  function validateCheckboxGroups(step) {
    const checkboxGroups = new Map();
    step.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      const group = checkboxGroups.get(input.name) || [];
      group.push(input);
      checkboxGroups.set(input.name, group);
    });

    for (const group of checkboxGroups.values()) {
      clearCheckboxGroupError(group);
      if (!group.some((input) => input.checked)) {
        group[0].setCustomValidity('Selecione ao menos uma opção.');
        group[0].reportValidity();
        return false;
      }
    }

    return true;
  }

  function validateStep(step) {
    if (!validateCheckboxGroups(step)) return false;

    const invalidControl = [...step.querySelectorAll('input, select, textarea')]
      .find((control) => !control.checkValidity());

    if (invalidControl) {
      invalidControl.reportValidity();
      return false;
    }

    return true;
  }

  function setStep(stepNumber, moveFocus = true) {
    currentStep = stepNumber;
    steps.forEach((step) => {
      const isActive = Number(step.dataset.riskStep) === currentStep;
      step.hidden = !isActive;
      step.setAttribute('aria-hidden', String(!isActive));
    });

    if (progressLabel) {
      progressLabel.textContent = `Etapa ${currentStep} de ${steps.length}`;
    }

    if (progressBar) {
      progressBar.style.width = `${(currentStep / steps.length) * 100}%`;
    }

    if (moveFocus) {
      const heading = steps[currentStep - 1]?.querySelector('h3');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    }
  }

  form.querySelector('[data-risk-next]')?.addEventListener('click', () => {
    const current = steps[currentStep - 1];
    if (validateStep(current)) setStep(currentStep + 1);
  });

  form.querySelector('[data-risk-back]')?.addEventListener('click', () => {
    setStep(currentStep - 1);
  });

  form.addEventListener('submit', (event) => {
    const current = steps[currentStep - 1];
    if (currentStep < steps.length) {
      event.preventDefault();
      if (validateStep(current)) setStep(currentStep + 1);
      return;
    }

    if (!validateStep(current)) event.preventDefault();
  });

  form.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', () => {
      const group = [...form.querySelectorAll(`input[name="${input.name}"]`)];
      clearCheckboxGroupError(group);
    });
  });

  setStep(currentStep, false);
});
