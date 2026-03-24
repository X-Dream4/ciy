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
    const apiConfig = ref({ url: '', key: '', model: '', summaryUrl: '', summaryKey: '', summaryModel: '' });
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
      const idx = novels.value.findIndex(nv => nv.id === currentNovel.value?.id);
      if (idx !== -1) novels.value[idx] = JSON.parse(JSON.stringify(currentNovel.value));
      await dbSet('novels', JSON.parse(JSON.stringify(novels.value)));
    };

    const deleteNovel = async (n) => {
      if (!confirm(`确定删除「${n.title}」吗？`)) return;
      novels.value = novels.value.filter(x => x.id !== n.id);
      await saveNovels();
    };

    // ===== 导入 =====
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
      const chapters = [];
      // 第一个章节标题之前的内容
      if (matches[0].index > 0) {
        const preContent = content.slice(0, matches[0].index).trim();
        if (preContent) {
          chapters.push({ title: '未命名段落', content: preContent, summary: '', comments: [] });
        }
      }
      // 正式章节
      matches.forEach((m, i) => {
        const start = m.index;
        const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
        const chapterContent = content.slice(start, end);
        const firstNewline = chapterContent.indexOf('\n');
        const bodyContent = firstNewline !== -1 ? chapterContent.slice(firstNewline + 1).trim() : chapterContent.trim();
        chapters.push({ title: m.title, content: bodyContent, summary: '', comments: [] });
        // 两个章节之间的游离内容（正常情况没有，但保险处理）
        if (i + 1 < matches.length) {
          const nextStart = matches[i + 1].index;
          const between = content.slice(start + chapterContent.length, nextStart).trim();
          if (between) {
            chapters.push({ title: '未命名段落', content: between, summary: '', comments: [] });
          }
        }
      });
      return chapters;
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
      const title = file.name.replace(/\.(txt|md)$/i, '');
      const tryDecode = (buffer, encoding) => {
        try {
          const decoder = new TextDecoder(encoding, { fatal: true });
          return decoder.decode(buffer);
        } catch { return null; }
      };
      const buffer = await file.arrayBuffer();
      let text = tryDecode(buffer, 'utf-8');
      if (!text || /\ufffd/.test(text.slice(0, 500))) text = tryDecode(buffer, 'gbk');
      if (!text || /\ufffd/.test(text.slice(0, 500))) text = tryDecode(buffer, 'gb2312');
      if (!text) text = tryDecode(buffer, 'big5');
      if (!text) { const decoder = new TextDecoder('gbk'); text = decoder.decode(buffer); }
      await doImportNovel(title, text);
      e.target.value = '';
    };

    // ===== 手写创作 =====
    const editForm = ref({ id: null, title: '', type: 'original', cover: '', coverUrl: '', content: '', synopsis: '', tags: [], chars: [], charRelations: '', chapters: [] });
    const tagInput = ref('');
    const editingChapterIndex = ref(-1);
    const editingSummary = ref(false);
    const editingSummaryText = ref('');

    const editingChapter = ref({ title: '', content: '' });

    const writeWordCount = computed(() => editForm.value.content.length);

    const startWrite = () => {
      openNewMenu.value = false;
      editForm.value = { id: null, title: '', type: 'original', cover: '', coverUrl: '', content: '', tags: [], chars: [], charRelations: '', chapters: [] };
      editingChapterIndex.value = -1;
      view.value = 'write';
      nextTick(() => refreshIcons());
    };

    const startWriteEdit = (n) => {
      editForm.value = JSON.parse(JSON.stringify({ ...n, coverUrl: n.cover || '', synopsis: n.synopsis || '' }));
      editingChapterIndex.value = -1;
      view.value = 'write';
      nextTick(() => refreshIcons());
    };
    // ===== 简介生成 =====
    const synopsisGenShow = ref(false);
    const synopsisGenMode = ref('summary'); // 'summary' | 'content'
    const synopsisGenFrom = ref(1);
    const synopsisGenTo = ref(5);
    const synopsisGenLoading = ref(false);
    const synopsisGenResult = ref('');

    const openSynopsisGen = () => {
      synopsisGenResult.value = '';
      synopsisGenMode.value = 'summary';
      const total = editForm.value.chapters ? editForm.value.chapters.length : 0;
      synopsisGenFrom.value = 1;
      synopsisGenTo.value = Math.min(total, 5);
      synopsisGenShow.value = true;
    };

    const runSynopsisGen = async () => {
      if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先配置API'); return; }
      const n = editForm.value;
      const total = n.chapters ? n.chapters.length : 0;
      if (!total && !n.content) { alert('没有可用的内容'); return; }
      synopsisGenLoading.value = true;
      synopsisGenResult.value = '';
      const from = Math.max(1, parseInt(synopsisGenFrom.value) || 1);
      const to = Math.min(total || 1, parseInt(synopsisGenTo.value) || 1);
      let sourceText = '';
      if (total > 0) {
        const selectedChapters = n.chapters.slice(from - 1, to);
        if (synopsisGenMode.value === 'summary') {
          sourceText = selectedChapters.map((ch, i) => {
            return ch.summary ? `第${from + i}章《${ch.title}》：${ch.summary}` : `第${from + i}章《${ch.title}》：（暂无总结）`;
          }).join('\n');
        } else {
          sourceText = selectedChapters.map((ch, i) => {
            return `第${from + i}章《${ch.title}》\n${ch.content.slice(0, 2000)}`;
          }).join('\n\n');
        }
      } else {
        sourceText = n.content.slice(0, 5000);
      }
      const prompt = `请根据以下小说内容，写一段吸引人的简介，500-100字，不剧透结局，突出亮点和看点，语言生动，风格类似网络小说简介。只需要输出一段简介即可！不要输出任何不相干的文字！\n\n${sourceText}`;
      try {
        const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.value.key}` },
          body: JSON.stringify({ model: apiConfig.value.model, messages: [{ role: 'user', content: prompt }] })
        });
        const data = await res.json();
        synopsisGenResult.value = data.choices?.[0]?.message?.content || '（生成失败）';
      } catch (e) {
        synopsisGenResult.value = '（生成失败：' + e.message + '）';
      }
      synopsisGenLoading.value = false;
    };

    const applySynopsis = () => {
      editForm.value.synopsis = synopsisGenResult.value.trim();
      synopsisGenShow.value = false;
    };

const chapterAddShow = ref(false);
const newChapterTitle = ref('');
const aiNextChapterShow = ref(false);
const aiNextChapterLoading = ref(false);
const aiNextChapterResult = ref('');
const aiNextChapterPlot = ref('');
const aiNextChapterStyle = ref('');
const aiNextChapterMinWords = ref(1000);
const aiNextChapterMaxWords = ref(3000);
const appendMode = ref('chapter');
const aiNextChapterChars = ref([]);
const aiNextChapterSummaryFrom = ref(1);
const aiNextChapterSummaryTo = ref(0);
const aiNextChapterFullFrom = ref(0);
const aiNextChapterFullTo = ref(0);

const openAddChapter = () => {
  newChapterTitle.value = `第${(editForm.value.chapters.length + 1)}章`;
  chapterAddShow.value = true;
};

const confirmAddChapter = () => {
  if (!newChapterTitle.value.trim()) { alert('请输入章节标题'); return; }
  editForm.value.chapters.push({
    title: newChapterTitle.value.trim(),
    content: '',
    summary: '',
    comments: []
  });
  const newIdx = editForm.value.chapters.length - 1;
  chapterAddShow.value = false;
  openChapterEdit(newIdx);
};

const convertToChapters = () => {
  if (!editForm.value.content.trim()) { alert('正文为空，无法转换'); return; }
  if (!confirm('确定将现有正文转换为第一章？')) return;
  editForm.value.chapters = [{
    title: '第一章',
    content: editForm.value.content,
    summary: '',
    comments: []
  }];
  editForm.value.content = '';
};

const openAiNextChapter = () => {
  aiNextChapterResult.value = '';
  aiNextChapterPlot.value = '';
  aiNextChapterChars.value = [];
  const n = editForm.value;
  const total = (n.chapters && n.chapters.length) ? n.chapters.length : 0;
  if (total > 0) {
    aiNextChapterSummaryFrom.value = 1;
    aiNextChapterSummaryTo.value = Math.max(1, total - 1);
    aiNextChapterFullFrom.value = Math.max(1, total - 2);
    aiNextChapterFullTo.value = total;
  }
  aiNextChapterShow.value = true;
};

const runAiNextChapter = async () => {
  if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先配置API'); return; }
  aiNextChapterLoading.value = true;
  aiNextChapterResult.value = '';

  const n = editForm.value;
  const hasChapters = n.chapters && n.chapters.length > 0;
  const total = hasChapters ? n.chapters.length : 0;

  let prompt = `以下是小说《${n.title}》，请续写下一章。\n\n`;

  if (hasChapters && total > 0) {
    // 前情提要：用指定章节的summary
    const sumFrom = Math.max(1, parseInt(aiNextChapterSummaryFrom.value) || 1);
    const sumTo = Math.min(total, parseInt(aiNextChapterSummaryTo.value) || total);
    const summaryChapters = n.chapters.slice(sumFrom - 1, sumTo);
    const hasSummary = summaryChapters.some(ch => ch.summary);
    if (hasSummary) {
      prompt += `【前情提要（第${sumFrom}-${sumTo}章总结）】\n`;
      summaryChapters.forEach((ch, i) => {
        if (ch.summary) {
          prompt += `第${sumFrom + i}章《${ch.title}》：${ch.summary}\n`;
        } else {
          prompt += `第${sumFrom + i}章《${ch.title}》：（暂无总结）\n`;
        }
      });
      prompt += '\n';
    } else {
      prompt += `（提示：第${sumFrom}-${sumTo}章暂无总结，建议先生成章节总结以获得更好的续写效果）\n\n`;
    }

    // 参考全文：用指定章节的完整内容
    const fullFrom = Math.max(1, parseInt(aiNextChapterFullFrom.value) || Math.max(1, total - 2));
    const fullTo = Math.min(total, parseInt(aiNextChapterFullTo.value) || total);
    const fullChapters = n.chapters.slice(fullFrom - 1, fullTo);
    prompt += `【近期章节全文（第${fullFrom}-${fullTo}章）】\n`;
    fullChapters.forEach((ch, i) => {
      prompt += `\n第${fullFrom + i}章《${ch.title}》\n${ch.content.slice(0, 2000)}\n`;
    });
    prompt += '\n';
  } else {
    prompt += `【前文内容】\n${n.content.slice(-2000)}\n\n`;
  }

  // 角色信息
  if (aiNextChapterChars.value.length) {
    const charsDesc = aiNextChapterChars.value.map(c => `${c.role === '其他' ? c.customRole : c.role}：${c.name}`).join('、');
    prompt += `【登场角色】${charsDesc}\n\n`;
  }

  prompt += `请根据以上内容，续写下一章。`;
  if (aiNextChapterPlot.value.trim()) prompt += `\n【下一章方向】${aiNextChapterPlot.value.trim()}`;
  if (aiNextChapterStyle.value.trim()) prompt += `\n【文风要求】${aiNextChapterStyle.value.trim()}`;
  else prompt += `\n【文风要求】保持与前文一致的文风和叙事风格。`;
  prompt += `\n【字数要求】不少于${aiNextChapterMinWords.value}字，不超过${aiNextChapterMaxWords.value}字。`;
  if (hasChapters) {
    prompt += `\n请在第一行单独给出章节标题，格式：【章节标题】，然后换行开始正文内容。`;
  }
  prompt += `\n自然衔接剧情，保持人物性格一致。`;

  try {
    const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.value.key}` },
      body: JSON.stringify({ model: apiConfig.value.model, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    aiNextChapterResult.value = data.choices?.[0]?.message?.content || '（生成失败）';
  } catch (e) {
    aiNextChapterResult.value = '（生成失败：' + e.message + '）';
  }
  aiNextChapterLoading.value = false;
};


const saveAiNextChapter = () => {
  if (!aiNextChapterResult.value.trim()) return;
  const n = editForm.value;
  const hasChapters = n.chapters && n.chapters.length > 0;
  const raw = aiNextChapterResult.value.trim();

  if (hasChapters) {
    const firstLine = raw.split('\n')[0];
    const titleMatch = firstLine.match(/^【(.+)】$/) || firstLine.match(/^第.+章.*/);
    const chapterTitle = titleMatch ? firstLine.replace(/^【|】$/g, '').trim() : `第${n.chapters.length + 1}章`;
    const content = titleMatch ? raw.slice(firstLine.length).trim() : raw;
    n.chapters.push({ title: chapterTitle, content, summary: '', comments: [] });
    aiNextChapterShow.value = false;
    alert(`已添加为「${chapterTitle}」`);
  } else {
    if (appendMode.value === 'append') {
      n.content = n.content + '\n\n' + raw;
      aiNextChapterShow.value = false;
      alert('已追加到正文末尾');
    } else {
      n.chapters = [
        { title: '第一章', content: n.content, summary: '', comments: [] },
        { title: '第二章', content: raw, summary: '', comments: [] }
      ];
      n.content = '';
      aiNextChapterShow.value = false;
      alert('已转换为章节模式，原文为第一章，续写为第二章');
    }
  }
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

    const openChapterEdit = (i) => {
      editingChapterIndex.value = i;
      editingChapter.value = {
        title: editForm.value.chapters[i].title,
        content: editForm.value.chapters[i].content
      };
    };

    const saveChapterEdit = async () => {
      if (editingChapterIndex.value === -1) return;
      editForm.value.chapters[editingChapterIndex.value].title = editingChapter.value.title;
      editForm.value.chapters[editingChapterIndex.value].content = editingChapter.value.content;
      editingChapterIndex.value = -1;
    };

    const cancelChapterEdit = () => { editingChapterIndex.value = -1; };

    const saveWrite = async () => {
      if (!editForm.value.title.trim()) { alert('请输入标题'); return; }
      const now = Date.now();
      const wordCount = editForm.value.chapters && editForm.value.chapters.length
        ? editForm.value.chapters.reduce((a, c) => a + c.content.length, 0)
        : editForm.value.content.length;
      if (editForm.value.id) {
        const idx = novels.value.findIndex(n => n.id === editForm.value.id);
        if (idx !== -1) novels.value[idx] = { ...editForm.value, wordCount, updateTime: now };
      } else {
        novels.value.unshift({ ...editForm.value, id: now, wordCount, createTime: now, updateTime: now });
      }
      await saveNovels();
      view.value = 'list';
      nextTick(() => refreshIcons());
    };

    // ===== AI创作 =====
    const aiForm = ref({
      type: 'fanfic', title: '', tags: [], chars: [], charRelations: '',
      selectedWorldBooks: [], worldDesc: '',
      era: '现代', eraCustom: '', tone: '甜宠', toneCustom: '',
      pov: '第三人称', writingStyle: '', plot: '',
      opening: '', ending: '', special: '',
      minWords: 1000, maxWords: 3000, chapterMode: false
    });
    const aiResult = ref('');
    const aiComment = ref('');
    const aiLoading = ref(false);
const aiTagInput = ref('');

const addAiTag = () => {
  const t = aiTagInput.value.trim();
  if (!t) return;
  if (!aiForm.value.tags) aiForm.value.tags = [];
  if (!aiForm.value.tags.includes(t)) aiForm.value.tags.push(t);
  aiTagInput.value = '';
};

    const stylePresets = ref([]);
    const stylePresetName = ref('');

    const startAi = () => {
      openNewMenu.value = false;
      aiResult.value = ''; aiComment.value = '';
      aiTagInput.value = '';
      aiForm.value.tags = [];
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
      if (!f.title && f.type === 'fanfic') {
        prompt += '\n【标题要求】请在正文开头第一行单独给出标题，格式：《标题》。标题要求：简洁有意境不超过12个字，契合故事风格和情感基调；请你自己从角色设定和剧情中判断谁和谁是CP关系，在标题中体现CP，可以用"名字×名字"格式或者自创有意境的CP称呼；不要直接用角色名堆砌，要有诗意。标题单独一行，正文从第二行开始。';
      } else if (!f.title) {
        prompt += '\n【标题要求】请在正文开头第一行单独给出标题，格式：《标题》，标题简洁有意境不超过12个字，契合故事风格和情感基调。标题单独一行，正文从第二行开始。';
      }
      prompt += '\n【标签要求】请在正文最后单独一行输出标签，格式：#标签1,标签2,标签3（3-6个，每个2-4字，涵盖题材风格情感等，用英文逗号分隔）。';

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
        let raw = data.choices?.[0]?.message?.content || '（生成失败）';
        // 解析末尾标签行
        const tagLineMatch = raw.match(/\n#([^\n]+)$/);
        if (tagLineMatch) {
          const tags = tagLineMatch[1].split(',').map(t => t.trim()).filter(t => t && t.length <= 8);
          if (tags.length) aiForm.value.tags = tags;
          raw = raw.slice(0, raw.lastIndexOf('\n#' + tagLineMatch[1])).trimEnd();
        }
        aiResult.value = raw;
      } catch (e) { aiResult.value = '（生成失败：' + e.message + '）'; }
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
        const prompt = `以下是一段小说内容，其中的角色有：${charsDesc}。请让每位角色用各自的性格和口吻，对这段内容发表真实的评价或感想。每位角色说一到两句，格式：角色名：内容。\n\n${aiResult.value}`;
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
      let title = aiForm.value.title.trim();
      if (!title) {
        const firstLine = aiResult.value.trim().split('\n')[0];
        const titleMatch = firstLine.match(/^《(.+)》/);
        if (titleMatch) {
          title = titleMatch[1].trim();
          aiResult.value = aiResult.value.trim().slice(firstLine.length).trim();
        } else {
          title = `劳斯大大创作_${new Date().toLocaleDateString()}`;
        }
      }
      const novel = {
        id: now, title, content: aiResult.value,
        cover: '', type: aiForm.value.type,
        tags: JSON.parse(JSON.stringify(aiForm.value.tags || [])), chars: JSON.parse(JSON.stringify(aiForm.value.chars)),
        charRelations: aiForm.value.charRelations,
        chapters: [],
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
const readLetterSpacing = ref(0);
const readParaSpacing = ref(0.8);
const readTextColor = ref('');
const readCustomBg = ref('');
const readWallpaper = ref('');
const readWallpaperUrl = ref('');
const readFont = ref('default');
const readCustomFont = ref('');
const readCustomFontName = ref('');
const readCustomFontLoaded = ref(false);
const readIndent = ref(2);
const readFontUploadUrl = ref('');

const readFontOptions = [
  { key: 'default', label: '默认字体', css: '' },
  { key: 'songti', label: '宋体', css: "'SimSun', '宋体', serif" },
  { key: 'kaiti', label: '楷体', css: "'KaiTi', '楷体', cursive" },
  { key: 'fangsong', label: '仿宋', css: "'FangSong', '仿宋', serif" },
  { key: 'heiti', label: '黑体', css: "'SimHei', '黑体', sans-serif" },
  { key: 'georgia', label: 'Georgia', css: "Georgia, 'Times New Roman', serif" },
];

const readTextStyle = computed(() => {
  const n = currentNovel.value;
  let fontFamily = '';
  if (readFont.value === 'custom' && readCustomFont.value) {
    fontFamily = "'NovelReadFont', sans-serif";
  } else {
    const f = readFontOptions.find(o => o.key === readFont.value);
    fontFamily = f?.css || '';
  }
  return {
    fontSize: `${readFontSize.value}px`,
    lineHeight: readLineHeight.value,
    letterSpacing: `${readLetterSpacing.value}px`,
    color: readTextColor.value || undefined,
    fontFamily: fontFamily || undefined,
    textIndent: readIndent.value > 0 ? `${readIndent.value}em` : undefined,
  };
});

const readParaStyle = computed(() => ({
  marginBottom: `${readParaSpacing.value}em`,
}));

const readContentStyle = computed(() => {
  const bg = readBgOptions.find(b => b.key === readBg.value);
  let background = '';
  if (readBg.value === 'custom') {
    background = readCustomBg.value || '#ffffff';
  } else if (readBg.value === 'wallpaper') {
    background = readWallpaper.value ? `url(${readWallpaper.value}) center/cover` : '#f2f2f7';
  } else {
    background = bg?.color || '#ffffff';
  }
  return {
    background,
    color: readTextColor.value || bg?.text || '#111111',
    minHeight: '100vh'
  };
});

const loadReadFont = async (src, name) => {
  try {
    const font = new FontFace('NovelReadFont', `url(${src})`);
    await font.load();
    document.fonts.add(font);
    readCustomFont.value = src;
    readCustomFontName.value = name;
    readCustomFontLoaded.value = true;
    await saveReadSettings();
  } catch (e) { alert('字体加载失败：' + e.message); }
};

const triggerReadFontUpload = () => {
  const el = document.getElementById('novel-read-font-file');
  if (el) el.click();
};

const handleReadFontUpload = async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    await loadReadFont(evt.target.result, file.name);
    e.target.value = '';
  };
  reader.readAsDataURL(file);
};

const applyReadFontUrl = async () => {
  if (!readFontUploadUrl.value.trim()) return;
  await loadReadFont(readFontUploadUrl.value.trim(), readFontUploadUrl.value.trim().split('/').pop());
};

const triggerReadWallpaperUpload = () => {
  const el = document.getElementById('novel-read-wallpaper-file');
  if (el) el.click();
};

const handleReadWallpaperUpload = async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    readWallpaper.value = evt.target.result;
    readBg.value = 'wallpaper';
    await saveReadSettings();
    e.target.value = '';
  };
  reader.readAsDataURL(file);
};

const applyReadWallpaperUrl = async () => {
  if (!readWallpaperUrl.value.trim()) return;
  readWallpaper.value = readWallpaperUrl.value.trim();
  readBg.value = 'wallpaper';
  await saveReadSettings();
};

const saveReadSettings = async () => {
  await dbSet('novelReadSettings', JSON.parse(JSON.stringify({
    readBg: readBg.value, readCustomBg: readCustomBg.value,
    readWallpaper: readWallpaper.value,
    readFontSize: readFontSize.value, readLineHeight: readLineHeight.value,
    readLetterSpacing: readLetterSpacing.value, readParaSpacing: readParaSpacing.value,
    readTextColor: readTextColor.value,
    readFont: readFont.value, readCustomFont: readCustomFont.value, readCustomFontName: readCustomFontName.value,
    readIndent: readIndent.value,
  })));
};

const loadReadSettings = async () => {
  const s = await dbGet('novelReadSettings');
  if (!s) return;
  if (s.readBg) readBg.value = s.readBg;
  if (s.readCustomBg) readCustomBg.value = s.readCustomBg;
  if (s.readWallpaper) readWallpaper.value = s.readWallpaper;
  if (s.readFontSize) readFontSize.value = s.readFontSize;
  if (s.readLineHeight) readLineHeight.value = s.readLineHeight;
  if (s.readLetterSpacing !== undefined) readLetterSpacing.value = s.readLetterSpacing;
  if (s.readParaSpacing !== undefined) readParaSpacing.value = s.readParaSpacing;
  if (s.readTextColor) readTextColor.value = s.readTextColor;
  if (s.readFont) readFont.value = s.readFont;
  if (s.readCustomFont) {
    readCustomFont.value = s.readCustomFont;
    readCustomFontName.value = s.readCustomFontName || '';
    try {
      const font = new FontFace('NovelReadFont', `url(${s.readCustomFont})`);
      await font.load();
      document.fonts.add(font);
      readCustomFontLoaded.value = true;
    } catch {}
  }
  if (s.readIndent !== undefined) readIndent.value = s.readIndent;
};

    const readFontSize = ref(16);
    const readLineHeight = ref(1.8);
    const readProgress = ref(0);
    const companionOpen = ref(false);
    const companionChars = ref([]);
    const companionHistory = ref([]);
    const companionLoading = ref(false);
    const companionCommentsByChapter = ref({});
    const tocOpen = ref(false);
const tocTab = ref('toc');
const bookmarks = ref([]);
const searchQuery = ref('');
const searchResults = ref([]);
const searchLoading = ref(false);
const highlightParaIndex = ref(-1);
const highlightChapterIndex = ref(-1);
let highlightTimer = null;

const currentBookmarks = computed(() => {
  const n = currentNovel.value;
  if (!n.id) return [];
  return (n.bookmarks || []).sort((a, b) => b.time - a.time);
});

const addBookmark = async (chapterIndex, paraIndex, text) => {
  const n = currentNovel.value;
  if (!n.bookmarks) n.bookmarks = [];
  const exists = n.bookmarks.find(b => b.chapterIndex === chapterIndex && b.paraIndex === paraIndex);
  if (exists) { alert('该段落已有书签'); return; }
  const ch = n.chapters?.[chapterIndex];
  n.bookmarks.push({
    id: Date.now(),
    chapterIndex,
    chapterTitle: ch?.title || n.title,
    paraIndex,
    text: text.slice(0, 60),
    time: Date.now()
  });
  const idx = novels.value.findIndex(nv => nv.id === n.id);
  if (idx !== -1) novels.value[idx] = JSON.parse(JSON.stringify(n));
  await saveNovels();
  alert('已加入书签');
};

const deleteBookmark = async (id) => {
  const n = currentNovel.value;
  n.bookmarks = (n.bookmarks || []).filter(b => b.id !== id);
  const idx = novels.value.findIndex(nv => nv.id === n.id);
  if (idx !== -1) novels.value[idx] = JSON.parse(JSON.stringify(n));
  await saveNovels();
};

const jumpToBookmark = (bm) => {
  jumpToChapter(bm.chapterIndex);
  tocOpen.value = false;
  nextTick(() => {
    highlightChapterIndex.value = bm.chapterIndex;
    highlightParaIndex.value = bm.paraIndex;
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
      highlightParaIndex.value = -1;
      highlightChapterIndex.value = -1;
    }, 2000);
    setTimeout(() => {
      const el = document.getElementById(`para-${bm.paraIndex}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  });
};

const doSearch = () => {
  const q = searchQuery.value.trim();
  if (!q) { searchResults.value = []; return; }
  const n = currentNovel.value;
  const results = [];
  if (n.chapters && n.chapters.length) {
    n.chapters.forEach((ch, ci) => {
      const paras = (ch.content || '').split('\n');
      paras.forEach((para, pi) => {
        if (para.includes(q)) {
          const idx = para.indexOf(q);
          const preview = para.slice(Math.max(0, idx - 10), idx + q.length + 30);
          results.push({ chapterIndex: ci, chapterTitle: ch.title, paraIndex: pi, preview, highlight: q });
        }
      });
    });
  } else {
    const paras = (n.content || '').split('\n');
    paras.forEach((para, pi) => {
      if (para.includes(q)) {
        const idx = para.indexOf(q);
        const preview = para.slice(Math.max(0, idx - 10), idx + q.length + 30);
        results.push({ chapterIndex: -1, chapterTitle: n.title, paraIndex: pi, preview, highlight: q });
      }
    });
  }
  searchResults.value = results;
};

const jumpToSearchResult = (r) => {
  if (r.chapterIndex >= 0) jumpToChapter(r.chapterIndex);
  tocOpen.value = false;
  nextTick(() => {
    highlightChapterIndex.value = r.chapterIndex;
    highlightParaIndex.value = r.paraIndex;
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
      highlightParaIndex.value = -1;
      highlightChapterIndex.value = -1;
    }, 2000);
    setTimeout(() => {
      const el = document.getElementById(`para-${r.paraIndex}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  });
};

const paraLongPressTimer = ref(null);
const paraMenuShow = ref(false);
const paraMenuChapterIndex = ref(-1);
const paraMenuParaIndex = ref(-1);
const paraMenuText = ref('');

const onParaTouchStart = (chapterIndex, paraIndex, text, e) => {
  paraLongPressTimer.value = setTimeout(() => {
    paraMenuChapterIndex.value = chapterIndex;
    paraMenuParaIndex.value = paraIndex;
    paraMenuText.value = text;
    paraMenuShow.value = true;
  }, 500);
};

const onParaTouchEnd = () => {
  clearTimeout(paraLongPressTimer.value);
};

const onParaMouseDown = (chapterIndex, paraIndex, text) => {
  paraLongPressTimer.value = setTimeout(() => {
    paraMenuChapterIndex.value = chapterIndex;
    paraMenuParaIndex.value = paraIndex;
    paraMenuText.value = text;
    paraMenuShow.value = true;
  }, 500);
};

const onParaMouseUp = () => {
  clearTimeout(paraLongPressTimer.value);
};

const confirmAddBookmark = async () => {
  await addBookmark(paraMenuChapterIndex.value, paraMenuParaIndex.value, paraMenuText.value);
  paraMenuShow.value = false;
};

    const currentChapterIndex = ref(0);
    const summaryPanelOpen = ref(false);
    const summaryRangeFrom = ref(1);
    const summaryRangeTo = ref(5);
    const summaryGenerating = ref(false);
    const summaryOverwrite = ref(false);
    const summaryProgress = ref('');
    let summaryAbort = false;

    const commentInput = ref('');
    const commentReplyTo = ref(null);
    const commentCharSelectOpen = ref(false);
    const commentLoading = ref(false);
    const selectedCommentChars = ref([]);

    const readBgOptions = [
      { key: 'white', label: '白', color: '#ffffff', text: '#111111' },
      { key: 'cream', label: '米', color: '#f5f0e8', text: '#333333' },
      { key: 'green', label: '护眼', color: '#e8f5e8', text: '#2d4a2d' },
      { key: 'blue', label: '淡蓝', color: '#e8f0f8', text: '#1a2d4a' },
      { key: 'leather', label: '牛皮', color: '#f4e4c1', text: '#4a3010' },
      { key: 'dark', label: '暗', color: '#2a2a2a', text: '#cccccc' },
      { key: 'black', label: '黑', color: '#111111', text: '#eeeeee' },
      { key: 'custom', label: '自定义', color: '#ffffff', text: '#111111' },
      { key: 'wallpaper', label: '壁纸', color: 'transparent', text: '#111111' },
    ];

    const readBgStyle = computed(() => readContentStyle.value);

    const readUiStyle = computed(() => {
      const bg = readBgOptions.find(b => b.key === readBg.value) || readBgOptions[0];
      const color = readTextColor.value || bg.text;
      let bgColor = bg.color;
      if (readBg.value === 'custom') bgColor = readCustomBg.value || '#ffffff';
      else if (readBg.value === 'wallpaper') bgColor = 'rgba(255,255,255,0.85)';
      return { background: `${bgColor}ee`, color };
    });

    const currentChapterContent = computed(() => {
      const n = currentNovel.value;
      if (n.chapters && n.chapters.length > 0) {
        return n.chapters[currentChapterIndex.value]?.content || '';
      }
      return n.content || '';
    });

    const currentChapterTitle = computed(() => {
      const n = currentNovel.value;
      if (n.chapters && n.chapters.length > 0) {
        return n.chapters[currentChapterIndex.value]?.title || n.title;
      }
      return n.title;
    });

    const currentChapterComments = computed(() => {
      const n = currentNovel.value;
      if (!n.chapters || !n.chapters.length) return n.comments || [];
      return n.chapters[currentChapterIndex.value]?.comments || [];
    });

    const jumpToChapter = (i) => {
  currentChapterIndex.value = i;
  tocOpen.value = false;
  editingSummary.value = false;
  editingSummaryText.value = '';
  nextTick(() => { if (readContent.value) readContent.value.scrollTop = 0; });
};


    const prevChapter = () => {
      if (currentChapterIndex.value > 0) {
        currentChapterIndex.value--;
        editingSummary.value = false;
        editingSummaryText.value = '';
        nextTick(() => { if (readContent.value) readContent.value.scrollTop = 0; });
      }
    };

    const nextChapter = () => {
      const n = currentNovel.value;
      if (n.chapters && currentChapterIndex.value < n.chapters.length - 1) {
        currentChapterIndex.value++;
        editingSummary.value = false;
        editingSummaryText.value = '';
        nextTick(() => { if (readContent.value) readContent.value.scrollTop = 0; });
      }
    };

    const openRead = (n) => {
      currentNovel.value = n;
      readProgress.value = 0;
      readSettingOpen.value = false;
      companionOpen.value = false;
      companionHistory.value = [];
      companionCommentsByChapter.value = {};
      currentChapterIndex.value = 0;
      tocOpen.value = false;
      summaryPanelOpen.value = false;
      commentInput.value = '';
      editingSummary.value = false;
      editingSummaryText.value = '';
      commentReplyTo.value = null;
      commentCharSelectOpen.value = false;
      selectedCommentChars.value = [];
      tocTab.value = 'toc';
      bookmarks.value = [];
      searchQuery.value = '';
      searchResults.value = [];
      highlightParaIndex.value = -1;
      highlightChapterIndex.value = -1;
      paraMenuShow.value = false;
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

    const openCompanion = () => { companionOpen.value = true; };

    const toggleCompanionChar = (id) => {
      const idx = companionChars.value.indexOf(id);
      if (idx === -1) companionChars.value.push(id);
      else companionChars.value.splice(idx, 1);
    };

    const triggerCompanionComment = async () => {
      if (!companionChars.value.length) { alert('请先选择角色'); return; }
      if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先配置API'); return; }
      companionLoading.value = true;
      const n = currentNovel.value;
      const ch = n.chapters?.[currentChapterIndex.value];
      const chapterContent = ch?.content || n.content || '';
      const prevSummaries = n.chapters
        ? n.chapters.slice(0, currentChapterIndex.value).filter(c => c.summary).map((c, i) => `第${i+1}章（${c.title}）：${c.summary}`).join('\n')
        : '';
      const selectedChars = chatChars.value.filter(c => companionChars.value.includes(c.id));
      const charsDesc = selectedChars.map(c => `${c.name}${c.persona ? '（人设：' + c.persona.slice(0, 50) + '）' : ''}`).join('、');

      let prompt = `你现在扮演以下角色，正在和用户一起阅读小说：${charsDesc}。\n`;
      if (prevSummaries) prompt += `\n【前情提要（已读章节总结）】\n${prevSummaries}\n`;
      prompt += `\n【当前阅读章节】${ch?.title || ''}\n${chapterContent.slice(0, 4000)}\n`;
      prompt += `\n请以各自角色性格人设，分享阅读这一章的感受（可以感动、紧张、吐槽、猜测后续等），口语化，每人一到两句。格式：\n角色名：评论内容\n每人一行。`;

      try {
        const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.value.key}` },
          body: JSON.stringify({ model: apiConfig.value.model, messages: [{ role: 'user', content: prompt }] })
        });
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || '';
        const lines = reply.split('\n').map(l => l.trim()).filter(l => l);
        const chapterKey = currentChapterIndex.value;
        if (!companionCommentsByChapter.value[chapterKey]) companionCommentsByChapter.value[chapterKey] = [];
        for (const line of lines) {
          const colonIdx = line.indexOf('：') !== -1 ? line.indexOf('：') : line.indexOf(':');
          if (colonIdx <= 0) continue;
          const name = line.slice(0, colonIdx).trim();
          const text = line.slice(colonIdx + 1).trim();
          if (!name || !text) continue;
          companionCommentsByChapter.value[chapterKey].push({ name, text });
          companionHistory.value.push({ name, text });
        }
        await nextTick();
        if (companionComments.value) companionComments.value.scrollTop = companionComments.value.scrollHeight;
      } catch (e) {
        companionHistory.value.push({ name: '系统', text: '评论失败：' + e.message });
      }
      companionLoading.value = false;
    };
const saveSummaryEdit = async () => {
  if (!currentNovel.value.chapters || !currentNovel.value.chapters[currentChapterIndex.value]) return;
  currentNovel.value.chapters[currentChapterIndex.value].summary = editingSummaryText.value.trim();
  const idx = novels.value.findIndex(nv => nv.id === currentNovel.value.id);
  if (idx !== -1) novels.value[idx] = JSON.parse(JSON.stringify(currentNovel.value));
  await saveNovels();
  editingSummary.value = false;
};

    // ===== 章节总结 =====
    const openSummaryPanel = () => {
      const n = currentNovel.value;
      if (!n.chapters || !n.chapters.length) return;
      summaryRangeFrom.value = 1;
      summaryRangeTo.value = Math.min(5, n.chapters.length);
      summaryPanelOpen.value = true;
    };

    const runChapterSummary = async () => {
      if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先配置API'); return; }
      const n = currentNovel.value;
      if (!n.chapters || !n.chapters.length) return;
      const from = Math.max(1, parseInt(summaryRangeFrom.value) || 1);
      const to = Math.min(n.chapters.length, parseInt(summaryRangeTo.value) || n.chapters.length);
      if (from > to) { alert('起始章节不能大于结束章节'); return; }
      const chapters = n.chapters.slice(from - 1, to);
      console.log(`总结范围：第${from}章 到 第${to}章，共${chapters.length}章，slice(${from-1}, ${to})`);
      summaryGenerating.value = true;
      summaryAbort = false;

      const sUrl = (apiConfig.value.summaryUrl && apiConfig.value.summaryUrl.trim()) ? apiConfig.value.summaryUrl.trim() : apiConfig.value.url;
      const sKey = (apiConfig.value.summaryKey && apiConfig.value.summaryKey.trim()) ? apiConfig.value.summaryKey.trim() : apiConfig.value.key;
      const sModel = (apiConfig.value.summaryModel && apiConfig.value.summaryModel.trim()) ? apiConfig.value.summaryModel.trim() : apiConfig.value.model;

      for (let i = 0; i < chapters.length; i++) {
        if (summaryAbort) break;
        const ch = chapters[i];
        const realIndex = from - 1 + i;
        summaryProgress.value = `正在总结第 ${realIndex + 1} 章（${i + 1}/${chapters.length}）...`;
        if (ch.summary && !summaryOverwrite.value) {
        summaryProgress.value = `第 ${realIndex + 1} 章已有总结，跳过`;
        await new Promise(r => setTimeout(r, 200));
        continue;
       }
        try {
          const prompt = `请对以下小说章节进行总结，要求如下：
            1. 用2-4句话概括本章核心情节和重要事件
            2. 提及本章出现的关键人物及其行动
            3. 说明本章对剧情推进的意义或伏笔
            4. 语言简洁，不超过30字
            只输出总结内容，不要有标题、序号或其他多余内容。

            章节标题：${ch.title}

            章节内容：${ch.content.slice(0, 3000)}`;

          const res = await fetch(`${sUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sKey}` },
            body: JSON.stringify({ model: sModel, messages: [{ role: 'user', content: prompt }] })
          });
          const data = await res.json();
          const summary = data.choices?.[0]?.message?.content?.trim() || '';
          currentNovel.value.chapters[realIndex].summary = summary;
          await saveNovels();
        } catch (e) {
          summaryProgress.value = `第 ${from + i} 章总结失败：${e.message}`;
          await new Promise(r => setTimeout(r, 1000));
        }
        await new Promise(r => setTimeout(r, 300));
      }
      summaryGenerating.value = false;
      summaryProgress.value = summaryAbort ? '已中断' : '全部完成';
      setTimeout(() => { if (!summaryGenerating.value) summaryProgress.value = ''; }, 2000);
    };

    const stopSummary = () => { summaryAbort = true; };

    // ===== 评论区 =====
    const addMyComment = async () => {
      if (!commentInput.value.trim()) return;
      const comment = {
        id: Date.now(), type: 'me', name: '我',
        text: commentInput.value.trim(),
        replyTo: commentReplyTo.value ? { id: commentReplyTo.value.id, name: commentReplyTo.value.name, text: commentReplyTo.value.text.slice(0, 20) } : null,
        time: Date.now()
      };
      const n = currentNovel.value;
      if (n.chapters && n.chapters.length) {
        if (!n.chapters[currentChapterIndex.value].comments) n.chapters[currentChapterIndex.value].comments = [];
        n.chapters[currentChapterIndex.value].comments.push(comment);
      } else {
        if (!n.comments) n.comments = [];
        n.comments.push(comment);
      }
      const idx = novels.value.findIndex(nv => nv.id === n.id);
      if (idx !== -1) novels.value[idx] = JSON.parse(JSON.stringify(n));
      commentInput.value = '';
      commentReplyTo.value = null;
      await saveNovels();
    };

    const addCharComments = async () => {
      if (!selectedCommentChars.value.length) { alert('请选择角色'); return; }
      if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先配置API'); return; }
      commentLoading.value = true;
      commentCharSelectOpen.value = false;
      const n = currentNovel.value;
      const ch = n.chapters?.[currentChapterIndex.value];
      const chapterContent = ch?.content || n.content || '';
      const existingComments = currentChapterComments.value.map(c => `${c.name}：${c.text}`).join('\n');
      const prevSummaries = n.chapters
        ? n.chapters.slice(0, currentChapterIndex.value).filter(c => c.summary).map((c, i) => `第${i+1}章（${c.title}）：${c.summary}`).join('\n')
        : '';
      const selectedChars = chatChars.value.filter(c => selectedCommentChars.value.includes(c.id));
      const charsDesc = selectedChars.map(c => `${c.name}${c.persona ? '（人设：' + c.persona.slice(0, 50) + '）' : ''}`).join('、');

      let prompt = `你现在需要扮演以下角色，对这一章节内容发表评论：${charsDesc}。\n`;
      if (prevSummaries) prompt += `\n【前情提要】\n${prevSummaries}\n`;
      prompt += `\n【当前章节】${ch?.title || ''}\n${chapterContent.slice(0, 4000)}\n`;
      if (existingComments) prompt += `\n【已有评论】\n${existingComments}\n`;
      if (commentReplyTo.value) prompt += `\n【正在回复】${commentReplyTo.value.name}：${commentReplyTo.value.text}\n`;
      prompt += `\n请每位角色用各自性格口吻发表评论，谈论剧情，发表自己对剧情的感受，符合人设，口语化，每人一到两句。格式：\n角色名：评论内容\n每人一行，不要有其他内容。`;

      try {
        const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.value.key}` },
          body: JSON.stringify({ model: apiConfig.value.model, messages: [{ role: 'user', content: prompt }] })
        });
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || '';
        const lines = reply.split('\n').map(l => l.trim()).filter(l => l);
        for (const line of lines) {
          const colonIdx = line.indexOf('：') !== -1 ? line.indexOf('：') : line.indexOf(':');
          if (colonIdx <= 0) continue;
          const name = line.slice(0, colonIdx).trim();
          const text = line.slice(colonIdx + 1).trim();
          if (!name || !text) continue;
          const comment = {
            id: Date.now() + Math.random(), type: 'char', name, text,
            replyTo: commentReplyTo.value ? { id: commentReplyTo.value.id, name: commentReplyTo.value.name, text: commentReplyTo.value.text.slice(0, 20) } : null,
            time: Date.now()
          };
          if (n.chapters && n.chapters.length) {
            if (!n.chapters[currentChapterIndex.value].comments) n.chapters[currentChapterIndex.value].comments = [];
            n.chapters[currentChapterIndex.value].comments.push(comment);
          } else {
            if (!n.comments) n.comments = [];
            n.comments.push(comment);
          }
        }
        commentReplyTo.value = null;
        const idx = novels.value.findIndex(nv => nv.id === n.id);
        if (idx !== -1) novels.value[idx] = JSON.parse(JSON.stringify(n));
        await saveNovels();
      } catch (e) { alert('评论失败：' + e.message); }
      commentLoading.value = false;
    };

    const deleteComment = async (commentId) => {
      const n = currentNovel.value;
      if (n.chapters && n.chapters.length) {
        n.chapters[currentChapterIndex.value].comments = (n.chapters[currentChapterIndex.value].comments || []).filter(c => c.id !== commentId);
      } else {
        n.comments = (n.comments || []).filter(c => c.id !== commentId);
      }
      const idx = novels.value.findIndex(nv => nv.id === n.id);
      if (idx !== -1) novels.value[idx] = JSON.parse(JSON.stringify(n));
      await saveNovels();
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
      await dbSet('novelApiConfig', JSON.parse(JSON.stringify(apiConfig.value)));
      settingsShow.value = false;
    };

    const goBack = () => { window.location.href = 'world.html'; };

    const backToList = () => {
      view.value = 'list';
      readSettingOpen.value = false;
      nextTick(() => refreshIcons());
    };

    let lucideTimer = null;
    const refreshIcons = () => {
      clearTimeout(lucideTimer);
      lucideTimer = setTimeout(() => {
        lucide.createIcons();
        setTimeout(() => lucide.createIcons(), 200);
      }, 50);
    };
Vue.watch(() => view.value, () => {
  nextTick(() => {
    lucide.createIcons();
  });
});

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

      const [savedNovels, savedChars, savedRandomChars, savedWorldBooks, savedApi, savedNovelApi, savedStylePresets, savedApiPresets] = await Promise.all([
        dbGet('novels'), dbGet('charList'), dbGet('randomCharList'), dbGet('worldBooks'),
        dbGet('apiConfig'), dbGet('novelApiConfig'), dbGet('novelStylePresets'), dbGet('apiPresets')
      ]);

      novels.value = savedNovels || [];
      chatChars.value = [...(savedChars || []), ...(savedRandomChars || [])];
      allWorldBooks.value = savedWorldBooks || [];
      if (savedNovelApi) {
        apiConfig.value = { url: '', key: '', model: '', summaryUrl: '', summaryKey: '', summaryModel: '', ...savedNovelApi };
      } else if (savedApi) {
        apiConfig.value = { url: '', key: '', model: '', summaryUrl: '', summaryKey: '', summaryModel: '', ...savedApi };
      }
      if (savedApiPresets) apiPresets.value = savedApiPresets;
      if (savedStylePresets) stylePresets.value = savedStylePresets;

      await loadReadSettings();

      setTimeout(() => {
        lucide.createIcons();
        refreshIcons();
      }, 100);
      setTimeout(() => { lucide.createIcons(); }, 500);
    });

    return {
      view, novels, listTab, searchText, filterTag, openNewMenu, settingsShow,
      chatChars, allWorldBooks, apiConfig, readContent, companionComments,
      allTags, filteredNovels, typeLabel, formatTime, deleteNovel,
      triggerUpload, handleUpload,
      importShow, importTab, importTitle, importUrl, importContent, importLoading,
      confirmImportUrl, confirmImportPaste,
      editForm, tagInput, writeWordCount,
      startWrite, startWriteEdit, applyWriteCoverUrl, triggerWriteCover, uploadWriteCover,
      addTag, removeTag, saveWrite,
      editingChapterIndex, editingChapter, openChapterEdit, saveChapterEdit, cancelChapterEdit,
      aiForm, aiResult, aiComment, aiLoading, stylePresets, stylePresetName,
      startAi, toggleAiWorldBook, saveStylePreset, saveStylePresetsDb,
      runAiGenerate, runAiContinue, runAiComment, saveAiResult,
      currentNovel, readSettingOpen, readBg, readFontSize, readLineHeight, readProgress,
      readBgOptions, readBgStyle, readUiStyle,
      companionOpen, companionChars, companionHistory, companionLoading, companionCommentsByChapter,
      tocOpen, currentChapterIndex, currentChapterContent, currentChapterTitle, currentChapterComments,
      jumpToChapter, prevChapter, nextChapter,
      summaryPanelOpen, summaryRangeFrom, summaryRangeTo, summaryGenerating, summaryProgress,
      openSummaryPanel, runChapterSummary, stopSummary,
      commentInput, commentReplyTo, commentCharSelectOpen, commentLoading, selectedCommentChars,
      addMyComment, addCharComments, deleteComment,
      openRead, onReadScroll, openCompanion, toggleCompanionChar, triggerCompanionComment,
      openSettings, saveSettings, backToList, refreshIcons,
      apiPresets, modelList, showModelDrop, fetchModels, goBack, editingSummary, editingSummaryText, saveSummaryEdit, summaryOverwrite,
readLetterSpacing, readParaSpacing, readTextColor, readCustomBg,
readWallpaper, readWallpaperUrl, readFontUploadUrl,
readFont, readCustomFont, readCustomFontName, readCustomFontLoaded,
readIndent, readFontOptions, readTextStyle, readParaStyle, readContentStyle,
loadReadFont, triggerReadFontUpload, handleReadFontUpload, applyReadFontUrl,
triggerReadWallpaperUpload, handleReadWallpaperUpload, applyReadWallpaperUrl,
saveReadSettings,
tocTab, currentBookmarks, addBookmark, deleteBookmark, jumpToBookmark,
searchQuery, searchResults, doSearch, jumpToSearchResult,
paraMenuShow, paraMenuChapterIndex, paraMenuParaIndex, paraMenuText,
onParaTouchStart, onParaTouchEnd, onParaMouseDown, onParaMouseUp, confirmAddBookmark,
highlightParaIndex, highlightChapterIndex, aiTagInput, addAiTag,
      chapterAddShow, newChapterTitle, openAddChapter, confirmAddChapter, convertToChapters,
      synopsisGenShow, synopsisGenMode, synopsisGenFrom, synopsisGenTo,
      synopsisGenLoading, synopsisGenResult,
      openSynopsisGen, runSynopsisGen, applySynopsis,
aiNextChapterShow, aiNextChapterLoading, aiNextChapterResult,
aiNextChapterPlot, aiNextChapterStyle, aiNextChapterMinWords, aiNextChapterMaxWords,
appendMode, openAiNextChapter, runAiNextChapter, saveAiNextChapter,
aiNextChapterChars, aiNextChapterSummaryFrom, aiNextChapterSummaryTo,
aiNextChapterFullFrom, aiNextChapterFullTo,

    };
  }
}).mount('#novel-app');
