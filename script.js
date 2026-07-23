document.documentElement.classList.add('enhanced');

const body = document.body;
const opening = document.querySelector('#opening');
const cinematicIntro = document.querySelector('#cinematicIntro');
const cinematicVideo = cinematicIntro?.querySelector('.cinematic-video');
const invitation = document.querySelector('#invitation');
const trigger = document.querySelector('#openInvite');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let smoothScroller = null;
const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
let envelopeAudio = null;
let paperRub = null;
let suppressOpenClick = false;
let cinematicPlaybackStarted = false;
let cinematicFinalRequested = false;
let cinematicFinalLocked = false;
let cinematicFinalLockTimer = 0;

function getEnvelopeAudio() {
  if (!AudioContextConstructor) return null;

  if (!envelopeAudio) {
    const context = new AudioContextConstructor();
    const noise = context.createBuffer(1, Math.ceil(context.sampleRate * .9), context.sampleRate);
    const samples = noise.getChannelData(0);

    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }

    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    master.gain.value = .48;
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = .004;
    compressor.release.value = .14;
    master.connect(compressor);
    compressor.connect(context.destination);
    envelopeAudio = { context, noise, master };
  }

  if (envelopeAudio.context.state === 'suspended') {
    envelopeAudio.context.resume().catch(() => {});
  }

  return envelopeAudio;
}

function playPaperNoise({
  delay = 0,
  duration = .3,
  volume = .06,
  frequencyFrom = 1800,
  frequencyTo = 700,
  playbackRate = 1
}) {
  const audio = getEnvelopeAudio();
  if (!audio) return;

  const { context, noise, master } = audio;
  const start = context.currentTime + delay;
  const end = start + duration;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = noise;
  source.loop = true;
  source.playbackRate.value = playbackRate;
  filter.type = 'bandpass';
  filter.Q.value = .72;
  filter.frequency.setValueAtTime(frequencyFrom, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, frequencyTo), end);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(.045, duration * .18));
  gain.gain.exponentialRampToValueAtTime(.0001, end);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(start, Math.random() * .45);
  source.stop(end + .03);
}

function playSealRelease() {
  const audio = getEnvelopeAudio();
  if (!audio) return;

  const { context, master } = audio;
  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(170, start);
  oscillator.frequency.exponentialRampToValueAtTime(82, start + .075);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(.055, start + .008);
  gain.gain.exponentialRampToValueAtTime(.0001, start + .08);
  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(start);
  oscillator.stop(start + .085);

  playPaperNoise({
    duration: .11,
    volume: .075,
    frequencyFrom: 1150,
    frequencyTo: 420,
    playbackRate: .72
  });
}

function playEnvelopeOpening() {
  playSealRelease();
  playPaperNoise({
    delay: .18,
    duration: .56,
    volume: .085,
    frequencyFrom: 2500,
    frequencyTo: 680,
    playbackRate: .88
  });
  playPaperNoise({
    delay: .82,
    duration: .7,
    volume: .07,
    frequencyFrom: 1450,
    frequencyTo: 390,
    playbackRate: .64
  });
}

function beginPaperRub(event) {
  if (!event.isPrimary || event.button > 0 || opening.classList.contains('is-pressed')) return;
  const audio = getEnvelopeAudio();
  if (!audio) return;

  const { context, noise, master } = audio;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = noise;
  source.loop = true;
  source.playbackRate.value = .72;
  filter.type = 'bandpass';
  filter.Q.value = .8;
  filter.frequency.value = 720;
  gain.gain.value = .0001;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start();

  paperRub = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    time: event.timeStamp,
    distance: 0,
    source,
    filter,
    gain
  };
  trigger.setPointerCapture?.(event.pointerId);
}

function updatePaperRub(event) {
  if (!paperRub || event.pointerId !== paperRub.pointerId) return;

  const deltaX = event.clientX - paperRub.x;
  const deltaY = event.clientY - paperRub.y;
  const distance = Math.hypot(deltaX, deltaY);
  const elapsed = Math.max(8, event.timeStamp - paperRub.time);
  const speed = Math.min(distance / elapsed, 1.6);
  const pressure = event.pressure > 0 ? event.pressure : .45;
  const { context } = envelopeAudio;
  const now = context.currentTime;
  const level = distance > .25 ? Math.min(.085, .008 + speed * .052 * (.75 + pressure)) : .0001;

  paperRub.distance += distance;
  paperRub.gain.gain.setTargetAtTime(level, now, .018);
  paperRub.filter.frequency.setTargetAtTime(620 + speed * 2100, now, .025);
  paperRub.source.playbackRate.setTargetAtTime(.68 + speed * .42, now, .03);
  paperRub.x = event.clientX;
  paperRub.y = event.clientY;
  paperRub.time = event.timeStamp;
}

function endPaperRub(event) {
  if (!paperRub || event.pointerId !== paperRub.pointerId) return;

  const { context } = envelopeAudio;
  const now = context.currentTime;
  const finalDistance = paperRub.distance;
  paperRub.gain.gain.cancelScheduledValues(now);
  paperRub.gain.gain.setValueAtTime(Math.max(.0001, paperRub.gain.gain.value), now);
  paperRub.gain.gain.exponentialRampToValueAtTime(.0001, now + .1);
  paperRub.source.stop(now + .12);
  paperRub = null;
  suppressOpenClick = finalDistance > 18;
}

function finishOpening() {
  opening.classList.add('is-complete');
  body.classList.remove('is-locked');
  smoothScroller?.start();
  smoothScroller?.resize();
  requestPhotoMotion();
}

function commitCinematicFinalFrame() {
  if (!cinematicIntro || cinematicFinalLocked) return;

  cinematicFinalLocked = true;
  window.clearTimeout(cinematicFinalLockTimer);
  cinematicVideo?.pause();
  cinematicIntro.classList.add('is-ended', 'is-final-locked');
}

function showCinematicFinalFrame({ immediate = false } = {}) {
  if (!cinematicIntro) return;

  if (cinematicFinalRequested) {
    if (immediate) commitCinematicFinalFrame();
    return;
  }

  cinematicFinalRequested = true;
  cinematicVideo?.pause();
  cinematicIntro.classList.add('is-ended');

  if (immediate || motionQuery.matches || !cinematicVideo) {
    commitCinematicFinalFrame();
    return;
  }

  const finishCrossfade = (event) => {
    if (event.propertyName === 'opacity') commitCinematicFinalFrame();
  };

  cinematicVideo.addEventListener('transitionend', finishCrossfade, { once: true });
  cinematicFinalLockTimer = window.setTimeout(commitCinematicFinalFrame, 860);
}

function startCinematicPlayback() {
  if (cinematicPlaybackStarted) return;
  cinematicPlaybackStarted = true;

  if (motionQuery.matches) {
    showCinematicFinalFrame({ immediate: true });
  } else {
    cinematicVideo?.play().catch(() => {
      showCinematicFinalFrame({ immediate: true });
    });
  }
}

function openInvitation() {
  if (opening.classList.contains('is-pressed')) return;
  if (motionQuery.matches) {
    playSealRelease();
  } else {
    playEnvelopeOpening();
  }
  invitation.hidden = false;
  cinematicIntro.hidden = false;
  if (cinematicVideo) {
    const portraitMobile = window.matchMedia('(max-width: 900px) and (orientation: portrait)').matches;
    const compactLandscape = window.matchMedia('(max-width: 700px)').matches;
    cinematicVideo.poster = portraitMobile
      ? 'assets/palace-wedding-first-mobile-v2.webp'
      : compactLandscape
        ? 'assets/palace-wedding-first-desktop.webp'
        : 'assets/palace-wedding-first-desktop-v2.webp';
    cinematicVideo.preload = 'auto';
    cinematicVideo.load();
  }
  opening.classList.add('is-pressed');
  trigger.setAttribute('aria-expanded', 'true');

  if (motionQuery.matches) {
    opening.classList.add('is-opening', 'is-flap-open', 'is-flap-settled', 'is-lifted', 'is-handoff');
    startCinematicPlayback();
    finishOpening();
    return;
  }

  window.setTimeout(() => opening.classList.add('is-opening'), 80);
  window.setTimeout(() => opening.classList.add('is-flap-open'), 220);
  window.setTimeout(() => opening.classList.add('is-flap-settled'), 940);
  window.setTimeout(() => opening.classList.add('is-lifted'), 960);
  window.setTimeout(startCinematicPlayback, 2150);
  window.setTimeout(() => opening.classList.add('is-handoff'), 2300);
  window.setTimeout(finishOpening, 2920);
}

trigger.addEventListener('pointerdown', beginPaperRub);
trigger.addEventListener('pointermove', updatePaperRub);
trigger.addEventListener('pointerup', endPaperRub);
trigger.addEventListener('pointercancel', endPaperRub);
trigger.addEventListener('lostpointercapture', endPaperRub);
trigger.addEventListener('click', (event) => {
  if (suppressOpenClick && event.detail > 0) {
    suppressOpenClick = false;
    event.preventDefault();
    return;
  }

  suppressOpenClick = false;
  openInvitation();
});

cinematicVideo?.addEventListener('ended', showCinematicFinalFrame);

cinematicVideo?.addEventListener('error', () => {
  showCinematicFinalFrame({ immediate: true });
});

cinematicVideo?.addEventListener('timeupdate', () => {
  if (!Number.isFinite(cinematicVideo.duration) || cinematicVideo.duration <= 0) return;
  if (cinematicVideo.duration - cinematicVideo.currentTime <= .16) {
    showCinematicFinalFrame();
  }
});

if ('IntersectionObserver' in window && cinematicIntro) {
  const cinematicStateObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting || !cinematicPlaybackStarted) return;
    showCinematicFinalFrame({ immediate: true });
  }, { threshold: 0 });

  cinematicStateObserver.observe(cinematicIntro);
}

if ('IntersectionObserver' in window) {
  const invitationRevealObserver = new IntersectionObserver((entries, observer) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    invitation.classList.add('is-revealed');
    observer.disconnect();
  }, { threshold: .28 });

  invitationRevealObserver.observe(invitation);
} else {
  invitation.classList.add('is-revealed');
}

const memoryFrames = [...document.querySelectorAll('.memory-frame')];
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let photoFramePending = false;

function syncSmoothScroller() {
  const shouldSmooth = Boolean(window.Lenis) && finePointer.matches && !motionQuery.matches;

  if (shouldSmooth && !smoothScroller) {
    smoothScroller = new window.Lenis({
      autoRaf: true,
      lerp: 0.085,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.84
    });
    smoothScroller.on('scroll', requestPhotoMotion);
    if (body.classList.contains('is-locked')) smoothScroller.stop();
  } else if (!shouldSmooth && smoothScroller) {
    smoothScroller.destroy();
    smoothScroller = null;
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function updatePhotoMotion() {
  photoFramePending = false;
  const viewportHeight = window.innerHeight;

  memoryFrames.forEach((frame, index) => {
    const rect = frame.getBoundingClientRect();
    if (motionQuery.matches) {
      frame.style.setProperty('--tear-y', '-112%');
      frame.style.setProperty('--tear-x', '0%');
      frame.style.setProperty('--tear-angle', '0deg');
      frame.style.setProperty('--photo-scale', '1');
      frame.style.removeProperty('--photo-shift');
      return;
    }

    const revealStart = viewportHeight * 1.06;
    const revealEnd = viewportHeight * 0.08;
    const rawProgress = clamp(
      (revealStart - rect.top) / (revealStart - revealEnd),
      0,
      1
    );
    const revealProgress = smoothstep(rawProgress);
    const tearY = -112 * revealProgress;
    const paperArc = Math.sin(revealProgress * Math.PI);
    const paperDirection = index % 2 === 0 ? -1 : 1;
    const tearX = paperDirection * paperArc * 1.15;
    const tearAngle = paperDirection * paperArc * 0.7;
    const photoScale = 1.035 - revealProgress * 0.025;

    frame.style.setProperty('--tear-y', `${tearY.toFixed(3)}%`);
    frame.style.setProperty('--tear-x', `${tearX.toFixed(3)}%`);
    frame.style.setProperty('--tear-angle', `${tearAngle.toFixed(3)}deg`);
    frame.style.setProperty('--photo-scale', photoScale.toFixed(4));

    if (finePointer.matches && rect.bottom > 0 && rect.top < viewportHeight) {
      const shift = (revealProgress - 0.5) * 8;
      frame.style.setProperty('--photo-shift', `${shift.toFixed(2)}px`);
    } else {
      frame.style.removeProperty('--photo-shift');
    }
  });
}

function requestPhotoMotion() {
  if (photoFramePending) return;
  photoFramePending = true;
  window.requestAnimationFrame(updatePhotoMotion);
}

window.addEventListener('scroll', requestPhotoMotion, { passive: true });
window.addEventListener('resize', requestPhotoMotion, { passive: true });
finePointer.addEventListener?.('change', () => {
  syncSmoothScroller();
  requestPhotoMotion();
});
motionQuery.addEventListener?.('change', () => {
  syncSmoothScroller();
  requestPhotoMotion();
});
syncSmoothScroller();
requestPhotoMotion();

const photoViewer = document.querySelector('#photoViewer');
const photoViewerImage = photoViewer?.querySelector('img');
const photoViewerClose = photoViewer?.querySelector('.photo-viewer-close');

document.querySelectorAll('.memory-open').forEach((button) => {
  button.addEventListener('click', () => {
    if (!photoViewer || !photoViewerImage) return;
    const preview = button.querySelector('img');
    photoViewerImage.src = button.dataset.photo;
    photoViewerImage.alt = preview?.alt || '';
    smoothScroller?.stop();
    photoViewer.showModal();
  });
});

photoViewerClose?.addEventListener('click', () => photoViewer.close());
photoViewer?.addEventListener('click', (event) => {
  if (event.target === photoViewer) photoViewer.close();
});
photoViewer?.addEventListener('close', () => {
  if (!photoViewerImage) return;
  photoViewerImage.removeAttribute('src');
  photoViewerImage.alt = '';
  smoothScroller?.start();
});
