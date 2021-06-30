(function(){
	const socket = io.connect();
	const tickrate = 1000/60;

	const canvas = document.getElementById("game");
	const ctx = canvas.getContext("2d");

	const players = {};
	const bulletStorage = [];
	const bullets = {};
	const blocks = {};
	const healthDrops = {};
	const ramBots = {};
	const vortexes = {};

	const keys = {};

	const loginContainer = document.getElementById("login-container");
	const devLoginContainer = document.getElementById("dev-login")
	const bigUI = document.getElementById("big-ui-container");
	const overlappingUI = document.getElementById("overlapping-ui-container");
	const myInfo = document.getElementById("my-info");
	const chat = document.getElementById("chat-container");
	const playerList = document.getElementById("player-list-container");
	const staminaContainer = document.getElementById("stamina-container");
	const staminaBar = document.getElementById("stamina-bar");
	const vortexContainer = document.getElementById("vortex-container");
	const vortexBar = document.getElementById("vortex-bar");
	const warningContainer = document.getElementById("warning-container");
	const toggleUI = document.getElementById("toggle-container");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	var lastTD = performance.now();

	const me = {
		loggedIn: false,
		myID: null,
		myX: "N/A",
		myY: "N/A",
		lerpX: null,
		lerpY: null,
		color: "#424549",
		blocksUsed: 0,
		bulletCount: null,
		stamina: 100,
		vTime: 100,
		burntOut: false,
	};

	var mode = "shooting";

	function toggle(id){
		const blockCounter = document.getElementById("block-counter");
		if (id == "shooting-container"){
			document.getElementById("building-container").style.borderColor = "#7f7f7f";
			blockCounter.style.display = 'none';
		}

		if (id == "building-container"){
			document.getElementById("shooting-container").style.borderColor = "#7f7f7f";
			blockCounter.style.display = 'block';
		}

		document.getElementById(id).style.borderColor = "#72bcd4";
	}

	$("#html").bind('contextmenu', () => {
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

	function lerp(x, y, a){
		return x * (1 - a) + y * a;
	}

	const form = document.getElementById("form");
	const input = document.getElementById("username-submit");

	const devForm = document.getElementById("dev-form");
	const devInput = document.getElementById("dev-login-submit");

	form.addEventListener("submit", e => {
		e.preventDefault();
		if (input.value.length !== 0){
			socket.emit("join", input.value);
			input.value = "";
		}
	});

	devForm.addEventListener("submit", e => {
		e.preventDefault();
		if (devInput.value.length !== 0){
			socket.emit("dev-login", devInput.value);
			devInput.value = "";
		}
	});

	socket.on("setup", () => {
		me.myID = socket.id;
	});

	socket.on("connect_error", () => {
		bigUI.style.display = 'none';
		overlappingUI.style.display = 'block';
	})

	socket.on('joining', () => {
		me.loggedIn = true;
		loginContainer.remove();
		devLoginContainer.remove();
		bigUI.style.background = 'transparent';
		bigUI.style.cursor = "url('img/cursor.png') 25 15, auto";
		myInfo.style.display = 'block';
		chat.style.display = 'block';
		staminaContainer.style.display = 'block';
		vortexContainer.style.display = 'block';
		warningContainer.style.display = 'none';
		toggleUI.style.display = 'block';

		toggle("shooting-container");

		window.addEventListener("keypress", e => {
			if (me.loggedIn){
				if (!$(chatbar).is(':focus')){
					if (e.keyCode == 13 || e.which == 13){
						setTimeout(() => {
							$(chatbar).focus();
						}, 50);
					} else if (e.keyCode == 47 || e.which == 47){
						setTimeout(() => {
							$(chatbar).focus();
							chatbar.value = "/";
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
			if (!typing){
				if (e.keyCode == 49 || e.which == 49){
					mode = "shooting";
					bigUI.style.cursor = "url('img/cursor.png') 25 15, auto";
					toggle("shooting-container");
				}
				if (e.keyCode == 50 || e.which == 50){
					mode = "placing";
					bigUI.style.cursor = `url('data:image/svg+xml;utf8,<svg fill="%23FF0000" height="48" viewBox="0 0 24 24" width="48" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="100" style="fill:rgb(173, 173, 173);opacity:80%" /></svg>') 25 15, auto`;
					toggle("building-container");
				}
				if (e.keyCode == 71 || e.which == 71){
					socket.emit("clear-blocks");
				}
				if (e.keyCode == 69 || e.which == 69){
					socket.emit("vortex");
				}
			}
		});

		window.addEventListener("keyup", e => {
			keys[e.keyCode || e.which] = false;
		});

		var step = function(){
			const lastTD2 = (performance.now() - lastTD) / tickrate;
			canvas.style.backgroundPosition = `${-lerp(me.myX, me.lerpX, lastTD2) / 0.8}px ${-lerp(me.myY, me.lerpY, lastTD2) / 0.8}px`;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.translate(-lerp(me.myX, me.lerpX, lastTD2) + canvas.width / 2, -lerp(me.myY, me.lerpY, lastTD2) + canvas.height / 2);
			lastTD = performance.now();

			if (!socket.connected){
				bigUI.style.display = 'none';
				overlappingUI.style.display = 'block';
			}

			if (!typing){
				socket.emit('movement', keys);
				if (keys[9]){
					playerList.style.display = 'block';
				} else {
					playerList.style.display = 'none';
				}
			}

			if ($(chatbar).is(":focus")){
				$(chat).removeClass("unselectable");
				chat.style.opacity = "1";
				typing = true;
			} else {
				chatbar.style.height = "20px";
			}

			socket.emit("bullet-num");

			if (me.bulletCount > bulletStorage.length){
				for (var i = 0; i < 500; i++){
					bulletStorage.push(new Bullet(5000, 5000, "transparent"));
				}
			}

			update();
			render();
			requestAnimationFrame(step);
		};

		var update = function(){
			const coordText = document.getElementById("coords");
			for (var bot in ramBots){
				ramBots[bot].body.update(ramBots[bot].coords.x, ramBots[bot].coords.y, ramBots[bot].health);
			}

			for (var player in blocks){
				for (var block in blocks[player]){
					blocks[player][block].body.update(blocks[player][block].health);
				}
			}

			for (var player in bullets){
				for (var bullet in bullets[player]){
					bullets[player][bullet].body.update(bullets[player][bullet].coords.x, bullets[player][bullet].coords.y);
				}
			}

			for (var player in vortexes){
				for (var vortex in vortexes[player]){
					vortexes[player][vortex].body.update(vortexes[player][vortex].radius);
				}
			}

			for (var player in players){
				players[player].body.update(players[player].coords.x, players[player].coords.y, players[player].health, players[player].rotation);
			}

			coordText.innerText = `Coords: ${me.myX}, ${me.myY}`;
		};

		var render = function(){			
			const borderX = -1800;
			const borderY = -1800;
			const blockCounter = document.getElementById("block-counter");
			ctx.lineWidth = 5;
			ctx.strokeStyle = "white";
			ctx.strokeRect(borderX, borderY, -borderX * 2, -borderY * 2);

			vortexBar.style.backgroundColor = me.color;

			blockCounter.innerText = `${me.blocksUsed}/40`;
			staminaBar.style.width = `${me.stamina}%`;
			vortexBar.style.width = `${me.vTime / 6}%`;

			if (!me.burntOut){
				staminaBar.style.backgroundColor = "#4ee44e";
			} else {
				staminaBar.style.backgroundColor = "#f70d1a";
			}

			for (var player in vortexes){
				for (var vortex in vortexes[player]){
					vortexes[player][vortex].body.render();
				}
			}

			for (var healthDrop in healthDrops){
				healthDrops[healthDrop].body.render();
			}

			for (var player in blocks){
				for (var block in blocks[player]){
					blocks[player][block].body.render();
				}
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
		function Player(x, y, health, color, username, radius, rotation, isDev){
			//animation false for fade, true for reverse
			this.x = x;
			this.y = y;
			this.radius = radius;
			this.devInfo = {
				isDev: isDev,
				glowText: 1,
				animation: false
			};
			this.dead = false;
			this.health = health;
			this.color = color;
			this.username = username;
			this.rotation = rotation;
		}

		Player.prototype.update = function(x, y, health, rotation){
			this.x = lerp(this.x, x, 0.45);
			this.y = lerp(this.y, y, 0.45);
			this.rotation = rotation;
			this.health = lerp(this.health, health, 0.3);
		};

		Player.prototype.render = function(){
			if (!this.dead){
				ctx.lineWidth = 2;
				ctx.strokeStyle = this.color;
				ctx.save();
				ctx.translate(this.x, this.y);
				ctx.rotate(this.rotation);
				ctx.strokeRect(15 / -2, 10 / -2, 15, 10);
				ctx.restore();

				if (!this.devInfo.isDev){
					ctx.font = "25px monospace";
					ctx.fillStyle = "white";
					ctx.textAlign = "center";
					ctx.fillText(this.username, this.x, this.y - 38);
				} else {
					ctx.font = "bold 25px monospace";
					ctx.fillStyle = hexToRgbA(this.color, this.devInfo.glowText);
					ctx.textAlign = "center";
					ctx.fillText(this.username, this.x, this.y - 38);

					if (!this.devInfo.animation){
						this.devInfo.glowText -= 0.02;
						if (this.devInfo.glowText <= 0.35){
							this.devInfo.animation = true;
						}
					}
					if (this.devInfo.animation){
						this.devInfo.glowText += 0.02;
						if (this.devInfo.glowText >= 1){
							this.devInfo.animation = false;
						}
					}
				}

				ctx.fillStyle = "#f70d1a";
				ctx.fillRect(this.x - 50, this.y - 80, 100, 15);

				ctx.fillStyle = "#4ee44e";
				ctx.fillRect(this.x - 50, this.y - 80, this.health, 15);
			}

			ctx.beginPath();
			ctx.arc(this.x, this.y, this.radius, 2 * Math.PI, false);
			ctx.lineWidth = 2;
			ctx.strokeStyle = this.color;
			ctx.stroke();
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
			this.x = lerp(this.x, x, 0.8);
			this.y = lerp(this.y, y, 0.8);
			this.health = lerp(this.health, health, 0.3);
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

		//block constructor
		function Block(x, y, width, height, health, color){
			this.x = x;
			this.y = y;
			this.color = color;
			this.health = health;
			this.width = width;
			this.height = height;
		}

		Block.prototype.update = function(health){
			this.health = lerp(this.health, health, 0.3);
		};

		Block.prototype.render = function(){
			ctx.beginPath();
			ctx.fillStyle = "rgb(173, 173, 173)";
			ctx.fillRect(this.x - this.health / 2 + 25, this.y - this.health / 2 + 25, this.health, this.health);

			ctx.lineWidth = 3;
			ctx.strokeStyle = this.color;
			ctx.strokeRect(this.x, this.y, this.width, this.height);			
		};

		function addPlayerList(info, id){
			const playerListWrapper = document.getElementById("player-list-inner-wrapper");

			const playerContainer = document.createElement("div");
			playerContainer.style.border = `2px solid ${info.color}`;
			playerContainer.setAttribute("class", "player-widget");
			playerContainer.setAttribute("id", id);

			const div = d3.select(playerContainer).append("svg");
			div.attr("class", "player-svg")
			div.attr("width", "60")
			div.attr("height", "60");

			div.append("circle")
				.attr("cx", 30)
				.attr("cy", 30)
				.attr("r", 20)
				.style("stroke", info.color)
				.style("stroke-width", 2)
				.style("fill", "transparent");

			div.append("rect")
				.attr("width", "15")
				.attr("height", "10")
				.attr("x", "37.5%")
				.attr("y", "42%")
				.style("stroke", info.color)
				.style("stroke-width", 2)
				.style("fill", "transparent");

			const name = document.createElement("bdi");
			name.innerText = info.username;
			name.style.color = info.color;

			if (!info.isDev){
				name.setAttribute("class", "player-widget-name");
			} else {
				name.classList.add("dev-text", "player-widget-name");
			}

			playerContainer.appendChild(name);
			playerListWrapper.appendChild(playerContainer);
		}

		//updates

		//player update
		socket.on('pupdate', info => {
			if (players[info.id]){
				if (info.id == me.myID){
					if (me.myX == "N/A" && me.myY == "N/A"){
						me.myX = info.coords.x;
						me.myY = info.coords.y;
						me.lerpX = info.coords.x;
						me.lerpY = info.coords.y;
					} else {
						me.myX = me.lerpX;
						me.myY = me.lerpY;
						me.lerpX = info.coords.x;
						me.lerpY = info.coords.y;
					}
					me.blocksUsed = info.blocksUsed;
					me.stamina = info.stamina;
					me.color = info.color;
					me.vTime = info.vTime;
					me.burntOut = info.burntOut;
				}
				players[info.id].coords = info.coords;
				players[info.id].rotation = info.rotation;
				players[info.id].health = info.health;
			} else {
				players[info.id] = {
					coords: info.coords,
					isDev: info.isDev,
					rotation: info.rotation,
					username: info.username,
					health: info.health,
					blocksUsed: info.blocksUsed,
					color: info.color,
					body: new Player(info.coords.x, info.coords.y, info.health, info.color, info.username, info.radius, info.rotation, info.isDev)
				};
				addPlayerList(players[info.id], info.id);
			}
		});

		//bullet update
		socket.on('bupdate', info => {
			if (bullets[info.playerId] == undefined){
				bullets[info.playerId] = {};
			}
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
			if (info.leave){
				delete bullets[info.playerId];
			} else {
				bullets[info.playerId][info.bulletId].body.destroy();
				delete bullets[info.playerId][info.bulletId];
			}
		});

		socket.on("blo-update", info => {
			if (blocks[info.playerId] == undefined){
				blocks[info.playerId] = {};
			}
			if (blocks[info.playerId][info.blockId]){
				blocks[info.playerId][info.blockId].health = info.health;
			} else {
				blocks[info.playerId][info.blockId] = {
					playerId: info.playerId,
					coords: info.coords,
					health: info.health,
					body: new Block(info.coords.x, info.coords.y, info.width, info.height, info.health, info.color)
				};
			}
		});

		socket.on("block-destroy", info => {
			if (info.leave){
				delete blocks[info.playerId];
			} else {
				delete blocks[info.playerId][info.blockId];
			}
		});

		function Vortex(x, y, radius, color){
			this.x = x;
			this.y = y;
			this.degree = 0;
			this.radius = radius;
			this.color = color;
		}

		Vortex.prototype.update = function(radius){
			this.radius = lerp(this.radius, radius, 0.3);
			this.degree += 10;
		};

		Vortex.prototype.render = function(){
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, false);
			ctx.fillStyle = hexToRgbA(this.color, 0.1);
			ctx.fill();

			ctx.arc(this.x, this.y, this.radius, 2 * Math.PI, false);
			ctx.lineWidth = 2;
			ctx.strokeStyle = this.color;
			ctx.stroke();


			ctx.lineWidth = 3;
			ctx.strokeStyle = this.color;
			ctx.save();
			ctx.translate(this.x, this.y);
			ctx.rotate(this.degree * Math.PI/180);
			ctx.strokeRect(this.radius / -2, this.radius / -2, this.radius / 2, this.radius);
			ctx.restore();
			ctx.save();
			ctx.translate(this.x, this.y);
			ctx.rotate(this.degree + 90 * Math.PI/180);
			ctx.strokeRect(this.radius / -2, this.radius / -2, this.radius, this.radius / 2);
			ctx.restore();
		}

		//vortex updates
		socket.on("vupdate", info => {
			if (vortexes[info.playerId] == undefined){
				vortexes[info.playerId] = {};
			}
			if (vortexes[info.playerId][info.vortexId]){
				vortexes[info.playerId][info.vortexId].radius = info.radius;
			} else {
				vortexes[info.playerId][info.vortexId] = {
					playerId: info.playerId,
					playerUsername: info.playerUsername,
					coords: info.coords,
					radius: info.radius,
					body: new Vortex(info.coords.x, info.coords.y, info.radius, info.color)
				};
			}
		});

		socket.on("vortex-destroy", info => {
			if (info.leave){
				delete vortexes[info.playerId];
			} else {
				delete vortexes[info.playerId][info.vortexId];
			}
		});

		//click event listener
		window.addEventListener("mousedown", e => {
			const info = {
				screen: {
					width: window.innerWidth,
					height: window.innerHeight
				},
				coords: {
					x: e.clientX,
					y: e.clientY
				}
			};
			if (!typing && e.button == 0){
				switch (mode){
					case "shooting":
						socket.emit("shoot", info);
						break;
					case "placing":
						socket.emit("place", info);
						break;
				}

			}
		});

		window.addEventListener("mousemove", e => {
			if (!typing){
				socket.emit("move-turret", {
					screen: {
						width: window.innerWidth,
						height: window.innerHeight
					},
					coords: {
						mouseX: e.clientX,
						mouseY: e.clientY
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
	});
	const warningHeader = document.getElementById("warning-header");
	const warning = document.getElementById("warning");

	socket.on("warning", info => {
		warningHeader.innerText = info.header;
		warning.innerText = info.warning;
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

	function serverMsg(info){
		if (me.loggedIn){
			const msgContainer = document.createElement("div");
			msgContainer.setAttribute("class", "msg-container");

			const msg = document.createElement("p");
			msg.innerText = info.message;
			msg.setAttribute("class", "msg");
			msg.style.color = "white";

			const name = document.createElement("bdi");
			name.innerText = info.username;
			name.style.color = info.color;

			if (!info.isDev){
				name.setAttribute("class", "msg");
			} else {
				name.classList.add("dev-text", "msg");
			}

			msg.prepend(name);
			msgContainer.appendChild(msg);
			serverInnerWrapper.appendChild(msgContainer);

			setTimeout(() => {
				msgContainer.remove();
			}, 3000);
		}
	}

	socket.on("recieve", info => {
		if (me.loggedIn){
			const msgContainer = document.createElement("p");
			msgContainer.setAttribute("class", "msg");
			msgContainer.style.color = "white";

			const name = document.createElement("bdi");
			name.innerText = info.username;
			name.style.color = info.color;

			if (!info.isDev){
				name.setAttribute("class", "msg");
			} else {
				name.classList.add("dev-text", "msg");
			}

			msgContainer.innerText = `: ${info.msg}`;
			msgContainer.prepend(name);

			chatInnerWrapper.appendChild(msgContainer);
			messages.push(msgContainer);

			if (messages.length > 30){
				messages[0].remove();
				messages.shift();
			}
		}
	});

	socket.on("plr-joined", info => {
		serverMsg(info);
	});

	socket.on('leave', info => {
		serverMsg(info);
		document.getElementById(info.id).remove();
		delete players[info.id];
		delete bullets[info.id];
		delete blocks[info.id];
	});

	socket.on("plr-death", info => {
		players[info.loser.id].body.color = "transparent";
		players[info.loser.id].body.dead = true;
		if (me.loggedIn){
			const msgContainer = document.createElement("div");
			msgContainer.setAttribute("class", "msg-container");

			const msg = document.createElement("p");
			msg.innerText = " was killed by ";
			msg.setAttribute("class", "msg");
			msg.style.color = "white";

			const loser = document.createElement("bdi");
			loser.innerText = info.loser.username;
			loser.style.color = info.loser.color;

			if (players[info.loser.id].isDev){
				loser.setAttribute("class", "dev-text");
			}

			const winner = document.createElement("bdi");
			winner.innerText = info.winner.username;

			if (info.type == "bot"){
				winner.style.textDecoration = "underline";
				winner.style.color = info.winner.color;
			} else {
				winner.style.color = info.winner.color;
				if (players[info.winner.id].isDev){
					winner.setAttribute("class", "dev-text")
				}
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

	window.onblur = function(){
		for (var key in keys){
			keys[key] = false;
		}
	};
})();