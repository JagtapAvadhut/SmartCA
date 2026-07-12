# Demo guide

Use this script for Chartered Accountant / client walkthroughs of **Smart CA v1.0 Demo Release**.

## Before you start

1. `npm install && npm run dev`
2. Open the Vite URL (usually `http://localhost:5173/`)
3. Prefer a clean browser profile or clear site LocalStorage if a previous demo left odd state
4. Optional: Settings â†’ Data Integrity â†’ **Repair Derived Data** after heavy ad-hoc clicking

## Demo credentials

| Identifier | Password |
|------------|----------|
| `rajesh.sharma@smartca.in` | `SmartCA@2025` |

**Demo-only.** Plaintext mock auth. Never present these as production credentials.

## Safe claims

You **may** say:

- Frontend practice-management workflows
- Local persistence across refresh
- Invoice/payment/client outstanding stay in sync in the demo
- Roles and permissions gate navigation
- Dark mode and branding update the UI

You **must not** say:

- Connected to GST portal / MCA / banks
- Real AI or real document vault
- Production-grade security
- Real email/SMS/WhatsApp sending

Point to the on-screen **Demo Mode** banner when asked.

## Walkthrough (â‰ˆ20â€“25 minutes)

1. **Login** â€” use the admin demo user above.
2. **Dashboard** â€” click Outstanding / GST widgets; explain numbers come from LocalStorage aggregates.
3. **Clients** â€” create a client; open detail tabs.
4. **Invoice** â€” create for that client (note 18% GST on subtotal unless tax is overridden).
5. **Payment** â€” partial pay; show `partially_paid` and remaining; full pay â†’ `paid`.
6. **Refresh** â€” hard reload; data remains.
7. **Documents** â€” upload metadata, favourite, archive.
8. **Recycle Bin** â€” restore.
9. **Calendar** â€” Month/Week/Day; drag an event.
10. **Accounting** â€” Trial Balance balanced; Refresh Books.
11. **Settings** â€” branding color; create role/user; Data Integrity check.
12. **Dark mode** + **Ctrl/Cmd+K** search.
13. **Logout**.

## Reset procedure

- In-app: use any **Reset Database** control if exposed in settings/tools for your build, **or**
- DevTools â†’ Application â†’ Local Storage â†’ clear `localhost` keys starting with `smart-ca-`, then reload.

## After the demo

Answer limitations honestly using [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) and the product roadmap in the README.
