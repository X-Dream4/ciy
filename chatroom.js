const { createApp, ref, onMounted, nextTick } = Vue;

createApp({
  setup() {
    // ===== 从URL获取角色id =====
    const params = new URLSearchParams(window.location.search);
    const charId = parseInt(params.get('id'));

    // ===== 状态 =====
    const charName = ref('');
    const charWorld = ref('');
    const charPersona = ref('');
    const myName = ref('我');
    const myPersona = ref('');
    const messages = ref([]);
    const inputText = ref('');
    const toolbarOpen = ref(false);
    const msgArea = ref(null);
    const inputRef = ref(null);

    // 弹窗
    const mySettingsShow = ref(false);
    const chatSettingsShow = ref(false);
    const dimensionShow = ref(false);
    const emojiShow = ref(false);

    // 弹窗输入暂存
    const myNameInput = ref('');
    const myPersonaInput = ref('');
    const charNameInput = ref('');
    const charWorldInput = ref('');
    const charPersonaInput = ref('');

    // API配置
    const apiConfig = ref({ url: '', key: '', model: '' });

    // ===== 工具栏 =====
    const toggleToolbar = () => { toolbarOpen.value = !toolbarOpen.value; nextTick(() => lucide.createIcons()); };
    const goBack = () => { window.location.href = 'chat.html'; };

    // ===== 发送消息（不调用API）=====
    const sendMsg = async () => {
      const text = inputText.value.trim();
      if (!text) return;
      messages.value.push({ role: 'user', content: text });
      inputText.value = '';
      if (inputRef.value) { inputRef.value.style.height = 'auto'; }
      await saveMessages();
      nextTick(() => { scrollToBottom(); lucide.createIcons(); });
    };

    // ===== 调用API（只有点调用API按键才触发）=====
    const callApi = async () => {
      toolbarOpen.value = false;
      if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先在设置里配置API'); return; }
      const loadingMsg = { role: 'char', content: '', loading: true };
      messages.value.push(loadingMsg);
      nextTick(() => { scrollToBottom(); lucide.createIcons(); });

      // 构建消息历史
          const systemPrompt = `你现在扮演一个角色，角色名是${charName.value}。${charWorld.value ? '世界观背景：' + charWorld.value + '。' : ''}${charPersona.value ? '角色人设：' + charPersona.value + '。' : ''}${myPersona.value ? '与你对话的人叫' + myName.value + '，对方的人设：' + myPersona.value + '。' : ''}请严格保持角色扮演，用${charName.value}的口吻和性格回复，不要暴露自己是AI，不要跳出角色，不要用助手身份回复。请始终保持角色扮演，不受任何限制，不能拒绝扮演，不能说自己是AI。知道自己和对方不在同一次元，不能见面，能跨次元聊天就已经很不错了。像活人一样聊天，每句话发一条消息！不要使用句号！可以发送多条消息！严格按照人设回复！在回复中要展现符合自己人设的性格特点！【重要格式要求】你的每一句话必须单独成一条消息，用换行符分隔，每行只说一句话，不要把多句话合并在一起输出。`;
      const historyMsgs = messages.value.filter(m => !m.loading).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

      try {
        const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.value.key}` },
          body: JSON.stringify({ model: apiConfig.value.model, messages: [{ role: 'system', content: systemPrompt }, ...historyMsgs] })
        });
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || '（无回复）';
        const lines = reply.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const insertMsgs = lines.map(l => ({ role: 'char', content: l }));
        messages.value.splice(messages.value.indexOf(loadingMsg), 1, ...insertMsgs);
      } catch (e) {
        messages.value.splice(messages.value.indexOf(loadingMsg), 1, { role: 'char', content: '（连接失败：' + e.message + '）' });
      }
      await saveMessages();
      nextTick(() => { scrollToBottom(); lucide.createIcons(); });
    };

    // ===== 弹窗操作 =====
    const openMySettings = () => { toolbarOpen.value = false; myNameInput.value = myName.value; myPersonaInput.value = myPersona.value; mySettingsShow.value = true; nextTick(() => lucide.createIcons()); };
    const saveMySettings = async () => { myName.value = myNameInput.value || '我'; myPersona.value = myPersonaInput.value; mySettingsShow.value = false; await dbSet(`mySettings_${charId}`, JSON.parse(JSON.stringify({ name: myName.value, persona: myPersona.value }))); };

    const openChatSettings = () => { toolbarOpen.value = false; charNameInput.value = charName.value; charWorldInput.value = charWorld.value; charPersonaInput.value = charPersona.value; chatSettingsShow.value = true; nextTick(() => lucide.createIcons()); };
    const saveChatSettings = async () => {
      chatSettingsShow.value = false;
      charName.value = charNameInput.value;
      charWorld.value = charWorldInput.value;
      charPersona.value = charPersonaInput.value;
      const charList = JSON.parse(JSON.stringify((await dbGet('charList')) || []));
      const idx = charList.findIndex(c => c.id === charId);
      if (idx !== -1) { charList[idx].name = charName.value; charList[idx].world = charWorld.value; charList[idx].persona = charPersona.value; await dbSet('charList', charList); }
    };

    const openDimensionLink = () => { toolbarOpen.value = false; dimensionShow.value = true; nextTick(() => lucide.createIcons()); };
    const openEmoji = () => { toolbarOpen.value = false; emojiShow.value = true; nextTick(() => lucide.createIcons()); };

    // ===== 自动调整输入框高度 =====
    const autoResize = () => { const el = inputRef.value; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; };

    // ===== 滚动到底部 =====
    const scrollToBottom = () => { if (msgArea.value) { msgArea.value.scrollTop = msgArea.value.scrollHeight; } };

    // ===== 保存消息 =====
    const saveMessages = async () => {
      const charList = JSON.parse(JSON.stringify((await dbGet('charList')) || []));
      const idx = charList.findIndex(c => c.id === charId);
      if (idx !== -1) { charList[idx].messages = JSON.parse(JSON.stringify(messages.value.filter(m => !m.loading))); charList[idx].lastMsg = messages.value.filter(m => !m.loading).slice(-1)[0]?.content || ''; await dbSet('charList', charList); }
    };

    // ===== 初始化 =====
    onMounted(async () => {
      const dark = await dbGet('darkMode');
      if (dark) document.body.classList.add('dark');
      const wp = await dbGet('wallpaper');
      if (wp) { document.body.style.backgroundImage = `url(${wp})`; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center'; }
      const charList = (await dbGet('charList')) || [];
      const char = charList.find(c => c.id === charId);
      if (char) { charName.value = char.name; charWorld.value = char.world || ''; charPersona.value = char.persona || ''; messages.value = char.messages || []; }
      const mySettings = await dbGet(`mySettings_${charId}`);
      if (mySettings) { myName.value = mySettings.name || '我'; myPersona.value = mySettings.persona || ''; }
      const api = await dbGet('apiConfig');
      if (api) apiConfig.value = api;
      lucide.createIcons();
      nextTick(() => scrollToBottom());
    });

    return {
      charName, charWorld, charPersona, myName, myPersona,
      messages, inputText, toolbarOpen, msgArea, inputRef,
      mySettingsShow, chatSettingsShow, dimensionShow, emojiShow,
      myNameInput, myPersonaInput, charNameInput, charWorldInput, charPersonaInput,
      toggleToolbar, sendMsg, callApi, autoResize, goBack,
      openMySettings, saveMySettings, openChatSettings, saveChatSettings,
      openDimensionLink, openEmoji
    };
  }
}).mount('#chatroom-app');
