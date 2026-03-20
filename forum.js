const { createApp, ref, computed, onMounted, nextTick, watch } = Vue;

createApp({
  setup() {

    const mainTab = ref('home');
    const goBack = () => { window.location.href = 'world.html'; };

    let lucideTimer = null;
    const refreshIcons = () => { clearTimeout(lucideTimer); lucideTimer = setTimeout(() => lucide.createIcons(), 50); };

    const DEFAULT_CATEGORIES = [
      { name: '时政', prompt: '生成关于政治、社会时事、民生话题的论坛帖子，语气犀利或关切，有不同立场的讨论', npcIds: [] },
      { name: '闲谈', prompt: '生成日常闲聊帖子，轻松随意，话题包括生活琐事、心情感悟、随想随写', npcIds: [] },
      { name: '求助', prompt: '生成求助类帖子，发帖人遇到各种困难或问题，语气困惑或焦急，需要帮助', npcIds: [] },
      { name: '水聊', prompt: '生成水帖，内容简短无厘头，可以是表情包文字、无意义的感叹、随机话题', npcIds: [] },
      { name: '教学', prompt: '生成教程类帖子，分享某种技能、知识或经验，语气耐心细致', npcIds: [] },
      { name: '警示', prompt: '生成警示类帖子，揭露骗局、分享亲身遭遇的危险或教训，语气严肃', npcIds: [] },
      { name: '吃瓜', prompt: '生成八卦吃瓜帖子，爆料某些八卦事件，语气神秘或兴奋，不透露真实人名', npcIds: [] },
      { name: '娱乐', prompt: '生成娱乐圈相关帖子，讨论虚构的明星、综艺、影视，语气粉丝或路人视角', npcIds: [] },
      { name: '美食', prompt: '生成美食分享帖子，描述某种食物的美味或烹饪方法，语气垂涎欲滴', npcIds: [] },
      { name: '音乐', prompt: '生成音乐分享或讨论帖子，可以是歌词感悟、歌手讨论或乐器经验', npcIds: [] },
      { name: '读书', prompt: '生成读书笔记或书评帖子，分享某本书的感悟或推荐', npcIds: [] },
      { name: '彩妆', prompt: '生成美妆护肤相关帖子，分享彩妆心得、产品测评、变美技巧', npcIds: [] },
      { name: '健身', prompt: '生成健身运动相关帖子，分享训练方法、身材管理、运动感悟', npcIds: [] },
      { name: '影视', prompt: '生成影视讨论帖子，讨论虚构的电影电视剧，可以是推荐、解析或吐槽', npcIds: [] },
      { name: '动漫', prompt: '生成动漫相关帖子，讨论动画、漫画、轻小说，语气二次元风格', npcIds: [] },
      { name: 'nsfw', prompt: '生成成人向的论坛帖子，内容可以涉及擦边话题、情感纠葛、成人生活感悟，语气大胆直接', npcIds: [] },
    ];

    const DEFAULT_DIM_HOT_PROMPT = `你是一个跨次元热搜榜单生成器。请生成20条来自不同虚构世界的热搜词条，必须涵盖：现实都市、古代架空、魔幻奇幻、兽世、ABO、哨兵向导、修仙、无限流、末世、星际、游戏穿越等多种次元，每条热搜来自不同的次元世界，偶有1~2条与角色或当前世界有关。每条热搜要有强烈的次元感和代入感，像真实的热搜标题。
请返回JSON数组：
[{"title":"热搜标题","dimension":"所属次元","heat":"热度数字+单位如万"}]
只返回JSON数组，不要有其他文字。`;

    // ===== 设置表单（需在 getApiConfig 前声明）=====
    const settingsForm = ref({
      forumApi: { url: '', key: '', model: '' },
      dimHotPrompt: DEFAULT_DIM_HOT_PROMPT,
      categories: [],
      fixedNpcs: []
    });

    const apiConfig = ref({ url: '', key: '', model: '' });

    const getApiConfig = () => {
      const f = settingsForm.value.forumApi;
      if (f && f.url && f.url.trim() && f.key && f.key.trim() && f.model && f.model.trim()) {
        return { url: f.url.trim(), key: f.key.trim(), model: f.model.trim() };
      }
      return apiConfig.value;
    };

    // ===== 分类和帖子 =====
    const categories = ref([...DEFAULT_CATEGORIES]);
    const currentCat = ref('闲谈');
    const posts = ref([]);

    const currentCatPosts = computed(() =>
      posts.value.filter(p => p.cat === currentCat.value).slice().reverse()
    );

    // ===== 我的信息 =====
    const myProfile = ref({ name: '匿名用户', followers: 0, likes: 0 });
    const myPostsCount = computed(() => posts.value.filter(p => p.author === myProfile.value.name).length);
    const saveProfile = async () => {
      await dbSet('forumMyProfile', JSON.parse(JSON.stringify(myProfile.value)));
    };

    // ===== 帖子操作 =====
    const currentPost = ref(null);
    const postFormShow = ref(false);
    const editingPost = ref(null);
    const postForm = ref({ title: '', content: '' });
    const postScrollRef = ref(null);

    const openPostDetail = (post) => {
      currentPost.value = post;
      quotingReply.value = null;
      replyText.value = '';
      nextTick(() => refreshIcons());
    };

    const openPostForm = () => {
      editingPost.value = null;
      postForm.value = { title: '', content: '' };
      postFormShow.value = true;
      nextTick(() => refreshIcons());
    };

    const submitPost = async () => {
      if (!postForm.value.title.trim() || !postForm.value.content.trim()) {
        alert('请填写标题和内容'); return;
      }
      postFormShow.value = false;
      if (editingPost.value) {
        const idx = posts.value.findIndex(p => p.id === editingPost.value.id);
        if (idx !== -1) {
          posts.value[idx].title = postForm.value.title;
          posts.value[idx].content = postForm.value.content;
        }
        editingPost.value = null;
      } else {
        posts.value.push({
          id: Date.now(),
          cat: currentCat.value,
          author: myProfile.value.name,
          title: postForm.value.title,
          content: postForm.value.content,
          time: Date.now(),
          likes: 0,
          likedByMe: false,
          replies: []
        });
      }
      await savePosts();
      nextTick(() => refreshIcons());
    };

    // ===== 帖子菜单 =====
    const postMenuShow = ref(false);
    const menuTarget = ref(null);

    const openPostMenu = (post) => {
      menuTarget.value = post;
      postMenuShow.value = true;
      nextTick(() => refreshIcons());
    };

    const collectFromMenu = () => {
      if (menuTarget.value) toggleCollect(menuTarget.value, 'post');
      postMenuShow.value = false;
    };

    const editFromMenu = () => {
      postMenuShow.value = false;
      editingPost.value = menuTarget.value;
      postForm.value = { title: menuTarget.value.title, content: menuTarget.value.content };
      if (currentPost.value && currentPost.value.id === menuTarget.value.id) currentPost.value = null;
      postFormShow.value = true;
      nextTick(() => refreshIcons());
    };

    const deleteFromMenu = async () => {
      if (!confirm('确定删除这个帖子？')) { postMenuShow.value = false; return; }
      const idx = posts.value.findIndex(p => p.id === menuTarget.value.id);
      if (idx !== -1) posts.value.splice(idx, 1);
      postMenuShow.value = false;
      if (currentPost.value && currentPost.value.id === menuTarget.value.id) currentPost.value = null;
      await savePosts();
    };

    // ===== 回复操作 =====
    const replyText = ref('');
    const quotingReply = ref(null);
    const replyTextareaRef = ref(null);
    const replyMenuShow = ref(false);
    const replyMenuTarget = ref(null);
    const editReplyShow = ref(false);
    const editReplyContent = ref('');

    const autoResizeReply = () => {
      const el = replyTextareaRef.value;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 100) + 'px';
    };

    const setQuoteReply = (reply, idx) => {
      quotingReply.value = { ...reply, floor: idx + 1 };
    };

    const sendReply = async () => {
      if (!replyText.value.trim() || !currentPost.value) return;
      const reply = {
        id: Date.now(),
        content: replyText.value.trim(),
        time: Date.now(),
        isOp: currentPost.value.author === myProfile.value.name,
        likes: 0,
        likedByMe: false,
        quoteId: quotingReply.value ? quotingReply.value.id : null
      };
      if (!currentPost.value.replies) currentPost.value.replies = [];
      currentPost.value.replies.push(reply);
      replyText.value = '';
      quotingReply.value = null;
      if (replyTextareaRef.value) replyTextareaRef.value.style.height = 'auto';
      await savePosts();
      nextTick(() => {
        if (postScrollRef.value) postScrollRef.value.scrollTop = postScrollRef.value.scrollHeight;
        refreshIcons();
      });
    };

    const getQuoteContent = (quoteId) => {
      if (!currentPost.value || !currentPost.value.replies) return '';
      const r = currentPost.value.replies.find(r => r.id === quoteId);
      return r ? r.content.slice(0, 30) + (r.content.length > 30 ? '...' : '') : '';
    };

    const scrollToReply = (quoteId) => {
      nextTick(() => {
        const el = document.querySelector(`[data-reply-id="${quoteId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    };

    const openReplyMenu = (reply) => {
      replyMenuTarget.value = reply;
      replyMenuShow.value = true;
      nextTick(() => refreshIcons());
    };

    const collectReplyFromMenu = () => {
      if (replyMenuTarget.value) toggleCollect(replyMenuTarget.value, 'reply');
      replyMenuShow.value = false;
    };

    const editReplyFromMenu = () => {
      replyMenuShow.value = false;
      editReplyContent.value = replyMenuTarget.value.content;
      editReplyShow.value = true;
    };

    const confirmEditReply = async () => {
      if (replyMenuTarget.value) {
        replyMenuTarget.value.content = editReplyContent.value;
        await savePosts();
      }
      editReplyShow.value = false;
    };

    const deleteReplyFromMenu = async () => {
      if (!confirm('确定删除这条评论？')) { replyMenuShow.value = false; return; }
      if (currentPost.value && currentPost.value.replies) {
        const idx = currentPost.value.replies.findIndex(r => r.id === replyMenuTarget.value.id);
        if (idx !== -1) currentPost.value.replies.splice(idx, 1);
        await savePosts();
      }
      replyMenuShow.value = false;
    };

    // ===== 点赞 =====
    const likePost = async (post) => {
      post.likedByMe = !post.likedByMe;
      post.likes = (post.likes || 0) + (post.likedByMe ? 1 : -1);
      if (post.likedByMe) myProfile.value.likes = (myProfile.value.likes || 0) + 1;
      await savePosts();
      await saveProfile();
    };

    const likeReply = async (reply) => {
      reply.likedByMe = !reply.likedByMe;
      reply.likes = (reply.likes || 0) + (reply.likedByMe ? 1 : -1);
      await savePosts();
    };

    // ===== 收藏 =====
    const collections = ref([]);

    const isCollected = (id, type) => collections.value.some(c => c.id === id && c.type === type);

    const toggleCollect = async (item, type) => {
      const idx = collections.value.findIndex(c => c.id === item.id && c.type === type);
      if (idx !== -1) {
        collections.value.splice(idx, 1);
      } else {
        collections.value.push({ ...JSON.parse(JSON.stringify(item)), type, collectedAt: Date.now() });
      }
      await dbSet('forumCollections', JSON.parse(JSON.stringify(collections.value)));
    };

    // ===== 收藏/稿件页 =====
    const collectionShow = ref(false);
    const collectionType = ref('collect');
    const collectTab = ref('post');

    const collectionItems = computed(() => {
      if (collectionType.value === 'posts') {
        return posts.value.filter(p => p.author === myProfile.value.name).slice().reverse();
      }
      return collections.value.filter(c => c.type === collectTab.value).slice().reverse();
    });

    const openCollection = (type) => {
      collectionType.value = type;
      collectTab.value = 'post';
      collectionShow.value = true;
      nextTick(() => refreshIcons());
    };

    const openCollectionItem = (item) => {
      if (item.type === 'reply') return;
      const post = posts.value.find(p => p.id === item.id);
      if (post) { collectionShow.value = false; openPostDetail(post); }
    };

    // ===== AI生成帖子 =====
    const generating = ref(false);

    const generatePosts = async () => {
      const cfg = getApiConfig();
      if (!cfg.url || !cfg.key || !cfg.model) {
        alert('请先配置API（在设置页面或 like.html 全局设置）'); return;
      }
      generating.value = true;
      const cat = categories.value.find(c => c.name === currentCat.value);
      const catPrompt = cat ? cat.prompt : `生成关于「${currentCat.value}」的论坛帖子`;
      const npcNames = [];
      if (cat && cat.npcIds && cat.npcIds.length) {
        const chars = await dbGet('charList') || [];
        cat.npcIds.forEach(id => {
          const c = chars.find(ch => ch.id === id);
          if (c) npcNames.push({ name: c.name, persona: c.persona || '' });
        });
      }
      const fixedNpcs = settingsForm.value.fixedNpcs || [];
      const allNpcs = [...npcNames, ...fixedNpcs];
      const randomNpcNames = ['云游四海', '匿名小透明', '路过的风', '夜半钟声', '微笑刺客', '隐形战队', '悄悄说说', '不知名网友', '深夜emo', '快乐肥宅', '五月天粉', '边走边唱', '落叶归根', '星光下的你'];
      const count = Math.floor(Math.random() * 3) + 3;
      const prompt = `你现在是一个真实运营的综合论坛，板块名称是「${currentCat.value}」。
请严格按照该板块主题生成${count}个真实的论坛帖子。
板块风格提示：${catPrompt}
${allNpcs.length ? `参与发帖的用户：${allNpcs.map(n => n.name + (n.persona ? `（${n.persona}）` : '')).join('、')}，以及若干随机普通网友。` : '发帖者为随机普通网友。'}
随机普通网友用户名可参考：${randomNpcNames.sort(() => Math.random() - 0.5).slice(0, 5).join('、')}等，也可自由发挥。
请返回JSON数组，格式：
[{"author":"用户名","title":"帖子标题（简洁有力，可标题党，吸引眼球，不超过20字）","content":"帖子正文（100~300字，自然口语，不使用Markdown格式）"}]
只返回JSON数组，不要有其他文字。`;

      try {
        const res = await fetch(`${cfg.url.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
          body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }] })
        });
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '[]';
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const arr = JSON.parse(match[0]);
          arr.forEach((item, i) => {
            posts.value.push({
              id: Date.now() + i,
              cat: currentCat.value,
              author: item.author || '匿名网友',
              title: item.title || '无标题',
              content: item.content || '（内容生成失败）',
              time: Date.now() + i * 1000,
              likes: Math.floor(Math.random() * 60),
              likedByMe: false,
              replies: []
            });
          });
          await savePosts();
        } else {
          alert('生成内容格式有误，请重试');
        }
      } catch (e) {
        alert('生成失败：' + e.message);
      }
      generating.value = false;
      nextTick(() => refreshIcons());
    };

    // ===== 热搜 =====
    const hotTab = ref('real');
    const hotPlatform = ref('weibo');
    const hotList = ref([]);
    const hotLoading = ref(false);
    const hotError = ref('');
    const hotPlatforms = [
      { key: 'weibo', label: '微博' },
      { key: 'zhihu', label: '知乎' },
      { key: 'baidu', label: '百度' },
      { key: 'douyin', label: '抖音' },
      { key: 'toutiao', label: '头条' },
    ];

    const fetchHotList = async (type) => {
  hotLoading.value = true;
  hotError.value = '';
  hotList.value = [];

  // 换用 corsproxy.io 代理
  const targetUrl = `https://api.vvhan.com/api/hotlist?type=${type}`;
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

  const parseItems = (data) => {
    if (data && data.success && Array.isArray(data.data) && data.data.length) {
      return data.data.slice(0, 30).map(item => ({
        title: item.title || item.name || '',
        hot: item.hot || item.desc || ''
      }));
    }
    if (Array.isArray(data) && data.length) {
      return data.slice(0, 30).map(item => ({
        title: item.title || item.name || '',
        hot: item.hot || ''
      }));
    }
    return null;
  };

  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = parseItems(data);
    if (items && items.length) {
      hotList.value = items;
    } else {
      hotError.value = '接口返回数据为空，请稍后重试';
    }
  } catch (e) {
    // corsproxy.io 失败，再试 thingproxy
    try {
      const fallbackUrl = `https://thingproxy.freeboard.io/fetch/${targetUrl}`;
      const res2 = await fetch(fallbackUrl);
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      const data2 = await res2.json();
      const items2 = parseItems(data2);
      if (items2 && items2.length) {
        hotList.value = items2;
      } else {
        hotError.value = '接口返回数据为空，请稍后重试';
      }
    } catch (e2) {
      hotError.value = `加载失败：${e2.message}`;
    }
  }

  hotLoading.value = false;
};

    const switchHotPlatform = (key) => {
      hotPlatform.value = key;
      fetchHotList(key);
    };

    watch(hotTab, (val) => {
      if (val === 'real') fetchHotList(hotPlatform.value);
    });

    // ===== 次元热搜 =====
    const dimHotList = ref([]);
    const dimHotLoading = ref(false);

    const generateDimensionHot = async () => {
      const cfg = getApiConfig();
      if (!cfg.url || !cfg.key || !cfg.model) { alert('请先配置API'); return; }
      dimHotLoading.value = true;
      const prompt = settingsForm.value.dimHotPrompt || DEFAULT_DIM_HOT_PROMPT;
      try {
        const res = await fetch(`${cfg.url.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
          body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }] })
        });
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '[]';
        const match = text.match(/\[[\s\S]*\]/);
        if (match) dimHotList.value = JSON.parse(match[0]);
        else alert('次元热搜格式有误，请重试');
      } catch (e) {
        alert('次元热搜生成失败：' + e.message);
      }
      dimHotLoading.value = false;
    };

    // ===== 搜索 =====
    const searchType = ref('forum');
    const searchQuery = ref('');
    const searchLoading = ref(false);
    const searchResults = ref([]);
    const searchDone = ref(false);
    const aiSearchResult = ref('');

    const doSearch = async () => {
      if (!searchQuery.value.trim()) return;
      searchLoading.value = true;
      searchResults.value = [];
      aiSearchResult.value = '';
      searchDone.value = false;
      if (searchType.value === 'forum') {
        const q = searchQuery.value.trim().toLowerCase();
        searchResults.value = posts.value.filter(p =>
          p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
        );
        searchDone.value = true;
        searchLoading.value = false;
      } else {
        const cfg = getApiConfig();
        if (!cfg.url || !cfg.key || !cfg.model) {
          alert('请先配置API'); searchLoading.value = false; return;
        }
        try {
          const res = await fetch(`${cfg.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
            body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: searchQuery.value }] })
          });
          const data = await res.json();
          aiSearchResult.value = data.choices?.[0]?.message?.content || '（无回答）';
        } catch (e) {
          aiSearchResult.value = '请求失败：' + e.message;
        }
        searchLoading.value = false;
      }
    };

    // ===== 私聊 =====
    const conversations = ref([]);
    const currentConv = ref(null);
    const pmText = ref('');
    const pmBodyRef = ref(null);
    const pmTextareaRef = ref(null);

    const autoResizePM = () => {
      const el = pmTextareaRef.value;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 100) + 'px';
    };

    const openPM = async (authorName, sourcePost) => {
      let conv = conversations.value.find(c => c.name === authorName);
      if (!conv) {
        conv = {
          id: Date.now(),
          name: authorName,
          messages: [],
          sourcePost: sourcePost ? JSON.parse(JSON.stringify(sourcePost)) : null
        };
        conversations.value.push(conv);
        await saveConversations();
      } else if (sourcePost) {
        conv.sourcePost = JSON.parse(JSON.stringify(sourcePost));
      }
      mainTab.value = 'messages';
      await nextTick();
      currentConv.value = conv;
      nextTick(() => {
        if (pmBodyRef.value) pmBodyRef.value.scrollTop = pmBodyRef.value.scrollHeight;
        refreshIcons();
      });
    };

    const openConversation = (conv) => {
      currentConv.value = conv;
      nextTick(() => {
        if (pmBodyRef.value) pmBodyRef.value.scrollTop = pmBodyRef.value.scrollHeight;
        refreshIcons();
      });
    };

    const sendPM = async () => {
      if (!pmText.value.trim() || !currentConv.value) return;
      const cfg = getApiConfig();
      if (!cfg.url || !cfg.key || !cfg.model) { alert('请先配置API'); return; }

      const userMsg = { id: Date.now(), role: 'user', content: pmText.value.trim(), time: Date.now() };
      currentConv.value.messages.push(userMsg);
      pmText.value = '';
      if (pmTextareaRef.value) pmTextareaRef.value.style.height = 'auto';
      await saveConversations();
      nextTick(() => { if (pmBodyRef.value) pmBodyRef.value.scrollTop = pmBodyRef.value.scrollHeight; });

      const conv = currentConv.value;
      const charList = await dbGet('charList') || [];
      const matchedChar = charList.find(c => c.name === conv.name);
      let systemPrompt = '';
      if (matchedChar) {
        systemPrompt = `你正在扮演角色「${matchedChar.name}」与用户私聊。${matchedChar.persona ? '你的人设：' + matchedChar.persona + '。' : ''}${matchedChar.world ? '世界观：' + matchedChar.world + '。' : ''}你在论坛上是一个普通用户，可能会隐藏自己的真实身份，也可能在熟悉后透露。`;
      } else if (conv.sourcePost) {
        systemPrompt = `你是论坛用户「${conv.name}」，正在与一个网友私聊。你在论坛上发过这样的帖子：\n标题：${conv.sourcePost.title}\n内容：${conv.sourcePost.content}\n请根据帖子内容推断你的性格、立场、背景，用符合帖子风格的语气与网友聊天。你有自己的秘密和隐藏身份，可以选择隐瞒或透露。`;
      } else {
        systemPrompt = `你是论坛用户「${conv.name}」，正在与一个网友私聊。请用自然口语风格回应，有自己的个性和立场。`;
      }
      systemPrompt += '\n每次只回复1~3句话，像真实的私信一样简短自然，不要使用Markdown格式。';

      const historyMsgs = conv.messages.slice(-12).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      const loadingMsg = { id: Date.now() + 1, role: 'assistant', content: '', loading: true, time: Date.now() };
      currentConv.value.messages.push(loadingMsg);
      nextTick(() => { if (pmBodyRef.value) pmBodyRef.value.scrollTop = pmBodyRef.value.scrollHeight; });

      try {
        const res = await fetch(`${cfg.url.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
          body: JSON.stringify({ model: cfg.model, messages: [{ role: 'system', content: systemPrompt }, ...historyMsgs] })
        });
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || '（无回复）';
        const idx = currentConv.value.messages.findIndex(m => m.id === loadingMsg.id);
        if (idx !== -1) {
          currentConv.value.messages[idx] = {
            id: Date.now() + 2,
            role: 'assistant',
            content: reply,
            loading: false,
            time: Date.now()
          };
        }
      } catch (e) {
        const idx = currentConv.value.messages.findIndex(m => m.id === loadingMsg.id);
        if (idx !== -1) {
          currentConv.value.messages[idx] = {
            id: Date.now() + 2,
            role: 'assistant',
            content: '（消息发送失败：' + e.message + '）',
            loading: false,
            time: Date.now()
          };
        }
      }
      await saveConversations();
      nextTick(() => {
        if (pmBodyRef.value) pmBodyRef.value.scrollTop = pmBodyRef.value.scrollHeight;
        refreshIcons();
      });
    };

    const saveConversations = async () => {
      await dbSet('forumConversations', JSON.parse(JSON.stringify(conversations.value)));
    };

    // ===== 设置页 =====
    const settingsShow = ref(false);
    const expandedCats = ref([]);
    const availableChars = ref([]);
    const addCatShow = ref(false);
    const newCatName = ref('');
    const newCatPrompt = ref('');
    const forumModelList = ref([]);

    const fetchForumModels = async () => {
      const f = settingsForm.value.forumApi;
      if (!f.url || !f.key) { alert('请先填写论坛API网址和密钥'); return; }
      try {
        const res = await fetch(`${f.url.replace(/\/$/, '')}/models`, {
          headers: { Authorization: `Bearer ${f.key}` }
        });
        const data = await res.json();
        forumModelList.value = (data.data || []).map(m => m.id);
      } catch (e) {
        alert('获取模型失败：' + e.message);
      }
    };

    const openSettings = async () => {
      settingsForm.value.categories = JSON.parse(JSON.stringify(categories.value));
      if (!settingsForm.value.fixedNpcs) settingsForm.value.fixedNpcs = [];
      if (!settingsForm.value.forumApi) settingsForm.value.forumApi = { url: '', key: '', model: '' };
      const chars = await dbGet('charList') || [];
      availableChars.value = chars;
      settingsShow.value = true;
      nextTick(() => refreshIcons());
    };

    const saveSettings = async () => {
      categories.value = JSON.parse(JSON.stringify(settingsForm.value.categories));
      await dbSet('forumSettings', JSON.parse(JSON.stringify(settingsForm.value)));
      settingsShow.value = false;
    };

    const toggleCatExpand = (name) => {
      const idx = expandedCats.value.indexOf(name);
      if (idx === -1) expandedCats.value.push(name);
      else expandedCats.value.splice(idx, 1);
      nextTick(() => refreshIcons());
    };

    const toggleCatNpc = (cat, charId) => {
      if (!cat.npcIds) cat.npcIds = [];
      const idx = cat.npcIds.indexOf(charId);
      if (idx === -1) cat.npcIds.push(charId);
      else cat.npcIds.splice(idx, 1);
    };

    const addCustomCategory = () => {
      newCatName.value = '';
      newCatPrompt.value = '';
      addCatShow.value = true;
      nextTick(() => refreshIcons());
    };

    const confirmAddCategory = async () => {
      if (!newCatName.value.trim()) return;
      const newCat = { name: newCatName.value.trim(), prompt: newCatPrompt.value.trim(), npcIds: [] };
      settingsForm.value.categories.push(newCat);
      categories.value.push(JSON.parse(JSON.stringify(newCat)));
      addCatShow.value = false;
      await dbSet('forumSettings', JSON.parse(JSON.stringify(settingsForm.value)));
    };

    // ===== 数据存储 =====
    const savePosts = async () => {
      await dbSet('forumPostsV2', JSON.parse(JSON.stringify(posts.value)));
    };

    // ===== 时间格式化 =====
    const formatTime = (ts) => {
      if (!ts) return '';
      const now = new Date();
      const d = new Date(ts);
      const diff = now - d;
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
      if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
      if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前';
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    };

    // ===== 初始化 =====
    onMounted(async () => {
      const [dark, api, savedPosts, savedSettings, savedConvs, savedCollections, savedProfile, charList] = await Promise.all([
        dbGet('darkMode'),
        dbGet('apiConfig'),
        dbGet('forumPostsV2'),
        dbGet('forumSettings'),
        dbGet('forumConversations'),
        dbGet('forumCollections'),
        dbGet('forumMyProfile'),
        dbGet('charList')
      ]);

      if (dark) document.body.classList.add('dark');
      if (api) apiConfig.value = api;
      if (savedPosts) posts.value = savedPosts;
      if (savedSettings) {
        settingsForm.value = {
          forumApi: { url: '', key: '', model: '' },
          dimHotPrompt: DEFAULT_DIM_HOT_PROMPT,
          categories: [],
          fixedNpcs: [],
          ...savedSettings
        };
        if (savedSettings.categories && savedSettings.categories.length) {
          categories.value = savedSettings.categories;
        }
      }
      if (savedConvs) conversations.value = savedConvs;
      if (savedCollections) collections.value = savedCollections;
      if (savedProfile) myProfile.value = savedProfile;
      if (charList) availableChars.value = charList;

      fetchHotList(hotPlatform.value);
      nextTick(() => refreshIcons());
    });

    return {
      mainTab, goBack,
      categories, currentCat, currentCatPosts,
      myProfile, myPostsCount, saveProfile,
      currentPost, postFormShow, editingPost, postForm, postScrollRef,
      openPostDetail, openPostForm, submitPost,
      postMenuShow, menuTarget, openPostMenu, collectFromMenu, editFromMenu, deleteFromMenu,
      replyText, quotingReply, replyTextareaRef, replyMenuShow, editReplyShow, editReplyContent,
      autoResizeReply, setQuoteReply, sendReply, getQuoteContent, scrollToReply,
      openReplyMenu, collectReplyFromMenu, editReplyFromMenu, confirmEditReply, deleteReplyFromMenu,
      likePost, likeReply, collections, isCollected, toggleCollect,
      collectionShow, collectionType, collectTab, collectionItems, openCollection, openCollectionItem,
      generating, generatePosts,
      hotTab, hotPlatform, hotList, hotLoading, hotError, hotPlatforms, fetchHotList, switchHotPlatform,
      dimHotList, dimHotLoading, generateDimensionHot,
      searchType, searchQuery, searchLoading, searchResults, searchDone, aiSearchResult, doSearch,
      conversations, currentConv, pmText, pmBodyRef, pmTextareaRef,
      autoResizePM, openPM, openConversation, sendPM,
      settingsShow, expandedCats, availableChars, settingsForm, addCatShow, newCatName, newCatPrompt,
      forumModelList, fetchForumModels,
      openSettings, saveSettings, toggleCatExpand, toggleCatNpc, addCustomCategory, confirmAddCategory,
      formatTime
    };
  }
}).mount('#forum-app');
