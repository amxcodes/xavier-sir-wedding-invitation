document.documentElement.classList.add('enhanced');

const body = document.body;
const opening = document.querySelector('#opening');
const cinematicIntro = document.querySelector('#cinematicIntro');
const cinematicVideo = cinematicIntro?.querySelector('.cinematic-video');
const invitation = document.querySelector('#invitation');
const countdown = document.querySelector('[data-countdown]');
const trigger = document.querySelector('#openInvite');
const backgroundMusic = document.querySelector('#backgroundMusic');
const musicToggle = document.querySelector('#musicToggle');
const stopMotionClosedFrame = document.querySelector('.envelope-stopmotion-frame--closed');
const stopMotionAnimation = document.querySelector('.envelope-stopmotion-animation');
const stopMotionFrameOrder = [0, 1, 2, 5, 3, 4, 6, 7];
const stopMotionFrameUrls = stopMotionFrameOrder.map(
  (index) => `assets/envelope-motion-${String(index).padStart(2, '0')}.webp?v=5`,
);
const stopMotionFrameStarts = [0, 180, 340, 460, 580, 700, 870, 1130];
const attendanceSection = document.querySelector('#rsvp');
const guestDecrease = document.querySelector('#guestDecrease');
const guestIncrease = document.querySelector('#guestIncrease');
const guestCount = document.querySelector('#guestCount');
const acceptInvite = document.querySelector('#acceptInvite');
const attendanceStatus = document.querySelector('#attendanceStatus');
const attendeeTotal = document.querySelector('#attendeeTotal');
const guestName = document.querySelector('#guestName');
const attendingYes = document.querySelector('#attendingYes');
const attendingNo = document.querySelector('#attendingNo');
const attendanceEvents = document.querySelector('#attendanceEvents');
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
let selectedGuests = 1;
let inviteAccepted = false;
let attendanceSaving = false;
let attending = true;
let stopMotionFrameImages = [];
const backgroundMusicVolume = .8;

function startCountdown() {
  if (!countdown) return;

  const target = new Date(countdown.dataset.target || '').getTime();
  if (!Number.isFinite(target)) return;

  const values = {
    days: countdown.querySelector('[data-countdown-days]'),
    hours: countdown.querySelector('[data-countdown-hours]'),
    minutes: countdown.querySelector('[data-countdown-minutes]'),
    seconds: countdown.querySelector('[data-countdown-seconds]'),
  };
  const format = (value) => String(value).padStart(2, '0');

  const render = () => {
    let remaining = Math.max(0, target - Date.now());
    const days = Math.floor(remaining / 86_400_000);
    remaining -= days * 86_400_000;
    const hours = Math.floor(remaining / 3_600_000);
    remaining -= hours * 3_600_000;
    const minutes = Math.floor(remaining / 60_000);
    const seconds = Math.floor((remaining - minutes * 60_000) / 1_000);

    values.days.textContent = format(days);
    values.hours.textContent = format(hours);
    values.minutes.textContent = format(minutes);
    values.seconds.textContent = format(seconds);
  };

  render();
  window.setInterval(render, 1_000);
}

startCountdown();

async function enableStopMotionWhenReady() {
  if (!opening || !stopMotionClosedFrame || !stopMotionAnimation) return false;

  try {
    if (!stopMotionClosedFrame.complete) {
      await new Promise((resolve, reject) => {
        stopMotionClosedFrame.addEventListener('load', resolve, { once: true });
        stopMotionClosedFrame.addEventListener('error', reject, { once: true });
      });
    }
    if (!stopMotionClosedFrame.naturalWidth) throw new Error('Envelope frame failed to load.');
    if (typeof stopMotionClosedFrame.decode === 'function') await stopMotionClosedFrame.decode();

    stopMotionFrameImages = await Promise.all(stopMotionFrameUrls.map((source) => new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.addEventListener('load', () => resolve(image), { once: true });
      image.addEventListener('error', reject, { once: true });
      image.src = source;
    })));
    await Promise.all(stopMotionFrameImages.map((image) => (
      typeof image.decode === 'function' ? image.decode().catch(() => {}) : Promise.resolve()
    )));
    opening.classList.add('is-stopmotion-ready');
    return true;
  } catch {
    opening.classList.add('is-stopmotion-error');
    return false;
  }
}

const stopMotionReady = enableStopMotionWhenReady();

function startStopMotionAnimation() {
  if (!stopMotionAnimation || stopMotionFrameImages.length !== stopMotionFrameUrls.length) return;
  stopMotionAnimation.src = stopMotionFrameUrls[0];
  opening.classList.add('is-stopmotion-playing');
  stopMotionFrameStarts.slice(1).forEach((start, index) => {
    window.setTimeout(() => {
      stopMotionAnimation.src = stopMotionFrameUrls[index + 1];
    }, start);
  });
}

const inviteStorageKey = 'xavier-dreama-invite-token';
const attendanceEndpoint = attendanceSection?.dataset.attendanceEndpoint || window.INVITATION_ATTENDANCE_ENDPOINT || '';
const invitationVariant = attendanceSection?.dataset.invitationVariant || window.INVITATION_VARIANT || 'full';

function getInviteToken() {
  const urlInviteToken = new URLSearchParams(window.location.search).get('invite');
  if (urlInviteToken && /^[a-zA-Z0-9-]{16,80}$/.test(urlInviteToken)) {
    window.localStorage.setItem(inviteStorageKey, urlInviteToken);
    return urlInviteToken;
  }

  let inviteToken = window.localStorage.getItem(inviteStorageKey);

  if (!inviteToken) {
    const uuid = window.crypto?.randomUUID?.();
    inviteToken = uuid || `invite-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    window.localStorage.setItem(inviteStorageKey, inviteToken);
  }

  return inviteToken;
}

function renderAttendance() {
  if (!attendanceSection || !guestCount || !guestName || !attendingYes || !attendingNo || !acceptInvite) return;

  guestCount.textContent = String(selectedGuests);
  attendanceSection.classList.toggle('is-declined', !attending);
  guestName.disabled = attendanceSaving;
  guestDecrease.disabled = !attending || selectedGuests <= 1 || attendanceSaving;
  guestIncrease.disabled = !attending || selectedGuests >= 8 || attendanceSaving;
  if (attendanceEvents) attendanceEvents.disabled = !attending || attendanceSaving;
  attendingYes.disabled = attendanceSaving;
  attendingNo.disabled = attendanceSaving;
  attendingYes.classList.toggle('is-selected', attending);
  attendingNo.classList.toggle('is-selected', !attending);
  acceptInvite.disabled = attendanceSaving || !attendanceEndpoint;
  acceptInvite.querySelector('span').textContent = attendanceSaving
    ? 'Saving your response…'
    : inviteAccepted
      ? 'Update invitation'
      : attending
        ? 'Accept invitation'
        : 'Send response';
}

function setAttendanceStatus(message = '', isError = false) {
  if (!attendanceStatus) return;
  attendanceStatus.textContent = message;
  attendanceStatus.classList.toggle('is-error', isError);
}

async function loadAttendance() {
  if (!attendanceEndpoint) {
    setAttendanceStatus('Invitation service is being prepared.');
    renderAttendance();
    return;
  }

  try {
    const response = await fetch(`${attendanceEndpoint}?token=${encodeURIComponent(getInviteToken())}&variant=${encodeURIComponent(invitationVariant)}`);
    if (!response.ok) throw new Error('Could not load invitation');

    const invite = await response.json();
    selectedGuests = Math.min(8, Math.max(1, Number(invite.guests) || 1));
    attending = invite.attending !== false;
    guestName.value = invite.name || '';
    attendanceEvents?.querySelectorAll('input').forEach((input) => { input.checked = (invite.events || []).includes(input.value); });
    inviteAccepted = Boolean(invite.accepted);
    attendeeTotal.textContent = Number(invite.totalGuests || 0).toLocaleString('en-IN');
    setAttendanceStatus(inviteAccepted ? (attending ? 'Your invitation is accepted.' : 'We have received your response.') : '');
  } catch {
    setAttendanceStatus('We could not reach the invitation service. Please try again shortly.', true);
  }

  renderAttendance();
}

async function saveAttendance() {
  if (!attendanceEndpoint || attendanceSaving) return;

  const name = guestName?.value.trim() || '';
  if (!name) {
    setAttendanceStatus('Please enter your name before sending your response.', true);
    guestName?.focus();
    return;
  }

  attendanceSaving = true;
  setAttendanceStatus('');
  renderAttendance();

  try {
    const events = attendanceEvents
      ? [...attendanceEvents.querySelectorAll('input:checked')].map((input) => input.value)
      : ['wedding'];
    const response = await fetch(attendanceEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteToken: getInviteToken(), name, attending, guests: selectedGuests, events, variant: invitationVariant })
    });
    if (!response.ok) throw new Error('Could not save invitation');

    const invite = await response.json();
    selectedGuests = Number(invite.guests) || selectedGuests;
    attending = invite.attending !== false;
    inviteAccepted = Boolean(invite.accepted);
    attendeeTotal.textContent = Number(invite.totalGuests || 0).toLocaleString('en-IN');
    setAttendanceStatus(attending ? 'Your place is reserved. We cannot wait to celebrate with you.' : 'Thank you for letting us know.');
  } catch {
    setAttendanceStatus('We could not save your response. Please try again.', true);
  } finally {
    attendanceSaving = false;
    renderAttendance();
  }
}

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
  if (!motionQuery.matches) body.classList.add('is-petal-active');
  smoothScroller?.start();
  smoothScroller?.resize();
  requestPhotoMotion();
  startBackgroundMusic();
}

function syncMusicControl() {
  if (!musicToggle || !backgroundMusic) return;
  const isPlaying = !backgroundMusic.paused;
  musicToggle.setAttribute('aria-pressed', String(isPlaying));
  musicToggle.setAttribute('aria-label', isPlaying ? 'Pause music' : 'Play music');
  const label = musicToggle.querySelector('span');
  if (label) label.textContent = isPlaying ? 'Pause' : 'Music';
}

function unlockBackgroundMusic() {
  if (!backgroundMusic) return;
  backgroundMusic.volume = 0;
  backgroundMusic.play().catch(() => {});
}

function startBackgroundMusic() {
  if (!backgroundMusic) return;
  musicToggle?.removeAttribute('hidden');
  backgroundMusic.volume = backgroundMusicVolume;
  backgroundMusic.play().then(syncMusicControl).catch(syncMusicControl);
  syncMusicControl();
}

function toggleBackgroundMusic() {
  if (!backgroundMusic) return;
  if (backgroundMusic.paused) {
    backgroundMusic.volume = backgroundMusicVolume;
    backgroundMusic.play().then(syncMusicControl).catch(syncMusicControl);
  } else {
    backgroundMusic.pause();
    syncMusicControl();
  }
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

  if (!cinematicVideo) {
    showCinematicFinalFrame({ immediate: true });
    return;
  }

  if (motionQuery.matches) {
    showCinematicFinalFrame({ immediate: true });
  } else {
    cinematicVideo?.play().catch(() => {
      showCinematicFinalFrame({ immediate: true });
    });
  }
}

async function openInvitation() {
  if (opening.classList.contains('is-pressed')) return;
  unlockBackgroundMusic();
  if (motionQuery.matches) {
    playSealRelease();
  } else {
    playEnvelopeOpening();
  }
  invitation.hidden = false;
  cinematicIntro.hidden = false;
  opening.classList.add('is-pressed');
  trigger.setAttribute('aria-expanded', 'true');
  await stopMotionReady;

  if (motionQuery.matches) {
    opening.classList.add('is-opening', 'is-flap-open', 'is-flap-settled', 'is-lifted', 'is-handoff');
    startStopMotionAnimation();
    startCinematicPlayback();
    finishOpening();
    return;
  }

  window.setTimeout(() => {
    opening.classList.add('is-opening');
    startStopMotionAnimation();
  }, 80);
  window.setTimeout(() => {
    opening.classList.add('is-seal-released');
  }, 390);
  window.setTimeout(() => {
    opening.classList.add('is-flap-open');
  }, 700);
  window.setTimeout(() => {
    opening.classList.add('is-paper-rising');
  }, 1040);
  window.setTimeout(() => opening.classList.add('is-flap-settled', 'is-lifted'), 1420);
  window.setTimeout(startCinematicPlayback, 2500);
  window.setTimeout(() => opening.classList.add('is-handoff'), 2700);
  window.setTimeout(finishOpening, 3300);
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

guestDecrease?.addEventListener('click', () => {
  selectedGuests = Math.max(1, selectedGuests - 1);
  renderAttendance();
});

guestIncrease?.addEventListener('click', () => {
  selectedGuests = Math.min(8, selectedGuests + 1);
  renderAttendance();
});

attendingYes?.addEventListener('click', () => { attending = true; renderAttendance(); });
attendingNo?.addEventListener('click', () => { attending = false; renderAttendance(); });

acceptInvite?.addEventListener('click', saveAttendance);
musicToggle?.addEventListener('click', toggleBackgroundMusic);
backgroundMusic?.addEventListener('play', syncMusicControl);
backgroundMusic?.addEventListener('pause', syncMusicControl);
loadAttendance();

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

const sectionReveals = [...document.querySelectorAll('.scroll-reveal')];
if ('IntersectionObserver' in window) {
  const sectionRevealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  sectionReveals.forEach((section) => sectionRevealObserver.observe(section));
} else {
  sectionReveals.forEach((section) => section.classList.add('is-visible'));
}

document.addEventListener('visibilitychange', () => {
  body.classList.toggle('is-petals-paused', document.hidden);
});

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
