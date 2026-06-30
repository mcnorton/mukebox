/**
 * MukeBox — PWA install flow
 *
 * 헤더 [설치] 버튼: 미설치 + prompt 있을 때만 노출, 네이티브 설치 대화창 진행.
 * 도움말 [App 설치] 버튼: 브라우저 탭이면 항상 노출, 이미 설치되어 prompt가 없으면
 *   바로가기 복구 안내 모달까지 분기 (숏컷만 지운 경우 대비).
 *
 * 공통: 저장 → "설치 중..." 오버레이 → 네이티브 대화창 →
 *   취소 시 오버레이만 제거, 수락 시 완료 안내 → [이대로 계속하기]로 정리.
 * iOS: 저장 후 "홈 화면에 추가" 안내 모달.
 */
(function () {
  const btn = document.getElementById('btn-install');
  const helpBtn = document.getElementById('btn-help-install');

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;

  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

  const flow = document.getElementById('install-flow');
  const progressPanel = document.getElementById('install-progress');
  const successPanel = document.getElementById('install-success');
  const continueBtn = document.getElementById('install-continue');

  const iosModal = document.getElementById('ios-install-modal');
  const reinstallModal = document.getElementById('install-reinstall-modal');

  let deferredPrompt = null;
  let successShown = false;

  const hideHeaderBtn = () => btn && btn.classList.add('hidden');
  const showHeaderBtn = () => btn && btn.classList.remove('hidden');

  function updateHelpInstallButton() {
    if (!helpBtn) return;
    helpBtn.classList.toggle('hidden', isStandalone());
  }

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
    hideHeaderBtn();
    deferredPrompt = null;
    successShown = false;
  }

  async function runNativePrompt() {
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
  }

  /**
   * @param {{ source: 'header' | 'help' }} options
   * header: prompt가 없고 non-iOS면 아무 동작 안 함 (기존 동작 유지).
   * help: 같은 경우 바로가기 복구 안내 모달까지 보여줌.
   */
  async function triggerInstallFlow({ source }) {
    if (!saveActiveScore()) return;

    if (deferredPrompt) {
      await runNativePrompt();
      return;
    }

    if (isIOS) {
      if (iosModal) iosModal.classList.remove('hidden');
      return;
    }

    if (source === 'help') {
      if (reinstallModal) reinstallModal.classList.remove('hidden');
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone()) showHeaderBtn();
  });

  window.addEventListener('appinstalled', () => {
    showSuccess();
  });

  // Already-installed detection (Chrome/Android, best-effort).
  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then((apps) => {
      if (apps && apps.length > 0) hideHeaderBtn();
    }).catch(() => { /* ignore */ });
  }

  // iOS Safari has no beforeinstallprompt; show the button so we can guide.
  if (isIOS && !isStandalone()) showHeaderBtn();

  // Re-hide if the app gets launched in standalone after install.
  window.addEventListener('visibilitychange', () => {
    if (isStandalone()) {
      hideHeaderBtn();
      updateHelpInstallButton();
    }
  });

  const iosClose = document.getElementById('ios-install-close');
  const iosBackdrop = iosModal ? iosModal.querySelector('.modal-backdrop') : null;
  const closeIosModal = () => { if (iosModal) iosModal.classList.add('hidden'); };
  if (iosClose) iosClose.addEventListener('click', closeIosModal);
  if (iosBackdrop) iosBackdrop.addEventListener('click', closeIosModal);

  const reinstallClose = document.getElementById('install-reinstall-close');
  const reinstallBackdrop = reinstallModal ? reinstallModal.querySelector('.modal-backdrop') : null;
  const closeReinstallModal = () => { if (reinstallModal) reinstallModal.classList.add('hidden'); };
  if (reinstallClose) reinstallClose.addEventListener('click', closeReinstallModal);
  if (reinstallBackdrop) reinstallBackdrop.addEventListener('click', closeReinstallModal);

  if (continueBtn) continueBtn.addEventListener('click', resetInstallUI);

  if (btn) {
    if (isStandalone()) hideHeaderBtn();
    btn.addEventListener('click', () => triggerInstallFlow({ source: 'header' }));
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', () => triggerInstallFlow({ source: 'help' }));
  }

  updateHelpInstallButton();

  window.WMF = window.WMF || {};
  window.WMF.Install = {
    trigger: triggerInstallFlow,
    isStandalone,
    updateHelpInstallButton,
  };
})();
