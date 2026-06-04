import { getVideoTranscript } from './lib/youtube';

const ids = ['Yscme_iHYts', '7yr_GwZT9TI', 'eWZyhXQIGMQ'];

async function main() {
  for (const id of ids) {
    console.log(`\n=== TRANSCRIPT FOR ${id} ===\n`);
    const t = await getVideoTranscript(id);
    console.log(t || '[NO TRANSCRIPT]');
    console.log('\n--- END ---\n');
  }
}

main().catch(console.error);
