const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const posts = ref([]);
    const categories = ref([]);
    const currentTab = ref('all');
    const postShow = ref(false);
    const detailShow = ref(false);
    const addCatShow = ref(false);
    const currentPost = ref(null);
    const newCatName = ref('');
    const replyAuthor = ref('');
    const replyAvatarUrl = ref('');
    const replyContent = ref('');

    const newPost = ref({ author: '', avatar: '', category: '', title: '', content: '' });

    const filteredPosts = computed(() => {
      const list = [...posts.value].reverse();
      if (currentTab.value === 'all') return list;
      return list.filter(p => p.category === currentTab.value);
    });

    const goBack = () => { window.location.href = 'world.html'; };

    const openPost = () => { newPost.value = { author: '', avatar: '', category: '', title: '', content: '' }; postShow.value = true; };

    const submitPost = async () => {
      if (!newPost.value.author.trim()) { alert('请填写作者名字'); return; }
      if (!newPost.value.title.trim()) { alert('请填写标题'); return; }
      if (!newPost.value.content.trim()) { alert('请填写内容'); return; }
      postShow.value = false;
      const post = {
        id: Date.now(),
        author: newPost.value.author.trim(),
        avatar: newPost.value.avatar.trim(),
        category: newPost.value.category,
        title: newPost.value.title.trim(),
        content: newPost.value.content.trim(),
        time: new Date().toLocaleString(),
        likes: 0,
        replies: []
      };
      posts.value.push(post);
      await dbSet('forumPosts', JSON.parse(JSON.stringify(posts.value)));
      await dbSet('forumCategories', JSON.parse(JSON.stringify(categories.value)));
    };

    const openDetail = (post) => { currentPost.value = post; replyAuthor.value = ''; replyAvatarUrl.value = ''; replyContent.value = ''; detailShow.value = true; nextTick(() => lucide.createIcons()); };

    const likePost = async (post) => {
      if (!post) return;
      post.likes = (post.likes || 0) + 1;
      await dbSet('forumPosts', JSON.parse(JSON.stringify(posts.value)));
    };

    const submitReply = async () => {
      if (!replyAuthor.value.trim()) { alert('请填写名字'); return; }
      if (!replyContent.value.trim()) { alert('请填写回复内容'); return; }
      if (!currentPost.value.replies) currentPost.value.replies = [];
      currentPost.value.replies.push({
        author: replyAuthor.value.trim(),
        avatar: replyAvatarUrl.value.trim(),
        content: replyContent.value.trim(),
        time: new Date().toLocaleString()
      });
      replyContent.value = '';
      await dbSet('forumPosts', JSON.parse(JSON.stringify(posts.value)));
    };

    const deletePost = async (post) => {
      if (!confirm('确定删除这个帖子？')) return;
      const idx = posts.value.findIndex(p => p.id === post.id);
      if (idx !== -1) posts.value.splice(idx, 1);
      detailShow.value = false;
      await dbSet('forumPosts', JSON.parse(JSON.stringify(posts.value)));
    };

    const addCategory = async () => {
      if (!newCatName.value.trim()) return;
      if (categories.value.includes(newCatName.value.trim())) { alert('分区已存在'); return; }
      categories.value.push(newCatName.value.trim());
      newCatName.value = '';
      addCatShow.value = false;
      await dbSet('forumCategories', JSON.parse(JSON.stringify(categories.value)));
    };

    const { nextTick } = Vue;

    onMounted(async () => {
      const dark = await dbGet('darkMode');
      if (dark) document.body.classList.add('dark');
      const wp = await dbGet('wallpaper');
      if (wp) { document.body.style.backgroundImage = `url(${wp})`; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center'; }
      const savedPosts = await dbGet('forumPosts');
      if (savedPosts) posts.value = savedPosts;
      const savedCats = await dbGet('forumCategories');
      if (savedCats) categories.value = savedCats;
      lucide.createIcons();
    });

    return {
      posts, categories, currentTab, postShow, detailShow, addCatShow,
      currentPost, newCatName, replyAuthor, replyAvatarUrl, replyContent,
      newPost, filteredPosts,
      goBack, openPost, submitPost, openDetail, likePost, submitReply, deletePost, addCategory
    };
  }
}).mount('#forum-app');
