// Audio Engine for Binaural Beats and Ambient Cosmic Drone
// Uses Web Audio API

class SacredAudioEngine {
  constructor() {
    this.ctx = null;
    
    // Nodes
    this.leftOsc = null;
    this.rightOsc = null;
    this.leftGain = null;
    this.rightGain = null;
    this.merger = null;
    
    // Ambient drone nodes
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.droneFilter = null;
    this.droneGain = null;
    
    // Master Node
    this.masterGain = null;
    
    // Configuration
    this.carrierFreq = 200; // Hz
    this.beatFreq = 6;     // 6Hz (Theta wave default)
    this.isAudioStarted = false;
    this.isPlaying = false;
    this.volume = 0.5;
    
    // ADHD dynamic flow configuration
    this.isAdhdFlow = false;
  }

  init() {
    if (this.ctx) return;
    
    // Create Audio Context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Create Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
    
    // Create Channel Merger for Stereo Isolation
    this.merger = this.ctx.createChannelMerger(2);
    this.merger.connect(this.masterGain);
    
    // Left & Right gain nodes for the carrier and offset
    this.leftGain = this.ctx.createGain();
    this.rightGain = this.ctx.createGain();
    
    // Connect to merger: Input 0 = Left, Input 1 = Right
    this.leftGain.connect(this.merger, 0, 0);
    this.rightGain.connect(this.merger, 0, 1);
    
    // Create Drone Nodes
    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.setValueAtTime(80, this.ctx.currentTime); // Deep hum
    this.droneFilter.Q.setValueAtTime(1, this.ctx.currentTime);
    
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.12, this.ctx.currentTime); // Soft background
    
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);
    
    this.isAudioStarted = true;
    console.log("Web Audio Context initialized.");
  }

  setVolume(val) {
    this.volume = parseFloat(val);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.1);
    }
  }

  setBeatFrequency(freq) {
    if (freq === 'adhd') {
      this.isAdhdFlow = true;
      if (this.isPlaying) {
        this.modulateAdhdFrequency();
      }
    } else {
      this.isAdhdFlow = false;
      this.beatFreq = parseFloat(freq);
      if (this.isPlaying) {
        this.updateOscillatorFrequencies();
      }
    }
    console.log(`Binaural beat frequency set to: ${freq}`);
  }

  modulateAdhdFrequency() {
    if (!this.isAdhdFlow || !this.isPlaying || !this.ctx) return;
    
    const now = this.ctx.currentTime;
    
    // Smoothly cycle frequency between 4Hz (Delta) and 24Hz (Gamma boundary) every 25 seconds
    const period = 25; // seconds
    const minFreq = 4;
    const maxFreq = 24;
    const midFreq = (minFreq + maxFreq) / 2;
    const range = (maxFreq - minFreq) / 2;
    
    const wave = Math.sin(now * (2 * Math.PI / period));
    this.beatFreq = midFreq + wave * range;
    
    this.updateOscillatorFrequencies();
    
    // Dispatch spatial frequency update to reflect in UI
    window.dispatchEvent(new CustomEvent('adhd-freq-change', {
      detail: { frequency: this.beatFreq.toFixed(1) }
    }));
    
    setTimeout(() => {
      if (this.isAdhdFlow && this.isPlaying) {
        this.modulateAdhdFrequency();
      }
    }, 300); // high fidelity modulation refresh
  }

  updateOscillatorFrequencies() {
    if (!this.ctx || !this.isPlaying) return;
    
    const now = this.ctx.currentTime;
    
    // Left channel gets Carrier Frequency (e.g. 200 Hz)
    if (this.leftOsc) {
      this.leftOsc.frequency.setValueAtTime(this.carrierFreq, now);
    }
    
    // Right channel gets Carrier + Beat Frequency (e.g. 200 + 6 = 206 Hz)
    if (this.rightOsc) {
      this.rightOsc.frequency.setValueAtTime(this.carrierFreq + this.beatFreq, now);
    }
  }

  start() {
    this.init();
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    if (this.isPlaying) return;
    
    const now = this.ctx.currentTime;
    
    // 1. Setup Binaural Beats Oscillators
    this.leftOsc = this.ctx.createOscillator();
    this.leftOsc.type = 'sine';
    this.leftOsc.frequency.setValueAtTime(this.carrierFreq, now);
    
    this.rightOsc = this.ctx.createOscillator();
    this.rightOsc.type = 'sine';
    this.rightOsc.frequency.setValueAtTime(this.carrierFreq + this.beatFreq, now);
    
    // Set gains
    this.leftGain.gain.setValueAtTime(0.18, now);
    this.rightGain.gain.setValueAtTime(0.18, now);
    
    // Connect oscillators to gains
    this.leftOsc.connect(this.leftGain);
    this.rightOsc.connect(this.rightGain);
    
    // Start oscillators
    this.leftOsc.start(now);
    this.rightOsc.start(now);
    
    // 2. Setup Ambient Low-Frequency Hum (Cosmic Drone / Om)
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sine';
    this.droneOsc1.frequency.setValueAtTime(50, now); // 50 Hz fundamental
    
    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.setValueAtTime(75.5, now); // minor third overtone (warmth)
    
    // Low frequency modulation (breathing filter)
    this.modulateDroneFilter();
    
    this.droneOsc1.connect(this.droneFilter);
    this.droneOsc2.connect(this.droneFilter);
    
    this.droneOsc1.start(now);
    this.droneOsc2.start(now);
    
    this.isPlaying = true;
    console.log("Audio generators started.");
    
    // If ADHD flow is enabled, start the active frequency modulator immediately
    if (this.isAdhdFlow) {
      this.modulateAdhdFrequency();
    }
  }

  stop() {
    if (!this.isPlaying) return;
    
    const now = this.ctx.currentTime;
    
    // Fade out master gain to prevent pops
    this.masterGain.gain.setValueAtTime(this.volume, now);
    this.masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    setTimeout(() => {
      // Stop oscillators
      try {
        if (this.leftOsc) this.leftOsc.stop();
        if (this.rightOsc) this.rightOsc.stop();
        if (this.droneOsc1) this.droneOsc1.stop();
        if (this.droneOsc2) this.droneOsc2.stop();
      } catch (e) {
        console.warn("Error stopping oscillators:", e);
      }
      
      // Cleanup references
      this.leftOsc = null;
      this.rightOsc = null;
      this.droneOsc1 = null;
      this.droneOsc2 = null;
      
      this.isPlaying = false;
      
      // Restore master volume level for next play
      if (this.masterGain) {
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      }
      
      console.log("Audio generators stopped.");
    }, 550);
  }

  modulateDroneFilter() {
    if (!this.ctx || !this.isPlaying || !this.droneFilter) return;
    
    // Modulate low-pass filter frequency up and down slowly to simulate gentle breathing
    const now = this.ctx.currentTime;
    
    // Sweep filter frequency between 60Hz and 110Hz every 8 seconds (very slow breathing)
    this.droneFilter.frequency.setValueAtTime(this.droneFilter.frequency.value, now);
    this.droneFilter.frequency.linearRampToValueAtTime(105, now + 4);
    this.droneFilter.frequency.linearRampToValueAtTime(65, now + 8);
    
    // Loop modulation
    setTimeout(() => {
      if (this.isPlaying) {
        this.modulateDroneFilter();
      }
    }, 8000);
  }

  // Play a soft, beautiful spatial chime in left then right channel
  testHeadphones(callbackLeft, callbackRight, callbackDone) {
    this.init();
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    const now = this.ctx.currentTime;
    
    // Step 1: Play chime in Left channel
    callbackLeft();
    this.playSpatialChime(0); // Left channel
    
    // Step 2: Play chime in Right channel after 1.5 seconds
    setTimeout(() => {
      callbackRight();
      this.playSpatialChime(1); // Right channel
    }, 1500);
    
    // Step 3: Complete test after 3 seconds
    setTimeout(() => {
      callbackDone();
    }, 3000);
  }

  playSpatialChime(channelIndex) {
    const now = this.ctx.currentTime;
    
    // Create dedicated nodes for the chime test
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();
    const spatialGainLeft = this.ctx.createGain();
    const spatialGainRight = this.ctx.createGain();
    
    // Sound design: Frequencies of a crystal chime
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5 fundamental
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now); // C6 clear octave overtone
    
    // Envelope: Quick attack (0.01s), exponential decay (1.2s)
    chimeGain.gain.setValueAtTime(0, now);
    chimeGain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    
    // Channel routing based on left/right selection
    spatialGainLeft.gain.setValueAtTime(channelIndex === 0 ? 1 : 0, now);
    spatialGainRight.gain.setValueAtTime(channelIndex === 1 ? 1 : 0, now);
    
    // Connect oscillators
    osc1.connect(chimeGain);
    osc2.connect(chimeGain);
    
    // Connect chimeGain to left/right channel gains
    chimeGain.connect(spatialGainLeft);
    chimeGain.connect(spatialGainRight);
    
    // Connect to merger
    spatialGainLeft.connect(this.merger, 0, 0);  // Output to Left Channel
    spatialGainRight.connect(this.merger, 0, 1); // Output to Right Channel
    
    // Start and Stop
    osc1.start(now);
    osc2.start(now);
    
    osc1.stop(now + 1.3);
    osc2.stop(now + 1.3);
  }
}

// Global audio engine instance
const audio = new SacredAudioEngine();
