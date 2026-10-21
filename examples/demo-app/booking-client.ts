import type { Booking, BookingInput, BookingOptions, Participant } from './booking-store.ts';

type PageData = { bookings: Booking[]; page: number; totalPages: number; total: number };
function must<T extends Element>(selector: string, kind: { new(): T }): T {
  const node = document.querySelector(selector);
  if (!(node instanceof kind)) throw new Error('Booking view is missing a required element.');
  return node;
}
const form = must('#booking-form', HTMLFormElement);
const draftControls = must('#draft-controls', HTMLFieldSetElement);
const title = must('#booking-title', HTMLInputElement);
const dateValue = must('#start-date', HTMLInputElement);
const save = must('#save', HTMLButtonElement);
const result = must('#result', HTMLParagraphElement);
const error = must('#error', HTMLParagraphElement);
const table = must('table', HTMLTableElement);
const rows = must('#booking-rows', HTMLTableSectionElement);
const marker = must('#page-marker', HTMLParagraphElement);
const firstPage = must('#first-page', HTMLButtonElement);
const nextPage = must('#next-page', HTMLButtonElement);
const chooser = must('#people-trigger', HTMLButtonElement);
const popup = must('#people-popup', HTMLDivElement);
const listbox = must('#people-options', HTMLDivElement);
const tokens = must('#tokens', HTMLElement);
const calendar = must('#calendar', HTMLDialogElement);
const dateTrigger = must('#date-trigger', HTMLButtonElement);
const monthLabel = must('#month', HTMLParagraphElement);
const days = must('#days', HTMLDivElement);
const previous = must('#previous-month', HTMLButtonElement);
const next = must('#next-month', HTMLButtonElement);
const selected = new Set<Participant>(['alice']);
const optionButtons = new Map<Participant, HTMLButtonElement>();
let options: BookingOptions;
let currentPage = 1;
let displayedMonth = 0;
let pending: { fingerprint: string; key: string } | undefined;
function showError(message: string) { error.textContent = message; error.hidden = false; }
function monthNumber(iso: string) { return Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1; }
async function getJSON<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Booking read failed.');
  return await response.json() as T;
}

async function loadBookings(page: number): Promise<void> {
  table.dataset.state = 'loading'; table.setAttribute('aria-busy', 'true');
  try {
    const data = await getJSON<PageData>('/api/bookings?page=' + page + '&pageSize=2');
    rows.replaceChildren(...data.bookings.map(booking => {
      const row = document.createElement('tr');
      const key = document.createElement('th'); key.scope = 'row'; key.textContent = booking.reference;
      row.append(key);
      for (const value of [booking.title, booking.startDate, booking.participants.map(id => options.participants.find(person => person.id === id)?.name ?? id).join(', ')]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      return row;
    }));
    currentPage = data.page;
    marker.textContent = 'Page ' + data.page + ' of ' + data.totalPages;
    firstPage.disabled = data.page === 1; nextPage.disabled = data.page >= data.totalPages;
    table.dataset.state = 'ready';
  } catch { table.dataset.state = 'error'; showError('Booking list could not be loaded. Existing rows may be out of date.'); }
  finally { table.setAttribute('aria-busy', 'false'); }
}

function renderSelections() {
  tokens.replaceChildren();
  for (const person of options.participants) {
    optionButtons.get(person.id)!.setAttribute('aria-selected', String(selected.has(person.id)));
    if (!selected.has(person.id)) continue;
    const token = document.createElement('span'); token.textContent = person.name + ' ';
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove ' + person.name);
    remove.addEventListener('click', () => { selected.delete(person.id); renderSelections(); chooser.focus(); });
    token.append(remove); tokens.append(token);
  }
}
function focusOption(button: HTMLButtonElement) {
  for (const option of optionButtons.values()) option.tabIndex = option === button ? 0 : -1;
  button.focus();
}
function closePeople() { popup.hidden = true; chooser.setAttribute('aria-expanded', 'false'); chooser.focus(); }
function buildParticipants() {
  for (const [index, person] of options.participants.entries()) {
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'option');
    button.textContent = person.name; button.disabled = !person.available; button.tabIndex = index === 0 ? 0 : -1;
    button.addEventListener('click', () => {
      if (selected.has(person.id)) selected.delete(person.id); else selected.add(person.id);
      renderSelections();
    });
    optionButtons.set(person.id, button); listbox.append(button);
  }
  renderSelections();
}
chooser.addEventListener('click', () => {
  if (!popup.hidden) { closePeople(); return; }
  popup.hidden = false; chooser.setAttribute('aria-expanded', 'true');
  const first = [...optionButtons.values()].find(button => !button.disabled);
  if (first) focusOption(first);
});
must('#people-done', HTMLButtonElement).addEventListener('click', closePeople);
popup.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); closePeople(); return; }
  if (!(event.target instanceof HTMLButtonElement) || event.target.getAttribute('role') !== 'option') return;
  const available = [...optionButtons.values()].filter(button => !button.disabled);
  const index = available.indexOf(event.target);
  let target: HTMLButtonElement | undefined;
  if (event.key === 'ArrowDown') target = available[(index + 1) % available.length];
  if (event.key === 'ArrowUp') target = available[(index - 1 + available.length) % available.length];
  if (event.key === 'Home') target = available[0];
  if (event.key === 'End') target = available.at(-1);
  if (target) { event.preventDefault(); focusOption(target); }
});

function closeCalendar() { calendar.close(); dateTrigger.setAttribute('aria-expanded', 'false'); dateTrigger.focus(); }
function renderMonth() {
  const year = Math.floor(displayedMonth / 12); const month = displayedMonth % 12;
  const first = new Date(Date.UTC(year, month, 1));
  monthLabel.dataset.month = String(year).padStart(4, '0') + '-' + String(month + 1).padStart(2, '0');
  monthLabel.textContent = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(first);
  previous.disabled = displayedMonth <= monthNumber(options.minDate); next.disabled = displayedMonth >= monthNumber(options.maxDate);
  days.replaceChildren(); const offset = (first.getUTCDay() + 6) % 7;
  for (let index = 0; index < 42; index++) {
    const date = new Date(Date.UTC(year, month, index - offset + 1)); const iso = date.toISOString().slice(0, 10);
    const button = document.createElement('button'); button.type = 'button'; button.textContent = String(date.getUTCDate()); button.setAttribute('aria-label', iso);
    button.disabled = date.getUTCMonth() !== month || iso < options.minDate || iso > options.maxDate || options.unavailableDates.includes(iso);
    button.addEventListener('click', () => { dateValue.value = iso; closeCalendar(); }); days.append(button);
  }
}
dateTrigger.addEventListener('click', () => { renderMonth(); calendar.showModal(); dateTrigger.setAttribute('aria-expanded', 'true'); });
previous.addEventListener('click', () => { displayedMonth--; renderMonth(); });
next.addEventListener('click', () => { displayedMonth++; renderMonth(); });
must('#cancel-date', HTMLButtonElement).addEventListener('click', closeCalendar);
calendar.addEventListener('cancel', event => { event.preventDefault(); closeCalendar(); });
firstPage.addEventListener('click', () => { void loadBookings(1); });
nextPage.addEventListener('click', () => { void loadBookings(currentPage + 1); });
must('#new-draft', HTMLButtonElement).addEventListener('click', () => {
  title.value = ''; dateValue.value = ''; selected.clear(); selected.add('alice'); pending = undefined;
  renderSelections(); result.textContent = ''; error.hidden = true; title.focus();
});
form.addEventListener('submit', async event => {
  event.preventDefault(); if (save.disabled) return;
  if (!popup.hidden) closePeople();
  form.setAttribute('aria-busy', 'true'); draftControls.disabled = true; save.disabled = true; error.hidden = true; result.textContent = '';
  const draft: BookingInput = { title: title.value.trim(), startDate: dateValue.value, participants: [...selected].sort() };
  const fingerprint = JSON.stringify(draft);
  if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, key: crypto.randomUUID() };
  try {
    const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pending.key }, body: fingerprint });
    if (!response.ok) {
      const problem = await response.json() as { error?: string };
      showError(problem.error ?? 'Booking was not saved.'); return;
    }
    const booking = await response.json() as Booking;
    result.textContent = 'Saved ' + booking.reference + (response.headers.get('Idempotent-Replay') === 'true' ? ' (request replayed)' : '');
    await loadBookings(1);
  } catch { showError('Could not confirm save. Retry uses the same request key.'); }
  finally { draftControls.disabled = false; save.disabled = false; form.setAttribute('aria-busy', 'false'); }
});

async function start() {
  try {
    const [session, configuration] = await Promise.all([getJSON<{ role: string }>('/api/session'), getJSON<BookingOptions>('/api/bookings/options')]);
    options = configuration; displayedMonth = monthNumber(options.minDate); buildParticipants();
    must('#session-role', HTMLParagraphElement).textContent = 'Signed in as ' + session.role;
    form.hidden = session.role !== 'editor'; await loadBookings(1);
  } catch { table.dataset.state = 'error'; table.setAttribute('aria-busy', 'false'); showError('Booking page could not be loaded. Sign in again.'); }
}
void start();
