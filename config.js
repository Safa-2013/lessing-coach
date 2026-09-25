window.LESSING_CONFIG={
  APP_NAME:"Lessing Schulen Coaching",
  /*
    ADMIN-KONTEN:
    Hier können die echten Admin-Zugangsdaten eingetragen werden.
    Mehrere Konten möglich.
    Beispiel:
    {user:"admin",pass:"DEIN_PASSWORT",name:"Admin"}
  */
  ADMINS:[
    {user:"admin",pass:"lessing-admin",name:"Administrator"}
  ],

  /*
    ECHTE KI:
    AI_ENDPOINT muss auf ein SICHERES Backend zeigen.
    Niemals einen Gemini/OpenAI Geheimschlüssel in diese Datei schreiben.
    POST JSON: {message, student}
    Antwort JSON: {reply}
  */
  AI_ENDPOINT:""
};