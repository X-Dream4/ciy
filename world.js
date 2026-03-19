const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    const goBack = () => { window.location.href = 'index.html'; };
    const goForum = () => { window.location.href = 'forum.html'; };

    onMounted(async () => {
      const dark = await dbGet('darkMode');
      if (dark) document.body.classList.add('dark');
      const wp = await dbGet('wallpaper');
      if (wp) { document.body.style.backgroundImage = `url(${wp})`; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center'; }
      lucide.createIcons();
    });

    return { goBack, goForum };
  }
}).mount('#world-app');
