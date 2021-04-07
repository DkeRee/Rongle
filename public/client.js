(function(){
	const socket = io.connect();
	const tickrate = 1000/60;

	const body = document.getElementById("body");
	const canvas = document.getElementById("game");
	const ctx = canvas.getContext("2d");

	const players = {};
	const bulletStorage = [];
	const bullets = {};
	const keys = {};

	const loginContainer = document.getElementById("login-container");
	const bigUI = document.getElementById("big-ui-container");
	const overlappingUI = document.getElementById("overlapping-ui-container");
	const myInfo = document.getElementById("my-info");
	const chat = document.getElementById("chat-container");
	const playerList = document.getElementById("player-list-container");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	var me = {
		loggedIn: false,
		myID: undefined,
		myX: undefined,
		myY: undefined,
		bulletCount: undefined
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

	setInterval(() => {
		socket.emit("bullet-num");
	}, tickrate);

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

		//Bullet constructor

		function Bullet(x, y, color){
			this.x = x;
			this.y = y;
			this.radius = 6;
			this.color = color;
			this.taken = false;
		}

		Bullet.prototype.create = function(x, y, color){
			this.x = x;
			this.y = y;
			this.color = color;
			this.taken = true;
		};

		Bullet.prototype.destroy = function(){
			this.x = 5000;
			this.y = 5000;
			this.color = "transparent";
			this.taken = false;
		};

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

		for (var i = 0; i < 500; i++){
			bulletStorage.push(new Bullet(5000, 5000, "transparent"));
		}

		function getBullet(coords, color){
			for (var i = 0; i < bulletStorage.length; i++){
				if (bulletStorage[i].taken == false){
					bulletStorage[i].create(coords.x, coords.y, color);
					return bulletStorage[i];
				}
			}
		}

		setInterval(() => {
			if (me.bulletCount > bulletStorage.length){
				for (var i = 0; i < 500; i++){
					bulletStorage.push(new Bullet(5000, 5000, "transparent"));
				}
			}
		}, tickrate);

		function addPlayerList(info, id){
			const playerListWrapper = document.getElementById("player-list-inner-wrapper");

			const playerContainer = document.createElement("div");
			playerContainer.style.border = `2px solid ${info.color}`;
			playerContainer.setAttribute("class", "player-widget");
			playerContainer.setAttribute("id", id);

			d3.select(playerContainer)
				.append("svg")
				.attr("class", "player-svg")
				.attr("width", "60")
				.attr("height", "60")
				.append("circle")
				.attr("cx", 30)
				.attr("cy", 30)
				.attr("r", 20)
				.style("stroke", `${info.color}`)
				.style("stroke-width", 2)
				.style("fill", "transparent");

			const name = document.createElement("bdi");
			name.textContent = info.username;
			name.style.color = info.color;
			name.setAttribute("class", "player-widget-name");

			playerContainer.appendChild(name);
			playerListWrapper.appendChild(playerContainer);
		}

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
					username: info.username,
					color: info.color,
					body: new Player(info.coords.x, info.coords.y, info.color, info.username)
				};
				bullets[info.id] = {};
				addPlayerList(players[info.id], info.id);
			}
		});

		socket.on('bupdate', info => {
			if (bullets[info.playerId][info.bulletId]){
				bullets[info.playerId][info.bulletId].coords = info.coords;
			} else {
				bullets[info.playerId][info.bulletId] = {
					playerId: info.playerId,
					coords: info.coords,
					body: getBullet(info.coords, info.color),
					color: info.color
				};
			}
		});

		socket.on("bullet-numdate", num => {
			me.bulletCount = num;
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
	
		setInterval(() => {
			if (!typing){
				socket.emit('movement', keys);
				if (keys[70]){
					playerList.style.display = 'block';
				} else {
					playerList.style.display = 'none';
				}
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

	const chatInnerWrapper = document.getElementById("chat-inner-wrapper");
	const chatbar = document.getElementById("chatbar");
	const messages = [];
	var typing = false;

	const serverInnerWrapper = document.getElementById("server-msg-inner-wrapper");

	function serverMsg(info, message){
		if (me.loggedIn){
			if (typeof info == 'object'){
				const msgContainer = document.createElement("div");
				msgContainer.setAttribute("class", "msg-container");

				const msg = document.createElement("p");
				msg.textContent = message;
				msg.setAttribute("class", "msg");
				msg.style.color = "white";

				const name = document.createElement("bdi");
				name.textContent = info.username;
				name.style.color = info.color;
				name.setAttribute("class", "msg");

				msg.prepend(name);
				msgContainer.appendChild(msg);
				serverInnerWrapper.appendChild(msgContainer);

				setTimeout(() => {
					msgContainer.remove();
				}, 3000);
			}
			if (typeof info == 'string'){
				const msgContainer = document.createElement("div");
				msgContainer.setAttribute("class", "msg-container");

				const msg = document.createElement("p");
				msg.textContent = message;
				msg.setAttribute("class", "msg");
				msg.style.color = "white";

				const name = document.createElement("bdi");
				name.textContent = players[info].username;
				name.style.color = players[info].color;
				name.setAttribute("class", "msg");

				msg.prepend(name);
				msgContainer.appendChild(msg);
				serverInnerWrapper.appendChild(msgContainer);

				setTimeout(() => {
					msgContainer.remove();
				}, 3000);
			}
		}
	}

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
		if (me.loggedIn){
			const msgContainer = document.createElement("p");
			msgContainer.setAttribute("class", "msg");
			msgContainer.style.color = "white";

			const name = document.createElement("bdi");
			name.textContent = info.username;
			name.style.color = info.color;
			name.setAttribute("class", "msg");

			msgContainer.innerHTML = `: ${info.msg}`;
			msgContainer.prepend(name);

			chatInnerWrapper.appendChild(msgContainer);
			messages.push(msgContainer);

			if (messages.length > 30){
				messages[0].remove();
				messages.shift();
			}
		}
	});

	socket.on("plr-joined", id => {
		serverMsg(id, " has joined the server");
	});

	socket.on('leave', id => {
		serverMsg(id, " has left the server");
		document.getElementById(id).remove();
		delete players[id];
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
