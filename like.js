const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const drawerOpen = ref(false);
    const tab = ref('like');
    const currentTabTitle = computed(() => ({ like: '喜欢', settings: '设置', theme: '美化' }[tab.value] || ''));
    const goBack = () => { window.location.href = 'index.html'; };

    const api = ref({ url: '', key: '', model: '', summaryUrl: '', summaryKey: '', summaryModel: '' });
    const modelList = ref([]);
    const apiPresets = ref([]);
    const presetName = ref('');
    const showPresetPanel = ref(false);
    const showModelDrop = ref(false);
    const selectModel = (m) => { api.value.model = m; showModelDrop.value = false; };
    const showSummaryModelDrop = ref(false);
    const summaryModelList = ref([]);
    const showSummaryPresetPanel = ref(false);
    const selectSummaryModel = (m) => { api.value.summaryModel = m; showSummaryModelDrop.value = false; };
    const consoleLogs = ref([]);
    const storageInfo = ref({ charName: '', charBio: '', hasBg: false, hasAvatar: false, hasPolaroid: false, filmCount: 0, apiUrl: '', apiModel: '', charCount: 0, roomCount: 0, totalMsgs: 0 });
    const darkMode = ref(false);
    const wallpaper = ref('');
    const wallpaperUrl = ref('');
    const appIcons = ref([
      { key: 'chat',    label: '聊天',  icon: '' },
      { key: 'like',    label: '喜欢',  icon: '' },
      { key: 'world',   label: '世界',  icon: '' },
      { key: 'collect', label: '收藏',  icon: '' },
      { key: 'share',   label: '分享',  icon: '' }
    ]);
    const currentIconKey = ref('');
    const importFile = ref(null);
    const wallpaperFile = ref(null);
    const iconFile = ref(null);

    const fontFile = ref(null);
    const customFontUrl = ref('');
    const customFontName = ref('');
    const previewFontLoaded = ref(false);
    const previewFontStyle = ref({});

    const loadFontFace = (name, src) => {
      return new Promise((resolve, reject) => {
        const font = new FontFace(name, `url(${src})`);
        font.load().then(loaded => {
          document.fonts.add(loaded);
          resolve();
        }).catch(reject);
      });
    };

    const previewFontFromUrl = async () => {
      if (!customFontUrl.value.trim()) return;
      try {
        await loadFontFace('CustomPreviewFont', customFontUrl.value.trim());
        previewFontStyle.value = { fontFamily: "'CustomPreviewFont', sans-serif" };
        previewFontLoaded.value = true;
        customFontName.value = customFontUrl.value.trim().split('/').pop();
        addLog('字体预览加载成功');
      } catch (e) {
        addLog('字体加载失败：' + e.message, 'error');
      }
    };

    const triggerFontUpload = () => { fontFile.value.click(); };

    const previewFontFromFile = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const font = new FontFace('CustomPreviewFont', evt.target.result);
          await font.load();
          document.fonts.add(font);
          previewFontStyle.value = { fontFamily: "'CustomPreviewFont', sans-serif" };
          previewFontLoaded.value = true;
          customFontName.value = file.name;
          // 把字体数据存起来供后续使用
          customFontUrl.value = evt.target.result;
          addLog('字体预览加载成功：' + file.name);
        } catch (err) {
          addLog('字体加载失败：' + err.message, 'error');
        }
        e.target.value = '';
      };
      reader.readAsArrayBuffer(file);
    };

    const applyCustomFont = async () => {
      if (!previewFontLoaded.value) return;
      // 保存字体数据到 IndexedDB
      await dbSet('customFont', { src: customFontUrl.value, name: customFontName.value });
      // 注入全局字体样式
      injectGlobalFont(customFontUrl.value, customFontName.value);
      addLog('字体已应用：' + customFontName.value);
    };

    const injectGlobalFont = (src, name) => {
      let style = document.getElementById('custom-font-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'custom-font-style';
        document.head.appendChild(style);
      }
      style.textContent = `
        @font-face {
          font-family: 'CustomGlobalFont';
          src: url('${src}');
        }
        * { font-family: 'CustomGlobalFont', -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif !important; }
      `;
    };

    const clearCustomFont = async () => {
      await dbSet('customFont', null);
      const style = document.getElementById('custom-font-style');
      if (style) style.remove();
      customFontUrl.value = '';
      customFontName.value = '';
      previewFontLoaded.value = false;
      previewFontStyle.value = {};
      addLog('已恢复默认字体');
    };
    const globalFontSize = ref(15);

    const applyGlobalFontSize = () => {
      let style = document.getElementById('custom-fontsize-style');
      if (!style) { style = document.createElement('style'); style.id = 'custom-fontsize-style'; document.head.appendChild(style); }
      style.textContent = `* { font-size: ${globalFontSize.value}px !important; }`;
    };

    const saveGlobalFontSize = async () => {
      await dbSet('customFontSize', globalFontSize.value);
      applyGlobalFontSize();
      addLog('字体大小已保存：' + globalFontSize.value + 'px');
    };

    const clearGlobalFontSize = async () => {
      globalFontSize.value = 15;
      await dbSet('customFontSize', null);
      const style = document.getElementById('custom-fontsize-style');
      if (style) style.remove();
      addLog('已恢复默认字体大小');
    };

    let lucideTimer = null;
    const refreshIcons = () => { clearTimeout(lucideTimer); lucideTimer = setTimeout(() => lucide.createIcons(), 50); };

    const wallpaperStyle = computed(() => ({ backgroundImage: wallpaper.value ? `url(${wallpaper.value})` : 'none' }));

    const saveGlobalLog = async (log) => {
      const logs = JSON.parse(JSON.stringify((await dbGet('globalLogs')) || []));
      logs.unshift(log);
      if (logs.length > 200) logs.splice(200);
      await dbSet('globalLogs', logs);
    };

    const addLog = (msg, type = 'info') => {
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
      const newLog = { msg, type, time, page: '喜欢App' };
      consoleLogs.value.unshift(newLog);
      saveGlobalLog(newLog);
    };

    const loadGlobalLogs = async () => {
      const logs = (await dbGet('globalLogs')) || [];
      consoleLogs.value = logs;
    };

    const saveApi = async () => {
      await dbSet('apiConfig', { url: api.value.url, key: api.value.key, model: api.value.model, summaryUrl: api.value.summaryUrl, summaryKey: api.value.summaryKey, summaryModel: api.value.summaryModel });
      addLog('API 配置已保存');
    };

    const fetchModels = async () => {
      if (!api.value.url || !api.value.key) { addLog('请先填写 API 网址和密钥', 'warn'); return; }
      try {
        addLog('正在获取模型列表...');
        const res = await fetch(`${api.value.url.replace(/\/$/, '')}/models`, { headers: { Authorization: `Bearer ${api.value.key}` } });
        const data = await res.json();
        modelList.value = (data.data || []).map(m => m.id);
        addLog(`获取到 ${modelList.value.length} 个模型`);
      } catch (e) {
        addLog(`获取模型失败: ${e.message}`, 'error');
      }
    };
    const fetchSummaryModels = async () => {
      const url = api.value.summaryUrl && api.value.summaryUrl.trim() ? api.value.summaryUrl.trim() : api.value.url;
      const key = api.value.summaryKey && api.value.summaryKey.trim() ? api.value.summaryKey.trim() : api.value.key;
      if (!url || !key) { addLog('请先填写总结API网址和密钥', 'warn'); return; }
      try {
        addLog('正在获取总结API模型列表...');
        const res = await fetch(`${url.replace(/\/$/, '')}/models`, { headers: { Authorization: `Bearer ${key}` } });
        const data = await res.json();
        summaryModelList.value = (data.data || []).map(m => m.id);
        showSummaryModelDrop.value = true;
        addLog(`获取到 ${summaryModelList.value.length} 个总结模型`);
      } catch (e) {
        addLog(`获取总结模型失败: ${e.message}`, 'error');
      }
    };

    const loadSummaryPreset = (p) => {
      api.value.summaryUrl = p.url;
      api.value.summaryKey = p.key;
      api.value.summaryModel = p.model;
      showSummaryPresetPanel.value = false;
      addLog(`总结API已加载预设: ${p.name}`);
    };

    const savePreset = async () => {
      if (!presetName.value.trim()) { addLog('请输入预设名称', 'warn'); return; }
      apiPresets.value.push({ name: presetName.value.trim(), url: api.value.url, key: api.value.key, model: api.value.model });
      await dbSet('apiPresets', JSON.parse(JSON.stringify(apiPresets.value)));
      presetName.value = '';
      addLog('预设已保存');
    };

    const loadPreset = (p) => { api.value = { url: p.url, key: p.key, model: p.model }; addLog(`已加载预设: ${p.name}`); };
    const deletePreset = async (i) => { apiPresets.value.splice(i, 1); await dbSet('apiPresets', JSON.parse(JSON.stringify(apiPresets.value))); addLog('预设已删除'); };

    const exportData = async () => {
      const charList = (await dbGet('charList')) || [];
      const roomList = (await dbGet('roomList')) || [];
      const charExtras = {};
      for (const c of charList) {
        charExtras[c.id] = {
          mySettings: await dbGet(`mySettings_${c.id}`),
          peekHistory: await dbGet(`peekHistory_${c.id}`),
          mirrorHistory: await dbGet(`mirrorHistory_${c.id}`)
        };
      }
      const result = {
        charName: await dbGet('charName'), charBio: await dbGet('charBio'),
        images: await dbGet('images'), filmImages: await dbGet('filmImages'),
        apiConfig: await dbGet('apiConfig'), apiPresets: await dbGet('apiPresets'),
        darkMode: await dbGet('darkMode'), wallpaper: await dbGet('wallpaper'),
        appIcons: await dbGet('appIcons'), charList, roomList, charExtras,
        globalLogs: await dbGet('globalLogs')
      };
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `rolecard-backup-${new Date().toLocaleDateString()}.json`;
      a.click();
      addLog('全量数据已导出');
    };

    const triggerImport = () => { importFile.value.click(); };

    const importData = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const basicKeys = ['charName','charBio','images','filmImages','apiConfig','apiPresets','darkMode','wallpaper','appIcons','charList','roomList','globalLogs'];
        for (const k of basicKeys) { if (data[k] !== undefined && data[k] !== null) await dbSet(k, data[k]); }
        if (data.charExtras) {
          for (const [id, extras] of Object.entries(data.charExtras)) {
            if (extras.mySettings) await dbSet(`mySettings_${id}`, extras.mySettings);
            if (extras.peekHistory) await dbSet(`peekHistory_${id}`, extras.peekHistory);
            if (extras.mirrorHistory) await dbSet(`mirrorHistory_${id}`, extras.mirrorHistory);
          }
        }
        addLog('全量数据已导入，请刷新页面');
        e.target.value = '';
      } catch (err) {
        addLog(`导入失败: ${err.message}`, 'error');
      }
    };

    const loadStorageInfo = async () => {
      const [name, bio, imgs, films, apiConf, charList, roomList] = await Promise.all([
        dbGet('charName'), dbGet('charBio'), dbGet('images'), dbGet('filmImages'),
        dbGet('apiConfig'), dbGet('charList'), dbGet('roomList')
      ]);
      const cl = charList || [];
      const rl = roomList || [];
      storageInfo.value = {
        charName: name || '', charBio: bio || '',
        hasBg: !!(imgs && imgs.bg), hasAvatar: !!(imgs && imgs.avatar), hasPolaroid: !!(imgs && imgs.polaroid),
        filmCount: films ? films.filter(f => !!f).length : 0,
        apiUrl: apiConf ? apiConf.url : '', apiModel: apiConf ? apiConf.model : '',
        charCount: cl.length, roomCount: rl.length,
        totalMsgs: cl.reduce((acc, c) => acc + (c.messages ? c.messages.length : 0), 0)
      };
    };

    const clearStorage = async () => {
      if (!confirm('确定要清空所有储存数据吗？')) return;
      const keys = ['charName','charBio','images','filmImages','apiConfig','apiPresets','darkMode','wallpaper','appIcons','charList','roomList','globalLogs'];
      for (const k of keys) await dbSet(k, null);
      addLog('所有储存已清空', 'warn');
      await loadStorageInfo();
    };

    const toggleDark = async () => {
      darkMode.value = !darkMode.value;
      document.body.classList.toggle('dark', darkMode.value);
      await dbSet('darkMode', darkMode.value);
      addLog(`夜间模式已${darkMode.value ? '开启' : '关闭'}`);
    };

    const applyWallpaperUrl = async () => {
      if (!wallpaperUrl.value.trim()) return;
      wallpaper.value = wallpaperUrl.value.trim();
      document.body.style.backgroundImage = `url(${wallpaper.value})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      await dbSet('wallpaper', wallpaper.value);
      addLog('壁纸已设置');
    };

    const triggerWallpaper = () => { wallpaperFile.value.click(); };

    const uploadWallpaper = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        wallpaper.value = evt.target.result;
        document.body.style.backgroundImage = `url(${wallpaper.value})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        await dbSet('wallpaper', wallpaper.value);
        addLog('壁纸已上传');
        e.target.value = '';
      };
      reader.readAsDataURL(file);
    };

    const clearWallpaper = async () => {
      wallpaper.value = '';
      document.body.style.backgroundImage = 'none';
      await dbSet('wallpaper', '');
      addLog('壁纸已清除');
    };

    const triggerIconUpload = (key) => { currentIconKey.value = key; iconFile.value.click(); };

    const uploadIcon = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const idx = appIcons.value.findIndex(a => a.key === currentIconKey.value);
        if (idx !== -1) { appIcons.value[idx].icon = evt.target.result; }
        await dbSet('appIcons', appIcons.value);
        addLog(`图标 "${currentIconKey.value}" 已更新`);
        e.target.value = '';
      };
      reader.readAsDataURL(file);
    };

    onMounted(async () => {
      const [apiConf, presets, dark, wp, icons] = await Promise.all([
        dbGet('apiConfig'), dbGet('apiPresets'), dbGet('darkMode'), dbGet('wallpaper'), dbGet('appIcons')
      ]);
      if (apiConf) api.value = { url: '', key: '', model: '', summaryUrl: '', summaryKey: '', summaryModel: '', ...apiConf };
      if (presets) apiPresets.value = presets;
      if (dark) { darkMode.value = true; document.body.classList.add('dark'); }
      if (wp) { wallpaper.value = wp; }
      if (icons) appIcons.value = icons;
      await Promise.all([loadStorageInfo(), loadGlobalLogs()]);
      const savedFont = await dbGet('customFont');
      if (savedFont && savedFont.src) {
        customFontUrl.value = savedFont.src;
        customFontName.value = savedFont.name || '';
        injectGlobalFont(savedFont.src, savedFont.name);
      }
      const savedFontSize = await dbGet('customFontSize');
      if (savedFontSize) { globalFontSize.value = savedFontSize; applyGlobalFontSize(); }

      refreshIcons();
      addLog('喜欢App已打开');
    });

    return {
      tab, api, modelList, apiPresets, presetName, showPresetPanel, showModelDrop, selectModel,
      consoleLogs, storageInfo, darkMode, wallpaper, wallpaperUrl,
      wallpaperStyle, appIcons, importFile, wallpaperFile, iconFile,
      saveApi, fetchModels, savePreset, loadPreset, deletePreset,
      showSummaryModelDrop, summaryModelList, showSummaryPresetPanel,
      selectSummaryModel, fetchSummaryModels, loadSummaryPreset,
      exportData, triggerImport, importData, clearStorage,
      toggleDark, applyWallpaperUrl, triggerWallpaper, uploadWallpaper, clearWallpaper,
      triggerIconUpload, uploadIcon, goBack, drawerOpen, currentTabTitle,
      fontFile, customFontUrl, customFontName, previewFontLoaded, previewFontStyle,
      previewFontFromUrl, triggerFontUpload, previewFontFromFile, applyCustomFont, clearCustomFont,
      globalFontSize, applyGlobalFontSize, saveGlobalFontSize, clearGlobalFontSize,
    };
  }
}).mount('#like-app');
