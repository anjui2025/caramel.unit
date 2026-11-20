/* 自製 lightbox：給所有 a[data-lightbox] 用
   取代 lightbox2——它需要 jQuery，而這個站沒有載 jQuery，所以本來是壞的。
   關閉方式：點圖片外面、點右上角的 ×、按 Esc
   同一個 data-lightbox 群組可以用左右鍵或兩側按鈕切換 */
(function () {
    'use strict';

    var links = Array.prototype.slice.call(document.querySelectorAll('a[data-lightbox]'));
    if (!links.length) return;

    var overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.id = 'siteLightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
        '<div class="lightbox-content">' +
            '<button class="lightbox-close" type="button" aria-label="關閉圖片檢視"><i class="bi bi-x-lg"></i></button>' +
            '<button class="lightbox-nav lightbox-prev" type="button" aria-label="上一張"><i class="bi bi-chevron-left"></i></button>' +
            '<img alt="">' +
            '<button class="lightbox-nav lightbox-next" type="button" aria-label="下一張"><i class="bi bi-chevron-right"></i></button>' +
            '<p class="lightbox-caption"></p>' +
        '</div>';
    document.body.appendChild(overlay);

    var img = overlay.querySelector('img');
    var caption = overlay.querySelector('.lightbox-caption');
    var btnClose = overlay.querySelector('.lightbox-close');
    var btnPrev = overlay.querySelector('.lightbox-prev');
    var btnNext = overlay.querySelector('.lightbox-next');

    var group = [];
    var index = 0;
    var lastFocus = null;

    function show(i) {
        index = (i + group.length) % group.length;
        var link = group[index];
        var title = link.getAttribute('data-title') || '';
        var thumb = link.querySelector('img');
        img.src = link.getAttribute('href');
        img.alt = title || (thumb ? thumb.alt : '');
        caption.textContent = title;
        caption.hidden = !title;
        var many = group.length > 1;
        btnPrev.hidden = !many;
        btnNext.hidden = !many;
    }

    function open(link) {
        var name = link.getAttribute('data-lightbox');
        group = links.filter(function (a) { return a.getAttribute('data-lightbox') === name; });
        lastFocus = document.activeElement;
        show(group.indexOf(link));
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        btnClose.focus();
    }

    function close() {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    links.forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            open(link);
        });
    });

    // 點圖片外面就關掉（overlay 本身，或圖片周圍的留白）
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay || e.target === overlay.firstElementChild) close();
    });

    btnClose.addEventListener('click', close);
    btnPrev.addEventListener('click', function () { show(index - 1); });
    btnNext.addEventListener('click', function () { show(index + 1); });

    document.addEventListener('keydown', function (e) {
        if (!overlay.classList.contains('active')) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') show(index - 1);
        else if (e.key === 'ArrowRight') show(index + 1);
    });
})();
