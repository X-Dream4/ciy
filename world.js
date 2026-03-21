const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    const goBack = () => { window.location.href = 'index.html'; };
    const goForum = () => { window.location.href = 'forum.html'; };

    onMounted(async () => {
      // 加载自定义字体
      const savedFont = await dbGet('customFont');
      if (savedFont && savedFont.src) {
        let style = document.getElementById('custom-font-style');
        if (!style) { style = document.createElement('style'); style.id = 'custom-font-style'; document.head.appendChild(style); }
        style.textContent = `@font-face { font-family: 'CustomGlobalFont'; src: url('${savedFont.src}'); } * { font-family: 'CustomGlobalFont', -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif !important; }`;
      }

      const dark = await dbGet('darkMode');
      if (dark) document.body.classList.add('dark');
      const wp = await dbGet('wallpaper');
      if (wp) { document.body.style.backgroundImage = `url(${wp})`; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center'; }
      lucide.createIcons();
    });

    return { goBack, goForum };
  }
}).mount('#world-app');
