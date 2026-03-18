const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const tab = ref('like');
    const goBack = () => { window.location.href = 'index.html'; };


    // ===== API、设置、美化等状态 =====
    const api = ref({ url: '', key: '', model: '' });
    const modelList = ref([]);
    const apiPresets = ref([]);
    const presetName = ref('');
    const showPresetPanel = ref(false);
const showModelDrop = ref(false);
const selectModel = (m) => { api.value.model = m; showModelDrop.value = false; };
    const consoleLogs = ref([]);
    const storageInfo = ref({ charName: '', charBio: '', hasBg: false, hasAvatar: false, filmCount: 0, apiUrl: '' });
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

    const wallpaperStyle = computed(() => ({
      backgroundImage: wallpaper.value ? `url(${wallpaper.value})` : 'none'
    }));

    const addLog = (msg, type = 'info') => {
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
      consoleLogs.value.unshift({ msg, type, time });
    };

    // ===== API =====
    const saveApi = async () => {
      await dbSet('apiConfig', { url: api.value.url, key: api.value.key, model: api.value.model });
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

    const savePreset = async () => {
      if (!presetName.value.trim()) { addLog('请输入预设名称', 'warn'); return; }
      apiPresets.value.push({ name: presetName.value.trim(), url: api.value.url, key: api.value.key, model: api.value.model });
      await dbSet('apiPresets', apiPresets.value);
      presetName.value = '';
      addLog('预设已保存');
    };

    const loadPreset = (p) => { api.value = { url: p.url, key: p.key, model: p.model }; addLog(`已加载预设: ${p.name}`); };

    const deletePreset = async (i) => { apiPresets.value.splice(i, 1); await dbSet('apiPresets', apiPresets.value); addLog('预设已删除'); };

    // ===== 导入导出 =====
    const exportData = async () => {
      const keys = ['charName', 'charBio', 'images', 'filmImages', 'apiConfig', 'apiPresets', 'wallpaper', 'appIcons'];
      const result = {};
      for (const k of keys) { result[k] = await dbGet(k); }
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'rolecard-backup.json';
      a.click();
      addLog('数据已导出');
    };

    const triggerImport = () => { importFile.value.click(); };

    const importData = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        for (const [k, v] of Object.entries(data)) { if (v !== null) await dbSet(k, v); }
        addLog('数据已导入，请刷新页面');
        e.target.value = '';
      } catch (err) {
        addLog(`导入失败: ${err.message}`, 'error');
      }
    };

    // ===== 储存查看 =====
    const loadStorageInfo = async () => {
      const name = await dbGet('charName');
      const bio = await dbGet('charBio');
      const imgs = await dbGet('images');
      const films = await dbGet('filmImages');
      const apiConf = await dbGet('apiConfig');
      storageInfo.value = {
        charName: name || '',
        charBio: bio || '',
        hasBg: !!(imgs && imgs.bg),
        hasAvatar: !!(imgs && imgs.avatar),
        filmCount: films ? films.filter(f => !!f).length : 0,
        apiUrl: apiConf ? apiConf.url : ''
      };
    };

    const clearStorage = async () => {
      if (!confirm('确定要清空所有储存数据吗？')) return;
      const keys = ['charName', 'charBio', 'images', 'filmImages', 'apiConfig', 'apiPresets', 'wallpaper', 'appIcons'];
      for (const k of keys) await dbSet(k, null);
      addLog('所有储存已清空', 'warn');
      await loadStorageInfo();
    };

    // ===== 美化 =====
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

    // ===== 初始化 =====
    onMounted(async () => {
      const apiConf = await dbGet('apiConfig');
      if (apiConf) api.value = apiConf;
      const presets = await dbGet('apiPresets');
      if (presets) apiPresets.value = presets;
      const dark = await dbGet('darkMode');
      if (dark) { darkMode.value = true; document.body.classList.add('dark'); }
        const wp = await dbGet('wallpaper');
      if (wp) { wallpaper.value = wp; }

      const icons = await dbGet('appIcons');
      if (icons) appIcons.value = icons;
      await loadStorageInfo();
      lucide.createIcons();
      addLog('页面已加载');
    });

    return {
      tab, api, modelList, apiPresets, presetName, showPresetPanel,
      consoleLogs, storageInfo, darkMode, wallpaper, wallpaperUrl,
      wallpaperStyle, appIcons, importFile, wallpaperFile, iconFile,
      saveApi, fetchModels, savePreset, loadPreset, deletePreset,
      exportData, triggerImport, importData, clearStorage,
      toggleDark, applyWallpaperUrl, triggerWallpaper, uploadWallpaper, clearWallpaper,
      triggerIconUpload, uploadIcon, goBack, showModelDrop, selectModel

    };
  }
}).mount('#like-app');

