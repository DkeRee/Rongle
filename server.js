const express = require('express');
const app = express();
const path = require('path');

const socket = require('socket.io');
const server = app.listen(process.env.PORT || 3000);
const io = socket(server);

const tickrate = 1000/60;

const players = {};
const colors = ["#7289da", "#FFA500", "#DF362D", "#FFCD58", "cyan"];

function checkString(string){
	for (var i = 0; i < string.length; i++){
		if (string[i] !== " "){
			return true;
		}
	}
}

function calculatePlayerSides(coord){
	if (Math.sign(coord) == 1){
		return coord + 26;
	} else {
		return coord - 26;
	}
}

function borderCheck(coordX, coordY){
	if (calculatePlayerSides(coordX) >= 1300){
		return "right border";
	}
	if (calculatePlayerSides(coordX) <= -1300){
		return "left border";
	}
	if (calculatePlayerSides(coordY) >= 1300){
		return "bottom border";
	}
	if (calculatePlayerSides(coordY) <= -1300){
		return "top border";
	}
}

setInterval(() => {
	for (var player in players){
		io.emit('pupdate', {
			id: players[player].id,
			username: players[player].username,
			coords: players[player].coords,
			color: players[player].color
		});
	}
}, tickrate);

io.on('connection', socket => {
	var loggedIn = false;
	socket.emit("setup");
	socket.on('join', username => {
		if (!loggedIn && username !== "" && username.length <= 16 && checkString(username)){
			players[socket.id] = {
				id: socket.id,
				username: username.trim(),
				coords: {
					x: Math.floor(Math.random() * Math.floor(300)),
					y: Math.floor(Math.random() * Math.floor(300))
				},
				color: colors[Math.floor(Math.random() * colors.length)]
			};
			socket.emit('joining');
			loggedIn = true;
		} else {
			if (username.length > 16){
				socket.disconnect();
			} else {
				socket.emit("warning", {
					header: "Uh Oh",
					warning: "Please enter a valid nickname!"
				});
			}
		}
	});

	socket.on('movement', keys => {
		const border = borderCheck(players[socket.id].coords.x, players[socket.id].coords.y);
		socket.emit('cam-update', socket.id);
			//up
			if (border !== "top border"){
				if (keys[87]){
					players[socket.id].coords.y -= 2;
				}
			}
			//down
			if (border !== "bottom border"){
				if (keys[83]){
					players[socket.id].coords.y += 2;
				}
			}
			//right
			if (border !== "right border"){
				if (keys[68]){
					players[socket.id].coords.x += 2;
				}
			}
			//left
			if (border !== "left border"){
				if (keys[65]){
					players[socket.id].coords.x -= 2;
				}
			}
	});

	socket.on("send", msg => {
		const message = msg.trim();
		if (loggedIn && message.length <= 100 && message !== "" && checkString(message)){
			io.emit("recieve", {
				msg: message,
				username: players[socket.id].username,
				color: players[socket.id].color
			});
		} else if (msg.length > 100){
			socket.disconnect();
		}
	});

	socket.on('disconnect', () => {
		delete players[socket.id];
		io.emit('leave', socket.id);
	});
});

app.use(express.static('public'));

app.get('/', () => {
	res.sendFile(path.resolve(__dirname, 'public/index.html'));
});