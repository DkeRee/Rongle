(function(){
	const socket = io.connect();
	const tickrate = 1000/60;

	const body = document.getElementById("body");
	const canvas = document.getElementById("game");
	const ctx = canvas.getContext("2d");
	const players = {};
	const bullets = {};
	const keys = {};

	const loginContainer = document.getElementById("login-container");
	const bigUI = document.getElementById("big-ui-container");
	const overlappingUI = document.getElementById("overlapping-ui-container");
	const myInfo = document.getElementById("my-info");
	const chat = document.getElementById("chat-container");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	var me = {
		loggedIn: false,
		myID: undefined,
		myX: undefined,
		myY: undefined
	};

	$(body).bind('contextmenu', function(e) {
		return false;
	}); 

	window.onresize = function(){
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	};

	const form = document.getElementById("form");
	const input = document.getElementById("username-submit");

	form.addEventListener("submit", e => {
		e.preventDefault();
		if (input.value.length !== 0){
			socket.emit("join", input.value);
			input.value = "";
		}
	});

	socket.on("setup", () => {
		me.myID = socket.id;
		setInterval(() => {
			if (!socket.connected){
				bigUI.style.display = 'none';
				overlappingUI.style.display = 'block';
			}
		}, tickrate);
	});

	socket.on('joining', () => {
		me.loggedIn = true;
		loginContainer.remove();
		bigUI.style.background = 'transparent';
		myInfo.style.display = 'block';
		chat.style.display = 'block';

		var step = function(){
			update();
			render();
			requestAnimationFrame(step);
		};

		var update = function(){
			const coordText = document.getElementById("coords");
			for (var player in bullets){
				for (var bullet in bullets[player]){
					bullets[player][bullet].body.update(bullets[player][bullet].coords.x, bullets[player][bullet].coords.y);
				}
			}
			for (var player in players){
				players[player].body.update(players[player].coords.x, players[player].coords.y);
			}
			coordText.textContent = `Coords: ${me.myX}, ${me.myY}`;
		};

		var render = function(){
			canvas.style.backgroundPosition = `${-me.myX / 0.8}px ${-me.myY / 0.8}px`;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.translate(-me.myX + canvas.width / 2, -me.myY + canvas.height / 2);
			
			const borderX = -1300;
			const borderY = -1300;
			ctx.lineWidth = 5;
			ctx.strokeStyle = "white";
			ctx.strokeRect(borderX, borderY, -borderX * 2, -borderY * 2);

			for (var player in players){
				players[player].body.render();
			}

			for (var player in bullets){
				for (var bullet in bullets[player]){
					bullets[player][bullet].body.render();
				}
			}
		};

		requestAnimationFrame(step);

		//Player constructor

		function Player(x, y, color, username){
			this.x = x;
			this.y = y;
			this.radius = 26;
			this.color = color;
			this.username = username;
		}

		Player.prototype.update = function(x, y){
			this.x = x;
			this.y = y;
		};

		Player.prototype.render = function(){
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.radius, 2 * Math.PI, false);
			ctx.lineWidth = 2;
			ctx.strokeStyle = this.color;
			ctx.stroke();

			ctx.font = "25px monospace";
			ctx.fillStyle = "white";
			ctx.textAlign = "center";
			ctx.fillText(this.username, this.x, this.y - 38);
		};

		Player.prototype.destroy = function(){
			ctx.beginPath();
			ctx.clearRect(this.x - this.radius - 1, this.y - this.radius - 1, this.radius * 2 + 2, this.radius * 2 + 2);
			ctx.closePath();
		};

		//Bullet constructor

		function Bullet(x, y, color){
			this.x = x;
			this.y = y;
			this.radius = 6;
			this.color = color;
		}

		Bullet.prototype.update = function(x, y){
			this.x = x;
			this.y = y;
		};

		Bullet.prototype.render = function(){
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.radius, 2 * Math.PI, false);
			ctx.fillStyle = this.color;
			ctx.fill();
		};

		Bullet.prototype.destroy = function(){
			ctx.beginPath();
			ctx.clearRect(this.x - this.radius - 1, this.y - this.radius - 1, this.radius * 2 + 2, this.radius * 2 + 2);
			ctx.closePath();
		};

		//updates

		socket.on('pupdate', info => {
			if (players[info.id]){
				players[info.id].coords = info.coords;

				if (info.id == me.myID){
					me.myX = players[info.id].coords.x;
					me.myY = players[info.id].coords.y;
				}
			} else {
				players[info.id] = {
					coords: info.coords,
					body: new Player(info.coords.x, info.coords.y, info.color, info.username)
				};
				bullets[info.id] = {};
			}
		});

		socket.on('bupdate', info => {
			if (bullets[info.playerId][info.bulletId]){
				bullets[info.playerId][info.bulletId].coords = info.coords;
			} else {
				bullets[info.playerId][info.bulletId] = {
					playerId: info.playerId,
					coords: info.coords,
					body: new Bullet(info.coords.x, info.coords.y, info.color),
					color: info.color
				};
			}
		});

		socket.on("bullet-destroy", info => {
			bullets[info.playerId][info.bulletId].body.destroy();
			delete bullets[info.playerId][info.bulletId];
		});

		window.addEventListener("click", e => {
			socket.emit("shoot", {
				screen: {
					width: window.innerWidth,
					height: window.innerHeight
				},
				coords: {
					x: e.clientX,
					y: e.clientY
				}
			});
		});

		socket.on('leave', id => {
			players[id].body.destroy();
			delete players[id];
			delete bullets[id];
		});
	
		setInterval(() => {
			if (!typing){
				socket.emit('movement', keys);
			}
		}, tickrate);
	});

	const warningContainer = document.getElementById("warning-container");
	const warningHeader = document.getElementById("warning-header");
	const warning = document.getElementById("warning");

	socket.on("warning", info => {
		warningHeader.textContent = info.header;
		warning.textContent = info.warning;
		warningContainer.style.display = 'block';
		setTimeout(() => {
			warningContainer.style.display = 'none';
		}, 3000);
	});

	const innerWrapper = document.getElementById("chat-inner-wrapper");
	const chatbar = document.getElementById("chatbar");
	const messages = [];
	var typing = false;

	setInterval(() => {
		if ($(chatbar).is(":focus")){
			typing = true;
			$(chat).removeClass("unselectable");
			chat.style.opacity = "1";
		} else {
			typing = false;
		}
	});

	socket.on("recieve", info => {
		const msgContainer = document.createElement("p");
		msgContainer.setAttribute("class", "msg");
		msgContainer.style.color = "white";

		const name = document.createElement("bdi");
		name.textContent = info.username;
		name.style.color = info.color;
		name.setAttribute("class", "msg");

		msgContainer.innerHTML = `: ${info.msg}`;
		msgContainer.prepend(name);

		innerWrapper.appendChild(msgContainer);
		messages.push(msgContainer);

		if (messages.length > 30){
			messages[0].remove();
			messages.shift();
		}
	});

	window.addEventListener("keypress", e => {
		if (me.loggedIn){
			if (!$(chatbar).is(':focus')){
				if (e.keyCode == 13 || e.which == 13){
					setTimeout(() => {
						$(chatbar).focus();
						$(chat).removeClass("unselectable");
						chat.style.opacity = "1";
					}, 50);
				}
			} else {
				if (e.keyCode == 13 || e.which == 13){
					if (chatbar.value.length !== 0){
						setTimeout(() => {
							socket.emit("send", chatbar.value);
							chatbar.style.height = "20px";
							chatbar.value = "";
							chatbar.blur();
							$(chat).addClass("unselectable");
							chat.style.opacity = "0.7";
						}, 10);
					}
				}
			}
		}
	});

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
