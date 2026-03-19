const { createApp, ref, onMounted, nextTick } = Vue;

createApp({
  setup() {
    const params = new URLSearchParams(window.location.search);
    const charId = parseInt(params.get('id'));

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

    const mySettingsShow = ref(false);
    const chatSettingsShow = ref(false);
    const dimensionShow = ref(false);
    const peekSoulShow = ref(false);
    const dimensionMirrorShow = ref(false);
    const myWhisperShow = ref(false);
    const emojiShow = ref(false);
    const beautyShow = ref(false);

    const myNameInput = ref('');
    const myPersonaInput = ref('');
    const charNameInput = ref('');
    const charWorldInput = ref('');
    const charPersonaInput = ref('');
    const whisperText = ref('');
    const peekResult = ref(null);
    const peekLoading = ref(false);
    const mirrorResult = ref('');
    const mirrorLoading = ref(false);
    const mirrorMode = ref('chat');
    const apiConfig = ref({ url: '', key: '', model: '' });
    const peekHistory = ref([]);
    const mirrorHistory = ref([]);
    const peekHistoryShow = ref(false);
    const mirrorHistoryShow = ref(false);

    // 聊天美化状态
    const chatWallpaper = ref('');
    const chatWallpaperUrl = ref('');
    const charAvatar = ref('');
    const myAvatar = ref('');
    const coupleAvatarOn = ref(false);
    const coupleAvatarDesc = ref('');
    const showCharAvatar = ref(false);
    const bubbleCustomOn = ref(false);
    const bubbleSize = ref('15');
    const charBubbleColor = ref('#ffffff');
    const charBubbleTextColor = ref('#111111');
    const myBubbleColor = ref('#111111');
    const myBubbleTextColor = ref('#ffffff');
    const cssCustomOn = ref(false);
    const cssCustomInput = ref('');
    const cssStyleEl = ref(null);
    const beautyWallpaperFile = ref(null);
    const charAvatarFile = ref(null);
    const myAvatarFile = ref(null);

    const bubbleMenuMsgId = ref(null);
    const quotingMsg = ref(null);
    const multiSelectMode = ref(false);
    const selectedMsgs = ref([]);
    let longPressTimer = null;
    let touchMoved = false;

    let lucideTimer = null;
    const refreshIcons = () => { clearTimeout(lucideTimer); lucideTimer = setTimeout(() => lucide.createIcons(), 50); };

    const toggleToolbar = () => { toolbarOpen.value = !toolbarOpen.value; nextTick(() => refreshIcons()); };
    const goBack = () => { window.location.href = 'chat.html'; };
    const getMsg = (id) => messages.value.find(m => m.id === id);

    const sendMsg = async () => {
      const text = inputText.value.trim();
      if (!text) return;
      const msg = { id: Date.now(), role: 'user', content: text, type: 'normal', quoteId: quotingMsg.value ? quotingMsg.value.id : null, recalled: false, revealed: false };
      messages.value.push(msg);
      inputText.value = '';
      quotingMsg.value = null;
      toolbarOpen.value = false;
      if (inputRef.value) inputRef.value.style.height = 'auto';
      await saveMessages();
      nextTick(() => { scrollToBottom(); refreshIcons(); });
    };

    const sendWhisper = async () => {
      if (!whisperText.value.trim()) return;
      myWhisperShow.value = false;
      const msg = { id: Date.now(), role: 'user', content: whisperText.value.trim(), type: 'whisper', quoteId: null, recalled: false, revealed: false };
      messages.value.push(msg);
      whisperText.value = '';
      await saveMessages();
      nextTick(() => { scrollToBottom(); refreshIcons(); });
    };

    const callApi = async () => {
      toolbarOpen.value = false;
      if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先在设置里配置API'); return; }
      const loadingMsg = { id: Date.now(), role: 'char', content: '', type: 'normal', loading: true, recalled: false, revealed: false };
      messages.value.push(loadingMsg);
      nextTick(() => { scrollToBottom(); refreshIcons(); });

      // 构建系统提示词（含情侣头像信息）
      let coupleInfo = '';
      if (coupleAvatarOn.value && coupleAvatarDesc.value) { coupleInfo = `我们使用的是情侣/配套头像，头像描述：${coupleAvatarDesc.value}。你只需知晓，在我提起时自然回应，或偶尔主动提及即可。`; }
      const systemPrompt = `你现在扮演一个角色，角色名是${charName.value}。${charWorld.value ? '世界观背景：' + charWorld.value + '。' : ''}${charPersona.value ? '角色人设：' + charPersona.value + '。' : ''}${myPersona.value ? '与你对话的人叫' + myName.value + '，ta的人设：' + myPersona.value + '。' : ''}${coupleInfo}请严格保持角色扮演，用${charName.value}的口吻和性格回复，不要暴露自己是AI，不要跳出角色。【重要格式要求】你的每一句话必须单独成一条消息，用换行符分隔，每行只说一句话。`;

      const historyMsgs = messages.value.filter(m => !m.recalled && !m.loading).map(m => {
        let content = m.content;
        if (m.type === 'whisper') { content = `（此刻你隐约感受到对方内心深处：${m.content}。你只是默默知晓，绝对不能在言语中直接提及或暗示这是对方说出来的，当作自己窥探到的秘密。可以在自己的心声里提及）`; }
        if (m.quoteId) { const quoted = messages.value.find(q => q.id === m.quoteId); if (quoted) { content = `【引用 ${quoted.role === 'user' ? myName.value : charName.value} 的消息：${quoted.content}】${content}`; } }
        return { role: m.role === 'user' ? 'user' : 'assistant', content };
      });

      try {
        const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.value.key}` }, body: JSON.stringify({ model: apiConfig.value.model, messages: [{ role: 'system', content: systemPrompt }, ...historyMsgs] }) });
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || '（无回复）';
        const lines = reply.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        messages.value.splice(messages.value.indexOf(loadingMsg), 1);
        for (let i = 0; i < lines.length; i++) {
          await new Promise(resolve => setTimeout(resolve, i === 0 ? 0 : 600 + Math.random() * 400));
          messages.value.push({ id: Date.now() + i, role: 'char', content: lines[i], type: 'normal', quoteId: null, recalled: false, revealed: false });
          await nextTick();
          scrollToBottom();
          refreshIcons();
        }
        await writeGlobalLog(`API回复成功，共${lines.length}条消息`, 'info', `聊天-${charName.value}`);
      } catch (e) {
        messages.value.splice(messages.value.indexOf(loadingMsg), 1, { id: Date.now(), role: 'char', content: '（连接失败：' + e.message + '）', type: 'normal', recalled: false, revealed: false });
        await writeGlobalLog(`API调用失败: ${e.message}`, 'error', `聊天-${charName.value}`);
      }
      await saveMessages();
      nextTick(() => { scrollToBottom(); refreshIcons(); });
    };

    const openPeekSoul = () => { toolbarOpen.value = false; peekResult.value = null; peekSoulShow.value = true; nextTick(() => refreshIcons()); };
    const doPeekSoul = async () => {
      if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先配置API'); return; }
      peekLoading.value = true; peekResult.value = null;
      const recentMsgs = messages.value.filter(m => !m.recalled && !m.loading).slice(-10).map(m => `${m.role === 'user' ? myName.value : charName.value}：${m.content}`).join('\n');
      const prompt = `你是${charName.value}。${charPersona.value ? '人设：' + charPersona.value : ''}。根据以下最近的对话，用简短的文字（20字以内）描述角色当前的动作和情绪，再用简短的文字（30字以内）描述角色此刻的内心独白。用JSON格式返回：{"action":"动作情绪","soul":"内心独白"}\n对话：\n${recentMsgs}`;
      try {
        const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.value.key}` }, body: JSON.stringify({ model: apiConfig.value.model, messages: [{ role: 'user', content: prompt }] }) });
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '{}';
        const match = text.match(/\{[\s\S]*\}/);
        peekResult.value = match ? JSON.parse(match[0]) : { action: text, soul: '' };
        peekHistory.value.unshift({ time: new Date().toLocaleString(), ...peekResult.value });
        await dbSet(`peekHistory_${charId}`, JSON.parse(JSON.stringify(peekHistory.value)));
      } catch (e) { peekResult.value = { action: '获取失败', soul: e.message }; }
      peekLoading.value = false;
    };

    const openDimensionMirror = () => { toolbarOpen.value = false; mirrorResult.value = ''; dimensionMirrorShow.value = true; nextTick(() => refreshIcons()); };
    const doMirror = async () => {
      if (!apiConfig.value.url || !apiConfig.value.key || !apiConfig.value.model) { alert('请先配置API'); return; }
      mirrorLoading.value = true; mirrorResult.value = '';
      let prompt = '';
      if (mirrorMode.value === 'chat') {
        const recentMsgs = messages.value.filter(m => !m.recalled && !m.loading).slice(-10).map(m => `${m.role === 'user' ? myName.value : charName.value}：${m.content}`).join('\n');
        prompt = `你是一个旁观者，正在监视另一个次元里的${charName.value}。${charPersona.value ? '他的人设：' + charPersona.value + '。' : ''}${charWorld.value ? '世界观：' + charWorld.value + '。' : ''}根据以下对话内容，像监控摄像头一样，事无巨细地用文字描述${charName.value}此刻在做什么（100字以内）。\n对话内容：\n${recentMsgs}`;
      } else {
        const now = new Date();
        const timeStr = `${now.getHours()}时${now.getMinutes()}分`;
        prompt = `你是一个旁观者，正在监视另一个次元里的${charName.value}。${charPersona.value ? '他的人设：' + charPersona.value + '。' : ''}${charWorld.value ? '世界观：' + charWorld.value + '。' : ''}现在是${timeStr}，${charName.value}没有在和任何人聊天，像监控摄像头一样，事无巨细地用文字描述${charName.value}此刻可能在做什么（100字以内）。`;
      }
      try {
        const res = await fetch(`${apiConfig.value.url.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.value.key}` }, body: JSON.stringify({ model: apiConfig.value.model, messages: [{ role: 'user', content: prompt }] }) });
        const data = await res.json();
        mirrorResult.value = data.choices?.[0]?.message?.content || '（无结果）';
        mirrorHistory.value.unshift({ time: new Date().toLocaleString(), mode: mirrorMode.value, content: mirrorResult.value });
        await dbSet(`mirrorHistory_${charId}`, JSON.parse(JSON.stringify(mirrorHistory.value)));
      } catch (e) { mirrorResult.value = '获取失败：' + e.message; }
      mirrorLoading.value = false;
    };

    const openMySettings = () => { toolbarOpen.value = false; myNameInput.value = myName.value; myPersonaInput.value = myPersona.value; mySettingsShow.value = true; nextTick(() => refreshIcons()); };
    const saveMySettings = async () => { myName.value = myNameInput.value || '我'; myPersona.value = myPersonaInput.value; mySettingsShow.value = false; await dbSet(`mySettings_${charId}`, JSON.parse(JSON.stringify({ name: myName.value, persona: myPersona.value }))); };

    const openChatSettings = () => { toolbarOpen.value = false; charNameInput.value = charName.value; charWorldInput.value = charWorld.value; charPersonaInput.value = charPersona.value; chatSettingsShow.value = true; nextTick(() => refreshIcons()); };
    const saveChatSettings = async () => {
      chatSettingsShow.value = false;
      charName.value = charNameInput.value; charWorld.value = charWorldInput.value; charPersona.value = charPersonaInput.value;
      const charList = JSON.parse(JSON.stringify((await dbGet('charList')) || []));
      const idx = charList.findIndex(c => c.id === charId);
      if (idx !== -1) { charList[idx].name = charName.value; charList[idx].world = charWorld.value; charList[idx].persona = charPersona.value; await dbSet('charList', charList); }
    };

    const openDimensionLink = () => { toolbarOpen.value = false; dimensionShow.value = true; nextTick(() => refreshIcons()); };
    const openEmoji = () => { toolbarOpen.value = false; emojiShow.value = true; nextTick(() => refreshIcons()); };
    const openMyWhisper = () => { toolbarOpen.value = false; whisperText.value = ''; myWhisperShow.value = true; nextTick(() => refreshIcons()); };

    // ===== 聊天美化 =====
    const openBeauty = () => { toolbarOpen.value = false; beautyShow.value = true; nextTick(() => refreshIcons()); };

    const applyBeautyWallpaperUrl = async () => {
      if (!chatWallpaperUrl.value.trim()) return;
      chatWallpaper.value = chatWallpaperUrl.value.trim();
      applyWallpaperToDom();
      await saveBeauty();
    };

    const applyWallpaperToDom = () => {
      const el = document.getElementById('chatroom-app');
      if (chatWallpaper.value) { el.style.backgroundImage = `url(${chatWallpaper.value})`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }
      else { el.style.backgroundImage = 'none'; }
    };

    const resetChatWallpaper = async () => { chatWallpaper.value = ''; applyWallpaperToDom(); await saveBeauty(); };

    const triggerBeautyWallpaper = () => { beautyWallpaperFile.value.click(); };
    const uploadBeautyWallpaper = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => { chatWallpaper.value = evt.target.result; chatWallpaperUrl.value = ''; applyWallpaperToDom(); await saveBeauty(); e.target.value = ''; };
      reader.readAsDataURL(file);
    };

    const triggerCharAvatar = () => { charAvatarFile.value.click(); };
    const uploadCharAvatar = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => { charAvatar.value = evt.target.result; await saveBeauty(); e.target.value = ''; };
      reader.readAsDataURL(file);
    };

    const triggerMyAvatar = () => { myAvatarFile.value.click(); };
    const uploadMyAvatar = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => { myAvatar.value = evt.target.result; await saveBeauty(); e.target.value = ''; };
      reader.readAsDataURL(file);
    };

    const applyBubbleStyle = () => {
      let style = '';
      if (bubbleCustomOn.value) {
        style += `.msg-bubble { font-size: ${bubbleSize.value}px !important; }`;
        style += `.bubble-left { background: ${charBubbleColor.value} !important; color: ${charBubbleTextColor.value} !important; }`;
        style += `.bubble-right { background: ${myBubbleColor.value} !important; color: ${myBubbleTextColor.value} !important; }`;
      }
      if (cssCustomOn.value && cssCustomInput.value.trim()) { style += cssCustomInput.value; }
      let el = document.getElementById('custom-beauty-style');
      if (!el) { el = document.createElement('style'); el.id = 'custom-beauty-style'; document.head.appendChild(el); }
      el.textContent = style;
    };

    const saveBeauty = async () => {
      await dbSet(`chatBeauty_${charId}`, JSON.parse(JSON.stringify({
        chatWallpaper: chatWallpaper.value, charAvatar: charAvatar.value, myAvatar: myAvatar.value,
        coupleAvatarOn: coupleAvatarOn.value, coupleAvatarDesc: coupleAvatarDesc.value,
        showCharAvatar: showCharAvatar.value, bubbleCustomOn: bubbleCustomOn.value,
        bubbleSize: bubbleSize.value, charBubbleColor: charBubbleColor.value,
        charBubbleTextColor: charBubbleTextColor.value, myBubbleColor: myBubbleColor.value,
        myBubbleTextColor: myBubbleTextColor.value, cssCustomOn: cssCustomOn.value,
        cssCustomInput: cssCustomInput.value
      })));
      applyBubbleStyle();
    };

    const loadBeauty = async () => {
      const b = await dbGet(`chatBeauty_${charId}`);
      if (!b) return;
      chatWallpaper.value = b.chatWallpaper || '';
      charAvatar.value = b.charAvatar || '';
      myAvatar.value = b.myAvatar || '';
      coupleAvatarOn.value = b.coupleAvatarOn || false;
      coupleAvatarDesc.value = b.coupleAvatarDesc || '';
      showCharAvatar.value = b.showCharAvatar || false;
      bubbleCustomOn.value = b.bubbleCustomOn || false;
      bubbleSize.value = b.bubbleSize || '15';
      charBubbleColor.value = b.charBubbleColor || '#ffffff';
      charBubbleTextColor.value = b.charBubbleTextColor || '#111111';
      myBubbleColor.value = b.myBubbleColor || '#111111';
      myBubbleTextColor.value = b.myBubbleTextColor || '#ffffff';
      cssCustomOn.value = b.cssCustomOn || false;
      cssCustomInput.value = b.cssCustomInput || '';
      applyWallpaperToDom();
      applyBubbleStyle();
    };

    // ===== 长按气泡 =====
    const onTouchStart = (msg, i, e) => { touchMoved = false; longPressTimer = setTimeout(() => { if (!touchMoved) { bubbleMenuMsgId.value = bubbleMenuMsgId.value === msg.id ? null : msg.id; nextTick(() => refreshIcons()); } }, 500); };
    const onTouchEnd = () => { clearTimeout(longPressTimer); };
    const onTouchMove = () => { touchMoved = true; clearTimeout(longPressTimer); };
    const onMouseDown = (msg, i) => { longPressTimer = setTimeout(() => { bubbleMenuMsgId.value = bubbleMenuMsgId.value === msg.id ? null : msg.id; nextTick(() => refreshIcons()); }, 500); };
    const onMouseUp = () => { clearTimeout(longPressTimer); };

    const quoteMsg = (msg) => { quotingMsg.value = msg; bubbleMenuMsgId.value = null; };
    const recallMsg = async (msg) => { msg.recalled = true; bubbleMenuMsgId.value = null; await saveMessages(); };
    const toggleRecallReveal = (msg) => { msg.revealed = !msg.revealed; };
    const deleteMsg = async (msg) => { const idx = messages.value.findIndex(m => m.id === msg.id); if (idx !== -1) { messages.value.splice(idx, 1); } bubbleMenuMsgId.value = null; await saveMessages(); };
    const editMsg = (msg) => { msg.editing = true; msg.editContent = msg.content; bubbleMenuMsgId.value = null; nextTick(() => refreshIcons()); };
    const confirmEdit = async (msg) => { msg.content = msg.editContent; msg.editing = false; await saveMessages(); };
    const cancelEdit = (msg) => { msg.editing = false; };

    const startMultiSelect = (id) => { multiSelectMode.value = true; selectedMsgs.value = [id]; bubbleMenuMsgId.value = null; nextTick(() => refreshIcons()); };
    const toggleSelect = (id) => { const idx = selectedMsgs.value.indexOf(id); if (idx === -1) { selectedMsgs.value.push(id); } else { selectedMsgs.value.splice(idx, 1); } };
    const deleteSelected = async () => { messages.value = messages.value.filter(m => !selectedMsgs.value.includes(m.id)); selectedMsgs.value = []; multiSelectMode.value = false; await saveMessages(); };
    const cancelMultiSelect = () => { multiSelectMode.value = false; selectedMsgs.value = []; };

    const autoResize = () => { const el = inputRef.value; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; };
    const scrollToBottom = () => { if (msgArea.value) msgArea.value.scrollTop = msgArea.value.scrollHeight; };

    const saveMessages = async () => {
      const charList = JSON.parse(JSON.stringify((await dbGet('charList')) || []));
      const idx = charList.findIndex(c => c.id === charId);
      if (idx !== -1) {
        charList[idx].messages = JSON.parse(JSON.stringify(messages.value.filter(m => !m.loading)));
        charList[idx].lastMsg = messages.value.filter(m => !m.loading && !m.recalled).slice(-1)[0]?.content || '';
        await dbSet('charList', charList);
      }
    };

    const writeGlobalLog = async (msg, type = 'info', page = '聊天界面') => {
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
      const logs = JSON.parse(JSON.stringify((await dbGet('globalLogs')) || []));
      logs.unshift({ msg, type, time, page });
      if (logs.length > 200) logs.splice(200);
      await dbSet('globalLogs', logs);
    };

    onMounted(async () => {
      const [dark, wp, charList, mySettings, api, ph, mh] = await Promise.all([
        dbGet('darkMode'), dbGet('wallpaper'), dbGet('charList'),
        dbGet(`mySettings_${charId}`), dbGet('apiConfig'),
        dbGet(`peekHistory_${charId}`), dbGet(`mirrorHistory_${charId}`)
      ]);
      if (dark) document.body.classList.add('dark');
      if (wp) { document.body.style.backgroundImage = `url(${wp})`; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center'; }
      const list = charList || [];
      const char = list.find(c => c.id === charId);
      if (char) { charName.value = char.name; charWorld.value = char.world || ''; charPersona.value = char.persona || ''; messages.value = char.messages || []; }
      if (mySettings) { myName.value = mySettings.name || '我'; myPersona.value = mySettings.persona || ''; }
      if (api) apiConfig.value = api;
      if (ph) peekHistory.value = ph;
      if (mh) mirrorHistory.value = mh;
      await loadBeauty();
      nextTick(() => { refreshIcons(); scrollToBottom(); });
    });

    return {
      charName, charWorld, charPersona, myName, myPersona,
      messages, inputText, toolbarOpen, msgArea, inputRef,
      mySettingsShow, chatSettingsShow, dimensionShow,
      peekSoulShow, dimensionMirrorShow, myWhisperShow, emojiShow, beautyShow,
      myNameInput, myPersonaInput, charNameInput, charWorldInput, charPersonaInput,
      whisperText, peekResult, peekLoading, mirrorResult, mirrorLoading, mirrorMode,
      bubbleMenuMsgId, quotingMsg, multiSelectMode, selectedMsgs,
      chatWallpaper, chatWallpaperUrl, charAvatar, myAvatar,
      coupleAvatarOn, coupleAvatarDesc, showCharAvatar,
      bubbleCustomOn, bubbleSize, charBubbleColor, charBubbleTextColor,
      myBubbleColor, myBubbleTextColor, cssCustomOn, cssCustomInput,
      beautyWallpaperFile, charAvatarFile, myAvatarFile,
      toggleToolbar, goBack, getMsg,
      sendMsg, sendWhisper, callApi,
      openPeekSoul, doPeekSoul, peekHistory, peekHistoryShow,
      openDimensionMirror, doMirror, mirrorHistory, mirrorHistoryShow,
      openMySettings, saveMySettings,
      openChatSettings, saveChatSettings,
      openDimensionLink, openEmoji, openMyWhisper, openBeauty,
      applyBeautyWallpaperUrl, resetChatWallpaper, triggerBeautyWallpaper, uploadBeautyWallpaper,
      triggerCharAvatar, uploadCharAvatar, triggerMyAvatar, uploadMyAvatar,
      saveBeauty, applyBubbleStyle,
      onTouchStart, onTouchEnd, onTouchMove, onMouseDown, onMouseUp,
      quoteMsg, recallMsg, toggleRecallReveal, deleteMsg, editMsg, confirmEdit, cancelEdit,
      startMultiSelect, toggleSelect, deleteSelected, cancelMultiSelect,
      autoResize
    };
  }
}).mount('#chatroom-app');
