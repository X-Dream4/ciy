const { createApp, ref, onMounted, nextTick } = Vue;

createApp({
  setup() {
    const menuOpen = ref(false);
    const menuBtnRef = ref(null);
    const charList = ref([]);
    const roomList = ref([]);
    const connectCharShow = ref(false);
    const connectRoomShow = ref(false);
    const newChar = ref({ name: '', world: '', persona: '', avatar: '' });
    const newRoom = ref({ name: '', members: [] });

    let lucideTimer = null;
    const refreshIcons = () => { clearTimeout(lucideTimer); lucideTimer = setTimeout(() => lucide.createIcons(), 50); };

    const toggleMenu = () => { menuOpen.value = !menuOpen.value; };
    const openConnectChar = () => { menuOpen.value = false; newChar.value = { name: '', world: '', persona: '', avatar: '' }; connectCharShow.value = true; nextTick(() => refreshIcons()); };
    const openConnectRoom = () => { menuOpen.value = false; newRoom.value = { name: '', members: [] }; connectRoomShow.value = true; nextTick(() => refreshIcons()); };
    const goRandom = () => { menuOpen.value = false; window.location.href = 'random.html'; };
    const goBack = () => { window.location.href = 'index.html'; };

    const confirmConnectChar = async () => {
      if (!newChar.value.name.trim()) { alert('请输入备注名'); return; }
      connectCharShow.value = false;
      const char = { id: Date.now(), name: newChar.value.name.trim(), world: newChar.value.world.trim(), persona: newChar.value.persona.trim(), avatar: '', lastMsg: '', messages: [] };
      charList.value.push(char);
      await dbSet('charList', JSON.parse(JSON.stringify(charList.value)));
      nextTick(() => refreshIcons());
    };

    const confirmConnectRoom = async () => {
      if (!newRoom.value.name.trim()) { alert('请输入聊天室名称'); return; }
      if (!newRoom.value.members.length) { alert('请至少选择一个角色'); return; }
      connectRoomShow.value = false;
      const room = { id: Date.now(), name: newRoom.value.name.trim(), members: JSON.parse(JSON.stringify(newRoom.value.members)), lastMsg: '', messages: [] };
      roomList.value.push(room);
      await dbSet('roomList', JSON.parse(JSON.stringify(roomList.value)));
      nextTick(() => refreshIcons());
    };

    const toggleMember = (c) => {
      const idx = newRoom.value.members.findIndex(m => m.id === c.id);
      if (idx === -1) { newRoom.value.members.push(c); } else { newRoom.value.members.splice(idx, 1); }
    };

    const enterChat = (c) => { window.location.href = `chatroom.html?id=${c.id}&type=char`; };
    const enterRoom = (r) => { window.location.href = `chatroom.html?id=${r.id}&type=room`; };

    const handleOutsideClick = (e) => {
      if (menuOpen.value && menuBtnRef.value && !menuBtnRef.value.contains(e.target)) { menuOpen.value = false; }
    };

    onMounted(async () => {
      const [dark, wp, chars, rooms] = await Promise.all([
        dbGet('darkMode'), dbGet('wallpaper'), dbGet('charList'), dbGet('roomList')
      ]);
      if (dark) document.body.classList.add('dark');
      if (wp) { document.body.style.backgroundImage = `url(${wp})`; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center'; }
      charList.value = chars || [];
      roomList.value = rooms || [];
      // 加载每个角色的头像
      for (const c of charList.value) {
        const beauty = await dbGet(`chatBeauty_${c.id}`);
        if (beauty && beauty.charAvatar) { c.avatar = beauty.charAvatar; }
      }
      nextTick(() => refreshIcons());
      document.addEventListener('click', handleOutsideClick);
    });

    return {
      menuOpen, menuBtnRef, charList, roomList,
      connectCharShow, connectRoomShow, newChar, newRoom,
      toggleMenu, openConnectChar, openConnectRoom, goRandom, goBack,
      confirmConnectChar, confirmConnectRoom, toggleMember,
      enterChat, enterRoom
    };
  }
}).mount('#chat-app');
