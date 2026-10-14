// import { Component, OnInit } from '@angular/core';

// @Component({
//   selector: 'keyboard',
//   templateUrl: './keyboard.component.html',
//   styleUrls: ['./keyboard.component.scss']
// })
// export class KeyboardComponent implements OnInit {

//   private audioContext: AudioContext;

//   private notas: { [nota: string]: number } = {
//     'C2': 130.81,
//     'C#2': 138.59,
//     'D2': 146.83,
//     'D#2': 155.56,
//     'E2': 164.81,
//     'F2': 174.61,
//     'F#2': 185.00,
//     'G2': 196.00,
//     'G#2': 207.65,
//     'A2': 220.00,
//     'A#2': 233.08,
//     'B2': 246.94,
//     'C3': 261.62,
//     'C#3': 277.18,
//     'D3': 293.66,
//     'D#3': 311.12,
//     'E3': 329.62,
//     'F3': 349.22,
//     'F#3': 369.99,
//     'G3': 391.99,
//     'G#3': 415.30,
//     'A3': 440.00,
//     'A#3': 466.16,
//     'B3': 493.88,
//     'C4': 523.25
//   };

//   constructor() {
//     this.audioContext = new AudioContext();
//   }

//   ngOnInit(): void {}

//   tocarNota(nota: string): void {
//     const frequencia = this.notas[nota];

//     if (!frequencia) {
//       return;
//     }

//     if (this.audioContext.state === 'suspended') {
//       this.audioContext.resume();
//     }

//     const oscilador = this.audioContext.createOscillator();
//     const volume = this.audioContext.createGain();

//     oscilador.type = 'triangle';
//     oscilador.frequency.value = frequencia;

//     volume.gain.setValueAtTime(
//       0.15,
//       this.audioContext.currentTime
//     );

//     volume.gain.exponentialRampToValueAtTime(
//       0.001,
//       this.audioContext.currentTime + 0.4
//     );

//     oscilador.connect(volume);
//     volume.connect(this.audioContext.destination);

//     oscilador.start();
//     oscilador.stop(this.audioContext.currentTime + 0.4);
//   }
// }
