#!/usr/bin/env node
// chrome-article.mjs <url> — fetch one page through the user's logged-in
// Chrome session and print the rendered DOM (outerHTML) on stdout.
//
// Exists for paywalled/bot-walled sources (theaustralian.com.au) the plain
// fetcher can't read: the tab runs under the user's real profile, so a
// subscribed session renders the full article. Opens exactly one tab via
// AppleScript and closes it again (closes the whole window only if it had to
// create one). No Chrome state is modified or stored.
//
// Requirements, both surfaced on stderr when missing:
//   - Chrome's View > Developer > "Allow JavaScript from Apple Events"
//   - Automation consent for the calling process (macOS prompts once)
// Exit 0 with HTML on success; exit 1 on any failure so callers fall back to
// their plain-fetch path. Exit 2 on bad usage.
import { execFileSync } from "node:child_process";

const url = process.argv[2];
if (!url || !/^https:\/\/[\w.-]+\//.test(url)) {
  console.error("usage: node .build/chrome-article.mjs <https-url>");
  process.exit(2);
}

// Polled for readyState over 25s, then a 2.5s settle so News Corp's article
// body finishes rendering; a fresh window (Chrome was quit) is closed whole,
// a tab added to an existing window is closed alone.
const SCRIPT = `
on run argv
  set theUrl to item 1 of argv
  tell application "Google Chrome"
    launch
    set madeWindow to false
    if (count of windows) is 0 then
      set w to make new window with properties {URL:theUrl}
      set madeWindow to true
      set tabRef to active tab of w
    else
      set w to front window
      set tabRef to make new tab at end of tabs of w with properties {URL:theUrl}
    end if
    set waited to 0
    repeat while waited < 25
      delay 1
      set waited to waited + 1
      set rs to ""
      try
        set rs to execute tabRef javascript "document.readyState"
      end try
      if rs is "complete" then exit repeat
    end repeat
    delay 2.5
    set pageHtml to ""
    try
      set pageHtml to execute tabRef javascript "document.documentElement.outerHTML"
    on error errMsg
      set pageHtml to "CHROME_JS_ERROR: " & errMsg
    end try
    try
      if madeWindow then
        close w
      else
        close tabRef
      end if
    end try
    return pageHtml
  end tell
end run
`;

let html;
try {
  html = execFileSync("osascript", ["-e", SCRIPT, url], {
    encoding: "utf8", timeout: 150_000, maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  const msg = [e?.stderr, e?.message].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 400);
  if (/not authorized|1743/i.test(msg)) {
    console.error("chrome-article: macOS blocked Apple Events to Chrome – approve this terminal/app under System Settings > Privacy & Security > Automation. " + msg);
  } else {
    console.error("chrome-article: " + msg);
  }
  process.exit(1);
}
// The tab ran but the in-page JS failed – almost always the "Allow JavaScript
// from Apple Events" toggle being off.
if (html.startsWith("CHROME_JS_ERROR:")) {
  console.error(html.slice(0, 400).replace(/\s+/g, " "));
  process.exit(1);
}
// A subscriber's rendered article page is 100KB+; anything skinnier is a
// challenge/error page, not an article.
if (html.length < 20_000) {
  console.error(`chrome-article: suspiciously short page (${html.length} chars) – likely a wall or error page`);
  process.exit(1);
}
process.stdout.write(html);
