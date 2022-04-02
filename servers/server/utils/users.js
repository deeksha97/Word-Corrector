const users = [];

// Join user to chat
function userJoin(id, username) {
  const user = { id, username: username.toLowerCase() };

  users.push(user);

  return user;
}

// Get current user
function getCurrentUser(id) {
  return users.find((user) => user.id === id);
}

// User leaves chat
function userLeave(id) {
  const index = users.findIndex((user) => user.id === id);

  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
}

// Get room users
function getRoomUsers(room) {
  return users.filter((user) => user.room === room);
}

function checkUsername(username) {
  console.log('inside function checkUsername', username.toLowerCase());
  for (let i = 0; i < users.length; i++) {
    if (users[i].username === username) {
      return true;
    }
  }
  return false;
}

module.exports = {
  users,
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
  checkUsername,
};
