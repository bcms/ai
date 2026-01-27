/**
 * manage-entries.ts
 *
 * Example helpers for creating, updating, deleting and listing BCMS entries.
 * These functions are intentionally simple and can be adapted as needed.
 */

import { createBcmsClient } from './init-client';

const bcms = createBcmsClient();

export async function createBlogEntry() {
  const entry = await bcms.entry.create('blog', {
    meta: {
      title: 'My post',
      slug: 'my-post',
    },
    content: {
      en: {
        body: 'Hello BCMS!',
      },
    },
  });

  console.log('Created entry:', entry._id);
  return entry;
}

export async function updateBlogEntry(entryId: string) {
  const updated = await bcms.entry.update('blog', entryId, {
    meta: {
      title: 'My updated post',
      slug: 'my-updated-post',
    },
  });

  console.log('Updated entry:', updated._id);
  return updated;
}

export async function deleteBlogEntry(entryId: string) {
  await bcms.entry.delete('blog', entryId);
  console.log('Deleted entry:', entryId);
}

export async function listDraftBlogEntries() {
  const entries = await bcms.entry.getAllByStatus('blog', 'draft');
  console.log('Draft entries:', entries.map((e: any) => e._id));
  return entries;
}

// If executed directly, demonstrate a simple lifecycle in dry‑run style.
if (require.main === module) {
  (async () => {
    const created = await createBlogEntry();
    await updateBlogEntry(created._id);
    await listDraftBlogEntries();
    // Comment out deletion in development if you want to inspect the entry.
    await deleteBlogEntry(created._id);
  })().catch((error) => {
    console.error('Error managing entries:', error);
    process.exitCode = 1;
  });
}
// Placeholder: script to create, update, and delete BCMS entries.
// Implement entry management logic using the BCMS client here.
