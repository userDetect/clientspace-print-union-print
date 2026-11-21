import { business } from './business.js';

const statuses = ['new','review','production','ready'];
const now = Date.now();
const names = ['Демо-клиент', 'Пример заказа', 'Учебная заявка', 'Демо-заявка'];
export const demoPrintRequests = statuses.map((status,index) => {
  const product = business.products[index % business.products.length];
  const at = new Date(now - Math.max(index,1)*86400000).toISOString();
  return {
    id:'demo-'+(2041+index),
    sample:true,
    status,
    createdAt:at,
    contact:{name:names[index],phone:'+7 (000) 000-00-00'},
    items:[{product:product.name, specs:[{label:'Категория',value:product.group}]}],
    notes:'Учебный пример для демонстрации кабинета.',
  };
});
