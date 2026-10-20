#!/bin/bash
# Give CI's Matilda CLI the model entry the laptop's ~/.matilda/settings.json
# carries. Without it the CLI doesn't know matilda-code's window and assumes
# 131072 tokens, compressing and then dying at ~108k ("Context is too large
# to send safely after automatic compression"): np-score 2026-10-12 and both
# crosstabs repair attempts 2026-10-20 died there with the fix in hand. The
# endpoint serves the full 1M window (laptop sessions run past 280k). No
# secret here: the key is read from MATILDA_API_KEY at run time.
set -euo pipefail
mkdir -p "$HOME/.matilda"
cat > "$HOME/.matilda/settings.json" <<'JSON'
{
  "model": { "name": "matilda-code" },
  "security": { "auth": { "selectedType": "openai" } },
  "modelProviders": {
    "openai": [
      {
        "id": "matilda-code",
        "name": "matilda-code",
        "baseUrl": "https://matilda.maincode.com/api/v1/code",
        "envKey": "MATILDA_API_KEY",
        "generationConfig": { "contextWindowSize": 1048576 }
      }
    ]
  }
}
JSON
