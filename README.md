# LeadFlow Studio

**A lead intake and follow-up workflow demo for service businesses.** Self-initiated portfolio project by Mash Web Studio. It is not a client project, and all included sample leads are fictional.

## Screenshots

LeadFlow Studio provides a responsive enquiry form and a private dashboard for managing incoming leads.

### Public homepage
![LeadFlow Studio public homepage](screenshots/01-public-homepage.png)

### Lead intake form
![LeadFlow Studio enquiry form](screenshots/03-enquiry-form-submission-success.png)

### Workflow explanation
![LeadFlow Studio workflow explanation](screenshots/02-workflow-explainer.png)

### Admin dashboard
![LeadFlow Studio admin dashboard](screenshots/04-admin-dashboard-overview.png)

### Lead management
![LeadFlow Studio lead management](screenshots/05-admin-dashboard-lead-list.png)

## The problem
Small service businesses can receive enquiries through their websites but still struggle to collect complete details, spot duplicate submissions, keep a record, and decide what to do next. LeadFlow demonstrates a small, inspectable workflow for those steps.

## What works in this project
- Responsive public enquiry form with client-side and server-side validation.
- Express JSON API with bounded request size, required-field validation, email checks, consent recording, and field-level errors.
- JSON-file persistence for a low-volume local demo.
- Duplicate email check for submissions within 24 hours.
- Honeypot field and in-memory per-IP rate limiting for basic bot/noise resistance.
- Admin dashboard protected with HTTP Basic Authentication; list, search, filter, update status, and delete lead records.
- Optional outgoing webhook POST when `LEAD_WEBHOOK_URL` is configured; the lead is stored even if the webhook fails.
- Security headers, safe HTML escaping in the admin UI, empty/loading/error states, and automated API tests.

## Architecture

```text
Browser form
   │ POST /api/leads
   ▼
Express API ── validation + duplicate check ── JSON file store
   │                                             │
   └── optional HTTPS webhook                    └── Admin API (Basic Auth)
                                                        │
                                                        ▼
                                                  Admin dashboard
```

**Stack:** Node.js 18.17+, Express 4, vanilla HTML/CSS/JavaScript, Node's built-in test runner. No database server or paid service is required for the local demo.

## Run locally

1. Install Node.js 18.17 or newer from <https://nodejs.org/>.
2. Open this project folder in VS Code.
3. In the integrated terminal, run:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env` and change `ADMIN_PASSWORD` to a long unique password. `server.js` does not automatically load `.env`, so either set environment variables in your shell or install/use a local dotenv runner. The easiest dependency-free Windows PowerShell launch is:

   ```powershell
   $env:PORT="3000"
   $env:ADMIN_USER="demo"
   $env:ADMIN_PASSWORD="replace-this-with-a-long-unique-password"
   $env:DATA_FILE="./data/leads.json"
   npm start
   ```

   macOS/Linux:

   ```bash
   PORT=3000 ADMIN_USER=demo ADMIN_PASSWORD='replace-this-with-a-long-unique-password' DATA_FILE=./data/leads.json npm start
   ```

5. Open <http://localhost:3000>. Submit a fictional enquiry.
6. Open <http://localhost:3000/admin.html>. Enter the configured admin username and password when prompted.
7. To load the provided fictional sample records before starting, run `npm run seed`. The seed command refuses to overwrite an existing data file.

The server creates `data/leads.json` on first use. The `.env.example` file documents variables but is not automatically read by Node; this is intentional to avoid adding a configuration dependency to the demo.

## Verify and test

```bash
npm test
```

The tests launch a local ephemeral HTTP server and use a temporary data file. They cover health, validation, authenticated access, create/list, duplicate prevention, status updates, deletion, and invalid status rejection. Tests are automated but should be run on your machine after installing dependencies; do not treat this README as evidence that a third-party deployment was tested.

Manual acceptance checklist:
- [ ] Public form is usable at 375px width and desktop width.
- [ ] Invalid email and missing consent show useful field errors.
- [ ] Valid submission returns a success message and appears in admin.
- [ ] Re-submitting the same email within 24 hours returns a duplicate warning.
- [ ] Admin endpoint rejects unauthenticated requests.
- [ ] Status changes persist after page refresh.
- [ ] Delete removes the selected record.
- [ ] An unavailable webhook does not prevent the lead being stored.
- [ ] Browser console and server terminal have no unexpected errors.

## Optional webhook integration
Set `LEAD_WEBHOOK_URL` to an HTTPS webhook endpoint you control (for example, an n8n Webhook node or Make custom webhook) and restart the server. On each accepted lead, LeadFlow sends a JSON POST shaped like:

```json
{
  "event": "lead.created",
  "lead": {
    "id": "uuid",
    "name": "Sample Visitor",
    "email": "sample@example.com",
    "service": "Website design",
    "status": "new"
  }
}
```

The full payload includes the phone, message, consent flag, timestamps, and source. Only use a webhook endpoint you control and avoid real personal data in demos. The integration is optional; without the environment variable the app remains self-contained. A webhook delivery failure is reported in the submission response but does not roll back the locally stored lead. This is not a durable queue/retry system.

## Deployment notes and limitations

- Best for local demonstration or a single-instance, low-volume demo environment with persistent disk.
- JSON-file storage is not appropriate for concurrent multi-instance production workloads. For a real client, replace it with PostgreSQL/Supabase or another managed database, add migrations, backups, and transactional duplicate protection.
- Basic Auth is suitable for a simple private demo behind HTTPS but is not a complete production identity system. Use strong secrets, HTTPS, secret storage, login protection, and role-based access for production.
- The in-memory rate limit resets when the server restarts and is not shared across instances.
- Webhook delivery has a short timeout but no retry queue or signature verification.
- No real email/SMS messages are sent, no CRM is connected by default, and no AI feature is included because it is not required to demonstrate the core workflow.
- If the hosting platform uses an ephemeral filesystem, leads may be lost on restart. Verify persistence on the chosen host before using it for real submissions.
- The frontend loads Google Fonts from an external provider; if strict self-hosting is needed, remove the import and use system fonts.

## API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | No | Health check |
| POST | `/api/leads` | No | Validate and create a lead |
| GET | `/api/leads` | Basic Auth | List lead records |
| PATCH | `/api/leads/:id/status` | Basic Auth | Update status (`new`, `contacted`, `qualified`, `closed`) |
| DELETE | `/api/leads/:id` | Basic Auth | Delete a lead |

## Suggested GitHub repository presentation

Repository name: `leadflow-studio`

Description: `A responsive lead intake and follow-up demo for service businesses — Node.js, Express, validation, persistent lead records, protected admin view, and optional webhook integration.`

Topics: `nodejs`, `express`, `api`, `lead-management`, `web-development`, `form-validation`, `workflow-automation`, `portfolio-project`.

Before publishing: run tests, remove any real lead data, verify `.env` is ignored, include screenshots, and make the README match the version actually pushed.
