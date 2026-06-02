/**
 * WebRTCManager — Handles P2P mesh networking for real-time collaboration.
 * Uses WebRTC DataChannels for ultra-low latency direct browser-to-browser sync.
 */

export class WebRTCManager {
  constructor(syncManager, wsClient, localUserId) {
    this.sync = syncManager;
    this.ws = wsClient;
    this.localUserId = localUserId;
    
    // Map of targetUserId -> RTCPeerConnection
    this.peers = new Map();
    // Map of targetUserId -> RTCDataChannel
    this.dataChannels = new Map();
    
    this._bindWebSocketSignals();
  }

  _bindWebSocketSignals() {
    this.ws.on('peer_joined', this._onPeerJoined.bind(this));
    this.ws.on('peer_left', this._onPeerLeft.bind(this));
    
    this.ws.on('webrtc_offer', this._onOffer.bind(this));
    this.ws.on('webrtc_answer', this._onAnswer.bind(this));
    this.ws.on('webrtc_ice', this._onIceCandidate.bind(this));
  }

  // --- Peer Lifecycle ---

  async _onPeerJoined(msg) {
    const peerId = msg.userId;
    if (peerId === this.localUserId) return;
    
    // The peer who was already in the room initiates the connection
    console.log(`[WebRTC] Peer joined: ${peerId}, initiating connection...`);
    const pc = this._createPeerConnection(peerId);
    
    // Create Data Channel
    const dc = pc.createDataChannel('board_sync', {
      ordered: false, // Unreliable UDP-like delivery for speed
      maxRetransmits: 0
    });
    this._setupDataChannel(peerId, dc);
    
    // Create Offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      this.ws.send('webrtc_offer', {
        targetUserId: peerId,
        sdp: offer
      });
    } catch (err) {
      console.error('[WebRTC] Error creating offer:', err);
    }
  }

  _onPeerLeft(msg) {
    const peerId = msg.userId;
    console.log(`[WebRTC] Peer left: ${peerId}, cleaning up...`);
    this._cleanupPeer(peerId);
  }

  _cleanupPeer(peerId) {
    if (this.dataChannels.has(peerId)) {
      this.dataChannels.get(peerId).close();
      this.dataChannels.delete(peerId);
    }
    if (this.peers.has(peerId)) {
      this.peers.get(peerId).close();
      this.peers.delete(peerId);
    }
  }

  // --- WebRTC Signaling ---

  _createPeerConnection(peerId) {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send('webrtc_ice', {
          targetUserId: peerId,
          candidate: event.candidate
        });
      }
    };

    pc.ondatachannel = (event) => {
      this._setupDataChannel(peerId, event.channel);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection with ${peerId} state:`, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this._cleanupPeer(peerId);
      }
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  _setupDataChannel(peerId, dc) {
    dc.onopen = () => console.log(`[WebRTC] DataChannel OPEN with ${peerId}`);
    dc.onclose = () => console.log(`[WebRTC] DataChannel CLOSED with ${peerId}`);
    dc.onerror = (err) => console.error(`[WebRTC] DataChannel ERROR with ${peerId}:`, err);
    
    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleDataChannelMessage(peerId, msg);
      } catch (err) {
        console.error('[WebRTC] Failed to parse datachannel message', err);
      }
    };

    this.dataChannels.set(peerId, dc);
  }

  async _onOffer(msg) {
    const payload = msg.payload;
    const peerId = msg.userId;
    if (peerId === this.localUserId) return;
    
    console.log(`[WebRTC] Received offer from ${peerId}`);
    
    let pc = this.peers.get(peerId);
    if (!pc) {
      pc = this._createPeerConnection(peerId);
    }
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      this.ws.send('webrtc_answer', {
        targetUserId: peerId,
        sdp: answer
      });
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err);
    }
  }

  async _onAnswer(msg) {
    const payload = msg.payload;
    const peerId = msg.userId;
    const pc = this.peers.get(peerId);
    
    if (pc) {
      console.log(`[WebRTC] Received answer from ${peerId}`);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } catch (err) {
        console.error('[WebRTC] Error setting remote description from answer:', err);
      }
    }
  }

  async _onIceCandidate(msg) {
    const payload = msg.payload;
    const peerId = msg.userId;
    const pc = this.peers.get(peerId);
    
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
    }
  }

  // --- Data Channel Messaging (P2P) ---

  _handleDataChannelMessage(peerId, msg) {
    // Inject peer info so SyncManager knows where it came from
    msg.userId = peerId;
    
    switch (msg.type) {
      case 'element_create':
        this.sync._onRemoteCreate(msg);
        break;
      case 'element_update':
        this.sync._onRemoteUpdate(msg);
        break;
      case 'element_delete':
        this.sync._onRemoteDelete(msg);
        break;
      case 'cursor_move':
        msg.userName = msg.payload.userName;
        this.sync.presenceSync._onRemoteCursor(msg);
        break;
    }
  }

  // Send a message to ALL connected peers directly
  broadcast(type, payload) {
    const msgString = JSON.stringify({ type, payload });
    
    for (const [peerId, dc] of this.dataChannels.entries()) {
      if (dc.readyState === 'open') {
        try {
          dc.send(msgString);
        } catch (err) {
          console.error(`[WebRTC] Failed to send to ${peerId}:`, err);
        }
      }
    }
  }

  destroy() {
    for (const peerId of this.peers.keys()) {
      this._cleanupPeer(peerId);
    }
  }
}
