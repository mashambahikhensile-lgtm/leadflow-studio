'use strict';
const list = document.querySelector('#lead-list');
const alertBox = document.querySelector('#admin-alert');
let allLeads = [];
function alertAdmin(message, type='error') { alertBox.textContent = message; alertBox.className = `admin-alert ${type}`; alertBox.hidden = false; }
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function dateLabel(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString(undefined, {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
function render() {
  const status = document.querySelector('#status-filter').value;
  const query = document.querySelector('#search-filter').value.trim().toLowerCase();
  const filtered = allLeads.filter(lead => (status === 'all' || lead.status === status) && [lead.name,lead.email,lead.service,lead.message].some(value => String(value || '').toLowerCase().includes(query)));
  document.querySelector('#total-count').textContent = allLeads.length;
  document.querySelector('#new-count').textContent = allLeads.filter(lead => lead.status === 'new').length;
  document.querySelector('#active-count').textContent = allLeads.filter(lead => ['contacted','qualified'].includes(lead.status)).length;
  document.querySelector('#closed-count').textContent = allLeads.filter(lead => lead.status === 'closed').length;
  if (!filtered.length) { list.innerHTML = '<div class="empty-state"><b>No matching enquiries</b>Try another filter or submit a sample enquiry from the public form.</div>'; return; }
  list.innerHTML = filtered.map(lead => `<article class="lead-item" data-id="${escapeHTML(lead.id)}"><div><div class="lead-name">${escapeHTML(lead.name)}</div><div class="lead-email">${escapeHTML(lead.email)}</div></div><div><div class="lead-service">${escapeHTML(lead.service)}</div><div class="lead-date">${escapeHTML(dateLabel(lead.createdAt))}</div></div><div><div class="lead-message" title="${escapeHTML(lead.message)}">${escapeHTML(lead.message)}</div></div><div><label class="sr-only" for="status-${escapeHTML(lead.id)}">Status for ${escapeHTML(lead.name)}</label><select class="status-select" id="status-${escapeHTML(lead.id)}" data-action="status"><option value="new" ${lead.status==='new'?'selected':''}>New</option><option value="contacted" ${lead.status==='contacted'?'selected':''}>Contacted</option><option value="qualified" ${lead.status==='qualified'?'selected':''}>Qualified</option><option value="closed" ${lead.status==='closed'?'selected':''}>Closed</option></select></div><div><button class="delete-button" data-action="delete" type="button">Delete record</button></div></article>`).join('');
}
async function loadLeads() {
  list.innerHTML = '<div class="loading-state">Loading enquiries…</div>';
  try { const response = await fetch('/api/leads'); if (response.status === 401) { list.innerHTML = '<div class="empty-state"><b>Admin sign-in required</b>Refresh and enter the username and password from your .env file when prompted.</div>'; alertAdmin('Authentication required. Use your configured admin credentials.', 'error'); return; } if (!response.ok) throw new Error('Could not load leads.'); const data = await response.json(); allLeads = data.leads || []; alertBox.hidden = true; render(); }
  catch { list.innerHTML = '<div class="empty-state"><b>Could not load enquiries</b>Check that the server is running, then refresh.</div>'; alertAdmin('The server could not load lead records.', 'error'); }
}
list.addEventListener('change', async event => { if (!event.target.matches('[data-action="status"]')) return; const item = event.target.closest('[data-id]'); const id = item.dataset.id; const status = event.target.value; event.target.disabled = true; try { const response = await fetch(`/api/leads/${encodeURIComponent(id)}/status`, {method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status})}); const data = await response.json().catch(()=>({})); if (!response.ok) throw new Error(data.error || 'Status update failed.'); const found = allLeads.find(lead => lead.id === id); if (found) { found.status = status; found.updatedAt = data.lead.updatedAt; } render(); alertAdmin('Lead status updated.', 'success'); } catch(error) { alertAdmin(error.message); await loadLeads(); } finally { event.target.disabled = false; } });
list.addEventListener('click', async event => { const button = event.target.closest('[data-action="delete"]'); if (!button) return; const item = button.closest('[data-id]'); if (!window.confirm('Delete this lead record? This cannot be undone.')) return; button.disabled = true; try { const response = await fetch(`/api/leads/${encodeURIComponent(item.dataset.id)}`, {method:'DELETE'}); if (!response.ok) { const data = await response.json().catch(()=>({})); throw new Error(data.error || 'Delete failed.'); } allLeads = allLeads.filter(lead => lead.id !== item.dataset.id); render(); alertAdmin('Lead record deleted.', 'success'); } catch(error) { alertAdmin(error.message); await loadLeads(); } });
document.querySelector('#refresh-button').addEventListener('click', loadLeads);
document.querySelector('#status-filter').addEventListener('change', render);
document.querySelector('#search-filter').addEventListener('input', render);
loadLeads();
