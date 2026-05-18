#!/usr/bin/env node
/**
 * synth.mjs — generate MP3s for narrator lines via ElevenLabs.
 *
 * Reads:  data/voicelines.json
 * Writes: audio/<id>.mp3  (skips files that already exist)
 *
 * Usage:
 *   cp .env.example .env
 *   # edit .env with your ELEVENLABS_API_KEY (and optionally ELEVENLABS_VOICE_ID)
 *   node scripts/synth.mjs               # generate missing lines
 *   node scripts/synth.mjs --force       # regenerate all lines (overwrites)
 *   node scripts/synth.mjs --only id1,id2  # only specific line IDs
 *
 * Requires Node 18+ (uses native fetch).
 * Zero dependencies. Reads .env without dotenv.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VOICELINES = path.join(ROOT, 'data', 'voicelines.json');
const AUDIO_DIR  = path.join(ROOT, 'audio');

// ─── Minimal .env loader ───
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnv();

const API_KEY  = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const MODEL    = process.env.ELEVENLABS_MODEL    || 'eleven_multilingual_v2';

if (!API_KEY) {
  console.error('Missing ELEVENLABS_API_KEY. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

// ─── Args ───
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? new Set((args[onlyIdx + 1] || '').split(',').map(s => s.trim()).filter(Boolean)) : null;

// ─── Run ───
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

const voicelines = JSON.parse(fs.readFileSync(VOICELINES, 'utf8'));

// Flatten to {id, text}[]
const lines = [];
for (const [trigger, arr] of Object.entries(voicelines)) {
  for (const line of arr) {
    if (!line.id || !line.text) continue;
    if (ONLY && !ONLY.has(line.id)) continue;
    lines.push({ trigger, id: line.id, text: line.text });
  }
}

console.log(`Found ${lines.length} line(s) to consider.`);
console.log(`Voice: ${VOICE_ID}    Model: ${MODEL}`);

let generated = 0, skipped = 0, failed = 0;

for (const line of lines) {
  const out = path.join(AUDIO_DIR, `${line.id}.mp3`);
  if (!FORCE && fs.existsSync(out)) { skipped++; continue; }

  process.stdout.write(`[${line.trigger}] ${line.id} ... `);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: line.text,
        model_id: MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(out, buf);
    generated++;
    console.log(`✓ ${(buf.length / 1024).toFixed(1)}kb`);
  } catch (err) {
    failed++;
    console.log(`✗ ${err.message}`);
  }
}

console.log(`\nDone. generated=${generated}  skipped=${skipped}  failed=${failed}`);
if (failed > 0) process.exit(1);
