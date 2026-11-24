# Qatar Project | CRA Duct Management System

One React and Vite app with a dashboard and five module routes.

## Run locally

Install a supported Node.js LTS release with npm. From this directory run:

```sh
npm install
npm run dev
```

Open the local URL Vite prints. Run `npm run build` for the production bundle. A static host must rewrite direct application routes to index.html.

| Route | Workspace |
| --- | --- |
| / | Dashboard |
| /api-service | F-04 API service layer |
| /map-navigation | M-03 Navigation tools |
| /manhole-layout | M-13 Butterfly view |
| /reservation | O-02 Duct space and splice reservation |
| /audit-log | C-08 CRA audit log |

## Demo walkthrough

- **Dashboard:** Inspect a map asset, open a module, or expand a recent reservation. Open My requests from the reservation panel or use the header search with an O-, V-, or Q-prefixed request ID.

- **API:** Send GET /health or /network. Try /sandbox with all five methods.
- **Map:** Use zoom, pan, full extent and extent history. Use the right palette or focus the map and use +, -, P, F, [ and ]. Arrow keys pan the schematic. Select ArcGIS to load the Esri SDK and basemap over the internet. The schematic runs offline.
- **Manhole:** Select MH-102, inspect a connected duct and toggle proposed splices. Switch between access and review contexts. Use the manhole in a reservation.
- **Reservation:** Select DS-201 and DS-202, one route manhole and 24-core fibre. Check and submit to obtain a prefixed ID. Download the report or CSV. For validation examples, try DS-201 plus DS-203, or add locked DS-204.
- **Audit:** Filter by Sign-in and Failed, inspect the repeated-sign-in notice, paginate or export. A submitted reservation adds a session audit event. Use Simulate an auditable event to append a demo sign-in, decision, or override.

## Demo and backend boundary

Demo mode is the default. Reservations, bore holds, drafts, and appended demo events survive reload in the same tab through session storage. Start a fresh tab without a cloned browser session for a clean demonstration. Connected mode keeps authentication tokens and in-progress form values in memory. The fictional asset IDs, sample cable/splice catalogue, first-bore allocation, manhole geometry and audit threshold require CRA confirmation. The source UX draft specifies contiguous In-Place spans, a 100-manhole cap, a proposed 75% default per-bore limit and O/V/Q operator prefixes. The full tender wording for all five assigned clauses and the production payloads were unavailable.

Copy .env.example to .env.local and set VITE_DEMO_MODE=false and VITE_API_BASE_URL to connect an approved backend. Endpoint contracts are GET /network, GET /audit, POST /reservations/check, POST /reservations, and POST /auth/refresh. The refresh endpoint uses a secure session cookie and returns { "accessToken": "..." }. Integrate the CRA identity provider at application startup and supply its token via setAccessToken. Access tokens stay in memory. Apply appropriate server-side CORS, authorisation, operator isolation, transactional capacity holds, and retry/idempotency controls before production use.

The frontend audit viewer has no mutate operations. Production sign-in, decision, override and reservation events must be recorded by trusted server services to durable append-only storage with CRA-approved access, retention and export controls. Demo browser storage is editable by the user and provides no production audit guarantees.

The ArcGIS implementation uses the [Esri MapView API](https://developers.arcgis.com/javascript/latest/references/core/views/MapView/).



## CRA design alignment

The CRA UI/UX draft sections 4, 5.2, 5.7 and 5.9 guide the shell, colour and typography, map symbology, reservation task panel, and phone request monitor. The Arabic toggle mirrors and translates the shell. Workspace translation, CRA branding and production GISNet/PIN/blue-plate search are pending. The five demo modules remain the navigation entries. The API, audit, and full butterfly workspaces use the draft design system because no approved screen artwork was supplied for them.


## Connected SQL Server workflow

The website exposes F-04, M-03, M-13, O-02 and C-08. Open a submitted reservation in My requests to export details or review its manhole splice plans in the butterfly view. Maintenance, access-booking and closure actions are outside this website scope.

Apply server/schema.sql to a dedicated SQL Server database. Give the service account the DmsApplication role. Load a CRA-approved operator-visible network snapshot into dbo.DmsInventory at Id=1. NetworkJson contains manholes, spans and catalog using the structure of src/data/mockData.js. Base bore percentages exclude capacity tracked by this service. Coordinate inventory changes under the CRA.DMS.Capacity application lock and reconcile installed usage before replacing the baseline.

Set DMS_SQL_HOST, DMS_SQL_DATABASE, DMS_SQL_USER, DMS_SQL_PASSWORD, DMS_GATEWAY_SECRET and DMS_PUBLIC_ORIGIN on the server. Run npm run start:api. The service binds to loopback port 4174, configurable by DMS_PORT. Build with VITE_DEMO_MODE=false and VITE_API_BASE_URL=/api. Serve dist with SPA fallback and proxy /api to the loopback service under the same HTTPS origin.

The trusted identity gateway authenticates users, strips all incoming X-DMS-* headers and injects X-DMS-Gateway (server-side shared secret), X-DMS-Subject, X-DMS-Role (operator or reviewer) and X-DMS-Operator (O, V or Q for operators). Keep all database and gateway secrets outside Vite configuration. The gateway owns sign-in, renewal and authentication-event logging. Connect its sign-in audit feed before operational use. SQL workflow writes and their audit events commit together. Expiry is evaluated on workflow reads and writes. Access conflicts use inclusive Qatar calendar dates.

As-built evidence currently references a document. File ingestion, CRA GIS synchronisation, email, and contractual review timers require further work. D-080-05 gives ten working days for duct review while the process diagram gives five.
For staged integration, set VITE_LIVE_SERVICES to a comma-separated subset of inventory, audit and api while demo mode is enabled. The inventory group routes both network and reservation operations to the same backend. Fully connected mode routes every request to the backend.
