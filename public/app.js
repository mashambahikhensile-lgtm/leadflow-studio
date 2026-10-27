'use strict';
const form = document.querySelector('#lead-form');
if (form) {
  const alertBox = document.querySelector('#form-alert');
  const submitButton = form.querySelector('button[type="submit"]');
  function showAlert(message, type) { alertBox.textContent = message; alertBox.className = `form-alert ${type}`; alertBox.hidden = false; }
  function clearErrors() { form.querySelectorAll('[data-error]').forEach(el => { el.textContent = ''; }); form.querySelectorAll('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid')); }
  function showErrors(fields) {
    Object.entries(fields || {}).forEach(([name, message]) => {
      const target = form.querySelector(`[data-error="${name}"]`);
      const input = form.elements.namedItem(name);
      if (target) target.textContent = message;
      if (input && input.setAttribute) input.setAttribute('aria-invalid', 'true');
    });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); clearErrors(); alertBox.hidden = true;
    const data = Object.fromEntries(new FormData(form).entries());
    data.consent = form.elements.consent.checked;
    const clientErrors = {};
    if (!data.name || data.name.trim().length < 2) clientErrors.name = 'Enter your name (at least 2 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((data.email || '').trim())) clientErrors.email = 'Enter a valid email address.';
    if (data.phone && data.phone.trim().length < 7) clientErrors.phone = 'Enter a complete phone number or leave it blank.';
    if (!data.service) clientErrors.service = 'Choose the service you need.';
    if (!data.message || data.message.trim().length < 10) clientErrors.message = 'Add a little more detail (at least 10 characters).';
    if (!data.consent) clientErrors.consent = 'Please confirm that we may use these details to respond to your enquiry.';
    if (Object.keys(clientErrors).length) { showErrors(clientErrors); showAlert('Please review the highlighted fields.', 'error'); return; }
    submitButton.disabled = true; submitButton.querySelector('span:first-child').textContent = 'Submitting…';
    try {
      const response = await fetch('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 422) { showErrors(result.fields); showAlert(result.error || 'Please review the highlighted fields.', 'error'); }
      else if (response.status === 409) showAlert(result.error || 'This enquiry may already have been received.', 'error');
      else if (!response.ok) showAlert(result.error || 'We could not submit your enquiry. Please try again.', 'error');
      else { form.reset(); showAlert(`${result.message} Demo record: ${result.leadId ? result.leadId.slice(0, 8) : 'accepted'}.`, 'success'); }
    } catch { showAlert('We could not reach the server. Check your connection and try again.', 'error'); }
    finally { submitButton.disabled = false; submitButton.querySelector('span:first-child').textContent = 'Submit enquiry'; }
  });
}
