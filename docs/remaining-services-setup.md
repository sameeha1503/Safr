# Finish the five deployment repairs

## Database (four issues)

In the Safr project's Supabase SQL Editor, run the entire file `backend/supabase/repairs/20261024_explore_routes_cache_crowd.sql`. It upgrades saved-place attributes and adds saved routes, the persistent place cache, and crowd reports. The transaction is repeatable and does not delete saved places. Existing duplicate place names stop the transaction for manual reconciliation rather than discard user data. It includes access policies and the crowd-report cooldown trigger, then reloads the API schema cache.

The server service-role key can read/write data, but it does not provide a PostgreSQL administrator connection for applying DDL. The query therefore needs to be run by the project administrator, as with the Reunite repair.

## Real notifications (fifth issue)

Real messages require an existing Twilio account, credentials, sender eligibility, and recipient eligibility. Configure secrets privately in `frontend/.env` or your deployed server environment. Do not paste them into chat or commit them.

For SMS, configure:

```dotenv
NOTIFY_MODE=live
NOTIFY_CHANNELS=sms
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_SMS_FROM=your_SMS_capable_sender
```

For WhatsApp testing, use Twilio's [WhatsApp quickstart](https://www.twilio.com/docs/whatsapp/quickstart) and [Sandbox instructions](https://www.twilio.com/docs/whatsapp/sandbox). Configure `TWILIO_WHATSAPP_FROM` with the sender provided by Twilio, and set `NOTIFY_CHANNELS=whatsapp` or `whatsapp,sms`. Each test recipient must join the Sandbox. Follow the provider's messaging window/template requirements: joining a Sandbox does not authorize unrestricted proactive messages, and this app currently sends free-text bodies rather than approved template IDs. For unattended alerts beyond the allowed free-text window, use an eligible SMS sender or implement approved WhatsApp templates before relying on that channel.

Only use `NOTIFY_MODE=mock` intentionally for simulation. Mock results are never confirmed real delivery. Invalid mode/channel settings now fail closed without contacting a provider. No real messages are sent by the deployment checker.

After configuring the environment, restart the app. From `frontend/`, run:

```text
npm run check:deployment
npm run check:rls
```

`check:deployment` checks the four schemas with zero-row requests and reports missing notification settings without printing credentials. A green result means the expected settings/schema are present, not that sender approval, RLS or delivery has been certified. The RLS audit also requires own-row checks using two authenticated accounts.

Finally verify: save and edit a bucket-list place; save/reload a map route; submit a crowd report; confirm persistent-cache read/write through the app. Test real notifications only with a designated recipient's permission, then confirm the message arrived on the device. Provider acceptance alone is not a delivery guarantee.
