#!/usr/bin/env python3
"""definity-reputation-watch — daily VirusTotal + Google Safe Browsing check for definity.finance.

Reads VT_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID from the environment
(systemd EnvironmentFile). Notifies Telegram when the vendor verdict set CHANGES
(vendors cleared / newly flagging, GSB status change), plus a Monday heartbeat.
State in /var/lib/definity-repwatch/state.json. Exit 0 unless both checks fail.
"""
import json, os, sys, urllib.request, datetime

DOMAIN = "definity.finance"
STATE_DIR = "/var/lib/definity-repwatch"
STATE = os.path.join(STATE_DIR, "state.json")
FORCE = "--force" in sys.argv


def http(url, headers=None, data=None, timeout=30):
    req = urllib.request.Request(url, headers=headers or {}, data=data,
                                 method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def check_vt(key):
    raw = http(f"https://www.virustotal.com/api/v3/domains/{DOMAIN}",
               headers={"x-apikey": key})
    attrs = json.loads(raw)["data"]["attributes"]
    res = attrs.get("last_analysis_results", {})
    mal = sorted(e for e, v in res.items() if v.get("category") == "malicious")
    sus = sorted(e for e, v in res.items() if v.get("category") == "suspicious")
    # queue a fresh analysis so tomorrow's read isn't stale (best-effort)
    try:
        http(f"https://www.virustotal.com/api/v3/domains/{DOMAIN}/analyse",
             headers={"x-apikey": key}, data=b"")
    except Exception:
        pass
    return {"malicious": mal, "suspicious": sus}


def check_gsb():
    raw = http("https://transparencyreport.google.com/transparencyreport/api/v3/"
               f"safebrowsing/status?site={DOMAIN}",
               headers={"User-Agent": "Mozilla/5.0"})
    return raw.count("true")  # any true flag = GSB unhappy; 0 = clean


def notify(token, chat, text):
    body = json.dumps({"chat_id": chat, "text": text,
                       "disable_web_page_preview": True}).encode()
    http(f"https://api.telegram.org/bot{token}/sendMessage",
         headers={"Content-Type": "application/json"}, data=body)


def main():
    key = os.environ.get("VT_API_KEY", "")
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat = os.environ.get("TELEGRAM_CHAT_ID", "")

    vt, vt_err = None, None
    try:
        if key:
            vt = check_vt(key)
        else:
            vt_err = "VT_API_KEY not set"
    except Exception as e:
        vt_err = f"VT check failed: {e}"
    try:
        gsb_flags = check_gsb()
    except Exception as e:
        gsb_flags = None
        if vt is None:
            print(f"both checks failed: {vt_err} / GSB: {e}", file=sys.stderr)
            sys.exit(1)

    os.makedirs(STATE_DIR, exist_ok=True)
    prev = {}
    if os.path.exists(STATE):
        try:
            prev = json.load(open(STATE))
        except Exception:
            prev = {}

    now = {"malicious": (vt or {}).get("malicious", prev.get("malicious", [])),
           "suspicious": (vt or {}).get("suspicious", prev.get("suspicious", [])),
           "gsb_flags": gsb_flags if gsb_flags is not None else prev.get("gsb_flags"),
           "ts": datetime.datetime.now(datetime.timezone.utc).isoformat()}

    cleared = sorted(set(prev.get("malicious", [])) - set(now["malicious"])) if vt else []
    added = sorted(set(now["malicious"]) - set(prev.get("malicious", []))) if vt else []
    gsb_changed = prev.get("gsb_flags") is not None and now["gsb_flags"] != prev.get("gsb_flags")
    first_run = not prev
    heartbeat = datetime.datetime.now(datetime.timezone.utc).weekday() == 0  # Monday

    gsb_txt = "clean" if now["gsb_flags"] == 0 else (f"{now['gsb_flags']} FLAG(S)!" if now["gsb_flags"] else "unknown")
    lines = [f"🛡 {DOMAIN} reputation watch"]
    if vt:
        lines.append(f"VirusTotal malicious: {len(now['malicious'])}"
                     + (f" (was {len(prev.get('malicious', []))})" if prev and (cleared or added) else ""))
        if cleared:
            lines.append("✅ cleared: " + ", ".join(cleared))
        if added:
            lines.append("🚨 newly flagging: " + ", ".join(added))
        if now["malicious"] and (first_run or FORCE):
            lines.append("still flagging: " + ", ".join(now["malicious"]))
        if now["suspicious"]:
            lines.append("suspicious: " + ", ".join(now["suspicious"]))
    else:
        lines.append(f"⚠ {vt_err}")
    lines.append(f"Google Safe Browsing: {gsb_txt}")

    should_send = FORCE or first_run or cleared or added or gsb_changed or heartbeat
    print("\n".join(lines))
    if should_send and token and chat:
        try:
            notify(token, chat, "\n".join(lines))
            print("(telegram notified)")
        except Exception as e:
            print(f"telegram notify failed: {e}", file=sys.stderr)

    json.dump(now, open(STATE, "w"), indent=1)


if __name__ == "__main__":
    main()
