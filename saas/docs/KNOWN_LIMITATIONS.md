# Known limitations

Smart CA **v1.0 Demo Release** is a frontend demonstration product. Treat every item below as intentional or accepted for this phase.

## Must not be used for

- Real customer personally identifiable information (PII)
- Real statutory filings (GST / ITR / TDS / ROC submissions)
- Production billing, payroll, or bank reconciliations
- Any environment requiring audited security controls

## Technical limitations

| Area | Limitation |
|------|------------|
| Backend | No production API; no multi-tenant server |
| Auth | Simulated login; **plaintext** demo passwords in seed/LocalStorage |
| Authorization | RBAC enforced in the UI only â€” not server-side |
| Storage | Browser LocalStorage quotas and device-local scope |
| Documents | Metadata + mock preview/download â€” no object storage |
| AI | Canned / simulated assistant replies |
| Messaging | Email / SMS / WhatsApp settings do not send messages |
| Government portals | No GSTN / MCA / income-tax integrations |
| Accounting | Demo general ledger derived from invoices/payments + manual journals â€” not a full statutory books product |
| Forgot password | UX stub only (no email token flow) |
| i18n | Language preference stored; UI strings remain English |
| Bundle size | Large seed/mock chunk; Vite may warn about chunk size |
| CI | Playwright suites are local scripts; not claimed as GitHub Actions gates unless configured later |

## Product honesty checklist for demos

- Say â€œdemo / simulationâ€ for AI, documents, messaging, and filings
- Show the in-app **Demo Mode** banner
- Prefer the walkthrough in [DEMO_GUIDE.md](./DEMO_GUIDE.md)

## Production blockers (roadmap)

1. Real API + database with hashed credentials and HTTPS
2. Server-enforced permissions and firm isolation
3. Object storage and virus scanning for documents
4. Immutable audit log
5. Backups, monitoring, and compliance certifications as required by customers

See the README roadmap for phased delivery ideas.
