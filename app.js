const form = document.querySelector('#tax-form');
const result = document.querySelector('#result-content');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const region = document.querySelector('#region').value;
  if (!region) {
    document.querySelector('#region').focus();
    return;
  }

  result.className = 'result-placeholder result-message';
  const calculation = document.querySelector('#calculation').value;
  const explanation = calculation === 'retencion'
    ? 'La AEAT actualizó su algoritmo de retenciones con efectos desde el 10 de septiembre de 2026. Estamos validando los datos necesarios del perceptor antes de habilitar este cálculo.'
    : 'La cuota anual requiere aplicar las reglas estatales y territoriales de 2026, además de conocer las circunstancias del contribuyente. Estamos validando ese alcance antes de habilitar este cálculo.';
  result.replaceChildren();
  const icon = document.createElement('span');
  icon.className = 'result-spark';
  icon.textContent = '✳';
  const message = document.createElement('p');
  message.textContent = explanation;
  result.append(icon, message);

  if (calculation === 'retencion') {
    const link = document.createElement('a');
    link.href = 'https://www2.agenciatributaria.gob.es/wlpl/PRET-R200/R261/index.zul';
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Abrir el cálculo oficial de retenciones de la AEAT ↗';
    link.className = 'official-link';
    result.append(link);
  }
});
