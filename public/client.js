(function(){
	const socket = io.connect();
	const tickrate = 1000/60;

	const body = document.getElementById("body");
	const canvas = document.getElementById("game");
	const ctx = canvas.getContext("2d");

	const players = {};
	const bulletStorage = [];
	const bullets = {};
	const healthDrops = {};
	const ramBots = {};

	const keys = {};

	const loginContainer = document.getElementById("login-container");
	const bigUI = document.getElementById("big-ui-container");
	const cursor = document.getElementById("cursor");
	const overlappingUI = document.getElementById("overlapping-ui-container");
	const myInfo = document.getElementById("my-info");
	const chat = document.getElementById("chat-container");
	const playerList = document.getElementById("player-list-container");
	const staminaContainer = document.getElementById("stamina-container");
	const staminaBar = document.getElementById("stamina-bar");
	const warningContainer = document.getElementById("warning-container");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	var me = {
		loggedIn: false,
		myID: null,
		myX: "N/A",
		myY: "N/A",
		bulletCount: null,
		stamina: 100,
		burntOut: false,
	};

	$(body).bind('contextmenu', e => {
		return false;
	});

	$(window).keydown(e => {
		if (e.keyCode == 9){
			e.preventDefault();
			e.stopPropagation();
		}
	});
	
	window.onresize = () => {
		canvas.width = window.innerWidth * window.devicePixelRatio;
		canvas.height = window.innerHeight * window.devicePixelRatio;
		canvas.style.width = `${window.innerWidth}px`;
		canvas.style.height = `${window.innerHeight}px`;
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
		bigUI.style.cursor = 'none';
		cursor.style.display = 'block';
		myInfo.style.display = 'block';
		chat.style.display = 'block';
		staminaContainer.style.display = 'block';
		warningContainer.style.display = 'none';

		var step = function(){
			update();
			render();
			requestAnimationFrame(step);
		};

		var update = function(){
			const coordText = document.getElementById("coords");
			for (var bot in ramBots){
				ramBots[bot].body.update(ramBots[bot].coords.x, ramBots[bot].coords.y, ramBots[bot].health);
			}

			for (var player in bullets){
				for (var bullet in bullets[player]){
					bullets[player][bullet].body.update(bullets[player][bullet].coords.x, bullets[player][bullet].coords.y);
				}
			}
			for (var player in players){
				players[player].body.update(players[player].coords.x, players[player].coords.y, players[player].health);
			}
			coordText.textContent = `Coords: ${me.myX}, ${me.myY}`;
		};

		var render = function(){
			canvas.style.backgroundPosition = `${-me.myX / 0.8}px ${-me.myY / 0.8}px`;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.translate(-me.myX + canvas.width / 2, -me.myY + canvas.height / 2);
			
			const borderX = -1800;
			const borderY = -1800;
			ctx.lineWidth = 5;
			ctx.strokeStyle = "white";
			ctx.strokeRect(borderX, borderY, -borderX * 2, -borderY * 2);

			staminaBar.style.width = `${me.stamina}%`;

			if (!me.burntOut){
				staminaBar.style.backgroundColor = "#4ee44e";
			} else {
				staminaBar.style.backgroundColor = "#f70d1a";
			}

			for (var healthDrop in healthDrops){
				healthDrops[healthDrop].body.render();
			}

			for (var bot in ramBots){
				ramBots[bot].body.render();
			}

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
		function Player(x, y, health, color, username, radius){
			this.x = x;
			this.y = y;
			this.radius = radius;
			this.dead = false;
			this.health = health;
			this.color = color;
			this.username = username;
		}

		Player.prototype.update = function(x, y, health){
			this.x = x;
			this.y = y;
			this.health = health;
		};

		Player.prototype.render = function(){
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.radius, 2 * Math.PI, false);
			ctx.lineWidth = 2;
			ctx.strokeStyle = this.color;
			ctx.stroke();

			if (!this.dead){
				ctx.font = "25px monospace";
				ctx.fillStyle = "white";
				ctx.textAlign = "center";
				ctx.fillText(this.username, this.x, this.y - 38);

				ctx.fillStyle = "#f70d1a";
				ctx.fillRect(this.x - 50, this.y - 80, 100, 15);

				ctx.fillStyle = "#4ee44e";
				ctx.fillRect(this.x - 50, this.y - 80, this.health, 15);
			}
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

		function getBullet(coords, color, radius){
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

		//health drop constructor
		function HealthDrop(x, y, width, height, color){
			this.x = x;
			this.y = y;
			this.color = color;
			this.width = width;
			this.height = height;
		}

		HealthDrop.prototype.render = function(){
			ctx.beginPath();
			ctx.fillStyle = this.color;
			ctx.fillRect(this.x, this.y, this.width, this.height);
		};

		//ram bot constructor
		function RamBot(x, y, radius, color, health){
			this.x = x;
			this.y = y;
			this.health = health;
			this.radius = radius;
			this.color = color;
		}

		RamBot.prototype.update = function(x, y, health){
			this.x = x;
			this.y = y;
			this.health = health;
		};

		RamBot.prototype.render = function(){
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, false);
			ctx.fillStyle = this.color;
			ctx.fill();

			ctx.fillStyle = "#424549";
			ctx.fillRect(this.x - 15, this.y - 35, 30, 10);

			ctx.fillStyle = "#4ee44e";
			ctx.fillRect(this.x - 15, this.y - 35, this.health, 10);
		};

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
				.style("stroke", info.color)
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

		//player update
		socket.on('pupdate', info => {
			if (players[info.id]){
				players[info.id].coords = info.coords;
				players[info.id].health = info.health;
				if (info.id == me.myID){
					me.myX = players[info.id].coords.x;
					me.myY = players[info.id].coords.y;
					me.stamina = info.stamina;
					me.burntOut = info.burntOut;
				}
			} else {
				players[info.id] = {
					coords: info.coords,
					username: info.username,
					health: info.health,
					color: info.color,
					body: new Player(info.coords.x, info.coords.y, info.health, info.color, info.username, info.radius)
				};
				bullets[info.id] = {};
				addPlayerList(players[info.id], info.id);
			}
		});

		//bullet update
		socket.on('bupdate', info => {
			if (bullets[info.playerId][info.bulletId]){
				bullets[info.playerId][info.bulletId].coords = info.coords;
			} else {
				bullets[info.playerId][info.bulletId] = {
					playerId: info.playerId,
					coords: info.coords,
					body: getBullet(info.coords, info.color),
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

		window.addEventListener("mousedown", e => {
			if (!typing && e.button == 0){
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
			}
		});

		//health drop update
		socket.on("hdupdate", info => {
			if (healthDrops[info.dropId] == undefined){
				healthDrops[info.dropId] = {
					dropId: info.dropId,
					body: new HealthDrop(info.coords.x, info.coords.y, info.width, info.height, info.color),
				};
			}
		});

		socket.on("healthDrop-destroy", id => {
			delete healthDrops[id];
		});

		//rambot update
		socket.on("rbupdate", info => {
			if (ramBots[info.botId]){
				ramBots[info.botId].coords = info.coords;
				ramBots[info.botId].health = info.health;
			} else {
				ramBots[info.botId] = {
					coords: info.coords,
					health: info.health,
					body: new RamBot(info.coords.x, info.coords.y, info.radius, info.color, info.health)
				};
			}
		});

		socket.on("rambot-destroy", botId => {
			delete ramBots[botId];
		});

		window.addEventListener("mousemove", e => {
			$("#cursor").css({
				left: e.pageX - 15,
				top: e.pageY - 15
			});
		});
	
		setInterval(() => {
			if (!typing){
				socket.emit('movement', keys);
				if (keys[9]){
					playerList.style.display = 'block';
				} else {
					playerList.style.display = 'none';
				}
			}
		}, tickrate);
	});
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

	socket.on("plr-death", info => {
		players[info.loser.id].body.color = "transparent";
		players[info.loser.id].body.dead = true;
		if (me.loggedIn){
			const msgContainer = document.createElement("div");
			msgContainer.setAttribute("class", "msg-container");

			const msg = document.createElement("p");
			msg.textContent = " was killed by ";
			msg.setAttribute("class", "msg");
			msg.style.color = "white";

			const loser = document.createElement("bdi");
			loser.textContent = info.loser.username;
			loser.style.color = info.loser.color;

			const winner = document.createElement("bdi");
			winner.textContent = info.winner.username;
			winner.style.color = info.winner.color;

			if (info.type == "bot"){
				winner.style.textDecoration = "underline";
			}

			msg.prepend(loser);
			msg.appendChild(winner);
			msgContainer.appendChild(msg);
			serverInnerWrapper.appendChild(msgContainer);

			setTimeout(() => {
				msgContainer.remove();
			}, 3000);
		}
	});

	socket.on("plr-respawn", info => {
		players[info.playerId].body.color = info.playerColor;
		players[info.playerId].body.dead = false;
	});

	setInterval(() => {
		if ($(chatbar).is(":focus")){
			$(chat).removeClass("unselectable");
			chat.style.opacity = "1";
			typing = true;
		} else {
			chatbar.style.height = "20px";
		}
	});

	window.addEventListener("keypress", e => {
		if (me.loggedIn){
			if (!$(chatbar).is(':focus')){
				if (e.keyCode == 13 || e.which == 13){
					setTimeout(() => {
						$(chatbar).focus();
					}, 50);
				}
			} else {
				if (e.keyCode == 13 || e.which == 13){
					if (chatbar.value.length !== 0){
						setTimeout(() => {
							socket.emit("send", chatbar.value);
							chatbar.value = "";
							chatbar.blur();
							$(chat).addClass("unselectable");
							chat.style.opacity = "0.7";
							typing = false;
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
