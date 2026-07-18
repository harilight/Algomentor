/* ============================================================================
   ALGOMENTOR CODEVIZ ENGINE v5.0 - EMBEDDED VISUALIZER LOGIC FOR WORKSPACE
   ============================================================================ */

let vizExecutionTrace = [];
let vizLayoutMetadata = [];
let vizCurrentStepIndex = 0;
let vizAutoplayInterval = null;
let vizLastHighlightedLine = null;

// Initialize Visualizer UI inside visualizerView when tab is switched or script loads
function initVisualizerUI() {
    const container = document.getElementById('visualizerView');
    if (!container) return;
    
    // Check if already initialized
    if (document.getElementById('vizTimelineBar')) return;

    container.innerHTML = `
        <div class="viz-header-bar">
            <div class="viz-header-left">
                <div class="viz-title"><i class="fas fa-magic"></i> CodeViz Engine v5.0</div>
                <div class="viz-inputs-group">
                    <span class="viz-input-label">Function:</span>
                    <input type="text" id="vizFuncInput" class="viz-input-field" placeholder="e.g. solve" title="Target Function Name">
                </div>
                <div class="viz-inputs-group">
                    <span class="viz-input-label">Args:</span>
                    <input type="text" id="vizArgsInput" class="viz-input-field" placeholder="e.g. 10, 20" title="Function Arguments (comma separated)">
                </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button type="button" class="viz-btn-generate" id="vizBtnGenerate" onclick="triggerCodeVizTrace()"><i class="fas fa-bolt"></i> Generate Trace Map</button>
                <a href="/visualizer" target="_blank" class="viz-btn-studio" title="Open Full-Screen Standalone Studio"><i class="fas fa-external-link-alt"></i> Studio</a>
            </div>
        </div>

        <div class="viz-timeline-bar" id="vizTimelineBar" style="display: none;">
            <div class="viz-controls-group">
                <button type="button" class="viz-control-btn" id="vizBtnPrev" onclick="vizStepPrev()" title="Previous Step"><i class="fas fa-step-backward"></i></button>
                <button type="button" class="viz-control-btn play-btn" id="vizBtnPlay" onclick="vizToggleAutoplay()"><i class="fas fa-play"></i> Play</button>
                <button type="button" class="viz-control-btn" id="vizBtnNext" onclick="vizStepNext()" title="Next Step"><i class="fas fa-step-forward"></i></button>
                <button type="button" class="viz-control-btn" onclick="vizStopReset()" title="Reset Timeline"><i class="fas fa-stop"></i></button>
            </div>
            <div class="viz-slider-container">
                <input type="range" class="viz-slider" id="vizSlider" min="0" max="0" value="0" oninput="vizSliderChange(this.value)">
            </div>
            <div class="viz-controls-group">
                <span class="viz-step-counter" id="vizStepCounter">Step: 0/0</span>
                <select class="viz-speed-select" id="vizSpeedSelect" onchange="vizSpeedChange()">
                    <option value="1500">0.5x Speed</option>
                    <option value="800" selected>1.0x Speed</option>
                    <option value="400">2.0x Speed</option>
                    <option value="150">5.0x Speed</option>
                </select>
            </div>
        </div>

        <div class="viz-content-grid">
            <!-- Left: Variables & Scope Inspector -->
            <div class="viz-panel">
                <div class="viz-panel-header">
                    <span><i class="fas fa-cubes"></i> Live Variables & Explanations</span>
                    <span id="vizCurrentLineBadge" style="font-size: 11px; color: #a855f7; font-family: monospace;">Line: -</span>
                </div>
                <div class="viz-panel-body" id="vizVariablesBody">
                    <div class="viz-annotation-box" id="vizAnnotationBox">
                        Click <b>Generate Trace Map</b> above to trace execution line-by-line.
                    </div>
                    <div id="vizVarCardsContainer"></div>
                </div>
            </div>

            <!-- Right: Dynamic Data Structure Visualizer -->
            <div class="viz-panel">
                <div class="viz-panel-header" id="vizPanelRightTitle">
                    <span><i class="fas fa-project-diagram"></i> Live Memory Graph & Flow Map</span>
                </div>
                <div class="viz-panel-body" style="padding: 0; display: flex; align-items: center; justify-content: center; background: #070a12;">
                    <div class="viz-svg-container" id="vizSvgCanvasContainer">
                        <div style="color: #64748b; font-size: 12px; text-align: center; padding: 24px;">
                            <i class="fas fa-chart-network" style="font-size: 32px; margin-bottom: 8px; opacity: 0.5; display: block;"></i>
                            Run trace to render dynamic Data Structure map (Arrays, Stacks, Queues, Trees, Linked Lists).
                        </div>
                    </div>
                    <div id="vizStackFrameView" style="display: none; width: 100%; padding: 12px; gap: 8px; flex-direction: column;"></div>
                    <div id="vizFlowTreeView" style="display: none; width: 100%; padding: 12px;"></div>
                </div>
            </div>
        </div>
    `;

    // Try to pre-populate function name and args from problem metadata if available
    autoPopulateVizInputs();
}

function autoPopulateVizInputs() {
    const funcInput = document.getElementById('vizFuncInput');
    const argsInput = document.getElementById('vizArgsInput');
    if (!funcInput || !argsInput) return;

    // Check editor content for def function_name
    let editorCode = "";
    if (typeof editor !== 'undefined' && editor.getValue) {
        editorCode = editor.getValue();
    } else if (typeof document.getElementById('codeEditor') !== 'undefined' && document.getElementById('codeEditor')) {
        editorCode = document.getElementById('codeEditor').value;
    }

    if (!funcInput.value && editorCode) {
        const match = editorCode.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
        if (match && match[1]) {
            funcInput.value = match[1];
        }
    }

    // Check test cases from workspace input tab or problem data
    if (!argsInput.value && typeof parsedTestCasesArray !== 'undefined' && parsedTestCasesArray.length > 0) {
        const firstTc = parsedTestCasesArray[0];
        if (firstTc && firstTc.input) {
            argsInput.value = firstTc.input.replace(/\n/g, ', ');
        }
    }
}

// Triggered when user clicks "Visualize" button in top nav or inside tab
async function visualizeCode(event) {
    if (event) event.preventDefault();
    if (typeof switchConsoleTab === 'function') {
        switchConsoleTab('visualizer');
    }
    initVisualizerUI();
    autoPopulateVizInputs();
    await triggerCodeVizTrace();
}

// Master execution trace trigger
async function triggerCodeVizTrace() {
    initVisualizerUI();
    const btn = document.getElementById('vizBtnGenerate');
    const funcInput = document.getElementById('vizFuncInput');
    const argsInput = document.getElementById('vizArgsInput');
    if (!btn) return;

    let rawCode = "";
    let lang = "python";
    if (typeof getSelectedLanguageAndCode === 'function') {
        const selection = getSelectedLanguageAndCode();
        rawCode = selection.code;
        lang = selection.language;
    } else if (typeof editor !== 'undefined' && editor.getValue) {
        rawCode = editor.getValue();
    }

    if (!rawCode || !rawCode.trim()) {
        window.showToast("Please enter code in the editor before generating a trace.");
        return;
    }

    if (lang && lang.toLowerCase() !== 'python' && !/^\s*def\s+/m.test(rawCode)) {
        if (window.showToast) window.showToast("Tracing code using CodeViz Engine v5.0...", "success");
        const proceed = true;
        if (!proceed) return;
    }

    let detectedFunc = funcInput ? funcInput.value.trim() : "";
    if (!detectedFunc) {
        const match = rawCode.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
        if (match && match[1]) {
            detectedFunc = match[1];
            if (funcInput) funcInput.value = detectedFunc;
        } else {
            detectedFunc = "solve";
        }
    }

    let parsedArgs = [];
    if (argsInput && argsInput.value.trim()) {
        parsedArgs = argsInput.value.split(',').map(x => {
            const strVal = x.trim();
            if (strVal === "") return null;
            const num = Number(strVal);
            return isNaN(num) ? strVal : num;
        }).filter(x => x !== null);
    }

    const payload = {
        code: rawCode,
        function_name: detectedFunc,
        args: parsedArgs
    };

    try {
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Tracing AST...`;
        btn.disabled = true;

        // Call backend server proxy endpoint (/api/problems/trace or /trace) with direct fallback to 8000
        let response;
        try {
            response = await fetch('/api/problems/trace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e1) {
            try {
                response = await fetch('/trace', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (e2) {
                response = await fetch('http://127.0.0.1:8000/trace', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.detail || data.error || "Execution tracing stopped.");
        }

        vizExecutionTrace = data.trace || [];
        vizLayoutMetadata = data.layout_metadata || [];
        vizCurrentStepIndex = 0;

        if (vizExecutionTrace.length === 0) {
            throw new Error("No trace steps generated. Ensure the function name matches your code.");
        }

        // Show timeline controls
        document.getElementById('vizTimelineBar').style.display = 'flex';
        const slider = document.getElementById('vizSlider');
        slider.max = vizExecutionTrace.length - 1;
        slider.value = 0;
        slider.disabled = false;

        document.getElementById('vizBtnPrev').disabled = true;
        document.getElementById('vizBtnNext').disabled = vizExecutionTrace.length <= 1;

        // Precalculate coordinates for trees/linked lists
        vizPrecalculateNodeCoordinates(vizExecutionTrace);

        vizRenderCurrentStep();
    } catch (err) {
        window.showToast("CodeViz Error: " + err.message);
        const annBox = document.getElementById('vizAnnotationBox');
        if (annBox) {
            annBox.innerHTML = `<span style="color: #f87171;">Trace aborted: ${err.message}</span>`;
        }
    } finally {
        btn.innerHTML = `<i class="fas fa-bolt"></i> Generate Trace Map`;
        btn.disabled = false;
    }
}

// Master UI Step State Updater for Embedded Workspace
function vizRenderCurrentStep() {
    if (!vizExecutionTrace.length) return;
    const step = vizExecutionTrace[vizCurrentStepIndex];
    const prevStep = vizCurrentStepIndex > 0 ? vizExecutionTrace[vizCurrentStepIndex - 1] : null;

    // Update Counter & Line Tag
    const counter = document.getElementById('vizStepCounter');
    if (counter) counter.innerText = `Step: ${vizCurrentStepIndex + 1}/${vizExecutionTrace.length}`;
    const badge = document.getElementById('vizCurrentLineBadge');
    if (badge) badge.innerText = `Line: ${step.line}`;

    // Update Annotation Box
    const annBox = document.getElementById('vizAnnotationBox');
    if (annBox) annBox.innerHTML = vizGenerateAnnotation(step, prevStep);

    // Update Variables Inspector
    const varContainer = document.getElementById('vizVarCardsContainer');
    if (varContainer) varContainer.innerHTML = vizRenderVariablesInspector(step.variables);

    // Highlight active line inside Monaco Editor directly
    vizHighlightMonacoLine(step.line);

    // Render Dynamic Data Structure Visualization Panel
    vizRenderDynamicPanel(step);

    // Update Controls state
    const slider = document.getElementById('vizSlider');
    if (slider) slider.value = vizCurrentStepIndex;
    const btnPrev = document.getElementById('vizBtnPrev');
    if (btnPrev) btnPrev.disabled = vizCurrentStepIndex === 0;
    const btnNext = document.getElementById('vizBtnNext');
    if (btnNext) btnNext.disabled = vizCurrentStepIndex === vizExecutionTrace.length - 1;
}

// Highlight line in Monaco editor
function vizHighlightMonacoLine(lineNum) {
    if (typeof editor === 'undefined' || !editor || typeof monaco === 'undefined' || !editor.deltaDecorations) return;
    try {
        let decs = [];
        if (vizLastHighlightedLine !== null && editor._codeVizDecorations) {
            decs = editor._codeVizDecorations;
        }
        editor._codeVizDecorations = editor.deltaDecorations(decs, [
            {
                range: new monaco.Range(lineNum, 1, lineNum, 1),
                options: {
                    isWholeLine: true,
                    className: 'monaco-active-line-highlight',
                    linesDecorationsClassName: 'monaco-active-line-gutter'
                }
            }
        ]);
        vizLastHighlightedLine = lineNum;
        editor.revealLineInCenterIfOutsideViewport(lineNum, monaco.editor.ScrollType.Smooth);
    } catch (e) {}
}

// Timeline navigation helpers
function vizStepPrev() {
    if (vizCurrentStepIndex > 0) {
        vizCurrentStepIndex--;
        vizRenderCurrentStep();
    }
}

function vizStepNext() {
    if (vizCurrentStepIndex < vizExecutionTrace.length - 1) {
        vizCurrentStepIndex++;
        vizRenderCurrentStep();
    } else {
        vizStopAutoplay();
    }
}

function vizSliderChange(val) {
    vizCurrentStepIndex = parseInt(val, 10);
    vizRenderCurrentStep();
}

function vizToggleAutoplay() {
    if (vizAutoplayInterval) {
        vizStopAutoplay();
    } else {
        if (vizCurrentStepIndex === vizExecutionTrace.length - 1) {
            vizCurrentStepIndex = 0;
        }
        vizStartAutoplay();
    }
}

function vizStartAutoplay() {
    const select = document.getElementById('vizSpeedSelect');
    const speed = select ? parseInt(select.value, 10) : 800;
    const btn = document.getElementById('vizBtnPlay');
    if (btn) {
        btn.innerHTML = `<i class="fas fa-pause"></i> Pause`;
        btn.className = "viz-control-btn pause-btn";
    }
    vizAutoplayInterval = setInterval(() => {
        if (vizCurrentStepIndex < vizExecutionTrace.length - 1) {
            vizCurrentStepIndex++;
            vizRenderCurrentStep();
        } else {
            vizStopAutoplay();
        }
    }, speed);
}

function vizStopAutoplay() {
    if (vizAutoplayInterval) {
        clearInterval(vizAutoplayInterval);
        vizAutoplayInterval = null;
    }
    const btn = document.getElementById('vizBtnPlay');
    if (btn) {
        btn.innerHTML = `<i class="fas fa-play"></i> Play`;
        btn.className = "viz-control-btn play-btn";
    }
}

function vizStopReset() {
    vizStopAutoplay();
    vizCurrentStepIndex = 0;
    vizRenderCurrentStep();
}

function vizSpeedChange() {
    if (vizAutoplayInterval) {
        vizStopAutoplay();
        vizStartAutoplay();
    }
}

// Format variable values
function vizFormatVariableValue(v) {
    if (!v) return "None";
    if (v.type === 'int' || v.type === 'float' || v.type === 'bool') return String(v.value);
    if (v.type === 'str') return `"${v.value}"`;
    if (v.type === 'list' || v.type === 'tuple' || v.type === 'set') {
        const items = v.value.map(vizFormatVariableValue).join(', ');
        const brackets = v.type === 'list' ? ['[', ']'] : (v.type === 'tuple' ? ['(', ')'] : ['{', '}']);
        return `${brackets[0]}${items}${brackets[1]}`;
    }
    if (v.type === 'dict') {
        const pairs = Object.entries(v.value).map(([k, val]) => `"${k}": ${vizFormatVariableValue(val)}`).join(', ');
        return `{${pairs}}`;
    }
    if (v.type === 'object') return `<${v.class} Node>`;
    if (v.type === 'reference') return `<Link:${v.class} ID:${v.id.toString().substring(0,4)}>`;
    return String(v.value || "None");
}

// Check variable mutation
function vizHasVariableMutated(varName, index) {
    if (index === 0) return true;
    const currStep = vizExecutionTrace[index];
    const prevStep = vizExecutionTrace[index - 1];
    if (!currStep || !prevStep) return false;
    const currVal = currStep.variables[varName];
    const prevVal = prevStep.variables[varName];
    if (!currVal) return false;
    if (!prevVal) return true;
    return vizFormatVariableValue(currVal) !== vizFormatVariableValue(prevVal);
}

// Get variable history
function vizGetVariableHistory(varName, maxIndex) {
    const history = [];
    for (let i = 0; i <= maxIndex; i++) {
        const step = vizExecutionTrace[i];
        if (!step) continue;
        const v = step.variables[varName];
        if (v) {
            const formatted = vizFormatVariableValue(v);
            if (history.length === 0 || history[history.length - 1] !== formatted) {
                history.push(formatted);
            }
        }
    }
    if (history.length > 4) return "..." + history.slice(-3).join(" ➔ ");
    return history.join(" ➔ ");
}

// Render graphical variables inspector
function vizRenderVariablesInspector(variables) {
    const keys = Object.keys(variables);
    if (!keys.length) {
        return `<div style="color: #64748b; font-style: italic; font-size: 11px; padding: 8px;">No active local variables in scope.</div>`;
    }

    let html = "";
    keys.forEach(name => {
        const v = variables[name];
        let valHtml = "";
        const isMutated = vizHasVariableMutated(name, vizCurrentStepIndex);
        const flashClass = isMutated ? "animate-flash" : "";
        const historyTrace = vizGetVariableHistory(name, vizCurrentStepIndex);

        if (v.type === 'list' || v.type === 'tuple') {
            const is2D = v.value.length > 0 && v.value.every(item => item.type === 'list');
            if (is2D) {
                valHtml += `<div style="overflow-x: auto;"><table style="border-collapse: collapse; text-align: center; font-size: 11px;">`;
                v.value.forEach(row => {
                    valHtml += `<tr>`;
                    row.value.forEach(cell => {
                        valHtml += `<td style="border: 1px solid #334155; padding: 4px 8px; background: #0f172a; color: #a855f7; font-weight: bold;">${vizFormatVariableValue(cell)}</td>`;
                    });
                    valHtml += `</tr>`;
                });
                valHtml += `</table></div>`;
            } else if (name.toLowerCase().includes('stack')) {
                valHtml += `<div style="display: flex; flex-direction: column-reverse; border: 2px dashed #6366f1; border-radius: 6px; padding: 6px; background: #0b0f19; gap: 4px; max-width: 130px;">`;
                if (v.value.length === 0) valHtml += `<div style="font-size: 10px; color: #64748b; text-align: center;">Empty Stack</div>`;
                else {
                    v.value.forEach((item, idx) => {
                        const isTop = idx === v.value.length - 1;
                        valHtml += `<div style="padding: 3px; border-radius: 4px; text-align: center; font-weight: bold; font-size: 11px; background: ${isTop ? '#6366f1' : '#1e293b'}; color: ${isTop ? '#fff' : '#cbd5e1'};">${vizFormatVariableValue(item)}</div>`;
                    });
                }
                valHtml += `</div>`;
            } else if (name.toLowerCase().includes('queue')) {
                valHtml += `<div style="display: flex; align-items: center; border-top: 2px dashed #10b981; border-bottom: 2px dashed #10b981; padding: 6px; background: #0b0f19; gap: 4px; overflow-x: auto;">`;
                if (v.value.length === 0) valHtml += `<div style="font-size: 10px; color: #64748b; text-align: center; width: 100%;">Empty Queue</div>`;
                else {
                    valHtml += `<span style="font-size: 9px; color: #10b981; font-weight: bold;">Front ➔</span>`;
                    v.value.forEach((item, idx) => {
                        const isFront = idx === 0;
                        valHtml += `<div style="padding: 3px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; background: ${isFront ? '#059669' : '#1e293b'}; color: #fff;">${vizFormatVariableValue(item)}</div>`;
                    });
                    valHtml += `<span style="font-size: 9px; color: #10b981; font-weight: bold;">➔ Back</span>`;
                }
                valHtml += `</div>`;
            } else {
                valHtml += `<div style="display: flex; gap: 4px; overflow-x: auto; padding: 2px 0;">`;
                v.value.forEach((item, idx) => {
                    valHtml += `<div style="border: 1px solid #334155; background: #0f172a; border-radius: 4px; padding: 2px 6px; display: flex; flex-direction: column; align-items: center; min-width: 36px;"><span style="font-size: 8px; color: #64748b;">${idx}</span><span style="font-weight: bold; color: #34d399; font-size: 11px;">${vizFormatVariableValue(item)}</span></div>`;
                });
                valHtml += `</div>`;
            }
        } else if (v.type === 'dict' || v.type === 'object') {
            valHtml += `<div style="border: 1px solid #334155; border-radius: 4px; background: #0f172a; overflow: hidden; max-width: 240px; font-size: 11px;">`;
            const entries = Object.entries(v.value);
            if (!entries.length) valHtml += `<div style="padding: 6px; color: #64748b; font-style: italic;">Empty</div>`;
            else {
                entries.forEach(([k, val]) => {
                    valHtml += `<div style="display: flex; border-bottom: 1px solid #1e293b;"><div style="width: 40%; background: #1e293b; padding: 4px 6px; font-weight: bold; color: #fbbf24;">${k}</div><div style="padding: 4px 6px; color: #34d399;">${vizFormatVariableValue(val)}</div></div>`;
                });
            }
            valHtml += `</div>`;
        } else {
            valHtml += `<span style="color: #34d399; font-weight: bold; font-size: 12px; background: #0f172a; padding: 3px 8px; border-radius: 4px; border: 1px solid #1e293b;">${vizFormatVariableValue(v)}</span>`;
        }

        html += `
            <div class="viz-var-card ${flashClass}">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 4px; margin-bottom: 6px;">
                    <span style="color: #fbbf24; font-weight: bold; font-family: monospace; font-size: 12px;">${name}</span>
                    <span style="font-size: 9px; background: #0f172a; color: #94a3b8; padding: 2px 5px; border-radius: 3px; text-transform: uppercase; font-weight: bold;">${v.type === 'object' ? v.class : v.type}</span>
                </div>
                <div>${valHtml}</div>
                <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid rgba(51, 65, 85, 0.4); font-size: 9px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <b style="color: #94a3b8; text-transform: uppercase;">History:</b> ${historyTrace}
                </div>
            </div>
        `;
    });
    return html;
}

// Generate context explanations
function vizGenerateAnnotation(step, prevStep) {
    if (!step) return "No active trace step.";
    if (step.event === 'return') {
        return `Returning from function <b style="color: #fbbf24; font-family: monospace;">${step.function}()</b> with value: <b style="color: #34d399; font-family: monospace;">${vizFormatVariableValue(step.return_value)}</b>. Stack frame popped.`;
    }
    return `Executing statement at Line <b>${step.line}</b> in scope <b style="color: #818cf8; font-family: monospace;">${step.function}()</b>. Check memory state & graph mutations below.`;
}

// Detect linked structures
function vizDetectLinkedStructure(variables) {
    for (const name in variables) {
        const v = variables[name];
        // Skip plain lists/tuples/sets — they are never linked structures
        if (!v || v.type === 'list' || v.type === 'tuple' || v.type === 'set') continue;
        if (v && v.type === 'object') {
            const keys = Object.keys(v.value || {});
            // Removed 'value' — it matches ANY serialized Python object including list rows
            if (keys.includes('next') || keys.includes('left') || keys.includes('right') || keys.includes('val')) {
                return true;
            }
        }
    }
    return false;
}

// Detect if a list variable is a 2D matrix
function vizDetect2DMatrix(varObj, varName) {
    if (!varObj || varObj.type !== 'list' || !Array.isArray(varObj.value) || varObj.value.length === 0) return false;
    const nameHint = (varName || '').toLowerCase();
    const isNameMatch = ['board', 'grid', 'matrix', 'dp', 'table', 'maze', 'map'].some(n => nameHint.includes(n));
    const is2D = varObj.value.every(row => row && row.type === 'list' && Array.isArray(row.value));
    return isNameMatch || is2D;
}

// Precalculate Node coordinates for linked lists & trees
let vizNodePositions = {};
function vizPrecalculateNodeCoordinates(trace) {
    vizNodePositions = {};
    let nodeIds = new Set();
    let adjList = {};

    trace.forEach(step => {
        for (const name in step.variables) {
            const v = step.variables[name];
            if (v && v.type === 'object') {
                const oid = parseInt(v.id, 10);
                nodeIds.add(oid);
                if (!adjList[oid]) adjList[oid] = [];
                ['next', 'left', 'right', 'prev'].forEach(attr => {
                    if (v.value[attr] && v.value[attr].type === 'reference') {
                        const targetId = parseInt(v.value[attr].id, 10);
                        if (!adjList[oid].includes(targetId)) adjList[oid].push(targetId);
                    }
                });
            }
        }
    });

    // Simple layout layout allocation
    const idArray = Array.from(nodeIds);
    idArray.forEach((oid, idx) => {
        vizNodePositions[oid] = {
            x: 80 + (idx % 6) * 95,
            y: 70 + Math.floor(idx / 6) * 85
        };
    });
}

// Render Dynamic Panel
function vizRenderDynamicPanel(step) {
    const titleEl = document.getElementById('vizPanelRightTitle');
    const svgContainer = document.getElementById('vizSvgCanvasContainer');
    const stackFrameView = document.getElementById('vizStackFrameView');
    const flowTreeView = document.getElementById('vizFlowTreeView');
    if (!svgContainer) return;

    const isRecursiveTrace = vizExecutionTrace.some(t => t.call_stack && t.call_stack.length > 1);
    const hasLinkedStructure = vizDetectLinkedStructure(step.variables);
    const stackVarName = Object.keys(step.variables).find(k => k.toLowerCase().includes('stack') || k === 's');
    const hasStackVar = stackVarName && step.variables[stackVarName].type === 'list';
    const queueVarName = Object.keys(step.variables).find(k => k.toLowerCase().includes('queue') || k === 'q');
    const hasQueueVar = queueVarName && step.variables[queueVarName].type === 'list';
    // 2D Matrix detection — check BEFORE 1D array fallback
    const matrixVarName = Object.keys(step.variables).find(k => vizDetect2DMatrix(step.variables[k], k));
    const hasMatrixVar = matrixVarName !== undefined;
    const arrayVarName = Object.keys(step.variables).find(k => step.variables[k].type === 'list' && !vizDetect2DMatrix(step.variables[k], k));
    const hasArrayVar = arrayVarName !== undefined;

    if (stackFrameView) stackFrameView.style.display = 'none';
    if (flowTreeView) flowTreeView.style.display = 'none';
    svgContainer.style.display = 'none';

    if (hasLinkedStructure) {
        if (titleEl) titleEl.innerHTML = `<span><i class="fas fa-project-diagram"></i> Live Pointer & Memory Object Node Graph</span>`;
        svgContainer.style.display = 'flex';
        svgContainer.innerHTML = vizRenderLinkedStructureVisualizer(step.variables);
    } else if (hasMatrixVar) {
        if (titleEl) titleEl.innerHTML = `<span><i class="fas fa-th"></i> Live 2D Matrix / Grid (${matrixVarName})</span>`;
        svgContainer.style.display = 'flex';
        svgContainer.innerHTML = vizRenderMatrixVisualizer(step.variables[matrixVarName], matrixVarName, step.variables);
    } else if (hasStackVar) {
        if (titleEl) titleEl.innerHTML = `<span><i class="fas fa-layer-group"></i> Live LIFO Stack Visualizer (${stackVarName})</span>`;
        svgContainer.style.display = 'flex';
        svgContainer.innerHTML = vizRenderStackVisualizer(step.variables[stackVarName], stackVarName, step.variables);
    } else if (hasQueueVar) {
        if (titleEl) titleEl.innerHTML = `<span><i class="fas fa-exchange-alt"></i> Live FIFO Queue Visualizer (${queueVarName})</span>`;
        svgContainer.style.display = 'flex';
        svgContainer.innerHTML = vizRenderQueueVisualizer(step.variables[queueVarName], queueVarName, step.variables);
    } else if (hasArrayVar) {
        if (titleEl) titleEl.innerHTML = `<span><i class="fas fa-th-list"></i> Live Array & Pointer Visualizer (${arrayVarName})</span>`;
        svgContainer.style.display = 'flex';
        svgContainer.innerHTML = vizRenderArrayVisualizer(step.variables[arrayVarName], arrayVarName, step.variables);
    } else if (isRecursiveTrace && step.call_stack && step.call_stack.length > 0) {
        if (titleEl) titleEl.innerHTML = `<span><i class="fas fa-stream"></i> Memory Call Stack Inspector (Function Layers)</span>`;
        if (stackFrameView) {
            stackFrameView.style.display = 'flex';
            stackFrameView.innerHTML = step.call_stack.map((name, index) => {
                const isTopFrame = index === step.call_stack.length - 1;
                const bg = isTopFrame ? 'background: #3730a3; border-color: #6366f1; color: #fff;' : 'background: #1f2937; border-color: #374151; color: #94a3b8; opacity: 0.6;';
                return `<div style="padding: 8px 12px; border: 1px solid; border-radius: 6px; font-family: monospace; font-size: 12px; display: flex; justify-content: space-between; align-items: center; ${bg}"><span>📂 Function Frame: <b style="color: #fbbf24;">${name}()</b></span><span style="font-size: 10px; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px;">Layer ${index + 1} ${isTopFrame ? '◀' : ''}</span></div>`;
            }).join('');
        }
    } else {
        if (titleEl) titleEl.innerHTML = `<span><i class="fas fa-code-branch"></i> Live Control-Flow AST Execution Map</span>`;
        if (flowTreeView) {
            flowTreeView.style.display = 'flex';
            flowTreeView.innerHTML = vizRenderDynamicFlowTree(step);
        }
    }
}

// 2D Matrix Renderer
function vizRenderMatrixVisualizer(matrixVar, name, variables) {
    const rows = matrixVar.value || [];
    if (!rows.length) return `<div style="padding: 20px; color: #64748b; text-align: center;">Empty Matrix</div>`;

    // Detect row/col pointer variables
    const rPtrs = [], cPtrs = [];
    for (const p in variables) {
        if (p === name || p.startsWith('_')) continue;
        const v = variables[p];
        const val = (v && typeof v === 'object' && v.type === 'int') ? v.value : v;
        if (typeof val !== 'number' || !Number.isInteger(val)) continue;
        const pl = p.toLowerCase();
        if (['r', 'row', 'i', 'y', 'r1', 'r2', 'startrow', 'top', 'bottom'].includes(pl)) rPtrs.push({ name: p, value: val });
        else if (['c', 'col', 'j', 'x', 'c1', 'c2', 'startcol', 'left', 'right'].includes(pl)) cPtrs.push({ name: p, value: val });
    }

    const maxCols = Math.max(...rows.map(r => (r.value || []).length), 0);
    const cellSize = maxCols > 9 ? 32 : 38;
    const fontSize = maxCols > 9 ? 11 : 13;

    let html = `<div style="display: flex; flex-direction: column; align-items: center; max-height: 500px; overflow: auto; padding: 8px;">`;
    html += `<table style="border-collapse: separate; border-spacing: 3px; margin: 0 auto;">`;

    // Column headers
    html += `<tr><th style="width: ${cellSize}px; color: #64748b; font-size: 10px;"></th>`;
    for (let c = 0; c < maxCols; c++) {
        const colActive = cPtrs.some(cp => cp.value === c);
        const colLabel = cPtrs.filter(cp => cp.value === c).map(cp => cp.name).join(',');
        html += `<th style="padding: 2px ${cellSize/4}px; color: ${colActive ? '#f97316' : '#64748b'}; font-size: 10px; text-align: center; font-family: monospace;">${c}${colActive ? '<br><b style="color:#f97316;">↓'+colLabel+'</b>' : ''}</th>`;
    }
    html += `</tr>`;

    rows.forEach((rowObj, r) => {
        const cols = rowObj.value || [];
        const rowActive = rPtrs.some(rp => rp.value === r);
        const rowLabel = rPtrs.filter(rp => rp.value === r).map(rp => rp.name).join(',');
        html += `<tr>`;
        html += `<td style="color: ${rowActive ? '#f97316' : '#64748b'}; font-size: 10px; font-weight: bold; padding-right: 4px; font-family: monospace; white-space: nowrap; text-align: right;">${rowActive ? '<b style="color:#f97316;">'+rowLabel+'→</b>' : ''}${r}</td>`;
        for (let c = 0; c < maxCols; c++) {
            let cellVal = c < cols.length ? vizFormatVariableValue(cols[c]) : '';
            // Strip surrounding quotes for cleaner matrix display
            if (cellVal.startsWith('"') && cellVal.endsWith('"')) cellVal = cellVal.slice(1, -1);

            let isTarget = false, pLabel = '';
            rPtrs.forEach(rp => {
                cPtrs.forEach(cp => {
                    if (rp.value === r && cp.value === c) { isTarget = true; pLabel = `${rp.name},${cp.name}`; }
                });
            });

            let bg = '#1e293b', border = '#334155', color = '#e2e8f0', shadow = '';
            if (isTarget) {
                bg = 'rgba(249, 115, 22, 0.25)'; border = '#f97316'; color = '#fff'; shadow = 'box-shadow: 0 0 10px rgba(249,115,22,0.5);';
            } else if (cellVal === '.' || cellVal === '' || cellVal === '0' || cellVal === 'None') {
                color = '#475569';
            }

            // Dim empty Sudoku dots
            let displayVal = cellVal === '.' ? '<span style="opacity:0.3">.</span>' : cellVal;

            html += `<td style="width:${cellSize}px; height:${cellSize}px; border: 1.5px solid ${border}; border-radius: 5px; text-align: center; font-family: 'Fira Code', monospace; font-size: ${fontSize}px; font-weight: 600; color: ${color}; background: ${bg}; ${shadow} transition: all 0.2s; position: relative;">`;
            html += displayVal;
            if (isTarget) html += `<div style="position:absolute; top:-7px; right:-7px; background:#f97316; color:#0f172a; font-size:8px; padding:1px 3px; border-radius:3px; font-weight:bold; box-shadow:0 0 6px rgba(249,115,22,0.6); z-index:10;">${pLabel}</div>`;
            html += `</td>`;
        }
        html += `</tr>`;
    });

    html += `</table></div>`;
    return html;
}

// SVG Renderers
function vizRenderArrayVisualizer(arrayVar, name, variables) {
    const N = arrayVar.value.length;
    const svgWidth = Math.max(620, N * 55 + 100);
    const svgHeight = 200;
    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="font-family: monospace; user-select: none;">`;
    
    const startX = (svgWidth - (N * 50 - 8)) / 2;

    // Check sliding window
    const leftWinKey = Object.keys(variables).find(k => ['left', 'l', 'start'].includes(k.toLowerCase()));
    const rightWinKey = Object.keys(variables).find(k => ['right', 'r', 'end'].includes(k.toLowerCase()));
    if (leftWinKey && rightWinKey && typeof variables[leftWinKey].value === 'number' && typeof variables[rightWinKey].value === 'number') {
        const winL = variables[leftWinKey].value;
        const winR = variables[rightWinKey].value;
        if (winL >= 0 && winR >= winL && winR < N) {
            const winStartX = startX + winL * 50 - 4;
            const winWidth = (winR - winL + 1) * 50;
            svg += `<rect x="${winStartX}" y="75" width="${winWidth}" height="44" rx="6" fill="none" stroke="#f97316" stroke-width="2.5" stroke-dasharray="3,3" />`;
            svg += `<text x="${winStartX + 4}" y="68" fill="#f97316" font-size="9" font-weight="bold">SLIDING WINDOW</text>`;
        }
    }

    arrayVar.value.forEach((item, idx) => {
        const cellX = startX + idx * 50;
        const itemVal = vizFormatVariableValue(item);
        svg += `<rect x="${cellX}" y="80" width="42" height="32" rx="4" fill="#1e293b" stroke="#475569" stroke-width="1.5" />`;
        svg += `<text x="${cellX + 21}" y="100" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">${itemVal}</text>`;
        svg += `<text x="${cellX + 21}" y="126" fill="#64748b" font-size="9" text-anchor="middle">${idx}</text>`;
    });

    // Pointers
    for (const vname in variables) {
        const v = variables[vname];
        if (v && v.type === 'int' && v.value >= 0 && v.value < N) {
            const idx = v.value;
            const cellX = startX + idx * 50;
            const color = ['low', 'left', 'l', 'i'].includes(vname.toLowerCase()) ? '#10b981' : ['high', 'right', 'r', 'j'].includes(vname.toLowerCase()) ? '#3b82f6' : '#fbbf24';
            svg += `<line x1="${cellX + 21}" y1="48" x2="${cellX + 21}" y2="76" stroke="${color}" stroke-width="1.8" />`;
            svg += `<rect x="${cellX + 6}" y="32" width="30" height="15" rx="3" fill="#0f172a" stroke="${color}" stroke-width="1.2" />`;
            svg += `<text x="${cellX + 21}" y="43" fill="${color}" font-size="9" font-weight="bold" text-anchor="middle">${vname}</text>`;
        }
    }

    svg += `</svg>`;
    return svg;
}

function vizRenderStackVisualizer(stackVar, name, variables) {
    const N = stackVar.value.length;
    const svgWidth = 620;
    const svgHeight = 210;
    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="font-family: monospace; user-select: none;">`;
    
    svg += `<path d="M 265 25 L 265 185 L 365 185 L 365 25" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-dasharray="3,3" />`;
    svg += `<line x1="260" y1="186" x2="370" y2="186" stroke="#4f46e5" stroke-width="3" />`;
    svg += `<text x="315" y="200" fill="#6366f1" font-size="10" font-weight="bold" text-anchor="middle">LIFO STACK</text>`;

    if (N === 0) {
        svg += `<text x="315" y="110" fill="#64748b" font-style="italic" font-size="11" text-anchor="middle">Empty Stack</text>`;
    } else {
        stackVar.value.forEach((item, idx) => {
            const itemVal = vizFormatVariableValue(item);
            const blockY = 185 - (idx + 1) * 26 + 2;
            const isTop = idx === N - 1;
            const bg = isTop ? '#78350f' : '#1e293b';
            const stroke = isTop ? '#fbbf24' : '#475569';
            const text = isTop ? '#fef3c7' : '#cbd5e1';
            svg += `<rect x="270" y="${blockY}" width="90" height="22" rx="3" fill="${bg}" stroke="${stroke}" stroke-width="1.8" />`;
            svg += `<text x="315" y="${blockY + 14}" fill="${text}" font-size="10" font-weight="bold" text-anchor="middle">${itemVal}</text>`;
        });
        const topY = 185 - N * 26 + 13;
        svg += `<line x1="210" y1="${topY}" x2="255" y2="${topY}" stroke="#fbbf24" stroke-width="1.5" />`;
        svg += `<text x="200" y="${topY + 4}" fill="#fbbf24" font-size="9" font-weight="bold" text-anchor="end">TOP</text>`;
    }
    svg += `</svg>`;
    return svg;
}

function vizRenderQueueVisualizer(queueVar, name, variables) {
    const N = queueVar.value.length;
    const svgWidth = Math.max(620, N * 55 + 150);
    const svgHeight = 200;
    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="font-family: monospace; user-select: none;">`;
    
    svg += `<line x1="80" y1="80" x2="${svgWidth - 80}" y2="80" stroke="#10b981" stroke-width="2" stroke-dasharray="3,3" />`;
    svg += `<line x1="80" y1="120" x2="${svgWidth - 80}" y2="120" stroke="#10b981" stroke-width="2" stroke-dasharray="3,3" />`;

    if (N === 0) {
        svg += `<text x="${svgWidth / 2}" y="104" fill="#64748b" font-style="italic" font-size="11" text-anchor="middle">Empty Queue</text>`;
    } else {
        queueVar.value.forEach((item, idx) => {
            const itemVal = vizFormatVariableValue(item);
            const blockX = 100 + idx * 52;
            const isFront = idx === 0;
            const bg = isFront ? '#064e3b' : '#0d2b26';
            const stroke = isFront ? '#10b981' : '#2dd4bf';
            svg += `<rect x="${blockX}" y="85" width="44" height="30" rx="4" fill="${bg}" stroke="${stroke}" stroke-width="1.8" />`;
            svg += `<text x="${blockX + 22}" y="104" fill="#ccfbf1" font-size="11" font-weight="bold" text-anchor="middle">${itemVal}</text>`;
        });
        svg += `<text x="122" y="65" fill="#10b981" font-size="9" font-weight="bold" text-anchor="middle">FRONT (OUT)</text>`;
        const rearX = 100 + (N - 1) * 52 + 22;
        svg += `<text x="${rearX}" y="145" fill="#fbbf24" font-size="9" font-weight="bold" text-anchor="middle">REAR (IN)</text>`;
    }
    svg += `</svg>`;
    return svg;
}

function vizRenderLinkedStructureVisualizer(variables) {
    const svgWidth = 640;
    const svgHeight = 220;
    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="font-family: monospace; user-select: none;">`;

    for (const name in variables) {
        const v = variables[name];
        if (v && v.type === 'object') {
            const oid = parseInt(v.id, 10);
            const pt = vizNodePositions[oid] || { x: 320, y: 110 };
            const valStr = v.value.val || v.value.value ? vizFormatVariableValue(v.value.val || v.value.value) : "Node";

            ['next', 'left', 'right'].forEach(attr => {
                if (v.value[attr] && v.value[attr].type === 'reference') {
                    const targetId = parseInt(v.value[attr].id, 10);
                    const targetPt = vizNodePositions[targetId];
                    if (targetPt) {
                        svg += `<line x1="${pt.x}" y1="${pt.y}" x2="${targetPt.x}" y2="${targetPt.y}" stroke="#6366f1" stroke-width="2" />`;
                    }
                }
            });

            svg += `<circle cx="${pt.x}" cy="${pt.y}" r="20" fill="#1e293b" stroke="#818cf8" stroke-width="2.5" />`;
            svg += `<text x="${pt.x}" y="${pt.y + 4}" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">${valStr}</text>`;
        }
    }
    svg += `</svg>`;
    return svg;
}

function vizRenderDynamicFlowTree(step) {
    if (!vizLayoutMetadata || !vizLayoutMetadata.length) {
        return `<div style="color: #64748b; font-size: 12px; text-align: center; width: 100%;">No AST flow blocks compiled.</div>`;
    }
    let html = `<div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; width: 100%;">`;
    vizLayoutMetadata.forEach(meta => {
        const isActive = step.line === meta.line;
        const bg = isActive ? 'background: #4f46e5; border-color: #818cf8; color: #fff; font-weight: bold; transform: scale(1.05); box-shadow: 0 4px 12px rgba(99,102,241,0.4);' : 'background: #1e293b; border-color: #334155; color: #94a3b8; opacity: 0.7;';
        html += `<div style="padding: 8px 12px; border: 1px solid; border-radius: 6px; font-size: 11px; text-align: center; min-width: 100px; transition: all 0.2s; ${bg}"><div>${meta.type} (L${meta.line})</div><div style="font-size: 10px; opacity: 0.85;">${meta.code}</div></div>`;
    });
    html += `</div>`;
    return html;
}
