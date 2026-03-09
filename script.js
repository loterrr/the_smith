document.addEventListener('DOMContentLoaded', () => {

    // ══════════════════════════════════
    // SETUP
    // ══════════════════════════════════
    const leaves = [...document.querySelectorAll('.leaf')];
    const counter = document.getElementById('page-counter');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const restartBtn = document.getElementById('restart-btn');
    const musicBtn = document.getElementById('music-btn');
    const total = leaves.length;
    let current = 0;
    let isAnimating = false;

    // Stack all leaves: leaf[0] on top, leaf[N] on bottom
    function initStack() {
        leaves.forEach((l, i) => {
            l.style.transition = 'none';
            l.style.transform = 'rotateY(0deg)';
            l.style.zIndex = total - i;
            l.style.opacity = '1';
            l.style.display = 'block';
            // Only the top-most un-flipped page gets pointer events for dragging
            l.style.pointerEvents = i === 0 ? 'auto' : 'none';
            if (l._physicsCtrl) { l._physicsCtrl.abort(); l._physicsCtrl = null; }
        });
        updateUI();
        leaves.forEach(attachPhysics);
    }

    function updateUI() {
        if (counter) counter.textContent = `${current + 1} / ${total}`;
        if (prevBtn) prevBtn.style.display = current === 0 ? 'none' : 'flex';
        if (nextBtn) nextBtn.style.display = current === total - 1 ? 'none' : 'flex';
    }


    // ══════════════════════════════════
    // BOOK PAGE FLIP PHYSICS
    // ══════════════════════════════════
    function attachPhysics(leaf) {
        if (!leaf) return;
        if (leaf._physicsCtrl) leaf._physicsCtrl.abort();
        const ctrl = new AbortController();
        leaf._physicsCtrl = ctrl;
        const sig = { signal: ctrl.signal };

        leaf.addEventListener('mousedown', onDragStart, sig);
        leaf.addEventListener('touchstart', onDragStart, { ...sig, passive: false });

        function onDragStart(e) {
            // Forward drag (if on right)
            if (leaf === leaves[current]) {
                startDrag(e, leaf, false);
            }
            // Backward drag (if on left)
            else if (current > 0 && leaf === leaves[current - 1]) {
                startDrag(e, leaf, true);
            }
        }

        function startDrag(e, target, isFlippingBack) {
            if (isAnimating) return;
            if (e.target.closest('.pull-tab, .pull-tab-v, .vinyl-ring, .restart-btn, .nav-btn, .music-btn')) return;

            const rect = target.getBoundingClientRect();
            const startX = getClientX(e);

            // If flipping forward, drag from right side. If backward, drag from left side.
            if (!isFlippingBack && startX - rect.left < rect.width * 0.15) return;
            if (isFlippingBack && startX - rect.left > rect.width * 0.85) return;

            e.preventDefault();
            target.style.transition = 'none';
            if (isFlippingBack) {
                target.style.zIndex = total + 1; // bring to front plane
            }

            let dragAngle = isFlippingBack ? -180 : 0;
            let moved = false;

            function onMove(ev) {
                const mx = getClientX(ev);
                const dx = startX - mx;
                if (Math.abs(dx) < 4 && !moved) return;
                moved = true;
                ev.preventDefault();

                if (isFlippingBack) {
                    // Start at -180, move towards 0
                    dragAngle = -180 + Math.min(180, Math.max(0, (-dx / rect.width) * 180));
                } else {
                    // Start at 0, move towards -180
                    dragAngle = -Math.min(180, Math.max(0, (dx / rect.width) * 180));
                }
                target.style.transform = `rotateY(${dragAngle}deg)`;
            }

            function onUp() {
                cancelDrag();
                if (!moved) {
                    isFlippingBack ? flipBackward() : flipForward();
                    return;
                }

                if (isFlippingBack) {
                    dragAngle > -90 ? flipBackward() : snapToLeft(target);
                } else {
                    dragAngle < -90 ? flipForward() : snapToRight(target);
                }
            }

            function cancelDrag() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchend', onUp);
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchend', onUp);
        }
    }

    function snapToRight(leaf) {
        leaf.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
        leaf.style.transform = 'rotateY(0deg)';
    }

    function snapToLeft(leaf) {
        leaf.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
        leaf.style.transform = 'rotateY(-180deg)';
    }

    function flipForward() {
        if (current >= total - 1 || isAnimating) return;
        isAnimating = true;

        const out = leaves[current];
        const into = leaves[current + 1];

        out.style.transition = 'transform 0.5s cubic-bezier(0.645, 0.045, 0.355, 1)';
        out.style.transform = 'rotateY(-180deg)';
        out.style.pointerEvents = 'none';

        setTimeout(() => {
            // Keep it visible on the left, but lower its z-index so newer flipped pages go on top
            out.style.zIndex = current;
            out.style.pointerEvents = 'auto'; // allow dragging back

            if (into) {
                into.style.zIndex = total;
                into.style.pointerEvents = 'auto';
            }
            current++;
            updateUI();
            handleResize(); // Center for 2-page spread
            isAnimating = false;
        }, 500);
    }

    function flipBackward() {
        if (current <= 0 || isAnimating) return;
        isAnimating = true;

        const cur = leaves[current];
        const prev = leaves[current - 1];

        prev.style.zIndex = total + 1;
        void prev.offsetWidth;

        prev.style.transition = 'transform 0.5s cubic-bezier(0.645, 0.045, 0.355, 1)';
        prev.style.transform = 'rotateY(0deg)';

        setTimeout(() => {
            // Restore right-side stacking
            prev.style.zIndex = total - (current - 1);
            prev.style.pointerEvents = 'auto';

            cur.style.zIndex = total - current;
            cur.style.pointerEvents = 'none';

            current--;
            updateUI();
            handleResize(); // Center for 1-page cover
            isAnimating = false;
        }, 500);
    }

    if (nextBtn) nextBtn.addEventListener('click', flipForward);
    if (prevBtn) prevBtn.addEventListener('click', flipBackward);
    if (restartBtn) restartBtn.addEventListener('click', () => {
        isAnimating = false;
        current = 0;
        initStack();
        handleResize();
    });
    // ══════════════════════════════════
    // RESPONSIVE SCALING
    // ══════════════════════════════════
    const scaler = document.getElementById('book-scaler');
    const bookWidth = 310;
    const bookHeight = 440;

    function handleResize() {
        if (!scaler) return;
        // Scale based on "2-page spread" width if current > 0, otherwise single page
        const requiredWidth = (current > 0) ? bookWidth * 2.2 : bookWidth * 1.2;
        const requiredHeight = bookHeight * 1.2;

        const scaleX = window.innerWidth / requiredWidth;
        const scaleY = window.innerHeight / requiredHeight;
        const scale = Math.min(scaleX, scaleY, 1.0); // Don't scale up past 100%

        scaler.style.transform = `scale(${scale})`;
    }

    window.addEventListener('resize', handleResize);
    // Initial call after some setup
    setTimeout(handleResize, 100);

    initStack();


    // ══════════════════════════════════
    // AMBIENT MUSIC & VINYL SCRATCHING
    // ══════════════════════════════════
    const vinyl = document.getElementById('vinyl-record');

    let audioCtx = null;
    let musicOn = false;
    let audioBuffer = null;
    let revAudioBuffer = null;
    let currentSource = null;

    // Playback state
    let playheadTime = 0;       // Current time in standard forward audio
    let lastTimeUpdate = 0;     // max time since last frame
    let isDragging = false;
    let isSpinning = false;

    // Vinyl state
    let vAngle = 0;
    let vSpinId = null;
    let lastDragTime = 0;
    const AUTO_SPIN_SPEED = 1.4; // degrees per frame (~50deg / sec)

    async function loadAudio() {
        try {
            const response = await fetch('music.mp3');
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            // Create a reversed buffer for scratching backwards
            revAudioBuffer = audioCtx.createBuffer(
                audioBuffer.numberOfChannels,
                audioBuffer.length,
                audioBuffer.sampleRate
            );

            for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
                const fwdData = audioBuffer.getChannelData(i);
                const revData = revAudioBuffer.getChannelData(i);
                for (let j = 0; j < audioBuffer.length; j++) {
                    revData[j] = fwdData[audioBuffer.length - 1 - j];
                }
            }
            console.log("Audio loaded and reversed successfully.");

            if (musicOn) startAutoPlayback();
        } catch (e) {
            console.error("Failed to load music.mp3:", e);
        }
    }

    function stopCurrentSource() {
        if (currentSource) {
            try { currentSource.stop(); } catch (e) { }
            currentSource.disconnect();
            currentSource = null;
        }
    }

    // Play forward at steady 1.0 speed
    function startAutoPlayback() {
        if (!audioBuffer || !musicOn || isDragging) return;
        stopCurrentSource();

        currentSource = audioCtx.createBufferSource();
        currentSource.buffer = audioBuffer;
        currentSource.loop = true;
        currentSource.connect(audioCtx.destination);

        // Ensure playhead is wrapped within duration
        playheadTime = playheadTime % audioBuffer.duration;
        currentSource.start(0, playheadTime);
        lastTimeUpdate = audioCtx.currentTime;
        isSpinning = true;

        autoSpin();
    }

    // Update playhead time continuously based on auto-playback
    function updatePlayhead() {
        if (isSpinning && musicOn && !isDragging && audioCtx) {
            const now = audioCtx.currentTime;
            const delta = now - lastTimeUpdate;
            playheadTime += delta;
            if (audioBuffer) playheadTime = playheadTime % audioBuffer.duration;
            lastTimeUpdate = now;
        }
    }
    // Simple loop to keep time in sync
    setInterval(updatePlayhead, 50);

    function startMusic() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            loadAudio();
        } else if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        musicOn = true;
        musicBtn.textContent = '🎵';
        musicBtn.classList.remove('muted');
        if (audioBuffer && !isDragging) startAutoPlayback();
    }

    function stopMusic() {
        musicOn = false;
        isSpinning = false;
        updatePlayhead(); // commit final time
        stopCurrentSource();
        if (vSpinId) { clearInterval(vSpinId); vSpinId = null; }
        musicBtn.textContent = '🔇';
        musicBtn.classList.add('muted');
    }

    let firstInteract = true;
    document.addEventListener('click', () => {
        if (firstInteract) { firstInteract = false; startMusic(); }
    }, { once: true });

    musicBtn && musicBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        firstInteract = false;
        musicOn ? stopMusic() : startMusic();
    });


    // ══════════════════════════════════
    // VINYL AUTO-SPIN + MANUAL DRAG
    // ══════════════════════════════════
    if (vinyl) {

        function autoSpin() {
            if (vSpinId) return;
            vSpinId = setInterval(() => {
                if (!musicOn || isDragging) return;
                vAngle = (vAngle + AUTO_SPIN_SPEED) % 360;
                vinyl.style.transform = `rotate(${vAngle}deg)`;
            }, 28); // ~35 fps
        }

        vinyl.addEventListener('mousedown', startVinylDrag);
        vinyl.addEventListener('touchstart', startVinylDrag, { passive: false });

        function startVinylDrag(e) {
            e.preventDefault(); e.stopPropagation();
            if (!musicOn) startMusic();

            isDragging = true;
            isSpinning = false;
            updatePlayhead(); // commit time before scratching

            if (vSpinId) { clearInterval(vSpinId); vSpinId = null; }
            stopCurrentSource();

            // For scratch velocity calculation
            let lastA = angle(e);
            let lastT = performance.now();

            // Keep track of total degrees rotated physically
            let continuousAngle = vAngle;

            const mv = (ev) => {
                if (!isDragging) return;

                const currentA = angle(ev);
                const currentT = performance.now();
                const dt = currentT - lastT;
                if (dt === 0) return;

                // Handle angle wrap-around
                let dA = currentA - lastA;
                if (dA > 180) dA -= 360;
                if (dA < -180) dA += 360;

                continuousAngle += dA;
                vAngle = ((continuousAngle % 360) + 360) % 360;
                vinyl.style.transform = `rotate(${vAngle}deg)`;

                if (audioBuffer) {
                    // Calculate scratch speed
                    const dragSpeedDegPerMs = dA / dt;
                    const baseSpeed = AUTO_SPIN_SPEED / 28;
                    const SCRATCH_SENSITIVITY = 0.3;

                    let scratchRate = (dragSpeedDegPerMs / baseSpeed) * SCRATCH_SENSITIVITY;

                    const timePerDegree = (28 / 1000) / AUTO_SPIN_SPEED;
                    const timeDelta = dA * timePerDegree * SCRATCH_SENSITIVITY;

                    playheadTime += timeDelta;

                    if (playheadTime < 0) playheadTime = audioBuffer.duration - (-playheadTime % audioBuffer.duration);
                    playheadTime = playheadTime % audioBuffer.duration;

                    playScratchGrain(scratchRate);
                }

                lastA = currentA;
                lastT = currentT;
            };

            const up = () => {
                isDragging = false;
                document.removeEventListener('mousemove', mv);
                document.removeEventListener('touchmove', mv);
                document.removeEventListener('mouseup', up);
                document.removeEventListener('touchend', up);

                if (musicOn) {
                    startAutoPlayback();
                }
            };

            document.addEventListener('mousemove', mv);
            document.addEventListener('touchmove', mv, { passive: false });
            document.addEventListener('mouseup', up);
            document.addEventListener('touchend', up);
        }

        // Granular playback for scratching
        function playScratchGrain(rate) {
            if (!audioCtx || Math.abs(rate) < 0.05) return;

            const isReverse = rate < 0;
            const absRate = Math.min(Math.abs(rate), 4.0);

            const src = audioCtx.createBufferSource();
            src.buffer = isReverse ? revAudioBuffer : audioBuffer;
            src.playbackRate.value = absRate;

            // Brief attack/release to avoid clicking
            const env = audioCtx.createGain();
            const now = audioCtx.currentTime;
            env.gain.setValueAtTime(0, now);
            env.gain.linearRampToValueAtTime(1, now + 0.01);
            env.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

            src.connect(env);
            env.connect(audioCtx.destination);

            const startTime = isReverse ? (audioBuffer.duration - playheadTime) : playheadTime;

            src.start(now, startTime);
            src.stop(now + 0.1);
        }

        function angle(e) {
            const r = vinyl.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const px = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
            const py = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
            return Math.atan2(py - cy, px - cx) * (180 / Math.PI);
        }
    }


    // ══════════════════════════════════
    // PULL TAB: BUS (horizontal)
    // ══════════════════════════════════
    const busTab = document.getElementById('bus-tab');
    const busTrack = document.getElementById('bus-track');
    const busEmoji = document.getElementById('bus-emoji');
    if (busTab && busTrack && busEmoji) {
        let busDragging = false, busStartX = 0, busCurX = 0;
        busTab.addEventListener('mousedown', startBusDrag);
        busTab.addEventListener('touchstart', startBusDrag, { passive: false });
        function startBusDrag(e) {
            e.stopPropagation(); e.preventDefault();
            busDragging = true;
            busStartX = getClientX(e) - busCurX;
            const mv = (ev) => {
                if (!busDragging) return;
                const max = busTrack.clientWidth - busTab.clientWidth;
                busCurX = Math.min(max, Math.max(0, getClientX(ev) - busStartX));
                busTab.style.transform = `translateX(${busCurX}px)`;
                busEmoji.style.transform = `translateX(${(busCurX / max) * 210}px)`;
            };
            const up = () => { busDragging = false; cleanup(mv, up); };
            document.addEventListener('mousemove', mv);
            document.addEventListener('touchmove', mv, { passive: false });
            document.addEventListener('mouseup', up);
            document.addEventListener('touchend', up);
        }
    }


    // ══════════════════════════════════
    // PULL TAB: CATS (vertical — drag up to raise cats)
    // ══════════════════════════════════
    const catTab = document.getElementById('cat-tab');
    const catTrack = document.getElementById('cat-track');
    const risingCats = document.getElementById('rising-cats');
    if (catTab && catTrack && risingCats) {
        let catDragging = false, catStartY = 0, catCurY = 0;
        catTab.addEventListener('mousedown', startCatDrag);
        catTab.addEventListener('touchstart', startCatDrag, { passive: false });
        function startCatDrag(e) {
            e.stopPropagation(); e.preventDefault();
            catDragging = true;
            catStartY = getClientY(e) - catCurY;
            const mv = (ev) => {
                if (!catDragging) return;
                const max = catTrack.clientHeight - catTab.clientHeight;
                catCurY = Math.min(0, Math.max(-max, getClientY(ev) - catStartY));
                catTab.style.transform = `translateY(${catCurY}px)`;
                const pct = max > 0 ? Math.abs(catCurY) / max : 0;
                risingCats.style.bottom = `${-50 + pct * 90}px`;
            };
            const up = () => { catDragging = false; cleanup(mv, up); };
            document.addEventListener('mousemove', mv);
            document.addEventListener('touchmove', mv, { passive: false });
            document.addEventListener('mouseup', up);
            document.addEventListener('touchend', up);
        }
    }


    // ══════════════════════════════════
    // PULL TAB: STEER CAR (horizontal back and forth)
    // ══════════════════════════════════
    const steerTab = document.getElementById('steer-tab');
    const steerTrack = document.getElementById('steer-track');
    const driveCar = document.getElementById('drive-car');
    if (steerTab && steerTrack && driveCar) {
        let steerDragging = false, steerStartX = 0, steerCurX = 0;
        
        // start tab in the middle
        const maxSteer = steerTrack.clientWidth - steerTab.clientWidth;
        steerCurX = maxSteer / 2;
        steerTab.style.transform = `translateX(${steerCurX}px)`;

        steerTab.addEventListener('mousedown', startSteerDrag);
        steerTab.addEventListener('touchstart', startSteerDrag, { passive: false });
        function startSteerDrag(e) {
            e.stopPropagation(); e.preventDefault();
            steerDragging = true;
            steerStartX = getClientX(e) - steerCurX;
            const mv = (ev) => {
                if (!steerDragging) return;
                steerCurX = Math.min(maxSteer, Math.max(0, getClientX(ev) - steerStartX));
                steerTab.style.transform = `translateX(${steerCurX}px)`;
                // Map steering tab (0 to max) to car visual translation (-80px to +80px)
                const pct = (steerCurX / maxSteer) - 0.5;
                driveCar.style.transform = `translateX(calc(-50% + ${pct * 160}px)) rotate(${pct * 15}deg)`;
            };
            const up = () => { steerDragging = false; cleanup(mv, up); };
            document.addEventListener('mousemove', mv);
            document.addEventListener('touchmove', mv, { passive: false });
            document.addEventListener('mouseup', up);
            document.addEventListener('touchend', up);
        }
    }


    // ══════════════════════════════════
    // PULL TAB: TRUCK (horizontal reversed)
    // ══════════════════════════════════
    const truckTab = document.getElementById('truck-tab');
    const truckTrack = document.getElementById('truck-track');
    const truckEmoji = document.getElementById('truck-emoji');
    const truckCrash = document.getElementById('truck-crash');
    if (truckTab && truckTrack && truckEmoji) {
        let truckDragging = false, truckStartX = 0, truckCurX = 0;
        truckTab.addEventListener('mousedown', startTruckDrag);
        truckTab.addEventListener('touchstart', startTruckDrag, { passive: false });
        function startTruckDrag(e) {
            e.stopPropagation(); e.preventDefault();
            truckDragging = true;
            truckStartX = getClientX(e) - truckCurX;
            const mv = (ev) => {
                if (!truckDragging) return;
                const max = truckTrack.clientWidth - truckTab.clientWidth;
                // Sliding from right (0) to left (-max)
                truckCurX = Math.min(0, Math.max(-max, getClientX(ev) - truckStartX));
                truckTab.style.transform = `translateX(${truckCurX}px)`;
                
                // Emoji goes right to left
                truckEmoji.style.transform = `translateX(${truckCurX * (210/max)}px) scaleX(-1)`;

                if (Math.abs(truckCurX) >= max * 0.9) {
                    truckCrash.classList.add('show');
                } else {
                    truckCrash.classList.remove('show');
                }
            };
            const up = () => { truckDragging = false; cleanup(mv, up); };
            document.addEventListener('mousemove', mv);
            document.addEventListener('touchmove', mv, { passive: false });
            document.addEventListener('mouseup', up);
            document.addEventListener('touchend', up);
        }
    }


    // ══════════════════════════════════
    // UNDERPASS FLASHLIGHT
    // ══════════════════════════════════
    const underpassScene = document.getElementById('underpass-scene');
    const darkOverlay = document.getElementById('dark-overlay');
    if (underpassScene && darkOverlay) {
        function updateFlashlight(x, y) {
            darkOverlay.style.clipPath = `circle(60px at ${x}px ${y}px)`;
        }
        
        const attachFlash = (e) => {
            const rect = underpassScene.getBoundingClientRect();
            const cx = getClientX(e) - rect.left;
            const cy = getClientY(e) - rect.top;
            updateFlashlight(cx, cy);
        };
        
        underpassScene.addEventListener('mousemove', attachFlash);
        underpassScene.addEventListener('touchmove', (e) => {
            e.preventDefault(); // stop page scroll
            attachFlash(e);
        }, { passive: false });
    }


    // ══════════════════════════════════
    // PULL CORD: THE LIGHT (vertical down)
    // ══════════════════════════════════
    const lightTab = document.getElementById('light-tab');
    const lightTrack = document.getElementById('light-track');
    const lightScene = document.getElementById('light-scene');
    if (lightTab && lightTrack && lightScene) {
        let lightDragging = false, lightStartY = 0, lightCurY = 0;
        let isLit = false;

        lightTab.addEventListener('mousedown', startLightDrag);
        lightTab.addEventListener('touchstart', startLightDrag, { passive: false });
        function startLightDrag(e) {
            if(isLit) return; // one-time pull
            e.stopPropagation(); e.preventDefault();
            lightDragging = true;
            lightStartY = getClientY(e) - lightCurY;
            const mv = (ev) => {
                if (!lightDragging) return;
                const max = lightTrack.clientHeight - lightTab.clientHeight;
                lightCurY = Math.min(max, Math.max(0, getClientY(ev) - lightStartY));
                lightTab.style.transform = `translateY(${lightCurY}px)`;
                
                if (lightCurY >= max * 0.8 && !isLit) {
                    isLit = true;
                    lightScene.classList.add('illuminated');
                }
            };
            const up = () => { lightDragging = false; cleanup(mv, up); };
            document.addEventListener('mousemove', mv);
            document.addEventListener('touchmove', mv, { passive: false });
            document.addEventListener('mouseup', up);
            document.addEventListener('touchend', up);
        }
    }


    // ══════════════════════════════════
    // HELPERS
    // ══════════════════════════════════
    function getClientX(e) { return (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX; }
    function getClientY(e) { return (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY; }
    function cleanup(mv, up) {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('touchmove', mv);
        document.removeEventListener('mouseup', up);
        document.removeEventListener('touchend', up);
    }

});