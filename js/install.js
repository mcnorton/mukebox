/**
 * MukeBox — PWA install flow
 *
 * Chrome/Android: 저장 → "설치 중..." 오버레이 → 네이티브 대화창 →
 *   취소 시 오버레이만 제거(버튼 유지), 수락 시 완료 안내 → [이대로 계속하기]로 정리.
 * iOS: 저장 후 기존 "홈 화면에 추가" 안내 모달만 표시.
 */
(function () {
  const btn = document.getElementById('btn-install');
  if (!btn) return;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;

  const hideBtn = () => btn.classList.add('hidden');
  const showBtn = () => btn.classList.remove('hidden');

  if (isStandalone()) {
    hideBtn();
    return;
  }

  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

  const flow = document.getElementById('install-flow');
  const progressPanel = document.getElementById('install-progress');
  const successPanel = document.getElementById('install-success');
  const continueBtn = document.getElementById('install-continue');

  let deferredPrompt = null;
  let successShown = false;

  function saveActiveScore() {
    return window.WMF?.saveActiveScoreNow?.() ?? true;
  }

  function showProgress() {
    successShown = false;
    if (successPanel) successPanel.classList.add('hidden');
    if (progressPanel) progressPanel.classList.remove('hidden');
    if (flow) {
      flow.classList.remove('hidden');
      flow.setAttribute('aria-hidden', 'false');
    }
  }

  function hideFlow() {
    if (flow) {
      flow.classList.add('hidden');
      flow.setAttribute('aria-hidden', 'true');
    }
    if (progressPanel) progressPanel.classList.remove('hidden');
    if (successPanel) successPanel.classList.add('hidden');
  }

  function showSuccess() {
    if (successShown) return;
    successShown = true;
    if (progressPanel) progressPanel.classList.add('hidden');
    if (successPanel) successPanel.classList.remove('hidden');
    if (flow) {
      flow.classList.remove('hidden');
      flow.setAttribute('aria-hidden', 'false');
    }
  }

  function resetInstallUI() {
    hideFlow();
    hideBtn();
    deferredPrompt = null;
    successShown = false;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showBtn();
  });

  window.addEventListener('appinstalled', () => {
    showSuccess();
  });

  // Already-installed detection (Chrome/Android, best-effort).
  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then((apps) => {
      if (apps && apps.length > 0) hideBtn();
    }).catch(() => { /* ignore */ });
  }

  // iOS Safari has no beforeinstallprompt; show the button so we can guide.
  if (isIOS) showBtn();

  // Re-hide if the app gets launched in standalone after install.
  window.addEventListener('visibilitychange', () => {
    if (isStandalone()) hideBtn();
  });

  const iosModal = document.getElementById('ios-install-modal');
  const iosClose = document.getElementById('ios-install-close');
  const iosBackdrop = iosModal ? iosModal.querySelector('.modal-backdrop') : null;
  const closeIosModal = () => { if (iosModal) iosModal.classList.add('hidden'); };
  if (iosClose) iosClose.addEventListener('click', closeIosModal);
  if (iosBackdrop) iosBackdrop.addEventListener('click', closeIosModal);

  if (continueBtn) continueBtn.addEventListener('click', resetInstallUI);

  btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      if (!saveActiveScore()) return;
      showProgress();
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          showSuccess();
        } else {
          hideFlow();
        }
      } catch {
        hideFlow();
      }
      deferredPrompt = null;
      return;
    }

    if (isIOS) {
      if (!saveActiveScore()) return;
      if (iosModal) iosModal.classList.remove('hidden');
    }
  });
})();
