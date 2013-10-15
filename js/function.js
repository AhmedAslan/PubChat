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

	var chatChannel = '', 
		username = '', 
		users = [], 
		usernameInput = $('#username'), 
		chatRoomName = $("#chatRoomName"), 
		chatButton = $("#startChatButton"), 
		newChatButton = $("#newChatButton"), 
		chatListEl = $("#chatList"), 
		sendMessageButton = $("#sendMessageButton"), 
		backButton = $("#backButton"), 
		messageList = $("#messageList"), 
		messageContent = $("#messageContent"), 
		userList = $("#userList"), 
		pubnub = new PubNub(), 
		isBlurred = false, 
		timerId = -1, 
		pages = {
			home : $("#homePage"),
			chatList : $("#chatListPage"),
			chat : $("#chatPage"),
			deleteRoom : $("#delete")
	};
	
	// Initially start off on the home page.
	var currentView = new HomeView();

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
		
		if ($('#chatRoomName').val() != "") $('#chatRoomName').val("");
		
		chatListEl.empty();
		
		for (var i = 0; i < pubnub.subscriptions.length; i++) {
			var chatName = pubnub.subscriptions[i], 
				chatEl = $("<li><a href='#chatPage' id='" 
						 + chatName + "' class='room-button'>" 
						 + chatName + "</a><a href='#delete' id='del-" 
						 + chatName 
						 + "' class='button delete'>delete</a></li>");
						 
			chatListEl.append(chatEl);
		}

		newChatButton.off('click');
		newChatButton.click(function(event) {
			if (chatRoomName.val() !== '') {
				chatChannel = chatRoomName.val();

				$('#chatListPage').hide();
				ChatView();
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
		var channelName = chatChannel, 
			deleteButton = pages.deleteRoom.find("#deleteButton");
		$('#popup_box label').text('Room Name : "' + channelName + '"');
		loadPopupBox();

		$('#yes').off('click');
		$('#yes').click(function() {
			pubnub.removeSubscription(channelName);
			unloadPopupBox();
			ChatListView();
		});
	};

	function unloadPopupBox() {
		$('#popup_box').fadeOut("slow");
	}

	function loadPopupBox() {
		$('#popup_box').fadeIn(50);
	}

	/////
	// Chatting View
	//////
	function ChatView(event, data) {
		$('#chatPage').show();
		
		var self = this;
			users = [];
		messageList.empty();
		userList.empty();
		
		pubnub.unsubscribe({
	      channel: chatChannel
	    });
	
	    pubnub.subscribe({
	      channel: chatChannel,
	      message: self.handleMessage,
	      presence   : function( message, env, channel ) {
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
		
		// Change the title to the chat channel.
		pages.chat.find("h1:first").text(chatChannel);

		// Handle chat history
		pubnub.history({
			channel : chatChannel,
			limit : 100
		}, function(messages) {
			messages = messages[0];
			messages = messages || [];

			for (var i = 0; i < messages.length; i++) {
				ChatView.prototype.handleMessage(messages[i], false);
				
			}
			
			users.push(usernameInput);
          	userList.append("<li>" + usernameInput.val() + "</li>");

			$(document).scrollTop($(document).height());
		});		

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
			
			if ($.trim(message).length > 0) {
				pubnub.publish({
					channel : chatChannel,
					message : {
						username : username,
						text : message
					}
				});
				
				var message = {
						username : username,
						text : message
					}
				
				ChatView.prototype.handleMessage(message, false);
				
				messageContent.val("");
			}
			
			
		});

		backButton.off('click');
		backButton.click(function(event) {
			pubnub.unsubscribe({
				channel : chatChannel
			});
			
			pages.chat.hide();
			
			ChatListView();
			/*pages.chatList.show();*/
		});
	};

	// This handles appending new messages to our chat list.
	ChatView.prototype.handleMessage = function(message, animate) {
		if (animate !== false)
			animate = true;

		var messageEl = $("<li class='message'>" 
						+ "<span class='username'>" 
						+ message.username 
						+ "</span>&nbsp;:&nbsp;" 
						+ message.text + "</li>");
		messageList.append(messageEl);		
	};

	
});
