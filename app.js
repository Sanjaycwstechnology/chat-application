const app = require('express')();
const socketio = require('socket.io');
var MD5 = require("crypto-js/md5");
var siofu = require("socketio-file-upload");

app.use(siofu.router);
const PORT = process.env.PORT || 8080;
const mysql = require('mysql2');

const expressServer = app.listen(PORT, ()=>{
    HOST = expressServer.address().address;
    console.log("app listening at port: ", PORT);
});

const io = socketio(expressServer, {
    cors: {
        origin: "*",
        credentials: true
    }
});

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

app.get('/', function(req, res){
    res.send('socket.io is working');
});

// //MYSQL Connection Local
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'market',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+05:30'
  });
// //MYSQL Connection Local End


//MYSQL Connection Staging
// const pool = mysql.createPool({
//     host: 'all-markets-db-instance.cgt6kyhcvyth.us-east-1.rds.amazonaws.com',
//     user: 'root',
//     password: 'all_markets2022',
//     database: 'all_markets_staging',
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     timezone: '+05:30'
//   });
//MYSQL Connection End

//MYSQL Connection Production
//  const pool = mysql.createPool({
//     host: 'all-markets-production.cgt6kyhcvyth.us-east-1.rds.amazonaws.com',
//     user: 'admin',
//     password: 'KZuUMHvOx3Gg2n1',
//     database: 'all_market_prod',
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     timezone: '+05:30'
//   });
//MYSQL Connection End

io.of(/^\/\w+$/).on('connection', (socket)=>{
    const workspace = socket.nsp;
    const nspName = workspace.name.substring(1);
	console.log(nspName);
    var oldRoomId;
    var uploader = new siofu();
    uploader.dir = __dirname + "/uploads/chat";
    uploader.listen(socket);
    //Dating module
    if(nspName=='dating'){
		var select_str = "dating_profile.new_dating_profile as profile_pic";
		var join_str = "join dating_profile on dating_profile.user_id = chat_room_user.user_id";
		var join_str_sender_id = "join dating_profile on dating_profile.user_id = chat_message.sender_id";
		
	}
    //Chess module
    if(nspName=='chess'){
		var select_str = "users.profile_pic as profile_pic";
		var join_str = "join chess_profile on chess_profile.user_id = chat_room_user.user_id";
        var join_str_sender_id = "join dating_profile on dating_profile.user_id = chat_message.sender_id";	
	}
    //Student module
    if(nspName=='students'){
		var select_str = "users.profile_pic as profile_pic";
		var join_str = "";	
        var join_str_sender_id = "";	
	}
    //Business investor module
    if(nspName=='business'){
		var select_str = "users.profile_pic as profile_pic";
		var join_str = "";	
        var join_str_sender_id = "";	
	} 
    //Professional Business module
    if(nspName=='professional_collaboration'){
		var select_str = "users.profile_pic as profile_pic";
		var join_str = "";	
        var join_str_sender_id = "";	
	} 
    //Mentorship investor module
    if(nspName=='mentorship'){
		var select_str = "users.profile_pic as profile_pic";
		var join_str = "";	
        var join_str_sender_id = "";	
	}         
    
    var currentUserId = socket.handshake.query.userid;
    console.log(`${socket.id} connected ${currentUserId}`);
    let testQuery = 
    `select chat_room_user.user_id as userId, chat_room.id as roomId, users.first_name, users.last_name, `+ select_str +`, users.inbox_status,
    (select message from chat_message where chat_message.chat_room_id = chat_room.id order by created_at DESC LIMIT 1) as lastMsg,
    (select created_at from chat_message where chat_message.chat_room_id = chat_room.id order by created_at DESC LIMIT 1) as msgCreatedDate,
    (select message_type from chat_message where chat_message.chat_room_id = chat_room.id order by created_at DESC LIMIT 1) as message_type,
    (select count(1) from chat_message where  chat_message.chat_room_id = chat_room.id and chat_message.sender_id != ? and chat_message.is_read = false) as unReadMsg
    from chat_room_user 
    join users on users.id = chat_room_user.user_id 
    `+ join_str +`
    join chat_room on chat_room.id = chat_room_user.chat_room_id
    left join chat_message on chat_message.chat_room_id = chat_room.id
    where chat_room.id in (select chat_room.id from chat_room 
        join chat_room_user on chat_room_user.chat_room_id = chat_room.id 
        where chat_room_user.user_id = ?) and users.id != ? and chat_room.namespace = ? group by userId order by msgCreatedDate DESC`;

console.log(testQuery);

        var Myquery =  pool.query(testQuery, [currentUserId, currentUserId, currentUserId, nspName], function(err, rows, fields){
        if(rows){
            console.log('new slist')            
            console.log(rows);
            // console.log(Myquery.sql);
            socket.emit('messageFromServer',{users: rows});
            
        }else{
            console.log(err);
        }
    });


    socket.on('changeChat', ({roomId, userId, unreadMsg})=>{
        let updatedUnReadMsg = false;
        if(unreadMsg){
            let query = `update chat_message set is_read = true where is_read = false and sender_id = ?`;
            pool.execute(query, [userId], (_, {affectedRows, insertId})=>{
                if(affectedRows > 0){
                    console.log('updated unread msgs');
                    updatedUnReadMsg = true;
                }
            })
        }
        
        pool.execute('Select * from users where id = ?', [userId], function(err, row, fields){
            console.log("userId " + userId);
             let query = `Select chat_message.*, users.first_name, users.last_name, `+ select_str +` from chat_message 
             join users on users.id = chat_message.sender_id
             `+ join_str_sender_id +`
             where chat_message.chat_room_id = ? ORDER BY chat_message.created_at DESC LIMIT ? OFFSET ?`;
            pool.query(query, [roomId, 15, 0], function(err, rows, fields){
                if(rows){
                    let oldRoom = oldRoomId ? `room-${oldRoomId}` : null;
                    let room = `room-${roomId}`;
                    console.log(oldRoom);
                    if(oldRoomId != roomId){
                        if(oldRoom != null){
                            socket.leave(oldRoom);
                            socket.join(room);
                        }else{
                            socket.join(room);
                        }
                        console.log('users');
                        console.log(rows);
                        workspace.to(room).emit('userInfo', {user: row[0], chat: rows.reverse(), updatedUnReadMsg});
                        console.log('new id');
                        oldRoomId = roomId;
                    }else{
                        console.log('old id');

                    }
                }else{
                    console.log(err);
                }
            });
        })
    })

    socket.on('chatmessage', ({roomid, senderId, secondUserId, message})=>{
        let query = 'insert into chat_message (chat_room_id, sender_id, message) values (?, ?, ?)';
        pool.execute(query, [roomid, senderId, message], function(_, {affectedRows, insertId}){
           console.log(insertId);
            if(affectedRows > 0){
                let query = 
                `select chat_message.*, users.first_name, users.last_name, `+ select_str +`, users.inbox_status, 
                (select count(1) from chat_message where chat_message.chat_room_id = ? and chat_message.sender_id = ? and chat_message.is_read = false) as unReadMsg
                from chat_message 
                join users on users.id = chat_message.sender_id 
                `+ join_str_sender_id +`
                where chat_message.id = ?`;
                pool.execute(query, [roomid, senderId, insertId], (err, rows, fields)=>{
                    if(rows){
                        console.log('rowing');
                        console.log(rows);
                        console.log(rows[0]);
                        let room = `room-${roomid}`;
                        workspace.emit('msgReceived', {id: insertId, sentUser: senderId, roomid, receiver: secondUserId, message: rows[0]});
                    }else{
                        console.log(err);
                    }
                })
            }else{
                //send error
            }
        })
    })

    socket.on('loadMessage', ({curentUserId, lastMsgId, roomIDOfChat})=>{
        pool.execute('Select * from users where id = ?', [curentUserId], function(err, row, fields){
            let limit = '10';
            console.log("loadmore message___________________");
            console.log("curentUserId " + curentUserId);
            console.log("lastMsgId " + lastMsgId);
            console.log("roomIDOfChat " + roomIDOfChat);
            let query = `Select chat_message.*, users.first_name, `+ select_str +` from chat_message 
            join users on users.id = chat_message.sender_id 
            `+ join_str_sender_id +`
            where chat_message.chat_room_id = ? AND chat_message.id < ? ORDER BY chat_message.created_at DESC LIMIT ?`;
            pool.execute(query, [roomIDOfChat, lastMsgId, limit], function(err, rows, fields){
                if(rows){
                    let room = `room-${roomIDOfChat}`;
                    console.log("loadmore message part 2___________________");
                    console.log(rows);
                    socket.emit('moreMsg', {user: row[0], chat: rows.reverse()});
                }else{
                    console.log(err);
                }
            })
        })
        
    })

    uploader.on("start", event => {
        let fileName = event.file.name;
        let fileSize = event.file.size;
        let fileExt = fileName.split('.').pop();
        let acceptedExtensions = ['jpeg','jpg', 'png'];
        fileSize = (fileSize / 1000000).toFixed(3);
        if(!acceptedExtensions.includes(fileExt)){
            uploader.abort(event.file.id, socket);
            socket.emit('fileUpload', "Error occured! Upload only allowed file type.");
        }
        if(fileSize > 1){
            uploader.abort(event.file.id, socket);
        }
        let time = new Date();
        let hash = MD5(time).toString();
        let imgName = "dating_chat_" + hash;
        event.file.name = imgName + '.' + fileExt;
    })

    uploader.on("saved", event => {
        let fileName = event.file.name;
        let {curentUserId, roomIDOfChat} = event.file.meta.data;
        let query = 'insert into chat_message (chat_room_id, sender_id, message, message_type) values (?, ?, ?, ?)';
        pool.execute(query, [roomIDOfChat, curentUserId, fileName, '1'], function(_, {affectedRows, insertId}){
            
            if(affectedRows > 0){
                let room = `room-${roomIDOfChat}`;
                // console.log(room);
                workspace.to(room).emit('fileSent', {id: insertId, msg: fileName, msgType: 1, sentUser: curentUserId});
            }else{
                //send error
            }
        })
    });

    uploader.on("error", event => {
        console.log("Error from uploader", event);
        socket.emit('uploadError', "Oops! something went wrong!");
    });

    socket.on('changeStatus', ({status, userId})=>{
        console.log(status);
        let query = `update users set inbox_status = ? where id = ?`;
        pool.execute(query, [status, userId], function(_, {changedRows}){
            if(changedRows > 0){
                workspace.emit('userStatusChanged', {status, userId});
            }else{
                //send error
            }
        })
    }
    )

    socket.on('userTyping', ({userName})=>{
        const chapUsername = userName.charAt(0).toUpperCase() + userName.slice(1);
        let userTyping = "typing...";
        let room = `room-${oldRoomId}`;
        // console.log(userTyping);
        socket.in(room).emit('secondUserTyping', userTyping);
    })

    socket.on('disconnect', function() {
        console.log('Got disconnect!');
    });

})