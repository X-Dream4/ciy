// 全局通知系统
const NOTIFY_KEY = 'pendingNotifications';
const ONESIGNAL_APP_ID = '821ab26a-5541-4f0e-a63d-fe385e28a417';
const ONESIGNAL_REST_KEY = 'os_v2_app_qinle2svifhq5jr57y4f4kfec6hyf4zbnzbe6gn75ptisp47u6uum7oaiccsnl3fc4gjoaxp4s4f2chqignoewmdkh6k2fmz3s53j7y'; // 等你找到REST API Key再填这里

// 发送通知（在 chatroom.js 里调用）
async function sendCharNotification(charName, content, charAvatar) {
  // 1. 写入 localStorage 供其他页面读取
  const pending = JSON.parse(localStorage.getItem(NOTIFY_KEY) || '[]');
  pending.push({
    id: Date.now(),
    charName,
    content: content.slice(0, 50),
    avatar: charAvatar || '',
    time: Date.now()
  });
  if (pending.length > 10) pending.splice(0, pending.length - 10);
  localStorage.setItem(NOTIFY_KEY, JSON.stringify(pending));

  // 2. 浏览器系统通知（前台）
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(charName, {
      body: content.slice(0, 80),
      tag: `char_${charName}`,
      renotify: true
    });
  }

  // 3. 标题闪烁（切到其他标签页时）
  if (document.hidden) {
    const originalTitle = document.title;
    let showAlert = true;
    const titleTimer = setInterval(() => {
      document.title = showAlert ? `【新消息】${charName}` : originalTitle;
      showAlert = !showAlert;
    }, 1000);
    const restore = () => {
      if (!document.hidden) {
        clearInterval(titleTimer);
        document.title = originalTitle;
        document.removeEventListener('visibilitychange', restore);
      }
    };
    document.addEventListener('visibilitychange', restore);
  }

  // 4. OneSignal 后台推送（切到其他软件时）
  if (document.hidden && ONESIGNAL_REST_KEY) {
    sendOneSignalPush(charName, content.slice(0, 80), charAvatar);
  }
}

// OneSignal 后台推送
async function sendOneSignalPush(title, message, icon) {
  try {
    const subId = await getOneSignalSubId();
    if (!subId) return;
    await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_subscription_ids: [subId],
        headings: { en: title, zh: title },
        contents: { en: message, zh: message },
        chrome_web_icon: icon || '',
        url: window.location.href,
      }),
    });
  } catch(e) {
    console.warn('OneSignal推送失败:', e);
  }
}

// 获取 OneSignal 订阅ID
async function getOneSignalSubId() {
  try {
    if (window.OneSignal) {
      const id = await OneSignal.User.PushSubscription.id;
      if (id) localStorage.setItem('osSubId', id);
      return id;
    }
    return localStorage.getItem('osSubId');
  } catch(e) {
    return localStorage.getItem('osSubId');
  }
}

// 请求通知权限
async function requestNotifyPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// 请求 OneSignal 推送权限
async function requestOneSignalPermission() {
  if (window.OneSignalDeferred) {
    OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.Notifications.requestPermission();
    });
  }
}

// 在各个页面的 onMounted 里调用
function listenForNotifications() {
  window.addEventListener('storage', (e) => {
    if (e.key !== NOTIFY_KEY) return;
    const pending = JSON.parse(e.newValue || '[]');
    if (!pending.length) return;
    const latest = pending[pending.length - 1];
    showInAppToast(latest.charName, latest.content, latest.avatar);
    localStorage.removeItem(NOTIFY_KEY);
  });
}

// 应用内浮窗提示
function showInAppToast(charName, content, avatar) {
  const existing = document.getElementById('char-notify-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'char-notify-toast';
  toast.style.cssText = `
    position:fixed;top:16px;left:50%;transform:translateX(-50%);
    background:rgba(20,20,20,0.92);color:#fff;
    border-radius:16px;padding:10px 16px;
    display:flex;align-items:center;gap:10px;
    z-index:99999;max-width:320px;width:calc(100% - 32px);
    box-shadow:0 4px 20px rgba(0,0,0,0.25);
    animation:toastIn 0.3s ease;
    backdrop-filter:blur(12px);
    cursor:pointer;
  `;

  const avatarEl = document.createElement('div');
  avatarEl.style.cssText = `
    width:36px;height:36px;border-radius:50%;
    background:#444;flex-shrink:0;
    background-size:cover;background-position:center;
    ${avatar ? `background-image:url(${avatar});` : ''}
    display:flex;align-items:center;justify-content:center;
    font-size:14px;font-weight:700;color:#fff;
  `;
  if (!avatar) avatarEl.textContent = charName[0] || '?';

  const textEl = document.createElement('div');
  textEl.style.cssText = 'flex:1;min-width:0;';
  textEl.innerHTML = `
    <div style="font-size:13px;font-weight:700;margin-bottom:2px;">${charName}</div>
    <div style="font-size:12px;opacity:0.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${content}</div>
  `;

  toast.appendChild(avatarEl);
  toast.appendChild(textEl);

  if (!document.getElementById('toast-style')) {
    const s = document.createElement('style');
    s.id = 'toast-style';
    s.textContent = `
      @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(-12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      @keyframes toastOut { from { opacity:1; } to { opacity:0; transform:translateX(-50%) translateY(-12px); } }
    `;
    document.head.appendChild(s);
  }

  document.body.appendChild(toast);

  const dismiss = () => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  };
  toast.addEventListener('click', dismiss);
  setTimeout(dismiss, 4000);
}
