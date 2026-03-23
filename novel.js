const { createApp, ref, computed, onMounted, nextTick } = Vue;

createApp({
  setup() {
    const view = ref('list');
    const novels = ref([]);
    const listTab = ref('all');
    const searchText = ref('');
    const filterTag = ref('');
    const openNewMenu = ref(false);
    const settingsShow = ref(false);
    const chatChars = ref([]);
    const allWorldBooks = ref([]);
    const apiConfig = ref({ url: '', key: '', model: '' });
    const uploadFile = ref(null);
const uploadUrlShow = ref(false);
const uploadUrlTitle = ref('');
const uploadUrlContent = ref('');

const confirmUploadUrl = async () => {
  if (!uploadUrlTitle.value.trim()) { alert('请输入标题'); return; }
  if (!uploadUrlContent.value.trim()) { alert('请粘贴文本内容'); return; }
  const now = Date.now();
  novels.value.unshift({
    id: now, title: uploadUrlTitle.value.trim(),
    content: uploadUrlContent.value.trim(), cover: '', type: 'upload',
    tags: [], chars: [], charRelations: '',
    wordCount: uploadUrlContent.value.trim().length,
    createTime: now, updateTime: now
  });
  await saveNovels();
  uploadUrlShow.value = false;
  uploadUrlTitle.value = '';
  uploadUrlContent.value = '';
  alert('导入成功');
};

    const writeCoverFile = ref(null);
    const readContent = ref(null);
    const companionComments = ref(null);

    // ===== 列表页 =====
    const allTags = computed(() => {
      const set = new Set();
      novels.value.forEach(n => (n.tags || []).forEach(t => set.add(t)));
      return Array.from(set);
    });

    const filteredNovels = computed(() => {
      let list = novels.value;
      if (listTab.value !== 'all') list = list.filter(n => n.type === listTab.value);
      if (searchText.value.trim()) list = list.filter(n => n.title.includes(searchText.value.trim()));
      if (filterTag.value) list = list.filter(n => (n.tags || []).includes(filterTag.value));
      return list.slice().sort((a, b) => (b.updateTime || b.createTime) - (a.updateTime || a.createTime));
    });

    const typeLabel = (type) => ({ original: '原创', fanfic: '同人', upload: '上传' }[type] || type);

    const formatTime = (ts) => {
      if (!ts) return '';
      const now = new Date(); const d = new Date(ts);
      const diff = now - d;
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
      if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
      if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前';
      return `${d.getMonth()+1}月${d.getDate()}日`;
    };

    const saveNovels = async () => {
      await dbSet('novels', JSON.parse(JSON.stringify(novels.value)));
    };

    const deleteNovel = async (n) => {
      if (!confirm(`确定删除「${n.title}」吗？`)) return;
      novels.value = novels.value.filter(x => x.id !== n.id);
      await saveNovels();
    };

    // ===== 上传小说 =====
    const triggerUpload = () => {
      openNewMenu.value = false;
      nextTick(() => {
        const el = document.getElementById('novel-upload-file');
        if (el) el.click();
      });
    };

    const triggerWriteCover = () => {
      const el = document.getElementById('novel-write-cover-file');
      if (el) el.click();
    };

    const handleUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const text = await file.text();
      const title = file.name.replace(/\.(txt|md)$/i, '');
      await doImportNovel(title, text);
      e.target.value = '';
    };


    // ===== 手写创作 =====
    const editForm = ref({ id: null, title: '', type: 'original', cover: '', coverUrl: '', content: '', tags: [], chars: [], charRelations: '' });
    const tagInput = ref('');

    const writeWordCount = computed(() => editForm.value.content.length);

    const startWrite = () => {
      openNewMenu.value = false;
      editForm.value = { id: null, title: '', type: 'original', cover: '', coverUrl: '', content: '', tags: [], chars: [], charRelations: '' };
      view.value = 'write';
      nextTick(() => refreshIcons());
    };

    const startWriteEdit = (n) => {
      editForm.value = JSON.parse(JSON.stringify({ ...n, coverUrl: n.cover || '' }));
      view.value = 'write';
      nextTick(() => refreshIcons());
    };

    const applyWriteCoverUrl = () => {
      if (editForm.value.coverUrl.trim()) editForm.value.cover = editForm.value.coverUrl.trim();
    };

    const uploadWriteCover = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => { editForm.value.cover = evt.target.result; e.target.value = ''; };
      reader.readAsDataURL(file);
    };

    const addTag = () => {
      const t = tagInput.value.trim();
      if (!t) return;
      if (!editForm.value.tags.includes(t)) editForm.value.tags.push(t);
      tagInput.value = '';
    };

    const removeTag = (i) => { editForm.value.tags.splice(i, 1); };

    const saveWrite = async () => {
      if (!editForm.value.title.trim()) { alert('请输入标题'); return; }
      const now = Date.now();
      if (editForm.value.id) {
        const idx = novels.value.findIndex(n => n.id === editForm.value.id);
        if (idx !== -1) {
          novels.value[idx] = { ...editForm.value, wordCount: editForm.value.content.length, updateTime: now };
        }
      } else {
        novels.value.unshift({ ...editForm.value, id: now, wordCount: editForm.value.content.length, createTime: now, updateTime: now });
      }
      await saveNovels();
      view.value = 'list';
      nextTick(() => refreshIcons());
    };

    // ===== AI创作 =====
    const aiForm = ref({
      type: 'fanfic', title: '', chars: [], charRelations: '',
      selectedWorldBooks: [], worldDesc: '',
      era: '现代', eraCustom: '', tone: '甜宠', toneCustom: '',
      pov: '第三人称', writingStyle: '', plot: '',
      opening: '', ending: '', special: '',
      minWords: 1000, maxWords: 3000, chapterMode: false
    });
    const aiResult = ref('');
    const aiComment = ref('');
    const aiLoading = ref(false);
    const stylePresets = ref([]);
    const stylePresetName = ref('');

    const startAi = () => {
      openNewMenu.value = false;
      aiResult.value = ''; aiComment.value = '';
      view.value = 'ai';
      nextTick(() => refreshIcons());
    };

    const toggleAiWorldBook = (id) => {
      const idx = aiForm.value.selectedWorldBooks.indexOf(id);
      if (idx === -1) aiForm.value.selectedWorldBooks.push(id);
      else aiForm.value.selectedWorldBooks.splice(idx, 1);
    };

    const saveStylePreset = async () => {
      const name = stylePresetName.value.trim();
      if (!name || !aiForm.value.writingStyle.trim()) { alert('请填写文风描述和预设名称'); return; }
      stylePresets.value.push({ name, prompt: aiForm.value.writingStyle.trim() });
      stylePresetName.value = '';
      await saveStylePresetsDb();
    };

    const saveStylePresetsDb = async () => {
      await dbSet('novelStylePresets', JSON.parse(JSON.stringify(stylePresets.value)));
    };

    const buildAiPrompt = () => {
      const f = aiForm.value;
      const charsDesc = f.chars.map(c => `${c.role==='其他'?c.customRole:c.role}：${c.name}`).join('、');
      const wbContent = allWorldBooks.value.filter(b => f.selectedWorldBooks.includes(b.id)).map(b => b.content).join('；');
      const eraText = f.era === '其他' ? f.eraCustom : f.era;
      const toneText = f.tone === '其他' ? f.toneCustom : f.tone;

      let prompt = '';
      if (f.type === 'fanfic') prompt += '这是一篇同人文。';
      else prompt += '这是一篇原创小说。';
      if (charsDesc) prompt += `\n【登场角色】${charsDesc}`;
      if (f.charRelations) prompt += `\n【角色关系】${f.charRelations}`;
      if (wbContent) prompt += `\n【世界观】${wbContent}`;
      if (f.worldDesc) prompt += `\n【背景设定】${f.worldDesc}`;
      prompt += `\n【时代背景】${eraText}`;
      prompt += `\n【基调】${toneText}`;
      prompt += `\n【叙述视角】${f.pov}`;
      if (f.writingStyle) prompt += `\n【文风要求】${f.writingStyle}`;
      if (f.plot) prompt += `\n【剧情走向】${f.plot}`;
      if (f.opening) prompt += `\n【开头设定】${f.opening}`;
      if (f.ending) prompt += `\n【结局设定】${f.ending}`;
      if (f.special) prompt += `\n【特殊要求】${f.special}`;
      prompt += `\n【字数要求】不少于${f.minWords}字，不超过${f.maxWords}字。`;
      if (f.chapterMode) prompt += '\n【格式要求】生成带章节标题的长文，每章有标题。';
      if (f.title) prompt += `\n【标题】${f.title}`;
      prompt += '\n\n请根据以上设定生成完整的小说内容，注意文笔流畅，情节合理，人物性格鲜明。';
      return prompt;
    };

    const runAiGenerate = async () => {
      if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先在设置里配置API'); return; }
      aiLoading.value = true; aiResult.value = ''; aiComment.value = '';
      try {
        const prompt = buildAiPrompt();
        const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.value.key}` },
          body: JSON.stringify({ model: apiConfig.value.model, messages: [{ role: 'user', content: prompt }] })
        });
        const data = await res.json();
        aiResult.value = data.choices?.[0]?.message?.content || '（生成失败）';
      } catch (e) {
        aiResult.value = '（生成失败：' + e.message + '）';
      }
      aiLoading.value = false;
    };

    const runAiContinue = async () => {
      if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先配置API'); return; }
      aiLoading.value = true;
      try {
        const prompt = `请继续以下小说内容，保持相同的文风和人物性格，继续写500字以上：\n\n${aiResult.value}`;
        const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.value.key}` },
          body: JSON.stringify({ model: apiConfig.value.model, messages: [{ role: 'user', content: prompt }] })
        });
        const data = await res.json();
        aiResult.value += '\n\n' + (data.choices?.[0]?.message?.content || '');
      } catch (e) { alert('续写失败：' + e.message); }
      aiLoading.value = false;
    };

    const runAiComment = async () => {
      if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先配置API'); return; }
      if (!aiForm.value.chars.length) { alert('请先添加角色才能让角色评论'); return; }
      aiLoading.value = true; aiComment.value = '';
      try {
        const charsDesc = aiForm.value.chars.map(c => `${c.role==='其他'?c.customRole:c.role}：${c.name}`).join('、');
        const prompt = `以下是一段小说内容，其中的角色有：${charsDesc}。请让每位角色用各自的性格和口吻，对这段内容发表真实的评价或感想（可以害羞、骄傲、感动、吐槽等，保持各自性格，口语化）。每位角色说一到两句，格式：角色名：内容。\n\n${aiResult.value}`;
        const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.value.key}` },
          body: JSON.stringify({ model: apiConfig.value.model, messages: [{ role: 'user', content: prompt }] })
        });
        const data = await res.json();
        aiComment.value = data.choices?.[0]?.message?.content || '（评论失败）';
      } catch (e) { aiComment.value = '（评论失败：' + e.message + '）'; }
      aiLoading.value = false;
    };

    const saveAiResult = async () => {
      if (!aiResult.value.trim()) return;
      const now = Date.now();
      const title = aiForm.value.title.trim() || `AI创作_${new Date().toLocaleDateString()}`;
      const novel = {
        id: now, title, content: aiResult.value,
        cover: '', type: aiForm.value.type,
        tags: [], chars: JSON.parse(JSON.stringify(aiForm.value.chars)),
        charRelations: aiForm.value.charRelations,
        wordCount: aiResult.value.length,
        createTime: now, updateTime: now
      };
      novels.value.unshift(novel);
      await saveNovels();
      view.value = 'list';
      nextTick(() => refreshIcons());
      alert('已保存');
    };

    // ===== 阅读模式 =====
    const currentNovel = ref({});
    const readSettingOpen = ref(false);
    const readBg = ref('white');
    const readFontSize = ref(16);
    const readLineHeight = ref(1.8);
    const readProgress = ref(0);
    const companionOpen = ref(false);
    const companionChars = ref([]);
    const companionHistory = ref([]);
    const companionLoading = ref(false);

    const readBgOptions = [
      { key: 'white', label: '白', color: '#ffffff', text: '#111111' },
      { key: 'cream', label: '米', color: '#f5f0e8', text: '#333333' },
      { key: 'dark', label: '暗', color: '#2a2a2a', text: '#cccccc' },
      { key: 'black', label: '黑', color: '#111111', text: '#eeeeee' }
    ];

    const readBgStyle = computed(() => {
      const bg = readBgOptions.find(b => b.key === readBg.value) || readBgOptions[0];
      return { background: bg.color, color: bg.text, minHeight: '100vh' };
    });

    const readUiStyle = computed(() => {
      const bg = readBgOptions.find(b => b.key === readBg.value) || readBgOptions[0];
      return { background: `${bg.color}ee`, color: bg.text };
    });

    const openRead = (n) => {
      currentNovel.value = n;
      readProgress.value = 0;
      readSettingOpen.value = false;
      companionOpen.value = false;
      companionHistory.value = [];
      view.value = 'read';
      nextTick(() => refreshIcons());
    };

    const onReadScroll = () => {
      const el = readContent.value;
      if (!el) return;
      const total = el.scrollHeight - el.clientHeight;
      if (total <= 0) { readProgress.value = 100; return; }
      readProgress.value = Math.round((el.scrollTop / total) * 100);
    };

    const openCompanion = () => {
      companionOpen.value = true;
    };

    const toggleCompanionChar = (id) => {
      const idx = companionChars.value.indexOf(id);
      if (idx === -1) companionChars.value.push(id);
      else companionChars.value.splice(idx, 1);
    };

    const triggerCompanionComment = async () => {
      if (!companionChars.value.length) { alert('请先选择角色'); return; }
      if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先配置API'); return; }
      companionLoading.value = true;
      const selectedChars = chatChars.value.filter(c => companionChars.value.includes(c.id));
      const el = readContent.value;
      let currentParagraph = '';
      if (el) {
        const scrollPos = el.scrollTop;
        const content = currentNovel.value.content || '';
        const paragraphs = content.split('\n').filter(p => p.trim());
        const approxIndex = Math.floor((scrollPos / el.scrollHeight) * paragraphs.length);
        currentParagraph = paragraphs.slice(Math.max(0, approxIndex - 1), approxIndex + 3).join('\n');
      }
      for (const ch of selectedChars) {
        try {
          const persona = ch.persona || '';
          const prompt = `你现在扮演角色${ch.name}。${persona ? '人设：' + persona + '。' : ''}以下是正在阅读的小说片段，请以${ch.name}的口吻和性格，对这段内容发表简短的评论或感想（可以感动、吐槽、害羞、联想等，保持角色性格，口语化，30字以内）：\n\n${currentParagraph || currentNovel.value.content.slice(0, 200)}`;
          const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.value.key}` },
            body: JSON.stringify({ model: apiConfig.value.model, messages: [{ role: 'user', content: prompt }] })
          });
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content || '...';
          companionHistory.value.push({ name: ch.name, text });
          await nextTick();
          if (companionComments.value) companionComments.value.scrollTop = companionComments.value.scrollHeight;
        } catch (e) {
          companionHistory.value.push({ name: ch.name, text: '（评论失败）' });
        }
      }
      companionLoading.value = false;
    };

    // ===== 设置 =====
    const apiPresets = ref([]);
const modelList = ref([]);
const showModelDrop = ref(false);

const fetchModels = async () => {
  if (!apiConfig.value.url || !apiConfig.value.key) { alert('请先填写API网址和密钥'); return; }
  try {
    const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${apiConfig.value.key}` }
    });
    const data = await res.json();
    modelList.value = (data.data || []).map(m => m.id);
    showModelDrop.value = true;
  } catch (e) { alert('获取模型失败：' + e.message); }
};

    const openSettings = () => { settingsShow.value = true; openNewMenu.value = false; };
    const saveSettings = async () => {
      await dbSet('apiConfig', JSON.parse(JSON.stringify(apiConfig.value)));
      settingsShow.value = false;
    };
    const importShow = ref(false);
const importTab = ref('url');
const importTitle = ref('');
const importUrl = ref('');
const importContent = ref('');
const importLoading = ref(false);

const parseChapters = (content) => {
  const chapterRegex = /^(第[零一二三四五六七八九十百千\d]+[章节卷回集部][^\n]*|Chapter\s*\d+[^\n]*|【[^】]+】[^\n]*)/gm;
  const matches = [];
  let match;
  while ((match = chapterRegex.exec(content)) !== null) {
    matches.push({ title: match[0].trim(), index: match.index });
  }
  if (matches.length < 2) return null;
  return matches.map((m, i) => {
    const start = m.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    return { title: m.title, content: content.slice(start, end).trim() };
  });
};

const doImportNovel = async (title, content) => {
  const now = Date.now();
  const chapters = parseChapters(content);
  novels.value.unshift({
    id: now, title: title.trim(), content, cover: '', type: 'upload',
    tags: [], chars: [], charRelations: '',
    chapters: chapters || [],
    wordCount: content.length,
    createTime: now, updateTime: now
  });
  await saveNovels();
  importShow.value = false;
  importTitle.value = '';
  importUrl.value = '';
  importContent.value = '';
  alert(chapters ? `导入成功，已自动识别 ${chapters.length} 个章节` : '导入成功');
};

const confirmImportUrl = async () => {
  if (!importTitle.value.trim()) { alert('请输入标题'); return; }
  if (!importUrl.value.trim()) { alert('请输入文件直链URL'); return; }
  importLoading.value = true;
  try {
    const res = await fetch(importUrl.value.trim());
    if (!res.ok) { alert('获取失败，状态码：' + res.status); importLoading.value = false; return; }
    const text = await res.text();
    await doImportNovel(importTitle.value, text);
  } catch (e) {
    alert('获取失败：' + e.message + '\n提示：部分网站有跨域限制，可改用粘贴文本方式');
  }
  importLoading.value = false;
};

const confirmImportPaste = async () => {
  if (!importTitle.value.trim()) { alert('请输入标题'); return; }
  if (!importContent.value.trim()) { alert('请粘贴文本内容'); return; }
  await doImportNovel(importTitle.value, importContent.value.trim());
};

    const goBack = () => { window.location.href = 'world.html'; };

    const backToList = () => {
      view.value = 'list';
      nextTick(() => refreshIcons());
    };

    let lucideTimer = null;
    const refreshIcons = () => { clearTimeout(lucideTimer); lucideTimer = setTimeout(() => lucide.createIcons(), 50); };

    onMounted(async () => {
      const dark = await dbGet('darkMode');
      if (dark) document.body.classList.add('dark');

      const savedFont = await dbGet('customFont');
      if (savedFont && savedFont.src) {
        let style = document.getElementById('custom-font-style');
        if (!style) { style = document.createElement('style'); style.id = 'custom-font-style'; document.head.appendChild(style); }
        style.textContent = `@font-face { font-family: 'CustomGlobalFont'; src: url('${savedFont.src}'); } * { font-family: 'CustomGlobalFont', -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif !important; }`;
      }
      const savedFontSize = await dbGet('customFontSize');
      if (savedFontSize) {
        let fsStyle = document.getElementById('custom-fontsize-style');
        if (!fsStyle) { fsStyle = document.createElement('style'); fsStyle.id = 'custom-fontsize-style'; document.head.appendChild(fsStyle); }
        fsStyle.textContent = `* { font-size: ${savedFontSize}px !important; }`;
      }

      const [savedNovels, savedChars, savedRandomChars, savedWorldBooks, savedApi, savedStylePresets, savedApiPresets] = await Promise.all([
      dbGet('novels'), dbGet('charList'), dbGet('randomCharList'), dbGet('worldBooks'), dbGet('apiConfig'), dbGet('novelStylePresets'), dbGet('apiPresets')
    ]);

      novels.value = savedNovels || [];
      const allChars = [...(savedChars || []), ...(savedRandomChars || [])];
      chatChars.value = allChars;
      allWorldBooks.value = savedWorldBooks || [];
      if (savedApi) apiConfig.value = { url: '', key: '', model: '', ...savedApi };
      if (savedApiPresets) apiPresets.value = savedApiPresets;
      if (savedStylePresets) stylePresets.value = savedStylePresets;

      setTimeout(() => { refreshIcons(); }, 100);
    });

    return {
      view, novels, listTab, searchText, filterTag, openNewMenu, settingsShow,
      chatChars, allWorldBooks, apiConfig, uploadFile, writeCoverFile, readContent, companionComments,
      allTags, filteredNovels, typeLabel, formatTime, deleteNovel,
      triggerUpload, handleUpload,
      editForm, tagInput, writeWordCount,
      startWrite, startWriteEdit, applyWriteCoverUrl, triggerWriteCover, uploadWriteCover,
      addTag, removeTag, saveWrite,
      aiForm, aiResult, aiComment, aiLoading, stylePresets, stylePresetName,
      startAi, toggleAiWorldBook, saveStylePreset, saveStylePresetsDb,
      runAiGenerate, runAiContinue, runAiComment, saveAiResult,
      currentNovel, readSettingOpen, readBg, readFontSize, readLineHeight, readProgress,
      readBgOptions, readBgStyle, readUiStyle,
      companionOpen, companionChars, companionHistory, companionLoading,
      openRead, onReadScroll, openCompanion, toggleCompanionChar, triggerCompanionComment,
      openSettings, saveSettings, backToList, refreshIcons, apiPresets, modelList, showModelDrop, fetchModels, goBack,
      importShow, importTab, importTitle, importUrl, importContent, importLoading,
      confirmImportUrl, confirmImportPaste,

    };
  }
}).mount('#novel-app');
