# LeadFlow Studio — Portfolio Case Study

**Type:** Self-initiated product demonstration · **Audience:** Small service businesses · **Status:** Source implementation prepared; local verification and deployment are pending until run in the developer's environment.

## The problem
A website enquiry is only useful if a business can collect complete details, retain the record, and act on it. A form that simply looks attractive may not protect against incomplete input, repeated submissions, or a lack of follow-up visibility.

## The solution
LeadFlow Studio demonstrates an end-to-end lead intake flow: a visitor submits an enquiry, the server validates it, a duplicate check runs, the lead is stored, and an authenticated team member can review it and update its status. An optional webhook lets the business route new leads to a workflow tool it controls.

## Implementation choices
- **Frontend:** Responsive HTML/CSS/JavaScript with clear focus states, field-level validation, success/error messaging, and reduced-motion support.
- **Backend:** Node.js and Express REST endpoints, server-side validation, bounded request size, security headers, basic in-memory rate limiting, and a honeypot field.
- **Persistence:** JSON file for a simple local demo. It is intentionally identified as a prototype storage choice, not a production database.
- **Admin:** HTTP Basic Authentication protects list/update/delete routes; the interface escapes text before inserting it into the DOM.
- **Integration:** Optional outgoing JSON webhook with a timeout. No external workflow account is included or claimed to be connected.
- **Quality:** Automated Node test suite covers the main API behaviors; the developer must run it locally and record the actual result.

## Capabilities a prospective client can verify
1. Submit a valid sample enquiry.
2. Submit invalid details and observe server-backed validation errors.
3. Submit the same email again within 24 hours and observe duplicate protection.
4. Sign in to the admin dashboard and find the saved record.
5. Change a lead from New to Contacted, Qualified, or Closed.
6. Refresh the page to confirm the update persists.
7. Configure a webhook endpoint and observe delivery status.
8. Run the automated API tests.

## Results and evidence
No client revenue lift, response-time improvement, conversion increase, or operational savings have been measured. The project is a technical demonstration using fictional sample data. Any future performance claim must be based on real client baseline data and a documented measurement period.

## Limitations
This version uses single-instance JSON-file persistence, basic authentication, and in-memory rate limiting. It does not send email or SMS, does not provide retries or a durable webhook queue, does not connect to a CRM by default, and is not designed for sensitive or high-volume production data. A production implementation should use a managed database, proper identity/access control, durable background jobs, monitoring, backups, and deployment-specific security review.

## What I would do next for a real client
1. Confirm lead fields, consent wording, workflow owner, and destination system.
2. Choose a production database and define a data retention policy.
3. Integrate one client-approved destination via authenticated API/webhook.
4. Add durable retries, delivery logs, alerting, and failure recovery.
5. Test duplicate behavior, permissions, accessibility, mobile layouts, and workflow failure scenarios against agreed acceptance criteria.
6. Deploy to the client's approved environment and document handover and maintenance.

## Suggested screenshots
- `01-homepage-desktop.png` — full hero and workflow visual.
- `02-form-validation.png` — missing/invalid fields with accessible errors.
- `03-form-success.png` — success message after a valid sample submission.
- `04-admin-inbox.png` — lead list with mixed statuses.
- `05-admin-status-update.png` — changed status after refresh.
- `06-test-results.png` — actual terminal output from `npm test`.

Only capture screenshots after running the app. Do not present mock screenshots or fictional business outcomes as client evidence.
