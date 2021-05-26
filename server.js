const express = require('express');
const app = express();
const path = require('path');

const xss = require('xss');

const socket = require('socket.io');
const server = app.listen(process.env.PORT || 3000);
const io = socket(server);

const tickrate = 1000/60;

const randomstring = require('randomstring');

var players = {};
var bullets = {};
var blocks = {};
var healthDrops = {};
var ramBots = {};
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
	for (var bullet in bullets){
		for (var i = 0; i < bullets[bullet].length; i++){
			if (cirToRectCollision(bullets[bullet][i], info)) return true;
		}
	}
	for (var player in blocks){
		for (var i = 0; i < blocks[player].length; i++){
			if (rectangleCollision(blocks[player][i], info)) return true;
		}
	}
	for (var healthDrop in healthDrops){
		if (rectangleCollision(healthDrops[healthDrop], info)) return true;
	}
	for (var bot in ramBots){
		if (cirToRectCollision(ramBots[bot], info)) return true;
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
		if (Object.keys(healthDrops).length < 10){
			const id = randomstring.generate();
			healthDrops[id] = {
				dropId: id,
				width: 30,
				height: 30,
				coords: {
					x: Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1),
					y: Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1)
				},
				color: "#4ee44e"
			};
		}
		if (Object.keys(ramBots).length < 6){
			const id = randomstring.generate();
			ramBots[id] = {
				botId: id,
				health: 30,
				radius: 15,
				coords: {
					x: Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1),
					y: Math.ceil(Math.random() * 1300) * (Math.round(Math.random()) ? 1 : -1)
				},
				color: "#DF362D"
			};
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
		for (var bot in ramBots){
			var ramBotX = 0;
			var ramBotY = 0;
			emit("rbupdate", {
				botId: ramBots[bot].botId,
				radius: ramBots[bot].radius,
				health: ramBots[bot].health,
				coords: ramBots[bot].coords,
				color: ramBots[bot].color
			});
			//shake bots
			ramBots[bot].coords.x += Math.ceil(Math.random() * 10) * (Math.round(Math.random()) ? 1 : -1);
			ramBots[bot].coords.y += Math.ceil(Math.random() * 10) * (Math.round(Math.random()) ? 1 : -1);
			//bot and block collision
			for (var plr in blocks){
				for (var i = 0; i < blocks[plr].length; i++){
					if (blocks[plr][i]){
						if (cirToRectCollision(ramBots[bot], blocks[plr][i])){
							var kbX = 80;
							var kbY = 80;
							const dir = Math.atan2((ramBots[bot].coords.x - 80) - blocks[plr][i].coords.x, (ramBots[bot].coords.y - 80) - blocks[plr][i].coords.y);
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
							ramBots[bot].coords.x += Math.round(kbX * Math.cos(dir));
							ramBots[bot].coords.y += Math.round(kbY * Math.sign(dir));
							blocks[plr][i].health -= 8;
							blocks[plr][i].health = Math.round(blocks[plr][i].health);
							break;
						}
					}
				}
			}
			//calculate closest player
			const playerInfo = [];
			for (var player in players){
				const distX = ramBots[bot].coords.x - players[player].coords.x;
				const distY = ramBots[bot].coords.y - players[player].coords.y;
				const dist = Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2));
				if (!players[player].dead){
					playerInfo.push({
						playerId: players[player].id,
						dist: dist
					});
					const playerDist = playerInfo.map(player => player.dist);
					const index = playerDist.indexOf(Math.min.apply(Math, playerDist));
					if (playerInfo[index]){
						const targetPlayer = players[playerInfo[index].playerId];
						//follow closest player
						if (targetPlayer.coords.x < ramBots[bot].coords.x){
							ramBotX = -3.5;
						}
						if (targetPlayer.coords.x > ramBots[bot].coords.x){
							ramBotX = 3.5;
						}
						if (targetPlayer.coords.y < ramBots[bot].coords.y){
							ramBotY = -3.5;
						}
						if (targetPlayer.coords.y > ramBots[bot].coords.y){
							ramBotY = 3.5;
						}
					}
					if (cirToCirCollision(ramBots[bot], players[player])){
						var bkbX = 80;
						var bkbY = 80;
						var pkbX = 80;
						var pkbY = 80;
						//calculate knockback
						//prevent knocking outside of arena
						if (Math.sign(players[player].coords.x) == 1){
							if (1771 - players[player].coords.x <= 80){
								if (1771 - players[player].coords.x < 0){
									pkbX = 0;
								} else {
									pkbX = 1771 - players[player].coords.x;
								}
							}
						} else {
							if (-1771 - players[player].coords.x >= -80){
								if (-1771 - players[player].coords.x > 0){
									pkbX = 0;
								} else {
									pkbX = -1771 - players[player].coords.x;
								}
							}
						}
						if (Math.sign(players[player].coords.y) == 1){
							if (1771 - players[player].coords.y <= 80){
								if (1771 - players[player].coords.y < 0){
									pkbY = 0;
								} else {
									pkbY = 1771 - players[player].coords.y;
								}
							}
						} else {
							if (-1771 - players[player].coords.y >= -80){
								if (-1771 - players[player].coords.y > 0){
									pkbY = 0;
								} else {
									pkbY = -1771 - players[player].coords.y;
								}
							}
						}
						//prevent knocking into wall
						for (var plr in blocks){
							for (var i = 0; i < blocks[plr].length; i++){
								if (blocks[plr][i]){
									if (Math.sqrt(Math.pow(ramBots[bot].coords.x - blocks[plr][i].coords.x, 2) + Math.pow(ramBots[bot].coords.y - blocks[plr][i].coords.y, 2)) <= 155){
										if (Math.sign(players[player].coords.x) == 1){
											if (blocks[plr][i].coords.x - players[player].coords.x < 0){
													pkbX = 0;
											} else {
												pkbX = blocks[plr][i].coords.x - players[player].coords.x;
											}				
										} else {
											if (-blocks[plr][i].coords.x - players[player].coords.x > 0){
												pkbX = 0;
											} else {
												pkbX = -blocks[plr][i].coords.x - players[player].coords.x;
											}				
										}
										if (Math.sign(players[player].coords.y) == 1){
											if (blocks[plr][i].coords.y - players[player].coords.y < 0){
												pkbY = 0;
											} else {
												pkbY = blocks[plr][i].coords.y - players[player].coords.y;
											}				
										} else {
											if (-blocks[plr][i].coords.y - players[player].coords.y > 0){
												pkbY = 0;
											} else {
												pkbY = -blocks[plr][i].coords.y - players[player].coords.y;
											}				
										}
									}
								}
							}
						}
						const dir = Math.atan2((ramBots[bot].coords.x - 80) - players[player].coords.x, (ramBots[bot].coords.y - 80) - players[player].coords.y);
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
						ramBots[bot].coords.x += Math.round(bkbX * Math.cos(dir));
						ramBots[bot].coords.y += Math.round(bkbY * Math.sin(dir));
						players[player].coords.x += Math.round(pkbX * Math.cos(dir));
						players[player].coords.y += Math.round(pkbY * Math.sin(dir));
						players[player].health -= 8;
						if (players[player].health <= 0){
							players[player].dead = true;
							emit("plr-death", {
								loser: {
									username: players[player].username,
									id: players[player].id,
									color: players[player].color
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
			ramBots[bot].coords.x += ramBotX;
			ramBots[bot].coords.y += ramBotY;
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
				blocksUsed: blocks[player].length,
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
				for (var plr in blocks){
					for (var i = 0; i < blocks[plr].length; i++){
						if (blocks[plr][i]){
							const block = blocks[plr][i];
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
		for (var player in blocks){
			for (var i = 0; i < blocks[player].length; i++){
				const chunk = blocks[player][i];
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
							playerId: blocks[player][i].playerId,
							blockId: blocks[player][i].blockId
						});
						blocks[player].splice(i, 1);
					}
				}
			}
		}
	}
}

function healthDropEmit(){
	if (arePlayers){
		for (var healthDrop in healthDrops){
			emit('hdupdate', {
				dropId: healthDrops[healthDrop].dropId,
				width: healthDrops[healthDrop].width,
				height: healthDrops[healthDrop].height,
				coords: {
					x: healthDrops[healthDrop].coords.x,
					y: healthDrops[healthDrop].coords.y
				},
				color: healthDrops[healthDrop].color
			});
			for (var player in players){
				if (!players[player].dead && healthDrops[healthDrop]){
					if (cirToRectCollision(players[player], healthDrops[healthDrop])){
						emit("healthDrop-destroy", healthDrops[healthDrop].dropId);
						delete healthDrops[healthDrops[healthDrop].dropId]; //healthDrops destroy
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
			}
		}	
	}
}

function bulletEmit(){
	if (arePlayers){
		for (var plr in bullets){
			if (bullets[plr]){
				for (var i = 0; i < bullets[plr].length; i++){
					const projectile = bullets[plr][i];
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
					if (!players[plr].dead){
						bulletToPlayer(projectile, plr, i);
						bulletToWall(projectile, plr, i);
						bulletToRambot(projectile, plr, i);
					}
					if (projectile.time <= 0){
						emit("bullet-destroy", {
							playerId: projectile.playerId,
							bulletId: projectile.bulletId
						});
						bullets[plr].splice(i, 1);
						projectile.time = 10;
					}
				}
			}
		}
	}
}

function bulletToWall(projectile, plr, i){
	for (var player in players){
		for (var o = 0; o < blocks[player].length; o++){
			if (blocks[player][o]){
				if (cirToRectCollision(projectile, blocks[player][o]) && blocks[player][o]){
					blocks[player][o].health -= 10;
					blocks[player][o].health = Math.round(blocks[player][o].health);
					emit("bullet-destroy", {
						playerId: projectile.playerId,
						bulletId: projectile.bulletId
					});
					bullets[plr].splice(i, 1);
					break;
				}
			}
		}
	}
}

function bulletToPlayer(projectile, plr, i){
	for (var player in players){
		if (players[player].id !== projectile.playerId && cirToCirCollision(projectile, players[player]) && !players[player].dead && players[player]){
			players[player].health -= 10;
			players[player].health = Math.round(players[player].health);
			emit("bullet-destroy", {
				playerId: projectile.playerId,
				bulletId: projectile.bulletId
			});
			bullets[plr].splice(i, 1);
			if (players[player].health <= 0){
				players[player].dead = true;
				players[player].latestWinner.username = players[projectile.playerId].username;
				players[player].latestWinner.color = players[projectile.playerId].color;
					emit("plr-death", {
					loser: {
						username: players[player].username,
						id: players[player].id,
						color: players[player].color
					},
					winner: {
						username: players[player].latestWinner.username,
						color: players[player].latestWinner.color
					},
					type: "player"
				});
			}
			break;
		}
	}
}

function bulletToRambot(projectile, plr, i){
	for (var bot in ramBots){
		if (cirToCirCollision(projectile, ramBots[bot]) && ramBots[bot]){
			ramBots[bot].health -= 10;
			ramBots[bot].health = Math.round(ramBots[bot].health);
			emit("bullet-destroy", {
				playerId: projectile.playerId,
				bulletId: projectile.bulletId
			});
			bullets[plr].splice(i, 1);
			if (ramBots[bot].health <= 0){
				emit("rambot-destroy", ramBots[bot].botId);
				delete ramBots[bot];
			}
			break;
		}
	}
}

//main emit
setInterval(() => {
	ramBotEmit();
	playerEmit();
	blockEmit();
	bulletEmit();
	healthDropEmit();
}, tickrate);

io.on('connection', socket => {
	var loggedIn = false;
	arePlayers = true;
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
			if (blocks[socket.id].length < 60  && players[socket.id].canPlace && checkPlacement(info) == undefined && !players[socket.id].dead){
				players[socket.id].time = 5000;
				players[socket.id].pTime = 3;
				players[socket.id].canPlace = false;
				blocks[socket.id].push({
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
			}
		});
		socket.on("shoot", info => {
			if (bullets[socket.id].length < 30 && players[socket.id].canShoot && !players[socket.id].dead){
				players[socket.id].time = 5000;
				players[socket.id].bTime = 3;
				players[socket.id].canShoot = false;
				bullets[socket.id].push({
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
					color: "#72bcd4"
				});
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
				bTime: 3,
				pTime: 3,
				canShoot: true,
				canPlace: true
			};
			bullets[socket.id] = [];
			blocks[socket.id] = [];
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
		for (var bullet in bullets){
			for (var i = 0; i < bullets[bullet].length; i++){
				num++;
			}
		}
		socket.emit("bullet-numdate", num);
	});
	socket.on('disconnect', () => {
		emit("leave", socket.id);
		delete players[socket.id];
		delete bullets[socket.id];
		delete blocks[socket.id];

		if (Object.keys(players).length == 0){
			arePlayers = false;
			healthDrops = {};
			ramBots = {};
			bullets = {};
		}		
	});
});

app.use(express.static('public'));

app.get('/', (req, res) => {
	res.sendFile(path.resolve(__dirname, 'public/index.html'));
});

app.get('*', (req, res) => {
	res.sendFile(path.resolve(__dirname, 'public/error.html'));
});