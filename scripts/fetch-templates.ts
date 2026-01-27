/**
 * fetch-templates.ts
 *
 * Example script that lists all BCMS templates and logs their IDs and names.
 */

import { createBcmsClient } from './init-client';

async function main() {
  const bcms = createBcmsClient();

  const templates = await bcms.template.getAll();

  console.log('Templates:');
  for (const tpl of templates) {
    console.log(`- ${tpl._id}: ${tpl.name}`);
  }
}

main().catch((error) => {
  console.error('Error fetching templates:', error);
  process.exitCode = 1;
});
// Placeholder: script to fetch all BCMS templates.
// Implement template fetching logic using the BCMS client here.
