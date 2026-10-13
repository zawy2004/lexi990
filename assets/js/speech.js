/* Text-to-speech through the browser's Web Speech API. Exposed as Lexi.speech. */
(function () {
  'use strict';
  const L = window.Lexi;
  const synth = window.speechSynthesis || null;
  const supported = !!(synth && window.SpeechSynthesisUtterance);

  let voices = [];
  let seq = 0; // increments on every stop() so queued playback can bail out

  function loadVoices() {
    if (!supported) return;
    voices = synth.getVoices() || [];
  }
  if (supported) {
    loadVoices();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices);
    else synth.onvoiceschanged = loadVoices;
  }

  const PREFERRED = [/natural/i, /google us english/i, /samantha/i, /aria/i, /jenny/i, /guy/i, /zira/i, /david/i, /google uk english/i];

  function englishVoices() {
    return voices.filter((v) => /^en[-_]/i.test(v.lang) || /^en$/i.test(v.lang));
  }

  function rank(v) {
    let s = 0;
    PREFERRED.forEach((re, i) => { if (re.test(v.name)) s = Math.max(s, 100 - i * 5); });
    if (/en[-_]US/i.test(v.lang)) s += 8;
    if (v.localService) s += 2;
    return s;
  }

  function englishVoice() {
    const want = L.store.settings.voice;
    const list = englishVoices();
    if (want) {
      const v = list.find((x) => x.voiceURI === want || x.name === want);
      if (v) return v;
    }
    return list.slice().sort((a, b) => rank(b) - rank(a))[0] || null;
  }

  /** Two different English voices for dialogues (man / woman) when available. */
  function dialogueVoices() {
    const list = englishVoices().slice().sort((a, b) => rank(b) - rank(a));
    const male = list.find((v) => /male|guy|david|mark|george|daniel|james|ryan|christopher|eric|fred/i.test(v.name) && !/female/i.test(v.name));
    const female = list.find((v) => /female|aria|jenny|zira|samantha|susan|hazel|libby|sonia|emma|michelle|karen|victoria/i.test(v.name));
    const base = englishVoice();
    return {
      M: { voice: male || base, pitch: male ? 1 : 0.8 },
      F: { voice: female || base, pitch: female ? 1 : 1.18 },
      N: { voice: base, pitch: 1 },
    };
  }

  function vietnameseVoice() {
    return voices.find((v) => /^vi/i.test(v.lang)) || null;
  }

  function utter(text, opts) {
    return new Promise((resolve) => {
      if (!supported || !text) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      const voice = opts.voice === undefined ? englishVoice() : opts.voice;
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = opts.lang || 'en-US';
      u.rate = opts.rate || L.store.settings.rate || 1;
      u.pitch = opts.pitch || 1;
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onend = finish;
      u.onerror = finish;
      // Some engines never fire onend; give up after a generous timeout.
      setTimeout(finish, 1500 + text.length * 140);
      synth.speak(u);
    });
  }

  function stop() {
    seq++;
    if (supported) synth.cancel();
  }

  function speak(text, opts) {
    stop();
    return utter(text, opts || {});
  }

  /** Split long text into sentences — Chrome cuts off very long utterances. */
  function sentences(text) {
    return String(text).match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [text];
  }

  /**
   * Play a list of parts in order: [{ text, voice, pitch, lang, pause }].
   * Resolves true when finished, false when interrupted by stop().
   */
  async function play(parts) {
    stop();
    const my = seq;
    for (const p of parts) {
      if (my !== seq) return false;
      if (p.pause) { await new Promise((r) => setTimeout(r, p.pause)); continue; }
      for (const s of sentences(p.text)) {
        if (my !== seq) return false;
        await utter(s.trim(), p);
      }
    }
    return my === seq;
  }

  function speakVi(text) {
    const v = vietnameseVoice();
    if (!v) return Promise.resolve(false);
    return utter(text, { voice: v, rate: 1 }).then(() => true);
  }

  L.speech = {
    supported, speak, play, stop, speakVi, englishVoices, englishVoice, dialogueVoices, vietnameseVoice,
    get voices() { return voices; },
  };
})();
