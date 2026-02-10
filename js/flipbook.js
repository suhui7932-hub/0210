$(function () {
  // ==========================================================================
  // 1. 초기 설정 및 변수 선언
  // ==========================================================================
  const cfg = window.FLIPBOOK_CONFIG;
  const $book = $("#book");
  const $viewport = $("#book-viewport");
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  // 설정 데이터 로드 (config.js 우선)
  const info = (cfg && cfg.bookInfo) ? cfg.bookInfo : { totalPages: 108, title: "플립북", imageType: "webp", thumbType: "webp" };
  const TOTAL_PAGES = info.totalPages; 
  const imgExt = info.imageType;
  const thumbExt = info.thumbType;

  // UI 요소 변수
  const $slider = $("#page-slider");
  const $track = $("#thumb-track");
  const $scrollbar = $("#thumb-scrollbar");
  const $scrollContainer = $("#thumb-scroll-container");

  // 상태 변수
  let imgRatio = 1.414;
  let isSoundEnabled = true;
  let isAnimEnabled = true;
  let lastWidth = $(window).width();
  let resizeTimer;

  // 브라우저 및 슬라이더 초기화
  if (info.title) document.title = info.title;
  $slider.attr("max", TOTAL_PAGES);

  // ==========================================================================
  // 2. 모바일 전용 초기화 및 터치 토글 (도움말/상단바 로직 통합)
  // ==========================================================================
if (isMobile) {
    // [상단바 생성] 도움말 버튼을 여기로 이동
    const mobileHeader = `
      <div id="mobile-header" class="mobile-ui"> 
        <button id="m-btnHelp" class="util-btn">❓</button>
        <button id="m-btnSound" class="util-btn">🔊</button>
      </div>`;
    $("body").append(mobileHeader);
    
    // [하단 푸터 재구성] 이전, 다음, 전체목차 중심
    const mobileFooterHTML = `
      <div class="ui-group main-controls" style="width: 100%; justify-content: space-around;">
        <button id="m-btnPrev" class="primary-btn">◀ 이전</button>
        <button id="m-btnNext" class="primary-btn">다음 ▶</button>
        <button id="m-thumb-toggle" class="menu-btn">▤ 목차</button>
      </div>`;
    
    $("#ui-footer").addClass("mobile-ui").html(mobileFooterHTML);

    // [이벤트 연결]
    $(document).on("click", "#m-btnPrev", () => $book.turn("previous"));
    $(document).on("click", "#m-btnNext", () => $book.turn("next"));
    // 상단바에 새로 생긴 도움말 버튼 이벤트
    $(document).on("click", "#m-btnHelp", (e) => { 
        e.preventDefault(); 
        $("#help-modal").addClass("open"); 
    });
    $(document).on("click", "#m-thumb-toggle", () => $("#thumb-panel").toggleClass("open"));
    $(document).on("click", "#m-btnSound", function() {
        $("#btnSound").click(); 
        $(this).text(isSoundEnabled ? "🔊" : "🔇");
    });
  }

  // 화면 터치 시 상/하단 동시 토글 로직
  $viewport.on("click", function(e) {
    if (!isMobile || (window.isZoomed && window.isZoomed())) return;
    
    // UI 요소(버튼, 패널, 모달) 클릭 시에는 숨겨지지 않도록 방어
    if ($(e.target).closest(".mobile-ui, #thumb-panel, .modal-content").length) return;

    $(".mobile-ui").toggleClass("active");
    
    // UI가 숨겨질 때 목차 패널도 함께 닫음
    if (!$(".mobile-ui").hasClass("active")) {
      $("#thumb-panel").removeClass("open");
    }
  });

  // ==========================================================================
  // 3. 기능 함수 (이미지 로드, 사이즈 계산, 툴팁, 썸네일)
  // ==========================================================================
  function loadPageImage(page) {
    if (!page || isNaN(page) || page < 1 || page > TOTAL_PAGES) return;
    setTimeout(() => {
      const $page = $book.find(".p" + page);
      if ($page.length && !$page.data("loaded")) {
        const num = String(page).padStart(3, "0");
        const imgUrl = `spreads/page-${num}.${imgExt}`;
        $page.html(`<img src="${imgUrl}" style="width:100%; height:100%; object-fit:contain; display:block;" />`);
        $page.data("loaded", true);
      }
    }, 1);
  }

  function getDisplayMode() {
    const windowWidth = $(window).width();
    const windowHeight = $(window).height();
    return (windowWidth >= 1024 || windowHeight <= windowWidth) ? "double" : "single";
  }

  function updateBookSize() {
    const currentWidth = $(window).width();
    if (Math.abs(currentWidth - lastWidth) < 10 && $book.data("done")) return;
    lastWidth = currentWidth;
    const vW = $viewport.width() * 0.94;
    const vH = $viewport.height() * 0.94;
    const mode = getDisplayMode();
    const targetRatio = (mode === "double") ? imgRatio * 2 : imgRatio;
    let w, h;
    if (vW / vH > targetRatio) { h = vH; w = h * targetRatio; }
    else { w = vW; h = w / targetRatio; }
    
    if ($book.data("done")) {
      if ($book.turn("display") !== mode) $book.turn("display", mode);
      $book.turn("size", Math.floor(w), Math.floor(h));
    } else {
      $book.css({ width: Math.floor(w), height: Math.floor(h) });
    }
  }

  function updateTooltip(page) {
    const $tooltip = $("#slider-tooltip");
    const val = parseInt(page);
    const percent = (val - 1) / (TOTAL_PAGES - 1); 
    $tooltip.text(val + "P").css("left", (percent * 100) + "%");
  }

  function buildThumbnails() {
    $track.empty();
    for (let i = 1; i <= TOTAL_PAGES; i += 2) {
      const nextP = (i + 1 <= TOTAL_PAGES) ? i + 1 : i;
      const label = (i === nextP) ? `${i}P` : `${i}-${nextP}`;
      const thumb = $(`
        <div class="thumb-item" data-page="${i}">
          <div class="thumb-img-container">
            <img src="thumbs/page-${String(i).padStart(3, '0')}.${thumbExt}" loading="lazy" />
            <div class="thumb-overlay">${label}</div>
          </div>
        </div>`);
      thumb.on("click", function(e) {
        e.stopPropagation();
        $book.turn("page", parseInt($(this).attr("data-page")));
        setTimeout(() => { $("#thumb-panel").removeClass("open"); }, 200);
      });
      $track.append(thumb);
    }
    
    setTimeout(() => {
      const scrollWidth = $track[0].scrollWidth;
      const visibleWidth = $track.outerWidth();
      const containerWidth = $scrollContainer.width();
      if (scrollWidth > visibleWidth) {
        let barWidth = (visibleWidth / scrollWidth) * containerWidth;
        $scrollbar.css("width", Math.max(30, barWidth) + "px").show();
      } else { $scrollbar.hide(); }
    }, 600);
  }

  // ==========================================================================
  // 4. 플립북(Turn.js) 초기화 및 이벤트
  // ==========================================================================
  for (let i = 1; i <= TOTAL_PAGES; i++) { $book.append($('<div />', { class: 'page p' + i })); }
  
  const firstImg = new Image();
  firstImg.src = `spreads/page-001.${imgExt}`; 
  firstImg.onload = function() {
    imgRatio = firstImg.width / firstImg.height;
    updateBookSize();
    $book.turn({
      pages: TOTAL_PAGES,
      display: getDisplayMode(),
      duration: cfg.flip.duration,
      acceleration: true,
      gradients: true,
      elevation: 50,
      when: {
        missing: (e, pages) => pages.forEach(p => loadPageImage(p)),
        turning: (e, page, view) => {
          if (window.isZoomed && window.isZoomed()) e.preventDefault();
          view.forEach(p => loadPageImage(p));
        },
        turned: (e, page) => {
          $("#page-input, #page-slider").val(page);
          $("#page-label-spread").text(page + " / " + TOTAL_PAGES);
          updateTooltip(page);

          const $thumbs = $(".thumb-item");
          $thumbs.removeClass("active");
          const spreadStart = (page % 2 === 0) ? page - 1 : page;
          const $activeThumb = $thumbs.filter(`[data-page="${spreadStart}"]`).addClass("active");

          if (isSoundEnabled) {
            const audio = document.getElementById("audio-flip");
            if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
          }

          if ($activeThumb.length) {
            const scrollPos = $activeThumb.position().left + $track.scrollLeft() - ($track.width() / 2) + ($activeThumb.width() / 2);
            $track.stop().animate({ scrollLeft: scrollPos }, {
              duration: 300,
              step: function() {
                const maxScroll = $track[0].scrollWidth - $track[0].clientWidth;
                const currentPercent = maxScroll > 0 ? $track.scrollLeft() / maxScroll : 0;
                const maxBarLeft = $scrollContainer.width() - $scrollbar.width();
                $scrollbar.css("left", (currentPercent * maxBarLeft) + "px");
              }
            });
          }
          const currentDuration = isAnimEnabled ? (cfg.flip.duration || 800) : 180;
          $book.turn("options", { duration: currentDuration });
        }
      }
    });
    $book.data("done", true);
    $("#loading-overlay").fadeOut(400);
    loadPageImage(1);
    buildThumbnails();
  };

  // ==========================================================================
  // 5. 공통 UI 컨트롤 핸들러 (PC/모바일 공통 적용)
  // ==========================================================================
  $("#thumb-toggle").on("click", function(e) { e.preventDefault(); e.stopPropagation(); $("#thumb-panel").toggleClass("open"); });
  $("#btnPrev").on("click", () => $book.turn("previous"));
  $("#btnNext").on("click", () => $book.turn("next"));
  
  $("#btnSound").on("click", function(e) {
    e.stopPropagation();
    isSoundEnabled = !isSoundEnabled; 
    $(this).text(isSoundEnabled ? "🔊" : "🔇"); 
    if (isMobile) $("#m-btnSound").text(isSoundEnabled ? "🔊" : "🔇");
  });

  $("#btnAnim").on("click", function(e) {
    e.preventDefault(); e.stopPropagation(); 
    isAnimEnabled = !isAnimEnabled; 
    const targetDuration = isAnimEnabled ? (cfg.flip.duration || 800) : 180;
    $book.turn("options", { duration: targetDuration, gradients: isAnimEnabled }); 
    $(this).text(isAnimEnabled ? "✨" : "⚡");
  });

  $("#btnHelp").on("click", function(e) { e.preventDefault(); e.stopPropagation(); $("#help-modal").addClass("open"); });
  $("#btnCloseHelp, #help-modal").on("click", function(e) { if (e.target !== this && e.target.id !== "btnCloseHelp") return; $("#help-modal").removeClass("open"); });

  $slider.on("input", function() { $("#slider-tooltip").addClass("show"); updateTooltip($(this).val()); });
  $slider.on("change", function() { $book.turn("page", $(this).val()); setTimeout(() => $("#slider-tooltip").removeClass("show"), 1000); });

  $viewport.on("wheel", function(e) { if (window.isZoomed && window.isZoomed()) return; if (e.originalEvent.deltaY > 0) $book.turn("next"); else $book.turn("previous"); e.preventDefault(); });

  $(document).keydown(function(e) {
    if (window.isZoomed && window.isZoomed()) return;
    switch(e.keyCode) {
      case 37: $book.turn("previous"); break;
      case 39: $book.turn("next"); break;
      case 36: $book.turn("page", 1); break;
      case 35: $book.turn("page", TOTAL_PAGES); break;
    }
  });

  $("#page-input").on("keydown", function(e) { if (e.key === "Enter") { let page = parseInt($(this).val()); if (!isNaN(page) && page >= 1 && page <= TOTAL_PAGES) $book.turn("page", page); else $(this).val($book.turn("page")); } });

  // ==========================================================================
  // 6. 썸네일 스크롤바 드래그 & 방어 로직
  // ==========================================================================
  let isBarDragging = false;
  let barStartX;

  $scrollbar.on("mousedown touchstart", function(e) {
    isBarDragging = true;
    const clientX = (e.pageX || e.originalEvent.touches[0].pageX);
    barStartX = clientX - $scrollbar.position().left;
    $scrollbar.addClass("dragging");
    e.preventDefault();
  });

  $(window).on("mousemove touchmove", function(e) {
    if (!isBarDragging) return;
    const clientX = (e.pageX || e.originalEvent.touches[0].pageX);
    let moveX = clientX - barStartX;
    const maxLeft = $scrollContainer.width() - $scrollbar.width();
    moveX = Math.max(0, Math.min(maxLeft, moveX));
    $scrollbar.css("left", moveX + "px");
    const scrollPercent = moveX / maxLeft;
    const targetScroll = scrollPercent * ($track[0].scrollWidth - $track[0].clientWidth);
    $track.scrollLeft(targetScroll);
  });

  $(window).on("mouseup touchend", function() { isBarDragging = false; $scrollbar.removeClass("dragging"); });

  // 더블클릭/더블탭 방지 및 리사이즈
  const preventTargets = "#ui-footer, #ui-footer *, #thumb-toggle, #thumb-panel, #help-modal";
  $(preventTargets).on("dblclick dbltap", (e) => { e.preventDefault(); e.stopPropagation(); });
  $(window).on("resize", function() { clearTimeout(resizeTimer); resizeTimer = setTimeout(updateBookSize, 200); });
});