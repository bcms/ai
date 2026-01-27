/**
 * upload-media.ts
 *
 * Demonstrates how to create a directory and upload a file to BCMS.
 * This script assumes you already have a valid media-capable API key.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createBcmsClient } from './init-client';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: ts-node upload-media.ts <path-to-file>');
    process.exit(1);
  }

  const bcms = createBcmsClient();

  const fileName = path.basename(filePath);
  const buffer = await fs.promises.readFile(filePath);

  // Ensure directory exists (or create a dedicated one for this example).
  const dir = await bcms.media.createDir({
    name: 'uploads',
    parentId: null,
  });

  const file = await bcms.media.createFile({
    buffer,
    fileName,
    mime: 'application/octet-stream',
    dirId: dir._id,
  });

  console.log('Uploaded media file:', {
    id: file._id,
    name: file.name,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error uploading media:', error);
    process.exitCode = 1;
  });
}
