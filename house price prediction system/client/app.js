/* ============================================================
   BHP — Bengaluru Home Prices · app.js
   ============================================================ */

let API = '';  // resolved at runtime

async function resolveApiBase() {
  const candidates = ['', 'http://127.0.0.1:8000', 'http://localhost:8000'];

  for (const candidate of candidates) {
    try {
      const res = await fetch(`${candidate}/api/health`, { cache: 'no-store' });
      if (res.ok) {
        return candidate;
      }
    } catch (err) {
      // Try the next candidate.
    }
  }

  return '';
}

/* ---------- Animated background canvas ---------- */
(function initCanvas() {
  const canvas = document.getElementById('bg');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Soft radial glow top-right
    const grd = ctx.createRadialGradient(W * 0.75, H * 0.1, 0, W * 0.75, H * 0.1, H * 0.7);
    grd.addColorStop(0, 'rgba(200,169,110,0.07)');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Particles
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,169,110,${p.alpha})`;
      ctx.fill();
    });

    // Connect nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(200,169,110,${0.06 * (1 - dist / 100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ---------- Sqft controls ---------- */
function adjustSqft(delta) {
  const input = document.getElementById('uiSqft');
  const range  = document.getElementById('sqftRange');
  let val = parseInt(input.value) + delta;
  val = Math.max(300, Math.min(10000, val));
  input.value = val;
  range.value = val;
  updateSliderFill(range);
}

function syncSqft(val) {
  document.getElementById('uiSqft').value = val;
  updateSliderFill(document.getElementById('sqftRange'));
}

document.getElementById('uiSqft').addEventListener('input', function () {
  const range = document.getElementById('sqftRange');
  range.value = this.value;
  updateSliderFill(range);
});

function updateSliderFill(slider) {
  const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.background =
    `linear-gradient(to right, var(--accent) ${pct}%, var(--border) ${pct}%)`;
}
updateSliderFill(document.getElementById('sqftRange'));

/* ---------- Pill buttons ---------- */
function setupPills(groupId) {
  const group = document.getElementById(groupId);
  group.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}
setupPills('bhkGroup');
setupPills('bathGroup');

function getActivePill(groupId) {
  const active = document.getElementById(groupId).querySelector('.pill.active');
  return active ? parseInt(active.dataset.val) : 1;
}

/* ---------- Location populate & filter ---------- */
let allLocations = [];

function filterLocations(query) {
  const sel = document.getElementById('uiLocations');
  const q   = query.trim().toLowerCase();
  sel.innerHTML = '';

  const filtered = q
    ? allLocations.filter(l => l.toLowerCase().includes(q))
    : allLocations;

  if (!filtered.length) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.textContent = 'No matches found';
    sel.appendChild(opt);
    return;
  }

  filtered.forEach(loc => {
    const opt = document.createElement('option');
    const display = loc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    opt.value = loc;
    opt.textContent = display;
    sel.appendChild(opt);
  });
}

async function loadLocations() {
  const sel = document.getElementById('uiLocations');

  try {
    const res  = await fetch(`${API}/api/get_location_names`);
    if (!res.ok) throw new Error('Failed to fetch locations');
    const data = await res.json();
    allLocations = data.locations || [];

    document.getElementById('statLocations').textContent = allLocations.length;

    filterLocations('');
  } catch (err) {
    console.error('Could not load locations:', err);
    sel.innerHTML = '<option value="" disabled selected>Unable to load localities</option>';
  }
}

/* ---------- Estimate ---------- */
async function onClickedEstimatePrice() {
  const sqft      = parseFloat(document.getElementById('uiSqft').value);
  const bhk       = getActivePill('bhkGroup');
  const bath      = getActivePill('bathGroup');
  const location  = document.getElementById('uiLocations').value;
  const btn       = document.getElementById('estimateBtn');
  const resultWrap = document.getElementById('resultWrap');
  const priceEl   = document.getElementById('uiEstimatedPrice');

  if (!location) {
    shakeEl(document.querySelector('.select-wrap'));
    return;
  }

  // Loading state
  btn.classList.add('loading');
  btn.disabled = true;
  priceEl.textContent = '—';

  try {
    const res  = await fetch(`${API}/api/predict_home_price`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total_sqft: sqft, bhk, bath, location }),
    });

    if (!res.ok) throw new Error('Prediction failed');

    const data = await res.json();
    const price = data.estimated_price;

    // Animate the number counting up
    animatePrice(priceEl, price);

    // Reveal result panel
    resultWrap.classList.add('visible');

    // Mark all steps active
    document.querySelectorAll('.step').forEach(s => s.classList.add('active'));
  } catch (err) {
    priceEl.textContent = 'Error';
    console.error(err);
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function animatePrice(el, target) {
  const duration = 800;
  const start    = performance.now();
  const from     = 0;

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // cubic ease-out
    const current  = from + (target - from) * ease;
    el.textContent = current.toFixed(2) + ' Lakh';
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function shakeEl(el) {
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'shake 0.35s ease';
  el.addEventListener('animationend', () => (el.style.animation = ''), { once: true });
}

/* ---------- Shake keyframe (inject once) ---------- */
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%     { transform: translateX(-8px); }
    40%     { transform: translateX(8px); }
    60%     { transform: translateX(-4px); }
    80%     { transform: translateX(4px); }
  }
`;
document.head.appendChild(style);

/* ---------- Boot ---------- */
window.addEventListener('DOMContentLoaded', async () => {
  API = await resolveApiBase();
  loadLocations();
});
