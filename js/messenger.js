$(document).ready(function() {

	function PubNub() {
		this.publishKey = 'pub-c-8781d89b-1000-422d-b6ec-b75340d087bc';
		this.subscribeKey = 'sub-c-fda9bb42-b75a-11e2-bc76-02ee2ddab7fe';
		this.subscriptions = localStorage["pn-subscriptions"] || [];

		if ( typeof this.subscriptions == "string") {
			this.subscriptions = this.subscriptions.split(",");
		}
		this.subscriptions = $.unique(this.subscriptions);
	}


	PubNub.prototype.connect = function(username) {
		this.username = username;
		this.connection = PUBNUB.init({
			publish_key : this.publishKey,
			subscribe_key : this.subscribeKey,
			uuid : this.username
		});
	};

	PubNub.prototype.addSubscription = function(channel) {
		this.subscriptions.push(channel);
		this.subscriptions = $.unique(this.subscriptions);
	};

	PubNub.prototype.removeSubscription = function(channel) {
		if (this.subscriptions.indexOf(channel) !== -1) {
			this.subscriptions.splice(this.subscriptions.indexOf(channel), 1);
		}
		this.saveSubscriptions();
	};

	PubNub.prototype.saveSubscriptions = function() {
		localStorage["pn-subscriptions"] = this.subscriptions;
	};

	PubNub.prototype.subscribe = function(options) {
		this.connection.subscribe.apply(this.connection, arguments);
		this.addSubscription(options.channel);
		this.saveSubscriptions();
	};

	PubNub.prototype.unsubscribe = function(options) {
		this.connection.unsubscribe.apply(this.connection, arguments);
	};

	PubNub.prototype.publish = function() {
		this.connection.publish.apply(this.connection, arguments);
	};

	PubNub.prototype.history = function() {
		this.connection.history.apply(this.connection, arguments);
	};

	var chatChannel = '', username = '', users = [], usernameInput = $('#username'), chatRoomName = $("#chatRoomName"), chatButton = $("#startChatButton"), newChatButton = $("#newChatButton"), chatListEl = $("#chatList"), sendMessageButton = $("#sendMessageButton"), backButton = $("#backButton"), messageList = $("#messageList"), messageContent = $("#messageContent"), userList = $("#userList"), pubnub = new PubNub(), isBlurred = false, timerId = -1, pages = {
		home : $("#homePage"),
		chatList : $("#chatListPage"),
		chat : $("#chatPage"),
		deleteRoom : $("#delete")
	};

	// Blur tracking
	$(window).on('blur', function() {
		isBlurred = true;
	}).on("focus", function() {
		isBlurred = false;
		clearInterval(timerId);
		document.title = "Pub Chat";
	});

	// Request permission for desktop notifications.
	var notificationPermission = 1;
	if (window.webkitNotifications) {
		notificationPermission = window.webkitNotifications.checkPermission();

		if (notificationPermission === 1) {
			window.webkitNotifications.requestPermission(function(event) {
				notificationPermission = window.webkitNotifications.checkPermission();
			});
		}
	}

	////////
	// Home View
	/////
	function HomeView() {
		if (localStorage["username"]) {
			usernameInput.val(localStorage["username"]);
		}

		chatButton.off('click');
		chatButton.click(function(event) {
			if (usernameInput.val() != '') {
				username = usernameInput.val();

				localStorage["username"] = username;

				pubnub.connect(username);

				$('#homePage').hide();
				ChatListView();
				/*$.mobile.changePage(pages.chatList);*/
			} else {
				alert("Enter Your Name");
			}
		});
	};

	/////
	// Chat List View
	///////
	function ChatListView(event, data) {
		$('#chatListPage').show();
		chatListEl.empty();
		for (var i = 0; i < pubnub.subscriptions.length; i++) {
			var chatName = pubnub.subscriptions[i], chatEl = $("<li><a href='#chatPage' id='" + chatName + "' class='room-button'>" + chatName + "</a><a href='#delete' id='del-" + chatName + "' class='button delete'>delete</a></li>");
			chatListEl.append(chatEl);
			/*chatListEl.listview('refresh');*/
		}

		newChatButton.off('click');
		newChatButton.click(function(event) {
			if (chatRoomName.val() !== '') {
				chatChannel = chatRoomName.val();

				$('#chatListPage').hide();
				ChatView();
				/*$.mobile.changePage(pages.chat);*/
			}
		});

		$('.room-button').off('click');
		$('.room-button').click(function() {
			chatChannel = $(this).attr('id');
			$('#chatListPage').hide();
			ChatView();
		});

		$('.delete').off('click');
		$('.delete').click(function() {
			chatChannel = $(this).attr('id').substring(4);
			DeleteChatView();
		});
	};

	//////
	// Delete Chat View
	///////
	function DeleteChatView(event, data) {
		var channelName = chatChannel, deleteButton = pages.deleteRoom.find("#deleteButton");
		loadPopupBox();
		/*
		 if (data.options && data.options.link) {
		 var channelName = data.options.link.attr('data-channel-name'),
		 deleteButton = pages.deleteRoom.find("#deleteButton");

		 deleteButton.unbind('click');
		 deleteButton.click(function (event) {
		 pubnub.removeSubscription(channelName);
		 console.log(pages.deleteRoom.children());
		 pages.deleteRoom.find('[data-rel="back"]').click();
		 });
		 }*/

	};

	function unloadPopupBox() {// TO Unload the Popupbox
		$('#popup_box').fadeOut("slow");
	}

	function loadPopupBox() {// To Load the Popupbox
		$('#popup_box').fadeIn(50);
	}

	/////
	// Chatting View
	//////
	function ChatView(event, data) {
		$('#chatPage').show();
		alert(chatChannel);
		var self = this;

		/*
		 if (data.options && data.options.link) {
		 chatChannel = data.options.link.attr('data-channel-name');
		 }*/

		users = [];
		messageList.empty();
		userList.empty();

		pubnub.unsubscribe({
			channel : chatChannel
		});

		pubnub.subscribe({
			channel : chatChannel,
			message : self.handleMessage,
			presence : function(message, env, channel) {
				if (message.action == "join") {
					users.push(message.uuid);
					userList.append("<li data-username='" + message.uuid + "'>" + message.uuid + "</li>");
				} else {
					users.splice(users.indexOf(message.uuid), 1);
					userList.find('[data-username="' + message.uuid + '"]').remove();
				}

				userList.listview('refresh');
			}
		});

		// Handle chat history
		pubnub.history({
			channel : chatChannel,
			limit : 100
		}, function(messages) {
			messages = messages[0];
			messages = messages || [];

			for (var i = 0; i < messages.length; i++) {
				self.handleMessage(messages[i], false);
			}

			$(document).scrollTop($(document).height());
		});

		// Change the title to the chat channel.
		pages.chat.find("h1:first").text(chatChannel);

		messageContent.off('keydown');
		messageContent.bind('keydown', function(event) {
			if ((event.keyCode || event.charCode) !== 13)
				return true;
			sendMessageButton.click();
			return false;
		});

		sendMessageButton.off('click');
		sendMessageButton.click(function(event) {
			var message = messageContent.val();

			if (message !== "") {
				pubnub.publish({
					channel : chatChannel,
					message : {
						username : username,
						text : message
					}
				});

				messageContent.val("");
			}
		});

		backButton.off('click');
		backButton.click(function(event) {
			pubnub.unsubscribe({
				channel : chatChannel
			});
		});
	};

	// This handles appending new messages to our chat list.
	ChatView.prototype.handleMessage = function(message, animate) {
		if (animate !== false)
			animate = true;

		var messageEl = $("<li class='message'>" + "<span class='username'>" + message.username + "</span>" + message.text + "</li>");
		messageList.append(messageEl);
		messageList.listview('refresh');

		// Scroll to bottom of page
		if (animate === true) {
			$("html, body").animate({
				scrollTop : $(document).height() - $(window).height()
			}, 'slow');
		}

		if (isBlurred) {
			// Flash title if blurred
			clearInterval(timerId);
			timerId = setInterval(function() {
				document.title = document.title == "Pub Chat" ? "New Message" : "Pub Chat";
			}, 2000);

			// Notification handling
			if (notificationPermission === 0 && message.username !== username) {
				var notification = window.webkitNotifications.createNotification('icon.jpg', 'PubNub Messenger Notification', message.username + " said " + message.text);

				notification.onclick = function() {
					notification.close();
				}

				notification.show();
			}
		}
	};

	// Initially start off on the home page.
	/*$.mobile.changePage(pages.home);*/
	var currentView = new HomeView();

	// This code essentially does what routing does in Backbone.js.
	// It takes the page destination and creates a view based on what
	// page the user is navigating to.
	$(document).bind("pagechange", function(event, data) {
		alert("here");
		if (data.toPage[0] == pages.chatList[0]) {
			currentView = new ChatListView(event, data);
		} else if (data.toPage[0] == pages.deleteRoom[0]) {
			currentView = new DeleteChatView(event, data);
		} else if (data.toPage[0] == pages.chat[0]) {
			currentView = new ChatView(event, data);
		}
	});
}); 