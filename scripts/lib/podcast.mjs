// Podcast feeds as a legal text source for creator claims. Transcript first:
// only <podcast:transcript> files the publisher puts in its own RSS are read.
// Audio is never downloaded here. Local Whisper is not wired: it needs a feed whose
// terms allow transcription, and none of the tracked channels has one (2026-10-12).
const decode = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").trim();
const tag = (block, name) => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block); return m ? decode(m[1]) : ""; };
const attrs = (s) => Object.fromEntries([...String(s).matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));

export function parseFeed(xml) {
  const items = [];
  for (const m of String(xml || "").matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const b = m[0];
    const pub = Date.parse(tag(b, "pubDate"));
    const transcripts = [...b.matchAll(/<podcast:transcript\b([^>]*)\/?>/gi)].map((t) => attrs(t[1])).filter((a) => a.url).map((a) => ({ url: a.url, type: a.type || "", language: a.language || null }));
    const enc = /<enclosure\b([^>]*)\/?>/i.exec(b);
    items.push({ guid: tag(b, "guid") || tag(b, "link") || tag(b, "title"), title: tag(b, "title"), date: Number.isFinite(pub) ? new Date(pub).toISOString().slice(0, 10) : null, description: tag(b, "description").replace(/<[^>]+>/g, " ").slice(0, 5000), transcripts, audio: enc ? attrs(enc[1]).url || null : null });
  }
  return items;
}

// Best transcript first: plain text, then VTT/SRT, then the Podcasting 2.0 JSON.
const RANK = ["text/plain", "text/vtt", "application/x-subrip", "application/srt", "application/json", "text/html"];
export const pickTranscript = (ts = []) => [...ts].sort((a, b) => (RANK.indexOf(a.type) + 99) % 99 - (RANK.indexOf(b.type) + 99) % 99)[0] || null;

export function transcriptText(body, type = "") {
  const s = String(body || "");
  if (/json/.test(type)) {
    try { const j = JSON.parse(s); return (j.segments || []).map((x) => x.body || "").join(" ").replace(/\s+/g, " ").trim(); } catch { return ""; }
  }
  if (/html/.test(type)) return decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  // VTT / SRT: drop headers, cue numbers, timestamps and voice tags.
  return s.split(/\r?\n/).filter((l) => l.trim() && !/^WEBVTT|^NOTE\b|^\d+$|-->/.test(l.trim())).map((l) => l.replace(/<[^>]+>/g, "")).join(" ").replace(/\s+/g, " ").trim();
}
