// ============================================================
// ChemQuiz — app.js
// ============================================================

const TIMER_SECONDS = 10;
const COLLECTION = 'submissions';
const TIMER_CIRC = 213.6;   // 2 * Math.PI * 34
const SCORE_CIRC = 326.7;   // 2 * Math.PI * 52

// ── State ──────────────────────────────────────────────────
let db = null;
let lbUnsubscribe = null;
let state = {
  usn: '', name: '',
  currentQ: 0,
  answers: [],
  timeSpent: [],         // seconds spent per question
  timerVal: TIMER_SECONDS,
  timerInterval: null,
  startTime: null,
  currentUSN_score: null
};

// ── Init ───────────────────────────────────────────────────
function initWaveAnimation() {
  const canvas = document.getElementById('wave-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let time = 0;
  const waveData = Array.from({ length: 8 }).map(() => ({
    value: Math.random() * 0.5 + 0.1,
    targetValue: Math.random() * 0.5 + 0.1,
    speed: Math.random() * 0.02 + 0.01
  }));

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function updateWaveData() {
    waveData.forEach(data => {
      if (Math.random() < 0.01) data.targetValue = Math.random() * 0.7 + 0.1;
      const diff = data.targetValue - data.value;
      data.value += diff * data.speed;
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    waveData.forEach((data, i) => {
      const freq = data.value * 7;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x++) {
        const nx = (x / canvas.width) * 2 - 1;
        const px = nx + i * 0.04 + freq * 0.03;
        const py = Math.sin(px * 10 + time) * Math.cos(px * 2) * freq * 0.1 * ((i + 1) / 8);
        const y = (py + 1) * canvas.height / 2;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      const intensity = Math.min(1, freq * 0.3);
      const r = 79 + intensity * 100;
      const g = 70 + intensity * 130;
      const b = 229;
      ctx.lineWidth = 1 + i * 0.3;
      ctx.strokeStyle = `rgba(${r},${g},${b},0.6)`;
      ctx.shadowColor = `rgba(${r},${g},${b},0.5)`;
      ctx.shadowBlur = 5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }

  function animate() {
    time += 0.02;
    updateWaveData();
    draw();
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  animate();
}

window.addEventListener('DOMContentLoaded', () => {
  initWaveAnimation();
  document.getElementById('q-count-badge').textContent = `${QUESTIONS.length} Questions`;
  document.getElementById('usn-input').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase();
    document.getElementById('login-error').classList.add('hidden');
  });

  if (!FIREBASE_CONFIGURED) {
    showToast('⚠️ Firebase not configured — scores won\'t be saved across devices');
  } else {
    try {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
    } catch (err) {
      console.error('Firebase init error:', err);
      showToast('Firebase error — check console');
    }
  }
});

// ── View routing ───────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(`view-${name}`);
  if (el) { el.classList.add('active'); el.scrollTop = 0; window.scrollTo(0,0); }
}

// ── Login ──────────────────────────────────────────────────
async function handleLogin() {
  const usn = document.getElementById('usn-input').value.trim().toUpperCase();
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('start-btn');

  if (!usn) {
    showError(errEl, '⚠️ Please enter your USN.'); return;
  }
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Checking…';

  // Name lookup
  const name = getStudentName(usn);

  // Check Firestore for existing completed attempt
  if (db) {
    try {
      const doc = await db.collection(COLLECTION).doc(usn).get();
      if (doc.exists) {
        const data = doc.data();
        if (data.completed) {
          btn.disabled = false; btn.querySelector('span').textContent = 'Start Quiz';
          showAlreadyAttempted(data); return;
        }
        // In-progress in Firestore — resume
        btn.disabled = false; btn.querySelector('span').textContent = 'Start Quiz';
        state.usn = usn; state.name = name || usn;
        showResumeModal(data); return;
      }
    } catch (err) {
      console.error('Firestore read error:', err);
    }
  } else {
    // Fallback: localStorage check
    const saved = localStorage.getItem(`cq_progress_${usn}`);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.completed) {
        btn.disabled = false; btn.querySelector('span').textContent = 'Start Quiz';
        showAlreadyAttempted(data); return;
      }
      btn.disabled = false; btn.querySelector('span').textContent = 'Start Quiz';
      state.usn = usn; state.name = name || usn;
      showResumeModal(data); return;
    }
  }

  btn.disabled = false; btn.querySelector('span').textContent = 'Start Quiz';
  state.usn = usn;
  state.name = name || usn;
  startFreshQuiz();
}

function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }

// ── Already Attempted ──────────────────────────────────────
function showAlreadyAttempted(data) {
  state.currentUSN_score = data.score;
  showModal('🔒', 'Already Attempted',
    `You have already completed this quiz.\n\n📊 Your Score: ${data.score}/${QUESTIONS.length}\n⏱ Time Taken: ${data.timeTaken}\n📅 Submitted: ${data.submittedAt}`,
    [
      { label: '🏆 View Leaderboard', action: 'showLeaderboard()', primary: true },
      { label: 'Close', action: 'closeModal()' }
    ]
  );
}

// ── Resume Modal ───────────────────────────────────────────
function showResumeModal(data) {
  showModal('▶️', 'Resume Quiz?',
    `You left the quiz at Question ${data.currentQ + 1}. Would you like to continue from where you left off?`,
    [
      { label: '▶️ Resume', action: 'resumeQuiz()', primary: true },
      { label: '🔄 Start Fresh', action: 'startFreshQuiz()' }
    ]
  );
  // Store resume data globally
  window._resumeData = data;
}

function resumeQuiz() {
  closeModal();
  const d = window._resumeData;
  if (!d) { startFreshQuiz(); return; }
  state.currentQ = d.currentQ || 0;
  state.answers = d.answers || new Array(QUESTIONS.length).fill(null);
  state.timeSpent = d.timeSpent || [];
  state.startTime = d.startTime || Date.now();
  beginQuiz();
}

function startFreshQuiz() {
  closeModal();
  state.currentQ = 0;
  state.answers = new Array(QUESTIONS.length).fill(null);
  state.timeSpent = [];
  state.startTime = Date.now();
  beginQuiz();
}

// ── Quiz ───────────────────────────────────────────────────
function beginQuiz() {
  showView('quiz');
  document.getElementById('quiz-student-name').textContent = state.name;
  document.getElementById('student-avatar').textContent = state.name.charAt(0).toUpperCase();
  renderQuestion();
}

function renderQuestion() {
  const q = QUESTIONS[state.currentQ];
  const total = QUESTIONS.length;
  const idx = state.currentQ;

  // Header meta
  document.getElementById('question-counter').textContent = `Q ${idx + 1} / ${total}`;
  document.getElementById('question-badge').textContent = `Question ${idx + 1}`;

  // Progress bar
  const pct = Math.round((idx / total) * 100);
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-label').textContent = pct + '%';

  // Question text
  document.getElementById('question-text').textContent = q.question;

  // Options
  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  const labels = ['A', 'B', 'C', 'D'];
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.id = `opt-${i}`;
    btn.innerHTML = `<span class="option-label">${labels[i]}</span><span>${opt}</span>`;
    btn.onclick = () => selectAnswer(i);
    grid.appendChild(btn);
  });

  // Next button
  const nextBtn = document.getElementById('next-btn');
  nextBtn.disabled = true;
  document.getElementById('next-btn-label').textContent = 'Select an answer';

  // Footer info
  const answered = state.answers.filter(a => a !== null).length;
  document.getElementById('answered-info').textContent = `${answered} of ${total} answered`;

  // Animate card
  const card = document.getElementById('question-card');
  card.style.animation = 'none';
  requestAnimationFrame(() => { card.style.animation = ''; });

  // Start timer
  startTimer();

  // Save progress
  saveProgress();
}

function selectAnswer(optIdx) {
  if (state.answers[state.currentQ] !== null) return; // already answered
  clearInterval(state.timerInterval);

  const spent = TIMER_SECONDS - state.timerVal;
  state.timeSpent[state.currentQ] = spent;
  state.answers[state.currentQ] = optIdx;

  // Highlight selected
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
  document.getElementById(`opt-${optIdx}`).classList.add('selected');

  // Enable next
  const nextBtn = document.getElementById('next-btn');
  nextBtn.disabled = false;
  const isLast = state.currentQ >= QUESTIONS.length - 1;
  document.getElementById('next-btn-label').textContent = isLast ? 'Submit Quiz' : 'Next Question';

  saveProgress();
}

function handleNext() {
  if (state.currentQ >= QUESTIONS.length - 1) {
    submitQuiz();
  } else {
    state.currentQ++;
    renderQuestion();
  }
}

// ── Timer ──────────────────────────────────────────────────
function startTimer() {
  clearInterval(state.timerInterval);
  state.timerVal = TIMER_SECONDS;
  updateTimerUI(TIMER_SECONDS);
  const wrap = document.querySelector('.timer-wrap');
  wrap.classList.remove('timer-low');

  state.timerInterval = setInterval(() => {
    state.timerVal--;
    updateTimerUI(state.timerVal);
    if (state.timerVal <= 3) wrap.classList.add('timer-low');
    if (state.timerVal <= 0) {
      clearInterval(state.timerInterval);
      // Time out — auto advance with no answer
      if (state.answers[state.currentQ] === null) {
        state.timeSpent[state.currentQ] = TIMER_SECONDS;
        saveProgress();
      }
      if (state.currentQ >= QUESTIONS.length - 1) {
        submitQuiz();
      } else {
        state.currentQ++;
        renderQuestion();
      }
    }
  }, 1000);
}

function updateTimerUI(val) {
  document.getElementById('timer-number').textContent = val;
  const offset = TIMER_CIRC - (val / TIMER_SECONDS) * TIMER_CIRC;
  document.getElementById('timer-ring').style.strokeDashoffset = offset;
}

// ── Progress persistence ───────────────────────────────────
async function saveProgress() {
  const data = {
    usn: state.usn, name: state.name,
    currentQ: state.currentQ,
    answers: state.answers,
    timeSpent: state.timeSpent,
    startTime: state.startTime,
    completed: false
  };
  localStorage.setItem(`cq_progress_${state.usn}`, JSON.stringify(data));
  if (db) {
    try { await db.collection(COLLECTION).doc(state.usn).set(data, { merge: true }); }
    catch (e) { console.warn('Save progress error:', e); }
  }
}

// ── Submit ─────────────────────────────────────────────────
async function submitQuiz() {
  clearInterval(state.timerInterval);
  showView('result');

  const score = state.answers.reduce((acc, ans, i) => acc + (ans === QUESTIONS[i].answer ? 1 : 0), 0);
  const totalTime = state.timeSpent.reduce((a, b) => a + (b || 0), 0);
  const pct = Math.round((score / QUESTIONS.length) * 100);
  const now = new Date();

  const submission = {
    usn: state.usn,
    name: state.name,
    score,
    totalQuestions: QUESTIONS.length,
    totalTimeSecs: totalTime,
    timeTaken: formatTime(totalTime),
    submittedAt: now.toLocaleString('en-IN'),
    completed: true
  };

  // Persist
  localStorage.setItem(`cq_progress_${state.usn}`, JSON.stringify(submission));
  if (db) {
    try { await db.collection(COLLECTION).doc(state.usn).set(submission); }
    catch (e) { console.warn('Submit error:', e); }
  }

  state.currentUSN_score = score;
  renderResult(submission, pct);
}

function renderResult(sub, pct) {
  document.getElementById('result-name').textContent = `${sub.name} • ${sub.usn}`;
  document.getElementById('score-num').textContent = sub.score;
  document.getElementById('score-total').textContent = sub.totalQuestions;
  document.getElementById('score-percent').textContent = `${pct}%`;
  document.getElementById('res-time').textContent = sub.timeTaken;
  document.getElementById('res-correct').textContent = `${sub.score} / ${sub.totalQuestions}`;
  document.getElementById('res-submitted').textContent = sub.submittedAt;

  // Grade & emoji
  let grade = '', emoji = '';
  if (pct >= 90)      { grade = '🌟 Excellent!'; emoji = '🎉'; }
  else if (pct >= 75) { grade = '👍 Good Job!'; emoji = '😊'; }
  else if (pct >= 50) { grade = '📚 Keep Studying'; emoji = '💪'; }
  else                { grade = '🔄 Need Improvement'; emoji = '📖'; }

  document.getElementById('result-emoji').textContent = emoji;
  document.getElementById('result-grade').textContent = grade;

  // Score ring animation
  setTimeout(() => {
    const fill = document.getElementById('score-ring-fill');
    const offset = SCORE_CIRC - (pct / 100) * SCORE_CIRC;
    fill.style.strokeDashoffset = offset;
    if (pct < 50) fill.style.stroke = '#ef4444';
    else if (pct < 75) fill.style.stroke = '#f59e0b';
    else fill.style.stroke = '#10b981';
  }, 200);
}

// ── Leaderboard ────────────────────────────────────────────
function showLeaderboard() {
  closeModal();
  showView('leaderboard');

  if (lbUnsubscribe) lbUnsubscribe();

  if (db) {
    lbUnsubscribe = db.collection(COLLECTION)
      .where('completed', '==', true)
      .onSnapshot(snap => {
        const rows = snap.docs.map(d => d.data());
        renderLeaderboard(rows);
      }, err => {
        console.error('Leaderboard error:', err);
        document.getElementById('lb-rows').innerHTML = `<div class="lb-loading">⚠️ Error loading leaderboard. Check Firestore rules.</div>`;
      });
  } else {
    // Fallback: localStorage
    const rows = [];
    for (let k in localStorage) {
      if (k.startsWith('cq_progress_')) {
        try {
          const d = JSON.parse(localStorage.getItem(k));
          if (d.completed) rows.push(d);
        } catch {}
      }
    }
    renderLeaderboard(rows);
    document.getElementById('lb-rows').insertAdjacentHTML('beforeend',
      `<div class="lb-loading" style="border-top:1px solid var(--glass-border);color:#f59e0b">⚠️ Showing local data only. Configure Firebase for shared leaderboard.</div>`
    );
  }
}

function renderLeaderboard(rows) {
  // Sort by score desc, then by time asc (less time = better rank)
  rows.sort((a, b) => b.score - a.score || (a.totalTimeSecs || 999) - (b.totalTimeSecs || 999));

  // Assign ranks (same score = same rank)
  let rank = 1;
  rows.forEach((r, i) => {
    if (i > 0 && r.score < rows[i-1].score) rank = i + 1;
    r._rank = rank;
  });

  document.getElementById('lb-count').textContent = `${rows.length} student${rows.length !== 1 ? 's' : ''} have completed the quiz`;

  // Podium (top 3)
  renderPodium(rows.slice(0, 3));

  // Table rows
  const container = document.getElementById('lb-rows');
  if (rows.length === 0) {
    container.innerHTML = `<div class="lb-loading">No submissions yet. Be the first! 🚀</div>`;
    return;
  }

  container.innerHTML = rows.map((r, i) => {
    const isMe = r.usn === state.usn;
    const rankClass = r._rank === 1 ? 'rank-gold' : r._rank === 2 ? 'rank-silver' : r._rank === 3 ? 'rank-bronze' : '';
    const rankDisplay = r._rank <= 3 ? ['🥇','🥈','🥉'][r._rank-1] : `#${r._rank}`;
    return `<div class="lb-row ${isMe ? 'highlight' : ''}">
      <div class="lb-rank ${rankClass}">${rankDisplay}</div>
      <div class="lb-name">${escHtml(r.name)}${isMe ? ' <span style="color:var(--gold);font-size:.7rem">(You)</span>' : ''}</div>
      <div class="lb-score">${r.score}/${r.totalQuestions || QUESTIONS.length}</div>
    </div>`;
  }).join('');
}

function renderPodium(top) {
  const medals = ['🥇','🥈','🥉'];
  // Reorder for visual podium: 2nd | 1st | 3rd
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const orderIdx = [1, 0, 2];

  const wrap = document.getElementById('podium-wrap');
  if (!top[0]) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = order.map((r, i) => {
    const origIdx = orderIdx[i];
    return `<div class="podium-item">
      <div class="podium-avatar">${r.name.charAt(0)}</div>
      <div class="podium-name">${escHtml(r.name)}</div>
      <div class="podium-score">${r.score}/${r.totalQuestions || QUESTIONS.length}</div>
      <div class="podium-block"><span class="podium-medal">${medals[origIdx]}</span></div>
    </div>`;
  }).join('');
}

// ── Modal ──────────────────────────────────────────────────
function showModal(icon, title, body, actions) {
  document.getElementById('modal-icon').textContent = icon;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body.replace(/\n/g, '<br>');
  document.getElementById('modal-actions').innerHTML = actions.map(a =>
    `<button class="btn ${a.primary ? 'btn-primary' : 'btn-ghost'}" onclick="${a.action}">${a.label}</button>`
  ).join('');
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ── Toast ──────────────────────────────────────────────────
function showToast(msg, duration = 4000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), duration);
}

// ── Helpers ────────────────────────────────────────────────
function formatTime(secs) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}m ${s}s`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
