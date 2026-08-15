// 長文頁側邊目錄：捲動時自動高亮當前段落
(function () {
    var sections = document.querySelectorAll('.article-section');
    if (!sections.length) return;

    var isManualScrolling = false;

    function updateActiveNav(id) {
        document.querySelectorAll('.toc-link').forEach(function (link) {
            link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
        document.querySelectorAll('.mobile-toc-link').forEach(function (link) {
            var on = link.getAttribute('href') === '#' + id;
            link.classList.toggle('active', on);
            if (on) {
                var container = document.getElementById('mobileToc');
                if (container) {
                    container.scrollTo({
                        left: link.offsetLeft - (container.offsetWidth / 2) + (link.offsetWidth / 2),
                        behavior: 'smooth'
                    });
                }
            }
        });
    }

    var observer = new IntersectionObserver(function (entries) {
        if (isManualScrolling) return;
        entries.forEach(function (entry) {
            if (entry.isIntersecting) updateActiveNav(entry.target.getAttribute('id'));
        });
    }, { root: null, rootMargin: '-100px 0px -70% 0px', threshold: 0 });

    sections.forEach(function (section) { observer.observe(section); });

    document.querySelectorAll('.mobile-toc-link, .toc-link').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            isManualScrolling = true;
            var targetId = this.getAttribute('href').substring(1);
            var target = document.getElementById(targetId);
            if (!target) { isManualScrolling = false; return; }
            updateActiveNav(targetId);
            window.scrollTo({
                top: target.getBoundingClientRect().top + window.scrollY - 140,
                behavior: 'smooth'
            });
            setTimeout(function () { isManualScrolling = false; }, 800);
        });
    });
})();
