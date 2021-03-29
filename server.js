const express = require('express');
const app = express();
const path = require('path');

const socket = require('socket.io');
const server = app.listen(process.env.PORT || 3000);
const io = socket(server);

const tickrate = 1000/60;

const players = {};
const colors = ["#7289da", "#FFA500", "#DF362D", "#FFCD58", "cyan"];

setInterval(() => {
	for (var player in players){
		io.emit('pupdate', {
			id: players[player].id,
			coords: players[player].coords,
			color: players[player].color
		});
	}
}, tickrate);

io.on('connection', socket => {
	players[socket.id] = {
		id: socket.id,
		coords: {
			x: Math.floor(Math.random() * Math.floor(300)),
			y: Math.floor(Math.random() * Math.floor(300))
		},
		color: colors[Math.floor(Math.random() * colors.length)]
	};

	socket.on('movement', keys => {
		if (keys[87]){
			players[socket.id].coords.y -= 4;
		}
		if (keys[83]){
			players[socket.id].coords.y += 4;
		}
		if (keys[68]){
			players[socket.id].coords.x += 4;
		}
		if (keys[65]){
			players[socket.id].coords.x -= 4;
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