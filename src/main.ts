import "./styles.css";

type Particle = {
  x: number;
  y: number;
  age: number;
  hue: number;
};

type FieldPreset = {
  name: string;
  description: string;
  field: (x: number, y: number, time: number) => { vx: number; vy: number };
};

const presets: FieldPreset[] = [
  {
    name: "Orbit",
    description: "Rotational flow around the center.",
    field: (x, y) => ({ vx: -y, vy: x })
  },
  {
    name: "Vortex",
    description: "Tight spiral with a soft center pull.",
    field: (x, y, time) => ({
      vx: -y + 0.24 * Math.sin(time + x * 2.4),
      vy: x + 0.24 * Math.cos(time + y * 2.4)
    })
  },
  {
    name: "Saddle",
    description: "Opposing expansion and compression axes.",
    field: (x, y) => ({ vx: x, vy: -y })
  },
  {
    name: "Wave",
    description: "Layered sine/cosine current field.",
    field: (x, y, time) => ({
      vx: Math.sin(y * 2.2 + time),
      vy: Math.cos(x * 2.2 - time)
    })
  }
];

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

app.innerHTML = `
  <main class="shell">
    <section class="toolbar" aria-label="Simulation controls">
      <div>
        <p class="eyebrow">Quiver Partical Field</p>
        <h1>Vector flow simulator</h1>
      </div>
      <div class="controls">
        <label>
          Preset
          <select id="preset"></select>
        </label>
        <label>
          Density
          <input id="density" type="range" min="8" max="34" value="20" />
        </label>
        <label>
          Speed
          <input id="speed" type="range" min="5" max="140" value="58" />
        </label>
        <label>
          Particles
          <input id="particleCount" type="range" min="80" max="1200" value="520" />
        </label>
        <button id="toggle" type="button">Pause</button>
        <button id="reset" type="button">Reset</button>
      </div>
    </section>
    <section class="stage">
      <canvas id="fieldCanvas" aria-label="Animated vector field simulation"></canvas>
      <div class="status">
        <span id="presetName">Orbit</span>
        <span id="presetDescription">Rotational flow around the center.</span>
      </div>
    </section>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#fieldCanvas");
const presetSelect = document.querySelector<HTMLSelectElement>("#preset");
const densityInput = document.querySelector<HTMLInputElement>("#density");
const speedInput = document.querySelector<HTMLInputElement>("#speed");
const particleInput = document.querySelector<HTMLInputElement>("#particleCount");
const toggleButton = document.querySelector<HTMLButtonElement>("#toggle");
const resetButton = document.querySelector<HTMLButtonElement>("#reset");
const presetName = document.querySelector<HTMLSpanElement>("#presetName");
const presetDescription = document.querySelector<HTMLSpanElement>("#presetDescription");

if (
  !canvas ||
  !presetSelect ||
  !densityInput ||
  !speedInput ||
  !particleInput ||
  !toggleButton ||
  !resetButton ||
  !presetName ||
  !presetDescription
) {
  throw new Error("A required control was not found.");
}

const context = canvas.getContext("2d", { alpha: false });

if (!context) {
  throw new Error("Canvas 2D rendering is not available.");
}

for (const [index, preset] of presets.entries()) {
  const option = document.createElement("option");
  option.value = String(index);
  option.textContent = preset.name;
  presetSelect.appendChild(option);
}

let particles: Particle[] = [];
let running = true;
let lastFrame = performance.now();
let width = 0;
let height = 0;
let pixelRatio = 1;

function randomParticle(): Particle {
  return {
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    age: Math.random() * 220,
    hue: 190 + Math.random() * 80
  };
}

function resetParticles() {
  const count = Number(particleInput.value);
  particles = Array.from({ length: count }, randomParticle);
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, Math.floor(bounds.width));
  height = Math.max(1, Math.floor(bounds.height));
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function projectX(x: number) {
  return (x * 0.5 + 0.5) * width;
}

function projectY(y: number) {
  return (y * 0.5 + 0.5) * height;
}

function currentPreset() {
  return presets[Number(presetSelect.value)] ?? presets[0];
}

function normalize(vx: number, vy: number) {
  const magnitude = Math.hypot(vx, vy) || 1;
  return { x: vx / magnitude, y: vy / magnitude, magnitude };
}

function drawVectorField(time: number) {
  const density = Number(densityInput.value);
  const preset = currentPreset();
  const stepX = width / density;
  const stepY = height / density;

  context.save();
  context.lineCap = "round";

  for (let gx = 0; gx <= density; gx += 1) {
    for (let gy = 0; gy <= density; gy += 1) {
      const x = (gx / density) * 2 - 1;
      const y = (gy / density) * 2 - 1;
      const vector = preset.field(x, y, time);
      const direction = normalize(vector.vx, vector.vy);
      const px = projectX(x);
      const py = projectY(y);
      const length = Math.min(stepX, stepY) * 0.34 * Math.min(direction.magnitude, 1.8);
      const dx = direction.x * length;
      const dy = direction.y * length;

      context.strokeStyle = `hsla(${190 + Math.min(direction.magnitude, 2) * 32}, 90%, 66%, 0.42)`;
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(px - dx * 0.42, py - dy * 0.42);
      context.lineTo(px + dx * 0.42, py + dy * 0.42);
      context.stroke();

      context.beginPath();
      context.moveTo(px + dx * 0.42, py + dy * 0.42);
      context.lineTo(px + dx * 0.2 - dy * 0.13, py + dy * 0.2 + dx * 0.13);
      context.lineTo(px + dx * 0.2 + dy * 0.13, py + dy * 0.2 - dx * 0.13);
      context.closePath();
      context.fillStyle = `hsla(${200 + direction.magnitude * 30}, 90%, 70%, 0.55)`;
      context.fill();
    }
  }

  context.restore();
}

function drawParticles(deltaSeconds: number, time: number) {
  const preset = currentPreset();
  const speed = Number(speedInput.value) / 100;

  context.save();
  context.globalCompositeOperation = "lighter";

  for (const particle of particles) {
    const vector = preset.field(particle.x, particle.y, time);
    const direction = normalize(vector.vx, vector.vy);
    const previousX = particle.x;
    const previousY = particle.y;

    particle.x += direction.x * deltaSeconds * speed * 0.72;
    particle.y += direction.y * deltaSeconds * speed * 0.72;
    particle.age += deltaSeconds * 60;

    const outOfBounds = Math.abs(particle.x) > 1.12 || Math.abs(particle.y) > 1.12;
    if (outOfBounds || particle.age > 420) {
      Object.assign(particle, randomParticle());
      continue;
    }

    context.strokeStyle = `hsla(${particle.hue}, 100%, 68%, 0.28)`;
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(projectX(previousX), projectY(previousY));
    context.lineTo(projectX(particle.x), projectY(particle.y));
    context.stroke();
  }

  context.restore();
}

function render(frameTime: number) {
  const deltaSeconds = Math.min((frameTime - lastFrame) / 1000, 0.05);
  lastFrame = frameTime;
  const time = frameTime / 1000;

  context.fillStyle = "#080a0f";
  context.fillRect(0, 0, width, height);

  const gradient = context.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, width * 0.72);
  gradient.addColorStop(0, "rgba(30, 84, 116, 0.22)");
  gradient.addColorStop(0.58, "rgba(15, 24, 38, 0.48)");
  gradient.addColorStop(1, "rgba(8, 10, 15, 1)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  drawVectorField(time);
  if (running) {
    drawParticles(deltaSeconds, time);
  }

  requestAnimationFrame(render);
}

function updatePresetText() {
  const preset = currentPreset();
  presetName.textContent = preset.name;
  presetDescription.textContent = preset.description;
}

presetSelect.addEventListener("change", () => {
  updatePresetText();
  resetParticles();
});

particleInput.addEventListener("input", resetParticles);
resetButton.addEventListener("click", resetParticles);
toggleButton.addEventListener("click", () => {
  running = !running;
  toggleButton.textContent = running ? "Pause" : "Resume";
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
resetParticles();
updatePresetText();
requestAnimationFrame(render);
