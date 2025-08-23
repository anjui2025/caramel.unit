/**
* Template Name: Kelly
* Template URL: https://bootstrapmade.com/kelly-free-bootstrap-cv-resume-html-template/
* Updated: Aug 07 2024 with Bootstrap v5.3.3
* Author: BootstrapMade.com
* License: https://bootstrapmade.com/license/
*/
console.log("JS loaded");

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded");

  const tabButtons = document.querySelectorAll('#my-tab-test .tab-btn');
  console.log("找到按鈕數量", tabButtons.length);

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      console.log("按了", button.dataset.tab);
    });
  });
});

(function() {
  "use strict";

  /**
   * Apply .scrolled class to the body as the page is scrolled down
   */
  function toggleScrolled() {
    const selectBody = document.querySelector('body');
    const selectHeader = document.querySelector('#header');
    if (!selectHeader.classList.contains('scroll-up-sticky') && !selectHeader.classList.contains('sticky-top') && !selectHeader.classList.contains('fixed-top')) return;
    window.scrollY > 100 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
  }

  document.addEventListener('scroll', toggleScrolled);
  window.addEventListener('load', toggleScrolled);

  /**
   * Mobile nav toggle
   */
  const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');

  function mobileNavToogle() {
    document.querySelector('body').classList.toggle('mobile-nav-active');
    mobileNavToggleBtn.classList.toggle('bi-list');
    mobileNavToggleBtn.classList.toggle('bi-x');
  }
  mobileNavToggleBtn.addEventListener('click', mobileNavToogle);

  /**
   * Hide mobile nav on same-page/hash links
   */
  document.querySelectorAll('#navmenu a').forEach(navmenu => {
    navmenu.addEventListener('click', () => {
      if (document.querySelector('.mobile-nav-active')) {
        mobileNavToogle();
      }
    });

  });

  /**
   * Toggle mobile nav dropdowns
   */
  document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
    navmenu.addEventListener('click', function(e) {
      e.preventDefault();
      this.parentNode.classList.toggle('active');
      this.parentNode.nextElementSibling.classList.toggle('dropdown-active');
      e.stopImmediatePropagation();
    });
  });

  /**
   * Preloader
   */
  const preloader = document.querySelector('#preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      preloader.remove();
    });
  }

  /**
   * Scroll top button
   */
  let scrollTop = document.querySelector('.scroll-top');

  function toggleScrollTop() {
    if (scrollTop) {
      window.scrollY > 100 ? scrollTop.classList.add('active') : scrollTop.classList.remove('active');
    }
  }
  scrollTop.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  window.addEventListener('load', toggleScrollTop);
  document.addEventListener('scroll', toggleScrollTop);

  /**
   * Animation on scroll function and init
   */
  function aosInit() {
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: true,
      mirror: false
    });
  }
  window.addEventListener('load', aosInit);

  /**
   * Animate the skills items on reveal
   */
  let skillsAnimation = document.querySelectorAll('.skills-animation');
  skillsAnimation.forEach((item) => {
    new Waypoint({
      element: item,
      offset: '80%',
      handler: function(direction) {
        let progress = item.querySelectorAll('.progress .progress-bar');
        progress.forEach(el => {
          el.style.width = el.getAttribute('aria-valuenow') + '%';
        });
      }
    });
  });

  /**
   * Initiate Pure Counter
   */
  // new PureCounter();

  /**
   * Init swiper sliders
   */
  function initSwiper() {
    document.querySelectorAll(".init-swiper").forEach(function(swiperElement) {
      let config = JSON.parse(
        swiperElement.querySelector(".swiper-config").innerHTML.trim()
      );

      if (swiperElement.classList.contains("swiper-tab")) {
        initSwiperWithCustomPagination(swiperElement, config);
      } else {
        new Swiper(swiperElement, config);
      }
    });
  }

  window.addEventListener("load", initSwiper);

  /**
   * Initiate glightbox
   */
  // const glightbox = GLightbox({
  //   selector: '.glightbox'
  // });

  /**
   * Init isotope layout and filters
   */
  document.querySelectorAll('.isotope-layout').forEach(function(isotopeItem) {
    let layout = isotopeItem.getAttribute('data-layout') ?? 'masonry';
    let filter = isotopeItem.getAttribute('data-default-filter') ?? '*';
    let sort = isotopeItem.getAttribute('data-sort') ?? 'original-order';

    let initIsotope;
    imagesLoaded(isotopeItem.querySelector('.isotope-container'), function() {
      initIsotope = new Isotope(isotopeItem.querySelector('.isotope-container'), {
        itemSelector: '.isotope-item',
        layoutMode: layout,
        filter: filter,
        sortBy: sort
      });
    });

    isotopeItem.querySelectorAll('.isotope-filters li').forEach(function(filters) {
      filters.addEventListener('click', function() {
        isotopeItem.querySelector('.isotope-filters .filter-active').classList.remove('filter-active');
        this.classList.add('filter-active');
        initIsotope.arrange({
          filter: this.getAttribute('data-filter')
        });
        if (typeof aosInit === 'function') {
          aosInit();
        }
      }, false);
    });

  });
})();

//hero區塊動畫
function initHeroTitle(line1, line2) {
  const canvas = document.getElementById('sparks');
  const ctx = canvas.getContext('2d');
  const title1 = document.getElementById("title-line1");
  const title2 = document.getElementById("title-line2");
  let sparks = [];

  function createSparks(x, y) {
    for (let i = 0; i < 30; i++) {
      sparks.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 30
      });
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sparks = sparks.filter(s => s.life-- > 0);
    sparks.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,200,100,${s.life / 30})`;
      ctx.fill();
      s.x += s.vx;
      s.y += s.vy;
    });
    requestAnimationFrame(animate);
  }

  function buildAnimatedLine(text, containerEl, delayOffset = 0) {
    containerEl.innerHTML = ""; // 先清空
    text.split("").forEach((char, index) => {
      const span = document.createElement("span");
      span.innerHTML = char === " " ? "&nbsp;" : char;
      span.classList.add("char");
      span.style.animationDelay = `${(index + delayOffset) * 0.1}s`;
      const rot = (Math.random() * 720 - 360).toFixed(1);
      span.style.setProperty('--rot', `${rot}deg`);
      containerEl.appendChild(span);
    });

    containerEl.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      createSparks(e.clientX - rect.left, e.clientY - rect.top);
    });
  }

  buildAnimatedLine(line1, title1, 0);
  buildAnimatedLine(line2, title2, line1.length);
  animate();
}

 // 完整專案
document.addEventListener("DOMContentLoaded", function () {
  const tabButtons = document.querySelectorAll('#my-tab-test .tab-btn');
  const tabPanels = document.querySelectorAll('#my-tab-test .tab-panel');

  if (tabButtons.length === 0 || tabPanels.length === 0) {
    console.warn("⚠️ 找不到 tab 元素");
    return;
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // 切換按鈕樣式
      tabButtons.forEach(btn => btn.classList.remove('tab-active'));
      button.classList.add('tab-active');

      // 切換內容
      const targetId = button.getAttribute('data-tab');
      tabPanels.forEach(panel => {
        panel.classList.toggle('tab-active', panel.id === targetId);
      });
    });
  });

  // 初始觸發
  tabButtons[0].click();
});

// 聯絡我表單設置
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("myForm");
  if (!form) return; // 防呆：如果沒有表單就不做事

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const subject = document.getElementById("subject").value;
    const message = document.getElementById("message").value;

    const formData = new FormData();
    formData.append("entry.1027250718", name);
    formData.append("entry.1652791669", email);
    formData.append("entry.339231489", subject);
    formData.append("entry.1366302806", message);

    fetch("https://docs.google.com/forms/d/e/1FAIpQLSeJ33Zh5YFGiJ8vSGJFLVll7VT3U70ax8iLmYRhmu5IAw34mA/formResponse", {
      method: "POST",
      mode: "no-cors",
      body: formData
    }).then(() => {
      document.querySelector(".sent-message").style.display = "block";
      form.reset();
    }).catch((error) => {
      alert("送出失敗，請稍後再試");
    });
  });
});

// 小節導覽列觸發器與區塊
const stickyNav = document.getElementById("sticky-nav");
const trigger = document.getElementById("sticky-nav-trigger");

// 監控是否觸發 sticky 顯示
const observer = new IntersectionObserver(
  (entries) => {
    if (!entries[0].isIntersecting) {
      stickyNav.style.display = "block";
    } else {
      stickyNav.style.display = "none";
    }
  },
  { threshold: 0 }
);
// observer.observe(trigger);

// 小節導覽按鈕：平滑滾動 + 偏移補正
document.addEventListener('DOMContentLoaded', () => {
  // (可選) AOS
  if (window.AOS) AOS.init();

  // 共用 Modal 與元素
  const modalEl     = document.getElementById('mpModal');
  const $title      = document.getElementById('mpModalLabel');
  const $desc       = document.getElementById('mpModalDesc');
  const $why        = document.getElementById('mpModalWhy');
  const $features   = document.getElementById('mpModalFeatures');
  const $demoBtn    = document.getElementById('mpModalDemo');
  const $repoBtn    = document.getElementById('mpModalRepo');
  const $videoWrap  = document.getElementById('mpModalVideoWrap');
  const $video      = document.getElementById('mpModalVideo');

  // 綁定所有 Read more 按鈕
  const buttons = document.querySelectorAll('.js-readmore');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      // 標題/描述/動機
      $title.textContent = btn.dataset.title || 'Mini Project';
      $desc.textContent  = btn.dataset.desc  || '';
      $why.textContent   = btn.dataset.why   || '';

      // 功能清單
      $features.innerHTML = '';
      (btn.dataset.features || '')
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(item => {
          const li = document.createElement('li');
          li.textContent = item;
          $features.appendChild(li);
        });

      // Demo / Repo
      if (btn.dataset.demo) {
        $demoBtn.href = btn.dataset.demo;
        $demoBtn.classList.remove('d-none');
      } else {
        $demoBtn.classList.add('d-none');
      }

      if (btn.dataset.repo) {
        $repoBtn.href = btn.dataset.repo;
        $repoBtn.classList.remove('d-none');
      } else {
        $repoBtn.classList.add('d-none');
      }

      // 影片：強制重載正確來源
      const src = (btn.dataset.video || '').trim();

      // 先停止並清空舊的來源
      if ($video) {
        try { $video.pause(); } catch (e) {}
        $video.removeAttribute('src');
        $video.load(); // reset
      }

      if (src) {
        $videoWrap?.classList.remove('d-none');
        $video.muted = true;   // 自動播放規則
        $video.src = src;
        $video.load();         // 載入新來源
        $video.play().catch(() => { /* 某些瀏覽器需要手勢，忽略 */ });
      } else {
        $videoWrap?.classList.add('d-none');
      }
    });
  });

  // Modal 關閉時，停掉並清空影片，確保下次一定重載
  modalEl.addEventListener('hidden.bs.modal', () => {
    if ($video) {
      try { $video.pause(); } catch (e) {}
      $video.removeAttribute('src');
      $video.load();
    }
  });
});


//作品集的篩選按鈕
document.addEventListener("DOMContentLoaded",function(){
  const filters=document.querySelectorAll(".works-filters li");
  const cards=document.querySelectorAll(".works-card");

  filters.forEach(btn=>{
    btn.addEventListener("click",()=>{
      filters.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const f=btn.dataset.filter;
      cards.forEach(card=>{
        if(f==="all" || card.classList.contains(f)){
          card.classList.remove("hide");
        }else{
          card.classList.add("hide");
        }
      });
    });
  });
});
// --- Sticky 導覽: 只有在元素存在時才觀察，並復活被註解的 observe ---
(function () {
  const stickyNav = document.getElementById("sticky-nav");
  const trigger = document.getElementById("sticky-nav-trigger");
  if (!stickyNav || !trigger) return;

  const io = new IntersectionObserver((entries) => {
    const notInView = !entries[0].isIntersecting;
    // 你原本是用 display 切換；這裡沿用
    stickyNav.style.display = notInView ? "block" : "none";
  }, { threshold: 0 });

  io.observe(trigger);
})();

// --- 小節導覽按鈕：平滑捲動 + Header 偏移補正 ---
(function () {
  const header = document.getElementById('header');
  const headerOffset = (header?.offsetHeight || 0) + 12; // 預留一點間距

  document.querySelectorAll('.sub-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const sel = btn.dataset.target; // 例如 "#section-idea"
      const target = sel ? document.querySelector(sel) : null;
      if (!target) return;

      const y = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });
})();