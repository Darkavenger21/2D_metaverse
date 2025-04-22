const socket = io('http://localhost:3000');

const config = {
  type: Phaser.AUTO,
  width: innerWidth,
  height: innerHeight,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scene: {
    preload,
    create,
    update,
  },
};

const game = new Phaser.Game(config);

let player;
let cursors;
let otherPlayers;

function preload() {
  this.load.image('Interiors', 'assets/Interiors.png');
  this.load.image('Room_Builder', 'assets/Room_Builder.png');
  this.load.tilemapTiledJSON('map', 'assets/map.json');

  // Spritesheets
  this.load.spritesheet('1_idle_down', 'assets/1_idle_down.png', { frameWidth: 16, frameHeight: 23 });
  this.load.spritesheet('1_idle_up', 'assets/1_idle_up.png', { frameWidth: 16, frameHeight: 23 });
  this.load.spritesheet('1_idle_left', 'assets/1_idle_left.png', { frameWidth: 16, frameHeight: 23 });
  this.load.spritesheet('1_idle_right', 'assets/1_idle_right.png', { frameWidth: 16, frameHeight: 23 });

  this.load.spritesheet('1_walk_down', 'assets/1_walk_down.png', { frameWidth: 16, frameHeight: 23 });
  this.load.spritesheet('1_walk_up', 'assets/1_walk_up.png', { frameWidth: 16, frameHeight: 24 });
  this.load.spritesheet('1_walk_left', 'assets/1_walk_left.png', { frameWidth: 16, frameHeight: 23 });
  this.load.spritesheet('1_walk_right', 'assets/1_walk_right.png', { frameWidth: 16, frameHeight: 23 });
}

function create() {
  const map = this.make.tilemap({ key: 'map' });
  const Interiors = map.addTilesetImage('Interiors', 'Interiors');
  const Room_Builder = map.addTilesetImage('Room_Builder', 'Room_Builder');

  map.createLayer('Tile Layer 1', [Room_Builder, Interiors], 0, 0);
  map.createLayer('2', [Room_Builder, Interiors], 0, 0);
  map.createLayer('acc', [Room_Builder, Interiors], 0, 0);

  // Colliders
  const collisionObjects = map.getObjectLayer('Collisions').objects;
  const collisionGroup = this.physics.add.staticGroup();
  collisionObjects.forEach(obj => {
    const box = this.add.rectangle(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width, obj.height);
    this.physics.add.existing(box, true);
    collisionGroup.add(box);
    box.visible = false;
  });

  // Animations
  ['up', 'down', 'left', 'right'].forEach(dir => {
    this.anims.create({
      key: `1_walk_${dir}`,
      frames: this.anims.generateFrameNumbers(`1_walk_${dir}`, { start: 0, end: 2 }),
      frameRate: 3,
      repeat: -1,
    });
    this.anims.create({
      key: `1_idle_${dir}`,
      frames: this.anims.generateFrameNumbers(`1_idle_${dir}`, { start: 0, end: 0 }),
      frameRate: 1,
      repeat: -1,
    });
  });

  cursors = this.input.keyboard.createCursorKeys();
  otherPlayers = this.physics.add.group();

  // Spawn player
  const spawnPoint = map.getObjectLayer('Spawn').objects.find(obj => obj.name === 'PlayerSpawn');
  player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, '1_idle_down');
  player.setScale(1.5);
  player.setCollideWorldBounds(true);
  this.physics.add.collider(player, collisionGroup);

  this.cameras.main.startFollow(player);
  this.cameras.main.setZoom(2);
  this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

  // Socket events
  socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach(id => {
      if (id === socket.id) {
        player.setPosition(players[id].x, players[id].y);
      } else {
        addOtherPlayer(this, players[id]);
      }
    });
  });

  socket.on('newPlayer', (newPlayer) => {
    addOtherPlayer(this, newPlayer);
  });

  socket.on('playerMoved', (movedPlayer) => {
    const other = otherPlayers.getChildren().find(p => p.playerId === movedPlayer.id);
    if (other) {
      other.setPosition(movedPlayer.x, movedPlayer.y);
    }
  });

  socket.on('playerDisconnected', (id) => {
    const other = otherPlayers.getChildren().find(p => p.playerId === id);
    if (other) other.destroy();
  });
}

function addOtherPlayer(scene, playerInfo) {
  const other = scene.physics.add.sprite(playerInfo.x, playerInfo.y, '1_idle_down');
  other.setScale(1.5);
  other.playerId = playerInfo.id;
  scene.physics.add.collider(other, scene.collisionGroup);
  otherPlayers.add(other);
}

let lastDirection = 'down';

function update() {
  if (!player) return;

  const speed = 100;
  player.setVelocity(0);

  let moved = false;

  if (cursors.left.isDown) {
    player.setVelocityX(-speed);
    player.anims.play('1_walk_left', true);
    lastDirection = 'left';
    moved = true;
  } else if (cursors.right.isDown) {
    player.setVelocityX(speed);
    player.anims.play('1_walk_right', true);
    lastDirection = 'right';
    moved = true;
  } else if (cursors.up.isDown) {
    player.setVelocityY(-speed);
    player.anims.play('1_walk_up', true);
    lastDirection = 'up';
    moved = true;
  } else if (cursors.down.isDown) {
    player.setVelocityY(speed);
    player.anims.play('1_walk_down', true);
    lastDirection = 'down';
    moved = true;
  } else {
    player.anims.play('1_idle_' + lastDirection, true);
  }

  if (moved) {
    socket.emit('playerMovement', { x: player.x, y: player.y });
  }
}
