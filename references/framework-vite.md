## Vite + Vue Integration

This guide shows a minimal Vite + Vue 3 + TypeScript setup that fetches content from BCMS.

### Create the project

```bash
npm create vite@latest vite-project -- --template vue-ts
cd vite-project
npm install
```

### Install BCMS packages

```bash
npm install @thebcms/client @thebcms/types @thebcms/utils
```

### Standard client constructor

Use the standard BCMS client shape:

```ts
import { Client } from '@thebcms/client';

export const bcms = new Client(
  import.meta.env.VITE_BCMS_ORG_ID || '',
  import.meta.env.VITE_BCMS_INSTANCE_ID || '',
  {
    id: import.meta.env.VITE_BCMS_API_KEY_ID || '',
    secret: import.meta.env.VITE_BCMS_API_KEY_SECRET || '',
  },
);
```

### Example `App.vue`

Fetch and display an entry:

```ts
// main.ts
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

```vue
<!-- App.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { bcms } from './bcms';

const entry = ref<any | undefined>();

onMounted(async () => {
  try {
    entry.value = await bcms.entry.getBySlug('my-first-blog', 'blog');
  } catch {
    entry.value = undefined;
  }
});
</script>

<template>
  <pre>{{ entry }}</pre>
</template>
```

