const form = document.querySelector('#tax-form');
const result = document.querySelector('#result-content');
const calculationSelect = document.querySelector('#calculation');
const retentionFields = document.querySelector('#retention-fields');
const annualFields = document.querySelector('#annual-fields');
const salaryInput = document.querySelector('#salary');
const contributionsInput = document.querySelector('#contributions');
const shareButton = document.querySelector('#share-site');
const shareStatus = document.querySelector('#share-status');

shareButton.addEventListener('click', async () => {
  const shareData = {
    title: 'Calculadora IRPF 2026 | Cuenta Clara',
    text: 'Calcula una estimación orientativa de tu retención o cuota anual de IRPF.',
    url: `${window.location.origin}${window.location.pathname}`,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      shareStatus.textContent = 'Enlace compartido.';
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareData.url);
    } else {
      const temporaryInput = document.createElement('textarea');
      temporaryInput.value = shareData.url;
      temporaryInput.setAttribute('readonly', '');
      temporaryInput.style.position = 'absolute';
      temporaryInput.style.left = '-9999px';
      document.body.append(temporaryInput);
      temporaryInput.select();
      const copied = document.execCommand('copy');
      temporaryInput.remove();
      if (!copied) throw new Error('No se pudo copiar el enlace.');
    }
    shareStatus.textContent = 'Enlace copiado. Ya puedes compartirlo.';
  } catch (error) {
    if (error.name !== 'AbortError') {
      shareStatus.textContent = 'No se pudo compartir. Copia el enlace desde la barra del navegador.';
    }
  }
});

function updateContributions() {
  contributionsInput.value = TaxEngine2026.estimateEmployeeContributions(Number(salaryInput.value) || 0).toFixed(2);
}

function updateMode() {
  const annual = calculationSelect.value === 'cuota';
  retentionFields.hidden = annual;
  annualFields.hidden = !annual;
  document.querySelector('#result-heading').textContent = annual ? 'CUOTA ANUAL ESTIMADA' : 'RETENCIÓN ESTIMADA';
}

calculationSelect.addEventListener('change', updateMode);
salaryInput.addEventListener('input', updateContributions);
updateContributions();
updateMode();

const euros = (amount) => new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(amount);

function renderResult(title, amount, rows, note, status = '') {
  result.className = 'result-placeholder result-message';
  result.replaceChildren();
  const icon = document.createElement('span');
  icon.className = 'result-spark';
  icon.textContent = '✳';
  const heading = document.createElement('h3');
  heading.className = 'result-title';
  heading.textContent = title;
  result.append(icon, heading);
  if (amount !== null) {
    const figure = document.createElement('p');
    figure.className = 'result-amount';
    figure.textContent = amount;
    result.append(figure);
  }
  if (status) {
    const statusLine = document.createElement('p');
    statusLine.className = 'result-status';
    statusLine.textContent = status;
    result.append(statusLine);
  }
  if (rows.length) {
    const list = document.createElement('dl');
    list.className = 'result-breakdown';
    for (const [label, value] of rows) {
      const term = document.createElement('dt');
      const detail = document.createElement('dd');
      term.textContent = label;
      detail.textContent = value;
      list.append(term, detail);
    }
    result.append(list);
  }
  const disclaimer = document.createElement('p');
  disclaimer.className = 'result-note';
  disclaimer.textContent = note;
  result.append(disclaimer);

  requestAnimationFrame(() => {
    const card = result.closest('.result-card');
    const target = result.querySelector('.result-amount, .result-title');
    if (!card || !target) return;

    const bounds = target.getBoundingClientRect();
    const isVisible = bounds.top >= 0 && bounds.bottom <= window.innerHeight;
    if (!isVisible) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
    }
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const salary = Number(values.get('salary'));
  const birthYear = Number(values.get('birthYear'));
  const children = Number(values.get('children'));
  const childrenUnder3 = Math.min(children, Number(values.get('childrenUnder3')));
  const data = {
    salary,
    contributions: Number(values.get('contributions')),
    region: values.get('region'),
    age: Math.max(0, 2026 - birthYear),
    children,
    childrenUnder3,
    childShare: Number(values.get('childShare')),
    familyStatus: values.get('familyStatus'),
    payments: Number(values.get('payments')),
    withheld: Number(values.get('withheld')),
  };
  if (data.contributions > salary) {
    document.querySelector('#contributions').setCustomValidity('Las cotizaciones no pueden superar el salario bruto.');
    document.querySelector('#contributions').reportValidity();
    document.querySelector('#contributions').setCustomValidity('');
    return;
  }
  if (data.familyStatus === '1' && children === 0) {
    renderResult('Revisa los datos', null, [], 'La situación familiar 1 requiere al menos un hijo que dé derecho al mínimo familiar.');
    return;
  }

  if (!TaxEngine2026.REGION_KEYS[data.region]) {
    const foralMessage = data.region === 'Navarra'
      ? 'Navarra tiene una Hacienda Foral y un cálculo de retenciones propio. Esta versión todavía no lo incorpora.'
      : 'Los territorios históricos del País Vasco tienen Haciendas Forales y cálculos propios. Esta versión todavía no los incorpora.';
    const link = document.createElement('a');
    link.href = data.region === 'Navarra' ? 'https://www.navarra.es/es/hacienda' : 'https://www.euskadi.eus/tributos/';
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.className = 'official-link';
    link.textContent = data.region === 'Navarra' ? 'Abrir Hacienda Foral de Navarra ↗' : 'Abrir las haciendas forales vascas ↗';
    renderResult('Este territorio usa régimen foral', null, [], foralMessage);
    result.append(link);
    return;
  }

  if (values.get('calculation') === 'retencion') {
    if (salary === 0) {
      renderResult('Retención estimada', euros(0), [['Tipo estimado', '0 %'], ['Retención anual', euros(0)]], 'Sin salario sujeto a retención, el cálculo da 0 €.');
      return;
    }
    const estimate = TaxEngine2026.calculateRetention(data);
    renderResult('Retención estimada', `${estimate.rate.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`, [
      ['Retención anual aproximada', euros(estimate.annualRetention)],
      [`Importe por paga (${data.payments} pagas)`, euros(estimate.monthlyRetention)],
      ['Base usada en la estimación', euros(estimate.taxableBase)],
    ], 'Estimación para contrato general. Puede diferir del algoritmo AEAT en situaciones especiales, duración del contrato, regularizaciones, discapacidad u otros datos del modelo 145.');
    return;
  }

  const estimate = TaxEngine2026.calculateAnnual(data);
  if (estimate.unsupported) {
    const link = document.createElement('a');
    link.href = data.region === 'Navarra' ? 'https://www.navarra.es/es/hacienda' : 'https://www.euskadi.eus/tributos/';
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.className = 'official-link';
    link.textContent = data.region === 'Navarra' ? 'Abrir Hacienda Foral de Navarra ↗' : 'Abrir las haciendas forales vascas ↗';
    renderResult('Este territorio usa régimen foral', null, [], estimate.message);
    result.append(link);
    return;
  }
  const balanceLabel = estimate.balance > 0 ? 'Posible importe a pagar' : estimate.balance < 0 ? 'Posible importe a devolver' : 'Diferencia estimada';
  renderResult('Cuota anual estimada', euros(estimate.quota), [
    ['Base liquidable aproximada', euros(estimate.taxableBase)],
    ['Cuota estatal', euros(estimate.stateTax)],
    ['Cuota autonómica', euros(estimate.regionalTax)],
    ['Retenciones introducidas', euros(estimate.withheld)],
    [balanceLabel, euros(Math.abs(estimate.balance))],
  ], 'Solo contempla salario, cotizaciones y mínimos personales y por descendientes. Usa las últimas escalas autonómicas disponibles como referencia y omite deducciones, otras rentas y ajustes de la declaración. No es el resultado de Renta WEB.');
});
