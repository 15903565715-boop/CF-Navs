(function () {
  "use strict";
  var steps = [
    {
      img: "img/step1-search.svg",
      zh: { title: "搜索，一触即达", text: "在顶部搜索框输入关键词，即时过滤书签；直接输入网址可快速跳转。找网站不用翻来翻去。" },
      en: { title: "Search instantly", text: "Type in the top search box to filter bookmarks as you type. Enter a URL to jump straight to it." }
    },
    {
      img: "img/step2-sidebar.svg",
      zh: { title: "分类浏览", text: "左侧分类栏按主题收纳书签，点击分类名只看该分类的内容，层级再多也不乱。" },
      en: { title: "Browse by category", text: "The left sidebar organizes bookmarks by topic. Click a category to filter." }
    },
    {
      img: "img/step3-card.svg",
      zh: { title: "书签卡片", text: "点击卡片打开网站；右键（长按）可编辑、删除、更换图标，打造顺手的导航。" },
      en: { title: "Bookmark cards", text: "Click a card to open the site. Right-click (long-press) to edit, delete, or change its icon." }
    },
    {
      img: "img/step4-spotlight.svg",
      zh: { title: "Spotlight 快捷搜索", text: "任何时候按下 Ctrl+K（Mac 上是 ⌘K）或 /，即可唤起全局 Spotlight 搜索，纯键盘快速直达。" },
      en: { title: "Spotlight quick search", text: "Press Ctrl+K (⌘K on Mac) or / anywhere to open global Spotlight search — fully keyboard driven." }
    },
    {
      img: "img/step5-settings.svg",
      zh: { title: "个性化设置", text: "在设置面板里换主题、背景、搜索引擎，把起始页调成你喜欢的样子。" },
      en: { title: "Make it yours", text: "Change themes, backgrounds, and the search engine in Settings." }
    },
    {
      img: "",
      zh: { title: "开始使用吧", text: "这就是 CF-Navs 的全部基础操作。忘记了随时点击右上角的 ？ 图标回看本指南。" },
      en: { title: "You're all set", text: "That's everything you need. Tap the ? icon at the top-right anytime to revisit this guide." }
    }
  ];

  var ui = {
    zh: { title: "使用指南", skip: "跳过", prev: "上一步", next: "下一步", done: "开始使用", close: "关闭" },
    en: { title: "User Guide", skip: "Skip", prev: "Back", next: "Next", done: "Get started", close: "Close" }
  };

  var lang = "zh", index = 0;
  var body = document.getElementById("guideBody");
  var dots = document.getElementById("dots");
  var skipBtn = document.getElementById("skipBtn");
  var prevBtn = document.getElementById("prevBtn");
  var nextBtn = document.getElementById("nextBtn");

  // 快捷键文本按平台显示
  function shortcut() {
    return /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘K" : "Ctrl+K";
  }

  function render() {
    var t = ui[lang];
    document.getElementById("guideTitle").textContent = t.title;
    document.getElementById("closeBtn").setAttribute("aria-label", t.close);
    skipBtn.textContent = t.skip;
    prevBtn.textContent = t.prev;
    nextBtn.textContent = index === steps.length - 1 ? t.done : t.next;
    document.querySelectorAll(".lang-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.lang === lang);
    });

    body.innerHTML = "";
    dots.innerHTML = "";
    steps.forEach(function (s, i) {
      var d = document.createElement("button");
      d.className = "dot" + (i === index ? " active" : "");
      d.setAttribute("aria-label", (i + 1) + "/" + steps.length);
      d.onclick = function () { go(i); };
      dots.appendChild(d);

      var sec = document.createElement("section");
      sec.className = "step" + (i === index ? " active" : "");
      var c = s[lang];
      var html = '<span class="step-num">' + (i + 1) + "</span><h2>" + c.title + "</h2>";
      if (s.img) html += '<img class="step-img" src="' + s.img + '" alt="' + c.title + '" loading="lazy">';
      var text = c.text.replace("Ctrl+K", shortcut());
      html += "<p>" + text + "</p>";
      sec.innerHTML = html;
      body.appendChild(sec);
    });

    prevBtn.disabled = index === 0;
    body.scrollTop = 0;
  }

  function go(i) {
    index = Math.max(0, Math.min(steps.length - 1, i));
    render();
  }

  function close() {
    try { parent.postMessage({ type: "cf-navs-guide-close" }, "*"); } catch (e) {}
  }

  skipBtn.onclick = close;
  document.getElementById("closeBtn").onclick = close;
  prevBtn.onclick = function () { go(index - 1); };
  nextBtn.onclick = function () {
    if (index === steps.length - 1) close();
    else go(index + 1);
  };
  document.querySelectorAll(".lang-btn").forEach(function (b) {
    b.onclick = function () { lang = b.dataset.lang; render(); };
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") nextBtn.onclick();
    if (e.key === "ArrowLeft") prevBtn.onclick();
  });

  render();
})();
