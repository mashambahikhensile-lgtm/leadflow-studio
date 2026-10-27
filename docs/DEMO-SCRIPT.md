# LeadFlow Studio — 3-minute demo script

**Opening (20 seconds)**
"This is LeadFlow Studio, a self-initiated portfolio project for service businesses that need a clearer way to capture and track website enquiries. The sample records are fictional; this is a technical demonstration, not a client deployment."

**Public form (40 seconds)**
"I'll submit a sample enquiry. The form asks for only the key details, shows field-level validation, and requires consent before the server accepts the record. I'll briefly show the validation response, then submit valid sample information."

**Persistence and duplicate check (35 seconds)**
"The server stores the accepted lead in the demo's local data file. If I submit the same email again within 24 hours, the API returns a duplicate warning instead of creating another record."

**Admin workflow (50 seconds)**
"The admin view requires credentials configured outside the source code. I can search or filter the inbox, open a lead's details, and change its status from New to Contacted or Qualified. The update remains after refresh."

**Technical details (35 seconds)**
"The app uses an Express API with server-side validation, bounded request size, basic rate limiting, a honeypot, security headers, and authenticated admin routes. An optional webhook can forward accepted leads to an endpoint the client controls. It is not enabled by default, and the demo does not send email or SMS."

**Close (20 seconds)**
"For a production client, I would replace the JSON file with a managed database, add durable webhook retries and production authentication, then connect the agreed CRM or workflow tool. I'd scope that against the client's existing systems before promising a timeline."

**Before recording:** run `npm test`, launch the server, submit a fictional lead, capture the status update after refresh, and record actual test output. Never show real personal information, passwords, or webhook secrets.
