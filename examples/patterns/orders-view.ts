/** Synthetic paged-table contract. The test fixture supplies its API responses. */
export const ordersView = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Order table examples</title></head><body>
<h1>Orders</h1><label for="filter">Order status</label>
<select id="filter"><option value="all">All</option><option value="open">Open</option><option value="closed">Closed</option></select>
<table aria-label="Orders" aria-busy="true" data-state="loading"><thead><tr>
<th scope="col">Order</th><th scope="col" aria-sort="ascending" id="amount-header"><button id="sort">Sort amount</button></th><th scope="col">Status</th><th scope="col">Action</th>
</tr></thead><tbody></tbody></table>
<nav aria-label="Order pagination"><button id="first" disabled>First page</button><p role="status" aria-label="Order page"></p><button id="next" disabled>Next page</button></nav>
<p role="alert" hidden></p>
<script>
const table = document.querySelector('table');
const body = table.querySelector('tbody');
const marker = document.querySelector('[role="status"]');
const first = document.querySelector('#first');
const next = document.querySelector('#next');
const alert = document.querySelector('[role="alert"]');
const state = { page: 1, filter: 'all', direction: 'ascending' };
function busy() { table.dataset.state = 'loading'; table.setAttribute('aria-busy', 'true'); alert.hidden = true; }
function failed() { table.dataset.state = 'error'; table.setAttribute('aria-busy', 'false'); alert.textContent = 'Orders could not be loaded'; alert.hidden = false; }
async function load(page) {
  busy();
  try {
    const query = new URLSearchParams({ page: String(page), status: state.filter, direction: state.direction });
    const response = await fetch('/patterns/orders-data?' + query);
    if (!response.ok) throw new Error('Order request failed');
    const data = await response.json();
    body.replaceChildren(...data.rows.map(order => {
      const row = document.createElement('tr');
      const key = document.createElement('th'); key.scope = 'row'; key.textContent = order.id;
      const amount = document.createElement('td'); amount.dataset.field = 'amount'; amount.textContent = (order.amount / 100).toFixed(2);
      const status = document.createElement('td'); status.textContent = order.status[0].toUpperCase() + order.status.slice(1);
      const action = document.createElement('td'); const button = document.createElement('button'); button.textContent = 'Approve'; button.disabled = order.status !== 'open';
      button.addEventListener('click', async () => {
        busy();
        try {
          const response = await fetch('/patterns/orders-approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id }) });
          if (!response.ok) throw new Error('Approval request failed');
          await load(state.page);
        } catch { failed(); }
      });
      action.append(button); row.append(key, amount, status, action); return row;
    }));
    state.page = data.page;
    marker.textContent = 'Page ' + data.page + ' of ' + data.pages;
    first.disabled = data.page === 1; next.disabled = data.page >= data.pages;
    document.querySelector('#amount-header').setAttribute('aria-sort', state.direction);
    table.dataset.state = 'ready'; table.setAttribute('aria-busy', 'false');
  } catch { failed(); }
}
first.addEventListener('click', () => load(1));
next.addEventListener('click', () => load(state.page + 1));
document.querySelector('#filter').addEventListener('change', event => { state.filter = event.target.value; load(1); });
document.querySelector('#sort').addEventListener('click', () => { state.direction = state.direction === 'ascending' ? 'descending' : 'ascending'; load(1); });
load(1);
</script></body></html>`;
