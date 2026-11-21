const databaseName = 'clientspace-print-demo-union-print';
const requestStore = 'requests';
const changes = typeof BroadcastChannel === 'function' ? new BroadcastChannel('clientspace-print-requests-union-print') : null;

function readWrite(mode, operate) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(databaseName, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(requestStore, {keyPath: 'id', autoIncrement: true});
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      database.onversionchange = () => database.close();
      let transaction;
      let result;
      try {
        transaction = database.transaction(requestStore, mode);
        transaction.oncomplete = () => {
          database.close();
          resolve(result);
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error ?? new Error('Order transaction aborted'));
        };
        operate(transaction.objectStore(requestStore), value => { result = value; });
      } catch (error) {
        if (transaction) transaction.abort();
        database.close();
        reject(error);
      }
    };
  });
}

export async function savePrintRequest(request) {
  const id = await readWrite('readwrite', (store, done) => {
    const added = store.add(request);
    added.onsuccess = () => done(added.result);
  });
  changes?.postMessage(id);
  return id;
}

export function listPrintRequests() {
  return readWrite('readonly', (store, done) => {
    const list = store.getAll();
    list.onsuccess = () => done(list.result);
  });
}

export function ensureDemoPrintRequests(examples) {
  return readWrite('readwrite', store => {
    for (const order of examples) {
      const existing = store.get(order.id);
      existing.onsuccess = () => {
        if (!existing.result) store.add(order);
      };
    }
  });
}

export async function updatePrintRequest(id, {status, finalAmount, note}) {
  const order = await readWrite('readwrite', (store, done) => {
    const existing = store.get(id);
    existing.onsuccess = () => {
      const current = existing.result;
      if (!current) {
        done(null);
        return;
      }

      const now = new Date().toISOString();
      const history = Array.isArray(current.history) ? [...current.history] : [];
      const oldStatus = current.status || 'new';
      const oldAmount = current.finalAmount ?? null;
      const nextStatus = status ?? oldStatus;
      const nextAmount = finalAmount === undefined ? oldAmount : finalAmount;
      if (nextStatus !== oldStatus) history.push({type: 'status', from: oldStatus, to: nextStatus, at: now});
      if (nextAmount !== oldAmount) history.push({type: 'amount', amount: nextAmount, at: now});
      if (note) history.push({type: 'note', text: note, at: now});
      const updated = {...current, status: nextStatus, finalAmount: nextAmount, history, updatedAt: now};
      store.put(updated);
      done(updated);
    };
  });
  if (!order) throw new Error('Order does not exist');
  changes?.postMessage(id);
  return order;
}

export function watchPrintRequests(listener) {
  changes?.addEventListener('message', listener);
}
