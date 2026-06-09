/**
 * manage-entries.ts
 *
 * Example helpers for creating, updating, deleting and listing BCMS entries
 * with `@thebcms/client` v2. Entry `meta` is keyed by property name and entry
 * `content` uses the node-tree shape (paragraphs, headings, lists, etc.).
 */

import { createBcmsClient } from './init-client';

const bcms = createBcmsClient();
const LNG = 'en';

export async function createBlogEntry() {
  const entry = await bcms.entry.create('blog', {
    statuses: [],
    meta: [
      {
        lng: LNG,
        data: { title: 'My post', slug: 'my-post' },
      },
    ],
    content: [
      {
        lng: LNG,
        nodes: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hello BCMS!' }] },
        ],
      },
    ],
  });

  console.log('Created entry:', entry._id);
  return entry;
}

export async function updateBlogEntry(entryId: string) {
  const updated = await bcms.entry.update('blog', entryId, {
    lng: LNG,
    meta: { title: 'My updated post', slug: 'my-updated-post' },
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Updated body.' }] },
    ],
  });

  console.log('Updated entry:', updated._id);
  return updated;
}

export async function deleteBlogEntry(entryId: string) {
  await bcms.entry.deleteById(entryId, 'blog');
  console.log('Deleted entry:', entryId);
}

export async function listDraftBlogEntries() {
  const entries = await bcms.entry.getAllByStatus('blog', 'draft');
  console.log('Draft entries:', entries.map((e) => e._id));
  return entries;
}

// If executed directly, demonstrate a simple lifecycle.
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
