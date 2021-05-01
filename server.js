const express = require('express');
const app = express();
const path = require('path');

const xss = require('xss');

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
		if (player == id && players[player].bTime >= 85){
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

function emit(type, data){
	for (var player in players){
		io.to(players[player].id).emit(type, data);
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
				emit("bullet-destroy", {
					playerId: projectile.playerId,
					bulletId: projectile.bulletId
				});
			}
		}
	}
}, 1);

//spawner
setInterval(() => {
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
				emit("plr-respawn", {
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

		//calculate closest player
		const playerInfo = [];
		for (var player in players){
			const distX = ramBots[bot].coords.x - players[player].coords.x;
			const distY = ramBots[bot].coords.y - players[player].coords.y;
			const dist = Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2));

			if (!players[player].dead){
				var ramBotX = 0;
				var ramBotY = 0;
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
					ramBots[bot].coords.x += ramBotX;
					ramBots[bot].coords.y += ramBotY;
				}

				if (41 > dist){
					var bkbX = 80;
					var bkbY = 80;
					var pkbX = 80;
					var pkbY = 80;

					//calculate knockback

					//prevent knocking outside of arena
					if (Math.sign(players[player].coords.x) == 1){
						if (1771 - players[player].coords.x <= 80){
							pkbX = 1771 - players[player].coords.x;
						}
					} else {
						if (-1771 - players[player].coords.x >= -80){
							pkbX = -1771 - players[player].coords.x;
						}
					}

					if (Math.sign(players[player].coords.y) == 1){
						if (1771 - players[player].coords.y <= 80){
							pkbY = 1771 - players[player].coords.y;
						}
					} else {
						if (-1771 - players[player].coords.y >= -80){
							pkbY = -1771 - players[player].coords.y;
						}
					}

					const dir = Math.atan2((ramBots[bot].coords.x - 80) - players[player].coords.x, (ramBots[bot].coords.y - 80) - players[player].coords.y);

					//calculate direction
					if (Math.sign(ramBotX) == 1){
						pkbX = pkbX;
						bkbX = -bkbX;
					}
					if (Math.sign(ramBotX) == -1){
						pkbX = -pkbX;
						bkbX = bkbX;
					}
					if (Math.sign(ramBotY) == 1){
						pkbY = pkbY;
						bkbY = -bkbY;
					}
					if (Math.sign(ramBotY) == -1){
						pkbY = -pkbY;
						bkbY = bkbY;
					}

					//hit
					ramBots[bot].coords.x += -Math.round(bkbX * Math.cos(dir));
					ramBots[bot].coords.y += -Math.round(bkbY * Math.sin(dir));
					players[player].coords.x += -Math.round(pkbX * Math.cos(dir));
					players[player].coords.y += -Math.round(pkbY * Math.sin(dir));
					players[player].health -= 4;

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
				}
			}
		}
	}
}, tickrate);

//player emit
setInterval(() => {
	for (var player in players){
		emit('pupdate', {
			id: players[player].id,
			username: players[player].username,
			coords: players[player].coords,
			health: players[player].health,
			stamina: players[player].stamina,
			burntOut: players[player].burntOut,
			radius: players[player].radius,
			color: players[player].color
		});

		if (players[player]){
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
			const borderX = borderCheckX(players[player].coords.x, players[player].coords.y);
			const borderY = borderCheckY(players[player].coords.x, players[player].coords.y);

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
					players[player].time = 60000;
				}
				//running down
				if (borderY !== "bottom border" && keys[83] && keys[16]){
					players[player].coords.y += 5;
					players[player].running = true;
					players[player].time = 60000;
				}
				//running right
				if (borderX !== "right border" && keys[68] && keys[16]){
					players[player].coords.x += 5;
					players[player].running = true;
					players[player].time = 60000;
				}
				//running left
				if (borderX !== "left border" && keys[65] && keys[16]){
					players[player].coords.x -= 5;
					players[player].running = true;
					players[player].time = 60000;
				}
		
				//with stamina up
				if (borderY !== "top border" && keys[87] && !keys[16]){
					players[player].coords.y -= 3;
					players[player].running = false;
					players[player].time = 60000;
				}
				//with stamina down
				if (borderY !== "bottom border" && keys[83] && !keys[16]){
					players[player].coords.y += 3;
					players[player].running = false;
					players[player].time = 60000;
				}
				//with stamina right
				if (borderX !== "right border" && keys[68] && !keys[16]){
					players[player].coords.x += 3;
					players[player].running = false;
					players[player].time = 60000;
				}
				//with stamina down
				if (borderX !== "left border" && keys[65] && !keys[16]){
					players[player].coords.x -= 3;
					players[player].running = false;
					players[player].time = 60000;
				}
			} else {
				//without stamina up
				if (borderY !== "top border" && keys[87]){
					players[player].coords.y -= 3;
					players[player].running = false;
					players[player].time = 60000;
				}
				//without stamina down
				if (borderY !== "bottom border" && keys[83]){
					players[player].coords.y += 3;
					players[player].running = false;
					players[player].time = 60000;
				}
				//without stamina right
				if (borderX !== "right border" && keys[68]){
					players[player].coords.x += 3;
					players[player].running = false;
					players[player].time = 60000;
				}
				//without stamina down
				if (borderX !== "left border" && keys[65]){
					players[player].coords.x -= 3;
					players[player].running = false;
					players[player].time = 60000;
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

			emit('bupdate', {
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
						players[player].health -= 10;
						players[player].health = Math.round(players[player].health);
						bullets[bullet].splice(i, 1);
						emit("bullet-destroy", {
							playerId: projectile.playerId,
							bulletId: projectile.bulletId
						});
					}
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
				}
			}
			for (var bot in ramBots){
				const distX = projectile.bulletCoords.x - ramBots[bot].coords.x;
				const distY = projectile.bulletCoords.y - ramBots[bot].coords.y;
				if (21 > Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2))){
					ramBots[bot].health -= 10;
					ramBots[bot].health = Math.round(ramBots[bot].health);
					bullets[bullet].splice(i, 1);
					emit("bullet-destroy", {
						playerId: projectile.playerId,
						bulletId: projectile.bulletId
					});
					if (ramBots[bot].health <= 0){
						emit("rambot-destroy", ramBots[bot].botId);
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
					emit("healthDrop-destroy", healthDrops[healthDrop].dropId);
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
				players[socket.id].keys = keys;
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
			const message = xss(msg.trim());
			if (loggedIn && message.length !== 0 && message.length <= 100 && checkString(message)){
				players[socket.id].time = 60000;
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
				time: 60000,
				bTime: 0
			};
			bullets[socket.id] = [];
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
	});
});

app.use(express.static('public'));

app.get('/', (req, res) => {
	res.sendFile(path.resolve(__dirname, 'public/index.html'));
});

app.get('*', (req, res) => {
	res.sendFile(path.resolve(__dirname, 'public/error.html'));
});