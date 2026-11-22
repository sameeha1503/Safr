# Production verification runbook

Run these checks from `frontend/` after each production deployment:

```bash
npm run check:deployment
npm run check:tracking
npm run check:rls
npm run check:rls-auth
npm run check:browser
```

## Monitoring

- Configure the host/load balancer to probe `GET /healthz`. A healthy response is HTTP 200 with `status: "ok"`; it is never cached.
- Ingest stdout as JSON. Dynamic requests include `event`, `requestId`, `method`, redacted `pathname`, `status`, and `durationMs`.
- Alert on repeated HTTP 5xx responses, failed health probes, notification-delivery failures, and elevated server-function latency.
- Forward `X-Request-ID` from the edge so one failed request can be traced through the application logs.

## Real alert delivery

`npm run check:deployment` intentionally sends no message. Before a supervised delivery test:

1. Rotate any Twilio token that has ever been pasted into chat, logs or source control.
2. Ensure `.env` contains each setting only once.
3. Set `NOTIFY_MODE=live` and choose `NOTIFY_CHANNELS=sms`, `whatsapp`, or both.
4. Configure `TWILIO_SMS_FROM` with an SMS-capable Twilio sender and/or `TWILIO_WHATSAPP_FROM` with the approved WhatsApp sender. Never use a personal recipient as a sender.
5. For the WhatsApp Sandbox, the supervised recipient must first join the Sandbox; production-initiated messages may require approved templates.
6. Re-run `npm run check:deployment`, then trigger one consented alert to your own verified test recipient and confirm the provider delivery log.

## Two-device Reunite acceptance test

This step requires two physical phones and cannot be certified by unit tests:

1. On phone A, sign in as the guardian, create a trip and companion invite, and open Reunite.
2. On phone B, open the public invite in a normal browser, grant precise location, and start sharing.
3. Walk at least 20 metres. Confirm phone A updates the marker, accuracy, distance, direction, connection state and battery without refreshing.
4. Background phone B for 60 seconds, reopen it, and confirm the UI honestly reports any browser suspension and resumes.
5. Set and clear a meeting point on phone A; verify both changes on phone B.
6. Hold SOS for two seconds on phone B. Confirm the guardian alert and only place an external call/message in a supervised test.
7. Stop and revoke sharing. Confirm stale broadcasts do not restore the companion marker.

Record browser/OS versions, timestamps and failures. Do not claim background GPS support on a browser that suspends location updates.

## Weak-network test

Use browser developer tools to switch to Slow 3G and then Offline. Verify the global offline banner, the four-second navigation fallback, the standalone offline page, and the 112 dial link. Live maps, new plans, weather and tracking must be described as unavailable rather than current.
