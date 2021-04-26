const express = require('express');
const app = express();
const path = require('path');

const socket = require('socket.io');
const server = app.listen(process.env.PORT || 3000);
const io = socket(server);

const tickrate = 1000/60;

const randomstring = require('randomstring');

const players = {};
const bullets = {};
const healthDrops = {};
const ramBots = {};
const colors = ["#7289da", "#FFA500", "#FFCD58", "cyan"];

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

function checkShooting(id){
	for (var player in players){
		if (player == id && players[player].bTime >= 120){
			players[player].bTime = 0;
			return true;
		}
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

//timer
setInterval(() => {
	for (var player in players){
		players[player].bTime += 1;
		players[player].time -= 1;
		if (players[player].time <= 0){
			io.sockets.sockets.forEach(socket => {
				if (players[player] && socket.id == players[player].id){
					socket.disconnect();
				}
			});
		}
	}
}, 1);

//bullet timer
setInterval(() => {
	for (var bullet in bullets){
		for (var i = 0; i < bullets[bullet].length; i++){
			const projectile = bullets[bullet][i];
			projectile.time -= 1;
			if (projectile.time <= 0){
				bullets[bullet].splice(i, 1);
				io.emit("bullet-destroy", {
					playerId: projectile.playerId,
					bulletId: projectile.bulletId
				});
			}
		}
	}
}, 1);

//spawner
setInterval(() => {
	if (Object.keys(healthDrops).length <= 10){
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
	if (Object.keys(ramBots).length <= 10){
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
}, 20000);

//player respawn check
setInterval(() => {
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
				io.emit("plr-respawn", {
					playerId: players[player].id,
					playerColor: players[player].color
				});
			}
		}
	}
}, 1000);

//ramBot emit
setInterval(() => {
	for (var bot in ramBots){
		io.emit("rbupdate", {
			botId: ramBots[bot].botId,
			radius: ramBots[bot].radius,
			health: ramBots[bot].health,
			coords: ramBots[bot].coords,
			color: ramBots[bot].color
		});

		//shake bots
		ramBots[bot].coords.x += Math.ceil(Math.random() * 10) * (Math.round(Math.random()) ? 1 : -1);
		ramBots[bot].coords.y += Math.ceil(Math.random() * 10) * (Math.round(Math.random()) ? 1 : -1);

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

				if (41 > dist){
					var kbX = 120;
					var kbY = 120;

					//calculate knockback
					if (Math.sign(players[player].coords.x) == 1){
						if (1771 - players[player].coords.x <= 120){
							kbX = 1771 - players[player].coords.x;
						}
					} else {
						if (-1771 - players[player].coords.x >= -120){
							kbX = -1771 - players[player].coords.x;
						}
					}

					if (Math.sign(players[player].coords.y) == 1){
						if (1771 - players[player].coords.y <= 120){
							kbY = 1771 - players[player].coords.y;
						}
					} else {
						if (-1771 - players[player].coords.y >= -120){
							kbY = -1771 - players[player].coords.y;
						}
					}

					ramBots[bot].coords.x += Math.ceil(Math.random() * 120) * (Math.round(Math.random()) ? 1 : -1);
					ramBots[bot].coords.y += Math.ceil(Math.random() * 120) * (Math.round(Math.random()) ? 1 : -1);
					players[player].coords.x += Math.ceil(Math.random() * kbX) * (Math.round(Math.random()) ? 1 : -1);
					players[player].coords.y += Math.ceil(Math.random() * kbY) * (Math.round(Math.random()) ? 1 : -1);
					ramBots[bot].health -= 1;
					players[player].health -= 4;
					if (players[player].health <= 0){
						players[player].dead = true;
						players[player].health = 0;
						io.emit("plr-death", {
							loser: {
								username: players[player].username,
								id: players[player].id,
								color: players[player].color
							},
							winner: {
								username: "A RAMBOT",
								color: "#DF362D"
							},
							type: "bot"
						});					
					}
					if (ramBots[bot].health <= 0){
						io.emit("rambot-destroy", ramBots[bot].botId);
						delete ramBots[bot];
					}
				}
			}
		}

		const playerDist = playerInfo.map(player => player.dist);
		const index = playerDist.indexOf(Math.min.apply(Math, playerDist));
		if (playerInfo[index] && ramBots[bot]){
			const targetPlayer = players[playerInfo[index].playerId];

			//follow closest player
			if (targetPlayer.coords.x < ramBots[bot].coords.x){
				ramBots[bot].coords.x -= 3.5;
			}
			if (targetPlayer.coords.x > ramBots[bot].coords.x){
				ramBots[bot].coords.x += 3.5;
			}
			if (targetPlayer.coords.y < ramBots[bot].coords.y){
				ramBots[bot].coords.y -= 3.5;
			}
			if (targetPlayer.coords.y > ramBots[bot].coords.y){
				ramBots[bot].coords.y += 3.5;
			}
		}
	}
}, tickrate);

//player emit
setInterval(() => {
	for (var player in players){
		io.emit('pupdate', {
			id: players[player].id,
			username: players[player].username,
			coords: players[player].coords,
			health: players[player].health,
			stamina: players[player].stamina,
			burntOut: players[player].burntOut,
			radius: players[player].radius,
			color: players[player].color
		});
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
	}
}, tickrate);

//bullet emit
setInterval(() => {
	for (var bullet in bullets){
		for (var i = 0; i < bullets[bullet].length; i++){
			const projectile = bullets[bullet][i];
			const dir = Math.atan2(projectile.targetCoords.y - projectile.screen.height / 2, projectile.targetCoords.x - projectile.screen.width / 2);

			projectile.bulletCoords.x += projectile.speed * Math.cos(dir);
			projectile.bulletCoords.y += projectile.speed * Math.sin(dir);

			io.emit('bupdate', {
				playerId: projectile.playerId,
				bulletId: projectile.bulletId,
				coords: {
					x: projectile.bulletCoords.x,
					y: projectile.bulletCoords.y
				},
				color: projectile.color
			});

			for (var player in players){
				if (!players[player].dead){
					const distX = projectile.bulletCoords.x - players[player].coords.x;
					const distY = projectile.bulletCoords.y - players[player].coords.y;
					if (players[player].id !== projectile.playerId && 32 > Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2)) && !players[player].dead){
						players[player].health -= 5;
						players[player].health = Math.round(players[player].health);
						bullets[bullet].splice(i, 1);
						io.emit("bullet-destroy", {
							playerId: projectile.playerId,
							bulletId: projectile.bulletId
						});
					}
					if (players[player].health <= 0){
						players[player].dead = true;
						players[player].health = 0;
						players[player].latestWinner.username = players[projectile.playerId].username;
						players[player].latestWinner.color = players[projectile.playerId].color;
						io.emit("plr-death", {
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
				}
			}
			for (var bot in ramBots){
				const distX = projectile.bulletCoords.x - ramBots[bot].coords.x;
				const distY = projectile.bulletCoords.y - ramBots[bot].coords.y;
				if (21 > Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2))){
					ramBots[bot].health -= 5;
					ramBots[bot].health = Math.round(ramBots[bot].health);
					bullets[bullet].splice(i, 1);
					io.emit("bullet-destroy", {
						playerId: projectile.playerId,
						bulletId: projectile.bulletId
					});
					if (ramBots[bot].health <= 0){
						io.emit("rambot-destroy", ramBots[bot].botId);
						delete ramBots[bot];
					}
				}
			}
		}
	}
}, tickrate);

//healthdrop emit
setInterval(() => {
	for (var healthDrop in healthDrops){
		io.emit('hdupdate', {
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
				const cx = players[player].coords.x;
				const cy = players[player].coords.y;

				const sx = healthDrops[healthDrop].coords.x;
				const sy = healthDrops[healthDrop].coords.y;
				const sw = healthDrops[healthDrop].width;
				const sh = healthDrops[healthDrop].height;

				var testX = cx
				var testY = cy

				if (cx < sx){
					testX = sx;
				} else if (cx > sx + sw){
					testX = sx + sw;
				}
				if (cy < sy){
					testY = sy;
				} else if (cy > sy + sh){
					testY = sy + sh;
				}

				const distX = cx - testX;
				const distY = cy - testY;
				const distance = Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2));

				if (distance <= 26){
					io.emit("healthDrop-destroy", healthDrops[healthDrop].dropId);
					delete healthDrops[healthDrops[healthDrop].dropId];
					if (players[player].health + 10 > 100){
						const subtractedAmount = players[player].health + 10 - 100;
						const newAmount = 10 - subtractedAmount;
						players[player].health += newAmount;
					} else {
						players[player].health += 10;
					}
				}
			}
		}
	}
}, tickrate);

io.on('connection', socket => {
	var loggedIn = false;
	socket.emit("setup");

	function setup(){
		socket.on('movement', keys => {
			if (!players[socket.id].dead){
				const borderX = borderCheckX(players[socket.id].coords.x, players[socket.id].coords.y);
				const borderY = borderCheckY(players[socket.id].coords.x, players[socket.id].coords.y);

				if (!keys[87] && !keys[83] && !keys[68] && !keys[65]){
					players[socket.id].running = false;
				}

				if (!keys[16]){
					players[socket.id].running = false;
				}

				if (!players[socket.id].burntOut){
					//running up
					if (borderY !== "top border" && keys[87] && keys[16]){
						players[socket.id].coords.y -= 5;
						players[socket.id].running = true;
						players[socket.id].time = 60000;
					}
					//running down
					if (borderY !== "bottom border" && keys[83] && keys[16]){
						players[socket.id].coords.y += 5;
						players[socket.id].running = true;
						players[socket.id].time = 60000;
					}
					//running right
					if (borderX !== "right border" && keys[68] && keys[16]){
						players[socket.id].coords.x += 5;
						players[socket.id].running = true;
						players[socket.id].time = 60000;
					}
					//running left
					if (borderX !== "left border" && keys[65] && keys[16]){
						players[socket.id].coords.x -= 5;
						players[socket.id].running = true;
						players[socket.id].time = 60000;
					}
			

					//with stamina up
					if (borderY !== "top border" && keys[87] && !keys[16]){
						players[socket.id].coords.y -= 3;
						players[socket.id].running = false;
						players[socket.id].time = 60000;
					}
					//with stamina down
					if (borderY !== "bottom border" && keys[83] && !keys[16]){
						players[socket.id].coords.y += 3;
						players[socket.id].running = false;
						players[socket.id].time = 60000;
					}
					//with stamina right
					if (borderX !== "right border" && keys[68] && !keys[16]){
						players[socket.id].coords.x += 3;
						players[socket.id].running = false;
						players[socket.id].time = 60000;
					}
					//with stamina down
					if (borderX !== "left border" && keys[65] && !keys[16]){
						players[socket.id].coords.x -= 3;
						players[socket.id].running = false;
						players[socket.id].time = 60000;
					}
				} else {
					//without stamina up
					if (borderY !== "top border" && keys[87]){
						players[socket.id].coords.y -= 3;
						players[socket.id].running = false;
						players[socket.id].time = 60000;
					}
					//without stamina down
					if (borderY !== "bottom border" && keys[83]){
						players[socket.id].coords.y += 3;
						players[socket.id].running = false;
						players[socket.id].time = 60000;
					}
					//without stamina right
					if (borderX !== "right border" && keys[68]){
						players[socket.id].coords.x += 3;
						players[socket.id].running = false;
						players[socket.id].time = 60000;
					}
					//without stamina down
					if (borderX !== "left border" && keys[65]){
						players[socket.id].coords.x -= 3;
						players[socket.id].running = false;
						players[socket.id].time = 60000;
					}				
				}
			}
		});

		socket.on("shoot", info => {
			if (bullets[socket.id].length <= 30 && checkShooting(socket.id) && !players[socket.id].dead){
				players[socket.id].time = 60000;
				bullets[socket.id].push({
					playerId: socket.id,
					bulletId: randomstring.generate(),
					speed: 30,
					time: 800,
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
			const message = msg.trim();
			if (loggedIn && message.length !== 0 && message.length <= 100 && checkString(message)){
				players[socket.id].time = 60000;
				io.emit("recieve", {
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
				time: 60000,
				bTime: 0
			};
			bullets[socket.id] = [];
			setup();
			socket.emit('joining');
			io.emit('plr-joined', {
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
		io.emit('leave', socket.id);
		delete players[socket.id];
	});
});

app.use(express.static('public'));

app.get('/', () => {
	res.sendFile(path.resolve(__dirname, 'public/index.html'));
});