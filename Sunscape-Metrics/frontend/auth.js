/* ===================== AUTH (demo only — no real backend) =====================
   Stores a simple user object in localStorage after "sign in". No password
   is ever stored or checked against anything real — swap this file for real
   authentication calls later without touching index.html or script.js.
================================================================================ */

const AUTH_KEY = "sunscape_user";

function getUser(){
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }
  catch (err) { return null; }
}

function setUser(user){
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function signOut(){
  localStorage.removeItem(AUTH_KEY);
  window.location.href = "login.html";
}

/* Call at the top of a protected page. Sends the visitor to login.html if
   nobody is signed in yet. */
function requireLogin(){
  if (!getUser()){
    window.location.href = "login.html";
  }
}
