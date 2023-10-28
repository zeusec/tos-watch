# tos-watch
Simple script to monitor for TOS changes on select sites using Playwright. Will keep running and checks each site at random every 45-120 minutes.

#### Install the packagaes:
`npm install playwright playwright-extra playwright-extra-plugin-stealth diff`

#### Don't forget to create a `secret.json` in the root directory and paste this in there and include your webhook.
```
{
  "webhookURL": "discord_webhook"
}
```