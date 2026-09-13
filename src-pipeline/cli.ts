#!/usr/bin/env node
import { runPipeline } from './index.js';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const claim = args.find((a) => !a.startsWith('--'));
  const requesterIdx = args.indexOf('--requester');
  const requester = requesterIdx !== -1 ? args[requesterIdx + 1] : undefined;
  const useStdinKey = args.includes('--key-stdin');

  if (!claim) {
    console.error('Usage: pipeline "<claim text>" [--requester "name"] [--key-stdin]');
    console.error('Key: set GEMINI_API_KEY, or pass --key-stdin and pipe the key in. Never a --key flag (research.md §5).');
    process.exit(4);
  }

  const apiKey = useStdinKey ? await readStdin() : process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No API key found. Set GEMINI_API_KEY or use --key-stdin.');
    process.exit(4);
  }

  const result = await runPipeline(claim, apiKey, { requester });
  console.log(JSON.stringify(result, null, 2));

  switch (result.kind) {
    case 'completed':
      process.exit(0);
    case 'rejected':
      process.exit(1);
    case 'needs_review':
      process.exit(2);
    case 'auth_failed':
      process.exit(3);
    case 'needs_clarification':
      process.exit(6);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(5);
});
