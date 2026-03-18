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

    const toggleMenu = () => { menuOpen.value = !menuOpen.value; };

    const openConnectChar = () => { menuOpen.value = false; newChar.value = { name: '', world: '', persona: '', avatar: '' }; connectCharShow.value = true; nextTick(() => lucide.createIcons()); };

    const openConnectRoom = () => { menuOpen.value = false; newRoom.value = { name: '', members: [] }; connectRoomShow.value = true; nextTick(() => lucide.createIcons()); };

    const goRandom = () => { menuOpen.value = false; window.location.href = 'random.html'; };

    const goBack = () => { window.location.href = 'index.html'; };

    const confirmConnectChar = async () => {
      if (!newChar.value.name.trim()) { alert('请输入备注名'); return; }
      const char = { id: Date.now(), name: newChar.value.name.trim(), world: newChar.value.world.trim(), persona: newChar.value.persona.trim(), avatar: '', lastMsg: '', messages: [] };
      charList.value.push(char);
      await dbSet('charList', charList.value);
      connectCharShow.value = false;
      nextTick(() => lucide.createIcons());
    };

    const confirmConnectRoom = async () => {
      if (!newRoom.value.name.trim()) { alert('请输入聊天室名称'); return; }
      if (!newRoom.value.members.length) { alert('请至少选择一个角色'); return; }
      const room = { id: Date.now(), name: newRoom.value.name.trim(), members: newRoom.value.members, lastMsg: '', messages: [] };
      roomList.value.push(room);
      await dbSet('roomList', roomList.value);
      connectRoomShow.value = false;
      nextTick(() => lucide.createIcons());
    };

    const toggleMember = (c) => {
      const idx = newRoom.value.members.findIndex(m => m.id === c.id);
      if (idx === -1) { newRoom.value.members.push(c); } else { newRoom.value.members.splice(idx, 1); }
    };

    const enterChat = (c) => { window.location.href = `chatroom.html?id=${c.id}&type=char`; };
    const enterRoom = (r) => { window.location.href = `chatroom.html?id=${r.id}&type=room`; };

    // 点击其他地方关闭菜单
    const handleOutsideClick = (e) => {
      if (menuOpen.value && menuBtnRef.value && !menuBtnRef.value.contains(e.target)) { menuOpen.value = false; }
    };

    onMounted(async () => {
      const dark = await dbGet('darkMode');
      if (dark) document.body.classList.add('dark');
      const wp = await dbGet('wallpaper');
      if (wp) { document.body.style.backgroundImage = `url(${wp})`; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center'; }
      charList.value = (await dbGet('charList')) || [];
      roomList.value = (await dbGet('roomList')) || [];
      lucide.createIcons();
      document.addEventListener('click', handleOutsideClick);
    });


    return {
      menuOpen, menuBtnRef,
      charList, roomList,
      connectCharShow, connectRoomShow,
      newChar, newRoom,
      toggleMenu, openConnectChar, openConnectRoom, goRandom, goBack,
      confirmConnectChar, confirmConnectRoom, toggleMember,
      enterChat, enterRoom
    };
  }
}).mount('#chat-app');
