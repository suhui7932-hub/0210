$(function () {
  const cfg = window.FLIPBOOK_CONFIG.zoom;
  const $book = $("#book");
  const $viewport = $("#book-viewport");
  
  let zoomLevel = 1, offsetX = 0, offsetY = 0;
  let isDragging = false, startX = 0, startY = 0;
  let initialPinchDist = null;
  let initialZoom = 1;

  window.isZoomed = () => zoomLevel > 1;

  function applyTransform() {
    const isZoomed = zoomLevel > 1;
    // 확대 중에는 turn.js의 페이지 넘김 기능을 끔
    $book.turn("disable", isZoomed);
    
    // 확대 상태에서만 터치 액션을 비활성화하여 기본 브라우저 줌과 충돌 방지
    $viewport.css("touch-action", isZoomed ? "none" : "pan-y");

    if (isZoomed) {
      const bookW = $book.width() * zoomLevel;
      const bookH = $book.height() * zoomLevel;
      const viewW = $viewport.width();
      const viewH = $viewport.height();

      // 경계선 계산 (여백 방지)
      const limitX = Math.max(0, (bookW - viewW) / 2);
      const limitY = Math.max(0, (bookH - viewH) / 2);

      offsetX = Math.max(-limitX, Math.min(limitX, offsetX));
      offsetY = Math.max(-limitY, Math.min(limitY, offsetY));
    } else {
      offsetX = 0; offsetY = 0;
    }
    
    $book.css({
      "transform": `translate(${offsetX}px, ${offsetY}px) scale(${zoomLevel})`,
      "transition": (isDragging || initialPinchDist) ? "none" : "transform 0.3s ease-out",
      "cursor": isZoomed ? (isDragging ? "grabbing" : "grab") : "default"
    });
  }

  // [터치/마우스 시작]
  $viewport.on("touchstart mousedown", (e) => {
    const touches = e.originalEvent.touches;
    const ev = touches ? touches[0] : e;

    // 핀치 줌 초기화 (손가락 2개)
    if (touches && touches.length === 2) {
      isDragging = false; 
      initialPinchDist = Math.hypot(
        touches[0].pageX - touches[1].pageX,
        touches[0].pageY - touches[1].pageY
      );
      initialZoom = zoomLevel; 
      return;
    }

    // 드래그 초기화 (확대된 상태에서 손가락 1개)
    if (zoomLevel > 1) {
      isDragging = true;
      startX = ev.pageX - offsetX; 
      startY = ev.pageY - offsetY;
    }
  });

  // [터치/마우스 이동]
  $(window).on("touchmove mousemove", (e) => {
    if (zoomLevel <= 1 && !initialPinchDist) return;
    
    const touches = e.originalEvent.touches;
    const ev = touches ? touches[0] : e;

    // 1. 핀치 줌 실행
    if (touches && touches.length === 2 && initialPinchDist) {
      const currentDist = Math.hypot(
        touches[0].pageX - touches[1].pageX,
        touches[0].pageY - touches[1].pageY
      );
      const zoomFactor = currentDist / initialPinchDist;
      zoomLevel = Math.min(Math.max(1, initialZoom * zoomFactor), cfg.max);
      applyTransform();
      if (e.cancelable) e.preventDefault();
      return;
    }

    // 2. 화면 이동 (드래그)
    if (zoomLevel > 1 && isDragging && (!touches || touches.length === 1)) {
      offsetX = ev.pageX - startX; 
      offsetY = ev.pageY - startY;
      applyTransform();
      if (e.cancelable) e.preventDefault();
    }
  });

  // [터치/마우스 종료]
  $(window).on("touchend mouseup", () => {
    isDragging = false;
    initialPinchDist = null;
    // 더블 탭 관련 로직이 완전히 제거되었습니다.
  });

  // 하단 툴바의 돋보기 버튼 컨트롤은 유지합니다.
  $("#btnZoomOut").on("click", () => { zoomLevel = 1; applyTransform(); });
  $("#btnZoomIn").on("click", () => { zoomLevel = Math.min(zoomLevel + 0.5, cfg.max); applyTransform(); });
});