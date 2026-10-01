/**
 * AI Video Director Agent Dialog Component
 * Interactive agent control center with natural language prompt input,
 * one-click creative recipes, execution mode selector, and real-time terminal log.
 */
import { showToast } from '../ui/toast.js';

const QUICK_RECIPES = [
  {
    icon: '⚡',
    label: 'Viral TikTok Dive (9:16)',
    prompt: 'Create a fast 9:16 vertical TikTok dive from space into Tokyo Shibuya crossing at night with cyberpunk theme and neon pin',
  },
  {
    icon: '🗼',
    label: 'Paris Sunset Orbit (16:9)',
    prompt: 'Cinematic slow orbit around the Eiffel Tower in Paris at sunset with golden pin and warm film LUT',
  },
  {
    icon: '🏙️',
    label: 'Dubai Plunge + Street Photo',
    prompt: 'Dramatic plunge to Burj Khalifa in Dubai with gold accents, luxury title card, and real street photo landing frame',
  },
  {
    icon: '🏛️',
    label: 'Colosseum Rome Ancient Reveal',
    prompt: 'Aerial orbit revealing the Roman Colosseum in Rome with satellite theme and 3D architectural pin',
  },
  {
    icon: '🏔️',
    label: 'Everest Expedition Blueprint',
    prompt: 'High-altitude flyover along Mount Everest ridge with blueprint theme and cyan telemetry callout',
  },
  {
    icon: '🌉',
    label: 'San Francisco Golden Gate',
    prompt: 'Golden hour flyover of Golden Gate Bridge in San Francisco with crimson pin and 8s duration',
  },
];

export class AIAgentModal {
  constructor(store, globeEngine, agentEngine) {
    this.store = store;
    this.globeEngine = globeEngine;
    this.agentEngine = agentEngine;

    this.isOpen = false;
    this.isRunning = false;
    this.logs = [];

    this.element = document.createElement('div');
    this.element.className = 'studio-modal-backdrop hidden';
    document.body.appendChild(this.element);

    this.render();
  }

  show() {
    this.isOpen = true;
    this.element.classList.remove('hidden');
    const input = this.element.querySelector('#agent-prompt-input');
    if (input) {
      setTimeout(() => input.focus(), 100);
    }
  }

  hide() {
    if (this.isRunning) return;
    this.isOpen = false;
    this.element.classList.add('hidden');
  }

  addLog(step, message, pct) {
    const timeStr = new Date().toLocaleTimeString();
    this.logs.push({ step, message, pct, time: timeStr });

    const consoleElem = this.element.querySelector('#agent-console-log');
    if (consoleElem) {
      const stepUpper = (step || 'INFO').toUpperCase();
      const line = document.createElement('div');
      line.className = 'agent-log-line';
      line.innerHTML = `
        <span class="log-time">[${timeStr}]</span>
        <span class="log-badge badge-${step}">${stepUpper}</span>
        <span class="log-msg">${message}</span>
      `;
      consoleElem.appendChild(line);
      consoleElem.scrollTop = consoleElem.scrollHeight;
    }

    const progressBar = this.element.querySelector('#agent-progress-fill');
    if (progressBar && pct !== undefined) {
      progressBar.style.width = `${Math.round(pct * 100)}%`;
    }
  }

  render() {
    this.element.innerHTML = `
      <div class="studio-modal-dialog agent-modal-dialog">
        <!-- Modal Header -->
        <div class="modal-header agent-header">
          <div class="agent-title-group">
            <div class="agent-spark-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
            </div>
            <div>
              <div class="flex-center gap-2">
                <h2 class="modal-title">AI Video Director Agent</h2>
                <span class="agent-status-badge">
                  <span class="status-pulse-dot"></span>
                  AUTONOMOUS AGENT ACTIVE
                </span>
              </div>
              <p class="modal-subtitle">Auto-create 3D orbital dives, flight flyovers, and real photo landing videos from prompts</p>
            </div>
          </div>
          <button class="modal-close-btn" id="agent-modal-close" title="Close">&times;</button>
        </div>

        <div class="modal-body agent-modal-body">
          <!-- Prompt Input Box -->
          <div class="field-group">
            <label class="field-label flex-between">
              <span>Director Prompt</span>
              <span class="field-hint">Natural language cinematographic instructions</span>
            </label>
            <div class="agent-input-wrap">
              <textarea
                id="agent-prompt-input"
                class="studio-textarea agent-textarea"
                rows="3"
                placeholder="e.g. Create a 9:16 vertical TikTok dive from space into Tokyo Shibuya crossing at night with cyberpunk theme and neon pin..."
              ></textarea>
            </div>
          </div>

          <!-- Quick Creative Recipes -->
          <div class="agent-recipes-section">
            <span class="recipes-label">Quick Agent Recipes:</span>
            <div class="recipes-grid">
              ${QUICK_RECIPES.map(
                (r) => `
                <button class="agent-chip" data-prompt="${r.prompt}">
                  <span class="chip-icon">${r.icon}</span>
                  <span class="chip-text">${r.label}</span>
                </button>
              `
              ).join('')}
            </div>
          </div>

          <!-- Configuration Controls -->
          <div class="agent-options-row">
            <div class="option-col">
              <label class="field-label">Action</label>
              <select id="agent-action-select" class="studio-select">
                <option value="preview" selected>🎬 Create & Play Preview</option>
                <option value="render">⚡ Auto Create & Render Video (.webm)</option>
              </select>
            </div>

            <div class="option-col">
              <label class="field-label">Format Aspect Ratio</label>
              <select id="agent-format-select" class="studio-select">
                <option value="auto" selected>✨ Auto-Detect from Prompt</option>
                <option value="16:9">▬ 16:9 Widescreen (YouTube, TV)</option>
                <option value="9:16">▮ 9:16 Vertical (TikTok, Reels, Shorts)</option>
                <option value="1:1">■ 1:1 Square (Instagram)</option>
              </select>
            </div>
          </div>

          <!-- Real-Time Agent Execution Console -->
          <div class="agent-console-box">
            <div class="console-header flex-between">
              <div class="console-title flex-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="4 17 10 11 4 5"></polyline>
                  <line x1="12" y1="19" x2="20" y2="19"></line>
                </svg>
                <span>Agent Execution Terminal</span>
              </div>
              <span id="agent-step-label" class="console-step-label">Ready</span>
            </div>
            <div id="agent-console-log" class="agent-log-container font-mono">
              <div class="agent-log-line text-muted">// Agent standby. Enter a prompt or select a recipe above.</div>
            </div>
            <div class="agent-progress-track">
              <div id="agent-progress-fill" class="agent-progress-bar" style="width: 0%;"></div>
            </div>
          </div>
        </div>

        <!-- Modal Footer Actions -->
        <div class="modal-footer agent-footer flex-between">
          <span class="footer-tip">💡 The Agent coordinates 3D camera paths, visual themes, telemetry HUD, and real photo landing frames.</span>
          <div class="flex-center gap-2">
            <button id="btn-agent-cancel" class="secondary-btn">Cancel</button>
            <button id="btn-agent-execute" class="agent-execute-btn glow">
              <svg class="agent-spark-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span id="btn-agent-text">Generate Video</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Close modal
    this.element.querySelector('#agent-modal-close')?.addEventListener('click', () => this.hide());
    this.element.querySelector('#btn-agent-cancel')?.addEventListener('click', () => this.hide());

    // Close on backdrop click (if not running)
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element && !this.isRunning) {
        this.hide();
      }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen && !this.isRunning) {
        this.hide();
      }
    });

    // Quick recipe chip clicks
    this.element.querySelectorAll('.agent-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const promptText = chip.dataset.prompt;
        const textarea = this.element.querySelector('#agent-prompt-input');
        if (textarea) {
          textarea.value = promptText;
          textarea.focus();
        }
      });
    });

    // Execute button click
    const execBtn = this.element.querySelector('#btn-agent-execute');
    execBtn?.addEventListener('click', () => this.runAgent());
  }

  async runAgent() {
    if (this.isRunning) return;

    const textarea = this.element.querySelector('#agent-prompt-input');
    const prompt = textarea?.value.trim();

    if (!prompt) {
      showToast('Please enter a prompt or choose a quick recipe', 'info');
      textarea?.focus();
      return;
    }

    const action = this.element.querySelector('#agent-action-select')?.value || 'preview';
    const formatOverride = this.element.querySelector('#agent-format-select')?.value;
    const autoRender = action === 'render';

    this.isRunning = true;
    const execBtn = this.element.querySelector('#btn-agent-execute');
    const execText = this.element.querySelector('#btn-agent-text');
    if (execBtn) execBtn.disabled = true;
    if (execText) execText.textContent = autoRender ? 'Rendering Video...' : 'Directing Scene...';

    // Clear logs
    const consoleElem = this.element.querySelector('#agent-console-log');
    if (consoleElem) consoleElem.innerHTML = '';
    const stepLabel = this.element.querySelector('#agent-step-label');

    try {
      this.addLog('START', `Autonomous AI Director activated with prompt: "${prompt}"`, 0.05);

      const result = await this.agentEngine.createVideoFromPrompt(prompt, {
        autoRender,
        formatOverride: formatOverride !== 'auto' ? formatOverride : null,
        onProgress: (evt) => {
          this.addLog(evt.step, evt.message, evt.progress);
          if (stepLabel) stepLabel.textContent = evt.step.toUpperCase();
        },
      });

      showToast(
        autoRender
          ? `Video generated and exported! (${(result.video?.size / (1024 * 1024)).toFixed(2)} MB)`
          : `Scene synthesized! Ready for playback.`,
        'success'
      );

      // Play preview if in preview mode
      if (!autoRender) {
        setTimeout(() => {
          const playBtn = document.getElementById('btn-play-pause');
          if (playBtn) playBtn.click();
        }, 500);
      }

      setTimeout(() => {
        this.hide();
      }, 1200);
    } catch (err) {
      console.error('Agent execution error:', err);
      this.addLog('ERROR', `Agent execution failed: ${err.message}`, 1.0);
      showToast(`Agent failed: ${err.message}`, 'error');
    } finally {
      this.isRunning = false;
      if (execBtn) execBtn.disabled = false;
      if (execText) execText.textContent = 'Generate Video';
    }
  }
}
