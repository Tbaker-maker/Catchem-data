# SEND RUNBOOK — Newsletter 001 (target: Aug 24)
The file that goes out: `newsletter/newsletter-001-SEND-READY.html` (proof-
passed Aug 20: typos fixed, links all live-checked, online drop dates added).
Canonical rule: fix in the repo file, re-paste — never hand-edit in Buttondown.

## 1 · Import the waitlist (5 min)
1. formspree.io → log in → your form (`[REDACTED-FORM-ID]`) → **Submissions** tab →
   **Export CSV** button (top right of the submissions table) → save the file.
2. Note the row count. Over 100 subscribers = Buttondown paid tier (~$9/mo);
   ledger it knowingly (COST-LEDGER line exists).
3. buttondown.com → **Subscribers** → **Import** → upload the CSV → map the
   email column → confirm. Imported ≠ emailed — this step is safe.

## 2 · Sender identity (DONE via API if key provided — else 1 min)
Settings → sender name **"Catch'Em News"** · reply-to
**support@catchemtcg.com**. (CC sets this by API when the key is in
User-scope BUTTONDOWN_API_KEY; verify it shows in Settings either way.)

## 3 · Test send (ALWAYS first)
1. **New Email** → switch editor to **raw HTML** mode.
2. Paste the ENTIRE contents of `newsletter-001-SEND-READY.html`.
3. Subject, exactly: `Catch'Em News — One Month to the 30th`
4. **Send test** → tylerrbakerr@gmail.com. Check ON YOUR PHONE:
   masthead renders · dark background holds · the 8 links tap through ·
   the 4 🌐 online-date lines show · no [BRACKET] artifacts.
5. Anything off → fix in the REPO file → tell CC → re-paste. Never patch
   inside Buttondown.

## 4 · Send (Aug 24)
One button. Then breathe. Four months of build behind this email.

## 5 · Post-send (same sitting, optional)
- Save Buttondown's public archive link → drop it in chat; CC wires it into
  the launch arc's [link] slots.
- The app + Pulse capture forms already point at Buttondown — new signups
  flow in automatically from today.
