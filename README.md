# Umlas Photobooth Kiosk

PC photobooth kiosk prototype with a PayMongo QR Ph payment flow.

## Run

```powershell
npm run dev
```

Open `http://localhost:3000`.

If an owner's PayMongo key is empty, the app runs in demo mode and marks payments as paid so the kiosk flow can be tested without PayMongo.

The default booth is `booth-demo-001`. You can also open a specific booth:

```text
http://localhost:3000?boothId=booth-demo-001
```

## Configure PayMongo

1. Copy `.env.example` to `.env`.
2. Add Supabase and PayMongo values:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PAYMONGO_SECRET_KEY=sk_test_your_key_here
PUBLIC_BASE_URL=https://your-public-url.example
BOOTH_ID=booth-demo-001
```

3. Create a PayMongo webhook endpoint pointing to:

```text
https://your-public-url.example/api/paymongo/webhook
```

4. Listen for these events:

```text
payment.paid
payment.failed
qrph.expired
```

For local webhook testing, expose the server using a tunnel such as ngrok or Cloudflare Tunnel, then use that public URL as `PUBLIC_BASE_URL`.

## Configure Supabase

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run [supabase/schema.sql](supabase/schema.sql).
4. Copy your project URL and service role key into Vercel environment variables.

The service role key must stay server-side. Do not put it in frontend code.

## Deploy to Vercel

The app is Vercel-ready:

```text
public/                  static kiosk UI
api/booth/config.js      booth config endpoint
api/orders/index.js      order/payment creation endpoint
api/orders/[id].js       order polling endpoint
api/paymongo/webhook.js  PayMongo webhook endpoint
```

Set these Vercel environment variables:

```env
PUBLIC_BASE_URL=https://your-vercel-domain.vercel.app
BOOTH_ID=booth-demo-001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PAYMONGO_SECRET_KEY=sk_test_or_live_key
PAYMONGO_WEBHOOK_SECRET=optional_webhook_secret
```

Then deploy:

```powershell
vercel
vercel --prod
```

After deployment, update `PUBLIC_BASE_URL` to the deployed URL and create/update the PayMongo webhook URL:

```text
https://your-vercel-domain.vercel.app/api/paymongo/webhook
```

## Current Flow

1. Customer chooses a package.
2. Backend resolves the booth, owner, and booth-specific package.
3. Backend creates a PayMongo Payment Intent with QR Ph using that owner's PayMongo key.
3. Kiosk displays the returned QR image.
4. PayMongo sends a webhook when paid, failed, or expired.
5. Kiosk polls the backend until the order is paid.
6. Kiosk moves to the countdown screen.

## Multi-Tenant Model

This prototype is now shaped for many sold machines:

```text
Owner
  id
  businessName
  PayMongo credential reference

Booth
  id
  ownerId
  locationName
  activationCode
  packageIds
  status

Package
  id
  price
  shots
  prints

Order
  id
  ownerId
  boothId
  packageId
  paymentIntentId
  status
```

For production, replace the in-memory seed data in `server.js` with a database. Keep `ownerId` and `boothId` on every payment, order, photo session, print job, support log, and device heartbeat.

## Commercial Fleet Flow

1. You manufacture a booth and create a `booth` record.
2. Buyer creates an owner account in your admin portal.
3. Buyer connects PayMongo or enters PayMongo API credentials.
4. Buyer activates the booth with a device code.
5. Booth stores its `boothId` and downloads its config.
6. Every payment is created for the booth's owner.
7. Webhooks update orders in your cloud.
8. The booth polls or receives live updates and starts the session.

Recommended production additions:

- PostgreSQL or another durable database.
- Encrypted per-owner PayMongo credentials.
- Admin dashboard for owners, booths, packages, branding, and sales.
- Device activation API instead of hardcoded `BOOTH_ID`.
- Device heartbeat and remote diagnostics.
- Signed software update channel.
- Offline queue for completed sessions and print jobs.

## Next Build Steps

- Add camera capture.
- Add layout/template rendering.
- Add printer integration.
- Persist orders in SQLite instead of memory.
- Add a maintenance/admin screen for package prices and printer status.
