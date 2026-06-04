/**
 * ImageTool — Uploads an image and places it on the canvas.
 */
import { Tool } from './Tool.js';
import { ImageElement } from '../elements/ImageElement.js';
import { AuthManager } from '../auth/AuthManager.js';
import { Toast } from '../ui/Toast.js';

export class ImageTool extends Tool {
  constructor() {
    super('image');
    this.auth = new AuthManager();
  }

  onActivate() {
    this.cm.container.style.cursor = 'default';
    
    // Create a hidden file input if we don't have one
    let fileInput = document.getElementById('image-upload-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'image-upload-input';
      fileInput.accept = 'image/png, image/jpeg, image/webp, image/gif';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
    }
    
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this._uploadImage(file);
      }
      // Switch back to select tool after picking a file
      this.inputHandler.setActiveTool('select');
      fileInput.value = ''; // Reset
    };
    
    fileInput.click();
  }

  async _uploadImage(file) {
    if (file.size > 10 * 1024 * 1024) {
      Toast.error('Image size exceeds 10MB limit');
      return;
    }

    try {
      Toast.info('Uploading image...');
      
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await this.auth.apiFetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) throw new Error('Upload failed');
      
      const data = await res.json();
      
      // Place image in center of current viewport
      const viewport = this.cm.transform.getViewportBounds(this.cm.width, this.cm.height);
      const cx = viewport.minX + viewport.width / 2;
      const cy = viewport.minY + viewport.height / 2;
      
      // We start with a default 100x100, the ImageElement will auto-resize when loaded
      const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
      const imgElement = new ImageElement({
        x: cx - 50,
        y: cy - 50,
        width: 100, 
        height: 100,
        src: API_BASE + data.url,
        createdBy: this.cm.syncManager ? this.cm.syncManager.userId : 'local'
      });
      
      this.em.setElement(imgElement);
      if (this.cm.syncManager) {
        this.cm.syncManager.broadcastCreate(imgElement);
      }
      
      Toast.success('Image added');
      
      // Wait a moment for image to load then render again to show it
      setTimeout(() => this.cm.requestStaticRender(), 500);
      
    } catch (err) {
      console.error(err);
      Toast.error('Failed to upload image');
    }
  }
}
