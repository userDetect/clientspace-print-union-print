import { business } from './business.js';
import { savePrintRequest } from './request-store.js';
import { money } from './print-pricing.js';

const params = new URLSearchParams(location.search);
const productById = new Map(business.products.map(product => [product.id, product]));
const rateById = new Map(business.tariffs.map(tariff => [tariff.id, tariff]));
const words = text => String(text ?? '').toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

const menu = document.querySelector('.mobile-nav');
if (menu) {
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  document.addEventListener('click', event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
}

const catalogSearch = document.querySelector('#catalog-search');
if (catalogSearch) {
  const group = document.querySelector('#catalog-group');
  const output = document.querySelector('#catalog-results');
  const cards = [...document.querySelectorAll('[data-catalog]')];
  if ([...group.options].some(option => option.value === params.get('group'))) group.value = params.get('group');
  function filterCatalog() {
    const query = words(catalogSearch.value.trim());
    let shown = 0;
    for (const card of cards) {
      const p = productById.get(card.dataset.catalog);
      card.hidden = (group.value && p.group !== group.value) ||
        !words([p.name, p.detail, p.group].join(' ')).includes(query);
      if (!card.hidden) shown++;
    }
    output.textContent = shown ? 'Показано: ' + shown + ' из ' + cards.length : 'Ничего не найдено. Измените запрос или категорию.';
  }
  catalogSearch.addEventListener('input', filterCatalog);
  group.addEventListener('change', filterCatalog);
  filterCatalog();
}

const rateSearch = document.querySelector('#rate-search');
if (rateSearch) {
  const output = document.querySelector('#rate-results');
  const rows = [...document.querySelectorAll('[data-rate]')];
  const fromProduct = productById.get(params.get('product'));
  if (fromProduct && business.tariffs.some(rate => rate.product === fromProduct.id)) {
    rateSearch.value = fromProduct.name;
  }
  function filterRates() {
    const query = words(rateSearch.value.trim());
    let shown = 0;
    for (const row of rows) {
      const rate = rateById.get(row.dataset.rate);
      const product = productById.get(rate.product);
      row.hidden = !words([rate.productLabel, product?.name, rate.label, rate.rules].join(' ')).includes(query);
      if (!row.hidden) shown++;
    }
    output.textContent = shown ? 'Тарифов: ' + shown : 'Тарифы по этому запросу не найдены.';
  }
  rateSearch.addEventListener('input', filterRates);
  filterRates();
}

const quick = document.querySelector('#quick-estimate');
if (quick) {
  const {tariff,quantity,product} = quick.elements;
  const result = document.querySelector('#quick-total');
  function updateQuick(resetQuantity) {
    const rate = rateById.get(tariff.value);
    product.value = rate?.product ?? '';
    if (resetQuantity && rate) quantity.value = String(rate.quantity ?? 1);
    const count = quantity.valueAsNumber;
    const amount = rate?.mode === 'unit' && Number.isInteger(count) && count > 0 ? rate.amount * count :
      rate?.mode === 'batch' && count === rate.quantity ? rate.amount : null;
    result.textContent = amount === null ? 'Стоимость уточнит менеджер.' : 'Предварительно ' + money.format(amount);
  }
  tariff.addEventListener('change',() => updateQuick(true));
  quantity.addEventListener('input',() => updateQuick(false));
  updateQuick(false);
}

const form = document.querySelector('#order-form');
if (form) {
  const lines = document.querySelector('#lines');
  const add = document.querySelector('#add-line');
  const total = document.querySelector('#order-total');
  const error = document.querySelector('#order-error');
  const done = document.querySelector('#order-done');
  let pending = false;

  function labelled(label, control, className) {
    const wrapper = node('label', className);
    wrapper.append(node('span', '', label), control);
    return wrapper;
  }

  function select(label, values) {
    const input = node('select');
    input.append(new Option(label, ''));
    for (const entry of values) input.append(new Option(entry.label, entry.value));
    return input;
  }

  function fieldControl(field) {
    let input;
    if (field.type === 'select') {
      input = select('Выберите вариант', (field.options ?? []).map(option => ({label:option,value:option})));
    } else if (field.type === 'textarea') {
      input = node('textarea');
      input.rows = 2;
      input.maxLength = 700;
    } else {
      input = node('input');
      input.type = ['number','date'].includes(field.type) ? field.type : 'text';
      if (input.type === 'number') {
        input.min = '1';
        input.max = '1000000000';
        input.step = 'any';
      }
      if (input.type === 'text') input.maxLength = 300;
    }
    return input;
  }

  function changeOrdinals() {
    const items = [...lines.children];
    items.forEach((item, index) => {
      item.querySelector('.line-title').textContent = 'Позиция ' + (index + 1);
      item.querySelector('.remove-line').hidden = items.length === 1;
    });
    add.disabled = items.length >= 12;
  }

  const entries = new WeakMap();

  function makeLine(initialProduct = '', initialTariff = '', initialQuantity = '') {
    const card = node('section', 'line-item');
    const top = node('div', 'line-head');
    const caption = node('h2', 'line-title');
    const remove = node('button','remove-line','Удалить');
    remove.type = 'button';
    top.append(caption,remove);

    const product = select('Выберите изделие или услугу',business.products.map(item => ({value:item.id,label:item.name})));
    product.required = true;
    const productLabel = labelled('Изделие или услуга',product);
    const productFields = node('div','line-fields');
    const inputs = business.fields.map(field => {
      const input = fieldControl(field);
      const label = labelled(field.label,input,field.type === 'textarea' ? 'full' : '');
      productFields.append(label);
      return {field,input,label};
    });
    const quantity = inputs.find(entry => entry.field.key === 'quantity' || entry.field.key === 'amount')?.input;
    const tariff = node('select');
    const tariffLabel = labelled('Опубликованный тариф',tariff);
    const rateRules = node('p','muted');
    const estimate = node('p','line-estimate');
    estimate.setAttribute('aria-live','polite');

    const zone = node('div','file-zone');
    const attachment = node('input');
    attachment.type = 'file';
    attachment.disabled = true;
    const attachmentLabel = labelled(business.fileLabel,attachment);
    const consent = node('input');
    consent.type = 'checkbox';
    const consentLabel = node('label','check');
    const guide = node('a','','информацией о подготовке файлов');
    guide.href = 'guide.html';
    guide.target = '_blank';
    guide.rel = 'noopener';
    const consentText = node('span');
    consentText.append('Я ознакомился с ',guide);
    consentLabel.append(consent,consentText);
    zone.append(consentLabel,attachmentLabel,node('small','muted','Один файл до 25 МБ на позицию.'));
    consent.addEventListener('input',() => {
      attachment.disabled = !consent.checked;
      if (!consent.checked) {
        attachment.value = '';
        attachment.setCustomValidity('');
      }
    });
    attachment.addEventListener('change',() => {
      attachment.setCustomValidity(attachment.files[0]?.size > 25 * 1024 * 1024 ? 'Файл больше 25 МБ.' : '');
      attachment.reportValidity();
    });

    let activeProduct;
    let amount;
    function updateRates(selected) {
      activeProduct = productById.get(product.value);
      for (const {field,input,label} of inputs) {
        const valid = activeProduct && (field.applies === null || field.applies.includes(activeProduct.oldIndex));
        label.hidden = !valid;
        input.disabled = !valid;
      }
      const applicable = business.tariffs.filter(rate => rate.apply && rate.product === product.value);
      tariff.replaceChildren(new Option('Индивидуальный расчёт',''), ...applicable.map(rate => new Option(rate.label+' — '+rate.price,rate.id)));
      tariffLabel.hidden = !applicable.length;
      tariff.value = applicable.some(rate => rate.id === selected) ? selected : '';
      onRateChange();
    }
    function onRateChange(){
      const rate = rateById.get(tariff.value);
      if (rate?.mode === 'batch' && quantity && !quantity.value) quantity.value = String(rate.quantity);
      if (rate && quantity && !quantity.value && rate.mode === 'unit') quantity.value = '1';
      refresh();
    }
    function refresh() {
      const rate = rateById.get(tariff.value);
      const qty = quantity?.disabled ? undefined : quantity?.valueAsNumber;
      if (rate?.mode === 'unit' && Number.isInteger(qty) && qty > 0) amount = rate.amount * qty;
      else if (rate?.mode === 'batch' && (qty === undefined || qty === rate.quantity)) amount = rate.amount;
      else amount = null;
      rateRules.textContent = rate ? rate.rules : '';
      rateRules.hidden = !rate;
      estimate.hidden = !activeProduct;
      estimate.textContent = amount === null ? 'Стоимость уточнит менеджер.' : 'Предварительно ' + money.format(amount);
      if (rate?.mode === 'batch' && amount === null) estimate.textContent = 'Тариф рассчитан на ' + rate.quantity + ' шт. Для этого тиража цену уточнит менеджер.';
      updateTotal();
    }
    function record() {
      const values = inputs.filter(entry => !entry.input.disabled && entry.input.value.trim());
      const specs = values.map(({field,input}) => ({label:field.label,value:input.value.trim()}));
      const rate = rateById.get(tariff.value);
      if (rate) specs.push({label:'Тариф',value:rate.label});
      const count = quantity?.disabled ? null : quantity?.valueAsNumber;
      return {
        product:activeProduct.name, quantity:Number.isFinite(count) ? count : undefined,
        specs, artwork:attachment.files[0] ?? null,
        estimate:amount === null ? null : {amount},
      };
    }
    remove.addEventListener('click',() => {
      card.remove();
      changeOrdinals();
      updateTotal();
      add.focus();
    });
    product.addEventListener('change',() => updateRates(''));
    tariff.addEventListener('change',onRateChange);
    quantity?.addEventListener('input',refresh);
    card.append(top,productLabel,productFields,tariffLabel,rateRules,estimate,zone);
    entries.set(card,{record, get amount(){ return amount; }, get selected(){return Boolean(activeProduct);}});
    lines.append(card);
    if (productById.has(initialProduct)) product.value = initialProduct;
    if (quantity && /^\d{1,10}$/.test(initialQuantity) && Number(initialQuantity) <= 1000000000) quantity.value = initialQuantity;
    updateRates(initialTariff);
    changeOrdinals();
    return product;
  }

  function updateTotal() {
    const selected = [...lines.children].map(card => entries.get(card)).filter(line => line.selected);
    const rates = selected.map(line => line.amount).filter(Number.isFinite);
    const estimate = rates.length ? rates.reduce((sum, price) => sum+price,0) : null;
    const unpricedItems = selected.length - rates.length;
    total.hidden = !selected.length;
    total.textContent = estimate === null ? 'Стоимость уточнит менеджер.' :
      (unpricedItems ? 'По рассчитанным позициям ' : 'Предварительно ') + money.format(estimate);
    return {estimatedSubtotal:estimate,unpricedItems};
  }

  add.addEventListener('click', () => makeLine().focus());
  document.querySelector('#start-again').addEventListener('click',() => {
    done.hidden = true;
    form.hidden = false;
    form.reset();
    lines.replaceChildren();
    makeLine().focus();
  });
  makeLine(params.get('product') ?? '',params.get('tariff') ?? '',params.get('quantity') ?? '');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    error.textContent = '';
    const name = form.elements.customer.value.trim();
    const phone = form.elements.phone.value.trim();
    if (!name || phone.replace(/\D/g,'').length < 7) {
      error.textContent = 'Укажите имя и номер для связи.';
      (!name ? form.elements.customer : form.elements.phone).focus();
      return;
    }
    pending = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const id = await savePrintRequest({
        contact:{name,phone}, items:[...lines.children].map(card => entries.get(card).record()),
        notes:form.elements.comment.value.trim(), status:'new', totals:updateTotal(),
        createdAt:new Date().toISOString(),
      });
      form.hidden = true;
      done.hidden = false;
      const title = document.querySelector('#order-done-title');
      title.textContent = 'Заявка №' + id + ' сохранена';
      title.focus();
    } catch (failure) {
      console.error(failure);
      error.textContent = 'Браузер не смог сохранить заявку. Попробуйте ещё раз или уменьшите размер файлов.';
    } finally {
      pending = false;
      submit.disabled = false;
    }
  });
}
