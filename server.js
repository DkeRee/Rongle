const express = require('express');
const app = express();
const path = require('path');

const xss = require('xss');

const socket = require('socket.io');
const server = app.listen(process.env.PORT || 3000);
const io = socket(server);

const RBush = require('rbush');
const knn = require('rbush-knn');

class MyRBush extends RBush {
	toBBox({
		coords: {
			x: x,
			y: y
		}
	}) {
		return {
			minX: x,
			minY: y,
			maxX: x,
			maxY: y
		};
	}
	compareMinX(a, b) {
		return a.x - b.x;
	}
	compareMinY(a, b) {
		return a.y - b.y;
	}
}

const tree = new MyRBush();

const loopLimit = 30;

const tickrate = 1000/60;

const randomstring = require('randomstring');

var players = {};
var bullets = [];
var blocks = [];
var healthDrops = [];
var ramBots = [];
var colors = ["#7289da", "#FFA500", "#FFCD58", "cyan"];

var arePlayers = false;

function checkString(string){
	for (var i = 0; i < string.length; i++){
		if (string[i] !== " "){
			return true;
		}
	}
}

function checkCopy(username){
	for (var player in players){
		if (username == players[player].username){
			return false;
		}
	}
}

function cirToCirCollision(cirOne, cirTwo){
	if (cirOne && cirTwo){
		const distX = cirOne.coords.x - cirTwo.coords.x;
		const distY = cirOne.coords.y - cirTwo.coords.y;
		if (Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2)) < cirOne.radius + cirTwo.radius) return true;
	}
}

function cirToRectCollision(cir, rect){
	if (cir && rect && cir.coords){
		const distX = Math.abs(cir.coords.x - rect.coords.x - rect.width / 2);
		const distY = Math.abs(cir.coords.y - rect.coords.y - rect.height / 2);
		if (distX > (rect.width / 2 + cir.radius)) return false;
		if (distY > (rect.height / 2 + cir.radius)) return false;
		
		if (distX <= (rect.width / 2 + cir.radius)) return true;
		if (distY <= (rect.height / 2 + cir.radius)) return true;
	}
}

function rectangleCollision(rectOne, rectTwo){
	if (rectOne && rectTwo){
		if (rectOne.coords.x < rectTwo.coords.x + rectTwo.width){
			if (rectOne.coords.x + rectOne.width > rectTwo.coords.x){
				if (rectOne.coords.y < rectTwo.coords.y + rectTwo.height){
					if (rectOne.coords.y + rectOne.height > rectTwo.coords.y){
						return true;
					}
				}
			}
		}
	}
}

function checkPlacement(info){
	info.width = 50;
	info.height = 50;

	if (Math.sqrt(Math.pow(info.coords.x - players[info.playerId].coords.x, 2) + Math.pow(info.coords.y - players[info.playerId].coords.y, 2)) > 500) return true;

	if (info.coords.x < -1800 || info.coords.x > 1750) return true;
	if (info.coords.y < -1800 || info.coords.y > 1750) return true;

	for (var player in players){
		if (cirToRectCollision(players[player], info)) return true;
	}
	for (var i = 0; i < bullets.length; i++){
		if (cirToRectCollision(bullets[i], info)) return true;
	}
	for (var i = 0; i < blocks.length; i++){
		if (rectangleCollision(blocks[i], info)) return true;
	}
	for (var i = 0; i < healthDrops.length; i++){
		if (rectangleCollision(healthDrops[i], info)) return true;
	}
	for (var i = 0; i < ramBots.length; i++){
		if (cirToRectCollision(ramBots[i], info)) return true;
	}
}

function calculatePlayerSides(coord){
	if (Math.sign(coord) == 1){
		return coord + 30;
	} else {
		return coord - 30;
	}
}

function borderCheckX(coordX, coordY){
	if (calculatePlayerSides(coordX) >= 1800){
		return "right border";
	}
	if (calculatePlayerSides(coordX) <= -1800){
		return "left border";
	}
}

function borderCheckY(coordX, coordY){
	if (calculatePlayerSides(coordY) >= 1800){
		return "bottom border";
	}
	if (calculatePlayerSides(coordY) <= -1800){
		return "top border";
	}
}

function emit(type, data){
	for (var player in players){
		io.to(players[player].id).emit(type, data);
	}
}

//spawner
setInterval(() => {
	if (arePlayers){
		if (healthDrops.length < 10){
			healthDrops.push({
				type: "healthDrop",
				dropId: randomstring.generate(),
				width: 30,
				height: 30,
				coords: {
					x: Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1),
					y: Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1)
				},
				color: "#4ee44e"
			});
			tree.insert(healthDrops[healthDrops.length - 1]);
		}
		if (ramBots.length < 6){
			ramBots.push({
				type: "ramBot",
				botId: randomstring.generate(),
				health: 30,
				radius: 15,
				coords: {
					x: Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1),
					y: Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1)
				},
				color: "#DF362D"
			});
			tree.insert(ramBots[ramBots.length - 1]);
		}
	}
}, 20000);

//player respawn check
setInterval(() => {
	if (arePlayers){
		for (var player in players){
			if (!players[player].dead && players[player].health < 100){
				players[player].health++;
				players[player].health = Math.round(players[player].health);
			}
			if (players[player].dead){
				players[player].respawnTime -= 1;
				//respawning section
				if (players[player].respawnTime <= -1){
					players[player].coords.x = Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1);
					players[player].coords.y = Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1);
					players[player].health = 100;
					players[player].respawnTime = 5;
					players[player].dead = false;
					emit("plr-respawn", {
						playerId: players[player].id,
						playerColor: players[player].color
					});
				}
			}
		}
	}
}, 1000);

function ramBotEmit(){
	if (arePlayers){
		for (var i = 0; i < ramBots.length; i++){
			var ramBotX = 0;
			var ramBotY = 0;
			emit("rbupdate", {
				botId: ramBots[i].botId,
				radius: ramBots[i].radius,
				health: ramBots[i].health,
				coords: ramBots[i].coords,
				color: ramBots[i].color
			});
			//shake bots
			ramBots[i].coords.x += Math.ceil(Math.random() * 10) * (Math.round(Math.random()) ? 1 : -1);
			ramBots[i].coords.y += Math.ceil(Math.random() * 10) * (Math.round(Math.random()) ? 1 : -1);
			//calculate closest player
			const playerInfo = [];
			const closestObjects = knn(tree, ramBots[i].coords.x, ramBots[i].coords.y, loopLimit);

			for (var o = 0; o < closestObjects.length; o++){
				if (closestObjects[o].type == "player"){
					const player = closestObjects[o];

					const distX = ramBots[i].coords.x - player.coords.x;
					const distY = ramBots[i].coords.y - player.coords.y;
					const dist = Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2));
					if (!player.dead){
						playerInfo.push({
							playerId: player.id,
							dist: dist
						});
						const playerDist = playerInfo.map(player => player.dist);
						const index = playerDist.indexOf(Math.min.apply(Math, playerDist));
						if (playerInfo[index]){
							const targetPlayer = players[playerInfo[index].playerId];
							//follow closest player
							if (targetPlayer.coords.x < ramBots[i].coords.x){
								ramBotX = -3.5;
							}
							if (targetPlayer.coords.x > ramBots[i].coords.x){
								ramBotX = 3.5;
							}
							if (targetPlayer.coords.y < ramBots[i].coords.y){
								ramBotY = -3.5;
							}
							if (targetPlayer.coords.y > ramBots[i].coords.y){
								ramBotY = 3.5;
							}
						}
						if (cirToCirCollision(ramBots[i], player)){
							var bkbX = 80;
							var bkbY = 80;
							var pkbX = 80;
							var pkbY = 80;
							//calculate knockback
							//prevent knocking outside of arena
							if (Math.sign(player.coords.x) == 1){
								if (1771 - player.coords.x <= 80){
									if (1771 - player.coords.x < 0){
										pkbX = 0;
									} else {
										pkbX = 1771 - player.coords.x;
									}
								}
							} else {
								if (-1771 - player.coords.x >= -80){
									if (-1771 - player.coords.x > 0){
										pkbX = 0;
									} else {
										pkbX = -1771 - player.coords.x;
									}
								}
							}
							if (Math.sign(player.coords.y) == 1){
								if (1771 - player.coords.y <= 80){
									if (1771 - player.coords.y < 0){
										pkbY = 0;
									} else {
										pkbY = 1771 - player.coords.y;
									}
								}
							} else {
								if (-1771 - player.coords.y >= -80){
									if (-1771 - player.coords.y > 0){
										pkbY = 0;
									} else {
										pkbY = -1771 - player.coords.y;
									}
								}
							}
							//prevent knocking into wall
							const closestObjects2 = knn(tree, ramBots[i].coords.x, ramBots[i].coords.y, loopLimit);
							for (var b = 0; b < closestObjects2.length; b++){
								if (closestObjects2[b].type == "block"){
									if (closestObjects2[b]){
										const block = closestObjects2[b];
										if (Math.sqrt(Math.pow(ramBots[i].coords.x - block.coords.x, 2) + Math.pow(ramBots[i].coords.y - block.coords.y, 2)) <= 155){
											if (Math.sign(player.coords.x) == 1){
												if (block.coords.x - player.coords.x < 0){
													pkbX = 0;
												} else {
													pkbX = block.coords.x - player.coords.x;
												}				
											} else {
												if (-block.coords.x - player.coords.x > 0){
													pkbX = 0;
												} else {
													pkbX = -block.coords.x - player.coords.x;
												}				
											}
											if (Math.sign(player.coords.y) == 1){
												if (block.coords.y - player.coords.y < 0){
													pkbY = 0;
												} else {
													pkbY = block.coords.y - player.coords.y;
												}				
											} else {
												if (-block.coords.y - player.coords.y > 0){
													pkbY = 0;
												} else {
													pkbY = -block.coords.y - player.coords.y;
												}				
											}
										}
									}								
								}
							}
							const dir = Math.atan2((ramBots[i].coords.x - 80) - player.coords.x, (ramBots[i].coords.y - 80) - player.coords.y);
							//calculate direction
							if (Math.sign(ramBotX) == 1){
								pkbX = -pkbX;
								bkbX = bkbX;
							}
							if (Math.sign(ramBotX) == -1){
								pkbX = pkbX;
								bkbX = -bkbX;
							}
							if (Math.sign(ramBotY) == 1){
								pkbY = -pkbY;
								bkbY = bkbY;
							}
							if (Math.sign(ramBotY) == -1){
								pkbY = pkbY;
								bkbY = -bkbY;
							}
							//hit
							ramBots[i].coords.x += Math.round(bkbX * Math.cos(dir));
							ramBots[i].coords.y += Math.round(bkbY * Math.sin(dir));
							player.coords.x += Math.round(pkbX * Math.cos(dir));
							player.coords.y += Math.round(pkbY * Math.sin(dir));
							player.health -= 8;
							if (player.health <= 0){ //player duplicate
								player.dead = true;
								emit("plr-death", {
									loser: {
										username: player.username,
										id: player.id,
										color: player.color
									},
									winner: {
										username: "A RamBot",
										color: "#DF362D"
									},
									type: "bot"
								});					
							}
							break;
						}
					}
				}
				//bot and block collision
				for (var u = 0; u < closestObjects.length; u++){
					if (closestObjects[u].type == "block"){
						if (closestObjects[u]){
							if (cirToRectCollision(ramBots[i], closestObjects[u])){
								var kbX = 80;
								var kbY = 80;
								const dir = Math.atan2((ramBots[i].coords.x - 80) - closestObjects[u].coords.x, (ramBots[i].coords.y - 80) - closestObjects[u].coords.y);
								if (Math.sign(ramBotX) == 1){
									kbX = kbX;
								}
								if (Math.sign(ramBotX) == -1){
									kbX = -kbX;
								}
								if (Math.sign(ramBotY) == 1){
									kbY = kbY;
								}
								if (Math.sign(ramBotY) == -1){
									kbY = -kbY;
								}
								ramBots[i].coords.x += Math.round(kbX * Math.cos(dir));
								ramBots[i].coords.y += Math.round(kbY * Math.sign(dir));
								closestObjects[u].health -= 8;
								closestObjects[u].health = Math.round(closestObjects[u].health);
								break;
							}
						}								
					}
				}
			}
			ramBots[i].coords.x += ramBotX;
			ramBots[i].coords.y += ramBotY;
			if (ramBots[i].health <= 0){
				emit("rambot-destroy", ramBots[i].botId);
				tree.remove(ramBots[i]);
				ramBots.splice(i, 1);
			}
		}
	}
}

function playerEmit(){
	if (arePlayers){
		for (var player in players){
			emit('pupdate', {
				id: players[player].id,
				username: players[player].username,
				coords: players[player].coords,
				health: players[player].health,
				stamina: players[player].stamina,
				burntOut: players[player].burntOut,
				blocksUsed: players[player].blocksPlaced,
				radius: players[player].radius,
				color: players[player].color
			});
			if (players[player]){

				players[player].time -= 1;
				players[player].bTime -= 1;
				players[player].pTime -= 1;

				const keys = players[player].keys;
				//death update
				if (players[player].dead){
					players[player].health = 0;
					players[player].running = false;
					for (var key in keys){
						keys[key] = false;
					}
				}
				//movement update
				var borderX = borderCheckX(players[player].coords.x, players[player].coords.y);
				var borderY = borderCheckY(players[player].coords.x, players[player].coords.y);

				const closestObjects = knn(tree, players[player].coords.x, players[player].coords.y, loopLimit);

				for (var i = 0; i < closestObjects.length; i++){
					if (closestObjects[i].type == "block"){
						if (closestObjects[i]){
							const block = closestObjects[i];
							var leftX = block.coords.x;
							var leftSide = {
								width: 50,
								height: 50,
								coords: {
									x: leftX -= 3,
									y: block.coords.y
								}
							};
							var rightX = block.coords.x;
							var rightSide = {
								width: 50,
								height: 50,
								coords: {
									x: rightX += 3,
									y: block.coords.y
								}
							};
							var topY = block.coords.y;
							var topSide = {
								width: 50,
								height: 50,
								coords: {
									x: block.coords.x,
									y: topY -= 3
								}
							};
							var bottomY = block.coords.y;
							var bottomSide = {
								width: 50,
								height: 50,
								coords: {
									x: block.coords.x,
									y: bottomY += 3
								}
							};
							if (cirToRectCollision(players[player], leftSide)) borderX = "right border";
							if (cirToRectCollision(players[player], rightSide)) borderX = "left border";
							if (cirToRectCollision(players[player], topSide)) borderY = "bottom border";
							if (cirToRectCollision(players[player], bottomSide)) borderY = "top border";
						}
					}
				}

				if (!keys[87] && !keys[83] && !keys[68] && !keys[65]){
					players[player].running = false;
				}
				if (!keys[16]){
					players[player].running = false;
				}
				if (!players[player].burntOut){
					//running up
					if (borderY !== "top border" && keys[87] && keys[16]){
						players[player].coords.y -= 5;
						players[player].running = true;
						players[player].time = 5000;
					}
					//running down
					if (borderY !== "bottom border" && keys[83] && keys[16]){
						players[player].coords.y += 5;
						players[player].running = true;
						players[player].time = 5000;
					}
					//running right
					if (borderX !== "right border" && keys[68] && keys[16]){
						players[player].coords.x += 5;
						players[player].running = true;
						players[player].time = 5000;
					}
					//running left
					if (borderX !== "left border" && keys[65] && keys[16]){
						players[player].coords.x -= 5;
						players[player].running = true;
						players[player].time = 5000;
					}
			
					//with stamina up
					if (borderY !== "top border" && keys[87] && !keys[16]){
						players[player].coords.y -= 3;
						players[player].running = false;
						players[player].time = 5000;
					}
					//with stamina down
					if (borderY !== "bottom border" && keys[83] && !keys[16]){
						players[player].coords.y += 3;
						players[player].running = false;
						players[player].time = 5000;
					}
					//with stamina right
					if (borderX !== "right border" && keys[68] && !keys[16]){
						players[player].coords.x += 3;
						players[player].running = false;
						players[player].time = 5000;
					}
					//with stamina down
					if (borderX !== "left border" && keys[65] && !keys[16]){
						players[player].coords.x -= 3;
						players[player].running = false;
						players[player].time = 5000;
					}
				} else {
					//without stamina up
					if (borderY !== "top border" && keys[87]){
						players[player].coords.y -= 3;
						players[player].running = false;
						players[player].time = 5000;
					}
					//without stamina down
					if (borderY !== "bottom border" && keys[83]){
						players[player].coords.y += 3;
						players[player].running = false;
						players[player].time = 5000;
					}
					//without stamina right
					if (borderX !== "right border" && keys[68]){
						players[player].coords.x += 3;
						players[player].running = false;
						players[player].time = 5000;
					}
					//without stamina down
					if (borderX !== "left border" && keys[65]){
						players[player].coords.x -= 3;
						players[player].running = false;
						players[player].time = 5000;
					}				
				}
				//stamina update
				if (players[player].running){
					players[player].stamina -= 1;
				} else {
					if (players[player].stamina < 100){
						players[player].stamina += 0.7;
						if (players[player].stamina >= 100){
							players[player].stamina = 100;
							players[player].burntOut = false;
						}
					}
				}

				if (players[player].stamina <= 0){
					players[player].burntOut = true;
					players[player].running = false;
				}

				if (players[player].bTime <= 0){
					players[player].canShoot = true;
				}
				if (players[player].pTime <= 0){
					players[player].canPlace = true;
				}
				if (players[player].time <= 0){
					io.sockets.sockets.forEach(socket => {
						if (players[player] && socket.id == players[player].id){
							socket.disconnect();
						}
					});
				}
			}	
		}	
	}
}

function blockEmit(){
	if (arePlayers){
		for (var i = 0; i < blocks.length; i++){
			const chunk = blocks[i];
			if (chunk){
				emit('blo-update', {
					playerId: chunk.playerId,
					blockId: chunk.blockId,
					width: chunk.width,
					height: chunk.height,
					health: chunk.health,
					color: chunk.color,
					coords: {
						x: chunk.coords.x,
						y: chunk.coords.y
					}
				});
				if (chunk.health <= 0){
					emit("block-destroy", {
						playerId: chunk.playerId,
						blockId: chunk.blockId
					});
					players[chunk.playerId].blocksPlaced--;
					tree.remove(blocks[i]);
					blocks.splice(i, 1);
				}
			}
		}
	}
}

function healthDropEmit(){
	if (arePlayers){
		for (var i = 0; i < healthDrops.length; i++){
			emit('hdupdate', {
				dropId: healthDrops[i].dropId,
				width: healthDrops[i].width,
				height: healthDrops[i].height,
				coords: {
					x: healthDrops[i].coords.x,
					y: healthDrops[i].coords.y
				},
				color: healthDrops[i].color
			});

			const closestObjects = knn(tree, healthDrops[i].coords.x, healthDrops[i].coords.y, loopLimit);
			for (var i = 0; i < closestObjects.length; i++){
				if (closestObjects[i].type == "healthDrop"){
					if (cirToRectCollision(closestObjects[i], healthDrops[i])){
						emit("healthDrop-destroy", healthDrops[i].dropId);
						tree.remove(healthDrops[i]);
						healthDrops.splice(i, 1); //healthDrops destroy
						if (closestObjects[i].health + 10 > 100){
							const subtractedAmount = closestObjects[i].health + 10 - 100;
							const newAmount = 10 - subtractedAmount;
							closestObjects[i].health += newAmount;
						} else {
							closestObjects[i].health += 10;
						}
						break;
					}
				}
			}
		}
	}
}

function bulletEmit(){
	if (arePlayers){
		for (var i = 0; i < bullets.length; i++){
			const projectile = bullets[i];
			projectile.time -= 1;
			
			const dir = Math.atan2(projectile.targetCoords.y - projectile.screen.height / 2, projectile.targetCoords.x - projectile.screen.width / 2);
			projectile.bulletCoords.x += projectile.speed * Math.cos(dir);
			projectile.bulletCoords.y += projectile.speed * Math.sin(dir);
			emit('bupdate', {
				playerId: projectile.playerId,
				bulletId: projectile.bulletId,
				coords: {
					x: projectile.bulletCoords.x,
					y: projectile.bulletCoords.y
				},
				color: projectile.color
			});
			//detect hits
			projectile.coords = projectile.bulletCoords;
			if (!players[projectile.playerId].dead){
				const closestObjects = knn(tree, projectile.coords.x, projectile.coords.y, loopLimit);
				for (var o = 0; o < closestObjects.length; o++){
					if (closestObjects[o].type == "block"){
						if (closestObjects[o]){
							if (cirToRectCollision(projectile, closestObjects[o]) && closestObjects[o]){
								closestObjects[o].health -= 10;
								closestObjects[o].health = Math.round(closestObjects[o].health);
								emit("bullet-destroy", {
									playerId: projectile.playerId,
									bulletId: projectile.bulletId
								});
								tree.remove(bullets[i]);
								bullets.splice(i, 1);
								players[projectile.playerId].bulletsShot--;
								break;
							}
						}
					} else if (closestObjects[o].type == "player"){
						if (closestObjects[o].id !== projectile.playerId && cirToCirCollision(projectile, closestObjects[o]) && !closestObjects[o].dead && closestObjects[o]){
							closestObjects[o].health -= 10;
							closestObjects[o].health = Math.round(closestObjects[o].health);
							emit("bullet-destroy", {
								playerId: projectile.playerId,
								bulletId: projectile.bulletId
							});
							tree.remove(bullets[i]);
							bullets.splice(i, 1);
							players[projectile.playerId].bulletsShot--;
							if (closestObjects[o].health <= 0){ //player duplicate
								closestObjects[o].dead = true;
								closestObjects[o].latestWinner.username = players[projectile.playerId].username;
								closestObjects[o].latestWinner.color = players[projectile.playerId].color;
									emit("plr-death", {
									loser: {
										username: closestObjects[o].username,
										id: closestObjects[o].id,
										color: closestObjects[o].color
									},
									winner: {
										username: closestObjects[o].latestWinner.username,
										color: closestObjects[o].latestWinner.color
									},
									type: "player"
								});
							}
							break;
						}					
					} else if (closestObjects[o].type == "ramBot"){
						if (cirToCirCollision(projectile, closestObjects[o]) && closestObjects[o]){
							closestObjects[o].health -= 10;
							closestObjects[o].health = Math.round(closestObjects[o].health);
							emit("bullet-destroy", {
								playerId: projectile.playerId,
								bulletId: projectile.bulletId
							});
							tree.remove(bullets[i]);
							bullets.splice(i, 1);
							players[projectile.playerId].bulletsShot--;
							break;
						}		
					}
				}
			}
			if (projectile.time <= 0){
				emit("bullet-destroy", {
					playerId: projectile.playerId,
					bulletId: projectile.bulletId
				});
				tree.remove(bullets[i]);
				bullets.splice(i, 1);
				players[projectile.playerId].bulletsShot--;
				projectile.time = 10;
			}
		}
	}
}

function checkPlayers(){
	if (Object.keys(players).length > 0){
		arePlayers = true;
	} else {
		arePlayers = false;
		healthDrops = [];
		ramBots = [];
		bullets = [];
	}	
}


//main emit
setInterval(() => {
	checkPlayers();
	bulletEmit(); //circle
	playerEmit(); //circle
	blockEmit(); //square
	ramBotEmit(); //circle
	healthDropEmit(); //square
}, tickrate);

io.on('connection', socket => {
	var loggedIn = false;
	socket.emit("setup");
	function setup(){
		socket.on('movement', keys => {
			if (!players[socket.id].dead){
				players[socket.id].keys = keys;
			}
		});
		socket.on("place", info => {
			info.playerId = socket.id;
			info.coords.x = Math.round((players[socket.id].coords.x + info.coords.x - info.screen.width / 2 - 34) / 50) * 50;
			info.coords.y = Math.round((players[socket.id].coords.y + info.coords.y - info.screen.height / 2 - 25) / 50) * 50;
			if (players[socket.id].blocksPlaced < 40  && players[socket.id].canPlace && checkPlacement(info) == undefined && !players[socket.id].dead){
				players[socket.id].time = 5000;
				players[socket.id].pTime = 5;
				players[socket.id].canPlace = false;
				players[info.playerId].blocksPlaced++;
				blocks.push({
					type: "block",
					playerId: socket.id,
					blockId: randomstring.generate(),
					health: 50,
					width: 50,
					height: 50,
					color: "white",
					coords: {
						x: info.coords.x,
						y: info.coords.y
					}
				});
				tree.insert(blocks[blocks.length - 1]);
			}
		});
		socket.on("shoot", info => {
			if (players[socket.id].bulletsShot < 30 && players[socket.id].canShoot && !players[socket.id].dead){
				players[socket.id].time = 5000;
				players[socket.id].bTime = 5;
				players[socket.id].canShoot = false;
				players[socket.id].bulletsShot++;
				bullets.push({
					type: "bullet",
					playerId: socket.id,
					radius: 6,
					bulletId: randomstring.generate(),
					speed: 30,
					time: 50,
					screen: {
						width: info.screen.width,
						height: info.screen.height
					},
					bulletCoords: {
						x: players[socket.id].coords.x,
						y: players[socket.id].coords.y
					},
					targetCoords: {
						x: info.coords.x,
						y: info.coords.y
					},
					coords: {
						x: players[socket.id].coords.x,
						y: players[socket.id].coords.y
					},
					color: "#72bcd4"
				});
				tree.insert(bullets[bullets.length - 1]);
			}
		});
		socket.on("send", msg => {
			const message = xss(msg.trim());
			if (loggedIn && message.length !== 0 && message.length <= 100 && checkString(message)){
				players[socket.id].time = 5000;
				emit("recieve", {
					msg: message,
					username: players[socket.id].username,
					color: players[socket.id].color
				});
			} else if (msg.length > 100){
				socket.disconnect();
			}
		});
	}
	socket.on('join', nickname => {
		const username = nickname.trim();
		if (!loggedIn && username.length !== 0 && username.length <= 16 && checkString(username) && checkCopy(username) !== false){
			players[socket.id] = {
				type: "player",
				id: socket.id,
				username: username,
				radius: 26,
				coords: {
					x: Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1),
					y: Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1)
				},
				keys: {},
				color: colors[Math.floor(Math.random() * colors.length)],
				health: 100,
				dead: false,
				respawnTime: 5,
				latestWinner: {
					username: null,
					color: null
				},
				stamina: 100,
				running: false,
				burntOut: false,
				time: 5000,
				bTime: 5,
				pTime: 5,
				blocksPlaced: 0,
				bulletsShot: 0,
				canShoot: true,
				canPlace: true
			};
			tree.insert(players[socket.id]);
			setup();
			socket.emit('joining');
			emit('plr-joined', {
				username: username,
				color: players[socket.id].color
			});
			loggedIn = true;
		} else if (username.length > 16){
			socket.disconnect();
		} else if (checkString(username) == undefined){
			socket.emit("warning", {
				header: "Uh Oh",
				warning: "Please enter a valid nickname!"
			});
		} else if (!checkCopy(username)){
			socket.emit("warning", {
				header: "Uh Oh",
				warning: "This nickname has been taken."
			});
		}
	});
	socket.on("bullet-num", () => {
		var num = 0;
		for (var i = 0; i < bullets.length; i++){
			num++;
		}
		socket.emit("bullet-numdate", num);
	});
	socket.on('disconnect', () => {
		emit("leave", socket.id);
		for (var i = 0; i < blocks.length; i++){
			if (blocks[i].playerId == socket.id){
				tree.remove(blocks[i]);
				blocks.splice(i, 1);
			}
		}

		for (var i = 0; i < bullets.length; i++){
			if (bullets[i].playerId == socket.id){
				tree.remove(bullets[i]);
				bullets.splice(i, 1);
			}
		}

		tree.remove(players[socket.id]);
		delete players[socket.id];
	});
});

app.use(express.static('public'));

app.get('/', (req, res) => {
	res.sendFile(path.resolve(__dirname, 'public/index.html'));
});

app.get('*', (req, res) => {
	res.sendFile(path.resolve(__dirname, 'public/error.html'));
});