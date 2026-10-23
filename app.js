/* QuickImage Tools — compatible with the simple index.html currently in the project.
   Supports local browser-only resize, compress, convert, and crop for JPG/PNG/WebP. */
(() => {
  'use strict';

  const MAX_FILE_BYTES = 30 * 1024 * 1024;
  const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const toolNames = {
    resize: 'Resize Image',
    compress: 'Compress Image',
    convert: 'Convert Image',
    crop: 'Crop Image'
  };

  let activeTool = null;
  let selectedFile = null;
  let sourceImage = null;
  let sourceUrl = null;
  let outputUrl = null;
  let controlPanel = null;
  let previewPanel = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    const year = document.getElementById('current-year');
    if (year) year.textContent = String(new Date().getFullYear());

    const input = document.getElementById('image-input');
    const status = document.getElementById('tool-status');
    const workspace = document.getElementById('workspace');
    const uploadArea = workspace?.querySelector('.upload-area');
    const privacyNote = workspace?.querySelector('.privacy-note');

    if (!input || !status || !workspace || !uploadArea || !privacyNote) {
      console.error('QuickImage Tools: Required elements were not found in index.html.');
      return;
    }

    addSupportStyles();

    controlPanel = document.createElement('div');
    controlPanel.id = 'qit-controls';
    controlPanel.className = 'qit-panel';
    controlPanel.hidden = true;
    uploadArea.insertAdjacentElement('afterend', controlPanel);

    previewPanel = document.createElement('div');
    previewPanel.id = 'qit-preview';
    previewPanel.className = 'qit-preview';
    previewPanel.hidden = true;
    controlPanel.insertAdjacentElement('afterend', previewPanel);

    initializeToolCards();

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (file) loadSelectedFile(file);
    });

    setStatus('Choose a tool above, then select an image. Your image stays on this device.', 'info');
  }

  function addSupportStyles() {
    if (document.getElementById('qit-support-styles')) return;
    const style = document.createElement('style');
    style.id = 'qit-support-styles';
    style.textContent = `
      .tool-button.qit-selected { outline: 3px solid currentColor; outline-offset: 3px; }
      .qit-panel, .qit-preview { margin-top: 1rem; padding: 1rem; border: 1px solid #d8dee8; border-radius: 12px; background: #fff; color: #172033; }
      .qit-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); gap: 12px; margin: 1rem 0; }
      .qit-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; font-size: .95rem; }
      .qit-field input:not([type=checkbox]):not([type=range]), .qit-field select { box-sizing: border-box; width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid #b8c2d1; border-radius: 7px; background: white; color: #172033; font: inherit; }
      .qit-check { display: flex; align-items: center; gap: 8px; margin: .5rem 0; }
      .qit-primary, .qit-secondary { display: inline-block; margin: .5rem .5rem .2rem 0; padding: 10px 15px; border: 0; border-radius: 8px; cursor: pointer; font: inherit; }
      .qit-primary { background: #1e40af; color: #fff; } .qit-secondary { background: #e8edf5; color: #172033; }
      .qit-image { display: block; max-width: 100%; max-height: 360px; margin: 12px auto; object-fit: contain; border-radius: 8px; }
      .qit-muted { font-size: .9rem; color: #5b6473; overflow-wrap: anywhere; }
      .qit-status-error { color: #b42318 !important; } .qit-status-success { color: #157347 !important; }
      #image-input { max-width: 100%; }
    `;
    document.head.appendChild(style);
  }

  // Make each tool card usable even if the CSS hides its original button or
  // the HTML version accidentally omitted that button.
  function initializeToolCards() {
    document.querySelectorAll('.tool-card').forEach((card) => {
      let button = card.querySelector('button[data-tool], .tool-button[data-tool]');
      let tool = button?.dataset.tool;

      if (!tool) {
        const heading = (card.querySelector('h3')?.textContent || '').toLowerCase();
        if (heading.includes('resize')) tool = 'resize';
        else if (heading.includes('compress')) tool = 'compress';
        else if (heading.includes('convert')) tool = 'convert';
        else if (heading.includes('crop')) tool = 'crop';
      }
      if (!tool || !Object.prototype.hasOwnProperty.call(toolNames, tool)) return;

      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'tool-button';
        button.dataset.tool = tool;
        button.textContent = 'Open tool';
        card.appendChild(button);
      }

      // Override accidental CSS rules that make the button invisible or unclickable.
      button.style.setProperty('display', 'inline-block', 'important');
      button.style.setProperty('visibility', 'visible', 'important');
      button.style.setProperty('opacity', '1', 'important');
      button.style.setProperty('pointer-events', 'auto', 'important');
      button.style.setProperty('position', 'relative', 'important');
      button.style.setProperty('z-index', '2', 'important');
      button.style.setProperty('margin-top', '12px', 'important');
      button.style.setProperty('padding', '9px 14px', 'important');
      button.style.setProperty('border-radius', '8px', 'important');
      button.style.setProperty('border', '1px solid #c7d2e3', 'important');
      button.style.setProperty('background', '#eaf0ff', 'important');
      button.style.setProperty('color', '#172033', 'important');
      button.style.setProperty('cursor', 'pointer', 'important');
      button.style.setProperty('font', 'inherit', 'important');

      if (!button.dataset.qitBound) {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          chooseTool(tool);
        });
        button.dataset.qitBound = 'true';
      }

      card.style.setProperty('cursor', 'pointer', 'important');
      if (!card.dataset.qitCardBound) {
        card.addEventListener('click', (event) => {
          if (event.target.closest('button, input, a, select, textarea')) return;
          chooseTool(tool);
        });
        card.dataset.qitCardBound = 'true';
      }
    });
  }

  function chooseTool(tool) {
    if (!Object.prototype.hasOwnProperty.call(toolNames, tool)) return;
    activeTool = tool;
    document.querySelectorAll('.tool-button[data-tool]').forEach((button) => {
      const selected = button.dataset.tool === tool;
      button.classList.toggle('qit-selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });

    const heading = document.getElementById('workspace-heading');
    const intro = document.querySelector('#workspace > p:not(.privacy-note)');
    if (heading) heading.textContent = toolNames[tool];
    if (intro) intro.textContent = selectedFile
      ? `Ready to ${tool === 'resize' ? 'resize' : tool === 'compress' ? 'compress' : tool === 'convert' ? 'convert' : 'crop'} ${selectedFile.name}.`
      : `Select an image below to ${tool === 'resize' ? 'change its dimensions' : tool === 'compress' ? 'reduce its file size' : tool === 'convert' ? 'change its format' : 'crop the area you need'}.`;

    if (selectedFile && sourceImage) buildControls();
    else {
      controlPanel.hidden = true;
      previewPanel.hidden = true;
      setStatus(`Selected: ${toolNames[tool]}. Now choose an image.`, 'info');
    }
    document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function loadSelectedFile(file) {
    if (!SUPPORTED_TYPES.has(file.type)) {
      setStatus('Please choose a JPG, PNG, or WebP image.', 'error');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setStatus('That image is larger than 30 MB. Please choose a smaller file.', 'error');
      return;
    }

    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    sourceUrl = URL.createObjectURL(file);
    outputUrl = null;
    selectedFile = file;
    sourceImage = new Image();

    sourceImage.onload = () => {
      const w = sourceImage.naturalWidth;
      const h = sourceImage.naturalHeight;
      if (!w || !h || w * h > 40000000 || w > 8192 || h > 8192) {
        sourceImage = null;
        setStatus('This image is too large to process safely in this browser. Try an image under 40 megapixels and no edge over 8192 pixels.', 'error');
        return;
      }
      if (activeTool) buildControls();
      else {
        controlPanel.hidden = true;
        previewPanel.hidden = false;
        previewPanel.innerHTML = `<strong>Image selected</strong><p class="qit-muted"></p><img class="qit-image" alt="Selected image preview">`;
        previewPanel.querySelector('p').textContent = `${file.name} · ${w} × ${h} px · ${formatBytes(file.size)}`;
        previewPanel.querySelector('img').src = sourceUrl;
        setStatus('Image loaded. Choose Resize, Compress, Convert, or Crop above to continue.', 'success');
      }
      const intro = document.querySelector('#workspace > p:not(.privacy-note)');
      if (intro && activeTool) intro.textContent = `${file.name} · ${w} × ${h} px`;
    };
    sourceImage.onerror = () => {
      sourceImage = null;
      setStatus('The browser could not read that image. Please try another JPG, PNG, or WebP file.', 'error');
    };
    sourceImage.src = sourceUrl;
  }

  function buildControls() {
    if (!selectedFile || !sourceImage || !activeTool || !controlPanel) return;
    controlPanel.hidden = false;
    previewPanel.hidden = true;
    controlPanel.replaceChildren();

    const title = document.createElement('h3');
    title.textContent = `${toolNames[activeTool]} settings`;
    controlPanel.appendChild(title);

    const meta = document.createElement('p');
    meta.className = 'qit-muted';
    meta.textContent = `${selectedFile.name} · ${sourceImage.naturalWidth} × ${sourceImage.naturalHeight} px · ${formatBytes(selectedFile.size)}`;
    controlPanel.appendChild(meta);

    const grid = document.createElement('div');
    grid.className = 'qit-grid';
    controlPanel.appendChild(grid);

    if (activeTool === 'resize') buildResizeControls(grid);
    if (activeTool === 'compress') buildFormatAndQualityControls(grid, true);
    if (activeTool === 'convert') buildFormatAndQualityControls(grid, false);
    if (activeTool === 'crop') buildCropControls(grid);

    const run = document.createElement('button');
    run.type = 'button';
    run.className = 'qit-primary';
    run.textContent = activeTool === 'resize' ? 'Resize image' : activeTool === 'compress' ? 'Compress image' : activeTool === 'convert' ? 'Convert image' : 'Crop image';
    run.addEventListener('click', () => processImage(run));
    controlPanel.appendChild(run);

    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'qit-secondary';
    preview.textContent = 'Show original preview';
    preview.addEventListener('click', () => {
      previewPanel.hidden = false;
      previewPanel.replaceChildren();
      const title = document.createElement('strong');
      title.textContent = 'Original image preview';
      const img = document.createElement('img');
      img.className = 'qit-image';
      img.alt = 'Original selected image';
      img.src = sourceUrl;
      const info = document.createElement('p');
      info.className = 'qit-muted';
      info.textContent = `${sourceImage.naturalWidth} × ${sourceImage.naturalHeight} px`;
      previewPanel.append(title, info, img);
    });
    controlPanel.appendChild(preview);
    setStatus('Adjust the settings, then select the action button.', 'info');
  }

  function addField(parent, labelText, input, id) {
    const wrapper = document.createElement('label');
    wrapper.className = 'qit-field';
    if (id) wrapper.htmlFor = id;
    const label = document.createElement('span');
    label.textContent = labelText;
    wrapper.append(label, input);
    parent.appendChild(wrapper);
    return input;
  }

  function numberInput(id, value, min = 1, max = 8192) {
    const input = document.createElement('input');
    input.type = 'number'; input.id = id; input.min = String(min); input.max = String(max); input.step = '1'; input.value = String(value); input.required = true;
    return input;
  }

  function buildResizeControls(grid) {
    const originalW = sourceImage.naturalWidth;
    const originalH = sourceImage.naturalHeight;
    const width = numberInput('qit-width', originalW);
    const height = numberInput('qit-height', originalH);
    addField(grid, 'Width (px)', width, width.id);
    addField(grid, 'Height (px)', height, height.id);
    const checkWrap = document.createElement('label');
    checkWrap.className = 'qit-check';
    const keep = document.createElement('input');
    keep.type = 'checkbox'; keep.checked = true;
    const label = document.createElement('span'); label.textContent = 'Keep aspect ratio';
    checkWrap.append(keep, label); grid.appendChild(checkWrap);
    width.addEventListener('input', () => {
      if (keep.checked && Number(width.value) > 0) height.value = String(Math.max(1, Math.round(Number(width.value) * originalH / originalW)));
    });
    height.addEventListener('input', () => {
      if (keep.checked && Number(height.value) > 0) width.value = String(Math.max(1, Math.round(Number(height.value) * originalW / originalH)));
    });
  }

  function addFormatSelect(grid, id, options, initial) {
    const select = document.createElement('select'); select.id = id;
    options.forEach((item) => {
      const option = document.createElement('option'); option.value = item.value; option.textContent = item.label; select.appendChild(option);
    });
    select.value = initial;
    addField(grid, 'Output format', select, id);
    return select;
  }

  function buildFormatAndQualityControls(grid, isCompress) {
    const defaultMime = isCompress ? selectedFile.type : 'image/jpeg';
    const format = addFormatSelect(grid, 'qit-format', [
      { value: 'original', label: 'Keep original format' },
      { value: 'image/jpeg', label: 'JPEG (.jpg)' },
      { value: 'image/png', label: 'PNG (.png)' },
      { value: 'image/webp', label: 'WebP (.webp)' }
    ], isCompress ? 'original' : defaultMime);
    if (!isCompress) format.value = 'image/jpeg';

    const quality = document.createElement('input');
    quality.type = 'range'; quality.id = 'qit-quality'; quality.min = '10'; quality.max = '100'; quality.step = '1'; quality.value = '85';
    const qualityLabel = document.createElement('label'); qualityLabel.className = 'qit-field'; qualityLabel.htmlFor = quality.id;
    const heading = document.createElement('span'); heading.textContent = 'Quality: 85%';
    qualityLabel.append(heading, quality); grid.appendChild(qualityLabel);
    quality.addEventListener('input', () => { heading.textContent = `Quality: ${quality.value}%`; });
    const note = document.createElement('p'); note.className = 'qit-muted'; note.textContent = 'Quality setting affects JPEG and WebP. PNG is lossless, so its file size may not shrink much.';
    grid.appendChild(note);
  }

  function buildCropControls(grid) {
    const w = sourceImage.naturalWidth;
    const h = sourceImage.naturalHeight;
    const cropW = Math.max(1, Math.round(w * 0.8));
    const cropH = Math.max(1, Math.round(h * 0.8));
    addField(grid, 'Start X (px)', numberInput('qit-crop-x', Math.floor((w - cropW) / 2), 0, w - 1), 'qit-crop-x');
    addField(grid, 'Start Y (px)', numberInput('qit-crop-y', Math.floor((h - cropH) / 2), 0, h - 1), 'qit-crop-y');
    addField(grid, 'Crop width (px)', numberInput('qit-crop-w', cropW, 1, w), 'qit-crop-w');
    addField(grid, 'Crop height (px)', numberInput('qit-crop-h', cropH, 1, h), 'qit-crop-h');
    const format = addFormatSelect(grid, 'qit-format', [
      { value: 'original', label: 'Keep original format' },
      { value: 'image/jpeg', label: 'JPEG (.jpg)' },
      { value: 'image/png', label: 'PNG (.png)' },
      { value: 'image/webp', label: 'WebP (.webp)' }
    ], 'original');
    format.setAttribute('aria-label', 'Crop output format');
  }

  async function processImage(button) {
    if (!selectedFile || !sourceImage || !activeTool) {
      setStatus('Choose a tool and select an image first.', 'error');
      return;
    }
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Processing…';
    setStatus('Processing your image in this browser…', 'info');

    try {
      let width = sourceImage.naturalWidth;
      let height = sourceImage.naturalHeight;
      let sx = 0, sy = 0, sw = sourceImage.naturalWidth, sh = sourceImage.naturalHeight;
      let mime = selectedFile.type;
      let quality = 0.85;

      if (activeTool === 'resize') {
        width = readInteger('qit-width', 1, 8192);
        height = readInteger('qit-height', 1, 8192);
      } else if (activeTool === 'compress' || activeTool === 'convert') {
        mime = readMime('qit-format', selectedFile.type);
        quality = Number(document.getElementById('qit-quality').value) / 100;
      } else if (activeTool === 'crop') {
        sx = readInteger('qit-crop-x', 0, sourceImage.naturalWidth - 1);
        sy = readInteger('qit-crop-y', 0, sourceImage.naturalHeight - 1);
        sw = readInteger('qit-crop-w', 1, sourceImage.naturalWidth);
        sh = readInteger('qit-crop-h', 1, sourceImage.naturalHeight);
        if (sx + sw > sourceImage.naturalWidth || sy + sh > sourceImage.naturalHeight) {
          throw new Error('The crop rectangle extends beyond the image. Reduce the crop width or height, or change its starting position.');
        }
        width = sw; height = sh;
        mime = readMime('qit-format', selectedFile.type);
      }

      if (width * height > 40000000 || width > 8192 || height > 8192) {
        throw new Error('Output dimensions are too large. Use dimensions below 8192 pixels per side and 40 megapixels total.');
      }

      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Your browser could not create an image-processing canvas.');
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
      }
      if (activeTool === 'crop') {
        ctx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, width, height);
      } else {
        ctx.drawImage(sourceImage, 0, 0, width, height);
      }

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('The browser could not export this format. Try a different output format.')), mime, quality);
      });
      if (!SUPPORTED_TYPES.has(blob.type)) throw new Error('The browser did not produce a supported image format. Try JPEG, PNG, or WebP.');
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      outputUrl = URL.createObjectURL(blob);
      showResult(blob, outputUrl, width, height, activeTool);
    } catch (error) {
      setStatus(error && error.message ? error.message : 'Image processing failed. Please try again.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function readInteger(id, min, max) {
    const input = document.getElementById(id);
    const value = Number(input?.value);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`Enter a whole number from ${min} to ${max} for ${id.replace('qit-', '').replaceAll('-', ' ')}.`);
    }
    return value;
  }

  function readMime(id, fallback) {
    const value = document.getElementById(id)?.value || 'original';
    return value === 'original' ? fallback : value;
  }

  function showResult(blob, url, width, height, tool) {
    previewPanel.hidden = false;
    previewPanel.replaceChildren();
    const title = document.createElement('h3'); title.textContent = 'Your processed image is ready';
    const info = document.createElement('p'); info.className = 'qit-muted';
    info.textContent = `${width} × ${height} px · ${formatBytes(blob.size)} · ${blob.type.split('/')[1].toUpperCase()}`;
    const img = document.createElement('img'); img.className = 'qit-image'; img.alt = 'Processed image preview'; img.src = url;
    const download = document.createElement('a');
    download.className = 'qit-primary'; download.href = url; download.download = makeOutputName(selectedFile.name, tool, blob.type); download.textContent = 'Download image';
    previewPanel.append(title, info, img, download);
    const difference = selectedFile.size ? Math.round((1 - blob.size / selectedFile.size) * 100) : 0;
    const note = document.createElement('p'); note.className = 'qit-muted';
    note.textContent = tool === 'compress' ? (difference >= 0 ? `File size changed by ${difference}% smaller.` : `The output is ${Math.abs(difference)}% larger than the original; try a lower quality or another format.`) : 'The file is ready to download.';
    previewPanel.appendChild(note);
    setStatus('Done! Your processed image is ready to download.', 'success');
    previewPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function makeOutputName(filename, tool, mime) {
    const base = filename.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_') || 'image';
    const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
    const suffix = tool === 'resize' ? 'resized' : tool === 'compress' ? 'compressed' : tool === 'convert' ? 'converted' : 'cropped';
    return `${base}-${suffix}.${ext}`;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function setStatus(message, kind) {
    const status = document.getElementById('tool-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('qit-status-error', kind === 'error');
    status.classList.toggle('qit-status-success', kind === 'success');
    status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  }

  window.addEventListener('beforeunload', () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
  });
})();
