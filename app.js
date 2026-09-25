function openLogin(){document.getElementById("login").classList.remove("hidden")}
function login(){
let u=document.getElementById("user").value;
let p=document.getElementById("pass").value;
if(u==="admin"&&p==="1234"){
show("Big Admin");
}else if(u==="Lessing"&&p==="Schulen"){
show("Admin");
}else{
document.getElementById("msg").innerText="Falsche Daten";
}}
function show(r){
document.getElementById("login").classList.add("hidden");
document.getElementById("panel").classList.remove("hidden");
document.getElementById("role").innerText=r+" angemeldet";
}