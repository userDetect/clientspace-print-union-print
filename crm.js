import { money, sideLabels } from './print-pricing.js';
import { demoPrintRequests } from './crm-examples.js';
import { ensureDemoPrintRequests, listPrintRequests, updatePrintRequest, watchPrintRequests } from './request-store.js';

const stages = [
  {id:'all', label:'Все заказы', path:'M8 5h12M8 12h12M8 19h12M4 5h.01M4 12h.01M4 19h.01'},
  {id:'new', label:'Новые', title:'Новый', path:'M12 4v16M4 12h16'},
  {id:'review', label:'На согласовании', title:'На согласовании', path:'M4 5h16v12H9l-5 3zM8 9h8m-8 4h6'},
  {id:'production', label:'В печати', title:'В печати', path:'M7 8V3h10v5M6 17H4V9h16v8h-2m-11-3h10v7H7zm10-2h.01'},
  {id:'ready', label:'К выдаче', title:'К выдаче', path:'M4 8h16v12H4zm0 0 3-5h10l3 5m-11 4 2 2 4-4'},
  {id:'completed', label:'Выданные', title:'Выдан', path:'M5 12l4 4L19 6'},
  {id:'cancelled', label:'Отменённые', title:'Отменён', path:'m6 6 12 12M18 6 6 18'},
];
const stageById = new Map(stages.map(stage => [stage.id, stage]));
const dataDate = new Intl.DateTimeFormat('ru-RU', {
  day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Moscow',
});
const countWord = new Intl.PluralRules('ru');
const draw = document.querySelector('#crm-drawer');
const form = document.querySelector('#crm-edit');
const saveStatus = document.querySelector('#crm-save-status');
const save = form.querySelector('[type="submit"]');
const filters = document.querySelector('#crm-stages');
const search = document.querySelector('#crm-search');
const website = document.querySelector('#crm-website-only');
const metrics = document.querySelector('#crm-metrics');
const rows = document.querySelector('#crm-rows');
const table = document.querySelector('#crm-table');
const empty = document.querySelector('#crm-empty');
const result = document.querySelector('#crm-result');
let orders = [];
let stage = 'all';
let selected = null;
let loaded = false;
let readSequence = 0;
const fileUrls = [];

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function icon(path) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const shape = document.createElementNS(svg.namespaceURI, 'path');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  shape.setAttribute('d', path);
  svg.append(shape);
  return svg;
}

function dateText(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? dataDate.format(date) : 'Дата неизвестна';
}

function orderNumber(order) {
  return '№' + String(order.id).replace(/^demo-/, '');
}

function stageName(id) {
  return stageById.get(id)?.title || 'Новый';
}

function stagePill(id) {
  const pill = element('span', 'crm-pill', stageName(id));
  pill.dataset.status = id;
  return pill;
}

function entries(order) {
  if (Array.isArray(order.items)) return order.items;
  if (!order.product) return [];
  return [{
    product:order.product, quantity:order.quantity, format:order.format,
    variantLabel:order.pages ? order.pages + ' стр.' : sideLabels[order.printing] ?? order.printing,
    estimate:order.estimate, artwork:order.artwork,
  }];
}

function estimateOf(order) {
  return order.totals?.estimatedSubtotal ?? order.estimate?.total ?? order.estimate?.amount ?? null;
}

function moneyOrRequest(amount) {
  return Number.isFinite(amount) ? money.format(amount) : 'По запросу';
}

function itemCount(value, forms) {
  return value + ' ' + (forms[countWord.select(value)] ?? forms.other);
}

function normalized(text) {
  return String(text ?? '').toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');
}

function digits(text) {
  return String(text ?? '').replace(/\D/g, '');
}

function matchesSearch(order) {
  const query = normalized(search.value).replace(/^№\s*/, '').trim();
  if (!query) return true;
  if (/^\+?[\d\s()-]+$/.test(query) && digits(query).length > 3 && digits(order.contact?.phone).includes(digits(query))) return true;
  const text = normalized([orderNumber(order), order.contact?.name, order.contact?.phone, digits(order.contact?.phone),
    ...entries(order).map(item => item.product)].join(' '));
  return query.split(/\s+/).every(keyword => text.includes(keyword));
}

function formatStageButton(entry) {
  const button = element('button', 'crm-stage');
  button.type = 'button';
  button.dataset.stage = entry.id;
  button.append(icon(entry.path), element('span', '', entry.label), element('span', 'crm-stage-count'));
  return button;
}

filters.append(...stages.map(formatStageButton));
form.elements.status.append(...stages.slice(1).map(entry => new Option(entry.title, entry.id)));

function renderMetric(label, amount, path) {
  const card = element('div', 'crm-metric');
  const head = element('div', 'crm-metric-label', label);
  head.append(icon(path));
  card.append(head, element('strong', '', amount));
  return card;
}

function renderRow(order) {
  const row = element('tr');
  const idCell = element('td');
  const link = element('button', 'crm-order-link', orderNumber(order));
  link.type = 'button';
  link.dataset.orderId = String(order.id);
  link.setAttribute('aria-label', 'Открыть заказ ' + orderNumber(order));
  row.addEventListener('click', () => openOrder(order.id));
  idCell.append(link);
  if (order.sample) idCell.append(element('span', 'crm-source-tag', 'Пример'));
  idCell.append(element('span', 'crm-row-date', dateText(order.createdAt)));

  const contact = element('td', '', order.contact?.name || 'Без имени');
  if (order.contact?.phone) contact.append(element('span', 'crm-row-sub', order.contact.phone));
  const items = entries(order);
  const products = element('td', 'crm-row-products', items.map(item => item.product).filter(Boolean).join(', ') || '—');
  if (items.length > 1) products.append(element('span', 'crm-row-sub', itemCount(items.length, {one:'позиция',few:'позиции',other:'позиций'})));

  const estimate = estimateOf(order);
  const amount = element('td', 'crm-row-amount', moneyOrRequest(order.finalAmount ?? estimate));
  if (order.finalAmount != null || Number.isFinite(estimate)) {
    const partial = order.finalAmount == null && order.totals?.unpricedItems > 0;
    amount.append(element('span', 'crm-row-sub', order.finalAmount != null ? 'Согласовано' : partial ? 'По части позиций' : 'Предварительно'));
  }
  const state = element('td');
  state.append(stagePill(order.status || 'new'));
  row.append(idCell, contact, products, amount, state);
  return row;
}

function render() {
  const scoped = website.checked ? orders.filter(order => !order.sample) : orders;
  const counts = new Map();
  for (const order of scoped) {
    const status = order.status || 'new';
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  const count = id => counts.get(id) ?? 0;
  for (const button of filters.children) {
    button.setAttribute('aria-pressed', String(button.dataset.stage === stage));
    button.querySelector('.crm-stage-count').textContent = loaded ? (button.dataset.stage === 'all' ? scoped.length : count(button.dataset.stage)) : '–';
  }
  document.querySelector('#crm-queue-title').textContent = stageById.get(stage).label;
  if (!loaded) return;

  metrics.replaceChildren(
    renderMetric('Всего заказов', scoped.length, stages[0].path),
    renderMetric('Новые', count('new'), stages[1].path),
    renderMetric('В работе', count('review') + count('production'), stages[3].path),
    renderMetric('К выдаче', count('ready'), stages[4].path),
  );

  const visible = scoped.filter(order => (stage === 'all' || (order.status || 'new') === stage) && matchesSearch(order));
  rows.replaceChildren(...visible.map(renderRow));
  result.textContent = itemCount(visible.length, {one:'заказ',few:'заказа',other:'заказов'});
  table.hidden = !visible.length;
  empty.hidden = Boolean(visible.length);
  if (!visible.length) {
    empty.textContent = !scoped.length && website.checked ? 'Заказов с сайта пока нет. Оформите заказ, и он появится здесь.' : 'Заказы по этим условиям не найдены.';
  }
}

function revokeFiles() {
  for (const url of fileUrls) URL.revokeObjectURL(url);
  fileUrls.length = 0;
}

function detailItem(item) {
  const box = element('article', 'crm-detail-item');
  const specs = [Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0 ? item.quantity + ' шт.' : '', item.format, item.variantLabel || item.variant].filter(Boolean);
  box.append(element('strong', '', item.product || 'Изделие'), element('span', 'crm-item-amount', moneyOrRequest(item.estimate?.amount ?? item.estimate?.total)));
  if (specs.length) box.append(element('span', 'crm-item-meta', specs.join(' · ')));
  if (Array.isArray(item.specs) && item.specs.length) {
    const list = element('dl', 'crm-item-specs');
    for (const {label,value} of item.specs) {
      list.append(element('dt', '', label), element('dd', '', value));
    }
    box.append(list);
  }
  if (item.artwork instanceof Blob) {
    const url = URL.createObjectURL(item.artwork);
    fileUrls.push(url);
    const fileName = item.artwork.name || 'Макет';
    const link = element('a', 'crm-artwork');
    link.href = url;
    link.download = fileName;
    link.append(icon('M12 4v11m-4-4 4 4 4-4M5 16v4h14v-4'), element('span', '', fileName));
    link.setAttribute('aria-label', 'Скачать макет ' + fileName);
    box.append(link);
  } else {
    box.append(element('span', 'crm-artwork', 'Макет не приложен'));
  }
  return box;
}

function eventItem(event) {
  const row = element('li');
  const date = element('time', '', dateText(event.at));
  if (event.at) date.dateTime = event.at;
  let description = 'Заказ получен';
  if (event.type === 'status') description = stageName(event.from) + ' → ' + stageName(event.to);
  if (event.type === 'note') description = event.text;
  if (event.type === 'amount') description = event.amount == null ? 'Согласованная сумма снята' : 'Согласованная сумма ' + money.format(event.amount);
  row.append(date, document.createTextNode(description));
  return row;
}

function showOrder(order) {
  revokeFiles();
  document.querySelector('#crm-order-title').textContent = 'Заказ ' + orderNumber(order);
  document.querySelector('#crm-order-meta').replaceChildren(
    stagePill(order.status || 'new'), element('span', '', dateText(order.createdAt)),
    element('span', '', order.sample ? 'Пример' : 'С сайта'),
  );

  const contact = document.querySelector('#crm-order-contact');
  contact.replaceChildren(element('strong', '', order.contact?.name || 'Без имени'));
  if (order.contact?.phone) {
    const phone = element(order.sample ? 'span' : 'a', '', order.contact.phone);
    if (!order.sample) phone.href = 'tel:' + (String(order.contact.phone).trim().startsWith('+') ? '+' : '') + digits(order.contact.phone);
    contact.append(phone);
  }
  const notes = document.querySelector('#crm-client-notes');
  notes.hidden = !order.notes;
  notes.textContent = order.notes ?? '';

  document.querySelector('#crm-order-items').replaceChildren(...entries(order).map(detailItem));
  const subtotal = estimateOf(order);
  const actual = order.finalAmount;
  const partial = actual == null && order.totals?.unpricedItems > 0 && Number.isFinite(subtotal);
  document.querySelector('#crm-order-estimate').replaceChildren(
    element('span', '', actual != null ? 'Согласованная сумма' : partial ? 'По рассчитанным позициям' : 'Предварительная сумма'),
    element('strong', '', moneyOrRequest(actual ?? subtotal)),
  );

  form.elements.status.value = stageById.has(order.status) && order.status !== 'all' ? order.status : 'new';
  form.elements.finalAmount.value = Number.isFinite(actual) ? actual : '';
  form.elements.note.value = '';
  const history = Array.isArray(order.history) ? order.history : [];
  document.querySelector('#crm-history').replaceChildren(...[...history].reverse().map(eventItem), eventItem({at:order.createdAt}));
}

function openOrder(id) {
  selected = orders.find(order => order.id === id);
  if (!selected) return;
  saveStatus.textContent = '';
  showOrder(selected);
  draw.showModal();
  draw.querySelector('.crm-drawer-body').scrollTop = 0;
}

draw.querySelector('.crm-close').addEventListener('click', () => draw.close());
draw.addEventListener('close', () => {
  const focusId = String(selected?.id);
  selected = null;
  revokeFiles();
  const previous = [...rows.querySelectorAll('.crm-order-link')].find(link => link.dataset.orderId === focusId);
  (previous ?? search).focus();
});

filters.addEventListener('click', event => {
  const button = event.target.closest('[data-stage]');
  if (!button) return;
  stage = button.dataset.stage;
  render();
});
search.addEventListener('input', render);
website.addEventListener('change', render);
form.addEventListener('input', () => { saveStatus.textContent = ''; });

form.addEventListener('submit', async event => {
  event.preventDefault();
  const current = selected;
  if (!current || save.disabled) return;
  const status = form.elements.status.value;
  const finalAmount = form.elements.finalAmount.value === '' ? null : form.elements.finalAmount.valueAsNumber;
  const note = form.elements.note.value.trim();
  const changes = {note};
  if (status !== (current.status || 'new')) changes.status = status;
  if (finalAmount !== (current.finalAmount ?? null)) changes.finalAmount = finalAmount;
  if (!changes.status && changes.finalAmount === undefined && !note) {
    saveStatus.textContent = 'Изменений нет.';
    return;
  }
  save.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    const updated = await updatePrintRequest(current.id, changes);
    if (selected?.id === current.id) {
      selected = updated;
      showOrder(updated);
      saveStatus.textContent = 'Изменения сохранены.';
    }
    await refresh();
  } catch {
    if (selected?.id === current.id) saveStatus.textContent = 'Не удалось сохранить изменения. Попробуйте ещё раз.';
  } finally {
    save.disabled = false;
    form.removeAttribute('aria-busy');
  }
});

async function refresh() {
  const sequence = ++readSequence;
  try {
    const list = await listPrintRequests();
    if (sequence !== readSequence) return;
    orders = list.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
    loaded = true;
    render();
  } catch {
    if (sequence === readSequence) {
      empty.hidden = false;
      empty.textContent = 'Не удалось прочитать заказы из хранилища браузера.';
    }
  }
}

async function init() {
  render();
  try {
    await ensureDemoPrintRequests(demoPrintRequests());
  } catch {
    // Try to read existing orders even when examples cannot be written.
  }
  watchPrintRequests(refresh);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  await refresh();
}
init();
