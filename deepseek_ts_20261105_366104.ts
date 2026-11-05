import Phaser from 'phaser';
import { GameScene } from './game/scenes/GameScene';

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'app',
  backgroundColor: '#1a1510',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1600,
    height: 1000,
  },
  render: { pixelArt: true, roundPixels: true, antialias: false },
  input: { activePointers: 3 },
  scene: [GameScene],
});