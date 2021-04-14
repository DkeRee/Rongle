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
const colors = ["#7289da", "#FFA500", "#DF362D", "#FFCD58", "cyan"];

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
	if (calculatePlayerSides(coordX) >= 1300){
		return "right border";
	}
	if (calculatePlayerSides(coordX) <= -1300){
		return "left border";
	}
}

function borderCheckY(coordX, coordY){
	if (calculatePlayerSides(coordY) >= 1300){
		return "bottom border";
	}
	if (calculatePlayerSides(coordY) <= -1300){
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
				if (players[player] !== undefined && socket.id == players[player].id){
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

//bullet update

setInterval(() => {
	for (var bullet in bullets){
		for (var i = 0; i < bullets[bullet].length; i++){
			const projectile = bullets[bullet][i];
			const dir = Math.atan2(projectile.targetCoords.y - projectile.screen.height / 2, projectile.targetCoords.x - projectile.screen.width / 2);

			projectile.bulletCoords.x += projectile.speed * Math.cos(dir);
			projectile.bulletCoords.y += projectile.speed * Math.sin(dir);
		}
	}
}, tickrate);

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
				players[player].coords.x = Math.ceil(Math.random() * 800) * (Math.round(Math.random()) ? 1 : -1);
				players[player].coords.y = Math.ceil(Math.random() * 800) * (Math.round(Math.random()) ? 1 : -1);
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

//player stamina check

setInterval(() => {
	for (var player in players){
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
			color: players[player].color
		});
	}
}, tickrate);

//bullet emit

setInterval(() => {
	for (var bullet in bullets){
		for (var i = 0; i < bullets[bullet].length; i++){
			const projectile = bullets[bullet][i];
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
					const x = projectile.bulletCoords.x - players[player].coords.x;
					const y = projectile.bulletCoords.y - players[player].coords.y;
					if (players[player].id !== projectile.playerId && 32 > Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)) && !players[player].dead){
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
							}
						});
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
				coords: {
					x: Math.ceil(Math.random() * 800) * (Math.round(Math.random()) ? 1 : -1),
					y: Math.ceil(Math.random() * 800) * (Math.round(Math.random()) ? 1 : -1)
				},
				color: colors[Math.floor(Math.random() * colors.length)],
				health: 100,
				dead: false,
				respawnTime: 5,
				latestWinner: {
					username: undefined,
					color: undefined
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
				warning: "This nickname has already been taken."
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