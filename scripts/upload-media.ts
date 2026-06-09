/**
 * upload-media.ts
 *
 * Uploads a local file to BCMS with `@thebcms/client` v2. Media uploads need a
 * one-time upload token, and the file is sent as a web `File` (Node 20+).
 * Assumes a media-capable API key in BCMS_API_KEY.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createBcmsClient } from './init-client';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx upload-media.ts <path-to-file>');
    process.exit(1);
  }

  const bcms = createBcmsClient();

  const fileName = path.basename(filePath);
  const buffer = await fs.promises.readFile(filePath);

  // Create (or reuse) a directory for this example upload.
  const dir = await bcms.media.createDir({ name: 'uploads' });

  // Uploads require a one-time, short-lived upload token.
  const uploadToken = await bcms.media.requestUploadToken();
  const file = new File([buffer], fileName, { type: 'application/octet-stream' });

  const media = await bcms.media.createFile({
    uploadToken,
    file,
    name: fileName,
    parentId: dir._id,
  });

  console.log('Uploaded media file:', {
    id: media._id,
    name: media.name,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error uploading media:', error);
    process.exitCode = 1;
  });
}
