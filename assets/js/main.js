'use strict';

// 表示しているセクションをナビゲーションに反映します。
// JavaScriptが無効な場合も、通常のページ内リンクとして使えます。
const navigationLinks = document.querySelectorAll('.contents a[href^="#"]');

if ('IntersectionObserver' in window) {
  const visibleSections = new Set();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        visibleSections.add(entry.target.id);
      } else {
        visibleSections.delete(entry.target.id);
      }
    }

    const activeLink = Array.from(navigationLinks).find((link) =>
      visibleSections.has(link.hash.slice(1)),
    );

    for (const link of navigationLinks) {
      if (link === activeLink) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '0px 0px -40% 0px', threshold: 0 });

  for (const link of navigationLinks) {
    const section = document.getElementById(link.hash.slice(1));
    if (section) observer.observe(section);
  }
}

// 葉は少量ずつ、不規則な間隔で舞わせます。
const leafLayer = document.querySelector('.falling-leaves');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let leafTimer;
function scheduleLeaves() {
  clearTimeout(leafTimer);
  if (document.hidden || reducedMotion.matches || !leafLayer) return;
  leafTimer = setTimeout(() => {
    for (let i = 0; i < 3; i++) {
      const leaf = document.createElement('span');
      leaf.className = 'falling-leaf';
      leaf.style.setProperty('--left', `${Math.random() * 95}%`);
      leaf.style.setProperty('--duration', `${11 + Math.random() * 5}s`);
      leaf.addEventListener('animationend', () => leaf.remove(), { once: true });
      leafLayer.append(leaf);
    }
    scheduleLeaves();
  }, 7000 + Math.random() * 11000);
}
reducedMotion.addEventListener('change', () => {
  leafLayer?.replaceChildren();
  scheduleLeaves();
});
scheduleLeaves();

// Web Audioで風とセミを模した音を合成します。
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let natureAudio;
let soundEnabled = false;
let soundTimer;
let windTimer;
const activeSounds = new Set();

function playNatureSound(kind) {
  if (!soundEnabled || document.hidden || natureAudio.state !== 'running') return;
  const ctx = natureAudio;
  const duration = kind === 'wind' ? 8 : 5;
  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    // セミは細かな周期で強弱をつけた高い帯域のノイズ。
    const pulse = kind === 'cicada' ? .25 + .75 * Math.pow(Math.sin(t * Math.PI * 75), 2) : 1;
    data[i] = (Math.random() * 2 - 1) * pulse;
  }
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = kind === 'wind' ? 'lowpass' : 'bandpass';
  filter.frequency.value = kind === 'wind' ? 650 : 4200;
  filter.Q.value = kind === 'wind' ? .5 : 3;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(kind === 'wind' ? .16 : .045, now + 1.5);
  gain.gain.linearRampToValueAtTime(0, now + duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  activeSounds.add(source);
  source.onended = () => {
    activeSounds.delete(source);
    source.disconnect(); filter.disconnect(); gain.disconnect();
  };
  source.start();
  source.stop(now + duration);
}

function scheduleNatureSound() {
  clearTimeout(soundTimer);
  if (!soundEnabled || document.hidden) return;
  soundTimer = setTimeout(() => {
    playNatureSound('cicada');
    scheduleNatureSound();
  }, 10000 + Math.random() * 16000);
}

function stopNatureSounds() {
  clearTimeout(soundTimer);
  clearTimeout(windTimer);
  soundEnabled = false;
  for (const source of activeSounds) source.stop();
  activeSounds.clear();
}

// 風を少しずつ重ねて連続させ、セミの声はときどき加えます。
function scheduleWind() {
  clearTimeout(windTimer);
  if (!soundEnabled || document.hidden) return;
  playNatureSound('wind');
  windTimer = setTimeout(scheduleWind, 6000);
}

async function startNatureAudio() {
  if (!AudioContextClass || document.hidden || soundEnabled) return;
  try {
    natureAudio ??= new AudioContextClass();
    // 自動再生が制限される場合は、次のユーザー操作で再試行します。
    await natureAudio.resume();
    if (document.hidden || soundEnabled || natureAudio.state !== 'running') return;
    soundEnabled = true;
    scheduleWind();
    scheduleNatureSound();
  } catch {
    // 音声非対応の環境でもページはそのまま使えます。
  }
}

document.addEventListener('pointerdown', startNatureAudio);
document.addEventListener('keydown', startNatureAudio);
startNatureAudio();

document.addEventListener('visibilitychange', () => {
  leafLayer?.replaceChildren();
  scheduleLeaves();
  if (document.hidden) {
    stopNatureSounds();
    if (natureAudio?.state === 'running') natureAudio.suspend().catch(() => {});
  } else {
    startNatureAudio();
  }
});
