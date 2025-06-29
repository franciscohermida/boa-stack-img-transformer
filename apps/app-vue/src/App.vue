<template>
  <div class="flex flex-col gap-2 w-screen h-screen align-middle justify-center items-center">
    <button class="bg-blue-500 text-white p-2 rounded-md" @click="clearCache">Clear Cache</button>
    <div class="flex flex-col gap-2">
      <div class="flex flex-col gap-2 border border-neutral-200 rounded-md p-2">
        <span class="bg-neutral-200 p-1 rounded-md">src="/img.png"</span>
        <img :src="`/img.png`" alt="image" />
      </div>
      <div class="flex flex-col gap-2 border border-neutral-200 rounded-md p-2">
        <span class="bg-neutral-200 p-1 rounded-md">src="/api/assets/img.png?p=thumb60"</span>
        <div>
          <img :src="`/api/assets/img.png?p=thumb60`" alt="image" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
function clearCache() {
  fetch("/api/clear-cache", {
    method: "POST",
  });
}
</script>
