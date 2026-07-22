#!/usr/bin/env sh
# AI Docker regression harness — runs against a live Compose stack.
# Usage (from repo root, after docker compose up):
#   sh scripts/ai-docker-regression.sh
# Requires: curl, docker. Uses runtime GEMINI_API_KEY from environment if set.
# NEVER echoes API keys.

set -eu

BASE="${SMARTCA_BASE_URL:-http://localhost:8080}"
API="$BASE/api/v1"

echo "== SmartCA AI Docker regression =="
echo "Base: $BASE"

echo "-- health --"
curl -sf "$BASE/health" >/dev/null

echo "-- login --"
LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"rajesh.sharma@smartca.in","password":"SmartCA@2025"}')
TOKEN=$(printf '%s' "$LOGIN" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  echo "FAIL: could not extract auth token"
  echo "$LOGIN" | head -c 300
  exit 1
fi

auth() { curl -sf -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' "$@"; }

echo "-- get settings --"
SETTINGS=$(auth "$API/ai/settings")
echo "$SETTINGS" | grep -q '"provider"' || { echo "FAIL settings"; exit 1; }

echo "-- save mock --"
auth -X PUT "$API/ai/settings" -d '{"provider":"mock","model":"mock"}' | grep -q '"provider":"mock"'

echo "-- test mock connection --"
TEST_MOCK=$(auth -X POST "$API/ai/settings/test" -d '{"provider":"mock","model":"mock"}')
echo "$TEST_MOCK" | grep -q '"ok":true' || { echo "FAIL mock test: $TEST_MOCK"; exit 1; }
echo "$TEST_MOCK" | grep -q 'Connected' || { echo "FAIL mock message"; exit 1; }

if [ -n "${GEMINI_API_KEY:-}" ]; then
  echo "-- save gemini (runtime key) --"
  MODEL="${GEMINI_MODEL:-gemini-flash-latest}"
  SAVE=$(auth -X PUT "$API/ai/settings" -d "{\"provider\":\"gemini\",\"model\":\"$MODEL\",\"apiKey\":\"$GEMINI_API_KEY\"}")
  echo "$SAVE" | grep -q '"provider":"gemini"' || { echo "FAIL save gemini: $SAVE"; exit 1; }
  echo "$SAVE" | grep -q '"hasApiKey":true' || { echo "FAIL hasApiKey"; exit 1; }

  echo "-- test gemini connection --"
  TEST_G=$(auth -X POST "$API/ai/settings/test" -d "{\"provider\":\"gemini\",\"model\":\"$MODEL\"}")
  echo "$TEST_G" | grep -q '"ok":true' || { echo "FAIL gemini test: $TEST_G"; exit 1; }

  echo "-- stream chat --"
  STREAM=$(auth -N -X POST "$API/ai/chat/stream" -d '{"message":"Reply with the single word OK"}')
  echo "$STREAM" | grep -q 'data:' || { echo "FAIL stream empty"; exit 1; }
else
  echo "-- skip gemini live tests (GEMINI_API_KEY unset) --"
fi

echo "-- chat sessions CRUD --"
CHAT=$(auth -X POST "$API/chat" -d '{"title":"AI regression chat","messages":[]}')
CHAT_ID=$(printf '%s' "$CHAT" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -n1)
if [ -z "$CHAT_ID" ]; then
  echo "FAIL create chat: $CHAT"
  exit 1
fi
auth -X PATCH "$API/chat/$CHAT_ID" -d '{"title":"Renamed AI chat","messages":[{"id":"1","role":"user","content":"hi","timestamp":"2026-01-01T00:00:00Z"},{"id":"2","role":"assistant","content":"hello","timestamp":"2026-01-01T00:00:01Z"}]}' >/dev/null
GOT=$(auth "$API/chat/$CHAT_ID")
echo "$GOT" | grep -q 'Renamed AI chat' || { echo "FAIL rename/persist"; exit 1; }
echo "$GOT" | grep -q 'hello' || { echo "FAIL messages persist"; exit 1; }
auth -X DELETE "$API/chat/$CHAT_ID" >/dev/null

echo "-- switch back to mock --"
auth -X PUT "$API/ai/settings" -d '{"provider":"mock","model":"mock"}' | grep -q '"provider":"mock"'

echo "OK: AI Docker regression passed"
