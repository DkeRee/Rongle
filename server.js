const express = require('express');
const app = express();
const path = require('path');

const xss = require('xss');

const socket = require('socket.io');
const server = app.listen(process.env.PORT || 3000);
const io = socket(server);

const RBush = require('rbush');
const knn = require('rbush-knn');

const serverInfo = {
	respawn: true,
	spawn: true
};

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

const loopLimit = 7;

const tickrate = 1000/60;

const randomstring = require('randomstring');

const deletionQueue = [];

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

	const closestPlayers = knn(tree, info.coords.x, info.coords.y, loopLimit, item => {
		return item.type == "player";
	});
	const closestBullets = knn(tree, info.coords.x, info.coords.y, loopLimit, item => {
		return item.type == "bullet";
	});
	const closestBlocks = knn(tree, info.coords.x, info.coords.y, loopLimit, item => {
		return item.type == "block";
	});
	const closestHealthDrops = knn(tree, info.coords.x, info.coords.y, loopLimit, item => {
		return item.type == "healthDrop";
	});
	const closestRamBots = knn(tree, info.coords.x, info.coords.y, loopLimit, item => {
		return item.type == "ramBot";
	});

	if (info.coords.x < -1800 || info.coords.x > 1750) return true;
	if (info.coords.y < -1800 || info.coords.y > 1750) return true;

	for (var i = 0; i < closestPlayers.length; i++){
		if (cirToRectCollision(closestPlayers[i], info)) return true;
	}
	for (var i = 0; i < closestBullets.length; i++){
		if (cirToRectCollision(closestBullets[i], info)) return true;
	}
	for (var i = 0; i < closestBlocks.length; i++){
		if (rectangleCollision(closestBlocks[i], info)) return true;
	}
	for (var i = 0; i < closestHealthDrops.length; i++){
		if (rectangleCollision(closestHealthDrops[i], info)) return true;
	}
	for (var i = 0; i < closestRamBots.length; i++){
		if (cirToRectCollision(closestRamBots[i], info)) return true;
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
			
			const closestPlayers = knn(tree, ramBots[i].coords.x, ramBots[i].coords.y, loopLimit, item => {
				return item.type == "player";
			});
			const closestBlocks = knn(tree, ramBots[i].coords.x, ramBots[i].coords.y, loopLimit, item => {
				return item.type == "block";
			});

			for (var o = 0; o < closestPlayers.length; o++){
				const player = closestPlayers[o];
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
						if (targetPlayer){
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
					}
					for (var u = 0; u < closestBlocks.length; u++){
						if (closestBlocks[u]){
							const block = closestBlocks[u];
							if (cirToRectCollision(ramBots[i], block)){
								var kbX = 80;
								var kbY = 80;
								const dir = Math.atan2((ramBots[i].coords.x - 80) - block.coords.x, (ramBots[i].coords.y - 80) - block.coords.y);
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

								if (block.health > 0){
									block.health -= 10;
									block.health = Math.round(block.health);

									emit('blo-update', {
										playerId: block.playerId,
										blockId: block.blockId,
										width: block.width,
										height: block.height,
										health: block.health,
										color: block.color,
										coords: {
											x: block.coords.x,
											y: block.coords.y
										}
									});
									break;
								} else {
									if (players[block.playerId]){
										emit('blo-update', {
											playerId: block.playerId,
											blockId: block.blockId,
											width: block.width,
											height: block.height,
											health: block.health,
											color: block.color,
											coords: {
												x: block.coords.x,
												y: block.coords.y
											}
										});
										emit("block-destroy", {
											playerId: block.playerId,
											blockId: block.blockId
										});
										players[block.playerId].blocksPlaced--;
										tree.remove(block);
										blocks.splice(block.index, 1);
										break;
									}
								}
							}								
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
						for (var b = 0; b < closestBlocks.length; b++){
							if (closestBlocks[b]){
								const block = closestBlocks[b];
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

				const closestBlocks = knn(tree, players[player].coords.x, players[player].coords.y, loopLimit, item => {
					return item.type == "block";
				});
				const closestHealthDrops = knn(tree, players[player].coords.x, players[player].coords.y, loopLimit, item => {
					return item.type == "healthDrop";
				});

				for (var h = 0; h < closestHealthDrops.length; h++){
					if (cirToRectCollision(players[player], closestHealthDrops[h])){
						emit("healthDrop-destroy", closestHealthDrops[h].dropId);
						tree.remove(closestHealthDrops[h]);
						healthDrops.splice(closestHealthDrops[h].index, 1); //healthDrops destroy
						if (players[player].health + 10 > 100){
							const subtractedAmount = players[player].health + 10 - 100;
							const newAmount = 10 - subtractedAmount;
							players[player].health += newAmount;
						} else {
							players[player].health += 10;
						}
						break;
					}
				}

				for (var i = 0; i < closestBlocks.length; i++){
					if (closestBlocks[i]){
						const block = closestBlocks[i];
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
				const closestBlocks = knn(tree, projectile.coords.x, projectile.coords.y, loopLimit, item => {
					return item.type == "block";
				});
				const closestPlayers = knn(tree, projectile.coords.x, projectile.coords.y, loopLimit, item => {
					return item.type == "player";
				});
				const closestRamBots = knn(tree, projectile.coords.x, projectile.coords.y, loopLimit, item => {
					return item.type == "ramBot";
				});

				for (var o = 0; o < closestBlocks.length; o++){
					if (closestBlocks[o]){
						if (cirToRectCollision(projectile, closestBlocks[o]) && closestBlocks[o] && players[projectile.playerId]){
							if (closestBlocks[o].health <= 0){
								emit('blo-update', {
									playerId: closestBlocks[o].playerId,
									blockId: closestBlocks[o].blockId,
									width: closestBlocks[o].width,
									height: closestBlocks[o].height,
									health: closestBlocks[o].health,
									color: closestBlocks[o].color,
									coords: {
										x: closestBlocks[o].coords.x,
										y: closestBlocks[o].coords.y
									}
								});

								emit("bullet-destroy", {
									playerId: projectile.playerId,
									bulletId: projectile.bulletId
								});
								tree.remove(bullets[i]);
								bullets.splice(i, 1);
								players[projectile.playerId].bulletsShot--;								

								emit("block-destroy", {
									playerId: closestBlocks[o].playerId,
									blockId: closestBlocks[o].blockId
								});
								if (players[closestBlocks[o].playerId]){
									players[closestBlocks[o].playerId].blocksPlaced--;
									tree.remove(closestBlocks[o]);
									blocks.splice(closestBlocks[o].index, 1);
								}
								break;
							} else {
								closestBlocks[o].health -= 10;
								closestBlocks[o].health = Math.round(closestBlocks[o].health);
								emit("bullet-destroy", {
									playerId: projectile.playerId,
									bulletId: projectile.bulletId
								});
								tree.remove(bullets[i]);
								bullets.splice(i, 1);
								players[projectile.playerId].bulletsShot--;

								emit('blo-update', {
									playerId: closestBlocks[o].playerId,
									blockId: closestBlocks[o].blockId,
									width: closestBlocks[o].width,
									height: closestBlocks[o].height,
									health: closestBlocks[o].health,
									color: closestBlocks[o].color,
									coords: {
										x: closestBlocks[o].coords.x,
										y: closestBlocks[o].coords.y
									}
								});
								break;
							}
						}
					}
				}
				for (var p = 0; p < closestPlayers.length; p++){
					if (closestPlayers[p].id !== projectile.playerId && cirToCirCollision(projectile, closestPlayers[p]) && !closestPlayers[p].dead && closestPlayers[p]){
						closestPlayers[p].health -= 10;
						closestPlayers[p].health = Math.round(closestPlayers[p].health);
						emit("bullet-destroy", {
							playerId: projectile.playerId,
							bulletId: projectile.bulletId
						});
						tree.remove(bullets[i]);
						bullets.splice(i, 1);
						players[projectile.playerId].bulletsShot--;
						if (closestPlayers[p].health <= 0){ //player duplicate
							closestPlayers[p].dead = true;
							closestPlayers[p].latestWinner.username = closestPlayers[p].username;
							closestPlayers[p].latestWinner.color = players[projectile.playerId].color;
								emit("plr-death", {
								loser: {
									username: closestPlayers[p].username,
									id: closestPlayers[p].id,
									color: closestPlayers[p].color
								},
								winner: {
									username: closestPlayers[p].latestWinner.username,
									color: closestPlayers[p].latestWinner.color
								},
								type: "player"
							});
						}
						break;
					}					
				}
				for (var u = 0; u < closestRamBots.length; u++){
					if (cirToCirCollision(projectile, ramBots[u]) && ramBots[u]){
						ramBots[u].health -= 10;
						ramBots[u].health = Math.round(ramBots[u].health);
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

function spawn(){
	if (arePlayers){
		if (serverInfo.spawn){
			if (healthDrops.length < 10){
				var index;

				if (healthDrops.length == 0){
					index = 0;
				} else {
					index = healthDrops.length;
				}	

				healthDrops.push({
					type: "healthDrop",
					dropId: randomstring.generate(),
					width: 30,
					height: 30,
					index: index,
					coords: {
						x: Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1),
						y: Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1)
					},
					color: "#4ee44e"
				});
				tree.insert(healthDrops[index]);
				emit('hdupdate', {
					dropId: healthDrops[index].dropId,
					width: healthDrops[index].width,
					height: healthDrops[index].height,
					coords: {
						x: healthDrops[index].coords.x,
						y: healthDrops[index].coords.y
					},
					color: healthDrops[index].color
				});
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
			serverInfo.spawn = false;
			setTimeout(() => {
				serverInfo.spawn = true;
			}, 20000);
		}
	}
}

function respawn(){
	if (arePlayers){
		if (serverInfo.respawn){
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
			serverInfo.respawn = false;
			setTimeout(() => {
				serverInfo.respawn = true;
			}, 1000);
		}
	}
}

function checkDeletion(){
	if (arePlayers){
		for (var i = 0; i < deletionQueue.length; i++){
			const socket = deletionQueue[i];

			for (var o = 0; o < blocks.length;){
				if (blocks[o].playerId == socket){
					emit("block-destroy", {
						playerId: blocks[o].playerId,
						blockId: blocks[o].blockId
					});
					tree.remove(blocks[o]);
					blocks.splice(o, 1);				
				} else {
					o++;
				}
			}

			for (var o = 0; o < bullets.length;){
				if (bullets[o].playerId == socket){
					emit("bullet-destroy", {
						playerId: bullets[o].playerId,
						bulletId: bullets[o].bulletId
					});
					tree.remove(bullets[o]);
					bullets.splice(o, 1);				
				} else {
					o++;
				}			
			}

			tree.remove(players[socket]);
			delete players[socket];
			emit("leave", socket);
		}
	}
}

//main emit
setInterval(() => {
	checkPlayers();
	spawn();
	respawn();
	ramBotEmit(); //circle
	playerEmit(); //circle
	bulletEmit(); //circle
	checkDeletion();
}, tickrate);

io.on('connection', socket => {
	var loggedIn = false;
	socket.emit("setup");
	function setup(){
		socket.on('movement', keys => {
			if (typeof keys == 'object'){
				if (!players[socket.id].dead){
					players[socket.id].keys = keys;
				}
			} else {
				socket.disconnect();
			}
		});
		socket.on("place", info => {
			if (typeof info.screen.width == 'number' && typeof info.screen.height == 'number' && typeof info.coords.x == 'number' && typeof info.coords.y == 'number'){
				info.playerId = socket.id;
				info.coords.x = Math.round((players[socket.id].coords.x + info.coords.x - info.screen.width / 2 - 34) / 50) * 50;
				info.coords.y = Math.round((players[socket.id].coords.y + info.coords.y - info.screen.height / 2 - 25) / 50) * 50;

				var index;

				if (blocks.length == 0){
					index = 0;
				} else {
					index = blocks.length;
				}

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
						index: index,
						color: "white",
						coords: {
							x: info.coords.x,
							y: info.coords.y
						}
					});
					tree.insert(blocks[index]);
					emit('blo-update', {
						playerId: blocks[index].playerId,
						blockId: blocks[index].blockId,
						width: blocks[index].width,
						height: blocks[index].height,
						health: blocks[index].health,
						color: blocks[index].color,
						coords: {
							x: blocks[index].coords.x,
							y: blocks[index].coords.y
						}
					});
				}
			} else {
				socket.disconnect();
			}
		});
		socket.on("shoot", info => {
			if (typeof info.screen.width == 'number' && typeof info.screen.height == 'number' && typeof info.coords.x == 'number' && typeof info.coords.y == 'number'){
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
			} else {
				socket.disconnect();
			}
		});
		socket.on("send", msg => {
			if (typeof msg == 'string'){
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
			} else {
				socket.disconnect();
			}
		});
	}
	socket.on('join', nickname => {
		if (typeof nickname == 'string'){
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
		} else {
			socket.disconnect();
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
		deletionQueue.push(socket.id);
	});
});

app.use(express.static('public'));

app.get('/', (req, res) => {
	res.sendFile(path.resolve(__dirname, 'public/index.html'));
});

app.get('*', (req, res) => {
	res.sendFile(path.resolve(__dirname, 'public/error.html'));
});