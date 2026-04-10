/* ==========================================================================
   assets/js/music.js
   Handles track card clicks, modal open/close, audio playback, and UI sync.
   Depends on: window.TRACKS (injected via Liquid in music.html)
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Element refs
     ------------------------------------------------------------------ */
  const modal        = document.getElementById("music-modal");
  const backdrop     = document.getElementById("modal-backdrop");
  const btnClose     = document.getElementById("btn-close");
  const btnPlay      = document.getElementById("btn-play");
  const btnPrev      = document.getElementById("btn-prev");
  const btnNext      = document.getElementById("btn-next");
  const iconPlay     = document.getElementById("icon-play");
  const iconPause    = document.getElementById("icon-pause");
  const progressBar  = document.getElementById("progress-bar");
  const timeCurrent  = document.getElementById("time-current");
  const timeTotal    = document.getElementById("time-total");
  const playerCover  = document.getElementById("player-cover");
  const playerTitle  = document.getElementById("player-title");
  const playerMeta   = document.getElementById("player-meta");
  const playerDesc   = document.getElementById("player-description");
  const lyricsCol    = document.getElementById("lyrics-col");
  const lyricsBody   = document.getElementById("lyrics-body");

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  const audio = new Audio();
  let currentIndex = null;
  let isPlaying = false;
  let isSeeking = false;

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function setPlayIcon(playing) {
    iconPlay.style.display  = playing ? "none" : "";
    iconPause.style.display = playing ? "" : "none";
    btnPlay.setAttribute("aria-label", playing ? "Pause" : "Play");
  }

  function setDiscSpin(playing) {
    playerCover.classList.toggle("is-playing", playing);
    playerCover.classList.toggle("is-paused", !playing);
  }

  function updateProgressFill(pct) {
    progressBar.style.setProperty("--progress", `${pct}%`);
  }

  /* ------------------------------------------------------------------
     Open modal with a specific track
     ------------------------------------------------------------------ */

  function openModal(index) {
    const track = TRACKS[index];
    if (!track) return;

    currentIndex = index;

    /* Populate fields */
    playerCover.src = track.cover || "";
    playerCover.alt = `${track.title} cover art`;
    playerTitle.textContent = track.title || "";
    playerMeta.textContent  = [track.year, track.duration].filter(Boolean).join(" · ");
    playerDesc.textContent  = track.description || "";

    /* Lyrics */
    if (track.lyrics) {
      lyricsBody.textContent = track.lyrics; /* white-space: pre-line handles stanzas */
      lyricsCol.classList.remove("is-hidden");
      lyricsBody.scrollTop = 0;
    } else {
      lyricsBody.textContent = "";
      lyricsCol.classList.add("is-hidden");
    }

    /* Reset progress */
    progressBar.value = 0;
    updateProgressFill(0);
    timeCurrent.textContent = "0:00";
    timeTotal.textContent   = "0:00";

    /* Load and play audio */
    audio.src = track.audio || "";
    audio.load();
    playAudio();

    /* Show modal */
    modal.removeAttribute("hidden");
    document.body.style.overflow = "hidden";

    /* Focus the close button for accessibility */
    requestAnimationFrame(() => btnClose.focus());
  }

  /* ------------------------------------------------------------------
     Audio playback
     ------------------------------------------------------------------ */

  function playAudio() {
    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch(() => {
        /* Autoplay blocked — show play state as paused */
        setPlayState(false);
      });
    }
    setPlayState(true);
  }

  function pauseAudio() {
    audio.pause();
    setPlayState(false);
  }

  function setPlayState(playing) {
    isPlaying = playing;
    setPlayIcon(playing);
    setDiscSpin(playing);
  }

  /* ------------------------------------------------------------------
     Close modal
     ------------------------------------------------------------------ */

  function closeModal() {
    pauseAudio();
    /* Remove spin classes so the cover image resets cleanly */
    playerCover.classList.remove("is-playing", "is-paused");
    modal.setAttribute("hidden", "");
    document.body.style.overflow = "";
    currentIndex = null;
  }

  /* ------------------------------------------------------------------
     Track navigation
     ------------------------------------------------------------------ */

  function prevTrack() {
    if (currentIndex === null) return;
    const index = (currentIndex - 1 + TRACKS.length) % TRACKS.length;
    openModal(index);
  }

  function nextTrack() {
    if (currentIndex === null) return;
    const index = (currentIndex + 1) % TRACKS.length;
    openModal(index);
  }

  /* ------------------------------------------------------------------
     Audio event listeners
     ------------------------------------------------------------------ */

  audio.addEventListener("loadedmetadata", () => {
    timeTotal.textContent = formatTime(audio.duration);
    progressBar.max = audio.duration || 100;
  });

  audio.addEventListener("timeupdate", () => {
    if (isSeeking) return;
    const current = audio.currentTime;
    const duration = audio.duration || 0;
    timeCurrent.textContent = formatTime(current);
    progressBar.value = current;
    if (duration > 0) {
      updateProgressFill((current / duration) * 100);
    }
  });

  audio.addEventListener("ended", () => {
    nextTrack();
  });

  audio.addEventListener("pause", () => {
    /* Sync UI if paused externally (e.g., another tab takes audio focus) */
    setPlayState(false);
  });

  audio.addEventListener("play", () => {
    setPlayState(true);
  });

  /* ------------------------------------------------------------------
     Progress bar interaction
     ------------------------------------------------------------------ */

  progressBar.addEventListener("mousedown", () => { isSeeking = true; });
  progressBar.addEventListener("touchstart", () => { isSeeking = true; }, { passive: true });

  progressBar.addEventListener("input", () => {
    const val = parseFloat(progressBar.value);
    timeCurrent.textContent = formatTime(val);
    const duration = audio.duration || 0;
    if (duration > 0) updateProgressFill((val / duration) * 100);
  });

  progressBar.addEventListener("change", () => {
    audio.currentTime = parseFloat(progressBar.value);
    isSeeking = false;
  });

  progressBar.addEventListener("mouseup", () => { isSeeking = false; });
  progressBar.addEventListener("touchend", () => { isSeeking = false; });

  /* ------------------------------------------------------------------
     Button listeners
     ------------------------------------------------------------------ */

  btnPlay.addEventListener("click", () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  });

  btnPrev.addEventListener("click", prevTrack);
  btnNext.addEventListener("click", nextTrack);

  btnClose.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);

  /* ------------------------------------------------------------------
     Keyboard: Escape to close, trap Tab inside modal
     ------------------------------------------------------------------ */

  document.addEventListener("keydown", (e) => {
    if (modal.hasAttribute("hidden")) return;

    if (e.key === "Escape") {
      closeModal();
      return;
    }

    if (e.key === "Tab") {
      /* Collect all focusable elements inside the modal */
      const focusable = Array.from(
        modal.querySelectorAll(
          'button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* ------------------------------------------------------------------
     Track card click listeners
     ------------------------------------------------------------------ */

  document.querySelectorAll(".track-card").forEach((card) => {
    card.addEventListener("click", () => {
      const index = parseInt(card.dataset.trackIndex, 10);
      openModal(index);
    });
  });

})();
