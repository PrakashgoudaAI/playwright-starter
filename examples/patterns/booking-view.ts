/** Synthetic, fixed-date widgets for contract tests; not a production UI library. */
export const bookingView = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Booking widget examples</title></head>
<body><main><h1>Booking</h1>
<button id="people-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="people-options">Choose participants</button>
<section aria-label="Selected participants" id="tokens"></section>
<label for="start-date">Start date</label><input id="start-date" readonly>
<button id="date-trigger" aria-haspopup="dialog" aria-expanded="false">Choose start date</button>
<dialog id="calendar" aria-labelledby="calendar-title">
<h2 id="calendar-title">Start date</h2>
<button id="previous-month">Previous month</button>
<p role="status" aria-label="Calendar month" id="month"></p>
<button id="next-month">Next month</button>
<div role="group" aria-label="Calendar days" id="days"></div>
<button id="cancel-date">Cancel date selection</button>
</dialog></main>
<!-- The options are portalled outside the main application section. -->
<div id="people-popup" hidden>
<div id="people-options" role="listbox" aria-label="Participants" aria-multiselectable="true" aria-busy="false"></div>
<button id="people-done">Done choosing participants</button>
</div>
<script>
const people = [
  { key: 'alice', name: 'Alice', disabled: false },
  { key: 'alice-jones', name: 'Alice Jones', disabled: false },
  { key: 'bob', name: 'Bob', disabled: false },
  { key: 'evan', name: 'Evan', disabled: true },
];
const selected = new Set(['alice']);
const chooser = document.querySelector('#people-trigger');
const popup = document.querySelector('#people-popup');
const listbox = document.querySelector('#people-options');
const tokens = document.querySelector('#tokens');
const optionButtons = new Map();
function renderSelections() {
  tokens.replaceChildren();
  for (const person of people) {
    optionButtons.get(person.key).setAttribute('aria-selected', String(selected.has(person.key)));
    if (!selected.has(person.key)) continue;
    const token = document.createElement('span');
    token.textContent = person.name + ' ';
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove ' + person.name);
    remove.addEventListener('click', () => { selected.delete(person.key); renderSelections(); chooser.focus(); });
    token.append(remove);
    tokens.append(token);
  }
}
for (const [index, person] of people.entries()) {
  const button = document.createElement('button');
  button.setAttribute('role', 'option');
  button.textContent = person.name;
  button.disabled = person.disabled;
  button.tabIndex = index === 0 ? 0 : -1;
  button.addEventListener('click', () => {
    if (selected.has(person.key)) selected.delete(person.key); else selected.add(person.key);
    renderSelections();
  });
  optionButtons.set(person.key, button);
  listbox.append(button);
}
function focusOption(button) {
  for (const option of optionButtons.values()) option.tabIndex = option === button ? 0 : -1;
  button.focus();
}
function closePeople() { popup.hidden = true; chooser.setAttribute('aria-expanded', 'false'); chooser.focus(); }
chooser.addEventListener('click', () => {
  if (!popup.hidden) { closePeople(); return; }
  popup.hidden = false;
  chooser.setAttribute('aria-expanded', 'true');
  const first = Array.from(optionButtons.values()).find(button => !button.disabled);
  focusOption(first);
});
document.querySelector('#people-done').addEventListener('click', closePeople);
popup.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); closePeople(); return; }
  if (!event.target.matches('[role="option"]')) return;
  const options = Array.from(optionButtons.values()).filter(button => !button.disabled);
  const index = options.indexOf(document.activeElement);
  let target;
  if (event.key === 'ArrowDown') target = options[(index + 1) % options.length];
  if (event.key === 'ArrowUp') target = options[(index - 1 + options.length) % options.length];
  if (event.key === 'Home') target = options[0];
  if (event.key === 'End') target = options[options.length - 1];
  if (target) { event.preventDefault(); focusOption(target); }
});
renderSelections();

const calendar = document.querySelector('#calendar');
const dateTrigger = document.querySelector('#date-trigger');
const dateValue = document.querySelector('#start-date');
const monthLabel = document.querySelector('#month');
const days = document.querySelector('#days');
const previous = document.querySelector('#previous-month');
const next = document.querySelector('#next-month');
const minimum = 2028 * 12;
const maximum = 2029 * 12 + 11;
const monthStep = Number(document.documentElement.dataset.calendarStep || 1);
let displayedMonth = 2028 * 12 + 1;
function closeCalendar() { calendar.close(); dateTrigger.setAttribute('aria-expanded', 'false'); dateTrigger.focus(); }
function renderMonth() {
  const year = Math.floor(displayedMonth / 12);
  const month = displayedMonth % 12;
  const first = new Date(Date.UTC(year, month, 1));
  monthLabel.dataset.month = String(year).padStart(4, '0') + '-' + String(month + 1).padStart(2, '0');
  monthLabel.textContent = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  previous.disabled = displayedMonth <= minimum;
  next.disabled = displayedMonth >= maximum;
  days.replaceChildren();
  const offset = (first.getUTCDay() + 6) % 7;
  for (let index = 0; index < 42; index++) {
    const date = new Date(Date.UTC(year, month, index - offset + 1));
    const iso = date.toISOString().slice(0, 10);
    const button = document.createElement('button');
    button.textContent = String(date.getUTCDate());
    button.setAttribute('aria-label', iso);
    button.disabled = date.getUTCMonth() !== month || iso === '2028-02-14';
    button.addEventListener('click', () => { dateValue.value = iso; closeCalendar(); });
    days.append(button);
  }
}
dateTrigger.addEventListener('click', () => { renderMonth(); calendar.showModal(); dateTrigger.setAttribute('aria-expanded', 'true'); });
previous.addEventListener('click', () => { displayedMonth -= monthStep; renderMonth(); });
next.addEventListener('click', () => { displayedMonth += monthStep; renderMonth(); });
document.querySelector('#cancel-date').addEventListener('click', closeCalendar);
calendar.addEventListener('cancel', event => { event.preventDefault(); closeCalendar(); });
</script></body></html>`;
