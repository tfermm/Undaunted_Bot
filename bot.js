var mysql = require('mysql');
var schedule = require('node-schedule');
var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var settings = require('./settings.json');
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

var sql = mysql.createConnection({
	host     : settings.mysql.host,
	user     : settings.mysql.username,
	password : settings.mysql.password,
	database : settings.mysql.database
});

var event = schedule.scheduleJob("1 * * * *", function() {
	logger.info('reloading MySQL connection');
	sql.end();
	sql = mysql.createConnection({
		host     : settings.mysql.host,
		user     : settings.mysql.username,
		password : settings.mysql.password,
		database : settings.mysql.database
	});

});

sql.connect(function(err) {
	console.log(err);
	// Initialize Discord Bot
	var bot = new Discord.Client({
		 token: auth.token,
		 autorun: true
	});

	bot.on('disconnect', function(erMsg, code) {
		console.log('----- Bot disconnected from Discord with code', code, 'for reason:', erMsg, '-----');
		bot.connect();
	});

	bot.reloadAllData = function(){
		bot.undaunted = {};
		bot.undaunted.users = {};
		bot.undaunted.userIdtoDiscordId = {};
		bot.undaunted.commands = {};
		bot.undaunted.roles = {};
		bot.undaunted.keyWords = {};
		bot.undaunted.keyWordsArray = [];
		bot.undaunted.randomResponses = {};
		bot.undaunted.randomPresence = [];

		bot.undaunted.help = "Hello I am the UndauntedBot here is a list of commands, parameters and a brief description of what they can do.\n\n!request - will save any text after the command for the bot master to review\n!ping - Pong!\n";

		bot.reloadUsers();
		bot.reloadCommands();
		bot.reloadKeywords();
		bot.reloadRandomResponses();
		bot.reloadRandomPresence();
	};

	bot.reloadCommands = function(){
		var commands = {};
		sql.query('SELECT * FROM `commands`').on('error', function(err) {
    // Handle error, an 'end' event will be emitted after this as well
		})
		.on('result', function(row) {
			commands[row.id] = {
				command: row.command,
				id: row.id,
				description: row.description,
				arguments: 0,
				responses: []
			};
		}).on('end', function(){
			sql.query('SELECT * FROM `command_responses`').on('error', function(err) {
			// Handle error, an 'end' event will be emitted after this as well
			})
			.on('result', function(row) {
				commands[row.command_id]['responses'].push({
					response: row.response,
					argument: row.argument
				});
			}).on('end', function(){
				for (var key in commands) {
					if (commands.hasOwnProperty(key)) {
						if(typeof(bot.undaunted.commands[commands[key]['command']]) === 'undefined'){
							bot.undaunted.commands[commands[key]['command']] = {};
							bot.undaunted.commands[commands[key]['command']]['responses'] = {};
						}
						bot.undaunted.help += "!" + commands[key]['command'] + " - " + commands[key]['description'] + "\n";
						for (var k in commands[key]['responses']) {
							if (commands[key]['responses'].hasOwnProperty(k)) {
								var argument = commands[key]['responses'][k]['argument'];
								if(argument === '' || argument.toLowerCase() === 'null'){
									argument = "noArgumentSupplied"
								}
								if(typeof(bot.undaunted.commands[commands[key]['command']]['responses'][argument]) === 'undefined'){
									bot.undaunted.commands[commands[key]['command']]['responses'][argument] = [];
								}
								if(argument !== "noArgumentSupplied"){
									bot.undaunted.help += "\t\t" + argument + "\n";
								}
								bot.undaunted.commands[commands[key]['command']]['responses'][argument].push(commands[key]['responses'][k]['response']);
							}
						}
					}
				}
			});
		});
	};

	bot.reloadKeywords = function(){
		var key_words = {};
		sql.query('SELECT * FROM `key_words`').on('error', function(err) {
    // Handle error, an 'end' event will be emitted after this as well
		})
		.on('result', function(row) {
			key_words[row.id] = {
				trigger: row.trigger.toLowerCase(),
				id: row.id,
				probability: row.probability,
				responses: []
			};
			bot.undaunted.keyWordsArray.push(row.trigger.toLowerCase());
			if(typeof(bot.undaunted.keyWords[row.trigger]) === 'undefined'){
				bot.undaunted.keyWords[row.trigger] = {};
				bot.undaunted.keyWords[row.trigger]['probability'] = row.probability;
			}
		}).on('end', function(){
			sql.query('SELECT * FROM `key_words_responses`').on('error', function(err) {
			// Handle error, an 'end' event will be emitted after this as well
			})
			.on('result', function(row) {
				key_words[row.key_words_id]['responses'].push(row.response);
			}).on('end', function(){
				for (var key in key_words) {
					if (key_words.hasOwnProperty(key)) {
						if(typeof(bot.undaunted.keyWords[key_words[key]['trigger']]['responses']) === 'undefined'){
							bot.undaunted.keyWords[key_words[key]['trigger']]['responses'] = [];
						}
						for(var k in key_words[key]['responses']){
							bot.undaunted.keyWords[key_words[key]['trigger']]['responses'].push(key_words[key]['responses'][k]);
						}
					}
				}
			});
		});
	};

	bot.reloadRandomPresence = function(){
		sql.query('SELECT presence FROM `presence`').on('error', function(err) {
    // Handle error, an 'end' event will be emitted after this as well
		}).on('result', function(row) {
			bot.undaunted.randomPresence.push(row.presence);
		});
	};

	bot.reloadRandomResponses = function(){
		sql.query('SELECT * FROM `random_response`').on('error', function(err) {
    // Handle error, an 'end' event will be emitted after this as well
		})
		.on('result', function(row) {
			bot.undaunted.randomResponses[row.id] = {};
			bot.undaunted.randomResponses[row.id]['probability'] = row.probability;
			bot.undaunted.randomResponses[row.id]['responses'] = [];
		}).on('end', function(){
			sql.query('SELECT * FROM `random_response_responses`').on('error', function(err) {
			// Handle error, an 'end' event will be emitted after this as well
			}).on('result', function(row) {
				bot.undaunted.randomResponses[row.random_response_id]['responses'].push(row.response);
			});
		});
	}

	bot.reloadUsers = function(){
		sql.query('SELECT * FROM `users`').on('error', function(err) {
    // Handle error, an 'end' event will be emitted after this as well
		}).on('result', function(row) {
			bot.undaunted.userIdtoDiscordId[row.id] = [row.userID];
			bot.undaunted.users[row.userID] = {
				userID: row.userID
			};
		}).on('end', function(){
			bot.reloadRoles();	
		});
	};

	bot.reloadRoles = function(){
		sql.query('SELECT * FROM `roles`').on('error', function(err) {
    // Handle error, an 'end' event will be emitted after this as well
		}).on('result', function(row) {
			bot.undaunted.roles[row.role] = row.id;
		}).on('end', function(){
			sql.query('SELECT * FROM `users_roles`').on('error', function(err) {
			// Handle error, an 'end' event will be emitted after this as well
			}).on('result', function(row) {
				bot.undaunted.users[bot.undaunted.userIdtoDiscordId[row.user_id]]['role'] = row.role_id;
			});
			
		});
	};

	bot.addUser = function(user){
		logger.info(user);
		bot.undaunted.users[user.userID] = {
			userID: user.userID	
		};
		var query = sql.query("INSERT INTO users (user, userID) VALUES (?,?)", [user.user, user.userID], function(error, results, fields){
			logger.info(error);
		});
		logger.info(query.sql);
	}

	bot.findOne = function(message) {
		message = message.toLowerCase();
		arr = message.split(' ');
		var haystack = bot.undaunted.keyWords;
		var keyWord = "";
		if(bot.undaunted.keyWordsArray.some(function (v) {
			if(message.indexOf(v) !== -1){
				keyWord = v;
				return true;
			}else{
				return false;
			}
		})){
			return keyWord;
		}else{
			return false;
		}
	};

	bot.on('ready', function (evt) {
			logger.info('Connected');
			logger.info('Logged in as: ');
			logger.info(bot.username + ' - (' + bot.id + ')');
			// bot.setPresence({game: {name: "with your heart"}})
			bot.reloadAllData();

			bot.setPresence({game: {name: "with the Danger Zone"}})

			var setPresence = schedule.scheduleJob("*/10 * * * *", function() {
				bot.setPresence({game: {name: bot.undaunted.randomPresence[Math.floor(Math.random()*bot.undaunted.randomPresence.length)]}})
			});
	});
	bot.on('message', function (user, userID, channelID, message, evt) {
		// new user for the bot, lets add them as a user.
		if(typeof(bot.undaunted.users[userID]) === 'undefined'){
			bot.addUser({
				userID: userID,
				user: user
			});
		}
		// Our bot needs to know if it will execute a command
		// It will listen for messages that will start with `!`
		try{
			if (message.substring(0, 1) == '!') {
				var args = message.substring(1).split(' ');
				var cmd = args[0];
				args = args.splice(1);
				
				if(typeof(bot.undaunted.commands[cmd]) === 'undefined'){
					switch(cmd) {
						// !ping
						case 'ping':
							bot.sendMessage({
								to: channelID,
								message: 'Pong!'
							});
						break;
						case 'request':
							var query = sql.query("INSERT INTO requests (request) VALUES (?)", [args.join(' ')], function(error, results, fields){
								bot.sendMessage({
									to: channelID,
									message: 'Your request has been noted and will be reviewed.'
								});
							});
						break;
						case 'reload':
							if(bot.undaunted.users[userID]['role'] === 1){
								bot.reloadAllData();
								bot.sendMessage({
									to: channelID,
									message: 'Commands and user roles reloaded.'
								});
							}
						break;
						case 'help':
							bot.sendMessage({
								to: channelID,
								message: bot.undaunted.help
							});
						break;
						case 'users':
							if(bot.undaunted.users[userID]['role'] === 1){
								console.log(bot.getAllUsers());
							}
						break;
						case 'setPresence':
							if(bot.undaunted.users[userID]['role'] === 1){
								bot.setPresence({game: {name: args.join(' ')}})
							}
						break;
						case 'stealthnuke':
							if(bot.undaunted.users[userID]['role'] === 1){
								try{
									var minutes = parseInt(args[0]);
								bot.getMessages({
									channelID: channelID,
									limit: 100
								}, function(error, messages){
									var messageDate = Date.parse(messages[0]['timestamp']);
									var messageDateTimed = messageDate - minutes*60000;
									for(key in messages){
										var m = messages[key];
										var newDate = new Date(m['timestamp']);
										if(newDate > messageDateTimed){
											bot.deleteMessage({
												channelID: channelID,
												messageID: m.id
											});
										}
									}
								});
								}catch(e){}
							}
						break;
						case 'nuke':
							if(bot.undaunted.users[userID]['role'] === 1){
								try{
									var minutes = parseInt(args[0]);
								bot.getMessages({
									channelID: channelID,
									limit: 100
								}, function(error, messages){
									var messageDate = Date.parse(messages[0]['timestamp']);
									var messageDateTimed = messageDate - minutes*60000;
									for(key in messages){
										var m = messages[key];
										var newDate = new Date(m['timestamp']);
										if(newDate > messageDateTimed){
											bot.deleteMessage({
												channelID: channelID,
												messageID: m.id
											});
										}
									}
									bot.sendMessage({
										to: channelID,
										message: 'https://i.imgur.com/tmH0mcX.gif'
									});
								});
								}catch(e){}
							}
						break;
					}
				}else{
					if(typeof(args[0]) !== 'undefined'){
						arg = args[0].toLowerCase();
						if(typeof(bot.undaunted.commands[cmd]['responses'][arg]) !== 'undefined'){
							var possibleResponses = bot.undaunted.commands[cmd]['responses'][arg];
							if(possibleResponses.length > 1){
								bot.sendMessage({
									to: channelID,
									message: possibleResponses[Math.floor(Math.random()*possibleResponses.length)]
								});
							}else{
								if(possibleResponses.length !== 0){
									bot.sendMessage({
										to: channelID,
										message: possibleResponses[0]
									});
								}
							}
						}else{
							if(typeof(bot.undaunted.commands[cmd]['responses']['noArgumentSupplied']) !== 'undefined'){
								if(Object.keys(bot.undaunted.commands[cmd]['responses']['noArgumentSupplied']).length > 1){
									bot.sendMessage({
										to: channelID,
										message: bot.undaunted.commands[cmd]['responses']['noArgumentSupplied'][Math.floor(Math.random()*bot.undaunted.commands[cmd]['responses']['noArgumentSupplied'].length)]
									});
								}else{
									if(Object.keys(bot.undaunted.commands[cmd]['responses']['noArgumentSupplied']).length !== 0){
										bot.sendMessage({
											to: channelID,
											message: bot.undaunted.commands[cmd]['responses']['noArgumentSupplied'][0]
										});
									}
								}
							}
						}
					}else{
						if(typeof(bot.undaunted.commands[cmd]['responses']['noArgumentSupplied']) !== 'undefined'){
							if(Object.keys(bot.undaunted.commands[cmd]['responses']['noArgumentSupplied']).length > 1){
								bot.sendMessage({
									to: channelID,
									message: bot.undaunted.commands[cmd]['responses']['noArgumentSupplied'][Math.floor(Math.random()*bot.undaunted.commands[cmd]['responses']['noArgumentSupplied'].length)]
								});
							}else{
								if(Object.keys(bot.undaunted.commands[cmd]['responses']['noArgumentSupplied']).length !== 0){
									bot.sendMessage({
										to: channelID,
										message: bot.undaunted.commands[cmd]['responses']['noArgumentSupplied'][0]
									});
								}
							}
						}
					}	
				}
			}else if(userID !== settings.userID){
				var keyWord = bot.findOne(message);
				if(keyWord !== false && typeof(bot.undaunted.keyWords[keyWord]) !== 'undefined'){
					var sendMessage = false;
					if(bot.undaunted.keyWords[keyWord]['probability'] === 0){
						sendMessage = true;
					}else{
						if(Math.floor(Math.random()*parseInt(bot.undaunted.keyWords[keyWord]['probability'])+1) === 1){
							sendMessage = true;
						}
					}
					if(sendMessage === true){
						if(bot.undaunted.keyWords[keyWord]['responses'].length > 1){
							bot.sendMessage({
								to: channelID,
								message: bot.undaunted.keyWords[keyWord]['responses'][Math.floor(Math.random()*bot.undaunted.keyWords[keyWord]['responses'].length)].replace('~~userID~~','<@' + userID + '>')
							});
						}else{
							if(bot.undaunted.keyWords[keyWord]['responses'].length !== 0){
								bot.sendMessage({
									to: channelID,
									message: bot.undaunted.keyWords[keyWord]['responses'][0].replace('~~userID~~','<@' + userID + '>')
								});
							}
						}
					}			
				}else{
					var keys = Object.keys(bot.undaunted.randomResponses);
					var randomResponse = bot.undaunted.randomResponses[keys[Math.floor(Math.random()*keys.length)]]
					if(typeof(randomResponse) !== undefined){
						if(randomResponse['probability'] === 0){
							sendMessage = true;
						}else{
							if(Math.floor(Math.random()*parseInt(randomResponse['probability'])+1) === 1){
								sendMessage = true;
							}
						}
						if(sendMessage === true){
							if(randomResponse['responses'].length > 1){
								bot.sendMessage({
									to: channelID,
									message: randomResponse['responses'][Math.floor(Math.random()*randomResponse['responses'].length)]
								});
							}else{
								if(randomResponse['responses'].length !== 0){
									bot.sendMessage({
										to: channelID,
										message: randomResponse['responses'][0]
									});
								}
							}
						}			
					}
				}
			}
		}catch(e){}
	});
});
