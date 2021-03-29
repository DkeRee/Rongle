(function(){
	const socket = io.connect();
	const tickrate = 1000/60;

	const body = document.getElementById("body");
	const canvas = document.getElementById("game");
	const ctx = canvas.getContext("2d");
	const players = {};
	const keys = {};
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	$(body).bind('contextmenu', function(e) {
		return false;
	}); 

	window.onresize = function(){
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	};

	window.onload = function(){
		requestAnimationFrame(step);
	};

	var step = function(){
		update();
		render();
		requestAnimationFrame(step);
	};

	var update = function(){
		for (var player in players){
			players[player].body.update(players[player].coords.x, players[player].coords.y);
		}
	};

	var render = function(){
		ctx.fillStyle = "#23272A";
		ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
		for (var player in players){
			players[player].body.render();
		}
	};

	function Player(x, y, color){
		this.x = x;
		this.y = y;
		this.radius = 15;
		this.speed = 5;
		this.color = color;
	}

	Player.prototype.update = function(x, y){
		this.x = x;
		this.y = y;
	}

	Player.prototype.render = function(){
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 2 * Math.PI, false);
		ctx.lineWidth = 2;
		ctx.strokeStyle = this.color;
		ctx.stroke();
	};

	Player.prototype.destroy = function(){
		ctx.beginPath();
		ctx.clearRect(this.x - this.radius - 1, this.y - this.radius - 1, this.radius * 2 + 2, this.radius * 2 + 2);
		ctx.closePath();
	}

	socket.on('pupdate', info => {
		if (players[info.id]){
			players[info.id].coords = info.coords;
		} else {
			players[info.id] = {
				coords: info.coords,
				body: new Player(info.coords.x, info.coords.y, info.color)
			};
		}
	});

	socket.on('leave', id => {
		players[id].body.destroy();
		delete players[id];
	});

	setInterval(() => {
		socket.emit('movement', keys);
	}, tickrate);

	window.addEventListener("keydown", e => {
		keys[e.keyCode || e.which] = true;
	});

	window.addEventListener("keyup", e => {
		keys[e.keyCode || e.which] = false;
	});

	window.onblur = function(){
		for (var key in keys){
			keys[key] = false;
		}
	};
})();
