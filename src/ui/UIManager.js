import { audio } from '../audio/AudioManager.js';
import { DEFAULT_MASS, STACK_COUNT, SLAMMER_DEFS, CAP_DEFS, THROWS_PER_ROUND } from '../config/constants.js';
import { CapViewer }      from './CapViewer.js';
import { effectName, effectDesc } from '../game/effects/labels.js';
import { ENCHANT_DEFS }      from '../config/enchantDefs.js';
import { capThumbnailHTML }  from './capThumbnail.js';
import { REWARD_TYPE_ICONS, REWARD_TYPE_LABELS, REWARD_TYPE_DESCRIPTIONS } from '../config/trickShotDefs.js';
import { bindTapSelect } from './domUtils.js';
import { getNoGlamFamPenalty } from '../game/bossModifiers/index.js';
import { formatScore } from './formatScore.js';
import { getSeriesDef } from '../config/seriesDefs.js';
import { abilityBoxHTML } from './abilityBox.js';

export class UIManager {
    constructor() {
        this._mass        = DEFAULT_MASS;
        this._gravity     = 200;
        this._blastSpread = 0.55;
        this._stackCount  = STACK_COUNT;
        this._capSeries   = 'mixed';
        this._panelOpen   = false;
        this._slammerIdx  = 0;
        this._remainingDefs = [];
        this._wonDefs       = [];

        this.onGravityChange  = null;
        this.onPauseRetry     = null; // sat af BattleScreen i run-mode
        this.onPauseMainMenu  = null; // sat af main.js

        this._gameState = null;

        this._capViewer = new CapViewer(document.getElementById('cap-viewer-container'));
        this._slammerViewer = new CapViewer(document.getElementById('slammer-viewer-container'));
        this._buildTunePanel();
        this._buildPileOverlay();
        this._buildHelp();
        this._buildPauseOverlay();

    }

    setGameState(gs) { this._gameState = gs; }

    // ─── GETTERS ─────────────────────────────────────────────────────────────
    getMass()        { return this._mass; }
    getGravity()     { return -this._gravity; }
    getBlastSpread() { return this._blastSpread; }
    getStackCount()  { return this._stackCount; }

    getActiveCaps() {
        if (this._capSeries === 'mixed') return CAP_DEFS;
        return CAP_DEFS.filter(d => d.series === this._capSeries);
    }

    // ─── STATUS / RESULTS ────────────────────────────────────────────────────
    setStatus(text) {
        document.getElementById('status').textContent = text;
    }

    showScoreFloat(screenX, screenY, baseAmount, multChain = [], onFinalNumber = null, carry = 0) {
        const chain = multChain.filter(m => m > 1);

        const el = document.createElement('div');
        el.className = `score-float${baseAmount > 1 ? ' bonus' : ''}`;

        if (carry > 0) {
            const carryEl = document.createElement('div');
            carryEl.className   = 'score-float-carry';
            carryEl.textContent = `⟳+${carry}`;
            el.appendChild(carryEl);
        }

        const valEl = document.createElement('div');
        valEl.className   = 'score-float-val';
        valEl.textContent = `+${baseAmount}`;
        el.appendChild(valEl);

        if (chain.length > 0) {
            el.classList.add('has-multiplier');
            // Geometric decay: each gap = previous gap × DECAY → accelerates naturally
            // 2 steps: 300 → feels deliberate; 11 steps: last gaps are ~10ms flashes
            const FIRST_GAP = 300;
            const DECAY     = 0.65;
            const revealTimes = [340]; // first reveal after float settles
            for (let s = 1; s < chain.length; s++) {
                const gap = Math.max(45, Math.round(FIRST_GAP * Math.pow(DECAY, s - 1)));
                revealTimes.push(revealTimes[s - 1] + gap);
            }
            const lastRevealAt = revealTimes[chain.length - 1];
            const lastUpdateMs = lastRevealAt + 130;
            el.style.animationDuration = `${((lastUpdateMs + 400) / 0.68 / 1000).toFixed(2)}s`;

            const multEl = document.createElement('div');
            multEl.className = 'score-float-mult';
            el.appendChild(multEl);

            let running = baseAmount;
            chain.forEach((mult, i) => {
                const isLast   = i === chain.length - 1;
                const label    = mult % 1 === 0 ? `×${mult}` : `×${mult.toFixed(1)}`;
                const next     = Math.floor(running * mult);
                running        = next;
                const revealAt = revealTimes[i];

                setTimeout(() => {
                    multEl.textContent = label;
                    multEl.classList.remove('visible');
                    void multEl.offsetWidth;
                    multEl.classList.add('visible');
                }, revealAt);

                setTimeout(() => {
                    valEl.textContent = `+${next}`;
                    valEl.classList.remove('pop');
                    void valEl.offsetWidth;
                    valEl.classList.add('pop');
                    if (isLast && onFinalNumber) onFinalNumber();
                }, revealAt + 130);
            });
        } else {
            // No chain — number is already final
            if (onFinalNumber) onFinalNumber();
        }

        const jx = Math.round((Math.random() - 0.5) * 24);
        el.style.left = `${screenX + jx}px`;
        el.style.top  = `${screenY}px`;
        document.body.appendChild(el);
        el.addEventListener('animationend', e => { if (e.target === el) el.remove(); });
    }

    showEffectIndicator(screenX, screenY, meta) {
        const el = document.createElement('div');
        el.className = 'effect-indicator';
        el.style.left = `${screenX}px`;
        el.style.top  = `${screenY - 18}px`;
        document.body.appendChild(el);

        if (meta.type === 'solo') {
            el.classList.add(meta.qualifies ? 'effect-indicator--ok' : 'effect-indicator--fail');
            el.textContent = meta.qualifies ? '✓' : '✕';
            setTimeout(() => el.remove(), meta.qualifies ? 1100 : 900);

        } else if (meta.type === 'neighbours') {
            el.classList.add('effect-indicator--neighbours');
            let total = 0;
            for (let i = 0; i < meta.count; i++) {
                setTimeout(() => {
                    total++;
                    el.textContent = `+${total}`;
                    el.classList.remove('ind-pop');
                    void el.offsetWidth;
                    el.classList.add('ind-pop');
                }, 180 + i * 200);
            }
            setTimeout(() => el.remove(), 180 + meta.count * 200 + 700);
        } else if (meta.type === 'magnet') {
            el.classList.add('effect-indicator--magnet');
            el.textContent = `🧲 ×${meta.count}`;
            setTimeout(() => el.remove(), 1200);
        } else if (meta.type === 'boomerang') {
            el.classList.add('effect-indicator--boomerang');
            el.textContent = '🪃';
            setTimeout(() => el.remove(), 900);
        } else if (meta.type === 'rally') {
            el.classList.add('effect-indicator--rally');
            el.textContent = meta.count > 0 ? `⚡+${meta.count}` : '⚡';
            setTimeout(() => el.remove(), 1100);
        } else if (meta.type === 'crew') {
            el.classList.add('effect-indicator--crew');
            el.textContent = meta.count > 0 ? `👾+${meta.count}` : '👾';
            setTimeout(() => el.remove(), 1100);
        } else if (meta.type === 'martyr') {
            el.classList.add('effect-indicator--martyr');
            el.textContent = meta.count > 0 ? `💫×${meta.count}` : '💫';
            setTimeout(() => el.remove(), 1100);
        } else if (meta.type === 'surge') {
            el.classList.add(meta.success ? 'effect-indicator--surge' : 'effect-indicator--fail');
            el.textContent = meta.success ? '⚡↩' : '⚡✕';
            setTimeout(() => el.remove(), meta.success ? 1000 : 800);
        } else if (meta.type === 'clone') {
            el.classList.add('effect-indicator--clone');
            el.textContent = '👻';
            setTimeout(() => el.remove(), 1100);
        } else if (meta.type === 'destroy') {
            el.classList.add('effect-indicator--destroy');
            el.textContent = '💥';
            setTimeout(() => el.remove(), 1000);
        } else if (meta.type === 'exhaust') {
            el.classList.add('effect-indicator--exhaust');
            el.textContent = meta.count > 0 ? `💤×${meta.count}` : '💤';
            setTimeout(() => el.remove(), 1000);
        } else if (meta.type === 'husk') {
            el.classList.add('effect-indicator--husk');
            el.textContent = '🕳️';
            setTimeout(() => el.remove(), 1100);
        }
    }

    // Returns { x, y } — centre of where the icon spawns, so callers can anchor floats next to it
    popCollectIcon(def) {
        const btn  = document.getElementById('pile-won-btn');
        const rect = btn.getBoundingClientRect();
        const cx   = rect.left + rect.width  / 2;
        const cy   = rect.top  - 15;

        const img  = document.createElement('img');
        img.src    = def.texFront ?? '';
        img.className = 'collect-icon';
        img.style.left = (cx - 26) + 'px';
        img.style.top  = cy + 'px';
        document.body.appendChild(img);
        img.addEventListener('animationend', () => img.remove());

        btn.classList.remove('collect-flash');
        void btn.offsetWidth;
        btn.classList.add('collect-flash');
        btn.addEventListener('animationend', () => btn.classList.remove('collect-flash'), { once: true });

        return { x: cx, y: cy };
    }

    popStackIcon(def) {
        const btn  = document.getElementById('pile-rem-btn');
        const rect = btn.getBoundingClientRect();
        const cx   = rect.left + rect.width  / 2;
        const cy   = rect.top  - 15;

        const img  = document.createElement('img');
        img.src    = def.texFront ?? '';
        img.className = 'collect-icon';
        img.style.left = (cx - 26) + 'px';
        img.style.top  = cy + 'px';
        document.body.appendChild(img);
        img.addEventListener('animationend', () => img.remove());

        btn.classList.remove('collect-flash');
        void btn.offsetWidth;
        btn.classList.add('collect-flash');
        btn.addEventListener('animationend', () => btn.classList.remove('collect-flash'), { once: true });
    }

    flashBagBtn() {
        const btn = document.getElementById('bag-btn');
        if (!btn) return;
        btn.classList.remove('collect-flash');
        void btn.offsetWidth;
        btn.classList.add('collect-flash');
        btn.addEventListener('animationend', () => btn.classList.remove('collect-flash'), { once: true });
    }

    setActionPrompt(text) {
        const el = document.getElementById('action-prompt');
        if (text) {
            el.textContent    = text;
            el.style.display  = 'block';
        } else {
            el.style.display  = 'none';
            el.textContent    = '';
        }
    }

    showResults(won, totalScore, wonCaps, allFlipped = false) {
        const label = document.getElementById('wonLabel');
        if (allFlipped && won > 0) {
            label.textContent = `Perfect! All ${won} caps flipped!`;
            label.style.color = '#ffd700';
        } else {
            label.textContent = `${won} caps flipped`;
            label.style.color = '';
        }

        const wonList = document.getElementById('wonList');
        const wonStyle = 'width:40px;height:40px;margin:3px;border-radius:50%;border:2px solid rgba(255,255,255,0.25);cursor:pointer;display:inline-block;vertical-align:middle;overflow:hidden;';
        wonList.innerHTML = wonCaps.map((entry, i) => {
            const def = entry.def ?? entry;
            if (def.texFront) {
                return capThumbnailHTML(
                    { ...entry, enchant: this._liveEnchant(entry) },
                    { imgClass: 'cap-thumb-img', extraAttrs: `data-idx="${i}" style="${wonStyle}"` }
                );
            }
            const hex = '#' + (def.color ?? 0xaaaaaa).toString(16).padStart(6, '0');
            return `<span title="${def.name}" data-idx="${i}" style="display:inline-block;width:40px;height:40px;
                    border-radius:50%;background:${hex};margin:3px;
                    border:2px solid rgba(255,255,255,0.2)"></span>`;
        }).join('');

        wonList.querySelectorAll('.cap-enchant-wrap[data-idx]').forEach(el => {
            el.addEventListener('pointerdown', e => {
                e.stopPropagation();
                this._showCapDetail(wonCaps[+el.dataset.idx], true);
            });
        });

        const resultsEl = document.getElementById('results');
        resultsEl.style.display = 'block';
        resultsEl.classList.remove('results--entering');
        void resultsEl.offsetWidth; // reflow — genstarter animationen selv hvis den var kørt for nyligt
        resultsEl.classList.add('results--entering');
        setTimeout(() => resultsEl.classList.remove('results--entering'), 420);
    }

    hideResults() {
        document.getElementById('results').style.display = 'none';
    }

    // _lastScoreValue holder den RÅ numeriske startværdi for tween-animationen
    // — kan ikke længere læses tilbage fra DOM'en (parseInt("1.01k") === 1,
    // ikke 1010, hvilket ville ødelægge selve optællingen for store tal).
    setScore(n) {
        const el   = document.getElementById('score');
        const from = this._lastScoreValue ?? 0;
        if (from === n) return;
        this._lastScoreValue = n;
        if (this._scoreTweenRaf) cancelAnimationFrame(this._scoreTweenRaf);
        const duration = Math.min(450, Math.max(120, Math.abs(n - from) * 6));
        const start = performance.now();
        const step = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = formatScore(from + (n - from) * eased);
            if (t < 1) this._scoreTweenRaf = requestAnimationFrame(step);
            else { el.textContent = formatScore(n); this._scoreTweenRaf = null; }
        };
        this._scoreTweenRaf = requestAnimationFrame(step);
    }
    resetScore() {
        if (this._scoreTweenRaf) { cancelAnimationFrame(this._scoreTweenRaf); this._scoreTweenRaf = null; }
        this._lastScoreValue = 0;
        document.getElementById('score').textContent = 0;
        const ri = document.getElementById('run-info');
        if (ri) ri.classList.remove('run-info--won', 'run-info--lost');
    }

    showThresholdResult(clearScore, totalScore, won) {
        const goalEl  = document.getElementById('run-goal-score');
        const runInfo = document.getElementById('run-info');
        if (!goalEl || !runInfo) return;

        const target   = won ? 0 : clearScore - totalScore;
        const duration = Math.min(600, Math.max(200, clearScore * 12));
        const start    = performance.now();
        const step = (now) => {
            const t     = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            goalEl.textContent = formatScore(clearScore + (target - clearScore) * eased);
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                goalEl.textContent = formatScore(target);
                runInfo.classList.add(won ? 'run-info--won' : 'run-info--lost');
            }
        };
        requestAnimationFrame(step);
    }

    _spawnAnchorFloat(text, extraClass) {
        const anchor = document.getElementById('score-display');
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        const el = document.createElement('div');
        el.className = `score-float ${extraClass}`;
        el.style.left = `${rect.left + rect.width * 0.4}px`;
        el.style.top  = `${rect.top}px`;
        const val = document.createElement('div');
        val.className = 'score-float-val';
        val.textContent = text;
        el.appendChild(val);
        document.body.appendChild(el);
        el.addEventListener('animationend', e => { if (e.target === el) el.remove(); });
    }

    showScoreDeduct(amount) { this._spawnAnchorFloat(`-${formatScore(amount)}`, 'score-float--deduct'); }
    showScoreGain(amount)   { this._spawnAnchorFloat(`+${formatScore(amount)}`, 'bonus'); }

    // Parity-boss (Even Steven/Odd Todd) pr.-kast feedback — grønt flueben når
    // kastets flip-antal matcher bossens krav (kastet tæller), rødt kryds når
    // det ikke gør. Sidder som en badge PÅ selve gimmick-forklarings-stickeren
    // (#boss-info), ikke løst nede ved scoren, så check/kryds altid ses lige
    // ved siden af HVORFOR-forklaringen.
    showBossThrowFeedback(passed) {
        const el = document.getElementById('boss-info-feedback');
        if (!el) return;
        el.textContent = passed ? '✓' : '✗';
        el.classList.remove('boss-info-feedback--pop');
        el.classList.toggle('boss-info-feedback--pass', passed);
        el.classList.toggle('boss-info-feedback--fail', !passed);
        el.classList.add('boss-info-feedback--show');
        void el.offsetWidth; // genstart pop-animationen selv ved to kast i træk med samme udfald
        el.classList.add('boss-info-feedback--pop');
    }

    // label = hvad "count" tæller (default 'unused', matcher Iron Discipline's
    // "+N unused" kast-tekst) — Sharden/Balance sender deres eget label ind
    // ('unused Shard(s)'/'round at max stack'), da "unused" alene ikke giver mening der.
    // texFront: slammerens EGET portræt (samme billede som bruges i shop/collection),
    // ikke passivens lille symbol-ikon — så spilleren kan se HVILKEN slammer der voksede
    // uden at skulle huske symbolet. Falder tilbage til et tomt cirkel-ikon hvis manglende.
    showRelicGain(texFront, oldValue, newValue, count, label = 'unused') {
        const el = document.createElement('div');
        el.className = 'relic-gain-sticker';
        el.innerHTML = `
            <div class="relic-gain-top">
                <img class="relic-gain-icon" src="${texFront ?? ''}">
                <span class="relic-gain-throws">+${count} ${label}</span>
            </div>
            <div class="relic-gain-row">
                <span class="relic-gain-old">×${oldValue.toFixed(1)}</span>
                <span class="relic-gain-arrow">→</span>
                <span class="relic-gain-new">×${newValue.toFixed(1)}</span>
            </div>`;
        document.body.appendChild(el);
        setTimeout(() => el.classList.add('relic-gain-sticker--reveal'), 400);
        el.addEventListener('animationend', e => { if (e.target === el) el.remove(); });
    }

    // Modstykke til showRelicGain — bruges når en streak-baseret permanent
    // multiplier (fx Balance) brydes og falder tilbage til ×1.0, så spilleren
    // kan SE hvorfor den pludselig er væk i stedet for bare at opdage det
    // ved et tilfælde. Samme sticker, rødtonet i stedet for gyldent.
    showRelicReset(texFront, oldValue) {
        const el = document.createElement('div');
        el.className = 'relic-gain-sticker relic-gain-sticker--reset';
        el.innerHTML = `
            <div class="relic-gain-top">
                <img class="relic-gain-icon" src="${texFront ?? ''}">
                <span class="relic-gain-throws">↺ reset</span>
            </div>
            <div class="relic-gain-row">
                <span class="relic-gain-old">×${oldValue.toFixed(1)}</span>
                <span class="relic-gain-arrow">→</span>
                <span class="relic-gain-new">×1.0</span>
            </div>`;
        document.body.appendChild(el);
        setTimeout(() => el.classList.add('relic-gain-sticker--reveal'), 400);
        el.addEventListener('animationend', e => { if (e.target === el) el.remove(); });
    }

    showDoubleBadge(mult) {
        const el = document.getElementById('double-badge');
        el.textContent = `×${mult}`;
        el.style.display = '';
    }
    hideDoubleBadge()      { document.getElementById('double-badge').style.display = 'none'; }

    // Fjerner øjeblikkeligt (ingen exit-animation) alle transiente rarity/
    // parity/flatbonus-badges — kaldes ved en NY runde/stack (RoundManager.
    // buildStack()), så en badge fra forrige rundes sidste kast ikke bliver
    // hængende ind i næste skærm/kamp bare fordi dens 1.8s pop-animation
    // endnu ikke var færdig da spilleren nåede at navigere videre (fx gennem
    // reward/shop og ind i en boss-kamp hurtigere end 1.8s).
    clearTransientPassiveBadges() {
        document.querySelectorAll('.rarity-mult-badge, .parity-mult-badge, .flatbonus-mult-badge, .passive-trigger-badge')
            .forEach(el => el.remove());
    }

    // AMPLIFYZ — persistent "armeret"-badge, stakker ligesom double-badge (spiller
    // 2 kort → ×2, ikke bare "aktiv"). Uden denne var der ingen måde at SE at et
    // 2. kort overhovedet blev registreret før kastet rent faktisk blev afgjort.
    showAmplifyBadge(stacks) {
        const el = document.getElementById('amplify-badge');
        el.textContent = `◈ ×${stacks}`;
        el.style.display = '';
    }
    hideAmplifyBadge() { document.getElementById('amplify-badge').style.display = 'none'; }

    // slammer = den ejede slammer der giver passiven — viser dens portræt i
    // stedet for et generisk ikon (relic-erstatning, jf. slammer-passives-draft.md).
    // amplifyStacks = antal AMPLIFYZ-kort armeret til NÆSTE kast (0 = ingen) —
    // viser den reelt forstærkede værdi (value^(1+stacks), matcher passiveMultiplier)
    // + en ◈×N-markør, så stak-antallet kan ses FØR man kaster.
    showFirstStrikeBadge(slammer, amplifyStacks = 0) {
        const el = document.getElementById('first-strike-badge');
        if (slammer?.texFront) {
            const value = amplifyStacks > 0 ? slammer.passive.value ** (1 + amplifyStacks) : slammer.passive.value;
            el.innerHTML = `<img class="slammer-badge-icon" src="${slammer.texFront}" alt="${slammer.name}"> ×${value}${amplifyStacks > 0 ? ` ◈×${amplifyStacks}` : ''}`;
        }
        el.classList.toggle('slammer-badge--amplified', amplifyStacks > 0);
        el.style.display = '';
    }
    hideFirstStrikeBadge() { document.getElementById('first-strike-badge').style.display = 'none'; }
    showLastStandBadge(slammer, amplifyStacks = 0) {
        const el = document.getElementById('last-stand-badge');
        if (slammer?.texFront) {
            const value = amplifyStacks > 0 ? slammer.passive.value ** (1 + amplifyStacks) : slammer.passive.value;
            el.innerHTML = `<img class="slammer-badge-icon" src="${slammer.texFront}" alt="${slammer.name}"> ×${value}${amplifyStacks > 0 ? ` ◈×${amplifyStacks}` : ''}`;
        }
        el.classList.toggle('slammer-badge--amplified', amplifyStacks > 0);
        el.style.display = '';
    }
    hideLastStandBadge()   { document.getElementById('last-stand-badge').style.display = 'none'; }

    // Flat Bonus-passiv (Power Surge/Magnet) — transient, ligesom rarity/parity
    // nedenfor: poppes ind som BEKRÆFTELSE lige når et kast lander, ikke synlig
    // FØR kastet (den er ubetinget/altid aktiv, så en persistent pre-kast-badge
    // ville bare være støj — se rarity-mult-badge for samme mønster). value =
    // den AGGREGEREDE bonus på tværs af alle ejede flatBonus-slammere.
    showFlatBonusBadge(slammer, value, amplifyStacks = 0) {
        const stack = document.getElementById('slammer-badge-stack');
        if (!stack || !slammer?.texFront) return;
        const shown = amplifyStacks > 0 ? value * (1 + amplifyStacks) : value;
        const el = document.createElement('div');
        el.className = 'flatbonus-mult-badge';
        el.style.background = '#ffb84d';
        el.style.color      = '#000';
        el.style.boxShadow  = '3px 3px 0 #8b5a00';
        el.innerHTML = `<img class="slammer-badge-icon" src="${slammer.texFront}" alt="${slammer.name}"> +${shown}★${amplifyStacks > 0 ? ` ◈×${amplifyStacks}` : ''}`;
        stack.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }

    // Rarity Multiplier-passiv (Uncommon Ground/Rare Find/Legendary Status/
    // Common Touch) — transient badge der poppes ind i badge-stacken lige når
    // kastet lander, farvet efter den rarity der blev boostet (samme palette
    // som cap/slammer-detailens rarity-badge i modals.css). Kalderen (RoundManager)
    // deduplikerer pr. kast — kaldes kun ÉN gang selvom flere caps af samme
    // rarity flippede i samme kast.
    showRarityMultBadge(slammer, rarity, value) {
        const stack = document.getElementById('slammer-badge-stack');
        if (!stack || !slammer?.texFront) return;
        const RARITY_COLORS = { 1: ['#000', '#fff'], 2: ['#5d5f5f', '#fff'], 3: ['var(--clr-red)', '#fff'], 4: ['#f5c842', '#000'] };
        const [bg, fg] = RARITY_COLORS[rarity] ?? RARITY_COLORS[1];
        const el = document.createElement('div');
        el.className = 'rarity-mult-badge';
        el.style.background  = bg;
        el.style.color       = fg;
        el.style.boxShadow   = '3px 3px 0 #000';
        el.innerHTML = `<img class="slammer-badge-icon" src="${slammer.texFront}" alt="${slammer.name}"> ×${value}`;
        stack.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }

    // Parity Multiplier-passiv (Even Steven/Odd Todd SLAMMERE — en ren bonus,
    // IKKE at forveksle med de samnavngivne boss-gimmicks som veto'er score til
    // 0 i stedet). Samme transiente stil som rarity-badgen ovenfor. Teal/magenta
    // — bevidst IKKE grønt/rødt, så de ikke forveksles med First Strikes grønne
    // eller Rare-rarityens røde.
    showParityMultBadge(slammer, parity, value) {
        const stack = document.getElementById('slammer-badge-stack');
        if (!stack || !slammer?.texFront) return;
        const bg = parity === 'even' ? '#00a0a0' : '#cc2266';
        const el = document.createElement('div');
        el.className = 'parity-mult-badge';
        el.style.background = bg;
        el.style.color      = '#fff';
        el.style.boxShadow  = '3px 3px 0 #000';
        el.innerHTML = `<img class="slammer-badge-icon" src="${slammer.texFront}" alt="${slammer.name}"> ${parity === 'even' ? 'EVEN' : 'ODD'} ×${value}`;
        stack.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }

    // Generisk transient trigger-badge til nyere passiver (Hero/Analog Timer/
    // Digital Timer/Magic) — samme pop-ind/pop-ud-stil og stack som rarity/parity/
    // flatbonus ovenfor, bare med frit label/farve i stedet for en dedikeret
    // metode pr. passiv-type (der er for mange nye typer til at retfærdiggøre det).
    showPassiveTriggerBadge(slammer, label, bg, fg = '#fff') {
        const stack = document.getElementById('slammer-badge-stack');
        if (!stack || !slammer?.texFront) return;
        const el = document.createElement('div');
        el.className = 'passive-trigger-badge';
        el.style.background = bg;
        el.style.color      = fg;
        el.style.boxShadow  = '3px 3px 0 #000';
        el.innerHTML = `<img class="slammer-badge-icon" src="${slammer.texFront}" alt="${slammer.name}"> ${label}`;
        stack.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }

    showRunOverlay() {
        document.getElementById('tl-overlay').style.display    = '';
        document.getElementById('score-display').style.display = '';
        document.getElementById('pause-btn').style.display     = '';
    }
    hideRunOverlay() {
        document.getElementById('tl-overlay').style.display    = 'none';
        document.getElementById('score-display').style.display = 'none';
        document.getElementById('pause-btn').style.display     = 'none';
    }

    setRunInfo(nodeName, clearScore) {
        const ri = document.getElementById('run-info');
        ri.classList.remove('run-info--won', 'run-info--lost');
        document.getElementById('run-node-name').textContent  = nodeName;
        document.getElementById('run-goal-score').textContent = clearScore;
        ri.style.display = '';
    }
    clearRunInfo() {
        document.getElementById('run-info').style.display = 'none';
    }

    // ─── TRICK SHOT INFO ─────────────────────────────────────────────────────
    setTrickShotInfo(def) {
        document.getElementById('trickshot-name').textContent = def.name;
        document.getElementById('trickshot-desc').textContent = def.description;
        document.getElementById('trickshot-info').style.display = '';
    }
    clearTrickShotInfo() {
        document.getElementById('trickshot-info').style.display = 'none';
    }
    // active = true mens kastet er i gang — dæmper/pulserer headeren så udsynet til bordet er frit
    setTrickShotActive(active) {
        document.getElementById('trickshot-info')?.classList.toggle('trickshot-info--active', active);
    }

    // ─── BOSS INFO ───────────────────────────────────────────────────────────
    // No Glam Fam-straffen afhænger af ejede caps' enchants — beregnes live
    // fra gameState i stedet for at bages ind i bossDef, så den aldrig kan
    // vise et forældet tal (fx hvis en cap enchantes mens man kigger på den).
    // Returnerer kun selve teksten (ingen wrapper) — kaldestederne har hver
    // deres egen container med sin egen styling (sticker vs. persistent header).
    _noGlamFamPenaltyText(bossDef) {
        if (bossDef.gimmick !== 'no_glam_fam' || !this._gameState) return null;
        const { enchantedCount, penaltyPercent } = getNoGlamFamPenalty(this._gameState.ownedCaps);
        const capsLabel = enchantedCount === 1 ? 'enchanted cap' : 'enchanted caps';
        return `Current: −${penaltyPercent}% (${enchantedCount} ${capsLabel})`;
    }

    setBossInfo(bossDef) {
        document.getElementById('boss-info-name').textContent = `${bossDef.icon} ${bossDef.name}`;
        document.getElementById('boss-info-desc').textContent = bossDef.description;
        document.getElementById('boss-info').style.display = '';
        const penaltyEl = document.getElementById('boss-info-penalty');
        const penaltyText = this._noGlamFamPenaltyText(bossDef);
        if (penaltyEl) {
            penaltyEl.textContent = penaltyText ?? '';
            penaltyEl.style.display = penaltyText ? '' : 'none';
        }
        document.getElementById('boss-info-feedback')?.classList.remove('boss-info-feedback--show', 'boss-info-feedback--pop');
    }
    clearBossInfo() {
        document.getElementById('boss-info').style.display = 'none';
        document.getElementById('boss-info-feedback')?.classList.remove('boss-info-feedback--show', 'boss-info-feedback--pop');
    }
    // active = true mens kastet er i gang — dæmper/pulserer headeren så udsynet til bordet er frit
    setBossActive(active) {
        document.getElementById('boss-info')?.classList.toggle('boss-info--active', active);
    }

    // ─── THROW PIPS ──────────────────────────────────────────────────────────
    updateThrowPips(throwsLeft, throwsTotal) {
        const el = document.getElementById('throw-pips');
        if (!el) return;
        el.innerHTML = '';
        for (let i = 0; i < throwsTotal; i++) {
            const pip = document.createElement('span');
            pip.className = 'throw-pip' + (i < throwsLeft ? ' active' : '');
            el.appendChild(pip);
        }
    }

    // ─── PILE BUTTONS ────────────────────────────────────────────────────────
    // exhaustedDefs (territorial) tælles ALDRIG med i pile-rem-count (de er ikke
    // "i spil" resten af runden), men vises stadig i selve stack-overlayet med et
    // Zzz-badge — og holder nævneren (total) intakt, så "3/10" ikke krymper til
    // "3/8" bare fordi 2 caps blev exhausted undervejs.
    updatePileButtons(remainingDefs, wonDefs, getExtraBase = null, exhaustedDefs = []) {
        this._remainingDefs  = [...remainingDefs, ...exhaustedDefs];
        this._wonDefs        = wonDefs;
        this._getExtraBase   = typeof getExtraBase === 'function' ? getExtraBase : () => (getExtraBase ?? 0);
        const total      = remainingDefs.length + wonDefs.length + exhaustedDefs.length;
        const stackLimit = this._gameState?.stackSizeLimit ?? total;
        document.getElementById('pile-rem-count').textContent = `${remainingDefs.length}/${Math.min(total, stackLimit)}`;
        document.getElementById('pile-won-count').textContent = `${wonDefs.length}/${total}`;
    }

    // ─── OVERLAY STATE ───────────────────────────────────────────────────────
    isOverlayOpen() {
        return document.getElementById('cap-overlay')?.style.display === 'block'
            || document.getElementById('cap-detail')?.style.display  === 'block'
            || document.getElementById('relic-detail')?.style.display === 'block'
            || document.getElementById('slammer-detail')?.style.display === 'block'
            || this.isPauseOpen();
    }

    // ─── PAUSE OVERLAY ───────────────────────────────────────────────────────
    showPauseOverlay() {
        document.getElementById('pause-overlay').classList.add('open');
    }
    hidePauseOverlay() {
        document.getElementById('pause-overlay').classList.remove('open');
    }
    isPauseOpen() {
        return document.getElementById('pause-overlay')?.classList.contains('open') ?? false;
    }

    // ─── HJÆLP-ÅBNER (bruges fra pause overlay) ──────────────────────────────
    openHelp() {
        document.getElementById('help-modal')?.classList.add('open');
    }

    // ─── SLAMMER SELECTION ───────────────────────────────────────────────────
    getSlammerDef() { return SLAMMER_DEFS[this._slammerIdx]; }

    // Kaldes ved hver "start et frisk run"-indgang — _slammerIdx er UI-lokal
    // valgt-til-at-kaste-med-state, helt separat fra GameState.ownedSlammers
    // (passiv-samlingen). Uden dette blev den forrige runs valg (eller default
    // index 0 = Raptor Slammer) siddende, i stedet for at følge Regal Pug,
    // den passiv-løse starter startRun() altid sætter i ownedSlammers.
    resetSlammerToStarter() {
        const idx = SLAMMER_DEFS.findIndex(s => s.name === 'Regal Pug');
        if (idx !== -1) this._slammerIdx = idx;
        const slamNameEl = document.getElementById('slam-name');
        if (slamNameEl) slamNameEl.textContent = SLAMMER_DEFS[this._slammerIdx].name;
    }

    // ─── SLAMMER PANEL ───────────────────────────────────────────────────────
    toggleSlammerPanel() {
        this._panelOpen = !this._panelOpen;
        this._tunePanel.style.display = this._panelOpen ? '' : 'none';
    }

    // ─── PANEL BUILDER ───────────────────────────────────────────────────────
    _buildTunePanel() {
        const panel = document.createElement('div');
        this._tunePanel = panel;
        panel.style.cssText = `
            display:none;position:absolute;top:70px;right:20px;z-index:150;
            background:rgba(0,0,0,0.92);color:#fff;width:220px;
            border-radius:10px;font:13px/1.9 Arial,sans-serif;
            border:1px solid rgba(255,255,255,0.15);user-select:none;overflow:hidden;`;

        // ── Fysik sektion (lukket som default) ──────────────────────────────
        const { wrap: physWrap, body: physBody } = this._buildSection('Physics', false);
        physBody.innerHTML = `
            ${this._sliderRow('Mass',    'sl-mss',  'tv-mss',  0.5, 20,   0.5,  this._mass)}
            ${this._sliderRow('Gravity', 'sl-grav', 'tv-grav',  50, 400,  10,   this._gravity)}
            ${this._sliderRow('Blast',   'sl-bls',  'tv-bls',  0.1, 1.5,  0.05, this._blastSpread)}`;
        panel.appendChild(physWrap);

        // ── Slammers sektion ────────────────────────────────────────────────
        const { wrap: slammersWrap, body: slammersBody } = this._buildSection('Slammers', false);
        slammersBody.innerHTML = '';
        
        // Slammer selector med < og >
        const slamRow = document.createElement('div');
        slamRow.style.cssText = 'padding:8px 16px;display:flex;align-items:center;justify-content:space-between;gap:8px';
        const slamPrev = document.createElement('button');
        slamPrev.textContent = '‹';
        slamPrev.style.cssText = 'background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;padding:0 4px;line-height:1;flex:0 0 auto';
        slamPrev.id = 'slam-prev';
        const slamName = document.createElement('button');
        slamName.textContent = SLAMMER_DEFS[0].name;
        slamName.id = 'slam-name';
        slamName.style.cssText = 'background:none;border:none;color:#fff;font-size:12px;font-weight:bold;text-align:center;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;padding:0;font-family:inherit;line-height:inherit';
        const slamNext = document.createElement('button');
        slamNext.textContent = '›';
        slamNext.style.cssText = 'background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;padding:0 4px;line-height:1;flex:0 0 auto';
        slamNext.id = 'slam-next';
        slamRow.appendChild(slamPrev);
        slamRow.appendChild(slamName);
        slamRow.appendChild(slamNext);
        slammersBody.appendChild(slamRow);
        panel.appendChild(slammersWrap);

        // ── Caps sektion (lukket som default) ────────────────────────────────
        const { wrap: capsWrap, body: capsBody } = this._buildSection('Caps', false);

        // Series-picker knapper
        const seriesPicker = document.createElement('div');
        seriesPicker.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap';
        const seriesOptions = [
            { key: 'raptor_strike', label: 'Raptor Strike' },
            { key: 'scary_skullz',  label: 'Scary Skullz'  },
            { key: 'mixed',         label: 'Mixed'          },
        ];
        this._seriesBtns = {};
        seriesOptions.forEach(({ key, label }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.dataset.series = key;
            btn.style.cssText = `flex:1;min-width:0;padding:3px 6px;border-radius:6px;cursor:pointer;
                font-size:11px;font-weight:bold;border:1px solid rgba(255,255,255,0.2);
                background:${key === this._capSeries ? 'rgba(255,204,0,0.2)' : 'rgba(255,255,255,0.05)'};
                color:${key === this._capSeries ? '#ffcc00' : '#aaa'};`;
            btn.addEventListener('click', () => this._selectSeries(key));
            seriesPicker.appendChild(btn);
            this._seriesBtns[key] = btn;
        });
        capsBody.appendChild(seriesPicker);

        // Stack count slider
        const stackMax = this.getActiveCaps().length;
        const stackDiv = document.createElement('div');
        stackDiv.innerHTML = this._sliderRow('Count', 'sl-cnt', 'tv-cnt', 4, CAP_DEFS.length, 1, this._stackCount);
        capsBody.appendChild(stackDiv.firstElementChild);
        
        const noteEl = document.createElement('p');
        noteEl.style.cssText = 'margin-top:4px;font-size:11px;color:#555;line-height:1.3';
        noteEl.id = 'caps-note';
        noteEl.textContent = `Max without duplicates: ${stackMax}`;
        capsBody.appendChild(noteEl);

        panel.appendChild(capsWrap);
        document.body.appendChild(panel);

        // ── Luk ved klik udenfor ─────────────────────────────────────────────
        document.addEventListener('pointerdown', (e) => {
            if (this._panelOpen &&
                !panel.contains(e.target) &&
                e.target.id !== 'slammer-btn') {
                this._panelOpen = false;
                panel.style.display = 'none';
            }
        });

        // ── Event handlers ───────────────────────────────────────────────────
        document.getElementById('slam-prev').addEventListener('click', () => {
            this._slammerIdx = (this._slammerIdx - 1 + SLAMMER_DEFS.length) % SLAMMER_DEFS.length;
            document.getElementById('slam-name').textContent = SLAMMER_DEFS[this._slammerIdx].name;
            this._showSlammerDetail(SLAMMER_DEFS[this._slammerIdx]);
            if (this.onSlammerChange) this.onSlammerChange(SLAMMER_DEFS[this._slammerIdx]);
        });
        document.getElementById('slam-next').addEventListener('click', () => {
            this._slammerIdx = (this._slammerIdx + 1) % SLAMMER_DEFS.length;
            document.getElementById('slam-name').textContent = SLAMMER_DEFS[this._slammerIdx].name;
            this._showSlammerDetail(SLAMMER_DEFS[this._slammerIdx]);
            if (this.onSlammerChange) this.onSlammerChange(SLAMMER_DEFS[this._slammerIdx]);
        });
        document.getElementById('slam-name').addEventListener('click', e => {
            e.stopPropagation();
            this._showSlammerDetail(SLAMMER_DEFS[this._slammerIdx]);
        });

        document.getElementById('sl-mss').addEventListener('input', e => {
            this._mass = +e.target.value;
            document.getElementById('tv-mss').textContent = this._mass;
        });
        document.getElementById('sl-grav').addEventListener('input', e => {
            this._gravity = +e.target.value;
            document.getElementById('tv-grav').textContent = this._gravity;
            if (this.onGravityChange) this.onGravityChange(-this._gravity);
        });
        document.getElementById('sl-bls').addEventListener('input', e => {
            this._blastSpread = +e.target.value;
            document.getElementById('tv-bls').textContent = this._blastSpread;
        });
        document.getElementById('sl-cnt').addEventListener('input', e => {
            this._stackCount = +e.target.value;
            document.getElementById('tv-cnt').textContent = this._stackCount;
        });
    }

    _buildSection(title, openByDefault = false) {
        const wrap = document.createElement('div');
        wrap.style.borderTop = '1px solid rgba(255,255,255,0.08)';

        const header = document.createElement('div');
        header.style.cssText = 'padding:7px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;';

        const label = document.createElement('span');
        label.style.cssText = 'font-size:11px;font-weight:bold;color:#888;letter-spacing:0.06em;text-transform:uppercase;';
        label.textContent = title;

        const arrow = document.createElement('span');
        arrow.style.cssText = 'color:#555;font-size:10px;';
        arrow.textContent = openByDefault ? '▴' : '▾';

        header.appendChild(label);
        header.appendChild(arrow);

        const body = document.createElement('div');
        body.style.cssText = `padding:0 16px 10px;${openByDefault ? '' : 'display:none;'}`;

        header.addEventListener('click', () => {
            const isOpen = body.style.display !== 'none';
            body.style.display = isOpen ? 'none' : '';
            arrow.textContent = isOpen ? '▾' : '▴';
        });

        wrap.appendChild(header);
        wrap.appendChild(body);
        return { wrap, body };
    }

    _sliderRow(label, sliderId, valueId, min, max, step, val) {
        return `
            <div style="margin-top:8px">
                <div style="display:flex;justify-content:space-between">
                    <span style="color:#ccc">${label}</span><b id="${valueId}">${val}</b>
                </div>
                <input id="${sliderId}" type="range"
                    min="${min}" max="${max}" step="${step}" value="${val}"
                    style="width:100%;accent-color:#ffcc00;cursor:pointer;margin:0">
            </div>`;
    }

    _selectSeries(key) {
        this._capSeries = key;
        Object.entries(this._seriesBtns).forEach(([k, btn]) => {
            const active = k === key;
            btn.style.background = active ? 'rgba(255,204,0,0.2)' : 'rgba(255,255,255,0.05)';
            btn.style.color      = active ? '#ffcc00' : '#aaa';
        });
        const uniqueCount = this.getActiveCaps().length;
        const note = key === 'mixed'
            ? `${uniqueCount} unique caps`
            : `${uniqueCount} unique · duplicates allowed`;
        document.getElementById('caps-note').textContent = note;
    }

    // ─── PILE OVERLAY ────────────────────────────────────────────────────────
    _buildPileOverlay() {
        const overlay    = document.getElementById('cap-overlay');
        const detail     = document.getElementById('cap-detail');
        const slamDetail = document.getElementById('slammer-detail');
        const relicDetail = document.getElementById('relic-detail');

        document.getElementById('pile-won-btn').addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this._toggleOverlay('Won caps', this._wonDefs, true, e.currentTarget, overlay);
        });
        document.getElementById('pile-rem-btn').addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this._toggleOverlay('Caps in stack', this._remainingDefs, false, e.currentTarget, overlay);
        });

        const bagBtn = document.getElementById('bag-btn');
        if (bagBtn) {
            bagBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // stopPropagation ovenfor forhindrer klikket i at nå AudioManagers
                // globale, delegerede click-lytter på document (den fanger den
                // ellers automatisk for alle <button>-elementer) — derfor et
                // eksplicit kald her i stedet.
                audio.play('button_click');
                this.openCollection('caps');
            });
        }

        overlay.addEventListener('pointerdown',    e => e.stopPropagation());
        detail.addEventListener('pointerdown',     e => e.stopPropagation());
        slamDetail.addEventListener('pointerdown', e => e.stopPropagation());
        relicDetail.addEventListener('pointerdown', e => e.stopPropagation());

        document.addEventListener('pointerdown', () => {
            // Var en detail-popup åben lige inden dette klik? Gem det, så det
            // efterfølgende click-event (se capture-listener nedenfor) kan
            // sluges centralt — ellers rammer det uvægerligt hvad end der lå
            // under popup'en (køb en cap i shoppen, vælg en anden node osv.)
            const wasOpen = detail.style.display === 'block'
                || slamDetail.style.display === 'block'
                || relicDetail.style.display === 'block';
            if (wasOpen) this._suppressNextClick = true;

            overlay.style.display     = 'none';
            detail.style.display      = 'none';
            slamDetail.style.display  = 'none';
            relicDetail.style.display = 'none';
            this.setDetailBackdrop(false);
            this._capViewer.hide();
            this._slammerViewer.hide();
        });

        // Central swallow: fanger click i CAPTURE-fasen (før nogen skærms egen
        // click-handler), så det klik der lukkede en popup ovenfor aldrig kan
        // nå frem til fx et shop-køb, et node-valg eller et reward-pick —
        // uanset hvilken skærm popup'en var åbnet fra.
        document.addEventListener('click', (e) => {
            if (this._suppressNextClick) {
                this._suppressNextClick = false;
                e.stopPropagation();
            }
        }, true);
    }

    _toggleOverlay(title, defs, lit, anchorEl, overlay) {
        if (overlay.style.display === 'block' &&
            overlay.dataset.anchor === anchorEl.id) {
            overlay.style.display = 'none';
            return;
        }
        overlay.dataset.anchor = anchorEl.id;

        document.getElementById('cap-overlay-title').textContent =
            title + (defs.length === 0 ? ' — ingen endnu' : ` (${defs.length})`);

        const dotsEl = document.getElementById('cap-overlay-dots');
        dotsEl.innerHTML = defs.map((entry, i) => {
            const def = entry.def ?? entry;
            if (def.texFront) {
                const ghostBadge  = entry.isGhost
                    ? `<span class="cap-thumb-ghost-badge">👻</span>` : '';
                const gsEntry     = entry.entryId != null
                    ? this._gameState?.ownedCaps.find(c => c.id === entry.entryId) : null;
                // Brug cappens EGEN entryId her — ikke gsEntry?.id, som er undefined
                // for caps uden en GameState-post (ghosts fra Twinsies) og derfor
                // ikke matcher hvad _roundCapBonuses rent faktisk er nøglet efter.
                const extraBase   = (gsEntry?.storedBonus ?? 0) + (this._getExtraBase?.(entry.entryId) ?? 0);
                const carryBadge  = extraBase > 0
                    ? `<span class="cap-thumb-carry-badge">+${extraBase}</span>` : '';
                // Destroyed (fx jackpot/martyr, destroy-ability-draft.md): en RIGTIG
                // cap (entryId >= 0, ikke en ghost's negative syntetiske id) der ikke
                // længere findes i ownedCaps er per definition destroyet — samme
                // gsEntry-opslag som carry-badgen ovenfor genbruges, intet nyt
                // tracking-state nødvendigt. Kun "Won caps"-overlayet (lit=true) kan
                // reelt vise dette, da destroySelf først evalueres efter flip.
                const isDestroyed = entry.entryId != null && entry.entryId >= 0 && !gsEntry;
                const destroyedBadge = isDestroyed
                    ? `<span class="cap-thumb-destroyed-badge" title="Destroyed — permanently removed">💥</span>` : '';
                // Exhausted (territorial, se destroy-ability-draft.md) — RoundManager
                // mærker cap-objektet direkte med isExhausted (samme mønster som
                // isGhost). Kun midlertidig, IKKE fjernet fra ownedCaps, så isDestroyed
                // ovenfor forbliver false for den — de to badges udelukker hinanden.
                const exhaustedBadge = entry.isExhausted
                    ? `<span class="cap-thumb-exhausted-badge" title="Exhausted — back next node">💤</span>` : '';
                return capThumbnailHTML(
                    { ...entry, enchant: this._liveEnchant(entry) },
                    { wrapClass: `cap-thumb${lit ? '' : ' dimmed'}`, imgClass: 'cap-thumb-img',
                      dimmed: !lit, extraAttrs: `data-idx="${i}" data-lit="${lit}"`,
                      innerHTML: ghostBadge + carryBadge + destroyedBadge + exhaustedBadge }
                );
            }
            const hex = '#' + (def.color ?? 0xaaaaaa).toString(16).padStart(6, '0');
            return `<span style="display:inline-block;width:40px;height:40px;border-radius:50%;
                    background:${hex};opacity:${lit ? 1 : 0.55};
                    border:2px solid rgba(255,255,255,0.15)"></span>`;
        }).join('');

        // bindTapSelect i stedet for rå pointerdown — #cap-overlay-dots scroller
        // (overflow-y:auto) når der er mange caps, og et rent pointerdown-tryk
        // fyrer FØR en scroll-gestus kan skelnes fra et tap, så et forsøg på at
        // scrolle forbi en cap åbnede den med det samme. Samme rodårsag/fix som
        // pause-panel og Mystixx-cap-vælgeren (se dem for referencen).
        bindTapSelect(dotsEl, '.cap-thumb', el => {
            this._showCapDetail(defs[+el.dataset.idx], el.dataset.lit === 'true');
        });

        const rect = anchorEl.getBoundingClientRect();
        if (rect.top < window.innerHeight / 2) {
            overlay.style.top    = (rect.bottom + 8) + 'px';
            overlay.style.bottom = 'auto';
        } else {
            overlay.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
            overlay.style.top    = 'auto';
        }
        if (rect.left < window.innerWidth / 2) {
            overlay.style.left  = Math.max(4, rect.left) + 'px';
            overlay.style.right = 'auto';
        } else {
            overlay.style.right = Math.max(4, window.innerWidth - rect.right) + 'px';
            overlay.style.left  = 'auto';
        }
        overlay.style.display = 'block';
    }

    // ─── COLLECTION OVERLAY ──────────────────────────────────────────────────
    openCollection(tab = 'caps') {
        const existing = document.getElementById('map-collection-overlay');
        if (existing) existing.remove();
        const gs = this._gameState;
        if (!gs) return;
        audio.play('overlay_open');

        const capsHTML = gs.ownedCaps.map(({ id, def, enchant }) => {
            const effectLabel = def.effect ? effectName(def.effect) : null;
            // Enchant har INGEN fast farve — individuel pr. enchant (ENCHANT_DEFS.color),
            // samme princip som cap-detail-enchant-badge. Viser også det rigtige
            // display-navn i stedet for den rå enchant-id-streng.
            const enchantDef  = enchant ? ENCHANT_DEFS.find(e => e.id === enchant) : null;
            const badges = [
                effectLabel ? `<span class="col-badge effect">${effectLabel}</span>` : '',
                enchantDef  ? `<span class="col-badge enchant" style="background:${enchantDef.color};color:#fff">${enchantDef.name}</span>` : '',
            ].join('');
            return `<div class="col-cap" data-cap-id="${id}">
                ${capThumbnailHTML({ id, def, enchant }, { imgClass: 'col-cap-img' })}
                <div class="col-cap-name">${def.name}</div>
                ${badges}
            </div>`;
        }).join('') || '<p style="padding:20px;color:#888;font-family:monospace">No caps yet.</p>';

        // Slammere: kun ejede — samme princip som Caps-fanen. Egen passive-
        // klasse (teal), IKKE ability-guld — de to må aldrig deles.
        const slammersHTML = gs.ownedSlammers.map(s => {
            const passiveBadge = s.passive
                ? `<span class="col-badge passive">${s.passive.icon} ${s.passive.name}</span>` : '';
            return `<div class="col-cap" data-slammer-name="${s.name}">
                <img class="col-cap-img" src="${s.texFront}" alt="${s.name}">
                <div class="col-cap-name">${s.name}</div>
                ${passiveBadge}
            </div>`;
        }).join('') || '<p style="padding:20px;color:#888;font-family:monospace">No slammers yet.</p>';

        const pips = Array.from({ length: THROWS_PER_ROUND }, () => `<span class="col-pip">●</span>`).join('');

        const overlay = document.createElement('div');
        overlay.id = 'map-collection-overlay';
        overlay.innerHTML = `
            <div class="map-collection-panel" data-tab="${tab}">
                <div class="col-tabbar">
                    <button class="col-tab ${tab === 'caps'     ? 'active' : ''}" data-target="caps">
                        Caps <span class="col-tab-count">${gs.ownedCaps.length}</span>
                    </button>
                    <button class="col-tab ${tab === 'slammers' ? 'active' : ''}" data-target="slammers">
                        Slammers <span class="col-tab-count">${gs.ownedSlammers.length}</span>
                    </button>
                    <button id="map-collection-close" class="col-close">✕</button>
                </div>
                <div class="col-content" data-content="caps"><div class="col-grid">${capsHTML}</div></div>
                <div class="col-content" data-content="slammers"><div class="col-grid">${slammersHTML}</div></div>
                <div class="col-footer">
                    <span class="col-footer-stat">Throws: ${pips}</span>
                    <span class="col-footer-stat">Max stack: <b>${gs.stackSizeLimit}</b></span>
                </div>
            </div>`;

        const closeOverlay = () => {
            audio.play('overlay_close');
            overlay.style.animation = 'screen-fade-out 0.18s ease-in forwards';
            overlay.style.pointerEvents = 'none';
            setTimeout(() => overlay.remove(), 180);
        };

        overlay.addEventListener('click', e => {
            if (e.target.closest('#map-collection-close')) { closeOverlay(); return; }
            const tabBtn = e.target.closest('.col-tab');
            if (tabBtn) {
                const t = tabBtn.dataset.target;
                overlay.querySelector('.map-collection-panel').dataset.tab = t;
                overlay.querySelectorAll('.col-tab').forEach(b =>
                    b.classList.toggle('active', b.dataset.target === t));
                return;
            }
            const capEl = e.target.closest('.col-cap[data-cap-id]');
            if (capEl) {
                const entry = gs.ownedCaps.find(o => o.id === +capEl.dataset.capId);
                if (entry) this._showCapDetail(entry, true);
                return;
            }
            const slammerEl = e.target.closest('.col-cap[data-slammer-name]');
            if (slammerEl) {
                // Slår op i den EJEDE instans (ikke det statiske SLAMMER_DEFS-entry) så
                // live-muterede passive-felter (fx Iron Disciplines voksende currentValue/
                // description) vises korrekt i stedet for den friske/uændrede def.
                const def = gs.ownedSlammers.find(s => s.name === slammerEl.dataset.slammerName);
                if (def) this._showSlammerDetail(def, true);
                return;
            }
            if (!e.target.closest('.map-collection-panel')) closeOverlay();
        });

        document.body.appendChild(overlay);
    }

    // ─── HJÆLP-MODAL ─────────────────────────────────────────────────────────
    _buildHelp() {
        const modal  = document.getElementById('help-modal');
        const btnOpen  = document.getElementById('help-btn');
        const btnClose = document.getElementById('help-close');

        const open  = () => modal.classList.add('open');
        const close = () => modal.classList.remove('open');

        btnOpen.addEventListener('pointerdown',  e => { e.stopPropagation(); open(); });
        btnClose.addEventListener('pointerdown', e => { e.stopPropagation(); close(); });

        // Klik på baggrunden (selve overlay-laget) lukker
        modal.addEventListener('pointerdown', e => {
            if (e.target === modal) close();
        });

        // Escape-tast lukker
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') close();
        });
    }

    // ─── PAUSE OVERLAY SETUP (én gang, persistent) ───────────────────────────
    _buildPauseOverlay() {
        const overlay = document.getElementById('pause-overlay');
        const panel   = document.getElementById('pause-panel');
        const hide    = () => this.hidePauseOverlay();

        document.getElementById('pause-btn')
            .addEventListener('pointerdown', e => { e.stopPropagation(); this.showPauseOverlay(); });

        // bindTapSelect i stedet for individuelle pointerdown-lyttere pr.
        // knap — #pause-panel scroller (overflow-y:auto) på lave viewports,
        // og et rent pointerdown-tryk fyrer FØR en scroll-gestus kan skelnes
        // fra et tap, så et forsøg på at scrolle forbi fx Retry ramte den med
        // det samme. Samme rodårsag/fix som Mystixx-cap-vælgerens mobil-bug.
        bindTapSelect(panel, 'button', btn => {
            switch (btn.id) {
                case 'pause-close':
                case 'pause-resume':
                    hide();
                    break;
                case 'pause-retry':
                    hide();
                    if (this.onPauseRetry) this.onPauseRetry();
                    break;
                case 'pause-tutorial':
                    hide();
                    this.openHelp();
                    break;
                case 'pause-fullscreen':
                    if (window._toggleFullscreen) window._toggleFullscreen();
                    break;
                case 'pause-mainmenu':
                    hide();
                    if (this.onPauseMainMenu) this.onPauseMainMenu();
                    break;
            }
        });

        // Klik på backdrop lukker
        overlay.addEventListener('pointerdown', e => {
            if (e.target === overlay) hide();
        });

        // Volume-slidere — sat til de gemte værdier (localStorage via AudioManager,
        // se _loadVolumes()) med det samme, ikke først når overlayet åbnes, så de
        // altid matcher rent faktisk gældende volumen fra allerførste render.
        const sfxSlider = document.getElementById('pause-vol-sfx');
        const bgmSlider = document.getElementById('pause-vol-bgm');
        sfxSlider.value = Math.round(audio.getSfxVolume() * 100);
        bgmSlider.value = Math.round(audio.getBgmVolume() * 100);
        // 'input' (ikke 'change') — live opdatering mens man trækker i sliderne,
        // ikke først når man slipper.
        sfxSlider.addEventListener('input', () => audio.setSfxVolume(sfxSlider.value / 100));
        bgmSlider.addEventListener('input', () => audio.setBgmVolume(bgmSlider.value / 100));
        // Sliderne ligger inde i #pause-panel, som allerede bruger bindTapSelect
        // (se ovenfor) til at undgå at scroll-forsøg fejlfortolkes som knap-tryk —
        // men det gælder KUN 'button'-elementer. Range-input skal kunne modtage
        // pointerdown uden at det boble videre til noget der lukker overlayet.
        sfxSlider.addEventListener('pointerdown', e => e.stopPropagation());
        bgmSlider.addEventListener('pointerdown', e => e.stopPropagation());
    }

    // ─── DETAIL BACKDROP ─────────────────────────────────────────────────────
    // Delt dæmpnings-lag bag cap/slammer/relic/consumable-detail (modals.css) —
    // kaldes fra alle steder der viser/skjuler en af disse popups, inklusive
    // deres egne action-knapper (BUY/PICK/TAKE/Sell), ikke kun klik-udenfor.
    // Offentlig (ikke længere _-præfikset) — genbruges nu også af
    // ConsumableSlots.js's reward/pack-pick-popup, på tværs af klasser.
    setDetailBackdrop(open) {
        document.getElementById('detail-backdrop')?.classList.toggle('open', open);
    }

    // Ny tilfældig skæv vinkel (2-3°, tilfældig side) hver gang en detail-popup
    // åbnes — samme --detail-rot-custom-property-mønster som
    // ConsumableSlots._openPopup() bruger for sin popup. Delt helper for
    // cap/slammer-detail, kaldt fra begge ved hver visning.
    _randomDetailRotation(el) {
        const deg = (2 + Math.random()) * (Math.random() < 0.5 ? -1 : 1);
        el.style.setProperty('--detail-rot', `${deg.toFixed(2)}deg`);
    }

    // ─── CAP DETAIL POPUP ────────────────────────────────────────────────────
    // action = { label, price, color, callback } — optional sticker button on viewer
    // opts.side = true → popup åbner til HØJRE (chest/mystery-rewards, hvor
    // selve kortet er forskudt mod venstre, se reward.css). Toggles ALTID
    // (både til og fra) så klassen aldrig kan "lække" ind i andre kontekster
    // — #cap-detail er globalt og bruges centreret alle andre steder.
    showCapDetail(capOrEntry, lit = false, action = null, opts = {}) { this._showCapDetail(capOrEntry, lit, action, opts); }

    _showCapDetail(capOrEntry, lit, action = null, opts = {}) {
        const def     = capOrEntry.def ?? capOrEntry;
        const enchant = capOrEntry.enchant ?? null;
        // opts.previewEnchant (enchant-reward-forhåndsvisning) vinder over den
        // NUVÆRENDE enchant for TEKST/badge-visning — spilleren skal se hvad
        // de er ved at VÆLGE, ikke hvad cappen allerede har. Den 3D-mønt
        // crossfader stadig fra den faktiske nuværende tilstand (inkl. evt.
        // gammel enchant, se show() nedenfor) til den nye.
        const displayEnchant = opts.previewEnchant ?? enchant;

        const detail    = document.getElementById('cap-detail');
        const nameEl    = document.getElementById('cap-detail-name');
        const actionEl  = document.getElementById('cap-detail-action');

        // Samme fix som pile-overlayet: brug cappens/entryens EGEN id, ikke
        // gsEntry2?.id — ellers matcher ghosts (uden GameState-post) aldrig.
        const gsEntry2     = capOrEntry.entryId != null
            ? this._gameState?.ownedCaps.find(c => c.id === capOrEntry.entryId)
            : (capOrEntry.storedBonus != null ? capOrEntry : null);
        const storedBonus2 = gsEntry2?.storedBonus ?? 0;
        const lookupId2    = capOrEntry.entryId ?? capOrEntry.id ?? null;
        const extraBase2   = storedBonus2 + (this._getExtraBase?.(lookupId2) ?? 0);

        // +N base-badgen hører til NAVNET (bonus til cappens værdi, ikke til
        // dens ability) og står derfor i navne-rækken, som ALTID renderes —
        // ability-boksen renderes kun når def.effect findes, så en simpel
        // common uden ability ville ellers ikke have noget sted at vise en
        // stored bonus fra crew/rally/voltage.
        nameEl.innerHTML = def.name
            + (extraBase2 > 0 ? ` <span class="cap-detail-extra-base">+${extraBase2} base</span>` : '');

        const seriesDef = getSeriesDef(def.series);
        const pillEl = document.getElementById('cap-detail-series-pill');
        pillEl.innerHTML          = `${seriesDef.icon} ${seriesDef.label}`;
        pillEl.style.background   = `${seriesDef.color}22`; // let tonet baggrund (13% alpha)
        pillEl.style.color        = seriesDef.color;
        pillEl.style.borderColor  = `${seriesDef.color}55`;

        // Fast guld — ability-kategori-farve, samme som col-badge.effect/.reward-effect.
        const ABILITY_COLOR = '#f5c842';

        const abilitySlot = document.getElementById('cap-detail-ability-slot');
        abilitySlot.innerHTML = def.effect
            ? abilityBoxHTML({
                  color:       ABILITY_COLOR,
                  name:        effectName(def.effect),
                  description: effectDesc(def.effect),
              })
            : '';

        const enchantSlot = document.getElementById('cap-detail-enchant-slot');
        const enchantDefForBox = displayEnchant ? ENCHANT_DEFS.find(e => e.id === displayEnchant) : null;
        const currentEnchantDef = enchant ? ENCHANT_DEFS.find(e => e.id === enchant) : null;
        // Forhåndsvisning der ERSTATTER en enchant capen allerede har: vis
        // BEGGE bokse SIDE OM SIDE (ikke stablet ovenpå hinanden) — spillet
        // spilles kun i landscape, så bredde er den rigelige ressource og
        // højde den knappe. En stablet version gjorde popup'en højere og
        // risikerede at klippe PICK-knappen ud i bunden på korte viewports;
        // en vandret række med pil imellem (samme mønster som showEnchantResult's
        // før→efter-billeder) koster næsten ingen ekstra højde.
        if (opts.previewEnchant && currentEnchantDef && currentEnchantDef.id !== enchantDefForBox.id) {
            enchantSlot.innerHTML = `
                <div class="cap-detail-enchant-compare">
                    <div class="cap-detail-enchant-compare-box">
                        ${abilityBoxHTML({
                            color:       currentEnchantDef.color,
                            name:        `${currentEnchantDef.icon} ${currentEnchantDef.name}`,
                            description: currentEnchantDef.description,
                            extraClass:  'ability-box--replaced',
                        })}
                    </div>
                    <span class="cap-detail-enchant-compare-arrow">→</span>
                    <div class="cap-detail-enchant-compare-box">
                        ${abilityBoxHTML({
                            color:       enchantDefForBox.color,
                            name:        `${enchantDefForBox.icon} ${enchantDefForBox.name}`,
                            description: enchantDefForBox.description,
                        })}
                    </div>
                </div>`;
        } else enchantSlot.innerHTML = enchantDefForBox
            ? abilityBoxHTML({
                  color:       enchantDefForBox.color,
                  description: enchantDefForBox.description,
                  // bevidst INTET name-felt her — enchant-navnet er allerede
                  // synligt som ikon-badge på selve 3D-mønten (cap-detail-
                  // enchant-badge nedenfor).
              })
            : '';

        const rarityEl = document.getElementById('cap-detail-rarity');
        if (rarityEl) {
            const RARITY_MAP = { 1: ['common', 'Common'], 2: ['uncommon', 'Uncommon'], 3: ['rare', 'Rare'], 4: ['legendary', 'Legendary'] };
            const [cls, label] = RARITY_MAP[def.rarity ?? 1] ?? ['common', 'Common'];
            rarityEl.className   = `rarity--${cls}`;
            rarityEl.textContent = label;
        }

        detail.classList.toggle('cap-detail--side', !!opts.side);

        if (action) {
            actionEl.innerHTML         = `${action.label}${action.price ? `<br>${action.price}` : ''}`;
            actionEl.style.background  = action.color ?? 'var(--clr-red)';
            actionEl.style.color       = action.textColor ?? '#fff';
            actionEl.style.display     = '';
            // Replace node to drop any previous listener
            const fresh = actionEl.cloneNode(true);
            actionEl.parentNode.replaceChild(fresh, actionEl);
            fresh.addEventListener('click', e => {
                e.stopPropagation();
                detail.style.display = 'none';
                this.setDetailBackdrop(false);
                this._capViewer.hide();
                action.callback();
            });
        } else {
            actionEl.style.display = 'none';
        }

        // 2D enchant badge on top of the 3D viewer
        let badgeEl = document.getElementById('cap-detail-enchant-badge');
        if (!badgeEl) {
            badgeEl = document.createElement('div');
            badgeEl.id = 'cap-detail-enchant-badge';
            document.querySelector('.cap-viewer-wrap').appendChild(badgeEl);
        }
        if (enchantDefForBox) {
            badgeEl.textContent   = enchantDefForBox.icon;
            badgeEl.style.background = enchantDefForBox.color;
            badgeEl.style.display = '';
        } else {
            badgeEl.style.display = 'none';
        }

        // Destroyed/exhausted status-sticker — top-right (enchant-badgen ovenfor
        // sidder top-left). Samme deriverings-logik som pile-overlayet: isDestroyed
        // er en RIGTIG cap (entryId >= 0) der ikke længere findes i ownedCaps;
        // isExhausted er en direkte property sat af RoundManager (ligesom isGhost).
        let statusEl = document.getElementById('cap-detail-status-badge');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'cap-detail-status-badge';
            document.querySelector('.cap-viewer-wrap').appendChild(statusEl);
        }
        const isDestroyed2 = capOrEntry.entryId != null && capOrEntry.entryId >= 0 && !gsEntry2;
        if (isDestroyed2) {
            statusEl.innerHTML        = '💥 DESTROYED';
            statusEl.title            = 'Destroyed — permanently removed';
            statusEl.style.background = '#1a1a1a';
            statusEl.style.display    = '';
        } else if (capOrEntry.isExhausted) {
            statusEl.innerHTML        = '💤 EXHAUSTED';
            statusEl.title            = 'Exhausted — back next node';
            statusEl.style.background = '#3c3c50';
            statusEl.style.display    = '';
        } else {
            statusEl.style.display = 'none';
        }

        // Ved forhåndsvisning bygges mønten UDEN sin egen statiske enchant-
        // overlay (enchant:null) — previewEnchant() nedenfor tager sig af BÅDE
        // den gamle (hvis nogen) og den nye, krydsblændet, så den gamle rent
        // faktisk forsvinder når den nye kommer frem i stedet for at stå
        // oveni den (to samtidige overlays ville ellers se ud som "begge
        // enchants på én gang", ikke en erstatning).
        const capViewerShown = this._capViewer.show(def, 'cap', opts.previewEnchant ? null : enchant);
        if (opts.previewEnchant) capViewerShown.then(() => this._capViewer.previewEnchant(opts.previewEnchant, enchant));
        this._randomDetailRotation(detail);
        detail.style.display = 'block';
        this.setDetailBackdrop(true);
    }

    // ─── RELIC / CARD DETAIL POPUP ───────────────────────────────────────────
    // item = { icon, name, description }   action = { label, price, color, callback }
    showRelicDetail(item, action = null) {
        const detail    = document.getElementById('relic-detail');
        const iconEl    = document.getElementById('relic-detail-icon');
        const nameEl    = document.getElementById('relic-detail-name');
        const descEl    = document.getElementById('relic-detail-desc');
        const actionEl  = document.getElementById('relic-detail-action');

        iconEl.textContent = item.icon ?? '';
        nameEl.textContent = item.name ?? '';
        descEl.textContent = item.description ?? '';

        if (action) {
            actionEl.innerHTML        = `${action.label}${action.price ? ` · ${action.price}` : ''}`;
            actionEl.style.background = action.color ?? '#000';
            actionEl.style.color      = action.textColor ?? '#fff';
            actionEl.style.display    = '';
            const fresh = actionEl.cloneNode(true);
            actionEl.parentNode.replaceChild(fresh, actionEl);
            fresh.addEventListener('click', e => {
                e.stopPropagation();
                detail.style.display = 'none';
                this.setDetailBackdrop(false);
                action.callback();
            });
        } else {
            actionEl.style.display = 'none';
        }

        detail.style.display = 'block';
        this.setDetailBackdrop(true);
    }

    // ─── SLAMMER DETAIL POPUP ────────────────────────────────────────────────
    // action = { label, price, color, callback } — samme mønster som showCapDetail,
    // for inspektion-før-valg i reward/shop-kontekster (adskilt fra showEquip's
    // faste Equip/Sell-knapper, som kun bruges fra Collection).
    // opts.side = true → samme chest/mystery-højreforskydning som showCapDetail.
    showSlammerDetail(def, showEquip = false, action = null, opts = {}) { this._showSlammerDetail(def, showEquip, action, opts); }

    _showSlammerDetail(def, showEquip = false, action = null, opts = {}) {
        const detail = document.getElementById('slammer-detail');
        const nameEl = document.getElementById('slammer-detail-name');

        nameEl.textContent = def.name;

        this._slammerViewer.show(def, 'slammer');
        this._renderSlammerStats(def);
        this._randomDetailRotation(detail);
        detail.style.display = 'block';
        this.setDetailBackdrop(true);
        detail.classList.toggle('slammer-detail--side', !!opts.side);

        const rarityEl = document.getElementById('slammer-detail-rarity');
        if (rarityEl) {
            const RARITY_MAP = { 1: ['common', 'Common'], 2: ['uncommon', 'Uncommon'], 3: ['rare', 'Rare'], 4: ['legendary', 'Legendary'] };
            const [cls, label] = RARITY_MAP[def.rarity ?? 1] ?? ['common', 'Common'];
            rarityEl.className   = `rarity--${cls}`;
            rarityEl.textContent = label;
        }

        const actionEl = document.getElementById('slammer-detail-action');
        if (actionEl) {
            if (action) {
                actionEl.innerHTML         = `${action.label}${action.price ? `<br>${action.price}` : ''}`;
                actionEl.style.background  = action.color ?? 'var(--clr-red)';
                actionEl.style.color       = action.textColor ?? '#fff';
                actionEl.style.display     = '';
                // Replace node to drop any previous listener
                const fresh = actionEl.cloneNode(true);
                actionEl.parentNode.replaceChild(fresh, actionEl);
                fresh.addEventListener('click', e => {
                    e.stopPropagation();
                    detail.style.display = 'none';
                    this.setDetailBackdrop(false);
                    this._slammerViewer.hide();
                    action.callback();
                });
            } else {
                actionEl.style.display = 'none';
            }
        }

        // Passiv-info — erstatning for det tidligere relic-system, se
        // docs/slammer-passives-draft.md. Genbruger abilityBoxHTML() fra cap-
        // detail-redesignet, MEN beholder navnet i boksen (i modsætning til
        // enchant-boksen) — der findes intet ikon-overlay på selve slammer-
        // mønten der allerede viser hvilken passiv det er.
        const PASSIVE_COLOR = '#2e8fa3';
        const passiveSlot = document.getElementById('slammer-detail-passive-slot');
        if (passiveSlot) {
            let desc = def.passive?.description ?? '';
            // Analog/Digital Timer — regner "N kast til næste trigger" live ud fra
            // GameState.runThrowCount (den run-persistente tæller), så spilleren
            // ikke skal huske/holde styr på det selv.
            if (def.passive && (def.passive.type === 'analogTimer' || def.passive.type === 'digitalTimer') && this._gameState) {
                const interval  = def.passive.interval;
                const done      = this._gameState.runThrowCount ?? 0;
                const remaining = interval - (done % interval);
                desc += ` · ${remaining} throw${remaining === 1 ? '' : 's'} until next trigger`;
            }
            passiveSlot.innerHTML = def.passive
                ? abilityBoxHTML({
                      color:       PASSIVE_COLOR,
                      name:        `${def.passive.icon} ${def.passive.name}`,
                      description: desc,
                  })
                : '';
        }

        const equipBtn = document.getElementById('slammer-equip-btn');
        if (equipBtn) {
            if (!showEquip) {
                equipBtn.style.display = 'none';
            } else {
                const isEquipped = SLAMMER_DEFS[this._slammerIdx]?.name === def.name;
                equipBtn.textContent = isEquipped ? 'Equipped ✓' : 'Equip';
                equipBtn.disabled    = isEquipped;
                equipBtn.style.display = '';
                equipBtn.onclick = () => {
                    const idx = SLAMMER_DEFS.findIndex(s => s.name === def.name);
                    if (idx === -1) return;
                    this._slammerIdx = idx;
                    const slamNameEl = document.getElementById('slam-name');
                    if (slamNameEl) slamNameEl.textContent = def.name;
                    if (this.onSlammerChange) this.onSlammerChange(def);
                    equipBtn.textContent = 'Equipped ✓';
                    equipBtn.disabled    = true;
                };
            }
        }

        // Sælg — kun muligt hvis man rent faktisk ejer slammeren (jf. relic-erstatningen).
        const sellBtn = document.getElementById('slammer-sell-btn');
        if (sellBtn) {
            const owned = showEquip && (this._gameState?.hasSlammer(def.name) ?? false);
            if (owned) {
                sellBtn.textContent   = `Sell (+${def.sellPrice ?? 0}★)`;
                sellBtn.style.display = '';
                sellBtn.onclick = () => {
                    this._gameState.sellSlammer(def.name);
                    this.setScore(this._gameState.score);
                    detail.style.display = 'none';
                    this.setDetailBackdrop(false);
                    // Genopfrisk collection-oversigten hvis den er åben, så ejerskabet opdateres
                    if (document.getElementById('map-collection-overlay')) this.openCollection('slammers');
                };
            } else {
                sellBtn.style.display = 'none';
            }
        }
    }

    _renderSlammerStats(def) {
        const el = document.getElementById('slammer-detail-stats');
        if (!el) return;
        const rows = [
            { label: 'Power',     pips: def.rating.power     },
            { label: 'Precision', pips: def.rating.precision },
            { label: 'Weight',    pips: def.rating.weight    },
        ];
        el.innerHTML = rows.map(({ label, pips }) => {
            const dots = Array.from({ length: 5 }, (_, i) =>
                `<span class="stat-pip${i < pips ? ' filled' : ''}"></span>`
            ).join('');
            return `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-pips">${dots}</span></div>`;
        }).join('');
    }

    // Fælles mount for de "sticker"-resultat-popups (enchant/transform/blanco):
    // klik ØVERALT på skærmen skipper dem hurtigere — ikke kun et klik ramt
    // præcis på selve stickeren — og det klik sluges centralt (samme
    // _suppressNextClick-mekanisme som cap-detail bruger) så det ikke også
    // rammer noget bagved.
    _mountDismissableSticker(el, duration, onDismiss = null) {
        document.body.appendChild(el);
        let timer;
        const cleanup = () => {
            clearTimeout(timer);
            document.removeEventListener('pointerdown', onAnyPointerdown);
        };
        const dismiss = () => {
            cleanup();
            el.classList.add('enchant-result-sticker--out');
            if (onDismiss) onDismiss();
        };
        const onAnyPointerdown = () => {
            this._suppressNextClick = true;
            dismiss();
        };
        timer = setTimeout(dismiss, duration);
        // Udskudt til næste tick — ellers fanger denne listener det SAMME klik
        // der lige åbnede stickeren (kaldet der udløste den kan stadig være
        // midt i sin egen pointerdown-bobling, fx via showCapPicker).
        setTimeout(() => document.addEventListener('pointerdown', onAnyPointerdown), 0);
        el.addEventListener('animationend', e => { if (e.animationName === 'enchant-result-out') el.remove(); });
    }

    // Boss-info-sticker fra kortet — klik hvor som helst (eller vent) skjuler den
    // igen, ligesom enchant/transform-resultaterne. Ren info, ingen handling.
    showBossInfoSticker(bossDef) {
        const el = document.createElement('div');
        el.className = 'enchant-result-sticker';
        const penaltyText = this._noGlamFamPenaltyText(bossDef);
        el.innerHTML = `
            <div class="enchant-result-icon" style="background:#7a1f28;font-size:32px;padding:14px 12px 10px;text-align:center;color:#fff;">${bossDef.icon}</div>
            <div class="enchant-result-name" style="color:#7a1f28;">${bossDef.name}</div>
            <div class="enchant-result-desc">${bossDef.description}</div>
            ${penaltyText ? `<div class="boss-penalty-live">${penaltyText}</div>` : ''}`;
        this._mountDismissableSticker(el, 5000);
    }

    // Shop lige før en boss-node — "sidste chance for at bruge ★"-advarslen.
    // Var tidligere et permanent inline-element i selve shop-layoutet (et
    // bredt banner presset ind i en grid der ikke havde plads til det, se
    // ShopScreen._buildHTML) — nu samme dismissable fade-ind/ud-sticker-
    // mekanik som boss/Trick Shot-info-stickeren. Vises automatisk ÉN gang
    // ved ankomst til shoppen (kaldes fra enter(), ikke fra hvert render), da
    // advarslen ikke må kunne overses bag et klik ligesom de andre.
    showBossShopWarning(bossDef) {
        const el = document.createElement('div');
        el.className = 'enchant-result-sticker';
        el.innerHTML = `
            <div class="enchant-result-icon" style="background:#7a1f28;font-size:26px;padding:14px 12px 10px;text-align:center;color:#fff;">⚠</div>
            <div class="enchant-result-name" style="color:#7a1f28;">Last chance!</div>
            <div class="enchant-result-desc">${bossDef.name} resets your score to 0 — spend your ★ now.</div>`;
        this._mountDismissableSticker(el, 5000);
    }

    // Node-reward-info-sticker fra kortet — samme mekanik som boss/Trick Shot-
    // info-stickeren. Ren info om hvad reward-badgen på selve node-cirklen
    // (silver/gold/enchant/mystery) rent faktisk dækker over.
    showRewardInfoSticker(rewardType) {
        const el    = document.createElement('div');
        el.className = 'enchant-result-sticker';
        const icon  = REWARD_TYPE_ICONS[rewardType] ?? '✦';
        const label = REWARD_TYPE_LABELS[rewardType] ?? 'Reward';
        const desc  = REWARD_TYPE_DESCRIPTIONS[rewardType] ?? '';
        el.innerHTML = `
            <div class="enchant-result-icon" style="background:#1a1a1a;font-size:32px;padding:14px 12px 10px;text-align:center;color:#fff;">${icon}</div>
            <div class="enchant-result-name">${label}</div>
            <div class="enchant-result-desc">${desc}</div>`;
        this._mountDismissableSticker(el, 4500);
    }

    // Slammer-loft ramt (MAX_OWNED_SLAMMERS) — dismissable sticker med en direkte
    // genvej til Collection, så spilleren kan sælge en slammer og gøre plads
    // uden at forlade det underliggende reward/pakke-flow (som ligger urørt bag
    // denne body-level overlay og bare venter på samme klik igen).
    showMaxSlammersMessage() {
        const el = document.createElement('div');
        el.className = 'enchant-result-sticker';
        el.innerHTML = `
            <div class="enchant-result-icon" style="background:#7a1f28;font-size:26px;padding:14px 12px 10px;text-align:center;color:#fff;">⚠</div>
            <div class="enchant-result-name" style="color:#7a1f28;">Max Slammers reached</div>
            <div class="enchant-result-desc">Sell one to make room.</div>
            <button id="max-slammers-sell-btn" class="reward-quick-pick" style="display:block;margin:0 auto 14px;">▶ SELL A SLAMMER</button>`;
        document.body.appendChild(el);

        let timer;
        const cleanup = () => { clearTimeout(timer); document.removeEventListener('pointerdown', onOutsidePointerdown); };
        const dismiss = () => { cleanup(); el.classList.add('enchant-result-sticker--out'); };
        const onOutsidePointerdown = e => {
            if (e.target.closest('#max-slammers-sell-btn')) return; // knappen håndterer sit eget klik
            this._suppressNextClick = true;
            dismiss();
        };
        timer = setTimeout(dismiss, 6000);
        setTimeout(() => document.addEventListener('pointerdown', onOutsidePointerdown), 0);
        el.addEventListener('animationend', e => { if (e.animationName === 'enchant-result-out') el.remove(); });

        el.querySelector('#max-slammers-sell-btn').addEventListener('pointerdown', e => {
            e.stopPropagation();
            this._suppressNextClick = true;
            dismiss();
            this.openCollection('slammers');
        });
    }

    // Cap-loft ramt (MAX_OWNED_CAPS) — rent informativ, ingen handling: rewarden
    // er allerede konverteret til ★ af GameState.compensateFullCollection().
    showCollectionFullMessage(amount) {
        const el = document.createElement('div');
        el.className = 'enchant-result-sticker';
        el.innerHTML = `
            <div class="enchant-result-icon" style="background:#1a1a1a;font-size:26px;padding:14px 12px 10px;text-align:center;color:#fff;">🎒</div>
            <div class="enchant-result-name">Collection full</div>
            <div class="enchant-result-desc">Converted to +${amount}★ instead.</div>`;
        this._mountDismissableSticker(el, 3500);
    }

    // Trick Shot-info-sticker fra kortet — samme mekanik som boss-info-stickeren.
    // Ren info (navn/beskrivelse/pris), ingen handling — kun "⚡"-knappen i
    // action-baren rent faktisk starter forsøget.
    showTrickShotInfoSticker(trickShotDef) {
        const el = document.createElement('div');
        el.className = 'enchant-result-sticker';
        const rewardIcon  = REWARD_TYPE_ICONS[trickShotDef.rewardType] ?? '✦';
        const rewardLabel = REWARD_TYPE_LABELS[trickShotDef.rewardType] ?? 'Enchant';
        el.innerHTML = `
            <div class="enchant-result-icon" style="background:#f5c842;font-size:32px;padding:14px 12px 10px;text-align:center;color:#000;">${trickShotDef.icon}</div>
            <div class="enchant-result-name" style="color:#a68000;">${trickShotDef.name}</div>
            <div class="enchant-result-desc">${trickShotDef.description} (−${trickShotDef.cost}★)</div>
            <div class="trickshot-reward-bonus">${rewardIcon} Reward upgrade: ${rewardLabel}</div>`;
        this._mountDismissableSticker(el, 5000);
    }

    showEnchantResult(enchantDef, capEntry = null) {
        const el = document.createElement('div');
        el.className = 'enchant-result-sticker';
        el.style.setProperty('--enchant-color', enchantDef.color);

        const capRowHTML = capEntry?.def?.texFront ? `
            <div class="enchant-result-icon" style="background:${enchantDef.color};display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 12px 10px;">
                ${capThumbnailHTML({ def: capEntry.def, enchant: null },
                    { imgClass: 'transform-result-img transform-result-img--old' })}
                <span style="font-size:22px;opacity:0.7;">→</span>
                ${capThumbnailHTML({ def: capEntry.def, enchant: enchantDef.id },
                    { imgClass: 'transform-result-img' })}
            </div>` : `<div class="enchant-result-icon">${enchantDef.icon}</div>`;

        el.innerHTML = `
            ${capRowHTML}
            <div class="enchant-result-name">${enchantDef.name}</div>
            <div class="enchant-result-desc">${enchantDef.description}</div>`;
        this._mountDismissableSticker(el, 2600);
    }

    showBlancoResult(count, onOpen) {
        const el = document.createElement('div');
        el.className = 'enchant-result-sticker transform-result-sticker';
        el.innerHTML = `
            <div class="enchant-result-icon" style="background:#222;font-size:36px;padding:14px 12px 10px;text-align:center;">🃏</div>
            <div class="enchant-result-name" style="color:#222;">BLANCO</div>
            <div class="enchant-result-desc">All ${count} caps rerolled — opening collection…</div>`;
        this._mountDismissableSticker(el, 1400, onOpen);
    }

    showTransformResult(oldDef, newDef, onDismiss = null) {
        const el = document.createElement('div');
        el.className = 'enchant-result-sticker transform-result-sticker';
        el.innerHTML = `
            <div class="enchant-result-icon" style="background:#5a7a20;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 12px 10px;">
                <img src="${oldDef.texFront}" class="transform-result-img transform-result-img--old">
                <span style="font-size:22px;opacity:0.7;">→</span>
                <img src="${newDef.texFront}" class="transform-result-img">
            </div>
            <div class="enchant-result-name" style="color:#5a7a20;">${newDef.name}</div>
            <div class="enchant-result-desc">${newDef.series?.replace(/_/g, ' ') ?? ''}</div>`;
        this._mountDismissableSticker(el, 2600, onDismiss);
    }

    // Cap-picker overlay: shows all owned caps, calls onPick(entry) when one is tapped
    showCapPicker(title, entries, onPick) {
        document.getElementById('cap-picker-overlay')?.remove();

        const grid = entries.map(entry =>
            capThumbnailHTML(entry, {
                wrapClass: 'cap-picker-thumb',
                imgClass:  'cap-thumb-img',
                innerHTML: `<div class="cap-picker-name">${(entry.def ?? entry).name}</div>`,
            })
        ).join('');

        const el = document.createElement('div');
        el.id = 'cap-picker-overlay';
        el.innerHTML = `
            <div id="cap-picker-panel">
                <div class="cap-picker-header">
                    <span>${title}</span>
                    <button id="cap-picker-close">✕</button>
                </div>
                <div id="cap-picker-grid">${grid}</div>
            </div>`;
        document.body.appendChild(el);

        el.querySelector('#cap-picker-close').addEventListener('click', () => el.remove());
        // Baggrunds-luk uændret — kun selve tap-valget er ramt af scroll-vs-tap-buggen.
        el.addEventListener('pointerdown', e => {
            if (!e.target.closest('.cap-picker-thumb[data-cap-id]') && e.target === el) el.remove();
        });
        // pointerdown alene fyrer i samme øjeblik fingeren rammer skærmen — før
        // browseren har afgjort om det er et tap eller starten på en scroll-
        // gestus. bindTapSelect kræver at pointerup lander på samme element
        // UDEN nævneværdig bevægelse, så et scroll i listen ikke rammer en
        // tilfældig cap under fingeren.
        bindTapSelect(el, '.cap-picker-thumb[data-cap-id]', thumb => {
            const entry = entries.find(c => c.id === +thumb.dataset.capId);
            if (entry) { el.remove(); onPick(entry); }
        });
    }

    // Resolve current enchant — prefers live ownedCaps lookup over snapshot value
    _liveEnchant(entry) {
        const entryId = entry.entryId ?? entry.id ?? null;
        if (entryId != null && this._gameState) {
            const live = this._gameState.ownedCaps.find(c => c.id === entryId);
            if (live) return live.enchant;
        }
        return entry.enchant ?? null;
    }

}
