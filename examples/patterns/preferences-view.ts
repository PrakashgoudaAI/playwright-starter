/** Synthetic control contracts for the pattern tests; not a deployable application. */
export const preferencesView = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Preferences examples</title></head>
<body><main><h1>Preferences</h1>
<form id="preferences">
<label for="plan">Plan</label><select id="plan"><option value="basic">Basic</option><option value="team">Team</option><option value="retired" disabled>Retired</option></select>
<label for="languages">Languages</label><select id="languages" multiple><option value="en">English</option><option value="fr">French</option><option value="de">German</option></select>
<fieldset id="channels"><legend>Notification channels</legend>
<label><input type="checkbox" value="email">Email</label>
<label><input type="checkbox" value="sms">SMS</label>
<label><input type="checkbox" value="push" disabled>Push</label>
</fieldset>
<fieldset><legend>Other settings</legend><label><input type="checkbox">Email</label></fieldset>
<label for="region">Region</label><input id="region" role="combobox" aria-autocomplete="list" aria-controls="region-options" aria-expanded="false" autocomplete="off">
<ul id="region-options" role="listbox" aria-label="Regions" hidden></ul>
<fieldset><legend>Digest frequency</legend><label><input type="radio" name="digest" value="daily" checked>Daily</label><label><input type="radio" name="digest" value="weekly">Weekly</label></fieldset>
<label for="due">Due date</label><input id="due" type="date">
<label for="attachment">Attachments</label><input id="attachment" type="file" multiple><output id="file-summary" aria-label="Attached files"></output>
<button type="submit">Save preferences</button>
</form>
<p role="status" aria-label="Save status" id="status"></p>
<fieldset id="records"><legend>Records</legend><label><input id="all-rows" type="checkbox">Select all rows</label><label><input class="record" type="checkbox">Row A</label><label><input class="record" type="checkbox">Row B</label></fieldset>
<button id="delete" type="button">Delete preferences</button>
<dialog id="confirmation" aria-labelledby="confirmation-title"><h2 id="confirmation-title">Delete preferences?</h2><button id="confirm-delete">Confirm delete</button><button id="cancel-delete">Cancel</button></dialog>
<a download="preferences.txt" href="data:text/plain;charset=utf-8,synthetic%20preferences">Export preferences</a>
<button id="help" type="button">Open help</button>
<iframe title="Embedded details" srcdoc='<label for="reference">Internal reference</label><input id="reference">'></iframe>
<script>
const region = document.querySelector('#region');
const options = document.querySelector('#region-options');
region.addEventListener('input', () => {
  const matches = ['East', 'East Coast', 'West'].filter(value => value.toLowerCase().includes(region.value.toLowerCase()));
  options.replaceChildren(...matches.map(value => {
    const item = document.createElement('li');
    item.setAttribute('role', 'option');
    item.textContent = value;
    item.addEventListener('click', () => { region.value = value; options.hidden = true; region.setAttribute('aria-expanded', 'false'); });
    return item;
  }));
  options.hidden = false;
  region.setAttribute('aria-expanded', 'true');
});
document.querySelector('#preferences').addEventListener('submit', event => { event.preventDefault(); document.querySelector('#status').textContent = 'Preferences saved'; });
document.querySelector('#attachment').addEventListener('change', event => { document.querySelector('#file-summary').textContent = Array.from(event.target.files).map(file => file.name).join(', '); });
const confirmation = document.querySelector('#confirmation');
document.querySelector('#delete').addEventListener('click', () => confirmation.showModal());
document.querySelector('#confirm-delete').addEventListener('click', () => { document.querySelector('#status').textContent = 'Preferences deleted'; confirmation.close(); });
document.querySelector('#cancel-delete').addEventListener('click', () => confirmation.close());
document.querySelector('#help').addEventListener('click', () => window.open('/login', '_blank'));
const allRows = document.querySelector('#all-rows');
const rows = Array.from(document.querySelectorAll('.record'));
allRows.addEventListener('change', () => { rows.forEach(row => { row.checked = allRows.checked; }); allRows.indeterminate = false; });
rows.forEach(row => row.addEventListener('change', () => { allRows.checked = rows.every(item => item.checked); allRows.indeterminate = rows.some(item => item.checked) && !allRows.checked; }));
</script></main></body></html>`;
